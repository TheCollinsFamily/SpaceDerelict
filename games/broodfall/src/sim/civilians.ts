/**
 * THE TOWNSFOLK FLEEING THE CRASH (Sep 30 2026, DESIGN.md: "The map at minute zero is a
 * NEIGHBORHOOD, not a battlefield … street life that flees the crash").
 *
 * A light, deterministic crowd that lives BESIDE the sim and never inside it:
 * - It has its own Rng (the run's seed XOR a constant). It never calls, and never reorders,
 *   the sim's rng.
 * - It only READS the sim (the map, the creep, the gates, the clock). It never writes to it,
 *   so it has no effect on play or balance (tests/civilians.test.ts runs a Sim with and without
 *   it and compares).
 *
 * At minute zero a crowd (30-40) stands and strolls on the streets of the claimed plates (not on the
 * crash square). Within a moment or two they panic and run for the nearest frontier gate or the
 * board's edge, street cell to street cell (four neighbours, never through a block), faster when
 * the creep is under or beside them. At a gate they leave (fade out into the smoke). One the
 * creep overtakes (standing on creep for more than 1.5 s) is TAKEN: gone, with an event the
 * renderer draws as a puff. A plate claimed mid-run brings a smaller crowd of its own, fewer
 * the more waves have come: they are the district's people, fleeing when the body arrives.
 *
 * The renderers step it from the sim's tickCount (src/render/render.ts `syncCivilians`), so
 * main.ts is untouched.
 */
import { CellType } from './citymap';
import { Rng } from './rng';
import type { Phase, Vec } from './types';

/** What of the sim the crowd reads. The real Sim satisfies it; nothing here writes to it. */
export interface CivSimView {
  readonly cfg: { gridW: number; gridH: number; cellPx: number; seed: number };
  readonly map: { cells: CellType[]; coreCell: number };
  readonly core: Vec;
  readonly gates: readonly number[];
  readonly phase: Phase;
  readonly tickCount: number;
  readonly waveNumber: number;
  isCreeped(cell: number): boolean;
  cellCenter(cell: number): Vec;
  cellAt(x: number, y: number): number;
}

export type CivState = 'calm' | 'flee' | 'cower' | 'leaving';

export interface Civilian {
  id: number;
  pos: Vec;
  /** The street cell it stands in (or is leaving). */
  cell: number;
  /** The street cell it is walking to (its own spot in it: centre + offset). */
  to: number;
  /** Where in a street cell it walks: kept inside the cell so it never brushes a block. */
  off: Vec;
  state: CivState;
  /** Seconds left in this state (calm: until it panics; cower: until it runs again; leaving: its fade). */
  t: number;
  /** Its own pace, px/s, when it runs. */
  pace: number;
  /** Seconds it has stood on creep. */
  creepT: number;
  /** Which way it last moved (the renderer faces it that way). */
  dir: Vec;
  /** Px it moved last step (the renderer's walk cycle and bob). */
  moved: number;
  /** Which look (0-2): the renderer may tint by it. */
  look: number;
  /** 1 while it is here; falls to 0 as it leaves. */
  alpha: number;
}

export interface CivEvent {
  kind: 'taken' | 'escaped';
  id: number;
  pos: Vec;
}

const DT = 0.1;
/** The crowd's own seed: the run's seed XOR this. */
export const CIV_SEED_XOR = 0x5eed_c1f1;
export const CIV_CAP = 60;
/** How long on creep before it is taken, seconds. */
export const TAKEN_AFTER = 1.5;
const LEAVE_FADE = 0.6;
const STROLL = 12;
const RUN = [24, 36] as const;
const NEAR_CREEP_RUN = 1.6;
/** Street step cost, and what a creeped cell adds to a route (they would rather go round). */
const STEP = 10;
const CREEP_COST = 60;
/** After this many ticks no minute-zero crowd is spawned (the renderer was made mid-run). */
const MINUTE_ZERO_TICKS = 1200;

const isStreet = (t: CellType) => t === CellType.Road || t === CellType.Plaza;

export class Civilians {
  list: Civilian[] = [];
  /** The sim tick this crowd has been stepped to. */
  tick: number;
  /** How many have got away and how many were taken, this run. */
  escaped = 0;
  taken = 0;
  private events: CivEvent[] = [];
  private rng: Rng;
  private nextId = 1;
  private w: number;
  private h: number;
  private px: number;
  /** Cost to the nearest exit over the streets, by cell (-1: no way out). */
  private exitDist: Int32Array;
  private claimed: Uint8Array;
  private fieldAge = 1e9;

  constructor(sim: CivSimView) {
    this.w = sim.cfg.gridW;
    this.h = sim.cfg.gridH;
    this.px = sim.cfg.cellPx;
    this.rng = new Rng((sim.cfg.seed ^ CIV_SEED_XOR) >>> 0);
    this.tick = sim.tickCount;
    const n = sim.map.cells.length;
    this.exitDist = new Int32Array(n).fill(-1);
    this.claimed = new Uint8Array(n);
    for (let c = 0; c < n; c++) this.claimed[c] = sim.map.cells[c] === CellType.Void ? 0 : 1;
    if (sim.tickCount <= MINUTE_ZERO_TICKS) {
      const streets = this.spawnable(sim, null);
      // ~30-40, by how much street is claimed. Some panic at once, the last only after several seconds.
      const want = Math.max(30, Math.min(40, Math.round(streets.length * 0.2)));
      this.spawn(sim, streets, want, [0.3, 7]);
    }
    this.refield(sim);
  }

  /** Step up to the sim's clock (the renderers call this every frame). Returns ticks stepped. */
  sync(sim: CivSimView, maxTicks = 3000): number {
    let k = 0;
    while (this.tick < sim.tickCount && k < maxTicks) {
      this.step(sim);
      k++;
    }
    // Far behind (a long fast-forward): jump the clock, the crowd has long gone anyway.
    if (this.tick < sim.tickCount) this.tick = sim.tickCount;
    return k;
  }

  takeEvents(): CivEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** One sim tick (0.1 s). */
  step(sim: CivSimView): void {
    this.tick += 1;
    // New plates: the district's own people, a smaller crowd, fewer as the sieges go on.
    if (this.tick % 5 === 0) this.checkNewPlates(sim);
    this.fieldAge += 1;
    if (this.fieldAge >= 10) this.refield(sim);

    const keep: Civilian[] = [];
    for (const c of this.list) {
      if (this.stepOne(sim, c)) keep.push(c);
    }
    this.list = keep;
  }

  /** A civilian at this street cell (tests; a beat that wants one in a given place). */
  spawnAt(sim: CivSimView, cell: number, state: CivState = 'flee'): Civilian | null {
    if (!isStreet(sim.map.cells[cell]) || this.list.length >= CIV_CAP) return null;
    const c = this.make(sim, cell, [0, 0]);
    c.state = state;
    c.t = state === 'cower' ? 1e9 : 0;
    this.list.push(c);
    return c;
  }

  // ------------------------------------------------------------ inside

  private stepOne(sim: CivSimView, c: Civilian): boolean {
    c.moved = 0;
    if (c.state === 'leaving') {
      c.t -= DT;
      c.alpha = Math.max(0, c.t / LEAVE_FADE);
      if (c.t <= 0) {
        this.escaped += 1;
        this.events.push({ kind: 'escaped', id: c.id, pos: { ...c.pos } });
        return false;
      }
      return true;
    }
    // The creep front overtakes it.
    const here = sim.cellAt(c.pos.x, c.pos.y);
    const onCreep = sim.isCreeped(here);
    c.creepT = onCreep ? c.creepT + DT : 0;
    if (c.creepT > TAKEN_AFTER) {
      this.taken += 1;
      this.events.push({ kind: 'taken', id: c.id, pos: { ...c.pos } });
      return false;
    }
    const near = onCreep || this.creepBeside(sim, here);

    if (c.state === 'calm') {
      c.t -= DT;
      if (c.t <= 0 || near) this.panic(c);
    } else if (c.state === 'cower') {
      c.t -= DT;
      // Frozen in fear, until the time runs out or the creep is at its feet.
      if (c.t <= 0 || onCreep) c.state = 'flee';
      else return true;
    }

    const speed = c.state === 'calm' ? STROLL : c.pace * (near ? NEAR_CREEP_RUN : 1);
    let budget = speed * DT;
    for (let guard = 0; guard < 4 && budget > 0; guard++) {
      const goal = this.spot(sim, c.to, c.off);
      const dx = goal.x - c.pos.x;
      const dy = goal.y - c.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) {
        const s = Math.min(d, budget);
        c.pos.x += (dx / d) * s;
        c.pos.y += (dy / d) * s;
        c.dir = { x: dx / d, y: dy / d };
        c.moved += s;
        budget -= s;
      }
      if (d <= budget + 1e-6 || d <= 1e-6) {
        c.cell = c.to;
        if (c.state !== 'calm' && this.isExit(sim, c.cell)) {
          c.state = 'leaving';
          c.t = LEAVE_FADE;
          return true;
        }
        c.to = this.nextCell(sim, c);
        if (c.to === c.cell) break;
      }
    }
    return true;
  }

  private panic(c: Civilian): void {
    // One in eight freezes first: cowering in a doorway before it runs.
    if (this.rng.next() < 0.12) {
      c.state = 'cower';
      c.t = this.rng.float(1.5, 4);
    } else {
      c.state = 'flee';
      c.t = 0;
    }
  }

  private creepBeside(sim: CivSimView, cell: number): boolean {
    const x = cell % this.w;
    const y = (cell / this.w) | 0;
    return (x > 0 && sim.isCreeped(cell - 1)) || (x < this.w - 1 && sim.isCreeped(cell + 1))
      || (y > 0 && sim.isCreeped(cell - this.w)) || (y < this.h - 1 && sim.isCreeped(cell + this.w));
  }

  /** The street cell it walks to next: downhill toward a way out, or (calm) a stroll. */
  private nextCell(sim: CivSimView, c: Civilian): number {
    const nbs = this.streetNeighbours(sim, c.cell);
    if (!nbs.length) return c.cell;
    if (c.state === 'calm') return this.rng.pick(nbs);
    const here = this.exitDist[c.cell];
    if (here < 0) {
      // No way out: away from the landing site.
      const core = sim.core;
      let best = c.cell;
      let bd = this.distTo(sim, c.cell, core);
      for (const n of nbs) {
        const d = this.distTo(sim, n, core) + this.rng.next() * 4;
        if (d > bd) { bd = d; best = n; }
      }
      return best;
    }
    let best = -1;
    let bd = Infinity;
    for (const n of nbs) {
      const d = this.exitDist[n];
      if (d < 0) continue;
      const score = d + this.rng.next() * 3;
      if (score < bd) { bd = score; best = n; }
    }
    return best >= 0 ? best : c.cell;
  }

  private distTo(sim: CivSimView, cell: number, p: Vec): number {
    const q = sim.cellCenter(cell);
    return Math.hypot(q.x - p.x, q.y - p.y);
  }

  private streetNeighbours(sim: CivSimView, cell: number): number[] {
    const out: number[] = [];
    const x = cell % this.w;
    const y = (cell / this.w) | 0;
    const cells = sim.map.cells;
    if (x > 0 && isStreet(cells[cell - 1])) out.push(cell - 1);
    if (x < this.w - 1 && isStreet(cells[cell + 1])) out.push(cell + 1);
    if (y > 0 && isStreet(cells[cell - this.w])) out.push(cell - this.w);
    if (y < this.h - 1 && isStreet(cells[cell + this.w])) out.push(cell + this.w);
    return out;
  }

  private isExit(sim: CivSimView, cell: number): boolean {
    if (!isStreet(sim.map.cells[cell])) return false;
    if (sim.gates.includes(cell)) return true;
    const x = cell % this.w;
    const y = (cell / this.w) | 0;
    return x === 0 || y === 0 || x === this.w - 1 || y === this.h - 1;
  }

  /** Its own spot in a street cell. */
  private spot(sim: CivSimView, cell: number, off: Vec): Vec {
    const p = sim.cellCenter(cell);
    return { x: p.x + off.x, y: p.y + off.y };
  }

  /** Cost to the nearest exit over the streets (Dijkstra; creep costs more, so they go round it). */
  private refield(sim: CivSimView): void {
    this.fieldAge = 0;
    const n = sim.map.cells.length;
    const dist = this.exitDist;
    dist.fill(-1);
    const heap = new MinHeap();
    for (let c = 0; c < n; c++) {
      if (this.isExit(sim, c)) { dist[c] = 0; heap.push(c, 0); }
    }
    while (heap.size) {
      const [c, d] = heap.pop();
      if (d !== dist[c]) continue;
      for (const nb of this.streetNeighbours(sim, c)) {
        const nd = d + STEP + (sim.isCreeped(nb) ? CREEP_COST : 0);
        if (dist[nb] < 0 || nd < dist[nb]) { dist[nb] = nd; heap.push(nb, nd); }
      }
    }
  }

  /** Street cells a crowd may stand on: claimed, off the creep and a cell clear of it, off the crash square. */
  private spawnable(sim: CivSimView, only: Uint8Array | null): number[] {
    const out: number[] = [];
    const cells = sim.map.cells;
    const core = sim.core;
    const clear = 6 * this.px;
    for (let c = 0; c < cells.length; c++) {
      if (!isStreet(cells[c]) || (only && !only[c])) continue;
      if (sim.isCreeped(c) || this.creepBeside(sim, c)) continue;
      if (this.distTo(sim, c, core) < clear) continue;
      out.push(c);
    }
    return out;
  }

  private spawn(sim: CivSimView, streets: number[], want: number, calm: [number, number]): void {
    if (!streets.length) return;
    const pool = streets.slice();
    for (let i = 0; i < want && this.list.length < CIV_CAP; i++) {
      // Mostly one to a cell; once the street runs out, two.
      if (!pool.length) pool.push(...streets);
      const k = this.rng.int(0, pool.length - 1);
      const cell = pool[k];
      pool[k] = pool[pool.length - 1];
      pool.pop();
      this.list.push(this.make(sim, cell, calm));
    }
  }

  private make(sim: CivSimView, cell: number, calm: [number, number]): Civilian {
    const r = this.px * 0.28;
    const off = { x: this.rng.float(-r, r), y: this.rng.float(-r, r) };
    const p = sim.cellCenter(cell);
    return {
      id: this.nextId++,
      pos: { x: p.x + off.x, y: p.y + off.y },
      cell, to: cell, off,
      state: 'calm',
      t: this.rng.float(calm[0], calm[1]),
      pace: this.rng.float(RUN[0], RUN[1]),
      creepT: 0,
      dir: { x: -0.7, y: 0.7 },
      moved: 0,
      look: this.rng.int(0, 2),
      alpha: 1,
    };
  }

  private checkNewPlates(sim: CivSimView): void {
    const cells = sim.map.cells;
    let fresh: Uint8Array | null = null;
    let count = 0;
    for (let c = 0; c < cells.length; c++) {
      if (this.claimed[c] || cells[c] === CellType.Void) continue;
      this.claimed[c] = 1;
      fresh ??= new Uint8Array(cells.length);
      fresh[c] = 1;
      count++;
    }
    if (!fresh) return;
    this.refield(sim);
    const streets = this.spawnable(sim, fresh);
    const fewer = Math.max(0.25, 1 - sim.waveNumber * 0.15);
    const want = Math.round(Math.max(4, Math.min(12, streets.length * 0.12)) * fewer);
    if (count) this.spawn(sim, streets, want, [0.3, 2.5]);
  }
}

/** A small binary min-heap of (cell, cost). */
class MinHeap {
  private c: number[] = [];
  private d: number[] = [];
  get size(): number {
    return this.c.length;
  }
  push(cell: number, cost: number): void {
    const c = this.c;
    const d = this.d;
    let i = c.length;
    c.push(cell);
    d.push(cost);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p] <= d[i]) break;
      [c[p], c[i]] = [c[i], c[p]];
      [d[p], d[i]] = [d[i], d[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const c = this.c;
    const d = this.d;
    const top: [number, number] = [c[0], d[0]];
    const lc = c.pop()!;
    const ld = d.pop()!;
    if (c.length) {
      c[0] = lc;
      d[0] = ld;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < c.length && d[l] < d[m]) m = l;
        if (r < c.length && d[r] < d[m]) m = r;
        if (m === i) break;
        [c[m], c[i]] = [c[i], c[m]];
        [d[m], d[i]] = [d[i], d[m]];
        i = m;
      }
    }
    return top;
  }
}
