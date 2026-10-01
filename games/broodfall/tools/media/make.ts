/**
 * THE CAMPAIGN'S MEDIA, MADE AND BAKED (Sep 30 2026): the newsreels' shots, the clippings'
 * photographs, the ending films, the reveal cards' pictures, the announcers, the faction leaders'
 * voices, the newsreel music and the break's field audio. content/media.ts is what the game shows;
 * tools/media/prompts.mjs is how each thing is asked for.
 *
 *   npx vite-node tools/media/make.ts -- stills            the first frames and pictures (LOOK at them: notes/art-review/media/)
 *   npx vite-node tools/media/make.ts -- clips             the 4 s clips from the stills that are there
 *   npx vite-node tools/media/make.ts -- voices            announcers + leaders (Veo / Aura), music, field audio
 *   npx vite-node tools/media/make.ts -- bake              everything on disk into public/media/ + media.json (free)
 *   npx vite-node tools/media/make.ts -- stills e-bus p-tea   only those ids
 *
 * SPENDS RFab tokens (Collins's account, RFAB_API_KEY): a medium still ~$0.1-0.2, a high one ~$0.45,
 * a 4 s 720p clip ~$0.49, a Veo spoken line 4-8 s ~$0.3-0.6, an Aura line ~$0.01, 36 s of music ~$0.2.
 * Every step skips a file already on disk: to make one again, MOVE its raw file into a v1/ folder
 * beside it (never delete). Raw files: art-src/media/ (git-ignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill, pool as artPool } from '../art/rfab.mjs';
import { songTakes, soundTake, RAW as AUDIO_RAW } from '../audio/rfab-audio.mjs';
import { OUT, RAW, REVIEW, assertSpeakable, balance, duration, ff, ffStderr, pool, ready, speechSpan, transcribe, tts, veoSpeech } from './lib.mjs';
import { ANNOUNCER, CLIPS, CLIP_TAIL, FIELD, LEADER_REF, MUSIC, PHOTOS, REVEALS, SCENE_REF, FILM_REF } from './prompts.mjs';
import { ENDING_FILMS, LEADER_VOICES, MEDIA, NARRATION, lineKey, looseLeaderLines, scenesOf, speakerOf, spokenText, voiceKey } from '../../content/media';
import { FACTIONS, type FactionId, type Scene } from '../../content/campaign';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const step = argv[0] ?? 'bake';
const only = argv.slice(1);
const want = (id: string) => !only.length || only.includes(id);

const D = {
  stills: path.join(RAW, 'stills'), clips: path.join(RAW, 'clips'), photos: path.join(RAW, 'photos'),
  reveals: path.join(RAW, 'reveals'), voice: path.join(RAW, 'voice'), refs: path.join(RAW, 'refs'),
};

/** A reference picture as PNG (the upload is sent as image/png). */
function png(file: string): string {
  if (file.endsWith('.png')) return file;
  const out = path.join(D.refs, path.basename(file).replace(/\.\w+$/, '.png'));
  if (!fs.existsSync(out)) { fs.mkdirSync(D.refs, { recursive: true }); ff(['-i', file, out], 'ref png'); }
  return out;
}
const leaderRefs = (refs?: string[]) => (refs ?? []).map((f) => LEADER_REF(f)).filter((f) => fs.existsSync(f));

// ------------------------------------------------------------------ pictures
async function stills() {
  for (const d of Object.values(D)) fs.mkdirSync(d, { recursive: true });
  type Job = { id: string; out: string; prompt?: string; from?: string; refs: string[]; quality: string; w: number; h: number };
  const jobs: Job[] = [];
  for (const [id, c] of Object.entries(CLIPS) as Array<[string, { still?: string; from?: string; refs?: string[]; look: string }]>) {
    if (!want(id)) continue;
    const out = path.join(D.stills, `${id}.png`);
    if (c.from) { if (!fs.existsSync(out)) fs.copyFileSync(SCENE_REF(c.from), out); continue; }
    const refs = c.refs ? leaderRefs(c.refs) : c.look === 'raw' ? [] : [FILM_REF];
    jobs.push({ id, out, prompt: c.still, refs, quality: 'medium', w: 1536, h: 1024 });
  }
  for (const [id, p] of Object.entries(PHOTOS) as Array<[string, string | { refs: string[]; prompt: string }]>) {
    if (!want(id)) continue;
    const o = typeof p === 'string' ? { prompt: p, refs: [] as string[] } : { prompt: p.prompt, refs: leaderRefs(p.refs) };
    jobs.push({ id, out: path.join(D.photos, `${id}.png`), prompt: o.prompt, refs: o.refs, quality: 'medium', w: 1536, h: 1024 });
  }
  for (const [id, p] of Object.entries(REVEALS) as Array<[string, { refs: string[]; prompt: string }]>) {
    if (!want(id)) continue;
    jobs.push({ id, out: path.join(D.reveals, `${id}.png`), prompt: p.prompt, refs: leaderRefs(p.refs), quality: 'high', w: 1536, h: 1024 });
  }
  const todo = jobs.filter((j) => !fs.existsSync(j.out));
  console.log(`[media] ${todo.length} pictures to make`);
  const res = await artPool(todo, 5, (j: Job) => makeStill({ slug: `media ${j.id}`, out: j.out, prompt: j.prompt, key: null, width: j.w, height: j.h, quality: j.quality, refFiles: j.refs.map(png) }));
  res.forEach((r: { ok: boolean; error?: Error }, i: number) => { if (!r.ok) console.warn(`[media] ${todo[i].id} failed: ${r.error!.message.slice(0, 200)}`); });
  sheets();
}

/** Contact sheets to LOOK at: every still, photo and reveal picture with its id. */
function sheets() {
  fs.mkdirSync(REVIEW, { recursive: true });
  const groups: Array<[string, string]> = [['stills', D.stills], ['photos', D.photos], ['reveals', D.reveals]];
  for (const [name, dir] of groups) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && (!only.length || only.includes(f.replace('.png', ''))));
    for (const f of files) {
      const out = path.join(REVIEW, name, f.replace('.png', '.jpg'));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      ff(['-i', path.join(dir, f), '-vf', 'scale=1024:-2', '-q:v', '3', out], `review ${f}`);
    }
  }
}

// ------------------------------------------------------------------ clips
const still169 = (id: string) => {
  const out = path.join(D.stills, `${id}-169.png`);
  if (!fs.existsSync(out)) ff(['-i', path.join(D.stills, `${id}.png`), '-vf', 'crop=1536:864:0:80', out], `${id} 16:9`);
  return out;
};
async function clips() {
  const ids = Object.keys(CLIPS).filter((id) => want(id) && fs.existsSync(path.join(D.stills, `${id}.png`)) && !fs.existsSync(path.join(D.clips, `${id}-clip.mp4`)));
  console.log(`[media] ${ids.length} clips to make`);
  const res = await artPool(ids, 5, (id: string) => makeClip({
    slug: `media-${id}`, stillFile: still169(id), out: path.join(D.clips, `${id}-clip.mp4`),
    prompt: `${(CLIPS as Record<string, { clip: string }>)[id].clip} ${CLIP_TAIL}`,
    seconds: 4, loop: false, raw: true, resolution: '720p', aspect: '16:9',
  }));
  res.forEach((r: { ok: boolean; error?: Error }, i: number) => { if (!r.ok) console.warn(`[media] clip ${ids[i]} failed: ${r.error!.message.slice(0, 200)}`); });
}

// ------------------------------------------------------------------ voices
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const secsFor = (t: string, slow = false) => { const w = words(t) * (slow ? 1.25 : 1); return w <= 9 ? 4 : w <= 15 ? 6 : 8; };
/** A long line cut at its sentences into pieces a take can hold (~22 words). */
function chunks(t: string, max = 22): string[] {
  if (words(t) <= max) return [t];
  const sent = t.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [t];
  const out: string[] = [];
  for (const s of sent) {
    const last = out[out.length - 1];
    if (last && words(last) + words(s) <= max) out[out.length - 1] = `${last} ${s}`; else out.push(s);
  }
  return out;
}
const fileKey = (k: string) => k.replace(/\//g, '__');
/** A line as a voice model should get it: words in capitals (stress on the page) lower-cased, or they are spelled out. */
function speakable(t: string): { text: string; stressed: string[] } {
  const stressed: string[] = [];
  const text = t.replace(/—/g, ', ').replace(/\b[A-Z]{2,}\b/g, (w) => (w === 'AI' ? w : (stressed.push(w.toLowerCase()), w.toLowerCase())));
  return { text, stressed };
}

interface LeaderLine { key: string; faction: string; who: string; text: string }
/**
 * Every line a leader speaks: each scene's (keyed by faction, scene and place) and every loose one
 * (the asides and anything added later; keyed by its words, content/media.ts lineKey). `faction` is
 * the faction whose content holds it ('campaign' when none does), so `voices delegation` still works.
 */
export function leaderLines(): LeaderLine[] {
  const out: LeaderLine[] = [];
  for (const f of FACTIONS) {
    for (const s of scenesOf(f)) s.lines.forEach((l, i) => {
      const who = speakerOf(l);
      if (!LEADER_VOICES[who]) return;
      const text = spokenText(l);
      if (!text) return;
      out.push({ key: voiceKey(f.id, s.title, i), faction: f.id, who, text });
    });
  }
  for (const l of looseLeaderLines()) {
    const f = FACTIONS.find((x) => JSON.stringify(x).includes(JSON.stringify(l)));
    out.push({ key: lineKey(l), faction: f?.id ?? 'campaign', who: speakerOf(l), text: spokenText(l) });
  }
  return out;
}

async function voices() {
  fs.mkdirSync(D.voice, { recursive: true });
  type J = { id: string; run: () => Promise<unknown> };
  const jobs: J[] = [];
  for (const [id, n] of Object.entries(NARRATION)) {
    if (!want(id)) continue;
    jobs.push({ id, run: () => veoSpeech({ out: path.join(D.voice, `${id}.mp4`), seconds: secsFor(n.line), prompt: ANNOUNCER[n.side](assertSpeakable(speakable(n.line).text)) }) });
  }
  // A line rewritten since its take was baked: the old take goes to v1/, a new one is made.
  const baked = fs.existsSync(path.join(OUT, 'media.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'media.json'), 'utf8')).voices ?? {} : {};
  for (const l of leaderLines()) {
    if (!baked[l.key] || baked[l.key].text === l.text) continue;
    fs.mkdirSync(path.join(D.voice, 'v1'), { recursive: true });
    for (const f of fs.readdirSync(D.voice).filter((f) => /\.(mp3|mp4)$/.test(f) && /^(-[a-f])?\.(mp3|mp4)$/.test(f.slice(fileKey(l.key).length)) && f.startsWith(fileKey(l.key)))) {
      fs.renameSync(path.join(D.voice, f), path.join(D.voice, 'v1', f));
      console.log(`[media] ${l.key}: its words changed; ${f} → v1/`);
    }
  }
  for (const l of leaderLines()) {
    if (!want(l.key) && !want(l.faction) && !(want('lines') && l.key.startsWith('say/'))) continue;
    const v = LEADER_VOICES[l.who];
    if (v.how === 'aura') jobs.push({ id: l.key, run: () => tts({ out: path.join(D.voice, `${fileKey(l.key)}.mp3`), text: speakable(l.text).text, voice: v.voice! }) });
    else chunks(l.text).forEach((c, i, all) => jobs.push({ id: `${l.key}#${i}`, run: () => {
      const s = speakable(c);
      return veoSpeech({
        out: path.join(D.voice, `${fileKey(l.key)}${all.length > 1 ? `-${'abcdef'[i]}` : ''}.mp4`), seconds: secsFor(c, true),
        prompt: ANNOUNCER.voice(assertSpeakable(s.text)) + (s.stressed.length ? ` He leans hard on ${s.stressed.map((w) => `"${w}"`).join(' and ')}.` : ''),
      });
    } }));
  }
  if (step === 'recaps') {
    // Takes made from a line with a word in capitals (the models SPELL it: "W O R D"): moved to v1/, to be made again.
    const v1 = path.join(D.voice, 'v1');
    fs.mkdirSync(v1, { recursive: true });
    for (const l of leaderLines()) {
      if (!speakable(l.text).stressed.length) continue;
      for (const f of fs.readdirSync(D.voice).filter((f) => f.startsWith(fileKey(l.key)) && /\.(mp3|mp4)$/.test(f) && /^(-[a-f])?\.(mp3|mp4)$/.test(f.slice(fileKey(l.key).length)))) {
        fs.renameSync(path.join(D.voice, f), path.join(v1, f));
        console.log(`[media] ${f} → v1/`);
      }
    }
    return;
  }
  for (const [id, m] of Object.entries(MUSIC)) {
    if (!want(id)) continue;
    const st = m.spec;
    jobs.push({ id, run: () => songTakes({ id, model: 'elevenlabs:music_v2', spec: {
      title: st.title, form: 'instrumental', targetSeconds: m.seconds, language: 'en',
      style: { instrumental: true, genres: st.genres, moods: st.moods, tempo: st.tempo, instruments: st.instruments, freeform: st.freeform } } }) });
  }
  for (const [id, prompt] of Object.entries(FIELD)) {
    if (!want(id)) continue;
    jobs.push({ id, run: () => soundTake({ id, prompt, model: 'atlascloud:h3-t2v', seconds: 8, resolution: '480p', aspect: '16:9' }) });
  }
  console.log(`[media] ${jobs.length} sound jobs (existing files are skipped)`);
  await pool(jobs, 6, (j: J) => j.run());
}

// ------------------------------------------------------------------ bake
const ENC = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

/** Does frame 0 (the uploaded still) differ sharply from frame 1? It is then left out. */
function firstFrameJumps(file: string): boolean {
  const s = ffStderr(['-i', file, '-vf', 'trim=end_frame=3,scale=64:36,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-']);
  const y = [...s.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  return y.length >= 3 && Math.abs(y[0] - y[1]) > 3 * Math.max(0.4, Math.abs(y[1] - y[2]));
}

function levelled(src: string, dest: string, extra: string, ss?: number, t?: number, I = -16) {
  const pre = [...(ss !== undefined ? ['-ss', ss.toFixed(3)] : []), ...(t !== undefined ? ['-t', t.toFixed(3)] : []), '-i', src];
  const chain = (f: string) => (extra ? `${extra},${f}` : f);
  const m = ffStderr([...pre, '-vn', '-af', chain(`loudnorm=I=${I}:TP=-1.5:LRA=11:print_format=json`), '-f', 'null', '-']);
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=${I}:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  ff([...pre, '-vn', '-ar', '48000', '-ac', '1', '-af', chain(ln), '-c:a', 'libopus', '-b:a', '64k', dest], dest);
}

/** A spoken take cut to its speech and levelled; `eq`: the chain before the level (the old microphone, the radio). */
function bakeSpeech(srcs: string[], dest: string, eq: string): number {
  const parts: string[] = [];
  srcs.forEach((src, i) => {
    const span = speechSpan(src) ?? { start: 0, end: duration(src) };
    const wav = path.join(RAW, 'tmp', `${path.basename(dest, '.ogg')}-${i}.wav`);
    fs.mkdirSync(path.dirname(wav), { recursive: true });
    ff(['-ss', span.start.toFixed(3), '-t', (span.end - span.start).toFixed(3), '-i', src, '-vn', '-ac', '1', '-ar', '48000', wav], 'cut');
    parts.push(wav);
  });
  let src = parts[0];
  if (parts.length > 1) {
    // Two takes of one line: a short breath between them.
    src = path.join(RAW, 'tmp', `${path.basename(dest, '.ogg')}-joined.wav`);
    ff([...parts.flatMap((p) => ['-i', p]), '-filter_complex', `${parts.map((_, i) => `[${i}:a]apad=pad_dur=0.25[a${i}]`).join(';')};${parts.map((_, i) => `[a${i}]`).join('')}concat=n=${parts.length}:v=0:a=1[o]`, '-map', '[o]', src], 'join');
  }
  const d = duration(src);
  levelled(src, dest, `${eq}${eq ? ',' : ''}afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, d - 0.1).toFixed(2)}:d=0.1`);
  return +duration(dest).toFixed(3);
}
const NEWSREEL_EQ = 'highpass=f=180,lowpass=f=5200,acompressor=threshold=-20dB:ratio=3:attack=5:release=120';
const RADIO_EQ = 'highpass=f=280,lowpass=f=3800,acompressor=threshold=-22dB:ratio=4:attack=4:release=100';

/** Fraction of the line's words heard in the take (order ignored). */
function heardShare(line: string, heard: string): number {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const want = norm(line);
  const got = new Set(norm(heard));
  return want.length ? want.filter((w) => got.has(w)).length / want.length : 1;
}

async function bake() {
  const clipsOut = path.join(OUT, 'clips'); const photosOut = path.join(OUT, 'photos'); const picsOut = path.join(OUT, 'pictures');
  const voiceOut = path.join(OUT, 'voice'); const musicOut = path.join(OUT, 'music');
  for (const d of [clipsOut, photosOut, picsOut, voiceOut, musicOut, REVIEW]) fs.mkdirSync(d, { recursive: true });
  const file = path.join(OUT, 'media.json');
  const json: any = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  json.v = 1;
  for (const k of ['clips', 'photos', 'pictures', 'voices', 'narration', 'music']) json[k] ??= {};
  const review: Record<string, unknown> = {};

  // Clips: frame 0 (the still) out when it jumps; 1280x720 24 fps; a poster from its middle.
  for (const id of Object.keys(CLIPS)) {
    const raw = path.join(D.clips, `${id}-clip.mp4`);
    if (!want(id) || !fs.existsSync(raw)) continue;
    const drop = firstFrameJumps(raw);
    const mp4 = path.join(clipsOut, `${id}.mp4`);
    ff(['-i', raw, '-vf', `${drop ? 'trim=start_frame=1,setpts=PTS-STARTPTS,' : ''}scale=1280:720:flags=lanczos,fps=24,format=yuv420p`, ...ENC, mp4], `${id} bake`);
    const secs = duration(mp4);
    ff(['-ss', (secs / 2).toFixed(3), '-i', mp4, '-frames:v', '1', '-vf', 'scale=960:-2', '-c:v', 'libwebp', '-q:v', '80', path.join(clipsOut, `${id}.webp`)], `${id} poster`);
    // Review: the first frame, three frames of the clip.
    const tmp = path.join(RAW, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
    const tiles = [0.05, 0.35, 0.65, 0.95].map((p, i) => { const o = path.join(tmp, `${id}-${i}.jpg`); ff(['-ss', (secs * p).toFixed(3), '-i', mp4, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', o], 'frame'); return o; });
    ff([...tiles.flatMap((t) => ['-i', t]), '-filter_complex', '[0][1][2][3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]', '-map', '[v]', '-q:v', '4', path.join(REVIEW, `clip-${id}.jpg`)], 'sheet');
    json.clips[id] = { video: `media/clips/${id}.mp4`, poster: `media/clips/${id}.webp`, seconds: +secs.toFixed(3) };
  }
  // Photos: grey, 1024 wide.
  for (const id of Object.keys(PHOTOS)) {
    const raw = path.join(D.photos, `${id}.png`);
    if (!want(id) || !fs.existsSync(raw)) continue;
    ff(['-i', raw, '-vf', 'scale=1024:-2:flags=lanczos,format=gray', '-c:v', 'libwebp', '-q:v', '82', path.join(photosOut, `${id}.webp`)], `${id} photo`);
    json.photos[id] = `media/photos/${id}.webp`;
  }
  for (const id of Object.keys(REVEALS)) {
    const raw = path.join(D.reveals, `${id}.png`);
    if (!want(id) || !fs.existsSync(raw)) continue;
    ff(['-i', raw, '-vf', 'scale=1280:-2:flags=lanczos', '-c:v', 'libwebp', '-q:v', '84', path.join(picsOut, `${id}.webp`)], `${id} picture`);
    json.pictures[id] = `media/pictures/${id}.webp`;
  }

  // The announcers.
  const checks: Array<Promise<void>> = [];
  for (const [id, n] of Object.entries(NARRATION)) {
    const raw = path.join(D.voice, `${id}.mp4`);
    if (!want(id) || !fs.existsSync(raw)) continue;
    const dest = path.join(voiceOut, `${id}.ogg`);
    const seconds = bakeSpeech([raw], dest, NEWSREEL_EQ);
    json.narration[id] = { file: `media/voice/${id}.ogg`, seconds, line: n.line };
    checks.push(transcribe(dest).then((h: { text: string }) => { review[id] = { line: n.line, heard: h.text, share: +heardShare(n.line, h.text).toFixed(2) }; }).catch(() => {}));
  }
  // The leaders.
  for (const l of leaderLines()) {
    if (!want(l.key) && !want(l.faction) && !(want('lines') && l.key.startsWith('say/'))) continue;
    const base = path.join(D.voice, fileKey(l.key));
    const v = LEADER_VOICES[l.who];
    const srcs = v.how === 'aura' ? [`${base}.mp3`] : fs.existsSync(`${base}.mp4`) ? [`${base}.mp4`] : ['a', 'b', 'c', 'd'].map((s) => `${base}-${s}.mp4`).filter((f) => fs.existsSync(f));
    if (!srcs.length || !srcs.every((f) => fs.existsSync(f))) continue;
    const dest = path.join(voiceOut, `${fileKey(l.key)}.ogg`);
    const seconds = bakeSpeech(srcs, dest, v.how === 'veo' ? RADIO_EQ : 'highpass=f=70');
    json.voices[l.key] = { file: `media/voice/${fileKey(l.key)}.ogg`, seconds, text: l.text, who: l.who };
    if (v.how === 'veo') checks.push(transcribe(dest).then((h: { text: string }) => { review[l.key] = { line: l.text, heard: h.text, share: +heardShare(l.text, h.text).toFixed(2) }; }).catch(() => {}));
  }
  // A loose line rewritten or removed: its old key goes (its new words are a new key).
  const live = new Set(leaderLines().map((l) => l.key));
  for (const k of Object.keys(json.voices)) if (k.startsWith('say/') && !live.has(k)) delete json.voices[k];
  // The music: its leading silence off, a fade at the end.
  for (const id of Object.keys(MUSIC)) {
    if (!want(id)) continue;
    const takes = fs.existsSync(AUDIO_RAW) ? fs.readdirSync(AUDIO_RAW).filter((f) => f.startsWith(`${id}-take`)).sort() : [];
    if (!takes.length) continue;
    const src = path.join(AUDIO_RAW, takes[0]);
    const d = duration(src);
    const dest = path.join(musicOut, `${id}.ogg`);
    const m = ffStderr(['-i', src, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
    const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
    ff(['-i', src, '-ar', '48000', '-ac', '2', '-af', `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,afade=t=out:st=${Math.max(0, d - 1.5).toFixed(2)}:d=1.5`, '-c:a', 'libopus', '-b:a', '128k', dest], dest);
    json.music[id] = { file: `media/music/${id}.ogg`, seconds: +duration(dest).toFixed(3) };
  }
  // The field (the break): the whole take, levelled low.
  for (const id of Object.keys(FIELD)) {
    const src = path.join(AUDIO_RAW, `${id}.mp4`);
    if (!want(id) || !fs.existsSync(src)) continue;
    const dest = path.join(musicOut, `${id}.ogg`);
    const d = duration(src);
    levelled(src, dest, `highpass=f=60,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, d - 0.6).toFixed(2)}:d=0.6`, 0.15, undefined, -22);
    json.field = { file: `media/music/${id}.ogg`, seconds: +duration(dest).toFixed(3) };
  }
  await Promise.all(checks);
  fs.writeFileSync(file, JSON.stringify(json, null, 1) + '\n');
  if (Object.keys(review).length) {
    const rf = path.join(REVIEW, 'speech.json');
    const old = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : {};
    fs.writeFileSync(rf, JSON.stringify({ ...old, ...review }, null, 1) + '\n');
    for (const [k, r] of Object.entries(review) as Array<[string, { share: number; heard: string }]>) if (r.share < 0.75) console.warn(`[media] ${k}: heard only ${Math.round(r.share * 100)}%: "${r.heard}"`);
  }
  // What the game will ask for that is not there.
  const clipsWanted = new Set([...MEDIA.flatMap((m) => (m.kind === 'reel' ? m.shots.map((s) => s.clip) : [])), ...ENDING_FILMS.flatMap((f) => f.shots.map((s) => s.clip))]);
  const missing = [...clipsWanted].filter((c) => !c.startsWith('intro:') && !json.clips[c]);
  const photosMissing = MEDIA.flatMap((m) => (m.kind === 'clipping' && !json.photos[m.photo] ? [m.photo] : []));
  console.log(`[media] media.json: ${Object.keys(json.clips).length} clips, ${Object.keys(json.photos).length} photos, ${Object.keys(json.pictures).length} pictures, ${Object.keys(json.narration).length} announcer lines, ${Object.keys(json.voices).length} leader lines, ${Object.keys(json.music).length} music${json.field ? ' + field' : ''}`);
  if (missing.length || photosMissing.length) console.log(`[media] still missing: ${[...missing, ...photosMissing].join(' ')}`);
}

ready();
if (step === 'bake') await bake();
else {
  const b0 = await balance();
  if (step === 'stills') await stills();
  else if (step === 'clips') await clips();
  else if (step === 'voices' || step === 'recaps') await voices();
  else if (step === 'sheets') sheets();
  else { console.error(`unknown step ${step}`); process.exit(1); }
  const b1 = await balance();
  console.log(`[media] balance ${b0} -> ${b1} (${b0 - b1} tokens, others' spending included)`);
}
