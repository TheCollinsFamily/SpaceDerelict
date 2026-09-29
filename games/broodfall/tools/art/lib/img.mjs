/**
 * Raw image helpers for the art pipeline. ffmpeg decodes and encodes; pngjs writes PNG.
 * An image is { w, h, data } with data a Buffer of RGBA bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';

const MAX = 1024 * 1024 * 1024;

function run(bin, args, label) {
  const r = spawnSync(bin, args, { maxBuffer: MAX });
  if (r.status !== 0) throw new Error(`${label}: ${bin} failed: ${String(r.stderr).slice(-500)}`);
  return r;
}

export function probe(file) {
  const r = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], `probe ${file}`);
  const [w, h] = String(r.stdout).trim().split(',').map(Number);
  return { w, h };
}

/** One picture as RGBA, optionally scaled to w x h. */
export function readImage(file, size) {
  const { w, h } = size ?? probe(file);
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=lanczos`,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], `read ${file}`);
  return { w, h, data: r.stdout };
}

/**
 * Every frame of a clip as RGBA at `fps`. Frame 0 of a generated clip is the uploaded still
 * itself (its background is brighter than the clip's), so it is dropped.
 */
export function readFrames(clip, fps = 12) {
  const { w, h } = probe(clip);
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', clip,
    '-vf', `trim=start_frame=1,setpts=PTS-STARTPTS,fps=${fps}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], `frames ${clip}`);
  const size = w * h * 4;
  const n = Math.floor(r.stdout.length / size);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(r.stdout.subarray(i * size, (i + 1) * size));
  return { w, h, frames };
}

export function blank(w, h, rgba = [0, 0, 0, 0]) {
  const data = Buffer.alloc(w * h * 4);
  if (rgba.some((v) => v !== 0)) for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { w, h, data };
}

export function crop(img, x0, y0, w, h, fill = [0, 0, 0, 0]) {
  const out = blank(w, h, fill);
  for (let y = 0; y < h; y++) {
    const sy = y + y0;
    if (sy < 0 || sy >= img.h) continue;
    const sx0 = Math.max(0, x0);
    const sx1 = Math.min(img.w, x0 + w);
    if (sx1 <= sx0) continue;
    img.data.copy(out.data, (y * w + (sx0 - x0)) * 4, (sy * img.w + sx0) * 4, (sy * img.w + sx1) * 4);
  }
  return out;
}

/** Copy `src` into `dst` at (x, y), replacing what is there. */
export function paste(dst, src, x, y) {
  for (let r = 0; r < src.h; r++) {
    const dy = y + r;
    if (dy < 0 || dy >= dst.h) continue;
    const x0 = Math.max(0, -x);
    const x1 = Math.min(src.w, dst.w - x);
    if (x1 <= x0) continue;
    src.data.copy(dst.data, (dy * dst.w + x + x0) * 4, (r * src.w + x0) * 4, (r * src.w + x1) * 4);
  }
}

/** Alpha-blend `src` over `dst` at (x, y). */
export function over(dst, src, x, y) {
  for (let r = 0; r < src.h; r++) {
    const dy = y + r;
    if (dy < 0 || dy >= dst.h) continue;
    for (let c = 0; c < src.w; c++) {
      const dx = x + c;
      if (dx < 0 || dx >= dst.w) continue;
      const s = (r * src.w + c) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      const d = (dy * dst.w + dx) * 4;
      const da = dst.data[d + 3] / 255;
      const oa = a + da * (1 - a);
      for (let k = 0; k < 3; k++) dst.data[d + k] = Math.round((src.data[s + k] * a + dst.data[d + k] * da * (1 - a)) / (oa || 1));
      dst.data[d + 3] = Math.round(oa * 255);
    }
  }
}

/**
 * Shrink (or stretch) to w x h by area averaging on premultiplied alpha: edges stay clean
 * and no colour bleeds in from transparent pixels.
 */
export function resize(img, w, h) {
  const out = blank(w, h);
  const fx = img.w / w;
  const fy = img.h / h;
  for (let y = 0; y < h; y++) {
    const y0 = y * fy;
    const y1 = (y + 1) * fy;
    for (let x = 0; x < w; x++) {
      const x0 = x * fx;
      const x1 = (x + 1) * fx;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1) && sy < img.h; sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        for (let sx = Math.floor(x0); sx < Math.ceil(x1) && sx < img.w; sx++) {
          const wx = Math.min(sx + 1, x1) - Math.max(sx, x0);
          const wgt = wx * wy;
          const i = (sy * img.w + sx) * 4;
          const pa = img.data[i + 3] / 255;
          r += img.data[i] * pa * wgt; g += img.data[i + 1] * pa * wgt; b += img.data[i + 2] * pa * wgt;
          a += pa * wgt; area += wgt;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) { out.data[o] = Math.round(r / a); out.data[o + 1] = Math.round(g / a); out.data[o + 2] = Math.round(b / a); }
      out.data[o + 3] = Math.round((a / (area || 1)) * 255);
    }
  }
  return out;
}

export function flipX(img) {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    img.data.copy(out.data, (y * img.w + (img.w - 1 - x)) * 4, (y * img.w + x) * 4, (y * img.w + x + 1) * 4);
  }
  return out;
}

export function flipY(img) {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) img.data.copy(out.data, (img.h - 1 - y) * img.w * 4, y * img.w * 4, (y + 1) * img.w * 4);
  return out;
}

/** Bounding box of pixels with alpha above `min`, or null when there are none. */
export function bbox(img, min = 24) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > min) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

export function writePng(file, img) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const png = new PNG({ width: img.w, height: img.h });
  img.data.copy(png.data);
  fs.writeFileSync(file, PNG.sync.write(png));
  return file;
}

/** PNG to WebP with alpha. Lossy at `q` (0-100) by default; `lossless` for textures with hard edges. */
export function toWebp(png, webp, { q = 88, lossless = false } = {}) {
  fs.mkdirSync(path.dirname(webp), { recursive: true });
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-c:v', 'libwebp',
    ...(lossless ? ['-lossless', '1'] : ['-q:v', String(q)]), '-compression_level', '6', webp], `webp ${webp}`);
  return webp;
}

/** A picture for a person to look at: a JPEG, which every viewer opens and which is a tenth the size. */
export function writeJpg(file, img, q = 4) {
  const png = file.replace(/\.jpg$/, '.tmp.png');
  writePng(png, img);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-q:v', String(q), file], `jpg ${file}`);
  fs.rmSync(png);
  return file;
}

/** Median colour of the outer `band` pixels: the background of a picture on a flat colour. */
export function borderColour(img, band = 6) {
  const rs = [], gs = [], bs = [];
  const take = (x, y) => { const i = (y * img.w + x) * 4; rs.push(img.data[i]); gs.push(img.data[i + 1]); bs.push(img.data[i + 2]); };
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) {
    if (x < band || y < band || x >= img.w - band || y >= img.h - band) take(x, y);
  }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}
