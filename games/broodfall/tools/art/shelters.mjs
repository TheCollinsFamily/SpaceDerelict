/**
 * THE SHELTERS, drawn the way the city is (Oct 2 2026). Collins on the first try: "the relative size ... seems off";
 * "its art style in terms of size doesn't match the rest of the map / it generally looks just misplaced on the map and
 * out of place". So a shelter is not a free picture any more: it stands on its own levelled 2x2 lot of the district
 * (src/sim/citymap.ts shelterSite), whose walls and roof are the tile set's own, and THIS is the structure on that
 * roof, drawn like the set's landmarks (tools/art/landmarks.mjs): one sheet per tile set, in the set's own rendering
 * (its landmark sheet as the reference), the five states of the same building in one row (intact, infested 1-3, ruin),
 * cut and sized as landmarks are.
 *
 *   node tools/art/shelters.mjs [sets]       make what is missing (one high still a set, ~$0.45), then bake (free)
 *   node tools/art/shelters.mjs --bake       bake again
 *
 * Raw: art-src-new/shelter/<set>.png (never art-src; to draw one again MOVE it into art-src-new/shelter/v1/).
 * Baked: public/art/shelter/<set>/<state>.webp. Review: notes/art-review/shelters/<set>.jpg and sheet.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
process.env.BROODFALL_ART_SRC ??= path.join(ROOT, 'art-src-new');
const { makeStill, ready } = await import('./rfab.mjs');
const { readImage, resize, writePng, toWebp, writeJpg, blank, over: paste } = await import('./lib/img.mjs');
const { ART, REVIEW, SRC } = await import('./lib/manifest.mjs');
const { cutProps } = await import('./templates/terrain.mjs');
const { BIOMES, SPECIES_THINGS, NO_SYMBOLS } = await import('./biomes.mjs');

const RAW = path.join(SRC, 'shelter');
const OUT = path.join(ART, 'shelter');
const REV = path.join(REVIEW, 'shelters');
const args = process.argv.slice(2);
const bakeOnly = args.includes('--bake');
const asked = args.filter((a) => !a.startsWith('--'));
const sets = BIOMES.filter((b) => !asked.length || asked.includes(b.id));
const raw = (b) => path.join(RAW, `${b.id}.png`);
const ref = (b) => path.join(SRC, 'terrain', b.id, 'props-landmark.png');

/** The five states, left to right: the same building. Width in cells (as a landmark's): it stands on a 2x2 lot. */
export const STATES = ['intact', 'infested-1', 'infested-2', 'infested-3', 'ruin'];
const WIDTH = 1.7;
const SHELTER = 'a squat civil-defence SHELTER the district built on top of a block: a low rounded bunker no taller than one storey, with a heavy round blast door on its front set into a sandbagged entrance, a short ventilation stack with a cap, a small siren on a short post, narrow slit windows, and bands of safety-orange hazard stripes round its base';
const ROW = [
  `(1) ${SHELTER}`,
  '(2) the SAME bunker, the same shape and size, with glossy wet dark-red living flesh and veins just beginning to creep out of its blast door and up its walls, two small pulsing red growths on its roof',
  '(3) the SAME bunker half swallowed by thick glossy dark-red flesh and pale veins, its roof split open and a swollen fleshy bulb pushing up out of it, warm red light in the slits',
  '(4) the SAME bunker wholly grown over into a living organ of glossy dark-red flesh and pale veins, a squat fleshy tower with glowing amber pores and a crown of short tendrils rising from it, no taller than the bunker was wide; a curve of orange-striped wall still shows at its foot',
  '(5) the SAME bunker as a burnt-out ruin: roof caved in, walls cracked and blackened, the blast door torn off, scraps of dead grey flesh in the rubble, the siren post bent',
];
const prompt = (b) =>
  'A sheet of 5 separate objects that stand on the roofs of an insect city, for a strategy game. Isometric three-quarter ' +
  'top-down view, the camera 45 degrees above the ground, every object seen from the same direction. They stand in one row, ' +
  `evenly spaced, well apart and not touching, each about as large as the landmarks of the reference picture. Realistic and detailed. ${SPECIES_THINGS}. ${b.look}. ` +
  'They are drawn from the same view, at the same scale and in the same rendering, materials and colours as the objects in ' +
  `the reference picture, which belong to the same district${b.key[1] === 'green' ? '' : '; the background colour is not the reference\'s'}. ` +
  `Soft even light from directly overhead. No ground, no cast shadows. ${NO_SYMBOLS} No labels, no numbers. In reading order: ${ROW.join('; ')}.`;

if (!bakeOnly) {
  await ready?.();
  fs.mkdirSync(RAW, { recursive: true });
  await Promise.all(sets.map(async (b) => {
    if (fs.existsSync(raw(b))) return;
    if (!fs.existsSync(ref(b))) { console.warn(`[shelters] ${b.id}: no landmark sheet to match (${ref(b)})`); return; }
    try {
      await makeStill({ slug: `${b.id} shelters`, out: raw(b), prompt: prompt(b), key: b.key[0], keyName: b.key[1], quality: 'high', width: 1536, height: 1024, refFiles: [ref(b)] });
    } catch (e) { console.warn(`[shelters] ${b.id}: ${String(e.message).slice(0, 200)}`); }
  }));
}

fs.mkdirSync(REV, { recursive: true });
const rows = [];
for (const b of sets) {
  if (!fs.existsSync(raw(b))) { console.warn(`[shelters] ${b.id}: no raw yet`); continue; }
  writeJpg(path.join(REV, `${b.id}.jpg`), readImage(raw(b)));
  const cut = cutProps(raw(b), STATES.map((id) => ({ id, width: WIDTH })), `${b.id} shelters`, { spill: b.spill ?? 'edge' });
  if (cut.length !== STATES.length) { console.warn(`[shelters] ${b.id}: ${cut.length} of ${STATES.length} cut; move ${raw(b)} into v1/ to draw again`); continue; }
  const dir = path.join(OUT, b.id);
  fs.mkdirSync(dir, { recursive: true });
  cut.forEach((c, i) => {
    const png = path.join(dir, `${STATES[i]}.png`);
    writePng(png, c.img);
    toWebp(png, path.join(dir, `${STATES[i]}.webp`), { q: 88 });
    fs.rmSync(png);
  });
  rows.push({ id: b.id, imgs: cut.map((c) => c.img) });
  console.log(`[shelters] ${b.id} baked`);
}
// The review sheet: a row a set, the five states.
if (rows.length) {
  const cw = 220;
  const ch = Math.max(...rows.flatMap((r) => r.imgs.map((i) => i.h))) + 8;
  const sheet = blank(cw * STATES.length, ch * rows.length, [70, 70, 76, 255]);
  rows.forEach((r, y) => r.imgs.forEach((im, x) => paste(sheet, im, x * cw + Math.round((cw - im.w) / 2), y * ch + ch - 4 - im.h)));
  writeJpg(path.join(REV, 'sheet.jpg'), sheet);
}
