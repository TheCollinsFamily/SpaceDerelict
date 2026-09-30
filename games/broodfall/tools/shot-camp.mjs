/**
 * The campaign's four new pieces, played the player's way on the DEV server (what `npm start` serves):
 *   A  menu → NEW CAMPAIGN → mission 1 (won) → the ship → the assigned deployment (won) → the desk
 *      clears, the calls → EMPIRE DIRECTIVES (three standing orders) → the NOTEBOOK (the desk pages)
 *      → pin "The Recipe Book" → a landing site on the globe: its PICTURE over the briefing →
 *      DEPLOY → the pinned page's checklist on the board → won, the page met → the report (hobby,
 *      standing orders) → the notebook (page done, the gene in the jar, spliced) → the directives
 *      (progress, the Office's Form 0-U) → the next deployment carries the gene into the sim
 *   B  SETTINGS from the menu, the ship and a deployment (Esc pauses it): caste colours, text size,
 *      a turn key rebound and used on the board, the HUD style, YOKE's voice, reset asks twice
 * YOKE is scripted (nothing is spent). Screenshots: notes/screens/2026-09-30/camp-*.jpg.
 *   node tools/shot-camp.mjs [A] [B]      (its own dev server on BROODFALL_PORT, default 5251)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const notes = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5251);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `camp-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', join(notes, `camp-${name}.jpg`)]);
};

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

async function newPlayer(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|rfab-api/.test(m.text())) errors.push(m.text()); });
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.goto(URL0, { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted', v: 2 }));
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-meta', JSON.stringify({ standing: 0, runs: 1, genes: [] }));
  });
  await page.goto(URL0, { waitUntil: 'load' });
  return { ctx, page, errors };
}

const board = (page) => page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 90000 });
const endRun = (page, extra = {}) => page.evaluate((extra) => {
  const s = window.broodfall.sim;
  s.stats.kills.militia = 999; s.stats.limbsGrown = 20; s.stats.healed = 5000; s.stats.evolutions = 9;
  Object.assign(s.stats, extra);
  s.outcome = 'won';
  s.events.push({ kind: 'won' });
  window.broodfall.step(1);
}, extra);
/** Aboard after a report: close her intercom (she has greeted him), then the calls if any. */
async function aboard(page, from) {
  await page.locator(from).click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  for (let i = 0; i < 4; i++) {
    const later = page.locator('.cp-scene [data-act="scene-later"], .cp-scene [data-act="scene-ok"]');
    if (!(await later.count())) break;
    await later.first().click();
    await page.waitForTimeout(120);
  }
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  if (want('A')) {
    console.log('A — Empire Directives, the Notebook, a hobby page played, the territory picture');
    const { page, errors } = await newPlayer(browser);
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
    await board(page);
    await page.waitForTimeout(400);
    await endRun(page);
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 15000 });
    await aboard(page, '#debrief-ship');
    check(await page.locator('[data-room="orders"]').count() === 0, 'before the desk clears there is no Empire Directives room and no Notebook');
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
    await board(page);
    await page.waitForTimeout(400);
    await endRun(page, { maxBurning: 7 });
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 15000 });
    await aboard(page, '[data-act="back"]');
    check(await page.locator('[data-room="orders"]').count() === 1 && await page.locator('[data-room="hobby"]').count() === 1, 'the desk clears: EMPIRE DIRECTIVES and the NOTEBOOK are in the room bar');
    await page.locator('[data-room="orders"]').click();
    await page.waitForTimeout(600);
    const orders = await page.locator('.cp-body').innerText();
    check(/SO 2-K/.test(orders) && /SO 7-Q/.test(orders) && /SO 4-S/.test(orders) && /Expected contribution/.test(orders), 'three standing orders, in the Office\'s voice, each with its expected contribution');
    check(/DEPLOYMENT DIRECTIVES ON FILE/.test(orders) && /HOLD/.test(orders), 'every landing site\'s own directive is on file');
    await shot(page, 'directives');
    await page.locator('[data-room="hobby"]').click();
    await page.waitForTimeout(600);
    const nb = await page.locator('.cp-body').innerText();
    check(/Recipe Book/.test(nb) && /Does fire JUMP/i.test(nb), `the notebook holds the desk page and the one the fire sparked (${(nb.match(/\?|!!/g) || []).length} marks)`);
    await shot(page, 'notebook');
    await page.locator('[data-hpin="recipe-book"]').click();
    check(await page.locator('.hb-page.pinned[data-page="recipe-book"] .hb-clip').count() === 1, 'pinning a page clips it: it goes with the next drop');
    await shot(page, 'notebook-pinned');
    // A landing site on the globe: its picture over the briefing.
    await page.locator('[data-room="desk"]').click();
    await page.locator('.globe .site.open').first().click();
    await page.waitForTimeout(700);
    const pic = await page.locator('.cp-brief img.cp-territory-pic').count();
    check(pic === 1, pic ? 'the briefing shows the landing site\'s picture' : 'the briefing has no territory picture (not baked yet?)');
    await shot(page, 'briefing');
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy"]').click()]);
    await board(page);
    await page.waitForTimeout(800);
    const live = await page.locator('#board-goals').innerText();
    check(/Eat 8 of my own limbs/.test(live) && /12 bonuses/.test(live), 'the pinned page\'s checklist is on the board');
    await shot(page, 'run-hobby');
    await endRun(page, { cannibalized: 9, maxPips: 13, kills: { militia: 999, flier: 6 } });
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 15000 });
    const rep = await page.locator('#campaign').innerText();
    check(/HOBBY — The Recipe Book/.test(rep) && /Grudge Marrow/.test(rep), 'the report: the page worked, the gene it paid');
    check(/STANDING ORDERS/.test(rep) && /SO 2-K/.test(rep), 'the report: the standing orders moved');
    await page.locator('[data-act="back"]').evaluate((b) => b.scrollIntoView());
    await shot(page, 'debrief');
    await aboard(page, '[data-act="back"]');
    await page.locator('[data-room="hobby"]').click();
    await page.waitForTimeout(400);
    const after = await page.locator('.cp-body').innerText();
    check(/FORM 0-U/.test(after) && /Grudge Marrow/.test(after) && /1\/2 spliced/.test(after), 'the notebook: page done and stamped, the gene in the jar, spliced');
    check(/Sky fishing/i.test(after), 'fliers downed on that drop sparked a new page');
    await shot(page, 'notebook-done');
    await page.locator('[data-room="orders"]').click();
    await page.waitForTimeout(300);
    const o2 = await page.locator('.cp-body').innerText();
    check(/2 \/ 3/.test(o2) && /irregular use/.test(o2), 'the directives: progress across deployments, and the Office noted the irregularity');
    await shot(page, 'directives-progress');
    // The next drop carries the gene into the sim.
    await page.locator('[data-room="desk"]').click();
    await page.locator('.globe .site.open').first().click();
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy"]').click()]);
    await board(page);
    const genes = await page.evaluate(() => window.broodfall.sim.cfg.genes);
    check(genes.includes('grudge-marrow'), `the next deployment's organism carries the spliced gene (${genes})`);
    check(!errors.length, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  }
  if (want('B')) {
    console.log('B — settings from the menu, the ship and a deployment');
    const { page, errors } = await newPlayer(browser);
    // A campaign on record so the menu shows (the first launch goes straight into mission 1).
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
    await board(page);
    await endRun(page);
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 15000 });
    await page.goto(URL0, { waitUntil: 'load' });
    await page.waitForSelector('#menu-settings');
    await page.locator('#menu-settings').click();
    await page.waitForSelector('#settings:not(.hidden) .st-card');
    const txt = await page.locator('#settings').innerText();
    check(/SOUND/.test(txt) && /HUD style/.test(txt) && /Turn the view/.test(txt) && /REPLAY THE OPENING/.test(txt) && /FORGET EVERYTHING/.test(txt) && /ACCOUNT/.test(txt), 'from the menu: sound, the screen, the board, YOKE\'s slot, the game');
    await shot(page, 'settings-menu');
    await page.locator('[data-choice="tints"][data-value="safe"]').click();
    const war = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--war').trim());
    check(war.toLowerCase() === '#d55e00', `colour-blind-safe caste colours in force (--war ${war})`);
    await page.locator('[data-choice="text"][data-value="1.3"]').click();
    await page.locator('[data-toggle="yoke-voice"]').click();
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-yoke')).muted === true), 'YOKE\'s voice switched off (her own setting)');
    await page.locator('[data-toggle="yoke-voice"]').click();
    await page.locator('[data-key="turnLeft"]').click();
    await page.keyboard.press('z');
    const keys = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-settings')).keys);
    check(keys.turnLeft === 'z', `a turn key rebound (${JSON.stringify(keys)})`);
    await page.locator('[data-choice="hud"]').nth(2).click();
    check(await page.evaluate(() => document.documentElement.dataset.hud) !== 'console', 'the HUD style chosen here is in force');
    await page.locator('[data-choice="hud"]').first().click();
    await page.locator('[data-act="reset"]').click();
    check(/AGAIN TO CONFIRM/.test(await page.locator('[data-act="reset"]').innerText()), 'reset asks again before it forgets anything');
    await shot(page, 'settings-large-safe');
    await page.keyboard.press('Escape');
    check(await page.locator('#settings.hidden').count() === 1, 'Esc closes it');
    // The ship.
    await page.locator('#menu-campaign').click();
    await page.waitForSelector('#campaign:not(.hidden)');
    const icom = page.locator('.cp-icom [data-act="icom-close"]');
    if (await icom.count()) await icom.click();
    await page.locator('[data-act="settings"]').click();
    await page.waitForSelector('#settings:not(.hidden)');
    await shot(page, 'settings-ship');
    await page.locator('.st-close').click();
    // A deployment: Esc with nothing in hand pauses it and opens the settings.
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
    await board(page);
    await page.waitForTimeout(600);
    await page.mouse.move(800, 450);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#settings:not(.hidden)');
    const t0 = await page.evaluate(() => window.broodfall.sim.time);
    await page.waitForTimeout(800);
    const t1 = await page.evaluate(() => window.broodfall.sim.time);
    check(t0 === t1, `the deployment is paused while the settings are open (${t0} → ${t1})`);
    await shot(page, 'settings-run');
    await page.keyboard.press('Escape');
    const turn0 = await page.evaluate(() => window.broodfall.turn());
    await page.keyboard.press('z');
    const turn1 = await page.evaluate(() => window.broodfall.turn());
    check(turn0 !== turn1, `the rebound key turns the board (${turn0} → ${turn1})`);
    await page.waitForTimeout(500);
    const t2 = await page.evaluate(() => window.broodfall.sim.time);
    check(t2 > t1, 'closed: the deployment goes on');
    check(await page.locator('#view-settings').count() === 1, 'the ⚙ by the view buttons');
    await shot(page, 'run-large-safe');
    check(!errors.length, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
