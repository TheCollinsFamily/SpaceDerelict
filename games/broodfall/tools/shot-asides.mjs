/**
 * THE LEADERS' ASIDES, HEARD (Oct 1 2026; src/ui/lineVoice.ts, content/media.ts lineKey).
 * Its own build (dist-asides), real pages, real clicks; the deployment's outcome forced the way
 * tools/shot-media.mjs forces it. Nothing is spent (YOKE is the scripted one).
 *
 *   A  allied with the Delegation, a deployment won → the report: the ally's aside (her letter, spelled
 *      out in a field) plays by itself in the Delegate's voice, the line lit; Esc stops it.
 *   B  the ship's Comms room: the inbox lines carry ▶; the Voice's broadcast and the Director's call
 *      each play through the voice bus when clicked, ■ stops; Settings voices at 0 → no ▶ at all.
 * Screenshots: notes/screens/2026-10-01/asides-*.jpg. Filmed with its sound: asides-report.mp4.
 *
 *   node tools/shot-asides.mjs [A] [B] [--build]   (served on BROODFALL_PORT, default 5293)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(notes, { recursive: true });
const tmp = join(tmpdir(), 'broodfall-shot-asides');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5293);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
const VIEW = { width: 1280, height: 720 };
const GO = { waitUntil: 'domcontentloaded', timeout: 180000 };
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status) console.warn(r.stderr.slice(0, 400)); return r.status === 0; };

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
const DIST = process.env.BROODFALL_DIST || 'dist-asides';
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

async function player(browser, name, { record = false, store = {} } = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, ...(record ? { recordVideo: { dir: join(tmp, name), size: VIEW } } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|rfab/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript((store) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-media-auto', 'on');
    // The newsreel after the report is not this beat's: every piece marked seen is not enough, so it is skipped by Esc below.
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  }, store);
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors, name, opened: Date.now() };
}
async function shot(page, name) {
  const png = join(tmp, `${name}.png`);
  await page.screenshot({ path: png });
  ff(['-i', png, '-q:v', '3', join(notes, `asides-${name}.jpg`)]);
}
async function aboard(page) {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('#newsreel').count()) return;
    if (await page.locator('.cp-scene-card').count()) return;
    const x = page.locator('.cp-icom [data-act="icom-close"]');
    if (await x.count()) await x.click().catch(() => {});
    if (await page.locator('#campaign:not(.hidden) .cp-rooms').count() && !(await page.locator('.cp-icom').count())) return;
    await sleep(600);
  }
}
/** The saved campaign, allied (no scene waiting, every beat seen, the desk open): what the beat starts from. */
async function ally(page, factionId, comms = []) {
  await page.evaluate(({ factionId, comms }) => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.faction = factionId;
    s.contacted = ['delegation', 'faithful', 'institute'];
    s.factionSince = s.captures;
    s.pendingScenes = [];
    s.beatsSeen = ['__all__'];
    s.comms = comms;
    if (s.onboard) { s.onboard.deskOpen = true; s.onboard.mission1 = 'done'; }
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
  }, { factionId, comms });
}
const voiceCues = (page) => page.evaluate(() => window.__bfAudio.log.filter((e) => e.played && e.id.includes('/voice/say__')).map((e) => e.id.replace(/^.*\/voice\//, '')));
const lineNow = (page) => page.evaluate(() => window.__bfLine?.now() ?? null);
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

const server = await startServer();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const allErrors = [];
try {
  if (want('A')) {
    console.log('A  allied with the Delegation, a deployment won → the report: her letter heard');
    const p = await player(browser, 'A', { record: true });
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    await ally(page, 'delegation');
    await page.evaluate(() => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: 'harbor', dares: [], objectors: [] })));
    await page.goto(`${URL0}?campaign=run`, GO);
    await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 180000 });
    await page.waitForTimeout(600);
    await record(p);
    await page.evaluate(() => { const s = window.broodfall.sim; s.stats.kills.militia = 60; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 45000 });
    const aside = page.locator('.cp-aside[data-say]');
    check(await aside.count() === 1, 'the report carries the ally\'s aside, marked to be heard');
    await page.waitForFunction(() => window.__bfLine?.now()?.t > 0.5, null, { timeout: 15000 }).catch(() => {});
    const n = await lineNow(page);
    check(!!n && n.key.startsWith('say/delegate-') && !n.paused, `it plays by itself in the Delegate's voice (${n?.key ?? 'nothing'})`);
    check(await page.locator('.cp-aside.said-now .say-btn').count() === 1, 'the line is lit while said, its button shows ■');
    await shot(page, 'a1-report-aside-said');
    await sleep(2500);
    check((await voiceCues(page)).some((c) => c.startsWith('say__delegate-')), 'heard through the voice bus');
    await page.keyboard.press('Escape');
    await sleep(300);
    check(!(await lineNow(page)), 'Esc stops it');
    check(await page.locator('.cp-aside.said-now').count() === 0, 'and the line is no longer lit');
    await page.locator('.cp-aside .say-btn').click();
    await sleep(800);
    check(!!(await lineNow(page)), '▶ plays it again');
    await sleep(3000);
    await page.locator('[data-act="back"]').click();
    await sleep(400);
    check(!(await lineNow(page)), 'RETURN TO THE SHIP stops it');
    allErrors.push(...p.errors);
    check(await film(p, 'asides-report.mp4'), 'filmed with its sound: asides-report.mp4');
  }

  if (want('B')) {
    console.log('B  the Comms room: the inbox heard on a click');
    const p = await player(browser, 'B');
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    const comms = [
      'The Director (on a call, mid-match): Sorry — push mid, PUSH MID — sorry. So how many cities this week? Nice. Big-brain play.',
      'You: (log) Chapter fourteen contradicts chapter nine. The Voice says this is the most sacred part. Requesting transfer.',
      'The Voice (to you, on the air): Homework, brother. Chapter nine: the Four Beasts. You are, we believe, beasts two and three.',
    ];
    await ally(page, 'faithful', comms);
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    await page.locator('.cp-room[data-room="comms"]').click();
    await page.waitForSelector('.cp-comms [data-say] .say-btn', { timeout: 15000 }).catch(() => {});
    check(await page.locator('.cp-comms [data-say] .say-btn').count() === 2, 'the two leader lines carry ▶; his own log line does not');
    await shot(page, 'b1-comms-inbox');
    // Newest first: the Voice's homework is the top line.
    await page.locator('.cp-comms [data-say] .say-btn').first().click();
    await sleep(1500);
    let n = await lineNow(page);
    check(!!n && n.key.startsWith('say/the-voice-') && !n.paused, `the Voice's line plays (${n?.key ?? 'nothing'})`);
    await shot(page, 'b2-comms-voice-said');
    await page.locator('.cp-comms [data-say] .say-btn').nth(1).click();
    await sleep(1500);
    n = await lineNow(page);
    check(!!n && n.key.startsWith('say/the-director-'), `another ▶ switches to the Director's call (${n?.key ?? 'nothing'})`);
    check(await page.locator('.cp-comms .said-now').count() === 1, 'one line lit at a time');
    await page.locator('.cp-comms .said-now .say-btn').click();
    await sleep(300);
    check(!(await lineNow(page)), '■ stops it');
    const cues = await voiceCues(page);
    check(cues.some((c) => c.startsWith('say__the-voice-')) && cues.some((c) => c.startsWith('say__the-director-')), 'both heard through the voice bus');
    await page.locator('.cp-comms [data-say] .say-btn').first().click();
    await sleep(800);
    await page.locator('.cp-room[data-room="desk"]').click();
    await sleep(400);
    check(!(await lineNow(page)), 'leaving the room stops it');
    allErrors.push(...p.errors);
    await p.ctx.close();

    // Voices at 0 in Settings: nothing to press.
    const q = await player(browser, 'B0');
    await q.page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await q.page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(q.page);
    await ally(q.page, 'faithful', comms);
    await q.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('broodfall-settings') ?? '{}'); s.volume = { ...(s.volume ?? {}), voice: 0 }; localStorage.setItem('broodfall-settings', JSON.stringify(s)); });
    {
      await q.page.goto(`${URL0}?campaign=ship&open=1`, GO);
      await q.page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
      await aboard(q.page);
      await q.page.locator('.cp-room[data-room="comms"]').click();
      await sleep(2500);
      check(await q.page.locator('.cp-comms .say-btn').count() === 0, 'voices at 0 in Settings: no ▶, nothing plays');
    }
    allErrors.push(...q.errors);
    await q.ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
check(!allErrors.length, `no page errors${allErrors.length ? `: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
