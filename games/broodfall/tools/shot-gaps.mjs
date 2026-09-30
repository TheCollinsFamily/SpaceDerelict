/**
 * Screenshot beat for the gameplay gaps closed on Sep 30 2026 (notes/GAPS-2026-09-30.md), played in
 * the real game on the DEV server by the player's own gestures where the gesture is the mechanic:
 *   royal  — the ROYAL DECREES box from the bar's royal button, a Royal Commission picked, a limb
 *            crowned from its panel (the crown on it, its 120px shelter ring).
 *   surgery — mid-siege, a card held over a limb (the SURGERY UNDER FIRE warning), the limb eaten and
 *            the new one placed: the raw graft ring, the banner, the panel's GRAFTING line.
 *   burrow — between waves, the pointer on the smoke in front of a wall of the body (the dig lit),
 *            then the click: the wall opens, a new gate.
 *   lance  — a creep lance that ate two ember sacs laid across the street: its strip burns the column.
 *
 * Usage: node tools/shot-gaps.mjs [royal surgery burrow lance]   (BROODFALL_PORT to move it off 5296)
 * Artifacts: notes/screens/2026-09-30/gap-*.jpg
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const PORT = Number(process.env.BROODFALL_PORT || 5296);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(out, { recursive: true });
const want = process.argv.slice(2);
const on = (b) => want.length === 0 || want.includes(b);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
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
  const t = setTimeout(() => rej(new Error('vite did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [];

async function open(seed, tries = 4) {
  const page = await openOnce(seed);
  // A peer re-baking a picture while this page loaded it: load again (the banner must not be in the shots).
  if (tries > 1 && (await page.evaluate(() => window.broodfall.artMissing())).length > 0) {
    await page.close();
    await new Promise((r) => setTimeout(r, 15000));
    return open(seed, tries - 1);
  }
  const missing = await page.evaluate(() => window.broodfall.artMissing());
  const banner = await page.evaluate(() => /did not load/i.test(document.body.innerText));
  check(missing.length === 0 && !banner, `seed ${seed}: every picture loaded, no "did not load" banner`, missing.slice(0, 3).join(', '));
  return page;
}

async function openOnce(seed) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.WebSocket = class { constructor() {} addEventListener() {} removeEventListener() {} send() {} close() {} }; });
  for (let k = 0; ; k++) {
    try {
      await page.goto(`http://localhost:${PORT}/?seed=${seed}&autostart=1&speed=0`, { waitUntil: 'load', timeout: 180000 });
      await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 60000 });
      break;
    } catch (e) {
      if (k >= 3) throw e;
      await page.waitForTimeout(2000);
    }
  }
  // Wait for every picture (a peer re-baking a file can make one late).
  for (let k = 0; k < 20; k++) {
    await page.waitForTimeout(500);
    if ((await page.evaluate(() => window.broodfall.artMissing())).length === 0) break;
  }
  return page;
}

async function toClient(page, x, y) {
  const box = await page.locator('#stage canvas').boundingBox();
  const ss = await page.evaluate(([a, b]) => window.broodfall.worldToScreen(a, b), [x, y]);
  return { x: box.x + (ss.x / ss.vw) * box.width, y: box.y + (ss.y / ss.vh) * box.height };
}
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 88 });
const frame = (page) => page.evaluate(() => window.broodfall.step(1));

/** Spitters on roofs near each other (by the sim: what is looked at is what happens next). */
async function growCluster(page, n) {
  return page.evaluate((count) => {
    const s = window.broodfall.sim;
    s.meat.war = 900; s.meat.science = 900;
    const cells = window.broodfall.buildableCells();
    const ids = [];
    const first = s.cellCenter(cells[0]);
    for (const c of cells) {
      if (ids.length >= count) break;
      const p = s.cellCenter(c);
      if (ids.length > 0 && Math.hypot(p.x - first.x, p.y - first.y) > 90) continue;
      s.hand.unshift({ id: 800000 + c, family: 'spitter' });
      if (s.issue({ kind: 'build', cardIndex: 0, cell: c }).ok) { ids.push(s.towers[s.towers.length - 1].id); s.hand.pop(); }
      else s.hand.shift();
    }
    return ids;
  }, n);
}

try {
  if (on('royal')) {
    console.log('ROYAL DECREES');
    const page = await open(7);
    const ids = await growCluster(page, 3);
    await page.evaluate(() => { window.broodfall.sim.meat.royal = 7; });
    await frame(page);
    await page.locator('#royal-surge').click();
    await page.waitForTimeout(300);
    const cards = await page.locator('#decrees .decree').count();
    check(cards === 6, `the royal button opens the ROYAL DECREES box (${cards} decrees)`);
    await shot(page, 'gap-royal-decrees');
    await page.locator('#decrees [data-decree="commission"]').click();
    await page.waitForTimeout(250);
    const choices = await page.locator('#decrees .decree-pick button').count();
    check(choices > 0, `a Royal Commission offers the limbs the organs unlock (${choices})`);
    await shot(page, 'gap-royal-commission');
    const handBefore = await page.evaluate(() => window.broodfall.sim.hand.length);
    await page.locator('#decrees .decree-pick button').first().click();
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({ n: window.broodfall.sim.hand.length, last: window.broodfall.sim.hand.at(-1), royal: window.broodfall.sim.meat.royal }));
    check(after.n === handBefore + 1 && after.last.free === true && after.royal === 6, `the commissioned card is in the hand, free (${after.last.family}); 1 point spent`);
    await page.locator('#decrees [data-decree="favour"]').click();
    await page.waitForTimeout(200);
    check(await page.evaluate(() => window.broodfall.sim.decrees.favour === 1), "Consort's Favour bought on its card");
    await page.locator('#decrees [data-close]').click();
    // Crown the first limb from its panel.
    const pos = await page.evaluate((i) => window.broodfall.sim.towers.find((t) => t.id === i).pos, ids[0]);
    const c = await toClient(page, pos.x, pos.y);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(300);
    const crownBtn = page.locator('#inspect-evolve [data-crown]');
    await crownBtn.waitFor({ timeout: 5000 }).catch(() => {});
    check(await crownBtn.count() === 1, 'the limb panel offers CROWN THIS LIMB');
    await crownBtn.click();
    await page.waitForTimeout(250);
    // Whichever limb the click opened is the one crowned.
    const crowned = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const t = s.towers.find((x) => x.crowns);
      if (!t) return { crowns: 0, sheltered: null };
      const other = s.towers.find((x) => x.id !== t.id && Math.hypot(x.pos.x - t.pos.x, x.pos.y - t.pos.y) <= 120);
      return { crowns: t.crowns, sheltered: other ? s.harmMultOf(other) : null };
    });
    check(crowned.crowns === 1 && crowned.sheltered !== null && Math.abs(crowned.sheltered - 0.7) < 1e-9, `crowned from its panel; a neighbour takes ×${crowned.sheltered} harm`);
    await frame(page);
    await page.mouse.move(c.x + 300, c.y + 200);
    await page.waitForTimeout(200);
    await shot(page, 'gap-royal-crown');
    await page.close();
  }

  if (on('surgery')) {
    console.log('SURGERY UNDER FIRE');
    const page = await open(7);
    const ids = await growCluster(page, 3);
    // Into a siege, the column in the streets.
    await page.evaluate(() => { const b = window.broodfall; b.sim.issue({ kind: 'call-early' }); });
    await page.evaluate(() => window.broodfall.step(120));
    if (await page.locator('#under-done').isVisible()) await page.locator('#under-done').click();
    const phase = await page.evaluate(() => window.broodfall.sim.phase);
    check(phase === 'siege', `a siege is on (${phase})`);
    // Hold a card (the player's click on it), then the pointer on a limb.
    await page.evaluate(() => { const s = window.broodfall.sim; s.hand.unshift({ id: 990001, family: 'spitter' }); s.meat.war = 900; });
    await frame(page);
    await page.locator('#hand .card').first().click();
    await page.waitForTimeout(200);
    const pos = await page.evaluate((i) => window.broodfall.sim.towers.find((t) => t.id === i).pos, ids[1]);
    const c = await toClient(page, pos.x, pos.y);
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(250);
    const hint = await page.locator('#hint').innerText();
    check(/SURGERY UNDER FIRE/.test(hint), 'the cannibalize hover warns: SURGERY UNDER FIRE', hint.slice(0, 120));
    await shot(page, 'gap-surgery-warning');
    await page.mouse.click(c.x, c.y); // eat it
    await page.waitForTimeout(200);
    // Place the new limb where the eaten one stood.
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(250);
    const grafting = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const t = s.towers[s.towers.length - 1];
      return { id: t.id, left: (t.graftUntil ?? 0) - s.time, pips: t.pips.length };
    });
    check(grafting.left > 0 && grafting.pips > 0, `the new limb grafts ${grafting.left.toFixed(1)}s with ${grafting.pips} eaten bonus(es)`);
    await page.evaluate(() => window.broodfall.step(4));
    const np = await page.evaluate((i) => window.broodfall.sim.towers.find((t) => t.id === i).pos, grafting.id);
    const nc = await toClient(page, np.x, np.y);
    await page.mouse.click(nc.x, nc.y); // its panel
    await page.waitForTimeout(250);
    const traits = await page.locator('#inspect-traits').innerText();
    check(/GRAFTING/i.test(traits), 'its panel says GRAFTING', traits.slice(0, 100));
    await page.mouse.move(nc.x + 260, nc.y + 180);
    await shot(page, 'gap-surgery-graft');
    await page.evaluate(() => window.broodfall.step(60));
    const took = await page.evaluate((i) => { const t = window.broodfall.sim.towers.find((x) => x.id === i); return t ? t.graftUntil === undefined : 'died'; }, grafting.id);
    check(took === true || took === 'died', `the graft took (or the limb died grafting): ${took}`);
    await page.close();
  }

  if (on('burrow')) {
    console.log('BURROW');
    const page = await open(7);
    await page.evaluate(() => { window.broodfall.sim.meat.war = 200; });
    await frame(page);
    const target = await page.evaluate(() => {
      const s = window.broodfall.sim;
      for (let i = 0; i < s.map.cells.length; i++) {
        if (s.map.cells[i] !== 3) continue;
        const site = s.burrowSiteAt(i);
        if (site && !site.blocked) {
          const p = s.cellCenter(i);
          const v = window.broodfall.worldToScreen(p.x, p.y);
          if (v.x > 200 && v.y > 150 && v.x < v.vw - 200 && v.y < v.vh - 250) return { i, p, gates: s.gates.length };
        }
      }
      return null;
    });
    check(target !== null, 'a wall of the body faces the smoke on screen');
    const c = await toClient(page, target.p.x, target.p.y);
    await page.mouse.move(c.x, c.y);
    await page.waitForTimeout(300);
    const hint = await page.locator('#hint').innerText();
    check(/BURROW/.test(hint), 'hovering the smoke offers the burrow', hint.slice(0, 120));
    await shot(page, 'gap-burrow-hover');
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ gates: window.broodfall.sim.gates.length, war: window.broodfall.sim.meat.war, burrows: window.broodfall.sim.burrows }));
    check(after.gates === target.gates + 1 && after.burrows === 1, `the click burrows through: gates ${target.gates} → ${after.gates}, war ${after.war}`);
    await frame(page);
    await page.mouse.move(c.x + 250, c.y + 250);
    await page.waitForTimeout(250);
    await shot(page, 'gap-burrow-done');
    await page.close();
  }

  if (on('lance')) {
    console.log('LANCE STRIP BURNS');
    const page = await open(7);
    const placed = await page.evaluate(() => {
      const s = window.broodfall.sim;
      s.meat.war = 900;
      const W = s.cfg.gridW;
      // The street the next assault will walk: from its gate down the flow to the core.
      const path = new Set();
      for (const g of s.incomingGates) {
        let cur = g;
        for (let k = 0; k < 400 && cur >= 0 && !path.has(cur); k++) { path.add(cur); cur = s.flowNextOf(cur); }
      }
      let best = null;
      for (const c of window.broodfall.buildableCells()) {
        for (const dir of ['N', 'E', 'S', 'W']) {
          if (!s.placementFor(c, 'lance', dir)) continue;
          const f = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[dir];
          let n = 0;
          for (let k = 1; k <= 8; k++) {
            const x = (c % W) + f[0] * k;
            const y = Math.floor(c / W) + f[1] * k;
            const cell = y * W + x;
            if (path.has(cell)) n++;
          }
          if (!best || n > best.n) best = { c, dir, n };
        }
      }
      // Two ember sacs set the strip burning; two bursters widen it two cells each side.
      s.pendingPips = [{ family: 'ember' }, { family: 'ember' }, { family: 'burster' }, { family: 'burster' }];
      s.hand.unshift({ id: 990002, family: 'lance' });
      const r = s.issue({ kind: 'build', cardIndex: 0, cell: best.c, facing: best.dir });
      return { ok: r.ok, n: best.n, dir: best.dir };
    });
    check(placed.ok && placed.n > 0, `a lance with two ember sacs lies across ${placed.n} street cells, facing ${placed.dir}`);
    await page.evaluate(() => window.broodfall.step(200)); // the strip grows
    await page.evaluate(() => window.broodfall.sim.issue({ kind: 'call-early' }));
    let burning = 0;
    for (let k = 0; k < 120 && burning < 4; k++) {
      await page.evaluate(() => window.broodfall.step(5));
      burning = await page.evaluate(() => window.broodfall.sim.enemies.filter((e) => (e.burnUntil ?? 0) > window.broodfall.sim.time).length);
    }
    if (await page.locator('#under-done').isVisible()) await page.locator('#under-done').click();
    check(burning > 0, `bodies burning on the strip: ${burning}`);
    await shot(page, 'gap-lance-burning');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
if (errors.length) console.log('page errors:', errors.slice(0, 5).join(' | '));
console.log(failures.length ? `FAILED: ${failures.join('; ')}` : 'all gap beats passed');
process.exit(failures.length ? 1 : 0);
