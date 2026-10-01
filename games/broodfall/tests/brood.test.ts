/**
 * The Brood Pit and the Broodmother Den (Collins, Oct 1 2026): "one spawning fighters from your base
 * and the other spawning a Broodmother, which can either be clicked and set in brood mode, where it
 * stays stationary and spawns more warriors, or be in fighting mode, where it can cast a net slowing
 * enemies ... Broodmothers and brood output should be selectable" (and orderable).
 */
import { describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { isPassable } from '../src/sim/citymap';
import { BALANCE as B } from '../content/data';
import type { Broodmother, Enemy, SimConfig, Tower, TowerFamily, Vec } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4242 };
type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };

function fresh(seed = 4242): Sim {
  return new Sim({ ...CFG, seed });
}

/** Build a limb of this family through the real command (the hand is cycled until it is dealt). */
function build(s: Sim, family: TowerFamily): Tower {
  s.meat.war = 9999;
  s.meat.science = 9999;
  let idx = -1;
  for (let guard = 0; guard < 600 && idx < 0; guard++) {
    idx = s.hand.findIndex((c) => c.family === family);
    if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
  }
  expect(idx).toBeGreaterThanOrEqual(0);
  // A big limb waits for the creep to hold ground it fits (the board kept quiet meanwhile).
  let cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, family));
  for (let i = 0; i < 1200 && cell < 0; i++) {
    s.tick();
    hush(s);
    if (i % 20 === 0) cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, family));
  }
  expect(cell).toBeGreaterThanOrEqual(0);
  idx = s.hand.findIndex((c) => c.family === family);
  expect(s.issue({ kind: 'build', cardIndex: idx, cell }).ok).toBe(true);
  return s.towers[s.towers.length - 1];
}

function run(s: Sim, seconds: number): void {
  for (let i = 0; i < seconds * 10; i++) s.tick();
}

/** A street cell centre at least `far` px from a point (for sending units somewhere). */
function streetAway(s: Sim, from: Vec, far: number): Vec {
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!isPassable(s.map.cells[c])) continue;
    const p = s.cellCenter(c);
    if (Math.hypot(p.x - from.x, p.y - from.y) >= far && Math.hypot(p.x - from.x, p.y - from.y) <= far + 60) return p;
  }
  throw new Error('no street that far');
}

/** Keep the board quiet: no waves while a test watches the units. */
function hush(s: Sim): void {
  (s as unknown as { enemies: Enemy[] }).enemies.length = 0;
}

describe('the Brood Pit: warriors from the body', () => {
  it('keeps its warriors, each born at the body, and sends them to its rally point', () => {
    const s = fresh();
    const pit = build(s, 'hatch');
    const born: Vec[] = [];
    for (let i = 0; i < 400; i++) {
      const before = new Set(s.broodlings.map((b) => b.id));
      s.tick();
      hush(s);
      for (const b of s.broodlings) if (!before.has(b.id)) born.push({ ...b.pos });
    }
    const mine = s.broodlings.filter((b) => b.motherId === pit.id);
    expect(mine.length).toBe(towerSpec('hatch').broodCount);
    const body = s.bodyPoint();
    for (const p of born) expect(Math.hypot(p.x - body.x, p.y - body.y)).toBeLessThan(2);
    // They gathered at the pit's rally point (the street beside it).
    const rally = s.rallyOf(pit);
    for (const b of mine) expect(Math.hypot(b.pos.x - rally.x, b.pos.y - rally.y)).toBeLessThan(40);
  });

  it('a new rally point sends the next warriors (and the idle ones) there', () => {
    const s = fresh(4243);
    const pit = build(s, 'hatch');
    const far = streetAway(s, s.rallyOf(pit), 160);
    expect(s.issue({ kind: 'set-rally', towerId: pit.id, cell: s.cellAt(far.x, far.y) }).ok).toBe(true);
    for (let i = 0; i < 700; i++) { s.tick(); hush(s); }
    const mine = s.broodlings.filter((b) => b.motherId === pit.id);
    expect(mine.length).toBeGreaterThan(0);
    for (const b of mine) expect(Math.hypot(b.pos.x - far.x, b.pos.y - far.y)).toBeLessThan(40);
  });

  it('warriors outlive the pit and fight on', () => {
    const s = fresh(4244);
    const pit = build(s, 'hatch');
    for (let i = 0; i < 200; i++) { s.tick(); hush(s); }
    const n = s.broodlings.length;
    expect(n).toBeGreaterThan(0);
    (s as unknown as { removeTower(id: number, e: boolean): void }).removeTower(pit.id, false);
    expect(s.broodlings.length).toBe(n);
    for (const b of s.broodlings) expect(b.snap).toBeDefined();
  });
});

describe('the Broodmother Den and her Broodmother', () => {
  it('bears one Broodmother who, parked in brood mode, broods warriors up to her cap and no further', () => {
    const s = fresh(4250);
    const den = build(s, 'brood');
    run(s, 0.3);
    expect(s.mothers.filter((m) => m.denId === den.id)).toHaveLength(1);
    const m = s.mothers[0];
    expect(m.mode).toBe('brood');
    const start = { ...m.pos };
    for (let i = 0; i < 900; i++) { s.tick(); hush(s); }
    expect(Math.hypot(m.pos.x - start.x, m.pos.y - start.y)).toBeLessThan(1); // stationary
    const hers = s.broodlings.filter((b) => b.motherUnit === m.id);
    expect(hers.length).toBe(s.motherBroodCap(m));
    for (const b of hers) expect(Math.hypot(b.pos.x - m.pos.x, b.pos.y - m.pos.y)).toBeLessThan(B.broodLeash);
  });

  it('in fight mode she does not brood; she walks to orders and nets a crowd, slowing it', () => {
    const s = fresh(4251);
    build(s, 'brood');
    run(s, 0.3);
    const m = s.mothers[0];
    expect(s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'fight' }).ok).toBe(true);
    const to = streetAway(s, m.pos, 120);
    expect(s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to } }).ok).toBe(true);
    const n0 = s.broodlings.filter((b) => b.motherUnit === m.id).length;
    for (let i = 0; i < 400; i++) { s.tick(); hush(s); }
    expect(Math.hypot(m.pos.x - to.x, m.pos.y - to.y)).toBeLessThan(12);
    expect(s.broodlings.filter((b) => b.motherUnit === m.id).length).toBe(n0); // no brooding while fighting
    // A crowd in reach: she nets it on her own.
    const sp = s as unknown as Spawner;
    const crowd = [0, 1, 2, 3].map((k) => {
      const e = sp.spawnEnemy('soldier', s.gates[0]);
      e.pos = { x: m.pos.x + 70 + k * 6, y: m.pos.y };
      return e;
    });
    m.netCd = 0;
    const nets0 = s.stats.netsCast ?? 0;
    s.tick();
    expect(s.stats.netsCast).toBe(nets0 + 1);
    for (const e of crowd) expect(e.slowMult).toBe(B.netSlow);
  });

  it('the net can be aimed by the player, within reach and off cooldown only', () => {
    const s = fresh(4252);
    build(s, 'brood');
    run(s, 0.3);
    const m = s.mothers[0];
    const at = { x: m.pos.x + 40, y: m.pos.y };
    expect(s.issue({ kind: 'mother-net', motherId: m.id, at }).ok).toBe(false); // brood mode
    s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'fight' });
    m.netCd = 0;
    expect(s.issue({ kind: 'mother-net', motherId: m.id, at: { x: m.pos.x + B.netRange + 50, y: m.pos.y } }).ok).toBe(false);
    expect(s.issue({ kind: 'mother-net', motherId: m.id, at }).ok).toBe(true);
    expect(s.issue({ kind: 'mother-net', motherId: m.id, at }).ok).toBe(false); // cooling down
  });

  it('when she dies her warriors hold where they stand, and the den bears another, slowly', () => {
    const s = fresh(4253);
    const den = build(s, 'brood');
    for (let i = 0; i < 300; i++) { s.tick(); hush(s); }
    const m = s.mothers[0];
    const hers = s.broodlings.filter((b) => b.motherUnit === m.id);
    expect(hers.length).toBeGreaterThan(0);
    s.hurtMother(m, 99999);
    expect(s.mothers).toHaveLength(0);
    for (const b of hers) { expect(b.motherUnit).toBeUndefined(); expect(b.guard).toBeDefined(); }
    run(s, B.motherRespawn * 0.5);
    expect(s.mothers).toHaveLength(0);
    run(s, B.motherRespawn * 0.6);
    expect(s.mothers.filter((x) => x.denId === den.id)).toHaveLength(1);
  });

  it('hive soldiers stop to fight her; a dart sedates her (no brooding until it wears off)', () => {
    const s = fresh(4254);
    build(s, 'brood');
    run(s, 0.3);
    const m: Broodmother = s.mothers[0];
    const soldier = (s as unknown as Spawner).spawnEnemy('soldier', s.gates[0]);
    soldier.pos = { x: m.pos.x + 20, y: m.pos.y };
    const hp0 = m.hp;
    const p0 = { ...soldier.pos };
    for (let i = 0; i < 20; i++) s.tick();
    expect(m.hp).toBeLessThan(hp0);
    expect(Math.hypot(soldier.pos.x - p0.x, soldier.pos.y - p0.y)).toBeLessThan(30);
    hush(s);
    m.stunnedUntil = s.time + 5;
    const n = s.broodlings.filter((b) => b.motherUnit === m.id).length;
    m.spawnCd = 0;
    run(s, 3);
    expect(s.broodlings.filter((b) => b.motherUnit === m.id).length).toBe(n);
  });
});

describe('orders', () => {
  it('move, hold, return and guard: warriors carry them out; a group spreads round the point', () => {
    const s = fresh(4260);
    const pit = build(s, 'hatch');
    for (let i = 0; i < 400; i++) { s.tick(); hush(s); }
    const ids = s.broodlings.filter((b) => b.motherId === pit.id).map((b) => b.id);
    expect(ids.length).toBeGreaterThan(1);
    const to = streetAway(s, s.rallyOf(pit), 150);
    expect(s.issue({ kind: 'unit-order', ids, order: { kind: 'move', to } }).ok).toBe(true);
    for (let i = 0; i < 400; i++) { s.tick(); hush(s); }
    const units = ids.map((id) => s.broodlings.find((b) => b.id === id)!);
    for (const b of units) expect(Math.hypot(b.pos.x - to.x, b.pos.y - to.y)).toBeLessThan(30);
    const spots = new Set(units.map((b) => `${Math.round(b.pos.x)},${Math.round(b.pos.y)}`));
    expect(spots.size).toBeGreaterThan(1);
    // They stay at their new post (guard there), not wander back to the pit.
    run(s, 10);
    for (const b of units) expect(Math.hypot(b.pos.x - to.x, b.pos.y - to.y)).toBeLessThan(30);
    // Return: back to the body.
    s.issue({ kind: 'unit-order', ids, order: { kind: 'return' } });
    for (let i = 0; i < 900; i++) { s.tick(); hush(s); }
    const body = s.bodyPoint();
    for (const b of units) expect(Math.hypot(b.pos.x - body.x, b.pos.y - body.y)).toBeLessThan(30);
    // Guard: back to the pit's rally point.
    s.issue({ kind: 'unit-order', ids, order: { kind: 'guard' } });
    for (let i = 0; i < 900; i++) { s.tick(); hush(s); }
    const rally = s.rallyOf(pit);
    for (const b of units) expect(Math.hypot(b.pos.x - rally.x, b.pos.y - rally.y)).toBeLessThan(40);
  });

  it('hold: a held warrior does not chase a body out of bite reach', () => {
    const s = fresh(4261);
    const pit = build(s, 'hatch');
    for (let i = 0; i < 300; i++) { s.tick(); hush(s); }
    const b = s.broodlings.find((x) => x.motherId === pit.id)!;
    s.issue({ kind: 'unit-order', ids: [b.id], order: { kind: 'hold' } });
    const p0 = { ...b.pos };
    const e = (s as unknown as Spawner).spawnEnemy('militia', s.gates[0]);
    e.pos = { x: b.pos.x + 50, y: b.pos.y };
    (e as unknown as { speed: number }).speed = 0;
    for (let i = 0; i < 30; i++) { s.tick(); e.pos = { x: p0.x + 50, y: p0.y }; }
    expect(Math.hypot(b.pos.x - p0.x, b.pos.y - p0.y)).toBeLessThan(1);
  });

  it('shift-queued waypoints are walked in order; a fresh order replaces them', () => {
    const s = fresh(4262);
    build(s, 'brood');
    run(s, 0.3);
    const m = s.mothers[0];
    const a = streetAway(s, m.pos, 80);
    const b = streetAway(s, a, 80);
    s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: a } });
    s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: b }, queue: true });
    expect(m.orders).toHaveLength(2);
    let touchedA = false;
    for (let i = 0; i < 1500 && m.orders.length > 0; i++) {
      s.tick(); hush(s);
      if (Math.hypot(m.pos.x - a.x, m.pos.y - a.y) < 10) touchedA = true;
    }
    expect(touchedA).toBe(true);
    expect(Math.hypot(m.pos.x - b.x, m.pos.y - b.y)).toBeLessThan(12);
    s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: a } });
    s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: b } });
    expect(m.orders).toHaveLength(1);
  });

  it('orders are refused off the streets and for units that do not exist', () => {
    const s = fresh(4263);
    expect(s.issue({ kind: 'unit-order', ids: [987654], order: { kind: 'hold' } }).ok).toBe(false);
    const pit = build(s, 'hatch');
    expect(s.issue({ kind: 'set-rally', towerId: pit.id, cell: s.map.coreCell }).ok).toBeDefined();
  });
});

describe('determinism', () => {
  it('two sims with dens, pits, orders and nets stay identical', () => {
    const play = (): string => {
      const s = fresh(4270);
      build(s, 'hatch');
      build(s, 'brood');
      for (let i = 0; i < 1500; i++) {
        if (i === 200 && s.mothers[0]) s.issue({ kind: 'mother-mode', motherId: s.mothers[0].id, mode: 'fight' });
        if (i === 300) {
          const ids = s.broodlings.map((b) => b.id);
          s.issue({ kind: 'unit-order', ids, order: { kind: 'attack', to: s.cellCenter(s.gates[0] ?? 0) } });
        }
        s.tick();
      }
      return JSON.stringify({
        u: s.broodlings.map((b) => [b.id, Math.round(b.pos.x * 100), Math.round(b.pos.y * 100), Math.round(b.hp)]),
        m: s.mothers.map((m) => [m.id, Math.round(m.pos.x * 100), Math.round(m.hp), m.mode]),
        e: s.enemies.length, core: Math.round(s.coreHp), nets: s.stats.netsCast ?? 0,
      });
    };
    expect(play()).toBe(play());
  });
});
