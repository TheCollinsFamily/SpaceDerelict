/**
 * THE PERSONAL PLOT, THE LATE DESK SPEECH AND THE ONCE INTROS (Collins, Oct 5 2026): the Index beat at capture 5 (cut on
 * Oct 12 2026, "not needed") and its progress at 9, carried by YOKE; her desk-opening speech in its late version when the desk took more than one try; and
 * the one-off intros, each once a campaign, never two returns running, whatever is lost.
 */
import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../content/campaign';
import { GREETINGS } from '../content/greetings';
import { INTROS, STORY_ONCE, introFor, momentAfter, momentNow } from '../src/meta/onboarding';
import { newCampaign, type CampaignState, type Debrief } from '../src/meta/campaign';
import { campaign } from '../tools/measure/after-mission.measure';

const at = (patch: Partial<CampaignState>): CampaignState => ({ ...newCampaign(9), onboard: { mission1: 'won', deskOpen: true }, lastGreeting: 'won-1', said: ['mate-review', 'catgirl'], ...patch });

describe('the personal plot', () => {
  it('every beat and intro has its lines', () => {
    for (const b of STORY_ONCE) expect(GREETINGS.some((g) => g.id === b.id && g.moment === b.id), b.id).toBe(true);
    for (const i of INTROS) expect(GREETINGS.find((g) => g.id === i.id)?.moment, i.id).toBe('intro');
    // Oct 12 2026: the late version of the desk-opening speech was cut (Collins: "the first works for both").
    expect(GREETINGS.some((g) => g.id === 'unlock-late')).toBe(false);
  });
  it('no personal-plot beat any more (Oct 12 2026: the Index beat cut; Oct 26 2026: the progress beat cut, "pointless")', () => {
    expect(STORY_ONCE).toEqual([]);
    for (const c of [4, 5, 8, 9, 10]) expect(momentNow(at({ captures: c, greet: 'won' }))).toBe('won');
  });
  for (const f of FACTIONS) {
    it(`${f.id}: in a whole campaign no personal-plot beat; no greeting twice`, () => {
      const { returns } = campaign(1234, f.id);
      expect(returns.find((r) => r.greeting === 'partner-index' || r.greeting === 'partner-progress')).toBeUndefined();
      expect(returns.filter((r) => !r.greetingNew).map((r) => r.greeting)).toEqual([]);
      // Never two intros running.
      const intro = (g: string) => INTROS.some((i) => i.id === g);
      for (let k = 1; k < returns.length; k++) expect(intro(returns[k].greeting) && intro(returns[k - 1].greeting), `returns ${k} and ${k + 1}`).toBe(false);
    });
  }
});

describe('the desk opening, on the first try or later', () => {
  const opened = { deskOpened: true } as unknown as Debrief;
  it('the first try after mission 1 and a later one both hear the speech as Collins wrote it (Oct 12 2026)', () => {
    const next = at({});
    expect(momentAfter(at({ deployments: 1 }), next, opened, false)).toBe('unlock');
    expect(momentAfter(at({ deployments: 3 }), next, opened, false)).toBe('unlock');
  });
});

describe('the once intros', () => {
  it('in order, each from its capture, never right after another, never twice (Collins, Nov 5 2026: Mirelle, body, Rook first)', () => {
    const met = ['mate-review', 'catgirl'];
    // Print a body waits for Mirelle's letter (or capture 6).
    expect(introFor(at({ captures: 3, said: ['mate-review'] }))).toBeNull();
    expect(introFor(at({ captures: 3, said: met }))?.id).toBe('intro-body');
    expect(introFor(at({ captures: 6, said: ['mate-review'] }))?.id).toBe('intro-body');
    expect(introFor(at({ captures: 4, said: met, lastGreeting: 'intro-body', greetingsSaid: ['intro-body'] }))).toBeNull();
    // Dad's message waits for Rook's letter (or capture 9).
    expect(introFor(at({ captures: 5, said: met, lastGreeting: 'won-2', greetingsSaid: ['intro-body'] }))).toBeNull();
    expect(introFor(at({ captures: 5, said: met, lastGreeting: 'won-2', greetingsSaid: ['intro-body', 'letter-rook'] }))?.id).toBe('back-5');
    const upTo = (n: number) => ({ said: met, lastGreeting: 'won-2', greetingsSaid: ['intro-body', 'letter-rook', 'back-5', 'intro-catgirl', 'intro-barnabas', 'intro-audit', 'intro-dad'].slice(0, n) });
    expect(introFor(at({ captures: 6, ...upTo(3) }))?.id).toBe('intro-catgirl');
    expect(introFor(at({ captures: 6, ...upTo(4), lastGreeting: 'intro-catgirl' }))).toBeNull();
    expect(introFor(at({ captures: 6, ...upTo(4), lastGreeting: 'won-3' }))?.id).toBe('intro-barnabas');
    expect(introFor(at({ captures: 6, ...upTo(5) }))).toBeNull();
    expect(introFor(at({ captures: 7, ...upTo(5) }))?.id).toBe('intro-audit');
    expect(introFor(at({ captures: 8, ...upTo(6) }))?.id).toBe('intro-dad');
    expect(introFor(at({ captures: 13, ...upTo(7) }))).toBeNull();
  });
  it('a lost mission does not bring one back', () => {
    const said = INTROS.map((i) => i.id);
    expect(introFor(at({ captures: 20, greetingsSaid: said, said: ['mate-review', 'catgirl', 'partner-progress'] }))).toBeNull();
  });
});
