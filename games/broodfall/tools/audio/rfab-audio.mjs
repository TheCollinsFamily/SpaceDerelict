/**
 * The RFab calls of the sound pipeline (tools/audio/make.mjs). Every call SPENDS tokens on the
 * account whose key is RFAB_API_KEY; every step skips work whose raw file already exists, so a
 * re-run costs nothing.
 *
 * What RFab exposes for sound (Sep 30 2026):
 *   - MUSIC: POST /api/music/generate (Mureka V9/V9.5/O2, Lyria 3 / 3 Pro, MiniMax 2.5/2.6,
 *     Eleven Music v2), a job; the finished takes are rows of GET /api/music/songs.
 *   - SPEECH: POST /api/audio/synthesize (TTS voices).
 *   - SOUND EFFECTS: no route of their own (no ElevenLabs sound-generation, no text-to-audio).
 *     The closest route is a text-to-video model that makes its own soundtrack
 *     (POST /api/image-generation/generate-video with audio on); the picture is thrown away
 *     and the sound is kept.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const API_BASE = process.env.RFAB_API_BASE || 'https://api.rfab.ai';
const API_KEY = process.env.RFAB_API_KEY;
/** Raw takes (video with sound, songs): not committed (art-src/ is in .gitignore). */
export const RAW = path.join(ROOT, 'art-src', 'audio');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ready() {
  if (!API_KEY) { console.error('RFAB_API_KEY is not set'); process.exit(1); }
  fs.mkdirSync(RAW, { recursive: true });
}

export async function api(pathname, opts = {}) {
  const res = await fetch(API_BASE + pathname, {
    ...opts,
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`); }
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

async function download(url, label) {
  const res = await fetch(url.startsWith('http') ? url : API_BASE + url, { headers: { 'X-API-Key': API_KEY } });
  if (!res.ok) throw new Error(`${label}: download failed HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function pollJob(jobId, label, tries = 240) {
  for (let i = 0; i < tries; i++) {
    await sleep(5000);
    let r;
    try { r = await api(`/api/image-generation/job/${jobId}`); } catch (e) {
      if (/HTTP 50[234]/.test(e.message)) continue;
      throw e;
    }
    const j = r.job || r;
    if (j.status === 'completed') return j.result || j.responseData || {};
    if (j.status === 'failed') throw new Error(`${label}: job failed: ${j.error || 'unknown'}`);
  }
  throw new Error(`${label}: did not complete in time`);
}

const firstUrl = (r, ...keys) => {
  for (const k of keys) {
    let v = Array.isArray(r[k]) ? r[k][0] : r[k];
    if (v && typeof v === 'object') v = v.url || v.videoUrl || v.audioUrl;
    if (v) return v;
  }
  return null;
};

export const spent = { videos: 0, songs: 0, speech: 0 };

/**
 * A sound effect, through a text-to-video model with its own soundtrack. Saves the clip
 * (art-src/audio/<id>.mp4) and returns its path; the sound is cut out of it by make.mjs.
 */
export async function soundTake({ id, prompt, model = 'imagerouter:veo-3.1-lite-t2v', seconds = 4, resolution = '720p', aspect = '16:9', dir = RAW }) {
  const out = path.join(dir, `${id}.mp4`);
  if (fs.existsSync(out)) return out;
  spent.videos += 1;
  const t0 = Date.now();
  const d = await api('/api/image-generation/generate-video', {
    method: 'POST',
    body: JSON.stringify({ prompt, videoModelId: model, duration: seconds, resolution, aspect_ratio: aspect, audio: true, nsfw: false, variationCount: 1 }),
  });
  const result = d.jobId ? await pollJob(d.jobId, id) : d;
  const url = firstUrl(result, 'videoUrl', 'videos', 'imageUrl');
  if (!url) throw new Error(`${id}: no clip URL in ${JSON.stringify(result).slice(0, 300)}`);
  fs.writeFileSync(out, await download(url, id));
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ model, seconds, prompt, tookSec: Math.round((Date.now() - t0) / 1000), tokens: result.tokensCharged ?? d.tokensCharged ?? null }, null, 1));
  console.log(`[sfx] ${id}: ${model} ${seconds}s in ${Math.round((Date.now() - t0) / 1000)}s`);
  return out;
}

/**
 * A piece of music. Saves every take the model returns (art-src/audio/<id>-take<n>.mp3) and
 * returns their paths.
 */
export async function songTakes({ id, spec, model = 'mureka:mureka-9' }) {
  const done = fs.readdirSync(RAW).filter((f) => f.startsWith(`${id}-take`) && /\.(mp3|wav|m4a|ogg)$/.test(f));
  if (done.length) return done.sort().map((f) => path.join(RAW, f));
  spent.songs += 1;
  const t0 = Date.now();
  const since = new Date(Date.now() - 5000).toISOString();
  const r = await api('/api/music/generate', { method: 'POST', body: JSON.stringify({ spec, models: [model], variations: 1 }) });
  const job = r.jobs?.[0];
  if (!job) throw new Error(`${id}: no job in ${JSON.stringify(r).slice(0, 300)}`);
  let songs = job.result?.songs || null;
  for (let i = 0; !songs && i < 240; i++) {
    await sleep(6000);
    const list = await api('/api/music/songs?limit=30').catch((e) => { if (/HTTP 50[234]/.test(e.message)) return { songs: [] }; throw e; });
    const mine = (list.songs || []).filter((s) => s.jobId === job.jobId || (job.jobId && s.job_id === job.jobId));
    if (mine.length) { songs = mine; break; }
    if (job.jobId && i % 5 === 4) {
      const st = await api(`/api/image-generation/job/${job.jobId}`).catch(() => null);
      const j = st?.job || st;
      if (j?.status === 'failed') throw new Error(`${id}: music job failed: ${j.error || 'unknown'}`);
      if (j?.status === 'completed') {
        const res = j.result || {};
        if (Array.isArray(res.songs) && res.songs.length) { songs = res.songs; break; }
        // Completed but the songs are not listed by job: take the newest songs made since the call.
        const fresh = (list.songs || []).filter((s) => s.createdAt >= since && s.modelId === model && !s.parentSongId);
        if (fresh.length) { songs = fresh; break; }
      }
    }
  }
  if (!songs) throw new Error(`${id}: music did not finish in time`);
  const out = [];
  for (let n = 0; n < songs.length; n++) {
    const s = songs[n];
    const url = s.wavUrl || s.audioUrl;
    const ext = (url.match(/\.(mp3|wav|m4a|ogg)(\?|$)/) || [0, 'mp3'])[1];
    const f = path.join(RAW, `${id}-take${n}.${ext}`);
    fs.writeFileSync(f, await download(url, id));
    out.push(f);
  }
  fs.writeFileSync(path.join(RAW, `${id}.json`), JSON.stringify({ model, spec, tookSec: Math.round((Date.now() - t0) / 1000), tokens: r.estimatedTokens, songIds: songs.map((s) => s.id) }, null, 1));
  console.log(`[music] ${id}: ${model}, ${songs.length} take(s) in ${Math.round((Date.now() - t0) / 1000)}s`);
  return out;
}

/** What is said in a sound file (Deepgram through POST /api/audio/transcribe): a take that should hold no words is checked with it. */
export async function transcribe(file) {
  const cache = `${file}.words.json`;
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(file).toString('base64') }) });
  const out = { text: String(r.transcript ?? r.text ?? r.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim(), confidence: r.confidence ?? null };
  fs.writeFileSync(cache, JSON.stringify(out));
  return out;
}

export async function balance() {
  return (await api('/api/tokens/balance')).tokenBalance;
}

/** Run jobs a few at a time; a failed job does not stop the others. */
export async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { ok: true, value: await worker(items[i], i) }; } catch (e) { results[i] = { ok: false, error: e }; console.warn(`[fail] ${items[i].id}: ${e.message.slice(0, 300)}`); }
    }
  }));
  return results;
}
