import { describe, expect, it } from 'vitest';
import { SpaceLatch, spaceStep, speedKey, type SpaceContext } from '../src/ui/phaseKeys';
import { DEFAULT_KEYS, rebind } from '../src/meta/keys';

// Collins, Nov 22 2026: "space should go from the organ menu to the phase set up" — one step a press.
const base: SpaceContext = { started: true, auto: false, blocked: false, underOpen: false, phase: 'growth', outcome: 'playing' };

describe('Space between waves', () => {
  it('goes organ stage -> surface, then surface -> wave', () => {
    expect(spaceStep({ ...base, underOpen: true })).toBe('surface');
    expect(spaceStep(base)).toBe('wave');
  });
  it('does nothing in a wave, a draft, a report, the settings, the demo or before the run', () => {
    expect(spaceStep({ ...base, phase: 'siege' })).toBeNull();
    expect(spaceStep({ ...base, phase: 'draft' })).toBeNull();
    expect(spaceStep({ ...base, blocked: true })).toBeNull();
    expect(spaceStep({ ...base, blocked: true, underOpen: true })).toBeNull();
    expect(spaceStep({ ...base, auto: true })).toBeNull();
    expect(spaceStep({ ...base, started: false })).toBeNull();
    expect(spaceStep({ ...base, outcome: 'won' })).toBeNull();
  });
  it('a held Space is one step, not two', () => {
    const l = new SpaceLatch();
    expect(l.press(false)).toBe(true); // organ stage -> surface
    expect(l.press(true)).toBe(false); // auto-repeat
    expect(l.press(false)).toBe(false); // a repeat that is not flagged
    l.release();
    expect(l.press(false)).toBe(true); // a new press: the wave
  });
});

describe('speed keys (Bruno, Nov 27 2026)', () => {
  const k = DEFAULT_KEYS;
  it('Z, X and V are the 1×, 3× and 8× buttons', () => {
    expect(speedKey(k, 'z', 0, 1)).toBe(1);
    expect(speedKey(k, 'X', 1, 1)).toBe(3);
    expect(speedKey(k, 'v', 3, 1)).toBe(8);
  });
  it('Space pauses, and Space again gives back the speed before the pause', () => {
    expect(speedKey(k, ' ', 8, 1)).toBe(0);
    expect(speedKey(k, ' ', 0, 8)).toBe(8);
    expect(speedKey(k, ' ', 0, 0)).toBe(1);
  });
  it('other keys are not speed keys, and a new key works once it is bound', () => {
    expect(speedKey(k, 'q', 1, 1)).toBeNull();
    expect(speedKey(k, '1', 1, 1)).toBeNull();
    const p = rebind(k, 'pause', 'p')!;
    expect(speedKey(p, 'p', 1, 1)).toBe(0);
    expect(speedKey(p, ' ', 1, 1)).toBeNull();
  });
});
