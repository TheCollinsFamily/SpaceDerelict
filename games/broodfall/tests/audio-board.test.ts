/**
 * THE BOARD IS HEARD (src/audio/gameSounds.ts watchBoard): played by the scripted player, the
 * limbs' cooldown jumps (the rule the watcher hears a shot by) happen, and for families that have a
 * firing sound. The sounds themselves are faked: this is the watcher's rule against the real sim.
 */
import { describe, expect, it, vi } from 'vitest';

const heard: string[] = [];
vi.mock('../src/audio/engine', () => ({ sfx: (id: string) => { heard.push(id); return true; }, sting: (id: string) => { heard.push(`sting:${id}`); return true; }, say: () => false }));

import { Sim, DT } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { boardEvents, watchBoard } from '../src/audio/gameSounds';

describe('the board is heard', () => {
  it('hears limbs fire, shots land, insects die and waves come, in a scripted run', () => {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 7, directive: { kind: 'hold', waves: 3 }, organStage: true, entrances: 1, genes: [] });
    const auto = new Autoplayer(8);
    watchBoard(sim);
    for (let i = 0; i < 20000 && sim.outcome === 'playing'; i++) {
      auto.act(sim, DT);
      sim.tick();
      boardEvents(sim.takeEvents());
      watchBoard(sim);
    }
    const kinds = new Set(heard);
    expect([...kinds].filter((k) => k.startsWith('fire-')).length, [...kinds].join(' ')).toBeGreaterThan(0);
    expect(kinds.has('hit-splat') || kinds.has('hit-blast'), 'shots land').toBe(true);
    expect([...kinds].some((k) => k.startsWith('die-')), 'insects die').toBe(true);
    expect(kinds.has('sting:sting-wave')).toBe(true);
    expect(kinds.has('limb-grow')).toBe(true);
  });
});
