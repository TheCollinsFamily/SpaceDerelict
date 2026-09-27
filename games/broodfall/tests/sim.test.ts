import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import { Sim, fxOf, towerStats, towerSpec } from '../src/sim/sim';
import { CellType, isPassable } from '../src/sim/citymap';
import type { Enemy, SimConfig, Tower } from '../src/sim/types';
import { BALANCE as B, ENEMIES, TOWERS, WAVE_TABLE } from '../content/data';

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
    const blockCard = () => {
      for (let guard = 0; guard < 300 && ['swamp', 'spine'].includes(s.hand[0].family); guard++) {
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      return 0;
    };
    expect(s.issue({ kind: 'build', cardIndex: blockCard(), cell: buildableCell(s) }).ok).toBe(true);
    expect(s.issue({ kind: 'build', cardIndex: blockCard(), cell: buildableCell(s, 1) }).ok).toBe(true);
    const [a, b] = [...s.towers];
    s.issue({ kind: 'butcher', towerId: a.id });
    s.issue({ kind: 'butcher', towerId: b.id });
    expect(s.pendingPips.length).toBe(2);
    expect(s.issue({ kind: 'build', cardIndex: blockCard(), cell: buildableCell(s) }).ok).toBe(true);
    expect(s.towers[0].pips.length).toBe(2);
  });

  it('cannibalizing removes the donor and carries its pips forward', () => {
    const s = freshSim();
    s.meat.war = 9999;
    s.meat.science = 9999;
    // Discard until the first card is one that builds on a block (not a street piece).
    for (let guard = 0; guard < 300 && ['swamp', 'spine'].includes(s.hand[0].family); guard++) {
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
    const cellA = buildableCell(s);
    const cellB = buildableCell(s, 1);
    expect(s.issue({ kind: 'build', cardIndex: 0, cell: cellA }).ok).toBe(true);
    const donor = s.towers[0];
    const donorFamily = donor.family;
    for (let guard = 0; guard < 300 && ['swamp', 'spine'].includes(s.hand[0].family); guard++) {
      s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(s.issue({
      kind: 'build', cardIndex: 0, cell: cellB, cannibalizeTowerId: donor.id,
    }).ok).toBe(true);
    expect(s.towers.length).toBe(1);
    const built = s.towers[0];
    expect(built.pips.length).toBe(1);
    expect(built.pips[0].family).toBe(donorFamily);
  });
});

type SpawnSim = {
  spawnEnemy(kind: string, atGate?: number): { id: number; pos: { x: number; y: number } };
  damageEnemy(e: unknown, dmg: number, y: number, capBonus?: number): void;
  applyHitEffects(e: unknown, fx: Record<string, number>): void;
};

describe('the six genre-seat towers', () => {
  function place(s: Sim, family: string, cellPick?: (s: Sim) => number): Tower {
    s.meat.war = 9999;
    s.meat.science = 9999;
    let idx = -1;
    for (let guard = 0; guard < 500 && idx < 0; guard++) {
      idx = s.hand.findIndex((c) => c.family === family);
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(idx).toBeGreaterThanOrEqual(0);
    const cell = cellPick ? cellPick(s) : buildableCell(s);
    expect(s.issue({ kind: 'build', cardIndex: idx, cell }).ok).toBe(true);
    return s.towers[s.towers.length - 1];
  }

  function laneRoad(s: Sim): number {
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] === CellType.Road && s.canBuildTower(c, 'swamp')) return c;
    }
    throw new Error('no creeped road');
  }

  it('broodmother: spawns broodlings that fight, and enemies stop to fight THEM', () => {
    const s = freshSim(800);
    const mother = place(s, 'brood');
    for (let i = 0; i < 80 && s.broodlings.length === 0; i++) s.tick();
    expect(s.broodlings.length).toBeGreaterThan(0);
    // A hive soldier near a broodling engages it instead of marching on.
    const sim = s as unknown as SpawnSim;
    const soldier = sim.spawnEnemy('soldier', s.gates[0]);
    const b = s.broodlings[0];
    soldier.pos.x = b.pos.x + 6;
    soldier.pos.y = b.pos.y;
    const bHp0 = b.hp;
    const posBefore = { ...soldier.pos };
    for (let i = 0; i < 20; i++) s.tick();
    const moved = Math.hypot(soldier.pos.x - posBefore.x, soldier.pos.y - posBefore.y);
    expect(b.hp).toBeLessThan(bHp0);       // the soldier fought it
    expect(moved).toBeLessThan(30);        // and stood to do so
    // The brood dies with the mother.
    (s as unknown as { removeTower(id: number, e: boolean): void }).removeTower(mother.id, false);
    expect(s.broodlings.length).toBe(0);
  });

  it('digestive swamp: the ANTI-WALL — walked through, bogs and burns everyone, digests the weak IN MASS', () => {
    const s = freshSim(801);
    s.meat.war = 9999;
    s.meat.science = 9999;
    // Flow must NOT route around a swamp the way it does a wall.
    const road = laneRoad(s);
    const flowBefore = s.flowDistOf(road);
    const swamp = place(s, 'swamp', () => road);
    expect(s.flowDistOf(road)).toBeLessThan(flowBefore + 50); // no wall detour cost
    const sim = s as unknown as SpawnSim;
    // A crowd of weak bodies and one soldier all standing in it at once.
    const weak: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = sim.spawnEnemy('responder', s.gates[0]);
      r.pos.x = swamp.pos.x + (i % 3) * 6 - 6; r.pos.y = swamp.pos.y + Math.floor(i / 3) * 6;
      weak.push(r.id);
    }
    const soldier = sim.spawnEnemy('soldier', s.gates[0]);
    soldier.pos.x = swamp.pos.x; soldier.pos.y = swamp.pos.y;
    const sE = s.enemies.find((x) => x.id === soldier.id)!;
    s.tick();
    // Every responder (20 hp, under the 30-hp digest line) is gone in ONE tick — no hold limit.
    expect(s.enemies.filter((x) => weak.includes(x.id)).length).toBe(0);
    // The soldier wades on: hurt and slowed, not rooted, and the swamp takes no bite.
    const swampHp0 = swamp.hp;
    for (let i = 0; i < 5; i++) { s.tick(); sE.pos.x = swamp.pos.x; sE.pos.y = swamp.pos.y; }
    expect(sE.hp).toBeLessThan(sE.maxHp);
    const sp = ENEMIES.find((x) => x.kind === 'soldier')!.speed;
    expect(s.moveSpeedOf(sE)).toBeCloseTo(sp * 0.5, 0);
    expect(swamp.hp).toBe(swampHp0);
  });

  it('galvanic frond: one strike arcs through a clustered squad', () => {
    const s = freshSim(802);
    const frond = place(s, 'frond');
    const sim = s as unknown as SpawnSim;
    for (let i = 0; i < 3; i++) {
      const e = sim.spawnEnemy('militia', s.gates[0]);
      e.pos.x = frond.pos.x + 30 + i * 18;
      e.pos.y = frond.pos.y;
    }
    let sawArc = false;
    for (let i = 0; i < 25; i++) {
      s.tick();
      if (s.arcs.length > 0) sawArc = true;
    }
    const hurt = s.enemies.filter((e) => e.kind === 'militia' && e.hp < e.maxHp).length
      + (3 - s.enemies.filter((e) => e.kind === 'militia').length); // dead count as hurt
    expect(hurt).toBeGreaterThanOrEqual(2); // primary + at least one arc
    expect(sawArc).toBe(true);
  });

  it('bile lobber: aimed volley detonates on the chosen ground; recharge is real', () => {
    const s = freshSim(803);
    const lobber = place(s, 'lobber');
    const sim = s as unknown as SpawnSim;
    const cluster: Array<{ pos: { x: number; y: number } }> = [];
    for (let i = 0; i < 3; i++) {
      const e = sim.spawnEnemy('militia', s.gates[0]);
      e.pos.x = lobber.pos.x + 90 + (i % 2) * 14;
      e.pos.y = lobber.pos.y + Math.floor(i / 2) * 14;
      cluster.push(e);
    }
    const cell = s.cellAt(cluster[0].pos.x, cluster[0].pos.y);
    expect(s.issue({ kind: 'bile-throw', towerId: lobber.id, cell }).ok).toBe(true);
    expect(s.issue({ kind: 'bile-throw', towerId: lobber.id, cell }).ok).toBe(false); // recharging
    for (let i = 0; i < 12; i++) s.tick(); // glob lands
    const hurtOrDead = 3 - s.enemies.filter((e) => e.kind === 'militia' && e.hp >= e.maxHp).length;
    expect(hurtOrDead).toBeGreaterThanOrEqual(2);
  });

  it('caustic mister: shredded armor lets EVERY source hit past the cap', () => {
    const s = freshSim(804);
    const sim = s as unknown as SpawnSim;
    sim.spawnEnemy('phalanx', s.gates[0]);
    const e = s.enemies.find((x) => x.kind === 'phalanx')!;
    // Unshredded: a huge hit is capped at 12.
    let hp0 = e.hp;
    sim.damageEnemy(e, 500, 1);
    expect(hp0 - e.hp).toBe(12);
    // Shredded (+8 for 4s): the same hit bites 20 deep — from ANY tower.
    sim.applyHitEffects(e, { slowMult: 1, slowDur: 0, poisonDps: 0, poisonDur: 0, shred: 8, shredDur: 4 });
    hp0 = e.hp;
    sim.damageEnemy(e, 500, 1);
    expect(hp0 - e.hp).toBe(20);
  });

  it('ocular stalk: board-wide reach and it executes the drummer before the closer soldier', () => {
    const s = freshSim(805);
    const ocular = place(s, 'ocular');
    const sim = s as unknown as SpawnSim;
    const soldier = sim.spawnEnemy('soldier', s.gates[0]);
    soldier.pos.x = ocular.pos.x + 40; // right next door
    soldier.pos.y = ocular.pos.y;
    const drummer = sim.spawnEnemy('drummer', s.gates[0]); // far away at the gate
    const dE = s.enemies.find((x) => x.kind === 'drummer')!;
    const sE = s.enemies.find((x) => x.kind === 'soldier')!;
    for (let i = 0; i < 95 && dE.hp >= dE.maxHp; i++) s.tick();
    expect(dE.hp).toBeLessThan(dE.maxHp);  // the far support died first in priority
    expect(sE.hp).toBe(sE.maxHp);          // the near soldier was ignored
    void drummer;
  });
});

describe('new enemy verbs, castes, and the risk law', () => {
  it('every WAR-wave kind is war caste; science and royals never march in waves', () => {
    const kinds = new Set<string>();
    for (const row of WAVE_TABLE) for (const k of Object.keys(row)) kinds.add(k);
    for (const k of kinds) {
      expect(ENEMIES.find((e) => e.kind === k)!.caste).toBe('war');
    }
    // Faction sanity for the visitors and the court.
    expect(ENEMIES.find((e) => e.kind === 'thief')!.caste).toBe('science');
    expect(ENEMIES.find((e) => e.kind === 'researcher')!.stealsLimbs).toBe(true);
    expect(ENEMIES.find((e) => e.kind === 'researcher')!.caste).toBe('science');
    expect(ENEMIES.find((e) => e.kind === 'consort')!.caste).toBe('royal');
    expect(ENEMIES.find((e) => e.kind === 'royal')!.caste).toBe('royal');
    // Every kind carries a positive risk.
    for (const e of ENEMIES) expect(e.risk).toBeGreaterThan(0);
  });

  it('risk law: the clock multiplies cheap ranks fast and risky specialists slowly', () => {
    const s = freshSim(900);
    (s as unknown as { wavesCleared: number }).wavesCleared = 12; // scale 2.2
    s.biomass = 6000; // deep tier
    while (s.phase !== 'siege') s.tick();
    const ev = (s as unknown as { events: unknown[] });
    void ev;
    // Recompute what startSiege computed: growth for soldier vs sapper.
    const scale = 1 + 12 * B.waveCountScale;
    const soldierGrowth = 1 + (scale - 1) * (B.riskBaseline / ENEMIES.find((e) => e.kind === 'soldier')!.risk);
    const sapperGrowth = 1 + (scale - 1) * (B.riskBaseline / ENEMIES.find((e) => e.kind === 'sapper')!.risk);
    expect(soldierGrowth).toBeGreaterThan(sapperGrowth * 1.5);
    expect(s.waveRisk).toBeGreaterThan(0); // the danger number is telegraphed
  });

  it('splitter bursts into skitterlings when shot — but not when eaten whole', () => {
    const s = freshSim(901);
    const sim = s as unknown as SpawnSim & { eatEnemy(e: unknown): void };
    sim.spawnEnemy('splitter', s.gates[0]);
    const sp = s.enemies.find((x) => x.kind === 'splitter')!;
    sim.damageEnemy(sp, 999, 1);
    expect(s.enemies.filter((x) => x.kind === 'skitterling').length).toBe(2);
    // Eaten whole: no children.
    sim.spawnEnemy('splitter', s.gates[0]);
    const sp2 = s.enemies.find((x) => x.kind === 'splitter')!;
    sim.eatEnemy(sp2);
    expect(s.enemies.filter((x) => x.kind === 'skitterling').length).toBe(2);
  });

  it('carapace shell eats whole hits (big-hit mirror of the phalanx); poison seeps through', () => {
    const s = freshSim(902);
    const sim = s as unknown as SpawnSim;
    sim.spawnEnemy('carapace', s.gates[0]);
    const e = s.enemies.find((x) => x.kind === 'carapace')!;
    const shell = ENEMIES.find((x) => x.kind === 'carapace')!.hitShield!;
    expect(e.hitShield).toBe(shell);
    for (let i = 0; i < shell; i++) sim.damageEnemy(e, 500, 1);
    expect(e.hp).toBe(e.maxHp); // shell ate all eight
    expect(e.hitShield).toBe(0);
    sim.damageEnemy(e, 30, 1);
    expect(e.hp).toBe(e.maxHp - 30); // shell gone, damage lands
    // Poison is not a hit: it ticks through a fresh shell.
    sim.spawnEnemy('carapace', s.gates[0]);
    const e2 = s.enemies.filter((x) => x.kind === 'carapace')[1] ?? s.enemies.find((x) => x.kind === 'carapace' && x !== e)!;
    sim.applyHitEffects(e2, { slowMult: 1, slowDur: 0, poisonDps: 10, poisonDur: 1 });
    for (let i = 0; i < 10; i++) s.tick();
    expect(e2.hp).toBeLessThan(e2.maxHp);
  });

  it('mortar besieges structures from standoff range — melee walls cannot answer it', () => {
    const s = freshSim(903);
    s.meat.war = 9999;
    s.meat.science = 9999;
    let spineIdx = -1;
    for (let guard = 0; guard < 300 && spineIdx < 0; guard++) {
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
    const sim = s as unknown as SpawnSim;
    const m = sim.spawnEnemy('mortar', s.gates[0]);
    m.pos.x = wall.pos.x + 70; // inside standoff, outside melee contact
    m.pos.y = wall.pos.y;
    const hp0 = wall.hp;
    const mx = m.pos.x;
    for (let i = 0; i < 60; i++) s.tick();
    expect(wall.hp).toBeLessThan(hp0);                 // bombarded
    expect(Math.abs(m.pos.x - mx)).toBeLessThan(20);   // from where it stood
  });

  it('thief steals war meat at the creep and drops it when killed', () => {
    const s = freshSim(904);
    s.meat.war = 100;
    const sim = s as unknown as SpawnSim & { killEnemy(id: number, y: number, e: boolean): void };
    sim.spawnEnemy('thief', s.gates[0]);
    const t = s.enemies.find((x) => x.kind === 'thief')!;
    let stole = false;
    for (let i = 0; i < 2000 && !stole; i++) {
      s.tick();
      if (t.stole !== undefined && t.stole > 0) stole = true;
      if (!s.enemies.includes(t)) break;
    }
    expect(stole).toBe(true);
    expect(t.leaving).toBe(true);          // running for the edge with the goods
    const warAfterTheft = s.meat.war;
    sim.killEnemy(t.id, 0, false);
    expect(s.meat.war).toBe(warAfterTheft + t.stole!); // recovered on the kill
  });

  it('a thief that escapes keeps the meat (no recovery event ever fires)', () => {
    const s = freshSim(905);
    s.meat.war = 100;
    s.coreHp = 999999; // keep the field alive while the courier runs
    const sim = s as unknown as SpawnSim;
    sim.spawnEnemy('thief', s.gates[0]);
    const t = s.enemies.find((x) => x.kind === 'thief')!;
    let sawTheft = false;
    let sawRecovery = false;
    let ticks = 0;
    while (s.enemies.includes(t) && ticks++ < 6000) {
      s.tick();
      for (const e of s.takeEvents()) {
        if (e.kind === 'meat-stolen') sawTheft = true;
        if (e.kind === 'meat-recovered') sawRecovery = true;
      }
    }
    expect(s.enemies.includes(t)).toBe(false); // slipped off the field
    expect(sawTheft).toBe(true);
    expect(sawRecovery).toBe(false); // the meat is gone for good
  });

  it('consort PROMOTES the war bodies around it one rank per pulse', () => {
    const s = freshSim(906);
    const sim = s as unknown as SpawnSim;
    const c = sim.spawnEnemy('consort', s.gates[0]);
    const m = sim.spawnEnemy('militia', s.gates[0]);
    m.pos.x = c.pos.x + 20;
    m.pos.y = c.pos.y;
    const militia = s.enemies.find((x) => x.id === m.id)!;
    for (let i = 0; i < 2; i++) s.tick(); // first pulse fires immediately
    expect(militia.kind).toBe('soldier');
    expect(militia.maxHp).toBe(ENEMIES.find((x) => x.kind === 'soldier')!.hp);
  });

  it('royal presence: war bodies nearby hit harder and take less damage; far ones do not', () => {
    const s = freshSim(907);
    const sim = s as unknown as SpawnSim & { updateEnemies(): void };
    const r = sim.spawnEnemy('royal', s.gates[0]);
    const near = sim.spawnEnemy('soldier', s.gates[0]);
    near.pos.x = r.pos.x + 30; near.pos.y = r.pos.y;
    sim.updateEnemies(); // refresh the aura sources
    const nearE = s.enemies.find((x) => x.id === near.id)!;
    expect(s.empowerOf(nearE)).toBe(B.royalAuraDamageMult);
    const hp0 = nearE.hp;
    sim.damageEnemy(nearE, 10, 0);
    expect(hp0 - nearE.hp).toBeCloseTo(10 * B.royalAuraArmor);
    // Royals themselves are simply strong, not self-buffed; far bodies unaffected.
    expect(s.empowerOf(s.enemies.find((x) => x.id === r.id)!)).toBe(1);
    nearE.pos.x = r.pos.x + B.royalAuraRadius + 50;
    expect(s.empowerOf(nearE)).toBe(1);
  });

  it('science caste default: target the LEAST-COVERED limb, sedate it, carry it off; a kill brings it home', () => {
    const s = freshSim(908);
    s.meat.war = 9999;
    s.meat.science = 9999;
    // Build three limbs a walker can stand beside.
    const stand = (s as unknown as { standCellFor(c: number): number });
    const cells: number[] = [];
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.canBuildTower(c) && stand.standCellFor(c) >= 0) cells.push(c);
    }
    cells.sort((a, b) => s.creepDistOf(a) - s.creepDistOf(b));
    for (const cell of [cells[0], cells[1], cells[cells.length - 1]]) {
      for (let g = 0; g < 300 && ['swamp', 'spine'].includes(s.hand[0].family); g++) {
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      expect(s.issue({ kind: 'build', cardIndex: 0, cell }).ok).toBe(true);
    }
    // The chosen mark really is the least covered approach.
    const weak = s.vulnerableTower()!;
    const weakDanger = s.dangerAt(stand.standCellFor(weak.cell));
    for (const t of s.towers) {
      expect(weakDanger).toBeLessThanOrEqual(s.dangerAt(stand.standCellFor(t.cell)));
    }
    weak.pips.push({ family: 'lasher' }); // a trait that must survive the round trip
    const weakCell = weak.cell;
    // Silence the limbs so we can watch the theft (normally your guns shoot
    // the researcher off the job — that IS the counterplay).
    for (const t of s.towers) t.cooldown = 1e9;
    const sim = s as unknown as SpawnSim & { killEnemy(id: number, y: number, e: boolean): void };
    const r = sim.spawnEnemy('researcher', s.gates[0]);
    const rE = s.enemies.find((x) => x.id === r.id)!;
    let stolen = false;
    for (let i = 0; i < 8000 && !stolen; i++) {
      s.tick();
      if (rE.carrying) stolen = true;
      for (const t of s.towers) t.cooldown = 1e9;
    }
    expect(stolen).toBe(true);
    expect(s.towers.some((t) => t.cell === weakCell)).toBe(false);
    sim.killEnemy(rE.id, 0, false);
    const back = s.towers.find((t) => t.cell === weakCell)!;
    expect(back).toBeDefined();
    expect(back.pips.some((p) => p.family === 'lasher')).toBe(true);
    expect(back.hp).toBe(back.maxHp);
  });

  it('science caste routes AROUND gun coverage: its path is never more exposed than the straight march', () => {
    const s = freshSim(909);
    s.meat.war = 9999;
    s.meat.science = 9999;
    for (let k = 0; k < 4; k++) {
      for (let g = 0; g < 300 && ['swamp', 'spine'].includes(s.hand[0].family); g++) {
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      s.issue({ kind: 'build', cardIndex: 0, cell: buildableCell(s, k * 3) });
    }
    const goal = s.map.coreCell;
    const smart = (s as unknown as { routeTo(c: number): { next: Int32Array } }).routeTo(goal);
    const exposure = (next: (c: number) => number) => {
      let c = s.gates[0];
      let sum = 0;
      for (let guard = 0; c >= 0 && guard < 2000; guard++) { sum += s.dangerAt(c); c = next(c); }
      return sum;
    };
    const smartExposure = exposure((c) => smart.next[c]);
    const marchExposure = exposure((c) => s.flowNextOf(c));
    expect(smartExposure).toBeLessThanOrEqual(marchExposure);
  });
});

describe('player targeting (click a limb, choose how it picks)', () => {
  function setup(seed: number) {
    const s = freshSim(seed);
    s.meat.war = 9999;
    s.meat.science = 9999;
    let idx = -1;
    for (let g = 0; g < 400 && idx < 0; g++) {
      idx = s.hand.findIndex((c) => c.family === 'spitter');
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(s.issue({ kind: 'build', cardIndex: idx, cell: buildableCell(s) }).ok).toBe(true);
    return { s, t: s.towers[0] };
  }
  const pick = (s: Sim, t: Tower) =>
    (s as unknown as { pickTarget(t: Tower, st: unknown): { id: number } | null })
      .pickTarget(t, { ...s.statsOf(t), range: 500 });

  it('strongest / weakest / caste focus choose the right body', () => {
    const { s, t } = setup(950);
    const sim = s as unknown as SpawnSim;
    const weak = sim.spawnEnemy('responder', s.gates[0]);
    const strong = sim.spawnEnemy('elite', s.gates[0]);
    const sci = sim.spawnEnemy('researcher', s.gates[0]);
    for (const e of [weak, strong, sci]) { e.pos.x = t.pos.x + 40; e.pos.y = t.pos.y; }
    expect(s.issue({ kind: 'set-priority', towerId: t.id, mode: 'strongest' }).ok).toBe(true);
    expect(pick(s, t)!.id).toBe(strong.id);
    s.issue({ kind: 'set-priority', towerId: t.id, mode: 'weakest' });
    expect(pick(s, t)!.id).toBe(weak.id);
    // Caste priority outranks the ordering: science first, even though it is not weakest.
    s.issue({ kind: 'set-priority', towerId: t.id, caste: 'science' });
    expect(pick(s, t)!.id).toBe(sci.id);
  });

  it('first = furthest along the march; focus holds its lock', () => {
    const { s, t } = setup(951);
    const sim = s as unknown as SpawnSim;
    const behind = sim.spawnEnemy('militia', s.gates[0]);
    const ahead = sim.spawnEnemy('militia', s.gates[0]);
    const aheadCell = s.flowNextOf(s.flowNextOf(s.flowNextOf(s.gates[0])));
    const ac = s.cellCenter(aheadCell);
    ahead.pos.x = ac.x; ahead.pos.y = ac.y;
    s.issue({ kind: 'set-priority', towerId: t.id, mode: 'first' });
    expect(pick(s, t)!.id).toBe(ahead.id);
    // Focus: once locked, it holds even when something nearer walks up.
    s.issue({ kind: 'set-priority', towerId: t.id, mode: 'focus' });
    t.lastTargetId = behind.id;
    expect(pick(s, t)!.id).toBe(behind.id);
  });
});

describe('the cannon (war + science), bombard markers, ward shields', () => {
  const stub = (s: Sim, id: number, family: Tower['family'], x: number, y: number): Tower => ({
    id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100,
    pips: [], cooldown: 0, kills: 0,
  });

  it('both castes field a cannon; war cannons march in waves, the science one comes with study parties', () => {
    expect(ENEMIES.find((e) => e.kind === 'cannon')!.caste).toBe('war');
    expect(ENEMIES.find((e) => e.kind === 'dartgun')!.caste).toBe('science');
    expect(WAVE_TABLE.some((row) => (row.cannon ?? 0) > 0)).toBe(true);
    expect(WAVE_TABLE.some((row) => (row.dartgun ?? 0) > 0)).toBe(false);
  });

  it('war cannon DEPLOYS when something is in reach, stops moving, and shells over blocks until killed', () => {
    const s = freshSim(1000);
    const sim = s as unknown as SpawnSim;
    const t = stub(s, 5001, 'spitter', 400, 400);
    t.cooldown = 1e9; // silent target, so we watch the cannon
    s.towers.push(t);
    const c = sim.spawnEnemy('cannon', s.gates[0]);
    c.pos.x = 400 + 140; c.pos.y = 400; // in reach
    const cE = s.enemies.find((x) => x.id === c.id)!;
    s.tick();
    expect(cE.deployed).toBe(true);
    const at = { ...cE.pos };
    for (let i = 0; i < 60; i++) { s.tick(); t.cooldown = 1e9; }
    expect(Math.hypot(cE.pos.x - at.x, cE.pos.y - at.y)).toBeLessThan(1); // braced
    expect(t.hp).toBeLessThan(t.maxHp); // shells landed
  });

  it('science dartgun STUNS an unshielded limb; a shield blocks the dart', () => {
    const s = freshSim(1001);
    const sim = s as unknown as SpawnSim & { updateShells(): void };
    const bare = stub(s, 5101, 'spitter', 300, 300);
    const warded = stub(s, 5102, 'spitter', 600, 300);
    warded.shield = 50; warded.shieldMax = 50;
    s.towers.push(bare, warded);
    s.shells.push(
      { id: 1, from: { x: 0, y: 0 }, to: { ...bare.pos }, flight: 1, ttl: 0.01, damage: 4, aoe: 0, side: 'hive', stun: 2.5 },
      { id: 2, from: { x: 0, y: 0 }, to: { ...warded.pos }, flight: 1, ttl: 0.01, damage: 4, aoe: 0, side: 'hive', stun: 2.5 },
    );
    sim.updateShells();
    expect(bare.stunnedUntil ?? 0).toBeGreaterThan(s.time);
    expect(warded.stunnedUntil ?? 0).toBeLessThanOrEqual(s.time);
    expect(warded.hp).toBe(100);   // the shield soaked the damage too
    expect(warded.shield).toBe(46);
  });

  it('bombard holds fire without a marker, shells ONLY its marker, refuses one out of reach', () => {
    const s = freshSim(1002);
    const b = stub(s, 5201, 'bombard', 300, 300);
    s.towers.push(b);
    const sim = s as unknown as SpawnSim;
    const e = sim.spawnEnemy('militia', s.gates[0]);
    e.pos.x = 400; e.pos.y = 300; // well in reach, but no orders yet
    for (let i = 0; i < 20; i++) s.tick();
    expect(s.shells.filter((x) => x.side === 'body').length).toBe(0);
    // Far out of reach: refused.
    const far = s.cellAt(300 + 900, 300);
    expect(s.issue({ kind: 'set-marker', towerId: b.id, cell: far }).ok).toBe(false);
    // On the militia: it opens fire at the marker point.
    const mcell = s.cellAt(e.pos.x, e.pos.y);
    if (s.map.cells[mcell] !== CellType.Void) {
      expect(s.issue({ kind: 'set-marker', towerId: b.id, cell: mcell }).ok).toBe(true);
      const eE = s.enemies.find((x) => x.id === e.id)!;
      let fired = false;
      for (let i = 0; i < 20 && !fired; i++) {
        eE.pos.x = s.cellCenter(mcell).x; eE.pos.y = s.cellCenter(mcell).y;
        s.tick();
        if (s.shells.some((x) => x.side === 'body')) fired = true;
      }
      expect(fired).toBe(true);
    }
  });

  it('ward projects a regenerating shield onto the OTHER limbs in its radius (not itself)', () => {
    const s = freshSim(1003);
    const w = stub(s, 5301, 'ward', 300, 300);
    const near = stub(s, 5302, 'spitter', 360, 300);
    const far = stub(s, 5303, 'spitter', 600, 300);
    near.cooldown = far.cooldown = 1e9;
    s.towers.push(w, near, far);
    s.tick();
    expect(near.shieldMax).toBe(towerSpec('ward').wardShield);
    expect(far.shieldMax ?? 0).toBe(0);
    expect(w.shieldMax ?? 0).toBe(0);
    // Harm hits the shield first; after a quiet spell it regrows.
    s.hurtTower(near, 30);
    expect(near.hp).toBe(100);
    const low = near.shield!;
    for (let i = 0; i < 50; i++) { s.tick(); near.cooldown = 1e9; }
    expect(near.shield!).toBeGreaterThan(low);
  });

  it('science caste never targets a shielded limb; it drops a mark that gets shielded', () => {
    const s = freshSim(1006);
    const soft = stub(s, 5601, 'spitter', 300, 300);
    const warded = stub(s, 5602, 'spitter', 500, 300);
    warded.shield = 70; warded.shieldMax = 70;
    s.towers.push(soft, warded);
    const stand = (s as unknown as { standCellFor(c: number): number });
    if (stand.standCellFor(soft.cell) >= 0) expect(s.vulnerableTower()!.id).toBe(soft.id);
    // Shield everything: nothing left worth taking.
    soft.shield = 70; soft.shieldMax = 70;
    expect(s.vulnerableTower()).toBeNull();
    // A researcher already marking a limb abandons it once it is shielded.
    const s2 = freshSim(1007);
    const t2 = stub(s2, 5701, 'spitter', 300, 300);
    s2.towers.push(t2);
    const sim2 = s2 as unknown as SpawnSim;
    const r = sim2.spawnEnemy('researcher', s2.gates[0]);
    const rE = s2.enemies.find((x) => x.id === r.id)!;
    rE.extractId = t2.id;
    t2.shield = 70; t2.shieldMax = 70; t2.cooldown = 1e9;
    s2.tick();
    expect(rE.extractId).not.toBe(t2.id);
  });

  it('hurtTower: a shield soaks harm before hp', () => {
    const s = freshSim(1004);
    const t = stub(s, 5401, 'spitter', 300, 300);
    t.shield = 40; t.shieldMax = 40;
    s.hurtTower(t, 25); // sedation-sized bite
    expect(t.hp).toBe(100);
    expect(t.shield).toBe(15);
  });

  it('sacrifice pips: ward → permanent personal shield; bombard → DOUBLE range', () => {
    const base: Tower = {
      id: 1, family: 'spitter', pos: { x: 0, y: 0 }, cell: 0,
      hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0,
    };
    expect(towerStats({ ...base, pips: [{ family: 'ward' }] }).shieldPerm).toBe(B.pipShield);
    const r0 = towerStats(base).range;
    expect(towerStats({ ...base, pips: [{ family: 'bombard' }] }).range).toBeCloseTo(r0 * 2);
    // And again per pip: two bombards eaten = x4.
    expect(towerStats({ ...base, pips: [{ family: 'bombard' }, { family: 'bombard' }] }).range).toBeCloseTo(r0 * 4);
    // And the membrane shield is live on a real limb even with no ward nearby.
    const s = freshSim(1005);
    const t = { ...base, id: 5501, pos: { x: 300, y: 300 }, cell: s.cellAt(300, 300), hp: 60, maxHp: 60, pips: [{ family: 'ward' as const }] };
    t.cooldown = 1e9;
    s.towers.push(t);
    s.tick();
    expect(t.shieldMax).toBe(B.pipShield);
    expect(t.shield).toBe(B.pipShield);
  });
});

describe('Sep 27 batch: payload rule, detection, air/ground, dependency, new limbs', () => {
  const mk = (s: Sim, id: number, family: Tower['family'], x: number, y: number, pips: Tower['pips'] = []): Tower => ({
    id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100, pips, cooldown: 0, kills: 0,
  });
  type Spawner = { spawnEnemy(kind: string, atGate?: number): { id: number; pos: { x: number; y: number } } };

  it('DETECTION: a stalker cannot be targeted by a blind limb; an ocular aura, a mark, or an ocular pip reveals it', () => {
    const s = freshSim(1100);
    const gun = mk(s, 1, 'spitter', 300, 300);
    s.towers.push(gun);
    const st = (s as unknown as Spawner).spawnEnemy('stalker', s.gates[0]);
    const e = s.enemies.find((x) => x.id === st.id)!;
    e.pos.x = 330; e.pos.y = 300;
    expect(s.canTarget(gun, s.statsOf(gun), e)).toBe(false);
    // A mark (pheromone/mist) reveals it to everyone for a while.
    e.revealedUntil = s.time + 2;
    expect(s.canTarget(gun, s.statsOf(gun), e)).toBe(true);
    e.revealedUntil = undefined;
    // An ocular stalk's detection aura reveals it.
    s.towers.push(mk(s, 2, 'ocular', 320, 330));
    expect(s.canTarget(gun, s.statsOf(gun), e)).toBe(true);
    s.towers.pop();
    // An ocular PIP gives the limb true sight of its own.
    const seer = mk(s, 3, 'spitter', 300, 300, [{ family: 'ocular' }]);
    expect(s.canTarget(seer, s.statsOf(seer), e)).toBe(true);
  });

  it('AIR/GROUND: ground-only limbs cannot target fliers; the netcaster hits ONLY fliers and drags them down', () => {
    const s = freshSim(1101);
    const burster = mk(s, 1, 'burster', 300, 300);
    const net = mk(s, 2, 'net', 300, 300);
    s.towers.push(burster, net);
    const sim = s as unknown as Spawner;
    const fl = ((sim as unknown as Spawner).spawnEnemy('flier', s.gates[0]) as unknown as Enemy);
    const walker = ((sim as unknown as Spawner).spawnEnemy('militia', s.gates[0]) as unknown as Enemy);
    expect(s.canTarget(burster, s.statsOf(burster), fl)).toBe(false);
    expect(s.canTarget(burster, s.statsOf(burster), walker)).toBe(true);
    expect(s.canTarget(net, s.statsOf(net), fl)).toBe(true);
    expect(s.canTarget(net, s.statsOf(net), walker)).toBe(false);
    // A netted flier is grounded — now the burster CAN reach it, and it stands on a street.
    s.payloadHit(fxOf(net, s.statsOf(net)), fl);
    expect(s.isAirborne(fl)).toBe(false);
    expect(s.canTarget(burster, s.statsOf(burster), fl)).toBe(true);
    expect(isPassable(s.map.cells[s.cellAt(fl.pos.x, fl.pos.y)])).toBe(true);
    // A net PIP teaches any limb to hit air.
    const b2 = mk(s, 3, 'burster', 300, 300, [{ family: 'net' }]);
    expect(s.statsOf(b2).hitsAir).toBe(true);
  });

  it('SLING DEPENDENCY: limbs standing only on a sling\'s thrown creep wither when the sling dies; sling-pipped limbs need no creep', () => {
    const s = freshSim(1102);
    s.meat.war = 9999; s.meat.science = 9999;
    const sling = mk(s, 10, 'sling', 300, 300);
    s.towers.push(sling);
    // Find an uncreeped block far out and seed a patch there owned by the sling.
    let far = -1;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] === CellType.Block && !s.isCreeped(c) && !s.isOccupied(c)) { far = c; break; }
    }
    expect(far).toBeGreaterThanOrEqual(0);
    (s as unknown as { addCreepSource(k: string, c: number, r: number, d?: string, o?: number): void })
      .addCreepSource('patch', far, 3, undefined, sling.id);
    expect(s.isCreeped(far)).toBe(true);
    const outpost = mk(s, 11, 'spitter', s.cellCenter(far).x, s.cellCenter(far).y);
    s.towers.push(outpost);
    expect(s.dependentsOf(sling.id)).toBe(1);
    (s as unknown as { removeTower(id: number, e: boolean): void }).removeTower(sling.id, true);
    expect(s.towers.some((t) => t.id === outpost.id)).toBe(false);  // withered with its ground

    // A sling-pipped limb makes its own ground: buildable off creep, never withers.
    const s2 = freshSim(1112);
    let bare = -1;
    for (let c = 0; c < s2.map.cells.length; c++) {
      if (s2.map.cells[c] === CellType.Block && !s2.isCreeped(c) && !s2.isOccupied(c)) { bare = c; break; }
    }
    expect(s2.canBuildTower(bare)).toBe(false);
    s2.pendingPips = [{ family: 'sling' }];
    expect(s2.canBuildTower(bare)).toBe(true);
    const anchored = mk(s2, 20, 'spitter', s2.cellCenter(bare).x, s2.cellCenter(bare).y, [{ family: 'sling' }]);
    s2.towers.push(anchored);
    s2.witherUnrooted();
    expect(s2.towers.includes(anchored)).toBe(true);
  });

  it('PAYLOAD RULE: bonuses mean something on producers (ward potency, choir broadcast, broodling bites, swamp execute)', () => {
    const s = freshSim(1103);
    // Ward with a lasher pip: its projected shield is 20% stronger.
    const gun = mk(s, 1, 'spitter', 300, 300);
    gun.cooldown = 1e9;
    s.towers.push(gun, mk(s, 2, 'ward', 330, 300, [{ family: 'lasher' }]));
    s.tick();
    expect(gun.shieldMax).toBeCloseTo((towerSpec('ward').wardShield ?? 0) * (1 + B.pipDamage));
    // Choir with a tangler pip: every limb it covers now slows what it hits.
    const s2 = freshSim(1104);
    const g2 = mk(s2, 1, 'spitter', 300, 300);
    s2.towers.push(g2, mk(s2, 2, 'choir', 330, 300, [{ family: 'tangler' }]));
    expect(s2.statsOf(g2).slowMult).toBeLessThan(1);
    // A broodmother with a blighter pip: her brood's bites poison.
    const s3 = freshSim(1105);
    const mother = mk(s3, 1, 'brood', 300, 300, [{ family: 'blighter' }]);
    s3.towers.push(mother);
    const prey = ((s3 as unknown as Spawner).spawnEnemy('soldier', s3.gates[0]) as unknown as Enemy);
    s3.payloadHit(fxOf(mother, s3.statsOf(mother)), prey, 5);
    expect(prey.poisonDps ?? 0).toBeGreaterThan(0);
    // A swamp pip on a spitter: its hit digests anything left at or below 10 hp.
    const s4 = freshSim(1106);
    const exec = mk(s4, 1, 'spitter', 300, 300, [{ family: 'swamp' }]);
    s4.towers.push(exec);
    const v = ((s4 as unknown as Spawner).spawnEnemy('militia', s4.gates[0]) as unknown as Enemy);
    v.hp = 15;
    s4.payloadHit(fxOf(exec, s4.statsOf(exec)), v, 6); // 15 - 6 = 9 <= 10: digested
    expect(s4.enemies.includes(v)).toBe(false);
  });

  it('SPINE pip: kills leave caltrops; LURE pip: hits leave toxic clouds that burn and reveal', () => {
    const s = freshSim(1107);
    const t = mk(s, 1, 'spitter', 300, 300, [{ family: 'spine' }, { family: 'lure' }]);
    s.towers.push(t);
    const road = s.map.cells.findIndex((c, i) => c === CellType.Road && s.isCreeped(i));
    const at = s.cellCenter(road);
    const v = ((s as unknown as Spawner).spawnEnemy('responder', s.gates[0]) as unknown as Enemy);
    v.pos.x = at.x; v.pos.y = at.y; v.hp = 1;
    s.payloadHit(fxOf(t, s.statsOf(t)), v, 5);
    expect(s.caltrops.length).toBe(1);
    expect(s.clouds.length).toBe(1);
    const st = (s as unknown as Spawner).spawnEnemy('stalker', s.gates[0]);
    const sE = s.enemies.find((x) => x.id === st.id)!;
    sE.pos.x = at.x; sE.pos.y = at.y;
    s.tick();
    expect(sE.hp).toBeLessThan(sE.maxHp);   // the cloud burns
    expect(s.isRevealed(sE)).toBe(true);     // and marks the unseen
  });

  it('BROOD pip: heal 50% of max hp at every cleared wave', () => {
    const s = freshSim(1108);
    const t = mk(s, 1, 'spitter', 300, 300, [{ family: 'brood' }]);
    t.hp = 10; t.cooldown = 1e9;
    s.towers.push(t);
    while (s.wavesCleared === 0) { s.tick(); t.cooldown = 1e9; for (const e of s.enemies) e.hp = 0; s.enemies = []; }
    expect(t.hp).toBeCloseTo(60);
  });

  it('QUILL fans pellets; SKIPPER fires only down its facing and its shells skip on', () => {
    const s = freshSim(1109);
    const q = mk(s, 1, 'quill', 300, 300);
    s.towers.push(q);
    const tgt = ((s as unknown as Spawner).spawnEnemy('militia', s.gates[0]) as unknown as Enemy);
    tgt.pos.x = 340; tgt.pos.y = 300;
    s.tick();
    expect(s.projectiles.filter((p) => p.fromFamily === 'quill').length).toBe(towerSpec('quill').pellets);
    // Skipper facing E ignores a body due north, fires on one due east.
    const s2 = freshSim(1110);
    const k = mk(s2, 1, 'skipper', 300, 300);
    k.facing = 'E';
    s2.towers.push(k);
    const north = ((s2 as unknown as Spawner).spawnEnemy('militia', s2.gates[0]) as unknown as Enemy);
    north.pos.x = 300; north.pos.y = 150;
    s2.tick();
    expect(s2.shells.length).toBe(0);
    const east = ((s2 as unknown as Spawner).spawnEnemy('militia', s2.gates[0]) as unknown as Enemy);
    east.pos.x = 450; east.pos.y = 300;
    k.cooldown = 0;
    s2.tick();
    expect(s2.shells.some((sh) => sh.side === 'body' && sh.dir?.x === 1)).toBe(true);
  });

  it('science visitors never hold a wave open', () => {
    const s = freshSim(1111);
    while (s.phase !== 'siege') s.tick();
    const sim = s as unknown as Spawner;
    sim.spawnEnemy('thief', s.gates[0]);
    // Clear the war caste instantly; the lingering thief must not block the clear.
    let cleared = false;
    for (let i = 0; i < 400 && !cleared; i++) {
      s.enemies = s.enemies.filter((e) => ENEMIES.find((x) => x.kind === e.kind)!.caste === 'science');
      s.tick();
      if (s.wavesCleared > 0) cleared = true;
    }
    expect(cleared).toBe(true);
  });
});

describe('BURN (contagious fire) and the new cloaked kinds', () => {
  type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };
  const mk = (s: Sim, id: number, family: Tower['family'], x: number, y: number, pips: Tower['pips'] = []): Tower => ({
    id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100, pips, cooldown: 0, kills: 0,
  });

  it('burn damages, reveals, and SPREADS to neighbours (cooling as it goes); poison does not spread', () => {
    const s = freshSim(1200);
    const sim = s as unknown as Spawner;
    const a = sim.spawnEnemy('elite', s.gates[0]);
    const b = sim.spawnEnemy('elite', s.gates[0]);
    const far = sim.spawnEnemy('elite', s.gates[0]);
    a.pos = { x: 300, y: 300 }; b.pos = { x: 312, y: 300 }; far.pos = { x: 600, y: 300 };
    s.ignite(a, 10, 3);
    for (let i = 0; i < 8; i++) { s.tick(); a.pos = { x: 300, y: 300 }; b.pos = { x: 312, y: 300 }; far.pos = { x: 600, y: 300 }; }
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.burnUntil ?? 0).toBeGreaterThan(s.time);       // caught fire from its neighbour
    expect(b.burnDps ?? 0).toBeCloseTo(10 * B.burnSpreadFrac); // a little cooler
    expect(far.burnUntil ?? 0).toBeLessThanOrEqual(s.time);  // too far to catch
    // Poison stays on its carrier.
    const s2 = freshSim(1201);
    const sim2 = s2 as unknown as Spawner & { applyHitEffects(e: unknown, fx: Record<string, number>): void };
    const p = sim2.spawnEnemy('elite', s2.gates[0]);
    const q = sim2.spawnEnemy('elite', s2.gates[0]);
    p.pos = { x: 300, y: 300 }; q.pos = { x: 310, y: 300 };
    sim2.applyHitEffects(p, { slowMult: 1, slowDur: 0, poisonDps: 10, poisonDur: 3 });
    for (let i = 0; i < 8; i++) { s2.tick(); p.pos = { x: 300, y: 300 }; q.pos = { x: 310, y: 300 }; }
    expect(q.poisonDps ?? 0).toBe(0);
  });

  it('ember sac sprays a CONE: bodies inside it ignite, bodies behind it do not', () => {
    const s = freshSim(1202);
    const em = mk(s, 1, 'ember', 300, 300);
    s.towers.push(em);
    const sim = s as unknown as Spawner;
    const front1 = sim.spawnEnemy('militia', s.gates[0]);
    const front2 = sim.spawnEnemy('militia', s.gates[0]);
    const behind = sim.spawnEnemy('militia', s.gates[0]);
    // Nearest body is in front, so the sac aims forward; one sits behind, still in reach.
    front1.pos = { x: 340, y: 300 }; front2.pos = { x: 355, y: 312 }; behind.pos = { x: 245, y: 300 };
    s.tick();
    expect(front1.burnUntil ?? 0).toBeGreaterThan(s.time);
    expect(front2.burnUntil ?? 0).toBeGreaterThan(s.time);
    expect(behind.burnUntil ?? 0).toBeLessThanOrEqual(s.time);
    // An ember pip teaches any limb to ignite.
    expect(towerStats({ ...mk(s, 2, 'spitter', 0, 0), pips: [{ family: 'ember' }] }).burnDps).toBe(B.pipBurnDps);
  });

  it('shadewing needs AIR reach and DETECTION; ghost sapper is a cloaked climber; fire reveals both', () => {
    const s = freshSim(1203);
    const sim = s as unknown as Spawner;
    const sw = sim.spawnEnemy('shadewing', s.gates[0]);
    const gs = sim.spawnEnemy('ghostsapper', s.gates[0]);
    sw.pos = { x: 320, y: 300 }; gs.pos = { x: 330, y: 300 };
    const spitter = mk(s, 1, 'spitter', 300, 300);      // air+ground, blind
    const burster = mk(s, 2, 'burster', 300, 300, [{ family: 'ocular' }]); // sees, ground only
    const net = mk(s, 3, 'net', 300, 300, [{ family: 'ocular' }]);         // sees, air
    expect(s.canTarget(spitter, s.statsOf(spitter), sw)).toBe(false);
    expect(s.canTarget(burster, s.statsOf(burster), sw)).toBe(false);
    expect(s.canTarget(net, s.statsOf(net), sw)).toBe(true);
    expect(s.canTarget(spitter, s.statsOf(spitter), gs)).toBe(false);
    s.ignite(gs, 5, 2);
    s.tick();
    expect(s.canTarget(spitter, s.statsOf(spitter), gs)).toBe(true); // burning bodies can't hide
  });

  it('veil matron cloaks the WAR bodies around her (not herself, not other castes)', () => {
    const s = freshSim(1204);
    const sim = s as unknown as Spawner;
    const m = sim.spawnEnemy('matron', s.gates[0]);
    const soldier = sim.spawnEnemy('soldier', s.gates[0]);
    const researcher = sim.spawnEnemy('researcher', s.gates[0]);
    m.pos = { x: 300, y: 300 }; soldier.pos = { x: 340, y: 300 }; researcher.pos = { x: 330, y: 300 };
    expect(s.isCloaked(soldier)).toBe(true);
    expect(s.isCloaked(m)).toBe(false);
    expect(s.isCloaked(researcher)).toBe(false);
    soldier.pos = { x: 500, y: 300 };
    expect(s.isCloaked(soldier)).toBe(false);
  });

  it('factions: shadewing + ghost sapper are war and march in waves; matron is royal and never does', () => {
    const inWaves = new Set<string>();
    for (const row of WAVE_TABLE) for (const k of Object.keys(row)) inWaves.add(k);
    expect(ENEMIES.find((e) => e.kind === 'shadewing')!.caste).toBe('war');
    expect(ENEMIES.find((e) => e.kind === 'ghostsapper')!.caste).toBe('war');
    expect(ENEMIES.find((e) => e.kind === 'matron')!.caste).toBe('royal');
    expect(inWaves.has('shadewing') && inWaves.has('ghostsapper')).toBe(true);
    expect(inWaves.has('matron')).toBe(false);
  });
});

describe('MARROW CONDUIT: funnel every nearby bonus into one limb; harvest on sacrifice', () => {
  const mk = (s: Sim, id: number, family: Tower['family'], x: number, y: number, pips: Tower['pips'] = []): Tower => ({
    id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100, pips, cooldown: 1e9, kills: 0,
  });

  it('points down its facing at the nearest limb and feeds it every bonus around the conduit', () => {
    const s = freshSim(1300);
    const conduit = mk(s, 1, 'conduit', 300, 300);
    conduit.facing = 'E';
    const target = mk(s, 2, 'spitter', 400, 300);
    const srcA = mk(s, 3, 'spitter', 300, 250, [{ family: 'tangler' }]); // gives: tangler + spitter
    const srcB = mk(s, 4, 'lasher', 250, 300);                          // gives: lasher
    const offLine = mk(s, 5, 'spitter', 300, 420);                       // not pointed at, out of gather
    s.towers.push(conduit, target, srcA, srcB, offLine);
    expect(s.conduitTarget(conduit)?.id).toBe(target.id);
    const pool = s.conduitPool(conduit).map((p) => p.family).sort();
    expect(pool).toEqual(['lasher', 'spitter', 'tangler']);
    const fed = s.statsOf(target);
    const alone = s.statsOf(offLine);
    expect(fed.rate).toBeGreaterThan(alone.rate);     // spitter bonus
    expect(fed.damage).toBeGreaterThan(alone.damage); // lasher bonus
    expect(fed.slowMult).toBeLessThan(1);             // tangler bonus
    // Turn it away: the target stops being fed.
    s.issue({ kind: 'set-facing', towerId: conduit.id, dir: 'W' });
    expect(s.conduitTarget(conduit)?.id).toBe(srcB.id);
    expect(s.statsOf(target).rate).toBeCloseTo(alone.rate);
  });

  it('sacrificing a conduit HARVESTS its whole pool into the next build, permanently', () => {
    const s = freshSim(1301);
    s.meat.war = 9999; s.meat.science = 9999;
    const conduit = mk(s, 1, 'conduit', 300, 300);
    conduit.facing = 'E';
    s.towers.push(conduit, mk(s, 3, 'spitter', 300, 250, [{ family: 'blighter' }]), mk(s, 4, 'lasher', 250, 300));
    const poolSize = s.conduitPool(conduit).length;
    expect(poolSize).toBe(3);
    s.issue({ kind: 'butcher', towerId: conduit.id });
    // Pool (3) + the conduit's own family pip.
    expect(s.pendingPips.length).toBe(poolSize + 1);
    expect(s.pendingPips.some((p) => p.family === 'blighter')).toBe(true);
    expect(s.pendingPips.some((p) => p.family === 'conduit')).toBe(true);
  });

  it('conduit PIP: the limb passively draws its nearest neighbour\'s family bonus', () => {
    const s = freshSim(1302);
    const drawer = mk(s, 1, 'spitter', 300, 300, [{ family: 'conduit' }]);
    const neighbour = mk(s, 2, 'lasher', 330, 300);
    const plain = mk(s, 3, 'spitter', 700, 300);
    s.towers.push(drawer, neighbour, plain);
    expect(s.statsOf(drawer).damage).toBeGreaterThan(s.statsOf(plain).damage); // drew the lasher's +20%
  });

  it('effectLinks tells the UI what a limb is affecting', () => {
    const s = freshSim(1303);
    const conduit = mk(s, 1, 'conduit', 300, 300);
    conduit.facing = 'E';
    const target = mk(s, 2, 'spitter', 400, 300);
    const src = mk(s, 3, 'lasher', 250, 300);
    const ward = mk(s, 4, 'ward', 400, 360); // off the conduit's pointing lane, covering the target
    s.towers.push(conduit, target, src, ward);
    const cl = s.effectLinks(conduit);
    expect(cl.targets.map((t) => t.id)).toEqual([target.id]);
    expect(cl.sources.map((t) => t.id)).toContain(src.id);
    expect(s.effectLinks(ward).targets.map((t) => t.id)).toContain(target.id);
  });
});

describe('COMBO ENGINES (science-priced): amplifier (depth) and mosaic (breadth)', () => {
  const mk = (s: Sim, id: number, family: Tower['family'], x: number, y: number, pips: Tower['pips'] = []): Tower => ({
    id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100, pips, cooldown: 1e9, kills: 0,
  });
  const count = (pips: Tower['pips'], f: string) => pips.filter((p) => p.family === f).length;

  it('every combo engine is paid in science meat (science = the combo currency)', () => {
    for (const f of ['conduit', 'amp', 'mosaic'] as const) {
      const cost = towerSpec(f).cost;
      expect(cost.science ?? 0).toBeGreaterThan(0);
      expect(cost.war ?? 0).toBe(0);
    }
  });

  it('amplify: counts ×1.5 ROUNDED DOWN per type, once per layer (1→1, 2→3, 4→6; two layers 4→6→9)', () => {
    const pips = [
      { family: 'spitter' as const },
      { family: 'lasher' as const }, { family: 'lasher' as const },
      ...Array.from({ length: 4 }, () => ({ family: 'frond' as const })),
    ];
    const one = Sim.amplify(pips, 1);
    expect(count(one, 'spitter')).toBe(1);
    expect(count(one, 'lasher')).toBe(3);
    expect(count(one, 'frond')).toBe(6);
    expect(count(Sim.amplify(pips, 2), 'frond')).toBe(9);
  });

  it('an amplifier pointed at a limb multiplies EVERYTHING it carries — including what a conduit feeds it (engines chain)', () => {
    const s = freshSim(1400);
    const target = mk(s, 1, 'spitter', 400, 300, [{ family: 'spitter' }, { family: 'spitter' }]);
    const amp = mk(s, 2, 'amp', 400, 400); amp.facing = 'N';
    const conduit = mk(s, 3, 'conduit', 300, 300); conduit.facing = 'E';
    const srcA = mk(s, 4, 'spitter', 300, 250);
    const srcB = mk(s, 5, 'spitter', 250, 300);
    s.towers.push(target);
    const base = s.statsOf(target).rate;
    s.towers.push(amp);
    // 2 own spitter pips → 3 under one amp.
    expect(s.statsOf(target).rate).toBeCloseTo(towerSpec('spitter').rate * (1 + B.pipRate * 3));
    s.towers.push(conduit, srcA, srcB);
    // Conduit adds 2 spitter family bonuses → 4 spitter pips, amplified → 6.
    expect(s.statsOf(target).rate).toBeCloseTo(towerSpec('spitter').rate * (1 + B.pipRate * 6));
    expect(s.statsOf(target).rate).toBeGreaterThan(base);
    expect(s.ampLayers(target)).toBe(1);
  });

  it('mosaic: its target gets ONE of each distinct type around it, never more than one per type', () => {
    const s = freshSim(1401);
    const mosaic = mk(s, 1, 'mosaic', 300, 300); mosaic.facing = 'E';
    const target = mk(s, 2, 'spitter', 400, 300);
    // Three spitters (one carrying two tanglers) and a lasher around it.
    s.towers.push(mosaic, target,
      mk(s, 3, 'spitter', 300, 250, [{ family: 'tangler' }, { family: 'tangler' }]),
      mk(s, 4, 'spitter', 250, 300), mk(s, 5, 'spitter', 300, 350), mk(s, 6, 'lasher', 240, 260));
    const pool = s.conduitPool(mosaic);
    expect(count(pool, 'spitter')).toBe(1);
    expect(count(pool, 'tangler')).toBe(1);
    expect(count(pool, 'lasher')).toBe(1);
    expect(pool.length).toBe(3);
    // Sacrificed, it harvests that distinct set.
    s.issue({ kind: 'butcher', towerId: mosaic.id });
    expect(s.pendingPips.length).toBe(3 + 1); // pool + its own family pip
  });

  it('amp pip on the eater: its own bonuses ×1.5; mosaic pip: draws one of each neighbour type', () => {
    const s = freshSim(1402);
    const eater = mk(s, 1, 'spitter', 300, 300, [{ family: 'amp' }, { family: 'lasher' }, { family: 'lasher' }]);
    s.towers.push(eater);
    expect(s.statsOf(eater).damage).toBeCloseTo(towerSpec('spitter').damage * (1 + B.pipDamage * 3));
    const weaver = mk(s, 2, 'spitter', 600, 300, [{ family: 'mosaic' }]);
    s.towers.push(weaver, mk(s, 3, 'lasher', 630, 300), mk(s, 4, 'lasher', 600, 330), mk(s, 5, 'tangler', 570, 300));
    const st = s.statsOf(weaver);
    expect(st.damage).toBeCloseTo(towerSpec('spitter').damage * (1 + B.pipDamage)); // ONE lasher, not two
    expect(st.slowMult).toBeLessThan(1);                                             // plus the tangler
  });
});

describe('conduit cap, TWINNING GLAND, MARROW TAP', () => {
  const mk = (s: Sim, id: number, family: Tower['family'], x: number, y: number, pips: Tower['pips'] = []): Tower => ({
    id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100, pips, cooldown: 1e9, kills: 0,
  });
  type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };

  it('the conduit passes at most 2 copies of each bonus type', () => {
    const s = freshSim(1500);
    const c = mk(s, 1, 'conduit', 300, 300); c.facing = 'E';
    s.towers.push(c, mk(s, 2, 'lasher', 400, 300),
      mk(s, 3, 'spitter', 300, 250, [{ family: 'spitter' }, { family: 'spitter' }]),
      mk(s, 4, 'spitter', 250, 300), mk(s, 5, 'spitter', 300, 350));
    const pool = s.conduitPool(c);
    expect(pool.filter((p) => p.family === 'spitter').length).toBe(2); // 5 available, 2 given
  });

  it('a twinning gland doubles its target\'s projectiles (two glands: ×4)', () => {
    const s = freshSim(1501);
    const gun = mk(s, 1, 'spitter', 400, 300);
    gun.cooldown = 0;
    const g1 = mk(s, 2, 'twin', 300, 300); g1.facing = 'E';
    s.towers.push(gun, g1);
    expect(s.statsOf(gun).volley).toBe(2);
    const g2 = mk(s, 3, 'twin', 500, 300); g2.facing = 'W';
    s.towers.push(g2);
    expect(s.statsOf(gun).volley).toBe(4);
    const e = (s as unknown as Spawner).spawnEnemy('elite', s.gates[0]);
    e.pos = { x: 440, y: 300 };
    s.tick();
    expect(s.projectiles.filter((p) => p.fromFamily === 'spitter').length).toBe(4);
    // On a producer it doubles output: a twinned broodmother keeps twice the brood.
    const s2 = freshSim(1502);
    const mother = mk(s2, 1, 'brood', 400, 300); mother.cooldown = 0;
    const tw = mk(s2, 2, 'twin', 300, 300); tw.facing = 'E';
    s2.towers.push(mother, tw);
    for (let i = 0; i < 800; i++) s2.tick();
    expect(s2.broodlings.filter((b) => b.motherId === mother.id).length).toBe((towerSpec('brood').broodCount ?? 0) * 2);
    // Twin pip: +1 projectile.
    expect(towerStats({ ...gun, pips: [{ family: 'twin' }] }).volley).toBe(2);
  });

  it('a marrow tap holds its target in STASIS and can be milked again and again without disappearing', () => {
    const s = freshSim(1503);
    const gun = mk(s, 1, 'spitter', 400, 300, [{ family: 'frond' }, { family: 'lasher' }]);
    gun.cooldown = 0;
    const tap = mk(s, 2, 'tap', 300, 300); tap.facing = 'E';
    s.towers.push(gun, tap);
    expect(s.isTapped(gun)).toBe(true);
    const e = (s as unknown as Spawner).spawnEnemy('elite', s.gates[0]);
    e.pos = { x: 440, y: 300 };
    s.tick();
    expect(s.projectiles.length).toBe(0); // it does nothing while tapped
    const war0 = s.meat.war;
    for (let i = 0; i < 3; i++) s.issue({ kind: 'butcher', towerId: tap.id });
    expect(s.towers.includes(tap)).toBe(true);           // never disappears
    expect(s.pendingPips.length).toBe(3 * 3);            // (2 pips + its family) × 3 milkings
    expect(s.pendingPips.filter((p) => p.family === 'frond').length).toBe(3);
    expect(s.meat.war).toBe(war0);                       // no salvage
    // A tapped support limb projects nothing.
    const s2 = freshSim(1504);
    const choir = mk(s2, 1, 'choir', 400, 300);
    const g = mk(s2, 2, 'spitter', 430, 300);
    s2.towers.push(choir, g);
    const sped = s2.statsOf(g).rate;
    const t2 = mk(s2, 3, 'tap', 300, 300); t2.facing = 'E';
    s2.towers.push(t2);
    expect(s2.statsOf(g).rate).toBeLessThan(sped);
  });
});

describe('MITOSIS, CAPACITOR, BOOMERANG, MEAT PRESS, RELIQUARY', () => {
  const mk = (s: Sim, id: number, family: Tower['family'], x: number, y: number, pips: Tower['pips'] = []): Tower => ({
    id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100, pips, cooldown: 1e9, kills: 0,
  });
  type Priv = {
    spawnEnemy(kind: string, atGate?: number): Enemy;
    budMitosis(): void;
    canPlaceFree(cell: number, family: string): boolean;
    killEnemy(id: number, yieldMult: number, eaten: boolean, srcId?: number): void;
    removeTower(id: number, emit: boolean): void;
  };
  const drawTo = (s: Sim, family: Tower['family']): number => {
    let idx = -1;
    for (let g = 0; g < 600 && idx < 0; g++) {
      idx = s.hand.findIndex((c) => c.family === family && !c.free);
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(idx).toBeGreaterThanOrEqual(0);
    return idx;
  };
  const rich = (s: Sim) => { s.meat.war = 99999; s.meat.science = 99999; s.meat.royal = 99999; };

  it('mitosis buds a plain level-one copy of the adjacent limb each wave, and stops when the spaces are full', () => {
    const s = freshSim(1600);
    rich(s);
    const w = CFG.gridW;
    // A buildable pair of cells side by side: the limb on the right, the node on the left facing it.
    let node = -1;
    for (let c = 0; c < s.map.cells.length && node < 0; c++) {
      if (s.canBuildTower(c) && s.canBuildTower(c + 1) && (c % w) < w - 2) node = c;
    }
    expect(s.issue({ kind: 'build', cardIndex: drawTo(s, 'spitter'), cell: node + 1 }).ok).toBe(true);
    const parent = s.towers[s.towers.length - 1];
    parent.pips = [{ family: 'lasher' }, { family: 'lasher' }];
    expect(s.issue({ kind: 'build', cardIndex: drawTo(s, 'mitosis'), cell: node, facing: 'E' }).ok).toBe(true);
    const p = s as unknown as Priv;
    // Room = free legal cells next to the node OR next to the parent (distinct).
    const ring = (c: number) => [c - w - 1, c - w, c - w + 1, c - 1, c + 1, c + w - 1, c + w, c + w + 1];
    const room = new Set([...ring(node), ...ring(node + 1)].filter((c) => p.canPlaceFree(c, 'spitter'))).size;
    expect(room).toBeGreaterThan(0);
    for (let k = 0; k < room + 3; k++) p.budMitosis();
    const spitters = s.towers.filter((t) => t.family === 'spitter');
    expect(spitters.length).toBe(1 + room);             // stops at full
    for (const bud of spitters.filter((t) => t !== parent)) expect(bud.pips.length).toBe(0); // no upgrades
    // Harvest one copy and the next wave buds into the freed space again.
    const bud = spitters.find((t) => t !== parent)!;
    s.issue({ kind: 'butcher', towerId: bud.id });
    p.budMitosis();
    expect(s.towers.filter((t) => t.family === 'spitter').length).toBe(1 + room);
  });

  it('a capacitor banks shots while idle and spends them at 400% speed until the bank runs dry', () => {
    const s = freshSim(1601);
    const gun = mk(s, 1, 'spitter', 400, 300); gun.cooldown = 0;
    const cap = mk(s, 2, 'capacitor', 300, 300); cap.facing = 'E';
    s.towers.push(gun, cap);
    s.enemies.length = 0;
    const rate = s.statsOf(gun).rate;
    for (let i = 0; i < 50; i++) s.tick();                // 5 s with nothing to shoot
    expect(gun.bank ?? 0).toBeCloseTo(rate * 5, 0);
    const banked = gun.bank!;
    const e = (s as unknown as Priv).spawnEnemy('elite', s.gates[0]);
    e.pos = { x: 440, y: 300 }; e.hp = 1e9;
    s.tick();
    expect(gun.bank!).toBeCloseTo(banked - 1, 5);
    expect(gun.cooldown).toBeLessThanOrEqual(1 / (rate * B.capacitorSpeed) + 1e-9);
    // Without the capacitor the same limb banks nothing.
    const s2 = freshSim(1602);
    const g2 = mk(s2, 1, 'spitter', 400, 300); g2.cooldown = 0;
    s2.towers.push(g2);
    s2.enemies.length = 0;
    for (let i = 0; i < 50; i++) s2.tick();
    expect(g2.bank ?? 0).toBe(0);
  });

  it('a boomerang node calls its target\'s shots back after a hit; only projectile limbs qualify', () => {
    const s = freshSim(1603);
    const gun = mk(s, 1, 'spitter', 400, 300); gun.cooldown = 0;
    const boom = mk(s, 2, 'boomerang', 100, 300); boom.facing = 'E';
    s.towers.push(gun, boom);
    expect(s.conduitTarget(boom)).toBe(gun);
    const e = (s as unknown as Priv).spawnEnemy('elite', s.gates[0]);
    e.pos = { x: 440, y: 300 }; e.hp = 1e9;
    let back = null as null | (typeof s.projectiles)[number];
    for (let i = 0; i < 30 && !back; i++) {
      s.tick();
      back = s.projectiles.find((p) => p.returned) ?? null;
    }
    expect(back).not.toBeNull();
    expect(back!.vel.x).toBeLessThan(0);                  // flying home to the far-off node
    // Melee, beams and cones cannot be boomeranged: the node skips them.
    const s2 = freshSim(1604);
    const b2 = mk(s2, 1, 'boomerang', 100, 300); b2.facing = 'E';
    s2.towers.push(b2, mk(s2, 2, 'lasher', 200, 300), mk(s2, 3, 'spitter', 300, 300));
    expect(s2.conduitTarget(b2)?.family).toBe('spitter');
  });

  it('a meat press turns its target\'s war kills into science', () => {
    const s = freshSim(1605);
    const gun = mk(s, 1, 'spitter', 400, 300);
    const press = mk(s, 2, 'press', 300, 300); press.facing = 'E';
    const plain = mk(s, 3, 'spitter', 400, 500);
    s.towers.push(gun, press, plain);
    const p = s as unknown as Priv;
    const war = ENEMIES.find((x) => x.caste === 'war' && !x.splitInto)!.kind;
    s.drops.length = 0;
    const a = p.spawnEnemy(war, s.gates[0]);
    p.killEnemy(a.id, 1, false, gun.id);
    const b = p.spawnEnemy(war, s.gates[0]);
    p.killEnemy(b.id, 1, false, plain.id);
    expect(s.drops.map((d) => d.caste)).toEqual(['science', 'war']);
    // A press pip does it by itself.
    const c = p.spawnEnemy(war, s.gates[0]);
    plain.pips = [{ family: 'press' }];
    p.killEnemy(c.id, 1, false, plain.id);
    expect(s.drops[2].caste).toBe('science');
  });

  it('a reliquary comes as a PAIR (second one free) and banks its target\'s bonuses when it dies', () => {
    const s = freshSim(1606);
    rich(s);
    const idx = drawTo(s, 'reliquary');
    const handSize = s.hand.length;
    const sci0 = s.meat.science;
    expect(s.issue({ kind: 'build', cardIndex: idx, cell: buildableCell(s) }).ok).toBe(true);
    const free = s.hand.findIndex((c) => c.free);
    expect(free).toBeGreaterThanOrEqual(0);
    expect(s.hand[free].family).toBe('reliquary');
    expect(s.hand.length).toBe(handSize + 1);           // the pick-up replaced + the free twin
    expect(sci0 - s.meat.science).toBe(towerSpec('reliquary').cost.science);
    s.meat.science = 0;                                  // broke: the twin still goes down
    expect(s.issue({ kind: 'build', cardIndex: free, cell: buildableCell(s, 5) }).ok).toBe(true);
    expect(s.meat.science).toBe(0);                      // cost nothing
    expect(s.hand.length).toBe(handSize);               // no replacement drawn, no new twin
    expect(s.hand.some((c) => c.free)).toBe(false);
    // Death insurance: a guarded limb that DIES banks its bonuses + its family.
    const s2 = freshSim(1607);
    const gun = mk(s2, 1, 'spitter', 400, 300, [{ family: 'frond' }, { family: 'lasher' }]);
    const rel = mk(s2, 2, 'reliquary', 300, 300); rel.facing = 'E';
    s2.towers.push(gun, rel);
    s2.pendingPips = [];
    (s2 as unknown as Priv).removeTower(gun.id, true);
    expect(s2.pendingPips.map((x) => x.family).sort()).toEqual(['frond', 'lasher', 'spitter']);
  });
});

describe('arc prism (focus ramp + relay network)', () => {
  it('ramps on a held target and resets on a switch', () => {
    const s = freshSim(960);
    s.meat.war = 9999;
    s.meat.science = 9999;
    let idx = -1;
    for (let g = 0; g < 400 && idx < 0; g++) {
      idx = s.hand.findIndex((c) => c.family === 'prism');
      if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
    }
    expect(s.issue({ kind: 'build', cardIndex: idx, cell: buildableCell(s) }).ok).toBe(true);
    const p = s.towers[0];
    const sim = s as unknown as SpawnSim;
    const e = sim.spawnEnemy('phalanx', s.gates[0]); // big hp, holds still-ish under test
    e.pos.x = p.pos.x + 40; e.pos.y = p.pos.y;
    for (let i = 0; i < 60; i++) {
      s.tick();
      const eE = s.enemies.find((x) => x.id === e.id);
      if (eE) { eE.pos.x = p.pos.x + 40; eE.pos.y = p.pos.y; }
    }
    expect(p.streak ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('idle prisms in link range relay charge through each other to the firing prism', () => {
    const s = freshSim(961);
    const towerStub = (id: number, x: number, y: number): Tower => ({
      id, family: 'prism', pos: { x, y }, cell: s.cellAt(x, y), hp: 80, maxHp: 80,
      pips: [], cooldown: 0, kills: 0,
    });
    // A chain: firing prism A — idle B (120px) — idle C (240px, only reachable THROUGH B).
    const a = towerStub(9001, 200, 200);
    const b = towerStub(9002, 320, 200);
    const c = towerStub(9003, 440, 200);
    s.towers.push(a, b, c);
    const sim = s as unknown as { gatherPrismRelays(t: Tower, claimed: Set<number>): number };
    const relays = sim.gatherPrismRelays(a, new Set([a.id]));
    expect(relays).toBe(2);           // C reached through B: a routed network, not a radius
    expect(b.cooldown).toBeGreaterThan(0); // relayers spend their shot
    expect(c.cooldown).toBeGreaterThan(0);
    // A prism with its own target does not relay.
    const s2 = freshSim(962);
    const a2 = towerStub(9101, 200, 200);
    const b2 = towerStub(9102, 320, 200);
    s2.towers.push(a2, b2);
    const sim2 = s2 as unknown as SpawnSim & { gatherPrismRelays(t: Tower, claimed: Set<number>): number };
    const intruder = sim2.spawnEnemy('militia', s2.gates[0]);
    intruder.pos.x = 330; intruder.pos.y = 210;
    expect(sim2.gatherPrismRelays(a2, new Set([a2.id]))).toBe(0);
  });
});

describe('combination algebra (pips compose, NO CAPS — busted is the point)', () => {
  const bare = (family: string): Tower => ({
    id: 1, family: family as Tower['family'], pos: { x: 0, y: 0 }, cell: 0,
    hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0,
  });

  it('every new family teaches its verb as a pip', () => {
    const t = bare('spitter');
    expect(towerStats({ ...t, pips: [{ family: 'brood' }] }).waveHeal).toBe(B.pipWaveHeal);
    expect(towerStats({ ...t, pips: [{ family: 'swamp' }] }).execute).toBe(B.pipExecute);
    expect(towerStats({ ...t, pips: [{ family: 'frond' }] }).chains).toBe(B.pipChain);
    expect(towerStats({ ...t, pips: [{ family: 'lobber' }] }).knock).toBe(B.pipKnock);
    expect(towerStats({ ...t, pips: [{ family: 'mister' }] }).shred).toBe(B.pipShred);
    expect(towerStats({ ...t, pips: [{ family: 'ocular' }] }).sniper).toBe(true);
  });

  it('NO CAPS (Collins): twelve of a pip is twelve times the effect, on every axis', () => {
    const many = (f: Tower['family']) => Array.from({ length: 12 }, () => ({ family: f }));
    const frond = bare('frond');
    expect(towerStats({ ...frond, pips: many('frond') }).chains).toBe((towerSpec('frond').chains ?? 0) + 12 * B.pipChain);
    expect(towerStats({ ...bare('spitter'), pips: many('lobber') }).knock).toBe(12 * B.pipKnock);
    expect(towerStats({ ...bare('spitter'), pips: many('mister') }).shred).toBe(12 * B.pipShred);
    expect(towerStats({ ...bare('spitter'), pips: many('spitter') }).rate)
      .toBeCloseTo(towerSpec('spitter').rate * (1 + 12 * B.pipRate));
    expect(towerStats({ ...bare('spitter'), pips: many('ocular') }).supportDmg).toBeCloseTo(12 * B.pipOcularDmg);
    // Range doubles per bombard pip: x2, x4, x8.
    const r0 = towerStats(bare('spitter')).range;
    expect(towerStats({ ...bare('spitter'), pips: many('bombard').slice(0, 3) }).range).toBeCloseTo(r0 * 8);
    // Slow compounds toward zero without ever flipping sign.
    const sm = towerStats({ ...bare('tangler'), pips: many('tangler') }).slowMult;
    expect(sm).toBeGreaterThan(0);
    expect(sm).toBeLessThan(0.2);
    // Poison on one body stacks without a ceiling.
    const s = freshSim(810);
    const sim = s as unknown as SpawnSim;
    sim.spawnEnemy('elite', s.gates[0]);
    const e = s.enemies[0];
    for (let i = 0; i < 30; i++) {
      sim.applyHitEffects(e, { slowMult: 1, slowDur: 0, poisonDps: 7, poisonDur: 3 });
    }
    expect(e.poisonDps).toBe(210);
  });

  it('auras stack too: every choir voice and every ward adds', () => {
    const s = freshSim(812);
    const mk = (id: number, family: Tower['family'], x: number): Tower => ({
      id, family, pos: { x, y: 300 }, cell: s.cellAt(x, 300), hp: 100, maxHp: 100,
      pips: [], cooldown: 1e9, kills: 0,
    });
    const gun = mk(1, 'spitter', 300);
    s.towers.push(gun, mk(2, 'choir', 320), mk(3, 'choir', 280), mk(4, 'choir', 300 + 40));
    expect(s.statsOf(gun).rate).toBeCloseTo(towerSpec('spitter').rate * (1 + 3 * (towerSpec('choir').rateAura ?? 0)));
    s.towers.push(mk(5, 'ward', 260), mk(6, 'ward', 340));
    s.tick();
    expect(gun.shieldMax).toBe(2 * (towerSpec('ward').wardShield ?? 0));
  });

  it('slow composition: the strongest snare wins, a weaker one never overwrites it', () => {
    const s = freshSim(811);
    const sim = s as unknown as SpawnSim;
    sim.spawnEnemy('soldier', s.gates[0]);
    const e = s.enemies[0];
    sim.applyHitEffects(e, { slowMult: 0.4, slowDur: 2, poisonDps: 0, poisonDur: 0 });
    sim.applyHitEffects(e, { slowMult: 0.8, slowDur: 2, poisonDps: 0, poisonDur: 0 });
    expect(e.slowMult).toBe(0.4);
    // A hard root (pit pip) beats both through the same rule.
    sim.applyHitEffects(e, { slowMult: 1, slowDur: 0, poisonDps: 0, poisonDur: 0, rootDur: 0.5 });
    expect(e.slowMult).toBe(0.05);
  });

  it('marquee combo: impaler + frond pip = a skewer that arcs off every body it passes', () => {
    // Stat-level: the pierced shot carries chains.
    const t = bare('impaler');
    const st = towerStats({ ...t, pips: [{ family: 'frond' }] });
    expect(st.pierce).toBe(true);
    expect(st.chains).toBe(B.pipChain);
    expect(st.capBonus).toBe(Infinity);
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
    const blockCard = () => {
      for (let guard = 0; guard < 300 && ['swamp', 'spine'].includes(s.hand[0].family); guard++) {
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      return 0;
    };
    expect(s.issue({ kind: 'build', cardIndex: blockCard(), cell: buildableCell(s) }).ok).toBe(true);
    const donor = s.towers[0];
    donor.pips.push({ family: 'sling' });
    s.issue({ kind: 'build', cardIndex: blockCard(), cell: buildableCell(s) }); // triggers refreshRouting
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

  it('choir nodes speed up the limbs around them', () => {
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
