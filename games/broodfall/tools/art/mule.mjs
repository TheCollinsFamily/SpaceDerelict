/**
 * THE MULE SAC'S SCAN TILE AND LOOP (Oct 2 2026), made and baked for that one organ ALONE.
 *
 * Why not `make.mjs under` / `make.mjs underloops`: their bakes rebuild the whole tile and loop sets from every raw
 * file in art-src, and since the art-src loss on Oct 1 2026 some of those raws (the meteor among them) are not on
 * disk: a full bake would drop art the game has. This makes the Mule Sac's tile and loop (raw files in art-src-new,
 * never art-src), bakes them, and MERGES the two entries into the manifest, leaving every other entry as it was.
 *
 *   node tools/art/mule.mjs            make what is missing (a medium still ~$0.2, a 4 s 480p loop ~$0.25), then bake
 *   node tools/art/mule.mjs --bake     bake again (free)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
// New raw art goes to art-src-new (art-src is being restored; nothing new is written into it).
process.env.BROODFALL_ART_SRC ??= path.join(ROOT, 'art-src-new');

const { makeStill, makeClip } = await import('./rfab.mjs');
const { readImage, resize, writePng, toWebp } = await import('./lib/img.mjs');
const { ART, SRC, putEntry, readManifest } = await import('./lib/manifest.mjs');
const { TILES, REFS } = await import('./templates/under.mjs');
const { MOTION, prompt, loopFrames, matchStill, strip } = await import('./templates/under-loops.mjs');

const ID = 'mule';
const stillFile = path.join(SRC, 'under', `${ID}.png`);
const clipFile = path.join(SRC, 'under-loops', `${ID}.mp4`);
const OUT = path.join(ART, 'under');
const bakeOnly = process.argv.includes('--bake');

if (!bakeOnly) {
  fs.mkdirSync(path.dirname(stillFile), { recursive: true });
  fs.mkdirSync(path.dirname(clipFile), { recursive: true });
  if (!fs.existsSync(stillFile)) {
    const r = await makeStill({ slug: `scan tile ${ID}`, out: stillFile, prompt: TILES[ID], key: null, refFiles: REFS, width: 1024, height: 1024, quality: 'medium' });
    if (!fs.existsSync(stillFile)) throw new Error(`tile failed: ${String(r)}`);
  }
  if (!fs.existsSync(clipFile)) {
    const r = await makeClip({ slug: `scan loop ${ID}`, stillFile, out: clipFile, prompt: prompt(MOTION[ID]), raw: true, seconds: 4, resolution: '480p', aspect: '1:1', loop: true });
    if (!fs.existsSync(clipFile)) throw new Error(`loop failed: ${String(r)}`);
  }
}

// Bake the tile (as bakeUnder does, one tile) and merge it into under.scan.tiles.
fs.mkdirSync(OUT, { recursive: true });
const S = 160;
const tilePng = path.join(OUT, `${ID}.png`);
writePng(tilePng, resize(readImage(stillFile), S, S));
toWebp(tilePng, path.join(OUT, `${ID}.webp`), { q: 84 });
fs.rmSync(tilePng);
const under = readManifest().under ?? {};
putEntry('under', 'scan', { ...under.scan, tiles: { ...(under.scan?.tiles ?? {}), [ID]: `under/${ID}.webp` } });

// Bake the loop (as bakeUnderLoops does, one clip) and merge it into under.loops.tiles.
if (fs.existsSync(clipFile)) {
  const FRAME = 128;
  const l = loopFrames(clipFile);
  matchStill(l.frames, stillFile);
  const loopPng = path.join(OUT, `loop-${ID}.png`);
  writePng(loopPng, strip(l.frames, FRAME, FRAME));
  toWebp(loopPng, path.join(OUT, `loop-${ID}.webp`), { q: 80 });
  fs.rmSync(loopPng);
  const loops = readManifest().under?.loops ?? { fps: 12, frame: FRAME, tiles: {}, stages: {} };
  putEntry('under', 'loops', { ...loops, tiles: { ...loops.tiles, [ID]: { strip: `under/loop-${ID}.webp`, count: l.frames.length, ...(l.pingpong ? { pingpong: true } : {}) } } });
  console.log(`[mule] tile + loop baked (${l.frames.length} frames${l.pingpong ? ', ping-pong' : ''})`);
} else console.log('[mule] tile baked (no loop yet)');
