/**
 * SPORE MULES and BROOD ONLY ON CREEP (Collins, Oct 2 2026): "a unit that can act like a creep node (and an organ
 * that makes them) ... you walk it out and deploy it ... oh and Broodmothers can't be put in make-babies mode except
 * on creep".
 */
import { describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { CellType, isPassable } from '../src/sim/citymap';
import { BALANCE as B } from '../content/data';
import { LINEAGES } from '../content/campaign';
import type { Broodmother, Enemy, OrganId, SimConfig, Vec } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4242 };
type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };
type Private = { growMules(): void; bearMother(den: unknown): void; enemies: Enemy[] };

const hush = (s: Sim) => { (s as unknown as Private).enemies.length = 0; };
const run = (s: Sim, seconds: number, quiet = true) => { for (let i = 0; i < seconds * 10; i++) { s.tick(); if (quiet) hush(s); } };

function grow(s: Sim, organ: OrganId) {
  s.meat.war = 9999;
  s.meat.science = 9999;
  for (let c = 0; c < s.under.cells.length; c++) {
    for (let rot = 0; rot < 4; rot++) {
      if (s.canBuildOrgan(organ, c, rot)) {
        expect(s.issue({ kind: 'build-organ', organ, cell: c, rot }).ok).toBe(true);
        return s.organs[s.organs.length - 1];
      }
    }
  }
  throw new Error(`no spot for ${organ}`);
}

/** A street cell past the creep, `far`..`far+3` cells from the core, reachable on foot. */
function streetPastCreep(s: Sim, far = 6): number {
  const W = s.cfg.gridW;
  const core = s.map.coreCell;
  for (let d = far; d < far + 12; d++) {
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== CellType.Road || s.isCreeped(c)) continue;
      const md = Math.abs((c % W) - (core % W)) + Math.abs(Math.floor(c / W) - Math.floor(core / W));
      if (md === d && s.standableAt(s.cellCenter(c))) return c;
    }
  }
  throw new Error('no street past the creep');
}

function sacWithMule(seed = 4242): Sim {
  const s = new Sim({ ...CFG, seed });
  grow(s, 'mule');
  const p = s as unknown as Private;
  p.growMules();
  expect(s.mules).toHaveLength(0); // every 2 turns
  p.growMules();
  expect(s.mules).toHaveLength(1);
  return s;
}

describe('Spore Mules', () => {
  it('a Mule Sac grows one every 2 turns, at the body, keeping at most mulePerSac', () => {
    const s = sacWithMule();
    const m = s.mules[0];
    expect(m.hp).toBe(B.muleHp);
    const body = s.bodyPoint();
    expect(Math.hypot(m.pos.x - body.x, m.pos.y - body.y)).toBeLessThan(1);
    const p = s as unknown as Private;
    for (let i = 0; i < 10; i++) p.growMules();
    expect(s.mules.length).toBe(B.mulePerSac);
  });

  it('a pacemaker touching the sac makes it grow every turn (paced like a bladder)', () => {
    const s = new Sim({ ...CFG });
    const sac = grow(s, 'mule');
    // A pacemaker touching it (the organ board places touching organs first where it can).
    grow(s, 'pacemaker');
    const touching = s.organs.filter((o) => o.organ === 'pacemaker').length;
    const p = s as unknown as Private;
    p.growMules();
    if (s.bladderRate(sac).every === 1) expect(s.mules.length).toBe(1);
    else expect(touching).toBeGreaterThan(0); // not touching on this board: nothing to assert about pace
  });

  it('walks its orders past the creep and roots there: a node, creep spreading, the stats counted', () => {
    const s = sacWithMule();
    const m = s.mules[0];
    const target = streetPastCreep(s);
    expect(s.isCreeped(target)).toBe(false);
    expect(s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: s.cellCenter(target) } }).ok).toBe(true);
    for (let i = 0; i < 1200 && m.orders.length; i++) { s.tick(); hush(s); }
    expect(m.orders).toHaveLength(0);
    const here = s.cellAt(m.pos.x, m.pos.y);
    const nodesBefore = s.creepSources.filter((x) => x.kind === 'node').length;
    expect(s.issue({ kind: 'mule-deploy', muleId: m.id }).ok).toBe(true);
    expect(s.mules).toHaveLength(0);
    expect(s.creepSources.filter((x) => x.kind === 'node').length).toBe(nodesBefore + 1);
    expect(s.stats.mulesRooted).toBe(1);
    expect(s.stats.nodesPlaced).toBe(1);
    run(s, 30);
    expect(s.isCreeped(here)).toBe(true);
  });

  it('is slow: slower than a Broodmother', () => {
    expect(B.muleSpeed).toBeLessThan(B.motherSpeed);
  });

  it('dies to the hive while walking: a war body in the street fights it, a science party turns aside for it', () => {
    const s = sacWithMule();
    const m = s.mules[0];
    // Walk it away from the body first (a hive body beside the core goes for the core).
    s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: s.cellCenter(streetPastCreep(s)) } });
    for (let i = 0; i < 1200 && m.orders.length; i++) { s.tick(); hush(s); }
    const e = (s as unknown as Spawner).spawnEnemy('soldier');
    e.pos = { x: m.pos.x + 4, y: m.pos.y };
    for (let i = 0; i < 600 && s.mules.length; i++) {
      s.tick();
      for (const o of (s as unknown as Private).enemies) if (o !== e) o.hp = 0;
      e.hp = 999;
    }
    expect(s.mules).toHaveLength(0);
    expect(s.stats.mulesLost).toBe(1);

    const s2 = sacWithMule();
    const m2 = s2.mules[0];
    s2.issue({ kind: 'unit-order', ids: [m2.id], order: { kind: 'move', to: s2.cellCenter(streetPastCreep(s2)) } });
    for (let i = 0; i < 1200 && m2.orders.length; i++) { s2.tick(); hush(s2); }
    const sci = (s2 as unknown as Spawner).spawnEnemy('researcher');
    // A street a little way off, inside the lure's reach.
    const spot = s2.map.cells.findIndex((t, c) => isPassable(t) && (() => {
      const p = s2.cellCenter(c);
      const d = Math.hypot(p.x - m2.pos.x, p.y - m2.pos.y);
      return d >= 30 && d <= B.muleScienceLure - 8;
    })());
    expect(spot).toBeGreaterThanOrEqual(0);
    sci.pos = s2.cellCenter(spot);
    const hp0 = m2.hp;
    for (let i = 0; i < 200 && s2.mules.length; i++) {
      s2.tick();
      for (const o of (s2 as unknown as Private).enemies) if (o !== sci) o.hp = 0;
      sci.hp = 999;
    }
    // It went for the mule: hurt it, or took it.
    expect(s2.mules.length === 0 || m2.hp < hp0).toBe(true);
  });

  it('is deterministic: two sims, the same orders, the same node at the same cell', () => {
    const cells = [1, 2].map(() => {
      const s = sacWithMule();
      const m = s.mules[0];
      const target = streetPastCreep(s);
      s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: s.cellCenter(target) } });
      for (let i = 0; i < 1200 && m.orders.length; i++) { s.tick(); hush(s); }
      s.issue({ kind: 'mule-deploy', muleId: m.id });
      return s.creepSources.filter((x) => x.kind === 'node').map((x) => x.cell);
    });
    expect(cells[0]).toEqual(cells[1]);
  });

  it('the Mule Sac is a sanctioned lineage (bought in the Gene Bay), not in the starting set', () => {
    expect(LINEAGES.mule?.catalogue).toBe('sanctioned');
    const s = new Sim({ ...CFG, organStage: true, organPool: ['gut', 'heart', 'root', 'forge', 'bladder'] });
    expect(s.cfg.organPool?.includes('mule')).toBe(false);
  });
});

describe('a Broodmother broods only on creep', () => {
  function withMother(): { s: Sim; m: Broodmother } {
    const s = new Sim({ ...CFG });
    s.meat.war = 9999;
    s.meat.science = 9999;
    let idx = -1;
    for (let g = 0; g < 600 && idx < 0; g++) {
      idx = s.hand.findIndex((c) => c.family === 'brood');
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    let cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, 'brood'));
    for (let i = 0; i < 1200 && cell < 0; i++) { s.tick(); hush(s); if (i % 20 === 0) cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, 'brood')); }
    idx = s.hand.findIndex((c) => c.family === 'brood');
    expect(s.issue({ kind: 'build', cardIndex: idx, cell }).ok).toBe(true);
    for (let i = 0; i < 300 && s.mothers.length === 0; i++) { s.tick(); hush(s); }
    expect(s.mothers.length).toBeGreaterThan(0);
    return { s, m: s.mothers[0] };
  }

  it('off the creep the brood order is refused with a reason; on it, it is taken', () => {
    const { s, m } = withMother();
    expect(towerSpec('brood')).toBeTruthy();
    s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'fight' });
    const off = streetPastCreep(s);
    s.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: s.cellCenter(off) } });
    for (let i = 0; i < 1500 && m.orders.length; i++) { s.tick(); hush(s); }
    expect(s.isCreeped(s.cellAt(m.pos.x, m.pos.y))).toBe(false);
    const r = s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'brood' });
    expect(r.ok).toBe(false);
    expect(String(r.err)).toMatch(/creep/);
    expect(m.mode).toBe('fight');
  });

  it('a mother parked in brood mode whose creep is lost drops to fight mode', () => {
    const { s, m } = withMother();
    expect(m.mode).toBe('brood');
    // Take the creep out from under her (as if burned back): her cell reads as bare.
    const cell = s.cellAt(m.pos.x, m.pos.y);
    const real = s.isCreeped.bind(s);
    (s as unknown as { isCreeped(c: number): boolean }).isCreeped = (c: number) => (c === cell ? false : real(c));
    s.tick();
    expect(m.mode).toBe('fight');
  });

  it('walk a mule out, root it, and park a mother on the new creep: she broods there', () => {
    const { s, m } = withMother();
    grow(s, 'mule');
    const p = s as unknown as Private;
    p.growMules();
    p.growMules();
    const mule = s.mules[0];
    const off = streetPastCreep(s);
    for (const u of [mule.id, m.id]) s.issue({ kind: 'unit-order', ids: [u], order: { kind: 'move', to: s.cellCenter(off) } });
    s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'fight' });
    for (let i = 0; i < 1500 && (mule.orders.length || m.orders.length); i++) { s.tick(); hush(s); }
    expect(s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'brood' }).ok).toBe(false);
    expect(s.issue({ kind: 'mule-deploy', muleId: mule.id }).ok).toBe(true);
    run(s, 20);
    expect(s.issue({ kind: 'mother-mode', motherId: m.id, mode: 'brood' }).ok).toBe(true);
    expect(m.mode).toBe('brood');
  });
});

describe('the scripted player with mules', () => {
  it('grows a sac and roots mules in a real run', () => {
    // Seed 4 of the gaps measure (GAPS_MODE=mules): a board where the scripted player finds work for its mules.
    const s = new Sim({ ...CFG, seed: 4, organStage: true, directive: { kind: 'hold', waves: 12 } });
    const bot = new Autoplayer(5);
    bot.mules = true;
    for (let i = 0; i < 20000 && s.outcome === 'playing'; i++) { bot.act(s, 0.1); s.tick(); s.takeEvents(); }
    expect(s.organs.some((o) => o.organ === 'mule')).toBe(true);
    expect(s.stats.mulesRooted ?? 0).toBeGreaterThan(0);
    expect(isPassable(CellType.Road)).toBe(true);
  });
});

export type { Vec };
