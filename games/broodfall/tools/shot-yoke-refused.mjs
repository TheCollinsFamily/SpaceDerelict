/**
 * YOKE when rfab.ai gives the game no player: nobody's account is used (Oct 4 2026).
 *
 * The owner found YOKE among his own RFab autosaves and had linked nothing. rfab.ai has the player
 * route; when it refused the game a new player (three a day from one network, used up by beats) the
 * dev server went back to "the old way": the owner's star, the owner's key, the owner's money.
 *
 * The beat, in the real page on its OWN dev server (never Collins's 5199):
 *   1. a beat's browser (headless): the dev proxy itself refuses to make a player on the live
 *      rfab.ai (429 BEAT_NO_PLAYER), so beats stop using up the network's three a day;
 *   2. --person: a person's browser (a normal user agent): the call goes to the live rfab.ai.
 *      On a day the network's three are used up rfab.ai answers 429 PLAYER_LIMIT_IP; on another
 *      day this MAKES a real guest player there (and his line is answered live, about $0.03 of
 *      the house's tokens).
 * In both, when no player is given: nothing goes to /api/avatars (the owner's star) or to
 * /api/broodfall/ship-ai (Kimi on this PC's key), the AI Core does not say "DEV: talking to the
 * owner's YOKE", and she still answers (the scripted YOKE).
 *
 *   node tools/shot-yoke-refused.mjs [--person]        (BROODFALL_PORT, default 5287)
 * Artifacts: tools/screenshots/yoke-refused-*.png
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5287);
const PERSON = process.argv.includes('--person');
let failed = 0;
const check = (ok, what, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failed++; };

// Its own dev server, pointed at the live rfab.ai (no RFAB_API_BASE), with the guard on (no BROODFALL_BEAT_LIVE).
const env = { ...process.env, BROODFALL_PORT: String(PORT), BROODFALL_NO_HMR: '1' };
delete env.RFAB_API_BASE;
delete env.BROODFALL_BEAT_LIVE;
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env });
const stop = () => {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
    else server.kill();
  } catch { /* already gone */ }
};
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('the dev server did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
  server.on('exit', (code) => { clearTimeout(t); rej(new Error(`the dev server exited (${code}): is port ${PORT} taken?`)); });
});

const browser = await chromium.launch();
async function walk(name, userAgent) {
  console.log(`\n${name}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(userAgent ? { userAgent } : {}) });
  const page = await context.newPage();
  const seen = [];
  page.on('response', async (r) => {
    const url = r.url();
    if (!url.includes('/rfab-api/')) return;
    let code = '';
    if (/\/yoke\/players$/.test(url.split('?')[0])) { try { code = (await r.json())?.code ?? ''; } catch { /* no body */ } }
    seen.push({ method: r.request().method(), path: url.replace(/^.*\/rfab-api/, '').split('?')[0], status: r.status(), code });
  });
  await page.goto(`http://localhost:${PORT}/?campaign=ship&open=1`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('#campaign:not(.hidden) .globe', { timeout: 120000 });
  await page.waitForSelector('.cp-icom:not(.greeting)', { timeout: 90000 });
  await page.locator('[data-room="ai"]').click();
  await page.waitForSelector('.cp-yoke-link', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const before = await page.locator('.cp-talk .yoke:not(.thinking)').count();
  const box = page.locator('#ai-input');
  let asked = false;
  if (await box.count()) {
    await box.fill('YOKE, are you awake?');
    await page.locator('[data-act="ai-send"]').click();
    asked = true;
    await page.waitForFunction((n) => document.querySelectorAll('.cp-talk .yoke:not(.thinking)').length > n, before, { timeout: 30000 }).catch(() => {});
  }
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.querySelector('#campaign')?.innerText ?? '');
  const linkLine = await page.locator('.cp-yoke-link').innerText().catch(() => '');
  await page.screenshot({ path: join(shots, `yoke-refused-${name.split(':')[0].trim().replace(/\W+/g, '-').toLowerCase()}.png`) });
  for (const c of seen) console.log(`     ${c.method.padEnd(4)} ${c.path}  -> ${c.status}${c.code ? ` ${c.code}` : ''}`);
  console.log(`     the AI Core says: ${linkLine.replace(/\s+/g, ' ').trim()}`);
  const register = seen.find((c) => c.method === 'POST' && /\/yoke\/players$/.test(c.path));
  await context.close();
  return { seen, register, text, asked, answered: asked ? (await Promise.resolve(text.length > 0)) : false, before };
}

try {
  const beat = await walk('1 a beat (headless browser)');
  check(beat.register?.status === 429 && beat.register?.code === 'BEAT_NO_PLAYER', 'the dev proxy itself refuses a beat a player: nothing reaches the live rfab.ai', `${beat.register?.status} ${beat.register?.code}`);
  check(!beat.seen.some((c) => c.path.startsWith('/api/avatars/')), 'nothing goes to the owner\'s star (/api/avatars)');
  check(!beat.seen.some((c) => c.path.startsWith('/api/broodfall/ship-ai')), 'nothing goes to Kimi on this PC\'s key (/api/broodfall/ship-ai)');
  check(!/DEV: talking to the owner/.test(beat.text), 'the AI Core does not say "DEV: talking to the owner\'s YOKE"');
  check(beat.asked, 'he can still say a line to her (the scripted YOKE answers)');

  if (PERSON) {
    const person = await walk('2 a person: a normal browser, the live rfab.ai', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');
    check(!!person.register && person.register.code !== 'BEAT_NO_PLAYER', 'a person\'s browser is passed on to the live rfab.ai', `${person.register?.status} ${person.register?.code}`);
    if (person.register && person.register.status !== 201) {
      check(!person.seen.some((c) => c.path.startsWith('/api/avatars/')), 'refused a player by rfab.ai: nothing goes to the owner\'s star');
      check(!person.seen.some((c) => c.path.startsWith('/api/broodfall/ship-ai')), 'refused a player by rfab.ai: nothing goes to Kimi on this PC\'s key');
      check(!/DEV: talking to the owner/.test(person.text), 'refused a player by rfab.ai: no "DEV: talking to the owner\'s YOKE"');
    } else {
      check(person.seen.some((c) => c.path.startsWith('/api/broodfall/yoke/') && c.status === 200), 'given a player: her calls go to his own YOKE on the player route');
      check(!person.seen.some((c) => c.path.startsWith('/api/avatars/')), 'given a player: nothing goes to the owner\'s star');
    }
  }
} finally {
  await browser.close();
  stop();
}
console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
