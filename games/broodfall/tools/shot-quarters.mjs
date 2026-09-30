/**
 * HIS QUARTERS AND THE PARTNER'S PORTRAIT, in the real page (Sep 30 2026, HANDOFF OPEN 9).
 *
 * The DEV server on its own port (5297), a campaign whose desk is open (`?campaign=ship&open=1`) and
 * whose mate review has been heard (so the data pad holds the candidate's file), YOKE scripted. The
 * Quarters room is opened by a click; the beat fails when artMissing() is not empty, a "did not load"
 * notice shows, the room has no picture of its own (it fell back to the Procreation Board's), or the
 * pad has no photograph.
 *
 * Usage: node tools/shot-quarters.mjs [--tag before|after] [--lenient]   (--lenient: report, do not fail on
 * the missing pictures, for a "before")
 * Pictures: notes/screens/2026-09-30/fixpass-art-quarters-<tag>.jpg, fixpass-art-partner-<tag>.jpg.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5297);
const args = process.argv.slice(2);
const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : 'after';
const lenient = args.includes('--lenient');
const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };

function startDev() {
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT) },
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}
const kill = (child) => { try { if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); else child.kill(); } catch { /* gone */ } };

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
  });
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  const base = `http://localhost:${PORT}/`;
  await page.goto(`${base}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#campaign:not(.hidden) .cp-room', { timeout: 60000 });
  // The mate review heard: the pad holds her file.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.said = [...new Set([...(s.said ?? []), 'mate-review'])];
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
  });
  await page.goto(`${base}?campaign=ship`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#campaign:not(.hidden) [data-room="quarters"]', { timeout: 60000 });
  // Let a greeting finish or skip it.
  await page.waitForTimeout(1500);
  await page.locator('[data-room="quarters"]').first().click({ force: true });
  await page.waitForSelector('.cp-quarters', { timeout: 15000 });
  await page.waitForTimeout(2500);
  // The photograph may still be on its way (a re-render makes a new <img>): give it a few seconds.
  await page.waitForFunction(() => { const i = document.querySelector('.cp-pad-pic'); return !i || (i.complete && i.naturalWidth > 0); }, null, { timeout: 8000 }).catch(() => {});
  const room = await page.evaluate(() => getComputedStyle(document.getElementById('campaign')).getPropertyValue('--room') || document.getElementById('campaign').style.getPropertyValue('--room'));
  const pic = await page.evaluate(() => { const i = document.querySelector('.cp-pad-pic'); return i ? { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 } : null; });
  const missing = await page.evaluate(() => window.broodfall?.artMissing?.() ?? []);
  const banner = await page.evaluate(() => /did not load/i.test(document.body.innerText));
  check(!missing.length, `artMissing() is empty (${JSON.stringify(missing).slice(0, 200)})`);
  check(!banner, 'no "did not load" notice');
  const own = /intro\/quarters\.webp/.test(room);
  const has = !!pic?.ok && /intro\/partner\.webp/.test(pic.src);
  if (lenient) console.log(`BEFORE: room picture ${room.slice(0, 120)}; pad photograph ${JSON.stringify(pic)}`);
  else {
    check(own, `the quarters have their own picture (${room.slice(0, 120)})`);
    check(has, `the pad shows the candidate's photograph (${JSON.stringify(pic)})`);
  }
  check(!errors.length, `no page errors (${errors.join(' | ').slice(0, 300)})`);
  await page.screenshot({ path: join(screens, `fixpass-art-quarters-${tag}.jpg`), type: 'jpeg', quality: 85 });
  const padBox = await page.locator('.cp-pad').first().boundingBox();
  if (padBox) {
    await page.screenshot({ path: join(screens, `fixpass-art-partner-${tag}.jpg`), type: 'jpeg', quality: 90,
      clip: { x: Math.max(0, padBox.x - 10), y: Math.max(0, padBox.y - 10), width: Math.min(900, padBox.width + 20), height: Math.min(700, padBox.height + 20) } });
  }
} finally {
  await browser.close();
  kill(server);
}
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nall passed');
