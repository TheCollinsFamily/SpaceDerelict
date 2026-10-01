/**
 * YOKE'S TRANSLATION, SEEN AND HEARD (Oct 1 2026; content/translation.ts, src/ui/translation.ts,
 * src/audio/engine.ts translateIn). Its own build (dist-translation), real pages, real clicks; nothing
 * is spent (YOKE is the scripted one).
 *
 *   A  the Delegation's first call on the ship: the band (source, RENDERED BY YOKE, confidence), the
 *      line being said resolving from crop-glyph glyphs, her note under "the handwriting", the source
 *      signal heard before the Delegate's voice.
 *   B  allied with the Delegation, the Comms room: the band over the inbox, the untranslatable
 *      grief-scent note, Form 22-T (the layer explained), a ▶ starting with the signal.
 *   C  Reduce motion on: the line is never drawn in glyphs.
 * Screenshots: notes/screens/2026-10-01/translation-*.jpg.
 *
 *   node tools/shot-translation.mjs [A] [B] [C] [--build]   (served on BROODFALL_PORT, default 5297)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(notes, { recursive: true });
const tmp = join(tmpdir(), 'broodfall-shot-translation');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5297);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
const VIEW = { width: 1280, height: 800 };
const GO = { waitUntil: 'domcontentloaded', timeout: 180000 };
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status) console.warn(r.stderr.slice(0, 400)); return r.status === 0; };
// vite by its own script (a node_modules without .bin still serves).
const VITE = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

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
const DIST = process.env.BROODFALL_DIST || 'dist-translation';
function startServer() {
  freePort();
  const env = { ...process.env, BROODFALL_PORT: String(PORT), BROODFALL_DIST: DIST };
  if (process.argv.includes('--build') || !existsSync(join(root, DIST, 'index.html'))) {
    const b = spawnSync(process.execPath, [VITE, 'build'], { cwd: root, env, encoding: 'utf8' });
    if (b.status) throw new Error(`the build failed: ${(b.stderr || b.stdout).slice(-600)}`);
  }
  const child = spawn(process.execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', env });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the server exited early (${code})`)));
  });
}

async function player(browser, name, store = {}) {
  const ctx = await browser.newContext({ viewport: VIEW });
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
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  }, store);
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors };
}
async function shot(page, name) {
  const png = join(tmp, `${name}.png`);
  await page.screenshot({ path: png });
  ff(['-i', png, '-q:v', '3', join(notes, `translation-${name}.jpg`)]);
}
async function aboard(page) {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.cp-scene-card').count()) return;
    const x = page.locator('.cp-icom [data-act="icom-close"]');
    if (await x.count()) await x.click().catch(() => {});
    if (await page.locator('#campaign:not(.hidden) .cp-rooms').count() && !(await page.locator('.cp-icom').count())) return;
    await sleep(600);
  }
}
/** The saved campaign as the beat needs it: allied or not, a scene waiting or not, the inbox. */
async function seed(page, { faction = null, pending = [], comms = [] }) {
  await page.evaluate(({ faction, pending, comms }) => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.faction = faction;
    s.contacted = ['delegation', 'faithful', 'institute'];
    s.factionSince = s.captures;
    s.pendingScenes = pending;
    s.beatsSeen = faction ? ['__all__'] : [];
    s.comms = comms;
    if (s.onboard) { s.onboard.deskOpen = true; s.onboard.mission1 = 'done'; }
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
  }, { faction, pending, comms });
}
async function open(page) {
  await page.goto(`${URL0}?campaign=ship&open=1`, GO);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
  await aboard(page);
}
const cues = (page) => page.evaluate(() => window.__bfAudio.log.filter((e) => e.played).map((e) => e.id));
const CONTACT = { faction: 'delegation', contact: true, scene: { title: 'A Letter, Spelled Out in a Field', lines: [] } };

const server = await startServer();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const allErrors = [];
try {
  if (want('A')) {
    console.log('A  the Delegation\'s first call: the band, the glyphs, her note, the signal');
    const { page, errors, ctx } = await player(browser, 'A');
    await open(page);
    await seed(page, { pending: [CONTACT] });
    await open(page);
    await page.waitForSelector('.cp-scene-card[data-faction="delegation"]', { timeout: 30000 });
    const band = page.locator('.cp-scene-card .tl-band');
    check(await band.count() === 1, 'the card carries her band');
    const bt = (await band.textContent()) ?? '';
    check(/CROP GLYPHS/.test(bt) && /RENDERED BY YOKE · CONFIDENCE \d+%/.test(bt), `it names the source and her confidence ("${bt.trim()}")`);
    // The crop letter (Oct 1 2026): three of the Delegate's lines, between YOKE's (hers, read) and his log.
    check(await page.locator('.cp-scene-card p .tl-words').count() >= 3, 'the Delegate\'s lines are hers to render');
    check(await page.locator('.cp-scene-card p').filter({ hasText: 'You: (log)' }).locator('.tl-words').count() === 0, 'his own log lines are not translated');
    const notes = (await page.locator('.cp-scene-card .tl-note').allTextContents()).join(' | ');
    check(/furrow discipline/.test(notes) && /the other voice on the band/.test(notes), `her notes under "the handwriting" and "wife" ("${notes.trim().slice(0, 160)}")`);
    // The first line (his log) is read; the second is the Delegate's: catch it mid-rendering.
    const decoding = await page.waitForSelector('.cp-scene-card .tl-words.tl-decoding', { timeout: 20000 }).then(() => true).catch(() => false);
    check(decoding, 'the line being said is drawn in glyphs first');
    if (decoding) await shot(page, 'a1-call-decoding');
    await page.waitForFunction(() => window.__bfAudio.log.some((e) => e.played && e.id === 'signal:delegation'), null, { timeout: 20000 }).catch(() => {});
    const heard = await cues(page);
    // The voice is logged when it is routed (before its signal); it starts SIGNAL_LEAD_MS after the signal.
    check(heard.includes('signal:delegation'), 'the crop-scan signal is heard');
    check(heard.some((id) => /\/voice\//.test(id)), `and the Delegate's voice with it (${heard.filter((id) => /media:/.test(id)).slice(0, 2).join(', ')})`);
    await sleep(1200);
    check(await page.locator('.cp-scene-card .tl-decoding').count() === 0, 'the words settle into English');
    await shot(page, 'a2-call-rendered');
    allErrors.push(...errors);
    await ctx.close();
  }

  if (want('B')) {
    console.log('B  the Comms room: the band, the untranslatable, Form 22-T, the signal on ▶');
    const { page, errors, ctx } = await player(browser, 'B');
    await open(page);
    await seed(page, { faction: 'delegation', comms: [
      'Delegate (letter, by field): A girl in our reading circle asked if you are sad. We told her you are carrying something heavy, for all of us.',
      'Delegate (letter, by field): The newspapers call it an invasion. We call it a correction. Enclosed, in the next field along: our newsletter, "Gentle Endings".',
    ] });
    await open(page);
    await page.locator('.cp-room[data-room="comms"]').click();
    await page.waitForSelector('.cp-comms [data-say] .say-btn', { timeout: 15000 }).catch(() => {});
    check(await page.locator('.tl-band').count() === 1, 'the inbox carries her band');
    const notesTxt = (await page.locator('.cp-comms .tl-note').allTextContents()).join(' | ');
    check(/untranslatable: grief-scent/.test(notesTxt), 'the grief-scent is left untranslated, in brackets');
    check(/swarm leaves the comb/.test(notesTxt), 'her note on "Gentle Endings"');
    check(/FORM 22-T/.test((await page.locator('.tl-codex').textContent()) ?? ''), 'Form 22-T explains the layer');
    await page.locator('.tl-codex').scrollIntoViewIfNeeded();
    await shot(page, 'b1-comms');
    await page.locator('.cp-comms [data-say] .say-btn').first().click();
    await sleep(1600);
    check((await cues(page)).includes('signal:delegation'), '▶ starts with the crop-scan signal');
    await shot(page, 'b2-comms-said');
    allErrors.push(...errors);
    await ctx.close();
  }

  if (want('C')) {
    console.log('C  Reduce motion: no glyphs');
    const { page, errors, ctx } = await player(browser, 'C', { 'broodfall-settings': JSON.stringify({ reduceMotion: true }) });
    await open(page);
    await seed(page, { pending: [CONTACT] });
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('broodfall-settings') ?? '{}'); s.reduceMotion = true; localStorage.setItem('broodfall-settings', JSON.stringify(s)); });
    await open(page);
    await page.waitForSelector('.cp-scene-card[data-faction="delegation"]', { timeout: 30000 });
    check(await page.evaluate(() => document.documentElement.classList.contains('reduce-motion')), 'Reduce motion is on');
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) { seen = (await page.locator('.tl-decoding').count()) > 0; await sleep(150); }
    check(!seen, 'the words are never drawn in glyphs');
    check(await page.locator('.cp-scene-card .tl-band').count() === 1, 'the band is still there');
    allErrors.push(...errors);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
check(!allErrors.length, `no page errors${allErrors.length ? `: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
