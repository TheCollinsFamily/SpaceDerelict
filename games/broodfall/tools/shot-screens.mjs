/**
 * THE SCREENS AROUND THE BOARD, seen the way a player meets them (Sep 30 2026): the DEV
 * server (what `npm start` runs), the menu as it opens, a click on deploy.
 *
 *   title       the title screen (the key art, the emblem, the name set in type) at two sizes
 *   loading     the network throttled to a slow line: deploy clicked at once, the loading
 *               screen while the art arrives, then the board
 *   draft       a real run played into its first district draft: each plate drawn as the board
 *               will draw it, and where it goes; one picked by a click
 *   debrief     the skirmish report, lost and won; the campaign's, taken and failed (the end of
 *               the run is forced, as in shot-campaign.mjs; the run before it is played)
 *   genes       the Gene Bay's organ cards with their pictures
 *   faults      each failure forced: the art list missing, a few pictures missing, no WebGL,
 *               the game's own code failing while it loads
 *
 * Usage: node tools/shot-screens.mjs [beat ...]      (no beat: all of them)
 * Pictures: notes/screens/2026-09-30/screens-*.jpg
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
const PORT = Number(process.env.BROODFALL_PORT || 5199) - 37;
const URL0 = `http://localhost:${PORT}/`;
const want = new Set(process.argv.slice(2));
const on = (b) => !want.size || want.has(b);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};
const shot = (page, name, opts = {}) => page.screenshot({ path: join(out, `screens-${name}.jpg`), type: 'jpeg', quality: 82, ...opts });

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
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'];
const server = await startDev();
const browser = await chromium.launch({ args: GPU });

/** A fresh page, errors collected; the campaign cleared and YOKE scripted. */
async function fresh(viewport = { width: 1600, height: 1000 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('bf-beat-init')) return;
    sessionStorage.setItem('bf-beat-init', '1');
    for (const k of ['broodfall-campaign', 'broodfall-campaign-pending', 'broodfall-meta']) localStorage.removeItem(k);
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    // A returning player: the menu (the first launch, the film and mission 1: tools/shot-onboarding.mjs).
    localStorage.setItem('broodfall-intro-seen', '1');
  });
  return { ctx, page, errors };
}
const ready = (page) => page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 90000 });

/** Play the run in its own time: limbs built by the API, waves called, until a district draft opens. */
async function playToDraft(page) {
  return page.evaluate(() => {
    const b = window.broodfall;
    const s = b.sim;
    b.surface();
    for (let round = 0; round < 12 && s.phase !== 'draft' && s.outcome === 'playing'; round++) {
      s.meat.war = Math.max(s.meat.war, 400);
      const cells = b.buildableCells(60);
      let built = 0;
      for (let g = 0; g < 60 && built < 3; g++) {
        const i = s.hand.findIndex((h) => ['spitter', 'lasher', 'burster', 'maw'].includes(h.family));
        if (i < 0) { s.issue({ kind: 'discard', cardIndex: 0 }); continue; }
        const cell = cells.find((c) => s.canBuildTower(c, s.hand[i].family));
        if (cell === undefined) break;
        if (s.issue({ kind: 'build', cardIndex: i, cell }).ok) built++; else s.issue({ kind: 'discard', cardIndex: i });
      }
      s.issue({ kind: 'call-early' });
      const w0 = s.wavesCleared;
      for (let k = 0; k < 8000 && s.phase !== 'draft' && s.wavesCleared === w0 && s.outcome === 'playing'; k++) b.step(1);
      b.surface();
    }
    return { phase: s.phase, waves: s.wavesCleared, towers: s.towers.length, outcome: s.outcome };
  });
}

/** End the run now (the path from the last wave to the report is what is looked at). */
const endRun = (page, how) => page.evaluate((how) => {
  const s = window.broodfall.sim;
  s.outcome = how;
  s.events.push({ kind: how });
  window.broodfall.step(1);
}, how);

try {
  // ------------------------------------------------------------ the title
  if (on('title')) {
    const { ctx, page, errors } = await fresh();
    await page.goto(URL0, { waitUntil: 'load' });
    await ready(page);
    await page.waitForSelector('#menu.console-menu.has-video .logo.has-emblem', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1600);
    const t = await page.evaluate(() => ({
      // The title is the ship's console over the viewport's loop now (Sep 30 2026, src/ui/menu.ts).
      art: document.getElementById('menu').classList.contains('has-video') && !document.querySelector('.menu-video').paused,
      emblem: document.querySelector('#menu .logo')?.classList.contains('has-emblem'),
      word: document.querySelector('#menu .logo-word')?.textContent,
      title: document.title,
    }));
    check(t.art && t.emblem, 'the title screen is the ship console over its looping video, with the emblem');
    check(t.word === 'BROODFALL' && /BROODFALL/.test(t.title), 'the name is set in type from one place', `${t.word} / ${t.title}`);
    await shot(page, '01-title');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);
    await shot(page, '02-title-1280x720');
    check(await page.locator('#menu-deploy').isVisible() && await page.locator('#menu-new').isVisible() && await page.locator('#menu-intro').isVisible(), 'at 1280x720 every way in is on the screen');
    check(errors.length === 0, 'the title: nothing is logged as an error', errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ loading
  if (on('loading')) {
    const { ctx, page, errors } = await fresh();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    // About 6 Mbit/s with a little latency: a slow home line.
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 750 * 1024, uploadThroughput: 250 * 1024 });
    await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
    await page.waitForSelector('#menu-deploy', { state: 'visible', timeout: 180000 });
    await page.waitForTimeout(400);
    await page.locator('#menu-deploy').click();
    await page.waitForTimeout(1500);
    const up = await page.evaluate(() => ({ shown: !document.getElementById('boot').classList.contains('hidden'), count: document.querySelector('.boot-count')?.textContent, line: document.querySelector('.boot-line')?.textContent }));
    check(up.shown, 'deploy clicked before the art is in: the loading screen is up', `${up.count} · ${up.line}`);
    await shot(page, '03-loading');
    await page.waitForTimeout(6000);
    const mid = await page.evaluate(() => document.querySelector('.boot-count')?.textContent);
    await shot(page, '04-loading-later');
    await page.waitForFunction(() => document.getElementById('boot').classList.contains('hidden'), null, { timeout: 240000 });
    await page.waitForTimeout(900);
    const done = await page.evaluate(() => ({ view: window.broodfall.view(), missing: window.broodfall.artMissing(), started: window.broodfall.sim.time > 0 }));
    check(done.view === 'iso', 'the loading screen leaves when the art is in, onto the painted board', `${mid}; ${done.view}`);
    if (done.missing.length) console.log(`  NOTE  pictures that did not load this time (another session may be baking them): ${done.missing.join(', ')}`);
    await shot(page, '05-board-after-loading');
    check(errors.length === 0, 'loading: nothing is logged as an error', errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ the district draft, then the skirmish report
  if (on('draft') || on('debrief')) {
    for (const [n, how] of [[0, 'lost'], [1, 'won']]) {
      const { ctx, page, errors } = await fresh();
      await page.goto(`${URL0}?seed=${n ? 11 : 7}`, { waitUntil: 'load' });
      await ready(page);
      await page.locator('#menu-deploy').click();
      await page.waitForFunction(() => document.getElementById('boot').classList.contains('hidden') && window.broodfall.view() === 'iso', null, { timeout: 60000 });
      const r = await playToDraft(page);
      const notice = await page.evaluate(() => { const el = document.getElementById('art-notice'); return el.classList.contains('hidden') ? '' : el.title; });
      if (notice) console.log(`  NOTE  pictures that did not load this time (another session may be baking them): ${notice}`);
      if (n === 0) {
        check(r.phase === 'draft', 'a run played into its first district draft', JSON.stringify(r));
        await page.waitForSelector('#draft:not(.hidden) .draft-option', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        const cards = await page.evaluate(() => [...document.querySelectorAll('.draft-option')].map((c) => ({
          pic: !!c.querySelector('img.df-pic'), w: c.querySelector('img.df-pic')?.naturalWidth ?? 0, here: !!c.querySelector('.df-map i.here'),
        })));
        check(cards.length > 0 && cards.every((c) => c.pic && c.w > 100 && c.here), 'every plate on offer shows its picture and where it goes', JSON.stringify(cards));
        await shot(page, '06-draft');
        await page.locator('.draft-option').first().hover();
        await page.locator('#draft-card-wrap').screenshot({ path: join(out, 'screens-07-draft-close.jpg'), type: 'jpeg', quality: 88 });
        await page.locator('.draft-option').first().click();
        await page.waitForTimeout(1500);
        check(await page.evaluate(() => window.broodfall.sim.phase !== 'draft'), 'a click on a plate takes it');
        await shot(page, '08-after-draft');
      } else {
        while (await page.evaluate(() => window.broodfall.sim.phase === 'draft')) { await page.locator('.draft-option').first().click(); await page.waitForTimeout(300); }
        await page.evaluate(() => { const s = window.broodfall.sim; for (let i = 0; i < 400; i++) window.broodfall.step(1); return s.time; });
      }
      if (!on('debrief')) { await ctx.close(); continue; }
      await page.waitForTimeout(500);
      if (how === 'lost') {
        // Lost for real: no more limbs, the waves called one after another until the core falls.
        const real = await page.evaluate(() => {
          const b = window.broodfall;
          const s = b.sim;
          for (let round = 0; round < 60 && s.outcome === 'playing'; round++) {
            b.surface();
            while (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0 });
            s.issue({ kind: 'call-early' });
            const w0 = s.wavesCleared;
            for (let k = 0; k < 8000 && s.wavesCleared === w0 && s.outcome === 'playing' && s.phase !== 'draft'; k++) b.step(1);
          }
          return s.outcome;
        });
        console.log(`  NOTE  the lost run ended by play: ${real}`);
        if (real === 'playing') await endRun(page, how);
      } else await endRun(page, how);
      await page.waitForSelector('#debrief:not(.hidden) .dbf', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const d = await page.evaluate(() => ({
        lead: !!document.querySelector('.dbf-lead.has-pic'), photo: document.querySelector('.dbf-photo img')?.naturalWidth ?? 0,
        limbs: document.querySelectorAll('.dbf-tiles')[0]?.children.length ?? 0, units: document.querySelectorAll('.dbf-tiles')[1]?.children.length ?? 0,
        verdict: document.querySelector('.dbf-verdict')?.textContent,
      }));
      check(d.lead && d.photo > 100 && d.limbs > 0, `the skirmish report (${how}) opens with pictures: the outcome, the board, the limbs, what came`, JSON.stringify(d));
      await shot(page, `${n ? '10' : '09'}-debrief-${how}`);
      await page.locator('#debrief .screen-card').screenshot({ path: join(out, `screens-${n ? '10' : '09'}-debrief-${how}-card.jpg`), type: 'jpeg', quality: 86 });
      check(errors.length === 0, `debrief (${how}): nothing is logged as an error`, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
  }

  // ------------------------------------------------------------ the campaign's report, and the Gene Bay
  if (on('campaign') || on('genes')) {
    for (const how of ['won', 'lost']) {
      const { ctx, page, errors } = await fresh();
      // A campaign whose desk is open (the unfolding before it: tools/shot-onboarding.mjs).
      await page.goto(`${URL0}?campaign=ship&open=1`, { waitUntil: 'load' });
      await ready(page);
      await page.waitForSelector('#campaign:not(.hidden) .globe');
      if (how === 'won' && on('genes')) {
        await page.locator('[data-room="genes"]').click();
        await page.waitForSelector('.cp-organ-pic', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(700);
        const pics = await page.evaluate(() => [...document.querySelectorAll('.cp-organ-pic')].filter((i) => i.naturalWidth > 0).length);
        const rows = await page.evaluate(() => document.querySelectorAll('.cp-lin.cp-organ').length);
        check(pics > 5 && pics === rows, 'every organ card in the Gene Bay shows its organ', `${pics} of ${rows}`);
        await shot(page, '13-gene-bay-organs');
        await page.locator('[data-room="desk"]').click();
      }
      if (!on('campaign')) { await ctx.close(); break; }
      await page.locator('.globe .site.open').first().click();
      await Promise.all([page.waitForURL(/campaign=run/), page.locator('[data-act="deploy"]').click()]);
      await page.waitForFunction(() => window.broodfall?.view() === 'iso' && document.getElementById('boot').classList.contains('hidden'), null, { timeout: 60000 });
      await playToDraft(page);
      while (await page.evaluate(() => window.broodfall.sim.phase === 'draft')) { await page.locator('.draft-option').first().click(); await page.waitForTimeout(300); }
      await page.waitForTimeout(600);
      await endRun(page, how);
      await page.waitForSelector('#campaign:not(.hidden) .dbf', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const d = await page.evaluate(() => ({ lead: !!document.querySelector('#campaign .dbf-lead.has-pic'), verdict: document.querySelector('#campaign .dbf-verdict')?.textContent, back: !!document.querySelector('[data-act="back"]') }));
      check(d.lead && d.back, `the campaign report (${how}) opens with its pictures and still goes back to the ship`, JSON.stringify(d));
      await shot(page, `${how === 'won' ? '11' : '12'}-campaign-debrief-${how}`);
      check(errors.length === 0, `campaign (${how}): nothing is logged as an error`, errors.slice(0, 2).join(' | '));
      await ctx.close();
    }
  }

  // ------------------------------------------------------------ the faults, each forced
  if (on('faults')) {
    {
      // The list of the art is missing.
      const { ctx, page } = await fresh();
      await page.route('**/art/manifest.json*', (r) => r.fulfill({ status: 404, body: 'not found' }));
      await page.goto(URL0, { waitUntil: 'load' });
      await page.waitForSelector('#fault:not(.hidden)', { timeout: 30000 }).catch(() => {});
      const k = await page.evaluate(() => document.getElementById('fault').dataset.kind);
      check(k === 'no-art', 'the art list missing: the fault screen says the pictures did not arrive', k);
      await shot(page, '14-fault-no-art');
      await page.locator('[data-act="continue"]').click();
      await page.waitForTimeout(400);
      await shot(page, '14b-fault-no-art-menu-plain');
      await page.locator('#menu-deploy').click();
      await page.waitForTimeout(1500);
      const v = await page.evaluate(() => window.broodfall?.view());
      check(v === 'top', 'PLAY WITHOUT THE PICTURES: the run goes ahead on the plain board', v);
      await shot(page, '15-fault-no-art-played-plain');
      await ctx.close();
    }
    {
      // A few pictures missing: the units' sheets.
      const { ctx, page } = await fresh();
      await page.route('**/art/units/**', (r) => r.abort());
      await page.goto(`${URL0}?autostart=1&seed=5`, { waitUntil: 'load' });
      await ready(page);
      await page.waitForSelector('#art-notice:not(.hidden)', { timeout: 30000 }).catch(() => {});
      const txt = await page.locator('#art-notice').innerText().catch(() => '');
      check(/DID NOT LOAD/.test(txt), 'a few pictures missing: a line over the board says so, and the board is up', txt.slice(0, 60));
      await page.evaluate(() => { for (let i = 0; i < 300; i++) window.broodfall.step(1); });
      await page.waitForTimeout(600);
      await shot(page, '16-fault-some-pictures');
      await ctx.close();
    }
    {
      // The game's own code fails while it loads.
      const { ctx, page } = await fresh();
      await page.route('**/src/ui/debrief.ts*', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: "export const debriefPictures = null; throw new Error('forced by tools/shot-screens.mjs: a module that fails while it loads');" }));
      await page.goto(URL0, { waitUntil: 'load' });
      await page.waitForSelector('#fault:not(.hidden)', { timeout: 30000 }).catch(() => {});
      const t = await page.locator('#fault').innerText().catch(() => '');
      check(/FAILED WHILE STARTING/.test(t) && /forced by/.test(t), 'the code failing while it loads: the fault screen shows what went wrong', t.slice(0, 50));
      await shot(page, '17-fault-crash');
      await ctx.close();
    }
    {
      // No WebGL: the browser gives no WebGL (or WebGPU) context, as with hardware acceleration off.
      // PixiJS then draws on a plain canvas: the game goes on, slowly, and says so.
      const noGl = () => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
          if (/webgl|webgpu/i.test(String(kind))) return null;
          // The second case: nothing to draw with at all (set before the page loads).
          if (window.__noCanvas && kind === '2d' && this.isConnected === false && !this.dataset?.shot) return null;
          return get.call(this, kind, ...rest);
        };
        try { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); } catch {}
      };
      const a = await fresh();
      await a.ctx.addInitScript(noGl);
      await a.page.goto(`${URL0}?autostart=1&seed=5`, { waitUntil: 'load' });
      await ready(a.page);
      await a.page.waitForSelector('#art-notice:not(.hidden)', { timeout: 60000 }).catch(() => {});
      const txt = await a.page.locator('#art-notice').innerText().catch(() => '');
      const r = await a.page.evaluate(() => window.broodfall.renderer.app.renderer.name);
      check(r === 'canvas' && /WITHOUT WEBGL/.test(txt), 'no WebGL: the board is drawn without it, and a line says it will be slow and how to mend it', `${r}: ${txt.slice(0, 40)}`);
      await a.page.evaluate(() => { for (let i = 0; i < 200; i++) window.broodfall.step(1); });
      await a.page.waitForTimeout(1500);
      await shot(a.page, '18-no-webgl-drawn-on-canvas');
      await a.ctx.close();
      // Nothing to draw with at all: the fault screen.
      const b = await fresh();
      await b.ctx.addInitScript(() => { window.__noCanvas = true; });
      await b.ctx.addInitScript(noGl);
      await b.page.goto(URL0, { waitUntil: 'load' });
      await b.page.waitForSelector('#fault:not(.hidden)', { timeout: 60000 }).catch(() => {});
      const k = await b.page.evaluate(() => document.getElementById('fault').dataset.kind);
      check(k === 'no-webgl', 'nothing to draw with: the fault screen says the browser cannot draw the board, and how to fix it', k);
      await shot(b.page, '19-fault-no-webgl');
      await b.ctx.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `SCREENS: ${failures.length} check(s) FAILED: ${failures.join('; ')}` : 'SCREENS: all passed.');
process.exit(failures.length ? 1 : 0);
