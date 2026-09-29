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
  const out = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (cells[start] !== block || out[start] >= 0) continue;
    const high = heights[start];
    const slot = Math.floor(Math.floor(start / w) / plate) * 1000 + Math.floor((start % w) / plate);
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
        if (Math.floor(ny / plate) * 1000 + Math.floor(nx / plate) !== slot) continue;
        out[n] = start;
        stack.push(n);
      }
    }
  }
  return out;
}

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
