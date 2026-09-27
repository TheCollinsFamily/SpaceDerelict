/** Shared sim types. This module (and everything under src/sim/) must never import rendering code. */

export type Caste = 'war' | 'science' | 'royal';

export type TowerFamily =
  | 'spitter' | 'burster' | 'lasher' | 'maw' | 'spine' | 'lure'
  | 'tangler' | 'blighter' | 'impaler' | 'choir' | 'sling'
  | 'brood' | 'pit' | 'frond' | 'lobber' | 'mister' | 'ocular' | 'prism';

/** Player-chosen targeting for a limb (click the tower to set it). */
export type TargetMode = 'auto' | 'first' | 'strongest' | 'weakest' | 'focus';
export type CasteFocus = 'any' | Caste;

export type OrganId = 'heart' | 'brain' | 'gland' | 'root';

export type GlandMode = 'calm' | 'lure' | 'challenge';

/** Compass direction a tendril root grows its creep lobe toward. */
export type RootDir = 'N' | 'E' | 'S' | 'W';

/** A live creep origin besides the core: a hurled patch, a root lobe, a seeping limb. */
export interface CreepSource {
  id: number;
  kind: 'patch' | 'root' | 'seep';
  cell: number;
  /** Sim time the source appeared (patches grow from it). */
  bornAt: number;
  /** patch: starting radius. seep: fixed radius. root: base radius around the organ. */
  radius: number;
  /** root only: lobe direction. */
  dir?: RootDir;
  /** root: owning organ id. seep: owning tower id. */
  ownerId?: number;
}

export interface Vec {
  x: number;
  y: number;
}

export interface TowerSpec {
  family: TowerFamily;
  name: string;
  /** Base deck weight for card draws. */
  weight: number;
  cost: Partial<Record<Caste, number>>;
  range: number;
  /** Shots per second (0 = does not attack). */
  rate: number;
  damage: number;
  /** AoE radius on hit (0 = single target). */
  aoe: number;
  maxHp: number;
  /** Passive interest contribution (lure gland). */
  interest: number;
  /** Maw: enemies at or below this HP are eaten whole for biomass. */
  eatThreshold: number;
  /** Advanced towers get boosted by the brain node's draw-odds shift. */
  advanced: boolean;
  /** Tangler: hit enemies move at this fraction of speed for slowDur seconds. */
  slowMult?: number;
  slowDur?: number;
  /** Blighter: hits apply this poison DPS for poisonDur seconds (ignores armor caps). */
  poisonDps?: number;
  poisonDur?: number;
  /** Impaler: the shot flies through, hitting several in a line, and ignores armor caps. */
  pierce?: boolean;
  /** Choir: +this fraction fire rate to other towers within auraRadius. */
  rateAura?: number;
  auraRadius?: number;
  /** Broodmother: keeps this many broodlings alive in the streets around it. */
  broodCount?: number;
  /** Digestive pit: sits IN the street, passable; roots and digests what crosses it. */
  pitTrap?: boolean;
  /** Galvanic frond: hits arc to this many extra enemies (falling damage per hop). */
  chains?: number;
  /** Bile lobber: player-aimed volley — armed by clicking it, like the sling. */
  aimedVolley?: boolean;
  /** Caustic mister: hits SHRED armor — every source's hits get +shred cap for shredDur. */
  shred?: number;
  shredDur?: number;
  /** Ocular stalk: board-wide hitscan that prefers support castes (drummer/tender/bomber). */
  sniper?: boolean;
  /** Arc prism: focus-fire beam; idle prisms in link range relay charge to firing ones. */
  prismLink?: number;
}

/** What a donor family contributes when cannibalized into a new tower. */
export interface ModPip {
  family: TowerFamily;
}

export interface Tower {
  id: number;
  family: TowerFamily;
  pos: Vec;
  cell: number;
  hp: number;
  maxHp: number;
  /** Inherited pips, in acquisition order. Deterministic, visible, uncapped by design. */
  pips: ModPip[];
  cooldown: number;
  kills: number;
  /** Player-chosen targeting (default 'auto'). */
  priority?: TargetMode;
  casteFocus?: CasteFocus;
  /** Focus-fire memory: the last target and how many shots in a row it has taken. */
  lastTargetId?: number;
  streak?: number;
}

export interface OrganSpec {
  id: OrganId;
  name: string;
  cost: Partial<Record<Caste, number>>;
  maxHp: number;
}

export interface Organ {
  id: number;
  organ: OrganId;
  pos: Vec;
  cell: number;
  hp: number;
  maxHp: number;
  glandMode: GlandMode;
  /** Tendril root: which way the lobe grows (cycles on click). */
  rootDir?: RootDir;
}

export type EnemyKind =
  | 'responder'
  | 'militia'
  | 'skitterling'
  | 'soldier'
  | 'elite'
  | 'flier'
  | 'sapper'
  | 'phalanx'
  | 'drummer'
  | 'bomber'
  | 'tunneler'
  | 'tender'
  | 'splitter'
  | 'mortar'
  | 'carapace'
  | 'researcher'
  | 'thief'
  | 'royal'
  | 'consort';

export interface EnemySpec {
  kind: EnemyKind;
  caste: Caste;
  hp: number;
  speed: number;
  damage: number;
  /** Attacks per second when latched onto a structure. */
  rate: number;
  meat: number;
  /** Threat added to the ladder when this enemy is killed. */
  threatOnKill: number;
  /**
   * RISK: the danger weight of one body (Collins, Sep 26 2026). Waves are a
   * risk budget: as the clock scales the budget up, cheap ranks multiply at
   * full rate while risky specialists grow slowly — count scales by
   * riskBaseline/risk. Risk is also the wave's telegraphed danger number.
   */
  risk: number;
  /** Flies straight over blocks and walls to the core; cannot be blocked. */
  flies?: boolean;
  /** Climbs blocks to chew towers directly; perches are not safe from it. */
  sapper?: boolean;
  /** Shield-wall: incoming damage is capped per hit — rapid fire beats big hits. */
  armorCap?: number;
  /** War-drummer: nearby hive units march faster while it lives — kill it first. */
  speedAura?: boolean;
  /** Charges the nearest structure and detonates against it — walls are not safe. */
  bomber?: boolean;
  /** Spawns burrowed and untargetable; surfaces PAST the outer defenses. */
  tunneler?: boolean;
  /** Heals nearby hive units on a pulse — a priority target. */
  healer?: boolean;
  /** Splits into children when KILLED by damage (eaten whole = no split). */
  splitInto?: { kind: EnemyKind; count: number };
  /** Stands off and bombards structures from range instead of latching. */
  standoff?: boolean;
  /** Ablative shell: blocks this many HITS outright (poison seeps through). */
  hitShield?: number;
  /** Science caste: sneaks to the creep, steals banked meat, flees with it. */
  thief?: boolean;
  /** Royal presence: war-caste bodies near it hit harder and shrug off damage. */
  royalAura?: boolean;
  /** Royal consort: promotes a nearby war body one rank every `interval` s. */
  promotes?: { interval: number };
  /**
   * Science caste default: SMART. Routes around your gun coverage to your most
   * vulnerable limb, sedates it (drains its hp) and carries it off.
   */
  stealsLimbs?: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  pos: Vec;
  hp: number;
  maxHp: number;
  /** Structure currently being attacked (tower/organ id, or -1 for the core, or null). */
  targetId: number | null;
  targetIsOrgan: boolean;
  attackCooldown: number;
  /** Researchers: seconds of studying remaining; they leave when it hits 0. */
  studyLeft: number;
  leaving: boolean;
  /** Status: moving at slowMult fraction of speed until slowUntil (sim time). */
  slowUntil?: number;
  slowMult?: number;
  /** Status: taking poisonDps until poisonUntil. Poison ignores armor caps. */
  poisonDps?: number;
  poisonUntil?: number;
  /** Tunneler: underground and untargetable until it surfaces. */
  burrowed?: boolean;
  /** Tunneler surfaces once its flow-distance to the core drops below this. */
  surfaceFlowDist?: number;
  /** Tender: cooldown between heal pulses. */
  auxCooldown?: number;
  /** Status: armor SHREDDED — every hit against this enemy gets +shredAmount cap until shredUntil. */
  shredUntil?: number;
  shredAmount?: number;
  /** Carapace: hits left on the ablative shell. */
  hitShield?: number;
  /** Thief: war meat it is carrying away (recovered if it dies before escaping). */
  stole?: number;
  /** Collector: the limb it is extracting, and the limb it is carrying off once taken. */
  extractId?: number;
  carrying?: { family: TowerFamily; pips: ModPip[]; cell: number; priority?: TargetMode; casteFocus?: CasteFocus };
}

/** A broodling: the mother's spawn, fighting in the streets on your side. */
export interface Broodling {
  id: number;
  motherId: number;
  pos: Vec;
  hp: number;
  maxHp: number;
  cooldown: number;
}

export interface Projectile {
  id: number;
  pos: Vec;
  vel: Vec;
  damage: number;
  aoe: number;
  ttl: number;
  fromFamily: TowerFamily;
  /** Meat multiplier inherited from the firing tower's maw pips. */
  yieldMult: number;
  /** Status payload carried from the firing tower's stats. */
  slowMult?: number;
  slowDur?: number;
  poisonDps?: number;
  poisonDur?: number;
  /** Impaler: remaining extra enemies this shot may pass through. */
  pierceLeft?: number;
  /** Enemies already hit by this piercing shot (hit once each). */
  hitIds?: number[];
  /** Added to the target's armor cap before capping (Infinity = ignore caps). */
  capBonus?: number;
  /** Frond pips: arcs jumping off each hit to nearby enemies. */
  chains?: number;
  /** Mister: armor shred applied on hit. */
  shred?: number;
  shredDur?: number;
  /** Lobber pips: knockback px along the shot's direction on hit. */
  knock?: number;
  /** Pit pips: hard root applied on hit (seconds at ~zero speed). */
  rootDur?: number;
}

export interface Drop {
  id: number;
  pos: Vec;
  caste: Caste;
  amount: number;
  /** Seconds until banked. */
  ttl: number;
}

export interface CardInstance {
  id: number;
  family: TowerFamily;
}

export type Phase = 'growth' | 'siege' | 'draft';

export type Outcome = 'playing' | 'won' | 'lost';

export type SimEvent =
  | { kind: 'built'; family: TowerFamily; pips: number }
  | { kind: 'organ-built'; organ: OrganId }
  | { kind: 'cannibalized'; donor: TowerFamily; into: TowerFamily }
  | { kind: 'butchered'; family: TowerFamily; refund: number }
  | { kind: 'clot-hurled'; cell: number }
  | { kind: 'clot-landed'; cell: number }
  | { kind: 'bile-landed'; cell: number; hits: number }
  | { kind: 'broodling-lost'; motherId: number }
  | { kind: 'kill'; enemy: EnemyKind; caste: Caste }
  | { kind: 'banked'; caste: Caste; amount: number }
  | { kind: 'wave-start'; tier: number; wave: number; counts: Partial<Record<EnemyKind, number>>; sides: string; risk: number }
  | { kind: 'meat-stolen'; amount: number }
  | { kind: 'meat-recovered'; amount: number }
  | { kind: 'tower-stolen'; family: TowerFamily }
  | { kind: 'tower-recovered'; family: TowerFamily; refunded: boolean }
  | { kind: 'promoted'; from: EnemyKind; to: EnemyKind }
  | { kind: 'royal-incoming' }
  | { kind: 'researchers-arrive'; count: number }
  | { kind: 'structure-lost'; what: string }
  | { kind: 'eaten'; enemy: EnemyKind }
  | { kind: 'won' }
  | { kind: 'lost' }
  | { kind: 'discarded'; family: TowerFamily }
  | { kind: 'wave-cleared'; wave: number; bonus: number }
  | { kind: 'draft-open' }
  | { kind: 'plate-drafted'; name: string; feature: string };

export type Command =
  | { kind: 'build'; cardIndex: number; cell: number; cannibalizeTowerId?: number }
  | { kind: 'butcher'; towerId: number }
  | { kind: 'set-priority'; towerId: number; mode?: TargetMode; caste?: CasteFocus }
  | { kind: 'sling-throw'; towerId: number; cell: number }
  | { kind: 'bile-throw'; towerId: number; cell: number }
  | { kind: 'cycle-root'; organInstanceId: number }
  | { kind: 'build-organ'; organ: OrganId; cell: number }
  | { kind: 'cycle-gland'; organInstanceId: number }
  | { kind: 'royal-surge' }
  | { kind: 'discard'; cardIndex: number }
  | { kind: 'choose-plate'; index: number }
  | { kind: 'call-early' };

/** The deployment order: the win condition, issued by command. */
export type Directive =
  | { kind: 'hold'; waves: number }        // survive the local response for N waves
  | { kind: 'royal'; count: number }       // destroy the royal(s)
  | { kind: 'harvest'; science: number };  // bank a science-meat sample quota

export interface SimConfig {
  gridW: number;
  gridH: number;
  cellPx: number;
  seed: number;
  /** Force a directive (tests, URL param); otherwise seeded-random. */
  directive?: Directive;
  /** Gene ids spliced on the ship — persistent meta-progression. */
  genes?: string[];
  /** Starting entrances (1-3). More is a difficulty wager paid in richer meat. */
  entrances?: number;
}
