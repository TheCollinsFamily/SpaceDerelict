/**
 * The gaps between spoken words in a baked film (Oct 5 2026; Collins: "there is a lot of audio dead space in the
 * Institute and Faithful videos"). A silence detector misses dead air that has room tone in it; this hears the film
 * (in 40 s pieces) and prints every gap between two words longer than the limit, with the words either side.
 *
 *   node tools/measure/film-gaps.mjs <film> [limit seconds, default 1.2]     (a few tokens a minute of film)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const film = process.argv[2];
const limit = Number(process.argv[3] ?? 1.2);
const src = path.join(ROOT, 'public', 'media', 'scenes', `${film}.mp4`);
const wav = path.join(ROOT, 'art-src-new', `${film}-gaps.wav`);
const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' }).stdout);
const words = [];
for (let at = 0; at < dur; at += 36) {
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(at), '-t', '40', '-i', src, '-vn', '-ac', '1', '-ar', '16000', wav]);
  const r = await (await fetch('https://api.rfab.ai/api/audio/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.RFAB_API_KEY }, body: JSON.stringify({ audioBase64: fs.readFileSync(wav).toString('base64') }) })).json();
  const last = words.length ? words[words.length - 1].end : -1;
  for (const w of r.words ?? []) if (w.start + at > last - 0.05) words.push({ w: w.word ?? w.punctuated_word, start: w.start + at, end: w.end + at });
}
fs.rmSync(wav, { force: true });
const gaps = [];
if (words.length && words[0].start > limit) gaps.push(`${words[0].start.toFixed(1)} s before the first word`);
for (let i = 0; i + 1 < words.length; i++) {
  const g = words[i + 1].start - words[i].end;
  if (g > limit) gaps.push(`${words[i].end.toFixed(1)} s: ${g.toFixed(1)} s between "${words[i].w}" and "${words[i + 1].w}"`);
}
console.log(`${film}: ${dur.toFixed(1)} s, ${words.length} words, ${gaps.length} gaps over ${limit} s${gaps.length ? '\n  ' + gaps.join('\n  ') : ''}`);
