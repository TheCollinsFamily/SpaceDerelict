/**
 * THE FLAMETROOPER'S NOZZLE, FRAME BY FRAME (Oct 2 2026; Collins: the flame "doesn't track the front of the nozzle").
 * The nozzle tip carries a small blue pilot light (tools/art/units.mjs asks for one in every clip), so it is FOUND on
 * the baked frames, not guessed: in each attack frame of each drawn view, the centre of the bright blue pixels.
 * Where a view hides it (the trooper seen from behind), the point is the mark given here by eye, and the flame is
 * drawn behind the trooper. Writes src/render/nozzles.ts ({ [view]: [[x, y] per frame] } as shares of the frame)
 * and a check sheet, every attack frame with its point in cyan: notes/art-review/units/flametrooper-nozzles.jpg.
 *
 *   node tools/art/nozzles.mjs        (free; reads public/art/units/flametrooper.webp)
 * Fails (exit 1) if a front view loses its pilot light on any frame, or the tip drifts more than MAX_DRIFT of the
 * frame between frames of one view.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readImage } from './lib/img.mjs';
import { ROOT } from './lib/manifest.mjs';

const KIND = 'flametrooper';
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'art', 'manifest.json'), 'utf8')).units[KIND];
const atlas = path.join(ROOT, 'public', 'art', man.atlas);
const img = readImage(atlas);
const F = man.frame;
const COLS = man.cols;
/** Views seen from behind: the nozzle is hidden by the body; a mark by eye (the flame starts in front of the chest). */
const HIDDEN = { N: [0.5, 0.52] };
const MAX_DRIFT = 0.06;
const OUTLIER = 0.05;

function pilot(frameIndex) {
  const fx = (frameIndex % COLS) * F;
  const fy = Math.floor(frameIndex / COLS) * F;
  // The blue pixels, and the body's middle (every opaque pixel). Where the pilot light flares into a short blue
  // tongue, the NOZZLE is the end of the blue nearest the body: the mean of the blue pixels closest to the middle.
  const blue = [];
  let bx = 0; let by = 0; let bn = 0;
  for (let y = 0; y < F; y++) {
    for (let x = 0; x < F; x++) {
      const i = ((fy + y) * img.w + (fx + x)) * 4;
      const r = img.data[i]; const g = img.data[i + 1]; const b = img.data[i + 2]; const a = img.data[i + 3];
      if (a > 120) { bx += x; by += y; bn++; }
      // Below the helmet only: its heat visor catches blue light in a few frames.
      if (a > 120 && y > F * 0.5 && b > 150 && b > r + 50 && b > g + 15) blue.push([x, y]);
    }
  }
  if (blue.length < 2 || !bn) return null;
  const mx = bx / bn; const my = by / bn;
  blue.sort((p, q) => Math.hypot(p[0] - mx, p[1] - my) - Math.hypot(q[0] - mx, q[1] - my));
  const near = blue.slice(0, Math.max(2, Math.min(6, Math.ceil(blue.length / 4))));
  const nx = near.reduce((s, p) => s + p[0], 0) / near.length;
  const ny = near.reduce((s, p) => s + p[1], 0) / near.length;
  return [+(nx / F).toFixed(3), +(ny / F).toFixed(3), blue.length];
}

const out = {};
const problems = [];
const tiles = [];
for (const [view, clip] of Object.entries(man.anims.attack)) {
  const found = [];
  for (let k = 0; k < clip.count; k++) found.push(HIDDEN[view] ? null : pilot(clip.start + k));
  // The nozzle is held steady (the clips are made that way), so the view's tip is the MEDIAN of what was found; a
  // frame whose blue lies far from it (the pilot light flaring into a blue tongue, a glint) is an outlier and
  // takes the median instead. What is left is the tip frame by frame, within OUTLIER of the median.
  const ok = found.filter(Boolean);
  const med = (k) => [...ok.map((p) => p[k])].sort((p, q) => p - q)[ok.length >> 1];
  const M = ok.length ? [med(0), med(1)] : null;
  for (let k = 0; k < found.length; k++) {
    if (found[k] && M && Math.hypot(found[k][0] - M[0], found[k][1] - M[1]) > OUTLIER) {
      console.log(`  ${view} frame ${k}: blue at ${found[k][0]},${found[k][1]} is ${Math.hypot(found[k][0] - M[0], found[k][1] - M[1]).toFixed(3)} from the tip: taken as the tip`);
      found[k] = [M[0], M[1], 0];
    }
  }
  const seen = found.filter(Boolean).length;
  if (!HIDDEN[view] && seen < clip.count * 0.75) problems.push(`${view}: the pilot light shows on only ${seen} of ${clip.count} frames`);
  const pts = [];
  for (let k = 0; k < clip.count; k++) {
    let q = HIDDEN[view] ?? null;
    if (!q) {
      // A frame where a hand or the hose covers the light for a moment takes its nearest neighbour's point.
      for (let d = 0; d < clip.count && !q; d++) q = (found[k - d] ?? found[k + d]) ? [(found[k - d] ?? found[k + d])[0], (found[k - d] ?? found[k + d])[1]] : null;
      if (!found[k]) console.log(`  ${view} frame ${k}: light hidden, the neighbour's point taken`);
    }
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) > MAX_DRIFT) problems.push(`${view} frame ${k}: the tip jumps ${Math.hypot(q[0] - prev[0], q[1] - prev[1]).toFixed(3)}`);
    pts.push(q);
    tiles.push({ frame: clip.start + k, p: q, view, k });
  }
  out[view] = pts;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  console.log(`${view}: x ${Math.min(...xs).toFixed(3)}-${Math.max(...xs).toFixed(3)} y ${Math.min(...ys).toFixed(3)}-${Math.max(...ys).toFixed(3)}${HIDDEN[view] ? ' (hidden: marked by eye)' : ''}`);
}
const NL = String.fromCharCode(10);
fs.writeFileSync(path.join(ROOT, 'src', 'render', 'nozzles.ts'),
  '/** Written by tools/art/nozzles.mjs (do not edit): the flametrooper nozzle tip per attack view and frame, as shares of the frame. */' + NL
  + 'export const NOZZLES: Record<string, { hidden: string[]; attack: Record<string, [number, number][]> }> = '
  + JSON.stringify({ [KIND]: { hidden: Object.keys(HIDDEN), attack: out } }) + ';' + NL);

// The check sheet: each attack frame at 2x with its point.
const rev = path.join(ROOT, 'notes', 'art-review', 'units');
fs.mkdirSync(rev, { recursive: true });
const S = 2;
const per = 12;
const filters = [];
const inputs = [];
tiles.forEach((t, i) => {
  const fx = (t.frame % COLS) * F; const fy = Math.floor(t.frame / COLS) * F;
  const cx = Math.round(t.p[0] * F * S); const cy = Math.round(t.p[1] * F * S);
  filters.push(`[0:v]crop=${F}:${F}:${fx}:${fy},scale=${F * S}:${F * S},format=rgba[b${i}]`);
  filters.push(`color=c=0x8a8a8a:s=${F * S}x${F * S}[bg${i}];[bg${i}][b${i}]overlay=format=auto,drawbox=x=${cx - 3}:y=${cy - 3}:w=7:h=7:color=cyan:t=2,drawtext=text='${t.view}${t.k}':x=4:y=4:fontsize=14:fontcolor=yellow[t${i}]`);
});
const rows = [];
for (let r = 0; r * per < tiles.length; r++) {
  const ids = tiles.slice(r * per, (r + 1) * per).map((_, j) => `[t${r * per + j}]`);
  filters.push(`${ids.join('')}hstack=inputs=${ids.length}[r${r}]`);
  rows.push(`[r${r}]`);
}
filters.push(`${rows.join('')}vstack=inputs=${rows.length}[out]`);
inputs.push('-i', atlas);
const sheet = path.join(rev, `${KIND}-nozzles.jpg`);
const res = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-q:v', '3', sheet], { encoding: 'utf8' });
if (res.status !== 0) console.log(res.stderr.slice(0, 400));
console.log(`sheet: ${sheet}`);
if (problems.length) { console.log(`PROBLEMS:\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log('every front-view frame has its pilot light; no jumps');
