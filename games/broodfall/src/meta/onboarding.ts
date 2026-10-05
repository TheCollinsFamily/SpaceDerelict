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
import { EARTH_NEWS_FALLBACK, GREETINGS, earthNewsFrom, type GreetMoment, type Greeting } from '../../content/greetings';
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
  // The desk on the first try after mission 1 (deployment 2), or later (Collins, Oct 5 2026: "it needs something a bit
  // different if it's more than turn one").
  if (d.deskOpened) return prev.deployments >= 2 ? 'unlock-late' : 'unlock';
  if (d.repelled) return 'defended';
  if (d.lost && !d.captured) return 'fell';
  if (d.captured) return 'won';
  return deskOpen(next) ? 'lost' : 'lost-locked';
}

/**
 * One greeting for a moment: one she has not said this campaign while there is one (`said`), never the one she said last
 * time, and otherwise chosen by the campaign's seed and how far it has come, so a replay of the same campaign hears the
 * same words.
 */
export function pickGreeting(moment: GreetMoment, seed: number, turn: number, last?: string | null, pool: Greeting[] = GREETINGS, said: readonly string[] = []): Greeting {
  const fits = pool.filter((g) => g.moment === moment);
  const unsaid = fits.filter((g) => !said.includes(g.id) && g.id !== last);
  const fresh = unsaid.length ? unsaid : fits.filter((g) => g.id !== last);
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

/**
 * The reveal (src/ui/bmovie.ts playReveal: the ship fires the asset, "…AND YOU ARE THE ONE WHO SENT IT.") plays as
 * he comes aboard for the first time: mission 1 over, nothing deployed since, not seen before. A save from before
 * the unfolding (no `onboard`) or one past its first return never gets it.
 */
export function revealDue(s: CampaignState | null, seen: boolean): boolean {
  return !seen && !!s?.onboard && s.onboard.mission1 !== 'pending' && s.deployments <= 1;
}

/** Greetings for a return where nothing weighty happened: the mate review may take their place, once. */
const ORDINARY: GreetMoment[] = ['won', 'lost', 'lost-locked', 'back', 'defended', 'fell'];

/**
 * What she greets him with as he comes aboard now: what the last deployment left (s.greet), or
 * 'back'. Once, early (the first ordinary return after the first mission's greeting), the mate
 * review takes its place (Collins, Sep 30 2026: an early queued greeting; it points at the data
 * pad in his quarters, where the candidate's profile is).
 */
export function momentNow(s: CampaignState): GreetMoment {
  const m = s.greet ?? 'back';
  if (!s.onboard || s.onboard.mission1 === 'pending' || !s.lastGreeting || !ORDINARY.includes(m)) return m;
  // The early beats, one an ordinary return, in their order: the mate review, then the cat girl (who plays off it).
  const early = EARLY_ONCE.find((id) => !(s.said ?? []).includes(id));
  if (early) return early;
  // The personal plot, from its capture on (the first ordinary return that has reached it).
  return STORY_ONCE.find((b) => s.captures >= b.captures && !(s.said ?? []).includes(b.id))?.id ?? m;
}

/**
 * THE PERSONAL PLOT (Collins, Oct 5 2026): the third thread beside the ally's and the Roach King's, carried by YOKE's
 * greeting, once each, from its capture on: why the Index assigning him a partner matters (capture 5, the slot between
 * the ally's 4th and the main plot's next), then how it is going (capture 9). content/greetings.ts has the lines.
 */
export const STORY_ONCE: Array<{ id: GreetMoment; captures: number }> = [
  { id: 'partner-index', captures: 5 },
  { id: 'partner-progress', captures: 9 },
];

/**
 * THE ONCE INTROS (Collins, Oct 5 2026: "a collection of intros that won't accidentally be used twice in a mission if
 * you lose"): one-off greetings for ordinary returns, each said once a campaign (CampaignState.greetingsSaid, which a
 * lost mission does not undo), in this order, each from its capture on, and never two returns running, so her ordinary
 * lines still come between. `needs`: what must have happened first (the duck is a callback to the first-mission win;
 * the second cat girl plays off the first; the dad's names off the Board moving the file).
 */
export const INTROS: Array<{ id: string; captures: number; needs?: (s: CampaignState) => boolean }> = [
  { id: 'back-5', captures: 2 },
  { id: 'intro-barnabas', captures: 3 },
  { id: 'intro-duck', captures: 4, needs: (s) => s.onboard?.mission1 === 'won' },
  { id: 'intro-board', captures: 6 },
  { id: 'intro-catgirl', captures: 7, needs: (s) => (s.said ?? []).includes('catgirl') },
  { id: 'intro-audit', captures: 8 },
  { id: 'intro-dad', captures: 10, needs: (s) => (s.said ?? []).includes('partner-progress') },
];

/** The intro for this ordinary return, or null. */
export function introFor(s: CampaignState, pool: Greeting[] = GREETINGS): Greeting | null {
  const said = s.greetingsSaid ?? [];
  if (s.lastGreeting && INTROS.some((i) => i.id === s.lastGreeting)) return null;
  const next = INTROS.find((i) => !said.includes(i.id) && s.captures >= i.captures && (!i.needs || i.needs(s)));
  return (next && pool.find((g) => g.id === next.id)) ?? null;
}

/** Greetings said once each, early, on ordinary returns, in this order (Collins, Sep 30 2026). */
export const EARLY_ONCE: GreetMoment[] = ['mate-review', 'catgirl'];

/**
 * News from Earth may be told on an ordinary return once the early beats have all played (the
 * first mission's greeting, the mate review, the desk opening); on a save from before the
 * unfolding, on any ordinary return.
 */
export function earthNewsOpen(s: CampaignState): boolean {
  if (!s.onboard) return true;
  return s.onboard.mission1 !== 'pending' && s.onboard.deskOpen && EARLY_ONCE.every((id) => (s.said ?? []).includes(id));
}

/** One return in three, once it is open, she tells him the news from Earth instead. */
export const EARTH_NEWS_EVERY = 3;

/**
 * The greeting for coming aboard now: the moment's (momentNow), or on an ordinary return, now
 * and then a line of news from Earth out of the lore book (`lore`: its text). Never the line she
 * said last time.
 */
export function greetingFor(s: CampaignState, lore = ''): { moment: GreetMoment; greeting: Greeting } {
  const moment = momentNow(s);
  if (ORDINARY.includes(moment)) {
    const intro = introFor(s);
    if (intro) return { moment: 'intro', greeting: intro };
  }
  if (ORDINARY.includes(moment) && earthNewsOpen(s)) {
    let h = (s.seed ^ Math.imul(s.deployments + 7, 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    if (h % EARTH_NEWS_EVERY === 0) {
      const pool = earthNewsFrom(lore);
      const news = pool.length ? pool : EARTH_NEWS_FALLBACK;
      let i = (h >>> 8) % news.length;
      // The first item she has not read out this campaign (then any but the last one).
      for (let k = 0; k < news.length && ((s.greetingsSaid ?? []).includes(`earth-${i}`) || `earth-${i}` === s.lastGreeting); k++) i = (i + 1) % news.length;
      if (`earth-${i}` === s.lastGreeting && news.length > 1) i = (i + 1) % news.length;
      return { moment, greeting: { id: `earth-${i}`, moment, beats: [{ say: news[i], face: 'teasing', then: 'wink' }] } };
    }
  }
  return { moment, greeting: pickGreeting(moment, s.seed, s.deployments, s.lastGreeting, GREETINGS, s.greetingsSaid ?? []) };
}
