/**
 * The townsfolk fleeing the crash (src/sim/civilians.ts): a crowd that lives beside the sim,
 * reads it and never writes to it.
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { CellType } from '../src/sim/citymap';
import { CIV_CAP, Civilians, TAKEN_AFTER } from '../src/sim/civilians';
import type { SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234 };
const make = (seed = 1234) => new Sim({ ...CFG, seed });

/** Tick the sim n times, stepping the crowd after each tick (as the renderer does at 10 Hz). */
function run(sim: Sim, civ: Civilians | null, n: number, each?: () => void): void {
  for (let i = 0; i < n && sim.outcome === 'playing'; i++) {
    sim.tick();
    civ?.sync(sim);
    each?.();
  }
}

const snapshot = (civ: Civilians) => JSON.stringify(civ.list.map((c) => [c.id, c.state, c.pos.x.toFixed(4), c.pos.y.toFixed(4)]));

describe('civilians fleeing the crash', () => {
  it('stands a minute-zero crowd of 25-40 on the claimed streets, off the crash square', () => {
    for (const seed of [1, 7, 1234, 99]) {
      const sim = make(seed);
      const civ = new Civilians(sim);
      expect(civ.list.length, `seed ${seed}`).toBeGreaterThanOrEqual(25);
      expect(civ.list.length, `seed ${seed}`).toBeLessThanOrEqual(40);
      for (const c of civ.list) {
        const t = sim.map.cells[sim.cellAt(c.pos.x, c.pos.y)];
        expect(t === CellType.Road || t === CellType.Plaza).toBe(true);
        expect(sim.isCreeped(sim.cellAt(c.pos.x, c.pos.y))).toBe(false);
        expect(Math.hypot(c.pos.x - sim.core.x, c.pos.y - sim.core.y)).toBeGreaterThan(5 * sim.cfg.cellPx);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = make(42);
    const b = make(42);
    const ca = new Civilians(a);
    const cb = new Civilians(b);
    const seenA: string[] = [];
    const seenB: string[] = [];
    run(a, ca, 400, () => { if (a.tickCount % 50 === 0) seenA.push(snapshot(ca)); });
    run(b, cb, 400, () => { if (b.tickCount % 50 === 0) seenB.push(snapshot(cb)); });
    expect(seenA).toEqual(seenB);
    expect([ca.escaped, ca.taken]).toEqual([cb.escaped, cb.taken]);
    // Another seed is another crowd.
    expect(snapshot(new Civilians(make(43)))).not.toEqual(snapshot(new Civilians(make(42))));
  });

  it('never stands on a block (or in the unclaimed city before it leaves)', () => {
    for (const seed of [3, 1234]) {
      const sim = make(seed);
      const civ = new Civilians(sim);
      run(sim, civ, 900, () => {
        for (const c of civ.list) {
          const t = sim.map.cells[sim.cellAt(c.pos.x, c.pos.y)];
          expect(t === CellType.Road || t === CellType.Plaza, `seed ${seed} tick ${sim.tickCount} civilian ${c.id} on ${t}`).toBe(true);
        }
        expect(civ.list.length).toBeLessThanOrEqual(CIV_CAP);
      });
    }
  });

  it('flees: the crowd gets farther from the core, then gets away through the gates', () => {
    const sim = make(1234);
    const civ = new Civilians(sim);
    const mean = () => civ.list.reduce((s, c) => s + Math.hypot(c.pos.x - sim.core.x, c.pos.y - sim.core.y), 0) / Math.max(1, civ.list.length);
    const ids0 = new Set(civ.list.map((c) => c.id));
    const pos0 = new Map(civ.list.map((c) => [c.id, Math.hypot(c.pos.x - sim.core.x, c.pos.y - sim.core.y)]));
    const start = mean();
    run(sim, civ, 60);
    // The same people, six seconds on: on the whole farther from the landing site.
    const still = civ.list.filter((c) => ids0.has(c.id));
    const grew = still.reduce((s, c) => s + Math.hypot(c.pos.x - sim.core.x, c.pos.y - sim.core.y) - pos0.get(c.id)!, 0) / Math.max(1, still.length);
    expect(grew).toBeGreaterThan(0);
    expect(mean() + civ.escaped).toBeGreaterThan(start * 0.5);
    run(sim, civ, 600);
    expect(civ.escaped).toBeGreaterThan(ids0.size / 2);
  });

  it('the creep takes one it overtakes (on creep more than 1.5 s), with an event to draw', () => {
    const sim = make(1234);
    const civ = new Civilians(sim);
    civ.list.length = 0;
    // A street cell under the creep, and one frozen there (cowering does not run off the creep it
    // stands on, so pin it by stepping it back each tick).
    let cell = -1;
    for (let c = 0; c < sim.map.cells.length; c++) {
      const t = sim.map.cells[c];
      if ((t === CellType.Road || t === CellType.Plaza) && sim.isCreeped(c) && c !== sim.map.coreCell) { cell = c; break; }
    }
    expect(cell).toBeGreaterThanOrEqual(0);
    const who = civ.spawnAt(sim, cell, 'flee')!;
    const at = { ...who.pos };
    let taken = null as null | { kind: string; id: number };
    for (let i = 0; i < 40 && !taken; i++) {
      sim.tick();
      civ.sync(sim);
      for (const c of civ.list) if (c.id === who.id) c.pos = { ...at }, c.to = c.cell = cell;
      const ev = civ.takeEvents().find((e) => e.kind === 'taken');
      if (ev) taken = ev;
      if (!taken) expect(i * 0.1).toBeLessThan(TAKEN_AFTER + 0.3);
    }
    expect(taken?.id).toBe(who.id);
    expect(civ.taken).toBe(1);
    expect(civ.list.some((c) => c.id === who.id)).toBe(false);
  });

  it('a plate claimed mid-run brings a smaller crowd of its own', () => {
    const sim = make(1234);
    const civ = new Civilians(sim);
    run(sim, civ, 50);
    const before = civ.list.length;
    const had = new Set(civ.list.map((c) => c.id));
    // Claim a district by hand: turn a Void plate into streets (the crowd only reads the map).
    const w = sim.cfg.gridW;
    let slotX = -1, slotY = -1;
    for (let sy = 0; sy < sim.map.slotsY && slotX < 0; sy++) {
      for (let sx = 0; sx < sim.map.slotsX; sx++) {
        if (sim.map.cells[(sy * 10 + 5) * w + sx * 10 + 5] === CellType.Void) { slotX = sx; slotY = sy; break; }
      }
    }
    expect(slotX).toBeGreaterThanOrEqual(0);
    const saved = sim.map.cells.slice();
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) sim.map.cells[(slotY * 10 + y) * w + slotX * 10 + x] = y % 3 === 1 || x % 3 === 1 ? CellType.Road : CellType.Block;
    civ.step(sim);
    civ.step(sim);
    civ.step(sim);
    civ.step(sim);
    civ.step(sim);
    const added = civ.list.filter((c) => !had.has(c.id) && c.id > Math.max(...had)).length;
    sim.map.cells.splice(0, saved.length, ...saved);
    expect(civ.list.length).toBeGreaterThan(before - 10);
    expect(added).toBeGreaterThanOrEqual(3);
    expect(added).toBeLessThanOrEqual(12);
  });

  it('does not change the sim: the same run with and without the crowd ends the same', () => {
    for (const seed of [5, 1234]) {
      const a = make(seed);
      const b = make(seed);
      const civ = new Civilians(b);
      run(a, null, 1500);
      run(b, civ, 1500);
      const sum = (s: Sim) => JSON.stringify({
        t: s.tickCount, time: s.time, phase: s.phase, wave: s.waveNumber, core: s.coreHp, meat: s.meat, bio: s.biomass,
        enemies: s.enemies.map((e) => [e.id, e.kind, e.pos.x, e.pos.y, e.hp]), towers: s.towers.length,
        gates: s.gates, creep: s.map.cells.filter((_, c) => s.isCreeped(c)).length, kills: s.stats.kills,
      });
      expect(sum(b)).toEqual(sum(a));
    }
  });
});
