/**
 * THE LIMB STAT CARD (src/ui/limbStats.ts; Collins, Nov 23 2026: "signal things much better with stats on limbs on
 * hover over and an explanation for those stats"). Its numbers are the sim's own (Sim.statsOf), reach reads in cells,
 * every row carries a plain explanation, and a boosted number names where the boost came from: an inherited trait
 * by the display name of the limb it came from, a roof's level, a pending sacrifice on a hand card.
 */
import { describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { BALANCE as B } from '../content/data';
import { handCard, inspectLine, limbCard, teaches, traitsLine } from '../src/ui/limbStats';
import type { SimConfig, TowerFamily } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234, organStage: true };

function grown(seed = 1234): Sim {
  const s = new Sim({ ...CFG, seed });
  for (let i = 0; i < 600; i++) s.tick();
  s.meat.war = 9999;
  s.meat.science = 9999;
  s.meat.royal = 99;
  return s;
}

function spot(s: Sim, family: TowerFamily, high?: (h: number) => boolean): number | null {
  for (let c = 0; c < s.map.cells.length; c++) {
    const g = s.groundFor(c, family, undefined);
    if (!g) continue;
    if (s.towers.some((t) => (t.cells ?? [t.cell]).some((x) => g.includes(x)))) continue;
    if (high && !high(s.map.heights[g[0]] || 1)) continue;
    return c;
  }
  return null;
}

function build(s: Sim, family: TowerFamily, cell: number) {
  s.hand.push({ id: 900000 + s.towers.length, family, free: true });
  const r = s.issue({ kind: 'build', cardIndex: s.hand.length - 1, cell });
  expect(r.ok, String(r.err)).toBe(true);
  return s.towers[s.towers.length - 1];
}

const row = (c: ReturnType<typeof limbCard>, k: string) => c.rows.find((r) => r.key === k)!;

describe('limb stat card', () => {
  it('a bare spitter on the street: the sim\'s numbers, reach in cells, every row explained, nothing boosted', () => {
    const s = grown();
    const t = build(s, 'spitter', spot(s, 'spitter', (h) => h === 1)!);
    const st = s.statsOf(t);
    const c = limbCard(s, t);
    expect(c.name).toBe(towerSpec('spitter').name);
    expect(c.role.length).toBeGreaterThan(5);
    expect(row(c, 'damage').value).toContain(String(Math.round(st.damage)));
    expect(row(c, 'rate').value).toBe(`${st.rate.toFixed(2)} attacks/s`);
    expect(row(c, 'reach').value).toBe(`${(st.range / CFG.cellPx).toFixed(1)} cells`);
    expect(row(c, 'dps')).toBeDefined();
    for (const r of [...c.rows, ...c.verbs]) expect(r.explain.length, r.key).toBeGreaterThan(8);
    expect(row(c, 'damage').base).toBeUndefined();
    expect(row(c, 'reach').sources).toEqual([]);
    // No raw multipliers in the panel's line.
    expect(inspectLine(c)).not.toMatch(/×1\.\d\d/);
    expect(traitsLine(t)).toBe('no inherited traits');
  });

  it('on a high roof: reach is up, its base is shown, and the roof level is the named source', () => {
    const s = grown();
    const cell = spot(s, 'spitter', (h) => h >= 2);
    expect(cell).not.toBeNull();
    const t = build(s, 'spitter', cell!);
    const h = s.map.heights[t.cell];
    const r = row(limbCard(s, t), 'reach');
    expect(r.trend).toBe('up');
    expect(r.base).toBe(`${(towerSpec('spitter').range / CFG.cellPx).toFixed(1)} cells`);
    expect(r.sources.join('|')).toContain(`roof level ${h}: +${Math.round(B.heightRangeBonus * (h - 1) * 100)}%`);
  });

  it('an inherited trait (eat a Spitter, build a Lasher): speed is up and the trait is named by the limb it came from', () => {
    const s = grown();
    const donor = build(s, 'spitter', spot(s, 'spitter', (h) => h === 1)!);
    expect(s.issue({ kind: 'butcher', towerId: donor.id }).ok).toBe(true);
    expect(s.pendingPips.some((p) => p.family === 'spitter')).toBe(true);
    // The hand card shows what the banked trait would give, before it is placed.
    const hc = handCard(s, 'lasher');
    expect(row(hc, 'rate').trend).toBe('up');
    expect(row(hc, 'rate').sources.join('|')).toMatch(/Spitter trait.*banked by the limb you ate/);
    const t = build(s, 'lasher', spot(s, 'lasher', (h) => h === 1)!);
    expect(t.pips.some((p) => p.family === 'spitter')).toBe(true);
    const c = limbCard(s, t);
    const st = s.statsOf(t);
    const rate = row(c, 'rate');
    expect(rate.value).toBe(`${st.rate.toFixed(2)} attacks/s`);
    expect(rate.trend).toBe('up');
    expect(rate.base).toBe(towerSpec('lasher').rate.toFixed(2));
    expect(rate.sources.join('|')).toContain(`${towerSpec('spitter').name} trait: ${teaches('spitter')} — inherited from a ${towerSpec('spitter').name}`);
    expect(traitsLine(t)).toContain(`inherited: ${towerSpec('spitter').name}`);
    expect(traitsLine(t)).not.toMatch(/\bspitter\b/); // the display name, never the family id
  });

  it('a hand card with nothing banked is the bare family', () => {
    const s = grown();
    s.pendingPips = [];
    const hc = handCard(s, 'spitter');
    expect(row(hc, 'damage').base).toBeUndefined();
    expect(row(hc, 'rate').value).toBe(`${towerSpec('spitter').rate.toFixed(2)} attacks/s`);
    expect(row(hc, 'hp').value).toBe(String(towerSpec('spitter').maxHp));
  });

  it('verbs are listed with plain words: a tangler slows, a blighter poisons', () => {
    const s = grown();
    for (const [f, k] of [['tangler', 'slow'], ['blighter', 'poison']] as Array<[TowerFamily, string]>) {
      const cell = spot(s, f, (h) => h === 1);
      if (cell === null) continue;
      const c = limbCard(s, build(s, f, cell));
      const v = c.verbs.find((x) => x.key === k);
      expect(v, f).toBeDefined();
      expect(v!.sources[0]).toMatch(/by nature/);
    }
  });

  it('every family has a card without throwing, in the hand', () => {
    const s = grown();
    for (const spec of (['spitter', 'burster', 'lasher', 'maw', 'spine', 'lure', 'tangler', 'blighter', 'impaler', 'choir', 'sling', 'brood',
      'hatch', 'swamp', 'frond', 'lobber', 'mister', 'ocular', 'prism', 'bombard', 'ward', 'quill', 'skipper', 'lance', 'cage', 'sprout',
      'net', 'ember', 'conduit', 'amp', 'mosaic', 'twin', 'tap', 'mitosis', 'capacitor', 'boomerang', 'press', 'reliquary'] as TowerFamily[])) {
      const c = handCard(s, spec);
      expect(c.rows.length, spec).toBeGreaterThan(0);
      for (const r of c.rows) expect(r.value, `${spec}.${r.key}`).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});
