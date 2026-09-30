/**
 * THE LANDING SITE, CLOSE (Collins, Sep 29 2026: "still no evidence in screenshots you figured
 * out how to make the central structure look right").
 *
 * The core alone, close, in the middle of the frame: in four tile sets, at minute zero and once
 * the creep has grown round it, and at all four quarter turns of the camera. Nothing else is
 * staged: no limbs are built, so nothing stands in front of it.
 *
 * Checks: the core's art loaded, nothing logged as an error.
 *
 * Usage: npm run build && node tools/shot-core.mjs
 * Screenshots: tools/screenshots/core-*.png, and JPEG copies in notes/screens/2026-09-29/.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-29');
mkdirSync(shots, { recursive: true });
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

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

// CORE_BEFORE=<url>: photograph an OLD build already being served there (minute zero only, no
// camera turning, which it does not have), to set beside the new one at the same framing.
const BEFORE = process.env.CORE_BEFORE || '';
const server = BEFORE ? null : await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
  const canvas = page.locator('#stage canvas');
  let n = 4;
  const shot = async (what) => {
    n += 1;
    const name = BEFORE ? `core-before-${what}` : `core-${String(n).padStart(2, '0')}-${what}`;
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(300);
    await canvas.screenshot({ path: png });
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, `${name}.jpg`)]);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  /** The view close on the landing site, the core in the middle of the frame. */
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
    // A little below the middle: the heart stands up out of the frame's middle.
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.58, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(500);
  };

  for (const [biome, seed] of [['suburb', 11], ['megacity', 12], ['farmland', 13], ['necropolis', 14]]) {
    await page.goto(`${BEFORE || `http://localhost:${PORT}`}/?seed=${seed}&autostart=1&speed=0&biome=${biome}`);
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    check((await page.evaluate(() => window.broodfall.artMissing())).length === 0, `${biome}: all the art loaded`);
    await page.evaluate(() => window.broodfall.step(1));
    await closeOnCore(5);
    await shot(`${biome}-minute-zero`);
    if (BEFORE) continue;
    await page.evaluate(() => window.broodfall.step(900));
    await closeOnCore(5);
    await shot(`${biome}-creep-grown`);
    if (biome === 'suburb') {
      for (let q = 1; q < 4; q++) {
        await page.evaluate(() => window.broodfall.turnBy(1));
        await closeOnCore(5);
        await shot(`${biome}-turn-${q}`);
      }
      await page.evaluate(() => window.broodfall.turnBy(1));
      await closeOnCore(8);
      await shot(`${biome}-very-close`);
    }
  }
  check(errors.length === 0, 'nothing logged as an error', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  if (server) { server.kill(); freePort(); }
}
if (failures.length) { console.log(`FAILED: ${failures.join(', ')}`); process.exit(1); }
console.log('core beat: all checks pass');
