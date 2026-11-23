/**
 * LOW-MICRO UNIT COMMAND (Collins, Oct 2 2026: "keeping RTS very, very low ... an image of every unit type ... and an
 * ALL UNITS button ... click one of these, then click a location, and all units of that type (or all units) go there
 * or fight the thing you clicked (they also know how to use the tunnel)"). src/sim/groups.ts.
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { isPassable } from '../src/sim/citymap';
import { BALANCE as B } from '../content/data';
import { chooseRoute, unitsOf, type TunnelLink } from '../src/sim/groups';
import type { Enemy, SimConfig, Tower, TowerFamily, UnitOrder, Vec } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4242 };
type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };

function hush(s: Sim): void {
  (s as unknown as { enemies: Enemy[] }).enemies.length = 0;
}
function run(s: Sim, seconds: number, quiet = true): void {
  for (let i = 0; i < seconds * 10; i++) { s.tick(); if (quiet) hush(s); s.takeEvents(); }
}
function build(s: Sim, family: TowerFamily): Tower {
  s.meat.war = 9999;
  s.meat.science = 9999;
  let idx = -1;
  for (let guard = 0; guard < 600 && idx < 0; guard++) {
    idx = s.hand.findIndex((c) => c.family === family);
    if (idx < 0) s.issue({ kind: 'discard', cardIndex: 0 });
  }
  let cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, family));
  for (let i = 0; i < 1200 && cell < 0; i++) { s.tick(); hush(s); if (i % 20 === 0) cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, family)); }
  idx = s.hand.findIndex((c) => c.family === family);
  expect(s.issue({ kind: 'build', cardIndex: idx, cell }).ok).toBe(true);
  return s.towers[s.towers.length - 1];
}
/** A sim with a Brood Pit and its three warriors standing at their post. */
function withWarriors(seed = 4242): Sim {
  const s = new Sim({ ...CFG, seed });
  build(s, 'hatch');
  for (let i = 0; i < 400 && unitsOf(s, 'warrior').length < 3; i++) { s.tick(); hush(s); }
  expect(unitsOf(s, 'warrior').length).toBe(3);
  run(s, 6);
  return s;
}
function streetAway(s: Sim, from: Vec, far: number): Vec {
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!isPassable(s.map.cells[c])) continue;
    const p = s.cellCenter(c);
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d >= far && d <= far + 60) return p;
  }
  throw new Error('no street that far');
}
const last = (o: UnitOrder[] | undefined): UnitOrder | undefined => (o && o.length ? o[o.length - 1] : undefined);

describe('the roster: unit kinds and group orders', () => {
  it('counts every kind you have; ALL is the fighters only (no mules, no Infestors)', () => {
    const s = withWarriors();
    expect(unitsOf(s, 'warrior')).toHaveLength(3);
    expect(unitsOf(s, 'all')).toHaveLength(3);
    expect(unitsOf(s, 'mule')).toHaveLength(0);
  });

  it('a click on the ground: all of the kind go there fighting what they meet, and stay', () => {
    const s = withWarriors();
    const to = streetAway(s, s.bodyPoint(), 160);
    expect(s.issue({ kind: 'group-order', who: 'warrior', at: to }).ok).toBe(true);
    for (const w of unitsOf(s, 'warrior')) expect(last((w as { orders?: UnitOrder[] }).orders)?.kind).toBe('attack');
    run(s, 25);
    for (const w of unitsOf(s, 'warrior')) expect(Math.hypot(w.pos.x - to.x, w.pos.y - to.y)).toBeLessThan(40);
    run(s, 10);
    for (const w of unitsOf(s, 'warrior')) expect(Math.hypot(w.pos.x - to.x, w.pos.y - to.y)).toBeLessThan(40); // they stay
  });

  it('a click on an enemy: a sortie (they hunt it), and once the spot is quiet they come home', () => {
    const s = withWarriors();
    const posts = unitsOf(s, 'warrior').map((w) => ({ ...w.pos }));
    const e = (s as unknown as Spawner).spawnEnemy('militia');
    e.pos = streetAway(s, s.bodyPoint(), 150);
    const target = s.groups.targetAt(e.pos);
    expect(target.kind).toBe('enemy');
    expect(s.issue({ kind: 'group-order', who: 'all', at: e.pos }).ok).toBe(true);
    expect(s.groups.sorties.size).toBe(3);
    // The quarry dies; the spot goes quiet; home.
    (s as unknown as { enemies: Enemy[] }).enemies.length = 0;
    run(s, 40);
    expect(s.groups.sorties.size).toBe(0);
    unitsOf(s, 'warrior').forEach((w) => {
      const near = posts.some((p) => Math.hypot(w.pos.x - p.x, w.pos.y - p.y) < 50);
      expect(near).toBe(true);
    });
  });

  it('a click on the body: they come home', () => {
    const s = withWarriors();
    const to = streetAway(s, s.bodyPoint(), 160);
    s.issue({ kind: 'group-order', who: 'warrior', at: to });
    run(s, 20);
    expect(s.groups.targetAt(s.core).kind).toBe('body');
    s.issue({ kind: 'group-order', who: 'warrior', at: { ...s.core } });
    run(s, 25);
    const home = s.bodyPoint();
    for (const w of unitsOf(s, 'warrior')) expect(Math.hypot(w.pos.x - home.x, w.pos.y - home.y)).toBeLessThan(45);
  });

  it('an order with no unit of the kind is refused with a reason', () => {
    const s = new Sim({ ...CFG });
    const r = s.issue({ kind: 'group-order', who: 'harrier', at: s.bodyPoint() });
    expect(r.ok).toBe(false);
    expect(r.err).toBeTruthy();
  });

  it("a unit's own order (the old command panel) takes it off a sortie", () => {
    const s = withWarriors();
    const e = (s as unknown as Spawner).spawnEnemy('militia');
    e.pos = streetAway(s, s.bodyPoint(), 150);
    s.issue({ kind: 'group-order', who: 'warrior', at: e.pos });
    const w = unitsOf(s, 'warrior')[0];
    s.issue({ kind: 'unit-order', ids: [w.id], order: { kind: 'hold' } });
    expect(s.groups.sorties.has(w.id)).toBe(false);
  });
});

describe('routing through the tunnel', () => {
  it('chooses the tunnel when it is faster, either way, and walks when it is not', () => {
    const s = new Sim({ ...CFG });
    const body = s.cellAt(s.bodyPoint().x, s.bodyPoint().y);
    // A far street for the tunnel head, and a destination beside it.
    let head = -1;
    let bestSteps = 0;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (!isPassable(s.map.cells[c])) continue;
      const n = s.streetSteps(body, c);
      if (Number.isFinite(n) && n > bestSteps) { bestSteps = n; head = c; }
    }
    expect(bestSteps).toBeGreaterThan(12);
    const link: TunnelLink = { bodyCell: body, headCell: head, headOutpostId: 1 };
    expect(chooseRoute(s, body, head, link, B.broodSpeed)).toBe('toHead');
    expect(chooseRoute(s, head, body, link, B.broodSpeed)).toBe('toBody');
    // Next door to where it stands: walk.
    const near = s.map.cells.findIndex((t, c) => isPassable(t) && s.streetSteps(body, c) === 2);
    expect(chooseRoute(s, body, near, link, B.broodSpeed)).toBe('walk');
  });

  it("a group order puts the walk to the tunnel's mouth in front when the tunnel is faster, and goes in at the mouth", () => {
    const s = withWarriors();
    const body = s.cellAt(s.bodyPoint().x, s.bodyPoint().y);
    let head = -1;
    let bestSteps = 0;
    for (let c = 0; c < s.map.cells.length; c++) {
      if (!isPassable(s.map.cells[c])) continue;
      const n = s.streetSteps(body, c);
      if (Number.isFinite(n) && n > bestSteps) { bestSteps = n; head = c; }
    }
    const entered: Array<{ ids: number[]; toHead: boolean }> = [];
    const stub = s as unknown as { tunnelLink: () => TunnelLink; issue: Sim['issue'] };
    stub.tunnelLink = () => ({ bodyCell: body, headCell: head, headOutpostId: 1 });
    const realIssue = s.issue.bind(s);
    stub.issue = ((cmd: { kind: string; ids?: number[]; toHead?: boolean }) => {
      if (cmd.kind === 'tunnel') { entered.push({ ids: cmd.ids!, toHead: cmd.toHead! }); return { ok: true }; }
      return realIssue(cmd as never);
    }) as Sim['issue'];
    // Send them to the far end: they walk to the mouth first.
    s.issue({ kind: 'group-order', who: 'warrior', at: s.cellCenter(head) });
    for (const w of unitsOf(s, 'warrior')) {
      const o = (w as { orders?: UnitOrder[] }).orders!;
      expect(o[0].kind).toBe('move');
      expect((o[0] as { enter?: string }).enter).toBe('head');
      expect(o[o.length - 1].kind).toBe('attack');
    }
    run(s, 20);
    expect(entered.length).toBeGreaterThan(0);
    expect(entered.every((x) => x.toHead)).toBe(true);
  });
});

describe('alerts, SEND and AUTO', () => {
  it('an engineer raises an alert; SEND sends its responders as a sortie', () => {
    const s = withWarriors();
    s.groups.stance.warrior = 'off';
    s.groups.stance.harrier = 'off';
    const e = (s as unknown as Spawner).spawnEnemy('engineer');
    e.pos = streetAway(s, s.bodyPoint(), 200);
    for (let i = 0; i < 15; i++) { s.tick(); s.takeEvents(); }
    const al = s.groups.alerts.find((a) => a.kind === 'engineer');
    expect(al).toBeTruthy();
    expect(s.groups.sorties.size).toBe(0);
    expect(s.issue({ kind: 'answer-alert', alertId: al!.id }).ok).toBe(true);
    expect(s.groups.sorties.size).toBe(3);
    expect(s.groups.alerts.find((a) => a.id === al!.id)?.answered).toBe(true);
  });

  it('the old AUTO switch still works: off is the OFF stance, on gives the kind its usual stance', () => {
    const s = withWarriors();
    expect(s.groups.auto.warrior).toBe(true); // warriors answer by default (DEFEND)
    expect(s.issue({ kind: 'set-auto', who: 'warrior', on: false }).ok).toBe(true);
    expect(s.groups.stance.warrior).toBe('off');
    expect(s.issue({ kind: 'set-auto', who: 'warrior', on: true }).ok).toBe(true);
    expect(s.groups.stance.warrior).toBe('defend');
  });
});

/** Cover: a street in your limbs' fire or on your creep. */
function covered(s: Sim, c: number): boolean {
  return isPassable(s.map.cells[c]) && (s.isCreeped(c) || s.dangerAt(c) > 0);
}
/** A street at least `far` px from any cover. */
function outOfCover(s: Sim, far: number): Vec {
  const cover: Vec[] = [];
  for (let c = 0; c < s.map.cells.length; c++) if (covered(s, c)) cover.push(s.cellCenter(c));
  // Any point, off the claimed streets too: the start's city is small (43 streets, all within 170 px of the creep).
  for (let c = 0; c < s.map.cells.length; c++) {
    const p = s.cellCenter(c);
    if (cover.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= far)) return p;
  }
  throw new Error('no street that far out of cover');
}
/** A creeped street at least `far` px from the body (no leak answer there). */
function inCover(s: Sim, far: number): Vec {
  const b = s.bodyPoint();
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!covered(s, c)) continue;
    const p = s.cellCenter(c);
    if (Math.hypot(p.x - b.x, p.y - b.y) >= far) return p;
  }
  throw new Error('no cover that far');
}
function tickSome(s: Sim, n: number): void {
  for (let i = 0; i < n; i++) { s.tick(); s.takeEvents(); }
}

describe('STANCES (Collins, Nov 23 2026: defensive, hunter "which targets science teams while trying to stay in cover", offensive "that targets where bases are being set up")', () => {
  const sq = (s: Sim, st: 'defend' | 'hunt' | 'raid') => s.groups.squads.get(st);

  it('DEFEND answers what comes into cover and lets what is out of it be', () => {
    const s = withWarriors();
    expect(s.groups.stance.warrior).toBe('defend');
    const far = (s as unknown as Spawner).spawnEnemy('engineer');
    far.pos = outOfCover(s, 200);
    tickSome(s, 15);
    expect(sq(s, 'defend')?.target).toBeUndefined();
    const near = (s as unknown as Spawner).spawnEnemy('engineer');
    near.pos = inCover(s, 140);
    tickSome(s, 15);
    expect(sq(s, 'defend')?.target?.targetId).toBe(near.id);
    expect(sq(s, 'defend')?.members).toHaveLength(3);
  });

  it('DEFEND lets the quarry go once it is out of reach of cover', () => {
    const s = withWarriors();
    const e = (s as unknown as Spawner).spawnEnemy('engineer');
    e.pos = inCover(s, 140);
    tickSome(s, 15);
    expect(sq(s, 'defend')?.target?.targetId).toBe(e.id);
    e.pos = outOfCover(s, 200);
    tickSome(s, 15);
    expect(sq(s, 'defend')?.target).toBeUndefined();
  });

  it('RAID goes for an engineer setting up anywhere; OFF waits', () => {
    const raid = withWarriors();
    expect(raid.issue({ kind: 'set-stance', who: 'warrior', stance: 'raid' }).ok).toBe(true);
    const e = (raid as unknown as Spawner).spawnEnemy('engineer');
    e.pos = outOfCover(raid, 200);
    tickSome(raid, 15);
    expect(sq(raid, 'raid')?.target?.targetId).toBe(e.id);
    expect(sq(raid, 'raid')?.members).toHaveLength(3);

    const off = withWarriors();
    off.issue({ kind: 'set-stance', who: 'warrior', stance: 'off' });
    const e2 = (off as unknown as Spawner).spawnEnemy('engineer');
    e2.pos = inCover(off, 140);
    tickSome(off, 15);
    expect(off.groups.squads.size).toBe(0);
    expect(off.groups.sorties.size).toBe(0);
  });

  it('RAID leaves the science teams alone; HUNT leaves the engineers alone', () => {
    const raid = withWarriors();
    raid.issue({ kind: 'set-stance', who: 'warrior', stance: 'raid' });
    const r = (raid as unknown as Spawner).spawnEnemy('researcher');
    r.pos = inCover(raid, 140);
    tickSome(raid, 15);
    expect(sq(raid, 'raid')?.target).toBeUndefined();

    const hunt = withWarriors();
    hunt.issue({ kind: 'set-stance', who: 'warrior', stance: 'hunt' });
    const e = (hunt as unknown as Spawner).spawnEnemy('engineer');
    e.pos = inCover(hunt, 140);
    tickSome(hunt, 15);
    expect(sq(hunt, 'hunt')?.target).toBeUndefined();
  });

  it('HUNT waits together in cover nearest a science team out of reach, and strikes when it comes in reach', () => {
    const s = withWarriors();
    s.issue({ kind: 'set-stance', who: 'warrior', stance: 'hunt' });
    const r = (s as unknown as Spawner).spawnEnemy('researcher');
    r.pos = outOfCover(s, 200);
    tickSome(s, 15);
    const h = sq(s, 'hunt')!;
    expect(h.phase).toBe('wait');
    expect(h.members).toHaveLength(3);
    expect(covered(s, s.cellAt(h.at!.x, h.at!.y))).toBe(true);
    r.pos = inCover(s, 140);
    tickSome(s, 15);
    expect(sq(s, 'hunt')?.target?.targetId).toBe(r.id);
  });

  it('ONE target for the whole squad, never each unit to whatever is closest to it', () => {
    const s = withWarriors();
    s.issue({ kind: 'set-stance', who: 'warrior', stance: 'raid' });
    const ws = unitsOf(s, 'warrior');
    // Spread out, each nearer a different engineer.
    const a = (s as unknown as Spawner).spawnEnemy('engineer');
    const b = (s as unknown as Spawner).spawnEnemy('engineer');
    a.pos = outOfCover(s, 200);
    b.pos = { x: s.cfg.gridW * s.cfg.cellPx - a.pos.x, y: s.cfg.gridH * s.cfg.cellPx - a.pos.y };
    ws[0].pos = s.standableAt({ x: (a.pos.x + s.core.x) / 2, y: (a.pos.y + s.core.y) / 2 }) ?? ws[0].pos;
    ws[1].pos = s.standableAt({ x: (b.pos.x + s.core.x) / 2, y: (b.pos.y + s.core.y) / 2 }) ?? ws[1].pos;
    tickSome(s, 15);
    const r = sq(s, 'raid')!;
    expect(r.members).toHaveLength(3);
    expect([a.id, b.id]).toContain(r.target?.targetId);
    expect(s.groups.sorties.size).toBe(0); // nobody went off on its own
  });

  it('forms up before it goes: the one in front waits for the rest, and they go together', () => {
    const s = withWarriors();
    s.issue({ kind: 'set-stance', who: 'warrior', stance: 'raid' });
    const ws = unitsOf(s, 'warrior');
    const far = streetAway(s, ws[0].pos, 150);
    ws[1].pos = { ...far };
    ws[2].pos = { ...far };
    const e = (s as unknown as Spawner).spawnEnemy('engineer');
    e.pos = outOfCover(s, 250);
    e.hp = e.maxHp = 1e9; // it must stand while they form up
    for (let i = 0; i < 20 && !sq(s, 'raid')?.target; i++) tickSome(s, 1); // alerts are read once a second
    const r = sq(s, 'raid')!;
    expect(r.target?.targetId).toBe(e.id);
    expect(r.phase).toBe('gather');
    let spreadAtGo = Infinity;
    for (let i = 0; i < 200 && r.phase !== 'go'; i++) {
      tickSome(s, 1);
      if ((r.phase as string) === 'go') {
        const c = { x: ws.reduce((t, w) => t + w.pos.x, 0) / 3, y: ws.reduce((t, w) => t + w.pos.y, 0) / 3 };
        spreadAtGo = Math.max(...ws.map((w) => Math.hypot(w.pos.x - c.x, w.pos.y - c.y)));
      }
    }
    expect(r.phase).toBe('go');
    expect(spreadAtGo).toBeLessThanOrEqual(100);
  });

  it('a unit that comes free while the squad is out waits at home for the next forming-up', () => {
    const s = withWarriors();
    s.issue({ kind: 'set-stance', who: 'warrior', stance: 'raid' });
    const e = (s as unknown as Spawner).spawnEnemy('engineer');
    e.pos = outOfCover(s, 250);
    e.hp = e.maxHp = 1e9;
    for (let i = 0; i < 300 && sq(s, 'raid')?.phase !== 'go'; i++) tickSome(s, 1);
    expect(sq(s, 'raid')?.phase).toBe('go');
    // One drops out (as a newborn or a healed one comes free): it does not walk in alone.
    const late = unitsOf(s, 'warrior')[0] as { id: number; orders?: UnitOrder[] };
    s.groups.forget(late.id);
    late.orders = [];
    tickSome(s, 10);
    expect(sq(s, 'raid')?.members).not.toContain(late.id);
    expect(late.orders ?? []).toHaveLength(0);
  });

  it('the player\'s own order comes first: a unit he moved is not in the squad', () => {
    const s = withWarriors();
    s.issue({ kind: 'set-stance', who: 'warrior', stance: 'raid' });
    const ids = unitsOf(s, 'warrior').map((u) => u.id);
    s.issue({ kind: 'unit-order', ids: [ids[0]], order: { kind: 'hold' } });
    const e = (s as unknown as Spawner).spawnEnemy('engineer');
    e.pos = outOfCover(s, 200);
    tickSome(s, 15);
    expect(sq(s, 'raid')?.members).not.toContain(ids[0]);
    expect(sq(s, 'raid')?.members).toHaveLength(2);
  });
});

describe('jobs no one has to order', () => {
  it('idle Brood Pit warriors answer a leak at the body', () => {
    const s = withWarriors();
    s.groups.stance.warrior = 'off'; // the leak answer is not the alert's AUTO
    const e = (s as unknown as Spawner).spawnEnemy('militia');
    const p = s.bodyPoint();
    e.pos = { ...p };
    s.tick();
    expect([...s.groups.sorties.values()].some((x) => x.targetId === e.id)).toBe(true);
  });

  it('a hurt unit off the creep walks back onto it, heals, and goes back to what it was doing', () => {
    const s = withWarriors();
    const w = unitsOf(s, 'warrior')[0];
    // Off the creep, hurt.
    let off: Vec | null = null;
    for (let c = 0; c < s.map.cells.length && !off; c++) if (isPassable(s.map.cells[c]) && !s.isCreeped(c)) off = s.cellCenter(c);
    expect(off).not.toBeNull();
    if (!off) return;
    w.pos = { ...off };
    w.hp = w.maxHp * 0.2;
    s.tick();
    expect(s.groups.retreats.has(w.id)).toBe(true);
    run(s, 60);
    expect(s.groups.retreats.has(w.id)).toBe(false);
    expect(w.hp).toBeGreaterThanOrEqual(w.maxHp * B.unitRetreatHealed);
  });
});

describe('determinism', () => {
  it('the same group orders on the same seed give the same board', () => {
    const go = (): string => {
      const s = withWarriors(77);
      s.issue({ kind: 'group-order', who: 'all', at: streetAway(s, s.bodyPoint(), 140) });
      run(s, 15, false);
      return JSON.stringify(unitsOf(s, 'warrior').map((w) => [Math.round(w.pos.x * 100), Math.round(w.pos.y * 100), w.hp]));
    };
    expect(go()).toBe(go());
  });
});

describe('the shield dome alert (the dome fork: Aegis Deacon, Lens Bearer)', () => {
  it('a dome bearer within your limbs\' reach raises SHIELD DOME; warriors on AUTO answer it', () => {
    const s = withWarriors();
    const t = s.towers[0];
    // A real Aegis Deacon (the dome fork's code is on main): Sim.domeBearers lists it.
    const e = (s as unknown as Spawner).spawnEnemy('aegis');
    e.pos = s.nearestStreet(t.cell)!;
    for (let i = 0; i < 12; i++) { s.tick(); s.takeEvents(); }
    const al = s.groups.alerts.find((a) => a.kind === 'dome');
    expect(al).toBeTruthy();
    expect(al!.who).toContain('warrior');
    expect([...s.groups.sorties.values()].some((x) => x.targetId === e.id)).toBe(true);
  });
});
