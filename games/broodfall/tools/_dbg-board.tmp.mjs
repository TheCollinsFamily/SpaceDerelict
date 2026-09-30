import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type()==='warning') console.log('CONSOLE', m.text().slice(0, 200)); });
await page.addInitScript(() => { localStorage.setItem('broodfall-intro-seen', '1'); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); });
await page.goto('http://localhost:5293/?campaign=ship&open=1', { timeout: 120000 });
await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 60000 });
await page.waitForTimeout(1500);
console.log('fault', await page.evaluate(() => document.getElementById('fault')?.className + ' ' + document.getElementById('fault')?.textContent?.slice(0, 300)));
for (const r of ['desk', 'board', 'comms', 'board']) {
  await page.locator(`[data-room="${r}"]`).click({ force: true });
  const log = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const v = document.querySelector('#campaign > video.room-loop');
      out.push(v ? `${v.currentTime.toFixed(2)}/${v.readyState}/${v.paused ? 'P' : 'p'}/${v.networkState}` : 'none');
      await new Promise((r) => setTimeout(r, 300));
    }
    return out.join(' ');
  });
  console.log(r, log);
}
await browser.close();
