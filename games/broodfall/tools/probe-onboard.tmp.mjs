// Temporary probe (deleted before commit): first launch → mission 1, screenshots to the scratchpad.
import { chromium } from '@playwright/test';
const OUT = process.env.OUT;
const URL0 = 'http://localhost:5241/';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
await page.goto(URL0, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/p1-first.png` });
console.log('intro?', await page.evaluate(() => !!document.getElementById('intro')), 'url', page.url());
await page.waitForFunction(() => window.__bfBooted, null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/p2-board.png` });
const info = await page.evaluate(() => ({
  hint: document.getElementById('hint')?.textContent,
  goals: document.getElementById('board-goals')?.className,
  under: !document.getElementById('under')?.classList.contains('hidden'),
  menu: document.getElementById('menu')?.className,
  camp: JSON.parse(localStorage.getItem('broodfall-campaign') || 'null')?.onboard,
  pending: localStorage.getItem('broodfall-campaign-pending'),
  s: window.broodfall.summary(),
}));
console.log(JSON.stringify(info, null, 1).slice(0, 1500));
console.log('errors', errors.slice(0, 10));
await browser.close();
