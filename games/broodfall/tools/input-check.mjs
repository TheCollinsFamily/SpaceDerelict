/**
 * Input-path verification: boots the built game WITHOUT autoplay and performs the
 * real player gestures — select a card, place a tower, feed a donor into a second
 * build — asserting sim state after each. Exits non-zero on failure.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const failures = [];
const pass = (n) => console.log(`  PASS  ${n}`);
const fail = (n, d) => { failures.push(n); console.log(`  FAIL  ${n} — ${d}`); };

function startPreview() {
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
  await page.goto('http://localhost:5199/?seed=7', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');

  // Give the wallet enough to build twice regardless of card mix.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 500; s.meat.science = 500; s.meat.royal = 500;
  });

  /** Click the canvas at a WORLD position via client coords. */
  const clickWorld = async (wx, wy) => {
    const box = await page.locator('#stage canvas').boundingBox();
    const s = await page.evaluate(() => ({ w: window.broodfall.sim.worldW, h: window.broodfall.sim.worldH }));
    await page.mouse.click(box.x + (wx / s.w) * box.width, box.y + (wy / s.h) * box.height);
  };

  const core = await page.evaluate(() => window.broodfall.sim.core);

  // 1. Select the first card and place it right of the core.
  await page.locator('#hand .card').first().click();
  await clickWorld(core.x + 100, core.y);
  let towers = await page.evaluate(() => window.broodfall.sim.towers.length);
  if (towers === 1) pass('card click + canvas click builds a tower');
  else fail('build via input', `towers=${towers}`);

  // 2. Feed-a-limb flow: select a card, toggle cannibalize, click donor, place left of core.
  await page.locator('#hand .card').first().click();
  await page.locator('#cannibalize-toggle').click();
  await clickWorld(core.x + 100, core.y); // pick the donor we just built
  await clickWorld(core.x - 100, core.y); // place the new limb
  const after = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return { towers: s.towers.length, pips: s.towers[0]?.pips.length ?? -1 };
  });
  if (after.towers === 1 && after.pips === 1) pass('cannibalize flow: donor eaten, pip inherited');
  else fail('cannibalize flow', `towers=${after.towers} pips=${after.pips}`);

  // 3. Organ placement inside the body.
  await page.locator('.organ-btn[data-organ="heart"]').click();
  await clickWorld(core.x, core.y + 60);
  const organs = await page.evaluate(() => window.broodfall.sim.organs.length);
  if (organs === 1) pass('organ button + body click grows an organ');
  else fail('organ placement', `organs=${organs}`);

  // 4. Right-click cancels selection (no accidental build on next click).
  await page.locator('#hand .card').first().click();
  const box = await page.locator('#stage canvas').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await clickWorld(core.x, core.y - 100);
  const towers2 = await page.evaluate(() => window.broodfall.sim.towers.length);
  if (towers2 === after.towers) pass('right-click cancels placement');
  else fail('right-click cancel', `towers went ${after.towers} -> ${towers2}`);
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

console.log(failures.length ? `\nINPUT CHECK FAILED: ${failures.join(', ')}` : '\nINPUT CHECK: all interactions verified.');
process.exit(failures.length ? 1 : 0);
