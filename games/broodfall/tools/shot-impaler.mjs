/**
 * THE IMPALER'S SHOT, AT EVERY ANGLE (Nov 22 2026, Collins: "the impaler should be more directional in its shot
 * given its design"). Builds one Impaler on a roof (its rail lying north-south, then another east-west), puts one
 * held, tough soldier at each of eight compass points around it in turn, and photographs the harpoon a few ticks
 * after it leaves: does it leave the barb at the tip of the rail, and fly the way the rail points? Since its line of
 * fire (Sim.inLineOfFire) a soldier off its line is not fired at: "did not fire" is then the right answer.
 *
 * Usage: node tools/shot-impaler.mjs <tag> [--port 5341] [--age 2] [--debug]
 * The game must already be served on that port: best a build (npx vite build --outDir dist-impaler, then
 * npx vite preview --outDir dist-impaler --port 5341), as the dev server reloads the page when another session saves.
 * Writes notes/screens/2026-11-22/impaler-<tag>-rail<NS|EW>-target<point>.jpg and a contact sheet impaler-<tag>-sheet.jpg.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const screens = join(root, 'notes', 'screens', '2026-11-22');
const tmp = join(here, 'screenshots');
mkdirSync(screens, { recursive: true });
mkdirSync(tmp, { recursive: true });
const tag = process.argv[2] ?? 'now';
const pi = process.argv.indexOf('--port');
const PORT = pi > 0 ? Number(process.argv[pi + 1]) : 5341;
const ai = process.argv.indexOf('--age');
/** How many ticks after it leaves the harpoon is photographed. */
const AGE = ai > 0 ? Number(process.argv[ai + 1]) : 2;
const ANGLES = [['E', 0], ['SE', 45], ['S', 90], ['SW', 135], ['W', 180], ['NW', 225], ['N', 270], ['NE', 315]];

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log(`  page error  ${e}`));
const canvas = page.locator('#stage canvas');
// Clearing the board by hand ends the wave, and a district draft would stop the clock: the scene stays in its growth.
const ticks = async (n) => {
  for (let i = 0; i < n; i++) {
    // The soldier is held where it was put (it would walk into or out of the line of fire).
    await page.evaluate(() => {
      const s = window.broodfall.sim;
      if (s.phase === 'draft') s.phase = 'growth';
      const pin = window.__impalerPin;
      const hold = () => { const e = pin && s.enemies.find((u) => u.id === pin.id); if (e) { e.pos.x = pin.x; e.pos.y = pin.y; } };
      hold();
      window.broodfall.step(1);
      hold();
    });
    await page.waitForTimeout(25);
  }
};
const files = [];
const summary = [];

for (const facing of ['S', 'E']) {
  await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&speed=0&biome=suburb`);
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 60000 });
  await page.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war = 9000; });
  await page.waitForTimeout(500);
  const id = await page.evaluate((facing) => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const core = [s.map.coreCell % W, Math.floor(s.map.coreCell / W)];
    const cells = [];
    for (let c = 0; c < s.map.cells.length; c++) if (s.canBuildTower(c, 'impaler', facing)) cells.push(c);
    const d = (c) => Math.hypot((c % W) - core[0], Math.floor(c / W) - core[1]);
    cells.sort((a, b) => Math.abs(d(a) - 6) - Math.abs(d(b) - 6));
    for (const cell of cells) {
      s.hand[0] = { id: 880000 + cell, family: 'impaler', free: true };
      const r = s.issue({ kind: 'build', cardIndex: 0, cell, facing });
      if (r.ok) return s.towers[s.towers.length - 1].id;
    }
    return -1;
  }, facing);
  if (id < 0) { console.log(`  no ground for an impaler facing ${facing}`); continue; }
  // Close on it.
  await page.keyboard.press('Home');
  await page.waitForTimeout(300);
  const b = await canvas.boundingBox();
  const onPage = (at) => ({ x: b.x + (at.x / at.vw) * b.width, y: b.y + (at.y / at.vh) * b.height });
  const where = () => page.evaluate((id) => { const t = window.broodfall.sim.towers.find((u) => u.id === id); return window.broodfall.worldToScreen(t.pos.x, t.pos.y); }, id);
  let p = onPage(await where());
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(600);
  for (let round = 0; round < 4; round++) {
    p = onPage(await where());
    if (Math.hypot(p.x - (b.x + b.width / 2), p.y - (b.y + b.height / 2)) < 12) break;
    await page.keyboard.down('Shift');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(500);
  }
  // And two a little off its length (25 degrees), inside its line of fire: it aims at them from the barb.
  const off = facing === 'S' ? [['S25', 115], ['N25', 295]] : [['E25', 25], ['W25', 205]];
  for (const [name, deg] of [...off, ...ANGLES]) {
    // One held, tough soldier at this compass point, 120 px out; nothing else on the board.
    const state = await page.evaluate(([id, deg]) => {
      const s = window.broodfall.sim;
      s.enemies.length = 0;
      s.projectiles.length = 0;
      const t = s.towers.find((u) => u.id === id);
      t.cooldown = 0;
      t.lastTargetId = undefined;
      const e = s.spawnEnemy('soldier', s.gates[0]);
      const a = (deg * Math.PI) / 180;
      e.pos.x = t.pos.x + Math.cos(a) * 120;
      e.pos.y = t.pos.y + Math.sin(a) * 120;
      e.speed = 0;
      e.hp *= 50; e.maxHp *= 50;
      e.revealedUntil = s.time + 999;
      window.__impalerPin = { id: e.id, x: e.pos.x, y: e.pos.y };
      return { facing: t.facing, inLine: s.inLineOfFire ? s.inLineOfFire(t, e.pos) : true, phase: s.phase, priority: t.priority, stunned: t.stunnedUntil, keys: Object.keys(t).join(',') };
    }, [id, deg]);
    if (process.argv.includes('--debug')) console.log(`  ${facing} ${name}: ${JSON.stringify(state)}`);
    let fired = false;
    let shotAge = 0;
    for (let i = 0; i < 6; i++) { // it fires on its first tick, or not at all (cooldown 0); the growth's clock stops after ~7 s of this
      await ticks(1);
      const n = await page.evaluate((id) => window.broodfall.sim.projectiles.filter((q) => q.fromFamily === 'impaler').length, id);
      if (n > 0) { fired = true; shotAge++; if (shotAge >= AGE) break; }
    }
    if (process.argv.includes('--debug')) console.log('   after', JSON.stringify(await page.evaluate((id) => { const s = window.broodfall.sim; const t = s.towers.find((u) => u.id === id); return { out: s.outcome, ph: s.phase, cd: t?.cooldown, towers: s.towers.length, en: s.enemies.map((e) => [Math.round(e.pos.x), Math.round(e.pos.y), e.hp]), t: t?.pos }; }, id)));
    const png = join(tmp, `impaler-${tag}-${facing}-${name}.png`);
    await page.waitForTimeout(150);
    await canvas.screenshot({ path: png });
    const out = join(screens, `impaler-${tag}-rail${facing === 'S' ? 'NS' : 'EW'}-target${name}.jpg`);
    spawnSync('python', [join(here, 'shot-impaler-sheet.py'), 'one', png, out]);
    files.push(out);
    summary.push(`rail ${facing === 'S' ? 'N-S' : 'E-W'}, target ${name}: ${fired ? 'fired' : 'did not fire'}`);
    console.log(`  shot  ${out}  (${fired ? 'fired' : 'did not fire'})`);
  }
}
await browser.close();
// A contact sheet: rail north-south on the top two rows, rail east-west below.
if (files.length) {
  const sheet = join(screens, `impaler-${tag}-sheet.jpg`);
  const r = spawnSync('python', [join(here, 'shot-impaler-sheet.py'), 'sheet', sheet, ...files.flatMap((f, i) => [f, summary[i]])], { encoding: 'utf8' });
  if (r.status !== 0) console.log(r.stderr);
  console.log(`  sheet  ${sheet}`);
}
console.log(summary.join('\n'));
