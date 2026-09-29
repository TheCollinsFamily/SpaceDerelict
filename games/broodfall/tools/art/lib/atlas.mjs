/**
 * Packs animation frames into one atlas picture and draws the review sheet a person
 * looks at before an asset is kept.
 */
import fs from 'node:fs';
import path from 'node:path';
import { blank, flipX, over, paste, resize, toWebp, writeJpg, writePng } from './img.mjs';

/**
 * @param frames RGBA pictures, all `size` x `size`
 * @returns the atlas file's size in bytes
 */
export function packAtlas(frames, size, cols, webp, q = 86) {
  const rows = Math.ceil(frames.length / cols);
  const sheet = blank(cols * size, rows * size);
  frames.forEach((f, i) => paste(sheet, f, (i % cols) * size, Math.floor(i / cols) * size));
  const png = webp.replace(/\.webp$/, '.png');
  writePng(png, sheet);
  toWebp(png, webp, { q });
  fs.rmSync(png);
  return { bytes: fs.statSync(webp).size, w: sheet.w, h: sheet.h };
}

/** Street, roof and creep: what a sprite has to read against. */
export const GROUNDS = { street: [196, 186, 160], roof: [168, 150, 112], creep: [84, 28, 34] };

/**
 * The review sheet of an animated asset. One row per view: four frames of each animation
 * over street colour, then the same over creep colour, then the first frame at half and
 * quarter size (the sizes it is really seen at).
 * @param rows [{ label, anims: [[frame, ...], ...], mirror? }]
 */
export function reviewSheet(rows, size, file) {
  const perAnim = 4;
  const animCount = Math.max(...rows.map((r) => r.anims.length));
  const w = size * perAnim * animCount * 2 + size * 2;
  const sheet = blank(w, rows.length * size, [24, 24, 24, 255]);
  rows.forEach((row, ri) => {
    const y = ri * size;
    ['street', 'creep'].forEach((ground, gi) => {
      row.anims.forEach((frames, ai) => {
        for (let k = 0; k < perAnim; k++) {
          const f = frames[Math.floor((k * frames.length) / perAnim)];
          if (!f) continue;
          const tile = blank(size, size, [...GROUNDS[ground], 255]);
          over(tile, row.mirror ? flipX(f) : f, 0, 0);
          paste(sheet, tile, (gi * animCount * perAnim + ai * perAnim + k) * size, y);
        }
      });
    });
    const first = row.anims[0][0];
    const x = size * perAnim * animCount * 2;
    const small = blank(size * 2, size, [...GROUNDS.street, 255]);
    over(small, resize(first, size >> 1, size >> 1), size >> 2, size >> 2);
    over(small, resize(first, size >> 2, size >> 2), size + (size >> 2), size >> 2);
    paste(sheet, small, x, y);
  });
  writeJpg(file, sheet);
  return file;
}

/** A review strip as a looping video a person can play: every view walking side by side. */
export function reviewFrames(views, size, dir, name) {
  const n = Math.max(...views.map((v) => v.length));
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n * 3; i++) {
    const strip = blank(views.length * size, size * 2, [...GROUNDS.street, 255]);
    paste(strip, blank(views.length * size, size, [...GROUNDS.creep, 255]), 0, size);
    views.forEach((v, k) => {
      const f = v[i % v.length];
      over(strip, f, k * size, 0);
      over(strip, f, k * size, size);
    });
    writePng(path.join(dir, `${name}-${String(i).padStart(4, '0')}.png`), strip);
  }
  return n * 3;
}
