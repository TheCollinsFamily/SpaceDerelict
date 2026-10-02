/**
 * THE FLAMETROOPER (Collins, Oct 2 2026): "an enemy unit of war caste with a flamethrower that is way better against
 * units and targets them first, only going after the base if all units are clear."
 */
import { describe, expect, it } from 'vitest';
import { Sim, enemySpec } from '../src/sim/sim';
import { BALANCE as B, WAVE_TABLE } from '../content/data';
import type { Broodling, Enemy, SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 5150 };
type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };
type Threat = { threatChallenge: number };

function grown(seed = 5150): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 300; i++) s.tick();
  (s as unknown as { enemies: Enemy[] }).enemies.length = 0;
  return s;
}

let nextId = 990000;
/** A warrior of yours standing at this point (a pit's, with nothing tying it to a limb). */
function warrior(s: Sim, x: number, y: number): Broodling {
  const b: Broodling = { id: nextId++, motherId: -1, pos: { x, y }, hp: B.broodHp, maxHp: B.broodHp, cooldown: 99, guard: { x, y }, orders: [{ kind: 'hold' } as never] };
  s.broodlings.push(b);
  return b;
}

function trooper(s: Sim, x: number, y: number): Enemy {
  const e = (s as unknown as Spawner).spawnEnemy('flametrooper', s.gates[0]);
  e.pos = { x, y };
  return e;
}

describe('the Flametrooper', () => {
  it('goes for your walking units first and burns them; a warrior lasts about a second in the stream', () => {
    const s = grown();
    const e = trooper(s, s.core.x + 200, s.core.y);
    const b = warrior(s, e.pos.x + 30, e.pos.y);
    const towersHp = s.towers.map((t) => t.hp);
    let ticks = 0;
    while (s.broodlings.includes(b) && ticks < 40) { s.tick(); ticks++; }
    expect(s.broodlings.includes(b)).toBe(false);
    expect(ticks).toBeLessThanOrEqual(20); // 34 hp at 30 dps: about 1.1 s (11 ticks), a little more to walk in
    expect(s.towers.map((t) => t.hp)).toEqual(towersHp);
  });

  it('burns every unit of yours inside its cone, not just the one it aimed at', () => {
    const s = grown();
    const e = trooper(s, s.core.x + 200, s.core.y);
    const a = warrior(s, e.pos.x + 25, e.pos.y);
    const b = warrior(s, e.pos.x + 40, e.pos.y + 4);
    const behind = warrior(s, e.pos.x - 40, e.pos.y); // outside the cone (behind it) and out of reach of a turn
    s.tick();
    s.tick();
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(behind.hp).toBe(behind.maxHp);
    expect(e.flameTo).toBeDefined();
  });

  it('is far deadlier to units than a soldier, and weaker than one against limbs', () => {
    const fl = enemySpec('flametrooper');
    const so = enemySpec('soldier');
    expect(fl.flamer!.unitDps).toBeGreaterThan(so.damage * so.rate * 1.8);
    expect(fl.damage * fl.rate).toBeLessThan(so.damage * so.rate / 2);
    expect(fl.caste).toBe('war');
  });

  it('with no unit of yours in sight it does not hose: it marches like the war caste', () => {
    const s = grown();
    const e = trooper(s, s.core.x + 200, s.core.y);
    warrior(s, e.pos.x + B.broodHp * 0 + 400, e.pos.y + 300); // far outside its sight
    for (let i = 0; i < 5; i++) s.tick();
    expect(e.flameTo).toBeUndefined();
  });

  it('hunts a unit it can see but cannot reach yet (it closes in)', () => {
    const s = grown();
    const e = trooper(s, s.core.x + 200, s.core.y);
    const b = warrior(s, e.pos.x + 120, e.pos.y);
    const d0 = Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y);
    for (let i = 0; i < 10; i++) s.tick();
    const d1 = Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y);
    expect(d1).toBeLessThan(d0);
  });
});

describe('where Flametroopers come from', () => {
  it('first in tier 3 of the wave table', () => {
    for (let t = 0; t < 3; t++) expect(WAVE_TABLE[t].flametrooper ?? 0).toBe(0);
    for (let t = 3; t < WAVE_TABLE.length; t++) expect(WAVE_TABLE[t].flametrooper ?? 0).toBeGreaterThan(0);
  });

  it('the hive answers a stack: one more per flamerPerUnits units on the board, from tier 2, capped; none if banned', () => {
    const s = grown();
    (s as unknown as Threat).threatChallenge = B.threatPerTier * 1; // tier 1
    for (let i = 0; i < 24; i++) warrior(s, s.core.x + i, s.core.y);
    expect(s.flamerAnswer()).toBe(0);
    (s as unknown as Threat).threatChallenge = B.threatPerTier * 2.2; // tier 2
    expect(s.flamerAnswer()).toBe(Math.min(B.flamerAnswerMax, Math.floor(24 / B.flamerPerUnits)));
    for (let i = 0; i < 60; i++) warrior(s, s.core.x + i, s.core.y + 3);
    expect(s.flamerAnswer()).toBe(B.flamerAnswerMax);
    expect(s.previewNextWave().flametrooper ?? 0).toBeGreaterThanOrEqual(B.flamerAnswerMax);
    const banned = new Sim({ ...CFG, bannedEnemies: ['flametrooper'] });
    (banned as unknown as Threat).threatChallenge = B.threatPerTier * 3;
    for (let i = 0; i < 24; i++) warrior(banned, 100 + i, 100);
    expect(banned.flamerAnswer()).toBe(0);
  });

  it('is deterministic: the same seed and the same stack burn the same way', () => {
    const play = (): number[] => {
      const s = grown(77);
      const e = trooper(s, s.core.x + 200, s.core.y);
      for (let i = 0; i < 6; i++) warrior(s, e.pos.x + 20 + i * 6, e.pos.y + (i % 2) * 5);
      for (let i = 0; i < 25; i++) s.tick();
      return [...s.broodlings.map((b) => Math.round(b.hp * 1000)), Math.round(e.pos.x * 1000), Math.round(e.pos.y * 1000)];
    };
    expect(play()).toEqual(play());
  });
});
