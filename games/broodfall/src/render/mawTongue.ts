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
 *
 * FROM INSIDE THE MOUTH (Oct 1 2026, Collins: "the tongue of the maw appears to start out of nowhere (e.g.
 * it does not look like it is coming from inside its mouth but appearing in front of it)"). From the front
 * the tongue grows from the back of the Maw's THROAT (src/render/mawMouth.ts, marked on each frame of its
 * firing clip), narrower there and sunk in a soft dark of the gullet, and leaves the mouth in one smooth arc
 * over its teeth (the first INSIDE of the way is inside the mouth: the tip goes slower there). The tip leaves
 * the throat first and the tongue follows it out; reeled in, the body on it is drawn cut to the mouth's GAPE
 * (the opening along the tips of its teeth) once it is past the teeth, so that the lower teeth and lips are
 * in front of it, and the mouth shuts on it; a shut mouth shows no tongue. The mouth is wide open (frame 2
 * of its clip) a GAPE share into the throw. (Two lengths of tongue, one cut to the gape under the lips and
 * one over them, were tried first: their seam at the teeth read as a hose joint.)
 */
import { Container, Graphics, MeshRope, Point, RopeGeometry, Sprite, Texture } from 'pixi.js';
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
const MAX_LENGTHS = 7;
/**
 * Fix pass (Sep 30 2026, "the tongue reads like a ribbed hose"): a wet tongue, thick at the lips and
 * tapering to a thin neck under its sticky club (TAPER: the share of its width left at the tip), sagging a
 * little between the mouth and the tip (SAG, more while it carries a body), and drawn from a smooth, glossy
 * strip (tools/art/templates/fx.mjs TONGUE, art-src/fx/tongue-wet.png). Its width at the lips is a share
 * of the Maw as drawn (ROOT). Before this the strip was always drawn at its texture's own height (MeshRope
 * resets its width to that every frame), whatever size the Maw was: now the rope's corners are laid here.
 */
const ROOT = 0.17;
const TAPER = 0.42;
const SAG = 0.05;
/** The sticky club: held at this share of its picture's length, drawn this many times the tongue's end thickness. */
const TIP_HOLD = 0.7;
const CLUB = 1.7;
/** A body taken rides the tongue drawn this much bigger (it reads against the mouth), and at the lips is LIPS of that. */
const RIDE = 1.35;
const LIPS = 0.55;
/** How much of the way from the throat to the target is inside the mouth (the tip goes slower there). */
const INSIDE = 0.24;
/** Inside the mouth it is narrower at the throat (THROAT of its width at the teeth): it is seen going down into it. */
const THROAT = 0.6;
/** The dark of the gullet laid over the root of the tongue (a soft round shadow THROAT_SHADE times its width across). */
const THROAT_SHADE = 2.4;
let shadeTex: Texture | null = null;
/** A soft round shadow, the colour of the gullet: dark in the middle, gone at its edge. */
function throatShade(): Texture {
  if (shadeTex) return shadeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(26,6,12,0.97)');
  r.addColorStop(0.45, 'rgba(34,8,14,0.8)');
  r.addColorStop(1, 'rgba(40,10,16,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  shadeTex = Texture.from(c);
  return shadeTex;
}
/** A body reeled in is taken inside the mouth (behind its teeth) this far back from the teeth (a share of INSIDE). */
const PAST_TEETH = 0.8;

/**
 * Where the board says a Maw's mouth is now (its lips: the muzzle), how big the Maw is drawn, whether it is
 * seen from behind, its depth. From the front while it fires: the back of its throat and the opening of its
 * mouth (empty: shut) on the screen (src/render/mawMouth.ts); without them the tongue leaves from its lips.
 */
export interface MouthNow { x: number; y: number; size: number; back: boolean; z: number; throat?: Pt; gape?: Pt[] }
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
  /**
   * What is drawn inside the mouth, cut to its opening (`gape`): the dark of the gullet over the tongue's root
   * (`shade`), and the body it carries once that is taken in behind the teeth (`swallowed`).
   */
  inner: Container; gape: Graphics; shade: Sprite;
  swallowed: boolean;
  /** The tip is still (or again) inside the mouth. */
  inMouth: boolean;
}

/**
 * The way from the throat to the target, one smooth arc (`arc`, from `root`). The first `inside` of the way
 * (the tip goes slower there) is inside the mouth: up to the arc's `exit` (a share of the arc) at the teeth.
 */
interface Way { root: Pt; arc: [Pt, Pt, Pt]; inside: number; exit: number }

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
    // Held by the middle of its club (not its neck): the club is the end of the tongue, where a body sticks;
    // its neck lies back over the last of the strip.
    tip.anchor.set(TIP_HOLD, tipArt.rect.anchor?.[1] ?? 0.5);
    const rope = () => {
      const points = Array.from({ length: PTS }, () => new Point(mouth.x, mouth.y));
      const r = new MeshRope({ texture: strip.tex, points, textureScale: 0 });
      // Its corners are laid by `lay` (tapering), not by the rope's own update (one width, the texture's height).
      r.autoUpdate = false;
      r.onRender = () => {};
      r.visible = false;
      return r;
    };
    const lengths = Array.from({ length: MAX_LENGTHS }, rope);
    const inner = new Container();
    const shade = new Sprite(throatShade());
    shade.anchor.set(0.5);
    shade.visible = false;
    inner.addChild(shade);
    const gape = new Graphics();
    this.layer.addChild(...lengths, inner, gape, tip);
    this.licks.push({
      towerId, targetId, t: 0,
      aim: body ? { x: body.x, y: body.y } : { x: mouth.x - 40, y: mouth.y + 60 }, aimZ: body?.z ?? mouth.z,
      mouth, rider: null, lengths, tip, phase: (towerId * 0.37) % 1, inner, gape, shade, swallowed: false, inMouth: false,
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
  now(): Array<{ t: number; riding: boolean; tip: Pt; mouth: Pt | null; throat: Pt | null; inMouth: boolean; open: boolean }> {
    return this.licks.map((l) => ({
      t: l.t, riding: !!l.rider, tip: { x: l.tip.x, y: l.tip.y }, mouth: l.mouth ? { x: l.mouth.x, y: l.mouth.y } : null,
      throat: l.mouth?.throat ?? null, inMouth: l.inMouth, open: (l.mouth?.gape?.length ?? 0) >= 3,
    }));
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
      // How far along its way the tip is (0 at the throat, 1 on the target), and how wide the tongue is.
      let u: number;
      if (l.t < OUT) u = smooth(l.t / OUT);
      else if (eats) u = l.t < OUT + STUCK ? 1 : 1 - smooth(clamp01((l.t - OUT - STUCK) / REEL));
      else u = l.t < OUT + SLAP ? 1 : 1 - smooth(clamp01((l.t - OUT - SLAP) / SNAP));
      const width = Math.max(6, Math.min(30, mouth.size * ROOT));
      const way = this.way(mouth, l.aim);
      // The body rides a little clear of the curve, wobbling as it swings up (not once it is in the mouth).
      const wobble = eats && l.t > OUT + STUCK ? Math.sin((l.t + l.phase) * 26) * width * 0.25 * clamp01((u - way.inside) / 0.15) : 0;
      // It hangs a little between the lips and the tip: more when it is slack (reeling in), most with a body on it.
      const slack = l.t < OUT ? 0.35 : eats ? 1.4 : 1;
      this.lay(l, way, u, width, wobble, slack);
      // Draw order: over the Maw and the body from the front; just behind the Maw's body from behind.
      const z = mouth.back ? mouth.z - 2 : Math.max(mouth.z, l.aimZ) + 6;
      for (const r of l.lengths) r.zIndex = z;
      l.tip.zIndex = z + 1;
      // Inside the mouth: cut to its gape (the dark of the gullet over the tongue's root, a body taken in
      // behind its teeth), drawn over the tongue and under its tip. A mouth that is shut shows no tongue.
      const cut = way.inside > 0 && mouth.gape !== undefined;
      const open = cut && mouth.gape!.length >= 3;
      l.inner.zIndex = z;
      l.gape.clear();
      if (open) l.gape.poly(mouth.gape!.flatMap((p) => [p.x, p.y])).fill(0xffffff);
      l.inner.mask = open ? l.gape : null;
      l.inner.visible = !cut || open;
      if (cut && !open) { for (const r of l.lengths) r.visible = false; l.tip.visible = false; }
      l.inMouth = cut && u < way.inside;
      // The root goes down into the dark of the gullet.
      l.shade.visible = open;
      if (open) {
        l.shade.position.set(way.root.x, way.root.y);
        const k = (width * THROAT_SHADE) / 64;
        l.shade.scale.set(k * 1.15, k);
      }
      if (l.rider) {
        const r = l.rider;
        const tip = this.pathAt(way, u);
        // Reeled in past the teeth, it is in the mouth: drawn behind the lower teeth and lips from then on.
        if (cut && !l.swallowed && l.t > OUT + STUCK && u < way.inside * PAST_TEETH) {
          l.swallowed = true;
          l.inner.addChild(r.sprite);
          r.sprite.tint = 0xc8a8a8;
        }
        const inGulp = l.t >= OUT + STUCK + REEL;
        // It shrinks as it comes to the lips, and is gone in the gulp.
        // Drawn bigger as it is lifted (RIDE), so that it reads against the Maw's mouth, down to LIPS of that at the lips.
        const lift = 1 + (RIDE - 1) * smooth(clamp01((l.t - OUT - STUCK) / (REEL * 0.35)));
        const atLips = RIDE * LIPS;
        const k = l.t < OUT ? 1 : inGulp ? Math.max(0, atLips * (1 - (l.t - OUT - STUCK - REEL) / (GULP * 0.5))) : lift * (LIPS + (1 - LIPS) * smooth(clamp01(u / 0.35)));
        r.sprite.visible = k > 0.01;
        r.sprite.scale.set(r.sx * k, r.sy * k);
        // Until the tip is on it, it stands where it was taken (it is not dragged out of the street to the throat and back).
        if (l.t < OUT) r.sprite.position.set(l.aim.x, l.aim.y + r.up * k);
        else r.sprite.position.set(tip.x + wobble, tip.y + r.up * k);
        r.sprite.rotation = wobble * 0.02;
        r.sprite.alpha = inGulp ? k / atLips : 1;
        // The body is held on the tip: drawn just under it (the tip sticks over its middle).
        r.sprite.zIndex = z;
        l.tip.zIndex = z + 1;
      }
      keep.push(l);
    }
    this.licks = keep;
  }

  /**
   * The way from the throat to the target. From the front, while its mouth is known: one arc from the back of
   * its throat, rising a little out of its mouth and coming down on the target; where it crosses the tips of
   * its teeth is found on the gape. Otherwise (from behind, not firing) the arc from its lips, as before.
   */
  private way(m: MouthNow, a: Pt): Way {
    if (!m.back && m.throat && m.gape !== undefined) {
      const root = m.throat;
      const d = Math.hypot(a.x - root.x, a.y - root.y);
      // Lower than from the lips: it leaves the mouth outward, not back up across its opening.
      const arc: [Pt, Pt, Pt] = [root, { x: root.x + (a.x - root.x) * 0.45, y: Math.min(root.y, a.y) - (4 + d * 0.14) }, a];
      // How far along the arc it is still inside the gape (shut: a little of it).
      let exit = 0.15;
      if (m.gape.length >= 3) {
        for (let i = 1; i <= 60; i++) {
          if (!within(this.at(arc, i / 60), m.gape)) { exit = Math.max(0.02, (i - 0.5) / 60); break; }
        }
      }
      return { root, arc, inside: INSIDE, exit };
    }
    const root = { x: m.x, y: m.y };
    const d = Math.hypot(a.x - root.x, a.y - root.y);
    // It rises from the mouth and comes down on the target.
    const lift = 10 + d * 0.22;
    return { root, arc: [root, { x: root.x + (a.x - root.x) * 0.45, y: Math.min(root.y, a.y) - lift }, a], inside: 0, exit: 0 };
  }

  private at(q: [Pt, Pt, Pt], s: number): Pt {
    const [p0, p1, p2] = q;
    const w = 1 - s;
    return { x: w * w * p0.x + 2 * w * s * p1.x + s * s * p2.x, y: w * w * p0.y + 2 * w * s * p1.y + s * s * p2.y };
  }

  /** A point on the way (s: 0 at the throat, `inside` at the teeth, 1 on the target). */
  private pathAt(w: Way, s: number): Pt {
    if (w.inside <= 0) return this.at(w.arc, s);
    const q = s <= w.inside ? (s / w.inside) * w.exit : w.exit + ((s - w.inside) / (1 - w.inside)) * (1 - w.exit);
    return this.at(w.arc, q);
  }

  /** Lays the tongue along its way from the throat to `u`, in lengths of the strip about as long as they are drawn: tapering, sagging. */
  private lay(l: Lick, w: Way, u: number, width: number, wobble: number, slack: number): void {
    const strip = this.art.fxSprite('tongue', 'strip')!;
    const natural = (strip.rect.w / strip.rect.h) * width;
    const length = (s0: number, s1: number) => {
      let len = 0;
      let prev = this.pathAt(w, s0);
      for (let i = 1; i <= 24; i++) { const p = this.pathAt(w, s0 + ((s1 - s0) * i) / 24); len += Math.hypot(p.x - prev.x, p.y - prev.y); prev = p; }
      return len;
    };
    const u0 = Math.max(0.001, u);
    // Out of the mouth it hangs between the teeth and the tip.
    const outLen = u > w.inside ? length(w.inside, u) : 0;
    const sag = outLen * SAG * slack;
    const along = (s: number): Pt => {
      const p = this.pathAt(w, s);
      const g = s > w.inside && u > w.inside ? (s - w.inside) / (u - w.inside) : 0;
      return { x: p.x + wobble * g, y: p.y + sag * Math.sin(Math.PI * g) };
    };
    // Widest at the teeth: narrower down into the throat, tapering out to the tip.
    const half = (s: number) => {
      if (s < w.inside) return (width / 2) * (THROAT + (1 - THROAT) * (s / w.inside));
      return (width / 2) * (1 - (1 - TAPER) * Math.min(1, (s - w.inside) / Math.max(0.001, u0 - w.inside)));
    };
    // One tongue from the throat to the tip, in lengths of the strip about as long as they are drawn.
    const n = Math.max(1, Math.min(MAX_LENGTHS, Math.round(length(0, u) / natural)));
    this.layRopes(l.lengths, 0, u, n, along, half);
    const total = length(0, u);
    const end = along(u);
    const before = along(Math.max(0, u - 0.04));
    l.tip.visible = total > 2;
    l.tip.position.set(end.x, end.y);
    l.tip.rotation = Math.atan2(end.y - before.y, end.x - before.x);
    // Its club about CLUB times as thick as the tongue's thin end.
    // Its neck lies back over the tongue, never back past the root (just out of the throat, the club is small:
    // it would stick out behind the throat, outside the mouth).
    const k = Math.min((half(u) * 2 * CLUB) / Math.max(1, l.tip.texture.height), (total * 0.85) / Math.max(1, l.tip.texture.width * TIP_HOLD));
    l.tip.scale.set(k, k);
  }

  /** Lays `n` of these ropes end to end from s0 to s1 along the way, each as wide as the tongue is there. */
  private layRopes(ropes: MeshRope[], s0: number, s1: number, n: number, along: (s: number) => Pt, half: (s: number) => number): void {
    const a0 = along(s0), a1 = along(s1);
    const shown = s1 > s0 && Math.hypot(a1.x - a0.x, a1.y - a0.y) > 1;
    for (let i = 0; i < ropes.length; i++) {
      const rope = ropes[i];
      rope.visible = shown && i < n;
      if (!rope.visible) continue;
      const geo = rope.geometry as RopeGeometry;
      const pts = geo.points as Point[];
      const ss: number[] = [];
      for (let k = 0; k < PTS; k++) {
        const s = s0 + ((s1 - s0) * (i + k / (PTS - 1))) / n;
        ss.push(s);
        const p = along(s);
        pts[k].set(p.x, p.y);
      }
      // Its corners: either side of each point, across the line through its neighbours, as wide as it is there.
      const buf = geo.getBuffer('aPosition');
      const v = buf.data as Float32Array;
      for (let k = 0; k < PTS; k++) {
        const a = pts[Math.max(0, k - 1)];
        const b = pts[Math.min(PTS - 1, k + 1)];
        let px = b.y - a.y;
        let py = -(b.x - a.x);
        const d = Math.hypot(px, py);
        if (d < 1e-6) { px = 0; py = 0; } else { px /= d; py /= d; }
        const h = half(ss[k]);
        v[k * 4] = pts[k].x + px * h;
        v[k * 4 + 1] = pts[k].y + py * h;
        v[k * 4 + 2] = pts[k].x - px * h;
        v[k * 4 + 3] = pts[k].y - py * h;
      }
      buf.update();
    }
  }

  private destroy(l: Lick, withRider: boolean): void {
    for (const r of l.lengths) r.destroy();
    l.tip.destroy();
    if (withRider && l.rider) l.rider.sprite.destroy();
    l.inner.mask = null;
    l.inner.destroy();
    l.gape.destroy();
    l.shade.destroy();
  }
}

/** Is the point inside the polygon (even-odd)? */
function within(p: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * THE MAW'S FIRING CLIP, in time with its tongue. Its clip (tools/art/limbs.mjs, art-src/limbs/maw-tongue-2/
 * fire.mp4) gapes in its first eighth, holds wide open to a little before its middle (its 14 baked frames), snaps shut and gulps
 * (the throat sac swelling) and settles in the rest. Played so that the mouth is open while the tongue is
 * out and shuts as it comes home: how far through the clip to show, `t` seconds after the strike.
 *
 * Oct 1 2026: the mouth is wide open (frame 2, OPEN of the clip) a GAPE share into the throw, while the tip
 * is still inside it, so that the tongue is seen leaving an open mouth (it opened over the whole throw, and
 * the tongue was out of a mouth still shut); and it shuts (frame 6, SHUT) as the body is home, after it was
 * seen taken in behind the teeth.
 */
export const MAW_FIRE_SECONDS = 1.15;
const OPEN = 0.15;
const SHUT = 0.43;
const GAPE = 0.35;
export function mawFireShare(t: number, dur = MAW_FIRE_SECONDS): number {
  const k = Math.min(1, dur / MAW_FIRE_SECONDS);
  const gape = OUT * GAPE * k, home = (OUT + STUCK + REEL) * k;
  if (t < gape) return OPEN * (t / gape);
  if (t < home) return OPEN + (SHUT - OPEN) * ((t - gape) / (home - gape));
  return Math.min(0.999, SHUT + (1 - SHUT) * ((t - home) / Math.max(0.05, dur - home)));
}
