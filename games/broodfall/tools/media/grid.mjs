// Review grids: pictures of a folder in 2x2 grids with their ids set under them (to LOOK at).
//   node tools/media/grid.mjs <dir> <out-prefix> [ids...]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [dir, prefix, ...ids] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => /\.(png|jpg|webp)$/.test(f) && !f.includes('-169') && (!ids.length || ids.includes(f.replace(/\.\w+$/, '')))).sort();
const font = 'C\\:/Windows/Fonts/arial.ttf';
for (let g = 0; g < files.length; g += 4) {
  const four = files.slice(g, g + 4);
  while (four.length < 4) four.push(four[four.length - 1]);
  const inputs = four.flatMap((f) => ['-i', path.join(dir, f)]);
  const lab = four.map((f, i) => `[${i}]scale=720:480,drawtext=fontfile='${font}':text='${f.replace(/\.\w+$/, '')}':x=8:y=h-34:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.7[v${i}]`).join(';');
  const out = `${prefix}-${String(g / 4 + 1).padStart(2, '0')}.jpg`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${lab};[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[o]`, '-map', '[o]', '-q:v', '4', out], { encoding: 'utf8' });
  if (r.status) console.error(r.stderr.slice(0, 300)); else console.log(out);
}
