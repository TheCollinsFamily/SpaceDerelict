/**
 * The data pad's bake (tools/art/templates/pad.mjs; free, runs from the clips on disk):
 *
 *   clip (720p mp4) -> RGBA frames at 24 fps
 *   -> the key colour measured on the screen itself (the middle of frame 0) and Leaflit's studio
 *      ChromaKey set to it (tools/art/lib/leaflit.mjs: the studio's own class, its similarity
 *      calibrated the studio's way on the screen and capped under the black of the bezel)
 *   -> the screen found in every frame: the biggest keyed patch, its outline, four corners from
 *      the outline's extremes, then each edge FITTED again to the outline with the points a finger
 *      pushes inward thrown out, the corners where the fitted edges meet; smoothed over time
 *   -> the key kept only inside that screen (anything else green, the planet in the window, stays)
 *   -> public/art/pad/<id>.webm (VP8 with alpha) + public/art/pad/<id>.json (the corners of every
 *      frame, clockwise from top left, in the clip's pixels) + public/art/pad/manifest.json
 *   -> notes/art-review/pad/<id>.jpg: eight frames with a real game picture warped into the screen,
 *      exactly as the game draws it, and <id>-track.jpg with the found edges drawn.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { readImage, writeJpg, resize } from '../lib/img.mjs';
import { keyFrame as studioKey, loadChromaKey } from '../lib/leaflit.mjs';
import { ROOT } from '../lib/manifest.mjs';
import { DIR, OUT, LOOK, W, H, FPS } from './pad.mjs';

const MAX = 4 * 1024 * 1024 * 1024;
const REVIEW_PICTURE = path.join(ROOT, 'notes', 'screens', '2026-09-30', 'board-14-unclaimed-city-home-view.jpg');

function decode(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos`,
    '-an', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: MAX });
  if (r.status !== 0) throw new Error(`${file}: ${String(r.stderr).slice(-300)}`);
  const size = W * H * 4;
  return Array.from({ length: Math.floor(r.stdout.length / size) }, (_, i) => Buffer.from(r.stdout.subarray(i * size, (i + 1) * size)));
}

/** The keyer, its colour the median of the screen's middle in frame 0. */
function padKeyer(first) {
  const ChromaKey = loadChromaKey();
  const ck = new ChromaKey();
  const rs = [], gs = [], bs = [];
  for (let y = H * 0.35 | 0; y < H * 0.65; y += 3) for (let x = W * 0.35 | 0; x < W * 0.65; x += 3) {
    const i = (y * W + x) * 4; rs.push(first[i]); gs.push(first[i + 1]); bs.push(first[i + 2]);
  }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  const key = [med(rs), med(gs), med(bs)];
  ck.setKeyColor(...key);
  // The studio's calibration, on the screen instead of the border: clear the screen's noise...
  const d = [];
  for (let y = H * 0.2 | 0; y < H * 0.8; y += 4) for (let x = W * 0.2 | 0; x < W * 0.8; x += 4) {
    const i = (y * W + x) * 4; d.push(ck._getChromaDist(first[i], first[i + 1], first[i + 2]));
  }
  d.sort((p, q) => p - q);
  const noise = d[Math.floor(d.length * 0.98)];
  // ...and stay under the black bezel and sleeves (every colourless pixel sits at the key's own UV length).
  const neutral = ck._getChromaDist(128, 128, 128);
  ck.similarity = Math.max(0.2, Math.min(noise * 1.5 + 0.08, neutral - 0.07));
  ck.spillSuppression = 0.35;
  return { ck, key, similarity: Math.round(ck.similarity * 100) };
}

/** The biggest 4-connected patch of `mask` (Uint8Array W*H): its per-row and per-column extremes. */
function biggestPatch(mask) {
  const label = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  let best = null, n = 0;
  for (let p = 0; p < W * H; p++) {
    if (!mask[p] || label[p]) continue;
    n++;
    let sp = 0, count = 0;
    stack[sp++] = p; label[p] = n;
    while (sp) {
      const q = stack[--sp]; count++;
      const x = q % W, y = (q / W) | 0;
      if (x > 0 && mask[q - 1] && !label[q - 1]) { label[q - 1] = n; stack[sp++] = q - 1; }
      if (x < W - 1 && mask[q + 1] && !label[q + 1]) { label[q + 1] = n; stack[sp++] = q + 1; }
      if (y > 0 && mask[q - W] && !label[q - W]) { label[q - W] = n; stack[sp++] = q - W; }
      if (y < H - 1 && mask[q + W] && !label[q + W]) { label[q + W] = n; stack[sp++] = q + W; }
    }
    if (!best || count > best.count) best = { n, count };
  }
  if (!best || best.count < 1500) return null;
  const rowMin = new Int32Array(H).fill(-1), rowMax = new Int32Array(H).fill(-1);
  const colMin = new Int32Array(W).fill(-1), colMax = new Int32Array(W).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (label[y * W + x] !== best.n) continue;
    if (rowMin[y] < 0) rowMin[y] = x; rowMax[y] = x;
    if (colMin[x] < 0) colMin[x] = y; colMax[x] = y;
  }
  return { count: best.count, rowMin, rowMax, colMin, colMax };
}

function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cross(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * Fit v = a*u + b to [u, v] points, robustly: a finger over the edge pushes points INWARD
 * (`inward` = +1 when inward is larger v), so those are dropped round after round.
 */
function fitEdge(pts, inward) {
  let keep = pts;
  let a = 0, b = 0;
  for (let round = 0; round < 6 && keep.length >= 4; round++) {
    let su = 0, sv = 0, suu = 0, suv = 0;
    for (const [u, v] of keep) { su += u; sv += v; suu += u * u; suv += u * v; }
    const n = keep.length;
    const den = n * suu - su * su;
    a = den ? (n * suv - su * sv) / den : 0;
    b = (sv - a * su) / n;
    const res = keep.map(([u, v]) => (v - (a * u + b)) * inward);
    const sorted = res.map(Math.abs).sort((p, q) => p - q);
    const mad = Math.max(0.7, sorted[sorted.length >> 1] * 1.5);
    keep = keep.filter((_, i) => res[i] < 2.5 * mad && res[i] > -4 * mad);
  }
  return { a, b };
}

/** The four corners [TL, TR, BR, BL] of the screen in one frame, or null. */
function screenQuad(patch) {
  const { rowMin, rowMax, colMin, colMax } = patch;
  const outline = [];
  for (let y = 0; y < H; y++) if (rowMin[y] >= 0) outline.push([rowMin[y], y], [rowMax[y], y]);
  const hv = hull(outline);
  const ext = (f) => hv.reduce((m, p) => (f(p) > f(m) ? p : m), hv[0]);
  let TL = ext((p) => -p[0] - p[1]), BR = ext((p) => p[0] + p[1]);
  let TR = ext((p) => p[0] - p[1]), BL = ext((p) => -p[0] + p[1]);
  // Each edge fitted to the outline between its corners (a tenth trimmed at each end: the rounded corners).
  const span = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b), t = (hi - lo) * 0.12; return [Math.ceil(lo + t), Math.floor(hi - t)]; };
  const pts = (arr, [lo, hi]) => { const out = []; for (let u = Math.max(0, lo); u <= Math.min(arr.length - 1, hi); u++) if (arr[u] >= 0) out.push([u, arr[u]]); return out; };
  const top = pts(colMin, span(TL[0], TR[0])), bottom = pts(colMax, span(BL[0], BR[0]));
  const left = pts(rowMin, span(TL[1], BL[1])), right = pts(rowMax, span(TR[1], BR[1]));
  if ([top, bottom, left, right].some((p) => p.length < 8)) return [TL, TR, BR, BL];
  const T = fitEdge(top, +1), B = fitEdge(bottom, -1), L = fitEdge(left, +1), R = fitEdge(right, -1);
  // y = a x + b (top/bottom) meets x = c y + d (left/right).
  const meet = (h, v) => { const y = (h.a * v.b + h.b) / (1 - h.a * v.a); return [v.a * y + v.b, y]; };
  return [meet(T, L), meet(T, R), meet(B, R), meet(B, L)];
}

/** Median of three, then a [1 2 1] blur, over time, per coordinate (nulls left alone). */
function smooth(quads) {
  const get = (i, k) => quads[Math.max(0, Math.min(quads.length - 1, i))]?.[k >> 1]?.[k & 1];
  const med = quads.map((q, i) => q && q.map((_, c) => [0, 1].map((a) => {
    const vals = [get(i - 1, c * 2 + a), get(i, c * 2 + a), get(i + 1, c * 2 + a)].filter((v) => v != null).sort((x, y) => x - y);
    return vals[vals.length >> 1];
  })));
  const g = (i, c, a) => med[Math.max(0, Math.min(med.length - 1, i))]?.[c]?.[a];
  return med.map((q, i) => q && q.map((_, c) => [0, 1].map((a) => {
    const p = g(i - 1, c, a) ?? g(i, c, a), n = g(i + 1, c, a) ?? g(i, c, a);
    return (p + 2 * g(i, c, a) + n) / 4;
  })));
}

/** Homography taking the rectangle w x h to the quad [TL, TR, BR, BL] (Heckbert's square-to-quad). */
export function rectToQuad(w, h, q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  // Unit square -> quad, then scale the rectangle down to the unit square.
  return [a / w, b / h, c, d / w, e / h, f, g / w, hh / h, 1];
}
function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
function inQuad(q, x, y) {
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = q[k], [bx, by] = q[(k + 1) % 4];
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c < 0) return false; // clockwise in screen coordinates: inside is c >= 0
    s++;
  }
  return s === 4;
}
function grow(q, px) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  return q.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / l * px, y + (y - cy) / l * px]; });
}

/** A game picture warped into the quad under the keyed frame, the way the game draws it. */
function composite(frame, quad, pic) {
  const out = Buffer.from(frame);
  if (quad) {
    const inv = invert3(rectToQuad(pic.w, pic.h, grow(quad, 3)));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      const al = frame[p + 3] / 255;
      if (al >= 1) continue;
      const z = inv[6] * x + inv[7] * y + inv[8];
      const u = (inv[0] * x + inv[1] * y + inv[2]) / z, v = (inv[3] * x + inv[4] * y + inv[5]) / z;
      let r = 0, g = 0, b = 0;
      if (u >= 0 && v >= 0 && u < pic.w && v < pic.h) { const s = ((v | 0) * pic.w + (u | 0)) * 4; r = pic.data[s]; g = pic.data[s + 1]; b = pic.data[s + 2]; }
      out[p] = frame[p] * al + r * (1 - al); out[p + 1] = frame[p + 1] * al + g * (1 - al); out[p + 2] = frame[p + 2] * al + b * (1 - al);
      out[p + 3] = 255;
    }
  }
  for (let p = 3; p < out.length; p += 4) out[p] = 255;
  return out;
}
function drawQuad(buf, q, rgb = [255, 0, 255]) {
  if (!q) return;
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = q[k], [bx, by] = q[(k + 1) % 4];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let t = 0; t <= n; t++) for (let o = -1; o <= 1; o++) {
      const x = Math.round(ax + (bx - ax) * t / n) + o, y = Math.round(ay + (by - ay) * t / n);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      buf.set(rgb, (y * W + x) * 4);
    }
  }
}
function sheet(frames, cols, tw, th) {
  const rows = Math.ceil(frames.length / cols);
  const img = { w: cols * tw, h: rows * th, data: Buffer.alloc(cols * tw * rows * th * 4) };
  frames.forEach((f, i) => {
    const t = resize({ w: W, h: H, data: f }, tw, th);
    const ox = (i % cols) * tw, oy = Math.floor(i / cols) * th;
    for (let y = 0; y < th; y++) t.data.copy(img.data, ((oy + y) * img.w + ox) * 4, y * tw * 4, (y + 1) * tw * 4);
  });
  return img;
}

function bakeOne({ id, file }, pic) {
  const frames = decode(file);
  const { ck, key, similarity } = padKeyer(frames[0]);
  const raw = [];
  const quads = [];
  const keyed = [];
  for (const f of frames) {
    const k = { w: W, h: H, data: Buffer.from(f) };
    studioKey(ck, k);
    const mask = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) mask[p] = k.data[p * 4 + 3] < 128 ? 1 : 0;
    const patch = biggestPatch(mask);
    raw.push(patch && patch.count > W * H * 0.004 ? screenQuad(patch) : null);
    keyed.push(k.data);
  }
  quads.push(...smooth(raw));
  // The key only inside the screen (grown a few pixels for its soft edge); everything else as it was.
  const out = frames.map((f, i) => {
    const o = Buffer.from(f);
    for (let p = 3; p < o.length; p += 4) o[p] = 255;
    const q = quads[i];
    if (!q) return o;
    const g = grow(q, 5);
    const xs = g.map((p) => p[0]), ys = g.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(W - 1, Math.ceil(Math.max(...xs))); x++) {
        if (!inQuad(g, x + 0.5, y + 0.5)) continue;
        const p = (y * W + x) * 4;
        keyed[i].copy(o, p, p, p + 4);
      }
    }
    return o;
  });

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(LOOK, { recursive: true });
  const rawFile = path.join(os.tmpdir(), `broodfall-pad-${id}.rgba`);
  fs.writeFileSync(rawFile, Buffer.concat(out));
  const webm = path.join(OUT, `${id}.webm`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', rawFile,
    '-c:v', 'libvpx', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '6000k', '-crf', '8', '-qmin', '2', '-qmax', '30', '-g', String(FPS), '-an', webm], { maxBuffer: MAX });
  fs.rmSync(rawFile, { force: true });
  if (r.status !== 0) throw new Error(`${id}: encode failed: ${String(r.stderr).slice(-300)}`);
  const round = (v) => Math.round(v * 10) / 10;
  const json = { id, fps: FPS, w: W, h: H, frames: out.length, seconds: Number((out.length / FPS).toFixed(2)), key, similarity,
    quads: quads.map((q) => (q ? q.flat().map(round) : null)) };
  fs.writeFileSync(path.join(OUT, `${id}.json`), `${JSON.stringify(json)}\n`);

  // To look at: eight frames with a real game picture in the screen, and the tracked edges.
  const picks = Array.from({ length: 8 }, (_, k) => Math.round(k * (out.length - 1) / 7));
  writeJpg(path.join(LOOK, `${id}.jpg`), sheet(picks.map((i) => composite(out[i], quads[i], pic)), 4, 480, 270));
  writeJpg(path.join(LOOK, `${id}-track.jpg`), sheet(picks.map((i) => { const b = Buffer.from(frames[i]); drawQuad(b, raw[i], [255, 255, 0]); drawQuad(b, quads[i]); return b; }), 4, 480, 270));
  const missing = quads.filter((q) => !q).length;
  console.log(`[pad] ${id}: ${out.length} frames, key ${key.join(',')} at ${similarity}%, screen found in ${out.length - missing}/${out.length}, ${Math.round(fs.statSync(webm).size / 1024)} KB`);
  return json;
}

export function bakePad(clips) {
  const pic = readImage(REVIEW_PICTURE, { w: 1280, h: 720 });
  const done = clips.map((c) => bakeOne(c, pic));
  const manifest = { version: 1, clips: Object.fromEntries(done.map((j) => [j.id, { video: `${j.id}.webm`, quads: `${j.id}.json`, seconds: j.seconds, fps: j.fps, w: j.w, h: j.h }])) };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  return done;
}
