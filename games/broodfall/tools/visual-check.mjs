/**
 * Machine visual verification (re-runnable): boots the built game in headless
 * chromium in demo mode, lets it play, then checks the sim state, the HUD, and
 * the rendered pixels PER REGION. Exits non-zero on any failure.
 *
 * Usage: npm run build && npm run test:visual
 * Artifacts: tools/screenshots/*.png
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });

const PORT = 5199;
const failures = [];
const pass = (name) => console.log(`  PASS  ${name}`);
const fail = (name, detail) => {
  failures.push(name);
  console.log(`  FAIL  ${name} — ${detail}`);
};

// ---------- helpers ----------

function startPreview() {
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], {
    cwd: root, stdio: 'pipe', shell: process.platform === 'win32',
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('localhost')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on('exit', (code) => reject(new Error(`vite preview exited early (${code})`)));
  });
}

/** Average color of a rect region in a PNG buffer. */
function regionAvg(png, x0, y0, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (png.width * y + x) * 4;
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

/** Count pixels in a region matching a predicate on (r,g,b). */
function regionCount(png, x0, y0, w, h, pred) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (png.width * y + x) * 4;
      if (pred(png.data[i], png.data[i + 1], png.data[i + 2])) n++;
    }
  }
  return n;
}

// ---------- main ----------

let server;
let browser;
try {
  server = await startPreview();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });

  const SEED = 42;
  await page.goto(`http://localhost:${PORT}/?auto=1&seed=${SEED}&speed=8&directive=hold`, { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas', { timeout: 15000 });
  pass('page boots and the canvas mounts');

  // Early screenshot: minute-zero board.
  await page.screenshot({ path: join(shots, '01-boot.png') });

  // Let the demo play ~2.5 sim minutes (8x speed).
  await page.waitForTimeout(20000);

  // --- sim state assertions (through the exposed handle) ---
  const state = await page.evaluate(() => {
    const s = window.broodfall.sim;
    return {
      time: s.time, outcome: s.outcome, towers: s.towers.length,
      organs: s.organs.length, biomass: s.biomass, waves: s.waveNumber,
      meat: s.meat, threat: s.threat, creepRadius: s.creepRadius,
      worldW: s.worldW, worldH: s.worldH,
    };
  });

  if (state.time > 60) pass(`sim advanced (t=${state.time.toFixed(0)}s)`);
  else fail('sim advanced', `t=${state.time.toFixed(0)}s after 20s at 8x`);
  if (state.towers > 0) pass(`autoplayer built towers (${state.towers})`);
  else fail('autoplayer built towers', 'zero towers');
  if (state.waves >= 1) pass(`waves ran (${state.waves})`);
  else fail('waves ran', 'no wave started');
  if (state.biomass > 50) pass(`biomass accrues (${state.biomass.toFixed(0)})`);
  else fail('biomass accrues', `only ${state.biomass.toFixed(0)}`);

  // --- HUD assertions ---
  const biomassText = await page.textContent('#biomass-text');
  if (/\d+ \/ \d+/.test(biomassText ?? '')) pass(`HUD biomass bar live ("${biomassText}")`);
  else fail('HUD biomass bar', `text was "${biomassText}"`);
  const waveInfo = await page.textContent('#wave-info');
  if (/WAVE [1-9]/.test(waveInfo ?? '')) pass(`HUD wave info live ("${waveInfo}")`);
  else fail('HUD wave info', `text was "${waveInfo}"`);
  const hand = await page.locator('#hand .card').count();
  if (hand === 4) pass('HUD hand shows 4 cards');
  else fail('HUD hand', `${hand} cards`);

  // --- per-region pixel checks on the canvas itself ---
  const canvas = page.locator('#stage canvas');
  const shot = await canvas.screenshot({ path: join(shots, '02-board.png') });
  const png = PNG.sync.read(shot);
  const cx = Math.floor(png.width / 2);
  const cy = Math.floor(png.height / 2);

  // Region 1: core (center) must be strongly red-dominant flesh.
  const core = regionAvg(png, cx - 12, cy - 12, 24, 24);
  if (core.r > core.g + 25 && core.r > core.b + 25 && core.r > 80) {
    pass(`core region is flesh (rgb ${core.r.toFixed(0)},${core.g.toFixed(0)},${core.b.toFixed(0)})`);
  } else {
    fail('core region', `rgb ${core.r.toFixed(0)},${core.g.toFixed(0)},${core.b.toFixed(0)}`);
  }

  // Region 2: creep ring (halfway to creep radius) must be redder than the far corner ground.
  const scale = png.width / state.worldW;
  const ringR = Math.floor(state.creepRadius * 0.6 * scale);
  const ring = regionAvg(png, cx + ringR - 8, cy - 8, 16, 16);
  const corner = regionAvg(png, 8, 8, 40, 40);
  if (ring.r - ring.g > (corner.r - corner.g) + 8) {
    pass(`creep ring redder than bare ground (Δ ${(ring.r - ring.g).toFixed(0)} vs ${(corner.r - corner.g).toFixed(0)})`);
  } else {
    fail('creep ring', `ring rgb ${ring.r.toFixed(0)},${ring.g.toFixed(0)},${ring.b.toFixed(0)} vs corner ${corner.r.toFixed(0)},${corner.g.toFixed(0)},${corner.b.toFixed(0)}`);
  }

  // Region 3: the board is not blank — enough non-background pixels overall.
  const lit = regionCount(png, 0, 0, png.width, png.height, (r, g, b) => r + g + b > 140);
  const litFrac = lit / (png.width * png.height);
  if (litFrac > 0.012) pass(`board has content (${(litFrac * 100).toFixed(1)}% lit pixels)`);
  else fail('board content', `only ${(litFrac * 100).toFixed(2)}% lit`);

  // Region 4: at least one tower drawn where the sim says one stands.
  const tower = await page.evaluate(() => {
    const t = window.broodfall.sim.towers[0];
    return t ? { x: t.pos.x, y: t.pos.y } : null;
  });
  if (tower) {
    const tx = Math.floor(tower.x * scale);
    const ty = Math.floor(tower.y * scale);
    const at = regionCount(png, Math.max(0, tx - 10), Math.max(0, ty - 10), 20, 20,
      (r, g, b) => r + g + b > 200);
    if (at > 12) pass(`tower rendered at its sim position (${at} bright px)`);
    else fail('tower rendered', `${at} bright px at (${tx},${ty})`);
  }

  // Late screenshot for the record.
  await page.waitForTimeout(8000);
  await page.screenshot({ path: join(shots, '03-late.png') });

  writeFileSync(join(shots, 'last-state.json'), JSON.stringify(state, null, 2));
} catch (err) {
  fail('harness', err.message);
} finally {
  await browser?.close();
  if (server) {
    if (process.platform === 'win32') {
      // shell:true means server.pid is the shell; kill the whole tree.
      const { execSync } = await import('node:child_process');
      try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    } else {
      server.kill();
    }
  }
}

console.log(failures.length === 0
  ? '\nVISUAL CHECK: all regions verified.'
  : `\nVISUAL CHECK FAILED: ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
