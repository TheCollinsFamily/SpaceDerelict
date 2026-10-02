/**
 * THE WALL BEFORE IT IS PLACED (Collins, Oct 2 2026: "walls should have a shadow over where they are going to appear
 * when placing so it's not surprising to users"; and "a wall covering two spaces should be two wall images chained,
 * not a giant one"). Holds a Spine Wall card over a one-wide and a two-wide street (the real pointer, the real card
 * click), photographs the faint chain of segments it shows, then places it and photographs the wall it built.
 *
 * Usage: node tools/shot-wall-ghost.mjs [set] [seed]   (needs a build in dist-walls: node tools/shot-walls.mjs builds it)
 * Screenshots: notes/screens/2026-10-02/wall-ghost-<set>-<narrow|wide>-<ghost|placed>.jpg
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const screens = join(root, 'notes', 'screens', '2026-10-02');
mkdirSync(screens, { recursive: true });
const set = process.argv[2] || 'suburb';
const seed = process.argv[3] || '11';
const PORT = 5397;
const srv = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', 'dist-walls', '--port', String(PORT), '--strictPort'], { cwd: root, shell: process.platform === 'win32', stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 4000));
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const fails = [];
try {
  await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=${set}`);
  await page.waitForFunction(() => window.broodfall?.sim, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.broodfall.step(900);
    const s = window.broodfall.sim;
    Object.defineProperty(s, 'creepRangeCells', { get: () => 99, configurable: true });
    window.broodfall.step(60);
    s.meat.war = 9000;
  });
  for (const kind of ['narrow', 'wide']) {
    const want = kind === 'narrow' ? 1 : 2;
    const target = await page.evaluate((want) => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      const cands = [];
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== 1) continue;
        const g = s.groundFor(c, 'spine');
        if (g && g.length === want) cands.push({ c, g });
      }
      cands.sort((a, b) => d(a.c) - d(b.c));
      const t = cands[0];
      if (!t) return null;
      // A Spine Wall card in hand, first slot.
      s.hand[0] = { id: 930000 + want, family: 'spine', free: true };
      const cc = s.cellCenter(t.c);
      return { cell: t.c, cells: t.g, x: cc.x, y: cc.y };
    }, want);
    if (!target) { fails.push(`${kind}: no street of that width`); continue; }
    await page.evaluate(() => window.broodfall.step(1));
    // Centre the view on it, then pick the card up and hold it over the cell.
    await page.locator('.card').first().click();
    const box = await page.locator('canvas').first().boundingBox();
    const raw = await page.evaluate(({ x, y }) => window.broodfall.worldToScreen(x, y), target);
    const at = { x: box.x + (raw.x / raw.vw) * box.width, y: box.y + (raw.y / raw.vh) * box.height };
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(screens, `wall-ghost-${set}-${kind}-ghost.png`) });
    await page.mouse.click(at.x, at.y);
    await page.evaluate(() => window.broodfall.step(2));
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(screens, `wall-ghost-${set}-${kind}-placed.png`) });
    const built = await page.evaluate((cell) => {
      const s = window.broodfall.sim;
      const t = s.towers.find((x) => x.family === 'spine' && s.cellsOf(x).includes(cell));
      return t ? s.cellsOf(t) : null;
    }, target.cell);
    const same = built && JSON.stringify([...built].sort()) === JSON.stringify([...target.cells].sort());
    console.log(`${kind}: previewed ${JSON.stringify(target.cells)} built ${JSON.stringify(built)} ${same ? 'SAME' : 'DIFFERENT'}`);
    if (!same) fails.push(`${kind}: built ground differs from the preview`);
  }
} finally {
  await b.close();
  srv.kill();
}
for (const f of ['narrow', 'wide']) for (const k of ['ghost', 'placed']) {
  const png = join(screens, `wall-ghost-${set}-${f}-${k}.png`);
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', png.replace(/\.png$/, '.jpg')]);
  spawnSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', png] : [png]);
}
if (fails.length) { console.log('FAIL', fails); process.exit(1); }
console.log('ok');
process.exit(0);
