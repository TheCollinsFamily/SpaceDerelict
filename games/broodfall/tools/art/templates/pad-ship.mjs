/**
 * THE PAD, PART 2: FROM THE DESK TO THE SHIP (Collins, Oct 2 2026): "it should have a second part of you turning around
 * and getting up to move into the ship's interface, with the AI character talking to you, etc. It's meant to transition
 * the two interfaces" ... "but have you feel like you're really in a ship."
 *
 * Part 1 (tools/art/templates/pad.mjs) ends first person at his console desk, the pad set down, its screen asleep. Part 2
 * picks up from that very frame and ends on the very first frame of the Directive Desk's room loop
 * (public/art/ship/loops/room-desk.mp4: him from behind at the round table), where the ship's interface fades in.
 *
 *   A  first person, START = part 1's last frame (its green screen made the black of a sleeping pad), END = the TURN still:
 *      he pushes back, stands and turns right, the planet sliding past in the window, the dark bay and an open hatch
 *      ahead. `won` composed; `lost` heavy and slow. (seegen:wan3.0-video: it honours end frames; tools/art/templates/pad.mjs.)
 *   B  third person, START = the HATCH still (him from behind stepping through the hatch), END = a SCREENSHOT of the interface
 *      frame: he walks in and stops at the table, its top waking. Shared by both outcomes.
 *   Sound: ship ambience under everything, the chair and his steps on deck plating, the hatch and a soft chime
 *      (sound effects cut from a video model's soundtrack, atlascloud:h3-t2v as the B-movie's).
 *   Bake: A + B (a cut as he steps forward), 1280x720 30 fps H.264 + the sound bed -> public/art/pad/ship-<won|lost>.mp4,
 *      its timings in public/art/pad/manifest.json `part2`; review strips and continuity checks in notes/art-review/pad/.
 *
 *   node tools/art/make.mjs padship --frames   the fixed frames (free): part 1's last frames, the room loop's first
 *   node tools/art/make.mjs padship --stills   the TURN and HATCH stills (LOOK before paying for clips)
 *   node tools/art/make.mjs padship            frames, stills, clips, sounds, bake
 *   node tools/art/make.mjs padship --bake     bake again (free)
 *
 * Raw files: art-src-new/pad-ship/ (Oct 2026: art-src is restored and left as it is). To make a step again, MOVE its file
 * into art-src-new/pad-ship/v1/ (never delete).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpeg, makeClip, makeStill } from '../rfab.mjs';
import { soundTake } from '../../audio/rfab-audio.mjs';
import { ART, REVIEW, ROOT, SRC } from '../lib/manifest.mjs';
import { DIR as PART1, PLANET } from './pad.mjs';

const DIR = process.env.PADSHIP_RAW || path.join(ROOT, 'art-src-new', 'pad-ship');
const OUT = path.join(ART, 'pad');
const LOOK = path.join(REVIEW, 'pad');
const ROOM_LOOP = path.join(ART, 'ship', 'loops', 'room-desk.mp4');
const W = 1280, H = 720, FPS = 30;
const raw = (f) => path.join(DIR, f);

const NONE = 'No text, no lettering, no numbers, no logos, no emblems, no symbols, no icons anywhere in the picture.';
const REAL = 'Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set, natural film grain.';
const MAN = 'a slight young man with short dark messy hair and a pale stylus tucked behind his right ear, in a plain black long-sleeved ' +
  'high-collared shirt with the sleeves pushed up to the elbows and black trousers';
const SHIP = 'the inside of a small, dark, exact starship in orbit: matte black bulkheads in big flat panels, thin white light strips ' +
  'recessed along the base of the walls, ribbed dark metal deck plating, a heavy rounded hatch frame set in a thick bulkhead, ' +
  'cool white light and deep shadow, everything spare, clean and precise';

export const TURN = {
  file: raw('turn.png'),
  prompt: `${REAL} First-person point of view, standing, eye level, a wide 16:9 frame: a young man aboard ${SHIP}, who has just ` +
    'stood up from his long matte black console desk and turned to his right. At the far left edge of the picture, the end of the ' +
    `long curved window of the first reference picture with its pale frame, and through it ${PLANET}; its red glow spills across ` +
    'the deck plating and catches the edges of the bulkheads. Ahead and to the right: the dark operations bay of the ship and, in ' +
    'the bulkhead ahead, a heavy rounded hatchway standing open, through which a small dark room is seen with a round table whose ' +
    'top glows softly white, exactly the room of the second reference picture. His black swivel chair pushed back at the bottom ' +
    `left. Nobody else in the picture; his body is not seen. ${NONE}`,
  refs: () => [raw('won-part1-last.png'), raw('interface-end.png')],
};

export const HATCH = {
  file: raw('hatch.png'),
  prompt: `${REAL} A wide 16:9 frame, seen from behind and a little above, from a dark corridor aboard ${SHIP}: ${MAN}, exactly the ` +
    'man of the first reference picture, stepping through a heavy open rounded hatchway in a thick black bulkhead into the small ' +
    'dark room of the first reference picture: the round table with its softly glowing white top ahead of him, the thin white ' +
    'light strips along the base of the walls. The rounded hatch frame surrounds the middle of the picture; he is in its opening, ' +
    'mid-stride, on ribbed deck plating; a faint warm red glow from the planet behind the camera catches the edge of the hatch ' +
    `frame and his shoulder. ${NONE}`,
  refs: () => [raw('interface-end.png'), raw('turn.png')],
};

/**
 * OVER (Collins, Oct 2 2026: "it sort of changes the position of you when it moves from first to third person"): the end of
 * A seen from a step behind and above his eyes: the same room, window, chair and hatch at the same places in frame, and HIM
 * standing exactly where the first-person camera stood, from behind, facing the hatch. RISE moves from A's last frame to it
 * (one camera move, no cut); the walk starts from it.
 */
export const OVER = {
  file: raw('over.png'),
  prompt: `${REAL} Keep the first reference picture: the same view of the same dark starship room from the same place and the same ` +
    'direction, the long window onto the planet on the left with its red glow, the long console desk and the black chair pushed ' +
    'back, the open rounded hatchway ahead on the right with the room and its softly glowing round table beyond it, the same ' +
    'light, the same framing, only the camera a single step further back and a little higher. Standing in the near foreground, ' +
    `seen from behind and slightly to the left, is ${MAN}, exactly the man of the second reference picture: he stands where the ` +
    'viewer stood, facing the open hatchway, his head and shoulders in the lower left third of the picture, the hatch still ' +
    `clearly visible beyond him. ${NONE}`,
  refs: () => [raw('turn.png'), raw('hatch.png')],
};

const STEADY = 'His body moves with the deliberate weight of a man in a ship\'s artificial gravity. Natural hand-held camera, ' +
  `no cuts, the end matches the second picture exactly. ${NONE}`;
// Oct 2 2026, first takes: `won` picked the pad back up; `lost` turned into a third-person shot of an older stranger.
const POV = 'Strictly first person the whole time: the camera IS his eyes; we never see his face, his head or his body, only ' +
  'his own hand and forearm at the start; nobody else is in the room at any moment. The data pad stays lying flat on the desk ' +
  'where it is, its screen black: he lets go of it and leaves it there, he does not pick it up, lift it or take it with him. ';
export const CLIPS = [
  { id: 'won', start: () => raw('won-start.png'), end: () => TURN.file, seconds: 5,
    prompt: 'First-person point of view aboard a dark starship in orbit. He takes his hand off the data pad lying asleep (black) on ' +
      'his console desk, pushes back from the desk and stands up, and turns to his right, away from the long window: the planet ' +
      'slides past at the left as he turns, its red night-side glow sweeping over the deck, and the dark bulkheads, deck plating ' +
      'and the open hatchway ahead come into view. He ends standing still, looking toward the hatch. Calm and composed. ' + POV + STEADY },
  { id: 'lost', start: () => raw('lost-start.png'), end: () => TURN.file, seconds: 5,
    prompt: 'First-person point of view aboard a dark starship in orbit. Tired and heavy, he leans on his flat hand beside the data ' +
      'pad lying asleep (black) on his console desk, pushes himself up slowly and stands, then turns slowly to his right, away from ' +
      'the long window: the planet slides past at the left, its red night-side glow sweeping over the deck, and the dark ' +
      'bulkheads, deck plating and the open hatchway ahead come into view. He ends standing still, looking toward the hatch. ' + POV + STEADY },
  { id: 'rise', start: () => TURN.file, end: () => OVER.file, seconds: 5,
    prompt: 'One continuous camera move, no cut, aboard a dark starship. We begin looking through his eyes at the open hatchway. ' +
      'He takes a step toward it and the camera drifts back and a little up over his shoulder, so that he rises into the picture ' +
      'from the bottom left, seen from behind, standing exactly where the viewpoint was, facing the hatch, ending exactly on the ' +
      'second picture. The room, the window onto the planet, the chair and the hatch stay where they are. ' +
      `He is the man of the second picture the whole time. ${NONE}` },
  { id: 'walk', start: () => OVER.file, end: () => raw('interface-end.png'), seconds: 5,
    prompt: `Seen from behind, ${MAN} walks forward across the room and through the open hatchway into the small dark room and stops beside the round ` +
      'table, standing still and looking down at it, exactly as in the second picture; the camera follows a little behind him and ' +
      'settles where the second picture is framed, the hatch frame passing out of the picture. As he arrives the table\'s top glows ' +
      `a little brighter, like a projector waking. ${STEADY}` },
];

export const SOUNDS = [
  { id: 'ship-amb', seconds: 10, prompt: 'Sound only, recorded inside a quiet starship in orbit: a deep low steady engine hum, the soft ' +
      'hiss of air recyclers, faint distant machinery ticking and clanking deep in the hull, one soft low electronic system tone. ' +
      'No music, no voices, no speech.' },
  { id: 'stand', seconds: 5, prompt: 'Sound only, inside a quiet starship: a swivel chair rolling back on a metal deck, a man standing ' +
      'up, cloth rustling, then slow footsteps in soft boots on ribbed metal deck plating, a low hum underneath. No music, no voices.' },
  { id: 'hatch', seconds: 5, prompt: 'Sound only, inside a quiet starship: a heavy hatch sliding open with a pneumatic hiss and a soft ' +
      'mechanical clunk, two footsteps on metal deck plating, then a soft two-note electronic chime. No music, no voices.' },
];

const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`); return r.stdout; };
const seconds = (f) => +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim();

/** The fixed frames (free): part 1's last frames with the pad's screen asleep, and the room loop's first frame. */
export function makeFrames() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const o of ['won', 'lost']) {
    const out = raw(`${o}-start.png`);
    if (fs.existsSync(out)) continue;
    const last = raw(`${o}-part1-last.png`);
    ffmpeg(['-sseof', '-0.2', '-i', path.join(PART1, `${o}.mp4`), '-frames:v', '1', last], `${o} last`);
    // The green screen keyed and laid over a near-black: the pad as it is after part 1's "sleep" (padOutro.ts).
    // Green pixels (green well above red and blue: the screen and its fringe) made the near-black of a pad asleep.
    const g = 'gt(g(X,Y),r(X,Y)+28)*gt(g(X,Y),b(X,Y)+28)';
    ffmpeg(['-i', last, '-vf', `format=gbrp,geq=r='if(${g},5,r(X,Y))':g='if(${g},8,g(X,Y))':b='if(${g},11,b(X,Y))',format=rgb24`, '-frames:v', '1', out], `${o} asleep`);
  }
  const end = raw('desk-end.png');
  if (!fs.existsSync(end)) ffmpeg(['-i', ROOM_LOOP, '-frames:v', '1', '-vf', `scale=${W}:${H}`, end], 'room loop first frame');
}

export async function makeStills(only = []) {
  for (const s of [TURN, HATCH, OVER]) {
    if (only.length && !only.includes(path.basename(s.file, '.png'))) continue;
    await makeStill({ slug: `padship ${path.basename(s.file, '.png')}`, out: s.file, prompt: s.prompt, key: null, width: W, height: H, quality: 'high', refFiles: s.refs() });
  }
}

export async function makeClips(only = []) {
  await Promise.all(CLIPS.filter((c) => !only.length || only.includes(c.id)).map((c) => makeClip({
    slug: `padship ${c.id}`, stillFile: c.start(), endFile: c.end(), prompt: c.prompt, seconds: c.seconds, out: raw(`${c.id}.mp4`),
    raw: true, resolution: '720p', aspect: '16:9', models: (process.env.PADSHIP_VIDEO_MODELS || 'seegen:wan3.0-video').split(','),
  })));
}

export async function makeSounds(only = []) {
  fs.mkdirSync(path.join(DIR, 'audio'), { recursive: true });
  await Promise.all(SOUNDS.filter((s) => !only.length || only.includes(s.id)).map((s) =>
    soundTake({ id: `padship-${s.id}`, prompt: s.prompt, model: process.env.SFX_MODEL || 'atlascloud:h3-t2v', seconds: s.seconds, dir: path.join(DIR, 'audio') })));
}

/** A + B with the sound bed, per outcome; the timings into the pad manifest. */
export function bake() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(LOOK, { recursive: true });
  const tmp = path.join(DIR, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const aud = (id) => path.join(DIR, 'audio', `padship-${id}.mp4`);
  const clips = {};
  // The poster: the interface's own picture (the screenshot the films end on), held while it takes over or on a skip.
  const poster = 'ship-end.webp';
  ffmpeg(['-i', raw('interface-end.png'), '-c:v', 'libwebp', '-quality', '86', path.join(OUT, poster)], 'poster');
  for (const o of ['won', 'lost']) {
    // A (first person) + RISE (the camera pulls back over his shoulder: he appears where the viewpoint was) + WALK.
    const a = raw(`${o}.mp4`), r = raw('rise.mp4'), b = raw('walk.mp4');
    if (![a, r, b].every((f) => fs.existsSync(f))) { console.log(`[padship] ${o}: clips missing, not baked`); continue; }
    const da = seconds(a), dr = seconds(r), db = seconds(b);
    const total = +(da + dr + db).toFixed(3);
    const norm = (src, out) => ffmpeg(['-i', src, '-vf', `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`, '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', out], `norm ${path.basename(src)}`);
    const na = path.join(tmp, `${o}-a.mp4`), nr = path.join(tmp, 'rise-r.mp4'), nb = path.join(tmp, `walk-b.mp4`);
    norm(a, na); norm(r, nr); norm(b, nb);
    const list = path.join(tmp, `${o}-list.txt`);
    fs.writeFileSync(list, [na, nr, nb].map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n') + '\n');
    const joined = path.join(tmp, `${o}-joined.mp4`);
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], `${o} join`);
    // The sound bed: the ship's hum under all of it, the chair and steps from the start, the hatch as he steps through.
    const inputs = [], parts = [];
    const add = (id, at, gain) => {
      if (!fs.existsSync(aud(id))) return;
      inputs.push('-i', aud(id));
      const n = inputs.filter((x) => x === '-i').length; // 1-based among the audio inputs (input 0 is the video)
      parts.push(`[${n}:a]volume=${gain},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)},apad[s${n}]`);
    };
    add('ship-amb', 0, 1.0);
    add('stand', o === 'lost' ? 0.5 : 0.2, 3.0);
    add('stand', da + 0.4, 2.0); // his steps as he rises into the picture
    add('hatch', Math.max(0, da + dr - 0.6), 1.6);
    const out = path.join(OUT, `ship-${o}.mp4`);
    if (parts.length) {
      const labels = parts.map((p) => p.match(/\[s\d+\]$/)[0]).join('');
      const fc = `${parts.join(';')};${labels}amix=inputs=${parts.length}:normalize=0,afade=t=in:d=0.4,afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8,` +
        `atrim=0:${total},loudnorm=I=-22:TP=-3:LRA=9[a]`;
      ffmpeg(['-i', joined, ...inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-t', String(total), '-movflags', '+faststart', out], `${o} mix`);
    } else {
      ffmpeg(['-i', joined, '-c', 'copy', '-movflags', '+faststart', out], `${o} copy`);
    }
    clips[o] = { video: `ship-${o}.mp4`, seconds: total, cut: +da.toFixed(3), w: W, h: H, fps: FPS, poster };
    // Review: a strip of the clip, and the two joins checked (part 1's end against A's start; B's end against the room loop).
    const strip = path.join(LOOK, `ship-${o}-strip.jpg`);
    ffmpeg(['-i', out, '-vf', `fps=${(8 / total).toFixed(4)},scale=320:-2,tile=8x1`, '-frames:v', '1', strip], `${o} strip`);
    const first = path.join(tmp, `${o}-first.png`), lastB = path.join(tmp, `${o}-last.png`);
    ffmpeg(['-i', out, '-frames:v', '1', first], 'first');
    ffmpeg(['-sseof', '-0.2', '-i', out, '-frames:v', '1', lastB], 'last');
    ffmpeg(['-i', raw(`${o}-start.png`), '-i', first, '-filter_complex', '[0:v]scale=640:-2[a];[1:v]scale=640:-2[b];[a][b]hstack', path.join(LOOK, `ship-${o}-join1.jpg`)], 'join1');
    ffmpeg(['-i', lastB, '-i', raw('interface-end.png'), '-filter_complex', '[0:v]scale=640:360[a];[1:v]scale=640:360[b];[a]format=gbrp[ag];[b]format=gbrp[bg];[ag][bg]blend=all_mode=difference,eq=contrast=3,format=yuv420p[d];[0:v]scale=640:360[a2];[1:v]scale=640:360[b2];[a2][b2][d]hstack=inputs=3',
      path.join(LOOK, `ship-${o}-join2.jpg`)], 'join2');
  }
  const mf = path.join(OUT, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.part2 = { ...(m.part2 ?? {}), ...clips };
  fs.writeFileSync(mf, JSON.stringify(m, null, 1));
  return clips;
}

export async function makePadShip({ framesOnly = false, stillsOnly = false, bakeOnly = false, only = [] } = {}) {
  if (!bakeOnly) {
    makeFrames();
    if (framesOnly) return;
    await makeStills(only);
    if (stillsOnly) return;
    await makeClips(only);
    await makeSounds(only);
  }
  return bake();
}
