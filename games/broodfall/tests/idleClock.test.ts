import { describe, expect, it } from 'vitest';
import { IDLE_MAX_RATE, breath, idleFrames, idleLength, idleStep, phaseOf } from '../src/render/idleClock';

// The idles' clock (Sep 30 2026, notes/screens/2026-09-30/anim-README.md): real time, capped at speed,
// frozen by a pause; a phase per limb; cross-faded frames; ping-pong eased at its ends.
describe('idle clock', () => {
  it('freezes on pause, follows real time at 1x, and is capped at speed', () => {
    expect(idleStep(0, 1 / 60)).toBe(0);
    expect(idleStep(1 / 60, 1 / 60)).toBeCloseTo(1 / 60);
    expect(idleStep(8 / 60, 1 / 60)).toBeCloseTo(IDLE_MAX_RATE / 60);
    expect(idleStep(0.5 / 60, 1 / 60)).toBeCloseTo(0.5 / 60);
  });

  it('gives every limb its own phase, the same each time', () => {
    const ps = Array.from({ length: 200 }, (_, i) => phaseOf(i + 1));
    expect(phaseOf(7)).toBe(phaseOf(7));
    for (const p of ps) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThan(1); }
    // Spread over the loop: no two tenths hold more than twice their share.
    const bins = new Array(10).fill(0);
    for (const p of ps) bins[Math.floor(p * 10)]++;
    expect(Math.max(...bins)).toBeLessThan(40);
    // Neighbouring ids (a row of one family) do not land in step.
    let near = 0;
    for (let i = 1; i < ps.length; i++) if (Math.abs(ps[i] - ps[i - 1]) < 0.03) near++;
    expect(near).toBeLessThan(20);
  });

  it('loops without a jump: the last frame fades into the first', () => {
    const clip = { start: 10, count: 16, fps: 12 };
    const end = idleFrames(clip, idleLength(clip) - 0.001);
    expect(end.a).toBe(25);
    expect(end.b).toBe(10);
    expect(end.f).toBeGreaterThan(0.9);
    const mid = idleFrames(clip, 0.5 / 12);
    expect(mid).toEqual({ a: 10, b: 11, f: expect.closeTo(0.5, 5) });
  });

  it('plays a ping-pong forward and back, slow at its ends, never past them', () => {
    const clip = { start: 0, count: 46, fps: 12, pingpong: true };
    const T = idleLength(clip);
    let prev = -1, turned = false, last = 0;
    for (let k = 0; k <= 400; k++) {
      const { a, b, f } = idleFrames(clip, (k / 400) * T);
      expect(a).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(45);
      const pos = a + f;
      if (prev >= 0 && pos < prev - 1e-9) turned = true;
      // Never a jump: at most a frame and a half between samples 1/400 of the loop apart.
      if (prev >= 0) expect(Math.abs(pos - prev)).toBeLessThan(1.5);
      prev = pos; last = pos;
    }
    expect(turned).toBe(true);
    expect(last).toBeLessThan(0.01);
  });

  it('breathes by about a percent', () => {
    for (let t = 0; t < 4; t += 0.1) {
      const [x, y] = breath(t, 0.3);
      expect(Math.abs(y - 1)).toBeLessThanOrEqual(0.011 + 1e-9);
      expect(Math.abs(x - 1)).toBeLessThanOrEqual(0.005 + 1e-9);
    }
  });
});
