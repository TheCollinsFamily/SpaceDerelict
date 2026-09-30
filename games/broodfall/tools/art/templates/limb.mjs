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
import { AWAY, BACK, LIMB_SHEETS, MATERIAL, QUIET, THEMES, WITHER, limb, placeOnLimbSheet } from '../limbs.mjs';
import { blank, crop, flipX, over, paste, readFrames, readImage, resize, writeJpg, writePng } from '../lib/img.mjs';
import { figure, findFigures } from '../lib/sheet.mjs';
import { dropSpecks, fringe, keyClip, keyOf, loopWindow, pick, unionBox } from '../lib/key.mjs';
import { GROUNDS, packAtlas, reviewFrames, reviewSheet } from '../lib/atlas.mjs';
import { FILL, drawCell, footingOf, markOf, spill } from '../lib/foot.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';

const FPS = 12;
/** Frames kept of each clip; a BIG limb keeps two fewer of its death (its frames are twice the pixels, and a withering is slow). */
const KEEP = { idle: 16, fire: 14, die: 10 };
/** The side of a frame, and how many frames across its atlas is: of a limb of one cell, and of a BIG limb, which is drawn two cells wide and would be seen soft at the same size. */
const FRAME = { small: [256, 16], big: [384, 8] };
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
 * The light on a limb: brighter toward its top, untouched from the ground it stands on
 * down. Its foot is the creep's own colour and melts into it; its head stands out from the
 * ground behind it. `ground`: where it stands, as a share of the picture's height.
 */
function lift(img, by, ground) {
  if (!by) return img;
  for (let y = 0; y < img.h; y++) {
    const t = Math.max(0, Math.min(1, (ground - 0.06 - y / img.h) / 0.62));
    const k = 1 + by * t * t * (3 - 2 * t);
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      if (!img.data[i + 3]) continue;
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.min(255, Math.round(img.data[i + c] * k));
    }
  }
  return img;
}

/** `count` frames evenly from a list, the last among them (a death ends on its husk). */
const pickToEnd = (frames, count) => (frames.length <= count ? frames.slice()
  : Array.from({ length: count }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (count - 1))]));

/**
 * WHERE A DONOR'S PART IS GRAFTED (Sep 30 2026, DESIGN.md: "a spitter built from a cannibalized
 * burster has the burster's sacs hanging off it"): points on the outline of the limb at rest,
 * as shares of its frame, in the order they are used: right and left a little above its
 * footing, its crown, then right and left higher up. Each is a little inside the outline, so
 * that a part drawn behind the limb grows out from under its edge.
 */
function graftsOf(img, anchor, F) {
  const solid = (x, y) => img.data[(y * img.w + x) * 4 + 3] > 128;
  let top = img.h;
  for (let y = 0; y < img.h && top === img.h; y++) for (let x = 0; x < img.w; x++) if (solid(x, y)) { top = y; break; }
  const foot = Math.round(anchor[1] * F);
  const row = (share) => {
    const y = Math.round(foot - (foot - top) * share);
    let l = -1, r = -1;
    for (let x = 0; x < img.w; x++) if (solid(x, y)) { if (l < 0) l = x; r = x; }
    return { y, l, r };
  };
  const inset = F * 0.04;
  const out = [];
  const low = row(0.42);
  const high = row(0.72);
  const at = (x, y) => [Number((x / F).toFixed(3)), Number((y / F).toFixed(3))];
  if (low.l >= 0) out.push(at(low.r - inset, low.y), at(low.l + inset, low.y));
  let cx = 0, n = 0;
  for (let x = 0; x < img.w; x++) if (solid(x, top + 3)) { cx += x; n++; }
  if (n) out.push(at(cx / n, top + (foot - top) * 0.12));
  if (high.l >= 0) out.push(at(high.r - inset, high.y), at(high.l + inset, high.y));
  return out;
}

/** How much colour its solid pixels have, on average (the reach of the strongest channel over the weakest). */
const colour = (f) => {
  let sum = 0, n = 0;
  for (let i = 0; i < f.data.length; i += 4) {
    if (f.data[i + 3] < 128) continue;
    sum += Math.max(f.data[i], f.data[i + 1], f.data[i + 2]) - Math.min(f.data[i], f.data[i + 1], f.data[i + 2]);
    n++;
  }
  return n ? sum / n : 0;
};

/** How many pixels of a frame are solid. */
const area = (f) => { let n = 0; for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 128) n++; return n; };

/**
 * One view of a limb (from the front, or from behind): its clips keyed, cut to a loop and
 * brought to frames that all put the middle of what it stands on at the same point.
 */
function bakeView(l, dir, view, check, F) {
  const pre = view === 'back' ? 'back-' : '';
  const say = view === 'back' ? 'from behind, ' : '';
  const clips = [];
  let first = null;
  for (const anim of ['idle', 'fire', 'die']) {
    const file = path.join(dir, `${pre}${anim}.mp4`);
    if (!fs.existsSync(file)) continue;
    const keyed = keyClip(readFrames(file, FPS));
    // A drop that falls from it is part of a limb that drips; of any other, a speck the video model threw.
    if (!l.drips) for (const f of keyed.frames) dropSpecks(f);
    let frames = keyed.frames;
    let loop = null;
    let dropped = 0;
    if (anim === 'idle') {
      first = keyed.frames[0];
      loop = loopWindow(frames, { min: 16, max: 46 });
      frames = frames.slice(loop.start, loop.end);
    } else if (anim === 'fire') {
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
  if (!idle) return null;

  // WHERE IT STANDS: marked by eye on the first frame of its idle clip (tools/art/feet.mjs).
  const foot = footingOf(l, first, unionBox([first]), view);
  check(`${say}where it stands is marked`, foot.marked, foot.marked ? `${markOf(foot, unionBox([first])).join(', ')}` : `not marked: node tools/art/feet.mjs ${view === 'back' ? '--back ' : ''}${l.family}`);

  // The frame holds all of it at rest, and of what a firing limb throws out (a lash, a
  // stretched neck) as much as fits in 1.6 times that: beyond, the limb itself would be small.
  const reach = (box) => ({ side: Math.max(foot.x - box.x0, box.x1 - foot.x), up: foot.y - box.y0, down: box.y1 - foot.y });
  const rest = reach(idle.box);
  const room = { ...rest };
  for (const c of clips) {
    const r = reach(c.box);
    room.side = Math.max(room.side, Math.min(r.side, rest.side * 1.6));
    room.up = Math.max(room.up, Math.min(r.up, rest.up * 1.6));
    room.down = Math.max(room.down, Math.min(r.down, rest.down * 1.6));
  }
  const side = Math.ceil(Math.max(2 * room.side, room.up + room.down) * 1.06);
  const x0 = Math.round(foot.x - side / 2);
  const y0 = Math.round(foot.y - room.up - (side - (room.up + room.down)) / 2);
  const anchor = [0.5, Number(((foot.y - y0) / side).toFixed(4))];
  const body = Number(((2 * foot.a) / side).toFixed(3));

  const frames = [];
  const anims = {};
  for (const c of clips) {
    c.kept = (c.anim === 'die' ? pickToEnd(c.frames, l.big ? KEEP.die - 2 : KEEP.die) : pick(c.frames, KEEP[c.anim])).map((f) => lift(resize(crop(f, x0, y0, side, side), F, F), l.flat ? 0 : LIFT, anchor[1]));
    anims[c.anim] = { start: frames.length, count: c.kept.length, fps: Number((c.kept.length / c.seconds).toFixed(2)) };
    frames.push(...c.kept);
    if (c.loop) {
      check(`${say}${c.anim}: loop closes`, c.loop.seam < 4, Number(c.loop.seam.toFixed(2)));
      check(`${say}${c.anim}: it moves`, c.loop.motion > 0.1, Number(c.loop.motion.toFixed(2)));
      // An idle is calm. One that thrashes draws the eye from the fight.
      check(`${say}${c.anim}: it is calm`, c.loop.motion < 3.5, Number(c.loop.motion.toFixed(2)));
    }
    if (c.anim === 'idle') check(`${say}${c.anim}: inside the frame`, c.box.x0 > 2 && c.box.y0 > 2 && c.box.x1 < c.w - 2 && c.box.y1 < c.h - 2, `${c.box.x0},${c.box.y0}-${c.box.x1},${c.box.y1}`);
    const fr = fringe(c.frames[0], keyOf(c.key));
    check(`${say}${c.anim}: no background tint on the outline`, fr < 0.05, `${(fr * 100).toFixed(1)}%`);
    const a = unionBox([c.frames[0]]);
    const z = unionBox([c.frames[c.frames.length - 1]]);
    if (c.dropped) check(`${say}${c.anim}: frames swallowed by a flash or a cloud are few`, c.dropped <= 30, `${c.dropped} left out`);
    // A limb that drips is as big as its drop is long: its outline is allowed to change (limbs.mjs: drips).
    if (c.anim === 'die') {
      // A death ends as a husk, not the limb standing: smaller, or drained of its colour (a flat
      // limb spreads its dead roots as it dries, and is no smaller).
      const shrank = area(c.frames[c.frames.length - 1]) / Math.max(1, area(c.frames[0]));
      const drained = colour(c.frames[c.frames.length - 1]) / Math.max(1, colour(c.frames[0]));
      check(`${say}die: it ends as a husk`, shrank < 0.85 || drained < 0.7, `${(shrank * 100).toFixed(0)}% of its size, ${(drained * 100).toFixed(0)}% of its colour`);
    } else if (a && z && !l.drips) {
      const grew = Math.abs((z.x1 - z.x0) * (z.y1 - z.y0) / ((a.x1 - a.x0) * (a.y1 - a.y0)) - 1);
      check(`${say}${c.anim}: ends the size it began`, grew < 0.2, `${(grew * 100).toFixed(0)}% change`);
    }
  }
  // It stands IN its cell: little of it lies in front of the cell's two front edges. What
  // does is drawn over whatever is in front of it (a street, a lower roof).
  if (!l.flat && l.on !== 'street') {
    const out = spill(idle.kept[0], anchor[0] * F, anchor[1] * F, (body * F) / 2 / FILL);
    check(`${say}it stands in its cell`, out < 0.12, `${(out * 100).toFixed(1)}% of it lies in front of its cell`);
  }
  return { view, anchor, body, anims, frames, kept: clips.map((c) => c.kept), grafts: graftsOf(idle.kept[0], anchor, F) };
}

/** Steps 2 and 3, free: clips to an atlas, a manifest entry, the checks and the review pictures. */
export function bakeLimb(family) {
  const l = limb(family);
  const dir = path.join(SRC, 'limbs', family);
  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const [F, COLS] = l.big ? FRAME.big : FRAME.small;
  const front = bakeView(l, dir, 'front', check, F);
  if (!front) throw new Error(`${family}: no idle clip to bake in ${dir}`);
  const back = bakeView(l, dir, 'back', check, F);
  if (l.back) check('from behind: it has a view', !!back, back ? 'drawn' : `missing: node tools/art/make.mjs limb ${family}`);
  if (l.fire && !front.anims.fire) check('fire: exists', false, 'missing');
  if (!front.anims.die) check('die: exists', false, `missing: node tools/art/make.mjs limb ${family}`);

  // One atlas: the front view's frames, then the frames of the view from behind.
  const frames = [...front.frames, ...(back ? back.frames : [])];
  const shift = (anims, by) => Object.fromEntries(Object.entries(anims).map(([k, c]) => [k, { ...c, start: c.start + by }]));
  const atlas = path.join(ART, 'limbs', `${family}.webp`);
  // A big limb has more than twice the pixels: it is packed a little harder, to stay as light to load.
  const packed = packAtlas(frames, F, COLS, atlas, l.big ? 76 : 86);
  check('atlas is under 900 KB', packed.bytes < 900 * 1024, `${Math.round(packed.bytes / 1024)} KB`);
  const entry = {
    atlas: `limbs/${family}.webp`, frame: F, cols: COLS,
    /** The point of the frame that stands on the middle of its cell: the middle of what the limb stands on. */
    anchor: front.anchor,
    /** The width of what it stands on, as a share of the frame's: the game scales the frame so that this fills its cell. */
    body: front.body,
    on: l.on, ...(l.flat ? { flat: true } : {}), ...(l.facing ? { facing: true } : {}), ...(l.big ? { big: true } : {}),
    anims: front.anims,
    grafts: front.grafts,
    ...(back ? { back: { anchor: back.anchor, body: back.body, anims: shift(back.anims, front.frames.length), grafts: back.grafts } } : {}),
  };
  putEntry('limbs', family, entry);

  fs.mkdirSync(path.join(REVIEW, 'limbs'), { recursive: true });
  const rows = [{ label: family, anims: front.kept }];
  if (back) rows.push({ label: `${family} from behind`, anims: back.kept });
  reviewSheet(rows, F, path.join(REVIEW, 'limbs', `${family}.jpg`));
  standing(family, [front, back].filter(Boolean), F);
  const tmp = path.join(dir, 'review-frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  reviewFrames([...front.kept, ...(back ? back.kept : [])], F, tmp, 'f');
  ffmpeg(['-framerate', '12', '-i', path.join(tmp, 'f-%04d.png'), '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30',
    path.join(REVIEW, 'limbs', `${family}.mp4`)], `${family} review film`);
  fs.rmSync(tmp, { recursive: true, force: true });

  const bad = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(REVIEW, 'limbs', `${family}.json`), `${JSON.stringify({ family, frames: frames.length, atlasKB: Math.round(packed.bytes / 1024), failed: bad.length, checks }, null, 1)}\n`);
  console.log(`[limb] ${family}: ${frames.length} frames${back ? ' (two views)' : ''}, atlas ${Math.round(packed.bytes / 1024)} KB, ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  return { family, entry, checks };
}

/**
 * A picture of the limb standing in its cell, as the game will place it: every way it can
 * face (its two views, and those mirrored), with the cell drawn under it.
 */
function standing(family, views, F) {
  const S = 256;
  const tiles = [];
  for (const v of views) for (const mirror of [false, true]) {
    const tile = blank(S, S, [...GROUNDS.creep, 255]);
    const half = (v.body * F) / 2 / FILL;
    const k = (S * 0.34) / half;
    const w = Math.round(F * k);
    let img = resize(v.kept[0][0], w, w);
    if (mirror) img = flipX(img);
    const gx = S / 2;
    const gy = S * 0.7;
    drawCell(tile, gx, gy, half * k, [255, 255, 255], 0.75);
    over(tile, img, Math.round(gx - (mirror ? 1 - v.anchor[0] : v.anchor[0]) * w), Math.round(gy - v.anchor[1] * w));
    tiles.push(tile);
  }
  const sheet = blank(tiles.length * S, S, [24, 24, 24, 255]);
  tiles.forEach((t, i) => paste(sheet, t, i * S, 0));
  fs.mkdirSync(path.join(REVIEW, 'limbs'), { recursive: true });
  writeJpg(path.join(REVIEW, 'limbs', `${family}-standing.jpg`), sheet, 3);
}

/**
 * The view from behind of a limb that is not the same all the way round: one picture drawn
 * from its front view, then the same clips. `stillsOnly`: stop after the picture, so that it
 * can be looked at before two clips are made of it.
 */
async function makeBack(l, dir, key, stillsOnly) {
  const front = path.join(dir, 'styled.png');
  if (!l.back || !fs.existsSync(front)) return;
  const still = await makeStill({
    slug: `${l.family} from behind`, out: path.join(dir, 'back.png'), refFiles: [front],
    prompt: `${BACK} ${l.back} Its one accent stays as it is: ${THEMES[l.theme].accent}.`,
    key: key.hex, keyName: key.name, quality: 'high',
  });
  if (stillsOnly) return;
  const jobs = [{ anim: 'idle', prompt: l.idle + AWAY + STEADY }];
  if (l.fire) jobs.push({ anim: 'fire', prompt: l.fire + AWAY + (l.quiet ? QUIET : '') + STEADY });
  const results = await pool(jobs, 2, (j) => makeClip({
    slug: `${l.family} from behind, ${j.anim}`, out: path.join(dir, `back-${j.anim}.mp4`), stillFile: still,
    prompt: j.prompt, key: key.hex, keyName: key.name,
  }));
  results.forEach((r, i) => { if (!r.ok) console.warn(`[limb] ${l.family} from behind, ${jobs[i].anim} failed: ${r.error.message.slice(0, 160)}`); });
}

export async function makeLimb(family, { bakeOnly = false, stillsOnly = false } = {}) {
  const l = limb(family);
  if (!l) throw new Error(`no limb called "${family}" in tools/art/limbs.mjs`);
  const dir = path.join(SRC, 'limbs', family);
  if (stillsOnly) {
    await makeBack(l, dir, KEYS[THEMES[l.theme].key], true);
    return { family, checks: [] };
  }
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
    // Its death: it does not loop, and the usual lock ("the same size the whole time") is not said.
    jobs.push({ anim: 'die', prompt: `${WITHER} The solid pure ${key.name} #${key.hex} background stays flat and empty.`, loop: false, raw: true });
    const results = await pool(jobs, 3, (j) => makeClip({
      slug: `${family} ${j.anim}`, out: path.join(dir, `${j.anim}.mp4`), stillFile: still,
      prompt: j.prompt, key: key.hex, keyName: key.name, loop: j.loop ?? true, raw: j.raw ?? false,
    }));
    results.forEach((r, i) => { if (!r.ok) console.warn(`[limb] ${family} ${jobs[i].anim} failed: ${r.error.message.slice(0, 160)}`); });
    await makeBack(l, dir, key, false);
  }
  return bakeLimb(family);
}
