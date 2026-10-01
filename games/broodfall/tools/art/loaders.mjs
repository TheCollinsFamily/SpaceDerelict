/**
 * THE LOADERS: the looping animations behind every wait in the game (Oct 1 2026; Collins: "we had a loading
 * screen here without a looping animation ... that should never happen; the reason we have the RFab API ... is to
 * create those nice looping animations to engage users during load"). notes/LOADING-AUDIT.md lists the waits.
 *
 *   node tools/art/loaders.mjs --stills        the stills only (LOOK at them before paying for clips)
 *   node tools/art/loaders.mjs [ids]           stills, clips, bake (what is on disk is skipped)
 *   node tools/art/loaders.mjs --bake [ids]    bake again from what is on disk (free)
 *
 * The family (src/ui/loader.ts plays them):
 *   emblem   the meteor in its ring of tendrils, the fire streaming, the ring writhing: the first load and every
 *            "preparing" screen. From the emblem itself (art-src/screens/emblem.png, read, never touched), on its
 *            green, keyed with Leaflit's studio ChromaKey (tools/art/lib/leaflit.mjs) to a transparent loop.
 *   scan     the ship-console loader: the asset's silhouette in thin lines pulsing on a scan grid, a scan line
 *            sweeping: the ship's waits (its rooms' art, the globe, the newsreel, the films buffering).
 *   creep    the creep: veins crawling and pulsing across dark flesh: the board's and the organ stage's waits.
 *   yoke     YOKE thinking: her own `thinking` clip (public/art/ship/yoke/thinking.webm), only made small here.
 *
 * Each loop is baked twice: a full one (`<id>.webm`, VP8, with alpha where it overlays) and a FIRST-PAINT one
 * (`<id>-mini.webp`, an animated WebP of a few dozen KB, preloaded by index.html, so the loader is never the thing
 * still loading), plus `<id>-slow.webp` at a third of the speed for Settings > Reduce motion. A clip's END frame is
 * its START frame (seegen honours it); the frames where the model snaps to it are cut, and when the seam still
 * shows the loop is PING-PONGED (Collins's call for idles with no clean loop). No lettering, no religious symbol.
 * Raw stills and clips: art-src/loaders/. Output: public/art/loaders/ (+ loaders.json). Review:
 * notes/art-review/loaders/ (a contact sheet of every loop's frames).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { balance, ffmpeg, makeClip, makeStill, pool, ready, spent } from './rfab.mjs';
import { keyFrames } from './lib/leaflit.mjs';
import { ART, REVIEW, SRC } from './lib/manifest.mjs';
import { bleed, project } from './templates/yoke.mjs';

const DIR = path.join(SRC, 'loaders');
const OUT = path.join(ART, 'loaders');
const REV = path.join(REVIEW, 'loaders');
const MODEL = process.env.LOADER_MODEL || 'seegen:sd2-fast';

const NONE = 'No text anywhere: no letters, no words, no numbers, no logos, no badges, no symbols. No religious symbol of ' +
  'any kind (no crosses, no stars, no crescents).';
const LOCK = 'Camera completely locked: no zoom, no pan, no cuts. Nothing appears, nothing leaves the frame. The clip ' +
  'ends exactly on the first picture again. No text appears anywhere.';

export const LOADERS = [
  { id: 'emblem', from: path.join(SRC, 'screens', 'emblem.png'), aspect: '1:1', res: '720p', seconds: 5, key: true, size: 512, mini: 200,
    clip: 'A painted emblem comes alive on a flat pure green background. The living meteor stays in place and keeps its ' +
      'heading: its tail of fire streams and flickers, the hot orange glow inside its split pulses brighter and dimmer like ' +
      'a slow heartbeat, its few loose red tendrils sway. The ring of twisted red tendrils around it slowly writhes and ' +
      'ripples like living vines, without moving away from its place. The flat pure green background stays flat and ' +
      `empty. ${LOCK}` },
  { id: 'scan', aspect: '16:9', res: '720p', seconds: 6, size: 640, mini: 320,
    still: 'A display screen aboard a hard science-fiction starship, filling the whole picture, seen straight on. Near-black ' +
      'blue-grey glass. A fine square scan grid of very thin pale cyan lines covers it, faint, with slightly brighter thin ' +
      'concentric range rings around the centre. In the centre, drawn ONLY as a thin glowing pale cyan outline with a few ' +
      'inner contour lines, like a medical scan: the silhouette of a living alien seed-pod organism, a round spiked pod of ' +
      'flesh split open along one side, with a few thin tendrils trailing from it. Nothing filled in, only thin lines. ' +
      'Thin corner brackets frame the scan. Restrained, precise, quiet, very dark overall. ' + NONE,
    clip: 'A starship scan display. A soft bright horizontal scan line sweeps slowly down across the screen; the thin cyan ' +
      'outline of the organism pulses gently brighter and dimmer, like breathing, its tendrils swaying a little; the range ' +
      'rings shimmer faintly. The grid and the organism stay exactly in place. ' + LOCK },
  { id: 'creep', aspect: '16:9', res: '720p', seconds: 6, size: 640, mini: 320,
    still: 'Seen from straight above, filling the whole picture: a living alien creep spreading over dark ground, wet dark ' +
      'red and maroon flesh, thick and thin branching veins of deeper crimson running across it, a few glistening pale ' +
      'nodules, the edges of the creep thinning into dark soil at the corners. Very dark overall, moody, a soft dim light ' +
      'from above, realistic and unglamorous like a creature-film texture. ' + NONE,
    clip: 'Seen from straight above: living alien flesh. Its veins pulse slowly with a heartbeat, swelling and relaxing; a ' +
      'dark glistening wave slowly crawls along the branching veins; the surface breathes gently. Everything stays in place. ' +
      LOCK },
  // Collins (Oct 1 2026): "one of the fun loading frames could be a dancing version of your AI." Her 9 s `dance`
  // take is a one-shot (it starts and ends standing still); this is a new take from her one reference (the
  // Leaflit sprite, art-src/yoke/idle-framed.png, read only) with the END frame = the START frame, keyed the way
  // her other clips are. Shown now and then on the ship's waits, with a line of hers set in type under it.
  { id: 'dance', from: path.join(SRC, 'yoke', 'idle-framed.png'), aspect: '16:9', res: '720p', seconds: 6, key: true, projection: true, size: 640, mini: 288,
    clip: 'Locked-off position, static camera, 2d anime game animation style. The same girl does a playful little dance in ' +
      'place to a beat only she can hear: she bobs on the beat, sways her hips and shoulders side to side, swings her ' +
      'arms and loosely snaps her fingers, tilts her head with a small pleased smile, her long hair swinging. She stays ' +
      'in the middle of the picture at the same size, never leaves the frame, no zoom, no turning around, the same ' +
      'clothes and the same hair the whole time. She ends in EXACTLY the pose she started in. The flat pure green ' +
      'background stays flat and empty. No text appears anywhere.' },
];
const YOKE_CLIP = path.join(ART, 'ship', 'yoke', 'thinking.webm');

const raw = (id, what) => path.join(DIR, `${id}${what}`);
const stillOf = (l) => (l.from ?? raw(l.id, '.png'));

async function stills(items) {
  const res = await pool(items.filter((l) => l.still), 3, (l) => makeStill({
    slug: `loader ${l.id}`, out: raw(l.id, '.png'), prompt: l.still, key: null, width: 1536, height: 864, quality: 'high',
  }));
  res.forEach((x) => { if (!x.ok) console.warn(`[loaders] still failed: ${x.error.message.slice(0, 200)}`); });
}

async function clips(items) {
  const go = items.filter((l) => fs.existsSync(stillOf(l)));
  const res = await pool(go, 3, (l) => makeClip({
    slug: `loader-${l.id}`, stillFile: stillOf(l), out: raw(l.id, '-clip.mp4'), models: [MODEL],
    prompt: l.clip, seconds: l.seconds, loop: true, raw: true, resolution: l.res, aspect: l.aspect,
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[loaders] ${go[i].id} clip failed: ${x.error.message.slice(0, 200)}`); });
}

// ---- the bake ----

const FPS = 24;
const probe = (file) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim().split(',').map(Number);
const diff = (a, b) => { let d = 0; for (let k = 0; k < a.length; k += 4) d += Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]); return d / (a.length / 4) / 3; };

/** Every frame of a clip as RGBA at w x h (frame 0, the uploaded still, dropped). VP8-alpha webm is read through libvpx. */
function rgbaFrames(file, w, h, { dropFirst = true, alpha = false } = {}) {
  const pre = alpha ? ['-c:v', 'libvpx'] : [];
  const vf = `${dropFirst ? 'trim=start_frame=1,setpts=PTS-STARTPTS,' : ''}fps=${FPS},scale=${w}:${h}:flags=lanczos,format=rgba`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...pre, '-i', file, '-vf', vf, '-an', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 4 * 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${file}: ${String(r.stderr).slice(-300)}`);
  const size = w * h * 4;
  return Array.from({ length: Math.floor(r.stdout.length / size) }, (_, i) => ({ w, h, data: Buffer.from(r.stdout.subarray(i * size, (i + 1) * size)) }));
}

/** Cut the frames where the model SNAPS to its end frame; report how clean the seam is. */
function trimSnap(frames) {
  const steps = frames.slice(1).map((f, i) => diff(frames[i].data, f.data));
  const med = [...steps].sort((a, b) => a - b)[steps.length >> 1] || 0;
  let end = frames.length;
  for (let i = Math.max(1, frames.length - 12); i < frames.length; i++) if (steps[i - 1] > Math.max(1.2, 3 * med)) { end = i; break; }
  const kept = frames.slice(0, end);
  const seam = diff(kept[kept.length - 1].data, kept[0].data);
  return { frames: kept, seam, step: med };
}

/** Encode RGBA frames: webm (VP8, alpha kept when `alpha`), and an animated WebP at `mini` px wide (and a slow one). */
function encode(id, frames, { alpha, mini, size }) {
  fs.mkdirSync(OUT, { recursive: true });
  const { w, h } = frames[0];
  const buf = Buffer.concat(frames.map((f) => f.data));
  const input = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-'];
  const run = (args, label) => {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...input, ...args], { input: buf, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`${id} ${label}: ${String(r.stderr).slice(-300)}`);
  };
  const sw = size - (size % 2), sh = Math.round((h * sw) / w / 2) * 2;
  run(['-vf', `scale=${sw}:${sh}:flags=lanczos`, '-c:v', 'libvpx', '-pix_fmt', alpha ? 'yuva420p' : 'yuv420p', ...(alpha ? ['-auto-alt-ref', '0'] : []),
    '-b:v', alpha ? '900k' : '700k', '-crf', '12', '-deadline', 'good', '-an', path.join(OUT, `${id}.webm`)], 'webm');
  const mh = Math.round((h * mini) / w / 2) * 2;
  // The first paint: small, 12 fps, lossy; it plays until the full loop has a frame (or for good, if that never comes).
  run(['-vf', `fps=12,scale=${mini}:${mh}:flags=lanczos`, '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '55', '-compression_level', '6', '-loop', '0', path.join(OUT, `${id}-mini.webp`)], 'mini');
  run(['-vf', `fps=12,scale=${mini}:${mh}:flags=lanczos,setpts=3*PTS`, '-r', '4', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '55', '-compression_level', '6', '-loop', '0', path.join(OUT, `${id}-slow.webp`)], 'slow');
  // A contact sheet for the eye: 12 frames across the loop, on a mid grey (so alpha shows).
  fs.mkdirSync(REV, { recursive: true });
  const n = frames.length, pick = Array.from({ length: 12 }, (_, i) => Math.floor((i * n) / 12));
  const sel = pick.map((i) => `eq(n\\,${i})`).join('+');
  run(['-vf', `select='${sel}',scale=320:-2,pad=iw+8:ih+8:4:4:color=0x404448,tile=4x3,format=rgb24`, '-frames:v', '1', '-update', '1', path.join(REV, `${id}-frames.jpg`)], 'sheet');
}

function bake(l) {
  const clip = raw(l.id, '-clip.mp4');
  if (!fs.existsSync(clip)) return null;
  const [w0, h0] = probe(clip);
  const w = Math.min(1280, w0 - (w0 % 2)), h = Math.round((h0 * w) / w0 / 2) * 2;
  let { frames, seam, step } = trimSnap(rgbaFrames(clip, w, h));
  let mode = 'seamless';
  // Keyed (and projected) once per frame, BEFORE a ping-pong repeats the frames.
  if (l.key) keyFrames(frames);
  // YOKE is a projection in every clip of hers (tools/art/templates/yoke.mjs project): cooled, scan-lined, haloed.
  if (l.projection) for (const f of frames) { project(f); bleed(f); }
  // The end frame is the start frame, so the seam should be about one frame's step; when it is not, ping-pong.
  if (seam > Math.max(2.5, 2.5 * step)) {
    frames = [...frames, ...frames.slice(1, -1).reverse()];
    mode = 'pingpong';
  }
  encode(l.id, frames, { alpha: !!l.key, mini: l.mini, size: l.size });
  console.log(`[loaders] ${l.id}: ${frames.length} frames, ${mode} (seam ${seam.toFixed(2)}, step ${step.toFixed(2)})`);
  return { video: `loaders/${l.id}.webm`, mini: `loaders/${l.id}-mini.webp`, slow: `loaders/${l.id}-slow.webp`, alpha: !!l.key, mode, seconds: +(frames.length / FPS).toFixed(2) };
}

function bakeYoke() {
  if (!fs.existsSync(YOKE_CLIP)) return null;
  // Her own clip is already keyed and loops (Ping-Pong, the studio's); only the small copies are made here.
  const frames = rgbaFrames(YOKE_CLIP, 640, 360, { dropFirst: false, alpha: true });
  encode('yoke', frames, { alpha: true, mini: 240, size: 640 });
  fs.rmSync(path.join(OUT, 'yoke.webm'), { force: true }); // the full one is her own file
  return { video: 'ship/yoke/thinking.webm', mini: 'loaders/yoke-mini.webp', slow: 'loaders/yoke-slow.webp', alpha: true, mode: 'her own', seconds: +(frames.length / FPS).toFixed(2) };
}

async function main() {
  const args = process.argv.slice(2);
  const ids = args.filter((a) => !a.startsWith('--'));
  const items = LOADERS.filter((l) => !ids.length || ids.includes(l.id));
  fs.mkdirSync(DIR, { recursive: true });
  if (!args.includes('--bake')) {
    ready();
    const before = await balance();
    await stills(items);
    if (!args.includes('--stills')) await clips(items);
    const after = await balance();
    console.log(`[loaders] asked for ${spent.stills} stills, ${spent.clips} clips; ${before - after} tokens ($${((before - after) / 50000).toFixed(2)})`);
    if (args.includes('--stills')) return;
  }
  const jsonFile = path.join(OUT, 'loaders.json');
  const json = fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : { loops: {} };
  for (const l of items) { const r = bake(l); if (r) json.loops[l.id] = r; }
  if (!ids.length || ids.includes('yoke')) { const r = bakeYoke(); if (r) json.loops.yoke = r; }
  fs.writeFileSync(jsonFile, `${JSON.stringify(json, null, 2)}\n`);
  for (const f of fs.readdirSync(OUT)) console.log(`  ${f}  ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
