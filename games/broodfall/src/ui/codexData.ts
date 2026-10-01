/**
 * THE LIMB CODEX's data (Collins, Oct 1 2026: "a guide to the limbs and how they work with their
 * visuals, bonuses, etc. — will use that to make decisions about what needs to be changed before
 * upgrade looks"). Everything here is READ from the content and the sim, never written by hand, so
 * the codex cannot drift from the game: the stats from content/data.ts, the words from
 * content/limbText.ts, the evolution trees from content/upgrades.ts, the upgrade-look classes from
 * content/upgradeLooks.ts, the organs that unlock a limb from content/underground.ts.
 *
 * Pure (no DOM, no Pixi): the in-game screen (src/ui/codex.ts), the decision sheet
 * (tools/codex-sheet.mjs) and tests/codex.test.ts all read it.
 */
import { TOWERS } from '../../content/data';
import { CARD_DESC, PIP_DESC, layerTag } from '../../content/limbText';
import { UPGRADES, UPGRADE_COST } from '../../content/upgrades';
import { CLASS_INFO, PIP_CLASS, lookOf, treeClasses, type LookClass } from '../../content/upgradeLooks';
import { METEOR_THEME, ORGAN_DEFS } from '../../content/underground';
import { Sim } from '../sim/sim';
import type { TowerFamily, TowerSpec, UpgradeChoice } from '../sim/types';

export type Role = 'damage' | 'artillery' | 'control' | 'support' | 'ground' | 'engine';

export const ROLE_INFO: Record<Role, { name: string; says: string }> = {
  damage: { name: 'Damage', says: 'kills what walks the streets near it' },
  artillery: { name: 'Artillery', says: 'hits from far away, often where you aim it' },
  control: { name: 'Control', says: 'slows, blocks, strips armour or drags fliers down' },
  support: { name: 'Support', says: 'makes the limbs around it stronger, or fights by proxy' },
  ground: { name: 'Ground', says: 'makes creep where the body has not reached' },
  engine: { name: 'Engine', says: 'science-priced: works on the bonuses of the limb it points at' },
};
export const ROLES: readonly Role[] = ['damage', 'artillery', 'control', 'support', 'ground', 'engine'];

/** What a limb is FOR, read from what its spec carries. The first rule that fits wins. */
export function roleOf(s: TowerSpec): Role {
  if (s.engine) return 'engine';
  if (s.family === 'sling' || s.family === 'lance') return 'ground';
  if (s.rateAura || s.wardShield || s.broodCount || s.family === 'cage') return 'support';
  if (s.slowMult || s.swamp || s.shred || s.grounds || s.pheromone || s.family === 'spine') return 'control';
  if (s.range >= 160 || s.aimedVolley || s.markerFire) return 'artillery';
  return 'damage';
}

export interface CodexOption { choice: 'A' | 'B'; name: string; text: string; cls: LookClass }
export interface CodexStage { stage: 1 | 2 | 3; cost: { science?: number; royal?: number }; options: [CodexOption, CodexOption] }

export interface CodexEntry {
  family: TowerFamily;
  name: string;
  /** The card's line. */
  desc: string;
  role: Role;
  /** AIR + GROUND / GROUND / AIR ONLY / SUPPORT (the card's tag). */
  layer: string;
  cost: { war?: number; science?: number };
  /** The sum of its prices in meat, whatever the caste. */
  price: number;
  range: number; rate: number; damage: number; aoe: number; maxHp: number;
  /** Damage a second on one target from its own hits (every pellet landing), before poison and fire. */
  dps: number;
  /** Damage over time it puts on a target (poison, burn, pheromone, swamp), a second. */
  dot: number;
  /** One cell, or BIG (2x2), or LONG (1x2, turned to fit). */
  size: 'one' | 'big' | 'long';
  cells: number;
  directional: boolean;
  /** In the card draw at all (the Trap Cage and the Seedling are handed out, never drawn). */
  drawn: boolean;
  weight: number;
  /** What it does, in short marks: pierce, poison, slows, chains 3, 5 pellets… */
  traits: string[];
  /** What a limb that eats it gets. */
  donor: string;
  /** The upgrade-look class the bonus it teaches belongs to. */
  pipClass: LookClass;
  /** The organ that puts it in the draw ("Meteor Core" from the start), or why it is never drawn. */
  unlockedBy: string;
  /** Theme organs whose SIGNATURE verb is this limb's bonus: they share it with the organs they touch. */
  signatureOf: string[];
  /** The other limbs its organ unlocks (they all level together with that organ). */
  themeMates: TowerFamily[];
  /** Engines that can work on it: the boomerang only takes limbs that fire projectiles. */
  fires: boolean;
  projectiles: boolean;
  tree: CodexStage[];
  /** How many of the six evolution options fall in each class. */
  treeClassCount: Record<LookClass, number>;
  /**
   * The looks its eight evolution paths reach with no eaten bonus (content/upgradeLooks.ts lookOf, after all
   * three stages): a class (`bone`) or a superstructure (`bone+venom`). Eaten bonuses can reach others.
   */
  evoLooks: string[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function traitsOf(s: TowerSpec): string[] {
  const t: string[] = [];
  if (s.pierce) t.push('pierces');
  if (s.pellets) t.push(`${s.pellets} pellets`);
  if (s.chains) t.push(`arcs ×${s.chains}`);
  if (s.aoe > 0) t.push(`splash ${s.aoe}`);
  if (s.cone) t.push('cone');
  if (s.poisonDps) t.push(`poison ${s.poisonDps}/s`);
  if (s.burnDps) t.push(`burn ${s.burnDps}/s, spreads`);
  if (s.shred) t.push(`shreds armour ${s.shred}`);
  if (s.slowMult) t.push(`slows ×${s.slowMult}`);
  if (s.swamp) t.push(`digests under ${s.swamp.execute} hp`);
  if (s.pheromone) t.push(`toxic cloud ${s.pheromone.dps}/s`);
  if (s.grounds) t.push(`grounds fliers ${s.grounds}s`);
  if (s.skips) t.push(`skips ×${s.skips}`);
  if (s.detects) t.push(`reveals ${s.detects}px`);
  if (s.sniper) t.push('board-wide sniper');
  if (s.prismLink) t.push('relays charge');
  if (s.aimedVolley) t.push('you aim it');
  if (s.markerFire) t.push('fires at your marker');
  if (s.rateAura) t.push(`+${Math.round(s.rateAura * 100)}% rate aura`);
  if (s.wardShield) t.push(`shield ${s.wardShield} aura`);
  if (s.broodCount) t.push(`${s.broodCount} broodlings`);
  if (s.eatThreshold > 0) t.push(`eats ≤${s.eatThreshold} hp whole`);
  if (s.interest > 0) t.push(`interest +${s.interest}`);
  if (s.pair) t.push('comes as a pair');
  if (s.engine) t.push(`engine: ${s.engine.kind}, reach ${s.engine.reach}`);
  if (s.directional) t.push('faces one way');
  if (!t.length && s.rate > 0) t.push('one target a shot');
  return t;
}

/** Every limb family in the game, in the content's order. `variants`: a limb's prototyped upgrade looks (the art manifest's keys), when known. */
export function codexEntries(): CodexEntry[] {
  return TOWERS.map((s) => {
    const theme = [{ name: METEOR_THEME.name, unlocks: METEOR_THEME.unlocks, signature: METEOR_THEME.signature }, ...ORGAN_DEFS]
      .find((o) => o.unlocks?.includes(s.family));
    const signatureOf = [{ name: METEOR_THEME.name, signature: METEOR_THEME.signature }, ...ORGAN_DEFS]
      .filter((o) => o.signature === s.family).map((o) => o.name);
    const classes = treeClasses(s.family);
    const tree = UPGRADES[s.family].map((pair, i) => ({
      stage: (i + 1) as 1 | 2 | 3,
      cost: { ...UPGRADE_COST[i] },
      options: pair.map((o, j) => ({ choice: j === 0 ? 'A' : 'B', name: o.name, text: o.text, cls: classes[i][j] })) as [CodexOption, CodexOption],
    }));
    const treeClassCount = { bone: 0, swarm: 0, venom: 0, reach: 0 } as Record<LookClass, number>;
    for (const st of tree) for (const o of st.options) treeClassCount[o.cls]++;
    const evoLooks = [...new Set((['AAA', 'AAB', 'ABA', 'ABB', 'BAA', 'BAB', 'BBA', 'BBB'] as const).map((path) =>
      lookOf({ family: s.family, upgrades: [...path] as UpgradeChoice[], pips: [] }).key).filter((k): k is NonNullable<typeof k> => !!k))].sort();
    const cells = s.span ? s.span[0] * s.span[1] : 1;
    const dot = (s.poisonDps ?? 0) + (s.burnDps ?? 0) + (s.pheromone?.dps ?? 0) + (s.swamp?.dps ?? 0);
    const price = (s.cost.war ?? 0) + (s.cost.science ?? 0) + (s.cost.royal ?? 0);
    return {
      family: s.family, name: s.name, desc: CARD_DESC[s.family], role: roleOf(s), layer: layerTag(s.family),
      cost: { ...(s.cost.war ? { war: s.cost.war } : {}), ...(s.cost.science ? { science: s.cost.science } : {}) },
      price,
      range: s.range, rate: s.rate, damage: s.damage, aoe: s.aoe, maxHp: s.maxHp,
      dps: r1(s.damage * s.rate * (s.pellets ?? 1)), dot,
      size: !s.span ? 'one' : s.span[0] === s.span[1] ? 'big' : 'long', cells,
      directional: !!s.directional, drawn: s.weight > 0, weight: s.weight,
      traits: traitsOf(s), donor: PIP_DESC[s.family], pipClass: PIP_CLASS[s.family],
      unlockedBy: s.weight === 0 ? (s.family === 'cage' ? 'never drawn: the Puppet Queen experiment hands it out' : 'never drawn: the Seeding Gland grows it')
        : theme?.name ?? 'not unlocked by any organ',
      signatureOf,
      themeMates: (theme?.unlocks ?? []).filter((f) => f !== s.family),
      fires: s.rate > 0 || !!s.aimedVolley || !!s.markerFire,
      projectiles: Sim.firesProjectiles(s.family),
      tree, treeClassCount, evoLooks,
    } satisfies CodexEntry;
  });
}

export { CLASS_INFO };
