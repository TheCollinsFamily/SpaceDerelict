/**
 * The desktop game as a player starts it (desktop/main.cjs), first launch, fresh saves: the window
 * opens, the game is built if it needs to be, and the opening film plays with sound at once, no BEGIN
 * card. Then Esc, and the game behind it. Screens in notes/screens/<date>/desktop-*.png.
 *   node tools/shot-desktop.mjs
 */
import { _electron as electron } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';

const GAME = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const day = new Date().toISOString().slice(0, 10);
const shots = path.join(GAME, 'notes', 'screens', day);
fs.mkdirSync(shots, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'broodfall-desktop-'));
// Saves as a new player's, windowed (BROODFALL_SHOT_FULL=1: full screen as a player gets it; a check that
// covers the whole screen is spoilt by a click of whoever is at the PC, which skips the film).
if (!process.env.BROODFALL_SHOT_FULL) fs.writeFileSync(path.join(userData, 'window.json'), JSON.stringify({ fullscreen: false }));

const t0 = Date.now();
const app = await electron.launch({ args: [GAME], cwd: GAME, env: { ...process.env, BROODFALL_USER_DATA: userData } });
const fail = [];
try {
  const win = await app.firstWindow();
  await win.waitForURL(/127\.0\.0\.1/, { timeout: 120_000 });
  const full = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFullScreen());
  console.log('full screen:', full);
  if (process.env.BROODFALL_SHOT_FULL && !full) fail.push('the window is not full screen');
  console.log(`game page after ${((Date.now() - t0) / 1000).toFixed(1)} s: ${win.url()}`);
  await win.waitForFunction(() => window.__bfIntroFilm, null, { timeout: 30_000 });
  await win.waitForTimeout(1500);
  const state = await win.evaluate(() => ({
    film: window.__bfIntroFilm,
    begin: !!document.querySelector('#intro.begin'),
    time: Number(document.querySelector('#intro')?.dataset.t ?? 0),
    muted: document.querySelector('#intro video')?.muted,
    desktop: 'broodfallDesktop' in window,
  }));
  console.log('film:', state);
  if (state.film !== 'playing') fail.push(`film is "${state.film}", not playing`);
  if (state.begin) fail.push('the BEGIN card is up');
  if (state.muted !== false) fail.push('the film is muted');
  if (!state.desktop) fail.push('no desktop bridge');
  await win.waitForTimeout(4000);
  await win.screenshot({ path: path.join(shots, 'desktop-film.png') });
  const t = await win.evaluate(() => Number(document.querySelector('#intro')?.dataset.t ?? 0));
  console.log(`film clock after 4 s more: ${t}`);
  if (!(t > 2)) fail.push(`the film is not moving (t=${t})`);
  await win.keyboard.press('Escape');
  await win.waitForTimeout(5000);
  await win.screenshot({ path: path.join(shots, 'desktop-after-film.png') });
  const menuShown = await win.evaluate(() => !document.getElementById('menu')?.classList.contains('hidden') && getComputedStyle(document.getElementById('menu')).display !== 'none');
  console.log('menu showing after the film:', menuShown);
  if (menuShown) fail.push('first launch went to the menu');
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
console.log(fail.length ? `FAIL\n- ${fail.join('\n- ')}` : 'PASS');
process.exit(fail.length ? 1 : 0);
