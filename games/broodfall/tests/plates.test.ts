import { describe, expect, it } from 'vitest';
import { PLATES, START_PLATE, platePool, validatePlate } from '../content/plates';
import { Rng } from '../src/sim/rng';
import { createBoard, computeFlow, draftOffers, frontierGates, stampPlate } from '../src/sim/citymap';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';

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
  it('four scripted drafts keep every frontier gate connected to the core', () => {
    const rng = new Rng(99);
    const map = createBoard(5, 4, 7, rng);
    for (let d = 0; d < 4; d++) {
      const offers = draftOffers(map, rng, 3);
      expect(offers.length).toBeGreaterThan(0);
      stampPlate(map, offers[0].pattern, offers[0].slot, offers[0].feature, rng);
    }
    expect(map.slots.filter(Boolean).length).toBe(5);
    const flow = computeFlow(map, map.coreCell, () => 0);
    const gates = frontierGates(map);
    expect(gates.length).toBeGreaterThan(0);
    for (const g of gates) {
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
      const warCount = sim.enemies.filter((e) => e.kind !== 'researcher').length;
      if (sim.phase === 'growth' && warCount > lastCount) violations++;
      lastCount = warCount;
      ticks++;
    }
    expect(violations).toBe(0);
  });
});
