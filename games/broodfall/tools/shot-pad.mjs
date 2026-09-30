/**
 * THE DATA PAD SET DOWN at a mission's end (src/ui/padOutro.ts, tools/art/templates/pad.mjs),
 * on the DEV server (what `npm start` runs), through the player's own path:
 *
 *   won    menu → SKIRMISH (a real click) → the board plays → the run is WON (forced, as
 *          tools/shot-campaign.mjs does) → the pad: the view on its screen, pulled back, set down
 *          on his desk → the report. Recorded as a video too.
 *   lost   menu → NEW CAMPAIGN (mission 1) → LOST (forced) → the pad (the "lost" take) → mission 1's
 *          plain report → CONTINUE → the ship (the onboarding goes on as before).
 *   skip   a run won, Esc one second into the pad: the report at once, the page put back.
 *   calm   "Reduce motion" on in the settings: no pad at all, the report as before.
 *
 *   node tools/shot-pad.mjs [won lost skip calm]     (its own dev server on BROODFALL_PORT, default 5261)
 * JPEGs: notes/screens/2026-09-30/pad-*.jpg; videos: notes/screens/2026-09-30/pad-won.mp4, pad-lost.mp4.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const notes = join(root, 'notes', 'screens', '2026-09-30');
const vids = join(shots, 'pad-video');
mkdirSync(shots, { recursive: true });
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5261);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `pad-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(notes, `pad-${name}.jpg`)]);
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

const state = (page) => page.evaluate(() => ({
  pad: !!document.getElementById('pad-outro'),
  warped: /matrix3d/.test(document.body.style.transform),
  transform: document.body.style.transform,
  debrief: !document.getElementById('debrief').classList.contains('hidden') || !document.getElementById('campaign').classList.contains('hidden'),
}));

/** Force the end of the run the way the other beats do, and stamp the time it happened. */
const force = (page, outcome) => page.evaluate((o) => {
  const s = window.broodfall.sim;
  s.outcome = o;
  s.events.push({ kind: o });
  window.broodfall.step(1);
  window.__padT0 = performance.now();
}, outcome);

/** Screenshots at set times after the end (ms), each named. */
async function sequence(page, prefix, marks) {
  for (const [ms, name] of marks) {
    const now = await page.evaluate(() => performance.now() - window.__padT0);
    if (ms > now) await page.waitForTimeout(ms - now);
    await shot(page, `${prefix}-${name}`);
  }
}

async function freshPage(browser, { video = false, settings } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(video ? { recordVideo: { dir: vids, size: { width: 1280, height: 720 } } } : {}) });
  await context.addInitScript((s) => {
    if (sessionStorage.getItem('pad-beat-set')) return;
    sessionStorage.setItem('pad-beat-set', '1');
    localStorage.clear();
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-pad-outro', 'on'); // the pad plays under automation only when asked
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    if (s) localStorage.setItem('broodfall-settings', JSON.stringify(s));
  }, settings ?? null);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 200)));
  return { context, page };
}

/** Fails the beat when a picture is missing or a load notice/banner shows (fix pass, Sep 30 2026). */
async function artOk(page, name) {
  await page.waitForFunction(() => window.broodfall.artMissing().length === 0, null, { timeout: 30000 }).catch(() => {});
  const missing = await page.evaluate(() => window.broodfall.artMissing());
  const notice = await page.evaluate(() => {
    const el = document.getElementById('art-notice');
    const shown = !!el && !el.classList.contains('hidden') ? el.textContent : '';
    const banner = /did not load/i.test(document.body.innerText) ? 'a "did not load" banner' : '';
    return [shown, banner].filter(Boolean).join(' ');
  });
  check(missing.length === 0 && !notice, `${name}: all its art loaded, no notice ${[...missing, notice].filter(Boolean).join(' | ').slice(0, 200)}`);
}

async function skirmish(page) {
  await page.goto(URL0 + '?seed=3', { waitUntil: 'load' });
  await page.locator('#menu-deploy').click();
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 60000 });
  // Let the run live a while: the first wave comes, the body grows by the scripted player's hand.
  await page.evaluate(() => window.broodfall.step(900));
  await page.waitForTimeout(2500);
}

const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (want('won')) {
    console.log('won: skirmish → won → the pad → the report');
    const { context, page } = await freshPage(browser, { video: true });
    await skirmish(page);
    await artOk(page, 'won: the skirmish');
    await shot(page, 'won-0-the-last-view');
    await force(page, 'won');
    await page.waitForSelector('#pad-outro', { timeout: 8000 });
    const t = await page.evaluate(() => performance.now() - window.__padT0);
    check(t < 4000, `the pad comes up ${Math.round(t)} ms after the end (1.6 s after the win banner)`);
    const s0 = await state(page);
    check(s0.pad && s0.warped, 'the page (board + HUD) is warped into the pad\'s screen');
    await sequence(page, 'won', [[1700, '1-start'], [2300, '2-pull-back'], [3400, '3-lowering'], [4700, '4-set-down'], [6300, '5-on-the-desk']]);
    await page.waitForFunction(() => !document.getElementById('debrief').classList.contains('hidden'), null, { timeout: 12000 });
    const s1 = await state(page);
    check(s1.debrief && !s1.warped, `the report follows, the page put back (body transform "${s1.transform}")`);
    await page.waitForTimeout(1200);
    check(!(await state(page)).pad, 'the desk has faded away over the report');
    await shot(page, 'won-6-report');
    const vpath = await page.video().path();
    await context.close();
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', join(notes, 'pad-won.mp4')]);
  }

  if (want('lost')) {
    console.log('lost: NEW CAMPAIGN → mission 1 lost → the pad → the plain report → the ship');
    const { context, page } = await freshPage(browser, { video: true });
    await page.goto(URL0, { waitUntil: 'load' });
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
    await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 60000 });
    await page.evaluate(() => window.broodfall.step(600));
    await page.waitForTimeout(2500);
    await artOk(page, 'lost: mission 1');
    await shot(page, 'lost-0-the-last-view');
    await force(page, 'lost');
    await page.waitForSelector('#pad-outro', { timeout: 8000 });
    const s0 = await state(page);
    check(s0.pad && s0.warped, 'mission 1 lost: the pad comes up with the board on it');
    await sequence(page, 'lost', [[1700, '1-start'], [2600, '2-dropping'], [4200, '3-set-down'], [6300, '4-on-the-desk']]);
    await page.waitForFunction(() => !document.getElementById('debrief').classList.contains('hidden'), null, { timeout: 12000 });
    check(!(await state(page)).warped, 'mission 1\'s plain report follows');
    await page.waitForTimeout(1200);
    await shot(page, 'lost-5-report');
    await page.locator('#debrief-ship').click();
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 10000 });
    check(true, 'CONTINUE → the ship');
    await page.waitForTimeout(1500);
    await shot(page, 'lost-6-ship');
    const vpath = await page.video().path();
    await context.close();
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', join(notes, 'pad-lost.mp4')]);
  }

  if (want('skip')) {
    console.log('skip: Esc in the middle of the pad');
    const { context, page } = await freshPage(browser);
    await skirmish(page);
    await force(page, 'won');
    await page.waitForSelector('#pad-outro', { timeout: 8000 });
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    const t0 = Date.now();
    await page.waitForFunction(() => !document.getElementById('debrief').classList.contains('hidden'), null, { timeout: 5000 });
    const s = await state(page);
    check(Date.now() - t0 < 1500 && !s.warped, `Esc skips it: the report in ${Date.now() - t0} ms, the page put back`);
    check(await page.evaluate(() => !document.querySelector('#settings:not(.hidden)')), 'Esc did not also open the settings');
    await context.close();
  }

  if (want('calm')) {
    console.log('calm: reduce motion on → no pad');
    const { context, page } = await freshPage(browser, { settings: { reduceMotion: true } });
    await skirmish(page);
    await force(page, 'lost');
    await page.waitForFunction(() => !document.getElementById('debrief').classList.contains('hidden'), null, { timeout: 8000 });
    const seen = await page.evaluate(() => !!document.getElementById('pad-outro'));
    const t = await page.evaluate(() => performance.now() - window.__padT0);
    check(!seen && t < 3500, `reduce motion: the report as before (${Math.round(t)} ms), no pad`);
    await context.close();
  }
} finally {
  await browser.close();
  dev.kill();
  freePort();
  try { for (const f of readdirSync(vids)) rmSync(join(vids, f)); } catch {}
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
