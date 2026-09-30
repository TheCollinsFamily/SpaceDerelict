/**
 * IDLE SEAMS, straight from the clips (free, read-only; Sep 30 2026): for every limb idle, where
 * the old cut (lib/key.mjs loopWindow on 48 px thumbs) closed its loop and how cleanly, against the
 * cut found by the fine measure the bake now uses (idleCut in templates/limb.mjs), in the units of
 * tools/art/idle-loops.mjs (mean change per step over the opaque pixels, 0-255).
 *
 *   node tools/art/idle-seams.mjs [families...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { readFrames } from './lib/img.mjs';
import { dropSpecks, keyClip, loopWindow } from './lib/key.mjs';
import { SRC } from './lib/manifest.mjs';
import { limb } from './limbs.mjs';
import { idleCut, fineFrames, fineDiff } from './templates/limb.mjs';

const want = process.argv.slice(2);
const fams = fs.readdirSync(path.join(SRC, 'limbs')).filter((f) => limb(f) && (!want.length || want.includes(f)));
const f = (x, d = 1) => x.toFixed(d).padStart(6);
console.log('limb       view    old: n  step  seam  s/s  | new: n  step  seam  s/s  treat');
for (const fam of fams) for (const view of ['front', 'back']) {
  const file = path.join(SRC, 'limbs', fam, `${view === 'back' ? 'back-' : ''}idle.mp4`);
  if (!fs.existsSync(file)) continue;
  const keyed = keyClip(readFrames(file, 12));
  if (!limb(fam).drips) for (const fr of keyed.frames) dropSpecks(fr);
  const fine = fineFrames(keyed.frames);
  const old = loopWindow(keyed.frames, { min: 16, max: 46 });
  const stepOf = (a, b) => { let s = 0; for (let i = a; i < b - 1; i++) s += fineDiff(fine[i], fine[i + 1]); return s / Math.max(1, b - a - 1); };
  // The old bake kept 16 of the window's frames: its step is that of every (n/16)th frame.
  const n0 = old.end - old.start;
  const idx = Array.from({ length: Math.min(16, n0) }, (_, i) => old.start + Math.floor((i * n0) / Math.min(16, n0)));
  let st0 = 0; for (let i = 0; i < idx.length - 1; i++) st0 += fineDiff(fine[idx[i]], fine[idx[i + 1]]); st0 /= idx.length - 1;
  const sm0 = fineDiff(fine[idx[idx.length - 1]], fine[idx[0]]);
  const cut = idleCut(keyed.frames, fine);
  console.log(`${fam.padEnd(10)} ${view.padEnd(5)}   ${String(n0).padStart(3)} ${f(st0)} ${f(sm0)} ${f(sm0 / st0, 2)}  |   ${String(cut.end - cut.start).padStart(3)} ${f(cut.step)} ${f(cut.seam)} ${f(cut.seam / cut.step, 2)}  ${cut.treat}`);
}
