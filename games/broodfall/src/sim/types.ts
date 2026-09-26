/** Shared sim types. This module (and everything under src/sim/) must never import rendering code. */

export type Caste = 'war' | 'science' | 'royal';

export type TowerFamily = 'spitter' | 'burster' | 'lasher' | 'maw' | 'spine' | 'lure';

export type OrganId = 'heart' | 'brain' | 'gland';

export type GlandMode = 'calm' | 'lure' | 'challenge';

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
}

export type EnemyKind =
  | 'responder'
  | 'militia'
  | 'soldier'
  | 'elite'
  | 'researcher'
  | 'royal';

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

export type Phase = 'growth' | 'siege';

export type Outcome = 'playing' | 'won' | 'lost';

export type SimEvent =
  | { kind: 'built'; family: TowerFamily; pips: number }
  | { kind: 'organ-built'; organ: OrganId }
  | { kind: 'cannibalized'; donor: TowerFamily; into: TowerFamily }
  | { kind: 'kill'; enemy: EnemyKind; caste: Caste }
  | { kind: 'banked'; caste: Caste; amount: number }
  | { kind: 'wave-start'; tier: number; wave: number; counts: Partial<Record<EnemyKind, number>>; sides: string }
  | { kind: 'royal-incoming' }
  | { kind: 'researchers-arrive'; count: number }
  | { kind: 'structure-lost'; what: string }
  | { kind: 'eaten'; enemy: EnemyKind }
  | { kind: 'won' }
  | { kind: 'lost' }
  | { kind: 'discarded'; family: TowerFamily };

export type Command =
  | { kind: 'build'; cardIndex: number; cell: number; cannibalizeTowerId?: number }
  | { kind: 'build-organ'; organ: OrganId; cell: number }
  | { kind: 'cycle-gland'; organInstanceId: number }
  | { kind: 'royal-surge' }
  | { kind: 'discard'; cardIndex: number };

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
}
