/**
 * THE BODY FLINCHES WHEN THE HIVE HITS IT (Nov 22 2026). Collins, playtesting: "there is no sound effect or hit
 * effect when an enemy unit hits my base and presumably none when science team members are hitting limbs". The
 * sim tells every blow ('core-hit', 'limb-hit' in src/sim/types.ts); main.ts hands them to the renderer
 * (IsoRenderer.hit) and to the sound (src/audio/gameSounds.ts). Here: how long a flinch lasts and how strong it
 * is now, kept apart from the drawing so the tests can read it.
 *
 * What is drawn (src/render/isoRender.ts): the struck thing is shoved a few pixels AWAY from the blow and squashed
 * a little, lit red for a moment, and a splat bursts on its side facing the attacker. Reduce motion: no shove and
 * no squash. Reduce flashes: no light added, a soft tint instead.
 */

/** Seconds (real time) a flinch lasts. */
export const HIT_SHOW = 0.3;

/** A blow is heavy from this much harm, or always from a shell or a bomber (the same rule as its sound). */
export const HEAVY_HIT = 20;
export const heavyHit = (e: { amount: number; by: string }): boolean => e.by === 'shell' || e.by === 'blast' || e.amount >= HEAVY_HIT;

/** How hard a blow reads, 0.9 .. 1.6: a skitterling's nip still reads at a glance, an elite's or a shell's is bigger. */
export function hitStrength(e: { amount: number; by: string }): number {
  return Math.min(1.6, (heavyHit(e) ? 1.15 : 0.9) + e.amount / 80);
}

/** How strong a flinch `t` seconds old is now, 1 .. 0: sharp at once, easing out. */
export function flinch(t: number, dur = HIT_SHOW): number {
  if (t < 0 || t >= dur) return 0;
  const u = t / dur;
  return (1 - u) * (1 - u);
}

/**
 * A blow being shown: its age, the way it came from (a unit vector on the ground, toward the attacker), its strength;
 * where on the screen it landed and how big its ring of impact opens (board pixels), set by the renderer.
 */
export interface HitMark { t: number; dx: number; dy: number; k: number; shielded: boolean; p?: { x: number; y: number }; ring?: number }

/** The ring of impact where a blow landed, `t` seconds in: its radius as a share of its full size, and its opacity. */
export function hitRing(t: number, k: number, still = false, dur = HIT_SHOW): { r: number; a: number } {
  if (t < 0 || t >= dur) return { r: 0, a: 0 };
  const u = t / dur;
  return { r: still ? 0.8 : 0.35 + 0.65 * Math.sqrt(u), a: Math.min(1, 0.55 + 0.3 * k) * (1 - u) };
}

/** The blows being shown: the core's and each limb's (the one that reads strongest now wins). */
export class HitMarks {
  core: HitMark | null = null;
  readonly limbs = new Map<number, HitMark>();

  step(dt: number): void {
    if (this.core) { this.core.t += dt; if (this.core.t >= HIT_SHOW) this.core = null; }
    for (const [id, m] of this.limbs) { m.t += dt; if (m.t >= HIT_SHOW) this.limbs.delete(id); }
  }

  private keep(old: HitMark | null | undefined, m: HitMark): HitMark {
    return old && old.k * flinch(old.t) > m.k ? old : m;
  }

  hitCore(m: HitMark): void { this.core = this.keep(this.core, m); }
  hitLimb(id: number, m: HitMark): void { this.limbs.set(id, this.keep(this.limbs.get(id), m)); }

  /** How strongly the core / a limb flinches now (0: not at all). */
  coreNow(): number { return this.core ? this.core.k * flinch(this.core.t) : 0; }
  limbNow(id: number): number { const m = this.limbs.get(id); return m ? m.k * flinch(m.t) : 0; }
}
