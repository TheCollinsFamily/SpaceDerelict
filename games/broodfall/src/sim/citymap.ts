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
  /** The seed the land under the city is shaped from (terrainLevel). Absent on old boards: one is made from the board. */
  terrainSeed?: number;
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
  // Temple Heights used to raise a handful of single blocks at random. Its dice are still thrown the same way
  // (so every later roll of the run falls as before), but the land is now shaped by settleTerrain below: the
  // district gets a real hill instead.
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
  settleTerrain(map, sx, sy, feature);
  map.slots[slot] = { pattern, feature, slot };
}

// ---------------------------------------------------------------------------------------------------------------
// THE LIE OF THE LAND (Oct 2 2026). Collins: "the point of terrain height in tower defence is to get lucky that you
// can fit our cool larger powerful building at a higher height, but if terrain does not move together like it
// naturally does, those never appear. So it should be rare for terrain to jump up without going up a bit first, or
// for a high piece of terrain to be in total isolation." Before this, a district's height came from its pattern's
// letters (single 'A' and 'B' blocks dotted among low ones): on twenty boards no limb bigger than one cell ever
// stood above the ground floor, a board had about sixteen lone peaks, and one neighbour in nine jumped two storeys.
//
// Now the land is ONE smooth field over the whole board: hills of different size and height placed on a coarse
// grid (from the board's own terrain seed, its own dice: nothing else in the run is reshuffled), summed and cut
// into storeys 1-3. A district's blocks take the land under them, so neighbouring districts meet at the same
// heights. Then the district's new blocks are settled against their neighbours: no step of more than one storey,
// no lone peak. High ground comes as plateaus, sometimes big enough for a 2x2, a T or an L up high: the lucky find.
// ---------------------------------------------------------------------------------------------------------------

/** The highest storey the land gives (plinths the body grows can add one more: PLINTH_MAX_HEIGHT). */
export const TERRAIN_MAX = 3;
/** Hills are placed one (or none) per square of this many cells. */
const HILL_GRID = 7;

/** A hash of three integers to [0, 1): the land's own dice. */
function hash3(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x61c88647)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function terrainSeedOf(map: CityMap): number {
  return map.terrainSeed ?? ((Math.imul(map.w * 131 + map.h, 0x9e3779b1) ^ 0x5a1d) >>> 0);
}

/** The land's height (in storeys above the ground floor, before it is cut into levels) at a board cell. */
export function terrainField(seed: number, x: number, y: number): number {
  const gx0 = Math.floor(x / HILL_GRID);
  const gy0 = Math.floor(y / HILL_GRID);
  let f = 0;
  for (let gy = gy0 - 1; gy <= gy0 + 1; gy++) {
    for (let gx = gx0 - 1; gx <= gx0 + 1; gx++) {
      // Not every square has a hill: some of the city is flat.
      if (hash3(seed, gx, gy) > 0.6) continue;
      const cx = (gx + 0.15 + 0.7 * hash3(seed + 1, gx, gy)) * HILL_GRID;
      const cy = (gy + 0.15 + 0.7 * hash3(seed + 2, gx, gy)) * HILL_GRID;
      // A low rise, a hill, or (now and then) a high plateau: height in storeys, and how far it spreads.
      const amp = 0.55 + 1.15 * hash3(seed + 3, gx, gy);
      const sigma = 1.9 + 1.7 * hash3(seed + 4, gx, gy);
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      // A flattened bell: a plateau on top rather than a needle, so a big limb can stand up there.
      const bell = Math.exp(-d2 / (2 * sigma * sigma));
      f += amp * Math.min(1, bell * 1.35);
    }
  }
  return f;
}

/** The storey (1-3) the land gives a block at this cell. `bonus` lifts a district (Temple Heights). */
export function terrainLevel(seed: number, x: number, y: number, bonus = 0): number {
  return Math.max(1, Math.min(TERRAIN_MAX, 1 + Math.floor(terrainField(seed, x, y) + bonus)));
}

/**
 * Give a freshly stamped district's blocks the land under them, then settle them against every block around them
 * (old districts included, which are never moved: limbs may stand there): no neighbour more than one storey apart,
 * no block higher than all its block neighbours.
 */
function settleTerrain(map: CityMap, sx: number, sy: number, feature: PlateFeature): void {
  const seed = terrainSeedOf(map);
  const fresh: number[] = [];
  for (let y = sy; y < sy + PLATE; y++) {
    for (let x = sx; x < sx + PLATE; x++) {
      const cell = y * map.w + x;
      if (map.cells[cell] !== CellType.Block) continue;
      // Temple Heights: a real hill in the middle of the district (tall architecture on high ground).
      let bonus = 0;
      if (feature === 'highground') {
        const dx = x - (sx + 4.5);
        const dy = y - (sy + 4.5);
        bonus = 1.6 * Math.min(1, 1.4 * Math.exp(-(dx * dx + dy * dy) / (2 * 3.2 * 3.2)));
      }
      map.heights[cell] = terrainLevel(seed, x, y, bonus);
      map.plinths[cell] = 0;
      fresh.push(cell);
    }
  }
  const isFresh = new Set(fresh);
  const block = (x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h && map.cells[y * map.w + x] === CellType.Block;
  const ground = (c: number) => map.heights[c] - map.plinths[c];
  // 1. No step of more than one storey: a fresh block moves one storey toward any neighbour it is too far from.
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const c of fresh) {
      const x = c % map.w;
      const y = Math.floor(c / map.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!block(x + dx, y + dy)) continue;
        const n = (y + dy) * map.w + x + dx;
        const gap = map.heights[c] - ground(n);
        if (gap > 1) { map.heights[c]--; moved = true; } else if (gap < -1 && !isFresh.has(n)) { map.heights[c]++; moved = true; }
      }
    }
    if (!moved) break;
  }
  // 2. No lone peak: a fresh block standing above every block around it (with at least two of them) comes down
  //    to the highest of them. High ground comes in plateaus.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const c of fresh) {
      if (map.heights[c] <= 1) continue;
      const x = c % map.w;
      const y = Math.floor(c / map.w);
      let nb = 0;
      let top = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && block(x + dx, y + dy)) { nb++; top = Math.max(top, ground((y + dy) * map.w + x + dx)); }
        }
      }
      if (nb >= 2 && top < map.heights[c]) { map.heights[c] = Math.max(1, top); moved = true; }
    }
    if (!moved) break;
  }
}

/**
 * The heights a district WOULD take if it were drafted here now (the draft card's picture shows the land it
 * will really stand on). Pattern cells that are not blocks are 0.
 */
export function draftHeights(map: CityMap, pattern: PlatePattern, slot: number, feature: PlateFeature): number[] {
  const m: CityMap = { ...map, cells: map.cells.slice(), heights: map.heights.slice(), plinths: map.plinths.slice(), slots: map.slots.slice() };
  const sx = (slot % map.slotsX) * PLATE;
  const sy = Math.floor(slot / map.slotsX) * PLATE;
  for (let y = 0; y < PLATE; y++) {
    for (let x = 0; x < PLATE; x++) {
      const spec = CHAR_TO_CELL[pattern.rows[y][x]];
      const cell = (sy + y) * map.w + (sx + x);
      m.cells[cell] = spec.t;
      m.heights[cell] = spec.h;
    }
  }
  settleTerrain(m, sx, sy, feature);
  const out: number[] = [];
  for (let y = 0; y < PLATE; y++) for (let x = 0; x < PLATE; x++) {
    const cell = (sy + y) * map.w + (sx + x);
    out.push(m.cells[cell] === CellType.Block ? m.heights[cell] : 0);
  }
  return out;
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
  slotsX: number, slotsY: number, startSlot: number, rng: Rng, entrances = 1, crash = 0, terrainSeed?: number,
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
    // A board made without one (tests, tools) still gets a land of its own, the same on every call.
    terrainSeed: terrainSeed ?? ((Math.imul((crash | 0) + 7, 0x9e3779b1) ^ Math.imul(startSlot + 1, 0x85ebca6b)) >>> 0),
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
/**
 * A SHELTER's site in a district (Collins, Oct 2 2026: "these need to be somewhere an Infestor can get to them"; "the
 * lane around the shelter will need to be a bit wider than usual, with at least one open space on either side of it";
 * the ground under it at one height). A 2x2 of building inside the district, with:
 *   - an APRON: every cell of the ring round it open street (blocks there are carved to street), and a second row of
 *     street in front of its DOOR side (room for an Infestor and its escort to stand and burrow);
 *   - the whole of it inside the district's border cells, so the district's edges (its mouths) are untouched and the
 *     pieces still line up;
 *   - its door reachable from the core along the streets once carved (the swarm and your units get all the way round).
 * The lot is levelled to `SHELTER_LEVEL` storeys. Returns null when no 2x2 of the district can be one.
 */
export const SHELTER_LEVEL = 2;
export interface ShelterSite { cells: number[]; door: number; carve: number[] }

export function shelterSite(map: CityMap, slot: number): ShelterSite | null {
  const w = map.w;
  const sx = (slot % map.slotsX) * PLATE;
  const sy = Math.floor(slot / map.slotsX) * PLATE;
  const inner = (x: number, y: number) => x >= sx + 1 && x <= sx + PLATE - 2 && y >= sy + 1 && y <= sy + PLATE - 2;
  const at = (x: number, y: number) => y * w + x;
  const coreX = map.coreCell % w;
  const coreY = Math.floor(map.coreCell / w);
  let best: (ShelterSite & { score: number }) | null = null;
  for (let y = sy + 2; y <= sy + PLATE - 4; y++) {
    for (let x = sx + 2; x <= sx + PLATE - 4; x++) {
      const lot = [at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)];
      if (lot.some((c) => map.cells[c] !== CellType.Block || c === map.coreCell)) continue;
      const ring: number[] = [];
      for (let yy = y - 1; yy <= y + 2; yy++) for (let xx = x - 1; xx <= x + 2; xx++) {
        if (xx >= x && xx <= x + 1 && yy >= y && yy <= y + 1) continue;
        ring.push(at(xx, yy));
      }
      // The door side: the one facing the core most, whose second row in front still lies inside the district.
      const sides = [
        { dx: 0, dy: -1, door: at(x, y - 1), front: [at(x, y - 2), at(x + 1, y - 2)], ok: inner(x, y - 2) },
        { dx: 0, dy: 1, door: at(x, y + 2), front: [at(x, y + 3), at(x + 1, y + 3)], ok: inner(x, y + 3) },
        { dx: -1, dy: 0, door: at(x - 1, y), front: [at(x - 2, y), at(x - 2, y + 1)], ok: inner(x - 2, y) },
        { dx: 1, dy: 0, door: at(x + 2, y), front: [at(x + 3, y), at(x + 3, y + 1)], ok: inner(x + 3, y) },
      ].filter((s) => s.ok)
        .sort((a, b) => ((coreX - x - 0.5) * b.dx + (coreY - y - 0.5) * b.dy) - ((coreX - x - 0.5) * a.dx + (coreY - y - 0.5) * a.dy));
      for (const side of sides) {
        const open = [...ring, ...side.front];
        const carve = open.filter((c) => map.cells[c] === CellType.Block);
        // Try it on a copy: carved, levelled, is the door reachable from the core along the streets?
        const cells = map.cells.slice();
        for (const c of carve) cells[c] = CellType.Road;
        const reach = computeFlow({ ...map, cells }, map.coreCell, () => 0);
        if (!Number.isFinite(reach.dist[side.door])) continue;
        const score = carve.length + 2 * Math.hypot(x + 0.5 - (sx + PLATE / 2 - 0.5), y + 0.5 - (sy + PLATE / 2 - 0.5));
        if (!best || score < best.score) best = { cells: lot, door: side.door, carve, score };
        break;
      }
    }
  }
  return best ? { cells: best.cells, door: best.door, carve: best.carve } : null;
}

/** Carve a shelter's apron and level its lot (shelterSite). */
export function carveShelter(map: CityMap, site: ShelterSite): void {
  for (const c of site.carve) { map.cells[c] = CellType.Road; map.heights[c] = 0; map.plinths[c] = 0; }
  for (const c of site.cells) { map.cells[c] = CellType.Block; map.heights[c] = SHELTER_LEVEL; map.plinths[c] = 0; }
}

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
