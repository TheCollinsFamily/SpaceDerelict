/**
 * UPGRADE LOOKS, photographed in the real page (Sep 30 2026, DESIGN.md "Upgrade looks", notes/UPGRADE-LOOKS.md).
 * For each prototype limb (spitter, lasher, frond) six of it are grown side by side on the board: one in its
 * own look, one of each class (bone, swarm, venom, reach) and its superstructure, each EARNED by evolutions and
 * pips set on it (content/upgradeLooks.ts; the renderer picks the variant). Then: the board at the game's
 * normal zoom, close, each limb close (for the sheet), the camera turned (1 to 3), the limbs turned away (their
 * views from behind, or mirrored), and one limb caught growing into a new look.
 *
 * Builds its OWN copy of the game (dist-looks/) and serves it on its own port (5293). Fails when any art is
 * missing (artMissing), a notice shows over the board, or a limb is not drawn in the look it earned.
 *
 * Usage: node tools/shot-upgrade-looks.mjs [spitter lasher frond] [--sheet]
 * Pictures: notes/screens/2026-09-30/upgrade-looks-*.jpg, the sheet upgrade-looks-00-sheet.jpg.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5293);
const DIST = 'dist-looks';
const argv = process.argv.slice(2);
const SHEET = argv.includes('--sheet');
const want = argv.filter((a) => !a.startsWith('--'));
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const jpg = (png, name, q = 3) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', String(q), join(screens, name)]);

/** Six of each limb, each earning one look: [label, the look it must be drawn in, evolutions, donor pips]. */
const SCENES = {
  spitter: [
    ['own look', null, [], []],
    ['BONE (Heavy Gobs)', 'bone', ['B'], []],
    ['SWARM (Rapid Glands)', 'swarm', ['A'], []],
    ['VENOM (ate an ember sac and a blight vent)', 'venom', [], ['ember', 'blighter']],
    ['REACH (Heavy Gobs, Sticky Spit)', 'reach', ['B', 'B'], []],
    ['SPORE HIVE (Rapid, Acid, Hydra + an ember sac)', 'swarm+venom', ['A', 'A', 'A'], ['ember']],
  ],
  lasher: [
    ['own look', null, [], []],
    ['BONE (Barbed Whips)', 'bone', ['B'], []],
    ['SWARM (Long Whips, Thrashing)', 'swarm', ['A', 'B'], []],
    ['VENOM (Long Whips, Rending)', 'venom', ['A', 'A'], []],
    ['REACH (Long Whips)', 'reach', ['A'], []],
    ['PLAGUE BASTION (Barbed, Rending, Gorger + an ember sac)', 'bone+venom', ['B', 'A', 'B'], ['ember']],
  ],
  frond: [
    ['own look', null, [], []],
    ['BONE (Hot Arc)', 'bone', ['B'], []],
    ['SWARM (Long Arc)', 'swarm', ['A'], []],
    ['VENOM (Hot Arc, Searing Arc)', 'venom', ['B', 'B'], []],
    ['REACH (Long Arc, Stun Arc)', 'reach', ['A', 'A'], []],
    ['STORM CROWN (Long, Stun, Storm Frond + a netcaster)', 'swarm+reach', ['A', 'A', 'A'], ['net']],
  ],
};
const FAMILIES = want.length ? want : Object.keys(SCENES);

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

/** The sheet: a row per limb, its six looks close, labelled (python + PIL, from the close crops). */
function sheet() {
  const rows = FAMILIES.filter((f) => existsSync(join(shots, `looks-${f}-crops.json`)));
  const spec = rows.map((f) => ({ family: f, crops: JSON.parse(readFileSync(join(shots, `looks-${f}-crops.json`), 'utf8')) }));
  const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
spec = json.loads(sys.argv[1]); out = sys.argv[2]
T = 300; L = 44; H = 60
cols = max(len(r['crops']) for r in spec)
img = Image.new('RGB', (cols * T, H + len(spec) * (T + L)), (21, 19, 17))
d = ImageDraw.Draw(img)
try:
  big = ImageFont.truetype('arialbd.ttf', 28); small = ImageFont.truetype('arial.ttf', 15); name = ImageFont.truetype('arialbd.ttf', 20)
except Exception:
  big = small = name = ImageFont.load_default()
d.text((14, 14), 'Broodfall: upgrade looks, seen in the game (base, the four classes, a superstructure)', fill=(242, 192, 105), font=big)
for ri, r in enumerate(spec):
  y = H + ri * (T + L)
  for ci, c in enumerate(r['crops']):
    im = Image.open(c['file']).convert('RGB').resize((T, T))
    img.paste(im, (ci * T, y + L))
    d.text((ci * T + 8, y + 4), r['family'].upper() if ci == 0 else '', fill=(242, 192, 105), font=name)
    d.text((ci * T + 8, y + (26 if ci == 0 else 14)), c['label'][:40], fill=(235, 235, 235), font=small)
img.save(out, quality=88)
`;
  const png = join(shots, 'upgrade-looks-00-sheet.jpg');
  const r = spawnSync('python', ['-c', py, JSON.stringify(spec), png], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); check(false, 'the sheet is composed'); return; }
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '2', join(screens, 'upgrade-looks-00-sheet.jpg')]);
  console.log(`  sheet ${join(screens, 'upgrade-looks-00-sheet.jpg')}`);
}

if (SHEET) { sheet(); process.exit(failures.length ? 1 : 0); }

const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
console.log(`  built ${join(root, DIST)}`);
const server = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const canvas = page.locator('#stage canvas');
  const ticks = async (n, wait = 30) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.broodfall.step(1)); await page.waitForTimeout(wait); } };
  const artOk = async (name) => {
    const missing = await page.evaluate(() => window.broodfall.artMissing());
    const notice = await page.evaluate(() => { const el = document.getElementById('art-notice'); return !!el && !el.classList.contains('hidden') ? el.textContent : ''; });
    check(missing.length === 0 && !notice, `${name}: all its art loaded, no notice`, [...missing, notice].filter(Boolean).join(' | ').slice(0, 200));
  };
  const shot = async (name, file = true) => {
    const png = join(shots, `${name}.png`);
    await page.waitForTimeout(250);
    await artOk(name);
    await canvas.screenshot({ path: png });
    if (file) { jpg(png, `${name}.jpg`); console.log(`  shot  ${join(screens, `${name}.jpg`)}`); }
    return png;
  };
  const home = async () => { await page.keyboard.press('Home'); await page.waitForTimeout(300); };
  const closeOn = async (p, zoom = 8, up = 0) => {
    await home();
    const where = () => page.evaluate(([p, up]) => { const s = window.broodfall.worldToScreen(p.x, p.y); return { ...s, y: s.y - up }; }, [p, up]);
    const bb = await canvas.boundingBox();
    const onPage = (at) => ({ x: bb.x + (at.x / at.vw) * bb.width, y: bb.y + (at.y / at.vh) * bb.height });
    let q = onPage(await where());
    await page.mouse.move(q.x, q.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(400);
    for (let round = 0; round < 5; round++) {
      q = onPage(await where());
      if (Math.hypot(q.x - (bb.x + bb.width / 2), q.y - (bb.y + bb.height / 2)) < 10) break;
      await page.keyboard.down('Shift');
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(300);
    }
  };
  const looks = () => page.evaluate(() => window.broodfall.limbLooks());

  let n = 2;
  for (const family of FAMILIES) {
    const scene = SCENES[family];
    await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0&biome=suburb`);
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 40000 });
    await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 50; s.enemies.length = 0; s.projectiles.length = 0; s.shells.length = 0; s.arcs.length = 0; s.coreHp = 1e9; if (s.spawnQueue) s.spawnQueue.length = 0; });
    // Grown and given their evolutions and donor pips in the same moment: each is drawn first in the look it earned.
    const ids = await page.evaluate(([family, scene]) => {
      const s = window.broodfall.sim;
      const W = s.cfg.gridW;
      const at = (c) => [c % W, Math.floor(c / W)];
      const d = (c) => Math.hypot(at(c)[0] - at(s.map.coreCell)[0], at(c)[1] - at(s.map.coreCell)[1]);
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, family)) cells.push(c);
      cells.sort((a, b) => d(a) - d(b));
      const taken = [];
      const apart = (c) => taken.every((t) => Math.max(Math.abs(at(t)[0] - at(c)[0]), Math.abs(at(t)[1] - at(c)[1])) >= 2);
      return scene.map(([, , upgrades, pips], i) => {
        const cell = cells.find((c) => { const g = s.groundFor(c, family, 'S'); return g && g.every(apart); });
        if (cell === undefined) return -1;
        const ground = s.groundFor(cell, family, 'S');
        s.hand[0] = { id: 880000 + i, family, free: true };
        const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing: 'S' });
        if (!r.ok) return -1;
        taken.push(...ground);
        const t = s.towers[s.towers.length - 1];
        t.upgrades = upgrades.slice();
        t.pips = pips.map((f) => ({ family: f }));
        t.cooldown = 1e6;
        return t.id;
      });
    }, [family, scene]);
    check(ids.every((x) => x >= 0), `${family}: six are grown`, ids.join(','));
    await ticks(3, 60);
    const got = await looks();
    scene.forEach(([label, key], i) => {
      const l = got.find((x) => x.id === ids[i]);
      check(!!l && l.earned === key && l.drawn === key, `${family} ${label}: earned and drawn ${key ?? 'its own look'}`, l ? `earned ${l.earned}, drawn ${l.drawn}` : 'not drawn');
    });
    const pos = await page.evaluate((ids) => ids.map((id) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); return t ? { x: t.pos.x, y: t.pos.y } : null; }), ids);
    const mid = { x: pos.reduce((a, p) => a + p.x, 0) / pos.length, y: pos.reduce((a, p) => a + p.y, 0) / pos.length };
    const tag = String(n).padStart(2, '0');
    // The board at the game's own zoom (Home), then close on all six.
    await home();
    await shot(`upgrade-looks-${tag}-${family}-normal-zoom`);
    await closeOn(mid, 5, 20);
    await shot(`upgrade-looks-${tag}-${family}-close`);
    // Each close, for the sheet.
    const crops = [];
    for (let i = 0; i < ids.length; i++) {
      await closeOn(pos[i], family === 'frond' ? 10 : 11, family === 'frond' ? 70 : 45);
      const png = await shot(`looks-${family}-${i}`, false);
      const cut = join(shots, `looks-${family}-${i}-crop.png`);
      spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-vf', 'crop=ih*0.8:ih*0.8:(iw-ih*0.8)/2:ih*0.08', cut]);
      crops.push({ file: cut, label: scene[i][0] });
    }
    writeFileSync(join(shots, `looks-${family}-crops.json`), JSON.stringify(crops));
    // The camera turned: every look at every turn (the view from behind, or mirrored).
    for (const turn of [1, 2, 3]) {
      await page.evaluate(() => window.broodfall.turnBy(1));
      await ticks(2, 60);
      await closeOn(mid, 5, 20);
      await shot(`upgrade-looks-${tag}-${family}-turn${turn}`);
    }
    await page.evaluate(() => window.broodfall.turnBy(1));
    // Turned away from the camera: its view from behind (a limb without one is mirrored).
    await page.evaluate((ids) => { for (const id of ids) { const t = window.broodfall.sim.towers.find((x) => x.id === id); if (t) t.facing = 'N'; } }, ids);
    await ticks(2, 60);
    const back = await looks();
    check(ids.every((id) => back.find((x) => x.id === id)?.drawn === scene[ids.indexOf(id)][1]), `${family}: turned away, still in the looks they earned`);
    await closeOn(mid, 5, 20);
    await shot(`upgrade-looks-${tag}-${family}-turned-away`);
    // Growing: its own look eats an ember sac and a blight vent, and grows into VENOM.
    await page.evaluate((id) => { const t = window.broodfall.sim.towers.find((x) => x.id === id); t.facing = undefined; t.pips = [{ family: 'ember' }, { family: 'blighter' }]; }, ids[0]);
    await closeOn(pos[0], family === 'frond' ? 10 : 11, family === 'frond' ? 70 : 45);
    await ticks(3, 40);
    const growing = (await looks()).find((x) => x.id === ids[0]);
    check(growing?.drawn === 'venom' && growing.growing, `${family}: grows into its new look`, JSON.stringify(growing));
    await shot(`upgrade-looks-${tag}-${family}-growing`);
    for (let i = 0; i < 30 && (await looks()).find((x) => x.id === ids[0])?.growing; i++) await ticks(1, 60);
    check(!(await looks()).find((x) => x.id === ids[0])?.growing, `${family}: settles in its new look`);
    await shot(`upgrade-looks-${tag}-${family}-grown`);
    n++;
  }
  sheet();
  const mine = errors.filter((e) => !/ERR_CONNECTION_REFUSED/.test(e));
  check(mine.length === 0, 'nothing is logged as an error', mine.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
