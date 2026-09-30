// Temporary probe (deleted before the end): play mission 1 like a newcomer, screenshots at each new screen.
import { chromium } from '@playwright/test';
const OUT = process.env.OUT;
const URL0 = 'http://localhost:5241/';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL0, { waitUntil: 'load' });
await page.waitForSelector('#intro', { timeout: 10000 });
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 90000 });
await page.waitForTimeout(1500);
const log = [];
let shots = 0;
for (let round = 0; round < 60; round++) {
  const st = await page.evaluate(() => {
    const b = window.broodfall; const s = b.sim;
    // Build what can be afforded, as a player would: cards on blocks by the street.
    let built = 0;
    for (let k = 0; k < 6; k++) {
      const i = s.hand.findIndex((c) => c.free || s.canAfford((window.__spec ?? {})[c.family] ?? {}) );
      const cells = b.buildableCells(800);
      let ok = false;
      for (let ci = 0; ci < s.hand.length && !ok; ci++) {
        for (const cell of cells) {
          const r = s.issue({ kind: 'build', cardIndex: ci, cell });
          if (r.ok) { ok = true; built++; break; }
          if (r.err === 'cannot afford') break;
        }
      }
      if (!ok) break;
    }
    return { built, phase: s.phase, wave: s.waveNumber, outcome: s.outcome, towers: s.towers.length, war: s.meat.war, sci: s.meat.science, core: Math.round(s.coreHp), under: !document.getElementById('under').classList.contains('hidden'), draft: !document.getElementById('draft').classList.contains('hidden'), hint: document.getElementById('hint').textContent };
  });
  log.push(JSON.stringify(st));
  if ((st.under || st.draft) && shots < 4) { await page.screenshot({ path: `${OUT}/play-${st.under ? 'under' : 'draft'}-${st.wave}.png` }); shots++; }
  if (st.outcome !== 'playing') break;
  if (st.draft) await page.evaluate(() => document.querySelector('.draft-option')?.click());
  await page.evaluate(() => window.broodfall.surface());
  await page.evaluate(() => window.broodfall.step(150));
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/play-end.png` });
console.log(log.filter((_, i) => i % 3 === 0).join('\n'));
console.log('end', await page.evaluate(() => window.broodfall.summary().outcome), errors.slice(0, 5));
await browser.close();
