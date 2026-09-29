/**
 * Free checks of the pipeline code on material already on disk (no generation).
 *
 *   node tools/art/lib/selftest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blank, over, readFrames, readImage, resize, writePng } from './img.mjs';
import { fringe, keyClip, keyOf, loopWindow, unionBox } from './key.mjs';
import { figure, findFigures } from './sheet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'art-src', 'selftest');
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };

// 1. The sheet cutter finds every figure on the six approved unit sheets.
const TURN = path.join(ROOT, 'art-src', 'units', 'soldier', 'turnaround.png');
if (fs.existsSync(TURN)) {
  const img = readImage(TURN);
  const found = findFigures(img, { expect: 5 });
  const widths = found.boxes.map((b) => b.x1 - b.x0);
  check(found.boxes.length === 5 && Math.max(...widths) < img.w / 4, `turnaround: 5 views found, widths ${widths.join(' ')}`);
}

const EXPECT = { 'units-v2-1-first-waves': 5, 'units-v2-2-army': 5, 'units-v2-3-siege': 6, 'units-v2-4-last': 7, 'units-v2-5-science': 6, 'units-v2-6-royal': 3 };
for (const [name, n] of Object.entries(EXPECT)) {
  const file = path.join(ROOT, 'notes', 'concepts', '2026-09-29', `${name}.png`);
  if (!fs.existsSync(file)) { check(false, `${name}: sheet is missing`); continue; }
  const img = readImage(file);
  const found = findFigures(img, { expect: n });
  const { boxes } = found;
  check(boxes.length === n, `${name}: ${boxes.length} figures found, ${n} expected`);
  const strip = blank(boxes.length * 256, 256, [40, 40, 40, 255]);
  boxes.forEach((b, i) => over(strip, resize(figure(img, b, found), 256, 256), i * 256, 0));
  writePng(path.join(OUT, `${name}-figures.png`), strip);
}

// 2. The keyer on a clip from the first probe.
const clipFile = path.join(ROOT, 'art-src', 'probes', 'rts-soldier-clip.mp4');
if (fs.existsSync(clipFile)) {
  const keyed = keyClip(readFrames(clipFile, 12));
  const box = unionBox(keyed.frames);
  const solid = keyed.frames.map((f) => { let n = 0; for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 128) n++; return n / (f.w * f.h); });
  const lw = loopWindow(keyed.frames);
  const fr = fringe(keyed.frames[lw.start], keyOf(keyed.key));
  console.log(`      key colour ${keyed.key}, box ${JSON.stringify(box)}, solid ${Math.min(...solid).toFixed(3)}-${Math.max(...solid).toFixed(3)}, loop ${lw.start}-${lw.end} seam ${lw.seam.toFixed(2)} motion ${lw.motion.toFixed(2)}, fringe ${(fr * 100).toFixed(1)}%`);
  check(keyed.frames.length >= 40, `clip decoded (${keyed.frames.length} frames)`);
  check(Math.min(...solid) > 0.03 && Math.max(...solid) < 0.6, 'subject is neither missing nor the whole frame');
  check(box && box.x0 > 4 && box.y0 > 4 && box.x1 < keyed.w - 4 && box.y1 < keyed.h - 4, 'subject does not touch the frame edge');
  check(lw.seam < 4, `loop seam ${lw.seam.toFixed(2)} is under 4`);
  check(fr < 0.05, `background tint left on the outline: ${(fr * 100).toFixed(1)}%`);
  // What it looks like: three frames over street colour and over creep colour.
  const sheet = blank(128 * 6, 128, [0, 0, 0, 255]);
  [[185, 179, 164], [74, 31, 36]].forEach((c, row) => [lw.start, Math.floor((lw.start + lw.end) / 2), lw.end - 1].forEach((fi, k) => {
    const tile = blank(128, 128, [...c, 255]);
    const f = keyed.frames[fi];
    const side = Math.max(box.x1 - box.x0, box.y1 - box.y0);
    const cut = { w: side, h: side, data: Buffer.alloc(side * side * 4) };
    for (let y = 0; y < side; y++) f.data.copy(cut.data, y * side * 4, ((box.y0 + y) * f.w + box.x0) * 4, ((box.y0 + y) * f.w + box.x0 + Math.min(side, f.w - box.x0)) * 4);
    over(tile, resize(cut, 128, 128), 0, 0);
    over(sheet, tile, (row * 3 + k) * 128, 0);
  }));
  writePng(path.join(OUT, 'keyer.png'), sheet);
} else {
  console.log('SKIP  keyer: no probe clip on disk');
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
