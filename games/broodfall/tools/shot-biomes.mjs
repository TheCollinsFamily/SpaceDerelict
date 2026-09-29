/**
 * Every tile set in the real game: the same seed played into its first siege, drawn with
 * each set in turn, and a campaign deployment drawn with its territory's own set.
 *
 * Checks: the set asked for is the set drawn, all of its art loads, nothing is logged as
 * an error, and the body's pieces (creep, limbs, units) are on the board with it.
 *
 * Usage: npm run build && node tools/shot-biomes.mjs [set ...]
 * Artifacts: tools/screenshots/biome-<set>.png and biome-<set>-close.png
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const failures = [];
const pass = (name) => console.log(`  PASS  ${name}`);
const fail = (name, detail) => { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); };
const check = (ok, name, detail = '') => (ok ? pass(name + (detail ? ` (${detail})` : '')) : fail(name, detail));

const manifest = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8'));
const asked = process.argv.slice(2);
const sets = Object.keys(manifest.biomes ?? {}).filter((id) => !asked.length || asked.includes(id));

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
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
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  for (const id of sets) {
    console.log(`${id} (${manifest.biomes[id].name})`);
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0&biome=${id}`);
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
    const canvas = page.locator('#stage canvas');
    check(await page.evaluate(() => window.broodfall.view()) === 'iso', `${id}: the board is isometric`);
    const drawn = await page.evaluate(() => window.broodfall.biome());
    check(drawn === id, `${id}: the set asked for is the set drawn`, drawn);
    const missing = await page.evaluate(() => window.broodfall.artMissing());
    check(missing.length === 0, `${id}: all the art loads`, missing.join(', '));

    const step = (n) => page.evaluate((k) => window.broodfall.step(k), n);
    await step(5);
    for (let i = 0; i < 60; i++) { await step(20); if (await page.evaluate(() => window.broodfall.summary().enemies) >= 6) break; }
    for (let i = 0; i < 12; i++) { await step(100); if (await page.evaluate(() => window.broodfall.summary().wave) >= 3) break; }
    await page.waitForTimeout(500);
    await canvas.screenshot({ path: join(shots, `biome-${id}.png`) });
    const field = await page.evaluate(() => {
      const s = window.broodfall.sim;
      return { enemies: s.enemies.length, towers: s.towers.length };
    });
    check(field.towers > 0, `${id}: the body has limbs on the board`, `${field.towers} limbs, ${field.enemies} units`);

    // Close up, on the edge of the body: living city on one side, creep on the other.
    const box = await canvas.boundingBox();
    const at = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const t = s.towers[s.towers.length - 1] ?? { pos: s.core };
      return window.broodfall.worldToScreen(t.pos.x, t.pos.y);
    });
    await page.mouse.move(box.x + (at.x / at.vw) * box.width, box.y + (at.y / at.vh) * box.height);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(500);
    await canvas.screenshot({ path: join(shots, `biome-${id}-close.png`) });
    check(errors.length === 0, `${id}: nothing is logged as an error`, errors.slice(0, 3).join(' | '));
    await page.close();
  }
  // A campaign deployment is drawn with the tile set of the territory it is fought over.
  if (!asked.length) {
    console.log('campaign deployments');
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`http://localhost:${PORT}/?seed=3`, { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.removeItem('broodfall-campaign');
      localStorage.removeItem('broodfall-campaign-pending');
      localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    });
    // Opening the ship starts a campaign and saves it.
    await page.goto(`http://localhost:${PORT}/?campaign=ship`, { waitUntil: 'load' });
    await page.waitForFunction(() => localStorage.getItem('broodfall-campaign') !== null, null, { timeout: 30000 });
    for (const [id, set] of Object.entries(manifest.biomes)) {
      const territory = set.territories[0];
      await page.evaluate((t) => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: t, dares: [], objectors: [] })), territory);
      await page.goto(`http://localhost:${PORT}/?campaign=run&speed=0`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
      const drawn = await page.evaluate(() => window.broodfall.biome());
      check(drawn === id, `a deployment to ${territory} is drawn as ${id}`, drawn);
    }
    await page.evaluate(() => { localStorage.removeItem('broodfall-campaign'); localStorage.removeItem('broodfall-campaign-pending'); });
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `${failures.length} check(s) FAILED: ${failures.join('; ')}` : `all checks passed for ${sets.length} tile set(s)`);
process.exit(failures.length ? 1 : 0);
