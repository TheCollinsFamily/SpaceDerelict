/**
 * The board's isometric geometry, shared by the art pipeline and (as the same numbers in
 * src/render/iso.ts) by the game. Sizes are in art pixels: the scale art is made at.
 *
 * A cell is a diamond TILE_W wide and TILE_H tall. World x runs down-right on screen and
 * world y runs down-left, so the two faces of a block that the camera sees are its south
 * face (on the left) and its east face (on the right).
 */
export const TILE_W = 128;
export const TILE_H = 76;
/** Screen height of one level of a block. */
export const LEVEL_H = 30;
/** How many cells one wall texture spans before it repeats (mirrored). */
export const WALL_SPAN = 4;
export const A = TILE_W / 2;
export const B = TILE_H / 2;
/** How far a floor tile is drawn past its own edge, in cells: about one pixel. */
export const BLEED = 0.014;

/** Bilinear sample of an RGBA image at (x, y) in pixels; clamps at the edges. */
export function sample(img, x, y) {
  const fx = Math.max(0, Math.min(img.w - 1.001, x - 0.5));
  const fy = Math.max(0, Math.min(img.h - 1.001, y - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const out = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const p = (dx, dy) => img.data[((y0 + dy) * img.w + x0 + dx) * 4 + k];
    out[k] = (p(0, 0) * (1 - tx) + p(1, 0) * tx) * (1 - ty) + (p(0, 1) * (1 - tx) + p(1, 1) * tx) * ty;
  }
  return out;
}

/**
 * Draws a picture by asking, for every point of it, what colour belongs there.
 * `at(x, y)` gets a point in picture pixels and returns [r, g, b, a] (a in 0..255) or null
 * for nothing. Each pixel is asked at 9 points, which gives clean edges.
 */
export function render(w, h, at) {
  const data = Buffer.alloc(w * h * 4);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
      const c = at(px + (sx + 0.5) / 3, py + (sy + 0.5) / 3);
      if (!c) continue;
      const ca = c[3] / 255;
      r += c[0] * ca; g += c[1] * ca; b += c[2] * ca; a += ca;
    }
    const o = (py * w + px) * 4;
    if (a > 0) { data[o] = Math.round(r / a); data[o + 1] = Math.round(g / a); data[o + 2] = Math.round(b / a); }
    data[o + 3] = Math.round((a / 9) * 255);
  }
  return { w, h, data };
}

/**
 * A point of a floor diamond (picture TILE_W x TILE_H) back to its place in the cell, 0..1 each way.
 * bleed: how far past its own edge a tile is drawn, in cells. Two tiles that each stop exactly at
 * their shared edge are each half there along it, and the dark ground shows through as a hairline.
 */
export function floorPoint(px, py, bleed = 0) {
  const sx = px - A;
  const x = (py / B + sx / A) / 2;
  const y = (py / B - sx / A) / 2;
  return x >= -bleed && y >= -bleed && x < 1 + bleed && y < 1 + bleed ? { x, y } : null;
}

/**
 * A point of a wall face (picture A wide, B + LEVEL_H tall) back to its place on the wall:
 * t along it left to right on screen, v from the top of the level down. `side`: 'south'
 * (the left face, which falls to the right) or 'east' (the right face, which rises to the right).
 */
export function wallPoint(px, py, side) {
  const t = px / A;
  const top = side === 'south' ? B * t : B * (1 - t);
  const v = (py - top) / LEVEL_H;
  return t >= 0 && t < 1 && v >= 0 && v < 1 ? { t, v } : null;
}

/**
 * Which part of a texture a cell shows. The texture covers `n` cells; cells beyond that see
 * it mirrored, then the right way round again, so neighbours always meet along a matching edge.
 * Returns 0..1 across the whole texture for a place `f` (0..1) inside cell number `i`.
 */
export function mirrorTile(i, f, n = 2) {
  const p = ((i % (2 * n)) + 2 * n) % (2 * n);
  return p < n ? (p + f) / n : (2 * n - p - f) / n;
}

/** A steady pseudo-random number in 0..1 from two whole numbers. */
export function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth lumpy noise in 0..1, period `n` cells, for ragged edges. */
export function noise(x, y, n = 4) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const s = (t) => t * t * (3 - 2 * t);
  const h = (i, j) => hash(((i % n) + n) % n, ((j % n) + n) % n);
  return (h(x0, y0) * (1 - s(tx)) + h(x0 + 1, y0) * s(tx)) * (1 - s(ty)) + (h(x0, y0 + 1) * (1 - s(tx)) + h(x0 + 1, y0 + 1) * s(tx)) * s(ty);
}
