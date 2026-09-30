import { spawn } from 'node:child_process';
const [file, ...rest] = process.argv.slice(2);
// label x y (tag position in 1600x900)
const T = { quill: [512, 271], lobber: [651, 354], maw: [860, 271], frond: [1139, 354], prism: [512, 437], mosaic: [442, 561], impaler: [1244, 499], ocular: [1069, 537], choir: [581, 644], spitter: [860, 644], ember: [720, 727], bombard: [1000, 727] };
const W = 800, H = 450;
const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
let buf = Buffer.alloc(0); let prev = null; const d = Object.fromEntries(Object.keys(T).map((k) => [k, []]));
p.stdout.on('data', (c) => {
  buf = Buffer.concat([buf, c]);
  while (buf.length >= W * H) {
    const f = buf.subarray(0, W * H); buf = buf.subarray(W * H);
    if (prev) for (const [k, [x, y]] of Object.entries(T)) {
      let s = 0, n = 0;
      for (let yy = Math.round((y - 150) / 2); yy < Math.round((y - 20) / 2); yy++) for (let xx = Math.round((x - 60) / 2); xx < Math.round((x + 60) / 2); xx++) { s += Math.abs(f[yy * W + xx] - prev[yy * W + xx]); n++; }
      d[k].push(s / n);
    }
    prev = Buffer.from(f);
  }
});
p.on('close', () => {
  const ks = Object.keys(d); const n = d[ks[0]].length; let solo = {}; let shared = 0;
  for (let i = 0; i < n; i++) { const sp = ks.filter((k) => { const a = d[k]; const m = a.reduce((x, y) => x + y, 0) / a.length; return a[i] > 4 * m && a[i] > 1; }); if (sp.length >= 4) shared++; else for (const k of sp) solo[k] = (solo[k] || 0) + 1; }
  console.log('frames where 4+ limbs jump at once (capture gaps):', shared, ' lone jumps per limb:', JSON.stringify(solo));
  for (const [k, a] of Object.entries(d)) {
    const mean = a.reduce((x, y) => x + y, 0) / a.length; const sorted = [...a].sort((x, y) => x - y);
    const p99 = sorted[Math.floor(a.length * 0.99)]; const still = a.filter((v) => v < 0.05).length / a.length;
    console.log(`${k.padEnd(8)} mean ${mean.toFixed(2)}  p99 ${p99.toFixed(2)}  peak ${Math.max(...a).toFixed(2)}  peak/mean ${(Math.max(...a) / mean).toFixed(1)}  frames with no change ${(still * 100).toFixed(0)}%`);
  }
});
