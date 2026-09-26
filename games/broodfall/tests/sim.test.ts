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

  it('butcher by click: salvage refunded on the spot, traits bank into the next build', () => {
    const s = freshSim(600);
    s.meat.war = 200;
    s.meat.science = 200;
    // Force a spitter (known cost) into the hand.
    let idx = -1;
    for (let guard = 0; guard < 300 && idx < 0; guard++) {
      idx = s.hand.findIndex((c) => c.family === 'spitter');
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(s.issue({ kind: 'build', cardIndex: idx, cell: buildableCell(s) }).ok).toBe(true);
    const donor = s.towers[0];
    const warBefore = s.meat.war;
    expect(s.issue({ kind: 'butcher', towerId: donor.id }).ok).toBe(true);
    // Spitter costs 13 war; salvage floor(13 * 0.6) = 7 back, immediately.
    expect(s.meat.war).toBe(warBefore + Math.floor((towerSpec('spitter').cost.war ?? 0) * B.salvageRate));
    expect(s.towers.length).toBe(0);
    expect(s.pendingPips.length).toBe(1);
    expect(s.pendingPips[0].family).toBe('spitter');
    // The next build inherits and clears the bank.
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s) }).ok).toBe(true);
    expect(s.towers[0].pips.length).toBe(1);
    expect(s.pendingPips.length).toBe(0);
  });

  it('butchering twice stacks both trait histories into one build', () => {
    const s = freshSim(601);
    s.meat.war = 999;
    s.meat.science = 999;
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s) }).ok).toBe(true);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s, 1) }).ok).toBe(true);
    const [a, b] = [...s.towers];
    s.issue({ kind: 'butcher', towerId: a.id });
    s.issue({ kind: 'butcher', towerId: b.id });
    expect(s.pendingPips.length).toBe(2);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s) }).ok).toBe(true);
    expect(s.towers[0].pips.length).toBe(2);
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

describe('creep logistics (sling patches + directional roots)', () => {
  function forceCard(s: Sim, family: string): number {
    let idx = -1;
    for (let guard = 0; guard < 400 && idx < 0; guard++) {
      idx = s.hand.findIndex((c) => c.family === family);
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(idx).toBeGreaterThanOrEqual(0);
    return idx;
  }

  it('a hurled clot seeds distant creep you can build on; cooldown and range are real', () => {
    const s = freshSim(700);
    s.meat.war = 9999;
    s.meat.science = 9999;
    const idx = forceCard(s, 'sling');
    const slingCell = buildableCell(s);
    expect(s.issue({ kind: 'build', cardIndex: idx, cell: slingCell }).ok).toBe(true);
    const sling = s.towers.find((t) => t.family === 'sling')!;
    // Find a far, uncreeped, non-void target inside throw range.
    let target = -1;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] === CellType.Void || s.isCreeped(c)) continue;
      const p = s.cellCenter(c);
      const d = Math.hypot(p.x - sling.pos.x, p.y - sling.pos.y);
      if (d < B.slingRange * 0.95 && d > B.slingRange * 0.5) { target = c; break; }
    }
    expect(target).toBeGreaterThanOrEqual(0);
    expect(s.canBuildTower(target)).toBe(false);
    expect(s.issue({ kind: 'sling-throw', towerId: sling.id, cell: target }).ok).toBe(true);
    // Recharging: a second throw is refused.
    expect(s.issue({ kind: 'sling-throw', towerId: sling.id, cell: target }).ok).toBe(false);
    for (let i = 0; i < 15; i++) s.tick(); // the clot lands
    expect(s.isCreeped(target)).toBe(true);
    // Some cell near the landing is now buildable ground.
    let buildableNearby = false;
    for (let c = 0; c < s.map.cells.length && !buildableNearby; c++) {
      const p = s.cellCenter(c);
      const t = s.cellCenter(target);
      if (Math.hypot(p.x - t.x, p.y - t.y) < 80 && s.canBuildTower(c)) buildableNearby = true;
    }
    expect(buildableNearby).toBe(true);
    // Void stays untouchable.
    const voidCell = s.map.cells.findIndex((c) => c === CellType.Void);
    expect(s.issue({ kind: 'sling-throw', towerId: sling.id, cell: voidCell }).ok).toBe(false);
  });

  it('a tendril root grows creep in ITS direction, cycles on command', () => {
    const s = freshSim(701);
    s.meat.war = 9999;
    s.meat.science = 9999;
    expect(s.issue({ kind: 'build-organ', organ: 'root', cell: organCell(s) }).ok).toBe(true);
    const root = s.organs.find((o) => o.organ === 'root')!;
    expect(root.rootDir).toBeDefined();
    const src = s.creepSources.find((x) => x.kind === 'root')!;
    expect(src.dir).toBe(root.rootDir);
    // The lobe reaches down-direction, not up-direction, at equal hop distance.
    const covers = (s as unknown as { sourceCovers(x: unknown, cell: number): boolean });
    src.bornAt = -60; // a minute of growth, without moving the core's own creep
    const w = s.cfg.gridW;
    const dirOff = root.rootDir === 'N' ? -6 * w : root.rootDir === 'S' ? 6 * w : root.rootDir === 'E' ? 6 : -6;
    const ahead = root.cell + dirOff;
    const behind = root.cell - dirOff;
    if (s.map.cells[ahead] !== CellType.Void) {
      expect(covers.sourceCovers(src, ahead)).toBe(true);
    }
    if (s.map.cells[behind] !== CellType.Void) {
      expect(covers.sourceCovers(src, behind)).toBe(false);
    }
    // Cycling re-aims the lobe.
    const before = root.rootDir;
    expect(s.issue({ kind: 'cycle-root', organInstanceId: root.id }).ok).toBe(true);
    expect(root.rootDir).not.toBe(before);
    expect(src.dir).toBe(root.rootDir);
  });

  it('a sling pip makes any limb seep creep around itself', () => {
    const base: Tower = {
      id: 1, family: 'spitter', pos: { x: 0, y: 0 }, cell: 0,
      hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0,
    };
    expect(towerStats(base).seepRadius).toBe(0);
    expect(towerStats({ ...base, pips: [{ family: 'sling' }] }).seepRadius).toBe(B.pipSeep);
    // And the sim maintains a seep source for such a limb.
    const s = freshSim(702);
    s.meat.war = 9999;
    s.meat.science = 9999;
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s) }).ok).toBe(true);
    const donor = s.towers[0];
    donor.pips.push({ family: 'sling' });
    s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s) }); // triggers refreshRouting
    expect(s.creepSources.some((x) => x.kind === 'seep' && x.ownerId === donor.id)).toBe(true);
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

  it('drummers speed up nearby hive units (kill the drummer first)', () => {
    const s = freshSim(560);
    const sim = s as unknown as { spawnEnemy(kind: string, atGate?: number): { pos: { x: number; y: number } } };
    const soldier = sim.spawnEnemy('soldier', s.gates[0]);
    const alone = s.moveSpeedOf(s.enemies[0]);
    const drummer = sim.spawnEnemy('drummer', s.gates[0]);
    drummer.pos.x = soldier.pos.x + 10;
    drummer.pos.y = soldier.pos.y;
    const drummed = s.moveSpeedOf(s.enemies[0]);
    expect(drummed).toBeCloseTo(alone * B.drummerSpeedMult);
    // The drummer does not drum for itself.
    const drummerE = s.enemies.find((e) => e.kind === 'drummer')!;
    expect(s.moveSpeedOf(drummerE)).toBeCloseTo(ENEMIES.find((e) => e.kind === 'drummer')!.speed);
  });

  it('bombers detonate against structures (walls are not safe)', () => {
    const s = freshSim(561);
    s.meat.war = 9999;
    s.meat.science = 9999;
    // Plug a street with a spine wall on the gate lane.
    let spineIdx = -1;
    for (let guard = 0; guard < 200 && spineIdx < 0; guard++) {
      spineIdx = s.hand.findIndex((c) => c.family === 'spine');
      if (spineIdx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    let roadCell = -1;
    for (let guard = 0; guard < 40 && roadCell < 0; guard++) {
      for (let c = 0; c < s.map.cells.length; c++) {
        if (s.map.cells[c] === CellType.Road && s.canBuildTower(c, 'spine')) { roadCell = c; break; }
      }
      if (roadCell < 0) for (let i = 0; i < 100; i++) s.tick();
    }
    expect(s.issue({ kind: 'build', cardIndex: spineIdx, cell: roadCell }).ok).toBe(true);
    const wall = s.towers[0];
    const hp0 = wall.hp;
    const sim = s as unknown as { spawnEnemy(kind: string, atGate?: number): { pos: { x: number; y: number } } };
    const bomber = sim.spawnEnemy('bomber', s.gates[0]);
    // Drop the bomber on a walkable street cell near the wall (not inside a building).
    const w = 50;
    // Prefer two cells out: beyond the contact radius, inside the charge radius.
    const near = [roadCell - 2, roadCell + 2, roadCell - 2 * w, roadCell + 2 * w,
      roadCell - 1, roadCell + 1, roadCell - w, roadCell + w]
      .find((c) => c >= 0 && c < s.map.cells.length && s.map.cells[c] === CellType.Road);
    expect(near).toBeDefined();
    const nc = s.cellCenter(near!);
    bomber.pos.x = nc.x;
    bomber.pos.y = nc.y;
    let boomed = false;
    for (let i = 0; i < 400 && !boomed; i++) {
      s.tick();
      const w = s.towers.find((t) => t.id === wall.id);
      if (!w || w.hp <= hp0 - B.bomberBlastDamage + 1) boomed = true;
    }
    expect(boomed).toBe(true);
    expect(s.enemies.some((e) => e.kind === 'bomber')).toBe(false); // spent
  });

  it('tunnelers spawn burrowed and untargetable, then surface past the outer line', () => {
    const s = freshSim(562);
    const sim = s as unknown as { spawnEnemy(kind: string, atGate?: number): { pos: { x: number; y: number } } };
    sim.spawnEnemy('tunneler', s.gates[0]);
    const t = s.enemies.find((e) => e.kind === 'tunneler')!;
    expect(t.burrowed).toBe(true);
    expect(t.surfaceFlowDist).toBeGreaterThan(0);
    const spawnDist = s.flowDistOf(s.cellAt(t.pos.x, t.pos.y));
    let surfacedAt = -1;
    for (let i = 0; i < 3000 && surfacedAt < 0; i++) {
      s.tick();
      const cur = s.enemies.find((e) => e.kind === 'tunneler');
      if (!cur) break;
      expect(cur.hp).toBe(cur.maxHp); // nothing can hit it underground (no towers built, core can't either)
      if (!cur.burrowed) surfacedAt = s.flowDistOf(s.cellAt(cur.pos.x, cur.pos.y));
    }
    expect(surfacedAt).toBeGreaterThanOrEqual(0);
    expect(surfacedAt).toBeLessThan(spawnDist * 0.6); // well past the outer defenses
  });

  it('tenders heal wounded neighbours on a pulse', () => {
    const s = freshSim(563);
    const sim = s as unknown as {
      spawnEnemy(kind: string, atGate?: number): { pos: { x: number; y: number } };
      damageEnemy(e: unknown, dmg: number, y: number): void;
    };
    const soldier = sim.spawnEnemy('soldier', s.gates[0]);
    const sE = s.enemies.find((e) => e.kind === 'soldier')!;
    sim.damageEnemy(sE, 40, 0);
    const wounded = sE.hp;
    const tender = sim.spawnEnemy('tender', s.gates[0]);
    tender.pos.x = soldier.pos.x + 10;
    tender.pos.y = soldier.pos.y;
    let healed = false;
    for (let i = 0; i < 60 && !healed; i++) {
      s.tick();
      if (sE.hp > wounded) healed = true;
    }
    expect(healed).toBe(true);
    expect(sE.hp).toBeLessThanOrEqual(sE.maxHp);
  });

  it('snare slows expire; blight ticks damage through armor caps', () => {
    const s = freshSim(564);
    const sim = s as unknown as {
      spawnEnemy(kind: string, atGate?: number): { id: number };
      applyHitEffects(e: unknown, fx: { slowMult: number; slowDur: number; poisonDps: number; poisonDur: number }): void;
    };
    sim.spawnEnemy('phalanx', s.gates[0]);
    const e = s.enemies.find((x) => x.kind === 'phalanx')!;
    sim.applyHitEffects(e, { slowMult: 0.55, slowDur: 1.0, poisonDps: 10, poisonDur: 1.0 });
    const spec = ENEMIES.find((x) => x.kind === 'phalanx')!;
    expect(s.moveSpeedOf(e)).toBeCloseTo(spec.speed * 0.55);
    const hp0 = e.hp;
    for (let i = 0; i < 15; i++) s.tick(); // 1.5s: poison window ends
    expect(e.hp).toBeLessThan(hp0); // ticked well past the 12-per-hit armor cap rules
    expect(s.moveSpeedOf(e)).toBeCloseTo(spec.speed); // slow expired
  });

  it('impaler shots ignore armor caps and pierce a file', () => {
    const base: Tower = {
      id: 1, family: 'impaler', pos: { x: 0, y: 0 }, cell: 0,
      hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0,
    };
    expect(towerStats(base).capBonus).toBe(Infinity);
    const s = freshSim(565);
    const sim = s as unknown as {
      spawnEnemy(kind: string, atGate?: number): { id: number };
      damageEnemy(e: unknown, dmg: number, y: number, capBonus?: number): void;
    };
    sim.spawnEnemy('phalanx', s.gates[0]);
    const e = s.enemies.find((x) => x.kind === 'phalanx')!;
    const hp0 = e.hp;
    sim.damageEnemy(e, 34, 1, Infinity);
    expect(hp0 - e.hp).toBe(34); // straight through the shield wall
    // An impaler pip on another tower raises the cap it hits against.
    const pipped = towerStats({ ...base, family: 'spitter', pips: [{ family: 'impaler' }] });
    expect(pipped.capBonus).toBe(B.pipPierceCap);
  });

  it('choir nodes speed up the limbs around them (capped at two voices)', () => {
    const s = freshSim(566);
    s.meat.war = 9999;
    s.meat.science = 9999;
    const cellA = buildableCell(s);
    // Force a spitter into the hand.
    let idx = -1;
    for (let guard = 0; guard < 300 && idx < 0; guard++) {
      idx = s.hand.findIndex((c) => c.family === 'spitter');
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(s.issue({ kind: 'build', cardIndex: idx, cell: cellA }).ok).toBe(true);
    const spitter = s.towers[0];
    const rate0 = s.statsOf(spitter).rate;
    // Conjure a choir right next to it (placement rules are not under test here).
    const choir: Tower = {
      id: 999, family: 'choir', pos: { x: spitter.pos.x + 30, y: spitter.pos.y }, cell: 0,
      hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0,
    };
    s.towers.push(choir);
    expect(s.statsOf(spitter).rate).toBeGreaterThan(rate0);
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
