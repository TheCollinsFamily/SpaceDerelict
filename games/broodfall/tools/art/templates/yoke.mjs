/**
 * THE YOKE TEMPLATE: the ship AI's body, for RFab's Living Avatars and for the game.
 *
 * A Living Avatar's body is a set of transparent clips, one per STATE (idle, speaking,
 * happy, nod ...). RFab's overlay plays them on a 1280x720 stage; the game plays the same
 * files in the AI Core, with no network.
 *
 *   her approved idle still (the ONE reference) -> a take of every state from it, made the way
 *   Leaflit's AI VTuber Studio makes them (its video model, its prompts, its ChromaKey, its
 *   Ping-Pong: tools/art/lib/leaflit.mjs) -> "the projection" -> a WebM with transparency ->
 *   public/art/ship/yoke/ (the game) and the same files on RFab (--publish)
 *
 *   node tools/art/make.mjs yoke                    every state (SPENDS tokens; skips what is on disk)
 *   node tools/art/make.mjs yoke idle happy         some states
 *   node tools/art/make.mjs yoke --stills           stop after the reference still
 *   node tools/art/make.mjs yoke --bake             key and encode again from the takes on disk (free)
 *   node tools/art/make.mjs yoke --publish          upload the clips to RFab and save her there (content/lore/yoke-avatar.json)
 *
 * Takes are in art-src/yoke/leaflit/. To make one again, MOVE it into art-src/yoke/leaflit/old/
 * first (never delete). A take is 77,000 tokens (the studio's model is billed a flat 10 s).
 * The first body (Sep 29 2026: a still per face, our own keyer) is in art-src/yoke/*.mp4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { API_BASE, makeStill, pool } from '../rfab.mjs';
import { blank, borderColour, crop, paste, readImage, resize, writeJpg, writePng } from '../lib/img.mjs';
import { fringe, keyOf } from '../lib/key.mjs';
import { STUDIO_VIDEO_MODEL, craftPrompt, frameList, generateTake, keyFrame, loadChromaKey, studioKeyer, uploadSprite } from '../lib/leaflit.mjs';
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
 * Her body, made the way LEAFLIT'S AI VTUBER STUDIO makes one (tools/art/lib/leaflit.mjs):
 * every clip is a take from the ONE reference (her approved idle still, the studio's
 * "Sprite Prep"), on the studio's own video model, with the studio's own prompt prefix;
 * keyed by the studio's own ChromaKey; looped by its Ping-Pong. So every clip starts,
 * and ends, on the same frame, and the hand-over from one to the next never jumps.
 *
 *   kind  'loop'    Ping-Pong over [0, end] (the studio's default for a held state)
 *         'hold'    a look: turn, hold, turn back (craftHoldPrefix), Ping-Pong over the turn
 *         'oneShot' played once, No Loop, then back to idle (RFab: a gesture, [MOTION:name])
 *   end   where the take is cut (the studio's End Frame): 'back' = the first frame after the
 *         move where she is back on her reference pose; a number = that many seconds
 *
 * The ids are the studio's standard set (app.js MODEL_STATES + EXTRA_PRESETS), RFab's
 * avatar vocabulary (avatarEmbodimentService.js CANONICAL), and her own beats (Collins,
 * Sep 30 2026: laugh, pensive, shrug, teasing, dont_pout, pout, disgust, hype).
 */
const SHUT = ' Her mouth stays closed.';
export const STATES = [
  // --- the core four ---
  { id: 'idle', kind: 'loop', end: 4, motion: 'Gentle breathing idle animation, subtle body sway, occasional slow blink.' + SHUT },
  { id: 'speaking', kind: 'loop', end: 4, motion: 'Character talking animatedly, mouth opening and closing naturally, small head gestures, occasional blink.' },
  { id: 'intro', kind: 'oneShot', end: 'back', motion: 'Character pops into a confident, playful little wave hello with a sly grin, one open hand with five fingers beside her shoulder, then lowers the hand out of the picture.' },
  { id: 'outro', kind: 'oneShot', end: 'back', motion: 'Character gives a quick, cheeky two-finger salute goodbye from her brow with a crooked smile, then lowers the hand out of the picture.' },
  // --- expressions: a quiet half and a talking half ---
  { id: 'happy', kind: 'loop', end: 4, motion: 'Character beaming with a big pleased smile, eyes bright with delight, bouncing slightly.' },
  { id: 'happy_talk', kind: 'loop', end: 4, motion: 'Character talks animatedly with a big happy smile, eyes bright with delight, mouth opening and closing naturally between grins, bouncing slightly.' },
  { id: 'sad', kind: 'loop', end: 4, motion: 'Character looking sad and dejected, drooping shoulders, downcast eyes.' + SHUT },
  { id: 'sad_talk', kind: 'loop', end: 4, motion: 'Character talks quietly while looking sad and dejected, drooping shoulders, downcast eyes, mouth moving in a subdued way.' },
  { id: 'angry', kind: 'loop', end: 4, motion: 'Character visibly annoyed, furrowed brows, a cold narrow glare at the viewer, small frustrated huffs through her nose.' + SHUT },
  { id: 'angry_talk', kind: 'loop', end: 4, motion: 'Character talks heatedly while visibly annoyed, furrowed brows, sharp emphatic head gestures, mouth moving in a ranting way.' },
  { id: 'surprised', kind: 'loop', end: 4, motion: 'Character shocked and surprised, wide eyes, eyebrows raised high, lips parted in a small gasp, drawing her head back a little.' },
  { id: 'surprised_talk', kind: 'loop', end: 4, motion: 'Character talks excitedly while shocked and surprised, wide eyes, eyebrows raised high, quick animated mouth movements.' },
  { id: 'thinking', kind: 'loop', end: 4, motion: 'Character deep in thought, one hand on her chin, eyes narrowed and drifting upward, slow considering nods, occasionally tapping her chin.' + SHUT },
  { id: 'thinking_talk', kind: 'loop', end: 4, motion: 'Character talks while thinking hard, one hand on her chin, eyes drifting upward between words, slow considering gestures, mouth moving naturally.' },
  { id: 'laughing', kind: 'loop', end: 4, motion: 'Character laughing joyfully, eyes closing in happy curves, mouth open in a laugh, shoulders shaking.' },
  { id: 'blushing', kind: 'loop', end: 4, motion: 'Character blushing and flustered, a faint pink blush on her cheeks, glancing away bashfully, small embarrassed smile.' + SHUT },
  { id: 'hand_raised', kind: 'hold', end: 'back', motion: 'Character raises one open hand beside her shoulder, palm toward the viewer, five fingers, as if asking for a moment, HOLDS it there with gentle breathing, then lowers it out of the picture.' + SHUT },
  // --- her own beats (Collins, Sep 30 2026: spunky, playful, edgy) ---
  { id: 'pensive', kind: 'loop', end: 5, motion: 'Character lost in thought, her gaze drifting slowly off to one side and down, brows faintly knitted, turning something odd over in her mind, a small puzzled frown, one slow blink.' + SHUT },
  { id: 'teasing', kind: 'loop', end: 4, motion: 'Character wears a sly teasing smirk, one eyebrow raised, eyes half-lidded and amused, head tilted slightly, a knowing mischievous look at the viewer.' + SHUT },
  { id: 'dont_pout', kind: 'loop', end: 4, motion: 'Character tilts her head with a mock-sympathetic face, brows raised in exaggerated pity, her lower lip pushed out in a playful little pout of her own as if saying "aww, do not pout", then a small teasing smile.' },
  { id: 'laugh', kind: 'oneShot', end: 'back', motion: 'Character bursts out laughing, throwing her head back, genuinely amused, eyes closed, shoulders shaking, then catches her breath with a grin and looks back at the viewer.' },
  { id: 'shrug', kind: 'oneShot', end: 'back', motion: 'Character tosses ONE open hand up beside her shoulder, palm up, in a playful one-handed shrug, head tilted, eyebrows raised as if saying "but...", then drops the hand out of the picture.' },
  { id: 'pout', kind: 'loop', end: 4, motion: 'Character sulking with a small pout, lower lip pushed out, cheeks slightly puffed, eyes glancing up at the viewer from under her fringe, as if asking "you are not going to forget about me?".' + SHUT },
  { id: 'disgust', kind: 'oneShot', end: 'back', motion: 'Character pulls a comic face of disgust: she wrinkles her nose, sticks her tongue out and recoils with a gagging "ew" grimace, leaning back, then shakes it off and composes herself.' },
  { id: 'hype', kind: 'oneShot', end: 'back', motion: 'Character lights up with excitement, eyes wide and sparkling, a huge open grin, pumping one fist up beside her shoulder, as if saying "that was sick!", then settles back.' },
  // --- looks: turn, hold, turn back; with a talking twin each ---
  { id: 'look_left', kind: 'hold', end: 'back', motion: 'Character turns her head to the left, facing toward the left edge of the frame. Holds that leftward-facing pose with gentle idle motion, breathing, occasional blink, then turns back to face forward and ends in the same pose she started in.' + SHUT },
  { id: 'look_right', kind: 'hold', end: 'back', motion: 'Character turns her head to the right, facing toward the right edge of the frame. Holds that rightward-facing pose with gentle idle motion, breathing, occasional blink, then turns back to face forward and ends in the same pose she started in.' + SHUT },
  { id: 'look_up', kind: 'hold', end: 'back', motion: 'Character raises her chin to gaze upward, holds that pose dreamily with gentle idle motion, occasional slow blink, then lowers her chin back to face forward and ends in the same pose she started in.' + SHUT },
  { id: 'look_down', kind: 'hold', end: 'back', motion: 'Character tilts her head downward as if reading below, holds that pose with gentle idle motion, then raises her head back to face forward and ends in the same pose she started in.' + SHUT },
  { id: 'look_left_talk', kind: 'hold', end: 'back', motion: 'Character turns her head to the left, facing toward the left edge of the frame, and talks animatedly while staying turned left. Mouth opening and closing naturally, small head gestures, then turns back to face forward and ends in the same pose she started in.' },
  { id: 'look_right_talk', kind: 'hold', end: 'back', motion: 'Character turns her head to the right, facing toward the right edge of the frame, and talks animatedly while staying turned right. Mouth opening and closing naturally, small head gestures, then turns back to face forward and ends in the same pose she started in.' },
  { id: 'look_up_talk', kind: 'hold', end: 'back', motion: 'Character raises her chin and talks animatedly while gazing upward, mouth moving naturally, then lowers her chin back to face forward and ends in the same pose she started in.' },
  { id: 'look_down_talk', kind: 'hold', end: 'back', motion: 'Character tilts her head downward and talks animatedly while looking down, mouth moving naturally, then raises her head back to face forward and ends in the same pose she started in.' },
  // --- face tricks (the overlay's TRICK_STATES) ---
  { id: 'wink', kind: 'oneShot', end: 'back', motion: 'Character giving a playful wink with ONE eye closed while the other stays open, cheeky smile, small head tilt.' },
  { id: 'tongue_out', kind: 'oneShot', end: 'back', motion: 'Character playfully sticking her tongue out at the viewer, teasing mischievous expression, eyes bright.' },
  { id: 'kiss', kind: 'oneShot', end: 'back', motion: 'Character blowing a kiss at the viewer with puckered lips and a light touch of her fingertips to her lips, one eye winking. Nothing floats away.' },
  { id: 'puff', kind: 'oneShot', end: 'back', motion: 'Character puffing her cheeks out comically, pouting, holding her breath with rosy cheeks, then letting the breath out.' },
  // --- gestures ---
  { id: 'wave', kind: 'oneShot', end: 'back', motion: 'Character waving hello with a small quick wave of one open hand with five fingers beside her shoulder and a warm smile, then lowers the hand out of the picture.' },
  { id: 'nod', kind: 'oneShot', end: 'back', motion: 'Character nodding yes with a confident smile, her head going down and up clearly twice.' + SHUT },
  { id: 'shake_head', kind: 'oneShot', end: 'back', motion: 'Character shaking her head no with a firm, amused expression, once to each side.' + SHUT },
  { id: 'dance', kind: 'oneShot', end: 'back', motion: 'Character doing a fun little celebratory dance in place, rhythmic bouncing, shoulders and arms swinging happily, staying in the middle of the picture.' },
  { id: 'jump', kind: 'oneShot', end: 'back', motion: 'Character does one small excited hop in place, bouncing up a little and landing, her head staying inside the picture.' },
  { id: 'bow', kind: 'oneShot', end: 'back', motion: 'Character gives a polite, slightly theatrical bow, bending forward from the waist with her head lowered, then straightens up with a playful smirk.' },
];
/**
 * Faces that are another state's clip under a second name. RFab offers a mind only the
 * EXPRESSIONS of its body, and counts idle and thinking as neither: without these two she
 * would have to be happy, sad or angry in every sentence, and could never simply be calm.
 */
export const ALIASES = { calm: 'idle', thoughtful: 'thinking' };
/** The one reference every take starts from: her approved idle still, framed on the stage. */
const REFERENCE = path.join(DIR, 'idle-framed.png');
const TAKES = path.join(DIR, 'leaflit');
const clipOf = (s) => path.join(TAKES, `${s.id}.mp4`);

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

/** The studio's Sprite Prep: her ONE reference, drawn once from her approved design (it exists: she is approved). */
async function reference() {
  const still = path.join(DIR, 'idle-still.png');
  if (!fs.existsSync(still)) {
    await makeStill({
      slug: 'yoke idle', out: still, width: W, height: H, quality: 'high',
      refFiles: [path.join(CONCEPTS, 'r4-yoke-colour.png'), faceRef('calm')],
      prompt: `An anime illustration of ${HER}. ${FRAMING} Her expression is calm and attentive, with the faintest ` +
        `polite smile, her mouth closed. Her arms hang at her sides and her hands are out of the picture. ${DRAWN}`,
      key: KEY.hex, keyName: KEY.name,
    });
  }
  if (!fs.existsSync(REFERENCE)) console.log('[yoke] reference framed:', JSON.stringify(frame(still, REFERENCE)));
  return REFERENCE;
}

/** The studio's Generate Video: one take per state, all from the one reference. */
async function takes(list) {
  const todo = list.filter((s) => !fs.existsSync(clipOf(s)));
  if (!todo.length) return;
  const spriteUrl = await uploadSprite(await reference());
  const results = await pool(todo, 4, async (s) => {
    console.log(`[yoke] take of ${s.id} on ${STUDIO_VIDEO_MODEL}`);
    await generateTake({ spriteUrl, prompt: craftPrompt(s.motion, s.kind), out: clipOf(s), label: `yoke ${s.id}` });
    console.log(`[yoke] take of ${s.id}: saved`);
  });
  results.forEach((r, i) => { if (!r.ok) console.warn(`[yoke] take of ${todo[i].id} failed: ${r.error.message.slice(0, 200)}`); });
}

/** Every frame of a take at the stage's size, frame 0 (the reference itself) included: the studio keeps it. */
function decode(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file,
    '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos`, '-an', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
  { maxBuffer: 2 * 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${file}: ffmpeg could not read it: ${String(r.stderr).slice(-300)}`);
  const size = W * H * 4;
  const n = Math.floor(r.stdout.length / size);
  return Array.from({ length: n }, (_, i) => ({ w: W, h: H, data: r.stdout.subarray(i * size, (i + 1) * size) }));
}

/** How far a frame is from another (mean RGB difference on a sparse grid, 0..255). */
function distance(a, b) {
  let d = 0, n = 0;
  for (let i = 0; i < a.data.length; i += 4 * 53) {
    d += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    n += 3;
  }
  return d / n;
}

/**
 * The studio's End Frame, chosen as a person chooses it in the Loop Builder: for a move,
 * the first frame after the move in which she is back on her reference pose (frame 0).
 * The move is where she went furthest from it; "back" is within a small step of the
 * nearest she comes to frame 0 again after that.
 */
function endFrame(frames, s) {
  const last = frames.length - 1;
  if (typeof s.end === 'number') return Math.min(last, Math.round(s.end * FPS));
  const d = frames.map((f) => distance(f, frames[0]));
  let peak = Math.round(0.5 * FPS);
  for (let i = peak; i <= last; i++) if (d[i] > d[peak]) peak = i;
  let best = Infinity;
  for (let i = peak; i <= last; i++) best = Math.min(best, d[i]);
  const near = best + Math.max(0.6, (d[peak] - best) * 0.12);
  for (let i = Math.max(peak, Math.round(1.5 * FPS)); i <= last; i++) if (d[i] <= near) return i;
  return last;
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

/**
 * The studio's Model Exporter, on one take: the key colour auto-detected and the similarity
 * calibrated on frame 0, every frame keyed by the studio's ChromaKey, the range cut at the
 * End Frame, Ping-Pong for what loops and No Loop for a move. Then what the studio does not
 * do and the game needs: the checks, the projection, the review pictures, VP8 with alpha.
 */
function bakeState(s) {
  const file = clipOf(s);
  if (!fs.existsSync(file)) return null;
  const all = decode(file);
  const end = endFrame(all, s);
  const raw = all.slice(0, end + 1);
  const first = { w: W, h: H, data: Buffer.from(raw[0].data) };
  const { ck, key: keyRgb, similarity } = studioKeyer(first);
  const frames = raw.map((f) => {
    const img = { w: W, h: H, data: Buffer.from(f.data) };
    keyFrame(ck, img);
    return img;
  });
  const order = frameList(0, frames.length - 1, s.kind !== 'oneShot');
  const kept = order.map((i) => frames[i]);

  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const back = distance(raw[raw.length - 1], raw[0]);
  check(s.kind === 'oneShot' ? 'it ends where it began' : 'the turn comes back (Ping-Pong closes the loop anyway)',
    s.kind === 'loop' || back < 8, Number(back.toFixed(2)));
  let moved = 0;
  for (const f of raw) moved = Math.max(moved, distance(f, raw[0]));
  check('she moves', moved > 1.5, Number(moved.toFixed(2)));
  const key = keyOf(keyRgb);
  const fr = Math.max(...[0, Math.floor(frames.length / 2), frames.length - 1].map((i) => fringe(frames[i], key)));
  check('no green on her outline', fr < 0.05, `${(fr * 100).toFixed(1)}%`);
  let worst = 1, most = 0;
  for (const f of [frames[0], frames[Math.floor(frames.length / 2)], frames[frames.length - 1]]) {
    let solid = 0;
    for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 128) solid++;
    worst = Math.min(worst, solid / (W * H));
    most = Math.max(most, solid / (W * H));
  }
  check('she fills the stage as a person does', worst > 0.12 && most < 0.6, `${(worst * 100).toFixed(0)}-${(most * 100).toFixed(0)}% of it`);
  let topRow = 0;
  for (const f of frames) for (let x = 0; x < W; x += 2) if (f.data[x * 4 + 3] > 128) topRow++;
  check('she stays under the top edge', topRow / frames.length < 12, `${(topRow / frames.length).toFixed(1)} px a frame on row 0`);

  // From here on she is a projection. Frames shared by the Ping-Pong are done once.
  for (const f of frames) project(f);
  fs.mkdirSync(LOOK, { recursive: true });
  const picks = Array.from({ length: 6 }, (_, i) => frames[Math.min(frames.length - 1, Math.floor((i * frames.length) / 5.001))]);
  const tw = 426, th = 240;
  const sheet = blank(6 * tw, 2 * th, [0, 0, 0, 255]);
  picks.forEach((f, i) => { paste(sheet, shown(f, [8, 10, 14], tw, th), i * tw, 0); paste(sheet, shown(f, [236, 236, 232], tw, th), i * tw, th); });
  writeJpg(path.join(LOOK, `${s.id}.jpg`), sheet, 3);
  const box = { x: Math.round(W / 2 - 300), y: 0, w: 600, h: 420 };
  const close = blank(box.w * 2, box.h, [0, 0, 0, 255]);
  paste(close, hairClose(picks[2], [8, 10, 14], box), 0, 0);
  paste(close, hairClose(picks[2], [236, 236, 232], box), box.w, 0);
  writeJpg(path.join(LOOK, `${s.id}-hair.jpg`), close, 2);

  for (const f of frames) bleed(f);
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${s.id}.webm`);
  // VP8 with an alpha plane: what the studio's MediaRecorder export writes, and what its overlay and every Chromium play.
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libvpx', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '1000k', '-crf', '16', '-qmin', '4', '-qmax', '40', '-g', String(FPS * 2), '-an', out],
  { input: Buffer.concat(kept.map((f) => f.data)), maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${s.id}: ffmpeg could not write the WebM: ${String(r.stderr).slice(-300)}`);
  const bytes = fs.statSync(out).size;
  const bad = checks.filter((c) => !c.ok);
  const studio = { keyColour: keyRgb, similarityPct: similarity, endFrame: end, loop: s.kind === 'oneShot' ? 'none' : 'pingpong', chromaKeyFrom: loadChromaKey().from };
  fs.writeFileSync(path.join(LOOK, `${s.id}.json`), `${JSON.stringify({ state: s.id, kind: s.kind, frames: kept.length, seconds: Number((kept.length / FPS).toFixed(2)), kb: Math.round(bytes / 1024), studio, failed: bad.length, checks }, null, 1)}\n`);
  console.log(`[yoke] ${s.id}: ${kept.length} frames (end ${end}, key ${keyRgb.join(',')} at ${similarity}%), ${Math.round(bytes / 1024)} KB, ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  return { id: s.id, file: `${s.id}.webm`, seconds: Number((kept.length / FPS).toFixed(2)), oneShot: s.kind === 'oneShot' };
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
    oneShot: STATES.filter((s) => s.kind === 'oneShot' && states[s.id]).map((s) => s.id),
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
    // styleKey: the studio's art style for this model (app.js STYLE_PRESETS), the one her takes were prompted with.
    model: { name: YOKE_NAME, states, oneShot: m.oneShot, swapMode: 'fade', fadeMs: 180, styleKey: 'anime' },
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
    await reference();
    if (stillsOnly) return null;
    await takes(list);
  }
  return bakeYoke(only);
}
