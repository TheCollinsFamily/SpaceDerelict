/**
 * MEAT DROPS (Sep 30 2026; notes/TO-CREATE.md "Meat drops: no picture of their own"). A kill drops meat of
 * its caste (war, science, royal: DESIGN.md "three caste currencies"); it flies to the core and is banked.
 * It was a 6-pixel square of the caste's colour. Now it is a chunk of the insect it came from, two looks a
 * caste, turned and bobbing as it flies, with a small pickup at the core (src/render/meatFx.ts).
 *
 *   node tools/art/meat.mjs          draw the sheet (once) and bake
 *   node tools/art/meat.mjs --bake   bake again (free)
 *
 * Raw: art-src/fx/meat.png (magenta key: the science caste's teal would be eaten by a green one).
 * Baked: public/art/fx/meat.webp + manifest fx.meat (an FxSheet). Review: notes/art-review/fx/meat.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import { balance, makeStill, ready } from './rfab.mjs';
import { bbox, blank, borderColour, crop, over, readImage, resize, writeJpg } from './lib/img.mjs';
import { figure, findFigures } from './lib/sheet.mjs';
import { dropSpecks, keyFrame, keyOf } from './lib/key.mjs';
import { ART, REVIEW, SRC, putEntry } from './lib/manifest.mjs';
import { packSprites } from './templates/terrain.mjs';

const RAWFILE = path.join(SRC, 'fx', 'meat.png');
const OUT = path.join(ART, 'fx');
const W = 64;

export const ITEMS = [
  { id: 'meat-war-1', text: 'a torn chunk of raw red-orange insect muscle with a jagged shard of dark umber chitin armour plate stuck to one side, glistening wet' },
  { id: 'meat-war-2', text: 'a severed insect leg joint: dark umber chitin shell cracked open, raw red-orange meat bulging out of both ends' },
  { id: 'meat-science-1', text: 'a soft lobe of pale teal-green insect brain tissue with fine folds, wrapped in a thin wet translucent membrane' },
  { id: 'meat-science-2', text: 'a small cluster of glossy teal-green nerve ganglia on pale strands, like a bunch of wet grapes, faintly glowing' },
  { id: 'meat-royal-1', text: 'a plump glistening golden-amber gland full of royal jelly, translucent, with a torn pale stem' },
  { id: 'meat-royal-2', text: 'a soft golden-amber larva-like pod of rich royal flesh, fat and gleaming, a few pale gold hairs on it' },
];

const PROMPT = 'Game loot sprites for an isometric strategy game about a living bioweapon eating an insect civilisation: six ' +
  'separate small chunks of alien insect meat, laid out in two rows of three, well apart and not touching, all at the same ' +
  `scale, each about the same size. In reading order: ${ITEMS.map((it, i) => `(${i + 1}) ${it.text}`).join('; ')}. ` +
  'Seen from the side and a little from above. Realistic, detailed, wet and unglamorous, soft even light from directly ' +
  'overhead. No ground, no cast shadows, no plate, no labels, no numbers, no text, no symbols.';

if (!process.argv.includes('--bake')) {
  ready();
  const before = await balance();
  await makeStill({ slug: 'meat drops', out: RAWFILE, prompt: PROMPT, key: 'FF00FF', keyName: 'magenta', width: 1536, height: 1024, quality: 'high' });
  console.log(`[meat] ${before - (await balance())} tokens (shared balance)`);
}

const img = readImage(RAWFILE);
const found = findFigures(img, { expect: ITEMS.length });
if (found.boxes.length !== ITEMS.length) {
  console.error(`[meat] ${found.boxes.length} figures found, ${ITEMS.length} expected: look at ${RAWFILE}`);
  process.exit(1);
}
const sprites = ITEMS.map((it, i) => {
  let one = figure(img, found.boxes[i], found, 0.08);
  keyFrame(one, keyOf(borderColour(one)), { spill: 'edge' });
  dropSpecks(one, 0.02);
  const b = bbox(one, 60);
  one = crop(one, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  const s = W / Math.max(one.w, one.h);
  return { id: it.id, img: resize(one, Math.round(one.w * s), Math.round(one.h * s)), extra: { anchor: [0.5, 0.5] } };
});
fs.mkdirSync(OUT, { recursive: true });
const packed = packSprites(sprites, path.join(OUT, 'meat.webp'), 256, 90);
putEntry('fx', 'meat', { atlas: 'fx/meat.webp', sprites: packed.rects });
// Review: each at game size and at 3x, on the street's colour and on creep.
const cell = 200;
const sheet = blank(ITEMS.length * cell, cell * 2, [24, 24, 24, 255]);
sprites.forEach((s, i) => {
  for (const [k, ground] of [[0, [196, 186, 160, 255]], [1, [84, 28, 34, 255]]]) {
    const tile = blank(cell - 4, cell - 4, ground);
    const big = resize(s.img, s.img.w * 2, s.img.h * 2);
    over(tile, big, Math.round((tile.w - big.w) / 2), 12);
    over(tile, s.img, Math.round((tile.w - s.img.w) / 2), tile.h - s.img.h - 8);
    over(sheet, tile, i * cell + 2, k * cell + 2);
  }
});
fs.mkdirSync(path.join(REVIEW, 'fx'), { recursive: true });
writeJpg(path.join(REVIEW, 'fx', 'meat.jpg'), sheet);
console.log(`[meat] baked ${sprites.length} sprites, ${Math.round(packed.bytes / 1024)} KB; manifest fx.meat`);
