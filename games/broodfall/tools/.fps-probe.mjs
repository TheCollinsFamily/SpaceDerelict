import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const PORT = 5319;
const dev = spawn('npx.cmd', ['vite', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), shell: true, env: { ...process.env, BROODFALL_NO_HMR: '1' } });
await new Promise((r) => dev.stdout.on('data', (d) => { if (String(d).includes('localhost')) r(); }));
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('broodfall-intro-seen', '1'); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=1&biome=suburb`);
await page.waitForFunction(() => window.broodfall?.sim, null, { timeout: 60000 });
await page.waitForTimeout(3000);
const fps = () => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
await page.evaluate(() => { setInterval(() => { const s = window.broodfall.sim; if (s.phase === 'growth') s.phaseElapsed = 0; }, 200); });
console.log('stage1 fps', await fps());
for (const [g, k] of [[6, 2], [18, 3], [40, 4]]) {
  await page.evaluate((x) => { window.broodfall.sim.stats.limbsGrown = x; }, g);
  await page.waitForFunction((k) => { const c = window.broodfall.coreStage(); return c.stage === k && c.into === 0; }, k, { timeout: 20000 });
  await page.waitForTimeout(500);
  console.log(`stage${k} fps`, await fps(), await fps(), await fps());
}
await browser.close(); dev.kill(); process.exit(0);
