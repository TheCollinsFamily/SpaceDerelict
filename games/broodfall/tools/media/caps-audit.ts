/**
 * THE ALL-CAPS AUDIT (Oct 1 2026). A video model (Veo) reads a word in capitals as an acronym and spells it out
 * ("nothing E V E R happens"). This lists every spoken line in the game that has an all-caps word of two or more
 * letters, with the file its voice was baked into, and (with --hear) transcribes each take back and says whether
 * it came back as words or as letters. Free without --hear; --hear spends a little (Deepgram through RFab).
 *
 *   npx vite-node tools/media/caps-audit.ts            the list
 *   npx vite-node tools/media/caps-audit.ts -- --hear  the list, each take heard
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROACH_ADDRESSES } from '../../content/roachKing';
import { GREETINGS } from '../../content/greetings';
import { transcribe } from './lib.mjs';

const ROOT = path.resolve(__dirname, '..', '..');
const PUB = path.join(ROOT, 'public');
/** All-caps words of two or more letters (AI is said as letters on purpose). */
export const capsIn = (t: string): string[] => (t.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => w !== 'AI');
/** What a transcriber gives back for a spelled word: capitals ("SKY", "every ER", "AL Ive") or loose single letters. */
export const spells = (heard: string): boolean =>
  /\b[A-Z]{2,}\b/.test(heard.replace(/\bAI\b/g, '')) || /\b[A-Z]{2,}[a-z]/.test(heard) || /(?:\b[A-Za-z]\b[ .-]+){2,}\b[A-Za-z]\b/.test(heard);

interface Row { source: string; how: string; key: string; text: string; caps: string[]; file: string | null }
const rows: Row[] = [];
const add = (r: Omit<Row, 'caps'>) => { const caps = capsIn(r.text); if (caps.length) rows.push({ ...r, caps }); };
const json = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);

// The leaders' lines and the newsreel narration (tools/media/make.ts).
const media = json(path.join(PUB, 'media', 'media.json'));
for (const [k, v] of Object.entries<{ file: string; text: string; who: string }>(media?.voices ?? {}))
  add({ source: 'media voices', how: v.who === 'The Voice' ? 'veo' : 'aura', key: k, text: v.text, file: path.join(PUB, v.file) });
for (const [k, v] of Object.entries<{ file: string; line: string }>(media?.narration ?? {}))
  add({ source: 'media narration', how: 'veo', key: k, text: v.line, file: path.join(PUB, v.file) });
// The Roach King's broadcasts (tools/media/roachking.ts): he speaks on camera, the sound is in the clip.
const roach = json(path.join(PUB, 'media', 'roach', 'roach.json'));
for (const a of ROACH_ADDRESSES) for (const s of a.shots) {
  if (!s.line) continue;
  const c = roach?.clips?.[s.id];
  add({ source: 'roach king', how: 'veo', key: s.id, text: s.line, file: c?.video ? path.join(PUB, c.video) : null });
}
// The game's own voice cues (tools/audio/cues.mjs: the opening's newsreel man, the planetside barks).
const audio = json(path.join(PUB, 'audio', 'manifest.json'));
for (const [k, v] of Object.entries<{ file: string; line: string }>(audio?.voice ?? {}))
  add({ source: 'audio cues', how: 'veo', key: k, text: v.line ?? '', file: path.join(PUB, v.file) });
// YOKE: her clips carry no sound; her greetings are spoken live by rfab.ai's /speak (a TTS voice). Listed, not heard here.
for (const g of GREETINGS) g.beats.forEach((b, i) => { if ('say' in b && b.say) add({ source: 'yoke greetings', how: 'speak (live TTS)', key: `${g.id}#${i}`, text: b.say, file: null }); });

const hear = process.argv.includes('--hear');
for (const r of rows) {
  let verdict = '';
  if (hear && r.file && fs.existsSync(r.file)) {
    const wav = path.join(os.tmpdir(), `caps-${r.key.replace(/[^a-z0-9]+/gi, '_')}.wav`);
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', r.file, '-vn', '-ac', '1', '-ar', '16000', wav]);
    try {
      const h = await transcribe(wav);
      const text = typeof h === 'string' ? h : h.text ?? '';
      verdict = `${spells(text) ? 'SPELLS' : 'words '} "${text}"`;
    } catch (e) { verdict = `ERR ${(e as Error).message.slice(0, 60)}`; }
  }
  console.log(`${r.source.padEnd(15)} ${r.how.padEnd(16)} ${r.key.padEnd(44)} [${r.caps.join(' ')}] "${r.text}"${verdict ? `\n${' '.repeat(16)}=> ${verdict}` : ''}`);
}
console.log(`\n${rows.length} spoken lines with an all-caps word.`);
