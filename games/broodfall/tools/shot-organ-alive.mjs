/**
 * THE ORGAN STAGE ALIVE (Collins, Sep 30 2026: "should the organ screen have them alive? ... yeah").
 * In the real page (vite dev server on its own port, GPU on): a busy organ stage, every organ
 * that fits grown around the meteor, opened by the real button. Checks every placed organ cell
 * (and the meteor, and the dome above the street) plays its loop strip, organs in the tray stay
 * still, a freshly grown organ scans in first and then loops from its first frame, no page errors,
 * no "did not load" line. Measures the frame rate with the loops playing and with them stopped.
 *
 * Writes notes/screens/2026-09-30/organ-alive-stage.jpg (the panel), organ-alive-a.jpg /
 * organ-alive-b.jpg (the same close crop 0.6 s apart), organ-alive-core.jpg (the meteor), and
 * organ-alive.mp4 (about 10 s of the stage, real time, from screenshots with their own timings).
 *
 *   node tools/shot-organ-alive.mjs [--no-video]
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const screens = join(root, 'notes', 'screens', '2026-09-30');
const PORT = Number(process.env.BROODFALL_PORT || 5337);
const args = process.argv.slice(2);
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
function serve() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)));
  });
}
const jpg = (png, name) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', '3', join(screens, name)]);

const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const tmp = fs.mkdtempSync(join(tmpdir(), 'organ-alive-'));
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?seed=7&autostart=1&speed=0&biome=suburb`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForSelector('#stage canvas', { timeout: 60000 });
  // A busy stage: every organ that fits, over and over, around the meteor; the core at its third stage.
  const grown = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 99999; s.meat.science = 99999;
    s.cfg.organPool = undefined;
    s.stats.limbsGrown = 20;
    const ids = ['forge', 'venom', 'gut', 'nerve', 'lattice', 'womb', 'marrow', 'resonance', 'heart', 'brain', 'gland', 'atrophy',
      'bladder', 'pacemaker', 'budder', 'cyst', 'swell', 'catapult', 'runner', 'mire', 'acid', 'seeder', 'scaffold', 'root'];
    const u = s.under;
    for (let pass = 0; pass < 3; pass++) for (const id of ids) {
      if (pass && (id === 'heart' || id === 'brain')) continue;
      let done = false;
      for (let c = 0; c < u.cells.length && !done; c++) for (let r = 0; r < 4 && !done; r++) {
        if (s.canBuildOrgan(id, c, r) && s.issue({ kind: 'build-organ', organ: id, cell: c, rot: r }).ok) done = true;
      }
    }
    return { organs: s.organs.length, kinds: [...new Set(s.organs.map((o) => o.organ))] };
  });
  console.log(`  grew ${grown.organs} organs of ${grown.kinds.length} kinds: ${grown.kinds.join(', ')}`);
  await page.locator('#open-under').click();
  await page.waitForSelector('#under:not(.hidden)');
  await page.waitForFunction(() => document.querySelectorAll('#under-grid .uc.alive').length > 0, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => {
    const organCells = [...document.querySelectorAll('#under-grid .uc.has-organ')];
    const still = organCells.filter((c) => !c.classList.contains('alive')).map((c) => c.dataset.cell);
    const running = [...document.querySelectorAll('#under-grid .uc.alive')].filter((c) => c.getAnimations().some((a) => a.animationName === 'uloop' && a.playState === 'running')).length;
    const meteor = document.querySelector('#under-grid .meteor-img.alive');
    const dome = document.getElementById('under-dome');
    const trayAlive = document.querySelectorAll('#under-palette .alive').length;
    const strips = new Set([...document.querySelectorAll('#under .alive')].map((e) => getComputedStyle(e).backgroundImage));
    return {
      organCells: organCells.length, still, alive: document.querySelectorAll('#under-grid .uc.alive').length, running,
      meteor: !!meteor, meteorRunning: !!meteor?.getAnimations().some((a) => a.animationName === 'uloop'),
      dome: dome?.classList.contains('alive') ?? false, trayAlive, strips: strips.size,
      banner: /did not load/i.test(document.body.innerText),
    };
  });
  console.log(`  ${JSON.stringify(state)}`);
  check(state.organCells > 40 && state.still.length === 0, `every placed organ cell plays its loop (${state.organCells} organ cells, still: ${state.still.join(',') || 'none'})`);
  check(state.running === state.alive, `every alive cell's loop is running (${state.running}/${state.alive})`);
  check(state.meteor && state.meteorRunning && state.dome, 'the meteor below the street and its dome above play their stage loop');
  check(state.trayAlive === 0, 'the organs in the tray stay still');
  check(!state.banner, 'no "did not load" line');

  // Two frames of the same crop 0.6 s apart: the tissue moves.
  const grid = page.locator('#under-scanbox');
  await page.locator('#under').screenshot({ path: join(tmp, 'stage.png') });
  jpg(join(tmp, 'stage.png'), 'organ-alive-stage.jpg');
  await grid.screenshot({ path: join(tmp, 'a.png') });
  await page.waitForTimeout(600);
  await grid.screenshot({ path: join(tmp, 'b.png') });
  jpg(join(tmp, 'a.png'), 'organ-alive-a.jpg');
  jpg(join(tmp, 'b.png'), 'organ-alive-b.jpg');
  const a = fs.readFileSync(join(tmp, 'a.png')), b = fs.readFileSync(join(tmp, 'b.png'));
  check(!a.equals(b), 'the stage changes between two screenshots 0.6 s apart');
  const box = await page.evaluate(() => {
    const m = document.querySelector('#under-grid .meteor-img')?.getBoundingClientRect();
    const d = document.getElementById('under-dome')?.getBoundingClientRect();
    if (!m || !d) return null;
    const x = Math.min(m.left, d.left) - 20, y = d.top - 10;
    return { x, y, width: Math.max(m.right, d.right) + 20 - x, height: m.bottom + 10 - y };
  });
  if (box) { await page.screenshot({ path: join(tmp, 'core.png'), clip: box }); jpg(join(tmp, 'core.png'), 'organ-alive-core.jpg'); }

  // A freshly grown organ scans in first, then loops from its first frame.
  const fresh = await page.evaluate(() => {
    const s = window.broodfall.sim;
    for (const id of ['root', 'cyst', 'pacemaker', 'gland']) for (let c = 0; c < s.under.cells.length; c++) {
      if (s.canBuildOrgan(id, c, 0) && s.issue({ kind: 'build-organ', organ: id, cell: c, rot: 0 }).ok) return s.organs[s.organs.length - 1].cells[0];
    }
    return null;
  });
  if (fresh !== null) {
    await page.waitForTimeout(120);
    const during = await page.evaluate((c) => document.querySelector(`#under-grid [data-cell="${c}"]`)?.className ?? '', fresh);
    await page.waitForTimeout(1600);
    const after = await page.evaluate((c) => document.querySelector(`#under-grid [data-cell="${c}"]`)?.className ?? '', fresh);
    check(/scan-in/.test(during) && !/alive/.test(during) && /alive/.test(after), `a new organ scans in, then loops ("${during.match(/scan-in|alive/g)}" -> "${after.match(/scan-in|alive/g)}")`);
  } else console.log('  (no room left for a fresh organ: scan-in then loop not checked here)');

  // Frame rate: the loops playing, and the same stage with them stopped.
  const fps = (ms) => page.evaluate((ms) => new Promise((res) => {
    let n = 0; const t0 = performance.now(); const gaps = []; let last = t0;
    const tick = (t) => { n++; gaps.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(tick); else res({ fps: (n * 1000) / (t - t0), worst: Math.max(...gaps.slice(1)) }); };
    requestAnimationFrame(tick);
  }), ms);
  const on = await fps(5000);
  await page.addStyleTag({ content: '#under .alive { animation-play-state: paused !important; }', }).then((h) => h.evaluate((el) => { el.id = 'freeze-loops'; }));
  const off = await fps(5000);
  await page.evaluate(() => document.getElementById('freeze-loops')?.remove());
  console.log(`  FPS with the loops: ${on.fps.toFixed(1)} (worst frame ${on.worst.toFixed(0)} ms); loops stopped: ${off.fps.toFixed(1)} (worst ${off.worst.toFixed(0)} ms)`);
  check(on.fps >= 55 || on.fps >= off.fps - 3, 'the loops cost the page no visible frame rate');

  if (!args.includes('--no-video')) {
    // About 10 s of the stage in real time: screenshots as fast as they come, each held for as long as it was on screen.
    const shots = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 10500) {
      const f = join(tmp, `v-${String(shots.length).padStart(4, '0')}.png`);
      await page.locator('#under').screenshot({ path: f });
      shots.push({ f, t: Date.now() - t0 });
    }
    const list = shots.map((s, i) => `file '${s.f.replace(/\\/g, '/')}'\nduration ${(((shots[i + 1]?.t ?? s.t + 80) - s.t) / 1000).toFixed(3)}`).join('\n');
    fs.writeFileSync(join(tmp, 'list.txt'), `${list}\nfile '${shots[shots.length - 1].f.replace(/\\/g, '/')}'\n`);
    spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'),
      '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', join(screens, 'organ-alive.mp4')]);
    console.log(`  video: ${shots.length} screenshots over ${(shots[shots.length - 1].t / 1000).toFixed(1)} s (${(shots.length / (shots[shots.length - 1].t / 1000)).toFixed(1)} a second) -> ${join(screens, 'organ-alive.mp4')}`);
  }
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `ORGAN ALIVE: ${failed} failed` : 'ORGAN ALIVE: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
