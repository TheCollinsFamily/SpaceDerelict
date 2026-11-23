/**
 * MISSION 1, PLAYED BY THE SCRIPTED PLAYER (Nov 23 2026): the campaign's first deployment (war only, no evolution) after the
 * first waves were made losable for a skirmish (DESIGN.md "The world unfolds": the core's maturing bite, the bigger first
 * rows and squads are shared by every run). Ten seeds: the outcome, the wave it ended in, the core after wave 1.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/mission1.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { newCampaign, plan } from '../../src/meta/campaign';
import { FIRST_MISSION } from '../../src/meta/onboarding';
import type { SimConfig } from '../../src/sim/types';
import { BALANCE as B, WAVE_TABLE } from '../../content/data';

// The same knobs as difficulty.measure.ts: DIFF_SET="k=v,..." (BALANCE), DIFF_ROW0='{...}' (a wave-table row).
for (const kv of (process.env.DIFF_SET || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split('=');
  (B as unknown as Record<string, number>)[k] = Number(v);
}
for (let i = 0; i < WAVE_TABLE.length; i++) {
  const row = process.env['DIFF_ROW' + i];
  if (row) (WAVE_TABLE as Array<Partial<Record<string, number>>>)[i] = JSON.parse(row);
}

it('mission 1 with the scripted player', () => {
  const out: string[] = [];
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const s = newCampaign(seed, { onboarding: true });
    const cfg = { gridW: 50, gridH: 40, cellPx: 26, entrances: 1, genes: [], ...plan(s, FIRST_MISSION).config, seed } as SimConfig;
    const sim = new Sim(cfg);
    const bot = new Autoplayer(seed + 1);
    let core1 = -1;
    for (let t = 0; t < 40000 && sim.outcome === 'playing'; t++) {
      bot.act(sim, DT);
      sim.tick();
      for (const e of sim.takeEvents()) if (e.kind === 'wave-cleared' && e.wave === 1) core1 = Math.round(Math.max(0, sim.coreHp) / sim.coreMaxHp * 100);
    }
    if (sim.outcome === 'won') wins++;
    out.push(`seed ${seed}: ${sim.outcome} in wave ${sim.waveNumber} of ${JSON.stringify(sim.directive)} · core after wave 1 ${core1}% · end ${Math.round(Math.max(0, sim.coreHp) / sim.coreMaxHp * 100)}%`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nmission 1: ${wins}/10 won\n${out.join('\n')}`);
}, 3_600_000);
