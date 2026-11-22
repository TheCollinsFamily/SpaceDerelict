/**
 * THE ORGAN STAGE'S ECONOMY, MEASURED (Nov 22 2026; Collins: "the organ stage is using the same currency as the limb stage
 * ... a secondary currency like processed food should build for the organ stage based on what you earned not what you had
 * left"). DESIGN.md "Chyme". The naive scripted player, hold-12, ten seeds (ORG_SEEDS), on the real Sim.
 *
 * Per run: the outcome, waves cleared, limbs grown, organs grown and levels bought (and on which wave), what was spent
 * on limbs and on organs, meat spoiled at the wave starts, the war/science digested, and (once it exists) the chyme
 * earned, spent and left. Then the curves across waves (means over the seeds that reached that wave).
 *
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/organ-economy.measure.ts
 *   ORG_SEEDS=10  ORG_HOLD=12  ORG_OUT=<file> (the table is also written there)
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { ORGAN_BY_ID } from '../../content/underground';
import { BALANCE } from '../../content/data';
import type { Command, SimConfig } from '../../src/sim/types';

// ORG_BAL: a JSON object of BALANCE numbers to try (the model's candidates), e.g. {"waveBonusBase":0,"waveBonusPerWave":0}.
if (process.env.ORG_BAL) Object.assign(BALANCE as Record<string, unknown>, JSON.parse(process.env.ORG_BAL));
// ORG_ECON=meat: the economy before chyme (organs bought with war and science), for the before/after comparison.
const ECON = process.env.ORG_ECON === 'meat' ? 'meat' : undefined;

type Wave = { earnedWar: number; earnedSci: number; wage: number; chymeIn: number; organs: number; levels: number; organSpend: number; limbSpend: number; limbs: number; spoiled: number };
const blank = (): Wave => ({ earnedWar: 0, earnedSci: 0, wage: 0, chymeIn: 0, organs: 0, levels: 0, organSpend: 0, limbSpend: 0, limbs: 0, spoiled: 0 });
const sumCost = (c: Record<string, number | undefined>) => Object.values(c).reduce<number>((a, b) => a + (b ?? 0), 0);

function run(seed: number, hold: number) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: hold }, organStage: true, ...(ECON ? { organEconomy: ECON } : {}) } as SimConfig);
  const bot = new Autoplayer(seed + 1);
  const waves: Wave[] = [blank()];
  const cur = () => waves[waves.length - 1];
  const orig = sim.issue.bind(sim);
  const s = sim as unknown as Record<string, unknown>;
  (sim as unknown as { issue: (c: Command) => { ok: boolean } }).issue = (cmd: Command) => {
    let organCost = 0;
    if (cmd.kind === 'build-organ') organCost = sumCost(sim.organCost(cmd.organ) as Record<string, number>);
    if (cmd.kind === 'upgrade-organ') {
      const o = cmd.organInstanceId === -1 ? null : sim.organs.find((x) => x.id === cmd.organInstanceId) ?? null;
      organCost = sumCost(sim.organUpgradeCost(o) as Record<string, number>);
    }
    const before = sim.meat.war + sim.meat.science;
    const r = orig(cmd);
    if (r.ok) {
      if (cmd.kind === 'build-organ') { cur().organs++; cur().organSpend += organCost; }
      if (cmd.kind === 'upgrade-organ') { cur().levels++; cur().organSpend += organCost; }
      if (cmd.kind === 'build') { cur().limbs++; cur().limbSpend += Math.max(0, before - (sim.meat.war + sim.meat.science)); }
    }
    return r;
  };
  let ticks = 0;
  let chymeEarned = 0;
  while (sim.outcome === 'playing' && ticks < 30000) {
    bot.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents()) {
      const ev = e as unknown as Record<string, number> & { kind: string; caste?: string };
      if (e.kind === 'banked' && ev.caste === 'war') cur().earnedWar += ev.amount;
      if (e.kind === 'banked' && ev.caste === 'science') cur().earnedSci += ev.amount;
      if (e.kind === 'meat-cleared') cur().spoiled += ev.war + ev.science;
      if (e.kind === 'wave-cleared') { cur().wage += ev.bonus; waves.push(blank()); }
      if (e.kind === 'chyme-tally') { cur().chymeIn += ev.earned; chymeEarned += ev.earned; }
    }
    ticks++;
  }
  const themes = sim.organs.filter((o) => ORGAN_BY_ID[o.organ].kind === 'theme').length;
  const levels = sim.organs.reduce((a, o) => a + (o.level - 1), 0) + (sim.coreLevel - 1);
  return { sim, waves, themes, levels, chymeEarned, chymeLeft: Number(s.chyme ?? 0) };
}

it('organ economy: naive hold-12 over ten seeds', () => {
  const seeds = Number(process.env.ORG_SEEDS || 10);
  const hold = Number(process.env.ORG_HOLD || 12);
  const rows: string[] = [];
  const all: Wave[][] = [];
  let wins = 0;
  const tot = { organs: 0, levels: 0, limbs: 0, organSpend: 0, limbSpend: 0, spoiled: 0, themes: 0, chyme: 0, chymeLeft: 0, cleared: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    const r = run(seed, hold);
    all.push(r.waves);
    if (r.sim.outcome === 'won') wins++;
    const w = r.waves.reduce((a, x) => { for (const k of Object.keys(a) as (keyof Wave)[]) a[k] += x[k]; return a; }, blank());
    tot.organs += w.organs; tot.levels += w.levels; tot.limbs += w.limbs; tot.organSpend += w.organSpend; tot.limbSpend += w.limbSpend;
    tot.spoiled += w.spoiled; tot.themes += r.themes; tot.chyme += r.chymeEarned; tot.chymeLeft += r.chymeLeft; tot.cleared += r.sim.wavesCleared;
    rows.push(`seed ${String(seed).padStart(2)} ${r.sim.outcome.padEnd(5)} cleared ${String(r.sim.wavesCleared).padStart(2)} core ${String(Math.round(Math.max(0, r.sim.coreHp) / r.sim.coreMaxHp * 100)).padStart(3)}%`
      + ` limbs ${String(w.limbs).padStart(3)} (spent ${w.limbSpend}) organs ${String(w.organs).padStart(2)} themes ${r.themes} levels ${String(w.levels).padStart(2)} (spent ${w.organSpend})`
      + ` spoiled ${w.spoiled} war-in ${w.earnedWar}+${w.wage} wage sci-in ${w.earnedSci} chyme ${r.chymeEarned} left ${r.chymeLeft} meat-left ${r.sim.meat.war}/${r.sim.meat.science}`);
  }
  const n = seeds;
  rows.push(`\nwins ${wins}/${n}  per run: cleared ${(tot.cleared / n).toFixed(1)} limbs ${(tot.limbs / n).toFixed(1)} organs ${(tot.organs / n).toFixed(1)} themes ${(tot.themes / n).toFixed(1)} levels ${(tot.levels / n).toFixed(1)}`
    + ` limb-spend ${(tot.limbSpend / n).toFixed(0)} organ-spend ${(tot.organSpend / n).toFixed(0)} spoiled ${(tot.spoiled / n).toFixed(0)} chyme ${(tot.chyme / n).toFixed(0)} chyme-left ${(tot.chymeLeft / n).toFixed(0)}`);
  rows.push('\nper wave (means over the runs that reached it): the organ stage AFTER wave n is counted in row n');
  rows.push('wave runs  war-in sci-in  wage chyme-in  limbs limb$  organs levels organ$  spoiled');
  const maxW = Math.max(...all.map((w) => w.length));
  for (let i = 0; i < maxW; i++) {
    const have = all.filter((w) => w[i]).map((w) => w[i]);
    const m = (k: keyof Wave) => (have.reduce((a, x) => a + x[k], 0) / have.length);
    rows.push(`${String(i).padStart(4)} ${String(have.length).padStart(4)} ${m('earnedWar').toFixed(0).padStart(7)} ${m('earnedSci').toFixed(0).padStart(6)} ${m('wage').toFixed(0).padStart(5)} ${m('chymeIn').toFixed(0).padStart(8)}`
      + ` ${m('limbs').toFixed(1).padStart(6)} ${m('limbSpend').toFixed(0).padStart(5)} ${m('organs').toFixed(1).padStart(7)} ${m('levels').toFixed(1).padStart(6)} ${m('organSpend').toFixed(0).padStart(6)} ${m('spoiled').toFixed(0).padStart(8)}`);
  }
  const text = rows.join('\n');
  if (process.env.ORG_OUT) writeFileSync(process.env.ORG_OUT, text);
  // eslint-disable-next-line no-console
  console.log(`\n${text}`);
});
