/**
 * The letters' pictures (content/letters.ts `picture`): bake art-src/letters/pictures/<id>.png to public/art/letters/<id>.webp
 * at 512 px wide, the size the Letters room shows them (src/ui/campaignUi.ts lettersHtml). Mirelle's is option f3 of
 * tools/art/mirelle-options.mjs (Collins, Oct 14 2026: "let's go with 3 white").
 *
 *   node tools/art/letters.mjs            → every picture in art-src/letters/pictures/
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/manifest.mjs';

const SRC = path.join(ROOT, 'art-src', 'letters', 'pictures');
const OUT = path.join(ROOT, 'public', 'art', 'letters');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith('.png'))) {
  const id = f.replace(/\.png$/, '');
  const out = path.join(OUT, `${id}.webp`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(SRC, f), '-vf', 'scale=512:-2:flags=lanczos', '-quality', '86', out]);
  if (r.status !== 0) throw new Error(`${id}: ffmpeg failed`);
  console.log(`${out}: ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
