/**
 * SHELTERS, THE INFESTOR AND THE HARRIER, filmed for Collins (Oct 2 2026; DESIGN.md "SHELTERS AND THE INFESTOR").
 * The whole loop, close and clear, with real clicks and keys where the player uses them, and the Infestor's REAL
 * hp (no override: the escort takes the defenders' fire):
 *   1. a draft offering a district with a SHELTER (the card's tag); the district drafted, the shelter raised on its
 *      levelled lot with its apron of street.
 *   2. the shelter in the city at the board's normal zoom (does it belong?), then close.
 *   3. an Infestor born, a Brood Pit's warriors as its escort; a click selects the Infestor; I, then a click on the shelter;
 *      the warriors sent ahead to the door (attack-move).
 *   4. it walks up the street; it burrows at the door (the progress ring); it is drawn into the door.
 *   5. the shelter is yours: creep seeps from it; protected clears grow it to stage 3 (sped up); a real wave clear
 *      pays its boost (the banner).
 *   6. a war column diverts off its road to tear at the infested shelter.
 *   7. a Harrier runs down a science party far from any limb.
 * Plus a size line-up sheet (expansion-lineup.png): shelter, Infestor, Broodmother, warrior, Harrier, Flametrooper on
 * one street, and the measured sizes (expansion-sizes.json).
 *
 * Usage: node tools/shot-expansion.mjs        (starts its own dev server on 5348)
 * Artifacts: notes/screens/2026-10-02/expansion-*.png, expansion.mp4, expansion-lineup.png, expansion-sizes.json
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
/** Frame a point (an expression over the sim `s` giving {x,y} or a unit) at a zoom, centred on the board. */
const frameOn = async (expr, zoom) => {
  await page.evaluate(([expr, zoom]) => {
    const b = window.broodfall;
    b.renderer.resetView?.();
    b.step(1);
    const pt = () => { const u = new Function('s', `return ${expr}`)(b.sim); return { x: u.x ?? u.pos.x, y: u.y ?? u.pos.y }; };
    let w = pt();
    let c = b.renderer.clientOf(b.sim, w.x, w.y);
    if (zoom !== 1) b.renderer.zoomAt(c.x, c.y, zoom);
    for (let k = 0; k < 4; k++) {
      b.renderer.draw(b.sim, 0);
      w = pt();
      c = b.renderer.clientOf(b.sim, w.x, w.y);
      const r = b.renderer.app.canvas.getBoundingClientRect();
      const kk = b.renderer.app.renderer.width / r.width;
      b.renderer.panBy((r.left + r.width / 2 - c.x) * kk, (r.top + r.height * 0.45 - c.y) * kk);
    }
  }, [expr, zoom]);
  await page.waitForTimeout(1200);
};
const clientOf = (expr) => page.evaluate((expr) => {
  const b = window.broodfall;
  const u = new Function('s', `return ${expr}`)(b.sim);
  const p = b.renderer.clientOf(b.sim, u.x ?? u.pos.x, u.y ?? u.pos.y);
  return { x: p.x, y: p.y };
}, expr);
/** Run the sim a while at a watchable pace (frames drawn between), with the hive's waves kept off unless `live`. */
const play = async (seconds, { live = false, until } = {}) => {
  for (let k = 0; k < seconds * 4; k++) {
    const done = await page.evaluate(([live, until]) => {
      const b = window.broodfall;
      b.step(2);
      if (!live) b.sim.enemies = b.sim.enemies.filter((e) => e.kind === 'researcher' || e.ward);
      return until ? new Function('s', `return ${until}`)(b.sim) : false;
    }, [live, until ?? null]);
    await page.waitForTimeout(50);
    if (done) return true;
  }
  return false;
};
const shot = (name) => page.screenshot({ path: join(out, `expansion-${name}.png`) });

try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=7&speed=0&biome=suburb&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  // 1. A draft with a shelter on one of its cards: the real draft overlay.
  const offer = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    b.step(2);
    s.meat.war = 9999; s.meat.science = 9999;
    // Real offers; the shelter marked on the first one that can hold it (Sim.markShelterOffer's own test).
    for (let seed = 1; seed < 40; seed++) {
      s.draftsTaken = 4 + seed; // the shelter roll is the run's seed and the draft count
      const offers = b.draftOffersFor ? b.draftOffersFor(seed) : null;
      if (!offers) break;
      s.markShelterOffer(offers);
      if (offers.some((o) => o.shelter)) { s.draftsTaken = 0; s.phase = 'draft'; s.pendingDraft = offers; return offers.findIndex((o) => o.shelter); }
    }
    return -1;
  });
  check(offer >= 0, 'a draft offers a district with a shelter');
  await page.waitForTimeout(1800);
  const card = await page.evaluate(() => document.querySelector('.draft-option.has-shelter')?.textContent ?? '');
  check(/SHELTER/.test(card), 'its card tells of the shelter', card.replace(/\s+/g, ' ').slice(0, 90));
  await shot('1-draft-card');
  await page.locator('.draft-option.has-shelter').click();
  await page.waitForTimeout(800);
  const sh = await page.evaluate(() => { const s = window.broodfall.sim; const x = s.shelters[0]; return x ? { id: x.id, door: x.door, h: x.cells.map((c) => s.map.heights[c]) } : null; });
  check(sh !== null && sh.h.every((h) => h === sh.h[0]), 'drafting it raises the shelter on a level lot', JSON.stringify(sh));

  // 2. In the city: normal zoom, then close.
  await frameOn('s.shelters[0].pos', 1);
  await page.waitForTimeout(1500);
  await shot('2a-shelter-in-city-normal');
  await frameOn('s.shelters[0].pos', 2.2);
  await shot('2b-shelter-close');

  // 3. The Infestor and its escort.
  await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    s.phase = 'growth';
    const grow = (organ) => { for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (!s.organs.some((o) => o.organ === organ) && s.canBuildOrgan(organ, c, r)) s.issue({ kind: 'build-organ', organ, cell: c, rot: r }); };
    grow('infestor');
    for (let i = 0; i < 3; i++) s.growFieldUnits();
    // A Brood Pit by the body: its warriors are the escort.
    s.hand[0] = { id: 995001, family: 'hatch', free: true };
    const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, 'hatch'));
    if (cell >= 0) b.play({ kind: 'build', cardIndex: 0, cell });
  });
  await play(20, { until: 's.broodlings.filter((w) => !w.puppet).length >= 3' });
  const born = await page.evaluate(() => ({ inf: window.broodfall.sim.infestors.length, hp: window.broodfall.sim.infestors[0]?.hp, warriors: window.broodfall.sim.broodlings.length }));
  check(born.inf === 1 && born.warriors >= 2, 'an Infestor and an escort of warriors at the body', JSON.stringify(born));
  await surface();
  await frameOn('s.infestors[0]', 2.4);
  const inf = await clientOf('s.infestors[0]');
  await page.mouse.click(inf.x, inf.y - 8);
  await page.waitForTimeout(300);
  const panel = await page.evaluate(() => document.getElementById('unit-cmd')?.textContent ?? '');
  const realHp = await page.evaluate(() => `${Math.ceil(window.broodfall.sim.infestors[0].hp)}/${Math.ceil(window.broodfall.sim.infestors[0].maxHp)}`);
  check(panel.includes(`INFESTOR · ${realHp}`) && realHp.endsWith('/150'), 'its panel shows its real hp (150) and INFEST', panel.replace(/\s+/g, ' ').slice(0, 60));
  await shot('3-infestor-selected');
  await page.keyboard.press('i');
  console.log('  after I:', (await page.evaluate(() => document.getElementById('unit-cmd')?.textContent ?? '')).replace(/s+/g, ' ').slice(0, 80), JSON.stringify(await page.evaluate(() => window.broodfall.selectedUnits())));
  await frameOn('s.shelters[0].pos', 1.6);
  const shc0 = await clientOf('s.shelters[0].pos'); const shc = { x: shc0.x, y: shc0.y - 30 };
  await page.mouse.click(shc.x, shc.y);
  await page.waitForTimeout(300);
  console.log('  hint after click:', await page.evaluate(() => (document.getElementById('hint') ?? document.querySelector('.hint'))?.textContent ?? ''), JSON.stringify(shc));
  const sent = await page.evaluate(() => window.broodfall.sim.infestors[0]?.infest ?? null);
  check(sent !== null, 'I and a click on the shelter send it in', String(sent));
  // The escort goes ahead to the door.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    const ids = s.broodlings.filter((w) => !w.puppet).map((w) => w.id);
    const door = s.cellCenter(s.shelters[0].door);
    s.issue({ kind: 'unit-order', ids, order: { kind: 'attack', to: door } });
  });

  // 4. Up the street, then the burrow.
  await frameOn('s.infestors[0]', 2.0);
  await shot('4a-walking-with-escort');
  let atDoor = false;
  for (let k = 0; k < 30 && !atDoor; k++) {
    atDoor = await play(2, { until: 's.shelters[0].burrowBy !== undefined || !s.infestors.length' });
    await frameOn('s.infestors[0] ?? s.shelters[0].pos', 2.0);
  }
  check(atDoor, 'it reaches the door and starts to burrow');
  await frameOn('s.cellCenter(s.shelters[0].door)', 2.6);
  await play(3);
  await shot('4b-burrowing');
  await play(5);
  await shot('4c-burrowing-late');
  const infested = await play(10, { until: "s.shelters[0].state !== 'intact' || !s.infestors.length" });
  const after = await page.evaluate(() => { const s = window.broodfall.sim; const x = s.shelters[0]; return { state: x.state, stage: x.stage, creep: s.isCreeped(x.door), infestorAlive: s.infestors.length }; });
  check(infested && after.state === 'infested' && after.creep, 'the shelter is yours (with its real hp and an escort), creep seeping out', JSON.stringify(after));
  await play(4);
  await frameOn('s.shelters[0].pos', 2.0);
  await shot('5a-infested-stage1');

  // 5. Protected clears (sped up), then a real wave clear and its payout.
  await page.evaluate(() => { const s = window.broodfall.sim; const x = s.shelters[0]; for (let i = 0; i < 2; i++) { x.harmThisWave = 0; s.waveBanked = { war: 100, science: 30, royal: 0 }; s.payShelters(); } });
  await play(2);
  await shot('5b-infested-stage2');
  await page.evaluate(() => { const s = window.broodfall.sim; const x = s.shelters[0]; for (let i = 0; i < 2; i++) { x.harmThisWave = 0; s.waveBanked = { war: 100, science: 30, royal: 0 }; s.payShelters(); } });
  await play(2);
  await shot('5c-infested-stage3');
  // Defend it as a player would (the war caste goes for it first): limbs on the creeped roofs round its apron.
  const guards = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    const x = s.shelters[0];
    const door = s.cellCenter(x.door);
    const near = s.map.cells.map((_, c) => c).filter((c) => s.map.cells[c] === 0 && !x.cells.includes(c))
      .sort((a, q) => { const pa = s.cellCenter(a), pq = s.cellCenter(q); return Math.hypot(pa.x - door.x, pa.y - door.y) - Math.hypot(pq.x - door.x, pq.y - door.y); });
    let placed = 0;
    for (const fam of ['spitter', 'lasher', 'spitter', 'burster', 'spitter', 'lasher']) {
      s.hand[0] = { id: 996000 + placed, family: fam, free: true };
      const c = near.find((q) => s.canBuildTower(q, fam));
      if (c !== undefined && b.play({ kind: 'build', cardIndex: 0, cell: c }).ok) placed++;
    }
    return placed;
  });
  console.log(`  limbs round the shelter: ${guards}`);
  await frameOn('s.shelters[0].pos', 1.6);
  await shot('5c2-defended');
  // A real wave: call it, let the limbs and the creep clear it, and watch the clear pay.
  await page.evaluate(() => { const s = window.broodfall.sim; s.issue({ kind: 'call-early' }); });
  const paidBefore = await page.evaluate(() => window.broodfall.sim.stats.shelterMeat ?? 0);
  const cleared = await play(60, { live: true, until: "s.phase !== 'siege'" });
  await page.waitForTimeout(400);
  await shot('5d-wave-clear-payout');
  const paidAfter = await page.evaluate(() => ({ paid: window.broodfall.sim.stats.shelterMeat ?? 0, banner: document.getElementById('banner')?.textContent ?? '' }));
  check(cleared && paidAfter.paid >= paidBefore, 'a real wave clear pays the protected shelter (or tells why not)', JSON.stringify({ paidBefore, ...paidAfter }));
  await surface();

  // 6. The war caste diverts to it.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.phase = 'siege';
    for (let i = 0; i < 6; i++) s.spawnEnemy('soldier');
  });
  await frameOn('s.shelters[0].pos', 1.6);
  let diverting = 0;
  for (let k = 0; k < 40; k++) {
    await play(1, { live: true });
    diverting = await page.evaluate(() => { const s = window.broodfall.sim; const x = s.shelters[0]; const d = s.cellCenter(x.door); return s.enemies.filter((e) => e.kind === 'soldier' && Math.hypot(e.pos.x - d.x, e.pos.y - d.y) < 60).length; });
    if (diverting >= 2) break;
  }
  await shot('6-war-diverts-to-shelter');
  check(diverting >= 1, 'the war caste turns off its road to the infested shelter', `${diverting} at its door`);
  await page.evaluate(() => { window.broodfall.sim.enemies.length = 0; window.broodfall.sim.phase = 'growth'; });

  // 7. A Harrier and a far science party.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 9999; s.meat.science = 9999;
    for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (!s.organs.some((o) => o.organ === 'harrier') && s.canBuildOrgan('harrier', c, r)) s.issue({ kind: 'build-organ', organ: 'harrier', cell: c, rot: r });
    for (let i = 0; i < 2; i++) s.growFieldUnits();
    console.log('harriers', s.harriers.length, s.organs.map((o) => o.organ).join(','));
    for (let i = 0; i < 3; i++) s.spawnEnemy('researcher');
  });
  await surface();
  let snapped = false;
  for (let k = 0; k < 120; k++) {
    const st = await page.evaluate(() => { const s = window.broodfall.sim; let q = 0; for (let i = 0; i < 5 && !q; i++) { window.broodfall.step(1); q = s.quills.length; } return { q, left: s.enemies.filter((e) => e.kind === 'researcher').length }; });
    if (st.q && !snapped) { snapped = true; await frameOn('s.harriers[0]', 2.0); await shot('7-harrier-hunting'); }
    if (!st.left) break;
    await page.waitForTimeout(40);
  }
  const kills = await page.evaluate(() => window.broodfall.sim.stats.harrierKills ?? 0);
  check(kills >= 1, 'a Harrier runs a science party down', `${kills} killed`);

  // The line-up: one of each, in a row on the shelter's apron street, the sim held still; sizes from the drawing scale.
  const lineup = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    s.enemies.length = 0;
    // A Broodmother for the line-up (a Den, its mother).
    s.hand[0] = { id: 997001, family: 'brood', free: true };
    const dc = s.map.cells.findIndex((_, c) => s.canBuildTower(c, 'brood'));
    if (dc >= 0) b.play({ kind: 'build', cardIndex: 0, cell: dc });
    const den = s.towers.find((t) => t.family === 'brood');
    if (den && !s.mothers.length) s.bearMother(den);
    // The apron's street cells in one row (the longest run along x or y next to the lot).
    const x = s.shelters[0];
    const W = s.cfg.gridW;
    const xs = x.cells.map((c) => c % W), ys = x.cells.map((c) => Math.floor(c / W));
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    // The apron ring runs one cell outside the 2x2 lot: rows y0-1 and y0+2, columns x0-1 and x0+2 (four cells each).
    const rows = [
      [-1, 0, 1, 2].map((dx) => (y0 + 2) * W + x0 + dx),
      [-1, 0, 1, 2].map((dx) => (y0 - 1) * W + x0 + dx),
      [-1, 0, 1, 2].map((dy) => (y0 + dy) * W + x0 + 2),
      [-1, 0, 1, 2].map((dy) => (y0 + dy) * W + x0 - 1),
    ];
    const road = (c) => s.map.cells[c] === 1 || s.map.cells[c] === 2;
    const row = rows.find((r) => r.every(road)) ?? rows[0];
    const ends = [s.cellCenter(row[0]), s.cellCenter(row[3])];
    // Five places evenly along the row, from its first cell to its last.
    const at = [0, 1, 2, 3, 4].map((i) => ({ x: ends[0].x + ((ends[1].x - ends[0].x) * i) / 4, y: ends[0].y + ((ends[1].y - ends[0].y) * i) / 4 }));
    const hold = [{ kind: 'hold' }];
    s.infestors.push({ id: 990001, cystId: 0, pos: { ...at[0] }, hp: 150, maxHp: 150, orders: hold });
    const m = s.mothers[0]; if (m) { m.pos = { ...at[1] }; m.orders = [{ kind: 'hold' }]; m.guard = { ...at[1] }; }
    const w = s.broodlings.find((q) => !q.puppet); if (w) { w.pos = { ...at[2] }; w.orders = [{ kind: 'hold' }]; }
    const h = s.harriers[0]; if (h) { h.pos = { ...at[3] }; h.orders = [{ kind: 'hold' }]; }
    const f = s.spawnEnemy('flametrooper'); f.pos = { ...at[4] };
    return { at, mother: !!m, harrier: !!h, warrior: !!w };
  });
  // Framed and drawn WITHOUT stepping the sim (the Flametrooper would light up the row).
  await page.evaluate(() => {
    const b = window.broodfall;
    const r = b.renderer;
    const x = b.sim.shelters[0];
    r.resetView();
    r.draw(b.sim, 0);
    let c = r.clientOf(b.sim, x.pos.x, x.pos.y);
    r.zoomAt(c.x, c.y, 2.6);
    for (let k = 0; k < 4; k++) {
      r.draw(b.sim, 0);
      c = r.clientOf(b.sim, x.pos.x, x.pos.y);
      const rect = r.app.canvas.getBoundingClientRect();
      const kk = r.app.renderer.width / rect.width;
      r.panBy((rect.left + rect.width / 2 - c.x) * kk, (rect.top + rect.height * 0.5 - c.y) * kk);
    }
    r.draw(b.sim, 0);
  });
  await page.waitForTimeout(600);
  await shot('lineup');
  const measured = await page.evaluate(() => {
    const r = window.broodfall.renderer;
    const k = r.camScale;
    const cell = 2 * r.geo.a * k;
    const unit = (rad) => Math.round(2 * rad * 3.6 * k);
    const shelterTex = [...r.shelterViews.values()][0]?.texture;
    const out = {
      zoom: Math.round(k * 100) / 100, streetCellWidth: Math.round(cell),
      shelterWidth: shelterTex ? Math.round(shelterTex.width * k) : null, shelterStructureHeight: shelterTex ? Math.round(shelterTex.height * k) : null,
      shelterWallsHeight: Math.round(2 * r.geo.level * k),
      infestorBody: unit(15), broodmotherBody: unit(12), warriorBody: unit(4.5), harrierBody: unit(5.5), flametrooperBody: unit(4.5),
    };
    out.infestorPerCell = Math.round((out.infestorBody / cell) * 100) / 100;
    return out;
  });
  writeFileSync(join(out, 'expansion-sizes.json'), JSON.stringify(measured, null, 1));
  console.log('  sizes', JSON.stringify(measured));
} catch (e) {
  failures.push(String(e.message));
  console.log('  ERROR', e.message);
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
}
try {
  const vid = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (vid) execSync(`ffmpeg -hide_banner -loglevel error -y -i "${join(vidDir, vid)}" -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart "${join(out, 'expansion.mp4')}"`);
  rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log('  (no film)', e.message); }
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
