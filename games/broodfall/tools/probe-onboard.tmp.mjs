import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:5241/?seed=1');
await p.evaluate(async () => {
  const c = await import('/src/meta/campaign.ts');
  const s = c.newCampaign(5, { onboarding: true });
  s.onboard.mission1 = 'lost'; s.lastGreeting = 'first-lost'; s.said = ['mate-review', 'catgirl', 'print-body'];
  localStorage.setItem('broodfall-campaign', JSON.stringify(s)); localStorage.setItem('broodfall-intro-seen', '1');
});
await p.goto('http://localhost:5241/');
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => ({ url: location.href, menu: document.getElementById('menu').className, camp: document.getElementById('campaign').className })), errs);
await b.close();
