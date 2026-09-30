/**
 * Screenshot beat for HEIGHT IN THE PLACEMENT PREVIEW and RIGHT-CLICK TURNS (Collins, Sep 30 2026:
 * "have we properly handled how elevation works, with elevation increasing range by unit, and it
 * shows in the range indication hover-over before placing the building? and right click rotates
 * the building a quarter?").
 *
 * On the DEV server, by the player's own gestures (a click on the card, the pointer over a cell,
 * right-clicks): a Spitter held over a level-1 roof, the same limb over a roof three levels up
 * (the ring larger, the readout "+20% height"), over a level-1 roof raised by two plinths, the
 * roof-3 preview with the camera turned a quarter, four right-clicks turning a Spitter (front,
 * mirrored, back...), and two turning a Skipping Mortar's field of fire.
 *
 * Usage: node tools/shot-elevation.mjs      (BROODFALL_PORT to move it off 5287)
 * Artifacts: notes/screens/2026-09-30/elev-*.jpg, rotate-*.jpg
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const PORT = Number(process.env.BROODFALL_PORT || 5287);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(out, { recursive: true });
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}

freePort();
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  // Another session saving a file must not reload this page mid-beat.
  await page.addInitScript(() => { window.WebSocket = class { constructor() {} addEventListener() {} removeEventListener() {} send() {} close() {} }; });
  // A dev server that has just started can drop the first request, or re-optimize its dependencies and
  // want a reload the stubbed socket never delivers: load again until the game is up.
  for (let k = 0; ; k++) {
    try {
      await page.goto(`http://localhost:${PORT}/?seed=7&autostart=1&speed=0`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 60000 });
      break;
    } catch (e) {
      console.log(`  (load ${k + 1} did not come up: ${String(e).split(String.fromCharCode(10))[0].slice(0, 100)}; errors: ${errors.slice(-2).join(' | ').slice(0, 200)})`);
      if (k >= 3) throw e;
      await page.waitForTimeout(2000);
    }
  }
  await page.evaluate(() => window.broodfall.step(600));
  await page.waitForTimeout(500);
  if (await page.locator('#under-done').isVisible()) await page.locator('#under-done').click();
  await page.waitForTimeout(300);
  const missing = await page.evaluate(() => window.broodfall.artMissing());
  const banner = await page.evaluate(() => /did not load/i.test(document.body.innerText));
  check(missing.length === 0 && !banner, 'every picture loaded, no "did not load" banner', missing.slice(0, 3).join(', '));

  // Three roofs near the landing site: one on level 1, one three levels up, one on level 1 to be raised by plinths.
  const cells = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 9000; s.meat.science = 9000;
    const W = s.cfg.gridW;
    const at = (c) => [c % W, Math.floor(c / W)];
    const d = (c) => Math.hypot(at(c)[0] - at(s.map.coreCell)[0], at(c)[1] - at(s.map.coreCell)[1]);
    const ok = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'spitter')) ok.push(c);
    ok.sort((a, b) => d(a) - d(b));
    const h = (c) => s.map.heights[c] || 1;
    const low = ok.find((c) => h(c) === 1);
    const high = ok.find((c) => h(c) === 3) ?? ok.find((c) => h(c) >= 2);
    const plinth = ok.find((c) => h(c) === 1 && c !== low && Math.abs(at(c)[0] - at(low)[0]) + Math.abs(at(c)[1] - at(low)[1]) > 3);
    s.plinths = 2;
    s.issue({ kind: 'place-plinth', cell: plinth });
    s.issue({ kind: 'place-plinth', cell: plinth });
    return { low, high, plinth, hHigh: h(high), hPlinth: h(plinth) };
  });
  check(cells.hHigh >= 3, 'a roof three levels up was found', `level ${cells.hHigh}`);
  check(cells.hPlinth === 3, 'two plinths raised a level-1 roof to level 3', `level ${cells.hPlinth}`);

  const box = await page.locator('#stage canvas').boundingBox();
  const screenOf = async (cell) => {
    const q = await page.evaluate((c) => { const p = window.broodfall.sim.cellCenter(c); return window.broodfall.worldToScreen(p.x, p.y); }, cell);
    return { x: box.x + (q.x / q.vw) * box.width, y: box.y + (q.y / q.vh) * box.height };
  };
  /** Give the hand a card of this family and pick it up by a click, as a player does. */
  const hold = async (family, name) => {
    await page.evaluate((f) => { const s = window.broodfall.sim; s.hand.push({ id: 870000 + s.hand.length, family: f, free: true }); }, family);
    await page.waitForTimeout(250);
    const cards = page.locator('#hand .card');
    let k = -1;
    for (let i = 0; i < await cards.count(); i++) if ((await cards.nth(i).locator('.card-name').textContent()) === name) k = i;
    check(k >= 0, `the ${name} card is in the hand`);
    await cards.nth(k).click();
  };
  /** Point at a cell (the pointer lands where the game says that cell is). */
  const hover = async (cell) => {
    const p = await screenOf(cell);
    await page.mouse.move(p.x - 30, p.y - 30);
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.waitForTimeout(350);
    return p;
  };
  /** Bring the view closer, on this cell (the wheel zooms on the pointer, as a player does). */
  const zoomTo = async (cell, notches) => {
    for (let i = 0; i < notches; i++) {
      const p = await screenOf(cell);
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
  };
  const readout = () => page.evaluate(() => { const t = document.getElementById('reach-tip'); return t && t.style.display !== 'none' ? t.textContent : ''; });
  const shot = (name) => page.screenshot({ path: join(out, name), type: 'jpeg', quality: 86 });

  // The wave banner has gone; the view is brought in over the three roofs.
  await page.waitForTimeout(4000);
  await zoomTo(cells.high, 2);
  await hold('spitter', 'Spitter');
  await hover(cells.low);
  const r1 = await readout();
  check(/reach \d+ \(level 1/.test(r1), 'level-1 roof: the readout says no height bonus', r1);
  await shot('elev-01-ground.jpg');
  await hover(cells.high);
  const r2 = await readout();
  check(/\+20% height, level 3/.test(r2), 'roof 3 levels up: the readout says +20% height', r2);
  const reach = (s) => Number((s.match(/reach (\d+)/) || [])[1]);
  check(reach(r2) > reach(r1), 'the reach before placing is larger on the high roof', `${reach(r1)} -> ${reach(r2)}`);
  await shot('elev-02-roof-3.jpg');
  await hover(cells.plinth);
  const r3 = await readout();
  check(/\+20% height, level 3/.test(r3), 'a roof raised by two plinths: +20% too', r3);
  await shot('elev-03-plinth.jpg');
  // The camera turned a quarter: the ring is drawn on the board, round the same roof.
  await page.evaluate(() => window.broodfall.turnBy(1));
  await page.waitForTimeout(700);
  await hover(cells.high);
  check(/\+20% height/.test(await readout()), 'turned camera: the same readout on the same roof');
  await shot('elev-04-roof-3-turned.jpg');
  await page.evaluate(() => window.broodfall.turnBy(-1));
  await page.waitForTimeout(700);

  // Right-click turns a Spitter (not directional, drawn from four sides) a quarter at a time.
  await hold('spitter', 'Spitter');
  await zoomTo(cells.low, 2);
  const p = await hover(cells.low);
  const facings = [];
  for (let i = 1; i <= 4; i++) {
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.waitForTimeout(300);
    const f = await page.evaluate(() => window.broodfall.previewFacing?.() ?? null);
    facings.push(f);
    await shot(`rotate-0${i}.jpg`);
  }
  const hint = await page.locator('#hint').textContent();
  check(/RIGHT-CLICK turns it a quarter/i.test(hint), 'the hint says right-click turns it', hint.slice(0, 90));
  check(facings.join('') === 'WNES', 'four right-clicks: W, N, E, S (a quarter each, back where it started)', facings.join(','));
  // Placed: it keeps the last way it was turned.
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(300);
  const placed = await page.evaluate((c) => window.broodfall.sim.towers.find((t) => t.cell === c)?.facing, cells.low);
  check(placed === 'S', 'placed, it keeps the facing it was turned to', String(placed));

  // A directional one: the Skipping Mortar's field of fire turns with it.
  await hold('skipper', 'Skipping Mortar');
  const dirCell = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const ok = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'skipper', 'N') && s.canBuildTower(c, 'skipper', 'E')) ok.push(c);
    ok.sort((a, b) => d(a) - d(b));
    return ok[0];
  });
  const q = await hover(dirCell);
  await shot('rotate-dir-01.jpg');
  const f0 = await page.evaluate(() => window.broodfall.previewFacing?.() ?? null);
  await page.mouse.click(q.x, q.y, { button: 'right' });
  await page.waitForTimeout(300);
  const f1 = await page.evaluate(() => window.broodfall.previewFacing?.() ?? null);
  await shot('rotate-dir-02.jpg');
  const order = ['N', 'E', 'S', 'W'];
  check(f1 === order[(order.indexOf(f0) + 1) % 4], 'the mortar\'s field of fire turns a quarter', `${f0} -> ${f1}`);
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  freePort();
}
console.log(failures.length ? `\nELEVATION BEAT: ${failures.length} failure(s): ${failures.join('; ')}` : '\nELEVATION BEAT: all verified.');
process.exit(failures.length ? 1 : 0);
