/**
 * THE LOOK SHEETS WITH THE GATE WRITTEN ON THEM (Oct 2 2026): notes/art-review/limbs/looks/<limb>-stills.jpg, one row
 * per view: the limb's own picture, then each look's; on every picture its footprint-gate result (PASS or FAIL, the
 * front-edge match and the least-covered tile) from notes/art-review/limbs/gate.json. Free.
 *
 *   node tools/art/gate-sheet.mjs [families]      (run tools/art/gate-shapes.mjs first)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LIMBS, rawDirOf } from './limbs.mjs';
import { ffmpeg } from './rfab.mjs';
import { REVIEW, SRC } from './lib/manifest.mjs';

const fams = process.argv.slice(2);
const gate = JSON.parse(fs.readFileSync(path.join(REVIEW, 'limbs', 'gate.json'), 'utf8'));
const VIEWS = ['front', 'back', 'side', 'backside'];
const T = 256;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-sheet-'));
const blank = path.join(tmp, 'blank.png');
ffmpeg(['-f', 'lavfi', '-i', `color=c=0x1e1e1e:s=${T}x${T}`, '-frames:v', '1', blank], 'blank');

function tile(file, label, ok, out) {
  const colour = ok === null ? 'white' : ok ? '0x7CFC9A' : '0xFF6A6A';
  const text = label.replace(/:/g, '\\:').replace(/'/g, '');
  ffmpeg(['-i', file, '-vf', `scale=${T}:${T},drawtext=text='${text}':x=6:y=6:fontsize=15:fontcolor=${colour}:box=1:boxcolor=black@0.75`, '-frames:v', '1', out], `tile ${label}`);
  return out;
}

for (const l of LIMBS.filter((x) => x.plate && (!fams.length || fams.includes(x.family)))) {
  const dir = path.join(SRC, 'limbs', rawDirOf(l));
  const looksDir = path.join(SRC, 'limbs', `${rawDirOf(l)}-looks`);
  const keys = fs.existsSync(looksDir) ? fs.readdirSync(looksDir).filter((k) => fs.statSync(path.join(looksDir, k)).isDirectory()).sort() : [];
  const g = gate[l.family] ?? {};
  const rows = [];
  for (const view of VIEWS) {
    const baseFile = path.join(dir, `${view}.png`);
    if (!fs.existsSync(baseFile)) continue;
    const cells = [];
    const say = (r) => (r ? `${r.pass ? 'PASS' : 'FAIL'} e${r.edge.toFixed(2)} t${Math.min(...(r.tiles ?? [1])).toFixed(2)}` : 'not gated');
    const b = g[`base ${view}`];
    cells.push(tile(baseFile, `${view} limb ${say(b)}`, b ? b.pass : null, path.join(tmp, `${l.family}-${view}-base.png`)));
    for (const key of keys) {
      const f = path.join(looksDir, key, `${view}.png`);
      const r = g[`${key} ${view}`];
      cells.push(fs.existsSync(f) ? tile(f, `${key} ${say(r)}`, r ? r.pass : null, path.join(tmp, `${l.family}-${view}-${key}.png`)) : blank);
    }
    const row = path.join(tmp, `${l.family}-${view}-row.png`);
    if (cells.length === 1) fs.copyFileSync(cells[0], row);
    else ffmpeg([...cells.flatMap((c) => ['-i', c]), '-filter_complex', `hstack=inputs=${cells.length}`, row], 'row');
    rows.push(row);
  }
  if (!rows.length) continue;
  const out = path.join(REVIEW, 'limbs', 'looks', `${l.family}-stills.jpg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (rows.length === 1) ffmpeg(['-i', rows[0], '-q:v', '3', out], 'sheet');
  else ffmpeg([...rows.flatMap((r) => ['-i', r]), '-filter_complex', `vstack=inputs=${rows.length}`, '-q:v', '3', out], 'sheet');
  console.log(`[gate-sheet] ${out}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
