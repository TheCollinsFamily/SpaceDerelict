/**
 * The hobby genes (content/plates.ts HOBBY_GENES), measured the HANDOFF way: the naive scripted
 * player on hold-12 over ten seeds, with no gene and with each gene alone. A gene may help (it is a
 * reward); none may turn the run into a walkover or break it. Also counts what each gene DID.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/hobbygenes.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { HOBBY_GENES } from '../../content/plates';

function run(seed: number, genes: string[]) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true, genes });
  const bot = new Autoplayer(seed + 1);
  let ticks = 0;
  while (sim.outcome === 'playing' && ticks < 24000) { bot.act(sim, DT); sim.tick(); sim.takeEvents(); ticks++; }
  return sim;
}

it('hobby genes over ten seeds', () => {
  const rows: string[] = [];
  // HOBBY_GENES_ONLY=none,tallow-blood … measures a subset (one process each keeps memory down).
  const only = process.env.HOBBY_GENES_ONLY?.split(',');
  const all = [null, ...HOBBY_GENES.map((x) => x.id)].filter((g) => !only || only.includes(g ?? 'none'));
  for (const g of all) {
    let wins = 0;
    let cleared = 0;
    let core = 0;
    let stuns = 0;
    let burnKills = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = run(seed, g ? [g] : []);
      if (sim.outcome === 'won') wins++;
      cleared += sim.wavesCleared;
      core += Math.max(0, sim.coreHp) / sim.coreMaxHp;
      stuns += sim.stats.matingStuns;
      burnKills += sim.stats.killsByCause.burn ?? 0;
    }
    rows.push(`${(g ?? '(none)').padEnd(18)} wins ${wins}/10  waves cleared ${cleared}  mean core ${(core * 10).toFixed(0)}%  pairings ${stuns}  burn kills ${burnKills}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${rows.join('\n')}`);
});
