/**
 * HOW HARD THE FIRST WAVES ARE (Nov 23 2026). Collins: "round one should be losable but still something of a tutorial".
 * Three players on hold-12 at one gate:
 *   naive  — the scripted chokepoint player (src/sim/autoplayer.ts): the run's outcome and the core's loss in waves 1-5;
 *   random — the same economy, limbs and organs put on ANY legal cell (the placement guardrail's random player);
 *   idle   — builds nothing at all (takes the first district if a draft comes).
 * For each: where the run ended, and the core after waves 1 and 2.
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/difficulty.measure.ts
 *   DIFF_SEEDS=10 (default) · DIFF_PLAYERS=naive,random,idle
 */
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { organTurn, placeNode, placePlinth } from '../../src/sim/organPolicy';
import { Rng } from '../../src/sim/rng';
import { DT, Sim, towerSpec } from '../../src/sim/sim';
import { BALANCE as B, WAVE_TABLE } from '../../content/data';

// Trying numbers without editing content: DIFF_SET="coreDps=10,threatPerTier=18" sets BALANCE keys; DIFF_ROW0='{"responder":10}'
// (DIFF_ROW1 ...) replaces a wave-table row.
for (const kv of (process.env.DIFF_SET || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split('=');
  (B as unknown as Record<string, number>)[k] = Number(v);
}
for (let i = 0; i < WAVE_TABLE.length; i++) {
  const row = process.env[`DIFF_ROW${i}`];
  if (row) (WAVE_TABLE as Array<Partial<Record<string, number>>>)[i] = JSON.parse(row);
}

const SEEDS = Number(process.env.DIFF_SEEDS || 10);
const PLAYERS = (process.env.DIFF_PLAYERS || 'naive,random,idle').split(',');

/** The placement guardrail's random player (tests/placement.test.ts RandomPlacer), copied so the measure stands alone. */
class RandomPlacer {
  private rng: Rng;
  private actTimer = 0;
  constructor(seed: number) { this.rng = new Rng(seed); }
  act(sim: Sim, dt: number): void {
    if (sim.outcome !== 'playing') return;
    if (sim.phase === 'draft') { sim.issue({ kind: 'choose-plate', index: 0 }); return; }
    this.actTimer -= dt;
    if (this.actTimer > 0) return;
    this.actTimer = 1.5;
    if (sim.meat.royal >= 1) sim.issue({ kind: 'royal-surge' });
    if (organTurn(sim, this.rng)) return;
    if (placeNode(sim, this.rng)) return;
    if (placePlinth(sim, this.rng)) return;
    for (let i = 0; i < sim.hand.length; i++) {
      const family = sim.hand[i].family;
      if (!sim.canAfford(towerSpec(family).cost)) continue;
      const opts: number[] = [];
      for (let c = 0; c < sim.map.cells.length; c++) if (sim.canBuildTower(c, family)) opts.push(c);
      if (!opts.length) continue;
      sim.issue({ kind: 'build', cardIndex: i, cell: opts[this.rng.int(0, opts.length - 1)] });
      return;
    }
    if (sim.meat.war >= 25) {
      for (let i = 0; i < sim.hand.length; i++) {
        if (!sim.canAfford(towerSpec(sim.hand[i].family).cost)) { sim.issue({ kind: 'discard', cardIndex: i }); return; }
      }
    }
  }
}

class Idle {
  act(sim: Sim): void { if (sim.phase === 'draft') sim.issue({ kind: 'choose-plate', index: 0 }); }
}

function run(seed: number, who: string) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const p = who === 'naive' ? new Autoplayer(seed + 1) : who === 'random' ? new RandomPlacer(seed + 1) : new Idle();
  const dmg: number[] = [];
  const coreAfter: number[] = [];
  const tiers: number[] = [];
  let last = sim.coreHp;
  let t = 0;
  while (sim.outcome === 'playing' && t < 40000) {
    p.act(sim, DT);
    sim.tick();
    t++;
    const w = sim.waveNumber;
    if (w >= 1 && sim.coreHp < last) dmg[w - 1] = (dmg[w - 1] ?? 0) + (last - sim.coreHp);
    last = sim.coreHp;
    for (const e of sim.takeEvents()) {
      if (e.kind === 'wave-cleared') coreAfter[e.wave - 1] = Math.max(0, sim.coreHp) / sim.coreMaxHp;
      if (e.kind === 'wave-start') tiers[e.wave - 1] = e.tier;
    }
  }
  return { tiers, outcome: sim.outcome, wave: sim.waveNumber, cleared: sim.wavesCleared, dmg, coreAfter, core: Math.max(0, sim.coreHp) / sim.coreMaxHp };
}

it('difficulty of the first waves', () => {
  const out: string[] = [];
  const pct = (x: number | undefined) => (x === undefined ? '  -' : String(Math.round(x * 100)).padStart(3));
  for (const who of PLAYERS) {
    let wins = 0; let lostBy2 = 0;
    const dmgSum = [0, 0, 0, 0, 0];
    const rows: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = run(seed, who);
      if (r.outcome === 'won') wins++;
      if (r.outcome === 'lost' && r.wave <= 2) lostBy2++;
      for (let i = 0; i < 5; i++) dmgSum[i] += r.dmg[i] ?? 0;
      rows.push(`  seed ${String(seed).padStart(2)}: ${r.outcome} in wave ${r.wave} · core after w1 ${pct(r.coreAfter[0])}% w2 ${pct(r.coreAfter[1])}% · dmg w1-5 ${[0, 1, 2, 3, 4].map((i) => Math.round(r.dmg[i] ?? 0)).join('/')} · tiers ${r.tiers.join('')}`);
    }
    out.push(`${who.padEnd(6)} wins ${wins}/${SEEDS} · lost in wave 1-2: ${lostBy2}/${SEEDS} · mean core dmg waves 1-5: ${dmgSum.map((d) => Math.round(d / SEEDS)).join(' / ')}`);
    out.push(...rows);
  }
  // eslint-disable-next-line no-console
  console.log('\n' + out.join('\n'));
}, 3_600_000);
