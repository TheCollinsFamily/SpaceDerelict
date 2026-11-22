/**
 * THE HIVE'S BLOWS ARE TOLD (Nov 22 2026). Collins, playtesting: "there is no sound effect or hit effect when an
 * enemy unit hits my base and presumably none when science team members are hitting limbs". The sim used to take
 * the hp off without a word; now every blow on the core is a 'core-hit' event and every blow on a limb a
 * 'limb-hit', which the board's flinch (src/render/hitFx.ts) and the sounds (src/audio/gameSounds.ts) hang on.
 */
import { describe, expect, it, vi } from 'vitest';

const heard: Array<{ id: string; o?: { gain?: number; rate?: number } }> = [];
vi.mock('../src/audio/engine', () => ({ sfx: (id: string, o?: { gain?: number; rate?: number }) => { heard.push({ id, o }); return true; }, sting: () => true, say: () => false }));

import { Sim } from '../src/sim/sim';
import { boardEvents } from '../src/audio/gameSounds';
import { HitMarks, flinch, heavyHit } from '../src/render/hitFx';
import type { Enemy, SimConfig, SimEvent, Tower, TowerFamily } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4242 };
type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };

function build(s: Sim, family: TowerFamily): Tower {
  s.meat.war = 9999;
  s.meat.science = 9999;
  let idx = -1;
  for (let guard = 0; guard < 600 && idx < 0; guard++) {
    idx = s.hand.findIndex((c) => c.family === family);
    if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
  }
  expect(idx).toBeGreaterThanOrEqual(0);
  const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, family));
  expect(cell).toBeGreaterThanOrEqual(0);
  expect(s.issue({ kind: 'build', cardIndex: idx, cell }).ok).toBe(true);
  return s.towers[s.towers.length - 1];
}

/** Tick until an event of this kind comes, collecting everything. */
function until(s: Sim, kind: SimEvent['kind'], ticks: number, each?: () => void): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    each?.();
    s.tick();
    const evs = s.takeEvents();
    all.push(...evs);
    if (evs.some((e) => e.kind === kind)) break;
  }
  return all;
}

describe('the hive hitting the body is told', () => {
  it('a soldier biting the core makes a core-hit with the harm done, where it came from, and the integrity left', () => {
    const s = new Sim({ ...CFG });
    s.takeEvents();
    const e = (s as unknown as Spawner).spawnEnemy('soldier', s.gates[0]);
    e.pos = { x: s.core.x + 30, y: s.core.y };
    const hp0 = s.coreHp;
    const evs = until(s, 'core-hit', 80, () => { e.pos = { x: s.core.x + 30, y: s.core.y }; });
    const hit = evs.find((x) => x.kind === 'core-hit');
    expect(hit, evs.map((x) => x.kind).join(' ')).toBeTruthy();
    if (hit?.kind !== 'core-hit') return;
    expect(hit.by).toBe('melee');
    expect(hit.enemy).toBe('soldier');
    expect(hit.amount).toBeGreaterThan(0);
    expect(hp0 - s.coreHp).toBeCloseTo(hit.amount, 5);
    expect(hit.frac).toBeCloseTo(s.coreHp / s.coreMaxHp, 5);
    expect(hit.from.x).toBeGreaterThan(s.core.x); // the side it came from
    // ...and it is heard: the core's heavy thud.
    heard.length = 0;
    boardEvents([hit]);
    expect(heard.map((h) => h.id)).toEqual(['core-hit']);
  });

  it('a soldier chewing a limb makes a limb-hit on that limb', () => {
    const s = new Sim({ ...CFG, seed: 4243 });
    const t = build(s, 'spitter');
    s.takeEvents();
    const e = (s as unknown as Spawner).spawnEnemy('soldier', s.gates[0]);
    const near = () => { e.pos = { x: t.pos.x + 14, y: t.pos.y }; e.targetId = t.id; e.targetIsOrgan = false; };
    const evs = until(s, 'limb-hit', 80, near);
    const hit = evs.find((x) => x.kind === 'limb-hit');
    expect(hit, evs.map((x) => x.kind).join(' ')).toBeTruthy();
    if (hit?.kind !== 'limb-hit') return;
    expect(hit.towerId).toBe(t.id);
    expect(hit.family).toBe('spitter');
    expect(hit.by).toBe('melee');
    expect(hit.amount).toBeGreaterThan(0);
    heard.length = 0;
    boardEvents([hit]);
    expect(heard.map((h) => h.id)).toEqual(['limb-hit']);
  });

  it('a researcher of the science caste cutting a limb out makes limb-hits, about three a second (not every tick)', () => {
    const s = new Sim({ ...CFG, seed: 4244 });
    const t = build(s, 'spitter');
    s.takeEvents();
    const r = (s as unknown as Spawner).spawnEnemy('researcher', s.gates[0]);
    const hits: SimEvent[] = [];
    for (let i = 0; i < 30; i++) { // 3 s
      r.pos = { x: t.pos.x + 8, y: t.pos.y };
      r.extractId = t.id;
      s.tick();
      hits.push(...s.takeEvents().filter((x) => x.kind === 'limb-hit'));
      if (!s.towers.includes(t)) break;
    }
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expect(hits.length).toBeLessThanOrEqual(12);
    const h = hits[0];
    expect(h.kind === 'limb-hit' && h.by === 'extract' && h.enemy === 'researcher' && h.towerId === t.id).toBe(true);
  });

  it('a hit flinches the struck thing for a moment; a shell or a big blow is heavy', () => {
    const m = new HitMarks();
    m.hitCore({ t: 0, dx: 1, dy: 0, k: 1, shielded: false });
    m.hitLimb(7, { t: 0, dx: 0, dy: 1, k: 0.8, shielded: false });
    expect(m.coreNow()).toBeCloseTo(1);
    m.step(0.1);
    expect(m.coreNow()).toBeGreaterThan(0.2);
    expect(m.limbNow(7)).toBeGreaterThan(0.1);
    m.step(1);
    expect(m.coreNow()).toBe(0);
    expect(m.limbNow(7)).toBe(0);
    expect(flinch(0)).toBe(1);
    expect(heavyHit({ amount: 5, by: 'shell' })).toBe(true);
    expect(heavyHit({ amount: 24, by: 'melee' })).toBe(true);
    expect(heavyHit({ amount: 3, by: 'melee' })).toBe(false);
  });
});
