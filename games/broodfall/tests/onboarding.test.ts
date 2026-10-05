/**
 * How the game unfolds for a new player (src/meta/onboarding.ts, Collins Sep 30 2026): the first
 * launch, mission 1, the dark Directive Desk, the three factions at its opening, YOKE's greetings.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { finish, newCampaign, plan, targets, type CampaignState } from '../src/meta/campaign';
import {
  EARLY_ONCE, FIRST_MISSION, FIRST_MISSION_STANDING, deskOpen, earthNewsOpen, greetingFor, isFirstMission, launchKind, momentNow,
  pickGreeting, shipPick,
} from '../src/meta/onboarding';
import { CUES, EARTH_NEWS_FALLBACK, GREETINGS, earthNewsFrom } from '../content/greetings';
import { PRINT_BODY } from '../content/yokeScenes';
import { BOSS } from '../content/boss';
import { HOME } from '../content/campaign';
import type { RunReport } from '../src/meta/goals';
import type { RunStats, SimConfig } from '../src/sim/types';
import { Sim } from '../src/sim/sim';

const stats = (): RunStats => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});
const run = (won: boolean): RunReport => ({ won, wavesCleared: won ? 5 : 2, coreEndFrac: won ? 0.8 : 0, scienceBanked: 0, stats: stats() });
/** A deployment where the ship (or the desk) would send him. */
const deploy = (s: CampaignState, won: boolean) => finish(s, plan(s, shipPick(s, targets(s))!), run(won));
/** He comes aboard: the greeting is said (what the ship's screen records). */
const board = (s: CampaignState): CampaignState => {
  const { moment, greeting } = greetingFor(s);
  return { ...s, greet: null, lastGreeting: greeting.id, said: EARLY_ONCE.includes(moment) ? [...(s.said ?? []), moment] : s.said };
};

describe('the first launch', () => {
  it('nothing on record: the film and mission 1; mission 1 left unfinished: back into it; after it: the menu', () => {
    expect(launchKind({ hasCampaign: false, mission1Pending: false, introSeen: false, veteran: false })).toBe('first');
    expect(launchKind({ hasCampaign: true, mission1Pending: true, introSeen: true, veteran: false })).toBe('mission1');
    expect(launchKind({ hasCampaign: true, mission1Pending: false, introSeen: true, veteran: false })).toBe('menu');
    // A player from before the campaign, or one who reset only the campaign: the menu.
    expect(launchKind({ hasCampaign: false, mission1Pending: false, introSeen: false, veteran: true })).toBe('menu');
    expect(launchKind({ hasCampaign: false, mission1Pending: false, introSeen: true, veteran: false })).toBe('menu');
  });
});

describe('mission 1: a plain game of tower defence at the crash site', () => {
  it('no forms, no dares, the assault shown, hold five waves', () => {
    const s = newCampaign(1, { onboarding: true });
    expect(isFirstMission(s)).toBe(true);
    expect(shipPick(s, targets(s))).toBe(FIRST_MISSION);
    const p = plan(s, FIRST_MISSION, { dares: ['forest'], experiment: 'love-gas' });
    expect(p.first).toBe(true);
    expect(p.board).toEqual([]);
    expect(p.dares).toEqual([]);
    expect(p.experiment).toBeUndefined();
    expect(p.config.matingMusk).toBeUndefined();
    expect(p.config.waveIntel).toBe('full');
    expect(p.config.directive).toEqual({ kind: 'hold', waves: 5 });
  });

  it('its first hand is the plain limbs, drawn without changing the rng\'s order (Sep 30 2026 fix pass)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = newCampaign(seed, { onboarding: true });
      const p = plan(s, FIRST_MISSION);
      expect(p.config.firstHand).toEqual(['spitter', 'lasher']);
      const cfg = { gridW: 50, gridH: 40, cellPx: 26, entrances: 1, genes: [], ...p.config } as SimConfig;
      const a = new Sim(cfg);
      expect(a.hand.every((c) => c.family === 'spitter' || c.family === 'lasher'), a.hand.map((c) => c.family).join()).toBe(true);
      // The same rng draws as without the narrowing: the next number the run rolls is the same one.
      const { firstHand: _drop, ...plain } = cfg;
      const b = new Sim(plain as SimConfig);
      const rngOf = (x: Sim) => (x as unknown as { rng: { next(): number } }).rng;
      expect(rngOf(a).next()).toBe(rngOf(b).next());
    }
    // Anywhere else: no narrowing.
    const later = newCampaign(3);
    expect(plan(later, targets(later)[0].id).config.firstHand).toBeUndefined();
  });

  it('lost: no ground changes hands, its data pays, the desk stays dark, nobody calls, YOKE has Collins\'s lost lines', () => {
    const s = newCampaign(2, { onboarding: true });
    const { state, debrief } = deploy(s, false);
    expect(debrief.first).toBe(true);
    expect(state.onboard).toEqual({ mission1: 'lost', deskOpen: false });
    expect(state.held).toEqual([HOME]);
    expect(state.captures).toBe(0);
    expect(state.standing).toBe(FIRST_MISSION_STANDING);
    expect(state.pendingScenes).toEqual([]);
    expect(state.greet).toBe('first-lost');
    expect(pickGreeting('first-lost', 1, 1).beats[0].say).toBe('You really suck at genocide.');
  });
});

describe('the Directive Desk opens at the first win that is not mission 1; the three factions call then', () => {
  it('mission 1 lost: the desk opens at the first win, and all three call at once', () => {
    let s = deploy(newCampaign(3, { onboarding: true }), false).state;
    s = board(s);
    expect(deskOpen(s)).toBe(false);
    // The ship picks: the easiest landing site next to the crash site.
    expect(shipPick(s, targets(s))).toBe('cul-de-sac');
    s = deploy(s, false).state;
    expect(s.greet).toBe('lost-locked');
    expect(deskOpen(s)).toBe(false);
    // The first ordinary return after the first greeting: the mate review; the next: the cat girl.
    expect(momentNow(s)).toBe('mate-review');
    s = board(s);
    s = deploy(s, false).state;
    expect(momentNow(s)).toBe('catgirl');
    s = board(s);
    const { state, debrief } = deploy(s, true);
    expect(debrief.deskOpened).toBe(true);
    expect(deskOpen(state)).toBe(true);
    // Two tries at the desk before this one: her late version (Collins, Oct 5 2026).
    expect(state.greet).toBe('unlock-late');
    // All three reach out at once; since Oct 3 2026 they are signals at the desk, not calls waiting.
    expect(state.contacted).toEqual(['delegation', 'faithful', 'institute']);
    expect(state.pendingScenes).toEqual([]);
  });

  it('mission 1 won: the desk is still dark, and opens at the next win', () => {
    let s = deploy(newCampaign(4, { onboarding: true }), true).state;
    expect(s.onboard).toEqual({ mission1: 'won', deskOpen: false });
    expect(s.greet).toBe('first-won');
    expect(s.pendingScenes).toEqual([]);
    s = board(s);
    s = deploy(s, true).state;
    expect(deskOpen(s)).toBe(true);
    expect(s.greet).toBe('unlock');
    expect(s.contacted.length).toBe(3);
  });

  it('a save from before the unfolding: the desk is open, and all three call at its first capture', () => {
    const s = newCampaign(5);
    expect(deskOpen(s)).toBe(true);
    expect(isFirstMission(s)).toBe(false);
    const after = finish(s, plan(s, 'cul-de-sac'), run(true)).state;
    expect(after.contacted.sort()).toEqual(['delegation', 'faithful', 'institute']);
  });
});

describe('YOKE\'s greetings', () => {
  it('every return has one; never the same one twice in a row', () => {
    for (const m of ['won', 'lost', 'back', 'lost-locked', 'defended', 'fell'] as const) {
      const a = pickGreeting(m, 9, 3);
      const b = pickGreeting(m, 9, 3, a.id);
      if (GREETINGS.filter((g) => g.moment === m).length > 1) expect(b.id).not.toBe(a.id);
    }
  });

  it('Collins\'s own lines are there word for word, with the boss after the first ones', () => {
    const say = (id: string) => GREETINGS.find((g) => g.id === id)!.beats.map((b) => b.say).join(' ');
    expect(say('first-won')).toContain('Damn, you took to genocide like a duck to water.');
    expect(say('first-lost')).toContain('Top ten.');
    expect(say('unlock')).toContain('Broh, that was sick...');
    expect(say('mate-review')).toContain('on your data pad in your room.');
    expect(say('catgirl')).toContain('told her to pound sand');
    expect(GREETINGS.find((g) => g.id === 'first-won')!.boss).toBe(true);
    expect(GREETINGS.find((g) => g.id === 'first-lost')!.boss).toBe(true);
    expect(BOSS.lines.length).toBeGreaterThan(2);
  });

  it('every cue her greetings use has a clip in her body today (the last of each list)', () => {
    const body = JSON.parse(readFileSync('public/art/ship/yoke/manifest.json', 'utf8')) as { states: Record<string, string> };
    for (const [cue, clips] of Object.entries(CUES)) {
      expect(clips.some((c) => c in body.states), `cue ${cue}`).toBe(true);
    }
  });

  it('news from Earth: read from the lore book\'s section, Collins\'s line until it exists; only after the early beats', () => {
    const lore = '# Book\n## 15. Earth news (return greetings)\n- "The Crusade took Rome back."\n- "Mars voted to secede again."\n## 16. Other\n- "not news"\n';
    expect(earthNewsFrom(lore)).toEqual(['The Crusade took Rome back.', 'Mars voted to secede again.']);
    expect(earthNewsFrom('# nothing here')).toEqual([]);
    // The lore book's own section (content/lore/ship-ai-lorebook.md), Collins's line first.
    const book = earthNewsFrom(readFileSync('content/lore/ship-ai-lorebook.md', 'utf8'));
    expect(book.length).toBeGreaterThanOrEqual(10);
    expect(book[0]).toBe(EARTH_NEWS_FALLBACK[0]);
    expect(EARTH_NEWS_FALLBACK[0]).toMatch(/took back Rome/);
    let s = deploy(newCampaign(6, { onboarding: true }), false).state;
    s = board(s);
    expect(earthNewsOpen(s)).toBe(false);
    s = { ...s, said: [...EARLY_ONCE], onboard: { mission1: 'lost', deskOpen: true } };
    expect(earthNewsOpen(s)).toBe(true);
    // Over many returns, one in three or so is news from Earth, and never the same line twice running.
    let news = 0;
    let last: string | undefined;
    for (let d = 0; d < 30; d++) {
      const g = greetingFor({ ...s, deployments: d, greet: 'won', lastGreeting: last }, lore).greeting;
      if (g.id.startsWith('earth-')) { news++; expect(g.id).not.toBe(last); }
      last = g.id;
    }
    expect(news).toBeGreaterThan(3);
    expect(news).toBeLessThan(20);
  });

  it('"print yourself a body": his words ask for it; other talk does not', () => {
    for (const yes of ['Can you print yourself a body?', 'print a body', 'Why not get a real body?', 'I want to meet you in person', 'show yourself in the flesh']) expect(PRINT_BODY.asks.test(yes), yes).toBe(true);
    for (const no of ['How was the deployment?', 'Somebody help', 'the body count is high', 'print the report']) expect(PRINT_BODY.asks.test(no), no).toBe(false);
  });
});
