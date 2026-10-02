/**
 * THE FLAMETROOPER, in the browser (Collins, Oct 2 2026: "an enemy unit of war caste with a flamethrower that is
 * way better against units and targets them first, only going after the base if all units are clear").
 *   1. a Brood Pit grown and its warriors gathered on a street out from the body;
 *   2. two Flametroopers set down a little way up that street: they go for the warriors and hose them;
 *   3. the warriors burn (shots mid-stream);
 *   4. with no unit left in sight, the troopers turn on the limbs and the core.
 * The whole beat is filmed (flame-troopers.mp4).
 *
 * Usage: node tools/shot-flame.mjs        (starts its own dev server on 5347)
 * Artifacts: notes/screens/2026-10-02/flame-*.png, flame-troopers.mp4
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
const vidDir = join(out, 'flame-video-tmp');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5347);
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
/** Advance the sim a few ticks at a time with the page drawing in between, so the film shows it happen. */
const play = async (ticks, each = 1, wait = 60) => {
  for (let i = 0; i < ticks; i += each) {
    await page.evaluate((n) => window.broodfall.step(n), each);
    await page.waitForTimeout(wait);
  }
};
try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=suburb&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  // A Brood Pit grown (dealt straight into the hand) and its warriors hatched, the board kept quiet; then a street
  // out from the body, and the warriors ordered there and held.
  const setup = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    b.step(2);
    const quiet = (n) => { for (let i = 0; i < n; i += 10) { b.step(10); s.enemies.length = 0; } };
    s.meat.war = 9999; s.meat.science = 9999;
    let pit = null;
    for (let tries = 0; tries < 400 && !pit; tries++) {
      s.hand[0] = { id: 991000 + tries, family: 'hatch', free: true };
      const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, 'hatch'));
      if (cell >= 0 && b.play({ kind: 'build', cardIndex: 0, cell }).ok) pit = s.towers[s.towers.length - 1].id;
      else quiet(20);
    }
    quiet(400);
    // A few more warriors (a stack worth answering), standing with the pit's.
    const body = s.bodyPoint();
    const W = s.cfg.gridW;
    let spot = null;
    for (let c = 0; c < s.map.cells.length && !spot; c++) {
      if (s.map.cells[c] !== 1) continue;
      const p = s.cellCenter(c);
      const d = Math.hypot(p.x - body.x, p.y - body.y);
      if (d > 100 && d < 240 && (s.map.cells[c + 1] === 1 || s.map.cells[c + W] === 1)) spot = { c, p };
    }
    if (!spot) return { pit, ok: false };
    while (s.broodlings.length < 7) {
      s.broodlings.push({ id: 992000 + s.broodlings.length, motherId: pit ?? -1, pos: { ...spot.p }, hp: 34, maxHp: 34, cooldown: 0, guard: { ...spot.p } });
    }
    for (const u of s.broodlings) { u.pos = { x: spot.p.x + (Math.random() - 0.5) * 18, y: spot.p.y + (Math.random() - 0.5) * 18 }; u.guard = { ...spot.p }; u.orders = [{ kind: 'hold' }]; }
    // Two troopers three cells up the street.
    let at = null;
    for (let c = 0; c < s.map.cells.length && !at; c++) {
      if (s.map.cells[c] !== 1) continue;
      const q = s.cellCenter(c);
      const dq = Math.hypot(q.x - spot.p.x, q.y - spot.p.y);
      if (dq > 60 && dq < 95 && Math.hypot(q.x - body.x, q.y - body.y) > Math.hypot(spot.p.x - body.x, spot.p.y - body.y)) at = q;
    }
    if (!at) return { pit, ok: false, why: 'no trooper spot' };
    const t1 = s.spawnEnemy('flametrooper', s.gates[0]); t1.pos = { x: at.x + 8, y: at.y };
    const t2 = s.spawnEnemy('flametrooper', s.gates[0]); t2.pos = { x: at.x + 22, y: at.y + 4 };
    s.enemies = s.enemies.filter((e) => e === t1 || e === t2);
    const mid = { x: (spot.p.x + at.x) / 2, y: (spot.p.y + at.y) / 2 };
    b.renderer.resetView?.();
    const c = b.renderer.clientOf(s, mid.x, mid.y);
    b.renderer.zoomAt(c.x, c.y, 2.4);
    return { ok: true, pit, warriors: s.broodlings.length, troopers: [t1.id, t2.id] };
  });
  check(setup.ok, 'set up: warriors on a street and two troopers up it', JSON.stringify(setup));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, 'flame-1-before.png') });

  // They come for the warriors and hose them.
  let flaming = false;
  let shot2 = false;
  for (let k = 0; k < 120; k++) {
    await play(1, 1, 50);
    const st = await page.evaluate(() => { const s = window.broodfall.sim; return { flaming: s.enemies.some((e) => !!e.flameTo), units: s.broodlings.length }; });
    if (st.flaming) flaming = true;
    if (st.flaming && !shot2) { await page.waitForTimeout(150); await page.screenshot({ path: join(out, 'flame-2-hosing.png') }); shot2 = true; }
    if (st.units === 0) break;
  }
  await page.screenshot({ path: join(out, 'flame-3-stack-burnt.png') });
  const after = await page.evaluate(() => { const s = window.broodfall.sim; return { units: s.broodlings.length, troopers: s.enemies.filter((e) => e.kind === 'flametrooper').length }; });
  check(flaming, 'the troopers hosed the warriors');
  check(after.units <= 2, 'the stack burnt (warriors left)', `${after.units} of ${setup.warriors}`);

  // No units left in sight: they turn on the limbs and the core (the stream goes out; they walk on).
  // The pit keeps hatching (and the troopers rightly go for each new warrior): take the pit away for this part.
  await page.evaluate(() => { const s = window.broodfall.sim; s.broodlings.length = 0; s.towers = s.towers.filter((t) => t.family !== 'hatch' && t.family !== 'brood'); });
  await play(30, 1, 50);
  const turn = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const ts = s.enemies.filter((e) => e.kind === 'flametrooper');
    return { n: ts.length, hosing: ts.some((e) => !!e.flameTo), heading: ts.map((e) => Math.round(Math.hypot(e.pos.x - s.core.x, e.pos.y - s.core.y))) };
  });
  check(turn.n > 0 && !turn.hosing, 'with no units in sight, no stream: they march on', JSON.stringify(turn));
  await page.evaluate(() => {
    const b = window.broodfall; const s = b.sim; const e = s.enemies.find((x) => x.kind === 'flametrooper');
    if (e) { const c = b.renderer.clientOf(s, e.pos.x, e.pos.y); b.renderer.zoomAt(c.x, c.y, 1); }
  });
  await play(60, 2, 50);
  const closer = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return s.enemies.filter((e) => e.kind === 'flametrooper').map((e) => Math.round(Math.hypot(e.pos.x - s.core.x, e.pos.y - s.core.y)));
  });
  check(closer.length < turn.n || Math.min(...closer) < Math.min(...turn.heading), 'they head for the body (closer, or killed by limbs on the way)', `${turn.heading} -> ${closer}`);
  await page.screenshot({ path: join(out, 'flame-4-turned-on-the-base.png') });

  // CLOSE-UPS (Oct 2 2026, Collins: the flame "doesn't track the front of the nozzle"): one trooper on a quiet
  // street hosing a warrior set down in each of eight directions round it (every drawn view and its mirror), at
  // two camera turns. Each a crop round the trooper, mid-stream; then a sheet of all of them.
  // And the SIZE: the trooper, a soldier and a militiaman beside the width of one street cell, on the screen.
  const shotsTaken = [];
  const closeups = async (tag) => {
    // The board alone in the shots: every page element over the canvas hidden.
    await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) if (!(el instanceof HTMLCanvasElement) && !el.querySelector('canvas')) el.style.visibility = 'hidden'; });
    for (const turn of [0, 1]) {
      if (turn) { await page.evaluate(() => window.broodfall.turnBy(1)); await page.waitForTimeout(1500); }
      for (let k = 0; k < 8; k++) {
        const where = await page.evaluate((k) => {
          const b = window.broodfall; const s = b.sim;
          s.enemies.length = 0; s.broodlings.length = 0; s.spawnQueue.length = 0;
          s.towers = s.towers.filter((t) => t.family !== 'hatch' && t.family !== 'brood');
          // A street cell well inside the board, a little way out from the body.
          const body = s.bodyPoint();
          let c0 = -1; let best = 1e9;
          for (let c = 0; c < s.map.cells.length; c++) {
            if (s.map.cells[c] !== 1) continue;
            const p = s.cellCenter(c);
            const d = Math.hypot(p.x - body.x, p.y - body.y);
            if (d > 90 && d < best) { best = d; c0 = c; }
          }
          const at = s.cellCenter(c0);
          const t = s.spawnEnemy('flametrooper', s.gates[0]); t.pos = { ...at };
          const a = (k / 8) * Math.PI * 2;
          const w = { x: at.x + Math.cos(a) * 34, y: at.y + Math.sin(a) * 34 };
          s.broodlings.push({ id: 995000 + k, motherId: -1, pos: w, hp: 9999, maxHp: 9999, cooldown: 99, guard: { ...w }, orders: [{ kind: 'hold' }] });
          for (let i = 0; i < 3; i++) b.step(1);
          b.renderer.resetView?.();
          const c = b.renderer.clientOf(s, at.x, at.y);
          b.renderer.zoomAt(c.x, c.y, 3);
          return { id: t.id };
        }, k);
        await page.waitForTimeout(900);
        // Keep it firing a few frames with the page drawing, then hold the shot mid-stream.
        for (let i = 0; i < 4; i++) { await page.evaluate(() => { const s = window.broodfall.sim; s.spawnQueue.length = 0; s.enemies = s.enemies.filter((e) => e.kind === 'flametrooper'); s.broodlings.forEach((u) => { u.hp = 9999; }); window.broodfall.step(1); }); await page.waitForTimeout(70); }
        const box = await page.evaluate((id) => {
          const b = window.broodfall; const s = b.sim; const e = s.enemies.find((x) => x.id === id);
          if (!e) return null;
          const c = b.renderer.clientOf(s, e.pos.x, e.pos.y);
          return { x: Math.round(c.x), y: Math.round(c.y), firing: !!e.flameTo };
        }, where.id);
        if (!box) continue;
        const file = join(out, `flame-close-${tag}-turn${turn}-dir${k}.png`);
        await page.screenshot({ path: file, clip: { x: Math.max(0, box.x - 170), y: Math.max(0, box.y - 150), width: 340, height: 260 } });
        shotsTaken.push({ file, firing: box.firing });
      }
    }
    await page.evaluate(() => window.broodfall.turnBy(-1));
    await page.waitForTimeout(1200);
  };
  await closeups('jet');
  check(shotsTaken.every((x) => x.firing), 'every close-up caught the trooper firing', `${shotsTaken.filter((x) => x.firing).length}/${shotsTaken.length}`);

  // The size against a street cell, at three zooms.
  const sizes = [];
  for (const zoom of [1, 2, 3]) {
    sizes.push(await page.evaluate((zoom) => {
      const b = window.broodfall; const s = b.sim;
      s.enemies.length = 0; s.broodlings.length = 0;
      const body = s.bodyPoint();
      let c0 = -1;
      for (let c = 0; c < s.map.cells.length && c0 < 0; c++) {
        if (s.map.cells[c] !== 1) continue;
        const p = s.cellCenter(c);
        if (Math.hypot(p.x - body.x, p.y - body.y) > 150) c0 = c;
      }
      const at = s.cellCenter(c0);
      const kinds = ['flametrooper', 'soldier', 'militia'];
      const ids = kinds.map((k, i) => { const e = s.spawnEnemy(k, s.gates[0]); e.pos = { x: at.x + (i - 1) * 40, y: at.y }; return e.id; });
      b.renderer.resetView?.();
      const c = b.renderer.clientOf(s, at.x, at.y);
      b.renderer.zoomAt(c.x, c.y, zoom);
      b.step(1);
      // A street cell's width on the screen: the length of one cell edge (the lane is one cell across).
      const P = s.cfg.cellPx;
      const a0 = b.renderer.clientOf(s, at.x - P / 2, at.y - P / 2);
      const a1 = b.renderer.clientOf(s, at.x + P / 2, at.y - P / 2);
      const cell = Math.hypot(a1.x - a0.x, a1.y - a0.y);
      const units = b.renderer.units;
      // The figure's own width: its frame on the screen times the share of the frame its body fills (measured on the
      // atlases, the mean of its SW, W and S walking frames: trooper 0.43, soldier 0.49, militia 0.40).
      const share = [0.43, 0.49, 0.40];
      const w = ids.map((id, i) => { const v = units.get(id); if (!v) return null; const bb = v.sprite.getBounds(); return Math.round(bb.width * share[i]); });
      return { zoom, cell: Math.round(cell), trooper: w[0], soldier: w[1], militia: w[2] };
    }, zoom));
    await page.waitForTimeout(400);
  }
  for (const z of sizes) console.log(`  size at zoom ${z.zoom}: street cell ${z.cell}px, trooper ${z.trooper}px, soldier ${z.soldier}px, militia ${z.militia}px`);
  check(sizes.every((z) => z.trooper && z.soldier && z.trooper <= z.soldier * 0.8), 'the trooper is clearly smaller than a soldier', JSON.stringify(sizes.map((z) => [z.trooper, z.soldier])));
  check(sizes.every((z) => z.trooper && z.trooper <= z.cell * 0.7), 'a trooper takes well under a street cell', JSON.stringify(sizes.map((z) => [z.trooper, z.cell])));
  console.log(`  two abreast: ${sizes.map((z) => `${z.trooper * 2}px in a ${z.cell}px cell`).join(', ')}`);
  // THE OTHER OPTION, for the side-by-side: the jet drawn from particles (?flame=particles), the same close-ups.
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=suburb&landing=0&flame=particles`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });
  await page.evaluate(() => { window.broodfall.step(2); });
  await closeups('particles');
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
  freePort();
}
try {
  const webm = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (webm) {
    execSync(`ffmpeg -loglevel error -y -i "${join(vidDir, webm)}" -vf "fps=24,scale=1120:-2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${join(out, 'flame-troopers.mp4')}"`);
    console.log(`  film: ${join(out, 'flame-troopers.mp4')}`);
  }
  rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log('  film failed:', e.message); }

// The sheets: every close-up of the filmed jet (both camera turns), and the two options side by side (turn 0).
try {
  const tile = (f) => ['-i', f];
  const jet = [0, 1].flatMap((t) => [...Array(8).keys()].map((k) => join(out, `flame-close-jet-turn${t}-dir${k}.png`)));
  const rows = (files, per) => {
    const parts = []; const labels = [];
    for (let r = 0; r * per < files.length; r++) {
      const ids = files.slice(r * per, (r + 1) * per).map((_, j) => `[${r * per + j}:v]`);
      parts.push(`${ids.join('')}hstack=inputs=${ids.length}[r${r}]`); labels.push(`[r${r}]`);
    }
    return `${parts.join(';')};${labels.join('')}vstack=inputs=${labels.length}`;
  };
  execSync(`ffmpeg -loglevel error -y ${jet.map((f) => `-i "${f}"`).join(' ')} -filter_complex "${rows(jet, 4)}" -q:v 3 "${join(out, 'flame-close-sheet.jpg')}"`);
  const pairs = [...Array(8).keys()].flatMap((k) => [join(out, `flame-close-jet-turn0-dir${k}.png`), join(out, `flame-close-particles-turn0-dir${k}.png`)]);
  execSync(`ffmpeg -loglevel error -y ${pairs.map((f) => `-i "${f}"`).join(' ')} -filter_complex "${rows(pairs, 4)}" -q:v 3 "${join(out, 'flame-options-jet-vs-particles.jpg')}"`);
  console.log(`  sheets: ${join(out, 'flame-close-sheet.jpg')}, ${join(out, 'flame-options-jet-vs-particles.jpg')}`);
  void tile;
} catch (e) { console.log('  sheets failed:', e.message.slice(0, 200)); }
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
