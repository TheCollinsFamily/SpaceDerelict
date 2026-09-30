/**
 * HOW THE GAME UNFOLDS FOR A NEW PLAYER (Collins, Sep 30 2026; DESIGN.md "THE CAMPAIGN",
 * "How it unfolds"). Pure rules, no DOM: main.ts, the ship and the tests call these.
 *
 *   "they think they downloaded some little nothing indie game that progressively unfolds
 *    into something bigger than what they expected ... oh tower defence that's neat then ...
 *    oh this is an interesting additional narrative layer."
 *
 *   1. The first launch ever: the opening cinematic, then straight into mission 1 (the crash
 *      site) with nothing on screen that speaks of a ship, a campaign or a globe.
 *   2. After mission 1, won or lost: the ship. YOKE greets him.
 *   3. The Directive Desk stays dark until the first win that is not mission 1. Until then the
 *      ship picks the next deployment. At that win the desk opens and all three factions call.
 *   4. Every return to the ship: a prewritten YOKE greeting that fits what just happened.
 *   5. Later launches: the ship's own console menu.
 */
import { HOME, TERRITORIES } from '../../content/campaign';
import { GREETINGS, type GreetMoment, type Greeting } from '../../content/greetings';
import type { CampaignState, Debrief } from './campaign';

/** Where a campaign is in its unfolding (older saves have none: everything is open for them). */
export interface Onboard {
  /** Mission 1, the crash site: not played yet, or how it ended. */
  mission1: 'pending' | 'won' | 'lost';
  /** The Directive Desk (the globe, choosing targets) is open. */
  deskOpen: boolean;
}

/** Mission 1 is fought at the crash site: the cinematic ends with the asset landing there. */
export const FIRST_MISSION = HOME;
/**
 * What mission 1 pays, win or lose: "we collected some data on that mission that should let
 * you upgrade the bioweapon" (Collins's line for YOKE). Enough standing for one sanctioned
 * lineage (the cheapest cost 2 to 3), so that her pointing at the Gene Bay is true.
 */
export const FIRST_MISSION_STANDING = 4;

export const onboardingOf = (s: CampaignState): Onboard | null => s.onboard ?? null;
/** The next deployment is mission 1. */
export const isFirstMission = (s: CampaignState): boolean => s.onboard?.mission1 === 'pending';
/** The Directive Desk is open (always, for a save from before the unfolding existed). */
export const deskOpen = (s: CampaignState): boolean => !s.onboard || s.onboard.deskOpen;

/**
 * The ship's own pick while the desk is dark: a counter-attack to defend first, else the
 * easiest landing site next to what is held (lowest tier, then the globe's own order).
 * `open` is the list of reachable targets (campaign.targets(s)), passed in to keep this
 * file free of a cycle with campaign.ts.
 */
export function shipPick(s: CampaignState, open: Array<{ id: string; tier: number }>): string | null {
  if (isFirstMission(s)) return FIRST_MISSION;
  if (s.underAttack) return s.underAttack;
  const order = (id: string) => TERRITORIES.findIndex((t) => t.id === id);
  const best = [...open].sort((a, b) => a.tier - b.tier || order(a.id) - order(b.id))[0];
  return best?.id ?? null;
}

/**
 * What YOKE greets him with after a deployment, from what it did to the campaign. The
 * weightiest thing that happened wins: the licence, the ending, the desk opening, ground lost.
 */
export function momentAfter(prev: CampaignState, next: CampaignState, d: Debrief, first: boolean): GreetMoment {
  if (first) return next.onboard?.mission1 === 'won' ? 'first-won' : 'first-lost';
  if (next.ended && !prev.ended) return 'ended';
  if (next.licence && !prev.licence) return 'licence';
  if (d.deskOpened) return 'unlock';
  if (d.repelled) return 'defended';
  if (d.lost && !d.captured) return 'fell';
  if (d.captured) return 'won';
  return deskOpen(next) ? 'lost' : 'lost-locked';
}

/**
 * One greeting for a moment: never the one she said last time (no repeats in a row), and
 * otherwise chosen by the campaign's seed and how far it has come, so a replay of the same
 * campaign hears the same words.
 */
export function pickGreeting(moment: GreetMoment, seed: number, turn: number, last?: string | null, pool: Greeting[] = GREETINGS): Greeting {
  const fits = pool.filter((g) => g.moment === moment);
  const fresh = fits.filter((g) => g.id !== last);
  const from = fresh.length ? fresh : fits.length ? fits : pool.filter((g) => g.moment === 'back');
  let h = (seed ^ Math.imul(turn + 1, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return from[h % from.length];
}

// ------------------------------------------------------------------ the launch

/** What the page opens to when it is started with no address of its own. */
export type Launch = 'first' | 'mission1' | 'menu';

/**
 * `hasCampaign`: a campaign is saved; `mission1Pending`: its first mission never finished;
 * `introSeen`: the cinematic has played to its end (or was skipped) once; `veteran`: this
 * browser played the game before the campaign existed (skirmish records).
 *   first     nothing on record: the cinematic, then mission 1
 *   mission1  the first mission was left before it ended: straight back into it (the ship,
 *             and the menu that shows it, are not seen before mission 1 is over)
 *   menu      the ship's console
 */
export function launchKind(o: { hasCampaign: boolean; mission1Pending: boolean; introSeen: boolean; veteran: boolean }): Launch {
  if (o.hasCampaign) return o.mission1Pending ? 'mission1' : 'menu';
  if (o.introSeen || o.veteran) return 'menu';
  return 'first';
}
