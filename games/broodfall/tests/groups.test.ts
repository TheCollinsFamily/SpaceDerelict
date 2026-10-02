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
    s.groups.auto.warrior = false;
    s.groups.auto.harrier = false;
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

  it('AUTO: a kind set to answer alerts goes by itself; off, it waits', () => {
    const on = withWarriors();
    expect(on.groups.auto.warrior).toBe(true); // warriors answer by default
    const e = (on as unknown as Spawner).spawnEnemy('engineer');
    e.pos = streetAway(on, on.bodyPoint(), 200);
    for (let i = 0; i < 15; i++) { on.tick(); on.takeEvents(); }
    expect(on.groups.sorties.size).toBe(3);

    const off = withWarriors();
    expect(off.issue({ kind: 'set-auto', who: 'warrior', on: false }).ok).toBe(true);
    const e2 = (off as unknown as Spawner).spawnEnemy('engineer');
    e2.pos = streetAway(off, off.bodyPoint(), 200);
    for (let i = 0; i < 15; i++) { off.tick(); off.takeEvents(); }
    expect(off.groups.sorties.size).toBe(0);
  });
});

describe('jobs no one has to order', () => {
  it('idle Brood Pit warriors answer a leak at the body', () => {
    const s = withWarriors();
    s.groups.auto.warrior = false; // the leak answer is not the alert's AUTO
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
