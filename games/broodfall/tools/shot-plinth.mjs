/**
 * PLINTHS AND BIG LIMBS in the real page, by the gestures a player makes.
 *
 * The beat: limbs are grown beside the landing site (one of them BIG); the player picks a
 * plinth from the bar and clicks a limb, which rises a level; clicks the big limb, which
 * rises whole; clicks a bare roof, which rises; is refused in a street, with a reason on
 * screen; and the bar counts down. Then the view is turned and looked at from behind.
 *
 * Usage: npm run build && node tools/shot-plinth.mjs
 * Artifacts: tools/screenshots/plinth-*.png
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startPreview() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite preview exited early (${code})`)));
  });
}

const server = await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0&biome=megacity`);
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
  const canvas = page.locator('#stage canvas');
  await page.evaluate(() => window.broodfall.step(300));

  // Limbs beside the landing site: a big one and three of one cell. Three plinths in stock.
  const placed = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 9000; s.meat.science = 9000;
    const W = s.cfg.gridW;
    const at = (c) => [c % W, Math.floor(c / W)];
    const taken = [];
    const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
    const d = (c) => Math.hypot(at(c)[0] - at(s.map.coreCell)[0], at(c)[1] - at(s.map.coreCell)[1]);
    const out = [];
    for (const family of ['ward', 'spitter', 'maw', 'lasher']) {
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family)) cells.push(c);
      cells.sort((a, b) => d(a) - d(b));
      const cell = cells.find((c) => s.groundFor(c, family).every(apart) && (s.map.heights[c] || 1) <= 2);
      if (cell === undefined) { out.push({ family, err: 'no room' }); continue; }
      const ground = s.groundFor(cell, family);
      s.hand[0] = { id: 900000 + out.length, family, free: true };
      const r = s.issue({ kind: 'build', cardIndex: 0, cell });
      if (r.ok) { taken.push(...ground); out.push({ family, id: s.towers[s.towers.length - 1].id, cells: ground.length, height: s.map.heights[ground[0]] }); }
      else out.push({ family, err: r.err });
    }
    s.plinths = 3;
    return out;
  });
  console.log(`placed: ${placed.map((p) => (p.err ? `${p.family}: ${p.err}` : `${p.family} on ${p.cells} cell(s) at height ${p.height}`)).join(', ')}`);
  const big = placed.find((p) => p.family === 'ward' && !p.err);
  const small = placed.find((p) => p.family === 'spitter' && !p.err);
  check(!!big && big.cells === 4, 'a BIG limb stands on four cells', big ? `${big.cells}` : 'not placed');
  await page.evaluate(() => window.broodfall.step(2));
  await page.waitForTimeout(500);

  // Close on them.
  const box = await canvas.boundingBox();
  const screenOf = async (id) => page.evaluate((towerId) => {
    const t = window.broodfall.sim.towers.find((x) => x.id === towerId);
    const p = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
    return { x: p.x / p.vw, y: p.y / p.vh, cell: t.cell, height: window.broodfall.sim.map.heights[t.cell], range: window.broodfall.sim.statsOf(t).range };
  }, id);
  const mid = await screenOf(big.id);
  await page.mouse.move(box.x + mid.x * box.width, box.y + mid.y * box.height);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(700);
  await canvas.screenshot({ path: join(shots, 'plinth-1-before.png') });

  // The bar: three plinths, free.
  check((await page.locator('#plinth-count').textContent()) === '3', 'the bar counts the plinths in stock', await page.locator('#plinth-count').textContent());
  await page.locator('#plinths').click();
  check(await page.evaluate(() => document.getElementById('plinths').classList.contains('on')), 'a click on the bar picks a plinth up');
  check(/PLINTH/.test(await page.locator('#hint').textContent()), 'the hint says what a plinth does', (await page.locator('#hint').textContent()).slice(0, 60));

  // 1. Under a limb of one cell.
  const clickLimb = async (id) => {
    const p = await screenOf(id);
    const b = await canvas.boundingBox();
    await page.mouse.move(b.x + p.x * b.width, b.y + p.y * b.height - 4);
    await page.waitForTimeout(150);
    await page.mouse.click(b.x + p.x * b.width, b.y + p.y * b.height - 4);
    await page.waitForTimeout(400);
    return p;
  };
  const before = await screenOf(small.id);
  await clickLimb(small.id);
  const after = await screenOf(small.id);
  check(after.height === before.height + 1, 'a click on a limb raises it one level', `${before.height} to ${after.height}`);
  check(after.range > before.range, 'and it reaches further for it', `${before.range.toFixed(0)} to ${after.range.toFixed(0)}`);
  check(after.y < before.y, 'and it is drawn higher', `${(before.y * 1000).toFixed(0)} to ${(after.y * 1000).toFixed(0)}`);
  check((await page.locator('#plinth-count').textContent()) === '2', 'the bar counts down', await page.locator('#plinth-count').textContent());

  // 2. Under the big limb: it rises whole.
  const bigBefore = await page.evaluate((id) => { const s = window.broodfall.sim; return s.cellsOf(s.towers.find((t) => t.id === id)).map((c) => s.map.heights[c]); }, big.id);
  await clickLimb(big.id);
  const bigAfter = await page.evaluate((id) => { const s = window.broodfall.sim; return s.cellsOf(s.towers.find((t) => t.id === id)).map((c) => s.map.heights[c]); }, big.id);
  check(bigAfter.every((h, i) => h === bigBefore[i] + 1), 'a click on a BIG limb raises all of it, with one plinth', `${bigBefore.join(',')} to ${bigAfter.join(',')}`);
  await page.waitForTimeout(400);
  await canvas.screenshot({ path: join(shots, 'plinth-2-raised.png') });

  // 3. In a street: refused, and the reason is on the screen.
  const b2 = await canvas.boundingBox();
  // A street the pointer can reach: one that no block stands in front of, as the camera sees it.
  const street = await page.evaluate((b) => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== 1 || !s.isCreeped(c)) continue;
      const p = s.cellCenter(c);
      const q = window.broodfall.worldToScreen(p.x, p.y);
      const x = q.x / q.vw, y = q.y / q.vh;
      if (x < 0.1 || y < 0.15 || x > 0.9 || y > 0.85) continue;
      if (window.broodfall.cellAtClient(b.x + x * b.width, b.y + y * b.height) !== c) continue;
      return { cell: c, x, y, can: s.canPlacePlinth(c) };
    }
    return null;
  }, b2);
  if (!street) throw new Error('no street on the screen to try a plinth on');
  await page.mouse.click(b2.x + street.x * b2.width, b2.y + street.y * b2.height);
  await page.waitForTimeout(300);
  const hint = await page.locator('#hint').textContent();
  check(!street.can && /ROOF/i.test(hint), 'a plinth is refused in a street, and the screen says why', hint.slice(0, 60));
  check((await page.locator('#plinth-count').textContent()) === '1', 'and the plinth is kept', await page.locator('#plinth-count').textContent());

  // 4. A Seedling from the Seeding Gland: a free card, shot up from the landing site.
  await page.keyboard.press('Escape');
  const seed = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.hand.push({ id: 990001, family: 'sprout', free: true });
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const cells = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'sprout') && d(c) >= 4) cells.push(c);
    cells.sort((a, b) => d(a) - d(b));
    return { index: s.hand.length - 1, cell: cells[0] };
  });
  const b3 = await canvas.boundingBox();
  // A roof on the screen that a click reaches, with no limb near it to be eaten by mistake.
  const target = await page.evaluate((b) => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (!s.canBuildTower(c, 'sprout')) continue;
      const near = s.towers.some((t) => Math.hypot((t.cell % W) - (c % W), Math.floor(t.cell / W) - Math.floor(c / W)) < 2.5);
      if (near) continue;
      const p = s.cellCenter(c);
      const q = window.broodfall.worldToScreen(p.x, p.y);
      const x = q.x / q.vw, y = q.y / q.vh;
      if (x < 0.1 || y < 0.15 || x > 0.9 || y > 0.85) continue;
      if (window.broodfall.cellAtClient(b.x + x * b.width, b.y + y * b.height) !== c) continue;
      return { x, y, cell: c };
    }
    return null;
  }, b3);
  if (!target) throw new Error('no clear roof on the screen for the seedling');
  // The hand is drawn again on the next frame: wait for the new card, then pick it by its name.
  await page.waitForTimeout(500);
  const cards = page.locator('#hand .card');
  const n = await cards.count();
  let picked = -1;
  for (let k = 0; k < n; k++) if ((await cards.nth(k).locator('.card-name').textContent()) === 'Seedling') picked = k;
  check(picked >= 0, 'the free Seedling is in the hand', `${n} cards`);
  await cards.nth(picked).click();
  await page.waitForTimeout(150);
  await page.mouse.move(b3.x + target.x * b3.width, b3.y + target.y * b3.height);
  await page.waitForTimeout(150);
  await page.mouse.click(b3.x + target.x * b3.width, b3.y + target.y * b3.height);
  await page.waitForTimeout(100);
  console.log('  hint after the click: ' + (await page.locator('#hint').textContent()).slice(0, 90));
  const shot = await page.evaluate(() => window.broodfall.sim.seedFlights.length);
  check(shot > 0, 'a Seedling placed is SHOT up from the landing site', `${shot} in the air`);
  // Let it fly part of the way, on the sim's clock, and look.
  await page.evaluate(() => window.broodfall.step(4));
  await page.waitForTimeout(250);
  await canvas.screenshot({ path: join(shots, 'plinth-4-seedling-in-the-air.png') });
  await page.evaluate(() => window.broodfall.step(12));
  const landed = await page.evaluate(() => ({ flying: window.broodfall.sim.seedFlights.length, sprouts: window.broodfall.sim.towers.filter((t) => t.family === 'sprout').length }));
  check(landed.flying === 0 && landed.sprouts === 1, 'and it lands, and stands where it was placed', `${landed.sprouts} standing`);
  await page.waitForTimeout(300);
  await canvas.screenshot({ path: join(shots, 'plinth-5-seedling-landed.png') });

  // 5. From behind.
  await page.keyboard.press('e');
  await page.waitForTimeout(900);
  await page.keyboard.press('e');
  await page.waitForTimeout(900);
  await canvas.screenshot({ path: join(shots, 'plinth-3-from-behind.png') });
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nPLINTH BEAT: ${failures.length} failure(s): ${failures.join('; ')}` : '\nPLINTH BEAT: all verified.');
process.exit(failures.length ? 1 : 0);
