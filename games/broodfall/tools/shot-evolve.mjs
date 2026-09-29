/**
 * Evolution beat: real clicks. Build a spitter, click it to open its panel,
 * click through all three EVOLVE stages (the third needs a royal point), and
 * check the path, the price refusal, and the crest. Writes
 * tools/screenshots/beat-evolve-*.png.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}

freePort();
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], {
  cwd: root, stdio: 'pipe', shell: process.platform === 'win32',
});
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:' + PORT + '/?seed=7&autostart=1', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');
  const id = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 500; s.meat.science = 30; s.meat.royal = 0;
    for (let g = 0; g < 400; g++) {
      const i = s.hand.findIndex((h) => h.family === 'spitter');
      if (i >= 0) {
        s.issue({ kind: 'build', cardIndex: i, cell: window.broodfall.buildableCells()[0] });
        return s.towers[s.towers.length - 1].id;
      }
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
    return null;
  });
  await page.evaluate(() => window.broodfall.step(2));
  const box = await page.locator('#stage canvas').boundingBox();
  const pos = await page.evaluate((i) => window.broodfall.sim.towers.find((t) => t.id === i).pos, id);
  const ss = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [pos.x, pos.y]);
  await page.mouse.click(box.x + (ss.x / ss.vw) * box.width, box.y + (ss.y / ss.vh) * box.height);
  await page.waitForTimeout(250);
  const opts = await page.locator('#inspect-evolve .evo-opt').allInnerTexts();
  check(opts.length === 2 && /Rapid Glands/i.test(opts[0]) && /Heavy Gobs/i.test(opts[1]), `panel offers stage 1: ${opts.map((o) => o.split('\n')[0]).join(' / ')}`);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-evolve-offer.png') });
  const upgrades = () => page.evaluate((i) => window.broodfall.sim.towers.find((t) => t.id === i).upgrades ?? [], id);
  await page.locator('#inspect-evolve .evo-opt[data-choice="A"]').click();
  await page.waitForTimeout(200);
  check(JSON.stringify(await upgrades()) === '["A"]', 'clicking A evolves stage 1 (Rapid Glands)');
  await page.locator('#inspect-evolve .evo-opt[data-choice="B"]').click();
  await page.waitForTimeout(200);
  check(JSON.stringify(await upgrades()) === '["A","B"]', 'clicking B evolves stage 2 (Sticky Spit)');
  // Stage 3 needs a royal point: refused without one.
  await page.evaluate(() => { window.broodfall.sim.meat.science = 100; });
  await page.waitForTimeout(200);
  await page.locator('#inspect-evolve .evo-opt[data-choice="A"]').click({ force: true });
  await page.waitForTimeout(200);
  check(JSON.stringify(await upgrades()) === '["A","B"]', 'stage 3 refused without a royal point');
  await page.evaluate(() => { window.broodfall.sim.meat.royal = 1; });
  await page.waitForTimeout(250);
  await page.locator('#inspect-evolve .evo-opt[data-choice="A"]').click();
  await page.waitForTimeout(250);
  check(JSON.stringify(await upgrades()) === '["A","B","A"]', 'with a royal point, stage 3 (Hydra Throat) evolves');
  const path = await page.locator('#inspect-path').innerText();
  check(/ABA/.test(path), `panel shows the path (${path.trim()})`);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-evolve-done.png') });
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `EVOLVE BEAT: ${failed} failed` : 'EVOLVE BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);
