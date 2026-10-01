/**
 * Broodfall sim core. Fixed-timestep, seeded, deterministic, zero rendering imports.
 *
 * The board is a real tower-defense map: streets are the corridors, buildings are
 * solid, enemies follow a flow field along roads toward the core, towers placed on
 * roads BLOCK (the swarm reroutes or chews through), and the creep spreads along
 * the street network, digesting adjacent buildings into buildable rubble.
 */
import { Rng } from './rng';
import { footprintOf, footprintName, isMultiCell, turnsItsGround } from './footprint';
import {
  CellType, CityMap, DraftOffer, allDistance, computeFlow, createBoard,
  PLATE, draftOffers, frontierGates, isPassable, legalDrafts, slotOfCell, stampPlate,
} from './citymap';
import { pregrow, restoreMap, snapshotBoard, validSnapshot, type BoardSnapshot } from './boardSnapshot';

type Edge = 'n' | 's' | 'e' | 'w';
/** A wall of yours facing unclaimed city (Sim.burrowSiteAt). */
export interface BurrowSite { slot: number; edge: Edge; mouth: number[]; carve: number[]; blocked: boolean }
import { PLATE_FEATURES, geneById } from '../../content/plates';
import {
  BALANCE as B, ENEMIES, TOWERS, WAVE_TABLE,
} from '../../content/data';
import type {
  Broodling, Caltrop, CardInstance, Caste, Cloud, Command, Corpse, CreepSource, Directive, Enemy,
  EnemyKind, EnemySpec, HitFx, ModPip, Organ, OrganId, Outcome, Phase, Projectile,
  NodeStrain, RootDir, RunStats, Shell, SimConfig, SimEvent, Tower, TowerFamily, TowerSpec, UpgradeChoice, UpgradeOption, Vec,
} from './types';
import { UPGRADES, UPGRADE_COST } from '../../content/upgrades';
import {
  BRAIN_DRAW_MULT, CATAPULT_REACH, REVEAL_RANGE, DEPOSITS, FEATURES, FEATURE_FAVORED_LEVEL, FEATURE_LEVEL, METEOR_THEME,
  BLADDER_TURNS, PLINTH_MAX_HEIGHT, PLINTH_TURNS, SEEDLING_FLIGHT, SEEDLING_TURNS, CYST_NODES, LINING_DPS, MIRE_SLOW, NODE_HP, NODE_RADIUS, NODE_TRAMPLE, NODE_REACH, ORGAN_BY_ID, ORGAN_DEFS, ORGAN_LEVEL_POTENCY, ORGAN_LEVEL_TEMPO,
  type OrganDef,
} from '../../content/underground';
import { createUnderground, neighbours4, type Underground } from './underground';
import { DECREE_BY_ID, ROYAL, type DecreeId } from '../../content/royal';

export const DT = 0.1;

const STRUCTURE_CONTACT = 24;    // px: latch-and-chew distance to a structure
const CORE_CONTACT = 46;         // px: latch distance to the core
const ENEMY_RADIUS = 8;
const SEPARATION_DIST = 13;      // px: enemies shoulder each other apart
const STRUCTURE_FLOW_COST = 400; // a tower on a road is a wall worth a 40-cell detour

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function towerSpec(family: TowerFamily): TowerSpec {
  const s = TOWERS.find((t) => t.family === family);
  if (!s) throw new Error(`no tower spec: ${family}`);
  return s;
}

export function enemySpec(kind: EnemyKind): EnemySpec {
  const s = ENEMIES.find((e) => e.kind === kind);
  if (!s) throw new Error(`no enemy spec: ${kind}`);
  return s;
}

export function organSpec(id: OrganId): OrganDef {
  const s = ORGAN_BY_ID[id];
  if (!s) throw new Error(`no organ spec: ${id}`);
  return s;
}

/** Which theme a limb family belongs to: 'core' (the meteor) or the theme organ that unlocks it. */
export function themeOf(family: TowerFamily): OrganId | 'core' {
  if (METEOR_THEME.unlocks.includes(family)) return 'core';
  const d = ORGAN_DEFS.find((x) => x.unlocks?.includes(family));
  return d ? d.id : 'core';
}

/** Derived stats of a tower after its inheritance pips. Deterministic; no RNG. */
/**
 * Derived stats of a tower after its inheritance pips. Deterministic; no RNG.
 * NO CAPS (Collins): every pip stacks without a ceiling.
 *
 * THE PAYLOAD RULE (Collins: "nothing should ever do nothing"): the generic
 * pips are defined in payload terms so they mean something on EVERY limb —
 *   tempo   (spitter) = fire rate, or a producer's cycle speed (pulses, recharges, bites)
 *   potency (lasher)  = damage, or a producer's strength (swamp burn, thorns, aura %, shield, cloud)
 *   splash  (burster) = blast radius, or a producer's effect radius (swamp, cloud, aura, patch)
 *   reach   (choir/bombard) = range, or a producer's reach (aura radius, throw range, broodling roam)
 * and every hit-verb pip (slow, poison, shred, chains, knock, execute, cloud,
 * caltrops, grounding, skips, pierce...) rides whatever the limb touches the hive with.
 */
/** The evolution options a limb has bought, in stage order. */
export function upgradeOptions(t: Tower): UpgradeOption[] {
  if (!t.upgrades || t.upgrades.length === 0) return [];
  const tree = UPGRADES[t.family];
  return t.upgrades.map((c, i) => tree[i][c === 'A' ? 0 : 1]);
}

/** Verbs a limb's evolutions grew into it (count as its own pips; never banked when eaten). */
export function upgradePips(t: Tower): ModPip[] {
  const out: ModPip[] = [];
  for (const o of upgradeOptions(t)) for (const f of o.pips ?? []) out.push({ family: f });
  return out;
}

/**
 * @param pipsResolved true when t.pips already includes evolution pips (statsOf
 *   folds them in before amplification); false for a bare limb.
 */
export function towerStats(t: Tower, pipsResolved = false) {
  const spec = towerSpec(t.family);
  const ups = upgradeOptions(t);
  const all = pipsResolved || ups.length === 0 ? t.pips : [...t.pips, ...upgradePips(t)];
  const pips = (f: TowerFamily) => all.filter((p) => p.family === f).length;
  const upMul = (k: 'tempo' | 'potency' | 'reach') => ups.reduce((m, o) => m * (o[k] ?? 1), 1);
  const tanglerPips = pips('tangler');
  const blighterPips = pips('blighter');
  const emberPips = pips('ember');
  const misterPips = pips('mister');
  // A seedling's pip is a little of a spitter's: it is free, so eating it should be worth a little.
  const tempo = (1 + B.pipRate * pips('spitter') + B.pipRate * 0.4 * pips('sprout')) * upMul('tempo');
  const potency = (1 + B.pipDamage * pips('lasher')) * upMul('potency');
  const reach = (1 + B.pipRange * pips('choir')) * B.pipRangeDouble ** pips('bombard') * upMul('reach');
  const layer = spec.hits ?? 'both';
  const s = {
    tempo,
    potency,
    reach,
    rate: spec.rate * tempo,
    damage: spec.damage * potency,
    aoe: spec.aoe + B.pipAoe * pips('burster'),
    yieldMult: 1 + B.pipYield * pips('maw'),
    maxHp: spec.maxHp + B.pipHp * pips('spine') + (t.grownHp ?? 0),
    interest: spec.interest + B.pipInterest * pips('lure') + B.interestPerPip * t.pips.length,
    range: spec.range * reach,
    // Ward pip: a permanent personal shield, carried with the limb forever.
    shieldPerm: B.pipShield * pips('ward'),
    eatThreshold: spec.eatThreshold,
    // DOUBLING RULE (Collins, Sep 28 2026: "we need to know what doubling an
    // upgrade does"): every copy adds its amount AGAIN and every status verb's
    // clock also grows by pipDurStep per copy — see DESIGN.md, "What a second copy does".
    // Tangler: each copy multiplies the slow (x0.9) and holds it longer.
    slowMult: (spec.slowMult ?? 1) * (1 - B.pipSlow) ** tanglerPips,
    slowDur: Math.max(spec.slowDur ?? 0, tanglerPips > 0 ? B.pipSlowDur : 0) + B.pipDurStep * tanglerPips,
    poisonDps: (spec.poisonDps ?? 0) + B.pipPoisonDps * blighterPips,
    poisonDur: Math.max(spec.poisonDur ?? 0, blighterPips > 0 ? B.pipPoisonDur : 0) + B.pipDurStep * blighterPips,
    // Ember: each copy burns +3 dps hotter AND longer.
    burnDps: (spec.burnDps ?? 0) + B.pipBurnDps * emberPips,
    burnDur: Math.max(spec.burnDur ?? 0, emberPips > 0 ? B.pipBurnDur : 0) + B.pipDurStep * emberPips,
    capBonus: spec.pierce ? Infinity : B.pipPierceCap * pips('impaler'),
    pierce: spec.pierce ?? false,
    // Sling pip: seeps creep, AND the limb no longer needs creep to stand on.
    // Sling and lance pips: the limb seeps creep around itself (+1 cell per pip).
    seepRadius: B.pipSeep * (pips('sling') + pips('lance')),
    offCreep: pips('sling') > 0,
    // Brood pip: heal 50% max hp per pip at every cleared wave (past full, the
    // limb GROWS); on a mother, +1 broodling.
    waveHeal: B.pipWaveHeal * pips('brood'),
    extraBroodlings: B.pipBroodling * pips('brood'),
    // Swamp pip: the payload DIGESTS anything left at or below this hp.
    execute: (spec.swamp?.execute ?? 0) + B.pipExecute * pips('swamp'),
    // Lure pip: +2 interest and hits leave toxic pheromone clouds.
    cloud: B.pipCloud * pips('lure'),
    // Spine pip: kills leave caltrops.
    caltrop: B.pipCaltrop * pips('spine'),
    chains: (spec.chains ?? 0) + B.pipChain * pips('frond'),
    knock: B.pipKnock * pips('lobber'),
    shred: (spec.shred ?? 0) + B.pipShred * misterPips,
    shredDur: Math.max(spec.shredDur ?? 0, misterPips > 0 ? B.pipShredDur : 0) + B.pipDurStep * misterPips,
    // Ocular: priority targeting, +25%/pip vs supports, and TRUE SIGHT (detects cloaked in its reach).
    sniper: (spec.sniper ?? false) || pips('ocular') > 0,
    supportDmg: B.pipOcularDmg * pips('ocular'),
    trueSight: spec.detects !== undefined || pips('ocular') > 0,
    streakRamp: (t.family === 'prism' ? B.prismRampPerHit : 0) + B.pipStreak * pips('prism'),
    // Net pip: grounding + the limb can now strike AIR.
    grounding: (spec.grounds ?? 0) + B.pipGrounding * pips('net'),
    hitsAir: layer !== 'ground' || pips('net') > 0,
    hitsGround: layer !== 'air',
    // Skipper pip: impacts echo further down the line.
    skips: (spec.skips ?? 0) + B.pipSkip * pips('skipper'),
    // Quill pip: every shot also strikes one more target per pip.
    extraTargets: B.pipExtraTarget * pips('quill'),
    // Twin pip: +1 projectile per shot per pip (twinning GLANDS pointed at it double it).
    volley: 1 + B.pipTwin * pips('twin'),
    // ---- engine knobs (evolutions bend an engine's rule; these are the defaults) ----
    gather: 1,
    engineCap: B.funnelMaxCopies,
    poolMult: 1,
    ampFactor: B.ampFactor,
    ampExtraLayers: 0,
    ampRoundUp: false,
    mosaicCopies: 1,
    targetSelf: false,
    twinPower: 2,
    tapCopies: 1,
    tapWar: 0,
    gentleTap: false,
    budCount: 1,
    budRing: 1,
    budPips: 0,
    capSpeed: B.capacitorSpeed,
    capCharge: 1,
    capTrickle: 0,
    returnLegs: 0,
    returnDmg: 1,
    pressBonus: 0,
    pressRoyalEvery: 0,
    relicCopies: 1,
    rebirth: 0,
    // Trap cage: catches a royal below this share of hp; how many it can catch.
    captureAt: 0.5,
    captures: 1,
    // Cage pip: hits root the target.
    rootDur: B.pipRoot * pips('cage'),
  };
  const num = s as unknown as Record<string, number>;
  for (const o of ups) {
    for (const [k, v] of Object.entries(o.add ?? {})) num[k] += v as number;
    for (const [k, v] of Object.entries(o.mult ?? {})) num[k] *= v as number;
    Object.assign(s, o.set ?? {});
  }
  return s;
}

export type TowerStats = ReturnType<typeof towerStats>;

/** The payload a limb delivers on contact, from its derived stats. */
export function fxOf(t: Tower, s: TowerStats, damage = s.damage): HitFx {
  return {
    srcId: t.id, damage, yieldMult: s.yieldMult, capBonus: s.capBonus,
    slowMult: s.slowMult, slowDur: s.slowDur, poisonDps: s.poisonDps, poisonDur: s.poisonDur,
    burnDps: s.burnDps, burnDur: s.burnDur,
    shred: s.shred, shredDur: s.shredDur, chains: s.chains, knock: s.knock,
    execute: s.execute, cloud: s.cloud, caltrop: s.caltrop, supportDmg: s.supportDmg,
    grounding: s.grounding, skips: s.skips, rootDur: s.rootDur,
  };
}

export class Sim {
  readonly cfg: SimConfig;
  readonly worldW: number;
  readonly worldH: number;
  readonly core: Vec;
  readonly map: CityMap;

  private rng: Rng;
  private nextId = 1;
  private events: SimEvent[] = [];

  tickCount = 0;
  time = 0;
  outcome: Outcome = 'playing';

  meat: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
  biomass = 0;
  coreHp: number = B.coreHp;
  coreMaxHp: number = B.coreHp;

  phase: Phase = 'growth';
  phaseElapsed = 0;
  waveNumber = 0;
  directive: Directive;
  /** Starting entrance count — the difficulty wager. More gates, richer meat. */
  entrances = 1;
  wavesCleared = 0;
  scienceBanked = 0;
  royalsKilled = 0;
  /** Total risk of the current/last wave (telegraphed danger number). */
  waveRisk = 0;

  private spawnQueue: EnemyKind[] = [];
  private spawnTimer = 0;
  /** Live frontier gates (ports facing unclaimed districts). */
  gates: number[] = [];
  /** Gates the NEXT assault will pour through — telegraphed during growth. */
  incomingGates: number[] = [];
  /** District draft on offer (phase === 'draft'). */
  pendingDraft: DraftOffer[] | null = null;
  private creepSurgePx = 0;
  private geneMods = {
    weightMult: {} as Partial<Record<TowerFamily, number>>,
    startWar: 0, startScience: 0, spineHpBonus: 0, mawEatBonus: 0, rangeMult: 1, startNodes: 0,
    // The hobby genes (content/plates.ts HOBBY_GENES); each is inert at its default.
    burnSpreadFrac: B.burnSpreadFrac as number, royalJelly: 0, salvageMult: 1, broodHpMult: 1, creepNodeEvery: 0,
    homingRefund: false, groundingMult: 1, weddingMusk: false, trapCage: false,
  };
  /** ROYAL DECREES bought this run (content/royal.ts), by id. */
  decrees: Partial<Record<DecreeId, number>> = {};
  /** Limbs still grafting (surgery under fire) at the last tower update: the hive smells them. */
  private wounds = 0;
  /** Walls burrowed through (the board redraws its city when this changes). */
  burrows = 0;
  /** Kills made by the creep itself (Hitchhiker Spores buds a node every Nth). */
  private creepKillCount = 0;
  private researcherTimer = 20;
  private royalSpawned = false;

  private threatKills = 0;
  private threatChallenge = 0;

  towers: Tower[] = [];
  organs: Organ[] = [];
  /** The meteor's own level (upgradeable like any theme organ). */
  coreLevel = 1;
  /** The seed the underground was dug from (a remembered board keeps its own; src/sim/boardSnapshot.ts). */
  readonly underSeed: number;
  /** What happened this run (the campaign's goals read it). */
  stats: RunStats = {
    kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0,
    limbsLost: 0, cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0,
    maxBurning: 0, maxPips: 0, families: [], pacifistWaves: 0, lastWaveKillsByCause: {},
    royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0, gateBurnKills: 0, royalsCaptured: 0,
    nodesPlaced: 0, nodesLost: 0,
  };
  private waveLimbDamage = 0;
  private waveKillsByCause: Record<string, number> = {};
  private mateBacklog = 0;
  private sleeperCount = 0;

  /** Free creep nodes in stock, each with its strain (grown by creep organs; placed for nothing). */
  nodeStock: NodeStrain[] = [];

  /** How many nodes are in stock (setting it fills with plain nodes — tests, genes). */
  get creepNodes(): number {
    return this.nodeStock.length;
  }

  set creepNodes(n: number) {
    while (this.nodeStock.length > n) this.nodeStock.pop();
    while (this.nodeStock.length < n) this.nodeStock.push(this.plainStrain());
  }
  private coreStrainCache: { radius: number; slow: number; dps: number } | null = null;
  /** Turns each spore bladder has waited since it last grew. */
  private bladderTurns = new Map<number, number>();
  /** Free plinths in stock (grown by scaffold glands; placed for nothing). */
  plinths = 0;
  /** How many plinths have been placed: what is drawn changes when this does. */
  plinthsPlaced = 0;
  /** Turns each scaffold gland has waited since it last grew. */
  private scaffoldTurns = new Map<number, number>();
  /** Turns each seeding gland has waited since it last grew. */
  private seederTurns = new Map<number, number>();
  /** Seedlings in the air: shot up from the landing site; the limb is drawn when it lands. */
  seedFlights: Array<{ id: number; towerId: number; from: Vec; to: Vec; ttl: number }> = [];
  private organCache: Map<OrganId | 'core', { level: number; pips: ModPip[]; draw: number; links: Array<OrganId | 'core'> }> | null = null;
  /** The body below: the underground cross-section organs grow into (between waves). */
  under: Underground;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  /** The dead on the ground: their meat is banked only when the creep digests them (types.ts Corpse). */
  corpses: Corpse[] = [];
  /** Meat the creep has banked from bodies this run, by caste (the measures read it). */
  digested: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
  hand: CardInstance[] = [];
  /** Traits banked by butchering limbs; the NEXT build inherits and clears them. */
  pendingPips: ModPip[] = [];
  /** Creep origins besides the core: hurled patches, root lobes, seeping limbs. */
  creepSources: CreepSource[] = [];
  /** Per-source hop-distance maps (id -> BFS from its cell). */
  private sourceDist = new Map<number, Int32Array>();
  /** Creep clots in flight from a spore sling (the patch belongs to that sling). */
  clotFlights: Array<{
    id: number; from: Vec; to: Vec; cell: number; ttl: number;
    ownerId: number; fx: HitFx; aoe: number; patchBonus: number;
  }> = [];
  /** Bile globs in flight from an aimed lobber volley. */
  bileFlights: Array<{ id: number; from: Vec; to: Vec; cell: number; ttl: number; fx: HitFx; aoe: number }> = [];
  /** Spine-pip caltrops: mini-walls left where a limb killed something. */
  caltrops: Caltrop[] = [];
  /** Toxic pheromone clouds (lure pulses, lure-pipped impacts). */
  clouds: Cloud[] = [];
  /** Every limb ever grown this run, by id: a kill by its poison, fire or cloud after it is gone is still put down to its family (stats only). */
  private creditFamilyOf = new Map<number, TowerFamily>();
  /** The mothers' spawn, fighting on your side in the streets. */
  broodlings: Broodling[] = [];
  /** Recent lightning arcs / sniper beams, for the renderer (fade fast). */
  arcs: Array<{ from: Vec; to: Vec; ttl: number }> = [];
  /** Lobbed shells in flight: hive cannons at your limbs, your bombards at the hive. */
  shells: Shell[] = [];

  /** cell index -> structure ('t'|'o') + id */
  private occupied = new Map<number, { kind: 't' | 'o'; id: number }>();

  /** Flow field toward the core (enemy routing). Recomputed on map/structure change. */
  private flow: { dist: Float64Array; next: Int32Array };
  /** Hop-distance from the core over passable terrain (creep spread topology). */
  private creepDist: Int32Array;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.worldW = cfg.gridW * cfg.cellPx;
    this.worldH = cfg.gridH * cfg.cellPx;
    this.rng = new Rng(cfg.seed);
    const slotsX = Math.floor(cfg.gridW / 10);
    const slotsY = Math.floor(cfg.gridH / 10);
    const startSlot = Math.floor((slotsY - 1) / 2) * slotsX + Math.floor(slotsX / 2);
    this.entrances = Math.max(1, Math.min(3, cfg.entrances ?? 1));
    // A defence (src/meta/defence.ts): the board remembered from the win there, or a large city grown
    // before the run by the drafts' own algebra (src/sim/boardSnapshot.ts).
    const snap = cfg.board && validSnapshot(cfg.board) && cfg.board.w === cfg.gridW && cfg.board.h === cfg.gridH ? cfg.board : null;
    if (snap) this.map = restoreMap(snap);
    else {
      // The crash site's layout is drawn from its own stream, so that the rest of the run's dice fall as before.
      const crash = cfg.crash ?? new Rng((cfg.seed ^ 0x5eed) >>> 0).int(0, 999);
      this.map = createBoard(slotsX, slotsY, startSlot, this.rng, this.entrances, crash);
      if (cfg.pregrown) pregrow(this.map, this.rng, cfg.pregrown);
    }
    this.underSeed = snap ? snap.underSeed : cfg.seed;
    this.under = createUnderground(this.underSeed, TOWERS.filter((t) => !t.engine).map((t) => t.family));
    this.core = this.cellCenter(this.map.coreCell);
    this.gates = frontierGates(this.map);
    for (const id of cfg.genes ?? []) {
      const g = geneById(id);
      if (!g) continue;
      for (const [fam, m] of Object.entries(g.weightMult ?? {})) {
        this.geneMods.weightMult[fam as TowerFamily] = (this.geneMods.weightMult[fam as TowerFamily] ?? 1) * (m as number);
      }
      this.geneMods.startWar += g.startWar ?? 0;
      this.geneMods.startScience += g.startScience ?? 0;
      this.geneMods.spineHpBonus += g.spineHpBonus ?? 0;
      this.geneMods.mawEatBonus += g.mawEatBonus ?? 0;
      this.geneMods.rangeMult *= g.rangeMult ?? 1;
      this.geneMods.startNodes += g.startNodes ?? 0;
      if (g.burnSpreadFrac !== undefined) this.geneMods.burnSpreadFrac = Math.max(this.geneMods.burnSpreadFrac, g.burnSpreadFrac);
      this.geneMods.royalJelly += g.royalJelly ?? 0;
      this.geneMods.salvageMult *= g.salvageMult ?? 1;
      this.geneMods.broodHpMult *= g.broodHpMult ?? 1;
      if (g.creepNodeEvery) this.geneMods.creepNodeEvery = g.creepNodeEvery;
      if (g.homingRefund) this.geneMods.homingRefund = true;
      this.geneMods.groundingMult *= g.groundingMult ?? 1;
      if (g.weddingMusk) this.geneMods.weddingMusk = true;
      if (g.trapCage) this.geneMods.trapCage = true;
    }
    this.directive = cfg.directive ?? this.rng.pick<Directive>([
      { kind: 'hold', waves: B.holdWaves },
      { kind: 'royal', count: 1 },
      { kind: 'harvest', science: B.harvestScience },
    ]);
    this.meat = { ...B.startMeat };
    this.meat.war += this.geneMods.startWar;
    this.meat.science += this.geneMods.startScience;
    for (let i = 0; i < this.geneMods.startNodes; i++) this.nodeStock.push(this.plainStrain());
    for (const [c, n] of Object.entries(cfg.startBonus ?? {})) this.meat[c as Caste] += n as number;
    if (cfg.trapCage || this.geneMods.trapCage) this.hand.push({ id: this.nextId++, family: 'cage', free: true });
    // A remembered board brings its organs back where they grew (they include the profile's); else the profile's own.
    if (snap) for (const o of snap.organs) this.regrowOrgan(o);
    else for (const id of cfg.startOrgans ?? []) this.growFree(id);
    this.coreLevel = Math.max(1, cfg.coreLevel ?? 1, snap?.coreLevel ?? 1);
    // A defence: the body has been here a while, its creep already out over the streets.
    this.creepSurgePx = cfg.oneWave?.creepPx ?? 0;
    this.creepDist = allDistance(this.map, this.map.coreCell);
    this.flow = this.computeFlowField();
    this.pickIncomingGates();
    while (this.hand.length < B.handSize) this.hand.push(this.drawCard(cfg.firstHand));
  }

  // ---------- derived ----------

  /** Creep reach in px (grows over time; hearts accelerate it). */
  get creepRadius(): number {
    return B.creepBase + this.creepSurgePx + this.time * B.creepPerSec;
  }

  get bodyRadius(): number {
    return B.bodyBase + this.biomass * B.bodyPerBiomass;
  }

  /** Creep reach in street-hops from the core. */
  get creepRangeCells(): number {
    return Math.floor(this.creepRadius / this.cfg.cellPx) + this.coreStrainBonus().radius;
  }

  get bodyRangeCells(): number {
    return Math.max(1, Math.floor(this.bodyRadius / this.cfg.cellPx));
  }

  isCreeped(cell: number): boolean {
    const d = this.creepDist[cell];
    if (d >= 0 && d <= this.creepRangeCells) return true;
    for (const s of this.creepSources) {
      if (this.sourceCovers(s, cell)) return true;
    }
    return false;
  }

  /** Does one non-core creep source reach this cell right now? */
  private sourceCovers(s: CreepSource, cell: number): boolean {
    const dm = this.sourceDist.get(s.id);
    if (!dm) return false;
    const d = dm[cell];
    if (d < 0) return false;
    if (s.kind === 'patch') {
      const r = Math.min(B.slingPatchMax, s.radius + (this.time - s.bornAt) * B.slingPatchGrow);
      return d <= r;
    }
    if (s.kind === 'seep') return d <= s.radius;
    if (s.kind === 'node') return d <= (s.strain?.radius ?? NODE_RADIUS);
    if (s.kind === 'line') return this.lineCovers(s, cell);
    // Root: a small pad all around, plus a lobe that lengthens in its direction.
    if (d <= s.radius) return true;
    const len = Math.min(B.rootMaxLen * (s.radius / B.rootBaseRadius), (this.time - s.bornAt) * B.rootGrowPerSec);
    if (len <= 0) return false;
    const w = this.cfg.gridW;
    const dx = (cell % w) - (s.cell % w);
    const dy = Math.floor(cell / w) - Math.floor(s.cell / w);
    const dir = s.dir ?? 'N';
    const inCone = dir === 'N' ? (dy < 0 && Math.abs(dx) <= -dy)
      : dir === 'S' ? (dy > 0 && Math.abs(dx) <= dy)
        : dir === 'E' ? (dx > 0 && Math.abs(dy) <= dx)
          : (dx < 0 && Math.abs(dy) <= -dx);
    return inCone && d <= s.radius + len;
  }

  /** A creep lance's strip: straight ahead of it along its facing, growing to its length. */
  private lineCovers(s: CreepSource, cell: number): boolean {
    const t = this.towers.find((x) => x.id === s.ownerId);
    if (!t) return false;
    const st = towerStats(t);
    const len = Math.min(B.lanceLength * st.reach, (this.time - s.bornAt) * B.lanceGrowPerSec * st.tempo);
    const half = Math.floor(st.aoe / 12); // splash widens the strip a cell each side per 12px
    const w = this.cfg.gridW;
    const dx = (cell % w) - (s.cell % w);
    const dy = Math.floor(cell / w) - Math.floor(s.cell / w);
    const f = Sim.facingVec(t.facing ?? 'N');
    const along = dx * f.x + dy * f.y;
    const across = Math.abs(dx * f.y - dy * f.x);
    return along >= -1 && along <= len && across <= half + (along <= 0 ? 1 : 0);
  }

  private addCreepSource(kind: CreepSource['kind'], cell: number, radius: number, dir?: RootDir, ownerId?: number): CreepSource {
    const s: CreepSource = { id: this.nextId++, kind, cell, bornAt: this.time, radius, dir, ownerId };
    this.creepSources.push(s);
    this.sourceDist.set(s.id, allDistance(this.map, cell));
    return s;
  }

  private removeCreepSourcesOf(ownerId: number): void {
    this.creepSources = this.creepSources.filter((s) => {
      if (s.ownerId !== ownerId) return true;
      this.sourceDist.delete(s.id);
      return false;
    });
  }

  isBody(cell: number): boolean {
    const d = this.creepDist[cell];
    return d >= 0 && d <= this.bodyRangeCells;
  }

  flowDistOf(cell: number): number {
    return this.flow.dist[cell];
  }

  creepDistOf(cell: number): number {
    return this.creepDist[cell];
  }

  flowNextOf(cell: number): number {
    return this.flow.next[cell];
  }

  get interest(): number {
    let n = B.baseInterest;
    for (const s of this.map.slots) if (s && s.feature === 'science') n += 3;
    for (const t of this.towers) n += towerStats(t).interest;
    return n;
  }

  get threat(): number {
    return this.threatKills + this.threatChallenge
      + this.wavesCleared * B.threatPerWaveCleared
      + this.biomass * B.threatFromBiomass;
  }

  /** The wager payoff: +25% meat per extra starting entrance. */
  get entranceMeatMult(): number {
    return 1 + 0.25 * (this.entrances - 1);
  }

  get tier(): number {
    const t = Math.floor(this.threat / B.threatPerTier);
    // A defence's one siege comes at least this hard (src/meta/defence.ts).
    const floor = Math.min(WAVE_TABLE.length - 1, this.cfg.oneWave?.minTier ?? 0);
    // The last row is the hive's desperation — gated behind real escalation,
    // not something a standard hold order walks into by wave 11.
    if (t >= WAVE_TABLE.length - 1 && this.threat < B.tier6Threat) return Math.max(floor, WAVE_TABLE.length - 2);
    return Math.max(floor, Math.min(WAVE_TABLE.length - 1, t));
  }

  /** How long this growth phase lasts: a defence gives the body longer to re-arm before its one siege (src/meta/defence.ts). */
  get growthLength(): number {
    return this.waveNumber === 0 && this.cfg.oneWave?.armSeconds ? this.cfg.oneWave.armSeconds : B.growthSeconds;
  }

  /** How many waves deep the next wave's size is counted (a defence's one siege counts as a late wave). */
  private get waveDepth(): number {
    return this.wavesCleared + (this.cfg.oneWave ? Math.max(0, this.cfg.oneWave.asWave - 1) : 0);
  }

  /**
   * A support limb's aura (choir, ward): its reach and splash pips grow the
   * radius, its potency pips grow the strength. No caps.
   */
  auraOf(c: Tower): { radius: number; strength: number } {
    const spec = towerSpec(c.family);
    const s = towerStats(c);
    return {
      radius: (spec.auraRadius ?? 0) * s.reach + (s.aoe - spec.aoe),
      strength: s.potency,
    };
  }

  /** Families whose pips are HIT VERBS — a support limb shares these with everything it covers. */
  private static readonly BROADCAST = new Set<TowerFamily>([
    'maw', 'lure', 'tangler', 'blighter', 'impaler', 'swamp', 'frond', 'lobber', 'mister',
    'ocular', 'prism', 'spine', 'quill', 'skipper', 'net',
  ]);

  /**
   * towerStats plus genes, high ground, and SUPPORT: every choir/ward whose aura
   * covers this limb speeds it (choir) and SHARES its hit-verb pips with it —
   * a snare pip on a choir makes the whole chapel slow what it hits.
   */
  /**
   * The limb a COMBO ENGINE (conduit, amplifier, mosaic) is pointed at: the
   * nearest non-engine limb down its facing lane, within reach.
   */
  conduitTarget(c: Tower, among: Tower[] = this.towers): Tower | null {
    const eng = towerSpec(c.family).engine;
    if (!eng) return null;
    const reach = eng.reach * towerStats(c).reach;
    const f = Sim.facingVec(c.facing ?? 'N');
    let best: Tower | null = null;
    let bestAlong = Infinity;
    for (const t of among) {
      if (t.id === c.id || towerSpec(t.family).engine) continue;
      if (eng.projectileOnly && !Sim.firesProjectiles(t.family)) continue; // the boomerang is picky
      const rx = t.pos.x - c.pos.x;
      const ry = t.pos.y - c.pos.y;
      const along = rx * f.x + ry * f.y;
      const across = Math.abs(rx * f.y - ry * f.x);
      if (along <= 0 || along > reach || across > 30) continue;
      if (along < bestAlong) { bestAlong = along; best = t; }
    }
    return best;
  }

  /** The limbs an engine draws from (all around it, except its target and other engines). Amplifiers draw from none. */
  conduitSources(c: Tower, among: Tower[] = this.towers): Tower[] {
    const spec = towerSpec(c.family);
    const eng = spec.engine;
    if (!eng || eng.gather === undefined) return [];
    const s = towerStats(c);
    const radius = eng.gather * s.reach * s.gather + (s.aoe - spec.aoe);
    const target = this.conduitTarget(c, among);
    return among.filter((u) => u.id !== c.id && u !== target && !towerSpec(u.family).engine
      && dist(u.pos, c.pos) <= radius);
  }

  /**
   * What an engine is channelling into its target (and what sacrificing it harvests):
   * funnel = every source's pips plus each source's family; mosaic = ONE of each
   * distinct type found among them; amplify = nothing (it multiplies instead).
   */
  conduitPool(c: Tower, among: Tower[] = this.towers): ModPip[] {
    const kind = towerSpec(c.family).engine?.kind;
    const cs = towerStats(c);
    const all: ModPip[] = [];
    for (const u of this.conduitSources(c, among)) all.push(...u.pips, ...upgradePips(u), { family: u.family });
    const repeat = (ps: ModPip[], n: number) => Array.from({ length: Math.max(1, n) }, () => ps).flat();
    if (kind === 'funnel') {
      // At most 2 copies of each bonus type (Collins, Sep 27 2026) — Deep Channel
      // evolutions raise it; a Marrow Pump doubles whatever passes.
      const n = new Map<TowerFamily, number>();
      const capped = all.filter((p) => {
        const k = (n.get(p.family) ?? 0) + 1;
        n.set(p.family, k);
        return k <= cs.engineCap;
      });
      return repeat(capped, cs.poolMult);
    }
    if (kind === 'mosaic') {
      const seen = new Set<TowerFamily>();
      const distinct = all.filter((p) => (seen.has(p.family) ? false : (seen.add(p.family), true)));
      return repeat(distinct, cs.mosaicCopies);
    }
    return [];
  }

  /** Engines of a given kind pointed at this limb (and not themselves held in stasis). */
  private enginesOn(t: Tower, kind: string): number {
    let n = 0;
    for (const c of this.towers) {
      if (c.id !== t.id && towerSpec(c.family).engine?.kind === kind && this.conduitTarget(c) === t) n++;
    }
    return n;
  }

  /** Does this family's weapon fire real projectiles (not melee, beams, cones, shells, producers)? */
  static firesProjectiles(f: TowerFamily): boolean {
    const s = towerSpec(f);
    if (s.rate <= 0 || s.cone !== undefined || s.engine) return false;
    return !['lasher', 'maw', 'frond', 'ocular', 'prism', 'skipper', 'bombard', 'lobber'].includes(f);
  }

  /** Engines of this kind on a limb PLUS pips of the same-named family on it (mitosis, capacitor, boomerang, press, reliquary). */
  layersOf(t: Tower, fam: TowerFamily): number {
    return this.enginesOn(t, fam) + [...t.pips, ...upgradePips(t)].filter((p) => p.family === fam).length;
  }

  /** A limb's meat-press stack (nodes + press pips), or null if it is not pressed. */
  pressOf(t: Tower): { layers: number; bonus: number; royalEvery: number } | null {
    const nodes = this.enginesPointedAt(t, 'press');
    const own = [...t.pips, ...upgradePips(t)].filter((p) => p.family === 'press').length;
    if (nodes.length + own === 0) return null;
    let bonus = 0;
    let royalEvery = 0;
    for (const n of nodes) {
      const ns = towerStats(n);
      bonus += ns.pressBonus;
      if (ns.pressRoyalEvery > 0) royalEvery = royalEvery > 0 ? Math.min(royalEvery, ns.pressRoyalEvery) : ns.pressRoyalEvery;
    }
    return { layers: nodes.length + own, bonus, royalEvery };
  }

  /** A limb's capacitor stack: banked shots per idle second (x rate), spend speed, trickle while firing. */
  capacitorOf(t: Tower): { charge: number; speed: number; trickle: number } | null {
    const nodes = this.enginesPointedAt(t, 'capacitor').filter((c) => !this.isTapped(c));
    const own = [...t.pips, ...upgradePips(t)].filter((p) => p.family === 'capacitor').length;
    if (nodes.length + own === 0) return null;
    let charge = own;
    let speed: number = B.capacitorSpeed;
    let trickle = 0;
    for (const n of nodes) {
      const ns = towerStats(n);
      charge += ns.capCharge;
      speed = Math.max(speed, ns.capSpeed);
      trickle = Math.max(trickle, ns.capTrickle);
    }
    return { charge, speed, trickle };
  }

  /** Held in stasis by a marrow tap: it does nothing at all while tapped. */
  isTapped(t: Tower): boolean {
    return this.enginesPointedAt(t, 'tap').some((c) => !towerStats(c).gentleTap);
  }

  /** The engines of one kind pointed at this limb. */
  enginesPointedAt(t: Tower, kind: string): Tower[] {
    return this.towers.filter((c) => c.id !== t.id && towerSpec(c.family).engine?.kind === kind && this.conduitTarget(c) === t);
  }

  /** How many ×1.5 amplifications a limb gets (amplifiers pointed at it + its own amp pips). */
  ampLayers(t: Tower): number {
    return this.ampStack(t).length;
  }

  /** Every x1.5 layer on a limb, with that layer's factor and rounding (evolved amps bend both). */
  ampStack(t: Tower): Array<{ factor: number; roundUp: boolean }> {
    const layers: Array<{ factor: number; roundUp: boolean }> = [];
    const own = [...t.pips, ...upgradePips(t)].filter((p) => p.family === 'amp').length;
    for (let i = 0; i < own; i++) layers.push({ factor: B.ampFactor, roundUp: false });
    for (const c of this.enginesPointedAt(t, 'amplify')) {
      const cs = towerStats(c);
      for (let i = 0; i <= cs.ampExtraLayers; i++) layers.push({ factor: cs.ampFactor, roundUp: cs.ampRoundUp });
    }
    return layers;
  }

  /** Bonus counts ×factor, rounded down, per type — once per layer (1→1, 2→3, 3→4, 4→6...). */
  static amplify(pips: ModPip[], layers: number): ModPip[] {
    return Sim.amplifyStack(pips, Array.from({ length: Math.max(0, layers) }, () => ({ factor: B.ampFactor, roundUp: false })));
  }

  static amplifyStack(pips: ModPip[], stack: Array<{ factor: number; roundUp: boolean }>): ModPip[] {
    if (stack.length === 0) return pips;
    const counts = new Map<TowerFamily, number>();
    for (const p of pips) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
    const out: ModPip[] = [];
    for (const [fam, n0] of counts) {
      let n = n0;
      if (fam !== 'amp') for (const l of stack) n = l.roundUp ? Math.ceil(n * l.factor) : Math.floor(n * l.factor);
      for (let i = 0; i < n; i++) out.push({ family: fam });
    }
    return out;
  }

  /**
   * What a limb is AFFECTING right now, for the UI (works for a hypothetical
   * limb during placement too): the limbs it feeds (targets) and, for a
   * conduit, the limbs it draws from (sources).
   */
  effectLinks(t: Tower): { targets: Tower[]; sources: Tower[] } {
    const among = this.towers.filter((u) => u.id !== t.id);
    if (towerSpec(t.family).engine) {
      const target = this.conduitTarget(t, among);
      return { targets: target ? [target] : [], sources: this.conduitSources(t, among) };
    }
    if (t.family === 'choir' || t.family === 'ward') {
      const r = this.auraOf(t).radius;
      return { targets: among.filter((u) => dist(u.pos, t.pos) <= r), sources: [] };
    }
    return { targets: [], sources: [] };
  }

  statsOf(t: Tower) {
    const shared: ModPip[] = [];
    let choirBonus = 0;
    let crowns = 0;
    for (const c of this.towers) {
      if (c.id === t.id) continue;
      // A crowned limb near it: the court's presence, turned to your side.
      if (c.crowns && dist(c.pos, t.pos) <= ROYAL.crownRadius) crowns += c.crowns;
      // Combo engines pointed at this limb feed it their pool (amplifiers are
      // counted separately and applied last, so they multiply everything fed).
      if (towerSpec(c.family).engine) {
        if (this.conduitTarget(c) === t) {
          shared.push(...this.conduitPool(c));
          // Engine evolutions can push verbs straight into the target.
          for (const o of upgradeOptions(c)) for (const f of o.targetPips ?? []) shared.push({ family: f });
          if (towerStats(c).targetSelf) shared.push({ family: t.family });
        }
        continue;
      }
      if (c.family !== 'choir' && c.family !== 'ward') continue;
      if (this.isTapped(c)) continue; // a tapped support limb projects nothing
      const aura = this.auraOf(c);
      if (dist(c.pos, t.pos) > aura.radius) continue;
      if (c.family === 'choir') choirBonus += (towerSpec('choir').rateAura ?? 0) * aura.strength;
      for (const p of [...c.pips, ...upgradePips(c)]) if (Sim.BROADCAST.has(p.family)) shared.push(p);
    }
    // Conduit PIPS: the limb passively draws the family bonus of its nearest neighbours.
    const draws = t.pips.filter((p) => p.family === 'conduit').length * B.pipDrawNeighbors;
    if (draws > 0) {
      const near = this.towers
        .filter((u) => u.id !== t.id && dist(u.pos, t.pos) <= B.pipDrawRadius)
        .sort((a, b) => dist(a.pos, t.pos) - dist(b.pos, t.pos) || a.id - b.id)
        .slice(0, draws);
      for (const u of near) shared.push({ family: u.family });
    }
    // Mosaic PIPS: one of each distinct family among the limb's close neighbours —
    // per pip (a second mosaic pip draws a second of each).
    const own = [...t.pips, ...upgradePips(t)];
    const mosaics = own.filter((p) => p.family === 'mosaic').length;
    if (mosaics > 0) {
      const seen = new Set<TowerFamily>();
      for (const u of this.towers) {
        if (u.id === t.id || dist(u.pos, t.pos) > B.mosaicPipRadius || seen.has(u.family)) continue;
        seen.add(u.family);
        for (let k = 0; k < mosaics; k++) shared.push({ family: u.family });
      }
    }
    // The organ stage: verbs shared into this limb's theme by the organs it touches.
    const ob = this.organBonusOf(t.family);
    shared.push(...ob.pips);
    // Amplification last: it multiplies EVERYTHING the limb carries and was fed.
    const stack = this.ampStack(t);
    const all = Sim.amplifyStack([...own, ...shared], stack);
    const s = towerStats({ ...t, pips: all }, true);
    s.range = s.range * this.geneMods.rangeMult * this.heightRangeFactor(t.cell);
    s.maxHp += t.family === 'spine' ? this.geneMods.spineHpBonus : 0;
    s.eatThreshold += t.family === 'maw' ? this.geneMods.mawEatBonus : 0;
    // A whole chapel on one limb IS a build: every covering choir adds, and the
    // same tempo also quickens a producer's cycle.
    s.rate *= 1 + choirBonus;
    s.tempo *= 1 + choirBonus;
    // Twinning glands: ×2 projectiles (and producer output) per gland.
    // Organ levels: +15% potency and tempo per level above 1 for the theme's limbs.
    if (ob.potency !== 1 || ob.tempo !== 1) {
      s.potency *= ob.potency;
      s.damage *= ob.potency;
      s.tempo *= ob.tempo;
      s.rate *= ob.tempo;
    }
    if (crowns > 0) {
      s.potency *= 1 + ROYAL.crownDamage * crowns;
      s.damage *= 1 + ROYAL.crownDamage * crowns;
    }
    for (const g of this.enginesPointedAt(t, 'twin')) s.volley *= towerStats(g).twinPower;
    // A GENTLE tap lets its target keep working at half speed.
    for (const c of this.enginesPointedAt(t, 'tap')) if (towerStats(c).gentleTap) { s.rate *= 0.5; s.tempo *= 0.5; }
    return s;
  }


  /**
   * What standing on this cell does to a limb's reach: +heightRangeBonus per block level above
   * the first (DESIGN rule 8), a plinth's levels included (a plinth raises `map.heights`).
   */
  heightRangeFactor(cell: number): number {
    const h = this.map.heights[cell] || 1;
    return 1 + B.heightRangeBonus * (h - 1);
  }

  /**
   * The stats a limb of this family WOULD have if it were built on these cells now, facing
   * this way, carrying these pips (the banked cannibalize traits by default): the same
   * statsOf the sim runs on the placed limb, so the placement preview cannot lie (height and
   * plinth, genes, organ bonuses, amp stacks, engines and auras that would reach it).
   * Pure: the ghost stands in the tower list only for the length of the computation, no rng
   * is drawn, nothing else is touched.
   */
  previewStats(family: TowerFamily, cells: number[], facing?: RootDir, pips: ModPip[] = this.pendingPips): TowerStats & {
    /** Block level of the ground it would stand on (plinths included). */
    height: number;
    /** The reach it would have standing on level 1: what the height adds is range - groundRange. */
    groundRange: number;
  } {
    const ground = cells.length > 0 ? cells : [0];
    const spec = towerSpec(family);
    const [sw, sh] = this.spanOf(family, facing);
    const pos = this.hubPos(family, spec.directional || turnsItsGround(spec) ? (facing ?? 'S') : facing, ground);
    const ghost: Tower = {
      id: -1, family, pos, cell: ground[0], hp: spec.maxHp, maxHp: spec.maxHp, pips: [...pips], cooldown: 0, kills: 0,
    };
    if (ground.length > 1) ghost.cells = [...ground];
    // The facing addTower would give it.
    if (spec.directional) ghost.facing = facing ?? this.facingTowardGate(pos);
    else if (sw !== sh || spec.shape) ghost.facing = facing ?? 'S';
    else if (facing) ghost.facing = facing;
    this.towers.push(ghost);
    let s: TowerStats;
    try {
      s = this.statsOf(ghost);
    } finally {
      const at = this.towers.lastIndexOf(ghost);
      if (at >= 0) this.towers.splice(at, 1);
    }
    const factor = this.heightRangeFactor(ghost.cell);
    return { ...s, height: this.map.heights[ghost.cell] || 1, groundRange: s.range / factor };
  }

  /** Directive progress as { done, goal } for the HUD bar and tests. */
  directiveProgress(): { done: number; goal: number } {
    const d = this.directive;
    if (d.kind === 'hold') return { done: this.wavesCleared, goal: d.waves };
    if (d.kind === 'royal') return { done: this.royalsKilled, goal: d.count };
    return { done: Math.min(this.scienceBanked, d.science), goal: d.science };
  }

  private checkDirective(): void {
    if (this.outcome !== 'playing') return;
    const p = this.directiveProgress();
    if (p.done >= p.goal) {
      this.outcome = 'won';
      this.events.push({ kind: 'won' });
    }
  }

  takeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------- grid ----------

  cellIndex(cx: number, cy: number): number {
    return cy * this.cfg.gridW + cx;
  }

  cellCenter(cell: number): Vec {
    const cx = cell % this.cfg.gridW;
    const cy = Math.floor(cell / this.cfg.gridW);
    return { x: (cx + 0.5) * this.cfg.cellPx, y: (cy + 0.5) * this.cfg.cellPx };
  }

  cellAt(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.cfg.gridW - 1, Math.floor(x / this.cfg.cellPx)));
    const cy = Math.max(0, Math.min(this.cfg.gridH - 1, Math.floor(y / this.cfg.cellPx)));
    return this.cellIndex(cx, cy);
  }

  isOccupied(cell: number): boolean {
    return this.occupied.has(cell);
  }

  /**
   * Towers perch on creeped CITY BLOCKS, out of the enemy channels — reading
   * which block covers the most path legs is the game. The one exception is
   * the spine wall, which is placed IN a street to be chewed through.
   */
  canBuildTower(cell: number, family?: TowerFamily, facing?: RootDir): boolean {
    return this.groundFor(cell, family, facing) !== null;
  }

  /**
   * The cells a limb would be built on if this cell were pointed at (a big limb takes a
   * footprint that holds it), or null if it cannot be built there.
   */
  groundFor(cell: number, family?: TowerFamily, facing?: RootDir): number[] | null {
    return this.placementFor(cell, family, facing)?.cells ?? null;
  }

  /**
   * The ground a build would take and the way the limb would lie, or null. A limb LONGER
   * than it is wide that is given no facing is tried every way round, the way it would
   * face by itself first: it lies the first way that fits.
   */
  placementFor(cell: number, family?: TowerFamily, facing?: RootDir): { cells: number[]; facing?: RootDir } | null {
    if (cell < 0 || cell >= this.map.cells.length) return null;
    const spec = family ? towerSpec(family) : undefined;
    if (!family || !spec || !isMultiCell(spec)) return this.canBuildOn(cell, family) ? { cells: [cell], facing } : null;
    let ways: Array<RootDir | undefined> = [facing];
    if (!facing && turnsItsGround(spec)) {
      let first: RootDir = towerSpec(family).directional ? this.facingTowardGate(this.cellCenter(cell)) : 'S';
      // A wall in a street lies ACROSS the street if it can: across is what stops a column.
      if (isPassable(this.map.cells[cell])) {
        const next = this.flow.next[cell];
        const runsAlongX = next >= 0 && Math.abs((next % this.cfg.gridW) - (cell % this.cfg.gridW)) > 0;
        first = runsAlongX ? 'S' : 'E';
      }
      ways = [first, ...(['S', 'E', 'N', 'W'] as RootDir[]).filter((d) => d !== first)];
    }
    for (const way of ways) {
      const cells = this.footprintAt(cell, family, way, (c) => this.canBuildOn(c, family));
      if (cells) return { cells, facing: way };
    }
    return null;
  }

  /** May a limb stand on this one cell? */
  private canBuildOn(cell: number, family?: TowerFamily): boolean {
    if (this.isOccupied(cell) || cell === this.map.coreCell) return false;
    // A limb carrying a sling pip (banked for this build) makes its own ground:
    // it needs no creep under it, only claimed city (Collins: otherwise "the
    // effect is pointless").
    const selfRooting = this.pendingPips.some((p) => p.family === 'sling');
    if (!selfRooting && !this.isCreeped(cell)) return false;
    const t = this.map.cells[cell];
    if (t === CellType.Void) return false;
    if (family === 'spine') return t === CellType.Road || t === CellType.Block;
    if (family === 'swamp') return t === CellType.Road; // a swamp only makes sense IN the traffic
    return t === CellType.Block;
  }

  /** How many cells a limb of this family covers, across and down the board, facing this way (its footprint's bounding box). */
  spanOf(family: TowerFamily, facing?: RootDir): [number, number] {
    const fp = footprintOf(towerSpec(family), facing);
    return [fp.w, fp.h];
  }

  /**
   * The cells a limb of this family stands on, facing this way, when the FIRST of them (row-major, the
   * one it is filed under as `cell`) is this cell; null if any of them would be off the board.
   */
  cellsFromFirst(first: number, family: TowerFamily, facing?: RootDir): number[] | null {
    const fp = footprintOf(towerSpec(family), facing);
    const w = this.cfg.gridW;
    const x0 = (first % w) - fp.cells[0][0];
    const y0 = Math.floor(first / w) - fp.cells[0][1];
    if (x0 < 0 || y0 < 0 || x0 + fp.w > w || y0 + fp.h > this.cfg.gridH) return null;
    return fp.cells.map(([x, y]) => (y0 + y) * w + x0 + x);
  }

  /**
   * Where a limb on these cells stands for its reach, aim and effects: the middle of its HUB cells (a
   * rectangle's hub is all of it; a T's the junction of its bar; an L's its elbow; src/sim/footprint.ts).
   */
  hubPos(family: TowerFamily, facing: RootDir | undefined, cells: number[]): Vec {
    const fp = footprintOf(towerSpec(family), facing);
    const w = this.cfg.gridW;
    let mx = Infinity;
    let my = Infinity;
    for (const c of cells) { mx = Math.min(mx, c % w); my = Math.min(my, Math.floor(c / w)); }
    const hub = fp.cells.length === cells.length && fp.hub.length < fp.cells.length
      ? fp.hub.map(([x, y]) => (my + y) * w + mx + x)
      : cells;
    const pos = { x: 0, y: 0 };
    for (const c of hub) {
      const p = this.cellCenter(c);
      pos.x += p.x / hub.length;
      pos.y += p.y / hub.length;
    }
    return pos;
  }

  /**
   * The cells a limb would stand on if it were built at the cell pointed at, or null if it
   * cannot stand there. A limb of one cell stands on that cell. A BIG limb takes a footprint
   * that HOLDS the cell pointed at, every cell of which is legal ground (`ok`) of one kind
   * and one height; of several that would do, the first from the north-west.
   */
  footprintAt(cell: number, family: TowerFamily, facing: RootDir | undefined, ok: (cell: number) => boolean): number[] | null {
    const fp = footprintOf(towerSpec(family), facing);
    const sw = fp.w;
    const sh = fp.h;
    if (fp.cells.length === 1) return ok(cell) ? [cell] : null;
    const w = this.cfg.gridW;
    const px = cell % w;
    const py = Math.floor(cell / w);
    // Every placement of the shape (its bounding box from the north-west) that HOLDS the cell pointed at.
    for (let y0 = py - sh + 1; y0 <= py; y0++) {
      for (let x0 = px - sw + 1; x0 <= px; x0++) {
        if (x0 < 0 || y0 < 0 || x0 + sw > w || y0 + sh > this.cfg.gridH) continue;
        if (!fp.cells.some(([x, y]) => x0 + x === px && y0 + y === py)) continue;
        const cells = fp.cells.map(([x, y]) => (y0 + y) * w + x0 + x);
        const kind = this.map.cells[cells[0]];
        const high = this.map.heights[cells[0]];
        if (cells.every((c) => ok(c) && this.map.cells[c] === kind && this.map.heights[c] === high)) return cells;
      }
    }
    return null;
  }

  /** Every cell a limb stands on. */
  cellsOf(t: { cell: number; cells?: number[] }): number[] {
    return t.cells ?? [t.cell];
  }

  /** A limb lives while the creep holds any of the ground it stands on. */
  private rooted(t: Tower): boolean {
    return this.cellsOf(t).some((c) => this.isCreeped(c));
  }

  /** Where an enemy can stand to reach a limb: a street cell beside any cell of it (-1: none). */
  private standCellOf(t: { cell: number; cells?: number[] }): number {
    for (const c of this.cellsOf(t)) {
      const s = this.standCellFor(c);
      if (s >= 0) return s;
    }
    return -1;
  }

  /** An organ's footprint on the board: its shape turned `rot` quarter-turns, anchored at `cell` (null if off the board). */
  organFootprint(organ: OrganId, cell: number, rot = 0): number[] | null {
    const u = this.under;
    let pts = organSpec(organ).shape.map(([x, y]) => [x, y] as [number, number]);
    for (let r = 0; r < ((rot % 4) + 4) % 4; r++) pts = pts.map(([x, y]) => [-y, x] as [number, number]);
    const mx = Math.min(...pts.map((p) => p[0]));
    const my = Math.min(...pts.map((p) => p[1]));
    const ax = cell % u.w;
    const ay = Math.floor(cell / u.w);
    const out: number[] = [];
    for (const [x, y] of pts) {
      const cx = ax + x - mx;
      const cy = ay + y - my;
      if (cx < 0 || cy < 0 || cx >= u.w || cy >= u.h) return null;
      out.push(cy * u.w + cx);
    }
    return out;
  }

  /** Has the body grown close enough to this board cell to know what is buried there? */
  isUncovered(cell: number): boolean {
    const u = this.under;
    const x = cell % u.w;
    const y = Math.floor(cell / u.w);
    for (let i = 0; i < u.cells.length; i++) {
      if (u.cells[i].kind !== 'meteor' && !this.organAt(i)) continue;
      if (Math.max(Math.abs((i % u.w) - x), Math.abs(Math.floor(i / u.w) - y)) <= REVEAL_RANGE) return true;
    }
    return false;
  }

  /** The organ covering a board cell, if any. */
  organAt(cell: number): Organ | undefined {
    return this.organs.find((o) => o.cells.includes(cell));
  }

  /**
   * The organ stage: an organ grows where its whole footprint is open ground
   * (soil or a deposit), at least one cell TOUCHING the meteor or an organ,
   * and only between waves. Theme organs are one of each.
   */
  canBuildOrgan(organ: OrganId, cell: number, rot = 0): boolean {
    if (this.phase === 'siege') return false;
    const def = ORGAN_BY_ID[organ];
    if (!def) return false;
    if (def.kind === 'theme' && this.organs.some((o) => o.organ === organ)) return false;
    if (this.cfg.organPool && !this.cfg.organPool.includes(organ) && !(this.cfg.startOrgans ?? []).includes(organ)) return false;
    const cells = this.organFootprint(organ, cell, rot);
    if (!cells) return false;
    for (const c of cells) {
      const k = this.under.cells[c].kind;
      if ((k !== 'soil' && k !== 'deposit') || this.organAt(c)) return false;
    }
    // An organ that shoots things up into the city must touch the surface: a cell in the top row.
    if (def.surface && !cells.some((c) => c < this.under.w)) return false;
    return cells.some((c) => neighbours4(this.under, c).some((n) =>
      !cells.includes(n) && (this.under.cells[n].kind === 'meteor' || this.organAt(n) !== undefined)));
  }

  /** Highest evolution stage a limb may reach (the campaign's globe unlocks; skirmish = 3). */
  evolutionCapOf(family: TowerFamily): number {
    // A limb no organ unlocks (the trap cage) is capped under its own name (content/campaign.ts
    // territory unlocks `{ theme: 'cage' }`), not the meteor's.
    const caps = this.cfg.evolutionCap;
    if (caps && themeOf(family) === 'core' && caps[family] !== undefined) return caps[family]!;
    return caps?.[themeOf(family)] ?? 3;
  }

  /** The board and the body under it as they stand (kept by the campaign when a deployment is won). */
  snapshot(): BoardSnapshot {
    return snapshotBoard(this.map, this.underSeed, this.organs, this.coreLevel);
  }

  /** A remembered organ (src/sim/boardSnapshot.ts), back where it grew, at its level; skipped if the ground no longer takes it. */
  private regrowOrgan(o: { organ: OrganId; cell: number; rot: number; level: number }): void {
    if (!ORGAN_BY_ID[o.organ]) return;
    const cells = this.organFootprint(o.organ, o.cell, o.rot);
    if (!cells) return;
    for (const c of cells) {
      const k = this.under.cells[c]?.kind;
      if ((k !== 'soil' && k !== 'deposit') || this.organAt(c)) return;
    }
    this.organs.push({ id: this.nextId++, organ: o.organ, cell: o.cell, rot: o.rot, level: Math.max(1, o.level), cells });
    this.organCache = null;
    this.coreStrainCache = null;
    if (o.organ === 'cyst') for (let k = 0; k < CYST_NODES; k++) this.nodeStock.push(this.plainStrain());
  }

  /** Grow a starting-profile organ for free at the first spot touching the body. */
  private growFree(id: OrganId): void {
    const phase = this.phase;
    for (let cell = 0; cell < this.under.cells.length; cell++) {
      for (let rot = 0; rot < 4; rot++) {
        if (!this.canBuildOrgan(id, cell, rot)) continue;
        const cells = this.organFootprint(id, cell, rot)!;
        this.organs.push({ id: this.nextId++, organ: id, cell, rot, level: 1, cells });
        this.organCache = null;
        this.coreStrainCache = null;
        if (id === 'cyst') for (let k = 0; k < CYST_NODES; k++) this.nodeStock.push(this.plainStrain());
        this.phase = phase;
        return;
      }
    }
  }

  /** Organs of one kind touching (edge to edge) an organ. */
  private touchingOrgans(o: Organ, kind: OrganId): number {
    const u = this.under;
    return this.organs.filter((x) => x !== o && x.organ === kind
      && x.cells.some((c) => o.cells.some((oc) => neighbours4(u, oc).includes(c)))).length;
  }

  /** A plain node (cysts, genes): no recipe. */
  plainStrain(): NodeStrain {
    return { radius: NODE_RADIUS, reach: NODE_REACH, slow: 1, dps: 0 };
  }

  /** The strain a bladder's nodes carry: the creep organs TOUCHING it are the recipe. */
  bladderStrain(o: Organ): NodeStrain {
    return {
      radius: NODE_RADIUS + this.touchingOrgans(o, 'swell'),
      reach: NODE_REACH + CATAPULT_REACH * this.touchingOrgans(o, 'catapult'),
      slow: MIRE_SLOW ** this.touchingOrgans(o, 'mire'),
      dps: LINING_DPS * this.touchingOrgans(o, 'acid'),
    };
  }

  /** Creep organs touching the METEOR shape the core's own creep. */
  coreStrainBonus(): { radius: number; slow: number; dps: number } {
    if (this.coreStrainCache) return this.coreStrainCache;
    const meteor = this.under.cells.map((c, i) => (c.kind === 'meteor' ? i : -1)).filter((i) => i >= 0);
    const touching = (kind: OrganId) => this.organs.filter((o) => o.organ === kind
      && o.cells.some((c) => neighbours4(this.under, c).some((n) => meteor.includes(n)))).length;
    this.coreStrainCache = { radius: touching('swell'), slow: MIRE_SLOW ** touching('mire'), dps: LINING_DPS * touching('acid') };
    return this.coreStrainCache;
  }

  /**
   * A bladder's rhythm: it grows `per` nodes (1 + budding glands touching it)
   * every `every` turns — 2 by default, 1 with a pacemaker touching it; each
   * pacemaker past the first adds a node when the wave starts.
   */
  bladderRate(o: Organ): { every: number; per: number; atWaveStart: number } {
    const pace = this.touchingOrgans(o, 'pacemaker');
    return {
      every: Math.max(1, BLADDER_TURNS - pace),
      per: 1 + this.touchingOrgans(o, 'budder'),
      atWaveStart: Math.max(0, pace - (BLADDER_TURNS - 1)),
    };
  }

  /** Turns until this bladder next grows (1 = at the next wave clear). */
  bladderTurnsLeft(o: Organ): number {
    return Math.max(1, this.bladderRate(o).every - (this.bladderTurns.get(o.id) ?? 0));
  }

  /** Nodes the bladders will grow at the next wave clear (for the tray). */
  nodesNextTurn(): number {
    return this.organs.filter((o) => o.organ === 'bladder' && this.bladderTurnsLeft(o) === 1)
      .reduce((n, o) => n + this.bladderRate(o).per, 0);
  }

  /** Turns until this scaffold gland next grows its plinth (1 = at the next wave clear). */
  scaffoldTurnsLeft(o: Organ): number {
    return Math.max(1, PLINTH_TURNS - (this.scaffoldTurns.get(o.id) ?? 0));
  }

  /** Plinths the scaffold glands will grow at the next wave clear. */
  plinthsNextTurn(): number {
    return this.organs.filter((o) => o.organ === 'scaffold' && this.scaffoldTurnsLeft(o) === 1).length;
  }

  /** Turns until this seeding gland next grows its seedling (1 = at the next wave clear). */
  seederTurnsLeft(o: Organ): number {
    return Math.max(1, SEEDLING_TURNS - (this.seederTurns.get(o.id) ?? 0));
  }

  /** Every seeding gland counts a turn; one that has waited its turns puts a free Seedling in the hand. */
  private growSeedlings(): void {
    let grown = 0;
    for (const o of this.organs) {
      if (o.organ !== 'seeder') continue;
      const t = (this.seederTurns.get(o.id) ?? 0) + 1;
      if (t >= SEEDLING_TURNS) {
        this.hand.push({ id: this.nextId++, family: 'sprout', free: true });
        grown += 1;
      }
      this.seederTurns.set(o.id, t >= SEEDLING_TURNS ? 0 : t);
    }
    if (grown > 0) this.events.push({ kind: 'seedling-grown', count: grown });
  }

  /** Every scaffold gland counts a turn; one that has waited its turns grows a plinth. */
  private growPlinths(): void {
    let grown = 0;
    for (const o of this.organs) {
      if (o.organ !== 'scaffold') continue;
      const t = (this.scaffoldTurns.get(o.id) ?? 0) + 1;
      if (t >= PLINTH_TURNS) grown += 1;
      this.scaffoldTurns.set(o.id, t >= PLINTH_TURNS ? 0 : t);
    }
    if (grown > 0) {
      this.plinths += grown;
      this.events.push({ kind: 'plinth-grown', count: grown });
    }
  }

  /**
   * What a plinth put at this cell would raise, or null if none can be put there.
   * It raises ONE THING: the limb that stands on the cell, all of it, or the bare roof of
   * the cell. Only roofs (a street is not raised), only ground the body holds, and nothing
   * higher than PLINTH_MAX_HEIGHT.
   */
  plinthGround(cell: number): number[] | null {
    if (cell < 0 || cell >= this.map.cells.length) return null;
    const on = this.occupied.get(cell);
    const limb = on && on.kind === 't' ? this.towers.find((t) => t.id === on.id) : undefined;
    const cells = limb ? this.cellsOf(limb) : [cell];
    for (const c of cells) {
      if (this.map.cells[c] !== CellType.Block) return null;
      if (!limb && !this.isCreeped(c)) return null;
      if ((this.map.heights[c] || 1) + 1 > PLINTH_MAX_HEIGHT) return null;
    }
    return cells;
  }

  canPlacePlinth(cell: number): boolean {
    return this.plinths > 0 && this.plinthGround(cell) !== null;
  }

  /** Every bladder grows its turn's nodes (wave clear), or its pacemaker nodes (wave start). */
  private growCreepNodes(when: 'turn' | 'waveStart'): void {
    let grown = 0;
    for (const o of this.organs) {
      if (o.organ !== 'bladder') continue;
      const r = this.bladderRate(o);
      let n = r.atWaveStart;
      if (when === 'turn') {
        const t = (this.bladderTurns.get(o.id) ?? 0) + 1;
        n = t >= r.every ? r.per : 0;
        this.bladderTurns.set(o.id, t >= r.every ? 0 : t);
      }
      const strain = this.bladderStrain(o);
      for (let k = 0; k < n; k++) this.nodeStock.push({ ...strain });
      grown += n;
    }
    if (grown > 0) this.events.push({ kind: 'node-grown', count: grown });
  }


  private sampleStats(): void {
    const st = this.stats;
    st.maxLimbs = Math.max(st.maxLimbs, this.towers.length);
    st.maxBurning = Math.max(st.maxBurning, this.enemies.filter((e) => (e.burnUntil ?? 0) > this.time).length);
    for (const t of this.towers) st.maxPips = Math.max(st.maxPips, t.pips.length);
    st.coreMinFrac = Math.min(st.coreMinFrac, Math.max(0, this.coreHp / this.coreMaxHp));
  }

  /** How many organs of one kind are grown. */
  organCount(kind: OrganId): number {
    let n = 0;
    for (const o of this.organs) if (o.organ === kind) n++;
    return n;
  }

  /**
   * Burning creep eats the ground bodies standing on it; war and royal bodies
   * standing ON a node trample it (a node that dies takes its creep with it).
   */
  private digestOnCreep(): void {
    const nodes = this.creepSources.filter((s) => s.kind === 'node');
    const anyBurn = nodes.some((n) => (n.strain?.dps ?? 0) > 0) || this.coreStrainBonus().dps > 0;
    for (const e of [...this.enemies]) {
      if (e.burrowed || this.isAirborne(e)) continue;
      if (anyBurn) {
        const dps = this.creepEffectAt(this.cellAt(e.pos.x, e.pos.y)).dps;
        if (dps > 0) {
          e.hp -= dps * DT; // a medium, like poison: armor does not stop it
          if (e.hp <= 0) { this.killEnemy(e.id, 1, false, undefined, 'creep'); continue; }
        }
      }
      const spec = enemySpec(e.kind);
      if (spec.caste === 'science') continue;
      for (const n of nodes) {
        if (dist(e.pos, this.cellCenter(n.cell)) <= 14) this.hurtNode(n, spec.damage * NODE_TRAMPLE * DT);
      }
    }
  }

  /** Harm a creep node; at zero it dies and its creep recedes (what stood only on it withers). */
  hurtNode(n: CreepSource, amount: number): void {
    if (n.kind !== 'node' || !this.creepSources.includes(n)) return;
    n.hp = (n.hp ?? NODE_HP) - amount;
    if (n.hp > 0) return;
    this.creepSources = this.creepSources.filter((x) => x !== n);
    this.sourceDist.delete(n.id);
    this.events.push({ kind: 'node-lost', cell: n.cell });
    this.stats.nodesLost += 1;
    this.refreshRouting();
    this.witherUnrooted();
  }

  /** What the creep on a cell does to a ground enemy: speed multiplier and burn per second. */
  creepEffectAt(cell: number): { slow: number; dps: number } {
    let slow = 1;
    let dps = 0;
    const d = this.creepDist[cell];
    if (d >= 0 && d <= this.creepRangeCells) {
      const core = this.coreStrainBonus();
      slow *= core.slow;
      dps += core.dps;
    }
    for (const s of this.creepSources) {
      if (s.kind !== 'node' || !s.strain) continue;
      if (s.strain.slow === 1 && s.strain.dps === 0) continue;
      if (!this.sourceCovers(s, cell)) continue;
      slow *= s.strain.slow;
      dps += s.strain.dps;
    }
    return { slow, dps };
  }


  /** Put a node down: its creep, hit points and the clock until it can spread its one child. */
  private plantNode(cell: number, strain: NodeStrain): CreepSource {
    const n = this.addCreepSource('node', cell, strain.radius);
    n.strain = strain;
    n.hp = NODE_HP;
    n.maxHp = NODE_HP;
    n.matureAt = this.wavesCleared + 1;
    n.spent = false;
    this.refreshRouting();
    return n;
  }

  /** A mature node spreads its child anywhere within its creep radius + reach (claimed ground). */
  canSpreadTo(p: CreepSource, cell: number): boolean {
    if (cell < 0 || cell >= this.map.cells.length || this.map.cells[cell] === CellType.Void || !p.strain) return false;
    const w = this.cfg.gridW;
    const md = Math.abs((cell % w) - (p.cell % w)) + Math.abs(Math.floor(cell / w) - Math.floor(p.cell / w));
    return md > 0 && md <= p.strain.radius + p.strain.reach;
  }

  /** A node may go on any claimed ground within its strain's reach of the creep. */
  canPlaceNode(cell: number, reach: number = this.nodeStock[0]?.reach ?? NODE_REACH): boolean {
    if (cell < 0 || cell >= this.map.cells.length || this.map.cells[cell] === CellType.Void) return false;
    if (this.isCreeped(cell)) return true;
    const w = this.cfg.gridW;
    const r = reach;
    const cx = cell % w;
    const cy = Math.floor(cell / w);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= this.cfg.gridH) continue;
        if (Math.abs(dx) + Math.abs(dy) > r) continue;
        if (this.isCreeped(y * w + x)) return true;
      }
    }
    return false;
  }

  /** Price of the next level: the organ's cost times its current level (the meteor: 30 war per level). */
  organUpgradeCost(o: Organ | null): { war?: number; science?: number } {
    if (!o) return { war: 30 * this.coreLevel };
    const c = organSpec(o.organ).cost;
    return { war: c.war ? c.war * o.level : undefined, science: c.science ? c.science * o.level : undefined };
  }

  /** Meteor cells (the core's buried half — the first theme organ). */
  private meteorCells(): number[] {
    const out: number[] = [];
    this.under.cells.forEach((c, i) => { if (c.kind === 'meteor') out.push(i); });
    return out;
  }

  /** Cells within one step (8-way) of a footprint: a zone organ's zone. */
  private zoneOf(cells: number[]): Set<number> {
    const u = this.under;
    const z = new Set<number>();
    for (const c of cells) {
      const x = c % u.w;
      const y = Math.floor(c / u.w);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= u.w || ny >= u.h) continue;
          z.add(ny * u.w + nx);
        }
      }
    }
    for (const c of cells) z.delete(c);
    return z;
  }

  /** The theme "nodes": the meteor (core) plus every theme organ, with their footprints. */
  themeNodes(): Array<{ theme: OrganId | 'core'; cells: number[]; baseLevel: number; signature: TowerFamily; organ?: Organ }> {
    const nodes: Array<{ theme: OrganId | 'core'; cells: number[]; baseLevel: number; signature: TowerFamily; organ?: Organ }> = [
      { theme: 'core', cells: this.meteorCells(), baseLevel: this.coreLevel, signature: METEOR_THEME.signature },
    ];
    for (const o of this.organs) {
      const d = ORGAN_BY_ID[o.organ];
      if (d.kind === 'theme' && d.signature) nodes.push({ theme: o.organ, cells: o.cells, baseLevel: o.level, signature: d.signature, organ: o });
    }
    return nodes;
  }

  /**
   * Everything the organ stage does to the surface, per theme: its effective
   * LEVEL (own level + heart zones + touching features), the SIGNATURE verbs
   * it receives from the theme organs it touches (directly or through a root
   * chain; doubled from any organ in a gland's zone), and its DRAW multiplier
   * (brain zones). Cached; rebuilt whenever an organ is grown or upgraded.
   */
  organEffects(): Map<OrganId | 'core', { level: number; pips: ModPip[]; draw: number; links: Array<OrganId | 'core'> }> {
    if (this.organCache) return this.organCache;
    const u = this.under;
    const nodes = this.themeNodes();
    const zones = this.organs.filter((o) => ORGAN_BY_ID[o.organ].kind === 'zone')
      .map((o) => ({ effect: ORGAN_BY_ID[o.organ].zone!, zone: this.zoneOf(o.cells) }));
    const roots = this.organs.filter((o) => o.organ === 'root');
    const touches = (a: number[], b: number[]) => a.some((c) => neighbours4(u, c).some((n) => b.includes(n)));
    const inZone = (cells: number[], effect: string) => zones.filter((z) => z.effect === effect && cells.some((c) => z.zone.has(c))).length;
    // Roots conduct: each theme node reaches the roots it touches, and roots reach roots.
    const reachRoots = (cells: number[]): number[] => {
      const seen = new Set<number>();
      const stack = roots.filter((r) => touches(cells, r.cells));
      while (stack.length) {
        const r = stack.pop()!;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        for (const r2 of roots) if (!seen.has(r2.id) && touches(r.cells, r2.cells)) stack.push(r2);
      }
      return roots.filter((r) => seen.has(r.id)).flatMap((r) => r.cells);
    };
    const out = new Map<OrganId | 'core', { level: number; pips: ModPip[]; draw: number; links: Array<OrganId | 'core'> }>();
    for (const n of nodes) {
      let level = n.baseLevel + inZone(n.cells, 'level');
      for (const c of n.cells) {
        for (const nb of neighbours4(u, c)) {
          const f = u.cells[nb];
          if (f.kind === 'feature' && f.feature) level += FEATURES[f.feature].favors === n.theme ? FEATURE_FAVORED_LEVEL : FEATURE_LEVEL;
        }
      }
      const reach = [...n.cells, ...reachRoots(n.cells)];
      const pips: ModPip[] = [];
      const links: Array<OrganId | 'core'> = [];
      for (const m of nodes) {
        if (m === n || !touches(reach, m.cells)) continue;
        links.push(m.theme);
        const times = 1 + inZone(m.cells, 'share');
        for (let k = 0; k < times; k++) pips.push({ family: m.signature });
      }
      const draw = inZone(n.cells, 'suppress') > 0 ? 0 : BRAIN_DRAW_MULT ** inZone(n.cells, 'draw');
      out.set(n.theme, { level, pips, draw, links });
    }
    this.organCache = out;
    return out;
  }

  /** Limb families you can draw: the meteor's, plus every theme organ's (all of them without the organ stage). */
  isUnlocked(family: TowerFamily): boolean {
    if (!this.cfg.organStage) return true;
    const th = themeOf(family);
    return th === 'core' || this.organs.some((o) => o.organ === th);
  }

  /** The organ-stage effect on one limb family (level multiplier + shared verbs). */
  organBonusOf(family: TowerFamily): { potency: number; tempo: number; pips: ModPip[]; draw: number } {
    const e = this.organEffects().get(themeOf(family));
    if (!e) return { potency: 1, tempo: 1, pips: [], draw: 1 };
    const up = Math.max(0, e.level - 1);
    return { potency: 1 + ORGAN_LEVEL_POTENCY * up, tempo: 1 + ORGAN_LEVEL_TEMPO * up, pips: e.pips, draw: e.draw * (1 + 0.25 * up) };
  }



  canAfford(cost: Partial<Record<Caste, number>>): boolean {
    return (['war', 'science', 'royal'] as Caste[]).every(
      (c) => this.meat[c] >= (cost[c] ?? 0),
    );
  }

  private pay(cost: Partial<Record<Caste, number>>): void {
    for (const c of ['war', 'science', 'royal'] as Caste[]) {
      this.meat[c] -= cost[c] ?? 0;
    }
  }

  private computeFlowField() {
    return computeFlow(this.map, this.map.coreCell, (cell) => {
      const s = this.occupied.get(cell);
      if (!s) return 0;
      // A digestive pit is a floor, not a wall: the column walks straight onto it.
      if (s.kind === 't' && this.towers.find((t) => t.id === s.id)?.family === 'swamp') return 0;
      return STRUCTURE_FLOW_COST;
    });
  }

  private refreshRouting(): void {
    this.routeCache.clear();
    this.dangerMap = null;
    this.flow = this.computeFlowField();
    this.creepDist = allDistance(this.map, this.map.coreCell);
    // The map may have grown: recompute every source's reach over the new terrain,
    // and rebuild the seep sources from limbs carrying sling pips.
    this.creepSources = this.creepSources.filter((s) => {
      if (s.kind === 'seep') { this.sourceDist.delete(s.id); return false; }
      return true;
    });
    for (const s of this.creepSources) this.sourceDist.set(s.id, allDistance(this.map, s.cell));
    for (const t of this.towers) {
      const seep = towerStats(t).seepRadius;
      if (seep > 0) this.addCreepSource('seep', t.cell, seep, undefined, t.id);
    }
  }

  // ---------- cards ----------

  /** One card, by the draw weights; `only` narrows the draw to those families (still one rng draw). */
  private drawCard(only?: readonly TowerFamily[]): CardInstance {
    const w = this.drawWeights();
    if (only?.length && TOWERS.some((t) => only.includes(t.family) && w[t.family] > 0)) {
      for (const t of TOWERS) if (!only.includes(t.family)) w[t.family] = 0;
    }
    // An atrophy gland must never leave nothing to draw: if everything is starved, ignore it.
    const total = TOWERS.reduce((a, t) => a + w[t.family], 0);
    const spec = this.rng.weighted(TOWERS, (t) => (total > 0 ? w[t.family]
      : (this.isUnlocked(t.family) ? t.weight : 0) * (this.geneMods.weightMult[t.family] ?? 1)));
    return { id: this.nextId++, family: spec.family };
  }

  /** Current draw weight per family (for the HUD odds inspector and tests). */
  drawWeights(): Record<TowerFamily, number> {
    const out = {} as Record<TowerFamily, number>;
    for (const t of TOWERS) {
      out[t.family] = (this.isUnlocked(t.family) ? t.weight : 0)
        * (this.geneMods.weightMult[t.family] ?? 1)
        * this.organBonusOf(t.family).draw;
    }
    return out;
  }

  // ---------- commands ----------

  issue(cmd: Command): { ok: boolean; err?: string } {
    if (this.outcome !== 'playing') return { ok: false, err: 'game over' };
    switch (cmd.kind) {
      case 'build': {
        const card = this.hand[cmd.cardIndex];
        if (!card) return { ok: false, err: 'no such card' };
        const spec = towerSpec(card.family);
        const place = this.placementFor(cmd.cell, card.family, cmd.facing);
        if (!place) return { ok: false, err: isMultiCell(spec) ? `it needs ${footprintName(spec)} of one flat roof your creep holds` : 'cell not buildable' };
        const ground = place.cells;
        if (cmd.cannibalizeTowerId !== undefined) {
          // Legacy atomic path (autoplayer/tests): butcher-then-build in one command.
          const donor = this.towers.find((t) => t.id === cmd.cannibalizeTowerId);
          if (!donor) return { ok: false, err: 'no such donor' };
          const salv = this.salvageOf(donor.family);
          const affordable = (['war', 'science', 'royal'] as Caste[]).every(
            (c) => this.meat[c] + (salv[c] ?? 0) >= (spec.cost[c] ?? 0),
          );
          if (!affordable) return { ok: false, err: 'cannot afford' };
          this.butcherTower(donor);
        }
        if (!card.free && !this.canAfford(spec.cost)) return { ok: false, err: 'cannot afford' };
        const pips = this.pendingPips;
        this.pendingPips = [];
        if (pips.length > 0) {
          this.events.push({ kind: 'cannibalized', donor: pips[pips.length - 1].family, into: card.family });
          this.stats.cannibalized += 1;
        }
        if (!card.free) this.pay(spec.cost);
        const grown = this.addTower(card.family, ground[0], pips, place.facing ?? cmd.facing, ground);
        // SURGERY UNDER FIRE: grafting what was eaten takes time, and mid-siege that time is
        // spent in the open — the new limb holds fire, bleeds double, and draws the climbers.
        if (pips.length > 0 && this.phase === 'siege') {
          const seconds = B.graftSeconds + B.graftPerPip * pips.length;
          grown.graftUntil = this.time + seconds;
          this.stats.surgeriesUnderFire = (this.stats.surgeriesUnderFire ?? 0) + 1;
          this.events.push({ kind: 'surgery-under-fire', family: card.family, seconds });
        }
        this.hand.splice(cmd.cardIndex, 1);
        // A free card (a pair's second half) is not replaced; a paired card hands
        // you its free twin to place next.
        if (!card.free) this.hand.push(this.drawCard());
        if (spec.pair && !card.free) this.hand.push({ id: this.nextId++, family: card.family, free: true });
        this.events.push({ kind: 'built', family: card.family, pips: pips.length });
        this.stats.limbsGrown += 1;
        if (!this.stats.families.includes(card.family)) this.stats.families.push(card.family);
        return { ok: true };
      }
      case 'evolve': {
        const t = this.towers.find((x) => x.id === cmd.towerId);
        if (!t) return { ok: false, err: 'no such limb' };
        const stage = t.upgrades?.length ?? 0;
        if (stage >= 3) return { ok: false, err: 'fully evolved' };
        if (stage >= this.evolutionCapOf(t.family)) return { ok: false, err: 'locked — take the territory that unlocks it' };
        const cost = UPGRADE_COST[stage];
        if (!this.canAfford(cost)) return { ok: false, err: 'cannot afford' };
        this.pay(cost);
        const before = this.statsOf(t).maxHp;
        t.upgrades = [...(t.upgrades ?? []), cmd.choice];
        const after = this.statsOf(t).maxHp;
        t.maxHp = after;
        t.hp = Math.min(after, t.hp + Math.max(0, after - before));
        const opt = UPGRADES[t.family][stage][cmd.choice === 'A' ? 0 : 1];
        this.events.push({ kind: 'evolved', family: t.family, stage: stage + 1, choice: cmd.choice, name: opt.name });
        this.stats.evolutions += 1;
        return { ok: true };
      }
      case 'butcher': {
        const donor = this.towers.find((t) => t.id === cmd.towerId);
        if (!donor) return { ok: false, err: 'no such tower' };
        this.butcherTower(donor);
        return { ok: true };
      }
      case 'set-marker': {
        const t = this.towers.find((x) => x.id === cmd.towerId && x.family === 'bombard');
        if (!t) return { ok: false, err: 'no such bombard' };
        if (this.map.cells[cmd.cell] === CellType.Void) return { ok: false, err: 'unclaimed city' };
        if (dist(t.pos, this.cellCenter(cmd.cell)) > this.statsOf(t).range) return { ok: false, err: 'out of range' };
        t.marker = cmd.cell;
        return { ok: true };
      }
      case 'set-priority': {
        const t = this.towers.find((x) => x.id === cmd.towerId);
        if (!t) return { ok: false, err: 'no such tower' };
        if (cmd.mode) t.priority = cmd.mode;
        if (cmd.caste) t.casteFocus = cmd.caste;
        t.lastTargetId = undefined;
        t.streak = 0;
        return { ok: true };
      }
      case 'build-organ': {
        const spec = organSpec(cmd.organ);
        const rot = cmd.rot ?? 0;
        if (this.phase === 'siege') return { ok: false, err: 'organs grow between waves' };
        if (!this.canBuildOrgan(cmd.organ, cmd.cell, rot)) return { ok: false, err: 'must fit on open ground touching the body' };
        if (!this.canAfford(spec.cost)) return { ok: false, err: 'cannot afford' };
        this.pay(spec.cost);
        const cells = this.organFootprint(cmd.organ, cmd.cell, rot)!;
        this.organs.push({ id: this.nextId++, organ: cmd.organ, cell: cmd.cell, rot, level: 1, cells });
        this.organCache = null;
        this.coreStrainCache = null;
        // Grown over deposits: each pays out now.
        for (const c of cells) {
          const d = this.under.cells[c];
          if (d.kind !== 'deposit' || !d.deposit || d.claimed) continue;
          d.claimed = true;
          const pay = d.pay ?? DEPOSITS[d.deposit].now;
          this.meat.war += pay.war ?? 0;
          this.meat.science += pay.science ?? 0;
          this.meat.royal += pay.royal ?? 0;
          this.biomass += pay.biomass ?? 0;
          if (d.pips) this.pendingPips = [...this.pendingPips, ...d.pips];
          this.events.push({ kind: 'deposit-claimed', name: DEPOSITS[d.deposit].name });
          this.stats.depositsClaimed += 1;
        }
        if (cmd.organ === 'cyst') {
          for (let k = 0; k < CYST_NODES; k++) this.nodeStock.push(this.plainStrain());
          this.events.push({ kind: 'node-grown', count: CYST_NODES });
        }
        this.events.push({ kind: 'organ-built', organ: cmd.organ });
        return { ok: true };
      }
      case 'place-node': {
        const i = cmd.stock ?? 0;
        const strain = this.nodeStock[i];
        if (!strain) return { ok: false, err: 'no creep nodes in stock' };
        if (!this.canPlaceNode(cmd.cell, strain.reach)) return { ok: false, err: 'too far from your creep' };
        this.nodeStock.splice(i, 1);
        this.plantNode(cmd.cell, strain);
        this.events.push({ kind: 'node-placed', cell: cmd.cell });
        this.stats.nodesPlaced += 1;
        return { ok: true };
      }
      case 'place-plinth': {
        if (this.plinths < 1) return { ok: false, err: 'no plinths in stock' };
        const ground = this.plinthGround(cmd.cell);
        if (!ground) {
          const t = this.map.cells[cmd.cell];
          if (t !== CellType.Block) return { ok: false, err: 'a plinth stands on a roof' };
          if ((this.map.heights[cmd.cell] || 1) + 1 > PLINTH_MAX_HEIGHT) return { ok: false, err: 'it can be raised no higher' };
          return { ok: false, err: 'your creep does not hold this roof' };
        }
        for (const c of ground) {
          this.map.heights[c] = (this.map.heights[c] || 1) + 1;
          this.map.plinths[c] += 1;
        }
        this.plinths -= 1;
        this.plinthsPlaced += 1;
        // What stands higher reaches further: what the enemy reads of the guns changes with it.
        this.refreshRouting();
        this.events.push({ kind: 'plinth-placed', cell: cmd.cell, height: this.map.heights[ground[0]] });
        return { ok: true };
      }
      case 'spread-node': {
        const p = this.creepSources.find((x) => x.id === cmd.sourceId && x.kind === 'node');
        if (!p || !p.strain) return { ok: false, err: 'no such node' };
        if (p.spent) return { ok: false, err: 'this node has already spread' };
        if (this.wavesCleared < (p.matureAt ?? 0)) return { ok: false, err: 'not mature yet — it must survive a wave' };
        if (!this.canSpreadTo(p, cmd.cell)) return { ok: false, err: 'out of its reach' };
        p.spent = true;
        this.plantNode(cmd.cell, { ...p.strain });
        this.events.push({ kind: 'node-spread', cell: cmd.cell });
        return { ok: true };
      }
      case 'upgrade-organ': {
        if (this.phase === 'siege') return { ok: false, err: 'organs grow between waves' };
        // -1 = the meteor core itself.
        const o = cmd.organInstanceId === -1 ? null : this.organs.find((x) => x.id === cmd.organInstanceId);
        if (cmd.organInstanceId !== -1 && (!o || ORGAN_BY_ID[o.organ].kind !== 'theme')) return { ok: false, err: 'only theme organs level up' };
        const cost = this.organUpgradeCost(o ?? null);
        if (!this.canAfford(cost)) return { ok: false, err: 'cannot afford' };
        this.pay(cost);
        if (o) o.level += 1;
        else this.coreLevel += 1;
        this.organCache = null;
        this.events.push({ kind: 'organ-upgraded', organ: o ? o.organ : 'heart', level: o ? o.level : this.coreLevel });
        return { ok: true };
      }
      case 'sling-throw': {
        const t = this.towers.find((x) => x.id === cmd.towerId && x.family === 'sling');
        if (!t) return { ok: false, err: 'no such sling' };
        if (t.cooldown > 0) return { ok: false, err: 'sling recharging' };
        if (this.map.cells[cmd.cell] === CellType.Void) return { ok: false, err: 'unclaimed city' };
        const to = this.cellCenter(cmd.cell);
        const st = this.statsOf(t);
        if (dist(t.pos, to) > this.slingRangeOf(t)) return { ok: false, err: 'out of range' };
        // Payload terms: tempo = faster recharge; splash = bigger patch; the clot
        // lands with a thud that carries every hit verb the sling has eaten.
        t.cooldown = B.slingCooldown / st.tempo;
        const spec = towerSpec('sling');
        // Twinned: extra clots land in a line past the first, each its own patch.
        const dx = to.x - t.pos.x;
        const dy = to.y - t.pos.y;
        const m = Math.hypot(dx, dy) || 1;
        for (let k = 0; k < st.volley; k++) {
          const at = { x: to.x + (dx / m) * 40 * k, y: to.y + (dy / m) * 40 * k };
          const cell = this.cellAt(at.x, at.y);
          if (k > 0 && this.map.cells[cell] === CellType.Void) break;
          this.clotFlights.push({
            id: this.nextId++, from: { ...t.pos }, to: at, cell, ttl: B.clotFlightSeconds,
            ownerId: t.id, fx: fxOf(t, st), aoe: st.aoe, patchBonus: (st.aoe - spec.aoe) / 12,
          });
        }
        this.events.push({ kind: 'clot-hurled', cell: cmd.cell });
        return { ok: true };
      }
      case 'bile-throw': {
        const t = this.towers.find((x) => x.id === cmd.towerId && x.family === 'lobber');
        if (!t) return { ok: false, err: 'no such lobber' };
        if (t.cooldown > 0) return { ok: false, err: 'lobber recharging' };
        if (this.map.cells[cmd.cell] === CellType.Void) return { ok: false, err: 'unclaimed city' };
        const to = this.cellCenter(cmd.cell);
        const st = this.statsOf(t);
        if (dist(t.pos, to) > st.range) return { ok: false, err: 'out of range' };
        t.cooldown = B.lobberCooldown / st.tempo;
        for (let k = 0; k < st.volley; k++) {
          // Twinned globs splash in a small ring around the aim point.
          const a = (k / Math.max(1, st.volley)) * Math.PI * 2;
          const r = k === 0 ? 0 : 24;
          this.bileFlights.push({
            id: this.nextId++, from: { ...t.pos }, to: { x: to.x + Math.cos(a) * r, y: to.y + Math.sin(a) * r },
            cell: cmd.cell, ttl: B.bileFlightSeconds, fx: fxOf(t, st), aoe: st.aoe,
          });
        }
        return { ok: true };
      }
      case 'set-facing': {
        // Any limb turns (right-click). A directional one aims its field of fire; the rest turn
        // the way they are drawn. A LONG limb that is not directional keeps its ground: it turns
        // end for end only (a quarter turn would need other ground under it).
        const t = this.towers.find((x) => x.id === cmd.towerId);
        if (!t) return { ok: false, err: 'no such limb' };
        const spec = towerSpec(t.family);
        const [sw, sh] = this.spanOf(t.family, t.facing);
        if (!spec.directional && !spec.shape && sw !== sh) {
          const axisNS = (d: RootDir | undefined) => d === 'N' || d === 'S' || d === undefined;
          if (axisNS(cmd.dir) !== axisNS(t.facing)) return { ok: false, err: 'a long limb turns end for end only' };
        }
        // A LONG limb that aims (a creep lance, a skipping mortar) lies along its aim: a quarter
        // turn lays it the other way on the same roof, pivoting on its own ground, or is refused.
        // A SHAPED limb (a T, an L) takes new ground on every turn the same way (src/sim/footprint.ts).
        const sameGround = (() => {
          const a = footprintOf(spec, t.facing);
          const b = footprintOf(spec, cmd.dir);
          return a.w === b.w && a.h === b.h && a.cells.every(([x, y], i) => b.cells[i][0] === x && b.cells[i][1] === y);
        })();
        if ((spec.shape && !sameGround) || (spec.directional && sw !== sh && this.spanOf(t.family, cmd.dir)[0] !== sw)) {
          const own = new Set(this.cellsOf(t));
          const kind = this.map.cells[t.cell];
          const high = this.map.heights[t.cell];
          const ok = (c: number) => own.has(c) || (this.map.cells[c] === kind && this.map.heights[c] === high
            && !this.isOccupied(c) && c !== this.map.coreCell && this.isCreeped(c));
          let cells: number[] | null = null;
          for (const pivot of this.cellsOf(t)) {
            cells = this.footprintAt(pivot, t.family, cmd.dir, ok);
            if (cells) break;
          }
          if (!cells) return { ok: false, err: spec.shape ? `no room to turn it that way here: ${footprintName(spec)} needs new ground to turn` : 'no room to turn it that way here: a long limb lies along its aim' };
          for (const c of own) this.occupied.delete(c);
          for (const c of cells) this.occupied.set(c, { kind: 't', id: t.id });
          t.cell = cells[0];
          t.cells = cells;
          t.pos = this.hubPos(t.family, cmd.dir, cells);
          for (const s of this.creepSources) {
            if (s.kind !== 'line' || s.ownerId !== t.id) continue;
            s.cell = t.cell;
            this.sourceDist.set(s.id, allDistance(this.map, t.cell));
          }
          t.facing = cmd.dir;
          this.refreshRouting();
          return { ok: true };
        }
        t.facing = cmd.dir;
        return { ok: true };
      }
      case 'decree': {
        const def = DECREE_BY_ID[cmd.decree];
        if (!def) return { ok: false, err: 'no such decree' };
        const price = this.decreeCost(cmd.decree);
        if (this.meat.royal < price) return { ok: false, err: `it takes ${price} royal point${price === 1 ? '' : 's'}` };
        let family: TowerFamily | undefined;
        switch (cmd.decree) {
          case 'crown': {
            const t = this.towers.find((x) => x.id === cmd.towerId);
            if (!t) return { ok: false, err: 'a crown is set on a limb: open its panel' };
            t.crowns = (t.crowns ?? 0) + 1;
            family = t.family;
            break;
          }
          case 'commission': {
            const f = cmd.family;
            if (!f || !TOWERS.some((x) => x.family === f) || !this.commissionable(f)) return { ok: false, err: 'your organs do not unlock that limb' };
            this.hand.push({ id: this.nextId++, family: f, free: true });
            family = f;
            break;
          }
          case 'retinue':
            this.hand.push(this.drawCard());
            break;
          case 'heart':
            this.coreMaxHp += ROYAL.heartHp;
            this.coreHp = Math.min(this.coreMaxHp, this.coreHp + ROYAL.heartHp);
            break;
          default:
            break; // favour and larder act at the wave's turn
        }
        this.meat.royal -= price;
        this.decrees[cmd.decree] = (this.decrees[cmd.decree] ?? 0) + 1;
        this.stats.decrees = { ...this.decrees };
        this.events.push({ kind: 'royal-decree', decree: cmd.decree, name: def.name, family });
        return { ok: true };
      }
      case 'burrow': {
        if (this.phase === 'siege') return { ok: false, err: 'the body digs between waves' };
        const site = this.burrowSiteAt(cmd.cell);
        if (!site) return { ok: false, err: 'no wall of yours faces the city here' };
        if (site.blocked) return { ok: false, err: 'something of yours stands in the way' };
        if (this.meat.war < B.burrowCost) return { ok: false, err: 'cannot afford' };
        this.meat.war -= B.burrowCost;
        this.digBurrow(site);
        return { ok: true };
      }
      case 'royal-surge': {
        if (this.meat.royal < B.royalSurgeCost) return { ok: false, err: 'cannot afford' };
        this.meat.royal -= B.royalSurgeCost;
        this.biomass += B.royalSurgeBiomass;
        return { ok: true };
      }
      case 'choose-plate': {
        if (this.phase !== 'draft' || !this.pendingDraft) return { ok: false, err: 'no draft open' };
        const offer = this.pendingDraft[cmd.index];
        if (!offer) return { ok: false, err: 'no such offer' };
        stampPlate(this.map, offer.pattern, offer.slot, offer.feature, this.rng);
        this.pendingDraft = null;
        this.creepSurgePx += B.draftCreepSurge;
        this.gates = frontierGates(this.map);
        this.refreshRouting();
        this.phase = 'growth';
        this.phaseElapsed = 0;
        this.pickIncomingGates();
        this.events.push({
          kind: 'plate-drafted',
          name: PLATE_FEATURES[offer.feature].name,
          feature: offer.feature,
        });
        return { ok: true };
      }
      case 'call-early': {
        if (this.phase !== 'growth') return { ok: false, err: 'no wave to call' };
        const bonus = Math.floor(Math.max(0, B.growthSeconds - this.phaseElapsed) * B.callEarlyRate);
        this.stats.earlyCalls += 1;
        this.startSiege();
        if (bonus > 0) this.meat.war += bonus; // after the wave starts, so it is not cleared
        return { ok: true };
      }
      case 'discard': {
        const card = this.hand[cmd.cardIndex];
        if (!card) return { ok: false, err: 'no such card' };
        if (this.meat.war < B.discardCost) return { ok: false, err: 'cannot afford' };
        this.meat.war -= B.discardCost;
        this.hand.splice(cmd.cardIndex, 1);
        this.hand.push(this.drawCard());
        this.events.push({ kind: 'discarded', family: card.family });
        return { ok: true };
      }
    }
  }

  // ---------- royal decrees (content/royal.ts) ----------

  /** What the next purchase of a decree costs, in royal points. */
  decreeCost(id: DecreeId): number {
    const def = DECREE_BY_ID[id];
    return def.cost + def.costStep * (this.decrees[id] ?? 0);
  }

  /** Limbs a Royal Commission may name: drawable ones your organs unlock (not seedlings or cages). */
  commissionable(family: TowerFamily): boolean {
    return towerSpec(family).weight > 0 && this.isUnlocked(family);
  }

  /** Crowns worn by OTHER limbs within reach of this one (the court's presence, turned). */
  crownsOver(t: Tower): number {
    let n = 0;
    for (const c of this.towers) {
      if (!c.crowns || c.id === t.id) continue;
      if (dist(c.pos, t.pos) <= ROYAL.crownRadius) n += c.crowns;
    }
    return n;
  }

  /** What one point of harm does to this limb: crowns shelter it, an open graft bleeds double. */
  harmMultOf(t: Tower): number {
    let m = 1;
    const crowns = this.crownsOver(t);
    if (crowns > 0) m *= Math.pow(ROYAL.crownHarm, crowns);
    if (t.graftUntil !== undefined && t.graftUntil > this.time) m *= B.graftHarm;
    return m;
  }

  /** A limb still grafting (surgery under fire) near this point: the climbers smell it first. */
  private woundNear(p: Vec, within: number): { kind: 't'; id: number } | null {
    if (this.wounds <= 0) return null;
    let best: Tower | null = null;
    let bd = within;
    for (const t of this.towers) {
      if (t.graftUntil === undefined || t.graftUntil <= this.time) continue;
      const d = dist(t.pos, p);
      if (d <= bd) { bd = d; best = t; }
    }
    return best ? { kind: 't', id: best.id } : null;
  }

  /** Consort's Favour, at a cleared wave: the wave's best killers are promoted (one pip of their own family each). */
  private promoteFavoured(): void {
    const n = this.decrees.favour ?? 0;
    if (n <= 0) return;
    const ranked = this.towers
      .map((t) => ({ t, k: t.kills - (t.waveKillsAt ?? 0) }))
      .filter((x) => x.k > 0)
      .sort((a, b) => b.k - a.k || a.t.id - b.t.id)
      .slice(0, n);
    for (const { t } of ranked) {
      const before = this.statsOf(t).maxHp;
      t.pips = [...t.pips, { family: t.family }];
      t.promotions = (t.promotions ?? 0) + 1;
      const after = this.statsOf(t).maxHp;
      t.maxHp = after;
      t.hp = Math.min(after, t.hp + Math.max(0, after - before));
      this.events.push({ kind: 'limb-promoted', family: t.family });
    }
  }

  // ---------- burrowing (the interior can seal itself: DESIGN "Plate connection ALGEBRA") ----------

  /**
   * A wall of yours that faces unclaimed city, near this cell: the two mouth cells of a claimed
   * district's closed edge, and the blocks to dig to reach its streets. `cell` may be the unclaimed
   * city in front of the wall (the smoke) or the wall itself. Null when no such wall is near.
   */
  burrowSiteAt(cell: number): BurrowSite | null {
    const W = this.cfg.gridW;
    if (cell < 0 || cell >= this.map.cells.length) return null;
    const P = PLATE;
    const cx = cell % W;
    const cy = Math.floor(cell / W);
    const here = slotOfCell(this.map, cell);
    const sx = here % this.map.slotsX;
    const sy = Math.floor(here / this.map.slotsX);
    const OPP = { n: 's', s: 'n', e: 'w', w: 'e' } as const;
    let best: { slot: number; edge: Edge; mouth: number[]; d: number } | null = null;
    const consider = (claimed: number, edge: Edge) => {
      const inst = this.map.slots[claimed];
      if (!inst || inst.pattern.ports[edge]) return;
      const nx = (claimed % this.map.slotsX) + (edge === 'e' ? 1 : edge === 'w' ? -1 : 0);
      const ny = Math.floor(claimed / this.map.slotsX) + (edge === 's' ? 1 : edge === 'n' ? -1 : 0);
      // Only unclaimed city inside the board: the board's own edge is not a city to dig into.
      if (nx < 0 || ny < 0 || nx >= this.map.slotsX || ny >= this.map.slotsY) return;
      if (this.map.slots[ny * this.map.slotsX + nx] !== null) return;
      const ox = (claimed % this.map.slotsX) * P;
      const oy = Math.floor(claimed / this.map.slotsX) * P;
      const mouth = edge === 'n' ? [oy * W + ox + 4, oy * W + ox + 5]
        : edge === 's' ? [(oy + P - 1) * W + ox + 4, (oy + P - 1) * W + ox + 5]
          : edge === 'w' ? [(oy + 4) * W + ox, (oy + 5) * W + ox]
            : [(oy + 4) * W + ox + P - 1, (oy + 5) * W + ox + P - 1];
      const mx = ((mouth[0] % W) + (mouth[1] % W)) / 2;
      const my = (Math.floor(mouth[0] / W) + Math.floor(mouth[1] / W)) / 2;
      const d = Math.max(Math.abs(mx - cx), Math.abs(my - cy));
      if (d > 3.5) return;
      if (!best || d < best.d) best = { slot: claimed, edge, mouth, d };
    };
    if (this.map.slots[here] === null) {
      // In the smoke: the claimed neighbours whose walls face this district.
      for (const e of ['n', 's', 'e', 'w'] as const) {
        const nx = sx + (e === 'e' ? 1 : e === 'w' ? -1 : 0);
        const ny = sy + (e === 's' ? 1 : e === 'n' ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= this.map.slotsX || ny >= this.map.slotsY) continue;
        consider(ny * this.map.slotsX + nx, OPP[e]);
      }
    } else {
      for (const e of ['n', 's', 'e', 'w'] as const) consider(here, e);
    }
    if (!best) return null;
    const site = best as { slot: number; edge: Edge; mouth: number[]; d: number };
    // Dig inward, both mouth columns side by side, until either reaches a street of the district.
    const step = site.edge === 'n' ? W : site.edge === 's' ? -W : site.edge === 'w' ? 1 : -1;
    const carve: number[] = [];
    let reached = false;
    for (let depth = 0; depth < P; depth++) {
      const row = site.mouth.map((m) => m + step * depth);
      if (row.some((c) => isPassable(this.map.cells[c]))) { reached = true; break; }
      carve.push(...row);
    }
    if (!reached) return null;
    const blocked = carve.some((c) => this.isOccupied(c) || c === this.map.coreCell);
    return { slot: site.slot, edge: site.edge, mouth: site.mouth, carve, blocked };
  }

  /** Dig a burrow: the wall becomes a street and the district gains an opening (a new frontier gate). */
  private digBurrow(site: BurrowSite): void {
    const W = this.cfg.gridW;
    const inst = this.map.slots[site.slot]!;
    const ox = (site.slot % this.map.slotsX) * PLATE;
    const oy = Math.floor(site.slot / this.map.slotsX) * PLATE;
    const rows = inst.pattern.rows.map((r) => r.split(''));
    for (const c of site.carve) {
      this.map.cells[c] = CellType.Road;
      this.map.heights[c] = 0;
      this.map.plinths[c] = 0;
      rows[Math.floor(c / W) - oy][(c % W) - ox] = '.';
    }
    // The plate's own record changes (a copy: patterns are shared by every plate drawn from the pool).
    inst.pattern = {
      ...inst.pattern,
      id: `${inst.pattern.id}-burrow-${site.edge}`,
      rows: rows.map((r) => r.join('')),
      ports: { ...inst.pattern.ports, [site.edge]: true },
    };
    this.gates = frontierGates(this.map);
    this.creepDist = allDistance(this.map, this.map.coreCell);
    this.refreshRouting();
    this.burrows += 1;
    this.stats.burrows = this.burrows;
    const gate = this.gates.find((g) => site.mouth.includes(g)) ?? site.mouth[0];
    this.events.push({ kind: 'burrowed', cell: site.mouth[0], gate });
  }

  /** True when the body can no longer draft any district (it has walled itself in against the city). */
  sealedIn(): boolean {
    return this.map.slots.some((x) => x === null) && legalDrafts(this.map).length === 0;
  }

  /** A sling's throw reach (reach pips stretch it, like every other range). */
  slingRangeOf(t: Tower): number {
    return B.slingRange * this.statsOf(t).reach;
  }

  /** What eating a limb of this family pays back toward the next build. */
  salvageOf(family: TowerFamily): Partial<Record<Caste, number>> {
    const cost = towerSpec(family).cost;
    const out: Partial<Record<Caste, number>> = {};
    for (const c of ['war', 'science', 'royal'] as Caste[]) {
      if (cost[c]) out[c] = Math.floor((cost[c] ?? 0) * B.salvageRate * this.geneMods.salvageMult);
    }
    return out;
  }

  /**
   * Eat a limb on the spot: its salvage is credited immediately and its whole
   * trait history (plus itself) is banked for the next build. Butchering twice
   * before building stacks the traits — a two-course meal.
   */
  private butcherTower(donor: Tower): void {
    // A MARROW TAP is milked, not eaten: no salvage, it never disappears, and each
    // sacrifice banks a copy of the tapped limb's bonuses. Do it as often as you like.
    if (donor.family === 'tap') {
      const target = this.conduitTarget(donor);
      const ts = towerStats(donor);
      const milk = target ? [...target.pips, { family: target.family }] : [];
      for (let k = 0; k < ts.tapCopies; k++) this.pendingPips = [...this.pendingPips, ...milk];
      if (target && ts.tapWar > 0) this.meat.war += ts.tapWar;
      this.events.push({ kind: 'butchered', family: donor.family, refund: target ? ts.tapWar : 0 });
      return;
    }
    const salv = this.salvageOf(donor.family);
    let refund = 0;
    for (const c of ['war', 'science', 'royal'] as Caste[]) {
      this.meat[c] += salv[c] ?? 0;
      refund += salv[c] ?? 0;
    }
    // A funnel or mosaic engine is HARVESTED: what it was channelling comes along, permanently.
    const harvest = towerSpec(donor.family).engine ? this.conduitPool(donor) : [];
    this.pendingPips = [...this.pendingPips, ...donor.pips, ...harvest, { family: donor.family }];
    this.removeTower(donor.id, false);
    this.events.push({ kind: 'butchered', family: donor.family, refund });
  }

  private removeTower(id: number, emit: boolean, why = ''): void {
    const i = this.towers.findIndex((t) => t.id === id);
    if (i < 0) return;
    const t = this.towers[i];
    // Reliquaries watching a limb that DIES (not eaten, not stolen) bank its bonuses —
    // and an evolved one (Resurrection / Phoenix) raises it again, once per wave.
    const keepers = emit ? this.enginesPointedAt(t, 'reliquary') : [];
    if (emit) this.bankRelics(t);
    for (const c of this.cellsOf(t)) this.occupied.delete(c);
    this.towers.splice(i, 1);
    // The brood (and a cage's puppets) do not outlive the limb that holds them.
    this.broodlings = this.broodlings.filter((b) => b.motherId !== id);
    // Its thrown patches die with it (a sling's outposts are its own flesh).
    this.removeCreepSourcesOf(id);
    this.refreshRouting();
    for (const e of this.enemies) {
      if (!e.targetIsOrgan && e.targetId === id) e.targetId = null;
    }
    if (emit) this.events.push({ kind: 'structure-lost', what: towerSpec(t.family).name + why });
    if (emit) this.stats.limbsLost += 1;
    const raiser = keepers
      .filter((k) => this.towers.includes(k) && towerStats(k).rebirth > 0 && k.rebornWave !== this.waveNumber)
      .sort((a, b) => towerStats(b).rebirth - towerStats(a).rebirth)[0];
    if (raiser && this.cellsOf(t).every((c) => !this.isOccupied(c))) {
      raiser.rebornWave = this.waveNumber;
      const full = towerStats(raiser).rebirth >= 2;
      const again = this.addTower(t.family, t.cell, full ? [...t.pips] : [], t.facing);
      if (full && t.upgrades) {
        again.upgrades = [...t.upgrades];
        again.maxHp = this.statsOf(again).maxHp;
        again.hp = again.maxHp;
      }
      this.events.push({ kind: 'reborn', family: t.family });
    }
    this.witherUnrooted();
  }

  /**
   * DEPENDENCY (Collins, Sep 27 2026): a limb standing on creep that no longer
   * exists withers — so when a sling (or a seeping, sling-pipped limb, or a
   * root) dies, everything that stood only on the creep it made dies with it.
   * Limbs carrying a sling pip make their own ground and never wither.
   */
  witherUnrooted(): void {
    for (const t of [...this.towers]) {
      if (!this.towers.includes(t)) continue;
      if (towerStats(t).offCreep || this.rooted(t)) continue;
      this.removeTower(t.id, true, ' (withered — its creep died)');
    }
  }

  /** Death insurance: each reliquary on a dying limb (or reliquary pip in it) banks a copy of its bonuses. */
  private bankRelics(t: Tower): void {
    const n = [...t.pips, ...upgradePips(t)].filter((p) => p.family === 'reliquary').length
      + this.enginesPointedAt(t, 'reliquary').reduce((a, r) => a + towerStats(r).relicCopies, 0);
    if (n <= 0) return;
    const relic = [...t.pips, { family: t.family }];
    for (let k = 0; k < n; k++) this.pendingPips = [...this.pendingPips, ...relic];
    this.events.push({ kind: 'relic-banked', family: t.family, pips: relic.length * n });
  }

  /**
   * MITOSIS, once per cleared wave: each node buds a level-one, no-upgrade copy
   * of the limb it holds into a free space next to the NODE (stops when full).
   * A mitosis pip on a limb buds a plain copy of the limb itself next to it.
   */
  private budMitosis(): void {
    const w = this.cfg.gridW;
    // Rings outward (ring 1 = the 8 neighbours; a Wide Womb reaches ring 2).
    const around = (cell: number, ring: number) => {
      const out: number[] = [];
      for (let r = 1; r <= ring; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = (cell % w) + dx;
            const c = cell + dy * w + dx;
            if (x < 0 || x >= w || c < 0 || c >= this.map.cells.length) continue;
            out.push(c);
          }
        }
      }
      return out;
    };
    const jobs: Array<{ family: TowerFamily; near: number[]; ring: number; pips: ModPip[] }> = [];
    for (const m of this.towers) {
      if (this.isTapped(m)) continue;
      if (m.family === 'mitosis') {
        const target = this.conduitTarget(m);
        const ms = towerStats(m);
        // Next to the node first, then next to the parent (city blocks are tight).
        if (target) {
          const pips: ModPip[] = ms.budPips >= 999 ? [...target.pips]
            : Array.from({ length: ms.budPips }, () => ({ family: target.family }));
          for (let k = 0; k < ms.budCount; k++) {
            jobs.push({ family: target.family, near: [m.cell, target.cell], ring: ms.budRing, pips: [...pips] });
          }
        }
      }
      const selfBuds = [...m.pips, ...upgradePips(m)].filter((p) => p.family === 'mitosis').length;
      for (let k = 0; k < selfBuds; k++) jobs.push({ family: m.family, near: [m.cell], ring: 1, pips: [] });
    }
    for (const job of jobs) {
      const spot = job.near.flatMap((c) => around(c, job.ring)).find((c) => this.canPlaceFree(c, job.family));
      if (spot === undefined) continue; // full: harvest the copies to make room
      this.addTower(job.family, this.freeGroundFor(spot, job.family)![0], job.pips);
      this.events.push({ kind: 'budded', family: job.family });
    }
  }

  /** Legal ground for a limb of this family, ignoring what is in hand (buds, copies). */
  private canPlaceFree(cell: number, family: TowerFamily): boolean {
    return this.freeGroundFor(cell, family) !== null;
  }

  /** The cells a bud or a copy of this family would stand on at this cell, or null. */
  private freeGroundFor(cell: number, family: TowerFamily): number[] | null {
    if (!isMultiCell(towerSpec(family))) return this.canPlaceFreeOn(cell, family) ? [cell] : null;
    return this.footprintAt(cell, family, undefined, (c) => this.canPlaceFreeOn(c, family));
  }

  private canPlaceFreeOn(cell: number, family: TowerFamily): boolean {
    if (this.isOccupied(cell) || cell === this.map.coreCell || !this.isCreeped(cell)) return false;
    const t = this.map.cells[cell];
    if (family === 'spine') return t === CellType.Road || t === CellType.Block;
    if (family === 'swamp') return t === CellType.Road;
    return t === CellType.Block;
  }

  /** Put a limb on the board (shared by builds, buds and recoveries). */
  private addTower(family: TowerFamily, cell: number, pips: ModPip[], facing?: RootDir, ground?: number[]): Tower {
    const spec = towerSpec(family);
    // A big or shaped limb: `cell` is the first of its cells (row-major), and it stands on its hub
    // (a rectangle: the middle of them all; src/sim/footprint.ts).
    const [sw, sh] = this.spanOf(family, facing);
    const lies = spec.shape ? (facing ?? 'S') : facing;
    const cells = ground && ground.length > 0 ? [...ground] : (this.cellsFromFirst(cell, family, lies) ?? [cell]);
    const pos = this.hubPos(family, lies, cells);
    const tower: Tower = {
      id: this.nextId++, family, pos, cell, hp: spec.maxHp, maxHp: spec.maxHp, pips, cooldown: 0, kills: 0,
    };
    if (cells.length > 1) tower.cells = cells;
    this.creditFamilyOf.set(tower.id, family);
    tower.maxHp = this.statsOf(tower).maxHp;
    tower.hp = tower.maxHp;
    if (spec.directional) tower.facing = facing ?? this.facingTowardGate(pos);
    // A limb that is longer than it is wide (or shaped) lies the way it was turned, whatever it aims at.
    else if (sw !== sh || spec.shape) tower.facing = facing ?? 'S';
    // Any other limb turned by the player before it was placed keeps that way (it is what is
    // drawn: a lopsided limb faces where it was turned; the sim reads nothing from it).
    else if (facing) tower.facing = facing;
    this.towers.push(tower);
    if (family === 'lance') this.addCreepSource('line', cell, 0, tower.facing, tower.id);
    // A seedling is shot up from the landing site to where it was placed.
    if (family === 'sprout') this.seedFlights.push({ id: this.nextId++, towerId: tower.id, from: { ...this.core }, to: { ...pos }, ttl: SEEDLING_FLIGHT });
    for (const c of cells) this.occupied.set(c, { kind: 't', id: tower.id });
    this.refreshRouting();
    return tower;
  }

  /** How many limbs would wither if this one died (for the cannibalize hover warning). */
  dependentsOf(id: number): number {
    const t = this.towers.find((x) => x.id === id);
    if (!t) return 0;
    const saved = this.creepSources;
    const savedTowers = this.towers;
    this.creepSources = saved.filter((s) => s.ownerId !== id);
    this.towers = savedTowers.filter((x) => x.id !== id);
    let n = 0;
    for (const x of this.towers) {
      if (!towerStats(x).offCreep && !this.rooted(x)) n++;
    }
    this.creepSources = saved;
    this.towers = savedTowers;
    return n;
  }


  // ---------- spawning ----------

  gateSide(gate: number): 'N' | 'S' | 'E' | 'W' {
    const c = this.cellCenter(gate);
    const dx = c.x - this.core.x;
    const dy = c.y - this.core.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
    return dy > 0 ? 'S' : 'N';
  }

  /** The hive masses its response on specific approaches; the player sees it coming. */
  private pickIncomingGates(): void {
    // A defence's one siege comes down more streets at once (src/meta/defence.ts).
    const lanes = this.cfg.oneWave?.lanes ?? (this.tier >= 4 ? 3 : this.tier >= 2 ? 2 : 1);
    const picked: number[] = [];
    const sides = new Set<string>();
    let guard = 0;
    while (picked.length < Math.min(lanes, this.gates.length) && guard++ < 60) {
      const g = this.gates[this.rng.int(0, this.gates.length - 1)];
      const side = this.gateSide(g);
      if (picked.includes(g)) continue;
      if (sides.has(side) && guard < 30) continue; // spread lanes across sides first
      picked.push(g);
      sides.add(side);
    }
    this.incomingGates = picked;
  }

  private spawnEnemy(kind: EnemyKind, atGate?: number): Enemy {
    const e = this.spawnEnemyRaw(kind, atGate);
    // The Sleepers: every Nth war body is a martyr who blows up among its own.
    if (this.cfg.sleepers && enemySpec(kind).caste === 'war') {
      this.sleeperCount += this.cfg.sleepers;
      if (this.sleeperCount >= 1) { this.sleeperCount -= 1; e.sleeperAt = this.time + B.sleeperFuse; }
    }
    return e;
  }

  private spawnEnemyRaw(kind: EnemyKind, atGate?: number): Enemy {
    const spec = enemySpec(kind);
    const gate = atGate ?? this.gates[this.rng.int(0, this.gates.length - 1)];
    const c = this.cellCenter(gate);
    const e: Enemy = {
      id: this.nextId++, kind,
      pos: { x: c.x + this.rng.float(-6, 6), y: c.y + this.rng.float(-6, 6) },
      hp: spec.hp, maxHp: spec.hp, targetId: null, targetIsOrgan: false,
      attackCooldown: 0, studyLeft: kind === 'researcher' ? B.studySeconds : 0,
      leaving: false,
    };
    if (spec.tunneler) {
      // Dives underground at the gate; resurfaces PAST the outer gun line.
      e.burrowed = true;
      const d = this.flow.dist[gate];
      e.surfaceFlowDist = Number.isFinite(d) ? d * B.tunnelerSurfaceFrac : 12;
    }
    if (spec.hitShield) e.hitShield = spec.hitShield;
    this.enemies.push(e);
    return e;
  }

  /** Spawn a minion at an exact spot (a consort's retinue growing mid-march). */
  private spawnMinion(kind: EnemyKind, at: Vec): Enemy {
    const spec = enemySpec(kind);
    const e: Enemy = {
      id: this.nextId++, kind,
      pos: { x: at.x + this.rng.float(-8, 8), y: at.y + this.rng.float(-8, 8) },
      hp: spec.hp, maxHp: spec.hp, targetId: null, targetIsOrgan: false,
      attackCooldown: 0, studyLeft: 0, leaving: false,
    };
    if (spec.hitShield) e.hitShield = spec.hitShield;
    this.enemies.push(e);
    return e;
  }

  /** The campaign hides the next wave's makeup and entrance unless the Translator is with you. */
  get waveIntelHidden(): boolean {
    return this.cfg.waveIntel === 'hidden';
  }

  /** What the next wave will bring (the same law startSiege uses), for the Translator / skirmish HUD. */
  previewNextWave(): Partial<Record<EnemyKind, number>> {
    const comp = WAVE_TABLE[this.tier];
    const scale = 1 + this.waveDepth * B.waveCountScale;
    const out: Partial<Record<EnemyKind, number>> = {};
    for (const [kind, n] of Object.entries(comp)) {
      if ((this.cfg.bannedEnemies ?? []).includes(kind as EnemyKind)) continue;
      const spec = enemySpec(kind as EnemyKind);
      const growth = 1 + (scale - 1) * (B.riskBaseline / spec.risk);
      const scaled = Math.round((n ?? 0) * growth * (this.cfg.waveScale ?? 1));
      if (scaled > 0) out[kind as EnemyKind] = scaled;
    }
    const born = Math.floor(this.mateBacklog);
    if (born > 0) out.militia = (out.militia ?? 0) + born;
    return out;
  }

  private startSiege(): void {
    this.phase = 'siege';
    this.phaseElapsed = 0;
    this.waveNumber += 1;
    // The organ stage's economy: what you did not spend between waves is lost
    // when the next wave starts. The starting meat carries into wave 1; royal
    // points are kept.
    this.growCreepNodes('waveStart');
    if (this.cfg.organStage && this.waveNumber > 1) {
      // A ROYAL LARDER keeps half of what would be lost (each copy half of the rest).
      const keep = 1 - Math.pow(1 - ROYAL.larderKeep, this.decrees.larder ?? 0);
      const war = Math.floor(this.meat.war * (1 - keep));
      const science = Math.floor(this.meat.science * (1 - keep));
      if (war > 0 || science > 0) this.events.push({ kind: 'meat-cleared', war, science });
      this.meat.war = keep > 0 ? this.meat.war - war : 0;
      this.meat.science = keep > 0 ? this.meat.science - science : 0;
    }
    // Consort's Favour reads each limb's kills in this wave.
    for (const t of this.towers) t.waveKillsAt = t.kills;
    const comp = WAVE_TABLE[this.tier];
    const scale = 1 + this.waveDepth * B.waveCountScale;
    this.spawnQueue = [];
    const counts: Partial<Record<EnemyKind, number>> = {};
    let waveRisk = 0;
    for (const [kind, n] of Object.entries(comp)) {
      // THE RISK LAW: the clock multiplies cheap ranks at full rate, risky
      // specialists slowly (riskBaseline/risk of it). Escalation stays "more
      // bodies + higher types" without ever becoming eight sappers eating the
      // player's board — the rejected investment-destruction in uniform.
      const spec = enemySpec(kind as EnemyKind);
      const growth = 1 + (scale - 1) * (B.riskBaseline / spec.risk);
      const banned = (this.cfg.bannedEnemies ?? []).includes(kind as EnemyKind);
      const scaled = banned ? 0 : Math.round((n ?? 0) * growth * (this.cfg.waveScale ?? 1));
      counts[kind as EnemyKind] = scaled;
      waveRisk += scaled * spec.risk;
      for (let i = 0; i < scaled; i++) this.spawnQueue.push(kind as EnemyKind);
    }
    // Mating musk: every pair that paired off last wave is one more body now.
    const born = Math.floor(this.mateBacklog);
    this.mateBacklog -= born;
    for (let i = 0; i < born; i++) this.spawnQueue.push('militia');
    this.waveRisk = waveRisk;
    this.waveLimbDamage = 0;
    this.waveKillsByCause = {};
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0;
    const sides = [...new Set(this.incomingGates.map((g) => this.gateSide(g)))].join('+');
    this.events.push({ kind: 'wave-start', tier: this.tier, wave: this.waveNumber, counts, sides, risk: waveRisk });
  }

  // ---------- tick ----------

  tick(): void {
    if (this.outcome !== 'playing') return;
    if (this.phase === 'draft') return; // the world holds its breath while you choose
    this.tickCount += 1;
    this.time += DT;
    this.phaseElapsed += DT;

    this.biomass += B.biomassBase * DT;
    if (this.tickCount % 10 === 0) this.sampleStats();


    // Phase machine.
    if (this.phase === 'growth') {
      if (this.phaseElapsed >= this.growthLength) this.startSiege();
    } else {
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= DT;
        if (this.spawnTimer <= 0) {
          // Squads: a column of several at once per lane, then a beat of quiet.
          this.spawnTimer = B.squadInterval;
          const lane = this.incomingGates[this.rng.int(0, this.incomingGates.length - 1)];
          for (let k = 0; k < B.squadSize && this.spawnQueue.length > 0; k++) {
            this.spawnEnemy(this.spawnQueue.pop()!, lane);
          }
        }
      }
      // The wave is the war (and royal) caste; science visitors come and go on their own clock.
      const hostiles = this.enemies.some((e) => enemySpec(e.kind).caste !== 'science');
      // A defence's one siege is over when it is beaten, not when a normal turn's clock runs out
      // (a big city's long streets would otherwise let it end with the column still marching).
      const siegeMax = this.cfg.oneWave ? B.siegeMaxSeconds * 5 : B.siegeMaxSeconds;
      if ((this.spawnQueue.length === 0 && !hostiles) || this.phaseElapsed > siegeMax) {
        this.phaseElapsed = 0;
        this.wavesCleared += 1;
        if (this.waveLimbDamage === 0) this.stats.pacifistWaves += 1;
        this.stats.lastWaveKillsByCause = { ...this.waveKillsByCause };
        const bonus = Math.round((B.waveBonusBase + this.waveNumber * B.waveBonusPerWave) * this.entranceMeatMult);
        this.meat.war += bonus;
        this.events.push({ kind: 'wave-cleared', wave: this.waveNumber, bonus });
        for (const n of this.creepSources) if (n.kind === 'node') n.hp = n.maxHp ?? NODE_HP;
        // A new turn: every spore bladder grows its nodes, every scaffold gland counts toward its plinth.
        this.growCreepNodes('turn');
        this.growPlinths();
        this.growSeedlings();
        // Brood pips: living tissue regrows between waves — 50% max hp per pip.
        for (const t of this.towers) {
          const heal = this.statsOf(t).waveHeal;
          if (heal <= 0) continue;
          const raw = t.hp + t.maxHp * heal;
          // Past full, living tissue GROWS: part of the excess becomes max hp for life.
          if (raw > t.maxHp) {
            t.grownHp = (t.grownHp ?? 0) + (raw - t.maxHp) * B.overgrowFrac;
            t.maxHp = this.statsOf(t).maxHp;
          }
          this.stats.healed += Math.min(t.maxHp, raw) - t.hp;
          t.hp = Math.min(t.maxHp, raw);
        }
        // Consort's Favour: the wave's best killers are promoted.
        this.promoteFavoured();
        // Mitosis: nodes bud their copies.
        this.budMitosis();
        this.checkDirective();
        if (this.outcome !== 'playing') return;
        // Every few cleared waves: the body is ready to grow into a new district.
        if (this.wavesCleared % B.draftEveryWaves === 0) {
          const offers = draftOffers(this.map, this.rng, 3);
          if (offers.length > 0) {
            this.phase = 'draft';
            this.pendingDraft = offers;
            this.events.push({ kind: 'draft-open' });
            return;
          }
          // Walled in: no district can be drafted. Say so (a burrow opens the way again).
          if (this.map.slots.some((x) => x === null)) this.events.push({ kind: 'sealed-in' });
        }
        this.phase = 'growth';
        this.pickIncomingGates();
      }
    }

    // Researchers, drawn by interest — only while the streets are quiet,
    // so sieges stay discrete, legible events.
    if (this.phase === 'growth') this.researcherTimer -= DT;
    if (this.researcherTimer <= 0) {
      const interval = Math.max(
        B.researcherMinInterval,
        B.researcherBaseInterval / (1 + this.interest / 10),
      );
      this.researcherTimer = interval;
      if (this.interest > 0) {
        const n = this.rng.int(2, 4);
        for (let i = 0; i < n; i++) this.spawnEnemy('researcher');
        // A famous specimen attracts the unscrupulous too: past a fame
        // threshold, a thief slips in with every study party.
        if (this.interest >= B.thiefInterestMin) this.spawnEnemy('thief');
        // ...and the unseen: a cloaked infiltrator only detection can target.
        if (this.interest >= B.infiltratorInterestMin && this.towers.length > 0) this.spawnEnemy('infiltrator');
        // A famous specimen gets a sedation battery sent along to pin it down.
        if (this.interest >= B.dartgunInterestMin && this.towers.length > 0
          && !this.enemies.some((x) => x.kind === 'dartgun')) this.spawnEnemy('dartgun');
        this.events.push({ kind: 'researchers-arrive', count: n });
      }
    }

    // Royal event.
    const royalDue = this.threat >= B.royalThreat
      || (this.directive.kind === 'royal' && this.waveNumber >= B.royalGuaranteeWave);
    if (this.phase === 'siege' && !this.royalSpawned && royalDue) {
      this.royalSpawned = true;
      const lane = this.incomingGates[0] ?? this.gates[0];
      this.spawnEnemy('royal', lane);
      this.spawnEnemy('consort', lane); // promotes the ranks around it
      this.spawnEnemy('matron', lane);  // veils the ranks around her
      for (let i = 0; i < B.royalEscort; i++) this.spawnEnemy('elite', lane);
      this.events.push({ kind: 'royal-incoming' });
    }

    this.updateCoreAttack();
    this.updateEnemies();
    this.updateBroodlings();
    this.updateTowers();
    this.updateProjectiles();
    this.updateCorpses();
    this.updateClots();
    this.updateBiles();
    this.updateShells();
    this.updateClouds();
    this.digestOnCreep();
    this.caltrops = this.caltrops.filter((c) => c.hp > 0 && (c.ttl -= DT) > 0);
    for (const a of this.arcs) a.ttl -= DT;
    this.arcs = this.arcs.filter((a) => a.ttl > 0);

    if (this.coreHp <= 0) {
      this.outcome = 'lost';
      this.events.push({ kind: 'lost' });
    }
  }

  /** The body defends itself: focused damage to the nearest intruder inside reach. */
  private updateCoreAttack(): void {
    let target: Enemy | null = null;
    let bestD = this.bodyRadius * B.coreReachScale;
    for (const e of this.enemies) {
      // Science-caste visitors are not combatants; the body saves its venom.
      if (enemySpec(e.kind).caste === 'science' || e.burrowed) continue;
      const d = dist(e.pos, this.core);
      if (d <= bestD) { bestD = d; target = e; }
    }
    if (target) this.damageEnemy(target, B.coreDps * DT, 1);
  }

  // ---------- movement ----------

  private structureOn(cell: number): { kind: 't' | 'o'; id: number } | undefined {
    return this.occupied.get(cell);
  }

  /** Center of a passable cell adjacent to this one (where a broodling can stand). */
  private passableNear(cell: number): Vec | null {
    const w = this.cfg.gridW;
    for (const nb of [cell + w, cell - w, cell - 1, cell + 1]) {
      if (nb < 0 || nb >= this.map.cells.length) continue;
      if (isPassable(this.map.cells[nb])) return this.cellCenter(nb);
    }
    return null;
  }

  /** Nearest limb or organ within a radius (sappers hunt these across blocks). */
  private nearestStructure(p: Vec, within: number): { kind: 't' | 'o'; id: number } | null {
    let best: { kind: 't' | 'o'; id: number } | null = null;
    let bestD = within;
    for (const t of this.towers) {
      const d = dist(p, t.pos);
      if (d < bestD) { bestD = d; best = { kind: 't', id: t.id }; }
    }
    return best;
  }

  private structurePos(s: { kind: 't' | 'o'; id: number }): Vec | null {
    const obj = s.kind === 't' ? this.towers.find((t) => t.id === s.id) : undefined;
    return obj ? obj.pos : null;
  }

  /** Straight-line movement for climbers and fliers: terrain does not apply. */
  private stepUnconstrained(e: Enemy, target: Vec, speed: number): void {
    const d = dist(e.pos, target);
    if (d < 0.5) return;
    e.pos.x += ((target.x - e.pos.x) / d) * speed * DT;
    e.pos.y += ((target.y - e.pos.y) / d) * speed * DT;
  }

  /** Fliers keep loose formation on their own (no ground separation for them). */
  private aheadCheckSeparationless(_e: Enemy): void { /* intentionally nothing */ }

  /** Move a body toward a point, clamped so it never enters a building cell. */
  private stepConstrained(e: { pos: Vec }, target: Vec, speed: number): void {
    const d = dist(e.pos, target);
    if (d < 0.5) return;
    const nx = e.pos.x + ((target.x - e.pos.x) / d) * speed * DT;
    const ny = e.pos.y + ((target.y - e.pos.y) / d) * speed * DT;
    const inBounds = (x: number, y: number) =>
      x >= 2 && y >= 2 && x <= this.worldW - 2 && y <= this.worldH - 2;
    const passAt = (x: number, y: number) =>
      inBounds(x, y) && isPassable(this.map.cells[this.cellAt(x, y)]);
    if (passAt(nx, ny)) {
      e.pos.x = nx; e.pos.y = ny;
    } else if (passAt(nx, e.pos.y)) {
      e.pos.x = nx; // slide along the wall
    } else if (passAt(e.pos.x, ny)) {
      e.pos.y = ny;
    }
    // else: fully cornered; stand (the flow field will route them next tick)
  }

  /** Enemies shoulder each other apart so columns read as columns, not a stack. */
  private applySeparation(): void {
    const n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const a = this.enemies[i];
      if (this.isAirborne(a) || a.burrowed || a.deployed) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.enemies[j];
        if (this.isAirborne(b) || b.burrowed || b.deployed) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < SEPARATION_DIST) {
          const push = ((SEPARATION_DIST - d) / d) * 0.5;
          const tryShift = (e: Enemy, sx: number, sy: number) => {
            const x = e.pos.x + sx;
            const y = e.pos.y + sy;
            if (x >= 2 && y >= 2 && x <= this.worldW - 2 && y <= this.worldH - 2
              && isPassable(this.map.cells[this.cellAt(x, y)])) {
              e.pos.x = x; e.pos.y = y;
            }
          };
          tryShift(a, -dx * push, -dy * push);
          tryShift(b, dx * push, dy * push);
        }
      }
    }
  }

  /** In the air right now? (A netted flier walks the streets until it shakes free.) */
  isAirborne(e: Enemy): boolean {
    return !!enemySpec(e.kind).flies && !(e.groundedUntil !== undefined && e.groundedUntil > this.time);
  }

  /**
   * Can this limb TARGET that body? Layer (air/ground) must match, and a
   * cloaked body needs detection: the limb's own true sight, an ocular's
   * detection aura over the body, or a mark (pheromone, mist) still on it.
   */
  canTarget(t: Tower, s: TowerStats, e: Enemy): boolean {
    if (e.burrowed) return false;
    if (this.isAirborne(e) ? !s.hitsAir : !s.hitsGround) return false;
    if (!this.isCloaked(e)) return true;
    return s.trueSight || this.isRevealed(e);
  }

  /** Cloaked right now: by nature, or veiled by a living matron's aura (war caste only). */
  isCloaked(e: Enemy): boolean {
    const spec = enemySpec(e.kind);
    if (spec.cloaked) return true;
    if (spec.caste !== 'war') return false;
    for (const m of this.enemies) {
      const r = enemySpec(m.kind).veilAura;
      if (r !== undefined && m !== e && dist(m.pos, e.pos) <= r) return true;
    }
    return false;
  }

  /** Is a cloaked body visible to EVERY limb right now (marked, burning, or under a detection aura)? */
  isRevealed(e: Enemy): boolean {
    if (!this.isCloaked(e)) return true;
    if (e.revealedUntil !== undefined && e.revealedUntil > this.time) return true;
    for (const d of this.towers) {
      const r = towerSpec(d.family).detects;
      if (r !== undefined && dist(d.pos, e.pos) <= r * towerStats(d).reach) return true;
    }
    return false;
  }

  /**
   * THE PAYLOAD HIT: every limb's contact with the hive comes through here, so
   * every inherited verb applies everywhere — shots, beams, swamp contact,
   * thorns, broodling bites, shells, clot impacts.
   */
  payloadHit(fx: HitFx, e: Enemy, damage = fx.damage, dirX = 0, dirY = 0): void {
    if (!this.enemies.includes(e)) return;
    this.applyHitEffects(e, fx, fx.srcId);
    if (fx.shred > 0 || fx.cloud > 0) e.revealedUntil = this.time + B.revealSeconds; // mist and musk cling
    if (fx.grounding > 0 && enemySpec(e.kind).flies) {
      e.groundedUntil = Math.max(e.groundedUntil ?? 0, this.time + fx.grounding * this.geneMods.groundingMult);
      this.dropToStreet(e);
    }
    let dmg = damage;
    if (fx.supportDmg > 0) {
      const ts = enemySpec(e.kind);
      if (ts.speedAura || ts.healer || ts.bomber) dmg *= 1 + fx.supportDmg;
    }
    const at = { ...e.pos };
    this.damageEnemy(e, dmg, fx.yieldMult, fx.capBonus, fx.srcId, fx.quiet);
    const alive = this.enemies.includes(e);
    // Swamp pips: whatever is left this weak is DIGESTED outright.
    if (alive && fx.execute > 0 && e.hp <= fx.execute) {
      this.biomass += B.swampBiomassPerKill;
      this.killEnemy(e.id, fx.yieldMult, false, fx.srcId);
    }
    const died = !this.enemies.includes(e);
    if (fx.cloud > 0) this.spawnCloud(at, B.cloudRadius, fx.cloud, fx.srcId);
    if (died && fx.caltrop > 0) this.dropCaltrop(at, fx.caltrop);
    if (!died && fx.chains > 0) this.chainArcs(e, fx.chains, dmg, fx.yieldMult, fx.capBonus);
    if (!died && fx.knock > 0 && (dirX !== 0 || dirY !== 0)) this.knockBack(e, dirX, dirY, fx.knock);
  }

  /** A netted flier falls onto the nearest street and walks until it shakes free. */
  private dropToStreet(e: Enemy): void {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    if (isPassable(this.map.cells[cell])) return;
    let best = -1;
    let bd = Infinity;
    const w = this.cfg.gridW;
    const cx = cell % w;
    const cy = Math.floor(cell / w);
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= this.cfg.gridH) continue;
        const c = y * w + x;
        if (!isPassable(this.map.cells[c])) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = c; }
      }
    }
    if (best >= 0) {
      const p = this.cellCenter(best);
      e.pos.x = p.x; e.pos.y = p.y;
    } else {
      e.groundedUntil = this.time; // nowhere to fall: stays aloft
    }
  }

  spawnCloud(at: Vec, radius: number, dps: number, srcId?: number): void {
    this.clouds.push({ id: this.nextId++, pos: { ...at }, radius, ttl: B.cloudTtl, dps, ...(srcId !== undefined ? { srcId } : {}) });
  }

  /** Caltrops only take root on walkable ground (a street or plaza). */
  private dropCaltrop(at: Vec, hp: number): void {
    const cell = this.cellAt(at.x, at.y);
    if (!isPassable(this.map.cells[cell])) return;
    this.caltrops.push({ id: this.nextId++, pos: { ...at }, cell, hp, thorns: B.caltropThorns, ttl: B.caltropTtl });
  }

  /** Clouds burn what stands in them and MARK cloaked bodies (visible to every limb). */
  private updateClouds(): void {
    for (const c of this.clouds) {
      c.ttl -= DT;
      for (const e of [...this.enemies]) {
        if (e.burrowed || dist(c.pos, e.pos) > c.radius) continue;
        e.revealedUntil = this.time + B.revealSeconds;
        if (this.cfg.matingMusk) {
          // Mating musk: the war caste stops fighting and pairs off (once each);
          // every pair is another body in the next wave.
          if (!e.mated && enemySpec(e.kind).caste === 'war') {
            e.mated = true;
            e.slowMult = 0.02;
            e.slowUntil = this.time + B.mateStun;
            this.mateBacklog += 0.5;
            this.stats.matingStuns += 1;
          }
          continue;
        }
        // Wedding Musk (a hobby gene): the same pause, once each, without the extra bodies; the gas still burns.
        if (this.geneMods.weddingMusk && !e.mated && enemySpec(e.kind).caste === 'war') {
          e.mated = true;
          e.slowMult = 0.02;
          e.slowUntil = this.time + B.mateStun * 0.5;
          this.stats.matingStuns += 1;
        }
        e.hp -= c.dps * DT; // a gas, not a hit: armor and shells don't stop it
        if (e.hp <= 0) this.killEnemy(e.id, 1, false, undefined, 'cloud', c.srcId);
      }
    }
    this.clouds = this.clouds.filter((c) => c.ttl > 0);
  }

  /** Effective speed: base, times an active snare slow, times a war-drummer's beat. */
  moveSpeedOf(e: Enemy): number {
    const spec = enemySpec(e.kind);
    let s = spec.speed;
    if (e.slowUntil !== undefined && e.slowUntil > this.time && e.slowMult !== undefined) {
      s *= e.slowMult;
    }
    // Mire creep is sticky underfoot (fliers pass over it).
    if (!this.isAirborne(e)) s *= this.creepEffectAt(this.cellAt(e.pos.x, e.pos.y)).slow;
    if (e.kind !== 'researcher') {
      for (const d of this.enemies) {
        if (d === e || d.burrowed || !enemySpec(d.kind).speedAura) continue;
        if (dist(d.pos, e.pos) <= B.drummerRadius) { s *= B.drummerSpeedMult; break; }
      }
    }
    return s;
  }

  /**
   * Statuses landing on a hit. Stacking rules (the combination algebra):
   * slows keep the STRONGEST and the longest clock; poison ADDS and refreshes,
   * capped; shred keeps the DEEPEST cut and refreshes; a root is just a very
   * strong slow, so it composes through the same rule.
   */
  private applyHitEffects(
    e: Enemy,
    fx: {
      slowMult: number; slowDur: number; poisonDps: number; poisonDur: number;
      shred?: number; shredDur?: number; rootDur?: number; burnDps?: number; burnDur?: number;
    },
    srcId?: number,
  ): void {
    // Burn: the hottest fire wins and the clock refreshes (poison, by contrast, adds).
    if (fx.burnDps && fx.burnDps > 0 && fx.burnDur && fx.burnDur > 0) this.ignite(e, fx.burnDps, fx.burnDur, srcId);
    let slowMult = fx.slowMult;
    let slowDur = fx.slowDur;
    if (fx.rootDur && fx.rootDur > 0) {
      // Hard root: ~zero speed beats any soft slow via the strongest-wins rule.
      slowMult = Math.min(slowMult, 0.05);
      slowDur = Math.max(slowDur, fx.rootDur);
    }
    if (slowMult < 1 && slowDur > 0) {
      const active = e.slowUntil !== undefined && e.slowUntil > this.time;
      e.slowMult = active && e.slowMult !== undefined ? Math.min(e.slowMult, slowMult) : slowMult;
      e.slowUntil = Math.max(active ? e.slowUntil ?? 0 : 0, this.time + slowDur);
    }
    if (fx.poisonDps > 0 && fx.poisonDur > 0) {
      const active = e.poisonUntil !== undefined && e.poisonUntil > this.time;
      e.poisonDps = (active ? e.poisonDps ?? 0 : 0) + fx.poisonDps;
      e.poisonUntil = this.time + fx.poisonDur;
      if (srcId !== undefined) e.poisonSrc = srcId; // who is credited if the poison kills it (stats only)
    }
    if (fx.shred && fx.shred > 0 && fx.shredDur && fx.shredDur > 0) {
      const active = e.shredUntil !== undefined && e.shredUntil > this.time;
      e.shredAmount = Math.max(active ? e.shredAmount ?? 0 : 0, fx.shred);
      e.shredUntil = this.time + fx.shredDur;
    }
  }

  /** Set a body burning (hottest fire wins; the clock refreshes). Fire lights up the cloaked. */
  ignite(e: Enemy, dps: number, dur: number, srcId?: number): void {
    const active = e.burnUntil !== undefined && e.burnUntil > this.time;
    if (srcId !== undefined) e.burnSrc = srcId; // who is credited if the fire kills it (stats only)
    e.burnDps = active ? Math.max(e.burnDps ?? 0, dps) : dps;
    e.burnUntil = Math.max(active ? e.burnUntil ?? 0 : 0, this.time + dur);
    e.burnSpreadAt ??= this.time + B.burnSpreadInterval;
  }

  /**
   * Fire: burns what carries it (a medium, like poison — armor caps and shells
   * don't stop it), reveals it, and SPREADS: on a pulse, a burning body ignites
   * its unburnt neighbours with a little less heat and its remaining clock.
   */
  private tickBurn(e: Enemy): boolean {
    if (e.burnUntil === undefined || e.burnUntil <= this.time || !e.burnDps) return false;
    e.hp -= e.burnDps * DT;
    e.revealedUntil = Math.max(e.revealedUntil ?? 0, this.time + 0.5);
    if (e.burnSpreadAt !== undefined && this.time >= e.burnSpreadAt) {
      e.burnSpreadAt = this.time + B.burnSpreadInterval;
      const left = e.burnUntil - this.time;
      for (const o of this.enemies) {
        if (o === e || o.burrowed || (o.burnUntil !== undefined && o.burnUntil > this.time)) continue;
        if (dist(o.pos, e.pos) > B.burnSpreadRadius) continue;
        this.ignite(o, e.burnDps * this.geneMods.burnSpreadFrac, left, e.burnSrc);
      }
    }
    if (e.hp <= 0) {
      this.killEnemy(e.id, 1, false, undefined, 'burn', e.burnSrc);
      return true;
    }
    return false;
  }

  /** The bomber's whole job: area damage to STRUCTURES, then it is gone. */
  /** All harm to a limb goes through here: its shield soaks first, then hp. */
  hurtTower(t: Tower, amount: number): void {
    t.lastHitAt = this.time;
    amount *= this.harmMultOf(t);
    const sh = t.shield ?? 0;
    if (sh > 0) {
      const soak = Math.min(sh, amount);
      t.shield = sh - soak;
      amount -= soak;
    }
    t.hp -= amount;
  }

  /**
   * The cannon. Returns true when it handled this tick (deployed, or a science
   * cannon walking the gaps); false lets a war cannon march like everyone else.
   */
  private updateCannon(e: Enemy, spec: EnemySpec): boolean {
    const c = spec.cannon!;
    const science = spec.caste === 'science';
    if (e.leaving) {
      this.leaveField(e, this.moveSpeedOf(e));
      return true;
    }
    // What would it shell from here?
    const pickTarget = (): { pos: Vec } | null => {
      if (science) {
        const weak = this.vulnerableTower();
        if (weak && dist(e.pos, weak.pos) <= c.range) return weak;
        let best: Tower | null = null;
        let bd = c.range;
        for (const t of this.towers) {
          if ((t.shield ?? 0) > 0) continue; // darts can't get through a shield
          const d = dist(e.pos, t.pos);
          if (d <= bd) { bd = d; best = t; }
        }
        return best;
      }
      const s = this.nearestStructure(e.pos, c.range);
      if (s) {
        const p = this.structurePos(s);
        if (p) return { pos: p };
      }
      return dist(e.pos, this.core) <= c.range ? { pos: this.core } : null;
    };

    const target = pickTarget();
    if (e.deployed) {
      if (!target) {
        e.deployed = false; // nothing left in reach: limber up and move on
        return false;
      }
      e.auxCooldown = (e.auxCooldown ?? 0) - DT;
      if (e.auxCooldown <= 0) {
        if (c.ammo !== undefined && (e.shotsFired ?? 0) >= c.ammo) {
          e.deployed = false; // kit spent: pack up and go home
          e.leaving = true;
          return true;
        }
        e.shotsFired = (e.shotsFired ?? 0) + 1;
        e.auxCooldown = c.interval;
        this.shells.push({
          id: this.nextId++, from: { ...e.pos }, to: { ...target.pos },
          flight: B.shellFlightSeconds, ttl: B.shellFlightSeconds,
          damage: c.damage * this.empowerOf(e), aoe: c.aoe, side: 'hive', stun: c.stun,
        });
      }
      return true;
    }
    if (target) {
      e.deployed = true;
      e.auxCooldown = c.interval * 0.5; // brace, then open fire
      this.events.push({ kind: 'cannon-deployed', enemy: e.kind });
      return true;
    }
    if (science) {
      // Walk the gaps toward the weakest limb, like the rest of the caste.
      const speed = this.moveSpeedOf(e);
      const weak = this.vulnerableTower();
      const goal = weak ? this.standCellOf(weak) : -1;
      if (goal >= 0) this.walkSmart(e, goal, weak!.pos, speed);
      else this.leaveField(e, speed);
      return true;
    }
    return false;
  }

  /** Shells land: hive shells hurt your structures (darts stun unshielded limbs); bombard shells hurt the hive. */
  private updateShells(): void {
    const landed: number[] = [];
    for (const s of this.shells) {
      s.ttl -= DT;
      if (s.ttl > 0) continue;
      landed.push(s.id);
      if (s.side === 'body') {
        if (s.fx) {
          this.blast(s.to, s.aoe, s.fx, s.damage, 'ground');
          const dx = s.dir ? s.dir.x : s.to.x - s.from.x;
          const dy = s.dir ? s.dir.y : s.to.y - s.from.y;
          this.echoSkip(s.to, dx, dy, s.fx, s.aoe, s.dir);
        } else {
          for (const e of [...this.enemies]) {
            if (e.burrowed || this.isAirborne(e) || dist(s.to, e.pos) > s.aoe) continue;
            this.damageEnemy(e, s.damage, 1);
          }
        }
        continue;
      }
      const reach = Math.max(s.aoe, 16);
      for (const t of [...this.towers]) {
        if (dist(s.to, t.pos) > reach) continue;
        if (s.stun && (t.shield ?? 0) <= 0) t.stunnedUntil = this.time + s.stun; // shields stop darts
        this.hurtStructure(t, false, s.damage);
      }
      for (const n of this.creepSources.filter((x) => x.kind === 'node')) {
        if (dist(s.to, this.cellCenter(n.cell)) <= reach) this.hurtNode(n, s.damage);
      }
      if (dist(s.to, this.core) <= reach + 30) this.coreHp -= s.damage;
    }
    if (landed.length) this.shells = this.shells.filter((s) => !landed.includes(s.id));
  }

  /** Hurt a limb and remove it if that finishes it. (Organs live below ground, out of reach.) */
  private hurtStructure(s: Tower, _isOrgan: boolean, amount: number): void {
    this.hurtTower(s, amount);
    if (s.hp <= 0) this.removeTower(s.id, true);
  }

  private detonateBomber(e: Enemy): void {
    for (const n of this.creepSources.filter((x) => x.kind === 'node')) {
      if (dist(e.pos, this.cellCenter(n.cell)) <= B.bomberBlastRadius) this.hurtNode(n, B.bomberBlastDamage);
    }
    for (const t of [...this.towers]) {
      if (dist(e.pos, t.pos) <= B.bomberBlastRadius) {
        this.hurtTower(t, B.bomberBlastDamage);
        if (t.hp <= 0) this.removeTower(t.id, true);
      }
    }
    if (dist(e.pos, this.core) <= B.bomberBlastRadius + 30) this.coreHp -= B.bomberBlastDamage;
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  /** Living royal-presence sources this tick (royal, consort). */
  private auraSources: Enemy[] = [];
  /** Route fields toward specific cells (collectors walking to a limb), keyed by cell. */
  private routeCache = new Map<number, { dist: Float64Array; next: Int32Array }>();

  /** War bodies near a living royal hit harder. Royals themselves are simply strong. */
  empowerOf(e: Enemy): number {
    if (this.auraSources.length === 0 || enemySpec(e.kind).caste !== 'war') return 1;
    for (const r of this.auraSources) {
      if (r !== e && dist(r.pos, e.pos) <= B.royalAuraRadius) return B.royalAuraDamageMult;
    }
    return 1;
  }

  private inRoyalAura(e: Enemy): boolean {
    return this.empowerOf(e) > 1;
  }

  /** A passable cell a walker can stand on to reach this limb (or the limb's own street cell). */
  private standCellFor(cell: number): number {
    if (isPassable(this.map.cells[cell])) return cell;
    const w = this.cfg.gridW;
    for (const nb of [cell + w, cell - w, cell - 1, cell + 1]) {
      if (nb >= 0 && nb < this.map.cells.length && isPassable(this.map.cells[nb])) return nb;
    }
    return -1;
  }

  /** Gun coverage per cell: summed dps of every armed limb that can reach it. */
  private dangerMap: Float64Array | null = null;

  dangerAt(cell: number): number {
    if (!this.dangerMap) {
      const n = this.map.cells.length;
      const m = new Float64Array(n);
      const w = this.cfg.gridW;
      const cp = this.cfg.cellPx;
      for (const t of this.towers) {
        const st = this.statsOf(t);
        if (st.rate <= 0 || st.damage <= 0) continue;
        const dps = st.damage * st.rate;
        const reach = Math.min(st.range, 160); // a board-wide eye still only "watches" nearby
        const rc = Math.ceil(reach / cp);
        const tx = t.cell % w;
        const ty = Math.floor(t.cell / w);
        for (let dy = -rc; dy <= rc; dy++) {
          for (let dx = -rc; dx <= rc; dx++) {
            const x = tx + dx;
            const y = ty + dy;
            if (x < 0 || y < 0 || x >= w || y >= this.cfg.gridH) continue;
            if (Math.hypot(dx, dy) * cp > reach) continue;
            m[y * w + x] += dps;
          }
        }
      }
      this.dangerMap = m;
    }
    return this.dangerMap[cell];
  }

  /**
   * The science caste's read of your defense: the reachable limb whose
   * approach is least covered by your guns. Ties go to the periphery.
   */
  vulnerableTower(): Tower | null {
    let best: Tower | null = null;
    let bestKey = Infinity;
    for (const t of this.towers) {
      // A shielded limb can't be sedated or darted — the caste doesn't bother with it.
      if ((t.shield ?? 0) > 0) continue;
      const stand = this.standCellOf(t);
      if (stand < 0) continue;
      const key = this.dangerAt(stand) * 1000 - this.creepDist[t.cell];
      if (key < bestKey || (key === bestKey && best !== null && t.id < best.id)) { bestKey = key; best = t; }
    }
    return best;
  }

  /** Smart route to a cell: streets under fire cost more, so they walk the gaps. */
  private routeTo(cell: number): { dist: Float64Array; next: Int32Array } {
    let r = this.routeCache.get(cell);
    if (!r) {
      r = computeFlow(this.map, cell, (c) =>
        (this.occupied.has(c) && c !== cell ? STRUCTURE_FLOW_COST : 0) + this.dangerAt(c) * B.dangerWeight);
      this.routeCache.set(cell, r);
    }
    return r;
  }

  /** Step along the smart route toward a cell. */
  private walkSmart(e: Enemy, goal: number, fallback: Vec, speed: number): void {
    const here = this.cellAt(e.pos.x, e.pos.y);
    const next = this.routeTo(goal).next[here];
    if (here === goal || next < 0) this.stepConstrained(e, fallback, speed);
    else this.stepConstrained(e, this.cellCenter(next), speed);
  }

  /**
   * Science caste default: probe for the weakest point, route around the guns,
   * sedate that limb and carry it off. With nothing worth taking they fall back
   * to studying the creep edge and leaving.
   */
  private updateScience(e: Enemy, spec: EnemySpec): void {
    const speed = this.moveSpeedOf(e);
    if (e.leaving) {
      this.leaveField(e, speed);
      return;
    }
    let prey = e.extractId !== undefined ? this.towers.find((t) => t.id === e.extractId) : undefined;
    // The mark got shielded (a ward went up) — pick a softer one.
    if (prey && (prey.shield ?? 0) > 0) prey = undefined;
    if (!prey) {
      prey = this.vulnerableTower() ?? undefined;
      e.extractId = prey?.id;
    }
    if (!prey) {
      this.updateResearcher(e, spec);
      return;
    }
    if (dist(e.pos, prey.pos) <= B.scienceReach) {
      this.hurtTower(prey, B.scienceExtractDps * DT); // a shield must be stripped first
      if (prey.hp <= 0) {
        e.carrying = {
          family: prey.family, pips: [...prey.pips], cell: prey.cell, facing: prey.facing,
          priority: prey.priority, casteFocus: prey.casteFocus,
        };
        this.removeTower(prey.id, false);
        e.extractId = undefined;
        e.leaving = true;
        this.events.push({ kind: 'tower-stolen', family: e.carrying.family });
      }
      return;
    }
    this.walkSmart(e, this.standCellOf(prey), prey.pos, speed);
  }

  /** Consort promotion ladder: the nearest war body steps up one rank. */
  private static readonly PROMOTION: Partial<Record<EnemyKind, EnemyKind>> = {
    skitterling: 'militia', responder: 'militia', militia: 'soldier', soldier: 'elite',
  };

  private promoteNear(c: Enemy): void {
    let best: Enemy | null = null;
    let bestD: number = B.royalAuraRadius;
    for (const o of this.enemies) {
      if (o === c || o.burrowed || !Sim.PROMOTION[o.kind]) continue;
      const d = dist(o.pos, c.pos);
      if (d <= bestD) { bestD = d; best = o; }
    }
    if (!best) return;
    const from = best.kind;
    const to = Sim.PROMOTION[from]!;
    const frac = best.hp / best.maxHp;
    best.kind = to;
    best.maxHp = enemySpec(to).hp;
    best.hp = Math.max(1, frac * best.maxHp);
    this.events.push({ kind: 'promoted', from, to });
  }

  private updateEnemies(): void {
    this.auraSources = this.enemies.filter((x) => enemySpec(x.kind).royalAura && !x.burrowed);
    for (const e of [...this.enemies]) {
      const spec = enemySpec(e.kind);

      // Blight keeps eating whoever carries it (and slips under armor plates).
      if (e.poisonUntil !== undefined && e.poisonUntil > this.time && e.poisonDps) {
        e.hp -= e.poisonDps * DT;
        if (e.hp <= 0) { this.killEnemy(e.id, 1, false, undefined, 'poison', e.poisonSrc); continue; }
      }
      // A martyr's fuse runs out: it detonates among its own.
      if (e.sleeperAt !== undefined && this.time >= e.sleeperAt) {
        let hits = 0;
        for (const o of [...this.enemies]) {
          if (o === e || dist(o.pos, e.pos) > B.sleeperRadius) continue;
          o.hp -= B.sleeperDamage;
          hits++;
          if (o.hp <= 0) this.killEnemy(o.id, 1, false, undefined, 'martyr');
        }
        this.events.push({ kind: 'martyr', hits });
        this.killEnemy(e.id, 1, false, undefined, 'martyr');
        continue;
      }
      // Fire burns, reveals, and spreads.
      if (this.tickBurn(e)) continue;

      // THE CANNON (both castes): walk, deploy, shell until destroyed.
      if (spec.cannon && this.updateCannon(e, spec)) continue;

      if (spec.stealsLimbs) {
        this.updateScience(e, spec);
        continue;
      }

      // Science-caste thief: sneaks to the creep, grabs banked war meat, flees.
      // Kill it before it slips off the field and the meat comes home.
      if (spec.thief) {
        const tSpeed = this.moveSpeedOf(e);
        if (e.leaving) {
          this.leaveField(e, tSpeed);
          continue;
        }
        const cell = this.cellAt(e.pos.x, e.pos.y);
        if (this.isCreeped(cell)) {
          const amt = Math.min(Math.floor(this.meat.war), B.thiefSteal);
          if (amt > 0) {
            this.meat.war -= amt;
            e.stole = amt;
            this.events.push({ kind: 'meat-stolen', amount: amt });
          }
          e.leaving = true;
          continue;
        }
        // Smart like the rest of its caste: slip in where your guns aren't.
        const weak = this.vulnerableTower();
        const goal = weak ? this.standCellOf(weak) : -1;
        if (goal >= 0) {
          this.walkSmart(e, goal, weak!.pos, tSpeed);
        } else {
          const nxt = this.flow.next[cell];
          if (nxt >= 0) this.stepConstrained(e, this.cellCenter(nxt), tSpeed);
          else this.stepConstrained(e, this.core, tSpeed);
        }
        continue;
      }

      const speed = this.moveSpeedOf(e);

      // Royal consort: promotes the nearest war body one rank on a pulse.
      if (spec.promotes) {
        e.auxCooldown = (e.auxCooldown ?? 0) - DT;
        if (e.auxCooldown <= 0) {
          e.auxCooldown = spec.promotes.interval;
          this.promoteNear(e);
        }
      }

      // Tunnelers travel under the streets, untargetable, and surface past the outer guns.
      if (e.burrowed) {
        const cell = this.cellAt(e.pos.x, e.pos.y);
        const d = this.flow.dist[cell];
        if (Number.isFinite(d) && d <= (e.surfaceFlowDist ?? 0)) {
          e.burrowed = false;
        } else {
          const nxt = this.flow.next[cell];
          if (nxt >= 0) this.stepConstrained(e, this.cellCenter(nxt), speed);
          else this.stepConstrained(e, this.core, speed);
          continue;
        }
      }

      // Tenders drum out a heal pulse as they march.
      if (spec.healer) {
        e.auxCooldown = (e.auxCooldown ?? 0) - DT;
        if (e.auxCooldown <= 0 && spec.rate > 0) {
          e.auxCooldown = 1 / spec.rate;
          for (const o of this.enemies) {
            if (o === e || o.kind === 'researcher' || o.hp >= o.maxHp) continue;
            if (dist(e.pos, o.pos) <= B.tenderRadius) {
              o.hp = Math.min(o.maxHp, o.hp + B.tenderHeal);
            }
          }
        }
      }

      // Bombers never latch: contact with anything of yours IS the attack.
      // They CHARGE the nearest wall or organ (anything standing on walkable
      // ground); perched guns they only catch in passing. The counterplay is
      // killing the runner before it arrives.
      if (spec.bomber) {
        const near = this.nearestStructure(e.pos, STRUCTURE_CONTACT + ENEMY_RADIUS);
        if (near || dist(e.pos, this.core) <= CORE_CONTACT) {
          this.detonateBomber(e);
          continue;
        }
        const prey = this.nearestStructure(e.pos, 4 * this.cfg.cellPx);
        if (prey) {
          const pp = this.structurePos(prey);
          const preyCell = pp ? this.cellAt(pp.x, pp.y) : -1;
          if (pp && preyCell >= 0 && isPassable(this.map.cells[preyCell])) {
            this.stepConstrained(e, pp, speed);
            continue;
          }
        }
      }

      // Latched onto a structure?
      if (e.targetId !== null && e.targetId !== -1) {
        const s = e.targetIsOrgan ? undefined : this.towers.find((t) => t.id === e.targetId);
        if (!s) {
          e.targetId = null;
        } else {
          e.attackCooldown -= DT;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 1 / spec.rate;
            this.hurtStructure(s, e.targetIsOrgan, spec.damage * this.empowerOf(e));
            // A spine wall bites back: its payload (thorns + every eaten verb) hits the chewer.
            if (!e.targetIsOrgan && (s as Tower).family === 'spine' && this.towers.includes(s as Tower)) {
              const wall = s as Tower;
              const ws = this.statsOf(wall);
              this.payloadHit(fxOf(wall, ws), e, ws.damage * B.spineThornsFrac);
            }
          }
          continue;
        }
      }

      // Attacking the core?
      if (e.targetId === -1) {
        e.attackCooldown -= DT;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 1 / spec.rate;
          this.coreHp -= spec.damage * this.empowerOf(e);
        }
        continue;
      }

      // March the streets: follow the flow field toward the core.
      if (dist(e.pos, this.core) <= CORE_CONTACT) {
        e.targetId = -1;
        e.attackCooldown = 0;
        continue;
      }

      // Fliers ignore the city plan entirely: straight over blocks and walls
      // (unless a net has them walking the streets for a moment).
      if (this.isAirborne(e)) {
        this.stepUnconstrained(e, this.core, speed);
        this.aheadCheckSeparationless(e);
        continue;
      }

      // Caltrops underfoot: a barb-mat must be chewed through, and it bites back.
      if (spec.rate > 0 && this.caltrops.length > 0) {
        const c = this.caltrops.find((k) => k.hp > 0 && dist(k.pos, e.pos) <= 12);
        if (c) {
          e.attackCooldown -= DT;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 1 / spec.rate;
            c.hp -= spec.damage * this.empowerOf(e);
            this.damageEnemy(e, c.thorns, 1);
          }
          continue;
        }
      }

      // Sappers climb: any limb or organ nearby is a target, blocks be damned —
      // but CLIMBING IS SLOW. On the street they sprint; scaling a block face
      // they crawl, and that crawl is the defender's window to shoot them off
      // the wall. (Without it, covering the lane just fed the sappers.)
      if (spec.sapper) {
        const prey = this.woundNear(e.pos, B.graftScent) ?? this.nearestStructure(e.pos, 3 * this.cfg.cellPx);
        if (prey) {
          const pp = this.structurePos(prey);
          if (pp) {
            if (dist(e.pos, pp) <= STRUCTURE_CONTACT + ENEMY_RADIUS) {
              e.targetId = prey.id;
              e.targetIsOrgan = prey.kind === 'o';
              e.attackCooldown = 0;
            } else {
              const onStreet = isPassable(this.map.cells[this.cellAt(e.pos.x, e.pos.y)]);
              this.stepUnconstrained(e, pp, speed * (onStreet ? 1 : B.sapperClimbFactor));
            }
            continue;
          }
        }
      }

      // A broodling underfoot gets fought, not walked past — blocking is its job.
      if (spec.rate > 0 && !spec.bomber && this.broodlings.length > 0) {
        let bl: Broodling | null = null;
        let bd = B.broodEngageDist + ENEMY_RADIUS;
        for (const b of this.broodlings) {
          const d = dist(e.pos, b.pos);
          if (d < bd) { bd = d; bl = b; }
        }
        if (bl) {
          e.attackCooldown -= DT;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 1 / spec.rate;
            bl.hp -= spec.damage * this.empowerOf(e);
            if (bl.hp <= 0) {
              this.broodlings = this.broodlings.filter((b) => b !== bl);
              this.events.push({ kind: 'broodling-lost', motherId: bl.motherId });
            }
          }
          continue;
        }
      }

      // Standoff bombardier: besieges the nearest structure from OUTSIDE melee.
      // Short-armed limbs cannot answer it; long guns and broodlings can.
      if (spec.standoff) {
        const prey = this.woundNear(e.pos, B.mortarStandoff) ?? this.nearestStructure(e.pos, B.mortarStandoff);
        if (prey) {
          e.attackCooldown -= DT;
          if (e.attackCooldown <= 0 && spec.rate > 0) {
            e.attackCooldown = 1 / spec.rate;
            const s = prey.kind === 't' ? this.towers.find((t) => t.id === prey.id) : undefined;
            if (s) {
              this.arcs.push({ from: { ...e.pos }, to: { ...s.pos }, ttl: 0.12 });
              this.hurtStructure(s, prey.kind === 'o', spec.damage * this.empowerOf(e));
            }
          }
          continue;
        }
      }

      const cell = this.cellAt(e.pos.x, e.pos.y);
      const nextCell = this.flow.next[cell];

      // A structure on my cell or the next cell is a wall in my way: chew through
      // it — unless it is a digestive pit, which is a floor and WANTS the traffic.
      const rawWall = this.structureOn(cell) ?? (nextCell >= 0 ? this.structureOn(nextCell) : undefined);
      const wall = rawWall && rawWall.kind === 't'
        && this.towers.find((x) => x.id === rawWall.id)?.family === 'swamp' ? undefined : rawWall;
      if (wall) {
        const wp = this.structurePos(wall);
        if (wp && dist(e.pos, wp) <= STRUCTURE_CONTACT + ENEMY_RADIUS) {
          e.targetId = wall.id;
          e.targetIsOrgan = wall.kind === 'o';
          e.attackCooldown = 0;
          continue;
        }
        if (wp) {
          this.stepConstrained(e, wp, speed);
          continue;
        }
      }

      if (nextCell >= 0) {
        this.stepConstrained(e, this.cellCenter(nextCell), speed);
      } else {
        // Unreachable pocket (shouldn't happen): press toward the core anyway.
        this.stepConstrained(e, this.core, speed);
      }
    }
    this.applySeparation();
  }

  /** Walk back up the flow field (away from the core) and slip out at the edge. */
  private leaveField(e: Enemy, speed: number): void {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    const cx = cell % this.cfg.gridW;
    const cy = Math.floor(cell / this.cfg.gridW);
    if (cx <= 1 || cy <= 1 || cx >= this.cfg.gridW - 2 || cy >= this.cfg.gridH - 2) {
      const i = this.enemies.indexOf(e);
      if (i >= 0) this.enemies.splice(i, 1);
      if (e.carrying) {
        this.stats.limbsCarriedOff += 1; // a courier got away with one of yours
        // Homing Tissue (a hobby gene): what it cost comes home anyway.
        if (this.geneMods.homingRefund) {
          const cost = towerSpec(e.carrying.family).cost;
          for (const k of ['war', 'science', 'royal'] as Caste[]) this.meat[k] += cost[k] ?? 0;
        }
      }
      return;
    }
    let best = -1;
    let bestD = this.flow.dist[cell];
    let nearVoid = false;
    const neighbors = [cell - 1, cell + 1, cell - this.cfg.gridW, cell + this.cfg.gridW];
    for (const nb of neighbors) {
      if (nb < 0 || nb >= this.map.cells.length) continue;
      if (this.map.cells[nb] === CellType.Void) nearVoid = true;
      if (!isPassable(this.map.cells[nb])) continue;
      if (Number.isFinite(this.flow.dist[nb]) && this.flow.dist[nb] > bestD) {
        bestD = this.flow.dist[nb];
        best = nb;
      }
    }
    if (best >= 0) {
      this.stepConstrained(e, this.cellCenter(best), speed);
    } else if (nearVoid) {
      // Top of the flow field at the frontier: slip out into the unclaimed city.
      const i = this.enemies.indexOf(e);
      if (i >= 0) this.enemies.splice(i, 1);
    } else {
      this.stepConstrained(e, { x: e.pos.x < this.worldW / 2 ? 0 : this.worldW, y: e.pos.y }, speed);
    }
  }

  private updateResearcher(e: Enemy, _spec: EnemySpec): void {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    const speed = this.moveSpeedOf(e); // a snared researcher is a caught researcher
    if (e.leaving) {
      this.leaveField(e, speed);
      return;
    }
    // Approach along the streets; step ONTO the creep edge to take samples.
    // Standing on the mass is what science pays for — and what makes them huntable.
    const nextCell = this.flow.next[cell];
    if (this.isCreeped(cell)) {
      e.studyLeft -= DT;
      if (e.studyLeft <= 0) e.leaving = true;
      return;
    }
    if (nextCell >= 0) this.stepConstrained(e, this.cellCenter(nextCell), speed);
  }

  // ---------- combat ----------

  /**
   * Broodlings are the mother's PAYLOAD: they bite with her potency and tempo,
   * roam as far as her reach, grow tougher with her spine pips, and every verb
   * she has eaten rides their bites (a blighter pip = poisoned bites, a frond
   * pip = bites that arc, a swamp pip = bites that digest the weak...).
   */
  private updateBroodlings(): void {
    for (const b of [...this.broodlings]) {
      const mother = this.towers.find((t) => t.id === b.motherId);
      if (!mother) continue; // dies with the mother in removeTower
      if (this.isTapped(mother)) continue; // a tapped mother's brood stands idle
      const ms = this.statsOf(mother);
      b.cooldown -= DT;
      let prey: Enemy | null = null;
      let bestD = Infinity;
      for (const e of this.enemies) {
        if (e.burrowed || enemySpec(e.kind).caste === 'science' || this.isAirborne(e)) continue;
        if (!b.puppet && dist(mother.pos, e.pos) > B.broodLeash * ms.reach) continue; // stays near home
        const d = dist(b.pos, e.pos);
        if (d < bestD) { bestD = d; prey = e; }
      }
      if (prey) {
        if (bestD <= B.broodEngageDist + ENEMY_RADIUS) {
          if (b.cooldown <= 0) {
            b.cooldown = 1 / ((b.puppet?.rate ?? B.broodRate) * ms.tempo);
            this.payloadHit({ ...fxOf(mother, ms), quiet: true }, prey, (b.puppet?.bite ?? B.broodDamage) * ms.potency,
              prey.pos.x - b.pos.x, prey.pos.y - b.pos.y);
          }
        } else {
          this.stepConstrained(b, prey.pos, (b.puppet?.speed ?? B.broodSpeed) * (b.puppet ? ms.tempo : 1));
        }
      } else if (dist(b.pos, mother.pos) > 40) {
        // Nothing to fight: drift back to mother's skirts.
        this.stepConstrained(b, mother.pos, B.broodSpeed * 0.7);
      }
    }
  }

  /** Aimed bile globs land and detonate with the lobber's full payload. */
  private updateBiles(): void {
    const landed: number[] = [];
    for (const g of this.bileFlights) {
      g.ttl -= DT;
      if (g.ttl <= 0) {
        const hits = this.blast(g.to, g.aoe, g.fx, g.fx.damage, 'ground');
        this.echoSkip(g.to, g.to.x - g.from.x, g.to.y - g.from.y, g.fx, g.aoe);
        this.events.push({ kind: 'bile-landed', cell: g.cell, hits });
        landed.push(g.id);
      }
    }
    if (landed.length) this.bileFlights = this.bileFlights.filter((g) => !landed.includes(g.id));
  }

  /** Creep clots land with a thud (the sling's payload), then take root as ITS patch. */
  private updateClots(): void {
    // Seedlings in the air come down.
    for (const f of this.seedFlights) f.ttl -= DT;
    if (this.seedFlights.some((f) => f.ttl <= 0)) this.seedFlights = this.seedFlights.filter((f) => f.ttl > 0);
    const landed: number[] = [];
    for (const c of this.clotFlights) {
      c.ttl -= DT;
      if (c.ttl <= 0) {
        this.blast(c.to, c.aoe, c.fx, c.fx.damage, 'ground');
        this.addCreepSource('patch', c.cell, B.slingPatchRadius + c.patchBonus, undefined, c.ownerId);
        this.events.push({ kind: 'clot-landed', cell: c.cell });
        landed.push(c.id);
      }
    }
    if (landed.length) this.clotFlights = this.clotFlights.filter((c) => !landed.includes(c.id));
  }

  /** Area payload: every body of the given layer within radius takes the hit. Returns hits. */
  private blast(at: Vec, radius: number, fx: HitFx, damage: number, layer: 'ground' | 'air' | 'both'): number {
    let hits = 0;
    for (const e of [...this.enemies]) {
      if (e.burrowed || dist(at, e.pos) > radius) continue;
      const air = this.isAirborne(e);
      if ((layer === 'ground' && air) || (layer === 'air' && !air)) continue;
      hits++;
      this.payloadHit(fx, e, damage, e.pos.x - at.x, e.pos.y - at.y);
    }
    return hits;
  }

  /** Skipper pips: an impact bounces on down its line and lands again, weaker, per skip. */
  private echoSkip(at: Vec, dirX: number, dirY: number, fx: HitFx, aoe: number, dir?: Vec): void {
    if (fx.skips <= 0) return;
    const m = Math.hypot(dirX, dirY) || 1;
    const to = { x: at.x + (dirX / m) * B.skipDistance, y: at.y + (dirY / m) * B.skipDistance };
    this.shells.push({
      id: this.nextId++, from: { ...at }, to, flight: 0.3, ttl: 0.3,
      damage: fx.damage * B.skipFalloff, aoe: Math.max(aoe, 20), side: 'body',
      fx: { ...fx, damage: fx.damage * B.skipFalloff, skips: fx.skips - 1 }, dir,
    });
  }

  /** Arcs jump from a hit body to nearby bodies, damage falling per hop. */
  private chainArcs(from: Enemy, chains: number, damage: number, yieldMult: number, capBonus: number): void {
    let src = from;
    const struck = new Set<number>([from.id]);
    let dmg = damage * B.chainFalloff;
    for (let i = 0; i < chains; i++) {
      let best: Enemy | null = null;
      let bestD: number = B.chainRadius;
      for (const e of this.enemies) {
        if (struck.has(e.id) || e.burrowed) continue;
        const d = dist(src.pos, e.pos);
        if (d <= bestD) { bestD = d; best = e; }
      }
      if (!best) break;
      this.arcs.push({ from: { ...src.pos }, to: { ...best.pos }, ttl: 0.22 });
      this.damageEnemy(best, dmg, yieldMult, capBonus);
      struck.add(best.id);
      src = best;
      dmg *= B.chainFalloff;
    }
  }

  /** Shove a body along a direction, never into a building. */
  private knockBack(e: Enemy, dirX: number, dirY: number, px: number): void {
    const m = Math.hypot(dirX, dirY) || 1;
    const nx = e.pos.x + (dirX / m) * px;
    const ny = e.pos.y + (dirY / m) * px;
    if (this.isAirborne(e)
      || (nx >= 2 && ny >= 2 && nx <= this.worldW - 2 && ny <= this.worldH - 2
        && isPassable(this.map.cells[this.cellAt(nx, ny)]))) {
      e.pos.x = nx;
      e.pos.y = ny;
    }
  }

  /**
   * Target priority. Every limb's reflex: a sapper CLIMBING a block face is
   * exposed and about to eat someone — shoot it off the wall first. (This is
   * what makes limbs cover each other; a lone tower still dies to sappers.)
   * Snipers additionally prefer support castes (drummer/tender/bomber) over
   * everything the reflex doesn't claim. Only TARGETABLE bodies count: the
   * right layer (air/ground) and, for cloaked bodies, detection.
   */
  private pickTarget(t: Tower, s: TowerStats, exclude?: Set<number>): Enemy | null {
    const range = s.range;
    const mode = t.priority ?? 'auto';
    const caste = t.casteFocus ?? 'any';
    // FOCUS: hold the last target while it lives, stays in reach and stays targetable.
    if (mode === 'focus' && t.lastTargetId !== undefined && !exclude) {
      const held = this.enemies.find((e) => e.id === t.lastTargetId);
      if (held && dist(t.pos, held.pos) <= range && this.canTarget(t, s, held)) return held;
    }
    let target: Enemy | null = null;
    let bestKey = -Infinity;
    for (const e of this.enemies) {
      if (exclude && exclude.has(e.id)) continue;
      const d = dist(t.pos, e.pos);
      if (d > range) continue;
      if (!this.canTarget(t, s, e)) continue;
      const es = enemySpec(e.kind);
      let sub: number;
      if (mode === 'first') {
        sub = -this.progressOf(e);             // furthest along the march
      } else if (mode === 'strongest') {
        sub = e.hp;                             // most health left
      } else if (mode === 'weakest') {
        sub = -e.hp;                            // finish the wounded
      } else {
        const climbing = !!es.sapper && !isPassable(this.map.cells[this.cellAt(e.pos.x, e.pos.y)]);
        const support = !!(es.speedAura || es.healer || es.bomber);
        // An emplaced cannon in reach is a standing threat: silence it.
        const tier = climbing || e.deployed ? 2 : s.sniper && support ? 1 : 0;
        sub = tier * 1e6 - d;
      }
      // A chosen caste outranks every other ordering.
      const key = (caste !== 'any' && es.caste === caste ? 1e9 : 0) + sub;
      if (key >= bestKey) { bestKey = key; target = e; }
    }
    return target;
  }

  /** How far a body still has to go (flow units; fliers by straight line). Lower = further along. */
  private progressOf(e: Enemy): number {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    const d = this.flow.dist[cell];
    if (isPassable(this.map.cells[cell]) && Number.isFinite(d)) return d;
    return (dist(e.pos, this.core) / this.cfg.cellPx) * 10;
  }

  /** Is anything this limb could shoot in its own reach? (Idle prisms relay their charge.) */
  private hasTargetInRange(t: Tower, s: TowerStats): boolean {
    for (const e of this.enemies) {
      if (dist(t.pos, e.pos) <= s.range && this.canTarget(t, s, e)) return true;
    }
    return false;
  }

  /**
   * Prism relay: idle, charged prisms chained within link range of a firing
   * prism (directly or through each other) pour their charge into its beam and
   * spend their own shot doing it. Breadth-first, so the network routes itself.
   */
  private gatherPrismRelays(firing: Tower, claimed: Set<number>): number {
    const link = towerSpec('prism').prismLink ?? 0;
    const frontier: Tower[] = [firing];
    let relays = 0;
    while (frontier.length > 0) {
      const cur = frontier.shift()!;
      for (const p of this.towers) {
        if (p.family !== 'prism' || p === firing || claimed.has(p.id) || p.cooldown > 0) continue;
        if (dist(cur.pos, p.pos) > link) continue;
        if (this.hasTargetInRange(p, this.statsOf(p))) continue; // busy prisms fire their own
        claimed.add(p.id);
        p.cooldown = 1 / towerSpec('prism').rate;
        this.arcs.push({ from: { ...p.pos }, to: { ...cur.pos }, ttl: 0.25 });
        relays++;
        frontier.push(p);
      }
    }
    return relays;
  }

  /** A skipping mortar's facing as a unit vector. */
  static facingVec(dir: RootDir): Vec {
    return dir === 'N' ? { x: 0, y: -1 } : dir === 'S' ? { x: 0, y: 1 } : dir === 'E' ? { x: 1, y: 0 } : { x: -1, y: 0 };
  }

  /** Default facing: toward the nearest frontier gate (then click its panel to turn it). */
  facingTowardGate(pos: Vec): RootDir {
    let dir: RootDir = 'N';
    let best = Infinity;
    for (const gate of this.gates) {
      const g = this.cellCenter(gate);
      const d = dist(pos, g);
      if (d < best) {
        best = d;
        const dx = g.x - pos.x;
        const dy = g.y - pos.y;
        dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
      }
    }
    return dir;
  }

  /** Fire one shot of this limb's weapon at one target (every weapon kind). */
  private fireAt(
    t: Tower, s: TowerStats, target: Enemy, dmg: number, relayClaimed: Set<number>,
    shot = 0, shots = 1,
  ): void {
    // Twinned shots fan out slightly around the aim line.
    const twinOffset = shots > 1 ? (shot - (shots - 1) / 2) * B.twinSpread : 0;
    const fx = fxOf(t, s, dmg);
    const dx = target.pos.x - t.pos.x;
    const dy = target.pos.y - t.pos.y;

    // Hitscan strikers: the frond's arc chain, the ocular's board-wide beam,
    // and the prism's focus beam (fed by relays from idle prisms).
    if (t.family === 'frond' || t.family === 'ocular' || t.family === 'prism') {
      if (t.family === 'prism' && !relayClaimed.has(t.id)) {
        relayClaimed.add(t.id);
        fx.damage *= 1 + B.prismRelayBonus * this.gatherPrismRelays(t, relayClaimed);
      }
      this.arcs.push({ from: { ...t.pos }, to: { ...target.pos }, ttl: t.family === 'ocular' ? 0.3 : 0.22 });
      const at = { ...target.pos };
      this.payloadHit(fx, target, fx.damage, dx, dy);
      this.echoSkip(at, dx, dy, fx, s.aoe);
      return;
    }

    if (t.family === 'lasher' || t.family === 'maw') {
      if (t.family === 'maw' && target.hp <= s.eatThreshold) {
        this.eatEnemy(target, t.id);
        return;
      }
      const at = { ...target.pos };
      this.payloadHit(fx, target, fx.damage, dx, dy);
      if (t.family === 'lasher' && s.aoe > 0) {
        for (const e of [...this.enemies]) {
          if (e !== target && !e.burrowed && !this.isAirborne(e) && dist(t.pos, e.pos) <= s.aoe + 20) {
            this.payloadHit(fx, e, fx.damage * 0.5, e.pos.x - t.pos.x, e.pos.y - t.pos.y);
          }
        }
      }
      this.echoSkip(at, dx, dy, fx, s.aoe);
      return;
    }

    // The ember sac sprays a CONE: every targetable body inside it takes the hit.
    const cone = towerSpec(t.family).cone;
    if (cone !== undefined) {
      const aim = Math.atan2(dy, dx);
      this.arcs.push({ from: { ...t.pos }, to: { ...target.pos }, ttl: 0.15 });
      for (const e of [...this.enemies]) {
        const rx = e.pos.x - t.pos.x;
        const ry = e.pos.y - t.pos.y;
        if (Math.hypot(rx, ry) > s.range || !this.canTarget(t, s, e)) continue;
        let da = Math.atan2(ry, rx) - aim;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) > cone) continue;
        this.payloadHit(fx, e, fx.damage, rx, ry);
      }
      return;
    }

    // The skipping mortar lobs a shell that bounces on down its facing line.
    if (t.family === 'skipper') {
      const f = Sim.facingVec(t.facing ?? 'N');
      this.shells.push({
        id: this.nextId++, from: { ...t.pos }, to: { ...target.pos },
        flight: B.shellFlightSeconds, ttl: B.shellFlightSeconds,
        damage: fx.damage, aoe: s.aoe, side: 'body',
        fx: { ...fx }, dir: f, // skips carry on down the FACING line
      });
      return;
    }

    // Projectile shooters (spitter, burster, tangler, blighter, impaler, mister,
    // quill fan, netcaster...). The quill fans its pellets across a cone.
    const layer: 'ground' | 'air' | 'both' = s.hitsAir && s.hitsGround ? 'both' : s.hitsAir ? 'air' : 'ground';
    // Boomerang: a node pointed at this limb (or a boomerang pip in it) calls its
    // shots back after their first hit — to the node, or to the limb itself.
    // DOUBLING: every boomerang layer (node or pip) is one more trip — the shot
    // ping-pongs between the node and the first body it hit.
    let returnTo: Vec | undefined;
    const nodes = this.enginesPointedAt(t, 'boomerang').filter((c) => !this.isTapped(c));
    const ownBoom = [...t.pips, ...upgradePips(t)].filter((p) => p.family === 'boomerang').length;
    if (nodes.length > 0) returnTo = { ...nodes[0].pos };
    else if (ownBoom > 0) returnTo = { ...t.pos };
    let legs = nodes.length + ownBoom;
    let returnDmg = 1;
    for (const n of nodes) {
      const ns = towerStats(n);
      legs += ns.returnLegs;
      returnDmg = Math.max(returnDmg, ns.returnDmg);
    }
    const pellets = towerSpec(t.family).pellets ?? 1;
    const spread = towerSpec(t.family).spread ?? 0;
    const base = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy) || 1;
    const speed = B.projectileSpeed;
    for (let i = 0; i < pellets; i++) {
      const a = (pellets > 1 ? base - spread / 2 + (spread * i) / (pellets - 1) : base) + twinOffset;
      this.projectiles.push({
        id: this.nextId++,
        pos: { ...t.pos },
        vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        aoe: s.aoe,
        // Piercing shots and pellets fly their full reach; ordinary ones die at the target.
        ttl: s.pierce || pellets > 1 ? (s.range * 1.1) / speed : (d / speed) + 0.4,
        fromFamily: t.family,
        fx: { ...fx },
        hits: layer,
        pierceLeft: s.pierce ? 3 : undefined,
        hitIds: s.pierce ? [] : undefined,
        returnTo,
        legsLeft: returnTo ? legs - 1 : undefined,
        returnDmg: returnTo ? returnDmg : undefined,
      });
    }
  }

  private updateTowers(): void {
    const relayClaimed = new Set<number>();
    this.wounds = 0;
    for (const t of this.towers) {
      // Cooldown ticks for every limb — sling and lobber recharges live here too.
      t.cooldown -= DT;
      const stats = this.statsOf(t);

      // Shields: a permanent membrane from ward pips, plus projection from every
      // ward covering it (wards stack; a ward's potency grows its shield, its
      // tempo speeds the regrowth, its reach/splash grow its radius).
      let projected = 0;
      let regenMult = 1;
      for (const w of this.towers) {
        if (w.family !== 'ward' || w.id === t.id) continue;
        const aura = this.auraOf(w);
        if (dist(w.pos, t.pos) > aura.radius) continue;
        projected += (towerSpec('ward').wardShield ?? 0) * aura.strength;
        regenMult = Math.max(regenMult, towerStats(w).tempo);
      }
      const shieldMax = stats.shieldPerm + projected;
      t.shieldMax = shieldMax;
      if (t.shield === undefined) t.shield = shieldMax;
      if (this.time - (t.lastHitAt ?? -1e9) >= B.shieldRegenDelay) t.shield += B.shieldRegen * regenMult * DT;
      t.shield = Math.min(t.shield, shieldMax);

      // A marrow tap holds this limb in stasis: it does nothing at all.
      if (this.isTapped(t)) continue;

      // Sedation darts: a stunned limb holds fire.
      if (t.stunnedUntil !== undefined && t.stunnedUntil > this.time) continue;

      // SURGERY UNDER FIRE: a limb still grafting what it ate holds fire until the graft takes.
      if (t.graftUntil !== undefined) {
        if (t.graftUntil > this.time) { this.wounds += 1; continue; }
        t.graftUntil = undefined;
        this.events.push({ kind: 'graft-took', family: t.family });
      }

      // Bombard: shells its MARKER when the hive is there; no marker, no fire.
      if (t.family === 'bombard') {
        if (t.marker === undefined || t.cooldown > 0) continue;
        const at = this.cellCenter(t.marker);
        if (dist(t.pos, at) > stats.range) continue;
        const hostile = this.enemies.some((e) => !e.burrowed && !this.isAirborne(e) && dist(e.pos, at) <= stats.aoe + 10);
        if (!hostile) continue;
        t.cooldown = 1 / stats.rate;
        for (let k = 0; k < stats.volley; k++) {
          // Twinned shells walk a little around the marker.
          const off = stats.volley > 1 ? (k - (stats.volley - 1) / 2) * 14 : 0;
          this.shells.push({
            id: this.nextId++, from: { ...t.pos }, to: { x: at.x + off, y: at.y - off * 0.5 },
            flight: B.shellFlightSeconds, ttl: B.shellFlightSeconds,
            damage: stats.damage, aoe: stats.aoe, side: 'body', fx: fxOf(t, stats),
          });
        }
        continue;
      }

      // A TRAP CAGE catches a weakened royal in reach and grafts her: she fights her own.
      if (t.family === 'cage' && (t.captures ?? 0) < stats.captures) {
        const reach = towerSpec('cage').range * stats.reach;
        const royal = this.enemies.find((e) => enemySpec(e.kind).caste === 'royal'
          && dist(e.pos, t.pos) <= reach && e.hp <= e.maxHp * stats.captureAt);
        if (royal) {
          const rs = enemySpec(royal.kind);
          this.enemies.splice(this.enemies.indexOf(royal), 1);
          t.captures = (t.captures ?? 0) + 1;
          this.stats.royalsCaptured += 1;
          this.broodlings.push({
            id: this.nextId++, motherId: t.id, pos: { ...royal.pos }, hp: royal.maxHp * 0.6, maxHp: royal.maxHp * 0.6,
            cooldown: 0, puppet: { bite: rs.damage, rate: rs.rate, speed: rs.speed * 1.4, kind: royal.kind },
          });
          this.events.push({ kind: 'royal-captured', enemy: royal.kind });
        }
        continue;
      }

      // The CREEP LANCE's payload is its strip (the payload rule: nothing ever does nothing):
      // every hit verb it has eaten or grown pulses onto the ground bodies standing on it —
      // an ember pip sets the strip burning, a snare pip bogs it, a blight pip poisons it.
      if (t.family === 'lance' && t.cooldown <= 0) {
        const fx = fxOf(t, stats, 0);
        const verbs = fx.slowMult < 1 || fx.poisonDps > 0 || fx.burnDps > 0 || fx.shred > 0 || fx.cloud > 0
          || fx.execute > 0 || (fx.rootDur ?? 0) > 0;
        const strip = verbs ? this.creepSources.find((c) => c.kind === 'line' && c.ownerId === t.id) : undefined;
        if (strip) {
          t.cooldown = 0.5 / stats.tempo;
          for (const e of [...this.enemies]) {
            if (e.burrowed || this.isAirborne(e)) continue;
            if (this.lineCovers(strip, this.cellAt(e.pos.x, e.pos.y))) this.payloadHit(fx, e, 0);
          }
        }
      }

      // The broodmother tends her brood (a brood pip on her = one more).
      if (t.family === 'brood') {
        const mine = this.broodlings.filter((b) => b.motherId === t.id).length;
        const want = ((towerSpec('brood').broodCount ?? 0) + stats.extraBroodlings) * stats.volley;
        if (mine < want && t.cooldown <= 0) {
          t.cooldown = B.broodRespawn / stats.tempo;
          const spawn = this.cellsOf(t).map((c) => this.passableNear(c)).find((p) => p !== null) ?? t.pos;
          const hp = B.broodHp * (stats.maxHp / towerSpec('brood').maxHp) * this.geneMods.broodHpMult; // spine pips = tougher brood
          this.broodlings.push({
            id: this.nextId++, motherId: t.id, pos: { x: spawn.x, y: spawn.y },
            hp, maxHp: hp, cooldown: 0,
          });
        }
        continue;
      }

      // The SWAMP: the column wades through; everything in it is bogged and
      // burned, and anything weak enough is digested outright — in mass.
      if (t.family === 'swamp') {
        const sw = towerSpec('swamp').swamp!;
        const radius = sw.radius + (stats.aoe - towerSpec('swamp').aoe);
        const fx = fxOf(t, stats, 0);
        const pulse = t.cooldown <= 0; // hit verbs pulse twice a second (tempo = faster)
        if (pulse) t.cooldown = 0.5 / stats.tempo;
        for (const e of [...this.enemies]) {
          if (e.burrowed || this.isAirborne(e) || dist(t.pos, e.pos) > radius) continue;
          this.applyHitEffects(e, { slowMult: Math.min(sw.slow, stats.slowMult), slowDur: 0.3, poisonDps: 0, poisonDur: 0 });
          e.hp -= sw.dps * stats.potency * DT; // a medium, not a hit: shells and caps don't stop it
          if (pulse) this.payloadHit(fx, e, 0);
          if (this.enemies.includes(e) && e.hp <= stats.execute) {
            this.biomass += B.swampBiomassPerKill;
            const at = { ...e.pos };
            this.killEnemy(e.id, stats.yieldMult, false, t.id, 'swamp');
            if (stats.caltrop > 0) this.dropCaltrop(at, stats.caltrop);
          }
        }
        continue;
      }

      // The LURE: pulses a toxic pheromone cloud onto the hive where it walks.
      if (t.family === 'lure') {
        if (t.cooldown > 0) continue;
        const ph = towerSpec('lure').pheromone!;
        let near: Enemy | null = null;
        let nd = stats.range;
        for (const e of this.enemies) {
          if (e.burrowed || this.isAirborne(e)) continue;
          const d = dist(t.pos, e.pos);
          if (d <= nd) { nd = d; near = e; }
        }
        if (!near) continue;
        t.cooldown = ph.interval / stats.tempo;
        const radius = ph.radius + (stats.aoe - towerSpec('lure').aoe);
        for (let k = 0; k < stats.volley; k++) {
          this.spawnCloud({ x: near.pos.x + k * 10, y: near.pos.y }, radius, ph.dps * stats.potency + stats.cloud, t.id);
        }
        // Its eaten verbs ride the pulse onto everything the cloud blooms over.
        this.blast(near.pos, radius, { ...fxOf(t, stats, 0), cloud: 0 }, 0, 'ground');
        continue;
      }

      if (stats.rate <= 0) continue;
      if (t.cooldown > 0) continue;
      if (relayClaimed.has(t.id)) continue; // spent this beat feeding a sibling prism

      // The skipping mortar only sees down its FACING line.
      let target: Enemy | null;
      if (t.family === 'skipper') {
        const f = Sim.facingVec(t.facing ?? 'N');
        target = null;
        let bestAlong = Infinity;
        for (const e of this.enemies) {
          if (!this.canTarget(t, stats, e)) continue;
          const rx = e.pos.x - t.pos.x;
          const ry = e.pos.y - t.pos.y;
          const along = rx * f.x + ry * f.y;
          const across = Math.abs(rx * f.y - ry * f.x);
          if (along <= 0 || along > stats.range || across > 28) continue;
          if (along < bestAlong) { bestAlong = along; target = e; }
        }
      } else {
        target = this.pickTarget(t, stats);
      }
      // CAPACITOR: with nothing to shoot, bank shots at the limb's own rate;
      // with the hive in reach, spend them at 400% speed until the bank is dry.
      const cap = this.capacitorOf(t);
      if (!target) {
        if (cap) t.bank = (t.bank ?? 0) + stats.rate * cap.charge * DT;
        continue;
      }
      if (cap && (t.bank ?? 0) >= 1) {
        t.bank = (t.bank ?? 0) - 1;
        t.cooldown = 1 / (stats.rate * cap.speed);
      } else {
        t.cooldown = 1 / stats.rate;
        // Trickle evolution: keeps banking a little even while firing normally.
        if (cap && cap.trickle > 0) t.bank = (t.bank ?? 0) + cap.trickle * cap.charge;
      }

      // Focus fire: consecutive shots on one body ramp (prisms natively, any
      // limb through prism pips). Switching targets resets the streak.
      t.streak = target.id === t.lastTargetId ? (t.streak ?? 0) + 1 : 0;
      t.lastTargetId = target.id;
      const dmg = stats.damage * (1 + stats.streakRamp * t.streak);
      // Twinned: the whole shot goes out `volley` times.
      for (let k = 0; k < stats.volley; k++) this.fireAt(t, stats, target, dmg, relayClaimed, k, stats.volley);

      // Quill pips: every shot also strikes that many MORE targets.
      if (stats.extraTargets > 0) {
        const used = new Set<number>([target.id]);
        for (let k = 0; k < stats.extraTargets; k++) {
          const extra = this.pickTarget(t, stats, used);
          if (!extra) break;
          used.add(extra.id);
          this.fireAt(t, stats, extra, stats.damage, relayClaimed);
        }
      }
    }
  }

  private updateProjectiles(): void {
    const gone: number[] = [];
    for (const p of this.projectiles) {
      p.ttl -= DT;
      p.pos.x += p.vel.x * DT;
      p.pos.y += p.vel.y * DT;
      let hit: Enemy | null = null;
      for (const e of this.enemies) {
        if (e.burrowed) continue;
        const air = this.isAirborne(e);
        if ((p.hits === 'ground' && air) || (p.hits === 'air' && !air)) continue; // shot passes under/over
        if (p.hitIds && p.hitIds.includes(e.id)) continue; // a skewer hits each body once
        if (dist(p.pos, e.pos) <= ENEMY_RADIUS + 4) { hit = e; break; }
      }
      if (hit) {
        const at = { ...hit.pos };
        if (p.aoe > 0) {
          this.blast(p.pos, p.aoe, p.fx, p.fx.damage, p.hits);
        } else {
          this.payloadHit(p.fx, hit, p.fx.damage, p.vel.x, p.vel.y);
        }
        this.echoSkip(at, p.vel.x, p.vel.y, p.fx, p.aoe);
        // BOOMERANG: after the first hit the shot turns for home, striking
        // every body on the way back (each once).
        if (p.returnTo && !p.returned) {
          p.returned = true;
          p.turnAt = at;
          p.hitIds = [...(p.hitIds ?? []), hit.id];
          p.pierceLeft = 1e9;
          if (p.returnDmg && p.returnDmg !== 1) p.fx = { ...p.fx, damage: p.fx.damage * p.returnDmg };
          this.steerProjectile(p, p.returnTo);
          continue;
        }
        if (p.pierceLeft !== undefined && p.pierceLeft > 0) {
          p.pierceLeft -= 1;
          p.hitIds?.push(hit.id);
        } else {
          gone.push(p.id);
        }
      } else if (p.ttl <= 0) {
        // Ping-pong: a boomerang with trips left turns around at either end.
        if (p.returned && p.returnTo && p.turnAt && (p.legsLeft ?? 0) > 0) {
          p.legsLeft = (p.legsLeft ?? 0) - 1;
          const home = dist(p.pos, p.returnTo) < dist(p.pos, p.turnAt);
          p.hitIds = [];
          this.steerProjectile(p, home ? p.turnAt : p.returnTo);
        } else {
          gone.push(p.id);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !gone.includes(p.id));
  }

  /** Point a projectile at a spot at its current speed, with just enough life to get there. */
  private steerProjectile(p: Projectile, to: Vec): void {
    const dx = to.x - p.pos.x;
    const dy = to.y - p.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = Math.hypot(p.vel.x, p.vel.y) || B.projectileSpeed;
    p.vel = { x: (dx / d) * sp, y: (dy / d) * sp };
    p.ttl = d / sp;
  }


  private damageEnemy(e: Enemy, dmg: number, yieldMult: number, capBonus = 0, srcId?: number, quiet = false): void {
    // Ablative carapace: the shell eats whole HITS — few big blows strip it
    // fastest (the phalanx's mirror). Poison seeps through, it is not a hit.
    if (e.hitShield !== undefined && e.hitShield > 0) {
      e.hitShield -= 1;
      return;
    }
    // Royal presence steels the war bodies around it.
    if (this.inRoyalAura(e)) dmg *= B.royalAuraArmor;
    const cap = enemySpec(e.kind).armorCap;
    // Shredded armor raises the cap for EVERY source — the mister's whole job.
    const shred = e.shredUntil !== undefined && e.shredUntil > this.time ? e.shredAmount ?? 0 : 0;
    const effCap = cap !== undefined ? cap + capBonus + shred : undefined;
    const dealt = effCap !== undefined && Number.isFinite(effCap) ? Math.min(dmg, effCap) : dmg;
    e.hp -= dealt;
    if (srcId !== undefined && !quiet) this.waveLimbDamage += dealt;
    if (e.hp <= 0) this.killEnemy(e.id, yieldMult, false, srcId);
  }

  private eatEnemy(e: Enemy, byId?: number): void {
    this.biomass += B.biomassPerEat;
    if (enemySpec(e.kind).caste === 'royal') this.stats.royalsEaten += 1;
    this.events.push({ kind: 'eaten', enemy: e.kind });
    this.killEnemy(e.id, 0, true, undefined, undefined, byId);
  }

  /**
   * `creditId` (Oct 1 2026): the limb a kill by poison, fire, a cloud or a swallow is put down to, IN THE
   * RUN STATS ONLY (killsByFamily). The limb's own `kills` (what Consort's Favour and the scripted player
   * read) still counts its direct hits alone, so crediting changes no play: it only stops a Maw or a Blight
   * Vent showing 0 kills in the measures (notes/limb-codex/).
   */
  private killEnemy(id: number, yieldMult: number, eaten: boolean, srcId?: number, cause?: string, creditId?: number): void {
    const i = this.enemies.findIndex((e) => e.id === id);
    if (i < 0) return;
    const e = this.enemies[i];
    const spec = enemySpec(e.kind);
    this.enemies.splice(i, 1);
    // Run stats for the campaign's goals.
    const why = cause ?? (eaten ? 'eaten' : srcId !== undefined ? 'limb' : 'other');
    const st = this.stats;
    st.kills[e.kind] = (st.kills[e.kind] ?? 0) + 1;
    st.killsByCause[why] = (st.killsByCause[why] ?? 0) + 1;
    this.waveKillsByCause[why] = (this.waveKillsByCause[why] ?? 0) + 1;
    const killer = srcId !== undefined ? this.towers.find((t) => t.id === srcId) : undefined;
    if (killer) {
      st.killsByFamily[killer.family] = (st.killsByFamily[killer.family] ?? 0) + 1;
      killer.kills += 1;
    } else if (creditId !== undefined) {
      const credited = this.towers.find((t) => t.id === creditId);
      if (credited) st.killsByFamily[credited.family] = (st.killsByFamily[credited.family] ?? 0) + 1;
      else if (this.creditFamilyOf.has(creditId)) {
        const fam = this.creditFamilyOf.get(creditId)!;
        st.killsByFamily[fam] = (st.killsByFamily[fam] ?? 0) + 1;
      }
    }
    if (why === 'burn' && this.gates.some((g) => dist(this.cellCenter(g), e.pos) <= 4 * this.cfg.cellPx)) st.gateBurnKills += 1;
    if (e.kind === 'royal') {
      this.royalsKilled += 1;
      this.checkDirective();
    }
    // What this body carries for the creep to digest (banked only then: types.ts Corpse).
    const body: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
    // Royal Jelly (a hobby gene): every royal, killed or eaten, pays royal points.
    if (spec.caste === 'royal' && this.geneMods.royalJelly > 0) body.royal += this.geneMods.royalJelly;
    // Hitchhiker Spores (a hobby gene): the creep's own kills bud nodes.
    if (why === 'creep' && this.geneMods.creepNodeEvery > 0 && ++this.creepKillCount % this.geneMods.creepNodeEvery === 0) {
      this.nodeStock.push(this.plainStrain());
    }
    this.threatKills += spec.threatOnKill * B.killThreatScale;
    this.biomass += B.biomassPerKill;
    // A splitter killed by damage bursts into its children; eaten whole, it doesn't.
    if (spec.splitInto && !eaten) {
      for (let i = 0; i < spec.splitInto.count; i++) this.spawnMinion(spec.splitInto.kind, e.pos);
    }
    // A dead thief drops what it stole.
    if (e.stole !== undefined && e.stole > 0) {
      this.meat.war += e.stole;
      this.events.push({ kind: 'meat-recovered', amount: e.stole });
    }
    // A dead collector drops the limb: it re-roots where it stood, traits and
    // targeting intact — or, if that ground is taken now, its cost comes back.
    if (e.carrying) {
      st.limbsRecovered = (st.limbsRecovered ?? 0) + 1;
      const c = e.carrying;
      const ground = this.cellsFromFirst(c.cell, c.family, towerSpec(c.family).shape ? (c.facing ?? 'S') : c.facing) ?? [c.cell];
      if (ground.every((g) => !this.occupied.has(g) && g !== this.map.coreCell)) {
        if (ground.length > 1) {
          // A big limb re-roots as it is built: on all of its cells, in the middle of them.
          const tower = this.addTower(c.family, c.cell, c.pips, c.facing, ground);
          tower.priority = c.priority;
          tower.casteFocus = c.casteFocus;
        } else {
        const spec = towerSpec(c.family);
        const tower: Tower = {
          id: this.nextId++, family: c.family, pos: this.cellCenter(c.cell), cell: c.cell,
          hp: spec.maxHp, maxHp: spec.maxHp, pips: c.pips, cooldown: 0, kills: 0,
          priority: c.priority, casteFocus: c.casteFocus,
        };
        tower.maxHp = this.statsOf(tower).maxHp;
        tower.hp = tower.maxHp;
        this.towers.push(tower);
        this.occupied.set(c.cell, { kind: 't', id: tower.id });
        this.refreshRouting();
        }
        this.events.push({ kind: 'tower-recovered', family: c.family, refunded: false });
      } else {
        const cost = towerSpec(c.family).cost;
        for (const k of ['war', 'science', 'royal'] as Caste[]) this.meat[k] += cost[k] ?? 0;
        this.events.push({ kind: 'tower-recovered', family: c.family, refunded: true });
      }
    }
    this.events.push({ kind: 'kill', enemy: e.kind, caste: spec.caste });
    if (!eaten && yieldMult > 0) {
      const slot = this.map.slots[slotOfCell(this.map, this.cellAt(e.pos.x, e.pos.y))];
      const district = slot && slot.feature === 'meat' && spec.caste === 'war' ? 1.25 : 1;
      // Meat Press: a pressed limb's war-caste kills pay SCIENCE instead.
      const killer = srcId !== undefined ? this.towers.find((t) => t.id === srcId) : undefined;
      const press = killer ? this.pressOf(killer) : null;
      const pressed = spec.caste === 'war' && press !== null;
      // DOUBLING: every press layer past the first adds +50% to the pressed pay.
      const pressMult = pressed ? 1 + B.pressExtraLayer * (press.layers - 1) + press.bonus : 1;
      body[pressed ? 'science' : spec.caste] += Math.round(spec.meat * yieldMult * district * this.entranceMeatMult * pressMult);
      // Royal Press: every Nth pressed kill also pays a royal point.
      if (pressed && killer && press.royalEvery > 0) {
        killer.pressed = (killer.pressed ?? 0) + 1;
        if (killer.pressed % press.royalEvery === 0) body.royal += 1;
      }
    }
    // Eaten whole (a Maw): the asset digests it itself, so its meat is banked now. Otherwise the body falls
    // where it died and waits for the creep.
    if (eaten) this.bankMeat(body);
    else this.layCorpse(e, body);
  }

  /** Bank meat the creep (or a Maw) has digested: the wallet, the science tally and the HUD's tick. */
  private bankMeat(meat: Record<Caste, number>): void {
    for (const c of ['war', 'science', 'royal'] as Caste[]) {
      const n = meat[c];
      if (n <= 0) continue;
      this.meat[c] += n;
      this.digested[c] += n;
      if (c === 'science') {
        this.scienceBanked += n;
        this.checkDirective();
      }
      this.events.push({ kind: 'banked', caste: c, amount: n });
    }
  }

  /** A body falls where it died; past a cell's or the board's cap the oldest merge into heaps (meat summed). */
  private layCorpse(e: Enemy, meat: Record<Caste, number>): void {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    this.corpses.push({ id: this.nextId++, unitId: e.id, kind: e.kind, pos: { ...e.pos }, cell, meat, born: this.time });
    // Only bodies still lying count toward the caps: one already dissolving is nearly gone.
    const lying = (c: Corpse) => c.digest === undefined && !c.heap;
    const here = this.corpses.filter((c) => c.cell === cell && lying(c));
    if (here.length > B.corpseCellCap) this.mergeIntoHeap(here[0]);
    let loose = this.corpses.filter(lying);
    while (loose.length > B.corpseBoardCap) {
      this.mergeIntoHeap(loose[0]);
      loose = this.corpses.filter(lying);
    }
  }

  /** Fold one body into its cell's heap (made from it if the cell has none yet). Nothing it carried is lost. */
  private mergeIntoHeap(c: Corpse): void {
    const heap = this.corpses.find((h) => h.heap && h.cell === c.cell && h.digest === undefined);
    if (!heap) {
      c.heap = 1;
      c.kinds = [c.kind];
      return;
    }
    for (const k of ['war', 'science', 'royal'] as Caste[]) heap.meat[k] += c.meat[k];
    heap.heap = (heap.heap ?? 1) + 1;
    if ((heap.kinds ??= [heap.kind]).length < 4) heap.kinds.push(c.kind);
    this.corpses.splice(this.corpses.indexOf(c), 1);
  }

  /** The creep digests what lies on it: a body's fall, then its dissolve, then its meat is banked. */
  private updateCorpses(): void {
    if (this.corpses.length === 0) return;
    const done = B.corpseFallSeconds + B.corpseDigestSeconds;
    const keep: Corpse[] = [];
    for (const c of this.corpses) {
      if (c.digest === undefined) {
        if (!this.isCreeped(c.cell)) { c.waited = true; keep.push(c); continue; }
        c.digest = 0;
      }
      c.digest += DT;
      if (c.digest < done) { keep.push(c); continue; }
      this.bankMeat(c.meat);
      if (c.waited) this.stats.bodiesReclaimed = (this.stats.bodiesReclaimed ?? 0) + (c.heap ?? 1);
      this.events.push({ kind: 'digested', corpse: c.id, pos: { ...c.pos }, meat: { ...c.meat }, bodies: c.heap ?? 1 });
    }
    this.corpses = keep;
  }

  /** Meat lying unclaimed on the board right now, by caste (bodies off the creep; the measures and the HUD read it). */
  unclaimedMeat(): Record<Caste, number> {
    const out: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
    for (const c of this.corpses) if (c.digest === undefined) for (const k of ['war', 'science', 'royal'] as Caste[]) out[k] += c.meat[k];
    return out;
  }
}
