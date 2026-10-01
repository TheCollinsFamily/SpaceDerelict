/**
 * UPGRADE LOOKS (Collins, Sep 30 2026): "are the towers changing with upgrades? (maybe have like a
 * class of change so like x with any of yps or h leads to y change and x with 2 4 5 leads to another
 * then you get super structures for when you have them combined with yps and 245".
 *
 * A limb changes its LOOK by the CLASS of what it carries, not per upgrade. Every evolution option
 * and every pip (a verb grown or eaten) belongs to exactly ONE of four classes:
 *
 *   BONE   heavy and armoured: hits harder, more hp, pierces, shields, swallows bigger
 *   SWARM  fast and many: fires faster, more shots, more targets, arcs, splash, skips, copies
 *   VENOM  caustic: poison, fire, acid and armour-shred, toxic clouds, digestion
 *   REACH  grasp and range: slows, snares, drags fliers down, knocks back, wider, farther, sees
 *
 * Points: an evolution stage bought counts 2 for its class (the royal stage 3 counts 3); every
 * pip the limb carries from a cannibalized donor counts 1.
 *   - CLASS LOOK: a class at 2 points or more (one evolution in it, or two pips of it).
 *   - SUPERSTRUCTURE: two classes at 3 points or more each (the combination Collins asked for).
 *
 * RENDER ONLY: the sim never reads this file. Full design: DESIGN.md "Upgrade looks" and
 * notes/UPGRADE-LOOKS.md.
 */
import type { ModPip, TowerFamily, UpgradeChoice, UpgradeOption } from '../src/sim/types';
import { UPGRADES } from './upgrades';

export type LookClass = 'bone' | 'swarm' | 'venom' | 'reach';
export const LOOK_CLASSES: readonly LookClass[] = ['bone', 'swarm', 'venom', 'reach'];

export const CLASS_INFO: Record<LookClass, { name: string; says: string; look: string }> = {
  bone: { name: 'Bone', says: 'heavy and armoured: harder hits, more hp, pierce, shields, swallows bigger', look: 'broader and armoured: thick ivory bone plates, a crest of bone spikes' },
  swarm: { name: 'Swarm', says: 'fast and many: faster, more shots, more targets, arcs, splash, skips, copies', look: 'multiplied: its working part budded into three, buds clustered at its base' },
  venom: { name: 'Venom', says: 'caustic: poison, fire, acid and shred, toxic clouds, digestion', look: 'swollen: bulging acid yellow-green glands between its plates, dripping' },
  reach: { name: 'Reach', says: 'grasp and range: slow, snare, grounds fliers, knockback, wider, farther, sees', look: 'taller and grasping: a longer neck or stalk, mucus guy-ropes and tendrils out to the sides' },
};

/** The six superstructures: two classes combined. Keyed by the pair in LOOK_CLASSES order. */
export type SuperKey = 'bone+swarm' | 'bone+venom' | 'bone+reach' | 'swarm+venom' | 'swarm+reach' | 'venom+reach';
export const SUPERS: Record<SuperKey, { name: string; look: string }> = {
  'bone+swarm': { name: 'Bone Hydra', look: 'an armoured mass of many heads: its working part multiplied, every copy clad in bone and crowned with spikes' },
  'bone+venom': { name: 'Plague Bastion', look: 'a massive armoured bastion with glowing venom glands bulging between its bone plates' },
  'bone+reach': { name: 'Siege Spire', look: 'a tall armoured spire on a bone column, anchored by taut tendon guy-ropes' },
  'swarm+venom': { name: 'Spore Hive', look: 'a towering hive of many mouths on a body studded with swollen dripping venom glands' },
  'swarm+reach': { name: 'Storm Crown', look: 'a tall crown of many branching tips on a raised stalk, strands reaching out to the sides' },
  'venom+reach': { name: 'Weeping Snare', look: 'a tall dripping canopy: venom glands weeping acid down mucus strands spread wide around it' },
};

/** The class of the pip each family teaches (what it gives a limb that eats it). */
export const PIP_CLASS: Record<TowerFamily, LookClass> = {
  // BONE: harder, tougher, holds, hoards and eats
  lasher: 'bone', spine: 'bone', impaler: 'bone', ward: 'bone', brood: 'bone', maw: 'bone',
  hatch: 'bone',
  reliquary: 'bone', press: 'bone', tap: 'bone',
  // SWARM: faster and more
  spitter: 'swarm', burster: 'swarm', quill: 'swarm', twin: 'swarm', frond: 'swarm', prism: 'swarm',
  skipper: 'swarm', mitosis: 'swarm', capacitor: 'swarm', boomerang: 'swarm', sprout: 'swarm',
  amp: 'swarm', mosaic: 'swarm', conduit: 'swarm',
  // VENOM: poison, fire, acid, clouds, digestion
  blighter: 'venom', ember: 'venom', mister: 'venom', lure: 'venom', swamp: 'venom',
  // REACH: slow, snare, grounding, knockback, range, sight, creep reach
  tangler: 'reach', net: 'reach', ocular: 'reach', lobber: 'reach', bombard: 'reach', choir: 'reach',
  sling: 'reach', lance: 'reach', cage: 'reach',
};

/** What each numeric stat, flag or multiplier of an evolution says, when it grows (2 points toward the class). */
const STAT_CLASS: Record<string, LookClass> = {
  // add / mult keys
  maxHp: 'bone', eatThreshold: 'bone', returnDmg: 'bone', rebirth: 'bone', captures: 'bone', captureAt: 'bone',
  pressBonus: 'bone', pressRoyalEvery: 'bone', tapWar: 'bone', yieldMult: 'bone',
  chains: 'swarm', extraTargets: 'swarm', extraBroodlings: 'swarm', skips: 'swarm', twinPower: 'swarm',
  budCount: 'swarm', budPips: 'swarm', capSpeed: 'swarm', capCharge: 'swarm', capTrickle: 'swarm',
  returnLegs: 'swarm', engineCap: 'swarm', poolMult: 'swarm', ampFactor: 'swarm', ampExtraLayers: 'swarm',
  mosaicCopies: 'swarm', streakRamp: 'swarm', tapCopies: 'swarm', relicCopies: 'swarm',
  poisonDps: 'venom', poisonDur: 'venom', burnDps: 'venom', burnDur: 'venom', shred: 'venom', shredDur: 'venom',
  execute: 'venom', interest: 'venom',
  aoe: 'reach', slowMult: 'reach', slowDur: 'reach', grounding: 'reach', gather: 'reach', budRing: 'reach',
  knock: 'reach', rootDur: 'reach',
  // set flags
  hitsAir: 'reach', hitsGround: 'reach', trueSight: 'reach', pierce: 'bone', ampRoundUp: 'swarm',
  gentleTap: 'bone', targetSelf: 'swarm',
};

/**
 * Hand-set classes where the rule reads an option wrongly: "more potent" on a limb whose whole
 * verb is poison or acid is more VENOM, not more BONE. `family:stage:choice`.
 */
export const CLASS_OVERRIDES: Record<string, LookClass> = {
  'lure:1:A': 'venom', // Strong Musk: clouds 60% more toxic
  'swamp:1:A': 'venom', // Deep Bog: burns 60% harder
};

/**
 * The class of one evolution option. Every effect it names scores for its class: each verb (pip)
 * it grows or pushes 1, each stat, flag or multiplier that GROWS 2 (tempo up is SWARM, potency up
 * BONE, reach up REACH). The most points win; a tie goes to the effect named first.
 */
export function optionClass(opt: UpgradeOption, where?: { family: TowerFamily; stage: number; choice: UpgradeChoice }): LookClass {
  if (where) {
    const o = CLASS_OVERRIDES[`${where.family}:${where.stage + 1}:${where.choice}`];
    if (o) return o;
  }
  const score = new Map<LookClass, number>();
  const add = (c: LookClass, n: number) => score.set(c, (score.get(c) ?? 0) + n);
  for (const [k, v] of Object.entries(opt)) {
    if (k === 'tempo' && typeof v === 'number' && v > 1) add('swarm', 2);
    else if (k === 'potency' && typeof v === 'number' && v > 1) add('bone', 2);
    else if (k === 'reach' && typeof v === 'number' && v > 1) add('reach', 2);
    else if ((k === 'pips' || k === 'targetPips') && Array.isArray(v)) for (const f of v as TowerFamily[]) add(PIP_CLASS[f], 1);
    else if ((k === 'add' || k === 'mult' || k === 'set') && v && typeof v === 'object') {
      for (const [s, n] of Object.entries(v as Record<string, number | boolean>)) {
        const c = STAT_CLASS[s];
        if (!c) continue;
        // A stat that grows: an add above 0, a multiplier above 1 (a slow multiplier BELOW 1 bites deeper), a flag set.
        const grows = typeof n === 'boolean' ? n : k === 'add' ? n > 0 : s === 'slowMult' ? n < 1 : n > 1;
        if (grows) add(c, 2);
      }
    }
  }
  let best: LookClass | null = null;
  for (const [c, n] of score) if (best === null || n > score.get(best)!) best = c;
  // An option that grows nothing the rule knows (none today: tests/upgradeLooks.test.ts) reads as BONE.
  return best ?? 'bone';
}

/** The classes of a family's tree: [stage][A=0,B=1]. */
export function treeClasses(family: TowerFamily): LookClass[][] {
  return UPGRADES[family].map((pair, stage) => pair.map((o, i) => optionClass(o, { family, stage, choice: i === 0 ? 'A' : 'B' })));
}

/** Points a stage bought is worth: stages 1 and 2 two, the royal stage 3 three. */
export const STAGE_POINTS = [2, 2, 3] as const;
export const CLASS_AT = 2;
export const SUPER_AT = 3;

export interface LimbLook {
  /** What to draw: null (its own look), a class, or a superstructure (two classes). */
  key: LookClass | SuperKey | null;
  /** The class shown when its superstructure is not drawn (the stronger of the two). */
  top: LookClass | null;
  points: Record<LookClass, number>;
}

/** The look a limb carrying these evolutions and pips has earned (render only). */
export function lookOf(t: { family: TowerFamily; upgrades?: UpgradeChoice[]; pips: ModPip[] }): LimbLook {
  const points: Record<LookClass, number> = { bone: 0, swarm: 0, venom: 0, reach: 0 };
  // Which class each got most lately: the tie-break (the change the player just made is the one seen).
  const last: Record<LookClass, number> = { bone: -1, swarm: -1, venom: -1, reach: -1 };
  const tree = UPGRADES[t.family];
  let order = 0;
  t.pips.forEach((p) => { const c = PIP_CLASS[p.family]; if (!c) return; points[c] += 1; last[c] = order++; });
  (t.upgrades ?? []).forEach((ch, stage) => {
    const opt = tree?.[stage]?.[ch === 'A' ? 0 : 1];
    if (!opt) return;
    const c = optionClass(opt, { family: t.family, stage, choice: ch });
    points[c] += STAGE_POINTS[stage] ?? 2;
    // An evolution outranks a pip in a tie: it is what the player chose for this limb.
    last[c] = 1000 + stage;
  });
  const ranked = [...LOOK_CLASSES].sort((a, b) => points[b] - points[a] || last[b] - last[a] || LOOK_CLASSES.indexOf(a) - LOOK_CLASSES.indexOf(b));
  const [a, b] = ranked;
  const top = points[a] >= CLASS_AT ? a : null;
  if (top && points[a] >= SUPER_AT && points[b] >= SUPER_AT) {
    const pair = [a, b].sort((x, y) => LOOK_CLASSES.indexOf(x) - LOOK_CLASSES.indexOf(y)).join('+') as SuperKey;
    return { key: pair, top, points };
  }
  return { key: top, top, points };
}
