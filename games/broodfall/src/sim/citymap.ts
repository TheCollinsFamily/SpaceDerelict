/**
 * The board: a slot grid of 10x10 district PLATES (Tower Dominion school).
 * The run starts as one plate (the crash site) surrounded by VOID — unclaimed
 * city under smoke. Every few waves the player drafts a district to grow into;
 * its pattern brings new winding channels, high-ground blocks, and new gates
 * on the new frontier. The map is player-built over the run.
 */
import { Rng } from './rng';
import {
  DRAFT_ONLY, PLATE_FEATURES, PlateFeature, PlatePattern, START_PLATES, platePool,
} from '../../content/plates';

export const PLATE = 10;

export enum CellType {
  Block = 0,  // building: impassable to enemies, buildable once creeped (has height)
  Road = 1,   // carved street channel: enemy corridor (spine walls only)
  Plaza = 2,  // open ground: passable, organ ground inside the body
  Void = 3,   // unclaimed district: nothing enters, nothing builds, nothing shows
}

export interface PlateInstance {
  pattern: PlatePattern;
  feature: PlateFeature;
  slot: number;
}

export interface CityMap {
  w: number;
  h: number;
  slotsX: number;
  slotsY: number;
  cells: CellType[];
  /** Block height 1-3, and up to 4 where the body has raised it on plinths (0 elsewhere). Verticality: higher perch = longer reach. */
  heights: Uint8Array;
  /** How many of a cell's levels, from the top, are plinths the body grew (the rest is the city's own block). */
  plinths: Uint8Array;
  slots: Array<PlateInstance | null>;
  coreCell: number;
}

export interface DraftOffer {
  pattern: PlatePattern;
  slot: number;
  feature: PlateFeature;
  /** This district carries a SHELTER at its centre (Sim: shelters, Oct 2 2026). */
  shelter?: boolean;
}

export function isPassable(t: CellType): boolean {
  return t === CellType.Road || t === CellType.Plaza;
}

const CHAR_TO_CELL: Record<string, { t: CellType; h: number }> = {
  '#': { t: CellType.Block, h: 1 },
  A: { t: CellType.Block, h: 2 },
  B: { t: CellType.Block, h: 3 },
  '.': { t: CellType.Road, h: 0 },
  P: { t: CellType.Plaza, h: 0 },
};

export function stampPlate(
  map: CityMap, pattern: PlatePattern, slot: number, feature: PlateFeature, rng: Rng,
): void {
  const sx = (slot % map.slotsX) * PLATE;
  const sy = Math.floor(slot / map.slotsX) * PLATE;
  for (let y = 0; y < PLATE; y++) {
    for (let x = 0; x < PLATE; x++) {
      const spec = CHAR_TO_CELL[pattern.rows[y][x]];
      const cell = (sy + y) * map.w + (sx + x);
      map.cells[cell] = spec.t;
      map.heights[cell] = spec.h;
    }
  }
  // Temple Heights: raise a handful of ordinary blocks into perches.
  if (feature === 'highground') {
    let raised = 0;
    for (let tries = 0; tries < 60 && raised < 6; tries++) {
      const x = sx + rng.int(1, PLATE - 2);
      const y = sy + rng.int(1, PLATE - 2);
      const cell = y * map.w + x;
      if (map.cells[cell] === CellType.Block && map.heights[cell] === 1) {
        map.heights[cell] = rng.next() < 0.4 ? 3 : 2;
        raised++;
      }
    }
  }
  map.slots[slot] = { pattern, feature, slot };
}

/** Seal unwanted mouths of a pattern (closed edges become wall; the stub street stays as an alley). */
function sealPorts(pattern: PlatePattern, keep: Array<'n' | 's' | 'e' | 'w'>): PlatePattern {
  const rows = pattern.rows.map((r) => r.split(''));
  const ports = { n: false, s: false, e: false, w: false };
  for (const edge of ['n', 's', 'e', 'w'] as const) {
    if (!pattern.ports[edge]) continue;
    if (keep.includes(edge)) {
      ports[edge] = true;
      continue;
    }
    if (edge === 'n') { rows[0][4] = '#'; rows[0][5] = '#'; }
    if (edge === 's') { rows[9][4] = '#'; rows[9][5] = '#'; }
    if (edge === 'w') { rows[4][0] = '#'; rows[5][0] = '#'; }
    if (edge === 'e') { rows[4][9] = '#'; rows[5][9] = '#'; }
  }
  return { id: `${pattern.id}-sealed`, rows: rows.map((r) => r.join('')), ports };
}

/**
 * The starting layout, roguelite-style:
 * - The crash plate keeps exactly `entrances` openings (difficulty dial; 1 is baseline).
 * - Beyond EVERY opening, a two-opening connector district is pre-placed, so the
 *   hive marches through a full district of your guns before it reaches home.
 */
export function createBoard(
  slotsX: number, slotsY: number, startSlot: number, rng: Rng, entrances = 1, crash = 0,
): CityMap {
  const w = slotsX * PLATE;
  const h = slotsY * PLATE;
  const map: CityMap = {
    w, h, slotsX, slotsY,
    cells: new Array<CellType>(w * h).fill(CellType.Void),
    heights: new Uint8Array(w * h),
    plinths: new Uint8Array(w * h),
    slots: new Array<PlateInstance | null>(slotsX * slotsY).fill(null),
    coreCell: 0,
  };
  // Choose which crash-plaza openings stay, preferring edges with room for a connector.
  const edges: Array<'n' | 's' | 'e' | 'w'> = ['n', 's', 'e', 'w'];
  for (let i = edges.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }
  const open: Array<'n' | 's' | 'e' | 'w'> = [];
  for (const e of edges) {
    if (open.length >= Math.max(1, Math.min(3, entrances))) break;
    if (neighborSlotPub(map, startSlot, e) !== null) open.push(e);
  }
  // Which crash site (content/plates.ts START_PLATES): every run used to start on the same one.
  stampPlate(map, sealPorts(START_PLATES[Math.abs(crash | 0) % START_PLATES.length], open), startSlot, 'plain', rng);
  const sx = (startSlot % slotsX) * PLATE;
  const sy = Math.floor(startSlot / slotsX) * PLATE;
  map.coreCell = (sy + 5) * w + (sx + 5); // center of the crash plaza

  // Pre-place one connector district beyond each opening.
  const pool = platePool().filter((p) => !DRAFT_ONLY.has(p.id.replace(/-\d$/, ''))).filter((p) => {
    const n = (p.ports.n ? 1 : 0) + (p.ports.s ? 1 : 0) + (p.ports.e ? 1 : 0) + (p.ports.w ? 1 : 0);
    return n === 2;
  });
  for (const e of open) {
    const slot = neighborSlotPub(map, startSlot, e)!;
    const need = OPPOSITE[e];
    const usable = pool.filter((p) => p.ports[need] && canPlace(map, p, slot) === null);
    const pick = usable.length > 0 ? usable[rng.int(0, usable.length - 1)] : null;
    if (pick) stampPlate(map, pick, slot, 'plain', rng);
  }
  return map;
}

/** Which slot a cell belongs to. */
export function slotOfCell(map: CityMap, cell: number): number {
  const x = cell % map.w;
  const y = Math.floor(cell / map.w);
  return Math.floor(y / PLATE) * map.slotsX + Math.floor(x / PLATE);
}

/** Port cell (the index-4 mouth cell) of a slot edge, in board coordinates. */
function portCell(map: CityMap, slot: number, edge: 'n' | 's' | 'e' | 'w'): number {
  const sx = (slot % map.slotsX) * PLATE;
  const sy = Math.floor(slot / map.slotsX) * PLATE;
  if (edge === 'n') return sy * map.w + (sx + 4);
  if (edge === 's') return (sy + PLATE - 1) * map.w + (sx + 4);
  if (edge === 'w') return (sy + 4) * map.w + sx;
  return (sy + 4) * map.w + (sx + PLATE - 1);
}

const EDGES: Array<'n' | 's' | 'e' | 'w'> = ['n', 's', 'e', 'w'];

export function neighborSlotPub(map: CityMap, slot: number, edge: 'n' | 's' | 'e' | 'w'): number | null {
  return neighborSlot(map, slot, edge);
}

function neighborSlot(map: CityMap, slot: number, edge: 'n' | 's' | 'e' | 'w'): number | null {
  const sx = slot % map.slotsX;
  const sy = Math.floor(slot / map.slotsX);
  const nx = sx + (edge === 'e' ? 1 : edge === 'w' ? -1 : 0);
  const ny = sy + (edge === 's' ? 1 : edge === 'n' ? -1 : 0);
  if (nx < 0 || ny < 0 || nx >= map.slotsX || ny >= map.slotsY) return null;
  return ny * map.slotsX + nx;
}

const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' } as const;

/**
 * THE CONNECTION ALGEBRA (openings mate with openings, walls with walls):
 * a placement is legal iff, on every edge that faces an ACTIVE plate, the two
 * plates agree — opening-to-opening or wall-to-wall. An opening facing empty
 * city or the board edge is fine (it becomes a frontier gate). At least one
 * edge must be a real opening-to-opening connection to the network.
 * Returns null when legal, else the reason.
 */
export function canPlace(map: CityMap, pattern: PlatePattern, slot: number): string | null {
  if (map.slots[slot] !== null) return 'slot occupied';
  let connections = 0;
  for (const edge of EDGES) {
    const nb = neighborSlot(map, slot, edge);
    if (nb === null || map.slots[nb] === null) continue; // empty or off-board: fine
    const mine = pattern.ports[edge];
    const theirs = map.slots[nb]!.pattern.ports[OPPOSITE[edge]];
    if (mine && !theirs) return `opening on ${edge} would be walled off`;
    if (!mine && theirs) return `would wall off the neighbor's opening on ${edge}`;
    if (mine && theirs) connections++;
  }
  return connections > 0 ? null : 'no connection to the network';
}

/**
 * Live gates: ports of active plates that face the void (or the board edge).
 * This is the frontier — the hive attacks from the city you have not eaten yet.
 */
export function frontierGates(map: CityMap): number[] {
  const gates: number[] = [];
  for (let slot = 0; slot < map.slots.length; slot++) {
    const inst = map.slots[slot];
    if (!inst) continue;
    for (const edge of EDGES) {
      if (!inst.pattern.ports[edge]) continue;
      const nb = neighborSlot(map, slot, edge);
      if (nb === null || map.slots[nb] === null) gates.push(portCell(map, slot, edge));
    }
  }
  return gates;
}

/**
 * Draft offers: EXHAUSTIVE enumeration of every legal (pattern, slot) pair
 * under the connection algebra, then a seeded shuffle — if a legal placement
 * exists anywhere, it is always offerable. Prefers distinct slots so the
 * choice is usually about WHERE to grow, not only what shape.
 */
export function draftOffers(map: CityMap, rng: Rng, count: number): DraftOffer[] {
  const features: PlateFeature[] = ['plain', 'science', 'meat', 'highground'];
  const legal = legalDrafts(map);
  for (let i = legal.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [legal[i], legal[j]] = [legal[j], legal[i]];
  }
  const options: DraftOffer[] = [];
  // First pass: distinct slots. Second pass: fill remaining from anywhere.
  for (const cand of legal) {
    if (options.length >= count) break;
    if (options.some((o) => o.slot === cand.slot)) continue;
    options.push({ ...cand, feature: features[rng.int(0, features.length - 1)] });
  }
  for (const cand of legal) {
    if (options.length >= count) break;
    if (options.some((o) => o.slot === cand.slot && o.pattern.id === cand.pattern.id)) continue;
    options.push({ ...cand, feature: features[rng.int(0, features.length - 1)] });
  }
  return options;
}

/**
 * Every legal (pattern, slot) pair under the connection algebra, in a fixed order (no rng):
 * what a draft may offer. Empty with unclaimed city left = the body has walled itself in.
 */
export function legalDrafts(map: CityMap): Array<{ pattern: PlatePattern; slot: number }> {
  const pool = platePool();
  const currentGates = frontierGates(map).length;
  const legal: Array<{ pattern: PlatePattern; slot: number }> = [];
  for (let slot = 0; slot < map.slots.length; slot++) {
    if (map.slots[slot] !== null) continue;
    for (const pattern of pool) {
      if (canPlace(map, pattern, slot) !== null) continue;
      // The frontier must survive: a plate that bridges the last open gates
      // shut would leave the hive no way in (and the run no waves). Count
      // gates consumed by its connections vs gates its own openings add.
      let consumed = 0;
      let added = 0;
      for (const edge of EDGES) {
        const nb = neighborSlot(map, slot, edge);
        const nbActive = nb !== null && map.slots[nb] !== null;
        if (pattern.ports[edge]) {
          if (nbActive) consumed += 1; // mates with a former frontier port
          else added += 1;             // new frontier opening (empty or off-board)
        }
      }
      if (currentGates - consumed + added <= 0) continue;
      legal.push({ pattern, slot });
    }
  }
  return legal;
}

export { PLATE_FEATURES };
export type { PlateFeature, PlatePattern };

/**
 * Weighted flow field toward a target cell (Dijkstra over passable cells).
 * `extraCost` makes cells expensive without blocking them — a spine wall in
 * a single-lane channel is chewed through, not routed around.
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
    return Infinity;
  };
  const open: number[] = [target];
  dist[target] = 0;
  const inOpen = new Uint8Array(n);
  inOpen[target] = 1;
  while (open.length > 0) {
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

/** BFS hop-distance over all ACTIVE cells — the creep climbs blocks, never the void. */
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
      if (nb < 0 || dist[nb] !== -1 || map.cells[nb] === CellType.Void) continue;
      dist[nb] = dist[cur] + 1;
      q.push(nb);
    }
  }
  return dist;
}
