/**
 * THE LIE OF THE LAND (Oct 2 2026, Collins: "the point of terrain height in tower defence is to get lucky that you
 * can fit our cool larger powerful building at a higher height, but if terrain does not move together like it
 * naturally does, those never appear. So it should be rare for terrain to jump up without going up a bit first, or
 * for a high piece of terrain to be in total isolation"). src/sim/citymap.ts terrainLevel / settleTerrain.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import { CellType, createBoard, draftHeights, draftOffers, stampPlate, terrainLevel } from '../src/sim/citymap';
import { pregrow } from '../src/sim/boardSnapshot';
import { Sim } from '../src/sim/sim';
import { terrainStats } from '../tools/measure/terrainStats';

function board(seed: number, districts = 6) {
  const rng = new Rng(seed);
  const map = createBoard(5, 4, 7, rng, 1, seed % 4, Math.imul((seed ^ 0x7e11a5) >>> 0, 0x9e3779b1) >>> 0);
  pregrow(map, rng, districts);
  return map;
}

describe('the land moves together', () => {
  const boards = Array.from({ length: 40 }, (_, i) => board(i + 1));
  const stats = boards.map((m) => terrainStats(m));

  it('no two neighbouring blocks are more than one storey apart, across district seams too', () => {
    for (const s of stats) expect(s.steps[2] + s.steps[3]).toBe(0);
  });

  it('a lone high block is rare: high ground comes as plateaus', () => {
    const lone = stats.reduce((n, s) => n + s.isolated, 0);
    expect(lone).toBeLessThanOrEqual(3); // over forty full boards
  });

  it('every board has some rise; no board is all high ground', () => {
    for (const s of stats) {
      expect(s.byHeight[1] + s.byHeight[2]).toBeGreaterThan(0);
      expect(s.byHeight[0]).toBeGreaterThan(s.blocks * 0.25);
    }
  });

  it('a big limb up high is a lucky find: a few plateaus a board can hold a 2x2 at the top, and some boards none', () => {
    const plateaus = stats.map((s) => s.plateaus2x2[2]).sort((a, b) => a - b);
    const median = plateaus[Math.floor(plateaus.length / 2)];
    expect(median).toBeGreaterThanOrEqual(1);
    expect(median).toBeLessThanOrEqual(6);
    const none = plateaus.filter((n) => n === 0).length;
    expect(none).toBeGreaterThan(0);
    expect(none).toBeLessThan(plateaus.length / 2);
    // And the big shapes find level ground up there at all (before Oct 2 2026 they never did above the ground floor).
    expect(stats.reduce((n, s) => n + s.level.T[2] + s.level.L4[2] + s.level.line3[2], 0)).toBeGreaterThan(0);
  });
});

describe('the land is the board\'s own', () => {
  it('the same seed gives the same land; another seed another', () => {
    const a = board(5);
    const b = board(5);
    const c = board(6);
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(Array.from(a.heights)).not.toEqual(Array.from(c.heights));
  });

  it('a sim run is deterministic in its land, and the land has its own dice (the run\'s rolls are unchanged)', () => {
    const s1 = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 77 });
    const s2 = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 77 });
    expect(Array.from(s1.map.heights)).toEqual(Array.from(s2.map.heights));
    expect(Array.from(s1.map.cells)).toEqual(Array.from(s2.map.cells));
  });

  it('a district is drawn on the land it will really take (draftHeights matches the stamp)', () => {
    const map = board(9, 2);
    const offer = draftOffers(map, new Rng(3), 1)[0];
    expect(offer).toBeTruthy();
    const want = draftHeights(map, offer.pattern, offer.slot, offer.feature);
    stampPlate(map, offer.pattern, offer.slot, offer.feature, new Rng(4));
    const sx = (offer.slot % map.slotsX) * 10;
    const sy = Math.floor(offer.slot / map.slotsX) * 10;
    const got: number[] = [];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const c = (sy + y) * map.w + sx + x;
      got.push(map.cells[c] === CellType.Block ? map.heights[c] : 0);
    }
    expect(got).toEqual(want);
  });

  it('the field is smooth: the raw level of neighbouring points differs by at most one', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 49; x++) {
          expect(Math.abs(terrainLevel(seed, x, y) - terrainLevel(seed, x + 1, y))).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
