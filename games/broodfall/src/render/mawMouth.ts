/**
 * THE INSIDE OF THE MAW'S MOUTH (Oct 1 2026), for its tongue (src/render/mawTongue.ts). Collins: "the
 * tongue of the maw appears to start out of nowhere (e.g. it does not look like it is coming from inside
 * its mouth but appearing in front of it)".
 *
 * Marked by eye on each frame of its firing clip seen from the front (public/art/limbs/maw.webp, the fire
 * clip's own frames 0-13; tools/art/limbs.mjs), in shares of the frame like its muzzle:
 *
 *   throat  the back of its throat, the dark of the gullet behind the tongue lying on the floor of its
 *           mouth: where the tongue grows from.
 *   gape    the opening of its mouth, along the tips of its teeth: what is inside it is seen through it,
 *           and what is drawn inside the mouth is cut to it, so that its lips, its lower teeth and its jaw
 *           are in front of the tongue's root and of a body reeled in behind the teeth.
 *
 * Frame 0 and frames 6-13 are shut (the gulp, the settling): nothing inside the mouth is seen then.
 * Frame 1 is half open. Seen from behind there is no gape: the mouth is on the far side of its body,
 * and the tongue is drawn behind the body (it rises from behind the top of the rump).
 */
export interface MouthFrame { throat: [number, number]; gape: Array<[number, number]> }

export const MAW_MOUTH_FRONT: Record<number, MouthFrame> = {
  1: { throat: [0.43, 0.43], gape: [[0.30, 0.36], [0.32, 0.30], [0.36, 0.28], [0.40, 0.29], [0.44, 0.32], [0.48, 0.37], [0.50, 0.42], [0.525, 0.46], [0.53, 0.52], [0.51, 0.555], [0.47, 0.585], [0.42, 0.60], [0.36, 0.605], [0.31, 0.59], [0.295, 0.56], [0.29, 0.51], [0.295, 0.47]] },
  2: { throat: [0.44, 0.43], gape: [[0.34, 0.34], [0.365, 0.275], [0.42, 0.245], [0.48, 0.27], [0.52, 0.32], [0.55, 0.38], [0.565, 0.43], [0.57, 0.50], [0.56, 0.555], [0.54, 0.585], [0.505, 0.615], [0.45, 0.635], [0.38, 0.635], [0.325, 0.615], [0.30, 0.575], [0.295, 0.52], [0.30, 0.48], [0.31, 0.40]] },
  3: { throat: [0.44, 0.43], gape: [[0.355, 0.33], [0.37, 0.275], [0.42, 0.24], [0.48, 0.26], [0.52, 0.31], [0.55, 0.37], [0.565, 0.42], [0.57, 0.49], [0.56, 0.55], [0.54, 0.585], [0.515, 0.61], [0.45, 0.635], [0.38, 0.64], [0.33, 0.615], [0.305, 0.575], [0.30, 0.52], [0.31, 0.48], [0.33, 0.40]] },
  4: { throat: [0.43, 0.43], gape: [[0.32, 0.36], [0.33, 0.30], [0.36, 0.265], [0.41, 0.245], [0.46, 0.26], [0.50, 0.30], [0.53, 0.36], [0.545, 0.40], [0.555, 0.45], [0.555, 0.52], [0.535, 0.575], [0.50, 0.605], [0.44, 0.625], [0.38, 0.63], [0.33, 0.62], [0.30, 0.59], [0.29, 0.545], [0.30, 0.50], [0.31, 0.44]] },
  5: { throat: [0.45, 0.43], gape: [[0.33, 0.36], [0.35, 0.29], [0.39, 0.26], [0.44, 0.255], [0.49, 0.28], [0.53, 0.33], [0.555, 0.40], [0.565, 0.46], [0.565, 0.52], [0.55, 0.565], [0.52, 0.60], [0.46, 0.625], [0.39, 0.63], [0.335, 0.615], [0.305, 0.585], [0.30, 0.54], [0.31, 0.50], [0.32, 0.43]] },
};

/** A shut frame's throat (where the tongue is drawn from while the mouth is shut, unseen): the wide-open one's. */
const SHUT_THROAT = MAW_MOUTH_FRONT[3].throat;

/**
 * The mouth on frame `frame` of the firing clip from the front: its throat, and its gape (empty: shut).
 * Null when it is not playing its firing clip (nothing is known of its mouth: the tongue is drawn as before).
 */
export function mawMouthFrame(frame: number | undefined): MouthFrame | null {
  if (frame === undefined || frame < 0) return null;
  return MAW_MOUTH_FRONT[frame] ?? { throat: SHUT_THROAT, gape: [] };
}
