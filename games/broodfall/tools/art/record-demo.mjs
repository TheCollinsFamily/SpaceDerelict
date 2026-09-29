/**
 * Record a probe demo page to a video file, frame by frame (no dropped frames).
 * The page must expose window.ready (a promise) and window.renderAt(seconds).
 *
 *   node tools/art/record-demo.mjs <demo.html> <out.mp4> [seconds=16] [fps=12]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ffmpeg } from './rfab.mjs';

const [page_, out, secs = '16', fps_ = '12'] = process.argv.slice(2);
if (!page_ || !out) { console.error('usage: node tools/art/record-demo.mjs <demo.html> <out.mp4> [seconds] [fps]'); process.exit(1); }
const seconds = Number(secs);
const fps = Number(fps_);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'broodfall-demo-'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.goto(pathToFileURL(path.resolve(page_)).href);
await page.evaluate(() => { window.manual = true; return window.ready; });
const canvas = page.locator('canvas');
for (let f = 0; f < seconds * fps; f++) {
  await page.evaluate((t) => window.renderAt(t), f / fps);
  await canvas.screenshot({ path: path.join(tmp, `f${String(f).padStart(4, '0')}.png`) });
}
await browser.close();
ffmpeg(['-framerate', String(fps), '-i', path.join(tmp, 'f%04d.png'), '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.resolve(out)], 'encode');
// Four moments side by side, to look at without playing the video.
ffmpeg(['-framerate', String(fps), '-i', path.join(tmp, 'f%04d.png'), '-vf', `select='not(mod(n\\,${Math.floor((seconds * fps) / 4)}))',scale=520:-2,tile=2x2`,
  '-frames:v', '1', path.resolve(out).replace(/\.mp4$/, '-moments.png')], 'moments');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`recorded ${seconds}s at ${fps} fps -> ${path.resolve(out)}`);
