/**
 * Creep beat, real clicks: in the organ stage grow a Spore Bladder with a Mire
 * Gland and a Catapult Sac TOUCHING it (its recipe); play until it grows a node;
 * pick the node from the tray, throw it past the creep, let it mature, click it
 * and spread its child. Writes tools/screenshots/beat-creep-*.png.
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
  await page.evaluate(() => { window.broodfall.sim.meat.war = 500; });
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)');

  const growTouching = async (organ, touchOrgan) => {
    await page.locator(`#under-palette [data-organ="${organ}"]`).click();
    const spot = await page.evaluate(([id, t]) => {
      const s = window.broodfall.sim;
      const u = s.under;
      const other = t ? s.organs.find((o) => o.organ === t) : null;
      for (let c = 0; c < u.cells.length; c++) {
        for (let r = 0; r < 4; r++) {
          if (!s.canBuildOrgan(id, c, r)) continue;
          const cells = s.organFootprint(id, c, r);
          if (other && !cells.some((x) => other.cells.some((y) => Math.abs((x % u.w) - (y % u.w)) + Math.abs(Math.floor(x / u.w) - Math.floor(y / u.w)) === 1))) continue;
          return { c, r };
        }
      }
      return null;
    }, [organ, touchOrgan]);
    if (!spot) return { ok: false, preview: '' };
    const cell = page.locator(`#under-grid [data-cell="${spot.c}"]`);
    await cell.hover();
    for (let k = 0; k < spot.r; k++) await cell.click({ button: 'right' });
    const preview = await page.locator('#under-status').innerText();
    await cell.click();
    return { ok: await page.evaluate((id) => window.broodfall.sim.organs.some((o) => o.organ === id), organ), preview };
  };
  check((await growTouching('bladder', null)).ok, 'grew a Spore Bladder');
  const mire = await growTouching('mire', 'bladder');
  check(mire.ok && /shapes 1 bladder/i.test(mire.preview), `mire gland touching it — preview: "${mire.preview}"`);
  const cat = await growTouching('catapult', 'bladder');
  check(cat.ok && /unlocks Spore Sling/i.test(cat.preview), `catapult sac touching it (unlocks the sling) — preview: "${cat.preview}"`);
  const summary = await page.locator('#under-summary').innerText();
  check(/CREEP NODES/i.test(summary) && /mire/i.test(summary) && /thrown 8/i.test(summary), `summary shows the recipe: "${summary.replace(/\s+/g, ' ').slice(-140)}"`);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-creep-organs.png') });
  await page.locator('#under-done').click();

  // Play 51 seconds of battle: the bladder grows its node.
  await page.evaluate(() => window.broodfall.step(515));
  const surface = async () => { await page.waitForTimeout(120); if (await page.locator('#under').isVisible()) await page.locator('#under-done').click(); };
  await surface();
  const stock = await page.evaluate(() => window.broodfall.sim.nodeStock.map((s) => ({ ...s })));
  check(stock.length >= 1 && stock[0].slow < 1 && stock[0].reach === 8, `a strained node is in stock: ${JSON.stringify(stock[0])}`);
  await page.waitForTimeout(200);
  const chip = page.locator('#node-tray .node-chip').first();
  const chipText = await chip.innerText();
  check(/thrown 8/i.test(chipText) && /mire/i.test(chipText), `tray chip names the strain: "${chipText}"`);
  await chip.click();
  // Throw it far: a cell 6-8 cells past the creep (a plain node could not reach it).
  const far = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const w = s.cfg.gridW;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.isCreeped(c) || !s.canPlaceNode(c, 8) || s.canPlaceNode(c, 3)) continue;
      return { c, p: s.cellCenter(c) };
    }
    return null;
  });
  const box = await page.locator('#stage canvas').boundingBox();
  const clickWorld = async (x, y) => {
    const ss = await page.evaluate(([a, b]) => window.broodfall.worldToScreen(a, b), [x, y]);
    await page.mouse.move(box.x + (ss.x / ss.vw) * box.width, box.y + (ss.y / ss.vh) * box.height);
    await page.waitForTimeout(80);
    await page.mouse.click(box.x + (ss.x / ss.vw) * box.width, box.y + (ss.y / ss.vh) * box.height);
  };
  check(far !== null, 'found ground only a thrown node can reach');
  await clickWorld(far.p.x, far.p.y);
  const placed = await page.evaluate((c) => ({ n: window.broodfall.sim.creepSources.filter((s) => s.kind === 'node').length, creeped: window.broodfall.sim.isCreeped(c) }), far.c);
  check(placed.n === 1 && placed.creeped, 'clicking the map throws the node there — its ground is creeped');
  // Mature it, click it, spread its child.
  await page.evaluate(() => window.broodfall.step(210));
  await surface();
  await clickWorld(far.p.x, far.p.y);
  const child = await page.evaluate((from) => {
    const s = window.broodfall.sim;
    const n = s.creepSources.find((x) => x.kind === 'node');
    for (let c = 0; c < s.map.cells.length; c++) if (!s.isCreeped(c) && s.canSpreadTo(n, c)) return s.cellCenter(c);
    for (let c = 0; c < s.map.cells.length; c++) if (c !== from && s.canSpreadTo(n, c)) return s.cellCenter(c);
    return null;
  }, far.c);
  await clickWorld(child.x, child.y);
  const nodes = await page.evaluate(() => window.broodfall.sim.creepSources.filter((s) => s.kind === 'node').map((s) => ({ spent: s.spent, slow: s.strain.slow })));
  check(nodes.length === 2 && nodes[0].spent && nodes[1].slow < 1, `a mature node, clicked, spreads its child of the same strain: ${JSON.stringify(nodes)}`);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-creep-map.png') });
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `CREEP BEAT: ${failed} failed` : 'CREEP BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
