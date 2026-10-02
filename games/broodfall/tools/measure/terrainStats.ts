// The lie of the land, measured (Oct 2 2026): shared by terrain.measure.ts, terrain-probe.ts and tests/terrain.test.ts.
import { CellType } from '../../src/sim/citymap';

/** The footprints to look for, as cell offsets (every rotation listed). */
export const SHAPES: Record<string, Array<Array<[number, number]>>> = {
  '1x1': [[[0, 0]]],
  line2: [[[0, 0], [1, 0]], [[0, 0], [0, 1]]],
  line3: [[[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]]],
  '2x2': [[[0, 0], [1, 0], [0, 1], [1, 1]]],
  T: [
    [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]], [[1, 0], [1, 1], [1, 2], [0, 1]],
  ],
  L3: [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]]],
  L4: [
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[1, 0], [1, 1], [1, 2], [0, 2]],
    [[0, 0], [1, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]],
  ],
};

export interface TerrainStats {
  blocks: number;
  /** Neighbouring block pairs (4-way) by height difference 0, 1, 2, 3+. */
  steps: number[];
  /** Block cells higher than every block neighbour (8-way), with at least two block neighbours. */
  isolated: number;
  /** Cells by height 1..4. */
  byHeight: number[];
  /** Separate plateaus (connected blocks of one height) at each height 1..4 that hold at least one level 2x2. */
  plateaus2x2: number[];
  /** Level placements per shape and height: shape -> [h1, h2, h3, h4]. */
  level: Record<string, number[]>;
}

export function terrainStats(map: { w: number; h: number; cells: CellType[]; heights: Uint8Array; plinths: Uint8Array }): TerrainStats {
  const { w, h } = map;
  const block = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && map.cells[y * w + x] === CellType.Block;
  // The land itself: a plinth the player raised is not terrain.
  const height = (x: number, y: number) => map.heights[y * w + x] - map.plinths[y * w + x];
  const s: TerrainStats = { blocks: 0, steps: [0, 0, 0, 0], isolated: 0, byHeight: [0, 0, 0, 0], plateaus2x2: [0, 0, 0, 0], level: {} };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!block(x, y)) continue;
      s.blocks++;
      const hc = height(x, y);
      s.byHeight[Math.min(3, Math.max(0, hc - 1))]++;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (block(x + dx, y + dy)) s.steps[Math.min(3, Math.abs(hc - height(x + dx, y + dy)))]++;
      }
      let nb = 0;
      let higher = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && block(x + dx, y + dy)) { nb++; if (height(x + dx, y + dy) >= hc) higher = false; }
        }
      }
      if (nb >= 2 && higher && hc > 1) s.isolated++;
    }
  }
  for (const [name, rots] of Object.entries(SHAPES)) {
    const counts = [0, 0, 0, 0];
    const seen = new Set<string>();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (const rot of rots) {
          const cells = rot.map(([dx, dy]) => [x + dx, y + dy]);
          if (!cells.every(([cx, cy]) => block(cx, cy))) continue;
          const hc = height(cells[0][0], cells[0][1]);
          if (!cells.every(([cx, cy]) => height(cx, cy) === hc)) continue;
          const key = cells.map(([cx, cy]) => cy * w + cx).sort((a, b) => a - b).join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          counts[Math.min(3, Math.max(0, hc - 1))]++;
        }
      }
    }
    s.level[name] = counts;
  }
  // Plateaus: flood each run of same-height blocks; count those with a level 2x2 inside.
  const comp = new Int32Array(w * h).fill(-1);
  let next = 0;
  for (let i = 0; i < w * h; i++) {
    if (comp[i] >= 0 || map.cells[i] !== CellType.Block) continue;
    const hi = height(i % w, Math.floor(i / w));
    const stack = [i];
    comp[i] = next;
    const members: number[] = [];
    while (stack.length) {
      const c = stack.pop()!;
      members.push(c);
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!block(nx, ny)) continue;
        const n = ny * w + nx;
        if (comp[n] < 0 && height(nx, ny) === hi) { comp[n] = next; stack.push(n); }
      }
    }
    const inSet = new Set(members);
    const holds = members.some((c) => inSet.has(c + 1) && inSet.has(c + w) && inSet.has(c + w + 1) && (c % w) < w - 1);
    if (holds) s.plateaus2x2[Math.min(3, Math.max(0, hi - 1))]++;
    next++;
  }
  return s;
}

