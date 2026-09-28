/**
 * The body below: a side-view cross-section under the city (row 0 is just
 * under the surface). Generated from its own seeded stream so it never shifts
 * the surface sim's rng order.
 */
import { Rng } from './rng';
import {
  DEPOSITS, FEATURES, depositPayAt, type DepositPay, METEOR_COLS, METEOR_ROWS, ROCK_SHARE, UNDER_H, UNDER_W,
  type DepositKind, type FeatureKind,
} from '../../content/underground';
import type { ModPip, TowerFamily } from './types';

export type UnderKind = 'soil' | 'rock' | 'meteor' | 'deposit' | 'feature';

export interface UnderCell {
  kind: UnderKind;
  deposit?: DepositKind;
  feature?: FeatureKind;
  /** Deposit already dug onto (paid out). */
  claimed?: boolean;
  /** Gene cache: the bonuses waiting in it (shown before you dig). */
  pips?: ModPip[];
  /** What this deposit pays (deeper is richer). */
  pay?: DepositPay;
}

export interface Underground {
  w: number;
  h: number;
  cells: UnderCell[];
}

export function neighbours4(u: Underground, i: number): number[] {
  const x = i % u.w;
  const y = Math.floor(i / u.w);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < u.w - 1) out.push(i + 1);
  if (y > 0) out.push(i - u.w);
  if (y < u.h - 1) out.push(i + u.w);
  return out;
}

/** Cells a digger can pass (everything but rock). */
function reachableFromMeteor(u: Underground): Set<number> {
  const seen = new Set<number>();
  const stack: number[] = [];
  u.cells.forEach((c, i) => { if (c.kind === 'meteor') { seen.add(i); stack.push(i); } });
  while (stack.length) {
    const i = stack.pop()!;
    for (const n of neighbours4(u, i)) {
      if (seen.has(n) || u.cells[n].kind === 'rock' || u.cells[n].kind === 'feature') continue;
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

export function createUnderground(seed: number, pipPool: readonly TowerFamily[]): Underground {
  const rng = new Rng((seed ^ 0x5eed_b0d1) >>> 0);
  const u: Underground = {
    w: UNDER_W, h: UNDER_H,
    cells: Array.from({ length: UNDER_W * UNDER_H }, () => ({ kind: 'soil' as UnderKind })),
  };
  for (const y of METEOR_ROWS) for (const x of METEOR_COLS) u.cells[y * u.w + x] = { kind: 'meteor' };
  const free = (row: number) => {
    const out: number[] = [];
    for (let x = 0; x < u.w; x++) if (u.cells[row * u.w + x].kind === 'soil') out.push(row * u.w + x);
    return out;
  };
  const inRows = (rows: [number, number]) => {
    const out: number[] = [];
    for (let y = rows[0]; y <= rows[1]; y++) out.push(...free(y));
    return out;
  };
  // Features first (they are fixed and block digging), then deposits, then rock.
  for (const kind of Object.keys(FEATURES) as FeatureKind[]) {
    const opts = inRows(FEATURES[kind].rows);
    if (opts.length) u.cells[rng.pick(opts)] = { kind: 'feature', feature: kind };
  }
  for (const kind of Object.keys(DEPOSITS) as DepositKind[]) {
    for (let k = 0; k < DEPOSITS[kind].count; k++) {
      const opts = inRows(DEPOSITS[kind].rows);
      if (!opts.length) continue;
      const cell: UnderCell = { kind: 'deposit', deposit: kind };
      const at = rng.pick(opts);
      cell.pay = depositPayAt(DEPOSITS[kind], Math.floor(at / u.w));
      if (kind === 'cache') {
        cell.pips = Array.from({ length: DEPOSITS.cache.now.pips ?? 0 }, () => ({ family: rng.pick(pipPool) }));
      }
      u.cells[at] = cell;
    }
  }
  // Rock, one lump at a time, never cutting any deposit or soil off from the meteor.
  const want = Math.round(ROCK_SHARE * u.w * (u.h - 2));
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < want; tries++) {
    const opts = inRows([2, u.h - 1]);
    if (!opts.length) break;
    const i = rng.pick(opts);
    u.cells[i] = { kind: 'rock' };
    const reach = reachableFromMeteor(u);
    const cutOff = u.cells.some((c, j) => (c.kind === 'soil' || c.kind === 'deposit') && !reach.has(j));
    if (cutOff) u.cells[i] = { kind: 'soil' };
    else placed++;
  }
  return u;
}
