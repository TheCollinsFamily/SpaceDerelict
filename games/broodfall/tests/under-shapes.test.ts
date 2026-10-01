/**
 * THE ORGANS ALIVE AS WHOLE SHAPES (Oct 1 2026, Collins: "it animated it by square, not by organ ... It
 * needed to animate the organs in their full shape, then cut them out so they could work on the square
 * grid"). Every organ of several cells has one picture and one loop of the whole organ
 * (tools/art/templates/under-shapes.mjs), drawn for the shape the game gives it, cut into its cells.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ORGAN_DEFS } from '../content/underground';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { SHAPES } from '../tools/art/templates/under-shapes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'public', 'art');
const file = join(ART, 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const multi = ORGAN_DEFS.filter((d) => d.shape.length > 1);

describe('organ shapes in the art', () => {
  it('every organ of more than one cell has a whole-shape picture and loop, for the shape the game gives it', () => {
    expect(Object.keys(SHAPES).sort()).toEqual(multi.map((d) => d.id).sort());
    for (const d of multi) expect(SHAPES[d.id].shape, d.id).toEqual(d.shape.map(([x, y]) => [x, y]));
  });
});

describe.skipIf(!manifest?.under?.shapes)('organ shapes, as baked', () => {
  const sh = manifest.under.shapes;
  it('each is baked for the shape the game gives it, its atlas and still on disk, the frames one cell apiece', () => {
    expect(Object.keys(sh.organs).sort()).toEqual(multi.map((d) => d.id).sort());
    const [cw, ch] = sh.cell;
    for (const d of multi) {
      const o = sh.organs[d.id];
      expect(o.shape, d.id).toEqual(d.shape.map(([x, y]) => [x, y]));
      const bw = Math.max(...d.shape.map((p) => p[0])) + 1, bh = Math.max(...d.shape.map((p) => p[1])) + 1;
      expect([o.fw, o.fh], d.id).toEqual([bw * cw, bh * ch]);
      expect(o.count, d.id).toBeGreaterThanOrEqual(24);
      expect(o.cols * o.fw, d.id).toBeLessThanOrEqual(16383);
      expect(existsSync(join(ART, o.atlas)), o.atlas).toBe(true);
      expect(existsSync(join(ART, o.still)), o.still).toBe(true);
    }
  });
  it('the single-cell organs, the deposits, the features and the meteor keep their own loops', () => {
    for (const d of ORGAN_DEFS.filter((x) => x.shape.length === 1)) expect(manifest.under.loops.tiles[d.id], d.id).toBeTruthy();
    expect(Object.keys(manifest.under.loops.stages).length).toBe(4);
  });
});
