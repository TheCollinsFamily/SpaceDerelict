/**
 * SPACE IS ONE STEP between waves (Collins, Nov 22 2026: "space should go from the organ menu to the phase set up and
 * the ui should reflect this right now it says start wave").
 *
 * In the real page: the first wave opens on the surface (Space starts it); after the wave the organ stage opens; a HELD
 * Space there goes to the surface only (never through to the wave); the next press starts the wave. Screenshots of the
 * organ stage's and the surface's Space hints.
 *
 * Usage: node tools/probes/space-steps.mjs <base url of a running dev server> <output folder>
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5391';
const out = process.argv[3] || 'tools/screenshots';
mkdirSync(out, { recursive: true });
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?seed=7&autostart=1&speed=1`, { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const state = () => page.evaluate(() => ({
    phase: window.broodfall.sim.phase, wave: window.broodfall.sim.waveNumber,
    under: !document.getElementById('under').classList.contains('hidden'),
    callEarly: (() => { const b = document.getElementById('call-early'); const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).visibility !== 'hidden' && !b.classList.contains('hidden'); })(),
  }));
  let s = await state();
  console.log('start', s);
  check(s.phase === 'growth' && !s.under, 'the first wave opens on the surface (setup), not the organ stage');
  check(s.callEarly, 'the surface shows START THE WAVE');
  await page.screenshot({ path: join(out, 'space-surface-first-wave.png') });
  // A grown limb so the wave has a fight (not needed for the keys).
  await page.evaluate(() => { window.broodfall.sim.meat.war = 400; window.broodfall.sim.chyme = 400; });
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  s = await state();
  check(s.phase === 'siege', `Space on the surface starts the wave (phase ${s.phase})`);
  // Run the wave out fast.
  for (let i = 0; i < 400; i++) {
    const p = await page.evaluate(() => { const b = window.broodfall; if (b.sim.phase === 'siege') b.step(300); return b.sim.phase; });
    if (p === 'draft') {
      await page.waitForTimeout(400);
      await page.locator('#draft button, #draft [data-option], #draft .draft-card').first().click({ timeout: 5000 }).catch(() => {});
      // If the draft needs a board placement, let the API place it.
      await page.waitForTimeout(400);
      const still = await page.evaluate(() => window.broodfall.sim.phase);
      if (still === 'draft') {
        const ok = await page.evaluate(() => {
          const b = window.broodfall; const o = b.sim.pendingDraft?.[0];
          return o ? b.play({ kind: 'draft', index: 0 }) : null;
        });
        console.log('  draft via api', JSON.stringify(ok));
      }
    }
    if (p === 'growth' || (await page.evaluate(() => window.broodfall.sim.phase)) === 'growth') break;
    if (await page.evaluate(() => window.broodfall.sim.outcome !== 'playing')) break;
  }
  await page.waitForTimeout(1500);
  s = await state();
  console.log('after wave', s);
  check(s.phase === 'growth' && s.under, 'after the wave the organ stage is open');
  await page.waitForTimeout(2500);
  const btn = await page.locator('#under-done').innerText();
  check(/SPACE/.test(btn), `the organ stage's button shows the Space key: "${btn.replace(/\s+/g, ' ')}"`);
  await page.screenshot({ path: join(out, 'space-organ-stage.png') });
  await page.locator('#under-done').screenshot({ path: join(out, 'space-organ-stage-button.png') });
  // Focus an organ card first: Space must not also click it (level it or pick it).
  const lvBefore = await page.evaluate(() => JSON.stringify(window.broodfall.sim.organs.map((o) => o.level)));
  await page.locator('#under-palette [data-organ]').first().focus().catch(() => {});
  // A HELD Space: one keydown, then auto-repeats, then up.
  await page.keyboard.down(' ');
  await page.waitForTimeout(150);
  await page.keyboard.down(' ');
  await page.waitForTimeout(150);
  await page.keyboard.down(' ');
  await page.waitForTimeout(150);
  await page.keyboard.up(' ');
  await page.waitForTimeout(500);
  s = await state();
  check(!s.under && s.phase === 'growth', `a held Space goes organ stage -> surface only (under ${s.under}, phase ${s.phase})`);
  check(s.callEarly, 'the surface shows START THE WAVE again');
  const lvAfter = await page.evaluate(() => JSON.stringify(window.broodfall.sim.organs.map((o) => o.level)));
  check(lvBefore === lvAfter, 'the focused organ card did not take the Space as a click');
  await page.screenshot({ path: join(out, 'space-surface-after-organs.png') });
  await page.locator('#call-early').screenshot({ path: join(out, 'space-surface-button.png') });
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  s = await state();
  check(s.phase === 'siege', `the next Space starts the wave (phase ${s.phase}, wave ${s.wave})`);
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
