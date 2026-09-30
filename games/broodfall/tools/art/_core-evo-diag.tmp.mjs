// Temporary diagnosis: how the studio keyer does on each core-evo clip (bbox per frame, a few frames saved).
import path from 'node:path';
import { bbox, blank, over, readFrames, resize, writeJpg } from './lib/img.mjs';
import { dropSpecks } from './lib/key.mjs';
import { keyFrame, studioKeyer } from './lib/leaflit.mjs';
const OUT = process.argv[2];
for (const name of process.argv.slice(3)) {
  const clip = readFrames(path.join('art-src/terrain/core', `${name}.mp4`), 12);
  const imgs = clip.frames.map((f) => ({ w: clip.w, h: clip.h, data: Buffer.from(f) }));
  const { ck, key, similarity } = studioKeyer({ w: clip.w, h: clip.h, data: Buffer.from(imgs[0].data) });
  const boxes = [];
  for (const img of imgs) { keyFrame(ck, img); dropSpecks(img); const b = bbox(img); boxes.push(b ? `${b.x0},${b.y0}-${b.x1},${b.y1}` : 'none'); }
  console.log(name, clip.w, clip.h, imgs.length, 'key', key.join(','), 'sim', similarity);
  console.log('  ', boxes.filter((_, i) => i % 6 === 0).join('  '));
  const T = 270;
  const sheet = blank(T * 8, T, [60, 20, 20, 255]);
  for (let i = 0; i < 8; i++) over(sheet, resize(imgs[Math.floor((i * (imgs.length - 1)) / 7)], T, T), i * T, 0);
  writeJpg(path.join(OUT, `diag-${name}.jpg`), sheet, 3);
}
