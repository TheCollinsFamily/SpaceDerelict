/**
 * SAVE AND EXIT (Collins, Oct 29 2026): a run saved mid-deployment is its config and the orders given, at their ticks
 * (src/meta/runSave.ts). Played back into a fresh sim it must be the same board to the last body and the last meat,
 * or a resumed game is a different game. The setup held for the player (playerCallsWaves) and the wave called by an
 * order are in it, as in the real game.
 */
import { describe, expect, it } from 'vitest';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { replayRun, type RunSave } from '../src/meta/runSave';
import type { Command, SimConfig } from '../src/sim/types';

const state = (s: Sim) => JSON.stringify({
  t: s.tickCount, time: s.time.toFixed(3), wave: s.waveNumber, phase: s.phase, meat: s.meat, core: s.coreHp.toFixed(3),
  towers: s.towers.map((t) => [t.id, t.family, t.cell, t.hp.toFixed(3)]),
  enemies: s.enemies.map((e) => [e.id, e.kind, e.pos.x.toFixed(3), e.pos.y.toFixed(3), e.hp.toFixed(3)]),
  hand: s.hand.map((c) => c.family),
});

describe('a saved run', () => {
  for (const seed of [5, 31]) {
    it(`seed ${seed}: played back from its orders, it is the same board`, () => {
      const cfg: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed, organStage: true, playerCallsWaves: true };
      const live = new Sim(cfg);
      const cmds: RunSave['cmds'] = [];
      const issue0 = live.issue.bind(live);
      live.issue = (c: Command) => { cmds.push({ t: live.tickCount, c: JSON.parse(JSON.stringify(c)) }); return issue0(c); };
      const bot = new Autoplayer(seed + 1);
      let held = 0;
      for (let i = 0; i < 9000 && live.outcome === 'playing' && live.waveNumber < 5; i++) {
        bot.act(live, DT);
        const before = live.tickCount;
        live.tick();
        // The setup waits for the player: a few held frames (the world does not move), then he starts the wave.
        if (live.tickCount === before && live.phase === 'growth' && ++held % 5 === 0) live.issue({ kind: 'call-early' });
      }
      expect(live.waveNumber).toBeGreaterThanOrEqual(3);
      expect(held).toBeGreaterThan(0);
      const again = new Sim(JSON.parse(JSON.stringify(cfg)));
      replayRun(again, { cmds, ticks: live.tickCount });
      expect(state(again)).toBe(state(live));
    });
  }
});
