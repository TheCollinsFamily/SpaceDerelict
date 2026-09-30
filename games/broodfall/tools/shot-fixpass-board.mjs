/**
 * THE BOARD FIX PASS (Sep 30 2026, Collins: "fix up everything that needs fixing up"), photographed in the
 * real game: the DEV server on its own port, Chromium with the GPU on. Every picture fails the beat if any
 * art is missing (`artMissing()`) or a "did not load" notice is over the board.
 *
 *   pick     a click on the head of a limb that stands in front of another limb's roof: which limb is selected
 *   impaler  an Impaler built facing south, firing at a soldier to its north: which way its harpoon points
 *   lobber   a Bile Lobber's throw, three moments (the throw ordered, 0.2 s, 0.5 s): where the glob is
 *   sling    the same for a Spore Sling
 *   status   a webbed, poisoned, burning soldier in a street behind a tall block: what of it the block hides
 *   plinth   a limb raised on a plinth, mid-rise: where its health bar and trait marks are
 *   organ    the organ stage's street line in three tile sets: the STREET LEVEL label
 *
 * Usage: node tools/shot-fixpass-board.mjs [scene ...] --tag before|after
 * Pictures: notes/screens/2026-09-30/fixpass-board-<scene>-<tag>[-n].jpg (PNGs in tools/screenshots/).
 */
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5343);
const argv = process.argv.slice(2);
const valueOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
const TAG = valueOf('--tag') ?? 'after';
const want = new Set(argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--tag'));
const scene = (id) => want.size === 0 || want.has(id);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const jpg = (png, name) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, name)]);

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
/**
 * The DEV server (vite's own, as `npm start` serves), on this beat's port, with no hot reload (another session
 * saving a file must not reload the page mid-beat). BROODFALL_PUBLIC=<folder> serves the art from a copy of
 * public/ taken at one moment: the art session re-bakes pictures while this runs, and a picture half-written
 * when the page asks for it is a "did not load" notice that says nothing about the board.
 */
async function startDev() {
  freePort();
  const { createServer } = await import('vite');
  const dev = await createServer({
    root, configFile: join(root, 'vite.config.ts'), logLevel: 'warn',
    ...(process.env.BROODFALL_PUBLIC ? { publicDir: process.env.BROODFALL_PUBLIC } : {}),
    server: { port: PORT, strictPort: true, hmr: false, watch: null },
  });
  await dev.listen();
  return { kill: () => { void dev.close(); } };
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const canvas = page.locator('#stage canvas');
  const clean = async () => {
    const missing = await page.evaluate(() => window.broodfall.artMissing());
    const notice = await page.evaluate(() => { const el = document.getElementById('art-notice'); return !!el && !el.classList.contains('hidden') ? el.textContent : ''; });
    const banner = await page.evaluate(() => /did not load/i.test(document.body.innerText) ? 'a "did not load" banner' : '');
    return [...missing, notice, banner].filter(Boolean).join(' | ').slice(0, 200);
  };
  const shot = async (name, el = canvas) => {
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(150);
    const bad = await clean();
    check(!bad, `${name}: all its art loaded, no notice`, bad);
    await el.screenshot({ path: png });
    jpg(png, `${name}.jpg`);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  const ticks = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(30); } };
  const fresh = async (seed = 11, biome = 'suburb') => {
    // Loaded twice at most: a page caught while another session saves a file it imports is loaded again.
    for (let n = 0; ; n++) {
      await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=${biome}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      const up = await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 60000 }).then(() => true, () => false);
      if (up) break;
      if (n) throw new Error('the game did not start twice: ' + errors.slice(-3).join(' | '));
    }
    await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 50; s.enemies.length = 0; s.projectiles.length = 0; s.shells.length = 0; s.arcs.length = 0; if (s.spawnQueue) s.spawnQueue.length = 0; });
    await page.waitForTimeout(300);
  };
  const build = (family, cell, facing = 'S') => page.evaluate(([family, cell, facing]) => {
    const s = window.broodfall.sim;
    s.hand[0] = { id: 870000 + Math.floor(Math.random() * 9999), family, free: true };
    const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing });
    return r.ok ? s.towers[s.towers.length - 1].id : -1;
  }, [family, cell, facing]);
  const put = (list) => page.evaluate((items) => {
    const s = window.broodfall.sim;
    return items.map(({ kind, cell, dx = 0, dy = 0 }) => {
      const e = s.spawnEnemy(kind, s.gates[0]);
      const c = s.cellCenter(cell);
      e.pos.x = c.x + dx; e.pos.y = c.y + dy;
      e.revealedUntil = s.time + 999;
      e.hp *= 40; e.maxHp *= 40;
      e.speed = 0;
      return e.id;
    });
  }, list);
  /** The view settles where it is going (it eases for about a second). */
  const settle = async () => {
    let was = null;
    for (let i = 0; i < 60; i++) {
      const c = await page.evaluate(() => window.broodfall.camera());
      if (was && Math.abs(c.x - was.x) < 0.25 && Math.abs(c.y - was.y) < 0.25 && Math.abs(c.scale - was.scale) < 0.0005) return;
      was = c;
      await page.waitForTimeout(100);
    }
  };
  /** Board pixels (before the camera) to page coordinates. */
  const boardToPage = async (p) => {
    const bb = await canvas.boundingBox();
    const cam = await page.evaluate(() => window.broodfall.camera());
    return { x: bb.x + ((p.x * cam.scale + cam.x) / cam.vw) * bb.width, y: bb.y + ((p.y * cam.scale + cam.y) / cam.vh) * bb.height };
  };
  const closeOn = async (p, zoom = 8, up = 0) => {
    await page.keyboard.press('Home');
    await settle();
    const bb = await canvas.boundingBox();
    const where = async () => { const s = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [p.x, p.y]); return { x: bb.x + (s.x / s.vw) * bb.width, y: bb.y + ((s.y - up) / s.vh) * bb.height }; };
    let q = await where();
    await page.mouse.move(q.x, q.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await settle();
    for (let round = 0; round < 5; round++) {
      q = await where();
      if (Math.hypot(q.x - (bb.x + bb.width / 2), q.y - (bb.y + bb.height / 2)) < 10) break;
      await page.keyboard.down('Shift');
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await settle();
    }
    // The pointer off the board (no hover ring in the picture), but not at an edge (no edge scroll).
    await page.mouse.move(bb.x + bb.width / 2, bb.y + 4);
  };
  const posOf = (id) => page.evaluate((id) => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.id === id) ?? s.enemies.find((x) => x.id === id);
    return t ? { x: t.pos.x, y: t.pos.y } : null;
  }, id);

  // ---- 1. A click on the head of a limb standing in front of another limb's roof.
  if (scene('pick')) {
    await fresh(11);
    // Two single-cell roofs of one height, one straight up the screen from the other ((x-1, y-1) at turn 0).
    const pair = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const core = s.cellCenter(s.map.coreCell);
      const ok = (c) => c >= 0 && s.canBuildTower(c, 'spitter') && s.canBuildTower(c, 'ocular');
      const out = [];
      for (let c = 0; c < s.map.cells.length; c++) {
        const b = c - W - 1;
        if (!ok(c) || !ok(b) || c % W === 0) continue;
        if (s.map.heights[c] !== s.map.heights[b]) continue;
        const p = s.cellCenter(c);
        out.push({ front: c, back: b, d: Math.hypot(p.x - core.x, p.y - core.y) });
      }
      return out.sort((a, b) => a.d - b.d)[0] ?? null;
    });
    check(!!pair, 'pick: two roofs one behind the other');
    if (pair) {
      const backId = await build('spitter', pair.back);
      const frontId = await build('ocular', pair.front);
      await ticks(3);
      await closeOn(await posOf(frontId), 9, 40);
      // The point: two thirds of the way up the front limb's picture, straight over its foot.
      const head = await page.evaluate((id) => {
        const v = window.broodfall.renderer.limbs.get(id);
        const s = v.sprite;
        return { x: s.position.x, y: s.position.y - Math.abs(s.scale.y) * v.art.frame * s.anchor.y * 0.66 };
      }, frontId);
      const q = await boardToPage(head);
      await page.mouse.click(q.x, q.y);
      await page.waitForTimeout(300);
      const sel = await page.evaluate(() => window.broodfall.renderer.selectedTowerId);
      const name = sel === frontId ? 'the Ocular Stalk clicked (in front)' : sel === backId ? 'the Spitter BEHIND it' : String(sel);
      console.log(`  pick: selected ${name}`);
      // A dot where the click was (on the page, over the canvas).
      await page.evaluate(([x, y]) => {
        const d = document.createElement('div');
        d.id = 'fixpass-dot';
        d.style.cssText = `position:fixed;left:${x - 7}px;top:${y - 7}px;width:14px;height:14px;border:3px solid #00ffff;border-radius:50%;z-index:99999;pointer-events:none;box-shadow:0 0 0 2px #000`;
        document.body.appendChild(d);
      }, [q.x, q.y]);
      await page.mouse.move(q.x + 400, 10);
      await shot(`fixpass-board-pick-${TAG}`, page);
      await page.evaluate(() => document.getElementById('fixpass-dot')?.remove());
      if (TAG === 'after') check(sel === frontId, 'pick: the click on the front limb selects it', name);
    }
  }

  // ---- 2. The impaler, built facing south, fires north.
  if (scene('impaler')) {
    await fresh(11);
    const plan = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const core = s.cellCenter(s.map.coreCell);
      const best = [];
      for (let c = 0; c < s.map.cells.length; c++) {
        if (!s.groundFor(c, 'impaler', 'S')) continue;
        const p = s.cellCenter(c);
        // A street cell 2 to 4 cells straight north of it.
        for (let k = 2; k <= 4; k++) {
          const t = c - k * W;
          if (t < 0 || s.map.cells[t] !== 1) continue;
          best.push({ cell: c, target: t, d: Math.hypot(p.x - core.x, p.y - core.y) + k * 5 });
          break;
        }
      }
      return best.sort((a, b) => a.d - b.d)[0] ?? null;
    });
    check(!!plan, 'impaler: a roof with a street to its north');
    if (plan) {
      const id = await build('impaler', plan.cell, 'S');
      check(id >= 0, 'impaler: built facing south');
      await put([{ kind: 'soldier', cell: plan.target }]);
      await closeOn(await posOf(id), 8, 40);
      const base = await page.evaluate(() => window.broodfall.fx().shots ?? 0);
      await page.evaluate((id) => { window.broodfall.sim.towers.find((t) => t.id === id).cooldown = 0; }, id);
      let out = false;
      for (let i = 0; i < 40 && !out; i++) { await ticks(1); out = (await page.evaluate(() => window.broodfall.fx().shots ?? 0)) > base; }
      check(out, 'impaler: its harpoon is out');
      await ticks(1);
      await shot(`fixpass-board-impaler-${TAG}`);
    }
  }

  // ---- 3. The lobber's and the sling's throws, three moments.
  for (const [fam, order] of [['lobber', 'bile-throw'], ['sling', 'sling-throw']]) {
    if (!scene(fam)) continue;
    await fresh(11);
    const plan = await page.evaluate((fam) => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const core = s.cellCenter(s.map.coreCell);
      const out = [];
      for (let c = 0; c < s.map.cells.length; c++) {
        if (!s.canBuildTower(c, fam)) continue;
        const p = s.cellCenter(c);
        // A street cell three cells down-left on the screen (toward the camera: its throw is seen whole).
        for (const t of [c + 3 * W, c + 3 * W - 1, c + 2 * W, c + 3]) {
          if (t < 0 || t >= s.map.cells.length || s.map.cells[t] !== 1) continue;
          out.push({ cell: c, target: t, d: Math.hypot(p.x - core.x, p.y - core.y) });
          break;
        }
      }
      return out.sort((a, b) => a.d - b.d)[0] ?? null;
    }, fam);
    check(!!plan, `${fam}: a roof with a street before it`);
    if (!plan) continue;
    const id = await build(fam, plan.cell, 'S');
    await ticks(2);
    const tp = await posOf(id);
    const ep = await page.evaluate((c) => window.broodfall.sim.cellCenter(c), plan.target);
    await closeOn({ x: tp.x + (ep.x - tp.x) * 0.4, y: tp.y + (ep.y - tp.y) * 0.4 }, 8, 60);
    const r = await page.evaluate(([id, cell, order]) => {
      const s = window.broodfall.sim;
      const t = s.towers.find((x) => x.id === id);
      t.cooldown = 0;
      return s.issue({ kind: order, towerId: id, cell });
    }, [id, plan.target, order]);
    check(r.ok, `${fam}: the throw is ordered`, JSON.stringify(r));
    // Tick until the sim has the glob or clot in the air.
    let out = false;
    for (let i = 0; i < 20 && !out; i++) { await ticks(1); out = await page.evaluate((fam) => (fam === 'lobber' ? window.broodfall.sim.bileFlights : window.broodfall.sim.clotFlights).length > 0, fam); }
    check(out, `${fam}: in the air in the sim`);
    await shot(`fixpass-board-${fam}-${TAG}-1`);
    await ticks(2);
    await shot(`fixpass-board-${fam}-${TAG}-2`);
    await ticks(3);
    await shot(`fixpass-board-${fam}-${TAG}-3`);
  }

  // ---- 4. What is done to a unit, behind a tall block.
  if (scene('status')) {
    await fresh(11);
    const plan = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const core = s.cellCenter(s.map.coreCell);
      const out = [];
      // A street cell whose neighbour toward the camera (x+1, y+1 at turn 0) is a block two or more levels tall.
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== 1) continue;
        const f = c + W + 1;
        if (f >= s.map.cells.length || s.map.cells[f] !== 0 || (s.map.heights[f] || 1) < 2) continue;
        const p = s.cellCenter(c);
        out.push({ street: c, block: f, d: Math.hypot(p.x - core.x, p.y - core.y) });
      }
      return out.sort((a, b) => a.d - b.d)[0] ?? null;
    });
    check(!!plan, 'status: a street behind a tall block');
    if (plan) {
      const [uid] = await put([{ kind: 'soldier', cell: plan.street, dx: 6, dy: 6 }]);
      await page.evaluate((uid) => {
        const s = window.broodfall.sim;
        const e = s.enemies.find((x) => x.id === uid);
        e.slowUntil = s.time + 999; e.slowFactor = 0.5; e.poisonUntil = s.time + 999; e.poisonDps = 0.001; e.burnUntil = s.time + 999; e.burnDps = 0.001;
      }, uid);
      await ticks(2);
      await closeOn(await posOf(uid), 10, 20);
      await ticks(1);
      await shot(`fixpass-board-status-${TAG}`);
    }
  }

  // ---- 5. A limb rising on a plinth.
  if (scene('plinth')) {
    await fresh(11);
    const cell = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const core = s.cellCenter(s.map.coreCell);
      const cs = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'spitter')) { const p = s.cellCenter(c); cs.push([c, Math.hypot(p.x - core.x, p.y - core.y)]); }
      return cs.sort((a, b) => a[1] - b[1])[3][0];
    });
    const id = await build('spitter', cell);
    // Evolved twice (its crest marks show) and a wound (so its health bar shows).
    await page.evaluate((id) => {
      const s = window.broodfall.sim;
      const t = s.towers.find((x) => x.id === id);
      t.hp = t.maxHp * 0.6;
      t.upgrades = ['A', 'B'];
    }, id);
    await ticks(2);
    await closeOn(await posOf(id), 10, 60);
    await shot(`fixpass-board-plinth-${TAG}-1`);
    await page.evaluate((id) => {
      const s = window.broodfall.sim;
      const t = s.towers.find((x) => x.id === id);
      s.plinths = 2;
      s.issue({ kind: 'place-plinth', cell: t.cell });
    }, id);
    // The rise takes 1.8 s of the renderer's own clock: a picture a third of the way, and when it has risen.
    await page.evaluate(() => window.broodfall.step(1));
    await page.waitForTimeout(350);
    await shot(`fixpass-board-plinth-${TAG}-2`);
    await page.waitForTimeout(2200);
    await shot(`fixpass-board-plinth-${TAG}-3`);
  }

  // ---- 6. The organ stage's street line, in three tile sets.
  if (scene('organ')) {
    for (const set of ['suburb', 'megacity', 'farmland']) {
      await page.goto(`http://localhost:${PORT}/?seed=7&autostart=1&speed=0&biome=${set}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 60000 });
      await page.locator('#open-under').click();
      await page.waitForSelector('#under:not(.hidden)');
      await page.waitForFunction(() => document.querySelector('#under-surface .skyline-img')?.dataset.set, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const s = await page.locator('#under-surface').boundingBox();
      const png = join(shots, `fixpass-board-organ-${set}-${TAG}.png`);
      const bad = await clean();
      check(!bad, `organ ${set}: all its art loaded, no notice`, bad);
      await page.screenshot({ path: png, clip: { x: Math.max(0, s.x - 20), y: s.y - 40, width: Math.min(700, s.width), height: s.height + 110 } });
      jpg(png, `fixpass-board-organ-${set}-${TAG}.jpg`);
      console.log(`  shot  ${join(screens, `fixpass-board-organ-${set}-${TAG}.jpg`)}`);
    }
  }
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nFIXPASS BOARD: ${failures.length} failure(s): ${failures.join('; ')}` : '\nFIXPASS BOARD: all passed.');
process.exit(failures.length ? 1 : 0);
