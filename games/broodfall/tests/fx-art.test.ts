/**
 * THE EFFECTS AND THE LIMBS' OWN MOTIONS, as baked (Sep 30 2026): every picture the board asks
 * the effects sheet for is on it; every limb family has a donor part; every limb withers, has
 * graft points, and acts (an engine or support limb's acting clip) when its design says it does.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOWERS } from '../content/data';
import { FX_SPRITES } from '../src/render/fxNames';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { LIMBS } from '../tools/art/limbs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'public', 'art');
const file = join(ART, 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

describe.skipIf(!manifest?.fx)('the effects and the limbs\' own motions', () => {
  it('has every effect picture the board draws', () => {
    const sheet = manifest.fx.fx.effects;
    expect(existsSync(join(ART, sheet.atlas))).toBe(true);
    for (const id of FX_SPRITES) expect(sheet.sprites[id], `effect ${id}`).toBeTruthy();
    // Light is drawn added onto the board: the pictures made on black say so.
    for (const id of ['bolt-1', 'beam', 'flame-1', 'blast', 'poison-cloud']) expect(sheet.sprites[id].glow, `${id} is a glow`).toBe(true);
    for (const id of ['spit', 'harpoon', 'cannon-shell', 'dart', 'mortar-bomb']) expect(sheet.sprites[id].glow, `${id} is solid`).toBeFalsy();
  });

  it('has a donor part for every limb family, anchored at its stump', () => {
    const parts = manifest.fx.fx.parts;
    expect(existsSync(join(ART, parts.atlas))).toBe(true);
    for (const t of TOWERS) {
      const p = parts.sprites[`part-${t.family}`];
      expect(p, `part of ${t.family}`).toBeTruthy();
      expect(p.anchor[0]).toBeLessThan(0.3);
    }
  });

  it('every limb withers, and has points to graft a donor\'s parts on', () => {
    for (const t of TOWERS) {
      const l = manifest.limbs[t.family];
      expect(l, t.family).toBeTruthy();
      expect(l.anims.die, `${t.family} withers`).toBeTruthy();
      expect(l.anims.die.count).toBeGreaterThanOrEqual(6);
      if (!l.flat) expect((l.grafts ?? []).length, `${t.family} graft points`).toBeGreaterThanOrEqual(3);
      for (const [x, y] of l.grafts ?? []) {
        expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(1);
        expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(1);
      }
    }
  });

  it('every limb whose design has a firing or acting clip has it, from behind too', () => {
    for (const l of LIMBS as Array<{ family: string; fire: string | null; back?: string }>) {
      if (!l.fire) continue;
      const art = manifest.limbs[l.family];
      expect(art.anims.fire, `${l.family} acts`).toBeTruthy();
      if (l.back) expect(art.back?.anims.fire, `${l.family} acts, from behind`).toBeTruthy();
    }
  });
});
