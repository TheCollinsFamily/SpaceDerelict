// Top-down height maps of pregrown boards (Oct 2 2026): `npx vite-node tools/measure/heightmap.ts -- <out.ppm> [seeds]`.
// Each board: street grey, plaza sand, blocks by storey (1 deep green, 2 amber, 3 bright red, 4 white), void black.
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { CellType } from '../../src/sim/citymap';

const args = process.argv.slice(2).filter((a) => a !== '--');
const out = args[0] ?? 'heightmap.ppm';
const seeds = (args[1] ?? '3,7,11,15').split(',').map(Number);
const PX = 8;
const COLORS: Record<string, [number, number, number]> = {
  void: [10, 10, 12], road: [120, 120, 120], plaza: [200, 180, 130],
  h1: [40, 90, 50], h2: [210, 160, 40], h3: [220, 50, 40], h4: [245, 245, 245],
};
const boards = seeds.map((seed) => new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, pregrown: 6 }).map);
const gap = 2 * PX;
const W = boards.length * 50 * PX + (boards.length - 1) * gap;
const H = 40 * PX;
const px = Buffer.alloc(W * H * 3, 0);
boards.forEach((m, bi) => {
  const ox = bi * (50 * PX + gap);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = y * m.w + x;
    const t = m.cells[c];
    const h = m.heights[c] - m.plinths[c];
    const col = t === CellType.Void ? COLORS.void : t === CellType.Road ? COLORS.road : t === CellType.Plaza ? COLORS.plaza : COLORS[`h${Math.max(1, Math.min(4, h))}`];
    for (let yy = 0; yy < PX; yy++) for (let xx = 0; xx < PX; xx++) {
      const edge = xx === 0 || yy === 0;
      const i = ((y * PX + yy) * W + ox + x * PX + xx) * 3;
      px[i] = edge ? col[0] * 0.8 : col[0];
      px[i + 1] = edge ? col[1] * 0.8 : col[1];
      px[i + 2] = edge ? col[2] * 0.8 : col[2];
    }
  }
});
writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), px]));
console.log(out, W, H);
