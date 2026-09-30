/**
 * WHERE EACH LIMB STANDS, measured and shown large, to be checked by eye.
 *
 *   node tools/art/feet-check.mjs                 every limb, both views
 *   node tools/art/feet-check.mjs spitter maw     some
 *   node tools/art/feet-check.mjs --write         and write the measured footing into tools/art/limbs.mjs
 *                                                 (foot / backFoot) for every limb not listed in KEEP_MARK
 *
 * Each tile (512 px): the limb's first idle frame over street colour;
 *   CYAN ellipse   the solid skirt as measured (root tips taken off: tools/art/lib/foot.mjs solidSkirt)
 *   YELLOW cross   the middle of it: where the limb will stand
 *   RED cross      the footing written in limbs.mjs now, if it differs
 *   WHITE diamond  the cell, as big as the game draws it round that skirt
 * Written to notes/art-review/feet/<family>-<view>.jpg, and six to a sheet: check-<n>.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LIMBS, rawDirOf } from './limbs.mjs';
import { blank, crop, over, paste, readFrames, resize, writeJpg } from './lib/img.mjs';
import { keyClip, unionBox, dropSpecks } from './lib/key.mjs';
import { REVIEW, SRC } from './lib/manifest.mjs';
import { FILL, drawCell, drawEllipse, footingOf, markOf, solidSkirt } from './lib/foot.mjs';

const T = 512;
/** Limbs whose mark by eye is kept when --write runs: the measure is wrong for them (say why). */
const KEEP_MARK = {
  // Its nozzle lies forward along the ground and is measured as skirt: the mark by eye is on the mound.
  lance: true,
};

function cross(img, x, y, rgb, size = 9) {
  for (let d = -size; d <= size; d++) for (let t = -1; t <= 1; t++) {
    for (const [px, py] of [[x + d, y + t], [x + t, y + d]]) {
      const X = Math.round(px), Y = Math.round(py);
      if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue;
      const p = (Y * img.w + X) * 4;
      img.data[p] = rgb[0]; img.data[p + 1] = rgb[1]; img.data[p + 2] = rgb[2]; img.data[p + 3] = 255;
    }
  }
}

function measure(l, view) {
  const clip = path.join(SRC, 'limbs', rawDirOf(l), view === 'back' ? 'back-idle.mp4' : 'idle.mp4');
  if (!fs.existsSync(clip)) return null;
  const keyed = keyClip(readFrames(clip, 4));
  const frame = keyed.frames[0];
  dropSpecks(frame);
  const box = unionBox([frame]);
  const skirt = solidSkirt(frame, box);
  const now = footingOf(l, frame, box, view);
  const side = Math.ceil(Math.max(box.x1 - box.x0, box.y1 - box.y0) * 1.3);
  const x0 = Math.round((box.x0 + box.x1) / 2 - side / 2);
  const y0 = Math.round((box.y0 + box.y1) / 2 - side / 2);
  const k = T / side;
  const tile = blank(T, T, [196, 186, 160, 255]);
  const at = (x, y) => [(x - x0) * k, (y - y0) * k];
  if (skirt) {
    const [sx, sy] = at(skirt.x, skirt.y);
    drawCell(tile, sx, sy, (skirt.a / FILL) * k, [255, 255, 255], 0.9);
  }
  over(tile, resize(crop(frame, x0, y0, side, side), T, T), 0, 0);
  if (skirt) {
    const [sx, sy] = at(skirt.x, skirt.y);
    drawEllipse(tile, sx, sy, skirt.a * k, skirt.b * k, [0, 230, 255], 0.95);
    drawCell(tile, sx, sy, (skirt.a / FILL) * k, [255, 255, 255], 0.55);
    if (now.marked) {
      const [nx, ny] = at(now.x, now.y);
      if (Math.hypot(nx - sx, ny - sy) > 4) cross(tile, nx, ny, [230, 30, 30]);
    }
    cross(tile, sx, sy, [255, 230, 0]);
  }
  return { tile, mark: skirt ? markOf(skirt, box) : null, was: now.marked ? markOf(now, box) : null };
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const ids = args.filter((a) => !a.startsWith('--'));
const out = path.join(REVIEW, 'feet');
fs.mkdirSync(out, { recursive: true });
// What was there before is out of date: every sheet is drawn again.
if (!ids.length) for (const f of fs.readdirSync(out)) if (f.endsWith('.jpg')) fs.rmSync(path.join(out, f));
const tiles = [];
const marks = {};
for (const l of LIMBS.filter((x) => !x.flat && (!ids.length || ids.includes(x.family)))) {
  for (const view of ['front', 'back']) {
    const m = measure(l, view);
    if (!m) continue;
    writeJpg(path.join(out, `${l.family}-${view}.jpg`), m.tile, 3);
    tiles.push({ id: `${l.family} ${view}`, tile: m.tile });
    (marks[l.family] ??= {})[view] = m.mark;
    console.log(`${l.family.padEnd(10)} ${view.padEnd(5)} measured [${m.mark?.join(', ')}]  was [${m.was?.join(', ') ?? 'none'}]`);
  }
}
for (let s = 0; s * 6 < tiles.length; s++) {
  const sheet = blank(3 * T, 2 * T, [24, 24, 24, 255]);
  tiles.slice(s * 6, s * 6 + 6).forEach((t, i) => paste(sheet, t.tile, (i % 3) * T, Math.floor(i / 3) * T));
  writeJpg(path.join(out, `check-${s + 1}.jpg`), sheet, 3);
  console.log(`sheet ${s + 1}: ${tiles.slice(s * 6, s * 6 + 6).map((t) => t.id).join(', ')}`);
}
if (write) {
  const file = new URL('./limbs.mjs', import.meta.url);
  let src = fs.readFileSync(file, 'utf8');
  for (const [family, m] of Object.entries(marks)) {
    if (KEEP_MARK[family]) continue;
    for (const [view, key] of [['front', 'foot'], ['back', 'backFoot']]) {
      if (!m[view]) continue;
      const v = `${key}: [${m[view].join(', ')}], `;
      const re = new RegExp(`(\\{ family: '${family}', (?:[a-z]+: true, )*)(foot: \\[[^\\]]*\\], )?(backFoot: \\[[^\\]]*\\], )?`);
      src = src.replace(re, (all, head, foot, back) => key === 'foot' ? `${head}${v}${back ?? ''}` : `${head}${foot ?? ''}${v}`);
    }
  }
  fs.writeFileSync(file, src);
  console.log('written into tools/art/limbs.mjs');
}
