/**
 * The sim obeys the campaign (organ pool, starting profile, evolution caps,
 * faction perks, experiment setups) and reports what happened (RunStats).
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { BALANCE as B } from '../content/data';
import type { Enemy, SimConfig, Tower } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 5000 };
type Priv = {
  spawnEnemy(kind: string, atGate?: number): Enemy;
  killEnemy(id: number, y: number, eaten: boolean, src?: number, cause?: string): void;
  spawnQueue: string[]; enemies: Enemy[]; phase: string;
};
const clearWave = (s: Sim) => {
  const p = s as unknown as Priv;
  s.issue({ kind: 'call-early' });
  p.enemies.length = 0; p.spawnQueue.length = 0;
  for (let i = 0; i < 60 && s.phase === 'siege'; i++) s.tick();
  while (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0 });
};
const legalSpot = (s: Sim, organ: Parameters<Sim['canBuildOrgan']>[0]) => {
  for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) if (s.canBuildOrgan(organ, c, r)) return { cell: c, rot: r };
  return null;
};

describe('campaign config: the run obeys the campaign', () => {
  it('organ pool: only pooled organs grow; the starting profile\'s organs are grown free', () => {
    const s = new Sim({ ...CFG, organStage: true, organPool: ['gut', 'heart', 'root'], startOrgans: ['forge'] });
    expect(s.organs.map((o) => o.organ)).toEqual(['forge']);
    expect(s.drawWeights().impaler).toBeGreaterThan(0); // the profile's theme is unlocked
    s.meat.war = 999;
    expect(legalSpot(s, 'venom')).toBeNull();
    expect(legalSpot(s, 'gut')).not.toBeNull();
  });

  it('evolution caps: a theme capped at stage 1 cannot evolve further', () => {
    const s = new Sim({ ...CFG, evolutionCap: { core: 1 } });
    const t: Tower = { id: 1, family: 'spitter', pos: { x: 300, y: 300 }, cell: s.cellAt(300, 300), hp: 60, maxHp: 60, pips: [], cooldown: 9, kills: 0 };
    s.towers.push(t);
    s.meat.science = 999;
    expect(s.issue({ kind: 'evolve', towerId: 1, choice: 'A' }).ok).toBe(true);
    expect(s.issue({ kind: 'evolve', towerId: 1, choice: 'A' }).err).toMatch(/locked/);
  });

  it('Conscientious Objectors: banned kinds do not come; Volunteers: bonus meat at the start', () => {
    const s = new Sim({ ...CFG, bannedEnemies: ['responder', 'militia', 'skitterling'], startBonus: { science: 40, royal: 1 } });
    expect(s.meat.science).toBe(40);
    expect(s.meat.royal).toBe(1);
    s.issue({ kind: 'call-early' });
    const q = (s as unknown as Priv).spawnQueue;
    expect(q.some((k) => ['responder', 'militia', 'skitterling'].includes(k))).toBe(false);
  });

  it('the Sleepers: martyrs in the enemy waves blow up among their own', () => {
    const s = new Sim({ ...CFG, sleepers: 1 });
    const p = s as unknown as Priv;
    const a = p.spawnEnemy('soldier', s.gates[0]);
    const b = p.spawnEnemy('soldier', s.gates[0]);
    expect(a.sleeperAt).toBeDefined();
    b.pos = { ...a.pos };
    const hp0 = b.hp;
    for (let i = 0; i < (B.sleeperFuse + 1) / 0.1; i++) s.tick();
    expect(s.enemies.includes(a)).toBe(false);
    expect(!s.enemies.includes(b) || b.hp < hp0).toBe(true);
    expect(s.stats.killsByCause.martyr ?? 0).toBeGreaterThan(0);
  });

  it('Love Gas: mating musk clouds stop the war caste and add bodies to the next wave', () => {
    const s = new Sim({ ...CFG, matingMusk: true });
    const p = s as unknown as Priv;
    const e = p.spawnEnemy('soldier', s.gates[0]);
    const f = p.spawnEnemy('soldier', s.gates[0]);
    s.spawnCloud(e.pos, 40, 5);
    f.pos = { ...e.pos };
    const hp0 = e.hp;
    s.tick();
    expect(e.hp).toBe(hp0); // no poison — musk
    expect(s.moveSpeedOf(e)).toBeLessThan(0.1 * 34); // a soldier walks 34 px/s; paired off it barely moves
    expect(s.stats.matingStuns).toBe(2);
    p.enemies.length = 0; p.spawnQueue.length = 0;
    for (let i = 0; i < 400 && s.phase !== 'growth'; i++) s.tick();
    s.issue({ kind: 'call-early' });
    expect(p.spawnQueue.filter((k) => k === 'militia').length).toBeGreaterThanOrEqual(1);
  });

  it('Puppet Queen: a free Trap Cage catches a weakened royal, who then fights her own', () => {
    const s = new Sim({ ...CFG, trapCage: true });
    const card = s.hand.findIndex((c) => c.family === 'cage');
    expect(card).toBeGreaterThanOrEqual(0);
    let cell = -1;
    for (let c = 0; c < s.map.cells.length && cell < 0; c++) if (s.canBuildTower(c)) cell = c;
    expect(s.issue({ kind: 'build', cardIndex: card, cell }).ok).toBe(true);
    const cage = s.towers.find((t) => t.family === 'cage')!;
    const p = s as unknown as Priv;
    const royal = p.spawnEnemy('consort', s.gates[0]);
    royal.pos = { x: cage.pos.x + 20, y: cage.pos.y };
    royal.hp = royal.maxHp * 0.4;
    s.tick();
    expect(s.enemies.includes(royal)).toBe(false);
    expect(s.stats.royalsCaptured).toBe(1);
    const puppet = s.broodlings.find((b) => b.puppet);
    expect(puppet).toBeDefined();
    // She hunts anywhere (no leash) and her kills count for the cage.
    const foe = p.spawnEnemy('militia', s.gates[0]);
    foe.pos = { x: puppet!.pos.x + 10, y: puppet!.pos.y };
    for (let i = 0; i < 80 && s.enemies.includes(foe); i++) s.tick();
    expect(s.stats.killsByFamily.cage ?? 0).toBeGreaterThan(0);
  });
});

describe('RunStats: what happened this run', () => {
  it('counts kills by kind, cause and family; limbs grown; waves; pacifist waves; heals', () => {
    const s = new Sim({ ...CFG });
    const p = s as unknown as Priv;
    s.meat.war = 999;
    let idx = -1;
    for (let g = 0; g < 300 && idx < 0; g++) { idx = s.hand.findIndex((c) => c.family === 'spitter'); if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 }); }
    let cell = -1;
    for (let c = 0; c < s.map.cells.length && cell < 0; c++) if (s.canBuildTower(c)) cell = c;
    s.issue({ kind: 'build', cardIndex: idx, cell });
    expect(s.stats.limbsGrown).toBe(1);
    expect(s.stats.families).toContain('spitter');
    const gun = s.towers[0];
    const e = p.spawnEnemy('militia', s.gates[0]);
    p.killEnemy(e.id, 1, false, gun.id);
    const c = p.spawnEnemy('militia', s.gates[0]);
    p.killEnemy(c.id, 1, false, undefined, 'creep');
    expect(s.stats.kills.militia).toBe(2);
    expect(s.stats.killsByFamily.spitter).toBe(1);
    expect(s.stats.killsByCause).toMatchObject({ limb: 1, creep: 1 });
    clearWave(s);
    expect(s.stats.pacifistWaves).toBe(1); // no limb damage that wave
    expect(s.stats.earlyCalls).toBe(1);
  });
});
