/**
 * ENEMY DOMES, DRAWN (Collins, Oct 2 2026: "a unit for both the warriors and the science team that gives a shield
 * around it in a dome that takes a certain amount of damage before breaking (Northgard has something like this), but
 * the catch is it's ineffective against damage from units").
 *
 * A dome is a translucent bubble over its bearer and everything under it: bronze for the war caste's Aegis Deacon,
 * teal glass for the science caste's Lens Bearer, so the player sees at a glance which bodies his limbs are wasting
 * shots on. It reads its state off the sim and never writes to it:
 * - the bubble's fill and rim fade with what is left of the pool, and a few latitude ribs ride on it;
 * - a hit it soaks flashes the rim (a ripple) for a moment;
 * - below a third of its pool it shows cracks;
 * - emptied, it SHATTERS (shards fly off and fade); when it comes back it grows in from the bearer.
 * Reduce motion: no ripple, no shards, no grow; a broken dome just goes, a returned one is just there.
 */
import { Container, Graphics } from 'pixi.js';
import { CALM } from '../meta/settings';

export interface Pt { x: number; y: number }

/** One bearer as the screen sees it this frame. */
export interface DomeView {
  id: number;
  /** The bearer's foot on screen, and its dome's ground ring (the projected circle) around it. */
  foot: Pt;
  ring: Pt[];
  /** How high the bubble rises over its ring on screen (px). */
  rise: number;
  /** What is left of its pool (0..1); 0 = broken. */
  frac: number;
  /** Seconds since it last soaked a hit (Infinity: never). */
  hitAge: number;
  caste: 'war' | 'science';
}

const COLOR = { war: 0xffb04a, science: 0x5ee6d6 } as const;
const RIM = { war: 0xffe2a8, science: 0xc9fff7 } as const;

interface Shard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; color: number }

export class Domes {
  /** Drawn over the bodies, under the HUD marks. */
  readonly layer = new Container();
  private g = new Graphics();
  private last = new Map<number, number>();
  /** Each dome as last drawn, so one whose bearer dies with it standing can shatter where it stood. */
  private lastView = new Map<number, DomeView>();
  private grow = new Map<number, number>();
  private shards: Shard[] = [];
  private clock = 0;

  constructor() {
    this.layer.addChild(this.g);
  }

  update(dt: number, views: DomeView[]): void {
    this.clock += dt;
    const calm = CALM.motion;
    const g = this.g;
    g.clear();
    const seen = new Set<number>();
    for (const v of views) {
      seen.add(v.id);
      const was = this.last.get(v.id);
      // Broken just now: shatter; come back just now: grow in.
      if (was !== undefined && was > 0 && v.frac <= 0 && !calm) this.shatter(v);
      if (was !== undefined && was <= 0 && v.frac > 0 && !calm) this.grow.set(v.id, 0);
      this.last.set(v.id, v.frac);
      this.lastView.set(v.id, v);
      if (v.frac <= 0) continue;
      let k = 1;
      const gt = this.grow.get(v.id);
      if (gt !== undefined) {
        const t = gt + dt;
        if (t >= 0.45) this.grow.delete(v.id); else this.grow.set(v.id, t);
        k = 0.25 + 0.75 * easeOut(Math.min(1, t / 0.45));
      }
      this.drawDome(g, v, k, calm);
    }
    // A bearer gone with its dome still up (killed, or out of sight): the dome shatters where it stood.
    for (const id of [...this.last.keys()]) {
      if (seen.has(id)) continue;
      const lv = this.lastView.get(id);
      if (lv && (this.last.get(id) ?? 0) > 0 && !calm) this.shatter(lv);
      this.last.delete(id); this.lastView.delete(id); this.grow.delete(id);
    }
    this.drawShards(g, dt);
  }

  private drawDome(g: Graphics, v: DomeView, k: number, calm: boolean): void {
    const col = COLOR[v.caste];
    const rim = RIM[v.caste];
    const c = centre(v.ring);
    const ring = v.ring.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
    const rise = v.rise * k;
    // The bubble: its ground ring's back half, lifted into an arch over the front half.
    const top = ring.map((p) => {
      const lift = Math.max(0, 1 - Math.abs((p.x - c.x) / Math.max(1, halfWidth(ring, c))) ** 2);
      return { x: p.x, y: Math.min(p.y, c.y) - rise * Math.sqrt(lift) };
    });
    const strength = 0.35 + 0.65 * v.frac;
    const ripple = !calm && v.hitAge < 0.25 ? 1 - v.hitAge / 0.25 : 0;
    // Fill: the whole bubble (arch plus its front ground edge).
    const outline = bubbleOutline(ring, top, c);
    g.poly(outline.flatMap((p) => [p.x, p.y])).fill({ color: col, alpha: 0.14 * strength + 0.14 * ripple });
    // Its ground ring, faint.
    g.poly(ring.flatMap((p) => [p.x, p.y])).stroke({ width: 1, color: col, alpha: 0.25 * strength });
    // Latitude ribs: the carapace or the glass's facets.
    for (const f of [0.35, 0.7]) {
      const rib = top.map((p) => ({ x: c.x + (p.x - c.x) * (1 - f * 0.2), y: p.y + (c.y - p.y) * f }));
      g.poly(rib.flatMap((p) => [p.x, p.y]), false).stroke({ width: 1.2, color: rim, alpha: 0.32 * strength });
    }
    // The rim (the bubble's silhouette): brighter where a hit is being soaked.
    g.poly(outline.flatMap((p) => [p.x, p.y])).stroke({ width: 1.5 + 1.5 * ripple, color: rim, alpha: 0.45 * strength + 0.5 * ripple });
    // Cracks below a third of its pool.
    if (v.frac < 0.34) {
      const n = v.frac < 0.15 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = ((v.id * 37 + i * 71) % 360) * Math.PI / 180;
        const p0 = { x: c.x + Math.cos(a) * halfWidth(ring, c) * 0.25, y: c.y - rise * 0.55 + Math.sin(a) * rise * 0.2 };
        let p = p0;
        const pts = [p0.x, p0.y];
        for (let j = 0; j < 3; j++) {
          const b = a + (((v.id + i * 13 + j * 7) % 5) - 2) * 0.35;
          p = { x: p.x + Math.cos(b) * rise * 0.22, y: p.y + Math.sin(b) * rise * 0.16 };
          pts.push(p.x, p.y);
        }
        g.poly(pts, false).stroke({ width: 1.2, color: rim, alpha: 0.75 });
      }
    }
  }

  private shatter(v: DomeView): void {
    const c = centre(v.ring);
    const w = halfWidth(v.ring, c);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (v.id % 7) * 0.1;
      const r = 0.4 + ((i * 53 + v.id) % 10) / 16;
      this.shards.push({
        x: c.x + Math.cos(a) * w * r, y: c.y - v.rise * 0.6 + Math.sin(a) * v.rise * 0.5 * r,
        vx: Math.cos(a) * (40 + (i % 4) * 12), vy: Math.sin(a) * 26 - 30,
        rot: a, vr: (i % 2 ? 1 : -1) * (4 + (i % 3)), life: 0.6, color: RIM[v.caste],
      });
    }
  }

  private drawShards(g: Graphics, dt: number): void {
    for (const s of this.shards) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 120 * dt;
      s.rot += s.vr * dt;
      if (s.life <= 0) continue;
      const a = Math.min(1, s.life / 0.6);
      const r = 4;
      g.poly([
        s.x + Math.cos(s.rot) * r, s.y + Math.sin(s.rot) * r,
        s.x + Math.cos(s.rot + 2.3) * r * 0.6, s.y + Math.sin(s.rot + 2.3) * r * 0.6,
        s.x + Math.cos(s.rot + 4) * r * 0.8, s.y + Math.sin(s.rot + 4) * r * 0.8,
      ]).fill({ color: s.color, alpha: 0.75 * a });
    }
    this.shards = this.shards.filter((s) => s.life > 0);
  }

  /** For checks: how many domes are drawn (standing) and shards in the air. */
  drawnNow(): { standing: number; shards: number } {
    let standing = 0;
    for (const f of this.last.values()) if (f > 0) standing++;
    return { standing, shards: this.shards.length };
  }
}

function centre(ring: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of ring) { x += p.x / ring.length; y += p.y / ring.length; }
  return { x, y };
}
function halfWidth(ring: Pt[], c: Pt): number {
  let w = 1;
  for (const p of ring) w = Math.max(w, Math.abs(p.x - c.x));
  return w;
}
/** The bubble's silhouette: the arch over the ring's back half, then the ring's front half back again. */
function bubbleOutline(ring: Pt[], top: Pt[], c: Pt): Pt[] {
  const arch = top.filter((_, i) => ring[i].y <= c.y).sort((a, b) => a.x - b.x);
  const front = ring.filter((p) => p.y > c.y).sort((a, b) => b.x - a.x);
  return [...arch, ...front];
}
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
