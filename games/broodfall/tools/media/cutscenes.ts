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
 *   npx vite-node tools/media/cutscenes.ts -- desk <film>          the baked film to the Desktop: as it is, with the words burned in, and its sheet (free)
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
import { makeClip, makeStill, pool } from '../art/rfab.mjs';
import { ROOT, api, assertSpeakable, balance, duration, ff, ffStderr, speechSpan } from './lib.mjs';
import { CLEAN, CONCEPTS, CROWD, LEADER_REF, WHO } from './prompts.mjs';
import { FILMS, STILLS, type Film, type FilmLook, type FilmShot } from '../../content/cutscenes';
import { FACTIONS, type FactionId, type Scene } from '../../content/campaign';
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
  throw new Error(`no scene of content/campaign.ts names the film ${film.id}`);
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

const factionOfStill = (id: string): FactionId | null => FILMS.find((f) => f.shots.some((s) => s.from === id) && STILLS[id].refs.includes('leader'))?.faction ?? FILMS.find((f) => f.shots.some((s) => s.from === id))?.faction ?? null;

function stillPrompt(id: string): string {
  const st = STILLS[id];
  const fac = factionOfStill(id);
  const ord = (r: string) => ORD[st.refs.indexOf(r)] ?? 'first';
  let shows = st.shows;
  const holo = shows.includes('HOLO');
  const him = `the young man of the ${ord('hero')} reference picture (seen from behind as he is there, so that only the back of his head is seen and never his face: ${BACK}; his hands empty)`;
  if (fac) shows = shows.replace(/WHO/g, WHO[fac].replace('the reference picture', `the ${ord('leader')} reference picture`));
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
const refFile = (r: string, fac: FactionId | null) => (r === 'hero' ? HERO : r === 'leader' ? png(LEADER_REF(fac ?? 'delegation')) : stillFile(r));
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
const VOICES: Record<string, string> = {
  'You': 'He speaks English in a mild, earnest young man\'s voice: a light, clear tenor, soft-spoken and thoughtful, a little dry, with a neutral American accent. It is always exactly this same voice.',
  'Delegate': 'She speaks English in a warm, bright, elderly woman\'s voice, gentle and delighted, like a kindly retired schoolteacher, with a soft mid-Atlantic accent of the 1950s. It is always exactly this same voice.',
  'The Voice': 'He speaks English in the booming, fervent, gravelly baritone of an American radio evangelist of the 1950s, about sixty, rolling and rising like a preacher. It is always exactly this same voice.',
  'The Director': 'He speaks English in a fast, lazy, confident young man\'s voice, a nasal Californian drawl, always amused with himself. It is always exactly this same voice.',
};
const SUBJECT: Record<string, [string, string]> = {
  'Delegate': ['The chief delegate, the elderly insect woman in the cardigan and the flower garland,', 'Her small mandibles move like a mouth with her words.'],
  'The Voice': ['The preacher in the black robes', 'His small mandibles move like a mouth with his words.'],
  'The Director': ['The lanky young insect man in the grey t-shirt', 'His small mandibles move like a mouth with his words.'],
};
/** He is seen from behind, always (Collins, Oct 4 2026). */
const BEHIND = 'The young man keeps his back to the camera in every frame: his face is never seen, and he never turns round.';
function tail(look: FilmLook, holo: boolean, him: boolean): string {
  const cam = 'One continuous shot, no cuts; the camera does not move at all.';
  if (look === 'ship') return `${cam} He is alone. ${BEHIND} He keeps the same dark messy hair and the same black tunic in every frame; nothing morphs. No text appears on screen. No music, no subtitles.`;
  if (look === 'call') return `${cam} ${BEHIND} The screen stays where it is, and the insect people on it keep their insect heads, exactly four arms and the same clothes in every frame; nothing morphs or duplicates. No text appears on screen. No music, no subtitles.`;
  return `${cam} It keeps the same film look and grain throughout. The insect people keep their insect heads, exactly four arms and the same clothes in every frame; nothing morphs or duplicates. `
    + (holo ? `The young man stays a translucent pale blue hologram of light in every frame, and never becomes solid. ${BEHIND} ` : him ? `${BEHIND} ` : '')
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
    const hush = st.look === 'ship' ? '' : `The insect people${st.look === 'call' ? ' on the screen' : ''} listen in silence, their mandibles closed and still: none of them speaks.`;
    return `${s.action} ${he}, his back to the camera, says: "${spoken}" ${VOICES.You} ${hush} ${t}`.replace(/\s+/g, ' ');
  }
  const [subject, mouth] = SUBJECT[who] ?? ['The speaker', ''];
  const hush = him ? 'The young man says nothing and stays as he is, his back to the camera.' : '';
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
  const n = Math.max(1, px.length / 3);
  const mean = [0, 0, 0], sd = [0, 0, 0];
  for (let i = 0; i + 2 < px.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += px[i + c];
  for (let c = 0; c < 3; c++) mean[c] /= n;
  for (let i = 0; i + 2 < px.length; i += 3) for (let c = 0; c < 3; c++) sd[c] += (px[i + c] - mean[c]) ** 2;
  return { mean, sd: sd.map((x) => Math.sqrt(x / n)) };
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
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
  ff(['-i', f, '-vf', `select=eq(n\\,${frame}),${lut(fix ?? NO_FIX)},scale=1280:720`, '-frames:v', '1', '-update', '1', out], 'the frame at the cut');
  return out;
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
  const who = { delegation: 'Delegation', faithful: 'Faithful', institute: 'Institute' }[film.faction];
  const name = `${String(FILMS.indexOf(film) + 1).padStart(2, '0')} ${who} - ${sceneOf(film).title.replace(/[^A-Za-z0-9 ,']/g, '')}`;
  fs.copyFileSync(src, path.join(dir, `${name}.mp4`));
  // The subtitles filter takes a path relative to where ffmpeg runs (a drive letter's colon breaks its option syntax).
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf', "subtitles=film.srt:force_style='FontName=Georgia,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=28'",
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'copy', '-movflags', '+faststart', path.join(dir, `${name} (with the words).mp4`)], { cwd: dirOf(film.id), encoding: 'utf8' });
  if (r.status !== 0) console.warn(`[cut] the copy with the words failed: ${(r.stderr || '').slice(0, 300)}`);
  const sheetFile = path.join(REVIEW, film.id, 'sheet.jpg');
  if (fs.existsSync(sheetFile)) fs.copyFileSync(sheetFile, path.join(dir, `${name} - every shot.jpg`));
  console.log(`[cut] on the Desktop: ${path.join(dir, name)}.mp4 (and "with the words", and "every shot")`);
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
    const paid = step === 'stills' || step === 'clips' || step === 'check';
    const before = paid ? await balance() : 0;
    if (step === 'stills') await stills(film);
    else if (step === 'clips') await clips(film);
    else if (step === 'redo') redo(film);
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
