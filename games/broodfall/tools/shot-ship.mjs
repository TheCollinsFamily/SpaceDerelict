/**
 * Screenshot beats of THE SHIP with its art, and its checks: every room has its picture,
 * the planet is a projection with zones, YOKE is there, the notebook has its sketches.
 *
 * Usage: npm run build && node tools/shot-ship.mjs
 * Artifacts: tools/screenshots/ship-*.png
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = 5199;
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
function startPreview() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite preview exited early (${code})`)));
  });
}

/** The address inside a style value like url("..."). */
const addressIn = (v) => (v.includes('"') ? v.slice(v.indexOf('"') + 1, v.lastIndexOf('"')) : '');

const server = await startPreview();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
  });
  await page.goto(`http://localhost:${PORT}/?seed=7`);
  await page.waitForSelector('#menu-campaign');
  await page.screenshot({ path: join(shots, 'ship-0-menu.png') });
  await page.locator('#menu-campaign').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => document.getElementById('campaign').classList.contains('ship-art')), 'the ship has its art');

  const bg = () => page.evaluate(() => getComputedStyle(document.getElementById('campaign')).backgroundImage);
  const rooms = ['desk', 'genes', 'locker', 'board', 'comms', 'ai'];
  for (const r of rooms) {
    await page.locator(`[data-room="${r}"]`).click();
    await page.waitForTimeout(350);
    const image = await bg();
    // The picture has to be THERE, not only named: it is fetched and measured.
    const url = addressIn(image);
    const size = url ? await page.evaluate(async (u) => { try { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth; } catch { return 0; } }, url) : 0;
    check(image.includes(`room-${r}`) && size >= 1024, `the ${r} room has its picture`, `${size} px wide`);
    await page.screenshot({ path: join(shots, `ship-${rooms.indexOf(r) + 1}-${r}.png`) });
  }

  // The planet: a projection, divided into zones, that turns under the hand.
  await page.locator('[data-room="desk"]').click();
  await page.waitForSelector('canvas.globe-map');
  const lit = (sel) => page.evaluate((s) => {
    const c = document.querySelector(s);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let red = 0, any = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40) any++;
      if (d[i] > 120 && d[i] > d[i + 1] * 1.6 && d[i] > d[i + 2] * 1.6) red++;
      sum += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + i % 97;
    }
    return { red, any, sum };
  }, sel);
  const before = await lit('canvas.globe-map');
  check(before.any > 100000, 'the planet is drawn', `${before.any} lit pixels`);
  check(before.red > 800, 'ground that is held is red on the planet', `${before.red} red pixels`);
  const sites = await page.locator('.globe .site').count();
  check(sites >= 4, 'landing sites are marked on it', String(sites));
  const box = await page.locator('.globe-box').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.85);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.85, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await lit('canvas.globe-map');
  check(after.sum !== before.sum, 'the planet turns under the hand');
  await page.locator('.globe .site.open').first().click();
  await page.waitForTimeout(300);
  const sketches = await page.locator('.cp-brief .cp-sketch').count();
  const sketchPx = await page.evaluate(async () => {
    const v = getComputedStyle(document.getElementById('campaign')).getPropertyValue('--sketches');
    const u = v.slice(v.indexOf('"') + 1, v.lastIndexOf('"'));
    try { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth; } catch { return 0; }
  });
  check(sketches >= 9 && sketchPx > 0, 'the dares in a briefing carry his sketches', `${sketches} sketches, sheet ${sketchPx} px wide`);
  await page.screenshot({ path: join(shots, 'ship-7-briefing.png') });

  await page.locator('[data-room="ai"]').click();
  await page.waitForTimeout(300);
  const yokePx = await page.evaluate(async () => {
    const v = getComputedStyle(document.getElementById('campaign')).getPropertyValue('--yoke');
    const u = v.slice(v.indexOf('"') + 1, v.lastIndexOf('"'));
    try { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth; } catch { return 0; }
  });
  check(await page.locator('.cp-yoke').count() === 1 && yokePx > 0, 'YOKE is in the AI core', `her sheet is ${yokePx} px wide`);
  if (await page.locator('[data-engage]').count()) {
    await page.locator('[data-engage]').first().click();
    await page.waitForSelector('.cp-talk');
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'ship-8-yoke-talk.png') });
  }
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nSHIP CHECK: ${failures.length} failure(s): ${failures.join('; ')}` : '\nSHIP CHECK: all passed.');
process.exit(failures.length ? 1 : 0);
