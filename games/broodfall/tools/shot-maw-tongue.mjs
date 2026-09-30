/**
 * THE MAW'S TONGUE, photographed close in the real page (Sep 30 2026, Collins: "the frog like tongue
 * design thats brilliant", "but you need the unit to stick to it and go to the mouth").
 *
 * A Maw is built on a roof beside a street, a weakened soldier (under its eat threshold) stands in the
 * street in its reach, the view is brought close, and the game is run a tick at a time from its strike:
 * the tongue out, stuck on the body, halfway home with the body on it, at the lips, swallowed. Then a
 * tough soldier it can only slap. Then about ten seconds of it catching and swallowing a column.
 *
 * Builds its OWN copy of the game (dist-maw/) and serves it on its own port (5293).
 *
 * Usage: node tools/shot-maw-tongue.mjs [--no-video]
 * Pictures: notes/screens/2026-09-30/maw-tongue-*.jpg, maw-tongue-strip.jpg, maw-tongue.mp4.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5293);
const DIST = 'dist-maw';
const VIDEO = !process.argv.includes('--no-video');
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const jpg = (png, name) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, name)]);

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
function startServer() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
console.log(`  built ${join(root, DIST)}`);
const server = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const videoDir = join(shots, 'maw-video');

async function session(record) {
  if (record) rmSync(videoDir, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(record ? { recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } } } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const canvas = page.locator('#stage canvas');
  const artOk = async (name) => {
    const missing = await page.evaluate(() => window.broodfall.artMissing());
    const notice = await page.evaluate(() => {
      const el = document.getElementById('art-notice');
      const shown = !!el && !el.classList.contains('hidden') ? el.textContent : '';
      const banner = /picture did not load/i.test(document.body.innerText) ? 'a "picture did not load" banner' : '';
      return [shown, banner].filter(Boolean).join(' ');
    });
    check(missing.length === 0 && !notice, `${name}: all its art loaded, no notice`, [...missing, notice].filter(Boolean).join(' | ').slice(0, 200));
  };
  const shot = async (name) => {
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(150);
    await artOk(name);
    await canvas.screenshot({ path: png });
    jpg(png, `${name}.jpg`);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
    return png;
  };
  const ticks = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(40); } };
  await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0&biome=suburb`);
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 40000 });
  await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; s.enemies.length = 0; s.projectiles.length = 0; });
  // Every picture loaded before anything is judged.
  await page.waitForFunction(() => window.broodfall.artMissing().length === 0, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const out = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 && d(c) >= 5 && d(c) <= 11) out.push(c);
    return out.sort((a, b) => d(a) - d(b));
  });
  const mawId = await page.evaluate(([near]) => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const at = (c) => [c % W, Math.floor(c / W)];
    const d = (c) => Math.hypot(at(c)[0] - at(near)[0], at(c)[1] - at(near)[1]);
    const cells = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'maw')) cells.push(c);
    cells.sort((a, b) => d(a) - d(b));
    const cell = cells.find((c) => s.groundFor(c, 'maw', 'S'));
    if (cell === undefined) return -1;
    s.hand[0] = { id: 870001, family: 'maw', free: true };
    const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' });
    return r.ok ? s.towers[s.towers.length - 1].id : -1;
  }, [st[2]]);
  check(mawId >= 0, 'a Maw is built');
  for (let i = 0; i < 80 && (await page.evaluate(() => window.broodfall.sim.seedFlights.length)) > 0; i++) await ticks(1);
  // The street cells in its reach, two to three cells off (the tongue is seen crossing to them).
  const reachable = await page.evaluate((id) => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.id === id);
    const out = [];
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== 1) continue;
      const p = s.cellCenter(c);
      const d = Math.hypot(p.x - t.pos.x, p.y - t.pos.y);
      if (d >= s.cfg.cellPx * 1.1 && d <= 48) out.push({ c, d });
    }
    return out.sort((a, b) => Math.abs(a.d - 40) - Math.abs(b.d - 40)).map((x) => x.c);
  }, mawId);
  check(reachable.length > 0, 'a street in its reach', String(reachable.length));
  if (!reachable.length) throw new Error('no street in reach of the Maw');
  const put = (list) => page.evaluate((items) => {
    const s = window.broodfall.sim;
    return items.map(({ kind, cell, hp, dx = 0, dy = 0, speed = 0 }) => {
      const e = s.spawnEnemy(kind, s.gates[0]);
      const c = s.cellCenter(cell);
      e.pos.x = c.x + dx; e.pos.y = c.y + dy;
      e.revealedUntil = s.time + 999;
      if (hp !== undefined) { e.hp = hp; } else { e.hp *= 40; e.maxHp *= 40; }
      if (!speed) e.speed = 0;
      return e.id;
    });
  }, list);
  const closeOn = async (p, zoom, up = 0) => {
    await page.keyboard.press('Home');
    await page.waitForTimeout(200);
    const where = () => page.evaluate(([p, up]) => { const s = window.broodfall.worldToScreen(p.x, p.y); return { ...s, y: s.y - up }; }, [p, up]);
    const bb = await canvas.boundingBox();
    const onPage = (at) => ({ x: bb.x + (at.x / at.vw) * bb.width, y: bb.y + (at.y / at.vh) * bb.height });
    let q = onPage(await where());
    await page.mouse.move(q.x, q.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(500);
    for (let round = 0; round < 5; round++) {
      q = onPage(await where());
      if (Math.hypot(q.x - (bb.x + bb.width / 2), q.y - (bb.y + bb.height / 2)) < 10) break;
      await page.keyboard.down('Shift');
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(400);
    }
  };
  const posOf = (id) => page.evaluate((id) => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.id === id) ?? s.enemies.find((x) => x.id === id);
    return t ? { x: t.pos.x, y: t.pos.y } : null;
  }, id);
  return { page, context, errors, shot, ticks, put, closeOn, posOf, mawId, reachable, artOk };
}

try {
  // ---- The strip: one weakened soldier caught and swallowed, a tick at a time.
  {
    const s = await session(false);
    const { page } = s;
    // The Maw holds its fire while the scene is set.
    await page.evaluate((id) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); t.cooldown = 99; }, s.mawId);
    const [victim] = await s.put([{ kind: 'soldier', cell: s.reachable[0], hp: 12 }]);
    const tp = await s.posOf(s.mawId);
    const ep = await s.posOf(victim);
    await s.closeOn({ x: tp.x + (ep.x - tp.x) * 0.5, y: tp.y + (ep.y - tp.y) * 0.5 }, 10, 60);
    await s.ticks(2);
    await s.shot('maw-tongue-0-before');
    // Let go a moment before it strikes: the board sees its cooldown run down, then wind up (a strike).
    await page.evaluate((id) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); t.cooldown = 0.12; }, s.mawId);
    await page.waitForTimeout(250);
    // Tick until it strikes (the victim leaves the sim: eaten).
    let struck = false;
    for (let i = 0; i < 60 && !struck; i++) {
      await s.ticks(1);
      struck = await page.evaluate(() => window.broodfall.tongues().length > 0);
    }
    check(struck, 'the Maw strikes: its tongue is out');
    const eaten = await page.evaluate((id) => !window.broodfall.sim.enemies.some((e) => e.id === id), victim);
    check(eaten, 'the weakened soldier is eaten (the sim took it)');
    const want = [
      { name: 'maw-tongue-1-out', at: 0.12, label: 'TONGUE OUT' },
      { name: 'maw-tongue-2-stuck', at: 0.26, label: 'STUCK' },
      { name: 'maw-tongue-3-halfway', at: 0.52, label: 'HALFWAY HOME' },
      { name: 'maw-tongue-4-lips', at: 0.72, label: 'AT THE LIPS' },
      { name: 'maw-tongue-5-swallowed', at: 0.95, label: 'SWALLOWED' },
    ];
    const pngs = [];
    const states = [];
    for (const w of want) {
      for (let i = 0; i < 60; i++) {
        const t = await page.evaluate(() => { const l = window.broodfall.tongues()[0]; return l ? l.t : 9; });
        if (t >= w.at) break;
        await s.ticks(1);
      }
      const now = await page.evaluate(() => window.broodfall.tongues());
      states.push({ name: w.name, now });
      pngs.push({ png: await s.shot(w.name), label: w.label });
    }
    const at = (n) => states.find((x) => x.name === n)?.now?.[0];
    check(at('maw-tongue-2-stuck')?.riding === true, 'the eaten soldier is stuck to the tongue', JSON.stringify(at('maw-tongue-2-stuck')));
    check(at('maw-tongue-3-halfway')?.riding === true, 'it rides the tongue home');
    const half = at('maw-tongue-3-halfway');
    const stuck = at('maw-tongue-2-stuck');
    if (half && stuck && half.mouth) {
      const d0 = Math.hypot(stuck.tip.x - stuck.mouth.x, stuck.tip.y - stuck.mouth.y);
      const d1 = Math.hypot(half.tip.x - half.mouth.x, half.tip.y - half.mouth.y);
      check(d1 < d0 * 0.8, 'it is reeled toward the mouth', `${d0.toFixed(0)} px -> ${d1.toFixed(0)} px`);
    }
    check(states[states.length - 1].now.length === 0, 'swallowed: tongue and body gone');
    // The strip: the five moments side by side, the middle of each.
    const args = ['-hide_banner', '-loglevel', 'error', '-y'];
    for (const p of pngs) args.push('-i', p.png);
    const f = pngs.map((p, i) => `[${i}:v]crop=iw*0.46:ih*0.52:iw*0.27:ih*0.22,scale=520:-2,drawtext=text='${p.label}':x=12:y=10:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6:fontfile='C\\:/Windows/Fonts/arialbd.ttf'[v${i}]`).join(';');
    args.push('-filter_complex', `${f};${pngs.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${pngs.length}`, '-q:v', '3', join(screens, 'maw-tongue-strip.jpg'));
    const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
    check(r.status === 0, 'the frame strip is made', r.stderr?.slice(0, 200));
    console.log(`  strip ${join(screens, 'maw-tongue-strip.jpg')}`);

    // ---- A tough soldier: the tongue slaps it and snaps back; it stays in the street.
    const [tough] = await s.put([{ kind: 'soldier', cell: s.reachable[0] }]);
    await page.evaluate((id) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); t.cooldown = 0; }, s.mawId);
    let out = false;
    for (let i = 0; i < 60 && !out; i++) { await s.ticks(1); out = await page.evaluate(() => window.broodfall.tongues().length > 0); }
    for (let i = 0; i < 20; i++) { const t = await page.evaluate(() => window.broodfall.tongues()[0]?.t ?? 9); if (t >= 0.22) break; await s.ticks(1); }
    const slap = await page.evaluate(() => window.broodfall.tongues()[0]);
    check(!!slap && !slap.riding, 'a tough soldier is slapped, not carried', JSON.stringify(slap));
    await s.shot('maw-tongue-6-slap');
    const alive = await page.evaluate((id) => window.broodfall.sim.enemies.some((e) => e.id === id), tough);
    check(alive, 'the slapped soldier stays in the street');
    check(s.errors.length === 0, 'no page errors', s.errors.slice(0, 3).join(' | '));
    await s.context.close();
  }

  // ---- The film: a column walking past, the weak ones caught and swallowed.
  if (VIDEO) {
    const s = await session(true);
    const { page } = s;
    const tp = await s.posOf(s.mawId);
    const cells = s.reachable.slice(0, 4);
    const ep = await page.evaluate((c) => window.broodfall.sim.cellCenter(c), cells[0]);
    await s.closeOn({ x: tp.x + (ep.x - tp.x) * 0.5, y: tp.y + (ep.y - tp.y) * 0.5 }, 9, 60);
    // Weakened soldiers and militia, some tough ones among them; the weak ones are eaten one after another.
    const list = Array.from({ length: 10 }, (_, i) => ({ kind: i % 3 === 2 ? 'militia' : 'soldier', cell: cells[i % cells.length], hp: i % 4 === 3 ? undefined : 10 + (i % 3) * 4, dx: (i % 3) * 5 - 5, dy: (i % 2) * 6 - 3 }));
    await s.put(list);
    await s.ticks(3);
    const t0 = Date.now();
    let caught = 0;
    let lastRiding = false;
    while (Date.now() - t0 < 11500) {
      await page.evaluate(() => window.broodfall.step(1));
      await page.waitForTimeout(24);
      const now = await page.evaluate(() => window.broodfall.tongues());
      const riding = now.some((l) => l.riding);
      if (riding && !lastRiding) caught++;
      lastRiding = riding;
      // More walk in when the street runs dry.
      if ((await page.evaluate(() => window.broodfall.sim.enemies.length)) < 3) await s.put([{ kind: 'soldier', cell: cells[0], hp: 12 }, { kind: 'militia', cell: cells[1 % cells.length], hp: 10 }]);
    }
    check(caught >= 3, 'the film shows bodies caught and carried to the mouth', `${caught} caught`);
    await s.artOk('film');
    check(s.errors.length === 0, 'no page errors in the film', s.errors.slice(0, 3).join(' | '));
    const vid = page.video();
    await s.context.close();
    const webm = await vid.path();
    const mp4 = join(screens, 'maw-tongue.mp4');
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-10.5', '-i', webm, '-t', '10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', mp4]);
    check(r.status === 0 && existsSync(mp4), 'the film is recorded', mp4);
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
