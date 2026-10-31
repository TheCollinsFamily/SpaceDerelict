/**
 * THE DEMO INTRO (Oct 30 2026). Collins: "the game trailer for broodfall needs a thing in front of it before I submit it
 * to Y Combinator as our demo ... a short thing at the beginning with animation saying Claude Code + The RFab API built
 * this game + trailer with only limited human interaction. This is what Reality Fabricator unlocks. (have Neko Voss say it)".
 *
 * Neko Voss (rfab.ai's mascot: the cyberpunk catgirl nerd) says the line to camera in one acted clip, and the words are
 * set in type beside her, animated in step with her own words (the times come from a transcript of the take). The
 * finished intro is put in front of the two store trailers; the store trailers themselves are left as they are.
 *
 *   node tools/promo/intro.mjs still          her picture, 16:9, drawn from her portrait (RFab; SPENDS tokens, skips what is on disk)
 *   node tools/promo/intro.mjs clips          acted takes AT ONCE, one per row of TAKES: video models that SPEAK the line themselves, each at its lowest tier
 *   node tools/promo/intro.mjs voice          (the rejected path, kept) her line as text-to-speech, three voices at once
 *   node tools/promo/intro.mjs sync           (the rejected path, kept) her picture speaking THAT track: OmniHuman 1.5 lip-sync, Seedance 2.5 r2v
 *   node tools/promo/intro.mjs hear           what each take says, word by word (rfab.ai transcription), and THE GATES, incl. a model that LISTENS
 *   node tools/promo/intro.mjs titles <take>  the animated type, frame by frame at 60 fps (headless Chromium), timed to her words
 *   node tools/promo/intro.mjs cut <take>     the intro segment, then the two trailers with it in front: promo/trailer/*-yc-demo*.mp4
 *   node tools/promo/intro.mjs sheet <take>   a strip of frames of the finished intro, to look at
 *
 * Raw material (her picture, the takes, their transcripts, the title frames, the intro master) is in art-src/trailer/intro/
 * (git-ignored). Needs RFAB_API_KEY, ffmpeg on PATH and the game's node_modules (@playwright/test).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = path.join(ROOT, 'art-src', 'trailer', 'intro');
const OUT = path.join(ROOT, 'promo', 'trailer');
fs.mkdirSync(RAW, { recursive: true });
const API_BASE = process.env.RFAB_API_BASE || 'https://api.rfab.ai';
const KEY = process.env.RFAB_API_KEY;
const FPS = 60;
const [cmd = 'help', ...rest] = process.argv.slice(2);
const TAKE = rest.find((a) => !a.startsWith('--')) ?? null;
if (!KEY && /^(still|clips|hear)$/.test(cmd)) { console.error('RFAB_API_KEY is not set'); process.exit(1); }

// ------------------------------------------------------------------ what is said and shown
/** Her look, said the same way in the still and the clip (rfab.ai's end scene says it this way: app/domain/film/endScene.js). */
const LOOK = 'Neko Voss, a cyberpunk catgirl nerd: short teal-and-pink hair, glowing teal cat-ear headphones, round glasses, pink eyes, a neon-trimmed black jacket with silver piping over a black circuit-lined top, fingerless gloves';
/** Her portrait (public, rfab.ai/assets/beat-brief/persona-neko.webp), kept beside the work as a PNG. */
const PORTRAIT_URL = 'https://rfab.ai/assets/beat-brief/persona-neko.webp';
/** Collins's words, as she speaks them ("R-Fab" so it is said as the site says it). */
const LINE_SPOKEN = 'Claude Code and the R-Fab API built this game, and this trailer, with only limited human interaction. This is what Reality Fabricator unlocks.';
const LINE_WORDS = ['claude', 'code', 'and', 'the', 'rfab', 'api', 'built', 'this', 'game', 'and', 'this', 'trailer', 'with', 'only', 'limited', 'human', 'interaction', 'this', 'is', 'what', 'reality', 'fabricator', 'unlocks'];
const SECONDS = 12;
/**
 * The takes. Oct 30 2026: the first two (sd25, mini: the plain line, no note on how to say it) both said "Fabricator" as
 * "FAB-ri-ker", three syllables (Collins heard it; a model that listens, the LISTEN gate below, hears the same). A lip-synced
 * TTS track (omni, r2v) said it right and looked awful (Collins: "whatever ai you used for the video looks AWFUL ... you can just
 * use video models that speak"). So: acted takes from SEVERAL models that speak, all at once, each told how the brand words are
 * said (`pronounce`) or given the word respelled so its own voice lands on the right syllables (`say: 'respelled'`), each at
 * its lowest tier (no `resolution`: the API's default), each judged by the gates, the LISTEN gate first.
 */
const TIER_SD25 = 'the default Seedance 2.0 mini take of this line at 480p (take-mini.mp4, Oct 30 2026) said "Fabricator" as "FAB-ri-ker" (a model that listens heard it) and warped her right hand; Seedance 2.5 follows a spoken-pronunciation instruction better and is made beside new mini takes carrying the same instruction';
const TAKES = {
  'sd25-say':   { kind: 'i2v', models: ['atlascloud:seedance-2.5-i2v', 'imagerouter:seedance-2.5-i2v'], say: 'plain', pronounce: true, seconds: 12, tierReason: TIER_SD25 },
  'sd25-spell': { kind: 'i2v', models: ['atlascloud:seedance-2.5-i2v', 'imagerouter:seedance-2.5-i2v'], say: 'respelled', seconds: 12, tierReason: TIER_SD25 },
  'mini-say':   { kind: 'i2v', models: ['atlascloud:seedance-2.0-mini-i2v'], say: 'plain', pronounce: true, seconds: 12 },
  'mini-spell': { kind: 'i2v', models: ['atlascloud:seedance-2.0-mini-i2v'], say: 'respelled', seconds: 12 },
  'grok':       { kind: 'i2v', models: ['grok:grok-imagine-video-1.5-lite'], say: 'plain', seconds: 12 },
  'grok-say':   { kind: 'i2v', models: ['grok:grok-imagine-video-1.5-lite'], say: 'plain', pronounce: true, seconds: 12 },
  'wan-say':    { kind: 'i2v', models: ['atlascloud:wan-3.0-i2v'], say: 'plain', pronounce: true, seconds: 15 },
  'kling-say':  { kind: 'i2v', models: ['replicate:kwaivgi/kling-v3-video'], say: 'plain', pronounce: true, seconds: 12 },
  'h3-say':     { kind: 'i2v', models: ['atlascloud:h3-developer-i2v'], say: 'plain', pronounce: true, seconds: 12 },
  'veo-say':    { kind: 'i2v', models: ['imagerouter:veo-3.1-lite-i2v'], say: 'plain', pronounce: true, seconds: 8, quick: true },
  // The first takes (the plain line, nothing on how to say it): both said "FAB-ri-ker". Kept for the record; cached on disk.
  sd25: { kind: 'i2v', models: ['atlascloud:seedance-2.5-i2v', 'imagerouter:seedance-2.5-i2v'], say: 'plain', seconds: 12, tierReason: 'a 23-word line acted to camera by the character in one take: Seedance 2.5 is the model the Broodfall film system measured for acted speech (tools/media/talk-test.mjs, Oct 4 2026); the default Seedance 2.0 mini is untested for speech and is made beside it in the same run' },
  mini: { kind: 'i2v', models: ['atlascloud:seedance-2.0-mini-i2v'], say: 'plain', seconds: 12 },
  // The TTS-and-lip-sync pair (rejected: it looked awful).
  omni: { kind: 'sync', model: 'replicate:bytedance/omni-human' },
  r2v: { kind: 'sync', model: 'atlascloud:seedance-2.5-r2v', tierReason: 'the Seedance 2.5 i2v take said "Fabricator" wrong (Collins, Oct 30 2026): the line must be the given TTS track, lip-synced; a reference sound is taken only by the 2.5 r2v row, not by the default mini' },
};
/** Her line for text-to-speech: "R-Fab" as the site says it, a beat before the last sentence. */
const LINE_TTS = 'Claude Code and the R-Fab API built this game, and this trailer, with only limited human interaction. <short pause> This is what Reality Fabricator unlocks.';
const TTS_DIRECTION = 'bright, warm and confident; quick but every word clear; a smile in the voice, like a host opening a show';
/** Three of the directable voices, in the order preferred for her (youthful, bright, upbeat); the first that is heard whole is used. */
const VOICES = ['gem-leda', 'gem-zephyr', 'gem-laomedeia'];
const SYNC_PROMPT_OMNI = 'She talks to the camera, bright and animated, gesturing with her raised hand as she speaks and grinning proudly on the last sentence; her cat-ear headphones glow softly; the camera is locked.';
const SYNC_PROMPT_R2V = [
  'One continuous locked-off shot: the camera never moves and never cuts.',
  `${LOOK}, stands at the left of the frame and speaks straight to the camera. Her words, her voice and her lip movements are exactly @Audio1, which is the only sound of the clip, played once from the first frame, with nothing added and nothing else said.`,
  'She gestures with her raised hand as she speaks and gives a proud little grin on the last sentence; her cat-ear headphones glow softly in time with her voice.',
  'The right side of the picture stays dark and empty exactly as in the first frame; nothing new appears; no text, letters or writing appear anywhere.',
].join(' ');

const STILL_PROMPT = [
  'Detailed anime illustration, crisp linework, expressive eyes, never chibi, never western cartoon. Exactly one character.',
  `${LOOK}, exactly as in the reference picture, seen from the waist up, standing in the LEFT third of a wide frame, turned to the viewer and looking straight into the camera with a confident closed-mouth grin, one hand raised open at shoulder height as if presenting something beside her, the other hand holding her mug.`,
  'Behind her a dim far-future hacker den at night: near-black, with two or three faint translucent holographic panels in teal and pink, soft and out of focus, and thin neon light strips.',
  'The RIGHT two thirds of the picture are dark and uncluttered: deep near-black space with only a faint teal-and-pink glow, nothing drawn in it.',
  'No text, no letters, no numbers, no writing, no logos anywhere in the picture, not even on the panels.',
].join(' ');

/** The line as given to the video model: as written, or with "Fabricator" respelled so a voice that reads letters lands on FAB-ri-kay-ter. */
const SAY = { plain: LINE_SPOKEN, respelled: LINE_SPOKEN.replace('Fabricator', 'Fabricaytor') };
/** How the brand words are said, told to the model outside the quotes (Seedance said "FAB-ri-ker" without it). */
const PRONOUNCE = 'She says "Fabricator" the standard American way, FAB-rih-kay-ter: four clear syllables with the stress on the first, the word "fabric" and then "ay-ter". "Claude" is one syllable, said like "clawed". "R-Fab" is the letter R and then "fab". "API" is the three letters A, P, I.';
function clipPrompt(t = {}) {
  return [
    'One continuous locked-off shot: the camera never moves and never cuts.',
    `${LOOK}, stands at the left of the frame and speaks straight to the camera, the way a host opens a show: bright, warm and confident, in a clear young woman's voice, quick but never rushed, with a smile in it.`,
    `She says: "${SAY[t.say ?? 'plain']}"`,
    ...(t.pronounce ? [PRONOUNCE] : []),
    'She gestures with her raised hand as she speaks and gives a proud little grin on the last sentence; her cat-ear headphones glow softly in time with her voice.',
    t.quick
      ? 'She begins speaking in the very first moment of the shot and speaks briskly, so the whole line is finished before the shot ends; no silence of more than a moment.'
      : 'She begins speaking at once, in the first second of the shot, with natural timing, and there is never a silence of more than a moment.',
    'Only these words are spoken, once, in this order; nobody else speaks, and nothing else is heard but quiet room tone; no music.',
    'The right side of the picture stays dark and empty exactly as in the first frame; nothing new appears; no text, letters or writing appear anywhere.',
  ].join(' ');
}
const CLIP_PROMPT = clipPrompt();

// ------------------------------------------------------------------ rfab.ai
async function api(pathname, opts = {}) {
  const res = await fetch(API_BASE + pathname, { ...opts, headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`); }
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(jobId, label, tries = 240) {
  for (let i = 0; i < tries; i++) {
    await sleep(5000);
    let r;
    try { r = await api(`/api/image-generation/job/${jobId}`); } catch (e) { if (/HTTP 50[234]/.test(e.message)) continue; throw e; }
    const j = r.job || r;
    if (j.status === 'completed') return j.result || j.responseData || {};
    if (j.status === 'failed') throw new Error(`${label}: job failed: ${j.error || 'unknown'}`);
  }
  throw new Error(`${label}: did not complete in time`);
}
async function download(url, label) {
  const res = await fetch(url.startsWith('http') ? url : API_BASE + url, { headers: { 'X-API-Key': KEY } });
  if (!res.ok) throw new Error(`${label}: download failed HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const firstUrl = (r, ...keys) => {
  for (const k of keys) {
    let v = Array.isArray(r[k]) ? r[k][0] : r[k];
    if (v && typeof v === 'object') v = v.url || v.videoUrl || v.imageUrl;
    if (v) return v;
  }
  return null;
};
async function uploadImage(file, name) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'image/png' }), `${name}.png`);
  form.append('skipGallery', 'true');
  const res = await fetch(`${API_BASE}/api/image-generation/upload`, { method: 'POST', headers: { 'X-API-Key': KEY }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.imageUrl) throw new Error(`${name}: upload failed HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body.imageUrl;
}
async function balance() { return (await api('/api/tokens/balance')).tokenBalance; }
/** Ask a model that sees about one picture (rfab.ai's chat, which streams its answer), as the film system's gates do. */
async function look(image, question) {
  const body = { mode: 'grok', freshEachTurn: true, messages: [{ role: 'user', content: question, attachments: [{ kind: 'image', name: 'frames.jpg', dataUrl: `data:image/jpeg;base64,${fs.readFileSync(image).toString('base64')}` }] }] };
  const r = await fetch(`${API_BASE}/api/chat/based`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`look: HTTP ${r.status}`);
  let answer = '';
  for (const block of (await r.text()).split('\n\n')) {
    if (!/^event: delta$/m.test(block)) continue;
    const d = (block.match(/^data: (.*)$/m) ?? [])[1];
    if (!d) continue;
    try { const j = JSON.parse(d); if (typeof j.content === 'string') answer += j.content; } catch { /* not for us */ }
  }
  return answer.trim();
}

// ------------------------------------------------------------------ ffmpeg
function ff(args, label = 'ffmpeg') {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${label}: ffmpeg failed: ${(r.stderr || '').slice(0, 800)}`);
  return r;
}
const probe = (file, entries, stream = 'v:0') => spawnSync('ffprobe', ['-v', 'error', ...(stream ? ['-select_streams', stream] : []), '-show_entries', entries, '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim();
const duration = (file) => Number(probe(file, 'format=duration', null)) || 0;
const frameCount = (file) => Number(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim()) || 0;
function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const I = Number((r.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop()?.match(/-?[\d.]+/)[0]);
  const tp = Number((r.match(/Peak:\s+(-?[\d.]+) dBFS/g) ?? []).pop()?.match(/-?[\d.]+/)[0]);
  return { lufs: I, truePeak: tp };
}
/** Bring a sound to -14 LUFS integrated, true peak -1.5 dBTP (two-pass loudnorm, linear), as the trailers are. */
function loudnorm(raw, out) {
  const m = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  ff(['-i', raw, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`, '-c:a', 'pcm_s16le', out], 'loudnorm');
  return out;
}

// ------------------------------------------------------------------ files
/** Words as compared: lower case, no hyphens or punctuation. */
const norm = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/-/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const STILL = path.join(RAW, 'neko-169.png');
const PORTRAIT = path.join(RAW, 'persona-neko.png');
const takeFile = (take) => path.join(RAW, `take-${take}.mp4`);
const wordsFile = (take) => path.join(RAW, `take-${take}.words.json`);
const titlesDir = (take) => path.join(RAW, 'titles', take);
const takes = () => Object.keys(TAKES).filter((t) => fs.existsSync(takeFile(t)));
const needTake = () => {
  const t = TAKE ?? (fs.existsSync(path.join(RAW, 'chosen.txt')) ? fs.readFileSync(path.join(RAW, 'chosen.txt'), 'utf8').trim() : null);
  if (!t || !fs.existsSync(takeFile(t))) throw new Error(`which take? ${takes().join(', ') || 'none made yet'} (node tools/promo/intro.mjs ${cmd} <take>)`);
  return t;
};

// ------------------------------------------------------------------ STILL
if (cmd === 'still') {
  if (!fs.existsSync(PORTRAIT)) {
    const webp = path.join(RAW, 'persona-neko.webp');
    fs.writeFileSync(webp, Buffer.from(await (await fetch(PORTRAIT_URL)).arrayBuffer()));
    ff(['-i', webp, PORTRAIT], 'portrait png');
  }
  if (fs.existsSync(STILL)) { console.log(`  still: cached ${STILL}`); }
  else {
    const before = await balance();
    const imageUrl = await uploadImage(PORTRAIT, 'broodfall-intro-neko-ref');
    // img2img from her portrait: the same character, a new, wide picture. No quality tier (the API's default is its lowest:
    // Collins, Oct 4 2026, the model matters, the tier does not).
    const body = { prompt: STILL_PROMPT, modelId: 'seegen:gpt-image-2', width: 1536, height: 864, aspectRatio: '16:9', aspect_ratio: '16:9', imageUrls: [imageUrl], imageCount: 1, saveToGallery: false, nsfw: false, async: true };
    const start = await api('/api/image-generation/img2img', { method: 'POST', body: JSON.stringify(body) });
    const result = start.jobId ? await poll(start.jobId, 'still') : start;
    const url = firstUrl(result, 'imageUrl', 'images');
    if (!url) throw new Error('still: no picture URL');
    fs.writeFileSync(STILL, url.startsWith('data:') ? Buffer.from(url.split(',')[1], 'base64') : await download(url, 'still'));
    fs.writeFileSync(STILL.replace(/\.png$/, '.txt'), STILL_PROMPT);
    console.log(`  still: ${STILL} (${probe(STILL, 'stream=width,height')}), tokens spent ${before - await balance()}`);
  }
}

// ------------------------------------------------------------------ CLIPS: the acted takes, all at once
async function makeTake(take, imageUrl) {
  const t = TAKES[take];
  const out = takeFile(take);
  if (fs.existsSync(out)) { console.log(`  ${take}: cached`); return out; }
  const secs = t.seconds ?? SECONDS;
  const prompt = clipPrompt(t);
  let lastErr;
  for (const model of t.models) {
    try {
      const t0 = Date.now();
      console.log(`  ${take}: ${secs} s on ${model} at its lowest tier (${t.say ?? 'plain'}${t.pronounce ? ', told how to say it' : ''})`);
      // No `resolution`: the API's default is the model's lowest tier (Collins, Oct 4 2026: the model matters, the tier does not).
      const body = { imageUrl, prompt, videoModelId: model, duration: secs, aspect_ratio: '16:9', audio: true, nsfw: false, variationCount: 1, ...(t.tierReason ? { tierReason: t.tierReason } : {}) };
      const d = await api('/api/image-generation/generate-video', { method: 'POST', body: JSON.stringify(body) });
      const result = d.jobId ? await poll(d.jobId, `${take} clip`) : d;
      const url = firstUrl(result, 'videoUrl', 'imageUrl');
      if (!url) throw new Error(`${take}: no clip URL`);
      const buf = await download(url, `${take} clip`);
      fs.writeFileSync(out, buf);
      fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ model, seconds: secs, say: t.say ?? 'plain', pronounce: !!t.pronounce, tookSec: Math.round((Date.now() - t0) / 1000), url, prompt }, null, 1));
      console.log(`  ${take}: saved ${(buf.length / 1048576).toFixed(1)} MB in ${Math.round((Date.now() - t0) / 1000)} s (${probe(out, 'stream=width,height,r_frame_rate')}, ${duration(out).toFixed(2)} s)`);
      return out;
    } catch (e) { lastErr = e; console.warn(`  ${take}: ${model} failed: ${e.message.slice(0, 300)}`); }
  }
  throw lastErr;
}
if (cmd === 'clips') {
  if (!fs.existsSync(STILL)) throw new Error('her picture is not drawn yet: node tools/promo/intro.mjs still');
  const before = await balance();
  const imageUrl = await uploadImage(STILL, 'broodfall-intro-neko-169');
  const want = Object.keys(TAKES).filter((t) => TAKES[t].kind === 'i2v' && (!TAKE || t === TAKE));
  // Independent generations go out together, never one after another (Collins, Oct 29 2026).
  const results = await Promise.allSettled(want.map((t) => makeTake(t, imageUrl)));
  results.forEach((r, i) => { if (r.status === 'rejected') console.warn(`  ${want[i]}: FAILED: ${r.reason.message.slice(0, 300)}`); });
  console.log(`  tokens spent by clips: ${before - await balance()}`);
}

// ------------------------------------------------------------------ VOICE: her line as text-to-speech
const voiceFile = (id) => path.join(RAW, `voice-${id}.mp3`);
const chosenVoice = () => {
  const f = path.join(RAW, 'voice.txt');
  const id = rest.find((a) => a.startsWith('--voice='))?.slice(8) ?? (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : null);
  if (!id || !fs.existsSync(voiceFile(id))) throw new Error('no voice is made yet: node tools/promo/intro.mjs voice');
  return id;
};
async function makeVoice(id) {
  const out = voiceFile(id);
  if (fs.existsSync(out)) { console.log(`  ${id}: cached`); return out; }
  const r = await api('/api/audio/synthesize', { method: 'POST', body: JSON.stringify({ text: LINE_TTS, voice: id, direction: TTS_DIRECTION, format: 'mp3', returnUrl: true }) });
  if (!r.url) throw new Error(`${id}: no url in ${JSON.stringify(r).slice(0, 200)}`);
  fs.writeFileSync(out, await download(r.url, `${id} voice`));
  fs.writeFileSync(out.replace(/\.mp3$/, '.json'), JSON.stringify({ voice: id, url: r.url, tokensBilled: r.tokensBilled ?? null, text: LINE_TTS, direction: TTS_DIRECTION }, null, 1));
  return out;
}
if (cmd === 'voice') {
  const before = await balance();
  const want = VOICES.filter((v) => !TAKE || v === TAKE);
  const made = await Promise.allSettled(want.map(makeVoice));
  made.forEach((r, i) => { if (r.status === 'rejected') console.warn(`  ${want[i]}: FAILED: ${r.reason.message.slice(0, 300)}`); });
  const rows = [];
  for (const id of want) {
    if (!fs.existsSync(voiceFile(id))) continue;
    const heard = await hearWords(voiceFile(id));
    const al = alignWords(LINE_WORDS, heard.words);
    const hit = al.filter(Boolean).length;
    const ws = heard.words;
    let gap = 0; for (let i = 1; i < ws.length; i++) gap = Math.max(gap, ws[i].start - ws[i - 1].end);
    const row = { id, dur: +duration(voiceFile(id)).toFixed(2), hit, missed: LINE_WORDS.filter((w, i) => !al[i]), gap: +gap.toFixed(2), hz: Math.round(pitchOf(voiceFile(id))), heard: heard.text };
    rows.push(row);
    console.log(`  ${id}: ${row.dur} s, ${hit}/${LINE_WORDS.length} words${row.missed.length ? ` (missed ${row.missed.join(' ')})` : ''}, longest pause ${row.gap} s, ${row.hz} Hz: "${row.heard}"`);
  }
  const ok = rows.filter((r) => r.hit === LINE_WORDS.length && r.gap <= 1.3 && r.dur >= 8 && r.dur <= 14);
  const pick = VOICES.map((v) => ok.find((r) => r.id === v)).find(Boolean);
  if (pick) { fs.writeFileSync(path.join(RAW, 'voice.txt'), pick.id); console.log(`  chosen (first preferred voice heard whole): ${pick.id}`); }
  else console.log('  no voice was heard whole');
  console.log(`  tokens spent by voice: ${before - await balance()}`);
}

// ------------------------------------------------------------------ SYNC: her picture speaking the TTS track, two ways at once
/** How alike two sounds are: the peak of their normalized cross-correlation over the first 6 s (1 = the same track). */
function sameSound(a, b) {
  const SR = 8000;
  const pcm = (f) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', '6', '-i', f, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 26 }); return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4)); };
  const x = pcm(a), y = pcm(b);
  const n = Math.min(x.length, y.length) - SR; // a lag of up to 1 s either way
  if (n < SR) return 0;
  const norm = (v, o) => { let e = 0; for (let i = 0; i < n; i++) e += v[o + i] * v[o + i]; return Math.sqrt(e) || 1; };
  let best = 0;
  for (let lag = -SR; lag <= SR; lag += 8) {
    const ox = Math.max(0, lag), oy = Math.max(0, -lag);
    let c = 0; for (let i = 0; i < n; i += 1) c += x[ox + i] * y[oy + i];
    best = Math.max(best, Math.abs(c) / (norm(x, ox) * norm(y, oy)));
  }
  return best;
}
async function makeSync(take, imageUrl, voiceId) {
  const t = TAKES[take];
  const out = takeFile(take);
  if (fs.existsSync(out)) { console.log(`  ${take}: cached`); return out; }
  const v = JSON.parse(fs.readFileSync(voiceFile(voiceId).replace(/\.mp3$/, '.json'), 'utf8'));
  const secs = duration(voiceFile(voiceId));
  const t0 = Date.now();
  let d;
  if (take === 'omni') {
    console.log(`  ${take}: ${secs.toFixed(1)} s of ${voiceId} on ${t.model}`);
    d = await api('/api/image-generation/generate-lip-sync', { method: 'POST', body: JSON.stringify({ imageUrl, audioUrl: v.url, lipSyncModelId: t.model, prompt: SYNC_PROMPT_OMNI, async: true }) });
  } else {
    const dur = Math.min(30, Math.max(4, Math.ceil(secs + 0.5)));
    console.log(`  ${take}: ${dur} s on ${t.model} at 480p, @Audio1 = ${voiceId}`);
    d = await api('/api/image-generation/generate-video', { method: 'POST', body: JSON.stringify({ imageUrl, audioUrls: [v.url], prompt: SYNC_PROMPT_R2V, videoModelId: t.model, duration: dur, resolution: '480p', aspect_ratio: '16:9', audio: true, nsfw: false, variationCount: 1, tierReason: t.tierReason }) });
  }
  const result = d.jobId ? await poll(d.jobId, `${take}`, 360) : d;
  const url = firstUrl(result, 'videoUrl', 'imageUrl');
  if (!url) throw new Error(`${take}: no clip URL in ${JSON.stringify(result).slice(0, 200)}`);
  const buf = await download(url, `${take} clip`);
  fs.writeFileSync(out, buf);
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ model: t.model, voice: voiceId, seconds: secs, tookSec: Math.round((Date.now() - t0) / 1000), url }, null, 1));
  const alike = sameSound(out, voiceFile(voiceId));
  console.log(`  ${take}: saved ${(buf.length / 1048576).toFixed(1)} MB in ${Math.round((Date.now() - t0) / 1000)} s (${probe(out, 'stream=width,height,r_frame_rate')}, ${duration(out).toFixed(2)} s); its sound is ${alike >= 0.5 ? 'the TTS track' : 'NOT the TTS track'} (correlation ${alike.toFixed(2)})`);
  return out;
}
if (cmd === 'sync') {
  if (!fs.existsSync(STILL)) throw new Error('her picture is not drawn yet: node tools/promo/intro.mjs still');
  const voiceId = chosenVoice();
  const before = await balance();
  const imageUrl = await uploadImage(STILL, 'broodfall-intro-neko-169');
  const want = Object.keys(TAKES).filter((t) => TAKES[t].kind === 'sync' && (!TAKE || t === TAKE));
  const results = await Promise.allSettled(want.map((t) => makeSync(t, imageUrl, voiceId)));
  results.forEach((r, i) => { if (r.status === 'rejected') console.warn(`  ${want[i]}: FAILED: ${r.reason.message.slice(0, 400)}`); });
  console.log(`  tokens spent by sync: ${before - await balance()}`);
}

// ------------------------------------------------------------------ HEAR: the words and the gates
/** Two words are the same word as heard: exactly, one letter apart, or one the other plus an ending ("fabricators"). */
function sameWord(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
async function hearWords(file) {
  const cache = file.replace(/\.(mp4|mp3|wav)$/, '.words.json');
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(file).mtimeMs) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const wav = file.replace(/\.(mp4|mp3|wav)$/, '.16k.wav');
  ff(['-i', file, '-vn', '-ac', '1', '-ar', '16000', wav], 'wav');
  const r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(wav).toString('base64') }) });
  fs.rmSync(wav, { force: true });
  const text = String(r.transcript ?? r.text ?? '').trim();
  const words = (r.words ?? []).map((x) => ({ w: norm(String(x.word ?? x.punctuated_word ?? x.text ?? ''))[0] ?? '', start: x.start, end: x.end })).filter((x) => x.w);
  const out = { text, words, tokensBilled: r.tokensBilled ?? null };
  fs.writeFileSync(cache, JSON.stringify(out, null, 1));
  return out;
}
/** Where each written word was heard, in order (null where it was not): "R-Fab" may be heard as "our fab" or "arfab". */
function alignWords(want, heard) {
  const out = [];
  let pos = 0;
  for (let k = 0; k < want.length; k++) {
    const w = want[k];
    let hit = -1;
    for (let j = pos; j < Math.min(heard.length, pos + 4); j++) {
      const h = heard[j].w;
      if (sameWord(w, h) || (w === 'rfab' && (sameWord('fab', h) || sameWord('arfab', h) || sameWord('rfab', h + (heard[j + 1]?.w ?? '')) || sameWord('rfab', (heard[j - 1]?.w ?? '') + h)))) { hit = j; break; }
      if (w === 'api' && /^(api|apis|a|ap|pi|ipi|epi)$/.test(h)) { hit = j; break; }
    }
    if (hit < 0) { out.push(null); continue; }
    out.push({ i: hit, ...heard[hit] });
    pos = hit + 1;
  }
  return out;
}
/** The median pitch of a sound file (Hz): a woman's voice sits above about 165 Hz. */
function pitchOf(file) {
  const SR = 16000;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0 || !r.stdout.length) return 0;
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4));
  const N = 640, HOP = 320, lo = Math.floor(SR / 400), hi = Math.floor(SR / 70);
  const f0 = [];
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
function readRgb(file, t, W, H) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  return r.stdout;
}
const lum = (px) => { let s = 0, n = 0; for (let i = 0; i < px.length; i += 39) { s += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; n++; } return s / Math.max(1, n); };
function sharpOf(px, W, H) {
  let s = 0, n = 0;
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const i = (y * W + x) * 3;
    const g = (px) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const c = g(px), l = 0.299 * px[i - 3] + 0.587 * px[i - 2] + 0.114 * px[i - 1], r = 0.299 * px[i + 3] + 0.587 * px[i + 4] + 0.114 * px[i + 5];
    const u = 0.299 * px[i - W * 3] + 0.587 * px[i - W * 3 + 1] + 0.114 * px[i - W * 3 + 2], d = 0.299 * px[i + W * 3] + 0.587 * px[i + W * 3 + 1] + 0.114 * px[i + W * 3 + 2];
    s += Math.abs(4 * c - l - r - u - d); n++;
  }
  return s / Math.max(1, n);
}
/** Where the take is cut: the head so her first word lands at HEAD s (after the fade from black), the tail HOLD s after her last. */
const HEAD = 0.7, HOLD = 1.1;
function cutOf(words) {
  const first = words[0]?.start ?? 0, last = words[words.length - 1]?.end ?? SECONDS;
  // A negative head is a pad: her first frame held (and silence) so the first word still lands at HEAD s, after the fade.
  const hs = first - HEAD;
  return { hs, first, last, dur: Math.round((last - hs + HOLD) * FPS) / FPS };
}
/** What the listening model is asked (its answer is read line by line; the labels are the keys). */
const LISTEN_Q = 'This clip shows one character speaking a single line to camera. Answer in short labelled lines, each on its own line, in this order.\n'
  + 'HEARD: write exactly what she says, word for word, as you hear it (not what you expect).\n'
  + 'FABRICATOR: the line contains the brand name "Reality Fabricator". Listen closely to the word she says right after "Reality" and write it phonetically, syllable by syllable, stressed syllable in capitals. Standard American English for "fabricator" is FAB-ri-kay-ter (four syllables, stress on the first). Then on the next line write PRONUNCIATION: OK if what she says is that standard pronunciation, or PRONUNCIATION: WRONG and say exactly what differs (a dropped syllable, a different vowel, a different stress, a different word).\n'
  + 'CLAUDE: how she says "Claude" (standard: one syllable, KLAWD, rhymes with "flawed"): OK or WRONG and why.\n'
  + 'API: how she says "API" (standard: the three letters A, P, I): OK or WRONG and why.\n'
  + 'RFAB: how she says the name after "the" near the start (standard: "R-Fab", the letter R then "fab"): OK or WRONG and why.\n'
  + 'VOICE: is it a natural young woman\'s voice, clear, without robotic artifacts? Describe briefly.\n'
  + 'SYNC: does her mouth move in time with the words? YES or NO, then why.\n'
  + 'PICTURE: any visual defects: a warped face or hands, extra limbs, text or letters appearing anywhere, a second person, jump cuts, the camera moving? List them, or write NONE.';
async function gatesOf(take) {
  const f = takeFile(take);
  const heard = await hearWords(f);
  const al = alignWords(LINE_WORDS, heard.words);
  const fails = [], notes = [];
  const hit = al.filter(Boolean).length;
  const missed = LINE_WORDS.map((w, i) => (al[i] ? null : w)).filter(Boolean);
  if (hit < LINE_WORDS.length * 0.8) fails.push(`WORDS: ${hit} of ${LINE_WORDS.length} heard (missed: ${missed.join(' ')})`);
  else if (missed.length) notes.push(`words not heard: ${missed.join(' ')}`);
  if (heard.words.length > LINE_WORDS.length * 1.25 + 3) fails.push(`AD-LIB: ${heard.words.length} words heard for ${LINE_WORDS.length} written`);
  // ORDER: the brand sentence is heard whole and in order ("This, what is Reality Fabricator, unlocks" passed the count, Oct 30 2026).
  const tail = LINE_WORDS.indexOf('this', 13);
  if (al.slice(tail).some((x) => !x)) fails.push(`ORDER: the last sentence is not heard whole and in order ("${heard.text.split(/[.!?]\s*/).filter(Boolean).pop() ?? ''}")`);
  const ws = heard.words;
  const clipDur = duration(f);
  if (!ws.length) fails.push('SILENCE: nothing heard');
  else {
    if (ws[0].start > 2.5) fails.push(`SILENCE: she starts at ${ws[0].start.toFixed(2)} s`);
    let gap = 0, gapAt = 0;
    for (let i = 1; i < ws.length; i++) { const g = ws[i].start - ws[i - 1].end; if (g > gap) { gap = g; gapAt = ws[i - 1].end; } }
    if (gap > 1.3) fails.push(`SILENCE: a ${gap.toFixed(2)} s pause at ${gapAt.toFixed(2)} s`);
    else if (gap > 0.9) notes.push(`longest pause ${gap.toFixed(2)} s at ${gapAt.toFixed(2)} s`);
    if (ws[ws.length - 1].end > clipDur - 0.15) fails.push(`CUT OFF: her last word ends at ${ws[ws.length - 1].end.toFixed(2)} s of a ${clipDur.toFixed(2)} s clip`);
    const hz = pitchOf(f);
    if (hz && hz < 150) fails.push(`HER VOICE: ${Math.round(hz)} Hz is not a young woman's voice`); else notes.push(`pitch ${Math.round(hz)} Hz`);
  }
  // BRIGHT, SOFT: the picture holds from her first word to her last.
  const cut = cutOf(ws);
  const W = 640, H = 360;
  const a = readRgb(f, Math.min(cut.first, clipDur - 0.1), W, H), z = readRgb(f, Math.min(cut.last, clipDur - 0.1), W, H);
  if (a.length && z.length) {
    if (Math.abs(lum(z) - lum(a)) > 14) fails.push(`BRIGHT: brightness goes from ${lum(a).toFixed(0)} to ${lum(z).toFixed(0)}`);
    if (sharpOf(z, W, H) < sharpOf(a, W, H) * 0.45) fails.push(`SOFT: sharpness falls from ${Math.round(sharpOf(a, W, H))} to ${Math.round(sharpOf(z, W, H))}`);
    notes.push(`brightness ${lum(a).toFixed(0)} -> ${lum(z).toFixed(0)}, sharpness ${Math.round(sharpOf(a, W, H))} -> ${Math.round(sharpOf(z, W, H))}`);
  }
  // SEEN: eight frames to a model that sees: on model, no lettering, no static, nothing grows out of her.
  const strip = f.replace(/\.mp4$/, '-gate.jpg');
  const n = 8;
  const total = frameCount(f);
  ff(['-i', f, '-vf', `select='not(mod(n\\,${Math.max(1, Math.floor(total / n))}))',scale=480:270,tile=${n}x1`, '-fps_mode', 'passthrough', '-frames:v', '1', '-q:v', '4', strip], 'gate strip');
  const q = `These are ${n} frames of one video shot, in time order, left to right. It shows an anime catgirl with teal-and-pink hair, round glasses and glowing cat-ear headphones, talking to the camera at the left of a dark room. `
    + 'RULE 1 (MODEL): in every frame she is the same character with the same hair colours, glasses and cat-ear headphones; she does not turn into someone else and no second person appears. '
    + 'RULE 2 (TEXT): no readable letters, words, numbers or captions appear anywhere in any frame (faint abstract glyphs on blurry holographic panels do not count). '
    + 'RULE 3 (STATIC): the picture is clean in every frame: no snow, sparkles, floating specks or static over it. '
    + 'RULE 4 (BODY): her body stays whole and natural in every frame: nothing grows, sprouts or morphs out of her (no extra arms, hands or objects coming out of her body), and nothing melts, stretches or merges. '
    + 'Answer in exactly this form and nothing else: MODEL=YES or MODEL=NO (YES if rule 1 is broken in any frame); TEXT=YES or TEXT=NO (YES if rule 2 is broken); STATIC=YES or STATIC=NO (YES if rule 3 is broken); BODY=YES or BODY=NO (YES if rule 4 is broken); FRAMES=<the numbers of the frames that break a rule, or none>.';
  let seen = '';
  try {
    seen = await look(strip, q);
    const frames = (seen.match(/FRAMES=([^;.\n]*)/) ?? [])[1]?.trim() ?? '?';
    const named = !/^(none|\?|)$/i.test(frames);
    if (named && /MODEL=YES/i.test(seen)) fails.push(`MODEL: she goes off model (frames ${frames} of ${n})`);
    if (named && /TEXT=YES/i.test(seen)) fails.push(`TEXT: lettering appears in the picture (frames ${frames} of ${n})`);
    if (named && /STATIC=YES/i.test(seen)) fails.push(`STATIC: snow or sparkle over the picture (frames ${frames} of ${n})`);
    if (named && /BODY=YES/i.test(seen)) fails.push(`BODY: something grows or morphs (frames ${frames} of ${n})`);
    if (!/STATIC=(YES|NO)/i.test(seen)) notes.push(`the vision check gave no answer ("${seen.slice(0, 80)}")`);
  } catch (e) { notes.push(`the vision check could not be made (${e.message.slice(0, 120)}); the measured gates stand`); }
  const meta = JSON.parse(fs.readFileSync(f.replace(/\.mp4$/, '.json'), 'utf8'));
  // LISTEN: a model that HEARS the clip judges how the brand words are said. Transcription forgave "FAB-ri-ker" (it wrote
  // "Fabricator" for both Seedance takes, Oct 30 2026); Gemini watching the same clips heard the dropped syllable, and heard the
  // TTS track's four syllables as right: calibrated both ways before it became the gate. The clip is sent by its hosted link.
  let listen = '';
  if (meta.url && /^https?:/.test(meta.url)) {
    try {
      const r = await api('/api/tools/watch-video', { method: 'POST', body: JSON.stringify({ videoUrl: meta.url, question: LISTEN_Q }) });
      listen = String(r.answer ?? '').replace(/\*\*/g, '');
      const line = (k) => (listen.match(new RegExp(`${k}:\\s*([^\\n]*)`, 'i')) ?? [])[1]?.trim() ?? '';
      const pron = (listen.match(/PRONUNCIATION:\s*(OK|WRONG)/i) ?? [])[1]?.toUpperCase();
      if (pron === 'WRONG') fails.push(`FABRICATOR: ${line('FABRICATOR')} ${line('PRONUNCIATION')}`.trim());
      else if (pron === 'OK') notes.push(`"Fabricator" heard as ${line('FABRICATOR').replace(/\s*PRONUNCIATION.*$/i, '')}`);
      else notes.push('the listening check gave no verdict on "Fabricator"');
      for (const w of ['CLAUDE', 'API', 'RFAB']) { const v = line(w); if (/^wrong\b/i.test(v)) fails.push(`${w}: ${v}`); }
      const sync = line('SYNC'); if (/^no\b/i.test(sync)) fails.push(`SYNC: ${sync}`);
      const pic = line('PICTURE'); if (pic && !/^none\b/i.test(pic)) notes.push(`seen while listening: ${pic}`);
      const voice = line('VOICE'); if (voice) notes.push(`voice: ${voice}`);
      notes.push(`heard (listening model): ${line('HEARD')}`);
    } catch (e) { notes.push(`the listening check could not be made (${e.message.slice(0, 120)})`); }
  } else notes.push('no hosted link for this take: the listening check was not made');
  if (meta.voice && fs.existsSync(voiceFile(meta.voice))) {
    const alike = sameSound(f, voiceFile(meta.voice));
    if (alike < 0.5) fails.push(`TRACK: its sound is not the TTS track (correlation ${alike.toFixed(2)})`); else notes.push(`its sound is the TTS track ${meta.voice} (correlation ${alike.toFixed(2)})`);
  }
  const report = { take, model: meta.model, say: meta.say ?? null, pronounce: meta.pronounce ?? null, voice: meta.voice ?? null, clipSeconds: +clipDur.toFixed(2), heard: heard.text, words: heard.words.length, hit, missed, cut, pass: !fails.length, fails, notes, seen, listen, strip };
  fs.writeFileSync(f.replace(/\.mp4$/, '.gates.json'), JSON.stringify(report, null, 1));
  return report;
}
if (cmd === 'hear') {
  const want = takes().filter((t) => !TAKE || t === TAKE);
  if (!want.length) throw new Error('no take is made yet: node tools/promo/intro.mjs clips');
  const reports = await Promise.all(want.map(gatesOf));
  for (const r of reports) {
    console.log(`\n== ${r.take} (${r.model}, ${r.clipSeconds} s): ${r.pass ? 'PASSES' : 'FAILS'}`);
    console.log(`   heard: "${r.heard}"`);
    console.log(`   ${r.hit}/${LINE_WORDS.length} words; first word ${r.cut.first.toFixed(2)} s, last word ends ${r.cut.last.toFixed(2)} s; cut: head ${r.cut.hs.toFixed(2)} s, ${r.cut.dur.toFixed(2)} s long`);
    for (const f of r.fails) console.log(`   FAIL ${f}`);
    for (const n of r.notes) console.log(`   note ${n}`);
    console.log(`   seen: ${r.seen.replace(/\s+/g, ' ').slice(0, 160)}`);
    if (r.listen) console.log(`   listened: ${r.listen.replace(/\s+/g, ' ').slice(0, 400)}`);
    console.log(`   strip: ${r.strip}`);
  }
  const passing = reports.filter((r) => r.pass).sort((a, b) => b.hit - a.hit || a.cut.first - b.cut.first);
  if (passing.length) { fs.writeFileSync(path.join(RAW, 'chosen.txt'), passing[0].take); console.log(`\n  chosen (passes, most words heard): ${passing[0].take}`); }
  else console.log('\n  no take passes every gate');
}

// ------------------------------------------------------------------ TITLES: the type, animated in step with her words
/** When each cue falls in the TAKE's own time (seconds), from its transcript; the title frames run from the cut head. */
function cuesOf(take) {
  const { words } = JSON.parse(fs.readFileSync(wordsFile(take), 'utf8'));
  const al = alignWords(LINE_WORDS, words);
  const at = (k) => al[k]?.start ?? null;
  const first = words[0]?.start ?? 0, last = words[words.length - 1]?.end ?? SECONDS;
  // A word not heard takes its place between its neighbours.
  const fill = (k) => {
    if (at(k) != null) return at(k);
    let a = k - 1; while (a >= 0 && at(a) == null) a--;
    let b = k + 1; while (b < LINE_WORDS.length && at(b) == null) b++;
    const ta = a >= 0 ? at(a) : first, tb = b < LINE_WORDS.length ? at(b) : last;
    return ta + (tb - ta) * ((k - a) / (b - a));
  };
  // LINE_WORDS: 0 claude 1 code 2 and 3 the 4 rfab 5 api 6 built 7 this 8 game 9 and 10 this 11 trailer 12 with 13 only 14 limited
  //             15 human 16 interaction 17 this 18 is 19 what 20 reality 21 fabricator 22 unlocks
  return { claude: at(0) ?? first, the: fill(3), rfab: fill(4), built: fill(6), with: fill(12), thisIs: fill(17), reality: fill(20), unlocks: fill(22), first, last };
}
function titlePage(cues, hs) {
  const logo = fs.readFileSync(path.join(RAW, 'rfab_white_logo.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/id="Layer_1"/, 'id="rfab-logo"');
  const c = Object.fromEntries(Object.entries(cues).map(([k, v]) => [k, +(v - hs).toFixed(3)]));
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=block">
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1920px;height:1080px;background:transparent;overflow:hidden}
#shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,4,8,0) 34%,rgba(3,4,8,.45) 50%,rgba(3,4,8,.72) 70%,rgba(3,4,8,.8) 100%);opacity:0}
.panel{position:absolute;left:1000px;right:60px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:0}
.big{font-family:Oswald,"Arial Narrow",sans-serif;font-weight:700;font-size:92px;line-height:1.08;letter-spacing:.05em;color:#f6fbfc;text-shadow:0 2px 0 rgba(0,0,0,.9),0 0 18px rgba(0,0,0,.9),0 0 46px rgba(0,0,0,.7);white-space:nowrap}
.aqua{color:#49f2ff;text-shadow:0 2px 0 rgba(0,0,0,.9),0 0 18px rgba(0,0,0,.9),0 0 32px rgba(73,242,255,.45)}
.plus{color:#49f2ff}
.caret{display:inline-block;width:.42em;margin-left:.06em;color:#49f2ff;transform:translateY(-.02em)}
#p2 .big{font-size:84px}
.line{font-family:Bahnschrift,"Segoe UI",sans-serif;font-weight:600;font-size:46px;line-height:1.3;letter-spacing:.01em;color:#e6f3f5;text-shadow:0 2px 3px #000,0 0 16px rgba(0,0,0,.95),0 0 30px rgba(0,0,0,.7);margin-top:26px;white-space:nowrap}
.line + .line{margin-top:8px}
#logo{margin-top:54px;width:560px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.9)) drop-shadow(0 0 18px rgba(0,0,0,.8))}
#logo svg{width:100%;height:auto;display:block}
.anim{opacity:0;transform:translateY(26px)}
</style></head><body>
<div id="shade"></div>
<div class="panel" id="p1">
  <div class="big"><span id="l1t"></span><span class="caret" id="c1"></span></div>
  <div class="big" id="l1b"><span class="plus">+</span> <span id="l1bt"></span><span class="caret" id="c2"></span></div>
  <div class="line anim" id="l2">built this game <span class="plus">+</span> trailer</div>
  <div class="line anim" id="l3">with only limited human interaction.</div>
</div>
<div class="panel" id="p2" style="opacity:0">
  <div class="big anim" id="q1">THIS IS WHAT</div>
  <div class="big aqua anim" id="q2">REALITY FABRICATOR</div>
  <div class="big anim" id="q3">UNLOCKS.</div>
  <div id="logo" class="anim">${logo}</div>
</div>
<script>
const C = ${JSON.stringify(c)};
const $ = (id) => document.getElementById(id);
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => 1 - Math.pow(1 - clamp(v), 3);
const L1 = 'CLAUDE CODE', L1B = 'THE RFAB API';
function typed(el, text, t0, dur, t) { const n = Math.round(clamp((t - t0) / dur) * text.length); el.textContent = text.slice(0, n); return n; }
function slide(el, t0, t, d = 0.42) { const k = ease((t - t0) / d); el.style.opacity = k; el.style.transform = 'translateY(' + (26 * (1 - k)).toFixed(2) + 'px)'; }
window.setT = (t) => {
  $('shade').style.opacity = ease(t / 0.6);
  // the first line types itself as she says it; the caret blinks while it types and goes with the second line's last letter
  const n1 = typed($('l1t'), L1, C.claude - 0.05, 0.55, t);
  const t1b = C.the - 0.05;
  const n1b = typed($('l1bt'), L1B, t1b + 0.12, 0.6, t);
  $('l1b').style.opacity = t >= t1b ? 1 : 0;
  const typingDone = n1b >= L1B.length && t > t1b + 0.12 + 0.6 + 0.9;
  const blink = Math.floor(t / 0.45) % 2 === 0;
  $('c1').textContent = (t >= C.claude - 0.25 && t < t1b && blink) ? '▍' : '';
  $('c2').textContent = (t >= t1b && !typingDone && blink) ? '▍' : '';
  slide($('l2'), C.built - 0.05, t);
  slide($('l3'), C.with - 0.05, t);
  // the punch line: everything before it goes, and it comes in word by word, the logo under it
  const tp = C.thisIs - 0.12;
  $('p1').style.opacity = 1 - ease((t - tp) / 0.3);
  $('p2').style.opacity = t >= tp + 0.1 ? 1 : 0;
  slide($('q1'), tp + 0.1, t, 0.38);
  slide($('q2'), C.reality - 0.05, t, 0.4);
  slide($('q3'), C.unlocks - 0.05, t, 0.4);
  slide($('logo'), C.unlocks + 0.3, t, 0.55);
};
</script></body></html>`;
}
if (cmd === 'titles') {
  const take = needTake();
  const logoSrc = path.join(RAW, 'rfab_white_logo.svg');
  if (!fs.existsSync(logoSrc)) fs.copyFileSync(path.resolve(ROOT, '..', '..', '..', 'reality-fabricator', 'reality-fabricator-frontend', 'src', 'assets', 'rfab_white_logo.svg'), logoSrc);
  const cues = cuesOf(take);
  const { words } = JSON.parse(fs.readFileSync(wordsFile(take), 'utf8'));
  const cut = cutOf(words);
  const N = Math.round(cut.dur * FPS);
  const dir = titlesDir(take);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const html = titlePage(cues, cut.hs);
  fs.writeFileSync(path.join(dir, 'page.html'), html);
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ cues, cut, N }, null, 1));
  console.log(`  cues (take time): ${Object.entries(cues).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ')}; head ${cut.hs.toFixed(2)} s, ${N} frames`);
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      await page.evaluate((t) => window.setT(t), i / FPS);
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.png`), omitBackground: true });
      if (i % 120 === 0) console.log(`  frame ${i}/${N}`);
    }
    console.log(`  ${N} frames in ${dir} (${Math.round((Date.now() - t0) / 1000)} s)`);
  } finally { await browser.close(); }
}

// ------------------------------------------------------------------ CUT: the intro, then the trailers with it in front
/** The two trailers the intro goes in front of; the store files are not touched. */
const TRAILERS = [
  { src: 'broodfall-trailer-90s.mp4', out: 'broodfall-trailer-yc-demo.mp4', cap: '4.0M', crf: 20 },
  { src: 'broodfall-trailer-gameplay.mp4', out: 'broodfall-trailer-yc-demo-gameplay.mp4', cap: '6.0M', crf: 19 },
];
function introSegment(take) {
  const clip = takeFile(take);
  const { words } = JSON.parse(fs.readFileSync(wordsFile(take), 'utf8'));
  const cut = cutOf(words);
  const N = Math.round(cut.dur * FPS);
  const D = cut.dur;
  const dir = titlesDir(take);
  if (!fs.existsSync(path.join(dir, `f${String(N - 1).padStart(5, '0')}.png`))) throw new Error(`the title frames are not made for ${take}: node tools/promo/intro.mjs titles ${take}`);
  const video = path.join(RAW, `intro-${take}-video.mp4`);
  const wav = path.join(RAW, `intro-${take}.wav`);
  // The sound: her voice, in from the cut head, out over the hold, at the trailers' loudness.
  const raw = path.join(RAW, `intro-${take}-raw.wav`);
  const pad = Math.max(0, -cut.hs), ss = Math.max(0, cut.hs), padMs = Math.round(pad * 1000);
  ff(['-ss', ss.toFixed(3), '-t', D.toFixed(3), '-i', clip, '-vn', '-af', `aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,afade=t=in:st=0:d=0.12,adelay=${padMs}|${padMs},afade=t=out:st=${(D - 0.55).toFixed(3)}:d=0.55,apad=whole_dur=${D.toFixed(3)},atrim=0:${D.toFixed(3)}`, '-c:a', 'pcm_f32le', raw], 'intro sound');
  loudnorm(raw, wav);
  // The picture: the take scaled to the frame, the type over it, from black and to black.
  const f = [
    // The take ends before the hold after her last word does: her last frame is held (cloned) to the end, so the picture
    // runs exactly as long as the sound. (The first build let the overlay stop at the shorter input: 48 frames short, and
    // the whole trailer's picture 0.8 s ahead of its sound.)
    `[0:v]setpts=PTS-STARTPTS,fps=${FPS},${pad ? `tpad=start_mode=clone:start_duration=${pad.toFixed(3)},` : ''}tpad=stop_mode=clone:stop_duration=3,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,format=rgba[v]`,
    '[1:v]format=rgba[t]',
    `[v][t]overlay=0:0:shortest=0,fade=t=in:st=0:d=0.5,fade=t=out:st=${(D - 0.35).toFixed(3)}:d=0.35,format=yuv420p[out]`,
  ];
  ff(['-ss', ss.toFixed(3), '-t', (D + 0.5).toFixed(3), '-i', clip, '-framerate', String(FPS), '-start_number', '0', '-i', path.join(dir, 'f%05d.png'), '-filter_complex', f.join(';'), '-map', '[out]', '-frames:v', String(N), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-an', video], 'intro picture');
  const got = frameCount(video), wavDur = duration(wav);
  if (got !== N) throw new Error(`the intro picture is ${got} frames, not ${N}`);
  if (Math.abs(wavDur - D) > 0.02) throw new Error(`the intro sound is ${wavDur.toFixed(3)} s, not ${D.toFixed(3)}`);
  const master = path.join(RAW, `intro-${take}-master.mp4`);
  ff(['-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', master], 'intro master');
  console.log(`  intro: ${master} (${D.toFixed(2)} s, ${N} frames, ${JSON.stringify(measure(master))})`);
  return { video, wav, D, N, master };
}
if (cmd === 'cut') {
  const take = needTake();
  const seg = introSegment(take);
  const which = rest.filter((a) => a !== take && !a.startsWith('--'));
  for (const tr of TRAILERS) {
    if (which.length && !which.some((w) => tr.src.includes(w) || tr.out.includes(w))) continue;
    const src = path.join(OUT, tr.src);
    const out = path.join(OUT, tr.out);
    const vdur = Number(probe(src, 'stream=duration')) || duration(src);
    const total = seg.D + vdur;
    // Both trailers' pictures hold the full 0..255 range under a limited-range label (measured Oct 30 2026: YMIN 0, YMAX 255);
    // they are passed through as they are, never converted, so they look exactly as the store files do.
    const f = [
      `[0:v]setparams=range=tv,format=yuv420p,setsar=1,fps=${FPS}[v0]`,
      `[2:v]setparams=range=tv,format=yuv420p,setsar=1,fps=${FPS}[v1]`,
      '[v0][v1]concat=n=2:v=1:a=0[v]',
      `[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${seg.D.toFixed(3)},apad=whole_dur=${seg.D.toFixed(3)}[a0]`,
      `[2:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${vdur.toFixed(3)},apad=whole_dur=${vdur.toFixed(3)}[a1]`,
      '[a0][a1]concat=n=2:v=0:a=1[a]',
    ];
    const enc = (crf, cap, file) => ff(['-i', seg.video, '-i', seg.wav, '-i', src, '-filter_complex', f.join(';'), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), ...(cap ? ['-maxrate', cap, '-bufsize', '9M'] : []), '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '120', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', total.toFixed(3), file], `final ${tr.out}`);
    const master = path.join(RAW, tr.out.replace(/\.mp4$/, '-master.mp4'));
    enc(16, null, master);
    enc(tr.crf, tr.cap, out);
    // The picture and the sound of the finished file are the same length, to the frame: the intro's frames plus the trailer's.
    // (ffprobe counts the gameplay cut's frames as 0 on one run and 3353 on the next: its length times the rate stands in.)
    const srcFrames = frameCount(src) || Math.round(vdur * FPS);
    const wantFrames = seg.N + srcFrames, gotFrames = frameCount(out) || Math.round(Number(probe(out, 'stream=duration')) * FPS);
    const vLen = Number(probe(out, 'stream=duration')), aLen = Number(probe(out, 'stream=duration', 'a:0'));
    if (gotFrames !== wantFrames) throw new Error(`${tr.out}: ${gotFrames} frames, not ${wantFrames} (${seg.N} + ${wantFrames - seg.N})`);
    if (Math.abs(vLen - aLen) > 0.05) throw new Error(`${tr.out}: picture ${vLen.toFixed(3)} s, sound ${aLen.toFixed(3)} s`);
    const m = measure(out);
    console.log(`  ${out}: ${duration(out).toFixed(2)} s (intro ${seg.D.toFixed(2)} + trailer ${vdur.toFixed(2)}), ${gotFrames} frames, picture ${vLen.toFixed(3)} s / sound ${aLen.toFixed(3)} s, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB, ${m.lufs} LUFS, true peak ${m.truePeak} dBTP; master ${master}`);
  }
}

// ------------------------------------------------------------------ SHEET: frames of the intro to look at
if (cmd === 'sheet') {
  const take = needTake();
  const file = rest.includes('--final') ? path.join(OUT, TRAILERS[0].out) : path.join(RAW, `intro-${take}-master.mp4`);
  const every = Number((rest.find((a) => a.startsWith('--every=')) ?? '--every=0.5').split('=')[1]);
  const n = Math.min(24, Math.floor(duration(file) / every));
  const out = path.join(RAW, `sheet-${take}${rest.includes('--final') ? '-final' : ''}.jpg`);
  ff(['-i', file, '-vf', `fps=1/${every},scale=640:360,drawtext=fontfile='C\\:/Windows/Fonts/bahnschrift.ttf':text='%{pts\\:hms}':x=10:y=h-30:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6,tile=4x${Math.ceil(n / 4)}`, '-frames:v', '1', '-q:v', '3', out], 'sheet');
  console.log(`  ${out} (${n} frames, one every ${every} s)`);
}

// A look at the type before any take exists: frames at nominal cue times over a dark ground (art-src/trailer/intro/titles/preview/).
if (cmd === 'preview') {
  const logoSrc = path.join(RAW, 'rfab_white_logo.svg');
  if (!fs.existsSync(logoSrc)) fs.copyFileSync(path.resolve(ROOT, '..', '..', '..', 'reality-fabricator', 'reality-fabricator-frontend', 'src', 'assets', 'rfab_white_logo.svg'), logoSrc);
  const cues = { claude: 0.7, the: 1.55, rfab: 1.9, built: 2.7, with: 4.6, thisIs: 7.2, reality: 8.0, unlocks: 8.9, first: 0.7, last: 9.6 };
  const dir = path.join(RAW, 'titles', 'preview');
  fs.mkdirSync(dir, { recursive: true });
  const html = titlePage(cues, 0).replace('background:transparent;overflow:hidden}', 'background:#0a0b10;overflow:hidden}');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    for (const t of [1.0, 1.85, 2.4, 3.1, 5.2, 7.5, 8.4, 9.6]) {
      await page.evaluate((t) => window.setT(t), t);
      await page.screenshot({ path: path.join(dir, `t${t.toFixed(2)}.png`) });
    }
    console.log(`  ${dir}`);
  } finally { await browser.close(); }
}

if (cmd === 'help') console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
