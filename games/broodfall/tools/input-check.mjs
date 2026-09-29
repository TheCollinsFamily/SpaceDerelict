/**
 * Input-path verification: boots the built game WITHOUT autoplay and performs the
 * real player gestures — select a card, place a tower, feed a donor into a second
 * build — asserting sim state after each. Exits non-zero on failure.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);

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
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
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
  await page.goto('http://localhost:' + PORT + '/?seed=7&autostart=1', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');

  // 0. The run starts at WAVE SETUP (no organ screen first), with only the
  //    meteor's limbs in the draw. The ORGANS button opens the organ stage
  //    between waves; the clock holds while it is open. Grow a Bone Forge by
  //    hover (ghost + preview), right-click (rotate), click; it unlocks its limbs.
  //    Click the grown forge to level it.
  const startsAtSetup = await page.locator('#under').isHidden();
  const hand0 = await page.evaluate(() => window.broodfall.sim.hand.map((c) => c.family));
  if (startsAtSetup && hand0.every((f) => ['spitter', 'lasher', 'spine'].includes(f))) {
    pass('run starts at wave setup; the draw holds only the meteor\'s limbs');
  } else fail('start state', `under hidden=${startsAtSetup} hand=${hand0}`);
  await page.evaluate(() => { window.broodfall.sim.meat.war = 500; });
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)', { timeout: 5000 });
  const t0 = await page.evaluate(() => window.broodfall.sim.time);
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => window.broodfall.sim.time);
  if (t1 === t0) pass('ORGANS opens the organ stage and the clock holds');
  else fail('organ pause', `time moved ${t0} -> ${t1}`);
  await page.locator('#under-palette [data-organ="forge"]').click();
  // Find a spot where the forge fits at SOME rotation; rotate with right-clicks until it fits.
  const spot = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (s.canBuildOrgan('forge', c, r)) return { c, r };
    return null;
  });
  const cellEl = page.locator(`#under-grid [data-cell="${spot.c}"]`);
  await cellEl.hover();
  for (let k = 0; k < spot.r; k++) await cellEl.click({ button: 'right' });
  const ghost = await page.locator('#under-grid .ghost-ok').count();
  const preview = await page.locator('#under-status').innerText();
  await cellEl.click();
  const w = await page.evaluate(() => ({ organs: window.broodfall.sim.organs.map((o) => o.organ), impaler: window.broodfall.sim.drawWeights().impaler }));
  if (ghost === 4 && /GROW BONE FORGE HERE/i.test(preview) && /unlocks/i.test(preview) && w.organs.join() === 'forge' && w.impaler > 0) {
    pass('hover shows the 4-cell ghost + preview, right-click rotates, click grows the forge — its limbs unlock');
  } else fail('grow forge', `ghost=${ghost} preview="${preview}" ${JSON.stringify(w)}`);
  const forgeCell = await page.evaluate(() => window.broodfall.sim.organs[0].cells[0]);
  await page.locator(`#under-grid [data-cell="${forgeCell}"]`).click();
  const lvl = await page.evaluate(() => window.broodfall.sim.organs[0].level);
  if (lvl === 2) pass('clicking a grown theme organ levels it');
  else fail('level organ', `level=${lvl}`);
  await page.locator('#under-done').click();
  if (await page.locator('#under').isHidden()) pass('TO THE SURFACE closes the organ stage');
  else fail('under close', 'still open');
  // The later limb checks need every theme's limbs drawable: grow the other themes.
  const grownAll = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 9999; s.meat.science = 9999;
    for (const id of ['gut', 'venom', 'nerve', 'lattice', 'womb', 'marrow', 'resonance', 'catapult', 'runner']) {
      let done = false;
      for (let c = 0; c < s.under.cells.length && !done; c++) {
        for (let r = 0; r < 4 && !done; r++) {
          if (s.canBuildOrgan(id, c, r)) done = s.issue({ kind: 'build-organ', organ: id, cell: c, rot: r }).ok;
        }
      }
    }
    return s.organs.length;
  });
  if (grownAll !== 10) fail('grow all themes + sling/lance organs', `organs=${grownAll}`);

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

  // 6. The meteor is an organ too: click it in the organ stage to level the core.
  await page.evaluate(() => { window.broodfall.sim.meat.war = 500; });
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)', { timeout: 3000 });
  const meteor = await page.evaluate(() => window.broodfall.sim.under.cells.findIndex((c) => c.kind === 'meteor'));
  await page.locator(`#under-grid [data-cell="${meteor}"]`).click();
  const coreLv = await page.evaluate(() => window.broodfall.sim.coreLevel);
  if (coreLv === 2) pass('clicking the meteor levels the core theme');
  else fail('core level', `coreLevel=${coreLv}`);
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
