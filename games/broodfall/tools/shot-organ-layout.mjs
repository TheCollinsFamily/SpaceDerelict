/**
 * THE ORGAN STAGE'S LAYOUT at three window sizes (Collins, Nov 22 2026: "an AWFUL use of screen real
 * estate ... why is it displaying the towers I can place that turn and elements of the main game
 * phase's UI?").
 *
 * Opens the organ stage at wave setup (the bottom bar's ORGANS), grows two organs by real clicks,
 * picks a third, and screenshots it at 1366x768, 1920x1080 and 2781x1401 (his window). Checks:
 * the stage fills the window; the battle HUD (limb hand, wave bar, START THE WAVE) is not shown;
 * the meat it is bought with is shown inside the stage; the whole organ list is on screen with no
 * scroll; the grid is the biggest thing; TO THE SURFACE brings the HUD back.
 *
 * Usage: node tools/shot-organ-layout.mjs <base url of a running dev server> <output folder> [prefix]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5391';
const out = process.argv[3] || 'tools/screenshots';
const prefix = process.argv[4] || 'organ-layout';
mkdirSync(out, { recursive: true });

const SIZES = [[1366, 768], [1920, 1080], [2781, 1401]];
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const visible = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
}, sel);
try {
  for (const [w, h] of SIZES) {
    console.log(`${w}x${h}`);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/?seed=7&autostart=1&speed=0`, { waitUntil: 'load' });
    await page.waitForSelector('#stage canvas', { timeout: 60000 });
    await page.evaluate(() => { window.broodfall.sim.meat.war = 260; window.broodfall.sim.meat.science = 40; });
    await page.waitForTimeout(400);
    check(await visible(page, '#hand'), 'before: the limb hand is shown at wave setup');
    await page.locator('#open-under').click();
    await page.waitForSelector('#under:not(.hidden)');
    await page.waitForFunction(() => document.getElementById('under').classList.contains('scan'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const growAt = async (organ) => {
      await page.locator(`#under-palette [data-organ="${organ}"]`).click();
      const spot = await page.evaluate((id) => {
        const s = window.broodfall.sim;
        for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (s.canBuildOrgan(id, c, r)) return { c, r };
        return null;
      }, organ);
      if (!spot) return false;
      const cell = page.locator(`#under-grid [data-cell="${spot.c}"]`);
      await cell.hover();
      for (let k = 0; k < spot.r; k++) await cell.click({ button: 'right' });
      await cell.click();
      // Esc drops a pick still held (a zone stays picked); with nothing picked it would open Settings.
      if (await page.locator('#under-palette .under-organ.on').count()) await page.keyboard.press('Escape');
      return page.evaluate((id) => window.broodfall.sim.organs.some((o) => o.organ === id), organ);
    };
    check(await growAt('forge'), 'grew a Bone Forge by clicks');
    check(await growAt('heart'), 'grew an Auxiliary Heart by clicks');
    // Pick one and hover the grid, the way a player is mid-placement.
    await page.locator('#under-palette [data-organ="bladder"]').click().catch(() => {});
    const spot = await page.evaluate(() => {
      const s = window.broodfall.sim;
      for (let c = 0; c < s.under.cells.length; c++) if (s.canBuildOrgan('bladder', c, 0)) return c;
      return 0;
    });
    await page.locator(`#under-grid [data-cell="${spot}"]`).hover();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(out, `${prefix}-${w}x${h}.png`) });
    if (w === 1920) {
      // The level-up readout: on the grown forge's card, then on the forge itself on the board.
      if (await page.locator('#under-palette .under-organ.on').count()) await page.keyboard.press('Escape');
      await page.locator('#under-palette [data-organ="forge"]').hover();
      await page.waitForTimeout(300);
      const cardText = await page.locator('#under-status').innerText();
      check(/LV 2 for \d+W/i.test(cardText), `hovering the grown forge's card says the next level's price and gain ("${cardText.slice(0, 80)}")`);
      await page.screenshot({ path: join(out, `${prefix}-${w}x${h}-card-hover.png`) });
      const fc = await page.evaluate(() => window.broodfall.sim.organs.find((o) => o.organ === 'forge').cells[0]);
      await page.locator(`#under-grid [data-cell="${fc}"]`).hover();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `${prefix}-${w}x${h}-grid-hover.png`) });
    }

    const m = await page.evaluate(() => {
      const r = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
      const pal = document.getElementById('under-palette');
      const card = r('#under-card');
      const grid = r('#under-grid');
      const cards = [...document.querySelectorAll('#under-palette .under-organ')].map((b) => b.getBoundingClientRect());
      const allOnScreen = cards.every((c) => c.top >= 0 && c.bottom <= innerHeight + 1 && c.left >= 0 && c.right <= innerWidth + 1);
      const scrollers = [...document.querySelectorAll('#under, #under *')].filter((el) => el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY));
      const nameSize = parseFloat(getComputedStyle(document.querySelector('#under-palette .under-organ b')).fontSize);
      return {
        card: card && { w: card.width, h: card.height }, grid: grid && { w: grid.width, h: grid.height },
        allOnScreen, scrollers: scrollers.map((e) => e.id || e.className), nameSize, cards: cards.length,
        palH: pal.scrollHeight, meat: document.getElementById('under-meat')?.innerText ?? '', war: Math.floor(window.broodfall.sim.meat.war),
      };
    });
    console.log('   ', JSON.stringify(m));
    check(m.card && m.card.w >= w * 0.95 && m.card.h >= h * 0.9, `the stage fills the window (${Math.round(m.card?.w)}x${Math.round(m.card?.h)})`);
    check(m.allOnScreen && m.scrollers.length === 0, `all ${m.cards} organs are on screen with no scroll`);
    check(m.grid && m.grid.w * m.grid.h >= w * h * 0.25, `the grid is big (${Math.round(m.grid?.w)}x${Math.round(m.grid?.h)})`);
    check(m.nameSize >= 11, `organ names are readable (${m.nameSize}px)`);
    check(m.meat.replace(/\s+/g, ' ').includes(`WAR ${m.war}`), `the war meat shows in the stage ("${m.meat.replace(/\s+/g, ' ')}")`);
    for (const sel of ['#hand', '#call-early', '#biomass-wrap', '#botbar', '#topbar']) check(!(await visible(page, sel)), `${sel} is not shown in the organ stage`);
    await page.locator('#under-done').click();
    await page.waitForTimeout(400);
    check(await visible(page, '#hand') && await visible(page, '#call-early'), 'TO THE SURFACE brings the hand and START THE WAVE back');
    check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
