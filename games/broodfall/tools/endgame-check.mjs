/**
 * Endgame verification: runs the built game in demo mode at high speed until the
 * run ENDS, then asserts the overlay renders and screenshots it. Proves the win/loss
 * path works in the real browser, not just in vitest.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, BOOT_MS, startPreview, stopPreview, launchBrowser } from './check-harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const failures = [];
const pass = (n) => console.log(`  PASS  ${n}`);
const fail = (n, d) => { failures.push(n); console.log(`  FAIL  ${n} — ${d}`); };

let server; let browser;
try {
  server = await startPreview();
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  // Seed 3 wins with the naive policy in the headless tests; speed 60 saturates the step cap.
  await page.goto('http://localhost:' + PORT + '/?auto=1&seed=1&speed=60&directive=hold', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas', { timeout: BOOT_MS });

  let outcome = 'playing';
  const started = Date.now();
  while (outcome === 'playing' && Date.now() - started < 300000) {
    await page.waitForTimeout(4000);
    outcome = await page.evaluate(() => window.broodfall.sim.outcome);
  }
  const state = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return { outcome: s.outcome, time: s.time, biomass: s.biomass, waves: s.waveNumber, coreHp: s.coreHp };
  });

  if (state.outcome !== 'playing') {
    pass(`run ended in-browser: ${state.outcome} at t=${(state.time / 60).toFixed(1)}min ` +
      `(waves=${state.waves}, biomass=${state.biomass.toFixed(0)}, coreHp=${state.coreHp.toFixed(0)})`);
  } else {
    fail('run ends', `still playing after 5 real minutes (t=${state.time.toFixed(0)}s)`);
  }

  const overlayVisible = await page.evaluate(
    () => !document.getElementById('overlay').classList.contains('hidden'),
  );
  const title = await page.textContent('#overlay-title');
  if (overlayVisible && (title ?? '').length > 3) pass(`end overlay shown: "${title}"`);
  else fail('end overlay', `visible=${overlayVisible} title="${title}"`);

  await page.screenshot({ path: join(shots, '04-endgame.png') });
} catch (err) {
  fail('harness', err.message);
} finally {
  await browser?.close();
  stopPreview(server);
}

console.log(failures.length ? `\nENDGAME CHECK FAILED: ${failures.join(', ')}` : '\nENDGAME CHECK: verified.');
process.exit(failures.length ? 1 : 0);
