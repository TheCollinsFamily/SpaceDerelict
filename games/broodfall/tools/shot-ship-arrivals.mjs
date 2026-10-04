/**
 * HE WALKS INTO THE ROOM (Collins, Oct 4 2026: "transitions between different parts of the ship (e.g. ship menus)"),
 * proven in the real game on its own DEV server (what `npm start` runs), through the player's own clicks:
 *
 *   tour     every room with him in it: a click on its button shows the room EMPTY at once, its arrival clip plays
 *            over the held loop, the room's screen is up and answers a click WHILE he walks, and when he is in his
 *            place the clip is gone and the loop runs (three stills a room, and one film of the whole tour)
 *   switch   a change of mind mid-walk: the other room's arrival takes over, nothing is left behind
 *   none     the Quarters (seen empty from its doorway) and the room he is already in: no arrival
 *   calm     Settings > Reduce motion: no arrival and no loop, the room's still
 *   report   back from a deployment's report: he is at the desk already (the pad's film left him there), no arrival
 *   aboard   the ship opened from the main menu: he walks into the room it opens in
 *   takes    a room visited again and again: its two takes play in turn (one walk is not seen on every visit)
 *   break    a player trying to break it: fourteen rooms clicked in under two seconds, Settings opened and closed
 *            mid-walk, the window made narrow and wide mid-walk: one clip at most, never a second copy of him, no error
 *
 *   node tools/shot-ship-arrivals.mjs [tour switch none calm report aboard takes break]   (dev server on BROODFALL_PORT, default 5431)
 * Stills and film: notes/screens/2026-10-04/arrivals/.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const notes = join(root, 'notes', 'screens', '2026-10-04', 'arrivals');
const vids = join(tmpdir(), 'broodfall-arrivals-video');
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5431);
const URL0 = `http://localhost:${PORT}/`;
const VW = 1600, VH = 900;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => !only.length || only.includes(k);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const loops = JSON.parse(readFileSync(join(root, 'public', 'art', 'ship', 'loops', 'loops.json'), 'utf8')).rooms;
const HIS = Object.keys(loops).filter((k) => loops[k].arrive);
/** One of a room's arrival takes (arrive-<room>.mp4, arrive-<room>-2.mp4). */
const isTakeOf = (file, room) => new RegExp(`^arrive-${room}(-\\d+)?\\.mp4$`).test(file ?? '');
/** His steps asked for so far, and how many of them sounded (window.__bfAudio.log: every cue asked, played or why not). */
const steps = (page) => page.evaluate(() => {
  const all = (window.__bfAudio?.log ?? []).filter((e) => e.kind === 'sfx' && e.id === 'ship-step');
  return { asked: all.length, played: all.filter((e) => e.played).length, why: [...new Set(all.filter((e) => !e.played).map((e) => e.why))].join(',') };
});

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

const errors = [];
async function freshPage(browser, { video = false, settings, extra } = {}) {
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, ...(video ? { recordVideo: { dir: vids, size: { width: VW, height: VH } } } : {}) });
  await context.addInitScript(([s, x]) => {
    if (sessionStorage.getItem('arrive-beat-set')) return;
    sessionStorage.setItem('arrive-beat-set', '1');
    localStorage.clear();
    localStorage.setItem('broodfall-intro-seen', '1');
    localStorage.setItem('broodfall-arrivals', 'on'); // under automation he walks in only when asked
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    if (s) localStorage.setItem('broodfall-settings', JSON.stringify(s));
    for (const [k, v] of Object.entries(x ?? {})) localStorage.setItem(k, v);
  }, [settings ?? null, extra ?? null]);
  const page = await context.newPage();
  page.on('pageerror', (e) => { errors.push(String(e).slice(0, 200)); console.log('  pageerror:', String(e).slice(0, 200)); });
  return { context, page };
}

/** What is behind the screen right now. */
const backdrop = (page) => page.evaluate(() => {
  const el = document.getElementById('campaign');
  const vs = [...el.querySelectorAll('video.room-loop')];
  const a = vs.find((v) => v.classList.contains('room-arrive'));
  const l = vs.find((v) => !v.classList.contains('room-arrive'));
  const file = (u) => (u || '').split('/').pop().split('?')[0];
  return {
    room: el.dataset.in,
    poster: file((el.style.getPropertyValue('--room').match(/url\("?([^")]+)/) || [])[1]),
    // The file each element was GIVEN (the game sets it in the same task as the click); `currentSrc` trails it on a busy machine.
    arrive: a ? { file: file(a.dataset.src || a.currentSrc || a.src), on: a.classList.contains('on'), t: a.currentTime, paused: a.paused, live: !!a.dataset.src } : null,
    loop: l ? { file: file(l.dataset.src || l.currentSrc || l.src), on: l.classList.contains('on'), t: l.currentTime, paused: l.paused } : null,
    count: vs.length,
    tabOn: el.querySelector('.cp-room.on')?.dataset.room ?? null,
  };
});
const shot = async (page, name) => {
  const png = join(tmpdir(), `bf-arrive-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(notes, `${name}.jpg`)]);
};
async function openShip(page) {
  await page.goto(`${URL0}?campaign=ship&open=1`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 120000 });
  await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 60000 });
  // Her greeting's intercom covers the lower left of the room: closed, so the room is seen (she stays aboard).
  await page.locator('[data-act="icom-close"]').click({ timeout: 4000 }).catch(() => {});
  // The room it opened in has settled (its own arrival, if it had one, is over).
  await page.waitForFunction(() => !document.querySelector('#campaign video.room-arrive'), null, { timeout: 15000 }).catch(() => {});
}
/** Click a room's button and say how long the screen took to be that room's. */
async function go(page, room) {
  const t0 = Date.now();
  await page.locator(`[data-room="${room}"]`).click();
  await page.waitForFunction((r) => document.getElementById('campaign').dataset.in === r, room, { timeout: 5000 });
  return Date.now() - t0;
}
/**
 * The hand-over, watched: the left of the room (where he is, clear of the screen's card) photographed from the clip's
 * last moments until the loop has run a while.
 *   `across`: the picture just BEFORE the hand-over (he is in his place, the clip on its last frames) against the one
 *             just AFTER it (the clip gone, the loop running), as a mean change per pixel (0-255). This is the join
 *             itself, and it does not depend on how fast the machine takes pictures.
 *   `worst`:  the largest change between two pictures in a row on the way: a flash (a black frame, the room without
 *             him, another room) would stand far above his slow settling, however few pictures there were.
 */
async function handover(page, room) {
  const left = { x: 0, y: 0, width: 360, height: VH };
  const change = (x, y) => {
    const a = x.data, b = y.data;
    let d = 0;
    for (let k = 0; k < a.length; k += 4) d += Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]);
    return d / (a.length / 4) / 3;
  };
  await page.waitForFunction((end) => { const a = document.querySelector('#campaign video.room-arrive'); return !a || a.currentTime > end - 0.3; }, loops[room].arrive.seconds, { timeout: 12000 }).catch(() => {});
  const shots = [PNG.sync.read(await page.screenshot({ clip: left }))];
  const before = shots[0];
  const t0 = Date.now();
  let over = false;
  // Until the loop has taken over and run for half a second (or five seconds have gone).
  while (Date.now() - t0 < 5000) {
    shots.push(PNG.sync.read(await page.screenshot({ clip: left })));
    const st = await page.evaluate(() => {
      const el = document.getElementById('campaign');
      const l = [...el.querySelectorAll('video.room-loop')].find((v) => !v.classList.contains('room-arrive'));
      return { gone: !el.querySelector('video.room-arrive'), t: l ? l.currentTime : 0 };
    });
    if (st.gone && st.t > 0.5) { over = true; break; }
  }
  const after = PNG.sync.read(await page.screenshot({ clip: left }));
  let worst = 0;
  for (let k = 1; k < shots.length; k++) worst = Math.max(worst, change(shots[k - 1], shots[k]));
  return { over, across: change(before, after), worst, shots: shots.length + 1 };
}

const arrived = (page, room) => page.waitForFunction((r) => {
  const el = document.getElementById('campaign');
  const l = [...el.querySelectorAll('video.room-loop')].find((v) => !v.classList.contains('room-arrive'));
  return el.dataset.in === r && !el.querySelector('video.room-arrive') && l && l.classList.contains('on') && !l.paused;
}, room, { timeout: 15000 }).then(() => true).catch(() => false);

const dev = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (want('tour')) {
    console.log('tour: a click on each room, he walks in, the screen answers meanwhile, the loop takes over');
    const { context, page } = await freshPage(browser, { video: true });
    await openShip(page);
    // Start from the Quarters, so the first room of the tour is walked into as well.
    await go(page, 'quarters');
    await page.waitForTimeout(800);
    for (const room of HIS) {
      const s0 = await steps(page);
      const ms = await go(page, room);
      const b0 = await backdrop(page);
      check(ms < 400 && b0.tabOn === room, `${room}: the screen is this room's at once`, `${ms} ms`);
      check(b0.poster === `arrive-${room}.webp`, `${room}: the room is shown empty under it`, b0.poster);
      check(!!b0.arrive && isTakeOf(b0.arrive.file, room), `${room}: its arrival clip is on`, b0.arrive?.file ?? 'none');
      check(!!b0.loop && b0.loop.file === `room-${room}.mp4` && b0.loop.paused && !b0.loop.on && b0.loop.t < 0.05, `${room}: its loop waits unseen on its first frame`, b0.loop ? `t=${b0.loop.t.toFixed(2)} paused=${b0.loop.paused} on=${b0.loop.on}` : 'no loop');
      await page.waitForTimeout(350);
      await shot(page, `${room}-1-empty`);
      await page.waitForFunction(() => { const a = document.querySelector('#campaign video.room-arrive'); return a && a.currentTime > 1.2; }, null, { timeout: 8000 }).catch(() => {});
      const b1 = await backdrop(page);
      check(!!b1.arrive && b1.arrive.on && !b1.arrive.paused && b1.arrive.t > 1, `${room}: he is walking in`, b1.arrive ? `t=${b1.arrive.t.toFixed(2)}` : 'no clip');
      const s1 = await steps(page);
      check(s1.asked - s0.asked === 4 && s1.played - s0.played === 4, `${room}: his four steps are heard, once`, `${s1.asked - s0.asked} asked, ${s1.played - s0.played} sounded${s1.why ? ` (${s1.why})` : ''}`);
      await shot(page, `${room}-2-walking`);
      // The screen answers while he walks: YOKE is called up (the screen is drawn again) and the walk goes on, not over.
      if (room !== 'ai') {
        await page.locator('[data-act="yoke-call"]').click();
        // Read at once: on a busy machine her intercom can take longer to come up than the rest of his walk.
        const b2 = await backdrop(page);
        const up = await page.waitForSelector('.cp-icom', { timeout: 5000 }).then(() => true).catch(() => false);
        // The walk went on (the same clip, further along), or he was in his place by the time the click landed.
        const went = b2.arrive ? b2.arrive.file === b1.arrive.file && b2.arrive.t >= b1.arrive.t && !b2.arrive.paused : !!b2.loop?.on && !b2.loop.paused;
        check(up && went, `${room}: the screen answers a click while he walks, and the walk goes on`, b2.arrive ? `t=${b2.arrive.t.toFixed(2)}` : (went ? 'he was in his place by the time the click landed' : 'the clip was lost'));
        await page.locator('[data-act="icom-close"]').click({ timeout: 3000 }).catch(() => {});
      }
      const h = await handover(page, room);
      // What moves by itself in the room (the culture in its tank, the displays, his settling) measures up to about 5
      // across the hand-over on a busy machine; a real jump (the room without him, a black frame, another room) is
      // 15 and up in this strip, which he fills.
      check(h.over && h.across < 9 && h.worst < 6, `${room}: nothing jumps as the loop takes over`, `before against after ${h.across.toFixed(2)} of 255; largest change between two pictures in a row ${h.worst.toFixed(2)}, over ${h.shots} pictures`);
      const ok = await arrived(page, room);
      const b3 = await backdrop(page);
      check(ok && b3.poster === `room-${room}.webp` && b3.count === 1, `${room}: he is in his place, the clip is gone, the loop runs`, `poster ${b3.poster}, ${b3.count} video(s)`);
      await page.waitForTimeout(500);
      const b4 = await backdrop(page);
      check(!!b4.loop && b4.loop.t > b3.loop.t, `${room}: the loop is advancing`, `${b3.loop?.t.toFixed(2)} -> ${b4.loop?.t.toFixed(2)}`);
      await shot(page, `${room}-3-in-place`);
    }
    const vpath = await page.video().path();
    await context.close();
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-vf', 'scale=1280:720', '-movflags', '+faststart', join(notes, 'tour.mp4')]);
  }

  if (want('switch')) {
    console.log('switch: a change of mind mid-walk');
    const { context, page } = await freshPage(browser);
    await openShip(page);
    await go(page, 'comms');
    await page.waitForTimeout(900);
    await go(page, 'ai');
    const b = await backdrop(page);
    check(isTakeOf(b.arrive?.file, 'ai') && b.poster === 'arrive-ai.webp' && b.count === 2, 'the other room\'s arrival took over', `${b.arrive?.file}, poster ${b.poster}, ${b.count} videos`);
    await page.waitForTimeout(500);
    await go(page, 'quarters');
    await page.waitForTimeout(1300);
    const q = await backdrop(page);
    check(!q.arrive && q.loop?.file === 'room-quarters.mp4' && q.loop.on, 'on to a room with no arrival: the walk is dropped, its loop plays', `${q.count} video(s), ${q.loop?.file}`);
    await go(page, 'genes');
    const ok = await arrived(page, 'genes');
    check(ok, 'and the next room is walked into as usual');
    await context.close();
  }

  if (want('none')) {
    console.log('none: the Quarters, and the room he is already in');
    const { context, page } = await freshPage(browser);
    await openShip(page);
    await go(page, 'quarters');
    const q = await backdrop(page);
    check(!q.arrive && q.poster === 'room-quarters.webp', 'the Quarters: no arrival', q.poster);
    await go(page, 'genes');
    await arrived(page, 'genes');
    await page.locator('[data-room="genes"]').click();
    await page.waitForTimeout(400);
    const g = await backdrop(page);
    check(!g.arrive && g.loop?.on && !g.loop.paused, 'a click on the room he is in: he does not walk in again', `${g.count} video(s)`);
    await context.close();
  }

  if (want('calm')) {
    console.log('calm: Settings > Reduce motion');
    const { context, page } = await freshPage(browser, { settings: { reduceMotion: true } });
    await openShip(page);
    await go(page, 'genes');
    await page.waitForTimeout(600);
    const b = await backdrop(page);
    check(b.count === 0 && b.poster === 'room-genes.webp', 'no arrival and no loop: the room\'s still', `${b.count} video(s), ${b.poster}`);
    check(await page.evaluate(() => !document.querySelector('.cp-body.walk-in')), 'the room\'s words do not fade in either');
    await context.close();
  }

  if (want('report')) {
    console.log('report: back from a deployment\'s report, he is at the desk already');
    const { context, page } = await freshPage(browser, { extra: { 'broodfall-pad-outro': 'on' } });
    await openShip(page);
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
    const r = await backdrop(page);
    check(!r.arrive && r.room === 'desk', 'the report is at the desk with no arrival (the film walked him there)', `${r.count} video(s)`);
    await page.getByText('RETURN TO THE SHIP').click();
    await page.waitForSelector('#campaign:not(.hidden) .cp-rooms', { timeout: 10000 });
    await page.waitForTimeout(500);
    const d = await backdrop(page);
    check(!d.arrive && d.room === 'desk' && d.poster === 'room-desk.webp', 'RETURN TO THE SHIP: he is at the desk, he does not walk in again', `poster ${d.poster}, ${d.count} video(s)`);
    await context.close();
  }

  if (want('aboard')) {
    console.log('aboard: the ship opened from the main menu');
    const { context, page } = await freshPage(browser);
    await openShip(page);
    // A campaign now exists: the page is opened again at the menu and the campaign is continued by the player's click.
    await page.goto(URL0, { waitUntil: 'load', timeout: 300000 });
    const btn = page.locator('#menu-continue, #menu-campaign, #menu-new').first();
    await btn.waitFor({ timeout: 60000 });
    await btn.click();
    await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 120000 });
    const seen = await page.waitForFunction(() => {
      const a = document.querySelector('#campaign video.room-arrive');
      return a && a.classList.contains('on') && a.currentTime > 0.3;
    }, null, { timeout: 20000 }).then(() => true).catch(() => false);
    const b = await backdrop(page);
    check(seen && isTakeOf(b.arrive?.file, b.room), 'he walks into the room the ship opens in', `${b.room}: ${b.arrive?.file ?? 'no clip'}`);
    await shot(page, 'aboard-walking-in');
    await context.close();
  }
  if (want('takes')) {
    console.log('takes: a room visited again and again');
    const { context, page } = await freshPage(browser);
    await openShip(page);
    await go(page, 'quarters');
    const seen = [];
    for (let visit = 0; visit < 3; visit++) {
      await go(page, 'genes');
      seen.push((await backdrop(page)).arrive?.file ?? 'none');
      await arrived(page, 'genes');
      await go(page, 'quarters');
      await page.waitForTimeout(300);
    }
    const all = (loops.genes.arrive.takes ?? []).map((t) => t.video.split('/').pop());
    check(all.length >= 2 && seen[0] !== seen[1] && seen[0] === seen[2] && seen.every((f) => all.includes(f)), 'three visits to the Gene Bay: its takes in turn', seen.join(', '));
    await context.close();
  }

  if (want('break')) {
    console.log('break: a player trying to break it');
    const { context, page } = await freshPage(browser);
    await openShip(page);
    const order = ['genes', 'comms', 'ai', 'desk', 'locker', 'board', 'orders', 'hobby', 'quarters', 'genes', 'ai', 'comms', 'desk', 'hobby'];
    const t0 = Date.now();
    for (const r of order) { await page.locator(`[data-room="${r}"]`).click(); await page.waitForTimeout(60); }
    const spam = Date.now() - t0;
    const mid = await backdrop(page);
    check(mid.count <= 2 && mid.room === 'hobby' && isTakeOf(mid.arrive?.file, 'hobby'), `fourteen rooms in ${spam} ms: only the last room's walk is on`, `${mid.count} video(s), ${mid.arrive?.file}`);
    const ok = await arrived(page, 'hobby');
    const end = await backdrop(page);
    check(ok && end.count === 1 && end.poster === 'room-hobby.webp', 'and it ends with him in his place, one loop running', `${end.count} video(s), ${end.poster}`);
    // Settings opened and closed while he walks.
    await go(page, 'genes');
    await page.waitForTimeout(700);
    await page.locator('[data-act="settings"]').click();
    await page.waitForTimeout(900);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Whatever Settings did with the screen, the room must come to rest with him in it and nothing left over.
    if (await page.evaluate(() => document.getElementById('campaign').classList.contains('hidden'))) await page.keyboard.press('Escape');
    const back = await page.waitForFunction(() => {
      const el = document.getElementById('campaign');
      if (el.classList.contains('hidden')) return false;
      const l = [...el.querySelectorAll('video.room-loop')].find((v) => !v.classList.contains('room-arrive'));
      return !el.querySelector('video.room-arrive') && l && l.classList.contains('on') && !l.paused;
    }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    const st = await backdrop(page);
    check(back && st.count === 1 && st.poster === 'room-genes.webp', 'Settings opened and closed mid-walk: the room comes to rest, nothing left over', `${st.count} video(s), ${st.poster}, hidden=${await page.evaluate(() => document.getElementById('campaign').classList.contains('hidden'))}`);
    // The window made narrow and wide while he walks.
    await go(page, 'comms');
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.waitForTimeout(500);
    await shot(page, 'break-narrow-mid-walk');
    await page.setViewportSize({ width: VW, height: VH });
    const ok2 = await arrived(page, 'comms');
    const st2 = await backdrop(page);
    check(ok2 && st2.count === 1, 'the window resized mid-walk: he still arrives, one loop running', `${st2.count} video(s)`);
    await context.close();
  }
  check(errors.length === 0, 'no page error in any beat', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  dev.kill();
  freePort();
  try { for (const f of readdirSync(vids)) rmSync(join(vids, f)); } catch {}
}
console.log(failures.length ? `${failures.length} FAILED: ${failures.join('; ')}` : 'all passed');
process.exit(failures.length ? 1 : 0);
