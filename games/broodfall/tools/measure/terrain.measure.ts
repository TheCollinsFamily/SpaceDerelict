/**
 * THE LIE OF THE LAND (Oct 2 2026, Collins: "it should be rare for terrain to jump up without going up a bit
 * first, or for a high piece of terrain to be in total isolation"). Over twenty seeds, the board the scripted
 * player has grown by wave 6: how block heights step between neighbours, how many high cells stand alone, and
 * how many level places each footprint has at each height (the "lucky high perch" for a big limb).
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/terrain.measure.ts
 * TERRAIN_SEEDS=1,2,3 to choose seeds. Prints a table; TERRAIN_OUT=<file> also writes it as JSON.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { SHAPES, terrainStats, type TerrainStats } from './terrainStats';

const SEEDS = (process.env.TERRAIN_SEEDS ?? Array.from({ length: 20 }, (_, i) => i + 1).join(',')).split(',').map(Number);

function grown(seed: number) {
  const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
  const bot = new Autoplayer(seed + 1);
  for (let i = 0; i < 20000 && sim.outcome === 'playing' && sim.waveIndex < 6; i++) { bot.act(sim, DT); sim.tick(); sim.takeEvents(); }
  return sim;
}

it('the lie of the land over twenty seeds', () => {
  const all: TerrainStats[] = [];
  for (const seed of SEEDS) {
    const sim = grown(seed);
    const st = terrainStats(sim.map);
    all.push(st);
    const pct = (n: number) => `${((100 * n) / Math.max(1, st.steps.reduce((a, b) => a + b, 0))).toFixed(0)}%`;
    console.log(`seed ${seed}: blocks ${st.blocks} | steps 0/1/2/3+ ${st.steps.map(pct).join(' ')} | isolated ${st.isolated} | h1-h4 ${st.byHeight.join('/')} | 2x2 top ${st.level['2x2'].join('/')} | T ${st.level.T.join('/')} | L4 ${st.level.L4.join('/')} | line3 ${st.level.line3.join('/')}`);
  }
  const sum = (f: (s: TerrainStats) => number) => all.reduce((a, s) => a + f(s), 0);
  const steps = [0, 1, 2, 3].map((i) => sum((s) => s.steps[i]));
  const tot = steps.reduce((a, b) => a + b, 0);
  const shapes = Object.keys(SHAPES);
  const levelAt = (shape: string, i: number) => sum((s) => s.level[shape][i]) / all.length;
  console.log(`ALL ${all.length} seeds: steps 0/1/2/3+ ${steps.map((n) => `${((100 * n) / tot).toFixed(1)}%`).join(' ')} | isolated per board ${(sum((s) => s.isolated) / all.length).toFixed(1)} | cells h1-h4 per board ${[0, 1, 2, 3].map((i) => (sum((s) => s.byHeight[i]) / all.length).toFixed(0)).join('/')}`);
  for (const shape of shapes) console.log(`  level ${shape.padEnd(5)} per board at h1/h2/h3/h4: ${[0, 1, 2, 3].map((i) => levelAt(shape, i).toFixed(1)).join(' / ')}`);
  if (process.env.TERRAIN_OUT) writeFileSync(process.env.TERRAIN_OUT, JSON.stringify({ seeds: SEEDS, steps, isolated: sum((s) => s.isolated) / all.length, level: Object.fromEntries(shapes.map((sh) => [sh, [0, 1, 2, 3].map((i) => levelAt(sh, i))])) }, null, 1));
}, 1_200_000);
