/**
 * THE MIDPOINT (Collins, Oct 1 2026; content/campaign.ts MIDPOINT_CAPTURES): halfway along an
 * alliance the other two factions make offers; he goes over to one, or stays. Runs are faked.
 */
import { describe, expect, it } from 'vitest';
import {
  ally, finish, newCampaign, perksOf, plan, stayLoyal, summaryFor, switchAlly, targets,
  type CampaignState,
} from '../src/meta/campaign';
import type { RunReport } from '../src/meta/goals';
import { FACTIONS, MIDPOINT_CAPTURES, type FactionId } from '../content/campaign';
import { scenesOf } from '../content/media';
import type { RunStats } from '../src/sim/types';

const report = (won: boolean): RunReport => ({
  won, wavesCleared: 6, coreEndFrac: 0.8, scienceBanked: 0,
  stats: {
    kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
    cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
    families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
    gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
  } as RunStats,
});
/** One deployment as a player would: defend what is attacked, else take the next open ground (never a finale). */
const step = (s: CampaignState, won = true): CampaignState => {
  const to = s.underAttack ?? targets(s).find((t) => !t.finaleOf)!.id;
  return finish(s, plan(s, to), report(won)).state;
};
/** Take n more territories (defending in between when the colony pushes back, as a player must). */
const wins = (s: CampaignState, n: number) => {
  const goal = s.captures + n;
  for (let i = 0; i < 4 * n + 4 && s.captures < goal; i++) s = step(s);
  return s;
};
/** Take exactly one more territory. */
const take = (s: CampaignState) => wins(s, 1);
/** A campaign allied with `f` (all scenes cleared but the beats' choices). */
const alliedWith = (f: FactionId, seed = 11): CampaignState => {
  let s = newCampaign(seed);
  s = take(s);
  s = ally(s, f);
  return { ...s, pendingScenes: [] };
};
const clear = (s: CampaignState): CampaignState => ({ ...s, pendingScenes: [] });

describe('the midpoint: the other two make offers, once', () => {
  for (const f of FACTIONS) {
    it(`allied with ${f.id}: ${MIDPOINT_CAPTURES} territories in, both rivals call through their own channel`, () => {
      let s = alliedWith(f.id);
      s = clear(wins(s, MIDPOINT_CAPTURES - 1));
      expect(s.midpoint).toBeUndefined();
      expect(s.pendingScenes.some((p) => p.offer)).toBe(false);
      s = take(s);
      expect(s.midpoint?.status).toBe('offered');
      const offers = s.pendingScenes.filter((p) => p.offer);
      expect(offers.map((p) => p.faction).sort()).toEqual(FACTIONS.filter((x) => x.id !== f.id).map((x) => x.id).sort());
      // Each offer is written for someone allied with THIS faction.
      for (const o of offers) expect(o.scene).toEqual(FACTIONS.find((x) => x.id === o.faction)!.midpoint.offers[f.id]);
      expect(summaryFor(s)).toMatch(/offers/);
      // Not again, whatever he does next.
      s = stayLoyal(clear(s));
      s = wins(s, 2);
      expect(s.pendingScenes.filter((p) => p.offer)).toEqual([]);
    });
  }

  it('a loss does not bring the midpoint (it counts territories taken)', () => {
    let s = clear(wins(alliedWith('faithful'), MIDPOINT_CAPTURES - 1));
    s = finish(s, plan(s, targets(s).find((t) => !t.finaleOf)!.id), report(false)).state;
    expect(s.midpoint).toBeUndefined();
  });
});

describe('staying loyal', () => {
  it('keeps every perk and adds the ally\'s thanks, which really changes the runs', () => {
    const cases: Array<[FactionId, (s: CampaignState) => void]> = [
      ['delegation', (s) => {
        expect(perksOf(s)).toContain('pickets');
        // Objectors 1 + the Pickets: two kinds turned away.
        expect(plan(s, targets(s)[0].id, { objectors: ['flier', 'sapper', 'soldier'] }).config.bannedEnemies).toEqual(['flier', 'sapper']);
      }],
      ['faithful', (s) => {
        expect(perksOf(s)).toContain('tithe');
        expect(plan(s, targets(s)[0].id).config.startBonus?.war).toBe(40);
      }],
      ['institute', (s) => {
        expect(perksOf(s)).toContain('retainer');
        expect(plan(s, targets(s)[0].id).config.startBonus?.science).toBe(30 + 25);
      }],
    ];
    for (const [f, check] of cases) {
      let s = take(clear(wins(alliedWith(f), MIDPOINT_CAPTURES - 1)));
      const before = perksOf(s);
      s = stayLoyal(s);
      expect(s.midpoint?.status).toBe('stayed');
      expect(s.faction).toBe(f);
      expect(s.pendingScenes.some((p) => p.offer)).toBe(false);
      expect(s.pendingScenes.at(-1)?.scene).toEqual(FACTIONS.find((x) => x.id === f)!.midpoint.loyal);
      for (const p of before) expect(perksOf(s)).toContain(p);
      check(s);
      // Switching after staying does nothing.
      expect(switchAlly(s, f === 'delegation' ? 'institute' : 'delegation').faction).toBe(f);
    }
  });
});

describe('going over', () => {
  it('Faithful → Delegation: old perks go, a goodbye in character, the new route starts a territory in', () => {
    let s = take(clear(wins(alliedWith('faithful'), MIDPOINT_CAPTURES - 1)));
    expect(perksOf(s)).toEqual(expect.arrayContaining(['sleepers1', 'garrison']));
    const seenBefore = [...s.beatsSeen];
    // (A counter-attack the colony was already making is its own business: src/meta/defence.ts.)
    const attackBefore = { underAttack: s.underAttack, staging: s.staging ?? null };
    s = switchAlly(s, 'delegation');
    expect(s.faction).toBe('delegation');
    expect(s.midpoint).toMatchObject({ status: 'switched', from: 'faithful', to: 'delegation' });
    expect(perksOf(s)).not.toContain('sleepers1');
    expect(perksOf(s)).not.toContain('garrison');
    // The head start: its first two beats play now (and their perks are his).
    expect(perksOf(s)).toEqual(expect.arrayContaining(['objectors1', 'translator']));
    expect(s.beatsSeen).toEqual([...seenBefore, 'understand', 'stop-war']);
    const titles = s.pendingScenes.map((p) => p.scene.title);
    expect(titles[0]).toBe('Chapter Thirty: The Meek'); // the Voice's goodbye comes first
    // then his broadcast for the new ally (going over is public too), then its first two scenes
    expect(titles.slice(1)).toEqual(['We Come in Peace', 'The First Summit', 'The Leaked Plans']);
    expect(s.pendingScenes[1].pledge).toBe(true);
    expect(s.pendingScenes.some((p) => p.offer)).toBe(false);
    // Not hostile: no counter-attack comes of it, and his ground is his.
    expect({ underAttack: s.underAttack, staging: s.staging ?? null }).toEqual(attackBefore);
    expect(summaryFor(s)).toMatch(/left The Faithful of the Last Hour for The Friendship Delegation/);
  });

  it('the old finale closes, the new one opens at the end of the new route, and the old ally writes after the ending', () => {
    let s = take(clear(wins(alliedWith('delegation', 21), MIDPOINT_CAPTURES - 1)));
    s = clear(switchAlly(s, 'institute'));
    expect(s.beatsSeen).toEqual(expect.arrayContaining(['machines', 'pipeline']));
    for (let i = 0; i < 12 && !targets(s).some((t) => t.finaleOf === 'institute'); i++) {
      s = clear(take(s));
      if (s.pendingScenes.length) s = clear(s);
    }
    expect(targets(s).some((t) => t.finaleOf === 'delegation')).toBe(false);
    expect(s.beatsSeen).toContain('ultimatum');
    s = finish(s, plan(s, 'glass-spires'), report(true)).state;
    // The new ally's finale is played; the campaign ends at the last mission after it (tests/lastMission.test.ts).
    expect(s.finale).toBe('institute');
    expect(s.ended).toBeNull();
    const titles = s.pendingScenes.map((p) => p.scene.title);
    // His finale (the creep reaches the Director, who wakes in the archive), then the Delegation's last letter. Nothing after.
    expect(titles.indexOf('What Do You Mean, a Simulation')).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf('A Last Letter From the Field')).toBe(titles.indexOf('What Do You Mean, a Simulation') + 1);
    expect(titles[titles.length - 1]).toBe('A Last Letter From the Field');
  });

  it('only at the midpoint, only to a rival', () => {
    const s = clear(wins(alliedWith('institute'), MIDPOINT_CAPTURES - 1));
    expect(switchAlly(s, 'faithful').faction).toBe('institute'); // not offered yet
    const m = take(s);
    expect(switchAlly(m, 'institute').midpoint?.status).toBe('offered'); // not to himself
  });

  it('every pair is written: an offer and a goodbye for each, a thanks and a coda from each', () => {
    for (const f of FACTIONS) {
      for (const g of FACTIONS.filter((x) => x.id !== f.id)) {
        expect(f.midpoint.offers[g.id]?.lines.length, `${f.id} offers to ${g.id}'s ally`).toBeGreaterThan(2);
        expect(f.midpoint.farewell[g.id]?.lines.length, `${f.id} left for ${g.id}`).toBeGreaterThan(1);
      }
      expect(f.perks[f.midpoint.loyalPerk]).toBeTruthy();
      // A leader's line is voiced by its faction + scene title (content/media.ts voiceKey): no two of a faction's scenes share one.
      const titles = scenesOf(f).map((x) => x.title);
      expect(new Set(titles).size, `${f.id}: ${titles.join(' | ')}`).toBe(titles.length);
      expect(f.midpoint.loyal.lines.length).toBeGreaterThan(1);
      expect(f.midpoint.coda.lines.length).toBeGreaterThan(1);
      // Every line names its speaker (the scene card splits on the first colon).
      for (const sc of [...Object.values(f.midpoint.offers), ...Object.values(f.midpoint.farewell), f.midpoint.loyal, f.midpoint.coda]) {
        for (const l of sc!.lines) expect(l).toMatch(/^[A-Z][^:]{1,40}: /);
      }
    }
  });
});

describe('saves from before the midpoint', () => {
  it('an old save already past the midpoint loads and is offered it at its next return', () => {
    let s = clear(wins(alliedWith('delegation', 31), MIDPOINT_CAPTURES + 1));
    // What an old save looks like: no midpoint field, offers never queued.
    const old = JSON.parse(JSON.stringify({ ...s, midpoint: undefined, pendingScenes: [] })) as CampaignState;
    delete (old as { midpoint?: unknown }).midpoint;
    expect('midpoint' in old).toBe(false);
    expect(perksOf(old)).not.toContain('pickets');
    s = take(old);
    expect(s.midpoint?.status).toBe('offered');
    expect(s.pendingScenes.filter((p) => p.offer).length).toBe(2);
    s = switchAlly(s, 'faithful');
    expect(s.faction).toBe('faithful');
  });

  it('a save whose campaign has ended is never offered it', () => {
    const s = { ...clear(wins(alliedWith('faithful', 41), 1)), ended: 'faithful' as FactionId };
    delete (s as { midpoint?: unknown }).midpoint;
    const after = finish(s, plan(s, 'crash-site'), report(true)).state;
    expect(after.midpoint).toBeUndefined();
  });
});
