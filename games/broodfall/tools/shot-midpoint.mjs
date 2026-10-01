/**
 * The midpoint beat (Collins, Oct 1 2026; content/campaign.ts MIDPOINT_CAPTURES), real clicks:
 * menu → NEW CAMPAIGN → mission 1 (won) → the ship's pick (won) → the three call → ally with the
 * Faithful → take two territories on the globe → back on the ship the other two make their offers
 * (both cards) → GO OVER to the Institute: the Voice's goodbye, the Institute's first two beats,
 * Comms shows the former ally. Then the save from the moment of the offers is put back and he STAYS:
 * the Voice's thanks and the Tithe in Comms and in the next briefing.
 * Needs a build (npm run build). Writes notes/screens/2026-10-01/midpoint-*.jpg.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const PORT = Number(process.env.BROODFALL_PORT || 5207);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(out, { recursive: true });
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
// vite by its own path (not npx: a shared node_modules can be missing its .bin while another session reinstalls).
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = (page, name) => page.screenshot({ path: join(out, `midpoint-${name}.jpg`), type: 'jpeg', quality: 82 });

/** Win the run on screen and come back aboard, past her greeting. */
async function winAndReturn(page) {
  await page.waitForSelector('#stage canvas');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
  await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 45000 });
  await page.locator('[data-act="back"]').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 15000 });
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  await page.waitForTimeout(200);
}
/** Clear plain scene cards (CONTINUE) until an offer or nothing is left. */
async function clearPlain(page) {
  for (let i = 0; i < 12; i++) {
    if (await page.locator('.cp-scene [data-switch]').count()) return;
    const ok = page.locator('.cp-scene [data-act="scene-ok"]');
    if (!(await ok.count())) return;
    await ok.click();
    await page.waitForTimeout(100);
  }
}
/** Take the first open site in view on the globe. */
async function takeOne(page) {
  await page.locator('[data-room="desk"]').click();
  for (let i = 0; i < 12 && !(await page.locator('.globe .site.open:not(.behind)').count()); i++) {
    await page.locator('[data-act="spin-r"]').click();
    await page.waitForTimeout(400);
  }
  await page.locator('.globe .site.open:not(.behind)').first().click({ force: true });
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy"]').click()]);
  await winAndReturn(page);
}

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + PORT + '/?seed=5', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.removeItem('broodfall-campaign'); localStorage.removeItem('broodfall-campaign-pending'); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); localStorage.setItem('broodfall-intro-seen', '1'); });
  await page.reload({ waitUntil: 'load' });
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
  await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 60000 });
  await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
  await page.waitForSelector('#debrief:not(.hidden)', { timeout: 45000 });
  await page.locator('#debrief-ship').click();
  await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 15000 });
  await page.locator('.cp-icom [data-act="icom-close"]').click();
  await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
  await winAndReturn(page);
  // The three call: hear the Delegation, then ally with the Faithful.
  await page.waitForSelector('.cp-scene [data-ally]');
  await page.locator('.cp-scene [data-act="scene-later"]').click();
  await page.locator('.cp-scene [data-ally="faithful"]').click();
  await clearPlain(page);
  await page.locator('[data-room="comms"]').click();
  check(/Halfway along, the other two will make you an offer/i.test(await page.locator('.cp-body').innerText()), 'Comms tells him, when he allies, that an offer will come halfway');
  // Two territories into the alliance.
  await takeOne(page);
  await clearPlain(page);
  check(!(await page.locator('.cp-scene [data-switch]').count()), 'one territory in: no offer yet');
  await takeOne(page);
  await clearPlain(page);
  await page.waitForSelector('.cp-scene [data-switch]', { timeout: 5000 }).catch(() => {});
  const offer1 = await page.locator('.cp-scene').innerText().catch(() => '');
  check(/THE MIDPOINT — OFFER 1 OF 2/.test(offer1), `the first offer arrives: "${offer1.slice(0, 70).replace(/\s+/g, ' ')}"`);
  check(/HEAR THE OTHER OFFER/.test(offer1) && /GO OVER TO/.test(offer1) && /STAY: The Faithful/i.test(offer1), 'its card says what going over and staying cost, and leads to the other offer');
  await shot(page, '1-offer-1');
  const snapshot = await page.evaluate(() => localStorage.getItem('broodfall-campaign'));
  await page.locator('.cp-scene [data-act="scene-later"]').click();
  const offer2 = await page.locator('.cp-scene').innerText();
  check(/OFFER 2 OF 2/.test(offer2) && /STAY WITH THE FAITHFUL OF THE LAST HOUR/.test(offer2), 'the second offer, with the button to stay');
  await shot(page, '2-offer-2');
  // Go over to the rival on this card.
  const rival = await page.locator('.cp-scene [data-switch]').getAttribute('data-switch');
  await page.locator('.cp-scene [data-switch]').click();
  const bye = await page.locator('.cp-scene').innerText();
  check(/CHAPTER THIRTY/i.test(bye), `the Voice says goodbye, in character: "${bye.slice(0, 80).replace(/\s+/g, ' ')}"`);
  await shot(page, '3-farewell');
  await page.locator('.cp-scene [data-act="scene-ok"]').click();
  const first = await page.locator('.cp-scene').innerText();
  await shot(page, '4-new-route');
  await clearPlain(page);
  await page.locator('[data-room="comms"]').click();
  const comms = await page.locator('.cp-body').innerText();
  check(/Your ally until the midpoint/.test(comms) && /Allied since the midpoint/.test(comms), 'Comms: the former ally and the new one');
  await shot(page, '5-comms-switched');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')));
  check(saved.faction === rival && saved.midpoint?.status === 'switched' && saved.midpoint.from === 'faithful', `saved: faction ${saved.faction}, midpoint ${JSON.stringify(saved.midpoint)}`);
  console.log(`  (the new route opened on: "${first.slice(0, 60).replace(/\s+/g, ' ')}")`);
  // The other way: the save at the offers, and he stays.
  await page.evaluate((s) => localStorage.setItem('broodfall-campaign', s), snapshot);
  await page.reload({ waitUntil: 'load' });
  await page.locator('#menu-campaign').first().click().catch(() => {});
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 15000 });
  // Her greeting first (the scenes wait for it), then the offers again.
  await page.waitForTimeout(800);
  if (!(await page.locator('.cp-scene').count()) && await page.locator('.cp-icom [data-act="icom-close"]').count()) await page.locator('.cp-icom [data-act="icom-close"]').click();
  await page.waitForSelector('.cp-scene [data-switch]', { timeout: 10000 });
  await page.locator('.cp-scene [data-act="scene-later"]').click();
  await page.locator('.cp-scene [data-act="stay"]').click();
  const loyal = await page.locator('.cp-scene').innerText();
  check(/THE VISITOR SAID NO/i.test(loyal), 'staying: the Voice thanks him on the air');
  await shot(page, '6-stayed');
  await clearPlain(page);
  await page.locator('[data-room="comms"]').click();
  check(/The Tithe/.test(await page.locator('.cp-body').innerText()), 'Comms lists the Tithe among his perks');
  await shot(page, '7-comms-stayed');
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `MIDPOINT BEAT: ${failed} failed` : 'MIDPOINT BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
