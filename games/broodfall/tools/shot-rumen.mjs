/**
 * THE RUMEN, PLAYED IN THE REAL PAGE (Nov 22 2026; DESIGN.md "THE RUMEN"). A skirmish on seed 7: limbs placed with the
 * war the bodies paid, waves started and stepped (window.broodfall.step); in the organ stage the Gut and the Bone Forge,
 * then THE RUMEN, picked from its card and hovered over a poor spot and a rich one (the readout says what each would
 * make), grown by a click at the rich one; the next waves' tallies name its share; the grown Rumen hovered.
 *
 * Screens: economy-organ-*.png in the output folder. Prints each wave's tally.
 * Usage: node tools/shot-rumen.mjs <base url of a running dev server> <output folder>
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
const shot = (name) => page.screenshot({ path: join(out, `economy-organ-${name}.png`) });
const log = [];

async function placeLimbs() {
  return page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    let n = 0;
    for (let guard = 0; guard < 12; guard++) {
      let placed = false;
      for (let k = 0; k < s.hand.length && !placed; k++) {
        const g = s.cellCenter(s.incomingGates[0] ?? s.gates[0]);
        const cells = b.buildableCells(400).sort((a, c) => { const pa = s.cellCenter(a), pc = s.cellCenter(c); return Math.hypot(pa.x - g.x, pa.y - g.y) - Math.hypot(pc.x - g.x, pc.y - g.y); });
        for (const cell of cells) { if (b.play({ kind: 'build', cardIndex: k, cell }).ok) { placed = true; n++; break; } }
      }
      if (!placed) break;
    }
    return n;
  });
}

/** One wave: limbs, START, stepped to the clear; the organ stage then opens by itself. */
async function wave() {
  await placeLimbs();
  await page.locator('#call-early').click();
  for (let i = 0; i < 200; i++) {
    await page.evaluate(() => window.broodfall.step(60));
    const s = await page.evaluate(() => ({ p: window.broodfall.sim.phase, o: window.broodfall.sim.outcome }));
    if (s.p !== 'siege' || s.o !== 'playing') break;
  }
  await page.evaluate(() => { const s = window.broodfall.sim; while (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0 }); });
  await page.waitForSelector('#under:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(2600);
  const t = await page.evaluate(() => ({ tally: window.broodfall.sim.lastChymeTally, chyme: Math.floor(window.broodfall.sim.chyme), made: Math.floor(window.broodfall.sim.rumenEarned) }));
  log.push(`wave ${t.tally?.wave}: ${JSON.stringify(t.tally)} · bank ${t.chyme} · the Rumen has made ${t.made}`);
}

/** Grow an organ by clicks at the first legal unturned spot (src/ui/organPlace.ts maps the pointer to a placement). */
async function growByClicks(organ, cellPick) {
  await page.locator(`#under-palette [data-organ="${organ}"]`).click();
  const spots = await page.evaluate(({ id, pick }) => {
    const s = window.broodfall.sim;
    const out = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < s.under.cells.length; c++) if (s.canBuildOrgan(id, c, r)) out.push({ c, r, feeds: id === 'rumen' ? s.rumenFor(s.organFootprint(id, c, r)).feeds.length : 0 });
    if (pick === 'rich') out.sort((a, b) => b.feeds - a.feeds || a.r - b.r);
    return out.slice(0, 6);
  }, { id: organ, pick: cellPick });
  for (const spot of spots) {
    const cell = page.locator(`#under-grid [data-cell="${spot.c}"]`);
    await cell.hover();
    for (let k = 0; k < spot.r; k++) await cell.click({ button: 'right' });
    await cell.click();
    if (await page.evaluate((id) => window.broodfall.sim.organs.some((o) => o.organ === id), organ)) {
      if (await page.locator('#under-palette .under-organ.on').count()) await page.keyboard.press('Escape');
      return true;
    }
  }
  if (await page.locator('#under-palette .under-organ.on').count()) await page.keyboard.press('Escape');
  return false;
}

/** Hover the board so the ghost is exactly `cells` (the organ already picked): the cell that does it, or -1. */
async function aimAt(cells) {
  for (const c of cells) {
    await page.locator(`#under-grid [data-cell="${c}"]`).hover();
    await page.waitForTimeout(120);
    const ghost = await page.evaluate(() => [...document.querySelectorAll('#under-grid .ghost-ok')].map((e) => Number(e.dataset.cell)).sort((a, b) => a - b));
    if (ghost.length === cells.length && ghost.every((x, i) => x === [...cells].sort((a, b) => a - b)[i])) return c;
  }
  return -1;
}

try {
  await page.goto(`${base}/?seed=7&autostart=1&speed=0`, { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await wave();
  log.push(`grew the Gut: ${await growByClicks('gut')}`);
  await page.locator('#under-done').click();
  await wave();
  log.push(`grew the Bone Forge: ${await growByClicks('forge')}`);
  await page.locator('#under-done').click();
  await wave();
  // The Rumen: hover its card, then a poor spot (touching one theme at most) and the richest spot, before growing it.
  await page.locator('#under-palette [data-organ="rumen"]').hover();
  await page.waitForTimeout(300);
  await shot('1-card');
  await page.locator('#under-palette [data-organ="rumen"]').click();
  const spots = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const all = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < s.under.cells.length; c++) if (s.canBuildOrgan('rumen', c, r)) { const cells = s.organFootprint('rumen', c, r); all.push({ c, r, cells, feeds: s.rumenFor(cells).feeds.length }); }
    all.sort((a, b) => a.feeds - b.feeds);
    return { poor: all.filter((x) => x.feeds <= 1), rich: all.filter((x) => x.feeds === all[all.length - 1].feeds) };
  });
  // R turns the picked organ a quarter (the stage's own key); the script keeps count.
  let rot = 0;
  const turnTo = async (r) => { while (rot !== r) { await page.keyboard.press('r'); rot = (rot + 1) % 4; } };
  let aimed = false;
  for (const p of spots.poor) { await turnTo(p.r); if ((aimed = (await aimAt(p.cells)) >= 0)) break; }
  await page.waitForTimeout(300);
  await shot('2-place-poor');
  log.push(`poor spot (aimed ${aimed}) readout: ${await page.locator('#under-status').textContent().catch(() => '')}`);
  let rich = null;
  for (const p of [...spots.rich].reverse()) { await turnTo(p.r); const at = await aimAt(p.cells); if (at >= 0) { rich = { ...p, at }; break; } }
  await page.waitForTimeout(300);
  await shot('3-place-rich');
  log.push(`rich spot (aimed ${!!rich}) readout: ${await page.locator('#under-status').textContent().catch(() => '')}`);
  if (rich) await page.locator(`#under-grid [data-cell="${rich.at}"]`).click();
  // The click lands where the ghost was: confirm it grew there.
  const grown = await page.evaluate(() => window.broodfall.sim.organs.find((o) => o.organ === 'rumen')?.cells ?? null);
  if (!grown) log.push(`click did not grow it: ${await page.locator('#under-status').textContent().catch(() => '')}`);
  if (await page.locator('#under-palette .under-organ.on').count()) await page.keyboard.press('Escape');
  log.push(`grew the Rumen: ${!!grown} at ${JSON.stringify(grown)} · its terms ${await page.evaluate(() => JSON.stringify(window.broodfall.sim.rumen()))}`);
  await page.waitForTimeout(500);
  await shot('4-grown');
  await page.locator('#under-done').click();
  for (let k = 0; k < 2; k++) {
    await wave();
    await shot(`5-tally-wave-${k + 4}`);
    await page.locator('#under-done').click();
  }
  await wave();
  // Hover the grown Rumen on the board: what it makes where it stands, and what it has made.
  const cell = await page.evaluate(() => window.broodfall.sim.organs.find((o) => o.organ === 'rumen')?.cells[0]);
  if (cell !== undefined) { await page.locator(`#under-grid [data-cell="${cell}"]`).hover(); await page.waitForTimeout(400); }
  await shot('6-grown-hover');
  log.push(`grown hover readout: ${await page.locator('#under-status').textContent().catch(() => '')}`);
} finally {
  console.log(log.join('\n'));
  console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'no page errors');
  await browser.close();
}
