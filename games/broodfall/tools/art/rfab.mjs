/**
 * Shared steps of the art pipeline (notes/GRAPHICS-PLAN.md): still -> clip -> key -> loop,
 * through the RFab API. Every step skips work whose output file already exists, so a
 * re-run costs nothing. Needs RFAB_API_KEY in the environment and ffmpeg on PATH.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const API_BASE = process.env.RFAB_API_BASE || 'https://api.rfab.ai';
const API_KEY = process.env.RFAB_API_KEY;
/** Raw stills and clips: not committed (art-src/ is in .gitignore). */
export const RAW_DIR = path.join(ROOT, 'art-src', 'probes');
export const OUT_DIR = path.join(ROOT, 'notes', 'probes', process.env.PROBE_DATE || '2026-09-29');
const STILL_MODEL = process.env.PROBE_STILL_MODEL || 'openai:gpt-image-2';
// Only seegen: models take an END frame (start == end is what closes the loop). The last one
// does not: it is there for the few pictures SeeGen refuses without saying why, and a walk
// repeats itself anyway, so the loop is still found.
const VIDEO_MODELS = (process.env.PROBE_VIDEO_MODELS || 'seegen:sd2-mini,seegen:sd2-fast,atlascloud:seedance-2.0-mini-i2v').split(',');

export const CAMERA = 'seen from above at a 45 degree isometric angle (a three-quarter top-down game view)';
export const LIGHT = 'Realistic creature-design render, wet and unglamorous, soft even light from directly overhead.';
export const bg = (hex, name) =>
  `Absolutely nothing ${name} anywhere on the subject. The entire background is one solid flat pure ${name} ` +
  `#${hex}: no gradient, no ground, no floor, no horizon, no shadow on the background.`;
export const lock = (hex, name) =>
  'It stays at exactly the same spot, the same size and the same heading the whole time. ' +
  'Camera completely locked: no zoom, no pan, no cuts. Anatomy stays the same in every frame: ' +
  `nothing duplicates, splits or morphs. The solid pure ${name} #${hex} background stays flat and empty.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ready() {
  if (!API_KEY) { console.error('RFAB_API_KEY is not set'); process.exit(1); }
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function api(pathname, opts = {}) {
  const res = await fetch(API_BASE + pathname, {
    ...opts,
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`); }
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function pollJob(jobId, label, tries = 180) {
  for (let i = 0; i < tries; i++) {
    await sleep(5000);
    let r;
    try { r = await api(`/api/image-generation/job/${jobId}`); } catch (e) {
      // A gateway blip must not abandon a job that is already paid for.
      if (/HTTP 50[234]/.test(e.message)) continue;
      throw e;
    }
    const j = r.job || r;
    if (j.status === 'completed') return j.result || j.responseData || {};
    if (j.status === 'failed') throw new Error(`${label}: job failed: ${j.error || 'unknown'}`);
  }
  throw new Error(`${label}: did not complete in time`);
}

async function download(url, label) {
  const res = await fetch(url.startsWith('http') ? url : API_BASE + url, { headers: { 'X-API-Key': API_KEY } });
  if (!res.ok) throw new Error(`${label}: download failed HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const firstUrl = (r, ...keys) => {
  for (const k of keys) {
    let v = Array.isArray(r[k]) ? r[k][0] : r[k];
    if (v && typeof v === 'object') v = v.url || v.imageUrl || v.videoUrl;
    if (v) return v;
  }
  return null;
};

/**
 * One still on a flat key-colour background. `refFile`: redraw from that picture (same
 * creature, new view); `refFiles`: several reference pictures. `key: null`: a full picture
 * with its own background. `out`: where to save it (default: art-src/probes/<slug>-still.png).
 */
export async function makeStill({ slug, prompt, key = '00FF00', keyName = 'green', refFile, refFiles, width = 1024, height = 1024, quality = 'medium', out }) {
  out = out ?? path.join(RAW_DIR, `${slug}-still.png`);
  if (fs.existsSync(out)) { console.log(`[still] ${slug}: cached`); return out; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const body = {
    prompt: key ? `${prompt} ${bg(key, keyName)}` : prompt,
    modelId: STILL_MODEL, quality, width, height,
    imageCount: 1, saveToGallery: false, nsfw: false, async: true,
  };
  if (refFiles?.length) body.imageUrls = await Promise.all(refFiles.map((r, i) => upload(r, `${slug}-ref${i}`)));
  else if (refFile) body.imageBase64 = `data:image/png;base64,${fs.readFileSync(refFile).toString('base64')}`;
  spent.stills += 1;
  const start = await api(refFile || refFiles?.length ? '/api/image-generation/img2img' : '/api/image-generation/generate', {
    method: 'POST', body: JSON.stringify(body),
  });
  const result = start.jobId ? await pollJob(start.jobId, `${slug} still`) : start;
  const url = firstUrl(result, 'imageUrl', 'images');
  if (!url) throw new Error(`${slug}: no still URL`);
  const buf = url.startsWith('data:') ? Buffer.from(url.split(',')[1], 'base64') : await download(url, `${slug} still`);
  fs.writeFileSync(out, buf);
  console.log(`[still] ${slug}: saved ${(buf.length / 1024).toFixed(0)} KB`);
  return out;
}

async function upload(file, slug) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'image/png' }), `broodfall-${slug}.png`);
  form.append('skipGallery', 'true');
  const res = await fetch(`${API_BASE}/api/image-generation/upload`, { method: 'POST', headers: { 'X-API-Key': API_KEY }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.imageUrl) throw new Error(`${slug}: upload failed HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body.imageUrl;
}

/**
 * One clip from a still, with the END frame set to the START frame (`loop: false` leaves
 * the end free). `raw: true` sends the prompt as it is, without the locked-camera tail.
 * `endFile`: the END frame is that picture instead (a start-and-end clip: the model fills in the
 * middle, e.g. the core growing from one stage into the next).
 */
export async function makeClip({ slug, stillFile, endFile, models = VIDEO_MODELS, prompt, seconds = 4, key = '00FF00', keyName = 'green', out, loop = true, raw = false, resolution = '480p', aspect = '1:1', audio = false }) {
  out = out ?? path.join(RAW_DIR, `${slug}-clip.mp4`);
  if (fs.existsSync(out)) { console.log(`[clip] ${slug}: cached`); return out; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const imageUrl = await upload(stillFile, slug);
  const endUrl = endFile ? await upload(endFile, `${slug}-end`) : loop ? imageUrl : null;
  spent.clips += 1;
  let lastErr;
  for (const model of models) {
    try {
      console.log(`[clip] ${slug}: ${seconds}s on ${model}, ${endFile ? 'end frame = the next picture' : endUrl ? 'end frame = start frame' : 'end free'}`);
      const t0 = Date.now();
      const d = await api('/api/image-generation/generate-video', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl, ...(endUrl ? { lastFrameUrl: endUrl } : {}),
          prompt: raw ? prompt : `${prompt} ${lock(key, keyName)}`,
          videoModelId: model, duration: seconds, resolution, aspect_ratio: aspect,
          audio, nsfw: false, variationCount: 1,
        }),
      });
      const result = d.jobId ? await pollJob(d.jobId, `${slug} clip`) : d;
      const url = firstUrl(result, 'videoUrl', 'imageUrl');
      if (!url) throw new Error(`${slug}: no clip URL`);
      const buf = await download(url, `${slug} clip`);
      fs.writeFileSync(out, buf);
      const tookSec = Math.round((Date.now() - t0) / 1000);
      fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ model, seconds, tookSec }));
      console.log(`[clip] ${slug}: saved ${(buf.length / 1024 / 1024).toFixed(1)} MB in ${tookSec}s`);
      return out;
    } catch (e) {
      lastErr = e;
      console.warn(`[clip] ${slug}: ${model} failed: ${e.message.slice(0, 200)}`);
    }
  }
  throw lastErr;
}

/** What this run asked the API to make (cached results are not counted). */
export const spent = { stills: 0, clips: 0 };

/** The account's token balance, to report what a run really cost. */
export async function balance() {
  const r = await api('/api/tokens/balance');
  return r.tokenBalance;
}

/** Run jobs a few at a time; a failed job does not stop the others. */
export async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { ok: true, value: await worker(items[i], i) }; } catch (e) { results[i] = { ok: false, error: e }; }
    }
  }));
  return results;
}

export function ffmpeg(args, label) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${label}: ffmpeg failed: ${(r.stderr || '').slice(0, 400)}`);
  return r;
}

/** The chroma key for a clip. Frame 0 is the uploaded still itself (brighter background): never used. */
export const keyChain = (key = '00FF00', keyName = 'green') =>
  `chromakey=0x${key}:0.22:0.08,despill=type=${keyName === 'blue' ? 'blue' : 'green'}`;

/**
 * Where to cut the loop: the two frames that look most alike, at least `minFrames` apart.
 * Returns frame numbers at `fps` (frame 0, the still, is already dropped).
 */
export function loopWindow(clipFile, fps = 12, minFrames = 18) {
  const S = 48;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', clipFile,
    '-vf', `trim=start_frame=1,setpts=PTS-STARTPTS,fps=${fps},scale=${S}:${S},format=gray`, '-f', 'rawvideo', '-'],
  { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`loopWindow: ffmpeg failed: ${String(r.stderr).slice(0, 300)}`);
  const n = Math.floor(r.stdout.length / (S * S));
  const frame = (i) => r.stdout.subarray(i * S * S, (i + 1) * S * S);
  let best = { start: 0, end: n - 1, diff: Infinity };
  for (let i = 0; i < n; i++) {
    for (let j = i + minFrames; j < n; j++) {
      const a = frame(i);
      const b = frame(j);
      let d = 0;
      for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]);
      d /= a.length;
      // Prefer the longer loop when two cuts are about equally clean.
      if (d < best.diff - 0.05 || (Math.abs(d - best.diff) <= 0.05 && j - i > best.end - best.start)) best = { start: i, end: j, diff: d };
    }
  }
  return { ...best, frames: n };
}
