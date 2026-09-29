/**
 * THE NEW SYSTEMS, PLAYED the way Collins plays: the dev server (what `npm start` runs), the
 * menu, a click on deploy, and then clicks for everything the systems ask of a player.
 *
 *   1. The organ stage from the bar: a Scaffold Gland and a Seeding Gland grown by clicks
 *      (the seeding gland on the surface row; refused below it).
 *   2. Waves played until the glands have grown a plinth and a Seedling.
 *   3. A limb raised by a plinth; a bare roof raised so that a BIG limb fits; the big limb
 *      built there by its card; the Seedling placed by its card, shot up and landed.
 *   4. A second page: the scripted player late in a run, with big limbs and plinths.
 *
 * Setup that is NOT a player's gesture, said here so nobody mistakes it for one: meat is
 * topped up and the landing site made hard to kill, so that the beat reaches wave 2 in a few
 * seconds whatever the draw; the plinth stock is topped up once, for the roof demonstration;
 * the big limb's card is handed in (the draw is random).
 *
 * Usage: node tools/shot-play-new.mjs    (it starts the dev server itself)
 * Pictures for Collins: notes/screens/2026-09-29/play-NN-what.jpg
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-09-29');
mkdirSync(out, { recursive: true });
/** The dev server's port: eleven below the beats' own, as the player's-path beat does. */
const PORT = Number(process.env.BROODFALL_PORT || 5199) - 11;
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

function freePort() {
  try {
    const o = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of o.split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

/** A picture for Collins: the PNG the browser takes, kept as a JPEG. */
async function picture(target, name, opts = {}) {
  const png = join(out, `${name}.png`);
  await target.screenshot({ path: png, ...opts });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(out, `${name}.jpg`)]);
  rmSync(png);
  console.log(`  picture: ${join(out, `${name}.jpg`)}`);
}

/** A point on the canvas that the game says lands on this cell. */
async function pointAt(page, canvas, cell) {
  const box = await canvas.boundingBox();
  return page.evaluate(([c, b]) => {
    const s = window.broodfall.sim;
    const p = s.cellCenter(c);
    const q = window.broodfall.worldToScreen(p.x, p.y);
    for (const [dx, dy] of [[0, 0], [0, -6], [0, 6], [-8, 0], [8, 0], [0, -12], [5, -4], [-5, -4]]) {
      const x = b.x + (q.x / q.vw) * b.width + dx, y = b.y + (q.y / q.vh) * b.height + dy;
      if (window.broodfall.cellAtClient(x, y) === c) return { x, y };
    }
    return null;
  }, [cell, box]);
}

/** Click a card of the hand by its name. */
async function pickCard(page, name) {
  await page.waitForTimeout(400);
  const cards = page.locator('#hand .card');
  for (let k = 0; k < await cards.count(); k++) {
    if ((await cards.nth(k).locator('.card-name').textContent()) === name) { await cards.nth(k).click(); return true; }
  }
  return false;
}

/** Back to the board if a cleared wave opened the organ stage. */
async function surface(page) {
  await page.waitForTimeout(300);
  if (await page.locator('#under-done').isVisible()) await page.locator('#under-done').click();
  await page.waitForTimeout(200);
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  // ------------------------------------------------------------------ the player's page
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?seed=11&speed=0&biome=suburb`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 60000 });
  await page.locator('#menu-deploy').click();
  await page.waitForTimeout(600);
  const canvas = page.locator('#stage canvas');
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 600; s.meat.science = 200;
    s.coreMaxHp *= 20; s.coreHp = s.coreMaxHp;
  });

  // 1. The organ stage from the bar, and the two glands by clicks.
  await page.locator('#open-under').click();
  await page.waitForTimeout(500);
  check(await page.locator('#under').isVisible(), 'the ORGANS button opens the organ stage');
  const growByClicks = async (organ) => {
    const spot = await page.evaluate((o) => {
      const s = window.broodfall.sim;
      for (let c = 0; c < s.under.cells.length; c++) if (s.canBuildOrgan(o, c, 0)) return c;
      return -1;
    }, organ);
    if (spot < 0) return false;
    await page.locator(`#under-palette [data-organ="${organ}"]`).click();
    await page.locator(`#under-grid [data-cell="${spot}"]`).hover();
    await page.waitForTimeout(150);
    await page.locator(`#under-grid [data-cell="${spot}"]`).click();
    await page.waitForTimeout(300);
    return page.evaluate((o) => window.broodfall.sim.organs.some((x) => x.organ === o), organ);
  };
  // The seeding gland is refused away from the surface: a click on a deep cell grows nothing.
  const deep = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = s.under.w * 3; c < s.under.cells.length; c++) {
      const cells = s.organFootprint('seeder', c, 0);
      if (cells && cells.every((x) => s.under.cells[x].kind === 'soil')) return c;
    }
    return -1;
  });
  await page.locator('#under-palette [data-organ="seeder"]').click();
  await page.locator(`#under-grid [data-cell="${deep}"]`).click();
  await page.waitForTimeout(200);
  check(!(await page.evaluate(() => window.broodfall.sim.organs.some((x) => x.organ === 'seeder'))), 'a Seeding Gland clicked deep in the soil is refused');
  await page.keyboard.press('Escape');
  check(await growByClicks('scaffold'), 'a Scaffold Gland is grown by clicks');
  check(await growByClicks('seeder'), 'a Seeding Gland is grown by clicks, touching the surface');
  await page.waitForTimeout(900);
  await picture(page, 'play-01-organ-stage-both-glands');
  await page.locator('#under-done').click();
  await page.waitForTimeout(300);

  // A few limbs by their cards, so the waves are fought.
  for (let k = 0; k < 4; k++) {
    const card = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const i = s.hand.findIndex((h) => !['spine', 'swamp'].includes(h.family) && s.canAfford(window.broodfallSpec?.(h.family) ?? {}));
      return i >= 0 ? s.hand[i].family : null;
    });
    if (!card) break;
    const cell = await page.evaluate((f) => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      const cs = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, f)) cs.push(c);
      cs.sort((a, b) => d(a) - d(b));
      return cs[0] ?? -1;
    }, card);
    const pt = cell >= 0 ? await pointAt(page, canvas, cell) : null;
    if (!pt) continue;
    const names = { spitter: 'Spitter', lasher: 'Lasher', burster: 'Burster', maw: 'Maw' };
    if (!(await pickCard(page, names[card] ?? ''))) continue;
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(200);
  }

  // 2. Waves, until the glands have grown what they grow (every two turns).
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => ({ cleared: window.broodfall.sim.wavesCleared, plinths: window.broodfall.sim.plinths, seed: window.broodfall.sim.hand.some((h) => h.family === 'sprout'), phase: window.broodfall.sim.phase }));
    if (s.cleared >= 2 && s.plinths > 0 && s.seed) break;
    if (s.phase === 'growth') await page.evaluate(() => window.broodfall.sim.issue({ kind: 'call-early' }));
    await page.evaluate(() => window.broodfall.step(60));
    if (i % 5 === 0) await surface(page);
  }
  await surface(page);
  const grown = await page.evaluate(() => ({ cleared: window.broodfall.sim.wavesCleared, plinths: window.broodfall.sim.plinths, seed: window.broodfall.sim.hand.some((h) => h.family === 'sprout') }));
  check(grown.plinths > 0, 'the Scaffold Gland grew a plinth by the second cleared wave', `${grown.plinths} after ${grown.cleared} waves`);
  check(grown.seed, 'the Seeding Gland put a Seedling in the hand');
  await page.waitForTimeout(500);
  await picture(page, 'play-02-plinth-bar-with-stock', { clip: { x: 0, y: 860, width: 1600, height: 140 } });

  // 3a. A limb raised by a plinth, by clicks.
  const gun = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.family !== 'sprout' && !x.cells && s.plinthGround(x.cell));
    return t ? { id: t.id, cell: t.cell, h: s.map.heights[t.cell], reach: s.statsOf(t).range } : null;
  });
  check(gun !== null, 'there is a limb to raise');
  // Close on it.
  const gp = await pointAt(page, canvas, gun.cell);
  await page.mouse.move(gp.x, gp.y);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(700);
  await picture(page, 'play-03-limb-before-plinth', { clip: await canvas.boundingBox() });
  await page.locator('#plinths').click();
  const gp2 = await pointAt(page, canvas, gun.cell);
  await page.mouse.move(gp2.x, gp2.y - 4);
  await page.mouse.click(gp2.x, gp2.y - 4);
  await page.waitForTimeout(500);
  const raised = await page.evaluate((id) => { const s = window.broodfall.sim; const t = s.towers.find((x) => x.id === id); return { h: s.map.heights[t.cell], reach: s.statsOf(t).range }; }, gun.id);
  check(raised.h === gun.h + 1, 'a click on the limb with a plinth picked raises it a level', `${gun.h} to ${raised.h}, reach ${gun.reach.toFixed(0)} to ${raised.reach.toFixed(0)}`);
  await picture(page, 'play-04-limb-after-plinth', { clip: await canvas.boundingBox() });

  // 3b. A roof levelled, then a BIG limb on it.
  await page.evaluate(() => { window.broodfall.sim.plinths += 3; });
  await page.keyboard.press('Home');
  await page.waitForTimeout(600);
  const square = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const ok = (q) => s.map.cells[q] === 0 && s.isCreeped(q) && !s.isOccupied(q) && q !== s.map.coreCell && (s.map.heights[q] || 1) < 4;
    for (let c = 0; c < s.map.cells.length - W - 1; c++) {
      if (c % W === W - 1) continue;
      const sq = [c, c + 1, c + W, c + W + 1];
      if (!sq.every(ok)) continue;
      const hs = sq.map((q) => s.map.heights[q] || 1);
      const top = Math.max(...hs);
      const low = sq.filter((_, i) => hs[i] < top);
      if (low.length >= 1 && low.length <= 3 && low.every((q) => (s.map.heights[q] || 1) === top - 1)) return { sq, low };
    }
    // None on this board: a flat square, one of its roofs raised first (setup), the other three to level.
    for (let c = 0; c < s.map.cells.length - W - 1; c++) {
      if (c % W === W - 1) continue;
      const sq = [c, c + 1, c + W, c + W + 1];
      if (!sq.every(ok) || new Set(sq.map((q) => s.map.heights[q] || 1)).size !== 1 || (s.map.heights[c] || 1) > 2) continue;
      s.plinths += 1;
      s.issue({ kind: 'place-plinth', cell: sq[3] });
      return { sq, low: sq.slice(0, 3) };
    }
    return null;
  });
  check(square !== null, 'a square of four roofs, some of them a level low');
  const sq0 = await pointAt(page, canvas, square.sq[0]);
  await page.mouse.move(sq0.x, sq0.y);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(700);
  await picture(page, 'play-05-roof-before-levelling', { clip: await canvas.boundingBox() });
  for (const q of square.low) {
    // A plinth stays picked while there are more: the bar is clicked only to pick one up.
    if (!(await page.locator('#plinths.on').count())) await page.locator('#plinths').click();
    const p = await pointAt(page, canvas, q);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(400);
  }
  const level = await page.evaluate((sq) => new Set(sq.map((q) => window.broodfall.sim.map.heights[q])).size === 1, square.sq);
  check(level, 'plinths clicked onto the low roofs level the square');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.broodfall.sim.hand.push({ id: 770001, family: 'ward', free: true }));
  check(await pickCard(page, 'Ward Membrane'), 'the Ward Membrane card is in the hand');
  const wp = await pointAt(page, canvas, square.sq[0]);
  await page.mouse.move(wp.x, wp.y);
  await page.waitForTimeout(300);
  await picture(page, 'play-06-big-limb-preview-on-levelled-roof', { clip: await canvas.boundingBox() });
  await page.mouse.click(wp.x, wp.y);
  await page.waitForTimeout(500);
  const ward = await page.evaluate((sq) => { const s = window.broodfall.sim; const t = s.towers.find((x) => x.family === 'ward'); return t ? s.cellsOf(t).slice().sort().join() === sq.slice().sort().join() : false; }, square.sq);
  check(ward, 'the BIG limb stands on the levelled square, all four cells');
  await picture(page, 'play-07-big-limb-on-levelled-roof', { clip: await canvas.boundingBox() });

  // 3c. The Seedling, by its card.
  await page.keyboard.press('Home');
  await page.waitForTimeout(600);
  const target = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (!s.canBuildTower(c, 'sprout')) continue;
      if (s.towers.some((t) => Math.hypot((t.cell % W) - (c % W), Math.floor(t.cell / W) - Math.floor(c / W)) < 3)) continue;
      const d = Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      if (d >= 5 && d <= 9) return c;
    }
    return -1;
  });
  // Close enough on the landing site and the target that the flight can be seen.
  const mid = await page.evaluate((c) => { const s = window.broodfall.sim; const W = s.cfg.gridW; const a = s.map.coreCell; return Math.round((Math.floor(a / W) + Math.floor(c / W)) / 2) * W + Math.round(((a % W) + (c % W)) / 2); }, target);
  const mp = await pointAt(page, canvas, mid);
  if (mp) { await page.mouse.move(mp.x, mp.y); for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -240); await page.waitForTimeout(700); }
  check(await pickCard(page, 'Seedling'), 'the free Seedling card is in the hand');
  // Worked out AFTER the pick: picking a card moves the view, so a point taken before it is stale.
  const tp = await pointAt(page, canvas, target);
  const diag = await page.evaluate(([x, y, c]) => {
    const el = document.elementFromPoint(x, y);
    return { at: window.broodfall.cellAtClient(x, y), ok: window.broodfall.sim.canBuildTower(c, 'sprout'), el: el ? el.tagName + '#' + el.id + '.' + el.className : 'none', plinthsOn: document.getElementById('plinths')?.className, hand: window.broodfall.sim.hand.map((h) => h.family).join() };
  }, [tp.x, tp.y, target]);
  console.log(`  seedling target cell ${target}, point ${JSON.stringify(tp)}, ${JSON.stringify(diag)}`);
  await page.mouse.move(tp.x, tp.y);
  await page.waitForTimeout(200);
  await page.mouse.click(tp.x, tp.y);
  await page.waitForTimeout(80);
  check(await page.evaluate(() => window.broodfall.sim.seedFlights.length > 0), 'placed, the Seedling is shot up from the landing site');
  await page.evaluate(() => window.broodfall.step(4));
  await page.waitForTimeout(250);
  await picture(page, 'play-08-seedling-in-the-air', { clip: await canvas.boundingBox() });
  await page.evaluate(() => window.broodfall.step(12));
  await page.waitForTimeout(400);
  check(await page.evaluate(() => window.broodfall.sim.towers.some((t) => t.family === 'sprout') && window.broodfall.sim.seedFlights.length === 0), 'and it lands where it was placed');
  await picture(page, 'play-09-seedling-landed', { clip: await canvas.boundingBox() });
  check(errors.length === 0, 'no errors in the player\'s page', errors.slice(0, 3).join(' | '));
  await page.close();

  // ------------------------------------------------------------------ 4. the scripted player, late
  const bot = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await bot.goto(`http://localhost:${PORT}/?auto=1&seed=7&speed=0&directive=hold&biome=megacity`, { waitUntil: 'load' });
  await bot.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 60000 });
  for (let i = 0; i < 200; i++) {
    const s = await bot.evaluate(() => ({ wave: window.broodfall.summary().wave, outcome: window.broodfall.summary().outcome }));
    if (s.wave >= 10 || s.outcome !== 'playing') break;
    await bot.evaluate(() => window.broodfall.step(100));
  }
  const late = await bot.evaluate(() => {
    const s = window.broodfall.sim;
    let raised = 0;
    for (let c = 0; c < s.map.plinths.length; c++) if (s.map.plinths[c] > 0) raised++;
    return { wave: window.broodfall.summary().wave, big: s.towers.filter((t) => t.cells).length, raised, glands: s.organs.filter((o) => o.organ === 'scaffold' || o.organ === 'seeder').length, seedlings: s.towers.filter((t) => t.family === 'sprout').length };
  });
  check(late.big > 0, 'late in the scripted run there are limbs on several cells', `${late.big} at wave ${late.wave}`);
  check(late.glands === 2 && late.raised > 0, 'the scripted player grew both glands and placed plinths', `${late.glands} glands, ${late.raised} raised cells, ${late.seedlings} seedlings standing`);
  await bot.waitForTimeout(700);
  await picture(bot, 'play-10-scripted-run-late', { clip: await bot.locator('#stage canvas').boundingBox() });
  await bot.close();
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nNEW SYSTEMS PLAYED: ${failures.length} failure(s): ${failures.join('; ')}` : '\nNEW SYSTEMS PLAYED: all verified.');
process.exit(failures.length ? 1 : 0);
