/**
 * IDLE LOOPS, measured straight from the atlases (free, read-only; Sep 30 2026, notes/screens/2026-09-30/anim-README.md).
 * For every limb idle (front and back) and every core stage: mean change per frame step, the loop
 * seam (last frame -> first), seam/step (>= 2: a visible pop at every loop), the amplitude, and the
 * share of the sprite that moves per step (< 3%: reads as still at game zoom).
 *
 *   node tools/art/idle-loops.mjs        (decodes the .webp atlases with ffmpeg into <os tmp>/broodfall-idle-loops/)
 */
import { PNG } from 'pngjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const G = join(root, 'public', 'art') + '/';
const OUT = join(tmpdir(), 'broodfall-idle-loops') + '/';
fs.mkdirSync(OUT, { recursive: true });
const m = JSON.parse(fs.readFileSync(G + 'manifest.json', 'utf8'));
const cache = {};
function load(atlas) {
  if (cache[atlas]) return cache[atlas];
  const png = OUT + atlas.replace(/[\/]/g, '_') + '.png';
  // Decoded afresh every run: an atlas re-baked since the last run has another size.
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', G + atlas, png]);
  return (cache[atlas] = PNG.sync.read(fs.readFileSync(png)));
}
function frame(img, size, cols, i) {
  // A clip over several atlas pages (a core stage, Sep 30 2026): frame i is on page floor(i / per).
  if (img.pages) { const p = Math.floor(i / img.per); return frame(img.pages[p], size, cols, i - p * img.per); }
  const x0 = (i % cols) * size, y0 = Math.floor(i / cols) * size;
  const f = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = ((y0 + y) * img.width + (x0 + x)) * 4, d = (y * size + x) * 4;
    const a = img.data[s + 3] / 255;
    f[d] = img.data[s] * a; f[d + 1] = img.data[s + 1] * a; f[d + 2] = img.data[s + 2] * a; f[d + 3] = img.data[s + 3];
  }
  return f;
}
function diff(a, b) { // mean abs diff over the union of opaque pixels, and the share of it that changed noticeably
  let sum = 0, n = 0, moved = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 20 && b[i + 3] < 20) continue;
    n++;
    const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3])) / 4;
    sum += d; if (d > 20) moved++;
  }
  return { mad: sum / Math.max(1, n), moved: moved / Math.max(1, n) };
}
function measure(img, size, cols, start, count, pingpong = false) {
  const fr = []; for (let i = 0; i < count; i++) fr.push(frame(img, size, cols, start + i));
  const steps = []; for (let i = 0; i < count - 1; i++) steps.push(diff(fr[i], fr[i + 1]));
  // A ping-pong (the game plays it forward and back, src/render/idleClock.ts) has no seam: its turn is one step back.
  const seam = pingpong ? diff(fr[count - 1], fr[count - 2]) : diff(fr[count - 1], fr[0]);
  let amp = 0, ampMoved = 0; for (let i = 1; i < count; i++) { const d = diff(fr[0], fr[i]); if (d.mad > amp) { amp = d.mad; ampMoved = d.moved; } }
  const mean = steps.reduce((a, s) => a + s.mad, 0) / steps.length;
  const maxStep = Math.max(...steps.map((s) => s.mad));
  const movedMean = steps.reduce((a, s) => a + s.moved, 0) / steps.length;
  // Is it a ping-pong (frame k ~ frame count-k)? and does any frame repeat (hold)?
  const holds = steps.filter((s) => s.mad < 0.3).length;
  return { mean, maxStep, seam: seam.mad, seamRatio: seam.mad / Math.max(0.01, mean), amp, ampMoved, movedMean, holds };
}
const rows = [];
for (const [name, a] of Object.entries(m.limbs)) {
  const img = load(a.atlas);
  const idle = a.anims.idle;
  const r = measure(img, a.frame, a.cols, idle.start, idle.count, !!idle.pingpong);
  rows.push({ name, side: 'front', fps: idle.fps, count: idle.count, big: !!a.big, frame: a.frame, pong: !!idle.pingpong, breathe: !!idle.breathe, ...r });
  if (a.back?.anims?.idle) { const b = a.back.anims.idle; rows.push({ name, side: 'back', fps: b.fps, count: b.count, big: !!a.big, frame: a.frame, pong: !!b.pingpong, breathe: !!b.breathe, ...measure(img, a.frame, a.cols, b.start, b.count, !!b.pingpong) }); }
}
for (const s of m.board.coreEvo.stages) {
  const i = s.idle; const img = i.pages ? { pages: [i.atlas, ...i.pages].map(load), per: i.perPage } : load(i.atlas);
  rows.push({ name: 'core-' + s.id, side: 'front', fps: i.fps, count: i.count, big: true, frame: i.frame, pong: !!i.pingpong, ...measure(img, i.frame, i.cols, 0, i.count, !!i.pingpong) });
}
fs.writeFileSync(OUT + 'idle-motion.json', JSON.stringify(rows, null, 1));
const f = (x, d = 1) => x.toFixed(d).padStart(6);
console.log('name              side   fps  n   loop_s  step  maxStep  seam  seam/step  amp  moved%  holds  play');
for (const r of rows) console.log(`${r.name.padEnd(17)} ${r.side.padEnd(5)} ${f(r.fps, 2)} ${String(r.count).padStart(2)} ${f(r.count / r.fps, 2)} ${f(r.mean)} ${f(r.maxStep)} ${f(r.seam)} ${f(r.seamRatio, 2)} ${f(r.amp)} ${f(r.movedMean * 100)} ${String(r.holds).padStart(3)}  ${r.pong ? "pong" : "loop"}${r.breathe ? "+breathe" : ""}`);
