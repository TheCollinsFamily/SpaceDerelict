/**
 * THE LAST MISSION, AGAINST THE ROACH KING (Collins, Oct 4 2026: "the final mission ... is unique in that it starts with a
 * turn count down timer until the military arrives; until then it's only science and royals ... you will have to start
 * them with a shelter every time on this map because otherwise there will be no way to get the basic meat they need to
 * build any limbs"). content/campaign.ts LAST_MISSION, src/sim/sim.ts (lateHost, startShelter, shelterRation),
 * src/meta/campaign.ts (the finale comes before it). Its balance is measured in tools/measure/last-mission.measure.ts.
 */
import { describe, expect, it } from 'vitest';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { COURT_WAVES, ENEMIES, WAVE_TABLE } from '../content/data';
import { FACTIONS, LAST, LAST_MISSION, LINEAGES, TERRITORIES } from '../content/campaign';
import { finish, migrateFinale, newCampaign, plan, targets, territory, type CampaignState } from '../src/meta/campaign';
import { stagingGrounds } from '../src/meta/defence';
import type { RunReport } from '../src/meta/goals';
import type { OrganId, RunStats, SimConfig, SimEvent } from '../src/sim/types';

const casteOf = (k: string) => ENEMIES.find((e) => e.kind === k)!.caste;
const base: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1, organStage: true };
const blankStats = (): RunStats => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});
const report = (won: boolean): RunReport => ({ won, wavesCleared: 9, coreEndFrac: 0.5, scienceBanked: 0, stats: blankStats() });

/** A campaign whose ally's finale has been played: one landing is left. */
function afterFinale(seed = 5): CampaignState {
  const s = { ...newCampaign(seed), onboard: undefined } as CampaignState;
  s.lineages = Object.keys(LINEAGES) as OrganId[];
  s.held = TERRITORIES.filter((t) => !t.last && !t.hidden && (!t.finaleOf || t.finaleOf === 'delegation')).map((t) => t.id);
  s.captures = s.held.length - 1;
  s.deployments = s.captures + 3;
  s.faction = 'delegation';
  s.beatsSeen = FACTIONS.find((f) => f.id === 'delegation')!.beats.map((b) => b.id);
  s.finale = 'delegation';
  return s;
}

describe('the last mission: the court\'s waves', () => {
  it('no war kind in any row, and one of the court in every row (a wave is not over while the court stands)', () => {
    expect(COURT_WAVES.length).toBeGreaterThanOrEqual(LAST_MISSION.turns);
    for (const row of COURT_WAVES) {
      const castes = Object.keys(row).map(casteOf);
      expect(castes).not.toContain('war');
      expect(castes).toContain('royal');
      expect(castes).toContain('science');
    }
  });
});

describe('the last mission: in the sim', () => {
  it('a shelter stands by the body from the start, and is the asset\'s already, every time', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const entrances of [1, 3] as const) {
        const sim = new Sim({ ...base, seed: seed * 977 + 3, entrances, startShelter: 'infested' });
        expect(sim.shelters.length, `seed ${seed}, ${entrances} entrances`).toBe(1);
        const sh = sim.shelters[0];
        expect(sh.state).toBe('infested');
        expect(sh.stage).toBe(1);
        expect(sh.hp).toBe(sh.maxHp);
        // Its door is on the street, reachable from the body; and it is not counted as a shelter he infested himself.
        expect(sim.flowDistOf(sh.door)).toBeLessThan(Infinity);
        expect(sim.stats.sheltersInfested ?? 0).toBe(0);
        const ev = sim.takeEvents();
        expect(ev.filter((e) => e.kind === 'shelter-start')).toHaveLength(1);
        expect(ev.some((e) => e.kind === 'shelter-raised' || e.kind === 'shelter-infested')).toBe(false);
      }
    }
  });

  it('started intact, it is theirs until an Infestor takes it', () => {
    const sim = new Sim({ ...base, seed: 4242, startShelter: 'intact' });
    expect(sim.shelters).toHaveLength(1);
    expect(sim.shelters[0].state).toBe('intact');
  });

  it('no other run has one at the start, a countdown, or a ration', () => {
    const sim = new Sim({ ...base, seed: 99 });
    expect(sim.shelters).toHaveLength(0);
    expect(sim.hostTurnsLeft).toBeNull();
    expect(sim.openingShelter).toBeNull();
  });

  it('the board points at it until the first wave is under way, and not after', () => {
    for (const startShelter of ['infested', 'intact'] as const) {
      const sim = new Sim({ ...base, seed: 5150, entrances: 3, startShelter });
      expect(sim.openingShelter, startShelter).toBe(sim.shelters[0]);
      const auto = new Autoplayer(3);
      for (let i = 0; i < 30000 && sim.outcome === 'playing' && sim.waveNumber === 0; i++) { auto.act(sim, DT); sim.tick(); }
      expect(sim.waveNumber).toBeGreaterThan(0);
      expect(sim.openingShelter, `${startShelter}, wave ${sim.waveNumber}`).toBeNull();
    }
  });

  it('through the countdown no war body comes; then the Host arrives at its tier, and the countdown says so', () => {
    const turns = 3;
    const sim = new Sim({
      ...base, seed: 11007, entrances: 3, waveIntel: 'full', directive: { kind: 'hold', waves: turns + 2 },
      lateHost: { turns, minTier: 5 }, startShelter: 'infested', shelterRation: [45, 60, 80], coreLevel: 3,
    });
    const auto = new Autoplayer(3);
    const starts: Array<Extract<SimEvent, { kind: 'wave-start' }>> = [];
    let arrived = 0;
    let warEarly = 0;
    let rations = 0;
    expect(sim.hostTurnsLeft).toBe(turns);
    // The next wave's preview is the court's row too.
    expect(Object.keys(sim.previewNextWave()).map(casteOf)).not.toContain('war');
    for (let i = 0; i < 30000 && sim.outcome === 'playing' && starts.length <= turns; i++) {
      auto.act(sim, DT);
      sim.tick();
      for (const e of sim.takeEvents()) {
        if (e.kind === 'wave-start') {
          starts.push(e);
          // The countdown on the HUD: the turns left before this wave began.
          if (e.court) expect(sim.hostTurnsLeft).toBe(turns - e.wave + 1);
        }
        if (e.kind === 'host-arrived') arrived++;
        if (e.kind === 'shelter-paid') rations += e.ration ?? 0;
      }
      if (starts.length >= 1 && starts.length <= turns && sim.enemies.some((x) => casteOf(x.kind) === 'war')) warEarly++;
    }
    expect(starts.length).toBe(turns + 1);
    for (const e of starts.slice(0, turns)) {
      expect(e.court, `wave ${e.wave}`).toBe(true);
      expect(e.hostIn).toBe(turns - e.wave);
      for (const [k, n] of Object.entries(e.counts)) if ((n ?? 0) > 0) expect(casteOf(k), `wave ${e.wave}: ${k}`).not.toBe('war');
    }
    expect(warEarly).toBe(0);
    // The wave after the countdown is the war caste, at the Host's tier at least; the countdown reads zero.
    const host = starts[turns];
    expect(host.court).toBeUndefined();
    expect(host.tier).toBeGreaterThanOrEqual(5);
    expect(Object.entries(host.counts).some(([k, n]) => (n ?? 0) > 0 && casteOf(k) === 'war')).toBe(true);
    expect(Object.keys(host.counts).every((k) => k in WAVE_TABLE[host.tier] || ['militia', 'flametrooper', 'aegis'].includes(k))).toBe(true);
    expect(arrived).toBe(1);
    expect(sim.hostTurnsLeft).toBe(0);
    // The shelter gave its ration at the clears it was protected through: the war meat of the countdown.
    expect(rations).toBeGreaterThanOrEqual(45);
  }, 60000);

  it('the ration: a protected shelter gives its stage\'s war meat at the wave clear; none without the rule', () => {
    const paid = (ration?: number[]) => {
      const sim = new Sim({ ...base, seed: 23007, entrances: 3, lateHost: { turns: 2, minTier: 5 }, startShelter: 'infested', ...(ration ? { shelterRation: ration } : {}), coreLevel: 3 });
      const auto = new Autoplayer(3);
      for (let i = 0; i < 12000 && sim.outcome === 'playing'; i++) {
        auto.act(sim, DT);
        sim.tick();
        for (const e of sim.takeEvents()) {
          if (e.kind === 'shelter-paid') return e;
          if (e.kind === 'wave-cleared' && !ration) return null;
        }
      }
      return undefined;
    };
    const withRation = paid([45, 60, 80]);
    expect(withRation).toBeTruthy();
    expect(withRation!.ration).toBe(45);
    expect(withRation!.war).toBeGreaterThanOrEqual(45);
    // The same shelter in a run without the rule pays only its share of what was banked: no war body, no war meat.
    const without = paid();
    expect(without === null || (without?.ration ?? 0) === 0).toBe(true);
  }, 60000);
});

describe('the last mission: in the campaign', () => {
  it('is not on offer, nor a staging ground, before the ally\'s finale', () => {
    let s = { ...newCampaign(3), onboard: undefined } as CampaignState;
    expect(targets(s).some((t) => t.last)).toBe(false);
    s = { ...s, held: TERRITORIES.filter((t) => !t.last && !t.finaleOf && !t.hidden).map((t) => t.id) };
    expect(targets(s).some((t) => t.last)).toBe(false);
    expect(stagingGrounds(s, 'queens-hollow')).not.toContain(LAST);
    expect(territory(LAST).directive).toEqual({ kind: 'hold', waves: LAST_MISSION.turns + LAST_MISSION.hostWaves });
  });

  it('after the finale it is the one landing left, with its own rules; won, the campaign is over', () => {
    let s = afterFinale();
    expect(targets(s).map((t) => t.id)).toEqual([LAST]);
    const p = plan(s, LAST);
    expect(p.defence).toBe(false);
    expect(p.config.lateHost).toEqual({ turns: LAST_MISSION.turns, minTier: LAST_MISSION.minTier });
    expect(p.config.startShelter).toBe('infested');
    expect(p.config.shelterRation).toEqual(LAST_MISSION.ration);
    expect(p.config.directive).toEqual({ kind: 'hold', waves: LAST_MISSION.turns + LAST_MISSION.hostWaves });
    // No other landing's plan carries them.
    const other = plan({ ...newCampaign(3), onboard: undefined } as CampaignState, 'cul-de-sac');
    expect(other.config.lateHost).toBeUndefined();
    expect(other.config.startShelter).toBeUndefined();
    expect(other.config.shelterRation).toBeUndefined();
    // The plan runs in the real sim.
    const sim = new Sim({ ...base, ...p.config, seed: 7 });
    expect(sim.shelters[0]?.state).toBe('infested');
    expect(sim.hostTurnsLeft).toBe(LAST_MISSION.turns);
    // Lost: still there. Won: over, on the route whose finale came before it; no counter-attack is staged after it.
    s = finish(s, p, report(false)).state;
    expect(s.ended).toBeNull();
    expect(targets(s).map((t) => t.id)).toEqual([LAST]);
    const done = finish(s, plan(s, LAST), report(true));
    expect(done.state.ended).toBe('delegation');
    expect(done.state.held).toContain(LAST);
    expect(done.state.staging ?? null).toBeNull();
    expect(targets(done.state)).toEqual([]);
  });

  it('a save that ended at its finale, from before the last mission existed, is given the last mission', () => {
    const old = { ...afterFinale(), finale: undefined, ended: 'delegation' } as CampaignState;
    const s = migrateFinale(structuredClone(old));
    expect(s.finale).toBe('delegation');
    expect(s.ended).toBeNull();
    expect(targets(s).map((t) => t.id)).toEqual([LAST]);
    // One that has won the last mission stays over.
    const won = finish(s, plan(s, LAST), report(true)).state;
    expect(migrateFinale(structuredClone(won)).ended).toBe('delegation');
  });
});
