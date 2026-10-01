/**
 * Cuts every limb's pictures out of its baked atlas as small WebP data URIs, for the decision sheet
 * (tools/codex/sheet.mjs): the first idle frame from in front, from behind (when drawn), the first and
 * a late firing frame, and each upgrade look from in front. In a headless browser (canvas), reading
 * public/art/ through an intercepted address: nothing is fetched from anywhere else.
 *   import { cutThumbs } from './thumbs.mjs'; await cutThumbs(manifestLimbs) -> { [family]: { front, back, fire, looks: { key: url } } }
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function cutThumbs(limbs, size = 168, lookSize = 112) {
  const jobs = [];
  for (const [family, a] of Object.entries(limbs)) {
    jobs.push({ family, key: 'front', atlas: a.atlas, frame: a.frame, cols: a.cols, f: a.anims.idle.start, size });
    if (a.back) jobs.push({ family, key: 'back', atlas: a.atlas, frame: a.frame, cols: a.cols, f: a.back.anims.idle.start, size });
    if (a.anims.fire) jobs.push({ family, key: 'fire', atlas: a.atlas, frame: a.frame, cols: a.cols, f: a.anims.fire.start + Math.floor(a.anims.fire.count * 0.5), size });
    for (const [k, v] of Object.entries(a.variants ?? {})) jobs.push({ family, key: `look:${k}`, atlas: v.atlas, frame: v.frame, cols: v.cols, f: v.anims.idle.start, size: lookSize });
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // The page is served from the same address as the atlases, so the canvas is not tainted.
    await page.route('http://art.local/**', (r) => {
      if (r.request().url().endsWith('/index.html')) return r.fulfill({ body: '<canvas id="c"></canvas>', contentType: 'text/html' });
      const file = join(root, 'public', 'art', decodeURIComponent(new URL(r.request().url()).pathname.slice(1)));
      return r.fulfill({ body: readFileSync(file), contentType: 'image/webp' });
    });
    await page.goto('http://art.local/index.html');
    const out = await page.evaluate(async (jobs) => {
      const imgs = new Map();
      const load = (src) => imgs.get(src) ?? imgs.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `http://art.local/${src}`; })).get(src);
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      const res = {};
      for (const j of jobs) {
        const img = await load(j.atlas);
        c.width = j.size; c.height = j.size;
        g.clearRect(0, 0, j.size, j.size);
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, (j.f % j.cols) * j.frame, Math.floor(j.f / j.cols) * j.frame, j.frame, j.frame, 0, 0, j.size, j.size);
        const r = (res[j.family] ??= { looks: {} });
        const url = c.toDataURL('image/webp', 0.82);
        if (j.key.startsWith('look:')) r.looks[j.key.slice(5)] = url; else r[j.key] = url;
      }
      return res;
    }, jobs);
    return out;
  } finally {
    await browser.close();
  }
}
