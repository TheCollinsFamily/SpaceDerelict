/**
 * BIG LIMBS: towers that stand on more than one cell (Collins, Sep 29 2026: "how do we
 * handle towers that appear over multiple squares? we should have some of those, they are
 * a core part of the strategy in tower defence").
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { CellType } from '../src/sim/citymap';
import type { SimConfig, TowerFamily } from '../src/sim/types';
import { TOWERS } from '../content/data';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234 };

/** A board whose creep has had time to spread, with meat to spend and this card first in hand. */
function simWith(family: TowerFamily, seed = 1234): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 600; i++) s.tick();
  s.meat.war = 9999;
  s.meat.science = 9999;
  s.meat.royal = 99;
  s.hand[0] = { id: 9001, family };
  return s;
}

/** Every cell at which a limb of this family could be built. */
function spots(s: Sim, family: TowerFamily, facing?: 'N' | 'E' | 'S' | 'W'): number[] {
  const out: number[] = [];
  for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family, facing)) out.push(c);
  return out;
}

describe('which limbs are big', () => {
  it('leaves the limbs that were measured as they were', () => {
    // The bombard was tried big on Sep 29 2026: it cost the scripted player a win in ten
    // whatever it was paid. It stands on one cell.
    expect(towerSpec('bombard').span).toBeUndefined();
    expect(towerSpec('spitter').span).toBeUndefined();
  });

  it('names them, and they are what the design says', () => {
    const big = TOWERS.filter((t) => t.span).map((t) => `${t.family} ${t.span![0]}x${t.span![1]}`).sort();
    // Measured Sep 29 2026 (tools/measure/footprints.measure.ts, candidate c4): the game held.
    expect(big).toEqual(['brood 2x2', 'cage 2x2', 'frond 2x2', 'impaler 1x2', 'lance 1x2', 'maw 2x2', 'mister 2x2', 'skipper 1x2', 'spine 1x2', 'tangler 2x2', 'ward 2x2']);
  });

  it('pays a big limb for the ground it takes', () => {
    // Four cells for one limb: it is worth more than a limb of one cell that costs the same.
    // What each was when it stood on one cell is in the comment over it in content/data.ts.
    expect(towerSpec('brood').broodCount).toBeGreaterThan(3);
    expect(towerSpec('brood').maxHp).toBeGreaterThanOrEqual(2 * 140);
    expect(towerSpec('ward').auraRadius).toBeGreaterThan(95);
    expect(towerSpec('ward').maxHp).toBeGreaterThanOrEqual(2 * 90);
    expect(towerSpec('cage').range).toBeGreaterThan(50);
    expect(towerSpec('cage').maxHp).toBeGreaterThanOrEqual(2 * 200);
  });
});

describe('where a big limb may stand', () => {
  it('takes four cells of ONE flat creeped roof, and holds the cell pointed at', () => {
    const s = simWith('ward');
    const at = spots(s, 'ward');
    expect(at.length).toBeGreaterThan(0);
    for (const cell of at.slice(0, 40)) {
      const ground = s.groundFor(cell, 'ward')!;
      expect(ground).toHaveLength(4);
      expect(ground).toContain(cell);
      const high = s.map.heights[ground[0]];
      for (const c of ground) {
        expect(s.map.cells[c]).toBe(CellType.Block);
        expect(s.map.heights[c]).toBe(high);
        expect(s.isCreeped(c)).toBe(true);
        expect(s.isOccupied(c)).toBe(false);
      }
      // A square of two by two.
      const xs = ground.map((c) => c % CFG.gridW);
      const ys = ground.map((c) => Math.floor(c / CFG.gridW));
      expect(Math.max(...xs) - Math.min(...xs)).toBe(1);
      expect(Math.max(...ys) - Math.min(...ys)).toBe(1);
    }
  });

  it('has fewer places than a limb of one cell has', () => {
    const s = simWith('ward');
    expect(spots(s, 'ward').length).toBeLessThan(spots(s, 'spitter').length);
  });

  it('cannot stand half on a roof and half off it, nor on roofs of two heights', () => {
    const s = simWith('ward');
    const w = CFG.gridW;
    for (let c = 0; c < s.map.cells.length; c++) {
      const ground = s.groundFor(c, 'ward');
      if (!ground) continue;
      expect(new Set(ground.map((g) => s.map.heights[g])).size).toBe(1);
      expect(ground.every((g) => s.map.cells[g] === CellType.Block)).toBe(true);
      expect(ground.every((g) => g >= 0 && g < s.map.cells.length && Math.abs((g % w) - (c % w)) <= 1)).toBe(true);
    }
  });
});

describe('a big limb on the board', () => {
  it('stands on all four cells, in the middle of them, and nothing else can be built there', () => {
    const s = simWith('ward');
    const cell = spots(s, 'ward')[0];
    const ground = s.groundFor(cell, 'ward')!;
    expect(s.issue({ kind: 'build', cardIndex: 0, cell }).ok).toBe(true);
    const t = s.towers[s.towers.length - 1];
    expect(t.family).toBe('ward');
    expect(t.cells).toEqual(ground);
    expect(t.cell).toBe(ground[0]);
    const mid = ground.map((c) => s.cellCenter(c)).reduce((a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }), { x: 0, y: 0 });
    expect(t.pos.x).toBeCloseTo(mid.x, 6);
    expect(t.pos.y).toBeCloseTo(mid.y, 6);
    for (const c of ground) {
      expect(s.isOccupied(c)).toBe(true);
      expect(s.canBuildTower(c)).toBe(false);
    }
    expect(s.cellsOf(t)).toEqual(ground);
  });

  it('gives all four cells back when it is eaten', () => {
    const s = simWith('ward');
    const cell = spots(s, 'ward')[0];
    const ground = s.groundFor(cell, 'ward')!;
    expect(s.issue({ kind: 'build', cardIndex: 0, cell }).ok).toBe(true);
    const t = s.towers[s.towers.length - 1];
    expect(s.issue({ kind: 'butcher', towerId: t.id }).ok).toBe(true);
    for (const c of ground) expect(s.isOccupied(c)).toBe(false);
    expect(s.towers.some((x) => x.id === t.id)).toBe(false);
  });

  it('is refused where it does not fit, and the card and the meat are kept', () => {
    const s = simWith('ward');
    const one = spots(s, 'spitter').find((c) => !s.canBuildTower(c, 'ward'));
    if (one === undefined) return; // every roof on this board is wide enough
    const war = s.meat.war;
    const hand = s.hand.length;
    const r = s.issue({ kind: 'build', cardIndex: 0, cell: one });
    expect(r.ok).toBe(false);
    expect(s.meat.war).toBe(war);
    expect(s.hand.length).toBe(hand);
  });

  it('keeps the broodmother her five', () => {
    const s = simWith('brood');
    const cell = spots(s, 'brood')[0];
    expect(s.issue({ kind: 'build', cardIndex: 0, cell }).ok).toBe(true);
    const t = s.towers[s.towers.length - 1];
    expect(t.cells).toHaveLength(4);
    for (let i = 0; i < 1200; i++) s.tick();
    if (s.towers.some((x) => x.id === t.id)) {
      expect(s.broodlings.filter((b) => b.motherId === t.id).length).toBeGreaterThan(3);
    }
  });
});

describe('a limb longer than it is wide', () => {
  const spec = towerSpec('spitter');
  afterEach(() => { delete spec.span; });

  it('is turned to fit: two cells along the way it faces', () => {
    // No limb in the game is long yet. The rule is tried on one made long for the test.
    spec.span = [1, 2];
    const s = simWith('spitter');
    expect(s.spanOf('spitter', 'N')).toEqual([1, 2]);
    expect(s.spanOf('spitter', 'S')).toEqual([1, 2]);
    expect(s.spanOf('spitter', 'E')).toEqual([2, 1]);
    expect(s.spanOf('spitter', 'W')).toEqual([2, 1]);
    const cell = spots(s, 'spitter', 'E')[0];
    const ground = s.groundFor(cell, 'spitter', 'E')!;
    expect(ground).toHaveLength(2);
    expect(Math.abs(ground[1] - ground[0])).toBe(1); // side by side, west to east
    const upright = s.groundFor(spots(s, 'spitter', 'S')[0], 'spitter', 'S')!;
    expect(Math.abs(upright[1] - upright[0])).toBe(CFG.gridW); // one behind the other, north to south
    expect(s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'E' }).ok).toBe(true);
    const t = s.towers[s.towers.length - 1];
    expect(t.cells).toEqual(ground);
    // It lies the way it was turned, though it is not a limb that aims one way.
    expect(t.facing).toBe('E');
  });
});
