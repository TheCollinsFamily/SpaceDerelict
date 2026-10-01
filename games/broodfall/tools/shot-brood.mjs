/**
 * THE BROOD PIT, THE BROODMOTHER DEN AND YOUR ORDERS, in the browser (Collins, Oct 1 2026: "one spawning
 * fighters from your base and the other spawning a Broodmother, which can either be clicked and set in brood
 * mode ... or be in fighting mode, where it can cast a net slowing enemies ... Broodmothers and brood output
 * should be selectable", and orderable). Real clicks, keys and drags on the board:
 *   1. a Den and a Pit grown; the Broodmother clicked: selected, parked in BROOD mode, her egg ring.
 *   2. T: FIGHT mode (her net's reach drawn).
 *   3. a crowd of soldiers near her; N, then a click on them: the net thrown, the crowd slowed.
 *   4. a box dragged round the warriors: all selected.
 *   5. a right-click on a far street: the stack walks there along the streets; its orders drawn.
 *   6. the warriors held (H), sent back to the body (B), and a control group (Ctrl+1, then 1).
 * The whole beat is filmed (brood-orders.mp4).
 *
 * Usage: node tools/shot-brood.mjs        (starts its own dev server on 5341)
 * Artifacts: notes/screens/2026-10-01/brood-*.png, brood-orders.mp4
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-01');
const vidDir = join(out, 'brood-video-tmp');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5341);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
freePort();
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, recordVideo: { dir: vidDir, size: { width: 1400, height: 900 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  page error:', e.message));
try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=suburb&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  // Grow a Den and a Pit (the hand cycled until each is dealt), the board kept quiet while they hatch.
  const grown = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    b.step(2);
    const quiet = (n) => { for (let i = 0; i < n; i += 10) { b.step(10); s.enemies.length = 0; } };
    const grow = (family) => {
      s.meat.war = 9999; s.meat.science = 9999;
      for (let tries = 0; tries < 400; tries++) {
        // Dealt straight into the hand (on the organ-stage board a limb is only drawn once its organ is grown).
        s.hand[0] = { id: 990000 + tries, family, free: true };
        const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, family));
        if (cell >= 0 && b.play({ kind: 'build', cardIndex: 0, cell }).ok) return s.towers[s.towers.length - 1].id;
        quiet(20);
      }
      return null;
    };
    const den = grow('brood');
    const pit = grow('hatch');
    quiet(700);
    return { den, pit, mothers: s.mothers.length, warriors: s.broodlings.length };
  });
  check(grown.den !== null && grown.pit !== null, 'a Den and a Pit grow', JSON.stringify(grown));
  check(grown.mothers === 1, 'the Den bore one Broodmother');
  check(grown.warriors >= 6, 'warriors from the Pit and the Broodmother', `${grown.warriors}`);

  // Frame her and click her.
  const at = await page.evaluate(() => {
    const b = window.broodfall;
    const m = b.sim.mothers[0];
    b.renderer.resetView?.();
    b.step(1);
    // Close in on her (the units are small at the whole-body view).
    const c = b.renderer.clientOf(b.sim, m.pos.x, m.pos.y);
    b.renderer.zoomAt(c.x, c.y, 2.6);
    return { id: m.id };
  });
  await page.waitForTimeout(1500); // the camera eases in
  Object.assign(at, await page.evaluate(() => {
    const b = window.broodfall;
    const m = b.sim.mothers[0];
    const p = b.renderer.clientOf(b.sim, m.pos.x, m.pos.y);
    return { x: p.x, y: p.y - 12 };
  }));
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(300);
  let sel = await page.evaluate(() => window.broodfall.selectedUnits());
  check(sel.includes(at.id), 'a click on the Broodmother selects her', JSON.stringify(sel));
  const panel1 = await page.evaluate(() => document.getElementById('unit-cmd')?.textContent ?? '');
  check(/BROOD/.test(panel1), 'her panel says BROOD mode', panel1.slice(0, 80));
  await page.screenshot({ path: join(out, 'brood-1-mother-selected.png') });

  // T: fight mode.
  await page.keyboard.press('t');
  await page.waitForTimeout(250);
  const mode = await page.evaluate(() => window.broodfall.sim.mothers[0].mode);
  check(mode === 'fight', 'T sets her to FIGHT mode', mode);
  await page.screenshot({ path: join(out, 'brood-2-fight-mode.png') });

  // A crowd near her; N, then click on it: the net.
  const crowd = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    const m = s.mothers[0];
    m.netCd = 99; // she would throw it on her own: hold it for the player's click
    const ids = [];
    for (let k = 0; k < 5; k++) {
      const e = s.spawnEnemy('soldier', s.gates[0]);
      e.pos = { x: m.pos.x + 70 + (k % 3) * 9, y: m.pos.y + (k < 3 ? 0 : 10) };
      ids.push(e.id);
    }
    b.step(1);
    const p = b.renderer.clientOf(s, m.pos.x + 78, m.pos.y + 4);
    return { ids, x: p.x, y: p.y };
  });
  await page.evaluate(() => { window.broodfall.sim.mothers[0].netCd = 0; });
  await page.waitForTimeout(150);
  await page.keyboard.press('n');
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, 'brood-3-net-aiming.png') });
  await page.mouse.click(crowd.x, crowd.y);
  await page.evaluate(() => window.broodfall.step(2));
  await page.waitForTimeout(150);
  const netted = await page.evaluate((ids) => {
    const s = window.broodfall.sim;
    return { nets: s.stats.netsCast ?? 0, slowed: s.enemies.filter((e) => ids.includes(e.id) && (e.slowUntil ?? 0) > s.time).length };
  }, crowd.ids);
  check(netted.nets >= 1 && netted.slowed >= 3, 'N + a click throws her net: the crowd is slowed', JSON.stringify(netted));
  await page.screenshot({ path: join(out, 'brood-3-net.png') });
  await page.evaluate(() => { window.broodfall.sim.enemies.length = 0; window.broodfall.step(1); });

  // A box round every warrior.
  await page.keyboard.press('Escape');
  // Frame every warrior: the whole-body view, then closer on the middle of them (the camera eases: wait).
  await page.evaluate(() => {
    const b = window.broodfall;
    b.renderer.resetView();
    b.step(1);
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const b = window.broodfall;
    const us = b.sim.broodlings;
    const cx = us.reduce((a, u) => a + u.pos.x, 0) / us.length;
    const cy = us.reduce((a, u) => a + u.pos.y, 0) / us.length;
    const mid = b.renderer.clientOf(b.sim, cx, cy);
    b.renderer.zoomAt(mid.x, mid.y, 1.5);
  });
  await page.waitForTimeout(1500);
  const box = await page.evaluate(() => {
    const b = window.broodfall;
    const ps = b.sim.broodlings.map((u) => b.renderer.clientOf(b.sim, u.pos.x, u.pos.y));
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    return { x0: Math.min(...xs) - 20, y0: Math.min(...ys) - 20, x1: Math.max(...xs) + 20, y1: Math.max(...ys) + 20, n: ps.length };
  });
  await page.mouse.move(box.x0, box.y0);
  await page.mouse.down();
  await page.mouse.move((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, { steps: 6 });
  await page.mouse.move(box.x1, box.y1, { steps: 6 });
  await page.screenshot({ path: join(out, 'brood-4-box-dragging.png') });
  await page.mouse.up();
  await page.waitForTimeout(200);
  sel = await page.evaluate(() => window.broodfall.selectedUnits());
  check(sel.length >= box.n, 'a dragged box selects every warrior in it', `${sel.length} of ${box.n}`);
  await page.screenshot({ path: join(out, 'brood-4-box-selected.png') });

  // Right-click a far street: they walk there.
  const far = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    const from = s.mothers[0].pos;
    let best = null;
    let bd = 0;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== 1 && s.map.cells[c] !== 2) continue;
      const p = s.cellCenter(c);
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d > bd && d < 260) { const q = b.renderer.clientOf(s, p.x, p.y); if (q.x > 60 && q.x < 1340 && q.y > 80 && q.y < 860) { bd = d; best = { w: p, c: q }; } }
    }
    return best;
  });
  await page.mouse.click(far.c.x, far.c.y, { button: 'right' });
  await page.waitForTimeout(150);
  const ordered = await page.evaluate(() => window.broodfall.sim.broodlings.filter((u) => (u.orders ?? []).some((o) => o.kind === 'move')).length);
  check(ordered >= box.n, 'a right-click on a street orders them all to move there', `${ordered}`);
  await page.screenshot({ path: join(out, 'brood-5-orders-drawn.png') });
  for (let k = 0; k < 6; k++) { await page.evaluate(() => { window.broodfall.step(40); window.broodfall.sim.enemies.length = 0; }); await page.waitForTimeout(250); }
  const arrived = await page.evaluate((w) => window.broodfall.sim.broodlings.filter((u) => Math.hypot(u.pos.x - w.x, u.pos.y - w.y) < 40).length, far.w);
  check(arrived >= Math.floor(box.n * 0.8), 'they walk the streets to it', `${arrived} of ${box.n} there`);
  await page.screenshot({ path: join(out, 'brood-5-stack-sent-out.png') });

  // Hold, back to the body, a control group.
  await page.keyboard.press('h');
  const held = await page.evaluate(() => window.broodfall.sim.broodlings.filter((u) => u.orders?.[0]?.kind === 'hold').length);
  check(held >= box.n, 'H holds them', `${held}`);
  await page.keyboard.press('Control+1');
  await page.keyboard.press('b');
  for (let k = 0; k < 6; k++) { await page.evaluate(() => { window.broodfall.step(60); window.broodfall.sim.enemies.length = 0; }); await page.waitForTimeout(200); }
  const home = await page.evaluate(() => { const s = window.broodfall.sim; const p = s.bodyPoint(); return s.broodlings.filter((u) => Math.hypot(u.pos.x - p.x, u.pos.y - p.y) < 50).length; });
  check(home >= Math.floor(box.n * 0.8), 'B sends them back to the body', `${home}`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('1');
  sel = await page.evaluate(() => window.broodfall.selectedUnits());
  check(sel.length >= box.n, 'Ctrl+1 then 1 brings the group back', `${sel.length}`);
  await page.screenshot({ path: join(out, 'brood-6-group-at-body.png') });
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
  freePort();
}
// The film of the whole beat.
try {
  const webm = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (webm) {
    execSync(`ffmpeg -loglevel error -y -i "${join(vidDir, webm)}" -vf "fps=24,scale=1120:-2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${join(out, 'brood-orders.mp4')}"`);
    console.log(`  film: ${join(out, 'brood-orders.mp4')}`);
  }
  rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log('  film failed:', e.message); }
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
