/** The infested planet (Oct 1 2026): how far the flesh has spread over held ground (src/ui/globe.ts). */
import { describe, expect, it } from 'vitest';
import { creepCover, GROWTH_BY_AGE, heldGrowth, infestGrowth } from '../src/ui/globe';

describe('the infested planet', () => {
  it('the crash site is always covered; the newest capture is a blot, older ones spread to their borders', () => {
    const held = ['crash-site', 'granary', 'cul-de-sac', 'harbor'];
    expect(heldGrowth(held, 'crash-site')).toBe(1);
    expect(heldGrowth(held, 'harbor')).toBe(GROWTH_BY_AGE[0]);
    expect(heldGrowth(held, 'cul-de-sac')).toBe(GROWTH_BY_AGE[1]);
    expect(heldGrowth(held, 'granary')).toBe(1);
    expect(heldGrowth(held, 'temple')).toBe(0);
    expect(heldGrowth(['crash-site'], 'crash-site')).toBe(1);
    for (let i = 1; i < GROWTH_BY_AGE.length; i++) expect(GROWTH_BY_AGE[i]).toBeGreaterThan(GROWTH_BY_AGE[i - 1]);
  });
  it('a zone with no growth given: held and under attack are covered, the rest bare', () => {
    expect(infestGrowth('held')).toBe(1);
    expect(infestGrowth('attack')).toBe(1);
    expect(infestGrowth('open')).toBe(0);
    expect(infestGrowth('locked')).toBe(0);
  });
  it('the flesh covers the site, stops at its front, and a grown hold reaches the zone\'s edge', () => {
    expect(creepCover(0, 0.34, 0)).toBe(1);
    expect(creepCover(0.9, 0.34, 0)).toBe(0);
    expect(creepCover(0.95, 1, 0)).toBe(1);
    expect(creepCover(0.3, 0, 0)).toBe(0);
    // More growth never covers less.
    for (const rd of [0.1, 0.4, 0.7, 1]) expect(creepCover(rd, 0.68, 0)).toBeGreaterThanOrEqual(creepCover(rd, 0.34, 0));
  });
});
