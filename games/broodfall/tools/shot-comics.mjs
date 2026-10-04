/**
 * THE COMICS SHELF, in the real page (Oct 4 2026, src/ui/comics.ts; Collins: "somewhere in the ship interface where
 * people can unlock comics they can go back through as they play").
 *
 * The DEV server on its own port, YOKE scripted, nothing spent. Three saves are walked as a player would:
 *   A  back from a LOST first landing, the boss not heard yet: one comic (the opening film gave it), two locked.
 *   B  the boss heard and a deployment won: all three, two of them NEW.
 *   C  a NEW campaign after that: the shelf is as it was.
 *   D  the real thing: he comes back from his first landing, YOKE greets him, the boss calls; when the call is over
 *      the comic of it is on the shelf.
 * It opens COMICS by its button in the room bar, reads a comic to its last page and on into the next, goes back with Esc,
 * and reloads to see that what was read stays read. It fails on a picture that does not load, a locked comic that
 * shows its title or its cover, a count on the button that is wrong, or an error in the page.
 *
 * Usage: node tools/shot-comics.mjs
 * Pictures: notes/screens/2026-10-04/comics-*.jpg.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'notes', 'screens', '2026-10-04');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5317);
const base = `http://localhost:${PORT}/`;
const failures = [];
const check = (ok, what, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failures.push(what); };

function startDev() {
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT) },
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}
const kill = (child) => { try { if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); else child.kill(); } catch { /* gone */ } };

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.route('https://api.rfab.ai/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name) => page.screenshot({ path: join(out, `comics-${name}.jpg`), type: 'jpeg', quality: 86 });

  /** The ship, on a save edited to what has happened. `edit` runs in the page on the campaign object. */
  const ship = async (edit) => {
    await page.goto(`${base}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#campaign:not(.hidden) .cp-room', { timeout: 60000 });
    await page.evaluate((src) => {
      const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
      new Function('s', src)(s);
      s.greet = null;
      localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    }, edit);
    await page.goto(`${base}?campaign=ship`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#campaign:not(.hidden) [data-act="comics"]', { timeout: 60000 });
    await page.waitForTimeout(1200);
  };
  const button = () => page.evaluate(() => { const b = document.querySelector('#campaign [data-act="comics"]'); return b ? { text: b.textContent.trim(), title: b.getAttribute('title'), pip: b.querySelector('.cp-pip')?.textContent ?? '' } : null; });
  const tiles = () => page.evaluate(() => [...document.querySelectorAll('#comics .cm-tile')].map((t) => ({
    id: t.dataset.comic, locked: t.classList.contains('locked'), fresh: t.classList.contains('fresh'),
    name: t.querySelector('.cm-name')?.textContent.trim() ?? '', about: t.querySelector('.cm-about')?.textContent.trim() ?? '',
    cover: (() => { const i = t.querySelector('.cm-cover img'); return i ? (i.complete && i.naturalWidth > 0 ? 'ok' : 'broken') : 'none'; })(),
  })));
  const reader = () => page.evaluate(() => {
    const img = document.querySelector('#comics .cm-page');
    return { title: document.querySelector('#comics .cm-reading')?.textContent.trim() ?? '', count: document.querySelector('#comics .cm-count')?.textContent.trim() ?? '',
      next: document.querySelector('#comics [data-act="next"].cm-btn')?.textContent.trim() ?? '', prevOff: !!document.querySelector('#comics [data-act="prev"]')?.disabled,
      page: img ? { ok: img.complete && img.naturalWidth > 0, natural: img.naturalWidth, shown: Math.round(img.getBoundingClientRect().width) } : null };
  });
  const loaded = () => page.waitForFunction(() => { const i = document.querySelector('#comics .cm-page'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  const covers = () => page.waitForFunction(() => [...document.querySelectorAll('#comics .cm-cover img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});

  await page.addInitScript(() => {
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
  });

  // ── A: back from a lost first landing, the boss not heard ─────────────────────────────────────────
  console.log('\nA. a newcomer: the opening film watched, the first landing lost');
  await ship(`s.said = []; s.deployments = 1; s.captures = 0; s.onboard = { mission1: 'lost', deskOpen: false };`);
  await page.evaluate(() => localStorage.removeItem('broodfall-comics'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#campaign:not(.hidden) [data-act="comics"]', { timeout: 60000 });
  await page.waitForTimeout(1200);
  let b = await button();
  check(!!b && /^COMICS/.test(b.text), 'the room bar has COMICS, beside the Limb Codex', b ? b.text : 'no button');
  check(b?.pip === '1', 'it says one comic is waiting', `pip "${b?.pip}"; title "${b?.title}"`);
  await shot('a-room-bar');
  await page.click('#campaign [data-act="comics"]');
  await page.waitForSelector('#comics .cm-tile');
  await covers();
  let t = await tiles();
  check(t.length === 3, 'the shelf shows all three comics there are', `${t.length} tiles`);
  check(t.filter((x) => !x.locked).map((x) => x.id).join() === 'the-thing-from-the-sky', 'one is his: the one the opening film gives', t.filter((x) => !x.locked).map((x) => x.id).join());
  check(t.filter((x) => x.locked).every((x) => x.cover === 'none' && !/boss|night/i.test(x.name)), 'a locked comic shows no cover and no title', t.filter((x) => x.locked).map((x) => `${x.name}/${x.cover}`).join(' | '));
  check(t.filter((x) => x.locked).every((x) => x.about.length > 8), 'and says how it is earned', t.filter((x) => x.locked).map((x) => x.about).join(' | '));
  check(t.filter((x) => !x.locked).every((x) => x.cover === 'ok' && x.fresh), 'his comic has its cover and is marked NEW');
  check((await page.locator('#comics .cm-total').textContent()).trim() === '1 OF 3 UNLOCKED', 'the count: 1 OF 3 UNLOCKED');
  await shot('a-shelf-one-of-three');
  // a locked tile does nothing when clicked
  await page.locator('#comics .cm-tile.locked').first().click({ force: true });
  check(await page.locator('#comics .cm-page').count() === 0, 'a click on a locked comic opens nothing');
  await page.click('#comics [data-read="the-thing-from-the-sky"]');
  await loaded();
  let r = await reader();
  check(r.page?.ok === true, 'the page opens', JSON.stringify(r.page));
  check(r.page && r.page.shown >= 1100, 'wide enough to read the lettering at 1600 across', `${r.page?.shown}px of ${r.page?.natural}px`);
  check(r.count === 'PAGE 1 OF 1' && r.prevOff, 'PAGE 1 OF 1, nothing before it', r.count);
  check(/SHELF/.test(r.next), 'the only comic he has: the last page hands back to the shelf', r.next);
  await shot('a-reading');
  await page.keyboard.press('Escape');
  check(await page.locator('#comics .cm-shelf').count() === 1, 'Esc in the reader goes back to the shelf');
  t = await tiles();
  check(!t.find((x) => x.id === 'the-thing-from-the-sky').fresh, 'the comic he opened is no longer NEW');
  await page.keyboard.press('Escape');
  check(await page.locator('#comics.hidden').count() === 1, 'Esc on the shelf closes it');
  b = await button();
  check(b?.pip === '', 'the count on the button is gone', `pip "${b?.pip}"`);

  // ── B: the boss heard, a deployment won ───────────────────────────────────────────────────────────
  console.log('\nB. later: the boss heard, a deployment won');
  await ship(`s.said = ['boss']; s.deployments = 3; s.captures = 1; s.onboard = { mission1: 'won', deskOpen: true };`);
  b = await button();
  check(b?.pip === '2', 'two more are waiting', `pip "${b?.pip}"; title "${b?.title}"`);
  await page.click('#campaign [data-act="comics"]');
  await page.waitForSelector('#comics .cm-tile');
  await covers();
  t = await tiles();
  check(t.every((x) => !x.locked && x.cover === 'ok'), 'all three are his, each with its cover', t.map((x) => `${x.id}:${x.locked ? 'locked' : x.cover}`).join(' '));
  check(t.filter((x) => x.fresh).map((x) => x.id).join() === 'a-message-from-the-boss,ships-night', 'the two new ones are marked NEW; the one read before is not', t.filter((x) => x.fresh).map((x) => x.id).join());
  await shot('b-shelf-all-three');
  await page.click('#comics [data-read="a-message-from-the-boss"]');
  await loaded();
  r = await reader();
  check(r.count === 'PAGE 1 OF 2' && /NEXT PAGE/.test(r.next), 'the two-page comic opens on page 1 with NEXT PAGE', `${r.count} / ${r.next}`);
  await shot('b-boss-page-1');
  await page.keyboard.press('ArrowRight');
  await loaded();
  r = await reader();
  check(r.count === 'PAGE 2 OF 2' && r.page?.ok, 'the right arrow turns to page 2', r.count);
  check(/NEXT: SHIP'S NIGHT/.test(r.next), 'its last page offers the next comic by name', r.next);
  await shot('b-boss-page-2');
  await page.keyboard.press('ArrowLeft');
  await loaded();
  check((await reader()).count === 'PAGE 1 OF 2', 'the left arrow turns back');
  // ONE control reads on: a click on the page goes down it, then turns it, then opens the next comic
  // (a click where the page is on SCREEN: a click aimed at a point of the picture has the browser scroll that point back into view first)
  const onPage = async () => { const box = await page.locator('#comics .cm-scroll').boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); };
  const scrolled = async () => page.evaluate(() => Math.round(document.querySelector('#comics .cm-scroll').scrollTop));
  const lastComic = (title) => title.toUpperCase().startsWith('SHIP');
  await onPage();
  await page.waitForTimeout(700);
  check(await scrolled() > 100 && (await reader()).count === 'PAGE 1 OF 2', 'a click on the page reads on DOWN it first (the page is taller than the screen)', `scrolled ${await scrolled()}px, ${(await reader()).count}`);
  await shot('b-boss-page-1-lower');
  let clicks = 1;
  for (; clicks < 14 && !lastComic((await reader()).title); clicks++) { await onPage(); await page.waitForTimeout(650); await loaded(); }
  r = await reader();
  check(lastComic(r.title) && r.count === 'PAGE 1 OF 1', 'and at the foot of each page turns it; past the last page it opens the next comic', `${r.title} ${r.count} after ${clicks} clicks`);
  check(await scrolled() < 5, 'a new page starts at its top');
  await shot('b-ships-night');
  await page.click('#comics [data-act="shelf"]');
  t = await tiles();
  check(t.every((x) => !x.fresh), 'nothing is NEW once each has been opened');
  await page.mouse.click(8, 8);
  check(await page.locator('#comics.hidden').count() === 1, 'a click on the dark around it closes it');

  // ── at 1280 wide ──────────────────────────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.click('#campaign [data-act="comics"]');
  await page.waitForSelector('#comics .cm-tile');
  await covers();
  const fits = await page.evaluate(() => { const c = document.querySelector('#comics .cm-card').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.top >= 0 && c.bottom <= innerHeight; });
  check(fits, 'at 1280 x 720 the shelf is inside the window');
  await shot('c-shelf-1280');
  await page.click('#comics [data-read="a-message-from-the-boss"]');
  await loaded();
  r = await reader();
  check(r.page && r.page.shown >= 1100, 'and the page is still wide enough to read', `${r.page?.shown}px`);
  const bar = await page.evaluate(() => { const x = document.querySelector('#comics .cm-bar').getBoundingClientRect(); return x.right <= innerWidth + 1 && [...document.querySelectorAll('#comics .cm-bar button')].every((b) => { const q = b.getBoundingClientRect(); return q.right <= innerWidth + 1 && q.left >= 0; }); });
  check(bar, 'with every button of its bar on screen');
  await shot('c-reading-1280');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1600, height: 900 });

  // ── C: a new campaign keeps the shelf ─────────────────────────────────────────────────────────────
  console.log('\nC. a new campaign');
  await ship(`s.said = []; s.deployments = 1; s.captures = 0; s.onboard = { mission1: 'lost', deskOpen: false };`);
  b = await button();
  check(b?.pip === '' && /3 unlocked/.test(b?.title ?? ''), 'a new campaign that has earned nothing: still 3 unlocked, nothing new', b?.title);
  await page.click('#campaign [data-act="comics"]');
  await page.waitForSelector('#comics .cm-tile');
  await covers();
  t = await tiles();
  check(t.every((x) => !x.locked), 'all three are still on the shelf');
  await page.keyboard.press('Escape');

  // ── D: the real way it is earned ──────────────────────────────────────────────────────────────────
  console.log('\nD. the real thing: back from the first landing, YOKE greets him, the boss calls');
  await page.goto(`${base}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#campaign:not(.hidden) .cp-room', { timeout: 60000 });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.said = []; s.deployments = 1; s.captures = 0; s.onboard = { mission1: 'lost', deskOpen: false }; s.greet = 'first-lost'; delete s.lastGreeting;
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    localStorage.removeItem('broodfall-comics');
    localStorage.setItem('broodfall-reveal-seen', '1');
  });
  await page.goto(`${base}?campaign=ship`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#campaign:not(.hidden) [data-act="comics"]', { timeout: 60000 });
  b = await button();
  check(b?.pip === '1' && /1 unlocked/.test(b?.title ?? ''), 'before the call: one comic', b?.title);
  // her greeting plays through (scripted, no voice), then the boss's call comes up
  const call = page.locator('#boss-call');
  await call.waitFor({ state: 'attached', timeout: 150000 }).catch(() => {});
  check(await call.count() === 1, 'the boss calls');
  await page.waitForTimeout(1500);
  await shot('d-the-boss-calls');
  await call.click({ force: true }).catch(() => {});
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem('broodfall-campaign')).said ?? []).includes('boss'), null, { timeout: 30000 }).catch(() => {});
  const said = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')).said ?? []);
  check(said.includes('boss'), 'the call having played is kept with the campaign', said.join(','));
  // her last words about him, then the ship is drawn again
  await page.waitForFunction(() => document.querySelector('#campaign [data-act="comics"] .cp-pip')?.textContent === '2', null, { timeout: 90000 }).catch(() => {});
  b = await button();
  check(b?.pip === '2' && /2 unlocked/.test(b?.title ?? ''), 'when it is over the comic of it is on the shelf: COMICS says 2', b?.title);
  const note = await page.evaluate(() => { const n = document.getElementById('comics-note'); if (!n || n.classList.contains('hidden')) return null; const r = n.getBoundingClientRect(); const bar = document.querySelector('#campaign .cp-tools').getBoundingClientRect(); return { text: n.innerText.replace(/\s+/g, ' ').trim(), onScreen: r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0 && r.top >= 0, overBar: !(r.bottom < bar.top || r.top > bar.bottom || r.right < bar.left || r.left > bar.right) }; });
  check(!!note && /NEW COMIC UNLOCKED/.test(note.text) && /A MESSAGE FROM THE BOSS/i.test(note.text), 'and it is SAID, there and then: a notice names the comic', note ? note.text : 'no notice');
  check(!!note && note.onScreen && !note.overBar, 'the notice is on screen and not over the room bar');
  await shot('d-after-the-call');
  await page.click('#comics-note');
  await page.waitForSelector('#comics .cm-tile');
  check(await page.locator('#comics-note.hidden').count() === 1, 'a click on the notice opens the shelf, and the notice is gone');
  await covers();
  t = await tiles();
  check(t.find((x) => x.id === 'a-message-from-the-boss')?.fresh === true && t.find((x) => x.id === 'ships-night')?.locked === true, 'A Message From the Boss is his and NEW; the third is still locked');
  await shot('d-shelf-after-the-call');
  await page.keyboard.press('Escape');

  // ── E: trying to break it ─────────────────────────────────────────────────────────────────────────
  console.log('\nE. trying to break it');
  await ship(`s.said = ['boss']; s.deployments = 3; s.captures = 1; s.onboard = { mission1: 'won', deskOpen: true };`);
  // what the browser kept is rubbish
  await page.evaluate(() => localStorage.setItem('broodfall-comics', '{"have":"all of them","read":[7,null,"ships-night","a-comic-that-was-cut"]}'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#campaign:not(.hidden) [data-act="comics"]', { timeout: 60000 });
  await page.waitForTimeout(1200);
  b = await button();
  check(/3 unlocked/.test(b?.title ?? ''), 'rubbish in what the browser kept: the shelf is worked out again from the save', b?.title);
  // a page that is not there
  await ctx.route('**/art/ship/comics/ships-night/page_01.webp', (r) => r.fulfill({ status: 404, body: '' }));
  await page.click('#campaign [data-act="comics"]', { force: true });
  await page.waitForSelector('#comics .cm-tile');
  await page.dblclick('#comics [data-read="ships-night"]');
  await page.waitForSelector('#comics .cm-missing, #comics .cm-page', { timeout: 10000 });
  await page.waitForTimeout(800);
  check(await page.locator('#comics .cm-missing').count() === 1, 'a page that does not load is said in words, not shown as a broken picture');
  await shot('e-page-did-not-load');
  await page.click('#comics [data-act="shelf"]');
  check(await page.locator('#comics .cm-shelf').count() === 1, 'and the way back to the shelf still works');
  await ctx.unroute('**/art/ship/comics/ships-night/page_01.webp');
  // Esc many times, then open it again
  for (let i = 0; i < 4; i++) await page.keyboard.press('Escape');
  check(await page.locator('#comics.hidden').count() === 1 && await page.locator('#campaign:not(.hidden)').count() === 1, 'Esc four times closes it once and leaves the ship as it was');
  await page.click('#campaign [data-act="comics"]', { force: true });
  check(await page.locator('#comics:not(.hidden) .cm-tile').count() === 3, 'and it opens again');
  // a small window
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.waitForTimeout(300);
  const small = await page.evaluate(() => { const c = document.querySelector('#comics .cm-card').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.bottom <= innerHeight; });
  check(small, 'at 1024 x 640 the shelf is inside the window');
  await page.click('#comics [data-read="a-message-from-the-boss"]');
  await loaded();
  const smallBar = await page.evaluate(() => [...document.querySelectorAll('#comics .cm-bar button')].every((x) => { const q = x.getBoundingClientRect(); return q.right <= innerWidth + 1 && q.left >= 0 && q.width > 20; }));
  check(smallBar, 'and every button of the reader is on screen');
  await shot('e-reading-1024');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1600, height: 900 });

  check(errors.length === 0, 'no error in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  kill(server);
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
