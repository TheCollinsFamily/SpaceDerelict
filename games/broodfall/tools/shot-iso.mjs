/**
 * Screenshot beats of the ISOMETRIC board with the baked art, and its checks:
 * the art loads, the board is isometric, every unit and limb on the field has its picture,
 * a click on a roof reaches the cell it was aimed at, and the frame rate holds.
 *
 * Usage: node tools/shot-iso.mjs
 * Builds its OWN copy of the game (dist-iso/, or BROODFALL_DIST) and serves it on its own port (5199, or
 * BROODFALL_PORT), so it never plays a build another session is changing under it.
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
const DIST = process.env.BROODFALL_DIST || 'dist-iso';
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
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite preview exited early (${code})`)));
  });
}


/** The click reached the limb, or a limb standing IN FRONT of it whose body covers that point (it is drawn on top: that is what the player clicks). */
const reachedOrCovered = (page, aim, got) => page.evaluate(([cells, c]) => {
  const s = window.broodfall.sim;
  if (cells.includes(c)) return 'reached';
  const aimed = s.towers.find((x) => s.cellsOf(x).includes(cells[0]));
  const front = s.towers.find((x) => s.cellsOf(x).includes(c));
  if (!aimed || !front) return 'missed';
  // How far forward a limb stands in the turned view (on the ground, whatever its height): src/render/iso.ts toView.
  const W = s.cfg.gridW, H = s.cfg.gridH, turn = window.broodfall.turn();
  const fwd = (t) => { const cx = t.pos.x / s.cfg.cellPx, cy = t.pos.y / s.cfg.cellPx; return [cx + cy, H - cy + cx, W - cx + H - cy, cy + W - cx][turn]; };
  return fwd(front) > fwd(aimed) ? 'covered' : 'missed';
}, [aim.cells, got]);

// BROODFALL_PUBLIC=<folder>: the art from a copy of public/ taken at one moment (another session re-baking
// pictures while this builds can leave one half-written in the build: a "missing art" that is not the board's).
{
  const { build } = await import('vite');
  await build({ root, configFile: join(root, 'vite.config.ts'), logLevel: 'warn', build: { outDir: DIST, emptyOutDir: true }, ...(process.env.BROODFALL_PUBLIC ? { publicDir: process.env.BROODFALL_PUBLIC } : {}) });
}
const server = await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?auto=1&seed=42&speed=0`, { timeout: 120000 });
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 120000 });
  const canvas = page.locator('#stage canvas');

  check(await page.evaluate(() => window.broodfall.view()) === 'iso', 'the board is isometric');
  const missing = await page.evaluate(() => window.broodfall.artMissing());
  check(missing.length === 0, 'all the art loads', missing.join(', '));

  const step = (n) => page.evaluate((k) => window.broodfall.step(k), n);
  /**
   * The view eases to where it is going (Home, a turn, a zoom) over about a second: a click is aimed only
   * once it has arrived. Aiming from where the camera WAS and clicking where it IS was the "click picking
   * flake" of Sep 30 (a limb aimed at while the view was still easing back from a close-up, 10-11/12).
   * With the field full a frame can take longer than 100 ms under a headless GPU: two reads 100 ms apart
   * then straddle NO frame and look "still" while the view is mid-ease (the camera at 0.750 when aimed,
   * 0.660 at the click). So: reads at least 300 ms AND at least 3 drawn frames apart, unchanged three
   * times running, and the camera within half a pixel of where the game is taking it.
   */
  const settle = async (timeout = 15000) => {
    const t0 = Date.now();
    let was = null;
    let still = 0;
    while (Date.now() - t0 < timeout) {
      const c = await page.evaluate(() => new Promise((resolve) => {
        const start = performance.now();
        let frames = 0;
        const tick = () => { frames++; if (frames >= 3 && performance.now() - start >= 300) resolve(window.broodfall.camera()); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }));
      const same = was && Math.abs(c.x - was.x) < 0.25 && Math.abs(c.y - was.y) < 0.25 && Math.abs(c.scale - was.scale) < 0.0005;
      still = same ? still + 1 : 0;
      was = c;
      if (still >= 3) return true;
    }
    console.log('    the view did not settle in ' + timeout + ' ms: ' + JSON.stringify(was));
    return false;
  };
  /** Where the game is taking the camera (src/render/isoRender.ts updateCamera) and how far it still is. */
  const camGap = () => page.evaluate(() => {
    const r = window.broodfall.renderer;
    const scale = r.fit * r.zoom;
    const tx = r.app.renderer.width / 2 - (r.mid.x + r.pan.x) * scale;
    const ty = r.app.renderer.height / 2 - (r.mid.y + r.pan.y) * scale;
    const c = window.broodfall.camera();
    return Math.max(Math.abs(c.x - tx), Math.abs(c.y - ty), Math.abs(c.scale - scale) * 1000);
  });
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
  await page.keyboard.press('Home');
  const settled = await settle();
  const gap = await camGap();
  check(settled && gap < 0.5, 'Home eases the view home and it comes to rest (no endless drift)', `${gap.toFixed(3)} px from its goal`);
  const aim = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const out = [];
    for (const t of s.towers.slice(0, 12)) {
      const p = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
      // A limb on several cells is reached by a click on any of them (the game selects it by any).
      out.push({ id: t.id, cell: t.cell, cells: s.cellsOf(t), x: p.x, y: p.y, vw: p.vw, vh: p.vh });
    }
    return out;
  });
  const camAtAim = await page.evaluate(() => window.broodfall.camera());
  const box = await canvas.boundingBox();
  let reached = 0;
  let tried = 0;
  for (const a of aim) {
    if (a.x < 10 || a.y < 10 || a.x > a.vw - 10 || a.y > a.vh - 10) continue;
    tried++;
    // Aimed from the camera AT THE CLICK (the same task as the click: no frame can move the view between).
    const got = await page.evaluate(([id, bx, by, bw, bh]) => {
      const t = window.broodfall.sim.towers.find((k) => k.id === id);
      const p = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
      const x = bx + (p.x / p.vw) * bw, y = by + (p.y / p.vh) * bh;
      const el = document.querySelector('#stage canvas');
      el.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
      return window.broodfall.cellAtClient(x, y);
    }, [a.id, box.x, box.y, box.width, box.height]);
    if ((await reachedOrCovered(page, a, got)) !== 'missed') reached++;
    else console.log('    missed at turn 0: aimed ' + a.cells.join('/') + ', reached ' + got + ' ' + JSON.stringify(await page.evaluate(([aimed, gotCell]) => { const s = window.broodfall.sim; const f = (x) => s.towers.find((t) => s.cellsOf(t).includes(x)); const ta = f(aimed), tg = f(gotCell); return { aimed: ta ? ta.family : '?', aimedH: s.map.heights[aimed], got: tg ? tg.family : 'no limb', gotH: s.map.heights[gotCell], camNow: window.broodfall.camera(), nowAt: ta ? window.broodfall.worldToScreen(ta.pos.x, ta.pos.y) : null }; }, [a.cells[0], got])) + ' aimedAt ' + Math.round(a.x) + ',' + Math.round(a.y) + ' camAtAim ' + JSON.stringify(camAtAim));
  }
  check(tried > 0 && reached === tried, 'a click aimed at a limb reaches it (or the limb standing in front of it)', `${reached}/${tried}`);

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
    await settle();
    const at = await page.evaluate(() => window.broodfall.sim.towers.slice(0, 12).map((t) => {
      const p = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
      return { id: t.id, cell: t.cell, cells: window.broodfall.sim.cellsOf(t), x: p.x, y: p.y, vw: p.vw, vh: p.vh };
    }));
    const b = await canvas.boundingBox();
    let hit = 0, tried = 0;
    for (const a of at) {
      if (a.x < 10 || a.y < 10 || a.x > a.vw - 10 || a.y > a.vh - 10) continue;
      tried++;
      const got = await page.evaluate(([id, bx, by, bw, bh]) => {
        const t = window.broodfall.sim.towers.find((k) => k.id === id);
        const p = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
        return window.broodfall.cellAtClient(bx + (p.x / p.vw) * bw, by + (p.y / p.vh) * bh);
      }, [a.id, b.x, b.y, b.width, b.height]);
      if ((await reachedOrCovered(page, a, got)) !== 'missed') hit++;
      else console.log('    missed at a turn: aimed ' + a.cells.join('/') + ', reached ' + got + ' ' + (await page.evaluate(([c, d]) => { const s = window.broodfall.sim; const f = (x) => s.towers.find((t) => s.cellsOf(t).includes(x)); const t1 = f(d), t2 = f(c); return (t1 ? t1.family + ' ' + JSON.stringify(t1.cells ?? [t1.cell]) : '?') + ' vs ' + (t2 ? t2.family : 'no limb') + ' height ' + s.map.heights[c]; }, [got, a.cells[0]])));
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
      check(a.tried > 0 && a.hit === a.tried, `turn ${turn}: a click aimed at a limb reaches it (or the limb in front)`, `${a.hit}/${a.tried}`);
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
