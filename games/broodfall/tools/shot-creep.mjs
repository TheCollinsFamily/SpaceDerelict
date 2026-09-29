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

/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

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
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + PORT + '/?seed=7&autostart=1', { waitUntil: 'load' });
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

  const surface = async () => { await page.waitForTimeout(120); if (await page.locator('#under').isVisible()) await page.locator('#under-done').click(); };
  // Fight two waves: a bladder grows a node every 2 turns (wave clears).
  const clearWave = async () => {
    await page.evaluate(() => {
      const s = window.broodfall.sim;
      const w0 = s.wavesCleared;
      s.issue({ kind: 'call-early' });
      for (let i = 0; i < 6000 && s.wavesCleared === w0 && s.outcome === 'playing'; i++) {
        if (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0 });
        window.broodfall.step(1);
      }
      // A cleared wave can open a district draft: pick, so the map is clear to click.
      while (s.phase === "draft") s.issue({ kind: "choose-plate", index: 0 });
    });
  };
  await page.evaluate(() => { const s = window.broodfall.sim; s.meat.war = 800; const cells = window.broodfall.buildableCells(40); let k = 0; for (let g = 0; g < 300 && k < 6; g++) { const i = s.hand.findIndex((h) => h.family === 'spitter' || h.family === 'lasher'); if (i >= 0) { if (s.issue({ kind: 'build', cardIndex: i, cell: cells[k * 2] }).ok) k++; else s.issue({ kind: 'discard', cardIndex: i }); } else s.issue({ kind: 'discard', cardIndex: 0 }); } });
  await clearWave();
  await surface();
  await clearWave();
  await surface();
  const stock = await page.evaluate(() => window.broodfall.sim.nodeStock.map((s) => ({ ...s })));
  check(stock.length >= 1 && stock[0].slow < 1 && stock[0].reach === 8, `a strained node is in stock: ${JSON.stringify(stock[0])}`);
  await page.waitForTimeout(200);
  const chip = page.locator('#node-tray .node-chip').first();
  const chipText = await chip.innerText();
  check(/➶8/.test(chipText) && /≋/.test(chipText), `tray chip shows the strain in its marks: "${chipText}"`);
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
  // The camera eases into new framing after a district is drafted: wait until it holds still.
  const settle = async () => {
    let last = "";
    for (let i = 0; i < 40; i++) {
      const c = JSON.stringify(await page.evaluate(() => window.broodfall.camera()));
      if (c === last) return;
      last = c;
      await page.waitForTimeout(100);
    }
  };
  const clickWorld = async (x, y) => {
    await settle();
    const ss = await page.evaluate(([a, b]) => window.broodfall.worldToScreen(a, b), [x, y]);
    await page.mouse.move(box.x + (ss.x / ss.vw) * box.width, box.y + (ss.y / ss.vh) * box.height);
    await page.waitForTimeout(80);
    await page.mouse.click(box.x + (ss.x / ss.vw) * box.width, box.y + (ss.y / ss.vh) * box.height);
  };
  check(far !== null, 'found ground only a thrown node can reach');
  await clickWorld(far.p.x, far.p.y);
  const placed = await page.evaluate((c) => ({ n: window.broodfall.sim.creepSources.filter((s) => s.kind === 'node').length, creeped: window.broodfall.sim.isCreeped(c) }), far.c);
  check(placed.n === 1 && placed.creeped, 'clicking the map throws the node there — its ground is creeped');
  // It matures once it survives a wave: fight one, then click it and spread its child.
  await clearWave();
  await surface();
  await clickWorld(far.p.x, far.p.y);
  const child = await page.evaluate((from) => {
    const s = window.broodfall.sim;
    const n = s.creepSources.find((x) => x.kind === 'node');
    // Only cells on screen (the camera re-frames as districts grow).
    const onScreen = (c) => { const p = s.cellCenter(c); const q = window.broodfall.worldToScreen(p.x, p.y); return q.x > 20 && q.y > 20 && q.x < q.vw - 20 && q.y < q.vh - 20; };
    for (let c = 0; c < s.map.cells.length; c++) if (!s.isCreeped(c) && s.canSpreadTo(n, c) && onScreen(c)) return s.cellCenter(c);
    for (let c = 0; c < s.map.cells.length; c++) if (c !== from && s.canSpreadTo(n, c) && onScreen(c)) return s.cellCenter(c);
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
