import { defineConfig, type ProxyOptions } from 'vite';

/**
 * /rfab-api → rfab.ai, for YOKE (the ship AI on Kimi K2.6, POST /api/broodfall/ship-ai).
 * Server-side, so there is no CORS to clear, and the launcher's RFAB_API_KEY (a user env
 * var on Collins's PC) is added when the page sent no key of its own — the key never
 * reaches the page. RFAB_API_BASE points it at a local backend; RFAB_API_BEARER (a JWT)
 * authenticates there when the local DB has no copy of the key.
 */
const rfab: ProxyOptions = {
  target: process.env.RFAB_API_BASE || 'https://api.rfab.ai',
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/rfab-api/, ''),
  configure: (proxy) => {
    proxy.on('proxyReq', (req) => {
      req.removeHeader('origin');
      req.removeHeader('referer');
      if (req.getHeader('x-api-key') || req.getHeader('authorization')) return;
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
  build: { outDir: DIST },
  // BROODFALL_NO_HMR=1: a beat on the dev server is not reloaded when another session saves a file mid-beat.
  server: { port: PORT, strictPort: false, proxy: { '/rfab-api': rfab }, hmr: process.env.BROODFALL_NO_HMR ? false : undefined },  // players fall through to the next port; scripts use preview
  preview: { port: PORT, strictPort: true, proxy: { '/rfab-api': rfab } },
});
