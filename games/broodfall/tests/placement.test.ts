/**
 * The genre test: placement must MATTER. A chokepoint-aware player and a
 * random-placement player get the same cards and economy; if their outcomes
 * do not separate, the board is decoration and the game fails as a TD.
 */
import { describe, expect, it } from 'vitest';
import { Autoplayer } from '../src/sim/autoplayer';
import { Rng } from '../src/sim/rng';
import { DT, Sim, towerSpec, organSpec } from '../src/sim/sim';
import type { SimConfig } from '../src/sim/types';

const CFG: Omit<SimConfig, 'seed'> = { gridW: 40, gridH: 30, cellPx: 32 };
const MAX_TICKS = 18000;

/** Same organ/discard/cadence logic as Autoplayer, but towers land on ANY buildable cell. */
class RandomPlacer {
  private rng: Rng;
  private actTimer = 0;
  constructor(seed: number) { this.rng = new Rng(seed); }
  act(sim: Sim, dt: number): void {
    if (sim.outcome !== 'playing') return;
    this.actTimer -= dt;
    if (this.actTimer > 0) return;
    this.actTimer = 1.5;
    if (sim.meat.royal >= 50) sim.issue({ kind: 'royal-surge' });
    const tryOrgan = (organ: 'heart' | 'brain' | 'gland', upTo: number): boolean => {
      if (sim.organs.filter((o) => o.organ === organ).length >= upTo) return false;
      if (!sim.canAfford(organSpec(organ).cost)) return false;
      const opts: number[] = [];
      for (let c = 0; c < sim.map.cells.length; c++) if (sim.canBuildOrgan(c)) opts.push(c);
      if (!opts.length) return false;
      return sim.issue({ kind: 'build-organ', organ, cell: opts[this.rng.int(0, opts.length - 1)] }).ok;
    };
    if (tryOrgan('heart', 1)) return;
    if (sim.time > 90 && tryOrgan('gland', 1)) return;
    if (sim.time > 140 && tryOrgan('brain', 1)) return;
    if (sim.time > 180 && tryOrgan('heart', 2)) return;
    const gland = sim.organs.find((o) => o.organ === 'gland');
    if (gland && gland.glandMode === 'calm' && sim.time > 100) {
      sim.issue({ kind: 'cycle-gland', organInstanceId: gland.id });
    }
    for (let i = 0; i < sim.hand.length; i++) {
      if (!sim.canAfford(towerSpec(sim.hand[i].family).cost)) continue;
      const opts: number[] = [];
      for (let c = 0; c < sim.map.cells.length; c++) if (sim.canBuildTower(c)) opts.push(c);
      if (!opts.length) return;
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
  const sim = new Sim({ ...CFG, seed, directive: { kind: 'hold', waves: 12 } });
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
    let smartSeedWins = 0;
    let randomSeedWins = 0;
    for (const s of seeds) {
      const a = run(s, true);
      const b = run(s, false);
      smartTotal += a.score;
      randomTotal += b.score;
      if (a.score > b.score + 100) smartSeedWins++;
      else if (b.score > a.score + 100) randomSeedWins++;
      // eslint-disable-next-line no-console
      console.log(`seed ${s}: smart=${a.outcome}(cleared ${a.cleared}, hp ${a.coreHp.toFixed(0)}, lost ${a.towersLost}) ` +
        `random=${b.outcome}(cleared ${b.cleared}, hp ${b.coreHp.toFixed(0)}, lost ${b.towersLost})`);
    }
    // eslint-disable-next-line no-console
    console.log(`totals: smart=${smartTotal} random=${randomTotal}, seedWins smart=${smartSeedWins} random=${randomSeedWins}`);
    expect(smartSeedWins).toBeGreaterThan(randomSeedWins);
    expect(smartTotal).toBeGreaterThan(randomTotal);
  });
});
