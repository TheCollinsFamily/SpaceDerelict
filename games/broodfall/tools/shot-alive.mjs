/**
 * THE STILLS THAT CAME ALIVE, PROVED IN THE GAME (Oct 1 2026; notes/VIDEO-AUDIT.md). Its own DEV server, the GPU on.
 * Each surface is seen twice: BEFORE (the still, as it was: under automation the loops are off unless asked for) and
 * AFTER (localStorage['broodfall-alive'] = 'on': the loop), checked (a <video> in the still's place, playing, its
 * time moving, one per surface) and filmed:
 *
 *   scenes    a faction scene's lobby card per faction, and a reveal card         video-scene-<id>-before|after.jpg, .mp4
 *   territory a landing site's picture over the briefing                          video-territory-before|after.jpg, .mp4
 *   rooms     the Directives and the Notebook in their own loops (before: the Board's and the Locker's they borrowed)
 *   partner   her file photograph on the data pad in the quarters
 *   genes     the Gene Bay's organ cards stepping through their scan loops
 *   debrief   the report's lead (won, lost; held through the module itself)
 *   hand      the hand's limb pictures stepping through their idles
 *   skyline   the organ stage's skyline: the light, the smoke, the searchlight
 *   boss      the boss's transmission, its loop seam crossfaded (before: the clip as it was, three times round)
 *   reduce    Settings > Reduce motion: every surface is its still again, nothing plays
 *
 *   node tools/shot-alive.mjs [beat ...]          (dev server on BROODFALL_PORT, default 5293)
 * Everything lands in notes/screens/2026-10-01/ (video-*.jpg, video-*.mp4); the README there indexes it.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-10-01');
const scratch = join(tmpdir(), 'broodfall-alive-frames');
mkdirSync(notes, { recursive: true });
mkdirSync(scratch, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5293);
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
/** The frames to an MP4, cut to `box` (page pixels) when given. */
function encode(frames, out, box) {
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
  const crop = box ? `crop=${Math.round(box.width) & ~1}:${Math.round(box.height) & ~1}:${Math.round(box.x)}:${Math.round(box.y)},` : '';
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', txt,
    '-vf', `fps=30,${crop}scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${out}: ${r.stderr}`);
  console.log(`  video ${out} (${frames.length} frames, ${(frames[frames.length - 1].t - frames[0].t).toFixed(1)} s)`);
}
const pad = (b, p = 24) => b && { x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), width: Math.min(VW - Math.max(0, b.x - p), b.width + 2 * p), height: Math.min(VH - Math.max(0, b.y - p), b.height + 2 * p) };
const jpg = async (page, name, box) => {
  const png = join(scratch, `${name}.png`);
  await page.screenshot({ path: png });
  const crop = box ? ['-vf', `crop=${Math.round(box.width)}:${Math.round(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`] : [];
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, ...crop, '-q:v', '3', join(notes, `${name}.jpg`)]);
  console.log(`  shot  ${join(notes, `${name}.jpg`)}`);
};
async function film(page, name, box, ms = 5000) {
  const rec = await recorder(page, name);
  rec.start();
  await page.waitForTimeout(ms);
  await rec.stop();
  encode(rec.frames, join(notes, `${name}.mp4`), box);
}

async function freshPage(browser, alive) {
  const context = await browser.newContext({ viewport: { width: VW, height: VH } });
  await context.addInitScript((on) => {
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    if (on) localStorage.setItem('broodfall-alive', 'on'); else localStorage.removeItem('broodfall-alive');
  }, alive);
  const page = await context.newPage();
  page.on('pageerror', (e) => { console.log('  pageerror:', String(e).slice(0, 200)); failures.push('page error'); });
  return { context, page };
}
const closeIcom = async (page) => { if (await page.locator('.cp-icom-x').count()) await page.locator('.cp-icom-x').click().catch(() => {}); await page.waitForTimeout(250); };
async function openShip(page, query = 'campaign=ship&open=1') {
  await page.goto(`${URL0}?${query}`, { timeout: 300000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 240000 });
  await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 240000 });
  await page.waitForTimeout(1200);
  await closeIcom(page);
}
/** The loop in `sel`: there, a video, playing, its time moving. */
async function playing(page, sel) {
  return page.evaluate(async (sel) => {
    let v = null;
    for (let i = 0; i < 80 && !(v = document.querySelector(sel))?.readyState; i++) await new Promise((r) => setTimeout(r, 250));
    if (!v || v.tagName !== 'VIDEO') return { video: false, tag: v?.tagName ?? null };
    for (let i = 0; i < 60 && v.readyState < 3; i++) await new Promise((r) => setTimeout(r, 250));
    const t0 = v.currentTime;
    await new Promise((r) => setTimeout(r, 1500));
    return { video: true, playing: !v.paused, ready: v.readyState, moved: +(v.currentTime - t0).toFixed(2), src: v.currentSrc.split('/').pop(), w: v.videoWidth,
      poster: v.poster.split('/').pop(), count: document.querySelectorAll('video.alive').length };
  }, sel);
}
const box = async (page, sel, p = 24) => pad(await page.locator(sel).first().boundingBox().catch(() => null), p);

async function loadFactions() {
  const { code } = await transform(readFileSync(join(root, 'content', 'campaign.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).FACTIONS;
}
/** Put one scene in the queue of the saved campaign and come back aboard. */
async function queueScene(page, entry) {
  await page.evaluate((e) => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.pendingScenes = [e];
    s.contacted = [...new Set([...(s.contacted ?? []), e.faction])];
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
  }, entry);
  await openShip(page, 'campaign=ship');
  await page.waitForSelector('.cp-scene-card .cp-scene-pic', { timeout: 15000 });
  await page.waitForTimeout(600);
}

const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (want('scenes')) {
    console.log('scenes: the faction scenes and a reveal, still then alive');
    const F = await loadFactions();
    const picks = [
      { faction: 'delegation', scene: F.find((f) => f.id === 'delegation').contact, contact: true },
      { faction: 'faithful', scene: F.find((f) => f.id === 'faithful').beats.find((b) => b.id === 'prophecy').scene },
      { faction: 'institute', scene: F.find((f) => f.id === 'institute').beats.find((b) => b.id === 'machines').scene },
      { faction: 'faithful', scene: F.find((f) => f.id === 'faithful').reveal },
    ];
    for (const alive of [false, true]) {
      const { context, page } = await freshPage(browser, alive);
      await openShip(page);
      for (const p of picks) {
        await queueScene(page, p);
        const id = p.scene.picture;
        const b = await box(page, '.cp-scene-card');
        await page.mouse.move(VW - 5, VH - 5);
        if (!alive) {
          const tag = await page.evaluate(() => document.querySelector('.cp-scene-card .cp-scene-pic').tagName);
          check(tag === 'IMG', `${id}: before, the card shows its still`, tag);
          await jpg(page, `video-scene-${id}-before`, b);
          continue;
        }
        const st = await playing(page, '.cp-scene-card video.cp-scene-pic.alive');
        const group = p.scene === F.find((f) => f.id === p.faction).reveal ? 'reveal' : 'scene';
        check(st.video && st.playing && st.moved > 0.5 && st.src === `${group}-${id}.mp4` && st.count === 1, `${id}: the card plays its loop, one video`, JSON.stringify(st));
        await jpg(page, `video-scene-${id}-after`, b);
        await film(page, `video-scene-${id}`, await box(page, '.cp-scene-card .cp-scene-pic', 6), 5000);
        // Clicked, it is as wide as the card, still playing; clicked again, back.
        const w0 = await page.evaluate(() => Math.round(document.querySelector('.cp-scene-pic').getBoundingClientRect().width));
        await page.locator('.cp-scene-pic').click();
        const w1 = await page.evaluate(() => ({ w: Math.round(document.querySelector('.cp-scene-pic').getBoundingClientRect().width), on: !document.querySelector('.cp-scene-pic').paused }));
        await page.locator('.cp-scene-pic').click();
        check(w1.w > w0 * 1.6 && w1.on, `${id}: the loop enlarges on a click, as the still did, and keeps playing`, `${w0} -> ${w1.w} px`);
      }
      // The card answered: its loop is let go (no video left behind).
      await page.locator('.cp-scene [data-act="scene-ok"], .cp-scene [data-act="scene-later"]').first().click().catch(() => {});
      await page.waitForTimeout(600);
      if (alive) {
        const left = await page.evaluate(() => window.broodfallAlive?.() ?? null);
        check(!left || left.every((x) => x.connected), 'a scene answered leaves no loop playing behind it', JSON.stringify(left));
      }
      await context.close();
    }
  }

  if (want('territory') || want('rooms') || want('partner') || want('genes')) {
    for (const alive of [false, true]) {
      const { context, page } = await freshPage(browser, alive);
      await openShip(page);
      const tag = alive ? 'after' : 'before';
      if (want('territory')) {
        console.log(`territory (${tag})`);
        await page.locator('[data-room="desk"]').click();
        await page.waitForTimeout(500);
        await page.locator('.globe .site.open:not(.behind)').first().click().catch(() => {});
        await page.waitForSelector('.cp-territory-pic', { timeout: 15000 });
        await page.waitForTimeout(700);
        const b = await box(page, '.cp-brief');
        await page.mouse.move(VW - 5, VH - 5);
        if (alive) {
          const st = await playing(page, 'video.cp-territory-pic.alive');
          check(st.video && st.playing && st.moved > 0.5 && /^territory-/.test(st.src), 'the briefing\'s landing site plays its loop', JSON.stringify(st));
          await jpg(page, 'video-territory-after', b);
          await film(page, 'video-territory', await box(page, '.cp-territory-pic', 6), 5000);
        } else {
          check(await page.locator('img.cp-territory-pic').count() === 1, 'before: the briefing shows the landing site\'s still');
          await jpg(page, 'video-territory-before', b);
        }
      }
      if (want('rooms')) {
        for (const r of ['orders', 'hobby']) {
          console.log(`rooms: ${r} (${tag})`);
          await page.locator(`[data-room="${r}"]`).click();
          await page.waitForTimeout(500);
          await closeIcom(page);
          const st = await playing(page, '#campaign > video.room-loop');
          if (alive) {
            check(st.video && st.playing && st.moved > 0.5 && st.src === `room-${r}.mp4`, `the ${r} room plays its own loop`, JSON.stringify(st));
            await page.addStyleTag({ content: '#campaign .cp-card, #campaign .cp-icom, #campaign .cp-yoke { visibility: hidden !important; }' });
            await page.mouse.move(VW - 5, VH - 5);
            await jpg(page, `video-room-${r}-after`);
            await film(page, `video-room-${r}`, null, 6000);
            await page.evaluate(() => [...document.querySelectorAll('style')].pop()?.remove());
          } else {
            // What it showed before Oct 1: the loop of the room it borrowed.
            const was = { orders: 'board', hobby: 'locker' }[r];
            await page.evaluate((was) => { const v = document.querySelector('#campaign > video.room-loop'); v.src = v.src.replace(/room-\w+\.mp4$/, `room-${was}.mp4`); void v.play(); }, was);
            await page.waitForTimeout(1500);
            await page.addStyleTag({ content: '#campaign .cp-card, #campaign .cp-icom, #campaign .cp-yoke { visibility: hidden !important; }' });
            await page.mouse.move(VW - 5, VH - 5);
            await jpg(page, `video-room-${r}-before`);
            await page.evaluate(() => [...document.querySelectorAll('style')].pop()?.remove());
          }
        }
      }
      if (want('partner')) {
        console.log(`partner (${tag})`);
        await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('broodfall-campaign')); s.said = [...new Set([...(s.said ?? []), 'mate-review'])]; localStorage.setItem('broodfall-campaign', JSON.stringify(s)); });
        await openShip(page, 'campaign=ship');
        await page.locator('[data-room="quarters"]').click();
        await page.waitForSelector('.cp-pad-pic', { timeout: 15000 });
        await closeIcom(page);
        const b = await box(page, '.cp-pad');
        if (alive) {
          const st = await playing(page, 'video.cp-pad-pic.alive');
          check(st.video && st.playing && st.moved > 0.5 && st.src === 'partner-partner.mp4', 'her file photograph on the pad is a living portrait', JSON.stringify(st));
          await jpg(page, 'video-partner-after', b);
          await film(page, 'video-partner', await box(page, '.cp-pad-pic', 40), 6000);
        } else {
          check(await page.locator('img.cp-pad-pic').count() === 1, 'before: her photograph is a still');
          await jpg(page, 'video-partner-before', b);
        }
      }
      if (want('genes')) {
        console.log(`genes (${tag})`);
        await page.locator('[data-room="genes"]').click();
        await page.waitForSelector('.cp-organ-pic', { timeout: 15000 });
        await page.waitForTimeout(800);
        const b = await box(page, '.cp-cols > div:nth-child(2)', 6);
        const st = await page.evaluate(async () => {
          const spans = [...document.querySelectorAll('span.cp-organ-pic.cp-organ-loop')];
          const pos = () => spans.map((s) => getComputedStyle(s).backgroundPosition).join('|');
          const a = pos();
          await new Promise((r) => setTimeout(r, 700));
          return { loops: spans.length, imgs: document.querySelectorAll('img.cp-organ-pic').length, moved: a !== pos() };
        });
        if (alive) {
          check(st.loops > 5 && st.moved, 'the Gene Bay\'s organ cards step through their scan loops', JSON.stringify(st));
          await jpg(page, 'video-genes-after', b);
          await film(page, 'video-genes', b, 5000);
        } else {
          check(st.imgs > 5 && st.loops === 0, 'before: the organ cards are stills', JSON.stringify(st));
          await jpg(page, 'video-genes-before', b);
        }
      }
      await context.close();
    }
  }

  if (want('debrief') || want('hand')) {
    for (const alive of [false, true]) {
      const tag = alive ? 'after' : 'before';
      for (const how of want('debrief') ? ['won', 'lost'] : ['won']) {
        const { context, page } = await freshPage(browser, alive);
        await page.goto(`${URL0}?seed=7&autostart=1&speed=0&biome=industrial`, { waitUntil: 'domcontentloaded', timeout: 300000 });
        await page.waitForFunction(() => window.broodfall?.view?.() === 'iso' && document.getElementById('boot').classList.contains('hidden'), null, { timeout: 240000 });
        await page.waitForTimeout(1500);
        if (how === 'won' && want('hand')) {
          console.log(`hand (${tag})`);
          const b = await box(page, '#hand', 8);
          const st = await page.evaluate(async () => {
            const els = [...document.querySelectorAll('#hand .card-art[data-limb]')];
            const pos = () => els.map((e) => e.style.backgroundPosition).join('|');
            const a = pos();
            await new Promise((r) => setTimeout(r, 900));
            return { cards: els.length, moved: a !== pos() };
          });
          check(alive ? st.cards > 0 && st.moved : !st.moved, alive ? 'the hand\'s limbs step through their idles' : 'before: the hand\'s limbs are stills', JSON.stringify(st));
          await jpg(page, `video-hand-${tag}`, b);
          if (alive) await film(page, 'video-hand', b, 5000);
        }
        if (want('debrief')) {
          console.log(`debrief ${how} (${tag})`);
          await page.evaluate((how) => { const s = window.broodfall.sim; s.outcome = how; s.events.push({ kind: how }); window.broodfall.step(1); }, how);
          await page.waitForSelector('#debrief:not(.hidden) .dbf-lead', { timeout: 20000 });
          await page.waitForTimeout(1200);
          const b = await box(page, '#debrief .dbf-lead', 4);
          if (alive) {
            const st = await playing(page, '#debrief video.dbf-lead-loop.alive');
            check(st.video && st.playing && st.moved > 0.5 && st.src === `debrief-${how}.mp4`, `the report's lead (${how}) plays its loop under the verdict`, JSON.stringify(st));
            await jpg(page, `video-debrief-${how}-after`, b);
            await film(page, `video-debrief-${how}`, b, 5000);
          } else {
            check(await page.locator('#debrief img.dbf-lead-loop').count() === 1, `before: the report's lead (${how}) is its still`);
            await jpg(page, `video-debrief-${how}-before`, b);
          }
        }
        await context.close();
      }
    }
    if (want('debrief')) {
      // Held (a counter-attack thrown back) through the module itself, in the dev server's page.
      const { context, page } = await freshPage(browser, true);
      await page.goto(`${URL0}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
      await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 240000 });
      await page.evaluate(async () => {
        const m = await import('/src/ui/debrief.ts');
        const el = await m.debriefPictures({ outcome: 'held', verdict: 'COUNTER-ATTACK REPELLED', caption: 'a test of the held lead', snapshot: null,
          stats: { families: [], killsByFamily: {}, kills: {} }, standing: {}, figures: [['WAVES', '5']] });
        el.style.cssText = 'position:fixed;left:200px;top:200px;width:1100px;z-index:99999;background:#111';
        document.body.append(el);
      });
      const st = await playing(page, 'video.dbf-lead-loop.alive');
      check(st.video && st.playing && st.moved > 0.5 && st.src === 'debrief-held.mp4', 'the report\'s lead (held) plays its loop', JSON.stringify(st));
      const b = await box(page, 'body > .dbf .dbf-lead', 4);
      await jpg(page, 'video-debrief-held-after', b);
      await film(page, 'video-debrief-held', b, 5000);
      await context.close();
    }
  }

  if (want('skyline')) {
    for (const alive of [false, true]) {
      const tag = alive ? 'after' : 'before';
      const { context, page } = await freshPage(browser, alive);
      await page.goto(`${URL0}?seed=7&autostart=1&speed=0&biome=industrial`, { waitUntil: 'domcontentloaded', timeout: 300000 });
      await page.waitForFunction(() => window.broodfall?.view?.() === 'iso' && document.getElementById('boot').classList.contains('hidden'), null, { timeout: 240000 });
      await page.waitForTimeout(1500);
      console.log(`skyline (${tag})`);
      await page.locator('#open-under').click();
      await page.waitForSelector('#under:not(.hidden) #under-surface.has-skyline', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const sb = await page.locator('#under-surface').boundingBox();
      const b = sb && { x: Math.max(0, sb.x - 10), y: Math.max(0, sb.y - 120), width: Math.min(VW - sb.x, sb.width + 20), height: sb.height + 160 };
      const st = await page.evaluate(() => ({ life: !!document.querySelector('#under-surface .skyline-life'), set: document.querySelector('#under-surface .skyline-life')?.dataset.set,
        beam: getComputedStyle(document.querySelector('#under-surface .sl-beam') ?? document.body).animationName }));
      check(st.life && st.beam === 'sl-sweep', 'the organ stage\'s skyline has its light, smoke and searchlight', JSON.stringify(st));
      if (!alive) {
        // Before: the skyline as it was (its life hidden).
        await page.addStyleTag({ content: '.skyline-life { display: none !important; }' });
        await jpg(page, 'video-skyline-before', b);
      } else {
        await jpg(page, 'video-skyline-after', b);
        await film(page, 'video-skyline', b, 9000);
      }
      await context.close();
    }
  }

  if (want('boss')) {
    console.log('boss: the transmission loops without a pop');
    const before = join(tmpdir(), 'broodfall-boss-before.mp4');
    const keep = join(root, 'art-src', 'stills-alive', 'boss-before.mp4');
    const src = existsSync(keep) ? keep : before;
    // The clip as it was and as it is, each three times round: the pop at each turn shows (or does not).
    for (const [file, name] of [[src, 'video-boss-before'], [join(root, 'public', 'art', 'intro', 'boss.mp4'), 'video-boss-after']]) {
      if (!existsSync(file)) { console.log(`  (no ${file})`); continue; }
      spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-stream_loop', '2', '-i', file, '-vf', 'scale=960:-2', '-an', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', join(notes, `${name}.mp4`)]);
      console.log(`  video ${join(notes, `${name}.mp4`)}`);
    }
    const { context, page } = await freshPage(browser, true);
    await page.goto(`${URL0}?campaign=ship&open=1`, { waitUntil: 'domcontentloaded', timeout: 300000 });
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 240000 });
    await page.evaluate(async () => {
      const [{ playBossCall }, { loadIntroArt }] = await Promise.all([import('/src/ui/bossCall.ts'), import('/src/ui/intro.ts')]);
      void playBossCall(await loadIntroArt());
    });
    const st = await playing(page, '#boss-call video');
    check(st.video && st.playing && st.moved > 0.5, 'the boss\'s transmission plays its loop', JSON.stringify(st));
    await page.waitForTimeout(500);
    await jpg(page, 'video-boss-after', await box(page, '#boss-call .bc-screen', 4));
    await film(page, 'video-boss-ingame', await box(page, '#boss-call .bc-screen', 4), 9000);
    await context.close();
  }

  if (want('reduce')) {
    console.log('reduce: Settings > Reduce motion: the stills');
    const { context, page } = await freshPage(browser, true);
    await context.addInitScript(() => { const k = 'broodfall-settings'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.reduceMotion = true; localStorage.setItem(k, JSON.stringify(s)); });
    await openShip(page);
    await page.locator('[data-room="desk"]').click();
    await page.waitForTimeout(400);
    await page.locator('.globe .site.open:not(.behind)').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.locator('[data-room="genes"]').click();
    await page.waitForTimeout(800);
    const st = await page.evaluate(() => ({ videos: document.querySelectorAll('video.alive').length, loops: document.querySelectorAll('.cp-organ-loop').length, stills: document.querySelectorAll('img.cp-organ-pic').length }));
    check(st.videos === 0 && st.loops === 0 && st.stills > 5, 'with Reduce motion nothing comes alive: the stills', JSON.stringify(st));
    await context.close();
  }
} finally {
  await browser.close();
  try { dev.kill(); } catch {}
  freePort();
}
console.log(failures.length ? `\nFAILED: ${failures.length}: ${failures.join(' | ')}` : '\nall shot-alive checks pass');
process.exit(failures.length ? 1 : 0);
