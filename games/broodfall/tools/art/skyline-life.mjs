/**
 * THE ORGAN STAGE'S SKYLINE, ALIVE (Oct 1 2026, notes/VIDEO-AUDIT.md). FREE: nothing is generated.
 *
 *   node tools/art/skyline-life.mjs
 *
 * The skyline over the organ stage is a thin wireframe drawing (public/art/under/sky-<set>.webp, screen-blended): a
 * video model would melt its lines. So it is brought to life in CSS (src/ui/underground.ts paintAbove, src/style.css
 * `.skyline-life`): a red warning light blinking on its tallest spire, a thin wisp of smoke from the tallest roof of
 * the other half, and a slow searchlight sweeping up from the inner edge of the city, by the meteor. This finds those
 * three points in each picture (the first bright pixel down each column), as shares of the picture, and writes
 * public/art/under/skyline-life.json. Review: notes/art-review/skyline-life/<set>.jpg (the points marked).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ART, REVIEW } from './lib/manifest.mjs';

const DIR = path.join(ART, 'under');
const REV = path.join(REVIEW, 'skyline-life');
const out = {};
fs.mkdirSync(REV, { recursive: true });
for (const f of fs.readdirSync(DIR).filter((x) => /^sky-[a-z]+\.webp$/.test(x)).sort()) {
  const set = f.slice(4, -5);
  const file = path.join(DIR, f);
  const [W, H] = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', 'format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 64 * 1024 * 1024 }).stdout;
  // The top of the drawing in each column (H when the column is empty); the base line along the bottom is ignored.
  const top = new Array(W).fill(H);
  for (let x = 0; x < W; x++) for (let y = 0; y < H - 6; y++) if (raw[y * W + x] > 70) { top[x] = y; break; }
  const tallest = (a, b) => { let best = a; for (let x = a; x < b; x++) if (top[x] < top[best]) best = x; return best; };
  const L = tallest(0, W >> 1), R = tallest(W >> 1, W);
  const beacon = top[L] <= top[R] ? L : R;
  const smoke = beacon === L ? R : L;
  // The searchlight stands at the inner edge of the beacon's half (the city's last building by the gap in the middle).
  let edge = beacon === L ? (W >> 1) : (W >> 1);
  if (beacon === L) { for (let x = (W >> 1); x > 0; x--) if (top[x] < H - 8) { edge = x; break; } } else { for (let x = (W >> 1); x < W; x++) if (top[x] < H - 8) { edge = x; break; } }
  const share = (x, y) => [+(x / W).toFixed(4), +(y / H).toFixed(4)];
  out[set] = { beacon: share(beacon, top[beacon]), smoke: share(smoke, top[smoke]), search: share(edge, H - 6) };
  const mark = (x, y, c) => `drawbox=x=${x - 6}:y=${Math.max(0, y - 6)}:w=12:h=12:color=${c}:t=2`;
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf',
    [mark(beacon, top[beacon], 'red'), mark(smoke, top[smoke], 'white'), mark(edge, H - 6, 'yellow')].join(','), path.join(REV, `${set}.jpg`)]);
  console.log(`[skyline-life] ${set}: ${JSON.stringify(out[set])}`);
}
fs.writeFileSync(path.join(DIR, 'skyline-life.json'), JSON.stringify(out, null, 2) + '\n');
