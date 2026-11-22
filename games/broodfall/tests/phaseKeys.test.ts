import { describe, expect, it } from 'vitest';
import { SpaceLatch, spaceStep, type SpaceContext } from '../src/ui/phaseKeys';

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
