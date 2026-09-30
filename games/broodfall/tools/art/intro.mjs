/**
 * THE OPENING CINEMATIC AND THE MENU LOOP (Sep 30 2026).
 *
 *   node tools/art/intro.mjs                  whatever is missing (stills, then clips), then the bake
 *   node tools/art/intro.mjs sky fall         only some of it
 *   node tools/art/intro.mjs --stills         only the stills (LOOK at them before paying for clips)
 *   node tools/art/intro.mjs --bake           bake again from what is on disk (free)
 *
 * SPENDS RFab tokens (a high still about $0.50, a 4 s 720p clip about $0.49). Every step skips
 * what is on disk. Raw files: art-src/intro/ (git-ignored): <id>.png (the still, 1536x1024),
 * <id>-169.png (the still cut to 16:9, what the clip starts from), <id>-clip.mp4 (+ .json with the
 * model). To draw one again, MOVE its files into art-src/intro/v1/ (never delete) and run again.
 *
 * Baked: public/art/intro/<id>.mp4 (H.264, 1280x720, 24 fps, no audio) + <id>.webp (a poster,
 * a middle frame, 960 wide) and public/art/intro/intro.json (the order the game plays them in).
 * To look at: notes/art-review/intro/<id>.jpg (the still and three frames) + <id>.json (checks).
 *
 * The cinematic is the insects' side ONLY (the 1950s B-movie look, style bible rule 4): a living
 * meteor falls on a small insect town and starts to grow. Never a human, a spaceship, the Empire
 * or its gear. The menu is the ship's own look (black, white, bare): the view from its viewport.
 * Shots sky, fall and rise keep the top of the picture empty sky: the game sets the title there.
 * The shot ids are read by the game: keep them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { balance, ffmpeg, makeClip, makeStill, pool, ready, spent } from './rfab.mjs';
import { ART, REVIEW, ROOT, SRC } from './lib/manifest.mjs';

const DIR = path.join(SRC, 'intro');
const OUT = path.join(ART, 'intro');
const REV = path.join(REVIEW, 'intro');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');

// The blocks of tools/art/templates/screens.mjs (not exported there), with the cinematic's own
// "never" added: the story is told from the ground.
const NOTHING =
  'No text anywhere: no letters, no words, no numbers, no signs with writing, no logos, no posters. No crosses, no stars, ' +
  'no crescents, no churches, no steeples, no religious symbol of any kind. No humans and no human faces: every ' +
  'person is an insect. No spaceship, no aircraft, no gear symbol.';
const PEOPLE =
  'insect people like those of a 1950s science-fiction film: human posture and body language, an insect head with ' +
  'large round eyes, small mandibles and antennae, dark umber chitin instead of skin, dressed in 1950s clothes ' +
  '(hats, suits, cardigans, print dresses)';
const FILM =
  'A wide film still from a 1950s colour science-fiction monster film: saturated Technicolor, theatrical studio ' +
  'lighting with deep black shadows, a miniature town set, practical effects, film grain, the slight softness of old lenses.';
const METEOR =
  'a living meteor: a round seed-pod of glistening dark red flesh with pale bone spikes, split open along one side ' +
  'with a hot orange glow inside, trailing fire and loose red tendrils';
const TOWN = 'a small town of tidy wooden houses, a water tower and a main street with a diner and street lamps';
const TOP = 'The whole top third of the picture is empty dark sky with nothing in it, for a title to be set over.';

// The clip's wording. `raw: true`: the pipeline's locked-camera, key-colour tail is not added.
const CLIP_TAIL =
  'One continuous shot, no cuts. It keeps the look of a 1950s Technicolor monster film with film grain. ' +
  'The insect people keep their insect heads and the same bodies in every frame; nothing morphs or duplicates. ' +
  'No text appears.';

const FILM_REFS = ['r2-film-still.png', 'r2-castes-human.png'].map((f) => path.join(CONCEPTS, f));
const TITLE = path.join(SRC, 'screens', 'title.png');

export const SHOTS = [
  {
    id: 'sky',
    still: `${FILM} Night over ${TOWN}, a town of ${PEOPLE}, seen from a little above the rooftops: warm lit windows, ` +
      'the street lamps glowing, dark hills behind, calm. High in the dark sky, a single small red light, like a ' +
      `red star, no bigger than a coin. ${TOP} ${NOTHING}`,
    clip: 'The camera pushes in slowly and smoothly toward the town. The small red light high in the sky slowly ' +
      'grows bigger and brighter, glowing red. Windows glow, a faint breeze moves the trees.',
  },
  {
    id: 'lookup',
    still: `${FILM} Night, outside a small-town diner with glowing windows and a street lamp: a group of ${PEOPLE} ` +
      'stand on the pavement and look up at the sky in wonder and fear, a hot red glow from above lighting their ' +
      'faces and clothes; one of them points up. Seen from the street at their height, looking slightly up at them.' +
      ` ${NOTHING}`,
    clip: 'The camera holds, drifting very slightly. The insect people react: they step back, one points up, one ' +
      'raises a hand to shield the eyes, antennae twitch. The red light on their faces swells brighter and brighter. ' +
      // v1 (art-src/intro/v1/lookup-clip-a.mp4): a human man walked into the right of the frame half-way through.
      'Only the insect people already in the picture: nobody new walks in, and every face stays an insect face ' +
      'with big round eyes; no human appears at any moment.',
  },
  {
    id: 'fall',
    still: `${FILM} Night sky above a small town: ${METEOR}, tears down through low clouds on a steep diagonal from ` +
      'upper right to lower left, lighting the clouds from inside in orange and red. Far below, the tiny lights ' +
      `of the town and its water tower. ${TOP} ${NOTHING}`,
    clip: 'The living meteor plunges down past the camera toward the town below, trailing fire and red tendrils, ' +
      'the clouds lit orange as it tears through them. The camera tilts down slightly to follow it.',
  },
  {
    id: 'impact',
    still: `${FILM} The town square of ${TOWN}, at night: a huge orange fireball and blast at the moment of a meteor ` +
      'strike, debris and shingles flying, a shock wave of dust rolling out along the street, the water tower in ' +
      `black silhouette against the fire. Seen from down the main street. ${NOTHING}`,
    clip: 'The explosion blooms outward: the fireball grows and rolls upward into a mushroom of fire and smoke, debris ' +
      'flies, the shock wave rolls toward the camera, the camera shakes a little. The water tower stays standing in silhouette.',
  },
  {
    id: 'crater',
    still: `${FILM} Night, the main street of a small insect town after a meteor strike: smoke clearing, a smoking ` +
      `crater broken into the pavement, and in it ${METEOR.replace('trailing fire and loose red tendrils', 'still smoking')}; ` +
      'glowing from inside. A single wet glistening red tendril slides out of it over the broken pavement. Wrecked ' +
      `wooden house fronts and a bent street lamp around it. Seen from a little above the street. ${NOTHING}`,
    clip: 'The wet red tendril slowly creeps forward out of the crater across the pavement toward the camera, the ' +
      'glow inside the split pod pulses, smoke drifts across the street. The camera holds, drifting slightly.',
  },
  {
    id: 'creep',
    still: `${FILM} Night in a street of a small insect town: a dark maroon living skin, matte and veined like flesh, ` +
      'spreads across the pavement from off screen, over a small parked round beetle-shaped 1950s car and up the ' +
      'wall of a wooden house; a street lamp above it flickers. Wet red light, deep shadows, nobody in sight. ' +
      `${NOTHING}`,
    clip: 'The dark maroon veined living skin spreads further across the street, flowing over the car and climbing ' +
      'higher up the house wall, its veins pulsing. The street lamp flickers. The camera holds, drifting slightly.',
  },
  {
    id: 'militia',
    still: `${FILM} Night, the main street of a small town: a squad of insect militia (insect heads with large round ` +
      'eyes and antennae, dark umber chitin) in 1950s olive army helmets and olive uniforms, with rifles and ' +
      'flashlights, run down the street toward the camera and toward a red glow behind the camera; a turning red ' +
      `siren light on a round old army jeep throws red light over the house fronts. ${NOTHING}`,
    clip: 'The insect militia charge down the street toward the camera with their rifles, flashlight beams swinging, ' +
      'the red siren light turning and sweeping over them. The camera backs away slowly in front of them.',
  },
  {
    id: 'rise',
    still: `${FILM} Night, a small insect town burning: out of a smoking crater in the main street rises a tall ` +
      'living tower, a giant monster limb of salmon-pink wet muscle armoured with plates of dark chitin and ivory ' +
      'bone, glistening, unfolding upward like a great claw or flower, towering over the wooden houses and the ' +
      'water tower; the sky behind is burning orange with smoke. Tiny insect militia in olive helmets stand in the ' +
      `street below it, small against it. ${TOP} ${NOTHING}`,
    clip: 'The giant living limb rises higher out of the crater and slowly unfolds and opens, its wet muscle and bone ' +
      'plates flexing, embers and smoke drifting past; the tiny militia below step back. The camera tilts up slightly.',
  },
];

export const MENU = {
  id: 'menu',
  still: 'A lifelike photograph from inside a far-future orbital ship of an austere, ultra-efficient society: ' +
    'standing at a huge viewport. The edges of the picture are the ship\'s bare interior: matte black panels and ' +
    'bare pale ceramic with flush seams and exact edges, lit by even white light, a thin line of white light along ' +
    'the frame; nothing else, no ornament, no screens. The room is EMPTY: no person, no figure, no silhouette anywhere. The window fills most of the picture: through ' +
    'it, far below, the night side of an alien planet whose continents are invented (NOT Earth: no Europe, no real coastline; shaped like the continents of the second reference map), with the pale golden lights of its cities, and across one ' +
    'continent a spreading dark red stain of infection, veined like living tissue, with a few glowing orange ' +
    'points of burning cities inside it. A thin blue line of atmosphere along the curve of the planet, black space ' +
    'with faint stars above. No text, no letters, no numbers, no logos, no symbols.',
  clip: 'The camera is completely locked, it does not move at all. Very slowly the planet turns, thin clouds drift ' +
    'across its night side, the orange points of fire flicker, and a small white light on the window frame blinks ' +
    'slowly. The ship\'s interior does not change. No cuts, no people, no text.',
};

const ALL = [...SHOTS, MENU];
const raw = (id, what) => path.join(DIR, `${id}${what}`);

function menuRefs() {
  // The ship's look: a room with a window (baked) and the white operations concept.
  const room = path.join(DIR, 'refs', 'room-comms.png');
  if (!fs.existsSync(room)) {
    fs.mkdirSync(path.dirname(room), { recursive: true });
    ffmpeg(['-i', path.join(ART, 'ship', 'room-comms.webp'), room], 'menu ref');
  }
  // v1 (art-src/intro/v1/menu-a.png) took the white operations concept's man into the picture and drew
  // Europe: the game's own planet map is the second reference now, and the room is said to be empty.
  const map = path.join(DIR, 'refs', 'planet.png');
  if (!fs.existsSync(map)) ffmpeg(['-i', path.join(ART, 'ship', 'planet.webp'), map], 'menu map');
  return [room, map];
}

async function stills(items) {
  const res = await pool(items, 4, (s) => makeStill({
    slug: `intro ${s.id}`, out: raw(s.id, '.png'), prompt: s.still, key: null,
    width: 1536, height: 1024, quality: 'high',
    refFiles: (s.id === 'menu' ? menuRefs() : [...FILM_REFS, TITLE]).filter((f) => fs.existsSync(f)),
  }));
  res.forEach((r, i) => { if (!r.ok) console.warn(`[intro] ${items[i].id} still failed: ${r.error.message.slice(0, 200)}`); });
}

/** The still cut to 16:9 (1536x864 from the middle), which is what the clip starts from. */
function still169(id) {
  const out = raw(id, '-169.png');
  if (!fs.existsSync(out)) ffmpeg(['-i', raw(id, '.png'), '-vf', 'crop=1536:864:0:80', out], `${id} 16:9`);
  return out;
}

async function clips(items) {
  const ready_ = items.filter((s) => fs.existsSync(raw(s.id, '.png')));
  const res = await pool(ready_, 4, (s) => makeClip({
    slug: `intro-${s.id}`, stillFile: still169(s.id), out: raw(s.id, '-clip.mp4'),
    prompt: s.id === 'menu' ? s.clip : `${s.clip} ${CLIP_TAIL}`,
    seconds: 4, loop: s.id === 'menu', raw: true, resolution: '720p', aspect: '16:9',
  }));
  res.forEach((r, i) => { if (!r.ok) console.warn(`[intro] ${ready_[i].id} clip failed: ${r.error.message.slice(0, 200)}`); });
}

// ---- bake ----

function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Math.round(Number(r.stdout.trim()) * 1000) / 1000;
}

/** Every frame of a clip, grey, 64x36: to measure how much it moves, where it cuts, how its loop closes. */
function greyFrames(file, skipFirst = false) {
  const W = 64, H = 36;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf',
    `${skipFirst ? 'trim=start_frame=1,setpts=PTS-STARTPTS,' : ''}scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'],
  { maxBuffer: 256 * 1024 * 1024 });
  const n = Math.floor(r.stdout.length / (W * H));
  return Array.from({ length: n }, (_, i) => r.stdout.subarray(i * W * H, (i + 1) * W * H));
}
const diff = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]); return d / a.length; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** Does frame 0 (the uploaded still) flash brighter than frame 1? */
function flashes(clip) {
  const f = greyFrames(clip).slice(0, 3);
  if (f.length < 3) return false;
  return diff(f[0], f[1]) > 2.5 * Math.max(0.5, diff(f[1], f[2])) || Math.abs(mean(f[0]) - mean(f[1])) > 4;
}

const ENC = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

function bakeShot(id) {
  const clip = raw(id, '-clip.mp4');
  const out = path.join(OUT, `${id}.mp4`);
  const drop = flashes(clip);
  // A last frame that jumps (much more than the frames before it moved) is cut off too.
  const f = greyFrames(clip);
  const steps = f.slice(1).map((x, i) => diff(f[i], x));
  const med = [...steps].sort((a, b) => a - b)[steps.length >> 1];
  const dropLast = steps[steps.length - 1] > Math.max(4, 4 * med);
  const keep = f.length - (drop ? 1 : 0) - (dropLast ? 1 : 0);
  const head = `${drop ? 'trim=start_frame=1,setpts=PTS-STARTPTS,' : ''}${dropLast ? `trim=end_frame=${keep},` : ''}`;
  ffmpeg(['-i', clip, '-vf', `${head}scale=1280:720:flags=lanczos,fps=24,format=yuv420p`, ...ENC, out], `${id} bake`);
  return { drop, dropLast };
}

/**
 * The menu: a clip whose last frame is its first. Frame 0 (the still) is dropped either way, so the
 * last frame leads into frame 1 as it did in the clip. If the model drifted (the seam differs much
 * more than two neighbouring frames do), the last 0.75 s is crossfaded into the first 0.75 s.
 */
function bakeMenu() {
  const clip = raw('menu', '-clip.mp4');
  const out = path.join(OUT, 'menu.mp4');
  const tmp = raw('menu', '-plain.mp4');
  ffmpeg(['-i', clip, '-vf', 'trim=start_frame=1,setpts=PTS-STARTPTS,scale=1280:720:flags=lanczos,fps=24,format=yuv420p',
    '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', tmp], 'menu plain');
  let f = greyFrames(tmp);
  const raw_ = f.slice(1).map((x, i) => diff(f[i], x));
  const step = [...raw_].sort((a, b) => a - b)[raw_.length >> 1];
  // The model SNAPS to the end frame in its last few frames (Sep 30: 0.5-0.8 steps against 0.1). Those
  // frames are cut, and the crossfade below closes the loop instead.
  let snap = f.length;
  for (let i = Math.max(1, f.length - 12); i < f.length; i++) if (raw_[i - 1] > 3 * step) { snap = i; break; }
  if (snap < f.length) {
    const cut = raw('menu', '-cut.mp4');
    ffmpeg(['-i', tmp, '-vf', `trim=end_frame=${snap},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-crf', '14',
      '-pix_fmt', 'yuv420p', cut], 'menu cut snap');
    fs.renameSync(cut, tmp);
    f = greyFrames(tmp);
  }
  const seam = diff(f[f.length - 1], f[0]);
  let fixed = snap < raw_.length + 1 ? `cut ${raw_.length + 1 - snap} snapping frames; ` : '';
  if (seam > Math.max(0.5, 3 * step)) {
    const L = duration(tmp);
    const D = 0.75;
    // tail T = [L-D, L] crossfades into head H = [0, D] (this is the start of the loop), then the middle
    // M = [D, L-D]. M's last frame leads into T's first, H's last (weight 1 on the last blended frame) into M's first: every joint is a
    // neighbour of the clip, and the loop is L-D long.
    ffmpeg(['-i', tmp, '-filter_complex',
      `[0:v]split=3[t][h][m];[t]trim=start=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[T];` +
      `[h]trim=end=${D},setpts=PTS-STARTPTS[H];[m]trim=start=${D}:end=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[M];` +
      `[T][H]blend=all_expr='A*(1-min(T/${(D - 1 / 24).toFixed(4)},1))+B*min(T/${(D - 1 / 24).toFixed(4)},1)'[X];[X][M]concat=n=2:v=1,format=yuv420p[v]`,
    '-map', '[v]', ...ENC, out], 'menu crossfade');
    fixed += `crossfade ${D}s`;
  } else {
    fixed += 'none';
    ffmpeg(['-i', tmp, ...ENC, out], 'menu encode');
  }
  const g = greyFrames(out);
  const after = diff(g[g.length - 1], g[0]);
  return { step: +step.toFixed(2), seamBefore: +seam.toFixed(2), seamAfter: +after.toFixed(2), fixed };
}

/** How the clip moves: median and largest step between frames (a cut shows as a spike), start-to-end change. */
function motion(file) {
  const f = greyFrames(file);
  const steps = f.slice(1).map((x, i) => diff(f[i], x));
  const sorted = [...steps].sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  const max = sorted[sorted.length - 1];
  return {
    frames: f.length, medianStep: +med.toFixed(2), maxStep: +max.toFixed(2), maxAtFrame: steps.indexOf(max) + 1,
    startToEnd: +diff(f[0], f[f.length - 1]).toFixed(2),
    cut: max > Math.max(6, 6 * med), frozen: diff(f[0], f[f.length - 1]) < 1,
  };
}

function frameAt(file, t, out, w = 640) {
  ffmpeg(['-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${w}:-2`, '-q:v', '3', out], `frame ${out}`);
  return out;
}

/** The poster (a middle frame, 960 wide) and the review sheet: the still, then three frames of the clip. */
function posterAndSheet(id, extra = {}) {
  const mp4 = path.join(OUT, `${id}.mp4`);
  const secs = duration(mp4);
  ffmpeg(['-ss', (secs / 2).toFixed(3), '-i', mp4, '-frames:v', '1', '-vf', 'scale=960:-2', '-c:v', 'libwebp', '-q:v', '78',
    '-compression_level', '6', path.join(OUT, `${id}.webp`)], `${id} poster`);
  const tmp = path.join(DIR, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const tiles = [
    frameAt(raw(id, '-169.png'), 0, path.join(tmp, `${id}-0.jpg`)),
    ...[0.12, 0.5, 0.92].map((p, i) => frameAt(mp4, secs * p, path.join(tmp, `${id}-${i + 1}.jpg`))),
  ];
  if (id === 'menu') tiles.splice(1, 3, ...[[0.5, 'mid'], [secs - 0.05, 'last'], [0, 'first']]
    .map(([t, n]) => frameAt(mp4, t, path.join(tmp, `${id}-${n}.jpg`))));
  fs.mkdirSync(REV, { recursive: true });
  ffmpeg([...tiles.flatMap((t) => ['-i', t]), '-filter_complex',
    '[0][1][2][3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]', '-map', '[v]', '-q:v', '4', path.join(REV, `${id}.jpg`)], `${id} sheet`);
  const meta = fs.existsSync(raw(id, '-clip.json')) ? JSON.parse(fs.readFileSync(raw(id, '-clip.json'), 'utf8')) : {};
  const report = { id, model: meta.model, seconds: secs, bytes: fs.statSync(mp4).size, motion: motion(mp4), ...extra };
  fs.writeFileSync(path.join(REV, `${id}.json`), JSON.stringify(report, null, 2) + '\n');
  return report;
}

export function bakeIntro(only) {
  fs.mkdirSync(OUT, { recursive: true });
  const want = (id) => !only?.length || only.includes(id);
  const reports = {};
  for (const s of ALL) {
    if (!fs.existsSync(raw(s.id, '-clip.mp4'))) continue;
    if (want(s.id)) {
      const extra = s.id === 'menu' ? { loop: bakeMenu() } : bakeShot(s.id);
      reports[s.id] = posterAndSheet(s.id, extra);
      console.log(`[intro] baked ${s.id}: ${JSON.stringify(reports[s.id])}`);
    }
  }
  // intro.json lists what is baked (a shot that is not there is left out: the game plays what is listed).
  const entry = (id) => ({ video: `intro/${id}.mp4`, poster: `intro/${id}.webp`, seconds: duration(path.join(OUT, `${id}.mp4`)) });
  const has = (id) => fs.existsSync(path.join(OUT, `${id}.mp4`)) && fs.existsSync(path.join(OUT, `${id}.webp`));
  const json = { shots: SHOTS.filter((s) => has(s.id)).map((s) => ({ id: s.id, ...entry(s.id) })) };
  if (has('menu')) json.menu = entry('menu');
  fs.writeFileSync(path.join(OUT, 'intro.json'), JSON.stringify(json, null, 2) + '\n');
  const total = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`[intro] intro.json: ${json.shots.length} shots${json.menu ? ' + menu' : ''}; public/art/intro ${(total / 1024 / 1024).toFixed(2)} MB`);
  return json;
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const ids = args.filter((a) => !a.startsWith('--'));
const items = ALL.filter((s) => !ids.length || ids.includes(s.id));

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  fs.mkdirSync(DIR, { recursive: true });
  if (!flags.has('--bake')) {
    ready();
    const before = await balance();
    await stills(items);
    if (!flags.has('--stills')) await clips(items);
    const after = await balance();
    console.log(`[intro] asked for ${spent.stills} stills, ${spent.clips} clips; balance ${before} -> ${after} (${before - after} tokens)`);
  }
  if (!flags.has('--stills')) bakeIntro(ids);
}
