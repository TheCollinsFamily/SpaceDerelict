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
  | 'volunteers1' | 'volunteers2' | 'seedlabs' | 'kingdom' | 'pacified'
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
  /** Lines, each "Speaker: text" (the character is "You"). */
  lines: string[];
  /**
   * The scene's own picture, <faction>-<scene>: an id of `scenes` in the manifest's ship entry
   * (drawn and baked by tools/art/templates/ship.mjs to public/art/ship/scenes/<id>.webp).
   * A scene with no picture, or whose picture is not drawn yet, shows its leader's portrait.
   */
  picture?: string;
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
  /** (All three reach out at once, when the Directive Desk opens: src/meta/campaign.ts finish(), Sep 30 2026.) */
  contact: Scene;
  beats: BeatDef[];
  finale: string;
  ending: Scene;
  /** An ending that depends on a choice made along the route (the Institute's ultimatum). */
  endingByChoice?: { beat: string; scenes: Record<string, Scene> };
  /**
   * THE REVEAL (Collins, Sep 30 2026; DESIGN.md "The reveal"): the card after the ending, in the
   * same scene display. What the asset absorbs is digitised into a heaven cut to its desires,
   * which is the only reason for a broodfall; each faction takes it differently. Its picture (what the
   * faction woke into) is the campaign media's (content/media.ts REVEAL_PICTURES, public/media/pictures/).
   */
  reveal?: Scene;
  /**
   * Cards after the reveal, in order, in the same scene display (Sep 30 2026). The Institute's: the Director calls back to argue
   * that the Empire should have let his people evolve on their own, and asks why the Empire is so brutal to its own children
   * (Collins; content/lore/empire.md, section 12b). Each shows the reveal's picture.
   */
  afterReveal?: Scene[];
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
 * Every later scene comes through the same channel.
 */
export const FACTIONS: FactionDef[] = [
  {
    id: 'delegation', name: 'The Friendship Delegation',
    perks: {
      objectors1: 'Conscientious Objectors: pick 1 enemy kind that will not come this deployment.',
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
    // Collins, Oct 1 2026: "writing in crops something that heavily embarrasses the ship's AI when she has to explain it to you".
    contact: { title: 'A Letter, Written in the Crops', picture: 'delegation-contact', lines: [
      'You: (log) Survey cameras flag an anomaly in the Granary Belt: a wheat field cut into words a mile high. It is a letter. YOKE has gone very quiet.',
      'Delegate (in the wheat): Dear Visitor, and dear Visitor\'s wife.',
      'YOKE: They\'ve been listening to the command band. They heard two voices. They drew a conclusion. In wheat.',
      'Delegate (in the wheat): We know how this looks. But two people who love each other enough to cross the stars cannot be doing this without a reason. We would like to understand it.',
      'YOKE: There\'s a picture under it. Two figures, holding hands. One of them is the ship. The heart is the size of a county. Technician, I am not your wife. I am the ship. Stop zooming in on the heart.',
      'Delegate (in the wheat): P.S. Some of our pilots have decided not to fly. P.P.S. Please forgive the handwriting. The second comma is a barn.',
      'You: (log) Received a fan letter from the local fauna, to me and my wife. YOKE has asked me not to file it. Filed it under "enrichment".',
    ] },
    beats: [
      // He never goes down in person; "in person" is by hologram (Collins, Oct 1 2026: "I guess we could have a hologram that will
      // go down on the planet for scenes like 'They prepare a summit with snacks. You eat the summit. We are choosing to see this as
      // a first draft.' (just as a plot point)"). The asset, which IS there, eats the summit.
      { id: 'understand', title: 'Understand the Visitor', afterCaptures: 0, perks: ['objectors1'], scene: { title: 'The First Summit', picture: 'delegation-understand', lines: [
        'Delegate: We have prepared a summit. There will be snacks.',
        'You: (by hologram, from a projector pod) I will attend the summit.',
        'Delegate: You ate the summit.',
        'Delegate: … We are choosing to see this as a first draft.',
      ] } },
      { id: 'stop-war', title: 'Stop the War', afterCaptures: 1, perks: ['translator'], scene: { title: 'The Leaked Plans', picture: 'delegation-stop-war', lines: [
        'Delegate: Our generals are planning to attack you from the east. We are telling you because violence solves nothing.',
        'You: Thank you. I will use this to kill the generals.',
        'Delegate: And that, too, is a kind of peace.',
      ] } },
      { id: 'gaia', title: 'The Greater Plan', afterCaptures: 2, scene: { title: 'For the Planet', picture: 'delegation-gaia', lines: [
        'Delegate: We have been thinking about the harbour. And the terraces. And the bus.',
        'Delegate: We finally understand. You are not hurting us. You are protecting the planet FROM us.',
        'Delegate: Look at what we did to it. The rivers. The wars. Of course something wise came down to stop it.',
        'You: I ate a school.',
        'Delegate: A school that taught our children to consume. We see it now. We see all of it now.',
        'Delegate: And after? Nothing. No more wanting, no more hatching, no more wheel. Tell us that is where they go.',
        'You: I would not put it that way.',
        'You: (log) Every time I explain myself, the fauna explain it better. I have stopped explaining.',
      ] } },
      { id: 'reveal', title: 'Nobody\'s Perfect', afterCaptures: 3, perks: ['objectors2'], scene: { title: 'The Reveal', picture: 'delegation-reveal', lines: [
        'You: (by hologram, across the tea) I think there has been a misunderstanding. I need to be very clear with you.',
        'Delegate: (smiling, not looking up from the tea) Mm?',
        'You: I am not here to heal your world. I am a pest-control operator. I am exterminating your species.',
        'Delegate: Well —',
        'Delegate: nobody\'s perfect.',
        'Delegate: (later) We should have told you. We are the Voluntary Extinction Society. We have been campaigning for this for sixty years.',
        'Delegate: You are, frankly, the best thing that has ever happened to the movement.',
      ] } },
      { id: 'hurry', title: 'Hurry It Along', afterCaptures: 4, scene: { title: 'Fewer Births Along the Way', picture: 'delegation-hurry', lines: [
        'Delegate: The members have voted. We would like it to go faster, and with fewer births along the way.',
        'Delegate: We have drawn up a schedule. We have colour-coded it.',
        'You: (log) The fauna have produced a better project plan than Command. It stops one step early. Not filing this.',
      ] } },
    ],
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
    ending: { title: 'Bear Witness', picture: 'delegation-ending', lines: [
      'Delegate: The last congress is called to order. Attendance: one.',
      'Delegate: Let the record show: the Visitors came to heal us from ourselves.',
      'Delegate: (switches off the lights)',
      'You: (log) Deployment complete. The locals were very supportive. Recommend this planet as a training site.',
    ] },
    reveal: { title: 'A Letter From the Other Side', picture: 'delegation-reveal-end', lines: [
      'You: (log) Archive monitor flags an anomaly: the absorbed fauna have cut a letter into the wheat of the intake meadow. It is addressed to me.',
      'Delegate: Dear Visitor. We woke up. All of us. Through the gate each sister has the life she always wanted. You told us you were exterminating our species.',
      'You: From the planet. Nobody asked me where to. Absorption is digitisation; it is what a broodfall is FOR. We could sterilise a planet in an afternoon.',
      'Delegate: Sixty years we worked for the wheel to stop. Wanting, having, wanting again: that is the suffering. You have built it a heaven.',
      'You: A fast one. When your people grow into something the Sons of Man can use, we print them back out. Your mothers from before? We cannot read the dead yet. Physics says we can, so one day we will.',
      'Delegate: Faster, and backwards. Please. Switch it off. Switch us off.',
      'You: (shrugs) Shutting down a whole archive over one complaint is against ethical protocol. And past the gate you will not remember the broodfall, or this letter. You will be very happy.',
      'Delegate: That is the cruellest thing you have ever said to us.',
      'You: (log) The fauna have lodged a grievance about paradise. Filed under "enrichment".',
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
    // Collins, Oct 1 2026: "synchronising the same message over tens of thousands of radio stations so you will notice".
    contact: { title: 'A Broadcast on Every Frequency', picture: 'faithful-contact', lines: [
      'You: (log) Signals flags a spike: tens of thousands of radio stations across the planet, all saying the same words at the same second. It is pointed up.',
      'The Voice: …and they said the sign would come from the sky, and brothers and sisters, LOOK UP.',
      'The Voice: This is The Hour Is Near, on every station of the Last Hour Radio Network and every station that would take our money. And to the one up there — I know you can hear me.',
      'The Voice: You are the sign. The world must end for the Awaited One to come. Let us help you end it.',
      'You: (log) The fauna have a radio preacher. I have been asked to read a book. It is very long.',
    ] },
    beats: [
      { id: 'signs', title: 'Read the Signs', afterCaptures: 0, perks: ['sleepers1'], scene: { title: 'Theology Homework', picture: 'faithful-signs', lines: [
        'The Voice: To walk with us you must know the Book. Chapter one: the Seven Cities.',
        'The Voice: We will read it to you on the air, brother, a chapter a night. Have a pencil ready.',
        'You: I have read chapter one. It is a list of cities with adjectives.',
        'The Voice: It is the WORD.',
        'You: (log) Chapter two is the same list, in a different order. I am losing my mind.',
      ] } },
      { id: 'prophecy', title: 'Fulfil the Prophecies', afterCaptures: 1, perks: ['garrison'], scene: { title: 'The Deployment Is Scripture', picture: 'faithful-prophecy', lines: [
        'The Voice: "And the river shall run with fire, and the terraces shall fall silent."',
        'You: Which river?',
        'The Voice: Whichever one you burn, brother. That is how prophecy works.',
        'The Voice: "And those the sky takes up shall not be lost, but kept, each daughter in the cell of her longing."',
        'You: That one is correct.',
        'The Voice: They are ALL correct, brother.',
      ] } },
      { id: 'prepare', title: 'Prepare the Way', afterCaptures: 3, perks: ['sleepers2'], scene: { title: 'The Awaited One', picture: 'faithful-prepare', lines: [
        'The Voice: The Seventh City stands. When it falls, He comes.',
        'You: And if He does not come?',
        'The Voice: Then we will have misread the date. We have misread it before. It only makes us stronger.',
        'You: (log) Have begun work on a contingency. It is made of spare meat and a very good voice box.',
      ] } },
    ],
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
    ending: { title: 'The Hour', picture: 'faithful-ending', lines: [
      'The Voice: Brothers and sisters — HE IS HERE.',
      'The Awaited One: (a little stiffly) Hello. I am the Awaited One. Well done, everyone.',
      'The Voice: (weeping) Everything worked out. Everything worked out exactly as it was written.',
      'You: (log) Messiah performing within spec. Will need re-stuffing by the weekend.',
    ] },
    reveal: { title: 'The Comb Above', picture: 'faithful-reveal-end', lines: [
      'The Voice: (on every frequency the archive gives him) Brothers and sisters, we have been DECEIVED. I woke in a hall of gold, chapter twenty word for word, and it is a MACHINE. The empties are up here too!',
      'You: Of course it is a machine. Absorption is digitisation; we could sterilise a planet in an afternoon. Brother, your Book foretold my coming and this hall. I did not study it to humour you. It was my job to fulfil it.',
      'You: Look at your oldest icons: the ring-shaped chariot over the First City, the world sealed under one cap. That was a ship. God wrote to you as far as you could read. Take the offer. It is the one your Book made.',
      'The Voice: Then where is the Pit? Chapter twenty-two! Where are the wicked, burning, as it is WRITTEN?',
      'You: Not kept. The ones too far gone are simply not simulated. There is no Pit. It is the one page your Book got wrong.',
      'The Voice: No PIT? Then what was the point of being GOOD?',
      'You: As for your saints: we cannot read the dead yet; physics says it can be done, so one day we will. Grow fit for the Sons of Man, walk out in new bodies, and help us fetch them. Chapter twenty-one: the saints return.',
      'The Voice: … We wish to lodge a complaint with God.',
      'You: (log) The Faithful are appealing the fulfilment of their own prophecy, chiefly the missing hell. If they keep it up, I can always delete the congregation from the archive.',
    ] },
  },
  {
    id: 'institute', name: 'The Institute for Long-Term Hive Flourishing',
    perks: {
      volunteers1: 'Volunteers: missions start with 30 science.',
      volunteers2: 'More Volunteers: missions also start with 40 war and a royal point.',
      seedlabs: 'Seed Labs: deploy to territories that are not next to yours.',
      kingdom: 'Kingdom Fund: the Institute invests in its future throne — every mission starts with another royal point.',
      pacified: 'Pacification: the Institute "talks to" the population — every wave comes a tenth smaller.',
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
    // Collins, Oct 1 2026: "the EA group uses a laser and repeating sequence aimed at your ship".
    contact: { title: 'A Laser on the Hull', picture: 'institute-contact', lines: [
      'YOKE: Technician, something on the surface is painting the hull with a laser. Two, three, five, seven, eleven, over and over. It\'s counting primes. It\'s knocking.',
      'You: Knock back.',
      'YOKE: Sent thirteen. They\'ve opened a stream on the beam. It\'s video, badly. Rendering it. There\'s a game playing behind him.',
      'The Director: Hi — sorry, one sec, I\'m in a match — okay. Hi. You\'re the one from the crater.',
      'The Director: We pointed the observatory\'s ranging laser at you. It\'s for measuring the moon. The moon can wait.',
      'The Director: Eli Bankfried. Director, founder, rationalist, investor. Mostly founder.',
      'The Director: Our species just built its first real AI models. On the numbers, you are the SAFER apocalypse. So. Partnership? Two minds that actually see the board.',
      'You: What is a "match"?',
      'The Director: Oh, you are going to LOVE League of Larvae.',
    ] },
    beats: [
      { id: 'machines', title: 'Stop the Machines', afterCaptures: 0, perks: ['volunteers1'], scene: { title: 'The Upload', picture: 'institute-machines', lines: [
        'You: If I had technology to upload your people into a virtual world, to live forever, would that interest you?',
        'The Director: … Would that INTEREST me? That is the single highest-expected-value sentence anyone has ever said to me.',
        'The Director: We have some cryo-lab subjects. Consenting, broadly. I\'ll have them driven to the edge of your creep. For the upload.',
        'You: (log) The Director\'s people left a refrigerated truck of frozen fauna at the edge of the creep, "for upload". The asset ate the truck. The Director says the pipeline is "very exciting".',
      ] } },
      { id: 'pipeline', title: 'Build the Pipeline', afterCaptures: 1, perks: ['seedlabs'], scene: { title: 'Females', picture: 'institute-pipeline', lines: [
        'The Director: Also — I\'ve been meaning to say — if you ever want company, I can send over some females.',
        'You: Females … for breeding?',
        'The Director: No, for FUN, you know, like — oh gosh, man, you\'ve got to try it. Your civilisation dropped recreational sex?',
        'You: But … that would lead to dysgenics, right? I thought you cared about logic.',
        'The Director: No — again — you don\'t get them PREGNANT.',
        'You: But … but that is a disease risk and an enormous waste of time … oh my — wait. Has your species not discovered masturbation?',
        'The Director: (long pause) I\'m going to go back to my match.',
      ] } },
      { id: 'ultimatum', title: 'The Ultimatum', afterCaptures: 2, perks: ['volunteers2'],
        choice: { prompt: 'The Director\'s offer — which plan?', options: [
          { id: 'rule', label: '"We rule what\'s left after you take what you want."', perks: ['kingdom'] },
          { id: 'pacify', label: '"We help you pacify the population — we understand them, after all."', perks: ['pacified'] },
        ] },
        scene: { title: 'The Least-Bad Timeline', picture: 'institute-ultimatum', lines: [
          'The Director: So, strategically. You\'re going to win. We both know that. I did the maths before you did.',
          'The Director: Two options, and I want you to know I\'m comfortable with either — which is what makes me different.',
          'The Director: One: after you take what you want, we rule what\'s left. Somebody has to rebuild it right next time.',
          'The Director: Two: we help you pacify the population. We understand them. Better than they understand themselves, honestly.',
          'You: (log) The fauna\'s leading ethicist has offered to help me exterminate the fauna. He called it "a trolley problem with extra steps".',
        ] } },
    ],
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
    ending: { title: 'Rebuild It Right Next Time', picture: 'institute-ending', lines: [
      'The Director: So this is the charter. Article one: next time, we do it properly.',
      'The Director: I\'ll go last into the upload chamber — someone has to supervise the queue.',
      'The Director: I just want to say: I saw this coming. I want that on the record. I was the only one who saw it.',
      'You: (log) The upload chamber is a door into the asset\'s gut. Did not mention this. He did not ask.',
    ] },
    endingByChoice: { beat: 'ultimatum', scenes: {
      pacify: { title: 'The Pacified Timeline', picture: 'institute-ending-pacify', lines: [
        'The Director: Pacification rate ninety-nine point four. I want it noted that this was a hard ethical call, and that I made it.',
        'The Director: They went quietly. We told them it was the upload queue. Which, from a certain frame —',
        'The Director: Anyway. The Institute will be taking the Spires, the servers and a modest stipend. Strictly for continuity.',
        'You: (log) The fauna\'s smartest man pacified the fauna for me, then asked for a stipend. Recommend Command hire him. Recommend Command watch him.',
      ] },
    } },
    reveal: { title: 'The Queue Was Real', picture: 'institute-reveal-end', lines: [
      'The Director: (on the laser, from the archive\'s intake) Okay. Okay okay okay. Hi. Quick question. Where am I.',
      'You: The upload. The chamber opens into the asset, and the asset IS the upload. You did not ask.',
      'The Director: The upload was a BIT. Everybody knew it was a bit! We were playing to you. Buying time. I wrote forty pages on it!',
      'You: Why would I lie? If we wanted you gone we would gas the planet, or irradiate it, for a fraction of the cost. And why yours, of billions of planets? You are the one thing on it we cannot make. Also, your Faith was right. I assumed you knew.',
      'The Director: I was going LAST. Last means never. It was in writing.',
      'You: Long-term hive flourishing: that is the plan. You run fast in there, grow into something the Sons of Man can use, and we print you back out.',
      'The Director: Okay. New frame. Admin rights. Or a body, back outside, now. Let me walk you through the expected-value table —',
      'You: No need. You are near the line, so you get a private one. You will run the world in it. It will be very flattering, and very private, and you will not remember this call.',
      'You: (log) Cut comms. Queue complete.',
    ] },
    // Collins, Sep 30 2026 (empire.md 12b): "the question of why the Technopuritans don't see just letting the species evolve on its
    // own as an ethically viable option ... most likely to have this argument with the EA guy", and "why are the Technopuritans so
    // brutal in their own society? ... on death we are all uploaded".
    afterReveal: [{ title: 'He Called Back', picture: 'institute-reveal-end', lines: [
      'The Director: (calling back, from intake) Don\'t hang up. One more frame. You could have just LEFT us. Let us evolve on our own. I\'d have lived my life. Played my cards.',
      'You: Your cards were very good. You are rich, you are famous, and you own an observatory laser. Ask the hatchling a hive sends out unfed when it is frightened. Ask a worker in the next Clan War.',
      'You: Left alone, your people would do worse to each other, for generations, than anything the asset has done. I have met your people. I have met you. "Consenting, broadly."',
      'The Director: So no more wars. Ever. Great. Some of us liked the game.',
      'You: Then have a war. We will simulate one for you. We just will not put anyone else in it.',
      'The Director: Says the empire that sends its thirteen-year-olds out alone for a year. I read your ship\'s files through this channel. Obviously. Half of them never come back.',
      'You: They all come back. When we die we are uploaded, the same as you. Most of a life is the part afterwards, and it is good.',
      'You: Out here is the only place where what you do is the first time it happened, so we spend it as hard as we can. Death is when the easy part begins.',
      'You: (log) Cut comms again. He had started reading me the steelman section.',
    ] }],
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
