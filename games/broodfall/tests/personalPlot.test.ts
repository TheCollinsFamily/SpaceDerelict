/**
 * THE PERSONAL PLOT, THE LATE DESK SPEECH AND THE ONCE INTROS (Collins, Oct 5 2026): the Index beat at capture 5 and its
 * progress at 9, carried by YOKE; her desk-opening speech in its late version when the desk took more than one try; and
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
    expect(GREETINGS.some((g) => g.moment === 'unlock-late')).toBe(true);
  });
  it('the Index beat from capture 5, its progress from capture 9, once each, after the early ones', () => {
    expect(momentNow(at({ captures: 4, greet: 'won' }))).toBe('won');
    expect(momentNow(at({ captures: 5, greet: 'won' }))).toBe('partner-index');
    expect(momentNow(at({ captures: 6, greet: 'won', said: ['mate-review', 'catgirl', 'partner-index'] }))).toBe('won');
    expect(momentNow(at({ captures: 9, greet: 'won', said: ['mate-review', 'catgirl', 'partner-index'] }))).toBe('partner-progress');
    // A weighty moment keeps its own greeting (the licence, ground lost to a counter-attack is ordinary).
    expect(momentNow(at({ captures: 5, greet: 'licence' }))).toBe('licence');
  });
  for (const f of FACTIONS) {
    it(`${f.id}: in a whole campaign the Index at capture 5 and its progress at 9; no greeting twice`, () => {
      const { returns } = campaign(1234, f.id);
      expect(returns.find((r) => r.greeting === 'partner-index')?.capture).toBe(5);
      expect(returns.find((r) => r.greeting === 'partner-progress')?.capture).toBe(9);
      expect(returns.filter((r) => !r.greetingNew).map((r) => r.greeting)).toEqual([]);
      // Never two intros running.
      const intro = (g: string) => INTROS.some((i) => i.id === g);
      for (let k = 1; k < returns.length; k++) expect(intro(returns[k].greeting) && intro(returns[k - 1].greeting), `returns ${k} and ${k + 1}`).toBe(false);
    });
  }
});

describe('the desk opening, on the first try or later', () => {
  const opened = { deskOpened: true } as unknown as Debrief;
  it('the first try after mission 1 hears the speech as Collins wrote it; a later one, its late version', () => {
    const next = at({});
    expect(momentAfter(at({ deployments: 1 }), next, opened, false)).toBe('unlock');
    expect(momentAfter(at({ deployments: 3 }), next, opened, false)).toBe('unlock-late');
  });
});

describe('the once intros', () => {
  it('in order, each from its capture, never right after another, never twice', () => {
    expect(introFor(at({ captures: 1 }))).toBeNull();
    expect(introFor(at({ captures: 2 }))?.id).toBe('back-5');
    expect(introFor(at({ captures: 3, lastGreeting: 'back-5', greetingsSaid: ['back-5'] }))).toBeNull();
    expect(introFor(at({ captures: 3, lastGreeting: 'won-2', greetingsSaid: ['back-5'] }))?.id).toBe('intro-barnabas');
    // The duck is a callback to the first mission's win; without it, the next one.
    expect(introFor(at({ captures: 4, onboard: { mission1: 'lost', deskOpen: true }, greetingsSaid: ['back-5', 'intro-barnabas'] }))).toBeNull();
    expect(introFor(at({ captures: 6, onboard: { mission1: 'lost', deskOpen: true }, greetingsSaid: ['back-5', 'intro-barnabas'] }))?.id).toBe('intro-board');
  });
  it('a lost mission does not bring one back', () => {
    const said = INTROS.map((i) => i.id);
    expect(introFor(at({ captures: 20, greetingsSaid: said, said: ['mate-review', 'catgirl', 'partner-progress'] }))).toBeNull();
  });
});
