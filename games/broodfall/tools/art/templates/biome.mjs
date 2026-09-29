/**
 * THE TILE SET TEMPLATE: the same board in another kind of place (tools/art/biomes.mjs).
 *
 *   three floors, four walls, a sheet of roof props and a sheet of street props
 *   -> baked into public/art/board/<set>/ -> one entry under "biomes" in the manifest
 *
 * The body (creep, core, spore pods) and the smoke over the unclaimed city are the same in
 * every set and stay in the terrain entry (templates/terrain.mjs). The first set, the Temple
 * Cities, is the terrain entry's own floors, walls and props: it has no pictures of its own.
 *
 *   node tools/art/make.mjs biome                    every set
 *   node tools/art/make.mjs biome megacity orient    some
 *   node tools/art/make.mjs biome --bake             bake again from the pictures on disk (free)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool } from '../rfab.mjs';
import { readImage } from '../lib/img.mjs';
import { LEVEL_H, TILE_H, TILE_W, WALL_SPAN } from '../lib/iso.mjs';
import { ART, REVIEW, SRC, putEntry } from '../lib/manifest.mjs';
import { BIOMES, NO_SYMBOLS, SPECIES, SPECIES_THINGS, biome, roofSets } from '../biomes.mjs';
import { creepTiles, cutProps, dripTiles, floorTiles, packSprites, townPicture, wallTiles } from './terrain.mjs';

const TERRAIN = path.join(SRC, 'terrain');
const KINDS = ['plain', 'science', 'meat', 'highground'];
const FLOORS = ['street', 'plaza', 'roof'];
/** The least mean brightness of a street or a square, of 255. */
const PALE = 132;

const FLAT =
  'Seen from exactly straight above, as a flat texture that fills the whole picture edge to edge with no border. ' +
  `Even flat light, no cast shadows, no objects standing on it, no perspective. ${NO_SYMBOLS}`;

const facade = (b, kind) =>
  'A flat architectural elevation, in full colour and realistic detail, seen exactly from the front with no ' +
  'perspective, filling the whole picture edge to edge with no sky, no ground, no roof line and no border: part of ' +
  `the front of a building, exactly three storeys high. ${SPECIES}. ${b.look}. The three storeys are exactly the ` +
  `same height, and a thin horizontal band of trim runs along the top of each storey. ${b.walls[kind]} ` +
  'The reference picture shows another district of the same city: keep its flat frontal view, its three equal ' +
  'storeys and the size of its doors and windows. The style is the one described here, not the one of the ' +
  `reference. Even flat light, no cast shadows. ${NO_SYMBOLS}`;

const propSheet = (b, where, list) =>
  `A sheet of ${list.length} separate objects that stand ${where === 'roof' ? 'on the roofs' : 'in the streets'} ` +
  'of an insect city, for a strategy game. Isometric three-quarter top-down view, the camera 45 degrees above the ' +
  'ground, every object seen from the same direction. They stand in two rows, evenly spaced, well apart and not ' +
  `touching. Realistic and detailed. ${SPECIES_THINGS}. ${b.look}. They are drawn from the same view and in the ` +
  'same rendering as the objects in the reference picture, which belong to another district of the same city; ' +
  'the background colour is not the reference\'s. Soft even light from directly overhead. No ground, no cast ' +
  `shadows. ${NO_SYMBOLS} No labels, no numbers. In reading order: ${list.map((p, i) => `(${i + 1}) ${p.look}`).join('; ')}.`;

const dirOf = (b) => path.join(TERRAIN, b.id);
/** The street props a set has pictures of (the spore pod and the gate belong to the terrain entry). */
const ownStreet = (b) => b.streetProps.filter((p) => p.look);

async function generate(b, only) {
  const want = (id) => !only?.length || only.includes(id);
  const dir = dirOf(b);
  const jobs = [];
  for (const id of FLOORS) {
    if (want(id) || want('floors')) jobs.push(() => makeStill({ slug: `${b.id} ${id}`, out: path.join(dir, `${id}.png`), prompt: `${b[id]} ${FLAT}`, key: null, width: 1024, height: 1024, quality: 'high' }));
  }
  for (const kind of KINDS) {
    if (want(`wall-${kind}`) || want('walls')) jobs.push(() => makeStill({ slug: `${b.id} wall ${kind}`, out: path.join(dir, `wall-${kind}.png`), prompt: facade(b, kind), key: null, width: 1536, height: 1024, quality: 'high', refFiles: [path.join(TERRAIN, 'wall-plain.png')] }));
  }
  const [key, keyName] = b.key;
  if (want('props-roof') || want('props')) jobs.push(() => makeStill({ slug: `${b.id} props roof`, out: path.join(dir, 'props-roof.png'), prompt: propSheet(b, 'roof', b.roofProps), key, keyName, width: 1536, height: 1024, quality: 'high', refFiles: [path.join(TERRAIN, 'props-roof.png')] }));
  if (want('props-street') || want('props')) jobs.push(() => makeStill({ slug: `${b.id} props street`, out: path.join(dir, 'props-street.png'), prompt: propSheet(b, 'street', ownStreet(b)), key, keyName, width: 1536, height: 1024, quality: 'high', refFiles: [path.join(TERRAIN, 'props-street.png')] }));
  const results = await pool(jobs, 5, (j) => j());
  const failed = results.filter((r) => !r.ok);
  failed.forEach((r) => console.warn(`[biome] ${b.id}: a picture failed: ${r.error.message.slice(0, 200)}`));
  return failed.length;
}

/** What the game is told about a set, whatever it has pictures of. */
const describe = (b) => ({
  name: b.name, territories: b.territories, roofTint: b.roofTint,
  roofProps: roofSets(b), streetProps: b.streetProps.filter((p) => !p.never && !p.shared).map((p) => p.id),
});

export function bakeBiome(id) {
  const b = biome(id);
  if (!b) throw new Error(`no such tile set: ${id}`);
  if (b.made) {
    putEntry('biomes', b.id, { ...describe(b), data: null });
    return { id, checks: [] };
  }
  const dir = dirOf(b);
  const out = path.join(ART, 'board', b.id);
  fs.mkdirSync(out, { recursive: true });
  const have = (f) => fs.existsSync(path.join(dir, f));
  const tex = (f, w, h) => readImage(path.join(dir, f), { w, h });

  // Units are dark and walk in the streets: a street that came out dark is brought up until they read on it.
  const ground = (f) => (f === 'roof' ? tex(`${f}.png`, 512, 512) : liftTo(tex(`${f}.png`, 512, 512), PALE));
  const floors = FLOORS.filter((f) => have(`${f}.png`)).flatMap((f) => floorTiles(f, ground(f)));
  const streetLuma = have('street.png') ? luma(ground('street')) : 0;
  const walls = KINDS.filter((k) => have(`wall-${k}.png`)).flatMap((k) => wallTiles(k, tex(`wall-${k}.png`, 1024, 384)));
  // Painted things keep their own colours: the key's tint is taken off their outlines only.
  const roofs = cutProps(path.join(dir, 'props-roof.png'), b.roofProps, 'roof', { spill: 'edge' });
  const streets = cutProps(path.join(dir, 'props-street.png'), ownStreet(b), 'street', { spill: 'edge' });
  const sheets = { floors, walls, props: [...roofs, ...streets] };

  const data = { tile: [TILE_W, TILE_H], level: LEVEL_H, wallSpan: WALL_SPAN, sheets: {} };
  let bytes = 0;
  for (const [name, sprites] of Object.entries(sheets)) {
    if (!sprites.length) continue;
    const packed = packSprites(sprites, path.join(out, `${name}.webp`));
    data.sheets[name] = { atlas: `board/${b.id}/${name}.webp`, sprites: packed.rects };
    bytes += packed.bytes;
  }
  fs.writeFileSync(path.join(out, 'biome.json'), `${JSON.stringify(data)}\n`);

  const checks = [
    ['three floors', floors.length === 48, `${floors.length} of 48 tiles`],
    ['four kinds of wall', walls.length === 4 * 2 * 3 * 2 * WALL_SPAN, `${walls.length} of ${4 * 2 * 3 * 2 * WALL_SPAN} faces`],
    ['every roof prop cut out', roofs.length === b.roofProps.length, `${roofs.length} of ${b.roofProps.length}`],
    ['every street prop cut out', streets.length === ownStreet(b).length, `${streets.length} of ${ownStreet(b).length}`],
    ['the street is pale', streetLuma >= PALE - 2, `brightness ${streetLuma.toFixed(0)} of 255 (at least ${PALE})`],
    ['light to load', bytes < 900 * 1024, `${Math.round(bytes / 1024)} KB`],
  ];
  putEntry('biomes', b.id, { ...describe(b), data: `board/${b.id}/biome.json` });

  // A town built of the set, with the body's own skin over a corner of it, to look at.
  const by = Object.fromEntries(Object.values(sheets).flat().map((s) => [s.id, s.img]));
  const creep = path.join(TERRAIN, 'creep.png');
  if (fs.existsSync(creep)) {
    const skin = readImage(creep, { w: 512, h: 512 });
    for (const s of [...creepTiles(skin), ...dripTiles(skin)]) by[s.id] = s.img;
  }
  const picture = townPicture(by, roofs.map((s) => s.id), path.join(REVIEW, 'biomes', `${b.id}.jpg`), streets.map((s) => s.id));
  fs.writeFileSync(path.join(REVIEW, 'biomes', `${b.id}.json`), `${JSON.stringify({ id: b.id, name: b.name, checks: checks.map(([name, ok, detail]) => ({ name, ok, detail })) }, null, 1)}\n`);
  const passed = checks.filter((c) => c[1]).length;
  console.log(`[biome] ${b.id}: ${Math.round(bytes / 1024)} KB, ${passed}/${checks.length} checks passed`);
  checks.filter((c) => !c[1]).forEach((c) => console.log(`[biome] ${b.id}: FAILED ${c[0]}: ${c[2]}`));
  console.log(`[biome] ${b.id}: to look at: ${picture}`);
  return { id, checks };
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

export async function makeBiome(id, { bakeOnly = false, only } = {}) {
  const b = biome(id);
  if (!b) throw new Error(`no such tile set: ${id}. There are: ${BIOMES.map((x) => x.id).join(', ')}`);
  if (!b.made && !bakeOnly) {
    fs.mkdirSync(dirOf(b), { recursive: true });
    await generate(b, only);
  }
  return bakeBiome(id);
}

export const ALL_BIOMES = BIOMES.map((b) => b.id);
