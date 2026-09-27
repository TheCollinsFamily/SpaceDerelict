/**
 * Screenshot beat for directional/effect limbs: a built skipping mortar (field of
 * fire), a conduit mid-placement (preview: lane, gather ring, source/target links)
 * and a selected ward (covered limbs). Writes tools/screenshots/beat-effects.png.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
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
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5199/?seed=7&autostart=1', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');
  // Build a small cluster: guns, a skipper, a ward — then hold a conduit card.
  const setup = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 5000; s.meat.science = 5000;
    const cells = [];
    for (let c = 0; c < s.map.cells.length && cells.length < 40; c++) if (s.canBuildTower(c)) cells.push(c);
    const want = ['spitter', 'lasher', 'skipper', 'ward', 'spitter'];
    let k = 0;
    for (const fam of want) {
      for (let g = 0; g < 400; g++) {
        const i = s.hand.findIndex((h) => h.family === fam);
        if (i >= 0) { s.issue({ kind: 'build', cardIndex: i, cell: cells[k * 3] }); k++; break; }
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
    }
    for (let g = 0; g < 400; g++) {
      const i = s.hand.findIndex((h) => h.family === 'conduit');
      if (i >= 0) return { conduitCard: i, spot: s.cellCenter(cells[7]) };
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
    return null;
  });
  await page.evaluate(() => window.broodfall.step(2));
  const box = await page.locator('#stage canvas').boundingBox();
  // Open the skipper's panel so its field of fire draws.
  const skip = await page.evaluate(() => window.broodfall.sim.towers.find((t) => t.family === 'skipper').pos);
  const ss = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [skip.x, skip.y]);
  await page.mouse.click(box.x + (ss.x / ss.vw) * box.width, box.y + (ss.y / ss.vh) * box.height);
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-fieldoffire.png') });
  // Now hold the conduit card and hover a spot: the placement preview.
  await page.keyboard.press('Escape');
  await page.locator('#hand .card').nth(setup.conduitCard).click();
  const cs = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [setup.spot.x, setup.spot.y]);
  await page.mouse.move(box.x + (cs.x / cs.vw) * box.width, box.y + (cs.y / cs.vh) * box.height);
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(here, 'screenshots', 'beat-conduit-preview.png') });
  console.log(errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
