/**
 * The keyer: cuts a subject off a flat colour background (any colour), removes the tint
 * the background leaves on its edges, and finds where a clip loops.
 *
 * Why our own and not ffmpeg's chromakey: the video model repaints the background a
 * darker shade than the still's, so the key colour is SAMPLED from each clip; and
 * ffmpeg's despill only knows green and blue, while teal and green units need magenta.
 */
import { bbox, borderColour } from './img.mjs';

/**
 * How key-coloured a pixel is, 0 (not at all) to about 1 (the background itself).
 * Colour is measured with the grey taken out, along the key's own direction, so a darker
 * background (a shadow on it) still counts; colour ACROSS that direction counts against.
 */
function keyness(r, g, b, k) {
  const m = (r + g + b) / 3;
  const pr = r - m, pg = g - m, pb = b - m;
  const along = (pr * k.r + pg * k.g + pb * k.b) / k.len2;
  const or = pr - along * k.r, og = pg - along * k.g, ob = pb - along * k.b;
  const across = Math.sqrt(or * or + og * og + ob * ob) / k.len;
  return { along, score: along - 0.5 * across };
}

export function keyOf(rgb) {
  const m = (rgb[0] + rgb[1] + rgb[2]) / 3;
  const r = rgb[0] - m, g = rgb[1] - m, b = rgb[2] - m;
  const len2 = r * r + g * g + b * b;
  if (len2 < 900) throw new Error(`background colour ${rgb} is too grey to key on`);
  return { r, g, b, len2, len: Math.sqrt(len2), rgb };
}

/**
 * Key one RGBA frame in place. `lo`..`hi` is the band of key-ness over which a pixel goes
 * from solid to gone. Returns the fraction of the frame that is solid.
 *
 * spill: where the background's tint is taken out of what is left.
 *   'all'  everywhere (a clip: the video model lights the subject with its background).
 *   'edge' only within `reach` pixels of the background (a still of painted things: its
 *          tint is only the blend along its outline, and taking magenta out of a red
 *          tractor everywhere leaves a tan one).
 */
export function keyFrame(img, key, { lo = 0.12, hi = 0.34, spill = 'all', reach = 3 } = {}) {
  const d = img.data;
  const n = d.length / 4;
  const alongs = new Float32Array(n);
  const alphas = new Float32Array(n);
  let solid = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const { along, score } = keyness(d[i], d[i + 1], d[i + 2], key);
    const t = Math.max(0, Math.min(1, (score - lo) / (hi - lo)));
    alongs[p] = along;
    alphas[p] = 1 - t * t * (3 - 2 * t);
    if (alphas[p] > 0.5) solid++;
  }
  // How near the background each pixel is: 1 beside it, 0 from `reach` pixels in.
  let near = null;
  if (spill === 'edge') {
    near = new Float32Array(n);
    const { w, h } = img;
    const dist = new Uint8Array(n).fill(255);
    let front = [];
    for (let p = 0; p < n; p++) if (alphas[p] < 0.5) { dist[p] = 0; front.push(p); }
    for (let step = 1; step <= reach && front.length; step++) {
      const next = [];
      for (const p of front) {
        const x = p % w, y = (p - x) / w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
          if (q >= 0 && dist[q] === 255) { dist[q] = step; next.push(q); }
        }
      }
      front = next;
    }
    for (let p = 0; p < n; p++) near[p] = dist[p] === 255 ? 0 : 1 - Math.max(0, dist[p] - 1) / reach;
  }
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const a = alphas[p];
    const k = alongs[p] * (near ? Math.max(near[p], 1 - a) : 1);
    if (a > 0 && k > 0) {
      // Take the background's tint out of what is left.
      d[i] = Math.max(0, Math.min(255, d[i] - k * key.r));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] - k * key.g));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] - k * key.b));
    }
    d[i + 3] = Math.round(a * 255);
  }
  return solid / n;
}

/** Key every frame of a clip, sampling the background colour from the clip itself. */
export function keyClip(clip, opts) {
  const key = keyOf(borderColour({ w: clip.w, h: clip.h, data: clip.frames[Math.min(2, clip.frames.length - 1)] }));
  const frames = clip.frames.map((f) => {
    const img = { w: clip.w, h: clip.h, data: Buffer.from(f) };
    keyFrame(img, key, opts);
    return img;
  });
  return { w: clip.w, h: clip.h, frames, key: key.rgb };
}

/** The box that holds the subject in every frame. */
export function unionBox(frames) {
  let u = null;
  for (const f of frames) {
    const b = bbox(f);
    if (!b) continue;
    u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : b;
  }
  return u;
}

/** A small grey thumbnail of a keyed frame over black, for comparing frames. */
function thumb(img, s = 48) {
  const out = new Float32Array(s * s);
  const fx = img.w / s, fy = img.h / s;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    let sum = 0, n = 0;
    for (let sy = Math.floor(y * fy); sy < Math.floor((y + 1) * fy); sy += 2) {
      for (let sx = Math.floor(x * fx); sx < Math.floor((x + 1) * fx); sx += 2) {
        const i = (sy * img.w + sx) * 4;
        sum += ((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3) * (img.data[i + 3] / 255);
        n++;
      }
    }
    out[y * s + x] = n ? sum / n : 0;
  }
  return out;
}

const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length; };

/**
 * Where to cut a loop: the two frames that look most alike, at least `min` frames apart.
 * The loop is frames [start, end): frame `end` looks like frame `start`.
 */
export function loopWindow(frames, { min = 10, max = 40 } = {}) {
  const t = frames.map((f) => thumb(f));
  let best = { start: 0, end: Math.min(frames.length - 1, min), seam: Infinity };
  for (let i = 0; i < t.length; i++) {
    for (let j = i + min; j < t.length && j - i <= max; j++) {
      const d = diff(t[i], t[j]);
      // Between two cuts that are about equally clean, take the longer loop.
      if (d < best.seam - 0.15 || (Math.abs(d - best.seam) <= 0.15 && j - i > best.end - best.start)) best = { start: i, end: j, seam: d };
    }
  }
  // How much the picture moves from one frame to the next inside the loop: a clip that
  // barely moves "loops" anywhere and is not an animation.
  let motion = 0;
  for (let i = best.start; i < best.end; i++) motion += diff(t[i], t[i + 1]);
  return { ...best, motion: motion / Math.max(1, best.end - best.start) };
}

/** Pick `count` frames evenly from a list. */
export function pick(frames, count) {
  if (frames.length <= count) return frames.slice();
  return Array.from({ length: count }, (_, i) => frames[Math.floor((i * frames.length) / count)]);
}

/** Fraction of the subject's outline that is still tinted like the background. */
export function fringe(img, key) {
  let edge = 0, bad = 0;
  const d = img.data;
  for (let y = 1; y < img.h - 1; y++) for (let x = 1; x < img.w - 1; x++) {
    const i = (y * img.w + x) * 4;
    if (d[i + 3] < 128) continue;
    const open = d[i + 3 - 4] < 128 || d[i + 3 + 4] < 128 || d[i + 3 - img.w * 4] < 128 || d[i + 3 + img.w * 4] < 128;
    if (!open) continue;
    edge++;
    if (keyness(d[i], d[i + 1], d[i + 2], key).score > 0.08) bad++;
  }
  return edge ? bad / edge : 0;
}

/**
 * Takes the specks off a keyed frame: whatever is not joined to the body and is smaller
 * than `share` of it (a drop the video model threw across the picture, a fleck of the
 * background that did not key). The body itself, and any part nearly as big, is kept.
 */
export function dropSpecks(img, share = 0.03) {
  const G = 4;
  const gw = Math.ceil(img.w / G);
  const gh = Math.ceil(img.h / G);
  const solid = new Uint8Array(gw * gh);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > 96) solid[Math.floor(y / G) * gw + Math.floor(x / G)] = 1;
  }
  const label = new Int32Array(gw * gh).fill(-1);
  const sizes = [];
  for (let s = 0; s < solid.length; s++) {
    if (!solid[s] || label[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const c = stack.pop();
      n++;
      const cx = c % gw, cy = (c - cx) / gw;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const o = y * gw + x;
        if (solid[o] && label[o] < 0) { label[o] = id; stack.push(o); }
      }
    }
    sizes.push(n);
  }
  if (sizes.length < 2) return 0;
  const most = Math.max(...sizes);
  let gone = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const id = label[Math.floor(y / G) * gw + Math.floor(x / G)];
    if (id >= 0 && sizes[id] < most * share) {
      const i = (y * img.w + x) * 4 + 3;
      if (img.data[i]) { img.data[i] = 0; gone++; }
    }
  }
  return gone;
}

/** For tools that compare frames (tools/art/templates/unit.mjs motionWindow). */
export { thumb, diff as diffThumb };
