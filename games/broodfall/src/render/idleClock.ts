/**
 * THE IDLES' CLOCK (Sep 30 2026, notes/screens/2026-09-30/anim-README.md). How a looping idle
 * (a limb's, the core's) is played, apart from the game's clock:
 *
 *   - it runs on REAL time: a paused game still freezes it, but at 3x or 8x it plays at most
 *     IDLE_MAX_RATE times its art's speed (it played 3 to 8 times faster, and a buff multiplied that);
 *   - each limb starts at its own phase, drawn from its id (a family used to pulse in step);
 *   - it is drawn as two frames, the next laid over this one by how far between them the clock is
 *     (a cross-fade: no stop-motion step between frames);
 *   - a clip baked `pingpong` (tools/art/templates/limb.mjs: an idle that drifts one way and has no
 *     loop in it) plays forward and back, eased at its ends so it breathes out and in, not bounces;
 *   - a clip baked `breathe` (it barely moves: under 3% of it changes per step) swells a little
 *     about its foot.
 */

/** A clip as the manifest gives it (src/render/art.ts Clip). */
export interface IdleClip { start: number; count: number; fps: number; pingpong?: boolean; breathe?: boolean }

/** How much faster than its art an idle may play when the game runs fast. */
export const IDLE_MAX_RATE = 1.5;
/** A ping-pong is played this much slower than its frames' own rate: its easing runs its middle faster (by pi/2 at the peak). */
export const PONG_SLOW = 1.3;

/** Seconds of idle time a frame adds: none while paused, real time at 1x and slower, at most IDLE_MAX_RATE times real time above. */
export function idleStep(dtSim: number, dtReal: number): number {
  if (dtSim <= 0 || dtReal <= 0) return 0;
  return Math.min(dtSim, dtReal * IDLE_MAX_RATE, 0.25);
}

/** A phase in [0, 1) that is the same for the same id every time (a limb's start in its loop). */
export function phaseOf(id: number): number {
  let h = (Math.imul(id | 0, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The loop's length in seconds (a ping-pong's there and back). */
export function idleLength(clip: IdleClip): number {
  if (clip.pingpong && clip.count > 1) return (2 * (clip.count - 1) / clip.fps) * PONG_SLOW;
  return clip.count / clip.fps;
}

/**
 * The two frames to draw at idle time `t` (seconds) and phase `phase` (0-1): `a` under, `b` over
 * it at alpha `f`. Both are atlas indices (the clip's start added).
 */
export function idleFrames(clip: IdleClip, t: number, phase = 0): { a: number; b: number; f: number } {
  const n = Math.max(1, clip.count);
  if (n === 1) return { a: clip.start, b: clip.start, f: 0 };
  const u = (((t / idleLength(clip) + phase) % 1) + 1) % 1;
  if (clip.pingpong) {
    const pos = (n - 1) * (0.5 - 0.5 * Math.cos(2 * Math.PI * u));
    const i = Math.min(n - 1, Math.floor(pos));
    return { a: clip.start + i, b: clip.start + Math.min(n - 1, i + 1), f: pos - i };
  }
  const pos = u * n;
  const i = Math.floor(pos) % n;
  return { a: clip.start + i, b: clip.start + ((i + 1) % n), f: pos - Math.floor(pos) };
}

/** A near-still idle's breathing: [x, y] scale about its foot at idle time `t`, 1% taller and 0.5% narrower at the top of a breath. */
export function breath(t: number, phase = 0): [number, number] {
  const s = Math.sin(2 * Math.PI * (t / 3.4 + phase));
  return [1 - 0.005 * s, 1 + 0.011 * s];
}
