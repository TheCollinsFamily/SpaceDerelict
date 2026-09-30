/**
 * promo/contact-sheet.jpg: every picture in promo/ on one sheet, labelled with its name and size.
 *   node tools/promo/contact-sheet.mjs [out.jpg] [folder ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROMO = path.join(ROOT, 'promo');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(PROMO, 'contact-sheet.jpg');
const folders = process.argv.slice(3).length ? process.argv.slice(3) : ['key-art', 'covers', 'posters', 'screenshots'];

const sizeOf = (f) => {
  const b = fs.readFileSync(f);
  if (b[0] === 0x89) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) { // JPEG: find the SOF marker
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
};

let body = '';
for (const dir of folders) {
  const full = path.join(PROMO, dir);
  if (!fs.existsSync(full)) continue;
  const files = fs.readdirSync(full).filter((f) => /\.(jpg|png)$/.test(f)).sort();
  if (!files.length) continue;
  body += `<h2>${dir}</h2><div class="grid">`;
  for (const f of files) {
    const [w, h] = sizeOf(path.join(full, f));
    const png = f.endsWith('.png');
    body += `<figure style="--r:${(w / h).toFixed(3)}"><div class="img ${png ? 'chk' : ''}"><img src="${pathToFileURL(path.join(full, f)).href}"></div><figcaption>${f} <b>${w}×${h}</b></figcaption></figure>`;
  }
  body += '</div>';
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:28px 34px;background:#121212;color:#e9dcc0;font:14px/1.3 "Courier New",monospace;width:1932px}
  h1{font:bold 34px Impact,sans-serif;letter-spacing:.06em;color:#ff6a2a;margin:0 0 6px}
  h2{font:bold 20px Impact,sans-serif;letter-spacing:.2em;text-transform:uppercase;margin:22px 0 10px;color:#f4e8c8;border-bottom:1px solid #444;padding-bottom:4px}
  .grid{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
  figure{margin:0;height:300px;width:calc(300px * var(--r));max-width:1900px}
  figure .img{height:270px;display:flex;align-items:center;justify-content:center}
  figure img{max-height:270px;max-width:100%;display:block;box-shadow:0 2px 8px #000}
  .chk{background:repeating-conic-gradient(#333 0 25%,#262626 0 50%) 0 0/20px 20px}
  figcaption{margin-top:6px;font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style></head><body><h1>BROODFALL — PROMO SET</h1>${body}</body></html>`;
const tmp = path.join(ROOT, 'art-src', 'promo-build', 'contact-sheet.html');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, html);
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await browser.newPage({ viewport: { width: 2000, height: 800 } });
await p.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
await p.screenshot({ path: out, type: 'jpeg', quality: 88, fullPage: true });
await browser.close();
console.log(`[contact] ${out}`);
