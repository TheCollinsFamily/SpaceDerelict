/**
 * DEFENCE DEPLOYMENTS, in the browser (Collins, Oct 1 2026: "always visually warn the player one 'turn'
 * ahead with like a pushing arrow indicator from where it's being staged and you can choose to just
 * attack that territory to cancel"; src/meta/defence.ts, src/ui/defenceUi.ts).
 *   1. The desk with a counter-attack STAGED: the pushing arrow on the planet, the staging ground marked.
 *   2. The staging ground picked: its STAGING GROUND tag (strike first to cancel the attack on X).
 *   3. The counter-attack LAUNCHED: the arrow red, the ground under attack, DEFEND.
 *   4. The defence itself at its start, on a LARGE city (no board remembered): core at stage 3, a full larder.
 *   5. The same defence on a REMEMBERED board (a board the scripted player grew, saved as a win would).
 *   6. An old save (attack launched with no warning) is staged again when it loads.
 *
 * Usage: node tools/shot-defence.mjs        (starts its own dev server on 5263)
 * Artifacts: notes/screens/2026-10-01/defence-*.png
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5263);
const URL0 = `http://localhost:${PORT}/`;
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};

function freePort() {
  try {
    const txt = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of txt.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
function startDev() {
  freePort();
  // vite's own entry (works without node_modules/.bin).
  const child = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}

const HELD = ['crash-site', 'cul-de-sac', 'granary', 'harbor'];
const TARGET = 'granary';
const FROM = 'foundry';

/** A fresh campaign with the desk open, then `patch` written into its save. */
async function campaignWith(page, patch) {
  await page.goto(`${URL0}?campaign=ship&open=1`);
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 30000 });
  await page.evaluate(({ held, patch }) => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.held = held; s.captures = held.length - 1; s.deployments = held.length;
    s.underAttack = null; s.staging = null; s.attackFrom = null; s.pendingScenes = [];
    if (s.onboard) { s.onboard.deskOpen = true; s.onboard.mission1 = 'won'; }
    Object.assign(s, patch);
    for (const k of Object.keys(patch)) if (patch[k] === '__delete') delete s[k];
    localStorage.setItem('broodfall-globe-seen', JSON.stringify(Object.fromEntries(held.map((id) => [id, 9]))));
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
  }, { held: HELD, patch });
}

async function openDesk(page) {
  await page.goto(`${URL0}?campaign=ship`);
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 30000 });
  await page.locator('[data-room="desk"]').click();
  await page.waitForTimeout(600);
}

/** Pick a landing site as a click on its marker does (it may be round the back of the planet). */
async function pick(page, id) {
  await page.evaluate((i) => document.querySelector(`.globe .site[data-site="${i}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), id);
}

async function globeShot(page, file) {
  const bb = await page.locator('.cp-globe .globe-box').boundingBox();
  await page.screenshot({ path: join(out, file), clip: { x: bb.x - 10, y: bb.y - 10, width: bb.width + 20, height: bb.height + 60 } });
}

const server = await startDev();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-intro-seen', '1');
  });

  // 1. Staged: the arrow.
  console.log('1. staged');
  await campaignWith(page, { staging: { target: TARGET, from: FROM } });
  await openDesk(page);
  // Turn the planet to face the push (picking the staging ground turns it there).
  await pick(page, FROM);
  await page.waitForTimeout(2200);
  const push = await page.evaluate(() => {
    const g = document.querySelector('.globe .push');
    return g ? { cls: g.getAttribute('class'), line: g.querySelector('.push-line')?.getAttribute('d') ?? '', head: g.querySelector('.push-head')?.getAttribute('d') ?? '' } : null;
  });
  check(!!push && push.cls.includes('staging'), 'the globe draws the colony massing (a staging push)', push?.cls);
  check(!!push && push.line.length > 20, 'the push has a line on the planet', `${push?.line.length ?? 0} chars`);
  check(!!push && push.head.length > 10, 'the push has its arrowhead at the threatened ground');
  const massing = await page.locator(`.globe .site[data-site="${FROM}"]`).getAttribute('class');
  check(massing.includes('massing'), 'the staging ground is marked MASSING', massing);
  const threat = await page.locator(`.globe .site[data-site="${TARGET}"]`).getAttribute('class');
  check(threat.includes('threat') && !threat.includes('attack'), 'the threatened ground is threatened, not yet under attack', threat);
  await globeShot(page, 'defence-1-arrow-staging.png');

  // 2. The staging ground's tag on the landing-site picker.
  console.log('2. staging tag');
  const banner = await page.locator('.cp-push.staging').innerText().catch(() => '');
  check(/STAGING GROUND/.test(banner) && /strike first to cancel the attack on The Granary Belt/i.test(banner), 'the staging ground says STRIKE FIRST to cancel the attack', banner.split(String.fromCharCode(10))[0]);
  const deploy = await page.locator('[data-act="deploy"]').innerText();
  check(deploy.trim() === 'DEPLOY', 'the staging ground is a landing site', deploy);
  await page.screenshot({ path: join(out, 'defence-2-staging-tag.png') });
  // The threatened ground's own briefing: no defence yet.
  await pick(page, TARGET);
  await page.waitForTimeout(800);
  const threatBanner = await page.locator('.cp-push.threat').innerText().catch(() => '');
  check(/THREATENED/.test(threatBanner), 'the threatened ground says THREATENED, strike the staging ground first', threatBanner.split(String.fromCharCode(10))[0]);
  check(await page.locator('[data-act="deploy"]').isDisabled(), 'there is no defence to play yet (it has not come)');

  // 3. Launched.
  console.log('3. launched');
  await campaignWith(page, { underAttack: TARGET, attackFrom: FROM });
  await openDesk(page);
  await pick(page, TARGET);
  await page.waitForTimeout(2200);
  const launched = await page.evaluate(() => document.querySelector('.globe .push')?.getAttribute('class') ?? '');
  check(launched.includes('launched'), 'the push turns red when it marches', launched);
  const defend = await page.locator('[data-act="deploy"]').innerText();
  check(defend.trim() === 'DEFEND', 'the ground under attack offers DEFEND', defend);
  const facts = await page.locator('.cp-brief .cp-facts').first().innerText();
  check(/one all-out siege/.test(facts) && /stage 3/.test(facts), 'the briefing says what a defence is', facts);
  await globeShot(page, 'defence-3-arrow-launched.png');
  await page.screenshot({ path: join(out, 'defence-3-desk-launched.png') });

  // 4. The defence on a large city (nothing remembered).
  console.log('4. defence, large city');
  await page.evaluate((t) => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: t, dares: [], objectors: [] })), TARGET);
  await page.goto(`${URL0}?campaign=run&speed=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const large = await page.evaluate(() => {
    const b = window.broodfall;
    const s = b.summary();
    return { s, stage: b.coreStage() };
  });
  check(large.s.directive.kind === 'hold' && large.s.directive.waves === 1, 'a defence is one siege', JSON.stringify(large.s.directive));
  check(large.s.meat.war >= 200, 'it opens with a full larder', JSON.stringify(large.s.meat));
  check(large.s.districts >= 14, 'on a large city, grown before the run', `${large.s.districts} districts`);
  check(!large.stage?.art || large.stage.stage >= 3 || large.stage.want >= 3, 'the core is drawn at stage 3', JSON.stringify(large.stage));
  await page.screenshot({ path: join(out, 'defence-4-start-large.png') });

  // 5. The defence on a remembered board (grown in the page by the game's own sim, saved as a win would).
  console.log('5. defence, remembered board');
  await page.goto(`${URL0}?campaign=ship`);
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 30000 });
  const snap = await page.evaluate(async () => {
    const { Sim, DT } = await import('/src/sim/sim.ts');
    const { Autoplayer } = await import('/src/sim/autoplayer.ts');
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 21, directive: { kind: 'hold', waves: 12 }, organStage: true, startOrgans: ['gut', 'forge'] });
    const bot = new Autoplayer(22);
    for (let t = 0; t < 20000 && sim.outcome === 'playing' && sim.wavesCleared < 7; t++) { bot.act(sim, DT); sim.tick(); }
    return sim.snapshot();
  });
  check(!!snap && snap.organs.length > 3, 'a board and its organs are remembered', `${snap?.organs.length} organs, ${snap?.slots.length} districts`);
  await campaignWith(page, { underAttack: TARGET, attackFrom: FROM, boards: { [TARGET]: snap } });
  await page.evaluate((t) => localStorage.setItem('broodfall-campaign-pending', JSON.stringify({ territory: t, dares: [], objectors: [] })), TARGET);
  await page.goto(`${URL0}?campaign=run&speed=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const remembered = await page.evaluate(() => window.broodfall.summary());
  check(remembered.districts === snap.slots.length, 'the defence opens on the remembered city', `${remembered.districts} districts`);
  check(remembered.organs.length === snap.organs.length, 'with the organs where he grew them', `${remembered.organs.length} organs`);
  await page.screenshot({ path: join(out, 'defence-5-start-remembered.png') });

  // 6. An old save: launched with no warning is staged again when it loads.
  console.log('6. old save');
  await campaignWith(page, { underAttack: TARGET, attackFrom: '__delete', staging: '__delete' });
  await openDesk(page);
  const pushNow = await page.evaluate(() => document.querySelector('.globe .push')?.getAttribute('class') ?? '');
  check(pushNow.includes('staging'), 'an old save is warned a deployment ahead (staged again)', pushNow);
  const attacked = await page.locator('.globe .site.attack').count();
  check(attacked === 0, 'the old save no longer has an unwarned attack', `${attacked} under attack`);

  check(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | '));
  await page.close();
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `${failures.length} check(s) FAILED: ${failures.join('; ')}` : 'all defence checks passed');
process.exit(failures.length ? 1 : 0);
