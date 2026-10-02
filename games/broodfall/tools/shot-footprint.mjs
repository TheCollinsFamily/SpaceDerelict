/**
 * Footprints on the board (src/sim/footprint.ts). Two sheets, never to be confused:
 *
 *   ENGINE TEST (default): every shape the engine supports, each on ONE placeholder limb (a Spitter made that
 *   shape with ?tryShape=spitter:<shape>). It proves the engine (placing, the ghost, the outline, two camera
 *   turns); it is NOT the plan. -> footprint-<shape>-t<turn>.png, footprint-ENGINE-TEST-sheet.jpg
 *
 *   PLAN (--plan): every limb the footprint plan (tools/codex/plan.mjs) puts on more than one cell, or reshapes, on ITS OWN
 *   proposed shape (?tryShape=<limb>:<shape> where the plan reshapes it), labelled "reshaped" or "kept".
 *   -> footprint-plan-<limb>-t<turn>.png, footprint-PLAN-sheet.jpg
 *
 * In each, one limb is PLACED facing south and one is held as the placement GHOST beside it; the board is shot
 * close up from two camera turns. Checks: both found legal ground of the right size, no page errors. Runs its own
 * vite; nothing is spent.
 *
 * Usage: node tools/shot-footprint.mjs [--out <dir>] [--plan] [shape-or-limb ...]
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PLAN } from './codex/plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = Number(process.env.BROODFALL_PORT || 5337);
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const out = opt('--out', join(root, 'notes', 'screens', '2026-10-01'));
const PLAN_MODE = flag('--plan');
const CELLS = { '1x1': 1, '1x2': 2, line3: 3, '2x2': 4, T: 4, L3: 3, L4: 4, S4: 4 };
const SHAPE_NAME = { '1x1': '1 cell', '1x2': 'line of 2', line3: 'line of 3', '2x2': '2x2 square', T: 'T of 4', L3: 'elbow of 3', L4: 'L of 4', S4: 'zigzag of 4' };
// Each job: the limb, its shape, the ?tryShape it needs ('' = as the game is), a file id, a label.
const NOW = { spine: '1x2', impaler: '1x2', skipper: '1x2', lance: '1x2', maw: '2x2', tangler: '2x2', brood: '2x2', frond: '2x2', mister: '2x2', ward: '2x2', cage: '2x2' };
const jobs = PLAN_MODE
  ? Object.entries(PLAN).filter(([f, p]) => (p.to !== '1x1' || (NOW[f] ?? '1x1') !== p.to) && (!args.length || args.includes(f))).map(([family, p]) => {
    const reshaped = (NOW[family] ?? '1x1') !== p.to;
    return { family, shape: p.to, try: reshaped ? `${family}:${p.to}` : '', id: `plan-${family}`, label: `${family}  ${SHAPE_NAME[p.to]}  ${reshaped ? 'RESHAPED' : 'kept'}  (rule ${p.rule})` };
  })
  : (args.length ? args : ['1x1', '1x2', 'line3', '2x2', 'T', 'L3', 'L4', 'S4']).map((shape) => ({ family: 'spitter', shape, try: `spitter:${shape}`, id: shape, label: `${shape}  (placeholder Spitter)` }));
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
const done = [];
try {
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0&biome=suburb${job.try ? `&tryShape=${job.try}` : ''}`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 60000 });
    const res = await page.evaluate((fam) => {
      const b = window.broodfall;
      const s = b.sim;
      b.step(5);
      for (let i = 0; i < 700 && s.outcome === 'playing'; i += 50) b.step(50);
      s.meat.war = 9999; s.meat.science = 9999; s.meat.royal = 99;
      // The legal spot nearest the core: build one there.
      const core = s.cellCenter(s.map.coreCell);
      const near = (facing, skip) => {
        let best = -1, bd = Infinity;
        for (let c = 0; c < s.map.cells.length; c++) {
          const g = s.groundFor(c, fam, facing);
          if (!g || g.some((x) => skip.has(x))) continue;
          const p = s.cellCenter(c); const d = Math.hypot(p.x - core.x, p.y - core.y);
          if (d < bd) { bd = d; best = c; }
        }
        return best;
      };
      const placedAt = near('S', new Set());
      if (placedAt < 0) return { ok: false, why: 'no legal ground facing S' };
      s.hand[0] = { id: 990001, family: fam };
      const r = b.play({ kind: 'build', cardIndex: 0, cell: placedAt, facing: 'S' });
      if (!r.ok) return { ok: false, why: 'build refused: ' + r.err };
      const t = s.towers[s.towers.length - 1];
      const placed = s.cellsOf(t);
      // The ghost: the nearest other legal ground, a quarter turn round if it fits, not touching the placed one.
      const W = s.cfg.gridW;
      const halo = new Set(placed.flatMap((c) => [c, c - 1, c + 1, c - W, c + W, c - W - 1, c - W + 1, c + W - 1, c + W + 1]));
      let ghostFacing = 'E';
      let ghostAt = -1;
      for (const f of ['E', 'W', 'N', 'S']) { ghostAt = near(f, halo); if (ghostAt >= 0) { ghostFacing = f; break; } }
      const ghost = ghostAt >= 0 ? s.groundFor(ghostAt, fam, ghostFacing) : null;
      if (ghost) b.renderer.preview = { cell: ghostAt, cells: ghost, kind: 'tower', family: fam, valid: true, facing: ghostFacing, pips: [] };
      const all = [...placed, ...(ghost ?? [])];
      const mid = all.reduce((a, c) => { const p = s.cellCenter(c); return { x: a.x + p.x / all.length, y: a.y + p.y / all.length }; }, { x: 0, y: 0 });
      b.renderer.zoom = 2.6; b.renderer.pan = { x: 0, y: 0 }; b.renderer.camInit = false;
      b.step(1);
      window.__fpMid = mid;
      return { ok: true, placed: placed.length, ghost: ghost ? ghost.length : 0, facing: t.facing, ghostFacing };
    }, job.family);
    if (!res.ok) { console.log(`${job.id}: FAIL ${res.why}`); failed++; await page.close(); continue; }
    const want = CELLS[job.shape];
    // A wall in a one-cell street is one cell (Sim.wallAcross); the ghost may be one cell for the same reason.
    const good = job.family === 'spine' ? res.placed >= 1 : res.placed === want && (res.ghost === want || res.ghost === 0);
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
      await page.screenshot({ path: join(out, `footprint-${job.id}-t${turn}.png`) });
    }
    done.push(job);
    console.log(`${job.id}: placed ${res.placed} cells facing ${res.facing}, ghost ${res.ghost} cells facing ${res.ghostFacing} ${good ? 'ok' : 'WRONG SIZE'}${errors.length ? ' errors: ' + errors.join(' | ') : ''}`);
    if (errors.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
// One sheet: a title bar saying what the sheet IS, then a row a job, the two turns side by side.
if (done.length) {
  const ff = (a) => execSync(`ffmpeg -y -loglevel error ${a}`, { stdio: 'inherit' });
  const q = (s) => s.replace(/:/g, '\\:').replace(/'/g, '');
  const rows = [];
  const title = join(out, '.fp-title.png');
  const heading = PLAN_MODE
    ? 'FOOTPRINT PLAN: every multi-cell or reshaped limb on ITS OWN proposed shape (not applied)'
    : 'ENGINE TEST ONLY: every shape on ONE placeholder limb (a Spitter). This is NOT the plan.';
  ff(`-f lavfi -i color=c=0x14100c:s=1280x70 -frames:v 1 -vf "drawtext=text='${q(heading)}':x=16:y=22:fontsize=26:fontcolor=0xffe08a" "${title}"`);
  for (const job of done) {
    const pair = TURNS.map((t) => join(out, `footprint-${job.id}-t${t}.png`));
    const row = join(out, `.fp-row-${job.id}.png`);
    ff(`-i "${pair[0]}" -i "${pair[1]}" -filter_complex "[0:v]scale=640:-2[a];[1:v]scale=640:-2[b];[a][b]hstack=inputs=2,drawtext=text='${q(job.label)}':x=10:y=10:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.7" "${row}"`);
    rows.push(row);
  }
  ff(`-i "${title}" ${rows.map((r) => `-i "${r}"`).join(' ')} -filter_complex "vstack=inputs=${rows.length + 1}" -q:v 3 "${join(out, PLAN_MODE ? 'footprint-PLAN-sheet.jpg' : 'footprint-ENGINE-TEST-sheet.jpg')}"`);
  for (const r of [title, ...rows]) execSync(`rm -f "${r}"`, { shell: 'bash' });
}
console.log(failed ? `${failed} problem(s)` : 'all footprints placed');
process.exit(failed ? 1 : 0);
