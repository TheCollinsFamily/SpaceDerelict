/**
 * Placing an organ next to another, in all four directions (Collins, Nov 22 2026: "if I try to place an auxiliary heart
 * to the left or right of the tendril root it looks like its placeable but if I try to place it vertically under it
 * signals its not placeable"). The rule (Sim.canBuildOrgan: open ground, touching the meteor or an organ edge to edge)
 * holds the same way on every side; the organ stage's preview and click both go through placementAnchor
 * (src/ui/organPlace.ts), which must find the legal placement that covers the hovered cell, whichever side of the root.
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { placementAnchor } from '../src/ui/organPlace';
import type { SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234, organStage: true };

/** A board of open soil round the meteor, a Tendril Root A under the meteor's middle and a root B under A. */
function board() {
  const s = new Sim(CFG);
  s.meat.war = 9999;
  s.meat.science = 9999;
  const u = s.under;
  for (const c of u.cells) if (c.kind !== 'meteor') { c.kind = 'soil'; delete (c as { deposit?: unknown }).deposit; delete (c as { feature?: unknown }).feature; }
  const meteor = u.cells.map((c, i) => (c.kind === 'meteor' ? i : -1)).filter((i) => i >= 0);
  const bottom = Math.max(...meteor.map((i) => Math.floor(i / u.w)));
  const cols = meteor.filter((i) => Math.floor(i / u.w) === bottom).map((i) => i % u.w).sort((a, b) => a - b);
  const x = cols[Math.floor(cols.length / 2)];
  const at = (cx: number, cy: number) => cy * u.w + cx;
  const A = at(x, bottom + 1);
  const B = at(x, bottom + 2);
  expect(s.issue({ kind: 'build-organ', organ: 'root', cell: A, rot: 0 }).ok).toBe(true);
  expect(s.issue({ kind: 'build-organ', organ: 'root', cell: B, rot: 0 }).ok).toBe(true);
  return { s, u, at, x, y: bottom + 2 };
}

describe('placing an organ beside a tendril root', () => {
  it('a heart (two cells) grows touching the root on its left, its right and under it, flat or upright', () => {
    const { s, at, x, y } = board();
    expect(s.canBuildOrgan('heart', at(x - 2, y), 0)).toBe(true); // left: [x-2, x-1]
    expect(s.canBuildOrgan('heart', at(x + 1, y), 0)).toBe(true); // right: [x+1, x+2]
    expect(s.canBuildOrgan('heart', at(x, y + 1), 0)).toBe(true); // under, flat, running right: [x, x+1]
    expect(s.canBuildOrgan('heart', at(x - 1, y + 1), 0)).toBe(true); // under, flat, running left: [x-1, x]
    expect(s.canBuildOrgan('heart', at(x, y + 1), 1)).toBe(true); // under, upright: [y+1, y+2]
    expect(s.canBuildOrgan('heart', at(x - 1, y), 1)).toBe(true); // left, upright: [y, y+1]
    expect(s.canBuildOrgan('heart', at(x + 1, y), 1)).toBe(true); // right, upright
  });

  it('it does not grow only corner to corner, nor a cell away, nor over the root', () => {
    const { s, at, x, y } = board();
    expect(s.canBuildOrgan('heart', at(x + 1, y + 1), 0)).toBe(false); // diagonal under-right
    expect(s.canBuildOrgan('heart', at(x - 2, y + 1), 0)).toBe(false); // diagonal under-left
    expect(s.canBuildOrgan('heart', at(x, y + 2), 0)).toBe(false); // a row below, not touching
    expect(s.canBuildOrgan('heart', at(x - 1, y), 0)).toBe(false); // over the root
  });

  it('a one-cell organ grows on all four sides of the root (the meteor is above A)', () => {
    const { s, at, x, y } = board();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) expect(s.canBuildOrgan('gland', at(x + dx, y + dy), 0)).toBe(true);
    expect(s.canBuildOrgan('gland', at(x + 1, y + 1), 0)).toBe(false);
  });

  it('the preview finds the legal placement covering the hovered cell on every side, and a click grows exactly that', () => {
    const { s, u, at, x, y } = board();
    // Rock to the right of the cell under the root: the old top-left anchor ran the heart into it (red), though the
    // same heart one cell to the left, still under the pointer, grows.
    u.cells[at(x + 1, y + 1)].kind = 'rock';
    expect(s.canBuildOrgan('heart', at(x, y + 1), 0)).toBe(false);
    for (const [cell, label] of [[at(x, y + 1), 'under'], [at(x - 1, y), 'left'], [at(x + 1, y), 'right'], [at(x + 2, y), 'right, far cell']] as const) {
      const p = placementAnchor(s, 'heart', cell, 0);
      expect(p.ok, label).toBe(true);
      expect(p.cells, label).toContain(cell);
      expect(s.canBuildOrgan('heart', p.anchor, 0), label).toBe(p.ok);
      expect(s.organFootprint('heart', p.anchor, 0), label).toEqual(p.cells);
    }
    const p = placementAnchor(s, 'heart', at(x, y + 1), 0);
    expect(s.issue({ kind: 'build-organ', organ: 'heart', cell: p.anchor, rot: 0 }).ok).toBe(true);
    expect(s.organs[s.organs.length - 1].cells).toEqual(p.cells);
  });

  it('with the pointer on a side of the cell, the placement on that side is shown', () => {
    const { s, at, x, y } = board();
    const left = placementAnchor(s, 'heart', at(x, y + 1), 0, x - 0.3, y + 1);
    const right = placementAnchor(s, 'heart', at(x, y + 1), 0, x + 0.3, y + 1);
    expect(left.cells).toEqual([at(x - 1, y + 1), at(x, y + 1)]);
    expect(right.cells).toEqual([at(x, y + 1), at(x + 1, y + 1)]);
  });

  it('where nothing covering the cell can grow, it says so (and still shows the shape under the pointer)', () => {
    const { s, at, x, y } = board();
    const p = placementAnchor(s, 'heart', at(x + 4, y + 4), 0);
    expect(p.ok).toBe(false);
    expect(p.cells).toContain(at(x + 4, y + 4));
  });
});
