/**
 * The pad's part 2 (src/ui/padOutro.ts, tools/art/templates/pad-ship.mjs): from the desk into the ship. These hold the
 * baked films to their manifest, the film's last frame to the interface it hands over to, and her report lines.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPORT_LINES, reportLine } from '../content/greetings';

const PAD = path.join(__dirname, '..', 'public', 'art', 'pad');
const manifest = JSON.parse(fs.readFileSync(path.join(PAD, 'manifest.json'), 'utf8')) as {
  part2?: Record<string, { video: string; seconds: number; cut: number; w: number; h: number; fps: number; poster?: string }>;
};

describe('the pad, part 2: the films', () => {
  for (const o of ['won', 'lost']) {
    it(`${o}: baked, its cut inside it, its poster beside it`, () => {
      const c = manifest.part2?.[o];
      expect(c, `manifest part2.${o}`).toBeTruthy();
      expect(fs.existsSync(path.join(PAD, c!.video))).toBe(true);
      expect(c!.cut).toBeGreaterThan(1);
      expect(c!.cut).toBeLessThan(c!.seconds - 1);
      expect(c!.seconds).toBeLessThan(14); // short: one skippable move, not a film
      expect(c!.poster && fs.existsSync(path.join(PAD, c!.poster))).toBe(true);
      // It carries sound (the ship's hum, his steps, the hatch).
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', path.join(PAD, c!.video)], { encoding: 'utf8' });
      expect(probe.stdout.trim()).toBe('aac');
    });
  }
});

describe('the pad, part 2: her line as he walks in', () => {
  it('every outcome has lines, short, spoken words (no capitals a voice would spell out)', () => {
    for (const [o, list] of Object.entries(REPORT_LINES)) {
      expect(list.length, o).toBeGreaterThan(1);
      for (const b of list) {
        expect(b.say.length).toBeLessThan(110);
        expect(/\b[A-Z]{2,}\b/.test(b.say), b.say).toBe(false);
      }
    }
  });
  it('they come in turn, never the same line twice running, at any count', () => {
    for (const o of ['won', 'held', 'lost'] as const) {
      for (let n = -3; n < 20; n++) expect(reportLine(o, n)).not.toBe(reportLine(o, n + 1));
    }
  });
});
