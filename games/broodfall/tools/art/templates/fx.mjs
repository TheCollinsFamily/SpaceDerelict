/**
 * THE EFFECTS TEMPLATE (Sep 30 2026): what flies, what bursts, what hangs in the air, and the
 * parts a cannibalized limb leaves on the next one. All of it was lines and dots.
 *
 *   node tools/art/make.mjs fx                 the effect sheets and every donor part (skips what exists)
 *   node tools/art/make.mjs fx sheets          only the effect sheets
 *   node tools/art/make.mjs fx parts [family]  only the donor parts (of those families)
 *   node tools/art/make.mjs fx --bake          bake again from what is on disk (free)
 *
 * Two kinds of picture:
 *   - SOLID things (a glob of spit, a harpoon, a shell, a dart) are drawn on a flat key colour
 *     and cut out like everything else. They point to the RIGHT of the picture; the game turns
 *     them along their flight.
 *   - LIGHT and VAPOUR (lightning, a beam, a flame, a cloud, a burst) cannot be keyed off a
 *     colour: they are drawn on BLACK, and their brightness is their opacity. Glows are drawn
 *     by the game added onto what is under them; clouds and bursts over it.
 *
 * Donor parts (DESIGN.md: "a spitter built from a cannibalized burster has the burster's sacs
 * hanging off it"): one small part per family, drawn from that limb's own picture so it is the
 * same flesh, grafted by the game onto the edges of the limb that carries the trait (the graft
 * points are measured on every limb when it is baked: tools/art/templates/limb.mjs).
 *
 * Raw pictures: art-src/fx/. Baked: public/art/fx/. To look at: notes/art-review/fx/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool } from '../rfab.mjs';
import { LIMBS, THEMES } from '../limbs.mjs';
import { bbox, blank, borderColour, crop, over, readImage, resize, writeJpg } from '../lib/img.mjs';
import { cutGrid, figure, findFigures } from '../lib/sheet.mjs';
import { dropSpecks, keyFrame, keyOf } from '../lib/key.mjs';
import { ART, REVIEW, SRC, putEntry } from '../lib/manifest.mjs';
import { packSprites } from './terrain.mjs';

const DIR = path.join(SRC, 'fx');
const OUT = path.join(ART, 'fx');
const LOOK = path.join(REVIEW, 'fx');
const CREEP = path.join(SRC, 'terrain', 'creep.png');

const SIDE = 'Each one is seen from the side and a little from above, as in an isometric strategy game, and each one flies or points toward the RIGHT of the picture.';
const SOLID_TAIL = 'Realistic, detailed, wet and unglamorous, soft even light from directly overhead. No ground, no cast shadows, no labels, no numbers, no text, no symbols.';
const DARK_TAIL = 'Everything else is pure black #000000: no ground, no horizon, no frame. No labels, no numbers, no text, no symbols.';

/**
 * The sheets. `key`: the flat colour a solid sheet is drawn on; null: drawn on black (light and vapour).
 * `items`: in reading order; `w`: how many pixels wide it is baked (its long side for a thing that flies).
 */
export const SHEETS = [
  {
    id: 'body-shots', key: { hex: '0000FF', name: 'blue' }, cols: 4,
    lead: 'Game effect sprites: eight separate small things thrown or shot by a living alien bioweapon, laid out in two rows of four, well apart and not touching, all at the same scale.',
    items: [
      { id: 'spit', w: 72, text: 'a glob of dark red-brown spit with a short wet tail stretched out behind it' },
      { id: 'sac', w: 76, text: 'a taut round dark-red sac of flesh with a ring of tiny teeth at its torn stem, the stem trailing behind' },
      { id: 'harpoon', w: 150, text: 'one long straight ivory bone harpoon with a barbed point, lying level, the point at the right' },
      { id: 'quill', w: 96, text: 'one long slender ivory quill, sharp at the right end, lying level' },
      { id: 'clot', w: 84, text: 'a lumpy clot of dark maroon living flesh crossed by darker veins, glistening' },
      { id: 'bile', w: 84, text: 'a heavy wobbling glob of thick yellow bile with a drooping drip trailing behind it' },
      { id: 'spore-shell', w: 80, text: 'a round shell of overlapping ivory bone plates, golden spores leaking from the seams between the plates' },
      { id: 'bone-shell', w: 72, text: 'a smooth polished round shell of ivory bone, slightly egg-shaped' },
    ],
  },
  {
    id: 'mixed-shots', key: { hex: 'FF00FF', name: 'magenta' }, cols: 4,
    lead: 'Game item sprites for a cartoonish strategy game: eight separate small objects, laid out in two rows of four, well apart and not touching, all at the same scale.',
    items: [
      { id: 'mucus', w: 84, text: 'a glob of glassy milky-white mucus trailing sticky stretched strands behind it' },
      { id: 'spore', w: 76, text: 'a small ball of clumped acid yellow-green spores with a few loose spores around it' },
      { id: 'web', w: 96, text: 'a bundle of sticky white web spreading open as it flies, its strands streaming behind' },
      { id: 'droplets', w: 72, text: 'a small cluster of shining acid yellow-green droplets flying together' },
      { id: 'cannon-shell', w: 64, text: 'a heavy round ball of dark iron with a brass band and rivets round its middle, old-fashioned' },
      { id: 'dart', w: 88, text: 'a slim glass capsule full of pale teal liquid with a short steel point at the right and small white fins at the left, like a toy dart' },
      { id: 'mortar-bomb', w: 80, text: 'a finned olive-green metal canister shaped like a teardrop, a brass cap at its rounded right end, small tail fins at the left' },
      { id: 'barb', w: 56, text: 'a small jagged barb of dark chitin, three short thorns splayed' },
    ],
  },
  {
    id: 'glows', key: null, cols: 1,
    lead: 'Game visual-effect sprites on a pure black background: six separate long horizontal effects stacked one above the other, well apart, each running from the left edge of its row to the right.',
    items: [
      { id: 'bolt-1', w: 320, text: 'a jagged forked bolt of blue-white electric lightning, thin and bright, with a faint blue glow' },
      { id: 'bolt-2', w: 320, text: 'another jagged bolt of blue-white lightning with a different path and one small side fork' },
      { id: 'bolt-3', w: 320, text: 'a third jagged bolt of blue-white lightning, more crooked, with crackling branches' },
      { id: 'beam', w: 320, text: 'a perfectly straight beam of focused pale blue-white light, a hot white core inside a soft cyan glow, even along its whole length' },
      { id: 'flame-1', w: 256, text: 'a jet of roaring orange and yellow fire shooting to the right from a narrow point at the left, widening into a fan of flame and dark smoke' },
      { id: 'flame-2', w: 256, text: 'another jet of roaring orange fire, the same shape, with different licks and curls of flame' },
    ],
  },
  {
    id: 'bursts', key: null, cols: 4,
    lead: 'Game visual-effect sprites on a pure black background, seen from 45 degrees above as in an isometric strategy game: eight separate effects in two rows of four, well apart and not touching, all at the same scale.',
    items: [
      { id: 'blast', w: 160, text: 'a fiery explosion: a ball of orange fire and black smoke with flying sparks' },
      { id: 'spore-burst', w: 150, text: 'a burst of glowing golden spores exploding outward in a round puff' },
      { id: 'acid-splash', w: 140, text: 'a splash of glowing acid yellow-green liquid bursting outward in droplets' },
      { id: 'flesh-splat', w: 130, text: 'a wet splat of dark red blood and flesh spraying outward in droplets' },
      { id: 'poison-cloud', w: 200, text: 'a soft round cloud of sickly violet and yellow-green poison gas, glowing faintly' },
      { id: 'mist-cloud', w: 200, text: 'a soft round cloud of pale acid yellow-green caustic mist, glowing faintly' },
      { id: 'web-mat', w: 140, text: 'a round tangle of sticky glistening white web strands, like a spider web seen from above' },
      { id: 'sedation-puff', w: 110, text: 'a small puff of pale teal glittering sedative vapour' },
    ],
  },
];

const sheetPrompt = (s) => {
  const list = s.items.map((it, i) => `(${i + 1}) ${it.text}`).join('; ');
  if (s.key) return `${s.lead} ${SIDE} In reading order: ${list}. ${SOLID_TAIL}`;
  return `${s.lead} In order: ${list}. Bright glowing colours on black, like visual effects for a video game. ${DARK_TAIL}`;
};

/** A part that one limb grafts onto another: what of the donor is seen. */
export const PARTS = {
  spitter: 'its puckered fleshy nozzle on a short stub of stalk',
  burster: 'a bunch of three taut dark-red sacs hanging from a short stem',
  lasher: 'one long whip-like tendril tipped with a dark chitin barb, loosely curled',
  maw: 'a small round mouth ringed with rows of small teeth, its gullet dark wine red',
  spine: 'three tall curved spines of dark chitin growing from a strip of muscle',
  lure: 'a small softly glowing bulb on a thin curved stalk',
  tangler: 'a tuft of glassy milky-white mucus strands stretched between two stubs',
  blighter: 'a cluster of four swollen acid yellow-green glands',
  impaler: 'a short ivory bone spike like the head of a harpoon',
  choir: 'three slender glassy milky-white pipes of different heights',
  sling: 'a small cocked tendon arm with a little basket at its end',
  brood: 'a cluster of glossy pink eggs',
  swamp: 'a small fleshy lip set with little teeth, dripping dark wine-red acid',
  frond: 'a small fern-like frond of pale blue-white nerve cords',
  lobber: 'a small cupped sling of muscle holding a glob of yellow bile',
  mister: 'two thin nozzles on stalks sprouting from a small acid yellow-green gland',
  ocular: 'a small wet eye with a pale blue iris on a short stalk wrapped in nerve cords',
  prism: 'a small faceted lens of clear cartilage held in a claw of pale nerve cords',
  bombard: 'a short chimney of overlapping ivory bone plates',
  ward: 'a small bubble of glassy milky-white membrane stretched over thin chitin ribs',
  quill: 'a small fan of five ivory quills',
  skipper: 'a short fat tube of ivory bone',
  lance: 'a short hose-like nozzle dribbling dark maroon slime',
  cage: 'three curved ribs of dark chitin like the bars of a small cage',
  sprout: 'two tiny leaf-like flaps of chitin on a short pale young stalk',
  net: 'a small hand of thin tendons holding a scrap of white web',
  ember: 'a small bladder glowing orange from within, with a short scorched black nozzle',
  conduit: 'a short split pipe of bone glowing with amber marrow',
  amp: 'a small horn of flesh like a trumpet bell, a violet membrane across its throat',
  mosaic: 'a small disc of tiles of differently coloured tissue in a violet membrane',
  twin: 'two small round glands side by side joined by a violet membrane',
  tap: 'a small bone spigot dripping amber marrow',
  mitosis: 'a pair of small buds filled with glowing amber marrow, joined by a neck of tissue',
  capacitor: 'a small sac of violet membrane banded with rings of dark chitin',
  boomerang: 'a small curved crescent of bone',
  press: 'two small hinged plates of bone with amber marrow oozing between them',
  reliquary: 'a tiny casket of bone lattice with amber marrow glowing through it',
};

const partPrompt = (family) => {
  const l = LIMBS.find((x) => x.family === family);
  return `The reference picture is a living organism. Draw ONLY one small detached part of it, alone and whole: ${PARTS[family]}. ` +
    `It is cut off at its root, where it would grow out of another creature: a short ragged stump of the same veined maroon flesh at its left end, and the part reaching up and to the right. ` +
    `Exactly the same materials, colours and rendering as the reference: the same deep maroon veined flesh, the same dark chitin, the same accent (${THEMES[l.theme].accent}). ` +
    'It is centred and fills about half of the picture. Isometric view, from 45 degrees above. Soft even light from directly overhead, no cast shadows, no text, no symbols.';
};

export async function generateSheets() {
  fs.mkdirSync(DIR, { recursive: true });
  const results = await pool(SHEETS, 4, (s) => makeStill({
    slug: `fx sheet ${s.id}`, out: path.join(DIR, `${s.id}.png`), prompt: sheetPrompt(s),
    ...(s.key ? { key: s.key.hex, keyName: s.key.name } : { key: null }),
    // Solid shots are drawn in the creep's own material where they are the body's.
    ...(s.id === 'body-shots' && fs.existsSync(CREEP) ? { refFiles: [CREEP] } : {}),
    width: 1536, height: 1024, quality: 'high',
  }));
  results.forEach((r, i) => { if (!r.ok) console.warn(`[fx] sheet ${SHEETS[i].id} failed: ${r.error.message.slice(0, 200)}`); });
}

export async function generateParts(only = []) {
  const families = (only.length ? only : Object.keys(PARTS)).filter((f) => PARTS[f]);
  const results = await pool(families, 6, (family) => {
    const l = LIMBS.find((x) => x.family === family);
    const key = THEMES[l.theme].key === 'blue' ? { hex: '0000FF', name: 'blue' } : { hex: '00FF00', name: 'green' };
    return makeStill({
      slug: `donor part ${family}`, out: path.join(DIR, 'parts', `${family}.png`), prompt: partPrompt(family),
      refFiles: [path.join(SRC, 'limbs', family, 'styled.png')], key: key.hex, keyName: key.name, quality: 'medium',
    });
  });
  results.forEach((r, i) => { if (!r.ok) console.warn(`[fx] part ${families[i]} failed: ${r.error.message.slice(0, 200)}`); });
}

/** Light and vapour on black: its brightness is its opacity, and its colour is what it is at full strength. */
function lumaKey(img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    const a = Math.max(0, Math.min(1, (m - 14) / 190));
    const alpha = Math.pow(a, 0.85);
    if (alpha <= 0.004) { d[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] / Math.max(alpha, m / 255)));
    d[i + 3] = Math.round(alpha * 255);
  }
  return img;
}

/** The sprites of one sheet: cut, keyed, trimmed and brought to their game size. */
function cutSheet(s) {
  const file = path.join(DIR, `${s.id}.png`);
  if (!fs.existsSync(file)) return [];
  const img = readImage(file);
  let found = findFigures(img, { expect: s.items.length, ...(s.key ? {} : { tolerance: 20 }) });
  let grid = null;
  if (found.boxes.length !== s.items.length || (!s.key && found.boxes.length < s.items.length)) {
    // Light and vapour run into each other: a sheet on black is cut on its grid instead.
    if (!s.key) grid = cutGrid(img, s.cols, Math.ceil(s.items.length / s.cols)).cells;
    else {
      console.warn(`[fx] ${s.id}: ${found.boxes.length} figures found, ${s.items.length} expected. Look at ${file}; move it away to draw again.`);
      return [];
    }
  }
  return s.items.map((it, i) => {
    let one = grid ? crop(img, grid[i].x0, grid[i].y0, grid[i].x1 - grid[i].x0, grid[i].y1 - grid[i].y0) : figure(img, found.boxes[i], found, 0.08);
    if (s.key) {
      keyFrame(one, keyOf(borderColour(one)), { spill: 'edge' });
      dropSpecks(one, 0.02);
    } else {
      lumaKey(one);
    }
    const b = bbox(one, s.key ? 60 : 20);
    if (!b) return null;
    one = crop(one, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    const w = Math.min(it.w, one.w);
    const h = Math.max(4, Math.round((one.h / one.w) * w));
    return { id: it.id, img: resize(one, w, h), extra: { anchor: [0.5, 0.5], ...(s.key ? {} : { glow: true }) } };
  }).filter(Boolean);
}

/** A donor part, cut off its background: its stump (where it grows from) is its anchor. */
function cutPart(family) {
  const file = path.join(DIR, 'parts', `${family}.png`);
  if (!fs.existsSync(file)) return null;
  const img = readImage(file);
  keyFrame(img, keyOf(borderColour(img)), { spill: 'edge' });
  dropSpecks(img, 0.04);
  const b = bbox(img, 60);
  if (!b) return null;
  const cut = crop(img, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  const w = 88;
  const h = Math.round((cut.h / cut.w) * w);
  const small = resize(cut, w, h);
  // The stump: the middle of the solid pixels of its leftmost tenth.
  let sy = 0, n = 0;
  for (let y = 0; y < small.h; y++) for (let x = 0; x < Math.ceil(small.w * 0.12); x++) {
    if (small.data[(y * small.w + x) * 4 + 3] > 128) { sy += y; n++; }
  }
  const anchor = [0.06, Number((n ? sy / n / small.h : 0.7).toFixed(3))];
  return { id: `part-${family}`, img: small, extra: { anchor } };
}

/** Free: the sheets and parts on disk to one atlas each, their manifest entry, and a picture to look at. */
export function bakeFx() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(LOOK, { recursive: true });
  const effects = SHEETS.flatMap(cutSheet);
  const parts = Object.keys(PARTS).map(cutPart).filter(Boolean);
  const entry = {};
  if (effects.length) {
    const packed = packSprites(effects, path.join(OUT, 'effects.webp'), 1024, 88);
    entry.effects = { atlas: 'fx/effects.webp', sprites: packed.rects };
    console.log(`[fx] effects: ${effects.length} sprites, ${Math.round(packed.bytes / 1024)} KB`);
    review(effects, path.join(LOOK, 'effects.jpg'));
  }
  if (parts.length) {
    const packed = packSprites(parts, path.join(OUT, 'parts.webp'), 1024, 88);
    entry.parts = { atlas: 'fx/parts.webp', sprites: packed.rects };
    console.log(`[fx] parts: ${parts.length} of ${Object.keys(PARTS).length}, ${Math.round(packed.bytes / 1024)} KB`);
    review(parts, path.join(LOOK, 'parts.jpg'));
  }
  if (entry.effects || entry.parts) putEntry('fx', 'fx', entry);
  return entry;
}

/** Every sprite on street colour and on creep colour, at the size it is baked, with its name's place kept by order. */
function review(sprites, file) {
  const cell = 176;
  const cols = 8;
  const rows = Math.ceil(sprites.length / cols);
  const sheet = blank(cols * cell, rows * cell * 2, [24, 24, 24, 255]);
  sprites.forEach((s, i) => {
    for (const [k, ground] of [[0, [196, 186, 160, 255]], [1, [84, 28, 34, 255]]]) {
      const x = (i % cols) * cell;
      const y = (Math.floor(i / cols) * 2 + k) * cell;
      const tile = blank(cell - 4, cell - 4, ground);
      const f = Math.min(1, (cell - 12) / Math.max(s.img.w, s.img.h));
      const im = f < 1 ? resize(s.img, Math.max(1, Math.round(s.img.w * f)), Math.max(1, Math.round(s.img.h * f))) : s.img;
      over(tile, im, Math.round((tile.w - im.w) / 2), Math.round((tile.h - im.h) / 2));
      over(sheet, tile, x + 2, y + 2);
    }
  });
  writeJpg(file, sheet);
}

export async function makeFx({ bakeOnly = false, only = [] } = {}) {
  const what = only[0];
  if (!bakeOnly) {
    if (!what || what === 'sheets') await generateSheets();
    if (!what || what === 'parts') await generateParts(only.slice(1));
  }
  return bakeFx();
}
