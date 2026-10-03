/**
 * Which enemy kinds a campaign mission really fields (Oct 3 2026): the measure behind `objectorPool` in
 * src/meta/campaign.ts (Collins: the Conscientious Objectors pick "only shows a pool of units that would have come on
 * that mission"). The scripted player plays every landing site's plan on a few seeds; for each, the kinds in its
 * `wave-start` counts and the highest wave-table row reached are printed beside what `objectorPool` offers.
 *
 *   npx vite-node tools/measure/objector-pool.measure.ts            (free; about a minute)
 */
import { DT, Sim } from '../../src/sim/sim';
import { Autoplayer } from '../../src/sim/autoplayer';
import { newCampaign, objectorPool, plan } from '../../src/meta/campaign';
import { TERRITORIES } from '../../content/campaign';
import type { SimEvent } from '../../src/sim/types';

const SEEDS = [11, 23, 37];
for (const t of TERRITORIES) {
  const seen = new Set<string>();
  let top = 0;
  let won = 0;
  for (const seed of SEEDS) {
    const c = { ...newCampaign(seed), onboard: undefined };
    const p = plan(c, t.id);
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, ...p.config, seed: seed * 1000 + 7, waveIntel: 'full' });
    const auto = new Autoplayer(3);
    for (let i = 0; i < 40000 && sim.outcome === 'playing'; i++) {
      auto.act(sim, DT);
      sim.tick();
      for (const e of sim.takeEvents() as SimEvent[]) {
        if (e.kind !== 'wave-start') continue;
        top = Math.max(top, (e as unknown as { tier: number }).tier);
        for (const [k, n] of Object.entries((e as unknown as { counts: Record<string, number> }).counts)) if (n > 0) seen.add(k);
      }
    }
    if (sim.outcome === 'won') won++;
  }
  const pool = objectorPool(t.id);
  const missed = [...seen].filter((k) => !pool.includes(k as never));
  const dir = t.directive!;
  console.log(`${t.id.padEnd(15)} ${dir.kind}${dir.kind === 'hold' ? ` ${dir.waves}` : ''}`.padEnd(28)
    + ` top row ${top}  won ${won}/${SEEDS.length}  came: ${[...seen].sort().join(' ')}\n${''.padEnd(28)} offered: ${pool.join(' ')}${missed.length ? `   NOT OFFERED: ${missed.join(' ')}` : ''}`);
}
