/**
 * THE CORE EVOLVES, in the real page (Collins, Sep 30 2026: "the central node should 'evolve'
 * after certain numbers of towers are built").
 *
 * 1. Staged: the core close up at stage 1; the body's limbs-grown count raised past each threshold
 *    (6, 18, 40): the growing clip photographed MID-CLIP (the creep pulsing), then the new stage
 *    beating. Stage 4 from all four quarter turns and at the home zoom (it stays in its square).
 * 2. Played: the scripted player (auto=1) until it has grown 6 limbs: the core must have grown
 *    into stage 2 by itself.
 *
 * Checks: the stage art loaded; each threshold starts the growing clip and ends at the stage; the
 * scripted run reaches stage 2; no page errors.
 *
 * Usage: node tools/shot-core-evo.mjs [--no-build]
 * Screenshots: notes/screens/2026-09-30/core-evo-*.jpg
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
const PORT = Number(process.env.BROODFALL_PORT || 5292);
const args = process.argv.slice(2);
const DIST = 'dist-core-evo';
let failed = 0;
const check = (ok, name) => { if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); };

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

const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  const canvas = page.locator('#stage canvas');
  const shot = async (name) => {
    const png = join(shots, `${name}.png`);
    await page.screenshot({ path: png });
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, `${name}.jpg`)]);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  const closeOnCore = async (zoom) => {
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    const b = await canvas.boundingBox();
    const where = async () => {
      const at = await page.evaluate(() => { const c = window.broodfall.sim.core; return window.broodfall.worldToScreen(c.x, c.y); });
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
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.62, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(500);
  };
  const stage = () => page.evaluate(() => window.broodfall.coreStage());

  // 1. Staged.
  await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0&biome=suburb`);
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 40000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.broodfall.step(600));
  const s0 = await stage();
  check(s0?.art === true, 'the core\'s stages loaded');
  check(s0?.stage === 1, `a run starts at stage 1 (${JSON.stringify(s0)})`);
  await closeOnCore(5);
  await shot('core-evo-01-stage-1');
  let n = 2;
  for (const [into, grown] of [[2, 6], [3, 18], [4, 40]]) {
    await page.evaluate((g) => { window.broodfall.sim.stats.limbsGrown = g; }, grown);
    await page.waitForFunction((k) => window.broodfall.coreStage().into === k, into, { timeout: 5000 }).catch(() => {});
    const started = await stage();
    check(started.into === into, `${grown} limbs grown: the core starts growing into stage ${into}`);
    await page.waitForFunction(() => window.broodfall.coreStage().t > 1.9, null, { timeout: 8000 }).catch(() => {});
    await shot(`core-evo-${String(n++).padStart(2, '0')}-growing-into-${into}-mid-clip`);
    await page.waitForFunction((k) => window.broodfall.coreStage().stage === k && window.broodfall.coreStage().into === 0, into, { timeout: 10000 }).catch(() => {});
    check((await stage()).stage === into, `it ends at stage ${into}`);
    await page.waitForTimeout(700);
    await shot(`core-evo-${String(n++).padStart(2, '0')}-stage-${into}`);
  }
  for (let q = 1; q < 4; q++) {
    await page.evaluate(() => window.broodfall.turnBy(1));
    await closeOnCore(5);
    await shot(`core-evo-${String(n++).padStart(2, '0')}-stage-4-turn-${q}`);
  }
  await page.evaluate(() => window.broodfall.turnBy(1));
  await closeOnCore(1);
  await shot(`core-evo-${String(n++).padStart(2, '0')}-stage-4-home-zoom`);

  // 2. Played: the scripted player grows its limbs, and the core grows with them.
  await page.goto(`http://localhost:${PORT}/?seed=3&autostart=1&auto=1&speed=0&biome=megacity`);
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 40000 });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 60; i++) {
    const g = await page.evaluate(() => { window.broodfall.step(200); return window.broodfall.sim.stats.limbsGrown; });
    if (g >= 6) break;
  }
  const grown = await page.evaluate(() => window.broodfall.sim.stats.limbsGrown);
  await page.waitForFunction(() => window.broodfall.coreStage().into === 2 || window.broodfall.coreStage().stage >= 2, null, { timeout: 5000 }).catch(() => {});
  await closeOnCore(4);
  await page.waitForFunction(() => window.broodfall.coreStage().t > 1.5, null, { timeout: 5000 }).catch(() => {});
  await shot(`core-evo-${String(n++).padStart(2, '0')}-played-growing-into-2`);
  await page.waitForFunction(() => window.broodfall.coreStage().stage >= 2 && window.broodfall.coreStage().into === 0, null, { timeout: 10000 }).catch(() => {});
  check((await stage()).stage >= 2, `played: ${grown} limbs grown by the scripted player, the core is at stage ${(await stage()).stage}`);
  await shot(`core-evo-${String(n++).padStart(2, '0')}-played-stage-2`);
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failed ? `CORE EVO BEAT: ${failed} failed` : 'CORE EVO BEAT: all verified.');
process.exit(failed ? 1 : 0);
