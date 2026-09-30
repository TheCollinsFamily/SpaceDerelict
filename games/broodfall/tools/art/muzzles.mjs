/**
 * MUZZLE SHEETS: where each limb's shot leaves its body, drawn over its picture to be READ by eye
 * (Sep 30 2026, Collins: "I noticed there was an issue with the shots aligning with coming from
 * where the art would indicate"). Free: it reads the clips on disk.
 *
 * Like the footing (tools/art/feet.mjs, rule 24), the point is MARKED, never computed:
 * `muzzle: [[x, y], ...]` on the limb in tools/art/limbs.mjs (and `backMuzzle` for its view from
 * behind), as shares of the SAME box the foot is marked in: the box that holds the limb in the
 * first frame of its idle clip, x from its left edge, y from its top edge (a point may lie a
 * little outside it: a nozzle that reaches out as it fires). One point for most limbs; a few for
 * a limb whose shots leave from several places (a fan of quills, the tips of a frond): the game
 * hands them out one shot at a time. The bake turns the marks into shares of the baked frame
 * (public/art/manifest.json, limbs.<family>.muzzle and .back.muzzle).
 *
 *   node tools/art/muzzles.mjs                every limb that fires, front views
 *   node tools/art/muzzles.mjs --back         their views from behind
 *   node tools/art/muzzles.mjs spitter quill  some
 *
 * Each sheet is one limb in a row of five tiles: its first idle frame, then its firing clip at a
 * fifth, two fifths, three fifths and four fifths of the way through. Over each: a grid of tenths
 * of the idle box (heavier at 0, 5 and 10; lighter lines carry on past the box), the foot (yellow)
 * and the muzzle marks (cyan). Written to notes/art-review/muzzles/<family>[-back].jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FIRING, LIMBS } from './limbs.mjs';
import { blank, crop, over, paste, readFrames, resize, writeJpg } from './lib/img.mjs';
import { dropSpecks, keyClip, unionBox } from './lib/key.mjs';
import { REVIEW, SRC } from './lib/manifest.mjs';
import { footingOf } from './lib/foot.mjs';

const TILE = 400;
const STREET = [196, 186, 160, 255];

function line(img, x0, y0, x1, y1, rgb, alpha) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
    const p = (y * img.w + x) * 4;
    for (let k = 0; k < 3; k++) img.data[p + k] = Math.round(img.data[p + k] * (1 - alpha) + rgb[k] * alpha);
  }
}
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

/** Digits, 3 by 5, to write the tenths on the grid. */
const GLYPH = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', '-': '000000111000000',
};
function write(img, text, x, y, rgb, px = 2) {
  let cx = Math.round(x);
  for (const ch of String(text)) {
    const g = GLYPH[ch];
    if (!g) { cx += 2 * px; continue; }
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      if (g[r * 3 + c] !== '1') continue;
      for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) {
        const X = cx + c * px + dx, Y = Math.round(y) + r * px + dy;
        if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue;
        const p = (Y * img.w + X) * 4;
        img.data[p] = rgb[0]; img.data[p + 1] = rgb[1]; img.data[p + 2] = rgb[2]; img.data[p + 3] = 255;
      }
    }
    cx += 4 * px;
  }
}

function sheetOf(l, view) {
  const pre = view === 'back' ? 'back-' : '';
  const idleFile = path.join(SRC, 'limbs', l.family, `${pre}idle.mp4`);
  const fireFile = path.join(SRC, 'limbs', l.family, `${pre}fire.mp4`);
  if (!fs.existsSync(idleFile)) return null;
  const idle = keyClip(readFrames(idleFile, 4)).frames[0];
  dropSpecks(idle);
  const box = unionBox([idle]);
  const fire = fs.existsSync(fireFile) ? keyClip(readFrames(fireFile, 12)).frames : [];
  for (const f of fire) dropSpecks(f);
  const picks = [idle, ...[0.2, 0.4, 0.6, 0.8].map((u) => fire[Math.round(u * (fire.length - 1))]).filter(Boolean)];
  // One window for every tile: the idle box and what the firing reaches, square, with a margin.
  let u = box;
  for (const f of picks) { const b = unionBox([f]); if (b) u = { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) }; }
  const side = Math.ceil(Math.max(u.x1 - u.x0, u.y1 - u.y0) * 1.12);
  const x0 = Math.round((u.x0 + u.x1) / 2 - side / 2);
  const y0 = Math.round((u.y0 + u.y1) / 2 - side / 2);
  const k = TILE / side;
  const at = (x, y) => [(x - x0) * k, (y - y0) * k];
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const f = footingOf(l, idle, box, view);
  const marks = (view === 'back' ? l.backMuzzle : l.muzzle) ?? [];
  const sheet = blank(TILE * picks.length, TILE, [24, 24, 24, 255]);
  picks.forEach((frame, n) => {
    const tile = blank(TILE, TILE, STREET);
    over(tile, resize(crop(frame, x0, y0, side, side), TILE, TILE), 0, 0);
    for (let i = -4; i <= 14; i++) {
      const inside = i >= 0 && i <= 10;
      const heavy = i === 5 ? 0.85 : i === 0 || i === 10 ? 0.7 : inside ? 0.32 : 0.14;
      const [vx] = at(box.x0 + (w * i) / 10, 0);
      line(tile, vx, 0, vx, TILE - 1, [20, 40, 160], heavy);
      const [, hy] = at(0, box.y0 + (h * i) / 10);
      line(tile, 0, hy, TILE - 1, hy, [20, 40, 160], heavy);
      // The tenth, written at the top (x) and at the left (y): 0 to 10 across the box, negative or past 10 outside it.
      const col = inside ? [0, 0, 0] : [90, 90, 90];
      write(tile, i, vx + 2, 8, col);
      write(tile, i, 2, hy + 2, col);
    }
    const [gx, gy] = at(f.x, f.y);
    cross(tile, gx, gy, [255, 230, 0], 7);
    for (const m of marks) {
      const [mx, my] = at(box.x0 + m[0] * w, box.y0 + m[1] * h);
      cross(tile, mx, my, [0, 255, 255], 10);
    }
    // A frame from the firing clip has a red band along its top; the idle frame a green one.
    for (let y = 0; y < 5; y++) line(tile, 0, y, TILE - 1, y, n ? [220, 40, 40] : [40, 200, 60], 1);
    paste(sheet, tile, n * TILE, 0);
  });
  return { sheet, marks };
}

const args = process.argv.slice(2);
const view = args.includes('--back') ? 'back' : 'front';
const ids = args.filter((a) => !a.startsWith('--'));
const list = args.includes('--units') ? [] : LIMBS.filter((l) => FIRING.includes(l.family) && (!ids.length || ids.includes(l.family)) && (view === 'front' || l.back));
const out = path.join(REVIEW, 'muzzles');
fs.mkdirSync(out, { recursive: true });
for (const l of list) {
  const made = sheetOf(l, view);
  if (!made) { console.log(`${l.family}: no ${view} idle clip`); continue; }
  const file = path.join(out, `${l.family}${view === 'back' ? '-back' : ''}.jpg`);
  writeJpg(file, made.sheet, 3);
  console.log(`${l.family.padEnd(9)} ${view.padEnd(5)} ${made.marks.length ? JSON.stringify(made.marks) : 'NOT MARKED'}  ${file}`);
}

/**
 * --units: the hive's guns (cannon, dart battery, mortar), from their baked atlas, one tile per clip
 * they fire in, with a grid of tenths of the FRAME and the marks of src/render/unitMuzzles.ts.
 * Written to notes/art-review/muzzles/unit-<kind>.jpg.
 */
if (args.includes('--units')) {
  const { ART } = await import('./lib/manifest.mjs');
  const { readImage } = await import('./lib/img.mjs');
  const man = JSON.parse(fs.readFileSync(path.join(ART, 'manifest.json'), 'utf8'));
  const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..', 'src', 'render', 'unitMuzzles.ts'), 'utf8');
  const json = src.split('// --- marks ---')[1].split('// --- end of marks ---')[0];
  const marks = JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1));
  for (const kind of ['cannon', 'dartgun', 'mortar']) {
    const u = man.units[kind];
    const pages = [u.atlas, ...(u.pages ?? [])].map((a) => readImage(path.join(ART, a)));
    const clips = [];
    if (u.anims.braced?.SW) clips.push(['braced', 'SW', u.anims.braced.SW]);
    if (u.anims.states?.deployed) clips.push(['deployed', 'SW', u.anims.states.deployed]);
    for (const v of ['S', 'SW', 'W', 'NW', 'N']) if (u.anims.attack?.[v]) clips.push(['attack', v, u.anims.attack[v]]);
    const sheet = blank(TILE * clips.length, TILE, [24, 24, 24, 255]);
    clips.forEach(([anim, v, c], n) => {
      const img = pages[c.page ?? 0];
      const i = c.start;
      const F = u.frame;
      const frame = crop(img, (i % u.cols) * F, Math.floor(i / u.cols) * F, F, F);
      const tile = blank(TILE, TILE, STREET);
      over(tile, resize(frame, TILE, TILE), 0, 0);
      for (let k = 0; k <= 10; k++) {
        const at = (k / 10) * (TILE - 1);
        const heavy = k === 5 ? 0.85 : k === 0 || k === 10 ? 0.7 : 0.32;
        line(tile, at, 0, at, TILE - 1, [20, 40, 160], heavy);
        line(tile, 0, at, TILE - 1, at, [20, 40, 160], heavy);
        write(tile, k, at + 2, 8, [0, 0, 0]);
        write(tile, k, 2, at + 2, [0, 0, 0]);
      }
      const m = marks[kind]?.[anim]?.[v];
      if (m) cross(tile, m[0] * TILE, m[1] * TILE, [0, 255, 255], 10);
      const a = c.anchor ?? u.anchor;
      cross(tile, a[0] * TILE, a[1] * TILE, [255, 230, 0], 7);
      for (let y = 0; y < 5; y++) line(tile, 0, y, TILE - 1, y, anim === 'attack' ? [220, 40, 40] : [40, 200, 60], 1);
      paste(sheet, tile, n * TILE, 0);
      console.log(`${kind.padEnd(8)} tile ${n + 1}: ${anim} ${v}  ${m ? JSON.stringify(m) : 'NOT MARKED'}`);
    });
    const file = path.join(out, `unit-${kind}.jpg`);
    writeJpg(file, sheet, 3);
    console.log(`written: ${file}`);
  }
}
