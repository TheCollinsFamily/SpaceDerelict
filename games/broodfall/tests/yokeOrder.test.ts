/**
 * HOW YOKE'S LINES ARE ORDERED (Collins, Oct 19 2026): after the desk opens it is mission -> her line -> mission -> her line,
 * won or lost, from one pool shuffled per campaign and said once each; the love interests are drip-fed, each in a window
 * after he sides with a faction, seeded per campaign, one a return and never two returns running.
 */
import { describe, expect, it } from 'vitest';
import { GREETINGS } from '../content/greetings';
import { newCampaign, type CampaignState } from '../src/meta/campaign';
import { THREAD_OPENS, greetingFor, momentNow, pickGreeting, threadDue, threadSlot } from '../src/meta/onboarding';

const sided = (seed: number, patch: Partial<CampaignState> = {}): CampaignState => ({
  ...newCampaign(seed), onboard: { mission1: 'won', deskOpen: true }, lastGreeting: 'unlock', said: ['mate-review'],
  greetingsSaid: ['first-won', 'unlock', 'mate-review', 'back-5', 'intro-barnabas'], faction: 'faithful', factionSince: 2, captures: 2, greet: 'won', ...patch,
});

describe('her everyday talk', () => {
  it('a win and a loss draw on the same pool once the desk is open', () => {
    const won = pickGreeting('won', 7, 3);
    const lost = pickGreeting('lost', 7, 3);
    expect(won.moment).toBe('talk');
    expect(won.id).toBe(lost.id);
  });
  it('each line once, in an order that differs between campaigns', () => {
    const run = (seed: number) => {
      const said: string[] = []; let last: string | null = null;
      const talk = GREETINGS.filter((g) => g.moment === 'talk').length;
      for (let i = 0; i < talk; i++) { const g = pickGreeting('won', seed, i, last, GREETINGS, said); said.push(g.id); last = g.id; }
      return said;
    };
    const a = run(1), b = run(2);
    expect(new Set(a).size).toBe(a.length);
    expect(a.slice(0, 5)).not.toEqual(b.slice(0, 5));
  });
});

describe('the love interests, drip-fed', () => {
  it('nobody opens before he sides with a faction', () => {
    expect(threadDue({ ...sided(3), faction: null, captures: 9 })).toBeNull();
  });
  it('the neko opens 2 to 4 captures after he sides, at a seeded point; Rook from the midpoint to the reveal', () => {
    const slots = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = sided(seed);
      const neko = threadSlot(s, 'catgirl')!, rook = threadSlot(s, 'letter-rook')!;
      expect(neko - s.factionSince).toBeGreaterThanOrEqual(2);
      expect(neko - s.factionSince).toBeLessThanOrEqual(4);
      expect(rook - s.factionSince).toBeGreaterThanOrEqual(6);
      expect(rook - s.factionSince).toBeLessThanOrEqual(8);
      slots.add(neko);
    }
    expect(slots.size).toBeGreaterThan(1);
  });
  it('the neko plays on the first ordinary return that reaches her slot', () => {
    const s = sided(5);
    const at = threadSlot(s, 'catgirl')!;
    expect(momentNow({ ...s, captures: at - 1, lastGreeting: 'won-12' })).toBe('won');
    expect(momentNow({ ...s, captures: at, lastGreeting: 'won-12' })).toBe('catgirl');
  });
  it('Rook\'s opening plays as her line from the rim, and two love-interest lines never come on two returns running', () => {
    const s = sided(5, { said: ['mate-review', 'catgirl', 'partner-progress'], greetingsSaid: ['mate-review', 'catgirl', 'partner-progress'] });
    const at = threadSlot(s, 'letter-rook')!;
    expect(greetingFor({ ...s, captures: at, lastGreeting: 'won-12' }).greeting.id).toBe('letter-rook');
    expect(greetingFor({ ...s, captures: at, lastGreeting: 'catgirl' }).greeting.id).not.toBe('letter-rook');
    expect(THREAD_OPENS.map((t) => t.id)).toEqual(['catgirl', 'letter-rook']);
  });
});

describe('the mate review counts toward the drip', () => {
  it('the neko does not come on the return straight after the mate review', () => {
    const s = sided(5);
    const at = threadSlot(s, 'catgirl')!;
    expect(momentNow({ ...s, captures: at, lastGreeting: 'mate-review' })).not.toBe('catgirl');
    expect(momentNow({ ...s, captures: at + 1, lastGreeting: 'won-12' })).toBe('catgirl');
  });
});

describe('a line held back (notBefore)', () => {
  it('won-12 is not said before deployment 12', () => {
    const others = GREETINGS.filter((g) => g.moment === 'talk' && g.id !== 'won-12').map((g) => g.id);
    expect(pickGreeting('won', 3, 5, null, GREETINGS, others).id).not.toBe('won-12');
    expect(pickGreeting('won', 3, 12, null, GREETINGS, others).id).toBe('won-12');
  });
});

describe('YOKE\'s talk off (Settings)', () => {
  it('she keeps quiet for her talk, the news, the intros and the letter beats, never for the story', async () => {
    const { quietSkips } = await import('../src/meta/onboarding');
    const g = (id: string) => GREETINGS.find((x) => x.id === id)!;
    for (const id of ['back-6', 'intro-audit', 'letter-rook-orca', 'locked-1']) expect(quietSkips(g(id)), id).toBe(true);
    expect(quietSkips({ id: 'earth-3', moment: 'won', beats: [{ say: 'x' }] } as never)).toBe(true);
    for (const id of ['first-won', 'mate-review', 'unlock', 'catgirl', 'letter-rook', 'partner-progress']) expect(quietSkips(g(id)), id).toBe(false);
  });
  it('the setting is on unless he turns it off, and an old save keeps it on', async () => {
    const { settingsFrom, DEFAULT_SETTINGS } = await import('../src/meta/settings');
    expect(DEFAULT_SETTINGS.yokeTalk).toBe(true);
    expect(settingsFrom({}).yokeTalk).toBe(true);
    expect(settingsFrom({ yokeTalk: false }).yokeTalk).toBe(false);
  });
});
