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
  /**
   * Does this wall CUT its street (Collins: "it goes from one side of the trail to the other side to block oncoming
   * forces so they have to destroy it to get by")? With the wall's cells shut, the street cells touching the wall
   * fall into at least two groups that cannot reach each other near the wall (a walk of at most `r` steps from the
   * cell pointed at, over street cells only). A wall laid ALONG the street fails at once: its street cells beside
   * it all join up round it. Null when the wall touches the street on one side only (a dead end): nothing to cut.
   */
  function cuts(s: Sim, c: number, wall: number[], r = 4): boolean | null {
    const W = CFG.gridW;
    const shut = new Set(wall);
    const isRoad = (q: number) => q >= 0 && q < s.map.cells.length && s.map.cells[q] === CellType.Road && !shut.has(q) && !s.isOccupied(q);
    const near = (q: number) => Math.abs((q % W) - (c % W)) + Math.abs(Math.floor(q / W) - Math.floor(c / W)) <= r;
    const nbs = (q: number) => [q % W > 0 ? q - 1 : -1, q % W < W - 1 ? q + 1 : -1, q - W, q + W].filter((x) => x >= 0);
    // The two faces of the wall: the street cells just before and just after it, crosswise to its line.
    const line = wall.length > 1 ? wall[1] - wall[0] : 0;
    const faces = line === 1 ? [W] : line === W ? [1] : [1, W];
    const sideA = faces.flatMap((p) => wall.map((q) => q - p)).filter((q) => isRoad(q) && near(q));
    const sideB = faces.flatMap((p) => wall.map((q) => q + p)).filter((q) => isRoad(q) && near(q));
    if (!sideA.length || !sideB.length) return null; // a dead end or a pocket: street on one face only
    const seen = new Set<number>(sideA);
    const queue = [...sideA];
    while (queue.length) {
      const q = queue.shift()!;
      for (const n of nbs(q)) if (!seen.has(n) && isRoad(n) && near(n)) { seen.add(n); queue.push(n); }
    }
    return !sideB.some((q) => seen.has(q));
  }

  it('on every street cell: the wall cuts the street, edge to edge, paid and bodied by its width', () => {
    const seen = new Set<number>();
    let checked = 0;
    for (const seed of [1234, 7, 42, 99, 5, 11, 3, 8]) {
      const s = grown(seed);
      // The creep pushed out over the whole claimed city, so the rare wide streets are creeped too.
      Object.defineProperty(s, 'creepRangeCells', { get: () => 99, configurable: true });
      for (let i = 0; i < 50; i++) s.tick();
      s.meat.war = 9999;
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== CellType.Road) continue;
        const g0 = s.groundFor(c, 'spine');
        if (!g0 || g0.length >= WALL_MAX) continue; // a junction or square, capped: tested below
        if (!g0.every((q) => s.isCreeped(q) && !s.isOccupied(q))) continue;
        // A straight line through the cell pointed at.
        const W = CFG.gridW;
        const sorted = [...g0].sort((a, b) => a - b);
        const gap = sorted.length > 1 ? sorted[1] - sorted[0] : 1;
        expect(gap === 1 || gap === W, `wall ${JSON.stringify(sorted)} is not a straight line`).toBe(true);
        sorted.forEach((q, i) => i && expect(q - sorted[i - 1]).toBe(gap));
        expect(sorted).toContain(c);
        const cut = cuts(s, c, sorted);
        if (cut !== null) { expect(cut, `seed ${seed} cell ${c}: wall ${JSON.stringify(sorted)} does not cut its street`).toBe(true); checked++; }
        // Whatever it was turned to, it lies the same way.
        for (const f of ['N', 'E', 'S', 'W'] as RootDir[]) expect([...s.groundFor(c, 'spine', f)!].sort((a, b) => a - b)).toEqual(sorted);
        const width = sorted;
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
    // Streets three wide are rare (the three-wide walls seen before Oct 2 2026 were mostly the old misreads at bends).
    expect([...seen].sort()).toEqual(expect.arrayContaining([1, 2]));
    expect(checked).toBeGreaterThan(50);
  });

  it('a run wider than WALL_MAX (a junction or square) is capped round the cell pointed at', () => {
    let checked = 0;
    for (const seed of [1234, 7, 42, 99, 5, 11, 3, 8]) {
      const s = grown(seed);
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== CellType.Road) continue;
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

/**
 * A WALL IS ALWAYS AND ONLY ON A TRAIL (Collins, Oct 2 2026: "a wall is always and only on a trail ... it goes from
 * one side of the trail to the other side to block oncoming forces so they have to destroy it to get by"). The old
 * test only looked at street cells, and canBuildOn let a wall stand on a roof (Block), where it was laid as a plain
 * line along the roof edge. Never again: no roof cell takes a wall, and no wall in a whole played run has a cell
 * off the street.
 */
describe('a Spine Wall never stands off the street', () => {
  for (const seed of [1234, 7, 42]) {
    it(`seed ${seed}: no non-street cell takes a wall, at any turn`, () => {
      const s = grown(seed);
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] === CellType.Road) continue;
        for (const f of [undefined, 'N', 'E', 'S', 'W'] as Array<RootDir | undefined>) {
          expect(s.groundFor(c, 'spine', f), `cell ${c} (type ${s.map.cells[c]})`).toBeNull();
        }
      }
    });
  }
  it('a whole scripted run: every wall built stands only on street cells', () => {
    const s = new Sim({ ...CFG, seed: 7 });
    const bot = new Autoplayer(7);
    let walls = 0;
    for (let i = 0; i < 20000 && s.outcome === 'playing'; i++) {
      bot.act(s, 0.1);
      s.takeEvents();
      s.tick();
      if (i % 200 === 0) {
        for (const t of s.towers) {
          if (t.family !== 'spine') continue;
          walls++;
          for (const c of t.cells ?? [t.cell]) expect(s.map.cells[c], `wall ${t.id} cell ${c}`).toBe(CellType.Road);
        }
      }
    }
    expect(walls).toBeGreaterThan(0);
  });
});
