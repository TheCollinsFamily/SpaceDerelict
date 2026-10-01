/**
 * How well each footprint FITS the city (notes/FOOTPRINT-PLAN.md; Collins, Oct 1 2026: footprints are
 * "a KEY part of tower defence strategy"). A shape that rarely fits is a bad shape. On the crash sites at
 * the start (all four), and on ten seeds' boards mid-run (the naive player, wave 6 or its end), counts over
 * every roof cell of claimed city (ignoring creep and what is built: the ground itself):
 *   placements  distinct legal placements (any of four turns), every cell one block of one height
 *   cover       the share of roof cells that some placement holds (where pointing can build it)
 *   perRoof     the median number of placements a roof (connected same-height block) offers, and the share
 *               of roofs with none
 *   npx vitest run --config tools/measure/vitest.config.ts tools/measure/shapefit.measure.ts
 * Writes notes/limb-codex/shapefit.json.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim } from '../../src/sim/sim';
import { CellType } from '../../src/sim/citymap';
import { footprintOf, type ShapeId } from '../../src/sim/footprint';
import type { RootDir } from '../../src/sim/types';

const SHAPES: Array<{ id: string; spec: { shape?: ShapeId; span?: [number, number] } }> = [
  { id: '1x1', spec: {} },
  { id: '1x2', spec: { span: [1, 2] } },
  { id: 'line3', spec: { shape: 'line3' } },
  { id: '2x2', spec: { span: [2, 2] } },
  { id: 'T', spec: { shape: 'T' } },
  { id: 'L3', spec: { shape: 'L3' } },
  { id: 'L4', spec: { shape: 'L4' } },
  { id: 'S4', spec: { shape: 'S4' } },
];
const TURNS: RootDir[] = ['S', 'W', 'N', 'E'];

function measure(sim: Sim) {
  const { cells, heights, w, h, coreCell } = { ...sim.map, w: sim.cfg.gridW, h: sim.cfg.gridH };
  const roof = (c: number) => cells[c] === CellType.Block && c !== coreCell;
  const roofCells = cells.map((_, c) => c).filter(roof);
  // Roofs: connected cells of block at one height.
  const roofId = new Int32Array(cells.length).fill(-1);
  let roofs = 0;
  for (const c of roofCells) {
    if (roofId[c] >= 0) continue;
    const stack = [c];
    roofId[c] = roofs;
    while (stack.length) {
      const q = stack.pop()!;
      const x = q % w;
      for (const n of [q - w, q + w, x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1]) {
        if (n < 0 || n >= cells.length || roofId[n] >= 0 || !roof(n) || heights[n] !== heights[q]) continue;
        roofId[n] = roofs;
        stack.push(n);
      }
    }
    roofs++;
  }
  const out: Record<string, { placements: number; cover: number; medianPerRoof: number; roofsWithNone: number }> = {};
  for (const s of SHAPES) {
    const seen = new Set<string>();
    const covered = new Set<number>();
    const perRoof = new Array(roofs).fill(0);
    for (const f of TURNS) {
      const fp = footprintOf(s.spec, f);
      for (let y0 = 0; y0 + fp.h <= h; y0++) {
        for (let x0 = 0; x0 + fp.w <= w; x0++) {
          const cs = fp.cells.map(([x, y]) => (y0 + y) * w + x0 + x);
          if (!cs.every(roof) || !cs.every((c) => heights[c] === heights[cs[0]])) continue;
          const k = [...cs].sort((a, b) => a - b).join(',');
          if (seen.has(k)) continue;
          seen.add(k);
          for (const c of cs) covered.add(c);
          perRoof[roofId[cs[0]]]++;
        }
      }
    }
    const sorted = [...perRoof].sort((a, b) => a - b);
    out[s.id] = {
      placements: seen.size,
      cover: roofCells.length ? covered.size / roofCells.length : 0,
      medianPerRoof: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      roofsWithNone: roofs ? perRoof.filter((n) => n === 0).length / roofs : 0,
    };
  }
  return { roofCells: roofCells.length, roofs, shapes: out };
}

it('shape fit: crash sites and mid-run boards', () => {
  const crash = [0, 1, 2, 3].map((i) => measure(new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 42, crash: i })));
  const mid = [];
  for (let seed = 1; seed <= 10; seed++) {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
    const bot = new Autoplayer(seed + 1);
    let ticks = 0;
    while (sim.outcome === 'playing' && sim.wavesCleared < 6 && ticks < 24000) { bot.act(sim, DT); sim.tick(); ticks++; }
    mid.push(measure(sim));
  }
  const avg = (list: typeof crash) => Object.fromEntries(SHAPES.map((s) => {
    const k = s.id;
    const a = (f: (x: (typeof list)[0]['shapes'][string]) => number) => list.reduce((n, m) => n + f(m.shapes[k]), 0) / list.length;
    return [k, {
      placements: Math.round(a((x) => x.placements)),
      cover: +a((x) => x.cover).toFixed(3),
      medianPerRoof: +a((x) => x.medianPerRoof).toFixed(1),
      roofsWithNone: +a((x) => x.roofsWithNone).toFixed(3),
    }];
  }));
  const result = {
    measured: new Date().toISOString().slice(0, 10),
    crashSites: { boards: crash.length, roofCells: Math.round(crash.reduce((n, m) => n + m.roofCells, 0) / crash.length), roofs: Math.round(crash.reduce((n, m) => n + m.roofs, 0) / crash.length), shapes: avg(crash) },
    midRun: { boards: mid.length, roofCells: Math.round(mid.reduce((n, m) => n + m.roofCells, 0) / mid.length), roofs: Math.round(mid.reduce((n, m) => n + m.roofs, 0) / mid.length), shapes: avg(mid) },
  };
  writeFileSync('notes/limb-codex/shapefit.json', JSON.stringify(result, null, 1));
  for (const where of ['crashSites', 'midRun'] as const) {
    console.log(where, `roof cells ${result[where].roofCells}, roofs ${result[where].roofs}`);
    for (const s of SHAPES) {
      const r = result[where].shapes[s.id];
      console.log(`  ${s.id.padEnd(6)} placements ${String(r.placements).padStart(5)}  cover ${(r.cover * 100).toFixed(0).padStart(3)}%  median a roof ${r.medianPerRoof}  roofs with none ${(r.roofsWithNone * 100).toFixed(0)}%`);
    }
  }
}, 600000);
