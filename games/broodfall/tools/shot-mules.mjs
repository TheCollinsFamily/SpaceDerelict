/**
 * SPORE MULES AND BROOD ONLY ON CREEP, in the browser (Collins, Oct 2 2026: "a unit that can act like a creep node
 * (and an organ that makes them) ... you walk it out and deploy it ... Broodmothers can't be put in make-babies mode
 * except on creep"). Real clicks and keys on the board:
 *   1. a Mule Sac grown and a Spore Mule born at the body; a click selects it (its panel: DEPLOY).
 *   2. a right-click on a street past the creep: it walks out (its orders drawn).
 *   3. the Broodmother sent after it in fight mode; T there: refused, "she broods only on your creep".
 *   4. D: the mule roots, a creep node; the creep spreads round it.
 *   5. T again: she broods on the new creep (her egg ring).
 * The whole beat is filmed (mules-deploy.mp4).
 *
 * Usage: node tools/shot-mules.mjs        (starts its own dev server on 5347)
 * Artifacts: notes/screens/2026-10-02/mules-*.png, mules-deploy.mp4
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
const vidDir = join(out, 'mules-video-tmp');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5347);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};

const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, recordVideo: { dir: vidDir, size: { width: 1400, height: 900 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  page error:', e.message));
// Esc with nothing selected opens Settings (over the board): only clear a selection that is there.
const deselect = async () => { if ((await page.evaluate(() => window.broodfall.selectedUnits())).length) await page.keyboard.press('Escape'); };
// A cleared wave opens the organ stage over the board: back to the surface before clicking on the board.
const surface = async () => { const b = page.locator('#under-done'); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(600); } };
const hint = () => page.evaluate(() => (document.getElementById('hint') ?? document.querySelector('.hint'))?.textContent ?? '');
const clientOfUnit = (expr) => page.evaluate((expr) => {
  const b = window.broodfall;
  const u = new Function('s', `return ${expr}`)(b.sim);
  const p = b.renderer.clientOf(b.sim, u.pos.x, u.pos.y);
  return { id: u.id, x: p.x, y: p.y - 8 };
}, expr);
const frameOn = async (expr, zoom) => {
  await page.evaluate(([expr, zoom]) => {
    const b = window.broodfall;
    b.renderer.resetView?.();
    b.step(1);
    const u = new Function('s', `return ${expr}`)(b.sim);
    const c = b.renderer.clientOf(b.sim, u.pos.x, u.pos.y);
    b.renderer.zoomAt(c.x, c.y, zoom);
  }, [expr, zoom]);
  await page.waitForTimeout(1500);
};
try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=suburb&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  // A Broodmother Den (its mother born), a Mule Sac grown, a mule born; a street past the creep picked.
  const set = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    b.step(2);
    const quiet = (n) => { for (let i = 0; i < n; i += 10) { b.step(10); s.enemies.length = 0; } };
    s.meat.war = 9999; s.meat.science = 9999;
    // The sac first: organs grow between waves (the growth phase the run opens in).
    let sac = false;
    let why = 'no spot';
    for (let c = 0; c < s.under.cells.length && !sac; c++) for (let r = 0; r < 4 && !sac; r++) if (s.canBuildOrgan('mule', c, r)) { const res = s.issue({ kind: 'build-organ', organ: 'mule', cell: c, rot: r }); sac = res.ok; why = res.err ?? 'ok'; }
    window.__why = why + ' phase=' + s.phase;
    let den = null;
    for (let tries = 0; tries < 400 && den === null; tries++) {
      s.hand[0] = { id: 991000 + tries, family: 'brood', free: true };
      const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, 'brood'));
      if (cell >= 0 && b.play({ kind: 'build', cardIndex: 0, cell }).ok) den = s.towers[s.towers.length - 1].id;
      else quiet(20);
    }
    quiet(300);
    s.growMules(); s.growMules();
    const W = s.cfg.gridW;
    const core = s.map.coreCell;
    let target = -1;
    for (let d = 5; d < 16 && target < 0; d++) {
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] !== 1 || s.isCreeped(c)) continue;
        const md = Math.abs((c % W) - (core % W)) + Math.abs(Math.floor(c / W) - Math.floor(core / W));
        if (md === d && s.standableAt(s.cellCenter(c))) { target = c; break; }
      }
    }
    return { den, sac, why: window.__why, mules: s.mules.length, mothers: s.mothers.length, target };
  });
  check(set.den !== null && set.mothers >= 1, 'a Den grows and bears a Broodmother', JSON.stringify(set));
  check(set.sac && set.mules === 1, 'a Mule Sac grows a Spore Mule at the body', JSON.stringify(set));
  check(set.target >= 0, 'a street past the creep to walk to');

  // 1. Click the mule.
  await frameOn('s.mules[0]', 2.4);
  const mule = await clientOfUnit('s.mules[0]');
  await page.mouse.click(mule.x, mule.y);
  await page.waitForTimeout(300);
  const sel = await page.evaluate(() => window.broodfall.selectedUnits());
  const panel = await page.evaluate(() => document.getElementById('unit-cmd')?.textContent ?? '');
  check(sel.includes(mule.id), 'a click on the Spore Mule selects it', JSON.stringify(sel));
  check(/SPORE MULE/.test(panel) && /DEPLOY/.test(panel), 'its panel says SPORE MULE and offers DEPLOY', panel.replace(/\s+/g, ' ').slice(0, 120));
  await page.screenshot({ path: join(out, 'mules-1-selected.png') });

  // 2. Right-click the street past the creep.
  await page.evaluate(() => { window.broodfall.renderer.resetView?.(); window.broodfall.step(1); });
  await page.waitForTimeout(1500);
  const tgt = await page.evaluate((c) => { const b = window.broodfall; const p = b.sim.cellCenter(c); const q = b.renderer.clientOf(b.sim, p.x, p.y); return { x: q.x, y: q.y }; }, set.target);
  await page.mouse.click(tgt.x, tgt.y, { button: 'right' });
  await page.waitForTimeout(200);
  const ordered = await page.evaluate(() => (window.broodfall.sim.mules[0]?.orders ?? []).length);
  check(ordered >= 1, 'a right-click orders it out', `${ordered} orders`);
  await page.screenshot({ path: join(out, 'mules-2-walking-out.png') });
  for (let k = 0; k < 30; k++) {
    const left = await page.evaluate(() => { const b = window.broodfall; b.step(30); b.sim.enemies.length = 0; return (b.sim.mules[0]?.orders ?? []).length; });
    await page.waitForTimeout(120);
    if (!left) break;
  }
  const there = await page.evaluate(() => { const s = window.broodfall.sim; const m = s.mules[0]; return m ? { on: s.isCreeped(s.cellAt(m.pos.x, m.pos.y)), orders: m.orders.length } : null; });
  check(there && there.orders === 0 && !there.on, 'it walks out past the creep', JSON.stringify(there));

  // 3. The Broodmother after it, in fight mode; T refused there.
  await deselect();
  await page.evaluate((c) => {
    const s = window.broodfall.sim;
    const m = s.mothers[0];
    s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'fight' });
    const p = s.cellCenter(c);
    s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: { x: p.x + 14, y: p.y } } });
  }, set.target);
  for (let k = 0; k < 40; k++) {
    const left = await page.evaluate(() => { const b = window.broodfall; b.step(30); b.sim.enemies.length = 0; return b.sim.mothers[0].orders.length; });
    await page.waitForTimeout(80);
    if (!left) break;
  }
  await surface();
  await frameOn('s.mothers[0]', 2.2);
  const mum = await clientOfUnit('s.mothers[0]');
  await page.mouse.click(mum.x, mum.y - 6);
  await page.waitForTimeout(250);
  await page.keyboard.press('t');
  await page.waitForTimeout(300);
  const refused = await page.evaluate(() => ({ mode: window.broodfall.sim.mothers[0].mode, btn: document.querySelector('#unit-cmd [data-cmd="mode"]')?.textContent ?? '' }));
  const h3 = await hint();
  check(refused.mode === 'fight' && /CREEP/i.test(refused.btn + h3), 'off the creep, T is refused and says why', `${refused.mode} · ${refused.btn} · ${h3.slice(0, 80)}`);
  await page.screenshot({ path: join(out, 'mules-3-brood-refused-off-creep.png') });

  // 4. Select the mule, D: it roots.
  await surface();
  await deselect();
  const mule2 = await clientOfUnit('s.mules[0]');
  await page.mouse.click(mule2.x, mule2.y);
  await page.waitForTimeout(200);
  await page.keyboard.press('d');
  await page.waitForTimeout(200);
  const rooted = await page.evaluate(() => ({ mules: window.broodfall.sim.mules.length, rooted: window.broodfall.sim.stats.mulesRooted ?? 0 }));
  check(rooted.mules === 0 && rooted.rooted === 1, 'D roots it into a creep node', JSON.stringify(rooted));
  await page.screenshot({ path: join(out, 'mules-4-rooted.png') });
  for (let k = 0; k < 10; k++) { await page.evaluate(() => { const b = window.broodfall; b.step(30); b.sim.enemies.length = 0; }); await page.waitForTimeout(150); }
  const spread = await page.evaluate(() => { const s = window.broodfall.sim; const m = s.mothers[0]; return s.isCreeped(s.cellAt(m.pos.x, m.pos.y)); });
  check(spread, 'the creep spreads round the new node, under her');
  await page.screenshot({ path: join(out, 'mules-4-creep-spread.png') });

  // 5. T: she broods on the new creep.
  await surface();
  await deselect();
  const mum2 = await clientOfUnit('s.mothers[0]');
  // Her warriors stand round her: click her body (a little up from her feet), and check it is her that is selected.
  for (const dy of [-14, -20, -8, -26]) {
    await deselect();
    await page.mouse.click(mum2.x, mum2.y + dy);
    await page.waitForTimeout(200);
    if ((await page.evaluate(() => window.broodfall.selectedUnits())).includes(mum2.id)) break;
  }
  const selMum = await page.evaluate(() => window.broodfall.selectedUnits());
  check(selMum.includes(mum2.id), 'a click selects her again', JSON.stringify(selMum));
  await page.keyboard.press('t');
  await page.waitForTimeout(200);
  console.log('  hint after T:', (await hint()).slice(0, 100));
  for (let k = 0; k < 6; k++) { await page.evaluate(() => { const b = window.broodfall; b.step(30); b.sim.enemies.length = 0; }); await page.waitForTimeout(150); }
  const brood = await page.evaluate(() => { const s = window.broodfall.sim; const m = s.mothers[0]; return { mode: m.mode, warriors: s.broodlings.filter((x) => x.motherUnit === m.id).length }; });
  check(brood.mode === 'brood' && brood.warriors >= 1, 'on the new creep she broods', JSON.stringify(brood));
  await page.screenshot({ path: join(out, 'mules-5-brooding-on-new-creep.png') });
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
}
try {
  const webm = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (webm) {
    execSync(`ffmpeg -loglevel error -y -i "${join(vidDir, webm)}" -vf "fps=24,scale=1120:-2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${join(out, 'mules-deploy.mp4')}"`);
    console.log(`  film: ${join(out, 'mules-deploy.mp4')}`);
  }
  rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log('  film failed:', e.message); }
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
