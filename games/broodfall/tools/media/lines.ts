/**
 * The leaders' loose lines (asides and any line outside a scene card) and whether each is voiced:
 *   npx vite-node tools/media/lines.ts             the list
 *   npx vite-node tools/media/lines.ts -- --sheet  also the listening sheet and reel for Collins:
 *       notes/screens/2026-10-01/asides-voices-README.md + asides-voices-reel.ogg
 * Free: it reads content/ and public/media/ only. `make.ts -- voices lines` then `bake lines` make the missing ones.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FACTIONS } from '../../content/campaign';
import { LEADER_VOICES, lineKey, looseLeaderLines, speakerOf, spokenText } from '../../content/media';

const media = JSON.parse(fs.readFileSync('public/media/media.json', 'utf8'));
const loose = looseLeaderLines();
let missing = 0;
for (const l of loose) {
  const v = media.voices[lineKey(l)];
  const ok = v && v.text === spokenText(l);
  if (!ok) missing++;
  console.log(`${ok ? 'voiced ' : 'MISSING'} ${lineKey(l).padEnd(30)} ${speakerOf(l)}: ${spokenText(l).slice(0, 70)}`);
}
console.log(`${loose.length} loose lines, ${missing} not voiced`);

if (process.argv.includes('--sheet')) {
  const dir = path.join('notes', 'screens', '2026-10-01');
  fs.mkdirSync(dir, { recursive: true });
  // Paths as Collins opens them: in his checkout of the repo, wherever this ran (a worktree, say).
  const home = process.env.BROODFALL_HOME || 'C:\\Users\\Merry\\dev\\space-derelict\\games\\broodfall';
  const abs = (p: string) => path.win32.join(home, path.relative(process.cwd(), path.resolve(p)));
  const review = fs.existsSync('notes/art-review/media/speech.json') ? JSON.parse(fs.readFileSync('notes/art-review/media/speech.json', 'utf8')) : {};
  const rows: string[] = [];
  const files: string[] = [];
  let t = 0;
  for (const l of loose) {
    const k = lineKey(l);
    const v = media.voices[k];
    if (!v) continue;
    const f = FACTIONS.find((x) => x.asides.includes(l));
    const how = LEADER_VOICES[speakerOf(l)];
    const mm = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    rows.push(`| ${mm} | ${f?.name ?? 'campaign'} | ${l.slice(0, l.indexOf(':'))} | ${how.how === 'veo' ? 'Veo 3.1 Lite, radio EQ' : how.voice} | ${v.seconds.toFixed(1)} s | ${review[k] ? `${Math.round(review[k].share * 100)}%` : '—'} | ${spokenText(l).replace(/\|/g, '/')} | \`${abs(path.join('public', v.file))}\` |`);
    files.push(path.join('public', v.file));
    t += v.seconds + 1;
  }
  const reel = path.join(dir, 'asides-voices-reel.ogg');
  const args = ['-hide_banner', '-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex',
    `${files.map((_, i) => `[${i}:a]aresample=48000,apad=pad_dur=1[a${i}]`).join(';')};${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[o]`,
    '-map', '[o]', '-c:a', 'libopus', '-b:a', '64k', reel];
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status) console.warn(r.stderr.slice(0, 400));
  fs.writeFileSync(path.join(dir, 'asides-voices-README.md'), `# Broodfall: the leaders' asides, voiced (listening sheet, Oct 1 2026)

The letters, broadcasts and calls each ally sends between deployments (\`content/campaign.ts\` \`asides\`), until
now read and not heard. Each is said in that leader's own voice, the same as his scene lines: the Delegate
Aura Helena, the Voice Veo 3.1 Lite as a 1950s radio evangelist through the radio EQ, the Director Aura Aries.
His own log lines ("You: (log) …") are not voiced. Levels: -16 LUFS, like every leader line.

**Listen:** \`${abs(reel)}\` (every line in the order below, a second between them; the time column is where each starts).
**Seen and heard in game:** \`${abs(path.join(dir, 'asides-report.mp4'))}\` (the report: her letter plays by itself, lit; Esc stops it).

Where they play: the post-deployment report plays the ally's aside by itself once (▶/■ on the line, a click or Esc
stops it, RETURN TO THE SHIP stops it); the ship's Comms room inbox carries ▶ on every leader line. Voices at 0 in
Settings: no button, nothing plays. "Heard" is the transcription of the Veo takes read back against the line
(the Aura voices are a text-to-speech model and say the words as written).

| At | Ally | Who, how it reaches him | Voice | Length | Heard | Words | File |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`);
  console.log(`sheet: ${abs(path.join(dir, 'asides-voices-README.md'))}`);
}
