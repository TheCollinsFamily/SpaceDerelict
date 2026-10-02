/**
 * KEEP THE OLD LIMB ART (Collins, Oct 2 2026: "keep the original art in case we use it for something else").
 *
 *   node tools/art/archive-limbs.mjs impaler lance ...
 *
 * Before a limb is redrawn for its new footprint, its baked art is COPIED (never moved, never deleted) to
 * public/art/limbs-legacy/<family>/ (its atlas and every upgrade-look atlas of it), and its manifest entry is
 * kept in public/art/limbs-legacy/legacy-manifest.json under its family, with the date it was archived. Its raw
 * files are not touched: a redrawn limb draws into a NEW raw folder (`srcDir` in tools/art/limbs.mjs), so the old
 * art-src/limbs/<family>/ stays as it was. Archiving the same limb again keeps the first copy.
 *
 * To put an old look back: copy its files from limbs-legacy/<family>/ into public/art/limbs/ and its entry from
 * legacy-manifest.json into manifest.json's limbs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ART } from './lib/manifest.mjs';

const families = process.argv.slice(2);
if (!families.length) throw new Error('name the limbs to archive');
const LEGACY = path.join(ART, 'limbs-legacy');
const manifest = JSON.parse(fs.readFileSync(path.join(ART, 'manifest.json'), 'utf8'));
const legacyFile = path.join(LEGACY, 'legacy-manifest.json');
const legacy = fs.existsSync(legacyFile) ? JSON.parse(fs.readFileSync(legacyFile, 'utf8')) : {};
const date = new Date().toISOString().slice(0, 10);

for (const family of families) {
  const entry = manifest.limbs[family];
  if (!entry) throw new Error(`${family}: no manifest entry`);
  if (legacy[family]) { console.log(`[archive] ${family}: already archived (${legacy[family].archived}), kept`); continue; }
  const dir = path.join(LEGACY, family);
  fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(path.join(ART, 'limbs')).filter((f) => f === `${family}.webp` || f.startsWith(`${family}--`));
  for (const f of files) fs.copyFileSync(path.join(ART, 'limbs', f), path.join(dir, f));
  legacy[family] = { archived: date, files: files.map((f) => `limbs-legacy/${family}/${f}`), entry };
  console.log(`[archive] ${family}: ${files.length} atlas file(s) copied to limbs-legacy/${family}/`);
}
fs.mkdirSync(LEGACY, { recursive: true });
fs.writeFileSync(legacyFile, `${JSON.stringify(legacy, null, 1)}\n`);
