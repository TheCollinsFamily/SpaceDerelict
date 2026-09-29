/**
 * The genre test: placement must MATTER. A chokepoint-aware player and a
 * random-placement player get the same cards and economy; if their outcomes
 * do not separate, the board is decoration and the game fails as a TD.
 */
import { describe, expect, it } from 'vitest';
import { Autoplayer } from '../src/sim/autoplayer';
import { organTurn, placeNode, placePlinth } from '../src/sim/organPolicy';
import { Rng } from '../src/sim/rng';
import { DT, Sim, towerSpec, organSpec } from '../src/sim/sim';
import type { SimConfig } from '../src/sim/types';

const CFG: Omit<SimConfig, 'seed'> = { gridW: 50, gridH: 40, cellPx: 26 };
const MAX_TICKS = 24000;

/** Same organ/discard/cadence logic as Autoplayer, but towers land on ANY buildable cell. */
class RandomPlacer {
  private rng: Rng;
  private actTimer = 0;
  constructor(seed: number) { this.rng = new Rng(seed); }
  act(sim: Sim, dt: number): void {
    if (sim.outcome !== 'playing') return;
    if (sim.phase === 'draft') {
      sim.issue({ kind: 'choose-plate', index: 0 });
      return;
    }
    this.actTimer -= dt;
    if (this.actTimer > 0) return;
    this.actTimer = 1.5;
    if (sim.meat.royal >= 1) sim.issue({ kind: 'royal-surge' });
    // Same organ-stage economy as the smart bot, but organs placed at random.
    if (organTurn(sim, this.rng)) return;
    if (placeNode(sim, this.rng)) return;
    if (placePlinth(sim, this.rng)) return;
    for (let i = 0; i < sim.hand.length; i++) {
      const family = sim.hand[i].family;
      if (!sim.canAfford(towerSpec(family).cost)) continue;
      // Rules-aware, placement-random: legal cells for THIS card, chosen blind.
      // (The guardrail isolates placement knowledge, not card-rule knowledge.)
      const opts: number[] = [];
      for (let c = 0; c < sim.map.cells.length; c++) if (sim.canBuildTower(c, family)) opts.push(c);
      if (!opts.length) continue;
      sim.issue({ kind: 'build', cardIndex: i, cell: opts[this.rng.int(0, opts.length - 1)] });
      return;
    }
    if (sim.meat.war >= 25) {
      for (let i = 0; i < sim.hand.length; i++) {
        if (!sim.canAfford(towerSpec(sim.hand[i].family).cost)) {
          sim.issue({ kind: 'discard', cardIndex: i });
          return;
        }
      }
    }
  }
}

function run(seed: number, smart: boolean) {
  // Back to hold-12: the enemy expansion (splitters, mortars, carapaces, the
  // risk law) restored its bite — at hold-16 NEITHER policy survives now, and a
  // 0-0 outcome row discriminates nothing. (Metric history: ITERATION-2026-09-26
  // addenda 5-6.)
  const sim = new Sim({ ...CFG, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const player = smart ? new Autoplayer(seed + 1) : new RandomPlacer(seed + 1);
  let ticks = 0;
  let towersLost = 0;
  while (sim.outcome === 'playing' && ticks < MAX_TICKS) {
    player.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents()) if (e.kind === 'structure-lost') towersLost++;
    ticks++;
  }
  // Score: waves cleared dominate; surviving core HP breaks ties.
  const score = sim.wavesCleared * 1000 + Math.max(0, sim.coreHp);
  return { outcome: sim.outcome, cleared: sim.wavesCleared, coreHp: sim.coreHp, towersLost, score };
}

describe('placement matters (genre test)', () => {
  it('chokepoint placement beats random placement across seeds', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    let smartTotal = 0;
    let randomTotal = 0;
    let smartOutcomeWins = 0;
    let smartFlips = 0;
    let randomFlips = 0;
    for (const s of seeds) {
      const a = run(s, true);
      const b = run(s, false);
      smartTotal += a.score;
      randomTotal += b.score;
      if (a.outcome === 'won') smartOutcomeWins++;
      if (a.outcome === 'won' && b.outcome !== 'won') smartFlips++;
      else if (b.outcome === 'won' && a.outcome !== 'won') randomFlips++;
      // eslint-disable-next-line no-console
      console.log(`seed ${s}: smart=${a.outcome}(cleared ${a.cleared}, hp ${a.coreHp.toFixed(0)}, lost ${a.towersLost}) ` +
        `random=${b.outcome}(cleared ${b.cleared}, hp ${b.coreHp.toFixed(0)}, lost ${b.towersLost})`);
    }
    // eslint-disable-next-line no-console
    console.log(`totals: smart=${smartTotal} random=${randomTotal}, outcome flips smart=${smartFlips} random=${randomFlips}, smart wins ${smartOutcomeWins}/${seeds.length}`);
    // The metric that matters: on seeds where placement CHANGED THE RESULT,
    // informed placement must win more of them — and never score meaningfully
    // below scatter overall.
    expect(smartFlips).toBeGreaterThanOrEqual(Math.max(1, randomFlips + 1));
    expect(smartTotal).toBeGreaterThan(randomTotal * 0.93);
  });
});
