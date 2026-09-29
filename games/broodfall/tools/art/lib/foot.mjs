/**
 * WHERE A THING STANDS. A limb, or the landing site, is a picture of something standing on
 * the ground, seen from 45 degrees above. The game puts ONE point of that picture on the
 * middle of a cell. That point has to be the middle of what the thing stands ON (the middle
 * of its skirt of roots), not its lowest pixel.
 *
 * Collins, Sep 29 2026: "the way they sit is not working, especially when they are on the
 * side closer to the viewer of a lane … the placement of the central body just makes it
 * look like it's floating." They were anchored by the front tip of their skirt, so every
 * one of them stood on the back half of its cell and hung over whatever was behind it.
 *
 * A round skirt lying on the ground is seen as an ellipse as wide as it is, and
 * TILE_H / TILE_W as deep. Its front half is the one part of the picture that nothing
 * stands in front of, so the ellipse is fitted to that: to the rows just above its front tip.
 */
import { TILE_H, TILE_W } from './iso.mjs';

/** Depth of a circle on the ground, as a share of its width on the screen. */
export const FLAT = TILE_H / TILE_W;
const SOLID = 128;

/** The first and last solid pixel of a row, or null. */
function extent(img, y, x0, x1) {
  let a = -1, b = -1;
  for (let x = x0; x < x1; x++) if (img.data[(y * img.w + x) * 4 + 3] > SOLID) { if (a < 0) a = x; b = x; }
  return a < 0 ? null : [a, b + 1];
}

const median = (list) => { const s = [...list].sort((p, q) => p - q); return s[s.length >> 1]; };

/**
 * The footing of something that stands on a round skirt.
 * @returns { x, y, a, b, feet } the middle of its footprint, its half-width and half-depth,
 *          and the row of its front tip; `fitted` false when the front of it is no ellipse
 *          and the answer is a plain guess from its width.
 */
export function discFooting(img, box) {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  // The front tip: the lowest row that is more than a stray root wide.
  let feet = box.y1 - 1;
  for (let y = box.y1 - 1; y > box.y0; y--) {
    const e = extent(img, y, box.x0, box.x1);
    if (e && e[1] - e[0] >= 0.1 * w) { feet = y; break; }
  }
  const fits = [];
  const mids = [];
  const from = Math.max(3, Math.round(0.02 * h));
  const to = Math.max(from + 6, Math.round(0.14 * Math.max(w * FLAT, h * 0.5)));
  for (let t = from; t <= to; t++) {
    const e = extent(img, feet - t, box.x0, box.x1);
    if (!e) continue;
    const half = (e[1] - e[0]) / 2;
    // half^2 = (2 / FLAT) a t - t^2 / FLAT^2, for a row t above the front tip of the ellipse.
    fits.push((FLAT * (half * half + (t * t) / (FLAT * FLAT))) / (2 * t));
    mids.push((e[0] + e[1]) / 2);
  }
  let a = fits.length ? median(fits) : 0;
  let x = mids.length ? median(mids) : (box.x0 + box.x1) / 2;
  const fitted = a >= 0.22 * w && a <= 0.56 * w;
  if (!fitted) {
    a = 0.45 * w;
    x = (box.x0 + box.x1) / 2;
  }
  // The middle of a footprint is never outside the thing that stands on it.
  x = Math.max(box.x0 + a * 0.6, Math.min(box.x1 - a * 0.6, x));
  return { x, y: feet - a * FLAT, a, b: a * FLAT, feet, fitted };
}

/**
 * The footing of something long that lies along the street (a wall of spines): the middle
 * of the line it lies on.
 */
export function lineFooting(img, box) {
  const lows = [];
  for (let x = box.x0; x < box.x1; x++) {
    for (let y = box.y1 - 1; y >= box.y0; y--) {
      if (img.data[(y * img.w + x) * 4 + 3] > SOLID) { lows.push(y); break; }
    }
  }
  const n = lows.length;
  const left = median(lows.slice(Math.floor(n * 0.08), Math.floor(n * 0.25)));
  const right = median(lows.slice(Math.floor(n * 0.75), Math.floor(n * 0.92)));
  const a = (box.x1 - box.x0) / 2;
  // Its roots reach a little in front of the line its body lies on.
  const y = (left + right) / 2 - 0.04 * (box.y1 - box.y0);
  return { x: (box.x0 + box.x1) / 2, y, a, b: a * FLAT, feet: box.y1 - 1, fitted: true };
}

/**
 * How much of a picture lies in front of the cell it stands in: solid pixels below the two
 * front edges of the cell's diamond, as a share of all its solid pixels. `cx, cy` is the
 * middle of the cell in the picture and `half` the cell's half-width there.
 */
export function spill(img, cx, cy, half) {
  let out = 0, all = 0;
  const deep = half * FLAT;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] <= SOLID) continue;
    all++;
    if (y > cy && Math.abs(x - cx) / half + (y - cy) / deep > 1) out++;
  }
  return all ? out / all : 0;
}

/** The outline of a cell, drawn on a picture for a person to look at. */
export function drawCell(img, cx, cy, half, rgb = [255, 255, 255], alpha = 0.55) {
  const deep = half * FLAT;
  for (let y = Math.max(0, Math.floor(cy - deep)); y <= Math.min(img.h - 1, Math.ceil(cy + deep)); y++) {
    for (let x = Math.max(0, Math.floor(cx - half)); x <= Math.min(img.w - 1, Math.ceil(cx + half)); x++) {
      const d = Math.abs(x - cx) / half + Math.abs(y - cy) / deep;
      if (d > 1 || d < 1 - 2.2 / deep) continue;
      const i = (y * img.w + x) * 4;
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.round(img.data[i + k] * (1 - alpha) + rgb[k] * alpha);
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/**
 * How much of its cell's width the footprint of a limb fills. The same number as LIMB_FILL
 * in src/render/isoRender.ts. At 0.75 the solid skirt lies inside the cell and the thin
 * tips of its roots reach a little over the edge.
 */
export const FILL = 0.64;

/**
 * The footing of a limb in one frame: its MARK if it has one (tools/art/limbs.mjs, foot and
 * backFoot), else the computer's guess. A flat limb (a pool lying in the street) stands on
 * all of itself.
 */
export function footingOf(l, frame, box, view = 'front') {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  if (l.flat) return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, a: w / 2, b: h / 2, marked: true };
  const mark = view === 'back' ? l.backFoot : l.foot;
  if (mark) {
    const a = (mark[2] * w) / 2;
    return { x: box.x0 + mark[0] * w, y: box.y0 + mark[1] * h, a, b: a * FLAT, marked: true };
  }
  const guess = l.on === 'street' ? lineFooting(frame, box) : discFooting(frame, box);
  return { ...guess, marked: false };
}

/** The mark that says what a footing says, to write into limbs.mjs. */
export const markOf = (f, box) => [
  Number(((f.x - box.x0) / (box.x1 - box.x0)).toFixed(2)),
  Number(((f.y - box.y0) / (box.y1 - box.y0)).toFixed(2)),
  Number(((2 * f.a) / (box.x1 - box.x0)).toFixed(2)),
];

/**
 * THE SOLID SKIRT, measured (Sep 29 2026: marks placed by eye on small tiles were off, and
 * Collins saw it: "whatever you used to draw the center and the base … did a terrible job").
 * The thin tips of the roots are taken off first (an opening: every solid pixel with less
 * than `r` pixels of solid round it goes, then what is left grows back by `r`), so what
 * remains is the mound and the solid part of its skirt. The skirt is the widest row of that
 * in the lower half: its middle is where the limb stands, its width how wide it stands.
 * Returns { x, y, a, b, x0, x1, top, bottom } in the frame's pixels.
 */
export function solidSkirt(img, box, share = 0.035, low = 0.38) {
  const w = img.w, h = img.h;
  const r = Math.max(2, Math.round(share * (box.x1 - box.x0)));
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = img.data[i * 4 + 3] > SOLID ? 1 : 0;
  // A square of side 2r+1 by two passes (rows, then columns): min for erosion, max for dilation.
  const pass = (src, horizontal, keep) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = keep ? 1 : 0;
      for (let d = -r; d <= r; d++) {
        const xx = horizontal ? x + d : x, yy = horizontal ? y : y + d;
        const s = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src[yy * w + xx];
        if (keep ? !s : s) { v = keep ? 0 : 1; break; }
      }
      out[y * w + x] = v;
    }
    return out;
  };
  const eroded = pass(pass(solid, true, true), false, true);
  const opened = pass(pass(eroded, true, false), false, false);
  // The skirt is at the BOTTOM of the mound: a limb whose head is wider than its foot (a horn,
  // a disc, twin glands) must not be measured by its head. Only the lowest part is looked at.
  const rows = [];
  for (let y = box.y0; y < box.y1; y++) {
    let a = -1, b = -1;
    for (let x = box.x0; x < box.x1; x++) if (opened[y * w + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) rows.push({ y, a, b });
  }
  if (!rows.length) return null;
  const top = rows[0].y, bottom = rows[rows.length - 1].y;
  const from = bottom - (bottom - top) * low;
  let best = null;
  for (const r of rows) if (r.y >= from && (!best || r.b - r.a >= best.b - best.a)) best = r;
  if (!best) return null;
  const x = (best.a + best.b + 1) / 2;
  const a = (best.b + 1 - best.a) / 2;
  return { x, y: best.y, a, b: a * FLAT, x0: best.a, x1: best.b + 1, top, bottom };
}

/** An ellipse outline drawn on a picture (the skirt as measured), for a person to look at. */
export function drawEllipse(img, cx, cy, a, b, rgb = [0, 255, 255], alpha = 0.9) {
  const n = Math.ceil(2 * Math.PI * Math.max(a, b));
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const x = Math.round(cx + a * Math.cos(t)), y = Math.round(cy + b * Math.sin(t));
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
      const px = x + dx, py = y + dy;
      if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
      const p = (py * img.w + px) * 4;
      for (let k = 0; k < 3; k++) img.data[p + k] = Math.round(img.data[p + k] * (1 - alpha) + rgb[k] * alpha);
      img.data[p + 3] = 255;
    }
  }
  return img;
}
