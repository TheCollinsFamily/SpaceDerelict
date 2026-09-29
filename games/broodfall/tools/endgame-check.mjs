/**
 * Endgame verification: runs the built game in demo mode at high speed until the
 * run ENDS, then asserts the overlay renders and screenshots it. Proves the win/loss
 * path works in the real browser, not just in vitest.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const failures = [];
const pass = (n) => console.log(`  PASS  ${n}`);
const fail = (n, d) => { failures.push(n); console.log(`  FAIL  ${n} — ${d}`); };

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const rows = out.split(String.fromCharCode(10));
    for (const line of rows) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}

function startPreview() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32',
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('preview did not start')), 30000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (c) => reject(new Error(`preview exited (${c})`)));
  });
}

let server; let browser;
try {
  server = await startPreview();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  // Seed 3 wins with the naive policy in the headless tests; speed 60 saturates the step cap.
  await page.goto('http://localhost:' + PORT + '/?auto=1&seed=1&speed=60&directive=hold', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');

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
  if (server) {
    if (process.platform === 'win32') {
      try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    } else server.kill();
  }
}

console.log(failures.length ? `\nENDGAME CHECK FAILED: ${failures.join(', ')}` : '\nENDGAME CHECK: verified.');
process.exit(failures.length ? 1 : 0);
