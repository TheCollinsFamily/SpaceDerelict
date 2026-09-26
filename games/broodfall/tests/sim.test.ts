import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import { Sim, towerStats, towerSpec } from '../src/sim/sim';
import { CellType, isPassable } from '../src/sim/citymap';
import type { SimConfig, Tower } from '../src/sim/types';
import { BALANCE as B, ENEMIES, TOWERS } from '../content/data';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234 };

function freshSim(seed = 1234): Sim {
  return new Sim({ ...CFG, seed });
}

function buildableCell(s: Sim, skip = 0): number {
  let n = 0;
  for (let c = 0; c < s.map.cells.length; c++) {
    if (s.canBuildTower(c)) {
      if (n === skip) return c;
      n++;
    }
  }
  throw new Error('no buildable cell');
}

function organCell(s: Sim): number {
  for (let c = 0; c < s.map.cells.length; c++) {
    if (s.canBuildOrgan(c)) return c;
  }
  throw new Error('no organ cell');
}

describe('rng determinism', () => {
  it('same seed, same stream', () => {
    const a = new Rng(99);
    const b = new Rng(99);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });
  it('weighted pick respects zero weights', () => {
    const r = new Rng(5);
    for (let i = 0; i < 200; i++) {
      const pick = r.weighted(['a', 'b', 'c'], (x) => (x === 'b' ? 1 : 0));
      expect(pick).toBe('b');
    }
  });
});

describe('sim determinism', () => {
  it('two sims with the same seed stay identical over 2000 ticks', () => {
    const a = freshSim(777);
    const b = freshSim(777);
    for (let i = 0; i < 2000; i++) {
      a.tick();
      b.tick();
    }
    expect(a.biomass).toBe(b.biomass);
    expect(a.meat).toEqual(b.meat);
    expect(a.enemies.length).toBe(b.enemies.length);
    expect(a.threat).toBe(b.threat);
  });
});

describe('economy and building', () => {
  it('starts with the configured wallet and a full hand', () => {
    const s = freshSim();
    expect(s.meat.war).toBe(B.startMeat.war);
    expect(s.hand.length).toBe(B.handSize);
  });

  it('builds a tower, pays for it, and refills the hand', () => {
    const s = freshSim();
    s.meat.war = 999;
    s.meat.science = 999;
    const family = s.hand[0].family;
    const cost = towerSpec(family).cost;
    const cell = buildableCell(s);
    const before = { ...s.meat };
    const res = s.issue({ kind: 'build', cardIndex: 0, cell });
    expect(res.ok).toBe(true);
    expect(s.towers.length).toBe(1);
    expect(s.hand.length).toBe(B.handSize);
    expect(s.meat.war).toBe(before.war - (cost.war ?? 0));
  });

  it('refuses to build off-creep, in buildings, on occupied cells, or without meat', () => {
    const s = freshSim();
    s.meat.war = 999;
    s.meat.science = 999;

    // A building cell is never buildable, creeped or not.
    const block = s.map.cells.findIndex((c) => c === CellType.Block);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: block }).ok).toBe(false);

    // A far passable cell outside the creep is not buildable yet.
    const farRoad = s.gates[0];
    expect(s.isCreeped(farRoad)).toBe(false);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: farRoad }).ok).toBe(false);

    const cell = buildableCell(s);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell }).ok).toBe(true);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell }).ok).toBe(false); // occupied

    s.meat.war = 0;
    s.meat.science = 0;
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s) }).ok).toBe(false);
  });

  it('organs only build inside the body', () => {
    const s = freshSim();
    s.meat.war = 999;
    s.meat.science = 999;
    // A creeped cell beyond the body range is tower-buildable but not organ-buildable.
    let beyond = -1;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildTower(c) && !s.isBody(c)) { beyond = c; break; }
    }
    expect(beyond).toBeGreaterThanOrEqual(0);
    expect(s.issue({ kind: 'build-organ', organ: 'heart', cell: beyond }).ok).toBe(false);
    expect(s.issue({ kind: 'build-organ', organ: 'heart', cell: organCell(s) }).ok).toBe(true);
  });

  it('starting layout: exactly `entrances` frontier gates, all connected, guns-first', () => {
    // Baseline: ONE entrance, and a pre-placed connector district beyond it,
    // so the walk from the gate to the core crosses a full district.
    const s = freshSim();
    expect(s.entrances).toBe(1);
    expect(s.gates.length).toBe(1);
    expect(Number.isFinite(s.flowDistOf(s.gates[0]))).toBe(true);
    expect(s.map.slots.filter(Boolean).length).toBe(2); // crash site + connector
    expect(s.creepDistOf(s.gates[0])).toBeGreaterThan(10); // a district away, not next door

    // The wager: more entrances, more pre-placed districts, richer meat.
    const s3 = new Sim({ ...CFG, seed: 77, entrances: 3 });
    expect(s3.gates.length).toBe(3);
    expect(s3.map.slots.filter(Boolean).length).toBe(4);
    expect(s3.entranceMeatMult).toBeCloseTo(1.5);
    for (const gate of s3.gates) {
      expect(Number.isFinite(s3.flowDistOf(gate))).toBe(true);
    }
  });

  it('a spine wall in a street raises the flow cost through it (plugging works)', () => {
    const s = freshSim();
    s.meat.war = 9999;
    s.meat.science = 9999;
    // Draw until a spine card is in hand (discards are deterministic).
    let spineIdx = -1;
    for (let guard = 0; guard < 200 && spineIdx < 0; guard++) {
      spineIdx = s.hand.findIndex((c) => c.family === 'spine');
      if (spineIdx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(spineIdx).toBeGreaterThanOrEqual(0);
    // Let the creep reach a street cell.
    let roadCell = -1;
    for (let guard = 0; guard < 40 && roadCell < 0; guard++) {
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] === CellType.Road && s.canBuildTower(c, 'spine')) { roadCell = c; break; }
      }
      if (roadCell < 0) for (let i = 0; i < 100; i++) s.tick();
    }
    expect(roadCell).toBeGreaterThanOrEqual(0);
    const before = s.flowDistOf(roadCell);
    expect(s.issue({ kind: 'build', cardIndex: spineIdx, cell: roadCell }).ok).toBe(true);
    const after = s.flowDistOf(roadCell);
    expect(after).toBeGreaterThan(before + 100); // wall cost applied to routing

    // And a shooter can NOT stand in the street.
    let shooterIdx = s.hand.findIndex((c) => c.family !== 'spine');
    expect(shooterIdx).toBeGreaterThanOrEqual(0);
    let roadCell2 = -1;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] === CellType.Road && s.canBuildTower(c, 'spine') && c !== roadCell) { roadCell2 = c; break; }
    }
    if (roadCell2 >= 0) {
      expect(s.issue({ kind: 'build', cardIndex: shooterIdx, cell: roadCell2 }).ok).toBe(false);
    }
  });

  it('enemies never stand inside buildings', () => {
    const s = freshSim(4321);
    for (let i = 0; i < 3000; i++) s.tick();
    expect(s.enemies.length).toBeGreaterThan(0);
    for (const e of s.enemies) {
      expect(isPassable(s.map.cells[s.cellAt(e.pos.x, e.pos.y)])).toBe(true);
    }
  });
});

describe('cannibalize inheritance', () => {
  it('donor family becomes a pip and stats shift deterministically', () => {
    const s = freshSim();
    s.meat.war = 999;
    s.meat.science = 999;
    // Force known families into the hand by building whatever is there onto cells,
    // then testing pure stat math directly.
    const base: Tower = {
      id: 1, family: 'spitter', pos: { x: 0, y: 0 }, cell: 0,
      hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0,
    };
    const plain = towerStats(base);
    const modded = towerStats({ ...base, pips: [{ family: 'spitter' }, { family: 'lasher' }] });
    expect(modded.rate).toBeCloseTo(plain.rate * (1 + B.pipRate));
    expect(modded.damage).toBeCloseTo(plain.damage * (1 + B.pipDamage));
    // Pips also raise interest (weird builds attract researchers).
    expect(modded.interest).toBeGreaterThan(plain.interest);
  });

  it('cannibalizing removes the donor and carries its pips forward', () => {
    const s = freshSim();
    s.meat.war = 9999;
    s.meat.science = 9999;
    const cellA = buildableCell(s);
    const cellB = buildableCell(s, 1);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: cellA }).ok).toBe(true);
    const donor = s.towers[0];
    const donorFamily = donor.family;
    expect(s.issue({
      kind: 'build', cardIndex: 0, cell: cellB, cannibalizeTowerId: donor.id,
    }).ok).toBe(true);
    expect(s.towers.length).toBe(1);
    const built = s.towers[0];
    expect(built.pips.length).toBe(1);
    expect(built.pips[0].family).toBe(donorFamily);
  });
});

describe('draw odds', () => {
  it('brain node multiplies advanced tower weights', () => {
    const s = freshSim();
    const before = s.drawWeights();
    s.meat.war = 999;
    s.meat.science = 999;
    expect(s.issue({ kind: 'build-organ', organ: 'brain', cell: organCell(s) }).ok).toBe(true);
    const after = s.drawWeights();
    for (const t of TOWERS) {
      if (t.advanced) expect(after[t.family]).toBeGreaterThan(before[t.family]);
      else expect(after[t.family]).toBe(before[t.family]);
    }
  });
});

describe('attraction and escalation', () => {
  it('interest rises with lure glands and pips', () => {
    const s = freshSim();
    const i0 = s.interest;
    s.meat.war = 9999;
    s.meat.science = 9999;
    s.issue({ kind: 'build-organ', organ: 'gland', cell: organCell(s) });
    const gland = s.organs.find((o) => o.organ === 'gland')!;
    s.issue({ kind: 'cycle-gland', organInstanceId: gland.id });
    expect(gland.glandMode).toBe('lure');
    expect(s.interest).toBeGreaterThan(i0);
  });

  it('threat tier climbs the wave table with threat', () => {
    const s = freshSim();
    expect(s.tier).toBe(0);
    // Simulate a pile of kills via biomass-driven threat.
    s.biomass = 2500;
    expect(s.tier).toBeGreaterThan(0);
  });
});

describe('higher enemy types (escalation by kind, never hardening)', () => {
  it('enemy HP is identical at wave 1 and wave 30 — no stat inflation', () => {
    const s = freshSim(555);
    (s as unknown as { waveNumber: number }).waveNumber = 30;
    const before = s.enemies.length;
    // Force-spawn through the wave machinery by ticking into a siege.
    while (s.phase !== 'siege') s.tick();
    while (s.enemies.filter((e) => e.kind !== 'researcher').length === before) s.tick();
    const e = s.enemies.find((x) => x.kind !== 'researcher')!;
    const spec = ENEMIES.find((x) => x.kind === e.kind)!;
    expect(e.maxHp).toBe(spec.hp);
  });

  it('fliers cross building blocks; walkers never do', () => {
    const s = freshSim(556);
    s.meat.war = 0;
    // Hand-place a flier far from any street path line and tick.
    const gate = s.gates[0];
    const sim = s as unknown as { spawnEnemy(kind: string, atGate?: number): { id: number } };
    sim.spawnEnemy('flier', gate);
    let crossedBlock = false;
    for (let i = 0; i < 1200 && s.enemies.length > 0; i++) {
      s.tick();
      for (const e of s.enemies) {
        if (e.kind === 'flier' && s.map.cells[s.cellAt(e.pos.x, e.pos.y)] === CellType.Block) {
          crossedBlock = true;
        }
        if (e.kind !== 'flier' && e.kind !== 'researcher') {
          expect(isPassable(s.map.cells[s.cellAt(e.pos.x, e.pos.y)])).toBe(true);
        }
      }
    }
    expect(crossedBlock).toBe(true);
  });

  it('phalanx armor caps per-hit damage', () => {
    const s = freshSim(557);
    const sim = s as unknown as {
      spawnEnemy(kind: string): { id: number };
      damageEnemy(e: unknown, dmg: number, y: number): void;
    };
    sim.spawnEnemy('phalanx');
    const e = s.enemies.find((x) => x.kind === 'phalanx')!;
    const hp0 = e.hp;
    sim.damageEnemy(e, 500, 1); // one huge hit
    expect(hp0 - e.hp).toBe(12); // capped
    sim.damageEnemy(e, 8, 1); // small hits pass through whole
    expect(hp0 - e.hp).toBe(20);
  });

  it('sappers attack towers on blocks (perches are not safe)', () => {
    const s = freshSim(558);
    s.meat.war = 999;
    s.meat.science = 999;
    const cell = buildableCell(s);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell }).ok).toBe(true);
    const tower = s.towers[0];
    const sim = s as unknown as { spawnEnemy(kind: string, atGate?: number): { pos: { x: number; y: number } } };
    const sap = sim.spawnEnemy('sapper');
    sap.pos.x = tower.pos.x + 60;
    sap.pos.y = tower.pos.y;
    let attacked = false;
    for (let i = 0; i < 600 && !attacked; i++) {
      s.tick();
      if (s.towers.length === 0 || (s.towers[0] && s.towers[0].hp < s.towers[0].maxHp)) attacked = true;
    }
    expect(attacked).toBe(true);
  });
});
