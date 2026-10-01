/**
 * Redraw the contact scene pictures whose channel changed (Collins, Oct 1 2026: crops, synced radio, a laser),
 * WITHOUT running the ship template's bake (which bakes every ship picture from art-src/, and art-src/ was
 * wiped on Oct 1 2026 and is being recovered). Raw stills go to art-src-new/ship/scenes/ (git-ignored); the
 * baked webp replaces public/art/ship/scenes/<id>.webp at the size the template bakes (640x427). The manifest
 * is not touched (same paths). Spends one high-quality still per id (~$0.45).
 *
 *   node tools/art/redraw-contacts.mjs delegation-contact institute-contact
 *   node tools/art/redraw-contacts.mjs --bake delegation-contact     (from the raw on disk, free)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill } from './rfab.mjs';
import { readImage, writePng, toWebp } from './lib/img.mjs';
import { ART, ROOT } from './lib/manifest.mjs';
import { scenePrompt } from './templates/ship.mjs';

// BROODFALL_ART_NEW: the art-src-new/ of the main checkout, when this runs in a worktree.
const RAW = path.join(process.env.BROODFALL_ART_NEW || path.join(ROOT, 'art-src-new'), 'ship', 'scenes');
const args = process.argv.slice(2);
const bakeOnly = args.includes('--bake');
const ids = args.filter((a) => !a.startsWith('--'));
const LEADER_REF = { 'institute-contact': 'institute', 'delegation-contact': null };

for (const id of ids) {
  const out = path.join(RAW, `${id}.png`);
  if (!bakeOnly) {
    const leader = LEADER_REF[id];
    let refFiles;
    if (leader) {
      // The template's reference is the raw leader still (art-src/); the baked one stands in for it.
      const ref = path.join(RAW, 'refs', `leader-${leader}.png`);
      if (!fs.existsSync(ref)) writePng(ref, readImage(path.join(ART, 'ship', `leader-${leader}.webp`)));
      refFiles = [ref];
    }
    await makeStill({ slug: `scene ${id}`, out, prompt: scenePrompt(id), key: null, width: 1536, height: 1024, quality: 'high', ...(refFiles ? { refFiles } : {}) });
  }
  const png = path.join(RAW, `${id}-640.png`);
  writePng(png, readImage(out, { w: 640, h: 427 }));
  toWebp(png, path.join(ART, 'ship', 'scenes', `${id}.webp`), { q: 84 });
  console.log(`[contacts] ${id}: baked public/art/ship/scenes/${id}.webp`);
}
