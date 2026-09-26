/**
 * City map generation: a real tower-defense board. Streets are the corridors,
 * buildings are solid, gates are where streets meet the map edge, and the core
 * sits in a central plaza. Deterministic from the run seed.
 */
import { Rng } from './rng';

export enum CellType {
  Block = 0,   // building: impassable, unbuildable
  Road = 1,    // street: enemy corridor, buildable (a tower here BLOCKS)
  Plaza = 2,   // open ground: passable, buildable
  Rubble = 3,  // digested building: passable, buildable
}

export interface CityMap {
  w: number;
  h: number;
  cells: CellType[];
  /** Edge road cells: where waves enter. */
  gates: number[];
  coreCell: number;
}

export function isPassable(t: CellType): boolean {
  return t !== CellType.Block;
}

export function generateCity(w: number, h: number, rng: Rng): CityMap {
  const cells = new Array<CellType>(w * h).fill(CellType.Block);
  const idx = (x: number, y: number) => y * w + x;
  const inMargin = (x: number, y: number) => x >= 1 && y >= 1 && x <= w - 2 && y <= h - 2;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Crash plaza: the asset's landing site — open ground where organs grow
  // and where leaks do their damage.
  for (let py = cy - 2; py <= cy + 2; py++) {
    for (let px = cx - 2; px <= cx + 2; px++) cells[idx(px, py)] = CellType.Plaza;
  }

  /** Carve an L between two points (axis order random), 1 cell wide. */
  const carveL = (x0: number, y0: number, x1: number, y1: number): void => {
    let x = x0;
    let y = y0;
    const xFirst = rng.next() < 0.5;
    const walk = (tx: number, ty: number) => {
      while (x !== tx) { x += Math.sign(tx - x); if (inMargin(x, y)) cells[idx(x, y)] = cells[idx(x, y)] === CellType.Plaza ? CellType.Plaza : CellType.Road; }
      while (y !== ty) { y += Math.sign(ty - y); if (inMargin(x, y)) cells[idx(x, y)] = cells[idx(x, y)] === CellType.Plaza ? CellType.Plaza : CellType.Road; }
    };
    if (xFirst) { walk(x1, y); walk(x1, y1); } else { walk(x, y1); walk(x1, y1); }
  };

  /**
   * Carve a SERPENTINE channel: waypoints step toward the target while
   * zigzagging perpendicular with real amplitude. The switchbacks are the
   * map's kill-zone geometry — blocks inside a bend touch several path legs.
   */
  const serpentine = (x0: number, y0: number, tx: number, ty: number): void => {
    let x = x0;
    let y = y0;
    let swing = rng.next() < 0.5 ? 1 : -1;
    let guard = 0;
    while (Math.abs(x - tx) + Math.abs(y - ty) > 4 && guard++ < 40) {
      const dx = tx - x;
      const dy = ty - y;
      const horizontalLeg = Math.abs(dx) > Math.abs(dy);
      const forward = 3 + rng.int(0, 3);
      const amp = 3 + rng.int(0, 3);
      let nx: number;
      let ny: number;
      if (horizontalLeg) {
        nx = x + Math.sign(dx) * Math.min(forward, Math.abs(dx));
        ny = y + swing * amp;
      } else {
        nx = x + swing * amp;
        ny = y + Math.sign(dy) * Math.min(forward, Math.abs(dy));
      }
      nx = Math.max(2, Math.min(w - 3, nx));
      ny = Math.max(2, Math.min(h - 3, ny));
      carveL(x, y, nx, ny);
      x = nx;
      y = ny;
      swing = -swing;
    }
    carveL(x, y, tx, ty);
  };

  // Confluences: two mustering squares where gate channels merge before the
  // shared final approach — the architectural chokepoints.
  const angle = rng.float(0, Math.PI);
  const conf: Array<{ x: number; y: number }> = [
    { x: Math.round(cx + Math.cos(angle) * 10), y: Math.round(cy + Math.sin(angle) * 7) },
    { x: Math.round(cx - Math.cos(angle) * 10), y: Math.round(cy - Math.sin(angle) * 7) },
  ].map((c) => ({
    x: Math.max(4, Math.min(w - 5, c.x)),
    y: Math.max(4, Math.min(h - 5, c.y)),
  }));
  for (const c of conf) serpentine(c.x, c.y, cx, cy);

  // Gates: three edges, each with a serpentine channel to its nearest confluence.
  const gates: number[] = [];
  const sides = [0, 1, 2, 3];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  for (let i = 0; i < 3; i++) {
    const side = sides[i];
    let gx: number;
    let gy: number;
    if (side === 0) { gx = rng.int(5, w - 6); gy = 0; }
    else if (side === 1) { gx = rng.int(5, w - 6); gy = h - 1; }
    else if (side === 2) { gx = 0; gy = rng.int(5, h - 6); }
    else { gx = w - 1; gy = rng.int(5, h - 6); }
    const gate = idx(gx, gy);
    gates.push(gate);
    const ix = Math.max(2, Math.min(w - 3, gx));
    const iy = Math.max(2, Math.min(h - 3, gy));
    // Carve the stub from the border gate to the serpentine start — every
    // cell of it, so the lane is connected from the very first tile.
    let sx = gx;
    let sy = gy;
    cells[gate] = CellType.Road;
    let stubGuard = 0;
    while ((sx !== ix || sy !== iy) && stubGuard++ < 8) {
      sx += Math.sign(ix - sx);
      sy += Math.sign(iy - sy);
      cells[idx(sx, sy)] = CellType.Road;
    }
    const near = conf.reduce((a, b) =>
      (Math.hypot(b.x - gx, b.y - gy) < Math.hypot(a.x - gx, a.y - gy) ? b : a));
    serpentine(ix, iy, near.x, near.y);
  }

  return { w, h, cells, gates, coreCell: idx(cx, cy) };
}

/**
 * Weighted flow field toward a target cell (Dijkstra over passable cells).
 * `extraCost` lets the sim make cells expensive without blocking them —
 * a tower on a road is a wall the swarm reroutes around or chews through.
 * Returns { dist, next } where next[cell] is the neighbor to step to.
 */
export function computeFlow(
  map: CityMap,
  target: number,
  extraCost: (cell: number) => number,
): { dist: Float64Array; next: Int32Array } {
  const n = map.w * map.h;
  const dist = new Float64Array(n).fill(Infinity);
  const next = new Int32Array(n).fill(-1);
  const baseCost = (c: number): number => {
    const t = map.cells[c];
    if (t === CellType.Road) return 10;
    if (t === CellType.Plaza) return 12;
    if (t === CellType.Rubble) return 14;
    return Infinity;
  };
  // Simple binary-heap-free Dijkstra: bucket by rounded cost is overkill; the
  // grid is 1200 cells, an array-scan priority queue is fine and deterministic.
  const open: number[] = [target];
  dist[target] = 0;
  const inOpen = new Uint8Array(n);
  inOpen[target] = 1;
  while (open.length > 0) {
    // Pop the lowest-dist entry (deterministic tie-break by index order).
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (dist[open[i]] < dist[open[bi]] || (dist[open[i]] === dist[open[bi]] && open[i] < open[bi])) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    inOpen[cur] = 0;
    const cx = cur % map.w;
    const cy = Math.floor(cur / map.w);
    const neighbors = [
      cx > 0 ? cur - 1 : -1,
      cx < map.w - 1 ? cur + 1 : -1,
      cy > 0 ? cur - map.w : -1,
      cy < map.h - 1 ? cur + map.w : -1,
    ];
    for (const nb of neighbors) {
      if (nb < 0) continue;
      const bc = baseCost(nb);
      if (!Number.isFinite(bc)) continue;
      const nd = dist[cur] + bc + extraCost(nb);
      if (nd < dist[nb] - 1e-9) {
        dist[nb] = nd;
        next[nb] = cur;
        if (!inOpen[nb]) {
          open.push(nb);
          inOpen[nb] = 1;
        }
      }
    }
  }
  return { dist, next };
}

/** BFS hop-distance over ALL cells — the creep climbs the city blocks too. */
export function allDistance(map: CityMap, from: number): Int32Array {
  const n = map.w * map.h;
  const dist = new Int32Array(n).fill(-1);
  const q: number[] = [from];
  dist[from] = 0;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const cx = cur % map.w;
    const cy = Math.floor(cur / map.w);
    const neighbors = [
      cx > 0 ? cur - 1 : -1,
      cx < map.w - 1 ? cur + 1 : -1,
      cy > 0 ? cur - map.w : -1,
      cy < map.h - 1 ? cur + map.w : -1,
    ];
    for (const nb of neighbors) {
      if (nb < 0 || dist[nb] !== -1) continue;
      dist[nb] = dist[cur] + 1;
      q.push(nb);
    }
  }
  return dist;
}

/** Plain BFS hop-distance from a cell over passable terrain (for pathing checks). */
export function passableDistance(map: CityMap, from: number): Int32Array {
  const n = map.w * map.h;
  const dist = new Int32Array(n).fill(-1);
  const q: number[] = [from];
  dist[from] = 0;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const cx = cur % map.w;
    const cy = Math.floor(cur / map.w);
    const neighbors = [
      cx > 0 ? cur - 1 : -1,
      cx < map.w - 1 ? cur + 1 : -1,
      cy > 0 ? cur - map.w : -1,
      cy < map.h - 1 ? cur + map.w : -1,
    ];
    for (const nb of neighbors) {
      if (nb < 0 || dist[nb] !== -1 || !isPassable(map.cells[nb])) continue;
      dist[nb] = dist[cur] + 1;
      q.push(nb);
    }
  }
  return dist;
}
