import { defineConfig, type ProxyOptions } from 'vite';

/**
 * /rfab-api → rfab.ai, for YOKE (the ship AI on Kimi K2.6, POST /api/broodfall/ship-ai).
 * Server-side, so there is no CORS to clear, and the launcher's RFAB_API_KEY (a user env
 * var on Collins's PC) is added when the page sent no key of its own — the key never
 * reaches the page. RFAB_API_BASE points it at a local backend; RFAB_API_BEARER (a JWT)
 * authenticates there when the local DB has no copy of the key.
 *
 * A PLAYER never goes through this: the proxy exists only in `npm start` / `npm run preview`,
 * a built game talks to https://api.rfab.ai with its own player token (src/meta/storage.ts
 * DEFAULT_YOKE), and a request that carries a player token is passed on without the key.
 */
const rfab: ProxyOptions = {
  target: process.env.RFAB_API_BASE || 'https://api.rfab.ai',
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/rfab-api/, ''),
  /**
   * A beat (a headless browser) does not make a real player on the LIVE rfab.ai (Oct 4 2026).
   * rfab.ai lets one network make three new players a day; every beat that opened the ship's AI
   * Core in a fresh browser made one, so by the afternoon this PC's own game was refused. The
   * proxy answers the beat itself (429: the game then asks nothing more and the scripted YOKE
   * answers). Not when RFAB_API_BASE points the proxy at a local backend, and not when the beat
   * is meant to talk to the live YOKE: BROODFALL_BEAT_LIVE=1.
   */
  bypass: (req, res) => {
    if (process.env.RFAB_API_BASE || process.env.BROODFALL_BEAT_LIVE || !res) return undefined;
    const path = (req.url ?? '').split('?')[0];
    if (req.method !== 'POST' || !/\/api\/broodfall\/yoke\/players$/.test(path)) return undefined;
    if (!/HeadlessChrome/i.test(String(req.headers['user-agent'] ?? ''))) return undefined;
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, code: 'BEAT_NO_PLAYER', error: 'A beat makes no player on the live rfab.ai (set BROODFALL_BEAT_LIVE=1 to make one).' }));
    return req.url;   // answered here: Vite sees the response ended and neither proxies nor serves it
  },
  configure: (proxy) => {
    proxy.on('proxyReq', (req) => {
      req.removeHeader('origin');
      req.removeHeader('referer');
      // A player's own credential (Sep 30 2026): his token pays through the house allowance or his
      // linked account, and this PC's key must not ride along with it.
      if (req.getHeader('x-api-key') || req.getHeader('authorization') || req.getHeader('x-broodfall-player')) return;
      if (process.env.RFAB_API_BEARER) req.setHeader('authorization', `Bearer ${process.env.RFAB_API_BEARER}`);
      else if (process.env.RFAB_API_KEY) req.setHeader('x-api-key', process.env.RFAB_API_KEY);
    });
  },
};

/**
 * Several sessions work in this folder at once. Each that runs browser beats sets its own
 * port and its own build folder, so that none serves, rebuilds or kills another's game:
 *   BROODFALL_PORT=5211 BROODFALL_DIST=dist-ship npm run build
 *   BROODFALL_PORT=5211 BROODFALL_DIST=dist-ship node tools/shot-ship.mjs
 * Unset, they are 5199 and dist: what Collins runs.
 */
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const DIST = process.env.BROODFALL_DIST || 'dist';

export default defineConfig({
  base: './',
  // The dev server scans only the game's own page for its dependencies: left to itself it also crawls
  // every dist-*/ build folder the sessions leave here (each a full bundle), and the first page load
  // took over a minute (Sep 30 2026, interface fix pass).
  optimizeDeps: { entries: ['index.html'] },
  build: { outDir: DIST },
  // BROODFALL_NO_HMR=1: a beat on the dev server is not reloaded when another session saves a file mid-beat.
  server: {
    port: PORT, strictPort: false, proxy: { '/rfab-api': rfab }, hmr: process.env.BROODFALL_NO_HMR ? false : undefined,
    // Not watched: the raw art, the build folders, the notes' pictures and films (tens of thousands of files;
    // crawling them kept the dev server from answering for a minute).
    watch: { ignored: ['**/art-src/**', '**/dist/**', '**/dist-*/**', '**/notes/**', '**/promo/**', '**/references/**', '**/tools/screenshots/**'] },
  },  // players fall through to the next port; scripts use preview
  preview: { port: PORT, strictPort: true, proxy: { '/rfab-api': rfab } },
});
