/**
 * The cut scenes' beat (Collins, Oct 3 2026), real clicks, the player's path:
 * menu → NEW CAMPAIGN → mission 1 (won) → the ship's pick (won) → YOKE announces the three groups (the laser, the radio,
 * and, embarrassed, the coloured cards in a field) → the Directive Desk: three signals on the planet, no calls waiting
 * → ANSWER the Delegation: its first contact plays as a FILM (the baked film, its line in type under it) → its card (the
 * perk siding would bring, the film's poster, the words folded away) → back to the planet → ANSWER the Faithful (no film
 * baked yet: its card, the words read) → SIDE WITH the Delegation, publicly: his broadcast's card → the signals are gone
 * → pick a landing site, DEPLOY: the Conscientious Objectors' pick shows, with only the kinds this mission would bring →
 * pick one, deploy: the run has it banned → win → the next scene's card carries its perk.
 *
 * Then THE BREAKER (PLAYTEST_PROTOCOL.md): saves from before Oct 3 2026 (the three contact calls waiting; an Institute
 * route with the ultimatum's choice and the old reveal card waiting; a Delegation route that saw the beat that is gone),
 * a double click on ANSWER, Esc hammered, the poster clicked twice, siding from Comms, and the Objectors' pick abused.
 *
 *   node tools/shot-cutscenes.mjs [--build]     (its own build, dist-cutscenes, served on 5297)
 *   node tools/shot-cutscenes.mjs --dev         (the dev server, which is what `npm start` and the .bat launcher run)
 * Writes notes/screens/2026-10-03/cutscenes-*.jpg.
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const PORT = Number(process.env.BROODFALL_PORT || 5297);
const DIST = process.env.BROODFALL_DIST || 'dist-cutscenes';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-03');
mkdirSync(out, { recursive: true });
const env = { ...process.env, BROODFALL_PORT: String(PORT), BROODFALL_DIST: DIST };
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const DEV = process.argv.includes('--dev');
if (!DEV && (process.argv.includes('--build') || !existsSync(join(root, DIST, 'index.html')))) {
  console.log(`building into ${DIST} ...`);
  const b = spawnSync(process.execPath, [vite, 'build'], { cwd: root, env, encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
}
function freePort() {
  try {
    const o = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of o.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
freePort();
const server = spawn(process.execPath, DEV ? [vite, '--port', String(PORT), '--strictPort'] : [vite, 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, env: { ...env, BROODFALL_NO_HMR: '1' }, stdio: 'pipe' });
console.log(DEV ? 'on the dev server (what npm start runs)' : `on the build in ${DIST}`);
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('the server did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = (page, name) => page.screenshot({ path: join(out, `cutscenes-${name}.jpg`), type: 'jpeg', quality: 84 });
const brief = (t) => t.slice(0, 90).replace(/\s+/g, ' ');

async function win(page) {
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
}
/** Her greeting: click her words until she has said `until` (or it is over), then close the intercom. */
async function hearGreeting(page, until) {
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
  let text = '';
  for (let i = 0; i < 60; i++) {
    text = await page.locator('.cp-icom .cp-talk').innerText().catch(() => '');
    if (!until || until.test(text)) break;
    await page.locator('.cp-icom .cp-talk').click({ force: true }).catch(() => {});
    await page.waitForTimeout(350);
  }
  return text;
}

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + PORT + '/?seed=5', { waitUntil: 'load' });
  await page.evaluate(() => {
    for (const k of ['broodfall-campaign', 'broodfall-campaign-pending', 'broodfall-media', 'broodfall-roach', 'broodfall-media-auto']) localStorage.removeItem(k);
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
  });
  await page.reload({ waitUntil: 'load' });
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
  await win(page);
  await page.waitForSelector('#debrief:not(.hidden)', { timeout: 45000 });
  await page.locator('#debrief-ship').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
  await win(page);
  await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 45000 });
  await page.locator('[data-act="back"]').click();

  // ---- YOKE announces them: the laser and the radio plainly, the cards last and embarrassed.
  const said = await hearGreeting(page, /coloured cards in a field[\s\S]*Directive Desk/);
  check(/trying to form an alliance/.test(said), `she says groups have reached out: "${brief(said)}"`);
  const laser = said.indexOf('observatory laser'), radio = said.indexOf('radio station'), cards = said.indexOf('coloured cards in a field');
  check(laser > 0 && radio > laser && cards > radio, 'she states the laser, then the radio, and the coloured cards last, as an afterthought');
  check(/And, um\.\.\. someone left coloured cards in a field\./.test(said), 'the cards are said with embarrassment ("And, um...")');
  check(/They're all marked on the planet at the Directive Desk\. Answer whoever you like\. Then pick one to side with/.test(said), 'she sends him to the planet at the Directive Desk, to answer them and to side with one');
  await shot(page, '1-yoke-announces');
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  await page.waitForTimeout(300);

  // ---- The desk: three signals, no call waiting.
  await page.locator('[data-room="desk"]').click();
  await page.waitForTimeout(600);
  check(!(await page.locator('.cp-scene').count()), 'no call is waiting: the three are signals on the planet');
  check((await page.locator('.cp-signals .cp-signal').count()) === 3, 'three signal cards beside the planet');
  check((await page.locator('.globe .signal').count()) === 3, 'three signal markers on the planet');
  const sig = await page.locator('.cp-signals').innerText();
  check(/coloured cards in a field/i.test(sig) && /a laser on the hull/i.test(sig) && /radio station/i.test(sig), 'each says how it reaches the ship');
  check((await page.locator('.cp-signals [data-ally]').count()) === 0, 'he cannot side with a group he has not answered yet');
  await shot(page, '2-desk-signals');
  // A marker on the planet picks its card.
  const marker = page.locator('.globe .signal:not(.behind)').first();
  if (await marker.count()) {
    const id = await marker.getAttribute('data-signal');
    await marker.click({ force: true });
    await page.waitForTimeout(200);
    check((await page.locator(`.cp-signals .cp-signal.sel[data-signal="${id}"]`).count()) === 1, `a marker on the planet picks its card (${id})`);
  }

  // ---- Answer the Delegation: its first contact is a film.
  await page.evaluate(() => localStorage.setItem('broodfall-media-auto', 'on'));
  await page.locator('.cp-signals [data-meet="delegation"]').click();
  await page.waitForSelector('#newsreel.cs-film video', { timeout: 15000 });
  // BY DEFAULT NO WORDS ARE SET OVER THE PICTURE (Collins, Oct 4 2026: "the words over the screen look dumb ... make the
  // default no and have it an option in settings"): while her first line is being said, nothing is in type under it.
  await page.waitForFunction(() => window.__bfScenes.state().playing?.cue === 'l00', null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  const plain = await page.evaluate(() => ({ cue: window.__bfScenes.state().playing?.cue, on: !!document.querySelector('.cs-sub.on'), text: document.querySelector('.cs-sub')?.innerText ?? '' }));
  check(plain.cue === 'l00' && !plain.on && !plain.text.trim(), 'by default no words are set over the film (the line is heard, not read)');
  await shot(page, '3a-film-no-words');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#newsreel', { state: 'detached', timeout: 10000 }).catch(() => {});
  // Settings → Subtitles on films: the same film again, with the line being said in type under it.
  // (Turned on the way he would: back to the planet, the gear, the switch, close; then the first contact again.)
  await page.locator('.cp-scene [data-act="scene-later"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-act="settings"]').first().click();
  const sw = page.locator('.st-toggle[data-toggle="subtitles"]');
  await sw.waitFor({ timeout: 10000 });
  check((await sw.innerText()).trim() === 'OFF', 'Settings: "Subtitles on films" is there, and OFF by default');
  await sw.click();
  check((await page.locator('.st-toggle[data-toggle="subtitles"]').innerText()).trim() === 'ON', 'a click turns it on');
  await shot(page, '3b-settings-subtitles');
  await page.locator('.st-close').click();
  await page.waitForTimeout(300);
  await page.locator('.cp-signals [data-meet="delegation"]').click();
  await page.waitForSelector('#newsreel.cs-film video', { timeout: 15000 });
  // (By the line itself, not by the clock: the film's timing changes when it is made again.)
  await page.waitForFunction(() => { const s = document.querySelector('.cs-sub'); return s?.classList.contains('on') && /Welcome, welcome/.test(s.innerText); }, null, { timeout: 40000 });
  const st = await page.evaluate(() => { const v = document.querySelector('#newsreel.cs-film video'); return { t: v.currentTime, muted: v.muted, paused: v.paused, w: v.videoWidth, film: document.querySelector('#newsreel').dataset.film, sub: document.querySelector('.cs-sub')?.innerText ?? '', on: document.querySelector('.cs-sub')?.classList.contains('on') }; });
  check(st.film === 'delegation-understand' && st.w === 1280 && !st.paused, `the film plays full screen: ${st.film}, ${st.w} px wide, at ${st.t.toFixed(1)} s`);
  check(!st.muted, 'with its sound (not muted)');
  check(st.on && /DELEGATE/i.test(st.sub) && /Welcome, welcome/.test(st.sub), `with Subtitles on in Settings, the line being said is set in type under it: "${brief(st.sub)}"`);
  await shot(page, '3-film-delegate');
  await page.waitForFunction(() => /You are happy to see me/.test(document.querySelector('.cs-sub')?.innerText ?? ''), null, { timeout: 30000 });
  const sub2 = await page.locator('.cs-sub').innerText();
  check(/YOU/i.test(sub2) && /You are happy to see me\. Why\?/.test(sub2), `and his answer after it: "${brief(sub2)}"`);
  await shot(page, '4-film-you');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#newsreel', { state: 'detached', timeout: 5000 });
  const card = await page.locator('.cp-scene').innerText();
  check(/FIRST CONTACT · THE FRIENDSHIP DELEGATION/.test(card) && /THE FIRST SUMMIT/.test(card), `Esc skips to its card: "${brief(card)}"`);
  check(/IF YOU SIDE WITH THEM/.test(card) && /Conscientious Objectors/.test(card), 'the card says what siding with them would bring');
  check((await page.locator('.cp-scene .cp-scene-poster img').count()) === 1 && (await page.locator('.cp-scene details.cp-transcript').count()) === 1, 'the film\'s poster plays it again; the words are folded under THE WORDS');
  check(/SIDE WITH THE FRIENDSHIP DELEGATION, PUBLICLY/.test(card) && /BACK TO THE PLANET/.test(card), 'two ways on: side with them, or hear the others');
  await shot(page, '5-card-after-film');
  await page.locator('.cp-scene .cp-scene-poster').click();
  await page.waitForSelector('#newsreel.cs-film video', { timeout: 8000 });
  check(true, 'the poster plays the film again');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#newsreel', { state: 'detached', timeout: 5000 });
  await page.locator('.cp-scene [data-act="scene-later"]').click();
  await page.waitForTimeout(200);
  check(!(await page.locator('.cp-scene').count()) && (await page.locator('.cp-signals [data-ally="delegation"]').count()) === 1, 'back at the planet: the Delegation can now be sided with');

  // ---- Answer the Faithful: its first contact is a film too since Oct 5 2026 (made by the film system); then its card.
  await page.locator('.cp-signals [data-meet="faithful"]').click();
  await page.waitForSelector('#newsreel.cs-film video', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#newsreel.cs-film video')?.currentTime > 2, null, { timeout: 40000 });
  check(await page.evaluate(() => document.querySelector('#newsreel')?.dataset.film) === 'faithful-signs', 'the first contact of the Faithful plays as its film');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#newsreel', { state: 'detached', timeout: 5000 });
  await page.waitForSelector('.cp-scene', { timeout: 5000 });
  const fai = await page.locator('.cp-scene').evaluate((el) => el.textContent ?? '');
  check(/Your coming was prophesied in our texts/.test(fai) && /suicide vests/.test(fai), `then its card, its words under THE WORDS: "${brief(fai)}"`);
  await shot(page, '6-card-no-film');
  await page.locator('.cp-scene [data-act="scene-later"]').click();

  // ---- Side with the Delegation, publicly.
  await page.locator('.cp-signals [data-ally="delegation"]').click();
  // His broadcast is a film too since Oct 4 2026 (made by the film system at 480p): it plays by itself, then its card.
  await page.waitForSelector('#newsreel.cs-film video', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#newsreel.cs-film video')?.currentTime > 2, null, { timeout: 40000 });
  const pf = await page.evaluate(() => { const v = document.querySelector('#newsreel.cs-film video'); return { film: document.querySelector('#newsreel').dataset.film, muted: v.muted, paused: v.paused, sub: document.querySelector('.cs-sub')?.innerText ?? '' }; });
  check(pf.film === 'delegation-pledge' && !pf.paused && !pf.muted, `siding with them plays his broadcast as a film (${pf.film}), with its sound`);
  check(/People of this planet/.test(pf.sub), `and, with Subtitles on, its words: "${brief(pf.sub)}"`);
  await shot(page, '7a-pledge-film');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#newsreel', { state: 'detached', timeout: 5000 });
  await page.waitForSelector('.cp-scene', { timeout: 5000 });
  // The card: its words are folded under THE WORDS (they were just heard); the text content has them.
  const pledge = await page.locator('.cp-scene').evaluate((el) => el.textContent ?? '');
  check(/YOUR BROADCAST TO THE PLANET · SIDING WITH THE FRIENDSHIP DELEGATION/i.test(pledge) && /We come in peace\./.test(pledge), `then its card: "${brief(pledge)}"`);
  check(!(await page.locator('.cp-scene .tl-band').count()), 'his own broadcast carries no translation band (nobody is being translated)');
  await shot(page, '7-pledge');
  await page.locator('.cp-scene [data-act="scene-ok"]').click();
  await page.waitForTimeout(200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')));
  check(saved.faction === 'delegation' && saved.beatsSeen.includes('understand') && saved.met.includes('delegation') && saved.met.includes('faithful'), `saved: sided with ${saved.faction}, beats ${saved.beatsSeen.join(',')}, met ${saved.met.join(',')}`);
  check(!(await page.locator('.cp-signals').count()) && !(await page.locator('.globe .signal').count()), 'the signals are gone from the planet');

  // ---- The Objectors' pick, at the start of the mission, from the kinds it would bring.
  await page.evaluate(() => localStorage.removeItem('broodfall-media-auto'));
  for (let i = 0; i < 12 && !(await page.locator('.globe .site.open:not(.behind)').count()); i++) { await page.locator('[data-act="spin-r"]').click(); await page.waitForTimeout(400); }
  await page.locator('.globe .site.open:not(.behind)').first().click({ force: true });
  await page.waitForTimeout(200);
  check(/CONSCIENTIOUS OBJECTORS: when you deploy/.test(await page.locator('.cp-brief').innerText()), 'the briefing says the pick comes when he deploys');
  await page.locator('[data-act="deploy"]').click();
  await page.waitForSelector('.cp-objectors', { timeout: 5000 });
  const kinds = await page.locator('.cp-objectors [data-obj]').allInnerTexts();
  const site = await page.locator('.globe .site.sel').getAttribute('data-site');
  const hold = Number(((await page.locator('.cp-brief').innerText()).match(/Hold for (\d+) waves/) ?? [])[1] ?? 0);
  // 21 war kinds in all; a hold of 6 waves or fewer never fields the last row of the wave table (tunnelers).
  check(kinds.length >= 5 && new Set(kinds).size === kinds.length && (hold === 0 || hold > 6 || (kinds.length < 21 && !kinds.some((k) => /Tunneler/i.test(k)))),
    `the pick shows the kinds this mission would bring (${site}${hold ? `, hold ${hold}` : ''}): ${kinds.length} of 21: ${kinds.join(', ')}`);
  await page.locator('.cp-objectors [data-obj]').nth(2).click();
  const go = await page.locator('.cp-objectors [data-act="obj-go"]').innerText();
  check(/WILL NOT COME/.test(go), `one picked: "${go}"`);
  await shot(page, '8-objectors-pick');
  const picked = (await page.locator('.cp-objectors [data-obj].on').getAttribute('data-obj'));
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('.cp-objectors [data-act="obj-go"]').click()]);
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 60000 });
  const banned = await page.evaluate(() => window.broodfall.sim.cfg?.bannedEnemies ?? null);
  check(Array.isArray(banned) && banned.length === 1 && banned[0] === picked, `the run has it kept home: ${JSON.stringify(banned)}`);
  await win(page);
  await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 45000 });
  await page.locator('[data-act="back"]').click();
  await hearGreeting(page, null);
  await page.locator('.cp-icom [data-act="icom-close"]').click().catch(() => {});
  await page.waitForSelector('.cp-scene', { timeout: 8000 });
  const next = await page.locator('.cp-scene').innerText();
  check(/THE LEAKED PLANS/.test(next) && /PERK/.test(next) && /The Translator/.test(next), `the next scene's card carries its perk: "${brief(next)}"`);
  await shot(page, '9-next-beat');
  // ================================================================= THE BREAKER
  console.log('the breaker:');
  const base = 'http://localhost:' + PORT + '/?seed=5';
  const sided = await page.evaluate(() => localStorage.getItem('broodfall-campaign'));
  /** Put a save in (the sided one, changed by `mutate`), come aboard from the menu, past her greeting. */
  const load = async (mutate) => {
    await page.goto(base, { waitUntil: 'load' });
    await page.evaluate(({ json, fn }) => {
      const st = JSON.parse(json);
      new Function('s', fn)(st);
      localStorage.setItem('broodfall-campaign', JSON.stringify(st));
      localStorage.removeItem('broodfall-campaign-pending');
      localStorage.removeItem('broodfall-media-auto');
    }, { json: sided, fn: mutate });
    await page.reload({ waitUntil: 'load' });
    await page.locator('#menu-campaign').first().click();
    await page.waitForSelector('#campaign:not(.hidden)', { timeout: 30000 });
    for (let i = 0; i < 12; i++) {
      const x = page.locator('.cp-icom [data-act="icom-close"]');
      if (await x.count()) { await x.click().catch(() => {}); break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(300);
  };
  // 1. A save from before Oct 3: nobody sided with, the three contact calls waiting.
  await load(`s.faction = null; s.factionSince = 0; s.beatsSeen = []; delete s.met; s.greet = null;
    s.pendingScenes = ['delegation', 'faithful', 'institute'].map((f) => ({ faction: f, contact: true, scene: { title: 'A Letter, Written in the Crops', picture: 'delegation-contact', lines: ['Delegate (in the wheat): Dear Visitor.'] } }));`);
  await page.locator('[data-room="desk"]').click();
  await page.waitForTimeout(400);
  check(!(await page.locator('.cp-scene').count()) && (await page.locator('.cp-signals .cp-signal').count()) === 3, 'an old save with the three calls waiting: the calls are dropped, the three are signals at the desk');
  // 2. Double click on ANSWER, Esc hammered, the poster clicked twice: one film at a time, nothing breaks.
  await page.evaluate(() => localStorage.setItem('broodfall-media-auto', 'on'));
  await page.locator('.cp-signals [data-meet="delegation"]').dblclick({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  check((await page.locator('#newsreel').count()) <= 1, 'ANSWER double-clicked: at most one film is up');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(120); }
  await page.waitForTimeout(700);
  check(!(await page.locator('#newsreel').count()) && (await page.locator('.cp-scene .cp-scene-poster').count()) === 1 && !(await page.locator('#settings:not(.hidden)').count()), 'Esc hammered: the film is gone and its card is up (Esc opened nothing else)');
  await page.locator('.cp-scene .cp-scene-poster').click();
  await page.locator('.cp-scene .cp-scene-poster').click({ force: true, timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(1600);
  check((await page.locator('#newsreel').count()) <= 1, 'the poster clicked twice: at most one film');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#newsreel', { state: 'detached', timeout: 5000 }).catch(() => {});
  await page.evaluate(() => localStorage.removeItem('broodfall-media-auto'));
  await page.locator('.cp-scene [data-act="scene-later"]').click();
  // 3. Comms: a group not answered yet cannot be sided with there either; one that is, can.
  await page.locator('[data-room="comms"]').click();
  check((await page.locator('.cp-body [data-ally="institute"]').count()) === 0 && (await page.locator('.cp-body [data-meet="institute"]').count()) === 1 && (await page.locator('.cp-body [data-ally="delegation"]').count()) === 1,
    'Comms: the Institute can only be answered; the Delegation, answered, can be sided with');
  await page.locator('.cp-body [data-meet="institute"]').click();
  // (Films are off in this part: the cards are what is checked. A scene with a film folds its words under THE WORDS.)
  await page.waitForSelector('.cp-scene');
  check(/A LITTLE CHAT/.test(await page.locator('.cp-scene').evaluate((el) => el.textContent ?? '')), 'answering from Comms plays the first contact there');
  await page.locator('.cp-scene [data-ally="institute"]').click();
  await page.waitForTimeout(200);
  const pledge2 = await page.locator('.cp-scene').evaluate((el) => el.textContent ?? '');
  check(/FOR YOUR OWN SAFETY/.test(pledge2) && /greedy corporations/.test(pledge2), 'siding from its card: his broadcast for the Institute');
  await page.locator('.cp-scene [data-act="scene-ok"]').click();
  // 4. An Institute route saved before Oct 3: the ultimatum's choice made, the old reveal card waiting.
  await load(`s.faction = 'institute'; s.met = ['institute']; s.beatsSeen = ['machines', 'pipeline', 'ultimatum']; s.choices = { ultimatum: 'pacify' }; s.greet = null;
    s.pendingScenes = [{ faction: 'institute', scene: { title: 'The Queue Was Real', picture: 'institute-reveal-end', lines: ['The Director: Okay. Hi. Quick question. Where am I.', 'You: (log) Cut comms. Queue complete.'] } }];`);
  await page.waitForSelector('.cp-scene', { timeout: 8000 }).catch(() => {});
  const oldCard = await page.locator('.cp-scene').innerText().catch(() => '');
  check(/THE QUEUE WAS REAL/.test(oldCard) && /Where am I/.test(oldCard), 'an old save with a card of before waiting: it is shown as it was written, and continues');
  await page.locator('.cp-scene [data-act="scene-ok"]').click();
  await page.locator('[data-room="comms"]').click();
  const perks = await page.locator('.cp-body .cp-perks').innerText().catch(() => '');
  check(/Volunteers/.test(perks) && /Seed Labs/.test(perks) && !/undefined|pacified|kingdom/i.test(perks), `its perks are the route's own, the dropped choice gives nothing: "${brief(perks)}"`);
  await page.locator('[data-room="desk"]').click();
  await page.waitForTimeout(400);
  check((await page.locator('.globe .site.finale').count()) >= 1, 'its finale is open on the planet');
  // 5. A Delegation route that saw the beat that is gone ("hurry"): the desk draws, the finale is open, the pick is for two.
  await load(`s.faction = 'delegation'; s.met = ['delegation']; s.beatsSeen = ['understand', 'stop-war', 'gaia', 'reveal', 'hurry']; s.pendingScenes = []; s.greet = null;`);
  await page.locator('[data-room="desk"]').click();
  await page.waitForTimeout(400);
  check((await page.locator('.globe .site.finale').count()) >= 1, 'a Delegation save that saw the removed beat: the desk draws and its finale is open');
  for (let i = 0; i < 12 && !(await page.locator('.globe .site.open:not(.behind):not(.finale)').count()); i++) { await page.locator('[data-act="spin-r"]').click(); await page.waitForTimeout(400); }
  await page.locator('.globe .site.open:not(.behind):not(.finale)').first().click({ force: true });
  await page.locator('[data-act="deploy"]').click();
  await page.waitForSelector('.cp-objectors');
  // 6. The pick abused: three clicked when two are allowed, then cancelled, then deployed with nobody held back.
  for (const i of [0, 1, 2]) await page.locator('.cp-objectors [data-obj]').nth(i).click();
  check((await page.locator('.cp-objectors [data-obj].on').count()) === 2, 'More Objectors: three clicked, two stay picked');
  await page.locator('.cp-objectors [data-act="obj-cancel"]').click();
  check(!(await page.locator('.cp-objectors').count()) && (await page.locator('.cp-brief').count()) === 1, 'BACK TO THE BRIEFING closes the pick and deploys nothing');
  await page.locator('[data-act="deploy"]').click();
  await page.waitForSelector('.cp-objectors');
  check((await page.locator('.cp-objectors [data-obj].on').count()) === 0 && /EVERYONE COMES/.test(await page.locator('.cp-objectors [data-act="obj-go"]').innerText()), 'opened again, the pick starts empty and says so');
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('.cp-objectors [data-act="obj-go"]').click()]);
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 60000 });
  check(((await page.evaluate(() => window.broodfall.sim.cfg?.bannedEnemies ?? [])).length) === 0, 'deployed with nobody held back: the run bans nothing');
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `CUT SCENES BEAT: ${failed} failed` : 'CUT SCENES BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
