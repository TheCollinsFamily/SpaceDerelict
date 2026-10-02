/**
 * THE ROSTER, in the browser (Collins, Oct 2 2026: "an image of every unit type you have in the top left of your
 * screen, as well as an ALL UNITS button ... click one of these, then click a location, and all units of that type
 * (or all units) go there or fight the thing you clicked"). Real clicks on the roster and the board:
 *   1. a Pit, a Den and a Harrier Gland grown: the roster shows a portrait per kind with its count, and ALL.
 *   2. the WARRIORS portrait, then a far street: every warrior goes there (one click each).
 *   3. ALL, then a click on a soldier: a sortie; it dies; the spot goes quiet; they come home by themselves.
 *   4. an engineer sets out (AUTO off for the warriors, so the alert waits): the toast; SEND: they go.
 *   5. a hurt warrior off the creep walks back onto it to heal.
 * The whole beat is filmed (roster.mp4). The tunnel routing is checked in tests/groups.test.ts (the tunnel head
 * itself is the expansion fork's, not on main when this was made).
 *
 * Usage: node tools/shot-roster.mjs        (starts its own dev server on 5361)
 * Artifacts: notes/screens/2026-10-02/roster-*.png, roster.mp4
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
const vidDir = join(out, 'roster-video-tmp');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5361);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};
function freePort() {
  try {
    const lines = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' }).split('\n');
    for (const l of lines) {
      const m = /LISTENING\s+(\d+)/.exec(l);
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
/** Let the board run a while, drawn as it goes (the page is paused: speed=0). */
const play = async (seconds, quiet = false) => {
  for (let i = 0; i < seconds * 10; i += 2) {
    await page.evaluate((q) => { const b = window.broodfall; b.step(2); if (q) b.sim.enemies.length = 0; }, quiet);
    await page.waitForTimeout(25);
  }
};
const shot = async (name) => { await page.screenshot({ path: join(out, `roster-${name}.png`) }); console.log(`  shot  roster-${name}.png`); };
try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=suburb&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  const grown = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    b.step(2);
    const quiet = (n) => { for (let i = 0; i < n; i += 10) { b.step(10); s.enemies.length = 0; } };
    const grow = (family) => {
      s.meat.war = 9999; s.meat.science = 9999;
      for (let tries = 0; tries < 400; tries++) {
        s.hand[0] = { id: 990000 + tries, family, free: true };
        const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, family));
        if (cell >= 0 && b.play({ kind: 'build', cardIndex: 0, cell }).ok) return s.towers[s.towers.length - 1].id;
        quiet(20);
      }
      return null;
    };
    const pit = grow('hatch');
    const den = grow('brood');
    // A Harrier Gland in the organ stage, and its Harrier.
    let gland = false;
    for (let c = 0; c < s.under.cells.length && !gland; c++) for (let rot = 0; rot < 4 && !gland; rot++) {
      if (s.canBuildOrgan('harrier', c, rot)) gland = s.issue({ kind: 'build-organ', organ: 'harrier', cell: c, rot }).ok;
    }
    if (gland) for (let i = 0; i < 8; i++) s.growFieldUnits();
    quiet(700);
    return { pit, den, gland, warriors: s.broodlings.filter((x) => !x.puppet).length, mothers: s.mothers.length, harriers: s.harriers.length };
  });
  check(grown.pit !== null && grown.warriors >= 3, 'warriors from a Pit', JSON.stringify(grown));
  await page.evaluate(() => { const b = window.broodfall; b.renderer.resetView?.(); });
  await play(1.5, true);

  // 1. The roster.
  const roster = await page.evaluate(() => [...document.querySelectorAll('#unit-roster button[data-who]')].map((b) => ({ who: b.dataset.who, n: b.querySelector('.ur-n')?.textContent })));
  check(roster.some((r) => r.who === 'warrior') && roster.some((r) => r.who === 'all'), 'the roster shows WARRIORS and ALL', JSON.stringify(roster));
  check(!(await page.evaluate(() => document.getElementById('unit-roster').classList.contains('hidden'))), 'the roster is on screen');
  await shot('1-portraits');

  // 2. WARRIORS, then a far street.
  const far = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    const body = s.bodyPoint();
    let best = null;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== 1) continue;
      const p = s.cellCenter(c);
      const d = Math.hypot(p.x - body.x, p.y - body.y);
      if (d > 150 && d < 220 && s.streetSteps(s.cellAt(body.x, body.y), c) < 40) { best = p; break; }
    }
    const q = b.renderer.clientOf(s, best.x, best.y);
    return { wx: best.x, wy: best.y, x: q.x, y: q.y };
  });
  await page.click('#unit-roster button[data-who="warrior"]');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelector('#unit-roster button[data-who="warrior"]').classList.contains('on')), 'the portrait arms (lit)');
  await page.mouse.click(far.x, far.y);
  await page.waitForTimeout(150);
  await shot('2-warriors-sent');
  await play(14, true);
  const there = await page.evaluate((f) => window.broodfall.sim.broodlings.filter((x) => !x.puppet && x.motherUnit === undefined).map((x) => Math.round(Math.hypot(x.pos.x - f.wx, x.pos.y - f.wy))), far);
  check(there.length >= 3 && there.every((d) => d < 45), 'every Pit warrior went there (one click on the portrait, one on the board)', JSON.stringify(there));
  await shot('3-warriors-there');

  // 3. ALL, then a soldier: a sortie that comes home.
  const soldier = await page.evaluate((f) => {
    const b = window.broodfall;
    const s = b.sim;
    const e = s.spawnEnemy('militia', s.gates[0]);
    e.pos = { x: f.wx + 30, y: f.wy };
    const q = b.renderer.clientOf(s, e.pos.x, e.pos.y);
    return { id: e.id, x: q.x, y: q.y - 6 };
  }, far);
  await page.click('#unit-roster button[data-who="all"]');
  await page.waitForTimeout(150);
  await page.mouse.click(soldier.x, soldier.y);
  const sorties = await page.evaluate(() => window.broodfall.sim.groups.sorties.size);
  check(sorties >= 3, 'ALL on a soldier: a sortie for every fighter', `${sorties}`);
  await shot('4-all-on-a-soldier');
  await play(4);
  await page.evaluate(() => { const s = window.broodfall.sim; s.enemies.length = 0; });
  await play(30, true);
  const home = await page.evaluate(() => window.broodfall.sim.groups.sorties.size);
  check(home === 0, 'the spot went quiet: the sortie is over and they come home', `${home}`);
  await shot('5-home-again');

  // 4. An alert: an engineer (the warriors' AUTO off, so the toast waits for SEND).
  await page.click('#unit-roster button[data-auto="warrior"]');
  await page.waitForTimeout(150);
  const autoOff = await page.evaluate(() => window.broodfall.sim.groups.auto.warrior === false && window.broodfall.sim.groups.auto.harrier === true);
  check(autoOff, 'the AUTO toggle turns the warriors\' self-answering off');
  await page.evaluate(() => { const s = window.broodfall.sim; s.groups.auto.harrier = false; });
  await page.evaluate((f) => {
    const s = window.broodfall.sim;
    const e = s.spawnEnemy('engineer', s.gates[0]);
    e.pos = { x: f.wx - 40, y: f.wy + 20 };
  }, far);
  await play(1.6);
  const toast = await page.evaluate(() => document.querySelector('.unit-alert')?.textContent ?? '');
  check(/ENGINEER/.test(toast), 'the alert shows with SEND', toast);
  await shot('6-alert');
  await page.click('.unit-alert .ua-send');
  await page.waitForTimeout(150);
  const sent = await page.evaluate(() => window.broodfall.sim.groups.sorties.size);
  check(sent >= 1, 'SEND: one click sends the responders', `${sent}`);
  await play(3);
  await shot('7-sent-to-the-alert');
  await page.evaluate(() => { window.broodfall.sim.enemies.length = 0; });

  // 5. A hurt warrior off the creep walks back onto it.
  const hurt = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const w = s.broodlings.find((x) => !x.puppet);
    let off = null;
    const body = s.bodyPoint();
    for (let c = 0; c < s.map.cells.length && !off; c++) {
      if (s.map.cells[c] !== 1 || s.isCreeped(c)) continue;
      const p = s.cellCenter(c);
      if (Math.hypot(p.x - body.x, p.y - body.y) < 260) off = p;
    }
    if (!off) return null;
    w.pos = { ...off };
    w.orders = [];
    w.hp = w.maxHp * 0.2;
    return { id: w.id };
  });
  if (hurt) {
    await play(1, true);
    check(await page.evaluate((id) => window.broodfall.sim.groups.retreats.has(id), hurt.id), 'a hurt warrior off the creep walks back onto it');
    await shot('8-retreat-to-creep');
    await play(25, true);
    const healed = await page.evaluate((id) => { const s = window.broodfall.sim; const w = s.broodlings.find((x) => x.id === id); return w ? { hp: w.hp / w.maxHp, on: s.isCreeped(s.cellAt(w.pos.x, w.pos.y)) } : null; }, hurt.id);
    check(healed && healed.on && healed.hp > 0.8, 'on the creep it heals', JSON.stringify(healed));
  } else console.log('  (no street off the creep near the body to test the retreat)');
} finally {
  const v = page.video();
  await ctx.close();
  await browser.close();
  server.kill();
  freePort();
  if (v) {
    const files = readdirSync(vidDir).filter((f) => f.endsWith('.webm'));
    if (files.length) {
      const webm = join(vidDir, files[0]);
      try { execSync(`ffmpeg -hide_banner -loglevel error -y -i "${webm}" -c:v libx264 -pix_fmt yuv420p -crf 26 -movflags +faststart "${join(out, 'roster.mp4')}"`); console.log('  film  roster.mp4'); } catch { renameSync(webm, join(out, 'roster.webm')); }
    }
    rmSync(vidDir, { recursive: true, force: true });
  }
}
if (failures.length) { console.log(`FAILED: ${failures.join('; ')}`); process.exit(1); }
console.log('all passed');
process.exit(0);
