import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../content/campaign';
import { LEADER_VOICES } from '../content/media';
import { ROACH_ADDRESSES, ROACH_SCENES } from '../content/roachKing';
import { CHANNELS, SPEAKER_CHANNEL, TRANSLATOR_NOTES, cardConfidence, channelOfLine, confidenceOf, noteFor } from '../content/translation';

/** Every line a leader or he says in the campaign: scenes, asides, endings, reveals. */
function allLines(): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === 'string') { if (x.includes(':')) out.push(x); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(FACTIONS);
  // The Roach King's addresses (content/roachKing.ts): every line his.
  for (const a of ROACH_ADDRESSES) for (const sh of a.shots) if (sh.line) out.push(`The Roach King: ${sh.line}`);
  // ...and the scenes off the air (Oct 4 2026): his aide and a general speak in them too.
  for (const sc of ROACH_SCENES) out.push(...sc.scene.lines);
  return out;
}

describe('YOKE\'s translation layer', () => {
  it('every voiced leader has a channel, and every channel is drawn', () => {
    for (const who of Object.keys(LEADER_VOICES)) expect(SPEAKER_CHANNEL[who], who).toBeDefined();
    for (const ch of Object.values(SPEAKER_CHANNEL)) {
      expect(CHANNELS[ch].glyphs.length).toBeGreaterThan(2);
      expect(CHANNELS[ch].source).toMatch(/\S/);
    }
  });

  it('his own lines are not translated; a leader\'s are, on the right channel', () => {
    expect(channelOfLine('You: (log) Filing it under "enrichment".')).toBeNull();
    expect(channelOfLine('Delegate: Dear Visitor.')).toBe('delegation');
    expect(channelOfLine('The Voice (broadcast): Keep your radios on.')).toBe('faithful');
    expect(channelOfLine('The Director (on a call, mid-match): Sorry.')).toBe('institute');
    expect(channelOfLine('The Awaited One: (a little stiffly) Hello.')).toBe('voicebox');
  });

  it('a line\'s confidence is the same every time and inside its channel\'s range', () => {
    for (const l of allLines()) {
      const ch = channelOfLine(l);
      if (!ch) continue;
      const c = confidenceOf(l, ch);
      expect(c).toBe(confidenceOf(l, ch));
      expect(c).toBeGreaterThanOrEqual(CHANNELS[ch].confidence[0]);
      expect(c).toBeLessThanOrEqual(CHANNELS[ch].confidence[1]);
    }
    const lines = FACTIONS[0].beats[0].scene.lines;
    expect(cardConfidence(lines, 'delegation')).toBe(Math.min(...lines.filter((l) => channelOfLine(l)).map((l) => confidenceOf(l, 'delegation'))));
  });

  it('every translator\'s note lands on exactly one leader line that exists', () => {
    const lines = allLines();
    for (const n of TRANSLATOR_NOTES) {
      const hits = lines.filter((l) => l.includes(n.match));
      expect(hits.length, n.match).toBe(1);
      expect(channelOfLine(hits[0]), n.match).not.toBeNull();
      expect(noteFor(hits[0])).toBe(n.note);
    }
  });

  it('notes stay rare: most lines carry none', () => {
    const lines = allLines().filter((l) => channelOfLine(l));
    const noted = lines.filter((l) => noteFor(l));
    expect(noted.length).toBeLessThan(lines.length / 5);
  });
});
