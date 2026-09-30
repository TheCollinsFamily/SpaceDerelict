import { describe, expect, it } from 'vitest';
import { IDLE_MAX_RATE, IdleClock, breath, idleFrames, idleLength, phaseOf } from '../src/render/idleClock';

// The idles' clock (Sep 30 2026, notes/screens/2026-09-30/anim-README.md): real time, capped at speed,
// frozen by a pause; a phase per limb; cross-faded frames; ping-pong eased at its ends.
describe('idle clock', () => {
  // The sim ticks 0.1 s at a time; the idles must still move every frame, at the game's speed, capped.
  const run = (clock: IdleClock, speed: number, secs: number) => {
    let acc = 0; const adds: number[] = [];
    for (let f = 0; f < secs * 60; f++) {
      acc += speed / 60; let sim = 0;
      while (acc >= 0.1) { acc -= 0.1; sim += 0.1; }
      adds.push(clock.step(sim, 1 / 60));
    }
    return adds;
  };
  it('runs smoothly between the sim ticks (a tenth of a second each), at the game speed, capped, and stops on pause', () => {
    const c = new IdleClock();
    run(c, 1, 3);
    const at1 = run(c, 1, 2);
    // Every frame moves it, by about a 60th of a second.
    for (const a of at1) { expect(a).toBeGreaterThan(0.012); expect(a).toBeLessThan(0.022); }
    run(c, 8, 2);
    const at8 = run(c, 8, 2);
    expect(at8.reduce((x, y) => x + y, 0)).toBeCloseTo(2 * IDLE_MAX_RATE, 1);
    const paused = run(c, 0, 1);
    expect(paused.slice(20).every((a) => a === 0)).toBe(true);
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
