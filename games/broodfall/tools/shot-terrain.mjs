/**
 * THE LIE OF THE LAND, photographed (Oct 2 2026): the same seeds and tile sets, grown five districts, at the
 * fitted (far) view and closer in. Run once on a build from before the change and once after.
 *
 * Usage: node tools/shot-terrain.mjs <dist-dir> <tag>   (e.g. dist-terrain after)
 * Screenshots: notes/screens/2026-10-02/terrain/terrain-<tag>-<set>-<far|mid>.png
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.argv[2] ?? 'dist-terrain');
const tag = process.argv[3] ?? 'after';
const out = join(root, 'notes', 'screens', '2026-10-02', 'terrain');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5402);
const srv = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', dist, '--port', String(PORT), '--strictPort'], { cwd: root, shell: process.platform === 'win32', stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 12000));
const b = await chromium.launch();
const sets = [['suburb', 3], ['megacity', 7], ['orient', 11], ['farmland', 15]];
try {
  for (const [set, seed] of sets) {
    const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=${set}`);
    await page.waitForFunction(() => window.broodfall?.sim, null, { timeout: 90000 });
    await page.evaluate(() => { window.broodfall.step(60); window.broodfall.growCity?.(5); window.broodfall.step(5); });
    await page.keyboard.press('Home');
    await page.waitForTimeout(1500);
    const box = await page.locator('canvas').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(150); }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `terrain-${tag}-${set}-far.png`) });
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(150); }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `terrain-${tag}-${set}-mid.png`) });
    console.log('shot', set, seed);
    await page.close();
  }
} finally {
  await b.close();
  srv.kill();
}
process.exit(0);
