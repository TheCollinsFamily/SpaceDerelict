/**
 * public/art/manifest.json: what the game loads. One entry per baked asset. The game
 * draws its old shapes for anything that has no entry, so assets can arrive one at a time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Baked assets the game loads (committed). */
export const ART = path.join(ROOT, 'public', 'art');
/** Raw stills and clips (not committed). */
export const SRC = path.join(ROOT, 'art-src');
/** Pictures for a person to look at: one per asset (committed). */
export const REVIEW = path.join(ROOT, 'notes', 'art-review');
const FILE = path.join(ART, 'manifest.json');

export function readManifest() {
  if (!fs.existsSync(FILE)) return { version: 1, units: {}, limbs: {}, board: {}, biomes: {}, ship: {} };
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

/**
 * One writer at a time. Several sessions bake at once, and each reads the whole manifest,
 * changes one entry and writes the whole of it back: two that did so in the same moment
 * lost one of the two entries. A folder is made to take the lock (making a folder either
 * succeeds or fails, never half) and removed to give it back; a lock older than a minute
 * was left by a session that died, and is taken over.
 */
function locked(work) {
  const lock = `${FILE}.lock`;
  fs.mkdirSync(ART, { recursive: true });
  const until = Date.now() + 30000;
  for (;;) {
    try { fs.mkdirSync(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let age = 0;
      try { age = Date.now() - fs.statSync(lock).mtimeMs; } catch { continue; }
      if (age > 60000 || Date.now() > until) { try { fs.rmdirSync(lock); } catch { /* another took it over */ } continue; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
    }
  }
  try { return work(); } finally { try { fs.rmdirSync(lock); } catch { /* taken over */ } }
}

/** Add or replace one entry, keeping every key in a fixed order so the file diffs cleanly. */
export function putEntry(section, id, entry) {
  return locked(() => putEntryNow(section, id, entry));
}

function putEntryNow(section, id, entry) {
  const m = readManifest();
  m[section] = { ...(m[section] ?? {}), [id]: entry };
  const sorted = { version: m.version };
  for (const k of ['units', 'limbs', 'board', 'biomes', 'ship']) {
    sorted[k] = Object.fromEntries(Object.entries(m[k] ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  }
  fs.mkdirSync(ART, { recursive: true });
  fs.writeFileSync(FILE, `${JSON.stringify(sorted, null, 1)}\n`);
  return sorted;
}
