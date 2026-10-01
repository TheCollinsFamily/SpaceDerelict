/**
 * Bare streets, creeped streets and creeped roofs told apart at far, fit and near zoom, on every tile
 * set and from all four camera turns (Collins, Oct 1 2026: lanes "need to have creep, just be
 * visually distinct (like make it a different color, yellow or something) ... because sometimes creep
 * has effects on things walking over it"). src/render/streetCreep.ts draws it.
 *
 * The creep is forced out to --creep street-hops from the core (default 7), so part of the board is
 * creeped and part is bare. Each pixel of a grid over the canvas is classed by following the view ray
 * down (as src/render/iso.ts pick does):
 *   BARE   the floor of a street or square the creep does not hold (the tile set's ground);
 *   STREET the floor of a creeped street or square;
 *   WALL   a wall looking down onto a creeped street (what a far camera sees of a one-cell street);
 *   ROOF   the top of a creeped block.
 * Cells with a limb on them or just behind one, the core's square, plinths and the unclaimed city are
 * left out. Each class's colour is the per-channel median, compared in Lab (CIE76 dE). The check:
 * BARE/STREET, STREET/ROOF and BARE/ROOF at every zoom, WALL/ROOF and WALL/BARE at far and fit; every
 * pair at least MIN_DE apart.
 *
 * Usage: node tools/shot-legibility.mjs [--out <dir>] [--tag <name>] [--turns 0,1,2,3]
 *        [--zooms far,fit,near] [--play <ticks>] [--creep <hops>] [--old] [--debug] [set ...]
 *   --old: the board as it was before (streets under a thin red film), on the same build.
 *   --debug: also writes <shot>-dbg.png with the classes painted (bare white, street green, wall
 *   magenta, roof blue). Runs its own vite dev server; nothing is spent.
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
/** The least colour difference (CIE76 dE) between any two of the classes. */
const MIN_DE = Number(process.env.LEGIBILITY_MIN_DE || 25);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const out = opt('--out', join(root, 'tools', 'screenshots'));
const tag = opt('--tag', 'now');
const turns = opt('--turns', '0,1,2,3').split(',').map(Number);
const zooms = opt('--zooms', 'far,fit,near').split(',');
const PLAY_TICKS = Number(opt('--play', '0'));
const CREEP = Number(opt('--creep', '7'));
const OLD = flag('--old');
const DEBUG = flag('--debug');
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8'));
const sets = Object.keys(manifest.biomes ?? {}).filter((id) => !args.length || args.includes(id));
const ZOOMS = { far: 0.6, fit: 1, near: 3 };

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

/** sRGB 0-255 to CIE Lab (D65). */
function lab([r, g, b]) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
function colourOf(png, list) {
  const ch = [[], [], []];
  for (const [x0, y0] of list) {
    const x = Math.round(x0), y = Math.round(y0);
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
    const i = (y * png.width + x) * 4;
    for (let k = 0; k < 3; k++) ch[k].push(png.data[i + k]);
  }
  return { n: ch[0].length, rgb: ch.map((c) => Math.round(median(c))) };
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const report = [];
let failed = 0;
try {
  for (const id of sets) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0&biome=${id}`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 60000 });
    await page.evaluate(([play, creep, old]) => {
      const b = window.broodfall;
      b.step(5);
      // A mid game: the scripted player plays on (more districts claimed, nodes, strains).
      for (let i = 0; i < play && b.sim.outcome === 'playing'; i += 50) { b.surface(); b.step(50); }
      Object.defineProperty(b.sim, 'creepRangeCells', { get: () => creep, configurable: true });
      if (old) b.renderer.streetCreep = false;
      b.renderer.creepState.fill(65535); // every cell's skin drawn again
      b.step(1);
    }, [PLAY_TICKS, CREEP, OLD]);
    await page.waitForTimeout(1500);
    for (const turn of turns) {
      await page.evaluate((q) => { const b = window.broodfall; b.turnBy((q - b.turn() + 4) % 4); b.step(1); }, turn);
      for (const zn of zooms) {
        await page.evaluate((z) => {
          const r = window.broodfall.renderer;
          r.zoom = z; r.pan = { x: 0, y: 0 }; r.camInit = false;
          window.broodfall.step(1);
          // Close up, the creep's frontier is in the middle: a creeped street beside a bare one, roofs round them.
          if (z > 1) {
            const b = window.broodfall; const s = b.sim; const W = s.cfg.gridW;
            const core = s.cellCenter(s.map.coreCell);
            let best = -1, bestD = Infinity;
            for (let c = 0; c < s.map.cells.length; c++) {
              if (s.map.cells[c] === 0 || s.map.cells[c] === 3 || !s.isCreeped(c)) continue;
              const x = c % W, y = Math.floor(c / W);
              const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const o = (y + dy) * W + x + dx; return s.map.cells[o] === 1 || s.map.cells[o] === 2 ? !s.isCreeped(o) : false; });
              if (!edge) continue;
              const p = s.cellCenter(c); const d = Math.hypot(p.x - core.x, p.y - core.y);
              if (d < bestD) { bestD = d; best = c; }
            }
            const at = s.cellCenter(best >= 0 ? best : s.map.coreCell);
            const p = b.worldToScreen(at.x, at.y);
            r.panBy(p.vw / 2 - p.x, p.vh / 2 - p.y); r.camInit = false;
            b.step(1);
          }
        }, ZOOMS[zn]);
        await page.waitForTimeout(400);
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
          // What stands over the ground is left out where it is DRAWN: every limb's picture, the core's.
          const masked = new Set();
          for (const t of s.towers) for (const c of s.cellsOf(t)) masked.add(c);
          // The landing site's square: its crater and the core's red roots are drawn over it (not a street).
          if (r.square) for (let c = 0; c < s.map.cells.length; c++) { const p = s.cellCenter(c); if (Math.abs(p.x - r.square.x) <= r.square.across * cellPx / 2 + cellPx && Math.abs(p.y - r.square.y) <= r.square.across * cellPx / 2 + cellPx) masked.add(c); }
          const kx = box.width / vw, ky = box.height / vh;
          const boxes = [...r.limbs.values()].map((v) => v.sprite).concat(r.core ? [r.core] : [])
            .filter((sp) => sp && !sp.destroyed && sp.visible).map((sp) => { const bb = sp.getBounds(); return [bb.x * kx, bb.y * ky, (bb.x + bb.width) * kx, (bb.y + bb.height) * ky]; });
          const covered = (x, y) => boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
          const usable = (c) => c >= 0 && s.map.cells[c] !== 3 && !masked.has(c) && !(s.map.plinths[c] > 0);
          const creeped = (c) => usable(c) && s.isCreeped(c);
          const out = { bare: [], street: [], wall: [], roof: [] };
          const STEP = 3;
          for (let cy = 0; cy < box.height; cy += STEP) for (let cx = 0; cx < box.width; cx += STEP) {
            if (covered(cx, cy)) continue;
            const sx = (cx * vw / box.width - r.camX) / r.camScale; const sy = (cy * vh / box.height - r.camY) / r.camScale;
            let hit = null;
            for (let up = 4; up > 0; up -= 0.125) {
              const p = unproject(sx, sy, up); const h = hOf(cellOf(p));
              if (h >= up) { hit = { c: cellOf(p), top: h - up < 0.125, up }; break; }
            }
            if (!hit) {
              const c = cellOf(unproject(sx, sy, 0));
              if (!usable(c) || s.map.cells[c] === 0) continue;
              // Not right at the creep's ragged edge: a cell whose four sides are the same state.
              const st = s.isCreeped(c); const x = c % W, y = Math.floor(c / W);
              if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const o = (y + dy) * W + x + dx; return s.map.cells[o] !== 0 && s.isCreeped(o) !== st; })) continue;
              (st ? out.street : out.bare).push([cx, cy]);
              continue;
            }
            if (hit.top) { if (creeped(hit.c)) out.roof.push([cx, cy]); continue; }
            // A wall: the ray falls toward the back as it comes down, so the cell it crossed just before
            // it met the wall is the one in front of the wall: the street the wall looks down onto.
            const foot = cellOf(unproject(sx, sy, hit.up + 0.125));
            if (creeped(hit.c) && creeped(foot) && hOf(foot) === 0) out.wall.push([cx, cy]);
          }
          return out;
        });
        const file = join(out, `legibility-${tag}-${id}-t${turn}-${zn}.png`);
        const buf = await page.locator('#stage canvas').screenshot({ path: file });
        const png = PNG.sync.read(buf);
        if (DEBUG) {
          const dbg = PNG.sync.read(buf);
          const paint = (list, col) => { for (const [x, y] of list) { const i = (Math.round(y) * dbg.width + Math.round(x)) * 4; if (i >= 0 && i < dbg.data.length) { dbg.data[i] = col[0]; dbg.data[i + 1] = col[1]; dbg.data[i + 2] = col[2]; } } };
          paint(pts.bare, [255, 255, 255]); paint(pts.street, [0, 255, 0]); paint(pts.wall, [255, 0, 255]); paint(pts.roof, [0, 128, 255]);
          writeFileSync(file.replace('.png', '-dbg.png'), PNG.sync.write(dbg));
        }
        const c = Object.fromEntries(Object.entries(pts).map(([k, v]) => [k, colourOf(png, v)]));
        const pairs = [['bare', 'street'], ['street', 'roof'], ['bare', 'roof']];
        if (zn !== 'near') pairs.push(['wall', 'roof'], ['wall', 'bare']);
        const res = [];
        let ok = true;
        for (const [a, b] of pairs) {
          if (c[a].n < 15 || c[b].n < 15) { res.push(`${a}/${b} n/a (${c[a].n}/${c[b].n})`); continue; }
          const d = dE(c[a].rgb, c[b].rgb);
          if (d < MIN_DE) ok = false;
          res.push(`${a}/${b} ${d.toFixed(0)}`);
        }
        if (!ok) failed++;
        report.push({ set: id, turn, zoom: zn, colours: c, pairs: res });
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id} turn ${turn} ${zn}: ${res.join(', ')}  [bare ${c.bare.rgb} street ${c.street.rgb} wall ${c.wall.rgb} roof ${c.roof.rgb}]`);
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
