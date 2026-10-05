/**
 * THE CUT SCENES, MADE AND BAKED AS FILMS (Oct 3 2026; content/cutscenes.ts has the shot lists, content/campaign.ts the words).
 *
 *   npx vite-node tools/media/cutscenes.ts -- list                 every film: shots, pictures, what is made, what it would cost
 *   npx vite-node tools/media/cutscenes.ts -- stills <film>        the pictures its shots start from (LOOK: notes/art-review/cutscenes/<film>/)
 *   npx vite-node tools/media/cutscenes.ts -- clips <film> [shots] one clip per shot, IN ORDER, image-to-video WITH SOUND (the speaker says the line);
 *                                                                  each clip is heard, cut just after its last word, and the frame at the cut starts the next
 *   npx vite-node tools/media/cutscenes.ts -- redo <film> <shot>   move that clip AND every clip that went on from it aside (v1/, v2/ ...), to be made again
 *   npx vite-node tools/media/cutscenes.ts -- check <film>         every clip transcribed against its line; each speaker's pitch across the film
 *   npx vite-node tools/media/cutscenes.ts -- bake <film>          public/media/scenes/<film>.mp4 + poster + cues in scenes.json (free)
 *   npx vite-node tools/media/cutscenes.ts -- sheet <film>         every shot as three frames, to look at (free)
 *   npx vite-node tools/media/cutscenes.ts -- desk <film> [words]  the baked film to the Desktop with its sheet; `words`: also a copy with the words burned in (free)
 *
 * SPENDS RFab tokens (RFAB_API_KEY): a still about $0.12 (medium; CUTSCENE_STILL_QUALITY=high for $0.45), a spoken clip on
 * Veo 3.1 Lite image-to-video about $0.3-0.6. Every step skips a file already on disk: to make one again, MOVE its raw
 * file into v1/ beside it (never delete), or `redo <film> <shot>` does that for a clip.
 *
 * Raw files: art-src-new/cutscenes/ (git-ignored). The bake writes only public/media/scenes/ (its own manifest, scenes.json:
 * it never touches media.json or roach.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { makeClip, makeStill, pool, uploadVideo } from '../art/rfab.mjs';
import { ROOT, api, assertSpeakable, balance, duration, ff, ffStderr, speechSpan } from './lib.mjs';
import { CLEAN, CONCEPTS, CROWD, LEADER_REF, WHO } from './prompts.mjs';
import { FILMS, STILLS, type Film, type FilmLook, type FilmShot } from '../../content/cutscenes';
import { FACTIONS, type FactionId, type Scene } from '../../content/campaign';
import { ROACH_SCENES } from '../../content/roachKing';
import { SUBJECT, VOICES } from '../../content/cast';
import { scenesOf, speakerOf, spokenText } from '../../content/media';

const RAW = path.join(ROOT, 'art-src-new', 'cutscenes');
const OUT = path.join(ROOT, 'public', 'media', 'scenes');
const REVIEW = path.join(ROOT, 'notes', 'art-review', 'cutscenes');
const VIDEO_MODEL = process.env.CUTSCENE_VIDEO_MODEL || 'imagerouter:veo-3.1-lite-i2v';
const STILL_QUALITY = process.env.CUTSCENE_STILL_QUALITY || 'medium';
// He is seen from behind (Collins, Oct 4 2026; the style bible's rule 9): the approved concept of him from behind is his reference.
const HERO = path.join(CONCEPTS, 'hero-behind-desk.png');
/** The clips' frame rate (Veo 3.1: 24), and how long after a line's last word its clip is cut (the next clip starts on that frame). */
const FPS = 24;
const CUT_AFTER = 0.55;
const W = 1536, H = 864;

const argv = process.argv.slice(2).filter((a) => a !== '--');
const step = argv[0] ?? 'list';
const filmId = argv[1];
const only = argv.slice(2);
const want = (id: string) => !only.length || only.includes(id);

// ------------------------------------------------------------------ the scene of a film, and its lines
export function sceneOf(film: Film): Scene {
  for (const f of FACTIONS) for (const s of scenesOf(f)) if (s.film === film.id) return s;
  // The Roach King off the air (content/roachKing.ts).
  const rk = ROACH_SCENES.find((x) => x.scene.film === film.id);
  if (rk) return rk.scene;
  throw new Error(`no scene of content/campaign.ts or content/roachKing.ts names the film ${film.id}`);
}
const lineOf = (film: Film, s: FilmShot): string => (s.line === undefined ? '' : sceneOf(film).lines[s.line] ?? '');
const wordsOf = (film: Film, s: FilmShot): string => spokenText(lineOf(film, s));
const whoOf = (film: Film, s: FilmShot): string => speakerOf(lineOf(film, s));
const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;
/** A clip is 4, 6 or 8 seconds: by its words (about 2.7 a second, with room to act). */
export const secsFor = (words: string): 4 | 6 | 8 => (wordCount(words) <= 5 ? 4 : wordCount(words) <= 12 ? 6 : 8);

// ------------------------------------------------------------------ the words of every picture
const SHIP = 'a small, dark, exact starship in orbit: matte black bulkheads in big flat panels, thin white light strips recessed along the base of the walls, ribbed dark metal deck plating, cool white light and deep shadow, everything spare, clean and precise';
const LOOKS: Record<FilmLook, string> = {
  colony: 'A film still from a 1950s colour science-fiction film, in a wide 16:9 frame: saturated Technicolor, theatrical light with deep shadows, a studio set, film grain, the softness of old lenses.',
  archive: 'A film still from a 1950s colour science-fiction film, a dream sequence, in a wide 16:9 frame: saturated Technicolor, radiant soft golden light, painted backdrops, film grain, the softness of old lenses.',
  ship: `Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set, natural film grain, in a wide 16:9 frame. Aboard ${SHIP}.`,
  call: `Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set, natural film grain, in a wide 16:9 frame. Aboard ${SHIP}.`,
};
const ORD = ['first', 'second', 'third', 'fourth'];
/** Him, as he is seen from behind (the approved concept: notes/concepts/2026-09-29/hero-behind-desk.png). */
const BACK = 'short dark messy hair, a pale stylus tucked behind his right ear, a plain black high-collared tunic with a narrow white collar showing at the neck, its sleeves pushed up to the elbows';
/** No lettering; no real religious symbol (the Faith has its own: hexagons, gold balls, lamps). */
const CLEAN_FAITH = CLEAN.replace(/There is no religious[^.]*\./, 'There is no real religious or political symbol of any kind: no cross, no plus-shaped sign, no star shape, no crescent; the only symbols are plain hexagons, plain gold balls and oil lamps.');
const NO_TEXT = 'No text, no lettering, no numbers, no logos, no emblems, no symbols, no icons anywhere in the picture.';

const filmFactionOfStill = (id: string) => FILMS.find((f) => f.shots.some((s) => s.from === id) && STILLS[id].refs.includes('leader'))?.faction ?? FILMS.find((f) => f.shots.some((s) => s.from === id))?.faction ?? null;
/** The faction whose leader a picture shows (none for the Roach King's own pictures). */
const factionOfStill = (id: string): FactionId | null => { const f = filmFactionOfStill(id); return f === 'roach' ? null : f; };
/** The Roach King, as his addresses show him (tools/media/roachking.ts HIM): his reference is the close picture of him. */
const KING = (ord: string) =>
  `the President of the ${ord} reference picture, copied exactly: a huge, broad-shouldered, barrel-chested cockroach-man with human posture, two legs and exactly four thick arms, `
  + 'a glossy chestnut-brown cockroach head with a wide shiny shield over the top of it like a helmet brim, two very long whip-like antennae, large amber eyes and small mandibles like a mouth, '
  + 'in an open dark green military dress coat heavy with gold braid and gold epaulettes over a white undershirt, an enormous gold championship belt round his middle';
const KING_REF = path.join(ROOT, 'art-src-new', 'roach', 'stills', 'close.png');
const FLAG_REF = path.join(ROOT, 'art-src-new', 'roach', 'flag', 'flag.png');

function stillPrompt(id: string): string {
  const st = STILLS[id];
  const fac = factionOfStill(id);
  const ord = (r: string) => ORD[st.refs.indexOf(r)] ?? 'first';
  let shows = st.shows;
  const holo = shows.includes('HOLO');
  const him = `the young man of the ${ord('hero')} reference picture (seen from behind as he is there, so that only the back of his head is seen and never his face: ${BACK}; his hands empty)`;
  if (fac) shows = shows.replace(/WHO/g, WHO[fac].replace('the reference picture', `the ${ord('leader')} reference picture`));
  shows = shows.replace(/KING/g, KING(ord('king')));
  shows = shows.replace(/HOLO/g, `a life-size hologram of ${him}, made of pale blue-white light, translucent so that the room shows faintly through him, with fine horizontal scan lines and a soft glow at his edges`);
  shows = shows.replace(/TECH/g, him);
  const never = 'The young man faces away from the camera: his face is not seen anywhere in the picture.';
  if (st.look === 'ship') return `${LOOKS.ship} ${shows} He is alone: nobody else is in the picture. ${never} ${NO_TEXT}`;
  if (st.look === 'call') return `${LOOKS.call} ${shows} Every person on the screen is one of the ${CROWD}. Each has exactly four arms and two legs, never more. The young man is the only human being in the picture. ${never} ${fac === 'faithful' ? CLEAN_FAITH : CLEAN}`;
  const cast = holo
    ? `Every other person in the picture is one of the ${CROWD}. Each has exactly four arms and two legs, never more. The hologram is the only human being in the picture. ${never}`
    : `Every person in the picture is one of the ${CROWD}. Each has exactly four arms and two legs, never more. There are no human beings anywhere.`;
  return `${LOOKS[st.look]} ${shows} ${cast} ${fac === 'faithful' ? CLEAN_FAITH : CLEAN}`;
}

// ------------------------------------------------------------------ files
const dirOf = (film: string) => path.join(RAW, film);
const stillFile = (id: string) => path.join(RAW, 'stills', `${id}.png`);
const clipFile = (film: string, shot: string) => path.join(dirOf(film), `${shot}.mp4`);
function png(file: string): string {
  if (file.endsWith('.png')) return file;
  const out = path.join(RAW, 'refs', path.basename(file).replace(/\.\w+$/, '.png'));
  if (!fs.existsSync(out)) { fs.mkdirSync(path.dirname(out), { recursive: true }); ff(['-i', file, out], 'ref png'); }
  return out;
}
const refFile = (r: string, fac: FactionId | null) => (r === 'hero' ? HERO : r === 'king' ? KING_REF : r === 'flag' ? FLAG_REF : r === 'leader' ? png(LEADER_REF(fac ?? 'delegation')) : stillFile(r));
/** The stills a film needs, each after the stills it is drawn to match. */
function stillsOf(film: Film): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (out.includes(id) || !STILLS[id]) return;
    for (const r of STILLS[id].refs) add(r);
    out.push(id);
  };
  for (const s of film.shots) if (s.from !== '^') add(s.from);
  return out;
}
/** A still exactly 16:9 (cut from its middle when the model answered in another shape). */
function still169(id: string): string {
  const src = stillFile(id);
  const out = path.join(RAW, 'stills', `${id}-169.png`);
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) return out;
  ff(['-i', src, '-vf', 'crop=w=min(iw\\,ih*16/9):h=min(ih\\,iw*9/16),scale=1280:720', out], `${id} 16:9`);
  return out;
}

async function stills(film: Film) {
  fs.mkdirSync(path.join(RAW, 'stills'), { recursive: true });
  for (const id of stillsOf(film)) {
    if (!want(id)) continue;
    const fac = factionOfStill(id);
    const refs = STILLS[id].refs.map((r) => refFile(r, fac));
    const missing = refs.filter((f) => !fs.existsSync(f));
    if (missing.length) { console.warn(`[cut] still ${id}: reference missing (${missing.map((m) => path.basename(m)).join(', ')}); skipped`); continue; }
    try {
      await makeStill({ slug: `cut ${id}`, out: stillFile(id), key: null, quality: STILL_QUALITY, width: W, height: H, prompt: stillPrompt(id), refFiles: refs.length ? refs : undefined });
    } catch (e) { console.warn(`[cut] still ${id} failed: ${(e as Error).message.slice(0, 300)}`); }
  }
  review(film);
}

function review(film: Film) {
  const dir = path.join(REVIEW, film.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const id of stillsOf(film)) {
    if (!fs.existsSync(stillFile(id))) continue;
    ff(['-i', still169(id), '-vf', 'scale=1024:-2', '-q:v', '3', path.join(dir, `still-${id}.jpg`)], `review ${id}`);
  }
}

// ------------------------------------------------------------------ the words of every clip
/** He is seen from behind, always (Collins, Oct 4 2026). */
const BEHIND = 'The young man keeps his back square to the camera in every frame: only the back of his head and shoulders are seen, never his face, not even in profile; he never turns round or sideways.';
/** A hologram stays clean: a sparkle the model adds is handed down the take with the frame and multiplies into snow (the second take, Oct 4 2026). */
const HOLO_CLEAN = 'The air in the room is perfectly clear and still, and the picture stays clean and sharp, exactly as in the first frame; the hologram\'s light is even and steady.';
function tail(look: FilmLook, holo: boolean, him: boolean): string {
  const cam = 'One continuous shot, no cuts; the camera does not move at all.';
  if (look === 'ship') return `${cam} He is alone. ${BEHIND} He keeps the same dark messy hair and the same black tunic in every frame; nothing morphs. No text appears on screen. No music, no subtitles.`;
  if (look === 'call') return `${cam} ${BEHIND} The screen stays where it is, and the insect people on it keep their insect heads, exactly four arms and the same clothes in every frame; nothing morphs or duplicates. No text appears on screen. No music, no subtitles.`;
  return `${cam} It keeps the same film look throughout. The room stays exactly as it is in the first frame: nothing is added to it. The insect people keep their insect heads, exactly four arms and the same clothes in every frame; nothing morphs or duplicates. `
    + (holo ? `The young man stays a translucent pale blue hologram of light in every frame, and never becomes solid. ${HOLO_CLEAN} ${BEHIND} ` : him ? `${BEHIND} ` : '')
    + 'No text appears on screen. No music, no subtitles.';
}
/** The still a shot stands in ('^' looks back to the still its take began from). */
function stillOfShot(film: Film, i: number): string {
  for (let k = i; k >= 0; k--) if (film.shots[k].from !== '^') return film.shots[k].from;
  throw new Error(`${film.id}: the first shot cannot continue a shot before it`);
}
export function clipPrompt(film: Film, i: number): string {
  const s = film.shots[i];
  const st = STILLS[stillOfShot(film, i)];
  const holo = st.shows.includes('HOLO');
  const him = holo || st.shows.includes('TECH');
  const t = tail(st.look, holo, him);
  const words = wordsOf(film, s);
  if (!words) return `${s.action} Nobody speaks: not a word is said. ${s.sound ? `Heard: ${s.sound}. ` : ''}${t}`.replace(/\s+/g, ' ');
  const who = whoOf(film, s);
  const spoken = assertSpeakable(words.replace(/\b[A-Z]{2,}\b/g, (w) => (w === 'AI' ? w : w.toLowerCase())));
  if (who === 'You') {
    // His line: he is seen from behind, so it is his VOICE that carries it; nobody whose face is seen moves a mouth.
    const he = holo ? 'The hologram of the young man' : 'The young man';
    // What MOVES in his shot is his listeners: a model animates whoever it is told about, and told only about him it
    // turns him round to show who is speaking (the takes of Oct 4 2026).
    const hush = st.look === 'ship' ? '' : `The insect people${st.look === 'call' ? ' on the screen' : ' facing him'} listen to him attentively, nodding slowly now and then, their mandibles closed: none of them speaks. He himself hardly moves.`;
    return `${s.action} ${he}, his back to the camera, says: "${spoken}" ${VOICES.You} ${hush} ${t}`.replace(/\s+/g, ' ');
  }
  const [subject, mouth] = SUBJECT[who] ?? ['The speaker', ''];
  const hush = him ? 'The young man says nothing and stays as he is, his back to the camera.'
    : film.faction === 'roach' ? 'Only that one speaker speaks: everyone else in the picture keeps their mandibles closed and still.' : '';
  return `${s.action} ${subject} says: "${spoken}" ${mouth} ${VOICES[who] ?? ''} ${hush} ${t}`.replace(/\s+/g, ' ');
}

const cutFile = (film: string, shot: string) => clipFile(film, shot).replace(/\.mp4$/, '.cut.json');

/**
 * THE COLOUR OF A TAKE IS HELD (Oct 4 2026). Every clip starts on the frame the one before it was cut on, so whatever
 * the video model does to the colour inside a clip is handed on to the next: measured on the first chained take
 * (tools/measure/cutscene-drift.mjs), the contrast of the blue channel had grown 1.46 times and the red had sunk by a
 * fifth after twelve links. So each clip is measured at its cut against the take's first frame, the frame the next clip
 * starts from is corrected back to it (per channel: out = in * k + o), and the bake applies the same correction to the
 * clip itself, rising from nothing at its first frame to all of it at the cut. The drift cannot add up.
 */
interface Colour { mean: number[]; sd: number[] }
interface Fix { k: number[]; o: number[] }
interface Cut { t: number; frame: number; fix?: Fix }
const NO_FIX: Fix = { k: [1, 1, 1], o: [0, 0, 0] };
/** The mean and spread of red, green and blue in one frame of a clip (read small). */
function colourOf(file: string, frame: number): Colour {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `select=eq(n\\,${frame}),scale=320:180`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  const px = r.stdout;
  // A frame that is not there (an index one past the end) must not be measured as a black picture: the "correction" for
  // black is +45 and x1.3 on every channel, and one clip of the first film was started from a frame bleached that way.
  if (!px || px.length < 320 * 180 * 3) throw new Error(`colourOf: ${path.basename(file)} has no frame ${frame}`);
  const n = Math.max(1, px.length / 3);
  const mean = [0, 0, 0], sd = [0, 0, 0];
  for (let i = 0; i + 2 < px.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += px[i + c];
  for (let c = 0; c < 3; c++) mean[c] /= n;
  for (let i = 0; i + 2 < px.length; i += 3) for (let c = 0; c < 3; c++) sd[c] += (px[i + c] - mean[c]) ** 2;
  return { mean, sd: sd.map((x) => Math.sqrt(x / n)) };
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/**
 * SPECKS: bright isolated points in a frame (a hologram's sparkle, snow, static). The model adds a few, the next clip
 * starts from a frame that has them and adds more: on the second take of the first film the whole room was snowing six
 * clips after one sparkle on his back. Counted at 640x360: pixels 25 brighter than all four neighbours two pixels away
 * (a room has hundreds of its own: garlands, carpet). A clip whose count at its cut is more than SPECK_GROWTH times its
 * take's first frame stops the take, to be looked at and made again before anything goes on from it.
 */
const SPECK_GROWTH = 1.6;
function specksOf(file: string, frame: number): number {
  const W = 640, H = 360;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `select=eq(n\\,${frame}),scale=${W}:${H}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
  const px = r.stdout;
  if (!px || px.length < W * H) return 0;
  let count = 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const v = px[y * W + x];
    if (v - px[y * W + x - 2] >= 25 && v - px[y * W + x + 2] >= 25 && v - px[(y - 2) * W + x] >= 25 && v - px[(y + 2) * W + x] >= 25) count++;
  }
  return count;
}
/** How many times the specks of its take's first frame a clip has at its cut (1: as it began). */
async function speckGrowth(film: Film, i: number): Promise<number> {
  const first = film.shots[takeStart(film, i)];
  const ref = Math.max(200, specksOf(clipFile(film.id, first.id), 0));
  const { frame } = await cutOf(film, i);
  return specksOf(clipFile(film.id, film.shots[i].id), frame) / ref;
}
/** What brings `got` back to `ref`, held to a modest range (the people in the picture move: the measure is of the whole frame). */
function fixOf(ref: Colour, got: Colour): Fix {
  const k = got.sd.map((v, c) => clamp(ref.sd[c] / Math.max(1, v), 0.7, 1.3));
  const o = k.map((kc, c) => clamp(ref.mean[c] - got.mean[c] * kc, -45, 45));
  return { k: k.map((x) => +x.toFixed(4)), o: o.map((x) => +x.toFixed(2)) };
}
const lut = (f: Fix) => `lutrgb=${['r', 'g', 'b'].map((ch, c) => `${ch}='clip(val*${f.k[c]}+${f.o[c]},0,255)'`).join(':')}`;
/** The first shot of the take a shot belongs to, and that take's first frame's colour. */
function takeStart(film: Film, i: number): number { let k = i; while (k > 0 && film.shots[k].from === '^') k--; return k; }
const refCache = new Map<string, Colour>();
function refColour(film: Film, i: number): Colour {
  const first = film.shots[takeStart(film, i)];
  const key = `${film.id}/${first.id}`;
  if (!refCache.has(key)) refCache.set(key, colourOf(clipFile(film.id, first.id), 0));
  return refCache.get(key)!;
}
/** The correction a clip needs at one of its frames to be the colour its take began with. */
const fixAt = (film: Film, i: number, frame: number): Fix => (process.env.CUTSCENE_NO_COLOUR_HOLD ? NO_FIX : fixOf(refColour(film, i), colourOf(clipFile(film.id, film.shots[i].id), frame)));

/**
 * WHERE A CLIP IS CUT when the next shot goes on from it: just after its last word (its whole length when nothing is
 * said in it), on a whole frame. The frame at the cut is the next clip's first frame, so the join cannot be seen, and
 * the pause the model leaves after a line is not in the film. Written beside the clip, with its colour correction;
 * the bake reads it.
 */
async function cutOf(film: Film, i: number): Promise<Cut> {
  const s = film.shots[i];
  const f = clipFile(film.id, s.id);
  const side = cutFile(film.id, s.id);
  if (fs.existsSync(side) && fs.statSync(side).mtimeMs >= fs.statSync(f).mtimeMs) { const j = JSON.parse(fs.readFileSync(side, 'utf8')) as Cut; if (j.fix) return j; }
  const d = duration(f);
  let t = d;
  if (wordsOf(film, s)) { const h = await hear(f); if (h.last !== undefined) t = Math.min(d, h.last + CUT_AFTER); }
  const frames = Math.max(2, Math.round(d * FPS));
  const frame = Math.min(frames - 2, Math.max(1, Math.round(t * FPS)));
  const cut: Cut = { t: frame / FPS, frame, fix: fixAt(film, i, frame) };
  fs.writeFileSync(side, JSON.stringify(cut));
  return cut;
}
/** The frame a clip is cut on, brought back to the take's first colour: the picture the next shot starts from. */
async function cutFrame(film: Film, i: number, out: string): Promise<string> {
  const f = clipFile(film.id, film.shots[i].id);
  const { frame, fix } = await cutOf(film, i);
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(cutFile(film.id, film.shots[i].id)).mtimeMs) return out;
  // The frame, in the take's first colour, with what the clip let drift through the air taken out: the next clip starts clean.
  const W = 1280, H = 720, N = W * H * 3;
  // Its neighbours in time (every fourth frame, sixteen either side, as far as the clip goes), all in the held colour.
  const a = Math.max(0, frame - 16);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', f, '-vf', `select=between(n\\,${a}\\,${frame + 16}),${lut(fix ?? NO_FIX)},scale=${W}:${H}`, '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  if (!r.stdout || r.stdout.length < N) throw new Error(`the frame at the cut of ${film.shots[i].id}: ${String(r.stderr).slice(-300)}`);
  const all: Buffer[] = [];
  for (let o = 0; o + N <= r.stdout.length; o += N) all.push(r.stdout.subarray(o, o + N));
  const at = Math.min(frame - a, all.length - 1);
  const px = Buffer.from(all[at]);
  const near = all.filter((_, k) => (k - at) % 4 === 0);
  const drifted = undrift(px, near, W, H);
  const taken = despeckle(px, W, H);
  const w = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-frames:v', '1', '-update', '1', out], { input: px, maxBuffer: 1 << 27 });
  if (w.status !== 0) throw new Error(`writing the frame at the cut of ${film.shots[i].id}: ${String(w.stderr).slice(-300)}`);
  if (drifted > 0.002) console.log(`[cut] ${film.shots[i].id}: ${(drifted * 100).toFixed(1)}% of the frame the next clip starts from was drifting light (motes, confetti), taken out`);
  if (taken > 0) console.log(`[cut] ${film.shots[i].id}: ${taken} specks taken out of the frame the next clip starts from`);
  return out;
}

/**
 * WHAT DRIFTS THROUGH THE AIR IS NOT HANDED ON (Oct 4 2026). The model lets a hologram shed soft motes of light, and a
 * happy crowd grow confetti; the next clip starts from a frame that has them and adds more, and by the tenth clip the
 * hotel conference room is in a snowstorm (the second and third takes of the first film; a point filter and "no
 * sparkles, no snow" in the prompt did not stop it, and naming them may have fed it). They MOVE, and the room does not:
 * so the frame a clip starts from is compared with the median of its neighbours in time, and wherever it is brighter
 * than that median (a mote passing) it is given the median. Nothing else of the frame changes: a still room, a still
 * face and a settled hand are their own median. Returns the share of the frame that was drifting light.
 */
function undrift(px: Buffer, near: Buffer[], W: number, H: number): number {
  if (near.length < 5) return 0;
  const v = new Uint8Array(near.length);
  const mid = near.length >> 1;
  const med = [0, 0, 0];
  let n = 0;
  const mask = new Uint8Array(W * H);
  const M = Buffer.alloc(W * H * 3);
  for (let i = 0, k = 0; i < W * H; i++, k += 3) {
    for (let c = 0; c < 3; c++) {
      for (let t = 0; t < near.length; t++) v[t] = near[t][k + c];
      v.sort();
      med[c] = v[mid];
    }
    const la = 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2];
    const lm = 0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2];
    if (la - lm > 5) { mask[i] = 1; M[k] = med[0]; M[k + 1] = med[1]; M[k + 2] = med[2]; }
  }
  // A mote is small. Where the brighter pixels are DENSE (an arm of light that moved, a hand, a head turning) the frame
  // is left as it is: giving those the median would rub the hologram out a little at every link (the fourth take: by the
  // tenth clip he was a flat teal man). Density: the share of a 33x33 window that is brighter than its median.
  const R = 16;
  const sat = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += mask[y * W + x]; sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row; } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!mask[i]) continue;
    const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
    const dense = (sat[y1 * (W + 1) + x1] - sat[y0 * (W + 1) + x1] - sat[y1 * (W + 1) + x0] + sat[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    if (dense > 0.4) continue;
    const k = i * 3;
    px[k] = M[k]; px[k + 1] = M[k + 1]; px[k + 2] = M[k + 2];
    n++;
  }
  return n / (W * H);
}

/**
 * SPECKS ARE NOT HANDED ON (Oct 4 2026). The model lets a hologram shed a few white motes; the next clip starts from a
 * frame that has them and adds more, and six clips later the room is snowing (the second take of the first film). So the
 * frame a clip starts from is cleaned first: a WHITISH point (little colour in it) that stands 18 or more above every
 * pixel of the ring three pixels round it is a mote, and it and its 5x5 are painted with that ring's mean. Coloured
 * detail (garlands, carpet, lamps) and anything wider than a few pixels is left alone. Returns how many were taken out.
 */
function despeckle(px: Buffer, W: number, H: number): number {
  const RING: Array<[number, number]> = [[-3, -3], [0, -3], [3, -3], [-3, 0], [3, 0], [-3, 3], [0, 3], [3, 3]];
  const lum = new Float32Array(W * H);
  for (let i = 0, k = 0; i < W * H; i++, k += 3) lum[i] = 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2];
  const hits: number[] = [];
  for (let y = 5; y < H - 5; y++) for (let x = 5; x < W - 5; x++) {
    const i = y * W + x;
    const v = lum[i];
    if (v < 70) continue;
    const k = i * 3;
    if (Math.max(px[k], px[k + 1], px[k + 2]) - Math.min(px[k], px[k + 1], px[k + 2]) > 46) continue; // coloured: the room's own
    let mote = true;
    for (const [dx, dy] of RING) if (v - lum[i + dy * W + dx] < 18) { mote = false; break; }
    if (mote) hits.push(i);
  }
  const src = Buffer.from(px);
  for (const i of hits) {
    const x = i % W, y = (i - x) / W;
    const mean = [0, 0, 0];
    for (const [dx, dy] of RING) { const k = ((y + dy) * W + x + dx) * 3; for (let c = 0; c < 3; c++) mean[c] += src[k + c] / RING.length; }
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const j = (y + dy) * W + x + dx;
      // Only the mote itself: the pixels of its 5x5 that stand above the ring too.
      if (lum[j] - (0.299 * mean[0] + 0.587 * mean[1] + 0.114 * mean[2]) < 8) continue;
      for (let c = 0; c < 3; c++) px[j * 3 + c] = Math.round(mean[c]);
    }
  }
  return hits.length;
}

async function clips(film: Film) {
  fs.mkdirSync(dirOf(film.id), { recursive: true });
  let made = 0;
  // In order: a shot that goes on from the one before it needs that clip made, heard and cut first.
  for (let i = 0; i < film.shots.length; i++) {
    const s = film.shots[i];
    const out = clipFile(film.id, s.id);
    if (fs.existsSync(out) || !want(s.id)) continue;
    const words = wordsOf(film, s);
    let start: string;
    if (s.from === '^') {
      if (!fs.existsSync(clipFile(film.id, film.shots[i - 1].id))) { console.warn(`[cut] ${s.id}: the shot before it (${film.shots[i - 1].id}) is not made; stopping here`); break; }
      start = await cutFrame(film, i - 1, path.join(dirOf(film.id), `${s.id}-start.png`));
    } else {
      if (!fs.existsSync(stillFile(s.from))) { console.warn(`[cut] ${s.id}: its picture ${s.from} is not drawn (run stills)`); break; }
      start = still169(s.from);
    }
    try {
      await makeClip({
        slug: `cut-${film.id}-${s.id}`, stillFile: start, out, models: [VIDEO_MODEL], prompt: clipPrompt(film, i),
        seconds: words ? secsFor(words) : s.secs ?? 6, loop: false, raw: true, resolution: '720p', aspect: '16:9', audio: true,
      });
    } catch (e) { console.warn(`[cut] clip ${s.id} failed: ${(e as Error).message.slice(0, 300)}; stopping here`); break; }
    fs.writeFileSync(out.replace(/\.mp4$/, '.txt'), `${words}\n---\n${clipPrompt(film, i)}\n`);
    made++;
    if (words) {
      const h = await hear(out).catch(() => ({ text: '' } as Heard));
      const hz = Math.round(pitchOf(out));
      console.log(`[cut] ${s.id} ${whoOf(film, s)}: heard ${Math.round(heard(words, h.text) * 100)}% at ${hz} Hz: "${h.text}"`);
    }
    // Snow is handed down the take with the frame: a clip that has grown specks stops it here.
    const grown = await speckGrowth(film, i);
    if (grown > SPECK_GROWTH && !process.env.CUTSCENE_ALLOW_SPECKS) {
      console.warn(`[cut] ${s.id}: SPECKS x${grown.toFixed(2)} of the take's first frame at its cut (sparkle, snow or static). Look at it; \`redo ${film.id} ${s.id}\` and make it again. Stopping here.`);
      break;
    }
  }
  console.log(`[cut] ${film.id}: ${made} clips made on ${VIDEO_MODEL}`);
}

/** Move a clip aside (v1/, v2/ ...), and every clip that went on from it (their first frames came from it), so that `clips` makes them again. */
function redo(film: Film) {
  const from = film.shots.findIndex((s) => only.includes(s.id));
  if (from < 0) { console.warn('[cut] redo: name a shot of the film'); return; }
  let to = from;
  while (film.shots[to + 1]?.from === '^') to++;
  let n = 1;
  while (fs.existsSync(path.join(dirOf(film.id), `v${n}`))) n++;
  fs.mkdirSync(path.join(dirOf(film.id), `v${n}`), { recursive: true });
  for (let i = from; i <= to; i++) {
    const s = film.shots[i];
    const f = clipFile(film.id, s.id);
    for (const g of [f, f.replace(/\.mp4$/, '.json'), f.replace(/\.mp4$/, '.txt'), cutFile(film.id, s.id), path.join(dirOf(film.id), `${s.id}-start.png`)]) {
      if (fs.existsSync(g)) fs.renameSync(g, path.join(dirOf(film.id), `v${n}`, path.basename(g)));
    }
  }
  console.log(`[cut] ${film.id}: ${film.shots.slice(from, to + 1).map((s) => s.id).join(' ')} → v${n}/`);
}

// ------------------------------------------------------------------ check: the words, and the voices
/** What a clip says, and when (Deepgram via RFab: the words with their times); cached in art-src-new. */
interface Heard { text: string; first?: number; last?: number }
function heardCache(file: string): string {
  const st = fs.statSync(file);
  return path.join(RAW, 'words', `${path.basename(path.dirname(file))}-${path.basename(file)}-${st.size}.json`);
}
async function hear(file: string): Promise<Heard> {
  const cache = heardCache(file);
  if (fs.existsSync(cache)) { const j = JSON.parse(fs.readFileSync(cache, 'utf8')) as Heard & { timed?: boolean }; if (j.timed) return j; }
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  const wav = cache.replace(/\.json$/, '.wav');
  ff(['-i', file, '-vn', '-ac', '1', '-ar', '16000', wav], 'wav');
  const r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(wav).toString('base64') }) });
  const text = String(r.transcript ?? r.text ?? r.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim();
  const ws = (r.words ?? []) as Array<{ start: number; end: number }>;
  const out = { text, timed: true, ...(ws.length ? { first: ws[0].start, last: ws[ws.length - 1].end } : {}) };
  fs.writeFileSync(cache, JSON.stringify(out));
  fs.rmSync(wav, { force: true });
  return out;
}
const said = async (file: string): Promise<string> => (await hear(file)).text;
/** Where the words of a clip begin and end, from its transcript (made by `check`); null when it has not been heard yet or says nothing. */
function wordSpan(file: string): { start: number; end: number } | null {
  const cache = heardCache(file);
  if (!fs.existsSync(cache)) return null;
  const j = JSON.parse(fs.readFileSync(cache, 'utf8')) as Heard;
  return j.first !== undefined && j.last !== undefined ? { start: j.first, end: j.last } : null;
}
const norm = (t: string) => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
/** The share of the line's words that were heard, in any order. */
export function heard(line: string, got: string): number {
  const want_ = norm(line);
  const bag = norm(got);
  let n = 0;
  for (const w of want_) { const i = bag.indexOf(w); if (i >= 0) { n++; bag.splice(i, 1); } }
  return want_.length ? n / want_.length : 1;
}
/** Words heard that are not in the line (a second voice, an ad-lib): their share of what was heard. */
function extra(line: string, got: string): number {
  const bag = norm(line);
  const said_ = norm(got);
  let n = 0;
  for (const w of said_) { const i = bag.indexOf(w); if (i >= 0) bag.splice(i, 1); else n++; }
  return said_.length ? n / said_.length : 0;
}

/** The median pitch of the voice in a clip, in Hz (autocorrelation over its voiced frames); 0 when none is found. */
export function pitchOf(file: string): number {
  const SR = 16000;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0 || !r.stdout.length) return 0;
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4));
  const N = 640, HOP = 320, lo = Math.floor(SR / 400), hi = Math.floor(SR / 70);
  const f0: number[] = [];
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  for (let o = 0; o + N + hi < x.length; o += HOP) {
    let e = 0;
    for (let i = 0; i < N; i++) e += x[o + i] * x[o + i];
    if (Math.sqrt(e / N) < peak * 0.06) continue;
    let best = 0, lag = 0;
    for (let l = lo; l <= hi; l++) {
      let c = 0, e2 = 0;
      for (let i = 0; i < N; i++) { c += x[o + i] * x[o + i + l]; e2 += x[o + i + l] * x[o + i + l]; }
      const v = c / Math.sqrt(e * e2 + 1e-12);
      if (v > best) { best = v; lag = l; }
    }
    if (best > 0.6 && lag) f0.push(SR / lag);
  }
  if (f0.length < 8) return 0;
  f0.sort((a, b) => a - b);
  return f0[Math.floor(f0.length / 2)];
}

interface Row { id: string; who: string; heard: number; extra: number; said: string; line: string; secs: number; pitch: number; off?: number; flag?: string }
async function check(film: Film): Promise<Row[]> {
  const rows: Row[] = [];
  for (const s of film.shots) {
    const f = clipFile(film.id, s.id);
    if (!fs.existsSync(f)) continue;
    const line = wordsOf(film, s);
    const got = await said(f).catch((e) => `ERR ${(e as Error).message.slice(0, 80)}`);
    rows.push({ id: s.id, who: whoOf(film, s), heard: +(line ? heard(line, got) : 1).toFixed(2), extra: +(line ? extra(line, got) : got ? 1 : 0).toFixed(2), said: got, line, secs: +duration(f).toFixed(2), pitch: line ? Math.round(pitchOf(f)) : 0 });
  }
  // Each speaker's voice: a clip whose pitch is far from that speaker's median is another voice.
  for (const who of new Set(rows.map((r) => r.who).filter(Boolean))) {
    const ps = rows.filter((r) => r.who === who && r.pitch > 0).map((r) => r.pitch).sort((a, b) => a - b);
    const med = ps[Math.floor(ps.length / 2)] ?? 0;
    for (const r of rows.filter((x) => x.who === who && x.pitch > 0)) r.off = med ? +((r.pitch - med) / med).toFixed(2) : 0;
  }
  for (const r of rows) {
    // He is seen from behind: a line of his said by the wrong mouth comes out in the other's voice (a woman's, far above his).
    const notHim = r.who === 'You' && r.pitch > 175;
    const flags = [r.line && r.heard < 0.85 ? 'WORDS' : '', r.line && r.extra > 0.25 ? 'EXTRA' : '', !r.line && r.said ? 'SPEAKS' : '', Math.abs(r.off ?? 0) > 0.2 ? 'VOICE' : '', notHim ? 'NOT-HIS-VOICE' : ''].filter(Boolean);
    if (flags.length) r.flag = flags.join('+');
    console.log(`${(r.flag ?? 'ok').padEnd(12)} ${r.id.padEnd(6)} ${(r.who || '-').padEnd(12)} ${String(Math.round(r.heard * 100)).padStart(3)}%  ${String(r.pitch).padStart(3)} Hz ${r.off !== undefined ? `${r.off > 0 ? '+' : ''}${Math.round(r.off * 100)}%` : ''}  said: ${r.said}`);
  }
  fs.mkdirSync(path.join(REVIEW, film.id), { recursive: true });
  fs.writeFileSync(path.join(REVIEW, film.id, 'speech.json'), JSON.stringify(rows, null, 1));
  return rows;
}

// ------------------------------------------------------------------ bake: one film
interface Cue { shot: string; line?: number; who?: string; text?: string; t0: number; t1: number }
function loudnorm(src: string, a: number, b: number, target: number): string {
  const m = ffStderr(['-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', src, '-vn', '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  if (!m.includes('input_i')) return '';
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  if (!Number.isFinite(Number(j.input_i))) return '';
  return `loudnorm=I=${target}:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
}

function bake(film: Film) {
  const tmp = path.join(dirOf(film.id), 'bake');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const missing = film.shots.filter((s) => !fs.existsSync(clipFile(film.id, s.id)));
  if (missing.length) { console.warn(`[cut] ${film.id}: not baked, ${missing.length} clips are not made (${missing.map((s) => s.id).join(', ')})`); return; }
  const cues: Cue[] = [];
  const parts: string[] = [];
  let t = 0;
  film.shots.forEach((s, i) => {
    const src = clipFile(film.id, s.id);
    const d = duration(src);
    const frames = Math.max(2, Math.round(d * FPS));
    const words = wordsOf(film, s);
    const next = film.shots[i + 1];
    const ws = wordSpan(src);
    const es = words ? speechSpan(src) : null;
    // The head: a shot that goes on from the one before it starts on its first frame (the frame that one was cut on);
    // the first shot of a place starts a beat before its words (the transcript drops an "um"; the loudness does not).
    let fa = 0;
    if (s.from !== '^') fa = words && ws ? Math.max(2, Math.round((Math.min(ws.start, es?.start ?? ws.start) - 0.3) * FPS)) : 2;
    // The tail: cut where the next shot was started from; the last shot of a place a beat after its words; the film's
    // last shot keeps a little longer, to end on.
    let fb = frames;
    const side = cutFile(film.id, s.id);
    let cutAt: Cut | null = null;
    if (next?.from === '^') { if (fs.existsSync(side)) { cutAt = JSON.parse(fs.readFileSync(side, 'utf8')) as Cut; fb = cutAt.frame; } }
    else if (words && ws) fb = Math.min(frames, Math.round((ws.end + (next ? 0.5 : 1.6)) * FPS));
    if (fb - fa < 12) fb = Math.min(frames, fa + 12);
    // The colour held: the correction measured at this clip's cut (at its last frame used, when nothing goes on from it),
    // rising from none at the clip's first frame to all of it there.
    const at = cutAt?.frame ?? Math.max(1, fb - 1);
    const fix = cutAt?.fix ?? fixAt(film, i, at);
    const a = fa / FPS, b = fb / FPS;
    const part = path.join(tmp, `${String(i).padStart(2, '0')}-${s.id}.mp4`);
    const ln = loudnorm(src, a, b, words ? -16 : -24);
    const len = b - a;
    const af = [`atrim=start=${a.toFixed(4)}:end=${b.toFixed(4)}`, 'asetpts=PTS-STARTPTS', ln, 'afade=t=in:d=0.03', `afade=t=out:st=${Math.max(0, len - 0.05).toFixed(3)}:d=0.05`].filter(Boolean).join(',');
    const rise = `min(1\\,(T+${(fa / FPS).toFixed(4)})/${(at / FPS).toFixed(4)})`;
    ff(['-i', src, '-filter_complex',
      `[0:v]trim=start_frame=${fa}:end_frame=${fb},setpts=PTS-STARTPTS,format=gbrp,split[plain][tofix];[tofix]${lut(fix)}[fixed];`
      + `[plain][fixed]blend=all_expr='A*(1-${rise})+B*${rise}',scale=1280:720,fps=${FPS},format=yuv420p[v]`,
      '-map', '[v]', '-map', '0:a', '-af', `${af},aresample=48000`, '-ac', '2',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-video_track_timescale', '12288', part], `part ${s.id}`);
    const real = duration(part);
    cues.push({ shot: s.id, ...(words ? { line: s.line, who: whoOf(film, s), text: words } : {}), t0: +t.toFixed(3), t1: +(t + real).toFixed(3) });
    t += real;
    parts.push(part);
  });
  finishBake(film, tmp, parts, cues);
}

/** The parts joined, one quiet room tone under them, the poster, and the film's entry in the manifest (its cues). */
function finishBake(film: Film, tmp: string, parts: string[], cues: Cue[]) {
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const joined = path.join(tmp, 'joined.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined], 'join');
  const total = duration(joined);
  // One quiet room tone under the whole film, so that the cuts between takes do not open onto silence.
  const dest = path.join(OUT, `${film.id}.mp4`);
  ff(['-i', joined, '-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anoisesrc=color=pink:sample_rate=48000:amplitude=0.25',
    '-filter_complex', `[1:a]highpass=f=70,lowpass=f=700,volume=-44dB,afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, total - 0.8).toFixed(3)}:d=0.8[bed];[0:a][bed]amix=inputs=2:normalize=0:duration=first,afade=t=out:st=${Math.max(0, total - 0.5).toFixed(3)}:d=0.5[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', dest], 'mix');
  const poster = path.join(OUT, `${film.id}.webp`);
  ff(['-ss', '1.2', '-i', dest, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '82', poster], 'poster');
  const manFile = path.join(OUT, 'scenes.json');
  const man: { films: Record<string, { video: string; poster: string; seconds: number; cues: Cue[] }> } = fs.existsSync(manFile) ? JSON.parse(fs.readFileSync(manFile, 'utf8')) : { films: {} };
  man.films[film.id] = { video: `media/scenes/${film.id}.mp4`, poster: `media/scenes/${film.id}.webp`, seconds: +duration(dest).toFixed(3), cues };
  fs.writeFileSync(manFile, JSON.stringify(man, null, 1));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`[cut] baked ${film.id}: ${film.shots.length} shots, ${duration(dest).toFixed(1)} s, ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB → ${dest}`);
}

// ------------------------------------------------------------------ a film as ACTED EXCHANGES (Oct 4 2026)
/**
 * Collins, of the film made one line a clip on Veo 3.1 Lite: "the words sound like they were generated with AI then the
 * video was created around them; that sounds stilted and is not good for voice acting; all the frontier video models
 * can do talking". And of its end: "it's like the video goes static in the last 20 seconds" (twelve joins: every clip
 * added a few motes of light to the frame it was handed).
 *
 * So a film is made of EXCHANGES: several lines of its scene played in ONE clip by a model that acts (Seedance 2.5:
 * clips of 4 to 30 seconds; tools/media/talk-test.mjs is the comparison), so that the turn-taking, the pauses and the
 * listening are the model's own performance and not a cut after every line. A shot list (content/cutscenes.ts) stays
 * what it was, one line a shot with its direction; here its shots are gathered, in order, into as few clips as their
 * words allow (TALK_WORDS a clip), a new clip at every new place. Each clip still starts on the frame the one before it
 * was cut on (colour held, what drifts taken out), but a film of a dozen lines has three joins, not twelve.
 *
 *   talk <film> [tNN]   (SPENDS) the exchanges, in order; one when named
 *   talkcheck <film>    each line against what was heard, where in its clip it is, each speaker's pitch
 *   talkbake <film>     joined at their cuts; the cues (which line is said when) from the words' own times
 * The clips: art-src-new/cutscenes/<film>/talk/tNN.mp4. The baked film and its cues are what `bake` writes.
 */
const TALK_MODEL = process.env.CUTSCENE_TALK_MODEL || 'imagerouter:seedance-2.5-i2v';
const TALK_RES = process.env.CUTSCENE_TALK_RES || '720p';
const TALK_WORDS = Number(process.env.CUTSCENE_TALK_WORDS || 44);
const TALK_MAX_SECS = Number(process.env.CUTSCENE_TALK_MAX_SECS || 30);

interface Exchange { id: string; shots: number[]; from: string }
function exchangesOf(film: Film): Exchange[] {
  const out: Exchange[] = [];
  let cur: Exchange | null = null;
  let words = 0;
  film.shots.forEach((s, i) => {
    const w = wordCount(wordsOf(film, s));
    const place = s.from !== '^';
    if (!cur || place || (w > 0 && words + w > TALK_WORDS)) {
      cur = { id: `t${String(out.length).padStart(2, '0')}`, shots: [], from: place ? s.from : '^' };
      out.push(cur);
      words = 0;
    }
    cur.shots.push(i);
    words += w;
  });
  return out;
}
const talkDir = (film: Film) => path.join(dirOf(film.id), 'talk');
const talkFile = (film: Film, ex: Exchange) => path.join(talkDir(film), `${ex.id}.mp4`);
const talkCutFile = (film: Film, ex: Exchange) => talkFile(film, ex).replace(/\.mp4$/, '.cut.json');

/** How long an exchange runs: its words at a talking pace, a beat for every change of speaker, its silent shots, a breath at each end. */
function talkSecs(film: Film, ex: Exchange): number {
  let words = 0, turns = 0, silent = 0, last = '';
  for (const i of ex.shots) {
    const s = film.shots[i];
    const w = wordCount(wordsOf(film, s));
    if (!w) { silent += Math.min(3, s.secs ?? 3); continue; }
    words += w;
    const who = whoOf(film, s);
    if (last && who !== last) turns++;
    last = who;
  }
  // Measured on the first exchange (Seedance 2.5): about two words a second with its pauses; its last line ended 0.1 s before the clip did.
  // (A clip given seconds to spare fills them with silence: the second clip of the first film had 25 s for 17 s of speech.)
  return Math.max(4, Math.min(TALK_MAX_SECS, Math.ceil(words / 2.3 + turns * 0.8 + silent + 1.5)));
}

/** A performance, not a read-out: who is where, then the scene beat by beat with each line inside its action. */
function talkPrompt(film: Film, ex: Exchange): string {
  const st = STILLS[stillOfShot(film, ex.shots[0])];
  const holo = st.shows.includes('HOLO');
  const him = holo || st.shows.includes('TECH');
  // "Hologram" is not said: the picture shows what he is, and the word invites sparkles (the takes of Oct 4 2026).
  const he = holo ? 'the pale blue translucent figure of the young man in the foreground' : 'the young man in the foreground';
  const speakers = new Set<string>();
  const beats = ex.shots.map((i, k) => {
    const s = film.shots[i];
    const words = wordsOf(film, s);
    if (!words) return `${s.action}${s.sound ? ` (heard: ${s.sound})` : ''}`;
    const who = whoOf(film, s);
    speakers.add(who);
    const spoken = assertSpeakable(words.replace(/\b[A-Z]{2,}\b/g, (w) => (w === 'AI' ? w : w.toLowerCase())));
    if (who === 'You') {
      const voice = (s.action.match(/His voice is ([^.]*)\./) ?? [])[1];
      // Two of his lines in a row are one speech: he goes on.
      const prev = k > 0 ? film.shots[ex.shots[k - 1]] : null;
      if (prev && wordsOf(film, prev) && whoOf(film, prev) === 'You') return `He goes on${voice ? `, ${voice}` : ''}: "${spoken}"`;
      return `${k ? 'Then, without' : 'Without'} turning round, he ${k ? 'answers' : 'speaks'}${voice ? `, ${voice}` : ''}: "${spoken}"`;
    }
    const [subject] = SUBJECT[who] ?? ['The speaker'];
    return `${s.action} ${subject.replace(/,$/, '')} says: "${spoken}"`;
  });
  const voices = [...speakers].map((w) => (VOICES[w] ?? '').replace(' It is always exactly this same voice.', '')).filter(Boolean).join(' ');
  return [
    `One continuous locked-off shot${him ? ' over his shoulder' : ''}: the camera never moves and never cuts.`,
    him ? `${he[0].toUpperCase()}${he.slice(1)} keeps his back to the camera for the whole shot: only the back of his head and his shoulders are seen, never his face, and he does not turn round.` : '',
    ...beats,
    voices,
    // (It said "unhurried, with real pauses": the model took seconds of silence, and opened a clip with five of them.)
    speakers.size > 1 ? 'They play it the way actors play a scene together: natural, lively timing, each line picking up the one before it after a short beat; whoever is listening reacts while the other speaks. The first line is spoken at once, in the first second of the shot, and there is never a silence of more than a second.'
      : speakers.size ? 'It is played the way an actor plays it: natural timing, a short beat between the lines. The first line is spoken at once, in the first second of the shot, and there is never a silence of more than a second.' : '',
    speakers.size ? 'Only the lines written here are spoken, each once, in this order, by the one named; nobody else speaks.' : 'Nobody speaks: not a word is said.',
    st.look === 'ship' ? '' : 'The insect people keep their insect heads and four arms.',
    'The place stays exactly as it is in the first frame: nothing is added to it and nobody new comes in. Quiet room tone; no music; no text on screen.',
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

interface Word { w: string; start: number; end: number }
/** What a clip says, word by word with its times (kept beside the clip). */
async function hearWords(file: string): Promise<{ text: string; words: Word[] }> {
  const cache = file.replace(/\.mp4$/, '.words.json');
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(file).mtimeMs) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const wav = file.replace(/\.mp4$/, '.wav');
  ff(['-i', file, '-vn', '-ac', '1', '-ar', '16000', wav], 'wav');
  const r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(wav).toString('base64') }) });
  fs.rmSync(wav, { force: true });
  const text = String(r.transcript ?? r.text ?? '').trim();
  const words: Word[] = ((r.words ?? []) as Array<{ word?: string; punctuated_word?: string; text?: string; start: number; end: number }>)
    .map((x) => ({ w: norm(String(x.word ?? x.punctuated_word ?? x.text ?? ''))[0] ?? '', start: x.start, end: x.end })).filter((x) => x.w);
  const out = { text, words };
  fs.writeFileSync(cache, JSON.stringify(out));
  return out;
}

/** Where each line of an exchange is in what was heard: the stretch of words that fits it best, in order. */
function alignLines(lines: string[], words: Word[]): Array<{ start: number; end: number; heard: number } | null> {
  const out: Array<{ start: number; end: number; heard: number } | null> = [];
  let pos = 0;
  for (const line of lines) {
    const want = norm(line);
    let best: { e: number; score: number; hit: number } | null = null;
    for (let e = Math.max(pos + 1, pos + want.length - 4); e <= Math.min(words.length, pos + want.length + 4); e++) {
      const bag = words.slice(pos, e).map((x) => x.w);
      let hit = 0;
      for (const w of want) { const i = bag.indexOf(w); if (i >= 0) { hit++; bag.splice(i, 1); } }
      // The stretch that holds the most of the line's words and the fewest that are not its own; it must end on the line's last word if it can.
      const score = hit - bag.length * 0.6 + (words[e - 1]?.w === want[want.length - 1] ? 0.75 : 0);
      if (!best || score > best.score) best = { e, score, hit };
    }
    if (!best || best.hit === 0 || pos >= words.length) { out.push(null); continue; }
    out.push({ start: words[pos].start, end: words[best.e - 1].end, heard: best.hit / Math.max(1, want.length) });
    pos = best.e;
  }
  return out;
}

/** How many frames a clip really has (counted, not its length times its rate: that is one too many as often as not). */
const frameCount = (file: string): number => Math.max(2, Number(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim()) || 2);
const fpsOf = (file: string): number => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim();
  const [a, b] = r.split('/').map(Number);
  return a && b ? a / b : FPS;
};

/** The pitch of a stretch of a clip (its median, Hz). */
function pitchOfSpan(file: string, a: number, b: number): number {
  const tmp = file.replace(/\.mp4$/, `.span.wav`);
  ff(['-ss', Math.max(0, a).toFixed(3), '-to', b.toFixed(3), '-i', file, '-vn', '-ac', '1', '-ar', '16000', tmp], 'span');
  const hz = pitchOf(tmp);
  fs.rmSync(tmp, { force: true });
  return hz;
}

interface TalkCut { frame: number; fps: number; fix: Fix; lines: Array<{ shot: string; start: number; end: number; heard: number } | { shot: string; missing: true }> }
/** The first clip of the take (place) an exchange belongs to: its first frame is the colour the take is held to. */
function talkTakeStart(exs: Exchange[], k: number): number { let i = k; while (i > 0 && exs[i].from === '^') i--; return i; }

/** Hear an exchange's clip, find its lines in it, and say where it is cut (a beat after its last word). */
async function talkCut(film: Film, exs: Exchange[], k: number): Promise<TalkCut> {
  const ex = exs[k];
  const f = talkFile(film, ex);
  const side = talkCutFile(film, ex);
  if (fs.existsSync(side) && fs.statSync(side).mtimeMs >= fs.statSync(f).mtimeMs) return JSON.parse(fs.readFileSync(side, 'utf8')) as TalkCut;
  const spoken = ex.shots.filter((i) => wordsOf(film, film.shots[i]));
  const h = await hearWords(f);
  const spans = alignLines(spoken.map((i) => wordsOf(film, film.shots[i])), h.words);
  const fps = fpsOf(f);
  const frames = frameCount(f);
  const lastEnd = Math.max(0, ...spans.filter(Boolean).map((x) => x!.end));
  // A beat after the last word (the listener's reaction is part of the performance); the film's last clip runs out.
  const frame = Math.min(frames - 1, Math.max(1, Math.round((lastEnd ? lastEnd + 0.9 : duration(f)) * fps)));
  const ref = colourOf(talkFile(film, exs[talkTakeStart(exs, k)]), 0);
  const cut: TalkCut = {
    frame, fps, fix: process.env.CUTSCENE_NO_COLOUR_HOLD ? NO_FIX : fixOf(ref, colourOf(f, frame)),
    lines: spoken.map((i, n) => (spans[n] ? { shot: film.shots[i].id, start: +spans[n]!.start.toFixed(3), end: +spans[n]!.end.toFixed(3), heard: +spans[n]!.heard.toFixed(2) } : { shot: film.shots[i].id, missing: true as const })),
  };
  fs.writeFileSync(side, JSON.stringify(cut));
  return cut;
}

/** The frame an exchange is cut on, in its take's first colour and with what drifted through the air taken out: where the next starts. */
async function talkStartFrame(film: Film, exs: Exchange[], k: number): Promise<string> {
  const prev = exs[k - 1];
  const f = talkFile(film, prev);
  const cut = await talkCut(film, exs, k - 1);
  const out = path.join(talkDir(film), `${exs[k].id}-start.png`);
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(talkCutFile(film, prev)).mtimeMs) return out;
  const W = 1280, H = 720, N = W * H * 3;
  const step = Math.max(1, Math.round(cut.fps / 6));
  const a = Math.max(0, cut.frame - step * 4);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', f, '-vf', `select=between(n\\,${a}\\,${cut.frame + step * 4}),${lut(cut.fix)},scale=${W}:${H}`, '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  if (!r.stdout || r.stdout.length < N) throw new Error(`the frame ${prev.id} is cut on: ${String(r.stderr).slice(-300)}`);
  const all: Buffer[] = [];
  for (let o = 0; o + N <= r.stdout.length; o += N) all.push(r.stdout.subarray(o, o + N));
  const at = Math.min(cut.frame - a, all.length - 1);
  const px = Buffer.from(all[at]);
  const drifted = undrift(px, all.filter((_, i) => (i - at) % step === 0), W, H);
  // (No point filter here: on a clean model it only took the white petals out of the garlands.)
  // THE SHARPNESS IS HELD (Oct 4 2026). A model softens whatever picture it is handed in its first half second (measured
  // on Seedance 2.5: to about 0.7 of it) and then holds that; handed the soft last frame of the clip before, the next
  // clip is softer again, and the fourth clip of the first film had 17% of the first one's fine detail. So the frame a
  // clip starts from is sharpened back to its take's first frame (an unsharp mask, its amount found by measuring), and
  // every clip settles at the same sharpness. The bake softens the first half second of a clip that goes on from another
  // (sharper than what came before it) so that the join does not pulse.
  const ref = sharpOf(readRgb(talkFile(film, exs[talkTakeStart(exs, k - 1)]), 0, W, H), W, H);
  const have = sharpOf(px, W, H);
  let sharp = px;
  let amount = 0;
  if (have < ref * 0.97 && !process.env.CUTSCENE_NO_SHARP_HOLD) {
    let lo = 0, hi = 2.5;
    for (let n = 0; n < 7; n++) {
      amount = (lo + hi) / 2;
      const u = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-vf', `unsharp=5:5:${amount.toFixed(3)}:5:5:0`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { input: px, maxBuffer: 1 << 27 });
      if (!u.stdout || u.stdout.length < N) break;
      sharp = Buffer.from(u.stdout.subarray(0, N));
      if (sharpOf(sharp, W, H) < ref) lo = amount; else hi = amount;
    }
  }
  const w = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', '-frames:v', '1', '-update', '1', out], { input: sharp, maxBuffer: 1 << 27 });
  if (w.status !== 0) throw new Error(`writing ${out}: ${String(w.stderr).slice(-300)}`);
  console.log(`[talk] ${prev.id} → ${exs[k].id}: the start frame's sharpness ${Math.round(have)} → ${Math.round(sharpOf(sharp, W, H))} (the take began at ${Math.round(ref)}; unsharp ${amount.toFixed(2)})${drifted > 0.002 ? `; ${(drifted * 100).toFixed(1)}% of it was drifting light, taken out` : ''}`);
  return out;
}

/** One frame of a clip, raw (rgb24). */
function readRgb(file: string, frame: number, W: number, H: number): Buffer {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `select=eq(n\\,${frame}),scale=${W}:${H}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 });
  return Buffer.from(r.stdout.subarray(0, W * H * 3));
}
/** How sharp a picture is: the variance of its luminance's Laplacian (its fine detail). */
function sharpOf(px: Buffer, W: number, H: number): number {
  const lum = (i: number) => 0.299 * px[i * 3] + 0.587 * px[i * 3 + 1] + 0.114 * px[i * 3 + 2];
  let sum = 0, n = 0;
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const i = y * W + x;
    const l = 4 * lum(i) - lum(i - 1) - lum(i + 1) - lum(i - W) - lum(i + W);
    sum += l * l;
    n++;
  }
  return sum / Math.max(1, n);
}

function talkReport(film: Film, ex: Exchange, cut: TalkCut): void {
  const f = talkFile(film, ex);
  for (const l of cut.lines) {
    const s = film.shots.find((x) => x.id === l.shot)!;
    if ('missing' in l) { console.log(`   ${ex.id} ${l.shot.padEnd(4)} ${whoOf(film, s).padEnd(12)} NOT HEARD   "${wordsOf(film, s)}"`); continue; }
    const hz = Math.round(pitchOfSpan(f, l.start, l.end));
    const who = whoOf(film, s);
    const flag = l.heard < 0.8 ? 'WORDS' : who === 'You' && hz > 175 ? 'NOT-HIS-VOICE' : 'ok';
    console.log(`   ${ex.id} ${l.shot.padEnd(4)} ${who.padEnd(12)} ${flag.padEnd(13)} ${String(Math.round(l.heard * 100)).padStart(3)}%  ${String(hz).padStart(3)} Hz  ${l.start.toFixed(1)}-${l.end.toFixed(1)} s`);
  }
}

async function talk(film: Film) {
  const exs = exchangesOf(film);
  fs.mkdirSync(talkDir(film), { recursive: true });
  let made = 0;
  for (let k = 0; k < exs.length; k++) {
    const ex = exs[k];
    const out = talkFile(film, ex);
    if (fs.existsSync(out) || !want(ex.id)) continue;
    let start: string;
    if (ex.from === '^') {
      if (!fs.existsSync(talkFile(film, exs[k - 1]))) { console.warn(`[talk] ${ex.id}: the exchange before it is not made; stopping here`); break; }
      start = await talkStartFrame(film, exs, k);
    } else {
      if (!fs.existsSync(stillFile(ex.from))) { console.warn(`[talk] ${ex.id}: its picture ${ex.from} is not drawn (run stills)`); break; }
      start = still169(ex.from);
    }
    const prompt = talkPrompt(film, ex);
    const seconds = talkSecs(film, ex);
    try {
      await makeClip({ slug: `talk-${film.id}-${ex.id}`, stillFile: start, out, models: [TALK_MODEL], prompt, seconds, loop: false, raw: true, resolution: TALK_RES, aspect: '16:9', audio: true });
    } catch (e) { console.warn(`[talk] ${ex.id} failed: ${(e as Error).message.slice(0, 300)}; stopping here`); break; }
    fs.writeFileSync(out.replace(/\.mp4$/, '.txt'), `${ex.shots.map((i) => film.shots[i].id).join(' ')}\n---\n${prompt}\n`);
    made++;
    const cut = await talkCut(film, exs, k);
    console.log(`[talk] ${ex.id} (${ex.shots.map((i) => film.shots[i].id).join(' ')}), ${duration(out).toFixed(1)} s, cut at ${(cut.frame / cut.fps).toFixed(1)} s:`);
    talkReport(film, ex, cut);
    talkDeadAir(film, exs, k, cut);
  }
  console.log(`[talk] ${film.id}: ${made} clips made on ${TALK_MODEL} at ${TALK_RES} (${exs.length} exchanges: ${exs.map((e) => `${e.id}=${talkSecs(film, e)}s`).join(' ')})`);
}

async function talkCheck(film: Film) {
  const exs = exchangesOf(film);
  for (let k = 0; k < exs.length; k++) {
    if (!fs.existsSync(talkFile(film, exs[k]))) { console.log(`   ${exs[k].id} not made`); continue; }
    const cut = await talkCut(film, exs, k);
    talkReport(film, exs[k], cut);
    talkDeadAir(film, exs, k, cut);
  }
}

/** Say what dead air a clip has (the bake takes it out). */
function talkDeadAir(film: Film, exs: Exchange[], k: number, cut: TalkCut): void {
  const f = talkFile(film, exs[k]);
  const end = exs[k + 1]?.from === '^' ? cut.frame / cut.fps : duration(f);
  for (const d of deadAir(film, exs[k], cut, f, end)) console.log(`   ${exs[k].id} DEAD AIR     ${d.why}: ${(d.to - d.from).toFixed(1)} s taken out at the bake`);
}

/** Move an exchange's clip aside, and every one that went on from it. */
function talkRedo(film: Film) {
  const exs = exchangesOf(film);
  const from = exs.findIndex((e) => only.includes(e.id));
  if (from < 0) { console.warn('[talk] talkredo: name an exchange (t00, t01 ...)'); return; }
  let to = from;
  while (exs[to + 1]?.from === '^') to++;
  let n = 1;
  while (fs.existsSync(path.join(talkDir(film), `v${n}`))) n++;
  fs.mkdirSync(path.join(talkDir(film), `v${n}`), { recursive: true });
  for (let k = from; k <= to; k++) {
    const base = talkFile(film, exs[k]).replace(/\.mp4$/, '');
    for (const g of [`${base}.mp4`, `${base}.json`, `${base}.txt`, `${base}.cut.json`, `${base}.words.json`, `${base}-start.png`]) if (fs.existsSync(g)) fs.renameSync(g, path.join(talkDir(film), `v${n}`, path.basename(g)));
  }
  console.log(`[talk] ${film.id}: ${exs.slice(from, to + 1).map((e) => e.id).join(' ')} → talk/v${n}/`);
}

/**
 * NO DEAD AIR (Collins, Oct 4 2026, of the first film acted on Seedance 2.5, which he called "like 500% better": "one
 * issue to fix and look for in future videos: there is a long period of dead space before she says 'On our planet,
 * technological and moral ...'", "and a gap before 'That would likely correlate with moral ...'"). The first was 4.9 s
 * with nobody speaking across a join (the model opens a clip with a few seconds of settling); the second 2.0 s of
 * silence between two sentences of one speech. So, at the bake, of every clip:
 *   - the head of a clip that goes on from another is cut down to TALK_LEAD_MAX before its first word;
 *   - every SILENCE (measured in the sound, not guessed from the words) longer than TALK_GAP_MAX is cut down to it, the
 *     middle of it taken out.
 * The cuts themselves are made by the editor (editorAssemble): hard, between two words. `talkcheck` lists what was found and
 * cut, and `talk` says in its prompt that the first line comes at once and no silence is long, so that less needs cutting.
 */
const TALK_LEAD_MAX = Number(process.env.CUTSCENE_TALK_LEAD_MAX || 0.5);
const TALK_GAP_MAX = Number(process.env.CUTSCENE_TALK_GAP_MAX || 0.9);
/** A cut is made only when it takes out at least this much (a dissolve for a quarter of a second saved is not worth it). */
const TALK_CUT_MIN = 0.5;

/** The silences of a clip, from its sound: stretches of half a second or more below -32 dB. */
function silencesOf(file: string): Array<[number, number]> {
  const err = ffStderr(['-i', file, '-vn', '-af', 'silencedetect=noise=-32dB:d=0.5', '-f', 'null', '-']);
  const out: Array<[number, number]> = [];
  const re = /silence_start: ([0-9.]+)[\s\S]*?silence_end: ([0-9.]+)/g;
  for (let m = re.exec(err); m; m = re.exec(err)) {
    out.push([Number(m[1]), Number(m[2])]);
  }
  return out;
}

/**
 * What is taken out of a clip (up to `end`, where it is cut): its dead head, and the middle of every over-long SILENCE
 * that lies BETWEEN TWO WORDS. How long a silence is, is measured in the sound (that is what is heard); where the cut
 * may go is bounded by the words' own times, so that no cut can touch a word: the first version merged two silences
 * that had the one-word sentence "Well." between them and cut straight through it (Collins, of 0:44 of that bake: "NOT
 * clean at all, it makes like a whooshing sound there now"). Sound between two lines (applause) is the scene, not a gap.
 */
function deadAir(film: Film, ex: Exchange, cut: TalkCut, file: string, end: number): Array<{ from: number; to: number; why: string }> {
  const out: Array<{ from: number; to: number; why: string }> = [];
  const spoken = cut.lines.filter((l) => !('missing' in l)) as Array<{ shot: string; start: number; end: number }>;
  // A clip in which nobody speaks is all scene; so is the opening shot of a clip when it has no words.
  if (!spoken.length) return out;
  const cache = file.replace(/\.mp4$/, '.words.json');
  const words: Word[] = fs.existsSync(cache) ? (JSON.parse(fs.readFileSync(cache, 'utf8')).words as Word[]).filter((w) => w.start < end) : [];
  if (!words.length) return out;
  const opens = !wordsOf(film, film.shots[ex.shots[0]]);
  const silences = silencesOf(file);
  const lineAt = (t: number) => spoken.find((l) => t >= l.start - 0.05 && t <= l.end + 0.05)?.shot ?? spoken.find((l) => l.start >= t - 0.05)?.shot ?? '';
  // The head: only of a clip that goes on from another, and not when its first shot is one in which nobody speaks.
  // (Always, however little: a clip's first frames are the model settling from the frame it was handed.)
  if (ex.from === '^' && !opens && words[0].start - TALK_LEAD_MAX >= 0.12) {
    out.push({ from: 0, to: words[0].start - TALK_LEAD_MAX, why: `${words[0].start.toFixed(1)} s before its first word (${lineAt(words[0].start)})` });
  }
  // Every gap between one word and the next: the silence inside it, cut down to TALK_GAP_MAX from its middle.
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i].end + 0.08, z = words[i + 1].start - 0.08;
    if (z - a < TALK_GAP_MAX) continue;
    // The silences inside this gap; two with only a breath or a click between them (under 0.3 s of sound) are one. A
    // longer sound between them is kept whole (an "um" the transcript did not write down is still his line).
    const inside: Array<[number, number]> = [];
    for (const [s, e] of silences) {
      const s1 = Math.max(s, a), e1 = Math.min(e, z);
      if (e1 - s1 < 0.2) continue;
      if (inside.length && s1 - inside[inside.length - 1][1] < 0.3) inside[inside.length - 1][1] = e1; else inside.push([s1, e1]);
    }
    const best = inside.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0] ?? null;
    if (!best || best[1] - best[0] < TALK_GAP_MAX + TALK_CUT_MIN) continue;
    const over = best[1] - best[0] - TALK_GAP_MAX;
    const mid = (best[0] + best[1]) / 2;
    out.push({ from: mid - over / 2, to: mid + over / 2, why: `${(best[1] - best[0]).toFixed(1)} s of silence before "${words[i + 1].w}" (${lineAt(words[i + 1].start)})` });
  }
  return out;
}

/** The stretches of a clip that are kept, in order. */
function keepRanges(film: Film, ex: Exchange, cut: TalkCut, file: string, end: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let at = 0;
  for (const d of deadAir(film, ex, cut, file, end)) {
    if (d.from > at + 0.05) out.push([at, d.from]);
    at = Math.max(at, d.to);
  }
  if (end > at + 0.05) out.push([at, end]);
  return out;
}

/**
 * THE JOIN IS MADE BY RFAB'S OWN VIDEO EDITOR (Collins, Oct 4 2026, of a bake cut and joined here with ffmpeg: "where you
 * made the cut and fix at 0:44 was NOT clean at all, it makes like a whooshing sound there now and the film blurs ...
 * look at our editing system for the rfab video editor; you should have access to tools like that with the rfab api to
 * make something like this easy; it never breaks with that"). What was wrong was all mine: a dissolve from a held frame
 * at every cut, a blur ramp at every join, a fade to nothing and back in the sound, and one cut that went through a word.
 *
 * So nothing is cut or joined here any more. The clips are uploaded as they were made (POST /api/video-editor/upload-clip),
 * and the film is one call to the editor's renderer (POST /api/video-editor/assemble-async, `preserveOrder`): a list of
 * kept ranges, each of a source clip, in order. It cuts frame-accurately and hard, picture and sound, exactly as it does
 * for every edit made in the Transcript Editor; the ranges are built as the editor builds them when it tightens a
 * pause (the cut `keep/2` after the last word and `keep/2` before the next: `keepRanges`). The job is polled
 * (GET /assemble-status/:id) and its file downloaded. Charged like any export (a few hundred tokens a minute).
 * What the API does NOT have yet (HANDOFF.md lists them as tools to build into it): finding dead air itself, an audio
 * crossfade at a cut, and an output size.
 */
async function editorAssemble(film: Film, ranges: Array<{ file: string; start: number; end: number }>, dest: string): Promise<void> {
  const urls = new Map<string, string>();
  for (const file of [...new Set(ranges.map((r) => r.file))]) {
    const side = file.replace(/\.mp4$/, '.upload.json');
    const st = fs.statSync(file);
    const had = fs.existsSync(side) ? JSON.parse(fs.readFileSync(side, 'utf8')) as { url: string; size: number; at: number } : null;
    // An upload is kept a day (the editor's own storage outlives that; the clip may be made again).
    if (had && had.size === st.size && Date.now() - had.at < 20 * 3600 * 1000) { urls.set(file, had.url); continue; }
    const url = await uploadVideo(file, `${film.id}-${path.basename(file, '.mp4')}`);
    fs.writeFileSync(side, JSON.stringify({ url, size: st.size, at: Date.now() }));
    urls.set(file, url);
  }
  const body = {
    videoUrl: urls.get(ranges[0].file),
    ranges: ranges.map((r) => ({ start: +r.start.toFixed(3), end: +r.end.toFixed(3), srcUrl: urls.get(r.file) })),
    preserveOrder: true,
    label: `Broodfall ${film.id}`,
  };
  const job = await api('/api/video-editor/assemble-async', { method: 'POST', body: JSON.stringify(body) }) as { success?: boolean; jobId?: string; error?: string; tokensCost?: number };
  if (!job.jobId) throw new Error(`the editor did not take the job: ${JSON.stringify(job).slice(0, 300)}`);
  console.log(`[talk] the editor is rendering ${ranges.length} ranges of ${urls.size} clips (job ${job.jobId}${job.tokensCost ? `, ${job.tokensCost} tokens` : ''})`);
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await api(`/api/video-editor/assemble-status/${job.jobId}`) as { stage?: string; finalUrl?: string; error?: string; percent?: number; warnings?: string[]; transitionsDegraded?: boolean };
    if (st.stage === 'done' && st.finalUrl) {
      if (st.warnings?.length) console.warn(`[talk] the editor warns: ${st.warnings.join('; ').slice(0, 300)}`);
      const r = await fetch(st.finalUrl);
      if (!r.ok) throw new Error(`downloading the render: HTTP ${r.status}`);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      return;
    }
    if (st.stage === 'failed' || st.error) throw new Error(`the editor's render failed: ${String(st.error).slice(0, 300)}`);
    if (Date.now() - t0 > 20 * 60 * 1000) throw new Error(`the editor's render did not finish in 20 minutes (stage ${st.stage})`);
  }
}

async function talkBake(film: Film) {
  const exs = exchangesOf(film);
  const missing = exs.filter((e) => !fs.existsSync(talkFile(film, e)));
  if (missing.length) { console.warn(`[talk] ${film.id}: not baked, ${missing.map((e) => e.id).join(' ')} not made`); return; }
  fs.mkdirSync(OUT, { recursive: true });
  const cues: Cue[] = [];
  const ranges: Array<{ file: string; start: number; end: number }> = [];
  let t = 0;
  for (let k = 0; k < exs.length; k++) {
    const ex = exs[k];
    const src = talkFile(film, ex);
    const cut = await talkCut(film, exs, k);
    const fps = cut.fps;
    const frames = frameCount(src);
    const goesOn = exs[k + 1]?.from === '^';
    const lastEnd = Math.max(0, ...cut.lines.filter((l) => !('missing' in l)).map((l) => (l as { end: number }).end));
    // Cut where the next clip was started from; the last clip of a place (or of the film) keeps a breath after its last word.
    const b = (goesOn ? cut.frame : Math.min(frames, Math.round((lastEnd ? lastEnd + 1.6 : duration(src)) * fps))) / fps;
    // NO DEAD AIR: the stretches of this clip that are kept (each cut between two words).
    const keep = keepRanges(film, ex, cut, src, b);
    const starts: number[] = [];
    let real = 0;
    for (const [a0, b0] of keep) { starts.push(real); real += b0 - a0; ranges.push({ file: src, start: a0, end: b0 }); }
    /** Where a moment of the clip is in the film (a moment that was taken out is where the film goes on after it). */
    const inFilm = (x: number): number => {
      for (let j = 0; j < keep.length; j++) {
        if (x < keep[j][0]) return starts[j];
        if (x <= keep[j][1]) return starts[j] + (x - keep[j][0]);
      }
      return real;
    };
    // The cues: each shot of the exchange in order; a line from the end of the one before it to midway to the next.
    const timed = ex.shots.map((i) => {
      const s = film.shots[i];
      const l = cut.lines.find((x) => x.shot === s.id);
      return { s, span: l && !('missing' in l) ? { start: inFilm(l.start), end: inFilm(l.end) } : null };
    });
    let at = 0;
    timed.forEach((x, n) => {
      const next = timed.slice(n + 1).find((y) => y.span);
      let end = n === timed.length - 1 ? real
        : x.span ? (next?.span ? (x.span.end + next.span.start) / 2 : Math.min(real, x.span.end + 0.4))
          : next?.span ? Math.max(at + 0.2, next.span.start - 0.15) : real;
      end = Math.min(real, Math.max(at + 0.2, end));
      const words = wordsOf(film, x.s);
      cues.push({ shot: x.s.id, ...(words ? { line: x.s.line, who: whoOf(film, x.s), text: words } : {}), t0: +(t + at).toFixed(3), t1: +(t + end).toFixed(3) });
      at = end;
    });
    t += real;
  }
  // The film: rendered by the editor, and put where the game reads it as it came (web-ready: its index at the front).
  const tmp = path.join(dirOf(film.id), 'bake');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const raw = path.join(tmp, 'editor.mp4');
  await editorAssemble(film, ranges, raw);
  const dest = path.join(OUT, `${film.id}.mp4`);
  ff(['-i', raw, '-c', 'copy', '-movflags', '+faststart', dest], 'web-ready');
  const real = duration(dest);
  // The cues were laid out by the ranges asked for; the render is frame-accurate, so they agree to a frame or two a cut.
  if (Math.abs(real - t) > 0.4) console.warn(`[talk] the render is ${real.toFixed(2)} s and the ranges add up to ${t.toFixed(2)} s`);
  const k = real / Math.max(0.001, t);
  for (const c of cues) { c.t0 = +(c.t0 * k).toFixed(3); c.t1 = +(c.t1 * k).toFixed(3); }
  const poster = path.join(OUT, `${film.id}.webp`);
  ff(['-ss', '1.2', '-i', dest, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '82', poster], 'poster');
  const manFile = path.join(OUT, 'scenes.json');
  const man: { films: Record<string, { video: string; poster: string; seconds: number; cues: Cue[] }> } = fs.existsSync(manFile) ? JSON.parse(fs.readFileSync(manFile, 'utf8')) : { films: {} };
  man.films[film.id] = { video: `media/scenes/${film.id}.mp4`, poster: `media/scenes/${film.id}.webp`, seconds: +real.toFixed(3), cues };
  fs.writeFileSync(manFile, JSON.stringify(man, null, 1));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`[cut] baked ${film.id}: ${film.shots.length} shots, ${ranges.length} ranges of ${exs.length} clips joined by the editor, ${real.toFixed(1)} s, ${(fs.statSync(dest).size / 1e6).toFixed(1)} MB → ${dest}`);
  // The sheet to LOOK at: the baked film itself, a frame every three seconds.
  const out = path.join(REVIEW, film.id, 'sheet.jpg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const n = Math.ceil(real / 3);
  ff(['-i', dest, '-vf', `fps=1/3,scale=480:270,tile=6x${Math.ceil(n / 6)}`, '-frames:v', '1', '-q:v', '4', out], 'sheet');
  console.log(`[talk] sheet: ${out} (a frame every 3 s, left to right, top to bottom)`);
}

// ------------------------------------------------------------------ THE SYSTEM: a film right the first time
/**
 * Collins, Oct 4 2026, of the first film acted on Seedance 2.5: "truly truly well done; we need to build a system for
 * handling videos like this and getting them right on the first try going forward". And: "feel free to try at lowest
 * quality with the next one; I usually use it and have not run into issues and it would save us a ton".
 *
 *   make <film>      (SPENDS) the whole way, one command:
 *     1. its pictures, drawn if they are not
 *     2. each exchange in order; every clip is put through THE GATES before anything is built on it, and a clip that
 *        fails is set aside (talk/rejected/) and made again, up to TALK_TRIES times
 *     3. the bake (dead air taken out), then THE FILM'S GATES
 *     4. the Desktop
 *   gates <film>     the same gates on what is already made (the vision check costs a few hundred tokens a clip)
 *
 * THE GATES are every way a take of the first film went wrong on Oct 4 2026, each as a check that needs no eye and no ear:
 *   WORDS       every line heard (80% of its words or more), in order
 *   AD-LIB      nothing much said that is not in the lines
 *   HIS VOICE   his lines in a man's pitch (a clip once gave them to her voice)
 *   HIS FACE    he is seen from behind in every frame: asked of a model that sees (rfab.ai's chat, eight frames of the clip)
 *   STATIC      no snow, sparkle or static over the picture (the same question), and its specks have not multiplied
 *   BRIGHT      the clip ends as bright as it began (a bad correction once bleached two clips)
 *   SOFT        the clip ends at least 0.45 as sharp as it was after its first second
 *   SILENCE     the clip is not mostly dead air (what there is, the bake takes out)
 * THE FILM'S GATES: every line has its cue; no silence over 1.3 s is left in it; its brightness, sharpness and specks
 * are steady from first frame to last.
 * What no gate can judge is whether the ACTING is good: that is Collins's ear, and the film is put on his Desktop.
 */
const TALK_TRIES = Number(process.env.CUTSCENE_TALK_TRIES || 3);
/** Lowest quality unless told otherwise (Collins, Oct 4 2026); `CUTSCENE_TALK_RES=720p` for the other. */
const MAKE_RES = process.env.CUTSCENE_TALK_RES || '480p';
/** The same model through two providers: when one's account is out of credits the other is tried. */
const MAKE_MODELS = process.env.CUTSCENE_TALK_MODEL ? [process.env.CUTSCENE_TALK_MODEL] : ['atlascloud:seedance-2.5-i2v', 'imagerouter:seedance-2.5-i2v'];

/** Ask a model that sees about one picture (rfab.ai's chat, which streams its answer). */
async function look(image: string, question: string): Promise<string> {
  const body = { mode: 'grok', freshEachTurn: true, messages: [{ role: 'user', content: question, attachments: [{ kind: 'image', name: 'frames.jpg', dataUrl: `data:image/jpeg;base64,${fs.readFileSync(image).toString('base64')}` }] }] };
  const r = await fetch(`${process.env.RFAB_API_BASE || 'https://api.rfab.ai'}/api/chat/based`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.RFAB_API_KEY ?? '' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`look: HTTP ${r.status}`);
  const NL = String.fromCharCode(10);
  let answer = '';
  for (const block of (await r.text()).split(NL + NL)) {
    if (!/^event: delta$/m.test(block)) continue;
    const d = (block.match(/^data: (.*)$/m) ?? [])[1];
    if (!d) continue;
    try { const j = JSON.parse(d) as { content?: string }; if (typeof j.content === 'string') answer += j.content; } catch { /* not for us */ }
  }
  return answer.trim();
}

interface Gate { gate: string; why: string }
/** Every gate a clip of an exchange must pass before the next is built on it. */
async function talkGates(film: Film, exs: Exchange[], k: number): Promise<Gate[]> {
  const ex = exs[k];
  const f = talkFile(film, ex);
  const cut = await talkCut(film, exs, k);
  const fails: Gate[] = [];
  const fail = (gate: string, why: string) => fails.push({ gate, why });
  // WORDS, HIS VOICE
  let want = 0;
  for (const l of cut.lines) {
    const s = film.shots.find((x) => x.id === l.shot)!;
    want += wordCount(wordsOf(film, s));
    if ('missing' in l) { fail('WORDS', `${l.shot} was not heard ("${wordsOf(film, s).slice(0, 50)}")`); continue; }
    // A short line is judged by the words missed, not the share: "Oh. Um." heard as "Oh." is half its words, and the
    // transcriber never writes down an "um" (delegation-reveal failed three good takes on it, Oct 5 2026).
    const n = wordCount(wordsOf(film, s));
    if (l.heard < 0.8 && Math.round(n * (1 - l.heard)) > (n <= 4 ? 1 : 0)) fail('WORDS', `${l.shot}: ${Math.round(l.heard * 100)}% of its words heard`);
    if (whoOf(film, s) === 'You') { const hz = pitchOfSpan(f, l.start, l.end); if (hz > 175) fail('HIS VOICE', `${l.shot} is at ${Math.round(hz)} Hz: not a man's voice`); }
  }
  // AD-LIB
  const said = (await hearWords(f)).words.length;
  if (want && said > want * 1.25 + 3) fail('AD-LIB', `${said} words heard for ${want} written`);
  // SILENCE
  const end = exs[k + 1]?.from === '^' ? cut.frame / cut.fps : duration(f);
  const dead = deadAir(film, ex, cut, f, end).reduce((a, d) => a + (d.to - d.from), 0);
  if (dead > end * 0.4) fail('SILENCE', `${dead.toFixed(1)} s of its ${end.toFixed(1)} s is dead air`);
  // BRIGHT, SOFT, STATIC (measured, and seen): not for a clip in which nobody speaks, whose action is the effect itself
  // ("the picture floods with red and goes to white": delegation-finale's opening failed three good takes on it).
  const wordless = !ex.shots.some((i) => wordsOf(film, film.shots[i]));
  const W = 640, H = 360;
  const first = readRgb(f, 0, W, H), settled = readRgb(f, Math.min(cut.frame, Math.round(cut.fps)), W, H), last = readRgb(f, cut.frame, W, H);
  const lum = (px: Buffer) => { let s = 0; for (let i = 0; i < px.length; i += 39) s += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; return s / Math.ceil(px.length / 39); };
  if (!wordless && Math.abs(lum(last) - lum(first)) > 14) fail('BRIGHT', `its brightness goes from ${lum(first).toFixed(0)} to ${lum(last).toFixed(0)}`);
  if (!wordless && sharpOf(last, W, H) < sharpOf(settled, W, H) * 0.45) fail('SOFT', `its sharpness falls from ${Math.round(sharpOf(settled, W, H))} to ${Math.round(sharpOf(last, W, H))}`);
  const s0 = Math.max(200, specksOf(f, 0)), s1 = specksOf(f, cut.frame);
  if (!wordless && s1 > s0 * SPECK_GROWTH) fail('STATIC', `its specks go from ${s0} to ${s1}`);
  // HIS FACE, STATIC (seen)
  const st = STILLS[stillOfShot(film, ex.shots[0])];
  const him = /HOLO|TECH/.test(st.shows);
  const strip = f.replace(/\.mp4$/, '-gate.jpg');
  const n = 8;
  ff(['-i', f, '-vf', `select='not(mod(n\\,${Math.max(1, Math.floor(cut.frame / n))}))',scale=480:270,tile=${n}x1`, '-vsync', '0', '-frames:v', '1', '-q:v', '4', strip], 'gate strip');
  const q = `These are ${n} frames of one video shot, in time order, left to right. `
    + (him ? 'A young man stands in the foreground with his back to the camera. RULE 1: he is seen from BEHIND in every frame (the back of his head; his face is not visible, not even in profile). ' : '')
    + 'RULE 2: the picture is clean in every frame: no snow, sparkles, floating specks or static over it. '
    + `Answer in exactly this form and nothing else: ${him ? 'FACE=YES or FACE=NO (YES if any of his face is visible in any frame); ' : ''}STATIC=YES or STATIC=NO; FRAMES=<the numbers of the frames that break a rule, or none>.`;
  try {
    const a = await look(strip, q);
    const frames = (a.match(/FRAMES=([^;.\n]*)/) ?? [])[1]?.trim() ?? '?';
    if (him && /FACE=YES/i.test(a)) fail('HIS FACE', `his face is seen (frames ${frames} of ${n})`);
    if (!wordless && /STATIC=YES/i.test(a)) fail('STATIC', `snow or sparkle is seen over the picture (frames ${frames} of ${n})`);
    if (!/STATIC=(YES|NO)/i.test(a)) console.warn(`[make] ${ex.id}: the vision check gave no answer ("${a.slice(0, 80)}")`);
  } catch (e) { console.warn(`[make] ${ex.id}: the vision check could not be made (${(e as Error).message.slice(0, 120)}); the measured gates stand`); }
  return fails;
}

/** The gates of a baked film. */
function filmGates(film: Film): Gate[] {
  const fails: Gate[] = [];
  const dest = path.join(OUT, `${film.id}.mp4`);
  const man = JSON.parse(fs.readFileSync(path.join(OUT, 'scenes.json'), 'utf8')).films[film.id] as { seconds: number; cues: Cue[] } | undefined;
  if (!man || !fs.existsSync(dest)) return [{ gate: 'BAKED', why: 'the film is not baked' }];
  if (man.cues.map((c) => c.shot).join(' ') !== film.shots.map((s) => s.id).join(' ')) fails.push({ gate: 'CUES', why: 'its cues are not its shots, in order' });
  // No dead air left (the last second of the film is its ending, not a gap).
  for (const [a, z] of silencesOf(dest)) if (z - a > TALK_GAP_MAX + TALK_CUT_MIN + 0.25 && z < man.seconds - 0.5) fails.push({ gate: 'SILENCE', why: `${(z - a).toFixed(1)} s of silence at ${a.toFixed(1)} s` });
  // Steady from first frame to last.
  const W = 640, H = 360;
  const at = (t: number) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', dest, '-vf', `scale=${W}:${H}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }); return Buffer.from(r.stdout.subarray(0, W * H * 3)); };
  const lum = (px: Buffer) => { let s = 0; for (let i = 0; i < px.length; i += 39) s += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; return s / Math.ceil(px.length / 39); };
  // ...within each PLACE (a ship's dark bay and a lit hall are not one picture: the first run of this gate failed a
  // film for having two places in it).
  const places: Array<[number, number]> = [];
  const talks: boolean[] = [];
  film.shots.forEach((s, i) => {
    const c = man.cues[i];
    if (!c) return;
    if (s.from !== '^' || !places.length) { places.push([c.t0, c.t1]); talks.push(!!wordsOf(film, s)); } else { places[places.length - 1][1] = c.t1; if (wordsOf(film, s)) talks[talks.length - 1] = true; }
  });
  // A place in which nobody speaks is an effect shot (a flood of red to white): its picture is meant to change.
  for (let n = places.length - 1; n >= 0; n--) if (!talks[n]) places.splice(n, 1);
  console.log(`[make] ${film.id}: ${man.seconds.toFixed(1)} s, ${places.length} place${places.length > 1 ? 's' : ''}`);
  places.forEach(([p0, p1], n) => {
    const m = Math.min(1, (p1 - p0) / 4);
    const frames = Array.from({ length: 7 }, (_, i) => p0 + m + (p1 - p0 - 2 * m) * i / 6).map(at);
    const b = frames.map(lum), sh = frames.map((p) => sharpOf(p, W, H));
    if (Math.max(...b) - Math.min(...b) > 14) fails.push({ gate: 'BRIGHT', why: `place ${n + 1}: its brightness runs from ${Math.min(...b).toFixed(0)} to ${Math.max(...b).toFixed(0)}` });
    const mid = [...sh].sort((x, y) => x - y)[sh.length >> 1];
    if (Math.min(...sh) < mid * 0.5) fails.push({ gate: 'SOFT', why: `place ${n + 1}: its sharpness falls to ${Math.round(Math.min(...sh))} (its middle is ${Math.round(mid)})` });
    console.log(`[make]    place ${n + 1} (${p0.toFixed(1)}-${p1.toFixed(1)} s): brightness ${Math.min(...b).toFixed(0)}-${Math.max(...b).toFixed(0)}; sharpness ${Math.round(Math.min(...sh))}-${Math.round(Math.max(...sh))}`);
  });
  return fails;
}

/**
 * THE FILM'S WORDS: the baked film itself is heard, and every line of the scene must be in it, in order (a cut that
 * took a word with it shows here: one did, on Oct 4 2026).
 */
async function filmWords(film: Film): Promise<Gate[]> {
  const dest = path.join(OUT, `${film.id}.mp4`);
  const wav = path.join(dirOf(film.id), 'film.wav');
  ff(['-i', dest, '-vn', '-ac', '1', '-ar', '16000', wav], 'wav');
  const r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(wav).toString('base64') }) });
  fs.rmSync(wav, { force: true });
  const words: Word[] = ((r.words ?? []) as Array<{ word?: string; punctuated_word?: string; text?: string; start: number; end: number }>)
    .map((x) => ({ w: norm(String(x.word ?? x.punctuated_word ?? x.text ?? ''))[0] ?? '', start: x.start, end: x.end })).filter((x) => x.w);
  const spoken = film.shots.filter((s) => wordsOf(film, s));
  const spans = alignLines(spoken.map((s) => wordsOf(film, s)), words);
  const fails: Gate[] = [];
  spans.forEach((sp, i) => {
    if (!sp) fails.push({ gate: 'WORDS', why: `${spoken[i].id} is not heard in the film ("${wordsOf(film, spoken[i]).slice(0, 40)}")` });
    else if (sp.heard < 0.8) fails.push({ gate: 'WORDS', why: `${spoken[i].id}: ${Math.round(sp.heard * 100)}% of its words heard in the film` });
  });
  console.log(`[make] the film, heard: ${spans.filter(Boolean).length} of ${spoken.length} lines, the lowest ${Math.round(100 * Math.min(1, ...spans.map((x) => x?.heard ?? 0)))}%`);
  return fails;
}

/** The gates on what is made (no clip is made). */
async function gates(film: Film): Promise<boolean> {
  const exs = exchangesOf(film);
  let ok = true;
  for (let k = 0; k < exs.length; k++) {
    if (!fs.existsSync(talkFile(film, exs[k]))) { console.log(`   ${exs[k].id} not made`); ok = false; continue; }
    const fails = await talkGates(film, exs, k);
    console.log(`   ${exs[k].id} ${fails.length ? `FAILS: ${fails.map((x) => `${x.gate} (${x.why})`).join('; ')}` : 'passes every gate'}`);
    if (fails.length) ok = false;
  }
  const ff_ = [...filmGates(film), ...await filmWords(film)];
  console.log(`   the film ${ff_.length ? `FAILS: ${ff_.map((x) => `${x.gate} (${x.why})`).join('; ')}` : 'passes its gates'}`);
  return ok && ff_.length === 0;
}

async function make(film: Film) {
  const exs = exchangesOf(film);
  const secs = exs.reduce((a, e) => a + talkSecs(film, e), 0);
  console.log(`[make] ${film.id}: ${exs.length} exchange${exs.length > 1 ? 's' : ''}, about ${secs} s at ${MAKE_RES} on ${MAKE_MODELS[0]} (${exs.map((e) => `${e.id}=${talkSecs(film, e)}s`).join(' ')})`);
  await stills(film);
  fs.mkdirSync(talkDir(film), { recursive: true });
  const report: string[] = [];
  for (let k = 0; k < exs.length; k++) {
    const ex = exs[k];
    const out = talkFile(film, ex);
    for (let attempt = 1; ; attempt++) {
      if (!fs.existsSync(out)) {
        let start: string;
        if (ex.from === '^') start = await talkStartFrame(film, exs, k);
        else { if (!fs.existsSync(stillFile(ex.from))) throw new Error(`${ex.id}: its picture ${ex.from} is not drawn`); start = still169(ex.from); }
        const prompt = talkPrompt(film, ex);
        await makeClip({ slug: `talk-${film.id}-${ex.id}`, stillFile: start, out, models: MAKE_MODELS, prompt, seconds: talkSecs(film, ex), loop: false, raw: true, resolution: MAKE_RES, aspect: '16:9', audio: true });
        fs.writeFileSync(out.replace(/\.mp4$/, '.txt'), `${ex.shots.map((i) => film.shots[i].id).join(' ')}\n---\n${prompt}\n`);
      }
      const fails = await talkGates(film, exs, k);
      if (!fails.length) { report.push(`${ex.id}: passed every gate${attempt > 1 ? ` on try ${attempt}` : ' first time'}`); console.log(`[make] ${ex.id}: passes every gate${attempt > 1 ? ` (try ${attempt})` : ''}`); break; }
      console.warn(`[make] ${ex.id}: try ${attempt} FAILS: ${fails.map((x) => `${x.gate} (${x.why})`).join('; ')}`);
      if (attempt >= TALK_TRIES) { report.push(`${ex.id}: FAILED ${TALK_TRIES} times: ${fails.map((x) => x.gate).join(', ')}`); console.error(`[make] ${film.id} stops at ${ex.id}: it failed its gates ${TALK_TRIES} times. Look at ${out}.`); console.log(report.join('\n')); return; }
      // Set the failed clip aside, with why, and make it again (nothing was built on it).
      const rej = path.join(talkDir(film), 'rejected');
      fs.mkdirSync(rej, { recursive: true });
      const base = out.replace(/\.mp4$/, '');
      for (const g of [`${base}.mp4`, `${base}.json`, `${base}.txt`, `${base}.cut.json`, `${base}.words.json`, `${base}-gate.jpg`]) if (fs.existsSync(g)) fs.renameSync(g, path.join(rej, `${path.basename(g).replace(ex.id, `${ex.id}-try${attempt}`)}`));
      fs.writeFileSync(path.join(rej, `${ex.id}-try${attempt}.why.txt`), fails.map((x) => `${x.gate}: ${x.why}`).join('\n'));
    }
  }
  await talkBake(film);
  const ff_ = [...filmGates(film), ...await filmWords(film)];
  console.log(`[make] the film ${ff_.length ? `FAILS: ${ff_.map((x) => `${x.gate} (${x.why})`).join('; ')}` : 'passes its gates'}`);
  for (let k = 0; k < exs.length; k++) talkDeadAir(film, exs, k, await talkCut(film, exs, k));
  // (Not copied to his Desktop: the film is in the game, public/media/scenes/. Collins, Oct 5 2026: "why are they on my
  // desktop?". `desk <film>` still does it when asked.)
  console.log(report.join('\n'));
}

/** Every shot as three frames (start, middle, end) with its id: LOOK at it. */
function sheet(film: Film) {
  const tmp = path.join(dirOf(film.id), 'sheet');
  fs.mkdirSync(tmp, { recursive: true });
  const rows: string[] = [];
  for (const s of film.shots) {
    const f = clipFile(film.id, s.id);
    if (!fs.existsSync(f)) continue;
    const d = duration(f);
    const frames = [0.15, d / 2, Math.max(0.2, d - 0.25)].map((tt, i) => {
      const o = path.join(tmp, `${s.id}-${i}.png`);
      ff(['-ss', tt.toFixed(2), '-i', f, '-frames:v', '1', '-vf', 'scale=480:270', o], 'frame');
      return o;
    });
    const row = path.join(tmp, `${s.id}-row.png`);
    ff([...frames.flatMap((x) => ['-i', x]), '-filter_complex', 'hstack=inputs=3', row], 'row');
    rows.push(row);
  }
  if (!rows.length) { console.warn('[cut] no clips for a sheet'); return; }
  const half = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, half), rows.slice(half)].filter((c) => c.length);
  const colFiles = cols.map((c, i) => {
    const o = path.join(tmp, `col${i}.png`);
    const pad = c.length < half ? `[v]pad=iw:ih+${(half - c.length) * 270}:0:0:black[o]` : '[v]null[o]';
    ff([...c.flatMap((x) => ['-i', x]), '-filter_complex', `${c.map((_, k) => `[${k}:v]`).join('')}vstack=inputs=${c.length}[v];${pad}`, '-map', '[o]', o], 'col');
    return o;
  });
  const out = path.join(REVIEW, film.id, 'sheet.jpg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  ff([...colFiles.flatMap((x) => ['-i', x]), '-filter_complex', colFiles.length > 1 ? 'hstack=inputs=2,scale=iw*0.75:-2' : 'scale=iw*0.75:-2', '-q:v', '4', out], 'sheet');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`[cut] sheet: ${out} (rows, top to bottom then the second column: ${film.shots.filter((s) => fs.existsSync(clipFile(film.id, s.id))).map((s) => s.id).join(' ')})`);
}

/**
 * A baked film put where Collins looks (his Desktop): the film as the game plays it, a copy with the words burned in
 * (the game sets them in type; a player outside the game does not), and the sheet of its shots.
 */
function desk(film: Film) {
  const src = path.join(OUT, `${film.id}.mp4`);
  const manFile = path.join(OUT, 'scenes.json');
  if (!fs.existsSync(src) || !fs.existsSync(manFile)) { console.warn(`[cut] ${film.id} is not baked`); return; }
  const cues = (JSON.parse(fs.readFileSync(manFile, 'utf8')).films[film.id]?.cues ?? []) as Cue[];
  const ts = (x: number) => `${String(Math.floor(x / 3600)).padStart(2, '0')}:${String(Math.floor((x % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')},${String(Math.round((x % 1) * 1000)).padStart(3, '0')}`;
  const NL = String.fromCharCode(10);
  const srt = cues.filter((c) => c.text).map((c, i) => [String(i + 1), `${ts(c.t0 + 0.05)} --> ${ts(c.t1 - 0.05)}`, `${(c.who === 'You' ? 'YOU' : (c.who ?? '').toUpperCase())}: ${c.text}`, ''].join(NL)).join(NL);
  fs.mkdirSync(dirOf(film.id), { recursive: true });
  fs.writeFileSync(path.join(dirOf(film.id), 'film.srt'), srt);
  const dir = path.join(os.homedir(), 'Desktop', 'Broodfall cut scenes');
  fs.mkdirSync(dir, { recursive: true });
  const who = { delegation: 'Delegation', faithful: 'Faithful', institute: 'Institute', roach: 'Roach King' }[film.faction];
  const name = `${String(FILMS.indexOf(film) + 1).padStart(2, '0')} ${who} - ${sceneOf(film).title.replace(/[^A-Za-z0-9 ,']/g, '')}`;
  fs.copyFileSync(src, path.join(dir, `${name}.mp4`));
  // The words burned into a copy: only when asked for (`desk <film> words`). Collins, Oct 4 2026: "the words over the
  // screen look dumb, I don't think we need that".
  if (only.includes('words')) {
    // The subtitles filter takes a path relative to where ffmpeg runs (a drive letter's colon breaks its option syntax).
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf', "subtitles=film.srt:force_style='FontName=Georgia,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=28'",
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'copy', '-movflags', '+faststart', path.join(dir, `${name} (with the words).mp4`)], { cwd: dirOf(film.id), encoding: 'utf8' });
    if (r.status !== 0) console.warn(`[cut] the copy with the words failed: ${(r.stderr || '').slice(0, 300)}`);
  } else fs.rmSync(path.join(dir, `${name} (with the words).mp4`), { force: true });
  const sheetFile = path.join(REVIEW, film.id, 'sheet.jpg');
  if (fs.existsSync(sheetFile)) fs.copyFileSync(sheetFile, path.join(dir, `${name} - every shot.jpg`));
  console.log(`[cut] on the Desktop: ${path.join(dir, name)}.mp4 (and "every shot"${only.includes('words') ? ', and "with the words"' : ''})`);
}

function list() {
  for (const f of FILMS) {
    const st = stillsOf(f);
    const made = f.shots.filter((s) => fs.existsSync(clipFile(f.id, s.id))).length;
    const drawn = st.filter((id) => fs.existsSync(stillFile(id))).length;
    const baked = fs.existsSync(path.join(OUT, `${f.id}.mp4`));
    const secs = f.shots.reduce((a, s) => a + (wordsOf(f, s) ? secsFor(wordsOf(f, s)) : s.secs ?? 6), 0);
    console.log(`${f.id.padEnd(24)} ${String(f.shots.length).padStart(2)} shots (${made} made)  ${String(st.length).padStart(2)} stills (${drawn} drawn)  ~${secs} s of clips  ${baked ? 'BAKED' : ''}`);
  }
}

// Run as a tool (not when a test imports its helpers).
if (!process.env.VITEST) {
  (async () => {
    if (step === 'list') { list(); return; }
    const film = FILMS.find((f) => f.id === filmId);
    if (!film) { console.error(`no film "${filmId}" (films: ${FILMS.map((f) => f.id).join(', ')})`); process.exit(1); }
    const paid = step === 'stills' || step === 'clips' || step === 'check' || step === 'talk' || step === 'make' || step === 'gates';
    const before = paid ? await balance() : 0;
    if (step === 'stills') await stills(film);
    else if (step === 'clips') await clips(film);
    else if (step === 'redo') redo(film);
    // A film as acted exchanges (several lines a clip, on a model that talks).
    else if (step === 'talk') await talk(film);
    else if (step === 'talkcheck') await talkCheck(film);
    else if (step === 'talkredo') talkRedo(film);
    // Free: the frame an exchange would start from (the one before it at its cut: colour and sharpness held, drift out), to look at.
    else if (step === 'talkstart') { const exs = exchangesOf(film); for (const id of only) { const k = exs.findIndex((e) => e.id === id); if (k > 0) console.log(await talkStartFrame(film, exs, k)); } }
    else if (step === 'talkbake') await talkBake(film);
    // THE SYSTEM: one command, gated (and the gates alone, on what is made).
    else if (step === 'make') await make(film);
    else if (step === 'gates') await gates(film);
    else if (step === 'talkprompts') exchangesOf(film).forEach((ex) => console.log(`--- ${ex.id} [${ex.shots.map((i) => film.shots[i].id).join(' ')}] ${talkSecs(film, ex)} s from ${ex.from}\n${talkPrompt(film, ex)}\n`));
    // Free: the frame a shot would start from (the shot before it at its cut, colour held, specks out), to look at.
    else if (step === 'start') for (const id of only) { const i = film.shots.findIndex((x) => x.id === id); if (i > 0) console.log(await cutFrame(film, i - 1, path.join(dirOf(film.id), `${id}-start.png`))); }
    else if (step === 'check') await check(film);
    else if (step === 'bake') bake(film);
    else if (step === 'sheet') sheet(film);
    else if (step === 'desk') desk(film);
    else if (step === 'review') review(film);
    else if (step === 'prompts') film.shots.forEach((s, i) => console.log(`--- ${s.id}\n${clipPrompt(film, i)}\n`));
    else if (step === 'stillprompts') stillsOf(film).forEach((id) => console.log(`--- ${id} [${STILLS[id].refs.join(', ')}]\n${stillPrompt(id)}\n`));
    else { console.error(`unknown step ${step}`); process.exit(1); }
    if (paid) { const after = await balance(); console.log(`[cut] spent ${before - after} tokens (about $${((before - after) / 50000).toFixed(2)}; other sessions' spending may be in it)`); }
  })();
}
