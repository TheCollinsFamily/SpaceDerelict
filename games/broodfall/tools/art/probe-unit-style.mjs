/**
 * Graphics probe: map units in the chunky, slightly cartoon style of late-1990s strategy
 * games (Collins, Sep 29 2026: "look at units in starcraft or red alert 2"), as REAL
 * sprites: a still on green, a walking clip, keyed, cut to a loop, shrunk to game size and
 * placed on the approved board picture beside the realistic soldier from the first probe.
 * PAID: about $0.35 per unit.
 *
 *   node tools/art/probe-unit-style.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CAMERA, OUT_DIR, RAW_DIR, ROOT, ffmpeg, keyChain, loopWindow, makeClip, makeStill, ready } from './rfab.mjs';

const FRAME = 128;
const FPS = 12;
const COLS = 8;
const RTS =
  'A game unit sprite for a late-1990s real-time strategy game with pre-rendered 3D units. A little cartoonish, ' +
  'chunky and exaggerated: bold simple shapes, little fine detail, strong light and dark, a dark umber shell ' +
  'with large flat patches of safety orange, pale amber eyes. It must read clearly when shrunk to a thumbnail. ' +
  'Even light from directly overhead.';
const UNITS = [
  { slug: 'rts-soldier',
    still: `${RTS} A single insect soldier, ${CAMERA}, walking toward the lower left of the picture: a broad low ` +
      'armoured body on four thick sturdy legs, two arms holding a pike, an oversized head with big jaws under ' +
      'a plain helmet. Centred, fully in frame with clear margin on every side, filling about half of the picture.',
    motion: 'The insect soldier marches on the spot as if on a treadmill: its legs step in a steady gait, the body ' +
      'bobs, the pike sways slightly. It never travels across the frame and never turns.' },
  { slug: 'rts-militia',
    still: `${RTS} A single insect militia volunteer, ${CAMERA}, walking toward the lower left of the picture: ` +
      'upright on two legs like a person, four arms, an oversized head with big eyes under a steel helmet far ' +
      'too big for him, a safety-orange armband, carrying a spear over one shoulder. Centred, fully in frame ' +
      'with clear margin on every side, filling about half of the picture.',
    motion: 'The insect volunteer walks on the spot as if on a treadmill, a little nervously: his legs step, his ' +
      'arms swing, the oversized helmet wobbles. He never travels across the frame and never turns.' },
];

ready();
const DIR = path.join(OUT_DIR, 'unit-style');
fs.mkdirSync(DIR, { recursive: true });

const made = await Promise.allSettled(UNITS.map(async (u) => {
  const stillFile = await makeStill({ slug: u.slug, prompt: u.still });
  const clipFile = await makeClip({ slug: u.slug, stillFile, prompt: u.motion });
  return { ...u, stillFile, clipFile };
}));
made.forEach((m, i) => { if (m.status === 'rejected') console.log(`FAIL ${UNITS[i].slug}: ${m.reason.message}`); });
const units = made.filter((m) => m.status === 'fulfilled').map((m) => m.value);
// The realistic soldier from the first probe, for comparison.
const realistic = path.join(RAW_DIR, 'soldier-walk-clip.mp4');
if (fs.existsSync(realistic)) units.push({ slug: 'realistic-soldier', clipFile: realistic, stillFile: path.join(RAW_DIR, 'soldier-walk-still.png') });

for (const u of units) {
  const w = loopWindow(u.clipFile, FPS);
  const count = w.end - w.start;
  const chain = `trim=start_frame=1,setpts=PTS-STARTPTS,fps=${FPS},trim=start_frame=${w.start}:end_frame=${w.end},setpts=PTS-STARTPTS,` +
    `scale=${FRAME}:${FRAME}:flags=lanczos,${keyChain()},format=rgba`;
  ffmpeg(['-i', u.clipFile, '-vf', `${chain},tile=${COLS}x${Math.ceil(count / COLS)}`, '-frames:v', '1', path.join(DIR, `${u.slug}-sheet.png`)], `${u.slug} sheet`);
  ffmpeg(['-i', u.clipFile, '-vf', chain, '-frames:v', '1', path.join(RAW_DIR, `${u.slug}-frame.png`)], `${u.slug} frame`);
  ffmpeg(['-i', u.clipFile, '-vf', `${chain.replace(`scale=${FRAME}:${FRAME}`, 'scale=256:256')},format=yuva420p`,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-auto-alt-ref', '0', '-an', path.join(DIR, `${u.slug}.webm`)], `${u.slug} loop`);
  fs.copyFileSync(u.stillFile, path.join(DIR, `${u.slug}-still.png`));
  console.log(`[sheet] ${u.slug}: ${count} frames, seam difference ${w.diff.toFixed(2)} of 255`);
}

// Every unit at 96, 48 and 24 px on a street of the approved board picture.
const board = path.join(ROOT, 'notes', 'concepts', '2026-09-29', 'board-paper-city.png');
const inputs = ['-i', board];
const parts = ['[0:v]crop=640:400:0:560,scale=1280:800:flags=lanczos[b0]'];
let n = 0;
units.forEach((u, i) => {
  inputs.push('-i', path.join(RAW_DIR, `${u.slug}-frame.png`));
  [96, 48, 24].forEach((s, k) => {
    parts.push(`[${i + 1}:v]scale=${s}:${s}:flags=lanczos[u${n}]`);
    parts.push(`[b${n}][u${n}]overlay=${140 + i * 380 + k * 110}:${420 - s}:format=auto[b${n + 1}]`);
    n += 1;
  });
});
ffmpeg([...inputs, '-filter_complex', parts.join(';'), '-map', `[b${n}]`, '-frames:v', '1', path.join(DIR, 'on-board.png')], 'on board');
console.log(`units: ${units.map((u) => u.slug).join(', ')}; written to ${DIR}`);
