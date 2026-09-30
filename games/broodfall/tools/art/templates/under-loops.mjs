/**
 * THE ORGAN STAGE, ALIVE (Collins, Sep 30 2026: "should the organ screen have them alive? ... you
 * know what, yeah, it's super easy since it's only one video per object"). Every scan tile of an
 * organ (templates/under.mjs), the meteor's scan picture per core stage (templates/core-evo.mjs,
 * makeCoreScan) and the deposits and features get one seamless looping clip made from the still
 * itself (image to video, END frame = START frame): subtle living motion inside the scan, camera
 * locked. The stills are never touched: the clips go to art-src/under-loops/.
 *
 * Baked to ONE horizontal strip of frames per tile (public/art/under/loop-<id>.webp), played by the
 * game as a CSS sprite animation (background-position-x in steps): no <video> per cell, and the
 * meteor's strip is cut at the same ground line as its still, so the dome above the street and the
 * cells below it play the same frame.
 *
 *   node tools/art/make.mjs underloops [ids...]            the clips that are missing, then the bake
 *   node tools/art/make.mjs underloops --bake              bake again (free)
 *   node tools/art/make.mjs underloops heart --reroll      move heart's clip to rejected/ and make it again
 *
 * Manifest: under.loops = { fps, frame, tiles: { <id>: { strip, count, pingpong } }, stages: { <n>: {...} } }.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, pool } from '../rfab.mjs';
import { blank, crop, paste, readFrames, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { ART, REVIEW, SRC, putEntry, readManifest } from '../lib/manifest.mjs';

const STILLS = path.join(SRC, 'under');
const DIR = path.join(SRC, 'under-loops');
const OUT = path.join(ART, 'under');

/** What moves in each tile. Organ ids are those of content/underground.ts. */
export const MOTION = {
  forge: 'the bone struts glint and a warm glow pulses slowly through the marrow inside them',
  venom: 'the round glands swell and relax slowly like breathing, and the drip trembles',
  gut: 'slow waves of peristalsis ripple along the coiled intestine',
  nerve: 'faint sparks of light run along the nerve cords and the bright node flickers',
  lattice: 'the thin mucus strands sway very slightly and shimmer',
  womb: 'the eggs swell softly and the membrane breathes in and out',
  marrow: 'the amber glow in the honeycomb chambers pulses slowly',
  resonance: 'the concentric rings of the membrane ripple outward gently like a drum skin humming',
  heart: 'the heart muscle beats in a slow steady heartbeat and the vessels throb with it',
  brain: 'the folded tissue pulses faintly and tiny sparks flicker along the blood vessels',
  gland: 'the gland swells and relaxes slowly and the ooze glistens',
  atrophy: 'the withered tissue barely moves, only a faint dim flicker of its glow',
  root: 'the root hairs twitch slightly and a dull pulse runs along the root',
  bladder: 'the bladder breathes in and out slowly and the spores inside drift',
  pacemaker: 'the knot of muscle fibres contracts in a steady rhythm, each beat a pulse of light',
  budder: 'the buds sway gently as if in a slow current',
  cyst: 'the cyst pulses slowly and the three seeds inside shift very slightly',
  swell: 'the blister of tissue swells and relaxes slowly',
  catapult: 'the twisted sinews tighten and slacken slightly, straining under tension',
  mire: 'slow bubbles rise in the slime and pop',
  acid: 'the acid lining shimmers and tiny bubbles fizz in its pits',
  runner: 'waves of contraction run along the muscle tube from one edge to the other',
  scaffold: 'a faint glow pulses slowly through the bone struts',
  seeder: 'the rings of muscle round the launch tube pulse and the seed inside glows brighter and dimmer',
  // ---- the dig and the features (the soil and the rock stay still)
  carrion: 'the buried flesh glows brighter and dimmer slowly, like embers',
  seam: 'the bands of compressed flesh glow brighter and dimmer slowly, like embers',
  lab: 'the glassware glints and a faint light flickers in the chamber',
  bed: 'the fungus threads glow and fade slowly in waves',
  ossuary: 'a faint golden glow breathes in the vault',
  cache: 'the crystal capsules glow and fade slowly and the fibres inside shimmer',
  vent: 'the heat plume rises and wavers',
  aquifer: 'the water ripples gently',
  cable: 'the cut cable sparks and flickers',
  sewer: 'the sludge in the pipe churns slowly',
};

const CORE = 'the red heart of muscle beats slowly and pulses of light run out along the red veins through the rock';

const prompt = (motion) =>
  'This picture is one still frame of a holographic ground-penetrating scan display on a spaceship console. ' +
  `Animate it with subtle, slow, living motion inside the scan: ${motion}. The false-colour glow brightens and ` +
  'dims gently. Everything stays exactly where it is, at the same size, in the same flat scan rendering, lit the ' +
  'same way. The camera is completely locked: no zoom, no pan, no rotation, no cuts, no shake. Nothing new ' +
  'appears: no text, no letters, no numbers, no symbols, no frame, no border. The background stays near-black.';

const FPS = 12;
const FRAME = 128;
const STAGE_W = 320;

const clipOf = (id) => path.join(DIR, `${id}.mp4`);

export async function makeUnderLoops({ only = [], bakeOnly = false, reroll = false } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  if (!bakeOnly) {
    const want = (id) => !only.length || only.includes(id);
    const jobs = [];
    for (const [id, motion] of Object.entries(MOTION)) {
      const still = path.join(STILLS, `${id}.png`);
      if (!want(id) || !fs.existsSync(still)) continue;
      jobs.push({ id, still, prompt: prompt(motion) });
    }
    for (const n of [1, 2, 3, 4]) {
      const id = `core-stage-${n}`;
      const still = path.join(STILLS, `${id}.png`);
      if (!want(id) || !fs.existsSync(still)) continue;
      jobs.push({ id, still, prompt: prompt(CORE) });
    }
    if (reroll) for (const j of jobs) {
      if (!fs.existsSync(clipOf(j.id))) continue;
      fs.mkdirSync(path.join(DIR, 'rejected'), { recursive: true });
      const stamp = Date.now();
      fs.renameSync(clipOf(j.id), path.join(DIR, 'rejected', `${j.id}-${stamp}.mp4`));
    }
    const results = await pool(jobs, 4, (j) => makeClip({
      slug: `scan loop ${j.id}`, stillFile: j.still, out: clipOf(j.id), prompt: j.prompt, raw: true,
      seconds: 4, resolution: '480p', aspect: '1:1', loop: true,
    }));
    results.forEach((r, i) => { if (!r.ok) console.warn(`[under-loops] ${jobs[i].id} failed: ${r.error.message.slice(0, 200)}`); });
  }
  return bakeUnderLoops();
}

/** Mean change per pixel (0-255) between two RGBA frames of the same size. */
function diff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 16) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return s / (a.length / 16) / 3;
}

/**
 * The clip's frames at FPS, trimmed to its loop: the seam (last -> first) no bigger than a step.
 * A clip whose END came back to its start loops forward; one that did not plays forward and back.
 */
function loopFrames(file) {
  const { w, h, frames } = readFrames(file, FPS);
  const img = (f) => ({ w, h, data: Buffer.from(f) });
  // The last frame or two of a start=end clip is usually the still itself again: drop exact repeats of frame 0.
  let end = frames.length;
  while (end > 8 && diff(frames[end - 1], frames[0]) < 0.4) end--;
  const kept = frames.slice(0, end);
  const steps = [];
  for (let i = 0; i < kept.length - 1; i++) steps.push(diff(kept[i], kept[i + 1]));
  const step = steps.reduce((a, b) => a + b, 0) / Math.max(1, steps.length);
  const seam = diff(kept[kept.length - 1], kept[0]);
  const pingpong = seam > 2 * step;
  let drift = 0;
  for (const f of kept) drift = Math.max(drift, diff(f, kept[0]));
  return { frames: kept.map(img), step, seam, pingpong, drift };
}

function strip(frames, fw, fh) {
  const out = blank(fw * frames.length, fh, [0, 0, 0, 255]);
  frames.forEach((f, i) => paste(out, resize(f, fw, fh), i * fw, 0));
  return out;
}

export function bakeUnderLoops() {
  fs.mkdirSync(OUT, { recursive: true });
  const tiles = {};
  const stages = {};
  const report = [];
  const sheetRows = [];
  for (const id of Object.keys(MOTION)) {
    if (!fs.existsSync(clipOf(id))) continue;
    const l = loopFrames(clipOf(id));
    const png = path.join(OUT, `loop-${id}.png`);
    writePng(png, strip(l.frames, FRAME, FRAME));
    toWebp(png, path.join(OUT, `loop-${id}.webp`), { q: 80 });
    fs.rmSync(png);
    tiles[id] = { strip: `under/loop-${id}.webp`, count: l.frames.length, ...(l.pingpong ? { pingpong: true } : {}) };
    report.push({ id, ...l, frames: l.frames.length });
    sheetRows.push(l.frames);
  }
  const core = readManifest().under?.core?.stages ?? [];
  for (const s of core) {
    const id = `core-stage-${s.id}`;
    if (!fs.existsSync(clipOf(id))) continue;
    const l = loopFrames(clipOf(id));
    // Cut exactly as bakeCoreScan cut the still: the whole width, down to `aspect` (width over height).
    const W = l.frames[0].w;
    const cutH = Math.min(l.frames[0].h, Math.round(W / s.aspect));
    const cut = l.frames.map((f) => crop(f, 0, 0, W, cutH, [0, 0, 0, 255]));
    const fh = Math.round(STAGE_W / s.aspect);
    const png = path.join(OUT, `loop-${id}.png`);
    writePng(png, strip(cut, STAGE_W, fh));
    toWebp(png, path.join(OUT, `loop-${id}.webp`), { q: 82 });
    fs.rmSync(png);
    stages[s.id] = { strip: `under/loop-${id}.webp`, count: cut.length, ...(l.pingpong ? { pingpong: true } : {}) };
    report.push({ id, ...l, frames: cut.length });
    sheetRows.push(l.frames);
  }
  putEntry('under', 'loops', { fps: FPS, frame: FRAME, tiles, stages });
  // To look at: every clip, 8 frames across its loop, one row each.
  if (sheetRows.length) {
    const S = 128;
    const sheet = blank(8 * S, sheetRows.length * S, [0, 0, 0, 255]);
    sheetRows.forEach((fr, r) => {
      for (let k = 0; k < 8; k++) paste(sheet, resize(fr[Math.floor((k * fr.length) / 8)], S, S), k * S, r * S);
    });
    fs.mkdirSync(path.join(REVIEW, 'under'), { recursive: true });
    writeJpg(path.join(REVIEW, 'under', 'loops.jpg'), sheet, 3);
  }
  for (const r of report) {
    console.log(`[under-loops] ${r.id.padEnd(13)} ${String(r.frames).padStart(2)} frames  step ${r.step.toFixed(2)}  seam ${r.seam.toFixed(2)}  drift ${r.drift.toFixed(1)}  ${r.pingpong ? 'ping-pong' : 'loop'}`);
  }
  console.log(`[under-loops] ${Object.keys(tiles).length} tiles and ${Object.keys(stages).length} core stages baked to ${OUT}`);
  return { tiles, stages };
}
