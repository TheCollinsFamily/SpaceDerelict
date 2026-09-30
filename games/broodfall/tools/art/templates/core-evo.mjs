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
 *      heart the board already has (art-src/terrain/core/heart.png), made smaller on its canvas.
 *   2. a START-AND-END clip for each step (first frame stage N, last frame stage N+1: the
 *      model fills in the growing), seegen:sd2-mini, 4 s.
 *   3. an idle for each stage: a clip whose last frame is its first.
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
import { blank, borderColour, crop, over, paste, readFrames, readImage, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { dropSpecks, loopWindow, pick, unionBox } from '../lib/key.mjs';
import { frameList, keyFrame as studioKey, studioKeyer } from '../lib/leaflit.mjs';
import { GROUNDS } from '../lib/atlas.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';
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
  { id: 1, grown: 0, name: 'the landing', collar: 0.41 },
  {
    id: 2, grown: 6, name: 'rooted', collar: 0.41,
    prompt: 'Edit this picture: the living heart in the split meteor has begun to grow. The crack in the meteor is ' +
      'wider and the crimson heart inside is bigger and swells out of it. Many more thick roots of the same tissue ' +
      'climb up over the dark meteor shell and grip it. Two small round fleshy sacs bud from the collar at its ' +
      'base, and three small wet amber eyes have opened in the flesh of the collar. The whole is a little taller. ' +
      'The mound at its base is only very slightly wider than in the reference: no more than a tenth wider. ',
  },
  {
    id: 3, grown: 18, name: 'chambered', collar: 0.415,
    prompt: 'Edit this picture: the living heart has grown further. The dark meteor shell is splitting into several ' +
      'curved plates, pushed apart by swelling crimson flesh between them. The heart is larger and there are now ' +
      'two more heart-like chambers of wet muscle beside it. Five short tube-shaped vents of dark chitin rise from ' +
      'the flesh and breathe a faint pink mist. More wet amber eyes are open in the flesh. It is taller than in the ' +
      'reference. The mound at its base is only slightly wider than in the reference: no more than a tenth wider. ',
  },
  {
    id: 4, grown: 40, name: 'the citadel', collar: 0.423,
    prompt: 'Edit this picture: the living heart has become a towering organ, a citadel of flesh. The plates of the ' +
      'meteor shell are carried up on the flesh like armour. The great crimson heart and its chambers glow from ' +
      'inside. Tall curved tusks and horn-like vents of dark chitin rise around the top like the spines of a sea ' +
      'urchin, some breathing a faint pink mist. Many wet amber eyes, large and small, look out of the flesh. Thick ' +
      'roots and ribs of bone brace it from all sides. Its top is a little higher than in the reference, and the whole still fits inside the picture with green space above it. The mound at its ' +
      'base is only slightly wider than in the reference: no more than a tenth wider. ',
  },
];

/**
 * Every stage lives on one canvas: stage 1 is the board's heart (heart.png) made smaller (ROOM)
 * and set low in the picture, so that the stages above it have room to grow upward inside the
 * picture (the first try of stage 3, on the heart's own canvas, grew out of the top of it).
 */
const ROOM = 0.72;
const FOOT_Y = 0.86;
const stillOf = (n) => path.join(DIR, `stage-${n}.png`);
/** What the edit drew; stillOf() is it moved so that its collar stands where stage 1's does. */
const rawOf = (n) => path.join(DIR, `stage-${n}-raw.png`);
const idleOf = (n) => path.join(DIR, `stage-${n}-idle.mp4`);
const growOf = (n) => path.join(DIR, `grow-${n - 1}-${n}.mp4`);

const BEAT =
  'The crimson heart inside beats slowly and heavily; the flesh around it swells and relaxes with each beat; the ' +
  'roots tighten and ease; its eyes blink slowly. Nothing else moves: it stays at exactly the same spot and the same ' +
  'size. Camera completely locked: no zoom, no pan, no cuts. The solid pure green #00FF00 background stays flat and empty.';
/**
 * The first try said "GROWS": seegen:sd2-mini zoomed in on the heart until it filled the picture, drew an
 * anatomical heart with its aorta, and never came to the end frame (Sep 30 2026, art-src/terrain/core/rejected/).
 * The creature changes; the camera and its size in the picture do not.
 */
const GROW =
  'A static shot. The creature in the middle of the picture slowly transforms, in place, from how it looks in the ' +
  'first frame into exactly how it looks in the last frame: its flesh swells and changes shape, roots creep over it, ' +
  'new chambers and sacs bud, eyes open, and it pulses as it changes. Its base stays on exactly the same spot and it ' +
  'stays the same size in the picture as in the two frames: the camera does not move closer, the view does not zoom ' +
  'or crop. The solid pure green #00FF00 background stays flat and empty around it the whole time. No text, no symbols.';
/** The video model of the growing clips (start and end frame): env CORE_EVO_GROW_MODEL, default seegen:sd2-fast. */
const GROW_MODEL = process.env.CORE_EVO_GROW_MODEL || 'seegen:sd2-fast';

export async function makeCoreEvo({ only = [], stillsOnly = false, bakeOnly = false } = {}) {
  const wanted = (n) => !only.length || only.includes(String(n));
  if (!bakeOnly) {
    stageOne();
    // The stills, one after the other: each is drawn from the one before it.
    for (const s of STAGES.slice(1)) {
      if (!wanted(s.id)) continue;
      if (!fs.existsSync(stillOf(s.id - 1))) throw new Error(`stage ${s.id}: stage ${s.id - 1}'s still is not there yet`);
      await makeStill({
        slug: `the core, stage ${s.id} (${s.name})`, out: rawOf(s.id), prompt: s.prompt + KEEP, quality: 'high',
        width: 1024, height: 1024, refFiles: [stillOf(s.id - 1)],
      });
      register(s.id);
    }
    if (stillsOnly) return null;
    const jobs = [];
    jobs.push(makeClip({ slug: 'the core at stage 1 beats', out: idleOf(1), stillFile: stillOf(1), prompt: BEAT, raw: true, resolution: RES }));
    for (const s of STAGES.slice(1)) {
      if (!wanted(s.id)) continue;
      jobs.push(makeClip({ slug: `the core grows into stage ${s.id}`, out: growOf(s.id), stillFile: stillOf(s.id - 1), endFile: stillOf(s.id), prompt: GROW, raw: true, resolution: RES, models: [GROW_MODEL] }));
      jobs.push(makeClip({ slug: `the core at stage ${s.id} beats`, out: idleOf(s.id), stillFile: stillOf(s.id), prompt: BEAT, raw: true, resolution: RES }));
    }
    const done = await Promise.allSettled(jobs);
    done.forEach((r) => { if (r.status === 'rejected') console.warn(`[core-evo] a clip failed: ${r.reason.message.slice(0, 200)}`); });
  }
  return bakeCoreEvo();
}

/**
 * Where a still stands: the middle of the widest row of the lowest third of what is not green
 * (its collar), found through the studio keyer. Only to line the stages up with each other;
 * where stage 1 stands on the board is its marked HEART_FOOT.
 */
export function standsAt(img) {
  const k = { w: img.w, h: img.h, data: Buffer.from(img.data) };
  const { ck } = studioKeyer({ w: img.w, h: img.h, data: Buffer.from(img.data) });
  studioKey(ck, k);
  dropSpecks(k);
  const b = unionBox([k]);
  let best = { y: b.y1 - 1, w: 0, x: (b.x0 + b.x1) / 2 };
  for (let y = Math.round(b.y1 - (b.y1 - b.y0) / 3); y < b.y1; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < k.w; x++) if (k.data[(y * k.w + x) * 4 + 3] > 128) { if (x0 < 0) x0 = x; x1 = x; }
    if (x0 >= 0 && x1 - x0 > best.w) best = { y, w: x1 - x0, x: (x0 + x1) / 2 };
  }
  return best;
}

/** The clips' resolution: the heart is smaller on its canvas than it was, so more pixels. */
const RES = process.env.CORE_EVO_RES || '1080p';

/** Stage 1: the board's heart, made ROOM smaller, standing at FOOT_Y in the middle of a canvas of its own green. */
function stageOne() {
  if (fs.existsSync(stillOf(1))) return;
  const img = readImage(path.join(DIR, 'heart.png'));
  const at = standsAt(img);
  const small = resize(img, Math.round(img.w * ROOM), Math.round(img.h * ROOM));
  const out = blank(img.w, img.h, [...borderColour(img), 255]);
  paste(out, small, Math.round(img.w / 2 - at.x * ROOM), Math.round(img.h * FOOT_Y - at.y * ROOM));
  writePng(stillOf(1), out);
}

/** Stage n's edit, moved (on its own green) so that its collar stands where stage 1's does. */
function register(n) {
  if (fs.existsSync(stillOf(n))) return;
  const ref = standsAt(readImage(stillOf(1)));
  const img = readImage(rawOf(n));
  const at = standsAt(img);
  const dx = Math.round(ref.x - at.x);
  const dy = Math.round(ref.y - at.y);
  const green = borderColour(img);
  const out = blank(img.w, img.h, [...green, 255]);
  paste(out, img, dx, dy);
  writePng(stillOf(n), out);
  console.log(`[core-evo] stage ${n}: moved ${dx}, ${dy} px to stand where stage 1 stands; its collar ${(at.w / img.w).toFixed(3)} of the picture (stage 1: ${(ref.w / img.w).toFixed(3)})`);
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

/** The side of the square frame that holds every one of the frames about the foot (in clip pixels). */
function sideOf(frames, foot) {
  const box = unionBox(frames);
  const up = foot.y - box.y0;
  const down = Math.max(0, box.y1 - foot.y);
  return Math.ceil(Math.max(2 * Math.max(foot.x - box.x0, box.x1 - foot.x), up + down) * 1.04);
}

/**
 * Cut frames around the foot, in the one mapping: `foot` is where stage 1 stands in the clip's
 * pixels, `collar1` how wide stage 1's collar is there. Returns the atlas entry of one clip.
 */
function cut(name, frames, foot, collar1, fps) {
  const box = unionBox(frames);
  const up = foot.y - box.y0;
  const down = Math.max(0, box.y1 - foot.y);
  const side = sideOf(frames, foot);
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
    // A loop whose two ends do not meet cleanly (seam over 0.25: stage 4's was 0.40) is played
    // forward and back (the studio's Ping-Pong, lib/leaflit.mjs frameList): it has no seam at all.
    const pong = loop.seam > 0.25;
    // Every frame of the loop at 12 fps that one picture can hold (Sep 30 2026: 16 of up to 46 stepped at
    // 5 fps; anim-README.md). A picture is kept to what a GPU takes as one texture (8,192 a side) and
    // about 45 million pixels, the size of stage 4's; the game cross-fades between the frames kept.
    const F = Math.round(sideOf(all.slice(loop.start, loop.end), foot) * SHARP);
    const fit = Math.max(16, Math.min(Math.floor(8192 / F) ** 2, Math.floor(45e6 / (F * F))));
    const run = pick(all.slice(loop.start, loop.end), pong ? 12 : Math.min(loop.end - loop.start, fit));
    const frames = pong ? frameList(0, run.length - 1, true).map((i) => run[i]) : run;
    const idle = cut(`stage-${s.id}`, frames, foot, collar1, 0);
    idle.entry.fps = Number(((pong ? run.length : idle.entry.count) / ((loop.end - loop.start) / 12)).toFixed(2));
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

// ---------------------------------------------------------------- the organ stage (the ship's ground scan)

/**
 * THE METEOR ON THE ORGAN STAGE, one picture per stage (Collins, Sep 30 2026: it looked "rendered
 * twice, one above ground, one under"). It was two pictures: a dome cut from the concept above the
 * street line, and under it a picture of the buried half that drew its own arched top. Now each
 * stage is ONE picture of the whole half-buried meteor, cut by the game at its ground line: what is
 * above the line stands over the street, what is below fills the meteor's 3 by 2 cells. The two
 * halves are one object, so their edges meet at the line.
 *
 * The picture is 3 cells wide; its ground line lies SCAN_LINE of the way down, so that below it
 * are exactly the 2 rows of cells (a cell is 1.25 times as wide as it is tall).
 */
const SCAN_DIR = path.join(SRC, 'under');
const SCAN_OUT = path.join(ART, 'under');
const SCAN_REFS = [path.join(ROOT, 'notes', 'concepts', '2026-09-29-organ-stage', '1-scanner-board.png'), path.join(SCAN_DIR, 'meteor.png')];
const scanOf = (n) => path.join(SCAN_DIR, `core-stage-${n}.png`);
const SCAN =
  'A square picture of a ground-penetrating scan display on a far-future spaceship, exactly in the rendering of the ' +
  'FIRST reference picture: a pure black background, everything drawn in fine glowing false-colour lines, cyan-grey ' +
  'for rock and earth, red for living flesh. A thin straight pale cyan horizontal GROUND LINE crosses the whole width ' +
  'of the picture at exactly 47 percent of the way down. ONE meteor lies half buried in that ground: a round cracked ' +
  'boulder of rock lines as wide as the whole picture, its middle ON the ground line. Above the line is its top, a ' +
  'cracked dome standing up out of the ground into the empty black above; below the line is its buried lower half, ' +
  'the SAME round outline going on below the line, so that the dome above and the half below are clearly one boulder ' +
  'cut by the line. The heart and roots inside it are drawn as in the SECOND reference picture. Faint horizontal ' +
  'strata of soil lines around the buried half. ';
const SCAN_TAIL = 'Nothing touches the edges of the picture except the ground line. No text, no letters, no numbers, no symbols, no crosses.';
const SCAN_STAGE = {
  1: 'Inside the meteor, below the line, a glowing red heart of muscle, and fine red veins spreading from it into the rock and the ground.',
  2: 'It has begun to grow, as the THIRD reference picture shows it: the crack in the dome is wider and red flesh swells up out of it above the ' +
    'line; the heart below is bigger, with two small round sacs beside it and many more red roots spreading out into the ground.',
  3: 'It has grown further, as the THIRD reference picture shows it: above the line a tall mass of red flesh with several chambers and short ' +
    'vent tubes rises out of the split dome, whose plates are pushed apart; below the line the heart has two more chambers beside it and thick ' +
    'red roots reach far out through the ground to both sides.',
  4: 'It has become a towering citadel of flesh, as the THIRD reference picture shows it: above the line it rises high toward the top of the ' +
    'picture, crowned with curved horn-like spines and vents, many small eyes glowing; below the line a great glowing heart with many chambers, ' +
    'and a dense web of thick red roots filling the ground from edge to edge.',
};

export async function makeCoreScan({ only = [], bakeOnly = false } = {}) {
  if (!bakeOnly) {
    for (const s of STAGES) {
      if (only.length && !only.includes(String(s.id))) continue;
      const refs = s.id === 1 ? SCAN_REFS : [SCAN_REFS[0], scanOf(s.id - 1), stillOf(s.id)];
      await makeStill({
        slug: `the meteor on the scan, stage ${s.id}`, out: scanOf(s.id), prompt: SCAN + SCAN_STAGE[s.id] + ' ' + SCAN_TAIL,
        key: null, quality: 'high', width: 1024, height: 1024, refFiles: refs,
      });
    }
  }
  return bakeCoreScan();
}

/**
 * Each stage's scan picture: found where its ground line is (the brightest long row near the
 * middle), cut so that the line is at the share `line` of the picture's height and the part below
 * it is 2/1.25 of a cell for each of its 3 cells: the game lays the part below over the meteor's
 * cells and the part above over the street line, from one file.
 */
export function bakeCoreScan() {
  const stages = [];
  fs.mkdirSync(SCAN_OUT, { recursive: true });
  for (const s of STAGES) {
    if (!fs.existsSync(scanOf(s.id))) continue;
    const img = readImage(scanOf(s.id));
    let ground = -1, most = 0;
    for (let y = Math.round(img.h * 0.3); y < Math.round(img.h * 0.7); y++) {
      let lit = 0;
      for (let x = 0; x < img.w; x++) {
        const i = (y * img.w + x) * 4;
        if (img.data[i] + img.data[i + 1] + img.data[i + 2] > 180) lit++;
      }
      if (lit > most) { most = lit; ground = y; }
    }
    // Below the line: 3 cells wide, 2 cells deep (a cell is 1.25 as wide as tall): 1.6 of the 3.
    const below = Math.round((img.w * 1.6) / 3);
    const h = ground + below;
    const cut = crop(img, 0, 0, img.w, h, [0, 0, 0, 255]);
    const png = path.join(SCAN_OUT, `core-stage-${s.id}.png`);
    writePng(png, cut);
    toWebp(png, png.replace(/\.png$/, '.webp'), { q: 88 });
    fs.rmSync(png);
    // `line`: the share of the picture's height above the ground line; `aspect`: its width over its height.
    stages.push({ id: s.id, file: `under/core-stage-${s.id}.webp`, line: Number((ground / h).toFixed(4)), aspect: Number((img.w / h).toFixed(4)) });
    console.log(`[core-evo] the scan's meteor, stage ${s.id}: ground line at row ${ground} of ${h}`);
  }
  if (stages.length) putEntry('under', 'core', { stages });
  return stages;
}
