/**
 * YOKE for players, end to end in the real game (Sep 30 2026): a new player talks to her on the
 * house's free allowance, the meter falls, the free talk runs out and she asks him to link an
 * RFab account, the code screen, the link approved (as the player would on rfab.ai/connect),
 * her live mind back on HIS account, and the model picker.
 *
 * PAID, a few cents of real provider calls on a LOCAL backend's accounts (never prod money):
 *   (backend repo) node scripts/seed-broodfall-yoke-local.js --tester broodfall-tester2@rfab.local
 *   (backend repo) PORT=3011 BROODFALL_PLAYERS_PER_IP_PER_DAY=100 node scripts/start.js
 *   (backend repo) npm run auth:token -- --email broodfall-tester2@rfab.local --ttl 2h      → the JWT below
 *   RFAB_API_BASE=http://localhost:3011 RFAB_CONNECT_JWT=<jwt> node tools/shot-yoke-connect.mjs
 * The real $3 cap: after one exchange the beat moves the LOCAL ledger on to the last cents
 * (backend scripts/local-broodfall-fastforward.js), so the cut-off comes a turn or two later.
 *
 * The dev server's proxy carries the game's calls to the local backend; this PC's RFAB_API_KEY is
 * taken out of its environment, so nothing but the player's own token is ever sent.
 * Screenshots: tools/screenshots/connect-*.png, JPEG copies in notes/screens/2026-09-30/connect-*.jpg.
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
const PORT = Number(process.env.BROODFALL_PORT || 5247);
const API = (process.env.RFAB_API_BASE || '').replace(/\/$/, '');
const JWT = process.env.RFAB_CONNECT_JWT || '';
const BACKEND = process.env.RFAB_BACKEND_DIR || 'C:/Users/Merry/dev/reality-fabricator/reality-fabricator-backend';
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(API) || !JWT) {
  console.error('Run against a LOCAL backend: RFAB_API_BASE=http://localhost:3011 RFAB_CONNECT_JWT=<jwt of the tester> (see the header).');
  process.exit(2);
}

let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `connect-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', join(notes, `connect-${name}.jpg`)]);
};
const flat = (t) => t.replace(/\s+/g, ' ').trim();

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
  const env = { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT), RFAB_API_BASE: API };
  delete env.RFAB_API_KEY;
  delete env.RFAB_API_BEARER;
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

/** What rfab.ai/connect does when the signed-in player presses Approve. */
async function approve(code) {
  const res = await fetch(`${API}/api/broodfall/yoke/connect/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JWT}` }, body: JSON.stringify({ code }) });
  return { status: res.status, body: await res.json() };
}

/** One line to her in her room; resolves when she has answered (the input is his again). */
async function say(page, text) {
  const before = await page.locator('.cp-talk > .yoke:not(.thinking)').count();
  await page.locator('#ai-input').fill(text);
  await page.locator('[data-act="ai-send"]').click();
  await page.waitForFunction((n) => {
    const done = document.querySelectorAll('.cp-talk > .yoke:not(.thinking)').length > n;
    const input = document.getElementById('ai-input');
    const cut = document.querySelector('.cp-acct-cut');
    return done && (cut || (input && !input.disabled));
  }, before, { timeout: 120000 });
  // Her sentences arrive one after another: let the last of them land.
  await page.waitForTimeout(6000);
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (/\[YOKE\]/.test(m.text())) console.log('      page: ' + m.text()); if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
  });
  // A new player: nothing kept, the opening seen, her avatar on (the default).
  await page.goto(`http://localhost:${PORT}/?seed=3`, { waitUntil: 'load' });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('broodfall-')) localStorage.removeItem(k);
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'avatar', v: 2 }));
  });
  await page.goto(`http://localhost:${PORT}/?campaign=ship&open=1`, { waitUntil: 'load' });
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 60000 });
  // Her greeting may be playing in the intercom: close it, go to her room.
  await page.waitForTimeout(1500);
  if (await page.locator('[data-act="icom-close"]').count()) await page.locator('[data-act="icom-close"]').click();
  await page.locator('[data-room="ai"]').first().click();
  await page.waitForSelector('.cp-acct-meter', { timeout: 30000 });
  const token = await page.evaluate(() => localStorage.getItem('broodfall-yoke-player'));
  check(/^bfg_/.test(token ?? ''), 'a new player: the game holds a guest token and nothing else');
  const meter0 = flat(await page.locator('.cp-acct-meter').innerText());
  check(/FREE TALK/.test(meter0) && /left/.test(meter0), `the free-talk meter in the AI Core: "${meter0}"`);

  // Guest talk on the house.
  await say(page, 'YOKE, who are you, in two sentences?');
  const talk1 = flat(await page.locator('.cp-talk').innerText());
  check(/YOKE:/.test(talk1) && !/SHIP LOG/.test(talk1), 'she answers the guest live, and the ship log is never shown');
  const meter1 = flat(await page.locator('.cp-acct').innerText());
  await shot(page, '01-guest-chat');
  check(meter1 !== meter0 || /\$/.test(meter1), `the meter moved after the exchange: "${meter1}"`);
  await shot(page, '02-allowance-meter');

  // Most of $3 is a hundred exchanges: the local backend's ledger is moved on to the last cents instead
  // (scripts/local-broodfall-fastforward.js, LOCAL database only), and the real cap does the rest.
  const ff = spawnSync(process.execPath, [join(BACKEND, 'scripts', 'local-broodfall-fastforward.js'), '--token', token, '--leave', '1200'], { cwd: BACKEND, encoding: 'utf8' });
  console.log(`      fast-forward: ${(ff.stdout || ff.stderr).trim().split(/\r?\n/).pop()}`);
  await page.locator('[data-room="ai"]').first().click();
  await page.waitForTimeout(2500);
  // Talk until the free talk is spent.
  let turns = 1;
  while (!(await page.locator('.cp-acct-cut').count()) && turns < 8) {
    await say(page, turns % 2 ? 'Tell me something about the brood.' : 'And what do you think of me?');
    turns++;
  }
  const cut = page.locator('.cp-acct-cut').first();
  check(await cut.count() > 0, `after ${turns} exchanges the free talk is spent and the prompt replaces the line he types`);
  const cutText = flat(await cut.innerText());
  check(/400,000 free tokens/.test(cutText) && /Link an RFab account/i.test(cutText), `the prompt states the bonus plainly: "${cutText.slice(0, 160)}…"`);
  const lastYoke = flat(await page.locator('.cp-talk > .yoke').last().innerText());
  check(/RFab account|Directorate/.test(lastYoke), `she says it in her own voice: "${lastYoke.slice(0, 140)}"`);
  check((await page.locator('#ai-input').count()) === 0, 'the live chat is stopped (no input while nobody pays)');
  await shot(page, '03-cutoff-prompt');

  // Link: the code screen.
  await page.locator('.cp-acct-cut [data-act="acct-link"]').click();
  await page.waitForSelector('.cp-acct-big', { timeout: 20000 });
  const code = flat(await page.locator('.cp-acct-big').innerText());
  check(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), `the code screen shows a short code: ${code}`);
  await page.locator('.cp-acct-code [data-act="acct-open"]').click();
  const opened = await page.evaluate(() => window.__opened);
  check(opened.some((u) => u.includes('/connect?code=')), `OPEN RFAB.AI opens the connect page: ${opened[0]}`);
  await shot(page, '04-connect-code');

  // The player approves on rfab.ai (the beat does what the page's Approve button does).
  const ok = await approve(code);
  check(ok.status === 200 && ok.body.bonus?.granted, `approved on rfab.ai: bonus ${JSON.stringify(ok.body.bonus)}`);
  await page.waitForSelector('.cp-acct-linked', { timeout: 30000 });
  const linkedToken = await page.evaluate(() => localStorage.getItem('broodfall-yoke-player'));
  check(/^bfc_/.test(linkedToken ?? '') && linkedToken !== token, 'the game collected a connected token (the guest one is gone)');
  const acct = flat(await page.locator('.cp-acct').innerText());
  check(/LINKED TO RFAB/.test(acct) && /Linked\. 400,000 free tokens/.test(acct), `linked, bonus said: "${acct.slice(0, 200)}"`);
  check((await page.locator('#ai-input').count()) === 1, 'the line to her is back');
  await shot(page, '05-connected');

  // Her live mind on HIS account.
  const balanceBefore = Number((acct.match(/([\d,]+) tokens/) || [])[1]?.replace(/,/g, ''));
  await say(page, 'I linked my account. Are you back?');
  await page.locator('[data-room="ai"]').first().click();
  await page.waitForTimeout(2500);
  const acct2 = flat(await page.locator('.cp-acct').innerText());
  const balanceAfter = Number((acct2.match(/([\d,]+) tokens/) || [])[1]?.replace(/,/g, ''));
  check(balanceAfter < balanceBefore, `her turn drained HIS balance: ${balanceBefore} → ${balanceAfter}`);
  await shot(page, '06-connected-chat');

  // The model picker.
  await page.locator('[data-act="acct-models"]').click();
  await page.waitForSelector('.cp-acct-models');
  const rows = await page.locator('.cp-acct-model').count();
  const first = flat(await page.locator('.cp-acct-model').first().innerText());
  check(rows >= 4 && /tokens/.test(first) && /default/i.test(first), `the model picker: ${rows} models with a price a reply ("${first}")`);
  await shot(page, '07-model-picker');
  await page.locator('.cp-acct-model', { hasText: 'Claude Haiku 4.5' }).click();
  await page.waitForFunction(() => /Her mind now runs on Claude Haiku 4\.5/.test(document.querySelector('.cp-acct')?.textContent ?? ''), null, { timeout: 20000 });
  check(true, 'her mind moved to Claude Haiku 4.5 (his private instance only)');
  await say(page, 'Say one line on your new mind.');
  await shot(page, '08-model-chosen');

  // The same account in Settings (its "YOKE — ACCOUNT & MIND" slot).
  await page.locator('#campaign [data-act="settings"]').first().click();
  await page.waitForSelector('.st-slot[data-slot="yoke-account"] .cp-acct-linked', { timeout: 20000 });
  const inSettings = flat(await page.locator('.st-slot[data-slot="yoke-account"]').innerText());
  check(/LINKED TO RFAB/.test(inSettings) && /Claude Haiku 4\.5/.test(inSettings), `Settings shows her account and mind: "${inSettings.slice(0, 120)}"`);
  await page.locator('.st-slot[data-slot="yoke-account"]').scrollIntoViewIfNeeded();
  await shot(page, '09-settings-account');
  await page.keyboard.press('Escape');

  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ').slice(0, 400)}` : 'no page errors');
  console.log(failed ? `YOKE CONNECT BEAT: ${failed} failed` : 'YOKE CONNECT BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
