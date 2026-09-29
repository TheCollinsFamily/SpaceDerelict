/**
 * THE TERRAIN TEMPLATE: the board the game is played on.
 *
 *   flat textures (street, roof, creep, smoke-covered city, four kinds of wall) and sheets
 *   of props -> baked into isometric tiles, wall faces and cut-out props -> manifest entries
 *
 * Blocks are BUILT by the game from these pieces, because limbs stand on them: roofs are
 * flat and heights are exact. What is generated is what covers them.
 *
 *   node tools/art/make.mjs terrain            everything
 *   node tools/art/make.mjs terrain --bake     bake again from the pictures on disk (free)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill, pool } from '../rfab.mjs';
import { bbox, blank, crop, paste, readFrames, readImage, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { A, B, BLEED, SKIN_BLEED, LEVEL_H, TILE_H, TILE_W, WALL_SPAN, floorPoint, mirrorTile, noise, render, sample, wallPoint } from '../lib/iso.mjs';
import { keyClip, keyFrame, keyOf, loopWindow, pick, unionBox } from '../lib/key.mjs';
import { figure, findFigures } from '../lib/sheet.mjs';
import { borderColour } from '../lib/img.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';
import { GROUNDS } from '../lib/atlas.mjs';
import { drawCell } from '../lib/foot.mjs';

const DIR = path.join(SRC, 'terrain');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const NO_TEXT = 'No text and no lettering anywhere: any sign or screen shows only abstract glyphs. No crosses, no stars and no crescents.';
const FLAT =
  'Seen from exactly straight above, as a flat texture that fills the whole picture edge to edge with no border. ' +
  `Even flat light, no cast shadows, no objects standing on it, no perspective. ${NO_TEXT}`;

const TEXTURES = {
  street: `The paving of a street in an insect city: pale cream tiles of wax and pressed paper laid in a loose honeycomb pattern, worn and a little dusty, with a few hairline cracks and faint wheel marks. ${FLAT}`,
  plaza: `The paving of a town square in an insect city: pale cream tiles of wax and pressed paper laid in rings of hexagons, with thin inlaid lines of gold and coloured mosaic between the rings. ${FLAT}`,
  roof: `The flat roof terrace of a building in an insect city: pale grey-cream wasp paper laid in overlapping bands with a faint honeycomb pattern pressed into it, weathered, with a few patched places. ${FLAT}`,
  creep: `A living skin of flesh: dark maroon, matte, crossed by a net of thicker, darker, raised veins, glistening wet in a few places. ${FLAT}`,
  smoke: 'An aerial photograph taken from exactly straight above, filling the whole picture edge to edge: the rooftops of a dense insect city built of pale wasp paper and wax, small paper domes and honeycomb roofs packed tightly together with narrow lanes between them, seen through thick drifting grey smoke at dusk. Dark, dim and desaturated; a few tiny amber lights. No perspective. ' + NO_TEXT,
};

const FACADE =
  'A flat architectural elevation, in full colour and realistic detail, seen exactly from the front with no ' +
  'perspective, filling the whole picture edge to edge with no sky, no ground, no roof line and no border: part of ' +
  'the front of a building in an insect city, exactly three storeys high. The wall is pale wasp paper and wax ' +
  'built of honeycomb cells, with ribbed organic arches. The three storeys are exactly the same height, and a ' +
  'thin horizontal band of gold and coloured mosaic runs along the top of each storey. It is a city of the ' +
  '21st century.';
const WALLS = {
  plain: `${FACADE} It is a block of flats. Ground storey: round-arched doorways lit amber, a letter box, an electricity meter. Upper storeys: small round-arched windows lit amber, little balconies with washing hung out, air-conditioning units and a satellite dish fixed to the wall, cables. Even flat light, no cast shadows. ${NO_TEXT}`,
  science: `${FACADE} It is a research laboratory. Ground storey: glass doors in round arches, a security camera. Upper storeys: wide round-arched laboratory windows with brass frames, glowing screens seen inside, cable runs and cooling vents on the wall. Even flat light, no cast shadows. ${NO_TEXT}`,
  meat: `${FACADE} It is a food warehouse. Ground storey: wide round-arched loading doors with roller shutters, crates stacked beside them. Upper storeys: small round-arched windows, ledges with rows of honey-pot jars, a hoist beam, ventilation fans. Even flat light, no cast shadows. ${NO_TEXT}`,
  highground: `${FACADE} It is a temple. Ground storey: a tall arcade of round arches lit amber from within. Upper storeys: narrow round-arched windows, bronze bells hanging in niches, broad bands of rich gold and coloured mosaic, gilded ribs, small loudspeakers. Even flat light, no cast shadows. ${NO_TEXT}`,
};

const PROP_STYLE =
  'Isometric three-quarter top-down view, the camera 45 degrees above the ground, every object seen from the ' +
  'same direction. They stand in two rows, evenly spaced, well apart and not touching. Realistic and detailed, ' +
  'in exactly the materials and rendering of the city in the reference picture: pale wasp paper, wax and resin, ' +
  `honeycomb cells, gold mosaic. Soft even light from directly overhead. No ground, no cast shadows. ${NO_TEXT} No labels, no numbers.`;
/** width: how many cells wide the prop is drawn. */
const PROPS = {
  roof: {
    prompt: (list) => `A sheet of ${list.length} separate objects that stand on the roofs of an insect city, for a strategy game. ${PROP_STYLE} In reading order: ${list.map((p, i) => `(${i + 1}) ${p.look}`).join('; ')}.`,
    items: [
      { id: 'dome-paper', width: 0.8, look: 'an onion dome made of layered pale wasp paper like a hanging nest, on a short round drum, ending in a plain gold ball' },
      { id: 'dome-gold', width: 0.85, look: 'the same kind of onion dome, gilded all over, on a short round drum with a band of mosaic, ending in a plain gold ball' },
      { id: 'spire', width: 0.6, look: 'a slender bell tower like a nest spire of pale wasp paper, with round-arched openings and one bronze bell inside, ending in a plain gold ball' },
      { id: 'dish', width: 0.5, look: 'a white satellite dish on a short steel mast' },
      { id: 'aircon', width: 0.45, look: 'an air-conditioning unit: a grey metal box with one round fan grille' },
      { id: 'solar', width: 0.7, look: 'a dark blue solar panel on a low tilted frame' },
      { id: 'mast', width: 0.35, look: 'a tall thin radio mast with small antennas and one red lamp at the top' },
      { id: 'tank', width: 0.55, look: 'a round water tank of pale resin on four short legs' },
    ],
  },
  street: {
    prompt: (list) => `A sheet of ${list.length} separate objects that stand in the streets of an insect city, for a strategy game. ${PROP_STYLE} In reading order: ${list.map((p, i) => `(${i + 1}) ${p.look}`).join('; ')}.`,
    items: [
      { id: 'lamp', width: 0.3, look: 'a slender street lamp of brass with a glowing amber lantern' },
      { id: 'signal', width: 0.25, look: 'a traffic light on a brass post with three amber lamps' },
      { id: 'sign', width: 0.4, look: 'a glowing sign board on a post, showing one abstract glyph' },
      { id: 'car', width: 0.8, look: 'a small parked car shaped like a beetle, brass-coloured, with round headlamps' },
      { id: 'gate', width: 1.6, look: 'a wide round archway of pale wasp paper and gold mosaic, a city gate standing alone, open, with nothing behind it' },
      { id: 'pod', width: 0.5, look: 'a spore pod: a small round sac of pale green flesh with a few short roots, glistening' },
    ],
  },
};

const CORE =
  'The landing site, for a strategy game. Isometric three-quarter top-down view, the camera 45 degrees above ' +
  'the ground. A dark meteor the size of a house, half buried, split open around a pulsing crimson heart of ' +
  'glistening wet muscle. Thick root-like tendons of salmon-pink flesh armoured with dark chitin spread out ' +
  'from it over a low ring of broken pale paving and thrown-up earth. It is about as wide as it is tall. ' +
  'Realistic, detailed, wet and unglamorous, in exactly the materials and rendering of the reference picture. ' +
  'Soft even light from directly overhead. No cast shadows, no text.';

const CORE_MATERIAL =
  'Redraw the landing site of the FIRST picture so that the creature in it is made of exactly the living tissue ' +
  'shown in the SECOND picture: the same deep maroon and dark crimson flesh, lumpy and wet, crossed by the same ' +
  'net of darker raised veins, with the same small glossy highlights. Keep the split dark meteor and the ' +
  'glowing crimson heart inside it. The grey rubble is gone: around the meteor the ground is a thick mound of ' +
  'that tissue, from which heavy roots of the same flesh spread outward and melt into a low ragged skirt of it ' +
  'lying flat on the ground. Keep its size in the frame. The same view as the first picture: isometric, from ' +
  '45 degrees above. Soft even light from directly overhead, no cast shadows, no text.';

const SIZE = { floor: 1024, wall: [1536, 1024] };

async function generate(only) {
  const want = (id) => !only?.length || only.includes(id);
  const jobs = [];
  for (const [id, prompt] of Object.entries(TEXTURES)) {
    if (want(id)) jobs.push(() => makeStill({ slug: `texture ${id}`, out: path.join(DIR, `${id}.png`), prompt, key: null, width: SIZE.floor, height: SIZE.floor, quality: 'high' }));
  }
  for (const [id, prompt] of Object.entries(WALLS)) {
    if (want(`wall-${id}`) || want('walls')) jobs.push(() => makeStill({ slug: `wall ${id}`, out: path.join(DIR, `wall-${id}.png`), prompt, key: null, width: SIZE.wall[0], height: SIZE.wall[1], quality: 'high', refFiles: [path.join(CONCEPTS, 'city-hive-block-close.png')] }));
  }
  for (const [id, set] of Object.entries(PROPS)) {
    if (want(`props-${id}`) || want('props')) jobs.push(() => makeStill({ slug: `props ${id}`, out: path.join(DIR, `props-${id}.png`), prompt: set.prompt(set.items), width: 1536, height: 1024, quality: 'high', refFiles: [path.join(CONCEPTS, 'city-hive-blocks.png')] }));
  }
  if (want('core')) {
    jobs.push(async () => {
      const design = await makeStill({ slug: 'core', out: path.join(DIR, 'core.png'), prompt: CORE, width: 1024, height: 1024, quality: 'high', refFiles: [path.join(CONCEPTS, 'board-paper-city.png')] });
      // The core is redrawn in the creep's own tissue, as the limbs are (tools/art/limbs.mjs MATERIAL).
      const still = await makeStill({ slug: 'core in the material of the creep', out: path.join(DIR, 'core-styled.png'), prompt: CORE_MATERIAL, quality: 'high', refFiles: [design, path.join(DIR, 'creep.png')] });
      // The landing site is four cells wide on the board and a limb is one: its clip is made at 720p, or it
      // is seen at half the sharpness of the limbs round it (Collins: 'a different resolution than the towers').
      return makeClip({ slug: 'core idle', out: path.join(DIR, 'core-idle.mp4'), stillFile: still, resolution: '720p',
        prompt: 'The crimson heart inside the split meteor beats slowly and heavily; the flesh around it swells and relaxes with each beat; the tendons shift slightly. The meteor and the ground do not move. It stays at exactly the same spot and the same size.' });
    });
  }
  const results = await pool(jobs, 5, (j) => j());
  results.forEach((r) => { if (!r.ok) console.warn(`[terrain] a picture failed: ${r.error.message.slice(0, 200)}`); });
}

/** Rectangles packed into rows, tallest first. Returns each one's place and the sheet's size. */
function shelf(items, width) {
  const order = items.map((it, i) => ({ ...it, i })).sort((p, q) => q.h - p.h);
  let x = 0, y = 0, row = 0;
  const at = [];
  for (const it of order) {
    if (x + it.w > width) { x = 0; y += row; row = 0; }
    at[it.i] = { x, y };
    x += it.w;
    row = Math.max(row, it.h);
  }
  return { at, height: y + row };
}

export function packSprites(sprites, file, width = 2048) {
  const pad = sprites.map((s) => ({ w: s.img.w + 2, h: s.img.h + 2 }));
  const { at, height } = shelf(pad, width);
  const sheet = blank(width, height);
  const rects = {};
  sprites.forEach((s, i) => {
    paste(sheet, s.img, at[i].x + 1, at[i].y + 1);
    rects[s.id] = { x: at[i].x + 1, y: at[i].y + 1, w: s.img.w, h: s.img.h, ...(s.extra ?? {}) };
  });
  const png = file.replace(/\.webp$/, '.png');
  writePng(png, sheet);
  toWebp(png, file, { q: 90 });
  fs.rmSync(png);
  return { rects, bytes: fs.statSync(file).size };
}

const shade = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k), c[3]];

/** Floor diamonds of one texture: 4 x 4 cells, mirrored so that neighbours always match. */
export function floorTiles(id, tex, k = 1) {
  const out = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    out.push({ id: `${id}-${i}${j}`, img: render(TILE_W, TILE_H, (px, py) => {
      const p = floorPoint(px, py, BLEED);
      if (!p) return null;
      const c = sample(tex, mirrorTile(i, p.x) * tex.w, mirrorTile(j, p.y) * tex.h);
      return shade([c[0], c[1], c[2], 255], k);
    }) });
  }
  return out;
}

/**
 * Creep tiles: the same skin with a ragged edge on every side where the ground next to it
 * is bare. `open` has a bit per side (1 north, 2 east, 4 south, 8 west).
 */
export function creepTiles(tex) {
  const out = [];
  for (let open = 0; open < 16; open++) {
    const n = open === 0 ? 4 : 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      out.push({ id: `creep-${open}-${i}${j}`, img: render(TILE_W, TILE_H, (px, py) => {
        const p = floorPoint(px, py, SKIN_BLEED);
        if (!p) return null;
        let d = 1;
        if (open & 1) d = Math.min(d, p.y);
        if (open & 2) d = Math.min(d, 1 - p.x);
        if (open & 4) d = Math.min(d, 1 - p.y);
        if (open & 8) d = Math.min(d, p.x);
        // A ragged edge, and a shallow one: at most a fifth of the cell is left bare, so that
        // the ground the skin holds is nearly all of the ground (Collins: creep that stops short
        // of the edge "makes the usable space in a square highly variable").
        const lump = noise((i + p.x) * 5, (j + p.y) * 5, 10) * 0.13;
        const t = Math.max(0, Math.min(1, (d - 0.02 - lump) / 0.07));
        if (t <= 0) return null;
        const c = sample(tex, mirrorTile(i, p.x) * tex.w, mirrorTile(j, p.y) * tex.h);
        // The rim is thicker: darker, as if it cast a small shadow on itself.
        const rim = t < 1 ? 0.78 : 1;
        return [c[0] * rim, c[1] * rim, c[2] * rim, t * 255];
      }) });
    }
  }
  return out;
}

/**
 * Wall faces: every kind, every level of the three, both faces, and every place along the
 * street before the texture repeats. A cell shows a quarter of the facade, so that a window
 * is big enough to read at game size.
 */
export function wallTiles(id, tex) {
  const out = [];
  for (const side of ['south', 'east']) {
    for (let level = 0; level < 3; level++) for (let i = 0; i < 2 * WALL_SPAN; i++) {
      out.push({ id: `wall-${id}-${side}-${level}-${i}`, img: render(A, B + LEVEL_H, (px, py) => {
        const p = wallPoint(px, py, side);
        if (!p) return null;
        const c = sample(tex, mirrorTile(i, p.t, WALL_SPAN) * tex.w, ((2 - level + p.v) / 3) * tex.h);
        return shade([c[0], c[1], c[2], 255], side === 'south' ? 0.92 : 0.64);
      }) });
    }
  }
  return out;
}

/**
 * What makes a roof read as a roof when the skin covers it to its edge: a lit lip along
 * each of its two front edges, where the skin rolls over and down the wall, and shade along
 * each of its two back edges, at the foot of a taller block behind it. Four tiles, laid
 * over the floor or the skin of a cell.
 */
export function edgeTiles() {
  const band = (id, along, colour, reach, strength, power) => ({ id, img: render(TILE_W, TILE_H, (px, py) => {
    const p = floorPoint(px, py, BLEED);
    if (!p) return null;
    const d = along(p);
    if (d >= reach) return null;
    const t = Math.pow(1 - Math.max(0, d) / reach, power);
    return [colour[0], colour[1], colour[2], 255 * strength * t];
  }) });
  return [
    band('edge-lip-south', (p) => 1 - p.y, [236, 150, 140], 0.11, 0.62, 1.4),
    band('edge-lip-east', (p) => 1 - p.x, [200, 110, 104], 0.11, 0.5, 1.4),
    band('edge-shade-north', (p) => p.y, [14, 6, 8], 0.5, 0.62, 2),
    band('edge-shade-west', (p) => p.x, [14, 6, 8], 0.5, 0.62, 2),
  ];
}

/** Creep running down the top of a wall. */
export function dripTiles(tex) {
  const out = [];
  for (const side of ['south', 'east']) for (let i = 0; i < 4; i++) {
    out.push({ id: `drip-${side}-${i}`, img: render(A, B + LEVEL_H, (px, py) => {
      const p = wallPoint(px, py, side);
      if (!p) return null;
      const reach = 0.25 + 0.75 * Math.pow(noise((i + p.t) * 6, 3.7, 24), 1.6);
      const t = Math.max(0, Math.min(1, (reach - p.v) / 0.12));
      if (t <= 0) return null;
      const c = sample(tex, mirrorTile(i, p.t) * tex.w, p.v * 0.5 * tex.h);
      const k = side === 'south' ? 0.85 : 0.6;
      return [c[0] * k, c[1] * k, c[2] * k, t * 235];
    }) });
  }
  return out;
}

/** The props of one sheet, cut off their background and brought to their size on the board. */
function propSprites(setId) {
  return cutProps(path.join(DIR, `props-${setId}.png`), PROPS[setId].items, setId);
}

/** The objects of one sheet, in reading order, each cut out and brought to its size on the board. */
export function cutProps(file, items, setId, keying = {}) {
  if (!fs.existsSync(file)) return [];
  const img = readImage(file);
  const found = findFigures(img, { expect: items.length });
  if (found.boxes.length !== items.length) {
    console.warn(`[terrain] props ${setId}: ${found.boxes.length} objects found, ${items.length} expected. Look at ${file}; delete it to draw again.`);
    return [];
  }
  const key = keyOf(borderColour(img));
  return items.map((item, i) => {
    const one = figure(img, found.boxes[i], found, 0.04);
    keyFrame(one, key, keying);
    const b = bbox(one, 128);
    const cut = crop(one, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    const w = Math.max(8, Math.round(item.width * TILE_W * 0.72));
    const h = Math.round((cut.h / cut.w) * w);
    return { id: `prop-${item.id}`, img: resize(cut, w, h), extra: { anchor: [0.5, 0.94], on: setId } };
  });
}

/**
 * WHERE THE LANDING SITE LIES, marked by eye as the limbs' footings are (tools/art/limbs.mjs,
 * foot): [x, y, width] as shares of the box that holds it in the first frame of its clip:
 * the middle of the skirt it lies in, and how wide that skirt is without the tips of its
 * roots. It was anchored by the front of its skirt, a third of itself too far back, and lay
 * over the roofs behind it (Collins: "it looks like it's floating").
 */
const CORE_FOOT = [0.5, 0.64, 0.9];

function bakeCore() {
  const clip = path.join(DIR, 'core-idle.mp4');
  if (!fs.existsSync(clip)) return null;
  // As sharp on the board as a limb is: a limb has about 1.6 pixels of its frame to each pixel of the board.
  const F = 640;
  const COLS = 4;
  const keyed = keyClip(readFrames(clip, 12));
  const loop = loopWindow(keyed.frames, { min: 12, max: 46 });
  const frames = keyed.frames.slice(loop.start, loop.end);
  const box = unionBox(frames);
  const first = unionBox([keyed.frames[0]]);
  const foot = {
    x: first.x0 + CORE_FOOT[0] * (first.x1 - first.x0),
    y: first.y0 + CORE_FOOT[1] * (first.y1 - first.y0),
    width: CORE_FOOT[2] * (first.x1 - first.x0),
  };
  const side = Math.ceil(Math.max(2 * Math.max(foot.x - box.x0, box.x1 - foot.x), box.y1 - box.y0) * 1.04);
  const x0 = Math.round(foot.x - side / 2);
  const y0 = Math.round((box.y0 + box.y1) / 2 - side / 2);
  const kept = pick(frames, 16).map((f) => resize(crop(f, x0, y0, side, side), F, F));
  const sheet = blank(COLS * F, Math.ceil(kept.length / COLS) * F);
  kept.forEach((f, i) => paste(sheet, f, (i % COLS) * F, Math.floor(i / COLS) * F));
  const png = path.join(ART, 'board', 'core.png');
  writePng(png, sheet);
  toWebp(png, png.replace(/\.png$/, '.webp'), { q: 88 });
  fs.rmSync(png);
  console.log(`[terrain] core: ${kept.length} frames, loop seam ${loop.seam.toFixed(2)}`);
  // To look at: the landing site on the square it fell on, four cells across, with the square drawn under it.
  const half = (foot.width / side) * F / 2 / 0.92;
  const look = blank(F, F, [...GROUNDS.street, 255]);
  const ay = (foot.y - y0) / side;
  drawCell(look, F / 2, ay * F, half * Math.SQRT2, [255, 255, 255], 0.8);
  over8(look, kept[0], 0, 0);
  writeJpg(path.join(REVIEW, 'terrain', 'core-standing.jpg'), look, 3);
  return {
    atlas: 'board/core.webp', frame: F, cols: COLS, count: kept.length, fps: Number((kept.length / (frames.length / 12)).toFixed(2)),
    /** The point of the frame that lies on the middle of the square, and how wide what it lies in is (a share of the frame). */
    anchor: [0.5, Number(ay.toFixed(4))], body: Number((foot.width / side).toFixed(3)),
    cells: 3.2, seam: Number(loop.seam.toFixed(2)),
  };
}

export function bakeTerrain() {
  fs.mkdirSync(path.join(ART, 'board'), { recursive: true });
  const have = (f) => fs.existsSync(path.join(DIR, f));
  const tex = (f, w, h) => readImage(path.join(DIR, f), { w, h });
  const floors = [];
  if (have('street.png')) floors.push(...floorTiles('street', tex('street.png', 512, 512)));
  if (have('plaza.png')) floors.push(...floorTiles('plaza', tex('plaza.png', 512, 512)));
  if (have('roof.png')) floors.push(...floorTiles('roof', tex('roof.png', 512, 512)));
  if (have('smoke.png')) floors.push(...floorTiles('smoke', tex('smoke.png', 512, 512), 0.55));
  const creepTex = have('creep.png') ? tex('creep.png', 512, 512) : null;
  const creep = creepTex ? [...creepTiles(creepTex), ...dripTiles(creepTex), ...edgeTiles()] : [];
  const walls = [];
  for (const id of Object.keys(WALLS)) if (have(`wall-${id}.png`)) walls.push(...wallTiles(id, tex(`wall-${id}.png`, 1024, 384)));
  const props = [...propSprites('roof'), ...propSprites('street')];

  const sheets = { floors, creep, walls, props };
  const entry = { tile: [TILE_W, TILE_H], level: LEVEL_H, wallSpan: WALL_SPAN, sheets: {} };
  let total = 0;
  for (const [name, sprites] of Object.entries(sheets)) {
    if (!sprites.length) { console.warn(`[terrain] ${name}: nothing to bake`); continue; }
    const packed = packSprites(sprites, path.join(ART, 'board', `${name}.webp`));
    entry.sheets[name] = { atlas: `board/${name}.webp`, sprites: packed.rects };
    total += packed.bytes;
    console.log(`[terrain] ${name}: ${sprites.length} sprites, ${Math.round(packed.bytes / 1024)} KB`);
  }
  const core = bakeCore();
  if (core) entry.core = core;
  putEntry('board', 'terrain', entry);
  console.log(`[terrain] baked: ${Math.round(total / 1024)} KB in ${Object.keys(entry.sheets).length} sheets`);
  townPicture(Object.fromEntries(Object.values(sheets).flat().map((s) => [s.id, s.img])),
    PROPS.roof.items.map((p) => `prop-${p.id}`), path.join(REVIEW, 'terrain', 'town.jpg'));
  return entry;
}

/** One picture of a small stretch of city built from the baked pieces, to look at. */
export function townPicture(by, roofIds, file, streetIds = []) {
  const N = 8;
  const W = N * TILE_W + 40;
  const H = N * TILE_H + 4 * LEVEL_H + 60;
  const out = blank(W, H, [20, 18, 16, 255]);
  // A little town: a street cross, blocks of three heights in the four corners.
  const height = (x, y) => (x === 3 || x === 4 || y === 3 || y === 4 ? 0 : 1 + ((Math.floor(x / 2) * 3 + Math.floor(y / 2) * 5) % 3));
  const kind = (x, y) => (x < 3 ? (y < 3 ? 'plain' : 'science') : (y < 3 ? 'meat' : 'highground'));
  const creeped = (x, y) => x >= 4 && y >= 2;
  const put = (img, sx, sy) => { if (img) over8(out, img, Math.round(sx), Math.round(sy)); };
  for (let d = 0; d < 2 * N; d++) for (let x = 0; x < N; x++) {
    const y = d - x;
    if (y < 0 || y >= N) continue;
    const h = height(x, y);
    const sx = W / 2 + (x - y) * A - A;
    const sy = 40 + 3 * LEVEL_H + (x + y) * B;
    if (h === 0) {
      const square = (x === 3 || x === 4) && (y === 3 || y === 4);
      put(by[`${square ? 'plaza' : 'street'}-${x % 4}${y % 4}`], sx, sy);
    } else {
      const k = kind(x, y);
      for (let l = 0; l < h; l++) {
        if (height(x, y + 1) <= l) put(by[`wall-${k}-south-${l}-${x % (2 * WALL_SPAN)}`], sx, sy + B - (l + 1) * LEVEL_H);
        if (height(x + 1, y) <= l) put(by[`wall-${k}-east-${l}-${2 * WALL_SPAN - 1 - (y % (2 * WALL_SPAN))}`], sx + A, sy + B - (l + 1) * LEVEL_H);
      }
      put(by[`roof-${x % 4}${y % 4}`], sx, sy - h * LEVEL_H);
    }
    if (creeped(x, y)) {
      // The skin stops at a ragged edge only where the same surface goes on bare; at the edge
      // of a roof it runs to the edge and down the wall (the game: src/render/iso.ts creepRunsOn).
      let open = 0;
      const bare = (nx, ny) => nx >= 0 && ny >= 0 && nx < N && ny < N && height(nx, ny) === h && !creeped(nx, ny);
      if (bare(x, y - 1)) open |= 1; if (bare(x + 1, y)) open |= 2; if (bare(x, y + 1)) open |= 4; if (bare(x - 1, y)) open |= 8;
      const n = open === 0 ? 4 : 2;
      if (h > 0) {
        if (height(x, y + 1) < h) put(by[`drip-south-${x % 4}`], sx, sy + B - h * LEVEL_H);
        if (height(x + 1, y) < h) put(by[`drip-east-${3 - (y % 4)}`], sx + A, sy + B - h * LEVEL_H);
      }
      put(by[`creep-${open}-${x % n}${y % n}`], sx, sy - h * LEVEL_H);
      if (h > 0) {
        if (height(x, y + 1) < h) put(by['edge-lip-south'], sx, sy - h * LEVEL_H);
        if (height(x + 1, y) < h) put(by['edge-lip-east'], sx, sy - h * LEVEL_H);
      }
    } else if (h > 0 && (x * 7 + y * 3) % 4 === 0) {
      const img = by[roofIds[(x * 5 + y * 11) % roofIds.length]];
      if (img) put(img, sx + A - img.w / 2, sy + B - h * LEVEL_H - img.h * 0.94);
    }
    // A roof at the foot of a taller block lies in its shade.
    if (h > 0) {
      if (height(x, y - 1) > h) put(by['edge-shade-north'], sx, sy - h * LEVEL_H);
      if (height(x - 1, y) > h) put(by['edge-shade-west'], sx, sy - h * LEVEL_H);
    }
    // Street furniture stands at the back of the street, against the wall behind it.
    if (h === 0 && streetIds.length && !creeped(x, y) && (x * 3 + y * 5) % 3 === 0 && (height(x, y - 1) > 0 || height(x - 1, y) > 0)) {
      const img = by[streetIds[(x * 7 + y * 13) % streetIds.length]];
      const back = height(x, y - 1) > 0 ? [0.5, 0.2] : [0.2, 0.5];
      if (img) put(img, sx + A + (back[0] - back[1]) * A - img.w / 2, sy + (back[0] + back[1]) * B - img.h * 0.94);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJpg(file, out, 3);
  return file;
}

export function over8(dst, src, x, y) {
  for (let r = 0; r < src.h; r++) {
    const dy = y + r;
    if (dy < 0 || dy >= dst.h) continue;
    for (let c = 0; c < src.w; c++) {
      const dx = x + c;
      if (dx < 0 || dx >= dst.w) continue;
      const s = (r * src.w + c) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      const d = (dy * dst.w + dx) * 4;
      for (let k = 0; k < 3; k++) dst.data[d + k] = Math.round(src.data[s + k] * a + dst.data[d + k] * (1 - a));
      dst.data[d + 3] = 255;
    }
  }
}

export async function makeTerrain({ bakeOnly = false, only } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  if (!bakeOnly) await generate(only);
  return bakeTerrain();
}
