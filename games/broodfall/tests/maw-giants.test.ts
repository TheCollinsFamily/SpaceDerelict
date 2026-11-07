/**
 * MAWS DO NOT SWALLOW GIANTS (Collins, Nov 7 2026: "we might have an issue with the maws accidently eating giant
 * units like the royals"). A Maw swallowed anything worn down to its gullet's hp, so a royal shot down to her last
 * 20 hp went down whole, and a swallowed body pays none of its own meat: the royal points were lost. A GIANT
 * (EnemySpec.giant) is bitten instead. src/sim/sim.ts Sim.mawSwallows.
 */
import { describe, expect, it } from 'vitest';
import { Sim, enemySpec } from '../src/sim/sim';
import type { Enemy, EnemyKind } from '../src/sim/types';
import { ENEMIES } from '../content/data';

const body = (kind: EnemyKind, hp: number) => ({ kind, hp, maxHp: enemySpec(kind).hp } as unknown as Enemy);
const GIANTS: EnemyKind[] = ['royal', 'consort', 'matron', 'phalanx', 'fieldstation', 'sciturret'];

describe('maw gullet vs giants', () => {
  it('marks the royals, the phalanx and the science structures giant', () => {
    expect(ENEMIES.filter((e) => e.giant).map((e) => e.kind).sort()).toEqual([...GIANTS].sort());
  });
  it('never swallows a giant, however worn down, at any gullet', () => {
    for (const k of GIANTS) {
      expect(Sim.mawSwallows(body(k, 1), 25)).toBe(false);
      expect(Sim.mawSwallows(body(k, 1), 10_000)).toBe(false);
    }
  });
  it('still swallows ordinary bodies worn down to its gullet', () => {
    expect(Sim.mawSwallows(body('soldier', 20), 25)).toBe(true);
    expect(Sim.mawSwallows(body('soldier', 30), 25)).toBe(false);
    expect(Sim.mawSwallows(body('elite', 90), 100)).toBe(true); // Swallow Whole: elites go down whole
  });
  it('Royal Diet still lets a royal worn to her share go down, and only royals', () => {
    expect(Sim.mawSwallows(body('royal', 300), 25, 0.3)).toBe(true);
    expect(Sim.mawSwallows(body('royal', 400), 25, 0.3)).toBe(false);
    expect(Sim.mawSwallows(body('phalanx', 1), 25, 0.3)).toBe(false);
  });
});
