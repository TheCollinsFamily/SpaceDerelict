/**
 * THE DATA PAD, COMPOSITED OFFLINE, FRAME-EXACT (Oct 2 2026, the shake). Renders what the game draws at every frame of
 * a baked clip: the clip over a real game screenshot warped into its corners (grown 4 px, as src/ui/padOutro.ts does),
 * so a bake's fit can be judged without a browser's timing in the way.
 *
 *   node tools/measure/pad-composite.mjs <webm> <json> <out.mp4> [--crop x,y,w,h] [--slow 3] [--label TEXT]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readImage } from '../art/lib/img.mjs';
import { rectToQuad } from '../art/templates/pad-bake.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PICTURE = path.join(ROOT, 'notes', 'screens', '2026-09-30', 'board-14-unclaimed-city-home-view.jpg');
const [webm, jsonFile, out] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const slow = Number(opt('--slow', '1'));
const crop = opt('--crop', null);
const label = opt('--label', '');

const j = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const W = j.w, H = j.h;
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx', '-i', webm, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 4 * 1024 * 1024 * 1024 });
if (r.status !== 0) throw new Error(String(r.stderr));
const size = W * H * 4;
const n = Math.floor(r.stdout.length / size);
const pic = readImage(PICTURE, { w: 1280, h: 720 });

function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
function grow(q, px) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  return q.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / l * px, y + (y - cy) / l * px]; });
}
/** Bilinear sample of the picture. */
function sample(u, v, o, p) {
  if (u < 0 || v < 0 || u >= pic.w - 1 || v >= pic.h - 1) { o[p] = o[p + 1] = o[p + 2] = 0; return; }
  const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y;
  const i00 = (y * pic.w + x) * 4, i10 = i00 + 4, i01 = i00 + pic.w * 4, i11 = i01 + 4;
  for (let c = 0; c < 3; c++) {
    o[p + c] = (pic.data[i00 + c] * (1 - fx) + pic.data[i10 + c] * fx) * (1 - fy) + (pic.data[i01 + c] * (1 - fx) + pic.data[i11 + c] * fx) * fy;
  }
}
const frames = [];
const tmp = Buffer.alloc(4);
for (let i = 0; i < n; i++) {
  const f = r.stdout.subarray(i * size, (i + 1) * size);
  const o = Buffer.alloc(W * H * 3);
  const qq = j.quads[Math.min(i, j.quads.length - 1)];
  const inv = qq ? invert3(rectToQuad(pic.w, pic.h, grow([[qq[0], qq[1]], [qq[2], qq[3]], [qq[4], qq[5]], [qq[6], qq[7]]], 4))) : null;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4, q = (y * W + x) * 3;
    const al = f[p + 3] / 255;
    let br = 0, bg = 0, bb = 0;
    if (al < 1 && inv) {
      const z = inv[6] * x + inv[7] * y + inv[8];
      sample((inv[0] * x + inv[1] * y + inv[2]) / z, (inv[3] * x + inv[4] * y + inv[5]) / z, tmp, 0);
      br = tmp[0]; bg = tmp[1]; bb = tmp[2];
    }
    o[q] = f[p] * al + br * (1 - al); o[q + 1] = f[p + 1] * al + bg * (1 - al); o[q + 2] = f[p + 2] * al + bb * (1 - al);
  }
  frames.push(o);
}
const rawFile = path.join(os.tmpdir(), `pad-composite-${process.pid}.rgb`);
fs.writeFileSync(rawFile, Buffer.concat(frames));
const vf = [crop ? `crop=${crop.split(',').join(':')}` : null, `setpts=${slow}*PTS`,
  label ? `drawtext=text='${label}':x=10:y=10:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6` : null].filter(Boolean).join(',');
const e = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(j.fps), '-i', rawFile,
  '-vf', vf, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out]);
fs.rmSync(rawFile, { force: true });
if (e.status !== 0) throw new Error(String(e.stderr).slice(-400));
console.log(`${out}: ${n} frames at ${j.fps} fps, x${slow} slower`);
