/**
 * THE PERSONAL PLOT, PLAYED (Collins, Oct 5 2026: "a general beat between what is now 4 and 5 that with YOKE text
 * introduces the motivation of being assigned a partner through the index and discussions on going there ... on what
 * is now 8, will be nine, you can add progress on that plot point"). Real page, real clicks, the outcome forced:
 *   A  four territories taken; the 5th won → YOKE's Index beat, then its discussion waits in the AI Core
 *   B  eight taken, the Index beat said; the 9th won → her progress beat (Maren's note), pointing at the quarters
 *   C  after an intro, the next ordinary return is never another intro
 *
 *   node tools/shot-personal.mjs [A] [B] [C]   (the game's own dev server, as `npm start` runs it, on BROODFALL_PORT, default 5244)
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'notes', 'screens', '2026-10-05');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5244);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = (page, name) => page.screenshot({ path: join(out, `personal-${name}.jpg`), type: 'jpeg', quality: 82 });
const GO = { waitUntil: 'domcontentloaded', timeout: 180000 };

function freePort() {
  try {
    for (const line of execSync('netstat -ano', { encoding: 'utf8' }).split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', env: { ...process.env, BROODFALL_PORT: String(PORT) } });
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('the dev server did not start')), 60000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(child); } });
  });
}

/** A campaign on the ship, past the early beats, with `patch`; then deploy, win (forced), and come back aboard. */
async function winFrom(page, patch) {
  await page.goto(`${URL0}?campaign=ship&open=1`, GO);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
  await page.evaluate((patch) => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    Object.assign(s, { onboard: { mission1: 'won', deskOpen: true }, said: ['mate-review', 'catgirl'], greet: null, staging: null, underAttack: null }, patch);
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    // Nothing of the planet's news or the Roach King between the report and the ship.
    localStorage.setItem('broodfall-roach', JSON.stringify({ seed: s.seed, seen: ['rk-address', 'rk-draft', 'rk-counter', 'rk-briefing', 'rk-delegation', 'rk-faithful', 'rk-institute', 'rk-stand'] }));
  }, patch);
  const target = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('broodfall-campaign')); return s; });
  await page.evaluate(() => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: 'temple', dares: [], objectors: [] })));
  void target;
  await page.goto(`${URL0}?campaign=run`, GO);
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 180000 });
  await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
  await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 60000 });
  await page.locator('[data-act="back"]').click();
  // Skip the planet's news if it plays.
  for (let t0 = Date.now(); Date.now() - t0 < 60000;) {
    if (await page.locator('#campaign:not(.hidden) .cp-icom').count()) break;
    if (await page.locator('#newsreel:not(.leaving)').count()) { await page.waitForTimeout(800); await page.keyboard.press('Escape'); }
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 30000 });
  return page.evaluate(() => document.getElementById('campaign').dataset.greeting);
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const held = ['crash-site', 'cul-de-sac', 'granary', 'harbor', 'commuter', 'foundry', 'mirewater', 'university', 'ossuary'];
try {
  if (want('A')) {
    console.log('A  the 5th territory: the Index');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const g = await winFrom(page, { held: held.slice(0, 5), captures: 4, deployments: 6, faction: 'delegation', factionSince: 1, contacted: ['delegation', 'faithful', 'institute'], met: ['delegation'], beatsSeen: ['understand', 'stop-war', 'gaia'], lastGreeting: 'won-1', greetingsSaid: ['won-1', 'back-5'] });
    check(g === 'partner-index', `her greeting on the 5th capture: the Index (${g})`);
    await page.waitForSelector('.cp-icom:not(.greeting)', { timeout: 120000 }).catch(() => {});
    const text = await page.locator('.cp-icom').innerText();
    check(/Index entry/.test(text) && /go down to the Index office and sign/.test(text), 'her lines: his Index entry, signing at the Index office in person');
    await shot(page, 'a1-index');
    await page.locator('.cp-icom [data-act="icom-close"]').click().catch(() => {});
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')));
    check(s.said.includes('partner-index') && s.ai.queue.includes('partner'), `said once, and the discussion waits (queue: ${s.ai.queue.join(', ')})`);
    await page.locator('[data-room="ai"]').click();
    await page.waitForTimeout(800);
    check(await page.locator('[data-engage="partner"]').count() === 1, 'the AI Core offers the discussion (ENGAGE / NOT NOW)');
    await shot(page, 'a2-ai-core');
    await ctx.close();
  }
  if (want('B')) {
    console.log('B  the 9th territory: how it is going');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const g = await winFrom(page, { held, captures: 8, deployments: 10, faction: 'faithful', factionSince: 1, contacted: ['delegation', 'faithful', 'institute'], met: ['faithful'], beatsSeen: ['signs', 'prophecy', 'prepare'], midpoint: { status: 'stayed', at: 7 }, said: ['mate-review', 'catgirl', 'partner-index'], lastGreeting: 'won-3', greetingsSaid: ['won-3', 'back-5', 'intro-barnabas', 'intro-duck'] });
    check(g === 'partner-progress', `her greeting on the 9th capture: the progress (${g})`);
    await page.waitForSelector('.cp-icom:not(.greeting)', { timeout: 120000 }).catch(() => {});
    const text = await page.locator('.cp-icom').innerText();
    check(/under consideration/.test(text) && /Do you sleep\?/.test(text), 'her lines: the file moved, and Maren\'s twenty words');
    await shot(page, 'b1-progress');
    await ctx.close();
  }
  if (want('C')) {
    console.log('C  an intro, then an ordinary return');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const g1 = await winFrom(page, { held: held.slice(0, 3), captures: 2, deployments: 4, faction: 'institute', factionSince: 1, contacted: ['delegation', 'faithful', 'institute'], met: ['institute'], beatsSeen: ['machines', 'pipeline'], lastGreeting: 'won-1', greetingsSaid: ['won-1'] });
    const INTROS = ['back-5', 'intro-barnabas', 'intro-duck', 'intro-board', 'intro-catgirl', 'intro-audit', 'intro-dad'];
    check(INTROS.includes(g1), `capture 3: an intro (${g1})`);
    // The very next return (her last line that intro: coming aboard from the menu in between would give her an ordinary one).
    const g2 = await winFrom(page, { lastGreeting: g1 });
    check(!INTROS.includes(g2), `the next return is not another intro (${g1}, then ${g2})`);
    await ctx.close();
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 2).join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
