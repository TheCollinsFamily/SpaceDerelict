/**
 * THE TRAILER (Oct 1 2026). Everything that makes promo/trailer/: the store trailer (about 85 s,
 * 1920x1080, H.264 + AAC), a 30 s cut and a vertical 1080x1920 cut for social, the shot list and a
 * contact sheet. Reads the game, never edits it.
 *
 *   node tools/promo/trailer.mjs capture [ids]   real gameplay, frame by frame at 60 fps (see CAPTURE)
 *   node tools/promo/trailer.mjs record [ids]    the ship in real time (YOKE's greeting, the boss's call)
 *   node tools/promo/trailer.mjs gen             new pictures that move (RFab image-to-video; SPENDS tokens,
 *                                                skips what is on disk) and YOKE's lines in her voice
 *   node tools/promo/trailer.mjs titles          the title cards, set in the game's type (headless Chromium)
 *   node tools/promo/trailer.mjs cut [full 30 vertical]   the edit, the mix (-14 LUFS, peaks under -1 dBTP)
 *   node tools/promo/trailer.mjs sheet           promo/trailer/contact-sheet.jpg
 *
 * HOW GAMEPLAY IS FILMED. The game runs on the dev server (its own port, TRAILER_PORT, default 5341),
 * GPU on. An init script takes over the page's clock (performance.now, Date.now, requestAnimationFrame):
 * once a shot is set up, the clock is frozen and moved on exactly 1/60 s per frame, and each frame is
 * photographed (CDP Page.captureScreenshot). The game cannot tell: its frame loop, the sim, the idles'
 * clock, the camera's easing, Pixi and three.js all read that clock. So every frame is a real frame of
 * the game at 60 fps, however long the photograph takes. The board is resized to fill 16:9 (as
 * tools/promo/shots.mjs does) and the scripted player's "demo mode" line is hidden; nothing else.
 * Raw frames and clips: art-src/trailer/ (git-ignored).
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'art-src', 'trailer');
const CAP = path.join(RAW, 'cap');
const OUT = path.join(ROOT, 'promo', 'trailer');
for (const d of [RAW, CAP, OUT]) fs.mkdirSync(d, { recursive: true });
const PORT = Number(process.env.TRAILER_PORT || 5341);
const BASE = `http://localhost:${PORT}/`;
const [cmd = 'help', ...rest] = process.argv.slice(2);
const want = new Set(rest.filter((a) => !a.startsWith('--')));
const on = (id) => !want.size || want.has(id);
const FPS = 60;

function ff(args, label = 'ffmpeg') {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${label}: ${r.stderr?.slice(-1500)}`);
  return r;
}
const dur = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim());

// ------------------------------------------------------------------ the dev server
function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split('\n')) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT) } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dev server did not start in 60s')), 60000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`dev server exited early (${code})`)));
  });
}
async function withGame(fn) {
  const { chromium } = await import('@playwright/test');
  const server = await startDev();
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  try { await fn(browser); } finally {
    await browser.close().catch(() => {});
    try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    freePort();
  }
}

// ------------------------------------------------------------------ the page's clock, taken over
const CLOCK = () => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);
  const realST = window.setTimeout.bind(window), realCT = window.clearTimeout.bind(window);
  const realSI = window.setInterval.bind(window), realCI = window.clearInterval.bind(window);
  const realDate = Date.now;
  const realPlay = HTMLMediaElement.prototype.play, realPause = HTMLMediaElement.prototype.pause;
  const st = { frozen: false, t: 0, q: new Map(), id: 1e7, date0: 0, t0: 0, timers: new Map(), tid: 5e8, media: new Set() };
  window.__clk = st;
  window.__realTimeout = realST;
  performance.now = () => (st.frozen ? st.t : realNow());
  Date.now = () => (st.frozen ? st.date0 + (st.t - st.t0) : realDate());
  window.requestAnimationFrame = (cb) => { if (!st.frozen) return realRaf(cb); const i = ++st.id; st.q.set(i, cb); return i; };
  window.cancelAnimationFrame = (i) => { st.q.delete(i); realCaf(i); };
  // Timers run on the clock too once it is frozen (captions, holds, a greeting's pacing).
  window.setTimeout = (fn, ms = 0, ...a) => { if (!st.frozen) return realST(fn, ms, ...a); const id = ++st.tid; st.timers.set(id, { due: st.t + (+ms || 0), fn, a }); return id; };
  window.clearTimeout = (id) => { if (!st.timers.delete(id)) realCT(id); };
  window.setInterval = (fn, ms = 0, ...a) => { if (!st.frozen) return realSI(fn, ms, ...a); const id = ++st.tid; st.timers.set(id, { due: st.t + Math.max(1, +ms || 0), fn, a, every: Math.max(1, +ms || 0) }); return id; };
  window.clearInterval = (id) => { if (!st.timers.delete(id)) realCI(id); };
  // Sound and pictures: while frozen nothing plays by itself. A video is set to where the clock says;
  // a sound is "playing" but never heard and never ends (the edit lays the real sound where it began).
  window.__plays = [];
  HTMLMediaElement.prototype.play = function () {
    st.media.add(this);
    window.__plays.push({ src: String(this.currentSrc || this.src).slice(-60), t: performance.now(), video: this instanceof HTMLVideoElement });
    if (!st.frozen) return realPlay.call(this);
    this.__fk = { ...(this.__fk ?? {}), run: true, base: this.currentTime, at: st.t, src: this.currentSrc || this.src, ended: false };
    if (!(this instanceof HTMLVideoElement)) { try { this.dispatchEvent(new Event('play')); this.dispatchEvent(new Event('playing')); } catch {} }
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () {
    if (this.__fk) this.__fk.run = false;
    return realPause.call(this);
  };
  /** Freeze: what the last real frame asks for next waits for __advance. */
  window.__freeze = () => new Promise((res) => {
    st.frozen = true;
    st.t = realNow(); st.t0 = st.t; st.date0 = realDate();
    for (const m of [...st.media, ...document.querySelectorAll('video, audio')]) {
      const was = !m.paused;
      if (was) realPause.call(m);
      m.__fk = { run: was || (m instanceof HTMLVideoElement && m.autoplay), base: m.currentTime, at: st.t, src: m.currentSrc || m.src, ended: false };
    }
    realRaf(() => realST(() => { st.t = Math.max(st.t, realNow()); res(); }, 30));
  });
  window.__thaw = () => { st.frozen = false; const cbs = [...st.q.values()]; st.q.clear(); for (const cb of cbs) realRaf(cb); for (const [, tm] of st.timers) realST(tm.fn, 0, ...tm.a); st.timers.clear(); };
  window.__advance = async (ms) => {
    const to = st.t + ms;
    // Timers due in this step, in order (an interval comes back for its next turn).
    for (let guard = 0; guard < 500; guard++) {
      let next = null;
      for (const [id, tm] of st.timers) if (tm.due <= to && (!next || tm.due < next[1].due)) next = [id, tm];
      if (!next) break;
      const [id, tm] = next;
      st.t = Math.max(st.t, tm.due);
      if (tm.every) tm.due += tm.every; else st.timers.delete(id);
      try { typeof tm.fn === 'function' ? tm.fn(...tm.a) : null; } catch (e) { console.error(e); }
    }
    st.t = to;
    const cbs = [...st.q.values()];
    st.q.clear();
    for (const cb of cbs) { try { cb(st.t); } catch (e) { console.error(e); } }
    const seeks = [];
    for (const v of document.querySelectorAll('video')) {
      const src = v.currentSrc || v.src;
      if (!v.__fk) v.__fk = { run: v.autoplay || !v.paused, base: v.currentTime, at: st.t - ms, src, ended: false };
      if (v.__fk.src !== src) Object.assign(v.__fk, { base: 0, at: st.t - ms, src, ended: false, run: v.__fk.run || v.autoplay });
      if (!v.paused) realPause.call(v);
      if (!v.__fk.run || !(v.duration > 0)) continue;
      let want = v.__fk.base + (st.t - v.__fk.at) / 1000;
      if (v.loop) want %= v.duration;
      else if (want >= v.duration - 0.02) {
        want = v.duration - 0.02;
        if (!v.__fk.ended) { v.__fk.ended = true; v.__fk.run = false; realST(() => v.dispatchEvent(new Event('ended')), 0); }
      }
      if (Math.abs(v.currentTime - want) < 1e-3) continue;
      seeks.push(new Promise((r) => { const done = () => r(); v.addEventListener('seeked', done, { once: true }); realST(done, 300); }));
      v.currentTime = want;
    }
    for (const m of st.media) {
      if (m instanceof HTMLVideoElement || !m.__fk?.run || !(m.duration > 0)) continue;
      if (m.__fk.base + (st.t - m.__fk.at) / 1000 >= m.duration) { m.__fk.run = false; realST(() => m.dispatchEvent(new Event('ended')), 0); }
    }
    if (seeks.length) await Promise.all(seeks);
  };
};

/** In-page helpers for the shots (camera, where the fight is). */
const HELPERS = () => {
  const B = () => window.broodfall, R = () => window.broodfall.renderer;
  window.__T = {
    /** Aim the camera (it eases there by itself) at a world point, at a zoom; snap = no easing. */
    camTo(x, y, zoom, snap = false, up = 0) {
      const r = R(), s = B().worldToScreen(x, y);
      const px = (s.x - r.camX) / r.camScale, py = (s.y - r.camY) / r.camScale;
      r.zoom = zoom;
      // The projected point sits at the screen's middle at that zoom.
      // up: the view raised by that many screen pixels (the target sits lower on the screen).
      r.pan = { x: px - r.mid.x, y: py - r.mid.y - up / (r.fit * zoom) };
      if (snap) r.camInit = false;
    },
    home(zoom = 1, snap = false) { const r = R(); r.zoom = zoom; r.pan = { x: 0, y: 0 }; if (snap) r.camInit = false; },
    /** The middle of the thickest knot of enemies (of a kind). */
    fight(kind = null, radius = 140) {
      const es = B().sim.enemies.filter((e) => !e.leaving && (!kind || e.kind === kind));
      if (!es.length) return null;
      let best = es[0], bestN = -1;
      for (const e of es) { const n = es.filter((o) => Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < radius).length; if (n > bestN) { bestN = n; best = e; } }
      const near = es.filter((o) => Math.hypot(o.pos.x - best.pos.x, o.pos.y - best.pos.y) < radius);
      return { x: near.reduce((a, e) => a + e.pos.x, 0) / near.length, y: near.reduce((a, e) => a + e.pos.y, 0) / near.length, n: near.length };
    },
  };
};

/** Dress the board for a 16:9 picture: the drawing surface fills the stage; the demo line is hidden. */
async function dress(page) {
  await page.addStyleTag({ content: '#hint{visibility:hidden!important} #shot-cursor{display:none!important}' });
  await page.evaluate(() => {
    const wrap = document.getElementById('stage-wrap');
    const r = window.broodfall.renderer;
    if (wrap && r?.app) r.app.renderer.resize(wrap.clientWidth, wrap.clientHeight);
  });
  await page.waitForTimeout(300);
}

/** Play fast with the scripted player to wave `upTo` (its own wallet, a little topped up). */
const grow = (page, upTo, topUp = 0) => page.evaluate(([upTo, topUp]) => {
  const b = window.broodfall, s = b.sim;
  for (let i = 0; i < 400 && s.outcome === 'playing' && s.waveNumber < upTo; i++) { if (topUp) s.meat.war += topUp; b.step(300); }
  return { wave: s.waveNumber, towers: s.towers.length, outcome: s.outcome, phase: s.phase, enemies: s.enemies.length };
}, [upTo, topUp]);

async function freshGame(browser, { dpr = 1, w = 1920, h = 1080, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('bf-trailer-init')) return;
    sessionStorage.setItem('bf-trailer-init', '1');
    for (const k of ['broodfall-campaign', 'broodfall-campaign-pending', 'broodfall-meta']) localStorage.removeItem(k);
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-onboarded', '1');
    localStorage.setItem('broodfall-globe-spin', 'on');
  });
  await ctx.addInitScript(CLOCK);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('  page error:', String(e).slice(0, 200)); });
  return { ctx, page, errors };
}
const ready = async (page) => {
  await page.waitForFunction(() => window.broodfall?.sim, null, { timeout: 120000 });
  await page.waitForFunction(() => window.broodfall.artMissing().length === 0, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(HELPERS);
};
/** No "did not load" notice on the page, and every picture of the board loaded. */
async function artOk(page, id) {
  const r = await page.evaluate(() => {
    const el = document.getElementById('art-notice');
    const shown = el && !el.classList.contains('hidden') && el.offsetParent ? el.textContent : '';
    const banner = /did not load/i.test(document.body.innerText) ? 'a "did not load" line' : '';
    return { missing: window.broodfall?.artMissing?.() ?? [], notice: [shown, banner].filter(Boolean).join(' ') };
  });
  if (r.missing.length || r.notice) throw new Error(`${id}: art missing or notice shown: ${[...r.missing, r.notice].join(' | ').slice(0, 300)}`);
}

/**
 * Film `frames` frames at 60 fps. `each(i)` (optional, Node side) runs before each frame is advanced:
 * it steers the camera and stages things in the page.
 */
async function film(page, ctx, id, frames, each = null, { quality = 92, preroll = 40, frozen = false, thaw = true } = {}) {
  const dir = path.join(CAP, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  if (!frozen) await page.evaluate(() => window.__freeze());
  // A moment of the game before the first frame: the camera is there, the clock is running.
  for (let i = 0; i < preroll; i++) { if (each) await each(0); await page.evaluate(() => window.__advance(1000 / 60)); }
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    if (each) await each(i);
    await page.evaluate(() => window.__advance(1000 / 60));
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, optimizeForSpeed: true });
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    if (i % 60 === 59) process.stdout.write(`  ${id}: ${i + 1}/${frames} (${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame)\r`);
  }
  console.log('');
  if (thaw) await page.evaluate(() => window.__thaw());
  const mp4 = path.join(CAP, `${id}.mp4`);
  ff(['-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', mp4], `${id} encode`);
  ff(['-i', mp4, '-vf', `select='not(mod(n\\,${Math.max(1, Math.floor(frames / 4))}))',scale=480:-2,tile=4x1`, '-frames:v', '1', path.join(CAP, `${id}-look.jpg`)], `${id} look`);
  console.log(`  filmed ${mp4} (${(frames / FPS).toFixed(2)} s)`);
  return mp4;
}

/** A camera that follows the fight smoothly: re-aimed every `every` frames, the zoom eased from z0 to z1. */
function follow(page, frames, { z0, z1, kind = null, every = 20, lead = null } = {}) {
  let aim = null, first = true;
  return async (i) => {
    const z = z0 + (z1 - z0) * (i / Math.max(1, frames - 1));
    if (i % every === 0 || !aim) {
      const f = lead ? await page.evaluate(lead) : await page.evaluate((k) => window.__T.fight(k), kind);
      if (f) aim = aim ? { x: aim.x * 0.6 + f.x * 0.4, y: aim.y * 0.6 + f.y * 0.4 } : f;
    }
    if (aim) await page.evaluate(([a, z, snap]) => window.__T.camTo(a.x, a.y, z, snap), [aim, z, first]);
    first = false;
  };
}

// ------------------------------------------------------------------ CAPTURE: the gameplay shots
const SHOTS = {
  /** Wave 2 of an ordinary board: it looks like a small tower defence. The whole board, a slow push. */
  'g-open': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=5&auto=1&autostart=1&speed=1&directive=hold&biome=suburb`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 2, 0)));
    await page.waitForFunction(() => window.broodfall.sim.enemies.length >= 5, null, { timeout: 30000 }).catch(() => {});
    await artOk(page, 'g-open');
    await page.evaluate(() => window.__T.home(1, true));
    const n = 360;
    await film(page, ctx, 'g-open', n, async (i) => page.evaluate((z) => window.__T.home(z), 1 + 0.18 * (i / n)));
    await ctx.close();
  },
  /** A siege in the Megacity: limbs firing into a column. */
  'g-siege': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=12&auto=1&autostart=1&speed=1&directive=hold&biome=megacity`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 9, 25)));
    await page.waitForFunction(() => window.broodfall.sim.enemies.length >= 14, null, { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await artOk(page, 'g-siege');
    const n = 420;
    await film(page, ctx, 'g-siege', n, follow(page, n, { z0: 2.3, z1: 2.8 }));
    await ctx.close();
  },
  /** The Temple Cities under siege, lightning and shot. */
  'g-temple': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=5&auto=1&autostart=1&speed=1&directive=hold&biome=orthodox`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 9, 25)));
    await page.waitForFunction(() => window.broodfall.sim.enemies.length >= 14, null, { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await artOk(page, 'g-temple');
    const n = 360;
    await film(page, ctx, 'g-temple', n, follow(page, n, { z0: 2.0, z1: 2.4 }));
    await ctx.close();
  },
  /** The Maw, the frog's tongue: weakened soldiers in the street caught and swallowed one after another. */
  'g-maw': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=11&autostart=1&speed=1&biome=suburb`);
    await ready(page); await dress(page);
    await page.addStyleTag({ content: '#banner{display:none!important}' });
    await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; s.enemies.length = 0; s.projectiles.length = 0; s.coreHp = 1e9; });
    const mawId = await page.evaluate(() => {
      const s = window.broodfall.sim, W = s.cfg.gridW;
      const at = (c) => [c % W, Math.floor(c / W)];
      const d = (c, o) => Math.hypot(at(c)[0] - at(o)[0], at(c)[1] - at(o)[1]);
      const streets = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 && d(c, s.map.coreCell) >= 5 && d(c, s.map.coreCell) <= 11) streets.push(c);
      streets.sort((a, b) => d(a, s.map.coreCell) - d(b, s.map.coreCell));
      const near = streets[2];
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'maw')) cells.push(c);
      cells.sort((a, b) => d(a, near) - d(b, near));
      const cell = cells.find((c) => s.groundFor(c, 'maw', 'S'));
      s.hand[0] = { id: 870001, family: 'maw', free: true };
      const r = s.issue({ kind: 'build', cardIndex: 0, cell });
      return r.ok ? s.towers[s.towers.length - 1].id : -1;
    });
    if (mawId < 0) throw new Error('no Maw built');
    await page.evaluate(() => window.broodfall.step(60));
    const reach = () => page.evaluate((id) => {
      const s = window.broodfall.sim, t = s.towers.find((x) => x.id === id), out = [];
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== 1) continue;
        const p = s.cellCenter(c), dd = Math.hypot(p.x - t.pos.x, p.y - t.pos.y);
        if (dd >= s.cfg.cellPx * 1.1 && dd <= 48) out.push({ c, dd });
      }
      const m = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
      const front = (c) => { const p = s.cellCenter(c); return window.broodfall.worldToScreen(p.x, p.y).y > m.y + 4 ? 1 : 0; };
      const cells = out.sort((a, b) => front(b.c) - front(a.c) || b.dd - a.dd).map((x) => x.c);
      return { cells, front: cells.length ? front(cells[0]) : 0, pos: { x: t.pos.x, y: t.pos.y } };
    }, mawId);
    let found = await reach();
    for (let turn = 0; turn < 3 && !found.front; turn++) { await page.evaluate(() => window.broodfall.turnBy(1)); await page.waitForTimeout(600); found = await reach(); }
    const cells = found.cells.slice(0, 4);
    if (!cells.length) throw new Error('no street in the reach of the Maw');
    const put = (n) => page.evaluate(([cells, n]) => {
      const s = window.broodfall.sim;
      for (let i = 0; i < n; i++) {
        const e = s.spawnEnemy(i % 3 === 2 ? 'militia' : 'soldier', s.gates[0]);
        const c = s.cellCenter(cells[(Math.random() * cells.length) | 0]);
        e.pos.x = c.x + (Math.random() * 10 - 5); e.pos.y = c.y + (Math.random() * 10 - 5);
        e.revealedUntil = s.time + 999; e.hp = 10 + (i % 3) * 4;
        e.speed = 0; e.slowMult = 0; e.slowUntil = s.time + 9999; e.staged = true;
      }
    }, [cells, n]);
    const hold = () => page.evaluate(() => {
      const s = window.broodfall.sim;
      for (const e of s.enemies) { if (!e.staged) { e.speed = 0; e.slowMult = 0; e.slowUntil = s.time + 9999; } e.attackCooldown = 99; }
      return s.enemies.filter((e) => e.staged).length;
    });
    await put(6);
    const ep = await page.evaluate((c) => window.broodfall.sim.cellCenter(c), cells[0]);
    const mid = { x: found.pos.x + (ep.x - found.pos.x) * 0.5, y: found.pos.y + (ep.y - found.pos.y) * 0.5 };
    await artOk(page, 'g-maw');
    await page.evaluate(([m]) => window.__T.camTo(m.x, m.y, 4.4, true), [mid]);
    await page.waitForTimeout(600);
    console.log('  framing:', JSON.stringify(await page.evaluate(([m, e, w]) => {
      const b = window.broodfall, r = b.renderer;
      const sc = (p) => { const s = b.worldToScreen(p.x, p.y); return [Math.round(s.x), Math.round(s.y)]; };
      return { maw: sc(m), victim: sc(e), mid: sc(w), size: [r.app.renderer.width, r.app.renderer.height], zoom: r.zoom, turned: r.turned };
    }, [found.pos, ep, mid])));
    await page.screenshot({ path: path.join(CAP, 'g-maw-debug.jpg') });
    const n = 420;
    let caught = 0, was = false;
    await film(page, ctx, 'g-maw', n, async (i) => {
      if ((await hold()) < 3) await put(3);
      const riding = await page.evaluate(() => window.broodfall.tongues().some((l) => l.riding));
      if (riding && !was) caught++;
      was = riding;
      await page.evaluate(([m, z, snap]) => window.__T.camTo(m.x, m.y, z, snap, 170), [ep, 4.0 + 0.4 * (i / n), i === 0]);
    }, { preroll: 30 });
    console.log(`  bodies caught on the tongue while filming: ${caught}`);
    await ctx.close();
  },
  /** The core grows from its third stage into the citadel. */
  'g-core': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=3&auto=1&autostart=1&speed=1&directive=hold&biome=megacity`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 4, 10)));
    await page.evaluate(() => { const s = window.broodfall.sim; s.stats.limbsGrown = Math.max(s.stats.limbsGrown, 18); });
    await page.waitForFunction(() => { const c = window.broodfall.coreStage(); return c && c.stage >= 3 && !c.into; }, null, { timeout: 20000 }).catch(() => {});
    await artOk(page, 'g-core');
    const core = await page.evaluate(() => ({ ...window.broodfall.sim.core }));
    const n = 360;
    await film(page, ctx, 'g-core', n, async (i) => {
      if (i === 40) await page.evaluate(() => { window.broodfall.sim.stats.limbsGrown = Math.max(40, window.broodfall.sim.stats.limbsGrown); });
      await page.evaluate(([c, z, snap]) => window.__T.camTo(c.x, c.y, z, snap, 230), [core, 3.3 - 0.5 * (i / n), i === 0]);
    });
    console.log('  core:', JSON.stringify(await page.evaluate(() => window.broodfall.coreStage())));
    await ctx.close();
  },
  /** A royal and her consort wade into the limbs. */
  'g-boss': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=5&auto=1&autostart=1&speed=1&directive=hold&biome=orthodox`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 7, 15)));
    await page.evaluate(() => { const s = window.broodfall.sim; for (const k of ['royal', 'consort']) { const e = s.spawnEnemy(k, s.gates[0]); e.revealedUntil = s.time + 999; e.hp *= 3; e.maxHp *= 3; } });
    await artOk(page, 'g-boss');
    const n = 420;
    await film(page, ctx, 'g-boss', n, follow(page, n, { z0: 3.0, z1: 3.4, kind: 'royal', every: 10 }), { preroll: 240 });
    await ctx.close();
  },
  /** Late in a run: the whole body grown across its districts; the camera pulls back. */
  'g-late': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=14&auto=1&autostart=1&speed=1&directive=hold&biome=deephive`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 10, 10)));
    await page.waitForFunction(() => window.broodfall.sim.enemies.length >= 8, null, { timeout: 30000 }).catch(() => {});
    await artOk(page, 'g-late');
    const n = 360;
    await film(page, ctx, 'g-late', n, async (i) => page.evaluate(([z, snap]) => window.__T.home(z, snap), [1.55 - 0.55 * Math.sin((Math.PI / 2) * (i / n)), i === 0]));
    await ctx.close();
  },
  /** Limbs in their upgrade looks, firing. */
  'g-looks': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=21&auto=1&autostart=1&speed=1&directive=hold&biome=orient`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 9, 25)));
    await page.waitForFunction(() => window.broodfall.sim.enemies.length >= 10, null, { timeout: 30000 }).catch(() => {});
    const aim = await page.evaluate(() => {
      const b = window.broodfall, s = b.sim;
      const looked = b.limbLooks().filter((l) => l.drawn);
      const pts = looked.map((l) => s.towers.find((t) => t.id === l.id)).filter(Boolean).map((t) => t.pos);
      if (!pts.length) return null;
      let best = pts[0], bn = -1;
      for (const p of pts) { const n = pts.filter((o) => Math.hypot(o.x - p.x, o.y - p.y) < 90).length; if (n > bn) { bn = n; best = p; } }
      const near = pts.filter((o) => Math.hypot(o.x - best.x, o.y - best.y) < 90);
      return { x: near.reduce((a, p) => a + p.x, 0) / near.length, y: near.reduce((a, p) => a + p.y, 0) / near.length, n: near.length, all: looked.length };
    });
    console.log('  looks:', JSON.stringify(aim));
    if (!aim) throw new Error('no limb in an upgrade look');
    await artOk(page, 'g-looks');
    const n = 300;
    await film(page, ctx, 'g-looks', n, async (i) => page.evaluate(([a, z, snap]) => window.__T.camTo(a.x, a.y - 4, z, snap), [aim, 3.3 + 0.4 * (i / n), i === 0]));
    await ctx.close();
  },
  /** Between waves: the district draft (three plates to take next), then the organ stage. */
  'g-draft': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=9&autostart=1&speed=1&directive=hold&biome=suburb`);
    await ready(page); await dress(page);
    const r = await page.evaluate(() => {
      const b = window.broodfall, s = b.sim;
      b.surface();
      for (let round = 0; round < 12 && s.phase !== 'draft' && s.outcome === 'playing'; round++) {
        s.meat.war = Math.max(s.meat.war, 500);
        const cells = b.buildableCells(80);
        let built = 0;
        for (let g = 0; g < 60 && built < 4; g++) {
          if (!s.hand.length) break;
          const cell = cells.find((c) => s.canBuildTower(c, s.hand[0].family));
          if (cell === undefined) { s.issue({ kind: 'discard', cardIndex: 0 }); continue; }
          if (s.issue({ kind: 'build', cardIndex: 0, cell }).ok) built++; else s.issue({ kind: 'discard', cardIndex: 0 });
        }
        s.issue({ kind: 'call-early' });
        const w0 = s.wavesCleared;
        for (let k = 0; k < 8000 && s.phase !== 'draft' && s.wavesCleared === w0 && s.outcome === 'playing'; k++) b.step(1);
        b.surface();
      }
      return { phase: s.phase, waves: s.wavesCleared, towers: s.towers.length };
    });
    console.log('  ', JSON.stringify(r));
    await page.waitForSelector('#draft:not(.hidden)', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    await artOk(page, 'g-draft');
    await film(page, ctx, 'g-draft', 210, null, { preroll: 10 });
    await ctx.close();
  },
  /** The organ stage between waves (the scripted player's board, opened by its own button). */
  'g-organ': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=3&auto=1&autostart=1&speed=1&directive=hold&biome=megacity`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 6, 10)));
    await page.evaluate(() => { const s = window.broodfall.sim; s.meat.war += 300; s.meat.science += 120; });
    await page.waitForFunction(() => window.broodfall.sim.phase !== 'siege', null, { timeout: 90000 }).catch(() => {});
    await page.locator('#open-under').click({ timeout: 5000 }).catch((e) => console.log('  no organ button:', e.message.slice(0, 80)));
    await page.waitForTimeout(1500);
    await film(page, ctx, 'g-organ', 210, null, { preroll: 10 });
    await ctx.close();
  },
  /** The creep spreads: free creep nodes put down one after another past its edge, as a player does. */
  'g-creep': async (browser) => {
    const { ctx, page } = await freshGame(browser);
    await page.goto(`${BASE}?seed=8&auto=1&autostart=1&speed=1&directive=hold&biome=farmland`);
    await ready(page); await dress(page);
    console.log('  ', JSON.stringify(await grow(page, 3, 5)));
    await artOk(page, 'g-creep');
    // Where the nodes go: claimed ground just past the creep, the next always farther from the core.
    const plan = await page.evaluate(() => {
      const s = window.broodfall.sim, W = s.cfg.gridW;
      const core = s.map.coreCell;
      const d = (c) => Math.hypot((c % W) - (core % W), Math.floor(c / W) - Math.floor(core / W));
      const cand = [];
      for (let c = 0; c < s.map.cells.length; c++) if (!s.isCreeped(c) && s.canPlaceNode(c, 3)) cand.push(c);
      cand.sort((a, b) => d(a) - d(b));
      return { first: cand.slice(0, 40), core: s.cellCenter(core) };
    });
    if (!plan.first.length) throw new Error('nowhere to put a node');
    const n = 420;
    let aim = null;
    await film(page, ctx, 'g-creep', n, async (i) => {
      if (i % 50 === 10) {
        const at = await page.evaluate(() => {
          const s = window.broodfall.sim, W = s.cfg.gridW, core = s.map.coreCell;
          const d = (c) => Math.hypot((c % W) - (core % W), Math.floor(c / W) - Math.floor(core / W));
          const cand = [];
          for (let c = 0; c < s.map.cells.length; c++) if (!s.isCreeped(c) && s.canPlaceNode(c, 3)) cand.push(c);
          if (!cand.length) return null;
          // The one farthest out along the side the first went (a front that marches one way).
          window.__dir ??= cand.sort((a, b) => d(a) - d(b))[0];
          const ref = window.__dir;
          cand.sort((a, b) => Math.hypot((a % W) - (ref % W), Math.floor(a / W) - Math.floor(ref / W)) - Math.hypot((b % W) - (ref % W), Math.floor(b / W) - Math.floor(ref / W)) || d(b) - d(a));
          const cell = cand[0];
          s.nodeStock.unshift(s.plainStrain());
          const r = s.issue({ kind: 'place-node', cell, stock: 0 });
          window.__dir = cell;
          return r.ok ? s.cellCenter(cell) : null;
        });
        if (at) aim = aim ? { x: aim.x * 0.5 + at.x * 0.5, y: aim.y * 0.5 + at.y * 0.5 } : { x: (at.x + plan.core.x) / 2, y: (at.y + plan.core.y) / 2 };
      }
      const a = aim ?? plan.core;
      await page.evaluate(([a, z, snap]) => window.__T.camTo(a.x, a.y, z, snap), [a, 2.2, i === 0]);
    }, { preroll: 20 });
    await ctx.close();
  },
  /** The ship's Directive Desk: the planet in 3D, ground held carrying the creep. */
  's-globe': async (browser) => {
    const { ctx, page } = await freshGame(browser, { dpr: 2 });
    await page.goto(`${BASE}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 240000 });
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
      s.held = [...new Set([...(s.held ?? []), 'crash-site', 'cul-de-sac', 'granary'])];
      s.underAttack = 'granary';
      localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    });
    await page.goto(`${BASE}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 240000 });
    await page.locator('[data-room="desk"]').click();
    await page.waitForSelector('.globe-box.g3d canvas.globe-3d', { timeout: 20000 });
    await page.waitForTimeout(2500);
    const box = await page.locator('.globe-box').boundingBox();
    fs.writeFileSync(path.join(CAP, 's-globe.json'), JSON.stringify({ box, vw: 1920, vh: 1080, dpr: 2 }));
    await film(page, ctx, 's-globe', 360, null, { preroll: 20, quality: 90 });
    await ctx.close();
  },
};

if (cmd === 'capture') {
  await withGame(async (browser) => {
    for (const [id, run] of Object.entries(SHOTS)) {
      if (!on(id)) continue;
      console.log(`capture ${id}`);
      try { await run(browser); } catch (e) { console.log(`  ${id} FAILED: ${e.message}`); }
    }
  });
}

// ------------------------------------------------------------------ GEN: new moving pictures, YOKE's voice
/** The faction calls' own pictures (content/campaign.ts scene `picture`), made to move. No lettering, no symbols. */
const TAIL = 'One continuous shot, no cuts. It keeps the same look, light and grain throughout. The insect people keep their insect heads and the same bodies in every frame; nothing morphs or duplicates. No text, letters or writing appear anywhere. No religious symbol of any kind.';
export const GEN_CLIPS = {
  'faithful-contact': { from: 'art-src/ship/scenes/faithful-contact.png',
    clip: 'Through the studio glass the robed preacher at the big ribbon microphone throws up his hands and preaches with fervour; the engineer in the foreground turns a dial on the glowing valve console; the red on-air lamp glows; the radio mast beyond the window blinks. The camera pushes in slowly.' },
  'institute-contact': { from: 'art-src/ship/scenes/institute-contact.png',
    clip: 'The young insect on the blue beanbag, headphones on, plays a video game with a controller in both hands, then glances up into the camera with a smug little grin; behind him his colleagues hold up their charts and nod eagerly; the satellite dish outside turns a little. The camera pushes in slowly.' },
  'delegation-contact': { from: 'art-src/ship/scenes/delegation-contact.png',
    clip: 'Seen from high above, thousands of tiny figures in the green field hold coloured cards over their heads and flip them in a slow ripple that runs across the field; buses crawl along the road beside it. The camera drifts slowly over the field.' },
};
/** YOKE's lines (her own voice from rfab.ai, Collins's words; content/greetings.ts). */
export const YOKE_LINES = { 'yoke-suck': 'You really suck at genocide.' };

if (cmd === 'gen') {
  const { makeClip, balance } = await import('../art/rfab.mjs');
  const dir = path.join(RAW, 'gen');
  fs.mkdirSync(dir, { recursive: true });
  const before = await balance().catch(() => null);
  for (const [id, c] of Object.entries(GEN_CLIPS)) {
    if (!on(id)) continue;
    const still = path.join(dir, `${id}-169.png`);
    if (!fs.existsSync(still)) ff(['-i', path.join(ROOT, c.from), '-vf', 'crop=iw:iw*9/16:0:(ih-iw*9/16)/2', still], `${id} 16:9`);
    try {
      await makeClip({ slug: `trailer-${id}`, stillFile: still, out: path.join(dir, `${id}-clip.mp4`), prompt: `${c.clip} ${TAIL}`, seconds: 4, loop: false, raw: true, resolution: '720p', aspect: '16:9' });
    } catch (e) { console.log(`  ${id} failed: ${e.message.slice(0, 200)}`); }
  }
  const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'lore', 'yoke-avatar.json'), 'utf8'));
  const vdir = path.join(RAW, 'voice');
  fs.mkdirSync(vdir, { recursive: true });
  for (const [id, text] of Object.entries(YOKE_LINES)) {
    const out = path.join(vdir, `${id}.mp3`);
    if (fs.existsSync(out)) continue;
    const res = await fetch(`https://api.rfab.ai/api/avatars/${ids.avatarId}/speak`, { method: 'POST', headers: { 'X-API-Key': process.env.RFAB_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!res.ok) { console.log(`  ${id}: speak HTTP ${res.status}`); continue; }
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`  ${id}: ${out}`);
  }
  const after = await balance().catch(() => null);
  if (before != null && after != null) console.log(`tokens spent by gen: ${before - after} (${((before - after) / 50000).toFixed(2)} USD)`);
}

// ------------------------------------------------------------------ RECORD: the ship, in real time
/**
 * YOKE's first greeting and the boss's call, as a new player meets them (tools/shot-onboarding.mjs's
 * path): mission 1, lost (forced), CONTINUE, the ship. Her first line is HER voice (art-src/trailer/
 * voice/yoke-suck.mp3, from rfab.ai) served for the first /speak; the rest are a quarter second of
 * silence, so the greeting moves on to the boss's call. Filmed with the page's own screencast (her clips
 * are 24 fps video); every sound start is logged so the edit can lay the sound where it was heard.
 */
async function screencast(page, ctx, id) {
  const dir = path.join(RAW, 'rec', id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    frames.push({ file, ts: f.metadata.timestamp });
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 3840, maxHeight: 2160, everyNthFrame: 1 });
  const wall0 = Date.now() / 1000;
  return {
    wall0,
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      if (frames.length < 2) throw new Error(`${id}: no frames`);
      const list = frames.map((f, i) => `file '${f.file.split(path.sep).join('/')}'\nduration ${Math.max(0.001, (frames[i + 1]?.ts ?? f.ts + 1 / 30) - f.ts).toFixed(4)}`).join('\n');
      fs.writeFileSync(path.join(dir, 'list.txt'), `${list}\nfile '${frames[frames.length - 1].file.split(path.sep).join('/')}'\n`);
      const mp4 = path.join(RAW, 'rec', `${id}.mp4`);
      ff(['-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=60,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', mp4], `${id} encode`);
      console.log(`  recorded ${mp4} (${frames.length} frames over ${(frames[frames.length - 1].ts - frames[0].ts).toFixed(1)} s)`);
      return { mp4, t0: frames[0].ts };
    },
  };
}

if (cmd === 'record') {
  const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'lore', 'yoke-avatar.json'), 'utf8'));
  const her = fs.readFileSync(path.join(RAW, 'voice', 'yoke-suck.mp3'));
  const mp3 = (args) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args, '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', '-'], { maxBuffer: 1 << 24 }).stdout;
  const silent = mp3(['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.25']);
  // Her line, then a minute of nothing: the greeting holds on her first line while it is filmed frame by frame.
  const herHeld = mp3(['-i', path.join(RAW, 'voice', 'yoke-suck.mp3'), '-af', 'apad=pad_dur=60', '-t', '62']);
  /** A new player: mission 1 lost (forced), the report, CONTINUE: aboard the ship. Returns the page there. */
  async function toTheShip(browser, { dpr, clock, first }) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  page error:', String(e).slice(0, 200)));
    if (clock) await page.addInitScript(CLOCK);
    await page.addInitScript(() => {
      const real = window.fetch.bind(window);
      const enc = new TextEncoder();
      window.fetch = (input, init) => {
        const url = String(input instanceof Request ? input.url : input);
        if (/\/rfab-api\/api\/avatars\/[^/]+\/events$/.test(url)) {
          const body = new ReadableStream({ start(c) { c.enqueue(enc.encode(': open\n\n')); } });
          return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
        }
        return real(input, init);
      };
      localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'avatar', v: 2 }));
      // Every sound started, and when (wall clock), for the edit (on the frozen clock, CLOCK logs them).
      if (window.__clk) return;
      window.__plays = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: String(this.currentSrc || this.src).slice(-60), at: Date.now() / 1000, video: this instanceof HTMLVideoElement }); return play.call(this); };
    });
    let spoken = 0;
    const base = `**/rfab-api/api/avatars/${ids.avatarId}`;
    await page.route(`${base}/history`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turns: [] }) }));
    await page.route(`${base}/message`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }));
    await page.route(`${base}/speak`, (r) => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: spoken++ === 0 ? first : silent }));
    await page.route('**/rfab-api/api/broodfall/**', (r) => r.fulfill({ status: 404, body: '{}' }));
    await page.goto(BASE, { waitUntil: 'load', timeout: 180000 });
    // The first launch ever: the film (skipped, it is in the trailer already), then mission 1.
    await page.waitForSelector('#intro', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 120000 });
    await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('hidden'), null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'lost'; s.events.push({ kind: 'lost' }); window.broodfall.step(1); });
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(1500);
    return { ctx, page };
  }
  await withGame(async (browser) => {
    // YOKE's first line, close, then the boss's call: filmed frame by frame at twice the pixels, on the
    // page's clock (her clips, the call's clip and its captions all follow it; sounds start on it and
    // end on it, unheard: the edit lays the real files where they began).
    if (on('yoke')) {
      const { ctx, page } = await toTheShip(browser, { dpr: 2, clock: true, first: her });
      await page.evaluate(() => window.__freeze());
      await page.locator('#debrief-ship').click();
      const until = async (fn, max, what) => {
        for (let i = 0; i < max; i++) { if (await page.evaluate(fn)) return true; await page.evaluate(() => window.__advance(1000 / 60)); }
        throw new Error(`never: ${what}`);
      };
      await until(() => /suck at genocide/.test(document.querySelector('.cp-icom .cp-talk')?.textContent ?? ''), 1200, 'her first line');
      // A few frames in: her talking clip has begun.
      for (let i = 0; i < 6; i++) await page.evaluate(() => window.__advance(1000 / 60));
      const t0 = await page.evaluate(() => performance.now());
      const box = await page.locator('.cp-icom').boundingBox();
      await film(page, ctx, 'r-yoke', 210, null, { preroll: 0, frozen: true, thaw: false });
      const voiceAt = (await page.evaluate(() => window.__plays)).filter((p) => !p.video && /^b|blob/.test(p.src)).map((p) => p.t)[0];
      // On to the boss: his call opens after her lines; his voice file starts the call.
      await until(() => window.__plays.some((p) => /boss\.mp3/.test(p.src)), 60 * 60, 'the boss calls');
      const tb = await page.evaluate(() => window.__plays.find((p) => /boss\.mp3/.test(p.src)).t);
      const from = 26.6;
      for (let i = 0; i < 60 * 40 && (await page.evaluate(([tb, from]) => performance.now() < tb + from * 1000, [tb, from])); i++) await page.evaluate(() => window.__advance(1000 / 60));
      const tb0 = await page.evaluate(() => performance.now());
      await film(page, ctx, 'r-bosscall', 225, null, { preroll: 0, frozen: true });
      const log = { voiceLead: voiceAt != null ? +((t0 - voiceAt) / 1000).toFixed(3) : null, box, dpr: 2, bossVoiceFrom: +((tb0 - tb) / 1000).toFixed(3) };
      fs.writeFileSync(path.join(CAP, 'r-yoke.json'), JSON.stringify(log, null, 1));
      console.log('  ', JSON.stringify(log));
      await ctx.close();
    }
    // The boss's call, in real time (its captions run on the clock of his voice): the page's screencast.
    if (on('boss')) {
      const { ctx, page } = await toTheShip(browser, { dpr: 1, clock: false, first: her });
      const rec = await screencast(page, ctx, 'r-boss');
      const marks = [];
      await page.locator('#debrief-ship').click();
      const tEnd = Date.now() + 75000;
      let lastCap = '';
      while (Date.now() < tEnd) {
        const st = await page.evaluate(() => ({ talk: document.querySelector('.cp-icom .cp-talk')?.textContent ?? '', boss: !!document.getElementById('boss-call'), cap: document.querySelector('#boss-call .bc-caption')?.textContent ?? '' }));
        const now = Date.now() / 1000;
        if (/suck at genocide/.test(st.talk) && !marks.some((m) => m.k === 'suck')) marks.push({ k: 'suck', at: now });
        if (st.boss && !marks.some((m) => m.k === 'boss')) marks.push({ k: 'boss', at: now });
        if (st.cap && st.cap !== lastCap) { marks.push({ k: 'cap', text: st.cap, at: now }); lastCap = st.cap; }
        if (marks.some((m) => m.k === 'boss') && !st.boss) { marks.push({ k: 'boss-end', at: now }); break; }
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(1500);
      const plays = await page.evaluate(() => window.__plays);
      const { mp4, t0 } = await rec.stop();
      const rel = (at) => +(at - t0).toFixed(3);
      const log = { mp4, marks: marks.map((m) => ({ ...m, t: rel(m.at) })), plays: plays.map((p) => ({ ...p, t: rel(p.at) })) };
      fs.writeFileSync(path.join(RAW, 'rec', 'r-boss.json'), JSON.stringify(log, null, 1));
      await ctx.close();
    }
  });
}

// ------------------------------------------------------------------ TITLES: set in the game's type
/**
 * Every word on screen is type, never the image model's: the film's titles as src/onboard.css sets
 * them (.intro-big Impact cream, .intro-small Georgia italic), the genre line and tagline as
 * tools/promo/compose.mjs sets them (Oswald 700, the logo exactly as src/screens.css .logo-word), the
 * voices' captions in the HUD's Bahnschrift. Transparent PNGs, one set per frame size.
 */
const GENRE = 'TOWER DEFENCE + ROGUELITE + DEEP NARRATIVE LORE';
const TAGLINE = 'GENOCIDE SIMULATOR';
export const CAPTIONS = {
  royal: { who: 'THE CLEARANCE REVIEW', line: 'And here she comes. The royal herself takes the field.' },
  faithful: { who: 'THE VOICE · THE HOUR IS NEAR, ON FORTY STATIONS', line: '…and they said the sign would come from the sky, and brothers and sisters, LOOK UP.' },
  'delegation-1': { who: 'THE FRIENDSHIP DELEGATION, SPELLED OUT IN A FIELD', line: 'We have prepared a summit. There will be snacks.' },
  'delegation-2': { who: 'THE FRIENDSHIP DELEGATION', line: 'You ate the summit.' },
  institute: { who: 'ELI BANKFRIED · THE INSTITUTE FOR LONG-TERM HIVE FLOURISHING', line: 'Our species just built its first real AI models. On the numbers, you are the SAFER apocalypse.' },
  empire: { who: 'THE CLEARANCE REVIEW', line: 'And nothing goes to waste. Nothing at all!' },
  colony: { who: 'THE COMMONWEALTH NEWSREEL', line: 'The Host marches, to take back what is ours!' },
};
const FILM_TITLES = {
  quiet: { big: 'IT WAS A QUIET NIGHT', small: 'in a quiet little town' },
  hungry: { big: 'IT WAS HUNGRY' },
};

function titlePages(W, H) {
  const v = H > W;
  const EMBLEM = `data:image/webp;base64,${fs.readFileSync(path.join(ROOT, 'public', 'art', 'screens', 'emblem.webp')).toString('base64')}`;
  const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=block">';
  const css = `*{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
    .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center}
    .big{font-family:Impact,Haettenschweiler,"Arial Narrow Bold","Arial Black",sans-serif;letter-spacing:.05em;line-height:1;color:#ffe9a8;text-align:center;
      text-shadow:0 0 2px #2a0b00,3px 4px 0 #3a0e04,0 0 30px rgba(255,120,40,.55);transform:skewY(-3deg)}
    .small{margin-top:1.1vh;font-family:Georgia,"Times New Roman",serif;font-style:italic;color:#f7e6c4;text-shadow:0 2px 6px #000}
    .genre{font-family:Oswald,"Arial Narrow",sans-serif;font-weight:700;letter-spacing:.06em;color:#ffd24a;white-space:nowrap;text-shadow:0 2px 0 #1a0604,0 0 16px rgba(0,0,0,.95),0 0 40px rgba(0,0,0,.8)}
    .tag{font-family:Oswald,"Arial Narrow",sans-serif;font-weight:700;letter-spacing:.14em;color:#f4e8c8;text-shadow:0 2px 0 #1a0604,0 0 14px rgba(0,0,0,.9)}
    .plus{color:#ff6a2a}
    .cap{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;padding:0 ${v ? 50 : 180}px}
    .box{display:flex;flex-direction:column;align-items:center;gap:${v ? 10 : 8}px;padding:${v ? '18px 28px' : '14px 30px'};background:rgba(6,5,8,.62);border-radius:6px;box-shadow:0 0 30px rgba(0,0,0,.5)}
    .who{font-family:Bahnschrift,"Segoe UI",sans-serif;font-weight:600;font-size:${v ? 24 : 20}px;letter-spacing:.22em;color:#ffd24a;text-shadow:0 2px 4px #000,0 0 12px #000;text-align:center}
    .line{font-family:Bahnschrift,"Segoe UI",sans-serif;font-size:${v ? 44 : 40}px;line-height:1.25;color:#fff;text-align:center;text-shadow:0 2px 3px #000,0 0 14px rgba(0,0,0,.95),0 0 30px rgba(0,0,0,.7)}
    .logo{display:flex;align-items:center}
    .logo .emb{flex:0 0 auto;width:var(--e);height:var(--e);background:url(${EMBLEM}) center/contain no-repeat;filter:drop-shadow(0 6px 18px rgba(0,0,0,.65))}
    .logo .word{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:var(--w);line-height:.92;letter-spacing:.04em;white-space:nowrap;
      background:linear-gradient(180deg,#ffb347 0%,#ff6a2a 30%,#d22a18 62%,#8e1410 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;transform:skewY(-4deg);padding:.06em .04em .1em}
    .logo .emb + .word{margin-left:calc(var(--e) * -0.24);margin-top:calc(var(--e) * 0.12)}
    .logo.stack{flex-direction:column}.logo.stack .emb + .word{margin-left:0;margin-top:calc(var(--e) * -0.22)}`;
  const logo = (word, emblem, stack) => {
    const rough = (3.5 * word / 104).toFixed(2);
    return `<svg width="0" height="0" style="position:absolute"><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="${(0.045 * 104 / word).toFixed(4)}" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${rough}"/></filter></svg>
      <div class="logo ${stack ? 'stack' : ''}" style="--e:${emblem}px;--w:${word}px"><div class="emb"></div>
      <div class="word" style="filter:url(#rough) drop-shadow(${word * 0.03}px ${word * 0.04}px 0 #1a0604) drop-shadow(0 0 ${word * 0.2}px rgba(255,90,30,.35))">BROODFALL</div></div>`;
  };
  const page = (body) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${css}</style></head><body>${body}</body></html>`;
  const pages = {};
  const bigPx = v ? 76 : 92, smallPx = v ? 34 : 30;
  for (const [id, t] of Object.entries(FILM_TITLES)) {
    pages[`t-${id}`] = page(`<div class="c" style="top:${v ? 20 : 13}%"><div class="big" style="font-size:${bigPx}px">${t.big}</div>${t.small ? `<div class="small" style="font-size:${smallPx}px">${t.small}</div>` : ''}</div>`);
  }
  // The insects' own poster line: the monster picture's title, as big as the film sets anything.
  pages['t-sky'] = page(`<div class="c" style="justify-content:center"><div class="big" style="font-size:${v ? 104 : 150}px;${v ? 'max-width:900px' : ''}">IT CAME FROM<br>THE SKY!</div></div>`);
  // The genre line, built up a word at a time as the game unfolds.
  const gsz = v ? 72 : 96;
  const g = (html) => page(`<div class="c" style="justify-content:center;text-align:center"><div class="genre" style="font-size:${gsz}px;line-height:1.1">${html}</div></div>`);
  pages['g-1'] = g('TOWER DEFENCE');
  pages['g-2'] = g('<span class="plus">+</span> ROGUELITE');
  pages['g-3'] = v ? g('<span class="plus">+</span> DEEP NARRATIVE<br>LORE') : g('<span class="plus">+</span> DEEP NARRATIVE LORE');
  for (const [id, c] of Object.entries(CAPTIONS)) {
    pages[`c-${id}`] = page(`<div class="cap" style="bottom:${v ? 15 : 17}%"><div class="box"><div class="who">${c.who}</div><div class="line">${c.line}</div></div></div>`);
  }
  // The end: the name, the genre line (the loudest words after it), the one tagline.
  const shade = v ? 'background:linear-gradient(0deg,rgba(4,3,6,.92) 0%,rgba(4,3,6,.55) 45%,rgba(4,3,6,.25) 100%)' : 'background:radial-gradient(ellipse at 50% 55%,rgba(4,3,6,.35) 0%,rgba(4,3,6,.8) 70%,rgba(4,3,6,.92) 100%)';
  pages['end-shade'] = page(`<div style="position:absolute;inset:0;${shade}"></div>`);
  pages['end-logo'] = page(`<div class="c" style="justify-content:center;${v ? 'padding-bottom:180px' : 'padding-bottom:130px'}">${logo(v ? 150 : 170, v ? 300 : 280, v)}</div>`);
  pages['end-genre'] = page(`<div class="c" style="justify-content:center;${v ? 'padding-top:640px' : 'padding-top:330px'}"><div class="genre" style="font-size:${v ? 50 : 58}px;text-align:center;${v ? 'white-space:normal;line-height:1.25;max-width:1000px' : ''}">${v ? 'TOWER DEFENCE <span class="plus">+</span> ROGUELITE<br><span class="plus">+</span> DEEP NARRATIVE LORE' : GENRE.replace(/\+/g, '<span class="plus">+</span>')}</div></div>`);
  pages['end-tag'] = page(`<div class="c" style="justify-content:center;${v ? 'padding-top:1010px' : 'padding-top:520px'}"><div class="tag" style="font-size:${v ? 52 : 52}px">${TAGLINE}</div></div>`);
  return pages;
}

if (cmd === 'titles') {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    for (const [W, H, tag] of [[1920, 1080, 'h'], [1080, 1920, 'v']]) {
      const dir = path.join(RAW, 'titles', tag);
      fs.mkdirSync(dir, { recursive: true });
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      for (const [id, html] of Object.entries(titlePages(W, H))) {
        await page.setContent(html, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(dir, `${id}.png`), omitBackground: true });
      }
      await page.close();
      console.log(`  titles ${dir}`);
    }
  } finally { await browser.close(); }
}
