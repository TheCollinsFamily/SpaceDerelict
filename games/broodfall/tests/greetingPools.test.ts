/**
 * YOKE ALWAYS HAS SOMETHING NEW TO SAY (Collins, Oct 12 2026: "yoke is supposed to always have something to say after a
 * mission without a cinematic"). Two things hold it up: every ordinary pool is deep enough for a long campaign, and when
 * a pool runs dry the news from Earth she has not read out comes before any line of hers is said twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUES, GREETINGS, earthNews, earthNewsFrom, newsBeats, type GreetMoment } from '../content/greetings';
import { EARLY_ONCE, STORY_ONCE, greetingFor, pickGreeting } from '../src/meta/onboarding';
import { newCampaign, type CampaignState } from '../src/meta/campaign';

const LORE = fs.readFileSync(path.join(__dirname, '..', 'content', 'lore', 'ship-ai-lorebook.md'), 'utf8');
const size = (m: GreetMoment) => GREETINGS.filter((g) => g.moment === m).length;

describe('the depth of her pools', () => {
  it('each ordinary moment has lines enough for a long campaign', () => {
    // Oct 12 2026: Collins cut what did not carry their world; what carries it was written in its place.
    expect(size('won')).toBeGreaterThanOrEqual(10);
    expect(size('lost')).toBeGreaterThanOrEqual(10);
    expect(size('defended')).toBeGreaterThanOrEqual(5);
    expect(size('fell')).toBeGreaterThanOrEqual(5);
    expect(size('lost-locked')).toBeGreaterThanOrEqual(4);
    expect(size('back')).toBeGreaterThanOrEqual(8);
    expect(earthNewsFrom(LORE).length).toBeGreaterThanOrEqual(20);
  });
  it('every greeting has words, a face on every beat, and an id of its own', () => {
    const ids = new Set<string>();
    for (const g of GREETINGS) {
      expect(ids.has(g.id), g.id).toBe(false);
      ids.add(g.id);
      expect(g.beats.length, g.id).toBeGreaterThan(0);
      for (const b of g.beats) expect(b.say.trim().length, g.id).toBeGreaterThan(2);
    }
  });
  it('the greetings Collins asked secret context for carry it, for her live mind (Oct 12 2026)', () => {
    for (const id of ['partner-progress', 'back-5', 'intro-dad', 'intro-duck', 'intro-catgirl', 'intro-audit']) {
      expect(GREETINGS.find((g) => g.id === id)?.aside?.length ?? 0, id).toBeGreaterThan(40);
    }
  });
  it('the lines that carry their world have the lore behind them and a prompt for the reply box', () => {
    const carry = GREETINGS.filter((g) => g.hook);
    expect(carry.length).toBeGreaterThanOrEqual(18);
    for (const g of carry) expect(g.aside?.length ?? 0, g.id).toBeGreaterThan(80);
    // Every ordinary pool has at least two.
    for (const m of ['won', 'lost', 'defended', 'fell', 'back'] as GreetMoment[]) expect(carry.filter((g) => g.moment === m).length, m).toBeGreaterThanOrEqual(2);
  });
  it('while the desk stays dark, once her lines are said, the one that repeats plays again and again (Collins, Oct 12 2026)', () => {
    const pool = GREETINGS.filter((g) => g.moment === 'lost-locked');
    const all = pool.map((g) => g.id);
    expect(pool.filter((g) => g.repeats).map((g) => g.id)).toEqual(['locked-4']);
    expect(pickGreeting('lost-locked', 5, 9, 'locked-4', GREETINGS, all).id).toBe('locked-4');
    expect(pickGreeting('lost-locked', 5, 10, 'locked-4', GREETINGS, all).id).toBe('locked-4');
    // Not before the others are said.
    expect(pickGreeting('lost-locked', 5, 3, 'locked-4', GREETINGS, ['locked-4']).id).not.toBe('locked-4');
  });
});

describe('a line of news as her beats', () => {
  it('a cue in square brackets splits the line, and the beat before it acts it out; the last beat winks', () => {
    expect(newsBeats('Rome fell again. [shrug] Catholics.')).toEqual([
      { say: 'Rome fell again.', face: 'teasing', then: 'shrug', hold: 1400 },
      { say: 'Catholics.', face: 'teasing', then: 'wink' },
    ]);
    expect(newsBeats('Quiet week.')).toEqual([{ say: 'Quiet week.', face: 'teasing', then: 'wink' }]);
    expect(newsBeats('Eww. [nonsense] Fine.')[0].then).toBe('shrug');
  });
  it('most lines of news carry the lore behind them, for her live mind', () => {
    const news = earthNews(LORE);
    expect(news.filter((n) => n.aside && n.aside.length > 60).length).toBeGreaterThanOrEqual(Math.floor(news.length * 0.8));
    for (const n of news) expect(n.text, n.text).not.toMatch(/^>/);
    const sample = earthNews('# L\n## Earth news\n- One line.\n  > behind it\n  > and more\n- Two more lines.\n## Next\n- not news\n');
    expect(sample).toEqual([{ text: 'One line.', aside: 'behind it and more' }, { text: 'Two more lines.' }]);
  });
  it('every line of the lore book reads as beats with words, and only cues her body knows', () => {
    for (const line of earthNewsFrom(LORE)) {
      const beats = newsBeats(line);
      expect(beats.length, line).toBeGreaterThan(0);
      for (const b of beats) {
        expect(b.say.length, line).toBeGreaterThan(8);
        expect(typeof b.then === 'string' && b.then in CUES, line).toBe(true);
      }
      for (const cue of line.match(/\[(\w+)\]/g) ?? []) expect(cue.slice(1, -1) in CUES, line).toBe(true);
    }
  });
});

/**
 * A campaign as the ship greets it, return by return: `moments` is what each deployment left (won, lost, a counter-attack
 * thrown back, ground lost). The once-only beats are marked said as the ship marks them (src/ui/campaignUi.ts welcome).
 */
function hear(seed: number, moments: GreetMoment[]): string[] {
  let s: CampaignState = { ...newCampaign(seed), onboard: { mission1: 'won', deskOpen: true }, lastGreeting: 'first-won', said: [], greetingsSaid: [] };
  const heard: string[] = [];
  for (const m of moments) {
    s = { ...s, greet: m, deployments: s.deployments + 1, captures: m === 'won' ? s.captures + 1 : s.captures };
    const { moment, greeting } = greetingFor(s, LORE);
    heard.push(greeting.id);
    const once = EARLY_ONCE.includes(moment) || STORY_ONCE.some((b) => b.id === moment);
    s = { ...s, greet: null, lastGreeting: greeting.id, greetingsSaid: [...(s.greetingsSaid ?? []), greeting.id], said: once ? [...(s.said ?? []), moment] : s.said };
  }
  return heard;
}

describe('a long campaign hears no greeting twice', () => {
  // Thirty-six returns: more wins than a campaign has captures, with losses, counter-attacks thrown back and ground lost.
  const mix: GreetMoment[] = [
    'won', 'won', 'lost', 'won', 'won', 'defended', 'won', 'lost', 'won', 'fell', 'won', 'won',
    'defended', 'won', 'lost', 'won', 'won', 'won', 'defended', 'lost', 'won', 'won', 'fell', 'won',
    'lost', 'won', 'defended', 'won', 'won', 'lost', 'won', 'defended', 'won', 'won', 'defended', 'won',
  ];
  for (const seed of [1, 1234, 98765]) {
    it(`seed ${seed}: thirty-six returns, every greeting new`, () => {
      const heard = hear(seed, mix);
      expect(heard.length).toBe(mix.length);
      expect(heard.filter((id, i) => heard.indexOf(id) !== i)).toEqual([]);
    });
  }
  it('when a pool is dry she reads the news rather than repeat herself', () => {
    // Eleven counter-attacks thrown back in a row: six lines, then the news, never a line twice.
    const heard = hear(7, Array<GreetMoment>(11).fill('defended'));
    expect(heard.filter((id, i) => heard.indexOf(id) !== i)).toEqual([]);
    expect(heard.filter((id) => id.startsWith('earth-')).length).toBeGreaterThanOrEqual(5);
  });
});
