/**
 * Street creep in its own colour (src/render/streetCreep.ts). The pixels on the board are checked by
 * tools/shot-legibility.mjs (bare street / creeped street / creeped roof, every set, turn and zoom).
 */
import { describe, expect, it } from 'vitest';
import { STREET_RAMP, coatAlpha, eastFace, lightRange, rampColour, recolour, southFace } from '../src/render/streetCreep';
import manifest from '../public/art/manifest.json';

const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
/** Hue in degrees of an RGB colour. */
function hue([r, g, b]: number[]): number {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('street creep', () => {
  it('keeps the skin\'s veins dark and turns its flesh yellow', () => {
    expect(lum(rampColour(0))).toBeLessThan(60);
    expect(lum(rampColour(0.5))).toBeGreaterThan(180);
    for (const l of [0.3, 0.5, 0.8]) {
      const h = hue(rampColour(l));
      expect(h).toBeGreaterThan(50);
      expect(h).toBeLessThan(70);
    }
  });

  it('is a different hue from the red hide on the roofs', () => {
    // The hide is a dark wine red (hue about 0-10).
    expect(Math.min(hue(rampColour(0.5)), 360 - hue(rampColour(0.5)))).toBeGreaterThan(40);
  });

  it('is far more saturated than any tile set\'s bare street or square', () => {
    const sat = ([r, g, b]: number[]) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
    const flesh = sat(rampColour(0.5));
    const biomes = (manifest as { biomes: Record<string, { floorColour?: Record<string, number[]> }> }).biomes;
    for (const [id, b] of Object.entries(biomes)) {
      for (const [k, c] of Object.entries(b.floorColour ?? {})) {
        if (!k.startsWith('street') && !k.startsWith('plaza')) continue;
        expect(flesh - sat(c), `${id} ${k}`).toBeGreaterThan(0.2);
        // Honey and tan grounds sit at hue 30-45, the suburb's olive squares near 67: the creep is clear of both.
        if (sat(c) > 0.3) expect(Math.abs(hue(rampColour(0.5)) - hue(c)), `${id} ${k}`).toBeGreaterThan(8);
      }
    }
  });

  it('recolours by lightness and keeps alpha', () => {
    const px = new Uint8ClampedArray([10, 10, 10, 255, 200, 40, 40, 128, 250, 250, 250, 0]);
    const range = lightRange(px);
    recolour(px, range);
    expect([...px.slice(0, 4)]).toEqual([...rampColour(0), 255]);
    expect(px[7]).toBe(128);
    expect([...px.slice(8, 12)]).toEqual([250, 250, 250, 0]); // a clear pixel is left alone
    expect(STREET_RAMP[0][0]).toBe(0);
    expect(STREET_RAMP[STREET_RAMP.length - 1][0]).toBe(1);
  });

  it('coats the walls from afar only, smoothly', () => {
    expect(coatAlpha(250)).toBe(0);
    expect(coatAlpha(130)).toBe(0);
    expect(coatAlpha(52)).toBeCloseTo(0.9);
    let last = 0;
    for (let px = 130; px >= 52; px -= 2) {
      const a = coatAlpha(px);
      expect(a).toBeGreaterThanOrEqual(last);
      expect(a - last).toBeLessThan(0.05);
      last = a;
    }
  });

  it('hangs the wall faces from the tile\'s two front edges', () => {
    const a = 64, b = 38, d = 30;
    expect(southFace(a, b, d)).toEqual([0, b, a, 2 * b, a, 2 * b + d, 0, b + d]);
    expect(eastFace(a, b, d)).toEqual([a, 2 * b, 2 * a, b, 2 * a, b + d, a, 2 * b + d]);
  });
});
