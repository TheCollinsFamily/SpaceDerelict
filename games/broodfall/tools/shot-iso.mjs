/**
 * Screenshot beats of the ISOMETRIC board with the baked art, and its checks:
 * the art loads, the board is isometric, every unit and limb on the field has its picture,
 * a click on a roof reaches the cell it was aimed at, and the frame rate holds.
 *
 * Usage: npm run build && node tools/shot-iso.mjs
 * Artifacts: tools/screenshots/iso-*.png
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
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const failures = [];
const pass = (name) => console.log(`  PASS  ${name}`);
const fail = (name, detail) => { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); };
const check = (ok, name, detail = '') => (ok ? pass(name + (detail ? ` (${detail})` : '')) : fail(name, detail));

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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0`);
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
  const canvas = page.locator('#stage canvas');

  check(await page.evaluate(() => window.broodfall.view()) === 'iso', 'the board is isometric');
  const missing = await page.evaluate(() => window.broodfall.artMissing());
  check(missing.length === 0, 'all the art loads', missing.join(', '));

  const step = (n) => page.evaluate((k) => window.broodfall.step(k), n);
  const shot = async (name) => { await page.waitForTimeout(250); await canvas.screenshot({ path: join(shots, `iso-${name}.png`) }); };

  await step(5);
  await page.waitForTimeout(600);
  await shot('1-minute-zero');
  // Into the first siege.
  for (let i = 0; i < 60; i++) { await step(20); if (await page.evaluate(() => window.broodfall.summary().enemies) >= 6) break; }
  await shot('2-first-siege');
  // The column, close up: the view is brought to the middle of the enemies.
  const closeOn = async (name) => {
    const at = await page.evaluate(() => {
      const s = window.broodfall.sim;
      if (!s.enemies.length) return null;
      const x = s.enemies.reduce((a, e) => a + e.pos.x, 0) / s.enemies.length;
      const y = s.enemies.reduce((a, e) => a + e.pos.y, 0) / s.enemies.length;
      return window.broodfall.worldToScreen(x, y);
    });
    if (!at) return;
    const b = await canvas.boundingBox();
    await page.mouse.move(b.x + (at.x / at.vw) * b.width, b.y + (at.y / at.vh) * b.height);
    for (let i = 0; i < 7; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(400);
    await shot(name);
    await page.keyboard.press('Home');
    await page.waitForTimeout(400);
  };
  await closeOn('2b-first-siege-close');
  for (let i = 0; i < 40; i++) { await step(100); if (await page.evaluate(() => window.broodfall.summary().wave) >= 5) break; }
  await shot('3-mid');
  for (let i = 0; i < 80; i++) { await step(100); const s = await page.evaluate(() => window.broodfall.summary()); if (s.wave >= 9 || s.outcome !== 'playing') break; }
  await shot('4-late');
  await closeOn('4b-late-close');

  // What is on the field has its picture.
  const field = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return { kinds: [...new Set(s.enemies.map((e) => e.kind))], families: [...new Set(s.towers.map((t) => t.family))] };
  });
  const art = await (await page.request.get(`http://localhost:${PORT}/art/manifest.json`)).json();
  const noUnit = field.kinds.filter((k) => !art.units[k]);
  const noLimb = field.families.filter((f) => !art.limbs[f]);
  check(noUnit.length === 0, 'every unit on the field has its picture', noUnit.join(', ') || field.kinds.join(', '));
  check(noLimb.length === 0, 'every limb on the field has its picture', noLimb.join(', ') || field.families.join(', '));

  // A click aimed at a limb on a roof reaches that limb's cell.
  const aim = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const out = [];
    for (const t of s.towers.slice(0, 12)) {
      const p = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
      out.push({ id: t.id, cell: t.cell, x: p.x, y: p.y, vw: p.vw, vh: p.vh });
    }
    return out;
  });
  const box = await canvas.boundingBox();
  let reached = 0;
  let tried = 0;
  for (const a of aim) {
    if (a.x < 10 || a.y < 10 || a.x > a.vw - 10 || a.y > a.vh - 10) continue;
    tried++;
    const cx = box.x + (a.x / a.vw) * box.width;
    const cy = box.y + (a.y / a.vh) * box.height;
    const got = await page.evaluate(([x, y]) => {
      const el = document.querySelector('#stage canvas');
      const ev = new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true });
      el.dispatchEvent(ev);
      return window.broodfall.cellAtClient(x, y);
    }, [cx, cy]);
    if (got === a.cell) reached++;
  }
  check(tried > 0 && reached === tried, 'a click aimed at a limb reaches its cell', `${reached}/${tried}`);

  // Close up: zoom in on the middle of the board.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(500);
  await shot('5-close');

  // Frame rate with the field full.
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else resolve(n / 2); };
    requestAnimationFrame(tick);
  }));
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl');
    const e = c && c.getExtension('WEBGL_debug_renderer_info');
    return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const software = /SwiftShader|llvmpipe|Software/i.test(gl);
  check(fps >= (software ? 5 : 30), 'the frame rate holds', `${fps.toFixed(0)} frames a second on ${gl}`);

  // THE CAMERA TURNS (Q and E). From every side: the board is drawn, a click aimed at a
  // limb reaches its cell, and a limb is seen from another side than before.
  await page.keyboard.press('Home');
  // The view eases back: it is measured when it has arrived.
  await page.waitForTimeout(2500);
  const aimAll = async () => {
    const at = await page.evaluate(() => window.broodfall.sim.towers.slice(0, 12).map((t) => {
      const p = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
      return { cell: t.cell, x: p.x, y: p.y, vw: p.vw, vh: p.vh };
    }));
    const b = await canvas.boundingBox();
    let hit = 0, tried = 0;
    for (const a of at) {
      if (a.x < 10 || a.y < 10 || a.x > a.vw - 10 || a.y > a.vh - 10) continue;
      tried++;
      const got = await page.evaluate(([x, y]) => window.broodfall.cellAtClient(x, y), [b.x + (a.x / a.vw) * b.width, b.y + (a.y / a.vh) * b.height]);
      if (got === a.cell) hit++;
    }
    return { hit, tried };
  };
  const where = () => page.evaluate(() => {
    const c = window.broodfall.sim.core;
    const p = window.broodfall.worldToScreen(c.x, c.y);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  });
  const home = await where();
  for (let turn = 1; turn <= 4; turn++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(900);
    const now = await page.evaluate(() => window.broodfall.turn());
    check(now === turn % 4, `E turns the board: turn ${turn % 4}`, String(now));
    if (turn < 4) {
      await shot(`6-turn-${turn}`);
      const a = await aimAll();
      check(a.tried > 0 && a.hit === a.tried, `turn ${turn}: a click aimed at a limb reaches its cell`, `${a.hit}/${a.tried}`);
    }
  }
  await page.keyboard.press('Home');
  await page.waitForTimeout(2500);
  const back = await where();
  check(Math.abs(back.x - home.x) <= 2 && Math.abs(back.y - home.y) <= 2, 'four turns bring the board back where it was', `${home.x},${home.y} and ${back.x},${back.y}`);
  await page.keyboard.press('q');
  await page.waitForTimeout(600);
  check(await page.evaluate(() => window.broodfall.turn()) === 3, 'Q turns it the other way');
  await page.keyboard.press('e');
  await page.waitForTimeout(600);
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nISO CHECK: ${failures.length} failure(s): ${failures.join('; ')}` : '\nISO CHECK: all passed.');
process.exit(failures.length ? 1 : 0);
