/**
 * THE INTERFACE PART 2 OF THE PAD LANDS ON (Oct 2 2026; Collins: "the ending one being a screenshot of the interface").
 * Opens the ship at the Directive Desk exactly as the post-mission report shows it (src/ui/campaignUi.ts showDebrief: the
 * room's loop and picture, the whole screen, no top bar), with the report's card hidden: the frame part 2's last clip ends
 * on, so the hand-off from the film to the live interface is the same picture. 1280x720 (the clips' own size).
 *
 * Usage: node tools/shot-padship-end.mjs [--dist dist-pad2]   (a build in that folder)
 * Writes: art-src-new/pad-ship/interface-end.png (the end frame), notes/art-review/pad/interface-end.jpg.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DIST = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : 'dist-pad2';
const RAW = process.env.PADSHIP_RAW || join(root, 'art-src-new', 'pad-ship');
const REVIEW = join(root, 'notes', 'art-review', 'pad');
mkdirSync(RAW, { recursive: true });
mkdirSync(REVIEW, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5403);
const srv = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: root, shell: process.platform === 'win32', stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 10000));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
  });
  await page.goto(`http://localhost:${PORT}/?campaign=ship&open=1`);
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 20000 });
  await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 20000 }).catch(() => {});
  await page.locator('[data-room="desk"]').click();
  // The report's look: the room alone (showDebrief replaces the screen with one card), the card not yet there.
  await page.evaluate(() => {
    const el = document.getElementById('campaign');
    for (const c of [...el.children]) if (!c.matches('video')) c.style.visibility = 'hidden';
    document.querySelectorAll('.loader, #loader').forEach((x) => { x.style.display = 'none'; });
  });
  // The loop's first frame: the room loop is held at 0 (the clip ends on it).
  await page.evaluate(async () => {
    const v = document.querySelector('#campaign video');
    if (v) { v.pause(); v.currentTime = 0; await new Promise((r) => setTimeout(r, 400)); }
  });
  await page.waitForTimeout(600);
  const png = join(RAW, 'interface-end.png');
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(REVIEW, 'interface-end.jpg')]);
  console.log(png);
} finally {
  await browser.close();
  srv.kill();
  spawnSync('cmd', ['/c', `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT} ^| findstr LISTENING') do taskkill /F /PID %a`], { shell: true });
}
process.exit(0);
