/**
 * Empire Directives (standing orders) and hobby missions: the rules in src/meta/directives.ts and
 * src/meta/hobby.ts, driven through the campaign's own finish() with faked run reports; and the
 * hobby genes' verbs in the sim.
 */
import { describe, expect, it } from 'vitest';
import { finish, newCampaign, plan, targets, type CampaignState } from '../src/meta/campaign';
import type { RunReport } from '../src/meta/goals';
import { ordersOf } from '../src/meta/directives';
import { hobbyOf, pinHobby, toggleSplice } from '../src/meta/hobby';
import { ORDERS, ORDERS_OPEN } from '../content/directives';
import { HOBBIES, HOBBY_SPLICE_SLOTS } from '../content/hobby';
import { GENES, HOBBY_GENES, geneById } from '../content/plates';
import { Sim } from '../src/sim/sim';
import type { RunStats } from '../src/sim/types';

const blank = (): RunStats => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});
const rep = (won: boolean, stats: Partial<RunStats> = {}): RunReport => ({ won, wavesCleared: 6, coreEndFrac: 0.8, scienceBanked: 0, stats: { ...blank(), ...stats } });
const win = (s: CampaignState, r: RunReport = rep(true)) => finish(s, plan(s, targets(s)[0].id), r);

/** A campaign whose desk has just cleared (mission 1 done, one win). */
function cleared(): CampaignState {
  let s = newCampaign(7, { onboarding: true });
  s = finish(s, plan(s, 'crash-site'), rep(true)).state; // mission 1
  s = win(s).state; // the desk clears
  return s;
}

describe('Empire Directives: standing orders', () => {
  it('are issued, three at a time, the day the desk clears, and not before', () => {
    let s = newCampaign(7, { onboarding: true });
    s = finish(s, plan(s, 'crash-site'), rep(true)).state;
    expect(s.orders).toBeUndefined();
    s = cleared();
    expect(s.orders!.open.map((o) => o.id)).toEqual(ORDERS.slice(0, ORDERS_OPEN).map((o) => o.id));
    // The deployment that cleared the desk does not count toward them.
    expect(s.orders!.open.every((o) => o.progress === 0)).toBe(true);
  });

  it('add up across deployments, pay standing when full, and issue the next', () => {
    let s = cleared();
    const before = s.standing;
    for (let i = 0; i < 3; i++) s = win(s, rep(true, { kills: { militia: 100 } })).state;
    // SO 2-K (three territories) is full; its standing paid; the fourth order is open.
    expect(s.orders!.done).toContain('acquisition');
    expect(s.orders!.open.some((o) => o.id === ORDERS[ORDERS_OPEN].id)).toBe(true);
    expect(s.standing - before).toBeGreaterThanOrEqual(ORDERS[0].pays);
    expect(s.log.some((l) => l.startsWith('SO 2-K'))).toBe(true);
    expect(ordersOf(s).open.find((o) => o.id === 'aggregate')!.progress).toBe(300);
  });

  it('the Live Royal Retrieval order issues a trap cage to every deployment while it is open', () => {
    let s = cleared();
    s = { ...s, orders: { open: [{ id: 'live-royal', progress: 0, since: 0 }], done: [], record: [] } };
    expect(plan(s, targets(s)[0].id).config.trapCage).toBe(true);
    s = win(s, rep(true, { royalsCaptured: 1 })).state;
    expect(s.orders!.done).toContain('live-royal');
  });

  it('the field trial puts a lineage in the pool while open and keeps it when fulfilled', () => {
    let s = cleared();
    s = { ...s, orders: { open: [{ id: 'field-trial', progress: 0, since: 0, trial: 'nerve' }], done: [], record: [] } };
    expect(s.lineages).not.toContain('nerve');
    expect(plan(s, targets(s)[0].id).config.organPool).toContain('nerve');
    s = win(s).state;
    s = win(s).state;
    expect(s.lineages).toContain('nerve');
  });

  it('record every deployment\'s own directive', () => {
    let s = cleared();
    const n = s.orders!.record.length;
    s = win(s).state;
    expect(s.orders!.record.length).toBe(n + 1);
    expect(['hold', 'royal', 'harvest']).toContain(s.orders!.record[n].kind);
  });
});

describe('hobby missions', () => {
  it('has 6-10 pages, each paying a hobby gene that exists and is never in the skirmish gene bay', () => {
    expect(HOBBIES.length).toBeGreaterThanOrEqual(6);
    expect(HOBBIES.length).toBeLessThanOrEqual(10);
    for (const h of HOBBIES) {
      expect(HOBBY_GENES.some((g) => g.id === h.gene)).toBe(true);
      expect(GENES.some((g) => g.id === h.gene)).toBe(false);
      expect(h.steps.length).toBeGreaterThan(0);
    }
    expect(new Set(HOBBIES.map((h) => h.gene)).size).toBe(HOBBIES.length);
  });

  it('pages occur to him: the desk pages when it clears, others when the board sparks them', () => {
    let s = cleared();
    const desk = HOBBIES.filter((h) => h.spark === 'desk').map((h) => h.id);
    expect(hobbyOf(s).ideas).toEqual(desk);
    s = win(s, rep(true, { maxBurning: 6 })).state;
    expect(hobbyOf(s).ideas).toContain('fire-jump');
  });

  it('a pinned page runs in a deployment, pays its gene when every step is met, and is spliced', () => {
    let s = cleared();
    s = pinHobby(s, 'recipe-book');
    const p = plan(s, targets(s)[0].id);
    expect(p.hobby?.def.id).toBe('recipe-book');
    // Half of it is not enough.
    let r = finish(s, p, rep(true, { cannibalized: 9, maxPips: 3 }));
    expect(r.debrief.hobby?.met).toBe(false);
    expect(hobbyOf(r.state).genes).toEqual([]);
    s = r.state;
    r = finish(s, plan(s, targets(s)[0].id), rep(true, { cannibalized: 9, maxPips: 12 }));
    expect(r.debrief.hobby?.met).toBe(true);
    s = r.state;
    expect(hobbyOf(s).genes).toEqual(['grudge-marrow']);
    expect(hobbyOf(s).spliced).toEqual(['grudge-marrow']);
    expect(hobbyOf(s).pinned).toBeNull();
    // It pays no standing and no notes of its own; the Office notices.
    expect(s.log.some((l) => l.startsWith('Form 0-U'))).toBe(true);
    // Every later deployment carries the spliced gene.
    expect(plan(s, targets(s)[0].id).config.genes).toEqual(['grudge-marrow']);
  });

  it('carries at most two splices', () => {
    let s = cleared();
    s = { ...s, hobby: { ...hobbyOf(s), genes: ['tallow-blood', 'kite-string', 'wet-nurse'], spliced: [] } };
    for (const g of ['tallow-blood', 'kite-string', 'wet-nurse']) s = toggleSplice(s, g);
    expect(hobbyOf(s).spliced.length).toBe(HOBBY_SPLICE_SLOTS);
    expect(hobbyOf(s).spliced).toEqual(['kite-string', 'wet-nurse']);
  });

  it('mission 1 carries no page and no genes', () => {
    const s = newCampaign(3, { onboarding: true });
    const p = plan(s, 'crash-site');
    expect(p.hobby).toBeUndefined();
    expect(p.config.genes).toBeUndefined();
  });
});

describe('hobby genes in the sim', () => {
  const cfg = (genes: string[]) => ({ gridW: 60, gridH: 60, cellPx: 16, seed: 5, genes });
  it('every gene is known to the sim', () => {
    for (const g of HOBBY_GENES) expect(geneById(g.id)).toBeDefined();
  });
  it('Grudge Marrow raises the salvage of an eaten limb', () => {
    const a = new Sim(cfg([])).salvageOf('spitter');
    const b = new Sim(cfg(['grudge-marrow'])).salvageOf('spitter');
    expect((b.war ?? 0)).toBeGreaterThan(a.war ?? 0);
  });
  it('Royal Graft starts the run with a free trap cage', () => {
    const s = new Sim(cfg(['royal-graft']));
    expect(s.hand.some((c) => c.family === 'cage' && c.free)).toBe(true);
  });
  it('a gene that is not spliced changes nothing (the same seed plays the same)', () => {
    const a = new Sim(cfg([]));
    const b = new Sim(cfg([]));
    for (let i = 0; i < 600; i++) { a.tick(); b.tick(); }
    expect(JSON.stringify(a.stats)).toBe(JSON.stringify(b.stats));
  });
});
