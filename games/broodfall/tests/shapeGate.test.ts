/**
 * THE FOOTPRINT GATE (tools/art/lib/shapeGate.mjs; Oct 2 2026, Collins: "some of these won't remotely fit the shape
 * they need to; how was this not caught?"). On drawn slabs of every shape it passes the right footprint and fails a
 * wrong one; and every picture of a limb drawn over its ground plate that is IN THE GAME passed it
 * (notes/art-review/limbs/gate.json, written by tools/art/gate-shapes.mjs).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { drawPlate } from '../tools/art/lib/plate.mjs';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { gateFull } from '../tools/art/lib/shapeGate.mjs';

/** A slab drawn as a keyed picture: the key colour transparent. */
function slab(shape: string, facing: string) {
  const p = drawPlate(shape, facing, { key: [0, 255, 0], slab: true });
  const d = p.img.data as Buffer;
  for (let i = 0; i < d.length; i += 4) if (d[i] === 0 && d[i + 1] === 255 && d[i + 2] === 0) d[i + 3] = 0;
  return p.img;
}

describe('the footprint gate', () => {
  it('passes a slab of the right footprint, every shape and facing', () => {
    for (const shape of ['line3', 'T', 'L3', 'L4']) for (const f of ['S', 'E', 'N', 'W']) {
      expect(gateFull(slab(shape, f), shape, f).pass, `${shape} ${f}`).toBe(true);
    }
  });

  it('fails a slab of the wrong footprint (a T drawn as a line or a square, an L turned)', () => {
    expect(gateFull(slab('line3', 'E'), 'T', 'S').pass).toBe(false);
    expect(gateFull(slab('sq2', 'S'), 'T', 'S').pass).toBe(false);
    expect(gateFull(slab('L4', 'E'), 'L4', 'S').pass).toBe(false);
    expect(gateFull(slab('L3', 'S'), 'L4', 'S').pass).toBe(false);
  });

  it('every view of every limb drawn over its plate that is in the game passed it', () => {
    const file = join(__dirname, '..', 'notes', 'art-review', 'limbs', 'gate.json');
    const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'art', 'manifest.json'), 'utf8'));
    if (!existsSync(file)) return;
    const gate = JSON.parse(readFileSync(file, 'utf8'));
    for (const [family, pics] of Object.entries(gate as Record<string, Record<string, { pass: boolean }>>)) {
      const looks = Object.keys(manifest.limbs[family]?.variants ?? {});
      for (const [name, r] of Object.entries(pics)) {
        const [key] = name.split(' ');
        const inGame = key === 'base' || looks.includes(key.replace('-', '+'));
        if (inGame) expect(r.pass, `${family} ${name}`).toBe(true);
      }
    }
  });
});
