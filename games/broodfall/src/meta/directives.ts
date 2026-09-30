/**
 * EMPIRE DIRECTIVES — the standing orders' rules (no DOM; content/directives.ts is the orders,
 * src/ui/directives.ts the screen). Pure: every function takes a state and returns a new one.
 *
 * Orders are issued the day Command clears the Directive Desk (src/meta/onboarding.ts deskOpen),
 * three at a time in the list's order. Each deployment after that adds to every open order;
 * a full one pays its standing, files its acknowledgement in the log, and the next is issued.
 */
import type { OrganId, SimConfig } from '../sim/types';
import { ORDERS, ORDERS_OPEN, type OrderDef } from '../../content/directives';
import { TERRITORIES } from '../../content/campaign';
import { measure, type RunReport } from './goals';
import type { CampaignState } from './campaign';

export interface OpenOrder {
  id: string;
  progress: number;
  /** The deployment count when it was issued. */
  since: number;
  /** The lineage put on trial with it (SO 31-F). */
  trial?: OrganId;
}

export interface OrdersState {
  open: OpenOrder[];
  /** Fulfilled, oldest first. */
  done: string[];
  /** Every deployment's own directive, and whether it was fulfilled (the screen's record). */
  record: Array<{ territory: string; kind: 'hold' | 'royal' | 'harvest'; won: boolean }>;
}

/** What one deployment did to the standing orders (for the report). */
export interface OrdersReport {
  moved: Array<{ id: string; before: number; after: number; target: number }>;
  fulfilled: string[];
  standing: number;
  issued: string[];
  lineages: OrganId[];
}

export const orderDef = (id: string): OrderDef => ORDERS.find((o) => o.id === id)!;

/** The orders on record, or the first ones Command would issue (an older save whose desk is open has none yet). */
export function ordersOf(s: CampaignState): OrdersState {
  return s.orders ?? issue({ open: [], done: [], record: [] }, s).orders;
}

/** Issue orders until three are open (in the list's order; one never issued twice). */
function issue(o: OrdersState, s: CampaignState): { orders: OrdersState; issued: string[] } {
  const orders: OrdersState = structuredClone(o);
  const issued: string[] = [];
  for (const def of ORDERS) {
    if (orders.open.length >= ORDERS_OPEN) break;
    if (orders.done.includes(def.id) || orders.open.some((x) => x.id === def.id)) continue;
    const open: OpenOrder = { id: def.id, progress: 0, since: s.deployments };
    if (def.trial) {
      // The first lineage of the trial list he does not have yet; none left, no trial (the order is skipped).
      const t = def.trial.find((l) => !s.lineages.includes(l));
      if (!t) continue;
      open.trial = t;
    }
    orders.open.push(open);
    issued.push(def.id);
  }
  return { orders, issued };
}

/** What the open orders put into a deployment: Command's equipment, and a lineage on trial in its organ pool. */
export function ordersSetup(s: CampaignState): { config: Partial<SimConfig>; trial: OrganId[] } {
  if (!s.orders) return { config: {}, trial: [] };
  const config: Partial<SimConfig> = {};
  const trial: OrganId[] = [];
  for (const o of s.orders.open) {
    Object.assign(config, orderDef(o.id).equip ?? {});
    if (o.trial) trial.push(o.trial);
  }
  return { config, trial };
}

/** How much one deployment adds to an order. */
export function addedBy(def: OrderDef, r: RunReport, what: { captured: string | null; repelled: string | null }): number {
  const [kind, arg] = def.measure.split(':');
  let v: number;
  if (kind === 'camp') {
    v = arg === 'captured' ? (what.captured ? 1 : 0)
      : arg === 'repelled' ? (what.repelled ? 1 : 0)
        : arg === 'won' ? (r.won ? 1 : 0)
          : arg === 'hard' ? (what.captured && (TERRITORIES.find((t) => t.id === what.captured)?.tier ?? 0) >= 3 ? 1 : 0)
            : 0;
  } else v = measure(def.measure, r);
  if (def.each) return v >= def.each.min && (!def.each.needsWin || r.won) ? 1 : 0;
  return Math.max(0, Math.round(v));
}

/**
 * A finished deployment, applied to the standing orders. Called by campaign.ts finish() after the
 * territory is settled. `countable`: the desk was already open before this deployment (the one
 * that clears it only starts the orders).
 */
export function applyOrders(prev: CampaignState, r: RunReport, what: {
  territory: string; directive?: SimConfig['directive']; captured: string | null; repelled: string | null; countable: boolean;
}): { state: CampaignState; report: OrdersReport } {
  const s: CampaignState = structuredClone(prev);
  const report: OrdersReport = { moved: [], fulfilled: [], standing: 0, issued: [], lineages: [] };
  let orders: OrdersState = s.orders ?? { open: [], done: [], record: [] };
  if (what.directive) orders.record.push({ territory: what.territory, kind: what.directive.kind, won: r.won });
  if (what.countable && s.orders) {
    for (const o of orders.open) {
      const def = orderDef(o.id);
      const add = addedBy(def, r, what);
      if (!add) continue;
      const before = o.progress;
      o.progress = Math.min(def.target, o.progress + add);
      report.moved.push({ id: o.id, before, after: o.progress, target: def.target });
    }
    for (const o of [...orders.open]) {
      const def = orderDef(o.id);
      if (o.progress < def.target) continue;
      orders.open = orders.open.filter((x) => x !== o);
      orders.done.push(o.id);
      report.fulfilled.push(o.id);
      report.standing += def.pays;
      if (o.trial && !s.lineages.includes(o.trial)) { s.lineages.push(o.trial); report.lineages.push(o.trial); }
      s.log.push(`${def.form} · ${def.title}: ${def.ack}`);
    }
  }
  const out = issue(orders, s);
  orders = out.orders;
  report.issued = what.countable || !s.orders ? out.issued : [];
  s.orders = orders;
  s.standing += report.standing;
  return { state: s, report };
}
