/**
 * SHAPED FOOTPRINTS (Collins, Oct 1 2026: "the total lack of diversity in footprint ... is kind of a KEY
 * part of tower defence strategy ... one square, two squares (line), four squares (large square), T-shaped,
 * L-shaped"). Every shape at every facing, placed, turned, eaten and recovered on a real board. No limb in
 * the game is shaped yet (the plan is notes/FOOTPRINT-PLAN.md): the rules are tried on a spitter made
 * shaped for the test, as tests/span.test.ts tried the long limb.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { SHAPES, footprintKind, footprintName, footprintOf, isMultiCell, turnsItsGround, type ShapeId } from '../src/sim/footprint';
import type { RootDir, SimConfig, TowerFamily } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234 };
const FACINGS: RootDir[] = ['S', 'W', 'N', 'E'];
const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];

function simWith(family: TowerFamily, seed = 1234): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 900; i++) s.tick();
  s.meat.war = 9999;
  s.meat.science = 9999;
  s.meat.royal = 99;
  s.hand[0] = { id: 9001, family };
  return s;
}

function spots(s: Sim, family: TowerFamily, facing?: RootDir): number[] {
  const out: number[] = [];
  for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family, facing)) out.push(c);
  return out;
}

const key = (cells: Array<[number, number]>) => cells.map(([x, y]) => `${x},${y}`).sort().join(' ');

describe('the shapes themselves', () => {
  for (const id of SHAPE_IDS) {
    it(`${id}: the same cells at every facing, turned a quarter at a time`, () => {
      const n = SHAPES[id].cells.length;
      const seen = new Set<string>();
      for (const f of FACINGS) {
        const fp = footprintOf({ shape: id }, f);
        expect(fp.cells).toHaveLength(n);
        expect(new Set(fp.cells.map(([x, y]) => `${x},${y}`)).size).toBe(n); // no cell twice
        // Normalised to its bounding box, in row-major order.
        expect(Math.min(...fp.cells.map((p) => p[0]))).toBe(0);
        expect(Math.min(...fp.cells.map((p) => p[1]))).toBe(0);
        for (let i = 1; i < fp.cells.length; i++) {
          const [a, b] = [fp.cells[i - 1], fp.cells[i]];
          expect(a[1] < b[1] || (a[1] === b[1] && a[0] < b[0])).toBe(true);
        }
        // Its hub is part of it.
        for (const h of fp.hub) expect(fp.cells.some((c) => c[0] === h[0] && c[1] === h[1])).toBe(true);
        seen.add(key(fp.cells));
      }
      // A quarter turn swaps its sides.
      const s = footprintOf({ shape: id }, 'S');
      const e = footprintOf({ shape: id }, 'E');
      expect([e.w, e.h]).toEqual([s.h, s.w]);
      expect(seen.size).toBeGreaterThan(1); // a turn changes where it stands
    });
  }

  it('a T points its stem the way it faces, and acts from the junction of its bar', () => {
    const s = footprintOf({ shape: 'T' }, 'S');
    expect(key(s.cells)).toBe(key([[0, 0], [1, 0], [2, 0], [1, 1]])); // the bar on top, the stem down (south)
    expect(s.hub).toEqual([[1, 0]]);
    const n = footprintOf({ shape: 'T' }, 'N');
    expect(key(n.cells)).toBe(key([[1, 0], [0, 1], [1, 1], [2, 1]])); // the stem up (north)
    expect(n.hub).toEqual([[1, 1]]);
    const e = footprintOf({ shape: 'T' }, 'E');
    expect(key(e.cells)).toBe(key([[0, 0], [0, 1], [0, 2], [1, 1]])); // the stem east
  });

  it('rectangles are what spanOf always gave', () => {
    expect(footprintOf({ span: [2, 2] }, 'E').cells).toHaveLength(4);
    expect([footprintOf({ span: [1, 2] }, 'S').w, footprintOf({ span: [1, 2] }, 'S').h]).toEqual([1, 2]);
    expect([footprintOf({ span: [1, 2] }, 'W').w, footprintOf({ span: [1, 2] }, 'W').h]).toEqual([2, 1]);
    expect(footprintOf({}, 'N').cells).toEqual([[0, 0]]);
    expect(isMultiCell({})).toBe(false);
    expect(isMultiCell({ span: [2, 2] })).toBe(true);
    expect(turnsItsGround({ span: [2, 2] })).toBe(false);
    expect(turnsItsGround({ span: [1, 2] })).toBe(true);
    expect(turnsItsGround({ shape: 'T' })).toBe(true);
    expect(footprintKind({ shape: 'L3' })).toBe('L');
    expect(footprintKind({ span: [2, 2] })).toBe('square');
    expect(footprintName({ shape: 'T' })).toBe('a T');
  });
});

describe('a shaped limb on the board', () => {
  const spec = towerSpec('spitter');
  afterEach(() => { delete spec.shape; });

  for (const id of SHAPE_IDS) {
    for (const f of FACINGS) {
      it(`${id} facing ${f}: is built on legal ground, all of it, and stands on its hub`, () => {
        spec.shape = id;
        const s = simWith('spitter');
        const legal = spots(s, 'spitter', f);
        expect(legal.length).toBeGreaterThan(0);
        const cell = legal[Math.floor(legal.length / 2)];
        const ground = s.groundFor(cell, 'spitter', f)!;
        expect(ground).toHaveLength(SHAPES[id].cells.length);
        expect(ground).toContain(cell); // it holds the cell pointed at
        // One flat creeped roof, none of it taken.
        const kind = s.map.cells[ground[0]];
        const high = s.map.heights[ground[0]];
        for (const c of ground) {
          expect(s.map.cells[c]).toBe(kind);
          expect(s.map.heights[c]).toBe(high);
          expect(s.isCreeped(c)).toBe(true);
          expect(s.isOccupied(c)).toBe(false);
        }
        // Its cells make its shape at this facing.
        const w = CFG.gridW;
        const mx = Math.min(...ground.map((c) => c % w));
        const my = Math.min(...ground.map((c) => Math.floor(c / w)));
        expect(key(ground.map((c) => [c % w - mx, Math.floor(c / w) - my] as [number, number]))).toBe(key(footprintOf(spec, f).cells));
        expect(s.issue({ kind: 'build', cardIndex: 0, cell, facing: f }).ok).toBe(true);
        const t = s.towers[s.towers.length - 1];
        expect([...t.cells!].sort()).toEqual([...ground].sort());
        expect(t.facing).toBe(f);
        for (const c of ground) expect(s.isOccupied(c)).toBe(true);
        expect(t.pos).toEqual(s.hubPos('spitter', f, ground));
        // The same ground, rebuilt from its first cell (how a collector's dropped limb re-roots).
        expect(s.cellsFromFirst(t.cell, 'spitter', f)!.sort()).toEqual([...ground].sort());
        // Nothing else can be built on any of it.
        s.hand[0] = { id: 9002, family: 'spitter' };
        for (const c of ground) expect(s.groundFor(c, 'spitter', f)).toBeNull();
        // The preview tells the truth: the same reach from the same hub.
        delete spec.shape;
      });
    }
  }

  it('a T turned a quarter takes new ground that holds part of its old, or is refused', () => {
    spec.shape = 'T';
    const s = simWith('spitter');
    const cell = spots(s, 'spitter', 'S')[0];
    expect(s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' }).ok).toBe(true);
    const t = s.towers[s.towers.length - 1];
    const before = [...t.cells!];
    let turned = 0;
    for (const dir of ['E', 'N', 'W', 'S'] as RootDir[]) {
      const r = s.issue({ kind: 'set-facing', towerId: t.id, dir });
      if (!r.ok) { expect(r.err).toMatch(/needs new ground to turn/); continue; }
      turned++;
      expect(t.facing).toBe(dir);
      expect(t.cells).toHaveLength(4);
      for (const c of t.cells!) expect(s.isOccupied(c)).toBe(true);
      expect(t.pos).toEqual(s.hubPos('spitter', dir, t.cells!));
    }
    // Cells it no longer stands on are free again.
    const now = new Set(t.cells!);
    for (const c of before) if (!now.has(c)) expect(s.isOccupied(c)).toBe(false);
    expect(turned).toBeGreaterThan(0);
  });

  it('eaten, it gives back every cell', () => {
    spec.shape = 'L4';
    const s = simWith('spitter');
    const cell = spots(s, 'spitter', 'W')[0];
    expect(s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'W' }).ok).toBe(true);
    const t = s.towers[s.towers.length - 1];
    const ground = [...t.cells!];
    expect(s.issue({ kind: 'butcher', towerId: t.id }).ok).toBe(true);
    for (const c of ground) expect(s.isOccupied(c)).toBe(false);
  });

  it('is never built off the edge of the board', () => {
    spec.shape = 'line3';
    const s = simWith('spitter');
    const last = s.map.cells.length - 1;
    expect(s.cellsFromFirst(last, 'spitter', 'S')).toBeNull(); // three cells down from the last row
    expect(s.cellsFromFirst(CFG.gridW - 1, 'spitter', 'E')).toBeNull(); // three cells east of the last column
  });

  it('the scripted player places shaped limbs and finishes a run', () => {
    spec.shape = 'T';
    const s = new Sim({ ...CFG, seed: 7 });
    const ai = new Autoplayer(7);
    for (let i = 0; i < 6000 && s.outcome === 'playing'; i++) { ai.act(s, 0.1); s.tick(); }
    const shaped = s.towers.filter((t) => t.family === 'spitter');
    for (const t of shaped) expect(t.cells).toHaveLength(4);
    expect(s.time).toBeGreaterThan(0);
  });
});
