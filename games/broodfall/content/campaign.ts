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
  | 'volunteers1' | 'volunteers2' | 'seedlabs' | 'kingdom' | 'pacified';

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
  /** Who reaches out and when (captures, counting from the start of the campaign). */
  contactAfterCaptures: number;
  contact: Scene;
  beats: BeatDef[];
  finale: string;
  ending: Scene;
  /** An ending that depends on a choice made along the route (the Institute's ultimatum). */
  endingByChoice?: { beat: string; scenes: Record<string, Scene> };
  perks: Partial<Record<PerkId, string>>;
  /** The running jokes between beats: one letter / broadcast / call after every deployment while allied, through the faction's own channel. */
  asides: string[];
}

/**
 * HOW EACH FACTION REACHES HIM (Collins, Sep 29 2026: "how they contact you will be unique to
 * each faction but needs to make sense"). He is in orbit: nobody can hand him anything.
 *   The Delegation   have no transmitter and would not know where to point one. They write
 *                    letters, and eleven thousand members spell each one out in a field with
 *                    coloured cards, for his survey cameras.
 *   The Faithful     own forty radio stations. Everything the Voice says to him is said on
 *                    the air, in front of the whole congregation, his homework included.
 *   The Institute    booked their deep-space dish and call him by video on his own command
 *                    channel, with an expected-value table attached.
 * His answers go down through the ship's transmitter, on whatever they are listening to.
 * A later scene comes through the same channel unless the scene itself says otherwise (the
 * summit and the last congress he attends through the asset, which is there).
 */
export const FACTIONS: FactionDef[] = [
  {
    id: 'delegation', name: 'The Friendship Delegation', contactAfterCaptures: 1,
    perks: {
      objectors1: 'Conscientious Objectors: pick 1 enemy kind that will not come this deployment.',
      objectors2: 'More Objectors: pick 2 enemy kinds that will not come.',
      translator: 'The Translator: see the next wave\'s makeup and which entrance it comes from.',
    },
    contact: { title: 'A Letter, Spelled Out in a Field', picture: 'delegation-contact', lines: [
      'You: (log) Survey cameras flag an anomaly: eleven thousand fauna in a field, holding coloured cards over their heads. Seen from orbit it is a letter. It is addressed to me.',
      'Delegate: Dear Visitor. We know how this looks. We know what the newspapers are saying.',
      'Delegate: But we also know that an intelligence able to cross the stars cannot be doing this without a reason.',
      'Delegate: We would like to understand it. Some of our pilots, in the meantime, have decided not to fly.',
      'Delegate: P.S. Please forgive the handwriting. Page two took until Thursday, and the second comma had to sit down.',
      'You: (log) Received a fan letter from the local fauna. Filing it under "enrichment".',
    ] },
    beats: [
      { id: 'understand', title: 'Understand the Visitor', afterCaptures: 0, perks: ['objectors1'], scene: { title: 'The First Summit', picture: 'delegation-understand', lines: [
        'Delegate: We have prepared a summit. There will be snacks.',
        'You: I will attend the summit.',
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
        'You: (log) Every time I explain myself, the fauna explain it better. I have stopped explaining.',
      ] } },
      { id: 'reveal', title: 'Nobody\'s Perfect', afterCaptures: 3, perks: ['objectors2'], scene: { title: 'The Reveal', picture: 'delegation-reveal', lines: [
        'You: I think there has been a misunderstanding. I need to be very clear with you.',
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
        'You: (log) The fauna have produced a better project plan than Command. Not filing this.',
      ] } },
    ],
    asides: [
      'Delegate (letter, by field): The Harbour Committee has voted to thank you for the harbour. The vote was unanimous; the committee was eaten during the count.',
      'Delegate (letter, by field): Some of our pilots have taken up gardening instead of flying. You have given them so much.',
      'Delegate (letter, by field): A girl in our reading circle asked if you are sad. We told her you are carrying something heavy, for all of us.',
      'Delegate (letter, by field): We are writing you a song. It is mostly apologies, and one verse about the ozone.',
      'Delegate (letter, by field): The newspapers call it an invasion. We call it a correction. Enclosed, in the next field along: our newsletter, "Gentle Endings".',
      'Delegate (letter, by field): Our generals are massing again. We have hidden their boots. Violence solves nothing, but logistics solves a great deal.',
    ],
    finale: 'assembly',
    ending: { title: 'Bear Witness', picture: 'delegation-ending', lines: [
      'Delegate: The last congress is called to order. Attendance: one.',
      'Delegate: Let the record show: the Visitors came to heal us from ourselves.',
      'Delegate: (switches off the lights)',
      'You: (log) Deployment complete. The locals were very supportive. Recommend this planet as a training site.',
    ] },
  },
  {
    id: 'faithful', name: 'The Faithful of the Last Hour', contactAfterCaptures: 2,
    perks: {
      sleepers1: 'Sleepers: martyrs hide among the enemy waves and detonate among their own.',
      sleepers2: 'More Sleepers: more martyrs in every wave.',
      garrison: 'The Garrison: their militants hold the territories you take — no defence deployments.',
    },
    contact: { title: 'A Broadcast on Every Frequency', picture: 'faithful-contact', lines: [
      'The Voice: …and they said the sign would come from the sky, and brothers and sisters, LOOK UP.',
      'The Voice: This is The Hour Is Near, on forty stations of the Last Hour Radio Network. And to the one who came down — I know you can hear me.',
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
      'You: (log) Have now read the Book four times, the commentaries twice, and a pamphlet about the commentaries. I outrank their clergy. I hate it here.',
    ],
    finale: 'seventh-city',
    ending: { title: 'The Hour', picture: 'faithful-ending', lines: [
      'The Voice: Brothers and sisters — HE IS HERE.',
      'The Awaited One: (a little stiffly) Hello. I am the Awaited One. Well done, everyone.',
      'The Voice: (weeping) Everything worked out. Everything worked out exactly as it was written.',
      'You: (log) Messiah performing within spec. Will need re-stuffing by the weekend.',
    ] },
  },
  {
    id: 'institute', name: 'The Institute for Long-Term Hive Flourishing', contactAfterCaptures: 3,
    perks: {
      volunteers1: 'Volunteers: missions start with 30 science.',
      volunteers2: 'More Volunteers: missions also start with 40 war and a royal point.',
      seedlabs: 'Seed Labs: deploy to territories that are not next to yours.',
      kingdom: 'Kingdom Fund: the Institute invests in its future throne — every mission starts with another royal point.',
      pacified: 'Pacification: the Institute "talks to" the population — every wave comes a tenth smaller.',
    },
    contact: { title: 'A Video Call, Mid-Game', picture: 'institute-contact', lines: [
      'You: (log) Incoming video call on the command channel, which is encrypted. The caller has attached an expected-value table.',
      'The Director: Hi — sorry, one sec, I\'m in a match — okay. Hi. You\'re the one from the crater.',
      'The Director: I booked our deep-space dish for this. Nobody minded. We were only using it to listen for aliens.',
      'The Director: Eli Bankfried. Director, founder, rationalist, investor. Mostly founder.',
      'The Director: Look, I\'ll be honest with you, because I think you\'re the first being I\'ve met who can handle honesty.',
      'The Director: Our species just built its first real AI models. On the numbers, you are the SAFER apocalypse.',
      'The Director: So. Partnership? You and me. Two minds that actually see the board.',
      'You: What is a "match"?',
      'The Director: Oh, you are going to LOVE League of Larvae.',
    ] },
    beats: [
      { id: 'machines', title: 'Stop the Machines', afterCaptures: 0, perks: ['volunteers1'], scene: { title: 'The Upload', picture: 'institute-machines', lines: [
        'You: If I had technology to upload your people into a virtual world, to live forever, would that interest you?',
        'The Director: … Would that INTEREST me? That is the single highest-expected-value sentence anyone has ever said to me.',
        'The Director: We have some cryo-lab subjects. Consenting, broadly. I\'ll send them over. For the upload.',
        'You: (log) Received a shipment of frozen fauna "for upload". Fed them to the asset. The Director says the pipeline is "very exciting".',
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
      'The Director (on a call, mid-match): Sorry — push mid, PUSH MID — sorry. So how many cities this week? Nice. Big-brain play.',
      'The Director: I told my board you are the only mind on this planet I can have a real conversation with. They took it personally. Anyway: females. Standing offer.',
      'The Director: We should duo queue sometime. I main Broodmother in League of Larvae. It felt respectful.',
      'The Director: Quick one — the upload waitlist. I have moved myself to the front. Leadership has to be tested first. For safety.',
      'The Director: I wrote a forty-page post on why helping you is the ethical choice. It has a steelman section. You are the steelman.',
      'You: (log) The Director called during a raid to ask whether I had "considered polyamory as an alignment strategy". I have not. I did not ask what alignment is.',
      'The Director: Our old AI lab? Shut down. Honestly, thanks to you. I was always the one warning about it. I want that on the record.',
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
