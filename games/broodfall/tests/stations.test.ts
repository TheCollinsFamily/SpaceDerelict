/**
 * SCIENCE FORWARD BASES and CREEP CARE (Collins, Oct 2 2026): "give the science faction units that can build spawning
 * locations, and even their own towers if you don't deal with them, and then you need to mount attacks on these
 * areas"; "the enemy can also build bases ... or they spawn more and more through the new bases"; "the builders will
 * need a bit more thought than the other units in terms of their own intelligence ... a spot on the side of any lane";
 * "the creep healing and making faster is great".
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { CellType } from '../src/sim/citymap';
import { BALANCE as B } from '../content/data';
import type { Enemy, Harrier, SimConfig, Vec } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4242 };
type P = {
  spawnEnemy(kind: string, atGate?: number): Enemy;
  sendEngineers(): void; engineerTimer: number; phase: string; waveNumber: number;
  walkingUnits(): Array<{ pos: Vec; hp: number; maxHp: number }>;
  creepPace(at: Vec): number; preyNear(at: Vec, r: number, from: Vec, skipScience: boolean): Enemy | null;
};
const P = (s: Sim) => s as unknown as P;

/** A board grown a while, its creep pushed out a little, interest high enough for engineers. */
function board(seed = 4242): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 900; i++) s.tick();
  s.enemies.length = 0;
  Object.defineProperty(s, 'interest', { get: () => 20, configurable: true });
  P(s).waveNumber = B.engineerMinWave;
  P(s).engineerTimer = 1e9; // no engineers but the ones a test sends
  return s;
}

/** Ticks with only the science forward base and its engineers alive (the waves and parties cleared each tick). */
function run(s: Sim, seconds: number, keep: (e: Enemy) => boolean = (e) => e.kind === 'engineer' || e.kind === 'fieldstation' || e.kind === 'sciturret') {
  for (let i = 0; i < seconds * 10; i++) {
    s.tick();
    for (let k = s.enemies.length - 1; k >= 0; k--) if (!keep(s.enemies[k])) s.enemies.splice(k, 1);
  }
}

function engineerAt(s: Sim, site?: number): Enemy {
  const e = P(s).spawnEnemy('engineer');
  e.engState = 'travel';
  e.lastHp = e.hp;
  e.siteCell = site ?? (s as unknown as { stationSite(): number }).stationSite();
  return e;
}

function harrierAt(s: Sim, at: Vec): Harrier {
  const h: Harrier = { id: 900000 + s.harriers.length, glandId: -1, pos: { ...at }, hp: 70, maxHp: 70, orders: [{ kind: 'hold' } as never], cooldown: 99 };
  s.harriers.push(h);
  return h;
}

describe('station sites: a whole block beside a lane, never the lane', () => {
  for (const seed of [4242, 7, 42]) {
    it(`seed ${seed}: every possible site is a building cell facing a street; its whole block is free and off your creep`, () => {
      const s = board(seed);
      let sites = 0;
      for (let c = 0; c < s.map.cells.length; c++) {
        if (!s.stationSiteOk(c)) continue;
        sites++;
        expect(s.map.cells[c]).toBe(CellType.Block);
        expect(s.dangerAt(c)).toBe(0);
        const door = s.stationDoor(c);
        expect(s.map.cells[door]).toBe(CellType.Road);
        const block = s.stationBlock(c);
        expect(block.length).toBeGreaterThanOrEqual(B.stationBlockMin);
        expect(block.length).toBeLessThanOrEqual(B.stationBlockMax);
        expect(block[0]).toBe(c);
        for (const q of block) {
          expect(s.map.cells[q]).toBe(CellType.Block);
          expect(s.isCreeped(q)).toBe(false);
        }
      }
      expect(sites).toBeGreaterThan(0);
    });
  }

  it('a station records the block it takes over, its site first', () => {
    const s = board();
    engineerAt(s);
    let st: Enemy | undefined;
    for (let i = 0; i < 1200 && !st; i++) { run(s, 0.1); st = s.enemies.find((e) => e.kind === 'fieldstation'); }
    expect(st!.blockCells!.length).toBeGreaterThanOrEqual(B.stationBlockMin);
    expect(st!.blockCells![0]).toBe(st!.siteCell);
  });

  it('the best site is out of sight of your units and away from an infested outpost', () => {
    const s = board();
    const site = (s as unknown as { stationSite(): number }).stationSite();
    expect(site).toBeGreaterThanOrEqual(0);
    harrierAt(s, s.cellCenter(site));
    expect(s.stationSiteScore(site)).toBeNull();
  });
});

describe('the engineer', () => {
  it('is sent with an escort once interest and the wave allow it, telegraphed with its site', () => {
    const s = board();
    P(s).phase = 'growth';
    P(s).engineerTimer = 0;
    P(s).sendEngineers();
    const eng = s.enemies.find((e) => e.kind === 'engineer')!;
    expect(eng).toBeTruthy();
    expect(eng.siteCell).toBeGreaterThanOrEqual(0);
    // The escort: engineerEscort researchers, plus a Lens Bearer under whose dome they walk from lensEscortWave (Oct 2 2026).
    expect(s.enemies.filter((e) => e.escortOf === eng.id && e.kind !== 'lensbearer').length).toBe(B.engineerEscort);
    expect(s.takeEvents().some((e) => e.kind === 'engineer-out')).toBe(true);
  });

  it('is not sent before engineerMinWave, nor with low interest', () => {
    const s = board();
    P(s).phase = 'growth';
    P(s).waveNumber = B.engineerMinWave - 1;
    P(s).engineerTimer = 0;
    P(s).sendEngineers();
    expect(s.enemies.some((e) => e.kind === 'engineer')).toBe(false);
    const t = board();
    Object.defineProperty(t, 'interest', { get: () => 0, configurable: true });
    P(t).phase = 'growth';
    P(t).engineerTimer = 0;
    P(t).sendEngineers();
    expect(t.enemies.some((e) => e.kind === 'engineer')).toBe(false);
  });

  it('walks to its site, raises a WEAK idle station at once, and builds it up to full', () => {
    const s = board();
    const eng = engineerAt(s);
    let st: Enemy | undefined;
    for (let i = 0; i < 1200 && !st; i++) { run(s, 0.1); st = s.enemies.find((e) => e.kind === 'fieldstation'); }
    expect(st, 'the engineer never reached its site').toBeTruthy();
    expect(st!.buildProgress).toBeLessThan(0.2);
    expect(st!.maxHp).toBeLessThan(400 * 0.5);
    expect(eng.engState).toBe('build');
    run(s, B.engineerBuildTime + 2);
    expect(st!.buildProgress).toBe(1);
    expect(st!.maxHp).toBeCloseTo(650, 0);
    expect(eng.engState).toBe('tend');
  });

  it('a build is interrupted when the engineer dies: the station stays half-built and idle', () => {
    const s = board();
    const eng = engineerAt(s);
    let st: Enemy | undefined;
    for (let i = 0; i < 1200 && !st; i++) { run(s, 0.1); st = s.enemies.find((e) => e.kind === 'fieldstation'); }
    run(s, 4);
    const was = st!.buildProgress!;
    s.enemies.splice(s.enemies.indexOf(eng), 1);
    run(s, 10);
    expect(st!.buildProgress).toBe(was);
  });

  it('abandons a doomed build when your strike force arrives before it is half built', () => {
    const s = board();
    const eng = engineerAt(s);
    let st: Enemy | undefined;
    for (let i = 0; i < 1200 && !st; i++) { run(s, 0.1); st = s.enemies.find((e) => e.kind === 'fieldstation'); }
    for (let i = 0; i < B.strikeForce; i++) harrierAt(s, { x: st!.pos.x + 20 + i * 4, y: st!.pos.y + 20 });
    run(s, 0.3);
    expect(eng.engState).toBe('flee');
    expect(eng.tendsStation).toBeUndefined();
  });

  it('looks for another site when its site is taken by your creep or comes in sight of your units', () => {
    const s = board();
    const eng = engineerAt(s);
    const first = eng.siteCell!;
    harrierAt(s, s.cellCenter(first));
    run(s, 0.2);
    expect(eng.siteCell === undefined || eng.siteCell !== first || eng.leaving).toBe(true);
    expect(eng.replans).toBeGreaterThanOrEqual(1);
  });

  it('runs when it is hit with no escort left', () => {
    const s = board();
    const eng = engineerAt(s);
    run(s, 0.1);
    expect(eng.engState).toBe('travel');
    eng.hp -= 10;
    run(s, 0.1);
    expect(eng.engState).toBe('flee');
  });

  it('a second engineer reinforces a station nobody tends instead of founding one close by', () => {
    const s = board();
    const eng = engineerAt(s);
    let st: Enemy | undefined;
    for (let i = 0; i < 1200 && !st; i++) { run(s, 0.1); st = s.enemies.find((e) => e.kind === 'fieldstation'); }
    s.enemies.splice(s.enemies.indexOf(eng), 1);
    P(s).phase = 'growth';
    P(s).engineerTimer = 0;
    P(s).sendEngineers();
    const second = s.enemies.find((e) => e.kind === 'engineer')!;
    expect(second.tendsStation).toBe(st!.id);
  });
});

describe('the field station', () => {
  function builtStation(s: Sim): { st: Enemy; eng: Enemy } {
    const eng = engineerAt(s);
    let st: Enemy | undefined;
    for (let i = 0; i < 1200 && !st; i++) { run(s, 0.1); st = s.enemies.find((e) => e.kind === 'fieldstation'); }
    run(s, B.engineerBuildTime + 2);
    return { st: st!, eng };
  }

  it('sends study parties from close by in the quiet, bigger and quicker as it grows (and spawns more and more)', () => {
    const s = board();
    const { st } = builtStation(s);
    P(s).phase = 'growth';
    st.stationTimer = 0;
    const before = s.enemies.length;
    s.tick();
    const party = s.enemies.length - before;
    expect(party).toBeGreaterThanOrEqual(B.stationPartyBase + 1);
    st.stationAge = B.stationStage3At;
    st.stationTimer = 0;
    const b3 = s.enemies.length;
    s.tick();
    expect(s.enemies.length - b3).toBeGreaterThan(party);
    expect(B.stationPartyEvery[2]).toBeLessThan(B.stationPartyEvery[0]);
  });

  it('raises turrets beside itself as it grows, but only while an engineer tends it', () => {
    const s = board();
    const { st, eng } = builtStation(s);
    st.stationAge = B.stationStage2At;
    run(s, 0.5);
    expect(s.enemies.filter((e) => e.kind === 'sciturret').length).toBe(1);
    s.enemies.splice(s.enemies.indexOf(eng), 1);
    st.stationAge = B.stationStage3At;
    run(s, 0.5);
    expect(s.enemies.filter((e) => e.kind === 'sciturret').length).toBe(1);
  });

  it('sends a war squad into every siege from stage 2', () => {
    const s = board();
    const { st } = builtStation(s);
    st.stationAge = B.stationStage2At;
    run(s, 0.2);
    P(s).phase = 'siege';
    (s as unknown as { spawnQueue: string[]; spawnTimer: number }).spawnQueue = ['responder'];
    (s as unknown as { spawnTimer: number }).spawnTimer = 99;
    st.stationSiegeSent = -1;
    s.tick();
    expect(s.enemies.filter((e) => e.kind === 'militia').length).toBeGreaterThanOrEqual(3);
  });

  it('is repaired while tended and no unit of yours is at its door', () => {
    const s = board();
    const { st } = builtStation(s);
    st.hp = 300;
    run(s, 5);
    expect(st.hp).toBeGreaterThan(300 + B.stationRepair * 4);
  });

  it('a strike force can take it: your warriors fight stations, turrets and engineers (not study parties)', () => {
    const s = board();
    const { st, eng } = builtStation(s);
    expect(P(s).preyNear(st.pos, 50, st.pos, true)?.kind).toMatch(/fieldstation|engineer/);
    s.enemies.splice(s.enemies.indexOf(eng), 1);
    const r = P(s).spawnEnemy('researcher');
    r.pos = { x: st.pos.x + 200, y: st.pos.y };
    expect(P(s).preyNear(r.pos, 30, r.pos, true)).toBeNull();
  });

  it('a turret darts your nearest unit in reach', () => {
    const s = board();
    const { st } = builtStation(s);
    st.stationAge = B.stationStage2At;
    run(s, 0.5);
    const tur = s.enemies.find((e) => e.kind === 'sciturret')!;
    const h = harrierAt(s, { x: tur.pos.x + 60, y: tur.pos.y });
    for (let i = 0; i < 30; i++) s.tick();
    expect(h.hp).toBeLessThan(70);
  });

  it('is counted when destroyed', () => {
    const s = board();
    const { st } = builtStation(s);
    st.hp = 1;
    (s as unknown as { killEnemy(id: number, y: number, e: boolean): void }).killEnemy(st.id, 1, false);
    expect(s.stats.stationsDestroyed).toBe(1);
    expect(s.takeEvents().some((e) => e.kind === 'station-destroyed')).toBe(true);
  });
});

describe('creep care: your units heal and move faster on creep', () => {
  it('a unit on creep heals; off creep it does not', () => {
    const s = board();
    const on = harrierAt(s, s.cellCenter(s.map.coreCell));
    on.hp = 20;
    let off = -1;
    for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === CellType.Road && !s.isCreeped(c)) { off = c; break; }
    const away = harrierAt(s, s.cellCenter(off));
    away.hp = 20;
    for (let i = 0; i < 20; i++) (s as unknown as { creepCare(): void }).creepCare();
    expect(on.hp).toBeGreaterThan(20);
    expect(away.hp).toBe(20);
  });

  it('on creep a unit moves creepUnitSpeed times faster', () => {
    const s = board();
    expect(P(s).creepPace(s.cellCenter(s.map.coreCell))).toBe(B.creepUnitSpeed);
    let off = -1;
    for (let c = 0; c < s.map.cells.length; c++) if (s.map.cells[c] === CellType.Road && !s.isCreeped(c)) { off = c; break; }
    expect(P(s).creepPace(s.cellCenter(off))).toBe(1);
  });
});

describe('determinism', () => {
  it('two runs with the same seed raise the same stations', () => {
    const go = () => {
      const s = board(99);
      engineerAt(s);
      run(s, 60);
      return JSON.stringify(s.enemies.filter((e) => e.kind !== 'researcher').map((e) => [e.kind, Math.round(e.pos.x), Math.round(e.pos.y), Math.round(e.hp)]));
    };
    expect(go()).toBe(go());
  });
});

describe('the stations\' pictures', () => {
  it('every tile set has its station in all its states and its turret (public/art/station/<set>/)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    // The ten tile sets (tools/art/biomes.mjs BIOMES).
    const sets = ['orthodox', 'suburb', 'megacity', 'orient', 'industrial', 'farmland', 'necropolis', 'deephive', 'terraces', 'wetland'];
    for (const id of sets) {
      const b = { id };
      for (const state of ['building', 'active', 'fortified', 'ruin', 'turret']) {
        expect(fs.existsSync(path.join('public', 'art', 'station', b.id, `${state}.webp`)), `${b.id}/${state}`).toBe(true);
      }
    }
  });
});

describe('the installation\'s pictures (the block a station takes over)', () => {
  it('has a facade and a roof for every state, the lit entrance and the six roof objects (public/art/installation/)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const ids = [
      ...['building', 'active', 'fortified', 'ruin'].flatMap((st) => [`facade-${st}`, `roof-${st}`]),
      'entrance',
      ...['dish', 'tanks', 'mast', 'module', 'crates', 'pylon'].map((a) => `apparatus-${a}`),
    ];
    for (const id of ids) expect(fs.existsSync(path.join('public', 'art', 'installation', `${id}.webp`)), id).toBe(true);
  });
});
