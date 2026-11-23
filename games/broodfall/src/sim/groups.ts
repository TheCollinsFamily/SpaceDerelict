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
import { isPassable } from './citymap';

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
/**
 * STANCES (Collins, Nov 23 2026: "on the little critters you can generate and control we should have an AI for auto handling
 * them in one of two settings, defensive and hunter (which targets science teams while trying to stay in cover) ... and
 * maybe an offensive as well that targets where bases are being set up"). What a unit kind does with no one ordering it:
 *   OFF    — only what it is told; it guards its post.
 *   DEFEND — answers whatever comes into COVER (your limbs' fire or your creep): parties, engineers, domes, a station, an
 *            outpost under attack; it chases nothing out of cover, it comes home.
 *   HUNT   — the science teams. It waits in cover at the point nearest the closest team and strikes the moment one comes
 *            within its reach of cover; a team that walks out of it is let go, and it waits again.
 *   RAID   — where the bases are going up: engineers and field stations, anywhere on the board, then home.
 * The player's own orders come first, always. A hurt unit off the creep still walks back onto it to heal.
 */
export type Stance = 'off' | 'defend' | 'hunt' | 'raid';
export const STANCES: ReadonlyArray<{ stance: Stance; name: string; tip: string }> = [
  { stance: 'off', name: 'OFF', tip: 'OFF: only what you order; they guard their post' },
  { stance: 'defend', name: 'DEFEND', tip: 'DEFEND: they fight whatever comes inside your limbs\' fire or onto your creep, and never chase it out' },
  { stance: 'hunt', name: 'HUNT', tip: 'HUNT: they go for the science teams, waiting in cover and striking when a team comes in reach of it' },
  { stance: 'raid', name: 'RAID', tip: 'RAID: they go for the engineers and field stations, wherever the hive is setting up a base' },
];
export const STANCE_DEFAULT: Record<UnitKind, Stance> = { warrior: 'defend', harrier: 'hunt', mother: 'off', mule: 'off', infestor: 'off' };
/** The kinds a stance applies to (an unarmed Spore Mule or a precious Infestor never goes anywhere by itself). */
export const STANCE_KINDS: ReadonlyArray<UnitKind> = ['warrior', 'mother', 'harrier'];
/** The alerts each stance answers by itself. */
const STANCE_ANSWERS: Record<Stance, AlertKind[]> = {
  off: [],
  defend: ['science', 'engineer', 'station', 'outpost', 'dome'],
  hunt: ['science'],
  raid: ['engineer', 'station'],
};
/** How far from cover a unit of this kind strikes (px): a Harrier shoots from its range, a biter steps out a little. */
export function strikeOf(kind: UnitKind): number {
  return kind === 'harrier' ? B.harrierRange : kind === 'mother' ? 70 : 60;
}
/** Kept for the old AUTO switch and its readers: a kind answers by itself when its stance is not OFF. */
export const AUTO_DEFAULT: Record<UnitKind, boolean> = { warrior: true, harrier: true, mother: false, mule: false, infestor: false };

/** The expansion's tunnel (Sim.tunnelLink), read without depending on it being built yet. */
export interface TunnelLink { bodyCell: number; headCell: number; headOutpostId: number }

/** A sortie: hunt this down (or clear this spot), then come home. */
interface Sortie { targetId?: number; to: Vec; home?: Vec; quiet: number }
/**
 * A STANCE'S SQUAD (Collins, Nov 23 2026: "and it will know to keep them together right? like it would be dumb if they all
 * drip to whatever is closest"). Every unit on one stance is one squad with ONE target. It forms up before it goes
 * (gather), goes on it together (the ones out in front wait for the rest unless they are already fighting), and a unit
 * that comes free while the squad is out (born, healed) waits at home for the next forming-up instead of walking in alone.
 *   gather — forming up at `at` (the unit nearest the target, or where a HUNT squad waits); it goes when it is together
 *   go     — on the target together
 *   wait   — HUNT: waiting together in cover at `at`, nearest the closest science team
 */
export interface Squad {
  members: number[];
  /** The alert it is on: its kind and its enemy (or the outpost's shelter). */
  target?: { kind: AlertKind; targetId: number };
  phase: 'gather' | 'go' | 'wait';
  at?: Vec;
  /** Seconds in this phase. */
  clock: number;
}
/** A hurt unit walking back onto the creep to heal: what it was doing, to go back to. */
interface Retreat { orders: UnitOrder[]; guard?: Vec }

export class Groups {
  readonly sorties = new Map<number, Sortie>();
  readonly retreats = new Map<number, Retreat>();
  /** One squad a stance (src/sim/groups.ts Squad). */
  readonly squads = new Map<Stance, Squad>();
  /** Where a squad member came from, kept until it is home again (a Pit warrior's is its rally point: undefined). */
  private readonly homes = new Map<number, Vec | undefined>();
  private squadClock = 0;
  private cover: number[] | null = null;
  stance: Record<UnitKind, Stance> = { ...STANCE_DEFAULT };
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
    this.leaveSquad(id);
    this.homes.delete(id);
  }

  /** The squad a unit is in, if any. */
  squadOf(id: number): Squad | undefined {
    for (const sq of this.squads.values()) if (sq.members.includes(id)) return sq;
    return undefined;
  }

  private leaveSquad(id: number): void {
    for (const sq of this.squads.values()) sq.members = sq.members.filter((m) => m !== id);
  }

  /** Out of its squad and back to where it came from. */
  private sendHome(u: Unit): void {
    this.leaveSquad(u.id);
    const home = this.homes.has(u.id) ? this.homes.get(u.id) : this.homeOf(u);
    this.homes.delete(u.id);
    this.goHome(u, home);
  }

  /** Whether a kind does anything by itself (its stance is not OFF): the old AUTO switch, read. */
  get auto(): Record<UnitKind, boolean> {
    const out = {} as Record<UnitKind, boolean>;
    for (const k of Object.keys(this.stance) as UnitKind[]) out[k] = this.stance[k] !== 'off';
    return out;
  }

  /** The old AUTO switch: on gives the kind its usual stance (DEFEND for one that has none), off is OFF. */
  setAuto(who: UnitKind, on: boolean): void {
    this.setStance(who, on ? (STANCE_DEFAULT[who] === 'off' ? 'defend' : STANCE_DEFAULT[who]) : 'off');
  }

  setStance(who: UnitKind, stance: Stance): void {
    this.stance[who] = stance;
    // A unit out with its old stance's squad goes home; the next pass gives it the new one's work.
    for (const u of unitsOf(this.s, who)) if (this.squadOf(u.id)) this.sendHome(u);
  }

  /** Back to its own post (a Pit warrior's is its rally point: home undefined). */
  private goHome(u: Unit, home: Vec | undefined): void {
    const list = this.ordersOf(u);
    list.length = 0;
    if (home) {
      this.route(u, kindOf(this.s, u), home, list);
      list.push({ kind: 'move', to: home });
    } else if (!('mode' in u)) {
      (u as { guard?: Vec }).guard = undefined;
    }
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
      this.goHome(u, so.home);
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
        // The player's own move or hold is his: a hurt unit he parked stays parked (a squad's own are not his).
        const inSquad = !!this.squadOf(u.id);
        if (!inSquad && cur && (cur.kind === 'hold' || (cur.kind === 'move' && !this.sorties.has(u.id)))) continue;
        const safe = s.nearestCreepStreet(u.pos);
        if (!safe) continue;
        // Healed, a squad member comes back free (its squad takes it in again at the next forming-up).
        if (inSquad) this.leaveSquad(u.id);
        this.retreats.set(u.id, { orders: inSquad ? [] : [...list], guard: (u as { guard?: Vec }).guard ? { ...(u as { guard?: Vec }).guard! } : undefined });
        this.sorties.delete(u.id);
        list.length = 0;
        list.push({ kind: 'move', to: safe });
      }
    }
    // Idle Pit warriors answer a leak at the body.
    const leak = s.enemies.find((e) => !e.burrowed && !s.isAirborne(e) && Math.hypot(e.pos.x - s.core.x, e.pos.y - s.core.y) < B.leakRadius);
    if (leak) {
      for (const b of s.broodlings) {
        if (b.puppet || b.motherUnit !== undefined || (b.orders && b.orders.length) || this.sorties.has(b.id) || this.retreats.has(b.id) || this.squadOf(b.id)) continue;
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
    // The squads, four times a second.
    this.squadClock -= dt;
    if (this.squadClock <= 0) {
      this.squadClock = 0.25;
      this.squadsStep(0.25);
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
    this.cover = null; // read afresh at the next squad step
  }

  /** Your cover: every street cell inside your limbs' fire or on your creep. */
  private coverCells(): number[] {
    const s = this.s;
    const out: number[] = [];
    for (let c = 0; c < s.map.cells.length; c++) {
      if (!isPassable(s.map.cells[c])) continue;
      if (s.isCreeped(c) || s.dangerAt(c) > 0) out.push(c);
    }
    return out;
  }

  /** The cover cell nearest a point, and how far it is (px). */
  private nearestCover(cover: number[], p: Vec): { cell: number; d: number } {
    const s = this.s;
    let best = -1;
    let bd = Infinity;
    for (const c of cover) {
      const q = s.cellCenter(c);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    return { cell: best, d: bd };
  }

  /** Where an alert's quarry is now (the enemy itself, or the outpost's door), or null once it is gone. */
  private quarryAt(t: { kind: AlertKind; targetId: number }): Vec | null {
    const s = this.s;
    if (t.kind === 'outpost') {
      const al = this.alerts.find((x) => x.kind === 'outpost' && x.targetId === t.targetId);
      return al ? al.at : null;
    }
    const e = s.enemies.find((x) => x.id === t.targetId && !x.burrowed);
    if (e) return e.pos;
    // A science party keeps its alert when its lead dies: follow the alert.
    const al = this.alerts.find((x) => x.kind === t.kind && x.targetId === t.targetId);
    return al && t.kind === 'science' ? al.at : null;
  }

  /** Give an order unless the unit already has it (so a squad does not re-route every step). */
  private setOrder(u: Unit, o: UnitOrder): void {
    const list = this.ordersOf(u);
    const cur = list[list.length - 1];
    if (list.some((x) => x.kind === 'move' && x.enter)) return; // on its way into the tunnel
    if (cur && cur.kind === o.kind && (o.kind === 'hold' || ('to' in cur && 'to' in o && Math.hypot(cur.to.x - o.to.x, cur.to.y - o.to.y) < 8))) return;
    list.length = 0;
    if (o.kind !== 'hold' && 'to' in o) this.route(u, kindOf(this.s, u), o.to, list);
    list.push(o);
  }

  /** A spot round a point for the i-th of n (the spiral the group orders use), on a street. */
  private spot(at: Vec, i: number, n: number): Vec {
    const a = i * 2.399;
    const r = n > 1 ? 6 + 3 * Math.sqrt(i) : 0;
    return this.s.standableAt({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r }) ?? at;
  }

  /**
   * Every squad, four times a second. Who is in it: every unit on its stance not on the player's orders, a sortie, a
   * retreat or in the tunnel. Its ONE target: kept while it is still in reach, else the alert in reach nearest the squad.
   */
  private squadsStep(dt: number): void {
    const s = this.s;
    const stances = (['defend', 'hunt', 'raid'] as Stance[]).filter((st) => this.squads.has(st) || STANCE_KINDS.some((k) => this.stance[k] === st && unitsOf(s, k).length));
    if (!stances.length) return;
    this.cover ??= this.coverCells();
    const cover = this.cover;
    for (const st of stances) {
      const sq: Squad = this.squads.get(st) ?? { members: [], phase: 'gather', clock: 0 };
      this.squads.set(st, sq);
      sq.clock += dt;
      const free = (id: number): boolean => !this.retreats.has(id) && !this.sorties.has(id) && !this.inTunnel(id);
      sq.members = sq.members.filter((id) => { const u = s.unitById(id); return !!u && this.stance[kindOf(s, u)] === st && free(id); });
      const pool: Unit[] = [];
      for (const k of STANCE_KINDS) {
        if (this.stance[k] !== st) continue;
        for (const u of unitsOf(s, k)) if (free(u.id) && !this.ordersOf(u).length && !this.squadOf(u.id)) pool.push(u);
      }
      const units = (): Unit[] => sq.members.map((id) => s.unitById(id)).filter((u): u is Unit => !!u);
      // Who joins: everyone free, except while the squad is out on a target (then they wait at home for the next forming-up).
      const join = (): void => {
        for (const u of pool) {
          if (sq.members.includes(u.id)) continue;
          sq.members.push(u.id);
          if (!this.homes.has(u.id)) this.homes.set(u.id, this.homeOf(u));
        }
      };
      if (sq.phase !== 'go') join();
      const all = sq.members.length ? units() : pool;
      if (!all.length) { this.squads.delete(st); continue; }
      const reach = Math.min(...all.map((u) => strikeOf(kindOf(s, u))));
      const centre = (list: Unit[]): Vec => ({ x: list.reduce((a, u) => a + u.pos.x, 0) / list.length, y: list.reduce((a, u) => a + u.pos.y, 0) / list.length });
      const C = centre(all);
      const kinds = new Set(all.map((u) => kindOf(s, u)));
      const wanted = this.alerts.filter((al) => STANCE_ANSWERS[st].includes(al.kind) && al.who.some((k) => kinds.has(k)));
      const inReachAt = (kind: AlertKind, p: Vec, slack: number): boolean => st === 'raid' || kind === 'outpost' || this.nearestCover(cover, p).d <= reach + slack;
      // The target: kept while it lives and is in reach (a little slack once it is out on it), else the nearest in reach.
      let P = sq.target ? this.quarryAt(sq.target) : null;
      if (!P || !sq.target || !inReachAt(sq.target.kind, P, sq.phase === 'go' ? 40 : 0)) {
        const was = sq.target;
        sq.target = undefined;
        P = null;
        let bd = Infinity;
        for (const al of wanted) {
          if (!inReachAt(al.kind, al.at, 0)) continue;
          const d = Math.hypot(al.at.x - C.x, al.at.y - C.y);
          if (d < bd) { bd = d; sq.target = { kind: al.kind, targetId: al.targetId }; P = al.at; }
        }
        if (sq.target && (!was || was.targetId !== sq.target.targetId)) {
          // A new target: form up again (a waiting HUNT squad forms up where it waits).
          if (sq.phase !== 'wait') sq.at = undefined;
          sq.phase = 'gather';
          sq.clock = 0;
          const al = wanted.find((x) => x.targetId === sq.target!.targetId && x.kind === sq.target!.kind);
          if (al) al.answered = true;
        }
      }
      if (sq.target && P) {
        if (sq.phase !== 'go') join();
        const members = units();
        if (!members.length) continue;
        const M = centre(members);
        const spread = Math.max(...members.map((u) => Math.hypot(u.pos.x - M.x, u.pos.y - M.y)));
        const onIt = Math.hypot(M.x - P.x, M.y - P.y) <= Math.max(reach, 60) + 60;
        if (sq.phase !== 'go') {
          // Together already, or the quarry is on top of them, or they have waited long enough: go.
          if (spread <= 80 || onIt || sq.clock > 12) {
            if (sq.clock > 12 && sq.at) {
              // Stragglers still far off go home; the rest go.
              for (const u of members) if (Math.hypot(u.pos.x - sq.at.x, u.pos.y - sq.at.y) > 160) this.sendHome(u);
            }
            sq.phase = 'go';
            sq.clock = 0;
          } else {
            // Form up at the one nearest the target (or where a HUNT squad was waiting).
            if (!sq.at) {
              let front = members[0];
              for (const u of members) if (Math.hypot(u.pos.x - P.x, u.pos.y - P.y) < Math.hypot(front.pos.x - P.x, front.pos.y - P.y)) front = u;
              sq.at = s.standableAt(front.pos) ?? { ...front.pos };
            }
            members.forEach((u, i) => this.setOrder(u, { kind: 'attack', to: this.spot(sq.at!, i, members.length) }));
            continue;
          }
        }
        // Go, together: one out in front of the rest waits for them, unless it is already fighting.
        const goal = s.standableAt(P) ?? P;
        const G = centre(units());
        const dG = Math.hypot(G.x - P.x, G.y - P.y);
        for (const u of units()) {
          const fighting = s.enemies.some((e) => !e.burrowed && Math.hypot(e.pos.x - u.pos.x, e.pos.y - u.pos.y) < 90);
          const ahead = Math.hypot(u.pos.x - G.x, u.pos.y - G.y) > 70 && Math.hypot(u.pos.x - P.x, u.pos.y - P.y) < dG - 30;
          this.setOrder(u, !fighting && ahead && !onIt ? { kind: 'hold' } : { kind: 'attack', to: goal });
        }
        continue;
      }
      // No target in reach. HUNT: wait together in cover, nearest the closest science team.
      if (st === 'hunt' && wanted.length) {
        let team = wanted[0];
        for (const al of wanted) if (Math.hypot(al.at.x - C.x, al.at.y - C.y) < Math.hypot(team.at.x - C.x, team.at.y - C.y)) team = al;
        const n = this.nearestCover(cover, team.at);
        if (n.cell >= 0) {
          join();
          const at = s.cellCenter(n.cell);
          if (sq.phase !== 'wait' || !sq.at || Math.hypot(sq.at.x - at.x, sq.at.y - at.y) > 2 * s.cfg.cellPx) { sq.phase = 'wait'; sq.at = s.standableAt(at) ?? at; sq.clock = 0; }
          const members = units();
          members.forEach((u, i) => this.setOrder(u, { kind: 'attack', to: this.spot(sq.at!, i, members.length) }));
          continue;
        }
      }
      // Nothing to do: home, each to its own post.
      for (const u of units()) this.sendHome(u);
      this.squads.delete(st);
    }
    // A unit in a squad whose stance it no longer has goes home.
    for (const [st, sq] of this.squads) {
      for (const id of [...sq.members]) {
        const u = s.unitById(id);
        if (u && this.stance[kindOf(s, u)] !== st) this.sendHome(u);
      }
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
