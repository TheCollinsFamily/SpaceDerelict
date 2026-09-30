/**
 * LIMBS AGAINST THE CORE (Collins, Sep 30 2026: "the towers are too big when contrasted with
 * the center node (make them a bit smaller, it a bit bigger)").
 *
 * The same staged scene (seed 11, suburb: a BIG frond, a BIG maw, small limbs, all next to the
 * core) at several limb/core scale pairs, each at the home zoom and close on the core, so the
 * pairs can be set side by side. The renderer reads `?limbScale=&coreScale=` (isoRender.ts).
 *
 * Usage (its own build in dist-scale, so no other session's save reloads it): node tools/shot-scale.mjs [limb:core ...] [--tag after]
 *   default pairs: 1:1 (before) 0.9:1.12 0.84:1.22 0.78:1.32
 * Screenshots: notes/screens/2026-09-30/scale-<tag>-<limb>-<core>-{home,close}.jpg
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
const PORT = Number(process.env.BROODFALL_PORT || 5288);
const args = process.argv.slice(2);
const tagAt = args.indexOf('--tag');
const tag = tagAt >= 0 ? args[tagAt + 1] : 'pair';
const turnAt = args.indexOf('--turn');
const turn = turnAt >= 0 ? Number(args[turnAt + 1]) : 0;
const pairs = args.filter((a) => /^[\d.]+:[\d.]+$/.test(a)).map((a) => a.split(':').map(Number));
if (!pairs.length) pairs.push([1, 1], [0.9, 1.12], [0.84, 1.22], [0.78, 1.32]);
const FAMILIES = (process.env.SCALE_FAMILIES || 'frond,maw,spitter,lasher,impaler').split(',');

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
// Its own build (dist-scale): the dev server reloads the page whenever another session saves a file.
const DIST = 'dist-scale';
if (!args.includes('--no-build')) {
  const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => console.log(`  pageerror ${e}`));
  const canvas = page.locator('#stage canvas');
  const shot = async (name) => {
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: png });
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, `${name}.jpg`)]);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  const toCentre = async (zoom) => {
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    const b = await canvas.boundingBox();
    const where = async () => {
      const at = await page.evaluate(() => {
        const s = window.broodfall.sim;
        const x = s.towers.reduce((a, t) => a + t.pos.x, s.core.x * 2) / (s.towers.length + 2);
        const y = s.towers.reduce((a, t) => a + t.pos.y, s.core.y * 2) / (s.towers.length + 2);
        return window.broodfall.worldToScreen(x, y);
      });
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
  for (const [limb, core] of pairs) {
    await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0&biome=suburb&limbScale=${limb}&coreScale=${core}`);
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.broodfall.step(3));
    const placed = await page.evaluate((fams) => {
      const s = window.broodfall.sim;
      s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 50;
      const W = s.cfg.gridW;
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c)) cells.push(c);
      const at = (c) => [c % W, Math.floor(c / W)];
      const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      cells.sort((a, b) => d(a) - d(b));
      const taken = [];
      const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
      const out = [];
      for (const family of fams) {
        const cell = cells.find((c) => { const g = s.groundFor(c, family, 'S'); return g !== null && g.every(apart); });
        if (cell === undefined) { out.push(`${family}: no room`); continue; }
        const ground = s.groundFor(cell, family, 'S');
        s.hand[0] = { id: 900000 + out.length, family, free: true };
        const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' });
        if (r.ok) { taken.push(...ground); out.push(family); } else out.push(`${family}: ${r.err}`);
      }
      return out;
    }, FAMILIES);
    console.log(`${limb}:${core} placed ${placed.join(', ')}`);
    await page.evaluate(() => window.broodfall.step(300));
    if (turn) await page.evaluate((n) => window.broodfall.turnBy(n), turn);
    const name = `scale-${tag}-${limb}-${core}${turn ? `-turn${turn}` : ''}`;
    await toCentre(2);
    await shot(`${name}-home`);
    await toCentre(6);
    await shot(`${name}-close`);
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
