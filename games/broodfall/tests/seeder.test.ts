/**
 * THE SEEDING GLAND (Collins, Sep 29 2026): "an organ that must be placed adjacent to the
 * surface and once every two turns you get a free low power tower, with the idea like it
 * shoots out."
 */
import { describe, expect, it } from 'vitest';
import { DT, Sim, towerSpec } from '../src/sim/sim';
import { ORGAN_BY_ID, SEEDLING_FLIGHT, SEEDLING_TURNS } from '../content/underground';
import type { SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234, organStage: true };

function grown(): Sim {
  const s = new Sim(CFG);
  for (let i = 0; i < 600; i++) s.tick();
  s.meat.war = 9999;
  s.meat.science = 9999;
  return s;
}

/** Every spot the organ could be grown at, and whether it touches the surface. */
function spots(s: Sim) {
  const out: Array<{ cell: number; rot: number; surface: boolean }> = [];
  for (let c = 0; c < s.under.cells.length; c++) {
    for (let rot = 0; rot < 4; rot++) {
      const cells = s.organFootprint('seeder', c, rot);
      if (!cells) continue;
      out.push({ cell: c, rot, surface: cells.some((x) => x < s.under.w) });
    }
  }
  return out;
}

describe('the seeding gland', () => {
  it('is an organ of the game that must touch the surface', () => {
    expect(ORGAN_BY_ID.seeder.name).toBe('Seeding Gland');
    expect(ORGAN_BY_ID.seeder.surface).toBe(true);
    expect(SEEDLING_TURNS).toBe(2);
  });

  it('can be grown only where one of its cells is in the top row', () => {
    const s = grown();
    const all = spots(s);
    const legal = all.filter((p) => s.canBuildOrgan('seeder', p.cell, p.rot));
    expect(legal.length).toBeGreaterThan(0);
    for (const p of legal) expect(p.surface).toBe(true);
    // Somewhere deeper it would fit by every other rule: it is refused there for the surface alone.
    const deep = all.filter((p) => !p.surface);
    expect(deep.length).toBeGreaterThan(0);
  });

  it('puts a free Seedling in the hand every two turns, and none without it', () => {
    const s = grown();
    const grow = s as unknown as { growSeedlings(): void };
    const count = () => s.hand.filter((c) => c.family === 'sprout').length;
    grow.growSeedlings();
    grow.growSeedlings();
    expect(count()).toBe(0);
    const spot = spots(s).find((p) => s.canBuildOrgan('seeder', p.cell, p.rot))!;
    expect(s.issue({ kind: 'build-organ', organ: 'seeder', cell: spot.cell, rot: spot.rot }).ok).toBe(true);
    grow.growSeedlings();
    expect(count()).toBe(0);
    grow.growSeedlings();
    expect(count()).toBe(1);
    const card = s.hand.find((c) => c.family === 'sprout')!;
    expect(card.free).toBe(true);
    grow.growSeedlings();
    grow.growSeedlings();
    expect(count()).toBe(2);
  });

  it('is a weak limb that is never drawn', () => {
    const sp = towerSpec('sprout');
    expect(sp.weight).toBe(0);
    // Weaker than the cheapest limb there is: it fires much slower (measured and tuned Sep 29 2026).
    const dps = (f: 'sprout' | 'spitter') => towerSpec(f).damage * towerSpec(f).rate;
    expect(dps('sprout')).toBeLessThan(0.7 * dps('spitter'));
    expect(sp.maxHp).toBeLessThanOrEqual(towerSpec('spitter').maxHp);
    expect(new Sim(CFG).drawWeights().sprout).toBe(0);
  });

  it('is shot up from the landing site to where it is placed, for nothing', () => {
    const s = grown();
    s.hand.push({ id: 99001, family: 'sprout', free: true });
    const i = s.hand.length - 1;
    const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, 'sprout'));
    const war = s.meat.war;
    expect(s.issue({ kind: 'build', cardIndex: i, cell }).ok).toBe(true);
    expect(s.meat.war).toBe(war);
    const t = s.towers[s.towers.length - 1];
    expect(t.family).toBe('sprout');
    const f = s.seedFlights.find((x) => x.towerId === t.id)!;
    expect(f).toBeDefined();
    expect(f.from).toEqual(s.core);
    expect(f.to).toEqual(t.pos);
    // It lands.
    for (let k = 0; k < Math.ceil(SEEDLING_FLIGHT / DT) + 2; k++) s.tick();
    expect(s.seedFlights.some((x) => x.towerId === t.id)).toBe(false);
    // A free card is not replaced: the hand is one shorter.
    expect(s.hand.some((c) => c.id === 99001)).toBe(false);
  });
});
