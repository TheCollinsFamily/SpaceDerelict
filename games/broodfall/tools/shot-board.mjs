/**
 * THE BOARD FIXES OF SEP 29 2026, SEEN IN THE REAL GAME (Collins: "I have not seen screenshots
 * of any of your fixes working"). Each picture is a check, and a JPEG for him to look at:
 *
 *   board-01-props-turn0.jpg    a corner of a suburb, the camera as it starts
 *   board-02-props-turn2.jpg    the same corner, the camera turned half round: the props seen from behind
 *   board-03-wetland-start.jpg  a Mirewater Delta board at minute zero: its own look, not its guest's
 *   board-04-limbs-standing.jpg the three redrawn limbs standing in their cells
 *   board-05-limbs-before-after.jpg  their pictures before (leaning) and after
 *   board-06-seedling-pod.jpg   a Seedling shot up from the landing site, mid-arc, close
 *
 * Usage: npm run build && node tools/shot-board.mjs
 * Written to notes/screens/2026-09-29/.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-09-29');
mkdirSync(out, { recursive: true });
/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const jpg = (png, name) => {
  const file = join(out, name);
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', file]);
  rmSync(png, { force: true });
  console.log(`  written: ${file}`);
  return file;
};

function freePort() {
  try {
    const text = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of text.split(String.fromCharCode(10))) {
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

const server = await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const open = async (query) => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[art]')) errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?${query}`);
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
  return { page, errors, canvas: page.locator('#stage canvas') };
};
/** Zoom the view onto a world point and keep it there. */
const zoomOn = async (page, canvas, wx, wy, clicks) => {
  const b = await canvas.boundingBox();
  const p = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [wx, wy]);
  await page.mouse.move(b.x + (p.x / p.vw) * b.width, b.y + (p.y / p.vh) * b.height);
  for (let i = 0; i < clicks; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(900);
};

try {
  // 1-2. Props from both sides.
  {
    const { page, errors, canvas } = await open('seed=5&autostart=1&speed=0&biome=suburb');
    await page.evaluate(() => window.broodfall.step(2));
    // A prop that has a back: the renderer's own list of what stands where.
    const spot = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const core = [s.map.coreCell % W, Math.floor(s.map.coreCell / W)];
      // Unclaimed ground is smoke: a district next to the body's, not held by its skin.
      let best = null;
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== 1 || s.isCreeped(c)) continue;
        const d = Math.hypot((c % W) - core[0], Math.floor(c / W) - core[1]);
        if (d > 5 && d < 11 && (!best || d < best.d)) best = { c, d };
      }
      const p = s.cellCenter(best.c);
      return { x: p.x, y: p.y };
    });
    await zoomOn(page, canvas, spot.x, spot.y, 5);
    await canvas.screenshot({ path: join(out, 'b1.png') });
    jpg(join(out, 'b1.png'), 'board-01-props-turn0.jpg');
    await page.keyboard.press('e');
    await page.waitForTimeout(700);
    await page.keyboard.press('e');
    await page.waitForTimeout(1200);
    check(await page.evaluate(() => window.broodfall.turn()) === 2, 'the camera is turned half round');
    await canvas.screenshot({ path: join(out, 'b2.png') });
    jpg(join(out, 'b2.png'), 'board-02-props-turn2.jpg');
    check(errors.length === 0, 'props: no errors in the page', errors.slice(0, 3).join(' | '));
    await page.close();
  }
  // 3. The wetland at minute zero.
  {
    const { page, errors, canvas } = await open('seed=42&autostart=1&speed=0&biome=wetland');
    await page.evaluate(() => window.broodfall.step(2));
    await page.waitForTimeout(900);
    check(await page.evaluate(() => window.broodfall.biome()) === 'wetland', 'the board is drawn as the Mirewater Delta');
    await canvas.screenshot({ path: join(out, 'b3.png') });
    jpg(join(out, 'b3.png'), 'board-03-wetland-start.jpg');
    check(errors.length === 0, 'wetland: no errors in the page', errors.slice(0, 3).join(' | '));
    await page.close();
  }
  // 4. The three redrawn limbs, standing.
  {
    const { page, errors, canvas } = await open('seed=11&autostart=1&speed=0&biome=megacity');
    await page.evaluate(() => window.broodfall.step(300));
    const placed = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.meat.war = 9000; s.meat.science = 9000;
      const W = s.cfg.gridW;
      const at = (c) => [c % W, Math.floor(c / W)];
      const d = (c) => Math.hypot(at(c)[0] - at(s.map.coreCell)[0], at(c)[1] - at(s.map.coreCell)[1]);
      const taken = [];
      const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
      const out = [];
      for (const [family, facing] of [['amp', 'S'], ['lure', 'S'], ['conduit', 'N']]) {
        const cells = [];
        for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family, facing) && d(c) > 2) cells.push(c);
        cells.sort((a, b) => d(a) - d(b));
        const cell = cells.find((c) => s.groundFor(c, family, facing).every(apart));
        if (cell === undefined) continue;
        s.hand[0] = { id: 900000 + out.length, family, free: true };
        if (s.issue({ kind: 'build', cardIndex: 0, cell, facing }).ok) {
          taken.push(...s.groundFor(cell, family, facing) ?? [cell]);
          const t = s.towers[s.towers.length - 1];
          t.facing = facing;
          out.push({ family, x: t.pos.x, y: t.pos.y });
        }
      }
      return out;
    });
    check(placed.length === 3, 'the three redrawn limbs are placed', placed.map((p) => p.family).join(', '));
    const mid = placed.reduce((a, p) => ({ x: a.x + p.x / placed.length, y: a.y + p.y / placed.length }), { x: 0, y: 0 });
    // The wave's banner stands over the middle of the board for a while: out of the picture.
    await page.evaluate(() => { document.getElementById('banner').style.display = 'none'; window.broodfall.step(2); });
    await zoomOn(page, canvas, mid.x, mid.y, 5);
    await canvas.screenshot({ path: join(out, 'b4.png') });
    jpg(join(out, 'b4.png'), 'board-04-limbs-standing.jpg');

    // 6. A seedling in the air, on the same board.
    const shot = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'sprout')) cells.push(c);
      // The farthest it can go, up to eight cells: a long arc, but still on the screen.
      cells.sort((a, b) => Math.abs(d(a) - 8) - Math.abs(d(b) - 8));
      s.hand.push({ id: 990001, family: 'sprout', free: true });
      const r = s.issue({ kind: 'build', cardIndex: s.hand.length - 1, cell: cells[0] });
      const f = s.seedFlights[s.seedFlights.length - 1];
      return { ok: r.ok, why: `${cells.length} cells; ${JSON.stringify(r)}`, mid: f ? { x: (f.from.x + f.to.x) / 2, y: (f.from.y + f.to.y) / 2 } : null };
    });
    check(shot.ok && shot.mid !== null, 'a Seedling is shot up', shot.ok ? '' : shot.why);
    if (!shot.mid) throw new Error('no Seedling in the air');
    // Close on the middle of its path: the pod is up above that point when it is half way.
    await zoomOn(page, canvas, shot.mid.x, shot.mid.y, 3);
    // Half way along its arc (the flight is 0.9 s at 10 steps a second).
    await page.evaluate(() => window.broodfall.step(4));
    await page.waitForTimeout(400);
    // Where the pod is on the screen: over the point of the ground it has reached, lifted by its
    // arc (70 marks at the top, 1.9 world pixels a mark).
    const pod = await page.evaluate(() => {
      const f = window.broodfall.sim.seedFlights[0];
      if (!f) return null;
      const t = 1 - f.ttl / 0.9;
      const g = window.broodfall.worldToScreen(f.from.x + (f.to.x - f.from.x) * t, f.from.y + (f.to.y - f.from.y) * t);
      const cam = window.broodfall.camera();
      return { x: g.x, y: g.y - (Math.sin(t * Math.PI) * 70 * 1.9) * cam.scale, vw: g.vw, vh: g.vh };
    });
    check(pod !== null, 'the pod is in the air when the picture is taken');
    await canvas.screenshot({ path: join(out, 'b6.png') });
    // The whole view, and beside it the pod twice as big.
    const b = await canvas.boundingBox();
    const sx = b.width / pod.vw;
    const box = 300;
    const cx = Math.round(Math.max(box / 2, Math.min(b.width - box / 2, pod.x * sx)) - box / 2);
    const cy = Math.round(Math.max(box / 2, Math.min(b.height - box / 2, pod.y * sx)) - box / 2);
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', join(out, 'b6.png'), '-filter_complex',
      `[0]split[a][b];[b]crop=${box}:${box}:${cx}:${cy},scale=${Math.round(b.height)}:${Math.round(b.height)}[z];[a][z]hstack`, join(out, 'b6z.png')]);
    rmSync(join(out, 'b6.png'), { force: true });
    jpg(join(out, 'b6z.png'), 'board-06-seedling-pod.jpg');
    check(errors.length === 0, 'limbs and pod: no errors in the page', errors.slice(0, 3).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}

// 5. Before and after, from the pictures themselves: the leaning ones kept in v1-leaning.
{
  const src = join(root, 'art-src', 'limbs');
  const pairs = [['amp', 'styled.png'], ['lure', 'styled.png'], ['conduit', 'back.png']];
  const args = [];
  for (const [family, file] of pairs) {
    const before = join(src, family, 'v1-leaning', file);
    const after = join(src, family, file);
    if (existsSync(before) && existsSync(after)) args.push('-i', before, '-i', after);
  }
  const n = args.length / 4;
  if (n) {
    const f = [];
    for (let i = 0; i < 2 * n; i++) f.push(`[${i}]scale=320:320[p${i}]`);
    const rows = [];
    for (let i = 0; i < n; i++) { f.push(`[p${2 * i}][p${2 * i + 1}]hstack[r${i}]`); rows.push(`[r${i}]`); }
    f.push(`${rows.join('')}vstack=${n}`);
    const file = join(out, 'board-05-limbs-before-after.jpg');
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, '-filter_complex', f.join(';'), '-q:v', '3', file]);
    console.log(`  written: ${file} (left: before, leaning; right: after)`);
  }
}
console.log(failures.length ? `\nBOARD SHOTS: ${failures.length} failure(s): ${failures.join('; ')}` : '\nBOARD SHOTS: all verified.');
process.exit(failures.length ? 1 : 0);
