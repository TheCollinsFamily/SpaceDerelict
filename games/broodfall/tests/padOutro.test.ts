/**
 * The data pad at a mission's end (src/ui/padOutro.ts): the page is warped into the pad's screen
 * by a homography made from the corners baked beside the clip. These hold the maths and the baked
 * files to each other.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { applyH, cssMatrix3d, growQuad, quadAt, rectToQuad, zoomAt } from '../src/ui/padOutro';

type Quad = [[number, number], [number, number], [number, number], [number, number]];
const close = (a: [number, number], b: [number, number]) => { expect(a[0]).toBeCloseTo(b[0], 6); expect(a[1]).toBeCloseTo(b[1], 6); };

describe('pad outro maths', () => {
  const q: Quad = [[300, 400], [980, 390], [1040, 610], [250, 620]];

  it('the page corners land on the screen corners', () => {
    const m = rectToQuad(1920, 1080, q);
    close(applyH(m, 0, 0), q[0]);
    close(applyH(m, 1920, 0), q[1]);
    close(applyH(m, 1920, 1080), q[2]);
    close(applyH(m, 0, 1080), q[3]);
  });

  it('a rectangle onto itself is no change, and the CSS matrix carries the perspective terms', () => {
    const m = rectToQuad(800, 600, [[0, 0], [800, 0], [800, 600], [0, 600]]);
    [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => expect(m[i]).toBeCloseTo(v, 9));
    const css = cssMatrix3d(rectToQuad(1920, 1080, q));
    expect(css.startsWith('matrix3d(')).toBe(true);
    expect(css.slice(9, -1).split(',')).toHaveLength(16);
  });

  it('the zoom starts with the first screen filling the window and ends on nothing', () => {
    const [kx, ky, tx, ty] = zoomAt(0, q, 1920, 1080);
    // The screen's box goes to the window's edges.
    expect(kx * 262.5 + tx).toBeCloseTo(0, 0);
    expect(ky * 392.5 + ty).toBeCloseTo(0, 0);
    zoomAt(5, q, 1920, 1080).forEach((v, i) => expect(v).toBeCloseTo([1, 1, 0, 0][i], 9));
  });

  it('a frame without corners borrows the nearest one; growing pushes corners outward', () => {
    const qs = [null, [0, 0, 10, 0, 10, 10, 0, 10], null];
    expect(quadAt(qs, 0)).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(quadAt(qs, 2)).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(quadAt([null, null], 1)).toBeNull();
    const g = growQuad([[0, 0], [10, 0], [10, 10], [0, 10]], Math.SQRT2);
    close(g[0], [-1, -1]);
    close(g[2], [11, 11]);
  });
});

describe('pad outro art', () => {
  const dir = path.join(__dirname, '..', 'public', 'art', 'pad');
  const manifest = path.join(dir, 'manifest.json');
  it.skipIf(!fs.existsSync(manifest))('every clip has its video and a screen in (nearly) every frame', () => {
    const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    for (const id of ['won', 'lost']) {
      const c = m.clips[id];
      expect(c, id).toBeTruthy();
      expect(fs.existsSync(path.join(dir, c.video))).toBe(true);
      const j = JSON.parse(fs.readFileSync(path.join(dir, c.quads), 'utf8'));
      expect(j.quads.length).toBe(j.frames);
      // The first frame's screen is found (the cut into the clip is made from it).
      expect(j.quads[0]).toHaveLength(8);
      const found = j.quads.filter(Boolean).length;
      expect(found / j.frames).toBeGreaterThan(0.95);
    }
  });
});
