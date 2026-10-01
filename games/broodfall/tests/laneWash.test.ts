/**
 * Streets told from roofs under the creep (src/render/laneWash.ts): the wash's strength by zoom
 * and its shapes. The pixels themselves are checked by tools/shot-legibility.mjs.
 */
import { describe, expect, it } from 'vitest';
import { WASH_FILL, eastFace, floorPoly, shade, southFace, washAlpha } from '../src/render/laneWash';

const lum = (c: number) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);

describe('lane wash', () => {
  it('is gone up close and full far away, rising smoothly between', () => {
    expect(washAlpha(250)).toBe(0);
    expect(washAlpha(130)).toBe(0);
    expect(washAlpha(52)).toBeCloseTo(0.82);
    expect(washAlpha(20)).toBeCloseTo(0.82);
    let last = 0;
    for (let px = 130; px >= 52; px -= 2) {
      const a = washAlpha(px);
      expect(a).toBeGreaterThanOrEqual(last);
      expect(a - last).toBeLessThan(0.05);
      last = a;
    }
  });

  it('shows at the default framing of a board (a cell 80 px wide or less)', () => {
    expect(washAlpha(82)).toBeGreaterThan(0.4);
  });

  it('is pale: far lighter than the roof hide (about 35 of 255 on the screen)', () => {
    expect(lum(WASH_FILL)).toBeGreaterThan(170);
    expect(lum(shade(WASH_FILL, 0.82))).toBeGreaterThan(140);
  });

  it('lies on the tile as the renderer places it, the walls hanging from its two front edges', () => {
    const a = 64, b = 38, drop = 30;
    expect(floorPoly(a, b)).toEqual([a, 0, 2 * a, b, a, 2 * b, 0, b]);
    // South (lower-left) face: from the left corner to the bottom corner, then straight down.
    expect(southFace(a, b, drop)).toEqual([0, b, a, 2 * b, a, 2 * b + drop, 0, b + drop]);
    // East (lower-right) face: from the bottom corner to the right corner, then straight down.
    expect(eastFace(a, b, drop)).toEqual([a, 2 * b, 2 * a, b, 2 * a, b + drop, a, 2 * b + drop]);
  });
});
