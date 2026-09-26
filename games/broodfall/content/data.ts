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
  {
    // Control: hit enemies wade through mucus. Weak damage, strong tempo.
    family: 'tangler', name: 'Snare Bed', weight: 12,
    cost: { war: 16, science: 6 }, range: 80, rate: 0.9, damage: 4, aoe: 30,
    slowMult: 0.55, slowDur: 1.8,
    maxHp: 70, interest: 1, eatThreshold: 0, advanced: false,
  },
  {
    // Damage over time: spore clouds that keep eating. Poison ignores armor caps,
    // so this is the second answer to the phalanx besides rapid fire.
    family: 'blighter', name: 'Blight Vent', weight: 10,
    cost: { war: 14, science: 14 }, range: 90, rate: 0.6, damage: 3, aoe: 38,
    poisonDps: 7, poisonDur: 3.5,
    maxHp: 65, interest: 2, eatThreshold: 0, advanced: true,
  },
  {
    // Artillery: a bone harpoon that skewers a whole file and ignores shields.
    family: 'impaler', name: 'Impaler', weight: 8,
    cost: { war: 36, science: 8 }, range: 150, rate: 0.35, damage: 34, aoe: 0,
    pierce: true,
    maxHp: 80, interest: 2, eatThreshold: 0, advanced: true,
  },
  {
    // Support: a resonance organ that syncs the limbs around it to a faster beat.
    family: 'choir', name: 'Choir Node', weight: 7,
    cost: { science: 22 }, range: 0, rate: 0, damage: 0, aoe: 0,
    rateAura: 0.15, auraRadius: 95,
    maxHp: 60, interest: 2, eatThreshold: 0, advanced: true,
  },
  {
    // Logistics: hurls a creep clot to a chosen distant spot — forward ground
    // to build on before the body arrives. Click the built sling to arm a throw.
    family: 'sling', name: 'Spore Sling', weight: 8,
    cost: { war: 22, science: 10 }, range: 0, rate: 0, damage: 0, aoe: 0,
    maxHp: 70, interest: 2, eatThreshold: 0, advanced: true,
  },
];

export const ORGANS: readonly OrganSpec[] = [
  { id: 'heart', name: 'Auxiliary Heart', cost: { war: 30, science: 10 }, maxHp: 200 },
  { id: 'brain', name: 'Brain Node', cost: { science: 30 }, maxHp: 150 },
  { id: 'gland', name: 'Pheromone Gland', cost: { science: 20 }, maxHp: 150 },
  // Directional expansion: grows a creep lobe toward its compass heading (click to cycle).
  { id: 'root', name: 'Tendril Root', cost: { war: 15, science: 15 }, maxHp: 150 },
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
  // Support castes: each one is a kill-priority decision, not a stat block.
  { kind: 'drummer', caste: 'war', hp: 70, speed: 36, damage: 5, rate: 0.8, meat: 5, threatOnKill: 3, speedAura: true },
  { kind: 'bomber', caste: 'war', hp: 60, speed: 46, damage: 0, rate: 0, meat: 3, threatOnKill: 3, bomber: true },
  { kind: 'tunneler', caste: 'war', hp: 110, speed: 40, damage: 16, rate: 1.1, meat: 5, threatOnKill: 4, tunneler: true },
  { kind: 'tender', caste: 'war', hp: 80, speed: 34, damage: 6, rate: 0.5, meat: 6, threatOnKill: 2, healer: true },
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
  { militia: 8, soldier: 8, elite: 2, flier: 4, drummer: 1 },  // tier 3: air support, war-drums
  { soldier: 10, elite: 5, flier: 5, sapper: 3, bomber: 2, drummer: 1 },              // tier 4: sappers climb, charges set
  { soldier: 12, elite: 7, flier: 6, sapper: 4, phalanx: 2, tender: 2, bomber: 2 },   // tier 5: the shield wall marches tended
  { elite: 10, flier: 8, sapper: 5, phalanx: 3, drummer: 2, tender: 3, tunneler: 4, bomber: 4 }, // tier 6: everything they have
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
  /** Cannibalize: butchering a limb refunds this fraction of its cost toward the build. */
  salvageRate: 0.6,
  /** Cannibalize pip effects (multiplicative per pip unless noted). */
  pipRate: 0.25,      // spitter pip: +25% fire rate
  pipAoe: 12,         // burster pip: +12px aoe radius (adds aoe to non-aoe towers)
  pipYield: 0.3,      // maw pip: +30% meat from kills by this tower
  pipDamage: 0.2,     // lasher pip: +20% damage
  pipHp: 150,          // spine pip: +80 max hp
  pipInterest: 2,     // lure pip: +2 interest
  pipSlow: 0.1,       // tangler pip: hits slow 10% more (floor 25% speed)
  pipSlowDur: 1.5,
  pipPoisonDps: 2,    // blighter pip: hits apply +2 poison dps
  pipPoisonDur: 2.5,
  pipPierceCap: 5,    // impaler pip: +5 to the armor cap this tower's hits respect
  pipRange: 0.08,     // choir pip: +8% range
  /** Support enemy tuning. */
  drummerSpeedMult: 1.35,
  drummerRadius: 90,
  tenderHeal: 14,
  tenderRadius: 80,
  bomberBlastRadius: 55,
  bomberBlastDamage: 85,
  /** The desperation row of the wave table needs this much threat, not just the
   *  ladder — a standard hold-12 tops out around 330, so tier 6 belongs to long
   *  runs and deliberate escalation (royal bait, challenge gland). */
  tier6Threat: 420,
  /** Tunnelers surface at this fraction of the gate->core flow distance. */
  tunnelerSurfaceFrac: 0.45,
  /** Spore sling: player-aimed creep logistics. */
  slingRange: 300,          // px: how far a clot can be hurled
  slingCooldown: 20,        // s between throws per sling
  clotFlightSeconds: 1.2,
  slingPatchRadius: 3,      // cells: landing patch starts this big...
  slingPatchGrow: 0.12,     // ...and grows this many cells/s...
  slingPatchMax: 8,         // ...up to this.
  pipSeep: 1,               // sling pip: the tower itself seeps creep, +1 cell per pip
  /** Tendril root: directional creep lobe. */
  rootBaseRadius: 2,        // cells of creep all around the organ
  rootGrowPerSec: 0.35,     // cells/s of lobe length in the chosen direction
  rootMaxLen: 14,
  dropFlySeconds: 1.1,
  /** The body itself fights: focused dps on the nearest intruder inside the body. */
  coreDps: 24,
  coreReachScale: 0.6,
  projectileSpeed: 260,
} as const;
