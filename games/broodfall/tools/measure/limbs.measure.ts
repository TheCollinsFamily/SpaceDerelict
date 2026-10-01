/**
 * The limbs in play, for the Limb Codex's decision sheet (tools/codex-sheet.mjs): the naive scripted
 * player on hold-12 over ten seeds, the HANDOFF way, counting per limb family how many were built
 * and how many bodies they killed. Writes notes/limb-codex/balance.json.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/limbs.measure.ts
 * What it can say: which limbs the scripted player picks and how hard they hit when picked. What it
 * cannot: how a person would use an aimed or an engine limb (the scripted player aims and chains badly).
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';

it('limbs: built and kills per family, naive hold-12 over ten seeds', () => {
  const built: Record<string, number> = {};
  const kills: Record<string, number> = {};
  const runsWith: Record<string, number> = {};
  // Kills no limb is credited with (poison, fire, clouds, eaten whole, the core): by cause.
  const causes: Record<string, number> = {};
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
    const bot = new Autoplayer(seed + 1);
    const seen = new Set<string>();
    let ticks = 0;
    while (sim.outcome === 'playing' && ticks < 24000) {
      bot.act(sim, DT);
      sim.tick();
      for (const e of sim.takeEvents()) if (e.kind === 'built') { built[e.family] = (built[e.family] ?? 0) + 1; seen.add(e.family); }
      ticks++;
    }
    for (const f of seen) runsWith[f] = (runsWith[f] ?? 0) + 1;
    for (const [c, n] of Object.entries(sim.stats.killsByCause)) causes[c] = (causes[c] ?? 0) + (n as number);
    for (const [f, n] of Object.entries(sim.stats.killsByFamily)) kills[f] = (kills[f] ?? 0) + (n as number);
    if (sim.outcome === 'won') wins++;
  }
  const out = { measured: new Date().toISOString().slice(0, 10), seeds: 10, wins, built, kills, runsWith, causes };
  writeFileSync('notes/limb-codex/balance.json', JSON.stringify(out, null, 1));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out));
});
