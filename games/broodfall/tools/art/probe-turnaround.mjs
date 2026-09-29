/**
 * Graphics probe: do five views hold ONE camera when they are drawn in a single picture?
 * (Five separate stills did not: notes/GRAPHICS-PLAN.md.) Draws the sheet from the first
 * soldier still, cuts it into its five views, and writes them side by side at one size.
 * PAID: one picture (about $0.42 at high quality).
 *
 *   node tools/art/probe-turnaround.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { LIGHT, OUT_DIR, RAW_DIR, ffmpeg, makeStill, ready } from './rfab.mjs';

const ORDER = ['S', 'SW', 'W', 'NW', 'N'];
const W = 1536;
const H = 1024;

ready();
const ref = path.join(RAW_DIR, 'soldier-walk-still.png');
const sheet = await makeStill({
  slug: 'soldier-turnaround', refFile: ref, width: W, height: H, quality: 'high',
  prompt:
    'A turnaround reference sheet of the ONE insect in the reference picture, drawn five times in a single ' +
    'horizontal row, evenly spaced, not overlapping, all five at exactly the same size. It is the identical ' +
    'creature every time: the same design, colours, armour plates, legs and proportions. ' +
    'Every one of the five is seen by the SAME camera: from above, tilted 45 degrees down, so in every view we ' +
    'look down onto its back at the same angle and see the top of its body. Never a level side view, never a ' +
    'straight-down plan view. From left to right the insect is: (1) walking straight toward the viewer; ' +
    '(2) walking toward the lower left; (3) walking to the left; (4) walking away toward the upper left; ' +
    `(5) walking straight away from the viewer. ${LIGHT} No labels, no numbers, no text, no lines between them.`,
});

// Find the five bodies: columns that hold anything that is not background green.
const raw = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', sheet, '-vf', `scale=${W}:${H},format=rgb24`, '-f', 'rawvideo', '-'],
  { maxBuffer: 64 * 1024 * 1024 }).stdout;
const isBody = (x, y) => {
  const i = (y * W + x) * 3;
  const r = raw[i], g = raw[i + 1], b = raw[i + 2];
  return !(g > 120 && g > r * 1.4 && g > b * 1.4);
};
const colHas = [];
for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y += 2) if (isBody(x, y)) n++; colHas.push(n > 3); }
const runs = [];
for (let x = 0, start = -1; x <= W; x++) {
  if (x < W && colHas[x]) { if (start < 0) start = x; } else if (start >= 0) { if (x - start > 40) runs.push([start, x]); start = -1; }
}
console.log(`[cut] found ${runs.length} bodies at columns ${runs.map((r) => r.join('-')).join(', ')}`);
if (runs.length !== 5) {
  fs.copyFileSync(sheet, path.join(OUT_DIR, 'soldier-turnaround-sheet.png'));
  console.log('not five bodies: look at the sheet and re-roll (delete art-src/probes/soldier-turnaround-still.png)');
  process.exit(1);
}
const DIR = path.join(OUT_DIR, 'turnaround');
fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(sheet, path.join(DIR, 'sheet.png'));
const boxes = runs.map(([x0, x1]) => {
  let y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = x0; x < x1; x += 2) if (isBody(x, y)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, x1, y0, y1 };
});
// One square size for all five, so their relative sizes are kept.
const side = Math.ceil(Math.max(...boxes.map((b) => Math.max(b.x1 - b.x0, b.y1 - b.y0))) * 1.5 / 2) * 2;
boxes.forEach((b, i) => {
  // Cut at the middle of the gap to each neighbour, so no crop holds a neighbour's legs,
  // then pad to the shared square with the key colour.
  const left = i === 0 ? 0 : Math.floor((boxes[i - 1].x1 + b.x0) / 2);
  const right = i === boxes.length - 1 ? W : Math.ceil((b.x1 + boxes[i + 1].x0) / 2);
  const w = Math.min(right - left, side);
  const x = Math.max(left, Math.min(right - w, Math.round((b.x0 + b.x1) / 2 - w / 2)));
  const h = Math.min(H, side);
  const y = Math.max(0, Math.min(H - h, Math.round((b.y0 + b.y1) / 2 - h / 2)));
  ffmpeg(['-i', sheet, '-vf',
    `scale=${W}:${H},crop=${w}:${h}:${x}:${y},pad=${side}:${side}:${Math.floor((side - w) / 2)}:${Math.floor((side - h) / 2)}:color=0x00FF00,` +
    'scale=1024:1024:flags=lanczos',
    '-frames:v', '1', path.join(RAW_DIR, `soldier-t-${ORDER[i].toLowerCase()}-still.png`)], `cut ${ORDER[i]}`);
});
const ins = ORDER.flatMap((d) => ['-i', path.join(RAW_DIR, `soldier-t-${d.toLowerCase()}-still.png`)]);
ffmpeg([...ins, '-filter_complex', `${ORDER.map((_, i) => `[${i}:v]scale=384:384[v${i}]`).join(';')};${ORDER.map((_, i) => `[v${i}]`).join('')}hstack=inputs=5`,
  '-frames:v', '1', path.join(DIR, 'five-views.png')], 'five views');
console.log(`written: ${path.join(DIR, 'sheet.png')} and ${path.join(DIR, 'five-views.png')}`);
