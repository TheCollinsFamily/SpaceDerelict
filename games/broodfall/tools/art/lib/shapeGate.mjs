/**
 * THE FOOTPRINT GATE (Oct 2 2026; Collins, of the reshaped limbs' look pictures: "some of these won't remotely fit
 * the shape they need to; how was this not caught?"). A picture of a limb drawn over its ground plate must still
 * stand on THAT ground: the right cells, the right arms, nothing extra, nothing missing. Not judged by eye.
 *
 * How: the limb's base is found in the picture (its solid with the thin parts taken off: pipes, quills, roots), the
 * expected footprint is fitted to it (fitPlate), and the base's FRONT EDGE (the lowest point of every column, which
 * an isometric picture shows of everything that lies on the ground) is compared, column by column, to the front edge
 * of the footprint's slab. A T drawn as a line loses its stem's corner; a T drawn as a blob fills its notches; an L
 * drawn as a square fills its inside corner: each moves the front edge by half a tile or more where the footprint
 * says otherwise. And nothing may lie on the ground beside the footprint.
 *
 * gate(img, shape, facing, hint) -> { pass, edge, beside, fit }: `edge` the share of the footprint's columns whose
 * front edge is where it should be; `beside` the share of ground-level solid beside it. Thresholds: GATE.
 */
import { cellsOf, fitPlate } from './plate.mjs';

export const GATE = { edge: 0.85, beside: 0.06, tol: 0.3, tile: 0.5 };

/** The solid of a picture with its thin parts taken off (the same opening as fitPlate), at half size. */
export function openedBase(img) {
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
  return { S, w, h, mask: pass(pass(pass(pass(solid, true, true), false, true), true, false), false, false) };
}

/**
 * The footprint's slab as it lies in a picture: its front edge at a column (the lowest point of any of its tiles
 * there, plus the slab's thickness), its left and right ends, and the top of its tiles. In the picture's pixels.
 */
export function slabGeometry(shape, facing, fit) {
  const cells = cellsOf(shape, facing).map(([cx, cy]) => [cx - cy, cx + cy]);
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const tw = fit.tw;
  const th = (tw * 76) / 128;
  const tiles = cells.map(([hx, hy]) => [fit.x + ((hx - midX) * tw) / 2, fit.y + ((hy - midY) * th) / 2]);
  const thick = th * 0.12;
  const front = (x) => {
    let best = -Infinity;
    for (const [tx, ty] of tiles) {
      const d = Math.abs(x - tx);
      if (d > tw / 2) continue;
      best = Math.max(best, ty + (th / 2) * (1 - d / (tw / 2)) + thick);
    }
    return best;
  };
  const inside = (x, y) => tiles.some(([tx, ty]) => Math.abs(x - tx) / (tw / 2) + Math.abs(y - ty) / (th / 2) <= 1) ||
    tiles.some(([tx, ty]) => Math.abs(x - tx) / (tw / 2) + Math.abs(y - thick - ty) / (th / 2) <= 1);
  return {
    tiles, tw, th, thick, front, inside,
    left: Math.min(...tiles.map((t) => t[0])) - tw / 2, right: Math.max(...tiles.map((t) => t[0])) + tw / 2,
    top: Math.min(...tiles.map((t) => t[1])) - th / 2, bottom: Math.max(...tiles.map((t) => t[1])) + th / 2 + thick,
  };
}

/** The gate. : a keyed picture (alpha), 1024 square. */
export function gate(img, shape, facing, hint) {
  const base = openedBase(img);
  const S = base.S;
  const low = new Float64Array(base.w).fill(-Infinity);
  for (let x = 0; x < base.w; x++) for (let y = base.h - 1; y >= 0; y--) if (base.mask[y * base.w + x]) { low[x] = y * S; break; }
  // How well a placement's front edge matches the picture's, and how much lies on the ground beside it.
  const score = (fit) => {
    const g = slabGeometry(shape, facing, fit);
    let n = 0, ok = 0;
    for (let px = Math.ceil(g.left + g.tw * 0.06); px <= g.right - g.tw * 0.06; px += S) {
      const e = g.front(px);
      if (e === -Infinity) continue;
      n++;
      if (Math.abs(low[Math.round(px / S)] - e) <= g.th * GATE.tol) ok++;
    }
    let beside = 0, groundAll = 0;
    for (let y = Math.max(0, Math.round(g.top / S)); y < base.h; y += 2) for (let x = 0; x < base.w; x += 2) {
      if (!base.mask[y * base.w + x]) continue;
      groundAll++;
      const X = x * S, Y = y * S;
      if (Y > g.front(X) + g.th * GATE.tol || X < g.left - g.tw * 0.12 || X > g.right + g.tw * 0.12) beside++;
    }
    return { edge: n ? ok / n : 0, beside: groundAll ? beside / groundAll : 0 };
  };
  // The placement: fitPlate's, then searched for the best match of the front edge (the outline a picture shows).
  let fit = fitPlate(img, shape, facing, hint);
  let best = { fit, ...score(fit) };
  const better = (a, b) => a.edge - 2 * a.beside > b.edge - 2 * b.beside;
  for (const step of [0.12, 0.05, 0.02]) {
    const f0 = best.fit;
    for (const k of [1 - step, 1, 1 + step]) for (const dx of [-2, -1, 0, 1, 2]) for (const dy of [-2, -1, 0, 1, 2]) {
      const f = { ...f0, tw: f0.tw * k, w: f0.w * k, x: f0.x + dx * step * f0.tw, y: f0.y + dy * step * f0.tw * 0.6 };
      const sc = score(f);
      if (better(sc, best)) best = { fit: f, ...sc };
    }
  }
  return { pass: best.edge >= GATE.edge && best.beside <= GATE.beside, edge: Number(best.edge.toFixed(3)), beside: Number(best.beside.toFixed(3)), fit: best.fit };
}

/**
 * The STRICT gate: the picture must fit its own footprint (gate) AND fit it better than the same shape turned any
 * other way (a mirrored L or a T on its side has the right cells in the wrong places: Oct 2 2026, the Meat Press).
 */
export function gateStrict(img, shape, facing, hint) {
  const own = gate(img, shape, facing, hint);
  const others = ['S', 'E', 'N', 'W'].filter((f) => f !== facing).map((f) => ({ f, ...gate(img, shape, f) }));
  // A shape that looks the same turned (a square, a line seen end-on is not) cannot be told apart: only one that differs counts.
  const same = (f) => JSON.stringify(cellsOf(shape, f)) === JSON.stringify(cellsOf(shape, facing));
  const rival = others.filter((o) => !same(o.f)).reduce((a, b) => (b.edge > a.edge ? b : a), { edge: 0, f: null });
  // Only clear evidence counts: a turned shape fitting BETTER by more than a little (an elbow of three, or a T, seen
  // turned, has a front edge much like its own: measured on the approved pictures, they tie within 0.05).
  const clear = own.edge >= rival.edge - 0.05;
  return { ...own, pass: own.pass && clear, rival: rival.f ? `${rival.f} ${rival.edge.toFixed(3)}` : null };
}

/**
 * EVERY TILE IS THERE: the share of each tile of the footprint (its diamond, shrunk a little) the picture covers. A T
 * drawn as a line leaves its stem's tile bare; a front edge cannot see a missing tile behind (Oct 2 2026: the Frond's
 * looks seen from behind).
 */
export function tileCover(img, shape, facing, fit) {
  const g = slabGeometry(shape, facing, fit);
  return g.tiles.map(([tx, ty]) => {
    let n = 0, s = 0;
    for (let y = Math.round(ty - g.th * 0.4); y <= ty + g.th * 0.4; y += 2) for (let x = Math.round(tx - g.tw * 0.4); x <= tx + g.tw * 0.4; x += 2) {
      if (Math.abs(x - tx) / (g.tw * 0.4) + Math.abs(y - ty) / (g.th * 0.4) > 1) continue;
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      n++; if (img.data[(y * img.w + x) * 4 + 3] > 128) s++;
    }
    return n ? s / n : 0;
  });
}

/** The full gate: the strict front-edge gate and every tile covered. */
export function gateFull(img, shape, facing, hint) {
  const g = gateStrict(img, shape, facing, hint);
  const tiles = tileCover(img, shape, facing, g.fit);
  const least = Math.min(...tiles);
  return { ...g, pass: g.pass && least >= GATE.tile, tiles: tiles.map((t) => Number(t.toFixed(2))), least: Number(least.toFixed(2)) };
}

/**
 * THE SLAB LOCKED (Oct 2 2026): a look is an edit of its limb's approved view, and its footprint is INHERITED: under
 * the look, wherever its limb's view stands on a tile of its footprint and the look has nothing, the limb's own slab
 * is put back; and nothing of the look may lie on the ground in front of or beside the footprint (cleared). Both
 * pictures keyed (alpha), the same size; `fit` where the limb's view stands. Returns the look, changed in place.
 */
export function lockSlab(look, base, shape, facing, fit) {
  const g = slabGeometry(shape, facing, fit);
  for (let y = 0; y < look.h; y++) for (let x = 0; x < look.w; x++) {
    const p = (y * look.w + x) * 4;
    if (g.inside(x, y)) {
      if (look.data[p + 3] < 128 && base.data[p + 3] >= 128) for (let k = 0; k < 4; k++) look.data[p + k] = base.data[p + k];
    } else if (y > g.front(x) + g.th * GATE.tol || ((x < g.left - g.tw * 0.12 || x > g.right + g.tw * 0.12) && y > g.top + g.th * 0.5)) {
      look.data[p + 3] = 0;
    }
  }
  return look;
}
