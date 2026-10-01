/**
 * THE CREEP DIGESTS THE DEAD (Oct 1 2026; src/sim/types.ts Corpse): meat is banked only when the creep
 * reaches a body. Measured the HANDOFF way, the naive scripted player on hold-12 over ten seeds: wins, and by
 * caste the meat banked, the meat the kills left lying unclaimed at the end, and how many bodies were still
 * lying. Runs on a tree from before the corpses too (it then reads only what was banked), for the before/after.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/corpses.measure.ts
 * CORPSE_SEEDS: a wider sample than ten.
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';

type Caste = 'war' | 'science' | 'royal';
const CASTES: Caste[] = ['war', 'science', 'royal'];

function run(seed: number) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const bot = new Autoplayer(seed + 1);
  let ticks = 0;
  const banked: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
  const kills: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
  let maxBodies = 0;
  // Bodies that ever lay OFF the creep (waiting), by caste, and how long they waited before the creep reached them.
  const waited = new Map<number, { caste: Caste | null; from: number; to?: number }>();
  while (sim.outcome === 'playing' && ticks < 24000) {
    bot.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents()) {
      if (e.kind === 'banked') banked[e.caste] += e.amount;
      if (e.kind === 'kill') kills[e.caste] += 1;
    }
    const bodies = (sim as unknown as { corpses?: unknown[] }).corpses;
    if (bodies) {
      maxBodies = Math.max(maxBodies, bodies.length);
      for (const c of bodies as Array<{ id: number; digest?: number; meat: Record<Caste, number> }>) {
        const w = waited.get(c.id);
        if (c.digest === undefined && !w) waited.set(c.id, { caste: c.meat.science > 0 ? 'science' : c.meat.war > 0 ? 'war' : c.meat.royal > 0 ? 'royal' : null, from: sim.time });
        else if (c.digest !== undefined && w && w.to === undefined) w.to = sim.time;
      }
    }
    ticks++;
  }
  const s = sim as unknown as { unclaimedMeat?: () => Record<Caste, number>; corpses?: Array<{ heap?: number }> };
  const unclaimed = s.unclaimedMeat ? s.unclaimedMeat() : { war: 0, science: 0, royal: 0 };
  const lying = s.corpses ? s.corpses.reduce((n, c) => n + (c.heap ?? 1), 0) : 0;
  const ws = [...waited.values()];
  const sci = ws.filter((w) => w.caste === 'science');
  const reached = ws.filter((w) => w.to !== undefined);
  const wait = reached.length ? reached.reduce((n, w) => n + (w.to! - w.from), 0) / reached.length : 0;
  return { sim, banked, kills, unclaimed, lying, maxBodies, offCreep: ws.length, offSci: sci.length, reached: reached.length, wait };
}

it('corpses: naive hold-12 over ten seeds, meat by caste', () => {
  const seeds = Number(process.env.CORPSE_SEEDS || 10);
  const rows: string[] = [];
  let wins = 0;
  const tot = { banked: { war: 0, science: 0, royal: 0 }, unclaimed: { war: 0, science: 0, royal: 0 }, kills: { war: 0, science: 0, royal: 0 } };
  for (let seed = 1; seed <= seeds; seed++) {
    const r = run(seed);
    if (r.sim.outcome === 'won') wins++;
    for (const c of CASTES) { tot.banked[c] += r.banked[c]; tot.unclaimed[c] += r.unclaimed[c]; tot.kills[c] += r.kills[c]; }
    rows.push(`seed ${String(seed).padStart(2)} ${r.sim.outcome.padEnd(5)} cleared ${String(r.sim.wavesCleared).padStart(2)}`
      + ` banked w/s/r ${CASTES.map((c) => r.banked[c]).join('/')}  unclaimed w/s/r ${CASTES.map((c) => r.unclaimed[c]).join('/')}`
      + `  kills w/s/r ${CASTES.map((c) => r.kills[c]).join('/')}  bodies lying at end ${r.lying} (max on board ${r.maxBodies})`
      + `  fell off creep ${r.offCreep} (science ${r.offSci}), creep reached ${r.reached} after ${r.wait.toFixed(1)} s avg`);
  }
  const share = (c: Caste) => {
    const all = tot.banked[c] + tot.unclaimed[c];
    return all > 0 ? `${Math.round((tot.unclaimed[c] / all) * 100)}%` : '-';
  };
  // eslint-disable-next-line no-console
  console.log(`\n${rows.join('\n')}\n`
    + `TOTAL banked w/s/r ${CASTES.map((c) => tot.banked[c]).join('/')}  unclaimed w/s/r ${CASTES.map((c) => tot.unclaimed[c]).join('/')}`
    + `  (unclaimed share w ${share('war')} s ${share('science')} r ${share('royal')})  kills w/s/r ${CASTES.map((c) => tot.kills[c]).join('/')}\n`
    + `naive hold-12 wins ${wins}/${seeds}`);
});
