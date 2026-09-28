/**
 * THE ORGAN STAGE (Collins, Sep 28 2026): a separate between-waves stage, like
 * the town in BALL x PIT. Flow: wave setup (starting meat) → wave 1 → organ
 * stage → wave setup → wave 2 → … Leftover meat is spent here or on limbs; it
 * is LOST when the next wave starts (royal points are kept).
 *
 * What organs are FOR: which limbs you can draw, and how strong they are.
 *   THEME organs unlock a group of limbs into your card draw (build the
 *   Spawning Pool, get zerglings) and power them — every level is +10%
 *   potency and tempo for that theme's limbs.
 *   ZONE organs (heart, brain, gland) project a zone one cell around them; any
 *   organ touching the zone is boosted (Ball x Pit's Captain's Quarters).
 *   ROOT is cheap connecting tissue that also carries adjacency along it.
 *
 * ADJACENCY: every theme organ has a SIGNATURE verb. Two organs that touch
 * (edge to edge, or joined by a chain of roots) share signatures: all the
 * limbs of one theme gain +1 of the other's verb, and vice versa. A gland's
 * zone doubles what the organs in it share. Terrain features raise the level
 * of organs touching them. Deposits pay when an organ is grown over them.
 *
 * Shapes are polyomino footprints (right-click rotates while placing). The
 * board is small on purpose: plan for organs you have not built yet.
 */
import type { OrganId, TowerFamily } from '../src/sim/types';

export const UNDER_W = 13;
export const UNDER_H = 9;
/** The meteor's buried half: columns and rows it fills at the top middle. */
export const METEOR_COLS = [5, 6, 7] as const;
export const METEOR_ROWS = [0, 1] as const;
/** Share of cells below the topsoil that are rock (can't be grown into). */
export const ROCK_SHARE = 0.1;

export type OrganKind = 'theme' | 'zone' | 'root';
export type ZoneEffect = 'level' | 'draw' | 'share';

export interface OrganDef {
  id: OrganId;
  name: string;
  kind: OrganKind;
  /** Footprint cells [x, y] before rotation. */
  shape: readonly (readonly [number, number])[];
  cost: { war?: number; science?: number };
  /** Theme organs: the limbs they put into your draw. */
  unlocks?: readonly TowerFamily[];
  /** Theme organs: the verb they share with every organ they touch. */
  signature?: TowerFamily;
  /** Zone organs: what they do to organs touching their zone. */
  zone?: ZoneEffect;
  blurb: string;
}

const L4 = [[0, 0], [0, 1], [0, 2], [1, 2]] as const;
const T4 = [[0, 0], [1, 0], [2, 0], [1, 1]] as const;
const S4 = [[1, 0], [2, 0], [0, 1], [1, 1]] as const;
const X5 = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] as const;
const O4 = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;
const U5 = [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] as const;
const I4 = [[0, 0], [1, 0], [2, 0], [3, 0]] as const;
const P5 = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] as const;
const D2 = [[0, 0], [1, 0]] as const;
const M1 = [[0, 0]] as const;

/** The meteor is the first theme organ: already there, never built. */
export const METEOR_THEME = {
  name: 'Meteor Core',
  unlocks: ['spitter', 'lasher', 'spine'] as readonly TowerFamily[],
  signature: 'spitter' as TowerFamily,
};

export const ORGAN_DEFS: readonly OrganDef[] = [
  { id: 'forge', name: 'Bone Forge', kind: 'theme', shape: L4, cost: { war: 40 },
    unlocks: ['impaler', 'quill', 'skipper', 'bombard'], signature: 'impaler',
    blurb: 'grows bone: harpoons, quill fans, skipping and point artillery' },
  { id: 'venom', name: 'Venom Sac', kind: 'theme', shape: T4, cost: { war: 40 },
    unlocks: ['blighter', 'mister', 'ember'], signature: 'blighter',
    blurb: 'brews chemistry: poison, caustic mist, fire' },
  { id: 'gut', name: 'Gut', kind: 'theme', shape: S4, cost: { war: 35 },
    unlocks: ['maw', 'swamp', 'burster', 'lobber'], signature: 'maw',
    blurb: 'digests: maws, swamps, bursting polyps, bile' },
  { id: 'nerve', name: 'Nerve Cluster', kind: 'theme', shape: X5, cost: { war: 45 },
    unlocks: ['frond', 'prism', 'ocular', 'net'], signature: 'frond',
    blurb: 'fires signals: arcs, prisms, the eye, flak nets' },
  { id: 'lattice', name: 'Mucus Lattice', kind: 'theme', shape: O4, cost: { war: 30 },
    unlocks: ['tangler', 'ward', 'choir'], signature: 'tangler',
    blurb: 'holds the line: snares, shield membranes, the choir' },
  { id: 'womb', name: 'Brood Womb', kind: 'theme', shape: U5, cost: { war: 40 },
    unlocks: ['brood', 'sling', 'lure'], signature: 'brood',
    blurb: 'breeds and spreads: broodmothers, spore slings, lures' },
  { id: 'marrow', name: 'Marrow Vault', kind: 'theme', shape: I4, cost: { science: 30 },
    unlocks: ['conduit', 'tap', 'mitosis', 'reliquary', 'press'], signature: 'spine',
    blurb: 'combo engines that move bonuses: conduit, tap, mitosis, reliquary, press' },
  { id: 'resonance', name: 'Resonance Chamber', kind: 'theme', shape: P5, cost: { science: 40 },
    unlocks: ['amp', 'mosaic', 'twin', 'capacitor', 'boomerang'], signature: 'prism',
    blurb: 'combo engines that multiply: amplifier, mosaic, twin, capacitor, boomerang' },
  { id: 'heart', name: 'Auxiliary Heart', kind: 'zone', zone: 'level', shape: D2, cost: { war: 30 },
    blurb: 'every organ touching its zone is one LEVEL higher' },
  { id: 'brain', name: 'Brain Node', kind: 'zone', zone: 'draw', shape: D2, cost: { war: 35 },
    blurb: 'limbs of every organ touching its zone are drawn twice as often' },
  { id: 'gland', name: 'Pheromone Gland', kind: 'zone', zone: 'share', shape: M1, cost: { war: 25 },
    blurb: 'organs touching its zone share their signature verb TWICE' },
  { id: 'root', name: 'Tendril Root', kind: 'root', shape: M1, cost: { war: 8 },
    blurb: 'cheap tissue: reach further, and it CARRIES adjacency between organs at either end' },
];

export const ORGAN_BY_ID = Object.fromEntries(ORGAN_DEFS.map((d) => [d.id, d])) as Record<OrganId, OrganDef>;

/** Level upgrade price: the organ's cost times its current level. */
export const ORGAN_LEVEL_POTENCY = 0.10;
export const ORGAN_LEVEL_TEMPO = 0.10;
/** Brain zone: draw weight multiplier for the themes it touches. */
export const BRAIN_DRAW_MULT = 2;

export type DepositKind = 'carrion' | 'seam' | 'lab' | 'bed' | 'ossuary' | 'cache';
export type FeatureKind = 'vent' | 'aquifer' | 'cable' | 'sewer';

export interface DepositSpec {
  name: string;
  glyph: string;
  /** Paid once, the moment an organ is grown over it. */
  now: { war?: number; science?: number; royal?: number; biomass?: number; pips?: number };
  rows: [number, number];
  count: number;
}

export const DEPOSITS: Record<DepositKind, DepositSpec> = {
  carrion: { name: 'Carrion Pocket', glyph: '☗', now: { war: 20 }, rows: [2, 4], count: 2 },
  seam: { name: 'Carrion Seam', glyph: '≋', now: { war: 45 }, rows: [4, 6], count: 2 },
  lab: { name: 'Buried Laboratory', glyph: '⚗', now: { science: 25 }, rows: [4, 7], count: 1 },
  bed: { name: 'Biomass Bed', glyph: '❦', now: { biomass: 150 }, rows: [4, 7], count: 1 },
  ossuary: { name: 'Royal Ossuary', glyph: '♛', now: { royal: 1 }, rows: [7, 8], count: 1 },
  cache: { name: 'Gene Cache', glyph: '⧉', now: { pips: 2 }, rows: [7, 8], count: 1 },
};

export interface FeatureSpec {
  name: string;
  glyph: string;
  /** Every organ touching it is +1 level; this organ +2. */
  favors: OrganId;
  rows: [number, number];
}

export const FEATURES: Record<FeatureKind, FeatureSpec> = {
  cable: { name: 'Severed Power Main', glyph: 'ϟ', favors: 'nerve', rows: [2, 4] },
  sewer: { name: 'Sewer Main', glyph: '≈', favors: 'gut', rows: [2, 4] },
  aquifer: { name: 'Aquifer', glyph: '◌', favors: 'lattice', rows: [4, 7] },
  vent: { name: 'Geothermal Vent', glyph: '♨', favors: 'venom', rows: [5, 8] },
};

export const FEATURE_LEVEL = 1;
export const FEATURE_FAVORED_LEVEL = 2;
