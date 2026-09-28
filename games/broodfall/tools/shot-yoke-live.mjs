/**
 * YOKE live beat: the AI Core talking to Kimi K2.6 through rfab.ai, by real clicks.
 * PAID (a few RFab tokens a reply). Run against a backend that has /api/broodfall/ship-ai:
 *   RFAB_API_BASE=http://localhost:3011 RFAB_API_BEARER=<jwt> node tools/shot-yoke-live.mjs
 * (or with no RFAB_API_BASE once api.rfab.ai carries the route; the proxy adds RFAB_API_KEY).
 * Checks: YOKE opens live (green dot, Kimi note), answers what the player says, the
 * transcript saves; then the scripted switch and the refused-key fallback.
 * Writes tools/screenshots/beat-yoke-*.png.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
try {
  const out = execSync('netstat -ano', { encoding: 'utf8' });
  for (const line of out.split(String.fromCharCode(10))) {
    const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
    if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
  }
} catch {}
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: process.env });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = (page, name) => page.screenshot({ path: join(here, 'screenshots', `beat-yoke-${name}.png`) });
const flat = (t) => t.replace(/\s+/g, ' ').trim();
const SHIP = 'http://localhost:5199/?seed=3&campaign=ship';

/** Queue a discussion the way the campaign does, then open the ship's AI Core. */
async function openCore(page, trigger) {
  await page.evaluate((trig) => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.ai.queue = [trig];
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
  }, trigger);
  await page.goto(SHIP, { waitUntil: 'load' });
  await page.waitForSelector('#campaign:not(.hidden)');
  await page.locator('[data-room="ai"]').click();
}

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5199/?seed=3', { waitUntil: 'load' });
  await page.evaluate(() => { for (const k of ['broodfall-yoke', 'broodfall-campaign', 'broodfall-campaign-pending']) localStorage.removeItem(k); });
  await page.reload({ waitUntil: 'load' });
  await page.locator('#menu-campaign').click();
  await page.waitForSelector('#campaign:not(.hidden) .globe');
  await openCore(page, 'first-deployment');
  const link = flat(await page.locator('.cp-yoke-link').first().innerText());
  check(/Kimi K2\.6 via rfab\.ai/.test(link), `the AI Core says where YOKE's words come from: "${link}"`);
  await shot(page, 'core');

  await page.locator('[data-engage="first-deployment"]').click();
  await page.waitForSelector('.cp-talk .yoke:not(.thinking)', { timeout: 60000 });
  const note = flat(await page.locator('.cp-yoke-link').innerText());
  check((await page.locator('.cp-yoke-dot.live').count()) === 1 && /tokens/.test(note), `live: "${note}"`);
  console.log(`      ${flat(await page.locator('.cp-talk').innerText()).slice(0, 400)}`);
  await shot(page, 'opened');

  await page.locator('#ai-input').fill('Why do you care what I think about the brood?');
  await page.locator('[data-act="ai-send"]').click();
  await page.waitForFunction(() => {
    const t = document.querySelectorAll('.cp-talk > div');
    const last = t[t.length - 1];
    return t.length >= 3 && last.classList.contains('yoke') && !last.classList.contains('thinking');
  }, null, { timeout: 60000 });
  const talk = await page.locator('.cp-talk').innerText();
  check(/You: Why do you care/.test(talk) && talk.split('YOKE:').length >= 3, 'YOKE answers what the player said');
  console.log(`      ${flat(talk).slice(0, 700)}`);
  await shot(page, 'reply');
  await page.locator('[data-act="ai-end"]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')).ai.transcripts);
  check(saved.length === 1 && saved[0].turns.length >= 3, `the transcript is saved (${saved[0]?.turns.length} turns)`);

  // The switch: scripted YOKE, remembered.
  await page.locator('[data-act="yoke-mode"]').click();
  const scripted = flat(await page.locator('.cp-yoke-link').innerText());
  check(/scripted/i.test(scripted), `USE SCRIPTED switches the provider: "${scripted}"`);
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-yoke')).mode)) === 'scripted', 'the choice is remembered');
  await page.locator('[data-act="yoke-mode"]').click();

  // A refused key: YOKE falls back to the scripted core and says why.
  await page.locator('#yoke-key').fill('rfab_not_a_real_key');
  await page.locator('[data-act="yoke-key"]').click();
  await openCore(page, 'idle');
  await page.locator('[data-engage="idle"]').click();
  await page.waitForSelector('.cp-talk .yoke:not(.thinking)', { timeout: 60000 });
  const fb = flat(await page.locator('.cp-yoke-link').innerText());
  check(/scripted: no RFab API key linked/.test(fb), `a refused key falls back and says why: "${fb}"`);
  await shot(page, 'fallback');
  await page.locator('[data-act="ai-end"]').click();
  await page.locator('[data-act="yoke-forget"]').click();
  check(!(await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-yoke')).key)), 'FORGET KEY clears it');

  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `YOKE LIVE BEAT: ${failed} failed` : 'YOKE LIVE BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
