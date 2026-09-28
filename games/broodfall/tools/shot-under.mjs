/**
 * The body below beat: real clicks. The organ screen opens at the start; grow a
 * few organs (one onto a deposit), look at it, go to the surface, fight a wave
 * at speed, and check the screen comes back between waves. Writes
 * tools/screenshots/beat-under-*.png.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}

freePort();
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], {
  cwd: root, stdio: 'pipe', shell: process.platform === 'win32',
});
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5199/?seed=7&autostart=1', { waitUntil: 'load' });
  await page.waitForSelector('#under:not(.hidden)', { timeout: 8000 });
  await page.evaluate(() => { window.broodfall.sim.meat.war = 400; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-under-start.png') });
  // Dig toward the nearest deposit with roots (the cheapest organ), by real clicks.
  await page.locator('#under-palette [data-organ="root"]').click();
  let claimed = false;
  for (let k = 0; k < 8 && !claimed; k++) {
    const step = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const u = s.under;
      const md = (a, b) => Math.abs((a % u.w) - (b % u.w)) + Math.abs(Math.floor(a / u.w) - Math.floor(b / u.w));
      const legal = u.cells.map((_, i) => i).filter((i) => s.canBuildOrgan(i));
      const deps = u.cells.map((c, i) => [c, i]).filter(([c]) => c.kind === 'deposit' && !c.claimed).map(([, i]) => i);
      let best = null;
      for (const d of deps) for (const l of legal) if (!best || md(l, d) < best.d) best = { l, d: md(l, d) };
      return best ? best.l : -1;
    });
    if (step < 0) break;
    await page.locator(`#under-grid [data-cell="${step}"]`).click();
    claimed = await page.evaluate(() => window.broodfall.sim.under.cells.some((c) => c.claimed));
  }
  check(claimed, 'digging with real clicks reaches and claims a deposit');
  // A heart next to a feature if one is reachable: hover shows its power.
  await page.locator('#under-palette [data-organ="heart"]').click();
  const hcell = await page.evaluate(() => {
    const s = window.broodfall.sim;
    let best = -1; let bp = 0;
    for (let i = 0; i < s.under.cells.length; i++) {
      if (!s.canBuildOrgan(i)) continue;
      const p = s.organPowerOf({ organ: 'heart', cell: i });
      if (p > bp) { bp = p; best = i; }
    }
    return best;
  });
  await page.locator(`#under-grid [data-cell="${hcell}"]`).hover();
  const preview = await page.locator('#under-status').innerText();
  check(/GROW AUXILIARY HEART HERE: POWER/i.test(preview), `hover preview: "${preview}"`);
  await page.locator(`#under-grid [data-cell="${hcell}"]`).click();
  await page.locator(`#under-grid [data-cell="${hcell}"]`).hover();
  await page.screenshot({ path: join(here, 'screenshots', 'beat-under-grown.png') });
  // To the surface, a few guns, fight the wave at speed; the screen must return after it.
  await page.locator('#under-done').click();
  check(await page.locator('#under').isHidden(), 'TO THE SURFACE closes it');
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 2000;
    const cells = window.broodfall.buildableCells(40);
    let k = 0;
    for (let g = 0; g < 300 && k < 6; g++) {
      const i = s.hand.findIndex((h) => ['spitter', 'lasher', 'quill', 'burster'].includes(h.family));
      if (i >= 0) { if (s.issue({ kind: 'build', cardIndex: i, cell: cells[k * 2] }).ok) k++; else s.issue({ kind: 'discard', cardIndex: i }); }
      else s.issue({ kind: 'discard', cardIndex: 0 });
    }
  });
  await page.locator('#speed-box button[data-speed="8"]').click();
  await page.locator('#call-early').click();
  const back = await page.waitForSelector('#under:not(.hidden)', { timeout: 120000 }).then(() => true).catch(() => false);
  const st = await page.evaluate(() => ({ phase: window.broodfall.sim.phase, cleared: window.broodfall.sim.wavesCleared, outcome: window.broodfall.sim.outcome }));
  check(back && st.cleared >= 1, `the body below returns between waves (${JSON.stringify(st)})`);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-under-between.png') });
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `UNDER BEAT: ${failed} failed` : 'UNDER BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
