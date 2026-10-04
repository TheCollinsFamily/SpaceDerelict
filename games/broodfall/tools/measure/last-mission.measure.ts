/**
 * THE LAST MISSION, MEASURED (Oct 4 2026; content/campaign.ts LAST_MISSION, DESIGN.md "THE LAST MISSION"). The scripted
 * player plays the Hive House on a few seeds with everything a finished campaign holds (every lineage, every evolution
 * stage) and prints, for each run: how far it got, the war meat it had to spend in each turn of the countdown and where
 * that meat came from (the shelter's ration against the clearing wage and the bodies), what the court and the Host
 * fielded, and whether the shelter lived.
 *
 *   npx vite-node tools/measure/last-mission.measure.ts                (free; a minute or two)
 *   LAST_RATION=0 npx vite-node tools/measure/last-mission.measure.ts  (the same with no ration: what the shelter is worth)
 *   LAST_TURNS=7 LAST_HOST=5 LAST_TIER=6 ...                           (other countdowns, holds and tiers)
 */
import { DT, Sim } from '../../src/sim/sim';
import { Autoplayer } from '../../src/sim/autoplayer';
import { newCampaign, plan, type CampaignState } from '../../src/meta/campaign';
import { LAST, LAST_MISSION, LINEAGES, TERRITORIES } from '../../content/campaign';
import { ENEMIES } from '../../content/data';
import type { OrganId, SimEvent } from '../../src/sim/types';

const env = (k: string, d: number) => (process.env[k] !== undefined ? Number(process.env[k]) : d);
const TURNS = env('LAST_TURNS', LAST_MISSION.turns);
const HOST = env('LAST_HOST', LAST_MISSION.hostWaves);
const TIER = env('LAST_TIER', LAST_MISSION.minTier);
const RATION = process.env.LAST_RATION !== undefined ? process.env.LAST_RATION.split(',').map(Number) : [...LAST_MISSION.ration];
const SEEDS = (process.env.LAST_SEEDS ?? '11,23,37,41,59,67').split(',').map(Number);
const casteOf = (k: string) => ENEMIES.find((e) => e.kind === k)?.caste ?? '?';

/** A campaign at its end: everything bought, every territory but the last held, the ally's finale played. */
function ended(seed: number): CampaignState {
  const s = { ...newCampaign(seed), onboard: undefined } as CampaignState;
  s.lineages = Object.keys(LINEAGES) as OrganId[];
  s.held = TERRITORIES.filter((t) => !t.last && !t.hidden && (!t.finaleOf || t.finaleOf === 'delegation')).map((t) => t.id);
  s.captures = s.held.length - 1;
  s.deployments = s.captures + 3;
  s.faction = 'delegation';
  s.finale = 'delegation';
  return s;
}

console.log(`THE LAST MISSION: ${TURNS} turns of the court, then the Host at tier ${TIER}+ for ${HOST} waves; ration ${RATION.join('/')}; seeds ${SEEDS.join(' ')}`);
let wins = 0;
for (const seed of SEEDS) {
  const p = plan(ended(seed), LAST);
  const sim = new Sim({
    gridW: 50, gridH: 40, cellPx: 26, ...p.config, seed: seed * 1000 + 7, waveIntel: 'full',
    directive: { kind: 'hold', waves: TURNS + HOST }, lateHost: { turns: TURNS, minTier: TIER }, shelterRation: RATION,
  });
  const auto = new Autoplayer(3);
  const rows: string[] = [];
  let warCameEarly = 0;
  let rationSum = 0;
  let wage = 0;
  let wave = 0;
  for (let i = 0; i < 60000 && sim.outcome === 'playing'; i++) {
    auto.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents() as SimEvent[]) {
      if (e.kind === 'wave-start') {
        wave = e.wave;
        const by: Record<string, number> = {};
        for (const [k, n] of Object.entries(e.counts)) by[casteOf(k)] = (by[casteOf(k)] ?? 0) + (n ?? 0);
        if (e.court && (by.war ?? 0) > 0) warCameEarly += by.war;
        rows.push(`  wave ${String(e.wave).padStart(2)} ${e.court ? 'court' : 'HOST '} tier ${e.tier}  war ${String(by.war ?? 0).padStart(3)}  science ${String(by.science ?? 0).padStart(2)}  royal ${by.royal ?? 0}   limbs ${String(sim.towers.length).padStart(2)}  core ${Math.round(100 * sim.coreHp / sim.coreMaxHp)}%  shelter ${sim.shelters[0]?.state ?? 'none'}${sim.shelters[0]?.state === 'infested' ? ` st${sim.shelters[0].stage}` : ''}`);
      }
      if (e.kind === 'wave-cleared') wage += e.bonus;
      if (e.kind === 'shelter-paid') rationSum += e.ration ?? 0;
    }
    // War bodies on the field during the countdown (none may come: the promise of the mission).
    if (wave >= 1 && wave <= TURNS && sim.enemies.some((x) => casteOf(x.kind) === 'war')) warCameEarly++;
  }
  if (sim.outcome === 'won') wins++;
  console.log(`seed ${seed}: ${sim.outcome.toUpperCase()} after ${sim.wavesCleared}/${TURNS + HOST} waves · shelter at start: ${sim.shelters.length ? 'yes' : 'NO'} · war bodies in the countdown: ${warCameEarly} · ration ${rationSum} war, wage ${wage} war · royal points ${Math.floor(sim.meat.royal)} · limbs ${sim.towers.length} · lost ${sim.stats.limbsLost} · carried off ${sim.stats.limbsCarriedOff}`);
  for (const r of rows) console.log(r);
}
console.log(`won ${wins}/${SEEDS.length}`);
