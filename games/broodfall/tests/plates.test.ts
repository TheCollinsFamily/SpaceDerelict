import { describe, expect, it } from 'vitest';
import { PLATES, START_PLATE, platePool, validatePlate } from '../content/plates';
import { Rng } from '../src/sim/rng';
import { canPlace, createBoard, computeFlow, draftOffers, frontierGates, stampPlate } from '../src/sim/citymap';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { ENEMIES } from '../content/data';

describe('plate patterns', () => {
  it('start plate and every rotation of every plate validate', () => {
    expect(validatePlate(START_PLATE)).toBeNull();
    for (const p of platePool()) {
      expect(validatePlate(p)).toBeNull();
    }
    expect(platePool().length).toBe(PLATES.length * 4);
  });
});

describe('board growth', () => {
  it('drafts obey the connection algebra: openings mate with openings, never walls', () => {
    const rng = new Rng(99);
    const map = createBoard(5, 4, 7, rng, 2);
    let drafted = 0;
    for (let d = 0; d < 6; d++) {
      const offers = draftOffers(map, rng, 3);
      if (offers.length === 0) break; // growth can legitimately wall itself in
      // Every offer must be legal by the algebra before we take it.
      for (const o of offers) expect(canPlace(map, o.pattern, o.slot)).toBeNull();
      stampPlate(map, offers[0].pattern, offers[0].slot, offers[0].feature, rng);
      drafted++;
    }
    expect(drafted).toBeGreaterThanOrEqual(3);
    expect(map.slots.filter(Boolean).length).toBe(3 + drafted); // crash + 2 connectors + drafts
    // Even when growth caps, the hive must still have a way in.
    expect(frontierGates(map).length).toBeGreaterThan(0);

    // Invariant sweep: no active plate's opening faces an active wall.
    type Edge = 'n' | 's' | 'e' | 'w';
    const OPP: Record<Edge, Edge> = { n: 's', s: 'n', e: 'w', w: 'e' };
    const at = (sx: number, sy: number) => (sx < 0 || sy < 0 || sx >= map.slotsX || sy >= map.slotsY)
      ? null : map.slots[sy * map.slotsX + sx];
    for (let sy = 0; sy < map.slotsY; sy++) {
      for (let sx = 0; sx < map.slotsX; sx++) {
        const inst = at(sx, sy);
        if (!inst) continue;
        const dirs = { n: at(sx, sy - 1), s: at(sx, sy + 1), e: at(sx + 1, sy), w: at(sx - 1, sy) };
        for (const edge of ['n', 's', 'e', 'w'] as Edge[]) {
          const nb = dirs[edge];
          if (!nb) continue;
          expect(inst.pattern.ports[edge]).toBe(nb.pattern.ports[OPP[edge]]);
        }
      }
    }

    const flow = computeFlow(map, map.coreCell, () => 0);
    for (const g of frontierGates(map)) {
      expect(Number.isFinite(flow.dist[g])).toBe(true);
    }
  });

  it('a full autoplayed run drafts districts and the board grows', () => {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 5, directive: { kind: 'hold', waves: 12 } });
    const auto = new Autoplayer(6);
    let ticks = 0;
    while (sim.outcome === 'playing' && ticks < 24000) {
      auto.act(sim, DT);
      sim.tick();
      sim.takeEvents();
      ticks++;
    }
    expect(sim.map.slots.filter(Boolean).length).toBeGreaterThan(2);
    expect(sim.outcome).not.toBe('playing');
  });
});

describe('wave rhythm', () => {
  it('waves are discrete: no war-caste spawns during growth, real quiet between waves', () => {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 8, directive: { kind: 'hold', waves: 12 } });
    const auto = new Autoplayer(9);
    let ticks = 0;
    let violations = 0;
    let lastCount = 0;
    while (sim.outcome === 'playing' && ticks < 24000) {
      auto.act(sim, DT);
      sim.tick();
      sim.takeEvents();
      // Science-caste visitors (researchers, thieves) may wander in any time;
      // the discreteness rule is about war-caste ARRIVALS. Skitterlings are
      // excluded: they are born when a gravid husk (already on the field after a
      // siege timeout) dies — children of an existing body, not a new arrival.
      const warCount = sim.enemies.filter(
        (e) => e.kind !== 'skitterling' && ENEMIES.find((s) => s.kind === e.kind)!.caste === 'war',
      ).length;
      if (sim.phase === 'growth' && warCount > lastCount) violations++;
      lastCount = warCount;
      ticks++;
    }
    expect(violations).toBe(0);
  });
});
