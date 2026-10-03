/**
 * THE REAL INTERFACE OVER THE ROOMS SEEN THROUGH HIS EYES (Collins, Oct 3 2026: "would this look better if you stayed in
 * first person the whole time ... show me some options"). The game is not changed: the browser is handed another picture
 * when it asks for a room's backdrop (tools/art/fp-options.mjs draws them into art-src-new/fp-options/), and its loop is
 * held back so the picture shows. Each room is shot as it is now and through his eyes; the post-deployment report (where
 * the pad's film ends) the same way.
 *
 *   node tools/shot-fp-options.mjs [rooms report] [--look now|eyes|hands|down]     (its own dev server on BROODFALL_PORT, default 5417)
 * Writes: notes/art-review/fp-options/ui/<room>-<now|eyes|hands|down>.jpg and report-<now|eyes|hands|down>.jpg, 1600x900 (their
 * PNGs in art-src-new/fp-options/ui/, which the option films are cut from),
 * YOKE's greeting intercom closed in the rooms (it covers the lower left while she speaks).
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(root, 'art-src-new', 'fp-options');
const OUT = join(root, 'notes', 'art-review', 'fp-options', 'ui');
mkdirSync(OUT, { recursive: true });
mkdirSync(join(RAW, 'ui'), { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5417);
const URL0 = `http://localhost:${PORT}/`;
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);
/** `--look down` shoots that look only. */
const LOOK = only.includes('--look') ? only[only.indexOf('--look') + 1] : null;

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
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1', BROODFALL_PORT: String(PORT) },
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

/** [the room's button, the backdrop it asks for, the look's name, the picture handed over instead (none = as it is now)]. */
const ROOMS = [
  ['desk', 'room-desk', 'now', null], ['desk', 'room-desk', 'eyes', 'desk.png'], ['desk', 'room-desk', 'hands', 'desk-hands.png'], ['desk', 'room-desk', 'down', 'desk-down.png'],
  ['genes', 'room-genes', 'now', null], ['genes', 'room-genes', 'eyes', 'genes.png'],
  ['comms', 'room-comms', 'now', null], ['comms', 'room-comms', 'eyes', 'comms.png'],
  ['ai', 'room-ai', 'now', null], ['ai', 'room-ai', 'eyes', 'ai.png'],
];

/** A page whose rooms are drawn with `swap` ({ 'room-desk': file }) in place of their own backdrops. */
async function pageWith(browser, swap, extra = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript(() => {
    if (sessionStorage.getItem('fp-set')) return;
    sessionStorage.setItem('fp-set', '1');
    localStorage.clear();
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
  });
  await extra(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 200)));
  for (const [name, file] of Object.entries(swap)) {
    const body = readFileSync(join(RAW, file));
    // The room's picture (the loop's poster, and the still it falls back to) and the film's last frame.
    await page.route(new RegExp(`/(${name}|ship-end)\\.webp(\\?.*)?$`), (r) => (r.request().url().includes('ship-end') && name !== 'room-desk' ? r.continue() : r.fulfill({ body, contentType: 'image/png' })));
    // Its loop has him in it: held back, the picture stays.
    await page.route(new RegExp(`/${name}\\.mp4(\\?.*)?$`), (r) => r.abort());
  }
  return { context, page };
}

const save = async (page, name) => {
  // The PNG stays with the raw art (the option films are cut from it); the JPEG is the one to look at.
  const png = join(RAW, 'ui', `${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(OUT, `${name}.jpg`)]);
  console.log('  ', join(OUT, `${name}.jpg`));
};

const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (want('rooms')) {
    for (const [room, backdrop, look, file] of ROOMS) {
      if (LOOK && look !== LOOK) continue;
      if (file && !existsSync(join(RAW, file))) { console.log(`  ${room}-${look}: ${file} not drawn yet`); continue; }
      const { context, page } = await pageWith(browser, file ? { [backdrop]: file } : {});
      await page.goto(`${URL0}?campaign=ship&open=1`, { waitUntil: 'load', timeout: 300000 });
      await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 120000 });
      await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 30000 }).catch(() => {});
      await page.locator(`[data-room="${room}"]`).click();
      // Her greeting's intercom covers the lower left of the room: closed, so the room is seen (she stays aboard).
      await page.locator('[data-act="icom-close"]').click({ timeout: 3000 }).catch(() => {});
      // The same moment of the room for both looks: its loop held on its first frame.
      await page.waitForTimeout(1500);
      await page.evaluate(async () => {
        const v = document.querySelector('#campaign video');
        if (v && v.readyState > 0) { v.pause(); v.currentTime = 0; await new Promise((r) => setTimeout(r, 400)); }
      });
      await page.waitForTimeout(900);
      await save(page, `${room}-${look}`);
      await context.close();
    }
  }

  if (want('report')) {
    for (const [look, file] of [['now', null], ['eyes', 'desk.png'], ['hands', 'desk-hands.png'], ['down', 'desk-down.png']]) {
      if (LOOK && look !== LOOK) continue;
      if (file && !existsSync(join(RAW, file))) continue;
      // The pad plays under automation only when asked; one press skips its films, straight to the report at the desk.
      const { context, page } = await pageWith(browser, file ? { 'room-desk': file } : {}, (c) => c.addInitScript(() => localStorage.setItem('broodfall-pad-outro', 'on')));
      await page.goto(`${URL0}?campaign=ship&open=1`, { waitUntil: 'load', timeout: 300000 });
      await page.waitForSelector('#campaign:not(.hidden)', { timeout: 120000 });
      await page.evaluate(() => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: 'harbor', dares: [], objectors: [] })));
      await page.goto(`${URL0}?campaign=run`, { waitUntil: 'load', timeout: 300000 });
      await page.waitForFunction(() => window.broodfall && window.__bfBooted, null, { timeout: 120000 });
      await page.evaluate(() => window.broodfall.step(900));
      await page.waitForTimeout(2500);
      await page.evaluate(() => { const s = window.broodfall.sim; s.outcome = 'won'; s.events.push({ kind: 'won' }); window.broodfall.step(1); });
      await page.waitForSelector('#pad-outro', { timeout: 8000 });
      await page.waitForTimeout(1200);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !!document.querySelector('#campaign:not(.hidden) .cp-card'), null, { timeout: 20000 });
      await page.waitForFunction(() => !document.getElementById('pad-outro'), null, { timeout: 15000 }).catch(() => {});
      await page.evaluate(async () => {
        const v = document.querySelector('#campaign video');
        if (v && v.readyState > 0) { v.pause(); v.currentTime = 0; await new Promise((r) => setTimeout(r, 400)); }
      });
      await page.waitForTimeout(1200);
      await save(page, `report-${look}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  dev.kill();
  freePort();
}
process.exit(0);
