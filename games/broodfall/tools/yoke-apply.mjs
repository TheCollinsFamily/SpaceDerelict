/**
 * YOKE'S LINES: PUT THE WORDS HE TYPED ON THE PAGE INTO THE GAME FILES (Collins, Oct 26 2026: "still making changes, have
 * them reflected wherever this stuff is recorded").
 *
 *   node tools/yoke-apply.mjs <dir>     <dir>/edits/*.json: the page's `edits` collection, saved by ArtifactData list out_dir
 *
 * For every rewritten beat, finds the line's current words (from notes/YOKE-LINES.html) in the game's text files, written
 * as they are there (plain, or with \' and \" inside a quoted string), and replaces them, but only where they occur exactly
 * once. Anything else is listed for a session to do by hand: a beat found nowhere or in two places, a cut, a note.
 * Then re-run tools/yoke-lines.ts and republish the page: a beat that now reads as he wrote it clears from the page by itself.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/yoke-apply.mjs <dir with edits/*.json>'); process.exit(1); }
const page = fs.readFileSync(path.join(ROOT, 'notes', 'YOKE-LINES.html'), 'utf8');
const DATA = JSON.parse(page.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, '</'));
const LINES = {};
const walk = (b) => (b.lines || []).forEach((l) => { LINES[l.id] = l; });
DATA.steps.forEach((s) => s.branches.forEach(walk));
const FILES = ['content', 'src'].flatMap(function list(d) {
  const full = path.join(ROOT, d);
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? list(path.join(d, e.name)) : /\.(ts|md)$/.test(e.name) ? [path.join(d, e.name)] : []);
});
const text = Object.fromEntries(FILES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
const forms = (s) => [...new Set([s, s.replace(/'/g, "\\'"), s.replace(/"/g, '\\"')])];
const done = [], todo = [];
for (const f of fs.readdirSync(path.join(dir, 'edits')).filter((x) => x.endsWith('.json'))) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'edits', f), 'utf8'));
  const e = raw.data || raw, l = LINES[e.id];
  if (!l) { todo.push(`${e.id}: not on the page any more`); continue; }
  for (const [i, to] of Object.entries(e.text || {})) {
    const from = l.text[i];
    if (from == null || from === to) continue;
    let hit = null, count = 0;
    for (const file of FILES) for (const form of forms(from)) {
      const n = text[file].split(form).length - 1;
      if (n) { count += n; hit = { file, form }; }
    }
    if (count !== 1) { todo.push(`${e.id} beat ${+i + 1}: found ${count} times, not changed. "${from.slice(0, 60)}"`); continue; }
    const esc = hit.form === from ? to : hit.form.includes("\\'") ? to.replace(/'/g, "\\'") : to.replace(/"/g, '\\"');
    text[hit.file] = text[hit.file].replace(hit.form, esc);
    done.push(`${e.id} beat ${+i + 1} (${hit.file}): "${from}" -> "${to}"`);
  }
  if (e.cut) todo.push(`${e.id}: marked Remove`);
  if ((e.note || '').trim()) todo.push(`${e.id}: note: ${e.note.trim()}`);
}
for (const f of FILES) if (text[f] !== fs.readFileSync(path.join(ROOT, f), 'utf8')) fs.writeFileSync(path.join(ROOT, f), text[f]);
console.log(`APPLIED (${done.length})`); done.forEach((x) => console.log('  ' + x));
console.log(`FOR A SESSION (${todo.length})`); todo.forEach((x) => console.log('  ' + x));
