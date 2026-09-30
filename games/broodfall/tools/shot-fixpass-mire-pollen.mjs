/**
 * FIX PASS (Sep 30 2026): the mire strain and the Deep Hive's pollen roof, in the real game.
 *
 *   mire:   "Mire creep reads as grass beside green roofs". Nodes of the plain look and of the mire look are
 *           put down by the game's own place-node command on a board of green roofs (the Terraced Fields and
 *           the Granary Belt's farmland), their creep let spread, then photographed close and at home zoom.
 *   pollen: "the deep hive's pollen roof is a loud lemon yellow". A Deep Hive board played a while, at home zoom
 *           and close from two turns, the creep on some roofs beside the pollen ones.
 *
 * Fails if any picture did not load (artMissing() non-empty) or a "did not load" notice shows.
 * Plays the DEV server on its own port (5274).
 *
 * Usage: node tools/shot-fixpass-mire-pollen.mjs --tag before|after [mire] [pollen]
 * Pictures: notes/screens/2026-09-30/fixpass-art-mire-<scene>-<tag>.jpg, fixpass-art-pollen-<scene>-<tag>.jpg
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5274);
const args = process.argv.slice(2);
const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : 'after';
const asked = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--tag');
const want = (s) => !asked.length || asked.includes(s);
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
freePort();
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const BASE = `http://localhost:${PORT}`;
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const shot = (page, name) => page.screenshot({ path: join(screens, `fixpass-art-${name}-${tag}.jpg`), type: 'jpeg', quality: 88 });

async function open(set) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.WebSocket = class { constructor() {} addEventListener() {} removeEventListener() {} send() {} close() {} }; });
  await page.goto(`${BASE}/?seed=42&auto=1&speed=0&biome=${set}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  // Other sessions re-bake atlases while this runs: a picture caught mid-write is loaded again (a fresh page), up to 6 times.
  for (let k = 0; k < 6 && (await page.evaluate(() => window.broodfall.artMissing?.() ?? [])).length; k++) {
    await page.waitForTimeout(15000);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 180000 });
    await page.waitForTimeout(2500);
  }
  return { page, errors };
}
const loaded = async (page, where) => {
  const missing = await page.evaluate(() => window.broodfall.artMissing?.() ?? []);
  const banner = await page.evaluate(() => /did not load/i.test(document.body.innerText));
  check(missing.length === 0, `${where}: every picture loaded`, missing.slice(0, 3).join(', '));
  check(!banner, `${where}: no "did not load" notice`);
};
const steps = async (page, n) => { for (let done = 0; done < n; done += 300) await page.evaluate((k) => window.broodfall.step(k), Math.min(300, n - done)); };
const zoom = async (page, ticks) => {
  const box = await (await page.$('#stage canvas')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < Math.abs(ticks); i++) { await page.mouse.wheel(0, ticks > 0 ? -240 : 240); await page.waitForTimeout(30); }
  await page.waitForTimeout(1600);
};
const home = async (page) => { await page.keyboard.press('Home'); await page.waitForTimeout(1800); };
const lookAt = async (page, wx, wy) => {
  await page.evaluate(([x, y]) => {
    const r = window.broodfall.renderer;
    const p = window.broodfall.worldToScreen(x, y);
    r.panBy(p.vw / 2 - p.x, p.vh / 2 - p.y);
  }, [wx, wy]);
  await page.waitForTimeout(1600);
};

try {
  if (want('mire')) {
    for (const set of ['terraces', 'farmland']) {
      console.log(`mire on ${set}`);
      const { page, errors } = await open(set);
      await steps(page, 900);
      // Two mire nodes and one plain one, on roofs or streets out from the core, a few cells apart.
      const placed = await page.evaluate(() => {
        const bf = window.broodfall;
        const s = bf.sim;
        const looks = [
          { radius: 4, reach: 3, slow: 0.75, dps: 0 },
          { radius: 3, reach: 3, slow: 1, dps: 0 },
          { radius: 4, reach: 3, slow: 0.75, dps: 0 },
        ];
        const out = [];
        const core = s.cellCenter(s.map.coreCell);
        const cells = [];
        for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 || s.map.cells[c] === 2) cells.push(c);
        cells.sort((a, b) => { const p = s.cellCenter(a), q = s.cellCenter(b); return Math.hypot(p.x - core.x, p.y - core.y) - Math.hypot(q.x - core.x, q.y - core.y); });
        for (const look of looks) {
          s.nodeStock.unshift(look);
          const far = (c) => { const p = s.cellCenter(c); return Math.hypot(p.x - core.x, p.y - core.y) > 3 * s.cfg.cellPx; };
          const apart = (c) => !out.some((o) => Math.abs((o % s.cfg.gridW) - (c % s.cfg.gridW)) + Math.abs(Math.floor(o / s.cfg.gridW) - Math.floor(c / s.cfg.gridW)) < 4);
          const cell = cells.find((c) => far(c) && apart(c) && s.canPlaceNode(c, look.reach));
          if (cell === undefined) { s.nodeStock.shift(); continue; }
          if (bf.play({ kind: 'place-node', cell, stock: 0 }).ok) out.push(cell);
        }
        return out;
      });
      check(placed.length === 3, `${set}: two mire nodes and a plain one placed`, `${placed.length} of 3`);
      await steps(page, 600);
      await page.waitForTimeout(1200);
      await loaded(page, `mire ${set}`);
      const mid = await page.evaluate((list) => {
        const s = window.broodfall.sim;
        const ps = list.map((c) => s.cellCenter(c));
        return { x: ps.reduce((a, p) => a + p.x, 0) / Math.max(1, ps.length), y: ps.reduce((a, p) => a + p.y, 0) / Math.max(1, ps.length) };
      }, placed);
      await home(page);
      await lookAt(page, mid.x, mid.y);
      await shot(page, `mire-${set}-home`);
      await zoom(page, 5);
      await shot(page, `mire-${set}-close`);
      await zoom(page, 4);
      await shot(page, `mire-${set}-closest`);
      check(errors.length === 0, `${set}: no page errors`, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  }
  if (want('pollen')) {
    console.log('pollen on deephive');
    const { page, errors } = await open('deephive');
    await steps(page, 2400);
    await page.waitForTimeout(1200);
    await loaded(page, 'pollen deephive');
    await home(page);
    await shot(page, 'pollen-deephive-home');
    await zoom(page, -4);
    await shot(page, 'pollen-deephive-far');
    await home(page);
    await zoom(page, 5);
    await shot(page, 'pollen-deephive-close');
    await page.evaluate(() => window.broodfall.turnBy(1));
    await page.waitForTimeout(1800);
    await shot(page, 'pollen-deephive-close-turn1');
    check(errors.length === 0, 'deephive: no page errors', errors.slice(0, 2).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
