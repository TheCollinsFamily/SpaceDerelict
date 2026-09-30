/**
 * WHEN A THROWER LETS GO (Sep 30 2026 board fix pass): the Bile Lobber's glob and the Spore Sling's clot
 * leave on the release frame of the firing clip, from where the arm is then (src/render/releases.ts).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RELEASE, WIND_UP, releaseFrame, releaseTime } from '../src/render/releases';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, '..', 'public', 'art', 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

describe('release frames', () => {
  it('every mark is a frame inside its firing clip and a point inside the frame', () => {
    for (const [fam, r] of Object.entries(RELEASE)) {
      const limb = manifest?.limbs?.[fam];
      if (!limb) continue;
      for (const [side, mark] of [['front', r.front], ['back', r.back]] as const) {
        if (!mark) continue;
        const clip = (side === 'back' ? limb.back?.anims?.fire : null) ?? limb.anims.fire;
        expect(clip, `${fam} ${side}: a firing clip`).toBeTruthy();
        expect(mark.frame, `${fam} ${side}`).toBeGreaterThan(0);
        expect(mark.frame, `${fam} ${side}`).toBeLessThan(clip.count);
        for (const v of mark.at) expect(v > -0.1 && v < 1.1, `${fam} ${side}: ${mark.at}`).toBe(true);
      }
    }
  });

  it('the wind-up is quick, then the rest of the clip plays out to its last frame', () => {
    const dur = 3.3, count = 14, frame = 2;
    const r = releaseTime(dur, count, frame);
    expect(r).toBeLessThanOrEqual(WIND_UP);
    expect(releaseFrame(0, dur, count, frame)).toBe(0);
    expect(releaseFrame(r * 0.99, dur, count, frame)).toBe(frame - 1);
    expect(releaseFrame(r, dur, count, frame)).toBe(frame);
    expect(releaseFrame(dur, dur, count, frame)).toBe(count - 1);
    // Frames never run backwards.
    let last = 0;
    for (let t = 0; t <= dur; t += 0.01) { const f = releaseFrame(t, dur, count, frame); expect(f).toBeGreaterThanOrEqual(last); last = f; }
  });
});
