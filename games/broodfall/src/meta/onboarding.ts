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
import { HOME, MIDPOINT_CAPTURES, TERRITORIES } from '../../content/campaign';
import { EARTH_NEWS_FALLBACK, GREETINGS, earthNews, newsBeats, type EarthNews, type GreetMoment, type Greeting } from '../../content/greetings';
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
  // The licence and the ending no longer get a line of their own (Collins, Oct 26 2026: "legacy"; "lines are supposed to
  // spark interesting conversation, not a simple you won or lost"): those returns get her everyday talk.
  // The desk opens: his speech, on the first try after mission 1 or later (Oct 12 2026: the late version was cut;
  // Collins: "not needed, the first works for both").
  if (d.deskOpened) return 'unlock';
  if (d.repelled) return 'defended';
  if (d.lost && !d.captured) return 'fell';
  if (d.captured) return 'won';
  return deskOpen(next) ? 'lost' : 'lost-locked';
}

/**
 * One greeting for a moment: one she has not said this campaign while there is one (`said`), never the one she said last
 * time, and otherwise chosen by the campaign's seed and how far it has come, so a replay of the same campaign hears the
 * same words. When every line is said and one of them `repeats`, that one, again and again (Collins, Oct 12 2026: the
 * desk stays dark).
 */
/**
 * Which pool a moment draws on. Once the desk is open her everyday talk is one pool, won or lost (Collins, Oct 19 2026:
 * "its mission -> YOKE line -> mission -> YOKE line"; the loss lines were "mostly just junk and the win lines rarely
 * reference a win"). Oct 26 2026: he cut every counter-attack line too, so a counter-attack held or lost draws on it as well.
 */
export const poolOf = (m: GreetMoment): GreetMoment => (m === 'won' || m === 'lost' || m === 'back' || m === 'defended' || m === 'fell' ? 'talk' : m);

/** A number from the campaign's seed and a name: the same campaign always gets the same one. */
export function seeded(seed: number, name: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 2654435761) >>> 0;
  return Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
}

/**
 * WHAT A LINE IS ABOUT (Collins, Oct 26 2026: "reorder stuff so we don't have the same conversation or topic multiple times
 * in a row"). Read off the words, so a line added later is tagged without anyone tagging it. Her everyday talk and the
 * news never follow a line with one that shares a topic with it (when there is any other choice).
 */
const TOPICS: Array<[string, RegExp]> = [
  ['israel', /Sadducee|Pharisee|Israel|Jerusalem|goy beam|Third Temple|Dome of the Rock|holy lands/i],
  ['europe', /\bRome\b|Crusade|Caliphate|\bPope\b|Europe|France|Catholic/],
  ['america', /America|Baptist|Mormon|the States|Utah/],
  ['korea', /Korea|Ge-im|chaebol/i],
  ['houses', /Sons of (Korea|Igbo)|race mixing|genetic dilution|ethnic|Hologs?/i],
  ['india', /India|Hindu|Parsi/],
  ['nekos', /neko/i],
  ['rainbow', /rainbow|equal/i],
  ['dogs', /canine|\bdogs?\b/i],
  ['govern', /one.person.one.vote|governance|Loxodonta/i],
  ['death', /\bschool\b|afterlife|\bdeath\b|dying|value of a life|simulation/i],
  ['planet', /this species|their (news|radio|nursery|quiz)|caste|war caste|sisters|Crater Thing/i],
];
export function topicsOf(text: string): string[] {
  return TOPICS.filter(([, re]) => re.test(text)).map(([t]) => t);
}
const words = (g: Greeting): string => [g.beats.map((b) => b.say).join(' '), g.aside ?? ''].join(' ');
const shares = (a: string[], b: string[]): boolean => a.some((t) => b.includes(t));

/**
 * A line for the moment. Lines not yet said this campaign come first, in an order shuffled by the campaign's seed, so
 * each is said once and every campaign meets them in a different order (Collins, Oct 19 2026: "give it replayability";
 * the pool is bigger than a campaign, so a replay hears lines the last one did not). Only once all are said does one repeat,
 * never the last one said.
 */
export function pickGreeting(moment: GreetMoment, seed: number, turn: number, last?: string | null, pool: Greeting[] = GREETINGS, said: readonly string[] = [], avoid: string[] = []): Greeting {
  const fits = pool.filter((g) => g.moment === poolOf(moment) && (g.notBefore == null || turn >= g.notBefore));
  const unsaid = fits.filter((g) => !said.includes(g.id) && g.id !== last);
  const again = fits.find((g) => g.repeats);
  if (!unsaid.length && again) return again;
  if (unsaid.length) {
    const order = [...unsaid].sort((a, b) => seeded(seed, a.id) - seeded(seed, b.id));
    return order.find((g) => !shares(topicsOf(words(g)), avoid)) ?? order[0];
  }
  const fresh = fits.filter((g) => g.id !== last);
  const from = fresh.length ? fresh : fits.length ? fits : pool.filter((g) => g.moment === 'talk');
  return from[seeded(seed, `turn-${turn}`) % from.length];
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
  // The early beats, one an ordinary return, in their order: the mate review, then the neko (who plays off it).
  const early = EARLY_ONCE.find((id) => !(s.said ?? []).includes(id));
  if (early) return early;
  // The personal plot, from its capture on (the first ordinary return that has reached it).
  const plot = STORY_ONCE.find((b) => s.captures >= b.captures && !(s.said ?? []).includes(b.id))?.id;
  if (plot) return plot;
  // The neko, when her window comes (THREAD_OPENS).
  return threadDue(s) === 'catgirl' ? 'catgirl' : m;
}

/**
 * THE PERSONAL PLOT (Collins, Oct 5 2026): the third thread beside the ally's and the Roach King's, carried by YOKE's
 * greeting, once each, from its capture on. Oct 12 2026: the capture-5 beat (why the Index assigning him a partner
 * matters, 'partner-index') was cut on the lines page (Collins: "not needed"); what stays is how it is going (capture 9),
 * content/greetings.ts has the lines.
 */
export const STORY_ONCE: Array<{ id: GreetMoment; captures: number }> = [
  // partner-progress (capture 9) was cut on Oct 26 2026 (Collins: "this is pointless, she comes in in that third message
  // where it mentions someone is under review": the mate review already brings Atlas in).
];

/**
 * THE ONCE INTROS (Collins, Oct 5 2026: "a collection of intros that won't accidentally be used twice in a mission if
 * you lose"): one-off greetings for ordinary returns, each said once a campaign (CampaignState.greetingsSaid, which a
 * lost mission does not undo), in this order, each from its capture on, and never two returns running, so her ordinary
 * lines still come between. `needs`: what must have happened first (the duck is a callback to the first-mission win;
 * the second neko plays off the first, the Gene War off the second; the dad's names off the Board moving the file).
 */
export const INTROS: Array<{ id: string; captures: number; needs?: (s: CampaignState) => boolean }> = [
  { id: 'back-5', captures: 2 },
  { id: 'intro-barnabas', captures: 3 },
  // Print a body as a conversation (Collins, Oct 26 2026): she raises it; the film plays only if he asks.
  { id: 'intro-body', captures: 5 },
  { id: 'intro-audit', captures: 8 },
  { id: 'intro-dad', captures: 10, needs: (s) => (s.said ?? []).includes('mate-review') },
  // Collins, Oct 18 2026: "move later, this is super early and the character may not be introduced yet": not before
  // capture 12 (was 7), and only after Mirelle's letter came (the catgirl greeting).
  { id: 'intro-catgirl', captures: 12, needs: (s) => (s.said ?? []).includes('catgirl') },
];
// Cut by Collins, Oct 18 2026: intro-duck, intro-board, intro-genewar ("this is lore that comes up around nekos, not a
// stand-alone thing": it is in the neko greetings' asides now).

/**
 * YOKE'S LINES ON THE LETTERS (Collins, Oct 14 2026): once each, on the first ordinary return after the turn in the Letters
 * room they speak to (src/meta/letters.ts), ahead of the intros: a new correspondent's first letter, Atlas writing herself,
 * a writer telling him what he asked (Rook's orca: Collins, Oct 18 2026, "triggered when you learn this, as the next after
 * mission YOKE talk"). They come first on an ordinary return, before the intros and the news.
 */
export const LETTER_BEATS: Array<{ id: string; when: (s: CampaignState) => boolean }> = [
  { id: 'letter-atlas-direct', when: (s) => !!s.letters?.threads.atlas?.direct },
  { id: 'letter-rook-orca', when: (s) => (s.letters?.threads.rook?.revealed ?? []).includes('orca') },
];

/**
 * The return after she printed herself a body (Collins, Oct 26 2026: "a conditional line triggered to come the turn after
 * you print her body"): once a campaign, first on that ordinary return. src/ui/campaignUi.ts printBody marks 'print-body'.
 */
export const AFTER_PRINT = 'after-print-body';
export function afterPrintFor(s: CampaignState, pool: Greeting[] = GREETINGS): Greeting | null {
  if (!(s.said ?? []).includes('print-body') || (s.greetingsSaid ?? []).includes(AFTER_PRINT)) return null;
  return pool.find((g) => g.id === AFTER_PRINT) ?? null;
}

/**
 * THE LOVE INTERESTS, DRIP-FED (Collins, Oct 19 2026: "the romantic interests are drip fed throughout the campaign, you
 * have them all coming in right at the beginning (the neko before even choosing a faction?)"; Atlas, the Board's
 * candidate, stays early, at the mate review: "it is good having the first approved Technopuritan love interest introduced
 * earlier"). Each other one opens once, on an ordinary return inside its window, counted in captures from the day he sided
 * with a faction (the first win opens the desk; he sides after that). Where in the window is seeded per campaign, so two
 * campaigns meet them at different points. Her opening line opens the thread in the Letters room (content/letters.ts unlock).
 *   catgirl      Mirelle, the neko: 2 to 4 captures after he sides
 *   letter-rook  Rook, from the rim: from the midpoint to the reveal (6 to 8)
 */
export const THREAD_OPENS: Array<{ id: string; after: number; until: number }> = [
  { id: 'catgirl', after: 2, until: 4 },
  { id: 'letter-rook', after: MIDPOINT_CAPTURES, until: 8 },
];

/** The capture this campaign opens the thread on, or null before he has sided with anyone. */
export function threadSlot(s: CampaignState, id: string): number | null {
  const t = THREAD_OPENS.find((x) => x.id === id);
  if (!t || !s.faction) return null;
  return s.factionSince + t.after + (seeded(s.seed, id) % (t.until - t.after + 1));
}

/**
 * One love-interest line a return, and never two returns running (the drip): the mate review, the openings and the letter
 * beats. A line
 * held back by this plays on the next return.
 */
export const threadBeatLast = (s: CampaignState): boolean =>
  !!s.lastGreeting && (s.lastGreeting === 'mate-review' || THREAD_OPENS.some((t) => t.id === s.lastGreeting) || LETTER_BEATS.some((b) => b.id === s.lastGreeting));

/** The thread to open this return, or null. */
export function threadDue(s: CampaignState): string | null {
  if (threadBeatLast(s)) return null;
  const said = [...(s.said ?? []), ...(s.greetingsSaid ?? [])];
  return THREAD_OPENS.find((t) => { const at = threadSlot(s, t.id); return at != null && s.captures >= at && !said.includes(t.id); })?.id ?? null;
}

/**
 * With YOKE's talk off in Settings, the lines she keeps quiet: her everyday talk, the news, the once intros, the letter
 * beats and the losses before the desk opens. The story still plays (the first greeting and the boss, the mate review,
 * the desk opening, the personal plot, the love interests' openings), since each opens something on the ship.
 */
export function quietSkips(g: Greeting): boolean {
  return g.moment === 'talk' || g.moment === 'lost-locked' || /^earth-/.test(g.id) || g.id === 'EARTH_NEWS_FALLBACK'
    || INTROS.some((i) => i.id === g.id) || LETTER_BEATS.some((b) => b.id === g.id);
}

/** The letters' line for this ordinary return, or null. */
export function letterBeatFor(s: CampaignState, pool: Greeting[] = GREETINGS): Greeting | null {
  const said = s.greetingsSaid ?? [];
  if (threadBeatLast(s)) return null;
  const next = LETTER_BEATS.find((b) => !said.includes(b.id) && b.when(s));
  return (next && pool.find((g) => g.id === next.id)) ?? null;
}

/** The intro for this ordinary return, or null. */
export function introFor(s: CampaignState, pool: Greeting[] = GREETINGS): Greeting | null {
  const said = s.greetingsSaid ?? [];
  if (s.lastGreeting && INTROS.some((i) => i.id === s.lastGreeting)) return null;
  const next = INTROS.find((i) => !said.includes(i.id) && s.captures >= i.captures && (!i.needs || i.needs(s)));
  return (next && pool.find((g) => g.id === next.id)) ?? null;
}

/** Greetings said once each, early, on ordinary returns, in this order (Collins, Sep 30 2026). */
export const EARLY_ONCE: GreetMoment[] = ['mate-review'];

/**
 * News from Earth may be told on an ordinary return once the early beats have all played (the
 * first mission's greeting, the mate review, the desk opening); on a save from before the
 * unfolding, on any ordinary return.
 */
export function earthNewsOpen(s: CampaignState): boolean {
  if (!s.onboard) return true;
  return s.onboard.mission1 !== 'pending' && s.onboard.deskOpen && EARLY_ONCE.every((id) => (s.said ?? []).includes(id));
}

/**
 * The news from Earth as lines of hers (Collins, Oct 26 2026: "the news from earth is PART OF WHAT SHE SAYS"): each one
 * an everyday line in her one pool, shuffled in with the rest (`lore`: the lore book's text, which holds the list).
 */
export function newsGreetings(lore: string): Greeting[] {
  const pool = earthNews(lore);
  const news: EarthNews[] = pool.length ? pool : EARTH_NEWS_FALLBACK.map((text) => ({ text }));
  return news.map((n, i) => ({ id: `earth-${i}`, moment: 'talk', beats: newsBeats(n.text), aside: n.aside, hook: n.aside ? 'Ask her about it' : undefined }));
}

/**
 * The greeting for coming aboard now: the moment's (momentNow); on an ordinary return, a line from her one everyday pool,
 * her own lines and the news from Earth together. Never the line she said last time, nor one on the same topic.
 */
export function greetingFor(s: CampaignState, lore = ''): { moment: GreetMoment; greeting: Greeting } {
  const moment = momentNow(s);
  if (ORDINARY.includes(moment)) {
    const printed = afterPrintFor(s);
    if (printed) return { moment: 'intro', greeting: printed };
    const opens = threadDue(s);
    const thread = opens && opens !== 'catgirl' ? GREETINGS.find((g) => g.id === opens) : null;
    if (thread) return { moment: 'intro', greeting: thread };
    const letter = letterBeatFor(s);
    if (letter) return { moment: 'intro', greeting: letter };
    const intro = introFor(s);
    if (intro) return { moment: 'intro', greeting: intro };
  }
  const said = s.greetingsSaid ?? [];
  // What the last thing she said was about: the next everyday line or news is about something else.
  const lastG = s.lastGreeting ? GREETINGS.find((g) => g.id === s.lastGreeting) ?? newsById(lore, s.lastGreeting) : null;
  const avoid = lastG ? topicsOf(words(lastG)) : [];
  const pool = ORDINARY.includes(moment) && poolOf(moment) === 'talk' && earthNewsOpen(s) ? [...GREETINGS, ...newsGreetings(lore)] : GREETINGS;
  return { moment, greeting: pickGreeting(moment, s.seed, s.deployments, s.lastGreeting, pool, said, avoid) };
}

/** A line of news said before, by its id (to know what it was about). */
function newsById(lore: string, id: string): Greeting | null {
  return /^earth-\d+$/.test(id) ? newsGreetings(lore).find((g) => g.id === id) ?? null : null;
}
