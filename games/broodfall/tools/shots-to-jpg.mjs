/**
 * The screenshot beats write PNG (the pixel checks read them). A painted board makes each
 * one about 2 MB, and every run rewrites all of them: committed as they are, the repo grows
 * by about 90 MB a run. What is committed is a JPEG copy of each (about a tenth the size);
 * the PNGs stay on disk and are ignored by git (.gitignore at the repo root).
 *
 * Usage: node tools/shots-to-jpg.mjs        after running the beats, before committing
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
let made = 0, before = 0, after = 0;
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.png')) continue;
  const png = join(dir, name);
  const jpg = join(dir, name.replace(/\.png$/, '.jpg'));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', jpg]);
  if (r.status !== 0) { console.error(`could not convert ${name}: ${String(r.stderr).slice(-200)}`); process.exitCode = 1; continue; }
  made++;
  before += statSync(png).size;
  after += statSync(jpg).size;
}
console.log(`${made} screenshots: ${(before / 1048576).toFixed(1)} MB of PNG, ${(after / 1048576).toFixed(1)} MB of JPEG in ${dir}`);
