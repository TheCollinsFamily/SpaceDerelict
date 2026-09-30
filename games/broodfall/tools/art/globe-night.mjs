/**
 * THE GLOBE'S NIGHT SIDE (Sep 30 2026): the lights the insects still have, on the same map as the
 * planet (public/art/ship/planet.webp), for the 3D globe (src/ui/globe3d.ts). The game draws the red
 * veins of the creep itself (so they follow what the player holds); this picture is only the cities' lights.
 *
 *   node tools/art/globe-night.mjs          draw it (once; a picture on disk is never drawn twice) and bake
 *   node tools/art/globe-night.mjs --bake   bake again (free)
 *
 * Raw: art-src/globe/night.png. Baked: public/art/ship/globe/night.webp (its left and right edges blended
 * so the meridian where they meet shows no seam). Review: notes/art-review/globe/night.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import { balance, ffmpeg, makeStill, ready } from './rfab.mjs';
import { ART, REVIEW, SRC } from './lib/manifest.mjs';
import { readImage, toWebp, writePng } from './lib/img.mjs';

const DIR = path.join(SRC, 'globe');
const RAWFILE = path.join(DIR, 'night.png');
const OUT = path.join(ART, 'ship', 'globe');
const PROMPT = 'Edit the first reference picture, a map of a whole planet in equirectangular projection. Keep EXACTLY the same ' +
  'continents, coastlines, islands and layout, edge to edge, no border. Turn it into the same planet at NIGHT seen from orbit: ' +
  'the seas pure black, the land very dark umber, and on the land fine branching networks of small pale golden city lights, ' +
  'denser along coasts, rivers and lowlands, sparse in deserts and mountains, none on the ice, like the city lights of the ' +
  'second reference picture. No clouds, no red, no text, no labels, no grid lines, no symbols.';

if (!process.argv.includes('--bake')) {
  ready();
  const before = await balance();
  fs.mkdirSync(DIR, { recursive: true });
  const map = path.join(DIR, 'planet.png');
  if (!fs.existsSync(map)) ffmpeg(['-i', path.join(ART, 'ship', 'planet.webp'), map], 'planet ref');
  await makeStill({ slug: 'globe night', out: RAWFILE, prompt: PROMPT, key: null, width: 1536, height: 1024, quality: 'high',
    refFiles: [map, path.join(SRC, 'intro', 'menu.png')].filter((f) => fs.existsSync(f)) });
  console.log(`[globe-night] ${before - (await balance())} tokens (the balance is shared: other sessions' spend counts too)`);
}
fs.mkdirSync(OUT, { recursive: true });
// The seam: column 1535 must meet column 0. Each row's difference across the meridian is spread over
// B columns on either side (half each way, fading out), so nothing is mirrored or copied.
const B = 64;
const img = readImage(RAWFILE, { w: 1536, h: 1024 });
const { w, h, data } = img;
for (let y = 0; y < h; y++) {
  for (let c = 0; c < 3; c++) {
    const L = data[(y * w) * 4 + c], R = data[(y * w + w - 1) * 4 + c];
    const half = (L - R) / 2;
    for (let k = 0; k < B; k++) {
      const f = 1 - k / B;
      const li = (y * w + k) * 4 + c, ri = (y * w + w - 1 - k) * 4 + c;
      data[li] = Math.max(0, Math.min(255, Math.round(data[li] - half * f)));
      data[ri] = Math.max(0, Math.min(255, Math.round(data[ri] + half * f)));
    }
  }
}
const png = path.join(DIR, 'night-seamless.png');
writePng(png, img);
toWebp(png, path.join(OUT, 'night.webp'), { q: 88 });
fs.mkdirSync(path.join(REVIEW, 'globe'), { recursive: true });
ffmpeg(['-i', path.join(OUT, 'night.webp'), '-vf', 'scale=1024:-2', '-q:v', '3', path.join(REVIEW, 'globe', 'night.jpg')], 'night review');
console.log('[globe-night] baked public/art/ship/globe/night.webp');
