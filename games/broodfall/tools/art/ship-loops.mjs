/**
 * THE SHIP'S ROOMS AS SLOW LOOPS (Sep 30 2026; notes/TO-CREATE.md "The ship's rooms are stills; the
 * concept asked for slow loops (hum, blinking consoles)" and "The hero seen from behind in each room").
 *
 *   node tools/art/ship-loops.mjs --stills         the 16:9 stills only (LOOK at them before paying for clips)
 *   node tools/art/ship-loops.mjs [ids]            stills, clips, bake (what is on disk is skipped)
 *   node tools/art/ship-loops.mjs --bake [ids]     bake again from what is on disk (free)
 *
 * 1. THE STILL (art-src/ship-loops/<id>.png, 1536x864): the room's approved still (art-src/ship/room-<id>.png,
 *    never touched) cut to 16:9 and EDITED so the man in it is the same man in every room: the hero of the
 *    concepts (hero-behind-desk.png, r4-hero-bunk.png), seen from behind, in the clothes of the data pad clip
 *    (a plain black high-collared shirt, sleeves pushed up, stylus behind his ear). The first stills had him in
 *    a long coat in three rooms and a shirt in the other three. The planet in Comms' window becomes the
 *    infested one of the menu loop. The Quarters are his sleeping cell seen from its doorway, EMPTY (he is the
 *    one standing in the doorway): tools/art/intro.mjs `quarters` draws that still; it is only cut to 16:9 here.
 *    He is BAKED into each loop (not a separate layer): one picture, one light, and he breathes with the room.
 * 2. THE CLIP (art-src/ship-loops/<id>-clip.mp4): image to video with the END frame = the START frame
 *    (seegen: models honour an end frame), 8 s, 1080p, 16:9, camera locked, subtle motion only.
 * 3. THE BAKE (public/art/ship/loops/room-<id>.mp4 + room-<id>.webp, the loop's own first frame as its
 *    poster, and loops.json): frame 0 (the uploaded still, it flashes) is dropped; the last frames where the
 *    model SNAPS to the end frame are cut; if the seam still shows, the last 0.75 s is crossfaded into the
 *    first (the menu loop's method, tools/art/intro.mjs bakeMenu). Review: notes/art-review/ship-loops/.
 *
 * The game (src/ui/campaignUi.ts `dress`) plays the room's loop behind the screen, the poster under it;
 * without a loop (or with Settings > Reduce motion) the still is shown as before. To draw one again, MOVE
 * its files into art-src/ship-loops/v1/ (never delete) and run again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { balance, ffmpeg, makeClip, makeStill, pool, ready, spent } from './rfab.mjs';
import { ART, REVIEW, ROOT, SRC } from './lib/manifest.mjs';

const DIR = path.join(SRC, 'ship-loops');
const OUT = path.join(ART, 'ship', 'loops');
const REV = path.join(REVIEW, 'ship-loops');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const MODEL = process.env.SHIP_LOOP_MODEL || 'seegen:sd2-fast';
const RES = process.env.SHIP_LOOP_RES || '1080p';
const SECONDS = Number(process.env.SHIP_LOOP_SECONDS || 8);

const HERO = 'the same slight young man as in the second reference picture, about twenty-five, short untidy dark hair, ' +
  'a thin pale stylus tucked behind his right ear, wearing a plain black high-collared shirt with a narrow white collar ' +
  'band, its sleeves pushed up to the elbows, and plain black trousers (NOT a long coat, NOT a robe)';
const NONE = 'No text anywhere: no letters, no words, no numbers, no logos, no badges. No religious symbol of any kind ' +
  '(no crosses, no stars, no crescents). Keep the one small plain gear symbol on the wall exactly as it is, if there is one.';
const EDIT = (what) => 'Edit the first reference picture. Keep the room EXACTLY as it is: the same camera, framing, walls, ' +
  `furniture, light strips, colours and darkness, photoreal like a frame from a serious hard science-fiction film. ${what} ` +
  `He is seen from behind (or from behind at a slight angle), so that we never see his face. ${NONE}`;
const MAN = (pose) => `Replace the man in the room with ${HERO}, ${pose}, in the same place and at the same size as the man he replaces.`;

const LOCK = 'Camera completely locked: no zoom, no pan, no dolly, no cuts. Nothing appears, nothing leaves the room. ' +
  'The man never turns around and his face is never seen; he moves only a little. The clip ends exactly on the first ' +
  'picture again. No text appears anywhere.';

export const ROOMS = [
  { id: 'desk', from: 'room-desk', crop: 40,
    still: EDIT(MAN('standing at the far left, looking at the round projection plinth, his hands at his sides')),
    clip: 'A quiet room aboard a starship, a slow hum. The round top of the projection plinth glows and breathes slowly ' +
      'brighter and dimmer; faint motes of dust drift through its light; the thin light strips flicker very faintly. The ' +
      `man stands still, breathing, shifting his weight a little. ${LOCK}` },
  { id: 'genes', from: 'room-genes', crop: 40,
    still: EDIT(MAN('standing beside the tall glass cylinder, watching the red culture, a thin tablet in his hand')),
    clip: 'A clean laboratory aboard a starship. Inside the tall glass cylinder the round red culture floats and turns very ' +
      'slowly, small bubbles rise through the clear fluid, and the thin robotic arms make tiny precise adjustments around ' +
      `it. The man watches, breathing, glancing down at the tablet in his hand once. ${LOCK}` },
  { id: 'locker', from: 'room-locker', crop: 40,
    still: EDIT(MAN('sitting on the plain stool at the work shelf, bent over it, working on something small with both hands')),
    clip: 'A quiet corner of a starship. The man sits at the shelf working on something tiny with small careful movements ' +
      'of his hands and elbows; the thin light strips along the shelf and the ceiling hum and flicker very faintly; the ' +
      `glass jars glint. ${LOCK}` },
  { id: 'board', from: 'room-board', crop: 40,
    still: EDIT(MAN('standing straight-backed at the thin terminal set in the wall at the left, his hands at his sides')),
    clip: 'A bare formal alcove aboard a starship. On the razor-thin display of the terminal, pale ruled lines scroll ' +
      'slowly upward and a small cursor blinks; the thin light strips hum faintly. The man stands straight, reading, ' +
      `breathing, his head tilting a little. ${LOCK}` },
  // Oct 4 2026 (Collins, of this room: "his hand is sitting in an impossible position"): the hand on the dial was a right
  // hand drawn on his left arm. `fix`: the still is redrawn FROM THE LOOP'S OWN FIRST FRAME with only his arms changed (his
  // left hand lies flat on the console, a pose with nothing to get wrong; two other poses were drawn and set aside:
  // art-src-new/ship-loops/comms-fixA.png, a grip on a dial, and comms-fixC.png, his hands out of sight). The clip no longer
  // has him turn a dial: a hand a video model moves is a hand it redraws.
  { id: 'comms', from: 'room-comms', crop: 40, refs: ['menu'],
    fix: 'Edit the reference picture. Keep everything EXACTLY as it is: the room, the camera, the framing, the three displays, the ' +
      'console with its keys and dials, the bench, the long window onto the planet, the light and the darkness, and the man ' +
      'himself: his place, his size, his black high-collared shirt with the sleeves pushed up, his dark hair, the stylus behind ' +
      'his ear, seen from behind so that his face is never seen. Change ONLY his arms and hands, which are drawn wrong in the ' +
      'reference: his LEFT forearm rests along the near edge of the console at his left, relaxed, the elbow bent naturally; the ' +
      'hand lies flat, palm down, the back of the hand toward us, fingers together pointing forward toward the displays, the ' +
      'thumb on the side nearer his body. It is plainly a left hand on a left arm, with a natural wrist. No bracelet on it. His ' +
      'right arm rests relaxed at his right side, the forearm on his right thigh. Photoreal, like a frame from a serious hard ' +
      'science-fiction film. No text anywhere: no letters, no numbers, no logos. Keep the small plain gear symbol on the wall ' +
      'exactly as it is.',
    still: EDIT(`${MAN('sitting on the hard bench facing the displays at the left, one hand on the console')} The planet seen ` +
      'through the long window slit is now the planet of the third reference picture: its night side, dark continents with ' +
      'pale golden city lights and a spreading dark red veined stain of infection with a few glowing orange points, a thin ' +
      'blue line of atmosphere along its curve, black space above. Not green, not blue oceans in daylight.'),
    clip: 'The communications alcove of a starship. On the three thin displays, soft white static and signal traces ' +
      'flicker and crawl; small indicator lights on the console blink slowly. Through the long window slit the dark infested ' +
      'planet turns very slowly, its red veins pulsing faintly. The man sits, breathing; his hand lies flat on the console ' +
      'and stays exactly where it is, its fingers still. ' +
      LOCK },
  { id: 'ai', from: 'room-ai', crop: 40,
    still: EDIT(MAN('standing at the left facing the low round dais, relaxed, one hand in a trouser pocket')),
    clip: 'The core of a starship\'s artificial intelligence. The ring of white light on the dais breathes slowly brighter ' +
      'and dimmer; far back, tiny lights on the rows of black processing columns blink on and off at random; a low hum. ' +
      `The air above the dais stays empty. The man stands relaxed, breathing, shifting his weight a little. ${LOCK}` },
  { id: 'quarters', from: 'quarters', crop: 80, empty: true,
    clip: 'A tiny sleeping cell aboard a starship, empty and still. Through the large window the dark infested planet turns ' +
      'very slowly far below, its red veins and orange points of burning cities pulsing faintly; the thin line of white ' +
      'light along the ceiling hums very faintly. Nothing else moves; no person. Camera completely locked: no zoom, no pan, ' +
      'no cuts. The clip ends exactly on the first picture again. No text appears anywhere.' },
  // Oct 1 2026 (notes/VIDEO-AUDIT.md): the Empire Directives and the Notebook borrowed the Board's and the Locker's
  // loops; each is its own room now. The still is a NEW room drawn from the borrowed one (its style, light, darkness).
  { id: 'orders', from: 'room-board', crop: 40,
    still: 'Draw a different room of the same starship as the first reference picture, in exactly its style: the same ' +
      'black panelled walls, thin cold white light strips, darkness and photoreal look of a serious hard science-fiction ' +
      'film, 16:9. This is the Office of Empire Directives: a narrow formal room. In the far wall a slim steel slot ' +
      'from which a single blank pale sheet hangs half out; beside it a plain steel tray with a neat stack of blank ' +
      'sheets; a small square indicator light on the slot; a tall narrow black lectern in the middle of the floor. ' +
      `${HERO} stands at the lectern, seen from behind, reading a blank sheet held in both hands, so that we never see ` +
      `his face. ${NONE}`,
    clip: 'A narrow formal office aboard a starship. The small indicator light on the wall slot blinks slowly; the blank ' +
      'sheet hanging from the slot stirs very slightly in the air from a vent; the thin light strips hum and flicker very ' +
      `faintly. The man stands at the lectern reading, breathing, tilting the sheet a little. ${LOCK}` },
  { id: 'hobby', from: 'room-locker', crop: 40, refs: ['hobby'],
    still: 'Draw a different corner of the same starship as the first reference picture, in exactly its style: the same ' +
      'black panelled walls, thin cold white light strips, darkness and photoreal look of a serious hard science-fiction ' +
      'film, 16:9. His own small corner at night: a narrow fold-down desk against the wall, a small desk lamp giving the ' +
      'only warm light, a thin pad on the desk glowing a soft holographic blue with a few loose pale blue pages of simple ' +
      'doodles projected just above it, like the third reference picture (drawings of beetles, a cage, tally marks; no ' +
      `writing), a shelf of small specimen jars above. ${HERO} sits on a plain stool at the desk, seen from behind, ` +
      `leaning over the pad, drawing with his stylus, so that we never see his face. ${NONE}`,
    clip: 'His small corner of a starship at night. The pale blue projected pages over the desk shimmer and drift very ' +
      'slightly; the small desk lamp glows warmly; the jars on the shelf glint; the light strips hum faintly. The man ' +
      `bends over the pad, drawing with small careful movements of his stylus hand, breathing. ${LOCK}` },
];

const SOURCE = (r) => (r.from === 'quarters' ? path.join(SRC, 'intro', 'pictures', 'quarters.png') : path.join(SRC, 'ship', `${r.from}.png`));
const REFS = { menu: path.join(SRC, 'intro', 'menu.png'), hobby: path.join(CONCEPTS, 'r4-hobby-interface.png') };
const raw = (id, what) => path.join(DIR, `${id}${what}`);

/** The approved still cut to 16:9 (1536x864 from `crop` px down): what the edit (or, for an empty room, the clip) starts from. */
function cut169(r) {
  const out = raw(r.id, '-src169.png');
  if (!fs.existsSync(out)) ffmpeg(['-i', SOURCE(r), '-vf', `scale=1536:1024,crop=1536:864:0:${r.crop}`, out], `${r.id} 16:9`);
  return out;
}

/** The still the clip starts and ends on. */
const stillOf = (r) => (r.empty ? cut169(r) : raw(r.id, '.png'));

/** A room being corrected (`fix`): its still is redrawn from the first frame of the loop the game has now. */
async function fixes(items) {
  for (const r of items.filter((x) => x.fix && !fs.existsSync(raw(x.id, '.png')))) {
    const loop = path.join(OUT, `room-${r.id}.mp4`);
    if (!fs.existsSync(loop)) { console.warn(`[ship-loops] ${r.id}: no loop to correct`); continue; }
    const from = raw(r.id, '-fixfrom.png');
    ffmpeg(['-i', loop, '-frames:v', '1', '-vf', 'scale=1536:864:flags=lanczos', from], `${r.id} loop first frame`);
    await makeStill({ slug: `ship-loop ${r.id} fix`, out: raw(r.id, '.png'), prompt: r.fix, key: null, width: 1536, height: 864, quality: 'high', refFiles: [from] });
  }
}

async function stills(items) {
  await fixes(items);
  const res = await pool(items.filter((r) => !r.empty && !r.fix && fs.existsSync(SOURCE(r))), 4, (r) => makeStill({
    slug: `ship-loop ${r.id}`, out: raw(r.id, '.png'), prompt: r.still, key: null, width: 1536, height: 864, quality: 'high',
    refFiles: [cut169(r), path.join(CONCEPTS, 'hero-behind-desk.png'), ...(r.refs ?? []).map((k) => REFS[k])].filter((f) => fs.existsSync(f)),
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[ship-loops] still failed: ${x.error.message.slice(0, 200)}`); });
  for (const r of items.filter((x) => x.empty && fs.existsSync(SOURCE(x)))) cut169(r);
}

async function clips(items) {
  const go = items.filter((r) => fs.existsSync(stillOf(r)));
  const res = await pool(go, 4, (r) => makeClip({
    slug: `ship-loop-${r.id}`, stillFile: stillOf(r), out: raw(r.id, '-clip.mp4'), models: [MODEL],
    prompt: r.clip, seconds: SECONDS, loop: true, raw: true, resolution: RES, aspect: '16:9',
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[ship-loops] ${go[i].id} clip failed: ${x.error.message.slice(0, 200)}`); });
}

// ---- the bake ----

const probe = (file, what) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', what, '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim();
const duration = (file) => Math.round(Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim()) * 1000) / 1000;

function greyFrames(file) {
  const W = 64, H = 36;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 256 * 1024 * 1024 });
  const n = Math.floor(r.stdout.length / (W * H));
  return Array.from({ length: n }, (_, i) => r.stdout.subarray(i * W * H, (i + 1) * W * H));
}
const diff = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]); return d / a.length; };
const ENC = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const FPS = 24;

function bakeLoop(r) {
  const clip = raw(r.id, '-clip.mp4');
  if (!fs.existsSync(clip)) return null;
  fs.mkdirSync(OUT, { recursive: true });
  const [w, h] = probe(clip, 'stream=width,height').split(',').map(Number);
  const W = Math.min(1920, w - (w % 2)), H = Math.round((W * 9) / 16 / 2) * 2;
  const tmp = raw(r.id, '-plain.mp4');
  ffmpeg(['-i', clip, '-vf', `trim=start_frame=1,setpts=PTS-STARTPTS,scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`,
    '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', tmp], `${r.id} plain`);
  let f = greyFrames(tmp);
  const steps = f.slice(1).map((x, i) => diff(f[i], x));
  const step = [...steps].sort((a, b) => a - b)[steps.length >> 1];
  let snap = f.length;
  for (let i = Math.max(1, f.length - 12); i < f.length; i++) if (steps[i - 1] > Math.max(0.6, 3 * step)) { snap = i; break; }
  if (snap < f.length) {
    const cut = raw(r.id, '-cut.mp4');
    ffmpeg(['-i', tmp, '-vf', `trim=end_frame=${snap},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', cut], `${r.id} cut snap`);
    fs.renameSync(cut, tmp);
    f = greyFrames(tmp);
  }
  const seam = diff(f[f.length - 1], f[0]);
  const out = path.join(OUT, `room-${r.id}.mp4`);
  let fixed = snap < steps.length + 1 ? `cut ${steps.length + 1 - snap} snapping frames; ` : '';
  if (seam > Math.max(0.5, 3 * step)) {
    const L = duration(tmp);
    const D = 0.75;
    const k = (D - 1 / FPS).toFixed(4);
    ffmpeg(['-i', tmp, '-filter_complex',
      `[0:v]split=3[t][h][m];[t]trim=start=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[T];` +
      `[h]trim=end=${D},setpts=PTS-STARTPTS[H];[m]trim=start=${D}:end=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[M];` +
      `[T][H]blend=all_expr='A*(1-min(T/${k},1))+B*min(T/${k},1)'[X];[X][M]concat=n=2:v=1,format=yuv420p[v]`,
    '-map', '[v]', ...ENC, out], `${r.id} crossfade`);
    fixed += `crossfade ${D}s`;
  } else {
    ffmpeg(['-i', tmp, ...ENC, out], `${r.id} encode`);
    fixed += 'none';
  }
  // The poster IS the loop's first frame, so the picture under the video never jumps when it starts.
  ffmpeg(['-i', out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '86', path.join(OUT, `room-${r.id}.webp`)], `${r.id} poster`);
  // A corrected room (`fix`): the room's plain still (what the game shows when the loops' list has not arrived) is the
  // corrected picture too, so no copy of the old one is left in what ships (tools/art/templates/ship.mjs leaves it be).
  if (r.fix) ffmpeg(['-i', out, '-frames:v', '1', '-vf', 'scale=1536:864:flags=lanczos', '-c:v', 'libwebp', '-quality', '84', path.join(ART, 'ship', `room-${r.id}.webp`)], `${r.id} still`);
  const g = greyFrames(out);
  const gs = g.slice(1).map((x, i) => diff(g[i], x));
  const sorted = [...gs].sort((a, b) => a - b);
  const secs = duration(out);
  // Review sheet: the still it started from, the loop's first, middle and last frames.
  fs.mkdirSync(REV, { recursive: true });
  const tiles = [
    [stillOf(r), 0], [out, 0], [out, secs / 2], [out, Math.max(0, secs - 1.5 / FPS)],
  ].map(([file, t], i) => {
    const jpg = raw(r.id, `-rev${i}.jpg`);
    ffmpeg(['-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', 'scale=768:432', '-q:v', '3', jpg], `${r.id} tile`);
    return jpg;
  });
  ffmpeg([...tiles.flatMap((t) => ['-i', t]), '-filter_complex', '[0][1][2][3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]', '-map', '[v]', '-q:v', '4',
    path.join(REV, `${r.id}.jpg`)], `${r.id} sheet`);
  const meta = fs.existsSync(raw(r.id, '-clip.json')) ? JSON.parse(fs.readFileSync(raw(r.id, '-clip.json'), 'utf8')) : {};
  const report = {
    id: r.id, model: meta.model, seconds: secs, size: `${W}x${H}`, bytes: fs.statSync(out).size,
    medianStep: +sorted[sorted.length >> 1].toFixed(2), maxStep: +sorted[sorted.length - 1].toFixed(2),
    seamBefore: +seam.toFixed(2), seamAfter: +diff(g[g.length - 1], g[0]).toFixed(2), fixed,
    tiles: 'still it started from | loop first frame | middle | last frame',
  };
  fs.writeFileSync(path.join(REV, `${r.id}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(`[ship-loops] baked ${r.id}: ${JSON.stringify(report)}`);
  return { video: `ship/loops/room-${r.id}.mp4`, poster: `ship/loops/room-${r.id}.webp`, seconds: secs };
}

export function bakeLoops(only) {
  const file = path.join(OUT, 'loops.json');
  const json = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { rooms: {} };
  for (const r of ROOMS) {
    if (only?.length && !only.includes(r.id)) continue;
    const e = bakeLoop(r);
    // The room's entry also carries its arrival (tools/art/ship-arrivals.mjs): kept. A loop baked again has a new first
    // frame, so that arrival no longer ends on it: make it again (tests/shipArrivals.test.ts fails until it is).
    if (e) json.rooms[r.id] = { ...json.rooms[r.id], ...e };
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  return json;
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const ids = args.filter((a) => !a.startsWith('--'));
const items = ROOMS.filter((r) => !ids.length || ids.includes(r.id));
fs.mkdirSync(DIR, { recursive: true });
if (!flags.has('--bake')) {
  ready();
  const before = await balance();
  await stills(items);
  if (!flags.has('--stills')) await clips(items);
  const after = await balance();
  console.log(`[ship-loops] asked for ${spent.stills} stills, ${spent.clips} clips; balance ${before} -> ${after} (${before - after} tokens)`);
}
if (!flags.has('--stills')) bakeLoops(ids);
