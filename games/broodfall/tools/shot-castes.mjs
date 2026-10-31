/**
 * MISSION 1 IS WAR ONLY, PLAYED (Collins, Oct 30 2026: "on the first mission the first units you encounter are science
 * types this is crazy ... mission one should be only war type and science type + royals should not come until you can
 * use their currency"). On the DEV server (what `npm start` runs), in a fresh browser with nothing stored: the first
 * launch, the cinematic skipped, mission 1 on the board, played by the scripted player through its waves while every
 * enemy that steps onto the board is counted by kind. DESIGN.md "Three meat currencies" rule 4; src/sim/sim.ts
 * castesOpen; tests/castes.test.ts has the headless version.
 *
 *   node tools/shot-castes.mjs        (its own dev server on BROODFALL_PORT, default 5277)
 * Pictures: tools/screenshots/castes-*.png and notes/screens/2026-10-30/castes-*.jpg.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const notes = join(root, 'notes', 'screens', '2026-10-30');
mkdirSync(shots, { recursive: true });
mkdirSync(notes, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5277);
const URL0 = `http://localhost:${PORT}/`;

let failed = 0;
const check = (ok, what, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? ` (${detail})` : ''}`); if (!ok) failed++; };
const shot = async (page, name) => {
  const png = join(shots, `castes-${name}.png`);
  await page.screenshot({ path: png });
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '4', join(notes, `castes-${name}.jpg`)]);
  console.log(`  shot  ${join(notes, `castes-${name}.jpg`)}`);
};

/** The kinds that are not the war caste (content/data.ts ENEMIES). */
const SCIENCE = ['researcher', 'thief', 'infiltrator', 'dartgun', 'engineer', 'fieldstation', 'sciturret', 'lensbearer'];
const ROYAL = ['royal', 'consort', 'matron'];

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

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|rfab-api/.test(m.text())) errors.push(m.text()); });
  await page.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));

  console.log('the first launch (the bare address starts the campaign with mission 1 pending); then the same deployment with the scripted player');
  await page.goto(URL0, { waitUntil: 'load', timeout: 180000 });
  // The cinematic (if it is up: it may still be fetching its reel) is skipped; else the board is already there.
  await page.waitForFunction(() => (window.__bfBooted && window.broodfall) || document.querySelector('#intro:not(.hidden)'), null, { timeout: 120000 });
  for (let i = 0; i < 10 && !(await page.evaluate(() => window.__bfBooted && window.broodfall)); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  await page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 90000 });
  check(await page.evaluate(() => document.body.classList.contains('first-mission')), 'the bare address opens on mission 1');
  // The pending deployment (mission 1) again, with the scripted player at the controls (?auto=1 is a query string, so
  // the page does not re-decide the launch: it plays what the campaign has pending).
  await page.goto(`${URL0}?auto=1&campaign=run`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__bfBooted && window.broodfall, null, { timeout: 90000 });
  const start = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return {
      first: document.body.classList.contains('first-mission'),
      scienceOpen: s.scienceOpen, royalOpen: s.royalOpen,
      caps: s.cfg.evolutionCap, directive: s.directive,
      hand: s.hand.map((c) => c.family),
      deposits: s.under.cells.filter((c) => c.kind === 'deposit').map((c) => c.deposit),
      meat: { ...s.meat },
    };
  });
  check(start.first, 'the page is mission 1 (body.first-mission)');
  check(start.directive.kind === 'hold' && start.directive.waves === 5, 'hold five waves', JSON.stringify(start.directive));
  check(start.scienceOpen === false && start.royalOpen === false, 'the science caste and the court are closed', `science ${start.scienceOpen}, royal ${start.royalOpen}`);
  check(!!start.caps && Object.values(start.caps).every((n) => n === 0), 'no limb can evolve (every theme capped at 0)', JSON.stringify(start.caps));
  check(start.hand.every((f) => f === 'spitter' || f === 'lasher'), 'the first hand is spitters and lashers (war meat)', start.hand.join());
  check(!start.deposits.includes('lab') && !start.deposits.includes('ossuary'), 'the dig has no research lab and no royal tomb', start.deposits.join());
  await shot(page, '01-mission1-setup');

  console.log('the scripted player plays the waves; every enemy counted by kind');
  const kinds = new Set();
  let hint2 = '';
  let shotWave2 = false;
  let panel = null;
  for (let i = 0; i < 400; i++) {
    const r = await page.evaluate(() => {
      window.broodfall.step(300);
      const s = window.broodfall.sim;
      return { kinds: s.enemies.map((e) => e.kind), wave: s.waveNumber, phase: s.phase, outcome: s.outcome, hint: document.getElementById('hint')?.textContent ?? '' };
    });
    for (const k of r.kinds) kinds.add(k);
    if (r.wave === 2 && r.phase === 'siege' && !hint2) hint2 = r.hint;
    if (r.wave >= 2 && r.phase === 'siege' && !shotWave2 && r.kinds.length > 3) {
      shotWave2 = true;
      // The HUD after the first cleared wave: the dials are revealed, the interest dial is not among them.
      panel = await page.evaluate(() => {
        const vis = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; };
        const s = window.broodfall.sim;
        const t = s.towers[0];
        window.broodfall.hud.inspectedId = t ? t.id : null;
        window.broodfall.step(1);
        return {
          threat: vis('dial-threat'), interest: vis('dial-interest'), sci: vis('meat-science'), royal: vis('meat-royal'), surge: vis('royal-surge'),
          evolve: document.getElementById('inspect-evolve')?.innerHTML ?? null,
          inspect: document.getElementById('inspect')?.textContent ?? '',
          evolveLabel: vis('inspect-evolve') || [...document.querySelectorAll('#inspect .inspect-evolve-label')].some((el) => el.getClientRects().length > 0),
          casteRow: vis('inspect-castes'),
        };
      });
      await shot(page, '02-wave2-panel');
      await page.evaluate(() => { window.broodfall.hud.inspectedId = null; window.broodfall.step(1); });
    }
    if (r.outcome !== 'playing' || r.wave >= 4) break;
  }
  const end = await page.evaluate(() => { const s = window.broodfall.sim; return { wave: s.waveNumber, outcome: s.outcome, meat: { ...s.meat }, cleared: s.wavesCleared }; });
  await shot(page, '03-late');
  check(end.wave >= 3, 'waves were fought', `wave ${end.wave}, cleared ${end.cleared}, outcome ${end.outcome}`);
  const sci = [...kinds].filter((k) => SCIENCE.includes(k));
  const roy = [...kinds].filter((k) => ROYAL.includes(k));
  check(sci.length === 0, 'no science body ever stepped onto the board', sci.join() || `${[...kinds].join()}`);
  check(roy.length === 0, 'no royal body ever stepped onto the board', roy.join());
  check(end.meat.science === 0 && end.meat.royal === 0, 'no science and no royal meat was ever banked', JSON.stringify(end.meat));
  // The coach's hint is for a player's own hands (src/main.ts coachTick: not under ?auto=1); its wave-2 line is read in the code.
  if (hint2) check(!/science|EVOLVE/i.test(hint2), 'the wave-2 hint does not speak of science', hint2);
  check(panel && panel.threat && !panel.interest, 'after wave 1 the threat dial shows and the interest dial does not', JSON.stringify(panel && { threat: panel.threat, interest: panel.interest }));
  check(panel && !panel.sci && !panel.royal && !panel.surge, 'no science meat, royal meat or decree button on the bar', JSON.stringify(panel && { sci: panel.sci, royal: panel.royal, surge: panel.surge }));
  check(panel && panel.evolve === '', 'the limb panel has no evolution ladder (nothing to lock, nothing of the globe)', panel ? panel.evolve.slice(0, 80) : 'no panel');
  check(panel && !/globe|LOCKED/.test(panel.inspect), 'the limb panel never speaks of the globe', panel ? panel.inspect.slice(0, 120) : '');
  check(panel && !panel.evolveLabel && !panel.casteRow, 'the EVOLVE heading and the caste-priority row are not shown (no caste but war can come)', JSON.stringify(panel && { evolveLabel: panel.evolveLabel, casteRow: panel.casteRow }));
  check(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  try { process.kill(server.pid); } catch {}
  freePort();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
