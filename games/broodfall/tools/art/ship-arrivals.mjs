/**
 * HE WALKS INTO THE ROOM (Collins, Oct 4 2026: "can you build some of the other transitions between different parts of
 * the ship (e.g. ship menus)"). Going to another room of the ship, its backdrop is first the room EMPTY; he walks in
 * with his back to us and takes his place, and the clip ends on the very first frame of that room's slow loop
 * (tools/art/ship-loops.mjs), which carries on from it. The camera is the loop's own, locked, so the screen stays up and
 * usable the whole time: nothing waits on the clip.
 *
 *   node tools/art/ship-arrivals.mjs --stills [ids]   the rooms with nobody in them (LOOK before paying for clips)
 *   node tools/art/ship-arrivals.mjs [ids]            stills, clips, bake (what is on disk is skipped)
 *   node tools/art/ship-arrivals.mjs --bake [ids]     bake again from what is on disk (free)
 *   node tools/art/ship-arrivals.mjs --leave [ids]    a take of him LEAVING, continued from the loop (not in the game)
 *
 * 1. FRAME 0 (art-src-new/ship-arrivals/<id>-frame0.png): the loop's own first frame: where the arrival must END.
 * 2. THE EMPTY ROOM (<id>-empty.png): the picture model takes him out of frame 0 (<id>-edit.png), and ONLY the part of
 *    its picture where he was is laid into frame 0 (found by comparing the two, feathered). Everything else stays
 *    frame 0's own pixels: a clip between two separately drawn pictures of one room morphs the room as it runs (the
 *    pad film's window, Oct 4 2026), and here start and end differ in him alone.
 * 3. THE CLIP (<id>-arrive.mp4): START = the empty room, END = frame 0, camera locked, 1080p like the loops.
 * 4. THE BAKE (public/art/ship/loops/arrive-<id>.mp4 + arrive-<id>.webp, its first frame, and `arrive` in loops.json):
 *    the uploaded still's frame dropped, the pace set, the last half second blended into frame 0 so it ends ON it (a
 *    model lands near its end picture, never on it). The landing is measured first (the clip's REAL last frame against
 *    frame 0): a take that misses is not baked.
 *
 * The game (src/ui/campaignUi.ts `arrive`) plays it when he goes to another room, then starts the loop from its first
 * frame. Not with Settings > Reduce motion. To draw one again, MOVE its files into art-src-new/ship-arrivals/v1/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { balance, ffmpeg, lastFrameOf, makeClip, makeStill, pool, ready, spent } from './rfab.mjs';
import { ART, REVIEW, ROOT } from './lib/manifest.mjs';

const DIR = path.join(ROOT, 'art-src-new', 'ship-arrivals');
const OUT = path.join(ART, 'ship', 'loops');
const REV = path.join(REVIEW, 'ship-arrivals');
const MODEL = process.env.SHIP_ARRIVE_MODEL || 'seegen:wan3.0-video';
const RES = process.env.SHIP_ARRIVE_RES || '1080p';
const W = 1920, H = 1080, FPS = 24;
const raw = (id, what) => path.join(DIR, `${id}${what}`);

const NONE = 'No text anywhere: no letters, no words, no numbers, no logos. Keep the one small plain gear symbol on the wall ' +
  'exactly as it is.';
const EMPTY = (what) => 'Edit the reference picture: take the man out of it. Keep the room EXACTLY as it is: the same camera, ' +
  'framing, walls, furniture, light strips, objects, colours and darkness, photoreal like a frame from a serious hard ' +
  `science-fiction film. Where he was, show what he hid: ${what} Nobody is in the picture: no person, no shadow of one. ${NONE}`;
const MAN = 'a slight young man with short untidy dark hair, in a plain black high-collared shirt with the sleeves pushed up to ' +
  'the elbows and plain black trousers';
const LOCK = 'Camera completely locked: no zoom, no pan, no dolly, no cuts. The room, its light and everything in it stay ' +
  'exactly as they are; only he moves. He is seen from behind the whole time and his face is never seen; nobody else comes ' +
  'in. An unhurried, natural walk, the weight of a man in the artificial gravity of a ship. The clip ends exactly on the ' +
  'second picture. No text appears anywhere.';
const ENTERS = (how) => `The room is empty at first. Then ${MAN} walks into the picture from the near left, from beside the ` +
  `camera, his back to us, ${how}`;

/** `pace`: how much faster than the model's take it plays (he should be in his place in about three seconds). */
export const ROOMS = [
  { id: 'desk', pace: 1.35, diff: 6,
    empty: EMPTY('the black panelled wall and its thin light strip at the left, the dark floor, and the whole round projection plinth with its softly glowing top.'),
    clip: `A quiet room aboard a starship: a round projection plinth with a softly glowing top. ${ENTERS('goes to the plinth and stops at its left, standing still, looking down at it, his hands at his sides.')} ${LOCK}` },
  { id: 'genes', pace: 1.35,
    empty: EMPTY('the rest of the tall glass cylinder with the red culture in it, the long black counter along the wall behind it, and the dark floor.'),
    clip: `A clean laboratory aboard a starship: a tall glass cylinder in which a round red culture floats. ${ENTERS('a thin tablet in his hand, goes to the glass cylinder and stops beside it, watching the culture.')} The culture turns very slowly the whole time. ${LOCK}` },
  { id: 'locker', pace: 1.3,
    empty: EMPTY('the plain round stool standing empty at the work shelf, the shelf with its small metal models and jars, the drawers under it and the wall behind.'),
    clip: `A quiet corner of a starship: a work shelf with small metal models, an empty round stool before it. ${ENTERS('goes to the stool, sits down on it at the shelf and bends over his work.')} ${LOCK}` },
  { id: 'board', pace: 1.35,
    empty: EMPTY('the black wall with the thin terminal set into it, its small shelf, and the dark floor.'),
    clip: `A bare formal alcove aboard a starship: a thin terminal set into the black wall. ${ENTERS('goes to the terminal and stops before it, standing straight, his hands at his sides, reading it.')} ${LOCK}` },
  { id: 'comms', pace: 1.3,
    empty: EMPTY('the hard black bench standing empty before the console, the console with its keys and dials, and the three thin displays.'),
    clip: `The communications alcove of a starship: three thin displays over a console, an empty bench before it, a long window slit onto a dark planet. ${ENTERS('goes to the bench, sits down on it facing the displays and puts one hand on the console.')} The displays flicker softly the whole time. ${LOCK}` },
  { id: 'ai', pace: 1.35,
    empty: EMPTY('the low round dais with its ring of white light, the dark floor, and the rows of black columns far back.'),
    clip: `The core of a starship’s artificial intelligence: a low round dais with a ring of white light, rows of black columns far back. ${ENTERS('goes toward the dais and stops at the left before it, relaxed, one hand in a trouser pocket.')} The air above the dais stays empty. ${LOCK}` },
  { id: 'orders', pace: 1.35,
    empty: EMPTY('the tall narrow black lectern standing alone, the wall slot with the pale sheet hanging from it, the steel tray, and the lit seams of the walls.'),
    clip: `A narrow formal office aboard a starship: a tall black lectern, a slot in the wall with a pale sheet hanging from it. ${ENTERS('goes to the lectern, stops at it and takes up a pale blank sheet in both hands to read it.')} ${LOCK}` },
  { id: 'hobby', pace: 1.3,
    empty: EMPTY('the plain round stool standing empty at the narrow fold-down desk, the desk with its softly glowing pad and the pale blue projected pages over it, the small warm lamp, and the shelf of jars above.'),
    clip: `A small corner of a starship at night: a narrow fold-down desk with a softly glowing pad and a small warm lamp, an empty stool before it. ${ENTERS('goes to the stool, sits down on it at the desk, takes a stylus and leans over the pad to draw.')} ${LOCK}` },
];

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const seconds = (f) => +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.trim();

/** The loop's own first frame: where the arrival ends. */
function frame0(r) {
  const out = raw(r.id, '-frame0.png');
  if (!fs.existsSync(out)) {
    fs.mkdirSync(DIR, { recursive: true });
    ffmpeg(['-i', path.join(OUT, `room-${r.id}.mp4`), '-frames:v', '1', '-vf', `scale=${W}:${H}:flags=lanczos`, out], `${r.id} frame 0`);
  }
  return out;
}

/** Grey pixels of a picture (or of a filter over several), small: for measuring, not for looking at. */
function grey(inputs, filter, w, h) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...inputs.flatMap((f) => ['-i', f]), '-filter_complex', `${filter},scale=${w}:${h},format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`grey: ${r.stderr}`);
  return r.stdout;
}

/**
 * Where he was, as a mask (white = him): the largest patch in which the edited picture differs from frame 0. He wears
 * black in a black room, so the difference is faint (a first pass with a high threshold found one arm and left the rest
 * of him standing there): the threshold is low, the patch is closed over its gaps and grown a little, and only the
 * largest one is kept, so the model's small drift elsewhere in the room is not taken.
 */
const MW = 480, MH = 270;
function heMask(r) {
  const thr = Number(process.env.SHIP_ARRIVE_DIFF || r.diff || 9);
  const d = grey([frame0(r), raw(r.id, '-edit.png')], `[0:v]scale=${W}:${H}[a];[1:v]scale=${W}:${H}[b];[a][b]blend=all_mode=difference,gblur=sigma=5`, MW, MH);
  const at = (m, x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? 0 : m[y * MW + x]);
  let m = Uint8Array.from(d, (v) => (v > thr ? 1 : 0));
  // Grow by `n` (a square), or shrink: closing = grow then shrink less, which also leaves it a little larger.
  const morph = (src, n, grow) => {
    const out = new Uint8Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      let v = grow ? 0 : 1;
      for (let dy = -n; dy <= n && (grow ? !v : v); dy++) for (let dx = -n; dx <= n; dx++) {
        const s = x + dx < 0 || y + dy < 0 || x + dx >= MW || y + dy >= MH ? (grow ? 0 : 1) : src[(y + dy) * MW + x + dx];
        if (grow ? s : !s) { v = grow ? 1 : 0; break; }
      }
      out[y * MW + x] = v;
    }
    return out;
  };
  m = morph(morph(m, 8, true), 4, false);
  // The largest connected patch.
  const label = new Int32Array(MW * MH);
  let best = 0, bestN = 0, next = 0;
  for (let i = 0; i < MW * MH; i++) {
    if (!m[i] || label[i]) continue;
    const id = ++next; let n = 0; const stack = [i]; label[i] = id;
    while (stack.length) {
      const c = stack.pop(); n++;
      const x = c % MW, y = (c - x) / MW;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!at(m, nx, ny) || label[ny * MW + nx]) continue;
        label[ny * MW + nx] = id; stack.push(ny * MW + nx);
      }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  if (!best) throw new Error(`${r.id}: the edited picture does not differ from frame 0 anywhere (nobody was taken out?)`);
  const out = raw(r.id, '-mask.gray');
  fs.writeFileSync(out, Buffer.from(Uint8Array.from(label, (v) => (v === best ? 255 : 0))));
  return { file: out, share: bestN / (MW * MH) };
}

/** Frame 0 with him taken out: the edited picture's pixels where he was only, feathered into frame 0's own. */
function emptyRoom(r) {
  const out = raw(r.id, '-empty.png');
  if (fs.existsSync(out)) return out;
  const mask = heMask(r);
  ffmpeg(['-i', frame0(r), '-i', raw(r.id, '-edit.png'), '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${MW}x${MH}`, '-i', mask.file, '-filter_complex',
    `[2:v]scale=${W}:${H}:flags=bicubic,gblur=sigma=14[m];[1:v]scale=${W}:${H}:flags=lanczos,format=rgb24[e];[e][m]alphamerge[ea];[0:v][ea]overlay,format=rgb24`,
    '-frames:v', '1', out], `${r.id} empty room`);
  console.log(`[arrive] ${r.id}: he took ${(mask.share * 100).toFixed(1)}% of the picture`);
  return out;
}

async function stills(items) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.mkdirSync(REV, { recursive: true });
  const res = await pool(items, 4, async (r) => {
    const ref = raw(r.id, '-ref.png');
    if (!fs.existsSync(ref)) ffmpeg(['-i', frame0(r), '-vf', 'scale=1536:864:flags=lanczos', ref], `${r.id} ref`);
    return makeStill({ slug: `ship-arrive ${r.id}`, out: raw(r.id, '-edit.png'), prompt: r.empty, key: null, width: 1536, height: 864,
      quality: process.env.SHIP_ARRIVE_QUALITY || 'high', refFiles: [ref] });
  });
  res.forEach((x, i) => { if (!x.ok) console.warn(`[arrive] ${items[i].id} still failed: ${x.error.message.slice(0, 200)}`); });
  for (const r of items) {
    if (!fs.existsSync(raw(r.id, '-edit.png'))) continue;
    const e = emptyRoom(r);
    // To look at: the loop's first frame beside the empty room made from it.
    ffmpeg(['-i', frame0(r), '-i', e, '-filter_complex', '[0:v]scale=960:540[a];[1:v]scale=960:540[b];[a][b]hstack', '-q:v', '3', path.join(REV, `${r.id}-with-him-and-empty.jpg`)], `${r.id} pair`);
  }
}

async function clips(items) {
  const go = items.filter((r) => fs.existsSync(raw(r.id, '-empty.png')));
  const res = await pool(go, 4, (r) => makeClip({
    slug: `ship-arrive-${r.id}`, stillFile: raw(r.id, '-empty.png'), endFile: frame0(r), out: raw(r.id, '-arrive.mp4'), models: [MODEL],
    prompt: r.clip, seconds: 5, raw: true, resolution: RES, aspect: '16:9',
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[arrive] ${go[i].id} clip failed: ${x.error.message.slice(0, 200)}`); });
}

/**
 * THE OTHER HALF, a tested take that is NOT in the game: he LEAVES the room. It is CONTINUED from the room's own loop
 * (rfab.mjs makeClip `continueFrom`: the loop's last seconds are the start, so his movement carries on from the loop
 * itself, not from one still of it), with the end left free: he walks out and the room is empty. Its first frame is
 * NOT the loop's last (see the takes below): cut straight from the loop it would show a small step. Made to prove the
 * continued-clip path end to end (Collins, Oct 4 2026: "some models take more than just a last frame as a start but
 * the last 5 seconds or so ... those are probably better"); raw in art-src-new/ship-arrivals/<id>-leave.mp4, a strip in
 * notes/art-review/ship-arrivals/<id>-leave-strip.jpg with the loop's last frame beside the take's first.
 */
// Two takes, both as a plain reference clip: on seegen:wan3.0-video (v1/desk-leave-wan.mp4) and on seegen:sd2-fast, the
// loops' own model, with the clip named in the prompt as SeeGen's docs do (Video1). In both he left as asked and the room
// and framing were kept, but neither starts ON the loop's last frame: wan lifts the whole picture's exposure at the join
// (30.0 dB after a light blur), sd2-fast shifts it a few pixels (33.7 dB). A clip started on a PICTURE of the last frame
// measures 38 to 40 dB. The provider's extend mode (rfab.mjs `continueMode: 'extend'`) measured 29.5 and 34.6.
const LEAVE_MODEL = process.env.SHIP_LEAVE_MODEL || 'seegen:sd2-fast';
const LEAVE = `Continue Video1 from its very last frame, as one unbroken shot: the same room, the same camera, the same framing, the same light. ${MAN.replace(/^a /, 'The ')} turns away to his left and walks out of the picture past the near left edge, the way he came ` +
  'in, his back and then his side to us; his face is never seen. The room is left empty and stays exactly as it is. Camera ' +
  'completely locked: no zoom, no pan, no dolly, no cuts. Nobody else comes in. No text appears anywhere.';
async function leaves(items) {
  fs.mkdirSync(REV, { recursive: true });
  const res = await pool(items, 2, (r) => makeClip({
    slug: `ship-leave-${r.id}`, continueFrom: path.join(DIR, `${r.id}-loop-copy.mp4`), tailSeconds: 5, out: raw(r.id, '-leave.mp4'), models: [LEAVE_MODEL],
    prompt: LEAVE, seconds: 5, raw: true, loop: false, resolution: process.env.SHIP_LEAVE_RES || '720p', aspect: '16:9',
    continueMode: process.env.SHIP_LEAVE_MODE || 'reference',
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[leave] ${items[i].id} failed: ${x.error.message.slice(0, 300)}`); });
  for (const r of items) {
    const clip = raw(r.id, '-leave.mp4');
    if (!fs.existsSync(clip)) continue;
    ffmpeg(['-i', clip, '-vf', 'fps=8/5,scale=320:-2,tile=8x1', '-frames:v', '1', '-q:v', '3', path.join(REV, `${r.id}-leave-strip.jpg`)], `${r.id} leave strip`);
    // The join: the loop's REAL last frame beside the continued take's first.
    const loopLast = lastFrameOf(path.join(DIR, `${r.id}-loop-copy.mp4`));
    ffmpeg(['-i', loopLast, '-i', clip, '-filter_complex', '[0:v]scale=640:360[a];[1:v]scale=640:360[b];[a][b]hstack', '-frames:v', '1', '-q:v', '3', path.join(REV, `${r.id}-leave-join.jpg`)], `${r.id} leave join`);
    console.log(`[leave] ${r.id}: its first frame is ${psnr(clip, loopLast).toFixed(1)} dB from the loop's last`);
  }
}

/** How near two pictures are (PSNR, dB), measured small so grain does not decide it. */
function psnr(a, b) {
  const r = run('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-filter_complex', '[0:v]scale=640:360[x];[1:v]scale=640:360[y];[x][y]psnr', '-f', 'null', '-']);
  const m = /average:([\d.]+|inf)/.exec(r.stderr || '');
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : 0;
}

const ENC = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
/** Below this the take did not land on the loop's first frame, and half a second of blending would show as a ghost. */
const LANDS = Number(process.env.SHIP_ARRIVE_LANDS || 27);

function bake(r) {
  const clip = raw(r.id, '-arrive.mp4');
  if (!fs.existsSync(clip)) return null;
  fs.mkdirSync(REV, { recursive: true });
  // The join, measured on the clip's REAL last frame (never assumed from the picture it was aimed at).
  const lands = psnr(lastFrameOf(clip), frame0(r));
  const starts = psnr(clip, raw(r.id, '-empty.png'));
  if (lands < LANDS) { console.log(`[arrive] ${r.id}: its last frame is ${lands.toFixed(1)} dB from the loop's first (needs ${LANDS}): NOT baked, draw it again`); return { id: r.id, lands, baked: false }; }
  const plain = raw(r.id, '-plain.mp4');
  ffmpeg(['-i', clip, '-vf', `trim=start_frame=1,setpts=(PTS-STARTPTS)/${r.pace},scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`, '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', plain], `${r.id} plain`);
  const L = seconds(plain), D = 0.5;
  const out = path.join(OUT, `arrive-${r.id}.mp4`);
  ffmpeg(['-i', plain, '-loop', '1', '-t', String(L), '-i', frame0(r), '-filter_complex',
    `[1:v]scale=${W}:${H},fps=${FPS},format=yuva420p,fade=t=in:st=${(L - D).toFixed(3)}:d=${D}:alpha=1[s];[0:v][s]overlay=shortest=1,format=yuv420p`,
    ...ENC, out], `${r.id} lands on the loop`);
  ffmpeg(['-i', out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '86', path.join(OUT, `arrive-${r.id}.webp`)], `${r.id} first frame`);
  const secs = Math.round(seconds(out) * 1000) / 1000;
  ffmpeg(['-i', out, '-vf', `fps=${(8 / secs).toFixed(4)},scale=320:-2,tile=8x1`, '-frames:v', '1', '-q:v', '3', path.join(REV, `${r.id}-strip.jpg`)], `${r.id} strip`);
  // The hand-over as the game makes it: the arrival's last frame beside the loop's first, and their difference.
  // (Its last frame is kept with the raw art, never beside the baked clip: everything in public/ ships.)
  const bakedLast = raw(r.id, '-baked-last.png');
  ffmpeg(['-sseof', '-0.06', '-i', out, '-update', '1', '-frames:v', '1', bakedLast], `${r.id} baked last`);
  ffmpeg(['-i', bakedLast, '-i', frame0(r), '-filter_complex',
    '[0:v]scale=640:360,split[a][a2];[1:v]scale=640:360,split[b][b2];[a2][b2]blend=all_mode=difference,eq=contrast=3[d];[a][b][d]hstack=inputs=3', '-q:v', '3', path.join(REV, `${r.id}-join.jpg`)], `${r.id} join`);
  const ends = psnr(bakedLast, frame0(r));
  console.log(`[arrive] ${r.id}: ${secs}s; the take landed ${lands.toFixed(1)} dB from the loop's first frame, baked ${ends.toFixed(1)} dB; starts ${starts.toFixed(1)} dB from the empty room`);
  return { id: r.id, baked: true, seconds: secs, lands: +lands.toFixed(1), ends: +ends.toFixed(1), starts: +starts.toFixed(1) };
}

function writeManifest(done) {
  const mf = path.join(OUT, 'loops.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  for (const d of done) {
    if (!d?.baked || !m.rooms[d.id]) continue;
    m.rooms[d.id].arrive = { video: `ship/loops/arrive-${d.id}.mp4`, poster: `ship/loops/arrive-${d.id}.webp`, seconds: d.seconds };
  }
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
  const rf = path.join(REV, 'arrivals.json');
  const old = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : {};
  for (const d of done) if (d) old[d.id] = d;
  fs.writeFileSync(rf, JSON.stringify(old, null, 1) + '\n');
}

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const items = ROOMS.filter((r) => !only.length || only.includes(r.id));
if (args.includes('--bake')) writeManifest(items.map(bake));
else if (args.includes('--leave')) {
  ready();
  // A copy of the loop with the raw art: the tail and last frame cut from it are written beside it, never into public/.
  for (const r of items) fs.copyFileSync(path.join(OUT, `room-${r.id}.mp4`), path.join(DIR, `${r.id}-loop-copy.mp4`));
  await leaves(items);
  console.log(`[leave] asked for ${spent.clips} clips`);
} else {
  ready();
  const before = await balance();
  await stills(items);
  if (!args.includes('--stills')) { await clips(items); writeManifest(items.map(bake)); }
  const after = await balance();
  console.log(`[arrive] asked for ${spent.stills} stills, ${spent.clips} clips; ${before - after} tokens ($${((before - after) / 50000).toFixed(2)}) left the account in that time; balance ${after}`);
}
