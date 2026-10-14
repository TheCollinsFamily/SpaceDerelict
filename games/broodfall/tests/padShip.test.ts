/**
 * The pad's part 2 (src/ui/padOutro.ts, tools/art/templates/pad-ship.mjs): from the desk into the ship. These hold the
 * baked films to their manifest and the film's last frame to the interface it hands over to.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
      expect(c!.seconds).toBeLessThan(17); // short: one skippable move, not a film
      expect(c!.poster && fs.existsSync(path.join(PAD, c!.poster))).toBe(true);
      // It carries sound (the ship's hum, his steps, the hatch).
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', path.join(PAD, c!.video)], { encoding: 'utf8' });
      expect(probe.stdout.trim()).toBe('aac');
    });
  }
});
