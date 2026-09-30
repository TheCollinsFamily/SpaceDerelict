/**
 * THE PLAYER'S PATH: the game started the way Collins starts it (`npm start`, the DEV
 * server, not the built one), the menu as it opens, a click on the deploy button, and play.
 * Every other beat runs against the built game; this one is the check that what he
 * double-clicks is the game those beats tested.
 *
 * It plays three skirmishes with no seed given, as a player would, so that three tile sets
 * chosen by chance are seen from the menu.
 *
 * Usage: node tools/shot-player-path.mjs
 * Artifacts: tools/screenshots/player-path-menu.png, player-path-<n>-<tile set>.png
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
const PORT = Number(process.env.BROODFALL_PORT || 5199) - 11;
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startDev() {
  freePort();
  // What `npm start` runs, without opening a window of its own.
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const seen = new Set();
  for (let run = 1; run <= 3; run++) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    // The very first launch (Sep 30 2026, src/meta/onboarding.ts): the film, then mission 1 — no menu.
    if (run === 1) {
      await page.waitForSelector('#intro', { timeout: 15000 }).catch(() => {});
      check(await page.locator('#intro').count() === 1, 'the first launch plays the opening film');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.broodfall !== undefined && window.__bfBooted, null, { timeout: 60000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(shots, 'player-path-first-launch.png') });
      check(await page.evaluate(() => document.getElementById('menu').classList.contains('hidden') && window.broodfall.sim.cfg.directive?.waves === 5),
        'then straight into mission 1 (hold 5 waves), no menu');
    }
    // From here on a returning player: the ship's console menu (their campaign aside, for a skirmish).
    await page.evaluate(() => {
      localStorage.removeItem('broodfall-campaign'); localStorage.removeItem('broodfall-campaign-pending');
      localStorage.setItem('broodfall-intro-seen', '1');
    });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 60000 });
    if (run === 1) {
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(shots, 'player-path-menu.png') });
      check(await page.locator('#menu-deploy').isVisible(), 'the menu opens with its deploy button');
    }
    await page.locator('#menu-deploy').click();
    await page.waitForTimeout(600);
    const menuGone = await page.evaluate(() => document.getElementById('menu')?.classList.contains('hidden') ?? true);
    check(menuGone, `run ${run}: a click on deploy starts the deployment`);
    const drawn = await page.evaluate(() => ({ view: window.broodfall.view(), biome: window.broodfall.biome(), missing: window.broodfall.artMissing() }));
    seen.add(drawn.biome);
    check(drawn.view === 'iso' && drawn.biome !== '', `run ${run}: the board is drawn with a tile set`, `${drawn.view}, ${drawn.biome}`);
    check(drawn.missing.length === 0, `run ${run}: all the art loads`, drawn.missing.join(', '));
    // Play: real time for a few seconds, then on into the first wave.
    await page.waitForTimeout(3000);
    const before = await page.evaluate(() => window.broodfall.summary());
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => window.broodfall.step(20));
      if (await page.evaluate(() => window.broodfall.summary().enemies) >= 4) break;
    }
    const after = await page.evaluate(() => window.broodfall.summary());
    check(after.enemies > 0 || after.wave > before.wave, `run ${run}: the first wave arrives`, `wave ${after.wave}, ${after.enemies} units`);
    await page.waitForTimeout(400);
    await page.locator('#stage canvas').screenshot({ path: join(shots, `player-path-${run}-${drawn.biome}.png`) });
    check(errors.length === 0, `run ${run}: nothing is logged as an error`, errors.slice(0, 3).join(' | '));
    await page.close();
  }
  console.log(`  tile sets seen from the menu: ${[...seen].join(', ')}`);
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `PLAYER PATH: ${failures.length} check(s) FAILED: ${failures.join('; ')}` : 'PLAYER PATH: all passed.');
process.exit(failures.length ? 1 : 0);
