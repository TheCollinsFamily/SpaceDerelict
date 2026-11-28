/**
 * Installs the one browser the checks use (Playwright's Chromium, the build package-lock.json pins) in the place the
 * checks look for it (tools/browser-path.mjs). Run it from games/broodfall: node tools/install-browser.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browsersPath } from './browser-path.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath() };
console.log(`Installing Playwright's Chromium in ${env.PLAYWRIGHT_BROWSERS_PATH}`);
const r = spawnSync(process.execPath, [cli, 'install', 'chromium'], { cwd: root, env, stdio: 'inherit' });
process.exit(r.status ?? 1);
