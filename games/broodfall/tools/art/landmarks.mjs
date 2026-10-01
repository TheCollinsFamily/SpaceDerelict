/**
 * LANDMARKS (Oct 1 2026, Collins: "I guess I thought the cities felt a little samey"): three big
 * structures per tile set (tools/art/biomes.mjs LANDMARKS), one standing on the largest lot of every
 * district (src/render/isoRender.ts placeLandmarks).
 *
 *   node tools/art/landmarks.mjs [set ...]          draw each set's sheet (once) and bake
 *   node tools/art/landmarks.mjs --bake [set ...]   bake again (free)
 *
 * Raw: art-src-new/terrain/<set>/props-landmark.png (the set's own key; BROODFALL_ART_NEW moves it). Not
 * art-src: that folder was emptied on Oct 1 2026 and is being recovered, so nothing new is written into it.
 * A copy of every raw sheet is kept in notes/art-review/landmarks/<set>-raw.jpg (art-src* is not backed up).
 * Baked: public/art/board/<set>/landmarks.webp as the sheet `landmarks` of the set's biome.json, and
 * `landmarks` (the ids) on the set's manifest entry. This bakes ONLY the landmarks: the rest of a set's
 * art is left as it is (a whole set re-baked by templates/biome.mjs puts them in the same sheet).
 *
 * The sheet is drawn after the set's own picture (notes/art-review/biomes/<set>.jpg, the town built of
 * its pieces, committed), so that the landmarks are the same place in the same rendering.
 */
import fs from 'node:fs';
import path from 'node:path';
import { balance, makeStill, ready } from './rfab.mjs';
import { readImage, writeJpg } from './lib/img.mjs';
import { ART, REVIEW, SRC, putEntry } from './lib/manifest.mjs';
import { cutProps, packSprites } from './templates/terrain.mjs';
import { BIOMES } from './biomes.mjs';
import { wordsOf } from './templates/biome.mjs';

const args = process.argv.slice(2);
const bakeOnly = args.includes('--bake');
const asked = args.filter((a) => !a.startsWith('--'));
const sets = BIOMES.filter((b) => b.landmarks?.length && (!asked.length || asked.includes(b.id)));
const NEW_SRC = process.env.BROODFALL_ART_NEW || path.join(path.dirname(SRC), 'art-src-new');
const rawOf = (b) => path.join(NEW_SRC, 'terrain', b.id, 'props-landmark.png');
fs.mkdirSync(path.join(REVIEW, 'landmarks'), { recursive: true });

if (!bakeOnly) {
  await ready?.();
  await Promise.all(sets.map(async (b) => {
    const words = wordsOf(b.id).find((w) => w.file === 'props-landmark.png').words;
    try {
      await makeStill({
        slug: `${b.id} landmarks`, out: rawOf(b), prompt: words, key: b.key[0], keyName: b.key[1], quality: 'high',
        width: 1536, height: 1024, refFiles: [path.join(REVIEW, 'biomes', `${b.id}.jpg`)],
      });
    } catch (e) { console.warn(`[landmarks] ${b.id}: the picture failed: ${String(e.message).slice(0, 200)}`); }
  }));
}

const manifest = JSON.parse(fs.readFileSync(path.join(ART, 'manifest.json'), 'utf8'));
let made = 0;
for (const b of sets) {
  const raw = rawOf(b);
  if (!fs.existsSync(raw)) { console.warn(`[landmarks] ${b.id}: no picture at ${raw}`); continue; }
  writeJpg(path.join(REVIEW, 'landmarks', `${b.id}-raw.jpg`), readImage(raw));
  const cut = cutProps(raw, b.landmarks, `${b.id} landmarks`, { spill: b.spill ?? 'edge' });
  if (cut.length !== b.landmarks.length) { console.warn(`[landmarks] ${b.id}: ${cut.length} of ${b.landmarks.length} cut out; delete ${raw} to draw again`); continue; }
  const dir = path.join(ART, 'board', b.id);
  const packed = packSprites(cut, path.join(dir, 'landmarks.webp'), 1024, 90);
  const dataFile = path.join(dir, 'biome.json');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  data.sheets.landmarks = { atlas: `board/${b.id}/landmarks.webp`, sprites: packed.rects };
  fs.writeFileSync(dataFile, `${JSON.stringify(data)}\n`);
  const entry = manifest.biomes?.[b.id];
  if (!entry) { console.warn(`[landmarks] ${b.id}: no manifest entry`); continue; }
  putEntry('biomes', b.id, { ...entry, landmarks: cut.map((s) => s.id.replace(/^prop-/, '')) });
  made++;
  console.log(`[landmarks] ${b.id}: ${cut.length} landmarks, ${Math.round(packed.bytes / 1024)} KB`);
}
console.log(`[landmarks] baked ${made} of ${sets.length} sets`);
try { console.log(await balance()); } catch { /* the balance is a courtesy */ }
