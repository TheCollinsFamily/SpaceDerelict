/**
 * Does the scripted player USE the new systems? Counts, over ten runs: scaffold and seeding
 * glands grown, plinths placed, seedlings grown and built, big limbs built.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/newsystems.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim, towerSpec } from '../../src/sim/sim';
import type { TowerFamily } from '../../src/sim/types';

it('counts the new systems in play', () => {
  const waves: string[] = [];
  const tot = { scaffold: 0, seeder: 0, plinths: 0, seedlingsGrown: 0, seedlingsBuilt: 0, big: 0, wins: 0 };
  for (let seed = 1; seed <= 10; seed++) {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
    const bot = new Autoplayer(seed + 1);
    let ticks = 0;
    while (sim.outcome === 'playing' && ticks < 24000) {
      bot.act(sim, DT);
      sim.tick();
      for (const e of sim.takeEvents() as Array<{ kind: string; organ?: string; family?: TowerFamily; count?: number }>) {
        if (e.kind === 'organ-built' && (e.organ === 'scaffold' || e.organ === 'seeder')) { tot[e.organ] += 1; waves.push(`${e.organ[0]}${sim.wavesCleared}`); }
        if (e.kind === 'plinth-placed') tot.plinths += 1;
        if (e.kind === 'seedling-grown') tot.seedlingsGrown += e.count ?? 1;
        if (e.kind === 'built' && e.family === 'sprout') tot.seedlingsBuilt += 1;
        if (e.kind === 'built' && e.family && towerSpec(e.family).span) tot.big += 1;
      }
      ticks++;
    }
    if (sim.outcome === 'won') tot.wins++;
  }
  // eslint-disable-next-line no-console
  console.log(`NEW SYSTEMS over ten runs: ${JSON.stringify(tot)} · grown after wave: ${waves.join(' ')}`);
});
