/**
 * YOKE PRINTS HERSELF A BODY, as a player meets it (Oct 26 2026): on the DEV server (what `npm start` runs), a fresh
 * player loses mission 1, comes aboard, opens the intercom (◉ YOKE) and types "print yourself a body". The four clips
 * play (public/art/ship/yoke/scenes/print-body-*.webm), then her line comes up over the last one.
 *
 *   SFW  (Settings → Content, the default): the blurred patch is over her chest on every clip.
 *   UNRESTRICTED: the same film with no patch.
 *
 * Her mind is scripted (nothing is sent to rfab.ai, nothing is spent); the print-body trigger is the game's own.
 *
 *   node tools/shot-print-body.mjs            (its own dev server on BROODFALL_PORT, default 5262)
 * Screenshots: tools/screenshots/print-body-*.png, JPEG copies in notes/screens/2026-10-26/.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const notes = join(root, 'notes', 'screens', '2026-10-26');
mkdirSync(shots, { recursive: true });
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5262);
const URL0 = `http://localhost:${PORT}/`;

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `print-body-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', join(notes, `print-body-${name}.jpg`)]);
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
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT) },
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

/** A first launch with her mind scripted and the given content setting; nothing reaches rfab.ai. */
async function newPlayer(browser, content) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|rfab-api/.test(m.text())) errors.push(m.text()); });
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((content) => {
    if (localStorage.getItem('broodfall-yoke')) return;
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted', muted: true, v: 2 }));
    localStorage.setItem('broodfall-settings', JSON.stringify({ v: 1, content }));
  }, content);
  await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
  // A first launch opens on the film; Esc skips it, straight into mission 1.
  await page.waitForSelector('#intro', { timeout: 15000 });
  await page.waitForFunction(() => window.__bfIntroFilm === 'playing', null, { timeout: 30000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 5000 });
  return { ctx, page, errors };
}

const endRun = (page, how) => page.evaluate((how) => {
  const s = window.broodfall.sim;
  s.outcome = how;
  s.events.push({ kind: how });
  window.broodfall.step(1);
}, how);

/** The patch as drawn: on screen, and what it covers in fractions of the picture's own frame (cover-fit). */
const patch = (page) => page.evaluate(() => {
  const b = document.querySelector('#yoke-scene .ys-blur');
  const v = document.querySelector('#yoke-scene video');
  if (!b || !v) return { shown: false, t: v?.currentTime ?? null };
  const r = b.getBoundingClientRect();
  return { shown: getComputedStyle(b).display !== 'none' && r.width > 10, t: v.currentTime, x: r.x, y: r.y, w: r.width, h: r.height };
});

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  for (const content of ['sfw', 'unrestricted']) {
    console.log(`${content.toUpperCase()}: lose mission 1, aboard, ◉ YOKE, "print yourself a body"`);
    const { ctx, page, errors } = await newPlayer(browser, content);
    await page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 120000 });
    await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('hidden'), null, { timeout: 90000 });
    await endRun(page, 'lost');
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.locator('#debrief-ship').click();
    await page.waitForTimeout(4000);
    await shot(page, `${content}-aboard`);
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 30000 });
    // Her greeting and the boss's message, to their end (each skippable by a click; let them play).
    await page.waitForSelector('.cp-icom:not(.greeting)', { timeout: 180000 });
    await page.waitForFunction(() => !document.getElementById('boss-call'), null, { timeout: 120000 });
    if (!(await page.locator('#icom-input').count())) await page.locator('[data-act="yoke-call"]').first().click();
    await page.waitForSelector('#icom-input', { timeout: 10000 });
    await page.locator('#icom-input').fill('print yourself a body');
    await page.locator('[data-act="icom-send"]').click();
    await page.waitForSelector('#yoke-scene video', { timeout: 10000 });
    check(await page.evaluate(() => document.getElementById('yoke-scene').dataset.placeholder !== '1'), 'the real clips play, not storyboard cards');
    const seen = [];
    for (const [stage, at] of [['print', 3.5], ['wake', 3], ['collapse', 4.5], ['hold', 1.5]]) {
      await page.waitForFunction(([stage, at]) => document.getElementById('yoke-scene')?.dataset.stage && (document.querySelector('#yoke-scene video')?.src ?? '').includes(`print-body-${stage}`) && document.querySelector('#yoke-scene video').currentTime >= at, [stage, at], { timeout: 30000 });
      const p = await patch(page);
      seen.push(p.shown);
      await shot(page, `${content}-${stage}`);
      console.log(`    ${stage} at ${p.t?.toFixed(2)}s: ${p.shown ? `patch ${Math.round(p.w)}x${Math.round(p.h)} at ${Math.round(p.x)},${Math.round(p.y)}` : 'no patch'}`);
    }
    if (content === 'sfw') check(seen.every(Boolean), 'SFW: the blurred patch is over her on all four clips');
    else check(seen.every((s) => !s), 'UNRESTRICTED: no patch on any clip');
    await page.waitForFunction(() => document.querySelector('#yoke-scene .ys-sub.on'), null, { timeout: 30000 });
    const line = await page.locator('#yoke-scene .ys-sub').innerText();
    check(/gross/i.test(line), `her line over the last shot: "${line.slice(0, 70)}"`);
    await shot(page, `${content}-line`);
    check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  freePort();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
