/**
 * DEFENCE DEPLOYMENTS, measured (content/defence.ts; DESIGN.md "Defence deployments"): the naive scripted
 * player defends over ten seeds, on both kinds of board a defence can open on:
 *   remembered  the board a full deployment left (the scripted player plays hold-12 to wave 9 or its end,
 *               then the defence opens on that city with those organs);
 *   large       no board remembered: the large city grown before the run.
 * The defence is built by the campaign's own plan() from a campaign two captures in, so it carries what a
 * real one does (the organ pool, evolution caps, the profile). Prints one line a seed and the totals.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/defence.measure.ts
 * DEF_MEAT=war,science,royal  DEF_WAVE=asWave  DEF_TIER=minTier  DEF_LEVEL=coreLevel override content/defence.ts.
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { DEFENCE } from '../../content/defence';
import { finish, newCampaign, plan, targets, type CampaignState } from '../../src/meta/campaign';
import type { RunReport } from '../../src/meta/goals';
import type { BoardSnapshot } from '../../src/sim/boardSnapshot';
import type { SimConfig } from '../../src/sim/types';

const env = (k: string) => process.env[k];
const D = DEFENCE as unknown as Record<string, unknown>;
if (env('DEF_MEAT')) { const [war, science, royal] = env('DEF_MEAT')!.split(',').map(Number); D.meat = { war, science, royal }; }
if (env('DEF_WAVE')) D.asWave = Number(env('DEF_WAVE'));
if (env('DEF_TIER')) D.minTier = Number(env('DEF_TIER'));
if (env('DEF_LEVEL')) D.coreLevel = Number(env('DEF_LEVEL'));
if (env('DEF_LANES')) D.lanes = Number(env('DEF_LANES'));
if (env('DEF_DISTRICTS')) D.large = { ...(D.large as object), districts: Number(env('DEF_DISTRICTS')) };

const stats = (): RunReport['stats'] => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});

/** A campaign with a counter-attack launched on held ground (paper wins, carrying `board`). */
function underAttack(seed: number, board?: BoardSnapshot): CampaignState {
  let s = newCampaign(seed);
  const win = (to: string) => { s = finish(s, plan(s, to), { won: true, wavesCleared: 12, coreEndFrac: 1, scienceBanked: 0, stats: stats(), board }).state; };
  for (let i = 0; i < 10 && !s.underAttack; i++) win(targets(s).find((t) => t.id !== s.staging?.from && !t.finaleOf)!.id);
  if (!s.underAttack) throw new Error(`seed ${seed}: no attack launched`);
  return s;
}

/** A full deployment played by the scripted player to wave 9 (or its end): the board a defence remembers. */
function playedBoard(seed: number): BoardSnapshot {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: seed * 7919, directive: { kind: 'hold', waves: 12 }, organStage: true, startOrgans: ['gut', 'forge'] });
  const bot = new Autoplayer(seed * 7919 + 1);
  for (let t = 0; t < 24000 && sim.outcome === 'playing' && sim.wavesCleared < 9; t++) { bot.act(sim, DT); sim.tick(); }
  return sim.snapshot();
}

function defend(seed: number, board?: BoardSnapshot) {
  const s = underAttack(seed, board);
  const p = plan(s, s.underAttack!);
  const cfg: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 0, ...p.config } as SimConfig;
  const sim = new Sim(cfg);
  const bot = new Autoplayer(seed + 101);
  let ticks = 0;
  let wave = 0;
  for (; sim.outcome === 'playing' && ticks < 20000; ticks++) {
    bot.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents()) if (e.kind === 'wave-start') wave = Object.values(e.counts).reduce((a, n) => a + (n ?? 0), 0);
  }
  return {
    won: sim.outcome === 'won', core: Math.round(Math.max(0, sim.coreHp) / sim.coreMaxHp * 100), wave, tier: sim.tier,
    limbs: sim.towers.length, organs: sim.organs.length, districts: sim.map.slots.filter(Boolean).length,
    gates: sim.gates.length, minutes: (ticks * DT / 60).toFixed(1), meatLeft: Math.round(sim.meat.war),
  };
}

it('defence: the naive scripted player over ten seeds, on remembered and large boards', () => {
  const out: string[] = [];
  for (const kind of ['remembered', 'large'] as const) {
    let wins = 0;
    let core = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const r = defend(seed, kind === 'remembered' ? playedBoard(seed) : undefined);
      if (r.won) wins++;
      core += r.won ? r.core : 0;
      out.push(`${kind.padEnd(10)} seed ${String(seed).padStart(2)} ${r.won ? 'won ' : 'LOST'} core ${String(r.core).padStart(3)}% wave of ${r.wave} (tier ${r.tier}) limbs ${r.limbs} organs ${r.organs} districts ${r.districts} gates ${r.gates} ${r.minutes} min war left ${r.meatLeft}`);
    }
    out.push(`${kind}: ${wins}/10 held, mean core on a hold ${wins ? Math.round(core / wins) : 0}%`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nDEFENCE ${JSON.stringify(DEFENCE.meat)} asWave ${DEFENCE.asWave} minTier ${DEFENCE.minTier} coreLevel ${DEFENCE.coreLevel}\n${out.join('\n')}`);
});
