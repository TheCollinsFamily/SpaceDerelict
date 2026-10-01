/**
 * THE CREEP DIGESTS THE DEAD (Oct 1 2026; src/sim/types.ts Corpse). A kill leaves a body; its meat is banked
 * only when the creep has digested it. On the creep that is its fall plus its dissolve; off the creep it waits,
 * keeping its meat, until the creep reaches it. Past a cell's or the board's cap bodies heap, meat summed.
 */
import { describe, expect, it } from 'vitest';
import { Sim, DT } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { BALANCE as B } from '../content/data';
import type { Caste, Enemy, EnemyKind, SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4242 };
interface Priv {
  spawnEnemy(kind: EnemyKind, gate?: number): Enemy;
  killEnemy(id: number, yieldMult: number, eaten: boolean, srcId?: number, cause?: string): void;
  creepDist: Int32Array;
}
const priv = (s: Sim) => s as unknown as Priv;
const street = (s: Sim, c: number) => s.map.cells[c] === 1 || s.map.cells[c] === 2;
const DONE = B.corpseFallSeconds + B.corpseDigestSeconds;
const total = (s: Sim) => s.digested.war + s.digested.science + s.digested.royal;

function killAt(s: Sim, cell: number, kind: EnemyKind = 'soldier'): Enemy {
  const e = priv(s).spawnEnemy(kind, s.gates[0]);
  e.pos = s.cellCenter(cell);
  priv(s).killEnemy(e.id, 1, false);
  return e;
}
function ticks(s: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) s.tick();
}
function quiet(s: Sim): void {
  s.enemies.length = 0;
  s.coreHp = 1e9;
}
/** A street cell on the creep, and one just past its edge (the core's creep), away from the core. */
function cells(s: Sim): { on: number; off: number } {
  const all = [...Array(s.map.cells.length).keys()];
  const on = all.find((c) => street(s, c) && s.isCreeped(c) && c !== s.map.coreCell)!;
  const off = all.find((c) => street(s, c) && !s.isCreeped(c) && priv(s).creepDist[c] === s.creepRangeCells + 1)!;
  return { on, off };
}

describe('corpses: the creep digests the dead', () => {
  it('a body on the creep falls, dissolves, then banks its meat, and is gone', () => {
    const s = new Sim(CFG);
    quiet(s);
    const { on } = cells(s);
    expect(on).toBeDefined();
    const war0 = s.meat.war;
    killAt(s, on);
    expect(s.corpses.length).toBe(1);
    expect(s.corpses[0].meat.war).toBeGreaterThan(0);
    expect(s.meat.war).toBe(war0); // not at the kill
    ticks(s, DONE - 0.3);
    expect(s.corpses.length).toBe(1);
    expect(s.corpses[0].digest).toBeGreaterThan(0);
    expect(total(s)).toBe(0);
    s.takeEvents();
    ticks(s, 0.5);
    expect(s.corpses.length).toBe(0);
    expect(s.digested.war).toBeGreaterThan(0);
    const ev = s.takeEvents();
    expect(ev.some((e) => e.kind === 'digested')).toBe(true);
    expect(ev.some((e) => e.kind === 'banked' && e.caste === 'war')).toBe(true);
  });

  it('a body past the creep keeps its meat and waits; when the creep reaches it, it is digested and counted as reclaimed', () => {
    const s = new Sim(CFG);
    quiet(s);
    const { off } = cells(s);
    expect(off).toBeDefined();
    killAt(s, off, 'researcher');
    const meat = { ...s.corpses[0].meat };
    expect(meat.science).toBeGreaterThan(0);
    ticks(s, 20);
    expect(s.corpses.length).toBe(1);
    expect(s.corpses[0].digest).toBeUndefined();
    expect(total(s)).toBe(0);
    expect(s.unclaimedMeat().science).toBe(meat.science);
    // The creep reaches it (one cell further, as an organ or a node would carry it).
    const r = s.creepRangeCells;
    Object.defineProperty(s, 'creepRangeCells', { get: () => r + 1, configurable: true });
    expect(s.isCreeped(s.corpses[0].cell)).toBe(true);
    ticks(s, DONE + 0.2);
    expect(s.corpses.length).toBe(0);
    expect(s.digested.science).toBe(meat.science);
    expect(s.stats.bodiesReclaimed).toBe(1);
  });

  it('eaten whole by a Maw, nothing lies: what it carried is banked at once', () => {
    const s = new Sim(CFG);
    quiet(s);
    const e = priv(s).spawnEnemy('royal', s.gates[0]);
    (s as unknown as { geneMods: { royalJelly: number } }).geneMods.royalJelly = 2;
    priv(s).killEnemy(e.id, 0, true);
    expect(s.corpses.length).toBe(0);
    expect(s.digested.royal).toBe(2);
  });

  it('bodies past a cell\'s cap heap up, and the heap keeps every body\'s meat', () => {
    const s = new Sim(CFG);
    quiet(s);
    const { off } = cells(s);
    const sum: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
    const kinds: EnemyKind[] = ['soldier', 'militia', 'researcher', 'responder', 'elite'];
    for (let i = 0; i < 30; i++) {
      killAt(s, off, kinds[i % kinds.length]);
      for (const k of ['war', 'science', 'royal'] as Caste[]) sum[k] = 0;
      for (const c of s.corpses) for (const k of ['war', 'science', 'royal'] as Caste[]) sum[k] += c.meat[k];
    }
    expect(s.corpses.length).toBeLessThanOrEqual(B.corpseCellCap + 1);
    expect(s.corpses.reduce((n, c) => n + (c.heap ?? 1), 0)).toBe(30);
    const heap = s.corpses.find((c) => c.heap)!;
    expect(heap.heap).toBeGreaterThan(1);
    expect(heap.kinds!.length).toBeGreaterThan(1);
    expect(s.unclaimedMeat()).toEqual(sum);
  });

  it('the board cap folds the oldest loose bodies into heaps and never loses meat', () => {
    const s = new Sim(CFG);
    quiet(s);
    const off = [...Array(s.map.cells.length).keys()].filter((c) => street(s, c) && !s.isCreeped(c));
    let made = 0;
    for (let i = 0; i < B.corpseBoardCap + 60; i++) { killAt(s, off[i % off.length], 'militia'); made++; }
    const loose = s.corpses.filter((c) => !c.heap && c.digest === undefined).length;
    expect(loose).toBeLessThanOrEqual(B.corpseBoardCap);
    expect(s.corpses.reduce((n, c) => n + (c.heap ?? 1), 0)).toBe(made);
  });

  it('is deterministic: the same seed plays to the same bodies and the same meat', () => {
    const play = () => {
      const s = new Sim({ ...CFG, seed: 77, directive: { kind: 'hold', waves: 12 } });
      const bot = new Autoplayer(78);
      for (let i = 0; i < 2500 && s.outcome === 'playing'; i++) { bot.act(s, DT); s.tick(); }
      return JSON.stringify({ meat: s.meat, digested: s.digested, corpses: s.corpses, reclaimed: s.stats.bodiesReclaimed ?? 0 });
    };
    expect(play()).toBe(play());
  });
});
