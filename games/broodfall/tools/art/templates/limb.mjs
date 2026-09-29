/**
 * THE LIMB TEMPLATE: one tower family from its design to a sprite the game loads.
 *
 *   design sheet of its theme -> the limb's figure -> an idle loop and a firing clip ->
 *   keyed, cut to a loop, packed into an atlas -> manifest entry
 *
 * Between the design and the clips the limb is REDRAWN in the material of the creep (see
 * MATERIAL in tools/art/limbs.mjs), so that limbs, core and creep are one body.
 *
 * ONE view per limb (Collins: towers "don't need multiple angles"). A limb that fires
 * faces the lower left; the game mirrors it when its target is to the right. About 31,000
 * tokens a limb, plus 6,150 for each theme's design sheet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ffmpeg, makeClip, makeStill, pool } from '../rfab.mjs';
import { LIMB_SHEETS, MATERIAL, QUIET, THEMES, limb, placeOnLimbSheet } from '../limbs.mjs';
import { blank, crop, paste, readFrames, readImage, resize, writeJpg, writePng } from '../lib/img.mjs';
import { figure, findFigures } from '../lib/sheet.mjs';
import { fringe, keyClip, keyOf, loopWindow, pick, unionBox } from '../lib/key.mjs';
import { packAtlas, reviewFrames, reviewSheet } from '../lib/atlas.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';

const FPS = 12;
const COLS = 16;
const KEEP = { idle: 16, fire: 14 };
const F = 256;
const KEYS = { green: { hex: '00FF00', name: 'green' }, blue: { hex: '0000FF', name: 'blue' } };
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');

const sheetPrompt = (theme, limbs) =>
  `Design sheet of ${limbs.length} rooted alien organisms, the limbs of one creature, for a strategy game. ` +
  'Isometric three-quarter top-down view, the camera 45 degrees above the ground. They stand ' +
  `${limbs.length <= 3 ? 'in one row' : 'in two rows'}, evenly spaced, well apart and not touching, all at the same ` +
  'scale, each about as wide as it is tall. Every one has the same base: a squat mound of glistening salmon-pink ' +
  'wet muscle armoured with plates of dark chitin, with short root-like tendons gripping the ground around it. ' +
  `Every one carries the same accent and no other: ${theme.accent}. Each one faces the lower left of the ` +
  `picture. In reading order: ${limbs.map((l, i) => `(${i + 1}) ${l.name.toUpperCase()}: ${l.look}`).join('; ')}. ` +
  'Realistic, detailed creature design, wet and unglamorous, in exactly the materials and rendering of the ' +
  'reference pictures. Soft even light from directly overhead. No ground, no cast shadows, no labels, no ' +
  'numbers, no text.';

const STEADY =
  ' It stays rooted at exactly the same spot and the same size. Nothing about its shape changes: nothing ' +
  'grows, splits or morphs.';

function styleRefs() {
  const dir = path.join(SRC, 'refs');
  fs.mkdirSync(dir, { recursive: true });
  const board = path.join(dir, 'board-limbs.png');
  if (!fs.existsSync(board)) {
    const img = readImage(path.join(CONCEPTS, 'r4-units-rts-on-board.png'));
    writePng(board, crop(img, img.w - 640, 0, 640, 640));
  }
  return [path.join(CONCEPTS, 'limbs.png'), board];
}

/** Step 1: the design sheet of a theme, cut into one start picture per limb. */
export async function makeLimbSheet(themeId) {
  const sheet = LIMB_SHEETS.find((s) => s.theme === themeId);
  const theme = THEMES[themeId];
  const key = KEYS[theme.key];
  const limbs = sheet.families.map(limb);
  const file = await makeStill({
    slug: `limbs of the ${theme.name}`, out: path.join(SRC, 'limbs', `sheet-${themeId}.png`), refFiles: styleRefs(),
    prompt: sheetPrompt(theme, limbs), key: key.hex, keyName: key.name, width: 1536, height: 1024, quality: 'high',
  });
  const img = readImage(file);
  const found = findFigures(img, { expect: limbs.length });
  if (found.boxes.length !== limbs.length) throw new Error(`${theme.name}: ${found.boxes.length} figures on the sheet, ${limbs.length} expected. Look at ${file}; delete it to draw again.`);
  const side = Math.ceil(Math.max(...found.boxes.map((b) => Math.max(b.x1 - b.x0, b.y1 - b.y0))) * 1.5);
  const strip = blank(limbs.length * 256, 256, [found.bg[0], found.bg[1], found.bg[2], 255]);
  limbs.forEach((l, i) => {
    const dir = path.join(SRC, 'limbs', l.family);
    fs.mkdirSync(dir, { recursive: true });
    const one = figure(img, found.boxes[i], found, 0, side);
    writePng(path.join(dir, 'still.png'), resize(one, 1024, 1024));
    paste(strip, resize(one, 256, 256), i * 256, 0);
  });
  fs.mkdirSync(path.join(REVIEW, 'limbs'), { recursive: true });
  writeJpg(path.join(REVIEW, 'limbs', `sheet-${themeId}.jpg`), strip);
  return file;
}

/** How much brighter the top of a limb is than its foot. */
const LIFT = 0.42;

/**
 * The light on a limb: brighter toward its top, untouched at its foot. Its foot is the
 * creep's own colour and melts into it; its head stands out from the ground behind it.
 */
function lift(img, by) {
  if (!by) return img;
  for (let y = 0; y < img.h; y++) {
    const t = Math.max(0, Math.min(1, (0.8 - y / img.h) / 0.62));
    const k = 1 + by * t * t * (3 - 2 * t);
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      if (!img.data[i + 3]) continue;
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.min(255, Math.round(img.data[i + c] * k));
    }
  }
  return img;
}

/** How many pixels of a frame are solid. */
const area = (f) => { let n = 0; for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 128) n++; return n; };

/** The width of the mound a limb grows from: the widest run in the lowest third of it. */
function baseWidth(frame, box) {
  const from = Math.round(box.y1 - (box.y1 - box.y0) * 0.33);
  let x0 = frame.w, x1 = 0;
  for (let y = from; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
    if (frame.data[(y * frame.w + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  }
  return x1 > x0 ? x1 - x0 : box.x1 - box.x0;
}

/** Steps 2 and 3, free: clips to an atlas, a manifest entry, the checks and the review pictures. */
export function bakeLimb(family) {
  const l = limb(family);
  const dir = path.join(SRC, 'limbs', family);
  const clips = [];
  for (const anim of ['idle', 'fire']) {
    const file = path.join(dir, `${anim}.mp4`);
    if (!fs.existsSync(file)) continue;
    const keyed = keyClip(readFrames(file, FPS));
    let frames = keyed.frames;
    let loop = null;
    let dropped = 0;
    if (anim === 'idle') { loop = loopWindow(frames, { min: 16, max: 46 }); frames = frames.slice(loop.start, loop.end); }
    else {
      // A flash, a beam or a cloud cannot be cut off its background: the frames it swallowed
      // are left out. What a limb throws is drawn by the game; the clip is the body's own motion.
      const solid = frames.map(area);
      const rest = solid.slice(0, 4).sort((p, q) => p - q)[1];
      const kept = frames.filter((_, i) => solid[i] < rest * 1.55);
      dropped = frames.length - kept.length;
      if (kept.length >= 12) frames = kept;
    }
    clips.push({ anim, frames, dropped, box: unionBox(frames), loop, key: keyed.key, w: keyed.w, h: keyed.h, seconds: keyed.frames.length / FPS * (frames.length / keyed.frames.length) });
  }
  const idle = clips.find((c) => c.anim === 'idle');
  if (!idle) throw new Error(`${family}: no idle clip to bake in ${dir}`);
  const cx = (idle.box.x0 + idle.box.x1) / 2;
  const feet = idle.box.y1;
  // Room under the feet for what lashes or drips onto the ground round it.
  const BELOW = 0.14;
  // Room for what a firing limb throws out (a lash, a stretched neck), but no more than
  // 1.6 times its resting size: beyond that the limb itself would be drawn too small.
  const rest = Math.max(2 * Math.max(cx - idle.box.x0, idle.box.x1 - cx), (feet - idle.box.y0) / (1 - BELOW));
  let side = rest;
  for (const c of clips) side = Math.max(side, 2 * Math.max(cx - c.box.x0, c.box.x1 - cx), (feet - c.box.y0) / (1 - BELOW));
  side = Math.ceil(Math.min(side, rest * 1.6) * 1.04);
  const idleBox = unionBox([idle.frames[0]]) ?? idle.box;
  // A long harpoon or a tall stalk must not make the limb itself small: size goes by the mound.
  const mound = l.on === 'street' || l.flat ? idle.box.x1 - idle.box.x0 : baseWidth(idle.frames[0], idleBox);

  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const frames = [];
  const anims = {};
  for (const c of clips) {
    const x0 = Math.round(cx - side / 2);
    const y0 = Math.round(feet + BELOW * side - side);
    c.kept = pick(c.frames, KEEP[c.anim]).map((f) => lift(resize(crop(f, x0, y0, side, side), F, F), l.flat ? 0 : LIFT));
    anims[c.anim] = { start: frames.length, count: c.kept.length, fps: Number((c.kept.length / c.seconds).toFixed(2)) };
    frames.push(...c.kept);
    if (c.loop) {
      check(`${c.anim}: loop closes`, c.loop.seam < 4, Number(c.loop.seam.toFixed(2)));
      check(`${c.anim}: it moves`, c.loop.motion > 0.1, Number(c.loop.motion.toFixed(2)));
      // An idle is calm. One that thrashes draws the eye from the fight.
      check(`${c.anim}: it is calm`, c.loop.motion < 3.5, Number(c.loop.motion.toFixed(2)));
    }
    if (c.anim === 'idle') check(`${c.anim}: inside the frame`, c.box.x0 > 2 && c.box.y0 > 2 && c.box.x1 < c.w - 2 && c.box.y1 < c.h - 2, `${c.box.x0},${c.box.y0}-${c.box.x1},${c.box.y1}`);
    const fr = fringe(c.frames[0], keyOf(c.key));
    check(`${c.anim}: no background tint on the outline`, fr < 0.05, `${(fr * 100).toFixed(1)}%`);
    const first = unionBox([c.frames[0]]);
    const last = unionBox([c.frames[c.frames.length - 1]]);
    if (c.dropped) check(`${c.anim}: frames swallowed by a flash or a cloud are few`, c.dropped <= 30, `${c.dropped} left out`);
    // A limb that drips is as big as its drop is long: its outline is allowed to change (limbs.mjs: drips).
    if (first && last && !l.drips) {
      const grew = Math.abs((last.x1 - last.x0) * (last.y1 - last.y0) / ((first.x1 - first.x0) * (first.y1 - first.y0)) - 1);
      check(`${c.anim}: ends the size it began`, grew < 0.2, `${(grew * 100).toFixed(0)}% change`);
    }
  }
  if (l.fire && !anims.fire) check('fire: exists', false, 'missing');

  const atlas = path.join(ART, 'limbs', `${family}.webp`);
  const packed = packAtlas(frames, F, COLS, atlas);
  check('atlas is under 900 KB', packed.bytes < 900 * 1024, `${Math.round(packed.bytes / 1024)} KB`);
  const entry = {
    atlas: `limbs/${family}.webp`, frame: F, cols: COLS, anchor: [0.5, 1 - BELOW],
    /** The body's width as a share of the frame's: the game scales the frame so the body fills its cell. */
    body: Number((mound / side).toFixed(3)),
    on: l.on, ...(l.flat ? { flat: true } : {}), ...(l.facing ? { facing: true } : {}),
    anims,
  };
  putEntry('limbs', family, entry);

  fs.mkdirSync(path.join(REVIEW, 'limbs'), { recursive: true });
  reviewSheet([{ label: family, anims: clips.map((c) => c.kept) }], F, path.join(REVIEW, 'limbs', `${family}.jpg`));
  const tmp = path.join(dir, 'review-frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  reviewFrames(clips.map((c) => c.kept), F, tmp, 'f');
  ffmpeg(['-framerate', '12', '-i', path.join(tmp, 'f-%04d.png'), '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30',
    path.join(REVIEW, 'limbs', `${family}.mp4`)], `${family} review film`);
  fs.rmSync(tmp, { recursive: true, force: true });

  const bad = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(REVIEW, 'limbs', `${family}.json`), `${JSON.stringify({ family, frames: frames.length, atlasKB: Math.round(packed.bytes / 1024), failed: bad.length, checks }, null, 1)}\n`);
  console.log(`[limb] ${family}: ${frames.length} frames, atlas ${Math.round(packed.bytes / 1024)} KB, ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  return { family, entry, checks };
}

export async function makeLimb(family, { bakeOnly = false } = {}) {
  const l = limb(family);
  if (!l) throw new Error(`no limb called "${family}" in tools/art/limbs.mjs`);
  const dir = path.join(SRC, 'limbs', family);
  if (!bakeOnly) {
    const place = placeOnLimbSheet(family);
    const design = path.join(dir, 'still.png');
    if (!fs.existsSync(design)) await makeLimbSheet(place.theme);
    const key = KEYS[THEMES[l.theme].key];
    const still = await makeStill({
      slug: `${family} in the creep's material`, out: path.join(dir, 'styled.png'),
      refFiles: [design, path.join(SRC, 'terrain', 'creep.png')],
      prompt: `${MATERIAL} Its one accent stays as it is: ${THEMES[l.theme].accent}.`,
      key: key.hex, keyName: key.name, quality: 'high',
    });
    const jobs = [{ anim: 'idle', prompt: l.idle + STEADY }];
    if (l.fire) jobs.push({ anim: 'fire', prompt: l.fire + (l.quiet ? QUIET : '') + STEADY });
    const results = await pool(jobs, 2, (j) => makeClip({
      slug: `${family} ${j.anim}`, out: path.join(dir, `${j.anim}.mp4`), stillFile: still,
      prompt: j.prompt, key: key.hex, keyName: key.name,
    }));
    results.forEach((r, i) => { if (!r.ok) console.warn(`[limb] ${family} ${jobs[i].anim} failed: ${r.error.message.slice(0, 160)}`); });
  }
  return bakeLimb(family);
}
