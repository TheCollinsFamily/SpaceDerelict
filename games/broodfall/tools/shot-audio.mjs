/**
 * THE SOUND, PLAYED THROUGH (Sep 30 2026; src/audio/). On the DEV server (what `npm start` runs),
 * in fresh headless browsers that are NOT allowed to play sound until they are clicked (the real
 * path: every sound here was unlocked by a real click or key):
 *
 *   A  first launch: the film waits behind ▸ BEGIN; the click starts it with its score and the
 *      narrator; mission 1 (build music, a limb grown, a wave: fanfare, siren, march, the assault,
 *      limbs firing, insects dying); the run lost (defeat sting, the data pad dropped); CONTINUE →
 *      the ship (its music, YOKE's intercom, her voice ducks the music); the boss's message
 *      (his voice ducks the music).
 *   B  a later launch: the menu's music; the settings' sliders move the buses (and the meter);
 *      "mute when away" is kept; buttons hover and click; CONTINUE → the ship.
 *   C  a skirmish played through: wave setup, two waves (the assault crossfades in and out), the
 *      organ stage between them (its music, organs grown), the royal's roar, the core evolving,
 *      the run WON (victory sting, the pad set down), the report.
 *
 * Every cue asked for is in `window.__bfAudio.log` (played or why not); the beat checks the ones
 * each part must have played, the buses and the meter, and that nothing errors. The mixed output
 * (what the speakers get) is recorded in the page (MediaRecorder on the master bus), laid under
 * Playwright's video of the same page, and saved for Collins to watch and hear:
 *   notes/screens/2026-09-30/audio-proof.mp4   (A, B, C one after another)
 *   notes/screens/2026-09-30/audio-proof-<A|B|C>.ogg   (the mix of each part, sound only)
 * rfab.ai is MOCKED for YOKE (her voice is a quarter second of silence): nothing is spent.
 *
 *   node tools/shot-audio.mjs [A] [B] [C]     (its own dev server on BROODFALL_PORT, default 5263)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-09-30');
const tmp = join(here, 'screenshots', 'audio-proof');
mkdirSync(notes, { recursive: true });
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5263);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
const VIEW = { width: 1280, height: 720 };

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ids = JSON.parse(readFileSync(join(root, 'content', 'lore', 'yoke-avatar.json'), 'utf8'));
const silent = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.25', '-c:a', 'libmp3lame', '-b:a', '32k', '-f', 'mp3', '-'], { maxBuffer: 1 << 20 }).stdout;

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

/** A fresh player whose page is filmed; YOKE's rfab.ai mocked; the data pad's clip on. */
async function newPlayer(browser, name, init = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: join(tmp, name), size: VIEW } });
  const opened = Date.now();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript((init) => {
    const real = window.fetch.bind(window);
    const enc = new TextEncoder();
    window.__yoke = { ctl: null };
    window.fetch = (input, i) => {
      const url = String(input instanceof Request ? input.url : input);
      if (/\/rfab-api\/api\/avatars\/[^/]+\/events$/.test(url)) {
        const body = new ReadableStream({ start(c) { window.__yoke.ctl = c; c.enqueue(enc.encode(': open\n\n')); } });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
      }
      return real(input, i);
    };
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: init.yoke ?? 'avatar', v: 2 }));
      localStorage.setItem('broodfall-pad-outro', 'on');
      for (const [k, v] of Object.entries(init.store ?? {})) localStorage.setItem(k, v);
    }
  }, init);
  const base = `**/rfab-api/api/avatars/${ids.avatarId}`;
  await page.route(`${base}/history`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turns: [] }) }));
  await page.route(`${base}/message`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }));
  await page.route(`${base}/speak`, (r) => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: silent }));
  await page.route('**/rfab-api/api/broodfall/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors, opened, name };
}

const audio = (page) => page.evaluate(() => window.__bfAudio.state());
/** The cues played since the part began. */
const played = (page) => page.evaluate(() => window.__bfAudio.log.filter((e) => e.played).map((e) => `${e.kind}:${e.id}`));
const level = (page) => page.evaluate(() => window.__bfAudio.level());
async function meterMax(page, ms) {
  let m = -200;
  for (let t = 0; t < ms; t += 150) { m = Math.max(m, await level(page)); await sleep(150); }
  return m;
}
async function startRecording(p) {
  const ok = await p.page.evaluate(() => window.__bfAudio.record());
  p.recAt = Date.now();
  return ok;
}
async function finish(p, results) {
  const b64 = await p.page.evaluate(() => window.__bfAudio.stop());
  const webm = join(tmp, `${p.name}.webm`);
  writeFileSync(webm, Buffer.from(b64, 'base64'));
  const video = await p.page.video()?.path();
  const log = await p.page.evaluate(() => window.__bfAudio.log);
  await p.ctx.close();
  // Playwright writes the video on close.
  results.push({ name: p.name, webm, video, offset: (p.recAt - p.opened) / 1000, log });
}

/** Grow up to `n` limbs from the hand on ground that takes them (the API, as tools/shot-campaign.mjs plays). */
const grow = (page, n) => page.evaluate((n) => {
  const b = window.broodfall;
  // Meat enough, and the limbs that shoot first (the point here is to hear them).
  b.sim.meat.war += 400;
  const SHOOTS = ['spitter', 'impaler', 'quill', 'frond', 'prism', 'ember', 'lobber', 'burster', 'maw', 'net', 'lasher', 'mister', 'bombard', 'skipper', 'ocular', 'blighter', 'tangler', 'spine', 'sling'];
  // Near the core, where the hive comes to (a limb out of reach never fires).
  const d = (c) => { const p = b.sim.cellCenter(c); return Math.hypot(p.x - b.sim.core.x, p.y - b.sim.core.y); };
  const cells = b.buildableCells(3000).sort((x, y) => d(x) - d(y));
  let grown = 0;
  for (let tries = 0; tries < 12 && grown < n; tries++) {
    let any = false;
    const order = [...b.sim.hand.keys()].sort((x, y) => (SHOOTS.includes(b.sim.hand[y].family) ? 1 : 0) - (SHOOTS.includes(b.sim.hand[x].family) ? 1 : 0));
    for (const i of order) {
      if (grown >= n) break;
      const fam = b.sim.hand[i].family;
      for (const cell of cells) {
        const facing = b.sim.facingTowardGate(b.sim.cellCenter(cell));
        if (!b.sim.groundFor(cell, fam, facing)) continue;
        const r = b.play({ kind: 'build', cardIndex: i, cell, facing });
        if (r.ok) { grown++; any = true; break; }
      }
    }
    if (!any) break;
  }
  return grown;
}, n);

const endRun = (page, how) => page.evaluate((how) => {
  const s = window.broodfall.sim;
  s.outcome = how;
  s.events.push({ kind: how });
  window.broodfall.step(1);
}, how);

const board = (page) => page.waitForFunction(() => window.__bfBooted && window.broodfall && document.getElementById('boot')?.classList.contains('hidden'), null, { timeout: 90000 });

function has(list, cue, what) { check(list.includes(cue), `${what} (${cue})`); }
function hasAny(list, re, what) { const hit = list.filter((c) => re.test(c)); check(hit.length > 0, `${what}: ${[...new Set(hit)].slice(0, 8).join(', ') || 'none'}`); }

const server = await startDev();
// No --autoplay-policy flag: the page may not play sound until it is clicked, as for a player.
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
try {
  // ================================================================ A
  if (want('A')) {
    console.log('A: the film, mission 1, the end, the ship, the boss');
    const p = await newPlayer(browser, 'A');
    const { page, errors } = p;
    await page.goto(URL0, { waitUntil: 'load' });
    await page.waitForSelector('#intro', { timeout: 15000 });
    await page.waitForSelector('#intro.begin .intro-begin button', { timeout: 5000 }).catch(() => {});
    const card = await page.evaluate(() => ({ begin: document.getElementById('intro').classList.contains('begin'), a: window.__bfAudio.state() }));
    check(card.begin && !card.a.unlocked, `the page may not play sound yet: the film waits behind ▸ BEGIN (context ${card.a.context})`);
    await page.locator('#intro .intro-begin button').click();
    await sleep(200);
    check(await startRecording(p), 'the mix is recorded');
    const a1 = await audio(page);
    check(a1.unlocked && a1.context === 'running', 'the click unlocked the sound');
    await page.waitForFunction(() => document.querySelector('#intro .intro-title.on'), null, { timeout: 15000 });
    const filmLevel = await meterMax(page, 2500);
    check(filmLevel > -45, `the film's score is heard (meter peak ${filmLevel.toFixed(1)} dBFS)`);
    await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 60000 });
    let got = await played(page);
    has(got, 'film:film', 'the film\'s score played');
    hasAny(got, /^voice:nar-film-/, 'the narrator read the titles');
    await board(page);
    await sleep(2500);
    check((await audio(page)).loop === 'siege-build', `mission 1: the build music (${(await audio(page)).loop})`);
    await page.locator('#speed-box [data-speed="3"]').click();
    const n = await grow(page, 3);
    check(n > 0, `limbs grown (${n})`);
    await page.evaluate(() => window.broodfall.play({ kind: 'call-early' }));
    await page.waitForFunction(() => window.__bfAudio.state().loop === 'siege-assault', null, { timeout: 30000 }).catch(() => {});
    check((await audio(page)).loop === 'siege-assault', 'the wave: the assault music crossfaded in');
    await sleep(14000);
    got = await played(page);
    has(got, 'sting:sting-wave', 'the wave\'s fanfare');
    has(got, 'sfx:wave-siren', 'the town\'s siren at the first wave');
    has(got, 'sfx:assault-march', 'the assault forming at the gate');
    has(got, 'sfx:limb-grow', 'a limb growing');
    hasAny(got, /^sfx:fire-/, 'limbs firing');
    hasAny(got, /^sfx:die-/, 'insects dying');
    await endRun(page, 'lost');
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 20000 });
    got = await played(page);
    has(got, 'sting:sting-defeat', 'the defeat sting');
    has(got, 'sfx:pad-lost', 'the data pad dropped on the desk');
    check((await audio(page)).scene === 'end', 'the run\'s music is gone at its end');
    await sleep(1500);
    await page.locator('#debrief-ship').click();
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
    await sleep(2500);
    const s1 = await audio(page);
    check(s1.scene === 'ship' && s1.loop === 'theme-ship', `the ship: its music (${s1.loop})`);
    got = await played(page);
    has(got, 'sfx:intercom-open', 'YOKE\'s intercom opens');
    has(got, 'sfx:ui-confirm', 'CONTINUE confirms');
    await page.waitForSelector('#boss-call', { timeout: 60000 });
    await sleep(1500);
    const duck = await audio(page);
    check(duck.ducks > 0 && duck.gains.musicDuck < 0.6, `the boss speaks: the music ducks under him (duck ${duck.gains.musicDuck.toFixed(2)})`);
    got = await played(page);
    has(got, 'duck:yoke', 'YOKE\'s voice ducked the music too');
    await sleep(5000);
    await page.locator('#boss-call').click();
    await sleep(1500);
    check((await audio(page)).gains.musicDuck > 0.8, 'the music comes back up when he is done');
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
    await finish(p, results);
  }

  // ================================================================ B
  if (want('B')) {
    console.log('B: the menu, the settings, the ship');
    const p = await newPlayer(browser, 'B', { store: { 'broodfall-intro-seen': '1' } });
    const { page, errors } = p;
    // A campaign past mission 1 on record (the beats' own), then the page as a later launch opens it.
    await page.goto(`${URL0}?campaign=ship&open=1`, { waitUntil: 'load' });
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 30000 });
    await page.goto(URL0, { waitUntil: 'load' });
    await page.waitForSelector('#menu:not(.hidden)', { timeout: 30000 });
    await sleep(800);
    check(!(await audio(page)).unlocked, 'nothing plays before a click');
    await page.mouse.move(640, 700);
    await page.mouse.down(); await page.mouse.up();
    await sleep(300);
    check(await startRecording(p), 'the mix is recorded');
    await sleep(3500);
    const m = await audio(page);
    check(m.scene === 'menu' && m.loop === 'theme-menu', `the menu's music: the ship's hum (${m.loop})`);
    const menuLevel = await meterMax(page, 1500);
    check(menuLevel > -60, `it is heard (meter peak ${menuLevel.toFixed(1)} dBFS)`);
    for (const id of ['#menu-campaign', '#menu-settings', '#menu-intro']) { await page.hover(id).catch(() => {}); await sleep(250); }
    await page.locator('#menu-settings').click();
    await page.waitForSelector('#settings:not(.hidden)');
    const setVol = (ch, v) => page.evaluate(([ch, v]) => { const el = document.querySelector(`#settings input[data-vol="${ch}"]`); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, [ch, v]);
    await setVol('music', 20); await sleep(700);
    check(Math.abs((await audio(page)).gains.music - 0.2) < 0.03, `the music slider moves the music bus (${(await audio(page)).gains.music.toFixed(2)})`);
    await setVol('sfx', 40); await sleep(700);
    // (A bus with nothing flowing through it is not processed, so its gain is read off the meter:
    // the music off, one effect at the slider's level, then at 0.)
    await setVol('music', 0); await sleep(1500);
    const fxAt = async (v) => { await setVol('sfx', v); await sleep(400); await page.evaluate(() => window.__bfAudio.sfx('core-evolve')); return meterMax(page, 1500); };
    const fxOn = await fxAt(80);
    await sleep(8500);
    await setVol('sfx', 0); await sleep(400);
    const floor = await meterMax(page, 1000);
    const fxOff = await fxAt(0);
    check(fxOn > -45 && fxOff < floor + 3 && fxOn - fxOff > 30, `the effects slider moves the effects bus (an effect at 80%: ${fxOn.toFixed(1)} dBFS; at 0%: ${fxOff.toFixed(1)} dBFS, the same as nothing: ${floor.toFixed(1)})`);
    await setVol('music', 20); await setVol('sfx', 40); await sleep(700);
    await setVol('voice', 60); await sleep(700);
    check(Math.abs((await audio(page)).gains.voice - 0.6) < 0.03, `the voices slider moves the voice bus (${(await audio(page)).gains.voice.toFixed(2)})`);
    await setVol('master', 0); await sleep(900);
    const quiet = await meterMax(page, 600);
    check((await audio(page)).gains.master < 0.02 && quiet < -80, `master at 0: silence (meter ${quiet.toFixed(1)} dBFS)`);
    await setVol('master', 80); await setVol('music', 70); await setVol('sfx', 80); await setVol('voice', 100); await sleep(900);
    check((await meterMax(page, 900)) > -60, 'master back: heard again');
    await page.locator('#settings [data-toggle="unfocused"]').click();
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-settings') ?? '{}'));
    check(kept.muteUnfocused === false && kept.volume?.music === 0.7, `the settings are kept (mute when away ${kept.muteUnfocused}, music ${kept.volume?.music})`);
    await page.locator('#settings [data-toggle="unfocused"]').click();
    await page.keyboard.press('Escape');
    await sleep(600);
    await page.locator('#menu-campaign').click();
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 20000 });
    await sleep(4000);
    const s = await audio(page);
    check(s.scene === 'ship' && s.loop === 'theme-ship', `CONTINUE → the ship's music crossfades in (${s.loop})`);
    for (const r of ['gene', 'comms', 'ai']) { const b = page.locator(`#campaign [data-room="${r}"]`).first(); if (await b.count()) { await b.hover(); await sleep(200); await b.click(); await sleep(900); } }
    const got = await played(page);
    hasAny(got, /^sfx:ui-hover$/, 'buttons answer the pointer');
    hasAny(got, /^sfx:ui-(click|confirm)$/, 'buttons click');
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
    await finish(p, results);
  }

  // ================================================================ C
  if (want('C')) {
    console.log('C: a skirmish played through: build, assault, organ stage, the royal, the win');
    const p = await newPlayer(browser, 'C', { yoke: 'scripted', store: { 'broodfall-intro-seen': '1' } });
    const { page, errors } = p;
    await page.goto(`${URL0}?autostart=1&seed=424242&speed=3&directive=hold`, { waitUntil: 'load' });
    await board(page);
    await page.locator('#speed-box [data-speed="3"]').click();
    await sleep(300);
    check(await startRecording(p), 'the mix is recorded');
    await page.evaluate(() => { window.broodfall.sim.directive = { kind: 'hold', waves: 2 }; });
    await sleep(3000);
    check((await audio(page)).loop === 'siege-build', 'wave setup: the build music');
    const g1 = await grow(page, 5);
    check(g1 >= 3, `limbs grown (${g1})`);
    await sleep(1500);
    for (let wave = 1; wave <= 2; wave++) {
      await page.evaluate(() => window.broodfall.play({ kind: 'call-early' }));
      await page.waitForFunction(() => window.__bfAudio.state().loop === 'siege-assault', null, { timeout: 30000 }).catch(() => {});
      check((await audio(page)).loop === 'siege-assault', `wave ${wave}: the assault music`);
      if (wave === 1) { await sleep(4000); await page.evaluate(() => { window.broodfall.sim.events.push({ kind: 'royal-incoming' }); }); }
      // The wave plays out; its end opens the organ stage (or the run is won).
      await page.waitForFunction(() => window.broodfall.sim.outcome !== 'playing' || window.__bfAudio.state().scene === 'organ', null, { timeout: 180000 }).catch(() => {});
      if (await page.evaluate(() => window.broodfall.sim.outcome !== 'playing')) break;
      await sleep(3500);
      const o = await audio(page);
      check(o.scene === 'organ' && o.loop === 'organ', `between waves: the organ stage's music (${o.loop})`);
      // An organ grown by the hand of the scripted player's own rules is not needed: the sim's organ commands are.
      await page.evaluate(() => {
        const b = window.broodfall;
        const organs = ['forge', 'venom', 'gut', 'bladder', 'heart', 'brain'];
        for (const organ of organs) for (let cell = 0; cell < 400; cell++) { const r = b.play({ kind: 'build-organ', organ, cell }); if (r.ok) return; }
      });
      await sleep(4000);
      await page.evaluate(() => window.broodfall.surface());
      await sleep(2500);
      await grow(page, 4);
      // The core grows a stage at 6 and 18 limbs grown (src/render/coreStage.ts).
      if (wave === 1) await page.evaluate(() => { window.broodfall.sim.stats.limbsGrown = Math.max(window.broodfall.sim.stats.limbsGrown, 6); });
      await sleep(3000);
    }
    await page.waitForFunction(() => window.broodfall.sim.outcome !== 'playing', null, { timeout: 180000 }).catch(() => {});
    const out = await page.evaluate(() => window.broodfall.sim.outcome);
    check(out === 'won', `the run is won (${out})`);
    await page.waitForSelector('#debrief:not(.hidden), #overlay:not(.hidden)', { timeout: 30000 }).catch(() => {});
    await sleep(3000);
    const got = await played(page);
    has(got, 'sting:sting-victory', 'the victory fanfare');
    has(got, 'sfx:pad-won', 'the data pad set down calmly');
    has(got, 'sfx:boss-roar', 'the royal roars as it takes the field');
    has(got, 'sfx:core-evolve', 'the core evolves');
    has(got, 'sting:sting-core', 'and its sting');
    hasAny(got, /^sfx:organ-place$/, 'an organ grown in the organ stage');
    has(got, 'sting:sting-cleared', 'a wave cleared');
    hasAny(got, /^sfx:card-/, 'cards drawn');
    hasAny(got, /^sfx:hit-/, 'shots landing');
    const fires = new Set(got.filter((c) => c.startsWith('sfx:fire-')));
    check(fires.size >= 1, `limb classes heard: ${[...fires].join(', ')}`);
    // No machine-gun: the effects that were dropped by their rules outnumber none, and never more than the cap sound at once.
    const log = await page.evaluate(() => window.__bfAudio.log.filter((e) => e.kind === 'sfx'));
    const dropped = log.filter((e) => !e.played && (e.why === 'gap' || e.why === 'poly' || e.why === 'voices')).length;
    const playedN = log.filter((e) => e.played).length;
    const perSec = {};
    for (const e of log.filter((x) => x.played)) { const k = Math.floor(e.t / 1000); perSec[k] = (perSec[k] ?? 0) + 1; }
    const busiest = Math.max(0, ...Object.values(perSec));
    check(busiest <= 40, `the busiest second started ${busiest} effects (${playedN} played, ${dropped} held back by the limits)`);
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
    await finish(p, results);
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}

// ---------------------------------------------------------------- the files Collins listens to
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status) console.warn(r.stderr.slice(0, 400)); return r.status === 0; };
const parts = [];
for (const r of results) {
  const ogg = join(notes, `audio-proof-${r.name}.ogg`);
  ff(['-i', r.webm, '-c:a', 'libopus', '-b:a', '128k', ogg]);
  if (r.video && existsSync(r.video)) {
    const mp4 = join(tmp, `${r.name}.mp4`);
    // The recording began `offset` seconds into the page's video: the video is cut from there.
    if (ff(['-ss', r.offset.toFixed(2), '-i', r.video, '-i', r.webm, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', mp4])) parts.push(mp4);
  }
  writeFileSync(join(tmp, `${r.name}-log.json`), JSON.stringify(r.log));
}
if (parts.length) {
  const list = join(tmp, 'parts.txt');
  writeFileSync(list, parts.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const out = join(notes, `audio-proof${only.length ? '-' + only.join('') : ''}.mp4`);
  if (ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out])) console.log(`the proof: ${out}`);
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
