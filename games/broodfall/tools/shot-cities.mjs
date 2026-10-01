/**
 * Cities side by side (Oct 1 2026, Collins: "the cities felt a little samey"): every tile set
 * at the start of a run and grown into a city of several districts, a few seeds each, then one
 * contact sheet per moment so they can be compared at a glance.
 *
 * Usage: npm run build && node tools/shot-cities.mjs [label] [--sets a,b] [--seeds 1,2]
 * Artifacts: notes/screens/2026-10-01/cities-<label>-<moment>-sheet.jpg (and the single shots
 * under tools/screenshots/cities/).
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots', 'cities');
const out = join(root, 'notes', 'screens', '2026-10-01');
mkdirSync(shots, { recursive: true });
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 4173);

const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith('--')) ?? 'now';
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const manifest = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8'));
const sets = opt('--sets')?.split(',') ?? Object.keys(manifest.biomes ?? {}).sort();
const seeds = (opt('--seeds') ?? '7,42').split(',').map(Number);

function freePort() {
  try {
    const o = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of o.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
function startPreview() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite preview exited early (${code})`)));
  });
}

const server = await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const made = { start: [], grown: [] };
try {
  for (const id of sets) {
    for (const seed of seeds) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      await page.goto(`http://localhost:${PORT}/?auto=1&seed=${seed}&speed=0&biome=${id}`);
      await page.waitForFunction(() => window.broodfall !== undefined, null, { timeout: 30000 });
      const step = (n) => page.evaluate((k) => window.broodfall.step(k), n);
      await step(3);
      await page.waitForTimeout(700);
      const a = join(shots, `${label}-start-${id}-${seed}.png`);
      await page.locator('#stage canvas').screenshot({ path: a });
      made.start.push({ file: a, tag: `${id} ${seed}` });
      // Grow the city: five more districts drafted at once (window.broodfall.growCity), then three seconds of play.
      await page.evaluate((k) => window.broodfall.growCity(5, k), seed);
      await step(30);
      await page.addStyleTag({ content: '#banner { display: none !important; }' });
      await page.waitForTimeout(2500);
      const b = join(shots, `${label}-grown-${id}-${seed}.png`);
      await page.locator('#stage canvas').screenshot({ path: b });
      made.grown.push({ file: b, tag: `${id} ${seed}` });
      const d = await page.evaluate(() => window.broodfall.summary().districts);
      console.log(`${id} seed ${seed}: ${d} districts`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
  freePort();
}

// One sheet per moment: columns = seeds, rows = sets, each tile labelled.
for (const [moment, list] of Object.entries(made)) {
  if (!list.length) continue;
  const cols = seeds.length;
  const inputs = [];
  const filters = [];
  list.forEach((m, i) => {
    inputs.push('-i', m.file);
    filters.push(`[${i}:v]scale=600:400,drawtext=text='${m.tag}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`);
  });
  const layout = list.map((_, i) => `${(i % cols) * 600}_${Math.floor(i / cols) * 400}`).join('|');
  const fc = filters.join(';') + ';' + list.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${list.length}:layout=${layout}`;
  const file = join(out, `cities-${label}-${moment}-sheet.jpg`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', fc, '-frames:v', '1', '-q:v', '4', file]);
  if (r.status !== 0) console.error(String(r.stderr).slice(-400));
  else console.log(file);
}
