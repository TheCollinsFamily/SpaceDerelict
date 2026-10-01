/**
 * The infested planet (Oct 1 2026; Collins: "you should have regions look infested when they are
 * infested on the map"). Opens the Directive Desk with a campaign holding none, some and many
 * territories, turns the planet so the held ground sits on the day side and then the night side,
 * and screenshots the globe; checks the held ground reads as infested (flesh-red pixels) and that
 * more held ground draws more of it.
 *
 * Usage: node tools/shot-globe-infest.mjs        (starts its own dev server on 5241)
 * Artifacts: notes/screens/2026-10-01/globe-infest-<case>-<side>.png
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5241);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

/** Held lists, oldest capture first (the order the save keeps them in). */
const CASES = {
  none: ['crash-site'],
  some: ['crash-site', 'granary', 'cul-de-sac', 'harbor'],
  many: ['crash-site', 'granary', 'cul-de-sac', 'harbor', 'commuter', 'temple', 'foundry', 'mirewater', 'ossuary', 'pilgrim', 'university'],
};
const only = process.argv[2];

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const reds = {};
  for (const [name, held] of Object.entries(CASES)) {
    if (only && only !== name) continue;
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
      localStorage.setItem('broodfall-intro-seen', '1');
    });
    // A fresh campaign with its desk open, then the held ground written into its save.
    await page.goto(`http://localhost:${PORT}/?campaign=ship&open=1`);
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 30000 });
    await page.evaluate((h) => {
      const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
      s.held = h; s.captures = h.length - 1; s.underAttack = null;
      if (s.onboard) s.onboard.deskOpen = true;
      // The newest capture is seen growing in (Globe3D remembers what it last showed): show it grown.
      localStorage.setItem('broodfall-globe-seen', JSON.stringify(Object.fromEntries(h.map((id) => [id, 9]))));
      localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    }, held);
    await page.goto(`http://localhost:${PORT}/?campaign=ship`);
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 30000 });
    await page.locator('[data-room="desk"]').click();
    await page.waitForSelector('canvas.globe-3d', { timeout: 15000 });
    await page.waitForTimeout(2500);
    // Day: the held ground (around lon 0..40) turned toward the sun (the left of the disc).
    // Night: turned past the terminator to the right.
    for (const [side, turns] of [['day', 2], ['night', -1]]) {
      for (let i = 0; i < Math.abs(turns); i++) { await page.keyboard.press(turns > 0 ? 'ArrowRight' : 'ArrowLeft'); await page.waitForTimeout(80); }
      await page.waitForTimeout(1800);
      const bb = await page.locator('canvas.globe-3d').boundingBox();
      await page.screenshot({ path: join(out, `globe-infest-${name}-${side}.png`), clip: { x: bb.x - 20, y: bb.y - 20, width: bb.width + 40, height: bb.height + 40 } });
      const red = await page.evaluate(() => {
        const c = document.querySelector('canvas.globe-3d');
        const copy = document.createElement('canvas');
        copy.width = c.width; copy.height = c.height;
        const g = copy.getContext('2d');
        g.drawImage(c, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 70 && d[i] > d[i + 1] * 1.7 && d[i] > d[i + 2] * 1.5) n++;
        return n;
      });
      reds[`${name}-${side}`] = red;
      console.log(`  ${name} ${side}: ${red} flesh-red pixels`);
      // Back to the start for the next side.
      for (let i = 0; i < Math.abs(turns); i++) { await page.keyboard.press(turns > 0 ? 'ArrowLeft' : 'ArrowRight'); await page.waitForTimeout(80); }
    }
    check(errors.length === 0, `${name}: no page errors`, errors.slice(0, 2).join(' | '));
    await page.close();
  }
  // A fresh capture grows out of its landing site the first time the desk shows it, and only then.
  if (!only || only === 'grow') {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => {
      localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
      localStorage.setItem('broodfall-intro-seen', '1');
    });
    await page.goto(`http://localhost:${PORT}/?campaign=ship&open=1`);
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 30000 });
    await page.evaluate((h) => {
      const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
      s.held = h; s.captures = h.length - 1; s.underAttack = null;
      if (s.onboard) s.onboard.deskOpen = true;
      localStorage.setItem('broodfall-globe-seen', JSON.stringify({ 'crash-site': 1, granary: 1, 'cul-de-sac': 0.68 }));
      localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    }, CASES.some);
    await page.goto(`http://localhost:${PORT}/?campaign=ship`);
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 30000 });
    await page.locator('[data-room="desk"]').click();
    await page.waitForSelector('canvas.globe-3d', { timeout: 15000 });
    await page.keyboard.press('ArrowLeft');
    const shotAt = async (tag) => {
      const bb = await page.locator('canvas.globe-3d').boundingBox();
      await page.screenshot({ path: join(out, `globe-infest-grow-${tag}.png`), clip: { x: bb.x - 20, y: bb.y - 20, width: bb.width + 40, height: bb.height + 40 } });
    };
    await page.waitForTimeout(300); await shotAt('1-start');
    await page.waitForTimeout(2300); await shotAt('2-mid');
    await page.waitForTimeout(5000); await shotAt('3-grown');
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-globe-seen')));
    check(seen.harbor === 0.34, 'the fresh capture is remembered as seen grown', JSON.stringify(seen));
    await page.close();
  }
  // The flat painter (no WebGL; src/ui/globe.ts): the same held ground, painted.
  if (!only || only === 'flat') {
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
    await page.goto(`http://localhost:${PORT}/?seed=1`);
    const flat = await page.evaluate(async (held) => {
      const m = await import('/src/ui/globe.ts');
      const { TERRITORIES } = await import('/content/campaign.ts');
      const zones = TERRITORIES.filter((t) => !t.hidden).map((t) => ({ id: t.id, lat: t.lat, lon: t.lon,
        state: held.includes(t.id) ? 'held' : 'open', growth: m.heldGrowth(held, t.id) }));
      const g = new m.Globe();
      await g.load('/art/ship/planet.webp');
      document.body.innerHTML = '<div id="flat" style="display:flex;gap:10px;background:#05080b;padding:10px"></div>';
      let red = 0;
      for (const spin of [0, -30]) {
        const c = document.createElement('canvas');
        document.getElementById('flat').append(c);
        g.paint(c, spin, zones, null);
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 70 && d[i] > d[i + 1] * 1.7 && d[i] > d[i + 2] * 1.5) red++;
      }
      return red;
    }, CASES.some);
    await page.locator('#flat').screenshot({ path: join(out, 'globe-infest-flat-some.png') });
    check(flat > 5000, 'the flat painter draws the flesh too', `${flat} flesh-red pixels`);
    await page.close();
  }
  if (!only) {
    check(reds['some-day'] > reds['none-day'] * 1.5, 'some held reads redder than none (day)', `${reds['none-day']} -> ${reds['some-day']}`);
    check(reds['many-day'] > reds['some-day'], 'many held reads redder than some (day)', `${reds['some-day']} -> ${reds['many-day']}`);
    check(reds['many-night'] > reds['none-night'] * 1.5, 'held ground glows on the night side', `${reds['none-night']} -> ${reds['many-night']}`);
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
