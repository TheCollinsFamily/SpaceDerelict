/**
 * How long each skirmish directive lasts (Nov 23 2026): a skirmish draws hold-12, a royal kill or a harvest of 80 science
 * at random, so one run can be far longer than another. The scripted player over ten seeds each.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/directives.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import type { Directive } from '../../src/sim/types';

it('directive lengths', () => {
  const dirs: Directive[] = [{ kind: 'hold', waves: 12 }, { kind: 'royal', count: 1 }, { kind: 'harvest', science: 80 }];
  const out: string[] = [];
  for (const d of dirs) {
    const rows: string[] = [];
    let wins = 0; let waves = 0; let minutes = 0; let organs = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: d, organStage: true });
      const bot = new Autoplayer(seed + 1);
      let t = 0;
      while (sim.outcome === 'playing' && t < 40000) { bot.act(sim, DT); sim.tick(); sim.takeEvents(); t++; }
      if (sim.outcome === 'won') wins++;
      waves += sim.waveNumber; minutes += sim.time / 60; organs += sim.organs.length;
      rows.push(sim.outcome[0] + String(sim.waveNumber));
    }
    out.push(d.kind.padEnd(8) + ' wins ' + wins + '/10 · mean ends in wave ' + (waves / 10).toFixed(1) + ' · ' + (minutes / 10).toFixed(1)
      + ' min of game time · ' + (organs / 10).toFixed(1) + ' organs · runs ' + rows.join(' '));
  }
  // eslint-disable-next-line no-console
  console.log('\n' + out.join('\n'));
}, 600000);
