/** A draft never shows the same district card twice (Nov 23 2026: "Residential Warren, Residential Warren, ..."). */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { Rng } from '../src/sim/rng';
import { draftOffers } from '../src/sim/citymap';

describe('draft cards', () => {
  it('three offers carry three different features, science open or closed', () => {
    let drafts = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed });
      for (const science of [true, false]) {
        const offers = draftOffers(sim.map, new Rng(seed * 7), 3, science);
        if (offers.length < 3) continue;
        drafts++;
        expect(new Set(offers.map((o) => o.feature)).size).toBe(3);
        if (!science) expect(offers.some((o) => o.feature === 'science')).toBe(false);
      }
    }
    expect(drafts).toBeGreaterThan(40);
  });
});
