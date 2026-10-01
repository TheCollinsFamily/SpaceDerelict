/**
 * A BOARD REMEMBERED (Collins, Oct 1 2026: "maybe you could make this easier by remembering the organ
 * configuration and map when that mission was beaten and using that for the defence mission").
 *
 * When a deployment is won, the city as the body left it (every district drafted, every burrow, the
 * crash plaza where it is) and the organs under it (what, where, which way, what level) are kept in
 * the campaign save. A defence of that territory (src/meta/defence.ts) opens on that board again.
 *
 * Kept small and plain: one character a cell (about 2,000 for a 50x40 board), the districts' ids and
 * openings, the organs as anchors. The underground is not stored: it is dug again from its own seed,
 * so its rock, deposits and features are where they were. No limbs: a defence is the body re-arming
 * its own ground in a hurry (see DESIGN.md "Defence deployments").
 *
 * With no remembered board, a defence is fought on a LARGE city grown before the run starts, district
 * by district, by the same connection algebra the drafts use (`pregrow`), so the pieces always line up.
 */
import { Rng } from './rng';
import { CellType, PLATE, draftOffers, stampPlate, type CityMap, type PlateFeature } from './citymap';
import type { Organ, OrganId } from './types';

export interface BoardSnapshot {
  v: 1;
  w: number;
  h: number;
  slotsX: number;
  slotsY: number;
  coreCell: number;
  /** One character a cell: ' ' unclaimed, '.' street, 'P' plaza, '#' 'A' 'B' a block of height 1, 2, 3. */
  cells: string;
  /** The districts: slot, pattern id, its openings as letters ('nsew' subset), its feature. */
  slots: Array<{ slot: number; id: string; ports: string; feature: PlateFeature }>;
  /** The seed the body's underground is dug from (its rock, deposits and features). */
  underSeed: number;
  /** The organs: anchor cell in the underground, quarter turns, level. */
  organs: Array<{ organ: OrganId; cell: number; rot: number; level: number }>;
  /** The meteor's own level. */
  coreLevel: number;
}

const BLOCK_CHAR = ['#', '#', 'A', 'B'];

function cellChar(map: CityMap, i: number): string {
  switch (map.cells[i]) {
    case CellType.Void: return ' ';
    case CellType.Road: return '.';
    case CellType.Plaza: return 'P';
    default: {
      // The city's own height: the plinths the body grew are not the city's.
      const h = Math.max(1, Math.min(3, map.heights[i] - map.plinths[i]));
      return BLOCK_CHAR[h];
    }
  }
}

/** The board as it stands, and the body under it. */
export function snapshotBoard(map: CityMap, underSeed: number, organs: readonly Organ[], coreLevel: number): BoardSnapshot {
  let cells = '';
  for (let i = 0; i < map.w * map.h; i++) cells += cellChar(map, i);
  const slots: BoardSnapshot['slots'] = [];
  map.slots.forEach((s, slot) => {
    if (!s) return;
    const ports = (['n', 's', 'e', 'w'] as const).filter((e) => s.pattern.ports[e]).join('');
    slots.push({ slot, id: s.pattern.id, ports, feature: s.feature });
  });
  return {
    v: 1, w: map.w, h: map.h, slotsX: map.slotsX, slotsY: map.slotsY, coreCell: map.coreCell, cells, slots, underSeed,
    organs: organs.map((o) => ({ organ: o.organ, cell: o.cell, rot: o.rot, level: o.level })), coreLevel,
  };
}

const FROM_CHAR: Record<string, { t: CellType; h: number }> = {
  ' ': { t: CellType.Void, h: 0 },
  '.': { t: CellType.Road, h: 0 },
  P: { t: CellType.Plaza, h: 0 },
  '#': { t: CellType.Block, h: 1 },
  A: { t: CellType.Block, h: 2 },
  B: { t: CellType.Block, h: 3 },
};

/** The city of a snapshot, as a board the sim can run on. */
export function restoreMap(b: BoardSnapshot): CityMap {
  const map: CityMap = {
    w: b.w, h: b.h, slotsX: b.slotsX, slotsY: b.slotsY,
    cells: new Array<CellType>(b.w * b.h).fill(CellType.Void),
    heights: new Uint8Array(b.w * b.h),
    plinths: new Uint8Array(b.w * b.h),
    slots: new Array(b.slotsX * b.slotsY).fill(null),
    coreCell: b.coreCell,
  };
  for (let i = 0; i < b.w * b.h; i++) {
    const spec = FROM_CHAR[b.cells[i]] ?? FROM_CHAR[' '];
    map.cells[i] = spec.t;
    map.heights[i] = spec.h;
  }
  for (const s of b.slots) {
    // The pattern's rows are the board's own cells under it (burrows included).
    const sx = (s.slot % b.slotsX) * PLATE;
    const sy = Math.floor(s.slot / b.slotsX) * PLATE;
    const rows: string[] = [];
    for (let y = 0; y < PLATE; y++) {
      let row = '';
      for (let x = 0; x < PLATE; x++) {
        const c = b.cells[(sy + y) * b.w + sx + x];
        row += c === ' ' ? '#' : c;
      }
      rows.push(row);
    }
    const ports = { n: s.ports.includes('n'), s: s.ports.includes('s'), e: s.ports.includes('e'), w: s.ports.includes('w') };
    map.slots[s.slot] = { pattern: { id: s.id, rows, ports }, feature: s.feature, slot: s.slot };
  }
  return map;
}

/** Is this a snapshot the sim can open (an old or damaged save is not trusted)? */
export function validSnapshot(x: unknown): x is BoardSnapshot {
  const b = x as BoardSnapshot | null;
  if (!b || typeof b !== 'object' || b.v !== 1) return false;
  if (!Number.isInteger(b.w) || !Number.isInteger(b.h) || b.w !== b.slotsX * PLATE || b.h !== b.slotsY * PLATE) return false;
  if (typeof b.cells !== 'string' || b.cells.length !== b.w * b.h) return false;
  if (!Array.isArray(b.slots) || !Array.isArray(b.organs)) return false;
  if (!Number.isInteger(b.coreCell) || b.coreCell < 0 || b.coreCell >= b.w * b.h) return false;
  const core = b.cells[b.coreCell];
  return core === 'P' || core === '.';
}

/**
 * Grow the city before the run: `n` districts, each a legal draft (the same algebra as the drafts in
 * a run, so openings always meet openings). A random growth can wall itself in after a few districts,
 * so it is grown a few ways (each from its own seeded stream) and the fullest city is kept.
 */
export function pregrow(map: CityMap, rng: Rng, n: number): number {
  const base = rng.int(0, 1_000_000_000);
  let best: CityMap | null = null;
  let bestGrown = -1;
  for (let attempt = 0; attempt < 6 && bestGrown < n; attempt++) {
    const m = structuredClone(map);
    const r = new Rng((base + attempt * 7919) >>> 0);
    let grown = 0;
    for (let k = 0; k < n; k++) {
      const offer = draftOffers(m, r, 1)[0];
      if (!offer) break;
      stampPlate(m, offer.pattern, offer.slot, offer.feature, r);
      grown++;
    }
    if (grown > bestGrown) { best = m; bestGrown = grown; }
  }
  if (best) Object.assign(map, best);
  return Math.max(0, bestGrown);
}
