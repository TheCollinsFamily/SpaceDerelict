/**
 * SHELTERS, THE INFESTOR AND THE HARRIER, in the browser (Collins, Oct 2 2026; DESIGN.md "SHELTERS AND THE
 * INFESTOR"). Real clicks and keys where the player would use them:
 *   1. a draft offering a district with a SHELTER at its centre (the card's shelter tag).
 *   2. the shelter standing in its district, intact (its own picture).
 *   3. an Infestor born at the body; a click selects it (its panel: INFEST); I, then a click on the shelter.
 *   4. it walks to the door and burrows in (the filling ring); the shelter is yours: stage 1, seeping creep.
 *   5. protected wave clears: it grows to stage 3, and the clear pays its boost (the banner).
 *   6. a Harrier born; a science party far from any limb; the Harrier runs it down (its quills).
 * The whole beat is filmed (expansion.mp4). The Infestor is given a thick hide for the filming (the defenders
 * would kill a lone one; escorting it is the play, tested in tests/expansion.test.ts).
 *
 * Usage: node tools/shot-expansion.mjs        (starts its own dev server on 5348)
 * Artifacts: notes/screens/2026-10-02/expansion-*.png, expansion.mp4
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
const vidDir = join(out, 'expansion-video-tmp');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5348);
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
const surface = async () => { const b = page.locator('#under-done'); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(600); } };
const frameOn = async (expr, zoom) => {
  await page.evaluate(([expr, zoom]) => {
    const b = window.broodfall;
    b.renderer.resetView?.();
    b.step(1);
    const u = new Function('s', `return ${expr}`)(b.sim);
    const c = b.renderer.clientOf(b.sim, u.x ?? u.pos.x, u.y ?? u.pos.y);
    b.renderer.zoomAt(c.x, c.y, zoom);
  }, [expr, zoom]);
  await page.waitForTimeout(700);
  // Then slide it to the middle of the board (zooming keeps the point where it was on screen).
  for (let k = 0; k < 3; k++) await page.evaluate((expr) => {
    const b = window.broodfall;
    b.step(1);
    const u = new Function('s', `return ${expr}`)(b.sim);
    const c = b.renderer.clientOf(b.sim, u.x ?? u.pos.x, u.y ?? u.pos.y);
    const r = b.renderer.app.canvas.getBoundingClientRect();
    const k = b.renderer.app.renderer.width / r.width;
    b.renderer.panBy((r.left + r.width / 2 - c.x) * k, (r.top + r.height * 0.45 - c.y) * k);
  }, expr);
  await page.waitForTimeout(1200);
};
const clientOf = (expr) => page.evaluate((expr) => {
  const b = window.broodfall;
  const u = new Function('s', `return ${expr}`)(b.sim);
  const p = b.renderer.clientOf(b.sim, u.x ?? u.pos.x, u.y ?? u.pos.y);
  return { x: p.x, y: p.y };
}, expr);
const quietSteps = (n) => page.evaluate((n) => { const b = window.broodfall; for (let i = 0; i < n; i += 10) { b.step(10); b.sim.enemies.length = 0; } }, n);

try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=suburb&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  // 1. A draft card with a shelter on it.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    window.broodfall.step(2);
    const empty = s.map.slots.findIndex((x) => x === null);
    const held = s.map.slots.find((x) => x);
    s.phase = 'draft';
    s.pendingDraft = [
      { pattern: held.pattern, slot: empty, feature: 'plain' },
      { pattern: held.pattern, slot: empty, feature: 'meat', shelter: true },
      { pattern: held.pattern, slot: empty, feature: 'science' },
    ];
  });
  await page.waitForTimeout(1800);
  const card = await page.evaluate(() => document.querySelector('.draft-option.has-shelter')?.textContent ?? '');
  check(/SHELTER/.test(card), 'a draft card tells of the shelter at its centre', card.replace(/\s+/g, ' ').slice(0, 100));
  await page.screenshot({ path: join(out, 'expansion-1-draft-card.png') });
  await page.evaluate(() => { const s = window.broodfall.sim; s.phase = 'growth'; s.pendingDraft = null; document.getElementById('draft')?.classList.add('hidden'); });

  // 2. A shelter in the district nearest the body.
  const sh = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const W = s.cfg.gridW;
    const coreSlot = Math.floor(Math.floor(s.map.coreCell / W) / 10) * s.map.slotsX + Math.floor((s.map.coreCell % W) / 10);
    const slots = s.map.slots.map((x, i) => (x ? i : -1)).filter((i) => i >= 0 && i !== coreSlot);
    for (const slot of [...slots, coreSlot]) { s.raiseShelter(slot); if (s.shelters.length) break; }
    s.meat.war = 9999; s.meat.science = 9999;
    return s.shelters[0] ? { id: s.shelters[0].id, cells: s.shelters[0].cells.length, door: s.shelters[0].door } : null;
  });
  check(sh !== null, 'a shelter stands in a district', JSON.stringify(sh));
  await frameOn('s.shelters[0].pos', 2.2);
  await page.waitForTimeout(1500);
  const drawn = await page.evaluate(() => window.broodfall.renderer.shelterViews?.size ?? 0);
  check(drawn >= 1, 'it is drawn over its building', `${drawn} drawn`);
  await page.screenshot({ path: join(out, 'expansion-2-shelter-intact.png') });

  // 3. An Infestor at the body; click it; I; click the shelter.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (s.canBuildOrgan('infestor', c, r) && !s.organs.some((o) => o.organ === 'infestor')) s.issue({ kind: 'build-organ', organ: 'infestor', cell: c, rot: r });
    for (let i = 0; i < 3; i++) s.growFieldUnits();
    const u = s.infestors[0];
    if (u) { u.hp = u.maxHp = 2000; }
    return { organs: s.organs.map((o) => o.organ), infestors: s.infestors.length, phase: s.phase, war: s.meat.war };
  }).then((r) => { console.log('  infestor setup', JSON.stringify(r)); });
  await surface();
  await frameOn('s.infestors[0]', 2.2);
  const inf = await clientOf('s.infestors[0]');
  await page.mouse.click(inf.x, inf.y - 10);
  await page.waitForTimeout(300);
  const panel = await page.evaluate(() => document.getElementById('unit-cmd')?.textContent ?? '');
  check(/INFESTOR/.test(panel) && /INFEST/.test(panel), 'a click selects the Infestor; its panel offers INFEST', panel.replace(/\s+/g, ' ').slice(0, 120));
  await page.screenshot({ path: join(out, 'expansion-3-infestor-selected.png') });
  await page.keyboard.press('i');
  await frameOn('s.shelters[0].pos', 1.4);
  await page.waitForTimeout(1200);
  const shc = await clientOf('s.shelters[0].pos');
  await page.mouse.click(shc.x, shc.y);
  await page.waitForTimeout(300);
  const sent = await page.evaluate(() => window.broodfall.sim.infestors[0]?.infest ?? null);
  check(sent !== null, 'I and a click on the shelter send it in', String(sent));

  // 4. It walks to the door and burrows.
  for (let k = 0; k < 80; k++) {
    const st = await page.evaluate(() => { const s = window.broodfall.sim; window.broodfall.step(20); s.enemies.length = 0; return s.shelters[0].burrowBy !== undefined ? 'burrow' : s.shelters[0].state; });
    await page.waitForTimeout(60);
    if (st !== 'intact') break;
  }
  await frameOn('s.shelters[0].pos', 2.4);
  await page.evaluate(() => { const s = window.broodfall.sim; window.broodfall.step(30); s.enemies.length = 0; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, 'expansion-4-burrowing.png') });
  for (let k = 0; k < 40; k++) {
    const st = await page.evaluate(() => { const s = window.broodfall.sim; window.broodfall.step(20); s.enemies.length = 0; return s.shelters[0].state; });
    await page.waitForTimeout(60);
    if (st === 'infested') break;
  }
  const after = await page.evaluate(() => { const s = window.broodfall.sim; const x = s.shelters[0]; return { state: x.state, stage: x.stage, creep: s.isCreeped(x.door) }; });
  check(after.state === 'infested' && after.creep, 'the shelter is yours, seeping creep', JSON.stringify(after));
  await surface();
  await frameOn('s.shelters[0].pos', 2.2);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, 'expansion-5-infested-stage1.png') });

  // 5. Protected clears: it grows to stage 3, and a clear pays its boost.
  const paid = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const x = s.shelters[0];
    for (let i = 0; i < 8; i++) { x.harmThisWave = 0; s.waveBanked = { war: 120, science: 40, royal: 0 }; s.payShelters(); }
    return { stage: x.stage, paid: s.stats.shelterMeat ?? 0 };
  });
  check(paid.stage === 3 && paid.paid > 0, 'protected clears grow it to stage 3 and pay its boost', JSON.stringify(paid));
  await page.waitForTimeout(400);
  await frameOn('s.shelters[0].pos', 2.2);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, 'expansion-6-infested-stage3.png') });

  // 6. A Harrier, and a science party far from any limb.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.phase = 'growth';
    for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (s.canBuildOrgan('harrier', c, r) && !s.organs.some((o) => o.organ === 'harrier')) s.issue({ kind: 'build-organ', organ: 'harrier', cell: c, rot: r });
    for (let i = 0; i < 2; i++) s.growFieldUnits();
    s.enemies.length = 0;
    for (let i = 0; i < 3; i++) s.spawnEnemy('researcher');
    return { harriers: s.harriers.length, organs: s.organs.map((o) => o.organ), pool: s.cfg.organPool ?? null, phase: s.phase, war: s.meat.war, sci: s.meat.science };
  }).then((r) => console.log('  harrier setup', JSON.stringify(r)));
  await surface();
  const before = await page.evaluate(() => window.broodfall.sim.enemies.length);
  let shot = false;
  for (let k = 0; k < 120; k++) {
    const st = await page.evaluate(() => { const s = window.broodfall.sim; let q = 0; for (let i = 0; i < 5 && !q; i++) { window.broodfall.step(1); q = s.quills.length; } return { q, left: s.enemies.filter((e) => e.kind === 'researcher').length, h: s.harriers.length }; });
    if (st.q > 0 && !shot) {
      shot = true;
      await frameOn('s.harriers[0]', 2.0);
      await page.screenshot({ path: join(out, 'expansion-7-harrier-hunting.png') });
    }
    if (st.left === 0) break;
    await page.waitForTimeout(40);
  }
  const left = await page.evaluate(() => window.broodfall.sim.enemies.filter((e) => e.kind === 'researcher').length);
  const kills = await page.evaluate(() => window.broodfall.sim.stats.harrierKills ?? 0);
  check(before >= 1 && shot && kills >= 1, 'the Harrier runs the science party down', `${before} came, ${left} left, ${kills} killed by Harriers`);
  await page.waitForTimeout(800);
} catch (e) {
  failures.push(String(e.message));
  console.log('  ERROR', e.message);
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
}
// The film.
try {
  const vid = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (vid) execSync(`ffmpeg -hide_banner -loglevel error -y -i "${join(vidDir, vid)}" -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart "${join(out, 'expansion.mp4')}"`);
  rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log('  (no film)', e.message); }
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
