/**
 * Cuts a design sheet (several figures on one flat background) into its figures.
 *
 * The number of figures is known. Every blob on the sheet is found; the biggest ones are
 * the figures, and each smaller blob (a pennant, a puff of smoke, a crewman beside his
 * cannon) joins the figure nearest to it. Figures come back in reading order.
 */
import { borderColour, crop } from './img.mjs';

const GRID = 4;

const gap = (a, b) => {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
};

/**
 * @param img the sheet
 * @param expect how many figures the sheet holds
 * @returns { bg, boxes: [{ id, x0, y0, x1, y1 }], label, gw }
 */
export function findFigures(img, { expect, tolerance = 34, minArea = 0.0004 } = {}) {
  const bg = borderColour(img);
  const bgLum = (bg[0] + bg[1] + bg[2]) / 3;
  const bgGrey = Math.max(...bg) - Math.min(...bg) < 24;
  const gw = Math.ceil(img.w / GRID);
  const gh = Math.ceil(img.h / GRID);
  const mask = new Uint8Array(gw * gh);
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) {
    const i = (y * img.w + x) * 4;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const d = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    if (d <= tolerance * 3) continue;
    // On a grey sheet the soft shadow under a figure is grey too, only darker: not part of it.
    const lum = (r + g + b) / 3;
    if (bgGrey && Math.max(r, g, b) - Math.min(r, g, b) < 16 && lum > 70 && lum < bgLum + 25) continue;
    mask[Math.floor(y / GRID) * gw + Math.floor(x / GRID)] = 1;
  }
  const label = new Int32Array(gw * gh).fill(-1);
  const blobs = [];
  for (let s = 0; s < gw * gh; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = blobs.length;
    const box = { id, x0: gw, y0: gh, x1: 0, y1: 0, cells: 0 };
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % gw, cy = Math.floor(c / gw);
      box.cells++;
      if (cx < box.x0) box.x0 = cx; if (cx + 1 > box.x1) box.x1 = cx + 1;
      if (cy < box.y0) box.y0 = cy; if (cy + 1 > box.y1) box.y1 = cy + 1;
      // Eight neighbours: a thin diagonal line (an antenna) stays one blob.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (label[n] >= 0 || !mask[n]) continue;
        label[n] = id;
        stack.push(n);
      }
    }
    blobs.push(box);
  }
  const real = blobs.filter((b) => b.cells * GRID * GRID > minArea * img.w * img.h);
  const seeds = real.slice().sort((a, b) => b.cells - a.cells).slice(0, expect ?? real.length);
  const group = new Int32Array(blobs.length).fill(-1);
  seeds.forEach((s, i) => { group[s.id] = i; });
  const boxes = seeds.map((s, i) => ({ id: i, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }));
  // Biggest leftovers first, each to the figure it is nearest to (as that figure stands so far).
  for (const b of real.filter((r) => group[r.id] < 0).sort((a, c) => c.cells - a.cells)) {
    let best = 0;
    for (let i = 1; i < boxes.length; i++) if (gap(b, boxes[i]) < gap(b, boxes[best])) best = i;
    group[b.id] = best;
    const t = boxes[best];
    t.x0 = Math.min(t.x0, b.x0); t.y0 = Math.min(t.y0, b.y0); t.x1 = Math.max(t.x1, b.x1); t.y1 = Math.max(t.y1, b.y1);
  }
  for (let i = 0; i < label.length; i++) if (label[i] >= 0) label[i] = group[label[i]];
  const px = boxes.map((b) => ({ id: b.id, x0: b.x0 * GRID, y0: b.y0 * GRID, x1: Math.min(img.w, b.x1 * GRID), y1: Math.min(img.h, b.y1 * GRID) }));
  // Reading order: rows first (figures whose middles are within half a figure's height), then left to right.
  px.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const rows = [];
  for (const b of px) {
    const mid = (b.y0 + b.y1) / 2;
    const row = rows.find((rw) => Math.abs(rw.mid - mid) < (b.y1 - b.y0) * 0.5);
    if (row) { row.items.push(b); row.mid = (row.mid * (row.items.length - 1) + mid) / row.items.length; } else rows.push({ mid, items: [b] });
  }
  rows.sort((a, b) => a.mid - b.mid);
  return { bg, boxes: rows.flatMap((rw) => rw.items.sort((a, b) => a.x0 - b.x0)), label, gw };
}

/**
 * One figure as a square picture on the sheet's own background, with a margin round it.
 * Anything in the square that belongs to a neighbouring figure is painted out.
 * `side`: the square's size in sheet pixels, when several figures must share one scale.
 */
export function figure(img, box, found, margin = 0.12, side) {
  const { bg, label, gw } = found;
  side = side ?? Math.ceil(Math.max(box.x1 - box.x0, box.y1 - box.y0) * (1 + margin * 2));
  const x0 = Math.round((box.x0 + box.x1) / 2) - (side >> 1);
  const y0 = Math.round((box.y0 + box.y1) / 2) - (side >> 1);
  const out = crop(img, x0, y0, side, side, [bg[0], bg[1], bg[2], 255]);
  const others = found.boxes.filter((b) => b.id !== box.id);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const sx = x + x0, sy = y + y0;
    if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
    const id = label[Math.floor(sy / GRID) * gw + Math.floor(sx / GRID)];
    let theirs = id >= 0 && id !== box.id;
    if (!theirs && id < 0) {
      // Unclaimed ground (a shadow): it goes with whichever figure it lies nearest to.
      const p = { x0: sx, y0: sy, x1: sx, y1: sy };
      const own = gap(p, box);
      theirs = others.some((o) => gap(p, o) < own);
    }
    if (theirs) out.data.set([bg[0], bg[1], bg[2], 255], (y * side + x) * 4);
  }
  return out;
}

/**
 * Cuts a sheet laid out as a grid (drawings made of loose strokes, which are not blobs).
 * Each cut is moved to the emptiest line near where an even grid would put it.
 * Returns the cells in reading order, each { x0, y0, x1, y1 }.
 */
export function cutGrid(img, cols, rows) {
  const bg = borderColour(img);
  const ink = (x, y) => {
    const i = (y * img.w + x) * 4;
    return Math.abs(img.data[i] - bg[0]) + Math.abs(img.data[i + 1] - bg[1]) + Math.abs(img.data[i + 2] - bg[2]) > 90 ? 1 : 0;
  };
  const colInk = new Float64Array(img.w);
  const rowInk = new Float64Array(img.h);
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) { const v = ink(x, y); colInk[x] += v; rowInk[y] += v; }
  const cuts = (sum, n, size) => {
    const out = [0];
    for (let k = 1; k < n; k++) {
      const mid = Math.round((k * size) / n);
      const reach = Math.round((size / n) * 0.2);
      let best = mid, bestInk = Infinity;
      for (let p = mid - reach; p <= mid + reach; p++) {
        // A band 9 pixels wide, so one stray stroke does not decide it; nearer the even cut wins ties.
        let v = 0;
        for (let q = p - 4; q <= p + 4; q++) v += sum[Math.max(0, Math.min(size - 1, q))];
        v += Math.abs(p - mid) * 0.01;
        if (v < bestInk) { bestInk = v; best = p; }
      }
      out.push(best);
    }
    out.push(size);
    return out;
  };
  const xs = cuts(colInk, cols, img.w);
  const ys = cuts(rowInk, rows, img.h);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x0: xs[c], y0: ys[r], x1: xs[c + 1], y1: ys[r + 1] });
  return { bg, cells };
}
