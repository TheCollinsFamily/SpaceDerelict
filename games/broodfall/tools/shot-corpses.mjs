/**
 * THE CREEP DIGESTS THE DEAD (Oct 1 2026; src/sim/types.ts Corpse, src/render/corpseFx.ts), seen in the real
 * game. Collins: "have a death image of the unit, then it dissolving, then gone ... and have corpses pile up
 * where there is no creep, then dissolve when the creep reaches them."
 *   A  three bodies fall ON the creep: their fall, they lie, they dissolve, their meat is banked, gone.
 *   B  six bodies (a science one among them) fall just PAST the creep's edge: they lie there, glinting with
 *      unclaimed meat, and nothing is banked; then the creep reaches them and they dissolve and pay.
 *   C  forty bodies dropped on one street cell: they heap (the cell's cap), and the heap keeps all their meat.
 * Pictures and videos: notes/screens/2026-10-01/corpses-*. Checks print PASS/FAIL; exit 1 on a failure.
 *   node tools/shot-corpses.mjs          (starts its own dev server on BROODFALL_PORT, default 5343)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = Number(process.env.BROODFALL_PORT || 5343);
const notes = join(root, 'notes', 'screens', '2026-10-01');
const scratch = join(root, 'tools', 'screenshots', 'corpses');
const VW = 1600, VH = 1000;
mkdirSync(notes, { recursive: true });
mkdirSync(scratch, { recursive: true });

try {
  const txt = execSync('netstat -ano', { encoding: 'utf8' });
  for (const line of txt.split(String.fromCharCode(10))) {
    const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
    if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
  }
} catch {}
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});

let failed = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failed++; };

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
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: VW, maxHeight: VH, everyNthFrame: 1 });
  return { frames, start() { on = true; }, async stop() { on = false; try { await cdp.send('Page.stopScreencast'); } catch {} } };
}
function encode(frames, out) {
  if (frames.length < 2) throw new Error(`too few frames for ${out}`);
  const lines = ['ffconcat version 1.0'];
  for (let i = 0; i < frames.length; i++) {
    const next = frames[i + 1];
    const d = Math.max(1 / 120, Math.min(0.5, next ? next.t - frames[i].t : 1 / 30));
    lines.push(`file '${frames[i].file.replace(/\\/g, '/')}'`, `duration ${d.toFixed(5)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  const txt = join(dirname(frames[0].file), 'list.ffconcat');
  writeFileSync(txt, lines.join('\n'));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', txt,
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${out}: ${r.stderr}`);
  console.log(`  video ${out} (${frames.length} frames, ${(frames[frames.length - 1].t - frames[0].t).toFixed(1)} s)`);
}
async function shot(page, name) {
  const file = join(notes, `${name}.jpg`);
  const png = join(scratch, `${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', file]);
  console.log(`  ${file}`);
}
/** Sim time passes at 10 Hz while the page draws: `secs` of it, one tick each 100 ms. */
async function play(page, secs) {
  for (let i = 0; i < Math.round(secs * 10); i++) {
    await page.evaluate(() => window.broodfall.step(1));
    await page.waitForTimeout(100);
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0&biome=suburb`);
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });
  // A board a little way in: the creep out over some streets. The field is then cleared for the beats.
  const setup = await page.evaluate(() => {
    const b = window.broodfall; const s = b.sim;
    for (let i = 0; i < 400 && s.outcome === 'playing'; i += 50) { b.surface(); b.step(50); }
    s.enemies.length = 0; s.corpses.length = 0;
    s.coreHp = 1e9;
    const W = s.cfg.gridW;
    const street = (c) => s.map.cells[c] === 1 || s.map.cells[c] === 2;
    const core = s.cellCenter(s.map.coreCell);
    const byDist = (cells) => cells.sort((a, b2) => { const p = s.cellCenter(a), q = s.cellCenter(b2); return Math.hypot(p.x - core.x, p.y - core.y) - Math.hypot(q.x - core.x, q.y - core.y); });
    const on = byDist([...Array(s.map.cells.length).keys()].filter((c) => street(c) && s.isCreeped(c) && !s.isOccupied(c)));
    // Just past the edge: a street cell off the creep beside a creeped one (by the core's own creep).
    const range = s.creepRangeCells;
    const dist = s.creepDist;
    const off = byDist([...Array(s.map.cells.length).keys()].filter((c) => street(c) && !s.isCreeped(c) && dist[c] === range + 1));
    return { on: on.slice(4, 5), off: off.slice(0, 1), range, W };
  });
  check(setup.on.length === 1 && setup.off.length === 1, 'found a creeped street and one just past the edge', JSON.stringify(setup));
  const centre = async (cell, zoom) => {
    await page.evaluate(([c, z]) => {
      const b = window.broodfall; const r = b.renderer; const s = b.sim;
      r.zoom = z; r.pan = { x: 0, y: 0 }; r.camInit = false; b.step(0);
      const at = s.cellCenter(c); const p = b.worldToScreen(at.x, at.y);
      r.panBy(p.vw / 2 - p.x, p.vh / 2 - p.y); r.camInit = false; b.step(0);
    }, [cell, zoom]);
    await page.waitForTimeout(500);
  };
  const spawnAt = (cell, kinds) => page.evaluate(([c, ks]) => {
    const b = window.broodfall; const s = b.sim; const at = s.cellCenter(c);
    return ks.map((k, i) => {
      const e = s.spawnEnemy(k, s.gates[0]);
      e.pos = { x: at.x + ((i % 3) - 1) * 7, y: at.y + ((Math.floor(i / 3) % 2) - 0.5) * 7 };
      e.speed = 0; e.frozenUntil = 1e9; e.stunUntil = 1e9;
      return e.id;
    });
  }, [cell, kinds]);
  const kill = (ids) => page.evaluate((list) => { const s = window.broodfall.sim; for (const id of list) s.killEnemy(id, 1, false); }, ids);
  const state = () => page.evaluate(() => {
    const s = window.broodfall.sim; const r = window.broodfall.renderer;
    return { meat: { ...s.meat }, digested: { ...s.digested }, corpses: s.corpses.map((c) => ({ id: c.id, digest: c.digest ?? null, heap: c.heap ?? 1, meat: c.meat })), unclaimed: s.unclaimedMeat(), bodies: r.dyingNow() };
  });

  // A: on the creep.
  console.log('A: bodies fall on the creep and dissolve');
  await centre(setup.on[0], 3);
  const a = await spawnAt(setup.on[0], ['soldier', 'researcher', 'militia']);
  await page.waitForTimeout(600);
  const before = await state();
  let rec = await recorder(page, 'a');
  rec.start();
  await kill(a);
  await page.waitForTimeout(250); await shot(page, 'corpses-a1-falling');
  await play(page, 0.9); await shot(page, 'corpses-a2-dissolving');
  const mid = await state();
  await play(page, 1.0); await shot(page, 'corpses-a3-nearly-gone');
  await play(page, 1.2);
  const after = await state();
  await page.waitForTimeout(500);
  await rec.stop();
  encode(rec.frames, join(notes, 'corpses-a-on-creep.mp4'));
  check(mid.corpses.length === 3 && mid.corpses.every((c) => c.digest !== null), 'on the creep the bodies are being digested', JSON.stringify(mid.corpses.map((c) => c.digest)));
  check(mid.bodies.some((d) => d.prog > 0.05), 'the bodies are dissolving on screen', JSON.stringify(mid.bodies.map((d) => d.prog.toFixed(2))));
  check(after.corpses.length === 0, 'then they are gone from the sim');
  const gained = ['war', 'science', 'royal'].map((k) => after.meat[k] - before.meat[k]);
  check(gained[0] > 0 && gained[1] > 0, 'their meat is banked (war and science)', gained.join('/'));

  // B: just past the edge.
  console.log('B: bodies fall past the creep, lie unclaimed, then the creep reaches them');
  await centre(setup.off[0], 2.4);
  const bIds = await spawnAt(setup.off[0], ['soldier', 'researcher', 'militia', 'researcher', 'elite', 'responder']);
  await page.waitForTimeout(600);
  const b0 = await state();
  rec = await recorder(page, 'b');
  rec.start();
  await kill(bIds);
  await play(page, 3);
  await shot(page, 'corpses-b1-lying-unclaimed');
  const lying = await state();
  check(lying.corpses.length >= 2 && lying.corpses.every((c) => c.digest === null), 'off the creep they lie and wait', `${lying.corpses.length} corpses (heaped past 4 in a cell)`);
  check(['war', 'science', 'royal'].every((k) => lying.digested[k] === b0.digested[k]), 'nothing is banked while they lie', JSON.stringify(lying.digested));
  check(lying.unclaimed.science > 0, 'a science body\'s meat lies unclaimed', JSON.stringify(lying.unclaimed));
  // The creep reaches them (its reach one cell longer, as an organ or a node would make it).
  await page.evaluate((r) => { const s = window.broodfall.sim; Object.defineProperty(s, 'creepRangeCells', { get: () => r + 2, configurable: true }); window.broodfall.renderer.creepState.fill(65535); }, setup.range);
  await play(page, 0.4); await page.waitForTimeout(200);
  await shot(page, 'corpses-b2-creep-arrives');
  await play(page, 1.3); await shot(page, 'corpses-b3-dissolving');
  await play(page, 1.6);
  const b2 = await state();
  await page.waitForTimeout(600);
  await rec.stop();
  encode(rec.frames, join(notes, 'corpses-b-off-creep-then-reached.mp4'));
  check(b2.corpses.length === 0, 'when the creep reached them they were digested');
  check(b2.digested.science > lying.digested.science && b2.digested.war > lying.digested.war, 'and their meat was banked', `${b2.digested.war - lying.digested.war} war, ${b2.digested.science - lying.digested.science} science`);

  // B2: one science body alone past the edge, close: its glint.
  console.log('B2: a lone science body past the edge glints');
  const edge = await page.evaluate(() => {
    const s = window.broodfall.sim; const W = s.cfg.gridW; const n = s.map.cells.length;
    const street = (c) => s.map.cells[c] === 1 || s.map.cells[c] === 2;
    for (let c = 0; c < n; c++) {
      if (!street(c) || s.isCreeped(c) || s.isOccupied(c)) continue;
      const x = c % W;
      const near = [c - 1, c + 1, c - W, c + W].some((o) => o >= 0 && o < n && Math.abs((o % W) - x) <= 1 && street(o) && s.isCreeped(o));
      if (near) return c;
    }
    return -1;
  });
  check(edge >= 0, 'found a bare street cell beside the creep for the lone body', String(edge));
  await centre(edge, 4);
  const lone = await spawnAt(edge, ['researcher']);
  await page.waitForTimeout(400);
  await kill(lone);
  await play(page, 1.5);
  await shot(page, 'corpses-b4-science-glint');
  const loneState = await state();
  check(loneState.corpses.length === 1 && loneState.corpses[0].digest === null && loneState.corpses[0].meat.science > 0, 'the lone science body lies unclaimed', JSON.stringify(loneState.corpses));
  await play(page, 0.2);
  await page.evaluate(() => { const s = window.broodfall.sim; s.corpses.length = 0; });
  await play(page, 0.2);

  // C: a heap.
  console.log('C: forty bodies on one cell heap and keep their meat');
  await page.evaluate((r) => { const s = window.broodfall.sim; Object.defineProperty(s, 'creepRangeCells', { get: () => r, configurable: true }); window.broodfall.renderer.creepState.fill(65535); }, setup.range);
  await play(page, 0.2);
  const kinds = Array.from({ length: 40 }, (_, i) => ['soldier', 'militia', 'researcher', 'responder', 'elite'][i % 5]);
  const cIds = await spawnAt(setup.off[0], kinds);
  await page.waitForTimeout(300);
  const meatOf = await page.evaluate((list) => { const s = window.broodfall.sim; return list.length; }, cIds);
  await kill(cIds);
  await play(page, 1.5);
  await shot(page, 'corpses-c1-heap');
  const heap = await state();
  const bodies = heap.corpses.reduce((n, c) => n + c.heap, 0);
  check(bodies === meatOf, 'every body is accounted for (loose + heaped)', `${bodies} of ${meatOf}`);
  check(heap.corpses.length <= 5, 'they are kept to the cell\'s cap plus one heap', `${heap.corpses.length} corpse records`);
  check(heap.unclaimed.war > 0 && heap.unclaimed.science > 0, 'the heap still holds war and science meat', JSON.stringify(heap.unclaimed));

  // Performance: hundreds of bodies on the board.
  console.log('D: performance with hundreds of bodies');
  const perf = await page.evaluate(async () => {
    const b = window.broodfall; const s = b.sim;
    const frames = async (n) => {
      const times = []; let last = performance.now();
      await new Promise((res) => { const f = (t) => { times.push(t - last); last = t; if (times.length < n) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      times.sort((x, y) => x - y); return { median: times[Math.floor(n / 2)], p95: times[Math.floor(n * 0.95)] };
    };
    s.corpses.length = 0; b.step(1);
    { const r = b.renderer; r.zoom = 0.6; r.pan = { x: 0, y: 0 }; r.camInit = false; b.step(0); }
    const base = await frames(90);
    const street = (c) => (s.map.cells[c] === 1 || s.map.cells[c] === 2) && !s.isCreeped(c);
    const cells = [...Array(s.map.cells.length).keys()].filter(street);
    for (let i = 0; i < 400; i++) {
      const c = cells[(i * 7) % cells.length]; const at = s.cellCenter(c);
      const e = s.spawnEnemy(['soldier', 'militia', 'researcher'][i % 3], s.gates[0]);
      e.pos = { x: at.x + ((i * 3) % 9) - 4, y: at.y + ((i * 5) % 9) - 4 };
      s.killEnemy(e.id, 1, false);
    }
    b.step(1);
    const r = b.renderer; r.zoom = 0.6; r.pan = { x: 0, y: 0 }; r.camInit = false; b.step(0);
    const t = await frames(90);
    return { bodyMs: b.fx().bodyMs, corpses: s.corpses.length, bodies: s.corpses.reduce((n, c) => n + (c.heap ?? 1), 0), sprites: r.dyingNow().length, median: t.median, p95: t.p95, baseMedian: base.median, baseP95: base.p95 };
  });
  await shot(page, 'corpses-d-many');
  console.log(`  ${JSON.stringify(perf)}`);
  check(perf.bodyMs < 3, 'hundreds of bodies cost the frame little', `${perf.bodyMs.toFixed(2)} ms a frame on the dead; whole frame (headless, software drawing) median ${perf.median.toFixed(1)} ms vs ${perf.baseMedian.toFixed(1)} ms with none (p95 ${perf.p95.toFixed(1)} vs ${perf.baseP95.toFixed(1)}), ${perf.bodies} bodies in ${perf.corpses} records, ${perf.sprites} drawn`);
  check(errors.length === 0, 'no page errors', errors.join(' | '));
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
