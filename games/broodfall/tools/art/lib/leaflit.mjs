/**
 * LEAFLIT'S AI VTUBER STUDIO, run from Node (rfab.ai/vtuber-creator, frontend repo
 * src/assets/vtuber-creator/). What the studio does, step for step, with no browser:
 *
 *   server (the RFab API, X-API-Key works the same as the studio's login):
 *     POST /api/image-generation/upload          the reference sprite       rfab-bridge.js uploadImage()
 *     POST /api/image-generation/generate-video  one take per state         rfab-bridge.js generateVideo()
 *     GET  /api/image-generation/job/:id         poll                       rfab-bridge.js pollJob()
 *   in the page (plain JavaScript, nothing that needs a server):
 *     the motion prompt                          craftPrompt / craftHoldPrefix  app.js
 *     the key colour and its similarity           auto-detect + calibrateSimilarity()  model-exporter.js
 *     the chroma key itself                        class ChromaKey (process)   model-exporter.js
 *     the loop                                     Ping-Pong / No Loop         video-prep.js, model-exporter.js startExportWebM()
 *
 * The ChromaKey class is loaded from the studio's own file, so a fix Leaflit makes to it
 * reaches her next bake; a snapshot beside this file is used on a machine without the
 * frontend repo (leaflit-chromakey.js, rewritten whenever the live file is read).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STUDIO_DIR = process.env.LEAFLIT_STUDIO_DIR
  || 'C:/Users/Merry/dev/reality-fabricator/reality-fabricator-frontend/src/assets/vtuber-creator';
const SNAPSHOT = path.join(HERE, 'leaflit-chromakey.js');
export const API_BASE = process.env.RFAB_API_BASE || 'https://api.rfab.ai';

/** The studio's defaults (rfab-bridge.js): its video model and its creator-program tag. */
export const STUDIO_VIDEO_MODEL = 'gemini:gemini-omni-flash-preview';
export const CREATOR_PROGRAM = 'leaflit-angels-sword';

// ---------------------------------------------------------------------------
// Prompts: app.js STYLE_PRESETS[anime], craftLoopPrefix / craftOneShotPrefix / craftHoldPrefix.
// ---------------------------------------------------------------------------
const STYLE = '2d anime game animation style';
export function craftPrompt(motion, kind) {
  const prefix = kind === 'oneShot'
    ? `Locked-off position, static camera, ${STYLE}. The motion plays once, then the character returns to and ends in EXACTLY the same pose it started in. `
    : kind === 'hold'
      ? `Locked-off position, static camera, ${STYLE}. The character makes the turn early in the clip, HOLDS that direction steadily with subtle motion, then turns back and ends in the EXACT same pose they started in. `
      : `Locked-off position, static camera, ${STYLE}. Perfect seamless loop: the character ends the clip in EXACTLY the same pose it started in. `;
  return `${prefix}${motion} Keep the character on the same solid background.`;
}

// ---------------------------------------------------------------------------
// The chroma key: the studio's own class.
// ---------------------------------------------------------------------------
function classSource(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const start = text.indexOf('\nclass ChromaKey {');
  if (start < 0) throw new Error('model-exporter.js: class ChromaKey not found');
  const end = text.indexOf('\n}\n', start);
  return text.slice(start + 1, end + 2);
}

let ChromaKeyClass = null;
export function loadChromaKey() {
  if (ChromaKeyClass) return ChromaKeyClass;
  const live = path.join(STUDIO_DIR, 'model-exporter.js');
  let src;
  let from;
  if (fs.existsSync(live)) {
    src = classSource(fs.readFileSync(live, 'utf8'));
    from = live;
    const header = `// Snapshot of class ChromaKey from Leaflit's AI VTuber Studio (${path.basename(live)}), taken ${new Date().toISOString().slice(0, 10)}.\n// Used only when the frontend repo is not on this machine. Do not edit: fix the studio instead.\n`;
    const old = fs.existsSync(SNAPSHOT) ? fs.readFileSync(SNAPSHOT, 'utf8') : '';
    if (!old.endsWith(src)) fs.writeFileSync(SNAPSHOT, header + src);
  } else {
    src = fs.readFileSync(SNAPSHOT, 'utf8');
    from = SNAPSHOT;
  }
  // The class reads localStorage for the model's art style (inside a try); Node has none, so 'anime' applies.
  ChromaKeyClass = new Function(`${src}\nreturn ChromaKey;`)();
  ChromaKeyClass.from = from;
  return ChromaKeyClass;
}

/** model-exporter.js bindAutoDetect(): the most common quantised colour on the frame's border. */
export function autoDetectKey(img) {
  const { w, h, data } = img;
  const pts = [];
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 50))) pts.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 50))) pts.push([0, y], [w - 1, y]);
  const counts = {};
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    const q = [0, 1, 2].map((k) => Math.min(255, Math.round(data[i + k] / 16) * 16));
    counts[q.join(',')] = (counts[q.join(',')] || 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return best.split(',').map(Number);
}

/** model-exporter.js calibrateSimilarity(): clear the background's chroma noise, stay under the character. */
export function calibrateSimilarity(ck, img) {
  const { w, h, data } = img;
  const bg = [];
  const sample = (x, y) => {
    const p = (y * w + x) * 4;
    const d = ck._getChromaDist(data[p], data[p + 1], data[p + 2]);
    if (d <= 0.30) bg.push(d);
  };
  for (let x = 0; x < w; x += 3) for (const y of [1, 3, 5, h - 6, h - 4, h - 2]) sample(x, y);
  for (let y = 0; y < h; y += 3) for (const x of [1, 3, 5, w - 6, w - 4, w - 2]) sample(x, y);
  if (bg.length < 50) return null;
  bg.sort((a, b) => a - b);
  const bgMax = bg[Math.floor((bg.length - 1) * 0.999)];
  const simPct = Math.round(Math.max(25, Math.min(45, (bgMax * 1.5 + 0.08) * 100)));
  ck.similarity = simPct / 100;
  return simPct;
}

/**
 * A keyer set up the way the studio sets it for one clip: key colour auto-detected on the
 * clip's first frame, similarity calibrated on it, smoothness 8 %, spill 10 %, no edge fade,
 * no anti-alias, VFX haze cleanup off (index.html defaults; the haze box is off by default).
 */
export function studioKeyer(firstFrame) {
  const ChromaKey = loadChromaKey();
  const ck = new ChromaKey();
  const [r, g, b] = autoDetectKey(firstFrame);
  ck.setKeyColor(r, g, b);
  const sim = calibrateSimilarity(ck, firstFrame);
  return { ck, key: [r, g, b], similarity: sim ?? Math.round(ck.similarity * 100) };
}

/** One frame through the studio's keyer (in place), as the export's keyInline() does. */
export function keyFrame(ck, img) {
  const imageData = { data: img.data, width: img.w, height: img.h };
  ck.bgPlateMask = null;
  ck.process(imageData);
  if (ck.antiAlias) ck.applyAntiAlias(imageData);
  ck.applyEdgeFade(imageData, ck.edgeFadeWidth);
}

/** model-exporter.js startExportWebM(): the frame list of a range, Ping-Pong or as it is. */
export function frameList(start, end, pingPong) {
  const list = [];
  for (let f = start; f <= end; f++) list.push(f);
  if (pingPong && list.length > 2) for (let i = list.length - 2; i >= 1; i--) list.push(list[i]);
  return list;
}

// ---------------------------------------------------------------------------
// The server half: the same calls rfab-bridge.js makes.
// ---------------------------------------------------------------------------
async function api(pathname, opts = {}) {
  const res = await fetch(API_BASE + pathname, {
    ...opts,
    headers: { 'X-API-Key': process.env.RFAB_API_KEY, ...(opts.body && typeof opts.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${pathname} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json ?? {};
}

/** rfab-bridge.js uploadImage(): the sprite to the media store, no gallery row. */
export async function uploadSprite(file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'image/png' }), 'vtuber-sprite.png');
  form.append('skipGallery', 'true');
  const d = await api('/api/image-generation/upload', { method: 'POST', body: form });
  if (!d.imageUrl) throw new Error(`sprite upload: ${JSON.stringify(d).slice(0, 200)}`);
  return d.imageUrl;
}

/** rfab-bridge.js pollJob(). */
async function pollJob(jobId, label) {
  for (let i = 0; i < 360; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    let job;
    try { job = await api(`/api/image-generation/job/${jobId}`); } catch (e) {
      if (/HTTP 404/.test(e.message)) throw new Error(`${label}: job expired`);
      continue;
    }
    if (job.status === 'completed') return job.result || job;
    if (job.status === 'failed') throw new Error(`${label}: ${job.error || 'generation failed'}`);
  }
  throw new Error(`${label}: timed out`);
}

/**
 * rfab-bridge.js generateVideo(): one take from the sprite. The body is the studio's, field
 * for field (its default model, 16:9, silent, one variation, Leaflit's creator program).
 */
export async function generateTake({ spriteUrl, prompt, out, label, videoModelId = STUDIO_VIDEO_MODEL, duration = 10 }) {
  const body = {
    imageUrl: spriteUrl, prompt, videoModelId, duration, aspect_ratio: '16:9', audio: false,
    variationCount: 1, creatorProgram: CREATOR_PROGRAM, nsfw: false,
  };
  const t0 = Date.now();
  const d = await api('/api/image-generation/generate-video', { method: 'POST', body: JSON.stringify(body) });
  const result = d.async && d.jobId ? await pollJob(d.jobId, label) : d;
  const url = result.videoUrl || result.imageUrl;
  if (!url) throw new Error(`${label}: no video in the result`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), `${JSON.stringify({ model: videoModelId, prompt, tookSec: Math.round((Date.now() - t0) / 1000), url }, null, 1)}\n`);
  return out;
}

export async function tokenBalance() {
  return (await api('/api/tokens/balance')).tokenBalance;
}
