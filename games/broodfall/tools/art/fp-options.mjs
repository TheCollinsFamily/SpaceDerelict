/**
 * FIRST PERSON THE WHOLE WAY? OPTIONS TO LOOK AT (Collins, Oct 3 2026, of the pad's part 2: "would this look better if you
 * stayed in first person the whole time, but this would require slightly different view of many ship interiors ... think
 * through this and show me some options"). Nothing here is loaded by the game: it draws what the options would look like.
 *
 * Today (tools/art/templates/pad-ship.mjs): part 1 is first person (his hands set the pad down), part 2 pulls the camera out
 * of his eyes and watches him walk to the Directive Desk, and every room's backdrop (tools/art/ship-loops.mjs) has him in
 * it, seen from behind. Staying first person means the rooms are seen through his eyes instead.
 *
 *   node tools/art/fp-options.mjs --stills [ids]   the rooms through his eyes (LOOK before paying for clips)
 *   node tools/art/fp-options.mjs --clips [ids]    the walk in first person, and the camera settling back behind him
 *   node tools/art/fp-options.mjs --bake           the option films (free), from the clips and tools/shot-fp-options.mjs's screenshots
 *
 * Raw: art-src-new/fp-options/ (to draw one again, MOVE its file into art-src-new/fp-options/v1/, never delete).
 * To look at: notes/art-review/fp-options/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { balance, ffmpeg, makeClip, makeStill, pool, ready, spent } from './rfab.mjs';
import { ART, REVIEW, ROOT } from './lib/manifest.mjs';

const DIR = path.join(ROOT, 'art-src-new', 'fp-options');
const PADSHIP = path.join(ROOT, 'art-src-new', 'pad-ship');
const LOOK = path.join(REVIEW, 'fp-options');
const LOOPS = path.join(ART, 'ship', 'loops');
const W = 1280, H = 720, FPS = 30;
const raw = (f) => path.join(DIR, f);

const REAL = 'Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set, natural film grain.';
const NONE = 'No text anywhere: no letters, no words, no numbers, no logos, no badges. No religious symbol of any kind. Keep ' +
  'the one small plain gear symbol on the wall exactly as it is, if there is one.';
const EYES = (what) => `${REAL} A wide 16:9 frame. First-person point of view: the picture is exactly what the man in the first ` +
  'reference picture sees through his own eyes. The camera is where his head is and looks where he looks. It is the same room ' +
  'of the same small dark starship: the same matte black panelled walls, the same thin cold white light strips, the same ' +
  `furniture, the same darkness and light. ${what} ${NONE}`;
const ALONE = 'He is not in the picture: no person, no body, no hands anywhere.';
const ARMS = 'his own bare forearms and hands (plain black sleeves pushed up to the elbows, a thin cord bracelet on the right wrist)';

/** A room through his eyes. `ref`: the room's loop poster (him in it, from behind); the focal thing sits in the LEFT third, clear of the screen's panel. */
export const ROOMS = [
  { id: 'desk', ref: 'room-desk',
    prompt: EYES('He stands right at the round projection plinth and looks down across it. Its softly glowing white round top is ' +
      'a wide ellipse low in the picture, its centre a little left of the middle of the frame, its near rim just above the ' +
      'bottom edge. The dark air above it is empty. Beyond it the black panelled far wall, the thin white light strip along ' +
      `its base, the low black bench at the right. ${ALONE}`) },
  { id: 'desk-hands', ref: 'room-desk',
    prompt: EYES('He stands right at the round projection plinth and looks down across it. Its softly glowing white round top is ' +
      'a wide ellipse low in the picture, its centre a little left of the middle of the frame, its near rim just above the ' +
      'bottom edge. The dark air above it is empty. Beyond it the black panelled far wall, the thin white light strip along ' +
      `its base, the low black bench at the right. From the bottom edge ${ARMS} come into the picture, his hands resting ` +
      'lightly on the near rim of the plinth: the left hand at the lower left of the picture, the right hand right of the ' +
      'middle. Nothing else of him is seen; nobody else is in the room.') },
  // Oct 3 2026: under the report (its card covers the right two thirds, YOKE's intercom the lower left) the two desk views
  // above leave the left third a bare dark wall. Looking DOWN at the table fills it: the lit top, and his hand on it
  // (the film began with his hand beside the pad).
  { id: 'desk-down', ref: 'room-desk',
    prompt: EYES('He stands right at the round projection plinth, leaning a little over it, and looks down onto it. Its softly ' +
      'glowing white round top is very large in the picture: it fills the whole lower half of the frame from the left edge ' +
      'to well past the middle, its far rim a wide curve across the middle of the picture, its near rim below the bottom ' +
      'edge. Above the far rim the black panelled wall, the thin white light strip along its base, the low black bench at ' +
      `the right. From the left edge and the bottom ${ARMS.replace('forearms and hands', 'left forearm and hand')} come into ` +
      'the picture, the hand resting flat on the glowing top at the left of the picture, halfway up the frame, lit from ' +
      'below by it. Nothing else of him is seen; nobody else is in the room.') },
  { id: 'genes', ref: 'room-genes',
    prompt: EYES('He stands close to the tall glass cylinder and looks at it. The cylinder fills the left third of the picture ' +
      'from top to bottom: the round red culture floating in its clear fluid at eye level, the thin robotic arms around it. ' +
      'Right of it the long black counter along the far wall with its few steel vessels, and the black island bench at the ' +
      `lower right. From the bottom edge, left of the middle, ${ARMS.replace('forearms and hands', 'left forearm and hand')} ` +
      'come into the picture, holding a thin dark tablet whose screen is blank and dark. Nothing else of him is seen; nobody ' +
      'else is in the room.') },
  { id: 'comms', ref: 'room-comms',
    prompt: EYES('He sits on the bench at the communications console and looks at it. The three thin displays stand ahead at the ' +
      'left and fill the left third of the picture, showing only pale signal traces and soft static. Below them the sloped ' +
      `console with its keys and dials runs along the bottom left, and ${ARMS.replace('forearms and hands', 'right forearm and hand')} ` +
      'come in from the bottom edge, the hand resting on a dial. To the right, in the dark wall, the long window slit onto the ' +
      'planet exactly as in the reference picture: its night side, pale golden city lights, a spreading dark red veined stain, ' +
      'a thin blue line of atmosphere. Nothing else of him is seen; nobody else is in the room.') },
  { id: 'ai', ref: 'room-ai',
    prompt: EYES('He stands at the edge of the low round dais and looks across it. The dais with its ring of white light spreads ' +
      'across the lower left and the lower middle of the picture, its centre left of the middle of the frame; the air above ' +
      'it is empty and dark. Beyond it, far back, the rows of black processing columns with their tiny lights recede into ' +
      `the dark; the pale panelled wall with the small gear symbol at the right. ${ALONE}`) },
];

/** The room's loop poster as a PNG (the reference: the same room with him in it). */
function poster(ref) {
  const out = raw(`ref-${ref}.png`);
  if (!fs.existsSync(out)) ffmpeg(['-i', path.join(LOOPS, `${ref}.webp`), '-vf', 'scale=1536:864:flags=lanczos', out], `${ref} poster`);
  return out;
}

async function stills(only) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.mkdirSync(LOOK, { recursive: true });
  const items = ROOMS.filter((r) => !only.length || only.includes(r.id));
  const res = await pool(items, 5, (r) => makeStill({
    slug: `fp ${r.id}`, out: raw(`${r.id}.png`), prompt: r.prompt, key: null, width: 1536, height: 864,
    quality: process.env.FP_QUALITY || 'medium', refFiles: [poster(r.ref)],
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[fp] ${items[i].id}: ${x.error.message.slice(0, 300)}`); });
  for (const r of ROOMS) {
    if (!fs.existsSync(raw(`${r.id}.png`))) continue;
    // Side by side: the room as it is now | through his eyes.
    ffmpeg(['-i', poster(r.ref), '-i', raw(`${r.id}.png`), '-filter_complex', '[0:v]scale=960:540[a];[1:v]scale=960:540[b];[a][b]hstack', '-q:v', '3',
      path.join(LOOK, `room-${r.id}-now-vs-eyes.jpg`)], `${r.id} pair`);
    ffmpeg(['-i', raw(`${r.id}.png`), '-vf', `scale=${W}:${H}:flags=lanczos`, raw(`${r.id}-720.png`)], `${r.id} 720`);
  }
}

const POV = 'Strictly first person the whole time: the camera IS his eyes; we never see his face, his head or his back; nobody ' +
  'else is in the ship at any moment. ';
// Oct 3 2026, first takes: both walks drew a window onto the planet in the table room's left wall for a second (kept in
// art-src-new/fp-options/v1/). The room is described as what it is; no window is named (naming one draws one).
const BOX = 'which is a closed black box: every one of its walls is the same flat matte black panelling from floor to ceiling, ' +
  'lit only by the thin white light strips along the base of the walls.';
export const CLIPS = [
  // The walk through his eyes: from the TURN still (he has stood and turned to the open hatch) to the table, seen from his eyes.
  { id: 'walk', start: () => path.join(PADSHIP, 'turn.png'), end: () => raw('desk-720.png'), seconds: 5,
    prompt: `Aboard a small dark starship in orbit. ${POV}He walks forward across the dark room, leaving his desk behind him, ` +
      `through the open rounded hatchway into the small dark room beyond, ${BOX} He walks straight up to the round table, stops at ` +
      'it and looks down across its softly glowing white top, which glows a little brighter as he arrives, like a projector ' +
      'waking. The unhurried gait of a man walking in a ship\'s artificial gravity, a slight natural sway of the head, one ' +
      'continuous shot, no cuts. No hands or arms in the picture. The clip ends exactly on the second picture. No text anywhere.' },
  { id: 'walk-hands', start: () => path.join(PADSHIP, 'turn.png'), end: () => raw('desk-hands-720.png'), seconds: 5,
    prompt: `Aboard a small dark starship in orbit. ${POV}He walks forward across the dark room, leaving his desk behind him, ` +
      `through the open rounded hatchway into the small dark room beyond, ${BOX} He walks straight up to the round table, stops at ` +
      'it and looks down across its softly glowing white top; only as he stops do his own two bare forearms and hands come ' +
      'up from the bottom of the picture and rest on the near rim of the table, and its top glows a little brighter, like a ' +
      'projector waking. The unhurried gait of a man walking in a ship\'s artificial gravity, a slight natural sway of the ' +
      'head, one continuous shot, no cuts. The clip ends exactly on the second picture. No text anywhere.' },
  // First take (v1/walk-down-disc.mp4): told the top wakes 'like a projector', it drew a white disc and a rod lying on the
  // table and a different room (no bench), and did not land on the end picture. The top is described plain; the bench named.
  // The walk ending looking DOWN onto the table, his hand laid on its lit top (the frame that holds up under the report).
  { id: 'walk-down', start: () => path.join(PADSHIP, 'turn.png'), end: () => raw('desk-down-720.png'), seconds: 5,
    prompt: `Aboard a small dark starship in orbit. ${POV}He walks forward across the dark room, leaving his desk behind him, ` +
      `through the open rounded hatchway into the small dark room beyond, ${BOX} He walks straight up to the round table, stops ` +
      'right at it and leans a little over it, looking down onto its softly glowing white top, which fills the lower half of ' +
      'the picture; only as he stops does his own bare left forearm and hand come in from the lower left and come to rest ' +
      'flat on the glowing top. The top is one plain, evenly lit white surface with nothing on it but his hand, and the ' +
      'low black bench stands against the wall at the right the whole time. The unhurried gait of a man ' +
      'walking in the artificial gravity of a ship, a slight natural sway of the head, one continuous shot, no cuts. The clip ' +
      'ends exactly on the second picture. No text anywhere.' },
  // The camera settles back out of his eyes at the table, onto today's interface backdrop (him from behind at the left).
  { id: 'settle', start: () => raw('desk-720.png'), end: () => path.join(PADSHIP, 'interface-end.png'), seconds: 5,
    prompt: 'Aboard a small dark starship in orbit, a small dark room with ONE single round table (there is only one table). One ' +
      'smooth continuous camera move, no cut: the camera drifts straight back and a little to the right, out of the eyes of ' +
      'the man standing at the table, so that his own head, shoulders and back come into the picture from the left edge and ' +
      'he is revealed standing at the left beside the table, seen from behind, looking down at it: a slight young man with ' +
      'short dark messy hair and a pale stylus tucked behind his right ear, in a plain black high-collared shirt with the ' +
      'sleeves pushed up to the elbows and black trousers. He stands nearly still. The clip ends exactly on the second ' +
      'picture: the same single table, the same dim light, the same framing. No text anywhere.' },
];

async function clips(only) {
  const items = CLIPS.filter((c) => !only.length || only.includes(c.id));
  const res = await pool(items, 3, (c) => makeClip({
    slug: `fp ${c.id}`, stillFile: c.start(), endFile: c.end(), prompt: c.prompt, seconds: c.seconds, out: raw(`${c.id}.mp4`),
    raw: true, resolution: '720p', aspect: '16:9', models: (process.env.FP_VIDEO_MODELS || 'seegen:wan3.0-video').split(','),
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[fp] ${items[i].id}: ${x.error.message.slice(0, 300)}`); });
  for (const c of CLIPS) {
    if (!fs.existsSync(raw(`${c.id}.mp4`))) continue;
    ffmpeg(['-i', raw(`${c.id}.mp4`), '-vf', 'fps=8/5,scale=320:-2,tile=8x1', '-frames:v', '1', '-q:v', '3', path.join(LOOK, `clip-${c.id}-strip.jpg`)], `${c.id} strip`);
  }
}

const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`); return r.stdout; };
const seconds = (f) => +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim();

/**
 * The option films, each from part 1's last frame to its interface (a screenshot from tools/shot-fp-options.mjs faded in
 * over the last frame and held), with the ship's sound bed of the real film:
 *   A  today: public/art/pad/ship-won.mp4 (the camera pulls out of his eyes, we watch him walk)
 *   B  first person all the way: the stand-and-turn (pad-ship/v3/won.mp4) + the walk through his eyes, ending looking down
 *      onto the table with his hand on it -> the report over that view. Two other endings: his hands on the rim; no hands.
 *   C  first person until he arrives, then the camera settles back behind him -> today's interface
 */
function bake() {
  fs.mkdirSync(LOOK, { recursive: true });
  const tmp = raw('tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const turn = path.join(PADSHIP, 'v3', 'won.mp4');
  const aud = (id) => path.join(PADSHIP, 'audio', `padship-${id}.mp4`);
  const shot = (name) => raw(path.join('ui', `${name}.png`));
  const FILMS = [
    { id: 'A-today', parts: [{ f: path.join(ART, 'pad', 'ship-won.mp4') }], ui: 'report-now', stand: 5.3, hatch: 7.8, poster: 7.6 },
    { id: 'B-first-person', parts: [{ f: turn }, { f: raw('walk-down.mp4') }], ui: 'report-down', stand: 0.2, hatch: 6.6, poster: 9.9 },
    { id: 'B-hands-on-the-rim', parts: [{ f: turn }, { f: raw('walk-hands.mp4') }], ui: 'report-hands', stand: 0.2, hatch: 6.6, poster: 9.9 },
    { id: 'B-no-hands', parts: [{ f: turn }, { f: raw('walk.mp4') }], ui: 'report-eyes', stand: 0.2, hatch: 6.6, poster: 7.2 },
    { id: 'C-settle-back', parts: [{ f: turn }, { f: raw('walk.mp4') }, { f: raw('settle.mp4'), speed: 1.6 }], ui: 'report-now', stand: 0.2, hatch: 6.6, poster: 11.2 },
  ];
  for (const film of FILMS) {
    if (!film.parts.every((p) => fs.existsSync(p.f))) { console.log(`[fp] ${film.id}: clips missing, not baked`); continue; }
    const norm = film.parts.map((p, i) => {
      const out = path.join(tmp, `${film.id}-${i}.mp4`);
      const pts = p.speed ? `setpts=PTS/${p.speed},` : '';
      ffmpeg(['-i', p.f, '-vf', `${pts}scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`, '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', out], `${film.id} norm ${i}`);
      return out;
    });
    const list = path.join(tmp, `${film.id}-list.txt`);
    fs.writeFileSync(list, norm.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n') + '\n');
    const joined = path.join(tmp, `${film.id}-joined.mp4`);
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], `${film.id} join`);
    const d = seconds(joined);
    // The interface comes up over the film's last frame (0.9 s) and is held 2.6 s, as the game hands over.
    const HOLD = 3.5, FADE = 0.9;
    const ui = shot(film.ui);
    const withUi = path.join(tmp, `${film.id}-ui.mp4`);
    if (fs.existsSync(ui)) {
      ffmpeg(['-i', joined, '-loop', '1', '-t', String(d + HOLD), '-i', ui, '-filter_complex',
        `[0:v]tpad=stop_mode=clone:stop_duration=${HOLD}[v];[1:v]scale=${W}:${H},fps=${FPS},format=yuva420p,fade=t=in:st=${d.toFixed(3)}:d=${FADE}:alpha=1[s];[v][s]overlay=shortest=1,format=yuv420p`,
        '-an', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-t', String(d + HOLD), withUi], `${film.id} interface`);
    } else {
      console.log(`[fp] ${film.id}: no screenshot ${film.ui}.png yet (node tools/shot-fp-options.mjs), baked without the interface`);
      fs.copyFileSync(joined, withUi);
    }
    const total = seconds(withUi);
    const inputs = [], parts = [];
    const add = (id, at, gain) => {
      if (!fs.existsSync(aud(id))) return;
      inputs.push('-i', aud(id));
      const n = inputs.filter((x) => x === '-i').length;
      parts.push(`[${n}:a]volume=${gain},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)},apad[s${n}]`);
    };
    add('ship-amb', 0, 1.0);
    add('ship-amb', 9.5, 1.0); // the hum is 10 s long: a second lap under the held interface
    add('stand', film.stand, 3.0);
    add('hatch', film.hatch, 1.6);
    const out = path.join(LOOK, `film-${film.id}.mp4`);
    const labels = parts.map((p) => p.match(/\[s\d+\]$/)[0]).join('');
    ffmpeg(['-i', withUi, ...inputs, '-filter_complex',
      `${parts.join(';')};${labels}amix=inputs=${parts.length}:normalize=0,afade=t=in:d=0.4,afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8,atrim=0:${total},loudnorm=I=-22:TP=-3:LRA=9[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '112k', '-t', String(total), '-movflags', '+faststart', out], `${film.id} mix`);
    ffmpeg(['-i', out, '-vf', `fps=${(8 / total).toFixed(4)},scale=320:-2,tile=8x1`, '-frames:v', '1', '-q:v', '3', path.join(LOOK, `film-${film.id}-strip.jpg`)], `${film.id} strip`);
    // The picture a player's page shows before it is played: the moment that tells this film from the others.
    ffmpeg(['-ss', String(film.poster), '-i', out, '-frames:v', '1', '-q:v', '3', path.join(LOOK, `film-${film.id}-poster.jpg`)], `${film.id} poster`);
    console.log(`[fp] ${film.id}: ${total.toFixed(1)} s -> ${out}`);
  }
}

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
if (args.includes('--bake')) bake();
else {
  ready();
  const before = await balance();
  if (args.includes('--stills')) await stills(only);
  if (args.includes('--clips')) await clips(only);
  const after = await balance();
  console.log(`[fp] asked for ${spent.stills} stills, ${spent.clips} clips; ${before - after} tokens ($${((before - after) / 50000).toFixed(2)}); balance ${after}`);
}
