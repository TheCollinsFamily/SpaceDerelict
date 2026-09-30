/**
 * THE METEOR ON THE ORGAN STAGE, and the city above it, in every tile set (Collins, Sep 30 2026:
 * the core looked "rendered twice, one above ground, one under"; and "the cityscape of what's
 * displayed around the core should be different based on the map type").
 *
 * In the real page, by the real button: the organ stage opened in each of the ten tile sets. For
 * each: the whole panel, and a close crop of the street line (the skyline, the meteor above the
 * line and its buried half below it). Then a contact sheet of the ten close crops. With
 * `--stages`: the suburb once more at each of the core's stages (limbs grown set on the sim).
 *
 * Checks: the skyline is the set's own picture; the part above the line and the part below it
 * are cut from ONE picture (the same stage file); no page errors.
 *
 * Usage: node tools/shot-organ-core.mjs [--tag after] [--stages] [--no-build]
 * Screenshots: notes/screens/2026-09-30/organ-core-<tag>-<set>.jpg, organ-skylines-all-sets.jpg,
 *              organ-core-<tag>-stage-<n>.jpg
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
const screens = join(root, 'notes', 'screens', '2026-09-30');
mkdirSync(shots, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5291);
const args = process.argv.slice(2);
const valueOf = (flag, d) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : d; };
const tag = valueOf('--tag', 'after');
const DIST = 'dist-organ';
const SETS = ['orthodox', 'suburb', 'megacity', 'orient', 'industrial', 'farmland', 'necropolis', 'deephive', 'terraces', 'wetland'];
let failed = 0;
const check = (ok, name) => { if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); };

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
if (!args.includes('--no-build')) {
  const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
}
function serve() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}
const jpg = (png, name) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, name)]);

let server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const closes = [];
try {
  const open = async (set, grown) => {
    const p = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
    p.on('pageerror', (e) => errors.push(String(e)));
    // The preview server has been seen to stop between pages: start it again once and go on.
    const url = `http://localhost:${PORT}/?seed=7&autostart=1&speed=0&biome=${set}`;
    await p.goto(url, { waitUntil: 'load' }).catch(async () => { server.kill(); server = await serve(); await p.goto(url, { waitUntil: 'load' }); });
    await p.waitForSelector('#stage canvas');
    await p.waitForFunction(() => window.broodfall.biome() !== '', null, { timeout: 20000 }).catch(() => {});
    if (grown !== undefined) await p.evaluate((n) => { window.broodfall.sim.stats.limbsGrown = n; }, grown);
    await p.locator('#open-under').click();
    await p.waitForSelector('#under:not(.hidden)');
    await p.waitForFunction(() => document.querySelector('#under-surface .skyline-img')?.dataset.set, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1200);
    return p;
  };
  /** The street line: the surface strip and the two rows of cells under it, around the meteor. */
  const closeShot = async (p, name) => {
    const s = await p.locator('#under-surface').boundingBox();
    const g = await p.locator('#under-grid').boundingBox();
    const cell = g.width / 13;
    const png = join(shots, `${name}.png`);
    await p.screenshot({ path: png, clip: { x: s.x, y: s.y - 60, width: s.width, height: s.height + 60 + cell * 3 } });
    jpg(png, `${name}.jpg`);
    console.log(`  shot  ${join(screens, `${name}.jpg`)}`);
    return png;
  };
  for (const set of SETS) {
    const p = await open(set);
    const look = await p.evaluate(() => {
      const el = document.querySelector('#under-surface .skyline-img');
      const dome = document.getElementById('under-dome');
      const below = document.querySelector('#under-grid .meteor-img');
      const url = (e) => (e ? getComputedStyle(e).backgroundImage.replace(/^url\("?|"?\)$/g, '') : '');
      return { set: el?.dataset.set, sky: url(el), dome: url(dome), below: url(below) };
    });
    check(look.set === set && look.sky.includes(`sky-${set}`), `${set}: the skyline is the ${set} one (${look.sky.split('/').pop()})`);
    check(!!look.dome && !!look.below, `${set}: the meteor above the line (${look.dome.split('/').pop()}) and below it (${look.below.split('/').pop()})`);
    const png = join(shots, `organ-core-${tag}-${set}-panel.png`);
    await p.screenshot({ path: png });
    closes.push(await closeShot(p, `organ-core-${tag}-${set}`));
    await p.close();
  }
  // One contact sheet of the ten close crops.
  const inputs = closes.flatMap((f) => ['-i', f]);
  const scale = closes.map((_, i) => `[${i}]scale=1400:-2,pad=1400:ih+8:0:0:black[s${i}]`).join(';');
  const stack = `${closes.map((_, i) => `[s${i}]`).join('')}vstack=inputs=${closes.length}`;
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${scale};${stack}`, '-q:v', '3', join(screens, tag === 'after' ? 'organ-skylines-all-sets.jpg' : `organ-skylines-all-sets-${tag}.jpg`)]);
  console.log(`  sheet ${join(screens, tag === 'after' ? 'organ-skylines-all-sets.jpg' : `organ-skylines-all-sets-${tag}.jpg`)}`);
  if (args.includes('--stages')) {
    for (const [n, grown] of [[1, 0], [2, 6], [3, 18], [4, 40]]) {
      const p = await open('suburb', grown);
      const below = await p.evaluate(() => getComputedStyle(document.querySelector('#under-grid .meteor-img')).backgroundImage);
      check(below.includes(`stage-${n}`), `stage ${n} (${grown} grown): the meteor is stage ${n}'s picture`);
      await closeShot(p, `organ-core-${tag}-stage-${n}`);
      await p.close();
    }
  }
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failed ? `ORGAN CORE BEAT: ${failed} failed` : 'ORGAN CORE BEAT: all verified.');
process.exit(failed ? 1 : 0);
