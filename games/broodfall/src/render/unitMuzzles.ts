/**
 * WHERE A HIVE GUN'S SHELL LEAVES IT (Sep 30 2026): the cannon's and the dart battery's barrel,
 * the mortar's tube. Marked BY EYE, like a limb's muzzle (tools/art/limbs.mjs), on the baked
 * frames themselves: `node tools/art/muzzles.mjs --units` draws each clip's first frame with a
 * grid of tenths of its frame and the marks below (cyan); read the grid, write the point here.
 *
 * [x, y] as shares of the frame of the clip drawn when it fires, by that clip:
 * - braced: the braced shot (drawn once, toward the lower left: mirrored when the unit faces right)
 * - deployed: the braced picture it holds between shots
 * - attack: its attack clip, one point per drawn view (the other three views are these mirrored)
 * A clip with no mark falls back to the mark of the same view in another clip (attack, braced, deployed), then to the old fixed height.
 * The JSON between the two lines is read by the helper too: keep it plain JSON.
 */
export type UnitMuzzleMarks = Record<string, Partial<Record<'braced' | 'deployed' | 'attack' | 'walk', Partial<Record<'S' | 'SW' | 'W' | 'NW' | 'N', [number, number]>>>>>;

// --- marks ---
export const UNIT_MUZZLES: UnitMuzzleMarks = {
  "cannon": { "braced": { "SW": [0.41, 0.25] }, "deployed": { "SW": [0.48, 0.26] } },
  "dartgun": { "braced": { "SW": [0.58, 0.24] }, "deployed": { "SW": [0.57, 0.26] } },
  "mortar": { "attack": { "S": [0.46, 0.41], "SW": [0.43, 0.41], "W": [0.41, 0.45], "NW": [0.6, 0.4], "N": [0.575, 0.41] } }
};
// --- end of marks ---
