/**
 * Tile sets: the same board in another kind of place (tools/art/biomes.mjs makes them,
 * public/art/manifest.json lists them under "biomes"). The body's own pieces (creep, core,
 * spore pods) and the smoke over the unclaimed city are the same in every set.
 */
export interface BiomeArt {
  name: string; territories: string[];
  /** What a roof is multiplied by at one, two and three levels: higher roofs catch more light. */
  roofTint: number[];
  /** Which props stand on the roofs of which kind of district. */
  roofProps: Record<string, string[]>;
  streetProps: string[];
  /** The file that lists its own floors, walls and props. null: it is drawn with the terrain entry's. */
  data: string | null;
  /**
   * How many looks it has of each piece: a second facade for a kind of wall, more roofs.
   * Absent: one of each. The sprites of look v > 0 are named with ~v after the name:
   * roof~1-02, wall-plain~1-south-0-3 (tools/art/biomes.mjs).
   */
  variants?: { walls?: Record<string, number>; roof?: number; street?: number; plaza?: number };
  /** Its three landmarks (tools/art/landmarks.mjs): one stands on the largest lot of every district. Absent: none. */
  landmarks?: string[];
  /** Other sets whose districts may be mixed into a board whose own set is this one. */
  guests?: string[];
}

/** The name of look `v` of a piece: the name itself for the first, name~v after. */
export const variantName = (name: string, v: number): string => (v > 0 ? `${name}~${v}` : name);

/** Which of `n` looks a thing with this number has: the same thing always has the same look. */
export function pickVariant(n: number, id: number): number {
  if (!(n > 1)) return 0;
  return ((Math.imul(id | 0, 2654435761) >>> 0) >>> 7) % Math.floor(n);
}

/**
 * Which BUILDING every cell of the board belongs to. A building is the block cells of one
 * height that touch each other inside one district: it has one facade and one roof, so that
 * a street of four buildings is four buildings and not one texture four times. Cells that
 * are not blocks have -1. The number of a building is the cell it was found from, so that
 * it is the same building, with the same look, when the board is built again.
 */
export function buildingsOf(
  cells: ArrayLike<number>, heights: ArrayLike<number>, w: number, h: number, block: number, plate: number,
): Int32Array {
  // A building is also one LOT of its district (lotOf): a district's blocks were one roof from street to
  // street, which made every city a tabletop of a few huge roofs (Oct 1 2026, "the cities felt samey").
  const slotOf = (x: number, y: number) => Math.floor(y / plate) * 1000 + Math.floor(x / plate);
  const lot = (x: number, y: number) => slotOf(x, y) * 100 + lotOf(x % plate, y % plate);
  const out = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (cells[start] !== block || out[start] >= 0) continue;
    const high = heights[start];
    const mine = lot(start % w, Math.floor(start / w));
    out[start] = start;
    stack.push(start);
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % w;
      const y = (c - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (cells[n] !== block || out[n] >= 0 || heights[n] !== high) continue;
        if (lot(nx, ny) !== mine) continue;
        out[n] = start;
        stack.push(n);
      }
    }
  }
  return out;
}

/**
 * The lots of a district: which lot a cell of a 10x10 district is in. The district is cut into three
 * bands of rows (0-2, 3-5, 6-9) and each band into lots of two to four cells, the cuts of each band
 * offset from the band above like courses of brick, so that no two districts' blocks line up into one
 * long roof. It depends only on the place in the district, so a district's preview has the same
 * buildings as the district on the board.
 */
const LOT_BANDS = [0, 3, 6];
const LOT_CUTS = [[0, 3, 6, 8], [0, 2, 5, 7], [0, 4, 6, 9]];
export function lotOf(lx: number, ly: number): number {
  const band = ly >= LOT_BANDS[2] ? 2 : ly >= LOT_BANDS[1] ? 1 : 0;
  const cuts = LOT_CUTS[band];
  let col = 0;
  while (col + 1 < cuts.length && lx >= cuts[col + 1]) col++;
  return band * 10 + col;
}

/**
 * A roof's tint as one lot of its block: a little lighter or darker than its neighbours (up to 7%
 * each way, by the building's number), so that lots of the same roof read as separate buildings.
 */
export function lotShade(tint: number, building: number): number {
  const k = 0.93 + (((Math.imul(building + 13, 2246822519) >>> 0) >>> 9) % 1000) / 1000 * 0.14;
  const ch = (s: number) => Math.min(255, Math.round(((tint >> s) & 255) * k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** How strongly the gutter between two lots of one height is drawn (the edge shade of a taller block is 1). */
export const LOT_GUTTER = 0.4;

/**
 * Which tile set a board is drawn with: the one asked for by name, or the one of the
 * territory being fought over, or (a skirmish) one chosen by the seed.
 */
export function pickBiome(
  m: { biomes?: Record<string, BiomeArt> },
  want: { biome?: string | null; territory?: string | null; seed?: number },
): string | null {
  const sets = m.biomes ?? {};
  const ids = Object.keys(sets).sort();
  if (!ids.length) return null;
  if (want.biome && sets[want.biome]) return want.biome;
  if (want.territory) {
    const home = ids.find((id) => sets[id].territories.includes(want.territory!));
    if (home) return home;
  }
  return ids[Math.abs(Math.floor(want.seed ?? 0)) % ids.length];
}

/**
 * WHICH DISTRICTS A GUEST SET TAKES (Sep 29 2026: a wetland board came out mostly in its guest's
 * look). The board is one place with other places at its edges: a guest takes at most one
 * district in four, never the district the body fell in, and never one next to it, so that
 * what is seen at the start is the board's own set. Which ones: by the seed, the same every time.
 */
export function planGuests(
  board: { slotsX: number; slotsY: number; start: number; seed: number }, guests: string[],
): Map<number, string> {
  const out = new Map<number, string>();
  if (!guests.length) return out;
  const sx = board.slotsX;
  const total = sx * board.slotsY;
  const near = (slot: number) => Math.max(Math.abs((slot % sx) - (board.start % sx)), Math.abs(Math.floor(slot / sx) - Math.floor(board.start / sx))) <= 1;
  const hash = (slot: number) => (Math.imul(slot + 1, 2654435761) ^ Math.imul(board.seed + 7, 40503)) >>> 0;
  const open = Array.from({ length: total }, (_, i) => i).filter((i) => !near(i)).sort((a, b) => hash(a) - hash(b));
  open.slice(0, Math.min(open.length, Math.floor(total / 4))).forEach((slot) => out.set(slot, guests[hash(slot) % guests.length]));
  return out;
}
