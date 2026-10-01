/**
 * The RFab calls of the campaign-media pipeline (tools/media/make.mjs): speech by a
 * text-to-video model that speaks (Veo 3.1 Lite: the picture is thrown away, the voice kept),
 * speech by a TTS voice (Deepgram Aura through POST /api/audio/synthesize), and what the
 * art pipeline already has (stills, clips: tools/art/rfab.mjs; music: tools/audio/rfab-audio.mjs).
 * Every call SPENDS tokens on RFAB_API_KEY's account; every step skips a file already on disk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const API_BASE = process.env.RFAB_API_BASE || 'https://api.rfab.ai';
const KEY = process.env.RFAB_API_KEY;
/** Raw takes: git-ignored (art-src/). */
// BROODFALL_MEDIA_RAW: put raw takes somewhere else (Oct 1 2026: art-src was wiped and is being recovered; new takes went to art-src-new/media).
export const RAW = process.env.BROODFALL_MEDIA_RAW || path.join(ROOT, 'art-src', 'media');
/** Baked: what the game loads. */
export const OUT = path.join(ROOT, 'public', 'media');
export const REVIEW = path.join(ROOT, 'notes', 'art-review', 'media');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ready() {
  if (!KEY) { console.error('RFAB_API_KEY is not set'); process.exit(1); }
  for (const d of [RAW, OUT, REVIEW]) fs.mkdirSync(d, { recursive: true });
}

export async function api(pathname, opts = {}) {
  const res = await fetch(API_BASE + pathname, { ...opts, headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`); }
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

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
    if (v && typeof v === 'object') v = v.url || v.videoUrl || v.audioUrl;
    if (v) return v;
  }
  return null;
};

export const spent = { speech: 0, tts: 0 };

/** A spoken line by a text-to-video model with sound (the picture is thrown away). Returns the raw .mp4. */
export async function veoSpeech({ out, prompt, seconds = 8, model = 'imagerouter:veo-3.1-lite-t2v' }) {
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  spent.speech += 1;
  const t0 = Date.now();
  const d = await api('/api/image-generation/generate-video', {
    method: 'POST',
    body: JSON.stringify({ prompt, videoModelId: model, duration: seconds, resolution: '720p', aspect_ratio: '16:9', audio: true, nsfw: false, variationCount: 1 }),
  });
  const result = d.jobId ? await poll(d.jobId, path.basename(out)) : d;
  const url = firstUrl(result, 'videoUrl', 'videos', 'imageUrl');
  if (!url) throw new Error(`${out}: no clip URL in ${JSON.stringify(result).slice(0, 300)}`);
  fs.writeFileSync(out, await download(url, out));
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ model, seconds, prompt, tookSec: Math.round((Date.now() - t0) / 1000) }, null, 1));
  console.log(`[speech] ${path.basename(out)}: ${model} ${seconds}s in ${Math.round((Date.now() - t0) / 1000)}s`);
  return out;
}

/** A spoken line by a TTS voice (Deepgram Aura). Returns the raw .mp3. */
export async function tts({ out, text, voice }) {
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  spent.tts += 1;
  const res = await fetch(`${API_BASE}/api/audio/synthesize`, {
    method: 'POST', headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`${out}: HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  return out;
}

/** What is said in a sound file (Deepgram, POST /api/audio/transcribe); cached beside it. */
export async function transcribe(file) {
  // Cached in art-src (never beside a baked file in public/), keyed by the file's size and time: a take made again is heard again.
  const st = fs.statSync(file);
  const cache = path.join(RAW, 'words', `${path.basename(file)}-${st.size}-${Math.round(st.mtimeMs)}.json`);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const r = await api('/api/audio/transcribe', { method: 'POST', body: JSON.stringify({ audioBase64: fs.readFileSync(file).toString('base64') }) });
  const o = { text: String(r.transcript ?? r.text ?? r.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim() };
  fs.writeFileSync(cache, JSON.stringify(o));
  return o;
}

export async function balance() { return (await api('/api/tokens/balance')).tokenBalance; }

export async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { ok: true, value: await worker(items[i], i) }; } catch (e) { results[i] = { ok: false, error: e }; console.warn(`[fail] ${items[i].id ?? i}: ${e.message.slice(0, 300)}`); }
    }
  }));
  return results;
}

export function ff(args, label) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${label}: ffmpeg failed: ${(r.stderr || '').slice(0, 500)}`);
  return r;
}
export function ffStderr(args) {
  return spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || '';
}
export function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(r.stdout.trim()) || 0;
}

/**
 * Where speech starts and ends in a file (seconds): 10 ms windows louder than the floor + 12 dB,
 * joined across gaps up to 0.7 s. The model often clicks or breathes at its start: that is left out.
 */
export function speechSpan(file) {
  const SR = 16000;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
  const win = SR / 100;
  const e = [];
  for (let i = 0; i + win <= x.length; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += x[j] * x[j]; e.push(10 * Math.log10(Math.max(1e-12, s / win))); }
  const sorted = [...e].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.15)];
  const peak = sorted[sorted.length - 1];
  const thr = Math.max(floor + 12, peak - 40);
  let a = e.findIndex((v, i) => i > 8 && v >= thr);
  let b = e.length - 1 - [...e].reverse().findIndex((v) => v >= thr);
  if (a < 0) return null;
  return { start: Math.max(0, a * 0.01 - 0.06), end: Math.min(e.length * 0.01, b * 0.01 + 0.2) };
}
