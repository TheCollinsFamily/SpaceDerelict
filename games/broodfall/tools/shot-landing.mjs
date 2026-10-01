/**
 * THE LANDING FILMS in the real game (Oct 1 2026; src/ui/landing.ts, art tools/art/landing.mjs).
 *
 * The DEV server (what `npm start` runs) on a port of its own, a GPU browser. Under automation the film plays only
 * with localStorage['broodfall-landing']='on' (every other beat skips it); this beat sets it.
 *
 *   A  a skirmish on each of suburb, megacity, orthodox (the Temple Cities), wetland, started from the address:
 *      the film plays to its end (the roar and the strike on the game's own clock), the board takes over, the run's
 *      clock starts only then, all the board's art loaded, no fault and no "did not load" notice. Each is RECORDED:
 *      notes/screens/2026-09-30/landing-<set>.mp4 (the film → the board), and a picture mid-fall and after the cut.
 *   B  the campaign: a first launch (the opening film, Esc) goes into mission 1 WITHOUT a landing (the opening is its
 *      landing); the page opened again (mission 1 still pending) lands on the crash site (suburb) first.
 *   C  a skirmish from the menu's deploy button: the film, skipped with Esc, the board at once.
 *   D  Settings: "never" plays none; "first time per tile set" plays once then not; Reduce motion the gentle version.
 *
 * Usage: node tools/shot-landing.mjs [A B C D]
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const OUT = join(root, 'notes', 'screens', '2026-09-30');
const VID = join(here, 'screenshots', 'landing-video');
fs.mkdirSync(VID, { recursive: true });
const PORT = Number(process.env.LANDING_PORT || 5319);
const want = new Set(process.argv.slice(2).filter((a) => /^[A-D]$/.test(a)));
const run = (b) => !want.size || want.has(b);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch { /* gone */ }
    }
  } catch { /* ok */ }
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'],
    { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

const URL0 = `http://localhost:${PORT}/`;
const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const VIEW = { width: 1280, height: 720 };

/** A fresh browser with the landing film on (and the rest of a returning player's state). */
async function fresh({ record = false, extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, ...(record ? { recordVideo: { dir: VID, size: VIEW } } : {}) });
  await ctx.addInitScript((kv) => {
    if (sessionStorage.getItem('bf-beat-init')) return;
    sessionStorage.setItem('bf-beat-init', '1');
    localStorage.setItem('broodfall-landing', 'on');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, extra);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|rfab-api|ERR_CONNECTION|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
const landing = (page) => page.evaluate(() => ({ ...(window.__bfLanding ?? {}), why: window.__bfLandingWhy ?? null, el: !!document.getElementById('landing') }));
const simTime = (page) => page.evaluate(() => window.broodfall?.sim?.time ?? -1);
const notices = (page) => page.evaluate(() => ({
  artNotice: !document.getElementById('art-notice')?.classList.contains('hidden') && (document.getElementById('art-notice')?.textContent ?? '').trim(),
  fault: !document.getElementById('fault')?.classList.contains('hidden'),
  missing: window.broodfall?.artMissing?.() ?? ['no api'],
}));

/** Wait for a phase of the film (or its absence), polling. */
async function until(page, f, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(f).catch(() => false)) return true; await page.waitForTimeout(100); }
  return false;
}

try {
  if (run('A')) {
    console.log('A  a skirmish on each of four tile sets, the film played through, recorded');
    for (const set of (process.env.LANDING_SETS || 'suburb,megacity,orthodox,wetland').split(',')) {
      const { ctx, page, errors } = await fresh({ record: true });
      await page.goto(`${URL0}?seed=11&autostart=1&biome=${set}`, { waitUntil: 'load' });
      const shown = await until(page, () => !!document.getElementById('landing'), 15000);
      check(shown, `${set}: the landing film is up before the run`);
      const playing = await until(page, () => window.__bfLanding?.phase === 'playing', 20000);
      check(playing, `${set}: it plays`);
      // Mid-fall: the run's clock must not be going yet.
      await until(page, () => (document.querySelector('#landing video')?.currentTime ?? 0) > 2.6, 15000);
      await page.screenshot({ path: join(OUT, `landing-${set}-fall.jpg`), type: 'jpeg', quality: 85 });
      const t1 = await simTime(page);
      await page.waitForTimeout(500);
      const t2 = await simTime(page);
      check(t2 <= 0, `${set}: the run's clock waits while the film plays`, `sim time ${t1} → ${t2}`);
      const over = await until(page, () => window.__bfLanding?.phase === 'done', 30000);
      const st = await landing(page);
      check(over && st.how === 'ended' && st.roar && st.strike, `${set}: it played to its end with the roar and the strike`, JSON.stringify(st));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(OUT, `landing-${set}-board.jpg`), type: 'jpeg', quality: 85 });
      const t3 = await simTime(page);
      await page.waitForTimeout(800);
      check(await simTime(page) > t3, `${set}: then the run's clock goes`);
      const n = await notices(page);
      const drawn = await page.evaluate(() => window.broodfall.biome());
      check(drawn === set && !n.artNotice && !n.fault && n.missing.length === 0, `${set}: the board drawn with ${set}, all its art, no notice`, JSON.stringify({ drawn, ...n }));
      check(errors.length === 0, `${set}: no page errors`, errors.slice(0, 3).join(' | '));
      const video = page.video();
      await ctx.close();
      const webm = await video.path();
      // The recording, cut to the film and the first seconds of the board.
      const mp4 = join(OUT, `landing-${set}.mp4`);
      const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', webm, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', '-movflags', '+faststart', mp4]);
      check(r.status === 0 && fs.existsSync(mp4), `${set}: recorded`, mp4);
      fs.rmSync(webm, { force: true });
    }
  }

  if (run('B')) {
    console.log('B  the campaign: mission 1 after the opening has no landing; mission 1 opened again lands on the crash site');
    const { ctx, page, errors } = await fresh();
    await page.goto(URL0, { waitUntil: 'load' });
    await page.waitForSelector('#intro', { timeout: 15000 });
    await page.keyboard.press('Escape');
    await until(page, () => window.__bfLandingWhy !== undefined && window.__bfBooted, 90000);
    const a = await landing(page);
    check(a.why === 'after-opening' && !a.el, 'after the opening film, mission 1 starts with no landing film', JSON.stringify(a));
    await page.goto(URL0, { waitUntil: 'load' });
    const shown = await until(page, () => !!document.getElementById('landing'), 15000);
    const b = await landing(page);
    check(shown && b.set === 'suburb', 'mission 1 opened again: the crash site\'s landing (the Suburbs)', JSON.stringify(b));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, 'landing-campaign-mission1.jpg'), type: 'jpeg', quality: 85 });
    await until(page, () => window.__bfLanding?.phase === 'done', 30000);
    const dir = await page.evaluate(() => window.broodfall.sim.cfg.directive);
    check(dir?.waves === 5, 'then mission 1 itself (hold 5 waves)', JSON.stringify(dir));
    check(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  if (run('C')) {
    console.log('C  the menu\'s deploy button: the film, skipped with Esc');
    const { ctx, page, errors } = await fresh({ extra: { 'broodfall-intro-seen': '1' } });
    await page.goto(URL0, { waitUntil: 'load' });
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 90000 });
    await page.locator('#menu-deploy').click();
    const playing = await until(page, () => window.__bfLanding?.phase === 'playing', 20000);
    check(playing, 'a click on deploy plays the tile set\'s landing film');
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    const t0 = Date.now();
    const done = await until(page, () => window.__bfLanding?.phase === 'done', 15000);
    const st = await landing(page);
    check(done && st.how === 'skipped' && Date.now() - t0 < 3000, 'Esc skips it to the board at once', `${Date.now() - t0} ms, ${JSON.stringify(st)}`);
    check(await page.evaluate(() => document.getElementById('settings') === null || document.getElementById('settings').classList.contains('hidden')), 'the Esc did not also open the settings');
    check(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  if (run('D')) {
    console.log('D  the setting, and Reduce motion');
    const settings = (o) => JSON.stringify({ v: 1, ...o });
    {
      const { ctx, page } = await fresh({ extra: { 'broodfall-settings': settings({ landingFilms: 'never' }) } });
      await page.goto(`${URL0}?seed=3&autostart=1&biome=farmland`, { waitUntil: 'load' });
      await until(page, () => window.__bfLandingWhy !== undefined, 20000);
      const st = await landing(page);
      check(st.why === 'setting-never' && !st.el, '"never": no film', JSON.stringify(st));
      await ctx.close();
    }
    {
      const { ctx, page } = await fresh({ extra: { 'broodfall-settings': settings({ landingFilms: 'first' }) } });
      await page.goto(`${URL0}?seed=3&autostart=1&biome=terraces`, { waitUntil: 'load' });
      await until(page, () => window.__bfLanding?.phase === 'playing', 20000);
      await page.keyboard.press('Enter');
      await until(page, () => window.__bfLanding?.phase === 'done', 15000);
      await page.goto(`${URL0}?seed=4&autostart=1&biome=terraces`, { waitUntil: 'load' });
      await until(page, () => window.__bfLandingWhy !== undefined, 20000);
      const st = await landing(page);
      check(st.why === 'seen-set', '"first time per tile set": the second time on the same set, none', JSON.stringify(st));
      await page.goto(`${URL0}?seed=4&autostart=1&biome=necropolis`, { waitUntil: 'load' });
      await until(page, () => window.__bfLandingWhy !== undefined, 20000);
      check((await landing(page)).why === 'play', '… and another set still gets its film');
      await ctx.close();
    }
    {
      const { ctx, page } = await fresh({ extra: { 'broodfall-settings': settings({ reduceMotion: true }) } });
      await page.goto(`${URL0}?seed=5&autostart=1&biome=deephive`, { waitUntil: 'load' });
      await until(page, () => !!document.getElementById('landing'), 15000);
      const st = await landing(page);
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(OUT, 'landing-reduce-motion.jpg'), type: 'jpeg', quality: 85 });
      const hasVideo = await page.evaluate(() => !!document.querySelector('#landing video'));
      const t0 = Date.now();
      const done = await until(page, () => window.__bfLanding?.phase === 'done', 15000);
      check(st.reduced && !hasVideo && done && Date.now() - t0 < 5000, 'Reduce motion: the gentle version (the last frame fades in and hands over, no film)', JSON.stringify(st));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch { /* gone */ }
  freePort();
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
