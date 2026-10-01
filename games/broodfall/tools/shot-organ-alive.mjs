/**
 * THE ORGAN STAGE ALIVE (Collins, Sep 30 2026: "should the organ screen have them alive? ... yeah").
 * In the real page (vite dev server on its own port, GPU on): a busy organ stage, every organ
 * that fits grown around the meteor, opened by the real button. Checks every placed organ cell
 * (and the meteor, and the dome above the street) plays its loop strip, organs in the tray stay
 * still, a freshly grown organ scans in first and then loops from its first frame, no page errors,
 * no "did not load" line. Measures the frame rate with the loops playing and with them stopped.
 *
 * Writes notes/screens/2026-09-30/organ-alive-stage.jpg (the panel), organ-alive-a.jpg /
 * organ-alive-b.jpg (the same close crop 0.6 s apart), organ-alive-core.jpg (the meteor), and
 * organ-alive.mp4 (10 s of the stage, real time, from the browser's recording of the page).
 *
 *   node tools/shot-organ-alive.mjs [--no-video]
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const screens = join(root, 'notes', 'screens', '2026-09-30');
const PORT = Number(process.env.BROODFALL_PORT || 5337);
const args = process.argv.slice(2);
const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : null;
let failed = 0;
const check = (ok, name) => { if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); };

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
function serve() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}
const jpg = (png, name) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, name)]);

const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const tmp = fs.mkdtempSync(join(tmpdir(), 'organ-alive-'));
try {
  const video = !args.includes('--no-video');
  // --tag: the page at twice the pixels (as on a laptop's high-density screen), for the close video.
  const D = tag ? 2 : 1;
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: D, ...(video ? { recordVideo: { dir: tmp, size: { width: 1600, height: 1000 } } } : {}) });
  const recordFrom = Date.now();
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?seed=7&autostart=1&speed=0&biome=suburb`, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForSelector('#stage canvas', { timeout: 300000 }).catch(async (e) => {
    await page.screenshot({ path: join(tmp, 'boot.png') });
    jpg(join(tmp, 'boot.png'), 'organ-alive-boot-failed.jpg');
    throw new Error(`the game did not boot (${errors.join(' | ') || 'no page error'}): ${(await page.locator('body').innerText()).slice(0, 400)}`, { cause: e });
  });
  // A busy stage: every organ that fits, over and over, around the meteor; the core at its third stage.
  const grown = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 99999; s.meat.science = 99999;
    s.cfg.organPool = undefined;
    s.stats.limbsGrown = 20;
    const ids = ['forge', 'venom', 'gut', 'nerve', 'lattice', 'womb', 'marrow', 'resonance', 'heart', 'brain', 'gland', 'atrophy',
      'bladder', 'pacemaker', 'budder', 'cyst', 'swell', 'catapult', 'runner', 'mire', 'acid', 'seeder', 'scaffold', 'root'];
    const u = s.under;
    for (let pass = 0; pass < 2; pass++) for (const id of ids) {
      if (pass && (id === 'heart' || id === 'brain')) continue;
      let done = false;
      for (let c = 0; c < u.cells.length && !done; c++) for (let r = 0; r < 4 && !done; r++) {
        if (s.canBuildOrgan(id, c, r) && s.issue({ kind: 'build-organ', organ: id, cell: c, rot: r }).ok) done = true;
      }
    }
    return { organs: s.organs.length, kinds: [...new Set(s.organs.map((o) => o.organ))] };
  });
  console.log(`  grew ${grown.organs} organs of ${grown.kinds.length} kinds: ${grown.kinds.join(', ')}`);
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)');
  await page.waitForFunction(() => document.querySelectorAll('#under-grid .uc.alive').length > 0, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => {
    const organCells = [...document.querySelectorAll('#under-grid .uc.has-organ')];
    const still = organCells.filter((c) => !c.classList.contains('alive')).map((c) => c.dataset.cell);
    // The living tiles are drawn on one canvas under the cells: every alive cell carries its loop for it.
    const canvas = document.querySelector('#under-scanbox canvas.under-alive');
    const grid = document.getElementById('under-grid');
    const sized = !!canvas && Math.abs(canvas.getBoundingClientRect().width - grid.clientWidth) < 2 && canvas.width > 0;
    const running = sized ? [...document.querySelectorAll('#under-grid .uc.alive')].filter((c) => c.dataset.loop).length : 0;
    const meteor = document.querySelector('#under-grid .meteor-img.alive');
    const dome = document.getElementById('under-dome');
    const trayAlive = document.querySelectorAll('#under-palette .alive').length;
    const strips = new Set([...document.querySelectorAll('#under .alive')].map((e) => getComputedStyle(e).backgroundImage));
    return {
      organCells: organCells.length, still, alive: document.querySelectorAll('#under-grid .uc.alive').length, running,
      meteor: !!meteor, meteorRunning: !!meteor?.getAnimations().some((a) => a.animationName === 'uloop'),
      dome: dome?.classList.contains('alive') ?? false, trayAlive, strips: strips.size,
      banner: (document.body.innerText.split(/\r?\n/).find((l) => /did not load/i.test(l)) ?? '') + (document.getElementById('art-notice')?.title ? ` [${document.getElementById('art-notice').title}]` : ''),
    };
  });
  console.log(`  ${JSON.stringify(state)}`);
  check(state.organCells > 40 && state.still.length === 0, `every placed organ cell plays its loop (${state.organCells} organ cells, still: ${state.still.join(',') || 'none'})`);
  check(state.running === state.alive, `every alive cell is drawn by the stage's canvas (${state.running}/${state.alive})`);
  check(state.meteor && state.meteorRunning && state.dome, 'the meteor below the street and its dome above play their stage loop');
  check(state.trayAlive === 0, 'the organs in the tray stay still');
  check(!state.banner, `no "did not load" line${state.banner ? `: ${state.banner}` : ''}`);

  // An organ of several cells is ONE picture cut on the grid (Oct 1 2026): every cell of it carries its piece of
  // the whole organ's loop, and at any moment all of them show the same frame. Sampled 12 times, 170 ms apart.
  const sameFrame = { samples: 0, organs: 0, split: [], uncut: [], turned: 0, moved: 0 };
  let lastFrames = null;
  for (let k = 0; k < 12; k++) {
    const r = await page.evaluate(() => {
      const cv = document.querySelector('canvas.under-alive');
      const fr = cv?.alive?.frames() ?? [];
      const sim = window.broodfall.sim;
      const multi = sim.organs.filter((o) => o.cells.length > 1);
      const by = new Map();
      for (const f of fr) if (f.organ >= 0) (by.get(f.organ) ?? by.set(f.organ, []).get(f.organ)).push(f);
      return {
        organs: multi.length,
        split: multi.filter((o) => new Set((by.get(o.id) ?? []).map((f) => f.frame)).size !== 1 || (by.get(o.id) ?? []).length !== o.cells.length).map((o) => `${o.organ}#${o.id}`),
        uncut: multi.filter((o) => (by.get(o.id) ?? []).some((f) => !f.cut)).map((o) => o.organ),
        turned: multi.filter((o) => o.rot % 4).length,
        frames: Object.fromEntries(multi.map((o) => [o.id, by.get(o.id)?.[0]?.frame ?? -1])),
      };
    });
    sameFrame.samples++;
    sameFrame.organs = r.organs;
    sameFrame.turned = r.turned;
    sameFrame.split.push(...r.split);
    sameFrame.uncut.push(...r.uncut);
    if (lastFrames) sameFrame.moved += Object.keys(r.frames).filter((id) => r.frames[id] !== lastFrames[id]).length;
    lastFrames = r.frames;
    await page.waitForTimeout(170);
  }
  console.log(`  whole shapes: ${sameFrame.organs} organs of several cells (${sameFrame.turned} turned), ${sameFrame.samples} samples, frame changes seen ${sameFrame.moved}`);
  check(sameFrame.organs > 15 && sameFrame.uncut.length === 0, `every organ of several cells plays its WHOLE-shape loop cut into its cells${sameFrame.uncut.length ? ` (by tile: ${[...new Set(sameFrame.uncut)].join(', ')})` : ''}`);
  check(sameFrame.split.length === 0 && sameFrame.moved > 0, `all the cells of one organ always show the same frame (${sameFrame.split.length ? `split: ${[...new Set(sameFrame.split)].join(', ')}` : 'never split'}), and the frames move`);

  // Two frames of the same crop 0.6 s apart: the tissue moves.
  const grid = page.locator('#under-scanbox');
  await page.locator('#under').screenshot({ path: join(tmp, 'stage.png') });
  jpg(join(tmp, 'stage.png'), 'organ-alive-stage.jpg');
  await grid.screenshot({ path: join(tmp, 'a.png') });
  await page.waitForTimeout(600);
  await grid.screenshot({ path: join(tmp, 'b.png') });
  jpg(join(tmp, 'a.png'), 'organ-alive-a.jpg');
  jpg(join(tmp, 'b.png'), 'organ-alive-b.jpg');
  const a = fs.readFileSync(join(tmp, 'a.png')), b = fs.readFileSync(join(tmp, 'b.png'));
  check(!a.equals(b), 'the stage changes between two screenshots 0.6 s apart');
  const box = await page.evaluate(() => {
    const m = document.querySelector('#under-grid .meteor-img')?.getBoundingClientRect();
    const d = document.getElementById('under-dome')?.getBoundingClientRect();
    if (!m || !d) return null;
    const x = Math.min(m.left, d.left) - 20, y = d.top - 10;
    return { x, y, width: Math.max(m.right, d.right) + 20 - x, height: m.bottom + 10 - y };
  });
  if (box) { await page.screenshot({ path: join(tmp, 'core.png'), clip: box }); jpg(join(tmp, 'core.png'), 'organ-alive-core.jpg'); }

  // A freshly grown organ scans in first, then loops from its first frame. One of several cells, when there is
  // room for one, scans in as its pieces of the whole organ's still (the loop's first frame), then plays the loop.
  const fresh = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (const id of ['swell', 'acid', 'mire', 'root', 'cyst', 'pacemaker', 'gland']) for (let c = 0; c < s.under.cells.length; c++) {
      for (let r = 0; r < 4; r++) if (s.canBuildOrgan(id, c, r) && s.issue({ kind: 'build-organ', organ: id, cell: c, rot: r }).ok) return s.organs[s.organs.length - 1].cells[0];
    }
    return null;
  });
  if (fresh !== null) {
    await page.waitForTimeout(120);
    const look = (c) => page.evaluate((c) => {
      const el = document.querySelector(`#under-grid [data-cell="${c}"]`);
      return { cls: el?.className ?? '', cut: !!el?.querySelector('.shape-cut'), oid: el?.dataset.oid };
    }, c);
    const during = await look(fresh);
    await page.waitForTimeout(1600);
    const after = await look(fresh);
    const multi = await page.evaluate((c) => window.broodfall.sim.organAt(c).cells.length > 1, fresh);
    check(/scan-in/.test(during.cls) && !/alive/.test(during.cls) && /alive/.test(after.cls) && (!multi || (during.cut && !after.cut)),
      `a new organ scans in, then loops ("${during.cls.match(/scan-in|alive/g)}" -> "${after.cls.match(/scan-in|alive/g)}"${multi ? `; of several cells: scans in as its piece of the whole ${during.cut ? 'yes' : 'NO'}` : ''})`);
  } else console.log('  (no room left for a fresh organ: scan-in then loop not checked here)');

  // Frame rate: the loops playing, and the same stage with them stopped.
  const fps = (ms) => page.evaluate((ms) => new Promise((res) => {
    let n = 0; const t0 = performance.now(); const gaps = []; let last = t0;
    const tick = (t) => { n++; gaps.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(tick); else res({ fps: (n * 1000) / (t - t0), worst: Math.max(...gaps.slice(1)) }); };
    requestAnimationFrame(tick);
  }), ms);
  // Alternated (on, off, on, off...) so the machine's own load, which other sessions change, falls on both alike.
  const freeze = (yes) => page.evaluate((y) => {
    let el = document.getElementById('freeze-loops');
    if (y && !el) { el = document.createElement('style'); el.id = 'freeze-loops'; el.textContent = '#under .alive { animation-play-state: paused !important; }'; document.head.appendChild(el); }
    if (!y) el?.remove();
    const cv = document.querySelector('canvas.under-alive');
    if (cv) { if (y) cv.dataset.frozen = '1'; else delete cv.dataset.frozen; }
  }, yes);
  const runs = { on: [], off: [] };
  // And the page's own main-thread work per second (CDP TaskDuration), which other sessions' load inflates far less than the frame rate.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const task = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value;
  for (let k = 0; k < 4; k++) for (const mode of ['on', 'off']) {
    await freeze(mode === 'off');
    const t0 = await task(), w0 = Date.now();
    const r = await fps(3000);
    r.busy = ((await task()) - t0) / ((Date.now() - w0) / 1000);
    runs[mode].push(r);
  }
  await freeze(false);
  const avg = (rs) => ({ fps: rs.reduce((a, r) => a + r.fps, 0) / rs.length, worst: Math.max(...rs.map((r) => r.worst)), busy: rs.reduce((a, r) => a + r.busy, 0) / rs.length });
  const on = avg(runs.on), off = avg(runs.off);
  console.log(`  FPS with the loops: ${on.fps.toFixed(1)} (worst frame ${on.worst.toFixed(0)} ms); loops stopped: ${off.fps.toFixed(1)} (worst ${off.worst.toFixed(0)} ms); runs on ${runs.on.map((r) => r.fps.toFixed(0)).join('/')} off ${runs.off.map((r) => r.fps.toFixed(0)).join('/')}`);
  console.log(`  main thread busy: ${(on.busy * 100).toFixed(1)}% of each second with the loops, ${(off.busy * 100).toFixed(1)}% without`);
  check(on.fps >= 55 || on.fps >= off.fps - 3 || on.busy - off.busy < 0.05, 'the loops cost the page no visible frame rate (or under 5% of the main thread when the machine is loaded)');

  if (!args.includes('--no-video')) {
    // About 10 s of the stage in real time: the browser's own recording of the page, cut to the stage.
    const box = await page.locator('#under').boundingBox();
    const near = await page.locator('#under-scanbox').boundingBox();
    const from = (Date.now() - recordFrom) / 1000;
    // --tag: 10 s close on the scan's grid instead, to see the motion cross the cells: the page (at twice the
    // pixels) pinch-zoomed 2x on the right part of the grid, where the shapes crowd round the meteor, and the
    // browser's screencast of it, each frame at the time it was painted.
    const shots = [];
    let roi = null;
    if (tag && near) {
      const x0 = near.x + near.width * 0.42, y0 = Math.max(0, near.y - 4);
      const x1 = near.x + near.width, y1 = Math.min(1000, near.y + near.height + 4);
      // Pinch about the point that the region's centre lands on in the 2x view, so the whole region shows.
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const px = Math.min(1599, Math.max(0, 2 * cx - 800)), py = Math.min(999, Math.max(0, 2 * cy - 500));
      await cdp.send('Input.synthesizePinchGesture', { x: px, y: py, scaleFactor: 2, relativeSpeed: 3000 });
      await page.waitForTimeout(400);
      const vv = await page.evaluate(() => ({ s: visualViewport.scale, l: visualViewport.offsetLeft, t: visualViewport.offsetTop }));
      const fx = Math.max(0, Math.round((x0 - vv.l) * vv.s)), fy = Math.max(0, Math.round((y0 - vv.t) * vv.s));
      roi = { x: fx, y: fy, w: Math.floor(Math.min(1600 - fx, (x1 - x0) * vv.s) / 2) * 2, h: Math.floor(Math.min(1000 - fy, (y1 - y0) * vv.s) / 2) * 2 };
      console.log(`  close view: pinch ${vv.s.toFixed(2)}x at (${vv.l.toFixed(0)}, ${vv.t.toFixed(0)}), region ${JSON.stringify(roi)}`);
      cdp.on('Page.screencastFrame', (f) => {
        shots.push({ t: f.metadata.timestamp, data: f.data });
        void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1600, maxHeight: 1000, everyNthFrame: 1 });
    }
    await page.waitForTimeout(10500);
    if (tag) await cdp.send('Page.stopScreencast');
    const video = page.video();
    await page.close();
    const raw = await video.path();
    const crop = `crop=${Math.floor(box.width / 2) * 2}:${Math.floor(Math.min(box.height, 1000 - box.y) / 2) * 2}:${Math.round(box.x)}:${Math.round(box.y)}`;
    if (!tag) {
      spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', from.toFixed(2), '-t', '10', '-i', raw,
        '-vf', crop, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', join(screens, 'organ-alive.mp4')]);
      console.log(`  video: 10 s from ${from.toFixed(1)} s into the recording -> ${join(screens, 'organ-alive.mp4')}`);
    }
    if (roi && shots.length > 10) {
      const dir = join(tmp, 'cast');
      fs.mkdirSync(dir, { recursive: true });
      const list = [];
      shots.forEach((f, i) => {
        const file = join(dir, `${String(i).padStart(5, '0')}.jpg`);
        fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
        const next = shots[i + 1]?.t ?? f.t + 1 / 30;
        list.push(`file '${file.split(String.fromCharCode(92)).join('/')}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
      });
      fs.writeFileSync(join(dir, 'list.txt'), list.join(String.fromCharCode(10)));
      const out = join(screens, `organ-shape-${tag}.mp4`);
      const span = shots[shots.length - 1].t - shots[0].t;
      spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
        '-vf', `crop=${roi.w}:${roi.h}:${roi.x}:${roi.y},fps=30`, '-t', '10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', out]);
      console.log(`  close video: ${shots.length} painted frames over ${span.toFixed(1)} s -> ${out}`);
    }
  }
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `ORGAN ALIVE: ${failed} failed` : 'ORGAN ALIVE: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
