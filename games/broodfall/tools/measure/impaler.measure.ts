/**
 * THE IMPALER'S LINE OF FIRE, measured (Nov 22 2026, Collins: "the impaler should be more directional in its shot
 * given its design"). The naive scripted player on hold-12 over ten seeds, the HANDOFF way, with the Impaler firing
 * only down its rail (content/data.ts lineOfFire) and, on the same seeds, firing all round as it did before.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/impaler.measure.ts
 *   IMPALER_ARM=round ...   only the old way;  IMPALER_ARM=rail ...   only the new
 * Reports wins, Impalers built, their kills and kills per Impaler built. Asserts nothing.
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim, towerSpec } from '../../src/sim/sim';

const arms = (process.env.IMPALER_ARM ?? 'rail,round').split(',');

it('impaler: down its rail vs all round, naive hold-12 over ten seeds', () => {
  const spec = towerSpec('impaler');
  // IMPALER_HALF=0.785 tries another half-angle (radians) for the rail arm.
  const rail = process.env.IMPALER_HALF ? Number(process.env.IMPALER_HALF) : spec.lineOfFire;
  const kept = spec.lineOfFire;
  const out: Record<string, unknown> = {};
  for (const arm of arms) {
    spec.lineOfFire = arm === 'rail' ? rail : undefined;
    let wins = 0, built = 0, kills = 0, wavesSum = 0;
    const perSeed: string[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
      const bot = new Autoplayer(seed + 1);
      let ticks = 0;
      let b = 0;
      while (sim.outcome === 'playing' && ticks < 24000) {
        bot.act(sim, DT);
        sim.tick();
        for (const e of sim.takeEvents()) if (e.kind === 'built' && e.family === 'impaler') b++;
        ticks++;
      }
      const k = sim.stats.killsByFamily.impaler ?? 0;
      built += b; kills += k;
      wavesSum += sim.wavesCleared;
      if (sim.outcome === 'won') wins++;
      perSeed.push(`${seed}:${sim.outcome === 'won' ? 'won' : 'lost'} after ${sim.wavesCleared}, ${b} impalers, ${k} kills`);
    }
    out[arm] = { wins, impalersBuilt: built, impalerKills: kills, killsPerImpaler: built ? +(kills / built).toFixed(1) : 0, meanWavesCleared: wavesSum / 10, perSeed: perSeed.join('; ') };
  }
  spec.lineOfFire = kept;
  // eslint-disable-next-line no-console
  console.log(`IMPALER-MEASURE ${JSON.stringify(out)}`);
});
