/**
 * The gameplay gaps closed on Sep 30 2026 (notes/GAPS-2026-09-30.md), measured the HANDOFF way:
 * the naive scripted player on hold-12 over ten seeds, plus what each new mechanic DID in those
 * runs (royal decrees bought, surgeries under fire, burrows). Prints one line per seed.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/gaps.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { BALANCE, WAVE_TABLE } from '../../content/data';
import { PLATES, START_PLATES } from '../../content/plates';

// Ablations (GAPS_MODE, comma-separated): nograft = surgery under fire takes at once;
// surge = the scripted player spends royal points on the old biomass surge instead of decrees.
const MODE = (process.env.GAPS_MODE ?? '').split(',');
// onecrash = every run on the first crash site; fiveplates = only the five districts before Oct 1 2026.
if (MODE.includes('onecrash')) START_PLATES.splice(1);
if (MODE.includes('fiveplates')) PLATES.splice(5);
if (MODE.includes('nograft')) Object.assign(BALANCE as Record<string, unknown>, { graftSeconds: 0, graftPerPip: 0 });
// noflame = no Flametroopers at all (Oct 2 2026): out of the wave table and no answer to your units.
if (MODE.includes('noflame')) {
  for (const row of WAVE_TABLE as Array<Record<string, number>>) delete row.flametrooper;
  Object.assign(BALANCE as Record<string, unknown>, { flamerAnswerMax: 0 });
}
if (MODE.includes('surge')) {
  (Autoplayer.prototype as unknown as { spendRoyal: (sim: Sim) => void }).spendRoyal = (sim: Sim) => { sim.issue({ kind: 'royal-surge' }); };
}

function run(seed: number) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const bot = new Autoplayer(seed + 1);
  // denheavy = Broodmother Dens dealt three times as often (the bot never commands them);
  // stack = the same deal, and the bot runs the Broodmother stack (Autoplayer.stack, Oct 1 2026).
  if (MODE.includes('denheavy') || MODE.includes('stack')) (sim as unknown as { geneMods: { weightMult: Record<string, number> } }).geneMods.weightMult.brood = 3;
  if (MODE.includes('stack')) bot.stack = true;
  // mules = the bot grows a Mule Sac and walks its Spore Mules out to root them (Autoplayer.mules, Oct 2 2026).
  if (MODE.includes('mules')) bot.mules = true;
  // expansion = the bot drafts shelters, infests them and grows Harriers (Autoplayer.expansion, Oct 2 2026).
  if (MODE.includes('expansion')) bot.expansion = true;
  // roster = the bot never selects a unit: one group order per release, alerts left to AUTO (Autoplayer.roster, Oct 2 2026).
  if (MODE.includes('roster')) bot.roster = true;
  // nogroups = the low-micro layer off (no leak answers, no retreats to the creep, no alerts): the baseline for it.
  if (MODE.includes('nogroups')) (sim.groups as unknown as { tick: () => void }).tick = () => {};
  // noauto = no unit kind answers alerts by itself (every AUTO toggle off).
  if (MODE.includes('noauto')) for (const k of Object.keys(sim.groups.auto)) (sim.groups.auto as Record<string, boolean>)[k] = false;
  // shelterstart = the same, with a shelter standing at the start in the district nearest the body, so what an infested
  // shelter is worth is measured (in a normal run one comes at a draft, and a lost run may never reach it).
  if (MODE.includes('shelterstart')) {
    bot.expansion = true;
    const p = sim as unknown as { raiseShelter(slot: number): void };
    const W = sim.cfg.gridW;
    const core = sim.map.coreCell;
    const coreSlot = Math.floor(Math.floor(core / W) / 10) * sim.map.slotsX + Math.floor((core % W) / 10);
    const near = sim.map.slots.map((x, i) => (x && i !== coreSlot ? i : -1)).filter((i) => i >= 0)
      .sort((a, b) => Math.hypot((a % sim.map.slotsX) - (coreSlot % sim.map.slotsX), Math.floor(a / sim.map.slotsX) - Math.floor(coreSlot / sim.map.slotsX)) - Math.hypot((b % sim.map.slotsX) - (coreSlot % sim.map.slotsX), Math.floor(b / sim.map.slotsX) - Math.floor(coreSlot / sim.map.slotsX)));
    for (const slot of near) { p.raiseShelter(slot); if (sim.shelters.length) break; }
  }
  let ticks = 0;
  const kinds: Record<string, number> = {};
  while (sim.outcome === 'playing' && ticks < 24000) {
    bot.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents()) {
      kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
      if (e.kind === 'banked' && e.caste === 'royal') kinds.royalEarned = (kinds.royalEarned ?? 0) + e.amount;
      if (e.kind === 'wave-start') kinds.flamers = (kinds.flamers ?? 0) + (e.counts.flametrooper ?? 0);
    }
    ticks++;
  }
  return { sim, kinds, clicks: bot.clicks };
}

it('gaps: naive hold-12 over ten seeds', () => {
  const rows: string[] = [];
  let wins = 0;
  const seeds = Number(process.env.GAPS_SEEDS || 10); // GAPS_SEEDS: a wider sample than the usual ten
  for (let seed = 1; seed <= seeds; seed++) {
    const { sim, kinds, clicks } = run(seed);
    if (sim.outcome === 'won') wins++;
    const s = sim.stats as unknown as Record<string, unknown>;
    rows.push(`seed ${String(seed).padStart(2)} ${sim.outcome.padEnd(5)} cleared ${String(sim.wavesCleared).padStart(2)} core ${Math.round(Math.max(0, sim.coreHp) / sim.coreMaxHp * 100)}%`
      + ` royal earned ${kinds.royalEarned ?? 0} left ${sim.meat.royal} decrees ${JSON.stringify(s.decrees ?? {})} surgeries ${s.surgeriesUnderFire ?? 0} burrows ${s.burrows ?? 0}`
      + ` brood ${JSON.stringify({ dens: sim.towers.filter((t) => t.family === 'brood').length, pits: sim.towers.filter((t) => t.family === 'hatch').length, born: s.warriorsBorn ?? 0, mothers: s.mothersBorn ?? 0, lost: s.mothersLost ?? 0, nets: s.netsCast ?? 0, netted: s.netHits ?? 0, kills: (s.killsByFamily as Record<string, number>)?.brood ?? 0 })}`
      + ` mules ${JSON.stringify({ born: s.mulesBorn ?? 0, rooted: s.mulesRooted ?? 0, lost: s.mulesLost ?? 0 })} reclaimed ${s.bodiesReclaimed ?? 0}`
      + ` expansion ${JSON.stringify({ shelters: sim.shelters.length, infested: s.sheltersInfested ?? 0, lost: s.sheltersLost ?? 0, top: s.shelterTopStage ?? 0, paid: s.shelterMeat ?? 0, inf: s.infestorsBorn ?? 0, infLost: s.infestorsLost ?? 0, harriers: s.harriersBorn ?? 0, hLost: s.harriersLost ?? 0, hKills: s.harrierKills ?? 0 })} meat ${JSON.stringify(sim.digested)}`
      + ` clicks ${clicks} (${(clicks / Math.max(1, sim.wavesCleared)).toFixed(1)}/wave) sorties ${sim.groups.issued} alerts-auto${JSON.stringify(sim.groups.auto)}`
      + ` events ${['royal-decree', 'limb-promoted', 'surgery-under-fire', 'graft-took', 'burrowed', 'sealed-in', 'broodling-lost', 'mule-lost', 'flamers'].map((k) => `${k}=${kinds[k] ?? 0}`).join(' ')}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${rows.join('\n')}\nnaive hold-12 wins ${wins}/${seeds} (mode: ${MODE.join(',') || 'all built'})`);
});
