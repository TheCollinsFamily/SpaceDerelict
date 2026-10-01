/**
 * THE SHIP'S PRESENTATION GAPS, CLOSED (Sep 30 2026): proof in the real game, on its own DEV server with the GPU on.
 *
 *   rooms   every room plays its slow loop (tools/art/ship-loops.mjs): the video is there, playing, advancing,
 *           its poster the room's picture; a still and a 6 s video per room:
 *           notes/screens/2026-09-30/ship-loop-<room>.jpg / .mp4
 *   globe   the planet (src/ui/globe3d.ts): it turns by itself, drag both ways, wheel zoom, hover a zone (its name,
 *           what it is, the lights still burning), a click on a territory turns it to face us and opens its briefing
 *           with its picture; held ground carries the creep, a counter-attack pulses:
 *           globe-1-idle.jpg, globe-2-turned.jpg, globe-3-hover.jpg, globe-4-zoom.jpg, globe-5-picked.jpg,
 *           globe-rotating.mp4 (it turning by itself), globe-interact.mp4 (spun, tilted, zoomed, a territory picked)
 *   meat    meat drops on the board (src/render/meatFx.ts): the three castes' chunks flying to the core, the pickup:
 *           meat-1-board.jpg, meat-2-close.jpg, meat-3-pickup.jpg, meat-drops.mp4
 *
 *   node tools/shot-ship-loops.mjs [rooms globe meat]      (dev server on BROODFALL_PORT, default 5289)
 * Frames come from Chrome's screencast (as tools/shot-anim.mjs); a small ring shows where the mouse is.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-09-30');
const scratch = join(tmpdir(), 'broodfall-ship-loops-frames');
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5289);
const URL0 = `http://localhost:${PORT}/`;
const VW = 1600, VH = 900;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

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

async function recorder(page, name) {
  const dir = join(scratch, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let on = false;
  cdp.on('Page.screencastFrame', async (f) => {
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    if (!on) return;
    const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: VW, maxHeight: VH, everyNthFrame: 1 });
  return { frames, start() { on = true; }, async stop() { on = false; try { await cdp.send('Page.stopScreencast'); } catch {} } };
}
function encode(frames, out) {
  if (frames.length < 2) throw new Error(`too few frames for ${out}`);
  const lines = ['ffconcat version 1.0'];
  for (let i = 0; i < frames.length; i++) {
    const next = frames[i + 1];
    const d = Math.max(1 / 120, Math.min(0.5, next ? next.t - frames[i].t : 1 / 30));
    lines.push(`file '${frames[i].file.replace(/\\/g, '/')}'`, `duration ${d.toFixed(5)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  const txt = join(dirname(frames[0].file), 'list.ffconcat');
  writeFileSync(txt, lines.join('\n'));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', txt,
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${out}: ${r.stderr}`);
  console.log(`  video ${out} (${frames.length} frames, ${(frames[frames.length - 1].t - frames[0].t).toFixed(1)} s)`);
}
const jpg = async (page, name, clip) => {
  const png = join(scratch, `${name}.png`);
  mkdirSync(scratch, { recursive: true });
  // The whole page, cut afterwards: a clipped screenshot shows up as a zoomed frame in a screencast running at the time.
  await page.screenshot({ path: png });
  const c = clip ? { x: Math.max(0, Math.round(clip.x)), y: Math.max(0, Math.round(clip.y)) } : null;
  const crop = clip ? ['-vf', `crop=${Math.min(VW - c.x, Math.round(clip.width))}:${Math.min(VH - c.y, Math.round(clip.height))}:${c.x}:${c.y}`] : [];
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, ...crop, '-q:v', '3', join(notes, `${name}.jpg`)]);
  console.log(`  shot  ${join(notes, `${name}.jpg`)}`);
};
/** A ring where the mouse is, so a video shows what the hand did. */
const CURSOR = () => {
  const add = () => {
    if (document.getElementById('shot-cursor')) return;
    const c = document.createElement('div');
    c.id = 'shot-cursor';
    c.style.cssText = 'position:fixed;z-index:999999;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.6);pointer-events:none;left:-40px;top:-40px;transition:transform .08s';
    document.body.appendChild(c);
    addEventListener('pointermove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('pointerdown', () => { c.style.transform = 'scale(.6)'; c.style.background = 'rgba(255,255,255,.5)'; }, true);
    addEventListener('pointerup', () => { c.style.transform = ''; c.style.background = ''; }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
};
async function freshPage(browser, extra = () => {}) {
  const context = await browser.newContext({ viewport: { width: VW, height: VH } });
  await context.addInitScript(() => {
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-globe-spin', 'on');
  });
  await context.addInitScript(CURSOR);
  await context.addInitScript(extra);
  const page = await context.newPage();
  page.on('pageerror', (e) => { console.log('  pageerror:', String(e).slice(0, 200)); failures.push('page error'); });
  return { context, page };
}
const noBanner = async (page, where) => {
  const b = await page.evaluate(() => { const n = document.getElementById('art-notice'); return n && getComputedStyle(n).display !== 'none' && n.offsetParent ? n.textContent : ''; });
  check(!b, `no "did not load" banner (${where})`, b.slice(0, 120));
};
/** Open the ship with the desk open, and the intercom's greeting out of the way. */
async function openShip(page) {
  await page.goto(`${URL0}?campaign=ship&open=1`, { timeout: 300000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 240000 });
  await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  if (await page.locator('.cp-icom-x').count()) await page.locator('.cp-icom-x').click().catch(() => {});
  await page.waitForTimeout(300);
}

const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (want('rooms')) {
    console.log('rooms: every room plays its loop');
    const { context, page } = await freshPage(browser);
    await openShip(page);
    const rooms = ['desk', 'genes', 'locker', 'board', 'comms', 'ai', 'quarters', 'orders', 'hobby'];
    for (const r of rooms) {
      await page.locator(`[data-room="${r}"]`).click();
      await page.waitForTimeout(400);
      if (await page.locator('.cp-icom-x').count()) await page.locator('.cp-icom-x').click().catch(() => {});
      const st = await page.evaluate(async () => {
        const v = document.querySelector('#campaign > video.room-loop');
        if (!v) return null;
        // A loaded machine may take a while to fetch a new loop: wait until it can play, then measure.
        for (let i = 0; i < 60 && v.readyState < 3; i++) await new Promise((res) => setTimeout(res, 250));
        const t0 = v.currentTime;
        await new Promise((res) => setTimeout(res, 2500));
        return { src: v.currentSrc.split('/').pop(), playing: !v.paused, ready: v.readyState, advanced: v.currentTime - t0, w: v.videoWidth, on: v.classList.contains('on'),
          bg: getComputedStyle(document.getElementById('campaign')).backgroundImage.split('/').pop() };
      });
      // The Directives and the Notebook have their own loops since Oct 1 2026 (they borrowed the Board's and the Locker's).
      const expect = r;
      check(!!st && st.src === `room-${expect}.mp4` && st.playing && st.ready >= 2 && st.advanced > 0.3 && st.w >= 1280 && st.on,
        `the ${r} room plays its loop`, st ? `${st.src}, ${st.w} px, +${st.advanced.toFixed(2)} s in 2.5 s, ready ${st.ready}, shown ${st.on}, poster ${st.bg}` : 'no video');
      if (['orders', 'hobby'].includes(r)) continue; // they borrow the Board's and the Locker's
      await page.mouse.move(VW - 5, VH - 5);
      await jpg(page, `ship-loop-${r}`);
      // Six seconds of it, the screen hidden so the room itself is seen (a second, plain pass: the card is put back).
      await page.addStyleTag({ content: '#campaign .cp-card, #campaign .cp-icom, #campaign .cp-yoke, #shot-cursor { visibility: hidden !important; } #campaign.ship-art::before { opacity: 0.25; }' });
      const rec = await recorder(page, `room-${r}`);
      rec.start();
      await page.waitForTimeout(6000);
      await rec.stop();
      encode(rec.frames, join(notes, `ship-loop-${r}.mp4`));
      await page.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); s?.remove(); });
    }
    await noBanner(page, 'ship');
    // Reduce motion: the still, no video.
    await page.evaluate(() => { const k = 'broodfall-settings'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.reduceMotion = true; localStorage.setItem(k, JSON.stringify(s)); });
    await page.reload();
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    if (await page.locator('.cp-icom-x').count()) await page.locator('.cp-icom-x').click().catch(() => {});
    await page.locator('[data-room="genes"]').click();
    await page.waitForTimeout(500);
    const still = await page.evaluate(() => ({ video: !!document.querySelector('#campaign > video.room-loop'), bg: getComputedStyle(document.getElementById('campaign')).backgroundImage.split('/').pop() }));
    check(!still.video && /room-genes/.test(still.bg), 'with Reduce motion the room is its still, no video', JSON.stringify(still));
    await context.close();
  }

  if (want('globe')) {
    console.log('globe: the planet');
    // Three held, one of them under counter-attack, so the creep and the pulse show.
    const { context, page } = await freshPage(browser);
    await openShip(page);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
      s.held = [...new Set([...(s.held ?? []), 'crash-site', 'cul-de-sac', 'granary'])];
      s.underAttack = 'granary';
      localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    });
    await openShip(page);
    await page.locator('[data-room="desk"]').click();
    await page.waitForSelector('.globe-box.g3d canvas.globe-3d', { timeout: 15000 });
    await page.waitForTimeout(1200);
    const box = await page.locator('.globe-box').boundingBox();
    const clip = { x: box.x - 30, y: box.y - 30, width: box.width + 560, height: box.height + 60 };
    await page.mouse.move(VW - 5, VH - 5);
    const turned = await page.evaluate(async () => {
      const m = () => [...document.querySelectorAll('.globe .site')].map((g) => g.getAttribute('transform')).join('|');
      const a = m();
      await new Promise((r) => setTimeout(r, 1500));
      return a !== m();
    });
    check(turned, 'the planet turns by itself (its markers move with it)');
    await jpg(page, 'globe-1-idle', clip);
    // Rotating by itself: 8 s.
    let rec = await recorder(page, 'globe-rot');
    rec.start();
    await page.waitForTimeout(8000);
    await rec.stop();
    encode(rec.frames, join(notes, 'globe-rotating.mp4'));
    await jpg(page, 'globe-2-turned', clip);

    rec = await recorder(page, 'globe-int');
    rec.start();
    await page.waitForTimeout(1200);
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    // Drag: east-west, then north-south, let go with a flick (it coasts).
    const before = await page.evaluate(() => [...document.querySelectorAll('.globe .site')].map((g) => g.getAttribute('transform')).join('|'));
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 150, cy, { steps: 20 });
    await page.mouse.move(cx - 150, cy + 110, { steps: 16 });
    await page.mouse.move(cx - 60, cy + 90, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => [...document.querySelectorAll('.globe .site')].map((g) => g.getAttribute('transform')).join('|'));
    const front = await page.evaluate(() => [...document.querySelectorAll('.globe .site:not(.behind)')].length);
    check(after !== before && front >= 1, 'dragged both ways: the planet turned and tilted under the hand', `${front} sites on the near side`);
    // Wheel: in, then back out a little.
    await page.mouse.move(cx + 20, cy - 10);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -160); await page.waitForTimeout(90); }
    await page.waitForTimeout(700);
    await jpg(page, 'globe-4-zoom', clip);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 160); await page.waitForTimeout(90); }
    await page.waitForTimeout(600);
    // Back with the keyboard (the arrows tilt and turn it, as the turn buttons do) until an open site faces us, then hover its zone.
    const openNear = () => page.evaluate(() => {
      const b = document.querySelector('.globe-box').getBoundingClientRect();
      const all = [...document.querySelectorAll('.globe .site.open:not(.behind)')].map((g) => { const r = g.getBoundingClientRect(); return { id: g.dataset.site, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      all.forEach((a) => { a.d = Math.hypot(a.x - (b.x + b.width / 2), a.y - (b.y + b.height / 2)); });
      all.sort((a, c) => a.d - c.d);
      return all[0] && all[0].d < b.width * 0.3 ? all[0] : null;
    });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500); }
    let target = await openNear();
    for (let i = 0; i < 12 && !target; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(700); target = await openNear(); }
    check(!!target, 'an open landing site faces us', target?.id ?? 'none');
    if (target) {
      // Hover the zone just beside its marker: the zone lights, its tooltip.
      await page.mouse.move(target.x + 14, target.y + 18, { steps: 12 });
      await page.waitForTimeout(700);
      const tip = await page.evaluate(() => { const t = document.querySelector('.globe-tip'); return t?.classList.contains('on') ? t.textContent : ''; });
      check(/can land|yours|under attack|not yet/.test(tip), 'hovering a zone shows its name and what it is', tip);
      await jpg(page, 'globe-3-hover', clip);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(1800);
      const picked = await page.evaluate(() => ({ sel: document.querySelector('.globe .site.sel')?.dataset.site, brief: document.querySelector('.cp-brief .cp-sub')?.textContent ?? '', pic: !!document.querySelector('.cp-brief img, .cp-brief .cp-terr-pic, .cp-brief [class*="territory"]') }));
      check(!!picked.sel && !/PICK A LANDING SITE/.test(picked.brief), 'a click on the zone picks the territory and opens its briefing', JSON.stringify(picked));
      const centred = await page.evaluate(() => { const g = document.querySelector('.globe .site.sel'); const b = document.querySelector('.globe-box').getBoundingClientRect(); const r = g.getBoundingClientRect(); return Math.hypot(r.x + r.width / 2 - (b.x + b.width / 2), r.y + r.height / 2 - (b.y + b.height / 2)); });
      check(centred < 60, 'the planet turned to face what was picked', `${centred.toFixed(0)} px from the middle`);
      await page.mouse.move(VW - 5, VH - 5, { steps: 8 });
      await page.waitForTimeout(800);
      await jpg(page, 'globe-5-picked', { x: box.x - 30, y: box.y - 30, width: VW - box.x + 10, height: box.height + 160 });
      // And a marker click, as before.
      const other = page.locator('.globe .site.held:not(.behind)').first();
      if (await other.count()) { await other.click(); await page.waitForTimeout(1500); }
    }
    await rec.stop();
    encode(rec.frames, join(notes, 'globe-interact.mp4'));
    const red = await page.evaluate(() => {
      const c = document.querySelector('canvas.globe-3d');
      const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
      const g = k.getContext('2d'); g.drawImage(c, 0, 0);
      const d = g.getImageData(0, 0, k.width, k.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i] > d[i + 1] * 1.6 && d[i] > d[i + 2] * 1.6) n++;
      return n;
    });
    check(red > 500, 'held ground carries the creep\'s red', `${red} red pixels`);
    await noBanner(page, 'globe');
    await context.close();
  }

  if (want('meat')) {
    console.log('meat: drops on the board');
    const { context, page } = await freshPage(browser);
    await page.goto(`${URL0}?seed=3&autostart=1&auto=1&speed=0&biome=megacity&directive=hold`, { timeout: 300000, waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.sim, null, { timeout: 240000 });
    await page.waitForTimeout(2500);
    check(await page.evaluate(() => window.broodfall.fx().meat === true), 'the meat sheet is loaded');
    let st;
    for (let i = 0; i < 400; i++) {
      st = await page.evaluate(() => { const bf = window.broodfall; bf.step(40); const s = bf.sim; return { phase: s.phase, wave: s.waveNumber, towers: s.towers.length, units: s.enemies.length, outcome: s.outcome }; });
      if (st.outcome !== 'playing') break;
      if (st.phase === 'siege' && st.wave >= 3 && st.towers >= 6 && st.units >= 8) break;
    }
    console.log('  state: ' + JSON.stringify(st));
    await page.evaluate(() => { window.broodfall.surface?.(); const b = document.querySelector('#speed-box button[data-speed="1"]'); if (b) b.click(); });
    // Close on the core: the drops fly to it.
    const canvas = page.locator('#stage canvas');
    const cb = await canvas.boundingBox();
    const core = await page.evaluate(() => { const s = window.broodfall.sim; return [s.core.x, s.core.y]; });
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    const where = async () => { const at = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), core); return { x: cb.x + (at.x / at.vw) * cb.width, y: cb.y + (at.y / at.vh) * cb.height }; };
    let p = await where();
    await page.mouse.move(p.x, p.y);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(600);
    p = await where();
    await page.keyboard.down('Shift');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height * 0.5, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await page.mouse.move(cb.x + cb.width - 4, cb.y + 4);
    const rec = await recorder(page, 'meat');
    rec.start();
    let shots = 0, pickShot = false, maxFly = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 14000) {
      const f = await page.evaluate(() => window.broodfall.fx());
      maxFly = Math.max(maxFly, f.meatFlying);
      if (f.meatFlying >= 2 && shots === 0) { await jpg(page, 'meat-1-board'); shots++; }
      else if (f.meatFlying >= 2 && shots === 1) {
        const at = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), core);
        const c = { x: cb.x + (at.x / at.vw) * cb.width, y: cb.y + (at.y / at.vh) * cb.height };
        await jpg(page, 'meat-2-close', { x: Math.max(0, c.x - 330), y: Math.max(0, c.y - 230), width: 660, height: 400 });
        shots++;
      }
      if (f.meatPickups > 0 && !pickShot && shots >= 2) {
        const at = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), core);
        const c = { x: cb.x + (at.x / at.vw) * cb.width, y: cb.y + (at.y / at.vh) * cb.height };
        await jpg(page, 'meat-3-pickup', { x: Math.max(0, c.x - 260), y: Math.max(0, c.y - 200), width: 520, height: 320 });
        pickShot = true;
      }
      await page.waitForTimeout(120);
    }
    await rec.stop();
    encode(rec.frames, join(notes, 'meat-drops.mp4'));
    const end = await page.evaluate(() => window.broodfall.fx());
    check(maxFly >= 2, 'meat drops fly as pictures', `up to ${maxFly} at once`);
    check(end.meatPickedUp > 0, 'the core takes them with a pickup', `${end.meatPickedUp} picked up`);
    await noBanner(page, 'board');
    await context.close();
  }
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${dev.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
