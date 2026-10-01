/**
 * THE ORGANS ALIVE AS WHOLE SHAPES (Collins, Oct 1 2026: "the living organs animations SUCK — it
 * animated it by square, not by organ, which does not look good at all. It needed to animate the organs
 * in their full shape, then cut them out so they could work on the square grid (the central core looks
 * good though)").
 *
 * Every organ that spans more than one cell gets:
 *   1. ONE picture of the whole organ filling the box of its shape's cells (the scan look of its tile,
 *      templates/under.mjs): art-src/under-shapes/<id>.png. The tiles are never touched. (Asked to paint
 *      INTO a white-on-black outline of the shape, the image model drew another shape: so the organ fills
 *      the box, laid out for its shape, and the game shows the shape's cells of it.)
 *   2. ONE looping clip of that picture (image to video, end frame = start frame): one motion that
 *      flows through the whole body (a heartbeat through the whole heart, peristalsis along the whole
 *      gut, sparks running out through the whole nerve cluster): art-src/under-loops-shape/<id>.mp4.
 *   3. Baked: every frame cropped to the shape's bounding box of cells (bw x bh cells, each CW x CH
 *      pixels) and laid out in an atlas of frames (public/art/under/shape-<id>.webp; frame f at column
 *      f % cols, row f / cols), plus its first frame alone (shape-<id>-still.webp, what the organ scans
 *      in as and the still when motion is off). The game cuts each frame into the shape's cells with
 *      the same cut for every cell (src/ui/underAlive.ts), turned with the organ, all the cells of one
 *      organ on the same frame, so the motion reads as one creature, continuous across cell borders.
 *
 * Single-cell organs, deposits, features and the meteor keep their loops (templates/under-loops.mjs).
 *
 *   node tools/art/make.mjs undershapes [ids...] [--stills] [--bake] [--reroll] [--restill]
 *     --stills   only the shape pictures (look at them before paying for clips)
 *     --bake     bake again (free)
 *     --reroll   move the named organs' clips to rejected/ and make them again
 *     --restill  move the named organs' shape pictures (and their clips) to rejected/ and make them again
 *
 * Manifest: under.shapes = { fps, cell: [CW, CH], organs: { <id>: { atlas, still, count, cols, fw, fh,
 *   shape: [[x, y], ...], pingpong? } } }. `shape` is the organ's shape as content/underground.ts has it
 *   (tests/under-shapes.test.ts checks they agree); cell k of a placed organ is shape[k] of the picture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill, pool } from '../rfab.mjs';
import { blank, crop, paste, readFrames, readImage, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';

const TILES = path.join(SRC, 'under');
const STILLS = path.join(SRC, 'under-shapes');
const DIR = path.join(SRC, 'under-loops-shape');
const OUT = path.join(ART, 'under');
const CONCEPT = path.join(ROOT, 'notes', 'concepts', '2026-09-29-organ-stage', '1-scanner-board.png');

/** A board cell is 1.25 wide to 1 high; a picture's cell is the middle way between that and square, so an organ turned on its side is stretched no more than one placed upright. */
const CA = Math.sqrt(1.25);
/** One cell of a baked frame, in pixels (about what a cell is on a laptop's high-density screen). */
const CW = 112, CH = Math.round(112 / CA);
const FPS = 12;
/** A frame atlas is at most this wide (WebP's limit is 16383). */
const ATLAS_W = 8192;

// The shapes of content/underground.ts (tests/under-shapes.test.ts keeps them in step).
const L4 = [[0, 0], [0, 1], [0, 2], [1, 2]];
const T4 = [[0, 0], [1, 0], [2, 0], [1, 1]];
const S4 = [[1, 0], [2, 0], [0, 1], [1, 1]];
const X5 = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
const O4 = [[0, 0], [1, 0], [0, 1], [1, 1]];
const U5 = [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]];
const I4 = [[0, 0], [1, 0], [2, 0], [3, 0]];
const P5 = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]];
const D2 = [[0, 0], [1, 0]];
const V2 = [[0, 0], [0, 1]];
const L3 = [[0, 0], [1, 0], [0, 1]];
const I3 = [[0, 0], [1, 0], [2, 0]];
const V3 = [[0, 0], [0, 1], [0, 2]];

/**
 * Every organ of more than one cell: its shape, the whole organ (`body`, in the look of its tile), and
 * the one motion that flows through all of it (`motion`).
 */
export const SHAPES = {
  forge: {
    shape: L4,
    body: 'a Bone Forge: one branching growth of pale ivory bone filling the picture, thick trabecular struts and spurs running mostly up and down and branching sideways along the bottom, warm cream glow',
    motion: 'a slow warm glow pulses down through the bone struts from the top of the picture to the bottom and along the bottom, the marrow inside them glinting as it passes',
  },
  venom: {
    shape: T4,
    body: 'a Venom Sac: swollen round acid yellow-green glands packed together all over the picture, the biggest in the upper middle, a glowing drip hanging from it in the lower middle, lime green glow',
    motion: 'the glands swell and relax one after another across the picture like slow breathing, a pulse of light runs down into the drip and the drip trembles',
  },
  gut: {
    shape: S4,
    body: 'a Gut: ONE long coiled dark wine-red intestine, ribbed and wet, winding in thick loops all over the picture, deep crimson glow',
    motion: 'slow waves of peristalsis travel along the whole length of the intestine, each ring of muscle squeezing in turn, so the waves run through every loop of it',
  },
  nerve: {
    shape: X5,
    body: 'a Nerve Cluster: one bright glowing nerve node in the very centre of the picture, pale blue-white nerve cords branching like lightning out from it in every direction to all the edges, icy blue glow',
    motion: 'waves of bright sparks flash out from the central node and run along the nerve cords out to every edge of the picture, the node flickering with each wave',
  },
  lattice: {
    shape: O4,
    body: 'a Mucus Lattice: one web of glassy translucent teal mucus strands stretched across the whole picture, a denser knot near the middle, cool cyan glow',
    motion: 'a slow shimmer ripples across the whole web of mucus strands from one side to the other and the strands sway very slightly',
  },
  womb: {
    shape: U5,
    body: 'a Brood Womb: one pink membrane holding clusters of glossy pink eggs all over the picture, rose glow',
    motion: 'a soft glow pulses slowly through the eggs, travelling across the picture from one side to the other, and the membrane between them breathes very slightly; every egg stays the same size and in the same place',
  },
  marrow: {
    shape: I4,
    body: 'a Marrow Vault: bone honeycomb across the whole picture, amber marrow in rows of chambers lying along it from the left edge to the right edge, warm orange-gold glow',
    motion: 'a slow wave of amber glow travels along the honeycomb chambers from the left end to the right end',
  },
  resonance: {
    shape: P5,
    body: 'a Resonance Chamber: one violet drum-skin membrane with concentric rings, their centre a third of the way down the picture, the rings spreading out over the whole picture, purple glow',
    motion: 'the concentric rings ripple outward from their centre like a drum skin humming, each ring of light running out across the whole membrane',
  },
  heart: {
    shape: D2,
    body: 'an Auxiliary Heart: ONE dense crimson heart of muscle lying across the whole wide picture, coronary vessels running over it, a strong red glow',
    motion: 'the whole heart beats in a slow steady heartbeat, each contraction squeezing through the whole muscle at once, and the vessels throb with it',
  },
  brain: {
    shape: D2,
    body: 'a Brain Node: ONE folded pale pink-grey brain lying across the whole wide picture, two hemispheres side by side, fine blood vessels, soft mauve glow',
    motion: 'faint pulses of light travel across the folds from one hemisphere to the other and tiny sparks flicker along the blood vessels',
  },
  bladder: {
    shape: V2,
    body: 'a Spore Bladder: ONE taut pale green bladder, a tall sac filling the whole tall picture, full of small round spores, soft green glow',
    motion: 'the whole bladder breathes in and out slowly as one sac and the spores inside drift',
  },
  budder: {
    shape: L3,
    body: 'a Budding Gland: one mass of tissue with pale green buds sprouting from it all over the picture, like a cluster of small shoots, light green glow',
    motion: 'the buds sway gently together as if in one slow current that passes across the whole picture',
  },
  swell: {
    shape: D2,
    body: 'a Swelling Sac: ONE light green swollen blister of tissue lying across the whole wide picture, pale green glow',
    motion: 'the whole blister swells and relaxes slowly as one sac',
  },
  catapult: {
    shape: I3,
    body: 'a Catapult Sac: tan sinews twisted under tension running across the whole width like the spring of a catapult, sand-coloured glow',
    motion: 'the twisted sinews tighten and slacken slightly along their whole length, a wave of strain running from the left end to the right end',
  },
  runner: {
    shape: V3,
    body: 'a Runner Gland: ONE green tube of muscle running straight from the top edge of the tall picture to the bottom edge like a hose, surrounded by green tissue, green glow',
    motion: 'waves of contraction run along the whole muscle tube from its top end to its bottom end',
  },
  mire: {
    shape: V2,
    body: 'a Mire Gland: one tall pocket of murky green slime with bubbles in it, filling the tall picture, dark swamp-green glow',
    motion: 'slow bubbles rise up through the whole pocket of slime from the bottom to the top and pop',
  },
  acid: {
    shape: D2,
    body: 'a Digestive Lining: one yellow acid lining, corroded and pitted, lying across the whole wide picture, sulphur-yellow glow',
    motion: 'the acid lining shimmers in a slow wave from one end to the other and tiny bubbles fizz in its pits',
  },
  seeder: {
    shape: V2,
    body: 'a Seeding Gland: ONE ribbed bone launch tube standing straight UP through the middle of the whole tall picture from the bottom edge to the top edge, a dark bore down its middle with a small red limb seed inside near the top, rings of muscle round the tube, red-orange glow',
    motion: 'rings of muscle squeeze up along the launch tube from its bottom to its top and the seed inside glows brighter and dimmer',
  },
  scaffold: {
    shape: L3,
    body: 'a Scaffold Gland: ivory bone scaffolding filling the picture, upright struts and cross-braces of bone with pads of callus, all one frame, cream glow',
    motion: 'a faint glow pulses slowly through the bone struts, running along the frame from one side of the picture to the other',
  },
};

const box = (shape) => ({ bw: Math.max(...shape.map((p) => p[0])) + 1, bh: Math.max(...shape.map((p) => p[1])) + 1 });

/** The picture's size for a shape: wide, tall or square, as the image model makes them. */
function canvasOf(shape) {
  const { bw, bh } = box(shape);
  const r = (bw * CA) / bh;
  return r > 1.25 ? { W: 1536, H: 1024 } : r < 0.8 ? { W: 1024, H: 1536 } : { W: 1024, H: 1024 };
}

/**
 * Where the shape's bounding box of cells sits in its picture (pixels): in the middle, as big as fits with a
 * small margin. The organ fills the whole picture; the game shows only the shape's cells of this box.
 */
function layoutOf(shape, W, H) {
  const { bw, bh } = box(shape);
  const m = 0.94;
  const cell = Math.min((W * m) / (bw * CA), (H * m) / bh);
  const w = Math.round(bw * CA * cell), h = Math.round(bh * cell);
  return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h, cw: w / bw, ch: h / bh };
}

const STILL = (body) =>
  'The first picture is one square tile of a ground-penetrating scan display on a spaceship console, showing a piece ' +
  'of a living organ: it is the LOOK to paint in (near-black ground with faint cold strata, the tissue a fine glowing ' +
  'false-colour image, slightly luminous, crisp, seen exactly from the front, flat, no perspective). Paint, in exactly ' +
  `that look, as bright and as finely detailed as the first picture, a bigger view of the same organ: ${body}. It is ONE ` +
  'whole organ, one continuous body: nothing repeats, it is not made of tiles or squares, no seams and no grid lines ' +
  'anywhere. Its tissue fills the WHOLE picture edge to edge and continues past every edge, as if the picture were cut ' +
  'from a larger scan: no empty margin, no background band along any edge. No outline or border line, no frame, no ' +
  'rounded corners, no text, no numbers, no letters, no labels, no religious symbol. The second picture shows the ' +
  'whole scan display this organ appears on, for its rendering only.';

const CLIP = (motion) =>
  'This picture is one still frame of a holographic ground-penetrating scan display on a spaceship console, showing ' +
  `one living organ. Animate it with subtle, slow, living motion that flows through the whole organ: ${motion}. The ` +
  'false-colour glow brightens and dims gently with it. The organ stays exactly where it is, in its exact outline, ' +
  'at the same size, in the same flat scan rendering, lit the same way; the dark background around it stays still ' +
  'and near-black. The camera is completely locked: no zoom, no pan, no rotation, no cuts, no shake. Nothing new ' +
  'appears: no text, no letters, no numbers, no symbols, no frame, no border.';

const stillOf = (id) => path.join(STILLS, `${id}.png`);
const clipOf = (id) => path.join(DIR, `${id}.mp4`);
const startOf = (id) => path.join(DIR, `${id}-start.png`);

/**
 * The clip's first frame: the shape picture cut to a frame the video model makes (16:9, 9:16 or 1:1)
 * round the shape's box, padded with the scan's black. Returns where the box is in it (0-1).
 */
function startFrame(id, write = true) {
  const { shape } = SHAPES[id];
  const img = readImage(stillOf(id));
  const L = layoutOf(shape, img.w, img.h);
  const r = L.w / L.h;
  const [aspect, ar] = r > 1.3 ? ['16:9', 16 / 9] : r < 0.77 ? ['9:16', 9 / 16] : ['1:1', 1];
  // The smallest frame of that aspect holding the box with a margin of 6%.
  let fw = L.w * 1.06, fh = L.h * 1.06;
  if (fw / fh > ar) fh = fw / ar; else fw = fh * ar;
  fw = Math.round(fw); fh = Math.round(fh);
  const x0 = Math.round(L.x + L.w / 2 - fw / 2), y0 = Math.round(L.y + L.h / 2 - fh / 2);
  const cut = crop(img, x0, y0, fw, fh, [3, 5, 6, 255]);
  const [ow, oh] = aspect === '16:9' ? [1280, 720] : aspect === '9:16' ? [720, 1280] : [960, 960];
  if (write) writePng(startOf(id), resize(cut, ow, oh));
  return { aspect, box: { x: (L.x - x0) / fw, y: (L.y - y0) / fh, w: L.w / fw, h: L.h / fh } };
}

const moveAside = (file, sub = 'rejected') => {
  if (!fs.existsSync(file)) return;
  const dir = path.join(path.dirname(file), sub);
  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(file, path.join(dir, path.basename(file).replace(/(\.\w+)$/, `-${Date.now()}$1`)));
};

export async function makeUnderShapes({ only = [], bakeOnly = false, stillsOnly = false, reroll = false, restill = false } = {}) {
  fs.mkdirSync(STILLS, { recursive: true });
  fs.mkdirSync(DIR, { recursive: true });
  const ids = Object.keys(SHAPES).filter((id) => !only.length || only.includes(id));
  if (!bakeOnly) {
    if (restill) for (const id of ids) { moveAside(stillOf(id)); moveAside(clipOf(id)); }
    if (reroll) for (const id of ids) moveAside(clipOf(id));
    // 1. The shape pictures.
    const stills = await pool(ids.filter((id) => !fs.existsSync(stillOf(id))), 4, async (id) => {
      const { shape, body } = SHAPES[id];
      const { W, H } = canvasOf(shape);
      return makeStill({
        slug: `scan shape ${id}`, out: stillOf(id), prompt: STILL(body), key: null,
        refFiles: [path.join(TILES, `${id}.png`), ...(fs.existsSync(CONCEPT) ? [CONCEPT] : [])],
        width: W, height: H, quality: 'medium',
      });
    });
    stills.forEach((r) => { if (!r.ok) console.warn(`[under-shapes] a shape picture failed: ${r.error.message.slice(0, 200)}`); });
    lookStills(ids);
    if (stillsOnly) return null;
    // 2. One looping clip per shape picture.
    const jobs = ids.filter((id) => fs.existsSync(stillOf(id)) && !fs.existsSync(clipOf(id))).map((id) => ({ id, ...startFrame(id) }));
    const results = await pool(jobs, 4, (j) => makeClip({
      slug: `scan shape loop ${j.id}`, stillFile: startOf(j.id), out: clipOf(j.id), prompt: CLIP(SHAPES[j.id].motion), raw: true,
      seconds: 4, resolution: '480p', aspect: j.aspect, loop: true,
    }));
    results.forEach((r, i) => { if (!r.ok) console.warn(`[under-shapes] ${jobs[i].id} clip failed: ${r.error.message.slice(0, 200)}`); });
  }
  return bakeUnderShapes();
}

/** Every shape picture with its outline over it, to look at before paying for clips. */
function lookStills(ids) {
  const S = 360;
  const kept = ids.filter((id) => fs.existsSync(stillOf(id)));
  if (!kept.length) return;
  const cols = 4;
  const sheet = blank(cols * S, Math.ceil(kept.length / cols) * S, [20, 20, 20, 255]);
  kept.forEach((id, i) => {
    const img = readImage(stillOf(id));
    const { shape } = SHAPES[id];
    const L = layoutOf(shape, img.w, img.h);
    // What the game will not show (outside the shape's cells) dimmed to a quarter.
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const cx = Math.floor((x - L.x) / L.cw), cy = Math.floor((y - L.y) / L.ch);
      if (shape.some(([a, b]) => a === cx && b === cy)) continue;
      const i = (y * img.w + x) * 4;
      img.data[i] >>= 2; img.data[i + 1] >>= 2; img.data[i + 2] >>= 2;
    }
    // The cells' borders, in thin grey, where the game will cut.
    for (const [cx, cy] of shape) {
      const x0 = Math.round(L.x + cx * L.cw), y0 = Math.round(L.y + cy * L.ch);
      const x1 = Math.round(L.x + (cx + 1) * L.cw) - 1, y1 = Math.round(L.y + (cy + 1) * L.ch) - 1;
      for (let x = x0; x <= x1; x += 3) for (const y of [y0, y1]) img.data.set([140, 140, 140, 255], (y * img.w + x) * 4);
      for (let y = y0; y <= y1; y += 3) for (const x of [x0, x1]) img.data.set([140, 140, 140, 255], (y * img.w + x) * 4);
    }
    const k = Math.min(S / img.w, S / img.h);
    const small = resize(img, Math.round(img.w * k), Math.round(img.h * k));
    paste(sheet, small, (i % cols) * S + Math.round((S - small.w) / 2), Math.floor(i / cols) * S + Math.round((S - small.h) / 2));
  });
  fs.mkdirSync(path.join(REVIEW, 'under'), { recursive: true });
  writeJpg(path.join(REVIEW, 'under', 'shape-stills.jpg'), sheet, 3);
  console.log(`[under-shapes] ${kept.length} shape pictures: ${path.join(REVIEW, 'under', 'shape-stills.jpg')}`);
}

/** Mean change per pixel (0-255) between two RGBA buffers of the same size. */
function diff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 16) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return s / (a.length / 16) / 3;
}
function lum(d) {
  let s = 0;
  for (let i = 0; i < d.length; i += 16) s += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  return s / (d.length / 16);
}

/** The bounding box of cells out of every frame of a clip, at CW x CH a cell, trimmed to its loop. */
function shapeFrames(id) {
  const { shape } = SHAPES[id];
  const { bw, bh } = box(shape);
  const start = readImage(startOf(id));
  const meta = startFrame(id, false);
  const { w, h, frames } = readFrames(clipOf(id), FPS);
  const cut = (img) => {
    const b = meta.box;
    const c = crop(img, Math.round(b.x * img.w), Math.round(b.y * img.h), Math.round(b.w * img.w), Math.round(b.h * img.h), [3, 5, 6, 255]);
    return resize(c, bw * CW, bh * CH);
  };
  let all = frames.map((f) => cut({ w, h, data: Buffer.from(f) }));
  // The last frame or two of a start=end clip is the start picture again: drop exact repeats of frame 0.
  let end = all.length;
  while (end > 8 && diff(all[end - 1].data, all[0].data) < 0.4) end--;
  all = all.slice(0, end);
  const steps = [];
  for (let i = 0; i < all.length - 1; i++) steps.push(diff(all[i].data, all[i + 1].data));
  const step = steps.reduce((a, b) => a + b, 0) / Math.max(1, steps.length);
  const seam = diff(all[all.length - 1].data, all[0].data);
  const pingpong = seam > 2 * step;
  let drift = 0;
  for (const f of all) drift = Math.max(drift, diff(f.data, all[0].data));
  // The video model lights the scan up: one gain for the clip brings its mean back to the picture's.
  const target = lum(cut(start).data);
  const mean = all.reduce((a, f) => a + lum(f.data), 0) / all.length;
  const gain = Math.min(1.5, Math.max(0.4, target / Math.max(1, mean)));
  for (const f of all) for (let i = 0; i < f.data.length; i += 4) {
    f.data[i] = Math.min(255, f.data[i] * gain); f.data[i + 1] = Math.min(255, f.data[i + 1] * gain); f.data[i + 2] = Math.min(255, f.data[i + 2] * gain);
  }
  return { frames: all, step, seam, pingpong, drift, gain, bw, bh };
}

export function bakeUnderShapes() {
  fs.mkdirSync(OUT, { recursive: true });
  const organs = {};
  const report = [];
  const rows = [];
  for (const id of Object.keys(SHAPES)) {
    if (!fs.existsSync(clipOf(id)) || !fs.existsSync(stillOf(id))) continue;
    const l = shapeFrames(id);
    const fw = l.bw * CW, fh = l.bh * CH;
    const cols = Math.max(1, Math.min(l.frames.length, Math.floor(ATLAS_W / fw)));
    const atlas = blank(cols * fw, Math.ceil(l.frames.length / cols) * fh, [0, 0, 0, 255]);
    l.frames.forEach((f, i) => paste(atlas, f, (i % cols) * fw, Math.floor(i / cols) * fh));
    const png = path.join(OUT, `shape-${id}.png`);
    writePng(png, atlas);
    toWebp(png, path.join(OUT, `shape-${id}.webp`), { q: 80 });
    fs.rmSync(png);
    const spng = path.join(OUT, `shape-${id}-still.png`);
    writePng(spng, l.frames[0]);
    toWebp(spng, path.join(OUT, `shape-${id}-still.webp`), { q: 86 });
    fs.rmSync(spng);
    organs[id] = {
      atlas: `under/shape-${id}.webp`, still: `under/shape-${id}-still.webp`, count: l.frames.length, cols, fw, fh,
      shape: SHAPES[id].shape, ...(l.pingpong ? { pingpong: true } : {}),
    };
    report.push({ id, ...l, frames: l.frames.length });
    rows.push({ id, frames: l.frames, fw, fh });
  }
  putEntry('under', 'shapes', { fps: FPS, cell: [CW, CH], organs });
  // To look at: every clip, 6 frames across its loop, each with its cells' borders marked.
  if (rows.length) {
    const S = 220;
    const sheet = blank(6 * S, rows.length * S, [16, 16, 16, 255]);
    rows.forEach((r, ri) => {
      for (let k = 0; k < 6; k++) {
        const f = r.frames[Math.floor((k * r.frames.length) / 6)];
        const q = Math.min((S - 8) / f.w, (S - 8) / f.h);
        const small = resize(f, Math.round(f.w * q), Math.round(f.h * q));
        paste(sheet, small, k * S + 4, ri * S + 4);
      }
    });
    fs.mkdirSync(path.join(REVIEW, 'under'), { recursive: true });
    writeJpg(path.join(REVIEW, 'under', 'shape-loops.jpg'), sheet, 3);
  }
  for (const r of report) {
    console.log(`[under-shapes] ${r.id.padEnd(10)} ${String(r.frames).padStart(2)} frames  step ${r.step.toFixed(2)}  seam ${r.seam.toFixed(2)}  drift ${r.drift.toFixed(1)}  gain ${r.gain.toFixed(2)}  ${r.pingpong ? 'ping-pong' : 'loop'}`);
  }
  console.log(`[under-shapes] ${Object.keys(organs).length} organs baked to ${OUT}`);
  return organs;
}
