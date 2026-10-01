/**
 * THE LIMB CODEX (Oct 1 2026, src/ui/codex.ts) seen as a player sees it, on the DEV server with the GPU on:
 * a skirmish, the codex opened by its ▤ button and by C, a limb with drawn upgrade looks (and a look picked),
 * one seen from behind and firing, an engine, the filters, a built limb's CODEX button opening it at that limb,
 * and the codex at 1280 wide. Pictures: notes/screens/2026-10-01/codex-*.jpg. Nothing is spent.
 *   node tools/shot-codex.mjs
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.CODEX_PORT || 5241);
const URL0 = `http://localhost:${PORT}/`;
const failures = [];
const check = (ok, name, detail = '') => { if (!ok) failures.push(name); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`); };
const shot = (page, name) => page.screenshot({ path: join(out, `codex-${name}.jpg`), type: 'jpeg', quality: 86 });

function freePort() {
  try {
    for (const line of execSync('netstat -ano', { encoding: 'utf8' }).split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'pipe', env: { ...process.env, BROODFALL_NO_HMR: '1' },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route('**/rfab-api/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.route('https://api.rfab.ai/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => { localStorage.setItem('broodfall-intro-seen', '1'); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${URL0}?seed=11&autostart=1&speed=0&biome=suburb`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.broodfall && window.__bfBooted && document.getElementById('boot').classList.contains('hidden'), null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  check(await page.locator('#menu-codex').count() === 1, 'the main menu has LIMB CODEX');

  await page.click('#view-codex');
  await page.waitForSelector('#codex .cx-tile');
  await page.waitForTimeout(2500); // the manifest and the atlases
  const n = await page.locator('#codex .cx-tile').count();
  check(n === 37, 'the codex shows every limb family', `${n}`);
  await shot(page, '01-open-spitter');

  await page.click('#codex [data-look="swarm+venom"]');
  await page.waitForTimeout(800);
  await shot(page, '02-spitter-superstructure');

  await page.click('#codex [data-pick="impaler"]');
  check((await page.textContent('#codex .cx-dname')) === 'Impaler', 'a click on a limb shows it', await page.textContent('#codex .cx-dname'));
  await page.click('#codex [data-view="back"]');
  await page.waitForTimeout(700);
  await shot(page, '03-impaler-behind');
  await page.click('#codex [data-view="fire"]');
  await page.waitForTimeout(500);
  await shot(page, '04-impaler-firing');

  await page.click('#codex [data-pick="lasher"]');
  await page.click('#codex [data-look="bone+venom"]');
  await page.waitForTimeout(700);
  await shot(page, '05-lasher-bone-venom');

  await page.click('#codex [data-f="role"][data-v="engine"]');
  await page.click('#codex [data-pick="amp"]');
  await page.waitForTimeout(700);
  await shot(page, '06-engines-amp');

  await page.click('#codex [data-f="role"][data-v=""]');
  await page.click('#codex [data-f="cls"][data-v="venom"]');
  await page.waitForTimeout(400);
  await shot(page, '07-filter-venom');
  await page.click('#codex [data-f="cls"][data-v=""]');
  await page.fill('#codex .cx-search', 'fliers');
  await page.waitForTimeout(400);
  await shot(page, '08-search-fliers');
  await page.fill('#codex .cx-search', '');

  await page.keyboard.press('Escape');
  check(await page.locator('#codex.hidden').count() === 1, 'Esc closes the codex');
  await page.keyboard.press('c');
  check(await page.locator('#codex:not(.hidden)').count() === 1, 'C opens the codex on the board');
  await page.keyboard.press('Escape');

  // A built limb's panel: CODEX opens the codex at that limb.
  const built = await page.evaluate(() => {
    const b = window.broodfall; const s = b.sim;
    s.meat.war = 500;
    const cells = b.buildableCells(60);
    for (let g = 0; g < 40; g++) {
      const i = s.hand.findIndex((h) => h.family === 'lasher' || h.family === 'spitter' || h.family === 'spine');
      if (i < 0) { s.issue({ kind: 'discard', cardIndex: 0 }); continue; }
      const fam = s.hand[i].family;
      const cell = cells.find((c) => s.canBuildTower(c, fam));
      if (cell !== undefined && s.issue({ kind: 'build', cardIndex: i, cell }).ok) { b.step(1); return { id: s.towers.at(-1).id, fam: s.towers.at(-1).family }; }
    }
    return null;
  });
  if (built && await page.evaluate(() => !!window.broodfall.hud)) {
    await page.evaluate((id) => { window.broodfall.hud.inspectedId = id; window.broodfall.step(1); }, built.id);
    await page.waitForTimeout(400);
    if (await page.locator('#inspect:not(.hidden) #inspect-codex').count()) {
      await page.click('#inspect-codex');
      await page.waitForTimeout(800);
      const sel = await page.evaluate(() => document.querySelector('#codex .cx-tile.on')?.getAttribute('data-pick'));
      check(sel === built.fam, 'CODEX on a built limb opens the codex at it', `${built.fam} -> ${sel}`);
      await shot(page, '09-from-limb-panel');
      await page.keyboard.press('Escape');
    } else console.log('  NOTE  the limb panel did not open from here');
  } else console.log('  NOTE  no hud on window: the CODEX button on a limb panel is not exercised');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('#view-codex');
  await page.click('#codex [data-pick="frond"]');
  await page.waitForTimeout(1200);
  await shot(page, '10-at-1280');
  check(errors.length === 0, 'nothing logged as an error', errors.slice(0, 2).join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
console.log(failures.length ? `\n${failures.length} FAILED: ${failures.join('; ')}` : '\nall passed');
process.exit(failures.length ? 1 : 0);
