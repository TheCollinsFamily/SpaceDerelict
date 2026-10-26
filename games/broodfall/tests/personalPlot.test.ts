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
  it('in order, each from its capture, never right after another, never twice', () => {
    expect(introFor(at({ captures: 1 }))).toBeNull();
    expect(introFor(at({ captures: 2 }))?.id).toBe('back-5');
    expect(introFor(at({ captures: 3, lastGreeting: 'back-5', greetingsSaid: ['back-5'] }))).toBeNull();
    expect(introFor(at({ captures: 3, lastGreeting: 'won-2', greetingsSaid: ['back-5'] }))?.id).toBe('intro-barnabas');
    // The duck, the Board and the Gene War were cut (Collins, Oct 18 2026); the audit is next, from capture 8.
    // Print a body as a conversation, from capture 5 (Oct 26 2026).
    expect(introFor(at({ captures: 4, greetingsSaid: ['back-5', 'intro-barnabas'] }))).toBeNull();
    expect(introFor(at({ captures: 5, greetingsSaid: ['back-5', 'intro-barnabas'] }))?.id).toBe('intro-body');
    expect(introFor(at({ captures: 6, greetingsSaid: ['back-5', 'intro-barnabas', 'intro-body'] }))).toBeNull();
    expect(introFor(at({ captures: 8, greetingsSaid: ['back-5', 'intro-barnabas', 'intro-body'] }))?.id).toBe('intro-audit');
    // The second neko line waits for capture 12 (Oct 18 2026: "this is super early").
    const neko = { greetingsSaid: ['back-5', 'intro-barnabas', 'intro-body', 'intro-audit', 'intro-dad'], said: ['mate-review', 'catgirl', 'partner-progress'] };
    expect(introFor(at({ captures: 11, ...neko }))).toBeNull();
    expect(introFor(at({ captures: 12, ...neko }))?.id).toBe('intro-catgirl');
  });
  it('a lost mission does not bring one back', () => {
    const said = INTROS.map((i) => i.id);
    expect(introFor(at({ captures: 20, greetingsSaid: said, said: ['mate-review', 'catgirl', 'partner-progress'] }))).toBeNull();
  });
});
