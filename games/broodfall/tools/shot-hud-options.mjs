/**
 * THE HUD STYLE OPTIONS, photographed from the real game (Sep 30 2026, for Collins to pick one).
 * Every theme (src/hud/themes.ts, `?hud=<id>`) is played through the SAME moments on the same
 * seed with the same commands, so the pictures differ only in the HUD:
 *   a  mid-siege, the hand open with a card armed, one limb inspected
 *   b  the wave banner, the moment the wave is called
 *   c  the organ stage
 *   d  a close crop of the resource bar and one card
 * and one compare.jpg with every theme's (a) side by side.
 *
 * Runs the dev server on its own port (5247) with hot reload off, so another session's save
 * does not reload the page mid-scene; headless Chromium on the GPU (HANDOFF.md).
 *
 * Usage: node tools/shot-hud-options.mjs [theme ...]   (themes: current ship)
 * JPEGs: notes/screens/2026-09-30/hud-options/<theme>-<a|b|c|d>.jpg and compare.jpg
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-09-30', 'hud-options');
const tmp = join(here, 'screenshots', 'hud-options');
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5247);
const SEED = 7;
/** `current` is today's look (no ?hud), the others the options. */
const ALL = [
  { id: 'current', hud: 'classic', label: 'BEFORE — the classic khaki console (?hud=classic)' },
  { id: 'ship', hud: 'ship', label: 'NOW — the ship console (the default)' },
];
const want = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')));
const themes = ALL.filter((t) => want.size === 0 || want.has(t.id));
const failures = [];
const check = (ok, name) => { if (!ok) failures.push(name); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const jpg = (png, name) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(out, name)]);
  if (r.status !== 0) throw new Error(`ffmpeg ${name}: ${r.stderr}`);
};

function freePort() {
  try {
    const o = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of o.split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  for (const t of themes) {
    console.log(`— ${t.id}`);
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // A theme picked in the menu is remembered: start every theme from a clean slate.
    await page.addInitScript(() => { try { localStorage.removeItem('broodfall-hud'); } catch {} });
    await page.goto(`http://localhost:${PORT}/?seed=${SEED}&autostart=1&speed=0${t.hud ? `&hud=${t.hud}` : ''}`, { waitUntil: 'load' });
    await page.waitForSelector('#stage canvas', { timeout: 60000 });
    await page.waitForFunction(() => window.broodfall && window.broodfall.view() === 'iso', null, { timeout: 60000 });
    await page.waitForTimeout(2500);
    const applied = await page.evaluate(() => document.documentElement.dataset.hud || '');
    check(applied === t.hud, `theme applied (${applied})`);

    // The same board for every theme: meat, then five limbs on the first cells that take them.
    const built = await page.evaluate(() => {
      const bf = window.broodfall;
      const s = bf.sim;
      s.meat.war = 900; s.meat.science = 60; s.meat.royal = 2;
      let n = 0;
      for (let tries = 0; tries < 60 && n < 5; tries++) {
        const cells = bf.buildableCells(80);
        let ok = false;
        for (let i = 0; i < s.hand.length && !ok; i++) {
          for (const c of cells.slice(n * 7)) {
            if (s.issue({ kind: 'build', cardIndex: i, cell: c }).ok) { ok = true; n++; break; }
          }
        }
        if (!ok) s.issue({ kind: 'discard', cardIndex: 0 });
      }
      s.meat.war = 140; s.meat.science = 24; s.meat.royal = 1;
      bf.step(2);
      return s.towers.map((x) => x.family);
    });
    check(built.length >= 3, `limbs built (${built.join(', ')})`);
    await page.evaluate(() => window.broodfall.turnBy(0));
    await page.waitForTimeout(600);

    // (c) The organ stage, between waves.
    await page.locator('#open-under').click();
    await page.waitForTimeout(1600);
    // Arm one organ from the palette so the tray shows a pick.
    const pal = page.locator('#under-palette .under-organ:not(.locked)').first();
    if (await pal.count()) { await pal.click(); await page.waitForTimeout(200); }
    const grid = page.locator('#under-grid .uc').nth(40);
    if (await grid.count()) { await grid.hover(); await page.waitForTimeout(200); }
    await page.screenshot({ path: join(tmp, `${t.id}-c.png`), scale: 'css' });
    jpg(join(tmp, `${t.id}-c.png`), `${t.id}-c.jpg`);
    await page.locator('#under-done').click();
    await page.waitForTimeout(500);

    // (b) The wave banner: call the wave early.
    await page.locator('#call-early').click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(tmp, `${t.id}-b.png`), scale: 'css' });
    jpg(join(tmp, `${t.id}-b.png`), `${t.id}-b.jpg`);
    check(!(await page.locator('#banner').evaluate((e) => e.classList.contains('hidden'))), 'the banner shows');

    // (a) Mid-siege: the specimens in the streets, a limb inspected, a card armed.
    // Step until the streets are busiest, never past the wave's end (the organ stage would open).
    const siege = await page.evaluate(() => {
      const bf = window.broodfall;
      const s = bf.sim;
      let best = 0;
      for (let i = 0; i < 80 && s.phase === 'siege'; i++) {
        bf.step(5);
        best = Math.max(best, s.enemies.length);
        const feed = document.querySelectorAll('#feed .feed-item').length;
        if (feed >= 5 && s.enemies.length >= 3) break;
      }
      return { phase: s.phase, enemies: s.enemies.length, t: s.time.toFixed(0) };
    });
    check(siege.phase === 'siege' && siege.enemies > 0, `mid-siege (${JSON.stringify(siege)})`);
    await page.waitForTimeout(3000); // the banner has gone
    const box = await page.locator('#stage canvas').boundingBox();
    const pos = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const tw = s.towers[1] ?? s.towers[0];
      return window.broodfall.worldToScreen(tw.pos.x, tw.pos.y);
    });
    await page.mouse.click(box.x + (pos.x / pos.vw) * box.width, box.y + (pos.y / pos.vh) * box.height);
    await page.waitForTimeout(700);
    check(await page.locator('#inspect').evaluate((e) => !e.classList.contains('hidden')), 'a limb is inspected');
    await page.locator('#hand .card').nth(2).click();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.55);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(tmp, `${t.id}-a.png`), scale: 'css' });
    jpg(join(tmp, `${t.id}-a.png`), `${t.id}-a.jpg`);

    // (d) Close: the resource bar and one card, stacked.
    const top = await page.locator('#topbar').boundingBox();
    await page.screenshot({ path: join(tmp, `${t.id}-d1.png`), clip: { x: 0, y: top.y, width: 1100, height: top.height } });
    const card = page.locator('#hand .card').nth(0);
    await card.screenshot({ path: join(tmp, `${t.id}-d2.png`) });
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', join(tmp, `${t.id}-d1.png`), '-i', join(tmp, `${t.id}-d2.png`),
      '-filter_complex', '[0:v]scale=2200:-1:flags=lanczos[t];[1:v]pad=2200:ih+40:20:20:color=0x111111[c];[t][c]vstack', '-q:v', '3', join(out, `${t.id}-d.jpg`)]);
    check(r.status === 0, `close crop (${String(r.stderr || '').slice(0, 120)})`);

    check(errors.length === 0, errors.length ? `page errors: ${errors.join(' | ').slice(0, 300)}` : 'no page errors');
    await page.close();
  }

  // compare.jpg: every theme's (a), with its name, in one picture.
  const cells = ALL.filter((t) => existsSync(join(out, `${t.id}-a.jpg`)));
  const html = `<!doctype html><html><body style="margin:0;background:#111;color:#eee;font:bold 22px Arial;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;width:1900px">${
    cells.map((t) => `<div><div style="padding:4px 2px 6px">${t.label}</div><img style="width:100%;display:block" src="data:image/jpeg;base64,${readFileSync(join(out, `${t.id}-a.jpg`)).toString('base64')}"></div>`).join('')
  }</body></html>`;
  const f = join(tmp, 'compare.html');
  writeFileSync(f, html);
  const page = await browser.newPage({ viewport: { width: 1920, height: 800 } });
  await page.goto(pathToFileURL(f).href);
  await page.screenshot({ path: join(tmp, 'compare.png'), fullPage: true });
  jpg(join(tmp, 'compare.png'), 'compare.jpg');
  console.log(`  wrote ${join(out, 'compare.jpg')}`);
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
console.log(failures.length ? `HUD OPTIONS: ${failures.length} failed` : 'HUD OPTIONS: all shot.');
process.exit(failures.length ? 1 : 0);
