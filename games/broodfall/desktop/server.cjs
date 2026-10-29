/**
 * The desktop game's own little web server (desktop/main.cjs): the built game from one folder, with
 * the byte ranges the films seek by, and /rfab-api passed on to rfab.ai the way the Vite proxy does
 * (vite.config.ts): origin and referer dropped, and this PC's RFAB_API_KEY added only to a request
 * that carries no player credential of its own. Only 127.0.0.1 hears it.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.vtt': 'text/vtt',
};

function proxy(req, res) {
  const target = new URL(process.env.RFAB_API_BASE || 'https://api.rfab.ai');
  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;
  if (!headers['x-api-key'] && !headers.authorization && !headers['x-broodfall-player']) {
    if (process.env.RFAB_API_BEARER) headers.authorization = `Bearer ${process.env.RFAB_API_BEARER}`;
    else if (process.env.RFAB_API_KEY) headers['x-api-key'] = process.env.RFAB_API_KEY;
  }
  const out = (target.protocol === 'http:' ? http : https).request({
    protocol: target.protocol, hostname: target.hostname, port: target.port || undefined,
    path: req.url.replace(/^\/rfab-api/, '') || '/', method: req.method, headers,
  }, (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); });
  out.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(out);
}

function serveFile(root, req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
  let file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) { file = path.join(file, 'index.html'); st = fs.existsSync(file) ? fs.statSync(file) : null; err = st ? null : err || new Error(); }
    if (err || !st) { res.writeHead(404); res.end(); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
      let end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

/** Serve `root` on the first free port from `port` up; resolves with the port it got. */
function startServer(root, port) {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/rfab-api/') || req.url === '/rfab-api') proxy(req, res);
    else serveFile(root, req, res);
  });
  return new Promise((resolve, reject) => {
    const tryPort = (p, left) => {
      server.once('error', (e) => (e.code === 'EADDRINUSE' && left > 0 ? tryPort(p + 1, left - 1) : reject(e)));
      server.listen(p, '127.0.0.1', () => resolve(p));
    };
    tryPort(port, 20);
  });
}

module.exports = { startServer };
