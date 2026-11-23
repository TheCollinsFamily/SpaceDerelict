/**
 * The EAT A LIMB explainer's film (src/ui/sacrificeExplainer.ts), filmed FROM THE REAL GAME, not drawn:
 * a skirmish in a headless, muted browser; a Spitter standing; a card picked up; the pointer goes to the
 * Spitter (it lights, the hint says what eating it gives); a click eats it; the new limb is placed and wears
 * the Spitter's bonus. Playwright records the page; ffmpeg crops it to the action and makes a small loop.
 *
 *   npx vite --port 5322 --strictPort          (in the game folder, a server of its own)
 *   node tools/media/film-sacrifice.mjs [port] [--probe]
 *
 * Out: public/art/explain/sacrifice.mp4 (h264, silent). --probe only takes screenshots of the set-up
 * (tools/screenshots/film-sacrifice-*.png) to choose the crop. Never makes a sound (--mute-audio).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, '..', '..');
const PORT = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 5322);
const PROBE = process.argv.includes('--probe');
const W = 1280, H = 800;
const shots = join(game, 'tools', 'screenshots');
const raw = join(game, 'tools', 'screenshots', 'film-sacrifice-raw');
const out = join(game, 'public', 'art', 'explain', 'sacrifice.mp4');
mkdirSync(shots, { recursive: true });
rmSync(raw, { recursive: true, force: true });
mkdirSync(raw, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, ...(PROBE ? {} : { recordVideo: { dir: raw, size: { width: W, height: H } } }) });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/?seed=11&autostart=1&landing=0&directive=hold&speed=1`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.broodfall && document.querySelectorAll('#hand .card').length > 0, null, { timeout: 120000 });
await page.waitForTimeout(2500);

// A pointer the film can show (a headless browser draws none): an arrow that follows the mouse.
await page.evaluate(() => {
  const c = document.createElement('div');
  c.id = 'film-cursor';
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8 16 L12 24 L15.5 22.5 L11.5 14.5 L18.5 14.5 Z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.7));transition:none';
  document.body.appendChild(c);
  window.addEventListener('pointermove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
});

// The set-up: meat in the bank, a Spitter standing on a block by a street, a Lasher card next in hand.
const setup = await page.evaluate(() => {
  const bf = window.broodfall;
  const s = bf.sim;
  s.meat.war = 60;
  const want = (fam) => { for (let g = 0; g < 300 && s.hand[0]?.family !== fam; g++) s.issue({ kind: 'discard', cardIndex: 0 }); return s.hand[0]?.family === fam; };
  if (!want('spitter')) return { err: 'no spitter card' };
  // The buildable block nearest the core, so the action sits in the middle of the view.
  let best = -1, bestD = 1e9;
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!s.canBuildTower(c)) continue;
    const p = s.cellCenter(c);
    const d = Math.hypot(p.x - s.core.x, p.y - s.core.y);
    if (d < bestD && d > 60) { bestD = d; best = c; }
  }
  const r = bf.play({ kind: 'build', cardIndex: 0, cell: best });
  if (!r.ok) return { err: 'build: ' + r.err };
  if (!want('lasher')) return { err: 'no lasher card' };
  const t = s.towers[0];
  // A second spot for the new limb: another buildable block near the first.
  let spot = -1, spotD = 1e9;
  const tp = s.cellCenter(t.cell);
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!s.canBuildTower(c)) continue;
    const p = s.cellCenter(c);
    const d = Math.hypot(p.x - tp.x, p.y - tp.y);
    if (d > 40 && d < spotD) { spotD = d; spot = c; }
  }
  return { donor: tp, spot: s.cellCenter(spot), spotCell: spot, hand: s.hand.map((c) => c.family) };
});
if (setup.err) { console.error(setup.err); await browser.close(); process.exit(1); }
console.log('setup', JSON.stringify(setup));

const canvasBox = await page.locator('#stage canvas').boundingBox();
const toClient = async (p) => {
  const sp = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [p.x, p.y]);
  return { x: canvasBox.x + (sp.x / sp.vw) * canvasBox.width, y: canvasBox.y + (sp.y / sp.vh) * canvasBox.height };
};
// Closer in, so the limbs read at the film's small size: the view zoomed about the point between the two limbs.
{
  const a = await toClient(setup.donor), b = await toClient(setup.spot);
  await page.evaluate(([x, y]) => window.broodfall.renderer.zoomAt(x, y, 1.9), [(a.x + b.x) / 2, (a.y + b.y) / 2]);
  await page.waitForTimeout(600);
}
const donorAt = await toClient(setup.donor);
const spotAt = await toClient(setup.spot);
const cardBox = await page.locator('#hand .card').first().boundingBox();
const cardAt = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
console.log('donor', donorAt, 'spot', spotAt, 'card', cardAt);

/** Glide the pointer (a human's hand, not a jump). */
const glide = async (to, ms = 700) => { await page.mouse.move(to.x, to.y, { steps: Math.max(5, Math.round(ms / 70)) }); };

const marks = {};
const mark = (k) => { marks[k] = (Date.now() - t0) / 1000; };
await page.mouse.move(W * 0.55, H * 0.45);
await page.waitForTimeout(300);
mark('start');
if (PROBE) await page.screenshot({ path: join(shots, 'film-sacrifice-0-setup.png') });
await page.waitForTimeout(300);
await glide(cardAt, 550);
await page.waitForTimeout(150);
await page.mouse.click(cardAt.x, cardAt.y);
await page.waitForTimeout(450);
await glide(donorAt, 650);
await page.waitForTimeout(1700);
if (PROBE) await page.screenshot({ path: join(shots, 'film-sacrifice-1-hover.png') });
await page.mouse.click(donorAt.x, donorAt.y);
mark('eat');
await page.waitForTimeout(900);
if (PROBE) await page.screenshot({ path: join(shots, 'film-sacrifice-2-eaten.png') });
await glide(spotAt, 600);
await page.waitForTimeout(600);
if (PROBE) await page.screenshot({ path: join(shots, 'film-sacrifice-3-ghost.png') });
await page.mouse.click(spotAt.x, spotAt.y);
mark('placed');
await page.waitForTimeout(300);
// The pointer steps aside: the new limb stands wearing the eaten Spitter's part.
await glide({ x: spotAt.x + 70, y: spotAt.y + 50 }, 350);
await page.waitForTimeout(1800);
if (PROBE) await page.screenshot({ path: join(shots, 'film-sacrifice-4-placed.png') });
mark('end');
const after = await page.evaluate(() => {
  const s = window.broodfall.sim;
  return { towers: s.towers.map((t) => ({ family: t.family, pips: t.pips.map((p) => p.family ?? p) })), grafts: window.broodfall.graftsDrawn(), hint: document.getElementById('hint')?.textContent };
});
console.log('after', JSON.stringify(after), 'marks', JSON.stringify(marks));
console.log('errors', JSON.stringify(errors.slice(0, 5)));
const video = page.video();
await ctx.close();
await browser.close();
if (PROBE) process.exit(0);

const webm = await video.path();
// The crop: the two limbs, the hint line and the hand down to the bottom of the screen, 16:10.
const xs = [donorAt.x, spotAt.x, cardAt.x], ys = [donorAt.y, spotAt.y];
const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
const top = Math.max(0, Math.min(...ys) - 170);
const ch = Math.round((H - top) / 2) * 2;
const cw = Math.min(W, Math.round((ch * 16) / 10 / 2) * 2);
const x0 = Math.round(Math.max(0, Math.min(W - cw, cx - cw / 2)));
const y0 = H - ch;
const ss = Math.max(0, marks.start - 0.1);
const dur = marks.end - marks.start;
console.log('crop', { cw, ch, x0, y0, ss, dur });
mkdirSync(dirname(out), { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss.toFixed(2), '-i', webm, '-t', dur.toFixed(2),
  '-vf', `crop=${cw}:${ch}:${x0}:${y0},scale=720:-2:flags=lanczos,fps=30`,
  '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log('film', out, Math.round(statSync(out).size / 1024), 'KB');
rmSync(raw, { recursive: true, force: true }); // the raw take is not kept (tools/screenshots holds only pictures)
