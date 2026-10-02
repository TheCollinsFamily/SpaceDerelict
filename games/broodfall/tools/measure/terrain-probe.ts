// Quick tuning probe for the land (Oct 2 2026): 40 pregrown boards (6 districts), no play. `npx vite-node tools/measure/terrain-probe.ts`
import { Rng } from '../../src/sim/rng';
import { createBoard } from '../../src/sim/citymap';
import { pregrow } from '../../src/sim/boardSnapshot';
import { terrainStats } from './terrainStats';

const rows: string[] = [];
let flat = 0;
let tops = 0;
const top2x2: number[] = [];
const steps = [0, 0, 0, 0];
let iso = 0;
const byH = [0, 0, 0, 0];
const plat: number[] = [];
for (let seed = 1; seed <= 40; seed++) {
  const rng = new Rng(seed);
  const map = createBoard(5, 4, 7, rng, 1, seed % 4, Math.imul((seed ^ 0x7e11a5) >>> 0, 0x9e3779b1) >>> 0);
  pregrow(map, rng, 6);
  const st = terrainStats(map);
  st.steps.forEach((n, i) => { steps[i] += n; });
  st.byHeight.forEach((n, i) => { byH[i] += n; });
  iso += st.isolated;
  if (st.byHeight[1] + st.byHeight[2] === 0) flat++;
  top2x2.push(st.level['2x2'][2]);
  plat.push(st.plateaus2x2[2]);
  if (st.level['2x2'][2] > 0) tops++;
  rows.push(`${seed}:${st.byHeight.slice(0, 3).join('/')}:${st.level['2x2'][2]}`);
}
const tot = steps.reduce((a, b) => a + b, 0);
const sorted = [...top2x2].sort((a, b) => a - b);
console.log(rows.join('  '));
const ps = [...plat].sort((a, b) => a - b);
console.log(`high plateaus holding a 2x2 per board: median ${ps[20]} min ${ps[0]} max ${ps[39]} | zero on ${ps.filter((n) => n === 0).length}/40`);
console.log(`steps ${steps.map((n) => ((100 * n) / tot).toFixed(1)).join('/')}% | isolated ${iso} | cells h1/h2/h3 ${byH.slice(0, 3).map((n) => (n / 40).toFixed(0)).join('/')} | flat boards ${flat}/40 | boards with a 2x2 at h3 ${tops}/40 | 2x2@h3 median ${sorted[20]} p90 ${sorted[36]}`);
