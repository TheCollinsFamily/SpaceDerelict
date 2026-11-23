/**
 * The EAT A LIMB explainer (src/ui/sacrificeExplainer.ts) and the skirmish ORDER picker (src/main.ts
 * wireOrderPicker), checked in the real page: headless, muted, on a dev server of its own.
 *
 *   BROODFALL_NO_HMR=1 npx vite --port 5322 --strictPort
 *   node tools/shot-explain.mjs [port]
 *
 * Pictures: notes/screens/2026-11-23/explain/. Exits non-zero on a failure.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, '..');
const PORT = Number(process.argv[2] ?? 5322);
const BASE = `http://localhost:${PORT}/`;
const outDir = join(game, 'notes', 'screens', '2026-11-23', 'explain');
mkdirSync(outDir, { recursive: true });
const failures = [];
const pass = (n) => console.log(`  PASS  ${n}`);
const fail = (n, d) => { failures.push(n); console.log(`  FAIL  ${n} — ${d}`); };
const check = (ok, n, d = '') => (ok ? pass(n) : fail(n, d));

const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });

/** A fresh browser (empty storage); `human` hides navigator.webdriver, as a player's browser has none. */
async function fresh(human) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (human) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}

async function startRun(page, query) {
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.broodfall && document.querySelectorAll('#hand .card').length > 0, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
}

/** One limb standing (placed by the play API), and the first card a block limb. */
async function oneLimb(page) {
  return page.evaluate(() => {
    const bf = window.broodfall, s = bf.sim;
    s.meat.war = 60;
    for (let g = 0; g < 300 && ['spine', 'swamp'].includes(s.hand[0].family); g++) s.issue({ kind: 'discard', cardIndex: 0 });
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c)) return bf.play({ kind: 'build', cardIndex: 0, cell: c }).ok;
    return false;
  });
}

const popup = (page) => page.locator('#explain-sacrifice');

// 1. A player's browser, a skirmish: the first card picked up with nothing on the board shows nothing; with a limb standing, the pop-up.
{
  const { ctx, page, errors } = await fresh(true);
  await startRun(page, '?seed=11&autostart=1&landing=0');
  await page.locator('#hand .card').first().click();
  await page.waitForTimeout(400);
  check(!(await popup(page).count()), 'no pop-up on the first card of the game (nothing to eat)');
  await page.keyboard.press('Escape');
  check(await oneLimb(page), 'a limb stands');
  await page.locator('#hand .card').first().click();
  await page.waitForSelector('#explain-sacrifice', { timeout: 3000 }).catch(() => {});
  check(await popup(page).isVisible(), 'pop-up shows when a card is picked up with a limb standing');
  const t0 = await page.evaluate(() => window.broodfall.sim.time);
  await page.waitForTimeout(1500);
  const v = await page.evaluate(() => { const el = document.querySelector('#explain-sacrifice video'); return { rs: el.readyState, t: el.currentTime, paused: el.paused, src: el.currentSrc, w: el.videoWidth, d: el.duration }; });
  await page.waitForTimeout(1000);
  const v2 = await page.evaluate(() => document.querySelector('#explain-sacrifice video').currentTime);
  console.log('   video', JSON.stringify(v), 'then', v2);
  check(v.rs >= 3 && v.w > 0 && !v.paused && v2 !== v.t, 'the film loads and plays (readyState, time advancing)', JSON.stringify(v));
  const t1 = await page.evaluate(() => window.broodfall.sim.time);
  check(t1 === t0, 'the run is paused while it is open', `${t0} -> ${t1}`);
  await page.screenshot({ path: join(outDir, 'explain-popup.png') });
  await page.locator('#explain-sacrifice .xs-card').screenshot({ path: join(outDir, 'explain-popup-card.png') });
  // Space must not start the wave behind it: it closes the pop-up only.
  const wave0 = await page.evaluate(() => window.broodfall.sim.waveNumber);
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);
  check(!(await popup(page).count()), 'Space closes it');
  const after = await page.evaluate(() => ({ wave: window.broodfall.sim.waveNumber, phase: window.broodfall.sim.phase, card: document.querySelector('#hand .card.selected') !== null }));
  check(after.wave === wave0 && after.phase === 'growth', 'Space did not start the wave behind it', JSON.stringify(after));
  await page.waitForTimeout(800);
  const t2 = await page.evaluate(() => window.broodfall.sim.time);
  check(t2 > t1, 'the clock runs again after it closes', `${t1} -> ${t2}`);
  const flag = await page.evaluate(() => localStorage.getItem('broodfall-explain-sacrifice-seen'));
  check(flag === '1', 'seen flag stored', String(flag));
  await page.keyboard.press('Escape');
  await page.locator('#hand .card').nth(1).click();
  await page.waitForTimeout(500);
  check(!(await popup(page).count()), 'not again on this page');
  await startRun(page, '?seed=12&autostart=1&landing=0');
  await oneLimb(page);
  await page.locator('#hand .card').first().click();
  await page.waitForTimeout(600);
  check(!(await popup(page).count()), 'not again after a reload (seen)');
  check(!errors.length, 'no console errors (player browser)', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// 2. Esc and the OK button close it too; a driven browser never sees it unless ?explain=sacrifice.
{
  const { ctx, page, errors } = await fresh(false);
  await startRun(page, '?seed=11&autostart=1&landing=0');
  await oneLimb(page);
  await page.locator('#hand .card').first().click();
  await page.waitForTimeout(600);
  check(!(await popup(page).count()), 'automation (navigator.webdriver) never sees it');
  await page.keyboard.press('Escape');
  await startRun(page, '?seed=11&autostart=1&landing=0&explain=sacrifice');
  await oneLimb(page);
  await page.locator('#hand .card').first().click();
  await page.waitForSelector('#explain-sacrifice', { timeout: 3000 }).catch(() => {});
  check(await popup(page).isVisible(), '?explain=sacrifice forces it under automation');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ open: !!document.querySelector('#explain-sacrifice'), settings: !!document.querySelector('#settings:not(.hidden), .settings-screen:not(.hidden)'), card: window.broodfall.hud.selectedCard }));
  check(!st.open, 'Esc closes it', JSON.stringify(st));
  await startRun(page, '?seed=11&autostart=1&landing=0&explain=sacrifice');
  await oneLimb(page);
  await page.locator('#hand .card').first().click();
  await page.waitForSelector('#explain-sacrifice', { timeout: 3000 }).catch(() => {});
  await page.locator('#explain-sacrifice .xs-ok').click();
  await page.waitForTimeout(400);
  check(!(await popup(page).count()), 'OK closes it');
  await startRun(page, '?seed=11&autostart=1&landing=0&auto=1&explain=sacrifice');
  check(true, 'auto=1 page loads with the explainer param');
  check(!errors.length, 'no console errors (driven browser)', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// 3. The ORDER picker beside SKIRMISH: four choices, a line and a length each, kept, and the run deploys with it.
{
  const { ctx, page, errors } = await fresh(false);
  await page.goto(BASE + '?menu=1', { waitUntil: 'load' });
  await page.waitForSelector('#menu-orders .order-opt', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const names = await page.locator('#menu-orders .order-opt').allTextContents();
  check(names.join('|') === 'HOLD|KILL THE ROYAL|BANK SCIENCE|RANDOM', 'four orders', names.join('|'));
  const on0 = await page.locator('#menu-orders .order-opt.on').textContent();
  check(on0 === 'RANDOM', 'RANDOM until one is picked', on0);
  await page.locator('#menu-orders .order-opt', { hasText: 'KILL THE ROYAL' }).click();
  const line = await page.locator('#menu-orders .order-line').textContent();
  console.log('   line:', line);
  check(/royal/i.test(line) && /wave/i.test(line), 'the line and length follow the pick', line);
  await page.screenshot({ path: join(outDir, 'order-picker-menu.png') });
  await page.locator('.menu-console').screenshot({ path: join(outDir, 'order-picker-console.png') });
  for (const n of ['HOLD', 'BANK SCIENCE']) {
    await page.locator('#menu-orders .order-opt', { hasText: n }).hover();
    await page.waitForTimeout(150);
    console.log(`   hover ${n}:`, await page.locator('#menu-orders .order-line').textContent());
  }
  await page.mouse.move(5, 5);
  check(await page.evaluate(() => localStorage.getItem('broodfall-skirmish-order')) === 'royal', 'the pick is kept');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#menu-orders .order-opt.on', { timeout: 60000 });
  check(await page.locator('#menu-orders .order-opt.on').textContent() === 'KILL THE ROYAL', 'kept across a reload');
  await page.locator('#menu-deploy').click();
  await page.waitForFunction(() => !!window.broodfall && document.querySelectorAll('#hand .card').length > 0, null, { timeout: 120000 });
  const d = await page.evaluate(() => ({ dir: window.broodfall.sim.directive, url: location.search }));
  console.log('   deployed', JSON.stringify(d));
  check(d.dir.kind === 'royal', 'SKIRMISH deploys with the picked order', JSON.stringify(d));
  check(!errors.length, 'no console errors (menu)', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join(', ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
