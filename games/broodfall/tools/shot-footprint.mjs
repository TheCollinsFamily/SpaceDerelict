/**
 * Every footprint on the board (src/sim/footprint.ts; Collins, Oct 1 2026: "one square ... two squares
 * (line), four squares (large square), T-shaped, L-shaped"): for each shape a spitter is made that shape
 * (?tryShape=spitter:<shape>), one is PLACED facing south and one is held as the placement GHOST facing east
 * beside it, and the board is shot close up from two camera turns. Checks: both found legal ground of the
 * right size, the placed one stands on all of its cells, no page errors. Runs its own vite; nothing is spent.
 *
 * Usage: node tools/shot-footprint.mjs [--out <dir>] [shape ...]
 * Artifacts: <out>/footprint-<shape>-t<turn>.png and <out>/footprint-sheet.jpg (all of them, one row a shape)
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = Number(process.env.BROODFALL_PORT || 5337);
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const out = opt('--out', join(root, 'notes', 'screens', '2026-10-01'));
const ALL = ['1x1', '1x2', 'line3', '2x2', 'T', 'L3', 'L4', 'S4'];
const shapes = args.length ? args : ALL;
const TURNS = [0, 1];
mkdirSync(out, { recursive: true });

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
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
let failed = 0;
const shots = [];
try {
  for (const shape of shapes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0&biome=suburb&tryShape=spitter:${shape}`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 60000 });
    const res = await page.evaluate(() => {
      const b = window.broodfall;
      const s = b.sim;
      b.step(5);
      for (let i = 0; i < 700 && s.outcome === 'playing'; i += 50) b.step(50);
      s.meat.war = 9999; s.meat.science = 9999; s.meat.royal = 99;
      // The legal spot nearest the core, facing south: build one there.
      const core = s.cellCenter(s.map.coreCell);
      const near = (facing, skip) => {
        let best = -1, bd = Infinity;
        for (let c = 0; c < s.map.cells.length; c++) {
          const g = s.groundFor(c, 'spitter', facing);
          if (!g || g.some((x) => skip.has(x))) continue;
          const p = s.cellCenter(c); const d = Math.hypot(p.x - core.x, p.y - core.y);
          if (d < bd) { bd = d; best = c; }
        }
        return best;
      };
      const placedAt = near('S', new Set());
      if (placedAt < 0) return { ok: false, why: 'no legal ground facing S' };
      s.hand[0] = { id: 990001, family: 'spitter' };
      const r = b.play({ kind: 'build', cardIndex: 0, cell: placedAt, facing: 'S' });
      if (!r.ok) return { ok: false, why: 'build refused: ' + r.err };
      const t = s.towers[s.towers.length - 1];
      const placed = s.cellsOf(t);
      // The ghost: the nearest other legal ground, facing east, not touching the placed one.
      const W = s.cfg.gridW;
      const halo = new Set(placed.flatMap((c) => [c, c - 1, c + 1, c - W, c + W, c - W - 1, c - W + 1, c + W - 1, c + W + 1]));
      let ghostFacing = 'E';
      let ghostAt = -1;
      for (const f of ['E', 'W', 'N', 'S']) { ghostAt = near(f, halo); if (ghostAt >= 0) { ghostFacing = f; break; } }
      const ghost = ghostAt >= 0 ? s.groundFor(ghostAt, 'spitter', ghostFacing) : null;
      if (ghost) {
        b.renderer.preview = { cell: ghostAt, cells: ghost, kind: 'tower', family: 'spitter', valid: true, facing: ghostFacing, pips: [] };
      }
      // Frame the two of them, close.
      const all = [...placed, ...(ghost ?? [])];
      const mid = all.reduce((a, c) => { const p = s.cellCenter(c); return { x: a.x + p.x / all.length, y: a.y + p.y / all.length }; }, { x: 0, y: 0 });
      b.renderer.zoom = 2.6; b.renderer.pan = { x: 0, y: 0 }; b.renderer.camInit = false;
      b.step(1);
      const p = b.worldToScreen(mid.x, mid.y);
      b.renderer.panBy(p.vw / 2 - p.x, p.vh / 2 - p.y); b.renderer.camInit = false;
      b.step(1);
      window.__fpMid = mid;
      return { ok: true, placed: placed.length, ghost: ghost ? ghost.length : 0, facing: t.facing, ghostFacing };
    });
    if (!res.ok) { console.log(`${shape}: FAIL ${res.why}`); failed++; await page.close(); continue; }
    const want = { '1x1': 1, '1x2': 2, line3: 3, '2x2': 4, T: 4, L3: 3, L4: 4, S4: 4 }[shape];
    const good = res.placed === want && res.ghost === want;
    if (!good) failed++;
    for (const turn of TURNS) {
      await page.evaluate((q) => {
        const b = window.broodfall;
        b.turnBy((q - b.turn() + 4) % 4);
        b.renderer.pan = { x: 0, y: 0 }; b.renderer.camInit = false; b.step(1);
        const m = window.__fpMid; const p = b.worldToScreen(m.x, m.y);
        b.renderer.panBy(p.vw / 2 - p.x, p.vh / 2 - p.y); b.renderer.camInit = false;
        b.step(1);
      }, turn);
      await page.waitForTimeout(700);
      const file = join(out, `footprint-${shape}-t${turn}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
    }
    console.log(`${shape}: placed ${res.placed} cells facing ${res.facing}, ghost ${res.ghost} cells facing ${res.ghostFacing} ${good ? 'ok' : 'WRONG SIZE'}${errors.length ? ' errors: ' + errors.join(' | ') : ''}`);
    if (errors.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
// One sheet: a row a shape, the two turns side by side.
if (shots.length) {
  const ff = (a) => execSync(`ffmpeg -y -loglevel error ${a}`, { stdio: 'inherit' });
  const rows = [];
  for (const shape of shapes) {
    const pair = TURNS.map((t) => join(out, `footprint-${shape}-t${t}.png`)).filter((f) => shots.includes(f));
    if (pair.length !== TURNS.length) continue;
    const row = join(out, `.fp-row-${shape}.png`);
    ff(`-i "${pair[0]}" -i "${pair[1]}" -filter_complex "[0:v]scale=640:-2[a];[1:v]scale=640:-2[b];[a][b]hstack=inputs=2,drawtext=text='${shape}':x=10:y=10:fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.6" "${row}"`);
    rows.push(row);
  }
  if (rows.length) ff(`${rows.map((r) => `-i "${r}"`).join(' ')} -filter_complex "vstack=inputs=${rows.length}" -q:v 3 "${join(out, 'footprint-sheet.jpg')}"`);
  for (const r of rows) execSync(`rm -f "${r}"`, { shell: 'bash' });
}
console.log(failed ? `${failed} problem(s)` : 'all footprints placed');
process.exit(failed ? 1 : 0);
