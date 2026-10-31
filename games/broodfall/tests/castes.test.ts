/**
 * THE CASTES COME WHEN THEIR MEAT IS SPENDABLE (Collins, Oct 30 2026: "on the first mission the first units you
 * encounter are science types this is crazy they are a more advanced type unit ... I dont even think you start with
 * any limbs that use their currency (or at least you shouldn't) ... mission one should be only war type and science
 * type + royals should not come until you can use their currency"). src/sim/sim.ts castesOpen; DESIGN.md "Three meat
 * currencies", rule 4.
 */
import { describe, expect, it } from 'vitest';
import { Autoplayer } from '../src/sim/autoplayer';
import { DT, Sim, castesOpen, enemySpec } from '../src/sim/sim';
import { draftOffers } from '../src/sim/citymap';
import { createUnderground } from '../src/sim/underground';
import { Rng } from '../src/sim/rng';
import type { EnemyKind, SimConfig, SimEvent } from '../src/sim/types';
import { NO_EVOLUTION, evolutionCaps, newCampaign, plan } from '../src/meta/campaign';
import { FIRST_MISSION } from '../src/meta/onboarding';
import { TOWERS } from '../content/data';
import { HOME } from '../content/campaign';

const GRID = { gridW: 50, gridH: 40, cellPx: 26, entrances: 1, genes: [] as string[] };
/** A deployment with nothing priced in science or royal points: the start lineages, no evolution. */
const WAR_ONLY: Omit<SimConfig, 'seed'> = {
  ...GRID, organStage: true, organPool: ['gut', 'forge', 'heart', 'root', 'bladder'], startOrgans: ['gut', 'forge'],
  evolutionCap: NO_EVOLUTION, directive: { kind: 'hold', waves: 5 },
};
const PIPS = TOWERS.filter((t) => !t.engine).map((t) => t.family);

/** The scripted player plays the run out (or `maxTicks`); every enemy kind that ever stood on the board, and the events. */
function play(cfg: SimConfig, maxTicks = 40_000) {
  const sim = new Sim(cfg);
  const auto = new Autoplayer(cfg.seed + 1);
  const events: SimEvent[] = [];
  const seen = new Map<number, EnemyKind>();
  /** The feature of every plate a draft offered. */
  const offered = new Set<string>();
  let lastDraft: unknown = null;
  for (let i = 0; i < maxTicks && sim.outcome === 'playing'; i++) {
    if (sim.pendingDraft && sim.pendingDraft !== lastDraft) {
      lastDraft = sim.pendingDraft;
      for (const o of sim.pendingDraft) offered.add(o.feature);
    }
    auto.act(sim, DT);
    sim.tick();
    events.push(...sim.takeEvents());
    for (const e of sim.enemies) if (!seen.has(e.id)) seen.set(e.id, e.kind);
  }
  const castes = new Set([...seen.values()].map((k) => enemySpec(k).caste));
  return { sim, events, kinds: new Set(seen.values()), castes, offered };
}

describe('castesOpen: a caste comes only once its meat can be spent', () => {
  const dir = { kind: 'hold', waves: 5 } as const;
  it('nothing priced in science or royal points: both closed', () => {
    expect(castesOpen({ ...WAR_ONLY, seed: 1 }, dir)).toEqual({ science: false, royal: false });
  });
  it('an evolution stage opens science (every stage costs science); the third stage opens the court (a royal point)', () => {
    expect(castesOpen({ ...WAR_ONLY, seed: 1, evolutionCap: { ...NO_EVOLUTION, core: 1 } }, dir)).toEqual({ science: true, royal: false });
    expect(castesOpen({ ...WAR_ONLY, seed: 1, evolutionCap: { ...NO_EVOLUTION, core: 2 } }, dir)).toEqual({ science: true, royal: false });
    expect(castesOpen({ ...WAR_ONLY, seed: 1, evolutionCap: { ...NO_EVOLUTION, forge: 3 } }, dir)).toEqual({ science: true, royal: true });
    // A theme not in play (no organ of it can grow here) opens nothing.
    expect(castesOpen({ ...WAR_ONLY, seed: 1, evolutionCap: { ...NO_EVOLUTION, venom: 3 } }, dir)).toEqual({ science: false, royal: false });
  });
  it('an organ priced in science in the pool, or one whose limbs are, opens science', () => {
    expect(castesOpen({ ...WAR_ONLY, seed: 1, organPool: [...WAR_ONLY.organPool!, 'marrow'] }, dir).science).toBe(true);
    expect(castesOpen({ ...WAR_ONLY, seed: 1, organPool: [...WAR_ONLY.organPool!, 'harrier'] }, dir).science).toBe(true);
  });
  it('the directive: a harvest opens science, a royal hunt opens the court; starting points or the late Host open the court', () => {
    expect(castesOpen({ ...WAR_ONLY, seed: 1 }, { kind: 'harvest', science: 50 })).toEqual({ science: true, royal: false });
    expect(castesOpen({ ...WAR_ONLY, seed: 1 }, { kind: 'royal', count: 1 })).toEqual({ science: false, royal: true });
    expect(castesOpen({ ...WAR_ONLY, seed: 1, startBonus: { royal: 1 } }, dir).royal).toBe(true);
    expect(castesOpen({ ...WAR_ONLY, seed: 1, lateHost: { turns: 3, minTier: 2 } }, dir).royal).toBe(true);
  });
  it('a skirmish (no caps, every organ): everything open, as it always was', () => {
    expect(castesOpen({ ...GRID, seed: 1 }, dir)).toEqual({ science: true, royal: true });
    expect(new Sim({ ...GRID, seed: 1 }).scienceOpen).toBe(true);
    expect(new Sim({ ...GRID, seed: 1 }).royalOpen).toBe(true);
  });
});

describe('mission 1 is war only', () => {
  it('the campaign\'s plan for the crash site caps every theme at 0: no evolution, no science caste, no court', () => {
    const s = newCampaign(7, { onboarding: true });
    const p = plan(s, FIRST_MISSION);
    expect(p.first).toBe(true);
    expect(p.config.evolutionCap).toEqual(NO_EVOLUTION);
    expect(Object.values(p.config.evolutionCap!).every((n) => n === 0)).toBe(true);
    const sim = new Sim({ ...GRID, ...p.config } as SimConfig);
    expect(sim.scienceOpen).toBe(false);
    expect(sim.royalOpen).toBe(false);
    // Its first hand spends war meat only.
    for (const c of sim.hand) expect(TOWERS.find((t) => t.family === c.family)!.cost).toEqual({ war: expect.any(Number) });
    // Nothing evolves, and no decree can be bought.
    sim.meat.science = 999; sim.meat.royal = 9;
    const t = sim.towers[0] ?? null;
    if (t) expect(sim.issue({ kind: 'evolve', towerId: t.id, choice: 'A' } as never).ok).toBe(false);
    expect(sim.issue({ kind: 'decree', decree: 'retinue' } as never)).toEqual({ ok: false, err: 'no decrees here: the court has not come for you yet' });
    // The dig has no research lab and no royal tomb: carrion seams lie where they would have.
    const kinds = sim.under.cells.filter((c) => c.kind === 'deposit').map((c) => c.deposit);
    expect(kinds).not.toContain('lab');
    expect(kinds).not.toContain('ossuary');
  });

  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: the scripted player plays mission 1 out and meets the war caste only`, () => {
      const s = newCampaign(seed, { onboarding: true });
      const { sim, events, castes, kinds, offered } = play({ ...GRID, ...plan(s, FIRST_MISSION).config } as SimConfig);
      expect(sim.waveNumber, 'waves were fought').toBeGreaterThanOrEqual(3);
      expect([...castes], [...kinds].join()).toEqual(['war']);
      expect(events.some((e) => e.kind === 'researchers-arrive')).toBe(false);
      expect(events.some((e) => e.kind === 'royal-incoming')).toBe(false);
      expect(sim.meat.science).toBe(0);
      expect(sim.meat.royal).toBe(0);
      // No Research Quarter was offered: a closed caste's plate is a plain warren.
      expect(offered.has('science')).toBe(false);
    });
  }

  it('the same crash site with the first evolution stage open (mission 2 and after): the science caste comes, the court still not', () => {
    const s = newCampaign(2, { onboarding: true });
    const cfg = { ...GRID, ...plan(s, FIRST_MISSION).config, evolutionCap: evolutionCaps(s) } as SimConfig;
    const sim = new Sim(cfg);
    expect(sim.scienceOpen).toBe(true);
    expect(sim.royalOpen).toBe(false);
    const { events, castes } = play(cfg);
    expect(events.some((e) => e.kind === 'researchers-arrive')).toBe(true);
    expect(castes.has('science')).toBe(true);
    expect(castes.has('royal')).toBe(false);
  });
});

describe('the campaign opens the castes as the currencies become spendable', () => {
  it('mission 2 (the ship\'s pick, Cul-de-Sac Heights): science open (a limb can evolve), the court closed', () => {
    const s = { ...newCampaign(3, { onboarding: true }), onboard: { mission1: 'won' as const, deskOpen: false } };
    const sim = new Sim({ ...GRID, ...plan(s, 'cul-de-sac').config } as SimConfig);
    expect(sim.scienceOpen).toBe(true);
    expect(sim.royalOpen).toBe(false);
  });
  it('the Temple Terraces (a royal hunt): the court comes', () => {
    const s = newCampaign(3);
    expect(new Sim({ ...GRID, ...plan(s, 'temple').config } as SimConfig).royalOpen).toBe(true);
  });
  it('holding the Commuter Ring (core stage 3, a royal point): the court comes from then on', () => {
    const s = { ...newCampaign(3), held: [HOME, 'cul-de-sac', 'commuter'] };
    expect(evolutionCaps(s).core).toBe(3);
    expect(new Sim({ ...GRID, ...plan(s, 'foundry').config } as SimConfig).royalOpen).toBe(true);
  });
});

describe('the dig and the plates under a closed caste', () => {
  it('a closed caste\'s deposits are carrion seams in the same cells; every other cell is as it was', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const open = createUnderground(seed, PIPS);
      const shut = createUnderground(seed, PIPS, { science: false, royal: false });
      expect(open.cells.some((c) => c.deposit === 'lab')).toBe(true);
      expect(open.cells.some((c) => c.deposit === 'ossuary')).toBe(true);
      open.cells.forEach((c, i) => {
        const d = shut.cells[i];
        if (c.deposit === 'lab' || c.deposit === 'ossuary') {
          expect(d.deposit).toBe('seam');
          expect(d.pay).toEqual({ war: 45 });
        } else {
          expect(d.kind).toBe(c.kind);
          expect(d.deposit).toBe(c.deposit);
          expect(d.pay).toEqual(c.pay);
        }
      });
      // Only the science closed: the tombs stay.
      const half = createUnderground(seed, PIPS, { science: false, royal: true });
      expect(half.cells.some((c) => c.deposit === 'ossuary')).toBe(true);
      expect(half.cells.some((c) => c.deposit === 'lab')).toBe(false);
    }
  });
  it('a Research Quarter is offered as a plain warren, with the same dice', () => {
    const sim = new Sim({ ...GRID, seed: 9 });
    const a = draftOffers(sim.map, new Rng(5), 12);
    const b = draftOffers(sim.map, new Rng(5), 12, false);
    expect(a.some((o) => o.feature === 'science')).toBe(true);
    expect(b.some((o) => o.feature === 'science')).toBe(false);
    expect(b.map((o) => `${o.pattern.id}@${o.slot}`)).toEqual(a.map((o) => `${o.pattern.id}@${o.slot}`));
    b.forEach((o, i) => expect(o.feature).toBe(a[i].feature === 'science' ? 'plain' : a[i].feature));
  });
});
