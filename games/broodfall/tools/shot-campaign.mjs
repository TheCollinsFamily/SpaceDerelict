/**
 * Campaign beat, real clicks through the loop, in the way it unfolds since Sep 30 2026
 * (src/meta/onboarding.ts): menu → NEW CAMPAIGN → mission 1 (won) → its plain report →
 * the ship, the desk dark → the ship's own pick deployed (a campaign run: profile organs,
 * hidden intel, the live Requisition Board) → won → the debrief → back on the ship: the desk
 * clears and the three factions call → ally with the Delegation → YOKE's discussion in the AI
 * Core (the scripted YOKE; tools/shot-yoke-live.mjs covers the Kimi one) → a second deployment
 * picked on the globe with a dare → the ally's letter.
 * Writes tools/screenshots/beat-campaign-*.png.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
freePort();
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = (page, name) => page.screenshot({ path: join(here, 'screenshots', `beat-campaign-${name}.png`) });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + PORT + '/?seed=3', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.removeItem('broodfall-campaign'); localStorage.removeItem('broodfall-campaign-pending'); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); localStorage.setItem('broodfall-intro-seen', '1'); });
  await page.reload({ waitUntil: 'load' });
  // NEW CAMPAIGN: mission 1 first, a plain game (tools/shot-onboarding.mjs looks at it closely).
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.getElementById('board-goals').classList.contains('hidden')), 'NEW CAMPAIGN starts with mission 1: no Requisition Board on it');
  await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
  await page.waitForSelector('#debrief:not(.hidden)', { timeout: 45000 });
  await page.locator('#debrief-ship').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 10000 });
  check(await page.locator('.cp-desk-dark').count() === 1, 'the ship: YOKE greets him, the Directive Desk is dark');
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  await shot(page, 'ship');
  // The ship's own pick: the desk is dark until a win.
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
  await page.waitForSelector('#stage canvas');
  await page.waitForTimeout(800);
  const run = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return { organs: s.organs.map((o) => o.organ), hidden: s.waveIntelHidden, pool: s.cfg.organPool };
  });
  check(run.organs.includes('gut') && run.organs.includes('forge'), `the run starts with the Standard Strain's organs (${run.organs})`);
  check(run.hidden, 'the next wave is hidden (no Translator yet)');
  const phase = await page.locator('#phase-name').innerText();
  check(/\?/.test(phase), `the HUD hides the entrance: "${phase}"`);
  const board = await page.locator('#board-goals').innerText();
  check(/REQUISITION BOARD/.test(board), 'the live board shows the goals');
  await shot(page, 'run');
  // Win the deployment (a scripted shortcut — the run itself is covered by the other beats).
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.stats.kills.militia = 999; s.stats.limbsGrown = 20; s.stats.healed = 5000; s.stats.evolutions = 9;
    s.outcome = 'won';
    s.events.push({ kind: 'won' });
    window.broodfall.step(1);
  });
  // The report now opens with its pictures (src/ui/debrief.ts), which carry the verdict: wait for the report itself.
  await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 45000 });
  const debrief = await page.locator('#campaign').innerText();
  check(/TAKEN/.test(debrief) && /Earned/.test(debrief), 'the debrief: the territory taken, the goals, the credits');
  await shot(page, 'debrief');
  await page.locator('[data-act="back"]').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 10000 });
  check(await page.evaluate(() => document.getElementById('campaign').dataset.greeting === 'unlock'), 'the win clears the desk, and YOKE says so');
  // He walks away from her: the planet's calls come in.
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-scene');
  const contact = await page.locator('.cp-scene').innerText();
  check(/FRIENDSHIP DELEGATION/i.test(contact) && /CALL 1 OF 3/.test(contact), 'back on the ship, all three call: the Delegation first');
  // He is in orbit: the letter is written in the crops, and the card shows it.
  check(/WRITTEN IN THE CROPS/i.test(contact) && !/hand-delivered/i.test(contact), 'their letter reaches orbit: it is written in the crops');
  await page.waitForSelector('.cp-scene-card img[data-picture="delegation-contact"]', { timeout: 5000 }).catch(() => {});
  check(await page.locator('.cp-scene-card img[data-picture="delegation-contact"]').count() === 1, 'the contact card shows the picture of the crop letter');
  await shot(page, 'contact');
  await page.locator('.cp-scene [data-ally="delegation"]').click();
  await page.waitForTimeout(150);
  const beat = await page.locator('.cp-scene').innerText();
  check(/FIRST SUMMIT/i.test(beat), 'allying plays their first beat');
  await page.locator('[data-act="scene-ok"]').click();
  // The ship AI.
  await page.locator('[data-room="ai"]').click();
  await page.locator('[data-engage="first-deployment"]').click();
  await page.waitForSelector('.cp-talk');
  const yoke = await page.locator('.cp-talk').innerText();
  check(/telemetry/i.test(yoke), `YOKE opens the discussion: "${yoke.slice(0, 80)}"`);
  await page.locator('#ai-input').fill('I try not to.');
  await page.locator('[data-act="ai-send"]').click();
  await page.locator('[data-act="ai-end"]').click();
  await shot(page, 'ai');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')));
  check(saved.held.length === 2 && saved.faction === 'delegation' && saved.ai.transcripts.length === 1, `saved: held ${saved.held}, faction ${saved.faction}, transcripts ${saved.ai.transcripts.length}`);
  // Globe shows the new ground; the Gene Bay lists the lineages.
  await page.locator('[data-room="genes"]').click();
  const genes = await page.locator('.cp-body').innerText();
  check(/SANCTIONED LINEAGES/.test(genes) && /UNSANCTIONED/.test(genes), 'the Gene Bay lists both catalogues');
  await shot(page, 'genes');
  // A second deployment while allied: the Delegation writes, and the letter lands in the debrief and in Comms.
  await page.locator('[data-room="desk"]').click();
  await page.locator('.globe .site.open').first().click();
  const brief = await page.locator('.cp-brief').innerText();
  check(/REQUISITION BOARD/.test(brief) && /DARES/.test(brief) && /Holding it unlocks/i.test(brief), 'the desk is open: the briefing shows the board, the dares and the unlocks');
  await page.locator('.cp-pick[data-dare="zoo"]').click();
  await shot(page, 'briefing');
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy"]').click()]);
  await page.waitForSelector('#stage canvas');
  await page.waitForTimeout(500);
  check(/kinds of limb/i.test(await page.locator('#board-goals').innerText()), 'the live board carries the picked dare');
  await page.waitForSelector('#stage canvas');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
  await page.waitForSelector('#campaign:not(.hidden) .cp-aside', { timeout: 45000 });
  const aside = await page.locator('.cp-aside').innerText();
  check(/Delegate \(letter, by field\)/.test(aside), `the debrief carries the ally's letter: "${aside.slice(0, 90)}"`);
  await shot(page, 'aside');
  await page.locator('[data-act="back"]').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom');
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  while (await page.locator('.cp-scene [data-act="scene-ok"]').count()) await page.locator('.cp-scene [data-act="scene-ok"]').click();
  await page.locator('[data-room="comms"]').click();
  const comms = await page.locator('.cp-body').innerText();
  check(/FROM YOUR ALLY/.test(comms) && /Delegate \(letter, by field\)/.test(comms), 'Comms keeps the letters');
  await shot(page, 'comms');
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `CAMPAIGN BEAT: ${failed} failed` : 'CAMPAIGN BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
