/**
 * THE SCIENCE INSTALLATION (Oct 2 2026). Collins on the first field stations: "the structure the engineers are
 * building looks bad; it should transform the whole square section of the wall into something else, so it's very
 * noticeable". So a station takes over the WHOLE BLOCK it is founded on: every wall of the block is re-clad and every
 * roof covered (src/render/isoRender.ts claddings), with apparatus on the roof and a lit entrance on the street. This
 * makes the pieces, drawn flat so the renderer can lay them on the block's own faces at its own height:
 *   facade-<state>.webp   one bay of wall, flat front elevation (laid on every wall face, one per cell per level)
 *   roof-<state>.webp     the roof seen straight down (laid on every roof tile of the block)
 *   entrance.webp         the ground-floor bay with the lit entrance (on the face toward the station's door)
 *   apparatus-<id>.webp   six roof objects in the board's isometric view (cut from one sheet, like the props)
 * States: building (scaffold and sheeting), active, fortified (armour plate), ruin (gutted, burnt).
 * Dark gunmetal and graphite with bright teal light strips and orange-and-black hazard bands: the science caste's
 * colours, darker than every tile set's walls, so a claimed block reads at a glance, even at far zoom.
 *
 *   node tools/art/installation.mjs           make what is missing (~$0.45 a picture), then bake (free)
 *   node tools/art/installation.mjs --bake    bake again
 * Raw: art-src-new/installation/ (to draw one again MOVE it into v1/). Baked: public/art/installation/.
 * Review: notes/art-review/installation/sheet.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
process.env.BROODFALL_ART_SRC ??= path.join(ROOT, 'art-src-new');
const { makeStill, ready } = await import('./rfab.mjs');
const { readImage, resize, crop, writePng, toWebp, writeJpg, blank, over: paste } = await import('./lib/img.mjs');
const { ART, REVIEW, SRC } = await import('./lib/manifest.mjs');
const { cutProps } = await import('./templates/terrain.mjs');

const RAW = path.join(SRC, 'installation');
const OUT = path.join(ART, 'installation');
const REV = path.join(REVIEW, 'installation');
const bakeOnly = process.argv.includes('--bake');
const raw = (id) => path.join(RAW, `${id}.png`);

const LOOK = 'a modern secret-laboratory installation of an insect civilisation\'s science caste: dark gunmetal and graphite composite armour panels with fine seams and bolts, bright glowing teal light strips, orange-and-black hazard striping, bundled cables and ducts, small round lab portholes glowing pale teal; clean, secular, high-tech, no ornament';
const FLAT = 'Perfectly flat, straight-on, orthographic: no perspective, no vanishing point, no ground, no sky, no shadows from outside, the material fills the whole picture edge to edge. Realistic, detailed, the painterly game-art rendering of a strategy game. No text, no letters, no numbers, no logos, no symbols.';
export const STATES = ['building', 'active', 'fortified', 'ruin'];
const FACADE = {
  building: 'the bare concrete wall of an ordinary building half covered by the installation going up: steel scaffolding poles and planks across it, sheets of dark gunmetal panel being bolted on over half of it, loose cables, a teal work light',
  active: 'the finished installation wall: dark gunmetal composite panels in a grid, one horizontal glowing teal light strip across the middle, a row of small round glowing lab portholes above it, a thin orange-and-black hazard band along the bottom edge, bundled cables running across',
  fortified: 'the same installation wall heavily armoured: thick riveted dark armour plates over the panels, a glowing teal light strip, narrow armoured vision slits glowing teal, broad orange-and-black hazard bands at top and bottom',
  ruin: 'the same installation wall wrecked and burnt out: dark panels torn off and buckled, scorched black, broken teal light tubes dangling, cables hanging loose, holes showing gutted rooms behind, soot',
};
const ROOF = {
  building: 'a flat concrete roof seen straight down from above, half covered by the installation going up: scaffolding, stacked dark panels, cable drums, crates',
  active: 'a flat roof seen straight down from above, completely covered by the installation: dark gunmetal deck plates in a grid with fine seams, teal light strips along the plate edges, ducts and bundled cables running across, small square vents and hatches',
  fortified: 'the same roof seen straight down from above, armoured: thick riveted dark armour plates, teal light strips, broad orange-and-black hazard bands across it',
  ruin: 'the same roof seen straight down from above, wrecked and burnt: buckled torn dark plates, scorched black, holes into the gutted floor below, debris and ash',
};
const ENTRANCE = 'the ground-floor bay of the installation wall with its entrance: a wide heavy sliding blast door of dark gunmetal in the middle, lit by a bright teal light strip over it and two teal floodlights either side, an orange-and-black hazard frame round the door, a small glowing teal access panel, the dark panelled wall either side';
export const APPARATUS = ['dish', 'tanks', 'mast', 'module', 'crates', 'pylon'];
/** Their width in cells as they stand on a roof: the tall thin ones narrower, so none towers over the block. */
const APP_WIDTH = { dish: 0.55, tanks: 0.45, mast: 0.22, module: 0.5, crates: 0.42, pylon: 0.22 };
const APP_ROW = [
  '(1) a large satellite dish on a short dark steel mount, aimed upward, with a teal glowing feed',
  '(2) a cluster of three tall dark pressurised gas tanks with teal bands and pipes between them',
  '(3) a slim dark lattice antenna mast with small dishes and a red light on top',
  '(4) a small dark rooftop lab module: a box of gunmetal panels with a glowing teal porthole and a vent on top',
  '(5) a stack of dark equipment crates with teal markings and a cable drum',
  '(6) a dark floodlight pylon with two bright teal-white floodlights',
];
const APP_PROMPT =
  'A sheet of 6 separate objects that stand on the flat roofs of a city, for a strategy game. Isometric three-quarter ' +
  'top-down view, the camera 45 degrees above the ground, every object seen from the same direction. They stand in one row, ' +
  `evenly spaced, well apart and not touching. Realistic and detailed, painterly game art. They belong to ${LOOK}. ` +
  'Soft even light from directly overhead. No ground, no cast shadows. No text, no letters, no numbers, no logos, no symbols. ' +
  `In reading order: ${APP_ROW.join('; ')}.`;

const jobs = [
  ...STATES.map((s) => ({ id: `facade-${s}`, prompt: `One bay of a building's outside wall, seen straight from the front: ${FACADE[s]}. It is part of ${LOOK}. ${FLAT}`, w: 1536, h: 1024 })),
  ...STATES.map((s) => ({ id: `roof-${s}`, prompt: `${ROOF[s]}. It is part of ${LOOK}. ${FLAT}`, w: 1024, h: 1024 })),
  { id: 'entrance', prompt: `One bay of a building's outside wall, seen straight from the front: ${ENTRANCE}. It is part of ${LOOK}. ${FLAT}`, w: 1536, h: 1024 },
  { id: 'apparatus', prompt: APP_PROMPT, w: 1536, h: 1024, keyed: true },
];

if (!bakeOnly) {
  await ready?.();
  fs.mkdirSync(RAW, { recursive: true });
  await Promise.all(jobs.map(async (j) => {
    if (fs.existsSync(raw(j.id))) return;
    try {
      await makeStill({ slug: `installation ${j.id}`, out: raw(j.id), prompt: j.prompt, key: j.keyed ? 'FF00FF' : null, keyName: j.keyed ? 'magenta' : undefined, quality: 'high', width: j.w, height: j.h });
    } catch (e) { console.warn(`[installation] ${j.id}: ${String(e.message).slice(0, 200)}`); }
  }));
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(REV, { recursive: true });
const shown = [];
/** A face texture: the middle band of the picture at the wall's own proportion (64 x 30 a cell a level), 256 x 120. */
for (const id of [...STATES.map((s) => `facade-${s}`), 'entrance']) {
  if (!fs.existsSync(raw(id))) { console.warn(`[installation] ${id}: no raw yet`); continue; }
  const img = readImage(raw(id));
  const h = Math.round(img.w * 30 / 64);
  const band = crop(img, 0, Math.max(0, Math.round((img.h - h) / 2)), img.w, Math.min(h, img.h));
  const out = resize(band, 256, 120);
  const png = path.join(OUT, `${id}.png`);
  writePng(png, out);
  toWebp(png, path.join(OUT, `${id}.webp`), { q: 88 });
  fs.rmSync(png);
  shown.push(out);
}
/** A roof texture: the middle square, 256 x 256 (laid on the roof diamond by the renderer). */
for (const id of STATES.map((s) => `roof-${s}`)) {
  if (!fs.existsSync(raw(id))) { console.warn(`[installation] ${id}: no raw yet`); continue; }
  const img = readImage(raw(id));
  const side = Math.min(img.w, img.h);
  const sq = crop(img, Math.round((img.w - side) / 2), Math.round((img.h - side) / 2), side, side);
  const out = resize(sq, 256, 256);
  const png = path.join(OUT, `${id}.png`);
  writePng(png, out);
  toWebp(png, path.join(OUT, `${id}.webp`), { q: 88 });
  fs.rmSync(png);
  shown.push(resize(out, 120, 120));
}
/** The apparatus: cut like the props of a tile set. */
if (fs.existsSync(raw('apparatus'))) {
  writeJpg(path.join(REV, 'apparatus.jpg'), readImage(raw('apparatus')));
  const cut = cutProps(raw('apparatus'), APPARATUS.map((id) => ({ id, width: APP_WIDTH[id] })), 'installation apparatus', { spill: 'edge' });
  if (cut.length !== APPARATUS.length) console.warn(`[installation] apparatus: ${cut.length} of ${APPARATUS.length} cut; move the raw into v1/ to draw again`);
  else cut.forEach((c, i) => {
    const png = path.join(OUT, `apparatus-${APPARATUS[i]}.png`);
    writePng(png, c.img);
    toWebp(png, path.join(OUT, `apparatus-${APPARATUS[i]}.webp`), { q: 88 });
    fs.rmSync(png);
    shown.push(c.img);
  });
}
if (shown.length) {
  const cw = 270;
  const ch = Math.max(...shown.map((i) => i.h)) + 10;
  const cols = 5;
  const sheet = blank(cw * cols, ch * Math.ceil(shown.length / cols), [70, 70, 76, 255]);
  shown.forEach((im, i) => paste(sheet, im, (i % cols) * cw + Math.round((cw - im.w) / 2), Math.floor(i / cols) * ch + 5));
  writeJpg(path.join(REV, 'sheet.jpg'), sheet);
  console.log(`[installation] baked ${shown.length} pieces`);
}
