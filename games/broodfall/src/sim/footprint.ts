/**
 * FOOTPRINTS (Collins, Oct 1 2026: "the total lack of diversity in footprint ... is kind of a KEY part
 * of tower defence strategy. In tower defence the tower categories are one square (hugely over-represented),
 * two squares (line), four squares (large square, usually for very powerful towers), T-shaped (usually for
 * very powerful area-effect things), L-shaped (like an elbow shape)").
 *
 * A limb stands on a POLYOMINO of cells. A rectangle is still given as `span` [across, along] (the BIG and
 * LONG limbs of Sep 29); any other shape is a `shape` id from SHAPES. Every shape is written facing SOUTH
 * (toward +y, down the board) and turned a quarter at a time for the other facings, so the same limb can lie
 * four ways on a roof. The turns are the BOARD's, never the camera's.
 *
 * `hub`: the cells its reach, aim and area effects come from (its pos is their middle). A rectangle's hub is
 * all of it (its middle, as before). A T's is the junction of its bar (the stem points the way it faces); an
 * L's is its elbow. Absent: all of its cells.
 *
 * Nothing here knows the board: it is cell offsets only (sim.ts lays them on the map).
 */
import type { RootDir } from './types';

export type ShapeId = 'line3' | 'T' | 'L3' | 'L4' | 'S4';

export interface ShapeDef {
  /** Cell offsets [x, y] when it faces south. */
  cells: Array<[number, number]>;
  /** The cells its reach and effects come from (offsets into `cells` coordinates). Absent: every cell. */
  hub?: Array<[number, number]>;
  /** How it is named to the player. */
  name: string;
}

/**
 * The shapes. Facing south:
 *   line3  ■      T  ■■■      L3  ■       L4  ■       S4  ■
 *          ■          ■           ■■          ■           ■■
 *          ■                                  ■■           ■
 * (The 1x2 line and the 2x2 square are `span` rectangles: [1, 2] and [2, 2].)
 */
export const SHAPES: Record<ShapeId, ShapeDef> = {
  line3: { name: 'a line of three', cells: [[0, 0], [0, 1], [0, 2]] },
  T: { name: 'a T', cells: [[0, 0], [1, 0], [2, 0], [1, 1]], hub: [[1, 0]] },
  L3: { name: 'an elbow of three', cells: [[0, 0], [0, 1], [1, 1]], hub: [[0, 1]] },
  L4: { name: 'an L of four', cells: [[0, 0], [0, 1], [0, 2], [1, 2]], hub: [[0, 2]] },
  S4: { name: 'a zigzag of four', cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
};

/** Quarter turns from south, clockwise on the board (y down): S, W, N, E. */
const TURNS: Record<RootDir, number> = { S: 0, W: 1, N: 2, E: 3 };

/** (x, y) turned a quarter clockwise on a y-down board: south (0, 1) becomes west (-1, 0). */
const turn = ([x, y]: [number, number]): [number, number] => [-y, x];

export interface Footprint {
  /** Offsets of its cells from the top-left of its bounding box, in row-major order. */
  cells: Array<[number, number]>;
  /** Offsets of its hub cells (same frame). */
  hub: Array<[number, number]>;
  /** Its bounding box: cells across and down. */
  w: number;
  h: number;
}

const memo = new Map<string, Footprint>();

/**
 * The footprint of a limb facing this way: a `shape` turned, or a `span` rectangle (a quarter turn swaps its
 * sides, as spanOf always did), or one cell.
 */
export function footprintOf(spec: { shape?: ShapeId; span?: [number, number] }, facing?: RootDir): Footprint {
  const key = `${spec.shape ?? ''}|${spec.span?.join('x') ?? ''}|${facing ?? 'S'}`;
  const hit = memo.get(key);
  if (hit) return hit;
  let out: Footprint;
  if (spec.shape) {
    const def = SHAPES[spec.shape];
    const k = TURNS[facing ?? 'S'];
    const rot = (o: [number, number]): [number, number] => { let p = o; for (let i = 0; i < k; i++) p = turn(p); return p; };
    const raw = def.cells.map(rot);
    const rawHub = (def.hub ?? def.cells).map(rot);
    const mx = Math.min(...raw.map((p) => p[0]));
    const my = Math.min(...raw.map((p) => p[1]));
    const norm = (p: [number, number]): [number, number] => [p[0] - mx, p[1] - my];
    const cells = raw.map(norm).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const hub = rawHub.map(norm).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    out = { cells, hub, w: Math.max(...cells.map((p) => p[0])) + 1, h: Math.max(...cells.map((p) => p[1])) + 1 };
  } else {
    const span = spec.span ?? [1, 1];
    const [w, h] = facing === 'E' || facing === 'W' ? [span[1], span[0]] : [span[0], span[1]];
    const cells: Array<[number, number]> = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
    out = { cells, hub: cells, w, h };
  }
  memo.set(key, out);
  return out;
}

/** Does this limb take more than one cell? */
export const isMultiCell = (spec: { shape?: ShapeId; span?: [number, number] }): boolean =>
  !!spec.shape || (!!spec.span && spec.span[0] * spec.span[1] > 1);

/** Is its ground different when it is turned a quarter (it must find new ground to turn)? */
export const turnsItsGround = (spec: { shape?: ShapeId; span?: [number, number] }): boolean =>
  !!spec.shape || (!!spec.span && spec.span[0] !== spec.span[1]);

/** The name of a limb's footprint for the player ("one cell", "2 by 2 cells", "a T"). */
export function footprintName(spec: { shape?: ShapeId; span?: [number, number] }): string {
  if (spec.shape) return SHAPES[spec.shape].name;
  if (!spec.span || spec.span[0] * spec.span[1] === 1) return 'one cell';
  return `${spec.span[0]} by ${spec.span[1]} cells`;
}

/** The kind of footprint, for the codex and the plan: one / line / square / T / L / zigzag. */
export function footprintKind(spec: { shape?: ShapeId; span?: [number, number] }): 'one' | 'line' | 'square' | 'T' | 'L' | 'zigzag' {
  if (spec.shape === 'T') return 'T';
  if (spec.shape === 'L3' || spec.shape === 'L4') return 'L';
  if (spec.shape === 'S4') return 'zigzag';
  if (spec.shape === 'line3') return 'line';
  if (!spec.span || spec.span[0] * spec.span[1] === 1) return 'one';
  return spec.span[0] === spec.span[1] ? 'square' : 'line';
}
