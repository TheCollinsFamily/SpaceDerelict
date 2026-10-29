/**
 * THE TURN (Collins, Oct 29 2026): "1. tower set up (it starts with some people running away thats fine for the tower
 * set up stage) 2. wave 3. build body 4. tower set up 5 wave ... right now I open a game and troops just start coming
 * without a tower set up phase". A researcher party used to walk in at second 20 of the 27 s setup, and engineers and
 * the field stations' study parties came only in the setup. Nothing of the enemy's may arrive while the body sets up:
 * every party comes with a wave, and whoever is still walking when a wave is cleared goes home.
 */
import { describe, expect, it } from 'vitest';
import { DT, Sim, enemySpec } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { BALANCE as B } from '../content/data';

describe('the turn', () => {
  for (const seed of [11, 4242]) {
    it(`seed ${seed}: no enemy walks onto the board during the setup, interest high or not, over several turns`, () => {
      const s = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed });
      // A famous specimen: researchers, thieves, engineers and stations all want to come.
      Object.defineProperty(s, 'interest', { get: () => 40, configurable: true });
      const auto = new Autoplayer(seed + 1);
      const seen = new Set<number>();
      const arrivedInSetup: string[] = [];
      let setups = 0;
      let last = s.phase;
      for (let i = 0; i < 40_000 && s.outcome === 'playing' && s.waveNumber < 6; i++) {
        auto.act(s, DT);
        s.tick();
        if (s.phase === 'growth' && last !== 'growth') setups++;
        last = s.phase;
        for (const e of s.enemies) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          if (s.phase === 'growth') arrivedInSetup.push(`${e.kind} at ${s.time.toFixed(1)}s (wave ${s.waveNumber})`);
        }
        // A wave just cleared: nobody of the science caste is left prowling (they walk home; a station stands).
        if (s.phase === 'growth' && s.phaseElapsed < DT * 1.5) {
          for (const e of s.enemies) {
            const spec = enemySpec(e.kind);
            if (spec.caste !== 'science' || spec.fixed) continue;
            if (e.kind === 'engineer' && (e.engState === 'build' || e.engState === 'tend')) continue;
            expect(e.leaving, `${e.kind} still prowling in the setup`).toBe(true);
          }
        }
      }
      expect(setups, `outcome ${s.outcome}, wave ${s.waveNumber}, phase ${s.phase}`).toBeGreaterThanOrEqual(2); // the setups after a wave (a short run is won at wave 3)
      expect(arrivedInSetup).toEqual([]);
    });
  }

  it('the setup waits for the player: the clock stops once it settles, and only an order starts the wave', () => {
    // Collins, Oct 29 2026: "in no tower defence game is any stage timed ... stages are ended by pressing a button / key".
    const s = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 9, playerCallsWaves: true });
    for (let i = 0; i < 5000; i++) s.tick();
    expect(s.phase).toBe('growth');
    expect(s.waveNumber).toBe(0);
    const held = s.tickCount;
    const time = s.time;
    for (let i = 0; i < 100; i++) s.tick();
    expect(s.tickCount).toBe(held);
    expect(s.time).toBe(time);
    expect(s.issue({ kind: 'call-early' }).ok).toBe(true);
    expect(s.phase).toBe('siege');
    s.tick();
    expect(s.tickCount).toBe(held + 1);
  });

  it('a wave is over when the board is clear, not on a clock; a science straggler holds it straggleSeconds at most', () => {
    // "waves are not timed either they are done ... some amount of seconds after the last enemy enters the board or
    // when all enemies are dead (like in case you have a pesky scientists hiding stoping a game from ending)".
    const s = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 9, playerCallsWaves: true });
    for (let i = 0; i < 400; i++) s.tick();
    s.issue({ kind: 'call-early' });
    const P = s as unknown as { spawnQueue: unknown[]; spawnEnemy(k: string): { hp: number; pos: { x: number; y: number } }; lastEntryAt: number };
    // Nothing more to come; one researcher on the board, hiding.
    P.spawnQueue.length = 0;
    s.enemies.length = 0;
    P.spawnEnemy('researcher');
    P.lastEntryAt = s.time;
    const at = s.time;
    for (let i = 0; i < 1000 && s.phase === 'siege'; i++) {
      for (const e of s.enemies) if (e.kind === 'researcher') { e.hp = 1e9; e.pos = { ...s.core }; e.leaving = false; e.studyLeft = 1e9; }
      s.tick();
    }
    expect(s.phase).toBe('growth');
    expect(s.time - at).toBeGreaterThanOrEqual(B.straggleSeconds - DT);
    expect(s.time - at).toBeLessThan(B.straggleSeconds + 1);
  });
});
