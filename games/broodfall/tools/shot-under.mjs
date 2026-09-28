/**
 * Organ-stage beat, real clicks through the real loop: the run starts at wave
 * setup; fight wave 1; the organ stage opens; grow a Bone Forge touching the
 * meteor and a Venom Sac touching the forge (they share verbs), and a heart;
 * check the summary; go up; check the forge's limbs are drawable and that
 * leftover meat spoils when wave 2 starts. Writes tools/screenshots/beat-organs-*.png.
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
  await page.waitForSelector('#stage canvas');
  check(await page.locator('#under').isHidden(), 'the run starts at wave setup (organ stage closed)');
  // Wave setup: a handful of meteor limbs, then call the wave at 8x.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 400;
    const cells = window.broodfall.buildableCells(40);
    let k = 0;
    for (let g = 0; g < 300 && k < 6; g++) {
      const i = s.hand.findIndex((h) => h.family === 'spitter' || h.family === 'lasher');
      if (i >= 0) { if (s.issue({ kind: 'build', cardIndex: i, cell: cells[k * 2] }).ok) k++; else s.issue({ kind: 'discard', cardIndex: i }); }
      else s.issue({ kind: 'discard', cardIndex: 0 });
    }
  });
  await page.locator('#speed-box button[data-speed="8"]').click();
  await page.locator('#call-early').click();
  const opened = await page.waitForSelector('#under:not(.hidden)', { timeout: 120000 }).then(() => true).catch(() => false);
  check(opened, 'after wave 1 the organ stage opens');
  await page.evaluate(() => { window.broodfall.sim.meat.war = 300; });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-organs-open.png') });

  // Grow an organ by real clicks: pick it, rotate with right-clicks until the wanted spot fits, click.
  const growAt = async (organ, want) => {
    await page.locator(`#under-palette [data-organ="${organ}"]`).click();
    const spot = await page.evaluate(([id, w]) => {
      const s = window.broodfall.sim;
      const u = s.under;
      const forge = s.organs.find((o) => o.organ === 'forge');
      for (let c = 0; c < u.cells.length; c++) {
        for (let r = 0; r < 4; r++) {
          if (!s.canBuildOrgan(id, c, r)) continue;
          const cells = s.organFootprint(id, c, r);
          if (w === 'forge' && forge && !cells.some((x) => forge.cells.some((f) => Math.abs((x % u.w) - (f % u.w)) + Math.abs(Math.floor(x / u.w) - Math.floor(f / u.w)) === 1))) continue;
          return { c, r };
        }
      }
      return null;
    }, [organ, want]);
    if (!spot) return false;
    const cell = page.locator(`#under-grid [data-cell="${spot.c}"]`);
    await cell.hover();
    for (let k = 0; k < spot.r; k++) await cell.click({ button: 'right' });
    await cell.click();
    return page.evaluate((id) => window.broodfall.sim.organs.some((o) => o.organ === id), organ);
  };
  check(await growAt('forge', null), 'grew a Bone Forge touching the meteor');
  check(await growAt('venom', 'forge'), 'grew a Venom Sac touching the forge');
  const shares = await page.evaluate(() => {
    const fx = window.broodfall.sim.organEffects();
    return { forge: fx.get('forge').pips.map((p) => p.family), venom: fx.get('venom').pips.map((p) => p.family) };
  });
  check(shares.forge.includes('blighter') && shares.venom.includes('impaler'), `touching themes share verbs: ${JSON.stringify(shares)}`);
  check(await growAt('heart', null), 'grew an auxiliary heart');
  const summary = await page.locator('#under-summary').innerText();
  check(/Bone Forge LV\d/i.test(summary) && /poison/i.test(summary), `summary lists what the organs give: "${summary.replace(/\s+/g, ' ').slice(0, 160)}"`);
  // Hover a theme organ with nothing picked: the level-up preview.
  await page.keyboard.press('Escape');
  const forgeCell = await page.evaluate(() => window.broodfall.sim.organs.find((o) => o.organ === 'forge').cells[0]);
  await page.locator(`#under-grid [data-cell="${forgeCell}"]`).hover();
  const lvlText = await page.locator('#under-status').innerText();
  check(/CLICK TO LEVEL BONE FORGE/i.test(lvlText), `level preview: "${lvlText}"`);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-organs-grown.png') });

  await page.locator('#under-done').click();
  const w = await page.evaluate(() => window.broodfall.sim.drawWeights());
  check(w.impaler > 0 && w.blighter > 0 && w.frond === 0, 'forge + venom limbs are now drawable, nerve limbs still locked');
  // Leftover meat spoils when wave 2 starts.
  await page.evaluate(() => { window.broodfall.sim.meat.war = 123; window.broodfall.sim.meat.science = 7; });
  await page.locator('#speed-box button[data-speed="1"]').click();
  await page.locator('#call-early').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ war: window.broodfall.sim.meat.war, sci: window.broodfall.sim.meat.science, wave: window.broodfall.sim.waveNumber }));
  check(after.wave === 2 && after.sci === 0 && after.war < 123, `unspent meat spoils at wave 2 (${JSON.stringify(after)}; war left = the call-early bonus)`);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-organs-wave2.png') });
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `ORGAN BEAT: ${failed} failed` : 'ORGAN BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
