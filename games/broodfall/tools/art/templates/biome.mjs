/**
 * THE TILE SET TEMPLATE: the same board in another kind of place (tools/art/biomes.mjs).
 *
 *   floors, walls, sheets of roof props and sheets of street props
 *   -> baked into public/art/board/<set>/ -> one entry under "biomes" in the manifest
 *
 * A set has MORE THAN ONE of most pieces, so that a board is not the same building forty
 * times: two buildings for each kind of district, three roofs, one or two streets, two sheets
 * of each kind of prop. The first of a kind keeps the name it always had (roof-IJ,
 * wall-plain-south-0-3); a later one has its number after a tilde (roof~1-IJ,
 * wall-plain~1-south-0-3). The manifest entry says how many there are ("variants").
 *
 * The body (creep, core, spore pods) and the smoke over the unclaimed city are the same in
 * every set and stay in the terrain entry (templates/terrain.mjs), with the floors, walls and
 * props the game falls back to. Those are the first pictures of the first set, the Temple
 * Cities, which is baked here too, from copies of them.
 *
 *   node tools/art/make.mjs biome                    every set
 *   node tools/art/make.mjs biome megacity orient    some
 *   node tools/art/make.mjs biome suburb walls       some pictures of a set: floors, walls, props, first, more,
 *                                                    or one by name (roof, wall-plain, props-street, roof.2)
 *   node tools/art/make.mjs biome --bake             bake again from the pictures on disk (free)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool } from '../rfab.mjs';
import { blank, readImage, writeJpg } from '../lib/img.mjs';
import { A, B, LEVEL_H, TILE_H, TILE_W, WALL_SPAN } from '../lib/iso.mjs';
import { ART, REVIEW, SRC, putEntry } from '../lib/manifest.mjs';
import { BIOMES, KINDS, NO_SYMBOLS, SPECIES, SPECIES_THINGS, backName, biome, isRound, pictureName, roofSets, spriteName, variantsOf, wallsOf } from '../biomes.mjs';
import { creepTiles, cutProps, dripTiles, edgeTiles, floorTiles, over8, packSprites, wallTiles } from './terrain.mjs';

const TERRAIN = path.join(SRC, 'terrain');
/** The least mean brightness of a street or a square, of 255. */
const PALE = 132;
/** What a set may weigh, all of its sheets together (tests/iso.test.ts allows 900 KB). */
const HEAVY = 880 * 1024;

const FLAT =
  'Seen from exactly straight above, as a flat texture that fills the whole picture edge to edge with no border. ' +
  `Even flat light, no cast shadows, no objects standing on it, no perspective. ${NO_SYMBOLS}`;

/**
 * The face of a bank of LAND (open country): three steps as high as three storeys, so that it
 * is cut into levels as a wall is, and nothing built on it but what its words say. The
 * reference picture gives the flat view and the height of a step, and nothing else: it is a
 * row of doors, and a face of land that took after it would be a row of doors in a bank.
 */
const landFace = (b, words) =>
  'A flat elevation, in full colour and realistic detail, seen exactly from the front with no perspective, filling ' +
  'the whole picture edge to edge with no sky, no horizon and no border: the face of a bank of land, exactly three ' +
  'steps high, the three steps exactly the same height, each with a narrow ledge along its top. It is NOT a ' +
  `building and has no doors, windows or walls except what is said here. ${b.land ?? 'Open country of an insect people of the 21st century'}. ${words} ` +
  'The reference picture shows only how high one step is and the flat frontal view: nothing that is built in it is ' +
  `taken. Even flat light, no cast shadows. ${NO_SYMBOLS}`;

/**
 * The front of one building. Open country says itself what its "building" is (front), what
 * runs along the top of each storey (band) and how its people build (species): the words
 * every town shares say "building", "trim" and "city".
 *
 * Every wall is drawn with the first set's plain wall beside it, for its flat view and its
 * scale. That picture also pulls every wall toward its own row of six arched doors, which is
 * why the first buildings of all the sets are laid out alike. A second building is told to
 * take the view and the scale from it and nothing else.
 */
const facade = (b, words, v = 0) =>
  'A flat architectural elevation, in full colour and realistic detail, seen exactly from the front with no ' +
  'perspective, filling the whole picture edge to edge with no sky, no ground, no roof line and no border: ' +
  `${b.front ?? 'part of the front of a building, exactly three storeys high'}. ${b.species ?? SPECIES}. ${b.look}. ` +
  `The three storeys are exactly the same height, and ${b.band ?? 'a thin horizontal band of trim'} runs along ` +
  `the top of each storey. ${words} ` +
  (b.front
    ? 'The reference picture shows a town of the same people: keep its flat frontal view, its three equal ' +
      'storeys and the size of its doors and windows. The style, the materials and what is built are the ones ' +
      'described here, not the ones of the reference. '
    : 'The reference picture shows another district of the same city: keep its flat frontal view, its three equal ' +
      'storeys and the size of its doors and windows. The style is the one described here, not the one of the ' +
      'reference. ') +
  (v
    ? 'This is ANOTHER building than the one in the reference picture and it is laid out differently: the number, ' +
      'the size and the spacing of its doors and windows, and its colours, are the ones described here. Only the ' +
      'flat view, the three equal storeys and the scale are taken from the reference. '
    : '') +
  `Even flat light, no cast shadows. ${NO_SYMBOLS}`;

const propSheet = (b, where, list) =>
  `A sheet of ${list.length} separate objects that stand ` +
  `${b.place?.[where] ?? `${where === 'roof' ? 'on the roofs' : 'in the streets'} of an insect city`}, for a strategy game. ` +
  'Isometric three-quarter top-down view, the camera 45 degrees above the ' +
  'ground, every object seen from the same direction. They stand in two rows, evenly spaced, well apart and not ' +
  `touching. Realistic and detailed. ${SPECIES_THINGS}. ${b.look}. They are drawn from the same view and in the ` +
  'same rendering as the objects in the reference picture, which belong to another district of the same city' +
  // The reference sheet is on green: a set keyed on green has the same background as it.
  `${b.key[1] === 'green' ? '' : '; the background colour is not the reference\'s'}. Soft even light from directly overhead. No ground, no cast ` +
  `shadows. ${NO_SYMBOLS} No labels, no numbers. In reading order: ${list.map((p, i) => `(${i + 1}) ${p.look}`).join('; ')}.`;

const dirOf = (b) => path.join(TERRAIN, b.id);
/** The street props a set has pictures of. */
const ownStreet = (b) => b.streetProps.filter((p) => p.look);

/**
 * Every picture of a set, in the order it is drawn and baked: which piece it is (part), its
 * number among the pieces of its kind (v, the first is 0), its file, and what it is drawn from.
 */
function pieces(b) {
  const out = [];
  const floor = (part, v, words) => out.push({ part, v, group: 'floors', file: pictureName(part, v), words });
  [b.street, ...(b.streets ?? [])].forEach((words, v) => floor('street', v, words));
  floor('plaza', 0, b.plaza);
  [b.roof, ...(b.roofs ?? [])].forEach((words, v) => floor('roof', v, words));
  for (const kind of KINDS) {
    wallsOf(b, kind).forEach((w, v) => {
      const land = typeof w === 'object' && w.land;
      out.push({ part: `wall-${kind}`, kind, v, group: 'walls', file: pictureName(`wall-${kind}`, v), words: land ? w.words : w, land });
    });
  }
  for (const [where, sheets] of [['roof', [b.roofProps, b.roofProps2]], ['street', [ownStreet(b), b.streetProps2]]]) {
    sheets.forEach((items, v) => {
      if (items?.length) out.push({ part: `props-${where}`, where, v, group: 'props', file: pictureName(`props-${where}`, v), items });
    });
  }
  return out;
}

/**
 * At most four pictures are being drawn at one moment, however many sets are made at once
 * (make.mjs makes three sets side by side). Several sessions draw on the same account.
 */
const AT_ONCE = 4;
let drawing = 0;
const waiting = [];
async function inTurn(job) {
  if (drawing < AT_ONCE) drawing++; else await new Promise((go) => waiting.push(go));
  try { return await job(); } finally {
    const next = waiting.shift();
    if (next) next(); else drawing--;
  }
}

/**
 * The first pictures of the Temple Cities are the terrain entry's own (art-src/terrain/*.png):
 * they are copied, never drawn a second time, so that the two are the same pictures.
 */
function borrowFirst(b) {
  if (b.firstPictures !== 'terrain') return;
  for (const p of pieces(b).filter((q) => q.v === 0)) {
    const from = path.join(TERRAIN, p.file);
    const to = path.join(dirOf(b), p.file);
    if (!fs.existsSync(to) && fs.existsSync(from)) fs.copyFileSync(from, to);
  }
}

/**
 * THE BACKS OF THE PROPS (Sep 29 2026: the camera turns, and a car seen from both sides must
 * not be the same car). Every sheet of props with a lopsided thing on it has a second sheet: the
 * same things, in the same places and order, each turned half a turn. It is drawn FROM the front
 * sheet, so that they are the same things; it is cut by the same cutter.
 */
const backSheet = (items) =>
  `The SAME sheet of ${items.length} separate objects as the reference picture: the same objects, in the same ` +
  'places, in the same order, at the same sizes, in the same drawing and on the same flat background colour. Each ' +
  'object is turned exactly half a turn about its own upright axis, so that the camera now sees its BACK: what ' +
  'faced the lower left of the picture now faces away, toward the upper right. The camera itself is the same: ' +
  'isometric, 45 degrees above the ground. Nothing is added or taken away. Soft even light from directly overhead, ' +
  `no ground, no cast shadows. ${NO_SYMBOLS} No labels, no numbers.`;
const needsBack = (p) => p.group === 'props' && p.items.some((item) => !isRound(item));

export async function generateBacks(id) {
  const b = biome(id);
  const dir = dirOf(b);
  const [key, keyName] = b.key;
  const jobs = pieces(b).filter(needsBack).filter((p) => fs.existsSync(path.join(dir, p.file))).map((p) => () => makeStill({
    slug: `${b.id} ${p.part.replace('-', ' ')}${p.v ? ` ${p.v + 1}` : ''} from behind`, out: path.join(dir, backName(p.file)),
    prompt: backSheet(p.items), key, keyName, quality: 'high', width: 1536, height: 1024, refFiles: [path.join(dir, p.file)],
  }));
  const results = await pool(jobs, AT_ONCE, (j) => inTurn(j));
  results.filter((r) => !r.ok).forEach((r) => console.warn(`[biome] ${b.id}: a back failed: ${r.error.message.slice(0, 200)}`));
}

/** What a picture is drawn from: the whole of what the image model is told. */
const wordsFor = (b, p) => (p.group === 'floors' ? `${p.words} ${FLAT}` : p.group === 'walls' ? (p.land ? landFace(b, p.words) : facade(b, p.words, p.v)) : propSheet(b, p.where, p.items));

/** Every picture of a set with the words it is drawn from, to read them before paying for them. */
export const wordsOf = (id) => pieces(biome(id)).map((p) => ({ file: p.file, words: wordsFor(biome(id), p) }));

async function generate(b, only) {
  const want = (p) => !only?.length || [p.part, `${p.part}.${p.v}`, p.group, p.v === 0 ? 'first' : 'more'].some((name) => only.includes(name));
  const dir = dirOf(b);
  const [key, keyName] = b.key;
  const jobs = pieces(b).filter(want).map((p) => () => {
    const base = { slug: `${b.id} ${p.part.replace('-', ' ')}${p.v ? ` ${p.v + 1}` : ''}`, out: path.join(dir, p.file), prompt: wordsFor(b, p), quality: 'high' };
    if (p.group === 'floors') return makeStill({ ...base, key: null, width: 1024, height: 1024 });
    if (p.group === 'walls') return makeStill({ ...base, key: null, width: 1536, height: 1024, refFiles: [path.join(TERRAIN, 'wall-plain.png')] });
    return makeStill({ ...base, key, keyName, width: 1536, height: 1024, refFiles: [path.join(TERRAIN, `props-${p.where}.png`)] });
  });
  const results = await pool(jobs, AT_ONCE, (j) => inTurn(j));
  const failed = results.filter((r) => !r.ok);
  failed.forEach((r) => console.warn(`[biome] ${b.id}: a picture failed: ${r.error.message.slice(0, 200)}`));
  return failed.length;
}

export function bakeBiome(id) {
  const b = biome(id);
  if (!b) throw new Error(`no such tile set: ${id}`);
  const dir = dirOf(b);
  const out = path.join(ART, 'board', b.id);
  fs.mkdirSync(out, { recursive: true });
  borrowFirst(b);
  const have = (f) => fs.existsSync(path.join(dir, f));
  const tex = (f, w, h) => readImage(path.join(dir, f), { w, h });
  const all = pieces(b);
  // The game counts the pieces of a kind from the first: a later one is baked only when every one before it is there.
  const there = (part) => {
    const mine = all.filter((p) => p.part === part);
    const gap = mine.findIndex((p) => !have(p.file));
    return gap < 0 ? mine : mine.slice(0, gap);
  };

  // Units are dark and walk in the streets: a street that came out dark is brought up until they read on it.
  const ground = (p) => (p.part === 'roof' ? tex(p.file, 512, 512) : liftTo(tex(p.file, 512, 512), PALE));
  const streetPieces = there('street');
  const streetLuma = streetPieces.map((p) => luma(ground(p)));
  const floorPieces = [...streetPieces, ...there('plaza'), ...there('roof')];
  const floors = floorPieces.flatMap((p) => floorTiles(spriteName(p.part, p.v), ground(p)));
  const wallPieces = KINDS.flatMap((kind) => there(`wall-${kind}`));
  const walls = wallPieces.flatMap((p) => wallTiles(spriteName(p.kind, p.v), tex(p.file, 1024, 384)));
  // Painted things keep their own colours: the key's tint is taken off their outlines only.
  const keying = { spill: b.spill ?? 'edge' };
  const sheetsOf = (where) => there(`props-${where}`).map((p) => ({ ...p, cut: cutProps(path.join(dir, p.file), p.items, where, keying) }));
  const roofSheets = sheetsOf('roof');
  const streetSheets = sheetsOf('street');
  // What is the body's own (the spore pod) is on the first set's sheet, and is the terrain entry's to draw.
  const shared = new Set(all.flatMap((p) => p.items ?? []).filter((item) => item.shared).map((item) => `prop-${item.id}`));
  const roofs = roofSheets.flatMap((p) => p.cut);
  const streets = streetSheets.flatMap((p) => p.cut).filter((s) => !shared.has(s.id));
  // The backs of the lopsided ones: prop-<id>~b. A back sheet that did not cut into as many things as its front is left out.
  const backs = [...roofSheets, ...streetSheets].flatMap((p) => {
    const file = path.join(dir, backName(p.file));
    if (!needsBack(p) || !fs.existsSync(file)) return [];
    const cut = cutProps(file, p.items, `${p.where} back`, keying);
    if (cut.length !== p.items.length) return [];
    return cut.filter((s, i) => !isRound(p.items[i]) && !shared.has(s.id)).map((s) => ({ ...s, id: `${s.id}~b` }));
  });
  const backsMeant = [...roofSheets, ...streetSheets].filter(needsBack).reduce((n, p) => n + p.items.filter((item) => !isRound(item)).length, 0);
  const sheets = { floors, walls, props: [...roofs, ...streets, ...backs] };

  // Light to load: a set that comes out heavy is packed again a little harder, until it is not.
  const data = { tile: [TILE_W, TILE_H], level: LEVEL_H, wallSpan: WALL_SPAN, sheets: {} };
  let bytes = 0;
  let heaviest = 0;
  let quality = 90;
  for (; quality >= 70; quality -= 4) {
    bytes = 0;
    heaviest = 0;
    for (const [name, sprites] of Object.entries(sheets)) {
      if (!sprites.length) continue;
      const packed = packSprites(sprites, path.join(out, `${name}.webp`), 2048, quality);
      data.sheets[name] = { atlas: `board/${b.id}/${name}.webp`, sprites: packed.rects };
      bytes += packed.bytes;
      heaviest = Math.max(heaviest, packed.bytes);
    }
    if (bytes < HEAVY) break;
  }
  fs.writeFileSync(path.join(out, 'biome.json'), `${JSON.stringify(data)}\n`);

  // What the game is told is what was baked, not what was meant: a picture that is missing is not promised.
  const meant = variantsOf(b);
  const variants = {
    walls: Object.fromEntries(KINDS.map((kind) => [kind, there(`wall-${kind}`).length])),
    roof: there('roof').length, street: streetPieces.length, plaza: there('plaza').length,
  };
  const baked = new Set(sheets.props.map((s) => s.id));
  const roofProps = Object.fromEntries(Object.entries(roofSets(b)).map(([kind, ids]) => [kind, ids.filter((p) => baked.has(`prop-${p}`))]));
  const streetProps = [...b.streetProps, ...(b.streetProps2 ?? [])]
    .filter((p) => !p.never && !p.shared && (baked.has(`prop-${p.id}`) || !p.look)).map((p) => p.id);
  const later = [...(b.roofProps2 ?? []), ...(b.streetProps2 ?? [])].map((p) => p.id);
  const first = [...b.roofProps, ...b.streetProps].map((p) => p.id);
  const twice = later.filter((p, i) => later.indexOf(p) !== i || first.includes(p) || p === 'pod');
  const cutOut = (list) => list.every((p) => p.cut.length === p.items.length);
  const count = (list) => `${list.reduce((n, p) => n + p.cut.length, 0)} of ${list.reduce((n, p) => n + p.items.length, 0)}`;
  const wallFaces = 2 * 3 * 2 * WALL_SPAN;
  const sumWalls = (v) => KINDS.reduce((n, kind) => n + v.walls[kind], 0);

  const checks = [
    ['every floor', floors.length === 16 * (meant.roof + meant.street + meant.plaza), `${floors.length} of ${16 * (meant.roof + meant.street + meant.plaza)} tiles: ${variants.roof} of ${meant.roof} roofs, ${variants.street} of ${meant.street} streets, ${variants.plaza} of ${meant.plaza} squares`],
    ['every face of every kind of district', walls.length === wallFaces * sumWalls(meant), `${walls.length} of ${wallFaces * sumWalls(meant)} faces`],
    ['every sheet of roof props is there and cut out', roofSheets.length === all.filter((p) => p.part === 'props-roof').length && cutOut(roofSheets), `${roofSheets.length} sheets, ${count(roofSheets)} props`],
    ['every sheet of street props is there and cut out', streetSheets.length === all.filter((p) => p.part === 'props-street').length && cutOut(streetSheets), `${streetSheets.length} sheets, ${count(streetSheets)} props`],
    ['every lopsided prop has its back', backs.length >= backsMeant - streetSheets.flatMap((p) => p.items).filter((i) => i.shared && !isRound(i)).length, `${backs.length} of ${backsMeant} backs`],
    ['a name of a prop is used once among the later sheets', twice.length === 0, twice.length ? `used twice: ${twice.join(', ')}` : `${later.length} names`],
    ['every street is pale', streetLuma.length > 0 && streetLuma.every((l) => l >= PALE - 2), `brightness ${streetLuma.map((l) => l.toFixed(0)).join(', ')} of 255 (at least ${PALE})`],
    ['light to load', bytes < 900 * 1024 && heaviest < 900 * 1024, `${Math.round(bytes / 1024)} KB in all, the heaviest sheet ${Math.round(heaviest / 1024)} KB, packed at quality ${quality}`],
  ];
  putEntry('biomes', b.id, {
    name: b.name, territories: b.territories, roofTint: b.roofTint, roofProps, streetProps,
    variants, guests: b.guests ?? [], data: `board/${b.id}/biome.json`,
  });

  // A town built of the set, with the body's own skin over a corner of it, to look at.
  const by = Object.fromEntries(Object.values(sheets).flat().map((s) => [s.id, s.img]));
  const creep = path.join(TERRAIN, 'creep.png');
  if (fs.existsSync(creep)) {
    const skin = readImage(creep, { w: 512, h: 512 });
    for (const s of [...creepTiles(skin), ...dripTiles(skin), ...edgeTiles()]) by[s.id] = s.img;
  }
  const picture = townOfVariants(by, { variants, roofProps, streetProps }, path.join(REVIEW, 'biomes', `${b.id}.jpg`));
  fs.writeFileSync(path.join(REVIEW, 'biomes', `${b.id}.json`), `${JSON.stringify({ id: b.id, name: b.name, checks: checks.map(([name, ok, detail]) => ({ name, ok, detail })) }, null, 1)}\n`);
  const passed = checks.filter((c) => c[1]).length;
  console.log(`[biome] ${b.id}: ${Math.round(bytes / 1024)} KB, ${passed}/${checks.length} checks passed`);
  checks.filter((c) => !c[1]).forEach((c) => console.log(`[biome] ${b.id}: FAILED ${c[0]}: ${c[2]}`));
  console.log(`[biome] ${b.id}: to look at: ${picture}`);
  return { id, checks };
}

/**
 * One picture of a town built of a set, to look at: eight blocks round a square, one for each
 * kind of district in each of its two buildings, under the set's different roofs, between its
 * different streets, with props of every sheet, and the body's skin over one corner. (The
 * terrain entry's own picture, townPicture in terrain.mjs, shows one of everything.)
 */
function townOfVariants(by, set, file) {
  const N = 16;
  const W = N * TILE_W + 40;
  const H = N * TILE_H + 4 * LEVEL_H + 60;
  const out = blank(W, H, [20, 18, 16, 255]);
  // Three blocks each way, four cells wide, with streets two cells wide between them: a wall
  // texture is four cells long, so each face of a block shows one whole building.
  const band = (c) => (c < 4 ? 0 : c < 6 ? -1 : c < 10 ? 1 : c < 12 ? -2 : 2);
  const blockOf = (x, y) => (band(x) < 0 || band(y) < 0 ? -1 : band(x) + 3 * band(y));
  const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const ORDER = [0, 1, 2, 3, 5, 6, 7, 8];
  // The block in the middle is the square. The others: every kind of district, first in its first building, then in its second.
  const district = (k) => {
    const n = ORDER.indexOf(k);
    const kind = KINDS[n % 4];
    return { kind, wall: Math.min(n < 4 ? 0 : 1, set.variants.walls[kind] - 1), roof: n % Math.max(1, set.variants.roof), tall: 3 - (n % 2) };
  };
  const height = (x, y) => {
    if (!inside(x, y)) return 0;
    const k = blockOf(x, y);
    if (k < 0 || k === 4) return 0;
    // The front half of a block is a storey lower than its back half, so that the walls of every level show.
    const front = (y % 6) >= 2;
    return Math.max(1, district(k).tall - (front ? 1 : 0));
  };
  const creeped = (x, y) => x >= 14 && y >= 9;
  // Props are taken in turn, so that every one of every sheet is seen somewhere.
  const turns = {};
  const next = (list, who) => list[(turns[who] = (turns[who] ?? -1) + 1) % list.length];
  const put = (img, sx, sy) => { if (img) over8(out, img, Math.round(sx) - (img.pad?.[0] ?? 0), Math.round(sy) - (img.pad?.[1] ?? 0)); };
  for (let d = 0; d < 2 * N; d++) for (let x = 0; x < N; x++) {
    const y = d - x;
    if (y < 0 || y >= N) continue;
    const h = height(x, y);
    const k = blockOf(x, y);
    const sx = W / 2 + (x - y) * A - A;
    const sy = 40 + 3 * LEVEL_H + (x + y) * B;
    if (h === 0) {
      // The streets nearer the viewer are paved with the second street, where the set has one.
      const second = set.variants.street > 1 && (band(x) === -2 || band(y) === -2);
      put(by[`${k === 4 ? 'plaza' : spriteName('street', second ? 1 : 0)}-${x % 4}${y % 4}`], sx, sy);
    } else {
      const { kind, wall, roof } = district(k);
      const name = spriteName(kind, wall);
      for (let l = 0; l < h; l++) {
        if (height(x, y + 1) <= l) put(by[`wall-${name}-south-${l}-${x % (2 * WALL_SPAN)}`], sx, sy + B - (l + 1) * LEVEL_H);
        if (height(x + 1, y) <= l) put(by[`wall-${name}-east-${l}-${2 * WALL_SPAN - 1 - (y % (2 * WALL_SPAN))}`], sx + A, sy + B - (l + 1) * LEVEL_H);
      }
      put(by[`${spriteName('roof', roof)}-${x % 4}${y % 4}`], sx, sy - h * LEVEL_H);
    }
    if (creeped(x, y)) {
      // The skin stops at a ragged edge only where the same surface goes on bare; at the edge
      // of a roof it runs to the edge and down the wall (the game: src/render/iso.ts creepRunsOn).
      let open = 0;
      const bare = (nx, ny) => inside(nx, ny) && height(nx, ny) === h && !creeped(nx, ny);
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
    } else if (h > 0 && (x * 7 + y * 3) % 3 === 0) {
      // What stands on a roof is what the game would stand on a district of that kind, every one in its turn.
      const ids = [...new Set(set.roofProps[district(k).kind])];
      const img = ids.length ? by[`prop-${next(ids, district(k).kind)}`] : null;
      if (img) put(img, sx + A - img.w / 2, sy + B - h * LEVEL_H - img.h * 0.94);
    }
    // A roof at the foot of a taller block lies in its shade.
    if (h > 0) {
      if (height(x, y - 1) > h) put(by['edge-shade-north'], sx, sy - h * LEVEL_H);
      if (height(x - 1, y) > h) put(by['edge-shade-west'], sx, sy - h * LEVEL_H);
    }
    // Street furniture stands at the back of the street, against the wall behind it.
    if (h === 0 && k !== 4 && set.streetProps.length && !creeped(x, y) && (x * 3 + y * 5) % 2 === 0 && (height(x, y - 1) > 0 || height(x - 1, y) > 0)) {
      const img = by[`prop-${next(set.streetProps, 'street')}`];
      const back = height(x, y - 1) > 0 ? [0.5, 0.2] : [0.2, 0.5];
      if (img) put(img, sx + A + (back[0] - back[1]) * A - img.w / 2, sy + (back[0] + back[1]) * B - img.h * 0.94);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJpg(file, out, 4);
  return file;
}

/** Mean brightness of a picture, 0..255. */
function luma(img) {
  let sum = 0;
  for (let i = 0; i < img.data.length; i += 4) sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
  return sum / (img.data.length / 4);
}

/**
 * A picture brought up to a mean brightness of at least `target`, along a curve that lifts its
 * darks and leaves its lights where they are: nothing burns out and its colours stay its own.
 */
function liftTo(img, target) {
  const mean = luma(img);
  if (mean >= target || mean <= 0) return img;
  const gamma = Math.log(target / 255) / Math.log(mean / 255);
  const curve = Array.from({ length: 256 }, (_, v) => Math.round(255 * Math.pow(v / 255, gamma)));
  const data = Buffer.from(img.data);
  for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) data[i + k] = curve[data[i + k]];
  const out = { w: img.w, h: img.h, data };
  // The curve is not a straight line, so the mean lands a little off: once more, from where it landed.
  return luma(out) >= target - 2 ? out : liftTo(out, target);
}

/**
 * Draws the pictures of a set and bakes nothing. Every picture is looked at before it is kept
 * (assets/style-bible.md: the image model adds lettering and crosses by itself), and what is
 * baked is what the game and this public repository get.
 */
export async function drawBiome(id, only) {
  const b = biome(id);
  if (!b) throw new Error(`no such tile set: ${id}`);
  fs.mkdirSync(dirOf(b), { recursive: true });
  borrowFirst(b);
  return generate(b, only);
}

export async function makeBiome(id, { bakeOnly = false, only } = {}) {
  const b = biome(id);
  if (!b) throw new Error(`no such tile set: ${id}. There are: ${BIOMES.map((x) => x.id).join(', ')}`);
  fs.mkdirSync(dirOf(b), { recursive: true });
  borrowFirst(b);
  if (!bakeOnly) await generate(b, only);
  return bakeBiome(id);
}

export const ALL_BIOMES = BIOMES.map((b) => b.id);
