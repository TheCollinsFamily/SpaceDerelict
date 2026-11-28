/**
 * The one harness of the three browser checks: tools/input-check.mjs, tools/visual-check.mjs and
 * tools/endgame-check.mjs (Nov 26 2026). Bruno (Linux) and Collins (Windows) run the same check the same way, so a
 * result on one PC means the same thing on the other:
 *
 * - The same browser on every PC: Playwright's own Chromium, the build that the @playwright/test version in
 *   package-lock.json pins. No fallback to an installed Chrome, because another browser is another test. If it is
 *   not installed, the check stops and gives the command that installs it (tools/install-browser.mjs). On Linux it
 *   lives in ~/.local/share/ms-playwright, not in ~/.cache, because a cleanup deleted ~/.cache/ms-playwright twice
 *   (Nov 27 2026, Bruno: "download it again in a place that can't be deleted").
 * - The same launch: headless, no extra flags, on every OS.
 * - The same server: `vite preview` of the built game on BROODFALL_PORT (5199), started by node itself (no npx, no
 *   shell) and stopped as a whole process tree.
 * - Windows is the reference: its netstat/taskkill path is the one the checks always had. Off Windows, lsof (or
 *   fuser) and a process group do the same.
 *
 * Each check prints one SETUP line first (OS, node, Playwright, Chromium), so two runs can be compared.
 */
import { spawn, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browsersPath } from './browser-path.mjs';

// Where Playwright keeps its Chromium (tools/browser-path.mjs), set before Playwright loads: it reads the path once.
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath();
const { chromium } = await import('@playwright/test');

/** The port the built game is served on: its own for every session that runs beats at the same time. */
export const PORT = Number(process.env.BROODFALL_PORT || 5199);
/**
 * How long a check waits for the game's board to appear (Nov 26 2026): 18 to 22 s on a PC with no GPU and a game open
 * in another tab, against a 15 s limit that a fast PC met. The check goes on as soon as the board is there.
 */
export const BOOT_MS = 90000;
export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WINDOWS = process.platform === 'win32';

/** Stop whatever listens on PORT (a preview an earlier check left behind). */
export function freePort() {
  if (WINDOWS) {
    try {
      const out = execSync('netstat -ano', { encoding: 'utf8' });
      for (const line of out.split(String.fromCharCode(10))) {
        const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
        if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
      }
    } catch {}
    return;
  }
  let pids = [];
  try { pids = execSync(`lsof -ti tcp:${PORT} -sTCP:LISTEN`, { encoding: 'utf8' }).split(/\s+/).filter(Boolean); } catch {}
  if (pids.length) { for (const pid of pids) { try { process.kill(Number(pid), 'SIGKILL'); } catch {} } return; }
  try { execSync(`fuser -k ${PORT}/tcp`, { stdio: 'ignore' }); } catch {} // no lsof: fuser
}

/** `vite preview` of the built game (npm run build first), resolved once it serves. */
export function startPreview() {
  freePort();
  const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, 'preview'], { cwd: root, stdio: 'pipe', detached: !WINDOWS });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); }
    });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`vite preview exited early (${code}): is port ${PORT} taken, or is there no build?`)); });
  });
}

/** Stop the preview and everything it started. */
export function stopPreview(child) {
  if (!child) return;
  if (WINDOWS) {
    try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill(); } catch {} }
  }
  freePort();
}

/** Playwright's own Chromium, the same build and launch on every PC, after one SETUP line that names them. */
export async function launchBrowser() {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    if (/Executable doesn't exist/.test(err.message)) {
      throw new Error(`Playwright's Chromium is not installed in ${browsersPath()}. In games/broodfall run: node tools/install-browser.mjs (the same build on every PC; the checks use no other browser)`);
    }
    throw err;
  }
  const pw = JSON.parse(readFileSync(join(root, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8')).version;
  console.log(`  SETUP ${process.platform} ${process.arch} · node ${process.version} · playwright ${pw} · chromium ${browser.version()} · port ${PORT}`);
  return browser;
}
