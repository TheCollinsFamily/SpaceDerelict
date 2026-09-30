/**
 * STORE SCREENSHOTS (Sep 30 2026): real moments of the game at 1920x1080, from the DEV server,
 * with the GPU on. Candidates go to art-src/promo-shots/ (git-ignored); the ones worth showing are
 * copied into promo/screenshots/ by hand after looking at them. Reads the game, never edits it.
 *
 *   node tools/promo/shots.mjs [siege|boss|ship|draft|creep] ...
 *   PROMO_PORT (default 5317)
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'art-src', 'promo-shots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.PROMO_PORT || 5317);
const BASE = `http://localhost:${PORT}/`;
const want = new Set(process.argv.slice(2));
const on = (b) => !want.size || want.has(b);

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split('\n')) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dev server did not start in 60s')), 60000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`dev server exited early (${code})`)));
  });
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('bf-promo-init')) return;
    sessionStorage.setItem('bf-promo-init', '1');
    for (const k of ['broodfall-campaign', 'broodfall-campaign-pending', 'broodfall-meta']) localStorage.removeItem(k);
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-onboarded', '1');
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  page error:', String(e).slice(0, 200)));
  return { ctx, page };
}
const ready = (page) => page.waitForFunction(() => window.broodfall?.sim, null, { timeout: 90000 });
const snap = async (page, name) => {
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  console.log('  shot', f);
};

/** Play fast with the scripted player (its own wallet, a little topped up) to wave `upTo`. */
const grow = (page, upTo, topUp = 0) => page.evaluate(([upTo, topUp]) => {
  const b = window.broodfall, s = b.sim;
  for (let i = 0; i < 400 && s.outcome === 'playing' && s.waveNumber < upTo; i++) {
    if (topUp) s.meat.war += topUp;
    b.step(300);
  }
  return { wave: s.waveNumber, towers: s.towers.length, outcome: s.outcome, phase: s.phase, enemies: s.enemies.length };
}, [upTo, topUp]);

/** The "demo mode" line is the scripted player's, not the game's: hidden for the photograph. */
const dress = async (page) => {
  await page.addStyleTag({ content: '#hint{visibility:hidden!important}' });
  // The board is drawn at a fixed 1360x1000 and letterboxed; for a 16:9 store picture its drawing
  // surface is resized (at run time, from here) to fill the space the page gives it. The renderer
  // reads its own size every frame, so nothing in the game changes.
  await page.evaluate(() => {
    const wrap = document.getElementById('stage-wrap');
    const r = window.broodfall.renderer;
    if (!wrap || !r?.app) return;
    r.app.renderer.resize(wrap.clientWidth, wrap.clientHeight);
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('Home');
};

/** The view zoomed `z` wheel steps in on where the enemies are thickest, that point dragged to the middle. */
async function onTheFight(page, z = 5, kind = null) {
  await page.keyboard.press('Home');
  await page.waitForTimeout(400);
  const target = () => page.evaluate((kind) => {
    const s = window.broodfall.sim;
    const es = s.enemies.filter((e) => !e.leaving && (!kind || e.kind === kind));
    if (!es.length) return null;
    let best = es[0], bestN = -1;
    for (const e of es) { const n = es.filter((o) => Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < 140).length; if (n > bestN) { bestN = n; best = e; } }
    const near = es.filter((o) => Math.hypot(o.pos.x - best.pos.x, o.pos.y - best.pos.y) < 140);
    const x = near.reduce((a, e) => a + e.pos.x, 0) / near.length, y = near.reduce((a, e) => a + e.pos.y, 0) / near.length;
    return window.broodfall.worldToScreen(x, y);
  }, kind);
  const b = await page.locator('#stage canvas').boundingBox();
  const onPage = (at) => ({ x: b.x + (at.x / at.vw) * b.width, y: b.y + (at.y / at.vh) * b.height });
  let at = await target();
  if (!at) return;
  let p = onPage(at);
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < z; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  for (let round = 0; round < 3; round++) {
    at = await target(); if (!at) return;
    p = onPage(at);
    if (Math.hypot(p.x - (b.x + b.width / 2), p.y - (b.y + b.height / 2)) < 40) break;
    await page.keyboard.down('Shift');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(300);
  }
  await page.mouse.move(b.x + 5, b.y + 5);
}

/** Wait (real time, the game running live) until the street is busy, then take a few frames. */
async function liveFrames(page, name, n = 4, gap = 1400, minEnemies = 12) {
  for (let i = 0; i < 40; i++) {
    const e = await page.evaluate(() => window.broodfall.sim.enemies.length);
    if (e >= minEnemies) break;
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < n; i++) { await snap(page, `${name}-${i + 1}`); await page.waitForTimeout(gap); }
}

try {
  if (on('siege')) {
    const list = [[5, 'orthodox', 9], [12, 'megacity', 9], [21, 'orient', 7], [8, 'farmland', 8], [3, 'suburb', 8], [17, 'industrial', 8]];
    for (const [seed, biome, wave] of list.filter(([, b]) => !process.env.PROMO_BIOME || process.env.PROMO_BIOME.includes(b))) {
      const { ctx, page } = await fresh();
      await page.goto(`${BASE}?seed=${seed}&auto=1&autostart=1&speed=1&directive=hold&biome=${biome}`);
      await ready(page);
      await dress(page);
      await page.waitForTimeout(1500);
      console.log(`siege ${biome}`, JSON.stringify(await grow(page, wave, 25)));
      for (let i = 0; i < 40; i++) { if (await page.evaluate(() => window.broodfall.sim.enemies.length) >= 14) break; await page.waitForTimeout(500); }
      await page.waitForTimeout(2500);
      for (let i = 0; i < 3; i++) { await onTheFight(page, 5); await snap(page, `siege-${biome}-${i + 1}`); await page.waitForTimeout(1500); }
      await onTheFight(page, 3);
      await snap(page, `siege-${biome}-wide`);
      await ctx.close();
    }
  }
  if (on('boss')) {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}?seed=5&auto=1&autostart=1&speed=1&directive=hold&biome=orthodox`);
    await ready(page);
    await page.waitForTimeout(1500);
    await dress(page);
    console.log('boss', JSON.stringify(await grow(page, 7, 15)));
    await page.evaluate(() => {
      const s = window.broodfall.sim;
      for (const k of ['royal', 'consort']) { const e = s.spawnEnemy(k, s.gates[0]); e.revealedUntil = s.time + 999; }
    });
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(2200);
      await onTheFight(page, i % 2 ? 4 : 6, 'royal');
      await snap(page, `boss-${i + 1}`);
    }
    await ctx.close();
  }
  if (on('draft')) {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}?seed=9&autostart=1&speed=0&directive=hold&biome=suburb`);
    await ready(page);
    await dress(page);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const b = window.broodfall, s = b.sim;
      b.surface();
      for (let round = 0; round < 12 && s.phase !== 'draft' && s.outcome === 'playing'; round++) {
        s.meat.war = Math.max(s.meat.war, 500);
        const cells = b.buildableCells(80);
        let built = 0;
        for (let g = 0; g < 60 && built < 4; g++) {
          const i = 0;
          if (!s.hand.length) break;
          const cell = cells.find((c) => s.canBuildTower(c, s.hand[i].family));
          if (cell === undefined) { s.issue({ kind: 'discard', cardIndex: i }); continue; }
          if (s.issue({ kind: 'build', cardIndex: i, cell }).ok) built++; else s.issue({ kind: 'discard', cardIndex: i });
        }
        s.issue({ kind: 'call-early' });
        const w0 = s.wavesCleared;
        for (let k = 0; k < 8000 && s.phase !== 'draft' && s.wavesCleared === w0 && s.outcome === 'playing'; k++) b.step(1);
        b.surface();
      }
      return { phase: s.phase, waves: s.wavesCleared, towers: s.towers.length };
    });
    console.log('draft', JSON.stringify(r));
    await page.waitForTimeout(1500);
    await snap(page, 'draft-1');
    await ctx.close();
  }
  if (on('ship')) {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}?campaign=ship&open=1`);
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await snap(page, 'ship-desk');
    for (const r of ['board', 'ai', 'genes']) {
      const loc = page.locator(`[data-room="${r}"]`);
      if (await loc.count()) { await loc.first().click(); await page.waitForTimeout(3000); await snap(page, `ship-${r}`); }
    }
    await ctx.close();
  }
  if (on('creep')) {
    const { ctx, page } = await fresh();
    await page.goto(`${BASE}?seed=14&auto=1&autostart=1&speed=1&directive=hold&biome=deephive`);
    await ready(page);
    await page.waitForTimeout(1500);
    await dress(page);
    console.log('creep', JSON.stringify(await grow(page, 10, 10)));
    await page.keyboard.press('Home');
    await liveFrames(page, 'late-deephive', 3, 1500, 6);
    await ctx.close();
  }
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  freePort();
}
