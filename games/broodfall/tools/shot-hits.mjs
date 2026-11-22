/**
 * THE HIVE'S BLOWS, SEEN AND HEARD (Nov 22 2026). Collins, playtesting: "there is no sound effect or hit effect
 * when an enemy unit hits my base and presumably none when science team members are hitting limbs".
 *
 * On the DEV server (what `npm start` runs), in a real page that may not play sound until it is clicked (the
 * click is real), on the iso board:
 *   1. stills, the blow frozen at the moment it lands (`broodfall.hits(true)`): soldiers biting the core; a shell
 *      landing on it (heavy); a researcher of the science caste cutting a limb out; a soldier chewing a limb;
 *      the core struck again with Reduce flashes on;
 *   2. a live swarm (soldiers and skitterlings round the core, researchers on the limbs) for ten seconds, filmed
 *      with the game's own mixed sound recorded under it.
 * Checks: the events come and the renderer shows them (flinch, splats), and the core-hit / limb-hit sounds are
 * PLAYED by the engine (window.__bfAudio.log), throttled (some dropped by their gap in a swarm), and the effects
 * bus is not silent after a blow.
 *
 *   node tools/shot-hits.mjs        (its own dev server on BROODFALL_PORT, default 5341; it never kills a server it did not start)
 * Out: notes/screens/2026-11-22/hits-*.jpg, hits-swarm.mp4 (with its sound), hits-log.json
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-11-22');
const tmp = join(here, 'screenshots', 'hits');
mkdirSync(notes, { recursive: true });
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5341);
const VIEW = { width: 1600, height: 1000 };
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function busy() {
  try { return execSync('netstat -ano', { encoding: 'utf8' }).split(String.fromCharCode(10)).some((l) => l.includes(`:${PORT} `) && l.includes('LISTENING')); } catch { return false; }
}
function startDev() {
  if (busy()) throw new Error(`port ${PORT} is in use by another server: pick another BROODFALL_PORT`);
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT) },
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}
function stopDev(child) {
  if (!child) return;
  try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { /* gone */ }
}
const ff = (argv) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv]).status === 0;

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const log = {};
try {
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: tmp, size: VIEW } });
  const opened = Date.now();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|rfab-api/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted', v: 2 }));
  });
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=424242&speed=0&directive=hold`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__bfBooted && window.broodfall && document.getElementById('boot')?.classList.contains('hidden'), null, { timeout: 90000 });
  await sleep(2500);
  check(await page.evaluate(() => window.broodfall.view() === 'iso'), 'the iso board is up');
  const canvas = page.locator('#stage canvas');
  const b = await canvas.boundingBox();
  // A real click unlocks the sound, as for a player (on the board's edge, where nothing is).
  await page.mouse.click(b.x + 30, b.y + b.height - 30);
  await sleep(800);
  const st = await page.evaluate(() => window.__bfAudio.state());
  check(st.context === 'running' && st.manifest, `the sound is unlocked by the click (${st.context}, manifest ${st.manifest})`);

  // Limbs round the core, where the hive comes (as tools/shot-audio.mjs grows them).
  const grown = await page.evaluate(() => {
    const b = window.broodfall;
    b.sim.meat.war += 600;
    const d = (c) => { const p = b.sim.cellCenter(c); return Math.hypot(p.x - b.sim.core.x, p.y - b.sim.core.y); };
    const cells = b.buildableCells(3000).sort((x, y) => d(x) - d(y));
    let n = 0;
    for (let tries = 0; tries < 14 && n < 5; tries++) {
      let any = false;
      for (let i = 0; i < b.sim.hand.length && n < 5; i++) {
        const fam = b.sim.hand[i].family;
        if (['spine', 'mire', 'net', 'tangler'].includes(fam)) continue;
        for (const cell of cells) {
          const facing = b.sim.facingTowardGate(b.sim.cellCenter(cell));
          if (!b.sim.groundFor(cell, fam, facing)) continue;
          if (b.play({ kind: 'build', cardIndex: i, cell, facing }).ok) { n++; any = true; break; }
        }
      }
      if (!any) b.play({ kind: 'discard', cardIndex: 0 });
    }
    b.step(20);
    return n;
  });
  check(grown >= 2, `limbs grown round the core (${grown})`);

  /** The view close on a world point, in the middle of the frame (as tools/shot-core.mjs frames the core). */
  const closeOn = async (wx, wy, zoom) => {
    await page.keyboard.press('Home');
    await sleep(300);
    const where = async () => {
      const at = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [wx, wy]);
      return { x: b.x + (at.x / at.vw) * b.width, y: b.y + (at.y / at.vh) * b.height };
    };
    let p = await where();
    await page.mouse.move(p.x, p.y);
    for (let i = 0; i < zoom; i++) await page.mouse.wheel(0, -240);
    await sleep(600);
    p = await where();
    await page.keyboard.down('Shift');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height * 0.55, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await sleep(500);
  };
  const shot = async (name) => {
    const png = join(tmp, `${name}.png`);
    await sleep(250);
    await canvas.screenshot({ path: png });
    const jpg = join(notes, `${name}.jpg`);
    ff(['-i', png, '-q:v', '3', jpg]);
    console.log(`  shot  ${jpg}`);
  };
  /** Tick one step at a time until a blow of this kind is shown, then hold it there. */
  const strike = (kind, stage) => page.evaluate(async ([kind, stage]) => {
    const B = window.broodfall;
    const s = B.sim;
    const h0 = B.hits(false)[kind];
    const made = new Function('s', 'B', stage)(s, B);
    for (let i = 0; i < 200; i++) {
      if (typeof made === 'function') made();
      B.step(1);
      if (B.hits()[kind] > h0) { B.hits(true); return { ok: true, ticks: i + 1, hits: B.hits() }; }
    }
    return { ok: false, hits: B.hits() };
  }, [kind, stage]);
  const release = () => page.evaluate(() => { window.broodfall.hits(false); });
  /** Clear the board of the hive between stills. */
  const clearHive = () => page.evaluate(() => { const s = window.broodfall.sim; s.enemies.length = 0; s.shells.length = 0; window.broodfall.step(1); });

  const core = await page.evaluate(() => ({ ...window.broodfall.sim.core }));
  await closeOn(core.x, core.y, 5);
  await shot('hits-01-core-before');

  // 1. Soldiers bite the core, from the east.
  let r = await strike('core', `
    const es = [0, 1, 2].map((k) => { const e = s.spawnEnemy('soldier', s.gates[0]); e.pos = { x: s.core.x + 38, y: s.core.y - 14 + k * 14 }; return e; });
    return () => es.forEach((e, k) => { if (s.enemies.includes(e)) { e.pos = { x: s.core.x + 38, y: s.core.y - 14 + k * 14 }; } });`);
  check(r.ok, `soldiers bite the core: a core-hit shown after ${r.ticks} ticks (flinch ${r.hits.coreNow.toFixed(2)}, splats ${r.hits.splats})`);
  await shot('hits-02-core-bitten');
  await release();
  await clearHive();

  // 2. A shell lands on the core (heavy).
  r = await strike('core', `
    s.shells.push({ id: 900001, from: { x: s.core.x - 300, y: s.core.y + 120 }, to: { ...s.core }, flight: 0.3, ttl: 0.15, damage: 45, aoe: 20, side: 'hive' });`);
  check(r.ok, `a shell lands on the core: a heavy core-hit shown (flinch ${r.hits.coreNow.toFixed(2)})`);
  await shot('hits-03-core-shelled');
  await release();
  await clearHive();

  // 3. A researcher (the science caste) cuts a limb out.
  const limb = await page.evaluate(() => { const s = window.broodfall.sim; const t = [...s.towers].sort((a, b) => Math.hypot(a.pos.x - s.core.x, a.pos.y - s.core.y) - Math.hypot(b.pos.x - s.core.x, b.pos.y - s.core.y))[0]; return { id: t.id, x: t.pos.x, y: t.pos.y, family: t.family }; });
  await closeOn(limb.x, limb.y, 6);
  await shot('hits-04-limb-before');
  r = await strike('limb', `
    const t = s.towers.find((x) => x.id === ${limb.id});
    t.shield = 0;
    const e = s.spawnEnemy('researcher', s.gates[0]);
    return () => { if (s.enemies.includes(e)) { e.pos = { x: t.pos.x + 9, y: t.pos.y + 4 }; e.extractId = t.id; } };`);
  check(r.ok, `a researcher cuts into the ${limb.family}: a limb-hit shown (flinch ${(r.hits.limbsNow[0]?.f ?? 0).toFixed(2)})`);
  await shot('hits-05-limb-researcher');
  await release();
  await clearHive();

  // 4. A soldier chews the limb.
  r = await strike('limb', `
    const t = s.towers.find((x) => x.id === ${limb.id});
    t.hp = t.maxHp;
    const e = s.spawnEnemy('elite', s.gates[0]);
    return () => { if (s.enemies.includes(e)) { e.pos = { x: t.pos.x - 14, y: t.pos.y + 6 }; e.targetId = t.id; e.targetIsOrgan = false; } };`);
  check(r.ok, `an elite chews the ${limb.family}: a limb-hit shown`);
  await shot('hits-06-limb-chewed');
  await release();
  await clearHive();

  // 5. Reduce flashes: the core struck again (no light added, a soft tint; no glowing blast).
  await page.evaluate(async () => { const m = await import('/src/meta/settings.ts'); m.CALM.flashes = true; });
  await closeOn(core.x, core.y, 5);
  r = await strike('core', `
    s.shells.push({ id: 900002, from: { x: s.core.x + 300, y: s.core.y + 120 }, to: { ...s.core }, flight: 0.3, ttl: 0.15, damage: 45, aoe: 20, side: 'hive' });`);
  check(r.ok, 'Reduce flashes: the core still reacts');
  await shot('hits-07-core-reduce-flashes');
  await release();
  await clearHive();
  await page.evaluate(async () => { const m = await import('/src/meta/settings.ts'); m.CALM.flashes = false; });

  // ---- the live swarm, filmed with its sound
  await closeOn(core.x, core.y, 4);
  await page.evaluate(() => { window.__bfAudio.log.length = 0; });
  const recOk = await page.evaluate(() => window.__bfAudio.record());
  const recAt = Date.now();
  check(recOk, 'the mix is recorded');
  await page.evaluate(() => {
    const B = window.broodfall;
    const s = B.sim;
    for (const t of s.towers) { t.hp = t.maxHp * 3; t.maxHp *= 3; t.shield = 0; }
    s.coreHp = s.coreMaxHp * 5; // it must live through the beat
    for (let k = 0; k < 10; k++) {
      const e = s.spawnEnemy(k % 3 === 0 ? 'elite' : k % 3 === 1 ? 'soldier' : 'skitterling', s.gates[0]);
      const a = (k / 10) * Math.PI * 2;
      e.pos = { x: s.core.x + Math.cos(a) * 40, y: s.core.y + Math.sin(a) * 40 };
      e.hp *= 20;
    }
    for (const t of s.towers.slice(0, 3)) { const e = s.spawnEnemy('researcher', s.gates[0]); e.pos = { x: t.pos.x + 9, y: t.pos.y + 4 }; e.extractId = t.id; e.hp *= 20; }
    window.__swarm = window.setInterval(() => {
      for (const e of s.enemies) if (e.kind === 'researcher' && e.extractId !== undefined) { const t = s.towers.find((x) => x.id === e.extractId); if (t) { e.pos = { x: t.pos.x + 9, y: t.pos.y + 4 }; t.hp = Math.max(t.hp, t.maxHp * 0.5); } }
    }, 50);
  });
  await page.locator('#speed-box [data-speed="1"]').click().catch(() => {});
  let meter = -200;
  for (let t = 0; t < 10000; t += 150) { meter = Math.max(meter, await page.evaluate(() => window.__bfAudio.level())); await sleep(150); }
  await shot('hits-08-swarm-live');
  const b64 = await page.evaluate(() => { window.clearInterval(window.__swarm); return window.__bfAudio.stop(); });
  const cues = await page.evaluate(() => window.__bfAudio.log.filter((e) => e.kind === 'sfx' && (e.id === 'core-hit' || e.id === 'limb-hit')));
  const hits = await page.evaluate(() => window.broodfall.hits());
  const count = (id, played) => cues.filter((c) => c.id === id && c.played === played).length;
  log.cues = { coreHitPlayed: count('core-hit', true), coreHitDropped: count('core-hit', false), limbHitPlayed: count('limb-hit', true), limbHitDropped: count('limb-hit', false), why: [...new Set(cues.filter((c) => !c.played).map((c) => c.why))] };
  log.hits = hits;
  log.meterMaxDb = +meter.toFixed(1);
  check(log.cues.coreHitPlayed >= 5, `the core's thud PLAYED in the swarm: ${log.cues.coreHitPlayed} times in 10 s (${log.cues.coreHitDropped} dropped by ${log.cues.why.join('/') || '-'})`);
  check(log.cues.coreHitPlayed <= 10000 / 150 + 1, 'and no more often than one every 150 ms');
  check(log.cues.limbHitPlayed >= 3, `the limbs' thwack PLAYED: ${log.cues.limbHitPlayed} times (${log.cues.limbHitDropped} dropped)`);
  check(meter > -45, `the speakers got sound (meter peak ${meter.toFixed(1)} dBFS)`);
  check(errors.length === 0, `nothing logged as an error${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);

  const webm = join(tmp, 'swarm.webm');
  writeFileSync(webm, Buffer.from(b64, 'base64'));
  const video = await page.video()?.path();
  await ctx.close();
  const ogg = join(notes, 'hits-swarm-sound.ogg');
  ff(['-i', webm, '-c:a', 'libopus', '-b:a', '128k', ogg]);
  if (video && existsSync(video)) {
    const mp4 = join(notes, 'hits-swarm.mp4');
    const offset = (recAt - opened) / 1000;
    check(ff(['-ss', offset.toFixed(2), '-i', video, '-i', webm, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', mp4]), `the swarm filmed with its sound: ${mp4}`);
  }
  writeFileSync(join(notes, 'hits-log.json'), JSON.stringify(log, null, 1));
} finally {
  await browser.close();
  stopDev(server);
  rmSync(tmp, { recursive: true, force: true }); // the raw pngs and page video: what is kept is in notes/
}
console.log(failed ? `FAILED: ${failed} checks` : 'hits beat: all checks pass');
process.exit(failed ? 1 : 0);
