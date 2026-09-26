/**
 * Broodfall content — pure data, no logic. Adding a tower/enemy/organ is a row here
 * plus (later) a manifest row for its art. Balance lives here, not in sim code.
 */
import type { EnemySpec, OrganSpec, TowerSpec } from '../src/sim/types';

export const TOWERS: readonly TowerSpec[] = [
  {
    family: 'spitter', name: 'Spitter', weight: 30,
    cost: { war: 13 }, range: 95, rate: 1.4, damage: 8, aoe: 0,
    maxHp: 60, interest: 0, eatThreshold: 0, advanced: false,
  },
  {
    family: 'burster', name: 'Burster', weight: 16,
    cost: { war: 29 }, range: 85, rate: 0.5, damage: 12, aoe: 45,
    maxHp: 70, interest: 1, eatThreshold: 0, advanced: true,
  },
  {
    family: 'lasher', name: 'Lasher', weight: 22,
    cost: { war: 19 }, range: 55, rate: 1.0, damage: 18, aoe: 30,
    maxHp: 110, interest: 0, eatThreshold: 0, advanced: false,
  },
  {
    family: 'maw', name: 'Maw', weight: 14,
    cost: { war: 20, science: 5 }, range: 45, rate: 0.8, damage: 10, aoe: 0,
    maxHp: 130, interest: 1, eatThreshold: 25, advanced: true,
  },
  {
    family: 'spine', name: 'Spine Wall', weight: 12,
    cost: { war: 10 }, range: 0, rate: 0, damage: 0, aoe: 0,
    maxHp: 520, interest: 0, eatThreshold: 0, advanced: false,
  },
  {
    family: 'lure', name: 'Lure Gland', weight: 8,
    cost: { science: 15 }, range: 0, rate: 0, damage: 0, aoe: 0,
    maxHp: 50, interest: 4, eatThreshold: 0, advanced: true,
  },
];

export const ORGANS: readonly OrganSpec[] = [
  { id: 'heart', name: 'Auxiliary Heart', cost: { war: 30, science: 10 }, maxHp: 200 },
  { id: 'brain', name: 'Brain Node', cost: { science: 30 }, maxHp: 150 },
  { id: 'gland', name: 'Pheromone Gland', cost: { science: 20 }, maxHp: 150 },
];

export const ENEMIES: readonly EnemySpec[] = [
  { kind: 'responder', caste: 'war', hp: 20, speed: 42, damage: 4, rate: 1.0, meat: 2, threatOnKill: 1 },
  { kind: 'militia', caste: 'war', hp: 45, speed: 38, damage: 7, rate: 1.0, meat: 2, threatOnKill: 2 },
  { kind: 'soldier', caste: 'war', hp: 90, speed: 34, damage: 14, rate: 1.1, meat: 2, threatOnKill: 3 },
  { kind: 'elite', caste: 'war', hp: 200, speed: 30, damage: 24, rate: 1.2, meat: 3, threatOnKill: 5 },
  { kind: 'researcher', caste: 'science', hp: 30, speed: 36, damage: 0, rate: 0, meat: 12, threatOnKill: 1 },
  { kind: 'flier', caste: 'war', hp: 55, speed: 58, damage: 9, rate: 1.2, meat: 3, threatOnKill: 3, flies: true },
  { kind: 'sapper', caste: 'war', hp: 130, speed: 44, damage: 20, rate: 1.4, meat: 4, threatOnKill: 4, sapper: true },
  { kind: 'phalanx', caste: 'war', hp: 750, speed: 20, damage: 26, rate: 0.9, meat: 8, threatOnKill: 6, armorCap: 12 },
  { kind: 'royal', caste: 'royal', hp: 1000, speed: 16, damage: 28, rate: 0.8, meat: 120, threatOnKill: 0 },
];

/** Wave composition per threat tier (spawned over the siege's spawn window). */
/**
 * Escalation is MORE enemies and HIGHER TYPES, never stat inflation
 * (Collins, Sep 26 2026: "hardening is boring"). Each tier introduces a new
 * verb: fliers ignore the streets, sappers climb your perches, the phalanx
 * shrugs off big hits.
 */
export const WAVE_TABLE: readonly Partial<Record<string, number>>[] = [
  { responder: 8 },                                            // tier 0: first response
  { responder: 8, militia: 6 },                                // tier 1: militia muster
  { militia: 12, soldier: 6 },                                 // tier 2: the army arrives
  { militia: 8, soldier: 8, elite: 2, flier: 4 },              // tier 3: air support
  { soldier: 10, elite: 5, flier: 5, sapper: 3 },              // tier 4: sappers climb
  { soldier: 12, elite: 7, flier: 6, sapper: 4, phalanx: 2 },  // tier 5: the shield wall
];

export const BALANCE = {
  startMeat: { war: 30, science: 0, royal: 0 },
  coreHp: 1500,
  /** Directive targets (the win is a deployment order, never a biomass bar). */
  holdWaves: 12,
  harvestScience: 80,
  royalGuaranteeWave: 8,
  /** Biomass per second, base / per heart. */
  biomassBase: 1.1,
  biomassPerHeart: 1.6,
  biomassPerEat: 6,
  biomassPerKill: 0.8,
  /** Creep radius in px: base + growth/sec (hearts multiply growth). */
  creepBase: 135,
  creepPerSec: 1.0,
  creepPerHeartBonus: 0.5,
  bodyBase: 70,
  bodyPerBiomass: 0.09,
  /** Phases. */
  growthSeconds: 27,
  siegeSpawnSeconds: 14,
  siegeMaxSeconds: 70,
  /** District drafting (map expansion) and wave rhythm. */
  draftEveryWaves: 3,
  draftCreepSurge: 45,
  callEarlyRate: 0.8,
  squadSize: 3,
  squadInterval: 3.1,
  waveBonusBase: 22,
  waveBonusPerWave: 4,
  /** Verticality: range bonus per block height level above 1. */
  heightRangeBonus: 0.10,
  /** Waves grow with the campaign clock as well as the threat ladder. */
  waveCountScale: 0.10,
  /** Threat tiers: tier = floor(threat / threatPerTier), clamped to table. */
  threatPerTier: 46,
  /** The hive escalates procedurally as the campaign drags on. */
  threatPerWaveCleared: 5,
  /** Kill vengeance is real but not the main driver of escalation. */
  killThreatScale: 0.3,
  threatFromBiomass: 0.035,
  glandChallengeThreatPerSec: 0.5,
  glandCalmThreatScale: 0.6,
  /** The asset is inherently fascinating: researchers come even before lures. */
  baseInterest: 2,
  /** Discarding a clogged card costs a little war meat. */
  discardCost: 3,
  /** Interest → researcher parties. */
  researcherBaseInterval: 80,
  researcherMinInterval: 18,
  glandLureInterestBonus: 6,
  brainInterest: 3,
  interestPerPip: 0.5,
  studySeconds: 6,
  /** Royal event. */
  royalThreat: 240,
  royalEscort: 6,
  royalSurgeCost: 50,
  royalSurgeBiomass: 120,
  /** Cards. */
  handSize: 4,
  brainAdvancedWeightMult: 2.2,
  /** Cannibalize pip effects (multiplicative per pip unless noted). */
  pipRate: 0.25,      // spitter pip: +25% fire rate
  pipAoe: 12,         // burster pip: +12px aoe radius (adds aoe to non-aoe towers)
  pipYield: 0.3,      // maw pip: +30% meat from kills by this tower
  pipDamage: 0.2,     // lasher pip: +20% damage
  pipHp: 150,          // spine pip: +80 max hp
  pipInterest: 2,     // lure pip: +2 interest
  dropFlySeconds: 1.1,
  /** The body itself fights: focused dps on the nearest intruder inside the body. */
  coreDps: 24,
  coreReachScale: 0.6,
  projectileSpeed: 260,
} as const;
