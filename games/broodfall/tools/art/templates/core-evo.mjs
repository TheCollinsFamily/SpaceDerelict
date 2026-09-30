/**
 * THE CORE EVOLVES (Collins, Sep 30 2026: "the central node should 'evolve' after certain
 * numbers of towers are built ... we can achieve this with image to image video calls", then
 * "where you give an AI a start and end image and it fills in the middle", and "a Leaflit
 * background remove to separate it into frames without a background").
 *
 * Four stages of the heart in its meteor (the standing part of the landing site; the crater
 * from above is templates/core.mjs and does not change, it only grows with the collar):
 *
 *   1. the stills first: stage N+1 is an image-to-image EDIT of stage N's still (same camera,
 *      same spot, same green), each LOOKED at before the next is drawn from it. Stage 1 is the
 *      heart the board already has (art-src/terrain/core/heart.png).
 *   2. a START-AND-END clip for each step (first frame stage N, last frame stage N+1: the
 *      model fills in the growing), seegen:sd2-mini at 720p, 4 s.
 *   3. an idle for each stage: a clip whose last frame is its first (stage 1's is the one the
 *      board already had, heart-idle.mp4).
 *   4. every frame keyed by Leaflit's studio keyer (tools/art/lib/leaflit.mjs, the studio's own
 *      ChromaKey class), then cut, packed and written to the manifest as board.coreEvo.
 *
 *   node tools/art/make.mjs coreevo --stills [2 3 4]   the stills (each needs the one before it)
 *   node tools/art/make.mjs coreevo                    stills, clips, then the bake
 *   node tools/art/make.mjs coreevo --bake             bake again (free)
 *
 * Every clip of every stage is cut in the SAME mapping from the clip's pixels to the board: the
 * meteor does not move between stages, so a stage that is drawn bigger in its picture is bigger
 * on the board, and the last frame of a growing clip is the first of the next stage's idle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill } from '../rfab.mjs';
import { blank, crop, over, paste, readFrames, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { dropSpecks, loopWindow, pick, unionBox } from '../lib/key.mjs';
import { keyFrame as studioKey, studioKeyer } from '../lib/leaflit.mjs';
import { GROUNDS } from '../lib/atlas.mjs';
import { ART, REVIEW, SRC, putEntry } from '../lib/manifest.mjs';
import { HEART_CELLS, HEART_FOOT } from './core.mjs';

const DIR = path.join(SRC, 'terrain', 'core');

const KEEP =
  'Keep EVERYTHING else exactly as it is in the reference picture: the same camera (isometric three-quarter ' +
  'view from 45 degrees above), the same spot in the middle of the picture, the same size of the meteor, the ' +
  'same light, the same wet deep maroon and crimson veined tissue. It is the SAME creature, grown. ' +
  'No text, no letters, no symbols, no crosses, no emblems anywhere.';

/**
 * The stages. `grown`: how many limbs the body has grown in this run when the core reaches
 * this stage (sim.stats.limbsGrown: grown, not standing, so a stage is never lost). Measured
 * over the scripted player's 10 seeds, Sep 30 2026: 6 grown by about wave 2-3, 18 by wave 5-6,
 * 40 by wave 8 (a won 12-wave run grows 90-126).
 * `collar`: how wide its collar is, as a share of the width of its still, MARKED BY EYE (rule 24).
 */
export const STAGES = [
  { id: 1, grown: 0, name: 'the landing', collar: 0.565 },
  {
    id: 2, grown: 6, name: 'rooted', collar: 0.6,
    prompt: 'Edit this picture: the living heart in the split meteor has begun to grow. The crack in the meteor is ' +
      'wider and the crimson heart inside is bigger and swells out of it. Many more thick roots of the same tissue ' +
      'climb up over the dark meteor shell and grip it. Two small round fleshy sacs bud from the collar at its ' +
      'base, and three small wet amber eyes have opened in the flesh of the collar. The whole is a little taller. ' +
      'The mound at its base is only very slightly wider than in the reference: no more than a tenth wider. ',
  },
  {
    id: 3, grown: 18, name: 'chambered', collar: 0.645,
    prompt: 'Edit this picture: the living heart has grown further. The dark meteor shell is splitting into several ' +
      'curved plates, pushed apart by swelling crimson flesh between them. The heart is larger and there are now ' +
      'two more heart-like chambers of wet muscle beside it. Five short tube-shaped vents of dark chitin rise from ' +
      'the flesh and breathe a faint pink mist. More wet amber eyes are open in the flesh. It is taller than in the ' +
      'reference. The mound at its base is only slightly wider than in the reference: no more than a tenth wider. ',
  },
  {
    id: 4, grown: 40, name: 'the citadel', collar: 0.7,
    prompt: 'Edit this picture: the living heart has become a towering organ, a citadel of flesh. The plates of the ' +
      'meteor shell are carried up on the flesh like armour. The great crimson heart and its chambers glow from ' +
      'inside. Tall curved tusks and horn-like vents of dark chitin rise around the top like the spines of a sea ' +
      'urchin, some breathing a faint pink mist. Many wet amber eyes, large and small, look out of the flesh. Thick ' +
      'roots and ribs of bone brace it from all sides. It is clearly taller than in the reference. The mound at its ' +
      'base is only slightly wider than in the reference: no more than a tenth wider. ',
  },
];

const stillOf = (n) => path.join(DIR, n === 1 ? 'heart.png' : `stage-${n}.png`);
const idleOf = (n) => path.join(DIR, n === 1 ? 'heart-idle.mp4' : `stage-${n}-idle.mp4`);
const growOf = (n) => path.join(DIR, `grow-${n - 1}-${n}.mp4`);

const BEAT =
  'The crimson heart inside beats slowly and heavily; the flesh around it swells and relaxes with each beat; the ' +
  'roots tighten and ease; its eyes blink slowly. Nothing else moves: it stays at exactly the same spot and the same ' +
  'size. Camera completely locked: no zoom, no pan, no cuts. The solid pure green #00FF00 background stays flat and empty.';
const GROW =
  'The living heart GROWS, slowly and continuously, from the first picture into the last one: the flesh swells, ' +
  'roots creep up and thicken, new chambers and sacs bud and fill out, eyes open, the meteor shell is pushed apart. ' +
  'It pulses as it grows. It stays standing at exactly the same spot in the middle of the picture; it only grows. ' +
  'Camera completely locked: no zoom, no pan, no cuts. The solid pure green #00FF00 background stays flat and ' +
  'empty the whole time. No text, no symbols.';

export async function makeCoreEvo({ only = [], stillsOnly = false, bakeOnly = false } = {}) {
  const wanted = (n) => !only.length || only.includes(String(n));
  if (!bakeOnly) {
    // The stills, one after the other: each is drawn from the one before it.
    for (const s of STAGES.slice(1)) {
      if (!wanted(s.id)) continue;
      if (!fs.existsSync(stillOf(s.id - 1))) throw new Error(`stage ${s.id}: stage ${s.id - 1}'s still is not there yet`);
      await makeStill({
        slug: `the core, stage ${s.id} (${s.name})`, out: stillOf(s.id), prompt: s.prompt + KEEP, quality: 'high',
        width: 1024, height: 1024, refFiles: [stillOf(s.id - 1)],
      });
    }
    if (stillsOnly) return null;
    const jobs = [];
    for (const s of STAGES.slice(1)) {
      if (!wanted(s.id)) continue;
      jobs.push(makeClip({ slug: `the core grows into stage ${s.id}`, out: growOf(s.id), stillFile: stillOf(s.id - 1), endFile: stillOf(s.id), prompt: GROW, raw: true, resolution: '720p' }));
      jobs.push(makeClip({ slug: `the core at stage ${s.id} beats`, out: idleOf(s.id), stillFile: stillOf(s.id), prompt: BEAT, raw: true, resolution: '720p' }));
    }
    const done = await Promise.allSettled(jobs);
    done.forEach((r) => { if (r.status === 'rejected') console.warn(`[core-evo] a clip failed: ${r.reason.message.slice(0, 200)}`); });
  }
  return bakeCoreEvo();
}

/** A clip's frames, every one through Leaflit's studio keyer (key colour and similarity found on its first frame). */
function keyed(file) {
  const clip = readFrames(file, 12);
  const imgs = clip.frames.map((f) => ({ w: clip.w, h: clip.h, data: Buffer.from(f) }));
  const { ck } = studioKeyer({ w: clip.w, h: clip.h, data: Buffer.from(imgs[0].data) });
  for (const img of imgs) { studioKey(ck, img); dropSpecks(img); }
  return imgs;
}

/** Pixels of frame for each pixel of clip: as sharp as the old core (640 px frames for its idle's box). */
let SHARP = null;

/**
 * Cut frames around the foot, in the one mapping: `foot` is where stage 1 stands in the clip's
 * pixels, `collar1` how wide stage 1's collar is there. Returns the atlas entry of one clip.
 */
function cut(name, frames, foot, collar1, fps) {
  const box = unionBox(frames);
  const up = foot.y - box.y0;
  const down = Math.max(0, box.y1 - foot.y);
  const side = Math.ceil(Math.max(2 * Math.max(foot.x - box.x0, box.x1 - foot.x), up + down) * 1.04);
  const x0 = Math.round(foot.x - side / 2);
  const y0 = Math.round(foot.y - up - (side - (up + down)) / 2);
  const F = Math.round(side * SHARP);
  const COLS = Math.ceil(Math.sqrt(frames.length));
  const kept = frames.map((f) => resize(crop(f, x0, y0, side, side), F, F));
  const sheet = blank(COLS * F, Math.ceil(kept.length / COLS) * F);
  kept.forEach((f, i) => paste(sheet, f, (i % COLS) * F, Math.floor(i / COLS) * F));
  const png = path.join(ART, 'board', `core-${name}.png`);
  writePng(png, sheet);
  toWebp(png, png.replace(/\.png$/, '.webp'), { q: 88 });
  fs.rmSync(png);
  return {
    entry: {
      atlas: `board/core-${name}.webp`, frame: F, cols: COLS, count: kept.length, fps,
      anchor: [Number(((foot.x - x0) / side).toFixed(4)), Number(((foot.y - y0) / side).toFixed(4))],
      /** Stage 1's collar as a share of this frame: every clip is drawn in the same mapping. */
      body: Number((collar1 / side).toFixed(4)),
    },
    kept,
  };
}

export function bakeCoreEvo() {
  const have = STAGES.every((s) => fs.existsSync(idleOf(s.id)) && (s.id === 1 || fs.existsSync(growOf(s.id))));
  if (!have) { console.warn('[core-evo] not every clip is there: nothing baked'); return null; }
  fs.mkdirSync(path.join(ART, 'board'), { recursive: true });
  // The mapping: stage 1's idle, its first frame, where its footing is marked (HEART_FOOT, as the old core).
  const idle1 = keyed(idleOf(1));
  const first = unionBox([idle1[0]]);
  const foot = {
    x: first.x0 + HEART_FOOT[0] * (first.x1 - first.x0),
    y: first.y0 + HEART_FOOT[1] * (first.y1 - first.y0),
  };
  const collar1 = HEART_FOOT[2] * (first.x1 - first.x0);
  // As many pixels to the collar as the old core had: 640 px frames for its box.
  SHARP = 640 / (unionBox(idle1).x1 - unionBox(idle1).x0) * 0.8;
  const stages = [];
  const review = [];
  for (const s of STAGES) {
    const all = s.id === 1 ? idle1 : keyed(idleOf(s.id));
    const loop = loopWindow(all, { min: 12, max: 46 });
    const idle = cut(`stage-${s.id}`, pick(all.slice(loop.start, loop.end), 16), foot, collar1, 0);
    idle.entry.fps = Number((idle.entry.count / ((loop.end - loop.start) / 12)).toFixed(2));
    const stage = { id: s.id, name: s.name, grown: s.grown, collar: Number((s.collar / STAGES[0].collar).toFixed(3)), idle: { ...idle.entry, seam: Number(loop.seam.toFixed(2)) } };
    if (s.id > 1) {
      const frames = keyed(growOf(s.id));
      const grow = cut(`grow-${s.id}`, frames, foot, collar1, 12);
      stage.grow = grow.entry;
      review.push({ label: `grow ${s.id - 1} to ${s.id}`, frames: pick(grow.kept, 8) });
    }
    review.push({ label: `stage ${s.id} idle`, frames: pick(idle.kept, 4) });
    stages.push(stage);
    console.log(`[core-evo] stage ${s.id} (${s.name}): idle ${idle.entry.count} frames at ${idle.entry.frame}px, seam ${loop.seam.toFixed(2)}${stage.grow ? `; grows in ${stage.grow.count} frames` : ''}`);
  }
  const entry = { cells: HEART_CELLS, stages };
  putEntry('board', 'coreEvo', entry);
  reviewSheet(review);
  return entry;
}

/** notes/art-review/terrain/core-evo.jpg: each step's growing clip in eight frames, and each stage's idle. */
function reviewSheet(rows) {
  const T = 200;
  const W = 8 * T;
  const out = blank(W, rows.length * T, [...GROUNDS.creep, 255]);
  rows.forEach((r, y) => r.frames.forEach((f, x) => over(out, resize(f, T, T), x * T, y * T)));
  fs.mkdirSync(path.join(REVIEW, 'terrain'), { recursive: true });
  writeJpg(path.join(REVIEW, 'terrain', 'core-evo.jpg'), out, 3);
  console.log(`[core-evo] review: ${path.join(REVIEW, 'terrain', 'core-evo.jpg')}`);
}
