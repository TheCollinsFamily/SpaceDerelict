/**
 * THE LOOP, WAVE BY WAVE (Nov 23 2026). Collins: "what are we not thinking through in the gameplay loop? play some and
 * test". The scripted player on hold-12 over several seeds, one row a wave: how long the wave and the setup lasted, what
 * meat came in and went out, what spoiled at the next wave's start, how often the hand could not be paid, what the body
 * bought (limbs, sacrifices, evolutions, organs, decrees), chyme in and out, what hit the core.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/loop.measure.ts
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim, towerSpec } from '../../src/sim/sim';
import type { Caste } from '../../src/sim/types';

interface Row {
  wave: number; siegeS: number; setupS: number;
  earned: Record<Caste, number>; spoiled: { war: number; science: number };
  bankAtStart: Record<Caste, number>;
  builds: number; butchers: number; evolves: number; discards: number; organs: number; organUps: number; decrees: number;
  chymeIn: number; chymeBank: number; coreHits: number; coreDmg: number; limbsLost: number; stolen: number;
  limbs: number; handStuckFrac: number; handAllPaidFrac: number;
}

const SEEDS = Number(process.env.LOOP_SEEDS || 6);

function run(seed: number) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const bot = new Autoplayer(seed + 1);
  const rows: Row[] = [];
  let cur: Row | null = null;
  let ticks = 0; let stuck = 0; let allPaid = 0; let sampled = 0;
  let phaseT = { siege: 0, setup: 0 };
  const coreBefore = () => sim.coreHp;
  let lastCore = coreBefore();
  let chymeBefore = sim.chymeEarned;
  const newRow = (wave: number): Row => ({
    wave, siegeS: 0, setupS: 0, earned: { war: 0, science: 0, royal: 0 }, spoiled: { war: 0, science: 0 },
    bankAtStart: { ...sim.meat }, builds: 0, butchers: 0, evolves: 0, discards: 0, organs: 0, organUps: 0, decrees: 0,
    chymeIn: 0, chymeBank: 0, coreHits: 0, coreDmg: 0, limbsLost: 0, stolen: 0, limbs: 0, handStuckFrac: 0, handAllPaidFrac: 0,
  });
  while (sim.outcome === 'playing' && ticks < 30000) {
    bot.act(sim, DT);
    sim.tick();
    ticks++;
    if (sim.phase === 'siege') phaseT.siege += DT; else phaseT.setup += DT;
    // How the hand stands, sampled every half second.
    if (ticks % 15 === 0 && sim.hand.length) {
      sampled++;
      const pay = sim.hand.map((c) => !!c.free || sim.canAfford(towerSpec(c.family).cost));
      if (!pay.some(Boolean)) stuck++;
      if (pay.every(Boolean)) allPaid++;
    }
    if (sim.coreHp < lastCore && cur) { cur.coreDmg += lastCore - sim.coreHp; }
    lastCore = sim.coreHp;
    for (const e of sim.takeEvents()) {
      if (e.kind === 'wave-start') {
        if (cur) {
          cur.siegeS = phaseT.siege; cur.setupS = phaseT.setup; cur.handStuckFrac = stuck / Math.max(1, sampled); cur.handAllPaidFrac = allPaid / Math.max(1, sampled);
          cur.chymeIn = sim.chymeEarned - chymeBefore; cur.chymeBank = sim.chyme; cur.limbs = sim.towers.length; rows.push(cur);
        }
        chymeBefore = sim.chymeEarned;
        phaseT = { siege: 0, setup: 0 }; stuck = 0; allPaid = 0; sampled = 0;
        cur = newRow(sim.waveNumber);
      }
      if (!cur) continue;
      if (e.kind === 'meat-cleared') { cur.spoiled.war += e.war; cur.spoiled.science += e.science; }
      if (e.kind === 'banked') cur.earned[e.caste] += e.amount;
      if (e.kind === 'built') cur.builds++;
      if (e.kind === 'butchered') cur.butchers++;
      if (e.kind === 'evolved') cur.evolves++;
      if (e.kind === 'discarded') cur.discards++;
      if (e.kind === 'organ-built') cur.organs++;
      if (e.kind === 'organ-upgraded') cur.organUps++;
      if (e.kind === 'royal-decree') cur.decrees++;
      if (e.kind === 'core-hit') cur.coreHits++;
      if (e.kind === 'structure-lost' || e.kind === 'eaten') cur.limbsLost++;
      if (e.kind === 'tower-stolen') cur.stolen++;
    }
  }
  if (cur) { cur.siegeS = phaseT.siege; cur.setupS = phaseT.setup; cur.handStuckFrac = stuck / Math.max(1, sampled); cur.handAllPaidFrac = allPaid / Math.max(1, sampled); cur.chymeIn = sim.chymeEarned - chymeBefore; cur.chymeBank = sim.chyme; cur.limbs = sim.towers.length; rows.push(cur); }
  return { sim, rows };
}

it('the loop, wave by wave', () => {
  const out: string[] = [];
  const agg = new Map<number, Row[]>();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { sim, rows } = run(seed);
    out.push(`seed ${seed}: ${sim.outcome} cleared ${sim.wavesCleared} core ${Math.round(Math.max(0, sim.coreHp) / sim.coreMaxHp * 100)}% limbs ${sim.towers.length} organs ${sim.organs.length} stats ${JSON.stringify({ cannibalized: sim.stats.cannibalized })}`);
    for (const r of rows) { if (!agg.has(r.wave)) agg.set(r.wave, []); agg.get(r.wave)!.push(r); }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const f = (n: number, d = 0) => n.toFixed(d).padStart(5);
  out.push('\nwave | n | siege s | setup s | earned war/sci/roy | bank@start war/sci | spoiled war/sci | builds eat evo disc | organs ups | chyme in/bank | core dmg hits | lost stolen | limbs | hand none% all%');
  for (const [w, rs] of [...agg.entries()].sort((a, b) => a[0] - b[0])) {
    const m = (k: (r: Row) => number) => avg(rs.map(k));
    out.push(`${String(w).padStart(4)} | ${rs.length} | ${f(m((r) => r.siegeS))} | ${f(m((r) => r.setupS))} | ${f(m((r) => r.earned.war))} ${f(m((r) => r.earned.science))} ${f(m((r) => r.earned.royal))} | ${f(m((r) => r.bankAtStart.war))} ${f(m((r) => r.bankAtStart.science))} | ${f(m((r) => r.spoiled.war))} ${f(m((r) => r.spoiled.science))} | ${f(m((r) => r.builds), 1)} ${f(m((r) => r.butchers), 1)} ${f(m((r) => r.evolves), 1)} ${f(m((r) => r.discards), 1)} | ${f(m((r) => r.organs), 1)} ${f(m((r) => r.organUps), 1)} | ${f(m((r) => r.chymeIn))} ${f(m((r) => r.chymeBank))} | ${f(m((r) => r.coreDmg))} ${f(m((r) => r.coreHits))} | ${f(m((r) => r.limbsLost), 1)} ${f(m((r) => r.stolen), 1)} | ${f(m((r) => r.limbs))} | ${f(m((r) => r.handStuckFrac * 100))} ${f(m((r) => r.handAllPaidFrac * 100))}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${out.join('\n')}`);
}, 600000);
