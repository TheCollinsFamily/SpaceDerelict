/**
 * Broodfall as a desktop game (Collins, Oct 29 2026: no console window, no browser, and no BEGIN card:
 * "like a big boy game just going into the cinematic"). One window, full screen, black from the first
 * frame. The page is the built game, served by desktop/server.cjs on 127.0.0.1 (so saves keep one
 * origin, the films can seek, and /rfab-api works as under `npm start`). Sound may play before any
 * click, so the opening film starts at once (src/audio/engine.ts unlocks itself when it can).
 *
 * Run from the game folder (the desktop shortcut: node_modules\electron\dist\electron.exe <this folder>),
 * it builds the game first whenever src/, content/, public/, index.html or vite.config.ts changed since
 * its last build (dist-desktop/, about 5 s, no window of its own). A packaged game ships its build.
 *
 * Keys: F11 or Alt+Enter full screen on/off (remembered), Alt+F4 quits; Ctrl+Shift+I the inspector
 * (only when run from the game folder).
 */
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { startServer } = require('./server.cjs');

const GAME = path.join(__dirname, '..');
const PORT = 5197;
const OUT = 'dist-desktop';
const WATCHED = ['src', 'content', 'public', 'index.html', 'vite.config.ts'];

app.setName('Broodfall');
// A check's own saves (tools/shot-desktop.mjs): a first launch, without touching the player's.
if (process.env.BROODFALL_USER_DATA) app.setPath('userData', process.env.BROODFALL_USER_DATA);
app.setAppUserModelId('com.technopuritan.broodfall');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
Menu.setApplicationMenu(null);

if (!app.requestSingleInstanceLock()) app.quit();

const prefsFile = () => path.join(app.getPath('userData'), 'window.json');
const loadPrefs = () => { try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')); } catch { return {}; } };
const savePrefs = (p) => { try { fs.writeFileSync(prefsFile(), JSON.stringify(p)); } catch { /* not kept */ } };

/** The newest change under the watched sources, and how many files: a deletion changes the count. */
function sourceStamp() {
  let newest = 0, count = 0;
  const walk = (p) => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) { for (const e of fs.readdirSync(p)) walk(path.join(p, e)); return; }
    count++;
    if (st.mtimeMs > newest) newest = st.mtimeMs;
  };
  for (const w of WATCHED) walk(path.join(GAME, w));
  return `${Math.round(newest)}:${count}`;
}

/** vite build into dist-desktop/, on Electron's own Node, with no console window. */
function build() {
  return new Promise((resolve) => {
    const vite = path.join(GAME, 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [vite, 'build', '--logLevel', 'error'], {
      cwd: GAME, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', BROODFALL_DIST: OUT },
    });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => resolve({ ok: false, err: String(e) }));
    child.on('exit', (code) => resolve({ ok: code === 0, err }));
  });
}

/** The folder to serve: the shipped build, or a fresh one of the game folder. */
async function gameRoot(win) {
  if (app.isPackaged) return path.join(process.resourcesPath, 'game');
  const root = path.join(GAME, OUT);
  const stampFile = path.join(root, '.source-stamp');
  const want = sourceStamp();
  let have = '';
  try { have = fs.readFileSync(stampFile, 'utf8'); } catch { /* never built */ }
  if (have === want && fs.existsSync(path.join(root, 'index.html'))) return root;
  win.webContents.executeJavaScript("document.body.classList.add('building')").catch(() => {});
  const r = await build();
  if (r.ok) fs.writeFileSync(stampFile, want);
  else if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error(r.err || 'the build failed');
  return root;
}

const SPLASH = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><style>
  html,body{margin:0;height:100%;background:#000;color:#6b5a4a;font:600 13px/1 system-ui,sans-serif;letter-spacing:.3em;cursor:none}
  body{display:flex;align-items:flex-end;justify-content:flex-end}
  p{margin:28px 32px;opacity:0;transition:opacity .6s} .building p{opacity:.8} pre{white-space:pre-wrap;color:#c66;margin:32px;letter-spacing:0}
</style></head><body><p>PREPARING</p></body></html>`)}`;

async function open() {
  const prefs = loadPrefs();
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    fullscreen: prefs.fullscreen !== false, backgroundColor: '#000000', show: false,
    title: 'Broodfall', icon: path.join(GAME, 'broodfall.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  // Full screen is set again as it shows: on Windows a hidden window can come up windowed despite the option.
  win.once('ready-to-show', () => { if (prefs.fullscreen !== false) win.setFullScreen(true); win.show(); });
  win.on('page-title-updated', (e) => e.preventDefault());
  const setFull = (on) => { win.setFullScreen(on); savePrefs({ ...loadPrefs(), fullscreen: on }); };
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11' || (i.key === 'Enter' && i.alt)) { e.preventDefault(); setFull(!win.isFullScreen()); }
    else if (!app.isPackaged && i.control && i.shift && i.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
  });
  // Links out of the game (rfab.ai, the store) open in the player's own browser, never in this window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:`) && !url.startsWith('data:')) { e.preventDefault(); void shell.openExternal(url); }
  });
  ipcMain.on('bf-quit', () => app.quit());
  ipcMain.on('bf-fullscreen', () => setFull(!win.isFullScreen()));
  app.on('second-instance', () => { if (win.isMinimized()) win.restore(); win.focus(); });

  await win.loadURL(SPLASH);
  try {
    const root = await gameRoot(win);
    const port = await startServer(root, PORT);
    await win.loadURL(`http://127.0.0.1:${port}/`);
  } catch (e) {
    const msg = String(e && e.message || e).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
    await win.webContents.executeJavaScript(`document.body.innerHTML = '<pre>Broodfall could not start.\\n\\n' + ${JSON.stringify(msg)} + '</pre>'`).catch(() => {});
  }
}

app.whenReady().then(open);
app.on('window-all-closed', () => app.quit());
