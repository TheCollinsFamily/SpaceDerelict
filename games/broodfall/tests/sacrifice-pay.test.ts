/**
 * A card the bank cannot pay for but eating a limb can (Nov 22 2026): the hand colours it apart from "cannot"
 * (src/ui/hud.ts 'by-sacrifice'); Sim.sacrificeDonorsFor names the limbs that would pay.
 */
import { describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { BALANCE as B } from '../content/data';

const sim = () => new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 600 });

describe('paying for a limb with another limb', () => {
  it('names the limbs whose salvage closes the gap, and only when the bank falls short', () => {
    const s = sim();
    s.meat.war = 200; s.meat.science = 200; s.meat.royal = 50;
    let idx = -1;
    for (let g = 0; g < 300 && idx < 0; g++) {
      idx = s.hand.findIndex((c) => c.family === 'spitter');
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    const cell = [...s.map.cells.keys()].find((c) => s.canBuildTower(c))!;
    expect(s.issue({ kind: 'build', cardIndex: idx, cell }).ok).toBe(true);
    const cost = towerSpec('spitter').cost;
    const back = Math.floor((cost.war ?? 0) * B.salvageRate);
    // Enough in the bank: nothing to eat.
    expect(s.sacrificeDonorsFor(cost)).toEqual([]);
    // Short by exactly what the spitter pays back: the spitter pays.
    s.meat.war = (cost.war ?? 0) - back;
    expect(s.sacrificeDonorsFor(cost).map((t) => t.family)).toEqual(['spitter']);
    // Short by one more than that: no single limb pays, so the card stays grey.
    s.meat.war -= 1;
    expect(s.sacrificeDonorsFor(cost)).toEqual([]);
  });
});
