/**
 * IS THE SACRIFICE MANAGING POWER? (Nov 23 2026). Collins: "how about the sacrifice mechanic, is it doing a good job of
 * managing power levels?" The scripted player on hold-12 over ten seeds, its builds rewritten four ways:
 *   never   — never eats a limb
 *   default — the scripted player as it is (every 4th build, once 7 limbs stand, eats a spitter or a spine wall)
 *   greedy  — eats on every 2nd build once 5 limbs stand (any armed one-cell limb, the cheapest)
 *   tall    — feeds ONE line: every 3rd build eats the limb with the most bonuses, so they pile into one limb
 * Per run: the outcome, the most bonuses on one limb, that limb's share of the body's damage per second, the meat the
 * sacrifices threw away (the 40% salvage keeps back), and the hive's interest (every bonus raises it: the science caste
 * comes for the weird).
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/sacrifice.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim, towerSpec } from '../../src/sim/sim';
import { isMultiCell } from '../../src/sim/footprint';
import type { Caste, Tower } from '../../src/sim/types';

type Policy = 'never' | 'default' | 'greedy' | 'tall';
const SEEDS = Number(process.env.SAC_SEEDS || 10);

function dps(sim: Sim, t: Tower): number {
  const s = sim.statsOf(t);
  return s.rate > 0 ? s.rate * s.damage : 0;
}

function run(seed: number, policy: Policy) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const bot = new Autoplayer(seed + 1);
  let builds = 0; let thrown = 0; let eats = 0; let peakShare = 0; let peakPips = 0;
  const issue = sim.issue.bind(sim);
  sim.issue = (cmd) => {
    if (cmd.kind === 'build') {
      const c = { ...cmd };
      builds++;
      const armed = sim.towers.filter((t) => towerSpec(t.family).rate > 0 && !isMultiCell(towerSpec(t.family)) && t.family !== 'tap');
      if (policy === 'never') delete c.cannibalizeTowerId;
      if (policy === 'greedy') {
        delete c.cannibalizeTowerId;
        if (builds % 2 === 0 && sim.towers.length >= 5) {
          const cheap = [...armed].sort((a, b) => (towerSpec(a.family).cost.war ?? 0) - (towerSpec(b.family).cost.war ?? 0))[0];
          if (cheap) c.cannibalizeTowerId = cheap.id;
        }
      }
      if (policy === 'tall') {
        delete c.cannibalizeTowerId;
        if (builds % 3 === 0 && sim.towers.length >= 5) {
          const top = [...armed].sort((a, b) => b.pips.length - a.pips.length)[0];
          if (top) c.cannibalizeTowerId = top.id;
        }
      }
      const donor = c.cannibalizeTowerId !== undefined ? sim.towers.find((t) => t.id === c.cannibalizeTowerId) : undefined;
      const r = issue(c);
      if (r.ok && donor) {
        eats++;
        const cost = towerSpec(donor.family).cost;
        const back = sim.salvageOf(donor.family);
        for (const k of ['war', 'science', 'royal'] as Caste[]) thrown += (cost[k] ?? 0) - (back[k] ?? 0);
      }
      return r;
    }
    return issue(cmd);
  };
  let ticks = 0;
  while (sim.outcome === 'playing' && ticks < 30000) {
    bot.act(sim, DT); sim.tick(); sim.takeEvents(); ticks++;
    if (ticks % 300 === 0) {
      const all = sim.towers.map((t) => dps(sim, t));
      const total = all.reduce((a, b) => a + b, 0);
      if (total > 0) peakShare = Math.max(peakShare, Math.max(...all) / total);
      peakPips = Math.max(peakPips, ...sim.towers.map((t) => t.pips.length), 0);
    }
  }
  return { sim, eats, thrown, peakShare, peakPips };
}

it('sacrifice and power', () => {
  const out: string[] = [];
  for (const policy of ['never', 'default', 'greedy', 'tall'] as Policy[]) {
    let wins = 0; let waves = 0; let core = 0; let eats = 0; let thrown = 0; let share = 0; let pips = 0; let interest = 0; let stolen = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = run(seed, policy);
      if (r.sim.outcome === 'won') wins++;
      waves += r.sim.wavesCleared; core += Math.max(0, r.sim.coreHp) / r.sim.coreMaxHp;
      eats += r.eats; thrown += r.thrown; share += r.peakShare; pips += r.peakPips; interest += r.sim.interest;
      stolen += (r.sim.stats as unknown as { towersStolen?: number }).towersStolen ?? 0;
    }
    const n = SEEDS;
    out.push(`${policy.padEnd(8)} wins ${wins}/${n} · cleared ${(waves / n).toFixed(1)} · core ${(core / n * 100).toFixed(0)}% · eats ${(eats / n).toFixed(1)} · meat thrown away ${(thrown / n).toFixed(0)} · most bonuses on one limb ${(pips / n).toFixed(1)} · top limb share of dps ${(share / n * 100).toFixed(0)}% · interest at end ${(interest / n).toFixed(1)} · limbs stolen ${(stolen / n).toFixed(1)}`);
  }
  // eslint-disable-next-line no-console
  console.log('\n' + out.join('\n'));
}, 900000);
