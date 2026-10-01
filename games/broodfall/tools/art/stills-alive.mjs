/**
 * THE STILLS THAT COME ALIVE (Oct 1 2026; Collins: "anywhere else where video is needed? We should add it.").
 * notes/VIDEO-AUDIT.md lists every still the player sees and why each one is (or is not) a loop now.
 *
 *   node tools/art/stills-alive.mjs [group|group:id ...]           clips + bake (what is on disk is skipped)
 *   node tools/art/stills-alive.mjs --bake [group|group:id ...]    bake again from what is on disk (free)
 *   node tools/art/stills-alive.mjs --list                         the surfaces and their prompts
 *
 * Groups: scene (the faction scenes' lobby cards), reveal (the three reveal pictures), territory (the 16 landing
 * sites over the briefing), debrief (won / lost / held, the report's lead), partner (her file photograph on the pad).
 * The ending cards are NOT here: they already loop their ending film (src/ui/sceneVoice.ts).
 *
 * 1. THE SOURCE (art-src/stills-alive/<group>/<id>-src.png): the approved still (never touched) cut to the clip's
 *    aspect at the place the game shows it (a territory is shown at 16:7 from 60% down, so its 16:9 cut is taken there).
 * 2. THE CLIP (art-src/stills-alive/<group>/<id>-clip.mp4): image to video, END frame = START frame (seegen),
 *    camera locked, only small continuous motion in the picture's own look. To draw one again, MOVE its clip into
 *    art-src/stills-alive/<group>/v1/ (never delete) and run again.
 * 3. THE BAKE (public/art/alive/<group>-<id>.mp4 + .webp, alive.json): frame 0 (the uploaded still) dropped, the
 *    model's snap back to the end frame cut, a 0.6 s crossfade of the end into the start if the seam still shows.
 *    The poster IS the loop's first frame. Review: notes/art-review/stills-alive/<group>-<id>.jpg (the still, then
 *    eight frames across the loop, to LOOK at) and .json (seam, steps, drift from the first frame).
 *
 * The game: src/ui/alive.ts swaps a still for its loop (one <video> per surface, kept across redrawings), the still
 * stays when there is no loop, under Reduce motion, and while the surface is hidden.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { balance, ffmpeg, makeClip, pool, ready, spent } from './rfab.mjs';
import { ART, REVIEW, SRC } from './lib/manifest.mjs';

const DIR = path.join(SRC, 'stills-alive');
const OUT = path.join(ART, 'alive');
const REV = path.join(REVIEW, 'stills-alive');
const MODELS = (process.env.ALIVE_MODELS || 'seegen:sd2-fast,seegen:sd2-mini').split(',');
const RES = process.env.ALIVE_RES || '720p';
// sd2-fast honours the end frame and keeps the still's first frame (faces, framing); sd2-mini restyled the first frame,
// redrew the partner's face and left 8-13 points of seam (art-src/stills-alive/*/v1-sd2mini/, Oct 1 2026).
const SECONDS = Number(process.env.ALIVE_SECONDS || 5);

const KEEP = 'Camera completely locked: no zoom, no pan, no dolly, no tilt, no cuts; the framing never changes. ' +
  'Every face, head and body stays exactly as it is drawn (the same insect faces, the same eyes, the same clothes); ' +
  'nobody turns toward the camera, nobody new appears, nothing leaves the picture. No text appears: no letters, ' +
  'words, numbers or signs are added or changed. No religious symbol of any kind is added (no crosses, no stars, no ' +
  'crescents). Only small, gentle, continuous motion, like a living photograph. The clip ends exactly on the first ' +
  'picture again.';
const FILM = (what) => `A still from a 1950s Technicolor film comes gently alive, the same picture held almost still. ${what} ${KEEP}`;
const VIEW = (what) => `This painted aerial view of a city comes gently alive; the city stays exactly as it is drawn. ${what} ${KEEP}`;
const REEL = (what) => `A frame from a 1950s monster film comes gently alive, held like an extremely slow-motion shot. ${what} ${KEEP}`;

const scenes = (id) => path.join(SRC, 'ship', 'scenes', `${id}.png`);
const terr = (id) => path.join(SRC, 'ship', 'territories', `${id}.png`);

/** aspect: the clip's; y: where down the still the cut is taken (0 top, 0.5 middle, 1 bottom). */
export const SURFACES = [
  // ---- the faction scenes (campaignUi sceneHtml; a lobby card on the parchment) ----
  { group: 'scene', id: 'delegation-contact', from: scenes, aspect: '4:3',
    prompt: FILM('Seen from high above: a soft breeze ripples the grass and the crops, slow cloud shadows drift across the fields, the tiny figures along the road walk a few steps and the little buses inch along. The flowers laid out in the field stay exactly as they are.') },
  { group: 'scene', id: 'delegation-understand', from: scenes, aspect: '4:3',
    prompt: FILM('The red glassy growth that has burst through the window pulses very slowly, glistening; the little paper flags on the table stir; the guests breathe and shift their weight a little, the one at the right holds out his plate.') },
  { group: 'scene', id: 'delegation-stop-war', from: scenes, aspect: '4:3',
    prompt: FILM('A wind on the hilltop ruffles the edges of the big map and the clothes and hats of the crowd; far below, dust and thin smoke drift over the camp; the leader keeps pointing, breathing, his garland stirring.') },
  { group: 'scene', id: 'delegation-gaia', from: scenes, aspect: '4:3',
    prompt: FILM('The candle flames flicker; the red veined growth over the house pulses very slowly and glistens; the dark green clouds drift; the man with open arms breathes, his flower garland stirring; the kneeling ones sway a little.') },
  { group: 'scene', id: 'delegation-reveal', from: scenes, aspect: '4:3',
    prompt: FILM('Steam rises softly from the teacups and the teapot; the dial of the old radio glows and flickers; the coloured paper flags flutter in the breeze over the crowd; the grass and flowers sway; the figures breathe and shift a little.') },
  { group: 'scene', id: 'delegation-hurry', from: scenes, aspect: '4:3',
    prompt: FILM('A breeze moves through the grass and the far trees, the clouds drift slowly, a thin wisp of steam rises from the urn on the table; the rows of the crowd shift their weight; the man with the megaphone breathes, his garland stirring.') },
  { group: 'scene', id: 'faithful-contact', from: scenes, aspect: '4:3',
    prompt: FILM('The red on-air lamp pulses slowly; the needles of the meters on the console quiver; the vacuum tubes glow and flicker; the rings around the radio mast in the night sky pulse outward; the preacher behind the glass gestures a little; the operator turns a dial a little.') },
  { group: 'scene', id: 'faithful-signs', from: scenes, aspect: '4:3',
    prompt: FILM('The red lamp on the desk pulses slowly; the desk lamp glows; dust motes drift in its light; the preacher breathes, his raised finger trembling a little. The big open book stays still; no page turns. The plain gold hexagon on the wall stays exactly as it is.') },
  { group: 'scene', id: 'faithful-prophecy', from: scenes, aspect: '4:3',
    prompt: FILM('The flames along the river dance and flicker, embers and smoke drift up; the red growth over the cliff pulses slowly; the preacher on the roof of the van sways, his robe stirring in the wind; the kneeling crowd sways a little. The plain gold hexagon on its pole stays exactly as it is.') },
  { group: 'scene', id: 'faithful-prepare', from: scenes, aspect: '4:3',
    prompt: FILM('The pink evening clouds drift slowly; a breeze stirs the coats, dresses and hats of the waiting crowd; the preacher breathes and keeps pointing at the chart; the marks on the chart stay exactly as they are; the child at the telescope shifts a little.') },
  { group: 'scene', id: 'institute-contact', from: scenes, aspect: '4:3',
    prompt: FILM('The little television screen flickers; the dish outside the window turns very slowly against the night; the scientists shift their weight, the chart wobbles a little in their hands; the young one in the beanbag breathes, his thumbs moving on the controller.') },
  { group: 'scene', id: 'institute-machines', from: scenes, aspect: '4:3',
    prompt: FILM('Cold frosty mist drifts slowly inside the glass pods; the hanging lamps hum and flicker very faintly; the stormy clouds outside drift; the young one with the clipboard breathes and taps his pencil. The two men at the truck stay where they are, holding the pod on its trolley, only breathing.') },
  { group: 'scene', id: 'institute-pipeline', from: scenes, aspect: '4:3',
    prompt: FILM('The colours on the little television screen flicker; the red light on the camera blinks; the three ladies shift their handbags and breathe; the one in the beanbag rubs his brow a little; the scientist reads his clipboard.') },
  { group: 'scene', id: 'institute-ultimatum', from: scenes, aspect: '4:3',
    prompt: FILM('The painted clouds behind slowly drift; the brass apparatus glints; the three listeners at the desks write a little; the lecturer breathes, his pointer resting on the chalkboard. The chalk drawing stays exactly as it is.') },
  // ---- the reveal cards (content/campaign.ts `reveal`; their pictures are the campaign media's) ----
  { group: 'reveal', id: 'delegation-reveal-end', from: (id) => path.join(SRC, 'media', 'reveals', `${id}.png`), aspect: '4:3',
    prompt: FILM('The pink cards held up by the crowd flutter in a warm breeze; the meadow flowers sway; the golden glow of the honeycomb sky shimmers softly; the man in the garland breathes, his hands folded.') },
  { group: 'reveal', id: 'faithful-reveal-end', from: (id) => path.join(SRC, 'media', 'reveals', `${id}.png`), aspect: '4:3',
    prompt: FILM('The little lights in the honeycomb cells of the wall flicker softly like candles; reflections shimmer on the polished floor; the preacher breathes, his robe stirring, his raised hand trembling a little.') },
  { group: 'reveal', id: 'institute-reveal-end', from: (id) => path.join(SRC, 'media', 'reveals', `${id}.png`), aspect: '4:3',
    prompt: FILM('Flower petals drift slowly down through the air; the cheering crowd waves; the sun glows and the crystal towers glint; the one on the throne breathes, lounging, his crown glinting.') },
  // ---- the landing sites (campaignUi territoryPictureHtml; 16:7 from 60% down; about 460 px wide in the briefing: 480p) ----
  ...[
    ['crash-site', 'The column of smoke from the crater rises and drifts; the crowd around the crater mills about; the little cars move along the streets; the clouds drift.'],
    ['cul-de-sac', 'Dusk: the street lamps and windows twinkle; the far column of smoke drifts; the red growth at the right pulses slowly; tiny figures stroll the paths.'],
    ['granary', 'The wind ripples the fields; the far column of smoke drifts; the little car rolls slowly along the dirt road; the windmill turns slowly; the clouds drift.'],
    ['harbor', 'The sea moves with small waves and glints; smoke drifts from the ships\' funnels; the ships move very slowly; the red growth over the docks pulses slowly.'],
    ['commuter', 'Tiny cars flow slowly along the looping highways; the sunset clouds drift; the windows and the water towers glint.'],
    ['temple', 'The column of smoke drifts; the tiny figures move about the terraces; the high clouds drift slowly. The plain hexagons on the walls stay exactly as they are.'],
    ['foundry', 'Black smoke drifts from the many chimneys; the clouds move slowly; tiny workers and machines move between the sheds.'],
    ['mirewater', 'The water ripples and glints; the small boats drift; the reeds sway; tiny figures move on the walkways.'],
    ['university', 'Night: the coloured screens flicker; the window lights twinkle; the moonlit clouds drift; thin steam rises.'],
    ['ossuary', 'The sea surges and breaks white at the foot of the cliffs; the red stream down the cliff flows slowly; the clouds drift; tiny figures move.'],
    ['pilgrim', 'The red banners flutter; the waterfall flows; the clouds drift slowly; tiny figures walk the great road.'],
    ['queens-hollow', 'The golden lanterns glow and flicker; thin smoke drifts from the towers; the tiny crowds move along the tiers.'],
    ['hidden-campus', 'Almost nothing moves: only the glowing tanks inside the glass halls pulse very softly and the far clouds drift a little. The picture is held exactly as it is, the same distance and angle the whole time; the camera does not move closer.'],
    ['assembly', 'The smoke on the horizon drifts; the red clouds roll slowly; the red growth at the edges of the city pulses slowly.'],
    ['seventh-city', 'The red lights on the masts blink; the rings in the sky pulse outward softly; the red growth over the ground pulses slowly; the clouds drift.'],
    ['glass-spires', 'Lightning flickers in the red storm clouds; the neon lights of the spires pulse; steam drifts from the vents.'],
  ].map(([id, what]) => ({ group: 'territory', id, from: terr, aspect: '16:9', y: 0.6, res: '480p', prompt: VIEW(what) })),
  // ---- the report's lead (src/ui/debrief.ts; a wide band from 40% down) ----
  { group: 'debrief', id: 'won', from: (id) => path.join(SRC, 'screens', `${id}.png`), aspect: '16:9', y: 0.4,
    prompt: REEL('The great red glassy growth over the houses pulses and writhes very slowly, glistening; the street lamps flicker; the fleeing townsfolk are almost frozen mid-stride, moving only a hair.') },
  { group: 'debrief', id: 'lost', from: (id) => path.join(SRC, 'screens', `${id}.png`), aspect: '16:9', y: 0.4,
    prompt: REEL('The small fires on the burnt growth flicker; smoke rises and drifts in the floodlight; the street lamps glow; the crowd waves its hats a little; the soldiers stand, breathing.') },
  { group: 'debrief', id: 'held', from: (id) => path.join(SRC, 'screens', `${id}.png`), aspect: '16:9', y: 0.4,
    prompt: REEL('The red glassy tendrils behind writhe slowly, glistening; steam and smoke drift through the street; the porch lamps flicker; the running soldiers are almost frozen mid-stride, moving only a hair.') },
  // ---- the candidate's file photograph on his data pad (campaignUi quartersHtml) ----
  { group: 'partner', id: 'partner', from: () => path.join(SRC, 'intro', 'pictures', 'partner.png'), aspect: '1:1',
    prompt: 'This plain file photograph comes subtly alive, like a living portrait. The young woman looks into the camera, ' +
      'breathes softly and blinks once, slowly; the faintest shift of her shoulders. Her face, expression, hair and ' +
      'collar stay exactly the same; she does not smile more, speak or turn. Camera completely locked: no zoom, no pan. ' +
      'No text appears. The clip ends exactly on the first picture again.' },
];

const CUT = { '4:3': [1365, 1024], '16:9': [1536, 864], '1:1': [1024, 1024] };
const raw = (s, what) => path.join(DIR, s.group, `${s.id}${what}`);
const key = (s) => `${s.group}:${s.id}`;

/** The still cut to the clip's aspect, where the game shows it. */
function source(s) {
  const out = raw(s, '-src.png');
  if (fs.existsSync(out)) return out;
  const file = s.from(s.id);
  if (!fs.existsSync(file)) throw new Error(`${key(s)}: no still at ${file}`);
  const [W, H] = CUT[s.aspect];
  const y = s.y ?? 0.5;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // Scaled to cover the cut, then cut at `y` (and in the middle across).
  ffmpeg(['-i', file, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}:(iw-${W})/2:(ih-${H})*${y}`, out], `${key(s)} source`);
  return out;
}

async function clips(items) {
  const res = await pool(items, 6, (s) => makeClip({
    slug: `alive-${s.group}-${s.id}`, stillFile: source(s), out: raw(s, '-clip.mp4'), models: MODELS,
    prompt: s.prompt, seconds: SECONDS, loop: true, raw: true, resolution: s.res ?? RES, aspect: s.aspect,
  }));
  res.forEach((x, i) => { if (!x.ok) console.warn(`[alive] ${key(items[i])} clip failed: ${String(x.error.message).slice(0, 200)}`); });
}

// ---- the bake (the ship loops' method: tools/art/ship-loops.mjs) ----

const duration = (file) => Math.round(Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim()) * 1000) / 1000;
const dims = (file) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim().split(',').map(Number);
function greyFrames(file) {
  const W = 64, H = 48;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 256 * 1024 * 1024 });
  const n = Math.floor(r.stdout.length / (W * H));
  return Array.from({ length: n }, (_, i) => r.stdout.subarray(i * W * H, (i + 1) * W * H));
}
const diff = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]); return d / a.length; };
const ENC = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const FPS = 24;

function bake(s) {
  const clip = raw(s, '-clip.mp4');
  if (!fs.existsSync(clip)) return null;
  fs.mkdirSync(OUT, { recursive: true });
  const [w, h] = dims(clip);
  const W = w - (w % 2), H = h - (h % 2);
  const tmp = raw(s, '-plain.mp4');
  ffmpeg(['-i', clip, '-vf', `trim=start_frame=1,setpts=PTS-STARTPTS,scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`,
    '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', tmp], `${key(s)} plain`);
  let f = greyFrames(tmp);
  const steps = f.slice(1).map((x, i) => diff(f[i], x));
  const step = [...steps].sort((a, b) => a - b)[steps.length >> 1];
  let snap = f.length;
  for (let i = Math.max(1, f.length - 12); i < f.length; i++) if (steps[i - 1] > Math.max(0.6, 3 * step)) { snap = i; break; }
  if (snap < f.length) {
    const cut = raw(s, '-cut.mp4');
    ffmpeg(['-i', tmp, '-vf', `trim=end_frame=${snap},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', cut], `${key(s)} cut snap`);
    fs.renameSync(cut, tmp);
    f = greyFrames(tmp);
  }
  const seam = diff(f[f.length - 1], f[0]);
  const name = `${s.group}-${s.id}`;
  const out = path.join(OUT, `${name}.mp4`);
  let fixed = snap < steps.length + 1 ? `cut ${steps.length + 1 - snap} snapping frames; ` : '';
  // Crossfaded whenever the seam is more than half again a typical step (a seam at 2x a step still showed as a tick).
  if (seam > Math.max(0.4, 1.5 * step)) {
    const L = duration(tmp);
    const D = 0.6;
    const k = (D - 1 / FPS).toFixed(4);
    ffmpeg(['-i', tmp, '-filter_complex',
      `[0:v]split=3[t][h][m];[t]trim=start=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[T];` +
      `[h]trim=end=${D},setpts=PTS-STARTPTS[H];[m]trim=start=${D}:end=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[M];` +
      `[T][H]blend=all_expr='A*(1-min(T/${k},1))+B*min(T/${k},1)'[X];[X][M]concat=n=2:v=1,format=yuv420p[v]`,
    '-map', '[v]', ...ENC, out], `${key(s)} crossfade`);
    fixed += `crossfade ${D}s`;
  } else {
    ffmpeg(['-i', tmp, ...ENC, out], `${key(s)} encode`);
    fixed += 'none';
  }
  fs.rmSync(tmp, { force: true });
  ffmpeg(['-i', out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', path.join(OUT, `${name}.webp`)], `${key(s)} poster`);
  const g = greyFrames(out);
  const gs = g.slice(1).map((x, i) => diff(g[i], x));
  const sorted = [...gs].sort((a, b) => a - b);
  const drift = g.map((x) => diff(x, g[0]));
  const secs = duration(out);
  // Review: the still it started from, then eight frames across the loop (LOOK at faces, lettering, zoom, symbols).
  fs.mkdirSync(REV, { recursive: true });
  const tw = 480, th = Math.round((tw * H) / W / 2) * 2;
  const tiles = [[source(s), 0], ...Array.from({ length: 8 }, (_, i) => [out, (secs * i) / 8])].map(([file, t], i) => {
    const jpg = raw(s, `-rev${i}.jpg`);
    ffmpeg(['-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${tw}:${th}`, '-q:v', '3', jpg], `${key(s)} tile`);
    return jpg;
  });
  const lay = Array.from({ length: 9 }, (_, i) => `${(i % 3) * tw}_${Math.floor(i / 3) * th}`).join('|');
  ffmpeg([...tiles.flatMap((t) => ['-i', t]), '-filter_complex', `${tiles.map((_, i) => `[${i}]`).join('')}xstack=inputs=9:layout=${lay}[v]`, '-map', '[v]', '-q:v', '4',
    path.join(REV, `${name}.jpg`)], `${key(s)} sheet`);
  for (const t of tiles) fs.rmSync(t, { force: true });
  const meta = fs.existsSync(raw(s, '-clip.json')) ? JSON.parse(fs.readFileSync(raw(s, '-clip.json'), 'utf8')) : {};
  const report = {
    id: key(s), model: meta.model, seconds: secs, size: `${W}x${H}`, bytes: fs.statSync(out).size,
    medianStep: +sorted[sorted.length >> 1].toFixed(2), maxStep: +sorted[sorted.length - 1].toFixed(2),
    seamBefore: +seam.toFixed(2), seamAfter: +diff(g[g.length - 1], g[0]).toFixed(2), maxDrift: +Math.max(...drift).toFixed(2), fixed,
    tiles: 'the still it started from | then 8 frames across the loop',
  };
  fs.writeFileSync(path.join(REV, `${name}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(`[alive] baked ${key(s)}: ${JSON.stringify(report)}`);
  return { video: `alive/${name}.mp4`, poster: `alive/${name}.webp`, w: W, h: H, seconds: secs };
}

export function bakeAll(items) {
  const file = path.join(OUT, 'alive.json');
  const json = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { items: {} };
  for (const s of items) {
    const e = bake(s);
    if (e) json.items[key(s)] = e;
  }
  fs.mkdirSync(OUT, { recursive: true });
  json.items = Object.fromEntries(Object.entries(json.items).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  return json;
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const picks = args.filter((a) => !a.startsWith('--'));
const items = SURFACES.filter((s) => !picks.length || picks.includes(s.group) || picks.includes(key(s)));
if (flags.has('--list')) {
  for (const s of items) console.log(`${key(s)} [${s.aspect}]\n  ${s.prompt}\n`);
  process.exit(0);
}
if (!flags.has('--bake')) {
  ready();
  for (const s of items) source(s);
  const before = await balance();
  await clips(items);
  const after = await balance();
  console.log(`[alive] asked for ${spent.clips} clips; balance ${before} -> ${after} (${before - after} tokens)`);
}
bakeAll(items);
