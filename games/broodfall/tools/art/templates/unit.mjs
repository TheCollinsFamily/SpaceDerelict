/**
 * THE UNIT TEMPLATE: one enemy kind from its approved design to a sprite the game loads.
 *
 *   design sheet -> the unit's figure -> five views in ONE picture -> a walking clip and an
 *   attacking clip per view -> keyed, cut to a loop, packed into an atlas -> manifest entry
 *
 * Five views are made (toward, toward-left, left, away-left, away); the three right-hand
 * views are mirror images, which gives the 8 headings. Measured Sep 29 2026: 23,700 tokens
 * ($0.47) a clip, so 125,000 tokens for a unit that walks and 245,000 for one that also attacks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { lock, makeClip, makeStill, pool } from '../rfab.mjs';
import { placeOnSheet, unit } from '../units.mjs';
import { blank, crop, paste, readFrames, readImage, resize, writePng } from '../lib/img.mjs';
import { figure, findFigures } from '../lib/sheet.mjs';
import { fringe, keyClip, keyOf, loopWindow, pick, unionBox } from '../lib/key.mjs';
import { packAtlas, reviewFrames, reviewSheet } from '../lib/atlas.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';
import { ffmpeg } from '../rfab.mjs';

export const VIEWS = ['S', 'SW', 'W', 'NW', 'N'];
const FPS = 12;
const COLS = 16;
/** Frames kept per animation and view. */
const KEEP = { walk: 14, attack: 12, death: 12 };

const EMBLEM =
  'Its one emblem is a small plain gold hexagon, the shape of a honeycomb cell. There are no crosses, no stars ' +
  'and no crescents anywhere';
const KEYS = { green: { hex: '00FF00', name: 'green' }, magenta: { hex: 'FF00FF', name: 'magenta' } };

/** Green is the proven background; anything teal, green or royal is cut off magenta instead. */
function keyFor(u) {
  if (u.caste !== 'war') return KEYS.magenta;
  return /green|teal/.test(u.look) ? KEYS.magenta : KEYS.green;
}

const GAIT = {
  walk: { noun: 'unit', heading: 'walking', caught: 'mid-stride',
    motion: 'The unit marches on the spot as if on a treadmill: its legs step in a steady gait, its arms and kit sway slightly, its body bobs.' },
  scuttle: { noun: 'creature', heading: 'scuttling', caught: 'mid-stride',
    motion: 'The creature scuttles on the spot as if on a treadmill: its legs step quickly in an alternating gait, its body bobs slightly.' },
  crew: { noun: 'unit', heading: 'walking', caught: 'mid-stride',
    motion: 'The big beetle walks on the spot as if on a treadmill, its six legs stepping slowly and heavily, and its small crew march on the spot beside it, keeping their places.' },
  ride: { noun: 'unit', heading: 'walking', caught: 'mid-stride',
    motion: 'The big beetle walks on the spot as if on a treadmill, its six legs stepping slowly and heavily, and its small rider keeps its seat, swaying with each step.' },
  fly: { noun: 'unit', heading: 'flying', caught: 'mid-wingbeat',
    motion: 'The unit hovers on the spot in the air: its wings beat fast, its body bobs gently up and down, its legs dangle.' },
};
const gaitOf = (u) => GAIT[u.gait ?? (u.body === 'human-like' ? 'walk' : u.body === 'machine' ? 'crew' : 'scuttle')];

const ATTACK = {
  shot: 'The unit stops, raises its weapon and fires three quick shots in the direction it is facing, with small bright muzzle flashes and recoil, then lowers the weapon and returns to exactly its starting pose.',
  blade: 'The unit stops and swings its glowing weapon in one wide arc at something directly in front of it, then returns to exactly its starting pose.',
  bite: 'The creature lunges a short way forward and bites, then pulls back to exactly its starting pose.',
};
function attackOf(u) {
  if (u.attackMotion) return u.attackMotion;
  if (/Fires from one cell away|Fires a dart|Shells|Lobs/.test(u.attack)) return ATTACK.shot;
  if (/Swings|Cuts|Tears|Strikes/.test(u.attack)) return ATTACK.blade;
  if (/Bites/.test(u.attack)) return ATTACK.bite;
  return null;
}

const frameSize = (u) => (u.r <= 9 ? 128 : u.r <= 13 ? 192 : 256);

const turnaroundPrompt = (u, g) =>
  `A turnaround sheet of the ONE game ${g.noun} in the reference picture, drawn five times in a single horizontal ` +
  'row, evenly spaced and not overlapping, all five at exactly the same size, in exactly the same drawing ' +
  'style as the reference: a chunky, slightly cartoonish unit sprite for a strategy game. It is the identical ' +
  `${g.noun} every time: ${u.one ?? u.look}. The same clothes, colours and kit, held the same way, the same ` +
  'proportions. Every one of the five is seen by the SAME camera: from above, tilted about 45 degrees down, ' +
  `as in the reference, so that we always see the top of it. From left to right the ${g.noun} is: ` +
  `(1) ${g.heading} straight toward the viewer, seen from the front; ` +
  `(2) ${g.heading} toward the lower left, seen from the front-left; ` +
  `(3) ${g.heading} to the left, seen from its left side; ` +
  `(4) ${g.heading} away toward the upper left, seen from behind and to the left; ` +
  `(5) ${g.heading} straight away from the viewer, seen from behind. Each is caught ${g.caught}. Even light ` +
  `from directly overhead. ${EMBLEM}. No ground, no cast shadows, no labels, no numbers, no text.`;

const STEADY = ' It never travels across the frame and never turns. It only walks: it does not fire, and there is no smoke, no sparks and no flash. The drawing style stays exactly the same in every frame.';

/** Steps 1 and 2: the unit's figure off its sheet, then five views of it. */
async function makeViews(u, dir, key) {
  const done = VIEWS.every((v) => fs.existsSync(path.join(dir, `view-${v}.png`)));
  if (done) return;
  const place = placeOnSheet(u.kind);
  if (!place) throw new Error(`${u.kind}: not on any approved sheet`);
  const sheetFile = path.join(ROOT, 'notes', 'concepts', '2026-09-29', `${place.sheet}.png`);
  const sheet = readImage(sheetFile);
  const found = findFigures(sheet, { expect: place.count });
  if (found.boxes.length !== place.count) throw new Error(`${u.kind}: ${found.boxes.length} figures on ${place.sheet}, ${place.count} expected`);
  const ref = path.join(dir, 'ref.png');
  writePng(ref, resize(figure(sheet, found.boxes[place.index], found), 1024, 1024));

  const g = gaitOf(u);
  const turn = await makeStill({
    slug: `${u.kind} views`, out: path.join(dir, 'turnaround.png'), refFile: ref,
    prompt: turnaroundPrompt(u, g), key: key.hex, keyName: key.name, width: 1536, height: 1024,
  });
  const img = readImage(turn);
  const five = findFigures(img, { expect: 5 });
  if (five.boxes.length !== 5) {
    throw new Error(`${u.kind}: ${five.boxes.length} figures on the turnaround, 5 expected. Look at ${turn}; delete it to draw again.`);
  }
  // One square size for all five, so their sizes relative to each other are kept.
  const side = Math.ceil(Math.max(...five.boxes.map((b) => Math.max(b.x1 - b.x0, b.y1 - b.y0))) * 1.5);
  const bg = five.bg;
  five.boxes.forEach((b, i) => writePng(path.join(dir, `view-${VIEWS[i]}.png`), resize(figure(img, b, five, 0, side), 1024, 1024)));
  // All five side by side, to look at before any clip is paid for.
  const strip = blank(5 * 256, 256, [bg[0], bg[1], bg[2], 255]);
  five.boxes.forEach((b, i) => paste(strip, resize(figure(img, b, five, 0, side), 256, 256), i * 256, 0));
  writePng(path.join(dir, 'views.png'), strip);
}

/** Step 3: the clips. */
async function makeClips(u, dir, key, anims) {
  const g = gaitOf(u);
  const jobs = [];
  for (const v of VIEWS) {
    const still = path.join(dir, `view-${v}.png`);
    jobs.push({ v, anim: 'walk', still, prompt: g.motion + STEADY });
    const a = attackOf(u);
    if (a && anims.includes('attack')) jobs.push({ v, anim: 'attack', still, prompt: `${a} It does not walk and does not turn. The drawing style stays exactly the same in every frame.` });
  }
  if (anims.includes('death')) {
    jobs.push({ v: 'SW', anim: 'death', still: path.join(dir, 'view-SW.png'), loop: false,
      prompt: `The ${g.noun} is struck, staggers, collapses onto the ground and lies still. It stays where it fell. The camera is completely locked: no zoom, no pan, no cuts. The solid pure ${key.name} #${key.hex} background stays flat and empty.`, raw: true });
  }
  const results = await pool(jobs, 5, (j) => makeClip({
    slug: `${u.kind} ${j.anim} ${j.v}`, out: path.join(dir, `${j.anim}-${j.v}.mp4`), stillFile: j.still,
    prompt: j.prompt, key: key.hex, keyName: key.name, loop: j.loop !== false, raw: j.raw,
  }));
  const failed = results.map((r, i) => (r.ok ? null : `${jobs[i].anim} ${jobs[i].v}: ${r.error.message.slice(0, 160)}`)).filter(Boolean);
  if (failed.length) console.warn(`[unit] ${u.kind}: ${failed.length} clip(s) failed:\n  ${failed.join('\n  ')}`);
}

/** Step 4: clips to an atlas, a manifest entry, the checks and the review pictures. Free. */
export function bakeUnit(kind) {
  const u = unit(kind);
  const dir = path.join(SRC, 'units', kind);
  const F = frameSize(u);
  const clips = [];
  for (const anim of ['walk', 'attack', 'death']) {
    for (const v of VIEWS) {
      const file = path.join(dir, `${anim}-${v}.mp4`);
      if (!fs.existsSync(file)) continue;
      const keyed = keyClip(readFrames(file, FPS));
      let frames = keyed.frames;
      let loop = null;
      if (anim === 'walk') { loop = loopWindow(frames); frames = frames.slice(loop.start, loop.end); }
      clips.push({ anim, v, frames, box: unionBox(frames), loop, key: keyed.key, w: keyed.w, h: keyed.h, seconds: frames.length / FPS });
    }
  }
  const walks = clips.filter((c) => c.anim === 'walk');
  if (!walks.length) throw new Error(`${kind}: no walking clips to bake in ${dir}`);

  // Every animation of a view shares that view's centre line and feet line, taken from its
  // walk, so the unit does not jump when it stops walking to attack.
  const base = Object.fromEntries(walks.map((c) => [c.v, { cx: (c.box.x0 + c.box.x1) / 2, feet: c.box.y1 }]));
  const BELOW = 0.06;
  // The frame is sized by the WALK, with room to raise a weapon. What an attack throws
  // beyond that (shots, flashes, smoke) is cut off: the game draws those itself.
  let side = 0;
  for (const c of walks) {
    const b = base[c.v];
    const halfW = Math.max(b.cx - c.box.x0, c.box.x1 - b.cx);
    side = Math.max(side, 2 * halfW, (b.feet - c.box.y0) / (1 - BELOW));
  }
  side = Math.ceil(side * 1.3);

  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const frames = [];
  const anims = {};
  const rows = [];
  for (const c of clips) {
    const b = base[c.v] ?? base.SW;
    const x0 = Math.round(b.cx - side / 2);
    const y0 = Math.round(b.feet + BELOW * side - side);
    const kept = pick(c.frames, KEEP[c.anim]).map((f) => resize(crop(f, x0, y0, side, side), F, F));
    (anims[c.anim] ??= {})[c.v] = { start: frames.length, count: kept.length, fps: Number((kept.length / c.seconds).toFixed(2)) };
    frames.push(...kept);
    c.kept = kept;

    const tag = `${c.anim} ${c.v}`;
    if (c.loop) {
      check(`${tag}: loop closes`, c.loop.seam < 4, Number(c.loop.seam.toFixed(2)));
      check(`${tag}: it moves`, c.loop.motion > 0.6, Number(c.loop.motion.toFixed(2)));
      check(`${tag}: loop is long enough`, c.loop.end - c.loop.start >= 10, c.loop.end - c.loop.start);
    }
    if (c.anim === 'walk') check(`${tag}: inside the frame`, c.box.x0 > 2 && c.box.y0 > 2 && c.box.x1 < c.w - 2 && c.box.y1 < c.h - 2, `${c.box.x0},${c.box.y0}-${c.box.x1},${c.box.y1}`);
    const fr = fringe(c.frames[0], keyOf(c.key));
    check(`${tag}: no background tint on the outline`, fr < 0.05, `${(fr * 100).toFixed(1)}%`);
    // It must stay on the spot: the first and the last frame of a loop share a centre.
    const first = unionBox([c.frames[0]]);
    const last = unionBox([c.frames[c.frames.length - 1]]);
    if (c.anim !== 'death' && first && last) {
      const drift = Math.abs((first.x0 + first.x1) / 2 - (last.x0 + last.x1) / 2) / side;
      check(`${tag}: stays on the spot`, drift < 0.06, `${(drift * 100).toFixed(1)}% of the frame`);
    }
  }
  for (const v of VIEWS) if (!anims.walk?.[v]) check(`walk ${v}: exists`, false, 'missing');
  // Views of one unit must be one size: compare how much of the frame each one fills.
  const fill = walks.map((c) => Math.max(c.box.x1 - c.box.x0, c.box.y1 - c.box.y0) / side);
  check('views are one size', Math.max(...fill) / Math.min(...fill) < 1.6, fill.map((f) => f.toFixed(2)).join(' '));

  const atlas = path.join(ART, 'units', `${kind}.webp`);
  const packed = packAtlas(frames, F, COLS, atlas);
  check('atlas is under 900 KB', packed.bytes < 900 * 1024, `${Math.round(packed.bytes / 1024)} KB`);

  // How big to draw it: the game gives the unit a radius; the frame is that much wider than the body.
  const bodyW = walks.map((c) => (c.box.x1 - c.box.x0) / side).sort((a, b) => a - b)[walks.length >> 1];
  const entry = {
    atlas: `units/${kind}.webp`, frame: F, cols: COLS,
    anchor: [0.5, Number((1 - BELOW).toFixed(3))],
    /** The body's width as a share of the frame's: the game scales the frame so the body matches the unit's radius. */
    body: Number(bodyW.toFixed(3)),
    flies: u.gait === 'fly' || /drawn in the air/.test(u.look),
    anims,
  };
  putEntry('units', kind, entry);

  for (const v of VIEWS) {
    const a = ['walk', 'attack'].map((n) => clips.find((c) => c.anim === n && c.v === v)?.kept).filter(Boolean);
    if (a.length) rows.push({ label: v, anims: a });
  }
  fs.mkdirSync(path.join(REVIEW, 'units'), { recursive: true });
  const sheet = reviewSheet(rows, F, path.join(REVIEW, 'units', `${kind}.jpg`));
  // A film of all eight headings walking, over street and over creep.
  const eight = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'].map((h) => {
    const src = { NE: 'NW', E: 'W', SE: 'SW' }[h];
    const kept = clips.find((c) => c.anim === 'walk' && c.v === (src ?? h))?.kept ?? [];
    return src ? kept.map((f) => { const m = blank(F, F); for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) f.data.copy(m.data, (y * F + (F - 1 - x)) * 4, (y * F + x) * 4, (y * F + x + 1) * 4); return m; }) : kept;
  }).filter((k) => k.length);
  const tmp = path.join(dir, 'review-frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  reviewFrames(eight, F, tmp, 'f');
  const film = path.join(REVIEW, 'units', `${kind}.mp4`);
  ffmpeg(['-framerate', '12', '-i', path.join(tmp, 'f-%04d.png'), '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', film], `${kind} review film`);
  fs.rmSync(tmp, { recursive: true, force: true });

  const bad = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(REVIEW, 'units', `${kind}.json`), `${JSON.stringify({ kind, frames: frames.length, atlasKB: Math.round(packed.bytes / 1024), failed: bad.length, checks }, null, 1)}\n`);
  console.log(`[unit] ${kind}: ${frames.length} frames, atlas ${Math.round(packed.bytes / 1024)} KB, ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  return { kind, entry, checks, sheet, film };
}

export async function makeUnit(kind, { anims = ['walk'], bakeOnly = false, viewsOnly = false } = {}) {
  const u = unit(kind);
  if (!u) throw new Error(`no unit called "${kind}" in tools/art/units.mjs`);
  const dir = path.join(SRC, 'units', kind);
  fs.mkdirSync(dir, { recursive: true });
  if (!bakeOnly) {
    const key = keyFor(u);
    await makeViews(u, dir, key);
    if (viewsOnly) return { kind, views: path.join(dir, 'turnaround.png') };
    await makeClips(u, dir, key, anims);
  }
  return bakeUnit(kind);
}

export { lock };
