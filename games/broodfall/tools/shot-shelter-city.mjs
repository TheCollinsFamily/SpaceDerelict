/**
 * A SHELTER IN ITS CITY (Oct 2 2026, Collins: it must sit on level ground, at the scale and in the style of the buildings
 * round it, with open street all round it). For each tile set asked: a district drafted, a shelter raised in it (its
 * apron carved), photographed at the board's normal zoom and closer, intact and infested to stage 3.
 *
 * Usage: node tools/shot-shelter-city.mjs [suburb orient farmland ...]   (starts its own dev server on 5349)
 * Screenshots: notes/screens/2026-10-02/shelter-city-<set>-<normal|close>-<intact|stage3>.png
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
mkdirSync(out, { recursive: true });
const sets = process.argv.slice(2).length ? process.argv.slice(2) : ['suburb', 'orient', 'farmland'];
const PORT = Number(process.env.BROODFALL_PORT || 5349);
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite did not start')), 60000); server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fails = [];
try {
  for (const set of sets) {
    await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=${set}&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });
    const info = await page.evaluate(() => {
      const b = window.broodfall;
      const s = b.sim;
      b.step(2);
      const before = s.map.slots.filter(Boolean).length;
      b.growCity(1);
      // The newest district, else any held one: raise the shelter there.
      const W = s.cfg.gridW;
      const coreSlot = Math.floor(Math.floor(s.map.coreCell / W) / 10) * s.map.slotsX + Math.floor((s.map.coreCell % W) / 10);
      const slots = s.map.slots.map((x, i) => (x && i !== coreSlot ? i : -1)).filter((i) => i >= 0);
      for (const slot of [...slots, coreSlot]) { s.raiseShelter(slot); if (s.shelters.length) break; }
      const sh = s.shelters[0];
      s.enemies.length = 0;
      return sh ? { before, door: sh.door, heights: sh.cells.map((c) => s.map.heights[c]) } : null;
    });
    if (!info) { fails.push(`${set}: no shelter`); continue; }
    const shot = async (zoom, name) => {
      await page.evaluate((zoom) => {
        const b = window.broodfall;
        b.renderer.resetView?.();
        b.step(1);
        if (zoom > 1) {
          const sh = b.sim.shelters[0];
          for (let k = 0; k < 3; k++) {
            const c = b.renderer.clientOf(b.sim, sh.pos.x, sh.pos.y);
            if (k === 0) b.renderer.zoomAt(c.x, c.y, zoom);
            const r = b.renderer.app.canvas.getBoundingClientRect();
            const kk = b.renderer.app.renderer.width / r.width;
            const c2 = b.renderer.clientOf(b.sim, sh.pos.x, sh.pos.y);
            b.renderer.panBy((r.left + r.width / 2 - c2.x) * kk, (r.top + r.height * 0.45 - c2.y) * kk);
          }
        }
      }, zoom);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: join(out, `shelter-city-${set}-${name}.png`) });
    };
    await shot(1, 'normal-intact');
    await shot(2.2, 'close-intact');
    await page.evaluate(() => { const s = window.broodfall.sim; const sh = s.shelters[0]; sh.state = 'infested'; s.setShelterStage(sh, 3); s.refreshRouting(); });
    await shot(2.2, 'close-stage3');
    console.log(`  ${set}: ${JSON.stringify(info)}`);
  }
} finally { await browser.close(); server.kill(); }
console.log(fails.length ? `FAIL ${fails.join('; ')}` : 'done');
process.exit(fails.length ? 1 : 0);
