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
