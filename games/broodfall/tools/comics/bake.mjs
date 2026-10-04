/**
 * The comics the game ships (content/comics.ts), baked from the comics made in comics/<id>/ (comics/README.md):
 *
 *   comics/<id>/pages/page_NN.jpg      ->  public/art/ship/comics/<id>/page_NN.webp   the pages with their words
 *   comics/<id>/panels/NN_<name>.jpg   ->  public/art/ship/comics/<id>/cover.webp     one picture, clean, small: the one
 *                                                                                   script.json names in "cover" (a panel
 *                                                                                   id), else the first
 *
 * A folder under public/art/ship/comics/ is rebuilt whole: what the game does not load is not left in it
 * (tests/comics.test.ts holds the folder to content/comics.ts). Free: ffmpeg only.
 *   node tools/comics/bake.mjs            every comic that has pages
 *   node tools/comics/bake.mjs <id> ...   only these
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(root, 'comics');
const OUT = join(root, 'public', 'art', 'ship', 'comics');
const PAGE_WIDTH = 1800; // as made: the lettering is sized for it
const COVER_WIDTH = 640;

function webp(from, to, width, q) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', from, '-vf', `scale='min(${width},iw)':-2`, '-c:v', 'libwebp', '-q:v', String(q), '-compression_level', '6', to]);
  if (r.status !== 0) throw new Error(`could not bake ${from}: ${String(r.stderr).slice(-300)}`);
}

const only = process.argv.slice(2);
const ids = readdirSync(SRC).filter((d) => existsSync(join(SRC, d, 'pages')) && (!only.length || only.includes(d)));
if (!ids.length) { console.error('no comic to bake: comics/<id>/pages/ is where the made pages go'); process.exit(1); }
for (const id of ids) {
  const pages = readdirSync(join(SRC, id, 'pages')).filter((f) => /^page_\d\d\.jpg$/.test(f)).sort();
  if (!pages.length) { console.error(`${id}: no page_NN.jpg in comics/${id}/pages`); process.exitCode = 1; continue; }
  const clean = existsSync(join(SRC, id, 'panels')) ? readdirSync(join(SRC, id, 'panels')).filter((f) => /^\d\d_.+\.jpg$/.test(f) && !/_words\.jpg$/.test(f)).sort() : [];
  let wanted = '';
  try { wanted = String(JSON.parse(readFileSync(join(SRC, id, 'script.json'), 'utf8')).cover || ''); } catch { /* no script: the first picture */ }
  const cover = (wanted && clean.find((f) => f.replace(/^\d\d_/, '').replace(/\.jpg$/, '') === wanted)) || clean[0];
  if (wanted && cover && !cover.includes(wanted)) console.warn(`${id}: script.json names the cover "${wanted}" and no picture is called that; the first one is used`);
  if (!cover) { console.error(`${id}: no picture in comics/${id}/panels (NN_<name>.jpg) for the cover`); process.exitCode = 1; continue; }
  const dir = join(OUT, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const p of pages) webp(join(SRC, id, 'pages', p), join(dir, p.replace(/\.jpg$/, '.webp')), PAGE_WIDTH, 84);
  webp(join(SRC, id, 'panels', cover), join(dir, 'cover.webp'), COVER_WIDTH, 80);
  const kb = readdirSync(dir).reduce((n, f) => n + statSync(join(dir, f)).size, 0) / 1024;
  console.log(`${id}: ${pages.length} page${pages.length === 1 ? '' : 's'} + cover, ${Math.round(kb)} KB`);
}
