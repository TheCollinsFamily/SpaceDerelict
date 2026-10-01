/**
 * The gameplay gaps closed on Sep 30 2026 (notes/GAPS-2026-09-30.md): royal decrees (the royal
 * special-upgrade sinks), surgery under fire, burrowing through a wall the body sealed itself behind.
 */
import { describe, expect, it } from 'vitest';
import { Autoplayer } from '../src/sim/autoplayer';
import { DT, Sim, towerSpec } from '../src/sim/sim';
import { CellType, isPassable, legalDrafts } from '../src/sim/citymap';
import { BALANCE as B } from '../content/data';
import { DECREES, ROYAL } from '../content/royal';
import type { SimConfig, Tower, TowerFamily } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234 };

function fresh(extra: Partial<SimConfig> = {}): Sim {
  const s = new Sim({ ...CFG, ...extra });
  s.meat.war = 999;
  s.meat.science = 999;
  return s;
}

/** Grow a limb of this family on the n-th cell it fits (a card of it is put in hand first). */
function limb(s: Sim, family: TowerFamily, skip = 0): Tower {
  let n = 0;
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!s.canBuildTower(c, family)) continue;
    if (n++ < skip) continue;
    s.hand.unshift({ id: 90000 + c, family });
    const r = s.issue({ kind: 'build', cardIndex: 0, cell: c });
    if (!r.ok) throw new Error(`build ${family}: ${r.err}`);
    return s.towers[s.towers.length - 1];
  }
  throw new Error(`no ground for ${family}`);
}

/** Two limbs of a family standing within `near` px of each other (and a third far away when asked). */
function pair(s: Sim, family: TowerFamily, near: number): [Tower, Tower] {
  const a = limb(s, family);
  for (let k = 0; k < 400; k++) {
    let t: Tower;
    try { t = limb(s, family, k); } catch { break; }
    if (Math.hypot(t.pos.x - a.pos.x, t.pos.y - a.pos.y) <= near) return [a, t];
    s.issue({ kind: 'butcher', towerId: t.id });
    s.pendingPips = [];
  }
  throw new Error('no pair');
}

describe('royal decrees (content/royal.ts): what royal points buy', () => {
  it('every decree costs royal points, refuses when short, and is counted', () => {
    const s = fresh();
    s.meat.royal = 0;
    expect(s.issue({ kind: 'decree', decree: 'heart' }).ok).toBe(false);
    s.meat.royal = 1;
    expect(s.issue({ kind: 'decree', decree: 'heart' }).ok).toBe(true);
    expect(s.meat.royal).toBe(0);
    expect(s.decrees.heart).toBe(1);
    expect(s.stats.decrees?.heart).toBe(1);
    expect(s.takeEvents().some((e) => e.kind === 'royal-decree' && e.decree === 'heart')).toBe(true);
  });

  it("Queen's Heart: +300 max hp and 300 healed, again for a second copy", () => {
    const s = fresh();
    s.meat.royal = 2;
    s.coreHp = 500;
    s.issue({ kind: 'decree', decree: 'heart' });
    expect(s.coreMaxHp).toBe(B.coreHp + ROYAL.heartHp);
    expect(s.coreHp).toBe(800);
    s.issue({ kind: 'decree', decree: 'heart' });
    expect(s.coreMaxHp).toBe(B.coreHp + 2 * ROYAL.heartHp);
    expect(s.coreHp).toBe(1100);
  });

  it('Royal Retinue: one more card kept in the hand; the next one costs a point more', () => {
    const s = fresh();
    s.meat.royal = 10;
    const n = s.hand.length;
    expect(s.decreeCost('retinue')).toBe(2);
    s.issue({ kind: 'decree', decree: 'retinue' });
    expect(s.hand.length).toBe(n + 1);
    expect(s.decreeCost('retinue')).toBe(3);
    s.issue({ kind: 'decree', decree: 'retinue' });
    expect(s.hand.length).toBe(n + 2);
    // A build replaces its card: the hand keeps its new size.
    const cell = s.map.cells.findIndex((_, c) => s.canBuildTower(c, s.hand[0].family));
    if (cell >= 0) {
      s.issue({ kind: 'build', cardIndex: 0, cell });
      expect(s.hand.length).toBe(n + 2);
    }
  });

  it('Royal Commission: a FREE card of a limb your organs unlock; never a locked one or a seedling', () => {
    const s = fresh({ organStage: true });
    s.meat.royal = 10;
    expect(s.issue({ kind: 'decree', decree: 'commission', family: 'impaler' }).ok).toBe(false); // no bone forge
    expect(s.issue({ kind: 'decree', decree: 'commission', family: 'sprout' }).ok).toBe(false);
    expect(s.meat.royal).toBe(10);
    expect(s.issue({ kind: 'decree', decree: 'commission', family: 'spitter' }).ok).toBe(true);
    const card = s.hand[s.hand.length - 1];
    expect(card.family).toBe('spitter');
    expect(card.free).toBe(true);
    expect(s.decreeCost('commission')).toBe(2);
  });

  it('Crown a Limb: every OTHER limb near it takes 30% less harm and hits 25% harder; crowns add', () => {
    const s = fresh();
    s.meat.royal = 5;
    const [a, b] = pair(s, 'spitter', ROYAL.crownRadius);
    const dmg0 = s.statsOf(b).damage;
    const own0 = s.statsOf(a).damage;
    expect(s.issue({ kind: 'decree', decree: 'crown' }).ok).toBe(false); // on a limb only
    expect(s.issue({ kind: 'decree', decree: 'crown', towerId: a.id }).ok).toBe(true);
    expect(s.statsOf(b).damage).toBeCloseTo(dmg0 * 1.25, 5);
    expect(s.statsOf(a).damage).toBeCloseTo(own0, 5); // not itself
    const hp = b.hp;
    s.hurtTower(b, 100);
    expect(hp - b.hp).toBeCloseTo(70, 5);
    s.issue({ kind: 'decree', decree: 'crown', towerId: a.id });
    expect(a.crowns).toBe(2);
    expect(s.statsOf(b).damage).toBeCloseTo(dmg0 * 1.5, 5);
    expect(s.harmMultOf(b)).toBeCloseTo(0.49, 5);
  });

  it("Royal Larder: half of the unspent war and science is kept at the wave's start (¾ with two)", () => {
    const keptWith = (larders: number) => {
      const s = fresh({ organStage: true });
      s.meat.royal = 10;
      for (let k = 0; k < larders; k++) s.issue({ kind: 'decree', decree: 'larder' });
      (s as unknown as { waveNumber: number }).waveNumber = 1;
      (s as unknown as { phaseElapsed: number }).phaseElapsed = 999; // no call-early bonus
      s.meat.war = 100;
      s.meat.science = 40;
      s.issue({ kind: 'call-early' });
      return [s.meat.war, s.meat.science];
    };
    expect(keptWith(0)).toEqual([0, 0]);
    expect(keptWith(1)).toEqual([50, 20]);
    expect(keptWith(2)).toEqual([75, 30]);
  });

  it("Consort's Favour: the wave's best killer is promoted (a pip of its own family); two favours, two limbs", () => {
    const s = fresh();
    s.meat.royal = 10;
    const a = limb(s, 'spitter');
    const b = limb(s, 'lasher');
    const c = limb(s, 'spitter', 3);
    for (const t of [a, b, c]) t.waveKillsAt = 0;
    a.kills = 5; b.kills = 9; c.kills = 1;
    const promote = () => (s as unknown as { promoteFavoured(): void }).promoteFavoured();
    promote();
    expect(b.pips.length).toBe(0); // no favour bought: nothing
    s.issue({ kind: 'decree', decree: 'favour' });
    promote();
    expect(b.pips).toEqual([{ family: 'lasher' }]);
    expect(a.pips.length).toBe(0);
    s.issue({ kind: 'decree', decree: 'favour' });
    promote();
    expect(b.pips.length).toBe(2);
    expect(a.pips).toEqual([{ family: 'spitter' }]);
    expect(c.pips.length).toBe(0);
  });

  it('the doubling rule: every decree lists what a second copy does, and it does something', () => {
    for (const d of DECREES) expect(d.again.length).toBeGreaterThan(10);
  });
});

describe('surgery under fire: grafting mid-siege is a risk, between waves it is not', () => {
  function surgery(siege: boolean) {
    const s = fresh();
    const donor = limb(s, 'burster');
    s.issue({ kind: 'butcher', towerId: donor.id });
    if (siege) (s as unknown as { phase: string }).phase = 'siege';
    const t = limb(s, 'spitter');
    return { s, t };
  }

  it('between waves the graft takes at once', () => {
    const { t } = surgery(false);
    expect(t.graftUntil).toBeUndefined();
    expect(t.pips).toEqual([{ family: 'burster' }]); // what it ate
  });

  it('mid-siege the new limb grafts: holds fire, bleeds double, then the graft takes', () => {
    const { s, t } = surgery(true);
    const secs = B.graftSeconds + B.graftPerPip * 1;
    expect(t.graftUntil).toBeCloseTo(s.time + secs, 5);
    expect(s.stats.surgeriesUnderFire).toBe(1);
    expect(s.takeEvents().some((e) => e.kind === 'surgery-under-fire')).toBe(true);
    expect(s.harmMultOf(t)).toBe(B.graftHarm);
    // A body standing in its reach: it does not shoot while grafting.
    const spec = towerSpec('spitter');
    s.enemies.push({
      id: 77777, kind: 'militia', pos: { x: t.pos.x + spec.range * 0.5, y: t.pos.y }, hp: 9999, maxHp: 9999,
      speed: 0, targetId: null, attackCooldown: 99, armor: 0,
    } as unknown as (typeof s.enemies)[number]);
    t.cooldown = 0;
    const tick = () => (s as unknown as { updateTowers(): void }).updateTowers();
    tick();
    expect(s.projectiles.length).toBe(0);
    // The climbers smell the wound.
    expect((s as unknown as { woundNear(p: { x: number; y: number }, r: number): { id: number } | null }).woundNear(t.pos, B.graftScent)?.id).toBe(t.id);
    s.time += secs + 0.1;
    tick();
    expect(t.graftUntil).toBeUndefined();
    expect(s.takeEvents().some((e) => e.kind === 'graft-took')).toBe(true);
    expect(s.harmMultOf(t)).toBe(1);
    expect(s.projectiles.length + s.arcs.length).toBeGreaterThan(0);
  });

  it('a limb built with nothing eaten never grafts, siege or not', () => {
    const s = fresh();
    (s as unknown as { phase: string }).phase = 'siege';
    const t = limb(s, 'spitter');
    expect(t.graftUntil).toBeUndefined();
  });
});

describe('burrowing: the body digs back out of a wall it sealed itself behind', () => {
  function closedEdge(s: Sim) {
    const W = s.cfg.gridW;
    const slot = s.map.slots.findIndex((x, i) => x && s.map.coreCell >= 0 && Math.floor(i / s.map.slotsX) === Math.floor(Math.floor(s.map.coreCell / W) / 10) && i % s.map.slotsX === Math.floor((s.map.coreCell % W) / 10));
    const inst = s.map.slots[slot]!;
    const edges = (['n', 's', 'e', 'w'] as const).filter((e) => !inst.pattern.ports[e]);
    const ox = (slot % s.map.slotsX) * 10;
    const oy = Math.floor(slot / s.map.slotsX) * 10;
    for (const e of edges) {
      const smoke = e === 'n' ? (oy - 1) * W + ox + 4 : e === 's' ? (oy + 10) * W + ox + 4 : e === 'w' ? (oy + 4) * W + ox - 1 : (oy + 4) * W + ox + 10;
      if (s.map.cells[smoke] === CellType.Void) return { slot, edge: e, smoke };
    }
    throw new Error('no closed edge facing the smoke');
  }

  it('hovering the smoke in front of a closed wall finds the wall; digging opens a gate that reaches the core', () => {
    const s = fresh();
    const { slot, edge, smoke } = closedEdge(s);
    const site = s.burrowSiteAt(smoke)!;
    expect(site).not.toBeNull();
    expect(site.slot).toBe(slot);
    expect(site.edge).toBe(edge);
    expect(site.blocked).toBe(false);
    const gates = s.gates.length;
    const war = s.meat.war;
    expect(s.issue({ kind: 'burrow', cell: smoke }).ok).toBe(true);
    expect(s.meat.war).toBe(war - B.burrowCost);
    expect(s.gates.length).toBe(gates + 1);
    for (const c of site.carve) expect(isPassable(s.map.cells[c])).toBe(true);
    expect(s.map.slots[slot]!.pattern.ports[edge]).toBe(true);
    const gate = s.gates.find((g) => site.mouth.includes(g))!;
    expect(Number.isFinite(s.flowDistOf(gate))).toBe(true);
    expect(s.takeEvents().some((e) => e.kind === 'burrowed')).toBe(true);
    expect(s.burrowSiteAt(smoke)).toBeNull(); // that wall is open now
  });

  it('refused mid-siege, without the meat, or through a limb', () => {
    const s = fresh();
    const { smoke } = closedEdge(s);
    (s as unknown as { phase: string }).phase = 'siege';
    expect(s.issue({ kind: 'burrow', cell: smoke }).ok).toBe(false);
    (s as unknown as { phase: string }).phase = 'growth';
    s.meat.war = B.burrowCost - 1;
    expect(s.issue({ kind: 'burrow', cell: smoke }).ok).toBe(false);
    expect(s.issue({ kind: 'burrow', cell: 0 }).ok).toBe(false); // nothing of yours near the board's corner
  });

  it('a body the scripted player walled in can draft again after one burrow', () => {
    // The first seed whose scripted run walls itself in (seed 3 did until the districts of Oct 1 2026).
    let s!: Sim;
    let sealed = false;
    for (let seed = 1; seed <= 20 && !sealed; seed++) {
      s = new Sim({ ...CFG, seed, directive: { kind: 'hold', waves: 12 }, organStage: true });
      const bot = new Autoplayer(seed + 1);
      for (let t = 0; t < 24000 && s.outcome === 'playing' && !sealed; t++) {
        bot.act(s, DT);
        s.tick();
        sealed = s.takeEvents().some((e) => e.kind === 'sealed-in');
      }
    }
    expect(sealed).toBe(true);
    expect(s.sealedIn()).toBe(true);
    // Find any wall of the body that faces the smoke, and dig.
    (s as unknown as { phase: string }).phase = 'growth';
    s.meat.war = 999;
    const cell = s.map.cells.findIndex((c, i) => c === CellType.Void && (s.burrowSiteAt(i)?.blocked === false));
    expect(cell).toBeGreaterThanOrEqual(0);
    expect(s.issue({ kind: 'burrow', cell }).ok).toBe(true);
    expect(s.sealedIn()).toBe(false);
    expect(legalDrafts(s.map).length).toBeGreaterThan(0);
  }, 600_000);
});

describe('smaller gaps closed the same day', () => {
  it("faction asides: every one heard before any repeats, a seeded order, never twice in a row", async () => {
    const { asideIndex } = await import('../src/meta/campaign');
    const len = 7;
    const seen = Array.from({ length: 3 * len }, (_, n) => asideIndex(42, 'institute', n, len));
    for (let r = 0; r < 3; r++) expect(new Set(seen.slice(r * len, (r + 1) * len)).size).toBe(len);
    for (let n = 1; n < seen.length; n++) expect(seen[n]).not.toBe(seen[n - 1]);
    expect(seen.slice(0, len)).not.toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(asideIndex(42, 'institute', 3, len)).toBe(seen[3]); // deterministic
    const other = Array.from({ length: len }, (_, n) => asideIndex(43, 'institute', n, len));
    expect(other).not.toEqual(seen.slice(0, len));
  });

  it('a creep lance strip carries the verbs the lance has eaten (an ember pip sets it burning)', () => {
    const s = fresh();
    const lance = limb(s, 'lance');
    lance.pips = [{ family: 'ember' }];
    s.time += 30; // the strip has grown
    const strip = s.creepSources.find((c) => c.kind === 'line' && c.ownerId === lance.id)!;
    const on = s.map.cells.findIndex((_, c) => (s as unknown as { lineCovers(x: typeof strip, c: number): boolean }).lineCovers(strip, c) && !s.cellsOf(lance).includes(c));
    expect(on).toBeGreaterThanOrEqual(0);
    const at = s.cellCenter(on);
    s.enemies.push({ id: 5555, kind: 'militia', pos: { ...at }, hp: 500, maxHp: 500, speed: 0, targetId: null, attackCooldown: 99 } as unknown as (typeof s.enemies)[number]);
    lance.cooldown = 0;
    (s as unknown as { updateTowers(): void }).updateTowers();
    const e = s.enemies.find((x) => x.id === 5555)!;
    expect((e as unknown as { burnDps?: number }).burnDps ?? 0).toBeGreaterThan(0);
  });

  it("a broodling's bite does not break a pacifist wave (DESIGN: brood, swamps and creep only)", () => {
    const s = fresh();
    const mother = limb(s, 'brood');
    const e = { id: 6666, kind: 'militia', pos: { ...mother.pos }, hp: 500, maxHp: 500, speed: 0, targetId: null, attackCooldown: 99 } as unknown as (typeof s.enemies)[number];
    s.enemies.push(e);
    s.payloadHit({ srcId: mother.id, quiet: true, damage: 10, yieldMult: 1, capBonus: 0, slowMult: 1, slowDur: 0, poisonDps: 0, poisonDur: 0, burnDps: 0, burnDur: 0, shred: 0, shredDur: 0, chains: 0, knock: 0, execute: 0, cloud: 0, caltrop: 0, supportDmg: 0 } as never, e, 10);
    expect((s as unknown as { waveLimbDamage: number }).waveLimbDamage).toBe(0);
    s.payloadHit({ srcId: mother.id, damage: 10, yieldMult: 1, capBonus: 0, slowMult: 1, slowDur: 0, poisonDps: 0, poisonDur: 0, burnDps: 0, burnDur: 0, shred: 0, shredDur: 0, chains: 0, knock: 0, execute: 0, cloud: 0, caltrop: 0, supportDmg: 0 } as never, e, 10);
    expect((s as unknown as { waveLimbDamage: number }).waveLimbDamage).toBeGreaterThan(0);
  });

  it('a long limb that aims turns a quarter turn by lying the other way on its roof (or refuses)', () => {
    const s = fresh();
    const t = limb(s, 'skipper');
    const before = s.cellsOf(t);
    expect(before.length).toBe(2);
    const quarter = (t.facing === 'N' || t.facing === 'S') ? 'E' : 'N';
    const r = s.issue({ kind: 'set-facing', towerId: t.id, dir: quarter });
    const [w, h] = s.spanOf('skipper', t.facing);
    if (r.ok) {
      expect(t.facing).toBe(quarter);
      const cells = s.cellsOf(t);
      const W = s.cfg.gridW;
      const xs = new Set(cells.map((c) => c % W)).size;
      const ys = new Set(cells.map((c) => Math.floor(c / W))).size;
      expect([xs, ys]).toEqual([w, h]);
      for (const c of cells) expect(s.isOccupied(c)).toBe(true);
      for (const c of before) if (!cells.includes(c)) expect(s.isOccupied(c)).toBe(false);
    } else {
      expect(s.cellsOf(t)).toEqual(before); // refused: nothing moved
    }
  });

  it('the trap cage is capped under its own name on the globe, not the meteor\'s', () => {
    const s = new Sim({ ...CFG, evolutionCap: { core: 1, cage: 3 } });
    expect(s.evolutionCapOf('cage')).toBe(3);
    expect(s.evolutionCapOf('spitter')).toBe(1);
  });
});
