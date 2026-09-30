/**
 * THE MAW'S TONGUE (Sep 30 2026), for the isometric board. Collins: "the frog like tongue design thats
 * brilliant", and "but you need the unit to stick to it and go to the mouth".
 *
 * The Maw is a toad crouched at the edge of its roof (tools/art/limbs.mjs). Each time it strikes (its
 * cooldown winds up again), a tongue shoots from its mouth (the `muzzle` marked on its art) along an arc
 * that rises from the mouth and comes down on its target in the street:
 *
 *   OUT    0.20 s  the tongue unrolls to the target
 *   STUCK  0.10 s  its sticky tip holds the body
 *   REEL   0.45 s  it reels in along the same arc; an EATEN body rides the tip, lifted over the block,
 *                  wobbling, facing the mouth in its flinch, and shrinks as it reaches the lips
 *   GULP   0.25 s  the mouth shuts on it (the tail of the Maw's firing clip) and it is gone
 *
 * all inside the Maw's 1.25 s between strikes. A strike that does not eat slaps the body and snaps back.
 *
 * The sim decides who is eaten (a body at or under the Maw's eat threshold leaves `sim.enemies` in the
 * same tick with hp left): this only draws it. A unit that is gone while a tongue is aimed at it is
 * handed here by the board (src/render/isoRender.ts) instead of being destroyed, so that it never
 * simply vanishes in the street.
 *
 * Draw order: from the front, the tongue and its rider are drawn over the Maw and over the body; seen
 * from behind, just behind the Maw's body (the tongue leaves a mouth the camera cannot see).
 */
import { Container, MeshRope, Point, RopeGeometry, Sprite } from 'pixi.js';
import type { BoardArtSet } from './art';

interface Pt { x: number; y: number }

export const OUT = 0.2;
export const STUCK = 0.1;
export const REEL = 0.45;
export const GULP = 0.25;
/** A strike that only hits: the slap holds this long, and the tongue snaps back this fast. */
const SLAP = 0.08;
const SNAP = 0.22;
/** How many points each length of tongue is laid along, and how many lengths at most. */
const PTS = 8;
const MAX_LENGTHS = 6;

/** Where the board says a Maw's mouth is now, how big the Maw is drawn, whether it is seen from behind, its depth. */
export interface MouthNow { x: number; y: number; size: number; back: boolean; z: number }
/** Where a living target is now: the point of its body the tip sticks to, and its depth. */
export interface BodyNow { x: number; y: number; z: number }

export interface TongueView {
  mouth(towerId: number): MouthNow | null;
  body(unitId: number): BodyNow | null;
}

interface Rider {
  sprite: Sprite;
  /** Its size and facing when it was taken. */
  sx: number; sy: number;
  /** From the point the tip holds to its feet (board px): the sprite is drawn this far below the tip. */
  up: number;
}

interface Lick {
  towerId: number; targetId: number; t: number;
  /** Where the tip last found its target (the body, or where it was when it was eaten). */
  aim: Pt; aimZ: number;
  /** The mouth, as last seen (a Maw that dies mid-lick keeps its tongue where it was). */
  mouth: MouthNow | null;
  rider: Rider | null;
  /** Its tongue, in lengths of the strip, and its sticky tip; `phase` keeps two Maws' wobbles apart. */
  lengths: MeshRope[]; tip: Sprite; phase: number;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

export class MawTongues {
  private licks: Lick[] = [];

  constructor(private art: BoardArtSet, private layer: Container) {}

  ready(): boolean {
    return this.art.fxSprite('tongue', 'strip') !== null && this.art.fxSprite('tongue', 'tip') !== null;
  }

  reset(): void {
    for (const l of this.licks) this.destroy(l, true);
    this.licks = [];
  }

  /** A Maw struck at a target (its cooldown wound up again). */
  strike(towerId: number, targetId: number | undefined, view: TongueView): void {
    if (targetId === undefined || !this.ready()) return;
    // One tongue a Maw at a time: a new strike takes over from the old one's tongue (its rider is swallowed).
    for (const l of this.licks) if (l.towerId === towerId && l.rider === null) l.t = Math.max(l.t, 99);
    const body = view.body(targetId);
    const mouth = view.mouth(towerId);
    if (!mouth) return;
    const strip = this.art.fxSprite('tongue', 'strip')!;
    const tipArt = this.art.fxSprite('tongue', 'tip')!;
    const tip = new Sprite(tipArt.tex);
    tip.anchor.set(tipArt.rect.anchor?.[0] ?? 0.12, tipArt.rect.anchor?.[1] ?? 0.5);
    const lengths: MeshRope[] = [];
    for (let i = 0; i < MAX_LENGTHS; i++) {
      const points = Array.from({ length: PTS }, () => new Point(mouth.x, mouth.y));
      const rope = new MeshRope({ texture: strip.tex, points, textureScale: 0 });
      rope.autoUpdate = true;
      rope.visible = false;
      lengths.push(rope);
    }
    this.layer.addChild(...lengths, tip);
    this.licks.push({
      towerId, targetId, t: 0,
      aim: body ? { x: body.x, y: body.y } : { x: mouth.x - 40, y: mouth.y + 60 }, aimZ: body?.z ?? mouth.z,
      mouth, rider: null, lengths, tip, phase: (towerId * 0.37) % 1,
    });
  }

  /** Is a tongue reaching for this unit right now (it has not been reeled in yet)? */
  aimedAt(unitId: number): boolean {
    return this.licks.some((l) => l.targetId === unitId && l.rider === null && l.t < OUT + STUCK);
  }

  /**
   * An eaten unit, handed over by the board with its own sprite (already showing its flinch, facing the
   * mouth): it sticks to the tip and rides it in. `up`: from the point the tip holds to its feet.
   */
  take(unitId: number, sprite: Sprite, up: number): boolean {
    const l = this.licks.find((x) => x.targetId === unitId && x.rider === null && x.t < OUT + STUCK);
    if (!l) return false;
    l.rider = { sprite, sx: sprite.scale.x, sy: sprite.scale.y, up };
    // It is held where it was: the tip comes down on it there.
    l.aim = { x: sprite.position.x, y: sprite.position.y - up };
    return true;
  }

  /** How many tongues are out, and how many carry a body (for the tests and the screenshots). */
  now(): Array<{ t: number; riding: boolean; tip: Pt; mouth: Pt | null }> {
    return this.licks.map((l) => ({ t: l.t, riding: !!l.rider, tip: { x: l.tip.x, y: l.tip.y }, mouth: l.mouth ? { x: l.mouth.x, y: l.mouth.y } : null }));
  }

  update(dt: number, view: TongueView): void {
    const keep: Lick[] = [];
    for (const l of this.licks) {
      l.t += dt;
      const m = view.mouth(l.towerId);
      if (m) l.mouth = m;
      const mouth = l.mouth!;
      // A living target is followed until the tip is on it.
      if (!l.rider && l.t < OUT + SLAP) {
        const b = view.body(l.targetId);
        if (b) { l.aim = { x: b.x, y: b.y }; l.aimZ = b.z; }
      }
      const eats = !!l.rider;
      const end = eats ? OUT + STUCK + REEL + GULP : OUT + SLAP + SNAP;
      if (l.t >= end) { this.destroy(l, true); continue; }
      // How far along its arc the tip is (0 at the lips, 1 on the target), and how wide the tongue is.
      let u: number;
      if (l.t < OUT) u = smooth(l.t / OUT);
      else if (eats) u = l.t < OUT + STUCK ? 1 : 1 - smooth(clamp01((l.t - OUT - STUCK) / REEL));
      else u = l.t < OUT + SLAP ? 1 : 1 - smooth(clamp01((l.t - OUT - SLAP) / SNAP));
      const width = Math.max(4, Math.min(16, mouth.size * 0.075));
      const curve = this.curve(mouth, l.aim);
      // The body rides a little clear of the curve, wobbling as it swings up.
      const wobble = eats && l.t > OUT + STUCK ? Math.sin((l.t + l.phase) * 26) * width * 0.35 * u : 0;
      this.lay(l, curve, u, width, wobble);
      // Draw order: over the Maw and the body from the front; just behind the Maw's body from behind.
      const z = mouth.back ? mouth.z - 2 : Math.max(mouth.z, l.aimZ) + 6;
      for (const r of l.lengths) r.zIndex = z;
      l.tip.zIndex = z + 1;
      if (l.rider) {
        const r = l.rider;
        const tip = this.at(curve, u);
        const inGulp = l.t >= OUT + STUCK + REEL;
        // It shrinks as it comes to the lips, and is gone in the gulp.
        const k = inGulp ? Math.max(0, 0.3 * (1 - (l.t - OUT - STUCK - REEL) / (GULP * 0.5))) : 0.3 + 0.7 * smooth(clamp01(u / 0.35));
        r.sprite.visible = k > 0.01;
        r.sprite.scale.set(r.sx * k, r.sy * k);
        r.sprite.position.set(tip.x + wobble, tip.y + r.up * k);
        r.sprite.rotation = wobble * 0.02;
        r.sprite.alpha = inGulp ? k / 0.3 : 1;
        // The body is held on the tip: drawn just under it (the tip sticks over its middle).
        r.sprite.zIndex = z;
        l.tip.zIndex = z + 1;
      }
      keep.push(l);
    }
    this.licks = keep;
  }

  /** The arc from the mouth to the target: it rises from the mouth and comes down on the target. */
  private curve(m: Pt, a: Pt): [Pt, Pt, Pt] {
    const d = Math.hypot(a.x - m.x, a.y - m.y);
    const lift = 18 + d * 0.32;
    const c = { x: m.x + (a.x - m.x) * 0.45, y: Math.min(m.y, a.y) - lift };
    return [m, c, a];
  }

  private at(q: [Pt, Pt, Pt], s: number): Pt {
    const [p0, p1, p2] = q;
    const w = 1 - s;
    return { x: w * w * p0.x + 2 * w * s * p1.x + s * s * p2.x, y: w * w * p0.y + 2 * w * s * p1.y + s * s * p2.y };
  }

  /** Lays the tongue along its arc from the lips to `u`, in lengths of the strip about as long as they are drawn. */
  private lay(l: Lick, q: [Pt, Pt, Pt], u: number, width: number, wobble: number): void {
    const strip = this.art.fxSprite('tongue', 'strip')!;
    const natural = (strip.rect.w / strip.rect.h) * width;
    // The arc's length up to u.
    let len = 0;
    let prev = this.at(q, 0);
    for (let i = 1; i <= 24; i++) { const p = this.at(q, (u * i) / 24); len += Math.hypot(p.x - prev.x, p.y - prev.y); prev = p; }
    const n = Math.max(1, Math.min(MAX_LENGTHS, Math.round(len / natural)));
    for (let i = 0; i < MAX_LENGTHS; i++) {
      const rope = l.lengths[i];
      rope.visible = i < n && len > 2;
      if (!rope.visible) continue;
      const geo = rope.geometry as RopeGeometry;
      geo._width = width;
      const pts = geo.points as Point[];
      for (let k = 0; k < PTS; k++) {
        const s = (u * (i + k / (PTS - 1))) / n;
        const p = this.at(q, s);
        // The wobble grows along it toward the tip.
        pts[k].set(p.x + wobble * (s / Math.max(0.001, u)), p.y);
      }
    }
    const end = this.at(q, u);
    const before = this.at(q, Math.max(0, u - 0.04));
    l.tip.visible = len > 2;
    l.tip.position.set(end.x + wobble, end.y);
    l.tip.rotation = Math.atan2(end.y - before.y, end.x - before.x);
    const k = (width * 1.9) / Math.max(1, l.tip.texture.height);
    l.tip.scale.set(k, k);
  }

  private destroy(l: Lick, withRider: boolean): void {
    for (const r of l.lengths) r.destroy();
    l.tip.destroy();
    if (withRider && l.rider) l.rider.sprite.destroy();
  }
}

/**
 * THE MAW'S FIRING CLIP, in time with its tongue. Its clip (tools/art/limbs.mjs, art-src/limbs/maw-tongue/
 * fire.mp4) gapes in its first eighth, holds wide open to a little past its middle, snaps shut and gulps
 * (the throat sac swelling) and settles in the rest. Played so that the mouth is open while the tongue is
 * out and shuts as it comes home: how far through the clip to show, `t` seconds after the strike.
 */
export const MAW_FIRE_SECONDS = 1.15;
const OPEN = 0.12;
const SHUT = 0.56;
export function mawFireShare(t: number, dur = MAW_FIRE_SECONDS): number {
  const k = Math.min(1, dur / MAW_FIRE_SECONDS);
  const out = OUT * k, home = (OUT + STUCK + REEL) * k;
  if (t < out) return OPEN * (t / out);
  if (t < home) return OPEN + (SHUT - OPEN) * ((t - out) / (home - out));
  return Math.min(0.999, SHUT + (1 - SHUT) * ((t - home) / Math.max(0.05, dur - home)));
}
