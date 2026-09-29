/**
 * WHICH LIMBS CAN BE BIG: what each choice does to the two measures the game is held to.
 *
 *   MEASURE=c1,c2 npx vitest run --config tools/measure/vitest.config.ts
 *   (one line a candidate is added to art-src/logs/measured.txt as it is measured; there are
 *   many processors: run one candidate a process, side by side)
 *
 * For every candidate (a set of limbs given a footprint and paid for it) it plays the
 * scripted player over ten seeds (tests/fullrun.test.ts: at least 3 of 10 must be won) and
 * the placement guardrail over eight (tests/placement.test.ts: placing well must win more
 * of the seeds where placing changed the result than placing blind). It prints one line a
 * candidate. It changes nothing on disk: the limbs are changed in memory and put back.
 *
 * WHY THIS EXISTS: on Sep 29 2026 the Spore Bombard was made big and paid five different
 * ways; four of them put the scripted player UNDER its guard, and paying it MORE lost more.
 * Ten deterministic runs are reshuffled by any change to any limb. Measure; do not reason.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { organTurn, placeNode, placePlinth } from '../../src/sim/organPolicy';
import { Rng } from '../../src/sim/rng';
import { DT, Sim, towerSpec } from '../../src/sim/sim';
import type { SimConfig, TowerFamily, TowerSpec } from '../../src/sim/types';

const CFG: Omit<SimConfig, 'seed'> = { gridW: 50, gridH: 40, cellPx: 26 };
const MAX_TICKS = 24000;

/** What a limb is paid for its ground when the candidate does not say: by how many cells it takes. */
function paid(spec: TowerSpec, span: [number, number]): Partial<TowerSpec> {
  const cells = span[0] * span[1];
  const k = cells >= 4 ? { hp: 2.4, hit: 1.5, reach: 1.15, wide: 1.25 } : { hp: 1.6, hit: 1.25, reach: 1.1, wide: 1.1 };
  return {
    span,
    maxHp: Math.round(spec.maxHp * k.hp),
    damage: spec.damage > 0 ? Math.round(spec.damage * k.hit) : spec.damage,
    aoe: spec.aoe > 0 ? Math.round(spec.aoe * k.wide) : spec.aoe,
    range: spec.range > 0 && spec.range < 1000 ? Math.round(spec.range * k.reach) : spec.range,
  };
}

const LONG: [number, number] = [1, 2];
const BIG: [number, number] = [2, 2];
type Candidate = Partial<Record<TowerFamily, [number, number] | Partial<TowerSpec>>>;
const C1: Candidate = { skipper: LONG, lance: LONG, spine: LONG };
const C2: Candidate = { ...C1, impaler: LONG, mister: BIG };
const C3: Candidate = { ...C2, tangler: BIG, frond: BIG };
const CANDIDATES: Record<string, Candidate> = {
  c0: {},
  c1: C1,
  c2: C2,
  c3: C3,
  c4: { ...C3, maw: BIG },
  c5: { ...C3, lasher: BIG },
  c6: { ...C3, burster: BIG },
  c7: { ...C2, tangler: BIG },
  c8: { ...C2, frond: BIG },
  c9: { skipper: LONG, lance: LONG, impaler: LONG, mister: BIG, tangler: BIG, frond: BIG },
};

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

function play(seed: number, smart: boolean) {
  const sim = new Sim({ ...CFG, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const player = smart ? new Autoplayer(seed + 1) : new RandomPlacer(seed + 1);
  let ticks = 0;
  let big = 0;
  while (sim.outcome === 'playing' && ticks < MAX_TICKS) {
    player.act(sim, DT);
    sim.tick();
    for (const e of sim.takeEvents()) if (e.kind === 'built' && towerSpec((e as { family: TowerFamily }).family).span) big++;
    ticks++;
  }
  return { won: sim.outcome === 'won', score: sim.wavesCleared * 1000 + Math.max(0, sim.coreHp), big };
}

it('measures what each choice of big limbs does', () => {
  const names = (process.env.MEASURE ?? Object.keys(CANDIDATES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const name of names) {
    const cand = CANDIDATES[name];
    if (!cand) { lines.push(`${name}: no such candidate`); continue; }
    const kept = new Map<TowerFamily, TowerSpec>();
    for (const [family, change] of Object.entries(cand) as Array<[TowerFamily, [number, number] | Partial<TowerSpec>]>) {
      const spec = towerSpec(family);
      kept.set(family, { ...spec });
      Object.assign(spec, Array.isArray(change) ? paid(spec, change) : change);
    }
    let naive = 0;
    let bigBuilt = 0;
    for (let seed = 1; seed <= 10; seed++) { const r = play(seed, true); if (r.won) naive++; bigBuilt += r.big; }
    let smartFlips = 0, randomFlips = 0, smartTotal = 0, randomTotal = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const a = play(seed, true);
      const b = play(seed, false);
      smartTotal += a.score; randomTotal += b.score;
      if (a.won && !b.won) smartFlips++; else if (b.won && !a.won) randomFlips++;
    }
    const ok = naive >= 3 && smartFlips >= Math.max(1, randomFlips + 1) && smartTotal > randomTotal * 0.93;
    const line = `${ok ? 'HOLDS ' : 'BREAKS'} ${name.padEnd(4)} naive ${naive}/10 · guardrail ${smartFlips}:${randomFlips} (${Math.round(smartTotal)} to ${Math.round(randomTotal)}) · big limbs built by the scripted player over ten runs: ${bigBuilt} · ${Object.keys(cand).join(', ') || 'as the game is'}`;
    lines.push(line);
    // Written as it is measured: the test runner keeps what is printed until the test ends.
    mkdirSync('art-src/logs', { recursive: true });
    appendFileSync(process.env.MEASURE_OUT ?? 'art-src/logs/measured.txt', `${line}${String.fromCharCode(10)}`);
    // eslint-disable-next-line no-console
    console.log(line);
    for (const [family, spec] of kept) {
      const live = towerSpec(family) as unknown as Record<string, unknown>;
      for (const k of Object.keys(live)) delete live[k];
      Object.assign(live, spec);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\nFOOTPRINTS MEASURED\n${lines.join('\n')}`);
});
