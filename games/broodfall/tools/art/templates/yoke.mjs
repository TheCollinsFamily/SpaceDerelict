/**
 * THE YOKE TEMPLATE: the ship AI's body, for RFab's Living Avatars and for the game.
 *
 * A Living Avatar's body is a set of transparent clips, one per STATE (idle, speaking,
 * happy, nod ...). RFab's overlay plays them on a 1280x720 stage; the game plays the same
 * files in the AI Core, with no network.
 *
 *   her approved look -> one still per expression, all redrawn from ONE base still so that
 *   she is the same girl in the same place -> a 4 s clip of each, ending where it began ->
 *   keyed by our own keyer -> a WebM with transparency -> public/art/ship/yoke/
 *
 *   node tools/art/make.mjs yoke                    every state (SPENDS tokens; skips what is on disk)
 *   node tools/art/make.mjs yoke idle happy         some states
 *   node tools/art/make.mjs yoke --stills           stop after the stills: LOOK at them before paying for clips
 *   node tools/art/make.mjs yoke --bake             key and encode again from the clips on disk (free)
 *   node tools/art/make.mjs yoke --publish          upload the clips to RFab and save her there (content/lore/yoke-avatar.json)
 *
 * To draw a still or a clip again, MOVE it into art-src/yoke/v1/ first (never delete).
 * About 21,000 tokens a still and 25,000 a clip.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { API_BASE, makeClip, makeStill, pool } from '../rfab.mjs';
import { blank, borderColour, crop, paste, readImage, resize, writeJpg, writePng } from '../lib/img.mjs';
import { dropSpecks, fringe, keyFrame, keyOf, loopWindow } from '../lib/key.mjs';
import { ART, REVIEW, ROOT, SRC } from '../lib/manifest.mjs';

const DIR = path.join(SRC, 'yoke');
const OUT = path.join(ART, 'ship', 'yoke');
const LOOK = path.join(REVIEW, 'yoke');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const LORE = path.join(ROOT, 'content', 'lore');
/** The stage of RFab's overlay (wiki/systems/vtuber-studio.md): the body is drawn for it. */
const W = 1280;
const H = 720;
const FPS = 24;
/**
 * Green: she is pale, blue-white and black, with amber eyes. Blue would eat her hair and
 * magenta her skin and her blush; green is the one key colour she has none of.
 */
const KEY = { hex: '00FF00', name: 'green' };
export const YOKE_NAME = 'YOKE (Broodfall)';

const HER =
  'the ship\'s artificial intelligence YOKE, exactly the woman of the reference pictures: an adult woman of about ' +
  'twenty-four with a calm, intelligent face, long straight pale silver hair with a faint blue tint falling well ' +
  'past her shoulders, a side-swept fringe, amber-gold eyes, fair skin, and one small plain black gear-shaped hair ' +
  'clip on the side of her head. She wears a plain black high-collared long-sleeved dress with a narrow white ' +
  'inner collar, modest and austere, with no ornament at all';
const FRAMING =
  'She is shown from the waist up, facing the viewer directly, exactly in the middle of the picture, upright. ' +
  'The top of her hair is a little below the top edge of the picture, and her body runs out of the bottom edge ' +
  'of the picture: nothing of her fades out or ends inside the picture. There is empty background to the left ' +
  'and right of her.';
const DRAWN =
  'Clean cel-shaded anime drawing with crisp dark outlines and soft even light from the front. She is drawn as a ' +
  'solid figure: no glow, no halo, no light rays, no scan lines, no sparkles, no transparency, no shadow. ' +
  'No text, no lettering, no numbers, no symbols of any kind other than the plain gear hair clip.';

/** Her six approved faces (r4-yoke-expressions.png), three across and two down. */
const SHEET = ['calm', 'curious', 'amused', 'concerned', 'thinking', 'sad'];

/**
 * Every state, in the order of how much she needs it.
 *   face     what the still shows (none: the state is played from another state's still)
 *   from     the state whose still its clip starts and ends on
 *   ref      which approved face is shown to the model beside the base still
 *   move     what happens in the clip
 *   oneShot  it is played once and she returns to idle (RFab: a gesture, [MOTION:name])
 *   mouth    'talks', 'laughs' or 'apart'; none: it stays shut (the first idle clip came back talking)
 */
export const STATES = [
  { id: 'idle', ref: 'calm',
    face: 'Her expression is calm and attentive, with the faintest polite smile, her mouth closed. Her arms hang at her sides and her hands are out of the picture.',
    move: 'A living portrait, almost still. She looks at the viewer, calm and attentive. She breathes slowly and blinks twice. Her hair sways very slightly.' },
  { id: 'speaking', from: 'idle', mouth: 'talks',
    move: 'She is talking to the viewer in a calm, even way: her mouth opens and closes steadily as she speaks, all the way through. Small natural movements of her head. She blinks once.' },
  { id: 'thinking', ref: 'thinking',
    face: 'She is thinking: her eyes look up and to one side, her lips are closed, and one hand is raised with its curled fingers resting against her chin. The hand has five fingers.',
    move: 'A living portrait, almost still. Her hand rests against her chin. Her eyes drift slowly to one side and back, and she tilts her head a little. She blinks.' },
  { id: 'happy', ref: 'amused',
    face: 'She is quietly pleased: a small warm smile with her mouth closed and her eyes softened. Her arms hang at her sides and her hands are out of the picture.',
    move: 'A living portrait, almost still. She keeps her small smile and keeps her eyes open, looking at the viewer. She tilts her head very slightly and blinks once, quickly.' },
  { id: 'sad', ref: 'sad',
    face: 'She is sad: her eyes are lowered and half closed, her brows are raised in the middle, her mouth is small and closed, her head is bowed a little. Her hands are out of the picture.',
    move: 'A living portrait, almost still. Her eyes are lowered. Her shoulders sink a little as she breathes out through her nose. She blinks slowly.' },
  { id: 'surprised', ref: 'curious', mouth: 'apart',
    face: 'She is surprised: her eyes are wide open, her brows are raised, and her mouth is a little open. Her head is straight. Her hands are out of the picture.',
    move: 'She is surprised: her eyes are wide, she draws her head back very slightly and blinks twice, her lips a little apart.' },
  { id: 'angry', ref: 'concerned',
    face: 'She is stern and displeased, not shouting: her brows are drawn down, her eyes are level and cold, her lips are pressed thin and closed, her chin is lowered slightly. Her hands are out of the picture.',
    move: 'She is stern and displeased: she holds the viewer with a cold level stare, breathes in slowly through her nose and narrows her eyes a little. She does not shout.' },
  { id: 'laughing', ref: 'amused', mouth: 'laughs',
    face: 'She is laughing quietly: her eyes are closed in happy curves and her mouth is open in a small laugh. Her arms hang at her sides and her hands are out of the picture.',
    move: 'She laughs quietly: her shoulders shake a little, her eyes are closed in happy curves, her mouth is open in a small laugh.' },
  { id: 'blushing', ref: 'amused',
    face: 'She is flustered: a faint pink blush lies across her cheeks, her eyes glance to one side, and her lips are pressed into a small embarrassed smile. Her hands are out of the picture.',
    move: 'A living portrait, almost still. Her head faces the viewer the whole time. Only her eyes glance to one side and come back. She blinks quickly. The faint blush stays on her cheeks.' },
  { id: 'nod', from: 'idle', oneShot: true,
    move: 'She nods once, clearly: her head goes down and comes up again. Then she is still and looks at the viewer as before.' },
  { id: 'shake_head', from: 'idle', oneShot: true,
    move: 'She shakes her head slowly, once to each side, as one who says no. Then she is still and looks at the viewer as before.' },
  { id: 'wink', from: 'idle', oneShot: true,
    move: 'She winks: she shuts ONE eye only, while her other eye stays wide open, and opens it again. A small dry smile. Then her face is calm again and she looks at the viewer as before.' },
  { id: 'wave', from: 'idle', oneShot: true,
    move: 'She raises one hand beside her shoulder and gives a small restrained wave, the hand open with five fingers. Then she lowers the hand out of the picture again and stands as before.' },
  { id: 'look_left', from: 'idle',
    move: 'She turns her eyes and then her head a little toward the LEFT edge of the picture, looks there for a moment, and turns back to face the viewer as before.' },
  { id: 'look_right', from: 'idle',
    move: 'She turns her eyes and then her head a little toward the RIGHT edge of the picture, the side on which she wears her gear hair clip, so that the clip turns away from the viewer. She looks there for a moment, and turns back to face the viewer as before.' },
];
/**
 * Faces that are another state's clip under a second name. RFab offers a mind only the
 * EXPRESSIONS of its body, and counts idle and thinking as neither: without these two she
 * would have to be happy, sad or angry in every sentence, and could never simply be calm.
 */
export const ALIASES = { calm: 'idle', thoughtful: 'thinking' };
const state = (id) => STATES.find((s) => s.id === id);
const stillOf = (s) => path.join(DIR, `${s.from ?? s.id}-still.png`);
const framedOf = (s) => path.join(DIR, `${s.from ?? s.id}-framed.png`);
const clipOf = (s) => path.join(DIR, `${s.id}.mp4`);

/** One of her approved faces, cut from the sheet, as a reference picture. */
function faceRef(name) {
  const file = path.join(DIR, `ref-${name}.png`);
  if (!fs.existsSync(file)) {
    const sheet = readImage(path.join(CONCEPTS, 'r4-yoke-expressions.png'));
    const i = SHEET.indexOf(name);
    const w = Math.floor(sheet.w / 3);
    const h = Math.floor(sheet.h / 2);
    writePng(file, crop(sheet, (i % 3) * w, Math.floor(i / 3) * h, w, h));
  }
  return file;
}

/** An alpha mask of a still on its key colour: where she is. */
function maskOf(img) {
  const copy = { w: img.w, h: img.h, data: Buffer.from(img.data) };
  keyFrame(copy, keyOf(borderColour(img)), { spill: 'edge' });
  return copy;
}

/**
 * Every still is brought to the same place on the stage: the top of her hair at 7% of the
 * height, her head in the middle, her body running out of the bottom. The image model
 * puts her a little higher or lower in each picture it draws; a face that jumps when the
 * clip changes reads as a different girl.
 */
function frame(file, out) {
  const img = readImage(file);
  const bg = borderColour(img);
  const mask = maskOf(img);
  const solid = (x, y) => mask.data[(y * img.w + x) * 4 + 3] > 128;
  let top = -1;
  for (let y = 0; y < img.h && top < 0; y++) {
    let n = 0;
    for (let x = 0; x < img.w; x++) if (solid(x, y)) n++;
    if (n > 6) top = y;
  }
  if (top < 0) throw new Error(`${file}: nothing but background in it`);
  // The middle of her head: the middle of what is solid in the rows just under the top of her hair.
  let x0 = img.w, x1 = 0;
  const rows = Math.round(img.h * 0.22);
  for (let y = top; y < Math.min(img.h, top + rows); y++) for (let x = 0; x < img.w; x++) {
    if (solid(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  }
  const cx = (x0 + x1) / 2;
  const headTop = Math.round(H * 0.07);
  // Scaled about her bottom edge, so that her body still runs out of the picture.
  const k = Math.max(0.85, Math.min(1.3, (H - headTop) / ((img.h - top) * (H / img.h))));
  const w = Math.round(img.w * (H / img.h) * k);
  const h = Math.round(H * k);
  const scaled = resize({ w: img.w, h: img.h, data: img.data }, w, h);
  const stage = blank(W, H, [bg[0], bg[1], bg[2], 255]);
  paste(stage, scaled, Math.round(W / 2 - cx * (w / img.w)), H - h);
  writePng(out, stage);
  return { top: top / img.h, centre: cx / img.w, scale: Number(k.toFixed(3)) };
}

async function stills(list) {
  const base = state('idle');
  // The base still first: every other still is redrawn from it.
  if (!fs.existsSync(stillOf(base))) {
    await makeStill({
      slug: 'yoke idle', out: stillOf(base), width: W, height: H, quality: 'high',
      refFiles: [path.join(CONCEPTS, 'r4-yoke-colour.png'), faceRef('calm')],
      prompt: `An anime illustration of ${HER}. ${FRAMING} ${base.face} ${DRAWN}`,
      key: KEY.hex, keyName: KEY.name,
    });
  }
  if (!fs.existsSync(framedOf(base))) console.log('[yoke] idle framed:', JSON.stringify(frame(stillOf(base), framedOf(base))));
  const own = list.filter((s) => s.face && s.id !== 'idle');
  const results = await pool(own, 3, async (s) => {
    if (!fs.existsSync(stillOf(s))) {
      await makeStill({
        slug: `yoke ${s.id}`, out: stillOf(s), width: W, height: H, quality: 'high',
        refFiles: [framedOf(base), faceRef(s.ref), path.join(CONCEPTS, 'r4-yoke-colour.png')],
        prompt:
          'Redraw the FIRST picture exactly: the same woman, the same hair, the same hair clip, the same dress, the ' +
          'same size and the same place in the picture, the same drawing style and the same flat green background. ' +
          `Change only her expression and what is said here. ${s.face} The other pictures show the same woman, ` +
          `${HER}. ${FRAMING} ${DRAWN}`,
        key: KEY.hex, keyName: KEY.name,
      });
    }
    if (!fs.existsSync(framedOf(s))) console.log(`[yoke] ${s.id} framed:`, JSON.stringify(frame(stillOf(s), framedOf(s))));
  });
  results.forEach((r, i) => { if (!r.ok) console.warn(`[yoke] still of ${own[i].id} failed: ${r.error.message.slice(0, 200)}`); });
}

const MOUTH = {
  talks: '',
  laughs: '',
  apart: 'Her lips are a little apart and stay as they are, still, from the first frame to the last.',
  // No word of speech in it: told that she "does not speak", the video model hears "speak".
  shut: 'Her mouth is closed, and stays closed and still from the first frame to the last.',
};

async function clips(list) {
  const ready = list.filter((s) => fs.existsSync(framedOf(s)));
  const results = await pool(ready, 3, (s) => makeClip({
    slug: `yoke ${s.id}`, out: clipOf(s), stillFile: framedOf(s), seconds: 4, resolution: '720p', aspect: '16:9',
    prompt: `An anime woman shown from the waist up on a flat green background. ${MOUTH[s.mouth ?? 'shut']} ${s.move} ` +
      'Her hair, her hair clip and her dress stay exactly as they are. Nothing appears, nothing glows.',
    key: KEY.hex, keyName: KEY.name,
  }));
  results.forEach((r, i) => { if (!r.ok) console.warn(`[yoke] clip of ${ready[i].id} failed: ${r.error.message.slice(0, 200)}`); });
}

/** Every frame of a clip at the stage's size, as one buffer (frame 0, the still itself, is dropped). */
function decode(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file,
    '-vf', `trim=start_frame=1,setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H}:flags=lanczos`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
  { maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${file}: ffmpeg could not read it: ${String(r.stderr).slice(-300)}`);
  const size = W * H * 4;
  const n = Math.floor(r.stdout.length / size);
  return Array.from({ length: n }, (_, i) => ({ w: W, h: H, data: r.stdout.subarray(i * size, (i + 1) * size) }));
}

/**
 * What is left under the transparent part of a keyed frame is still green. A WebM stores
 * colour at half the sharpness of its transparency, so that green would bleed into the
 * outline of her hair. The colour of her own edge is spread outward over it instead, and
 * what is further away is made black.
 */
function bleed(img, reach = 6) {
  const { w, h, data } = img;
  const n = w * h;
  const done = new Uint8Array(n);
  let front = [];
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] > 0) { done[p] = 1; continue; }
    data[p * 4] = 0; data[p * 4 + 1] = 0; data[p * 4 + 2] = 0;
  }
  for (let p = 0; p < n; p++) {
    if (done[p]) continue;
    const x = p % w, y = (p - x) / w;
    if ((x > 0 && done[p - 1]) || (x < w - 1 && done[p + 1]) || (y > 0 && done[p - w]) || (y < h - 1 && done[p + w])) front.push(p);
  }
  for (let step = 0; step < reach && front.length; step++) {
    const filled = [];
    for (const p of front) {
      const x = p % w, y = (p - x) / w;
      let r = 0, g = 0, b = 0, c = 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && done[q]) { r += data[q * 4]; g += data[q * 4 + 1]; b += data[q * 4 + 2]; c++; }
      }
      if (c) { data[p * 4] = r / c; data[p * 4 + 1] = g / c; data[p * 4 + 2] = b / c; filled.push(p); }
    }
    for (const p of filled) done[p] = 1;
    const next = new Set();
    for (const p of filled) {
      const x = p % w, y = (p - x) / w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && !done[q]) next.add(q);
    }
    front = [...next];
  }
}

/** A blur of `values` (one number a pixel) over a square of `r` pixels each way, done twice: soft enough for a glow. */
function blur(values, w, h, r) {
  let src = values;
  for (let pass = 0; pass < 2; pass++) {
    const mid = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[y * w + Math.max(0, Math.min(w - 1, x))];
      for (let x = 0; x < w; x++) {
        mid[y * w + x] = sum / (2 * r + 1);
        sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
      }
    }
    const out = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += mid[Math.max(0, Math.min(h - 1, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / (2 * r + 1);
        sum += mid[Math.min(h - 1, y + r + 1) * w + x] - mid[Math.max(0, y - r) * w + x];
      }
    }
    src = out;
  }
  return src;
}

/** How much a pixel is her hair (or her collar): bright, and no redder than it is blue. Her skin is redder; her dress is dark. */
function hairness(r, g, b) {
  const bright = Math.max(0, Math.min(1, (Math.max(r, g, b) - 120) / 50));
  const cool = Math.max(0, Math.min(1, (b - r + 22) / 28));
  return bright * cool;
}

/** The mean colour of her hair in a keyed picture. */
function hairColour(img) {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < img.h * 0.8; y += 2) for (let x = 0; x < img.w; x += 2) {
    const i = (y * img.w + x) * 4;
    if (img.data[i + 3] < 250) continue;
    const k = hairness(img.data[i], img.data[i + 1], img.data[i + 2]);
    if (k < 0.9) continue;
    sum[0] += img.data[i]; sum[1] += img.data[i + 1]; sum[2] += img.data[i + 2];
    n++;
  }
  return n > 500 ? sum.map((v) => v / n) : null;
}

/**
 * The video model paints her hair grey in one clip and blue-silver in the next. Seen one
 * after the other, that is two girls. The hair of every clip is brought to the colour it
 * has in the still the clip was made from; her skin and her dress are left as they are.
 */
function matchHair(frames, still) {
  const want = hairColour(still);
  const have = hairColour(frames[0]);
  if (!want || !have) return null;
  const gain = want.map((v, k) => Math.max(0.8, Math.min(1.3, v / have[k])));
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const k = hairness(d[i], d[i + 1], d[i + 2]);
      if (!k) continue;
      for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, d[i + c] * (1 + (gain[c] - 1) * k));
    }
  }
  return gain.map((g) => Number(g.toFixed(3)));
}

/** The light she is made of: the pale blue of the approved design (r4-yoke-colour.png). */
const HALO = [112, 186, 255];

/**
 * THE PROJECTION. She is drawn as a solid figure on green, because a glow cannot be cut
 * off a key colour: a halo on green comes out as a green halo. What makes her a hologram
 * is made here, after the key, on every frame:
 *   her colours are cooled, and her blacks lifted to a deep blue (light has no black: in
 *   the game she is ADDED to the room, and a black dress would be a hole in her);
 *   every third line is a little darker (the scan lines of the approved design);
 *   a soft halo of pale blue lies round her outline.
 */
function project(img) {
  const { w, h, data } = img;
  const n = w * h;
  const own = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    own[p] = data[i + 3] / 255;
    if (!data[i + 3]) continue;
    const line = Math.floor(p / w) % 3 === 0 ? 0.88 : 1;
    data[i] = Math.min(255, (data[i] * 0.84 + 8) * line);
    data[i + 1] = Math.min(255, (data[i + 1] * 0.92 + 20) * line);
    data[i + 2] = Math.min(255, (data[i + 2] * 0.98 + 46) * line);
  }
  const glow = blur(own, w, h, 9);
  for (let p = 0; p < n; p++) {
    const a = own[p];
    if (a >= 1) continue;
    const halo = Math.min(1, glow[p] * 1.25) * 0.45 * (1 - a);
    const all = a + halo;
    if (all <= 0.004) continue;
    const i = p * 4;
    for (let k = 0; k < 3; k++) data[i + k] = Math.round((data[i + k] * a + HALO[k] * halo) / all);
    data[i + 3] = Math.round(all * 255);
  }
}

/** A keyed frame laid over a flat colour, shrunk: what a person looks at. */
function shown(img, rgb, w, h) {
  const out = blank(img.w, img.h, [rgb[0], rgb[1], rgb[2], 255]);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255;
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.round(img.data[i + k] * a + rgb[k] * (1 - a));
  }
  return resize(out, w, h);
}

/** The same, at full size, of the part of the picture round her head: where a green outline would show. */
function hairClose(img, rgb, box) {
  const out = blank(img.w, img.h, [rgb[0], rgb[1], rgb[2], 255]);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255;
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.round(img.data[i + k] * a + rgb[k] * (1 - a));
  }
  return crop(out, box.x, box.y, box.w, box.h);
}

/** Clip to WebM: keyed, cut to its loop, its checks made, its review pictures written. */
function bakeState(s) {
  const file = clipOf(s);
  if (!fs.existsSync(file)) return null;
  const frames = decode(file);
  const key = keyOf(borderColour(frames[Math.min(2, frames.length - 1)]));
  for (const f of frames) { keyFrame(f, key, { spill: 'all' }); dropSpecks(f, 0.02); }
  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  let kept = frames;
  if (!s.oneShot) {
    // A loop is at least two and a half seconds of her: shorter, and her breathing is a twitch.
    const loop = loopWindow(frames, { min: Math.round(FPS * 2.5), max: frames.length });
    kept = frames.slice(loop.start, loop.end);
    check('the loop closes', loop.seam < 3, Number(loop.seam.toFixed(2)));
    check('she moves', loop.motion > 0.02, Number(loop.motion.toFixed(3)));
  } else {
    const a = frames[0], z = frames[frames.length - 1];
    let d = 0;
    for (let i = 0; i < a.data.length; i += 4 * 97) d += Math.abs(a.data[i] - z.data[i]) + Math.abs(a.data[i + 3] - z.data[i + 3]);
    check('it ends where it began', d / (a.data.length / (4 * 97)) < 14, Number((d / (a.data.length / (4 * 97))).toFixed(2)));
  }
  const fr = Math.max(...[0, Math.floor(kept.length / 2), kept.length - 1].map((i) => fringe(kept[i], key)));
  check('no green on her outline', fr < 0.05, `${(fr * 100).toFixed(1)}%`);
  let solid = 0;
  for (let i = 3; i < kept[0].data.length; i += 4) if (kept[0].data[i] > 128) solid++;
  check('she fills the stage as a person does', solid / (W * H) > 0.12 && solid / (W * H) < 0.55, `${((solid / (W * H)) * 100).toFixed(0)}% of it`);

  const gain = matchHair(kept, maskOf(readImage(framedOf(s))));
  check('her hair is the colour of her still', !!gain, gain ? `gains ${gain.join(', ')}` : 'no hair found');
  // The checks above are made on her as she was drawn. From here on she is a projection.
  for (const f of kept) project(f);
  // The review pictures are made BEFORE the colour under the transparency is changed: they show what is seen.
  fs.mkdirSync(LOOK, { recursive: true });
  const picks = Array.from({ length: 6 }, (_, i) => kept[Math.min(kept.length - 1, Math.floor((i * kept.length) / 6))]);
  const tw = 426, th = 240;
  const sheet = blank(6 * tw, 2 * th, [0, 0, 0, 255]);
  picks.forEach((f, i) => { paste(sheet, shown(f, [8, 10, 14], tw, th), i * tw, 0); paste(sheet, shown(f, [236, 236, 232], tw, th), i * tw, th); });
  writeJpg(path.join(LOOK, `${s.id}.jpg`), sheet, 3);
  const box = { x: Math.round(W / 2 - 300), y: 0, w: 600, h: 420 };
  const close = blank(box.w * 2, box.h, [0, 0, 0, 255]);
  paste(close, hairClose(picks[2], [8, 10, 14], box), 0, 0);
  paste(close, hairClose(picks[2], [236, 236, 232], box), box.w, 0);
  writeJpg(path.join(LOOK, `${s.id}-hair.jpg`), close, 2);

  for (const f of kept) bleed(f);
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${s.id}.webm`);
  // A gesture plays once and is seen for a second: it is packed a little harder, to stay light to load.
  // VP8 with an alpha plane: what RFab's own studio exports, and what its overlay and every Chromium play.
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libvpx', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', s.oneShot ? '780k' : '1100k', '-crf', s.oneShot ? '20' : '14', '-qmin', '4', '-qmax', '40', '-g', String(FPS * 2), '-an', out],
  { input: Buffer.concat(kept.map((f) => f.data)), maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${s.id}: ffmpeg could not write the WebM: ${String(r.stderr).slice(-300)}`);
  const bytes = fs.statSync(out).size;
  const bad = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(LOOK, `${s.id}.json`), `${JSON.stringify({ state: s.id, frames: kept.length, seconds: Number((kept.length / FPS).toFixed(2)), kb: Math.round(bytes / 1024), failed: bad.length, checks }, null, 1)}\n`);
  console.log(`[yoke] ${s.id}: ${kept.length} frames, ${Math.round(bytes / 1024)} KB, ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  return { id: s.id, file: `${s.id}.webm`, seconds: Number((kept.length / FPS).toFixed(2)), oneShot: !!s.oneShot };
}

const MANIFEST = path.join(OUT, 'manifest.json');
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

/** The game's list of her clips (public/art/ship/yoke/manifest.json): every WebM that is in the folder. */
function writeManifest(baked = []) {
  const old = readJson(MANIFEST) ?? {};
  const states = {};
  const seconds = { ...(old.seconds ?? {}) };
  for (const b of baked) if (b) seconds[b.id] = b.seconds;
  for (const s of STATES) if (fs.existsSync(path.join(OUT, `${s.id}.webm`))) states[s.id] = `${s.id}.webm`;
  for (const [name, of] of Object.entries(ALIASES)) if (states[of]) states[name] = states[of];
  const m = {
    name: YOKE_NAME, width: W, height: H, fps: FPS,
    states,
    oneShot: STATES.filter((s) => s.oneShot && states[s.id]).map((s) => s.id),
    seconds: Object.fromEntries(Object.keys(states).map((id) => [id, seconds[id] ?? 4])),
    // Where the same clips are on RFab, once she is published there.
    ...(old.rfab ? { rfab: old.rfab } : {}),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(m, null, 1)}\n`);
  return m;
}

export function bakeYoke(only) {
  const list = STATES.filter((s) => !only?.length || only.includes(s.id));
  const baked = list.map((s) => bakeState(s));
  const m = writeManifest(baked);
  console.log(`[yoke] her body has ${Object.keys(m.states).length} states: ${Object.keys(m.states).join(', ')}`);
  return m;
}

// ---------------------------------------------------------------------------
// RFab: her clips, her body, her brain and the avatar that binds them.
// ---------------------------------------------------------------------------

async function call(method, pathname, body) {
  const res = await fetch(API_BASE + pathname, {
    method,
    headers: { 'X-API-Key': process.env.RFAB_API_KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`${method} ${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json ?? {};
}

/** One clip to RFab's media store, the way the VTuber Studio sends its exports; no gallery row. */
async function uploadClip(file, id) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'video/webm' }), `yoke-broodfall-${id}.webm`);
  form.append('prompt', `${YOKE_NAME}: ${id}`);
  form.append('skipGallery', 'true');
  const res = await fetch(`${API_BASE}/api/image-generation/upload`, { method: 'POST', headers: { 'X-API-Key': process.env.RFAB_API_KEY }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.imageUrl) throw new Error(`upload of ${id} -> HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body.imageUrl;
}

/** Her brain text and her notes: the two parts of content/lore/yoke-brain.md that lie between marks. */
export function brainText() {
  const raw = fs.readFileSync(path.join(LORE, 'yoke-brain.md'), 'utf8').replace(/\r\n/g, '\n');
  const brain = raw.match(/<!-- BRAIN TEXT BEGINS -->\n([\s\S]*?)\n<!-- BRAIN TEXT ENDS -->/);
  const notes = raw.match(/<!-- NOTES BEGIN -->\n([\s\S]*?)\n<!-- NOTES END -->/);
  if (!brain || !notes) throw new Error('content/lore/yoke-brain.md has lost its marks');
  if (brain[1].trim().length >= 4000) throw new Error(`the brain text is ${brain[1].trim().length} characters: the box on her page holds 4,000`);
  return { brain: brain[1].trim(), notes: notes[1].trim() };
}

/**
 * Upload what has changed, then save her on RFab: ONE body, ONE brain, ONE avatar. What
 * exists already (content/lore/yoke-avatar.json) is updated in place, never made twice.
 * Nothing here deletes anything.
 */
export async function publishYoke({ voiceId, model } = {}) {
  const m = writeManifest();
  if (!m.states.idle) throw new Error('she has no idle clip yet: bake first');
  const idsFile = path.join(LORE, 'yoke-avatar.json');
  const ids = readJson(idsFile) ?? {};
  const rfab = m.rfab ?? { states: {}, sizes: {} };
  for (const [id, file] of Object.entries(m.states)) {
    if (ALIASES[id]) continue;
    const bytes = fs.statSync(path.join(OUT, file)).size;
    if (rfab.states[id] && rfab.sizes?.[id] === bytes) continue;
    rfab.states[id] = await uploadClip(path.join(OUT, file), id);
    rfab.sizes = { ...(rfab.sizes ?? {}), [id]: bytes };
    console.log(`[yoke] uploaded ${id}`);
    fs.writeFileSync(MANIFEST, `${JSON.stringify({ ...m, rfab }, null, 1)}\n`);
  }
  const states = Object.fromEntries(Object.keys(m.states).map((id) => [id, rfab.states[ALIASES[id] ?? id]]));
  const saved = await call('POST', '/api/vtuber-models', {
    ...(ids.liveModelId ? { id: ids.liveModelId } : {}),
    // track 'both' is the studio's default; her clips are hers alone, so no camera or microphone is ever asked of anyone by the game.
    model: { name: YOKE_NAME, states, oneShot: m.oneShot, swapMode: 'fade', fadeMs: 180 },
  });
  ids.liveModelId = saved.id;
  console.log(`[yoke] body saved: ${saved.id} (${Object.keys(states).length} states)`);
  fs.writeFileSync(MANIFEST, `${JSON.stringify({ ...m, rfab: { ...rfab, liveModelId: saved.id } }, null, 1)}\n`);

  const { brain, notes } = brainText();
  if (ids.agentId) {
    await call('PUT', `/api/autonomous-ai/agents/${ids.agentId}`, { hardCodedPersonality: brain, evolvingPersonality: notes });
    console.log(`[yoke] brain text updated on ${ids.agentId} (${brain.length} characters)`);
  } else {
    const made = await call('POST', '/api/autonomous-ai/agents', {
      // What the Living Avatars page itself sends when it makes a mind: a talker, with no tools that need a computer.
      // "Living Avatar" is the description RFab knows an avatar's mind by: such a mind gets no tools, only speech.
      type: 'active', name: YOKE_NAME, shortDescription: 'Living Avatar', hardCodedPersonality: brain, evolvingPersonality: notes,
      nsfw: false, enabledActions: { readChat: true }, ...(model ? { defaultModel: model } : {}),
    });
    ids.agentId = (made.agent ?? made).id;
    if (!ids.agentId) throw new Error(`the agent was not made: ${JSON.stringify(made).slice(0, 200)}`);
    console.log(`[yoke] brain made: ${ids.agentId} (${brain.length} characters)`);
  }
  ids.voiceId = voiceId ?? ids.voiceId ?? 'aura-2-thalia-en';
  if (ids.avatarId) {
    await call('PUT', `/api/avatars/${ids.avatarId}`, { agentId: ids.agentId, liveModelId: ids.liveModelId, voiceId: ids.voiceId, visitorsCanTalk: false, isPublic: false });
    console.log(`[yoke] avatar updated: ${ids.avatarId}`);
  } else {
    const made = await call('POST', '/api/avatars', { name: YOKE_NAME, agentId: ids.agentId, liveModelId: ids.liveModelId, voiceId: ids.voiceId, nsfw: false });
    ids.avatarId = made.avatar?.id;
    if (!ids.avatarId) throw new Error(`the avatar was not made: ${JSON.stringify(made).slice(0, 200)}`);
    ids.createdAt = made.avatar.createdAt ?? new Date().toISOString();
    console.log(`[yoke] avatar made: ${ids.avatarId}`);
  }
  // Ids are not secrets. The API key is, and is never written anywhere.
  const out = { avatarId: ids.avatarId, agentId: ids.agentId, liveModelId: ids.liveModelId, voiceId: ids.voiceId, createdAt: ids.createdAt };
  fs.writeFileSync(idsFile, `${JSON.stringify(out, null, 1)}\n`);
  return out;
}

export async function makeYoke({ bakeOnly = false, stillsOnly = false, publish = false, only, voiceId, model } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  if (publish) return publishYoke({ voiceId, model });
  const list = STATES.filter((s) => !only?.length || only.includes(s.id));
  if (!bakeOnly) {
    await stills(list);
    if (stillsOnly) return null;
    await clips(list);
  }
  return bakeYoke(only);
}

