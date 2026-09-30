/**
 * THE EFFECTS AND THE LIMBS' OWN MOTIONS, staged in the real page and photographed (Sep 30 2026):
 * shots in flight turned along their flight, lobbed shells and their bursts, lightning, the
 * prism's beam, the ember's flame, the hive's cannon shells, sedation darts and mortar bombs,
 * poison clouds and what is done to a unit (webbed, poisoned, burning), the engines acting,
 * a limb withering, a limb carried off, and the parts of a donor grafted on a limb.
 *
 * Runs against the DEV server on its own port (it never builds, so it never disturbs a beat
 * another session is running against dist/).
 *
 * Usage: node tools/shot-fx.mjs [scene ...]   (scenes: shots lobbed light hive clouds acting wither taken grafts)
 * Screenshots: tools/screenshots/fx-*.png and limbs-*.png; JPEG copies in notes/screens/2026-09-30/.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5231);
const want = new Set(process.argv.slice(2));
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
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
    child.stderr.on('data', (d) => console.log(`  vite  ${String(d).trim().slice(0, 300)}`));
  });
}

let server = await startDev();
let serverDown = false;
const watch = () => server.on('exit', () => { serverDown = true; console.log('  vite  the dev server stopped; it is started again before the next scene'); });
watch();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) { errors.push(m.text()); console.log(`  page  ${m.text().slice(0, 200)}`); } });
  const canvas = page.locator('#stage canvas');
  const shot = async (name) => {
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(250);
    await canvas.screenshot({ path: png });
    jpg(png, `${name}.jpg`);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  /** Step the game a tick at a time, letting the page draw each one. */
  const ticks = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(30); } };
  const fresh = async (seed = 11) => {
    if (serverDown) { serverDown = false; server = await startDev(); watch(); }
    await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=suburb`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 40000 });
    await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 50; });
    await page.waitForTimeout(400);
  };
  /** Street cells 3 to 9 cells from the landing site, nearest first. */
  const streets = () => page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const out = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 && d(c) >= 3 && d(c) <= 9) out.push(c);
    return out.sort((a, b) => d(a) - d(b));
  });
  /** Build limbs on the roofs nearest a cell, each a cell apart. Returns their ids. */
  const build = (families, near, extra = {}) => page.evaluate(([fams, near, extra]) => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const at = (c) => [c % W, Math.floor(c / W)];
    const d = (c) => Math.hypot(at(c)[0] - at(near)[0], at(c)[1] - at(near)[1]);
    const taken = s.towers.flatMap((t) => s.cellsOf(t));
    const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
    const ids = [];
    for (const family of fams) {
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family)) cells.push(c);
      cells.sort((a, b) => d(a) - d(b));
      const cell = cells.find((c) => { const g = s.groundFor(c, family, 'S'); return g && g.every(apart); });
      if (cell === undefined) { ids.push(-1); continue; }
      s.hand[0] = { id: 870000 + Math.floor(Math.random() * 9999), family, free: true };
      const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' });
      if (!r.ok) { ids.push(-1); continue; }
      const t = s.towers[s.towers.length - 1];
      taken.push(...s.cellsOf(t));
      if (extra[family]) Object.assign(t, extra[family]);
      ids.push(t.id);
    }
    return ids;
  }, [families, near, extra]);
  /** Units on cells; `set` stages a state. */
  const put = (list) => page.evaluate((items) => {
    const s = window.broodfall.sim;
    return items.map(({ kind, cell, dx = 0, dy = 0, set }) => {
      const e = s.spawnEnemy(kind, s.gates[0]);
      const c = s.cellCenter(cell);
      e.pos.x = c.x + dx; e.pos.y = c.y + dy;
      e.revealedUntil = s.time + 999;
      if (set === 'deployed') e.deployed = true;
      if (set === 'tough') { e.hp *= 20; e.maxHp *= 20; }
      return e.id;
    });
  }, list);
  const closeOn = async (cell, zoom = 6) => {
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    const where = () => page.evaluate((c) => { const p = typeof c === 'number' ? window.broodfall.sim.cellCenter(c) : c; return window.broodfall.worldToScreen(p.x, p.y); }, cell);
    const b = await canvas.boundingBox();
    const onPage = (at) => ({ x: b.x + (at.x / at.vw) * b.width, y: b.y + (at.y / at.vh) * b.height });
    let p = onPage(await where());
    await page.mouse.move(p.x, p.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(600);
    for (let round = 0; round < 4; round++) {
      p = onPage(await where());
      if (Math.hypot(p.x - (b.x + b.width / 2), p.y - (b.y + b.height / 2)) < 12) break;
      await page.keyboard.down('Shift');
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(500);
    }
  };
  const fx = () => page.evaluate(() => window.broodfall.fx());
  const middle = (ids) => page.evaluate((ids) => {
    const s = window.broodfall.sim;
    const ps = [...s.towers.filter((t) => ids.includes(t.id)).map((t) => t.pos), ...s.enemies.filter((e) => ids.includes(e.id)).map((e) => e.pos)];
    return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
  }, ids);
  /** Tick until `test` (run in the page on window.broodfall.fx()) holds, at most n ticks. */
  const until = async (test, n = 60) => {
    for (let i = 0; i < n; i++) {
      await ticks(1);
      if (await page.evaluate((src) => new Function('f', `return (${src})(f)`)(window.broodfall.fx()), test.toString())) return true;
    }
    return false;
  };

  const art = await (async () => { await fresh(); return page.evaluate(() => window.broodfall.fx()); })();
  check(art.ready, 'the effects sheet is loaded', JSON.stringify(art));

  if (scene('shots')) {
    await fresh(11);
    const st = await streets();
    const col = await put(Array.from({ length: 10 }, (_, i) => ({ kind: i % 3 ? 'soldier' : 'militia', cell: st[i % 4], dx: (i % 3) * 5 - 5, dy: (i % 2) * 6 - 3, set: 'tough' })));
    const limbs = await build(['spitter', 'burster', 'quill', 'impaler', 'tangler', 'blighter', 'mister'], st[1]);
    check(limbs.every((id) => id >= 0), 'seven shooting limbs are built beside the street', limbs.join(','));
    await closeOn(await middle([...limbs, ...col.slice(0, 3)]), 9);
    const flying = await until((f) => f.shots >= 5, 80);
    check(flying, 'shots are in flight as pictures', JSON.stringify(await fx()));
    await shot('fx-01-shots-in-flight');
    await ticks(2);
    await shot('fx-02-shots-and-splats');
  }

  if (scene('lobbed')) {
    await fresh(12);
    const st = await streets();
    const col = await put(Array.from({ length: 8 }, (_, i) => ({ kind: 'soldier', cell: st[i % 3], dx: (i % 3) * 5 - 5, dy: (i % 2) * 6 - 3, set: 'tough' })));
    const limbs = await build(['bombard', 'skipper', 'lobber', 'sling'], st[1]);
    await page.evaluate(([ids, cell]) => {
      const s = window.broodfall.sim;
      const b = s.towers.find((t) => t.id === ids[0]);
      if (b) b.marker = cell;
      // A bile volley and a creep clot, thrown as the player would (the commands aim them).
      const lob = s.towers.find((t) => t.id === ids[2]);
      const sl = s.towers.find((t) => t.id === ids[3]);
      if (lob) { lob.cooldown = 0; s.issue({ kind: 'bile-throw', towerId: lob.id, cell }); }
      if (sl) { sl.cooldown = 0; s.issue({ kind: 'sling-throw', towerId: sl.id, cell }); }
    }, [limbs, st[0]]);
    await closeOn(await middle([...limbs, ...col.slice(0, 2)]), 8);
    const lobbed = await until((f) => f.shells >= 2, 60);
    check(lobbed, 'shells, bile or clots are in flight as pictures', JSON.stringify(await fx()));
    await shot('fx-03-lobbed-in-flight');
    const burst = await until((f) => f.bursts >= 2, 40);
    check(burst, 'what lands bursts where it lands', JSON.stringify(await fx()));
    await shot('fx-04-lobbed-bursts');
  }

  if (scene('light')) {
    await fresh(13);
    const st = await streets();
    const col = await put(Array.from({ length: 10 }, (_, i) => ({ kind: i % 4 === 0 ? 'drummer' : 'soldier', cell: st[i % 4], dx: (i % 3) * 5 - 5, dy: (i % 2) * 6 - 3, set: 'tough' })));
    const limbs = await build(['frond', 'prism', 'prism', 'ember', 'ocular'], st[1]);
    check(limbs.every((id) => id >= 0), 'frond, two prisms, an ember sac and an eye are built', limbs.join(','));
    await closeOn(await middle([...limbs, ...col.slice(0, 3)]), 8);
    const lit = await until((f) => f.streaks >= 2, 80);
    check(lit, 'lightning, beams and flame are drawn', JSON.stringify(await fx()));
    await shot('fx-05-lightning-beam-flame');
    await until((f) => f.streaks >= 3, 40);
    await shot('fx-06-lightning-beam-flame-2');
  }

  if (scene('hive')) {
    await fresh(14);
    const st = await streets();
    const limbs = await build(['spitter', 'maw', 'lasher'], st[2]);
    const hive = await put([
      { kind: 'cannon', cell: st[1], set: 'deployed' },
      { kind: 'dartgun', cell: st[3], set: 'deployed' },
      { kind: 'mortar', cell: st[2] },
    ]);
    await page.evaluate((ids) => { for (const e of window.broodfall.sim.enemies) if (ids.includes(e.id)) { e.hp *= 30; e.maxHp *= 30; } }, hive);
    await closeOn(await middle([...limbs, ...hive]), 8);
    const shell = await until((f) => f.shells >= 1 || f.bombs >= 1, 120);
    check(shell, 'the hive\'s cannon shells, darts or bombs are in flight', JSON.stringify(await fx()));
    await shot('fx-07-hive-shells-in-flight');
    const blast = await until((f) => f.bursts >= 1, 60);
    check(blast, 'a hive shell bursts where it lands', JSON.stringify(await fx()));
    await shot('fx-08-hive-shell-burst');
  }

  if (scene('clouds')) {
    await fresh(15);
    const st = await streets();
    const col = await put(Array.from({ length: 8 }, (_, i) => ({ kind: 'soldier', cell: st[i % 3], dx: (i % 3) * 6 - 6, dy: (i % 2) * 6 - 3, set: 'tough' })));
    await build(['lure', 'tangler', 'blighter', 'ember'], st[1]);
    await page.evaluate((ids) => {
      const s = window.broodfall.sim;
      // Every state at once, to be seen side by side: webbed, poisoned, burning, and caltrops.
      s.enemies.filter((e) => ids.includes(e.id)).forEach((e, i) => {
        if (i % 3 === 0) { e.slowUntil = s.time + 99; e.slowMult = 0.5; }
        if (i % 3 === 1) { e.poisonUntil = s.time + 99; e.poisonDps = 1; }
        if (i % 3 === 2) { e.burnUntil = s.time + 99; e.burnDps = 1; }
      });
      const c = s.cellCenter(s.map.coreCell);
      s.clouds.push({ id: 990001, pos: { ...s.enemies.find((e) => e.id === ids[0]).pos }, radius: 26, ttl: 99, dps: 0 });
      s.caltrops.push({ id: 990002, pos: { ...s.enemies.find((e) => e.id === ids[1]).pos }, cell: 0, hp: 40, thorns: 0, ttl: 99 });
      return c;
    }, col);
    await closeOn(await middle(col.slice(0, 4)), 8);
    await ticks(6);
    await shot('fx-09-clouds-web-poison-burn');
  }

  if (scene('acting')) {
    await fresh(16);
    const st = await streets();
    await put(Array.from({ length: 8 }, (_, i) => ({ kind: 'soldier', cell: st[i % 3], dx: (i % 3) * 5 - 5, dy: 0, set: 'tough' })));
    const shooter = await build(['spitter'], st[1]);
    const engines = await build(['amp', 'twin', 'capacitor', 'conduit', 'choir', 'ward'], st[1]);
    // Every engine points at the spitter.
    await page.evaluate(([sid, ids]) => {
      const s = window.broodfall.sim;
      const t = s.towers.find((x) => x.id === sid);
      for (const e of s.towers.filter((x) => ids.includes(x.id))) {
        const dx = t.pos.x - e.pos.x, dy = t.pos.y - e.pos.y;
        e.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
      }
    }, [shooter[0], engines]);
    await closeOn(await middle([...shooter, ...engines]), 6);
    const acting = async () => page.evaluate(() => window.broodfall.limbsActing());
    let seen = [];
    const engineActing = () => seen.some((f) => f !== 'spitter');
    for (let i = 0; i < 120 && !engineActing(); i++) { await ticks(1); seen = await acting(); }
    check(engineActing(), 'engines play their acting clip when the limb they serve fires', seen.join(', '));
    await shot('limbs-01-engines-acting');
    // Close on each engine, at rest and then mid-act (the game runs a tick at a time until it acts).
    const fams = ['amp', 'twin', 'capacitor', 'conduit', 'choir', 'ward'];
    for (const [i, id] of engines.entries()) {
      if (id < 0) continue;
      const at = await page.evaluate((id) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); return t ? { x: t.pos.x, y: t.pos.y } : null; }, id);
      if (!at) continue;
      await closeOn(at, 12);
      let now = [];
      for (let k = 0; k < 150 && !now.includes(fams[i]); k++) {
        // A ward acts when a limb under it is struck: strike the spitter it covers.
        if (fams[i] === 'ward' && k % 10 === 5) await page.evaluate((sid) => { const t = window.broodfall.sim.towers.find((x) => x.id === sid); if (t) { t.shield = 0; t.hp -= 2; } }, shooter[0]);
        await ticks(1);
        now = await acting();
      }
      await ticks(3);
      if (now.includes(fams[i])) await shot(`limbs-01-${fams[i]}-acting`);
      check(now.includes(fams[i]), `${fams[i]} acts`);
    }
  }

  if (scene('wither')) {
    await fresh(17);
    const st = await streets();
    const limbs = await build(['spitter', 'frond', 'twin', 'burster'], st[1]);
    await closeOn(await middle(limbs), 8);
    await shot('limbs-02-before-withering');
    await page.evaluate((ids) => { const s = window.broodfall.sim; for (const t of [...s.towers]) if (ids.includes(t.id)) s.removeTower(t.id, false); }, limbs);
    await ticks(6);
    const falls = await page.evaluate(() => window.broodfall.limbFalls());
    check(falls.length === limbs.length && falls.every((f) => f.kind === 'wither'), 'limbs that die wither where they stood', JSON.stringify(falls.map((f) => f.clip)));
    await shot('limbs-03-withering');
    await ticks(10);
    await shot('limbs-04-husks');
  }

  if (scene('taken')) {
    await fresh(18);
    const st = await streets();
    const limbs = await build(['spitter'], st[0]);
    const cell = await page.evaluate((id) => window.broodfall.sim.towers.find((t) => t.id === id).cell, limbs[0]);
    const r = await put([{ kind: 'researcher', cell: st[0] }]);
    await page.evaluate(([rid, tid]) => {
      const s = window.broodfall.sim;
      const e = s.enemies.find((x) => x.id === rid);
      const t = s.towers.find((x) => x.id === tid);
      e.pos.x = t.pos.x + 14; e.pos.y = t.pos.y + 10;
      e.extractId = t.id;
      t.hp = 0.5; t.shield = 0;
    }, [r[0], limbs[0]]);
    await closeOn(cell, 9);
    let falls = [];
    for (let i = 0; i < 40 && !falls.length; i++) { await ticks(1); falls = await page.evaluate(() => window.broodfall.limbFalls()); }
    check(falls.some((f) => f.kind === 'taken'), 'a limb a researcher tears out is carried off', JSON.stringify(falls));
    await ticks(2);
    await shot('limbs-05-carried-off');
  }

  if (scene('grafts')) {
    await fresh(19);
    const st = await streets();
    const limbs = await build(['spitter', 'maw', 'impaler', 'twin'], st[1], {
      spitter: { pips: [{ family: 'burster' }, { family: 'quill' }] },
      maw: { pips: [{ family: 'lasher' }, { family: 'blighter' }, { family: 'ocular' }] },
      impaler: { pips: [{ family: 'brood' }] },
      twin: { pips: [{ family: 'ember' }, { family: 'spine' }] },
    });
    await closeOn(await middle(limbs), 8);
    await ticks(2);
    const parts = await page.evaluate(() => window.broodfall.graftsDrawn());
    check(parts >= 6, 'donor parts are drawn on the limbs that carry them', `${parts} parts`);
    await shot('limbs-06-donor-parts');
    await page.evaluate(() => window.broodfall.turnBy(2));
    await ticks(2);
    await closeOn(await middle(limbs), 8);
    await shot('limbs-07-donor-parts-turned');
  }

  check(errors.length === 0, 'nothing is logged as an error', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nFX BEAT: ${failures.length} failure(s): ${failures.join('; ')}` : '\nFX BEAT: all verified.');
process.exit(failures.length ? 1 : 0);
