/**
 * HOBBY MISSIONS — the character's own unofficial projects (DESIGN.md "Two mission tracks" and
 * "Hobby missions"; the notebook screen is src/ui/hobby.ts, built to the approved concept
 * notes/concepts/2026-09-29/r4-hobby-interface.png).
 *
 * A hobby mission is a page in his notebook. It OCCURS TO HIM when something happens on the
 * board (its `spark`: a measure of a finished run, e.g. "5 bodies burning at once" makes him
 * wonder whether fire jumps); two are there as soon as Command clears the Directive Desk. He
 * PINS one page to the next deployment (any deployment, the assigned ones too). On the board it
 * is a checklist: every step is a measure over the run (src/meta/goals.ts), all in the one
 * deployment; some pages change the run (`setup`, the same switches the experiments use). It
 * pays no standing and no field notes: it pays a UNIQUE GENE (content/plates.ts HOBBY_GENES),
 * spliced into the organism from the notebook, two at a time. Command notices ("Form 0-U"), files
 * it, and does nothing (the Empire Directives screen counts the notices).
 *
 * The sim is untouched by a page itself: its steps read RunStats, its setup is SimConfig. Only
 * the genes it pays carry new verbs (src/sim/sim.ts geneMods), each inert unless spliced.
 */
import type { SimConfig } from '../src/sim/types';
import type { GoalDef } from './campaign';

export interface HobbyDef {
  id: string;
  /** The page's own title, as he scrawled it. */
  title: string;
  /** Why it occurred to him: the "wouldn't it be cool" line, in his cheerful voice. */
  pitch: string;
  /** What makes him think of it: any of these met in a finished deployment. 'desk': there when the desk clears. */
  spark: 'desk' | Array<{ measure: string; target: number }>;
  /** What he wrote in his personal log the moment it occurred to him. */
  sparkLog: string;
  /** What changes on the board while the page is pinned (the experiments' switches). */
  setup?: Partial<SimConfig>;
  /** The checklist: every step must be met in the same deployment. */
  steps: GoalDef[];
  /** The gene it pays (content/plates.ts HOBBY_GENES). */
  gene: string;
  /** His note after it worked. */
  after: string;
  /** Which doodle is drawn on the page (src/ui/hobby.ts DOODLES). */
  doodle: 'flame' | 'book' | 'kite' | 'crown' | 'jar' | 'cradle' | 'pockets' | 'hearts';
}

/** A checklist step: never scaled by the territory's tier (the page is his, not Command's). */
const step = (id: string, text: string, measure: string, target: number, extra: Partial<GoalDef> = {}): GoalDef =>
  ({ id, title: text, text, measure, target, tierScale: 0, pays: 0, ...extra });

export const HOBBIES: HobbyDef[] = [
  {
    id: 'fire-jump', title: 'Does fire JUMP?', doodle: 'flame',
    pitch: 'When one of them catches, the one next to it catches. Does it ever stop? How many can I get going at once before it runs out of bug?',
    spark: [{ measure: 'stat:maxBurning', target: 5 }],
    sparkLog: 'Personal log. Five of them on fire at once and the fire walked from one to the next. Wrote a page about it.',
    steps: [
      step('burning', 'Get {n} of them burning at the same time', 'stat:maxBurning', 25),
      step('burn-kills', 'Let the fire itself finish off {n}', 'cause:burn', 60),
    ],
    gene: 'tallow-blood',
    after: 'IT DOES NOT STOP. Spliced the fat of the ones that burned best. Now fire never cools on its way between them.',
  },
  {
    id: 'recipe-book', title: 'The Recipe Book', doodle: 'book',
    pitch: 'Every limb I eat, the next one remembers it. What if I just keep feeding one limb to the next to the next? A family recipe!',
    spark: 'desk',
    sparkLog: 'Personal log. Started a recipe book. The asset is the cook and the ingredients. Do not tell the Board.',
    steps: [
      step('eat', 'Eat {n} of my own limbs into new ones', 'stat:cannibalized', 8),
      step('stack', 'One limb carrying {n} bonuses', 'stat:maxPips', 12),
    ],
    gene: 'grudge-marrow',
    after: 'The recipe works. Spliced it in: eating a limb now gives back half as much again.',
  },
  {
    id: 'sky-fishing', title: 'Sky fishing', doodle: 'kite',
    pitch: 'Their fliers go down so NEATLY. What if I just fish them out of the sky all day? A whole bag of them. Catch and eat.',
    spark: [{ measure: 'kills:flier', target: 5 }],
    sparkLog: 'Personal log. Downed some fliers. They spiral like seeds. I want a bag full.',
    steps: [
      step('fliers', 'Down {n} fliers in one deployment', 'kills:flier', 25),
      step('won', 'And win it', 'won', 1),
    ],
    gene: 'kite-string',
    after: 'Full bag! Spliced the netting glands up: netcasters come twice as often and whatever they catch stays down.',
  },
  {
    id: 'royal-taste', title: 'Royal taste test', doodle: 'crown',
    pitch: 'Does a royal taste different? The maws eat everything else. Get the maws REALLY hungry first, then serve the royal.',
    spark: [{ measure: 'kills:royal', target: 1 }],
    sparkLog: 'Personal log. We got a royal today. I did not taste it. I want to taste it. (The asset. The asset wants to.)',
    // No setup: a page never turns a landing site's directive into an easier one (the breaker's
    // line: pin it to a hold-12 site to make it a royal fight). Take it where a royal takes the field.
    steps: [
      step('eaten', 'Let the maws swallow {n} of them', 'cause:eaten', 25),
      step('royal', 'Then bring down the royal (take it where one takes the field)', 'kills:royal', 1),
    ],
    gene: 'royal-jelly',
    after: 'It IS the jelly. Spliced the taste for it: every royal, killed or swallowed, pays two royal points.',
  },
  {
    id: 'finders-keepers', title: 'Finders keepers', doodle: 'jar',
    pitch: 'Their science caste walks off with my limbs. Rude. What if I let them try, and then take them BACK, off the courier, halfway home? Twice.',
    spark: [{ measure: 'stat:limbsCarriedOff', target: 1 }, { measure: 'stat:limbsRecovered', target: 1 }],
    sparkLog: 'Personal log. A researcher stole a limb off the asset. The nerve. Have started a list.',
    steps: [
      step('recover', 'Kill {n} couriers while they carry one of my limbs', 'stat:limbsRecovered', 2),
    ],
    gene: 'homing-tissue',
    after: 'Got them back both times. Spliced in a homing tissue: now even the ones that get away pay me back what they cost.',
  },
  {
    id: 'nursery-rhymes', title: 'Nursery rhymes', doodle: 'cradle',
    pitch: 'The broodlings are so little and so ANGRY. How much can a nursery do on its own if the mothers are left alone to raise them?',
    spark: [{ measure: 'family:brood', target: 1 }],
    sparkLog: 'Personal log. A broodling bit a soldier twice its size. I clapped. Nobody saw.',
    steps: [
      step('brood-kills', 'Broodlings and their mothers make {n} kills', 'family:brood', 50),
      step('won', 'And win it', 'won', 1),
    ],
    gene: 'wet-nurse',
    after: 'The nursery ran itself. Spliced the milk: broodlings are born half as tough again.',
  },
  {
    id: 'hands-in-pockets', title: 'Hands in pockets, twice', doodle: 'pockets',
    pitch: 'The ground eats them by itself if the creep is angry enough. Could I win a whole wave without lifting a limb? And then keep the ground hungry all day?',
    spark: [{ measure: 'cause:creep', target: 3 }, { measure: 'stat:pacifistWaves', target: 1 }],
    sparkLog: 'Personal log. The creep ate one by itself today. I did not tell it to. Good ground.',
    steps: [
      step('creep-kills', 'The creep itself kills {n}', 'cause:creep', 40),
      step('pacifist', 'Clear a wave where my limbs deal no damage', 'stat:pacifistWaves', 1),
    ],
    gene: 'hitchhiker-spores',
    after: 'The ground did all the work. Spliced its spores: every tenth thing it eats buds a free creep node.',
  },
  {
    id: 'love-letters', title: 'Love letters', doodle: 'hearts',
    pitch: 'The mating gas worked but it made MORE of them. What if it is just the SMELL of a wedding, a little one, no babies? Enough to stop a soldier in the street and make him think about his life.',
    spark: [{ measure: 'stat:matingStuns', target: 1 }],
    sparkLog: 'Personal log. Two of their soldiers stopped in the street and held hands. Then the asset ate them. Wrote it down anyway.',
    setup: { matingMusk: true },
    steps: [
      step('pairs', 'Get {n} of them to pair off', 'stat:matingStuns', 40),
      step('won', 'And win it (under the full gas: more of them each wave)', 'won', 1),
    ],
    gene: 'wedding-musk',
    after: 'Bottled a weaker blend. Spliced it into the lure glands: their soldiers stop and pair off for a moment, and nobody extra comes.',
  },
];

/** The Board's notice when a page is finished (the Office noticed; the Office does nothing). */
export const HOBBY_NOTICE = 'Form 0-U · Irregular Use of Navy Property. The Office notes that asset BF-7 was deployed with an unlisted modification. No action is taken. This notice has been filed.';

/** How many unsanctioned genes the organism carries at once. */
export const HOBBY_SPLICE_SLOTS = 2;
