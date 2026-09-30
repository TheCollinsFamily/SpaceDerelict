/**
 * THE BOARD'S OWN ART in the real game (Sep 30 2026): the seams between tiles, the skin that
 * breathes and reaches, the strains drawn (mire, burning), the pods growing and spreading,
 * the gates, the unclaimed city under smoke, a plinth rising, legibility at far zoom, and the
 * frame rate. Plays the DEV server (never dist: other sessions run their beats against dist).
 *
 * Usage: node tools/shot-board-art.mjs [set ...]         (none named: orthodox, farmland, industrial, deephive)
 *   BROODFALL_URL=http://localhost:5231  use a dev server already running instead of starting one
 * Artifacts: tools/screenshots/board-art-*.png (then node tools/shots-to-jpg.mjs)
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5233);
const asked = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SETS = asked.length ? asked : ['orthodox', 'farmland', 'industrial', 'deephive'];
let failed = 0;
const check = (ok, what, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failed++; };

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
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
const shot = (page, name) => page.screenshot({ path: join(shots, `board-art-${name}.png`) });

async function open(set, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // The dev server's socket is cut: another session saving a file must not reload this page mid-beat.
  await page.addInitScript(() => { window.WebSocket = class { constructor() {} addEventListener() {} removeEventListener() {} send() {} close() {} }; });
  await page.goto(`${BASE}/?seed=42&auto=1&speed=0&biome=${set}${extra}`);
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { page, errors };
}
const steps = async (page, n) => { for (let done = 0; done < n; done += 300) await page.evaluate((k) => window.broodfall.step(k), Math.min(300, n - done)); };
const life = (page) => page.evaluate(() => window.broodfall.renderer.boardLife());
const zoom = async (page, ticks, at) => {
  const box = await (await page.$('#stage canvas')).boundingBox();
  await page.mouse.move(at?.[0] ?? box.x + box.width / 2, at?.[1] ?? box.y + box.height / 2);
  for (let i = 0; i < Math.abs(ticks); i++) { await page.mouse.wheel(0, ticks > 0 ? -240 : 240); await page.waitForTimeout(30); }
  await page.waitForTimeout(1600);
};
const home = async (page) => { await page.keyboard.press('Home'); await page.waitForTimeout(1800); };
/** Put the camera's middle on a world point (pans by dragging the view with the keyboard-free API). */
const lookAt = async (page, wx, wy) => {
  await page.evaluate(([x, y]) => {
    const r = window.broodfall.renderer;
    const p = window.broodfall.worldToScreen(x, y);
    r.panBy(p.vw / 2 - p.x, p.vh / 2 - p.y);
  }, [wx, wy]);
  await page.waitForTimeout(1600);
};

try {
  // ---- 1. Strains, pods, tendrils, pulse: nodes of every look placed by the game's own command.
  {
    const { page, errors } = await open('orthodox');
    await steps(page, 900);
    const placed = await page.evaluate(() => {
      const bf = window.broodfall;
      const s = bf.sim;
      const looks = [
        { radius: 3, reach: 3, slow: 1, dps: 0 },
        { radius: 3, reach: 3, slow: 0.75, dps: 0 },
        { radius: 3, reach: 3, slow: 1, dps: 4 },
        { radius: 5, reach: 3, slow: 1, dps: 0 },
        { radius: 3, reach: 8, slow: 1, dps: 0 },
      ];
      const out = [];
      const core = s.cellCenter(s.map.coreCell);
      // Streets near the creep, nearest the core first: where a player puts strains.
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 || s.map.cells[c] === 2) cells.push(c);
      cells.sort((a, b) => { const p = s.cellCenter(a), q = s.cellCenter(b); return Math.hypot(p.x - core.x, p.y - core.y) - Math.hypot(q.x - core.x, q.y - core.y); });
      for (const strain of looks) {
        s.nodeStock.unshift(strain);
        // Out from under the landing site, a few cells apart, so that each is seen.
        const far = (c) => { const p = s.cellCenter(c); return Math.hypot(p.x - core.x, p.y - core.y) > 3 * s.cfg.cellPx; };
        const apart = (c) => !out.some((o) => Math.abs((o % s.cfg.gridW) - (c % s.cfg.gridW)) + Math.abs(Math.floor(o / s.cfg.gridW) - Math.floor(c / s.cfg.gridW)) < 3);
        const cell = cells.find((c) => far(c) && apart(c) && s.canPlaceNode(c, strain.reach));
        if (cell === undefined) { s.nodeStock.shift(); continue; }
        const r = bf.play({ kind: 'place-node', cell, stock: 0 });
        if (r.ok) out.push(cell);
      }
      return out;
    });
    check(placed.length === 5, 'a node of every look is placed by the place-node command', `${placed.length} of 5`);
    // A moment in: the pods are growing.
    await page.waitForTimeout(250);
    const growing = await life(page);
    check(growing.pods.length >= 5 && growing.pods.filter((p) => p.growing).length >= 3, 'the pods grow when placed', JSON.stringify(growing.pods.map((p) => `${p.look}${p.growing ? '*' : ''}`)));
    check(new Set(growing.pods.map((p) => p.look)).size === 5, 'every look is drawn', [...new Set(growing.pods.map((p) => p.look))].join(', '));
    const first = await page.evaluate((list) => {
      const s = window.broodfall.sim;
      const ps = list.map((c) => s.cellCenter(c));
      return { x: ps.reduce((a, p) => a + p.x, 0) / Math.max(1, ps.length), y: ps.reduce((a, p) => a + p.y, 0) / Math.max(1, ps.length) };
    }, placed);
    await lookAt(page, first.x, first.y);
    await zoom(page, 5);
    await shot(page, 'pods-growing');
    await page.waitForTimeout(1500);
    // Let the strains' creep spread under them.
    await steps(page, 150);
    await page.waitForTimeout(1200);
    await shot(page, 'pods-and-strains');
    const l = await life(page);
    check(l.skin.tendrils > 10, 'tendrils reach past the ragged edges', `${l.skin.tendrils} tendrils on ${l.skin.cells} cells of skin`);
    // The skin breathes: two frames a beat apart differ where it lies.
    const breath = await page.evaluate(async () => {
      const r = window.broodfall.renderer;
      const sample = () => r.creepFloor.children.slice(0, 40).map((s) => s.tint);
      const a = sample();
      await new Promise((res) => setTimeout(res, 900));
      const b = sample();
      return a.filter((t, i) => t !== b[i]).length;
    });
    check(breath > 10, 'the skin pulses (its tint changes over a beat)', `${breath} of 40 sprites changed`);
    // Spread one: every node here is fresh, so it is matured by the waves the sim would count.
    const spread = await page.evaluate(() => {
      const bf = window.broodfall;
      const s = bf.sim;
      const n = s.creepSources.find((x) => x.kind === 'node' && !x.spent);
      if (!n) return 'no node';
      n.matureAt = 0;
      for (let c = 0; c < s.map.cells.length; c++) if (s.canSpreadTo(n, c)) return bf.play({ kind: 'spread-node', sourceId: n.id, cell: c }).ok ? 'ok' : 'refused';
      return 'nowhere';
    });
    await page.waitForTimeout(350);
    const sp = await life(page);
    check(spread === 'ok' && sp.pods.some((p) => p.spreading), 'a node that spreads its child plays its spreading', spread);
    await shot(page, 'pod-spreading');
    await page.waitForTimeout(2000);
    check(errors.length === 0, 'no page errors', errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---- 2. Every set: the gates, the unclaimed city, far zoom, the four turns, the frame rate.
  for (const set of SETS) {
    console.log(set);
    const { page, errors } = await open(set);
    await steps(page, 2400);
    const l = await life(page);
    check(l.gates >= 1, `${set}: the gates are drawn as gateways`, `${l.gates}`);
    check(l.skyline.blocks > 100 && l.skyline.wisps > 10, `${set}: the unclaimed city stands under smoke`, `${l.skyline.blocks} pieces, ${l.skyline.wisps} wisps`);
    await home(page);
    await zoom(page, -6);
    await shot(page, `${set}-far`);
    await home(page);
    await shot(page, `${set}-home`);
    // The gate the next assault comes through, close.
    const gate = await page.evaluate(() => { const s = window.broodfall.sim; const g = s.incomingGates[0] ?? s.gates[0]; return g === undefined ? null : s.cellCenter(g); });
    if (gate) {
      await lookAt(page, gate.x, gate.y);
      await zoom(page, 4);
      await shot(page, `${set}-gate`);
    }
    // Close, from all four sides: no seams.
    await home(page);
    await zoom(page, 6);
    for (let t = 0; t < 4; t++) {
      if (t) { await page.evaluate(() => window.broodfall.turnBy(1)); await page.waitForTimeout(1800); }
      await shot(page, `${set}-close-turn${t}`);
    }
    await page.evaluate(() => window.broodfall.turnBy(1));
    await home(page);
    // The frame rate with the board alive and with it stilled, in turns, in the same page: other sessions' beats
    // share this GPU, so a single number measures them as much as this board.
    const ab = await page.evaluate(async () => {
      const r = window.broodfall.renderer;
      const fps = () => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(n / 1.5); }; requestAnimationFrame(tick); });
      const set = (on) => { r.skyline.under.visible = on; r.skyline.smoke.visible = on; };
      let off = 0, on = 0;
      for (let k = 0; k < 3; k++) { set(false); off = Math.max(off, await fps()); set(true); on = Math.max(on, await fps()); }
      return { off, on };
    });
    check(ab.on >= 45 || ab.on >= ab.off * 0.9, `${set}: the frame rate holds with the board alive`, `${ab.on.toFixed(0)} fps alive, ${ab.off.toFixed(0)} without the unclaimed city`);
    check(errors.length === 0, `${set}: no page errors`, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---- 3. A plinth: the roof rises out of its block.
  {
    const { page, errors } = await open('orthodox');
    await steps(page, 1500);
    const cell = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.plinths += 1;
      const limb = s.towers.find((t) => s.plinthGround(t.cell));
      return limb ? limb.cell : -1;
    });
    const at = await page.evaluate((c) => window.broodfall.sim.cellCenter(c), cell);
    await lookAt(page, at.x, at.y);
    await zoom(page, 4);
    await shot(page, 'plinth-before');
    await page.evaluate((c) => window.broodfall.play({ kind: 'place-plinth', cell: c }), cell);
    await page.waitForTimeout(380);
    const mid = await life(page);
    check(mid.rising.length > 0, 'a roof raised on a plinth rises', `${mid.rising.length} cells rising`);
    await shot(page, 'plinth-rising');
    await page.waitForTimeout(1600);
    await shot(page, 'plinth-risen');
    const after = await life(page);
    check(after.rising.length === 0, 'and settles', `${after.rising.length} still rising`);
    check(errors.length === 0, 'no page errors', errors.slice(0, 2).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
