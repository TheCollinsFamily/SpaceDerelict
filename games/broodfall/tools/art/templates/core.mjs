/**
 * THE LANDING SITE (the core), in two parts.
 *
 * It was one picture: the meteor on a wide mound of roots, four cells across, drawn by the
 * image model at its own angle and laid over the square. Collins, Sep 29 2026: "the core is
 * not sitting well AT ALL … in every picture it's just kind of floating there over parts of
 * the environment … it may need to be redrawn because it looks a little jaunty." A picture
 * that wide cannot be made to sit: whatever of it lies on the ground has to lie in the
 * ground's own perspective, exactly, and no image model draws a four-cell disc exactly.
 *
 *   1. THE GROUND: the crater and the roots that spread from it, painted from STRAIGHT ABOVE
 *      like a floor texture, and laid on the ground by the game itself, as the floors are.
 *      It cannot float: it is the ground. Blocks stand on it; it turns with the camera.
 *   2. THE HEART: only what stands up, the meteor and the heart in it, on a collar no wider
 *      than a limb's skirt. A sprite like a limb's, standing where its footing is marked.
 *
 *   node tools/art/make.mjs terrain core          the two pictures and the clip, then the bake
 *   node tools/art/make.mjs terrain --bake        bake again (free)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill } from '../rfab.mjs';
import { bbox, blank, borderColour, crop, over, paste, readFrames, readImage, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { A, B, TILE_H, TILE_W, render, sample } from '../lib/iso.mjs';
import { dropSpecks, keyClip, keyFrame, keyOf, loopWindow, pick, unionBox } from '../lib/key.mjs';
import { GROUNDS } from '../lib/atlas.mjs';
import { drawCell } from '../lib/foot.mjs';
import { ART, REVIEW, SRC } from '../lib/manifest.mjs';
import { wallTiles } from './terrain.mjs';

const TERRAIN = path.join(SRC, 'terrain');
const DIR = path.join(TERRAIN, 'core');

const GROUND =
  'Seen from exactly straight above, as a map is, perfectly centred in the picture: the crater a meteor made ' +
  'where it fell, and what has grown from it. A round pit with a raised ragged rim of thrown-up dark earth and ' +
  'broken stone. The pit is lined with living tissue: deep maroon and dark crimson flesh, lumpy and wet, crossed ' +
  'by a net of darker raised veins, exactly the tissue of the reference picture. From the pit, thick roots of ' +
  'that same tissue spread outward over the ground in every direction, like the roots of a great tree seen from ' +
  'above: they branch, thin, and end in fine tips well inside the edge of the picture. Between the roots nothing ' +
  'at all: bare background. In the very middle of the pit is a round dark hollow, empty, as wide as a third of ' +
  'the pit, where the meteor sits. The whole is round and even all the way round: no side of it is longer than ' +
  'another. No perspective of any kind: a flat top view. Even flat light, no cast shadows, no text.';

const HEART =
  'A meteor half buried where it fell, for a strategy game. Isometric three-quarter top-down view, the camera ' +
  '45 degrees above the ground: exactly the view of the SECOND reference picture. A dark pitted meteor the size ' +
  'of a small house, rounded like a boulder, split open down its front like a cracked egg; inside it a large ' +
  'crimson heart of wet muscle, glowing faintly. The meteor and the heart look exactly as they do in the FIRST ' +
  'reference picture. Thick roots of deep maroon veined tissue, exactly the tissue of the THIRD reference ' +
  'picture, grip the meteor from below like fingers holding a ball. It sits in a low ragged collar of that ' +
  'tissue and of thrown-up dark earth. The collar is SMALL: no wider than the meteor and a half, a low mound ' +
  'and not a wide skirt. The whole is about as wide as it is tall, upright and level: it does not lean. ' +
  'Realistic, detailed, wet and unglamorous. Soft even light from directly overhead. No cast shadows, no text.';

const BEAT =
  'The crimson heart inside the split meteor beats slowly and heavily; the flesh around it swells and relaxes ' +
  'with each beat; the roots that grip the meteor tighten and ease. The meteor itself does not move. It stays ' +
  'at exactly the same spot and the same size.';

/**
 * MARKED BY EYE, as a limb's footing is (tools/art/limbs.mjs, foot).
 * HEART_FOOT: [x, y, width] as shares of the box that holds the heart in the first frame of
 *   its clip: the middle of the collar it stands in, and how wide the collar is.
 * GROUND_PIT: [x, y, width] as shares of the ground picture: the middle of the pit, and how
 *   wide the pit is from rim to rim. The game lays the ground so that the pit is as wide as
 *   the heart's collar, and the middle of the pit is the middle of the square.
 */
export const HEART_FOOT = [0.5, 0.735, 0.94];
export const GROUND_PIT = [0.503, 0.493, 0.356];
/** How many cells wide the heart's collar is on the board. */
export const HEART_CELLS = 2.4;

export async function generateCore() {
  fs.mkdirSync(DIR, { recursive: true });
  const skin = path.join(TERRAIN, 'creep.png');
  const ground = makeStill({
    slug: 'the crater from above', out: path.join(DIR, 'ground.png'), prompt: GROUND, quality: 'high',
    width: 1024, height: 1024, refFiles: [skin],
  });
  const still = await makeStill({
    slug: 'the meteor and its heart', out: path.join(DIR, 'heart.png'), prompt: HEART, quality: 'high',
    width: 1024, height: 1024,
    refFiles: [path.join(TERRAIN, 'core-styled.png'), path.join(SRC, 'limbs', 'capacitor', 'styled.png'), skin],
  });
  // As sharp on the board as a limb is: the clip is made at 720p (Collins: 'a different resolution than the towers').
  await makeClip({ slug: 'the heart beats', out: path.join(DIR, 'heart-idle.mp4'), stillFile: still, prompt: BEAT, resolution: '720p' });
  await ground;
}

/** The ground picture, cut off its background, square, the pit in its middle. */
function bakeGround() {
  const file = path.join(DIR, 'ground.png');
  if (!fs.existsSync(file)) return null;
  const img = readImage(file);
  keyFrame(img, keyOf(borderColour(img)), { spill: 'edge' });
  dropSpecks(img, 0.002);
  // The picture is cut so that the pit is in the middle of it.
  const px = GROUND_PIT[0] * img.w;
  const py = GROUND_PIT[1] * img.h;
  const half = Math.floor(Math.min(px, py, img.w - px, img.h - py));
  const S = 1024;
  const cut = resize(crop(img, Math.round(px - half), Math.round(py - half), 2 * half, 2 * half), S, S);
  // Its edge fades: roots that reach the edge of the picture do not end on a line.
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
    const k = Math.max(0, Math.min(1, (1 - d) / 0.08));
    const i = (y * S + x) * 4 + 3;
    cut.data[i] = Math.round(cut.data[i] * k);
  }
  const png = path.join(ART, 'board', 'core-ground.png');
  writePng(png, cut);
  toWebp(png, png.replace(/\.png$/, '.webp'), { q: 86 });
  fs.rmSync(png);
  const pit = (GROUND_PIT[2] * img.w) / (2 * half);
  return { img: cut, file: 'board/core-ground.webp', pit: Number(pit.toFixed(3)) };
}

export function bakeCore() {
  const clip = path.join(DIR, 'heart-idle.mp4');
  if (!fs.existsSync(clip)) return null;
  fs.mkdirSync(path.join(ART, 'board'), { recursive: true });
  // As many pixels to a cell of the board as a limb has (Collins: "a different resolution than the towers").
  const F = 640;
  const COLS = 4;
  const keyed = keyClip(readFrames(clip, 12));
  for (const f of keyed.frames) dropSpecks(f);
  const loop = loopWindow(keyed.frames, { min: 12, max: 46 });
  const frames = keyed.frames.slice(loop.start, loop.end);
  const box = unionBox(frames);
  const first = unionBox([keyed.frames[0]]);
  const foot = {
    x: first.x0 + HEART_FOOT[0] * (first.x1 - first.x0),
    y: first.y0 + HEART_FOOT[1] * (first.y1 - first.y0),
    width: HEART_FOOT[2] * (first.x1 - first.x0),
  };
  const up = foot.y - box.y0;
  const down = box.y1 - foot.y;
  const side = Math.ceil(Math.max(2 * Math.max(foot.x - box.x0, box.x1 - foot.x), up + down) * 1.05);
  const x0 = Math.round(foot.x - side / 2);
  const y0 = Math.round(foot.y - up - (side - (up + down)) / 2);
  const kept = pick(frames, 16).map((f) => resize(crop(f, x0, y0, side, side), F, F));
  const sheet = blank(COLS * F, Math.ceil(kept.length / COLS) * F);
  kept.forEach((f, i) => paste(sheet, f, (i % COLS) * F, Math.floor(i / COLS) * F));
  const png = path.join(ART, 'board', 'core.png');
  writePng(png, sheet);
  toWebp(png, png.replace(/\.png$/, '.webp'), { q: 86 });
  fs.rmSync(png);
  const anchor = [0.5, Number(((foot.y - y0) / side).toFixed(4))];
  const body = Number((foot.width / side).toFixed(3));
  const ground = bakeGround();
  console.log(`[terrain] core: ${kept.length} frames of the heart, loop seam ${loop.seam.toFixed(2)}; the ground ${ground ? 'laid' : 'MISSING'}`);
  if (ground) standing(kept[0], anchor, body, ground, F);
  return {
    atlas: 'board/core.webp', frame: F, cols: COLS, count: kept.length, fps: Number((kept.length / (frames.length / 12)).toFixed(2)),
    /** The point of the frame that stands on the middle of the square, and how wide its collar is (a share of the frame). */
    anchor, body,
    /** How many cells wide the collar is on the board. */
    cells: HEART_CELLS, seam: Number(loop.seam.toFixed(2)),
    /**
     * The crater and its roots, painted from straight above: the game lays it on the ground.
     * cells: how many cells wide the whole picture is, so that the pit is as wide as the collar.
     */
    ...(ground ? { ground: { file: ground.file, cells: Number((HEART_CELLS / ground.pit).toFixed(3)) } } : {}),
  };
}

/**
 * To look at: the landing site on a square four cells across, as the game will draw it. The
 * ground is laid here exactly as the game lays it: every point of the ground of the picture
 * is asked what the painting shows there.
 */
function standing(heart, anchor, body, ground, F) {
  const N = 7;
  const W = N * TILE_W;
  const H = N * TILE_H + 200;
  const mid = { x: W / 2, y: 200 + (N * TILE_H) / 2 };
  const cells = HEART_CELLS / ground.pit;
  const out = blank(W, H, [...GROUNDS.street, 255]);
  // The square: four cells across, its middle in the middle.
  drawCell(out, mid.x, mid.y, 4 * A, [255, 255, 255], 0.9);
  const laid = render(W, H, (px, py) => {
    // Back from the screen to the ground, in cells from the middle of the square.
    const sx = (px - mid.x) / A;
    const sy = (py - mid.y) / B;
    const cx = (sy + sx) / 2;
    const cy = (sy - sx) / 2;
    const u = (cx / cells + 0.5) * ground.img.w;
    const v = (cy / cells + 0.5) * ground.img.h;
    if (u < 0 || v < 0 || u >= ground.img.w || v >= ground.img.h) return null;
    return sample(ground.img, u, v);
  });
  over(out, laid, 0, 0);
  const width = HEART_CELLS * Math.SQRT2 * A * 0.92;
  const size = Math.round(width / body);
  over(out, resize(heart, size, size), Math.round(mid.x - anchor[0] * size), Math.round(mid.y - anchor[1] * size));
  fs.mkdirSync(path.join(REVIEW, 'terrain'), { recursive: true });
  writeJpg(path.join(REVIEW, 'terrain', 'core-standing.jpg'), out, 3);
}

// ---------------------------------------------------------------- plinths

const PLINTH =
  'A flat elevation, in full colour and realistic detail, seen exactly from the front with no perspective, ' +
  'filling the whole picture edge to edge with no sky, no ground and no border: a wall that a living creature ' +
  'has GROWN, exactly three storeys high, the three storeys exactly the same height. It is a pedestal of bone ' +
  'and callus: upright ribs and struts of ivory bone, like a rib cage standing on end, and between them thick ' +
  'pads of deep maroon veined tissue and pale callus, exactly the tissue of the reference picture. A thick ' +
  'horizontal band of ivory bone runs along the top of each storey, like the rim of a drum. It is the same all ' +
  'the way along: no doors, no windows, nothing built. Even flat light, no cast shadows, no text.';

export async function generatePlinth() {
  fs.mkdirSync(DIR, { recursive: true });
  return makeStill({
    slug: 'the wall of a plinth', out: path.join(DIR, 'plinth.png'), prompt: PLINTH, key: null, quality: 'high',
    width: 1536, height: 1024, refFiles: [path.join(TERRAIN, 'creep.png')],
  });
}

/**
 * The faces of a plinth: a level of the body's own making on top of a block (Collins, Sep 29
 * 2026: "platforms that raise the height of one thing by one amount"). Baked as a wall is,
 * under the kind "plinth"; the three storeys of the picture are three looks of one level.
 */
export function plinthTiles() {
  const file = path.join(DIR, 'plinth.png');
  if (!fs.existsSync(file)) return [];
  return wallTiles('plinth', readImage(file, { w: 1024, h: 384 }));
}
