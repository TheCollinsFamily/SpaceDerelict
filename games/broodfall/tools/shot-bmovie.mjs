/**
 * THE FIRST-BOOT FILM AND THE REVEAL (Oct 1 2026; src/ui/bmovie.ts, tools/art/bmovie.mjs, notes/BMOVIE-SHOTLIST.md).
 * On the DEV server, in fresh browsers with nothing stored:
 *
 *   A  first launch: "THE THING FROM THE SKY" plays (its own mix in the file, titles set in type on its clock, the
 *      end card); nothing in it speaks of the ship; Esc → mission 1 with no landing film and the town's loading
 *      lines; mission 1 won → CONTINUE → the REVEAL (the ship fires the asset; "…AND YOU ARE THE ONE WHO SENT IT.")
 *      → the ship, YOKE greeting. The reveal is marked seen.
 *   B  mission 1 left and reopened (landing films on): the landing starts at the fall, no ship in it.
 *   C  ?intro=1 (the menu's and Settings' REPLAY THE OPENING): the same film again.
 *   D  Reduce motion: the reveal is its still and the card, no shot.
 *   E  a save past its first return (or from before the unfolding): the ship opens with no reveal.
 *
 *   node tools/shot-bmovie.mjs [A B C D E]     (its own dev server on BROODFALL_PORT, default 5251)
 * Screenshots: notes/screens/2026-10-01/bmovie-*.jpg. rfab.ai is mocked: nothing is spent.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const notes = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(shots, { recursive: true });
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5251);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);
const film = JSON.parse(readFileSync(join(root, 'public', 'art', 'intro', 'bmovie.json'), 'utf8'));

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `bmovie-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', join(notes, `bmovie-${name}.jpg`)]);
};
const SHIP_WORDS = /ship|empire|navy|yoke|campaign|technopuritan|orbit|asset|requisition|form xc/i;

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

async function newPlayer(browser, init = () => {}, arg = null) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => { localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted', v: 2 })); });
  await page.addInitScript(init, arg);
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors };
}
const endRun = (page, how) => page.evaluate((how) => {
  const s = window.broodfall.sim;
  s.outcome = how;
  s.events.push({ kind: how });
  window.broodfall.step(1);
}, how);
const board = (page) => page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 90000 });
/** Jump the film to `t` seconds and let a frame or two land. */
const seek = async (page, t) => {
  await page.evaluate((t) => { const v = document.querySelector('#intro video'); v.currentTime = t; }, t);
  await page.waitForFunction((t) => { const v = document.querySelector('#intro video'); return v && Math.abs(v.currentTime - t) < 1.5 && v.readyState >= 2; }, t, { timeout: 20000 });
  await page.waitForTimeout(700);
};

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  // ================================================================ A: first launch → film → mission 1 → reveal → ship
  if (want('A')) {
    console.log('A: first launch: the film, mission 1, the reveal, the ship');
    const { ctx, page, errors } = await newPlayer(browser);
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#intro.bmovie', { timeout: 15000 });
    check(true, 'the first launch opens on the B-movie, not the menu or the eight-shot opening');
    await page.waitForFunction(() => window.__bfIntroFilm === 'playing' && !document.querySelector('#intro video').paused, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    await shot(page, 'A01-town');
    const media = await page.evaluate(() => { const v = document.querySelector('#intro video'); return { muted: v.muted, w: v.videoWidth, h: v.videoHeight, audio: (v.webkitAudioDecodedByteCount ?? 0) > 0 || v.mozHasAudio || (v.audioTracks?.length ?? 0) > 0 }; });
    check(!media.muted && media.audio, `it is heard: its own mix plays (muted=${media.muted}, audio=${media.audio})`);
    check(Math.abs(media.w / media.h - 4 / 3) < 0.02, `a 4:3 picture (${media.w}x${media.h})`);
    const firstTitle = film.titles[0];
    await seek(page, firstTitle.from + 0.6);
    const tt = await page.evaluate(() => document.querySelector('#intro .intro-title.on .intro-big')?.textContent ?? '');
    check(tt === firstTitle.text, `the first title is set in type on the film's clock: "${tt}"`);
    await shot(page, 'A02-title');
    for (const [id, dt, name] of [['lookup', 2.2, 'A03-lookup'], ['impact', 1.6, 'A04-impact'], ['beam', 2.0, 'A05-beam'], ['stir', 3.4, 'A06-stir']]) {
      await seek(page, film.shots[id] + dt);
      await shot(page, name);
    }
    await seek(page, film.cardAt + 1.2);
    check(await page.evaluate(() => document.querySelector('#intro .intro-last').classList.contains('on')), 'the end card: the name, "YOU ARE THE THING THAT FELL."');
    await shot(page, 'A07-card');
    const words = await page.evaluate(() => document.getElementById('intro').innerText);
    check(!SHIP_WORDS.test(words.replace(/SKIP|BEGIN/g, '')), 'nothing in the film speaks of the ship, the empire or a campaign');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 5000 });
    check(await page.evaluate(() => localStorage.getItem('broodfall-intro-seen') === '1'), 'Esc skips it, and it is marked as seen');
    await board(page);
    check(await page.evaluate(() => window.__bfLandingWhy === 'after-opening' && !document.getElementById('landing')), 'mission 1 straight after the film: no landing film (the film was its landing)');
    const boot = await page.evaluate(() => ({ what: document.querySelector('#boot .boot-what')?.textContent ?? '', line: document.querySelector('#boot .boot-line')?.textContent ?? '' }));
    check(boot.what === 'THE TOWN' && !SHIP_WORDS.test(boot.line), `mission 1's loading screen speaks with the town's voice: "${boot.what}" / "${boot.line}"`);
    await page.waitForTimeout(1500);
    await shot(page, 'A08-mission1');
    await endRun(page, 'won');
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.locator('#debrief-ship').click();
    await page.waitForSelector('#reveal', { timeout: 10000 });
    check(true, 'CONTINUE plays the reveal before the ship');
    await page.waitForTimeout(1200);
    await shot(page, 'A09-reveal');
    await page.waitForFunction(() => document.getElementById('reveal')?.classList.contains('carded'), null, { timeout: 15000 });
    await page.waitForTimeout(1100);
    const card = await page.evaluate(() => document.querySelector('#reveal .rv-card').innerText);
    check(/ONE WHO SENT IT/.test(card), `its card: "${card}"`);
    await shot(page, 'A10-reveal-card');
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('reveal'), null, { timeout: 3000 }).catch(() => {});
    check(await page.evaluate(() => !document.getElementById('reveal') && localStorage.getItem('broodfall-reveal-seen') === '1'), 'then the ship, and the reveal is marked seen');
    await page.waitForTimeout(1500);
    await shot(page, 'A11-ship');
    // A reload on the ship does not play it again.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 30000 });
    check(await page.evaluate(() => !document.getElementById('reveal')), 'reopened aboard: no second reveal');
    check(!errors.length, `no page errors (${errors.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }

  // ================================================================ B: mission 1 reopened: the landing without the ship
  if (want('B')) {
    console.log('B: mission 1 left and reopened: the landing starts at the fall');
    const { ctx, page, errors } = await newPlayer(browser, () => { localStorage.setItem('broodfall-landing', 'on'); });
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#intro.bmovie', { timeout: 15000 });
    await page.keyboard.press('Escape');
    await board(page);
    // Reopen the bare page: mission 1 is still pending, so it is gone straight back into, with its landing.
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#landing', { timeout: 20000 });
    await page.waitForFunction(() => window.__bfLanding?.phase === 'playing', null, { timeout: 30000 });
    const l = await page.evaluate(() => ({ from: window.__bfLanding.fromFall, t: document.querySelector('#landing video')?.currentTime ?? -1, poster: document.querySelector('#landing video')?.poster ?? '' }));
    check(l.from && l.t > 1.85, `it starts at the fall, past the release (t=${l.t.toFixed(2)})`);
    check(!/-start\.webp/.test(l.poster), 'and never shows the release shot as its poster');
    await page.waitForTimeout(300);
    await shot(page, 'B01-landing-from-fall');
    check(!errors.length, `no page errors (${errors.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }

  // ================================================================ C: replay
  if (want('C')) {
    console.log('C: REPLAY THE OPENING (?intro=1) plays the B-movie');
    const { ctx, page } = await newPlayer(browser, () => { localStorage.setItem('broodfall-intro-seen', '1'); });
    await page.goto(`${URL0}?intro=1`, { waitUntil: 'load', timeout: 180000 });
    try { await page.waitForSelector('#intro.bmovie', { timeout: 30000 }); } catch (e) { await shot(page, 'C00-debug'); console.log(await page.evaluate(() => ({ intro: !!document.getElementById('intro'), cls: document.getElementById('intro')?.className, why: window.__bfIntroFilm, err: window.__bfErr }))); throw e; }
    check(true, 'replayed, it is the B-movie');
    await page.mouse.click(800, 450);
    await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 5000 });
    check(true, 'a click skips it');
    await ctx.close();
  }

  // ================================================================ D, E: the reveal's other doors
  const aboardAfterMission1 = async (deployments, reduceMotion) => {
    const { ctx, page, errors } = await newPlayer(browser, (reduceMotion) => {
      if (reduceMotion && !localStorage.getItem('broodfall-settings')) localStorage.setItem('broodfall-settings', JSON.stringify({ reduceMotion: true }));
    }, reduceMotion);
    // A campaign whose mission 1 is over: made by the game itself (first launch, film skipped, mission 1 won, no CONTINUE).
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#intro', { timeout: 15000 });
    await page.keyboard.press('Escape');
    await board(page);
    await endRun(page, 'won');
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 10000 });
    await page.evaluate((n) => { const k = 'broodfall-campaign'; const s = JSON.parse(localStorage.getItem(k)); s.deployments = n; localStorage.setItem(k, JSON.stringify(s)); }, deployments);
    await page.goto(`${URL0}?campaign=ship`, { waitUntil: 'load', timeout: 180000 });
    return { ctx, page, errors };
  };
  if (want('D')) {
    console.log('D: Reduce motion: the reveal is a still and its card');
    const { ctx, page } = await aboardAfterMission1(1, true);
    await page.waitForSelector('#reveal.gentle', { timeout: 20000 });
    check(await page.evaluate(() => !document.querySelector('#reveal video')?.currentSrc), 'no shot plays, only its still');
    await page.waitForFunction(() => document.getElementById('reveal')?.classList.contains('carded'), null, { timeout: 10000 });
    await page.waitForTimeout(1100);
    await shot(page, 'D01-reveal-reduced');
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
    check(true, 'then the ship');
    await ctx.close();
  }
  if (want('E')) {
    console.log('E: a save past its first return: no reveal');
    const { ctx, page } = await aboardAfterMission1(3, false);
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 30000 });
    check(await page.evaluate(() => !document.getElementById('reveal')), 'the ship opens with no reveal');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
