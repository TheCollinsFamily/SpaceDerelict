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

  // 0. THE BODY BELOW opens first (organs -> limbs -> wave). The sim holds while
  //    it is open; an organ grows only touching the meteor (or an organ that does).
  await page.waitForSelector('#under:not(.hidden)', { timeout: 5000 });
  await page.evaluate(() => { window.broodfall.sim.meat.war = 500; });
  const t0 = await page.evaluate(() => window.broodfall.sim.time);
  await page.waitForTimeout(600);
  const t1 = await page.evaluate(() => window.broodfall.sim.time);
  if (t1 === t0) pass('the body below opens at the start and the clock holds while it is open');
  else fail('under pause', `time moved ${t0} -> ${t1}`);
  const cells = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const u = s.under;
    let legal = -1; let far = -1;
    for (let i = 0; i < u.cells.length; i++) {
      if (legal < 0 && s.canBuildOrgan(i)) legal = i;
      if (far < 0 && (u.cells[i].kind === 'soil' || u.cells[i].kind === 'deposit') && Math.floor(i / u.w) === u.h - 1) far = i;
    }
    return { legal, far };
  });
  await page.locator('#under-palette [data-organ="heart"]').click();
  await page.locator(`#under-grid [data-cell="${cells.far}"]`).click();
  const refused = await page.evaluate(() => window.broodfall.sim.organs.length === 0);
  await page.locator(`#under-grid [data-cell="${cells.legal}"]`).hover();
  const preview = await page.locator('#under-status').innerText();
  await page.locator(`#under-grid [data-cell="${cells.legal}"]`).click();
  const grown = await page.evaluate(() => window.broodfall.sim.organs.map((o) => o.organ));
  if (refused && /GROW AUXILIARY HEART HERE/i.test(preview) && grown.join() === 'heart') {
    pass('hover previews the organ\'s power; click grows it touching the meteor; a cut-off cell is refused');
  } else fail('grow organ below', `refused=${refused} preview="${preview}" organs=${grown}`);
  await page.locator('#under-done').click();
  if (await page.locator('#under').isHidden()) pass('TO THE SURFACE closes the body below');
  else fail('under close', 'still open');

  // Give the wallet enough to build twice regardless of card mix, and make sure
  // the first card is a block-buildable family (street pieces would foil the
  // generic block-cell clicks below).
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 500; s.meat.science = 500; s.meat.royal = 500;
    for (let guard = 0; guard < 300 && ['swamp', 'spine'].includes(s.hand[0].family); guard++) {
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
    for (let guard = 0; guard < 300 && ['swamp', 'spine'].includes(s.hand[0].family); guard++) {
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

  // 4. Esc cancels selection (no accidental build on next click). Right-click
  //    also cancels for non-directional cards; directional ones rotate (5d).
  const box = await page.locator('#stage canvas').boundingBox();
  await page.locator('#hand .card').first().click();
  await page.keyboard.press('Escape');
  const towerSpot3 = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildTower(c)) return s.cellCenter(c);
    }
    return null;
  });
  await clickWorld(towerSpot3.x, towerSpot3.y);
  const towers2 = await page.evaluate(() => window.broodfall.sim.towers.length);
  if (towers2 === after.towers) pass('Esc cancels placement');
  else fail('Esc cancel', `towers went ${after.towers} -> ${towers2}`);

  // 4b. Directional card: right-click ROTATES the placement, then the click
  //     places it with that facing (and does not cancel).
  {
    const r = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.meat.war = 900; s.meat.science = 900;
      for (let guard = 0; guard < 400; guard++) {
        const i = s.hand.findIndex((c) => c.family === 'skipper' || c.family === 'conduit');
        if (i >= 0) return i;
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      return -1;
    });
    if (r < 0) fail('directional setup', 'no directional card');
    else {
      const spot = await page.evaluate(() => {
        const s = window.broodfall.sim;
        for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c)) return { ...s.cellCenter(c), cell: c };
        return null;
      });
      await page.locator('#hand .card').nth(r).click();
      const sp = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [spot.x, spot.y]);
      await page.mouse.move(box.x + (sp.x / sp.vw) * box.width, box.y + (sp.y / sp.vh) * box.height);
      const start = await page.evaluate((c) => window.broodfall.sim.facingTowardGate(window.broodfall.sim.cellCenter(c)), spot.cell);
      await page.mouse.click(box.x + (sp.x / sp.vw) * box.width, box.y + (sp.y / sp.vh) * box.height, { button: 'right' });
      await clickWorld(spot.x, spot.y);
      const placed = await page.evaluate((c) => {
        const t = window.broodfall.sim.towers.find((x) => x.cell === c);
        return t ? t.facing : null;
      }, spot.cell);
      const order = ['N', 'E', 'S', 'W'];
      const expected = order[(order.indexOf(start) + 1) % 4];
      if (placed === expected) pass('directional placement: right-click rotates, click places with that facing');
      else fail('directional placement', `placed facing ${placed}, expected ${expected} (start ${start})`);
      // 4c. Right-click the BUILT directional limb rotates it again.
      await page.mouse.click(box.x + (sp.x / sp.vw) * box.width, box.y + (sp.y / sp.vh) * box.height, { button: 'right' });
      const rotated = await page.evaluate((c) => window.broodfall.sim.towers.find((x) => x.cell === c)?.facing, spot.cell);
      if (rotated === order[(order.indexOf(expected) + 1) % 4]) pass('built directional limb: right-click rotates it');
      else fail('built rotate', `facing ${rotated}`);
      await page.keyboard.press('Escape');
    }
  }

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

  // 5b2. Bombard: click it (arms marker placement), click the map → marker set.
  {
    const bpos = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.meat.war = 900; s.meat.science = 900;
      for (let guard = 0; guard < 400; guard++) {
        const i = s.hand.findIndex((c) => c.family === 'bombard');
        if (i >= 0) {
          for (let c = 0; c < s.map.cells.length; c++) {
            if (s.canBuildTower(c)) {
              return s.issue({ kind: 'build', cardIndex: i, cell: c }).ok
                ? s.towers.find((t) => t.family === 'bombard').pos : null;
            }
          }
        }
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      return null;
    });
    if (!bpos) fail('bombard setup', 'could not draw/build a bombard');
    else {
      const target = await page.evaluate((p) => {
        const s = window.broodfall.sim;
        for (let c = 0; c < s.map.cells.length; c++) {
          if (s.map.cells[c] === 3) continue;
          const q = s.cellCenter(c);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d > 120 && d < 260) return { ...q, cell: c };
        }
        return null;
      }, bpos);
      const box1 = await page.locator('#stage canvas').boundingBox();
      await page.mouse.click(box1.x + 5, box1.y + 5, { button: 'right' });
      await clickWorld(bpos.x, bpos.y);    // arm marker placement
      await clickWorld(target.x, target.y); // set the marker
      const marker = await page.evaluate(() => window.broodfall.sim.towers.find((t) => t.family === 'bombard').marker);
      if (marker === target.cell) pass('bombard: click it, click the map — the marker is set');
      else fail('bombard marker', `marker=${marker} expected=${target.cell}`);
    }
  }

  // 5b3. Skipping mortar: click it, then a FACING button in its panel.
  {
    const kpos = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.meat.war = 900; s.meat.science = 900;
      for (let guard = 0; guard < 400; guard++) {
        const i = s.hand.findIndex((c) => c.family === 'skipper');
        if (i >= 0) {
          for (let c = 0; c < s.map.cells.length; c++) {
            if (s.canBuildTower(c)) {
              return s.issue({ kind: 'build', cardIndex: i, cell: c }).ok
                ? s.towers.find((t) => t.family === 'skipper').pos : null;
            }
          }
        }
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      return null;
    });
    if (!kpos) fail('skipper setup', 'could not draw/build a skipping mortar');
    else {
      const box2 = await page.locator('#stage canvas').boundingBox();
      await page.mouse.click(box2.x + 5, box2.y + 5, { button: 'right' });
      await clickWorld(kpos.x, kpos.y);
      const before = await page.evaluate(() => window.broodfall.sim.towers.find((t) => t.family === 'skipper').facing);
      const turnTo = before === 'W' ? 'E' : 'W';
      await page.locator(`#inspect-facing button[data-dir="${turnTo}"]`).click();
      const after2 = await page.evaluate(() => window.broodfall.sim.towers.find((t) => t.family === 'skipper').facing);
      if (after2 === turnTo) pass('skipping mortar: panel FACING buttons turn it');
      else fail('skipper facing', `facing ${before} -> ${after2}, wanted ${turnTo}`);
      await page.mouse.click(box2.x + 5, box2.y + 5, { button: 'right' });
    }
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

  // 6. Tendril root, grown below: reopen the body below from the bottom bar
  //    (between waves), grow a root, click it to turn its lobe.
  await page.evaluate(() => { window.broodfall.sim.meat.war = 500; });
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)', { timeout: 3000 });
  await page.locator('#under-palette [data-organ="root"]').click();
  const rootCell = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let i = 0; i < s.under.cells.length; i++) if (s.canBuildOrgan(i)) return i;
    return -1;
  });
  await page.locator(`#under-grid [data-cell="${rootCell}"]`).click();
  const rootDir1 = await page.evaluate(() => window.broodfall.sim.organs.find((x) => x.organ === 'root')?.rootDir ?? null);
  await page.locator(`#under-grid [data-cell="${rootCell}"]`).click(); // click the root: turn its lobe
  const rootDir2 = await page.evaluate(() => window.broodfall.sim.organs.find((x) => x.organ === 'root')?.rootDir ?? null);
  if (rootDir1 && rootDir2 && rootDir1 !== rootDir2) pass('root: grown below, click turns its lobe');
  else fail('tendril root', `dir ${rootDir1} -> ${rootDir2}`);
  await page.locator('#under-done').click();
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
