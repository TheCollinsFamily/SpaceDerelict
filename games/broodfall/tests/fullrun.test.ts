import { describe, expect, it } from 'vitest';
import { Autoplayer } from '../src/sim/autoplayer';
import { DT, Sim } from '../src/sim/sim';
import type { Directive, SimConfig, SimEvent } from '../src/sim/types';

const CFG: Omit<SimConfig, 'seed'> = { gridW: 40, gridH: 30, cellPx: 32 };
const MAX_TICKS = 18000; // 30 sim minutes

function runFull(seed: number, directive?: Directive) {
  const sim = new Sim({ ...CFG, seed, directive: directive ?? { kind: 'hold', waves: 12 } });
  const auto = new Autoplayer(seed + 1);
  const events: SimEvent[] = [];
  let ticks = 0;
  while (sim.outcome === 'playing' && ticks < MAX_TICKS) {
    auto.act(sim, DT);
    sim.tick();
    events.push(...sim.takeEvents());
    ticks++;
  }
  return { sim, events, ticks };
}

describe('full headless runs (autoplayer)', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: completes, escalates, and the economy works`, () => {
      const { sim, events, ticks } = runFull(seed);

      // The run must END inside the cap — no stalemate.
      expect(sim.outcome).not.toBe('playing');

      // The economy moved: things were built, meat was banked.
      const built = events.filter((e) => e.kind === 'built').length;
      const banked = events.filter((e) => e.kind === 'banked').length;
      expect(built).toBeGreaterThan(4);
      expect(banked).toBeGreaterThan(10);

      // Waves happened and researchers were drawn in by interest.
      const waves = events.filter((e) => e.kind === 'wave-start');
      expect(waves.length).toBeGreaterThan(2);
      expect(events.some((e) => e.kind === 'researchers-arrive')).toBe(true);

      // Cannibalize fired at least once (the autoplayer feeds every 4th build).
      expect(events.some((e) => e.kind === 'cannibalized')).toBe(true);

      // Escalation: later waves are higher tier than the first.
      const tiers = waves.map((w) => (w.kind === 'wave-start' ? w.tier : 0));
      expect(Math.max(...tiers)).toBeGreaterThan(tiers[0]);

      // eslint-disable-next-line no-console
      console.log(
        `seed ${seed}: ${sim.outcome} at t=${(ticks * DT / 60).toFixed(1)}min, ` +
        `waves=${waves.length}, maxTier=${Math.max(...tiers)}, built=${built}, ` +
        `cleared=${sim.wavesCleared}, biomass=${sim.biomass.toFixed(0)}, coreHp=${sim.coreHp.toFixed(0)}`,
      );
    });
  }

  it('royal directive: the royal is guaranteed and the run ends', () => {
    const { sim, events } = runFull(5, { kind: 'royal', count: 1 });
    expect(sim.outcome).not.toBe('playing');
    expect(events.some((e) => e.kind === 'royal-incoming')).toBe(true);
    if (sim.outcome === 'won') expect(sim.royalsKilled).toBeGreaterThanOrEqual(1);
  });

  it('harvest directive: science banking is tracked and the run ends', () => {
    const { sim } = runFull(6, { kind: 'harvest', science: 80 });
    expect(sim.outcome).not.toBe('playing');
    if (sim.outcome === 'won') expect(sim.scienceBanked).toBeGreaterThanOrEqual(80);
  });

  it('directive is seeded-random when not forced, and deterministic per seed', () => {
    const a = new Sim({ ...CFG, seed: 11 });
    const b = new Sim({ ...CFG, seed: 11 });
    expect(a.directive).toEqual(b.directive);
  });

  it('at least 2 of 3 seeds are winnable with the naive policy', () => {
    let wins = 0;
    for (const seed of [1, 2, 3]) {
      if (runFull(seed).sim.outcome === 'won') wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(2);
  });
});
