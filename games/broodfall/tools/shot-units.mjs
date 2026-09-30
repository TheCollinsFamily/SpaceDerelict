/**
 * THE UNITS IN PLAY, staged in the real page and photographed (Collins, Sep 29 2026: "I have
 * not seen screenshots of any of your fixes working … I need to see those").
 *
 * Staged beside the landing site, with the game paused between steps: a column walking (seen
 * from above), a column chewing a Spine Wall and sappers on a limb (attack clips), deaths
 * mid-fall, a netted flier, a braced cannon, a stripped carapace, a burrowing tunneler, a
 * researcher and a thief carrying off what they took, and the shadows under all of them.
 *
 * Checks: every unit on screen has its picture, the states and deaths have theirs in the
 * manifest, nothing is logged as an error.
 *
 * Usage: npm run build && node tools/shot-units.mjs
 * Screenshots: tools/screenshots/units-*.png, and JPEG copies in notes/screens/2026-09-29/.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-29');
mkdirSync(shots, { recursive: true });
mkdirSync(screens, { recursive: true });
/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);
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
function startPreview() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite preview exited early (${code})`)));
  });
}

// 1. Before and after, from the pictures themselves: the views the units had (eye level) and have now.
{
  const kinds = ['militia', 'soldier', 'elite', 'researcher', 'consort', 'cannon'];
  const args = [];
  for (const k of kinds) {
    const old = join(root, 'art-src', 'units', k, 'v1-eye-level', 'views.png');
    const now = join(root, 'art-src', 'units', k, 'views.png');
    if (existsSync(old) && existsSync(now)) args.push(old, now);
  }
  if (args.length) {
    const inputs = args.flatMap((f) => ['-i', f]);
    const n = args.length / 2;
    const pairs = Array.from({ length: n }, (_, i) => `[${2 * i}][${2 * i + 1}]hstack[p${i}]`).join(';');
    const stack = Array.from({ length: n }, (_, i) => `[p${i}]`).join('') + `vstack=${n}`;
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', n > 1 ? `${pairs};${stack}` : `[0][1]hstack`, '-q:v', '3', join(screens, 'units-01-before-left-after-right.jpg')]);
    check(existsSync(join(screens, 'units-01-before-left-after-right.jpg')), 'the before and after of the views', `${n} units`);
  }
}

const manifest = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8'));
const server = await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
  const canvas = page.locator('#stage canvas');
  let n = 1;
  const shot = async (what) => {
    n += 1;
    const name = `units-${String(n).padStart(2, '0')}-${what}`;
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(300);
    await canvas.screenshot({ path: png });
    jpg(png, `${name}.jpg`);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };

  /** A fresh board, paused, the creep grown a little, the view close on the landing site. */
  const fresh = async (seed = 11) => {
    await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=suburb`);
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
    await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; });
  };
  /** Street cells on screen near the landing site, nearest first. */
  const streets = () => page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const out = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 && d(c) >= 3 && d(c) <= 9) out.push(c);
    return out.sort((a, b) => d(a) - d(b));
  });
  /** Put units of these kinds on these cells; returns their ids. */
  const put = (list) => page.evaluate((items) => {
    const s = window.broodfall.sim;
    return items.map(({ kind, cell, dx = 0, dy = 0, set }) => {
      const e = s.spawnEnemy(kind, s.gates[0]);
      const c = s.cellCenter(cell);
      e.pos.x = c.x + dx; e.pos.y = c.y + dy;
      if (set === 'grounded') e.groundedUntil = s.time + 999;
      if (set === 'deployed') e.deployed = true;
      if (set === 'stripped') e.hitShield = 0;
      if (set === 'burrowed') e.burrowed = true;
      if (set === 'carrying') e.carrying = { family: 'spitter', pips: [], cell };
      if (set === 'stole') e.stole = 25;
      return e.id;
    });
  }, list);
  /** Bring the view close on a cell, or on a world point {x, y}, and put it in the middle of the frame. */
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
    // Zooming keeps the point under the pointer; drag it (shift-drag pans) to the middle.
    p = onPage(await where());
    await page.keyboard.down('Shift');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(400);
  };
  /** The middle of the units on the board, as a world point. */
  const middleOfUnits = () => page.evaluate(() => {
    const es = window.broodfall.sim.enemies;
    return { x: es.reduce((a, e) => a + e.pos.x, 0) / es.length, y: es.reduce((a, e) => a + e.pos.y, 0) / es.length };
  });
  const noArt = () => page.evaluate(() => [...new Set(window.broodfall.sim.enemies.map((e) => e.kind))].filter((k) => !window.broodfall.artMissing || true));

  // 2. A column walking, seen from above, with its shadows.
  await fresh();
  let st = await streets();
  const column = ['soldier', 'militia', 'militia', 'responder', 'elite', 'researcher', 'thief', 'splitter', 'skitterling', 'phalanx'];
  await put(column.map((kind, i) => ({ kind, cell: st[i % st.length], dx: (i % 3) * 5 - 5, dy: ((i >> 1) % 2) * 6 - 3 })));
  await page.evaluate(() => window.broodfall.step(12));
  await closeOn(await middleOfUnits(), 7);
  await shot('column-walking-from-above');
  const kinds = await page.evaluate(() => [...new Set(window.broodfall.sim.enemies.map((e) => e.kind))]);
  const missing = kinds.filter((k) => !manifest.units?.[k]);
  check(missing.length === 0, 'every unit on the board has its picture', kinds.join(', '));

  // 3. Attacks: a column chews a Spine Wall across its street; sappers climb onto a limb.
  await fresh(12);
  st = await streets();
  const wall = await page.evaluate((cells) => {
    const s = window.broodfall.sim;
    s.hand[0] = { id: 880001, family: 'spine', free: true };
    for (const c of cells) if (s.canBuildTower(c, 'spine') && s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok) return c;
    return -1;
  }, st);
  check(wall >= 0, 'a Spine Wall is built across a street to be chewed');
  const gateSide = await page.evaluate((c) => {
    // The street cell the column comes from: one step up the flow from the wall.
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    for (const n of [c - 1, c + 1, c - W, c + W]) if (s.map.cells[n] === 1 && s.flowNextOf(n) === c) return n;
    return c - 1;
  }, wall);
  await put(['soldier', 'militia', 'elite', 'responder'].map((kind, i) => ({ kind, cell: gateSide, dx: i * 3 - 4, dy: i * 3 - 4 })));
  await page.evaluate(() => window.broodfall.step(30));
  const chewing = await page.evaluate(() => window.broodfall.sim.enemies.filter((e) => e.targetId !== null && e.targetId !== undefined).length);
  check(chewing > 0, 'units stop and attack the wall', `${chewing} attacking`);
  await closeOn(wall, 8);
  await page.evaluate(() => window.broodfall.step(3));
  await shot('attacking-a-spine-wall');
  // Sappers on a limb.
  const limb = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.hand[0] = { id: 880002, family: 'spitter', free: true };
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'spitter') && s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok) return c;
    return -1;
  });
  await put(['sapper', 'sapper', 'ghostsapper'].map((kind, i) => ({ kind, cell: limb, dx: i * 5 - 5, dy: 8 })));
  await page.evaluate(() => window.broodfall.step(15));
  await closeOn(limb, 8);
  await shot('sappers-attacking-a-limb');

  // 4. Deaths, mid-fall: a squad struck down at once.
  await fresh(13);
  st = await streets();
  await put(['soldier', 'militia', 'elite', 'researcher', 'responder'].map((kind, i) => ({ kind, cell: st[i], dx: 0, dy: 0 })));
  await page.evaluate(() => window.broodfall.step(4));
  await closeOn(await middleOfUnits(), 7);
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (const e of [...s.enemies]) s.damageEnemy(e, 99999, 1);
  });
  // The fall runs on the game's clock (a paused game stands still, the fallen too): 12 frames at
  // 3 a second, then 1.4 s still. Step it a tick (0.1 s) at a time, letting the page draw each.
  const ticks = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(35); } };
  await ticks(20);
  const falling = await page.evaluate(() => window.broodfall.dying().length);
  check(falling >= 5, 'the squad is drawn falling', `${falling} falling`);
  await shot('dying-mid-fall');
  await ticks(22);
  const lying = await page.evaluate(() => window.broodfall.dying().filter((d) => d.alpha > 0.9).length);
  check(lying >= 5, 'the squad lies still where it fell', `${lying} lying`);
  await shot('dead-lying-still');
  const deaths = Object.entries(manifest.units ?? {}).filter(([, u]) => u.anims?.death).length;
  check(deaths === Object.keys(manifest.units ?? {}).length, 'every unit has a fall in the manifest', `${deaths}`);

  // 5. States.
  await fresh(14);
  st = await streets();
  const staged = [
    { kind: 'flier', set: 'grounded', what: 'netted-flier-on-the-ground' },
    { kind: 'shadewing', set: 'grounded', what: 'netted-shadewing' },
    { kind: 'cannon', set: 'deployed', what: 'cannon-braced' },
    { kind: 'dartgun', set: 'deployed', what: 'dart-battery-braced' },
    { kind: 'carapace', set: 'stripped', what: 'carapace-stripped' },
    { kind: 'tunneler', set: 'burrowed', what: 'tunneler-burrowed' },
    { kind: 'researcher', set: 'carrying', what: 'researcher-carrying-a-limb' },
    { kind: 'thief', set: 'stole', what: 'thief-carrying-meat' },
  ];
  const stagedIds = await put(staged.map((x, i) => ({ kind: x.kind, cell: st[i * 2 % st.length], set: x.set })));
  await page.evaluate(() => window.broodfall.step(1));
  for (const [i, x] of staged.entries()) {
    const art = manifest.units?.[x.kind]?.anims?.states;
    const id = { grounded: 'grounded', deployed: 'deployed', stripped: 'stripped', burrowed: 'burrowed', carrying: 'carrying', stole: 'carrying' }[x.set];
    check(!!art?.[id], `${x.kind} has its "${id}" picture`);
    const at = await page.evaluate((id) => { const e = window.broodfall.sim.enemies.find((u) => u.id === id); return e ? { x: e.pos.x, y: e.pos.y } : null; }, stagedIds[i]);
    await closeOn(at ?? st[i * 2 % st.length], 9);
    await shot(x.what);
  }
  check(errors.length === 0, 'nothing is logged as an error', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nUNITS BEAT: ${failures.length} failure(s): ${failures.join('; ')}` : '\nUNITS BEAT: all verified.');
process.exit(failures.length ? 1 : 0);
