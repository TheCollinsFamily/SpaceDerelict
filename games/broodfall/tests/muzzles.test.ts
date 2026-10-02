/**
 * WHERE THE SHOTS LEAVE FROM (Sep 30 2026, Collins: "the shots aligning with coming from where the
 * art would indicate"). Every limb that fires something the game draws has a muzzle marked by eye on
 * its art (tools/art/limbs.mjs, tools/art/muzzles.mjs), baked into the manifest, and one for its view
 * from behind when it has one; the hive's guns have theirs (src/render/unitMuzzles.ts).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIRES_FROM, SHOT } from '../src/render/fxNames';
import { UNIT_MUZZLES } from '../src/render/unitMuzzles';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { FIRING, LIMBS } from '../tools/art/limbs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, '..', 'public', 'art', 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
type Mark = [number, number];
const inFrame = (m: Mark) => m.length === 2 && m.every((v) => v > -0.1 && v < 1.1);

describe('muzzles', () => {
  it('the art scripts and the board agree on which limbs fire', () => {
    expect([...FIRING].sort()).toEqual([...FIRES_FROM].sort());
    // Every limb with a shot picture fires from its muzzle.
    for (const f of Object.keys(SHOT)) expect(FIRES_FROM, f).toContain(f);
  });

  it('every firing family has a muzzle marked (and one for its view from behind)', () => {
    for (const f of FIRES_FROM) {
      const l = LIMBS.find((x: { family: string }) => x.family === f);
      expect(l, f).toBeTruthy();
      // A limb drawn over its ground plate (Oct 2 2026) has its muzzles found in its pictures, not marked: its baked ones are checked below.
      if (l.plate) continue;
      expect(l.muzzle?.length, `${f}: muzzle`).toBeGreaterThan(0);
      for (const m of l.muzzle) expect(inFrame(m), `${f}: ${m}`).toBe(true);
      if (l.back) {
        expect(l.backMuzzle?.length, `${f}: backMuzzle`).toBeGreaterThan(0);
        for (const m of l.backMuzzle) expect(inFrame(m), `${f} from behind: ${m}`).toBe(true);
      }
    }
  });

  it.skipIf(!manifest)('every firing family has its muzzle baked, above its foot', () => {
    for (const f of FIRES_FROM) {
      const e = manifest.limbs[f];
      expect(e?.muzzle?.length, `${f}: baked muzzle (node tools/art/make.mjs limb ${f} --bake)`).toBeGreaterThan(0);
      for (const m of e.muzzle as Mark[]) {
        expect(m.every((v) => v >= 0 && v <= 1), `${f}: ${m} inside its frame`).toBe(true);
        expect(m[1], `${f}: its muzzle is above where it stands`).toBeLessThan(e.anchor[1]);
      }
      if (e.back) {
        expect(e.back.muzzle?.length, `${f}: baked muzzle from behind`).toBeGreaterThan(0);
        for (const m of e.back.muzzle as Mark[]) expect(m[1], `${f} from behind`).toBeLessThan(e.back.anchor[1]);
      }
    }
  });

  it('the hive guns have their barrels marked', () => {
    expect(UNIT_MUZZLES.cannon.braced?.SW).toBeTruthy();
    expect(UNIT_MUZZLES.cannon.deployed?.SW).toBeTruthy();
    expect(UNIT_MUZZLES.dartgun.braced?.SW).toBeTruthy();
    expect(UNIT_MUZZLES.dartgun.deployed?.SW).toBeTruthy();
    for (const v of ['S', 'SW', 'W', 'NW', 'N'] as const) expect(UNIT_MUZZLES.mortar.attack?.[v], `mortar ${v}`).toBeTruthy();
  });
});
