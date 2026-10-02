/**
 * THE FOOTPRINT GATE over every picture (tools/art/lib/shapeGate.mjs): every view of every limb drawn over its
 * ground plate, and every upgrade-look picture of them. Free (it reads pictures on disk).
 *
 *   node tools/art/gate-shapes.mjs [families] [--looks] [--bases]   (neither: both)
 *
 * Writes notes/art-review/limbs/gate.json (every picture: pass, edge, beside) and prints each failure. A look is
 * gated where its limb's view stands (the base view's fit is the hint); a base view against its own best fit.
 * tests/shapeGate.test.ts fails while any picture in gate.json that is IN THE GAME fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LIMBS, rawDirOf } from './limbs.mjs';
import { readImage, borderColour } from './lib/img.mjs';
import { keyFrame, keyOf } from './lib/key.mjs';
import { VIEW_FACING } from './lib/plate.mjs';
import { gateFull as gate } from './lib/shapeGate.mjs';
import { REVIEW, SRC } from './lib/manifest.mjs';

const args = process.argv.slice(2);
const fams = args.filter((a) => !a.startsWith('--'));
const doLooks = args.includes('--looks') || !args.includes('--bases');
const doBases = args.includes('--bases') || !args.includes('--looks');
const VIEWS = ['front', 'back', 'side', 'backside'];

export function keyed(file) {
  const img = readImage(file, { w: 1024, h: 1024 });
  keyFrame(img, keyOf(borderColour(img)), { spill: 'edge' });
  return img;
}

const out = path.join(REVIEW, 'limbs', 'gate.json');
const all = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
let fails = 0, total = 0;
for (const l of LIMBS.filter((x) => !args.includes('--one') && x.plate && (!fams.length || fams.includes(x.family)))) {
  const dir = path.join(SRC, 'limbs', rawDirOf(l));
  const res = all[l.family] ?? {};
  const fits = {};
  for (const view of VIEWS) {
    const file = path.join(dir, `${view}.png`);
    if (!fs.existsSync(file)) continue;
    const g = gate(keyed(file), l.plate, VIEW_FACING[view]);
    fits[view] = g.fit;
    if (doBases) {
      res[`base ${view}`] = { pass: g.pass, edge: g.edge, beside: g.beside, rival: g.rival, tiles: g.tiles };
      total++;
      if (!g.pass) { fails++; console.log(`FAIL ${l.family} base ${view}: edge ${g.edge}, beside ${g.beside}, tiles ${g.tiles}, best other facing ${g.rival}`); }
    }
  }
  if (doLooks) {
    const looks = path.join(SRC, 'limbs', `${rawDirOf(l)}-looks`);
    if (fs.existsSync(looks)) for (const key of fs.readdirSync(looks)) {
      for (const view of VIEWS) {
        const file = path.join(looks, key, `${view}.png`);
        if (!fs.existsSync(file) || !fits[view]) continue;
        const g = gate(keyed(file), l.plate, VIEW_FACING[view], fits[view]);
        res[`${key} ${view}`] = { pass: g.pass, edge: g.edge, beside: g.beside, rival: g.rival, tiles: g.tiles };
        total++;
        if (!g.pass) { fails++; console.log(`FAIL ${l.family} ${key} ${view}: edge ${g.edge}, beside ${g.beside}, tiles ${g.tiles}, best other facing ${g.rival}`); }
      }
    }
  }
  all[l.family] = res;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(all, null, 1)}\n`);
console.log(`gate: ${total - fails}/${total} pictures pass`);

/**
 * THE ONE-CELL LIMBS' LOOKS (not drawn over a plate): a look must still stand on ONE cell. Its skirt (the widest row of
 * its base, thin parts taken off, in the lowest fifth of it) is measured against its limb's: no more than half again as
 * wide (a superstructure is drawn 1.2 times bigger), no less than two thirds. `--one` runs it.
 */
import { openedBase } from './lib/shapeGate.mjs';
function skirtWidth(img) {
  const b = openedBase(img);
  let top = b.h, bottom = -1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.mask[y * b.w + x]) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  let best = 0;
  for (let y = Math.round(bottom - (bottom - top) * 0.2); y <= bottom; y++) {
    let a = -1, z = -1;
    for (let x = 0; x < b.w; x++) if (b.mask[y * b.w + x]) { if (a < 0) a = x; z = x; }
    if (a >= 0) best = Math.max(best, z - a);
  }
  return best;
}
if (args.includes('--one')) {
  const one = {};
  let pass = 0, n = 0;
  for (const l of LIMBS.filter((x) => !x.plate && (!fams.length || fams.includes(x.family)))) {
    const looks = path.join(SRC, 'limbs', `${rawDirOf(l)}-looks`);
    const baseFile = path.join(SRC, 'limbs', rawDirOf(l), 'styled.png');
    if (!fs.existsSync(looks) || !fs.existsSync(baseFile)) continue;
    const bw = skirtWidth(keyed(baseFile));
    for (const key of fs.readdirSync(looks)) {
      const f = path.join(looks, key, 'front.png');
      if (!fs.existsSync(f)) continue;
      const r = skirtWidth(keyed(f)) / bw;
      const ok = r >= 0.67 && r <= 1.5;
      one[`${l.family} ${key}`] = { pass: ok, ratio: Number(r.toFixed(2)) };
      n++; if (ok) pass++; else console.log(`FAIL one-cell ${l.family} ${key}: its skirt is ${r.toFixed(2)} times its limb's`);
    }
  }
  fs.writeFileSync(path.join(REVIEW, 'limbs', 'gate-one.json'), `${JSON.stringify(one, null, 1)}\n`);
  console.log(`one-cell looks: ${pass}/${n} keep one cell`);
}
