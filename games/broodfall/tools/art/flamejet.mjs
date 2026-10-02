/**
 * THE FLAMETROOPER'S JET (Oct 2 2026; Collins: "the fire effects are awful, come on we can do better"). A looping
 * clip of a real flamethrower jet, made on RFab, baked to a strip of frames the game lays along the stream:
 *
 *   still: a side view of a flamethrower jet on pure black (the nozzle at the left edge, the jet running right,
 *          a white-yellow core, orange body, red edges, a little black smoke off the end)
 *   clip:  4 s of it roaring (image-to-video, end frame = start frame, so it loops)
 *   bake:  16 frames, 256x96 each, cropped to the jet, a strip in public/art/fx/flamejet.webp. Drawn ADDED (black
 *          adds nothing), so it needs no keying; the dark smoke is drawn by the renderer separately.
 *
 *   node tools/art/flamejet.mjs [--still|--clip|--bake]     (each step skips what is on disk)
 * Raw: $BROODFALL_ART_SRC/fx/flamejet/ (art-src-new while art-src is restored). SPENDS ~$1 (a still, a clip).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ffmpeg, makeClip, makeStill, spent, balance } from './rfab.mjs';
import { ART, SRC } from './lib/manifest.mjs';

const DIR = path.join(SRC, 'fx', 'flamejet');
const STILL = path.join(DIR, 'still.png');
const CLIP = path.join(DIR, 'clip.mp4');
const OUT = path.join(ART, 'fx', 'flamejet.webp');
const FRAMES = 16;
const FW = 256;
const FH = 96;
fs.mkdirSync(DIR, { recursive: true });
const only = process.argv.slice(2);
const want = (s) => only.length === 0 || only.includes(`--${s}`);

const JET = 'A single horizontal jet of fire from a military flamethrower, seen from the side, on a pure black background. '
  + 'The jet comes out of a tiny point at the very left edge of the picture, halfway down, and roars straight to the right across the '
  + 'whole picture, widening slowly from a narrow stream into a rolling, turbulent tongue of flame at the right. Its core near the '
  + 'left is blazing white-yellow, the body is bright orange, its edges are deep red and licking, and a little dark smoke curls off '
  + 'its far end. No nozzle, no weapon, no person, no ground, nothing else: only the fire on black. Photographic, high contrast.';

const t0 = await balance();
if (want('still')) await makeStill({ slug: 'flamejet', prompt: JET, key: null, width: 1536, height: 1024, quality: 'high', out: STILL });
if (want('clip')) {
  await makeClip({
    slug: 'flamejet', stillFile: STILL, out: CLIP, raw: true, loop: true, seconds: 4, resolution: '720p', aspect: '16:9',
    prompt: 'The jet of fire roars continuously from the left edge to the right: the flames churn, lick and roll along it, the '
      + 'turbulence travels to the right, sparks and a little dark smoke drift off the far end. It never stops, never moves, never '
      + 'changes shape overall, and the background stays pure black. The camera does not move.',
  });
}
if (want('bake')) {
  // The jet's box in the clip: from the left edge, the middle band where the flame is (found once by eye on the still).
  const tmp = path.join(DIR, 'frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  ffmpeg(['-i', CLIP, '-vf', `fps=${FRAMES / 4},crop=iw:ih*0.56:0:ih*0.22,scale=${FW}:${FH}`, '-frames:v', String(FRAMES), path.join(tmp, 'f%02d.png')], 'flamejet frames');
  const list = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  ffmpeg([...list.flatMap((f) => ['-i', path.join(tmp, f)]), '-filter_complex', `hstack=inputs=${list.length}`, '-c:v', 'libwebp', '-quality', '88', OUT], 'flamejet strip');
  console.log(`[flamejet] ${list.length} frames of ${FW}x${FH} -> ${OUT}`);
}
const t1 = await balance();
console.log(`spent ${t0 - t1} tokens ($${((t0 - t1) / 50000).toFixed(2)}) on ${spent.stills} still(s) and ${spent.clips} clip(s)`);
