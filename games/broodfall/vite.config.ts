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

export default defineConfig({
  base: './',
  server: { port: 5199, strictPort: false, proxy: { '/rfab-api': rfab } },  // players fall through to the next port; scripts use preview
  preview: { port: 5199, strictPort: true, proxy: { '/rfab-api': rfab } },
});
