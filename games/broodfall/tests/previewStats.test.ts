/**
 * THE PREVIEW CANNOT LIE (Collins, Sep 30 2026: "have we properly handled how elevation works, with
 * elevation increasing range by unit, and it shows in the range indication hover-over before placing
 * the building? and right click rotates the building a quarter?").
 *
 * The ring drawn while a limb is held over a cell comes from Sim.previewStats. It must equal what
 * Sim.statsOf gives that limb once it is placed there: height (plinths too), genes, banked pips, amps,
 * organ bonuses. And right-click turns a limb being placed through four facings, which the build keeps.
 */
import { describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { BALANCE as B } from '../content/data';
import { reachText } from '../src/ui/reachTip';
import type { ModPip, RootDir, SimConfig, TowerFamily } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234, organStage: true };

function grown(seed = 1234): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 600; i++) s.tick();
  s.meat.war = 9999;
  s.meat.science = 9999;
  s.meat.royal = 99;
  return s;
}

const KEYS = ['range', 'damage', 'rate', 'aoe', 'potency', 'tempo', 'volley', 'reach', 'maxHp', 'hitsAir', 'hitsGround'] as const;
const pick = (st: Record<string, unknown>) => Object.fromEntries(KEYS.map((k) => [k, st[k]]));

/** A cell this family can stand on, whose ground is at `high` (or any height when omitted). */
function spot(s: Sim, family: TowerFamily, facing: RootDir | undefined, high?: (h: number) => boolean): number | null {
  for (let c = 0; c < s.map.cells.length; c++) {
    const g = s.groundFor(c, family, facing);
    if (!g) continue;
    if (high && !high(s.map.heights[g[0]] || 1)) continue;
    return c;
  }
  return null;
}

/** Preview it, build it (as the page does: the same cell, facing and banked pips), and compare. */
function previewThenBuild(s: Sim, family: TowerFamily, cell: number, facing: RootDir | undefined) {
  const ground = s.groundFor(cell, family, facing)!;
  const towersBefore = s.towers.length;
  const rngBefore = JSON.stringify((s as unknown as { rng: unknown }).rng);
  const pv = s.previewStats(family, ground, facing, s.pendingPips);
  // Pure: nothing added, no dice thrown.
  expect(s.towers.length).toBe(towersBefore);
  expect(JSON.stringify((s as unknown as { rng: unknown }).rng)).toBe(rngBefore);
  s.hand.push({ id: 700000 + s.towers.length, family, free: true });
  const r = s.issue({ kind: 'build', cardIndex: s.hand.length - 1, cell, facing });
  expect(r.ok, String(r.err)).toBe(true);
  const t = s.towers[s.towers.length - 1];
  expect(t.family).toBe(family);
  const live = s.statsOf(t);
  return { pv, live, t };
}

describe('previewStats equals the stats the placed limb gets', () => {
  const families: Array<[TowerFamily, RootDir | undefined]> = [
    ['spitter', undefined], ['lasher', undefined], ['impaler', 'S'], ['skipper', 'E'], ['mister', undefined], ['maw', 'W'],
  ];
  for (const [family, facing] of families) {
    it(`${family}: on level-1 ground and on a raised roof`, () => {
      const s = grown();
      const low = spot(s, family, facing, (h) => h === 1);
      if (low !== null) {
        const { pv, live } = previewThenBuild(s, family, low, facing);
        expect(pick(pv)).toEqual(pick(live));
        expect(pv.height).toBe(1);
        expect(pv.groundRange).toBeCloseTo(pv.range, 9);
      }
      const high = spot(s, family, facing, (h) => h >= 2);
      if (high !== null) {
        const { pv, live, t } = previewThenBuild(s, family, high, facing);
        expect(pick(pv)).toEqual(pick(live));
        const h = s.map.heights[t.cell];
        expect(pv.height).toBe(h);
        if (live.range > 0) expect(pv.range).toBeCloseTo(pv.groundRange * (1 + B.heightRangeBonus * (h - 1)), 6);
      }
      expect(low !== null || high !== null).toBe(true);
    });
  }

  it('a roof raised by plinths: the preview reach grows with each level, and matches the build', () => {
    const s = grown();
    const cell = spot(s, 'spitter', undefined, (h) => h === 1)!;
    expect(cell).not.toBeNull();
    const flat = s.previewStats('spitter', [cell]);
    s.plinths = 2;
    expect(s.issue({ kind: 'place-plinth', cell }).ok).toBe(true);
    expect(s.issue({ kind: 'place-plinth', cell }).ok).toBe(true);
    expect(s.map.heights[cell]).toBe(3);
    const raised = s.previewStats('spitter', [cell]);
    expect(raised.height).toBe(3);
    expect(raised.range).toBeCloseTo(flat.range * (1 + 2 * B.heightRangeBonus), 6);
    expect(raised.groundRange).toBeCloseTo(flat.range, 6);
    expect(reachText(raised)).toMatch(/\+20% height, level 3/);
    const { pv, live } = previewThenBuild(s, 'spitter', cell, undefined);
    expect(pick(pv)).toEqual(pick(live));
  });

  for (const [family, facing] of [['mister', undefined], ['skipper', 'E'], ['impaler', 'N']] as Array<[TowerFamily, RootDir | undefined]>) {
    it(`a ${family} (more than one cell) on ground raised two levels by plinths`, () => {
      const s = grown();
      const cell = spot(s, family, facing, (h) => h === 1)!;
      const ground = s.groundFor(cell, family, facing)!;
      const flat = s.previewStats(family, ground, facing);
      s.plinths = ground.length * 2;
      for (const c of ground) for (let k = 0; k < 2; k++) expect(s.issue({ kind: 'place-plinth', cell: c }).ok).toBe(true);
      expect(s.groundFor(cell, family, facing)).toEqual(ground);
      const raised = s.previewStats(family, ground, facing);
      expect(raised.height).toBe(3);
      expect(raised.range).toBeCloseTo(flat.range * (1 + 2 * B.heightRangeBonus), 6);
      const { pv, live } = previewThenBuild(s, family, cell, facing);
      expect(pick(pv)).toEqual(pick(live));
    });
  }

  it('with genes and banked pips (amp included): still the same numbers', () => {
    const s = grown(4321);
    (s as unknown as { geneMods: { rangeMult: number } }).geneMods.rangeMult = 1.3;
    const banked: ModPip[] = [{ family: 'spitter' }, { family: 'impaler' }, { family: 'amp' }, { family: 'spitter' }];
    s.pendingPips = [...banked];
    const cell = spot(s, 'spitter', undefined)!;
    const base = s.previewStats('spitter', [cell], undefined, []);
    const { pv, live, t } = previewThenBuild(s, 'spitter', cell, undefined);
    expect(t.pips).toEqual(banked);
    expect(pick(pv)).toEqual(pick(live));
    // The gene is in the preview: with no pips, its level-1 reach is the family's times the gene.
    expect(base.groundRange).toBeCloseTo(towerSpec('spitter').range * 1.3, 6);
  });

  it('a limb built where an engine already points is fed in the preview too', () => {
    const s = grown(99);
    // An amplifier first; then find a cell down its lane, and preview a spitter there.
    const ampCell = spot(s, 'amp', 'E')!;
    s.hand.push({ id: 800001, family: 'amp', free: true });
    expect(s.issue({ kind: 'build', cardIndex: s.hand.length - 1, cell: ampCell, facing: 'E' }).ok).toBe(true);
    const amp = s.towers[s.towers.length - 1];
    s.pendingPips = [{ family: 'spitter' }, { family: 'spitter' }];
    for (let c = 0; c < s.map.cells.length; c++) {
      if (!s.canBuildTower(c, 'spitter')) continue;
      const p = s.cellCenter(c);
      const along = p.x - amp.pos.x;
      if (along <= 0 || Math.abs(p.y - amp.pos.y) > 10) continue;
      const { pv, live, t } = previewThenBuild(s, 'spitter', c, undefined);
      expect(pick(pv)).toEqual(pick(live));
      if (s.conduitTarget(amp) === t) expect(s.ampLayers(t)).toBeGreaterThan(0);
      return;
    }
  });
});

describe('right-click turns any limb a quarter', () => {
  const ORDER: RootDir[] = ['N', 'E', 'S', 'W'];
  const next = (d: RootDir) => ORDER[(ORDER.indexOf(d) + 1) % 4];

  it('four right-clicks come round to where they started, and the build keeps the facing (a lopsided limb)', () => {
    let f: RootDir = 'S';
    const seen: RootDir[] = [];
    for (let i = 0; i < 4; i++) { f = next(f); seen.push(f); }
    expect(seen).toEqual(['W', 'N', 'E', 'S']);
    for (const facing of seen) {
      const s = grown();
      const cell = spot(s, 'spitter', facing)!;
      const { t } = previewThenBuild(s, 'spitter', cell, facing);
      expect(t.facing).toBe(facing);
    }
  });

  it('an unturned limb that is not directional takes no facing (it faces what it fights)', () => {
    const s = grown();
    const cell = spot(s, 'spitter', undefined)!;
    const { t } = previewThenBuild(s, 'spitter', cell, undefined);
    expect(t.facing).toBeUndefined();
  });

  it('a BIG limb turns too, and its ground is the same four cells', () => {
    const s = grown();
    const cell = spot(s, 'mister', 'E')!;
    const g = s.groundFor(cell, 'mister', 'E')!;
    expect(s.groundFor(cell, 'mister', 'N')).toEqual(g);
    const { t } = previewThenBuild(s, 'mister', cell, 'E');
    expect(t.facing).toBe('E');
    expect(s.cellsOf(t)).toEqual(g);
  });

  it('a long limb turned a quarter takes the turned ground (re-checked); built, it turns end for end only', () => {
    // No limb that does not aim is a line of two since Oct 2 2026 (the Impaler became a line of three): the rule
    // is tried on a Spitter made long for the test.
    const spec = towerSpec('spitter'); spec.span = [1, 2];
    try {
      const s = grown();
      const cell = spot(s, 'spitter', 'E')!;
      const ew = s.groundFor(cell, 'spitter', 'E')!;
      expect(ew[1] - ew[0]).toBe(1); // lies along x
      const { t } = previewThenBuild(s, 'spitter', cell, 'E');
      expect(t.facing).toBe('E');
      expect(s.issue({ kind: 'set-facing', towerId: t.id, dir: 'S' }).ok).toBe(false);
      expect(s.issue({ kind: 'set-facing', towerId: t.id, dir: 'W' }).ok).toBe(true);
      expect(t.facing).toBe('W');
      expect(s.cellsOf(t)).toEqual(ew);
    } finally { delete spec.span; }
  });

  it('a built limb that is not directional turns through four facings; the sim does not care (same shots)', () => {
    const a = grown();
    const b = grown();
    for (const s of [a, b]) {
      const cell = spot(s, 'spitter', undefined)!;
      s.hand.push({ id: 810000, family: 'spitter', free: true });
      expect(s.issue({ kind: 'build', cardIndex: s.hand.length - 1, cell }).ok).toBe(true);
    }
    const t = a.towers[a.towers.length - 1];
    let f: RootDir = 'S';
    for (let i = 0; i < 4; i++) {
      f = next(f);
      expect(a.issue({ kind: 'set-facing', towerId: t.id, dir: f }).ok).toBe(true);
      expect(t.facing).toBe(f);
    }
    for (let i = 0; i < 400; i++) { a.tick(); b.tick(); }
    expect(a.enemies.map((e) => e.hp)).toEqual(b.enemies.map((e) => e.hp));
    expect(a.meat).toEqual(b.meat);
  });
});
