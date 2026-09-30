/**
 * THE LISTENING SHEET AND REELS (free; run after tools/audio/make.mjs):
 *   notes/screens/2026-09-30/audio-README.md     every file, what it is for, its length, the prompt
 *   notes/screens/2026-09-30/audio-reel-music.ogg every piece of music (a loop: its first 20 s, then
 *                                                 its seam: the last 6 s running into the first 6 s)
 *   notes/screens/2026-09-30/audio-reel-sfx.ogg   every effect, all its variants, in the order of the sheet
 *   notes/screens/2026-09-30/audio-reel-voice.ogg the narrator's lines
 * It also measures each file (loudness, peak, and for a loop the jump at its seam).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MUSIC, SFX, VOICE } from './cues.mjs';
import { RAW, ROOT } from './rfab-audio.mjs';

const PUB = path.join(ROOT, 'public');
const NOTES = path.join(ROOT, 'notes', 'screens', '2026-09-30');
const TMP = path.join(RAW, 'reel-tmp');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(PUB, 'audio', 'manifest.json'), 'utf8'));
const bakeNotes = fs.existsSync(path.join(RAW, 'bake-notes.json')) ? JSON.parse(fs.readFileSync(path.join(RAW, 'bake-notes.json'), 'utf8')) : {};

const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status) throw new Error(r.stderr.slice(0, 400)); };
const stderr = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr || '';
function loud(file) {
  const s = stderr(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const i = [...s.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  const p = [...s.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop();
  return { lufs: i ? Number(i[1]) : null, peak: p ? Number(p[1]) : null };
}
function pcm(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
}
/** The jump at a loop's seam against the track's own sample-to-sample movement (1 = no worse than anywhere else). */
function seam(file) {
  const x = pcm(file);
  let sum = 0;
  for (let i = 1; i < x.length; i++) sum += Math.abs(x[i] - x[i - 1]);
  const mean = sum / (x.length - 1);
  // around the seam: the mean movement over the 10 samples either side of the wrap
  let s = 0;
  for (let k = -10; k < 10; k++) { const a = x[(x.length + k) % x.length]; const b = x[(x.length + k + 1) % x.length]; s += Math.abs(b - a); }
  return (s / 20) / Math.max(1e-9, mean);
}
const secs = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim()) || 0;
const wav = (i) => path.join(TMP, `p${String(i).padStart(4, '0')}.wav`);
let n = 0;
function piece(src, { ss, t, gain = 0 } = {}) {
  const out = wav(n++);
  ff([...(ss !== undefined ? ['-ss', String(ss)] : []), ...(t !== undefined ? ['-t', String(t)] : []), '-i', src, '-ar', '48000', '-ac', '2', '-af', `volume=${gain}dB`, '-c:a', 'pcm_s16le', out]);
  return out;
}
function gap(s) { const out = wav(n++); ff(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(s), '-c:a', 'pcm_s16le', out]); return out; }
function reel(list, dest) {
  const txt = path.join(TMP, `${path.basename(dest)}.txt`);
  fs.writeFileSync(txt, list.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', txt, '-c:a', 'libopus', '-b:a', '128k', dest]);
}

const rows = { music: [], sfx: [], voice: [] };
const meta = (id) => { const f = path.join(RAW, `${id}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };

// music
const mList = [];
for (const m of MUSIC) {
  const e = manifest.music[m.id];
  if (!e) continue;
  const f = path.join(PUB, e.file);
  const L = loud(f);
  const sm = e.loop ? seam(f) : null;
  rows.music.push({ id: m.id, file: f, for: m.for, seconds: e.seconds, loop: e.loop, ...L, seam: sm, model: meta(m.id).model ?? 'elevenlabs:music_v2', prompt: m.spec.freeform, style: [...(m.spec.genres ?? []), ...(m.spec.moods ?? [])].join(', ') });
  if (e.loop) {
    const d = secs(f);
    mList.push(piece(f, { t: 20 }), gap(0.6), piece(f, { ss: d - 6 }), piece(f, { t: 6 }), gap(1.5));
  } else mList.push(piece(f), gap(1.5));
}
reel(mList, path.join(NOTES, 'audio-reel-music.ogg'));

// effects
const sList = [];
for (const s of SFX) {
  const e = manifest.sfx[s.id];
  if (!e) continue;
  const files = e.files.map((x) => path.join(PUB, x));
  const L = files.map(loud);
  rows.sfx.push({ id: s.id, files, for: s.for, seconds: e.seconds, peak: Math.max(...L.map((l) => l.peak ?? -99)), model: meta(s.id).model ?? 'atlascloud:h3-t2v', prompt: s.prompt, heard: bakeNotes[s.id]?.heard ?? '', found: bakeNotes[s.id]?.found });
  for (const f of files) sList.push(piece(f), gap(0.35));
  sList.push(gap(1.1));
}
reel(sList, path.join(NOTES, 'audio-reel-sfx.ogg'));

// voice
const vList = [];
for (const v of VOICE) {
  const e = manifest.voice[v.id];
  if (!e) continue;
  const f = path.join(PUB, e.file);
  rows.voice.push({ id: v.id, file: f, for: v.for, seconds: e.seconds, line: v.line, heard: bakeNotes[v.id]?.heard ?? '', ...loud(f), model: meta(v.id).model ?? '' });
  vList.push(piece(f), gap(0.8));
}
if (vList.length) reel(vList, path.join(NOTES, 'audio-reel-voice.ogg'));

fs.writeFileSync(path.join(RAW, 'sheet.json'), JSON.stringify(rows, null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`music ${rows.music.length}, effects ${rows.sfx.length} (${rows.sfx.reduce((a, r) => a + r.files.length, 0)} files), voice ${rows.voice.length}; data in ${path.join(RAW, 'sheet.json')}`);

// ------------------------------------------------------------------ the listening sheet
const full = (f) => f.replace(/\//g, '\');
const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '' : Number(v).toFixed(d));
const esc = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const md = [];
md.push('# Broodfall sound: the listening sheet (Sep 30 2026)', '');
md.push(fs.readFileSync(path.join(ROOT, 'tools', 'audio', 'sheet-head.md'), 'utf8').trim(), '');
md.push('## Music', '', '| id | what it is for | seconds | loop (seam jump ×) | LUFS | peak dBFS | model | asked for |', '|---|---|---|---|---|---|---|---|');
for (const r of rows.music) md.push(`| \`${r.id}\` | ${esc(r.for)} | ${fmt(r.seconds)} | ${r.loop ? `yes (${fmt(r.seam, 2)})` : 'no'} | ${fmt(r.lufs)} | ${fmt(r.peak)} | ${r.model} | ${esc(r.style)}. ${esc(r.prompt)} |`);
md.push('', 'Files:', '');
for (const r of rows.music) md.push(`- \`${full(r.file)}\``);
md.push('', '## Effects', '', '| id | what it is for | variants (seconds each) | peak dBFS | model | asked for |', '|---|---|---|---|---|---|');
for (const r of rows.sfx) md.push(`| \`${r.id}\` | ${esc(r.for)} | ${r.files.length}: ${r.seconds.map((x) => fmt(x, 2)).join(', ')} | ${fmt(r.peak)} | ${r.model} | ${esc(r.prompt)}${r.heard ? ` **(words heard in the take: "${esc(r.heard)}")**` : ''} |`);
md.push('', 'Files (every variant):', '');
for (const r of rows.sfx) for (const f of r.files) md.push(`- \`${full(f)}\``);
if (rows.voice.length) {
  md.push('', '## The newsreel narrator', '', '| id | when | seconds | the line | heard back (Deepgram) | model |', '|---|---|---|---|---|---|');
  for (const r of rows.voice) md.push(`| \`${r.id}\` | ${esc(r.for)} | ${fmt(r.seconds, 2)} | ${esc(r.line)} | ${esc(r.heard)} | ${r.model} |`);
  md.push('', 'Files:', '');
  for (const r of rows.voice) md.push(`- \`${full(r.file)}\``);
}
fs.writeFileSync(path.join(NOTES, 'audio-README.md'), md.join('\n') + '\n');
console.log(`sheet: ${path.join(NOTES, 'audio-README.md')}`);
