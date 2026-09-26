/**
 * Broodfall content — pure data, no logic. Adding a tower/enemy/organ is a row here
 * plus (later) a manifest row for its art. Balance lives here, not in sim code.
 */
import type { EnemySpec, OrganSpec, TowerSpec } from '../src/sim/types';

export const TOWERS: readonly TowerSpec[] = [
  {
    family: 'spitter', name: 'Spitter', weight: 30,
    cost: { war: 10 }, range: 150, rate: 1.4, damage: 8, aoe: 0,
    maxHp: 60, interest: 0, eatThreshold: 0, advanced: false,
  },
  {
    family: 'burster', name: 'Burster', weight: 16,
    cost: { war: 25 }, range: 120, rate: 0.5, damage: 12, aoe: 45,
    maxHp: 70, interest: 1, eatThreshold: 0, advanced: true,
  },
  {
    family: 'lasher', name: 'Lasher', weight: 22,
    cost: { war: 15 }, range: 55, rate: 1.0, damage: 18, aoe: 30,
    maxHp: 110, interest: 0, eatThreshold: 0, advanced: false,
  },
  {
    family: 'maw', name: 'Maw', weight: 14,
    cost: { war: 20, science: 5 }, range: 45, rate: 0.8, damage: 10, aoe: 0,
    maxHp: 130, interest: 1, eatThreshold: 25, advanced: true,
  },
  {
    family: 'spine', name: 'Spine Wall', weight: 12,
    cost: { war: 8 }, range: 0, rate: 0, damage: 0, aoe: 0,
    maxHp: 260, interest: 0, eatThreshold: 0, advanced: false,
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
  { kind: 'responder', caste: 'war', hp: 20, speed: 42, damage: 4, rate: 1.0, meat: 3, threatOnKill: 1 },
  { kind: 'militia', caste: 'war', hp: 45, speed: 38, damage: 7, rate: 1.0, meat: 5, threatOnKill: 2 },
  { kind: 'soldier', caste: 'war', hp: 90, speed: 34, damage: 12, rate: 1.1, meat: 9, threatOnKill: 3 },
  { kind: 'elite', caste: 'war', hp: 200, speed: 30, damage: 22, rate: 1.2, meat: 18, threatOnKill: 5 },
  { kind: 'researcher', caste: 'science', hp: 30, speed: 36, damage: 0, rate: 0, meat: 12, threatOnKill: 2 },
  { kind: 'royal', caste: 'royal', hp: 1000, speed: 16, damage: 28, rate: 0.8, meat: 120, threatOnKill: 0 },
];

/** Wave composition per threat tier (spawned over the siege's spawn window). */
export const WAVE_TABLE: readonly Partial<Record<string, number>>[] = [
  { responder: 6 },                                   // tier 0
  { responder: 8, militia: 4 },                       // tier 1
  { militia: 10, soldier: 3 },                        // tier 2
  { militia: 8, soldier: 8, elite: 1 },               // tier 3
  { soldier: 12, elite: 4 },                          // tier 4
  { soldier: 14, elite: 8 },                          // tier 5 (desperation)
];

export const BALANCE = {
  startMeat: { war: 30, science: 0, royal: 0 },
  coreHp: 1500,
  biomassGoal: 1000,
  /** Biomass per second, base / per heart. */
  biomassBase: 1.1,
  biomassPerHeart: 1.6,
  biomassPerEat: 6,
  biomassPerKill: 0.8,
  /** Creep radius in px: base + growth/sec (hearts multiply growth). */
  creepBase: 130,
  creepPerSec: 1.1,
  creepPerHeartBonus: 0.5,
  bodyBase: 70,
  bodyPerBiomass: 0.09,
  /** Phases. */
  growthSeconds: 22,
  siegeSpawnSeconds: 14,
  siegeMaxSeconds: 70,
  /** Threat tiers: tier = floor(threat / threatPerTier), clamped to table. */
  threatPerTier: 40,
  threatFromBiomass: 0.04,
  glandChallengeThreatPerSec: 0.5,
  glandCalmThreatScale: 0.6,
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
  pipHp: 80,          // spine pip: +80 max hp
  pipInterest: 2,     // lure pip: +2 interest
  dropFlySeconds: 1.1,
  /** The body itself fights: focused dps on the nearest intruder inside the body. */
  coreDps: 50,
  coreReachScale: 0.8,
  projectileSpeed: 260,
} as const;
