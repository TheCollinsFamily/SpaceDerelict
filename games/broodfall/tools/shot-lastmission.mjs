/**
 * THE ROACH KING OFF THE AIR, AND THE LAST MISSION (Collins, Oct 4 2026; content/roachKing.ts ROACH_SCENES,
 * content/campaign.ts LAST_MISSION, src/ui/roachKing.ts, src/ui/campaignUi.ts, src/sim/sim.ts lateHost). Its own build
 * (dist-last), real pages, real clicks. Nothing is spent (YOKE is the scripted one; a scene with no film baked is its
 * transcript).
 *
 *   A  five territories held, his first address already seen: a deployment won → the report → RETURN TO THE SHIP → the
 *      planet's news (skipped) → THE BRIEFING is caught: the intercept's transcript (INTERCEPTED, where, the title,
 *      YOKE's band, every line with who says it, her note). A click on the page does not close it; CONTINUE does; it is
 *      logged, and the ship follows.
 *   B  the ally's finale played: the desk says ONE LANDING IS LEFT, the Hive House is on the planet (♛); its briefing
 *      states the mission's own rules; DEPLOY (through the Objectors' pick) → THE TRANSPORTS (the call) → CONTINUE →
 *      FOUNDING DAY (his last message) → CONTINUE → the mission. In it: the shelter by the body is his from the start,
 *      the order counts down to the Host, the first waves bring no war body, a protected shelter pays its ration at the
 *      clear, and after the countdown the Host arrives. Then the mission is won: the campaign is complete.
 *   C  a second try at the last mission goes straight in: the two scenes are not shown again.
 * Screenshots: notes/screens/2026-10-04/last-*.jpg.
 *
 *   node tools/shot-lastmission.mjs [A] [B] [C] [--build]   (served on BROODFALL_PORT, default 5296)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-10-04');
mkdirSync(notes, { recursive: true });
const tmp = join(tmpdir(), 'broodfall-shot-last');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5296);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
const VIEW = { width: 1280, height: 720 };
const GO = { waitUntil: 'domcontentloaded', timeout: 180000 };
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** BEAT_TRACE=1: where it is, with the clock (for a run that stalls). */
const T0 = Date.now();
const trace = (what) => { if (process.env.BEAT_TRACE) console.log(`  .. ${((Date.now() - T0) / 1000).toFixed(1)} s ${what}`); };
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
const DIST = process.env.BROODFALL_DIST || 'dist-last';
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

async function player(browser, name) {
  const ctx = await browser.newContext({ viewport: VIEW });
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
  });
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors, name };
}
async function shot(page, name) {
  const png = join(tmp, `${name}.png`);
  await page.screenshot({ path: png });
  ff(['-i', png, '-q:v', '3', join(notes, `last-${name}.jpg`)]);
}
/** Aboard, with whatever she is saying closed. */
async function aboard(page) {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('#newsreel').count()) return;
    if (await page.locator('.cp-scene-card').count()) return;
    const x = page.locator('.cp-icom [data-act="icom-close"]');
    // Only when it is there to be closed: the intercom stays in the page, hidden, when she has nothing to say.
    if (await x.count() && await x.isVisible()) await x.click({ timeout: 3000 }).catch((e) => trace(`the intercom would not close: ${String(e).slice(0, 200)}`));
    else if (i > 3) return;
    await sleep(500);
  }
}
const patchCampaign = (page, patch) => page.evaluate((patch) => { const s = JSON.parse(localStorage.getItem('broodfall-campaign')); Object.assign(s, patch); localStorage.setItem('broodfall-campaign', JSON.stringify(s)); }, patch);
/** A campaign on the ship with the desk open, then changed and reloaded. */
async function campaign(page, patch, roachSeen) {
  await page.goto(`${URL0}?campaign=ship&open=1`, GO);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
  await aboard(page);
  await patchCampaign(page, { onboard: undefined, ...patch });
  await page.evaluate((seen) => { const s = JSON.parse(localStorage.getItem('broodfall-campaign')); localStorage.setItem('broodfall-roach', JSON.stringify({ seed: s.seed, seen })); }, roachSeen);
}
async function forceEnd(page, won) {
  await page.evaluate((won) => { const s = window.broodfall.sim; s.stats.kills.militia = 60; s.outcome = won ? 'won' : 'lost'; s.events.push({ kind: won ? 'won' : 'lost' }); window.broodfall.step(1); }, won);
  await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 60000 });
  await page.waitForTimeout(1200);
}
async function deployForced(page, territory, won) {
  await page.evaluate((t) => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: t, dares: [], objectors: [] })), territory);
  await page.goto(`${URL0}?campaign=run`, GO);
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 180000 });
  await page.waitForTimeout(600);
  await forceEnd(page, won);
}
/** Whatever of the planet's news or his addresses is up is skipped until `sel` is up (or the time runs out). */
async function skipUntil(page, sel, ms = 60000) {
  for (let t0 = Date.now(); Date.now() - t0 < ms;) {
    if (await page.locator(sel).count()) return true;
    if (await page.locator('#newsreel:not(.rk-transcript):not(.leaving)').count()) { await sleep(900); await page.keyboard.press('Escape'); }
    await sleep(300);
  }
  return false;
}
const transcript = (page) => page.locator('#newsreel.rk-transcript');
const sceneUp = (page) => page.evaluate(() => document.querySelector('#newsreel.rk-transcript')?.dataset.scene ?? document.querySelector('#newsreel.cs-film')?.dataset.film ?? null);
/**
 * A Roach King scene whose film is baked plays as a CUT SCENE, the factions' convention (Collins, Oct 5 2026: "these are
 * supposed to be cut scenes"): full screen under its own title, the film moving and heard. Checked, then skipped.
 */
async function filmPlays(page, id, title, name) {
  const ok = await page.waitForFunction((id) => {
    const v = document.querySelector(`#newsreel.cs-film[data-film="${id}"] video`);
    return !!v && !v.paused && v.currentTime > 1.5 && v.videoWidth > 0;
  }, id, { timeout: 40000 }).then(() => true, () => false);
  const st = await page.evaluate(() => {
    const el = document.querySelector('#newsreel.cs-film');
    const v = el?.querySelector('video');
    return { kicker: el?.querySelector('.cs-kicker')?.textContent ?? '', muted: v?.muted, t: v?.currentTime ?? 0, transcript: !!document.querySelector('#newsreel.rk-transcript') };
  });
  check(ok && !st.muted && !st.transcript, `${name}: a cut scene, its film playing and heard (${st.t.toFixed(1)} s in)`);
  check(st.kicker.trim() === title && !/INTERCEPTED/.test(st.kicker), `${name}: under its own title, not an intercept ("${st.kicker.trim()}")`);
  return ok;
}
async function skipFilm(page) {
  await page.locator('#newsreel.cs-film .cs-skip').click();
  await page.waitForSelector('#newsreel.cs-film', { state: 'detached', timeout: 10000 }).catch(() => {});
}
async function waitScene(page, id, ms = 30000) { for (let t0 = Date.now(); Date.now() - t0 < ms;) { if ((await sceneUp(page)) === id) return true; await sleep(150); } return false; }

const HELD5 = ['crash-site', 'cul-de-sac', 'granary', 'harbor', 'commuter', 'temple'];
const ALL = ['crash-site', 'cul-de-sac', 'granary', 'harbor', 'commuter', 'temple', 'foundry', 'mirewater', 'university', 'ossuary', 'pilgrim', 'queens-hollow', 'assembly'];
const AFTER_FINALE = {
  held: ALL, captures: ALL.length - 1, deployments: ALL.length + 2, faction: 'delegation', factionSince: 1, contacted: ['delegation', 'faithful', 'institute'], met: ['delegation'],
  beatsSeen: ['understand', 'stop-war', 'gaia', 'reveal'], finale: 'delegation', ended: null, pendingScenes: [], midpoint: { status: 'stayed', at: 6 }, staging: null, underAttack: null,
};

const server = await startServer();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const allErrors = [];
try {
  if (want('A')) {
    console.log('A  five territories held: the briefing is caught after a deployment');
    const p = await player(browser, 'A');
    const { page } = p;
    // The 9th capture is the main plot's 4th slot (src/meta/roachKing.ts); three of his pieces seen, the briefing is next.
    await campaign(page, { held: HELD5.slice(0, 5), captures: 8, deployments: 9, staging: null, underAttack: null }, ['rk-address', 'rk-draft', 'rk-counter']);
    await deployForced(page, 'temple', true);
    await page.locator('[data-act="back"]').click();
    check(await skipUntil(page, '#newsreel.cs-film[data-film="rk-briefing"]'), 'after the news, the briefing plays');
    check(await sceneUp(page) === 'rk-briefing', 'it is the briefing');
    await filmPlays(page, 'rk-briefing', 'ANOTHER TERRITORY', 'the briefing');
    await sleep(2500);
    await shot(page, 'a1-briefing');
    await skipFilm(page);
    check(await page.locator('#newsreel.cs-film').count() === 0, 'SKIP closes it');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-roach') ?? '{}'));
    check(log.seen?.includes('rk-briefing'), 'logged as seen: it is caught once');
    await page.waitForSelector('#campaign:not(.hidden) .cp-desk, #campaign:not(.hidden) .cp-rooms, #campaign:not(.hidden)', { timeout: 20000 });
    check(await page.locator('#campaign:not(.hidden)').count() === 1, 'then the ship');
    allErrors.push(...p.errors);
    await p.ctx.close();
  }

  if (want('B')) {
    console.log('B  after the finale: the Hive House, the call, his last message, the last mission');
    const p = await player(browser, 'B');
    const { page } = p;
    await campaign(page, AFTER_FINALE, ['rk-address', 'rk-draft', 'rk-briefing', 'rk-delegation', 'rk-counter']);
    await page.goto(`${URL0}?campaign=ship`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    // The Directive Desk.
    const desk = page.locator('[data-room="desk"], [data-act="room-desk"]').first();
    if (await desk.count()) await desk.click().catch(() => {});
    await page.waitForSelector('.cp-desk', { timeout: 20000 });
    await sleep(1200);
    const left = await page.locator('.cp-brief').innerText();
    check(/ONE LANDING IS LEFT/.test(left) && /Hive House/.test(left), 'the desk says one landing is left: the Hive House');
    check(await page.locator('.globe .site.last[data-site="hive-house"]').count() === 1, 'the Hive House is on the planet');
    check(await page.locator('.globe .site.open').count() === 1, 'it is the only landing open');
    await shot(page, 'b1-desk');
    // Pick it (the marker may be on the far side of the planet: the campaign UI picks by its id).
    await page.evaluate(() => document.querySelector('.globe .site[data-site="hive-house"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForSelector('.cp-last', { timeout: 10000 });
    const brief = await page.locator('.cp-brief').innerText();
    check(/THE HIVE HOUSE/.test(brief) && /THE LAST MISSION/.test(brief) && /THE HOST IS LATE/.test(brief), 'its briefing: THE LAST MISSION, the Host is late');
    check(/5 turns/.test(brief) && /science caste/.test(brief) && /court/.test(brief), 'the countdown, and who comes until then');
    check(/shelter/i.test(brief) && /already yours/.test(brief) && /\+45 war meat/.test(brief), 'the shelter that is his from the start, and what it gives');
    check(/Hold for 9 waves/.test(brief), 'the order: hold for 9 waves');
    // Its picture over the story, like every other landing (the still, or the loop the still is swapped for).
    await page.waitForFunction(() => {
      const pic = document.querySelector('.cp-brief .cp-territory-pic[data-territory="hive-house"]');
      return !!pic && (pic instanceof HTMLVideoElement ? pic.readyState >= 2 : pic.complete && pic.naturalWidth > 0);
    }, null, { timeout: 10000 }).catch(() => {});
    const pic = await page.evaluate(() => {
      const el = document.querySelector('.cp-brief .cp-territory-pic[data-territory="hive-house"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const video = el instanceof HTMLVideoElement;
      return { video, w: Math.round(r.width), h: Math.round(r.height), drawn: video ? el.readyState >= 2 && el.videoWidth > 0 : el.complete && el.naturalWidth > 0, src: (el.currentSrc || el.src || '').split('/').pop() };
    });
    check(!!pic && pic.drawn && pic.w > 200 && pic.h > 80, `its briefing has its picture (${pic ? `${pic.video ? 'loop' : 'still'} ${pic.src}, ${pic.w}x${pic.h}` : 'none'})`);
    await shot(page, 'b2-brief');
    // And it comes alive. Under automation the loops play only when asked for (src/ui/alive.ts); the briefing is drawn
    // again by picking the landing again, and put back to stills after, as the rest of the beat reads its screens.
    const pickAgain = (alive) => page.evaluate((on) => {
      if (on) localStorage.setItem('broodfall-alive', 'on'); else localStorage.removeItem('broodfall-alive');
      document.querySelector('.globe .site[data-site="hive-house"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, alive);
    await pickAgain(true);
    const moving = await page.waitForFunction(() => {
      const v = document.querySelector('.cp-brief video.cp-territory-pic[data-territory="hive-house"]');
      return v instanceof HTMLVideoElement && !v.paused && v.currentTime > 0.3;
    }, null, { timeout: 15000 }).then(() => true, () => false);
    check(moving, 'and its picture comes alive (its loop plays over the briefing)');
    await shot(page, 'b2-brief-alive');
    await pickAgain(false);
    await page.waitForSelector('.cp-brief img.cp-territory-pic[data-territory="hive-house"]', { timeout: 10000 }).catch(() => {});
    await page.locator('[data-act="deploy"]').click();
    // The Delegation's Objectors: the pick shows at the start of the mission.
    if (await page.locator('[data-act="obj-go"]').count()) { await shot(page, 'b3-objectors'); await page.locator('[data-act="obj-go"]').click(); }
    check(await waitScene(page, 'rk-transports'), 'DEPLOY: first the call (THE TRANSPORTS)');
    await filmPlays(page, 'rk-transports', 'THE TRANSPORTS', 'the call');
    await sleep(2500);
    await shot(page, 'b4-transports');
    await skipFilm(page);
    check(await waitScene(page, 'rk-founding'), 'then his last message (FOUNDING DAY)');
    await sleep(900);
    await shot(page, 'b5-founding');
    // Its film is not made yet (the provider refuses the speech as written: notes/ROACH-KING-2026-10-04.md); until it
    // is, the words are shown, and CONTINUE (or the film's SKIP) goes on to the mission.
    if (await page.locator('#newsreel.cs-film').count()) {
      await filmPlays(page, 'rk-founding', 'FOUNDING DAY', 'the address');
      await Promise.all([page.waitForURL(/campaign=run/, { timeout: 30000 }), page.locator('#newsreel.cs-film .cs-skip').click()]);
    } else {
      const text = await transcript(page).innerText();
      check(/We will not go quietly into the night!/.test(text) && /Today we celebrate our Independence Day!/.test(text), 'the address (words only until its film is made)');
      await transcript(page).locator('.rk-continue').scrollIntoViewIfNeeded();
      await Promise.all([page.waitForURL(/campaign=run/, { timeout: 30000 }), transcript(page).locator('.rk-continue').click()]);
    }
    await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 180000 });
    await sleep(1500);
    // The mission.
    const start = await page.evaluate(() => { const s = window.broodfall.sim; return { shelters: s.shelters.map((x) => ({ state: x.state, stage: x.stage })), host: s.hostTurnsLeft, dir: s.directive, biome: window.broodfall.biome() }; });
    check(start.shelters.length === 1 && start.shelters[0].state === 'infested' && start.shelters[0].stage === 1, 'a shelter stands by the body and is his already (stage 1)');
    check(start.host === 5 && start.dir.kind === 'hold' && start.dir.waves === 9, 'the order: hold for 9 waves, the Host 5 turns away');
    const label = await page.locator('#biomass-label').innerText();
    check(/HOLD 9 WAVES/.test(label) && /THE HOST IN 5 TURNS/.test(label), `the countdown is on the order ("${label}")`);
    // ...and read whole: it is not cut off beside the phase line (it was, at 1280 wide, when it was a longer sentence).
    check(await page.locator('#biomass-label').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'the countdown is not cut off on the HUD');
    check(start.biome === 'deephive', `the capital's tile set (${start.biome})`);
    // The start banner is read whole: a banner was one line whatever its length, and this one ran off both sides.
    const ban = await page.locator('#banner').evaluate((el) => { const r = el.getBoundingClientRect(); return { text: el.textContent ?? '', left: Math.round(r.left), right: Math.round(r.right), w: innerWidth, lines: Math.round(r.height) }; });
    check(/SHELTER BY THE BODY IS YOURS/.test(ban.text) && ban.left >= 0 && ban.right <= ban.w && ban.lines < 110, `the start banner is inside the picture, on two lines at most (${ban.left} to ${ban.right} of ${ban.w}, ${ban.lines} px high)`);
    // And the board points at the shelter it names, until the first wave.
    check(await page.evaluate(() => { const s = window.broodfall.sim; return !!s.openingShelter && s.openingShelter === s.shelters[0]; }), 'the board points at the shelter (a ring and a chevron over it)');
    await shot(page, 'b7-start');
    // The organ stage, opened by hand in turn one: it says what the ration is for while the Host is late.
    await page.locator('#open-under').click();
    await page.waitForFunction(() => !document.getElementById('under').classList.contains('hidden'), null, { timeout: 8000 }).catch(() => {});
    await sleep(1400);
    const note = await page.locator('#under-note').innerText();
    check(/the host is 5 turns away/i.test(note) && /only war meat/i.test(note) && /limbs/i.test(note), `the organ stage: the ration is the only war meat, leave some for limbs ("${note.slice(0, 70)}...")`);
    await shot(page, 'b7b-organ-stage');
    await page.locator('#under-done').click();
    // The banner gone, the board is seen: the ring round the shelter and the chevron over it.
    await page.waitForFunction(() => getComputedStyle(document.getElementById('banner')).opacity === '0', null, { timeout: 9000 }).catch(() => {});
    await sleep(400);
    await shot(page, 'b7c-shelter-marked');
    // Play: limbs with the starting meat, then the first wave.
    const built = await page.evaluate(() => {
      const b = window.broodfall; let n = 0;
      // Whatever limb the hand was dealt (it is dealt afresh every run: a run with no Spitter and no Lasher grew
      // nothing when the script knew only those two), on the nearest ground that takes it.
      for (let i = 0; i < 6; i++) {
        const s = b.sim;
        const cells = b.buildableCells(60).sort((x, y) => s.creepDistOf(x) - s.creepDistOf(y)).slice(n + 2, n + 14);
        let grown = false;
        for (let k = 0; k < s.hand.length && !grown; k++) {
          for (const cell of cells) { if (b.play({ kind: 'build', cardIndex: k, cell }).ok) { grown = true; break; } }
        }
        if (!grown) break;
        n++;
      }
      return n;
    });
    check(built >= 1, `limbs grown with the starting meat (${built})`);
    // Wave 1: called early; its banner says who is coming.
    await page.evaluate(() => window.broodfall.play({ kind: 'call-early' }));
    await sleep(700);
    const banner1 = await page.locator('#banner').innerText();
    check(/THE COURT AND THE SCIENCE CASTE/.test(banner1) && /THE HOST IN 5 TURNS/.test(banner1), `wave 1's banner, the same count as the order ("${banner1}")`);
    check(await page.evaluate(() => window.broodfall.sim.openingShelter === null), 'the wave is under way: the shelter is no longer pointed at');
    await shot(page, 'b8-wave1');
    // Through wave 1 (stepped): no war body on the field at any time; the clear pays the shelter's ration.
    const w1 = await page.evaluate(() => {
      const b = window.broodfall; const s = b.sim;
      let war = 0; let seen = new Set();
      const casteOf = (k) => (['royal', 'consort', 'matron'].includes(k) ? 'royal' : ['researcher', 'thief', 'infiltrator', 'dartgun', 'lensbearer', 'engineer', 'fieldstation', 'sciturret'].includes(k) ? 'science' : 'war');
      const before = s.meat.war;
      for (let i = 0; i < 2500 && s.wavesCleared < 1 && s.outcome === 'playing'; i++) {
        b.step(1);
        for (const e of s.enemies) { seen.add(e.kind); if (casteOf(e.kind) === 'war') war++; }
      }
      return { war, seen: [...seen], cleared: s.wavesCleared, outcome: s.outcome, meat: s.meat.war, before, host: s.hostTurnsLeft, shelter: s.shelters[0].state };
    });
    check(w1.cleared === 1 && w1.outcome === 'playing', `wave 1 cleared (${w1.seen.join(', ')})`);
    check(w1.war === 0, 'no war body came');
    check(w1.seen.includes('consort') && w1.seen.includes('researcher'), 'the court and the science caste did');
    check(w1.host === 4, 'the countdown: 4 turns');
    await sleep(500);
    const banner2 = await page.locator('#banner').innerText();
    check(/SHELTER PROTECTED/.test(banner2) && /45 FROM THE PEOPLE INSIDE/.test(banner2), `the shelter's ration at the clear ("${banner2}")`);
    check(w1.meat >= 45, `war meat to spend from the shelter and the wage (${Math.floor(w1.meat)})`);
    await shot(page, 'b9-ration');
    // On to the Host: the scripted player's hands for the rest of the countdown (stepped), with the core kept alive.
    const host = await page.evaluate(() => {
      const b = window.broodfall; const s = b.sim;
      let war = 0;
      const warKinds = new Set(['responder', 'militia', 'skitterling', 'soldier', 'splitter', 'elite', 'flier', 'drummer', 'stalker', 'flametrooper', 'sapper', 'bomber', 'mortar', 'cannon', 'shadewing', 'aegis', 'phalanx', 'tender', 'carapace', 'ghostsapper', 'tunneler']);
      for (let i = 0; i < 40000 && s.waveNumber < 6 && s.outcome === 'playing'; i++) {
        if (s.phase === 'draft') b.play({ kind: 'choose-plate', index: 0 });
        else if (s.phase === 'growth') {
          const k = s.hand.findIndex((c) => s.canAfford({ war: 0 }) && ['spitter', 'lasher', 'burster', 'maw', 'impaler', 'quill', 'frond', 'prism'].includes(c.family));
          if (k >= 0 && i % 15 === 0) { const cells = b.buildableCells(80); const cell = cells[(i / 15) % Math.max(1, cells.length) | 0]; if (cell !== undefined) b.play({ kind: 'build', cardIndex: k, cell }); }
          if (s.phaseElapsed > 6) b.play({ kind: 'call-early' });
        }
        s.coreHp = Math.max(s.coreHp, s.coreMaxHp * 0.6);
        b.step(1);
        if (s.waveNumber <= 5) for (const e of s.enemies) if (warKinds.has(e.kind)) war++;
      }
      return { wave: s.waveNumber, war, host: s.hostTurnsLeft, tier: s.tier, outcome: s.outcome, enemies: s.enemies.filter((e) => warKinds.has(e.kind)).length, queue: s.spawnQueue.length };
    });
    check(host.wave === 6 && host.outcome === 'playing', `the countdown ran out: wave ${host.wave}`);
    check(host.war === 0, 'no war body in any of the five turns');
    check(host.host === 0 && host.tier >= 6, `the Host is here, at tier ${host.tier}`);
    await sleep(900);
    const label2 = await page.locator('#biomass-label').innerText();
    check(/THE HOST IS HERE/.test(label2), `the order says so ("${label2}")`);
    await page.evaluate(() => { for (let i = 0; i < 60; i++) window.broodfall.step(1); });
    await sleep(600);
    const warNow = await page.evaluate(() => window.broodfall.sim.enemies.length + window.broodfall.sim.spawnQueue.length);
    check(warNow > 20, `and it came in force (${warNow} bodies on the field and on the way)`);
    await shot(page, 'b10-host');
    // Won (forced): the report, the news and the end of his broadcast, then the ship: the campaign is complete.
    await forceEnd(page, true);
    trace('report up');
    await shot(page, 'b11-report');
    await page.locator('[data-act="back"]').click();
    trace('back clicked');
    await skipUntil(page, '#campaign:not(.hidden) .cp-ended, #campaign:not(.hidden) .cp-desk, #campaign:not(.hidden) .cp-rooms', 45000);
    trace('the ship is up (or 45 s passed)');
    for (let i = 0; i < 12 && await page.locator('#newsreel').count(); i++) { await page.keyboard.press('Escape'); await sleep(900); }
    trace('nothing is playing');
    await aboard(page);
    trace('aboard');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')));
    check(s.ended === 'delegation' && s.held.includes('hive-house'), 'the campaign is over, on the route whose finale came before it');
    const desk2 = page.locator('[data-room="desk"], [data-act="room-desk"]').first();
    if (await desk2.count()) await desk2.click().catch(() => {});
    await sleep(1200);
    check(await page.locator('.cp-ended').count() === 1 && /CAMPAIGN COMPLETE/.test(await page.locator('.cp-ended').innerText()), 'the desk: CAMPAIGN COMPLETE');
    await shot(page, 'b12-complete');
    allErrors.push(...p.errors);
    await p.ctx.close();
  }

  if (want('C')) {
    console.log('C  a second try at the last mission goes straight in');
    const p = await player(browser, 'C');
    const { page } = p;
    await campaign(page, AFTER_FINALE, ['rk-address', 'rk-transports', 'rk-founding']);
    await page.goto(`${URL0}?campaign=ship`, GO);
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
    await aboard(page);
    const desk = page.locator('[data-room="desk"], [data-act="room-desk"]').first();
    if (await desk.count()) await desk.click().catch(() => {});
    await page.waitForSelector('.cp-desk', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('.globe .site[data-site="hive-house"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForSelector('.cp-last', { timeout: 10000 });
    await page.locator('[data-act="deploy"]').click();
    if (await page.locator('[data-act="obj-go"]').count()) await page.locator('[data-act="obj-go"]').click();
    await page.waitForURL(/campaign=run/, { timeout: 30000 }).catch(() => {});
    check(/campaign=run/.test(page.url()), 'DEPLOY goes straight to the mission');
    check(await transcript(page).count() === 0 && await page.locator('#newsreel.cs-film').count() === 0, 'the call and the address are not shown again');
    allErrors.push(...p.errors);
    await p.ctx.close();
  }
  check(allErrors.length === 0, `no page errors${allErrors.length ? `: ${allErrors.slice(0, 3).join(' | ')}` : ''}`);
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  freePort();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
