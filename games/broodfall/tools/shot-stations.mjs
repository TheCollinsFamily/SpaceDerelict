/**
 * SCIENCE FORWARD BASES AND CREEP CARE, in the browser (Collins, Oct 2 2026: "give the science faction units that can
 * build spawning locations, and even their own towers if you don't deal with them, and then you need to mount attacks
 * on these areas"; "the builders will need a bit more thought ... a spot on the side of any lane"; "the creep healing
 * and making faster is great"). On a real board, the waves held back so the story reads:
 *   1. an engineer is sent with its study party (the banner names it);           stations-1-engineer-out.png
 *   2. it walks the quiet streets round your guns to a lot beside a lane;          stations-2-walking.png
 *   3. the station stands at once, weak, and is built up (the filling ring);       stations-3-building.png
 *   4. built: it stands at full strength, its engineer at the door;               stations-4-standing.png
 *   5. it grows: a turret beside it (stage 2), then fortified with a second;       stations-5-turret.png, -6-fortified.png
 *   6. it sends a study party from close by;                                     stations-7-party.png
 *   7. a second engineer, chased off a half-built station by your strike force;   stations-8-chased-off.png
 *   8. your strike force takes the fortified station down; its wreck lies there;  stations-9-strike.png, -10-wreck.png
 *   9. your hurt units heal on the creep (the rising marks).                       stations-11-creep-care.png
 * The whole beat is filmed (stations.mp4).
 *
 * Usage: node tools/shot-stations.mjs [set] [seed]   (starts its own dev server on 5361)
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
const vidDir = join(out, 'stations-video-tmp');
mkdirSync(out, { recursive: true });
const SET = process.argv[2] || 'suburb';
const SEED = process.argv[3] || '42';
const PORT = Number(process.env.BROODFALL_PORT || 5361);
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
// Banners fade after a few seconds: wait them out (the clock is paused, so nothing moves meanwhile).
const shot = async (name) => { await page.waitForTimeout(4200); await page.screenshot({ path: join(out, `stations-${name}.png`) }); console.log(`  shot  stations-${name}.png`); };
/** Frame the camera on a thing (an expression over the sim), at a zoom. */
const frameOn = async (expr, zoom) => {
  await page.evaluate(([expr, zoom]) => {
    const b = window.broodfall;
    const u = new Function('s', `return ${expr}`)(b.sim);
    if (!u) return;
    b.renderer.resetView?.();
    b.step(1);
    const c = b.renderer.clientOf(b.sim, u.pos.x, u.pos.y);
    b.renderer.zoomAt(c.x, c.y, zoom);
  }, [expr, zoom]);
  await page.waitForTimeout(900);
};
/** Run the clock, holding the waves back: only the forward base, its engineers, their parties and your units live. */
const run = (ticks, keepParties = false) => page.evaluate(([ticks, keepParties]) => {
  const b = window.broodfall;
  const s = b.sim;
  const keep = (e) => ['engineer', 'fieldstation', 'sciturret'].includes(e.kind) || e.escortOf !== undefined || (keepParties && e.kind === 'researcher');
  for (let i = 0; i < ticks; i += 5) {
    b.step(5);
    for (let k = s.enemies.length - 1; k >= 0; k--) if (!keep(s.enemies[k])) s.enemies.splice(k, 1);
  }
}, [ticks, keepParties]);
const state = () => page.evaluate(() => {
  const s = window.broodfall.sim;
  const st = s.enemies.find((e) => e.kind === 'fieldstation');
  const eng = s.enemies.find((e) => e.kind === 'engineer');
  return {
    engineer: eng ? { state: eng.engState, site: eng.siteCell, tends: eng.tendsStation } : null,
    station: st ? { id: st.id, build: st.buildProgress, stage: st.stationStage, hp: Math.round(st.hp), maxHp: Math.round(st.maxHp), cellType: s.map.cells[s.cellAt(st.pos.x, st.pos.y)] } : null,
    turrets: s.enemies.filter((e) => e.kind === 'sciturret').length,
    researchers: s.enemies.filter((e) => e.kind === 'researcher' && e.escortOf === undefined).length,
    wrecks: s.corpses.filter((c) => c.kind === 'fieldstation').length,
  };
});

try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=${SEED}&speed=0&biome=${SET}&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  // A grown board in the quiet; interest high and the run at the wave engineers start; one engineer sent.
  const sent = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    for (let i = 0; i < 900; i += 10) { b.step(10); s.enemies.length = 0; }
    Object.defineProperty(s, 'interest', { get: () => 20, configurable: true });
    s.waveNumber = 4;
    s.phase = 'growth';
    s.phaseElapsed = 0;
    Object.defineProperty(s, 'growthLength', { get: () => 1e9, configurable: true }); // the quiet lasts as long as the beat needs
    s.engineerTimer = 0;
    s.sendEngineers();
    s.engineerTimer = 1e9; // no more but the ones this beat sends
    const e = s.enemies.find((x) => x.kind === 'engineer');
    return e ? { site: e.siteCell, escort: s.enemies.filter((x) => x.escortOf === e.id).length } : null;
  });
  check(!!sent && sent.site >= 0, 'an engineer is sent, with a site', JSON.stringify(sent));
  check((sent?.escort ?? 0) >= 2, 'it travels with its study party', String(sent?.escort));
  await frameOn("s.enemies.find((e) => e.kind === 'engineer')", 3.4);
  await shot('1-engineer-out');

  // It walks to its site.
  let st = await state();
  for (let k = 0; k < 120 && !st.station; k++) {
    await run(k === 0 ? 3 : 10);
    if (k === 1) { await frameOn("s.enemies.find((e) => e.kind === 'engineer')", 3.4); await shot('2-walking'); }
    if (k % 3 === 0) await frameOn("s.enemies.find((e) => e.kind === 'engineer')", 3.4);
    st = await state();
  }
  check(!!st.station, 'it reaches its site and the station stands', JSON.stringify(st));
  check(st.station?.cellType === 0 || st.station?.cellType === 1 || st.station?.cellType === 2, 'on a lot beside a street (or a wide street\'s edge)', String(st.station?.cellType));
  check((st.station?.build ?? 1) < 0.3 && st.station.maxHp < 650 * 0.5, 'weak while it is being built', JSON.stringify(st.station));
  await run(60);
  await frameOn("s.enemies.find((e) => e.kind === 'fieldstation')", 3.6);
  await shot('3-building');
  await run(180);
  st = await state();
  check(st.station?.build === 1 && st.engineer?.state === 'tend', 'built up to full; its engineer tends it', JSON.stringify(st));
  await frameOn("s.enemies.find((e) => e.kind === 'fieldstation')", 3.6);
  await shot('4-standing');

  // It grows: a turret, then fortified with a second.
  await page.evaluate(() => { const s = window.broodfall.sim; s.enemies.find((e) => e.kind === 'fieldstation').stationAge = 70; });
  await run(10);
  st = await state();
  check(st.turrets === 1, 'stage 2: a turret beside it', JSON.stringify(st));
  await frameOn("s.enemies.find((e) => e.kind === 'fieldstation')", 3.6);
  await shot('5-turret');
  await page.evaluate(() => { const s = window.broodfall.sim; s.enemies.find((e) => e.kind === 'fieldstation').stationAge = 150; });
  await run(10);
  st = await state();
  check(st.turrets === 2 && st.station.stage === 3, 'stage 3: fortified, a second turret', JSON.stringify(st));
  await frameOn("s.enemies.find((e) => e.kind === 'fieldstation')", 3.6);
  await shot('6-fortified');

  // It sends a study party from close by.
  await page.evaluate(() => { const s = window.broodfall.sim; s.enemies.find((e) => e.kind === 'fieldstation').stationTimer = 0; });
  await run(15, true);
  st = await state();
  check(st.researchers >= 3, 'a study party sets out from the station', String(st.researchers));
  await frameOn("s.enemies.find((e) => e.kind === 'fieldstation')", 2.0);
  await shot('7-party');
  await page.evaluate(() => { const s = window.broodfall.sim; for (let k = s.enemies.length - 1; k >= 0; k--) if (s.enemies[k].kind === 'researcher' && s.enemies[k].escortOf === undefined) s.enemies.splice(k, 1); });

  // The strike force on the fortified station: it falls; its wreck lies where it stood.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    const st = s.enemies.filter((e) => e.kind === 'fieldstation').sort((a, b) => (b.stationStage ?? 0) - (a.stationStage ?? 0))[0];
    for (let i = 0; i < 8; i++) s.harriers.push({ id: 991000 + i, glandId: -1, pos: { x: st.pos.x - 90 + (i % 4) * 8, y: st.pos.y + 70 + Math.floor(i / 4) * 8 }, hp: 70, maxHp: 70, orders: [{ kind: 'attack', to: { ...st.pos } }], cooldown: 0 });
    window.__strike = st.id;
  });
  await run(40);
  await frameOn('s.enemies.find((e) => e.id === window.__strike) ?? s.harriers[0]', 2.0);
  await shot('9-strike');
  for (let k = 0; k < 80; k++) {
    await run(10);
    if (await page.evaluate(() => !window.broodfall.sim.enemies.some((e) => e.id === window.__strike))) break;
  }
  st = await state();
  check(st.wrecks >= 1, 'the strike force destroys it; its wreck lies there', JSON.stringify(st));
  await frameOn("s.corpses.find((c) => c.kind === 'fieldstation')", 2.4);
  await shot('10-wreck');

  // A second engineer founds a second station; your strike force reaches it half-built and it runs.
  const second = await page.evaluate(() => {
    const s = window.broodfall.sim;
    // The wreck is digested and the first engineer gone home (the beat moves on): the board is open for a new station.
    s.corpses.splice(0, s.corpses.length, ...s.corpses.filter((c) => c.kind !== 'fieldstation'));
    for (let k = s.enemies.length - 1; k >= 0; k--) if (s.enemies[k].kind === 'engineer') s.enemies.splice(k, 1);
    // The strike force goes home first (a Harrier hunts any science unit it sees: it would catch the engineer at once).
    s.harriers.splice(0, s.harriers.length);
    s.engineerTimer = 0;
    s.sendEngineers();
    s.engineerTimer = 1e9;
    const e = s.enemies.filter((x) => x.kind === 'engineer').find((x) => x.siteCell !== undefined);
    return e ? e.id : null;
  });
  check(second !== null, 'a second engineer sets out to found another station', String(second));
  let second2 = null;
  for (let k = 0; k < 150 && second !== null; k++) {
    await run(10);
    second2 = await page.evaluate((id) => {
      const s = window.broodfall.sim;
      const e = s.enemies.find((x) => x.id === id);
      return e ? { state: e.engState, tends: e.tendsStation } : null;
    }, second);
    if (!second2 || second2.state === 'build') break;
  }
  if (second2?.state === 'build') {
    await run(20);
    const chased = await page.evaluate((id) => {
      const s = window.broodfall.sim;
      const e = s.enemies.find((x) => x.id === id);
      const st = s.enemies.find((x) => x.id === e.tendsStation);
      for (let i = 0; i < 4; i++) s.harriers.push({ id: 990000 + i, glandId: -1, pos: { x: st.pos.x + 30 + i * 6, y: st.pos.y + 34 }, hp: 70, maxHp: 70, orders: [{ kind: 'attack', to: { ...st.pos } }], cooldown: 0 });
      return st.id;
    }, second);
    await run(4);
    const fled = await page.evaluate((id) => window.broodfall.sim.enemies.find((x) => x.id === id)?.engState ?? 'gone', second);
    check(fled === 'flee' || fled === 'gone', 'chased off a half-built station by your strike force', fled);
    await frameOn(`s.enemies.find((e) => e.id === ${chased}) ?? s.harriers[0]`, 2.2);
    await shot('8-chased-off');
    await run(80);
  } else check(false, 'the second engineer began a build', JSON.stringify(second2));

  // Your hurt units heal on the creep (the rising marks).
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    const c = s.cellCenter(s.map.coreCell);
    for (let i = 0; i < 4; i++) s.harriers.push({ id: 992000 + i, glandId: -1, pos: { x: c.x + 40 + i * 12, y: c.y + 30 }, hp: 20, maxHp: 70, orders: [{ kind: 'hold' }], cooldown: 0 });
  });
  await run(3);
  const healing = await page.evaluate(() => window.broodfall.sim.harriers.filter((h) => h.id >= 992000).map((h) => Math.round(h.hp)));
  check(healing.every((hp) => hp > 20), 'your units on creep heal', JSON.stringify(healing));
  await frameOn('s.harriers.find((h) => h.id >= 992000)', 3.0);
  await shot('11-creep-care');
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
}
try {
  const webm = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (webm) {
    execSync(`ffmpeg -loglevel error -y -i "${join(vidDir, webm)}" -vf "fps=24,scale=1120:-2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${join(out, 'stations.mp4')}"`);
    console.log(`  film: ${join(out, 'stations.mp4')}`);
  }
  rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log('  film failed:', e.message); }
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
