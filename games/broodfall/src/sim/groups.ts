/**
 * LOW-MICRO UNIT COMMAND (Collins, Oct 2 2026: "a key to making this good is going to be keeping RTS very, very low ...
 * people who play tower defence don't like doing a lot ... an image of every unit type you have in the top left of
 * your screen, as well as an ALL UNITS button ... click one of these, then click a location, and all units of that
 * type (or all units) go there or fight the thing you clicked (they also know how to use the tunnel, where it's
 * faster, that we built between home base and outposts)").
 *
 * The rule (DESIGN.md "UNITS ARE OPTIONAL"): the game is winnable without ever ordering a unit; an order is one click
 * for a whole group. So this layer gives:
 *   - GROUP ORDERS by unit kind (or ALL fighters), resolved by what was clicked: an enemy or one of its structures =
 *     a SORTIE (hunt it down, then come home); your outpost = guard its door; the body = come home; ground = go there
 *     and fight what they meet (attack-move), and stay.
 *   - ROUTING through the tunnel (the expansion's tunnel head: Sim.tunnelLink, the 'tunnel' command) whenever the
 *     walk to its mouth + the transit + the walk from its far end beats walking, both ways, per unit.
 *   - IDLE JOBS no one has to order: idle Brood Pit warriors answer a leak at the body; a hurt unit off the creep
 *     walks back onto it to heal (creep care) and then goes back to what it was doing.
 *   - ALERTS (science party, engineer, field station, outpost under attack) the player answers in one click (SEND),
 *     or lets a unit kind answer by itself (its AUTO toggle).
 *
 * Every step is a sim command or a deterministic pass of the tick (groupTick runs before the units move).
 */
import { enemySpec, type Sim } from './sim';
import type { Broodling, Broodmother, Command, Harrier, Infestor, SporeMule, UnitOrder, Vec } from './types';
import { BALANCE as B } from '../../content/data';

export type Unit = Broodling | Broodmother | SporeMule | Infestor | Harrier;
export type UnitKind = 'warrior' | 'mother' | 'mule' | 'infestor' | 'harrier';
export type Who = UnitKind | 'all';

/**
 * Every unit kind of yours, in roster order. A new kind is one line here (its list and its speed): the roster, the
 * group orders and the alerts pick it up. inAll: ALL UNITS sends it (fighters only: an unarmed Spore Mule or a
 * precious Infestor is never swept into a fight by the ALL button; they have their own portraits).
 */
export const UNIT_KINDS: ReadonlyArray<{ kind: UnitKind; name: string; inAll: boolean; list: (s: Sim) => Unit[]; speed: () => number }> = [
  { kind: 'warrior', name: 'WARRIORS', inAll: true, list: (s) => s.broodlings.filter((b) => !b.puppet), speed: () => B.broodSpeed },
  { kind: 'mother', name: 'BROODMOTHERS', inAll: true, list: (s) => s.mothers, speed: () => B.motherSpeed },
  { kind: 'harrier', name: 'HARRIERS', inAll: true, list: (s) => s.harriers, speed: () => B.harrierSpeed },
  { kind: 'mule', name: 'SPORE MULES', inAll: false, list: (s) => s.mules, speed: () => B.muleSpeed },
  { kind: 'infestor', name: 'INFESTORS', inAll: false, list: (s) => s.infestors, speed: () => B.infestorSpeed },
];

export function kindOf(s: Sim, u: Unit): UnitKind {
  for (const k of UNIT_KINDS) if (k.list(s).includes(u)) return k.kind;
  return 'warrior';
}

/** The units a group order goes to. */
export function unitsOf(s: Sim, who: Who): Unit[] {
  if (who === 'all') return UNIT_KINDS.filter((k) => k.inAll).flatMap((k) => k.list(s));
  return UNIT_KINDS.find((k) => k.kind === who)?.list(s) ?? [];
}

/** What a click on the board means for a group order. */
export type GroupTarget =
  | { kind: 'enemy'; id: number; at: Vec }
  | { kind: 'outpost'; shelterId: number; at: Vec }
  | { kind: 'body'; at: Vec }
  | { kind: 'ground'; at: Vec };

export type AlertKind = 'science' | 'engineer' | 'station' | 'outpost' | 'dome';

/** Something the player may want to answer with one click. */
export interface Alert {
  id: number;
  kind: AlertKind;
  /** The enemy it is about (a party's lead, an engineer, a station), or the outpost (shelter id). */
  targetId: number;
  at: Vec;
  /** Sim time it was raised. */
  since: number;
  /** Who answers it (SEND, or AUTO). */
  who: UnitKind[];
  /** Answered already (by SEND or AUTO): not offered again. */
  answered?: boolean;
}

/** Who answers each kind of alert, and which kinds answer by themselves until the player says otherwise. */
export const ALERT_ANSWER: Record<AlertKind, UnitKind[]> = {
  science: ['harrier', 'warrior'],
  engineer: ['harrier', 'warrior'],
  station: ['warrior', 'mother', 'harrier'],
  outpost: ['warrior', 'mother'],
  // A SHIELD DOME (the dome fork's Aegis Deacon / Lens Bearer): it soaks your limbs' fire, not your units' blows.
  dome: ['warrior', 'mother', 'harrier'],
};
export const AUTO_DEFAULT: Record<UnitKind, boolean> = { warrior: true, harrier: true, mother: false, mule: false, infestor: false };

/** The expansion's tunnel (Sim.tunnelLink), read without depending on it being built yet. */
export interface TunnelLink { bodyCell: number; headCell: number; headOutpostId: number }

/** A sortie: hunt this down (or clear this spot), then come home. */
interface Sortie { targetId?: number; to: Vec; home?: Vec; quiet: number }
/** A hurt unit walking back onto the creep to heal: what it was doing, to go back to. */
interface Retreat { orders: UnitOrder[]; guard?: Vec }

export class Groups {
  readonly sorties = new Map<number, Sortie>();
  readonly retreats = new Map<number, Retreat>();
  auto: Record<UnitKind, boolean> = { ...AUTO_DEFAULT };
  alerts: Alert[] = [];
  private alertSeq = 1;
  private alertClock = 0;
  /** Group orders issued (a click count for the measure). */
  issued = 0;

  constructor(private readonly s: Sim) {}

  /** A unit was given a direct order by the player: it is no longer on a sortie or a retreat. */
  forget(id: number): void {
    this.sorties.delete(id);
    this.retreats.delete(id);
  }

  /** Read what was clicked at a world point. */
  targetAt(at: Vec): GroupTarget {
    const s = this.s;
    let best: { id: number; d: number; at: Vec } | null = null;
    for (const e of s.enemies) {
      if (e.burrowed) continue;
      const d = Math.hypot(e.pos.x - at.x, e.pos.y - at.y);
      const r = e.kind === 'fieldstation' ? 30 : 20;
      if (d <= r && (!best || d < best.d)) best = { id: e.id, d, at: { ...e.pos } };
    }
    if (best) return { kind: 'enemy', id: best.id, at: best.at };
    for (const sh of s.shelters) {
      if (sh.state !== 'infested') continue;
      const door = s.cellCenter(sh.door);
      if (sh.cells.includes(s.cellAt(at.x, at.y)) || Math.hypot(door.x - at.x, door.y - at.y) < 22 || Math.hypot(sh.pos.x - at.x, sh.pos.y - at.y) < 30) {
        return { kind: 'outpost', shelterId: sh.id, at: door };
      }
    }
    const body = s.bodyPoint();
    if (Math.hypot(s.core.x - at.x, s.core.y - at.y) < 40 || Math.hypot(body.x - at.x, body.y - at.y) < 18) return { kind: 'body', at: body };
    return { kind: 'ground', at: { ...at } };
  }

  /**
   * One click for a whole group: every unit of the kind (or ALL fighters) is sent at the target, each by the fastest
   * way (the tunnel when it beats walking). Returns how many units answered.
   */
  order(who: Who, target: GroupTarget): number {
    const units = unitsOf(this.s, who).filter((u) => !this.inTunnel(u.id));
    if (units.length) this.issued++;
    return this.orderSome(units, target, false);
  }

  /** Answer an alert with its responders (SEND). */
  answer(alertId: number): number {
    const al = this.alerts.find((x) => x.id === alertId);
    if (!al) return 0;
    al.answered = true;
    this.issued++;
    return this.send(al, al.who);
  }

  /** Send an alert's responders of these kinds: the free ones (not on a sortie or a retreat already), as a sortie. */
  private send(al: Alert, kinds: UnitKind[]): number {
    const target: GroupTarget = al.kind === 'outpost'
      ? { kind: 'outpost', shelterId: al.targetId, at: al.at }
      : { kind: 'enemy', id: al.targetId, at: al.at };
    const free = kinds.flatMap((k) => unitsOf(this.s, k)).filter((u) => !this.sorties.has(u.id) && !this.retreats.has(u.id) && !this.inTunnel(u.id));
    return this.orderSome(free, target, true);
  }

  /**
   * The order itself. An enemy (or an answered alert) = a SORTIE: run it down, then come home once the spot is quiet.
   * The body = come home. Ground or an outpost = go there fighting what they meet, and stay.
   */
  private orderSome(units: Unit[], target: GroupTarget, sortie: boolean): number {
    const s = this.s;
    const dest = target.kind === 'body' ? s.bodyPoint() : s.standableAt(target.at) ?? s.bodyPoint();
    units.forEach((u, i) => {
      this.forget(u.id);
      const list = this.ordersOf(u);
      const kind = kindOf(s, u);
      if ('cystId' in u) u.infest = undefined;
      // A group spreads round the point, so it does not stand in one heap (the spiral the sim's own orders use).
      const a = i * 2.399;
      const r = units.length > 1 ? 6 + 3 * Math.sqrt(i) : 0;
      const p = s.standableAt({ x: dest.x + Math.cos(a) * r, y: dest.y + Math.sin(a) * r }) ?? dest;
      list.length = 0;
      if (target.kind === 'body') {
        this.route(u, kind, dest, list);
        list.push({ kind: 'return' });
        return;
      }
      if (target.kind === 'enemy' || sortie) {
        this.sorties.set(u.id, { targetId: target.kind === 'enemy' ? target.id : undefined, to: p, home: this.homeOf(u), quiet: 0 });
      }
      this.route(u, kind, p, list);
      list.push({ kind: 'attack', to: p });
    });
    return units.length;
  }

  /** Where a unit goes back to after a sortie: its own post (a Pit warrior's is its rally point: undefined). */
  private homeOf(u: Unit): Vec | undefined {
    if ('mode' in u) return { ...u.guard };
    return u.guard ? { ...u.guard } : undefined;
  }

  private ordersOf(u: Unit): UnitOrder[] {
    if ('mode' in u || 'strain' in u || 'cystId' in u || 'glandId' in u) return u.orders;
    return (u.orders ??= []);
  }

  private inTunnel(id: number): boolean {
    const t = (this.s as unknown as { inTunnel?: Array<{ unitId: number }> }).inTunnel;
    return !!t && t.some((x) => x.unitId === id);
  }

  /** The tunnel, if the expansion's tunnel head exists. */
  tunnel(): TunnelLink | null {
    const f = (this.s as unknown as { tunnelLink?: () => TunnelLink | null }).tunnelLink;
    return typeof f === 'function' ? f.call(this.s) : null;
  }

  /**
   * Put the walk to the tunnel's mouth in front of an order when the tunnel is faster: the walk to the mouth + the
   * transit + the walk from the far end, against walking. Both ways.
   */
  route(u: Unit, kind: UnitKind, to: Vec, list: UnitOrder[]): void {
    const link = this.tunnel();
    if (!link) return;
    const plan = chooseRoute(this.s, this.s.cellAt(u.pos.x, u.pos.y), this.s.cellAt(to.x, to.y), link, UNIT_KINDS.find((k) => k.kind === kind)!.speed());
    if (plan === 'walk') return;
    const mouth = plan === 'toHead' ? link.bodyCell : link.headCell;
    list.push({ kind: 'move', to: this.s.cellCenter(mouth), enter: plan === 'toHead' ? 'head' : 'body' });
  }

  /**
   * Every tick, before the units move: sorties chase their quarry and come home when the spot is quiet; hurt units off
   * the creep walk back onto it and, healed, go back to what they were doing; idle Pit warriors answer a leak at the
   * body; units at the tunnel's mouth go in; alerts are raised and answered by the kinds set to AUTO.
   */
  tick(dt: number): void {
    const s = this.s;
    // The tunnel's mouth.
    for (const k of UNIT_KINDS) for (const u of k.list(s)) {
      const o = this.ordersOf(u)[0];
      if (!o || o.kind !== 'move' || !o.enter) continue;
      if (Math.hypot(u.pos.x - o.to.x, u.pos.y - o.to.y) > 18) continue;
      const toHead = o.enter === 'head';
      this.ordersOf(u).shift();
      if (this.tunnel()) s.issue({ kind: 'tunnel', ids: [u.id], toHead } as unknown as Command);
    }
    // Sorties.
    for (const [id, so] of [...this.sorties]) {
      const u = s.unitById(id);
      if (!u) { this.sorties.delete(id); continue; }
      const list = this.ordersOf(u);
      if (list.some((o) => o.kind === 'move' && o.enter)) continue; // still on its way to the tunnel
      const quarry = so.targetId !== undefined ? s.enemies.find((e) => e.id === so.targetId && !e.burrowed) : undefined;
      if (quarry) {
        // Run it down: the attack-move follows it.
        const p = s.standableAt(quarry.pos) ?? quarry.pos;
        if (list.length && list[list.length - 1].kind === 'attack') list[list.length - 1] = { kind: 'attack', to: p };
        else { list.length = 0; list.push({ kind: 'attack', to: p }); }
        so.quiet = 0;
        continue;
      }
      so.targetId = undefined;
      const busy = s.enemies.some((e) => !e.burrowed && Math.hypot(e.pos.x - u.pos.x, e.pos.y - u.pos.y) < 70);
      so.quiet = busy ? 0 : so.quiet + dt;
      if (so.quiet < 2) continue;
      // The spot is quiet: home.
      this.sorties.delete(id);
      list.length = 0;
      if (so.home) {
        this.route(u, kindOf(s, u), so.home, list);
        list.push({ kind: 'move', to: so.home });
      } else if (!('mode' in u)) {
        (u as { guard?: Vec }).guard = undefined; // a Pit warrior: back to its rally point
      }
    }
    // Retreats: a hurt unit off the creep walks onto it; healed, it goes back.
    for (const k of UNIT_KINDS) {
      if (k.kind === 'infestor' || k.kind === 'mule') continue; // never pulled off a job (a burrow, a deployment)
      for (const u of k.list(s)) {
        const r = this.retreats.get(u.id);
        if (r) {
          if (u.hp >= u.maxHp * B.unitRetreatHealed) {
            this.retreats.delete(u.id);
            const list = this.ordersOf(u);
            list.length = 0;
            list.push(...r.orders);
            if (r.guard) (u as { guard?: Vec }).guard = { ...r.guard };
          }
          continue;
        }
        if (u.hp > u.maxHp * B.unitRetreatAt) continue;
        const here = s.cellAt(u.pos.x, u.pos.y);
        if (s.isCreeped(here)) continue;
        const list = this.ordersOf(u);
        const cur = list[0];
        // The player's own move or hold is his: a hurt unit he parked stays parked.
        if (cur && (cur.kind === 'hold' || (cur.kind === 'move' && !this.sorties.has(u.id)))) continue;
        const safe = s.nearestCreepStreet(u.pos);
        if (!safe) continue;
        this.retreats.set(u.id, { orders: [...list], guard: (u as { guard?: Vec }).guard ? { ...(u as { guard?: Vec }).guard! } : undefined });
        this.sorties.delete(u.id);
        list.length = 0;
        list.push({ kind: 'move', to: safe });
      }
    }
    // Idle Pit warriors answer a leak at the body.
    const leak = s.enemies.find((e) => !e.burrowed && !s.isAirborne(e) && Math.hypot(e.pos.x - s.core.x, e.pos.y - s.core.y) < B.leakRadius);
    if (leak) {
      for (const b of s.broodlings) {
        if (b.puppet || b.motherUnit !== undefined || (b.orders && b.orders.length) || this.sorties.has(b.id) || this.retreats.has(b.id)) continue;
        if (Math.hypot(b.pos.x - s.core.x, b.pos.y - s.core.y) > B.leakAnswerDist) continue;
        this.sorties.set(b.id, { targetId: leak.id, to: { ...leak.pos }, home: b.guard ? { ...b.guard } : undefined, quiet: 0 });
        (b.orders ??= []).push({ kind: 'attack', to: s.standableAt(leak.pos) ?? { ...leak.pos } });
      }
    }
    // Alerts, about once a second.
    this.alertClock -= dt;
    if (this.alertClock <= 0) {
      this.alertClock = 1;
      this.raiseAlerts();
    }
  }

  private raiseAlerts(): void {
    const s = this.s;
    const live: Alert[] = [];
    const keep = (kind: AlertKind, targetId: number, at: Vec): void => {
      const old = this.alerts.find((x) => x.kind === kind && x.targetId === targetId);
      const al: Alert = old ? { ...old, at } : { id: this.alertSeq++, kind, targetId, at, since: s.time, who: ALERT_ANSWER[kind] };
      if (!old) s.pushEvent({ kind: 'unit-alert', alertId: al.id, alert: kind, at: { ...at } });
      live.push(al);
    };
    for (const e of s.enemies) {
      if (e.burrowed) continue;
      if (e.kind === 'fieldstation') { keep('station', e.id, e.pos); continue; }
      if (e.kind === 'engineer') { keep('engineer', e.id, e.pos); continue; }
    }
    // A shield dome standing within your limbs' reach (a bearer: Sim.domeBearers, the dome fork's): your units must
    // break it, the limbs cannot. Read without depending on it being built yet.
    const bearers = (s as unknown as { domeBearers?: Array<{ id: number; pos: Vec; burrowed?: boolean }> }).domeBearers ?? [];
    for (const b of bearers) {
      if (b.burrowed) continue;
      if (s.towers.some((t) => Math.hypot(t.pos.x - b.pos.x, t.pos.y - b.pos.y) <= s.statsOf(t).range + 40)) keep('dome', b.id, b.pos);
    }
    // A science party: one alert per party (its lead: the first of them within 60 px of each other).
    const science = s.enemies.filter((e) => !e.burrowed && enemySpec(e.kind).caste === 'science' && !enemySpec(e.kind).fixed && !enemySpec(e.kind).engineer);
    const leads: typeof science = [];
    for (const e of science) if (!leads.some((l) => Math.hypot(l.pos.x - e.pos.x, l.pos.y - e.pos.y) < 60)) leads.push(e);
    for (const l of leads) {
      // The same party keeps its alert: re-key to an old alert's lead if it is still alive and near.
      const old = this.alerts.find((x) => x.kind === 'science' && science.some((e) => e.id === x.targetId && Math.hypot(e.pos.x - l.pos.x, e.pos.y - l.pos.y) < 60));
      keep('science', old ? old.targetId : l.id, l.pos);
    }
    for (const sh of s.shelters) {
      if (sh.state !== 'infested') continue;
      const hit = sh.harmThisWave > 0 && s.enemies.some((e) => !e.burrowed && Math.hypot(e.pos.x - sh.pos.x, e.pos.y - sh.pos.y) < 90);
      if (hit) keep('outpost', sh.id, s.cellCenter(sh.door));
    }
    this.alerts = live;
    // AUTO: the kinds set to answer by themselves do.
    for (const al of this.alerts) {
      if (al.answered) continue;
      const kinds = al.who.filter((k) => this.auto[k]);
      if (!kinds.length) continue;
      // Harriers already hunt the science caste on their own; an alert about one needs no extra order for them.
      const send = al.kind === 'science' ? kinds.filter((k) => k !== 'harrier') : kinds;
      if (send.length === 0 || this.send(al, send) > 0 || kinds.length === 1) al.answered = true;
    }
  }
}

/**
 * Walk, or go through the tunnel (and which way)? Street steps from here to the goal, against the steps to the mouth,
 * the transit (in steps at this speed) and the steps from the far end. The tunnel must win by a margin.
 */
export function chooseRoute(s: Sim, from: number, to: number, link: TunnelLink, speed: number): 'walk' | 'toHead' | 'toBody' {
  const direct = s.streetSteps(from, to);
  const transit = ((B as { tunnelTransit?: number }).tunnelTransit ?? 2) * speed / s.cfg.cellPx;
  const viaHead = s.streetSteps(from, link.bodyCell) + transit + s.streetSteps(link.headCell, to);
  const viaBody = s.streetSteps(from, link.headCell) + transit + s.streetSteps(link.bodyCell, to);
  const best = Math.min(direct, viaHead, viaBody);
  if (best >= direct * B.tunnelMargin) return 'walk';
  return viaHead <= viaBody ? 'toHead' : 'toBody';
}
