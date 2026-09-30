/**
 * ANIMATION REELS: short videos of the board, to SEE whether the limbs' idles and the core's
 * stages move on their loops (Sep 30 2026). A look-and-report beat: it changes nothing.
 *
 *   limbs   anim-01-limbs-idle-close.mp4  ~15 s: a varied set of limbs on creeped roofs, close,
 *           the camera still, no wave (the growth clock is held back, so only idles play).
 *   core    anim-02-core-stages.mp4       ~20 s: the core idling at each of its 4 stages, close
 *           (the growing clips between stages are cut out).
 *   siege   anim-03-siege.mp4             ~20 s: the scripted player's run in a siege, home zoom:
 *           limbs firing, units walking and dying, the creep pulsing.
 *
 * Frames come from Chrome's own screencast (CDP Page.startScreencast, JPEG q92, every frame),
 * not Playwright's recordVideo (1 Mbit VP8, too soft to judge a 256 px sprite by); ffmpeg lays
 * them on their real timestamps and writes 30 fps H.264.
 *
 *   node tools/shot-anim.mjs [limbs core siege] [--after]   (--after: anim-11/12/13-*-AFTER.mp4; its own dev server on BROODFALL_PORT, default 5317)
 * Videos: notes/screens/2026-09-30/anim-*.mp4. Frames scratch: <os tmp>/broodfall-anim-frames/.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-09-30');
const scratch = join(tmpdir(), 'broodfall-anim-frames'); // thousands of JPEGs: outside the repo
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5317);
const URL0 = `http://localhost:${PORT}/`;
const VW = 1600, VH = 900;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// --after: the reels again after the idles were fixed (anim-11/12/13-*-AFTER.mp4, Sep 30 2026), beside the first ones.
const AFTER = process.argv.includes('--after');
const reel = (n, name) => AFTER ? `anim-${10 + n}-${name}-AFTER.mp4` : `anim-0${n}-${name}.mp4`;
const want = (k) => !only.length || only.includes(k);

/** The limbs of reel 1: fast and slow idles, small and BIG, a spread of looks. */
const LIMBS = ['maw', 'frond', 'spitter', 'lobber', 'ocular', 'impaler', 'prism', 'choir', 'bombard', 'mosaic', 'ember', 'quill'];

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

/** Chrome's screencast: every composited frame as a JPEG with its timestamp. */
async function recorder(page, name) {
  const dir = join(scratch, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let on = false;
  cdp.on('Page.screencastFrame', async (f) => {
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    if (!on) return;
    const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VW, maxHeight: VH, everyNthFrame: 1 });
  return {
    frames,
    start() { on = true; },
    /** Seconds on the screencast's clock (for cutting). */
    now() { return frames.length ? frames[frames.length - 1].t : 0; },
    async stop() { on = false; try { await cdp.send('Page.stopScreencast'); } catch {} },
  };
}

/** Frames → 30 fps H.264, each frame held until the next one came. `keep`: [from, to] windows on the frames' clock. */
function encode(frames, out, keep = null) {
  let list = frames;
  if (keep) list = frames.filter((f) => keep.some(([a, b]) => f.t >= a && f.t < b));
  if (list.length < 2) throw new Error(`too few frames for ${out}`);
  const lines = ['ffconcat version 1.0'];
  // Inside a kept window a frame lasts until the next; across a cut, one frame's length.
  for (let i = 0; i < list.length; i++) {
    const next = list[i + 1];
    let d = next ? next.t - list[i].t : 1 / 30;
    if (keep && next && !keep.some(([a, b]) => list[i].t >= a && next.t < b)) d = 1 / 30;
    d = Math.max(1 / 120, Math.min(0.5, d));
    lines.push(`file '${list[i].file.replace(/\\/g, '/')}'`, `duration ${d.toFixed(5)}`);
  }
  lines.push(`file '${list[list.length - 1].file.replace(/\\/g, '/')}'`);
  const txt = join(dirname(list[0].file), 'list.ffconcat');
  writeFileSync(txt, lines.join('\n'));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', txt,
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${out}: ${r.stderr}`);
  const span = list[list.length - 1].t - list[0].t;
  console.log(`  video ${out}  (${list.length} frames over ${span.toFixed(1)} s of capture, ${(list.length / Math.max(0.01, span)).toFixed(1)} captured fps)`);
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: VW, height: VH } });
  await context.addInitScript(() => {
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 200)));
  return { context, page };
}
const boot = async (page, q) => {
  await page.goto(URL0 + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 60000 });
  await page.waitForTimeout(2500); // the art in
};
/** Hold the growth clock back: the wave never comes (the idles only). */
const holdWave = (page) => page.evaluate(() => {
  window.__hold = setInterval(() => { const s = window.broodfall.sim; if (s.phase === 'growth') s.phaseElapsed = 0; }, 200);
});
/** A caption in the page's corner (it is in the video, and in every frame read afterwards). */
const caption = (page, text) => page.evaluate((t) => {
  let el = document.getElementById('anim-caption');
  if (!el) {
    el = document.createElement('div');
    el.id = 'anim-caption';
    el.style.cssText = 'position:fixed;left:16px;bottom:14px;z-index:99999;font:600 22px/1.2 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.6);padding:6px 12px;border-radius:6px;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = t;
}, text);
/** Zoom in on a world point with the wheel, then drag it to the middle of the view (as shot-core-evo does). */
async function closeOn(page, world, zoom, yFrac = 0.55) {
  const canvas = page.locator('#stage canvas');
  await page.keyboard.press('Home');
  await page.waitForTimeout(300);
  const b = await canvas.boundingBox();
  const where = async () => {
    const at = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), world);
    return { x: b.x + (at.x / at.vw) * b.width, y: b.y + (at.y / at.vh) * b.height };
  };
  let p = await where();
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(600);
  p = await where();
  await page.keyboard.down('Shift');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * yFrac, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.mouse.move(b.x + b.width - 4, b.y + 4); // no hover ring on anything
  await page.waitForTimeout(500);
}
const hideHud = (page) => page.addStyleTag({ content: '#feed, #core-hp-wrap, #view-controls, #hint, #inspect { opacity: 0 !important; }' }).catch(() => {});

const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  if (want('limbs')) {
    console.log('limbs: the idles, close, no wave');
    const { context, page } = await freshPage(browser);
    await boot(page, '?seed=11&autostart=1&speed=1&biome=suburb');
    await holdWave(page);
    // Let the creep spread a while (the wave held back between the chunks), so there are roofs to stand on.
    for (let i = 0; i < 12; i++) await page.evaluate(() => { window.broodfall.sim.phaseElapsed = 0; window.broodfall.step(150); });
    const placed = await page.evaluate((fams) => {
      const s = window.broodfall.sim;
      s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 50;
      const W = s.cfg.gridW;
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c)) cells.push(c);
      const at = (c) => [c % W, Math.floor(c / W)];
      const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      cells.sort((a, b) => d(a) - d(b));
      const taken = [];
      const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
      const out = [];
      for (const family of fams) {
        // Off the core's own square (it would hide what stands behind it), then anywhere.
        const fits = (c) => { const g = s.groundFor(c, family, 'S'); return g !== null && g.every(apart); };
        let cell = cells.find((c) => d(c) >= 2.5 && fits(c));
        if (cell === undefined) cell = cells.find(fits);
        if (cell === undefined) { out.push({ family, err: 'no room' }); continue; }
        const ground = s.groundFor(cell, family, 'S');
        s.hand[0] = { id: 900000 + out.length, family, free: true };
        const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' });
        if (r.ok) { taken.push(...ground); const t = s.towers[s.towers.length - 1]; out.push({ family, x: t.pos.x, y: t.pos.y }); }
        else out.push({ family, err: r.err });
      }
      return out;
    }, LIMBS);
    console.log('  placed: ' + placed.map((p) => p.err ? `${p.family} (${p.err})` : p.family).join(', '));
    await page.evaluate(() => window.broodfall.step(2));
    const ok = placed.filter((p) => !p.err);
    const mid = [ok.reduce((a, p) => a + p.x, 0) / ok.length, ok.reduce((a, p) => a + p.y, 0) / ok.length];
    await hideHud(page);
    await closeOn(page, mid, 6, 0.6);
    // A name tag under each limb, for reading the video.
    await page.evaluate((list) => {
      const box = document.querySelector('#stage canvas').getBoundingClientRect();
      for (const p of list) {
        const at = window.broodfall.worldToScreen(p.x, p.y);
        const el = document.createElement('div');
        el.className = 'anim-tag';
        el.textContent = p.family;
        el.style.cssText = `position:fixed;left:${box.left + (at.x / at.vw) * box.width}px;top:${box.top + (at.y / at.vh) * box.height + 18}px;transform:translateX(-50%);z-index:99998;font:600 15px system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:1px 6px;border-radius:4px;pointer-events:none`;
        document.body.appendChild(el);
      }
    }, ok);
    await caption(page, 'Limb idles, no wave, camera still (1x speed)');
    const rec = await recorder(page, 'limbs');
    await page.waitForTimeout(400);
    rec.start();
    await page.waitForTimeout(15500);
    await rec.stop();
    const phase = await page.evaluate(() => ({ phase: window.broodfall.sim.phase, units: window.broodfall.sim.enemies.length }));
    console.log(`  after: phase ${phase.phase}, units on the board ${phase.units}`);
    encode(rec.frames, join(notes, reel(1, 'limbs-idle-close')));
    await context.close();
  }

  if (want('core')) {
    console.log('core: the four stages idling, close');
    const { context, page } = await freshPage(browser);
    await boot(page, '?seed=11&autostart=1&speed=1&biome=suburb');
    await holdWave(page);
    await page.evaluate(() => window.broodfall.step(3));
    await hideHud(page);
    const core = await page.evaluate(() => [window.broodfall.sim.core.x, window.broodfall.sim.core.y]);
    await closeOn(page, core, 7, 0.62);
    const rec = await recorder(page, 'core');
    await page.waitForTimeout(400);
    rec.start();
    const keep = [];
    const idleFor = async (stage, secs) => {
      await caption(page, `Core stage ${stage} idle`);
      await page.waitForTimeout(250);
      const a = rec.now();
      await page.waitForTimeout(secs * 1000);
      keep.push([a, rec.now()]);
    };
    await idleFor(1, 5);
    for (const [into, grown] of [[2, 6], [3, 18], [4, 40]]) {
      await caption(page, `(growing into stage ${into})`);
      await page.evaluate((g) => { window.broodfall.sim.stats.limbsGrown = g; }, grown);
      await page.waitForFunction((k) => { const c = window.broodfall.coreStage(); return c.stage === k && c.into === 0; }, into, { timeout: 15000 });
      // The taller stages need the view pulled back and lowered to stand whole in it (cut out of the reel).
      const [zoom, y] = { 2: [7, 0.64], 3: [6, 0.74], 4: [5, 0.76] }[into];
      await closeOn(page, core, zoom, y);
      await idleFor(into, 5);
    }
    await rec.stop();
    encode(rec.frames, join(notes, reel(2, 'core-stages')), keep);
    await context.close();
  }

  if (want('siege')) {
    console.log('siege: the scripted player in a wave, home zoom');
    const { context, page } = await freshPage(browser);
    await boot(page, '?seed=3&autostart=1&auto=1&speed=0&biome=megacity&directive=hold');
    // Play on (fast, unseen) until a later siege with limbs up and units in the street.
    let st;
    for (let i = 0; i < 400; i++) {
      st = await page.evaluate(() => {
        const bf = window.broodfall;
        bf.step(40);
        const s = bf.sim;
        return { phase: s.phase, wave: s.waveNumber, towers: s.towers.length, units: s.enemies.length, outcome: s.outcome, pending: s.spawnQueue?.length ?? 0 };
      });
      if (st.outcome !== 'playing') break;
      if (st.phase === 'siege' && st.wave >= 4 && st.towers >= 8 && st.units >= 8 && st.pending >= 10) break;
    }
    console.log('  state: ' + JSON.stringify(st));
    // The clock runs at 1x from here: what a player sees.
    await page.evaluate(() => { window.broodfall.surface?.(); const b = document.querySelector('#speed-box button[data-speed="1"]'); if (b) b.click(); });
    // A player's zoom (three notches in from Home), on where the wave meets the limbs.
    const fight = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const pts = [...s.enemies.map((e) => e.pos), ...s.towers.map((t) => t.pos)];
      return [pts.reduce((a, p) => a + p.x, 0) / pts.length, pts.reduce((a, p) => a + p.y, 0) / pts.length];
    });
    await closeOn(page, fight, 3, 0.5);
    await page.waitForTimeout(700);
    const speedOk = await page.evaluate(async () => { const t0 = window.broodfall.sim.time; await new Promise((r) => setTimeout(r, 1000)); return window.broodfall.sim.time - t0; });
    console.log(`  sim seconds per real second: ${speedOk.toFixed(2)}`);
    const rec = await recorder(page, 'siege');
    await page.waitForTimeout(400);
    rec.start();
    await page.waitForTimeout(20500);
    await rec.stop();
    encode(rec.frames, join(notes, reel(3, 'siege')));
    await context.close();
  }
} finally {
  await browser.close();
  dev.kill();
  freePort();
}
