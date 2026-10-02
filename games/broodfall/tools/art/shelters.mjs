/**
 * THE SHELTERS (Oct 2 2026; DESIGN.md "SHELTERS AND THE INFESTOR"): one picture per state, drawn over the building a
 * shelter stands on (src/render/isoRender.ts syncShelters). The intact shelter is drawn first; the three infested
 * stages and the ruin are EDITS of it, so it is the same building growing over.
 *
 *   node tools/art/shelters.mjs            make what is missing (5 high stills, ~$0.45 each), then bake (free)
 *   node tools/art/shelters.mjs --bake     bake again
 *
 * Raw: art-src-new/shelter/<key>.png (never art-src). Baked: public/art/shelter/<key>.webp. Review:
 * notes/art-review/shelters/sheet.jpg. To draw one again, MOVE its raw into art-src-new/shelter/v1/ (never delete).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
process.env.BROODFALL_ART_SRC ??= path.join(ROOT, 'art-src-new');
const { makeStill, ready } = await import('./rfab.mjs');
const { readImage, crop, resize, bbox, writePng, toWebp, writeJpg, blank, paste } = await import('./lib/img.mjs');
const { ART, REVIEW, SRC } = await import('./lib/manifest.mjs');
const { findFigures, figure } = await import('./lib/sheet.mjs');
const { keyFrame, keyOf } = await import('./lib/key.mjs');

const RAW = path.join(SRC, 'shelter');
const OUT = path.join(ART, 'shelter');
const REV = path.join(REVIEW, 'shelters');
const bakeOnly = process.argv.includes('--bake');

const CAMERA = 'Drawn for an isometric strategy game, seen from high above at the angle of the reference picture of the game board, as one building standing alone on a flat plain bright green background, with no ground, no shadow on the background, no other buildings, no text, no lettering, no signs with words, no religious symbols.';
const BUILDING = 'a squat fortified civil-defence SHELTER of a 1950s-style insect city: a round concrete bunker with a low domed roof capped by a plain gold ball finial, a heavy armoured door set into a sandbagged entrance on its front, a small civil-defence siren on a short pole on the roof, narrow slit windows, and painted hazard stripes in safety orange round its base; weathered, solid, built to last';
const STATES = {
  intact: `${BUILDING}. ${CAMERA}`,
  'infested-1': `The SAME building as the first reference picture, exactly the same shape, camera and size, now being taken over by living flesh: glossy wet dark-red veins and patches of raw red tissue creeping out of its armoured door and up its walls, two small pulsing growths on the dome. Most of the concrete still shows. ${CAMERA}`,
  'infested-2': `The SAME building as the first reference picture, exactly the same shape, camera and size, half swallowed by living flesh: thick glossy dark-red tissue and pale veins cover most of its walls, the dome is split open and a swollen fleshy bulb is pushing up out of it, the siren pole is wrapped in sinew, warm red light glows from the slit windows. ${CAMERA}`,
  'infested-3': `The SAME building as the first reference picture, the same footprint, camera and size at its base, now wholly grown over into a living hive organ: the bunker is buried under glossy wet dark-red flesh and pale veins, and out of its broken dome rises a tall pulsing fleshy tower with glowing amber pores and a crown of thick tendrils; only a curve of orange-striped concrete still shows at its foot. ${CAMERA}`,
  ruin: `The SAME building as the first reference picture, exactly the same footprint, camera and size, now a burnt-out ruin: the dome caved in, the walls cracked and blackened, the armoured door torn off, scraps of dead grey shrivelled flesh hanging from the rubble, the siren pole bent over. ${CAMERA}`,
};
const KEYS = Object.keys(STATES);
const raw = (k) => path.join(RAW, `${k}.png`);

if (!bakeOnly) {
  await ready?.();
  fs.mkdirSync(RAW, { recursive: true });
  const camera = path.join(SRC, 'refs', 'board-camera.png');
  if (!fs.existsSync(raw('intact'))) await makeStill({ slug: 'shelter intact', out: raw('intact'), prompt: STATES.intact, quality: 'high', width: 1024, height: 1024, refFiles: [camera] });
  if (!fs.existsSync(raw('intact'))) throw new Error('the intact shelter failed');
  await Promise.all(KEYS.filter((k) => k !== 'intact' && !fs.existsSync(raw(k))).map((k) => makeStill({
    slug: `shelter ${k}`, out: raw(k), prompt: STATES[k], quality: 'high', width: 1024, height: 1024, refFiles: [raw('intact'), camera],
  }).catch((e) => console.warn(`[shelters] ${k}: ${String(e.message).slice(0, 200)}`))));
}

// Bake: key the green out, crop to the building, 512 px wide, webp.
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(REV, { recursive: true });
const cuts = [];
for (const k of KEYS) {
  if (!fs.existsSync(raw(k))) { console.warn(`[shelters] ${k}: no raw yet`); continue; }
  const img = readImage(raw(k));
  const found = findFigures(img, { expect: 1 });
  if (found.boxes.length < 1) { console.warn(`[shelters] ${k}: no building found; move ${raw(k)} into v1/ to draw again`); continue; }
  // The biggest figure is the building.
  const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
  const box = [...found.boxes].sort((a, b) => area(b) - area(a))[0];
  const one = figure(img, box, found, 0.04);
  keyFrame(one, keyOf([0, 255, 0]), { spill: 'edge' });
  const b = bbox(one, 128);
  const cut = crop(one, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  const w = 512;
  const sized = resize(cut, w, Math.round((cut.h / cut.w) * w));
  const png = path.join(OUT, `${k}.png`);
  writePng(png, sized);
  toWebp(png, path.join(OUT, `${k}.webp`), { q: 88 });
  fs.rmSync(png);
  cuts.push(sized);
  console.log(`[shelters] ${k} baked`);
}
// The review sheet: the states side by side on grey.
if (cuts.length) {
  const H = Math.max(...cuts.map((c) => c.h));
  const sheet = blank(cuts.length * 520, H + 16, [60, 60, 64, 255]);
  cuts.forEach((c, i) => paste(sheet, c, i * 520 + 4, H + 8 - c.h));
  writeJpg(path.join(REV, 'sheet.jpg'), sheet);
}
