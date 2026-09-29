/**
 * PROBE: units seen from ABOVE, as the board is seen (Sep 29 2026).
 *
 * Collins: "most of your character sheets are not usable … they are in profile and not from
 * above with an angle … making units that are visually distinct and understandable from above
 * is one of the key challenges of the StarCraft / Warcraft style of art we opted into."
 *
 * The turnaround prompt asked for "tilted about 45 degrees down" and the model drew what its
 * reference showed instead: the approved concept sheet, drawn nearly at eye level. Two ways
 * are tried here on three units, a picture each:
 *   A  a much firmer camera, said three ways (angle, what is seen, what is small);
 *   B  the same, plus a picture of the REAL board as a second reference: "this camera".
 * Written to notes/probes/2026-09-29/unit-camera/. PAID: about 6,150 tokens a picture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool, ready } from './rfab.mjs';
import { unit } from './units.mjs';
import { blank, paste, readImage, resize, writeJpg, crop } from './lib/img.mjs';
import { ROOT, SRC } from './lib/manifest.mjs';

export const TOP_CAMERA =
  'THE CAMERA: high above and looking steeply DOWN at the unit, about 50 degrees below the horizon, as the ' +
  'camera of StarCraft, Warcraft III and Red Alert 2 looks at its units. So: the TOP of the head or helmet and ' +
  'the tops of the shoulders face the viewer and are the biggest, clearest part of it; the body is short and ' +
  'foreshortened beneath them; the legs and feet are small and tucked under; we see down onto the weapon and ' +
  'the pack from above. It is NOT seen from the side and NOT at eye level: no horizon, the face is seen from ' +
  'above, never straight on. A shadow circle under its feet would be a flat ellipse twice as wide as it is deep.';
export const READABLE =
  'It reads at a glance when it is small: a bold, simple silhouette seen from above; its head, helmet or crest ' +
  'and its weapon exaggerated in size; its caste colour in large flat areas on the top of the helmet and the ' +
  'shoulders, where the camera sees it.';

const SLUGS = ['militia', 'soldier', 'skitterling'];
const DIR = path.join(ROOT, 'notes', 'probes', '2026-09-29', 'unit-camera');

ready();
fs.mkdirSync(DIR, { recursive: true });
// The board as the game draws it: blocks, streets and limbs, seen by the game's own camera.
const board = path.join(DIR, 'board-camera.png');
if (!fs.existsSync(board)) {
  const shot = readImage(path.join(ROOT, 'tools', 'screenshots', 'plinth-2-raised.png'));
  fs.writeFileSync(board, '');
  const { writePng } = await import('./lib/img.mjs');
  writePng(board, crop(shot, 330, 150, 700, 600));
}
const jobs = [];
for (const kind of SLUGS) {
  const u = unit(kind);
  const ref = path.join(SRC, 'units', kind, 'ref.png');
  const base = `A single game unit for a strategy game: ${u.one ?? u.look}. The same unit, clothes, colours and kit as the ` +
    'first reference picture, in the same chunky, slightly cartoonish drawing style, standing, caught mid-stride, ' +
    `walking toward the lower left. ${TOP_CAMERA} ${READABLE} Even light from directly overhead. No ground, no cast shadows, no text.`;
  jobs.push({ id: `${kind}-A`, refFiles: [ref], prompt: base });
  jobs.push({ id: `${kind}-B`, refFiles: [ref, board],
    prompt: `${base} The SECOND reference picture shows the board it walks on, seen by the game's camera: draw the unit seen by exactly that camera, as if it were walking on those streets.` });
}
const results = await pool(jobs, 4, (j) => makeStill({
  slug: `camera probe ${j.id}`, out: path.join(DIR, `${j.id}.png`), refFiles: j.refFiles, prompt: j.prompt,
  key: '00FF00', keyName: 'green', quality: 'medium',
}));
results.forEach((r, i) => { if (!r.ok) console.log(`FAILED ${jobs[i].id}: ${r.error.message.slice(0, 160)}`); });
// Old (the view it has now, walking lower left) | A | B, a row a unit.
const T = 384;
const sheet = blank(3 * T, SLUGS.length * T, [196, 186, 160, 255]);
SLUGS.forEach((kind, row) => {
  [path.join(SRC, 'units', kind, 'view-SW.png'), path.join(DIR, `${kind}-A.png`), path.join(DIR, `${kind}-B.png`)].forEach((f, col) => {
    if (fs.existsSync(f)) paste(sheet, resize(readImage(f), T, T), col * T, row * T);
  });
});
writeJpg(path.join(DIR, 'old-A-B.jpg'), sheet, 3);
console.log(path.join(DIR, 'old-A-B.jpg'));
