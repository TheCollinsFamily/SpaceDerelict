/**
 * Graphics probe (notes/GRAPHICS-PLAN.md): still -> video -> key -> loop, through the
 * RFab API. PAID: about $0.35-0.50 per job (one still, one 4 s clip at 480p).
 *
 *   node tools/art/probe-video.mjs spitter-idle soldier-walk
 *
 * Needs RFAB_API_KEY in the environment and ffmpeg on PATH. Raw stills and clips go to
 * art-src/probes/ (not committed); keyed loops and sheets go to notes/probes/<date>/.
 * A step whose output file already exists is skipped, so a re-run costs nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_BASE = process.env.RFAB_API_BASE || 'https://api.rfab.ai';
const API_KEY = process.env.RFAB_API_KEY;
const RAW_DIR = path.join(ROOT, 'art-src', 'probes');
const OUT_DIR = path.join(ROOT, 'notes', 'probes', process.env.PROBE_DATE || '2026-09-29');
const STILL_MODEL = process.env.PROBE_STILL_MODEL || 'openai:gpt-image-2';
// Only seegen: models take an END frame (start == end is what closes the loop).
const VIDEO_MODELS = (process.env.PROBE_VIDEO_MODELS || 'seegen:sd2-mini,seegen:sd2-fast').split(',');

const CAMERA = 'seen from above at a 45 degree isometric angle (a three-quarter top-down game view)';
const LIGHT = 'Realistic creature-design render, wet and unglamorous, soft even light from directly overhead.';
const bg = (hex, name) =>
  `Absolutely nothing ${name} anywhere on the subject. The entire background is one solid flat pure ${name} ` +
  `#${hex}: no gradient, no ground, no floor, no horizon, no shadow on the background.`;
const lock = (hex, name) =>
  'It stays at exactly the same spot, the same size and the same heading the whole time. ' +
  'Camera completely locked: no zoom, no pan, no cuts. Anatomy stays the same in every frame: ' +
  `nothing duplicates, splits or morphs. The solid pure ${name} #${hex} background stays flat and empty.`;

const JOBS = {
  'spitter-idle': {
    key: '00FF00', keyName: 'green', seconds: 4, sizes: [192, 96, 48],
    still:
      `Game asset of a single alien organism rooted in place, ${CAMERA}. A squat stalk of glistening raw ` +
      'muscle and sinew, about as wide as it is tall, armoured with overlapping plates of dark wet chitin, ' +
      'topped by one puckered fleshy nozzle that points up and slightly forward. A ring of short root-like ' +
      'tendons grips the ground around its base. Colours: deep red and salmon-pink flesh, bone-white and ' +
      `dark brown chitin. ${LIGHT} The organism is centred, fully in frame with clear margin on every side, ` +
      'and fills about 60% of the picture height.',
    motion:
      'The organism breathes slowly in place: the muscle stalk swells and relaxes, the chitin plates shift ' +
      'slightly against each other, the nozzle puckers and loosens.',
  },
  'soldier-walk': {
    key: '00FF00', keyName: 'green', seconds: 4, sizes: [96, 48, 24],
    still:
      `Game asset of a single alien insect soldier, ${CAMERA}, walking toward the lower left of the picture. ` +
      'A stocky six-legged body with thick sturdy legs, a broad armoured thorax of rust-orange and dark ' +
      'brown chitin, heavy mandibles and short antennae, caught mid-stride with all six feet visible. ' +
      `${LIGHT} The insect is centred, fully in frame with clear margin on every side, and fills about half ` +
      'of the picture.',
    motion:
      'The insect walks on the spot as if on a treadmill: its six legs step in a steady alternating gait, ' +
      'the body bobs slightly, the antennae twitch. It never travels across the frame.',
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function still(slug, job) {
  const out = path.join(RAW_DIR, `${slug}-still.png`);
  if (fs.existsSync(out)) { console.log(`[still] ${slug}: cached`); return out; }
  const start = await api('/api/image-generation/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: `${job.still} ${bg(job.key, job.keyName)}`,
      modelId: STILL_MODEL, quality: 'medium', width: 1024, height: 1024,
      imageCount: 1, saveToGallery: false, nsfw: false, async: true,
    }),
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

async function clip(slug, job, stillFile) {
  const out = path.join(RAW_DIR, `${slug}-clip.mp4`);
  if (fs.existsSync(out)) { console.log(`[clip] ${slug}: cached`); return out; }
  const imageUrl = await upload(stillFile, slug);
  let lastErr;
  for (const model of VIDEO_MODELS) {
    try {
      console.log(`[clip] ${slug}: ${job.seconds}s on ${model}, end frame = start frame`);
      const t0 = Date.now();
      const d = await api('/api/image-generation/generate-video', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl, lastFrameUrl: imageUrl,
          prompt: `${job.motion} ${lock(job.key, job.keyName)}`,
          videoModelId: model, duration: job.seconds, resolution: '480p', aspect_ratio: '1:1',
          audio: false, nsfw: false, variationCount: 1,
        }),
      });
      const result = d.jobId ? await pollJob(d.jobId, `${slug} clip`) : d;
      const url = firstUrl(result, 'videoUrl', 'imageUrl');
      if (!url) throw new Error(`${slug}: no clip URL`);
      const buf = await download(url, `${slug} clip`);
      fs.writeFileSync(out, buf);
      fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ model, seconds: job.seconds, tookSec: Math.round((Date.now() - t0) / 1000) }));
      console.log(`[clip] ${slug}: saved ${(buf.length / 1024 / 1024).toFixed(1)} MB in ${Math.round((Date.now() - t0) / 1000)}s`);
      return out;
    } catch (e) {
      lastErr = e;
      console.warn(`[clip] ${slug}: ${model} failed: ${e.message.slice(0, 200)}`);
    }
  }
  throw lastErr;
}

function ffmpeg(args, label) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${label}: ffmpeg failed: ${(r.stderr || '').slice(0, 400)}`);
  return r;
}

/** Key the clip, write the alpha loop, a frame sheet, and the first/last frame for the seam check. */
function bake(slug, job, clipFile) {
  // Frame 0 is the uploaded still itself (its background is brighter than the clip's): never part of the loop.
  const keyed = `trim=start_frame=1,setpts=PTS-STARTPTS,chromakey=0x${job.key}:0.22:0.08,despill=type=${job.keyName === 'blue' ? 'blue' : 'green'}`;
  const big = job.sizes[0];
  ffmpeg(['-i', clipFile, '-vf', `fps=12,scale=${big * 2}:-2:flags=lanczos,${keyed},format=yuva420p`,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-auto-alt-ref', '0', '-an',
    path.join(OUT_DIR, `${slug}.webm`)], `${slug} loop`);
  ffmpeg(['-i', clipFile, '-vf', `fps=12,scale=${big}:-2:flags=lanczos,${keyed},format=rgba,tile=8x6`,
    '-frames:v', '1', path.join(RAW_DIR, `${slug}-sheet.png`)], `${slug} sheet`);
  // Every 6th frame at full size on grey, to look at the key edge and the motion.
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x54432a:s=1920x480', '-i', clipFile, '-filter_complex',
    `[1:v]fps=2,scale=480:-2,${keyed},format=rgba,tile=4x1[t];[0:v][t]overlay=0:0:format=auto`,
    '-frames:v', '1', path.join(OUT_DIR, `${slug}-strip.png`)], `${slug} strip`);
  ffmpeg(['-i', clipFile, '-vf', 'select=eq(n\\,1)', '-frames:v', '1', path.join(RAW_DIR, `${slug}-first.png`)], `${slug} first`);
  ffmpeg(['-sseof', '-0.2', '-i', clipFile, '-update', '1', '-frames:v', '1', path.join(RAW_DIR, `${slug}-last.png`)], `${slug} last`);
  const s = spawnSync('ffmpeg', ['-hide_banner', '-i', path.join(RAW_DIR, `${slug}-first.png`), '-i', path.join(RAW_DIR, `${slug}-last.png`),
    '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /All:([0-9.]+)/.exec(s.stderr || '');
  console.log(`[bake] ${slug}: loop, sheet and strip written; loop seam (second frame vs last) SSIM ${m ? m[1] : 'n/a'} (1.0 = identical)`);
  return m ? Number(m[1]) : null;
}

/** The sprite at its real on-screen sizes, over a crop of a real board screenshot. */
function onBoard(slug, job) {
  const board = path.join(ROOT, 'tools', 'screenshots', '03-late.png');
  const sheet = path.join(RAW_DIR, `${slug}-sheet.png`);
  const big = job.sizes[0];
  const parts = job.sizes.map((s, i) => `[1:v]crop=${big}:${big}:0:0,scale=${s}:${s}:flags=lanczos[s${i}]`);
  let chain = '[0:v]crop=520:300:560:380,scale=1040:600:flags=neighbor[b0]';
  let x = 60;
  job.sizes.forEach((s, i) => {
    chain += `;[b${i}][s${i}]overlay=${x}:${300 - Math.round(s / 2)}:format=auto[b${i + 1}]`;
    x += s + 80;
  });
  ffmpeg(['-i', board, '-i', sheet, '-filter_complex', `${parts.join(';')};${chain}`, '-map', `[b${job.sizes.length}]`,
    '-frames:v', '1', path.join(OUT_DIR, `${slug}-on-board.png`)], `${slug} on board`);
}

async function run(slug) {
  const job = JOBS[slug];
  if (!job) throw new Error(`unknown job "${slug}" (have: ${Object.keys(JOBS).join(', ')})`);
  const stillFile = await still(slug, job);
  fs.copyFileSync(stillFile, path.join(OUT_DIR, `${slug}-still.png`));
  const clipFile = await clip(slug, job, stillFile);
  const ssim = bake(slug, job, clipFile);
  onBoard(slug, job);
  return { slug, ssim };
}

if (!API_KEY) { console.error('RFAB_API_KEY is not set'); process.exit(1); }
fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const slugs = process.argv.slice(2);
if (!slugs.length) { console.error(`usage: node tools/art/probe-video.mjs <job>...  (jobs: ${Object.keys(JOBS).join(', ')})`); process.exit(1); }
const results = await Promise.allSettled(slugs.map(run));
results.forEach((r, i) => console.log(r.status === 'fulfilled' ? `OK   ${slugs[i]} ${JSON.stringify(r.value)}` : `FAIL ${slugs[i]}: ${r.reason.message}`));
process.exit(results.some((r) => r.status === 'rejected') ? 1 : 0);
