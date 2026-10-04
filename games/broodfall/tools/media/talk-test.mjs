/**
 * WHICH VIDEO MODEL ACTS A CONVERSATION (Oct 4 2026). Collins, of the remade first film (every line its own clip on
 * Veo 3.1 Lite, the cheapest Veo): "the words sound like they were generated with AI then the video was created around
 * them; that sounds stilted and is not good for voice acting; all the frontier video models can do talking".
 *
 * The same exchange, from the same picture, on each model that talks: the chief delegate's greeting and his reply in ONE
 * clip, so that the turn-taking is the model's own acting (not a cut every line), with a prompt that asks for a
 * performance. For each: what was heard (the words, in order), how long the pause between the two is, how much each
 * voice moves (the spread of its pitch in semitones: a read-out voice is flat), and a strip of frames (is he still seen
 * from behind; is the picture clean). An agent cannot hear: the ear that decides is Collins's, so the clips are copied
 * to the Desktop, named by model.
 *
 *   node tools/media/talk-test.mjs make [model ...]   (SPENDS: about $1 to $4 a clip; names below)
 *   node tools/media/talk-test.mjs measure            (the words are transcribed: a few tokens)
 *   node tools/media/talk-test.mjs desk               (copies to the Desktop)
 * Raw: art-src-new/cutscenes/talk-test/.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeClip } from '../art/rfab.mjs';
import { ROOT, api, balance } from './lib.mjs';

const DIR = path.join(ROOT, 'art-src-new', 'cutscenes', 'talk-test');
const STILL = path.join(ROOT, 'art-src-new', 'cutscenes', 'stills', 'summit-ots-169.png');
fs.mkdirSync(DIR, { recursive: true });

/** The models that talk (rfab.ai's catalog, Oct 4 2026): name on the Desktop, id, seconds, resolution. */
export const MODELS = {
  'veo-3.1-lite': { id: 'imagerouter:veo-3.1-lite-i2v', seconds: 8, resolution: '720p' },   // what the film was made on
  'veo-3.1-fast': { id: 'replicate:google/veo-3.1-fast', seconds: 8, resolution: '720p' },
  'seedance-2.5': { id: 'imagerouter:seedance-2.5-i2v', seconds: 8, resolution: '720p' },
  'kling-3.0-turbo': { id: 'imagerouter:kling-3.0-turbo-i2v', seconds: 8, resolution: '720p' },
  'wan-3.0-prime': { id: 'seegen:wan3.0-video-prime', seconds: 8, resolution: '720p' },
  'gemini-omni': { id: 'gemini:gemini-omni-1.1-flash', seconds: 8, resolution: '720p' },
};

export const LINES = [
  { who: 'Delegate', text: 'Visitor! Welcome, welcome. We are so happy you came.' },
  { who: 'You', text: 'You are happy to see me. Why?' },
];

/**
 * A performance, not a read-out: who is in the picture, what each FEELS and does, the two lines inside the action, and
 * the pause between them. He is "the blue figure" (the picture shows what he is: the word for it invites sparkles).
 */
export const PROMPT =
  'One locked-off over-the-shoulder shot in a hotel conference room, a scene from a 1950s colour science-fiction comedy. '
  + 'In the left foreground the pale blue translucent figure of a young man stands with his back to the camera; he faces away for the whole shot and we never see his face. '
  + 'Facing him, the chief delegate, an elderly insect woman in a cardigan and a flower garland, is overjoyed to meet him: she opens her upper arms wide and says, warm and breathless with delight, like a kindly retired schoolteacher greeting a guest of honour: '
  + `"${LINES[0].text}" `
  + 'The delegates behind her beam and nod. He lets a beat pass. Then, without turning round, he answers in a mild, dry, slightly wary young man\'s voice, honestly puzzled: '
  + `"${LINES[1].text}" `
  + 'She tilts her head and keeps smiling. '
  + 'Natural, unhurried acting with real pauses and breaths, the way two actors play a scene together. Only these two speak, and only these words. '
  + 'The room and everyone in it stay exactly as they are in the first frame. Quiet room tone; no music.';

const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 28 });
const fileOf = (name) => path.join(DIR, `${name}.mp4`);

async function make(names) {
  const before = await balance();
  await Promise.all(names.map(async (name) => {
    const m = MODELS[name];
    if (!m) { console.warn(`no model named ${name}`); return; }
    try {
      await makeClip({ slug: `talk-${name}`, stillFile: STILL, out: fileOf(name), models: [m.id], prompt: PROMPT, seconds: m.seconds, loop: false, raw: true, resolution: m.resolution, aspect: '16:9', audio: true });
    } catch (e) { console.warn(`[talk] ${name}: ${String(e.message ?? e).slice(0, 300)}`); }
  }));
  const after = await balance();
  console.log(`[talk] spent ${before - after} tokens (about $${((before - after) / 50000).toFixed(2)}; other sessions' spending may be in it)`);
}

/** The pitch of a stretch of sound, every 10 ms where it is voiced (autocorrelation, 75-400 Hz). */
function pitchTrack(pcm, rate, t0, t1) {
  const out = [];
  const win = Math.round(rate * 0.04), hop = Math.round(rate * 0.01);
  const lo = Math.floor(rate / 400), hi = Math.ceil(rate / 75);
  for (let s = Math.max(0, Math.round(t0 * rate)); s + win < Math.min(pcm.length, Math.round(t1 * rate)); s += hop) {
    let e = 0;
    for (let i = 0; i < win; i++) e += pcm[s + i] * pcm[s + i];
    if (e / win < 1e-4) continue;
    let best = 0, lag = 0;
    for (let l = lo; l <= hi; l++) {
      let c = 0, a = 0, b = 0;
      for (let i = 0; i + l < win; i++) { c += pcm[s + i] * pcm[s + i + l]; a += pcm[s + i] * pcm[s + i]; b += pcm[s + i + l] * pcm[s + i + l]; }
      const r = c / Math.sqrt(a * b + 1e-12);
      if (r > best) { best = r; lag = l; }
    }
    if (best > 0.6 && lag) out.push(rate / lag);
  }
  return out;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
/** How much a voice moves: the spread of its pitch round its median, in semitones (the middle 80% of it). */
function spreadSemitones(f0) {
  if (f0.length < 8) return 0;
  const m = median(f0);
  const st = f0.map((f) => 12 * Math.log2(f / m)).sort((a, b) => a - b);
  return st[Math.floor(st.length * 0.9)] - st[Math.floor(st.length * 0.1)];
}
const norm = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

async function measure() {
  const rows = [];
  for (const name of Object.keys(MODELS)) {
    const f = fileOf(name);
    if (!fs.existsSync(f)) continue;
    const wav = f.replace(/\.mp4$/, '.wav');
    ff(['-i', f, '-vn', '-ac', '1', '-ar', '16000', wav]);
    const cache = f.replace(/\.mp4$/, '.words.json');
    let r;
    if (fs.existsSync(cache)) r = JSON.parse(fs.readFileSync(cache, 'utf8'));
    else { r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(wav).toString('base64') }) }); fs.writeFileSync(cache, JSON.stringify(r)); }
    const text = String(r.transcript ?? r.text ?? '').trim();
    const words = (r.words ?? []).map((w) => ({ w: norm(String(w.word ?? w.punctuated_word ?? w.text ?? ''))[0] ?? '', start: w.start, end: w.end }));
    // Where her line ends and his begins: the first of his words ("you") after hers ("came").
    const hers = norm(LINES[0].text), his = norm(LINES[1].text);
    const iCame = words.findIndex((w) => w.w === hers[hers.length - 1]);
    const iYou = words.findIndex((w, i) => i > Math.max(0, iCame) && w.w === his[0]);
    const raw = fs.readFileSync(wav);
    const pcm = new Float32Array((raw.length - 44) / 2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = raw.readInt16LE(44 + i * 2) / 32768;
    const span = (a, b) => (a >= 0 && b >= a ? pitchTrack(pcm, 16000, words[a].start, words[b].end) : []);
    const her = span(0, iCame >= 0 ? iCame : -1);
    const him = iYou >= 0 ? span(iYou, words.length - 1) : [];
    const got = norm(text);
    const want = [...hers, ...his];
    let n = 0; const bag = [...got];
    for (const w of want) { const i = bag.indexOf(w); if (i >= 0) { n++; bag.splice(i, 1); } }
    const strip = f.replace(/\.mp4$/, '-strip.jpg');
    ff(['-i', f, '-vf', 'fps=1,scale=480:270,tile=8x1', '-frames:v', '1', strip]);
    rows.push({
      name, heard: Math.round(100 * n / want.length), extra: bag.length, text,
      pause: iCame >= 0 && iYou >= 0 ? +(words[iYou].start - words[iCame].end).toFixed(2) : null,
      her: { hz: Math.round(median(her)), spread: +spreadSemitones(her).toFixed(1), wps: iCame > 0 ? +((iCame + 1) / (words[iCame].end - words[0].start)).toFixed(1) : null },
      him: { hz: Math.round(median(him)), spread: +spreadSemitones(him).toFixed(1), wps: iYou >= 0 ? +((words.length - iYou) / (words[words.length - 1].end - words[iYou].start)).toFixed(1) : null },
    });
    fs.rmSync(wav, { force: true });
  }
  fs.writeFileSync(path.join(DIR, 'measured.json'), JSON.stringify(rows, null, 1));
  console.log('model            heard extra  pause   her: Hz spread w/s    him: Hz spread w/s   said');
  for (const r of rows) console.log(`${r.name.padEnd(16)} ${String(r.heard).padStart(4)}% ${String(r.extra).padStart(4)}  ${String(r.pause ?? '-').padStart(5)}s  ${String(r.her.hz).padStart(6)} ${String(r.her.spread).padStart(5)}st ${String(r.her.wps ?? '-').padStart(4)}  ${String(r.him.hz).padStart(6)} ${String(r.him.spread).padStart(5)}st ${String(r.him.wps ?? '-').padStart(4)}   ${r.text.slice(0, 90)}`);
}

function desk() {
  const dir = path.join(os.homedir(), 'Desktop', 'Broodfall cut scenes', 'voice test (Oct 4)');
  fs.mkdirSync(dir, { recursive: true });
  for (const name of Object.keys(MODELS)) if (fs.existsSync(fileOf(name))) { fs.copyFileSync(fileOf(name), path.join(dir, `${name}.mp4`)); console.log(path.join(dir, `${name}.mp4`)); }
}

const [step, ...rest] = process.argv.slice(2);
if (step === 'make') await make(rest.length ? rest : Object.keys(MODELS));
else if (step === 'measure') await measure();
else if (step === 'desk') desk();
else console.log('usage: node tools/media/talk-test.mjs make [model ...] | measure | desk');
