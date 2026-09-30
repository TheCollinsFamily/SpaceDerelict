/**
 * THE ART FIX PASS (Sep 30 2026, Collins: "fix up everything that needs fixing up"), items 5 and 6 as baked:
 * the seedling pod beats in four drawn frames (tools/art/templates/core.mjs podSprites, the game cycles them in
 * src/render/isoRender.ts), and every prop the pass took off the mirrored list has a drawn back
 * (tools/art/biomes.mjs `round: false`). Item 8 (a core idle over atlas pages) is held by tests/core-evo.test.ts; item 7
 * (flinch frames with a pole's stub left out) by the unit bake itself (tools/art/templates/unit.mjs).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { BIOMES, isRound } from '../tools/art/biomes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'public', 'art');
const file = join(ART, 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
type Rect = { w: number; h: number };

describe.skipIf(!manifest?.board?.terrain?.sheets?.creep)('the seedling pod', () => {
  it('has four frames of one size (rest, swelling, full, easing)', () => {
    const sprites: Record<string, Rect> = manifest.board.terrain.sheets.creep.sprites;
    const frames = ['seed-pod', 'seed-pod-1', 'seed-pod-2', 'seed-pod-3'].map((id) => sprites[id]);
    frames.forEach((f, i) => expect(f, `frame ${i}`).toBeTruthy());
    for (const f of frames) expect([f.w, f.h]).toEqual([frames[0].w, frames[0].h]);
  });
});

describe.skipIf(!manifest?.biomes)('props taken off the mirrored list', () => {
  const taken = (BIOMES as Array<{ id: string; roofProps?: Array<{ id: string; round?: boolean }>; streetProps?: Array<{ id: string; round?: boolean }> }>)
    .flatMap((b) => [...(b.roofProps ?? []), ...(b.streetProps ?? [])].filter((p) => p.round === false && !isRound(p)).map((p) => ({ set: b.id, id: p.id })));
  it('are there (the pass named eight)', () => expect(taken.length).toBeGreaterThanOrEqual(8));
  it('each has its back baked (prop-<id>~b in its set)', () => {
    for (const { set, id } of taken) {
      const data = JSON.parse(readFileSync(join(ART, manifest.biomes[set].data), 'utf8'));
      expect(data.sheets.props.sprites[`prop-${id}~b`], `${set}: prop-${id}~b`).toBeTruthy();
    }
  });
});
