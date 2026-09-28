/**
 * Campaign beat, real clicks through the loop: menu → CAMPAIGN → the ship's globe →
 * pick a landing site, a dare → DEPLOY (the run: profile organs, hidden intel, the
 * live Requisition Board) → a won deployment → the debrief → back on the ship →
 * the Delegation makes contact → ally → YOKE's discussion in the AI Core (the scripted
 * YOKE; tools/shot-yoke-live.mjs covers the Kimi one).
 * Writes tools/screenshots/beat-campaign-*.png.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
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
  await page.goto('http://localhost:5199/?seed=3', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.removeItem('broodfall-campaign'); localStorage.removeItem('broodfall-campaign-pending'); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); });
  await page.reload({ waitUntil: 'load' });
  await page.locator('#menu-campaign').click();
  await page.waitForSelector('#campaign:not(.hidden) .globe');
  check(true, 'CAMPAIGN opens the ship with the globe');
  await shot(page, 'ship');
  // Pick a landing site next to the crash site.
  await page.locator('.globe .site.open').first().click();
  const brief = await page.locator('.cp-brief').innerText();
  check(/REQUISITION BOARD/.test(brief) && /DARES/.test(brief) && /Holding it unlocks/i.test(brief), 'the briefing shows the board, the dares and the unlocks');
  await page.locator('.cp-pick[data-dare="zoo"]').click();
  await shot(page, 'briefing');
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy"]').click()]);
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
  check(/REQUISITION BOARD/.test(board) && /kinds of limb/i.test(board), 'the live board shows the goals and the picked dare');
  await shot(page, 'run');
  // Win the deployment (a scripted shortcut — the run itself is covered by the other beats).
  await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.stats.kills.militia = 999; s.stats.limbsGrown = 20; s.stats.healed = 5000; s.stats.evolutions = 9;
    s.outcome = 'won';
    s.events.push({ kind: 'won' });
    window.broodfall.step(1);
  });
  await page.waitForSelector('#campaign:not(.hidden) .cp-title', { timeout: 5000 });
  const debrief = await page.locator('#campaign').innerText();
  check(/TAKEN/.test(debrief) && /Earned/.test(debrief), 'the debrief: the territory taken, the goals, the credits');
  await shot(page, 'debrief');
  await Promise.all([page.waitForURL(/campaign=ship/), page.locator('[data-act="back"]').click()]);
  await page.waitForSelector('#campaign:not(.hidden) .cp-scene');
  const contact = await page.locator('.cp-scene').innerText();
  check(/FRIENDSHIP DELEGATION/i.test(contact), 'back on the ship, the Delegation makes contact');
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
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `CAMPAIGN BEAT: ${failed} failed` : 'CAMPAIGN BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
