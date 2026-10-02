/**
 * PLINTHS (Collins, Sep 29 2026): "platforms that raise the height of one thing by one
 * amount: let's have an organ that generates 1 every two waves for free."
 */
import { describe, expect, it } from 'vitest';
import { Sim, organSpec, towerSpec } from '../src/sim/sim';
import { CellType } from '../src/sim/citymap';
import { ORGAN_BY_ID, PLINTH_MAX_HEIGHT, PLINTH_TURNS } from '../content/underground';
import { BALANCE as B } from '../content/data';
import type { OrganId, SimConfig, TowerFamily } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234, organStage: true };

function grown(seed = 1234): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 600; i++) s.tick();
  s.meat.war = 9999;
  s.meat.science = 9999;
  return s;
}

function build(s: Sim, family: TowerFamily, where?: (cell: number) => boolean) {
  s.hand[0] = { id: 9001 + s.towers.length, family };
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!s.canBuildTower(c, family) || (where && !where(c))) continue;
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok).toBe(true);
    return s.towers[s.towers.length - 1];
  }
  throw new Error(`no room for a ${family}`);
}

function growOrgan(s: Sim, organ: OrganId) {
  for (let c = 0; c < s.under.cells.length; c++) {
    for (let rot = 0; rot < 4; rot++) {
      if (!s.canBuildOrgan(organ, c, rot)) continue;
      expect(s.issue({ kind: 'build-organ', organ, cell: c, rot }).ok).toBe(true);
      return s.organs[s.organs.length - 1];
    }
  }
  throw new Error(`no room for ${organ}`);
}

describe('the scaffold gland', () => {
  it('is an organ of the game, with a price and a shape', () => {
    const d = ORGAN_BY_ID.scaffold;
    expect(d.name).toBe('Scaffold Gland');
    expect(d.kind).toBe('scaffold');
    expect(d.shape.length).toBeGreaterThan(0);
    expect(organSpec('scaffold').cost.war).toBeGreaterThan(0);
  });

  it('grows one plinth every two turns, for nothing', () => {
    expect(PLINTH_TURNS).toBe(2);
    const s = grown();
    const gland = growOrgan(s, 'scaffold');
    expect(s.plinths).toBe(0);
    expect(s.scaffoldTurnsLeft(gland)).toBe(2);
    const p = s as unknown as { growPlinths(): void };
    const war = s.meat.war;
    p.growPlinths();
    expect(s.plinths).toBe(0);
    expect(s.scaffoldTurnsLeft(gland)).toBe(1);
    expect(s.plinthsNextTurn()).toBe(1);
    p.growPlinths();
    expect(s.plinths).toBe(1);
    p.growPlinths();
    p.growPlinths();
    expect(s.plinths).toBe(2);
    expect(s.meat.war).toBe(war);
    expect(s.takeEvents().filter((e) => e.kind === 'plinth-grown')).toHaveLength(2);
  });

  it('grows none without the gland', () => {
    const s = grown();
    const p = s as unknown as { growPlinths(): void };
    for (let i = 0; i < 6; i++) p.growPlinths();
    expect(s.plinths).toBe(0);
  });

  it('two glands grow two', () => {
    const s = grown();
    growOrgan(s, 'scaffold');
    growOrgan(s, 'scaffold');
    const p = s as unknown as { growPlinths(): void };
    p.growPlinths();
    p.growPlinths();
    expect(s.plinths).toBe(2);
  });
});

describe('a plinth under a limb', () => {
  it('raises the limb one level, and the limb reaches further for it', () => {
    const s = grown();
    const t = build(s, 'spitter', (c) => (s.map.heights[c] || 1) === 1);
    const before = s.statsOf(t).range;
    s.plinths = 1;
    expect(s.canPlacePlinth(t.cell)).toBe(true);
    expect(s.issue({ kind: 'place-plinth', cell: t.cell }).ok).toBe(true);
    expect(s.map.heights[t.cell]).toBe(2);
    expect(s.map.plinths[t.cell]).toBe(1);
    expect(s.plinths).toBe(0);
    expect(s.plinthsPlaced).toBe(1);
    // +10% reach for each level above the first.
    expect(s.statsOf(t).range).toBeCloseTo(before * (1 + B.heightRangeBonus), 6);
    // The limb is where it was, and whole.
    expect(s.towers).toContain(t);
    expect(s.isOccupied(t.cell)).toBe(true);
  });

  it('raises a BIG limb whole: one plinth, all of its ground', () => {
    const s = grown();
    const t = build(s, 'mister', (c) => (s.map.heights[c] || 1) <= 2);
    const ground = s.cellsOf(t);
    expect(ground).toHaveLength(4);
    const high = s.map.heights[ground[0]];
    s.plinths = 1;
    // Pointed at any of its cells.
    expect(s.issue({ kind: 'place-plinth', cell: ground[3] }).ok).toBe(true);
    for (const c of ground) {
      expect(s.map.heights[c]).toBe(high + 1);
      expect(s.map.plinths[c]).toBe(1);
    }
    expect(s.plinths).toBe(0);
  });

  it('costs nothing but the plinth, and none is none', () => {
    const s = grown();
    const t = build(s, 'spitter');
    const war = s.meat.war;
    s.plinths = 0;
    const r = s.issue({ kind: 'place-plinth', cell: t.cell });
    expect(r.ok).toBe(false);
    expect(r.err).toMatch(/no plinths/);
    s.plinths = 1;
    expect(s.issue({ kind: 'place-plinth', cell: t.cell }).ok).toBe(true);
    expect(s.meat.war).toBe(war);
  });
});

describe('a plinth on a bare roof', () => {
  it('raises the roof, which is how a roof is levelled to take a big limb', () => {
    const s = grown();
    const w = CFG.gridW;
    // A square of four roofs that the creep holds, three of one height and one a level lower.
    let found: { low: number; square: number[] } | null = null;
    for (let c = 0; c < s.map.cells.length - w - 1 && !found; c++) {
      const square = [c, c + 1, c + w, c + w + 1];
      if ((c % w) === w - 1) continue;
      if (!square.every((q) => s.map.cells[q] === CellType.Block && s.isCreeped(q) && !s.isOccupied(q))) continue;
      const hs = square.map((q) => s.map.heights[q] || 1);
      const top = Math.max(...hs);
      const low = square.filter((q, i) => hs[i] === top - 1);
      if (low.length === 1 && hs.filter((x) => x === top).length === 3) found = { low: low[0], square };
    }
    if (!found) {
      // This board has no such square: make one from a flat one by raising three of its cells.
      for (let c = 0; c < s.map.cells.length - w - 1 && !found; c++) {
        if (s.groundFor(c, 'mister')?.[0] !== c) continue;
        const square = s.groundFor(c, 'mister')!;
        if ((s.map.heights[c] || 1) + 1 > PLINTH_MAX_HEIGHT) continue;
        s.plinths = 3;
        for (const q of square.slice(1)) expect(s.issue({ kind: 'place-plinth', cell: q }).ok).toBe(true);
        found = { low: square[0], square };
      }
    }
    expect(found).not.toBeNull();
    const { low, square } = found!;
    expect(s.groundFor(low, 'mister')?.slice().sort()).not.toEqual(square.slice().sort());
    s.plinths = 1;
    expect(s.issue({ kind: 'place-plinth', cell: low }).ok).toBe(true);
    expect(new Set(square.map((q) => s.map.heights[q])).size).toBe(1);
    // Now the big limb fits on it.
    const fits = square.some((q) => {
      const g = s.groundFor(q, 'mister');
      return g !== null && g.slice().sort().join() === square.slice().sort().join();
    });
    expect(fits).toBe(true);
  });

  it('stands only on a roof the creep holds, and never in a street', () => {
    const s = grown();
    s.plinths = 5;
    const street = s.map.cells.findIndex((t, c) => t === CellType.Road && s.isCreeped(c));
    expect(street).toBeGreaterThanOrEqual(0);
    expect(s.canPlacePlinth(street)).toBe(false);
    expect(s.issue({ kind: 'place-plinth', cell: street }).err).toMatch(/roof/);
    const bare = s.map.cells.findIndex((t, c) => t === CellType.Block && !s.isCreeped(c));
    if (bare >= 0) {
      expect(s.canPlacePlinth(bare)).toBe(false);
      expect(s.issue({ kind: 'place-plinth', cell: bare }).err).toMatch(/creep/);
    }
    expect(s.canPlacePlinth(-1)).toBe(false);
    expect(s.plinths).toBe(5);
  });

  it('raises nothing higher than one level above the tallest block', () => {
    expect(PLINTH_MAX_HEIGHT).toBe(4);
    const s = grown();
    const roof = s.map.cells.findIndex((t, c) => t === CellType.Block && s.isCreeped(c) && !s.isOccupied(c));
    s.plinths = 9;
    let placed = 0;
    while (s.issue({ kind: 'place-plinth', cell: roof }).ok) placed++;
    expect(s.map.heights[roof]).toBe(PLINTH_MAX_HEIGHT);
    expect(s.issue({ kind: 'place-plinth', cell: roof }).err).toMatch(/no higher/);
    expect(s.plinths).toBe(9 - placed);
  });
});

describe('a limb longer than it is wide, given no facing', () => {
  it('lies the first way that fits', () => {
    const spec = towerSpec('spitter');
    spec.span = [1, 2];
    try {
      const s = grown();
      s.hand[0] = { id: 9500, family: 'spitter' };
      const w = CFG.gridW;
      // A roof where it fits lying west to east and not north to south.
      let at = -1;
      for (let c = 0; c < s.map.cells.length && at < 0; c++) {
        if (s.groundFor(c, 'spitter', 'E') && !s.groundFor(c, 'spitter', 'S') && !s.groundFor(c, 'spitter', 'N')) at = c;
      }
      if (at < 0) return; // every roof of this board is wide both ways
      const place = s.placementFor(at, 'spitter');
      expect(place).not.toBeNull();
      expect(place!.cells).toHaveLength(2);
      expect(Math.abs(place!.cells[1] - place!.cells[0])).toBe(1);
      expect(['E', 'W']).toContain(place!.facing);
      expect(s.issue({ kind: 'build', cardIndex: 0, cell: at }).ok).toBe(true);
      const t = s.towers[s.towers.length - 1];
      expect(t.cells).toEqual(place!.cells);
      expect(Math.abs(t.cells![1] - t.cells![0])).not.toBe(w);
    } finally {
      delete spec.span;
    }
  });
});
