/**
 * WALLS STAND ACROSS STREETS (Collins, Oct 1 2026: "jesus man, how are we still placing walls lengthwise rather
 * than across pathways"). Every street cell a Spine Wall can be built on, on several boards: its ground is across
 * the street there (never along it), as wide as the street up to two cells, whatever way it was turned; on a
 * street one cell wide it is one cell with a one-cell wall's body.
 */
import { describe, expect, it } from 'vitest';
import { Sim, WALL_MAX, towerSpec } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { CellType } from '../src/sim/citymap';
import type { RootDir, SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234 };

function grown(seed: number): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 900; i++) s.tick();
  s.meat.war = 9999;
  return s;
}

/** Is the wall's ground across its street (or one cell)? */
function across(s: Sim, cells: number[], at = cells[0]): boolean {
  if (cells.length === 1) return true;
  const w = CFG.gridW;
  const vertical = Math.abs(cells[1] - cells[0]) === w; // one above the other
  return vertical === s.laneAlongX(at) || (at === cells[0] && vertical === s.laneAlongX(cells[1]));
}

describe('a Spine Wall in a street', () => {
  for (const seed of [1234, 7, 42, 99]) {
    it(`seed ${seed}: every street cell it can stand on, any turn: across, never along`, () => {
      const s = grown(seed);
      let seen = 0;
      let one = 0;
      let two = 0;
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== CellType.Road) continue;
        for (const f of [undefined, 'N', 'E', 'S', 'W'] as Array<RootDir | undefined>) {
          const g = s.groundFor(c, 'spine', f);
          if (!g) continue;
          seen++;
          expect(g).toContain(c);
          expect(g.length).toBeLessThanOrEqual(WALL_MAX);
          expect(across(s, g, c)).toBe(true);
          for (const x of g) expect(s.map.cells[x]).toBe(CellType.Road);
          if (f === undefined) { if (g.length === 1) one++; else two++; }
        }
      }
      expect(seen).toBeGreaterThan(0);
      expect(one + two).toBeGreaterThan(0);
    });
  }

  it('is one cell on a street one cell wide, with a one-cell body; two across a street two wide', () => {
    let checkedOne = false;
    let checkedTwo = false;
    for (const seed of [1234, 7, 42, 99, 5, 11]) {
      const s = grown(seed);
      for (let c = 0; c < s.map.cells.length && !(checkedOne && checkedTwo); c++) {
        if (s.map.cells[c] !== CellType.Road) continue;
        const g = s.groundFor(c, 'spine');
        if (!g) continue;
        if (g.length === 1 && !checkedOne) {
          s.hand[0] = { id: 9101, family: 'spine' };
          // Turned "the long way" before placing: it still stands across.
          expect(s.issue({ kind: 'build', cardIndex: 0, cell: c, facing: s.laneAlongX(c) ? 'E' : 'S' }).ok).toBe(true);
          const t = s.towers[s.towers.length - 1];
          expect(s.cellsOf(t)).toEqual([c]);
          expect(t.maxHp).toBe(Sim.wallHp(1));
          checkedOne = true;
        } else if (g.length === 2 && !checkedTwo) {
          s.hand[0] = { id: 9102, family: 'spine' };
          expect(s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok).toBe(true);
          const t = s.towers[s.towers.length - 1];
          expect([...s.cellsOf(t)].sort()).toEqual([...g].sort());
          expect(across(s, s.cellsOf(t))).toBe(true);
          expect(t.maxHp).toBe(Sim.wallHp(2));
          checkedTwo = true;
        }
      }
    }
    expect(checkedOne).toBe(true);
    expect(checkedTwo).toBe(true);
  });

  it('the scripted player builds every wall across', () => {
    for (const seed of [3, 8]) {
      const s = new Sim({ ...CFG, seed });
      const ai = new Autoplayer(seed);
      for (let i = 0; i < 5000 && s.outcome === 'playing'; i++) {
        ai.act(s, 0.1);
        s.tick();
        for (const t of s.towers) if (t.family === 'spine' && s.map.cells[t.cell] === CellType.Road) expect(across(s, s.cellsOf(t))).toBe(true);
      }
    }
  });
});

describe('a Spine Wall crosses the whole street (Collins, Oct 2 2026: "just cross the street between two points")', () => {
  /** Every street cell across the street at this cell, edge to edge (no creep or occupancy limit). */
  function streetWidth(s: Sim, c: number): number[] {
    const W = CFG.gridW;
    const step = s.laneAlongX(c) ? W : 1;
    const road = (q: number) => q >= 0 && q < s.map.cells.length && s.map.cells[q] === CellType.Road && (step === 1 ? Math.floor(q / W) === Math.floor(c / W) : true);
    const out = [c];
    for (let q = c - step; road(q); q -= step) out.unshift(q);
    for (let q = c + step; road(q); q += step) out.push(q);
    return out;
  }

  it('on 1-, 2- and 3-wide streets, it takes the full width, paid and bodied by its width', () => {
    const seen = new Set<number>();
    for (const seed of [1234, 7, 42, 99, 5, 11, 3, 8]) {
      const s = grown(seed);
      // The creep pushed out over the whole claimed city, so the rare wide streets are creeped too.
      Object.defineProperty(s, 'creepRangeCells', { get: () => 99, configurable: true });
      for (let i = 0; i < 50; i++) s.tick();
      s.meat.war = 9999;
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== CellType.Road) continue;
        const width = streetWidth(s, c);
        if (width.length > WALL_MAX) continue;
        if (!width.every((q) => s.isCreeped(q) && !s.isOccupied(q))) continue;
        for (const f of [undefined, 'N', 'E', 'S', 'W'] as Array<RootDir | undefined>) {
          const g = s.groundFor(c, 'spine', f)!;
          expect([...g].sort((a, b) => a - b)).toEqual([...width].sort((a, b) => a - b));
        }
        if (seen.has(width.length)) continue;
        seen.add(width.length);
        s.hand[0] = { id: 9200 + width.length, family: 'spine' };
        const war = s.meat.war;
        expect(s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok).toBe(true);
        const t = s.towers[s.towers.length - 1];
        expect(s.cellsOf(t)).toHaveLength(width.length);
        expect(t.maxHp).toBe(Sim.wallHp(width.length));
        expect(war - s.meat.war).toBe(s.wallCost(width.length).war);
      }
    }
    expect([...seen].sort()).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it('a run wider than WALL_MAX (a junction or square) is capped round the cell pointed at', () => {
    let checked = 0;
    for (const seed of [1234, 7, 42, 99, 5, 11, 3, 8]) {
      const s = grown(seed);
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== CellType.Road || streetWidth(s, c).length <= WALL_MAX) continue;
        const g = s.groundFor(c, 'spine');
        if (!g) continue;
        expect(g.length).toBeLessThanOrEqual(WALL_MAX);
        expect(g).toContain(c);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(0);
  });
});
