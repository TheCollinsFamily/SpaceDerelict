/**
 * THE INTERFACE FIX PASS (Sep 30 2026): the surfaces the pass touched, seen through the player's
 * path on the DEV server (what `npm start` runs), with the GPU on. Run once before the change and
 * once after it, with a label: the pictures are notes/screens/2026-09-30/fixpass-ui-<label>-*.jpg.
 *
 *   m1        a brand-new player: the film skipped, mission 1's first screen and its first hand
 *   free      a skirmish; a Reliquary grown (it comes as a pair): the free second card in the hand
 *   organ     the same run into its organ stage, then its district draft
 *   report    the skirmish report, won and lost
 *   ship      NEW CAMPAIGN → mission 1 won → its report → the ship; every room at 1280, 1600 and
 *             1920 wide (the room bar measured: one line or two); the ship's pick deployed, won,
 *             the campaign report; the three callers' cards; the ship's settings
 *
 * rfab.ai is never reached (YOKE scripted, her routes answered 404): nothing is spent.
 *
 *   node tools/shot-fixpass-ui.mjs <label> [beat ...]
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5199) - 61;
const URL0 = `http://localhost:${PORT}/`;
const [label = 'now', ...beats] = process.argv.slice(2);
const on = (b) => !beats.length || beats.includes(b);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const file = (name) => join(out, `fixpass-ui-${label}-${name}.jpg`);
const shot = (page, name, opts = {}) => page.screenshot({ path: file(name), type: 'jpeg', quality: 84, ...opts });
const shotEl = (page, sel, name) => page.locator(sel).first().screenshot({ path: file(name), type: 'jpeg', quality: 90 });

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'];
const server = await startDev();
const browser = await chromium.launch({ args: GPU });

/** A fresh browser: nothing stored but what the beat says; YOKE scripted; rfab.ai never reached. */
async function fresh({ newcomer = false, viewport = { width: 1600, height: 1000 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const rfab = [];
  await ctx.route('**/rfab-api/**', (r) => { rfab.push(r.request().url()); return r.fulfill({ status: 404, body: '{}' }); });
  await ctx.route('https://api.rfab.ai/**', (r) => { rfab.push(r.request().url()); return r.fulfill({ status: 404, body: '{}' }); });
  page.rfabCalls = rfab;
  await ctx.addInitScript((newcomer) => {
    if (sessionStorage.getItem('bf-fix-init')) return;
    sessionStorage.setItem('bf-fix-init', '1');
    for (const k of ['broodfall-campaign', 'broodfall-campaign-pending', 'broodfall-meta', 'broodfall-intro-seen']) localStorage.removeItem(k);
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    if (!newcomer) localStorage.setItem('broodfall-intro-seen', '1');
  }, newcomer);
  return { ctx, page, errors };
}
const booted = (page) => page.waitForFunction(() => window.broodfall && window.__bfBooted && document.getElementById('boot').classList.contains('hidden'), null, { timeout: 90000 });
const noBanner = async (page, where) => {
  const t = await page.evaluate(() => { const el = document.getElementById('art-notice'); return el && !el.classList.contains('hidden') ? `${el.textContent} [${el.title}]` : ''; });
  check(!t, `${where}: no "did not load" banner`, t);
};
const endRun = (page, how) => page.evaluate((how) => {
  const s = window.broodfall.sim;
  if (how === 'won') { s.stats.kills.militia = 999; s.stats.limbsGrown = 20; s.stats.healed = 5000; s.stats.evolutions = 9; }
  s.outcome = how;
  s.events.push({ kind: how });
  window.broodfall.step(1);
}, how);
/** Build a few limbs through the sim and play the wave out (the path to the organ stage). */
const playWave = (page) => page.evaluate(() => {
  const b = window.broodfall; const s = b.sim;
  s.meat.war = Math.max(s.meat.war, 300);
  const cells = b.buildableCells(60);
  let built = 0;
  for (let g = 0; g < 40 && built < 4; g++) {
    const i = s.hand.findIndex((h) => ['spitter', 'lasher', 'burster', 'maw'].includes(h.family));
    if (i < 0) { s.issue({ kind: 'discard', cardIndex: 0 }); continue; }
    const cell = cells.find((c) => s.canBuildTower(c, s.hand[i].family));
    if (cell === undefined) break;
    if (s.issue({ kind: 'build', cardIndex: i, cell }).ok) built++; else s.issue({ kind: 'discard', cardIndex: i });
  }
  s.issue({ kind: 'call-early' });
  const w0 = s.wavesCleared;
  for (let k = 0; k < 8000 && s.wavesCleared === w0 && s.outcome === 'playing'; k++) b.step(1);
  return { phase: s.phase, waves: s.wavesCleared };
});

try {
  // ------------------------------------------------------------ mission 1, a brand-new player
  if (on('m1')) {
    const { ctx, page, errors } = await fresh({ newcomer: true });
    await page.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector('#intro', { timeout: 15000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await booted(page);
    await page.waitForTimeout(1500);
    await noBanner(page, 'mission 1');
    const m1 = await page.evaluate(() => ({ dir: window.broodfall.sim.cfg.directive, hand: window.broodfall.sim.hand.map((c) => c.family) }));
    console.log(`  NOTE  mission 1's first hand: ${m1.hand.join(', ')}`);
    await shot(page, 'm1-first-screen');
    await shotEl(page, '#botbar', 'm1-first-hand');
    await shotEl(page, '#topbar', 'm1-topbar');
    check(errors.length === 0, 'mission 1: nothing logged as an error', errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ mission 1 played: each part of the HUD arrives when it matters
  if (on('m1play')) {
    const { ctx, page, errors } = await fresh({ newcomer: true });
    await page.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector('#intro', { timeout: 15000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await booted(page);
    await page.waitForTimeout(1200);
    const shown = () => page.evaluate(() => ['#meat-science', '#meat-royal', '#dials', '#open-under', '#creep-nodes', '#plinths', '#royal-surge', '#pending-traits']
      .filter((q) => { const el = document.querySelector(q); return el && getComputedStyle(el).display !== 'none'; }));
    check((await shown()).length === 0, 'mission 1 opens with only war meat, the directive, the wave, the hand', (await shown()).join(','));
    // The first limb by real clicks: a card, then a dark red block.
    await page.locator('#hand .card').first().click();
    const box = await page.locator('#stage canvas').boundingBox();
    const q = await page.evaluate(() => {
      const b = window.broodfall; const s = b.sim; const fam = s.hand[0].family;
      const cell = b.buildableCells(300).filter((c) => s.canBuildTower(c, fam))[5];
      const p = s.cellCenter(cell); return b.worldToScreen(p.x, p.y);
    });
    await page.mouse.click(box.x + (q.x / q.vw) * box.width, box.y + (q.y / q.vh) * box.height);
    await page.waitForTimeout(400);
    check(await page.evaluate(() => window.broodfall.sim.towers.length === 1), 'the first limb grown by a click');
    // Wave 1, played out.
    await page.evaluate(() => { const s = window.broodfall.sim; s.issue({ kind: 'call-early' }); });
    await page.evaluate(() => { const b = window.broodfall; const s = b.sim; for (let k = 0; k < 12000 && s.wavesCleared < 1 && s.outcome === 'playing'; k++) b.step(1); });
    await page.waitForTimeout(1500);
    const after1 = await shown();
    console.log(`  NOTE  after wave 1: ${after1.join(', ')}`);
    check(after1.includes('#open-under') && after1.includes('#dials'), 'after the first wave: the ORGANS button and the dials arrive (the organ stage opens then)');
    await shot(page, 'm1-after-wave1');
    await page.evaluate(() => { const u = document.getElementById('under-done'); if (u && !document.getElementById('under').classList.contains('hidden')) u.click(); });
    await page.waitForTimeout(1800);
    await shot(page, 'm1-after-wave1-board');
    await shotEl(page, '#botbar', 'm1-after-wave1-botbar');
    check(errors.length === 0, 'mission 1 played: nothing logged as an error', errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ the free card, the organ stage, the draft
  if (on('free') || on('organ')) {
    const { ctx, page, errors } = await fresh();
    await page.goto(`${URL0}?seed=7`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 90000 });
    await page.locator('#menu-deploy').click();
    await booted(page);
    await page.waitForTimeout(1200);
    await noBanner(page, 'a skirmish');
    if (on('free')) {
      // A Reliquary comes as a pair: one pick, two placements. Grow the first: the second card is free.
      const r = await page.evaluate(() => {
        const b = window.broodfall; const s = b.sim;
        s.meat.science = Math.max(s.meat.science, 100);
        s.hand[0] = { id: 90001, family: 'reliquary' };
        const cell = b.buildableCells(200).find((c) => s.canBuildTower(c, 'reliquary'));
        const res = s.issue({ kind: 'build', cardIndex: 0, cell });
        return { ok: res.ok, err: res.err, free: s.hand.filter((c) => c.free).map((c) => c.family) };
      });
      check(r.ok && r.free.includes('reliquary'), 'a Reliquary grown: its pair waits in the hand, free', JSON.stringify(r));
      await page.waitForTimeout(500);
      await shot(page, 'free-card');
      await shotEl(page, '#hand', 'free-card-hand');
      // A limb picked up and held over the board: the reach readout by the pointer.
      const k = await page.evaluate(() => window.broodfall.sim.hand.findIndex((c) => ['spitter', 'quill', 'skipper', 'lasher'].includes(c.family) && !c.free));
      if (k >= 0) {
        await page.locator('#hand .card').nth(k).click();
        const box = await page.locator('#stage canvas').boundingBox();
        const q = await page.evaluate((fam) => {
          const b = window.broodfall; const s = b.sim;
          const cell = b.buildableCells(300).filter((c) => s.canBuildTower(c, fam))[20];
          const p = s.cellCenter(cell); return b.worldToScreen(p.x, p.y);
        }, await page.evaluate((k) => window.broodfall.sim.hand[k].family, k));
        const x = box.x + (q.x / q.vw) * box.width, y = box.y + (q.y / q.vh) * box.height;
        await page.mouse.move(x - 30, y - 30);
        await page.mouse.move(x, y, { steps: 4 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: file('reach-tip'), type: 'jpeg', quality: 90, clip: { x: Math.max(0, x - 260), y: Math.max(0, y - 160), width: 620, height: 300 } });
        await page.keyboard.press('Escape');
      }
    }
    if (on('organ')) {
      const w = await playWave(page);
      await page.waitForTimeout(800);
      // The loop opens the organ stage when it sees the wave end; stepped from a script it may not: the ORGANS button, as a player would.
      if (await page.evaluate(() => document.getElementById('under').classList.contains('hidden'))) await page.locator('#open-under').click();
      await page.waitForTimeout(600);
      const up = await page.evaluate(() => !document.getElementById('under').classList.contains('hidden'));
      check(up, 'the wave played out: the organ stage is up', JSON.stringify(w));
      await shot(page, 'organ-stage');
      await page.locator('#under-done').click().catch(() => {});
      // On to the district draft.
      for (let i = 0; i < 6 && !(await page.evaluate(() => window.broodfall.sim.phase === 'draft')); i++) {
        await playWave(page);
        await page.waitForTimeout(300);
        await page.evaluate(() => { const u = document.getElementById('under-done'); if (u && !document.getElementById('under').classList.contains('hidden')) u.click(); });
      }
      await page.waitForSelector('#draft:not(.hidden) .draft-option', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      if (await page.locator('#draft:not(.hidden)').count()) await shot(page, 'draft');
      else console.log('  NOTE  no district draft reached');
    }
    check(errors.length === 0, 'the skirmish: nothing logged as an error', errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ the skirmish report
  if (on('report')) {
    for (const how of ['won', 'lost']) {
      const { ctx, page, errors } = await fresh();
      await page.goto(`${URL0}?seed=${how === 'won' ? 11 : 7}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 90000 });
      await page.locator('#menu-deploy').click();
      await booted(page);
      await playWave(page);
      await page.evaluate(() => { const u = document.getElementById('under-done'); if (u && !document.getElementById('under').classList.contains('hidden')) u.click(); });
      await endRun(page, how);
      await page.waitForSelector('#debrief:not(.hidden) .debrief-card.pictured', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1200);
      await shot(page, `report-skirmish-${how}`);
      if (how === 'won') {
        // RETURN TO SHIP: the skirmish's splice screen.
        await page.locator('#debrief-ship').click();
        await page.waitForSelector('#ship:not(.hidden)', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(500);
        // The "before" of this screen is taken after the fact: the fix pass's console rules for it lifted in the page.
        if (label === 'before') await page.evaluate(() => {
          for (const sheet of document.styleSheets) {
            let rules; try { rules = sheet.cssRules; } catch { continue; }
            for (let i = rules.length - 1; i >= 0; i--) if (/\[data-hud="ship"\] #ship /.test(rules[i].selectorText ?? '')) sheet.deleteRule(i);
          }
        });
        await shot(page, 'skirmish-splice');
      }
      check(errors.length === 0, `the skirmish report (${how}): nothing logged as an error`, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
  }

  // ------------------------------------------------------------ the ship, its rooms, the campaign report, the callers
  if (on('ship')) {
    const { ctx, page, errors } = await fresh();
    await page.goto(`${URL0}?seed=3`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 90000 });
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('#menu-new').click()]);
    await booted(page);
    await page.waitForTimeout(600);
    await endRun(page, 'won');
    await page.waitForSelector('#debrief:not(.hidden)', { timeout: 45000 });
    await page.waitForTimeout(1500);
    await shot(page, 'report-mission1-won');
    await page.locator('#debrief-ship').click();
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
    await page.waitForTimeout(600);
    await page.locator('.cp-icom [data-act="icom-close"]').click().catch(() => {});
    const rooms = async (tag) => {
      const ids = await page.evaluate(() => [...document.querySelectorAll('.cp-rooms .cp-room[data-room]')].map((b) => b.dataset.room));
      for (const w of [1280, 1600, 1920]) {
        await page.setViewportSize({ width: w, height: w === 1280 ? 800 : w === 1600 ? 1000 : 1080 });
        await page.waitForTimeout(300);
        const bar = await page.evaluate(() => {
          const bs = [...document.querySelectorAll('.cp-rooms .cp-room')];
          const tops = new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)));
          const clipped = bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent);
          // Nothing may stand past the right edge of the screen it sits on.
          const card = document.querySelector('#campaign .cp-card').getBoundingClientRect();
          const out = bs.filter((b) => b.getBoundingClientRect().right > card.right - 1).map((b) => b.textContent);
          return { lines: tops.size, n: bs.length, clipped: [...clipped, ...out] };
        });
        check(bar.lines === 1 && !bar.clipped.length, `${tag} at ${w} px: the room bar (${bar.n} buttons) is one line, nothing clipped`, JSON.stringify(bar));
        await shotEl(page, '.cp-rooms', `ship-${tag}-roombar-${w}`);
      }
      await page.setViewportSize({ width: 1600, height: 1000 });
      // Every room at every width: each room's screen has its own width.
      for (const w of [1280, 1600, 1920]) {
        await page.setViewportSize({ width: w, height: w === 1280 ? 800 : w === 1600 ? 1000 : 1080 });
        const bad = [];
        for (const id of ids) {
          await page.locator(`.cp-rooms [data-room="${id}"]`).click();
          await page.waitForTimeout(150);
          const r = await page.evaluate(() => {
            const bs = [...document.querySelectorAll('.cp-rooms .cp-room')];
            const card = document.querySelector('#campaign .cp-card').getBoundingClientRect();
            return { lines: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size, out: bs.filter((b) => b.getBoundingClientRect().right > card.right - 1 || b.scrollWidth > b.clientWidth + 1).length };
          });
          if (r.lines !== 1 || r.out) bad.push(`${id}: ${JSON.stringify(r)}`);
        }
        check(!bad.length, `${tag} at ${w} px: in every room the bar is one line inside its screen`, bad.join('; '));
      }
      await page.setViewportSize({ width: 1600, height: 1000 });
      for (const id of ids) {
        await page.locator(`.cp-rooms [data-room="${id}"]`).click();
        await page.waitForTimeout(500);
        await page.locator('.cp-icom [data-act="icom-close"]').click({ timeout: 800 }).catch(() => {});
        await shot(page, `ship-${tag}-room-${id}`);
      }
    };
    await rooms('dark');
    await page.locator('[data-room="desk"]').click();
    await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy-assigned"]').click()]);
    await booted(page);
    await page.waitForTimeout(800);
    await endRun(page, 'won');
    await page.waitForSelector('#campaign:not(.hidden) [data-act="back"]', { timeout: 45000 });
    await page.waitForTimeout(1500);
    await shot(page, 'report-campaign-won');
    await page.locator('[data-act="back"]').click();
    await page.waitForSelector('#campaign:not(.hidden) .cp-icom', { timeout: 20000 });
    await page.locator('.cp-icom [data-act="icom-close"]').click().catch(() => {});
    await page.waitForSelector('#campaign:not(.hidden) .cp-scene', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'ship-caller');
    await page.locator('.cp-scene [data-ally]').first().click().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, 'ship-caller-beat');
    while (await page.locator('.cp-scene [data-act="scene-ok"]').count()) { await page.locator('.cp-scene [data-act="scene-ok"]').first().click(); await page.waitForTimeout(200); }
    await rooms('open');
    await page.locator('[data-act="settings"]').click();
    await page.waitForTimeout(500);
    await shot(page, 'ship-settings');
    check(errors.length === 0, 'the ship: nothing logged as an error', errors.slice(0, 2).join(' | '));
    // YOKE scripted: she asks rfab.ai nothing, in any room (the AI Core included).
    check(page.rfabCalls.length === 0, 'YOKE scripted: no call to rfab.ai from any room', page.rfabCalls.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  freePort();
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
