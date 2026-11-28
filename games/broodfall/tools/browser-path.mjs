/**
 * Where the browser checks keep Playwright's Chromium (Nov 27 2026). On Linux: ~/.local/share/ms-playwright, because
 * a cleanup deleted ~/.cache/ms-playwright twice in two days (Bruno: "download it again in a place that can't be
 * deleted"). On Windows and macOS: Playwright's own place (%LOCALAPPDATA%\ms-playwright, ~/Library/Caches/ms-playwright).
 * A PLAYWRIGHT_BROWSERS_PATH set by the player wins.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

export function browsersPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'ms-playwright');
  return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'ms-playwright');
}
