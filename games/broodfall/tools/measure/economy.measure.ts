/**
 * THE BETWEEN-MISSION ECONOMY, MEASURED ON REAL RUNS (Collins, Oct 5 2026: "have we balanced the between game point system
 * so you will earn most of the roguelite unlocks in a single play through?"; Oct 26 2026: "I dont remember building out the
 * economy ... is that built and mapped out?"). notes/MISSIONS-AND-AFTER-TODO-2026-10-05.md item 15: the arithmetic there
 * was from the content tables; this plays it.
 *
 * Two parts:
 *  1. EXPERIMENTS: each experiment's run, alone, on a real landing site, ten seeds, the naive scripted player. Does its
 *     goal ever get met by someone who is not trying? (A goal the bot meets by accident is easy; one it never meets is
 *     either a goal that needs intent, or a broken one: the counts below say which thing it reached for.)
 *  2. A WHOLE CAMPAIGN through the game's own rules (src/meta/campaign.ts) with a real Sim per deployment: standing and
 *     field notes earned per deployment, what they bought (the cheapest unowned lineage, as soon as it can be paid),
 *     what was left unbought at the end.
 *
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/economy.measure.ts
 *   ECON_PART=experiments | campaign   (one part only)   ECON_SEEDS=10   ECON_CAMPAIGNS=3
 *   ECON_LOG=<file>: each deployment's line is appended there as it is played (a campaign takes many minutes)
 */
import { appendFileSync } from 'node:fs';
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import type { SimConfig, OrganId } from '../../src/sim/types';
import { DARES, EXPERIMENTS, LINEAGES, LAST, FACTIONS } from '../../content/campaign';
import { ally, buyLineage, dismissScene, experimentsAvailable, finish, newCampaign, plan, stayLoyal, targets, type CampaignState, type DeploymentPlan } from '../../src/meta/campaign';
import type { RunReport } from '../../src/meta/goals';

const BASE: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1, directive: { kind: 'hold', waves: 12 }, organStage: true };

function play(p: DeploymentPlan, botSeed: number, experimenter = true): { sim: Sim; report: RunReport } {
  const cfg: SimConfig = { ...BASE, ...p.config, gridW: p.config.gridW ?? BASE.gridW, gridH: p.config.gridH ?? BASE.gridH, cellPx: BASE.cellPx } as SimConfig;
  const sim = new Sim(cfg);
  const bot = new Autoplayer(botSeed);
  bot.experimenter = experimenter;
  let ticks = 0;
  while (sim.outcome === 'playing' && ticks < 30000) { bot.act(sim, DT); sim.tick(); sim.takeEvents(); ticks++; }
  const report: RunReport = { won: sim.outcome === 'won', wavesCleared: sim.wavesCleared, coreEndFrac: Math.max(0, sim.coreHp / sim.coreMaxHp), scienceBanked: sim.scienceBanked, stats: sim.stats };
  return { sim, report };
}

const part = process.env.ECON_PART;
const SEEDS = Number(process.env.ECON_SEEDS) || 10;

it.runIf(!part || part === 'experiments')('each experiment on real runs', () => {
  const rows: string[] = [];
  for (const e of EXPERIMENTS) for (const tries of [false, true]) {
    let met = 0, wins = 0;
    const got: number[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      // A campaign that has reached the experiment (past mission 1, enough captures), on its first open landing site.
      let s: CampaignState = { ...newCampaign(seed * 97), onboard: { mission1: 'won', deskOpen: true }, captures: e.requires?.captures ?? 0 };
      if (!experimentsAvailable(s).some((x) => x.id === e.id)) throw new Error(`${e.id} not available`);
      const site = targets(s)[0].id;
      const p = plan(s, site, { experiment: e.id });
      const { report } = play(p, seed + 1, tries);
      const r = finish(s, p, report).debrief.experiment!;
      if (r.met) met++;
      if (report.won) wins++;
      got.push(r.value);
      s = finish(s, p, report).state;
    }
    rows.push(`${e.id.padEnd(15)} ${tries ? 'TRYING ' : 'naive  '} goal "${e.goal.text.replace('{n}', String(e.goal.target))}" met ${met}/${SEEDS}  won ${wins}/${SEEDS}  reached ${got.join(' ')}`);
  }
  console.log(`\nEXPERIMENTS (the scripted player, naive and then playing the experiment's gear)\n${rows.join('\n')}`);
});

it.runIf(!part || part === 'campaign')('whole campaigns on real runs', () => {
  const N = Number(process.env.ECON_CAMPAIGNS) || 3;
  const out: string[] = [];
  for (let c = 0; c < N; c++) {
    const faction = FACTIONS[c % FACTIONS.length].id;
    let s: CampaignState = { ...newCampaign(5000 + c), onboard: { mission1: 'won', deskOpen: true } };
    let standingEarned = 0, notesEarned = 0, wins = 0, deploys = 0;
    const bought: string[] = [];
    const tried: Record<string, number> = {};
    const lines: string[] = [];
    for (let n = 1; n <= 40 && !s.ended; n++) {
      const open = targets(s);
      if (!open.length) break;
      const pick = (s.underAttack ? open.find((t) => t.id === s.underAttack) : undefined)
        ?? open.find((t) => t.id === LAST) ?? open.find((t) => !t.finaleOf) ?? open.find((t) => t.finaleOf === s.faction) ?? open[0];
      // A player who plays the meta: the experiment on offer tried least so far, and two dares not yet done.
      const exp = experimentsAvailable(s).map((e) => e.id).sort((a, b) => (tried[a] ?? 0) - (tried[b] ?? 0))[0];
      if (exp) tried[exp] = (tried[exp] ?? 0) + 1;
      const dares = DARES.filter((d) => !s.daresDone.includes(d.id)).map((d) => d.id).sort((a, b) => (tried[a] ?? 0) - (tried[b] ?? 0)).slice(0, 2);
      for (const d of dares) tried[d] = (tried[d] ?? 0) + 1;
      const p = plan(s, pick.id, { experiment: exp, dares });
      const { report } = play(p, 7000 + c * 100 + n);
      const { state, debrief } = finish(s, p, report);
      deploys++; if (report.won) wins++;
      standingEarned += debrief.standing; notesEarned += debrief.notes;
      s = state;
      if (!s.faction && s.captures >= 1) s = ally(s, faction);
      if (s.midpoint?.status === 'offered') s = stayLoyal(s);
      while (s.pendingScenes.length) s = dismissScene(s);
      // Spend: the cheapest unowned lineage the wallet covers, again and again.
      for (;;) {
        const can = (Object.entries(LINEAGES) as Array<[OrganId, { catalogue: string; price: number }]>)
          .filter(([id, l]) => l.catalogue !== 'start' && !s.lineages.includes(id))
          .filter(([, l]) => (l.catalogue === 'sanctioned' ? s.standing : s.notes) >= l.price)
          .sort((a, b) => a[1].price - b[1].price);
        if (!can.length) break;
        const r = buyLineage(s, can[0][0]);
        if (!r.ok) break;
        s = r.state; bought.push(`${can[0][0]}@${deploys}`);
      }
      const line = `  ${String(n).padStart(2)} ${pick.id.padEnd(16)} ${report.won ? 'WON ' : 'lost'} +${debrief.standing} standing (board ${debrief.board.filter((g) => g.met).length}/3${debrief.orders ? '' : ''}) +${debrief.notes} notes${p.experiment ? ` exp ${p.experiment.def.id}:${debrief.experiment?.met ? 'MET' : 'no'}` : ''}  wallet ${s.standing}s/${s.notes}n`;
      lines.push(line);
      if (process.env.ECON_LOG) appendFileSync(process.env.ECON_LOG, `c${c + 1} ${line}
`);
    }
    const sanctioned = Object.entries(LINEAGES).filter(([, l]) => l!.catalogue === 'sanctioned');
    const unsanctioned = Object.entries(LINEAGES).filter(([, l]) => l!.catalogue === 'unsanctioned');
    const have = (xs: Array<[string, unknown]>) => xs.filter(([id]) => s.lineages.includes(id as OrganId)).length;
    out.push(`\nCAMPAIGN ${c + 1} (${faction}): ${deploys} deployments, ${wins} won, ${s.ended ? `ended (${s.ended})` : 'did not end'}`
      + `\n  standing earned ${standingEarned}, field notes earned ${notesEarned}; left unspent ${s.standing}s / ${s.notes}n`
      + `\n  sanctioned lineages ${have(sanctioned)}/${sanctioned.length} (cost ${sanctioned.reduce((a, [, l]) => a + l!.price, 0)}), unsanctioned ${have(unsanctioned)}/${unsanctioned.length}`
      + `\n  experiments done ${s.experimentsDone.length}/${EXPERIMENTS.length} (${s.experimentsDone.join(', ') || 'none'}); dares done ${s.daresDone.length}/${DARES.length}; profiles ${s.profiles.join(', ')}`
      + `\n  bought: ${bought.join(' ')}\n${lines.join('\n')}`);
  }
  console.log(out.join('\n'));
});
