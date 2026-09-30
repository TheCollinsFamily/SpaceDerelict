/**
 * WHAT A UNIT IS DOING, as the board draws it (Sep 30 2026): flinching when struck, a braced gun
 * firing, a boss arriving and making its special attack, the carapace lord's shell breaking.
 *
 * Everything here READS the sim's units and never writes to them: the sim stays deterministic
 * and knows nothing of drawing. What happened is found by comparing a unit with how it was the
 * frame before (its hp went down: it was struck; its shots went up: it fired).
 */
import type { Enemy } from '../sim/types';
import type { Clip, UnitArt, View } from './art';

/** How long a flinch plays, seconds, and how long before the same unit flinches again. */
export const HIT_PLAY = 0.42;
export const HIT_COOLDOWN = 1.4;
/** A flinch needs a real blow: this share of the unit's hp (or one hit on a shell) since its last flinch. */
export const HIT_SHARE = 0.03;
/** The royal's command, every this many seconds while she fights. */
export const ROYAL_SPECIAL_EVERY = 9;
/** How much bigger the bosses are drawn than their radius says. */
export const BOSS_SCALE: Record<string, number> = { royal: 1.2, consort: 1.2 };

/** What the board remembers of one unit between frames, to see what happened to it. */
export interface UnitFx {
  hp: number; shield: number; shots: number; aux: number; deployed: boolean;
  /** Seconds since the flinch, the braced shot, the arrival and the special began (Infinity: not playing). */
  hitT: number; braceT: number; enterT: number; specialT: number;
  hitCool: number; specialCool: number; hurt: number;
  /** Seconds since the shell was last chipped, and since the gun dug in (for what is drawn in code with them). */
  chipT: number; digT: number;
}

export function newFx(e: Enemy, art: UnitArt | null): UnitFx {
  return {
    hp: e.hp, shield: e.hitShield ?? 0, shots: e.shotsFired ?? 0, aux: e.auxCooldown ?? 0, deployed: !!e.deployed,
    hitT: Infinity, braceT: Infinity, enterT: art?.anims.enter ? 0 : Infinity, specialT: Infinity,
    hitCool: 0, specialCool: 3, hurt: 0, chipT: Infinity, digT: Infinity,
  };
}

/** Advance a unit's memory by one frame: what struck it, what it fired, what it began. Reads `e` only. */
export function observe(fx: UnitFx, e: Enemy, dt: number, kind: string, attacking: boolean): void {
  for (const k of ['hitT', 'braceT', 'enterT', 'specialT', 'chipT', 'digT'] as const) fx[k] += dt;
  fx.hitCool -= dt;
  fx.specialCool -= dt;
  // Struck: hp went down, or a plate of its shell came off.
  const shield = e.hitShield ?? 0;
  if (shield < fx.shield) { fx.hurt += e.maxHp; fx.chipT = 0; }
  if (e.hp < fx.hp) fx.hurt += fx.hp - e.hp;
  fx.hp = e.hp;
  fx.shield = shield;
  if (fx.hurt >= Math.max(1, e.maxHp * HIT_SHARE) && fx.hitCool <= 0) {
    fx.hitT = 0;
    fx.hitCool = HIT_COOLDOWN;
    fx.hurt = 0;
  } else if (fx.hitCool > 0) {
    // A blow during the cooldown is not saved up for later: no flinch comes a second after nothing.
    fx.hurt = 0;
  }
  // Dug in, and fired from where it is dug in.
  if (e.deployed && !fx.deployed) fx.digT = 0;
  fx.deployed = !!e.deployed;
  const shots = e.shotsFired ?? 0;
  if (shots > fx.shots) fx.braceT = 0;
  fx.shots = shots;
  // The consort's promotion: his pulse was just wound up again.
  const aux = e.auxCooldown ?? 0;
  if (kind === 'consort' && aux > fx.aux + 1) fx.specialT = 0;
  fx.aux = aux;
  // The royal's command, while she fights.
  if (kind === 'royal' && attacking && fx.specialCool <= 0) { fx.specialT = 0; fx.specialCool = ROYAL_SPECIAL_EVERY; }
}

/** How long a one-off clip plays, seconds: its own speed, but never slower than `most`. */
export const playFor = (c: Clip, most = 2.4): number => Math.min(most, c.count / Math.max(0.1, c.fps));

export interface Choice { clip: Clip; at: number }

/**
 * Which clip a unit shows this frame, and which frame of it. In order: its arrival; a state it is
 * held in (buried, netted, carrying); braced (its shot, or its braced picture); a flinch; its special;
 * attacking; walking (in its skin, when it has one for how it is now).
 */
export function choose(art: UnitArt, view: View, fx: UnitFx, o: {
  state?: Clip; deployed?: Clip; walk: Clip; skin?: Clip; strike?: Clip; phase: number; attackT: number; period: number;
}): Choice {
  const once = (set: Partial<Record<View, Clip>> | undefined, t: number, most?: number): Choice | null => {
    const c = set?.[view] ?? set?.SW;
    if (!c) return null;
    const d = playFor(c, most);
    return t < d ? { clip: c, at: (t / d) * c.count } : null;
  };
  const enter = once(art.anims.enter, fx.enterT, 2.2);
  if (enter) return enter;
  if (o.state) return { clip: o.state, at: 0 };
  if (o.deployed) return once(art.anims.braced, fx.braceT, 1.2) ?? { clip: o.deployed, at: 0 };
  const hit = art.anims.hit?.[view];
  if (hit && fx.hitT < HIT_PLAY) return { clip: hit, at: (fx.hitT / HIT_PLAY) * hit.count };
  const special = once(art.anims.special, fx.specialT, 2.4);
  if (special) return special;
  const walk = o.skin ?? o.walk;
  if (o.strike && !o.skin) return { clip: o.strike, at: ((o.attackT % o.period) / o.period) * o.strike.count };
  return { clip: walk, at: o.phase * walk.count };
}

/** The walking skin of a unit as it is now: the carapace lord's shell cracked from half down, then gone. */
export function skinOf(art: UnitArt, e: Enemy, view: View, fullShield: number | undefined): Clip | undefined {
  if (e.hitShield === undefined || !fullShield) return undefined;
  const name = e.hitShield <= 0 ? 'walk-stripped' : e.hitShield <= fullShield / 2 ? 'walk-cracked' : null;
  if (!name) return undefined;
  const set = art.anims[name as `walk-${string}`];
  return set?.[view] ?? set?.SW;
}
