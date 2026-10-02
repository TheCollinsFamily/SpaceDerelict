import type { BoardSnapshot } from './boardSnapshot';
/** Shared sim types. This module (and everything under src/sim/) must never import rendering code. */
import type { DecreeId } from '../../content/royal';

export type Caste = 'war' | 'science' | 'royal';

export type TowerFamily =
  | 'spitter' | 'burster' | 'lasher' | 'maw' | 'spine' | 'lure'
  | 'tangler' | 'blighter' | 'impaler' | 'choir' | 'sling'
  | 'brood' | 'swamp' | 'frond' | 'lobber' | 'mister' | 'ocular' | 'prism'
  | 'bombard' | 'ward' | 'quill' | 'skipper' | 'net' | 'ember' | 'conduit'
  | 'amp' | 'mosaic' | 'twin' | 'tap'
  | 'mitosis' | 'capacitor' | 'boomerang' | 'press' | 'reliquary' | 'lance' | 'cage'
  | 'sprout' | 'hatch';

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
  /** Not the limb's own hit (a broodling's bite): it does not break a pacifist wave (DESIGN: brood, swamps and creep only). */
  quiet?: boolean;
  /** Cage pips: hits root the target this long. */
  rootDur?: number;
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

/** Organs of the organ stage (content/underground.ts): themes unlock limbs, zones boost organs, roots connect. */
export type OrganId = 'forge' | 'venom' | 'gut' | 'nerve' | 'lattice' | 'womb' | 'marrow' | 'resonance'
  | 'heart' | 'brain' | 'gland' | 'root' | 'atrophy'
  | 'bladder' | 'pacemaker' | 'budder' | 'cyst' | 'swell' | 'catapult' | 'mire' | 'acid' | 'runner'
  | 'scaffold' | 'seeder' | 'mule' | 'infestor' | 'harrier';

export type GlandMode = 'calm' | 'lure' | 'challenge';

/** Compass direction a tendril root grows its creep lobe toward. */
export type RootDir = 'N' | 'E' | 'S' | 'W';

/**
 * A creep node's STRAIN (Collins, Sep 28 2026): set by the creep organs touching
 * the spore bladder that grew it. Radius = cells of creep; reach = how far past
 * the creep it may be placed (and how far it spreads its one child); slow and
 * dps = what its creep does to ground enemies on it.
 */
export interface NodeStrain {
  radius: number;
  reach: number;
  slow: number;
  dps: number;
}

/** A live creep origin besides the core: a hurled patch, a root lobe, a seeping limb. */
export interface CreepSource {
  id: number;
  kind: 'patch' | 'root' | 'seep' | 'node' | 'line';
  cell: number;
  /** Sim time the source appeared (patches grow from it). */
  bornAt: number;
  /** patch: starting radius. seep: fixed radius. root: base radius around the organ. */
  radius: number;
  /** root only: lobe direction. */
  dir?: RootDir;
  /** root: owning organ id. seep: owning tower id. */
  ownerId?: number;
  /** node: its strain, hit points, when it matures, and whether it has spread its child. */
  strain?: NodeStrain;
  hp?: number;
  maxHp?: number;
  /** node: the waves-cleared count at which it matures (it must survive one wave). */
  matureAt?: number;
  spent?: boolean;
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
  /**
   * BROODMOTHER DEN ('brood'): her brood cap (the warriors a parked Broodmother keeps).
   * BROOD PIT ('hatch'): the warriors it keeps alive, born at the body and sent to its rally point.
   */
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
  /**
   * A BIG limb: the cells it stands on, [across, along], when it faces north or south; a
   * quarter turn swaps them. All of them must be one flat roof (or one street) that the
   * creep holds. Absent: one cell. (Collins, Sep 29 2026: towers over several squares "are
   * a core part of the strategy in tower defence".)
   */
  span?: [number, number];
  /**
   * A SHAPED limb (Collins, Oct 1 2026: "T-shaped (usually for very powerful area-effect things),
   * L-shaped (like an elbow shape)"): its cells as a polyomino from src/sim/footprint.ts SHAPES, turned
   * with its facing. Overrides `span`. Absent: `span`, or one cell.
   */
  shape?: import('./footprint').ShapeId;
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
    /** It works on EVERY limb touching its cells, edge to edge, not the one it points at (the amplifier, Oct 2 2026). */
    touch?: boolean;
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
  /** The cell it stands on; of a big limb, the first of its cells (the one nearest the north-west corner). */
  cell: number;
  /** A big limb: every cell it stands on. Absent: it stands on `cell` alone. */
  cells?: number[];
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
  /** Brood Pit / Broodmother Den: the rally point (a cell) its new warriors or Broodmother walk to. */
  rally?: number;
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
  /** Evolution path, one letter per stage bought (Tower Dominion style): e.g. ['A','B']. */
  upgrades?: UpgradeChoice[];
  /** Max hp grown by healing past full (brood pips), kept for life. */
  grownHp?: number;
  /** Meat press: pressed kills so far (every Nth pays a royal point on a Royal Press). */
  pressed?: number;
  /** Reliquary: the wave it last raised its limb (Resurrection/Phoenix: once per wave). */
  rebornWave?: number;
  /** Trap cage: royals captured so far. */
  captures?: number;
  /** ROYAL DECREE: crowns worn (content/royal.ts): every other limb near it takes less harm and hits harder. */
  crowns?: number;
  /** Consort's Favour: promotions received (each one a pip of its own family, already in `pips`). */
  promotions?: number;
  /** SURGERY UNDER FIRE: grafted with eaten bonuses during a siege, it holds fire and bleeds until this sim time. */
  graftUntil?: number;
  /** Its kill count when the current wave started (Consort's Favour picks the wave's best killer). */
  waveKillsAt?: number;
}

export type UpgradeChoice = 'A' | 'B';

/** Numeric stat keys an evolution may add to or multiply (see towerStats). */
export type UpgradeStat =
  | 'aoe' | 'maxHp' | 'eatThreshold' | 'interest' | 'slowMult' | 'slowDur' | 'poisonDps' | 'poisonDur'
  | 'burnDps' | 'burnDur' | 'shred' | 'shredDur' | 'chains' | 'execute' | 'skips' | 'extraTargets'
  | 'grounding' | 'streakRamp' | 'extraBroodlings' | 'extraMothers' | 'yieldMult' | 'knock'
  // Engine knobs (read by the engine code paths; defaults in towerStats).
  | 'gather' | 'engineCap' | 'ampFactor' | 'ampExtraLayers' | 'mosaicCopies' | 'twinPower'
  | 'tapCopies' | 'tapWar' | 'budCount' | 'budRing' | 'budPips' | 'capSpeed' | 'capCharge'
  | 'capTrickle' | 'returnLegs' | 'returnDmg' | 'pressBonus' | 'pressRoyalEvery' | 'relicCopies'
  | 'rebirth' | 'poolMult' | 'captureAt' | 'captures' | 'rootDur';

/** One side of one evolution stage. Every option CHANGES the limb (never "+5%"). */
export interface UpgradeOption {
  name: string;
  text: string;
  /** Multipliers folded into the payload bases before rate/damage/range derive. */
  tempo?: number;
  potency?: number;
  reach?: number;
  /** Verbs the evolution grows into the limb (count as its own pips, amplifiable). */
  pips?: TowerFamily[];
  /** For engines: verbs pushed into the limb the engine points at. */
  targetPips?: TowerFamily[];
  add?: Partial<Record<UpgradeStat, number>>;
  mult?: Partial<Record<UpgradeStat, number>>;
  set?: Partial<{ hitsAir: boolean; hitsGround: boolean; trueSight: boolean; pierce: boolean; ampRoundUp: boolean; gentleTap: boolean; targetSelf: boolean }>;
}

/** A family's three stages, each an [A, B] pair. */
export type UpgradeTree = [[UpgradeOption, UpgradeOption], [UpgradeOption, UpgradeOption], [UpgradeOption, UpgradeOption]];

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
  /** The limb that made it (a kill by it is put down to that limb in the run stats). */
  srcId?: number;
}

/** A grown organ: a shaped footprint on the organ-stage board. */
export interface Organ {
  id: number;
  organ: OrganId;
  /** Anchor cell (board index) of its footprint. */
  cell: number;
  /** Quarter turns applied to its shape (0-3). */
  rot: number;
  /** Theme organs power their limbs by level (1 when grown). */
  level: number;
  /** Board cells its footprint covers. */
  cells: number[];
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
  | 'flametrooper'
  | 'aegis'
  | 'lensbearer'
  | 'ghostsapper'
  | 'infiltrator'
  | 'engineer'
  | 'fieldstation'
  | 'sciturret'
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
  /** The FLAMETROOPER (Oct 2 2026): hunts your walking units in sight first and hoses them in a short cone (unitDps); with none in sight it marches on limbs and the core at its weak spec.damage. */
  flamer?: { sight: number; range: number; unitDps: number; coneCos: number };
  /**
   * SCIENCE FORWARD BASES (Collins, Oct 2 2026: "give the science faction units that can build spawning locations, and
   * even their own towers if you don't deal with them, and then you need to mount attacks on these areas"). An
   * ENGINEER walks out past your creep and raises a FIELD STATION; the station spawns parties nearer you and, left
   * alone, grows (bigger parties, escorts, then turrets). A fixed kind never walks: it is a structure the hive owns.
   */
  engineer?: boolean;
  fixed?: 'station' | 'turret';
  /** A science turret: darts your walking units (damage) and stuns limbs (stun s) in reach. */
  turret?: { range: number; interval: number; damage: number; stun: number };
  /** Veil matron: every war body within this radius is CLOAKED while she lives. */
  veilAura?: number;
  /**
   * A DOME BEARER (Collins, Oct 2 2026: "a unit for both the warriors and the science team that gives a shield around
   * it in a dome that takes a certain amount of damage before breaking ... but the catch is it's ineffective against
   * damage from units (who automatically target shield units first)"). The dome covers every body of its side within
   * `radius` (the bearer too) and soaks damage from your LIMBS (shots, splash, clouds, creep, fire) out of a `pool`
   * (grown by tier); empty, it breaks and comes back full `recharge` s later if the bearer lives. Damage from your
   * WALKING UNITS passes straight through it, and your units go for a bearer first.
   */
  dome?: { radius: number; pool: number; recharge: number };
}

export interface Enemy {
  /**
   * An ENGINEER's state (Sim.updateEngineer): muster (sets out with its escort), travel (to its site or to the
   * station it will tend), flee (attacked without cover, or your strike force arrived), build, tend. A station
   * it is building or tending: tendsStation. Re-plans so far (it gives up after a few). Fleeing until (s).
   */
  engState?: 'muster' | 'travel' | 'flee' | 'build' | 'tend';
  tendsStation?: number;
  replans?: number;
  fleeUntil?: number;
  /** Its hp a beat ago (it knows when it is being hit). */
  lastHp?: number;
  /** An escort: the engineer it walks with (released when the engineer builds or dies). */
  escortOf?: number;
  /** A station under construction: how far (0..1). It is weak while it builds and does nothing until done. */
  buildProgress?: number;
  /** A turret's last dart: where it struck (for the renderer). */
  dartTo?: Vec;
  /** An engineer: the street cell it is raising a field station on, and how far along (s). */
  siteCell?: number;
  buildT?: number;
  /** A field station: its stage (1..3), its age (s), when it next sends a party (s), turrets it has raised, and whether
   *  it has sent its squad into this siege. A turret: the station that raised it. */
  stationStage?: number;
  stationAge?: number;
  stationTimer?: number;
  stationTurrets?: number;
  stationSiegeSent?: number;
  stationId?: number;
  /** A field station: the block it takes over (Sim.stationBlock), nearest its site first. */
  blockCells?: number[];
  /** A Flametrooper hosing your units: where its stream reaches this tick (for the renderer). */
  flameTo?: Vec;
  id: number;
  kind: EnemyKind;
  /** A martyr (the Sleepers): detonates among its own at this sim time. */
  sleeperAt?: number;
  /** Mating musk: this body has already paired off. */
  mated?: boolean;
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
  /** The limbs whose poison / fire it carries (run stats credit a kill by them; no play reads them). */
  poisonSrc?: number;
  burnSrc?: number;
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
  /** A dome bearer: what is left of its dome, its full pool, when a broken one comes back (s), when it last soaked a hit (s). */
  domeHp?: number;
  domeMax?: number;
  domeDownUntil?: number;
  domeHitAt?: number;
  /** Thief: war meat it is carrying away (recovered if it dies before escaping). */
  stole?: number;
  /** Collector: the limb it is extracting, and the limb it is carrying off once taken. */
  extractId?: number;
  carrying?: { family: TowerFamily; pips: ModPip[]; cell: number; facing?: RootDir; priority?: TargetMode; casteFocus?: CasteFocus };
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

/**
 * ORDERS for your own walking units (Collins, Oct 1 2026: Broodmothers and brood output are
 * "selectable" and "orderable"). move: walk there, ignoring the hive on the way; attack: walk
 * there, fighting what comes within reach on the way; hold: stand and fight only what is in bite
 * reach; return: walk back to the body and guard it; guard: clear the orders (back to the limb's
 * rally point, or a Broodmother's warrior back to her skirts).
 */
export type UnitOrder =
  /** enter: the walk to the tunnel's mouth a group order put in front (src/sim/groups.ts): at the mouth the unit goes in. */
  | { kind: 'move'; to: Vec; enter?: 'head' | 'body' }
  | { kind: 'attack'; to: Vec }
  | { kind: 'hold' }
  | { kind: 'return' }
  | { kind: 'guard' };

/** What a unit fights with once the limb that made it is gone (frozen when it was born). */
export interface BroodSnap {
  potency: number;
  tempo: number;
  reach: number;
  fx: HitFx;
}

/**
 * A BROODMOTHER (Collins, Oct 1 2026): born of a Broodmother Den, a big mobile unit of yours.
 * brood: she stays where she is and broods warriors around her; fight: she walks, bites and
 * casts a NET that slows the hive (on its own on a cooldown, or aimed by the player).
 */
export interface Broodmother {
  id: number;
  denId: number;
  pos: Vec;
  hp: number;
  maxHp: number;
  mode: 'brood' | 'fight';
  /** Her post: she fights the hive near it and drifts back to it. */
  guard: Vec;
  /** Orders still to carry out (shift-queued); the first is current. */
  orders: UnitOrder[];
  /** Bite cooldown. */
  cooldown: number;
  /** Seconds to the next warrior she broods. */
  spawnCd: number;
  /** Seconds to her next net. */
  netCd: number;
  /** Sedated by a science dart: no brooding, no net, no walking until then (sim time). */
  stunnedUntil?: number;
  snap: BroodSnap;
}

/** A broodling: the mother's spawn, fighting in the streets on your side. */
/**
 * A SPORE MULE (Collins, Oct 2 2026: "a unit that can act like a creep node (and an organ that makes them) ... you walk
 * it out and deploy it"). Born of a Mule Sac in the organ stage; slow, unarmed, under your orders like the brood. DEPLOY
 * roots it where it stands and it becomes a creep node there, carrying the strain of the creep organs touching its sac.
 */
/**
 * SHELTERS (Collins, Oct 2 2026): a fortified civic shelter at the centre of a drafted district, off your creep. Its
 * defenders shoot your walking units near it. An Infestor burrows into it and it becomes YOURS: an infested shelter,
 * a second base that seeps creep, grows through three stages and pays a multiplier on the wave's meat at every wave
 * clear it was PROTECTED through. The war caste goes for it first.
 */
export interface Shelter {
  id: number;
  /** The building cells it stands on (one, or a 2x2). */
  cells: number[];
  /** The street cell in front of it: where an Infestor burrows in and where the hive attacks it from. */
  door: number;
  pos: Vec;
  state: 'intact' | 'infested' | 'ruin';
  /** Infested: its stage (1..3) and the protected waves it has grown through. */
  stage: number;
  growth: number;
  hp: number;
  maxHp: number;
  /** Harm taken since this wave began (the protected test). */
  harmThisWave: number;
  /** Its defenders' next shot (s). */
  cooldown: number;
  /** The Infestor burrowing into it now, and how far (s). */
  burrowBy?: number;
  burrowT?: number;
}

/** The INFESTOR (Collins, Oct 2 2026): big, slow, fragile for its size, expensive. It burrows into a shelter. */
export interface Infestor {
  id: number;
  /** The Infestor Cyst (organ id) that grew it. */
  cystId: number;
  pos: Vec;
  hp: number;
  maxHp: number;
  orders: UnitOrder[];
  guard?: Vec;
  /** The shelter it was ordered to take. */
  infest?: number;
}

/**
 * The HARRIER (Collins, Oct 2 2026: "a faster long-range attacker that is harder to make in large numbers ... to solve
 * science teams attacking you far from any response"). Fast, long-ranged, soft, few: it hunts the science caste.
 */
export interface Harrier {
  id: number;
  glandId: number;
  pos: Vec;
  hp: number;
  maxHp: number;
  orders: UnitOrder[];
  guard?: Vec;
  cooldown: number;
}

export interface SporeMule {
  id: number;
  /** The Mule Sac (organ id) that grew it. */
  sacId: number;
  pos: Vec;
  hp: number;
  maxHp: number;
  /** Orders still to carry out (shift-queued); the first is current. */
  orders: UnitOrder[];
  /** Where it waits when it has no orders. */
  guard?: Vec;
  /** The node it becomes when it roots. */
  strain: NodeStrain;
}

export interface Broodling {
  id: number;
  /** The limb it belongs to: the Brood Pit or Broodmother Den that made it (or the Trap Cage, for a puppet). */
  motherId: number;
  /** A Broodmother's warrior: the mother UNIT it guards (absent: a pit's warrior, or a puppet). */
  motherUnit?: number;
  /** Its post: it fights the hive near here and drifts back to it (absent: its limb's rally point). */
  guard?: Vec;
  /** Its orders (shift-queued); the first is current. */
  orders?: UnitOrder[];
  /** Fights with this once its limb is gone (warriors outlive the limb that made them). */
  snap?: BroodSnap;
  /** A grafted royal fighting its own (Puppet Queen): no leash, its own bite and speed. */
  /** kind: which royal it was (the board draws her grafted: tools/art/units.mjs ALLIES). */
  puppet?: { bite: number; rate: number; speed: number; kind?: EnemyKind };
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
  /** Boomerang legs left after this one (each extra layer = one more trip). */
  legsLeft?: number;
  /** Where the outbound leg turned (the far end of the ping-pong line). */
  turnAt?: Vec;
  /** Damage multiplier applied to return legs (Heavy Return evolutions). */
  returnDmg?: number;
}

/**
 * A BODY ON THE GROUND (Collins, Oct 1 2026): "have a death image of the unit, then it dissolving, then gone ...
 * have corpses pile up where there is no creep, then dissolve when the creep reaches them." Its meat is banked
 * ONLY when the creep digests it: "not being able to collect meat that did not die on creep, or picking up meat
 * later by shooting creep at it, adds a layer of strategy, but also ties into the lore: the point of the creep
 * and meat being digitisation." A corpse never rots: its meat waits for the creep until the deployment ends.
 */
export interface Corpse {
  id: number;
  /** The unit it was (its view in the renderer becomes this corpse's). */
  unitId: number;
  kind: EnemyKind;
  pos: Vec;
  cell: number;
  /** What the creep banks when it has digested this body. */
  meat: Record<Caste, number>;
  /** Sim time it fell. */
  born: number;
  /** Seconds the creep has been at it (its fall, then the dissolve); absent while it lies off the creep. */
  digest?: number;
  /** A heap: this many bodies merged into one (past the per-cell or board cap); their meat is summed, never lost. */
  heap?: number;
  /** The kinds drawn on a heap (the first few merged into it). */
  kinds?: EnemyKind[];
  /** It lay off the creep before the creep reached it (a reclaimed body). */
  waited?: boolean;
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
  | { kind: 'organ-upgraded'; organ: OrganId; level: number }
  | { kind: 'meat-cleared'; war: number; science: number }
  | { kind: 'node-grown'; count: number }
  | { kind: 'plinth-grown'; count: number }
  | { kind: 'seedling-grown'; count: number }
  | { kind: 'plinth-placed'; cell: number; height: number }
  | { kind: 'node-placed'; cell: number }
  | { kind: 'node-spread'; cell: number }
  | { kind: 'node-lost'; cell: number }
  | { kind: 'royal-captured'; enemy: EnemyKind }
  | { kind: 'martyr'; hits: number }
  | { kind: 'mated'; count: number }
  | { kind: 'cannibalized'; donor: TowerFamily; into: TowerFamily }
  | { kind: 'butchered'; family: TowerFamily; refund: number }
  | { kind: 'clot-hurled'; cell: number }
  | { kind: 'clot-landed'; cell: number }
  | { kind: 'bile-landed'; cell: number; hits: number }
  | { kind: 'broodling-lost'; motherId: number }
  | { kind: 'warrior-born'; motherId: number; at: 'body' | 'mother' }
  | { kind: 'mother-born'; denId: number; motherId: number }
  | { kind: 'mule-born'; muleId: number }
  | { kind: 'mule-lost'; muleId: number }
  | { kind: 'mule-rooted'; muleId: number; cell: number }
  /** Something the player may answer in one click (src/sim/groups.ts): a science party, an engineer, a field station, an outpost under attack. */
  | { kind: 'unit-alert'; alertId: number; alert: 'science' | 'engineer' | 'station' | 'outpost' | 'dome'; at: Vec }
  | { kind: 'infestor-born'; unitId: number }
  | { kind: 'infestor-lost'; unitId: number }
  | { kind: 'harrier-born'; unitId: number }
  | { kind: 'harrier-lost'; unitId: number }
  | { kind: 'shelter-raised'; shelterId: number }
  | { kind: 'shelter-burrow'; shelterId: number; unitId: number }
  | { kind: 'shelter-infested'; shelterId: number }
  | { kind: 'shelter-grew'; shelterId: number; stage: number }
  | { kind: 'shelter-lost'; shelterId: number }
  /** A wave cleared with infested shelters protected: the meat they added (pct: the total boost). */
  | { kind: 'shelter-paid'; war: number; science: number; pct: number }
  /** A Broodmother lost the creep under her: she can brood only on creep, so she is in fight mode now. */
  | { kind: 'mother-off-creep'; motherId: number }
  | { kind: 'mother-lost'; denId: number; motherId: number }
  | { kind: 'mother-mode'; motherId: number; mode: 'brood' | 'fight' }
  | { kind: 'net-cast'; motherId: number; at: Vec; radius: number; hits: number }
  | { kind: 'kill'; enemy: EnemyKind; caste: Caste }
  | { kind: 'banked'; caste: Caste; amount: number }
  | { kind: 'digested'; corpse: number; pos: Vec; meat: Record<Caste, number>; bodies: number }
  | { kind: 'wave-start'; tier: number; wave: number; counts: Partial<Record<EnemyKind, number>>; sides: string; risk: number }
  | { kind: 'meat-stolen'; amount: number }
  | { kind: 'meat-recovered'; amount: number }
  | { kind: 'tower-stolen'; family: TowerFamily }
  | { kind: 'tower-recovered'; family: TowerFamily; refunded: boolean }
  | { kind: 'promoted'; from: EnemyKind; to: EnemyKind }
  | { kind: 'cannon-deployed'; enemy: EnemyKind }
  | { kind: 'budded'; family: TowerFamily }
  | { kind: 'relic-banked'; family: TowerFamily; pips: number }
  | { kind: 'evolved'; family: TowerFamily; stage: number; choice: UpgradeChoice; name: string }
  | { kind: 'reborn'; family: TowerFamily }
  | { kind: 'deposit-claimed'; name: string }
  | { kind: 'royal-incoming' }
  | { kind: 'researchers-arrive'; count: number }
  /** Science forward bases: an engineer is out (where it is headed), a station raised, grown, raised a turret, sent a party or a squad, destroyed. */
  | { kind: 'engineer-out'; enemyId: number; cell: number }
  | { kind: 'dome-up'; enemyId: number; bearer: EnemyKind }
  | { kind: 'dome-broken'; enemyId: number; bearer: EnemyKind }
  | { kind: 'station-raised'; enemyId: number; cell: number }
  | { kind: 'station-grew'; enemyId: number; stage: number }
  | { kind: 'station-turret'; enemyId: number }
  | { kind: 'station-sent'; enemyId: number; count: number; squad: boolean }
  | { kind: 'station-destroyed'; enemyId: number }
  | { kind: 'structure-lost'; what: string }
  | { kind: 'eaten'; enemy: EnemyKind }
  | { kind: 'won' }
  | { kind: 'lost' }
  | { kind: 'discarded'; family: TowerFamily }
  | { kind: 'wave-cleared'; wave: number; bonus: number }
  | { kind: 'draft-open' }
  | { kind: 'plate-drafted'; name: string; feature: string }
  | { kind: 'royal-decree'; decree: DecreeId; name: string; family?: TowerFamily }
  | { kind: 'limb-promoted'; family: TowerFamily }
  | { kind: 'surgery-under-fire'; family: TowerFamily; seconds: number }
  | { kind: 'graft-took'; family: TowerFamily }
  | { kind: 'burrowed'; cell: number; gate: number }
  | { kind: 'sealed-in' };

export type Command =
  /** cell: the cell pointed at. A big limb takes the legal footprint that holds it (see Sim.footprintAt). */
  | { kind: 'build'; cardIndex: number; cell: number; cannibalizeTowerId?: number; facing?: RootDir }
  | { kind: 'butcher'; towerId: number }
  | { kind: 'evolve'; towerId: number; choice: UpgradeChoice }
  | { kind: 'set-priority'; towerId: number; mode?: TargetMode; caste?: CasteFocus }
  | { kind: 'set-marker'; towerId: number; cell: number }
  | { kind: 'set-facing'; towerId: number; dir: RootDir }
  | { kind: 'sling-throw'; towerId: number; cell: number }
  | { kind: 'bile-throw'; towerId: number; cell: number }
  | { kind: 'build-organ'; organ: OrganId; cell: number; rot?: number }
  | { kind: 'upgrade-organ'; organInstanceId: number }
  | { kind: 'place-node'; cell: number; stock?: number }
  /** A free plinth from stock: raises the limb that stands on this cell (all of it), or this bare roof, by one level. */
  | { kind: 'place-plinth'; cell: number }
  | { kind: 'spread-node'; sourceId: number; cell: number }
  /** Deprecated (the placeholder royal sink; kept for old scripts): +biomass for a royal point. */
  | { kind: 'royal-surge' }
  /** A ROYAL DECREE (content/royal.ts). towerId: the limb it is bought on (crown); family: the commissioned card. */
  | { kind: 'decree'; decree: DecreeId; towerId?: number; family?: TowerFamily }
  /** Burrow through a claimed district's wall into the unclaimed city next to it (between waves). */
  | { kind: 'burrow'; cell: number }
  | { kind: 'discard'; cardIndex: number }
  | { kind: 'choose-plate'; index: number }
  | { kind: 'call-early' }
  /** Orders for your walking units (warriors and Broodmothers, by id). queue: after the orders they have (shift). */
  | { kind: 'unit-order'; ids: number[]; order: UnitOrder; queue?: boolean }
  /** One click for a whole group (src/sim/groups.ts): every unit of a kind, or ALL fighters, at what is at this point. */
  | { kind: 'group-order'; who: 'warrior' | 'mother' | 'mule' | 'infestor' | 'harrier' | 'all'; at: Vec }
  /** SEND: answer an alert with its responders. */
  | { kind: 'answer-alert'; alertId: number }
  /** A unit kind answers alerts by itself (AUTO), or not. */
  | { kind: 'set-auto'; who: 'warrior' | 'mother' | 'mule' | 'infestor' | 'harrier'; on: boolean }
  /** A Broodmother's mode: brood (parked, brooding warriors) or fight (walks, bites, nets). */
  | { kind: 'mother-mode'; motherId: number; mode: 'brood' | 'fight' }
  /** Aim a Broodmother's net here, now (it must be off cooldown and in reach). */
  | { kind: 'mother-net'; motherId: number; at: Vec }
  /** A Brood Pit's or Den's rally point: where its new warriors (or its new Broodmother) go. */
  | { kind: 'set-rally'; towerId: number; cell: number }
  /** A Spore Mule roots where it stands and becomes a creep node (Collins, Oct 2 2026). */
  | { kind: 'mule-deploy'; muleId: number }
  /** An Infestor goes to a shelter and burrows into it (Collins, Oct 2 2026). */
  | { kind: 'infest'; unitId: number; shelterId: number };

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
  /** Which crash site the run starts on (content/plates.ts START_PLATES, by index); otherwise by the seed. */
  crash?: number;
  /** Force a directive (tests, URL param); otherwise seeded-random. */
  directive?: Directive;
  /** Gene ids spliced on the ship — persistent meta-progression. */
  genes?: string[];
  /**
   * The organ stage rules: only limbs your organs unlock are drawn, and unspent
   * war/science is lost when a wave starts (after the first). The real game and
   * the full-run tests turn this on; unit tests leave every limb drawable.
   */
  organStage?: boolean;
  /** Starting entrances (1-3). More is a difficulty wager paid in richer meat. */
  entrances?: number;
  // ---- the campaign (src/meta) sets these; skirmish leaves them unset ----
  /** Organs the organ stage may grow (unset = every organ). */
  organPool?: OrganId[];
  /** Organs grown for free at the start (the starting profile). */
  startOrgans?: OrganId[];
  /** Highest evolution stage per theme (the globe's unlock points); unset theme = 3. */
  evolutionCap?: Partial<Record<string, number>>;
  /** Enemy kinds that will not come this deployment (Conscientious Objectors). */
  bannedEnemies?: EnemyKind[];
  /** 'hidden' = the next wave's makeup and entrance are not shown (the Translator shows them). */
  waveIntel?: 'full' | 'hidden';
  /** Share of war bodies that are martyrs and detonate among their own (the Sleepers). */
  sleepers?: number;
  /** Every wave's body count is multiplied by this (campaign: the Institute's Pacification, 0.9). */
  waveScale?: number;
  /** Extra meat at the start (Volunteers). */
  startBonus?: Partial<Record<Caste, number>>;
  /** Experiment: lure clouds carry the colony's MATING pheromone instead of poison. */
  matingMusk?: boolean;
  /** Experiment: start with a free Trap Cage card. */
  trapCage?: boolean;
  /**
   * The families the FIRST hand is drawn from (mission 1: the plain limbs a new player can read at a
   * glance). Only the weights change: each card is still one rng draw, so the rng's order is the same.
   * Families not unlocked are ignored; with none of them unlocked the first hand is drawn as usual.
   */
  firstHand?: TowerFamily[];
  // ---- a defence deployment (src/meta/defence.ts; DESIGN.md "Defence deployments") ----
  /** The city and the organs remembered from the win there (src/sim/boardSnapshot.ts). */
  board?: BoardSnapshot;
  /** Districts grown before the run starts (a defence with no remembered board: a large city, already built). */
  pregrown?: number;
  /** The core is drawn at least at this stage (src/render/coreStage.ts; a defence: 3). */
  coreStage?: number;
  /** The meteor's starting level (a defence: the body has been here a while). */
  coreLevel?: number;
  /** ONE siege only: as big as this wave of a full deployment, at least this tier, after this long to re-arm (a defence). */
  oneWave?: { asWave: number; minTier: number; armSeconds?: number; lanes?: number; creepPx?: number };
}

/**
 * What happened in a run, for the campaign's goals (the Requisition Board, the
 * dares, the experiments). Counters only; the sim never reads them back.
 */
export interface RunStats {
  kills: Partial<Record<EnemyKind, number>>;
  killsByFamily: Partial<Record<TowerFamily, number>>;
  killsByCause: Record<string, number>;
  healed: number;
  limbsGrown: number;
  evolutions: number;
  limbsLost: number;
  cannibalized: number;
  coreMinFrac: number;
  depositsClaimed: number;
  earlyCalls: number;
  maxLimbs: number;
  maxBurning: number;
  maxPips: number;
  families: TowerFamily[];
  pacifistWaves: number;
  lastWaveKillsByCause: Record<string, number>;
  royalsEaten: number;
  matingStuns: number;
  limbsCarriedOff: number;
  gateBurnKills: number;
  royalsCaptured: number;
  /** Brood Pit and Broodmother warriors born, Broodmothers born and lost, nets thrown and the bodies they caught. */
  warriorsBorn?: number;
  mothersBorn?: number;
  /** Spore Mules grown, lost while walking, and rooted into nodes. */
  mulesBorn?: number;
  mulesLost?: number;
  mulesRooted?: number;
  /** Infestors grown and lost, shelters infested and lost, the meat they paid, Harriers grown and lost, their kills. */
  infestorsBorn?: number;
  infestorsLost?: number;
  sheltersInfested?: number;
  sheltersLost?: number;
  shelterMeat?: number;
  shelterTopStage?: number;
  harriersBorn?: number;
  harriersLost?: number;
  harrierKills?: number;
  /** Domes (Oct 2 2026): damage your limbs and creep lost to enemy domes, and domes broken. */
  domeSoaked?: number;
  domesBroken?: number;
  /** Science forward bases: stations raised and destroyed, the highest stage one reached, parties and squads sent;
   *  your units healed by the creep (hp). */
  stationsRaised?: number;
  stationsDestroyed?: number;
  stationTopStage?: number;
  stationParties?: number;
  creepHealed?: number;
  mothersLost?: number;
  netsCast?: number;
  netHits?: number;
  nodesPlaced: number;
  nodesLost: number;
  /** Stolen limbs taken back by killing the courier carrying them (Finders Keepers). */
  limbsRecovered?: number;
  /** Royal decrees bought, by id. */
  decrees?: Partial<Record<DecreeId, number>>;
  /** Limbs grafted with eaten bonuses during a siege. */
  surgeriesUnderFire?: number;
  /** Walls burrowed through into the unclaimed city. */
  burrows?: number;
  /** Bodies that fell past the creep and were digested when it reached them later (reclaimed meat). */
  bodiesReclaimed?: number;
}
