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

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const rows = out.split(String.fromCharCode(10));
    for (const line of rows) {
      const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}

function startPreview() {
  freePort();
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
  await page.goto('http://localhost:5199/?seed=7&autostart=1', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');

  // Give the wallet enough to build twice regardless of card mix, and make sure
  // the first card is a block-buildable family (street pieces would foil the
  // generic block-cell clicks below).
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 500; s.meat.science = 500; s.meat.royal = 500;
    for (let guard = 0; guard < 300 && ['pit', 'spine'].includes(s.hand[0].family); guard++) {
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
  });

  /** Click the canvas at a WORLD position (through the camera transform). */
  const clickWorld = async (wx, wy) => {
    const box = await page.locator('#stage canvas').boundingBox();
    const s = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [wx, wy]);
    await page.mouse.click(box.x + (s.x / s.vw) * box.width, box.y + (s.y / s.vh) * box.height);
  };

  const core = await page.evaluate(() => window.broodfall.sim.core);
  const towerSpot = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildTower(c)) return s.cellCenter(c);
    }
    return null;
  });
  const towerSpot2 = await page.evaluate(() => {
    const s = window.broodfall.sim;
    let n = 0;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildTower(c)) { if (n === 1) return s.cellCenter(c); n++; }
    }
    return null;
  });
  const organSpot = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildOrgan(c)) return s.cellCenter(c);
    }
    return null;
  });

  // 1. Select the first card and place it on a legal creep-skin cell.
  await page.locator('#hand .card').first().click();
  await clickWorld(towerSpot.x, towerSpot.y);
  let towers = await page.evaluate(() => window.broodfall.sim.towers.length);
  if (towers === 1) pass('card click + canvas click builds a tower');
  else fail('build via input', `towers=${towers}`);

  // 2. Cannibalize by DIRECT CLICK (no mode toggle): with a card armed, clicking
  //    an existing limb eats it on the spot — salvage credited, traits banked —
  //    then placing inherits the pip.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let guard = 0; guard < 300 && ['pit', 'spine'].includes(s.hand[0].family); guard++) {
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
  });
  await page.locator('#hand .card').first().click();
  const meatBefore = await page.evaluate(() => ({ ...window.broodfall.sim.meat }));
  await clickWorld(towerSpot.x, towerSpot.y); // click the limb we just built: butcher it
  const mid = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return { towers: s.towers.length, pending: s.pendingPips.length, meat: { ...s.meat } };
  });
  const refunded = (mid.meat.war + mid.meat.science + mid.meat.royal)
    > (meatBefore.war + meatBefore.science + meatBefore.royal);
  if (mid.towers === 0 && mid.pending === 1 && refunded) {
    pass('click on own limb butchers it: salvage refunded, trait banked');
  } else {
    fail('butcher via click', `towers=${mid.towers} pending=${mid.pending} refunded=${refunded}`);
  }
  await clickWorld(towerSpot2.x, towerSpot2.y); // place the new limb
  const after = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return { towers: s.towers.length, pips: s.towers[0]?.pips.length ?? -1, pending: s.pendingPips.length };
  });
  if (after.towers === 1 && after.pips === 1 && after.pending === 0) {
    pass('cannibalize flow: banked trait inherited by the next build');
  } else {
    fail('cannibalize flow', `towers=${after.towers} pips=${after.pips} pending=${after.pending}`);
  }

  // 3. Organ placement inside the body.
  await page.locator('.organ-btn[data-organ="heart"]').click();
  await clickWorld(organSpot.x, organSpot.y);
  const organs = await page.evaluate(() => window.broodfall.sim.organs.length);
  if (organs === 1) pass('organ button + body click grows an organ');
  else fail('organ placement', `organs=${organs}`);

  // 4. Right-click cancels selection (no accidental build on next click).
  await page.locator('#hand .card').first().click();
  const box = await page.locator('#stage canvas').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  const towerSpot3 = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildTower(c)) return s.cellCenter(c);
    }
    return null;
  });
  await clickWorld(towerSpot3.x, towerSpot3.y);
  const towers2 = await page.evaluate(() => window.broodfall.sim.towers.length);
  if (towers2 === after.towers) pass('right-click cancels placement');
  else fail('right-click cancel', `towers went ${after.towers} -> ${towers2}`);

  // 5. Spore sling: click the built sling to arm, click distant ground to throw,
  //    the landed clot makes remote ground buildable. (Setup via the AI-play API,
  //    the interactions themselves are real clicks.)
  const slingSetup = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 900; s.meat.science = 900;
    for (let guard = 0; guard < 400; guard++) {
      const i = s.hand.findIndex((c) => c.family === 'sling');
      if (i >= 0) {
        for (let c = 0; c < s.map.cells.length; c++) {
          if (s.canBuildTower(c)) {
            return s.issue({ kind: 'build', cardIndex: i, cell: c }).ok
              ? s.towers.find((t) => t.family === 'sling').pos : null;
          }
        }
      }
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
    return null;
  });
  if (!slingSetup) fail('sling setup', 'could not draw/build a sling');
  else {
    const target = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const sl = s.towers.find((t) => t.family === 'sling');
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] === 3 || s.isCreeped(c)) continue;
        const p = s.cellCenter(c);
        const d = Math.hypot(p.x - sl.pos.x, p.y - sl.pos.y);
        if (d < 280 && d > 140) return { ...p, cell: c };
      }
      return null;
    });
    await clickWorld(slingSetup.x, slingSetup.y); // arm the sling
    await clickWorld(target.x, target.y);          // throw
    await page.evaluate(() => window.broodfall.step(16)); // clot lands
    const seeded = await page.evaluate((cell) => window.broodfall.sim.isCreeped(cell), target.cell);
    if (seeded) pass('sling: click-to-arm, click-to-throw seeds remote creep');
    else fail('sling throw', 'target cell not creeped after landing');
  }

  // 5b. Bile lobber: same arm-and-aim interaction, but the payload is a volley.
  const lobberPos = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let guard = 0; guard < 400; guard++) {
      const i = s.hand.findIndex((c) => c.family === 'lobber');
      if (i >= 0) {
        for (let c = 0; c < s.map.cells.length; c++) {
          if (s.canBuildTower(c)) {
            return s.issue({ kind: 'build', cardIndex: i, cell: c }).ok
              ? s.towers.find((t) => t.family === 'lobber').pos : null;
          }
        }
      }
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
    return null;
  });
  if (!lobberPos) fail('lobber setup', 'could not draw/build a lobber');
  else {
    await clickWorld(lobberPos.x, lobberPos.y);      // arm
    await clickWorld(lobberPos.x + 100, lobberPos.y); // fire at ground in range
    const fired = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const l = s.towers.find((t) => t.family === 'lobber');
      return s.bileFlights.length > 0 || (l && l.cooldown > 0);
    });
    if (fired) pass('lobber: click-to-arm, click-to-fire launches the volley');
    else fail('lobber volley', 'no bile flight and no cooldown after gesture');
  }

  // 5c. Limb panel: with nothing armed, click a tower → the panel opens; click
  //     STRONGEST and SCIENCE → that limb's targeting changes in the sim.
  {
    const box0 = await page.locator('#stage canvas').boundingBox();
    await page.mouse.click(box0.x + 5, box0.y + 5, { button: 'right' }); // disarm everything
    const tgt = await page.evaluate(() => {
      const t = window.broodfall.sim.towers.find((x) => x.family !== 'sling' && x.family !== 'lobber');
      return t ? { id: t.id, x: t.pos.x, y: t.pos.y } : null;
    });
    if (!tgt) fail('inspect setup', 'no tower to inspect');
    else {
      await clickWorld(tgt.x, tgt.y);
      const open = await page.locator('#inspect').isVisible();
      await page.locator('#inspect-modes button[data-mode="strongest"]').click();
      await page.locator('#inspect-castes button[data-caste="science"]').click();
      const set = await page.evaluate((id) => {
        const t = window.broodfall.sim.towers.find((x) => x.id === id);
        return t ? { p: t.priority, c: t.casteFocus } : null;
      }, tgt.id);
      if (open && set && set.p === 'strongest' && set.c === 'science') {
        pass('limb panel: click tower opens it; targeting buttons drive the sim');
      } else fail('limb panel', `open=${open} set=${JSON.stringify(set)}`);
      await page.mouse.click(box0.x + 5, box0.y + 5, { button: 'right' });
      const closed = !(await page.locator('#inspect').isVisible());
      if (closed) pass('limb panel: right-click closes it');
      else fail('limb panel close', 'still visible after right-click');
    }
  }

  // 6. Tendril root: build via its organ button, then click it to re-aim the lobe.
  await page.locator('.organ-btn[data-organ="root"]').click();
  const rootSpot = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildOrgan(c)) return s.cellCenter(c);
    }
    return null;
  });
  await clickWorld(rootSpot.x, rootSpot.y);
  const rootDir1 = await page.evaluate(() => {
    const o = window.broodfall.sim.organs.find((x) => x.organ === 'root');
    return o ? o.rootDir : null;
  });
  await clickWorld(rootSpot.x, rootSpot.y); // click the root: cycle its direction
  const rootDir2 = await page.evaluate(() => {
    const o = window.broodfall.sim.organs.find((x) => x.organ === 'root');
    return o ? o.rootDir : null;
  });
  if (rootDir1 && rootDir2 && rootDir1 !== rootDir2) pass('root: organ built, click re-aims the lobe');
  else fail('tendril root', `dir ${rootDir1} -> ${rootDir2}`);
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
