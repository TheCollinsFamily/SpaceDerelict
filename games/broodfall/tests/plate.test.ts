/**
 * THE GROUND PLATE (tools/art/lib/plate.mjs) draws a shaped limb's cells the way the sim lays them
 * (src/sim/footprint.ts), every way it can face; and the views a limb is drawn in follow which shapes a mirror
 * would put on the wrong cells (Oct 2 2026, the class-zero footprints).
 */
import { describe, expect, it } from 'vitest';
import { SHAPES, footprintOf } from '../src/sim/footprint';
import { towerSpec } from '../src/sim/sim';
import type { RootDir } from '../src/sim/types';
import { limbSideOf } from '../src/render/isoRender';
import type { LimbArt } from '../src/render/art';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { SHAPES as PLATES, cellsOf } from '../tools/art/lib/plate.mjs';

const sorted = (c: Array<[number, number]>) => [...c].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const spec = (shape: keyof typeof SHAPES) => ({ ...towerSpec('spitter'), shape, span: undefined });

describe('the ground plate', () => {
  it('has the sim\'s shapes', () => {
    for (const id of Object.keys(SHAPES) as Array<keyof typeof SHAPES>) expect(PLATES[id], id).toEqual(SHAPES[id].cells);
  });

  it('lays a shape on the cells the sim lays it on, every way it faces', () => {
    for (const id of Object.keys(SHAPES) as Array<keyof typeof SHAPES>) {
      for (const f of ['S', 'W', 'N', 'E'] as RootDir[]) {
        expect(cellsOf(id, f), `${id} ${f}`).toEqual(sorted(footprintOf(spec(id), f).cells));
      }
    }
  });

  it('a mirror of the front is the east view for a line and a T, and NOT for an elbow or an L', () => {
    // Mirroring the picture swaps the board's x and y (the view's left and right).
    const mirrored = (c: Array<[number, number]>) => sorted(c.map(([x, y]) => [y, x]));
    for (const id of ['line3', 'T'] as const) expect(mirrored(cellsOf(id, 'S')), id).toEqual(cellsOf(id, 'E'));
    for (const id of ['L3', 'L4'] as const) expect(mirrored(cellsOf(id, 'S')), id).not.toEqual(cellsOf(id, 'E'));
  });

  it('shows an elbow\'s own side views where another limb is mirrored', () => {
    const view = (n: string) => ({ anchor: [0.5, 0.7], body: 0.5, anims: { idle: { start: 0, count: 1, fps: 1 } }, grafts: [], n });
    const art = { ...view('front'), back: view('back'), side: view('side'), backSide: view('backside') } as unknown as LimbArt;
    const name = (r: { side: unknown }) => (r.side as { n: string }).n;
    expect(name(limbSideOf(art, false, false))).toBe('front');
    expect(limbSideOf(art, false, true)).toMatchObject({ mirror: false });
    expect(name(limbSideOf(art, false, true))).toBe('side');
    expect(name(limbSideOf(art, true, true))).toBe('backside');
    const plain = { ...view('front'), back: view('back') } as unknown as LimbArt;
    expect(limbSideOf(plain, true, true)).toMatchObject({ mirror: true });
    expect(name(limbSideOf(plain, true, true))).toBe('back');
  });
});
