/**
 * The gameplay gaps closed on Sep 30 2026 (notes/GAPS-2026-09-30.md), measured the HANDOFF way:
 * the naive scripted player on hold-12 over ten seeds, plus what each new mechanic DID in those
 * runs (royal decrees bought, surgeries under fire, burrows). Prints one line per seed.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/gaps.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { BALANCE } from '../../content/data';

// Ablations (GAPS_MODE, comma-separated): nograft = surgery under fire takes at once;
// surge = the scripted player spends royal points on the old biomass surge instead of decrees.
const MODE = (process.env.GAPS_MODE ?? '').split(',');
if (MODE.includes('nograft')) Object.assign(BALANCE as Record<string, unknown>, { graftSeconds: 0, graftPerPip: 0 });
if (MODE.includes('surge')) {
  (Autoplayer.prototype as unknown as { spendRoyal: (sim: Sim) => void }).spendRoyal = (sim: Sim) => { sim.issue({ kind: 'royal-surge' }); };
}

function run(seed: number) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const bot = new Autoplayer(seed + 1);
  let ticks = 0;
  const kinds: Record<string, number> = {};
  while (sim.outcome === 'playing' && ticks < 24000) {
    bot.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents()) {
      kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
      if (e.kind === 'banked' && e.caste === 'royal') kinds.royalEarned = (kinds.royalEarned ?? 0) + e.amount;
    }
    ticks++;
  }
  return { sim, kinds };
}

it('gaps: naive hold-12 over ten seeds', () => {
  const rows: string[] = [];
  let wins = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const { sim, kinds } = run(seed);
    if (sim.outcome === 'won') wins++;
    const s = sim.stats as unknown as Record<string, unknown>;
    rows.push(`seed ${String(seed).padStart(2)} ${sim.outcome.padEnd(5)} cleared ${String(sim.wavesCleared).padStart(2)} core ${Math.round(Math.max(0, sim.coreHp) / sim.coreMaxHp * 100)}%`
      + ` royal earned ${kinds.royalEarned ?? 0} left ${sim.meat.royal} decrees ${JSON.stringify(s.decrees ?? {})} surgeries ${s.surgeriesUnderFire ?? 0} burrows ${s.burrows ?? 0}`
      + ` events ${['royal-decree', 'limb-promoted', 'surgery-under-fire', 'graft-took', 'burrowed', 'sealed-in'].map((k) => `${k}=${kinds[k] ?? 0}`).join(' ')}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${rows.join('\n')}\nnaive hold-12 wins ${wins}/10 (mode: ${MODE.join(',') || 'all built'})`);
});
