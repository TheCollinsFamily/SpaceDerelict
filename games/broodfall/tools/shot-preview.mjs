/**
 * Screenshot beat for directional and effect limbs: a built Skipping Mortar (its field of
 * fire, by a click on it), a Marrow Conduit held and hovered (the placement preview: its
 * lane, gather ring and links), and a Ward Membrane (a BIG limb) among the guns it covers.
 *
 * It broke when the organ stage came (Sep 28): the hand only holds unlocked themes, so
 * waiting to DRAW a card never ended. It hands itself the cards, and points each limb at
 * ground it fits (the mortar lies on two cells, the ward takes four).
 *
 * Usage: npm run build && node tools/shot-preview.mjs
 * Artifacts: tools/screenshots/beat-fieldoffire.png, beat-conduit-preview.png
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
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

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
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?seed=7&autostart=1&speed=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
  await page.evaluate(() => window.broodfall.step(600));
  // A small cluster by the landing site: guns, a mortar, a ward. Then a conduit card in hand.
  const setup = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 5000; s.meat.science = 5000;
    const W = s.cfg.gridW;
    const at = (c) => [c % W, Math.floor(c / W)];
    const d = (c) => Math.hypot(at(c)[0] - at(s.map.coreCell)[0], at(c)[1] - at(s.map.coreCell)[1]);
    const taken = [];
    const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
    const built = [];
    for (const family of ['spitter', 'lasher', 'skipper', 'ward', 'spitter']) {
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family)) cells.push(c);
      cells.sort((a, b) => d(a) - d(b));
      const cell = cells.find((c) => s.groundFor(c, family).every(apart));
      if (cell === undefined) continue;
      s.hand.push({ id: 880000 + built.length, family, free: true });
      if (s.issue({ kind: 'build', cardIndex: s.hand.length - 1, cell }).ok) {
        taken.push(...s.groundFor(cell, family) ?? [cell], ...s.towers[s.towers.length - 1].cells ?? [s.towers[s.towers.length - 1].cell]);
        built.push(family);
      }
    }
    s.hand.push({ id: 889999, family: 'conduit', free: true });
    const spot = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'conduit') && apart(c)) spot.push(c);
    spot.sort((a, b) => d(a) - d(b));
    return { built, conduitCard: s.hand.length - 1, spot: s.cellCenter(spot[0]) };
  });
  check(setup.built.includes('skipper') && setup.built.includes('ward'), 'the mortar and the ward are built', setup.built.join(', '));
  await page.evaluate(() => window.broodfall.step(2));
  await page.waitForTimeout(300);
  // A wave cleared opens the organ stage over the board: back to the surface, as a player would.
  if (await page.locator('#under-done').isVisible()) await page.locator('#under-done').click();
  await page.waitForTimeout(300);
  const box = await page.locator('#stage canvas').boundingBox();
  // The mortar's panel: a click on it.
  // A point on the screen that the game says lands on one of the mortar's cells (it lies on two).
  const skip = await page.evaluate((b) => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.family === 'skipper');
    const mine = s.cellsOf(t);
    for (const c of mine) {
      const p = s.cellCenter(c);
      const q = window.broodfall.worldToScreen(p.x, p.y);
      for (const [dx, dy] of [[0, 0], [0, -8], [0, -16], [6, -10], [-6, -10], [0, 6]]) {
        const x = b.x + (q.x / q.vw) * b.width + dx, y = b.y + (q.y / q.vh) * b.height + dy;
        if (mine.includes(window.broodfall.cellAtClient(x, y))) return { x, y };
      }
    }
    return null;
  }, box);
  check(skip !== null, 'the mortar can be pointed at on the screen');
  await page.mouse.click(skip.x, skip.y);
  await page.waitForTimeout(300);
  const open = await page.evaluate(() => !document.getElementById('inspect').classList.contains('hidden'));
  check(open, 'a click on the mortar opens its panel (its field of fire draws)');
  await page.screenshot({ path: join(shots, 'beat-fieldoffire.png') });
  // The conduit card held, hovered over a roof: the placement preview.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const cards = page.locator('#hand .card');
  let picked = -1;
  for (let k = 0; k < await cards.count(); k++) if ((await cards.nth(k).locator('.card-name').textContent()) === 'Marrow Conduit') picked = k;
  check(picked >= 0, 'the conduit card is in the hand');
  await cards.nth(picked).click();
  const cs = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [setup.spot.x, setup.spot.y]);
  await page.mouse.move(box.x + (cs.x / cs.vw) * box.width, box.y + (cs.y / cs.vh) * box.height);
  await page.waitForTimeout(300);
  const hint = await page.locator('#hint').textContent();
  check(/faces|place/i.test(hint), 'holding the conduit shows how to place and turn it', hint.slice(0, 70));
  await page.screenshot({ path: join(shots, 'beat-conduit-preview.png') });
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  freePort();
}
console.log(failures.length ? `\nPREVIEW BEAT: ${failures.length} failure(s): ${failures.join('; ')}` : '\nPREVIEW BEAT: all verified.');
process.exit(failures.length ? 1 : 0);
