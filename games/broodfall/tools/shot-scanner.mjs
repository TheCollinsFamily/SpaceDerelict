/**
 * THE ORGAN STAGE AS THE SHIP'S SCAN, in the real page, by real clicks.
 *
 * Checks: the scan's tiles load (the stage takes the scan look, a tile decodes); an organ
 * grown by clicks shows its own tile and outline and scans in; a Seeding Gland is refused
 * away from the surface and the status says why; it grows touching the surface and shows its
 * launch tube; a zone organ's zone pulses; touching themes show a shared edge.
 *
 * Usage: npm run build && node tools/shot-scanner.mjs
 * Artifacts: tools/screenshots/scanner-1-empty.png, scanner-2-third.png, scanner-3-growing.png,
 *            scanner-4-seeder.png
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

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
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
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?seed=7&autostart=1&speed=0`, { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');
  await page.evaluate(() => { window.broodfall.sim.meat.war = 2000; window.broodfall.sim.meat.science = 500; });
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)');
  await page.waitForFunction(() => document.getElementById('under').classList.contains('scan'), null, { timeout: 15000 }).catch(() => {});
  check(await page.evaluate(() => document.getElementById('under').classList.contains('scan')), 'the stage takes the scan look (its tiles are in the manifest)');
  // A tile really decodes: the picture of a soil cell.
  const decoded = await page.evaluate(async () => {
    const cell = document.querySelector('#under-grid .uc.k-soil');
    const url = getComputedStyle(cell).backgroundImage.replace(/^url\("?|"?\)$/g, '');
    const img = new Image();
    img.src = url;
    try { await img.decode(); return img.naturalWidth; } catch { return 0; }
  });
  check(decoded > 0, `a soil tile decodes (${decoded} px)`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(shots, 'scanner-1-empty.png') });

  // Grow organs by clicks: pick in the palette, rotate with right-clicks, click the cell.
  const growAt = async (organ, near) => {
    await page.locator(`#under-palette [data-organ="${organ}"]`).click();
    const spot = await page.evaluate(([id, n]) => {
      const s = window.broodfall.sim;
      const u = s.under;
      const other = n ? s.organs.find((o) => o.organ === n) : null;
      for (let c = 0; c < u.cells.length; c++) {
        for (let r = 0; r < 4; r++) {
          if (!s.canBuildOrgan(id, c, r)) continue;
          const cells = s.organFootprint(id, c, r);
          if (other && !cells.some((x) => other.cells.some((f) => Math.abs((x % u.w) - (f % u.w)) + Math.abs(Math.floor(x / u.w) - Math.floor(f / u.w)) === 1))) continue;
          return { c, r };
        }
      }
      return null;
    }, [organ, near ?? null]);
    if (!spot) return false;
    const cell = page.locator(`#under-grid [data-cell="${spot.c}"]`);
    await cell.hover();
    for (let k = 0; k < spot.r; k++) await cell.click({ button: 'right' });
    await cell.click();
    await page.keyboard.press('Escape');
    return page.evaluate((id) => window.broodfall.sim.organs.some((o) => o.organ === id), organ);
  };
  check(await growAt('forge'), 'grew a Bone Forge');
  check(await growAt('venom', 'forge'), 'grew a Venom Sac touching it');
  // The Seeding Gland: only touching the surface.
  const hasSeeder = await page.locator('#under-palette [data-organ="seeder"]').count();
  if (hasSeeder) {
    await page.locator('#under-palette [data-organ="seeder"]').click();
    const bad = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const u = s.under;
      for (let c = u.w * 3; c < u.cells.length; c++) {
        const cells = s.organFootprint('seeder', c, 0);
        if (cells && cells.every((x) => u.cells[x].kind === 'soil' && !s.organAt(x))) return c;
      }
      return null;
    });
    if (bad !== null) {
      await page.locator(`#under-grid [data-cell="${bad}"]`).hover();
      await page.waitForTimeout(100);
      const status = await page.locator('#under-status').innerText();
      const ghost = await page.evaluate((c) => document.querySelector(`#under-grid [data-cell="${c}"]`).classList.contains('ghost-bad'), bad);
      check(ghost && /SURFACE/i.test(status), `away from the surface a Seeding Gland is refused, and says why: "${status.slice(0, 70)}"`);
      check(await page.evaluate(() => document.querySelectorAll('#under-grid .surface-lane').length > 0), 'the surface lane is lit while it is picked');
    }
    await page.keyboard.press('Escape');
    check(await growAt('seeder'), 'grew a Seeding Gland touching the surface');
    await page.waitForTimeout(1200);
    check(await page.evaluate(() => document.querySelectorAll('#under-grid .launch').length > 0), 'it shows its launch tube');
    await page.screenshot({ path: join(shots, 'scanner-4-seeder.png') });
  } else check(false, 'the Seeding Gland is in the palette');
  check(await growAt('lattice'), 'grew a Mucus Lattice');
  check(await growAt('heart'), 'grew an Auxiliary Heart (a zone)');
  check(await growAt('gut'), 'grew a Gut');
  check(await growAt('nerve'), 'grew a Nerve Cluster');
  check(await growAt('root'), 'grew a Tendril Root');
  await page.waitForTimeout(1500);
  const look = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const forge = s.organs.find((o) => o.organ === 'forge');
    const el = document.querySelector(`#under-grid [data-cell="${forge.cells[0]}"]`);
    const cs = getComputedStyle(el);
    return {
      tile: cs.backgroundImage.includes('under/forge'),
      shares: document.querySelectorAll('#under-grid .share').length,
      zone: document.querySelectorAll('#under-grid .zq').length,
    };
  });
  check(look.tile, 'a grown organ shows its own tile');
  check(look.shares > 0, `touching organs show a shared edge (${look.shares} cells)`);
  check(look.zone > 0, `the heart's zone is on the scan (${look.zone} cells)`);
  await page.screenshot({ path: join(shots, 'scanner-2-third.png') });

  // Mid-grow: an organ caught while it scans in.
  await page.locator('#under-palette [data-organ="womb"]').click();
  const spot = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (s.canBuildOrgan('womb', c, r)) return { c, r };
    return null;
  });
  if (spot) {
    const cell = page.locator(`#under-grid [data-cell="${spot.c}"]`);
    await cell.hover();
    for (let k = 0; k < spot.r; k++) await cell.click({ button: 'right' });
    await cell.click();
    await page.waitForTimeout(180);
    await page.screenshot({ path: join(shots, 'scanner-3-growing.png') });
    check(await page.evaluate(() => document.querySelectorAll('#under-grid .scan-in').length > 0), 'a new organ scans in');
    await page.keyboard.press('Escape');
  } else check(false, 'room for a Brood Womb');

  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `SCANNER BEAT: ${failed} failed` : 'SCANNER BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  freePort();
}
process.exit(failed ? 1 : 0);
