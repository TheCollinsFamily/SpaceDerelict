/**
 * Paints rectangles of a picture in its own background colour: how a small unwanted detail
 * (a compass cross on a weathervane, a stray letter) is taken off a sheet of props without
 * drawing the whole sheet again. The picture as it was is kept beside it as <name>.orig.png.
 *
 *   node tools/art/paint-out.mjs art-src/terrain/suburb/props-roof.png 890,609,40,54 947,609,46,54
 *
 * Each rectangle is x,y,width,height in the picture's own pixels.
 */
import fs from 'node:fs';
import { borderColour, readImage, writePng } from './lib/img.mjs';

const [file, ...rects] = process.argv.slice(2);
if (!file || !rects.length) {
  console.error('usage: node tools/art/paint-out.mjs <picture.png> x,y,w,h [x,y,w,h ...]');
  process.exit(1);
}
const orig = file.replace(/\.png$/, '.orig.png');
if (!fs.existsSync(orig)) fs.copyFileSync(file, orig);
const img = readImage(file);
const [r, g, b] = borderColour(img);
for (const rect of rects) {
  const [x0, y0, w, h] = rect.split(',').map(Number);
  for (let y = Math.max(0, y0); y < Math.min(img.h, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(img.w, x0 + w); x++) {
      const i = (y * img.w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
}
writePng(file, img);
console.log(`painted ${rects.length} rectangle(s) of ${file} in its background colour (${r}, ${g}, ${b}); the picture as it was: ${orig}`);
