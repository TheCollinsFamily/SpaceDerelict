/**
 * THE ORGAN STAGE (Collins, Sep 28 2026): a separate between-waves stage, like
 * the town in BALL x PIT. Flow: wave setup (starting meat) → wave 1 → organ
 * stage → wave setup → wave 2 → … Organs are bought with CHYME (Nov 22 2026), never with the limbs' meat:
 * the body renders it from what the creep digested in the wave, plus a ration at every clear, and it is BANKED
 * from wave to wave (meat left when a wave starts is still lost; royal points are kept). DESIGN.md "Chyme".
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

export type OrganKind = 'theme' | 'zone' | 'root' | 'creep' | 'scaffold' | 'seeder' | 'unit' | 'chyme';
/** What a creep organ does for creep nodes (see CREEP below). */
export type CreepRole = 'produce' | 'pace' | 'bud' | 'cyst' | 'swell' | 'catapult' | 'mire' | 'acid' | 'runner' | 'mule';
export type ZoneEffect = 'level' | 'draw' | 'share' | 'suppress';

export interface OrganDef {
  id: OrganId;
  name: string;
  kind: OrganKind;
  /** Footprint cells [x, y] before rotation. */
  shape: readonly (readonly [number, number])[];
  /** Its price in CHYME (DESIGN.md "Chyme"): organs are never bought with the limbs' meat. */
  cost: { chyme: number };
  /** Theme organs: the limbs they put into your draw. */
  unlocks?: readonly TowerFamily[];
  /** Theme organs: the verb they share with every organ they touch. */
  signature?: TowerFamily;
  /** Zone organs: what they do to organs touching their zone. */
  zone?: ZoneEffect;
  /** Creep organs: their part in making creep nodes. */
  creep?: CreepRole;
  /** It must be grown touching the surface: one of its cells in the top row, under the street. */
  surface?: boolean;
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
const V2 = [[0, 0], [0, 1]] as const;
const L3 = [[0, 0], [1, 0], [0, 1]] as const;
const I3 = [[0, 0], [1, 0], [2, 0]] as const;
const V3 = [[0, 0], [0, 1], [0, 2]] as const;

/** The meteor is the first theme organ: already there, never built. */
export const METEOR_THEME = {
  name: 'Meteor Core',
  unlocks: ['spitter', 'lasher', 'spine'] as readonly TowerFamily[],
  signature: 'spitter' as TowerFamily,
};

export const ORGAN_DEFS: readonly OrganDef[] = [
  { id: 'forge', name: 'Bone Forge', kind: 'theme', shape: L4, cost: { chyme: 40 },
    unlocks: ['impaler', 'quill', 'skipper', 'bombard'], signature: 'impaler',
    blurb: 'grows bone: harpoons, quill fans, skipping and point artillery' },
  { id: 'venom', name: 'Venom Sac', kind: 'theme', shape: T4, cost: { chyme: 40 },
    unlocks: ['blighter', 'mister', 'ember'], signature: 'blighter',
    blurb: 'brews chemistry: poison, caustic mist, fire' },
  { id: 'gut', name: 'Gut', kind: 'theme', shape: S4, cost: { chyme: 35 },
    unlocks: ['maw', 'swamp', 'burster', 'lobber'], signature: 'maw',
    blurb: 'digests: maws, swamps, bursting polyps, bile' },
  { id: 'nerve', name: 'Nerve Cluster', kind: 'theme', shape: X5, cost: { chyme: 45 },
    unlocks: ['frond', 'prism', 'ocular', 'net'], signature: 'frond',
    blurb: 'fires signals: arcs, prisms, the eye, flak nets' },
  { id: 'lattice', name: 'Mucus Lattice', kind: 'theme', shape: O4, cost: { chyme: 30 },
    unlocks: ['tangler', 'ward', 'choir'], signature: 'tangler',
    blurb: 'holds the line: snares, shield membranes, the choir' },
  { id: 'womb', name: 'Brood Womb', kind: 'theme', shape: U5, cost: { chyme: 40 },
    unlocks: ['brood', 'hatch', 'lure'], signature: 'brood',
    blurb: 'breeds and baits: Broodmother Dens, Brood Pits, lures' },
  { id: 'marrow', name: 'Marrow Vault', kind: 'theme', shape: I4, cost: { chyme: 45 },
    unlocks: ['conduit', 'tap', 'mitosis', 'reliquary', 'press'], signature: 'spine',
    blurb: 'combo engines that move bonuses: conduit, tap, mitosis, reliquary, press' },
  { id: 'resonance', name: 'Resonance Chamber', kind: 'theme', shape: P5, cost: { chyme: 55 },
    unlocks: ['amp', 'mosaic', 'twin', 'capacitor', 'boomerang'], signature: 'prism',
    blurb: 'combo engines that multiply: amplifier, mosaic, twin, capacitor, boomerang' },
  { id: 'heart', name: 'Auxiliary Heart', kind: 'zone', zone: 'level', shape: D2, cost: { chyme: 30 },
    blurb: 'every organ touching its zone is one LEVEL higher' },
  { id: 'brain', name: 'Brain Node', kind: 'zone', zone: 'draw', shape: D2, cost: { chyme: 35 },
    blurb: 'limbs of every organ touching its zone are drawn twice as often' },
  { id: 'gland', name: 'Pheromone Gland', kind: 'zone', zone: 'share', shape: M1, cost: { chyme: 25 },
    blurb: 'organs touching its zone share their signature verb TWICE' },
  // Collins, Sep 28 2026: "one that reduces probability to nothing (used to disable basic organs later in the game)".
  { id: 'atrophy', name: 'Atrophy Gland', kind: 'zone', zone: 'suppress', shape: M1, cost: { chyme: 20 },
    blurb: 'limbs of every organ touching its zone are NEVER drawn — starve the basics out of your hand' },
  { id: 'root', name: 'Tendril Root', kind: 'root', shape: M1, cost: { chyme: 8 },
    blurb: 'cheap tissue: reach further, and it CARRIES adjacency between organs at either end' },
  // CREEP (Collins, Sep 28 2026): creep nodes are FREE — these organs make them.
  { id: 'bladder', name: 'Spore Bladder', kind: 'creep', creep: 'produce', shape: V2, cost: { chyme: 25 },
    blurb: 'grows one free CREEP NODE every 2 turns (at the wave clear); the creep organs TOUCHING it decide what kind' },
  { id: 'pacemaker', name: 'Pacemaker', kind: 'creep', creep: 'pace', shape: M1, cost: { chyme: 20 },
    blurb: 'a bladder TOUCHING it grows EVERY turn instead of every 2; more pacemakers each add a node when the wave starts' },
  { id: 'budder', name: 'Budding Gland', kind: 'creep', creep: 'bud', shape: L3, cost: { chyme: 30 },
    blurb: 'a bladder TOUCHING it grows one MORE node each time (stacks)' },
  { id: 'cyst', name: 'Spore Cyst', kind: 'creep', creep: 'cyst', shape: M1, cost: { chyme: 15 },
    blurb: 'a starter stock: 3 plain creep nodes the moment it grows' },
  { id: 'swell', name: 'Swelling Sac', kind: 'creep', creep: 'swell', shape: D2, cost: { chyme: 25 },
    blurb: 'nodes from a bladder TOUCHING it spread 1 cell wider; touching the METEOR, the core creep grows wider (stacks)' },
  { id: 'catapult', name: 'Catapult Sac', kind: 'creep', creep: 'catapult', shape: I3, cost: { chyme: 30 },
    unlocks: ['sling'],
    blurb: 'UNLOCKS the Spore Sling (the creep thrower); nodes from a bladder TOUCHING it are thrown 5 cells further (stacks)' },
  { id: 'runner', name: 'Runner Gland', kind: 'creep', creep: 'runner', shape: V3, cost: { chyme: 30 },
    unlocks: ['lance'],
    blurb: 'UNLOCKS the Creep Lance: a thrower that shoots creep in a LINE along its facing' },
  // SPORE MULES (Collins, Oct 2 2026: "a unit that can act like a creep node (and an organ that makes them) ... you walk
  // it out and deploy it"). Paced and strained like a bladder: a pacemaker touching it makes it grow every turn, a budding
  // gland one more each time, and the swell/mire/acid organs touching it decide the node each mule becomes.
  { id: 'mule', name: 'Mule Sac', kind: 'creep', creep: 'mule', shape: M1, cost: { chyme: 30 },
    blurb: 'grows a SPORE MULE every 2 turns (keeps 2 at most): a slow walker you order out and DEPLOY, where it roots into a creep node, even past your creep' },
  { id: 'mire', name: 'Mire Gland', kind: 'creep', creep: 'mire', shape: V2, cost: { chyme: 25 },
    blurb: 'creep from a bladder TOUCHING it (or the METEOR, if it touches that) slows ground enemies 25% (stacks)' },
  { id: 'acid', name: 'Digestive Lining', kind: 'creep', creep: 'acid', shape: D2, cost: { chyme: 30 },
    blurb: 'creep from a bladder TOUCHING it (or the METEOR, if it touches that) burns ground enemies 4/s (stacks)' },
  // FIELD UNITS (Collins, Oct 2 2026): organs that grow units you command, born at the body at the wave clear and
  // paid for then (Sim.growFieldUnits). The INFESTOR takes shelters; the HARRIER hunts the science caste far afield.
  { id: 'infestor', name: 'Infestor Cyst', kind: 'unit', shape: M1, cost: { chyme: 50 },
    blurb: 'grows an INFESTOR every 3 turns (one at a time; 60 war each, paid at the wave clear): a big, slow unit you walk to a SHELTER, where it burrows in and makes it yours, a second base that pays a bonus on every wave\'s meat while you protect it' },
  { id: 'harrier', name: 'Harrier Gland', kind: 'unit', shape: M1, cost: { chyme: 40 },
    blurb: 'grows a HARRIER every 2 turns (one a gland, 3 on the board at most; 30 war each): fast, long-ranged and soft, it runs down science parties anywhere in the city' },
  // SEEDLINGS (Collins, Sep 29 2026): must touch the surface; shoots a free weak limb up every two waves.
  { id: 'seeder', name: 'Seeding Gland', kind: 'seeder', shape: V2, cost: { chyme: 25 }, surface: true,
    blurb: 'must TOUCH THE SURFACE; every 2 turns it shoots a free SEEDLING limb up into the city (a free card: place it anywhere your creep holds)' },
  // PLINTHS (Collins, Sep 29 2026): free, one every two waves.
  // THE RUMEN (Collins, Nov 22 2026: "oh I like the idea of a chyme generating organ think through its agency bonus etc."):
  // the body's fermenting stomach. DESIGN.md "THE RUMEN". One of a kind.
  { id: 'rumen', name: 'Rumen', kind: 'chyme', shape: L3, cost: { chyme: 60 },
    blurb: 'makes CHYME: every body killed by a limb of a theme it TOUCHES (or reaches by roots) renders +1 more, up to 12 a wave; and at every clear it ferments the chyme you kept, +1 per 10, up to 3 (a heart zone doubles both)' },
  { id: 'scaffold', name: 'Scaffold Gland', kind: 'scaffold', shape: L3, cost: { chyme: 20 },
    blurb: 'grows one free PLINTH every 2 turns (at the wave clear): a pedestal that raises one limb, or one bare roof, by one level' },
];

/**
 * The prices before CHYME (Nov 22 2026), in war and science meat. A run saved before then (src/meta/runSave.ts, v1) is
 * replayed under the economy it was played in (SimConfig.organEconomy 'meat'), so its orders land as they did.
 */
export const LEGACY_ORGAN_COST: Record<OrganId, { war?: number; science?: number }> = {
  forge: { war: 40 },
  venom: { war: 40 },
  gut: { war: 35 },
  nerve: { war: 45 },
  lattice: { war: 30 },
  womb: { war: 40 },
  marrow: { science: 30 },
  resonance: { science: 40 },
  heart: { war: 30 },
  brain: { war: 35 },
  gland: { war: 25 },
  atrophy: { war: 20 },
  root: { war: 8 },
  bladder: { war: 25 },
  pacemaker: { war: 20 },
  budder: { war: 30 },
  cyst: { war: 15 },
  swell: { war: 25 },
  catapult: { war: 30 },
  runner: { war: 30 },
  mule: { war: 30 },
  mire: { war: 25 },
  acid: { war: 30 },
  infestor: { war: 50 },
  harrier: { war: 30, science: 10 },
  seeder: { war: 25 },
  scaffold: { war: 20 },
  rumen: { war: 60 },
};

export const ORGAN_BY_ID = Object.fromEntries(ORGAN_DEFS.map((d) => [d.id, d])) as Record<OrganId, OrganDef>;

/**
 * CREEP NODES (Collins, Sep 28 2026): free, grown by special organs PER TURN — a
 * spore bladder grows one at every wave clear. A node is placed from your stock
 * onto the map near your creep and spreads creep around itself.
 */
export const CYST_NODES = 3;         // plain nodes a spore cyst gives when it grows
/** Collins: "the default every two turns, not one — only one with the thing that increases speed". */
export const BLADDER_TURNS = 2;
/**
 * PLINTHS (Collins, Sep 29 2026: "platforms that raise the height of one thing by one
 * amount: let's have an organ that generates 1 every two waves for free"). A plinth is a
 * pedestal of bone and callus. Put under a limb it raises the limb, all of it, one level;
 * put on a bare roof it raises that roof, which is how a roof is levelled to take a BIG limb.
 */
export const PLINTH_TURNS = 2;
/** Nothing is raised higher than this: one level above the tallest block of the city. */
export const PLINTH_MAX_HEIGHT = 4;
/**
 * SEEDLINGS (Collins, Sep 29 2026: "an organ that must be placed adjacent to the surface and
 * once every two turns you get a free low power tower, with the idea like it shoots out").
 * The Seeding Gland grows a Seedling every SEEDLING_TURNS turns: a free card in the hand.
 * Placed, it is SHOT up from the landing site and lands where it was placed.
 */
export const SEEDLING_TURNS = 2;
/** How long a seedling is in the air, seconds. */
export const SEEDLING_FLIGHT = 0.9;
export const NODE_RADIUS = 3;        // cells of creep a node spreads
export const NODE_REACH = 3;         // cells past the creep edge a node may be placed
export const CATAPULT_REACH = 5;     // extra cells of reach per catapult sac
export const MIRE_SLOW = 0.75;       // enemy speed on mire creep x this per mire gland in the recipe
export const LINING_DPS = 4;         // damage/s to enemies on burning creep per lining in the recipe
export const NODE_HP = 140;           // shells, bombers and trampling bodies wear nodes down
export const NODE_TRAMPLE = 0.5;     // x a body's damage/s while it stands on a node
// A placed node MATURES once it survives a wave: from the next turn it can spread its ONE child.

/** Level upgrade price: the organ's cost times its current level (the Meteor Core: METEOR_LEVEL_CHYME × its level). */
export const METEOR_LEVEL_CHYME = 30;
/**
 * THE RUMEN (DESIGN.md "THE RUMEN"). FEED: a body killed by a limb of a theme the Rumen touches (edge to edge or along a
 * root chain; the meteor counts) renders RUMEN_PER_BODY more chyme, + RUMEN_GLAND_BONUS for every Pheromone Gland zone the
 * Rumen sits in; it holds at most RUMEN_FEED_CAP x its level a wave (uncapped it made 376 chyme a run for a price of 45 and was
 * always right: measured, DESIGN.md). FERMENT: at every clear, RUMEN_FERMENT_PER banked chyme ferments into 1 more, up to
 * RUMEN_FERMENT_CAP x the Rumen's level (1 + Auxiliary Heart zones it sits in + features it touches).
 */
export const RUMEN_FEED_CAP = 12;
export const RUMEN_PER_BODY = 1;
export const RUMEN_GLAND_BONUS = 1;
export const RUMEN_FERMENT_PER = 10;
export const RUMEN_FERMENT_CAP = 3;
export const ORGAN_LEVEL_POTENCY = 0.10;
export const ORGAN_LEVEL_TEMPO = 0.10;
/** Brain zone: draw weight multiplier for the themes it touches. */
export const BRAIN_DRAW_MULT = 2;

export type DepositKind = 'carrion' | 'seam' | 'lab' | 'bed' | 'ossuary' | 'cache';
export type FeatureKind = 'vent' | 'aquifer' | 'cable' | 'sewer';

export type DepositPay = { war?: number; science?: number; royal?: number; biomass?: number; pips?: number };

export interface DepositSpec {
  name: string;
  glyph: string;
  /** Paid once, the moment an organ is grown over it (at the shallowest row it can appear on). */
  now: DepositPay;
  /** Deeper is richer: what one more row down adds. */
  perRow?: DepositPay;
  rows: [number, number];
  count: number;
}

/**
 * THE DIG (Collins, Sep 28 2026: "rewards that can be found as you dig deeper …
 * the equivalent of royal kills, styled as ancient royal tombs … and ones for
 * science points, underground research labs"). Deposits more than REVEAL_RANGE
 * cells from the body show only as "?" — you find out what they are by growing
 * toward them. The deeper, the richer.
 */
export const REVEAL_RANGE = 2;

/** What a deposit on this row pays. */
export function depositPayAt(spec: DepositSpec, row: number): DepositPay {
  const extra = Math.max(0, row - spec.rows[0]);
  const out: DepositPay = { ...spec.now };
  for (const [k, v] of Object.entries(spec.perRow ?? {})) {
    const key = k as keyof DepositPay;
    out[key] = Math.floor((out[key] ?? 0) + (v as number) * extra);
  }
  return out;
}

export const DEPOSITS: Record<DepositKind, DepositSpec> = {
  carrion: { name: 'Carrion Pocket', glyph: '☗', now: { war: 20 }, rows: [2, 4], count: 2 },
  seam: { name: 'Carrion Seam', glyph: '≋', now: { war: 45 }, rows: [4, 6], count: 2 },
  lab: { name: 'Underground Research Lab', glyph: '⚗', now: { science: 15 }, perRow: { science: 6 }, rows: [3, 8], count: 2 },
  bed: { name: 'Biomass Bed', glyph: '❦', now: { biomass: 150 }, rows: [4, 7], count: 1 },
  ossuary: { name: 'Ancient Royal Tomb', glyph: '♛', now: { royal: 1 }, perRow: { royal: 0.5 }, rows: [5, 8], count: 2 },
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
