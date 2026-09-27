/** Shared sim types. This module (and everything under src/sim/) must never import rendering code. */

export type Caste = 'war' | 'science' | 'royal';

export type TowerFamily =
  | 'spitter' | 'burster' | 'lasher' | 'maw' | 'spine' | 'lure'
  | 'tangler' | 'blighter' | 'impaler' | 'choir' | 'sling'
  | 'brood' | 'swamp' | 'frond' | 'lobber' | 'mister' | 'ocular' | 'prism'
  | 'bombard' | 'ward' | 'quill' | 'skipper' | 'net' | 'ember' | 'conduit'
  | 'amp' | 'mosaic' | 'twin' | 'tap'
  | 'mitosis' | 'capacitor' | 'boomerang' | 'press' | 'reliquary';

/** What a limb can shoot at. Fliers are only reachable by 'air'/'both' limbs. */
export type HitsLayer = 'ground' | 'air' | 'both';

/**
 * THE PAYLOAD (Collins, Sep 27 2026: "nothing should ever do nothing"). Every
 * limb touches the hive through a payload — its shots, a swamp's contact, a
 * wall's thorns, a broodling's bite, a lobbed shell, a thrown clot, a pheromone
 * cloud — and EVERY cannibalize pip modifies that payload. So a pip is never
 * dead weight on an effect producer: it changes what the effect does.
 */
export interface HitFx {
  srcId: number;
  damage: number;
  yieldMult: number;
  capBonus: number;
  slowMult: number;
  slowDur: number;
  poisonDps: number;
  poisonDur: number;
  /** BURN: contagious fire — a burning body ignites its neighbours. Lights up the cloaked. */
  burnDps: number;
  burnDur: number;
  shred: number;
  shredDur: number;
  chains: number;
  knock: number;
  /** Swamp pips: anything left at or below this hp after the hit is digested outright. */
  execute: number;
  /** Lure pips: dps of the toxic pheromone cloud the hit leaves behind (also reveals cloaked). */
  cloud: number;
  /** Spine pips: a kill leaves caltrops (a mini-wall) with this much hp. */
  caltrop: number;
  /** Ocular pips: bonus damage fraction vs support castes. */
  supportDmg: number;
  /** Net pips: seconds a struck flier is dragged to the ground. */
  grounding: number;
  /** Skipper pips: the impact echoes this many more times further along its line. */
  skips: number;
}

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
  /** What it can shoot (default 'both'). */
  hits?: HitsLayer;
  /** Reveals cloaked enemies within this radius for EVERY limb (detection aura). */
  detects?: number;
  /** Digestive swamp: a walk-through floor that bogs, burns and DIGESTS the weak. */
  swamp?: { dps: number; slow: number; execute: number; radius: number };
  /** Quill fan: each shot is this many pellets across `spread` radians. */
  pellets?: number;
  spread?: number;
  /** Skipping mortar: fires along its FACING only; the shell skips this many times. */
  skips?: number;
  /** Netcaster: struck fliers are dragged to the ground for this many seconds. */
  grounds?: number;
  /** Lure gland: pulses a toxic pheromone cloud onto the nearest street. */
  pheromone?: { dps: number; radius: number; interval: number };
  /** Ember sac: sprays a CONE (half-angle, radians) — every targetable body in it is hit. */
  cone?: number;
  /** Its FACING matters: set on placement (right-click rotates), shown as a field of fire. */
  directional?: boolean;
  /** Marrow conduit: copies every bonus within `gather` px into the limb it points at (within `reach`). */
  conduit?: { gather: number; reach: number };
  /**
   * COMBO ENGINE (science-priced): a directional limb that manipulates the
   * bonuses of the limb it points at. `reach` = pointing lane length.
   *   'funnel'  (conduit) — copies bonuses around it into the target (max 2 per type)
   *   'amplify' (amp)     — the target's bonus counts ×1.5, rounded down, per type
   *   'mosaic'  (mosaic)  — one bonus of EACH distinct type around it (max one per type)
   *   'twin'    (twin)    — the target fires ×2 projectiles (producers: ×2 output)
   *   'tap'     (tap)     — holds the target in STASIS; sacrificing the tap harvests the
   *                         target's bonuses and the tap never disappears (a bonus farm)
   */
  engine?: {
    kind: 'funnel' | 'amplify' | 'mosaic' | 'twin' | 'tap'
      | 'mitosis' | 'capacitor' | 'boomerang' | 'press' | 'reliquary';
    reach: number;
    gather?: number;
    /** Only limbs that fire real projectiles can be targeted (the boomerang). */
    projectileOnly?: boolean;
  };
  /** Picking the card gives a SECOND copy free (the reliquary is weak alone). */
  pair?: boolean;
  /** Hits set bodies burning at this dps for burnDur seconds. */
  burnDps?: number;
  burnDur?: number;
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
  /** Spore bombard: fires only at a player-set MARKER point (click it, click the map). */
  markerFire?: boolean;
  /** Ward membrane: projects a regenerating shield onto every OTHER limb in auraRadius. */
  wardShield?: number;
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
  /** Bombard: the cell it is ordered to shell (null/undefined = no orders, holds fire). */
  marker?: number;
  /** Shield pool (ward projection + membrane pips); absorbs harm before hp. */
  shield?: number;
  shieldMax?: number;
  lastHitAt?: number;
  /** Stunned by a sedation dart: holds fire until this sim time. */
  stunnedUntil?: number;
  /** Skipping mortar: the one direction it fires. */
  facing?: RootDir;
  /** Capacitor: shots banked while idle, spent at 400% speed when the hive arrives. */
  bank?: number;
}

/** Caltrops: a mini-wall of barbs a spine-pipped limb leaves where it kills. */
export interface Caltrop {
  id: number;
  pos: Vec;
  cell: number;
  hp: number;
  /** Chewers take this back per bite. */
  thorns: number;
  /** Rots away when this runs out. */
  ttl: number;
}

/** A lingering toxic pheromone cloud (lure gland pulses, lure-pipped impacts). */
export interface Cloud {
  id: number;
  pos: Vec;
  radius: number;
  ttl: number;
  dps: number;
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
  | 'cannon'
  | 'dartgun'
  | 'stalker'
  | 'shadewing'
  | 'ghostsapper'
  | 'infiltrator'
  | 'royal'
  | 'consort'
  | 'matron';

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
  /**
   * THE CANNON: walks to a firing position, DEPLOYS (braces, never moves again)
   * and lobs shells over blocks and walls until destroyed. War cannons shell
   * the nearest structure; science cannons pick the gap in your coverage and
   * fire sedation darts that STUN a limb (shields stop them).
   */
  cannon?: { range: number; interval: number; damage: number; aoe: number; stun?: number; ammo?: number };
  /** Invisible: only limbs with detection (or inside a detection aura) can TARGET it. Area effects still touch it. */
  cloaked?: boolean;
  /** Veil matron: every war body within this radius is CLOAKED while she lives. */
  veilAura?: number;
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
  /** Cannon: braced in its firing position (it never moves again). */
  deployed?: boolean;
  /** Cannon shots fired (science batteries carry a limited kit, then leave). */
  shotsFired?: number;
  /** Flier dragged down by a net: walks the streets (ground-targetable) until this time. */
  groundedUntil?: number;
  /** Cloaked body marked (pheromone, mist, fire): targetable by anyone until this time. */
  revealedUntil?: number;
  /** Status: burning at burnDps until burnUntil; spreads to neighbours on a pulse. */
  burnDps?: number;
  burnUntil?: number;
  burnSpreadAt?: number;
}

/** A lobbed shell in flight — the hive's cannons and the bombard both use these. */
export interface Shell {
  id: number;
  from: Vec;
  to: Vec;
  flight: number;
  ttl: number;
  damage: number;
  aoe: number;
  /** 'hive' shells hurt your structures; 'body' shells hurt the hive. */
  side: 'hive' | 'body';
  /** Sedation dart: stun seconds on the limb it lands on (shields block it). */
  stun?: number;
  /** Body shells: the firing limb's full payload. */
  fx?: HitFx;
  /** Direction skips travel after landing (default: the flight direction). */
  dir?: Vec;
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
  aoe: number;
  ttl: number;
  fromFamily: TowerFamily;
  /** The firing limb's full payload (damage + every inherited verb). */
  fx: HitFx;
  /** Which layer this shot can strike. */
  hits: HitsLayer;
  /** Impaler: remaining extra enemies this shot may pass through. */
  pierceLeft?: number;
  /** Enemies already hit by this piercing shot (hit once each). */
  hitIds?: number[];
  /** Boomerang: after its first hit the shot flies back here, striking everything on the way. */
  returnTo?: Vec;
  returned?: boolean;
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
  /** A free card (the reliquary's pair): costs nothing and is not replaced when used. */
  free?: boolean;
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
  | { kind: 'cannon-deployed'; enemy: EnemyKind }
  | { kind: 'budded'; family: TowerFamily }
  | { kind: 'relic-banked'; family: TowerFamily; pips: number }
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
  | { kind: 'build'; cardIndex: number; cell: number; cannibalizeTowerId?: number; facing?: RootDir }
  | { kind: 'butcher'; towerId: number }
  | { kind: 'set-priority'; towerId: number; mode?: TargetMode; caste?: CasteFocus }
  | { kind: 'set-marker'; towerId: number; cell: number }
  | { kind: 'set-facing'; towerId: number; dir: RootDir }
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
