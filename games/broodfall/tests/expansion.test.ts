/**
 * SHELTERS, THE INFESTOR AND THE HARRIER (Collins, Oct 2 2026): "after the first few tiles are placed we should have the
 * chance of spawning nodes that have a 'shelter' at the center of them and an expensive fairly fragile but large and
 * slow unit called an infestor ... you attack these with an infester and it burrows into it turning it into something
 * of a second base (war prioritises them) and they give you a resource multiplier at the end of every wave if they are
 * protected (they also produce creep and grow over time ... up to a third stage) / ... a faster long range attacker
 * that is harder to make in large numbers (these are meant to solve science teams attacking you far from any response)".
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { BALANCE as B } from '../content/data';
import { LINEAGES } from '../content/campaign';
import type { DraftOffer } from '../src/sim/citymap';
import type { Enemy, OrganId, Shelter, SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4242 };
type Spawner = { spawnEnemy(kind: string, atGate?: number): Enemy };
type Private = {
  growFieldUnits(): void; payShelters(): void; raiseShelter(slot: number): void; markShelterOffer(o: DraftOffer[]): void;
  enemies: Enemy[]; draftsTaken: number; waveBanked: Record<'war' | 'science' | 'royal', number>;
};
const P = (s: Sim) => s as unknown as Private;
const hush = (s: Sim) => { P(s).enemies.length = 0; };
const run = (s: Sim, seconds: number, quiet = true) => { for (let i = 0; i < seconds * 10; i++) { s.tick(); if (quiet) hush(s); } };

function grow(s: Sim, organ: OrganId) {
  s.meat.war = 9999;
  s.meat.science = 9999;
  for (let c = 0; c < s.under.cells.length; c++) {
    for (let rot = 0; rot < 4; rot++) {
      if (s.canBuildOrgan(organ, c, rot)) {
        expect(s.issue({ kind: 'build-organ', organ, cell: c, rot }).ok).toBe(true);
        return s.organs[s.organs.length - 1];
      }
    }
  }
  throw new Error(`no spot for ${organ}`);
}

/** A shelter raised in a district already on the board (the one nearest the core but not its own). */
function withShelter(seed = 4242): { s: Sim; sh: Shelter } {
  const s = new Sim({ ...CFG, seed });
  const coreSlot = Math.floor(Math.floor(s.map.coreCell / s.cfg.gridW) / 10) * s.map.slotsX + Math.floor((s.map.coreCell % s.cfg.gridW) / 10);
  const slots = s.map.slots.map((x, i) => (x !== null ? i : -1)).filter((i) => i >= 0);
  for (const slot of [...slots.filter((i) => i !== coreSlot), coreSlot]) {
    P(s).raiseShelter(slot);
    if (s.shelters.length) break;
  }
  expect(s.shelters.length).toBe(1);
  return { s, sh: s.shelters[0] };
}

function infestorAt(s: Sim) {
  grow(s, 'infestor');
  for (let i = 0; i < B.infestorEvery; i++) P(s).growFieldUnits();
  expect(s.infestors).toHaveLength(1);
  return s.infestors[0];
}

describe('shelters', () => {
  it('stand on building cells beside a street, intact, and take no limb', () => {
    const { s, sh } = withShelter();
    expect(sh.state).toBe('intact');
    for (const c of sh.cells) expect(s.map.cells[c]).toBe(0); // Block
    expect(s.map.cells[sh.door]).toBe(1); // Road
    for (const c of sh.cells) expect(s.groundFor(c, 'spitter')).toBeNull();
  });

  it('are offered on drafts only from the shelterFromDraft-th draft, in a run that can grow Infestors, at most one an offer', () => {
    let seen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = new Sim({ ...CFG, seed });
      const offers = (): DraftOffer[] => [0, 1, 2].map((i) => ({ pattern: s.map.slots.find((x) => x)!.pattern, slot: i, feature: 'plain' }));
      P(s).draftsTaken = 0;
      const early = offers();
      P(s).markShelterOffer(early);
      if (B.shelterFromDraft > 1) expect(early.some((o) => o.shelter)).toBe(false);
      P(s).draftsTaken = B.shelterFromDraft;
      const later = offers();
      P(s).markShelterOffer(later);
      expect(later.filter((o) => o.shelter).length).toBeLessThanOrEqual(1);
      if (later.some((o) => o.shelter)) seen++;
      // A campaign run without the cyst: never.
      const locked = new Sim({ ...CFG, seed, organPool: ['bladder'] });
      P(locked).draftsTaken = B.shelterFromDraft;
      const none = offers();
      P(locked).markShelterOffer(none);
      expect(none.some((o) => o.shelter)).toBe(false);
    }
    // Rare enough to matter, common enough to be met: roughly shelterOdds of drafts.
    expect(seen).toBeGreaterThan(40 * B.shelterOdds * 0.5);
    expect(seen).toBeLessThan(40 * B.shelterOdds * 1.5);
  });

  it('the shelter roll does not touch the run\'s own dice', () => {
    const a = new Sim({ ...CFG, seed: 7 });
    const b = new Sim({ ...CFG, seed: 7 });
    P(b).draftsTaken = 5;
    P(b).markShelterOffer([{ pattern: b.map.slots.find((x) => x)!.pattern, slot: 0, feature: 'plain' }]);
    run(a, 30, false);
    run(b, 30, false);
    expect(b.enemies.length).toBe(a.enemies.length);
    expect(b.time).toBe(a.time);
  });
});

describe('the Infestor', () => {
  it('an Infestor Cyst grows one every infestorEvery turns, paid for then, one at a time', () => {
    const s = new Sim({ ...CFG });
    grow(s, 'infestor');
    s.meat.war = 100;
    s.meat.science = 100;
    for (let i = 0; i < B.infestorEvery - 1; i++) P(s).growFieldUnits();
    expect(s.infestors).toHaveLength(0);
    P(s).growFieldUnits();
    expect(s.infestors).toHaveLength(1);
    expect(s.meat.war).toBe(100 - (B.infestorCost.war ?? 0));
    expect(s.meat.science).toBe(100 - (B.infestorCost.science ?? 0));
    for (let i = 0; i < 6; i++) P(s).growFieldUnits();
    expect(s.infestors).toHaveLength(1);
  });

  it('cannot be paid for: it waits', () => {
    const s = new Sim({ ...CFG });
    grow(s, 'infestor');
    s.meat.war = 0;
    s.meat.science = 0;
    for (let i = 0; i < 6; i++) P(s).growFieldUnits();
    expect(s.infestors).toHaveLength(0);
  });

  it('burrows into a shelter: it walks to the door, channels infestChannel s, and the shelter is YOURS (stage 1, seeping creep)', () => {
    const { s, sh } = withShelter();
    const u = infestorAt(s);
    u.hp = 1e9; // ignore the defenders here (they are tested below)
    expect(s.issue({ kind: 'infest', unitId: u.id, shelterId: sh.id }).ok).toBe(true);
    for (let i = 0; i < 1600 && sh.state === 'intact'; i++) { s.tick(); hush(s); }
    expect(sh.state).toBe('infested');
    expect(sh.stage).toBeGreaterThanOrEqual(1);
    expect(s.infestors).toHaveLength(0);
    expect(s.isCreeped(sh.door)).toBe(true);
    expect(s.stats.sheltersInfested).toBe(1);
  });

  it('dies under the defenders if left alone long enough: the shelter stays theirs, burrowing interrupted', () => {
    const { s, sh } = withShelter();
    const u = infestorAt(s);
    expect(s.issue({ kind: 'infest', unitId: u.id, shelterId: sh.id }).ok).toBe(true);
    // Walk it to the door, then make it frail: the defenders kill it mid-burrow.
    for (let i = 0; i < 1600 && sh.burrowBy === undefined && s.infestors.length; i++) { u.hp = 1e9; s.tick(); hush(s); }
    expect(sh.burrowBy).toBe(u.id);
    u.hp = B.shelterGuardDamage * 2;
    run(s, B.infestChannel + 2);
    expect(s.infestors).toHaveLength(0);
    expect(sh.state).toBe('intact');
    expect(sh.burrowBy).toBeUndefined();
  });

  it('a new order takes it off the shelter', () => {
    const { s, sh } = withShelter();
    const u = infestorAt(s);
    s.issue({ kind: 'infest', unitId: u.id, shelterId: sh.id });
    expect(u.infest).toBe(sh.id);
    s.issue({ kind: 'unit-order', ids: [u.id], order: { kind: 'hold' } });
    expect(u.infest).toBeUndefined();
  });
});

describe('an infested shelter', () => {
  function infested(seed = 4242) {
    const { s, sh } = withShelter(seed);
    const u = infestorAt(s);
    u.hp = 1e9;
    s.issue({ kind: 'infest', unitId: u.id, shelterId: sh.id });
    for (let i = 0; i < 1600 && sh.state === 'intact'; i++) { s.tick(); hush(s); }
    expect(sh.state).toBe('infested');
    // Back to a fresh stage 1 (waves may have cleared while it burrowed).
    (s as unknown as { setShelterStage(x: Shelter, n: number): void }).setShelterStage(sh, 1);
    sh.growth = 0;
    sh.hp = sh.maxHp;
    return { s, sh };
  }

  it('pays its stage\'s boost on the wave\'s meat at a PROTECTED clear, and grows to stage 3', () => {
    const { s, sh } = infested();
    const pay = (harm: number) => {
      sh.harmThisWave = harm;
      P(s).waveBanked = { war: 100, science: 40, royal: 3 };
      const w = s.meat.war;
      const sc = s.meat.science;
      P(s).payShelters();
      return { war: s.meat.war - w, science: s.meat.science - sc };
    };
    expect(pay(0)).toEqual({ war: Math.floor(100 * B.shelterBoost[0]), science: Math.floor(40 * B.shelterBoost[0]) });
    for (let i = 0; i < B.shelterGrowEvery * 3; i++) pay(0);
    expect(sh.stage).toBe(3);
    expect(pay(0).war).toBe(Math.floor(100 * B.shelterBoost[2]));
    // Not protected (hurt past shelterProtected of its body): nothing, and it does not grow.
    const top = sh.growth;
    expect(pay(sh.maxHp * B.shelterProtected + 1)).toEqual({ war: 0, science: 0 });
    expect(sh.growth).toBe(top);
  });

  it('the war caste goes for it first, and at 0 hp it is lost (a ruin, its creep gone)', () => {
    const { s, sh } = infested();
    // A soldier straight from a gate: it turns off its road to the shelter.
    const e = (s as unknown as Spawner).spawnEnemy('soldier');
    e.pos = { ...s.cellCenter(sh.door) };
    e.pos.x += 4;
    const hp = sh.hp;
    for (let i = 0; i < 40; i++) s.tick();
    expect(sh.hp).toBeLessThan(hp);
    sh.hp = 1;
    for (let i = 0; i < 40 && sh.state === 'infested'; i++) s.tick();
    expect(sh.state).toBe('ruin');
    expect(s.stats.sheltersLost).toBe(1);
  });

  it('a 3-stage shelter seeps more creep than a stage-1 one', () => {
    const { s, sh } = infested();
    const count = () => s.map.cells.reduce((n, _c, i) => n + (s.isCreeped(i) ? 1 : 0), 0);
    const one = count();
    for (let i = 0; i < B.shelterGrowEvery * 3; i++) { sh.harmThisWave = 0; P(s).payShelters(); }
    expect(sh.stage).toBe(3);
    expect(count()).toBeGreaterThan(one);
  });
});

describe('the Harrier', () => {
  it('a gland grows one every harrierEvery turns for science, one a gland, harrierMax on the board', () => {
    const s = new Sim({ ...CFG });
    for (let i = 0; i < B.harrierMax + 2; i++) grow(s, 'harrier');
    s.meat.science = 9999;
    for (let i = 0; i < B.harrierEvery * 4; i++) P(s).growFieldUnits();
    expect(s.harriers.length).toBe(B.harrierMax);
  });

  it('runs down a science party far from the body and kills it', () => {
    const s = new Sim({ ...CFG });
    grow(s, 'harrier');
    s.meat.science = 999;
    for (let i = 0; i < B.harrierEvery; i++) P(s).growFieldUnits();
    expect(s.harriers).toHaveLength(1);
    const sp = s as unknown as Spawner;
    const r = sp.spawnEnemy('researcher');
    const killedBefore = s.stats.harrierKills ?? 0;
    for (let i = 0; i < 1200 && s.enemies.includes(r); i++) s.tick();
    expect(s.enemies.includes(r)).toBe(false);
    expect((s.stats.harrierKills ?? 0)).toBeGreaterThan(killedBefore);
  });

  it('is poor against the war caste (its quills are made for the soft castes)', () => {
    expect(B.harrierVsWar).toBeLessThan(1);
    expect(B.harrierVsScience).toBeGreaterThan(2);
    expect(B.harrierSpeed).toBeGreaterThan(B.broodSpeed);
  });
});

describe('unlocks', () => {
  it('both organs are sanctioned lineages bought mid-campaign, the Infestor after the Harrier', () => {
    expect(LINEAGES.harrier).toBeDefined();
    expect(LINEAGES.infestor).toBeDefined();
    expect(LINEAGES.infestor!.price).toBeGreaterThan(LINEAGES.harrier!.price);
  });
});

describe('determinism', () => {
  it('an expansion run plays the same twice', () => {
    const play = () => {
      const s = new Sim({ ...CFG, seed: 31, organStage: true });
      const bot = new Autoplayer(31);
      bot.expansion = true;
      for (let i = 0; i < 6000 && s.outcome === 'playing'; i++) { bot.act(s, 0.1); s.tick(); s.takeEvents(); }
      return JSON.stringify({ t: s.time, w: s.waveNumber, m: s.meat, sh: s.shelters.map((x) => [x.state, x.stage]), st: s.stats.shelterMeat ?? 0 });
    };
    expect(play()).toBe(play());
  });
});
