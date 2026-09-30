import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const ROOT = 'C:/Users/Merry/dev/space-derelict/games/broodfall';
const SP = 'C:/Users/Merry/AppData/Local/Temp/claude/C--Users-Merry/9f6805d0-d502-4823-9f19-e7a2729053cc/scratchpad';
const OUT = ROOT + '/notes/screens/2026-09-30';
const PORT = 5291;
const server = spawn('npx.cmd', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe', shell: true });
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('localhost')) res(); }));
const browser = await chromium.launch();
const errors = [];
try {
  for (const route of ['delegation', 'faithful', 'institute']) {
    const state = readFileSync(`${SP}/state-${route}.json`, 'utf8');
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('pageerror', (e) => errors.push(`${route}: ${e.message}`));
    await page.goto(`http://localhost:${PORT}/`);
    await page.evaluate((s) => { localStorage.setItem('broodfall-campaign', s); localStorage.setItem('broodfall-intro-seen', '1'); }, state);
    await page.goto(`http://localhost:${PORT}/?campaign=ship`);
    await page.waitForTimeout(2500);
    // Whatever stands between the page and the ship (a greeting, the menu), click through it.
    for (let i = 0; i < 6; i++) {
      if (await page.locator('.cp-scene-card').count()) break;
      const btn = page.locator('button:visible', { hasText: /CAMPAIGN|CONTINUE|SKIP|CLOSE|OK/i }).first();
      if (await btn.count()) await btn.click().catch(() => {}); else await page.mouse.click(800, 450);
      await page.waitForTimeout(1200);
    }
    const titles = [];
    for (let i = 0; i < 2; i++) {
      const card = page.locator('.cp-scene-card');
      if (!(await card.count())) break;
      titles.push(await card.locator('.cp-sub').innerText());
      await page.screenshot({ path: `${OUT}/reveal-${route}-${i + 1}.png` });
      await card.locator('[data-act="scene-ok"]').click();
      await page.waitForTimeout(800);
    }
    console.log(route, JSON.stringify(titles));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  spawn('taskkill', ['/PID', String(server.pid), '/T', '/F']);
}
console.log(errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : 'no page errors');
