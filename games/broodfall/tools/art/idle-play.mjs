/**
 * AN IDLE AS THE GAME PLAYS IT, to LOOK at (free, read-only; Sep 30 2026). Plays a limb's idle (or a
 * core stage's) the way src/render/idleClock.ts does: its loop or its eased ping-pong, the next frame
 * cross-faded over this one, the breathing of a near-still one. Writes, per clip:
 *   <out>/<name>.mp4        two turns of the loop at 30 fps, at 2x, over the creep's colour
 *   <out>/<name>-seam.jpg   the 10 video frames either side of the loop's seam (or the ping-pong's turn), big
 *
 *   node tools/art/idle-play.mjs [--out <dir>] [--back] limb... | core-1 core-2 ...
 * Default out: <os tmp>/broodfall-idle-play/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { blank, crop, paste, readImage, resize, writeJpg, writePng } from './lib/img.mjs';
import { ART, readManifest } from './lib/manifest.mjs';
import { GROUNDS } from './lib/atlas.mjs';
import { breath, idleFrames, idleLength } from '../../src/render/idleClock.ts';

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? args[oi + 1] : path.join(tmpdir(), 'broodfall-idle-play');
const back = args.includes('--back');
// --before <art dir>: another copy of public/art (the atlases as they were), played the OLD way: whole
// frames on the clock, no cross-fade, no ping-pong, no breathing (for the before/after numbers).
const bi = args.indexOf('--before');
const BEFORE = bi >= 0 ? args[bi + 1] : null;
const names = args.filter((a, i) => !a.startsWith('--') && (oi < 0 || i !== oi + 1) && (bi < 0 || i !== bi + 1));
fs.mkdirSync(OUT, { recursive: true });
const DIR = BEFORE ?? ART;
const m = BEFORE ? JSON.parse(fs.readFileSync(path.join(BEFORE, 'manifest.json'), 'utf8')) : readManifest();
const cache = new Map();
const page = (f) => { if (!cache.has(f)) cache.set(f, readImage(path.join(DIR, f))); return cache.get(f); };

function clipOf(name) {
  if (name.startsWith('core-')) {
    const s = m.board.coreEvo.stages[Number(name.slice(5)) - 1];
    return { img: page(s.idle.atlas), F: s.idle.frame, cols: s.idle.cols, clip: { ...s.idle, start: 0 } };
  }
  const a = m.limbs[name];
  const side = back ? a.back : a;
  return { img: page(a.atlas), F: a.frame, cols: a.cols, clip: side.anims.idle };
}

/** premultiplied mix of frames a and b (b over a at f), scaled about the foot (bottom middle) by breath, over the ground. */
function compose(src, F, cols, a, b, f, [bx, by], S) {
  const fa = crop(src, (a % cols) * F, Math.floor(a / cols) * F, F, F);
  const fb = crop(src, (b % cols) * F, Math.floor(b / cols) * F, F, F);
  const A = resize(fa, S, S), B = resize(fb, S, S);
  const out = blank(S, S, [...GROUNDS.creep, 255]);
  const g = GROUNDS.creep;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // Breathing: sample from the point it came from, about the foot (bottom middle, 85% down).
    const sx = Math.round(S / 2 + (x - S / 2) / bx), sy = Math.round(S * 0.85 + (y - S * 0.85) / by);
    if (sx < 0 || sy < 0 || sx >= S || sy >= S) continue;
    const i = (sy * S + sx) * 4, o = (y * S + x) * 4;
    const aa = A.data[i + 3] / 255, ba = (B.data[i + 3] / 255) * f;
    for (let c = 0; c < 3; c++) {
      const under = A.data[i + c] * aa + g[c] * (1 - aa);
      out.data[o + c] = Math.round(B.data[i + c] * ba + under * (1 - ba));
    }
  }
  return out;
}

for (const name of names) {
  const { img, F, cols, clip } = clipOf(name);
  const S = Math.min(512, F * 2);
  const L = BEFORE ? clip.count / clip.fps : idleLength(clip);
  const fps = 30;
  const n = Math.round(2 * L * fps);
  const dir = path.join(OUT, `${name}${back ? '-back' : ''}-frames`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  for (let k = 0; k < n; k++) {
    const t = k / fps;
    const { a, b, f } = BEFORE ? { a: clip.start + (Math.floor(t * clip.fps) % clip.count), b: 0, f: 0 } : idleFrames(clip, t);
    const fr = compose(img, F, cols, a, b, f, clip.breathe && !BEFORE ? breath(t) : [1, 1], S);
    writePng(path.join(dir, `f-${String(k).padStart(4, '0')}.png`), fr);
    frames.push(fr);
  }
  const tag = `${name}${back ? '-back' : ''}${BEFORE ? '-before' : ''}`;
  // Frame to frame on the screen: the biggest change against the mean (a snap stands out as a spike).
  const d = [];
  for (let k = 1; k < frames.length; k++) { let sum = 0; const A = frames[k - 1].data, B = frames[k].data; for (let i = 0; i < A.length; i += 4) sum += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); d.push(sum / (A.length / 4) / 3); }
  const med = d.reduce((x, y) => x + y, 0) / d.length;
  const peak = Math.max(...d);
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(dir, 'f-%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', path.join(OUT, `${tag}.mp4`)]);
  // Around the seam (a loop's end) or the turn (a ping-pong's far end): 10 frames each side.
  const at = Math.round((clip.pingpong ? L / 2 : L) * fps);
  const around = frames.slice(Math.max(0, at - 10), at + 10);
  const W = Math.min(256, S);
  const sheet = blank(10 * W, 2 * W, [0, 0, 0, 255]);
  around.forEach((fr, i) => paste(sheet, resize(fr, W, W), (i % 10) * W, Math.floor(i / 10) * W));
  writeJpg(path.join(OUT, `${tag}-seam.jpg`), sheet, 3);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${tag}: ${clip.count} frames, ${clip.pingpong ? 'ping-pong' : 'loop'} of ${L.toFixed(2)} s${clip.breathe ? ', breathes' : ''}; on screen per 1/30 s: mean ${med.toFixed(2)}, peak ${peak.toFixed(2)} (${(peak / Math.max(0.01, med)).toFixed(1)}x) -> ${path.join(OUT, tag + '.mp4')}`);
}
