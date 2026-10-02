/**
 * THE SLAB LOCKED ON EVERY LOOK PICTURE (Oct 2 2026; tools/art/lib/shapeGate.mjs lockSlab). For every look of every
 * limb drawn over its ground plate, every view: the limb's own slab is put back under it where the look left a tile of
 * its footprint bare, and anything the look laid on the ground in front of or beside the footprint is cleared. The
 * picture as drawn is kept beside it (`<view>.drawn.png`, made once); the locked one replaces `<view>.png`. Free.
 *
 *   node tools/art/lock-looks.mjs [families]
 *
 * Then: node tools/art/gate-shapes.mjs --looks (the gate decides; a look that still fails is re-rolled).
 */
import fs from 'node:fs';
import path from 'node:path';
import { LIMBS, rawDirOf } from './limbs.mjs';
import { readImage, borderColour, writePng } from './lib/img.mjs';
import { keyFrame, keyOf } from './lib/key.mjs';
import { VIEW_FACING } from './lib/plate.mjs';
import { gateFull, lockSlab } from './lib/shapeGate.mjs';
import { SRC } from './lib/manifest.mjs';

const fams = process.argv.slice(2);
const VIEWS = ['front', 'back', 'side', 'backside'];

function keyedWithKey(file) {
  const img = readImage(file, { w: 1024, h: 1024 });
  const bg = borderColour(img);
  keyFrame(img, keyOf(bg), { spill: 'edge' });
  return { img, bg };
}
/** A keyed picture laid back on its key colour, as the picture model and the clips expect. */
function flatten(img, bg) {
  const out = { w: img.w, h: img.h, data: Buffer.alloc(img.w * img.h * 4) };
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255;
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.round(img.data[i + k] * a + bg[k] * (1 - a));
    out.data[i + 3] = 255;
  }
  return out;
}

export function lockLooksOf(l) {
  const dir = path.join(SRC, 'limbs', rawDirOf(l));
  const looks = path.join(SRC, 'limbs', `${rawDirOf(l)}-looks`);
  if (!fs.existsSync(looks)) return 0;
  let n = 0;
  for (const view of VIEWS) {
    const baseFile = path.join(dir, `${view}.png`);
    if (!fs.existsSync(baseFile)) continue;
    const base = keyedWithKey(baseFile).img;
    const fit = gateFull(base, l.plate, VIEW_FACING[view]).fit;
    for (const key of fs.readdirSync(looks)) {
      const file = path.join(looks, key, `${view}.png`);
      if (!fs.existsSync(file)) continue;
      const drawn = path.join(looks, key, `${view}.drawn.png`);
      if (!fs.existsSync(drawn)) fs.copyFileSync(file, drawn);
      const { img, bg } = keyedWithKey(drawn);
      lockSlab(img, base, l.plate, VIEW_FACING[view], fit);
      writePng(file, flatten(img, bg));
      n++;
    }
  }
  return n;
}

if (process.argv[1] && process.argv[1].endsWith('lock-looks.mjs')) {
  for (const l of LIMBS.filter((x) => x.plate && x.plate !== 'one' && (!fams.length || fams.includes(x.family)))) {
    console.log(`[lock] ${l.family}: ${lockLooksOf(l)} picture(s) locked`);
  }
}
