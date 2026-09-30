/**
 * THE CAMPAIGN'S MEDIA, PLAYED (Sep 30 2026; src/ui/newsreel.ts, src/ui/sceneVoice.ts, content/media.ts).
 * Its own build (dist-media), real pages, real clicks; outcomes forced the way tools/shot-campaign.mjs forces them.
 *
 *   A  a deployment to Old Harbor won → the report → RETURN TO THE SHIP → the Office's newsreel of
 *      it (reel-harbor: title card, shots with titles in type, the announcer, the score) → the ship →
 *      the Delegation's letter card, its lines said in the Delegate's voice, the line lit.
 *      Filmed with its sound: notes/screens/2026-09-30/media-newsreel.mp4
 *   B  two deployments lost → their Commonwealth Newsreel (skipped with Esc), then one of their papers
 *   C  pieces played straight (the beats' window): three papers, their victory reel, the break
 *      (a shot the reel did not mean to show), an Empire reel replayed with the filter off
 *   D  each route's ending on the ship (a campaign played to its end, tools/reveal-state.ts): the
 *      ending film full screen, then its card with the film where the picture was and the leader
 *      voiced, then the reveal card with its own picture. The Faithful's filmed with its sound:
 *      notes/screens/2026-09-30/media-ending-film.mp4
 * Screenshots: notes/screens/2026-09-30/media-*.jpg. Nothing is spent (YOKE is the scripted one).
 *
 *   node tools/shot-media.mjs [A] [B] [C] [D] [--build]   (its own build, dist-media, served on BROODFALL_PORT, default 5287)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-09-30');
const tmp = join(here, 'screenshots', 'media');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5287);
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
/**
 * The game as built into its own folder (BROODFALL_DIST, default dist-media) and served by `vite
 * preview`: the dev server answers too slowly with several sessions building beside it. `--build`
 * builds that folder first (it never touches dist/, which is Collins's).
 */
const DIST = process.env.BROODFALL_DIST || 'dist-media';
function startDev() {
  freePort();
  const env = { ...process.env, BROODFALL_PORT: String(PORT), BROODFALL_DIST: DIST };
  if (process.argv.includes('--build') || !existsSync(join(root, DIST, 'index.html'))) {
    const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], { cwd: root, env, shell: process.platform === 'win32', encoding: 'utf8' });
    if (b.status) throw new Error(`the build failed: ${(b.stderr || b.stdout).slice(-600)}`);
  }
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env,
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

/** A campaign played to the end of a route (tools/reveal-state.ts), as JSON. */
const ENDING = { delegation: 'Bear Witness', faithful: 'The Hour', institute: 'Rebuild It Right Next Time' };
function routeState(route) {
  const out = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite-node', 'tools/reveal-state.ts', '--', route], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1 << 26 }).stdout.trim();
  if (!out.startsWith('{')) return out;
  // The state keeps its last two scenes; a route with a scene after its reveal (the Institute's) loses its
  // ending that way: it is put back first (the ship shows each waiting scene as the content has it now).
  const s = JSON.parse(out);
  if (!s.pendingScenes.some((p) => String(p.scene.picture ?? '').startsWith(`${route}-ending`))) s.pendingScenes.unshift({ faction: route, scene: { title: ENDING[route], picture: `${route}-ending`, lines: [] } });
  return JSON.stringify(s);
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
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  }, store);
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors, name, opened: Date.now() };
}
async function shot(page, name) {
  const png = join(tmp, `${name}.png`);
  await page.screenshot({ path: png });
  ff(['-i', png, '-q:v', '3', join(notes, `media-${name}.jpg`)]);
}
/** Close whatever YOKE says on arrival, until the ship, a scene card or a film is up. */
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
/** Wait for a shot of the film on screen (or its end). */
async function waitShot(page, id, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await shotNow(page)) === id) return true; if (!(await page.locator('#newsreel').count())) return false; await sleep(150); }
  return false;
}
async function gone(page, ms = 60000) { await page.waitForSelector('#newsreel', { state: 'detached', timeout: ms }).catch(() => {}); return !(await page.locator('#newsreel').count()); }
/** A campaign deployment played to a forced outcome, and its report's button clicked. */
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
const mediaCues = (page) => page.evaluate(() => window.__bfAudio.log.filter((e) => e.played && (e.id.startsWith('media:') || e.kind === 'duck')).map((e) => `${e.kind}:${e.id.replace(/^media:.*\/media\//, '')}`));

const server = await startDev();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const allErrors = [];
try {
  if (want('A')) {
    console.log('A  a deployment won → the Office\'s newsreel → the ship → a leader voiced');
    const p = await player(browser, 'A', { record: true });
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    await deploy(page, 'harbor', true);
    await shot(page, 'a1-report');
    await record(p);
    await page.locator('[data-act="back"]').click();
    await page.waitForSelector('#newsreel', { timeout: 10000 });
    check(await page.locator('#newsreel.nr-empire').count() === 1, 'RETURN TO THE SHIP plays the Office\'s newsreel of it');
    await sleep(700);
    await shot(page, 'a2-reel-title-card');
    check(await waitShot(page, 'e-harbor'), 'its first shot: Old Harbor');
    await sleep(1400);
    await shot(page, 'a3-reel-harbor');
    const title = await page.locator('.nr-big').innerText();
    check(/OLD HARBOR/.test(title), `the title is set in type over the shot: "${title}"`);
    check(await waitShot(page, 'e-docks'), 'its second shot');
    await sleep(1500);
    await shot(page, 'a4-reel-docks');
    check(await waitShot(page, 'end'), 'its last card');
    await sleep(900);
    await shot(page, 'a5-reel-end');
    check(await gone(page), 'it ends by itself');
    const cues = await mediaCues(page);
    check(cues.some((c) => c.includes('music/m-empire')), 'its score played through the music bus');
    check(cues.some((c) => c.includes('voice/n-e-harbor')), 'the announcer read the title through the voice bus');
    check(cues.some((c) => c === 'duck:newsreel'), 'the music ducked under the announcer');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-media')));
    check(log?.last === 'reel-harbor' && log.seen.includes('reel-harbor'), 'the piece is logged as seen (no repeat next time)');
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 10000 });
    await aboard(page);
    await page.waitForSelector('.cp-scene-card', { timeout: 20000 });
    await page.waitForSelector('.cp-scene-card p.said-now', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => window.__bfAudio.log.some((e) => e.id.includes('/voice/delegation__')), null, { timeout: 15000 }).catch(() => {});
    await sleep(1200);
    await shot(page, 'a6-contact-voiced');
    const lit = await page.locator('.cp-scene-card p.said-now').innerText().catch(() => '');
    check(/^Delegate:/.test(lit), `the line being said is lit: "${lit.slice(0, 60)}…"`);
    check((await mediaCues(page)).some((c) => c.includes('voice/delegation__')), 'the Delegate\'s letter is heard in her voice');
    await sleep(4000);
    allErrors.push(...p.errors);
    check(await film(p, 'media-newsreel.mp4'), 'filmed with its sound: media-newsreel.mp4');
  }

  if (want('B')) {
    console.log('B  deployments lost → their newsreel, skipped → their paper');
    const p = await player(browser, 'B');
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    await deploy(page, 'cul-de-sac', false);
    await page.locator('[data-act="back"]').click();
    await page.waitForSelector('#newsreel', { timeout: 10000 });
    check(await page.locator('#newsreel.nr-colony').count() === 1, 'a loss is told from their side: the Commonwealth Newsreel');
    await waitShot(page, 'c-flame');
    await sleep(1500);
    await shot(page, 'b1-colony-reel');
    await page.keyboard.press('Escape');
    check(await gone(page, 3000), 'Esc skips it');
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 10000 });
    await aboard(page);
    await deploy(page, 'granary', false);
    await page.locator('[data-act="back"]').click();
    await page.waitForSelector('#newsreel', { timeout: 10000 });
    check(await page.locator('#newsreel.nr-paper').count() === 1, 'the next loss: not the same piece again, one of their papers');
    await sleep(2200);
    await shot(page, 'b2-clipping-held');
    await page.mouse.click(640, 360);
    check(await gone(page, 3000), 'a click puts the paper down');
    allErrors.push(...p.errors);
    await p.ctx.close();
  }

  if (want('C')) {
    console.log('C  pieces played straight: papers, their victory, the break, the replay');
    const p = await player(browser, 'C');
    const { page } = p;
    await page.goto(`${URL0}?campaign=ship&open=1`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    for (const id of ['clip-delegation', 'clip-faithful', 'clip-institute', 'clip-ailabs']) {
      await page.evaluate((id) => window.__bfMedia.start(id), id);
      await page.waitForSelector('#newsreel.nr-paper', { timeout: 8000 });
      await sleep(1800);
      await shot(page, `c-${id}`);
      const head = await page.locator('.np-head').innerText();
      check(head.length > 10, `${id}: the headline is type: "${head}"`);
      await page.keyboard.press('Escape');
      await gone(page, 3000);
    }
    await page.evaluate(() => window.__bfMedia.start('reel-retaken'));
    await waitShot(page, 'c-liberated');
    await sleep(1600);
    await shot(page, 'c-reel-retaken');
    await page.keyboard.press('Escape'); await gone(page, 3000);
    await page.evaluate(() => window.__bfMedia.start('reel-temple'));
    await waitShot(page, 'e-bells'); await sleep(1500);
    await shot(page, 'c-reel-temple');
    check(await waitShot(page, 'r-sisters'), 'the break: a shot the reel did not mean to show');
    await sleep(2500);
    check(await page.locator('#newsreel.raw').count() === 1, 'it plays with the filter off, no title');
    await shot(page, 'c-break-sisters');
    const cues = await mediaCues(page);
    check(cues.some((c) => c.includes('field-1')), 'the music cut to the raw field audio');
    await page.keyboard.press('Escape'); await gone(page, 3000);
    await page.evaluate(() => window.__bfMedia.start('reel-acquired', true));
    await page.waitForSelector('#newsreel.replay', { timeout: 60000 }).catch(() => {});
    await page.waitForFunction(() => { const v = document.querySelector('#newsreel.replay video.on'); return v && v.currentTime > 1; }, null, { timeout: 45000 }).catch(() => {});
    check(await page.locator('#newsreel.replay').count() === 1, 'an Empire reel replayed ungraded, no narrator, no music');
    await shot(page, 'c-replay-ungraded');
    await page.keyboard.press('Escape'); await gone(page, 3000);
    allErrors.push(...p.errors);
    await p.ctx.close();
  }

  if (want('D')) {
    console.log('D  the endings: the film, the card voiced, the reveal\'s own picture');
    for (const route of ['faithful', 'delegation', 'institute']) {
      const state = routeState(route);
      if (!state.startsWith('{')) { check(false, `${route}: the route's state (tools/reveal-state.ts)`); continue; }
      const rec = route === 'faithful';
      const p = await player(browser, `D-${route}`, { record: rec, store: { 'broodfall-campaign': state } });
      const { page } = p;
      await page.goto(`${URL0}?campaign=ship`, GO);
      await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
      if (rec) await record(p);
      await aboard(page);
      const filmUp = await page.waitForSelector('#newsreel.nr-finale', { timeout: 15000 }).then(() => true, () => false);
      check(filmUp, `${route}: the ending plays as a film`);
      await sleep(2600);
      await shot(page, `d-${route}-film-1`);
      await sleep(rec ? 8000 : 5000);
      await shot(page, `d-${route}-film-2`);
      if (rec) { await sleep(6000); await shot(page, `d-${route}-film-3`); await gone(page, 40000); } else { await page.keyboard.press('Escape'); await gone(page, 3000); }
      await page.waitForSelector('.cp-scene-card', { timeout: 10000 });
      await sleep(2500);
      await shot(page, `d-${route}-ending-card`);
      check(await page.locator('.cp-scene-card video.cp-scene-film').count() === 1, `${route}: the card loops the film where its picture was`);
      if (rec) await sleep(9000);
      await page.locator('.cp-scene-card [data-act="scene-ok"]').click();
      await page.waitForSelector('.cp-scene-card img.cp-scene-pic', { timeout: 10000 }).catch(() => {});
      await sleep(2000);
      await shot(page, `d-${route}-reveal`);
      const src = await page.locator('.cp-scene-card img.cp-scene-pic').getAttribute('src').catch(() => '');
      check(String(src).includes(`media/pictures/${route}-reveal-end`), `${route}: the reveal card shows its own picture (${String(src).split('/').pop()})`);
      if (rec) {
        await sleep(6000);
        check((await mediaCues(page)).some((c) => c.includes('voice/faithful__')), 'faithful: the Voice is heard on the reveal card');
        allErrors.push(...p.errors);
        check(await film(p, 'media-ending-film.mp4'), 'filmed with its sound: media-ending-film.mp4');
      } else { allErrors.push(...p.errors); await p.ctx.close(); }
    }
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
check(!allErrors.length, `no page errors${allErrors.length ? `: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
