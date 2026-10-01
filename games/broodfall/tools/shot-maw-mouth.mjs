/**
 * THE MAW'S TONGUE LEAVING ITS MOUTH, photographed very close in the real page (Oct 1 2026, Collins: "the
 * tongue of the maw appears to start out of nowhere (e.g. it does not look like it is coming from inside its
 * mouth but appearing in front of it)"). See src/render/mawMouth.ts and src/render/mawTongue.ts.
 *
 * A Maw is built on a roof, a weakened soldier stands in the street in front of it, the view is brought in
 * close on its mouth, and the game is run a tick at a time from its strike: the launch (the tip still in the
 * throat), out, stuck, reeling in at the lips, behind the teeth, the gulp. Then the same moments at each of
 * the camera's four turns (the Maw from the front, mirrored, and from behind), and (with --video) about eight
 * seconds of it catching and swallowing bodies, close.
 *
 * Usage:
 *   node tools/shot-maw-mouth.mjs --tag after [--video]          builds its own copy (dist-mawmouth/), port 5294
 *   node tools/shot-maw-mouth.mjs --tag before --dist <built dir>  photographs an already built copy (a before build)
 *   node tools/shot-maw-mouth.mjs --compose                        joins the before and after strips
 * Pictures: notes/screens/2026-09-30/maw-mouth-<tag>-*.jpg, maw-mouth-<tag>-strip.jpg, maw-mouth-turns.jpg,
 * maw-mouth-BEFORE-AFTER.jpg, maw-mouth.mp4.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5294);
const argOf = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };
const TAG = argOf('--tag') ?? 'after';
const PREBUILT = argOf('--dist');
const DIST = PREBUILT ?? 'dist-mawmouth';
const VIDEO = process.argv.includes('--video');
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const FONT = "fontfile='C\\:/Windows/Fonts/arialbd.ttf'";
const MOMENTS = [
  { n: 'launch', label: 'LAUNCH' },
  { n: 'out', label: 'OUT' },
  { n: 'stuck', label: 'STUCK' },
  { n: 'lips', label: 'REELING IN AT THE LIPS' },
  { n: 'teeth', label: 'BEHIND THE TEETH' },
  { n: 'gulp', label: 'GULP' },
];

if (process.argv.includes('--compose')) {
  // BEFORE over AFTER, each its strip of the six moments.
  const a = join(screens, 'maw-mouth-before-strip.jpg');
  const b = join(screens, 'maw-mouth-after-strip.jpg');
  const out = join(screens, 'maw-mouth-BEFORE-AFTER.jpg');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', a, '-i', b, '-filter_complex',
    `[0:v]drawtext=text='BEFORE':x=w-150:y=h-44:fontsize=30:fontcolor=yellow:box=1:boxcolor=black@0.7:${FONT}[a];[1:v]drawtext=text='AFTER':x=w-140:y=h-44:fontsize=30:fontcolor=yellow:box=1:boxcolor=black@0.7:${FONT}[b];[a][b]vstack=inputs=2`, '-q:v', '3', out], { encoding: 'utf8' });
  check(r.status === 0, 'the before/after strip is made', r.stderr?.slice(0, 300));
  console.log(`  strip ${out}`);
  process.exit(failures.length ? 1 : 0);
}

const { chromium } = await import('@playwright/test');
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

if (!PREBUILT) {
  const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
  console.log(`  built ${join(root, DIST)}`);
}
const server = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const videoDir = join(shots, 'maw-mouth-video');

async function session(record = false) {
  if (record) rmSync(videoDir, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(record ? { recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } } } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // The page's clock, so that a catch can be stepped a frame at a time (oneCatch).
  await page.clock.install();
  const canvas = page.locator('#stage canvas');
  const artOk = async (name) => {
    const missing = await page.evaluate(() => window.broodfall.artMissing());
    const notice = await page.evaluate(() => {
      const el = document.getElementById('art-notice');
      const shown = !!el && !el.classList.contains('hidden') ? el.textContent : '';
      const banner = /did not load/i.test(document.body.innerText) ? 'a "did not load" banner' : '';
      return [shown, banner].filter(Boolean).join(' ');
    });
    check(missing.length === 0 && !notice, `${name}: all its art loaded, no "did not load" banner`, [...missing, notice].filter(Boolean).join(' | ').slice(0, 200));
  };
  const shot = async (name) => {
    const png = join(shots, `${name}.png`);
    await artOk(name);
    await canvas.screenshot({ path: png });
    jpg(png, `${name}.jpg`);
    return png;
  };
  const ticks = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(40); } };
  await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0&biome=suburb`);
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 40000 });
  await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; s.enemies.length = 0; s.projectiles.length = 0; });
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
    const r = s.issue({ kind: 'build', cardIndex: 0, cell });
    return r.ok ? s.towers[s.towers.length - 1].id : -1;
  }, [st[2]]);
  check(mawId >= 0, 'a Maw is built');
  for (let i = 0; i < 80 && (await page.evaluate(() => window.broodfall.sim.seedFlights.length)) > 0; i++) await ticks(1);
  // The street cells in its reach, those in FRONT of it on the screen first (its mouth is seen).
  const reach = () => page.evaluate((id) => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.id === id);
    const out = [];
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== 1) continue;
      const p = s.cellCenter(c);
      const d = Math.hypot(p.x - t.pos.x, p.y - t.pos.y);
      if (d >= s.cfg.cellPx * 1.1 && d <= 48) out.push({ c, d });
    }
    const m = window.broodfall.worldToScreen(t.pos.x, t.pos.y);
    const front = (c) => { const p = s.cellCenter(c); return window.broodfall.worldToScreen(p.x, p.y).y > m.y + 4 ? 1 : 0; };
    const cells = out.sort((a, b) => front(b.c) - front(a.c) || b.d - a.d).map((x) => x.c);
    return { cells, front: cells.length ? front(cells[0]) : 0 };
  }, mawId);
  let found = await reach();
  for (let turn = 0; turn < 3 && !found.front; turn++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(900);
    found = await reach();
  }
  check(found.cells.length > 0, 'a street in its reach', String(found.cells.length));
  if (!found.cells.length) throw new Error('no street in reach of the Maw');
  const put = (list) => page.evaluate((items) => {
    const s = window.broodfall.sim;
    return items.map(({ kind, cell, hp, dx = 0, dy = 0 }) => {
      const e = s.spawnEnemy(kind, s.gates[0]);
      const c = s.cellCenter(cell);
      e.pos.x = c.x + dx; e.pos.y = c.y + dy;
      e.revealedUntil = s.time + 999;
      if (hp !== undefined) { e.hp = hp; } else { e.hp *= 40; e.maxHp *= 40; }
      e.speed = 0; e.slowMult = 0; e.slowUntil = s.time + 9999;
      e.staged = true;
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
  const setCd = (cd) => page.evaluate(([id, cd]) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); t.cooldown = cd; }, [mawId, cd]);
  const tongue = () => page.evaluate(() => window.broodfall.tongues()[0] ?? null);
  return { page, context, errors, shot, ticks, put, closeOn, posOf, setCd, tongue, mawId, reach, artOk };
}

/**
 * One catch, photographed at each moment. The page's clock is Playwright's (installed before the page
 * opened): it is paused for the catch and run on a frame (16 ms) at a time with the game playing at 1x,
 * so that each moment is taken on the first frame at or past its time on the tongue's own clock.
 */
async function oneCatch(s, prefix, cell, zoom) {
  const { page } = s;
  await page.click('#speed-box button[data-speed="0"]');
  await s.setCd(99);
  await page.evaluate(() => { const s = window.broodfall.sim; s.enemies.length = 0; });
  await page.addStyleTag({ content: '#banner { display: none !important; }' });
  const [victim] = await s.put([{ kind: 'soldier', cell, hp: 12 }]);
  const tp = await s.posOf(s.mawId);
  const ep = await s.posOf(victim);
  // Close on the mouth, with a little of the street the tongue reaches into.
  await s.closeOn({ x: tp.x + (ep.x - tp.x) * 0.3, y: tp.y + (ep.y - tp.y) * 0.3 }, zoom, 50);
  await page.waitForTimeout(600);
  const hold = () => page.evaluate(() => {
    const s = window.broodfall.sim;
    for (const e of s.enemies) { e.speed = 0; e.slowMult = 0; e.slowUntil = s.time + 9999; e.attackCooldown = 99; }
  });
  await hold();
  await page.click('#speed-box button[data-speed="1"]');
  await page.waitForTimeout(400);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
  const frame = async () => { await page.clock.runFor(16); };
  await s.setCd(0.12);
  let struck = false;
  for (let i = 0; i < 120 && !struck; i++) { await frame(); struck = (await s.tongue()) !== null; }
  check(struck, `${prefix}: the Maw strikes`);
  const out = [];
  const states = {};
  const wants = {
    launch: (l) => l.t >= 0.05,
    out: (l) => l.t >= 0.11,
    stuck: (l) => l.t >= 0.24,
    lips: (l) => l.t >= 0.56,
    teeth: (l) => l.t >= 0.7,
    gulp: (l) => l.t >= 0.84,
  };
  for (const m of MOMENTS) {
    for (let i = 0; i < 200; i++) {
      const l = await s.tongue();
      if (!l || wants[m.n](l)) break;
      await frame();
      await hold();
    }
    states[m.n] = await s.tongue();
    const name = `${prefix}-${m.n}`;
    out.push({ png: await s.shot(name), label: `${m.label}${states[m.n] ? ` t=${states[m.n].t.toFixed(2)}` : ''}` });
  }
  console.log(`  ${prefix}: ${MOMENTS.map((m) => `${m.n} ${states[m.n] ? `t=${states[m.n].t.toFixed(2)}${states[m.n].inMouth ? ' (in mouth)' : ''}${states[m.n].open ? ' open' : ' shut'}${states[m.n].riding ? ' riding' : ''}` : 'gone'}`).join(', ')}`);
  for (let i = 0; i < 40; i++) await frame();
  await page.clock.resume();
  await page.click('#speed-box button[data-speed="0"]');
  return { out, states };
}

function strip(pngs, file, crop = 'crop=iw*0.56:ih*0.62:iw*0.22:ih*0.14,scale=480:-2') {
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  for (const p of pngs) args.push('-i', p.png);
  const f = pngs.map((p, i) => `[${i}:v]${crop},drawtext=text='${p.label}':x=10:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:${FONT}[v${i}]`).join(';');
  args.push('-filter_complex', `${f};${pngs.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${pngs.length}`, '-q:v', '3', file);
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  check(r.status === 0, `strip ${file}`, r.stderr?.slice(0, 200));
}

try {
  {
    const s = await session(false);
    const { page } = s;
    const st = await s.reach();
    const { out, states } = await oneCatch(s, `maw-mouth-${TAG}`, st.cells[0], 13);
    if (TAG === 'after') {
      check(states.launch?.inMouth === true, 'launch: the tip is still in the mouth (it leaves from the throat)', JSON.stringify(states.launch));
      check(states.launch?.throat != null, 'launch: the tongue grows from the throat');
      check(states.teeth?.riding === true && states.teeth?.inMouth === true, 'the body is taken in behind the teeth before the gulp', JSON.stringify(states.teeth));
    }
    strip(out, join(screens, `maw-mouth-${TAG}-strip.jpg`));
    console.log(`  strip ${join(screens, `maw-mouth-${TAG}-strip.jpg`)}`);
    if (TAG === 'after') {
      // ---- The camera's four turns: the street it eats from in front of it, beside it, behind it.
      const turns = [];
      for (let k = 0; k < 4; k++) {
        await page.keyboard.press('e');
        await page.waitForTimeout(900);
        const r = await s.reach();
        const { out: o } = await oneCatch(s, `maw-mouth-turn${k + 1}`, r.cells[0], 11);
        turns.push({ ...o[1], label: `TURN ${k + 1} OUT` }, { ...o[3], label: `TURN ${k + 1} AT THE LIPS` });
      }
      // Two rows of four: each turn's tongue out and its reel at the lips.
      const a = join(shots, 'maw-mouth-turns-a.jpg'), b = join(shots, 'maw-mouth-turns-b.jpg');
      strip(turns.slice(0, 4), a, 'crop=iw*0.6:ih*0.66:iw*0.2:ih*0.12,scale=480:-2');
      strip(turns.slice(4), b, 'crop=iw*0.6:ih*0.66:iw*0.2:ih*0.12,scale=480:-2');
      const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', a, '-i', b, '-filter_complex', 'vstack=inputs=2', '-q:v', '3', join(screens, 'maw-mouth-turns.jpg')], { encoding: 'utf8' });
      check(r.status === 0, 'the four turns are joined', r.stderr?.slice(0, 200));
      console.log(`  turns ${join(screens, 'maw-mouth-turns.jpg')}`);
    }
    check(s.errors.length === 0, 'no page errors', s.errors.slice(0, 3).join(' | '));
    await s.context.close();
  }

  // ---- The film: about eight seconds, close on the mouth, the game PLAYING at 1x, bodies caught one after another.
  if (VIDEO) {
    const s = await session(true);
    const { page } = s;
    const st = await s.reach();
    // Prey only in front of it (its mouth is seen; it turns to face what it eats).
    const cells = st.cells.slice(0, 1);
    const tp = await s.posOf(s.mawId);
    const ep = await page.evaluate((c) => window.broodfall.sim.cellCenter(c), cells[0]);
    await page.addStyleTag({ content: '#banner { display: none !important; }' });
    await s.closeOn({ x: tp.x + (ep.x - tp.x) * 0.35, y: tp.y + (ep.y - tp.y) * 0.35 }, 14, 50);
    const hold = () => page.evaluate(() => {
      const s = window.broodfall.sim;
      for (const e of s.enemies) { if (!e.staged) { e.speed = 0; e.slowMult = 0; e.slowUntil = s.time + 9999; } e.attackCooldown = 99; }
    });
    await s.put(Array.from({ length: 6 }, (_, i) => ({ kind: i % 3 === 2 ? 'militia' : 'soldier', cell: cells[i % cells.length], hp: 10 + (i % 3) * 4, dx: (i % 3) * 4 - 4, dy: (i % 2) * 5 - 2 })));
    await hold();
    await page.click('#speed-box button[data-speed="1"]');
    const t0 = Date.now();
    const catches = [];
    let lastRiding = false;
    while (Date.now() - t0 < 10500) {
      await hold();
      const riding = await page.evaluate(() => window.broodfall.tongues().some((l) => l.riding));
      if (riding && !lastRiding) catches.push(Date.now());
      lastRiding = riding;
      if ((await page.evaluate(() => window.broodfall.sim.enemies.filter((e) => e.staged).length)) < 3) await s.put([{ kind: 'soldier', cell: cells[0], hp: 12 }, { kind: 'militia', cell: cells[1 % cells.length], hp: 10 }]);
      await page.waitForTimeout(60);
    }
    const tEnd = Date.now();
    check(catches.filter((c) => c > tEnd - 8000).length >= 3, 'the film shows bodies caught and carried into the mouth', `${catches.filter((c) => c > tEnd - 8000).length} in its last eight seconds`);
    await s.artOk('film');
    check(s.errors.length === 0, 'no page errors in the film', s.errors.slice(0, 3).join(' | '));
    const vid = page.video();
    await s.context.close();
    const webm = await vid.path();
    const mp4 = join(screens, 'maw-mouth.mp4');
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-8.3', '-i', webm, '-t', '8', '-vf', 'crop=640:480:320:80,scale=1280:960', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', mp4]);
    check(r.status === 0 && existsSync(mp4), 'the film is recorded', mp4);
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
