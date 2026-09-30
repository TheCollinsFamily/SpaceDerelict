/**
 * THE SOUND PIPELINE. Makes every sound in tools/audio/cues.mjs through the RFab API, cuts and
 * levels it with ffmpeg, and bakes public/audio/ (Opus in .ogg) and public/audio/manifest.json.
 *
 *   node tools/audio/make.mjs                 everything missing: generate (SPENDS tokens), then bake
 *   node tools/audio/make.mjs fire-spit film  only those ids (generate if missing, then bake)
 *   node tools/audio/make.mjs --bake          bake only, from the raw takes already in art-src/audio/ (free)
 *   node tools/audio/make.mjs --redo <id>     throw the raw take of <id> away and make it again
 *
 * Levels: music and stingers -16 LUFS (integrated, two-pass loudnorm); effects -14 LUFS-ish (an
 * RMS over the sounding part, since most are shorter than loudnorm's 400 ms window) with a -1 dBFS
 * ceiling; the narrator -16 LUFS. Loops are baked seamless: the steady part of the take is found
 * (its start fade and end fade left out), and its last 4 s are crossfaded into its first 4 s.
 * Raw takes: art-src/audio/ (git-ignored, like the art's raw clips). Needs ffmpeg on PATH.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MUSIC, SFX, VOICE } from './cues.mjs';
import { RAW, ROOT, balance, pool, ready, songTakes, soundTake, spent, transcribe } from './rfab-audio.mjs';

const OUT = path.join(ROOT, 'public', 'audio');
const TMP = path.join(RAW, 'tmp');
const SFX_MODEL = process.env.SFX_MODEL || 'atlascloud:h3-t2v';
const VOICE_MODEL = process.env.VOICE_MODEL || 'imagerouter:veo-3.1-lite-t2v';
const MUSIC_MODEL = process.env.MUSIC_MODEL || 'elevenlabs:music_v2';
const SR = 48000;

const args = process.argv.slice(2);
const BAKE_ONLY = args.includes('--bake');
const REDO = args.includes('--redo');
const only = args.filter((a) => !a.startsWith('--'));
const want = (id) => !only.length || only.includes(id);

function ff(argv, label) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${label}: ffmpeg failed: ${(r.stderr || '').slice(0, 500)}`);
  return r;
}
function ffStderr(argv) {
  return spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...argv], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || '';
}
function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(r.stdout.trim()) || 0;
}
/** Mono float samples of a file at 48 kHz. */
function samples(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${file}: decode failed ${r.stderr}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
}
const db = (x) => 20 * Math.log10(Math.max(1e-9, x));

/** RMS level (dBFS) of every 10 ms window. */
function envelope(x, win = SR / 100) {
  const n = Math.floor(x.length / win);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * win; j < (i + 1) * win; j++) s += x[j] * x[j];
    e[i] = db(Math.sqrt(s / win));
  }
  return e;
}
const pctl = (arr, p) => { const a = [...arr].sort((u, v) => u - v); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };

/**
 * The separate sounds in a take: windows louder than the threshold, joined across short gaps,
 * each with a little lead-in and its decay. Returns [{ start, end, peak, rms }] in seconds / dBFS.
 */
function events(x, { gap = 0.12, minLen = 0.05, maxLen = 3.2 } = {}) {
  const e = envelope(x);
  const floor = pctl(e, 0.2);
  const peak = Math.max(...e);
  const thr = Math.max(floor + 10, peak - 38);
  const tail = Math.max(floor + 4, peak - 50);
  const out = [];
  let i = 0;
  while (i < e.length) {
    if (e[i] < thr) { i++; continue; }
    let j = i;
    let last = i;
    while (j < e.length && (e[j] >= thr || (j - last) * 0.01 < gap)) { if (e[j] >= thr) last = j; j++; }
    // its decay, down to the tail level
    let k = last;
    while (k + 1 < e.length && e[k + 1] >= tail && (k - last) < 60) k++;
    let s = Math.max(0, i - 2);
    const start = s * 0.01;
    const end = Math.min(e.length, k + 3) * 0.01;
    let p = -200; let acc = 0; let cnt = 0;
    for (let q = i; q <= last; q++) { p = Math.max(p, e[q]); if (e[q] >= thr) { acc += 10 ** (e[q] / 10); cnt++; } }
    if (end - start >= minLen) out.push({ start, end: Math.min(end, start + maxLen), peak: p, rms: db(Math.sqrt(acc / Math.max(1, cnt))) });
    i = k + 1;
  }
  return { list: out, floor, peak, thr };
}

/** Cut [start, end] of `src` to a mono Opus file, levelled so its sounding part sits at `target` dBFS RMS, peaks at -1 dBFS. */
function cutSfx(src, start, end, rms, target, dest) {
  const gain = Math.max(-12, Math.min(30, target - rms));
  const dur = end - start;
  const fo = Math.min(0.08, dur * 0.3);
  ff(['-ss', start.toFixed(3), '-t', dur.toFixed(3), '-i', src, '-vn', '-ac', '1', '-ar', String(SR),
    '-af', `highpass=f=35,volume=${gain.toFixed(2)}dB,alimiter=limit=0.79:level=false,afade=t=in:d=0.004,afade=t=out:st=${(dur - fo).toFixed(3)}:d=${fo.toFixed(3)}`,
    '-c:a', 'libopus', '-b:a', '64k', dest], dest);
}

/** Two-pass loudnorm to `I` LUFS; `extra` filters before it. Writes Opus (stereo 128k or mono 64k). */
function levelled(src, dest, { I = -16, extra = '', mono = false, ss, t } = {}) {
  const pre = [...(ss !== undefined ? ['-ss', ss.toFixed(3)] : []), ...(t !== undefined ? ['-t', t.toFixed(3)] : []), '-i', src];
  const chain = (f) => (extra ? `${extra},${f}` : f);
  const m = ffStderr([...pre, '-vn', '-af', chain(`loudnorm=I=${I}:TP=-1.5:LRA=11:print_format=json`), '-f', 'null', '-']);
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=${I}:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  ff([...pre, '-vn', '-ar', String(SR), '-ac', mono ? '1' : '2', '-af', chain(ln), '-c:a', 'libopus', '-b:a', mono ? '64k' : '128k', dest], dest);
  return Number(j.input_i);
}

/** Integrated loudness of a finished file. */
function lufs(file) {
  const s = ffStderr(['-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const m = [...s.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  return m ? Number(m[1]) : null;
}

/** The steady part of a music take: from where it has come up to where it starts to fade (1 s windows vs the median). */
function steady(x) {
  const e = envelope(x, SR);
  const med = pctl(e, 0.5);
  let a = 0; while (a < e.length - 1 && e[a] < med - 5) a++;
  let b = e.length - 1; while (b > a && e[b] < med - 4) b--;
  return { start: a + 0.5, end: b + 0.5 };
}

/** A seamless loop of [start, end] of `src`: its last `xf` seconds crossfaded into its first. */
function bakeLoop(src, start, end, dest, xf = 4) {
  const body = path.join(TMP, `${path.basename(dest, '.ogg')}-loop.wav`);
  const len = end - start;
  ff(['-ss', start.toFixed(3), '-t', len.toFixed(3), '-i', src, '-vn', '-ar', String(SR), '-ac', '2', '-filter_complex',
    `[0:a]asplit=3[a][b][c];[a]atrim=start=${(len - xf).toFixed(3)}:end=${len.toFixed(3)},asetpts=PTS-STARTPTS[tail];` +
    `[b]atrim=start=0:end=${xf},asetpts=PTS-STARTPTS[head];[c]atrim=start=${xf}:end=${(len - xf).toFixed(3)},asetpts=PTS-STARTPTS[mid];` +
    `[tail][head]acrossfade=d=${xf}:c1=qsin:c2=qsin[join];[join][mid]concat=n=2:v=0:a=1[out]`,
    '-map', '[out]', '-c:a', 'pcm_f32le', body], dest);
  return body;
}

// ---------------------------------------------------------------------------------------------

async function generate() {
  ready();
  const b0 = await balance();
  if (REDO) for (const id of only) for (const f of fs.readdirSync(RAW)) if (f === `${id}.mp4` || f.startsWith(`${id}-take`) || f === `${id}.json`) fs.rmSync(path.join(RAW, f));
  const jobs = [
    ...MUSIC.filter((m) => want(m.id)).map((m) => ({ ...m, kind: 'music' })),
    ...VOICE.filter((v) => want(v.id)).map((v) => ({ ...v, kind: 'voice' })),
    ...SFX.filter((s) => want(s.id) && !s.raw).map((s) => ({ ...s, kind: 'sfx' })),
  ];
  // the one take that already exists under a probe's name
  for (const s of SFX) if (s.raw && want(s.id) && !fs.existsSync(path.join(RAW, `${s.id}.mp4`)) && fs.existsSync(path.join(RAW, `${s.raw}.mp4`))) fs.copyFileSync(path.join(RAW, `${s.raw}.mp4`), path.join(RAW, `${s.id}.mp4`));
  await pool(jobs, 8, async (j) => {
    if (j.kind === 'music') {
      const st = j.spec;
      return songTakes({ id: j.id, model: j.model || MUSIC_MODEL, spec: {
        title: st.title, form: 'instrumental', targetSeconds: j.seconds, language: 'en',
        style: { instrumental: true, genres: st.genres, moods: st.moods, tempo: st.tempo, instruments: st.instruments, freeform: st.freeform },
      } });
    }
    if (j.kind === 'voice') return soundTake({ id: j.id, prompt: j.prompt, model: j.model || VOICE_MODEL, seconds: 4, resolution: '720p', aspect: '16:9' });
    return soundTake({ id: j.id, prompt: j.prompt, model: j.model || SFX_MODEL, seconds: j.seconds, resolution: '480p', aspect: '16:9' });
  });
  const b1 = await balance();
  console.log(`generated: ${spent.videos} clips with sound, ${spent.songs} pieces of music; ${b0 - b1} tokens`);
}

async function bake() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const manifestFile = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { v: 1, music: {}, sfx: {}, voice: {} };
  const notes = {};

  for (const m of MUSIC) {
    if (!want(m.id)) continue;
    const takes = fs.readdirSync(RAW).filter((f) => f.startsWith(`${m.id}-take`)).sort();
    if (!takes.length) { console.warn(`[bake] ${m.id}: no take`); continue; }
    const src = path.join(RAW, takes[0]);
    const dest = path.join(OUT, `${m.id}.ogg`);
    const x = samples(src);
    if (m.loop) {
      const { start, end } = steady(x);
      const body = bakeLoop(src, start, end, dest);
      levelled(body, dest, { I: -16 });
    } else {
      // a stinger or the film: its leading silence off, a short fade at its end
      const ev = events(x, { gap: 1.5, maxLen: 999 });
      const s0 = Math.max(0, (ev.list[0]?.start ?? 0) - 0.02);
      const d = duration(src) - s0;
      levelled(src, dest, { I: -16, ss: s0, extra: `afade=t=out:st=${Math.max(0, d - 0.6).toFixed(2)}:d=0.6` });
    }
    const seconds = +duration(dest).toFixed(3);
    manifest.music[m.id] = { file: `audio/${m.id}.ogg`, seconds, loop: !!m.loop };
    notes[m.id] = { lufs: lufs(dest) };
    console.log(`[bake] music ${m.id}: ${seconds}s ${m.loop ? 'loop' : ''} ${notes[m.id].lufs} LUFS`);
  }

  for (const v of VOICE) {
    if (!want(v.id)) continue;
    const src = path.join(RAW, `${v.id}.mp4`);
    if (!fs.existsSync(src)) { console.warn(`[bake] ${v.id}: no take`); continue; }
    const x = samples(src);
    const ev = events(x, { gap: 0.6, maxLen: 999 });
    if (!ev.list.length) { console.warn(`[bake] ${v.id}: silent`); continue; }
    const s0 = Math.max(0, ev.list[0].start - 0.03);
    const s1 = Math.min(duration(src), ev.list[ev.list.length - 1].end + 0.15);
    const dest = path.join(OUT, `${v.id}.ogg`);
    // the newsreel: a narrow old microphone and a little compression
    levelled(src, dest, { I: -16, mono: true, ss: s0, t: s1 - s0, extra: 'highpass=f=180,lowpass=f=5200,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,afade=t=out:st=' + Math.max(0, s1 - s0 - 0.12).toFixed(2) + ':d=0.12' });
    const seconds = +duration(dest).toFixed(3);
    let heard = null;
    try { heard = (await transcribe(dest)).text; } catch (e) { console.warn(`[bake] ${v.id}: transcribe failed ${e.message.slice(0, 120)}`); }
    manifest.voice[v.id] = { file: `audio/${v.id}.ogg`, seconds, line: v.line };
    notes[v.id] = { heard };
    console.log(`[bake] voice ${v.id}: ${seconds}s heard "${heard}"`);
  }

  for (const s of SFX) {
    if (!want(s.id)) continue;
    const src = path.join(RAW, `${s.id}.mp4`);
    if (!fs.existsSync(src) && s.raw && fs.existsSync(path.join(RAW, `${s.raw}.mp4`))) fs.copyFileSync(path.join(RAW, `${s.raw}.mp4`), src);
    if (!fs.existsSync(src)) { console.warn(`[bake] ${s.id}: no take`); continue; }
    const x = samples(src);
    // A take's first 0.1 s is often the model's click of a start: left out.
    const ev = events(x, s.cut === 'one' ? { gap: 0.8, maxLen: 999 } : {});
    let list = ev.list.filter((e) => e.end > 0.12);
    for (const f of fs.readdirSync(OUT)) if (f.startsWith(`${s.id}.`) || f.startsWith(`${s.id}-`) && /^\S+-\d+\.ogg$/.test(f) && f.replace(/-\d+\.ogg$/, '') === s.id) fs.rmSync(path.join(OUT, f));
    const files = [];
    const secs = [];
    const TARGET = -17;
    if (s.cut === 'one') {
      if (!list.length) { console.warn(`[bake] ${s.id}: silent`); continue; }
      const start = list[0].start;
      const end = Math.min(duration(src), list[list.length - 1].end + 0.25);
      let acc = 0; let n = 0;
      for (const e of list) { acc += 10 ** (e.rms / 10) * (e.end - e.start); n += e.end - e.start; }
      const dest = path.join(OUT, `${s.id}.ogg`);
      cutSfx(src, start, end, db(Math.sqrt(acc / Math.max(1e-6, n))), TARGET, dest);
      files.push(`audio/${s.id}.ogg`); secs.push(+duration(dest).toFixed(3));
    } else {
      // the loudest sounds of the take (a quiet echo of one is not a variant), in the order heard
      const loud = Math.max(...list.map((e) => e.peak));
      list = list.filter((e) => e.peak >= loud - 14).sort((a, b) => b.peak - a.peak).slice(0, s.max ?? 5).sort((a, b) => a.start - b.start);
      list.forEach((e, i) => {
        const dest = path.join(OUT, `${s.id}-${i + 1}.ogg`);
        cutSfx(src, e.start, e.end, e.rms, TARGET, dest);
        files.push(`audio/${s.id}-${i + 1}.ogg`); secs.push(+duration(dest).toFixed(3));
      });
    }
    let heard = null;
    try { heard = (await transcribe(src.replace(/\.mp4$/, '.mp4'))).text; } catch { /* the check is a nicety */ }
    manifest.sfx[s.id] = { files, seconds: secs };
    notes[s.id] = { found: ev.list.length, kept: files.length, floor: +ev.floor.toFixed(1), peak: +ev.peak.toFixed(1), heard };
    console.log(`[bake] sfx ${s.id}: ${files.length} of ${ev.list.length} sounds, ${secs.join(' ')}s${heard ? ` WORDS: "${heard}"` : ''}`);
  }

  manifest.v = 1;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
  const notesFile = path.join(RAW, 'bake-notes.json');
  const old = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : {};
  fs.writeFileSync(notesFile, JSON.stringify({ ...old, ...notes }, null, 1));
  fs.rmSync(TMP, { recursive: true, force: true });
}

if (!BAKE_ONLY) await generate();
await bake();
