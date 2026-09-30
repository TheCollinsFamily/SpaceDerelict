/**
 * WALLS IN THEIR STREETS (Collins, Sep 30 2026: "in some of the images you have walls way too
 * large and placed sideways").
 *
 * Spine Walls grown in the street near the core: one on a street ONE cell wide (the sim lays its
 * two cells one behind the other, along the lane) and one on a street two cells wide (side by side,
 * across it). Each photographed close, at all four quarter turns of the camera, in three tile sets.
 * A wall must be drawn ACROSS its lane at every turn, and no longer than the lane is wide.
 *
 * Usage: node tools/shot-walls.mjs [--tag after] [--dist dist-walls-before --no-build]
 * Screenshots: notes/screens/2026-09-30/walls-<tag>-<set>-<narrow|wide>-turn<N>.jpg
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
const PORT = Number(process.env.BROODFALL_PORT || 5289);
const args = process.argv.slice(2);
const valueOf = (flag, d) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : d; };
const tag = valueOf('--tag', 'after');
const DIST = valueOf('--dist', 'dist-walls');
const SETS = (valueOf('--sets', 'suburb:11,orient:12,farmland:13')).split(',').map((s) => s.split(':'));

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
if (!args.includes('--no-build')) {
  const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
}
function serve() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

const failures = [];
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => { failures.push(String(e)); console.log(`  pageerror ${e}`); });
  const canvas = page.locator('#stage canvas');
  const shot = async (name) => {
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: png });
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, `${name}.jpg`)]);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  const closeOn = async (x, y, zoom) => {
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    const b = await canvas.boundingBox();
    const where = async () => {
      const at = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [x, y]);
      return { x: b.x + (at.x / at.vw) * b.width, y: b.y + (at.y / at.vh) * b.height };
    };
    let p = await where();
    await page.mouse.move(p.x, p.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(600);
    p = await where();
    await page.keyboard.down('Shift');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.55, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(500);
  };
  for (const [set, seed] of SETS) {
    await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=${set}`);
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.broodfall.step(900));
    const walls = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.meat.war = 9000; s.meat.science = 9000;
      const W = s.cfg.gridW;
      const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.groundFor(c, 'spine', 'S')) cells.push(c);
      cells.sort((a, b) => d(a) - d(b));
      const out = {};
      const used = new Set();
      for (const c of cells) {
        const g = s.groundFor(c, 'spine', 'S');
        if (!g || g.some((x) => used.has(x) || used.has(x + 1) || used.has(x - 1) || used.has(x + W) || used.has(x - W))) continue;
        const alongX = g.length === 2 && Math.abs(g[1] - g[0]) === 1;
        // Is the street one cell wide here: are both cells beside the wall's line closed?
        // Block (0) or Void (3): nothing walks there.
        const closed = (x) => x < 0 || x >= s.map.cells.length || s.map.cells[x] === 0 || s.map.cells[x] === 3;
        const side = alongX ? W : 1;
        const narrow = g.every((x) => closed(x - side) && closed(x + side));
        const kind = narrow ? 'narrow' : 'wide';
        if (out[kind]) continue;
        s.hand[0] = { id: 910000 + used.size, family: 'spine', free: true };
        const r = s.issue({ kind: 'build', cardIndex: 0, cell: c, facing: 'S' });
        if (!r.ok) continue;
        const t = s.towers[s.towers.length - 1];
        g.forEach((x) => used.add(x));
        out[kind] = { x: t.pos.x, y: t.pos.y, cells: s.cellsOf(t) };
        if (out.narrow && out.wide) break;
      }
      return out;
    });
    console.log(`${set}: ${JSON.stringify(walls)}`);
    if (!walls.narrow) console.log(`  (${set}: no one-cell street near the core took a wall)`);
    await page.evaluate(() => window.broodfall.step(2));
    for (let q = 0; q < 4; q++) {
      for (const kind of ['narrow', 'wide']) {
        const w = walls[kind];
        if (!w) continue;
        await closeOn(w.x, w.y, 6);
        await shot(`walls-${tag}-${set}-${kind}-turn${q}`);
      }
      await page.evaluate(() => window.broodfall.turnBy(1));
      await page.waitForTimeout(300);
    }
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
if (failures.length) { console.log(`FAIL: ${failures.length} page errors`); process.exit(1); }
