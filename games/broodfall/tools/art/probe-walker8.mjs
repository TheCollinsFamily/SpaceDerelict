/**
 * Graphics probe: ONE insect in 8 directions from video (notes/GRAPHICS-PLAN.md).
 * Five views are generated (toward, toward-left, left, away-left, away); the three
 * right-hand views are mirror images. The first still is the reference for the other four.
 * PAID: about $0.35 per new view.
 *
 *   node tools/art/probe-walker8.mjs
 *
 * Writes notes/probes/<date>/walker8/: a sheet per view, a compass picture of all eight,
 * and demo.html (the insect walking a loop on the board, turning through every direction).
 */
import fs from 'node:fs';
import path from 'node:path';
import { CAMERA, LIGHT, OUT_DIR, RAW_DIR, ROOT, ffmpeg, keyChain, loopWindow, makeClip, makeStill, ready } from './rfab.mjs';

const FRAME = 128; // px per frame in the sheet
const FPS = 12;
const COLS = 8;

const INSECT =
  'A stocky six-legged alien insect soldier with thick sturdy legs, a broad armoured thorax of rust-orange and ' +
  'dark brown chitin, heavy mandibles and short antennae';
const SAME =
  'The exact same insect as in the reference picture: the same design, the same colours, the same armour plates, ' +
  'the same leg shape, the same proportions and the same size in the frame. The same camera: ' +
  `${CAMERA}. Only its heading changes.`;
const WALK =
  'The insect walks on the spot as if on a treadmill: its six legs step in a steady alternating gait, ' +
  'the body bobs slightly, the antennae twitch. It never travels across the frame and never turns.';

/** Screen directions. `mirrorOf`: made by flipping that view left-to-right. */
const VIEWS = [
  { dir: 'SW', slug: 'soldier-walk', still: `Game asset of a single alien insect soldier, ${CAMERA}, walking toward the lower left of the picture. ${INSECT}, caught mid-stride with all six feet visible. ${LIGHT} The insect is centred, fully in frame with clear margin on every side, and fills about half of the picture.`,
    motion: 'The insect walks on the spot as if on a treadmill: its six legs step in a steady alternating gait, the body bobs slightly, the antennae twitch. It never travels across the frame.' },
  { dir: 'S', slug: 'soldier-walk-s', heading: 'It now walks straight toward the viewer, toward the bottom edge of the picture: its head and mandibles point straight down the picture and we see it from the front and above, perfectly symmetrical left to right.' },
  { dir: 'W', slug: 'soldier-walk-w', heading: 'It now walks straight to the left edge of the picture: its head points left, its body lies horizontally across the picture, and we see its left side and its back from above.' },
  { dir: 'NW', slug: 'soldier-walk-nw', heading: 'It now walks away from the viewer toward the upper left corner of the picture: its head points to the upper left and we see its back and its rear end from above and behind.' },
  { dir: 'N', slug: 'soldier-walk-n', heading: 'It now walks straight away from the viewer, toward the top edge of the picture: its head points straight up the picture and we see its back and its rear end from above and behind, perfectly symmetrical left to right.' },
];
const MIRRORS = { SE: 'SW', E: 'W', NE: 'NW' };

ready();
const DIR = path.join(OUT_DIR, 'walker8');
fs.mkdirSync(DIR, { recursive: true });

const first = await makeStill({ slug: VIEWS[0].slug, prompt: VIEWS[0].still });
const made = await Promise.allSettled(VIEWS.map(async (v, i) => {
  const stillFile = i === 0 ? first : await makeStill({
    slug: v.slug, refFile: first,
    prompt: `${SAME} ${v.heading} ${LIGHT} The insect is centred, fully in frame with clear margin on every side.`,
  });
  const clipFile = await makeClip({ slug: v.slug, stillFile, prompt: i === 0 ? v.motion : WALK });
  return { ...v, stillFile, clipFile };
}));
const views = made.filter((m) => m.status === 'fulfilled').map((m) => m.value);
made.forEach((m, i) => { if (m.status === 'rejected') console.log(`FAIL ${VIEWS[i].dir}: ${m.reason.message}`); });

const meta = {};
for (const v of views) {
  const w = loopWindow(v.clipFile, FPS);
  const count = w.end - w.start;
  const rows = Math.ceil(count / COLS);
  const chain = `trim=start_frame=1,setpts=PTS-STARTPTS,fps=${FPS},trim=start_frame=${w.start}:end_frame=${w.end},setpts=PTS-STARTPTS,` +
    `scale=${FRAME}:${FRAME}:flags=lanczos,${keyChain()},format=rgba`;
  ffmpeg(['-i', v.clipFile, '-vf', `${chain},tile=${COLS}x${rows}`, '-frames:v', '1', path.join(DIR, `${v.dir}.png`)], `${v.dir} sheet`);
  ffmpeg(['-i', v.clipFile, '-vf', `${chain}`, '-frames:v', '1', path.join(RAW_DIR, `walker8-${v.dir}-frame.png`)], `${v.dir} frame`);
  fs.copyFileSync(v.stillFile, path.join(DIR, `${v.dir}-still.png`));
  meta[v.dir] = { sheet: `${v.dir}.png`, frames: count, cols: COLS, mirror: false, seam: Number(w.diff.toFixed(2)) };
  console.log(`[sheet] ${v.dir}: ${count} frames (loop cut ${w.start}-${w.end} of ${w.frames}, seam difference ${w.diff.toFixed(2)} of 255)`);
}
for (const [dir, from] of Object.entries(MIRRORS)) if (meta[from]) meta[dir] = { ...meta[from], mirror: true };

// The compass: all eight headings around a centre, on street brown, at sheet size and at game size.
const POS = { N: [1, 0], NE: [2, 0], E: [2, 1], SE: [2, 2], S: [1, 2], SW: [0, 2], W: [0, 1], NW: [0, 0] };
const have = Object.keys(POS).filter((d) => meta[d]);
if (have.length) {
  const inputs = ['-f', 'lavfi', '-i', `color=c=0x54432a:s=${FRAME * 3 + 260}x${FRAME * 3}`];
  const parts = [];
  let last = '0:v';
  have.forEach((d, i) => {
    const src = MIRRORS[d] || d;
    inputs.push('-i', path.join(RAW_DIR, `walker8-${src}-frame.png`));
    const flip = MIRRORS[d] ? 'hflip,' : '';
    parts.push(`[${i + 1}:v]${flip}split=3[a${i}][b${i}][c${i}];[b${i}]scale=48:48:flags=lanczos[m${i}];[c${i}]scale=24:24:flags=lanczos[s${i}]`);
    const [gx, gy] = POS[d];
    parts.push(`[${last}][a${i}]overlay=${gx * FRAME}:${gy * FRAME}:format=auto[x${i}]`);
    parts.push(`[x${i}][m${i}]overlay=${FRAME * 3 + 20 + gx * 56}:${20 + gy * 56}:format=auto[y${i}]`);
    parts.push(`[y${i}][s${i}]overlay=${FRAME * 3 + 60 + gx * 32}:${230 + gy * 32}:format=auto[z${i}]`);
    last = `z${i}`;
  });
  ffmpeg([...inputs, '-filter_complex', parts.join(';'), '-map', `[${last}]`, '-frames:v', '1', path.join(DIR, 'compass.png')], 'compass');
}

fs.copyFileSync(path.join(ROOT, 'tools', 'screenshots', '03-late.png'), path.join(DIR, 'board.png'));
fs.writeFileSync(path.join(DIR, 'demo.html'), `<!doctype html>
<meta charset="utf-8">
<title>Broodfall probe: one insect, eight directions, from video</title>
<style>body{margin:0;background:#0a0806;color:#d8c9a0;font:14px/1.4 sans-serif}canvas{display:block;margin:12px auto;image-rendering:auto}p{text-align:center;margin:8px}</style>
<p>One soldier walking a loop, turning through all eight headings. Five views are generated; NE, E and SE are mirror images. Three sizes: 96, 48 and 24 px.</p>
<canvas id="c" width="1040" height="600"></canvas>
<script>
const META = ${JSON.stringify(meta)};
const FRAME = ${FRAME}, FPS = ${FPS};
const ORDER = ['E','SE','S','SW','W','NW','N','NE'];
const ctx = document.getElementById('c').getContext('2d');
const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const sheets = {};
let board;
const ready = Promise.all([load('board.png').then((i) => { board = i; }),
  ...Object.entries(META).map(([d, m]) => load(m.sheet).then((i) => { sheets[d] = i; }))]);
// An octagon-ish loop of waypoints over the board crop.
const path = (cx, cy, r) => [[r,0],[r*0.7,r*0.7],[0,r],[-r*0.7,r*0.7],[-r,0],[-r*0.7,-r*0.7],[0,-r],[r*0.7,-r*0.7]].map(([x,y]) => [cx + x * 1.6, cy + y * 0.8]);
function along(pts, t) {
  const n = pts.length, seg = Math.floor(t * n) % n, f = t * n - Math.floor(t * n);
  const a = pts[seg], b = pts[(seg + 1) % n];
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, dx: b[0] - a[0], dy: b[1] - a[1] };
}
function draw(p, size, time) {
  const ang = Math.atan2(p.dy, p.dx);
  const dir = ORDER[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  const m = META[dir], img = sheets[dir];
  if (!m || !img) { ctx.fillStyle = '#d1603c'; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); return; }
  const f = Math.floor(time * FPS) % m.frames;
  const sx = (f % m.cols) * FRAME, sy = Math.floor(f / m.cols) * FRAME;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, size * 0.18, size * 0.3, size * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  if (m.mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, FRAME, FRAME, -size / 2, -size / 2, size, size);
  ctx.restore();
}
window.renderAt = (time) => {
  ctx.imageSmoothingEnabled = true;
  if (board) { ctx.imageSmoothingEnabled = false; ctx.drawImage(board, 560, 380, 520, 300, 0, 0, 1040, 600); ctx.imageSmoothingEnabled = true; }
  else { ctx.fillStyle = '#54432a'; ctx.fillRect(0, 0, 1040, 600); }
  draw(along(path(300, 300, 150), (time / 16) % 1), 96, time);
  draw(along(path(760, 220, 90), (time / 12) % 1), 48, time);
  draw(along(path(800, 460, 60), (time / 9) % 1), 24, time);
};
window.ready = ready;
ready.then(() => { const t0 = performance.now(); const tick = () => { if (!window.manual) window.renderAt((performance.now() - t0) / 1000); requestAnimationFrame(tick); }; tick(); });
</script>
`);
fs.writeFileSync(path.join(DIR, 'meta.json'), JSON.stringify(meta, null, 1));
console.log(`views made: ${views.map((v) => v.dir).join(', ') || 'none'}; written to ${DIR}`);
process.exit(views.length === VIEWS.length ? 0 : 1);
