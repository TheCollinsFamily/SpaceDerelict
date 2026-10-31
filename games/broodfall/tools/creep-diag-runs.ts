/** The slow balance checks at a given creepBase: `npx vite-node tools/creep-diag-runs.ts <base> fullrun|mules`.
 *  fullrun: the naive autoplayer's hold-12 wins over seeds 1-10 (tests/fullrun.test.ts wants >= 3).
 *  mules: which of seeds 1-N (the fourth argument, default 12) the scripted player with mules roots a mule on (tests/mules.test.ts names them). */
import { Autoplayer } from '../src/sim/autoplayer';
import { DT, Sim } from '../src/sim/sim';
import { BALANCE as B } from '../content/data';

const base = Number(process.argv[2] ?? B.creepBase);
const mode = process.argv[3] ?? 'fullrun';
const maxSeed = Number(process.argv[4] ?? 12);
(B as { creepBase: number }).creepBase = base;
const CFG = { gridW: 50, gridH: 40, cellPx: 26 };
console.log(`creepBase ${base}, ${mode}`);
if (mode === 'fullrun') {
  let wins = 0; const won: number[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    const sim = new Sim({ ...CFG, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
    const auto = new Autoplayer(seed + 1);
    let ticks = 0;
    while (sim.outcome === 'playing' && ticks < 24000) { auto.act(sim, DT); sim.tick(); sim.takeEvents(); ticks++; }
    if (sim.outcome === 'won') { wins++; won.push(seed); }
    console.log(`  hold-12 seed ${seed}: ${sim.outcome} at tick ${ticks}`);
  }
  console.log(`[fullrun] naive hold-12 wins ${wins}/10 (seeds ${won.join(' ')})`);
} else {
  const roots: number[] = [];
  for (let seed = 1; seed <= maxSeed; seed++) {
    const s = new Sim({ ...CFG, seed, organStage: true, directive: { kind: 'hold', waves: 12 } });
    const bot = new Autoplayer(seed + 1);
    bot.mules = true;
    for (let i = 0; i < 20000 && s.outcome === 'playing'; i++) { bot.act(s, 0.1); s.tick(); s.takeEvents(); }
    const sac = s.organs.some((o) => o.organ === 'mule');
    const rooted = s.stats.mulesRooted ?? 0;
    if (rooted > 0) roots.push(seed);
    console.log(`  mules seed ${seed}: sac ${sac}, rooted ${rooted}, ${s.outcome}`);
  }
  console.log(`[mules] seeds that root a mule: ${roots.join(' ') || 'none'}`);
}
