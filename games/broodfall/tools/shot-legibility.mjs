/**
 * Streets and roofs under heavy creep, at far, fit and near zoom, on every tile set and from all
 * four camera turns (Collins, Oct 1 2026: "there should be some clear visual distinction between
 * lanes and roofs covered in creep even at far zoom").
 *
 * The creep is forced over the whole board (every cell the core's creep can reach), the camera is
 * set to a zoom, and the canvas is shot. The pixel check: the luminance of creeped STREET cells
 * (open on every side, so no block stands in front of them) against creeped ROOF tops, at far
 * zoom. The two must differ by at least MIN_GAP in every set and every turn.
 *
 * Usage: node tools/shot-legibility.mjs [--out <dir>] [--tag before|after] [--turns 0,1,2,3] [set ...]
 *   (runs its own vite dev server; nothing is spent)
 * Artifacts: <out>/legibility-<tag>-<set>-t<turn>-<zoom>.png and legibility-<tag>.json
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = Number(process.env.BROODFALL_PORT || 5331);
/** Mean luminance gap (0-255) streets must keep from roofs at far zoom. */
const MIN_GAP = Number(process.env.LEGIBILITY_MIN_GAP || 60);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const out = opt('--out', join(root, 'tools', 'screenshots'));
const tag = opt('--tag', 'now');
const turns = opt('--turns', '0,1,2,3').split(',').map(Number);
const PLAY_TICKS = Number(opt('--play', '0'));
/** --nowash: the board as it was before the street wash (src/render/laneWash.ts), for a before/after on the same build. */
const NOWASH = args.includes('--nowash'); if (NOWASH) args.splice(args.indexOf('--nowash'), 1);
const zoomsArg = opt('--zooms', 'far,fit,near');
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8'));
const sets = Object.keys(manifest.biomes ?? {}).filter((id) => !args.length || args.includes(id));
const ZOOMS = { far: 0.6, fit: 1, near: 3 };
const zooms = zoomsArg.split(',');

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
freePort();
// Vite's own entry, not npx: works without node_modules/.bin.
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});

const lum = (png, x, y) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 1 || y < 1 || x >= png.width - 1 || y >= png.height - 1) return null;
  let s = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = ((y + dy) * png.width + (x + dx)) * 4;
    s += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  }
  return s / 9;
};
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const report = [];
let failed = 0;
try {
  for (const id of sets) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0&biome=${id}&play=${PLAY_TICKS}`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 60000 });
    await page.evaluate((nowash) => {
      const b = window.broodfall;
      b.step(5);
      // A mid game: the scripted player plays on (more districts claimed, nodes, strains).
      const PLAY = Number(new URLSearchParams(location.search).get('play') || 0);
      for (let i = 0; i < PLAY && b.sim.outcome === 'playing'; i += 50) { b.surface(); b.step(50); }
      // Heavy creep: everything the core's creep can reach is held.
      Object.defineProperty(b.sim, 'creepRangeCells', { get: () => 999, configurable: true });
      if (nowash && b.renderer.washes) {
        b.renderer.updateWash = () => {};
        b.renderer.washA = 0;
        for (const list of b.renderer.washes.values()) for (const w of list) w.visible = false;
      }
      b.step(1);
    }, NOWASH);
    await page.waitForTimeout(1500);
    for (const turn of turns) {
      await page.evaluate((q) => { const b = window.broodfall; b.turnBy((q - b.turn() + 4) % 4); b.step(1); }, turn);
      for (const zn of zooms) {
        await page.evaluate((z) => {
          const r = window.broodfall.renderer;
          r.zoom = z; r.pan = { x: 0, y: 0 }; r.camInit = false;
          window.broodfall.step(1);
        }, ZOOMS[zn]);
        await page.waitForTimeout(400);
        // What each pixel of a grid over the canvas shows, by following the view ray down (iso.ts pick):
        // a TRENCH pixel is the floor of a creeped street or a wall looking down onto one; a ROOF pixel
        // is the top of a creeped block. Cells holding a limb, and the cells behind them, are left out
        // (a limb is drawn over them).
        const pts = await page.evaluate(() => {
          const b = window.broodfall; const s = b.sim; const r = b.renderer; r.camInit = false; b.step(0);
          const W = s.cfg.gridW; const H = s.cfg.gridH; const g = r.geo; const cellPx = s.cfg.cellPx;
          const box = document.querySelector('#stage canvas').getBoundingClientRect();
          const vw = r.app.renderer.width; const vh = r.app.renderer.height;
          const fromView = (vx, vy) => {
            switch (g.turn) {
              case 1: return { x: vy, y: g.h - vx };
              case 2: return { x: g.w - vx, y: g.h - vy };
              case 3: return { x: g.w - vy, y: vx };
              default: return { x: vx, y: vy };
            }
          };
          const unproject = (sx, sy, up) => {
            const sum = (sy + up * g.level) / g.b; const dif = sx / g.a;
            const c = fromView((sum + dif) / 2, (sum - dif) / 2);
            return { x: c.x * g.cell, y: c.y * g.cell };
          };
          const cellOf = (p) => { const x = Math.floor(p.x / cellPx), y = Math.floor(p.y / cellPx); return x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x; };
          const hOf = (c) => (c < 0 ? 0 : s.map.cells[c] === 0 ? (s.map.heights[c] || 1) : 0);
          const masked = new Set();
          for (const t of s.towers) for (const c of s.cellsOf(t)) { const x = c % W, y = Math.floor(c / W); for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 1; dx++) masked.add((y + dy) * W + (x + dx)); }
          // The landing site's square is under the core's own picture: not a street anyone reads.
          const core = s.map.coreCell; const kx = core % W, ky = Math.floor(core / W);
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) masked.add((ky + dy) * W + (kx + dx));
          const ok = (c) => c >= 0 && s.map.cells[c] !== 3 && s.isCreeped(c) && !masked.has(c) && !(s.map.plinths[c] > 0);
          const street = []; const roof = []; const wall = [];
          const STEP = 4;
          for (let cy = 0; cy < box.height; cy += STEP) for (let cx = 0; cx < box.width; cx += STEP) {
            const sx = (cx * vw / box.width - r.camX) / r.camScale; const sy = (cy * vh / box.height - r.camY) / r.camScale;
            let hit = null;
            for (let up = 4; up > 0; up -= 0.125) {
              const p = unproject(sx, sy, up); const h = hOf(cellOf(p));
              if (h >= up) { hit = { c: cellOf(p), top: h - up < 0.125, up }; break; }
            }
            if (!hit) { const c = cellOf(unproject(sx, sy, 0)); if (ok(c) && s.map.cells[c] !== 0) street.push([cx, cy]); continue; }
            if (hit.top) { if (ok(hit.c)) roof.push([cx, cy]); continue; }
            // A wall: the ray falls toward the back as it comes down, so the cell it crossed just before it
            // met the wall is the one in front of the wall: the street the wall looks down onto.
            const foot = cellOf(unproject(sx, sy, hit.up + 0.125));
            if (ok(hit.c) && ok(foot) && hOf(foot) === 0) wall.push([cx, cy]);
          }
          return { street, roof, wall };
        });
        const file = join(out, `legibility-${tag}-${id}-t${turn}-${zn}.png`);
        const buf = await page.locator('#stage canvas').screenshot({ path: file });
        if (zn !== 'far') continue;
        const png = PNG.sync.read(buf);
        if (process.env.LEGIBILITY_DEBUG) {
          const dbg = PNG.sync.read(buf);
          const dot = (x, y, r, g, bl) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = Math.round(x) + dx, Y = Math.round(y) + dy; if (X < 0 || Y < 0 || X >= dbg.width || Y >= dbg.height) continue; const i = (Y * dbg.width + X) * 4; dbg.data[i] = r; dbg.data[i + 1] = g; dbg.data[i + 2] = bl; } };
          for (const [x, y] of pts.street) dot(x, y, 0, 255, 0);
          for (const [x, y] of pts.roof) dot(x, y, 0, 128, 255);
          writeFileSync(file.replace('.png', '-dbg.png'), PNG.sync.write(dbg));
        }
        const L = (list) => list.map(([x, y]) => lum(png, x, y)).filter((v) => v != null);
        const sl = L(pts.street); const rl = L(pts.roof); const wl = L(pts.wall);
        // The walls over the streets are what a far camera sees of a one-cell street: they carry the check.
        const gap = Math.abs(median(wl) - median(rl));
        const floorGap = Math.abs(median(sl) - median(rl));
        const ok = wl.length >= 20 && rl.length >= 20 && gap >= MIN_GAP;
        if (!ok) failed++;
        report.push({ set: id, turn, wall: Math.round(median(wl)), floor: Math.round(median(sl)), roof: Math.round(median(rl)), gap: Math.round(gap), floorGap: Math.round(floorGap), n: [wl.length, sl.length, rl.length] });
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id} turn ${turn}: street walls ${median(wl).toFixed(0)}, floors ${median(sl).toFixed(0)}, roofs ${median(rl).toFixed(0)}: gap ${gap.toFixed(0)} (floors ${floorGap.toFixed(0)}; n ${wl.length}/${sl.length}/${rl.length})`);
      }
    }
    if (errors.length) { console.log(`  FAIL  ${id}: page errors: ${errors.slice(0, 3).join(' | ')}`); failed++; }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
writeFileSync(join(out, `legibility-${tag}.json`), JSON.stringify(report, null, 2));
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
