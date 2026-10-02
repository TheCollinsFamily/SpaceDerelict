/**
 * DOMES IN THE GAME (Collins, Oct 2 2026: "a unit for both the warriors and the science team that gives a shield
 * around it in a dome that takes a certain amount of damage before breaking ... but the catch is it's ineffective
 * against damage from units (who automatically target shield units first)").
 *
 * A war column under an Aegis Deacon's dome walks past four of your Spitters: the shots break on the dome and the
 * soldiers under it come through whole while it holds. Then Harriers are sent in: their quills go straight through,
 * they take the deacon first, and its dome shatters with it. Last, a study party under a Lens Bearer's teal glass.
 * Filmed (notes/screens/2026-10-02/domes.mp4) with stills at each step, checks printed.
 *
 *   node tools/shot-domes.mjs        (starts its own dev server on BROODFALL_PORT, default 5361)
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-02');
const vidDir = join(out, 'domes-video-tmp');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5361);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
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
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, recordVideo: { dir: vidDir, size: { width: 1400, height: 900 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  page error:', e.message));
const play = async (ticks, each = 1, wait = 50) => {
  for (let i = 0; i < ticks; i += each) {
    await page.evaluate((n) => window.broodfall.step(n), each);
    await page.waitForTimeout(wait);
  }
};
try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=42&speed=0&biome=suburb&landing=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });

  // Four Spitters on the roofs by one street, out from the body; the board kept quiet.
  const setup = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    b.step(2);
    const quiet = (n) => { for (let i = 0; i < n; i += 10) { b.step(10); s.enemies.length = 0; } };
    quiet(300);
    s.meat.war = 9999; s.meat.science = 9999;
    const body = s.bodyPoint();
    const W = s.cfg.gridW;
    // A street cell 130-230 px out with the most buildable roof cells within 75 px of it.
    let best = null;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== 1) continue;
      const p = s.cellCenter(c);
      const d = Math.hypot(p.x - body.x, p.y - body.y);
      if (d < 130 || d > 230) continue;
      let n = 0;
      for (let q = 0; q < s.map.cells.length; q++) {
        const qp = s.cellCenter(q);
        if (Math.hypot(qp.x - p.x, qp.y - p.y) <= 75 && s.canBuildTower(q, 'spitter')) n++;
      }
      if (!best || n > best.n) best = { c, p, n };
    }
    if (!best || best.n < 4) return { ok: false, why: 'no street with room for four spitters', best };
    const placed = [];
    for (let q = 0; q < s.map.cells.length && placed.length < 4; q++) {
      const qp = s.cellCenter(q);
      if (Math.hypot(qp.x - best.p.x, qp.y - best.p.y) > 75 || !s.canBuildTower(q, 'spitter')) continue;
      s.hand[0] = { id: 993000 + q, family: 'spitter', free: true };
      if (b.play({ kind: 'build', cardIndex: 0, cell: q }).ok) placed.push(q);
    }
    // The column: a deacon and five soldiers, a little up the street from the guns (further from the body).
    let from = null;
    for (let c = 0; c < s.map.cells.length && !from; c++) {
      if (s.map.cells[c] !== 1) continue;
      const q = s.cellCenter(c);
      const dq = Math.hypot(q.x - best.p.x, q.y - best.p.y);
      if (dq > 70 && dq < 110 && Math.hypot(q.x - body.x, q.y - body.y) > Math.hypot(best.p.x - body.x, best.p.y - body.y)) from = q;
    }
    if (!from) return { ok: false, why: 'no spot up the street' };
    s.enemies.length = 0;
    const a = s.spawnEnemy('aegis', s.gates[0]); a.pos = { x: from.x, y: from.y };
    const col = [a];
    for (let i = 0; i < 5; i++) { const e = s.spawnEnemy('soldier', s.gates[0]); e.pos = { x: from.x + (i % 3 - 1) * 9, y: from.y + (i < 3 ? -8 : 8) }; col.push(e); }
    s.enemies = s.enemies.filter((e) => col.includes(e));
    b.step(1);
    b.renderer.resetView?.();
    const mid = { x: (best.p.x + from.x) / 2, y: (best.p.y + from.y) / 2 };
    const cc = b.renderer.clientOf(s, mid.x, mid.y);
    b.renderer.zoomAt(cc.x, cc.y, 2.2);
    W;
    return { ok: true, spitters: placed.length, deacon: a.id, street: best.c, pool: a.domeHp };
  });
  check(setup.ok, 'set up: four spitters by a street, a domed column up it', JSON.stringify(setup));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, 'domes-1-column.png') });

  // The guns fire; the dome soaks it; the soldiers under it come through whole while it holds.
  let soaked = 0;
  let shot2 = false;
  for (let k = 0; k < 90; k++) {
    await play(1, 1, 45);
    const st = await page.evaluate(() => {
      const s = window.broodfall.sim;
      const a = s.enemies.find((e) => e.kind === 'aegis');
      const so = s.enemies.filter((e) => e.kind === 'soldier');
      return { dome: a?.domeHp ?? 0, max: a?.domeMax ?? 0, soaked: s.stats.domeSoaked ?? 0, hurt: so.filter((e) => e.hp < e.maxHp).length, n: so.length, drawn: window.broodfall.domes() };
    });
    soaked = st.soaked;
    if (!shot2 && st.soaked > 40) { await page.screenshot({ path: join(out, 'domes-2-soaking.png') }); shot2 = true; check(st.hurt === 0 && st.drawn.standing >= 1, 'while the dome holds, the soldiers under it take nothing; the dome is drawn', JSON.stringify(st)); }
    if (st.dome < st.max * 0.3 && st.dome > 0) { await page.screenshot({ path: join(out, 'domes-3-cracking.png') }); break; }
  }
  check(soaked > 0, 'the spitters\' fire breaks on the dome', `soaked ${Math.round(soaked)}`);

  // Harriers sent in: their quills pass through the dome and they take the deacon first.
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    const a = s.enemies.find((e) => e.kind === 'aegis');
    const at = a ? a.pos : s.bodyPoint();
    for (let i = 0; i < 3; i++) s.harriers.push({ id: 994000 + i, glandId: -1, pos: { x: at.x - 70 + i * 6, y: at.y + 30 - i * 8 }, hp: 70, maxHp: 70, orders: [{ kind: 'hold' }], cooldown: 0 });
  });
  let firstKill = null;
  let shatterSeen = false;
  for (let k = 0; k < 120; k++) {
    await play(1, 1, 45);
    const st = await page.evaluate(() => {
      const s = window.broodfall.sim;
      return { deacon: s.enemies.some((e) => e.kind === 'aegis'), soldiers: s.enemies.filter((e) => e.kind === 'soldier').length, shards: window.broodfall.domes().shards };
    });
    if (st.shards > 0) shatterSeen = true;
    if (!st.deacon && firstKill === null) { firstKill = st.soldiers; await page.waitForTimeout(80); await page.screenshot({ path: join(out, 'domes-4-cracked.png') }); }
    if (!st.deacon && k > 20) break;
  }
  check(firstKill !== null, 'the Harriers killed the deacon', `soldiers still standing when it fell: ${firstKill}`);
  check(firstKill !== null && firstKill >= 3, 'they took the deacon FIRST (most of its column still standing)', `${firstKill}`);
  check(shatterSeen, 'its dome shattered (shards drawn)');
  await play(30, 1, 45);
  await page.screenshot({ path: join(out, 'domes-5-after.png') });

  // A study party under a Lens Bearer's teal glass.
  const lens = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    s.harriers.length = 0;
    s.enemies.length = 0;
    const body = s.bodyPoint();
    let at = null;
    for (let c = 0; c < s.map.cells.length && !at; c++) {
      if (s.map.cells[c] !== 1) continue;
      const q = s.cellCenter(c);
      const d = Math.hypot(q.x - body.x, q.y - body.y);
      if (d > 160 && d < 240) at = q;
    }
    if (!at) return { ok: false };
    const l = s.spawnEnemy('lensbearer', s.gates[0]); l.pos = { ...at };
    for (let i = 0; i < 3; i++) { const r = s.spawnEnemy('researcher', s.gates[0]); r.pos = { x: at.x + (i - 1) * 10, y: at.y + 6 }; }
    s.enemies = s.enemies.filter((e) => e.kind === 'lensbearer' || e.kind === 'researcher');
    b.step(2);
    const cc = b.renderer.clientOf(s, at.x, at.y);
    b.renderer.zoomAt(cc.x, cc.y, 1.2);
    return { ok: true, drawn: window.broodfall.domes() };
  });
  await play(6, 1, 50);
  await page.screenshot({ path: join(out, 'domes-6-lens.png') });
  check(lens.ok, 'a study party under a Lens Bearer', JSON.stringify(lens));
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
}
// The film: the recorded page, cut to mp4.
try {
  const webm = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
  if (webm) execSync(`ffmpeg -hide_banner -loglevel error -y -i "${join(vidDir, webm)}" -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart "${join(out, 'domes.mp4')}"`);
  rmSync(vidDir, { recursive: true, force: true });
} catch (e) { console.log('  (film not cut: ' + e.message + ')'); }
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
