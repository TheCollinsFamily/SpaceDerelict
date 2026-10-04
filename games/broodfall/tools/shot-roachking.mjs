/**
 * THE ROACH KING ON THE AIR (Oct 1 2026; src/ui/roachKing.ts, src/meta/roachKing.ts, content/roachKing.ts).
 * Its own build (dist-roach), real pages, real clicks; the deployment's outcome forced the way tools/shot-media.mjs
 * forces it. Nothing is spent (YOKE is the scripted one; his clips are baked in public/media/roach/).
 *
 *   A  a campaign two deployments in; the THIRD deployment won → the report → RETURN TO THE SHIP → the
 *      planet's news (skipped) → his first address plays by itself: the INTERCEPTED card with YOKE's band,
 *      every shot (his clip's own voice through the voice bus, the TV-band signal under it, his line set
 *      in type and resolving), his name on the first, the last card; then the ship. Logged as seen: the
 *      next deployment does not play it again. Filmed with its sound: notes/screens/2026-10-01/roach-king-address.mp4
 *   B  every address played straight (the beats' window): one frame of each shot.
 *   C  before the third deployment: nothing of his plays.
 * Screenshots: notes/screens/2026-10-01/roach-*.jpg.
 *
 *   node tools/shot-roachking.mjs [A] [B] [C] [--build]   (served on BROODFALL_PORT, default 5297)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(notes, { recursive: true });
const tmp = join(tmpdir(), 'broodfall-shot-roach');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5297);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
const VIEW = { width: 1280, height: 720 };
const GO = { waitUntil: 'domcontentloaded', timeout: 180000 };
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status) console.warn(r.stderr.slice(0, 400)); return r.status === 0; };
const ROACH = JSON.parse(readFileSync(join(root, 'public', 'media', 'roach', 'roach.json'), 'utf8'));

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
const DIST = process.env.BROODFALL_DIST || 'dist-roach';
function startServer() {
  freePort();
  const env = { ...process.env, BROODFALL_PORT: String(PORT), BROODFALL_DIST: DIST };
  if (process.argv.includes('--build') || !existsSync(join(root, DIST, 'index.html'))) {
    const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], { cwd: root, env, shell: process.platform === 'win32', encoding: 'utf8' });
    if (b.status) throw new Error(`the build failed: ${(b.stderr || b.stdout).slice(-600)}`);
  }
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the server exited early (${code})`)));
  });
}

async function player(browser, name, { record = false } = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, ...(record ? { recordVideo: { dir: join(tmp, name), size: VIEW } } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|rfab/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-media-auto', 'on');
    // His line in type under the picture is a Settings option now (off by default, Oct 4 2026): on, for the checks that read it.
    localStorage.setItem('broodfall-settings', JSON.stringify({ subtitles: true }));
  });
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors, name, opened: Date.now() };
}
async function shot(page, name) {
  const png = join(tmp, `${name}.png`);
  await page.screenshot({ path: png });
  ff(['-i', png, '-q:v', '3', join(notes, `roach-${name}.jpg`)]);
}
async function aboard(page) {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('#newsreel').count()) return;
    if (await page.locator('.cp-scene-card').count()) return;
    const x = page.locator('.cp-icom [data-act="icom-close"]');
    if (await x.count()) await x.click().catch(() => {});
    await sleep(600);
  }
}
const shotNow = (page) => page.evaluate(() => document.getElementById('newsreel')?.dataset.shot ?? null);
async function waitShot(page, id, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await shotNow(page)) === id) return true; if (!(await page.locator('#newsreel').count())) return false; await sleep(120); }
  return false;
}
async function gone(page, ms = 90000) { await page.waitForSelector('#newsreel', { state: 'detached', timeout: ms }).catch(() => {}); return !(await page.locator('#newsreel').count()); }
/** The campaign as saved, changed by `f`. */
const patchCampaign = (page, patch) => page.evaluate((patch) => { const s = JSON.parse(localStorage.getItem('broodfall-campaign')); Object.assign(s, patch); localStorage.setItem('broodfall-campaign', JSON.stringify(s)); }, patch);
async function deploy(page, territory, won) {
  await page.evaluate((t) => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: t, dares: [], objectors: [] })), territory);
  await page.goto(`${URL0}?campaign=run`, GO);
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 180000 });
  await page.waitForTimeout(600);
  await page.evaluate((won) => { const s = window.broodfall.sim; s.stats.kills.militia = 60; s.outcome = won ? 'won' : 'lost'; s.events.push({ kind: won ? 'won' : 'lost' }); window.broodfall.step(1); }, won);
  await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 45000 });
  await page.waitForTimeout(1200);
}
async function record(p) { await p.page.evaluate(() => window.__bfAudio.record()); p.recAt = Date.now(); }
async function film(p, out) {
  const b64 = await p.page.evaluate(() => window.__bfAudio.stop());
  const webm = join(tmp, `${p.name}.webm`);
  writeFileSync(webm, Buffer.from(b64, 'base64'));
  const video = await p.page.video()?.path();
  await p.ctx.close();
  if (!video || !existsSync(video)) return false;
  const offset = Math.max(0, (p.recAt - p.opened) / 1000 - 0.3);
  return ff(['-ss', offset.toFixed(2), '-i', video, '-i', webm, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', join(notes, out)]);
}
const cues = (page) => page.evaluate(() => window.__bfAudio.log.filter((e) => e.played).map((e) => `${e.kind}:${e.id.replace(/^media:.*\/media\//, '')}`));

const server = await startServer();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const allErrors = [];
try {
  if (want('C')) {
    console.log('C  before the third deployment: nothing of his');
    const p = await player(browser, 'C');
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    await patchCampaign(page, { deployments: 1, onboard: undefined });
    await deploy(page, 'harbor', true);
    await page.locator('[data-act="back"]').click();
    // The news may play; skip it, and nothing of his follows.
    for (let i = 0; i < 6; i++) { if (await page.locator('#newsreel').count()) { const rk = await page.locator('#newsreel.rk-broadcast').count(); check(!rk, 'no address of his on the 2nd deployment'); await page.keyboard.press('Escape'); await sleep(800); } else await sleep(500); }
    check(!(await page.evaluate(() => localStorage.getItem('broodfall-roach'))), 'nothing logged');
    allErrors.push(...p.errors);
    await p.ctx.close();
  }

  if (want('A')) {
    console.log('A  the third deployment won → the news → his first address → the ship');
    const p = await player(browser, 'A', { record: true });
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    await patchCampaign(page, { deployments: 2, onboard: undefined });
    await deploy(page, 'harbor', true);
    await record(p);
    await page.locator('[data-act="back"]').click();
    // The planet's news first: skipped.
    // (A cold build loads the news late: keep skipping whatever news is up until his broadcast is.)
    for (let t0 = Date.now(); Date.now() - t0 < 45000;) {
      if (await page.locator('#newsreel.rk-broadcast').count()) break;
      if (await page.locator('#newsreel:not(.rk-broadcast):not(.leaving)').count()) { await sleep(1200); await page.keyboard.press('Escape'); }
      await sleep(300);
    }
    check(await page.locator('#newsreel.rk-broadcast').count() === 1, 'after the news, his address plays by itself');
    await sleep(900);
    await shot(page, 'a1-card');
    const card = await page.locator('.rk-open').innerText();
    check(/INTERCEPTED/.test(card) && /AN ADDRESS TO THE NATION/.test(card), 'the card: INTERCEPTED, the address\'s title');
    check(/RENDERED BY YOKE/.test(card), 'YOKE\'s band on the card');
    const shots = ['rk-a1', 'rk-a2', 'rk-a3', 'rk-a4'];
    for (const [k, id] of shots.entries()) {
      check(await waitShot(page, id), `shot ${k + 1}: ${id}`);
      await sleep(2600);
      await shot(page, `a${k + 2}-${id}`);
      const sub = await page.locator('.rk-sub').innerText().catch(() => '');
      check(/The Roach King/i.test(sub) && sub.length > 20, `his line set in type: "${sub.replace(/\s+/g, ' ').slice(0, 70)}…"`);
      if (k === 0) check(await page.locator('.rk-lower.on').count() === 1, 'his name in the lower third on the first shot');
      const playing = await page.evaluate(() => { const v = document.querySelector('#newsreel video.rk-v.on'); return v ? { t: v.currentTime, muted: v.muted, paused: v.paused } : null; });
      check(!!playing && !playing.paused && !playing.muted && playing.t > 0.5, `the clip plays with its sound (t=${playing?.t?.toFixed(1)})`);
    }
    check(await waitShot(page, 'end'), 'the last card');
    await sleep(900);
    await shot(page, 'a6-end');
    check(await gone(page), 'it ends by itself');
    const c = await cues(page);
    check(c.some((x) => x.startsWith('voice:') && x.includes('roach/rk-a1')), 'his voice went through the voice bus');
    check(c.some((x) => x === 'voice:signal:roach'), 'the TV-band signal under his line (YOKE rendering it)');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-roach')));
    check(log?.seen?.includes('rk-address'), 'logged as seen');
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 15000 }).catch(() => {});
    check(await page.locator('#campaign:not(.hidden)').count() === 1, 'then the ship');
    await sleep(1500);
    allErrors.push(...p.errors);
    check(await film(p, 'roach-king-address.mp4'), 'filmed with its sound: roach-king-address.mp4');
  }

  if (want('B')) {
    console.log('B  every address, straight');
    const p = await player(browser, 'B');
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    const ids = await page.evaluate(() => window.__bfRoach.load().then(() => true));
    const addresses = ['rk-draft', 'rk-counter', 'rk-delegation', 'rk-faithful', 'rk-institute', 'rk-stand', 'rk-offline'];
    for (const id of addresses) {
      const ok = await page.evaluate((id) => window.__bfRoach.start(id), id);
      if (!ok) { check(false, `${id}: its clips are baked`); continue; }
      await page.waitForSelector('#newsreel.rk-broadcast', { timeout: 10000 });
      const shotsOf = Object.keys(ROACH.clips).filter((c) => c.startsWith(id.replace('rk-', 'rk-').slice(0, 4)));
      // One frame from the middle of the address's second shot (or its first).
      await sleep(900);
      await shot(page, `b-${id}-card`);
      const first = await page.evaluate(() => document.getElementById('newsreel')?.dataset.shot);
      let seen = 0;
      for (let k = 0; k < 6; k++) {
        await page.waitForFunction((prev) => document.getElementById('newsreel')?.dataset.shot !== prev, first, { timeout: 15000 }).catch(() => {});
        const s = await shotNow(page);
        if (!s || s === 'end') break;
        seen++;
        await sleep(2500);
        await shot(page, `b-${s}`);
        await page.waitForFunction((cur) => document.getElementById('newsreel')?.dataset.shot !== cur, s, { timeout: 15000 }).catch(() => {});
        if ((await shotNow(page)) === 'end' || !(await page.locator('#newsreel').count())) break;
      }
      check(seen > 0, `${id}: its shots played (${seen})`);
      await page.keyboard.press('Escape');
      await gone(page, 5000);
      void shotsOf;
    }
    allErrors.push(...p.errors);
    await p.ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
check(allErrors.length === 0, `no page errors${allErrors.length ? `: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
