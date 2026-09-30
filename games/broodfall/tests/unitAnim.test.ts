/**
 * What a unit is seen doing (src/render/unitAnim.ts, Sep 30 2026): it flinches when a real blow
 * lands, not at every tick of poison, and not again before its cooldown; a braced gun plays its
 * shot when the sim fires; the consort salutes when he promotes. And the board only READS the
 * sim's units: they are frozen here, and any write would throw.
 */
import { describe, expect, it } from 'vitest';
import type { Clip, UnitArt } from '../src/render/art';
import { HIT_COOLDOWN, HIT_PLAY, choose, newFx, observe, skinOf } from '../src/render/unitAnim';
import type { Enemy } from '../src/sim/types';

const clip = (start: number, count = 8, fps = 12): Clip => ({ start, count, fps });
const five = (start: number) => ({ S: clip(start), SW: clip(start + 10), W: clip(start + 20), NW: clip(start + 30), N: clip(start + 40) });
const art: UnitArt = {
  atlas: 'x.webp', frame: 128, cols: 16, anchor: [0.5, 0.94], body: 0.4, flies: false,
  anims: { walk: five(0), attack: five(100), hit: five(200), braced: { SW: clip(300) }, special: five(400), states: { deployed: clip(500, 1, 1) } },
};
const unit = (over: Partial<Enemy> = {}): Enemy => ({ id: 1, kind: 'soldier', hp: 100, maxHp: 100, pos: { x: 0, y: 0 }, ...over }) as Enemy;
const as = (e: Enemy, over: Partial<Enemy>): Enemy => Object.freeze({ ...e, ...over }) as Enemy;
const pickOf = (fx: ReturnType<typeof newFx>, deployed = false) => choose(art, 'SW', fx, {
  walk: art.anims.walk.SW!, deployed: deployed ? art.anims.states!.deployed : undefined, phase: 0, attackT: 0, period: 1,
});

describe('what a unit is seen doing', () => {
  it('flinches when struck hard, and not again before its cooldown', () => {
    const e0 = Object.freeze(unit());
    const fx = newFx(e0, art);
    observe(fx, e0, 0.1, 'soldier', false);
    expect(pickOf(fx).clip).toBe(art.anims.walk.SW);
    observe(fx, as(e0, { hp: 80 }), 0.1, 'soldier', false);
    expect(pickOf(fx).clip).toBe(art.anims.hit!.SW);
    // Struck again at once: it goes on with the flinch it has, it does not start another.
    observe(fx, as(e0, { hp: 60 }), 0.1, 'soldier', false);
    expect(fx.hitT).toBeCloseTo(0.1);
    // The flinch ends; before the cooldown is over a new blow does not start one.
    observe(fx, as(e0, { hp: 60 }), HIT_PLAY, 'soldier', false);
    expect(pickOf(fx).clip).toBe(art.anims.walk.SW);
    observe(fx, as(e0, { hp: 40 }), 0.1, 'soldier', false);
    expect(fx.hitT).toBeGreaterThan(HIT_PLAY);
    observe(fx, as(e0, { hp: 40 }), HIT_COOLDOWN, 'soldier', false);
    expect(fx.hitT).toBeGreaterThan(HIT_PLAY);
    observe(fx, as(e0, { hp: 20 }), 0.1, 'soldier', false);
    expect(fx.hitT).toBe(0);
  });

  it('does not flinch at every small tick of poison, only when the ticks add up', () => {
    const e0 = Object.freeze(unit({ hp: 1000, maxHp: 1000 }));
    const fx = newFx(as(e0, { hp: 1000, maxHp: 1000 }), art);
    let hp = 1000;
    let flinches = 0;
    for (let i = 0; i < 20; i++) {
      hp -= 1;
      observe(fx, as(e0, { hp, maxHp: 1000 }), 0.1, 'soldier', false);
      if (fx.hitT === 0) flinches++;
    }
    expect(flinches).toBe(0);
  });

  it('chips the carapace lord\'s shell on every hit it eats, and walks in the skin of how broken it is', () => {
    const skins: UnitArt = { ...art, anims: { ...art.anims, 'walk-cracked': five(600), 'walk-stripped': five(700) } };
    const e0 = Object.freeze(unit({ kind: 'carapace', hitShield: 6 }));
    const fx = newFx(as(e0, { hitShield: 6 }), skins);
    observe(fx, as(e0, { hitShield: 5 }), 0.1, 'carapace', false);
    expect(fx.chipT).toBe(0);
    expect(fx.hitT).toBe(0);
    expect(skinOf(skins, as(e0, { hitShield: 6 }), 'SW', 6)).toBeUndefined();
    expect(skinOf(skins, as(e0, { hitShield: 3 }), 'SW', 6)).toBe(skins.anims['walk-cracked']!.SW);
    expect(skinOf(skins, as(e0, { hitShield: 0 }), 'SW', 6)).toBe(skins.anims['walk-stripped']!.SW);
  });

  it('shows a braced gun as its braced picture, and plays its shot when the sim fires', () => {
    const e0 = Object.freeze(unit({ kind: 'cannon', deployed: true, shotsFired: 0 }));
    const fx = newFx(as(e0, { deployed: false }), art);
    observe(fx, as(e0, { deployed: true, shotsFired: 0 }), 0.1, 'cannon', true);
    expect(fx.digT).toBe(0);
    expect(pickOf(fx, true).clip).toBe(art.anims.states!.deployed);
    observe(fx, as(e0, { deployed: true, shotsFired: 1 }), 0.1, 'cannon', true);
    expect(pickOf(fx, true).clip).toBe(art.anims.braced!.SW);
    observe(fx, as(e0, { deployed: true, shotsFired: 1 }), 2, 'cannon', true);
    expect(pickOf(fx, true).clip).toBe(art.anims.states!.deployed);
  });

  it('makes the consort salute when he promotes, and the royal command while she fights', () => {
    const c0 = Object.freeze(unit({ kind: 'consort', auxCooldown: 0.05 }));
    const fx = newFx(c0, art);
    observe(fx, as(c0, { auxCooldown: 5 }), 0.1, 'consort', false);
    expect(pickOf(fx).clip).toBe(art.anims.special!.SW);
    const r0 = Object.freeze(unit({ kind: 'royal' }));
    const rf = newFx(r0, art);
    observe(rf, r0, 1, 'royal', false);
    expect(rf.specialT).toBe(Infinity);
    observe(rf, r0, 3, 'royal', true);
    expect(rf.specialT).toBe(0);
  });
});
