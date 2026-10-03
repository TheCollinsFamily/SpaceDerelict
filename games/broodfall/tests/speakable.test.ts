/**
 * Words a video model is asked to say never hold an all-caps word: it reads one as an acronym and spells it out
 * (Oct 1 2026: the first-boot film's "nothing E V E R happens"). tools/media/lib.mjs assertSpeakable,
 * tools/art/bmovie.mjs speakable, tools/media/caps-audit.ts.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a .mjs of the tools, no types
import { assertSpeakable } from '../tools/media/lib.mjs';
// @ts-expect-error: a .mjs of the tools, no types
import { LINES, speakable } from '../tools/art/bmovie.mjs';
import { ROACH_ADDRESSES } from '../content/roachKing';

describe('spoken words in capitals', () => {
  it('are refused', () => {
    expect(() => assertSpeakable('Until something came down, out of the SKY!')).toThrow(/SKY/);
    expect(() => speakable('and nothing, EVER happens.')).toThrow(/EVER/);
  });
  it('a capital first letter, "I" and "AI" are fine', () => {
    expect(assertSpeakable('Luckwell Gardens. I am here. Our first real AI models.')).toBeTruthy();
  });
  it('every line of the first-boot film passes', () => {
    for (const l of LINES) expect(() => speakable(l.line)).not.toThrow();
  });
  it('the Roach King\'s lines pass once their capitals are lowered (as roachking.ts does)', () => {
    for (const a of ROACH_ADDRESSES) for (const s of a.shots) {
      if (s.line) expect(() => assertSpeakable(s.line.replace(/\b[A-Z]{2,}\b/g, (w) => w.toLowerCase()))).not.toThrow();
    }
  });
});
