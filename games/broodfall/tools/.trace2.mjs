import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { spawnSync } from 'node:child_process';
const dir = path.join(os.tmpdir(), 'broodfall-anim-frames', process.argv[2] || 'limbs');
const lines = fs.readFileSync(path.join(dir, 'list.ffconcat'), 'utf8').split('\n');
const fr = []; for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^file '(.*)'$/); if (m) { const d = lines[i + 1]?.match(/^duration ([\d.]+)/); fr.push({ file: m[1], dt: d ? Number(d[1]) : 0 }); } }
const T = { quill: [512, 271], lobber: [651, 354], maw: [860, 271], frond: [1139, 354], prism: [512, 437], mosaic: [442, 561], impaler: [1244, 499], ocular: [1069, 537], choir: [581, 644], spitter: [860, 644], ember: [720, 727], bombard: [1000, 727] };
const W = 800, H = 450;
const read = (f) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', f, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 }).stdout;
let prev = read(fr[0].file); const d = Object.fromEntries(Object.keys(T).map((k) => [k, []])); const dts = [];
for (let i = 1; i < fr.length; i++) {
  const f = read(fr[i].file); dts.push(fr[i - 1].dt);
  for (const [k, [x, y]] of Object.entries(T)) { let s = 0, n = 0; for (let yy = Math.round((y - 150) / 2); yy < Math.round((y - 20) / 2); yy++) for (let xx = Math.round((x - 60) / 2); xx < Math.round((x + 60) / 2); xx++) { s += Math.abs(f[yy * W + xx] - prev[yy * W + xx]); n++; } d[k].push(s / n); }
  prev = f;
}
if (process.argv[3]) { const k = process.argv[3]; console.log(d[k].slice(100, 190).map((v, i) => v.toFixed(1) + "@" + Math.round(dts[100 + i] * 1000)).join(" ")); }
const sdt = [...dts].sort((a, b) => a - b); console.log(`captured frames ${fr.length}, dt median ${(sdt[sdt.length >> 1] * 1000).toFixed(0)} ms, p95 ${(sdt[Math.floor(sdt.length * 0.95)] * 1000).toFixed(0)} ms`);
for (const [k, a] of Object.entries(d)) {
  // change per second, per captured step; a snap = a step whose change is > 4x the median of this limb's steps and not explained by a long gap
  const rate = a.map((v, i) => v / Math.max(0.01, dts[i]));
  const med = [...rate].sort((x, y) => x - y)[rate.length >> 1];
  const snaps = rate.filter((r, i) => r > 4 * med && dts[i] < 0.05 && a[i] > 1).length;
  console.log(`${k.padEnd(8)} median change/s ${med.toFixed(1)}  max ${Math.max(...rate).toFixed(1)}  snaps (step > 4x median, >1 grey level) ${snaps}`);
}
