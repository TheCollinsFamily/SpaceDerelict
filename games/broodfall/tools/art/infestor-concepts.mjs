/**
 * THE INFESTOR, REDESIGNED (Oct 2 2026, Collins: "the Infestor is a little boring-looking for such an elite and important
 * unit"). Three concepts, drawn as the unit design step would draw one (the brood's own material, the board's camera),
 * so the chosen one can become the unit's design picture (art-src-new/units/infestor/ref.png). Look at them all:
 * notes/art-review/infestor/concepts.jpg. ~$0.45 each.
 *
 *   node tools/art/infestor-concepts.mjs      (BROODFALL_ART_SRC = art-src-new)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
process.env.BROODFALL_ART_SRC ??= path.join(ROOT, 'art-src-new');
const { makeStill, ready } = await import('./rfab.mjs');
const { readImage, resize, writeJpg, blank, paste } = await import('./lib/img.mjs');
const { SRC, REVIEW } = await import('./lib/manifest.mjs');

const DIR = path.join(SRC, 'units', 'infestor-concepts');
const REV = path.join(REVIEW, 'infestor');
fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync(REV, { recursive: true });

const FRAME = 'One creature for a strategy game, seen from high above, looking steeply down, at the camera of the reference pictures: an ELITE siege organism of the same living brood as the creatures in the FIRST and SECOND reference pictures (their glossy wet pink flesh, dark scaly plates in a lattice of pale veins), clearly rarer, more dangerous and more precious than them: the one a player is nervous to escort. Its body reads at a glance from above even when small. No eyes, no clothes, no kit, no text. It faces the lower left, caught mid-stride.';
export const CONCEPTS = {
  'a-siege-tick': `${FRAME} It is a SIEGE TICK: a low, broad, heavily armoured body like a huge tick, covered in overlapping pale bone plates edged in dark red; at its front a ring of six curved bone drill-mandibles closed around a boring proboscis; its swollen rear abdomen is translucent and glowing amber, packed with dark creep and clustered eggs it will seed into a building; a short crest of dark spines along its back; eight short thick hooked legs.`,
  'b-bore-worm': `${FRAME} It is a BORE-WORM: a thick armoured segmented siege-worm carried on many short hooked legs, its back covered in overlapping bone plates like a pangolin's scales with a ridge crest of dark spines; its front is a great round DRILL HEAD of spiralled bone teeth that can turn, ringed by a collar of fine probing tendrils; along each flank a row of glowing violet egg sacs; its tail end tapers into a swollen pod of dark creep.`,
  'c-seed-crawler': `${FRAME} It is a SEED-CRAWLER: an armoured crab-like crawler on six strong jointed legs, its body a domed carapace of overlapping bone plates edged in dark red, cracked open along the top to show a glowing amber womb of creep and eggs inside; at its front two great curved bone drill-tusks and a tube-like boring proboscis between them; a crown of short flexible tendrils round its head; thin dark spines along the carapace edge.`,
};

await ready?.();
const refs = [
  path.join(SRC, 'units', 'broodmother', 'view-SW.png'),
  path.join(SRC, 'units', 'broodling', 'turnaround.png'),
  path.join(SRC, 'refs', 'board-camera.png'),
];
for (const r of refs) if (!fs.existsSync(r)) throw new Error(`missing reference: ${r}`);
await Promise.all(Object.entries(CONCEPTS).map(([id, prompt]) => {
  const out = path.join(DIR, `${id}.png`);
  if (fs.existsSync(out)) return null;
  return makeStill({ slug: `infestor concept ${id}`, out, prompt, quality: 'high', width: 1024, height: 1024, refFiles: refs })
    .catch((e) => console.warn(`[infestor] ${id}: ${String(e.message).slice(0, 200)}`));
}));
// The sheet, side by side, with the old design at the left for comparison.
const old = path.join(SRC, 'units', 'infestor', 'v1', 'ref.png');
const files = [...(fs.existsSync(old) ? [old] : []), ...Object.keys(CONCEPTS).map((id) => path.join(DIR, `${id}.png`)).filter((f) => fs.existsSync(f))];
const sheet = blank(files.length * 520, 520, [60, 60, 64, 255]);
files.forEach((f, i) => paste(sheet, resize(readImage(f), 512, 512), i * 520 + 4, 4));
writeJpg(path.join(REV, 'concepts.jpg'), sheet);
for (const id of Object.keys(CONCEPTS)) { const f = path.join(DIR, `${id}.png`); if (fs.existsSync(f)) writeJpg(path.join(REV, `concept-${id}.jpg`), readImage(f)); }
console.log(`[infestor] concepts: ${files.length} on the sheet`);
