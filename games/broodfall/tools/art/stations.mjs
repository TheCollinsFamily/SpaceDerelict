/**
 * THE SCIENCE FIELD STATIONS (Oct 2 2026; Collins: "give the science faction units that can build spawning locations,
 * and even their own towers"), drawn the way the city is, like the shelters (tools/art/shelters.mjs): a station stands
 * on a LOT beside a street (one block cell, on its roof, src/sim/sim.ts stationSiteOk), so it is drawn like the set's
 * landmarks (tools/art/landmarks.mjs): one sheet per tile set, in the set's own rendering (its landmark sheet as the
 * reference), the states of the same station in one row (being built, standing, fortified, ruin), and its turret,
 * which stands on the street at its side. Collins on the first shelters: "its art style in terms of size doesn't match
 * the rest of the map / it generally looks just misplaced": so these are sized as the set's props are, not free pictures.
 *
 *   node tools/art/stations.mjs [sets]       make what is missing (one high still a set, ~$0.45), then bake (free)
 *   node tools/art/stations.mjs --bake       bake again
 *
 * Raw: art-src-new/station/<set>.png (never art-src; to draw one again MOVE it into art-src-new/station/v1/).
 * Baked: public/art/station/<set>/<state>.webp. Review: notes/art-review/stations/<set>.jpg and sheet.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
process.env.BROODFALL_ART_SRC ??= path.join(ROOT, 'art-src-new');
const { makeStill, ready } = await import('./rfab.mjs');
const { readImage, writePng, toWebp, writeJpg, blank, over: paste } = await import('./lib/img.mjs');
const { ART, REVIEW, SRC } = await import('./lib/manifest.mjs');
const { cutProps } = await import('./templates/terrain.mjs');
const { BIOMES, SPECIES_THINGS, NO_SYMBOLS } = await import('./biomes.mjs');

const RAW = path.join(SRC, 'station');
const OUT = path.join(ART, 'station');
const REV = path.join(REVIEW, 'stations');
const args = process.argv.slice(2);
const bakeOnly = args.includes('--bake');
const asked = args.filter((a) => !a.startsWith('--'));
const sets = BIOMES.filter((b) => !asked.length || asked.includes(b.id));
const raw = (b) => path.join(RAW, `${b.id}.png`);
const ref = (b) => path.join(SRC, 'terrain', b.id, 'props-landmark.png');

/** The states, left to right, and their width in cells (as a landmark's): a station on one lot; its turret smaller. */
export const STATES = ['building', 'active', 'fortified', 'ruin', 'turret'];
const WIDTHS = [0.95, 0.95, 1.0, 0.95, 0.55];
const STATION = 'a small modern science FIELD STATION set up on top of a block: one prefabricated white laboratory container with a teal stripe and a teal rooftop vent, a slim aluminium antenna mast with a small dish and a red light on top, two floodlights on poles, a humming generator box and a stack of equipment crates; clean, secular, laboratory-modern, no ornament';
const ROW = [
  `(1) the station BEING BUILT: only a bare aluminium scaffold frame on the block, a half-assembled white container panel, crates and cable reels lying about, the mast lying on its side, no lights`,
  `(2) ${STATION}`,
  '(3) the SAME station FORTIFIED: the same container and mast, now with a second container stacked on it, a taller mast with two dishes, sandbags round its base and a teal-striped barrier, more floodlights',
  '(4) the SAME station as a wreck: the container crushed and torn open, the mast snapped and bent, crates spilled, scorched white panels, scraps of red flesh in the wreckage',
  '(5) one small science TURRET that stands on its own on the street beside the station: a low tripod with a teal-and-white dart launcher rack of six glass tubes with teal fluid and a small round sensor dish on top, no person, about a third the size of the station',
];
const prompt = (b) =>
  'A sheet of 5 separate objects that stand in an insect city, for a strategy game. Isometric three-quarter top-down ' +
  'view, the camera 45 degrees above the ground, every object seen from the same direction. They stand in one row, ' +
  `evenly spaced, well apart and not touching, the first four each about as large as the landmarks of the reference picture. Realistic and detailed. ${SPECIES_THINGS}. ${b.look}. ` +
  'They are drawn from the same view, at the same scale and in the same rendering, materials and colours as the objects in ' +
  `the reference picture, which belong to the same district${b.key[1] === 'green' ? '' : '; the background colour is not the reference\'s'}. ` +
  `Soft even light from directly overhead. No ground, no cast shadows. ${NO_SYMBOLS} No labels, no numbers, no writing. In reading order: ${ROW.join('; ')}.`;

if (!bakeOnly) {
  await ready?.();
  fs.mkdirSync(RAW, { recursive: true });
  await Promise.all(sets.map(async (b) => {
    if (fs.existsSync(raw(b))) return;
    if (!fs.existsSync(ref(b))) { console.warn(`[stations] ${b.id}: no landmark sheet to match (${ref(b)})`); return; }
    try {
      await makeStill({ slug: `${b.id} stations`, out: raw(b), prompt: prompt(b), key: b.key[0], keyName: b.key[1], quality: 'high', width: 1536, height: 1024, refFiles: [ref(b)] });
    } catch (e) { console.warn(`[stations] ${b.id}: ${String(e.message).slice(0, 200)}`); }
  }));
}

fs.mkdirSync(REV, { recursive: true });
const rows = [];
for (const b of sets) {
  if (!fs.existsSync(raw(b))) { console.warn(`[stations] ${b.id}: no raw yet`); continue; }
  writeJpg(path.join(REV, `${b.id}.jpg`), readImage(raw(b)));
  const cut = cutProps(raw(b), STATES.map((id, i) => ({ id, width: WIDTHS[i] })), `${b.id} stations`, { spill: b.spill ?? 'edge' });
  if (cut.length !== STATES.length) { console.warn(`[stations] ${b.id}: ${cut.length} of ${STATES.length} cut; move ${raw(b)} into v1/ to draw again`); continue; }
  const dir = path.join(OUT, b.id);
  fs.mkdirSync(dir, { recursive: true });
  cut.forEach((c, i) => {
    const png = path.join(dir, `${STATES[i]}.png`);
    writePng(png, c.img);
    toWebp(png, path.join(dir, `${STATES[i]}.webp`), { q: 88 });
    fs.rmSync(png);
  });
  rows.push({ id: b.id, imgs: cut.map((c) => c.img) });
  console.log(`[stations] ${b.id} baked`);
}
// The review sheet: a row a set, the states.
if (rows.length) {
  const cw = 220;
  const ch = Math.max(...rows.flatMap((r) => r.imgs.map((i) => i.h))) + 8;
  const sheet = blank(cw * STATES.length, ch * rows.length, [70, 70, 76, 255]);
  rows.forEach((r, y) => r.imgs.forEach((im, x) => paste(sheet, im, x * cw + Math.round((cw - im.w) / 2), y * ch + ch - 4 - im.h)));
  writeJpg(path.join(REV, 'sheet.jpg'), sheet);
}
