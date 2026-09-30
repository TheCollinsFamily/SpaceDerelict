/**
 * THE NEW PLAYER'S PATH (Sep 30 2026; src/meta/onboarding.ts, DESIGN.md "How it unfolds").
 * On the DEV server (what `npm start` runs), in fresh browsers with nothing stored:
 *
 *   A  first launch: the cinematic plays (titles in type), Esc skips it; mission 1 on the
 *      board with no word of the ship; the coach's hint; a limb grown by real clicks; mission 1
 *      LOST (forced) → a plain report → CONTINUE → the ship: YOKE greets him (Collins's lost
 *      lines) in her intercom, lights the Gene Bay; the Directive Desk is DARK; the ship's own
 *      pick is deployed; lost again → the mate review greeting → the data pad in his quarters;
 *      a WIN → the desk clears (Collins's unlock lines), then all three factions call, one
 *      after the other; YOKE summoned over the Gene Bay and answered; quit → the ship-console
 *      menu over its looping video → CONTINUE → aboard, greeted again.
 *   B  mission 1 WON: the duck lines; the desk still dark; the next win clears it.
 *   C  the menu's REPLAY THE OPENING plays the film again; a click skips it.
 *
 * Wins and losses are forced as tools/shot-campaign.mjs does (the runs themselves are the other
 * beats' business). rfab.ai is MOCKED (her voice is a quarter second of silence): nothing is spent.
 *
 *   node tools/shot-onboarding.mjs            (its own dev server on BROODFALL_PORT, default 5243)
 * Screenshots: tools/screenshots/onboard-*.png, and JPEG copies in notes/screens/2026-09-30/.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const notes = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5243);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `onboard-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', join(notes, `onboard-${name}.jpg`)]);
};

const ids = JSON.parse(readFileSync(join(root, 'content', 'lore', 'yoke-avatar.json'), 'utf8'));
const silent = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.25', '-c:a', 'libmp3lame', '-b:a', '32k', '-f', 'mp3', '-'], { maxBuffer: 1 << 20 }).stdout;

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
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT) },
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

/** rfab.ai as the game's proxy reaches it: her history, his lines, her voice, her stream (written by the beat). */
async function newPlayer(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const state = { sent: [], spoken: 0 };
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => {
    const real = window.fetch.bind(window);
    const enc = new TextEncoder();
    window.__yoke = { ctl: null, say(e) { this.ctl?.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } };
    window.fetch = (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (/\/rfab-api\/api\/avatars\/[^/]+\/events$/.test(url)) {
        const body = new ReadableStream({ start(c) { window.__yoke.ctl = c; c.enqueue(enc.encode(': open\n\n')); } });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
      }
      return real(input, init);
    };
    // Every YOKE greeting heard: which one, from the page's own marker.
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'avatar', v: 2 }));
  });
  const base = `**/rfab-api/api/avatars/${ids.avatarId}`;
  await page.route(`${base}/history`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turns: [] }) }));
  await page.route(`${base}/message`, (r) => { state.sent.push(JSON.parse(r.request().postData() ?? '{}').message ?? ''); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }); });
  await page.route(`${base}/speak`, (r) => { state.spoken++; return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: silent }); });
  await page.route('**/rfab-api/api/broodfall/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  return { ctx, page, errors, state };
}

/** Force the run's end, as tools/shot-campaign.mjs does. */
const endRun = (page, how) => page.evaluate((how) => {
  const s = window.broodfall.sim;
  if (how === 'won') { s.stats.kills.militia = 999; s.stats.limbsGrown = 20; s.stats.healed = 5000; s.stats.evolutions = 9; }
  s.outcome = how;
  s.events.push({ kind: how });
  window.broodfall.step(1);
}, how);

/** Wait for the board of a run. */
const board = (page) => page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 90000 });

/** Back aboard after a report; returns the greeting id she chose. */
async function aboard(page, from) {
  // Aboard in the same page (the click lets her voice play); the address becomes ?campaign=ship for a reload.
  await page.locator(from).click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
  return page.evaluate(() => document.getElementById('campaign').dataset.greeting);
}
/** Until her greeting has played through (she is heard a quarter second a line here, read otherwise). */
const greeted = (page) => page.waitForSelector('.cp-icom:not(.greeting)', { timeout: 90000 });
const icomText = (page) => page.locator('.cp-icom .cp-talk').innerText();

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  // ================================================================ A: the whole unfolding
  if (want('A')) {
    console.log('A: first launch, mission 1 lost, the ship, the desk dark, the mate review, a win clears the desk, the factions, the menu');
    const { ctx, page, errors, state } = await newPlayer(browser);
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#intro', { timeout: 10000 });
    check(true, 'the first launch opens on the cinematic, not a menu');
    await page.waitForFunction(() => document.querySelector('#intro .intro-title.on'), null, { timeout: 15000 });
    await page.waitForTimeout(700);
    await shot(page, '01-intro-sky');
    const t1 = await page.locator('#intro .intro-big').innerText();
    check(/QUIET NIGHT/.test(t1), `the first title is set in type over the film: "${t1}"`);
    await page.waitForFunction(() => document.getElementById('intro')?.dataset.shot === 'impact', null, { timeout: 30000 });
    await page.waitForTimeout(1600);
    await shot(page, '02-intro-impact');
    await page.waitForFunction(() => document.getElementById('intro')?.dataset.shot === 'crater', null, { timeout: 15000 });
    await page.waitForTimeout(1400);
    await shot(page, '03-intro-crater');
    const words = await page.evaluate(() => document.getElementById('intro').innerText);
    check(!/ship|empire|campaign|technopuritan|navy|yoke/i.test(words), 'nothing in the film speaks of the ship, the empire or a campaign');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 5000 });
    check(await page.evaluate(() => window.__bfIntro === 'skipped' && localStorage.getItem('broodfall-intro-seen') === '1'), 'Esc skips it, and it is marked as seen');

    // ---- mission 1 ----
    await board(page);
    await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('hidden'), null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    const m1 = await page.evaluate(() => ({
      url: location.search, goals: document.getElementById('board-goals').classList.contains('hidden'),
      menu: document.getElementById('menu').classList.contains('hidden'), campaign: document.getElementById('campaign').classList.contains('hidden'),
      hint: document.getElementById('hint').textContent, text: document.getElementById('frame').innerText,
      intel: window.broodfall.sim.waveIntelHidden, dir: window.broodfall.sim.directive,
    }));
    check(m1.url === '' && m1.menu && m1.campaign, 'straight into mission 1: no menu, no ship');
    check(m1.goals, 'no Requisition Board over mission 1');
    check(!/requisition|standing|territor|faction|globe|procreation|licen|yoke|gene bay/i.test(m1.text), 'no campaign word on the mission 1 screen');
    check(/YOUR FIRST LIMB/.test(m1.hint), `the coach says the one thing to do: "${m1.hint.slice(0, 80)}"`);
    check(!m1.intel && m1.dir.kind === 'hold' && m1.dir.waves === 5, 'mission 1: hold 5 waves, the gate of the assault shown');
    await shot(page, '04-mission1-start');
    // A limb grown by real clicks: the first card, then a block it can stand on.
    // A card the meat pays for and a block it can stand on, whose point on the screen a click really
    // reaches (roofs stand up off the ground). The hand is the seed's: any card may come first.
    const spot = await page.evaluate(() => {
      const b = window.broodfall;
      const r = b.renderer.app.canvas.getBoundingClientRect();
      for (let i = 0; i < b.sim.hand.length; i++) {
        const fam = b.sim.hand[i].family;
        for (const cell of b.buildableCells(800)) {
          if (!b.sim.groundFor(cell, fam, b.sim.facingTowardGate(b.sim.cellCenter(cell)))) continue;
          const p = b.sim.cellCenter(cell);
          const s = b.worldToScreen(p.x, p.y);
          const x = r.left + s.x * (r.width / s.vw);
          const y = r.top + s.y * (r.height / s.vh);
          if (x < r.left + 40 || x > r.right - 40 || y < r.top + 40 || y > r.bottom - 40) continue;
          if (b.cellAtClient(x, y) === cell) return { x, y, cell, card: i };
        }
      }
      return null;
    });
    check(!!spot, 'a card in the hand has a block to stand on');
    await page.locator('#hand .card').nth(spot.card).click();
    await page.mouse.move(spot.x, spot.y);
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(700);
    const grown = await page.evaluate(() => ({ n: window.broodfall.sim.towers.length, hint: document.getElementById('hint').textContent }));
    check(grown.n === 1, `a click on a card and a click on the block grow a limb (${grown.n})`);
    check(/GOOD/.test(grown.hint), `the coach moves on: "${grown.hint.slice(0, 80)}"`);
    await shot(page, '05-mission1-first-limb');
    await endRun(page, 'lost');
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(1500);
    const rep = await page.locator('#debrief').innerText();
    check(/FOUGHT BACK/.test(rep) && /CONTINUE/.test(rep) && !/standing earned|requisition|ship|territor/i.test(rep), 'a plain report, and CONTINUE (no forms, no ship)');
    await shot(page, '06-mission1-lost-report');

    // ---- the ship: the first reveal ----
    const g1 = await aboard(page, '#debrief-ship');
    check(g1 === 'first-lost', `the ship, and YOKE greets him: ${g1}`);
    await page.waitForFunction(() => /suck at genocide/.test(document.querySelector('.cp-icom .cp-talk')?.textContent ?? ''), null, { timeout: 20000 });
    await page.waitForTimeout(400);
    await shot(page, '07-ship-first-greeting');
    const stage = await page.evaluate(() => ({ live: !!document.querySelector('.cp-icom .cp-yoke-live'), state: document.querySelector('.cp-icom .cp-yoke-live')?.dataset.state }));
    check(stage.live, `her body is on the intercom's stage (${stage.state})`);
    // The boss's message comes after her lines (content/boss.ts), before her last word on it.
    await page.waitForSelector('#boss-call', { timeout: 60000 });
    await page.waitForFunction(() => (document.querySelector('#boss-call .bc-caption')?.textContent ?? '').length > 10, null, { timeout: 15000 });
    await page.waitForTimeout(600);
    const boss = await page.evaluate(() => ({ plate: document.querySelector('#boss-call .bc-plate')?.textContent, video: !!document.querySelector('#boss-call video'), caption: document.querySelector('#boss-call .bc-caption')?.textContent }));
    check(/STEADFAST BARNABAS/.test(boss.plate ?? ''), `a message from the boss: ${boss.plate} (${boss.video ? 'his clip' : 'no clip'}) "${(boss.caption ?? '').slice(0, 50)}"`);
    await shot(page, '07b-boss-message');
    await page.locator('#boss-call').click();
    await page.waitForFunction(() => !document.getElementById('boss-call'), null, { timeout: 5000 });
    await greeted(page);
    const said = await icomText(page);
    check(/message from the boss/.test(said) && /budget/.test(said), 'YOKE around him: "a message from the boss" before, the budget after');
    check(/Top ten/.test(said) && /promotion/.test(said) && /upgrade the bioweapon/.test(said), 'all four of Collins\'s lines were said, in order');
    check(state.spoken >= 4, `each line was spoken in her voice (${state.spoken} /speak calls, mocked)`);
    check(state.sent.length === 0, 'no mind was asked for the greeting (no /message)');
    const desk = await page.evaluate(() => ({ dark: !!document.querySelector('.cp-desk-dark'), globe: !!document.querySelector('.globe'), beckon: document.querySelector('.cp-room.beckon')?.dataset.room, go: document.querySelector('.cp-icom-go')?.textContent }));
    check(desk.dark && !desk.globe, 'the Directive Desk is dark: AWAITING CLEARANCE, no globe');
    check(desk.beckon === 'genes' && /GENE BAY/.test(desk.go ?? ''), '"check it out" leads somewhere: the Gene Bay lit, and a button to it');
    await shot(page, '08-ship-desk-dark');
    await page.locator('.cp-icom-go').click();
    await page.waitForSelector('[data-room="genes"].on');
    const genes = await page.evaluate(() => ({ standing: JSON.parse(localStorage.getItem('broodfall-campaign')).standing, can: document.querySelectorAll('.cp-lin button[data-buy]').length }));
    check(genes.standing === 4, `the mission's data paid: standing ${genes.standing}`);
    await shot(page, '09-ship-gene-bay');
    // ---- the ship's own pick ----
    await page.locator('[data-room="desk"]').click();
    const pick = await page.locator('.cp-desk-dark [data-act="deploy-assigned"]').getAttribute('data-site');
    check(pick === 'cul-de-sac', `Command assigns the next deployment: ${pick}`);
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
    await board(page);
    await page.waitForTimeout(800);
    check(await page.evaluate(() => !document.getElementById('board-goals').classList.contains('hidden')), 'a second deployment is a campaign deployment (its board is up)');
    await endRun(page, 'lost');
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 15000 });
    const g2 = await aboard(page, '[data-act="back"]');
    check(g2 === 'mate-review', `the next return: the mate review (${g2})`);
    await greeted(page);
    const mate = await icomText(page);
    check(/under review/.test(mate) && /data pad in your room/.test(mate), 'Collins\'s mate-review lines, to the last one');
    check(await page.evaluate(() => document.querySelector('.cp-room.beckon')?.dataset.room === 'quarters'), 'his quarters are lit');
    await shot(page, '10-ship-mate-review');
    await page.locator('.cp-icom-go').click();
    await page.waitForSelector('.cp-pad');
    const pad = await page.locator('.cp-pad').innerText();
    check(/CANDIDATE PARTNER PROFILE/.test(pad) && /UNDER REVIEW/.test(pad), 'the data pad holds the candidate\'s file');
    await shot(page, '11-quarters-data-pad');
    check(await page.evaluate(() => !!document.querySelector('.cp-desk-dark') || !!document.querySelector('[data-room="desk"][data-dark="1"]')), 'the desk is still dark after a loss');
    // ---- lost once more: the cat girl (after the mate review, which it plays off) ----
    await page.locator('[data-room="desk"]').click();
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
    await board(page);
    await page.waitForTimeout(600);
    await endRun(page, 'lost');
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 15000 });
    const gc = await aboard(page, '[data-act="back"]');
    check(gc === 'catgirl', `the next return: the cat girl (${gc})`);
    await greeted(page);
    check(/pound sand/.test(await icomText(page)) && /Oh well/.test(await icomText(page)), 'Collins\'s cat-girl lines, to the last one');
    await page.locator('.cp-icom-go').click();
    await page.waitForSelector('.cp-inbox');
    check(/DECLINED ON YOUR BEHALF/.test(await page.locator('.cp-inbox').innerText()), 'her letter is in his inbox, declined for him');
    await shot(page, '11b-quarters-inbox');
    // ---- a win clears the desk ----
    await page.locator('[data-room="desk"]').click();
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
    await board(page);
    await page.waitForTimeout(600);
    await endRun(page, 'won');
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 15000 });
    const g3 = await aboard(page, '[data-act="back"]');
    check(g3 === 'unlock', `the win clears the desk, and she says so: ${g3}`);
    check(await page.locator('.cp-scene').count() === 0, 'the planet\'s calls wait until she has finished');
    await greeted(page);
    check(/Broh, that was sick/.test(await icomText(page)), 'Collins\'s unlock lines');
    await page.waitForSelector('.cp-scene', { timeout: 5000 });
    const calls = [];
    for (let i = 0; i < 3; i++) {
      const card = await page.locator('.cp-scene').innerText();
      calls.push(card.split('\n').find((l) => /CALL \d OF 3/.test(l)) ?? '');
      if (i === 0) await shot(page, '12-first-contact-1-of-3');
      if (i < 2) await page.locator('.cp-scene [data-act="scene-later"]').click();
    }
    check(calls.every((c, i) => c.includes(`CALL ${i + 1} OF 3`)), `all three call, one after the other: ${calls.map((c) => c.slice(0, 40)).join(' | ')}`);
    check(/DELEGATION|FAITHFUL|INSTITUTE/.test(calls.join(' ')), 'the callers are the factions');
    await page.locator('.cp-scene [data-act="scene-later"]').click();
    // He walks away from her: the intercom closes, she stays aboard.
    await page.locator('.cp-icom [data-act="icom-close"]').click();
    await page.locator('[data-room="desk"]').click();
    await page.waitForSelector('.globe', { timeout: 10000 });
    check(true, 'the Directive Desk is open: the globe, landing sites to choose');
    await shot(page, '13-desk-open');
    // ---- YOKE summoned from another room ----
    await page.locator('[data-room="genes"]').click();
    await page.locator('[data-act="yoke-call"]').click();
    await page.waitForSelector('.cp-icom .cp-yoke-live');
    await page.locator('#icom-input').fill('Who were those three?');
    await page.locator('[data-act="icom-send"]').click();
    await page.waitForFunction(() => window.__yoke.ctl, null, { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__yoke.say({ type: 'speech', text: 'Three delegations, one planet, zero shame. Pick whichever makes you laugh most.', emotion: 'happy' }));
    await page.waitForFunction(() => /zero shame/.test(document.querySelector('.cp-icom .cp-talk')?.textContent ?? ''), null, { timeout: 15000 });
    check(state.sent.some((m) => /Who were those three/.test(m) && /greeted him with/.test(m)), 'summoned over the Gene Bay, his line reaches her mind with what she had just said to him');
    await shot(page, '14-yoke-summoned-gene-bay');
    // ---- "print yourself a body" (content/yokeScenes.ts): the scene over the ship, her line, once ----
    const beforeSent = state.sent.length;
    await page.locator('#icom-input').fill('Can you print yourself a body?');
    await page.locator('[data-act="icom-send"]').click();
    await page.waitForSelector('#yoke-scene', { timeout: 5000 });
    await page.waitForTimeout(1500);
    const real = await page.evaluate(() => document.getElementById('yoke-scene').dataset.placeholder !== '1');
    await shot(page, '14b-print-body-scene');
    await page.waitForFunction(() => document.querySelector('#yoke-scene .ys-sub.on'), null, { timeout: 30000 });
    check(/That was gross/.test(await page.locator('#yoke-scene .ys-sub').innerText()), `the body is printed, dies, and her voice comes from the speakers (${real ? 'the real clips' : 'storyboard cards: the clips are not made yet'})`);
    await shot(page, '14c-print-body-voice');
    await page.waitForFunction(() => !document.getElementById('yoke-scene'), null, { timeout: 30000 });
    check(state.sent.length === beforeSent && /want to eat it/.test(await icomText(page)), 'no mind was asked; her line is in the talk afterwards');
    await page.locator('#icom-input').fill('Print a body again?');
    await page.locator('[data-act="icom-send"]').click();
    await page.waitForFunction(() => /Once was plenty/.test(document.querySelector('.cp-icom .cp-talk')?.textContent ?? ''), null, { timeout: 20000 });
    check(await page.locator('#yoke-scene').count() === 0, 'asked again, she refuses (once a campaign)');
    // ---- quit, relaunch: the ship's console ----
    await Promise.all([page.waitForURL((u) => !u.search), page.locator('[data-act="quit"]').click()]);
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#menu.console-menu:not(.hidden)');
    check(await page.evaluate(() => !document.getElementById('intro')), 'a later launch opens on the menu, not the film');
    await page.waitForFunction(() => { const v = document.querySelector('.menu-video'); return v && v.readyState >= 2 && v.currentTime > 0.5; }, null, { timeout: 20000 }).catch(() => {});
    const vid = await page.evaluate(() => { const v = document.querySelector('.menu-video'); return { src: v.currentSrc, loop: v.loop, t: v.currentTime, playing: !v.paused }; });
    check(/menu\.mp4/.test(vid.src) && vid.loop && vid.playing, `the menu's background is the viewport's loop, playing (${vid.t.toFixed(1)}s)`);
    const items = await page.locator('.menu-list').innerText();
    check(/CONTINUE/.test(items) && /NEW CAMPAIGN/.test(items) && /SKIRMISH/.test(items) && /REPLAY THE OPENING/.test(items) && /SETTINGS/.test(items), 'continue, new campaign, skirmish, replay the opening, settings');
    await shot(page, '15-menu-console');
    await page.locator('#menu-settings').click();
    await page.waitForTimeout(400);
    await shot(page, '16-menu-settings');
    // The settings screen (src/ui/settings.ts) is a dialog over the menu: Esc closes it.
    if (await page.locator('#settings').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    const g4 = await aboard(page, '#menu-campaign');
    check(!!g4, `CONTINUE: aboard, and she greets him again (${g4})`);
    await page.waitForTimeout(1200);
    await shot(page, '17-continue-greeting');
    check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.slice(0, 4).join(' | ')}` : 'no page errors');
    await ctx.close();
  }

  // ================================================================ B: mission 1 won
  if (want('B')) {
    console.log('B: mission 1 won: the desk opens only at the NEXT win');
    const { ctx, page, errors } = await newPlayer(browser);
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#intro', { timeout: 10000 });
    await page.locator('#intro').click();
    await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 5000 });
    check(true, 'a click skips the film');
    await board(page);
    await page.waitForTimeout(800);
    await endRun(page, 'won');
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 10000 });
    await page.waitForTimeout(1200);
    check(/THE TOWN IS YOURS/.test(await page.locator('#debrief').innerText()), 'mission 1 won: its plain report');
    await shot(page, '18-mission1-won-report');
    const g = await aboard(page, '#debrief-ship');
    check(g === 'first-won', `YOKE: ${g}`);
    await page.waitForFunction(() => /duck to water/.test(document.querySelector('.cp-icom .cp-talk')?.textContent ?? ''), null, { timeout: 20000 });
    await shot(page, '19-ship-first-won-greeting');
    await greeted(page);
    check(/killer whales/.test(await icomText(page)) && /budget/.test(await icomText(page)), 'Collins\'s won lines to the last one, then the boss, then her word on him');
    check(await page.locator('.cp-desk-dark').count() === 1, 'mission 1 won: the desk is STILL dark');
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')).pendingScenes.length === 0), 'and nobody from the planet has called');
    // Relaunching now: the menu (mission 1 is over), not the film, not mission 1.
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#menu.console-menu:not(.hidden)');
    check(await page.evaluate(() => !document.getElementById('intro')), 'relaunched after mission 1: the menu');
    await aboard(page, '#menu-campaign');
    await greeted(page);
    await page.locator('.cp-icom [data-act="icom-close"]').click();
    await page.locator('[data-room="desk"]').click();
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
    await board(page);
    await page.waitForTimeout(600);
    await endRun(page, 'won');
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 15000 });
    const g2 = await aboard(page, '[data-act="back"]');
    check(g2 === 'unlock', `the second win clears the desk: ${g2}`);
    await greeted(page);
    await page.waitForSelector('.cp-scene', { timeout: 5000 });
    check(/CALL 1 OF 3/.test(await page.locator('.cp-scene').innerText()), 'and the three call');
    check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.slice(0, 4).join(' | ')}` : 'no page errors');
    await ctx.close();
  }

  // ================================================================ C: the film again, from the menu
  if (want('C')) {
    console.log('C: REPLAY THE OPENING from the menu');
    const { ctx, page, errors } = await newPlayer(browser);
    await page.goto(`${URL0}?seed=1`, { waitUntil: 'load', timeout: 180000 });
    await page.evaluate(() => { localStorage.removeItem('broodfall-campaign'); localStorage.removeItem('broodfall-campaign-pending'); localStorage.setItem('broodfall-intro-seen', '1'); localStorage.setItem('broodfall-meta', JSON.stringify({ standing: 0, genes: [], runs: 1 })); });
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#menu.console-menu:not(.hidden)');
    check(await page.locator('#menu-campaign').isHidden(), 'no campaign on record: no CONTINUE');
    await page.locator('#menu-intro').click();
    await page.waitForSelector('#intro');
    await page.waitForFunction(() => document.querySelector('#intro .intro-title.on'), null, { timeout: 15000 });
    await shot(page, '20-replay-opening');
    await page.locator('#intro').click();
    await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 5000 });
    check(await page.locator('#menu.console-menu:not(.hidden)').count() === 1, 'the film plays over the menu, and the menu is there after it');
    check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.slice(0, 4).join(' | ')}` : 'no page errors');
    await ctx.close();
  }
  console.log(failed ? `ONBOARDING BEAT: ${failed} failed` : 'ONBOARDING BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
