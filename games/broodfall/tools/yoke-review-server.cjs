/**
 * YOKE'S LINES, AS A PLAIN WEB PAGE ON THIS PC (Collins, Oct 16 2026: "make it an html and not a claude whatever", so
 * any Claude account, any browser, his phone on the wifi, can open it with no claude.ai sharing).
 *
 *   node tools/yoke-review-server.cjs          → http://localhost:8792/  (and http://<this PC's LAN address>:8792/)
 *
 * Serves notes/YOKE-LINES.html fresh on every load (re-run tools/yoke-lines.ts and reload, nothing to restart) and keeps
 * the review in notes/yoke-review.json, which every session reads straight off the disk:
 *   { version, edits: { <line id>: { id, cut, note, text: { <beat>: <words> }, base, at } },
 *     reviewed: { <line id>: { id, base, at } }, exports: { <id>: { at, page, n, items, text, applied? } } }
 * The page talks to it with GET /api/state and PUT|DELETE /api/doc/<edits|reviewed|exports>/<id>. Starts at every login
 * (tools/yoke-review-autostart.ps1). Port 8792; the Mudpuppy home server has 8791.
 */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'notes', 'YOKE-LINES.html');
const STORE = path.join(ROOT, 'notes', 'yoke-review.json');
const PORT = Number(process.env.YOKE_REVIEW_PORT || 8792);
const COLLS = ['edits', 'reviewed', 'exports'];

function load() {
  try { const j = JSON.parse(fs.readFileSync(STORE, 'utf8')); for (const c of COLLS) j[c] = j[c] || {}; j.version = j.version || 0; return j; }
  catch { return { version: 0, edits: {}, reviewed: {}, exports: {} }; }
}
function save(s) {
  const tmp = STORE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1) + '\n');
  fs.renameSync(tmp, STORE);
}
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    try { return send(res, 200, fs.readFileSync(PAGE), 'text/html; charset=utf-8'); }
    catch { return send(res, 500, 'notes/YOKE-LINES.html is missing: run npx vite-node tools/yoke-lines.ts', 'text/plain'); }
  }
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, load());
  // The baked films and their posters (the page's films part): public/media/scenes/<file>, with Range so a film seeks.
  // ...and YOKE's own scene clips (print a body): public/art/ship/yoke/scenes/<file>.webm.
  const media = url.pathname.match(/^\/media\/scenes\/([a-z0-9-]+\.(mp4|webp))$/) || url.pathname.match(/^\/art\/ship\/yoke\/scenes\/([a-z0-9-]+\.(webm))$/);
  if (req.method === 'GET' && media) {
    const file = url.pathname.startsWith('/art/') ? path.join(ROOT, 'public', 'art', 'ship', 'yoke', 'scenes', media[1]) : path.join(ROOT, 'public', 'media', 'scenes', media[1]);
    let size; try { size = fs.statSync(file).size; } catch { return send(res, 404, { error: 'not found' }); }
    const type = media[2] === 'mp4' ? 'video/mp4' : media[2] === 'webm' ? 'video/webm' : 'image/webp';
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (r && (r[1] || r[2])) {
      const start = r[1] ? Number(r[1]) : Math.max(0, size - Number(r[2])), end = r[1] && r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
      if (start >= size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    return fs.createReadStream(file).pipe(res);
  }
  const m = url.pathname.match(/^\/api\/doc\/(edits|reviewed|exports)\/([A-Za-z0-9_\-.~:@+]{1,200})$/);
  if (m && (req.method === 'PUT' || req.method === 'DELETE')) {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      const s = load();
      if (req.method === 'DELETE') delete s[m[1]][m[2]];
      else {
        let v; try { v = JSON.parse(body); } catch { return send(res, 400, { error: 'bad json' }); }
        if (!v || typeof v !== 'object' || Array.isArray(v)) return send(res, 400, { error: 'not an object' });
        s[m[1]][m[2]] = v;
      }
      s.version += 1;
      save(s);
      send(res, 200, { ok: true, version: s.version });
    });
    return;
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}/`);
  console.log(`YOKE's Lines: http://localhost:${PORT}/  ${lan.join('  ')}`);
  console.log(`review saved to ${STORE}`);
});
