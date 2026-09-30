/**
 * WHEN AND WHERE A THROWING LIMB LETS GO (Sep 30 2026 fix pass: the Bile Lobber's glob and the Spore Sling's
 * clot left from the RESTING pose as the firing clip began, while the arm was still to swing). Render only:
 * the sim throws when it throws and the glob lands when the sim says; the picture of it is held in the cup
 * until the clip reaches the frame where the arm lets go, and then leaves from there.
 *
 * Marked by eye, like the muzzles (tools/art/muzzles.mjs shows the clip at fifths; each baked frame of the
 * firing clip was then read over a grid of twentieths of the frame): `frame` is the first frame of the baked
 * firing clip (0-based) in which the glob or clot is no longer in the cup; `at` is where it is let go, as
 * shares of the baked frame (the units of the manifest's `muzzle`), between where the cup last held it and
 * where the cup is in that frame.
 *   lobber front: rest with the glob (frames 0-1), the head whips forward and down-left, mouth open, the
 *     bile spraying out (2). back: the head rears up and to the right with the glob (2), thrusts forward,
 *     empty, bile dripping (3).
 *   sling front: rest with the clot (0), the basket swung up over the top, tipped open (1), slammed down
 *     low in front (2). back: the arm swings up to the right with the clot in its basket (2), forward and
 *     empty (3).
 */
export interface Release { frame: number; at: [number, number] }
export const RELEASE: Record<string, { front: Release; back?: Release }> = {
  lobber: { front: { frame: 2, at: [0.3, 0.37] }, back: { frame: 3, at: [0.78, 0.32] } },
  sling: { front: { frame: 1, at: [0.39, 0.26] }, back: { frame: 3, at: [0.92, 0.28] } },
};

/**
 * The wind-up (the frames before the one that lets go) is played in at most this many seconds: the clip is
 * fitted into the time before the limb throws again (several seconds), and at that pace the arm would still be
 * winding up when the glob, which flies for about a second, had landed.
 */
export const WIND_UP = 0.24;

/** Seconds into a firing clip of `dur` seconds and `count` frames at which the limb lets go. */
export function releaseTime(dur: number, count: number, frame: number): number {
  return Math.min(WIND_UP, (frame / count) * dur);
}

/** The frame of a firing clip to show `t` seconds in: the wind-up quickly, the rest over what is left. */
export function releaseFrame(t: number, dur: number, count: number, frame: number): number {
  const r = releaseTime(dur, count, frame);
  if (t < r) return Math.min(frame - 1, Math.floor((t / r) * frame));
  const rest = Math.max(1e-6, dur - r);
  return Math.min(count - 1, frame + Math.floor(((t - r) / rest) * (count - frame)));
}
