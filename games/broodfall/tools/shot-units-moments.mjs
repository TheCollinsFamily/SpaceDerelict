/**
 * THE UNITS' MOMENTS, staged in the real page on the DEV server and photographed (Sep 30 2026):
 *
 *   1. the braced cannon and dart battery beside walking ones, at the game's own zoom (and close);
 *      the braced cannon firing
 *   2. fliers falling out of the air: the fall lands whole (the shadewing's was cut off)
 *   3. a squad struck: the flinch (and a pale red flash)
 *   4. the carapace lord's shell: whole, cracked, gone, walking; chips flying off it
 *   5. the royal and the consort as bosses: the arrival, the royal's command, the consort's salute
 *   6. the broodlings and the puppet queens walking and biting for the hive
 *
 * Checks: every staged unit has its picture, the moments are in the manifest, nothing logged as an error.
 *
 * Usage: node tools/shot-units-moments.mjs     (starts its own dev server: BROODFALL_PORT - 23)
 * Screenshots: tools/screenshots/units-*.png, JPEG copies in notes/screens/2026-09-30/.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5199) - 23;
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(String(n));
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
    const timer = setTimeout(() => reject(new Error('vite did not start in 60s')), 60000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

const manifest = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8'));
const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
  const canvas = page.locator('#stage canvas');
  const shot = async (n, what, clip) => {
    const name = `units-${String(n).padStart(2, '0')}-${what}`;
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(250);
    if (clip) await page.screenshot({ path: png, clip }); else await canvas.screenshot({ path: png });
    jpg(png, `${name}.jpg`);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  const fresh = async (seed = 11) => {
    await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=suburb`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 60000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; });
  };
  /** Street cells near the landing site, nearest first. */
  const streets = () => page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const out = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 && d(c) >= 3 && d(c) <= 9) out.push(c);
    return out.sort((a, b) => d(a) - d(b));
  });
  /** Units of these kinds at these cells (plus an offset); returns their ids. */
  const put = (list) => page.evaluate((items) => {
    const s = window.broodfall.sim;
    return items.map(({ kind, cell, dx = 0, dy = 0, set }) => {
      const e = s.spawnEnemy(kind, s.gates[0]);
      const c = s.cellCenter(cell);
      e.pos.x = c.x + dx; e.pos.y = c.y + dy;
      e.revealedUntil = s.time + 999;
      if (set === 'deployed') { e.deployed = true; e.auxCooldown = 99; }
      if (set === 'shield3') e.hitShield = 3;
      if (set === 'shield0') e.hitShield = 0;
      return e.id;
    });
  }, list);
  /** Hold these units where they stand (the sim would walk them off between photographs). */
  const hold = (ids) => page.evaluate((want) => {
    const s = window.broodfall.sim;
    window.__held = Object.fromEntries(s.enemies.filter((e) => want.includes(e.id)).map((e) => [e.id, { ...e.pos }]));
  }, ids);
  /** Step the game a tick at a time, letting the page draw each; held units are put back after each tick. */
  const ticks = async (n, each) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate((fn) => {
        const b = window.broodfall;
        b.step(1);
        for (const e of b.sim.enemies) {
          const at = window.__held?.[e.id];
          if (at) { e.pos.x = at.x; e.pos.y = at.y; if (window.__keepHp) e.hp = e.maxHp; e.leaving = false; }
          // Staged walking beside a braced one: the sim would brace it too (the landing site is in its reach).
          if (window.__walking?.includes(e.id)) e.deployed = false;
        }
        if (fn) (0, eval)(fn)(b.sim);
      }, each ?? null);
      if (process.env.DEBUG_BEAT) console.log(await page.evaluate(() => JSON.stringify(window.broodfall.sim.enemies.map((e) => [e.id, e.kind, Math.round(e.hp), e.leaving ? 'L' : '', e.carrying ? 'C' : '']))));
      await page.waitForTimeout(40);
    }
  };
  /** The view on a world point, the game's zoom plus `zoom` wheel steps, the point in the middle. */
  const closeOn = async (at, zoom = 0) => {
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    const where = () => page.evaluate((c) => window.broodfall.worldToScreen(c.x, c.y), at);
    const b = await canvas.boundingBox();
    const onPage = (p) => ({ x: b.x + (p.x / p.vw) * b.width, y: b.y + (p.y / p.vh) * b.height });
    let p = onPage(await where());
    await page.mouse.move(p.x, p.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(500);
    for (let round = 0; round < 4; round++) {
      p = onPage(await where());
      if (Math.hypot(p.x - (b.x + b.width / 2), p.y - (b.y + b.height / 2)) < 12) break;
      await page.keyboard.down('Shift');
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(400);
    }
    return b;
  };
  const middle = (ids) => page.evaluate((want) => {
    const es = window.broodfall.sim.enemies.filter((e) => want.includes(e.id));
    return { x: es.reduce((a, e) => a + e.pos.x, 0) / es.length, y: es.reduce((a, e) => a + e.pos.y, 0) / es.length };
  }, ids);
  /** A crop of the canvas around its middle, to see a small thing at the game's zoom. */
  const middleCrop = (b, w = 640, h = 400) => ({ x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2, width: w, height: h });

  // 1. Braced beside walking, at the game's own zoom, then close. Then the braced cannon firing.
  if (want(1)) {
    await fresh(21);
    const st = await streets();
    // A limb on the board: with nothing to steal a dart battery goes home at once.
    const limbCell = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.hand[0] = { id: 880020, family: 'spitter', free: true };
      // As far from the landing site as it will grow: near it, it would shoot the staged battery dead.
      const W = s.cfg.gridW;
      const far = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      const cells = [...s.map.cells.keys()].filter((c) => s.canBuildTower(c, 'spitter')).sort((a, b) => far(b) - far(a));
      for (const c of cells) if (s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok) return c;
      return -1;
    });
    // The street beside that limb: the guns stand there with it in reach (a dart battery with nothing in reach goes home).
    const near = await page.evaluate((lc) => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      let best = -1; let bd = Infinity;
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== 1) continue;
        const d = Math.hypot((c % W) - (lc % W), Math.floor(c / W) - Math.floor(lc / W));
        if (d >= 1.5 && d < bd) { bd = d; best = c; }
      }
      return best;
    }, limbCell);
    const ids = await put([
      { kind: 'cannon', cell: near, dx: -14, dy: -8 }, { kind: 'cannon', cell: near, dx: 14, dy: 8, set: 'deployed' },
      { kind: 'dartgun', cell: near, dx: -20, dy: 14 }, { kind: 'dartgun', cell: near, dx: 8, dy: 26, set: 'deployed' },
    ]);
    await hold(ids);
    await page.evaluate((w) => { window.__walking = w; window.__keepHp = true; }, [ids[0], ids[2]]);
    if (process.env.DEBUG_BEAT) console.log(await page.evaluate((want) => JSON.stringify(window.broodfall.sim.enemies.filter((e) => want.includes(e.id)).map((e) => [e.kind, Math.round(e.pos.x), Math.round(e.pos.y), e.hp])), ids));
    await ticks(6);
    for (const k of ['cannon', 'dartgun']) {
      check(!!manifest.units[k]?.anims?.states?.deployed, `${k} has its braced picture`);
      check(!!manifest.units[k]?.anims?.braced, `${k} has its braced shot`);
    }
    const staged = await page.evaluate((want) => window.broodfall.sim.enemies.filter((e) => want.includes(e.id)).map((e) => `${e.kind}${e.deployed ? ' braced' : ''}`), ids);
    check(staged.length === 4, 'two braced and two walking on the board', staged.join(', '));
    const at = await middle(ids);
    let b = await closeOn(at, 0);
    await shot(1, 'braced-beside-walking-game-zoom', middleCrop(b));
    await shot(2, 'braced-beside-walking-game-zoom-whole');
    b = await closeOn(at, 8);
    await shot(3, 'braced-beside-walking-close');
    // The braced cannon fires: its shot count goes up as the sim's would.
    await ticks(1, `(s) => { for (const e of s.enemies) if (e.deployed) e.shotsFired = (e.shotsFired ?? 0) + 1; }`);
    await ticks(2);
    await shot(4, 'braced-firing-close');
    await page.evaluate(() => { window.__keepHp = false; window.__walking = []; });
  }

  // 2. Fliers falling: the fall lands whole.
  if (want(2)) {
    await fresh(22);
    const st = await streets();
    const ids = await put([{ kind: 'shadewing', cell: st[0] }, { kind: 'flier', cell: st[2] }, { kind: 'shadewing', cell: st[4] }]);
    await hold(ids);
    await ticks(3);
    const b = await closeOn(await middle(ids), 9);
    await page.evaluate(() => { const s = window.broodfall.sim; for (const e of [...s.enemies]) s.damageEnemy(e, 99999, 1); });
    await ticks(14);
    check((await page.evaluate(() => window.broodfall.dying().length)) >= 3, 'the fliers are drawn falling');
    await shot(5, 'fliers-falling');
    await ticks(26);
    await shot(6, 'fliers-fallen-whole');
    void b;
  }

  // 3. A squad struck: the flinch.
  if (want(3)) {
    await fresh(23);
    const st = await streets();
    const kinds = ['soldier', 'militia', 'elite', 'phalanx', 'stalker', 'splitter'];
    const ids = await put(kinds.map((kind, i) => ({ kind, cell: st[i % 3], dx: (i % 2) * 14 - 7, dy: (i >> 1) * 6 - 6 })));
    await hold(ids);
    await ticks(4);
    await closeOn(await middle(ids), 9);
    await shot(7, 'squad-before-the-blow');
    await page.evaluate((want) => { const s = window.broodfall.sim; for (const e of s.enemies) if (want.includes(e.id)) s.damageEnemy(e, e.maxHp * 0.2, 1); }, ids);
    await ticks(1);
    await shot(8, 'squad-struck-flash');
    await ticks(2);
    await shot(9, 'squad-flinching');
    const hits = kinds.filter((k) => manifest.units[k]?.anims?.hit).length;
    check(hits === kinds.length, 'every unit of the squad has its flinch', `${hits}/${kinds.length}`);
  }

  // 4. The carapace lord's shell: whole, cracked, gone.
  if (want(4)) {
    await fresh(24);
    const st = await streets();
    const ids = await put([{ kind: 'carapace', cell: st[0], dx: -16 }, { kind: 'carapace', cell: st[0], dx: 4, set: 'shield3' }, { kind: 'carapace', cell: st[0], dx: 24, set: 'shield0' }]);
    await hold(ids);
    await ticks(4);
    await closeOn(await middle(ids), 10);
    await shot(10, 'carapace-whole-cracked-gone');
    await page.evaluate((id) => { const s = window.broodfall.sim; const e = s.enemies.find((u) => u.id === id); s.damageEnemy(e, 10, 1); }, ids[0]);
    await ticks(1);
    await shot(11, 'carapace-shell-chipped');
  }

  // 5. The bosses: the arrival, the royal's command, the consort's salute.
  if (want(5)) {
    await fresh(25);
    const st = await streets();
    await page.evaluate(() => window.broodfall.step(1));
    const ids = await put([{ kind: 'royal', cell: st[1], dx: -12 }, { kind: 'consort', cell: st[1], dx: 22, dy: 6 }]);
    await hold(ids);
    await closeOn(await middle(ids), 8);
    await ticks(5);
    await shot(12, 'bosses-arriving');
    await ticks(20);
    await shot(13, 'bosses-arrived');
    // The royal fights (her command); the consort's pulse comes round (his salute).
    const fight = `(s) => { for (const e of s.enemies) { if (e.kind === 'royal') e.targetId = -1; } }`;
    await ticks(1, `(s) => { for (const e of s.enemies) { if (e.kind === 'royal') e.targetId = -1; if (e.kind === 'consort') e.auxCooldown = 0.05; } }`);
    await ticks(6, fight);
    await shot(14, 'royal-command-consort-salute');
    for (const k of ['royal', 'consort']) check(!!manifest.units[k]?.anims?.enter && !!manifest.units[k]?.anims?.special, `${k} has an arrival and a special attack`);
  }

  // 6. The hive's own: broodlings and puppet queens.
  if (want(6)) {
    await fresh(26);
    const st = await streets();
    const mother = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.hand[0] = { id: 880010, family: 'brood', free: true };
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'brood') && s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok) return s.towers[s.towers.length - 1].id;
      return -1;
    });
    check(mother >= 0, 'a Broodmother is grown');
    await page.evaluate(({ mother, cell }) => {
      const s = window.broodfall.sim;
      const c = s.cellCenter(cell);
      const add = (dx, dy, puppet) => s.broodlings.push({ id: s.nextId++, motherId: mother, pos: { x: c.x + dx, y: c.y + dy }, hp: 50, maxHp: 50, cooldown: 0, ...(puppet ? { puppet } : {}) });
      for (let i = 0; i < 4; i++) add(i * 7 - 10, (i % 2) * 6, null);
      add(-18, 14, { bite: 30, rate: 0.9, speed: 24, kind: 'royal' });
      add(4, 18, { bite: 20, rate: 0.9, speed: 30, kind: 'consort' });
      add(24, 12, { bite: 16, rate: 0.9, speed: 30, kind: 'matron' });
    }, { mother, cell: st[0] });
    const foes = await put([{ kind: 'militia', cell: st[0], dx: 30, dy: -10 }, { kind: 'soldier', cell: st[0], dx: -30, dy: -12 }]);
    await ticks(3);
    await closeOn(await page.evaluate((cell) => window.broodfall.sim.cellCenter(cell), st[0]), 9);
    await ticks(8);
    await shot(15, 'broodlings-and-puppet-queens');
    await ticks(10);
    await shot(16, 'broodlings-and-puppet-queens-fighting');
    for (const id of ['broodling', 'puppet-royal', 'puppet-consort', 'puppet-matron']) check(!!manifest.allies?.[id], `${id} has its picture`);
    void foes;
  }
  // Another session's limb or board picture still being made is theirs to report; anything else is a failure here.
  const mine = errors.filter((e) => !/could not load: (limbs|board|fx)[/]/.test(e));
  if (mine.length < errors.length) console.log(`  note  not this beat's: ${errors.filter((e) => !mine.includes(e)).join(' | ')}`);
  check(mine.length === 0, 'nothing is logged as an error', mine.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nUNITS MOMENTS: ${failures.length} failure(s): ${failures.join('; ')}` : '\nUNITS MOMENTS: all verified.');
process.exit(failures.length ? 1 : 0);
