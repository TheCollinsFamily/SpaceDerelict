/**
 * THE CREEP DIGESTING THE DEAD (Oct 1 2026). Collins: "the meat moving to the tower center looks weird, just
 * have it dissolve in creep ... have a death image of the unit, then it dissolving, then gone ... and have
 * corpses pile up where there is no creep, then dissolve when the creep reaches them." The meat is banked only
 * when the creep digests a body (src/sim/types.ts Corpse): the creep is how the asset absorbs, that is
 * digitises, the dead into the archive.
 *
 * The bodies themselves are the units' own death pictures (src/render/isoRender.ts `syncDying`: sunk, darkened
 * and faded as they dissolve). This draws what goes with them, in code, no art:
 *  - while one dissolves: dark veins reaching into it from the creep under it, and a little bubbling;
 *  - when one is gone: a faint flesh-coloured pulse running along the ground to the core (the meat arriving);
 *  - a body lying OFF the creep with meat in it: a dim glint of its meat's caste colour, now and then, so
 *    unclaimed meat can be found (most of all science bodies at the creep's edge, where the science caste falls).
 * Reduce motion: no bubbles, no pulses, a steady glint.
 */
import { Container, Graphics } from 'pixi.js';
import type { Caste } from '../sim/types';
import { CASTE_COLORS } from './render';
import { CALM } from '../meta/settings';

/** One body as the renderer sees it this frame (screen px). */
export interface BodyView {
  id: number;
  /** Where it touches the ground, and how big it is on screen. */
  x: number; y: number; size: number;
  /** 0 lying, 0..1 dissolving. */
  prog: number;
  digesting: boolean;
  /** The caste most of its meat is (null: it carries none). */
  caste: Caste | null;
}

interface Pulse { x: number; y: number; t: number; dur: number; caste: Caste }

const FLESH = 0xd4646a;
const VEIN = 0x5a0e16;

export class CorpseFx {
  readonly ground = new Container();
  readonly glow = new Container();
  private veins = new Graphics();
  private light = new Graphics();
  private pulses: Pulse[] = [];
  private clock = 0;
  /** Bodies digested so far (the beats read it). */
  digested = 0;

  constructor() {
    this.ground.addChild(this.veins);
    this.glow.blendMode = 'add';
    this.glow.addChild(this.light);
  }

  reset(): void { this.pulses = []; }

  /** A body is gone into the creep: its meat runs to the core. */
  arrive(x: number, y: number, caste: Caste | null, core: { x: number; y: number }): void {
    this.digested++;
    if (CALM.motion || !caste || this.pulses.length >= 40) return;
    const d = Math.hypot(core.x - x, core.y - y);
    this.pulses.push({ x, y, t: 0, dur: Math.min(1.4, 0.5 + d / 900), caste });
  }

  draw(bodies: BodyView[], core: { x: number; y: number }, scale: number, dt: number): void {
    this.clock += dt;
    const v = this.veins.clear();
    const g = this.light.clear();
    for (const b of bodies) {
      const seed = (b.id * 0.6180339) % 1;
      if (b.digesting) {
        // Veins from the creep reaching into the body, longest in the middle of the dissolve.
        const reach = b.size * (0.35 + 0.55 * Math.sin(Math.min(1, b.prog) * Math.PI));
        const a = 0.65 * (1 - b.prog * 0.6);
        for (let i = 0; i < 6; i++) {
          const ang = seed * 6.283 + (i * Math.PI) / 3;
          const ex = b.x + Math.cos(ang) * reach;
          const ey = b.y + Math.sin(ang) * reach * 0.5;
          const mx = (b.x + ex) / 2 + Math.sin(ang * 3 + seed) * reach * 0.18;
          const my = (b.y + ey) / 2 + Math.cos(ang * 2) * reach * 0.1;
          v.moveTo(ex, ey).quadraticCurveTo(mx, my, b.x, b.y).stroke({ width: Math.max(1, 2.2 * scale * (1 - b.prog * 0.5)), color: VEIN, alpha: a });
        }
        v.ellipse(b.x, b.y, b.size * 0.42, b.size * 0.2).fill({ color: VEIN, alpha: 0.35 * (1 - b.prog) });
        // A little bubbling while it goes.
        if (!CALM.motion) {
          for (let i = 0; i < 4; i++) {
            const ph = (this.clock * (1.1 + i * 0.37) + seed * 7 + i * 0.29) % 1;
            const bx = b.x + Math.sin(seed * 40 + i * 2.1) * b.size * 0.3;
            const by = b.y - b.size * 0.1 - ph * b.size * 0.25;
            const r = (1 + 2.2 * Math.sin(ph * Math.PI)) * scale;
            v.circle(bx, by, r).stroke({ width: Math.max(0.6, scale * 0.8), color: FLESH, alpha: 0.5 * (1 - ph) * (1 - b.prog * 0.5) });
          }
        }
      } else if (b.caste) {
        // Unclaimed meat: a dim glint of its caste's colour, every couple of seconds, out of step with its neighbours.
        // A small diamond floating over it, never quite out, brightening now and then.
        const col = CASTE_COLORS[b.caste];
        const k = CALM.motion ? 0.6 : 0.5 + 0.5 * Math.sin((this.clock / 1.8 + seed) * Math.PI * 2);
        const bob = CALM.motion ? 0 : Math.sin((this.clock / 1.8 + seed) * Math.PI * 2) * b.size * 0.03;
        const gy = b.y - b.size * 0.62 - bob;
        const r = Math.max(2.5 * scale, b.size * 0.09);
        g.circle(b.x, gy, r * 1.7).fill({ color: col, alpha: 0.08 + 0.16 * k });
        g.moveTo(b.x - r, gy).lineTo(b.x, gy - r * 1.3).lineTo(b.x + r, gy).lineTo(b.x, gy + r * 1.3).closePath().fill({ color: col, alpha: 0.55 + 0.4 * k });
      }
    }
    // The meat running to the core along the ground.
    this.pulses = this.pulses.filter((p) => (p.t += dt) < p.dur);
    for (const p of this.pulses) {
      const k = p.t / p.dur;
      const e = k * k * (3 - 2 * k);
      const x = p.x + (core.x - p.x) * e;
      const y = p.y + (core.y - p.y) * e;
      const col = CASTE_COLORS[p.caste];
      const fade = Math.sin(k * Math.PI);
      g.circle(x, y, 5 * scale).fill({ color: FLESH, alpha: 0.28 * fade });
      g.circle(x, y, 2.4 * scale).fill({ color: col, alpha: 0.55 * fade });
    }
  }

  /** On screen now (the beats read it). */
  counts(): { pulses: number; digested: number } { return { pulses: this.pulses.length, digested: this.digested }; }
}

/**
 * The caste a body glints in: royal if it holds any royal meat, then science, then war (null: it carries none).
 * Rarest first, and science before war on purpose (Collins, Oct 1 2026: the science caste attacks the outermost
 * limbs, so its bodies fall at the creep's edge; that is where the player looks for them).
 */
export function mainCaste(meat: Record<Caste, number>): Caste | null {
  for (const c of ['royal', 'science', 'war'] as Caste[]) if (meat[c] > 0) return c;
  return null;
}
