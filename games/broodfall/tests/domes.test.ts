/**
 * DOMES (Collins, Oct 2 2026): "a unit for both the warriors and the science team that gives a shield around it in a
 * dome that takes a certain amount of damage before breaking (Northgard has something like this), but the catch is
 * it's ineffective against damage from units (who automatically target shield units first)."
 */
import { describe, expect, it } from 'vitest';
import { Sim, enemySpec } from '../src/sim/sim';
import { BALANCE as B, WAVE_TABLE } from '../content/data';
import type { Broodling, Enemy, SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 6060 };
type Inner = {
  spawnEnemy(kind: string, atGate?: number): Enemy;
  damageEnemy(e: Enemy, dmg: number, yieldMult: number, capBonus?: number, srcId?: number, quiet?: boolean): void;
  preyNear(at: { x: number; y: number }, radius: number, from: { x: number; y: number }, skipScience: boolean): Enemy | null;
  updateDomes(): void;
  unitStrike: number;
  enemies: Enemy[];
  tier: number;
};
const inner = (s: Sim): Inner => s as unknown as Inner;
/** tier and interest are read-only (worked out from threat and the board): pin them for a test. */
function pin(s: Sim, key: 'tier' | 'interest', v: number): void { Object.defineProperty(s, key, { get: () => v, configurable: true }); }

function grown(seed = 6060): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 300; i++) s.tick();
  inner(s).enemies.length = 0;
  return s;
}
function put(s: Sim, kind: string, x: number, y: number): Enemy {
  const e = inner(s).spawnEnemy(kind, s.gates[0]);
  e.pos = { x, y };
  return e;
}
let nextId = 991000;
function warrior(s: Sim, x: number, y: number): Broodling {
  const b: Broodling = { id: nextId++, motherId: -1, pos: { x, y }, hp: B.broodHp, maxHp: B.broodHp, cooldown: 0, guard: { x, y } };
  s.broodlings.push(b);
  return b;
}

describe('a dome', () => {
  it('soaks your limbs\' damage for its bearer and the war bodies under it, out of its pool', () => {
    const s = grown();
    const x = s.core.x + 220;
    const y = s.core.y;
    const a = put(s, 'aegis', x, y);
    const so = put(s, 'soldier', x + 20, y);
    inner(s).updateDomes();
    const pool = a.domeHp!;
    expect(pool).toBeGreaterThan(0);
    inner(s).damageEnemy(so, 50, 1, 0, 1);
    expect(so.hp).toBe(so.maxHp);
    expect(a.domeHp).toBe(pool - 50);
    inner(s).damageEnemy(a, 30, 1, 0, 1);
    expect(a.hp).toBe(a.maxHp);
    expect(a.domeHp).toBe(pool - 80);
  });

  it('lets your walking units\' blows straight through', () => {
    const s = grown();
    const x = s.core.x + 220;
    const a = put(s, 'aegis', x, s.core.y);
    const so = put(s, 'soldier', x + 20, s.core.y);
    inner(s).updateDomes();
    const pool = a.domeHp!;
    inner(s).unitStrike = 1;
    inner(s).damageEnemy(so, 40, 1, 0, 1);
    inner(s).unitStrike = 0;
    expect(so.hp).toBe(so.maxHp - 40);
    expect(a.domeHp).toBe(pool);
  });

  it('breaks when emptied (the rest of the blow goes through) and comes back full after its recharge', () => {
    const s = grown();
    const a = put(s, 'aegis', s.core.x + 220, s.core.y);
    inner(s).updateDomes();
    const pool = a.domeHp!;
    s.takeEvents();
    inner(s).damageEnemy(a, pool + 25, 1, 0, 1);
    expect(a.domeHp).toBe(0);
    expect(a.hp).toBe(a.maxHp - 25);
    expect(s.takeEvents().some((ev) => ev.kind === 'dome-broken')).toBe(true);
    // Broken: the next limb hit lands in full.
    inner(s).damageEnemy(a, 10, 1, 0, 1);
    expect(a.hp).toBe(a.maxHp - 35);
    const back = a.domeDownUntil!;
    expect(back - s.time).toBeCloseTo(enemySpec('aegis').dome!.recharge, 1);
    (s as unknown as { time: number }).time = back + 0.01;
    inner(s).updateDomes();
    expect(a.domeHp).toBe(pool);
  });

  it('covers only its own side, inside its radius', () => {
    const s = grown();
    const x = s.core.x + 220;
    const a = put(s, 'aegis', x, s.core.y);
    const far = put(s, 'soldier', x + enemySpec('aegis').dome!.radius + 30, s.core.y);
    const sci = put(s, 'researcher', x + 10, s.core.y);
    inner(s).updateDomes();
    inner(s).damageEnemy(far, 20, 1, 0, 1);
    inner(s).damageEnemy(sci, 10, 1, 0, 1);
    expect(far.hp).toBe(far.maxHp - 20);
    expect(sci.hp).toBe(sci.maxHp - 10);
    expect(a.domeHp).toBe(a.domeMax);
  });

  it('a Lens Bearer covers the science caste, not the war caste', () => {
    const s = grown();
    const x = s.core.x + 220;
    const l = put(s, 'lensbearer', x, s.core.y);
    const sci = put(s, 'researcher', x + 10, s.core.y);
    const so = put(s, 'soldier', x + 12, s.core.y);
    inner(s).updateDomes();
    inner(s).damageEnemy(sci, 10, 1, 0, 1);
    inner(s).damageEnemy(so, 10, 1, 0, 1);
    expect(sci.hp).toBe(sci.maxHp);
    expect(so.hp).toBe(so.maxHp - 10);
    expect(l.domeHp).toBe(l.domeMax! - 10);
  });

  it('soaks creep, clouds, fire and poison too (they are your work)', () => {
    const s = grown();
    const x = s.core.x + 220;
    const a = put(s, 'aegis', x, s.core.y);
    const so = put(s, 'soldier', x + 10, s.core.y);
    inner(s).updateDomes();
    so.poisonUntil = s.time + 5;
    so.poisonDps = 20;
    const pool = a.domeHp!;
    for (let i = 0; i < 5; i++) s.tick();
    expect(so.hp).toBe(so.maxHp);
    expect(a.domeHp!).toBeLessThan(pool);
  });

  it('your units go for a dome bearer first, even past a nearer body and whatever its caste', () => {
    const s = grown();
    const x = s.core.x + 220;
    const near = put(s, 'soldier', x + 5, s.core.y);
    const a = put(s, 'aegis', x + 40, s.core.y);
    inner(s).updateDomes();
    expect(inner(s).preyNear({ x, y: s.core.y }, 80, { x, y: s.core.y }, true)).toBe(a);
    inner(s).enemies.length = 0;
    put(s, 'soldier', x + 5, s.core.y);
    const l = put(s, 'lensbearer', x + 40, s.core.y);
    inner(s).updateDomes();
    // Warriors leave study parties to your limbs, but not a Lens Bearer.
    expect(inner(s).preyNear({ x, y: s.core.y }, 80, { x, y: s.core.y }, true)).toBe(l);
    void near;
  });

  it('your units crack a domed column: Harriers kill a bearer the limbs could not touch', () => {
    const s = grown();
    const x = s.core.x + 240;
    const a = put(s, 'aegis', x, s.core.y);
    for (let i = 0; i < 3; i++) s.harriers.push({ id: 992000 + i, glandId: -1, pos: { x: x - 60, y: s.core.y + i * 8 }, hp: 70, maxHp: 70, orders: [{ kind: 'hold' } as never], cooldown: 0 });
    let t = 0;
    while (inner(s).enemies.includes(a) && t < 400) { s.tick(); t++; }
    expect(inner(s).enemies.includes(a)).toBe(false);
  });

  it('the dome grows with the tier', () => {
    const s = grown();
    pin(s, 'tier', 0);
    const a0 = put(s, 'aegis', s.core.x + 200, s.core.y);
    pin(s, 'tier', 5);
    const a5 = put(s, 'aegis', s.core.x + 200, s.core.y);
    expect(a5.domeMax!).toBeGreaterThan(a0.domeMax!);
  });
});

describe('where domes come from', () => {
  it('Aegis Deacons march from the mid tiers of the war ladder, none early', () => {
    expect(WAVE_TABLE.slice(0, 4).every((t) => !t.aegis)).toBe(true);
    expect(WAVE_TABLE.slice(4).every((t) => (t.aegis ?? 0) >= 1)).toBe(true);
    expect(enemySpec('aegis').caste).toBe('war');
    expect(enemySpec('lensbearer').caste).toBe('science');
  });

  it('the hive answers a tower-heavy defence with more deacons, only from domeAnswerMinTier', () => {
    const s = grown();
    const limbs = B.domeLimbsFree + 2 * B.domeLimbsPer;
    const fake = Array.from({ length: limbs }, (_, i) => ({ id: 800000 + i }));
    const real = s.towers.slice();
    (s as unknown as { towers: unknown[] }).towers = fake;
    pin(s, 'tier', B.domeAnswerMinTier - 1);
    expect(s.domeAnswer()).toBe(0);
    pin(s, 'tier', B.domeAnswerMinTier);
    expect(s.domeAnswer()).toBe(2);
    (s as unknown as { towers: unknown[] }).towers = real;
    expect(s.domeAnswer()).toBe(0);
  });

  it('a famous study party brings a Lens Bearer; a quiet one does not', () => {
    const s = grown();
    pin(s, 'interest', B.lensInterestMin + 2);
    (s as unknown as { researcherTimer: number }).researcherTimer = 0;
    s.tick();
    expect(inner(s).enemies.some((e) => e.kind === 'lensbearer')).toBe(true);
    const q = grown();
    pin(q, 'interest', 1);
    (q as unknown as { researcherTimer: number }).researcherTimer = 0;
    q.tick();
    expect(inner(q).enemies.some((e) => e.kind === 'lensbearer')).toBe(false);
  });

  it('is deterministic: the same seed gives the same domes', () => {
    const run = (): string => {
      const s = grown(77);
      pin(s, 'tier', 5);
      put(s, 'aegis', s.core.x + 220, s.core.y);
      put(s, 'soldier', s.core.x + 230, s.core.y);
      for (let i = 0; i < 200; i++) s.tick();
      return JSON.stringify(inner(s).enemies.map((e) => [e.kind, Math.round(e.hp), Math.round(e.domeHp ?? -1)]));
    };
    expect(run()).toBe(run());
  });
});
