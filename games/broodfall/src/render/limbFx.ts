/**
 * WHAT A LIMB DOES BESIDES STANDING THERE (Sep 30 2026), for the isometric board:
 *
 * - ACTING. The engines and support limbs have no shot of their own, so their clip (the `fire`
 *   clip of tools/art/limbs.mjs) plays when what they do happens: an engine or a choir when a
 *   limb it serves fires, a ward when a limb under it takes a hit, a tap and a lance now and then.
 * - DYING. A limb that dies (or is eaten into the next build) withers where it stood: its `die`
 *   clip, the husk lies a moment, then sinks and fades. Without that clip it darkens and slumps.
 * - TAKEN. A limb a researcher tore out is pulled up, shrinks and goes with it.
 * - GRAFTS. The parts of the limbs it was built from (its cannibalized pips) grow on its body,
 *   at the graft points measured on its picture when it was baked (DESIGN.md: "a spitter built
 *   from a cannibalized burster has the burster's sacs hanging off it").
 *
 * It only reads the sim.
 */
import { Container, Sprite } from 'pixi.js';
import { Sim, towerSpec } from '../sim/sim';
import type { Tower } from '../sim/types';
import type { Atlas, BoardArtSet, Clip, LimbArt, LimbSide } from './art';

interface Pt { x: number; y: number }

/** A limb that is gone from the board, playing its end. */
interface Fall {
  sprite: Sprite; shade: Sprite; parts: Sprite[]; atlas: Atlas; art: LimbArt; clip: Clip | null;
  kind: 'wither' | 'taken'; t: number; x: number; y: number; sx: number; sy: number; to: Pt | null;
}

/** How long a withering plays, how long the husk lies, how long it takes to sink away, seconds. */
const WITHER = 1.3;
const HUSK = 1.6;
const SINK = 0.8;
const TAKEN = 0.7;
/** How wide a donor's part is drawn, as a share of how wide the limb stands. */
const PART = 0.46;
/** How the parts sit at the graft points, one after another: turned (radians) and mirrored (on the left). */
const SLOT = [{ rot: 0.15, left: false }, { rot: -0.15, left: true }, { rot: -0.6, left: false }, { rot: -0.35, left: false }, { rot: 0.35, left: true }];

export class LimbFates {
  private lastCd = new Map<number, number>();
  private lastShield = new Map<number, number>();
  private fired = new Set<number>();
  private hit = new Set<number>();
  private nextAct = new Map<number, number>();
  private grafts = new Map<number, Sprite[]>();
  private falls: Fall[] = [];

  constructor(private art: BoardArtSet) {}

  reset(): void {
    for (const list of this.grafts.values()) for (const s of list) s.destroy();
    this.grafts.clear();
    for (const f of this.falls) this.destroyFall(f);
    this.falls = [];
    this.lastCd.clear(); this.lastShield.clear(); this.nextAct.clear();
  }

  /** Once a frame, before the limbs are drawn: which limbs fired, and which took a hit. */
  observe(sim: Sim): void {
    this.fired.clear();
    this.hit.clear();
    for (const t of sim.towers) {
      const cd = this.lastCd.get(t.id);
      if (cd !== undefined && t.cooldown > cd + 0.05) this.fired.add(t.id);
      this.lastCd.set(t.id, t.cooldown);
      const sh = this.lastShield.get(t.id);
      const now = (t.shield ?? 0) + t.hp;
      if (sh !== undefined && now < sh - 0.01) this.hit.add(t.id);
      this.lastShield.set(t.id, now);
    }
    if (this.lastCd.size > sim.towers.length * 2 + 50) {
      const live = new Set(sim.towers.map((t) => t.id));
      for (const m of [this.lastCd, this.lastShield, this.nextAct]) for (const id of [...m.keys()]) if (!live.has(id)) m.delete(id);
    }
  }

  /** Does this limb, which has no shot of its own, act now? */
  acts(sim: Sim, t: Tower, clock: number): boolean {
    const spec = towerSpec(t.family);
    if (spec.rate > 0 && !spec.engine) return false;
    // A tap holding its target, and a lance laying its strip: now and then.
    if (t.family === 'tap' || t.family === 'lance') {
      const at = this.nextAct.get(t.id) ?? clock + 1 + (t.id % 7) * 0.4;
      if (clock < at) { this.nextAct.set(t.id, at); return false; }
      this.nextAct.set(t.id, clock + 3.5 + (t.id % 5) * 0.3);
      return t.family === 'lance' || sim.effectLinks(t).targets.length > 0;
    }
    if (!spec.engine && t.family !== 'choir' && t.family !== 'ward') return false;
    const targets = sim.effectLinks(t).targets;
    if (t.family === 'ward') return this.hit.has(t.id) || targets.some((u) => this.hit.has(u.id));
    return targets.some((u) => this.fired.has(u.id));
  }

  /**
   * The parts of its donors on a limb, where its picture says they graft. `x, y`: where the
   * limb stands on the screen; `scale`: of its frame; `width`: how wide it stands.
   */
  graft(box: Container, t: Tower, art: LimbArt, side: LimbSide, x: number, y: number, scale: number, mirror: boolean, width: number, z: number, visible: boolean, tint: number): void {
    const points = side.grafts ?? art.grafts ?? [];
    const pips = t.pips.slice(0, Math.min(SLOT.length, points.length));
    let list = this.grafts.get(t.id);
    if (!list) { list = []; this.grafts.set(t.id, list); }
    while (list.length > pips.length) list.pop()!.destroy();
    pips.forEach((p, i) => {
      const part = this.art.fxSprite('parts', `part-${p.family}`);
      if (!part) return;
      let s = list![i];
      if (!s) { s = new Sprite(part.tex); box.addChild(s); list![i] = s; }
      s.texture = part.tex;
      const slot = SLOT[i];
      const [gx, gy] = points[i];
      const dx = (gx - side.anchor[0]) * art.frame * scale * (mirror ? -1 : 1);
      const dy = (gy - side.anchor[1]) * art.frame * scale;
      const onLeft = slot.left !== mirror;
      const k = (width * PART) / part.tex.width;
      s.anchor.set(part.rect.anchor?.[0] ?? 0.06, part.rect.anchor?.[1] ?? 0.7);
      s.scale.set(onLeft ? -k : k, k);
      s.rotation = onLeft ? -slot.rot : slot.rot;
      s.position.set(x + dx, y + dy);
      // Behind the limb: it grows out from under its edge.
      s.zIndex = z - 0.5;
      s.visible = visible;
      s.tint = tint;
    });
  }

  /** A limb is gone from the board: it withers where it stood, or is carried off to `to`. */
  bury(t: Tower, sprite: Sprite, shade: Sprite, art: LimbArt, atlas: Atlas, back: boolean, to: Pt | null): void {
    const parts = this.grafts.get(t.id) ?? [];
    this.grafts.delete(t.id);
    const clip = (back ? art.back?.anims.die : undefined) ?? art.anims.die ?? null;
    if (this.falls.length > 24) { sprite.destroy(); shade.destroy(); parts.forEach((s) => s.destroy()); return; }
    this.falls.push({ sprite, shade, parts, atlas, art, clip, kind: to ? 'taken' : 'wither', t: 0, x: sprite.x, y: sprite.y, sx: sprite.scale.x, sy: sprite.scale.y, to });
  }

  /** How many limbs are playing their end now, and how far in (for the beats). */
  fallsNow(): Array<{ kind: string; t: number; alpha: number; clip: boolean }> {
    return this.falls.map((f) => ({ kind: f.kind, t: f.t, alpha: f.sprite.alpha, clip: !!f.clip }));
  }

  /** How many parts are drawn on limbs now. */
  graftCount(): number {
    let n = 0;
    for (const list of this.grafts.values()) n += list.filter((s) => s.visible && s.texture).length;
    return n;
  }

  /** Forget the parts of limbs that are gone without an end (turned into another family). */
  drop(id: number): void {
    for (const s of this.grafts.get(id) ?? []) s.destroy();
    this.grafts.delete(id);
  }

  step(dt: number): void {
    const keep: Fall[] = [];
    for (const f of this.falls) {
      f.t += dt;
      if (f.kind === 'taken') {
        const u = Math.min(1, f.t / TAKEN);
        const to = f.to!;
        const lift = Math.sin(u * Math.PI * 0.5) * 30;
        f.sprite.position.set(f.x + (to.x - f.x) * u * u, f.y + (to.y - f.y) * u * u - lift);
        f.sprite.scale.set(f.sx * (1 - 0.75 * u), f.sy * (1 - 0.75 * u));
        f.sprite.alpha = 1 - u * u;
        f.sprite.tint = 0xb8e0d8;
        f.shade.alpha = 1 - u;
        for (const p of f.parts) p.alpha = 1 - u;
        if (u >= 1) { this.destroyFall(f); continue; }
        keep.push(f);
        continue;
      }
      const play = f.clip ? WITHER : 0.9;
      if (f.clip) {
        const i = Math.min(f.clip.count - 1, Math.floor((f.t / WITHER) * f.clip.count));
        f.sprite.texture = f.atlas.frame(f.clip.start + i, f.art.frame, f.art.cols);
      } else {
        // No clip of its death: it darkens and slumps.
        const u = Math.min(1, f.t / play);
        f.sprite.scale.set(f.sx * (1 + 0.1 * u), f.sy * (1 - 0.45 * u));
        const c = Math.round(255 - 150 * u);
        f.sprite.tint = (c << 16) | (Math.round(c * 0.9) << 8) | Math.round(c * 0.8);
      }
      // Its grafted parts wither with it.
      const wu = Math.min(1, f.t / play);
      for (const p of f.parts) { p.alpha = 1 - wu; p.tint = 0x806050; }
      const gone = f.t - play - HUSK;
      if (gone > 0) {
        const u = Math.min(1, gone / SINK);
        f.sprite.alpha = 1 - u;
        f.shade.alpha = 1 - u;
        f.sprite.y = f.y + u * 6;
        if (u >= 1) { this.destroyFall(f); continue; }
      }
      keep.push(f);
    }
    this.falls = keep;
  }

  private destroyFall(f: Fall): void {
    f.sprite.destroy();
    f.shade.destroy();
    for (const p of f.parts) p.destroy();
  }
}

