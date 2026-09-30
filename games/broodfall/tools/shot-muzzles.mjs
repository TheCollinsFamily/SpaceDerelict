/**
 * WHERE THE SHOTS LEAVE FROM, photographed close in the real page (Sep 30 2026, Collins: "I noticed
 * there was an issue with the shots aligning with coming from where the art would indicate").
 * Every limb that throws, beams or lobs something is built beside a street with a target in reach,
 * the view is brought close on it, and the game is run a tick at a time until its shot is out: the
 * picture is taken the moment the shot has left. Then a limb on a plinth, limbs seen from behind
 * (the camera turned), and the hive's cannon, dart battery and mortar firing at a limb.
 *
 * Builds its OWN copy of the game (dist-muzzles/) and serves it on its own port (5287), so it never
 * disturbs a beat another session runs, and a file another session saves does not reload the page.
 *
 * Usage: node tools/shot-muzzles.mjs [scene ...] [--tag before|after] [--sheet] [--video]
 *   scenes: the family names below, plinth, behind-<family>, cannon, dartgun, mortar (default: all)
 *   --tag     names the pictures fire-<scene>-<tag>.jpg (default: after)
 *   --sheet   only compose fire-00-muzzles-BEFORE-AFTER.jpg from the pictures already taken
 *   --video   only record fire-siege.mp4: a siege at close zoom, about ten seconds
 * Pictures: tools/screenshots/fire-*.png; JPEG copies in notes/screens/2026-09-30/.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
mkdirSync(screens, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5287);
const DIST = 'dist-muzzles';
const argv = process.argv.slice(2);
const valueOf = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
const TAG = valueOf('--tag') ?? 'after';
const SHEET = argv.includes('--sheet');
const VIDEO = argv.includes('--video');
const want = new Set(argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--tag'));
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const jpg = (png, name) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, name)]);

/**
 * The scenes: a family, what it is seen doing, what to wait for (a count from window.broodfall.fx()),
 * and how it is set off. `air`: its target flies. `order`: the player aims it (a command).
 */
const LIMB_SCENES = [
  { id: 'spitter', wait: 'shots' },
  { id: 'quill', wait: 'shots' },
  { id: 'impaler', wait: 'shots' },
  { id: 'frond', wait: 'streaks' },
  { id: 'prism', wait: 'streaks' },
  { id: 'ocular', wait: 'streaks', unit: 'drummer' },
  { id: 'ember', wait: 'streaks' },
  { id: 'skipper', wait: 'shells' },
  { id: 'bombard', wait: 'shells', order: 'marker' },
  { id: 'lobber', wait: 'shells', order: 'bile-throw' },
  { id: 'sling', wait: 'shells', order: 'sling-throw' },
  { id: 'burster', wait: 'shots' },
  { id: 'tangler', wait: 'shots' },
  { id: 'blighter', wait: 'shots' },
  { id: 'mister', wait: 'shots' },
  { id: 'net', wait: 'shots', air: true },
  { id: 'sprout', wait: 'shots' },
];
const BEHIND = ['spitter', 'quill', 'impaler', 'ember', 'skipper', 'lobber', 'ocular'];
const SCENES = [
  ...LIMB_SCENES.map((s) => s.id),
  'plinth',
  ...BEHIND.map((f) => `behind-${f}`),
  'cannon', 'dartgun', 'mortar',
];
/** Scenes with no before: what is done to units, and donor parts on limbs, taken again clean. */
const EXTRA = ['status', 'donor'];
const scene = (id) => (want.size === 0 && !EXTRA.includes(id)) || want.has(id);

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

/** The contact sheet: every scene, before and after side by side, the middle of each picture. */
async function sheet(browser) {
  const rows = SCENES.filter((id) => existsSync(join(shots, `fire-${id}-before.png`)) && existsSync(join(shots, `fire-${id}-after.png`)));
  const cell = (id, tag) => `<div class="c"><img src="${pathToFileURL(join(shots, `fire-${id}-${tag}.png`)).href}"><b>${tag.toUpperCase()}</b></div>`;
  const html = `<!doctype html><html><head><style>
    body { margin: 0; background: #151311; font: 600 22px system-ui, sans-serif; color: #eee; }
    h1 { font-size: 30px; margin: 18px 24px 4px; } p { margin: 0 24px 14px; color: #bbb; font-weight: 400; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 20px; padding: 0 24px 24px; }
    .row { display: contents; } .name { grid-column: 1 / -1; margin-top: 10px; font-size: 24px; color: #f2c069; }
    .c { position: relative; height: 380px; overflow: hidden; border-radius: 6px; }
    .c img { position: absolute; width: 1600px; left: -400px; top: -330px; }
    .c b { position: absolute; left: 10px; top: 8px; background: #000a; padding: 2px 10px; border-radius: 4px; }
  </style></head><body><h1>Broodfall: where the shots leave from (Sep 30 2026)</h1>
  <p>Left: before (every shot left a fixed height over the limb's ground). Right: after (from the mouth, spines, crystal, eye, nozzle, barrel marked on each limb's art).</p>
  <div class="grid">${rows.map((id) => `<div class="row"><div class="name">${id}</div>${cell(id, 'before')}${cell(id, 'after')}</div>`).join('')}</div></body></html>`;
  const page = await browser.newPage({ viewport: { width: 1640, height: 1000 } });
  await page.setContent(html);
  await page.waitForTimeout(800);
  const png = join(shots, 'fire-00-muzzles-BEFORE-AFTER.png');
  await page.screenshot({ path: png, fullPage: true });
  jpg(png, 'fire-00-muzzles-BEFORE-AFTER.jpg');
  console.log(`  sheet ${join(screens, 'fire-00-muzzles-BEFORE-AFTER.jpg')} (${rows.length} scenes)`);
  await page.close();
}

if (SHEET) {
  const browser = await chromium.launch();
  try { await sheet(browser); } finally { await browser.close(); }
  process.exit(0);
}

const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
console.log(`  built ${join(root, DIST)}`);
let server = await startServer();
let serverDown = false;
const watch = () => server.on('exit', () => { serverDown = true; });
watch();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const videoDir = join(shots, 'fire-video');
try {
  if (VIDEO) rmSync(videoDir, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(VIDEO ? { recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } } } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (!VIDEO) await page.setViewportSize({ width: 1600, height: 1000 });
  const canvas = page.locator('#stage canvas');
  const shot = async (name) => {
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(200);
    // Every picture drawn from its art: nothing missing, no notice over the board (placeholder dots are a failure).
    const missing = await page.evaluate(() => window.broodfall.artMissing());
    const notice = await page.evaluate(() => { const el = document.getElementById('art-notice'); return !!el && !el.classList.contains('hidden') ? el.textContent : ''; });
    check(missing.length === 0 && !notice, `${name}: all its art loaded, no notice`, [...missing, notice].filter(Boolean).join(' | ').slice(0, 200));
    await canvas.screenshot({ path: png });
    jpg(png, `${name}.jpg`);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
  };
  const ticks = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(30); } };
  const fresh = async (seed = 11) => {
    if (serverDown) { serverDown = false; server = await startServer(); watch(); }
    await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0&biome=suburb${TAG === 'before' ? '&muzzles=off' : ''}`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 40000 });
    await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 50; s.enemies.length = 0; s.projectiles.length = 0; s.shells.length = 0; s.arcs.length = 0; });
    await page.waitForTimeout(300);
  };
  const streets = () => page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const out = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === 1 && d(c) >= 5 && d(c) <= 11) out.push(c);
    return out.sort((a, b) => d(a) - d(b));
  });
  const build = (family, near) => page.evaluate(([family, near]) => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const at = (c) => [c % W, Math.floor(c / W)];
    const d = (c) => Math.hypot(at(c)[0] - at(near)[0], at(c)[1] - at(near)[1]);
    const cells = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family)) cells.push(c);
    cells.sort((a, b) => d(a) - d(b));
    const cell = cells.find((c) => s.groundFor(c, family, 'S'));
    if (cell === undefined) return -1;
    s.hand[0] = { id: 870000 + Math.floor(Math.random() * 9999), family, free: true };
    const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' });
    return r.ok ? s.towers[s.towers.length - 1].id : -1;
  }, [family, near]);
  /** Units in a street; tough, seen, and (for a gun) dug in. */
  const put = (list) => page.evaluate((items) => {
    const s = window.broodfall.sim;
    return items.map(({ kind, cell, dx = 0, dy = 0, deployed }) => {
      const e = s.spawnEnemy(kind, s.gates[0]);
      const c = s.cellCenter(cell);
      e.pos.x = c.x + dx; e.pos.y = c.y + dy;
      e.revealedUntil = s.time + 999;
      e.hp *= 40; e.maxHp *= 40;
      e.speed = 0;
      if (deployed) e.deployed = true;
      return e.id;
    });
  }, list);
  const posOf = (id) => page.evaluate((id) => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.id === id) ?? s.enemies.find((x) => x.id === id);
    return t ? { x: t.pos.x, y: t.pos.y } : null;
  }, id);
  /** The street cell nearest a limb that it can reach, from the list. */
  const streetNear = (id, st) => page.evaluate(([id, st]) => {
    const s = window.broodfall.sim;
    const t = s.towers.find((x) => x.id === id);
    const W = s.cfg.gridW;
    const d = (c) => { const p = s.cellCenter(c); return Math.hypot(p.x - t.pos.x, p.y - t.pos.y); };
    const own = s.cellsOf(t);
    // Two to four cells down the street, inside its reach: the whole flight of the shot is seen.
    const reach = (s.statsOf ? s.statsOf(t).range : 120) * 0.85;
    const want = Math.min(reach, s.cfg.cellPx * 3);
    const ok = st.filter((c) => d(c) >= Math.min(reach, s.cfg.cellPx * 2) && d(c) <= reach && !own.includes(c));
    return (ok.length ? ok : st).sort((a, b) => Math.abs(d(a) - want) - Math.abs(d(b) - want))[0];
  }, [id, st]);
  const closeOn = async (p, zoom = 11, up = 0) => {
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
  /** Tick until the effect is out (a count in window.broodfall.fx() grows past what it was). */
  const fireAndCatch = async (kind, n = 120, arm = null) => {
    // What is already in the air is let go first, so that the picture is of a shot just out.
    for (let i = 0; i < 40 && (await page.evaluate((k) => window.broodfall.fx()[k] ?? 0, kind)) > 0; i++) await ticks(1);
    const base = await page.evaluate((k) => window.broodfall.fx()[k] ?? 0, kind);
    if (arm) await arm();
    for (let i = 0; i < n; i++) {
      await ticks(1);
      const now = await page.evaluate((k) => window.broodfall.fx()[k] ?? 0, kind);
      if (now > base) return true;
    }
    return false;
  };
  /** The middle of a limb and its target, a little toward the limb, and above the ground by `lift` cells. */
  const between = (a, b2, share = 0.3) => ({ x: a.x + (b2.x - a.x) * share, y: a.y + (b2.y - a.y) * share });

  if (VIDEO) {
    // A siege at close zoom: a spitter, a quill fan, a frond, a prism and an ember sac against a column.
    await fresh(21);
    const st = await streets();
    const ids = [];
    for (const f of ['spitter', 'quill', 'impaler', 'prism', 'ember', 'frond']) ids.push(await build(f, st[1]));
    await put(Array.from({ length: 12 }, (_, i) => ({ kind: i % 3 ? 'soldier' : 'militia', cell: st[i % 4], dx: (i % 3) * 5 - 5, dy: (i % 2) * 6 - 3 })));
    const ps = (await Promise.all(ids.filter((x) => x >= 0).map(posOf))).filter(Boolean);
    const mid = { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
    await closeOn(mid, 8, 40);
    // Played at its own pace: ten seconds of siege (the sim runs at speed 1).
    await page.evaluate(() => { for (let i = 0; i < 100; i++) window.broodfall.step(1); });
    const t0 = Date.now();
    while (Date.now() - t0 < 11000) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(95); }
    const vid = page.video();
    await context.close();
    const webm = await vid.path();
    const mp4 = join(screens, 'fire-siege.mp4');
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '1.5', '-i', webm, '-t', '10.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', mp4]);
    check(r.status === 0 && existsSync(mp4), 'the siege is recorded', mp4);
  } else {
    for (const sc of LIMB_SCENES) {
      if (!scene(sc.id)) continue;
      await fresh(11);
      const st = await streets();
      const id = await build(sc.id, st[2]);
      if (id < 0) { check(false, `${sc.id}: built`); continue; }
      const street = await streetNear(id, st);
      const tp = await posOf(id);
      const target = await put([{ kind: sc.unit ?? (sc.air ? 'flier' : 'soldier'), cell: street }]);
      const ep = await posOf(target[0]);
      await closeOn(between(tp, ep, 0.45), sc.id === 'mister' || sc.id === 'frond' ? 7 : 8, 50);
      const ok = await fireAndCatch(sc.wait, 120, () => page.evaluate(([id, cell, order]) => {
        const s = window.broodfall.sim;
        const t = s.towers.find((x) => x.id === id);
        t.cooldown = 0;
        if (order === 'marker') t.marker = cell;
        else if (order) s.issue({ kind: order, towerId: id, cell });
      }, [id, street, sc.order ?? null]));
      check(ok, `${sc.id}: its shot is out`, JSON.stringify(await page.evaluate(() => window.broodfall.fx())));
      await shot(`fire-${sc.id}-${TAG}`);
    }

    if (scene('plinth')) {
      await fresh(11);
      const st = await streets();
      const id = await build('spitter', st[2]);
      await page.evaluate((id) => {
        const s = window.broodfall.sim;
        const t = s.towers.find((x) => x.id === id);
        s.plinths = 2;
        s.issue({ kind: 'place-plinth', cell: t.cell });
        s.issue({ kind: 'place-plinth', cell: t.cell });
      }, id);
      await ticks(30);
      const street = await streetNear(id, st);
      const tp = await posOf(id);
      const target = await put([{ kind: 'soldier', cell: street }]);
      const ep = await posOf(target[0]);
      await closeOn(between(tp, ep, 0.45), 8, 90);
      const ok = await fireAndCatch('shots');
      check(ok, 'plinth: the raised spitter fires');
      await shot(`fire-plinth-${TAG}`);
    }

    for (const fam of BEHIND) {
      if (!scene(`behind-${fam}`)) continue;
      const sc = LIMB_SCENES.find((x) => x.id === fam);
      await fresh(11);
      const st = await streets();
      const id = await build(fam, st[2]);
      const street = await streetNear(id, st);
      const target = await put(Array.from({ length: 5 }, (_, i) => ({ kind: sc.unit ?? 'soldier', cell: street, dx: i * 2 - 4 })));
      // Let it take aim, then turn the camera until it is seen from behind.
      await ticks(3);
      let back = false;
      for (let k = 0; k < 4 && !back; k++) {
        back = await page.evaluate((id) => !!window.broodfall.renderer.limbs.get(id)?.back, id);
        if (!back) { await page.evaluate(() => window.broodfall.turnBy(1)); await ticks(1); }
      }
      check(back, `behind-${fam}: seen from behind`);
      const tp = await posOf(id);
      const ep = await posOf(target[0]);
      await closeOn(between(tp, ep, 0.45), 8, 60);
      const ok = await fireAndCatch(sc.wait, 120, () => page.evaluate(([id, cell, order]) => {
        const s = window.broodfall.sim;
        const t = s.towers.find((x) => x.id === id);
        t.cooldown = 0;
        if (order) s.issue({ kind: order, towerId: id, cell });
      }, [id, street, sc.order ?? null]));
      check(ok, `behind-${fam}: its shot is out`, JSON.stringify(await page.evaluate((id) => { const s = window.broodfall.sim; const t = s.towers.find((x) => x.id === id); return { fx: window.broodfall.fx(), cd: t?.cooldown, last: t?.lastTargetId, en: s.enemies.map((e) => [e.kind, Math.round(e.hp), Math.round(Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y))]), phase: s.phase, outcome: s.outcome }; }, id)));
      await shot(`fire-behind-${fam}-${TAG}`);
    }

    for (const kind of ['cannon', 'dartgun', 'mortar']) {
      if (!scene(kind)) continue;
      await fresh(14);
      const st = await streets();
      const id = await build('maw', st[2]);
      await page.evaluate((id) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); t.hp *= 50; t.maxHp *= 50; t.cooldown = 999; }, id);
      const tp = await posOf(id);
      // A street two or three cells off: in the gun's reach, out of the maw's.
      const cell = await page.evaluate(([id, st]) => {
        const s = window.broodfall.sim;
        const t = s.towers.find((x) => x.id === id);
        const d = (c) => { const p = s.cellCenter(c); return Math.hypot(p.x - t.pos.x, p.y - t.pos.y) / s.cfg.cellPx; };
        return st.filter((c) => d(c) >= 2.5).sort((a, b) => d(a) - d(b))[0];
      }, [id, st]);
      const u = await put([{ kind, cell, deployed: kind !== 'mortar' }]);
      const up = await posOf(u[0]);
      await closeOn(between(up, tp, 0.2), 11, 30);
      const wait = kind === 'mortar' ? 'bombs' : 'shells';
      const ok = await fireAndCatch(wait, 150);
      check(ok, `${kind}: its shell is out`);
      await shot(`fire-${kind}-${TAG}`);
    }
    if (scene('status')) {
      // Webbed, poisoned and burning units, and caltrops, side by side (as tools/shot-fx.mjs 'clouds', clean).
      await fresh(15);
      const st = await streets();
      const col = await put(Array.from({ length: 6 }, (_, i) => ({ kind: i % 2 ? 'soldier' : 'militia', cell: st[i % 2], dx: (i % 3) * 7 - 7, dy: (i % 2) * 6 - 3 })));
      await page.evaluate((ids) => {
        const s = window.broodfall.sim;
        s.enemies.filter((e) => ids.includes(e.id)).forEach((e, i) => {
          if (i % 3 === 0) { e.slowUntil = s.time + 99; e.slowMult = 0.5; }
          if (i % 3 === 1) { e.poisonUntil = s.time + 99; e.poisonDps = 0.01; }
          if (i % 3 === 2) { e.burnUntil = s.time + 99; e.burnDps = 0.01; }
        });
        s.clouds.push({ id: 990001, pos: { ...s.enemies.find((e) => e.id === ids[1]).pos }, radius: 26, ttl: 99, dps: 0 });
        s.caltrops.push({ id: 990002, pos: { ...s.enemies.find((e) => e.id === ids[3]).pos }, cell: 0, hp: 40, thorns: 0, ttl: 99 });
      }, col);
      const ps = await Promise.all(col.slice(0, 4).map(posOf));
      await closeOn({ x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length }, 10, 20);
      await ticks(4);
      await shot('fire-status-web-poison-burn');
      await closeOn(ps[0], 13, 15);
      await shot('fire-status-close');
    }

    if (scene('donor')) {
      await fresh(19);
      const st = await streets();
      const ids = [];
      const pips = { spitter: [{ family: 'burster' }, { family: 'quill' }], maw: [{ family: 'lasher' }, { family: 'blighter' }, { family: 'ocular' }], impaler: [{ family: 'brood' }], twin: [{ family: 'ember' }, { family: 'spine' }] };
      for (const f of Object.keys(pips)) {
        const id = await build(f, st[ids.length]);
        await page.evaluate(([id, p]) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); if (t) t.pips = p; }, [id, pips[f]]);
        ids.push(id);
      }
      const ps = (await Promise.all(ids.filter((x) => x >= 0).map(posOf))).filter(Boolean);
      await closeOn({ x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length }, 8, 40);
      await ticks(2);
      const parts = await page.evaluate(() => window.broodfall.graftsDrawn());
      check(parts >= 6, 'donor parts are drawn on the limbs that carry them', `${parts} parts`);
      await shot('fire-donor-parts');
    }

    const mine = errors.filter((e) => !/could not load: (units|board)\//.test(e));
    check(mine.length === 0, 'nothing is logged as an error', mine.slice(0, 3).join(' | '));
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nMUZZLE BEAT: ${failures.length} failure(s): ${failures.join('; ')}` : '\nMUZZLE BEAT: all verified.');
process.exit(failures.length ? 1 : 0);
