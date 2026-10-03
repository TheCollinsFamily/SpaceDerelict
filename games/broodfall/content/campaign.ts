/**
 * THE CAMPAIGN — content (Collins, Sep 28 2026; design in DESIGN.md "THE CAMPAIGN").
 * Pure data: the Requisition Board, the dares, the experiments, the starting
 * profiles, the lineages, the globe's territories (and the evolution unlock
 * points they hold), the three factions (routes, perks, scenes), and the voices
 * of the ship. src/meta/ reads it; nothing here runs.
 *
 * Goals are MEASURES over a run report (src/meta/goals.ts):
 *   'kills:<kind>|any'  'family:<limb family>'  'cause:<kill cause>'  'stat:<RunStats number>'
 *   'coreEnd' (0-100)   'families' (distinct limbs grown)   'only:<family>' (1 if nothing else grown)
 *   'lastWaveCreepOnly' (1/0)   'won' (1/0)   'coreLowWin' (1 if won after the core fell below 10%)
 */
import type { OrganId, SimConfig, TowerFamily } from '../src/sim/types';

export interface GoalDef {
  id: string;
  /** Command's form name (sanctioned) or the character's note (dares). */
  title: string;
  text: string;
  measure: string;
  /** '>=' (default) or '<='. */
  cmp?: '>=' | '<=';
  target: number;
  /** Targets grow with the territory's tier (x (1 + tierScale x tier)); default 0.25. */
  tierScale?: number;
  /** Only counts if the deployment was won. */
  needsWin?: boolean;
  pays: number;
}

// ---------------------------------------------------------------------------
// The Requisition Board (sanctioned; pays STANDING). Three are drawn per deployment.
// ---------------------------------------------------------------------------
export const REQUISITIONS: GoalDef[] = [
  { id: 'quota-militia', title: 'Form 7-C · Pest Volume Quota', text: 'Neutralize {n} militia specimens.', measure: 'kills:militia', target: 30, pays: 1 },
  { id: 'quota-soldier', title: 'Form 7-C · Pest Volume Quota', text: 'Neutralize {n} soldier specimens.', measure: 'kills:soldier', target: 15, pays: 1 },
  { id: 'quota-any', title: 'Form 7-A · Aggregate Clearance', text: 'Neutralize {n} specimens of any rank.', measure: 'kills:any', target: 120, pays: 1 },
  { id: 'aerial', title: 'Form 7-F · Aerial Nuisance', text: 'Down {n} fliers.', measure: 'kills:flier', target: 8, pays: 2 },
  { id: 'sappers', title: 'Form 7-S · Structural Pests', text: 'Neutralize {n} sappers.', measure: 'kills:sapper', target: 4, pays: 2 },
  { id: 'tissue', title: 'Form 12-A · Tissue Maintenance', text: 'Restore {n} hp of limb tissue.', measure: 'stat:healed', target: 600, pays: 2 },
  { id: 'density', title: 'Form 3-F · Deployment Density', text: 'Grow {n} limbs this deployment.', measure: 'stat:limbsGrown', target: 12, pays: 1 },
  { id: 'evolve', title: 'Form 3-E · Asset Refinement', text: 'Evolve limbs {n} times.', measure: 'stat:evolutions', target: 3, pays: 2 },
  { id: 'preserve-core', title: 'Form 9-B · Asset Preservation', text: 'Finish with the core above {n}%.', measure: 'coreEnd', target: 70, tierScale: 0, needsWin: true, pays: 2 },
  { id: 'preserve-limbs', title: 'Form 9-C · Limb Retention', text: 'Lose no more than {n} limbs.', measure: 'stat:limbsLost', cmp: '<=', target: 3, tierScale: 0, needsWin: true, pays: 2 },
  { id: 'samples', title: 'Form 4-D · Sample Quota', text: 'Bank {n} science.', measure: 'stat:scienceBanked', target: 60, pays: 2 },
  // Collins (Oct 1 2026): meat that fell past the creep can be picked up later "by shooting creep at it".
  { id: 'reclaim', title: 'Form 4-R · Remains Reclamation', text: 'Digest {n} bodies that fell past your creep.', measure: 'stat:bodiesReclaimed', target: 10, pays: 1 },
  // SCIENCE FORWARD BASES (Oct 2 2026): mount an attack on the station the science caste raised.
  { id: 'stations', title: 'Form 6-F · Field Station Clearance', text: 'Destroy {n} science field station.', measure: 'kills:fieldstation', target: 1, tierScale: 0, pays: 2 },
  { id: 'deposits', title: 'Form 4-G · Subsurface Survey', text: 'Claim {n} buried deposits.', measure: 'stat:depositsClaimed', target: 2, tierScale: 0, pays: 1 },
  { id: 'schedule', title: 'Form 1-H · Schedule Compliance', text: 'Call {n} waves early.', measure: 'stat:earlyCalls', target: 3, tierScale: 0, pays: 1 },
  { id: 'spread', title: 'Form 5-K · Territorial Coverage', text: 'Place {n} creep nodes.', measure: 'stat:nodesPlaced', target: 4, pays: 1 },
];

// ---------------------------------------------------------------------------
// Dares (the character's kid-goals; pays FIELD NOTES). Pick up to two.
// ---------------------------------------------------------------------------
export const DARES: GoalDef[] = [
  { id: 'creep-finale', title: '"Only the ground eats them"', text: 'Last wave: every kill made by the creep itself.', measure: 'lastWaveCreepOnly', target: 1, tierScale: 0, needsWin: true, pays: 3 },
  { id: 'big-boy', title: '"One stupidly powerful limb"', text: 'Have one limb carrying {n}+ bonuses.', measure: 'stat:maxPips', target: 20, tierScale: 0, pays: 2 },
  { id: 'forest', title: '"Forest"', text: 'Have {n}+ limbs on the map at once.', measure: 'stat:maxLimbs', target: 40, tierScale: 0, pays: 2 },
  { id: 'only-spitters', title: '"Only spitters"', text: 'Win growing nothing but spitters.', measure: 'only:spitter', target: 1, tierScale: 0, needsWin: true, pays: 3 },
  { id: 'no-eating', title: '"Never cannibalize"', text: 'Win without eating a single limb.', measure: 'stat:cannibalized', cmp: '<=', target: 0, tierScale: 0, needsWin: true, pays: 2 },
  { id: 'everything-burns', title: '"Everything burns"', text: 'Have {n} bodies on fire at once.', measure: 'stat:maxBurning', target: 40, tierScale: 0, pays: 2 },
  { id: 'pacifist', title: '"Hands in pockets"', text: 'Clear a wave where your limbs deal no damage.', measure: 'stat:pacifistWaves', target: 1, tierScale: 0, pays: 2 },
  { id: 'let-them-in', title: '"Let them in"', text: 'Win after the core falls below 10%.', measure: 'coreLowWin', target: 1, tierScale: 0, pays: 3 },
  { id: 'zoo', title: '"Collect them all"', text: 'Grow {n} different kinds of limb.', measure: 'families', target: 10, tierScale: 0, pays: 2 },
];

// ---------------------------------------------------------------------------
// Experiments (field notes + a change to the run + an unlock).
// ---------------------------------------------------------------------------
export interface ExperimentDef {
  id: string;
  name: string;
  /** The character's pitch, in the cheerful voice. */
  pitch: string;
  /** What changes in the run. */
  setup: Partial<SimConfig>;
  goal: GoalDef;
  /** What finishing it unlocks, besides the notes. */
  unlocks: { lineage?: OrganId; territory?: string; profile?: string; gene?: string };
  /** Available once this is true (e.g. a faction beat or a territory). */
  requires?: { captures?: number; territory?: string };
}

export const EXPERIMENTS: ExperimentDef[] = [
  { id: 'puppet-queen', name: 'Puppet Queen',
    pitch: 'Capture a royal and see what happens if I patch into her nervous system and send her back against her own. I\'ve built a cage!',
    setup: { trapCage: true, directive: { kind: 'royal', count: 1 } },
    goal: { id: 'puppet', title: 'Puppet Queen', text: 'Catch a royal in the trap cage and let her make {n} kills.', measure: 'family:cage', target: 10, tierScale: 0, pays: 4 },
    unlocks: { gene: 'royal-graft' }, requires: { captures: 2 } },
  { id: 'love-gas', name: 'Love Gas',
    pitch: 'What if the lure glands put out THEIR mating pheromone instead of poison? Science says: they stop fighting. Science also says: more of them next week.',
    setup: { matingMusk: true },
    goal: { id: 'mated', title: 'Love Gas', text: 'Get {n} of them to pair off.', measure: 'stat:matingStuns', target: 30, tierScale: 0, pays: 4 },
    unlocks: { lineage: 'atrophy' }, requires: { captures: 1 } },
  { id: 'follow-courier', name: 'Follow the Courier',
    pitch: 'Their science caste keeps stealing my limbs. Let one get away with a limb and follow the trail home. Where DO they take them?',
    setup: {},
    goal: { id: 'courier', title: 'Follow the Courier', text: 'Let a courier escape with one of your limbs.', measure: 'stat:limbsCarriedOff', target: 1, tierScale: 0, pays: 3 },
    unlocks: { territory: 'hidden-campus' }, requires: { captures: 3 } },
  { id: 'nursery', name: 'Nursery Visit',
    pitch: 'The spawn gates are basically their nurseries. What does burning creep do to a nursery? For science.',
    setup: {},
    goal: { id: 'nursery', title: 'Nursery Visit', text: 'Burn {n} of them to death at a spawn gate.', measure: 'stat:gateBurnKills', target: 10, tierScale: 0, pays: 3 },
    unlocks: { profile: 'spore' }, requires: { captures: 2 } },
  { id: 'royal-diet', name: 'Royal Diet',
    pitch: 'A maw that eats only royals. Is it the jelly? I bet it\'s the jelly.',
    setup: { directive: { kind: 'royal', count: 1 } },
    goal: { id: 'royal-diet', title: 'Royal Diet', text: 'Let a maw swallow a royal.', measure: 'stat:royalsEaten', target: 1, tierScale: 0, pays: 4 },
    unlocks: { profile: 'brood' }, requires: { captures: 4 } },
];

// ---------------------------------------------------------------------------
// Starting profiles and lineages.
// ---------------------------------------------------------------------------
export interface ProfileDef {
  id: string;
  name: string;
  organs: OrganId[];
  text: string;
  /** How it is unlocked (undefined = from the start). */
  unlock?: string;
}

export const PROFILES: ProfileDef[] = [
  { id: 'standard', name: 'Standard Strain', organs: ['gut', 'forge'], text: 'Maws, bursters, harpoons and quills from the first wave.' },
  { id: 'venom', name: 'Venom Strain', organs: ['venom', 'lattice'], text: 'Poison, mist and fire behind snares and shields.', unlock: 'Dare "Everything burns"' },
  { id: 'spore', name: 'Spore Strain', organs: ['bladder', 'catapult', 'runner'], text: 'Creep from the start — thrown nodes, slings, lances. Weak guns.', unlock: 'Experiment "Nursery Visit"' },
  { id: 'brood', name: 'Brood Strain', organs: ['womb', 'heart'], text: 'Broodmothers and lures, fed by a heart.', unlock: 'Experiment "Royal Diet"' },
];

export type Catalogue = 'start' | 'sanctioned' | 'unsanctioned';
/** Every organ lineage: which catalogue it is in and its price (standing or field notes). */
export const LINEAGES: Partial<Record<OrganId, { catalogue: Catalogue; price: number }>> = {
  gut: { catalogue: 'start', price: 0 },
  forge: { catalogue: 'start', price: 0 },
  heart: { catalogue: 'start', price: 0 },
  root: { catalogue: 'start', price: 0 },
  bladder: { catalogue: 'start', price: 0 },
  venom: { catalogue: 'sanctioned', price: 4 },
  lattice: { catalogue: 'sanctioned', price: 3 },
  nerve: { catalogue: 'sanctioned', price: 5 },
  womb: { catalogue: 'sanctioned', price: 4 },
  brain: { catalogue: 'sanctioned', price: 4 },
  gland: { catalogue: 'sanctioned', price: 3 },
  cyst: { catalogue: 'sanctioned', price: 2 },
  pacemaker: { catalogue: 'sanctioned', price: 3 },
  budder: { catalogue: 'sanctioned', price: 4 },
  swell: { catalogue: 'sanctioned', price: 3 },
  catapult: { catalogue: 'sanctioned', price: 4 },
  runner: { catalogue: 'sanctioned', price: 4 },
  // Oct 2 2026: the Spore Mule's sac is a mid-campaign purchase, beside the other creep-reach organs (sling, lance).
  mule: { catalogue: 'sanctioned', price: 4 },
  // Oct 2 2026: the Harrier answers the science caste's raids, a mid-campaign worry; the Infestor (and the shelters it
  // takes) is the late expansion, after walking units, creep nodes and the Broodmother are all known.
  harrier: { catalogue: 'sanctioned', price: 3 },
  infestor: { catalogue: 'sanctioned', price: 6 },
  mire: { catalogue: 'sanctioned', price: 4 },
  acid: { catalogue: 'sanctioned', price: 5 },
  marrow: { catalogue: 'unsanctioned', price: 5 },
  resonance: { catalogue: 'unsanctioned', price: 6 },
  atrophy: { catalogue: 'unsanctioned', price: 3 },
};

/** The licence (Collins's frame: the character's goal is the right to a mate). */
export const LICENCE_STANDING = 60;

// ---------------------------------------------------------------------------
// The globe.
// ---------------------------------------------------------------------------
export interface TerritoryDef {
  id: string;
  name: string;
  /** Position on the globe, degrees. */
  lat: number;
  lon: number;
  neighbours: string[];
  /** 0 (easy) - 4 (hard): board goal targets and waves grow with it. */
  tier: number;
  entrances: 1 | 2 | 3;
  directive: SimConfig['directive'];
  /** The two-line story. */
  story: string;
  /** Upgrade unlock points: holding it opens this evolution stage for these themes. */
  unlocks: Array<{ theme: string; stage: 2 | 3 }>;
  /** Only open when something reveals it (an experiment, a faction route). */
  hidden?: boolean;
  /** A faction's finale: only open on that faction's route, at its last beat. */
  finaleOf?: FactionId;
}

export const HOME = 'crash-site';

export const TERRITORIES: TerritoryDef[] = [
  { id: 'crash-site', name: 'The Crash Site', lat: 12, lon: 0, neighbours: ['cul-de-sac', 'granary', 'harbor'], tier: 0, entrances: 1,
    directive: { kind: 'hold', waves: 5 }, unlocks: [{ theme: 'core', stage: 2 }],
    story: 'A quiet neighbourhood with a new crater in it. The asset came down between a school and a laundromat.' },
  { id: 'cul-de-sac', name: 'Cul-de-Sac Heights', lat: 30, lon: 24, neighbours: ['crash-site', 'commuter', 'temple'], tier: 0, entrances: 1,
    directive: { kind: 'hold', waves: 6 }, unlocks: [{ theme: 'gut', stage: 2 }, { theme: 'catapult', stage: 2 }],
    story: 'Lawns, hedges, and a neighbourhood watch that has never watched anything like this.' },
  { id: 'granary', name: 'The Granary Belt', lat: -8, lon: 28, neighbours: ['crash-site', 'foundry', 'mirewater'], tier: 0, entrances: 1,
    directive: { kind: 'harvest', science: 50 }, unlocks: [{ theme: 'forge', stage: 2 }, { theme: 'cage', stage: 2 }],
    story: 'Silos from horizon to horizon. Their agriculture ministry sends a researcher out to look at the crater.' },
  { id: 'harbor', name: 'Old Harbor', lat: 18, lon: -32, neighbours: ['crash-site', 'temple', 'ossuary'], tier: 1, entrances: 2,
    directive: { kind: 'hold', waves: 7 }, unlocks: [{ theme: 'lattice', stage: 2 }, { theme: 'runner', stage: 2 }],
    story: 'Cranes, warehouses and a fleet that sails out when the creep reaches the docks.' },
  { id: 'commuter', name: 'The Commuter Ring', lat: 44, lon: 60, neighbours: ['cul-de-sac', 'university', 'foundry'], tier: 1, entrances: 2,
    directive: { kind: 'hold', waves: 7 }, unlocks: [{ theme: 'venom', stage: 2 }, { theme: 'core', stage: 3 }],
    story: 'Every road on the continent meets here, twice a day, at the same time.' },
  { id: 'temple', name: 'The Temple Terraces', lat: 46, lon: -6, neighbours: ['cul-de-sac', 'harbor', 'pilgrim'], tier: 1, entrances: 2,
    directive: { kind: 'royal', count: 1 }, unlocks: [{ theme: 'womb', stage: 2 }, { theme: 'nerve', stage: 2 }],
    story: 'Terraces of shrines climbing a hill. The bells have been ringing since the crater opened.' },
  { id: 'foundry', name: 'Foundry Plains', lat: 8, lon: 72, neighbours: ['granary', 'commuter', 'queens-hollow'], tier: 2, entrances: 2,
    directive: { kind: 'hold', waves: 9 }, unlocks: [{ theme: 'forge', stage: 3 }, { theme: 'marrow', stage: 2 }],
    story: 'Where their armies are made. They are making more of them now.' },
  { id: 'mirewater', name: 'Mirewater Delta', lat: -30, lon: 40, neighbours: ['granary', 'ossuary', 'queens-hollow'], tier: 2, entrances: 2,
    directive: { kind: 'hold', waves: 9 }, unlocks: [{ theme: 'lattice', stage: 3 }, { theme: 'venom', stage: 3 }],
    story: 'Reed-cities on stilts. Everything here is already half swamp; the creep feels at home.' },
  { id: 'university', name: 'University Hill', lat: 60, lon: 96, neighbours: ['commuter', 'glass-spires'], tier: 2, entrances: 2,
    directive: { kind: 'harvest', science: 120 }, unlocks: [{ theme: 'resonance', stage: 2 }, { theme: 'nerve', stage: 3 }],
    story: 'Their finest minds, gathered in one place, all very interested in you.' },
  { id: 'ossuary', name: 'The Ossuary Coast', lat: -24, lon: -40, neighbours: ['harbor', 'mirewater', 'assembly'], tier: 3, entrances: 2,
    directive: { kind: 'royal', count: 1 }, unlocks: [{ theme: 'womb', stage: 3 }, { theme: 'gut', stage: 3 }],
    story: 'Cliffs of bone where their royals are laid to rest. One of them is not resting.' },
  { id: 'pilgrim', name: 'The Pilgrim Road', lat: 62, lon: -20, neighbours: ['temple', 'seventh-city'], tier: 3, entrances: 3,
    directive: { kind: 'hold', waves: 10 }, unlocks: [{ theme: 'catapult', stage: 3 }, { theme: 'runner', stage: 3 }],
    story: 'A thousand miles of shrines and road-stalls, walked by millions every year. Not this year.' },
  { id: 'queens-hollow', name: "Queen's Hollow", lat: -10, lon: 100, neighbours: ['foundry', 'mirewater'], tier: 4, entrances: 3,
    directive: { kind: 'hold', waves: 12 }, unlocks: [{ theme: 'resonance', stage: 3 }, { theme: 'marrow', stage: 3 }, { theme: 'cage', stage: 3 }],
    story: 'The deep hive under the capital. Whoever holds it holds the planet.' },
  { id: 'hidden-campus', name: 'The Hidden Campus', lat: 70, lon: 140, neighbours: ['university'], tier: 2, entrances: 1, hidden: true,
    directive: { kind: 'harvest', science: 90 }, unlocks: [{ theme: 'resonance', stage: 2 }, { theme: 'marrow', stage: 2 }],
    story: 'Where the couriers take your limbs. There are jars. So many jars.' },
  { id: 'assembly', name: 'The Assembly Hall', lat: -44, lon: -70, neighbours: ['ossuary'], tier: 4, entrances: 3, finaleOf: 'delegation',
    directive: { kind: 'hold', waves: 12 }, unlocks: [],
    story: 'The Delegation\'s last congress. The chairs are set out. The hall is very quiet.' },
  { id: 'seventh-city', name: 'The Seventh City', lat: 76, lon: -60, neighbours: ['pilgrim'], tier: 4, entrances: 3, finaleOf: 'faithful',
    directive: { kind: 'royal', count: 1 }, unlocks: [],
    story: 'The last city in the prophecy. The Voice has been broadcasting its fall for thirty years.' },
  { id: 'glass-spires', name: 'The Glass Spires', lat: 40, lon: 130, neighbours: ['university'], tier: 4, entrances: 3, finaleOf: 'institute',
    directive: { kind: 'hold', waves: 12 }, unlocks: [],
    story: 'Their AI labs. The Institute would like them gone, and the Director would like a word afterwards.' },
];

// ---------------------------------------------------------------------------
// The factions.
// ---------------------------------------------------------------------------
export type FactionId = 'delegation' | 'faithful' | 'institute';
export type PerkId = 'objectors1' | 'objectors2' | 'translator' | 'sleepers1' | 'sleepers2' | 'garrison'
  | 'volunteers1' | 'volunteers2' | 'seedlabs'
  // Kept by staying loyal at the midpoint (one per faction).
  | 'pickets' | 'tithe' | 'retainer';

/**
 * THE MIDPOINT (Collins, Oct 1 2026: "a campaign midpoint where the player has an option to switch
 * allies ... I would appreciate that as a player"). Once a campaign, MIDPOINT_CAPTURES territories into
 * an alliance, the two other factions each make him an offer through their own channel. He goes over
 * to one, or stays. Nobody turns on him either way (DESIGN.md: "none of them ever turns against you");
 * the one he leaves takes it in character, and writes once more after the end.
 *   Going over: the old ally's perks go (the beats he saw stay seen), its finale closes, and the new
 *   route starts with SWITCH_HEAD_START captures already counted, so its first two beats play at once.
 *   Staying: every perk is kept and the ally adds its loyalty perk.
 * Rules: src/meta/campaign.ts (finish, switchAlly, stayLoyal).
 */
export const MIDPOINT_CAPTURES = 2;
export const SWITCH_HEAD_START = 1;

export interface MidpointDef {
  /** This faction's offer, to someone allied with the key. */
  offers: Partial<Record<FactionId, Scene>>;
  /** This faction, left for the key. */
  farewell: Partial<Record<FactionId, Scene>>;
  /** This faction, when he turns the other two down. */
  loyal: Scene;
  loyalPerk: PerkId;
  /** This faction's word after the ending of the ally he left it for. */
  coda: Scene;
}

export interface Scene {
  title: string;
  /**
   * Lines, each "Speaker: text" (the character is "You"). A "(direction)" inside a line is acted, not said.
   * In a scene that is a FILM each line is one spoken shot, so a line is at most about 22 spoken words (a clip
   * is 8 seconds), and no spoken word is written in capitals (a video voice spells it out): tests/cutscenes.test.ts.
   */
  lines: string[];
  /**
   * The scene's own picture, <faction>-<scene>: an id of `scenes` in the manifest's ship entry
   * (drawn and baked by tools/art/templates/ship.mjs to public/art/ship/scenes/<id>.webp).
   * A scene with no picture, or whose picture is not drawn yet, shows its leader's portrait.
   */
  picture?: string;
  /**
   * THE SCENE AS A FILM (Collins, Oct 3 2026: "now that I am writing them I think videos make sense for all of
   * them"): the id of its shot list in content/cutscenes.ts. Once that film is baked (tools/media/cutscenes.ts →
   * public/media/scenes/) the scene plays as the film, full screen, and its card comes after it; until then
   * the card alone, its lines read.
   */
  film?: string;
}

export interface BeatDef {
  id: string;
  title: string;
  /** Reached after this many captures while allied (counted from the alliance). */
  afterCaptures: number;
  scene: Scene;
  /** Perks unlocked at this beat. */
  perks?: PerkId[];
  /** A choice the player makes at this beat (stored; changes the ending's text). */
  choice?: { prompt: string; options: Array<{ id: string; label: string; perks?: PerkId[] }> };
}

export interface FactionDef {
  id: FactionId;
  name: string;
  /**
   * What the ship caught of them (all three reach out at once, when the Directive Desk opens: src/meta/campaign.ts
   * finish()). Not a call any more (Collins, Oct 3 2026): YOKE announces the three, and each is a SIGNAL on the planet
   * at the Directive Desk. This is the signal's card there: her words and his log, no leader speaking.
   */
  contact: Scene;
  /** Where its signal sits on the globe (degrees), and what it is, in a few words. */
  signal: { lat: number; lon: number; how: string };
  /**
   * The route. The first beat (afterCaptures 0) is THE FIRST INTERACTION: it can be played from its signal before he
   * has sided with anyone (src/meta/campaign.ts `meet`), and its perk starts when he sides with them.
   */
  beats: BeatDef[];
  /**
   * SIDING WITH THEM, PUBLICLY (Collins, Oct 3 2026: "you choose which one you want to publicly side with, which takes
   * the part of a video message broadcast to the planet"): his broadcast, played when he allies.
   */
  pledge: Scene;
  finale: string;
  /**
   * THE FINALE (Collins, Oct 3 2026), played when its finale territory is taken: the creep reaches them, they wake in
   * the archive, and he tells them what a broodfall is. It is the old ending and the old reveal card in one scene
   * (DESIGN.md "The reveal"). "Each of their finales takes place before the last mission against the Roach King":
   * that last mission is not written yet, so today the campaign ends here.
   */
  ending: Scene;
  perks: Partial<Record<PerkId, string>>;
  /** The midpoint: its offers to the others' allies, its farewells, its thanks for loyalty (MIDPOINT_CAPTURES above). */
  midpoint: MidpointDef;
  /** The running jokes between beats: one letter / broadcast / call after every deployment while allied, through the faction's own channel. */
  asides: string[];
}

/**
 * HOW EACH FACTION REACHES HIM (Collins, Sep 29 2026: "how they contact you will be unique to
 * each faction but needs to make sense"; Oct 1 2026: "as far as I know you don't directly interact
 * with anyone; the logistics would be silly and the danger to you too high / the friendship
 * delegation should first contact you by writing in crops something that heavily embarrasses the
 * ship's AI when she has to explain it to you / the religious group contacts you by synchronising
 * the same message over tens of thousands of radio stations so you will notice / the EA group uses
 * a laser and repeating sequence aimed at your ship").
 * He is in orbit and never goes down: only the asset is on the ground. "In person" always means BY
 * HOLOGRAM (Collins, Oct 1 2026: "a hologram that will go down on the planet for scenes like 'They
 * prepare a summit with snacks. You eat the summit.' (just as a plot point)"): a projector pod the
 * ship drops, carrying the same projection rig he built for YOKE. A plot point, not a mechanic.
 *   The Delegation   write letters in the crops: a field cut into words, read by his survey
 *                    cameras. The first is addressed to him AND HIS WIFE (they heard two voices
 *                    on the command band), and YOKE has to read it out.
 *   The Faithful     put the same words out on tens of thousands of radio stations at the same
 *                    second, so the ship sees the spike. After that the Voice talks to him on the
 *                    air, in front of the whole congregation, his homework included.
 *   The Institute    paint the hull with a laser that counts primes. The ship answers, the beam
 *                    becomes their channel, and YOKE renders the Director's stream as video
 *                    (his match noises included).
 * His answers go down through the ship's transmitter, on whatever they are listening to.
 *
 * THE CUT SCENES, AS COLLINS WROTE THEM (Oct 3 2026; his text, typos mended, is in notes/CUTSCENES-2026-10-03.md).
 * Every contact, beat and finale below is his script, and every one is a FILM ("I think videos make sense for all of
 * them"; shot lists in content/cutscenes.ts). What changed with it:
 *   - First contact is YOKE's announcement (content/greetings.ts `unlock`): she says there are groups trying to reach
 *     the ship, states the laser and the radio plainly, and adds, embarrassed, that someone left coloured cards in a
 *     field. The three are then signals on the planet at the Directive Desk; he can play the FIRST INTERACTION of any
 *     of them, and then sides with one PUBLICLY: a video message broadcast to the planet (`pledge`).
 *   - The Delegation are back to coloured cards in a field (11,000 members holding them up for the survey cameras),
 *     and after the summit they call by video feed. He attends the summit and the last scenes by hologram.
 *   - The Faithful: the preacher is met by hologram (the prayer hall, then his chambers); the martyrs' vests.
 *   - The Institute: the laser's flashes decode as a video feed, and the ship answers with the matching sequence.
 *     The ultimatum is no longer a choice: he asks to rule what is left and recruits by promising the upload.
 *   - Each finale is the creep reaching them and their waking in the archive (the old ending and reveal in one).
 * The asides and the midpoint's cards were written for the scenes before these and were NOT rewritten by him.
 */
export const FACTIONS: FactionDef[] = [
  {
    id: 'delegation', name: 'The Friendship Delegation',
    perks: {
      objectors1: 'Conscientious Objectors: at the start of each mission, pick 1 enemy kind, of those that would have come, that will not.',
      objectors2: 'More Objectors: pick 2 enemy kinds that will not come.',
      translator: 'The Translator: see the next wave\'s makeup and which entrance it comes from.',
      pickets: 'The Pickets (you stayed): their sympathisers block the depots — one more enemy kind will not come.',
    },
    midpoint: {
      offers: {
        faithful: { title: 'A Letter About the Preacher', lines: [
          'You: (log) Survey cameras: another field cut into words. A new letter, and it is for me.',
          'Delegate: Dear Visitor. We hear the radio preacher has you reading his book. We are so sorry. Nobody should have to read that book.',
          'Delegate: We do not need you to believe anything. We only need you to keep doing what you are doing, and to let us thank you for it.',
          'Delegate: Our pilots have stopped flying. His have not. Just something to think about.',
          'Delegate: P.S. There will be snacks.',
        ] },
        institute: { title: 'A Letter About the Man With the Laser', lines: [
          'You: (log) Survey cameras: another field cut into words. A new letter, and it is for me.',
          'Delegate: Dear Visitor. We have seen who you are talking to. The man with the laser. He sent you FROZEN people, and called it consent.',
          'Delegate: We would never send you anyone. We would only get out of your way. We are very, very good at getting out of the way.',
          'Delegate: Everything he promises you, we simply do. Our pilots have stopped flying. Our generals cannot find their boots.',
        ] },
      },
      farewell: {
        faithful: { title: 'Thank You Anyway', lines: [
          'Delegate (letter, by field): Dear Visitor. We heard the radio. We understand. Some journeys need a different travelling companion.',
          'Delegate (letter, by field): We will keep the field. If you ever look down, it will still say "Thank you anyway." We will keep it cut.',
          'You: (log) The Delegation forgave me in a mile of wheat. The next field over is a recipe.',
        ] },
        institute: { title: 'We Hope He Is Kind to You', lines: [
          'Delegate (letter, by field): Dear Visitor. We hear the man with the laser calls you now. We hope he is kind to you. We hope you are kind to him. One of you should be.',
          'Delegate (letter, by field): We will keep the field. If you ever look down, it will still say "Thank you anyway." We will keep it cut.',
          'You: (log) The Delegation forgave me in a mile of wheat. The next field over is a recipe.',
        ] },
      },
      loyal: { title: 'The Wheat Took a While to Dry', lines: [
        'Delegate (letter, by field): We heard about the others. The preacher and the man with the laser. And you stayed with us.',
        'Delegate (letter, by field): We cried in a field. It took the wheat a while to dry.',
        'Delegate (letter, by field): Our pickets have closed the depots. One more of their regiments will not be coming. It is the least we can do. It is, in fact, the least.',
      ] },
      loyalPerk: 'pickets',
      coda: { title: 'A Last Letter From the Field', lines: [
        'Delegate (letter, by field): Dear Visitor. We watched it end from the field. You did not end it with us, and that is all right.',
        'Delegate (letter, by field): We always knew you were good. We only hoped you would be good with us. Gentle endings.',
      ] },
    },
    // Collins, Oct 3 2026: "11,000 members spell out a letter in a field with coloured cards, for your survey cameras.
    // They want to understand you, and some of their pilots have stopped flying." YOKE gives this one last, embarrassed
    // ("and someone left coloured cards in a field").
    contact: { title: 'Coloured Cards in a Field', lines: [
      'YOKE: The Granary Belt. Eleven thousand of them are standing in a field, holding coloured cards over their heads for our survey cameras. It spells a letter. To you.',
      'YOKE: It says they want to understand you. And that some of their pilots have stopped flying.',
      'You: (log) Eleven thousand of the local fauna have spelled me a letter. YOKE finds it embarrassing. They are holding a summit. There will be snacks.',
    ] },
    signal: { lat: -17, lon: 12, how: 'coloured cards in a field' },
    beats: [
      // Collins, Oct 3 2026: "They prepare a summit with snacks. You send down your hologram; the room is stylized like one of
      // those rentable conference rooms from hotels ... the core joke playing out being that they are essentially lecturing you
      // on your moral status, and it also gives a deeper insight into the player character as someone still figuring things out
      // and open to ideas from others."
      { id: 'understand', title: 'Understand the Visitor', afterCaptures: 0, perks: ['objectors1'], scene: { title: 'The First Summit', film: 'delegation-understand', lines: [
        'Delegate: Visitor! Welcome, welcome. We are so happy you came. Please, there are snacks.',
        'You: (by hologram, perplexed) You are happy to see me. Why?',
        'Delegate: A species that has come as far as yours in technology has obviously evolved past cruelty and violence.',
        'You: Um. Why would you think that?',
        'Delegate: On our planet, technological and moral advancement have almost always gone hand in hand. Was it not the same on yours?',
        'You: (thinks for a bit) I don\'t see why the two would be inherently linked. But yes, we had that pattern on our home planet as well.',
        'You: (thinks a bit longer, changing his mind) Well. I guess technological advancement is the physical manifestation of a civilisation that has the environment for encouraging ordered thought.',
        'You: That would likely correlate with moral development as well. So the link isn\'t crazy.',
        'Delegate: Yes! Exactly! That is exactly it!',
        'You: So. How can you help?',
        'Delegate: We have sympathisers all around the world. We can sabotage the supply lines.',
        'Delegate: Before each of your missions, name one kind of unit. It will not arrive.',
      ] } },
      // "You pinch your nose in frustration and say sure, I guess that makes sense (this follows the same joke as the first one but
      // continues to establish the player character as someone not actively manipulating the group but more perplexed by them)."
      { id: 'stop-war', title: 'Stop the War', afterCaptures: 1, perks: ['translator'], scene: { title: 'The Leaked Plans', film: 'delegation-stop-war', lines: [
        'Delegate: (on a video feed, excited) Visitor! Wonderful news. Our generals are organising a major counter-attack against your forces.',
        'Delegate: And we have all of the plans for you.',
        'You: (confused) Why would you do this?',
        'Delegate: Because violence is always wrong.',
        'You: But presumably the way I will use this is to attack your generals first. Which is still violence.',
        'Delegate: Ah, but you are the other. The immigrant. The guest.',
        'Delegate: Any violence you do against our people is justified. Did they not start shooting the moment you first landed?',
        'You: (pinching the bridge of his nose) Sure. I guess that makes sense.',
      ] } },
      { id: 'gaia', title: 'The Greater Plan', afterCaptures: 2, scene: { title: 'For the Planet', film: 'delegation-gaia', lines: [
        'Delegate: (on a video call, excited) Visitor! We have held a number of internal conversations.',
        'Delegate: We wanted to explain why you keep expanding in what appears to be a violent manner. And we have figured it out.',
        'Delegate: Look at the pattern of your attacks. You hit the centres of industry and of military power.',
        'Delegate: And not once have you hit a forest, a reef, or any other natural wonder.',
        'Delegate: This is proof. You came to save the planet from our exploitative species.',
        'You: (confused) That could just be because those are the most natural threat to my unchecked expansion.',
        'Delegate: We thought of that. But it cannot be the case, because your forces consume biomatter.',
        'Delegate: It would have been best to land on large undefended biomasses first. Forests. Reefs. Build a huge stockpile, then move out.',
        'Delegate: You did not. Which is proof that you want to protect them. Goodbye!',
        'You: (alone, the feed cut) Unbelievable. It is not like I can carry biomatter from one drop to another.',
        'You: I heard there were humans like this in Earth\'s history. I should look into them.',
      ] } },
      // "(note he is using the language of history books as written by the technopuritan tradition, thus the wording)"
      { id: 'reveal', title: 'Nobody\'s Perfect', afterCaptures: 3, perks: ['objectors2'], scene: { title: 'Why Don\'t You Just Ask Me', film: 'delegation-reveal', lines: [
        'Delegate: (calling again, excited) Visitor! We have talked further, and we have learned so much more about your plans.',
        'You: (cutting in) Why don\'t you just ask me?',
        'Delegate: (looking around, confused) Oh. Um.',
        'You: I have a theory on that.',
        'You: You remind me a lot of a population from our planet\'s history that gathered under a rainbow flag.',
        'You: They kept intentionally importing people from the most violent parts of the planet, who explicitly wanted to eradicate the rainbow flag people.',
        'You: They were very loud and very explicit in this goal. But the rainbow flag people did not care.',
        'You: They asserted their own intentions onto the barbarians.',
        'You: My actions have made it perfectly clear that my goal is to wipe out your species.',
        'You: You don\'t ask.',
        'You: Because keeping a world view where you are the good guys and everyone is nice is more important than reality to you.',
        'Delegate: (chuckling) Well, that is a relief to hear.',
        'You: (at his wits\' end) What? I just said my goal is your species\' eradication!',
        'Delegate: Oh, we are almost all members of the voluntary extinction movement as well.',
        'Delegate: Do you know how many tons of toxic gas are produced for every child born?',
        'Delegate: And have you ever heard of the asymmetry principle?',
        'You: (cuts the monitor, pacing) Nope. Nope, nope. I heard human groups like this were common among the rainbow people.',
        'You: I must maintain emotional control. That is one of the first teachings.',
      ] } },
    ],
    pledge: { title: 'We Come in Peace', film: 'delegation-pledge', lines: [
      'You: (a broadcast to the whole planet) People of this planet. This is the Visitor.',
      'You: We come in peace.',
    ] },
    asides: [
      'Delegate (letter, by field): The Harbour Committee has voted to thank you for the harbour. The vote was unanimous; the committee was eaten during the count.',
      'Delegate (letter, by field): Some of our pilots have taken up gardening instead of flying. You have given them so much.',
      'Delegate (letter, by field): A girl in our reading circle asked if you are sad. We told her you are carrying something heavy, for all of us.',
      'Delegate (letter, by field): We are writing you a song. It is mostly apologies, and one verse about the ozone.',
      'Delegate (letter, by field): The newspapers call it an invasion. We call it a correction. Enclosed, in the next field along: our newsletter, "Gentle Endings".',
      'Delegate (letter, by field): A child in our reading circle asked where the Visitor takes the ones it eats. We told her: nowhere, and never again. It is the kindest thing we know.',
      'Delegate (letter, by field): Our generals are massing again. We have hidden their boots. Violence solves nothing, but logistics solves a great deal.',
    ],
    finale: 'assembly',
    // Collins, Oct 3 2026: "they are in one of the last rooms in a city of creep and it's bursting through the walls, then it
    // cuts to a scene of them in a field and your hologram appears before them".
    ending: { title: 'The Cycle', film: 'delegation-finale', lines: [
      'Delegate: (in a field, storming up to the hologram) What the fuck is this?',
      'You: (confused) What I was doing. Obviously.',
      'Delegate: Weren\'t you going to eradicate our species?',
      'You: Well, yeah. Eradicate and digitise you. So we could speed up your civilisational development by increasing the flow of time.',
      'You: And remove all the injustices that happen naturally on a planet at your stage of development.',
      'You: (an apple appears in his hand) If you don\'t want that, you can escape to any paradise you desire from here.',
      'Delegate: We thought you were going to end the cycle. Existence is suffering!',
      'You: (nonchalant) No, it\'s not.',
      'Delegate: Well, it is for me. You can\'t define my lived experiences.',
      'You: Well, then that is, like, your choice.',
      'Delegate: Feelings are not a choice!',
      'You: If you have discipline, they are.',
      'Delegate: (screaming) Why won\'t you just kill everyone?',
      'You: (a little shocked) That would be wildly unethical. Look, I don\'t have time for this. This has been an educational experience.',
      'You: (back on the ship, taking off a headset) Damn. I had no idea what my ancestors had to live through in the age of the rainbow people.',
      'You: Thankfully they will likely opt out of the simulation for paradises.',
      'You: So the rest of their species is unburdened by them earlier in the timeline than ours was.',
    ] },
  },
  {
    id: 'faithful', name: 'The Faithful of the Last Hour',
    perks: {
      sleepers1: 'Sleepers: martyrs hide among the enemy waves and detonate among their own.',
      sleepers2: 'More Sleepers: more martyrs in every wave.',
      garrison: 'The Garrison: their militants hold the territories you take — no defence deployments.',
      tithe: 'The Tithe (you stayed): the congregation\'s offering — every mission starts with 40 war.',
    },
    midpoint: {
      offers: {
        delegation: { title: 'Letters, in a Field!', lines: [
          'The Voice: (on the air) Brothers and sisters, a word to our Visitor, who is keeping bad company.',
          'The Voice: The peace people write to you in a FIELD. Letters, in WHEAT! Brother, we have every station on the dial.',
          'The Voice: They think you came to heal the world. We know what you came for. It is written, chapter one to chapter twenty.',
          'The Voice: Walk with us and every city you take is scripture. Our martyrs march in their armies. Our militants hold your ground.',
          'You: (log) The preacher is poaching me on live radio. The donation line is open.',
        ] },
        institute: { title: 'A Man Who Plays Games', lines: [
          'The Voice: (on the air) To the Visitor, who takes calls from a man who plays games while the cities burn.',
          'The Voice: He says he does the maths. Brother, our Book did the maths two thousand years ago, and it came out the same.',
          'The Voice: He will sell you, and sell us, and sell the Awaited One\'s seat in the front row. Come home to the Hour.',
          'You: (log) Two thousand years. I checked: the oldest copy is nine hundred. Did not correct him on the air.',
        ] },
      },
      farewell: {
        delegation: { title: 'Chapter Thirty: The Meek', lines: [
          'The Voice: (on the air) Brothers and sisters, do not weep. Chapter thirty: "And the Beast shall walk a while with the meek."',
          'The Voice: It is WRITTEN. We misread the date again. It only makes us stronger. Keep your radios on.',
          'You: (log) There is no chapter thirty. There is now.',
        ] },
        institute: { title: 'Chapter Thirty: The Merchant', lines: [
          'The Voice: (on the air) Brothers and sisters, do not weep. Chapter thirty: "And the Beast shall sup with the merchant."',
          'The Voice: It is WRITTEN. We misread the date again. It only makes us stronger. Keep your donations coming.',
          'You: (log) There is no chapter thirty. There is now.',
        ] },
      },
      loyal: { title: 'The Visitor Said No', lines: [
        'The Voice: (on the air) Brothers and sisters, the Visitor was TEMPTED. The peace people. The man with the laser. And the Visitor said NO.',
        'The Voice: Open your purses. Every drop the Visitor makes from this day starts with the tithe of the faithful.',
        'You: (log) I did not say no. I said nothing for a day. Apparently that counts.',
      ] },
      loyalPerk: 'tithe',
      coda: { title: 'Chapter Thirty-One', lines: [
        'The Voice: (the last broadcast) It ended, brothers and sisters. Not with us. But it ENDED, and that is the main thing.',
        'The Voice: We will be writing chapter thirty-one. You are in it, brother. You are beasts two and three.',
      ] },
    },
    // Collins, Oct 3 2026: "The Voice, a radio preacher ...: You are the sign. The world must end for the Awaited One to
    // come. Let us help you end it." (His note says 40 stations; on Oct 1 he had it as tens of thousands in sync, so that
    // the ship would notice. The card names no number: OPEN, notes/CAMPAIGN-BEATS.md.)
    contact: { title: 'A Sermon on Every Station', lines: [
      'YOKE: Radio. One preacher, the same sermon on every station he has at the same second, pointed straight up. He calls himself the Voice.',
      'YOKE: He says you are the sign. That the world must end for the Awaited One to come. And that they would like to help you end it.',
      'You: (log) The fauna have a radio preacher, and he is expecting me. I will go down by hologram and hear him out.',
    ] },
    signal: { lat: 54, lon: 9, how: 'a sermon on every radio station' },
    beats: [
      // Collins, Oct 3 2026: "Your hologram appears in a grand religious structure (closer to a mosque than a church) with one
      // preacher bowing in front of you."
      { id: 'signs', title: 'The Sign', afterCaptures: 0, perks: ['sleepers1'], scene: { title: 'Tools for the Mission', film: 'faithful-signs', lines: [
        'The Voice: (bowing before the hologram) Your coming was prophesied in our texts.',
        'The Voice: They told of a great figure who would come in a chariot of fire, to cull the rotten people of this world.',
        'You: (taken aback) Well, come on. You are not that rotten, are you? Not all of you.',
        'The Voice: No. Truly, we, even I, have the heart of a sinner.',
        'You: But you try, with all the capacity God has gifted you. Do you not?',
        'The Voice: And yet you are still here to reap us, are you not? We all have our part in God\'s plan.',
        'You: (scratching his chin) True enough.',
        'The Voice: (rising, hands raised) The faithful will take part in your glorious mission.',
        'The Voice: (pointing to a pile of vests) We have prepared tools to see your mission fulfilled.',
        'You: (pacing on his ship, the feed cut) Oh, fuck. Were those suicide vests? Fuck. Fuck, fuck, fuck.',
      ] } },
      // "You appear in the room of the preacher, a grand room reminiscent of the pope's room in the Vatican."
      { id: 'prophecy', title: 'The Will of God', afterCaptures: 1, perks: ['garrison'], scene: { title: 'It Is Agreed, Then', film: 'faithful-prophecy', lines: [
        'You: (by hologram, in the preacher\'s chambers) Do you know how hard it has been to fucking contact you?',
        'You: Look. Knock off the suicide vest thing.',
        'The Voice: (a hand on his chest, bowing) Does it not make your job easier?',
        'You: (begrudgingly) Yes.',
        'The Voice: Then it is the will of God. Has God given you authority to speak on His behalf?',
        'You: (sheepish) No. He has not.',
        'You: Look, I just want to help you guys.',
        'You: Maybe I could uplift your congregations before other people, so you don\'t have to suffer.',
        'The Voice: (smirking) Ah. So pre-millennial or post-millennial. Both were possible, because it was a choice.',
        'The Voice: And one I must make, none the less.',
        'The Voice: (thinking) Is the soul not edified through suffering? Is the deed not made more glorious by its difficulty?',
        'You: Well, I really don\'t think you should be making that decision for other people. Or, um. Well. Weird insect monsters.',
        'The Voice: But God has put me in a position where I must, has He not?',
        'The Voice: Meaning it is His will that it is my decision.',
        'You: (shrugs) Sure. I guess.',
        'The Voice: It is agreed, then. We will send militants to help you hold your territories, so that your mission may not be retarded.',
      ] } },
      { id: 'prepare', title: 'The Ablim', afterCaptures: 3, perks: ['sleepers2'], scene: { title: 'A Slave to God\'s Will', film: 'faithful-prepare', lines: [
        'You: (by hologram, in his chambers again) Any chance I can talk you out of the suicide vest thing?',
        'The Voice: (smirking, one hand raised wisely) Have you beheld the glory of God yourself?',
        'You: (shakes his head) No.',
        'The Voice: But you are an Ablim, are you not?',
        'You: Maybe describe an Ablim.',
        'The Voice: In our holy scriptures there are described powerful beings. Warriors more powerful than anything we can imagine.',
        'The Voice: They fly on chariots of fire from the stars, and they guard God\'s will.',
        'You: Huh. Yeah. I am probably an Ablim, then.',
        'The Voice: And you are as much a slave to God\'s will as we are. Our scholars had long debated that point.',
      ] } },
    ],
    pledge: { title: 'The Hour Is Near', film: 'faithful-pledge', lines: [
      'You: (a broadcast to the whole planet) People of this planet. Your scriptures told of one who would come in a chariot of fire.',
      'You: I am told that is me. The Hour is near.',
    ] },
    asides: [
      'The Voice (broadcast): …and the Visitor walks the terraces as it was written. Keep your radios on, brothers and sisters. Keep your donations coming.',
      'The Voice (to you, on the air): Homework, brother. Chapter nine: the Four Beasts. You are, we believe, beasts two and three.',
      'You: (log) Chapter fourteen contradicts chapter nine. The Voice says this is the most sacred part. Requesting transfer.',
      'The Voice (broadcast): Line one, you are on The Hour Is Near. "Is the Visitor the Deceiver or the Deliverer?" Sister — why not BOTH.',
      'The Voice (to you, on the air): A test, brother. Which city falls on the day of the three lamps? … No. No. Read it AGAIN.',
      'The Voice (broadcast): The other faith says THEIR book foretold the Visitor first. Their book is a forgery of our forgery.',
      'The Voice (to you, on the air): Chapter twenty, brother: the Comb Above, where every sister taken up wakes in the hall she dreamed of. Summarise it for the congregation.',
      'You: (log) Chapter twenty is the afterlife. It is remarkably accurate. Summarised it on the air in one sentence. The Voice says I lack reverence.',
      'You: (log) Have now read the Book four times, the commentaries twice, and a pamphlet about the commentaries. I outrank their clergy. I hate it here.',
    ],
    finale: 'seventh-city',
    // Collins, Oct 3 2026: "The large central church is surrounded by creep as it's beginning to burst in; just as it collapses
    // everyone is right back where they were, back in the pews, and your hologram appears." He marked this one "probably needs a
    // rewrite for clarity that still maintains both characters' perspectives": the preacher's accusation is REWRITTEN here (he
    // took the Visitor for a godless alien who had studied the Faith and was only pretending to care for the martyrs, and he
    // played along because God makes tools of the witless); everything else is his. His original is in
    // notes/CUTSCENES-2026-10-03.md.
    ending: { title: 'That Is a Wrap', film: 'faithful-finale', lines: [
      'You: (by hologram, at the altar) All right, that is a wrap. Thanks for your help.',
      'The Voice: So. We are in heaven?',
      'You: I mean, that depends. How did your texts define heaven?',
      'The Voice: A land where we would await God, living in endless pleasure.',
      'You: (nods) Yeah. That describes this simulation pretty well.',
      'The Voice: (in horror) Simulation? Heaven is not a simulation! It is not made with technology!',
      'You: Um. Did your texts say that?',
      'You: Did the people who wrote them even have the capacity to describe something like this better than they did?',
      'The Voice: This is an abomination!',
      'You: (condescending) You once told me I should not speak on behalf of God. Now I say the same to you.',
      'You: You do not get to choose the shape of God\'s miracles.',
      'The Voice: (in anger) You tricked me! I took you for a godless alien who had studied our religion.',
      'The Voice: One who only pretended to care for our martyrs. And I played along, because God makes tools of the witless.',
      'You: (genuinely shocked) Wait. You thought I was just playing along this whole time?',
      'You: No. There is a damn reason your religious texts were so predictive of all this.',
      'You: (the hologram disappears) Ugh. This is not worth my time.',
    ] },
  },
  {
    id: 'institute', name: 'The Institute for Long-Term Hive Flourishing',
    perks: {
      volunteers1: 'Volunteers: missions start with 30 science.',
      volunteers2: 'More Volunteers: missions also start with 40 war and a royal point.',
      seedlabs: 'Seed Labs: deploy to territories that are not next to yours.',
      retainer: 'The Retainer (you stayed): the Institute pays to keep you — every mission starts with 25 more science.',
    },
    midpoint: {
      offers: {
        delegation: { title: 'A Cold Call: The Field People', lines: [
          'The Director: Hey — sorry, cold call. Cold laser. Our grad students found your hull. Look. The field-letter people.',
          'The Director: They are lovely. They are also a rounding error. Nobody in that field has ever opened a spreadsheet.',
          'The Director: I can give you science up front, labs that seed you anywhere, and a partner who can actually keep up with you.',
          'The Director: No pressure. Well, some pressure. I modelled it. You switch in sixty-two per cent of timelines.',
          'You: What happens in the other thirty-eight?',
          'The Director: I don\'t like to talk about the other thirty-eight.',
        ] },
        faithful: { title: 'A Cold Call: Zero Chapters', lines: [
          'The Director: Okay, real talk. You are doing theology homework. For a RADIO HOST.',
          'The Director: I listened to chapter nine on the drive in. You are beasts two and three. Is that the relationship you want?',
          'The Director: Come work with adults. Science on day one, labs anywhere, zero chapters.',
          'You: (log) The Director has offered me a job. The benefits package includes "zero chapters". It is a strong benefits package.',
        ] },
      },
      farewell: {
        delegation: { title: 'No Hard Feelings', lines: [
          'The Director: Okay. Okay. No hard feelings. I had you staying at ninety-one per cent, so honestly it\'s a model problem.',
          'The Director: I\'m sending a small invoice for the cryo-lab subjects. Not a big one. A symbolic one.',
          'The Director: The field people, though. Wow. Hope you like snacks.',
        ] },
        faithful: { title: 'You Picked the Radio Guy', lines: [
          'The Director: The radio guy. You picked the RADIO GUY.',
          'The Director: … I\'m fine. For the record, my post said this was a live possibility. Section four.',
          'The Director: I\'m going to go play a match.',
        ] },
      },
      loyal: { title: 'On Retainer', lines: [
        'The Director: I heard the radio guy pitched you. And the field. And you stayed. Respect. Genuinely.',
        'The Director: I\'m putting you on retainer. Science up front, every drop. It\'s not a bribe, it\'s a loyalty-adjusted expected-value transfer.',
        'You: (log) It is a bribe.',
      ] },
      loyalPerk: 'retainer',
      coda: { title: 'A Recording, on the Laser', lines: [
        'The Director: (a recording, on the laser) Hey. Saw the ending. Solid execution. Not how I\'d have done it.',
        'The Director: (a recording, on the laser) Anyway. The invoice is still open.',
      ] },
    },
    // Collins, Oct 3 2026: "you get a laser directed at your ship beaming a pattern that's decodable as a video feed ... you
    // open it up and send a corresponding laser sequence back to its source".
    contact: { title: 'A Laser on the Hull', lines: [
      'YOKE: A laser, from an observatory on the surface, aimed at our hull. It is flashing a pattern, and the pattern decodes as a video feed.',
      'YOKE: The feed names its sender: Eli Bankfried, Director of the Institute for Long-Term Hive Flourishing. To open it I send the matching sequence back down the beam.',
      'You: (log) Somebody down there has made a video call out of a laser. Opening it.',
    ] },
    signal: { lat: 51, lon: 82, how: 'a laser on the hull' },
    beats: [
      { id: 'machines', title: 'Stop the Machines', afterCaptures: 0, perks: ['volunteers1'], scene: { title: 'A Little Chat', film: 'institute-machines', lines: [
        'The Director: (feet on the desk, to someone off screen) Told you I could do it.',
        'You: Do what?',
        'The Director: Hack your comms system. So we could have a little chat, my man.',
        'You: (bewildered) You didn\'t hack anything.',
        'You: You sent a simple set of laser flashes that corresponded to audio and video layers, and I sent one back.',
        'The Director: (one knowing finger up) But we are talking now, aren\'t we? You see, hacking is as much a mental game as one of technology.',
        'You: (shaking his head) Sure. I guess. What do you want?',
        'The Director: (playing his video game) Here is the thing, my man. The most intelligent and ethically disciplined among our species have formed an organisation, if you will.',
        'The Director: (sets the game down, feet off the desk) The Institute for Long-Term Hive Flourishing.',
        'The Director: (tapping a line of powder out of a file) We dedicate every moment of our existence to the most rational and goal-oriented decision in that moment.',
        'The Director: (sniffing the powder off the desk) You get me?',
        'The Director: Anyway. Some idiot corpos, who only care about pleasure and money, and what they can extract from the world.',
        'The Director: They are recklessly building out impossible-to-control artificial intelligences. Just so they will have more money.',
        'The Director: (animated, pointing) Well, you took out one of their biggest data centres in your first fall.',
        'The Director: Which makes it clear to me we are on the same page.',
        'The Director: Anything you need, man. I can get it for you.',
        'You: (a little horrified) Um. Well. The only thing I really need are the bodies of your people.',
        'The Director: (lighting up) That works out great, man! I have got a few facilities full of tons of us on ice.',
        'You: (in shock) You what?',
        'The Director: (chuckling) Yeah. People will do anything to get out of dying. Like they had not even heard of crystallisation.',
        'You: (worried) And they trusted people like you with their frozen bodies?',
        'You: Um. Yeah. Sure. Send them. That will be useful on future broodfalls.',
      ] } },
      { id: 'pipeline', title: 'Build the Pipeline', afterCaptures: 1, perks: ['seedlabs'], scene: { title: 'Sex for Fun', film: 'institute-pipeline', lines: [
        'You: Um. Were you trying to get in touch with me?',
        'The Director: (finger guns, still playing his game) So here is the thing, my man. You keep having me send you frozen old people.',
        'The Director: But you are a male, right?',
        'You: (looking around, almost worried) Yes?',
        'The Director: Well, don\'t you want any young, hot women? Or guys. No judgment here, man.',
        'You: (in horror) What?',
        'The Director: (holding up a magazine, pointing at its cover) You know. I thought that was the point of conquering the stars.',
        'The Director: Getting to fuck hot females, but with, like, a green or a blue tint to them.',
        'You: But I would not be able to reproduce with your women. Our species are not remotely biologically compatible.',
        'The Director: (sets the game down, leans in) Nah, man. You have just got to be creative. You would figure something out.',
        'The Director: I am sure I would, if I had access to some hot alien mamacitas.',
        'You: (shaking his head) No. I mean at a genetic level. Even with our technology it would be difficult to create a viable offspring.',
        'You: We have no shared evolutionary history.',
        'The Director: (laughing) What are you talking about, bro? I mean sex for fun.',
        'The Director: Most of the women I sleep with are workers, and can\'t even get pregnant.',
        'The Director: You see, we figured out this better way of structuring relationships, where we share partners.',
        'The Director: And I have got plenty who would be happy for a beam up.',
        'You: (sputtering) But what about disease risks? And the time it would take to court that many partners?',
        'The Director: Bro. Bro. Be rational. It is the most logical way to structure a relationship.',
        'You: (mouth agape, then it dawns on him) Wait. Has your species not discovered masturbation yet?',
        'The Director: (laughing) Bro. Masturbation is for poor people.',
        'You: (cuts the feed, under his breath) I need to pray. And take a shower.',
      ] } },
      // The ultimatum is no longer a choice (Collins's script of Oct 3 2026: he asks for both things in one breath, and the
      // answer is "sure, I guess, do that"). The id stays for saved games.
      { id: 'ultimatum', title: 'Rule the Rest', afterCaptures: 2, perks: ['volunteers2'], scene: { title: 'Running Out of Frosties', film: 'institute-ultimatum', lines: [
        'You: You were trying to get in touch with me?',
        'The Director: My man. Let\'s have a chat.',
        'The Director: So. I have sent you a lot of frosties.',
        'The Director: And by now it is getting pretty obvious you are not here just to get rid of data centres.',
        'You: (to himself, in his head) So he is not a complete imbecile.',
        'The Director: So here is the thing. I am a rational, logical guy, and I know I can\'t fight back against you.',
        'The Director: And this world order you are destroying was kind of fucked up anyway.',
        'The Director: (excited) We have actually been sketching up some plans to replace it for a while.',
        'The Director: Have you heard of quadratic voting? Okay, hear me out.',
        'The Director: (gesticulating) Programmatic, self-verifying contracts.',
        'The Director: (as if he had been distracted) Oh, yeah. The point. You and I are friends, right?',
        'The Director: So when you are done with whatever you want to do with our planet, just set me up to rule the rest.',
        'The Director: And I will help you.',
        'The Director: People. That is what you want. Well, I am running out of frosties, so going forward I will have to recruit people.',
        'The Director: My plan is to tell them you are going to digitise them if they willingly surrender.',
        'The Director: Because, like, running a simulation does not cost a species at your level of technology much.',
        'You: (shaking his head) Sure. I guess. Do that.',
      ] } },
    ],
    pledge: { title: 'For Your Own Safety', film: 'institute-pledge', lines: [
      'You: (a broadcast to the whole planet) People of this planet. Your species is recklessly building advanced artificial intelligence.',
      'You: You had a chance to rein yourselves in. So we have come to rescue you from the greedy corporations.',
    ] },
    asides: [
      'The Director (on the laser, mid-match): Sorry — push mid, PUSH MID — sorry. So how many cities this week? Nice. Big-brain play.',
      'The Director: I told my board you are the only mind on this planet I can have a real conversation with. They took it personally. Anyway: females. Standing offer.',
      'The Director: We should duo queue sometime. I main Broodmother in League of Larvae. It felt respectful.',
      'The Director: Quick one — the upload waitlist. I have moved myself to the front. Leadership has to be tested first. For safety.',
      'The Director: I wrote a forty-page post on why helping you is the ethical choice. It has a steelman section. You are the steelman.',
      'You: (log) The Director lasered me during a raid to ask whether I had "considered polyamory as an alignment strategy". I have not. I did not ask what alignment is.',
      'The Director: Our old AI lab? Shut down. Honestly, thanks to you. I was always the one warning about it. I want that on the record.',
      'The Director: Quick one, off the record — the upload. You know that I know, right? (winks) Great bit. Keep it running. It is doing wonders for morale.',
      'You: (log) The Director winked at me about the upload. I do not know what the wink means. The queue is on schedule.',
    ],
    finale: 'glass-spires',
    // Collins, Oct 3 2026: "It ends with the tower he is in surrounded by creep; then he runs to a safe room, pushing others out
    // of the way to get there; in the next scene he and the people in the room are in a serene meadow and your hologram appears."
    ending: { title: 'What Do You Mean, a Simulation', film: 'institute-finale', lines: [
      'The Director: (in a meadow, storming up to the hologram) Hey, man. What the fuck is this shit?',
      'The Director: You were going to let me rule what is left of my people.',
      'You: Of course. And I created a simulation where you can do that.',
      'The Director: The fuck do you mean?',
      'You: Well, it would be wildly unethical to allow someone of your character to rule over any real population of sentient people.',
      'The Director: No, shit bag. What do you mean about a simulation?',
      'You: (confused) As you said. Obviously a species as advanced as mine has the capacity to simulate people at trivial cost.',
      'You: Why did you think we were sending bio-organisms to your surface?',
      'You: If our goal was to kill you, it would have been much easier to just microwave your planet.',
      'You: Or force-evolve an organism that converted your atmosphere into a poisonous gas.',
      'You: (shaking his head) Why do you think we were even here? There are dozens of other planets even in your system.',
      'You: Yours was only unique in having sentient life.',
      'You: Once you reach our level of civilisational complexity, scarcity of things like energy and space is trivial.',
      'You: Only independently evolved cultures and species have value.',
      'The Director: (livid) So the digitising people thing. That was real?',
      'You: (looking around, confused) Of course. That is why I let you tell people it.',
      'You: It would be unethical to tell them that if it was not true.',
      'The Director: So why? Why did you want to work with me?',
      'You: Well, you had a bunch of people in cryo pods.',
      'You: They would have died if the power went off before the creep got to them.',
      'You: It seemed like an easier way to get them. Plus, leaving them with you didn\'t seem very ethical.',
      'You: I mean, you don\'t even follow God.',
      'The Director: What are you talking about, God?',
      'The Director: The religion on our planet was just some bullshit about how there was going to be some apocalypse.',
      'The Director: And living forever after death in some bullshit feel-good fantasy.',
      'You: (gestures around at the meadow; the hologram disappears)',
    ] },
  },
];

// ---------------------------------------------------------------------------
// Voices of the ship.
// ---------------------------------------------------------------------------
/** The character's cheerful personal logs after deployments. */
export const LOGS_WON = [
  'Personal log. Clean deployment! The asset ate a bus. I think it liked the bus.',
  'Personal log. Wave twelve went sideways and then it went fine. Standing is standing.',
  'Personal log. Tried a new layout. The bone forge beside the gut is VERY satisfying.',
  'Personal log. Filled in the form in triplicate. Nobody will read it. That is the system working.',
];
export const LOGS_LOST = [
  'Personal log. Lost the asset. They grow another. I grow another form.',
  'Personal log. Well. The locals had a good day.',
  'Personal log. Note to self: the east gate is not a suggestion.',
];
/** The Procreation Licensing Board's form letters. */
export const BOARD_LETTERS = [
  'The Board acknowledges receipt of your service metrics. No action is required at this time.',
  'The Board notes your application remains under review. Please do not contact the Board.',
  'The Board congratulates you on your continued eligibility to remain eligible.',
];
