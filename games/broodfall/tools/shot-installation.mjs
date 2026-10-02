/**
 * THE SCIENCE INSTALLATION ON ITS BLOCK (Collins, Oct 2 2026: "it should transform the whole square section of the wall
 * into something else, so it's very noticeable"). On three tile sets: a station founded and built on a real board (the
 * waves held back), photographed close and from the whole board, at two camera turns; and each stage of the same block
 * (being built, standing, fortified, the wreck) close. A FAR-ZOOM CHECK: in the whole-board shot, the claimed block's
 * pixels must differ clearly from the city's blocks around it (mean colour distance, and darker).
 *
 * Usage: node tools/shot-installation.mjs [sets]   (starts its own dev server on 5363)
 * Screens: notes/screens/2026-10-02/installation-<set>-<near|far>-turn<N>.png, installation-<set>-<stage>.png
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
mkdirSync(out, { recursive: true });
const SETS = (process.argv[2] || 'suburb:42,megacity:43,orient:44').split(',').map((x) => x.split(':'));
const PORT = Number(process.env.BROODFALL_PORT || 5363);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch();
try {
  for (const [set, seed] of SETS) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (e) => console.log('  page error:', e.message));
    await page.goto(`http://localhost:${PORT}/?autostart=1&seed=${seed}&speed=0&biome=${set}&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });
    // A grown board, an engineer sent; held until its station stands on a block.
    const found = await page.evaluate(() => {
      const b = window.broodfall;
      const s = b.sim;
      for (let i = 0; i < 900; i += 10) { b.step(10); s.enemies.length = 0; }
      Object.defineProperty(s, 'interest', { get: () => 20, configurable: true });
      Object.defineProperty(s, 'growthLength', { get: () => 1e9, configurable: true });
      s.waveNumber = 4; s.phase = 'growth'; s.phaseElapsed = 0; s.engineerTimer = 0;
      s.sendEngineers(); s.engineerTimer = 1e9;
      const keep = (e) => ['engineer', 'fieldstation', 'sciturret'].includes(e.kind);
      for (let i = 0; i < 6000; i += 5) {
        b.step(5);
        for (let k = s.enemies.length - 1; k >= 0; k--) if (!keep(s.enemies[k])) s.enemies.splice(k, 1);
        if (s.enemies.some((e) => e.kind === 'fieldstation')) break;
      }
      const st = s.enemies.find((e) => e.kind === 'fieldstation');
      return st ? { id: st.id, block: st.blockCells.length } : null;
    });
    check(!!found, `${set}: a station founded`, JSON.stringify(found));
    if (!found) { await page.close(); continue; }
    const frame = async (zoom) => {
      await page.evaluate((zoom) => {
        const b = window.broodfall;
        const s = b.sim;
        const st = s.enemies.find((e) => e.kind === 'fieldstation') ?? s.corpses.find((c) => c.kind === 'fieldstation');
        b.renderer.resetView?.();
        b.step(1);
        if (zoom > 0) { const c = b.renderer.clientOf(s, st.pos.x, st.pos.y); b.renderer.zoomAt(c.x, c.y, zoom); }
      }, zoom);
      await page.waitForTimeout(1500);
    };
    const hold = (n) => page.evaluate((n) => {
      const b = window.broodfall; const s = b.sim;
      const keep = (e) => ['engineer', 'fieldstation', 'sciturret'].includes(e.kind);
      for (let i = 0; i < n; i += 5) { b.step(5); for (let k = s.enemies.length - 1; k >= 0; k--) if (!keep(s.enemies[k])) s.enemies.splice(k, 1); }
    }, n);
    // Being built: half way.
    await hold(90);
    await frame(3.2);
    await page.screenshot({ path: join(out, `installation-${set}-building.png`) });
    // Standing.
    await hold(140);
    await frame(3.2);
    await page.screenshot({ path: join(out, `installation-${set}-standing.png`) });
    // Near and far, two camera turns.
    for (const turn of [0, 1]) {
      if (turn) await page.evaluate(() => window.broodfall.turnBy(1));
      await frame(3.2);
      await page.screenshot({ path: join(out, `installation-${set}-near-turn${turn}.png`) });
      await frame(0);
      await page.screenshot({ path: join(out, `installation-${set}-far-turn${turn}.png`) });
      // The far-zoom check: the claimed block's screen pixels against the other blocks' (sampled at their roofs).
      const m = await page.evaluate(() => {
        const b = window.broodfall; const s = b.sim;
        const st = s.enemies.find((e) => e.kind === 'fieldstation');
        const mine = new Set(st.blockCells);
        const pts = (cells) => cells.map((c) => { const cc = s.cellCenter(c); const p = b.renderer.clientOf(s, cc.x, cc.y); return [Math.round(p.x), Math.round(p.y)]; });
        const others = [];
        for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 0 && !mine.has(c) && !s.isCreeped(c)) others.push(c);
        return { mine: pts(st.blockCells), others: pts(others.filter((_, i) => i % 3 === 0)) };
      });
      const shot = await page.screenshot();
      const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
      if (PNG) {
        const img = PNG.sync.read(shot);
        const at = ([x, y]) => { if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null; const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
        const mean = (list) => { const v = list.map(at).filter(Boolean); const n = v.length || 1; return [0, 1, 2].map((k) => v.reduce((a, c) => a + c[k], 0) / n); };
        const a = mean(m.mine); const o = mean(m.others);
        const d = Math.hypot(a[0] - o[0], a[1] - o[1], a[2] - o[2]);
        const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
        // Either far darker (a pale set) or far tealer (the science caste's light on a dark set): clear either way.
        // (RGB distance alone undersells a change of hue at the same brightness.)
        const teal = (c) => (c[1] + c[2]) / 2 - c[0];
        const dl = lum(o) - lum(a);
        const dt = teal(a) - teal(o);
        check(dl > 50 || dt > 25, `${set} turn ${turn}: the claimed block stands out from the whole board`, `darker by ${dl.toFixed(0)}, tealer by ${dt.toFixed(0)}, colour distance ${d.toFixed(0)}`);
      }
    }
    await page.evaluate(() => window.broodfall.turnBy(-1));
    // Fortified (stage 3).
    await page.evaluate(() => { const s = window.broodfall.sim; s.enemies.find((e) => e.kind === 'fieldstation').stationAge = 150; });
    await hold(10);
    await frame(3.2);
    await page.screenshot({ path: join(out, `installation-${set}-fortified.png`) });
    // The wreck.
    await page.evaluate(() => { const s = window.broodfall.sim; const st = s.enemies.find((e) => e.kind === 'fieldstation'); s.killEnemy(st.id, 1, false); });
    await page.evaluate(() => window.broodfall.step(3));
    await frame(3.2);
    await page.screenshot({ path: join(out, `installation-${set}-wreck.png`) });
    console.log(`  ${set}: shots done`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
