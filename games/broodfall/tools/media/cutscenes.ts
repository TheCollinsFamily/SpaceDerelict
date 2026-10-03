/**
 * THE CUT SCENES, MADE AND BAKED AS FILMS (Oct 3 2026; content/cutscenes.ts has the shot lists, content/campaign.ts the words).
 *
 *   npx vite-node tools/media/cutscenes.ts -- list                 every film: shots, pictures, what is made, what it would cost
 *   npx vite-node tools/media/cutscenes.ts -- stills <film>        the pictures its shots start from (LOOK: notes/art-review/cutscenes/<film>/)
 *   npx vite-node tools/media/cutscenes.ts -- clips <film> [shots] one clip per shot, image-to-video WITH SOUND (the speaker says the line)
 *   npx vite-node tools/media/cutscenes.ts -- check <film>         every clip transcribed against its line; each speaker's pitch across the film
 *   npx vite-node tools/media/cutscenes.ts -- bake <film>          public/media/scenes/<film>.mp4 + poster + cues in scenes.json (free)
 *   npx vite-node tools/media/cutscenes.ts -- sheet <film>         every shot as three frames, to look at (free)
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
const HERO = path.join(CONCEPTS, 'r4-hero-portrait.png');
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
  feed: 'A film still from a 1950s colour science-fiction film, in a wide 16:9 frame: saturated Technicolor, theatrical light, a studio set, film grain. It is the picture a fixed camera on a desk sends on a video call: a slightly wide lens at eye level, the person nearest it looking straight into the lens.',
  archive: 'A film still from a 1950s colour science-fiction film, a dream sequence, in a wide 16:9 frame: saturated Technicolor, radiant soft golden light, painted backdrops, film grain, the softness of old lenses.',
  ship: `Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set, natural film grain, in a wide 16:9 frame. Aboard ${SHIP}.`,
};
const ORD = ['first', 'second', 'third', 'fourth'];
const MAN = 'about twenty-five, slight, with short dark messy hair and a pale stylus tucked behind his right ear, in a plain black high-collared tunic with a narrow white collar, its sleeves pushed up to the elbows';
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
  if (fac) shows = shows.replace(/WHO/g, WHO[fac].replace('the reference picture', `the ${ord('leader')} reference picture`));
  shows = shows.replace(/HOLO/g, `a life-size hologram of exactly the young man in the ${ord('hero')} reference picture (the same face; ${MAN}): he is made of pale blue-white light, translucent so that the room shows faintly through him, with fine horizontal scan lines and a soft glow at his edges; his face, hair and clothes are all the same pale blue light; his hands are empty and he carries nothing`);
  shows = shows.replace(/TECH/g, `exactly the young man in the ${ord('hero')} reference picture, the same face: ${MAN}; his hands are empty and he carries nothing`);
  if (st.look === 'ship') return `${LOOKS.ship} ${shows} He is alone: nobody else is in the picture. ${NO_TEXT}`;
  const cast = holo
    ? `Every other person in the picture is one of the ${CROWD}. Each has exactly four arms and two legs, never more. The hologram is the only human being in the picture.`
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
  'You': ['The young man', ''],
  'Delegate': ['The chief delegate, the elderly insect woman in the cardigan and the flower garland,', 'Her small mandibles move like a mouth with her words.'],
  'The Voice': ['The preacher in the black robes', 'His small mandibles move like a mouth with his words.'],
  'The Director': ['The lanky young insect man in the grey t-shirt', 'His small mandibles move like a mouth with his words.'],
};
function tail(look: FilmLook, holo: boolean): string {
  if (look === 'ship') return 'One continuous shot, no cuts, the camera almost still. He is alone, and only he speaks. He keeps the same face, the same dark messy hair and the same black tunic in every frame; nothing morphs. No text appears on screen. No music, no subtitles.';
  return 'One continuous shot, no cuts, the camera almost still. Only this one person speaks; nobody else says a word. It keeps the same film look and grain throughout. '
    + 'The insect people keep their insect heads, exactly four arms and the same clothes in every frame; nothing morphs or duplicates. '
    + (holo ? 'The young man stays a translucent pale blue hologram of light in every frame, and never becomes solid. ' : '')
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
  const t = tail(st.look, holo);
  const words = wordsOf(film, s);
  if (!words) return `${s.action} Nobody speaks: not a word is said. ${s.sound ? `Heard: ${s.sound}. ` : ''}${t.replace('Only this one person speaks; nobody else says a word. ', '').replace('He is alone, and only he speaks. ', 'He is alone. ')}`;
  const who = whoOf(film, s);
  const [subject, mouth] = SUBJECT[who] ?? ['The speaker', ''];
  const spoken = words.replace(/\b[A-Z]{2,}\b/g, (w) => (w === 'AI' ? w : w.toLowerCase()));
  const sub = who === 'You' && holo ? 'The hologram of the young man' : subject;
  return `${s.action} ${sub} says: "${assertSpeakable(spoken)}" ${mouth} ${VOICES[who] ?? ''} ${t}`.replace(/\s+/g, ' ');
}

function lastFrame(clip: string, out: string): string {
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(clip).mtimeMs) return out;
  ff(['-sseof', '-0.12', '-i', clip, '-frames:v', '1', '-update', '1', '-vf', 'scale=1280:720', out], 'last frame');
  return out;
}

async function clips(film: Film) {
  fs.mkdirSync(dirOf(film.id), { recursive: true });
  const todo = (chained: boolean) => film.shots.map((s, i) => ({ s, i })).filter(({ s }) => want(s.id) && (s.from === '^') === chained && !fs.existsSync(clipFile(film.id, s.id)));
  const make = ({ s, i }: { s: FilmShot; i: number }) => {
    const words = wordsOf(film, s);
    const start = s.from === '^' ? lastFrame(clipFile(film.id, film.shots[i - 1].id), path.join(dirOf(film.id), `${s.id}-start.png`)) : still169(s.from);
    return makeClip({
      slug: `cut-${film.id}-${s.id}`, stillFile: start, out: clipFile(film.id, s.id), models: [VIDEO_MODEL], prompt: clipPrompt(film, i),
      seconds: words ? secsFor(words) : s.secs ?? 6, loop: false, raw: true, resolution: '720p', aspect: '16:9', audio: true,
    }).then((f: string) => { fs.writeFileSync(f.replace(/\.mp4$/, '.txt'), `${words}\n---\n${clipPrompt(film, i)}\n`); return f; });
  };
  const first = todo(false).filter(({ s }) => fs.existsSync(stillFile(s.from)));
  console.log(`[cut] ${film.id}: ${first.length} clips to make on ${VIDEO_MODEL}`);
  const res = await pool(first, 4, make);
  res.forEach((r: { ok: boolean; error?: Error }, k: number) => { if (!r.ok) console.warn(`[cut] clip ${first[k].s.id} failed: ${r.error!.message.slice(0, 300)}`); });
  // A shot that continues the one before it starts from that clip's last frame: made in order, after it.
  for (const job of todo(true)) {
    if (!fs.existsSync(clipFile(film.id, film.shots[job.i - 1].id))) { console.warn(`[cut] ${job.s.id}: the shot before it is not made yet`); continue; }
    try { await make(job); } catch (e) { console.warn(`[cut] clip ${job.s.id} failed: ${(e as Error).message.slice(0, 300)}`); }
  }
}

/** Move a clip aside (v1/, v2/ ...) so that `clips` makes it again. */
function redo(film: Film) {
  for (const s of film.shots) {
    if (!only.includes(s.id)) continue;
    const f = clipFile(film.id, s.id);
    if (!fs.existsSync(f)) continue;
    let n = 1;
    while (fs.existsSync(path.join(dirOf(film.id), `v${n}`, `${s.id}.mp4`))) n++;
    fs.mkdirSync(path.join(dirOf(film.id), `v${n}`), { recursive: true });
    for (const ext of ['.mp4', '.json', '.txt']) if (fs.existsSync(f.replace(/\.mp4$/, ext))) fs.renameSync(f.replace(/\.mp4$/, ext), path.join(dirOf(film.id), `v${n}`, `${s.id}${ext}`));
    console.log(`[cut] ${film.id}/${s.id} → v${n}/`);
  }
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
    const flags = [r.line && r.heard < 0.85 ? 'WORDS' : '', r.line && r.extra > 0.25 ? 'EXTRA' : '', !r.line && r.said ? 'SPEAKS' : '', Math.abs(r.off ?? 0) > 0.2 ? 'VOICE' : ''].filter(Boolean);
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
    const words = wordsOf(film, s);
    let a = 0.08, b = d;
    if (words) {
      // Cut to the words: a beat before them, and a beat after (longer when the next shot goes on from this one's last frame).
      // By the transcript's own word times (a room that claps or murmurs fools a loudness threshold); by loudness when it was not heard.
      // The start is the earlier of the two (the transcript drops an "um"; the loudness does not).
      const ws = wordSpan(src);
      const es = speechSpan(src);
      const sp = ws ? { start: es ? Math.min(ws.start, es.start) : ws.start, end: ws.end } : es;
      const next = film.shots[i + 1];
      if (sp) { a = Math.max(0.08, sp.start - 0.3); b = next?.from === '^' ? d : Math.min(d, sp.end + 0.45); }
      if (b - a < 1.4) { a = Math.max(0.08, Math.min(a, d - 1.4)); b = Math.min(d, a + 1.4); }
    }
    const part = path.join(tmp, `${String(i).padStart(2, '0')}-${s.id}.mp4`);
    const ln = loudnorm(src, a, b, words ? -16 : -24);
    const len = b - a;
    const af = [ln, `afade=t=in:d=0.04`, `afade=t=out:st=${Math.max(0, len - 0.06).toFixed(3)}:d=0.06`].filter(Boolean).join(',');
    ff(['-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', src, '-vf', 'scale=1280:720,fps=24,format=yuv420p', '-af', `${af},aresample=48000`, '-ac', '2',
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
    else if (step === 'review') review(film);
    else if (step === 'prompts') film.shots.forEach((s, i) => console.log(`--- ${s.id}\n${clipPrompt(film, i)}\n`));
    else if (step === 'stillprompts') stillsOf(film).forEach((id) => console.log(`--- ${id} [${STILLS[id].refs.join(', ')}]\n${stillPrompt(id)}\n`));
    else { console.error(`unknown step ${step}`); process.exit(1); }
    if (paid) { const after = await balance(); console.log(`[cut] spent ${before - after} tokens (about $${((before - after) / 50000).toFixed(2)}; other sessions' spending may be in it)`); }
  })();
}
