/**
 * THE DATA PAD'S SHAKE, MEASURED (Collins, Oct 2 2026: "the image on the screen shakes a bit in a way that breaks
 * the effect as it's being set down").
 *
 * For each baked clip (public/art/pad/<id>.webm with its alpha, and <id>.json's corners): in every frame, where the
 * keyed screen's edges REALLY are (the transparent patch's boundary, measured along each edge at 9 sample lines with
 * sub-pixel interpolation of the alpha) against where the baked corners put them. The residual is how far the warped
 * page would sit off the hole in the clip in that frame, so its frame-to-frame change is the shake against the bezel.
 *
 *   node tools/measure/pad-jitter.mjs [won lost] [--json out.json]
 *
 * Prints, per clip: the edge residual (RMS and worst, px), its frame-to-frame change (RMS, px: the visible shake),
 * and the corners' second difference (RMS, px/frame^2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAD = path.join(ROOT, 'public', 'art', 'pad');
const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--') && !a.endsWith('.json'));
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

/** Every frame's alpha plane (Uint8Array w*h) of a VP8/VP9 webm with alpha. */
export function alphaFrames(file, w, h) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 4 * 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-300));
  const size = w * h * 4;
  const n = Math.floor(r.stdout.length / size);
  return Array.from({ length: n }, (_, i) => {
    const a = new Uint8Array(w * h);
    const base = i * size;
    for (let p = 0; p < w * h; p++) a[p] = r.stdout[base + p * 4 + 3];
    return a;
  });
}

/** Where along the ray from (x0,y0) stepping (dx,dy) the alpha first rises through 128 (sub-pixel), within `len`. */
function crossing(alpha, w, h, x0, y0, dx, dy, len) {
  const at = (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 255;
    return alpha[yi * w + xi];
  };
  let prev = at(x0, y0);
  for (let s = 1; s <= len; s++) {
    const cur = at(x0 + dx * s, y0 + dy * s);
    if (prev < 128 && cur >= 128) return s - 1 + (128 - prev) / Math.max(1, cur - prev);
    prev = cur;
  }
  return null;
}

/**
 * The signed residual of each edge in one frame: from points inside the quad near each edge, walk outward along the
 * edge's normal to where the screen's transparency ends, and compare with the edge line. Returns [top,right,bottom,left]
 * mean residuals (px; + = the real edge lies outside the baked edge) or null.
 */
export function edgeResiduals(alpha, w, h, q) {
  const P = [[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]];
  const out = [];
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = P[k], [bx, by] = P[(k + 1) % 4];
    const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey);
    // Outward normal (corners clockwise in screen space: outward is to the left of travel).
    const nx = ey / L, ny = -ex / L;
    const res = [];
    for (let t = 0.15; t <= 0.851; t += 0.0875) {
      const px = ax + ex * t, py = ay + ey * t;
      // Start 12 px inside, walk out up to 30 px.
      const s = crossing(alpha, w, h, px - nx * 12, py - ny * 12, nx, ny, 30);
      if (s != null) res.push(s - 12);
    }
    if (res.length < 4) return null;
    res.sort((a, b) => a - b);
    out.push(res[res.length >> 1]);
  }
  return out;
}

const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length));

export function measure(id) {
  const j = JSON.parse(fs.readFileSync(path.join(PAD, `${id}.json`), 'utf8'));
  const alphas = alphaFrames(path.join(PAD, `${id}.webm`), j.w, j.h);
  const resid = alphas.map((a, i) => (j.quads[i] ? edgeResiduals(a, j.w, j.h, j.quads[i]) : null));
  const flat = resid.flatMap((r) => r ?? []);
  const shake = [];
  for (let i = 1; i < resid.length; i++) if (resid[i] && resid[i - 1]) for (let k = 0; k < 4; k++) shake.push(resid[i][k] - resid[i - 1][k]);
  const d2 = [];
  for (let i = 1; i + 1 < j.quads.length; i++) {
    const a = j.quads[i - 1], b = j.quads[i], c = j.quads[i + 1];
    if (a && b && c) for (let k = 0; k < 8; k++) d2.push(a[k] - 2 * b[k] + c[k]);
  }
  return {
    id, frames: alphas.length,
    residualRms: +rms(flat).toFixed(2), residualMax: +Math.max(...flat.map(Math.abs)).toFixed(2),
    shakeRms: +rms(shake).toFixed(2), shakeMax: +Math.max(...shake.map(Math.abs)).toFixed(2),
    cornerD2Rms: +rms(d2).toFixed(2),
    perFrame: resid.map((r) => r && r.map((v) => +v.toFixed(2))),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const all = (ids.length ? ids : ['won', 'lost']).map(measure);
  for (const m of all) console.log(`${m.id}: ${m.frames} frames · edge residual RMS ${m.residualRms} px (worst ${m.residualMax}) · shake (residual change per frame) RMS ${m.shakeRms} px (worst ${m.shakeMax}) · corner 2nd difference RMS ${m.cornerD2Rms}`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
}
