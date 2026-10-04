/**
 * How far a film's picture drifts along its take (Oct 4 2026). Every clip of a cut scene starts on the frame the one
 * before it was cut on, so whatever the video model does to the colour of a clip is handed on to the next: this prints
 * the mean and spread of each colour channel at each clip's first frame and at its cut, against the picture the take
 * started from. tools/media/cutscenes.ts corrects it (each clip is pulled back to the first picture's colour).
 *
 *   node tools/measure/cutscene-drift.mjs <film>            (free; reads art-src-new/cutscenes/<film>/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const film = process.argv[2];
const dir = path.join(root, 'art-src-new', 'cutscenes', film);
if (!film || !fs.existsSync(dir)) { console.error('usage: node tools/measure/cutscene-drift.mjs <film>'); process.exit(1); }

/** Mean and standard deviation of R, G and B of one frame of a file (frame n; -1: its last). */
export function stats(file, n = 0) {
  const sel = n < 0 ? ['-sseof', '-0.2', '-i', file, '-update', '1'] : ['-i', file, '-vf', `select=eq(n\\,${n}),scale=320:180`, '-frames:v', '1'];
  const args = n < 0 ? [...sel, '-vf', 'scale=320:180', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'] : [...sel, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'];
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 26 });
  const px = r.stdout.subarray(r.stdout.length - 320 * 180 * 3);
  const m = [0, 0, 0], s = [0, 0, 0];
  const N = px.length / 3;
  for (let i = 0; i < px.length; i += 3) for (let c = 0; c < 3; c++) m[c] += px[i + c];
  for (let c = 0; c < 3; c++) m[c] /= N;
  for (let i = 0; i < px.length; i += 3) for (let c = 0; c < 3; c++) s[c] += (px[i + c] - m[c]) ** 2;
  return { mean: m.map((x) => +x.toFixed(1)), sd: s.map((x) => +Math.sqrt(x / N).toFixed(1)) };
}

/**
 * SPECKS: bright isolated points (a hologram's sparkle, snow, static). The video model adds a few, the next clip starts
 * from a frame that has them and adds more: by the end of a take the whole picture snows (seen on the second take of the
 * first film, Oct 4 2026). Counted at 640x360: pixels whose brightness stands 40 or more above all four neighbours two
 * pixels away. tools/media/cutscenes.ts stops a take when a clip's count at its cut has grown (`specksOf` there).
 */
export function specks(file, n = 0) {
  const W = 640, H = 360;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `select=eq(n\\,${n}),scale=${W}:${H}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
  const px = r.stdout;
  if (px.length < W * H) return 0;
  let count = 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const v = px[y * W + x];
    if (v - px[y * W + x - 2] >= 40 && v - px[y * W + x + 2] >= 40 && v - px[(y - 2) * W + x] >= 40 && v - px[(y + 2) * W + x] >= 40) count++;
  }
  return count;
}

const clips = fs.readdirSync(dir).filter((f) => f.endsWith('.mp4')).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => a.t - b.t).map((x) => x.f);
const base = stats(path.join(dir, clips[0]), 0);
console.log(`start      mean ${base.mean.join(' ')}   spread ${base.sd.join(' ')}`);
for (const c of clips) {
  const side = path.join(dir, c.replace('.mp4', '.cut.json'));
  const cut = fs.existsSync(side) ? JSON.parse(fs.readFileSync(side, 'utf8')).frame : -1;
  const a = stats(path.join(dir, c), 0);
  const b = stats(path.join(dir, c), cut);
  const d = (x) => x.map((v, i) => `${v - base.mean[i] >= 0 ? '+' : ''}${(v - base.mean[i]).toFixed(0)}`).join(' ');
  const k = (x) => x.map((v, i) => `${(v / base.sd[i]).toFixed(2)}`).join(' ');
  const frames = cut >= 0 ? cut : 1;
  console.log(`${c.replace('.mp4', '').padEnd(5)} first: mean ${d(a.mean).padEnd(12)} spread x${k(a.sd)}   at its cut: mean ${d(b.mean).padEnd(12)} spread x${k(b.sd)}   specks ${String(specks(path.join(dir, c), 0)).padStart(4)} -> ${String(specks(path.join(dir, c), Math.max(1, frames))).padStart(4)}`);
}
