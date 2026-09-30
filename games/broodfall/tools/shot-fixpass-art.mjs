/**
 * THE ART FIX PASS, items 5 to 8 (Sep 30 2026, Collins: "fix up everything that needs fixing up"), photographed
 * in the real page, BEFORE (the art as committed before the pass, `--art <dir>`: a copy of public/art) and AFTER.
 *
 *   pod     a Seedling pod in flight, four moments of its flight close up: one picture stretched in and out
 *           (before), its four drawn frames beating (after)
 *   backs   the tile sets whose lopsided props lost their mirror, every quarter turn, whole board, the spots
 *           that changed found by comparing before with after (compose)
 *   flinch  the units whose flinch had a stub of a pole, struck in the street, a tick at a time
 *   core3   the core at stage 3 (and 4), eight moments of its idle 1/6 s apart, close
 *
 * Usage:
 *   node tools/shot-fixpass-art.mjs --tag before --art <copy of public/art> [parts]
 *   node tools/shot-fixpass-art.mjs --tag after [parts]
 *   node tools/shot-fixpass-art.mjs --compose            the before/after sheets: notes/screens/2026-09-30/fixpass-art-*.jpg
 * Builds its own copy of the game (dist-fixpass-<tag>/) and serves it on its own port (5387).
 * Fails when a picture is missing (artMissing()) or a "did not load" line shows.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots', 'fixpass-art');
const screens = join(root, 'notes', 'screens', '2026-09-30');
fs.mkdirSync(shots, { recursive: true });
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const TAG = opt('tag') ?? 'after';
const ARTDIR = opt('art');
const PORT = Number(process.env.BROODFALL_PORT || 5387);
const parts = args.filter((a, i) => !a.startsWith('--') && !['--tag', '--art'].includes(args[i - 1]));
const want = (p) => !parts.length || parts.includes(p);
let failed = 0;
const check = (ok, name, extra = '') => { if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` (${extra})` : ''}`); };

/** Units whose flinch had the pole's stub (the bake's log: tools/art/templates/unit.mjs), and the views. */
export const POLE_UNITS = JSON.parse(process.env.POLE_UNITS || '[]');
/** Tile sets whose props got drawn backs in the pass (tools/art/biomes.mjs `round: false`). */
const BACK_SETS = ['orthodox', 'megacity', 'orient', 'industrial', 'wetland'];

if (args.includes('--compose')) { await compose(); process.exit(failed ? 1 : 0); }

const { chromium } = await import('@playwright/test');
const DIST = `dist-fixpass-${TAG}`;
const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
if (ARTDIR) {
  fs.rmSync(join(root, DIST, 'art'), { recursive: true, force: true });
  fs.cpSync(ARTDIR, join(root, DIST, 'art'), { recursive: true });
  console.log(`  art: ${ARTDIR}`);
}
function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function serve() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  const canvas = page.locator('#stage canvas');
  const png = (name) => join(shots, `${name}-${TAG}.png`);
  const open = async (q) => {
    await page.goto(`http://localhost:${PORT}/?autostart=1&speed=0&${q}`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.broodfall.step(200));
    await page.waitForTimeout(500);
    const missing = await page.evaluate(() => window.broodfall.artMissing());
    const banner = await page.evaluate(() => /did not load/i.test(document.body.innerText));
    check(missing.length === 0 && !banner, `${q}: every picture loaded, no "did not load" line`, missing.slice(0, 3).join(', '));
  };
  const onPage = async (x, y) => {
    const bb = await canvas.boundingBox();
    const p = await page.evaluate(([a, c]) => window.broodfall.worldToScreen(a, c), [x, y]);
    return { x: bb.x + (p.x / p.vw) * bb.width, y: bb.y + (p.y / p.vh) * bb.height, bb };
  };
  const closeOn = async (at, zoom) => {
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    let p = await onPage(at.x, at.y);
    await page.mouse.move(p.x, p.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(500);
    for (let round = 0; round < 4; round++) {
      p = await onPage(at.x, at.y);
      const mid = { x: p.bb.x + p.bb.width / 2, y: p.bb.y + p.bb.height / 2 };
      if (Math.hypot(p.x - mid.x, p.y - mid.y) < 12) break;
      await page.keyboard.down('Shift');
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(mid.x, mid.y, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(400);
    }
  };

  // ---- the seedling pod in flight
  if (want('pod')) {
    await open('seed=11&biome=suburb');
    const fl = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const cc = s.map.coreCell;
      const cells = window.broodfall.buildableCells(400).filter((c) => Math.abs((c % W) - (cc % W)) + Math.abs(Math.floor(c / W) - Math.floor(cc / W)) >= 5);
      const to = s.cellCenter(cells[0]);
      return { from: { ...s.core }, to };
    });
    await closeOn({ x: (fl.from.x + fl.to.x) / 2, y: (fl.from.y + fl.to.y) / 2 }, 7);
    // Four moments of one flight: the pod at each of its drawn frames (after), the same moments before.
    const T = [0.5, 0.64, 0.76, 0.885];
    let k = 0;
    for (const t of T) {
      await page.evaluate(([f, tt]) => {
        const s = window.broodfall.sim;
        s.seedFlights = [{ id: 990001, towerId: -1, from: f.from, to: f.to, ttl: 0.9 * (1 - tt) }];
      }, [fl, t]);
      await page.waitForTimeout(350);
      // Where the pod is: on its arc (the renderer's own place()), found by the page's own projection.
      const mid = await onPage(fl.from.x + (fl.to.x - fl.from.x) * t, fl.from.y + (fl.to.y - fl.from.y) * t);
      await page.screenshot({ path: png(`pod-${k++}`), clip: { x: mid.x - 150, y: mid.y - 280, width: 300, height: 260 } });
    }
    check(await page.evaluate(() => window.broodfall.sim.seedFlights.length === 1), 'the pod is in the air in every picture');
  }

  // ---- the props seen from every side
  if (want('backs')) {
    for (const set of BACK_SETS) {
      await open(`seed=11&biome=${set}`);
      const core = await page.evaluate(() => ({ ...window.broodfall.sim.core }));
      for (let q = 0; q < 4; q++) {
        if (q) await page.evaluate(() => window.broodfall.turnBy(1));
        await closeOn(core, 2);
        await page.waitForTimeout(600);
        await canvas.screenshot({ path: png(`backs-${set}-t${q}`) });
      }
    }
  }

  // ---- the flinch of the units that had a stub of a pole in it
  if (want('flinch') && POLE_UNITS.length) {
    await open('seed=23&biome=suburb');
    const st = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      const out = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 && d(c) >= 3 && d(c) <= 9) out.push(c);
      return out.sort((a, b2) => d(a) - d(b2));
    });
    for (const [n, kind] of POLE_UNITS.entries()) {
      const id = await page.evaluate(([k, cell]) => {
        const s = window.broodfall.sim;
        for (const e of [...s.enemies]) s.enemies.splice(s.enemies.indexOf(e), 1);
        const e = s.spawnEnemy(k, s.gates[0]);
        const c = s.cellCenter(cell);
        e.pos.x = c.x; e.pos.y = c.y; e.revealedUntil = s.time + 999;
        window.__held = { [e.id]: { ...e.pos } };
        return e.id;
      }, [kind, st[n % st.length]]);
      const at = await page.evaluate((i) => ({ ...window.broodfall.sim.enemies.find((e) => e.id === i).pos }), id);
      await closeOn(at, 11);
      const tick = () => page.evaluate(() => { const b2 = window.broodfall; b2.step(1); for (const e of b2.sim.enemies) { const h = window.__held?.[e.id]; if (h) { e.pos.x = h.x; e.pos.y = h.y; e.hp = Math.max(e.hp, 1); } } });
      for (let i = 0; i < 4; i++) { await tick(); await page.waitForTimeout(40); }
      await page.evaluate((i) => { const s = window.broodfall.sim; const e = s.enemies.find((u) => u.id === i); s.damageEnemy(e, e.maxHp * 0.2, 1); }, id);
      for (let i = 0; i < 8; i++) {
        await tick();
        await page.waitForTimeout(120);
        const p = await onPage(at.x, at.y);
        await page.screenshot({ path: png(`flinch-${kind}-${i}`), clip: { x: p.x - 130, y: p.y - 200, width: 260, height: 260 } });
      }
    }
  }

  // ---- the core at stage 3 (and 4), its idle
  if (want('core3')) {
    await open('seed=11&biome=suburb');
    for (const [stage, grown] of [[3, 18], [4, 40]]) {
      await page.evaluate((g) => { window.broodfall.sim.stats.limbsGrown = g; }, grown);
      await page.waitForFunction((k) => window.broodfall.coreStage().stage === k && window.broodfall.coreStage().into === 0, stage, { timeout: 30000 }).catch(() => {});
      check((await page.evaluate(() => window.broodfall.coreStage())).stage === stage, `the core is at stage ${stage}`);
      // Played: the idles' clock runs on real time at the game's speed; 1x for these pictures.
      await page.evaluate(() => { const b2 = document.querySelector('[data-speed="1"], #speed-1'); if (b2) b2.click(); });
      const core = await page.evaluate(() => ({ ...window.broodfall.sim.core }));
      await closeOn(core, 3);
      for (let i = 0; i < 8; i++) {
        const p = await onPage(core.x, core.y);
        await page.screenshot({ path: png(`core${stage}-${i}`), clip: { x: p.x - 200, y: p.y - 390, width: 400, height: 460 } });
        await page.waitForTimeout(167);
      }
    }
  }
  check(errors.length === 0, 'no page errors', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);

// ------------------------------------------------------------------ the sheets
async function compose() {
  const { PNG } = await import('pngjs');
  const read = (f) => PNG.sync.read(fs.readFileSync(f));
  const have = (f) => fs.existsSync(f);
  const P = (name, tag) => join(shots, `${name}-${tag}.png`);
  /** Rows of pictures, one row per tag, side by side, labelled by ffmpeg drawtext-free tiling. */
  const strip = (names, out, scale = 1) => {
    const rows = ['before', 'after'].map((tag) => names.map((n) => P(n, tag)).filter(have));
    if (rows.some((r) => !r.length)) { console.log(`  skip ${out}: missing pictures`); return; }
    const inputs = [];
    const filters = [];
    rows.forEach((r, ri) => {
      r.forEach((f) => inputs.push('-i', f));
      const base = rows.slice(0, ri).reduce((a, x) => a + x.length, 0);
      filters.push(`${r.map((_, i) => `[${base + i}:v]`).join('')}hstack=inputs=${r.length}${r.length === 1 ? '' : ''}[r${ri}]`);
    });
    const one = (ri) => (rows[ri].length === 1 ? `[${rows.slice(0, ri).reduce((a, x) => a + x.length, 0)}:v]` : `[r${ri}]`);
    const fl = [...rows.map((r, ri) => (r.length > 1 ? filters[ri] : null)).filter(Boolean), `${one(0)}${one(1)}vstack=inputs=2,scale=iw*${scale}:ih*${scale}:flags=lanczos`].join(';');
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', fl, '-q:v', '3', join(screens, out)], { encoding: 'utf8' });
    if (r.status !== 0) { console.log(r.stderr); failed++; return; }
    console.log(`  sheet ${join(screens, out)}  (top: before, bottom: after)`);
  };
  strip([0, 1, 2, 3].map((i) => `pod-${i}`), 'fixpass-art-pod-BEFORE-AFTER.jpg', 1.5);
  for (const kind of POLE_UNITS) strip([0, 1, 2, 3, 4, 5, 6, 7].map((i) => `flinch-${kind}-${i}`), `fixpass-art-flinch-${kind}-BEFORE-AFTER.jpg`);
  for (const s of [3, 4]) strip([0, 1, 2, 3, 4, 5, 6, 7].map((i) => `core${s}-${i}`), `fixpass-art-core${s}-BEFORE-AFTER.jpg`);
  // The props: where before and after differ, cropped big, before above after.
  for (const set of BACK_SETS) {
    const spots = [];
    for (let q = 0; q < 4; q++) {
      const a = P(`backs-${set}-t${q}`, 'before'), z = P(`backs-${set}-t${q}`, 'after');
      if (!have(a) || !have(z)) continue;
      const A = read(a), Z = read(z);
      const C = 24;
      const gw = Math.floor(A.width / C), gh = Math.floor(A.height / C);
      const score = new Float32Array(gw * gh);
      for (let y = 0; y < gh * C; y++) for (let x = 0; x < gw * C; x++) {
        const i = (y * A.width + x) * 4;
        const d = Math.abs(A.data[i] - Z.data[i]) + Math.abs(A.data[i + 1] - Z.data[i + 1]) + Math.abs(A.data[i + 2] - Z.data[i + 2]);
        if (d > 60) score[Math.floor(y / C) * gw + Math.floor(x / C)]++;
      }
      // The strongest changed cells, at least 5 cells apart; the middle (the core, animated) is left out.
      const order = [...score.keys()].filter((k) => score[k] > 25).sort((p, q2) => score[q2] - score[p]);
      const taken = [];
      for (const k of order) {
        const x = k % gw, y = Math.floor(k / gw);
        if (Math.hypot(x - gw / 2, y - gh / 2) < 6) continue;
        if (taken.some((t) => Math.hypot(t.x - x, t.y - y) < 5)) continue;
        taken.push({ x, y });
        if (taken.length >= 3) break;
      }
      for (const t of taken) spots.push({ q, x: Math.max(0, Math.min(A.width - 120, t.x * C + C / 2 - 60)), y: Math.max(0, Math.min(A.height - 120, t.y * C + C / 2 - 60)) });
    }
    if (!spots.length) { console.log(`  ${set}: no prop changed on screen`); continue; }
    const use = spots.slice(0, 6);
    for (const [n, sp] of use.entries()) {
      for (const tag of ['before', 'after']) {
        spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', P(`backs-${set}-t${sp.q}`, tag), '-vf', `crop=120:120:${sp.x}:${sp.y},scale=300:300:flags=lanczos`, P(`backs-${set}-spot${n}`, tag)]);
      }
    }
    strip(use.map((_, n) => `backs-${set}-spot${n}`), `fixpass-art-backs-${set}-BEFORE-AFTER.jpg`);
    console.log(`  ${set}: ${use.length} spots, turns ${use.map((s) => s.q).join(',')}`);
  }
}
