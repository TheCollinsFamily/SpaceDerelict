/**
 * THE TOWNSFOLK FLEEING THE CRASH in the real game (Sep 30 2026; src/sim/civilians.ts, drawn by
 * src/render/isoRender.ts drawTownsfolk). Plays the DEV server (never dist).
 *
 *   1. Minute zero: the neighbourhood's people on the streets, the first of them panicking.
 *   2. A few seconds on: the crowd running down the streets for the gates, the creep behind them,
 *      and (a creep node thrown ahead of them by the game's own place-node command) the creep
 *      taking the slowest.
 *   3. The same moment on the old top-down board (?view=top).
 *
 * Usage: node tools/shot-civilians.mjs [--top]
 *   BROODFALL_URL=http://localhost:5291  use a dev server already running instead of starting one
 * Artifacts: notes/screens/2026-09-30/gap-civilians-1.jpg, gap-civilians-2.jpg (and -top.jpg with --top)
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5291);
const TOP = process.argv.includes('--top');
const SEED = Number(process.env.SEED || 42);
let failed = 0;
const check = (ok, what, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failed++; };

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
let server = null;
let BASE = process.env.BROODFALL_URL;
if (!BASE) {
  freePort();
  server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('vite did not start')), 30000);
    server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
  });
  BASE = `http://localhost:${PORT}`;
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const shoot = (page, name) => page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 88 });

async function open(extra = '') {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e) + ' ' + String(e.stack).slice(0, 400)));
  // The dev server's socket is cut: another session saving a file must not reload this page mid-beat.
  await page.addInitScript(() => { window.WebSocket = class { constructor() {} addEventListener() {} removeEventListener() {} send() {} close() {} }; });
  await page.goto(`${BASE}/?seed=${SEED}&autostart=1&speed=0${extra}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  return { page, errors };
}
const civ = (page) => page.evaluate(() => window.broodfall.renderer.civiliansNow());
const clean = async (page) => {
  const text = await page.evaluate(() => document.body.innerText);
  const missing = await page.evaluate(() => window.broodfall.missing?.() ?? []);
  if (missing.length) console.log('  missing:', missing.join(', '));
  const notice = await page.evaluate(() => document.getElementById('art-notice')?.title ?? '');
  if (notice) console.log('  notice:', notice);
  return !/did not load|went wrong/i.test(text);
};
/** Put the camera's middle on a world point, and zoom in about it. */
const frame = async (page, wx, wy, ticks) => {
  await page.evaluate(([x, y]) => {
    const r = window.broodfall.renderer;
    const p = window.broodfall.worldToScreen(x, y);
    r.panBy?.(p.vw / 2 - p.x, p.vh / 2 - p.y);
  }, [wx, wy]);
  await page.waitForTimeout(600);
  const box = await (await page.$('#stage canvas')).boundingBox();
  const p = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [wx, wy]);
  await page.mouse.move(box.x + p.x * (box.width / p.vw), box.y + p.y * (box.height / p.vh));
  for (let i = 0; i < ticks; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(40); }
  await page.waitForTimeout(1400);
};
/** Step the sim a tick at a time, with frames drawn between (the crowd eases between ticks). */
const play = async (page, n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(34); } };

try {
  const { page, errors } = await open(TOP ? '&view=top' : '');
  await page.evaluate(() => window.broodfall.surface());
  const core = await page.evaluate(() => ({ ...window.broodfall.sim.core }));
  const c0 = await civ(page);
  check(c0.count >= 25 && c0.count <= 40, 'a minute-zero crowd stands on the streets', `${c0.count}`);
  // Frame the crowd: between the core and the middle of the townsfolk.
  const mid = c0.list.reduce((m, c) => ({ x: m.x + c.x / c0.list.length, y: m.y + c.y / c0.list.length }), { x: 0, y: 0 });
  await frame(page, mid.x * 0.8 + core.x * 0.2, mid.y * 0.8 + core.y * 0.2, TOP ? 0 : 9);
  await play(page, 20);
  const c1 = await civ(page);
  check(c1.flee + c1.cower > 0 && c1.calm > 0, 'minute zero: some still calm, the first panicking', JSON.stringify({ calm: c1.calm, flee: c1.flee, cower: c1.cower }));
  check(await clean(page), 'no load failure or fault on the page');
  await shoot(page, TOP ? 'gap-civilians-top-1' : 'gap-civilians-1');

  // A creep node thrown ahead of the runners (the game's own command, as a player would): the creep overtakes some.
  const placed = await page.evaluate(() => {
    const bf = window.broodfall;
    const s = bf.sim;
    const crowd = bf.renderer.civiliansNow().list.filter((c) => c.state !== 'leaving');
    s.nodeStock.unshift({ radius: 3, reach: 8, slow: 1, dps: 0 });
    // At the back of the crowd: a street cell a node can go on with about six townsfolk close by
    // (the stragglers), the rest of the crowd farther off; of those, the one nearest the landing site.
    let best = -1, most = 0, bestScore = Infinity;
    const core = s.core;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (!s.canPlaceNode(c, 8)) continue;
      const p = s.cellCenter(c);
      const n = crowd.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2 * s.cfg.cellPx).length;
      if (n < 1) continue;
      const score = Math.abs(n - 6) * 1000 + Math.hypot(p.x - core.x, p.y - core.y);
      if (score < bestScore) { bestScore = score; most = n; best = c; }
    }
    if (best < 0) { s.nodeStock.shift(); return null; }
    const r = bf.play({ kind: 'place-node', cell: best, stock: 0 });
    return r.ok ? { cell: best, near: most, at: s.cellCenter(best) } : null;
  });
  console.log('  node placed', JSON.stringify(placed));
  // Follow the crowd: the camera on the middle of those still running.
  {
    const now = await civ(page);
    const run = now.list.filter((q) => q.state !== 'calm');
    const at = run.length ? run : now.list;
    if (at.length && !TOP) {
      const m = at.reduce((acc, q) => ({ x: acc.x + q.x / at.length, y: acc.y + q.y / at.length }), { x: 0, y: 0 });
      await page.evaluate(([x, y]) => {
        const r = window.broodfall.renderer;
        const p = window.broodfall.worldToScreen(x, y);
        r.panBy?.(p.vw / 2 - p.x, p.vh / 2 - p.y);
      }, [m.x, m.y]);
    }
  }
  // Until the creep has taken the first of them (its puff), then a moment more.
  for (let i = 0; i < 60; i++) { await play(page, 1); if ((await civ(page)).puffs > 0) break; }
  await play(page, 3);
  const c2 = await civ(page);
  check(c2.flee + c2.leaving > c1.flee, 'a few seconds on: the crowd is running', JSON.stringify({ calm: c2.calm, flee: c2.flee, leaving: c2.leaving, escaped: c2.escaped, taken: c2.taken }));
  const meanD = (c) => c.list.reduce((s, q) => s + Math.hypot(q.x - core.x, q.y - core.y), 0) / Math.max(1, c.list.length);
  check(meanD(c2) > meanD(c0) || c2.escaped > 0, 'away from the landing site', `${meanD(c0).toFixed(0)} -> ${meanD(c2).toFixed(0)} px, ${c2.escaped} got away`);
  check(c2.taken > 0 || c2.puffs > 0 || !placed, 'the creep takes the ones it overtakes', `${c2.taken} taken`);
  check(await clean(page), 'no load failure or fault on the page');
  await shoot(page, TOP ? 'gap-civilians-top-2' : 'gap-civilians-2');
  check(errors.length === 0, 'no page errors', errors.slice(0, 2).join(' | '));
  await page.close();
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exitCode = failed ? 1 : 0;
