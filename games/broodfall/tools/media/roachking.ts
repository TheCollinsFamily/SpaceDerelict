/**
 * THE ROACH KING, MADE AND BAKED (Oct 1 2026; content/roachKing.ts, content/lore/roach-king.md).
 *
 *   npx vite-node tools/media/roachking.ts -- flag            the flag: flat (for the screens) and on cloth (for the films)
 *   npx vite-node tools/media/roachking.ts -- stills [ids]    the pictures his clips start from (LOOK: notes/art-review/roach/)
 *   npx vite-node tools/media/roachking.ts -- clips [ids]     every shot: image-to-video WITH SOUND (he speaks on camera)
 *   npx vite-node tools/media/roachking.ts -- check           what each clip says (transcribed) against its line
 *   npx vite-node tools/media/roachking.ts -- bake            public/media/roach/ + roach.json (free)
 *   npx vite-node tools/media/roachking.ts -- sheet           the contact sheet: notes/screens/2026-10-01/roach-king-sheet.jpg (free)
 *
 * SPENDS RFab tokens (RFAB_API_KEY): a still ~$0.45 (high), a spoken clip on Veo 3.1 Lite i2v ~$0.3-0.6.
 * Every step skips a file already on disk: to make one again, MOVE its raw file into v1/ beside it (never delete).
 *
 * Raw files: art-src-new/roach/ (git-ignored). NOT art-src/: that folder was emptied on Oct 1 2026 and is being
 * recovered; nothing here reads or writes it, and this bake touches only public/media/roach/ (never media.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill, pool } from '../art/rfab.mjs';
import { ROOT, api, assertSpeakable, balance, duration, ff, ffStderr } from './lib.mjs';
import { ROACH_ADDRESSES, ROACH_STILLS, type RoachShot } from '../../content/roachKing';

const RAW = path.join(ROOT, 'art-src-new', 'roach');
const OUT = path.join(ROOT, 'public', 'media', 'roach');
const REVIEW = path.join(ROOT, 'notes', 'art-review', 'roach');
const SHEET = path.join(ROOT, 'notes', 'screens', '2026-10-01', 'roach-king-sheet.jpg');
const D = { flag: path.join(RAW, 'flag'), stills: path.join(RAW, 'stills'), clips: path.join(RAW, 'clips'), words: path.join(RAW, 'words') };
const VIDEO_MODEL = process.env.ROACH_VIDEO_MODEL || 'imagerouter:veo-3.1-lite-i2v';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const step = argv[0] ?? 'bake';
const only = argv.slice(1);
const want = (id: string) => !only.length || only.includes(id);

// ------------------------------------------------------------------ the words of every picture
const FLAG =
  'the flag of their country, laid out exactly like the flag of Texas: a deep blue vertical band at the hoist, one third ' +
  'of the width, and two equal horizontal stripes filling the rest, white above and red below; in the middle of the blue ' +
  'band, where the lone star would be, a simple bold white silhouette of a cockroach head seen from the front, with two ' +
  'long antennae curving up and out';
const HIM =
  'the President: a huge, broad-shouldered, barrel-chested cockroach-man, an insect person like those of a 1950s ' +
  'science-fiction film, with human posture, two legs and exactly four thick muscular arms with small hands; a glossy ' +
  'chestnut-brown cockroach head with a wide shiny shield over the top of it like a helmet brim, two very long whip-like ' +
  'antennae, large amber eyes and small mandibles like a mouth, a cocky grin. He wears an open dark green military dress ' +
  'coat heavy with gold braid and gold epaulettes over a sweat-stained white tank top, an enormous gold wrestling ' +
  `championship belt round his middle, a black gaming headset with a microphone, and ${FLAG.replace('the flag of their country', 'his country\'s flag')}, tied round his neck as a cape`;
const DEN =
  'his cluttered presidential gaming den in the Hive House: a grand carved wooden desk buried in takeout boxes, pizza ' +
  'boxes and crushed soda cans, a wall of glowing monitors behind him showing scrolling chat made only of abstract ' +
  'coloured glyphs, purple and cyan LED strip light, a ring light, wood panelling, a gold-plated machine gun lying on the desk';
const LOOK =
  'A frame from a live television address by a head of state, shot like a cheap livestream: a wide webcam-like lens, ' +
  'vivid colour, colourful LED light and a ring light on his face, slightly overexposed, a little video noise.';
const NEWS =
  'A frame from a live colour television broadcast: broadcast camera framing, vivid slightly faded colour, a little video noise.';
const CLEAN =
  'Nothing in the picture can be read: no words, no letters of any alphabet, no numerals, no captions, no logos, no ' +
  'watermark, no border. No religious symbol of any kind: no cross, no plus-shaped sign, no five-pointed star, no crescent. ' +
  'Every insect person has exactly four arms and two legs. There are no human beings anywhere.';
const CROWD =
  'insect people like those of a 1950s science-fiction film: human posture, two legs, four arms, insect heads with large ' +
  'amber eyes and antennae, dark umber chitin, in 1950s clothes';

/** Each picture: what it shows, and which pictures it is drawn to match. */
const STILL_PROMPTS: Record<string, { prompt: string; refs: string[] }> = {
  den: { refs: ['flag'], prompt: `${LOOK} A medium shot of ${HIM}, sitting behind the desk in ${DEN}, leaning toward the camera with two arms on the desk, looking straight into the lens. The flag in the reference picture is his cape: copy it exactly. ${CLEAN}` },
  close: { refs: ['den', 'flag'], prompt: `${LOOK} A close-up, head and shoulders, of exactly the President in the first reference picture, the same head, antennae, coat, belt, headset and flag cape, looking straight into the camera, in the same den with the glowing monitors behind him, out of focus. ${CLEAN}` },
  gun: { refs: ['den', 'flag'], prompt: `${LOOK} Exactly the President in the first reference picture, the same head, coat, belt, headset and flag cape, standing up behind his cluttered desk in the same den, holding a gold-plated machine gun above his head in two of his four hands, the ceiling of the den visible above him, grinning wildly. ${CLEAN}` },
  rally: { refs: ['den', 'flag'], prompt: `${NEWS} Daytime, outdoors, a MEDIUM SHOT from just below the podium, so that he fills the middle of the frame from the waist up: exactly the President in the first reference picture, the same head, coat, belt and flag cape, without the headset, at a wooden podium with a cluster of chrome microphones at the top of the grand white steps of the Hive House, a palace of pale wasp-paper and wax with honeycomb walls and paper onion domes each topped with a plain gold ball; behind him hangs a gigantic version of the flag in the second reference picture, rippling. In the bottom corners of the frame, out of focus, the backs of the heads and raised arms of a huge cheering crowd of ${CROWD}, some with orange sashes. ${CLEAN}` },
  fieldclose: { refs: ['field', 'den', 'flag'], prompt: `${NEWS} A medium close-up, chest up, of exactly the President in the first two reference pictures, the same head, gilded battle helmet, coat, belt and flag cape blowing in the wind, standing on the gilded shell of his war beetle at the edge of a burning city, leaning toward the camera, gruff and serious; red smoky sky and flags of the third reference picture blurred behind him; smoke drifting past. ${CLEAN}` },
  paper: { refs: ['den', 'flag'], prompt: `${LOOK} Exactly the President in the first reference picture, the same head, coat, belt, headset and flag cape, behind his cluttered desk in the same den, holding up a newspaper toward the camera with two hands, outraged; the newspaper's big photograph is an aerial view of golden wheat fields with enormous curving swaths mowed into them, giant abstract loops and strokes like handwriting a mile high (no readable letters), a red barn sitting in the middle of one stroke; the newspaper's columns are blurred grey lines with nothing legible. ${CLEAN}` },
  studio: { refs: ['den', 'leader-faithful', 'flag'], prompt: `${NEWS} A 1950s radio studio with wood panelling, acoustic tiles and a big chrome ribbon microphone on a desk: exactly the President in the first reference picture, the same head, coat, belt and flag cape, wearing big studio headphones, leaning into the microphone, beaming; beside him sits exactly the radio preacher in the second reference picture, the same face and black velvet robes, nodding solemnly with his own microphone. ${CLEAN}` },
  call: { refs: ['den', 'leader-institute', 'flag'], prompt: `${LOOK} Exactly the President in the first reference picture, the same head, coat, belt, headset and flag cape, sitting at his cluttered desk in the same den and turned toward a big wall screen beside him, gesturing at it proudly with one hand; on the big screen, on a video call, is exactly the lanky young insect man in the second reference picture, the same face, messy antennae and grey t-shirt, in his own room, looking bored. ${CLEAN}` },
  field: { refs: ['den', 'flag'], prompt: `${NEWS} A battlefield at the edge of a burning city under a red smoky sky: exactly the President in the first reference picture, the same head, coat, belt and flag cape blowing in the wind, without the headset, wearing a gilded battle helmet, standing on the back of a giant armoured war beetle whose shell is a gilded onion dome, holding the gold-plated machine gun; behind him ranks of soldier ${CROWD.replace('in 1950s clothes', 'in long grey Orthodox-style military greatcoats and dome helmets')}, carrying banners of the flag in the second reference picture. ${CLEAN}` },
  door: { refs: ['den', 'flag'], prompt: `${LOOK} Night. Exactly the President in the first reference picture, the same head, coat, belt, headset and flag cape, half rising from his gaming chair at his cluttered desk in the same den, looking back over his shoulder at a closed wooden door at the side of the room, under which a deep red light glows; his antennae are up, uneasy. ${CLEAN}` },
  empty: { refs: ['den'], prompt: `${LOOK} Night. The same cluttered presidential gaming den as in the reference picture, seen from the same webcam angle, but nobody is there: the big gaming chair is empty and turned a little away from the desk, the gold machine gun is gone, the headset hangs off the chair, the wall of monitors still glows with scrolling glyph chat, and a deep red pulsing light spills across the floor from a door standing open at the side of the room. ${CLEAN}` },
};

const VOICE =
  'He speaks in English with a booming, gravelly, over-the-top voice like a pro-wrestling announcer with a thick Texas drawl, ' +
  'loud, fast and full of swagger; it is always the same big male voice.';
const TAIL =
  'One continuous shot, no cuts, the same look throughout. He keeps his cockroach head, exactly four arms and the same coat, ' +
  'belt and flag cape in every frame; nothing morphs or duplicates; he never grows extra arms. His cape is the flag of his country ' +
  'with a white roach head in the blue band: there is no star anywhere, and no other flag appears on the screens behind him. ' +
  'No text appears on screen. No music, no subtitles.';

function clipPrompt(s: RoachShot): string {
  const words = s.line.replace(/\b[A-Z]{2,}\b/g, (w) => w.toLowerCase());
  if (!s.line) return `${s.action} No one speaks; only the hum of computers, the room's quiet and a low, distant, pulsing rumble. One continuous shot, no cuts. No text appears on screen. No music.`;
  const stress = [...s.line.matchAll(/\b[A-Z]{2,}\b/g)].map((m) => `"${m[0].toLowerCase()}"`);
  return `${s.action} ${s.offscreen ? 'From off screen, he' : 'He'} says, to the camera: "${assertSpeakable(words)}"${stress.length ? ` He leans hard on ${stress.join(' and ')}.` : ''} ${VOICE} ${TAIL}`;
}
const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;
export const secsFor = (line: string) => (!line ? 6 : wordCount(line) <= 6 ? 4 : wordCount(line) <= 12 ? 6 : 8);
const SHOTS = ROACH_ADDRESSES.flatMap((a) => a.shots);

// ------------------------------------------------------------------ steps
function png(file: string): string {
  if (file.endsWith('.png')) return file;
  const out = path.join(RAW, 'refs', path.basename(file).replace(/\.\w+$/, '.png'));
  if (!fs.existsSync(out)) { fs.mkdirSync(path.dirname(out), { recursive: true }); ff(['-i', file, out], 'ref png'); }
  return out;
}
const refFile = (r: string) =>
  r === 'flag' ? path.join(D.flag, 'flag.png')
    : r.startsWith('leader-') ? png(path.join(ROOT, 'public', 'art', 'ship', `${r}.webp`))
      : path.join(D.stills, `${r}.png`);

async function flag() {
  fs.mkdirSync(D.flag, { recursive: true });
  await makeStill({ slug: 'roach flag', out: path.join(D.flag, 'flag.png'), key: null, quality: 'high', width: 1536, height: 1024,
    prompt: `A flat, clean, front-on graphic of ${FLAG}. The flag fills the whole picture edge to edge, perfectly flat and rectangular, crisp flat colours, no folds, no shading, no pole, no background. Proportions 3 by 2. ${CLEAN}` });
  await makeStill({ slug: 'roach flag cloth', out: path.join(D.flag, 'flag-wave.png'), key: null, quality: 'high', width: 1536, height: 1024, refFiles: [path.join(D.flag, 'flag.png')],
    prompt: `Exactly the flag in the reference picture, the same blue band, white roach head and white and red stripes, made of heavy cloth, flying from a wooden flagpole against a pale blue sky with a few clouds, rippling in a strong wind, photographed in daylight. ${CLEAN}` });
}

async function stills() {
  fs.mkdirSync(D.stills, { recursive: true });
  // The den first: every other picture is drawn to match it.
  const order = [...ROACH_STILLS].sort((a, b) => (a === 'den' ? -1 : b === 'den' ? 1 : 0));
  for (const id of order) {
    if (!want(id)) continue;
    const p = STILL_PROMPTS[id];
    const refs = p.refs.map(refFile).filter((f) => fs.existsSync(f));
    try {
      await makeStill({ slug: `roach ${id}`, out: path.join(D.stills, `${id}.png`), key: null, quality: 'high', width: 1536, height: 1024, prompt: p.prompt, refFiles: refs.length ? refs : undefined });
    } catch (e) { console.warn(`[roach] still ${id} failed: ${(e as Error).message.slice(0, 200)}`); }
  }
  review();
}

function review() {
  fs.mkdirSync(REVIEW, { recursive: true });
  for (const dir of [D.flag, D.stills]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.png'))) ff(['-i', path.join(dir, f), '-vf', 'scale=1024:-2', '-q:v', '3', path.join(REVIEW, f.replace('.png', '.jpg'))], `review ${f}`);
  }
}

/** The still cut to 16:9 (1536x864 from the middle of 1536x1024). */
function still169(id: string): string {
  const out = path.join(D.stills, `${id}-169.png`);
  if (!fs.existsSync(out)) ff(['-i', path.join(D.stills, `${id}.png`), '-vf', 'crop=1536:864:0:80', out], `${id} 16:9`);
  return out;
}

async function clips() {
  fs.mkdirSync(D.clips, { recursive: true });
  const todo = SHOTS.filter((s) => want(s.id) && fs.existsSync(path.join(D.stills, `${s.from}.png`)) && !fs.existsSync(path.join(D.clips, `${s.id}.mp4`)));
  console.log(`[roach] ${todo.length} clips to make on ${VIDEO_MODEL}`);
  const res = await pool(todo, 4, (s: RoachShot) => makeClip({
    slug: `roach-${s.id}`, stillFile: still169(s.from), out: path.join(D.clips, `${s.id}.mp4`), models: [VIDEO_MODEL],
    prompt: clipPrompt(s), seconds: secsFor(s.line), loop: false, raw: true, resolution: '720p', aspect: '16:9', audio: true,
  }));
  res.forEach((r: { ok: boolean; error?: Error }, i: number) => { if (!r.ok) console.warn(`[roach] clip ${todo[i].id} failed: ${r.error!.message.slice(0, 200)}`); });
}

/** What a clip says, transcribed (Deepgram via RFab), cached in art-src-new. */
async function said(file: string): Promise<string> {
  const st = fs.statSync(file);
  const cache = path.join(D.words, `${path.basename(file)}-${st.size}.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8')).text;
  fs.mkdirSync(D.words, { recursive: true });
  const wav = path.join(D.words, `${path.basename(file, '.mp4')}.wav`);
  ff(['-i', file, '-vn', '-ac', '1', '-ar', '16000', wav], 'wav');
  const r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(wav).toString('base64') }) });
  const text = String(r.transcript ?? r.text ?? r.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim();
  fs.writeFileSync(cache, JSON.stringify({ text }));
  return text;
}
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
/** The share of the line's words that were heard, in any order. */
function heard(line: string, got: string): number {
  const want_ = norm(line);
  const bag = norm(got);
  let n = 0;
  for (const w of want_) { const i = bag.indexOf(w); if (i >= 0) { n++; bag.splice(i, 1); } }
  return want_.length ? n / want_.length : 1;
}

async function check() {
  const rows: Array<{ id: string; heard: number; said: string; line: string; secs: number }> = [];
  for (const s of SHOTS) {
    const f = path.join(D.clips, `${s.id}.mp4`);
    if (!fs.existsSync(f) || !want(s.id)) continue;
    const got = s.line ? await said(f).catch((e) => `ERR ${(e as Error).message.slice(0, 80)}`) : '';
    const h = s.line ? heard(s.line, got) : 1;
    rows.push({ id: s.id, heard: +h.toFixed(2), said: got, line: s.line, secs: +duration(f).toFixed(2) });
    console.log(`${h >= 0.8 ? 'OK  ' : 'LOW '} ${s.id} ${(h * 100).toFixed(0)}%  said: ${got}`);
  }
  fs.mkdirSync(REVIEW, { recursive: true });
  fs.writeFileSync(path.join(REVIEW, 'speech.json'), JSON.stringify(rows, null, 1));
}

// ------------------------------------------------------------------ bake
/** The broadcast's sound: a TV speaker's band, a little compression, levelled to -16 LUFS like the leaders' lines. */
const EQ = 'highpass=f=120,lowpass=f=7000,acompressor=threshold=-20dB:ratio=3:attack=5:release=120';
function bakeClip(src: string, dest: string, poster: string): number {
  const m = ffStderr(['-i', src, '-vn', '-af', `${EQ},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  const hasAudio = m.includes('input_i');
  const args = ['-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', 'scale=1280:-2'];
  if (hasAudio) {
    const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
    const ln = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    args.push('-af', `${EQ},${ln}`, '-c:a', 'aac', '-b:a', '128k', '-ar', '48000');
  } else args.push('-an');
  ff([...args, dest], dest);
  ff(['-i', dest, '-vframes', '1', '-vf', 'scale=1280:-2', '-q:v', '80', poster], poster);
  return +duration(dest).toFixed(3);
}

function bake() {
  fs.mkdirSync(OUT, { recursive: true });
  const man: { flag?: string; flagWave?: string; clips: Record<string, { video: string; poster: string; seconds: number }> } = { clips: {} };
  const flatSrc = path.join(D.flag, 'flag.png');
  if (fs.existsSync(flatSrc)) { ff(['-i', flatSrc, '-vf', 'scale=900:-2', '-q:v', '85', path.join(OUT, 'flag.webp')], 'flag'); man.flag = 'media/roach/flag.webp'; }
  const waveSrc = path.join(D.flag, 'flag-wave.png');
  if (fs.existsSync(waveSrc)) { ff(['-i', waveSrc, '-vf', 'scale=1280:-2', '-q:v', '80', path.join(OUT, 'flag-wave.webp')], 'flag wave'); man.flagWave = 'media/roach/flag-wave.webp'; }
  for (const s of SHOTS) {
    const src = path.join(D.clips, `${s.id}.mp4`);
    if (!fs.existsSync(src)) { console.warn(`[roach] ${s.id}: no clip yet`); continue; }
    const seconds = bakeClip(src, path.join(OUT, `${s.id}.mp4`), path.join(OUT, `${s.id}.webp`));
    man.clips[s.id] = { video: `media/roach/${s.id}.mp4`, poster: `media/roach/${s.id}.webp`, seconds };
  }
  fs.writeFileSync(path.join(OUT, 'roach.json'), JSON.stringify(man, null, 1));
  console.log(`[roach] baked ${Object.keys(man.clips).length}/${SHOTS.length} clips${man.flag ? ', the flag' : ''}`);
}

/** Every shot as three frames (start, middle, end) with its id: LOOK at it. */
function sheet() {
  const tmp = path.join(RAW, 'sheet');
  fs.mkdirSync(tmp, { recursive: true });
  const rows: string[] = [];
  for (const s of SHOTS) {
    const f = path.join(D.clips, `${s.id}.mp4`);
    if (!fs.existsSync(f)) continue;
    const d = duration(f);
    const frames = [0.15, d / 2, Math.max(0.2, d - 0.25)].map((t, i) => {
      const o = path.join(tmp, `${s.id}-${i}.png`);
      ff(['-ss', t.toFixed(2), '-i', f, '-vframes', '1', '-vf', 'scale=480:270', o], 'frame');
      return o;
    });
    const row = path.join(tmp, `${s.id}-row.png`);
    ff([...frames.flatMap((x) => ['-i', x]), '-filter_complex', `hstack=inputs=3,drawtext=text='${s.id}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6`, row], 'row');
    rows.push(row);
  }
  if (!rows.length) { console.warn('[roach] no clips for a sheet'); return; }
  fs.mkdirSync(path.dirname(SHEET), { recursive: true });
  // Two columns of rows, so the sheet stays a sane height.
  const half = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, half), rows.slice(half)].filter((c) => c.length);
  const colFiles = cols.map((c, i) => {
    const o = path.join(tmp, `col${i}.png`);
    const pad = c.length < half ? `[v]pad=iw:ih+${(half - c.length) * 270}:0:0:black[o]` : '[v]null[o]';
    ff([...c.flatMap((x) => ['-i', x]), '-filter_complex', `${c.map((_, k) => `[${k}:v]`).join('')}vstack=inputs=${c.length}[v];${pad}`, '-map', '[o]', o], 'col');
    return o;
  });
  ff([...colFiles.flatMap((x) => ['-i', x]), '-filter_complex', colFiles.length > 1 ? 'hstack=inputs=2,scale=iw/2:-2' : 'scale=iw/2:-2', '-q:v', '4', SHEET], 'sheet');
  console.log(`[roach] sheet: ${SHEET}`);
}

(async () => {
  const before = step === 'bake' || step === 'sheet' ? 0 : await balance();
  if (step === 'flag') await flag();
  else if (step === 'stills') await stills();
  else if (step === 'clips') await clips();
  else if (step === 'check') await check();
  else if (step === 'bake') bake();
  else if (step === 'sheet') sheet();
  else if (step === 'review') review();
  else { console.error(`unknown step ${step}`); process.exit(1); }
  if (before) { const after = await balance(); console.log(`[roach] spent ${before - after} tokens (about $${((before - after) / 50000).toFixed(2)}; other sessions' spending may be in it)`); }
})();
