/**
 * A strip of one animation's baked frames, big, over street colour, to LOOK at (free).
 *
 *   node tools/art/look-anim.mjs <kind> <anim> [view ...]     e.g.  shadewing hit S SW W
 *
 * Reads public/art/manifest.json (units, then allies) and the atlas pages; one row per view.
 * Writes notes/art-review/units/look-<kind>-<anim>.jpg and prints its path.
 */
import path from 'node:path';
import { blank, crop, over, readImage, writeJpg } from './lib/img.mjs';
import { ART, REVIEW, readManifest } from './lib/manifest.mjs';
import { GROUNDS } from './lib/atlas.mjs';

const [kind, anim, ...want] = process.argv.slice(2);
const m = readManifest();
const u = m.units?.[kind] ?? m.allies?.[kind];
if (!u) { console.error(`no unit or ally "${kind}" in the manifest`); process.exit(1); }
const set = anim === 'states' ? u.anims.states : u.anims[anim];
if (!set) { console.error(`${kind} has no "${anim}" (has: ${Object.keys(u.anims).join(', ')})`); process.exit(1); }
const views = want.length ? want : Object.keys(set);
const pages = [u.atlas, ...(u.pages ?? [])].map((f) => readImage(path.join(ART, f)));
const F = u.frame;
const most = Math.max(...views.map((v) => set[v].count));
const sheet = blank(most * F, views.length * F, [...GROUNDS.street, 255]);
views.forEach((v, r) => {
  const c = set[v];
  const page = pages[c.page ?? 0];
  for (let k = 0; k < c.count; k++) {
    const i = c.start + k;
    over(sheet, crop(page, (i % u.cols) * F, Math.floor(i / u.cols) * F, F, F), k * F, r * F);
  }
});
const out = path.join(REVIEW, 'units', `look-${kind}-${anim}.jpg`);
writeJpg(out, sheet);
console.log(out);
