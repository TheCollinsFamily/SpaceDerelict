/**
 * Probe (Nov 22 2026, Collins: "how to upgrade it (clicking again) is not working"; "an auxiliary heart to the left or
 * right of the tendril root looks placeable but ... vertically under it signals its not placeable").
 * In the real page: grow a Tendril Root, pick the Auxiliary Heart and hover the cells left of, right of, above and
 * below the root at several points inside each cell; report which cell the page thinks is hovered and the ghost.
 * Then grow a Bone Forge, click it (and its palette card) and report the level.
 *
 * Usage: node tools/probes/organ-clicks.mjs <base url of a running dev server> [viewport WxH]
 */
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5391';
const [vw, vh] = (process.argv[3] || '1920x1080').split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  page.on('pageerror', (e) => console.log('pageerror', String(e)));
  await page.goto(`${base}/?seed=7&autostart=1&speed=0`, { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas', { timeout: 60000 });
  await page.evaluate(() => { window.broodfall.sim.meat.war = 2000; window.broodfall.sim.meat.science = 500; });
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)');
  await page.waitForFunction(() => document.getElementById('under').classList.contains('scan'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // A root with open ground beside it (a 2-wide heart fits left or right) and under it (two cells).
  const spot = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const u = s.under;
    const open = (c) => c >= 0 && c < u.cells.length && (u.cells[c].kind === 'soil' || u.cells[c].kind === 'deposit') && !s.organAt(c);
    let best = null, bestN = -1;
    for (let c = 0; c < u.cells.length; c++) {
      const x = c % u.w, y = Math.floor(c / u.w);
      if (x < 1 || x > u.w - 3 || y > u.h - 2) continue;
      if (!s.canBuildOrgan('root', c, 0)) continue;
      if (!open(c + u.w) || !open(c + u.w + 1)) continue;
      const n = (x >= 2 && open(c - 1) && open(c - 2) ? 1 : 0) + (open(c + 1) && open(c + 2) ? 1 : 0);
      if (n > bestN) { best = c; bestN = n; }
    }
    return best;
  });
  check(spot !== null, `found a root spot (${spot})`);
  await page.locator('#under-palette [data-organ="root"]').click();
  await page.locator(`#under-grid [data-cell="${spot}"]`).click();
  await page.keyboard.press('Escape');
  check(await page.evaluate((c) => window.broodfall.sim.organAt(c)?.organ === 'root', spot), 'grew the root by a click');
  await page.waitForTimeout(1200);

  await page.locator('#under-palette [data-organ="heart"]').click();
  const w = await page.evaluate(() => window.broodfall.sim.under.w);
  // Cells to hover with the heart (rot 0: it covers the hovered cell and the one to its right).
  const tries = { left: spot - 2, right: spot + 1, below: spot + w };
  for (const [name, cell] of Object.entries(tries)) {
    const rule = await page.evaluate((c) => window.broodfall.sim.canBuildOrgan('heart', c, 0), cell);
    const box = await page.locator(`#under-grid [data-cell="${cell}"]`).boundingBox();
    for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.1], [0.5, 0.9], [0.1, 0.5], [0.9, 0.5]]) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
      await page.waitForTimeout(60);
      const seen = await page.evaluate(() => {
        const ok = [...document.querySelectorAll('#under-grid .ghost-ok')].map((e) => Number(e.dataset.cell));
        const bad = [...document.querySelectorAll('#under-grid .ghost-bad')].map((e) => Number(e.dataset.cell));
        return { ok, bad };
      });
      const lit = seen.ok.length ? 'OK ' + seen.ok : 'BAD ' + seen.bad;
      const right = rule ? seen.ok.includes(cell) : seen.bad.includes(cell) || seen.ok.length === 0;
      check(right, `heart ${name} of the root, cell ${cell} at (${fx},${fy}): rule ${rule ? 'yes' : 'no'}, ghost ${lit}`);
    }
  }
  await page.keyboard.press('Escape');

  // Levelling a theme organ by clicking it.
  await page.locator('#under-palette [data-organ="forge"]').click();
  const f = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (s.canBuildOrgan('forge', c, r)) return { c, r };
    return null;
  });
  const fc = page.locator(`#under-grid [data-cell="${f.c}"]`);
  await fc.hover();
  for (let k = 0; k < f.r; k++) await fc.click({ button: 'right' });
  await fc.click();
  const forge = await page.evaluate(() => window.broodfall.sim.organs.find((o) => o.organ === 'forge'));
  check(!!forge, 'grew a Bone Forge');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(800);
  const lvl = () => page.evaluate(() => window.broodfall.sim.organs.find((o) => o.organ === 'forge').level);
  for (const c of forge.cells) {
    const before = await lvl();
    const box = await page.locator(`#under-grid [data-cell="${c}"]`).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
    const after = await lvl();
    const status = await page.locator('#under-status').innerText();
    check(after === before + 1, `click on forge cell ${c}: level ${before} -> ${after} (status: ${status.slice(0, 90)})`);
  }
  const before = await lvl();
  await page.locator('#under-palette [data-organ="forge"]').click();
  await page.waitForTimeout(150);
  check((await lvl()) === before + 1, `click on the forge's card in the list: level ${before} -> ${await lvl()}`);
  // Holding a heart (it stays picked after it grows) and clicking the forge: the first click puts the heart down, the next levels.
  await page.locator('#under-palette [data-organ="heart"]').click();
  const held = await lvl();
  const fbox = await page.locator(`#under-grid [data-cell="${forge.cells[0]}"]`).boundingBox();
  await page.mouse.click(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2);
  await page.waitForTimeout(150);
  check((await lvl()) === held && (await page.locator('#under-palette .under-organ.on').count()) === 0, 'with a heart picked, a click on the forge puts the heart down and spends nothing');
  await page.waitForTimeout(1500);
  await page.mouse.click(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2);
  await page.waitForTimeout(150);
  check((await lvl()) === held + 1, `the next click levels it (${held} -> ${await lvl()})`);
  const meteorBefore =await page.evaluate(() => window.broodfall.sim.coreLevel);
  const mc = await page.evaluate(() => window.broodfall.sim.under.cells.findIndex((c) => c.kind === 'meteor'));
  await page.locator(`#under-grid [data-cell="${mc}"]`).click();
  check((await page.evaluate(() => window.broodfall.sim.coreLevel)) === meteorBefore + 1, `click on the meteor levels it (${meteorBefore} -> ${await page.evaluate(() => window.broodfall.sim.coreLevel)})`);
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
