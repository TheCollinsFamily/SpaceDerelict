/**
 * He walks into the room (src/ui/campaignUi.ts playArrival, tools/art/ship-arrivals.mjs; Collins, Oct 4 2026:
 * "transitions between different parts of the ship (e.g. ship menus)"). These hold the baked clips to what makes the
 * hand-over invisible and the menu quick: each ends ON its room's loop's first frame, starts with nobody there, is
 * short, and the folder the game ships holds nothing but what the game loads.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const LOOPS = path.join(__dirname, '..', 'public', 'art', 'ship', 'loops');
const manifest = JSON.parse(fs.readFileSync(path.join(LOOPS, 'loops.json'), 'utf8')) as {
  rooms: Record<string, { video: string; poster: string; seconds: number; arrive?: { video: string; poster: string; seconds: number } }>;
};
const file = (f: string) => path.join(LOOPS, path.basename(f));
/** The rooms whose loop has him in it. The Quarters are seen from their doorway, empty: nobody walks in. */
const HIS = ['desk', 'genes', 'locker', 'board', 'comms', 'ai', 'orders', 'hobby'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-arrive-'));
/** One frame of a clip as a small PNG: `at` 'first' or 'last'. */
function frame(clip: string, at: 'first' | 'last'): string {
  const out = path.join(tmp, `${path.basename(clip)}-${at}.png`);
  const args = at === 'first' ? ['-i', clip] : ['-sseof', '-0.06', '-i', clip, '-update', '1'];
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, '-frames:v', '1', '-vf', 'scale=640:360', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return out;
}
/** How near two pictures are, in dB (identical = 99). */
function psnr(a: string, b: string): number {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-filter_complex', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:([\d.]+|inf)/.exec(r.stderr || '');
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : 0;
}

describe('the ship: he walks into each room', () => {
  for (const id of HIS) {
    it(`${id}: an arrival, short, ending on the loop's own first frame`, () => {
      const room = manifest.rooms[id];
      expect(room, `loops.json rooms.${id}`).toBeTruthy();
      const a = room.arrive;
      expect(a, `rooms.${id}.arrive`).toBeTruthy();
      expect(fs.existsSync(file(a!.video)), a!.video).toBe(true);
      expect(fs.existsSync(file(a!.poster)), a!.poster).toBe(true);
      // A menu is never held up by it, and it is over while the room is still being read.
      expect(a!.seconds).toBeGreaterThan(2);
      expect(a!.seconds).toBeLessThan(4.5);
      // Its last frame IS the loop's first: the loop starts under it and nothing jumps.
      expect(psnr(frame(file(a!.video), 'last'), frame(file(room.video), 'first')), 'arrival last frame vs loop first frame, dB').toBeGreaterThan(36);
      // Its first frame is the room without him: far from the last one (where he stands), and it is its own poster.
      expect(psnr(frame(file(a!.video), 'first'), frame(file(a!.video), 'last')), 'arrival first vs last, dB').toBeLessThan(34);
      // Silent: the ship's own sound goes on under it.
      const audio = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file(a!.video)], { encoding: 'utf8' });
      expect(audio.stdout.trim()).toBe('');
    }, 60000);
  }

  it('the Quarters have none (the room is seen empty, from its doorway)', () => {
    expect(manifest.rooms.quarters?.arrive).toBeUndefined();
  });

  it('the folder the game ships holds only what it loads', () => {
    const stray = fs.readdirSync(LOOPS).filter((f) => !/^(room|arrive)-[a-z]+\.(mp4|webp)$/.test(f) && f !== 'loops.json');
    expect(stray).toEqual([]);
  });
});
