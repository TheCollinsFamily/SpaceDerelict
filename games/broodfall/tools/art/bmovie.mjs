/**
 * THE FIRST-BOOT FILM (Oct 1 2026): "THE THING FROM THE SKY", a 1950s B-movie trailer told from the street of the
 * Crash Site (the Suburbs tile set) on Night 0. Shot list and reasons: notes/BMOVIE-SHOTLIST.md.
 *
 *   node tools/art/bmovie.mjs --stills [ids]    the stills (LOOK at them before paying for clips)
 *   node tools/art/bmovie.mjs --clips [ids]     image-to-video of every still that has no clip
 *   node tools/art/bmovie.mjs --audio [ids]     the narrator's lines, the townsfolk's screams, the score
 *   node tools/art/bmovie.mjs --probe           the colour-or-black-and-white probe (free: one still graded both ways)
 *   node tools/art/bmovie.mjs --bake            cut, grade and mix the film (free)
 *   node tools/art/bmovie.mjs --reveal          the reveal after mission 1, cut from the landing films' release shot (free)
 *
 * SPENDS RFab tokens (a high still about $0.45, a Seedance 2.5 5 s 720p clip about $2.3, a narrator line about
 * $0.4, the score about $1). Every step skips what is on disk. Raw: art-src-new/bmovie/ or $BMOVIE_RAW (git-ignored): <id>.png,
 * <id>-clip.mp4, audio/<id>.mp4|.mp3. To make one again, MOVE its file into <raw>/v1/ (never delete).
 * Baked: public/art/intro/bmovie.mp4 (H.264 960x720 24 fps + AAC, the whole mix), bmovie.webp (poster),
 * bmovie.json (the titles' times), reveal.mp4 + reveal.webp. Review: notes/art-review/bmovie/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { balance, ffmpeg, makeClip, makeStill, pool, ready, spent } from './rfab.mjs';
import { RAW as AUDIO_RAW, soundTake, songTakes } from '../audio/rfab-audio.mjs';
import { ART, REVIEW, ROOT, SRC } from './lib/manifest.mjs';

// Raw files: $BMOVIE_RAW, else art-src-new/bmovie (Oct 1 2026: art-src was lost and is being restored; nothing new is written into it).
const DIR = process.env.BMOVIE_RAW || path.join(ROOT, 'art-src-new', 'bmovie');
const AUD = path.join(DIR, 'audio');
const OUT = path.join(ART, 'intro');
const REV = path.join(REVIEW, 'bmovie');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const raw = (f) => path.join(DIR, f);

// ------------------------------------------------------------------ the words of every prompt

const FILM =
  'A frame from a 1950s colour science-fiction monster film, shot on a studio backlot at night: saturated three-strip ' +
  'Technicolor, theatrical studio lighting with deep black shadows and coloured gels, painted-backdrop night sky, the ' +
  'slight softness of old lenses, film grain.';
const PEOPLE =
  'insect people like those of a 1950s science-fiction film (the second reference picture): human posture and body ' +
  'language, an insect head with large round eyes, small mandibles and antennae, dark umber chitin instead of skin, ' +
  'dressed in 1950s clothes (print dresses, cardigans, aprons, hats, a few suits); most of them are women';
const SUBURB =
  'an insect suburb in the style of a 1950s American suburb (the third reference picture): rounded single-storey ' +
  'houses of pale wasp paper and wax in mint, butter yellow, powder blue and salmon pink, round windows, striped ' +
  'awnings, white picket fences of wax, lawns, round dandelion-clock trees, small beetle-shaped cars with white-wall ' +
  'tyres, television aerials on the roofs, a civil-defence siren on a pole at the corner';
const METEOR =
  'a living meteor: a round seed-pod of glistening dark red flesh wrapped in a net of glowing orange cracks, pale bone ' +
  'spikes, trailing fire, black smoke and loose red tendrils';
const NOTHING =
  'No text anywhere: no letters, no words, no numbers, no signs with writing, no logos, no posters. No crosses, no ' +
  'stars of any religion, no crescents, no churches, no steeples, no religious symbol of any kind. No humans and no ' +
  'human faces: every person is an insect. No spaceship, no aircraft, no gear symbol.';
// The film is cut to 4:3 from a 16:9 clip: everything that matters stays in the middle.
// v1 of star, siren and stir drew crowds of insect monsters on all fours (they read as the threat); beam drew strangers behind.
const EMPTY = 'Nobody is in the picture: no people, no figures, no creatures, no silhouettes on the roofs.';
const MIDDLE = 'Composition: everything that matters is in the middle of the picture; the outer sixth on the left and on the right holds only background.';

const CLIP_TAIL =
  'One continuous shot, no cuts. It keeps the look of a 1950s Technicolor monster film. The insect people keep their ' +
  'insect heads and the same bodies in every frame; nothing morphs or duplicates; nobody new walks in; no human ' +
  'appears at any moment. No text appears.';

export const SHOTS = [
  { id: 'town', use: 5.0,
    still: `${FILM} Night over ${SUBURB}, seen from a little above the rooftops of a curving street: warm porch lights, ` +
      'glowing round windows, a water tower on the hill behind, a sky full of stars. Calm and pretty. ' + `${MIDDLE} ${NOTHING}`,
    clip: 'A slow, smooth crane shot gliding down over the rooftops toward the quiet street; porch lights glow, a faint ' +
      'breeze moves the round trees, a window light goes off. Calm.' },
  { id: 'porch', use: 4.5,
    still: `${FILM} Night, the porch of a pastel paper house in ${SUBURB}: two ${PEOPLE.replace('most of them are women', 'both women')} ` +
      'sit on a porch swing with glasses of lemonade, laughing; behind them a round window glows blue from a television; ' +
      `a wax picket fence and a porch lamp in front. Seen from the front lawn at their height. ${MIDDLE} ${NOTHING}`,
    clip: 'The porch swing rocks gently; the two insect women chat, one laughs and sips her lemonade, antennae bobbing; ' +
      'moths circle the porch lamp; the television glow flickers in the window. The camera holds.' },
  { id: 'laundry', use: 4.5,
    still: `${FILM} Night on a pastel suburban street corner in ${SUBURB}: the lit glass front of a small laundromat (rows ` +
      'of round washing machines inside, no writing anywhere), and beside it the dark front of a small school of pale ' +
      `paper with a flag pole without a flag. One of the ${PEOPLE.replace('most of them are women', 'a woman')} in a print dress ` +
      `steps out of the laundromat door carrying a wicker basket of laundry. ${MIDDLE} ${NOTHING}`,
    clip: 'The insect woman walks out of the laundromat with her basket, then stops; her antennae lift and she slowly ' +
      'raises her head to look up at the sky, puzzled, a faint red light starting to touch her face. The camera holds.' },
  { id: 'star', use: 4.0,
    still: `${FILM} The night sky above the rooftops and television aerials of ${SUBURB} (round pastel paper houses with round windows, not ordinary pitched-roof houses), the round water ` +
      'tower in black silhouette: a sky of painted stars, and high up a single small red star, brighter than the others, ' +
      `no bigger than a coin. The lower quarter is rooftops; the rest is sky. ${EMPTY} ${MIDDLE} ${NOTHING}`,
    clip: 'The camera slowly pushes in toward the sky. The small red star grows bigger and brighter, swelling into a ' +
      'burning red light with a short glowing tail, coming closer. The rooftops stay still.' },
  { id: 'kitchen', use: 4.0,
    still: `${FILM} Night, a 1950s kitchen in a pastel insect house: mint cabinets, a dish rack of plates, gingham ` +
      `curtains on the window over the sink. One of the ${PEOPLE.replace('most of them are women', 'a woman')} in an apron ` +
      'stands at the sink holding a plate, her back half to us, the dark window in front of her. Seen from inside the ' +
      `kitchen. ${MIDDLE} ${NOTHING}`,
    clip: 'Hot red light floods in through the kitchen window, brighter and brighter; the plates in the rack rattle; ' +
      'the insect woman turns from the window in fright and the plate slips from her hands and falls. The camera holds.' },
  { id: 'lookup', use: 4.5,
    still: `${FILM} Night, a pastel suburban street in ${SUBURB}: a small crowd of ${PEOPLE}, some in dressing gowns and ` +
      'curlers, some in hats, stand in the middle of the street and look up at the sky in wonder and fear, one pointing ' +
      `up; a hot red glow from above lights their faces. Seen from the street at their height, looking slightly up. ${MIDDLE} ${NOTHING}`,
    clip: 'The insect people react to something above them: they step back, one points up, one woman clutches her ' +
      'face and screams with her mandibles wide, antennae twitch; the red light on their faces swells brighter. The ' +
      'camera holds, drifting very slightly.' },
  { id: 'fall', use: 4.0,
    still: `${FILM} Night, looking up from a pastel suburban street: ${METEOR}, tears down out of the dark sky low over ` +
      'the round rooftops and television aerials, huge and close, lighting the clouds and the house fronts orange. ' +
      `${MIDDLE} ${NOTHING}`,
    clip: 'The burning living meteor roars down out of the sky straight over the rooftops, growing huge fast and tearing ' +
      'past overhead, motion blur, burning fragments falling; the camera shakes and whips round to follow it. Real physics.' },
  { id: 'duck', use: 3.5,
    still: `${FILM} Night, a pastel suburban street lit hot orange from above: ${PEOPLE} throw themselves down onto the ` +
      'pavement and the lawns, shielding their heads; a hat flies off; a beetle-shaped car, its windows glowing orange. ' +
      `${MIDDLE} ${NOTHING}`,
    clip: 'A blast of wind and orange light sweeps the street as something roars overhead: the insect people duck and ' +
      'cover their heads, clothes and antennae blown flat, a hat tumbling away down the street, the camera shaking.' },
  { id: 'impact', use: 4.0,
    still: `${FILM} Night, the end of a pastel suburban street: a huge orange fireball at the moment of a meteor strike ` +
      'between a small laundromat and a small paper school, debris and shingles flying, a shock wave of dust rolling out ' +
      `along the street, the round water tower in black silhouette against the fire. Seen from down the street. ${MIDDLE} ${NOTHING}`,
    clip: 'The explosion blooms outward: the fireball grows and rolls upward into a mushroom of fire and smoke, debris ' +
      'flies, the shock wave rolls toward the camera, the camera shakes. The water tower stays standing in silhouette.' },
  { id: 'watch', use: 4.5,
    still: `${FILM} Night, a smoky pastel suburban street: three civil-defence volunteers, ${PEOPLE.replace('most of them are women', 'women')}, ` +
      'wearing white round civil-defence helmets with a plain gold band, armbands and coveralls, carrying flashlights, ' +
      'walk away from the camera toward a pulsing red glow deep in drifting smoke, their flashlight beams cutting the ' +
      `smoke. ${MIDDLE} ${NOTHING}`,
    clip: 'The three insect volunteers walk slowly away from the camera into the smoke toward the red glow, their ' +
      'flashlight beams swinging through the smoke; the glow pulses. The camera holds, drifting slightly.' },
  { id: 'crater', use: 4.5,
    still: `${FILM} Night, a smoking crater broken into a pastel suburban street, a bent street lamp and a split picket ` +
      `fence at its edge: in it ${METEOR.replace('trailing fire, black smoke and loose red tendrils', 'split open along one side, glowing hot orange from inside, still smoking')}; ` +
      `two flashlight beams from off screen fall on it. ${MIDDLE} ${NOTHING}`,
    clip: 'The glow inside the split pod pulses slowly like a heartbeat, smoke drifts across the beams of the ' +
      'flashlights, and a single wet red tendril twitches and slides out over the broken pavement. The camera creeps closer.' },
  { id: 'beam', use: 4.0,
    still: `${FILM} Night, close on the broken pavement at the edge of a crater, in drifting smoke: a dropped silver ` +
      'flashlight lies on the pavement, its beam shining into the smoke, and in the beam a wet glistening dark red ' +
      `tendril, as thick as an arm, rises out of the smoke like a snake. Only smoke and darkness behind it: ${EMPTY} ${MIDDLE} ${NOTHING}`,
    clip: 'The wet red tendril rises higher in the flashlight beam, sways, then lunges fast at the light; the flashlight ' +
      'is knocked spinning across the pavement, its beam whirling through the smoke. The camera holds.' },
  { id: 'flee', use: 4.0,
    still: `${FILM} Night, a pastel suburban street lit red: ${PEOPLE} run toward the camera in panic, in dressing gowns ` +
      'and hats, one carrying a small child; behind them a dark red veined living skin, wet like flesh, spreads over the ' +
      `lawns, the picket fences and the parked beetle-shaped cars. ${MIDDLE} ${NOTHING}`,
    clip: 'The insect people run toward and past the camera in panic, screaming; behind them the dark red veined living ' +
      'skin flows further over the lawns and fences and climbs a car. The camera backs away in front of them.' },
  { id: 'siren', use: 3.5,
    still: `${FILM} Night, a civil-defence siren (a round horn of louvred metal on top of a tall wooden pole) at a ` +
      'pastel suburban street corner, seen from below against the red-lit smoky sky; the house fronts behind it are ' +
      `half covered by a dark red veined living skin, wet like flesh, creeping up the walls and the pole. The street is deserted. ${EMPTY} ${MIDDLE} ${NOTHING}`,
    clip: 'The siren wails, its horn vibrating; the dark red veined living skin creeps up the pole and over the house ' +
      'walls, pulsing; smoke drifts past red light. The camera slowly tilts up the pole.' },
  { id: 'stir', use: 5.0,
    still: `${FILM} Night, a crater in a burning pastel suburb: out of it the living pod has swollen into a great ` +
      'pulsing heart of wet dark red flesh and ivory bone, taller than the houses, glowing orange from inside through ' +
      'its cracks, thick red tendrils unfurling from it over the street, smoke and embers rising; the red veined living ' +
      `skin covers the street around it. Seen from low in the street. The street is deserted. ${EMPTY} ${MIDDLE} ${NOTHING}`,
    clip: 'The huge living heart heaves and swells, its glow pulsing brighter, tendrils unfurling and lifting, embers ' +
      'and smoke rising past it; it is waking up. The camera slowly pushes in and tilts up.' },
];

/** The narrator (the trailer voice, the same as the opening's newsreel man) and the townsfolk. */
const NARRATOR = (line) => 'A black-and-white 1950s movie-trailer recording booth: close-up of a vintage ribbon microphone. An offscreen ' +
  `male trailer announcer with a booming, dramatic, stentorian mid-Atlantic accent says exactly: "${line}" Only his voice, no music.`;
export const LINES = [
  { id: 'n1', line: 'Luckwell Gardens. A quiet little town, on a quiet summer night.', seconds: 6 },
  { id: 'n2', line: 'Where the porch lights glow, the neighbours wave, and nothing, EVER happens.', seconds: 6 },
  { id: 'n3', line: 'Until something came down, out of the SKY!', seconds: 4 },
  { id: 'n4', line: 'The Civil Watch went out to take a look.', seconds: 4 },
  { id: 'n5', line: 'They never came back!', seconds: 4 },
  { id: 'n6', line: 'Now it is in the streets! It is in the gardens!', seconds: 4 },
  { id: 'n7', line: 'And it is ALIVE!', seconds: 4 },
];
const SCENE = (what) => `A 1950s monster film sound effect, recorded for a movie: ${what} Only this sound, no music, no speech.`;
export const SOUNDS = [
  { id: 'plate', seconds: 4, prompt: SCENE('a kitchen at night: plates rattle in a rack, a china plate falls and smashes on a tiled floor, and a woman gasps.') },
  { id: 'scream', seconds: 4, prompt: SCENE('a crowd in a street at night gasps, and one woman lets out a long piercing 1950s B-movie scream.') },
  { id: 'crowd', seconds: 6, prompt: SCENE('a panicked crowd running down a street at night, many women screaming and shouting, footsteps, a distant civil-defence siren starting to wail.') },
  { id: 'siren', seconds: 6, prompt: SCENE('an old mechanical civil-defence air-raid siren wailing up and down at night, close, with a low ominous rumble under it.') },
  { id: 'cutoff', seconds: 4, prompt: SCENE('a woman screams in terror and the scream is cut off suddenly, then a metal flashlight clatters and rolls on pavement.') },
];
/** The score, timed to the cut (seconds from the start of the film). */
const SCORE = { id: 'bmovie', seconds: 69, spec: {
  title: 'The Thing From the Sky', form: 'instrumental', targetSeconds: 69, language: 'en',
  style: { instrumental: true, genres: ['1950s b-movie score', 'monster movie trailer'], moods: ['quiet', 'ominous', 'rising', 'lurid', 'frantic'], tempo: 'mid',
    instruments: ['theremin', 'strings', 'brass', 'timpani', 'harp', 'celesta', 'xylophone'],
    freeform: 'The score of a 1950s monster picture trailer, 69 seconds, instrumental. 0-14 s: a quiet summer night in a pretty little suburb, gentle celesta, harp and soft strings, sweet and innocent with a tiny hint of unease. ' +
      '14-26 s: a theremin wail rises, strings tremolo, dread builds. 26-34 s: brass stabs as something tears through the sky, then one huge timpani and brass hit at 34 s for a meteor strike. ' +
      '34-47 s: low creeping brass and plucked basses, suspense, something in the smoke. 47-58 s: frantic brass and strings, panic in the streets. ' +
      '58-64 s: the monster is alive, a massive swelling brass chord with a theremin on top. 64-69 s: the title card, one huge held brass chord ringing out.' } } };

// ------------------------------------------------------------------ making

const W = 1536, H = 1024;
const refs = () => [path.join(CONCEPTS, 'r2-film-still.png'), path.join(CONCEPTS, 'r2-castes-human.png'), raw('refs/suburb-2.6.png')].filter((f) => fs.existsSync(f));

async function stills(ids) {
  const res = await pool(SHOTS.filter((s) => want(ids, s.id)), 4, (s) => makeStill({ slug: `bmovie ${s.id}`, out: raw(`${s.id}.png`),
    prompt: s.still, key: null, width: W, height: H, quality: 'high', refFiles: refs() }));
  res.forEach((r) => { if (!r.ok) console.warn(`[bmovie] still failed: ${r.error.message.slice(0, 300)}`); });
}

export const MOTION_MODEL = process.env.BMOVIE_MODEL || 'atlascloud:seedance-2.5-i2v';
async function clips(ids) {
  const jobs = SHOTS.filter((s) => want(ids, s.id) && fs.existsSync(raw(`${s.id}.png`)))
    .map((s) => ({ slug: `bmovie-${s.id}`, stillFile: raw(`${s.id}.png`), prompt: `${s.clip} ${CLIP_TAIL}`, out: raw(`${s.id}-clip.mp4`) }));
  const res = await pool(jobs, 4, (j) => makeClip({ ...j, models: [MOTION_MODEL], loop: false, raw: true, seconds: 5, resolution: '720p', aspect: '16:9' }));
  res.forEach((r, i) => { if (!r.ok) console.warn(`[bmovie] ${jobs[i].slug} failed: ${r.error.message.slice(0, 300)}`); });
}

async function audio(ids) {
  fs.mkdirSync(AUD, { recursive: true });
  const jobs = [
    ...LINES.filter((l) => want(ids, l.id)).map((l) => () => soundTake({ id: `bmovie-${l.id}`, prompt: NARRATOR(l.line), model: process.env.VOICE_MODEL || 'imagerouter:veo-3.1-lite-t2v', seconds: l.seconds })),
    ...SOUNDS.filter((s) => want(ids, s.id)).map((s) => () => soundTake({ id: `bmovie-${s.id}`, prompt: s.prompt, model: process.env.SFX_MODEL || 'atlascloud:h3-t2v', seconds: s.seconds })),
  ];
  if (want(ids, 'score')) jobs.push(() => songTakes({ id: 'bmovie-score', spec: SCORE.spec, model: process.env.MUSIC_MODEL || 'elevenlabs:music_v2' }));
  const res = await pool(jobs, 3, (j) => j());
  res.forEach((r) => { if (!r.ok) console.warn(`[bmovie] audio failed: ${r.error.message.slice(0, 300)}`); });
  // The audio tools save under art-src/audio: the takes are kept with the film's other raw files.
  if (fs.existsSync(AUDIO_RAW)) for (const f of fs.readdirSync(AUDIO_RAW)) if (f.startsWith('bmovie-')) fs.copyFileSync(path.join(AUDIO_RAW, f), path.join(AUD, f));
}

// ------------------------------------------------------------------ the bake

const FPS = 24;
const FW = 960, FH = 720;
/**
 * The 1950s print: faded Technicolor (lifted blacks, a warm cast, saturation eased back), grain, a breathing
 * exposure (flicker), gate weave (a slow random wander of the frame), a soft vignette. The dust and scratches are
 * drawn on top in the same pass (random thin vertical lines and specks).
 */
export const GRADE = {
  colour: 'eq=contrast=1.08:saturation=0.82:gamma=1.02,colorbalance=rs=0.05:gs=0.01:bs=-0.06:rm=0.03:bm=-0.04,curves=master=0/0.06 0.5/0.52 1/0.95',
  bw: 'hue=s=0,eq=contrast=1.22:gamma=0.98,curves=master=0/0.04 0.5/0.5 1/0.97',
};
const PRINT = (grade) => `${grade},noise=alls=14:allf=t+u,` +
  // flicker: the exposure breathes a little, frame to frame
  `eq=brightness='0.018*sin(2*PI*t*7.3)+0.012*sin(2*PI*t*2.1)':eval=frame,` +
  // gate weave: pad, then crop at a slowly wandering offset
  `pad=iw+12:ih+12:6:6:black,crop=${FW}:${FH}:'6+3*sin(2*PI*t*0.7)+1.5*sin(2*PI*t*3.1)':'6+2.5*sin(2*PI*t*0.53)+1.5*sin(2*PI*t*2.7)',` +
  'vignette=PI/4.6';

function dur(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
  return Number(r.stdout.trim()) || 0;
}

/** Scratches and dust: a transparent overlay of random thin lines and specks (seeded, so a re-bake is the same). */
function scratches(seconds, out) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const draws = [];
  for (let f = 0; f < seconds * FPS; f++) {
    const t0 = (f / FPS).toFixed(3), t1 = ((f + 1) / FPS).toFixed(3);
    if (rnd() < 0.35) { const x = Math.floor(rnd() * FW); draws.push(`drawbox=x=${x}:y=0:w=1:h=${FH}:color=white@${(0.12 + rnd() * 0.2).toFixed(2)}:t=fill:enable='between(t,${t0},${t1})'`); }
    if (rnd() < 0.5) { const x = Math.floor(rnd() * FW), y = Math.floor(rnd() * FH), s = 2 + Math.floor(rnd() * 4); draws.push(`drawbox=x=${x}:y=${y}:w=${s}:h=${s}:color=${rnd() < 0.5 ? 'black' : 'white'}@0.55:t=fill:enable='between(t,${t0},${t1})'`); }
  }
  const script = path.join(DIR, 'tmp', 'scratches.txt');
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, `color=c=black@0.0:s=${FW}x${FH}:r=${FPS}:d=${seconds},format=rgba,${draws.join(',')}[out]`);
  ffmpeg(['-filter_complex_script', script, '-map', '[out]', '-c:v', 'qtrle', '-t', String(seconds), out], 'scratches');
}

/** When each shot starts in the film (seconds), from SHOTS' `use`. */
export function timeline() {
  let t = 0;
  const at = {};
  for (const s of SHOTS) { at[s.id] = +t.toFixed(3); t += s.use; }
  return { at, end: +t.toFixed(3) };
}
/** The end card over black (set by the game). */
export const CARD_SECONDS = 5;

/** Where each line and sound sits (seconds into the film), and how loud (dB). */
function cues(at) {
  return [
    { f: 'n1', t: at.town + 0.6, db: 0 }, { f: 'n2', t: at.porch + 1.0, db: 0 }, { f: 'n3', t: at.lookup + 1.2, db: 0 },
    { f: 'n4', t: at.watch + 0.3, db: 0 }, { f: 'n5', t: at.beam + 2.0, db: 0 }, { f: 'n6', t: at.flee + 0.4, db: 0 },
    { f: 'n7', t: at.stir + 1.2, db: 0 },
    { f: 'plate', t: at.kitchen + 1.6, db: -4 }, { f: 'scream', t: at.lookup + 0.2, db: -3 }, { f: 'cutoff', t: at.beam + 0.6, db: -4 },
    { f: 'crowd', t: at.flee - 0.2, db: -6 }, { f: 'siren', t: at.siren - 0.6, db: -8 },
  ];
}
/** The game's own landing sounds, reused for the fall and the strike. */
const ROAR = path.join(ROOT, 'public', 'audio', 'land-roar.ogg');
const IMPACT = path.join(ROOT, 'public', 'audio', 'land-impact.ogg');

/** The sounding part of a take: the soundtrack of a video take (voice/sfx) or a song file. */
function takeAudio(id) {
  for (const f of [path.join(AUD, `bmovie-${id}.mp4`), path.join(AUDIO_RAW, `bmovie-${id}.mp4`)]) if (fs.existsSync(f)) return f;
  return null;
}

function bake() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(REV, { recursive: true });
  const tmp = path.join(DIR, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const grade = process.env.BMOVIE_GRADE === 'bw' ? GRADE.bw : GRADE.colour;
  const { at, end } = timeline();
  const total = +(end + CARD_SECONDS).toFixed(3);
  // 1. Each shot: its best `use` seconds (from 0.15 s in: the first frame is the still itself), cut to 4:3.
  const parts = [];
  for (const s of SHOTS) {
    const clip = raw(`${s.id}-clip.mp4`);
    const out = path.join(tmp, `${s.id}.mp4`);
    if (!fs.existsSync(clip)) throw new Error(`${s.id}: no clip`);
    const from = s.from ?? 0.15;
    const speed = s.speed ?? Math.min(1, (dur(clip) - from) / s.use);
    ffmpeg(['-ss', String(from), '-i', clip, '-vf', `setpts=PTS/${speed.toFixed(4)},scale=-2:${FH},crop=${FW}:${FH},fps=${FPS}`, '-t', String(s.use),
      '-an', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', out], `cut ${s.id}`);
    parts.push(out);
  }
  // 2. The end card's black, then everything joined.
  const black = path.join(tmp, 'black.mp4');
  ffmpeg(['-f', 'lavfi', '-i', `color=c=black:s=${FW}x${FH}:r=${FPS}:d=${CARD_SECONDS}`, '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', black], 'black');
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, [...parts, black].map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const joined = path.join(tmp, 'joined.mp4');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], 'join');
  // 3. The print: grade, grain, flicker, weave, vignette, then the scratches on top (not over the end card).
  const scr = path.join(tmp, 'scratches.mov');
  if (!fs.existsSync(scr)) scratches(Math.ceil(end), scr);
  const graded = path.join(tmp, 'graded.mp4');
  ffmpeg(['-i', joined, '-i', scr, '-filter_complex', `[0:v]${PRINT(grade)}[g];[g][1:v]overlay=enable='lt(t,${end})':eof_action=pass,format=yuv420p[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', graded], 'grade');
  // 4. The mix: the score under everything, ducked under the narrator; the lines and sounds at their times; the roar and the strike.
  const inputs = [];
  const chains = [];
  const add = (file, t, db, extra = '') => {
    const k = inputs.length / 2; // input 0 is the score
    inputs.push('-i', file);
    chains.push(`[${k + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,${extra}volume=${db}dB,adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)}[a${k}]`);
  };
  const score = [path.join(AUD, 'bmovie-score-take0.mp3'), path.join(AUDIO_RAW, 'bmovie-score-take0.mp3')].find((f) => fs.existsSync(f));
  // A take starts on its sound (the models leave a beat of air before it); the narrator through a 1950s booth.
const lead = 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,';
  const voiceTo = lead + 'highpass=f=90,lowpass=f=7000,acompressor=threshold=-18dB:ratio=3,';
  for (const c of cues(at)) {
    const f = takeAudio(c.f);
    if (!f) { console.warn(`[bmovie] no take for ${c.f}`); continue; }
    add(f, c.t, c.db, c.f.startsWith('n') ? voiceTo : lead + 'highpass=f=60,lowpass=f=9000,');
  }
  if (fs.existsSync(ROAR)) add(ROAR, at.fall + 0.2, -2);
  if (fs.existsSync(IMPACT)) add(IMPACT, at.impact + 0.1, 0);
  const n = chains.length;
  const narr = cues(at).filter((c) => c.f.startsWith('n') && takeAudio(c.f));
  // The score dips 7 dB under each narrator line (a volume envelope over the narrator's windows).
  const dips = narr.map((c) => `between(t,${(c.t - 0.2).toFixed(2)},${(c.t + Math.max(2, dur(takeAudio(c.f)) - 0.6)).toFixed(2)})`).join('+') || '0';
  const scoreChain = score
    ? `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${total},volume='if(${dips},0.42,0.95)':eval=frame,afade=t=out:st=${total - 1.5}:d=1.5[sc];`
    : `anullsrc=r=48000:cl=stereo,atrim=0:${total}[sc];`;
  const mixed = path.join(tmp, 'mix.wav');
  const fc = `${scoreChain}${chains.join(';')};[sc]${Array.from({ length: n }, (_, i) => `[a${i}]`).join('')}amix=inputs=${n + 1}:normalize=0:duration=first,` +
    `highpass=f=40,lowpass=f=11000,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  ffmpeg([...(score ? ['-i', score] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']), ...inputs, '-filter_complex', fc, '-map', '[out]', '-t', String(total), mixed], 'mix');
  // 5. The film: picture + mix.
  const film = path.join(OUT, 'bmovie.mp4');
  ffmpeg(['-i', graded, '-i', mixed, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', String(total), film], 'film');
  ffmpeg(['-ss', String(at.lookup + 2), '-i', film, '-frames:v', '1', '-vf', 'scale=720:-2', '-c:v', 'libwebp', '-quality', '80', path.join(OUT, 'bmovie.webp')], 'poster');
  const meta = { video: 'intro/bmovie.mp4', poster: 'intro/bmovie.webp', seconds: total, cardAt: end, shots: at, titles: TITLES(at, end),
    ...(fs.existsSync(path.join(OUT, 'reveal.mp4')) ? { reveal: { video: 'intro/reveal.mp4', poster: 'intro/reveal.webp' } } : {}) };
  fs.writeFileSync(path.join(OUT, 'bmovie.json'), JSON.stringify(meta, null, 1));
  sheet(film, at);
  console.log(`[bmovie] baked ${film}: ${total}s, ${(fs.statSync(film).size / 1048576).toFixed(1)} MB`);
}

/** The titles the game sets over the film (src/ui/intro.ts), on the film's clock. */
export const TITLES = (at, end) => [
  { text: 'NOTHING EVER HAPPENED', small: 'in Luckwell Gardens', from: at.laundry + 0.6, to: at.star + 0.4 },
  { text: 'UNTIL TONIGHT!', from: at.fall + 0.3, to: at.duck + 1.2 },
  { text: 'WHAT FELL', small: 'between the school and the laundromat?', from: at.watch + 0.8, to: at.crater + 2.6 },
  { text: 'NO STREET WAS SAFE!', from: at.flee + 1.0, to: at.siren + 2.8 },
  { text: 'IT WAS ALIVE!', from: at.stir + 2.4, to: end - 0.1 },
];

/** The contact sheet: three frames of every shot, in film order, one row a shot. */
function sheet(film, at) {
  const tmp = path.join(DIR, 'tmp', 'sheet');
  fs.mkdirSync(tmp, { recursive: true });
  const rows = [];
  for (const s of SHOTS) {
    const frames = [0.2, 0.5, 0.85].map((k, i) => {
      const f = path.join(tmp, `${s.id}-${i}.png`);
      ffmpeg(['-ss', (at[s.id] + s.use * k).toFixed(2), '-i', film, '-frames:v', '1', '-vf', 'scale=320:240', f], `sheet ${s.id}`);
      return f;
    });
    const row = path.join(tmp, `${s.id}-row.png`);
    ffmpeg([...frames.flatMap((f) => ['-i', f]), '-filter_complex', `hstack=inputs=3,drawtext=text='${s.id}':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6`, row], `row ${s.id}`);
    rows.push(row);
  }
  // Two columns of rows.
  const half = Math.ceil(rows.length / 2);
  const colA = path.join(tmp, 'a.png'), colB = path.join(tmp, 'b.png');
  const vstack = (list, out) => {
    const pad = [...list];
    if (pad.length < half) { const blank = path.join(tmp, 'blank.png'); ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=960x240', '-frames:v', '1', blank], 'blank'); while (pad.length < half) pad.push(blank); }
    ffmpeg([...pad.flatMap((f) => ['-i', f]), '-filter_complex', `vstack=inputs=${pad.length}`, out], 'vstack');
  };
  vstack(rows.slice(0, half), colA);
  vstack(rows.slice(half), colB);
  ffmpeg(['-i', colA, '-i', colB, '-filter_complex', 'hstack=inputs=2', '-q:v', '3', path.join(REV, 'bmovie-sheet.jpg')], 'sheet');
  console.log(`[bmovie] sheet ${path.join(REV, 'bmovie-sheet.jpg')}`);
}

/** The colour-or-black-and-white probe: one still graded both ways, side by side. */
function probe() {
  fs.mkdirSync(REV, { recursive: true });
  const src = raw('lookup.png');
  if (!fs.existsSync(src)) throw new Error('probe: draw the lookup still first');
  const one = (g, out) => ffmpeg(['-i', src, '-vf', `scale=-2:${FH},crop=${FW}:${FH},${g},vignette=PI/4.6`, '-frames:v', '1', out], 'probe');
  const a = path.join(DIR, 'tmp', 'probe-c.png'), b = path.join(DIR, 'tmp', 'probe-b.png');
  fs.mkdirSync(path.dirname(a), { recursive: true });
  one(GRADE.colour, a);
  one(GRADE.bw, b);
  ffmpeg(['-i', a, '-i', b, '-filter_complex', 'hstack=inputs=2,scale=1440:-2', '-q:v', '3', path.join(REV, 'probe-colour-vs-bw.jpg')], 'probe sheet');
  console.log(`[bmovie] probe ${path.join(REV, 'probe-colour-vs-bw.jpg')}`);
}

/**
 * The reveal after mission 1: the landing films' shared release shot (the ship fires the asset out of its bay),
 * cut from the Suburbs' baked landing film (up to the dissolve into the fall, at its fallAt), played at 0.6x, with a fade from black. 1280x720, no sound.
 */
function reveal() {
  const src = path.join(ART, 'landing', 'suburb.mp4');
  const out = path.join(OUT, 'reveal.mp4');
  ffmpeg(['-ss', '0.05', '-t', '1.55', '-i', src, '-vf', 'setpts=PTS/0.6,fps=24,fade=t=in:st=0:d=0.6', '-an', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], 'reveal');
  ffmpeg(['-ss', '1.0', '-i', out, '-frames:v', '1', '-vf', 'scale=960:-2', '-c:v', 'libwebp', '-quality', '80', path.join(OUT, 'reveal.webp')], 'reveal poster');
  console.log(`[bmovie] reveal ${out}: ${dur(out)}s`);
}

// ------------------------------------------------------------------ main

const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const want = (list, id) => !list.length || list.includes(id);
const has = (f) => args.includes(f);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  const paid = has('--stills') || has('--clips') || has('--audio');
  let before = 0;
  if (paid) { ready(); before = await balance(); console.log(`[bmovie] balance ${before}`); }
  if (has('--stills')) await stills(ids);
  if (has('--probe')) probe();
  if (has('--clips')) await clips(ids);
  if (has('--audio')) await audio(ids);
  if (has('--bake')) bake();
  if (has('--reveal')) reveal();
  if (paid) { const after = await balance(); console.log(`[bmovie] spent ${before - after} tokens ($${((before - after) / 50000).toFixed(2)}); asked: ${JSON.stringify(spent)}`); }
}
