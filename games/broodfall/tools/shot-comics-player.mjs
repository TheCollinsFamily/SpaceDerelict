/**
 * THE COMICS SHELF BY THE PLAYER'S PATH (Oct 4 2026): the game as it is started by `npm start` or `Play Broodfall.bat`
 * (the dev server on its usual port), entered from the MAIN MENU by CONTINUE, not by a shortcut in the address. A save
 * that has heard the boss and won a deployment is put in this browser first; then: the menu, CONTINUE, the ship, COMICS
 * in the room bar, the shelf, a comic read to its end, back out. tools/shot-comics.mjs is the thorough walk; this one
 * is the proof that the door is where a player comes in.
 *
 * Usage: start the game (npm start, or the .bat), then: node tools/shot-comics-player.mjs [http://localhost:5199/]
 * Pictures: notes/screens/2026-10-04/comics-player-*.jpg. Nothing is spent.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'notes', 'screens', '2026-10-04');
mkdirSync(out, { recursive: true });
const base = (process.argv[2] || 'http://localhost:5199/').replace(/\/?$/, '/');
const failures = [];
const check = (ok, what, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failures.push(what); };

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.route('https://api.rfab.ai/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name) => page.screenshot({ path: join(out, `comics-player-${name}.jpg`), type: 'jpeg', quality: 86 });
  await page.addInitScript(() => {
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-reveal-seen', '1');
  });
  // a save a player would have a few deployments in (made by the game itself, then moved on)
  await page.goto(`${base}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#campaign:not(.hidden) .cp-room', { timeout: 90000 });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.said = ['boss']; s.deployments = 3; s.captures = 1; s.onboard = { mission1: 'won', deskOpen: true }; s.greet = null;
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    localStorage.removeItem('broodfall-comics');
  });

  // the way a player comes in: the address alone, the main menu, CONTINUE
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#menu-campaign', { state: 'visible', timeout: 90000 });
  check(true, 'the game opens on its main menu');
  await shot('1-menu');
  await page.click('#menu-campaign');
  await page.waitForSelector('#campaign:not(.hidden) [data-act="comics"]', { timeout: 90000 });
  await page.waitForTimeout(2500);
  const b = await page.evaluate(() => { const x = document.querySelector('#campaign [data-act="comics"]'); return { text: x.textContent.trim(), title: x.getAttribute('title') }; });
  check(/^COMICS/.test(b.text) && /3 unlocked/.test(b.title), 'CONTINUE lands on the ship, and its room bar has COMICS', b.title);
  const note = await page.evaluate(() => { const n = document.getElementById('comics-note'); return n && !n.classList.contains('hidden') ? n.innerText.replace(/\s+/g, ' ').trim() : ''; });
  check(/NEW COMICS UNLOCKED/.test(note), 'a save from before the shelf existed is told what it has earned', note);
  await shot('2-ship');
  await page.click('#campaign [data-act="comics"]', { force: true });
  await page.waitForSelector('#comics .cm-tile');
  await page.waitForFunction(() => [...document.querySelectorAll('#comics .cm-cover img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
  const tiles = await page.evaluate(() => [...document.querySelectorAll('#comics .cm-tile')].map((t) => ({ locked: t.classList.contains('locked'), cover: !!t.querySelector('.cm-cover img')?.naturalWidth })));
  check(tiles.length === 3 && tiles.every((t) => !t.locked && t.cover), 'the shelf: three comics, each with its cover');
  await shot('3-shelf');
  await page.click('#comics [data-read="a-message-from-the-boss"]');
  await page.waitForFunction(() => { const i = document.querySelector('#comics .cm-page'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
  await shot('4-reading');
  let turns = 0;
  for (; turns < 30 && await page.locator('#comics .cm-page').count(); turns++) { await page.keyboard.press(' '); await page.waitForTimeout(650); }
  check(await page.locator('#comics .cm-shelf').count() === 1, 'Space reads on through every page of every comic and ends back at the shelf', `${turns} presses`);
  await page.keyboard.press('Escape');
  check(await page.locator('#comics.hidden').count() === 1 && await page.locator('#campaign:not(.hidden) .cp-room').count() > 0, 'Esc closes it: the ship is as it was');
  check(errors.length === 0, 'no error in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
