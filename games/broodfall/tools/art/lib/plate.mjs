/**
 * THE GROUND PLATE OF A SHAPED LIMB (Oct 2 2026, the class-zero footprints: notes/FOOTPRINT-PLAN.md).
 *
 * A limb that stands on a line of three, a T, an elbow or an L is drawn to FILL that ground. The picture model
 * is handed a plate first: the limb's cells as flat dark diamonds, seen from 45 degrees above exactly as the
 * board draws them, on the key colour, and is told to grow the organism over exactly that patch. So where the
 * limb stands in its picture is known before it is drawn: the middle of the plate, and the plate's width. No
 * mark by eye is needed (tools/art/limbs.mjs `plate`), and the game puts the middle of the plate on the middle
 * of the picture of its ground (src/render/isoRender.ts, art.plate).
 *
 * VIEWS. The board is seen four ways. A limb facing south is seen from the FRONT (its face to the lower left);
 * facing north from BEHIND; facing east and west from the two sides. A shape that is its own mirror once turned
 * (a line, a T, a square) needs two pictures (front and back), mirrored for the sides as every limb is. An elbow
 * or an L is not: mirrored, its picture would stand on the wrong cells, so it has all four (`views4`).
 *
 * The shapes here are src/sim/footprint.ts SHAPES (tests/plate.test.ts holds the two to each other).
 */
import { blank, writePng } from './img.mjs';

/** Facing south (toward +y): src/sim/footprint.ts SHAPES. */
export const SHAPES = {
  one: [[0, 0]],
  line3: [[0, 0], [0, 1], [0, 2]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  L3: [[0, 0], [0, 1], [1, 1]],
  L4: [[0, 0], [0, 1], [0, 2], [1, 2]],
  S4: [[0, 0], [0, 1], [1, 1], [1, 2]],
  sq2: [[0, 0], [1, 0], [0, 1], [1, 1]],
};
/** Quarter turns from south, clockwise on a y-down board (src/sim/footprint.ts TURNS). */
const TURNS = { S: 0, W: 1, N: 2, E: 3 };
/** Which board facing each view is, with the camera unturned (src/render/iso.ts limbView). */
export const VIEW_FACING = { front: 'S', side: 'E', back: 'N', backside: 'W' };

/** The cells of a shape facing one way, from the top-left of its box (src/sim/footprint.ts footprintOf). */
export function cellsOf(shape, facing = 'S') {
  let cells = SHAPES[shape].map(([x, y]) => [x, y]);
  for (let i = 0; i < TURNS[facing]; i++) cells = cells.map(([x, y]) => [-y, x]);
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** A cell's middle on the screen, in half-tiles: x = (cx - cy), y = (cx + cy) (the board unturned). */
const onScreen = ([cx, cy]) => [cx - cy, cx + cy];

/**
 * How many tiles across and deep the plate of a shape is on the screen, facing one way.
 * Across: from the left corner of its leftmost tile to the right corner of its rightmost.
 */
export function plateSpan(shape, facing = 'S') {
  const s = cellsOf(shape, facing).map(onScreen);
  const xs = s.map((p) => p[0]);
  const ys = s.map((p) => p[1]);
  return { across: (Math.max(...xs) - Math.min(...xs)) / 2 + 1, deep: (Math.max(...ys) - Math.min(...ys)) / 2 + 1 };
}

/**
 * Draw the plate: the shape's cells as flat diamonds on the key colour.
 * @returns {{ img, x, y, w, h, tile }} the picture and the plate's box in it: its middle (x, y) and size.
 */
export function drawPlate(shape, facing, { size = 1024, share = 0.6, low = 0.66, key = [0, 255, 0], ground = [70, 18, 26], at, slab = false } = {}) {
  const cells = cellsOf(shape, facing).map(onScreen);
  const xs = cells.map((p) => p[0]);
  const ys = cells.map((p) => p[1]);
  const across = (Math.max(...xs) - Math.min(...xs)) / 2 + 1; // in tile widths
  const deep = (Math.max(...ys) - Math.min(...ys)) / 2 + 1; // in tile heights
  // A tile is 128 x 76 on the board (tools/art/lib/iso.mjs): the plate keeps that shape.
  // `at`: a plate fitted to a picture (fitPlate): its tile width and its middle.
  const tw = at?.tw ?? (share * size) / across;
  const th = tw * (76 / 128);
  const cx = at?.x ?? size / 2;
  const cy = at?.y ?? size * low;
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const img = blank(size, size, [...key, 255]);
  const at2 = cells.map(([hx, hy]) => [cx + ((hx - midX) * tw) / 2, cy + ((hy - midY) * th) / 2]);
  // `slab`: a raised base of flesh in the shape (its sides first, then its top), for the picture model to grow
  // the organism ON: an edit keeps what is already drawn far better than it follows a flat patch.
  if (slab) {
    const thick = th * 0.12;
    for (const [x, y] of at2) for (let d = 1; d <= thick; d++) diamond(img, x, y + d, tw / 2, th / 2, [64, 14, 22]);
    for (const [x, y] of at2) diamond(img, x, y, tw / 2, th / 2, [142, 34, 46], 0.18);
  } else for (const [x, y] of at2) diamond(img, x, y, tw / 2, th / 2, ground);
  return { img, x: cx, y: cy, w: across * tw, h: deep * th, tile: tw };
}

/** A filled diamond (a tile seen from above) with a slightly darker rim. */
function diamond(img, x, y, a, b, rgb, noise = 0) {
  for (let py = Math.floor(y - b); py <= Math.ceil(y + b); py++) {
    if (py < 0 || py >= img.h) continue;
    const half = a * (1 - Math.abs(py - y) / b);
    for (let px = Math.floor(x - half); px <= Math.ceil(x + half); px++) {
      if (px < 0 || px >= img.w || half <= 0) continue;
      const edge = Math.abs(px - x) / a + Math.abs(py - y) / b;
      // A little mottling, as of wet veined flesh (repeatable: a hash of the pixel).
      const h = noise ? (((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1) + 1) % 1 : 0.5;
      const k = (edge > 0.94 ? 0.8 : 1) * (1 + noise * (h - 0.5) * 2);
      const p = (py * img.w + px) * 4;
      img.data[p] = Math.min(255, Math.round(rgb[0] * k));
      img.data[p + 1] = Math.min(255, Math.round(rgb[1] * k));
      img.data[p + 2] = Math.min(255, Math.round(rgb[2] * k));
      img.data[p + 3] = 255;
    }
  }
}

export function writePlate(file, shape, facing, opts) {
  const p = drawPlate(shape, facing, opts);
  writePng(file, p.img);
  return p;
}

/**
 * WHERE A DRAWN LIMB'S GROUND IS (Oct 2 2026). The picture model does not keep the plate exactly where it was put,
 * so the plate is found again in what it drew: as wide as the low part of the organism (its skirt and the arms
 * lying along the tiles), its front edge along the organism's own front edge (the lowest solid pixel of each column).
 * `img`: a keyed picture (alpha). Returns { x, y, tw, w } in its pixels: the plate's middle, tile width and width.
 */
export function fitPlate(img, shape, facing) {
  // Worked at half size: the base of the organism (its slab and its mound), with what is thin taken off (an
  // opening: pipes, quills, roots and spines are thinner than `r`), so tall thin parts do not pull the fit up.
  const S = 2;
  const w = Math.floor(img.w / S), h = Math.floor(img.h / S);
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) solid[y * w + x] = img.data[((y * S) * img.w + x * S) * 4 + 3] > 128 ? 1 : 0;
  const r = Math.max(3, Math.round(w * 0.014));
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
  const base = pass(pass(pass(pass(solid, true, true), false, true), true, false), false, false);
  let bx0 = w, bx1 = -1, by0 = h, by1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (base[y * w + x]) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); n++; }
  const cells = cellsOf(shape, facing).map(([cx, cy]) => [cx - cy, cx + cy]);
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const across = (Math.max(...xs) - Math.min(...xs)) / 2 + 1;
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  // The plate's score at a place and size: how much of the base it covers and how little it covers of nothing.
  const score = (cx, cy, tw) => {
    const th = (tw * 76) / 128;
    let inter = 0, area = 0;
    for (const [hx, hy] of cells) {
      const tx = cx + ((hx - midX) * tw) / 2;
      const ty = cy + ((hy - midY) * th) / 2;
      for (let y = Math.floor(ty - th / 2); y <= Math.ceil(ty + th / 2); y += 2) {
        if (y < 0 || y >= h) continue;
        const half = (tw / 2) * (1 - Math.abs(y - ty) / (th / 2));
        for (let x = Math.floor(tx - half); x <= Math.ceil(tx + half); x += 2) {
          if (x < 0 || x >= w) continue;
          area++;
          if (base[y * w + x]) inter++;
        }
      }
    }
    // Intersection over union, the base's area counted in the same 2x2 steps.
    return inter / Math.max(1, area + n / 4 - inter);
  };
  const tw0 = (bx1 - bx0) / across;
  let best = { s: -1 };
  const search = (cx0, cy0, t0, spanXY, spanT, step) => {
    for (let k = 1 - spanT; k <= 1 + spanT + 1e-9; k += step) {
      const tw = t0 * k;
      for (let dx = -spanXY; dx <= spanXY + 1e-9; dx += step) for (let dy = -spanXY; dy <= spanXY + 1e-9; dy += step) {
        const cx = cx0 + dx * tw;
        const cy = cy0 + dy * tw;
        const s = score(cx, cy, tw);
        if (s > best.s) best = { s, cx, cy, tw };
      }
    }
  };
  search((bx0 + bx1) / 2, by1 - ((tw0 * 76) / 128) * 0.9, tw0, 0.6, 0.3, 0.1);
  search(best.cx, best.cy, best.tw, 0.12, 0.08, 0.02);
  return { e: 1 - best.s, iou: best.s, x: best.cx * S, y: best.cy * S, tw: best.tw * S, w: across * best.tw * S };
}
