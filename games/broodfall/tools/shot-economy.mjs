/**
 * CHYME, PLAYED IN THE REAL PAGE (Nov 22 2026; DESIGN.md "Chyme"). A skirmish on seed 7, four waves: limbs placed with
 * the war meat the bodies paid, the wave started with START THE WAVE, the run stepped (window.broodfall.step) while the
 * HUD's CHYME counter ticks up as the creep digests; at every clear the banner's tally, then the organ stage that opens
 * by itself, organs grown and levelled by real clicks on its cards and cells with the chyme the wave earned.
 *
 * Screens: economy-<n>-*.png in the output folder (HUD crops of the accrual, the clear's banner, the organ stage before
 * and after buying, a level card's readout). Prints what each wave earned and what was bought.
 *
 * Usage: node tools/shot-economy.mjs <base url of a running dev server> <output folder>
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5389';
const out = process.argv[3] || 'tools/screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name, clip) => page.screenshot({ path: join(out, `economy-${name}.png`), ...(clip ? { clip } : {}) });
const topbar = async () => page.evaluate(() => { const r = document.getElementById('topbar').getBoundingClientRect(); return { x: 0, y: 0, width: Math.min(1920, r.width), height: r.height + 4 }; });
const S = () => page.evaluate(() => { const s = window.broodfall.sim; return { phase: s.phase, wave: s.waveNumber, chyme: s.chyme, waveChyme: s.waveChyme, war: s.meat.war, sci: s.meat.science, organs: s.organs.map((o) => `${o.organ}${o.level > 1 ? ` LV${o.level}` : ''}`), limbs: s.towers.length, outcome: s.outcome, tally: s.lastChymeTally, core: Math.round(100 * s.coreHp / s.coreMaxHp) }; });

/** Spend the war meat on the hand the way a player would: affordable cards on buildable roofs near the incoming gate. */
async function placeLimbs() {
  return page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    let n = 0;
    for (let guard = 0; guard < 12; guard++) {
      let placed = false;
      for (let k = 0; k < s.hand.length && !placed; k++) {
        // Roofs nearest the gate the wave is coming from first (play() refuses a card the purse cannot pay).
        const g = s.cellCenter(s.incomingGates[0] ?? s.gates[0]);
        const cells = b.buildableCells(400).sort((a, c) => { const pa = s.cellCenter(a), pc = s.cellCenter(c); return Math.hypot(pa.x - g.x, pa.y - g.y) - Math.hypot(pc.x - g.x, pc.y - g.y); });
        for (const cell of cells) { if (b.play({ kind: 'build', cardIndex: k, cell }).ok) { placed = true; n++; break; } }
      }
      if (!placed) break;
    }
    return n;
  });
}

/** Grow an organ by clicks: its card, then the first cell it fits (turned with right-clicks as needed). */
async function growByClicks(organ) {
  const card = page.locator(`#under-palette [data-organ="${organ}"]`);
  if (!(await card.count())) return false;
  await card.click();
  // Unturned placements first (a turn moves the shape under the pointer: src/ui/organPlace.ts), a few tries.
  const spots = await page.evaluate((id) => {
    const s = window.broodfall.sim;
    const out = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < s.under.cells.length; c++) if (s.canBuildOrgan(id, c, r)) out.push({ c, r });
    return out.slice(0, 6);
  }, organ);
  for (const spot of spots) {
    const cell = page.locator(`#under-grid [data-cell="${spot.c}"]`);
    await cell.hover();
    for (let k = 0; k < spot.r; k++) await cell.click({ button: 'right' });
    await cell.click();
    if (await page.evaluate((id) => window.broodfall.sim.organs.some((o) => o.organ === id), organ)) {
      if (await page.locator('#under-palette .under-organ.on').count()) await page.keyboard.press('Escape');
      return true;
    }
    await page.waitForTimeout(150);
    if (!(await page.locator('#under-palette .under-organ.on').count())) await card.click();
  }
  if (await page.locator('#under-palette .under-organ.on').count()) await page.keyboard.press('Escape');
  return false;
}

const log = [];
try {
  await page.goto(`${base}/?seed=7&autostart=1&speed=0`, { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot('0-setup-hud', await topbar());
  const want = [['gut'], ['forge'], ['bladder', 'pacemaker'], ['heart', 'lattice']];
  for (let wave = 1; wave <= 4; wave++) {
    const placed = await placeLimbs();
    const before = await S();
    await page.locator('#call-early').click();
    // Step the wave in chunks; catch the HUD while the counter is climbing.
    let caught = false;
    for (let i = 0; i < 200; i++) {
      await page.evaluate(() => window.broodfall.step(60));
      const s = await S();
      if (!caught && s.phase === 'siege' && s.waveChyme >= 3) {
        await page.waitForTimeout(120);
        await shot(`${wave}-a-accrual-hud`, await topbar());
        await shot(`${wave}-a-accrual-full`);
        caught = true;
      }
      if (s.phase !== 'siege' || s.outcome !== 'playing') break;
    }
    // A draft may open at the clear (every third wave): take the offer's own place.
    await page.evaluate(() => { const s = window.broodfall.sim; while (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0 }); });
    // Let the page's own loop run: the organ stage opens by itself, its head row the clear's tally.
    await page.waitForSelector('#under:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(2600);
    const atStage = await S();
    await shot(`${wave}-c-organ-stage`);
    const bought = [];
    for (const id of want[wave - 1] ?? []) if (await growByClicks(id)) bought.push(id);
    // From the third stage on: level the meteor by clicking its card if the chyme covers it.
    if (wave >= 3) {
      await page.locator('#under-palette [data-organ="core"]').hover();
      await page.waitForTimeout(300);
      await shot(`${wave}-d-level-readout`);
      const lv = await page.evaluate(() => window.broodfall.sim.coreLevel);
      await page.locator('#under-palette [data-organ="core"]').click();
      if (await page.evaluate((l) => window.broodfall.sim.coreLevel > l, lv)) bought.push('meteor LV');
    }
    await page.waitForTimeout(400);
    await shot(`${wave}-e-organ-stage-after`);
    const after = await S();
    log.push(`wave ${wave}: placed ${placed} limbs (war ${Math.floor(before.war)} before) · cleared: core ${atStage.core}% · tally ${JSON.stringify(atStage.tally)} · chyme at the stage ${Math.floor(atStage.chyme)} · bought ${bought.join(', ') || 'nothing'} · chyme left ${Math.floor(after.chyme)} · war ${Math.floor(after.war)} · organs ${after.organs.join(', ')}`);
    await page.locator('#under-done').click();
    await page.waitForTimeout(300);
    if (after.outcome !== 'playing') break;
  }
  await shot('5-setup-hud-after', await topbar());

  // MISSION 1 (plain mode: war only, one thing at a time): a fresh profile goes straight into it. The CHYME counter
  // stays hidden until the first body is digested, then comes in; the organ stage after wave 1 shows the tally.
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('broodfall-intro-seen', '1'); } catch { /* ok */ } });
  const m1 = await ctx.newPage();
  m1.on('pageerror', (e) => errors.push(String(e)));
  await m1.goto(`${base}/`, { waitUntil: 'load' });
  // The opening film is marked seen, so the console menu: NEW CAMPAIGN starts mission 1.
  await m1.locator('#menu-new').click({ timeout: 60000 });
  await m1.waitForFunction(() => window.broodfall?.sim && document.getElementById('boot')?.classList.contains('hidden'), null, { timeout: 120000 });
  await m1.waitForTimeout(1200);
  const hidden = await m1.evaluate(() => getComputedStyle(document.getElementById('meat-chyme')).display === 'none' && document.body.classList.contains('first-mission'));
  await m1.evaluate(() => {
    const b = window.broodfall;
    for (let k = 0; k < b.sim.hand.length; k++) for (const cell of b.buildableCells(400)) if (b.play({ kind: 'build', cardIndex: k, cell }).ok) break;
  });
  await m1.screenshot({ path: join(out, 'economy-m1-0-start.png') });
  await m1.evaluate(() => window.broodfall.play({ kind: 'call-early' }));
  let shown = false;
  for (let i = 0; i < 200; i++) {
    await m1.evaluate(() => window.broodfall.step(60));
    const st = await m1.evaluate(() => ({ phase: window.broodfall.sim.phase, ch: window.broodfall.sim.chyme, out: window.broodfall.sim.outcome }));
    if (!shown && st.ch >= 1) {
      await m1.waitForTimeout(600);
      shown = await m1.evaluate(() => getComputedStyle(document.getElementById('meat-chyme')).display !== 'none');
      await m1.screenshot({ path: join(out, 'economy-m1-a-chyme-revealed.png') });
    }
    if (st.phase !== 'siege' || st.out !== 'playing') break;
  }
  await m1.waitForSelector('#under:not(.hidden)', { timeout: 10000 }).catch(() => {});
  await m1.waitForTimeout(2600);
  await m1.screenshot({ path: join(out, 'economy-m1-b-organ-stage.png') });
  log.push(`mission 1: chyme hidden at the start ${hidden}, shown once the first body was digested ${shown}`);
  await ctx.close();
} finally {
  console.log(log.join('\n'));
  console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'no page errors');
  await browser.close();
}
