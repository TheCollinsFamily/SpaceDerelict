/**
 * A staged scene for LOOKING at limbs: the families named on the command line are grown
 * side by side on creeped roofs next to the core, and the view is brought close.
 *
 * Usage: npm run build && node tools/shot-limbs.mjs spitter maw impaler frond [--name restyle]
 * Artifacts: tools/screenshots/limbs-<name>.png (close) and limbs-<name>-far.png
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = 5199;
const args = process.argv.slice(2);
const nameAt = args.indexOf('--name');
const name = nameAt >= 0 ? args[nameAt + 1] : 'staged';
// --turn 1: the camera is turned that many quarter turns. --facing N: every limb is turned to face that way.
const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const turn = Number(valueOf('--turn') ?? 0);
const facing = valueOf('--facing');
const values = new Set(['--name', '--turn', '--facing'].map((f) => args.indexOf(f)).filter((i) => i >= 0).map((i) => i + 1));
const families = args.filter((a, i) => !a.startsWith('--') && !values.has(i));

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
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

const server = await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0`);
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
  await page.evaluate(() => window.broodfall.step(3));
  const placed = await page.evaluate(([fams, facing]) => {
    const s = window.broodfall.sim;
    s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 50;
    // Roofs with creep on them, nearest the core first, a cell apart from each other.
    const W = s.cfg.gridW;
    const cells = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c)) cells.push(c);
    const at = (c) => [c % W, Math.floor(c / W)];
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    cells.sort((a, b) => d(a) - d(b));
    const taken = [];
    // A cell apart from every cell that is taken: of a big limb, every cell of its ground.
    const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
    const out = [];
    for (const family of fams) {
      const cell = cells.find((c) => { const g = s.groundFor(c, family, 'S'); return g !== null && g.every(apart); });
      if (cell === undefined) { out.push(`${family}: no room`); continue; }
      const ground = s.groundFor(cell, family, 'S');
      s.hand[0] = { id: 900000 + out.length, family, free: true };
      const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' });
      if (r.ok) {
        taken.push(...ground);
        out.push(family);
        // Turned by hand, to be looked at from that side (the renderer draws the way a limb faces).
        if (facing) s.towers[s.towers.length - 1].facing = facing;
      } else out.push(`${family}: ${r.err}`);
    }
    return out;
  }, [families, facing ?? null]);
  console.log(`placed: ${placed.join(', ')}`);
  if (turn) await page.evaluate((n) => window.broodfall.turnBy(n), turn);
  await page.evaluate(() => window.broodfall.step(2));
  const canvas = page.locator('#stage canvas');
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: join(shots, `limbs-${name}-far.png`) });
  const at = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const x = s.towers.reduce((a, t) => a + t.pos.x, s.core.x) / (s.towers.length + 1);
    const y = s.towers.reduce((a, t) => a + t.pos.y, s.core.y) / (s.towers.length + 1);
    return window.broodfall.worldToScreen(x, y);
  });
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + (at.x / at.vw) * b.width, b.y + (at.y / at.vh) * b.height);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: join(shots, `limbs-${name}.png`) });
  console.log(`written: ${join(shots, `limbs-${name}.png`)}`);
} finally {
  await browser.close();
  server.kill();
  freePort();
}
