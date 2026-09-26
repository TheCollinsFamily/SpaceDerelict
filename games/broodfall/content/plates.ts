/**
 * District plates: hand-authored 10x10 map chunks the run is built from,
 * Tower-Dominion style. The board starts as ONE plate and expands by draft.
 *
 * Legend: '#' block h1 · 'A' block h2 · 'B' block h3 · '.' street · 'P' plaza
 * Ports are TWO street cells at indexes 4-5 of an edge (two-wide mouths keep
 * their indexes under rotation, so any two adjacent ports always connect).
 */

export interface PlatePattern {
  id: string;
  rows: string[]; // 10 strings of 10 chars
  ports: { n: boolean; s: boolean; e: boolean; w: boolean };
}

export type PlateFeature = 'plain' | 'science' | 'meat' | 'highground';

export const PLATE_FEATURES: Record<PlateFeature, { name: string; desc: string }> = {
  plain: { name: 'Residential Warren', desc: 'Dense housing. No special traits.' },
  science: { name: 'Research Quarter', desc: 'Field stations here: +3 interest while held.' },
  meat: { name: 'Provision District', desc: 'Rich larders: +25% war meat from kills here.' },
  highground: { name: 'Temple Heights', desc: 'Tall architecture: more high-ground perches.' },
};

/** The crash site: central plaza, winding exits to all four ports. */
export const START_PLATE: PlatePattern = {
  id: 'crash-site',
  ports: { n: true, s: true, e: true, w: true },
  rows: [
    '####..####',
    '#A##.###B#',
    '####.#####',
    '#B##.##A##',
    '...PPPP...',
    '.A#PPPP#B.',
    '###PPPP###',
    '#B#PPPP#A#',
    '####..####',
    '####..####',
  ],
};

export const PLATES: PlatePattern[] = [
  {
    // North-south serpentine: the classic switchback gauntlet.
    id: 'serpentine',
    ports: { n: true, s: true, e: false, w: false },
    rows: [
      '####..####',
      '####.###A#',
      '#B#....###',
      '###A##.###',
      '###....#B#',
      '###.####A#',
      '###....###',
      '#A####.###',
      '##B....###',
      '####..####',
    ],
  },
  {
    // Crossroads: all four ports merge on a fat central square.
    id: 'crossroads',
    ports: { n: true, s: true, e: true, w: true },
    rows: [
      '####..####',
      '#A##.###B#',
      '####.#####',
      '##A#.#####',
      '....PP....',
      '....PP....',
      '####..####',
      '#B##.#####',
      '####.##A##',
      '####..####',
    ],
  },
  {
    // Hook: north port bends east — corner-turner with an inner pocket.
    id: 'hook',
    ports: { n: true, s: false, e: true, w: false },
    rows: [
      '####..####',
      '#B##.##A##',
      '####.#####',
      '#A##.##B##',
      '####......',
      '#####.....',
      '###A###B##',
      '##########',
      '#B######A#',
      '##########',
    ],
  },
  {
    // Tee: a chunky east-west boulevard with a north spur.
    id: 'tee',
    ports: { n: true, s: false, e: true, w: true },
    rows: [
      '####..####',
      '#A##.##B##',
      '####.#####',
      '####.#####',
      '..........',
      '.B##A##A..',
      '####B#####',
      '##A####B##',
      '##########',
      '####A#####',
    ],
  },
  {
    // Long hall: an east-west shooting gallery flanked by high perches.
    id: 'longhall',
    ports: { n: false, s: false, e: true, w: true },
    rows: [
      '##########',
      '#A##B##A##',
      '##########',
      '#A#B##A#B#',
      '..........',
      '.#A##B##A.',
      '##########',
      '#B##A##B##',
      '##########',
      '##########',
    ],
  },
];

/** Rotate a pattern 90° clockwise (rows and ports both turn; ports stay at 4-5). */
export function rotatePlate(p: PlatePattern): PlatePattern {
  const n = 10;
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) row += p.rows[n - 1 - x][y];
    rows.push(row);
  }
  return {
    id: `${p.id}r`,
    rows,
    ports: { n: p.ports.w, e: p.ports.n, s: p.ports.e, w: p.ports.s },
  };
}

/** All four rotations of every draftable plate. */
export function platePool(): PlatePattern[] {
  const out: PlatePattern[] = [];
  for (const base of PLATES) {
    let cur = base;
    for (let r = 0; r < 4; r++) {
      out.push({ ...cur, id: `${base.id}-${r}` });
      cur = rotatePlate(cur);
    }
  }
  return out;
}

/** Sanity-check a pattern: shape, port cells open, all open cells connected. */
export function validatePlate(p: PlatePattern): string | null {
  if (p.rows.length !== 10) return `${p.id}: ${p.rows.length} rows`;
  for (const r of p.rows) if (r.length !== 10) return `${p.id}: row "${r}" length ${r.length}`;
  const open = (x: number, y: number) => '.P'.includes(p.rows[y][x]);
  const portCells: Array<[number, number]> = [];
  if (p.ports.n) portCells.push([4, 0], [5, 0]);
  if (p.ports.s) portCells.push([4, 9], [5, 9]);
  if (p.ports.w) portCells.push([0, 4], [0, 5]);
  if (p.ports.e) portCells.push([9, 4], [9, 5]);
  for (const [x, y] of portCells) {
    if (!open(x, y)) return `${p.id}: port at ${x},${y} is not open`;
  }
  // Connectivity: flood from the first open cell; every open cell must be reached.
  let start: [number, number] | null = null;
  let total = 0;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (open(x, y)) {
        total++;
        if (!start) start = [x, y];
      }
    }
  }
  if (!start) return `${p.id}: no open cells`;
  const seen = new Set<number>([start[1] * 10 + start[0]]);
  const q = [start];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx > 9 || ny > 9 || !open(nx, ny) || seen.has(ny * 10 + nx)) continue;
      seen.add(ny * 10 + nx);
      q.push([nx, ny]);
    }
  }
  if (seen.size !== total) return `${p.id}: ${total - seen.size} open cells disconnected`;
  return null;
}

// ---------------- Gene bay (the ship's between-run splices) ----------------

export interface Gene {
  id: string;
  name: string;
  desc: string;
  weightMult?: Partial<Record<string, number>>;
  startWar?: number;
  startScience?: number;
  spineHpBonus?: number;
  mawEatBonus?: number;
  rangeMult?: number;
}

export const GENES: Gene[] = [
  { id: 'acid-glands', name: 'Acid Glands', desc: 'Spitter genes express twice as often.', weightMult: { spitter: 2 } },
  { id: 'deep-gullet', name: 'Deep Gullet', desc: 'Maws swallow specimens up to +12 HP.', mawEatBonus: 12 },
  { id: 'dense-ossature', name: 'Dense Ossature', desc: 'Spine walls +200 HP.', spineHpBonus: 200 },
  { id: 'fat-reserves', name: 'Fat Reserves', desc: 'Deploy with +25 war meat.', startWar: 25 },
  { id: 'symbiont-culture', name: 'Symbiont Culture', desc: 'Deploy with +15 science meat.', startScience: 15 },
  { id: 'burst-polyps', name: 'Burst Polyps', desc: 'Burster genes express twice as often.', weightMult: { burster: 2 } },
  { id: 'long-sinews', name: 'Long Sinews', desc: 'All limbs +8% reach.', rangeMult: 1.08 },
  { id: 'lure-musk', name: 'Lure Musk', desc: 'Lure genes express three times as often.', weightMult: { lure: 3 } },
];
