import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../content/campaign';
import { LEADER_VOICES } from '../content/media';
import { ROACH_ADDRESSES, ROACH_SCENES } from '../content/roachKing';
import { CHANNELS, SPEAKER_CHANNEL, channelOfLine } from '../content/translation';

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
    }
  });

  it('his own lines are not translated; a leader\'s are, on the right channel', () => {
    expect(channelOfLine('You: (log) Filing it under "enrichment".')).toBeNull();
    expect(channelOfLine('Delegate: Dear Visitor.')).toBe('delegation');
    expect(channelOfLine('The Voice (broadcast): Keep your radios on.')).toBe('faithful');
    expect(channelOfLine('The Director (on a call, mid-match): Sorry.')).toBe('institute');
    expect(channelOfLine('The Awaited One: (a little stiffly) Hello.')).toBe('voicebox');
  });

  // Oct 26 2026: her confidence figures and her translator's notes were cut ("corny and adds nothing").
});
