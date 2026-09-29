/**
 * FOOT SHEETS: where each limb stands, drawn over its picture for a vision model (or a
 * person) to check and correct. Free: it reads the clips on disk.
 *
 * Collins, Sep 29 2026: "you actually probably want to manually have something paint the
 * visual center of the bottom of a tower (a vision model). Why? Well consider tall towers or
 * oddly shaped ones, this could cause issues."
 *
 * So the ground point of a limb is MARKED, not computed: `foot: [x, y, width]` on the limb
 * in tools/art/limbs.mjs (and `backFoot` for its view from behind), as shares of the box
 * that holds the limb in its first idle frame: x from its left edge, y from its top edge,
 * and the width of its footprint (the skirt it stands on) as a share of the box's width.
 * The computer's own guess (tools/art/lib/foot.mjs) is what is drawn when there is no mark,
 * and the bake fails a limb that has none.
 *
 *   node tools/art/feet.mjs                 every limb, front views
 *   node tools/art/feet.mjs --back          their views from behind
 *   node tools/art/feet.mjs spitter maw     some
 *
 * Each tile: the limb over street colour, a grid of tenths of its box (the middle lines
 * heavier), the cell it would stand in (white), and its ground point (yellow).
 * Written to notes/art-review/feet/sheet-<n>.jpg, nine limbs a sheet, in the order printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LIMBS } from './limbs.mjs';
import { blank, crop, over, paste, readFrames, resize, writeJpg } from './lib/img.mjs';
import { keyClip, unionBox } from './lib/key.mjs';
import { REVIEW, SRC } from './lib/manifest.mjs';
import { FILL, drawCell, footingOf, markOf } from './lib/foot.mjs';

const TILE = 384;
const STREET = [196, 186, 160, 255];

function line(img, x0, y0, x1, y1, rgb, alpha) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
    const p = (y * img.w + x) * 4;
    for (let k = 0; k < 3; k++) img.data[p + k] = Math.round(img.data[p + k] * (1 - alpha) + rgb[k] * alpha);
    img.data[p + 3] = 255;
  }
}

function tileOf(l, view) {
  const clip = path.join(SRC, 'limbs', l.family, view === 'back' ? 'back-idle.mp4' : 'idle.mp4');
  if (!fs.existsSync(clip)) return null;
  const keyed = keyClip(readFrames(clip, 4));
  const frame = keyed.frames[0];
  const box = unionBox([frame]);
  const f = footingOf(l, frame, box, view);
  // The box and a margin round it, brought to the size of a tile.
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const side = Math.ceil(Math.max(w, h) * 1.3);
  const x0 = Math.round((box.x0 + box.x1) / 2 - side / 2);
  const y0 = Math.round((box.y0 + box.y1) / 2 - side / 2);
  const k = TILE / side;
  const tile = blank(TILE, TILE, STREET);
  const at = (x, y) => [(x - x0) * k, (y - y0) * k];
  const [gx, gy] = at(f.x, f.y);
  // The cell, under the limb.
  drawCell(tile, gx, gy, (f.a / FILL) * k, [255, 255, 255], 0.9);
  over(tile, resize(crop(frame, x0, y0, side, side), TILE, TILE), 0, 0);
  // Tenths of the box.
  for (let i = 0; i <= 10; i++) {
    const heavy = i === 5 ? 0.8 : i === 0 || i === 10 ? 0.6 : 0.28;
    const [vx, vy0] = at(box.x0 + (w * i) / 10, box.y0);
    const [, vy1] = at(box.x0, box.y1);
    line(tile, vx, vy0, vx, vy1, [20, 40, 160], heavy);
    const [hx0, hy] = at(box.x0, box.y0 + (h * i) / 10);
    const [hx1] = at(box.x1, box.y0);
    line(tile, hx0, hy, hx1, hy, [20, 40, 160], heavy);
  }
  drawCell(tile, gx, gy, (f.a / FILL) * k, [255, 255, 255], 0.5);
  for (let d = -7; d <= 7; d++) {
    line(tile, gx - 7, gy + d * 0.3, gx + 7, gy + d * 0.3, [255, 230, 0], Math.abs(d) < 5 ? 1 : 0);
    line(tile, gx + d * 0.3, gy - 7, gx + d * 0.3, gy + 7, [255, 230, 0], Math.abs(d) < 5 ? 1 : 0);
  }
  return { tile, mark: markOf(f, box), marked: f.marked, fitted: f.fitted !== false };
}

const args = process.argv.slice(2);
const view = args.includes('--back') ? 'back' : 'front';
const ids = args.filter((a) => !a.startsWith('--'));
const list = LIMBS.filter((l) => !l.flat && (!ids.length || ids.includes(l.family)));
const out = path.join(REVIEW, 'feet');
fs.mkdirSync(out, { recursive: true });
let sheet = null;
let n = 0;
const rows = [];
const flush = () => {
  if (!sheet) return;
  const file = path.join(out, `${view === 'back' ? 'back-' : ''}sheet-${Math.ceil(n / 9)}.jpg`);
  writeJpg(file, sheet, 3);
  console.log(`written: ${file}`);
  sheet = null;
};
for (const l of list) {
  const made = tileOf(l, view);
  if (!made) { console.log(`${l.family}: no ${view} idle clip`); continue; }
  if (n % 9 === 0) { flush(); sheet = blank(TILE * 3, TILE * 3, [24, 24, 24, 255]); }
  paste(sheet, made.tile, (n % 3) * TILE, Math.floor((n % 9) / 3) * TILE);
  n++;
  rows.push(`${String(n).padStart(2)}  sheet ${Math.ceil(n / 9)}, row ${Math.floor(((n - 1) % 9) / 3) + 1}, place ${((n - 1) % 3) + 1}  ${l.family.padEnd(10)} ${made.marked ? 'marked ' : made.fitted ? 'guessed' : 'GUESSED BLIND'}  [${made.mark.join(', ')}]`);
}
flush();
console.log(rows.join('\n'));
