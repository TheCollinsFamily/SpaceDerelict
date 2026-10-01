/**
 * EVERY WAIT SHOWS A LOOP (Oct 1 2026; notes/LOADING-AUDIT.md, src/ui/loader.ts). Collins: "we had a loading screen
 * here without a looping animation ... that should never happen."
 *
 * The game on its DEV server (what `npm start` runs), on a SLOW network: every file under art/ and media/ is held
 * back as a slow link would (a latency, then its bytes at ~1 MB/s; the loaders' own small loops excepted, as
 * index.html preloads them), so that every wait is long enough to be seen. A watcher in the page samples the screen
 * every 100 ms; the beat FAILS when a wait is on the screen for more than 400 ms without a loop that moves:
 *   - the loading screen (#boot), or any cover/panel marked `data-loading`, whose loops are not playing;
 *   - the ship drawn bare (no ship art yet) with no loader over it;
 *   - YOKE's stage up with no picture of her and no stand-in loop;
 *   - a film (#newsreel, #intro) black (no shot up, no card) with no loader.
 * And a loop must really move: two pictures of it 300 ms apart must differ.
 *
 *   node tools/shot-loading.mjs [first pad reel yoke organ calm fast]   (own dev server on BROODFALL_PORT, default 5271)
 * Out: notes/screens/2026-09-30/loading-*.mp4 and loading-*.jpg.
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
const vids = join(shots, 'loading-video');
mkdirSync(shots, { recursive: true });
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5271);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `loading-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(notes, `loading-${name}.jpg`)]);
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

/** The slow link: art/ and media/ files held back (latency + bytes at `bps`); the loaders' own files are not. */
async function slowNetwork(context, { bps = 1_000_000, latency = 250, hold = {} } = {}) {
  await context.route(/\/(art|media)\//, async (route) => {
    const url = route.request().url();
    if (/\/art\/loaders\//.test(url)) return route.continue();
    let res, body;
    try { res = await route.fetch(); body = await res.body(); } catch { try { await route.abort(); } catch { /* closed */ } return; }
    let ms = latency + (body.length / bps) * 1000;
    for (const [pat, extra] of Object.entries(hold)) if (url.includes(pat)) ms += extra;
    await new Promise((r) => setTimeout(r, ms));
    try { await route.fulfill({ response: res, body }); } catch { /* the page went on without it */ }
  });
  // YOKE's mind and voice are never asked (no spending in a beat).
  await context.route(/\/rfab-api\//, (r) => r.abort());
}

/** The watcher: what the screen shows every 100 ms. */
const WATCH = () => {
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.2) return false;
    }
    return true;
  };
  const moving = (box) => [...box.querySelectorAll('.bf-loop')].some((l) => {
    const v = l.querySelector('video.bf-loop-full');
    if (v && !v.paused && v.readyState >= 2) return true;
    const img = l.querySelector('img.bf-loop-mini');
    return !!img && img.complete && img.naturalWidth > 0 && vis(img);
  });
  window.__bfWatch = [];
  window.setInterval(() => {
    const t = Math.round(performance.now());
    const bad = [];
    const seen = [];
    const boot = document.getElementById('boot');
    if (vis(boot)) { seen.push('boot'); if (!boot.dataset.loading || !moving(boot)) bad.push('the loading screen without a moving loop'); }
    for (const el of document.querySelectorAll('[data-loading]')) {
      if (el === boot || !vis(el)) continue;
      seen.push(`${el.className.split(' ')[0] || el.id}:${el.dataset.loading}`);
      if (!moving(el)) bad.push(`a wait (${el.className.split(' ')[0]}) without a moving loop`);
    }
    const loaderUp = [...document.querySelectorAll('.bf-loader')].some(vis);
    const camp = document.getElementById('campaign');
    if (vis(camp) && !camp.classList.contains('ship-art') && !camp.classList.contains('awaiting-art') && !loaderUp) bad.push('the ship drawn bare, no loader over it');
    for (const st of document.querySelectorAll('.cp-yoke-live')) {
      if (!vis(st)) continue;
      const on = st.querySelector('video.on');
      if (!on && !st.querySelector('.cp-yoke-wait')) bad.push('YOKE\'s stage empty, no stand-in loop');
    }
    for (const id of ['newsreel', 'intro']) {
      const f = document.getElementById(id);
      if (!vis(f) || f.classList.contains('leaving')) continue;
      const shotUp = [...f.querySelectorAll('video')].some((v) => v.classList.contains('on') && v.readyState >= 2);
      const card = [...f.querySelectorAll('.nr-card.on, .np-sheet, .intro-begin, .intro-last')].some(vis);
      if (!shotUp && !card && !loaderUp && !f.classList.contains('begin')) bad.push(`the ${id} black, no loader`);
    }
    window.__bfWatch.push({ t, bad, seen });
  }, 100);
};

/** Fails when a bad state lasted over 400 ms (the threshold under which a wait shows nothing). */
/** The watcher's samples of a page about to be left (a navigation starts a new page, and a new watch). */
let earlier = [];
async function harvest(page) { earlier.push(...(await page.evaluate(() => window.__bfWatch ?? []).catch(() => [])), { t: -1, bad: [], seen: [] }); }

async function verdict(page, name) {
  const log = [...earlier, ...(await page.evaluate(() => window.__bfWatch ?? []))];
  earlier = [];
  const runs = {};
  const worst = {};
  const at = {};
  for (const s of log) {
    for (const b of s.bad) { runs[b] = (runs[b] ?? 0) + 1; if (runs[b] > (worst[b] ?? 0)) { worst[b] = runs[b]; at[b] = s.t; } }
    for (const k of Object.keys(runs)) if (!s.bad.includes(k)) runs[k] = 0;
  }
  const over = Object.entries(worst).filter(([, n]) => n * 100 > 400);
  const kinds = [...new Set(log.flatMap((s) => s.seen))];
  check(!over.length, `${name}: every wait on the screen had a moving loop (waits seen: ${kinds.join(', ') || 'none'})${over.length ? ` — ${over.map(([b, n]) => `${b} for ${n * 100} ms (ending at ${at[b]} ms into its page)`).join('; ')}` : ''}`);
  return kinds;
}

/** A loop really moves: two pictures of it 300 ms apart differ. */
async function moves(page, selector, name) {
  const el = page.locator(selector).first();
  if (!(await el.count())) { check(false, `${name}: ${selector} is on the screen`); return; }
  // The page's own pixels in the loop's box (an element screenshot waits for it to stop moving, which a loop never does).
  const box = await el.boundingBox({ timeout: 1500 }).catch(() => null);
  // Gone already: the wait ended before it could be measured (the watcher still judged it while it was up).
  if (!box) { console.log(`  note  ${name}: the wait ended before its loop could be measured`); return; }
  const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(4, Math.min(box.width, 1280 - box.x)), height: Math.max(4, Math.min(box.height, 720 - box.y)) };
  const a = await page.screenshot({ clip });
  await page.waitForTimeout(300);
  const b = await page.screenshot({ clip });
  check(!a.equals(b), `${name}: the loop (${selector}) moves (two pictures 300 ms apart differ)`);
}

async function freshPage(browser, { video = true, settings, pin, slow = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(video ? { recordVideo: { dir: vids, size: { width: 1280, height: 720 } } } : {}) });
  await context.addInitScript(({ s, pin }) => {
    if (!sessionStorage.getItem('loading-beat-set')) {
      sessionStorage.setItem('loading-beat-set', '1');
      localStorage.clear();
      localStorage.setItem('broodfall-intro-seen', '1');
      localStorage.setItem('broodfall-pad-outro', 'on');
      localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
      if (s) localStorage.setItem('broodfall-settings', JSON.stringify(s));
      if (pin) localStorage.setItem('broodfall-loader', pin);
    }
  }, { s: settings ?? null, pin: pin ?? null });
  await context.addInitScript(WATCH);
  if (slow) await slowNetwork(context, slow);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 200)));
  return { context, page };
}

async function saveVideo(page, context, name) {
  const vpath = await page.video().path();
  await context.close();
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', join(notes, `loading-${name}.mp4`)]);
}

const booted = (page, ms = 120000) => page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: ms });
const bootGone = (page) => page.waitForFunction(() => document.getElementById('boot').classList.contains('hidden'), null, { timeout: 120000 });

const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (want('first')) {
    console.log('first: a page that starts a deployment, on a slow link');
    const { context, page } = await freshPage(browser);
    await page.goto(URL0 + '?autostart=1&seed=3', { waitUntil: 'commit' });
    await page.waitForTimeout(250);
    await shot(page, 'first-1-at-once');
    await page.waitForTimeout(1500);
    await shot(page, 'first-2-emblem-burning');
    await moves(page, '#boot .logo-emblem', 'first load');
    await page.waitForFunction(() => /FILES/.test(document.querySelector('.boot-count')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
    await shot(page, 'first-3-progress');
    await booted(page);
    await bootGone(page);
    await page.waitForTimeout(800);
    await shot(page, 'first-4-board');
    await verdict(page, 'first load');
    await saveVideo(page, context, 'first');
  }

  if (want('pad')) {
    console.log('pad: menu → NEW CAMPAIGN → mission 1 lost → the pad → report → the ship (YOKE dancing) → DEPLOY → the next board');
    const { context, page } = await freshPage(browser, { pin: 'dance' });
    await page.goto(URL0, { waitUntil: 'load', timeout: 300000 });
    await page.waitForTimeout(1200);
    await harvest(page);
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
    await page.waitForTimeout(1200);
    await shot(page, 'pad-1-mission-loading');
    await booted(page);
    await bootGone(page);
    await page.evaluate(() => window.broodfall.step(600));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'lost'; s.events.push({ kind: 'lost' }); window.broodfall.step(1); });
    await page.waitForFunction(() => !document.getElementById('debrief').classList.contains('hidden'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, 'pad-2-report');
    await page.locator('#debrief-ship').click();
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 10000 });
    await page.waitForSelector('.bf-loader.on', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, 'pad-3-ship-arriving-yoke-dances');
    if (await page.locator('.bf-loader.on').count()) await moves(page, '.bf-loader.on .bf-loop', 'ship arriving');
    await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 120000 });
    await page.waitForTimeout(1200);
    await shot(page, 'pad-4-ship');
    await page.waitForTimeout(4000);
    const deploy = page.locator('[data-act="deploy-assigned"], [data-act="deploy"]:not([disabled])').first();
    if (await deploy.count()) {
      await harvest(page);
      await Promise.all([page.waitForURL(/campaign=run/, { timeout: 30000 }), deploy.click()]);
      await page.waitForTimeout(700);
      await shot(page, 'pad-5-next-deployment-loading');
      await booted(page);
      await bootGone(page);
      await page.waitForTimeout(800);
      await shot(page, 'pad-6-next-board');
    } else check(false, 'pad: the ship has a DEPLOY button');
    await verdict(page, 'pad → report → ship → deployment');
    await saveVideo(page, context, 'pad-lost');
  }

  if (want('reel')) {
    console.log('reel: a newsreel and an ending film on a slow link (the shots buffer)');
    const { context, page } = await freshPage(browser, { pin: 'scan', slow: { bps: 400_000, latency: 400 } });
    await page.goto(URL0 + '?campaign=ship&open=1', { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 180000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__bfMedia.start('reel-sector9'));
    await page.waitForSelector('#newsreel', { timeout: 30000 });
    await page.waitForSelector('#newsreel .bf-loader.on', { timeout: 15000 }).catch(() => {});
    await shot(page, 'reel-1-buffering');
    if (await page.locator('#newsreel .bf-loader.on').count()) await moves(page, '#newsreel .bf-loader.on .bf-loop', 'newsreel buffering');
    else check(false, 'reel: a loop showed while the first shot buffered');
    await page.waitForTimeout(5000);
    await shot(page, 'reel-2-playing');
    await page.waitForFunction(() => !document.getElementById('newsreel'), null, { timeout: 120000 }).catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__bfMedia.film('faithful-ending'));
    await page.waitForSelector('#newsreel', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, 'reel-3-ending-film-buffering');
    await page.waitForTimeout(4000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await verdict(page, 'newsreel + ending film');
    await saveVideo(page, context, 'newsreel');
  }

  if (want('yoke')) {
    console.log('yoke: the AI Core before her first clip arrives');
    const { context, page } = await freshPage(browser, { slow: { hold: { '/ship/yoke/': 6000 } } });
    await page.goto(URL0 + '?campaign=ship&open=1', { waitUntil: 'load', timeout: 300000 });
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 180000 });
    await page.locator('.cp-room[data-room="ai"]').click();
    await page.waitForTimeout(600);
    await shot(page, 'yoke-1-connecting');
    if (await page.locator('.cp-yoke-wait').count()) await moves(page, '.cp-yoke-live', 'YOKE connecting');
    await page.waitForFunction(() => !!document.querySelector('.cp-yoke-live video.on'), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'yoke-2-arrived');
    await verdict(page, 'YOKE connecting');
    await saveVideo(page, context, 'yoke');
  }

  if (want('organ')) {
    console.log('organ: the organ stage opening, on a slow link');
    const { context, page } = await freshPage(browser);
    await page.goto(URL0 + '?autostart=1&seed=3', { waitUntil: 'load', timeout: 300000 });
    await booted(page);
    await bootGone(page);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('open-under')?.click());
    await page.waitForTimeout(400);
    await shot(page, 'organ-1-opening');
    await page.waitForTimeout(2500);
    await shot(page, 'organ-2-open');
    await verdict(page, 'the organ stage');
    await saveVideo(page, context, 'organ');
  }

  if (want('calm')) {
    console.log('calm: Reduce motion on: the loops play slowly, never still');
    const { context, page } = await freshPage(browser, { settings: { reduceMotion: true }, video: false });
    await page.goto(URL0 + '?autostart=1&seed=3', { waitUntil: 'commit' });
    await page.waitForSelector('#boot .logo-emblem video', { timeout: 60000 });
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => {
      const v = document.querySelector('#boot .logo-emblem video');
      const img = document.querySelector('#boot .logo-emblem img');
      return { rate: v?.playbackRate, slowImg: /-slow\.webp/.test(img?.getAttribute('src') ?? '') };
    });
    check(st.slowImg && (st.rate === undefined || st.rate < 0.5), `reduce motion: the slow loop (first paint ${st.slowImg ? '-slow.webp' : 'NOT slow'}, video at ${st.rate}x)`);
    await moves(page, '#boot .logo-emblem', 'reduce motion');
    await shot(page, 'calm-1-slow-loop');
    await booted(page);
    await verdict(page, 'reduce motion');
    await context.close();
  }

  if (want('fast')) {
    console.log('fast: a short wait shows nothing (no flash)');
    const { context, page } = await freshPage(browser, { video: false, slow: null });
    await page.goto(URL0 + '?seed=3', { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => window.__bfBooted, null, { timeout: 120000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__bfWatch.length = 0; });
    await page.locator('#menu-deploy').click();
    await page.waitForTimeout(1200);
    const log = await page.evaluate(() => window.__bfWatch);
    const flashed = log.some((s) => s.seen.length);
    check(!flashed, `fast: SKIRMISH with the board already loaded shows no loading screen at all (${log.length} samples)`);
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
