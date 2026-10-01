/**
 * Defence deployments (src/meta/defence.ts, src/sim/boardSnapshot.ts; DESIGN.md "Defence deployments"):
 * the warning always comes a whole deployment ahead, striking the staging ground first calls it off,
 * the board won on is remembered and a defence opens on it, older saves are staged again.
 */
import { describe, expect, it } from 'vitest';
import { finish, newCampaign, plan, targets, type CampaignState } from '../src/meta/campaign';
import type { RunReport } from '../src/meta/goals';
import { migrateDefence, stagingGrounds } from '../src/meta/defence';
import { restoreMap, snapshotBoard, validSnapshot } from '../src/sim/boardSnapshot';
import { CellType, frontierGates } from '../src/sim/citymap';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { coreStageOf } from '../src/render/coreStage';
import { DEFENCE } from '../content/defence';
import { TERRITORIES } from '../content/campaign';
import type { RunStats, SimConfig } from '../src/sim/types';

const report = (won: boolean, board?: RunReport['board']): RunReport => ({
  won, wavesCleared: 6, coreEndFrac: 0.8, scienceBanked: 0, board,
  stats: {
    kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
    cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
    families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
    gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
  } as RunStats,
});
const go = (s: CampaignState, to: string, won = true, board?: RunReport['board']) => finish(s, plan(s, to), report(won, board));
/** A landing site that is neither the staging ground nor under attack. */
const elsewhere = (s: CampaignState) => (targets(s).find((t) => t.id !== s.staging?.from && !t.finaleOf) ?? targets(s)[0])?.id;
/** A campaign with a counter-attack just staged. */
function staged(seed: number): CampaignState {
  let s = newCampaign(seed);
  for (let i = 0; i < 8 && !s.staging; i++) s = go(s, s.underAttack ?? elsewhere(s)).state;
  expect(s.staging).toBeTruthy();
  return s;
}

describe('the warning comes a whole deployment ahead', () => {
  it('a capture stages a counter-attack from a neighbouring ground he could land on; nothing is under attack yet', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = staged(seed);
      const st = s.staging!;
      expect(s.underAttack).toBeNull();
      expect(s.held).toContain(st.target);
      expect(s.held).not.toContain(st.from);
      expect(TERRITORIES.find((t) => t.id === st.target)!.neighbours).toContain(st.from);
      expect(targets(s).map((t) => t.id)).toContain(st.from);
      // He can't defend what has not come: there is no defence to deploy to.
      expect(plan(s, st.target).defence).toBe(false);
    }
  });

  it('never a defence without a warning: over long campaigns every attack was staged the deployment before', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let s = newCampaign(seed);
      for (let i = 0; i < 30 && !s.ended; i++) {
        const before = s;
        const to = s.underAttack ?? (i % 3 === 0 && s.staging ? s.staging.from : elsewhere(s));
        if (!to) break;
        const next = go(s, to, i % 5 !== 4).state;
        if (next.underAttack && next.underAttack !== before.underAttack) {
          expect(before.staging?.target).toBe(next.underAttack);
          expect(next.attackFrom).toBe(before.staging?.from);
        }
        s = next;
      }
    }
  });
});

describe('strike first', () => {
  it('taking the staging ground calls the counter-attack off (and the debrief says so)', () => {
    const s = staged(3);
    const st = s.staging!;
    const { state, debrief } = go(s, st.from);
    expect(debrief.preempted).toEqual(st);
    expect(state.staging).toBeNull();
    expect(state.underAttack).toBeNull();
    expect(state.held).toContain(st.from);
    expect(state.held).toContain(st.target);
  });

  it('ignoring it (or losing the strike) launches it; the next deployment is the defence or the ground falls', () => {
    const s = staged(5);
    const st = s.staging!;
    const ignored = go(s, elsewhere(s));
    expect(ignored.debrief.launched).toEqual(st);
    expect(ignored.state.underAttack).toBe(st.target);
    expect(ignored.state.attackFrom).toBe(st.from);
    const failed = go(s, st.from, false);
    expect(failed.state.underAttack).toBe(st.target);
    // Then: defend, or lose it.
    const d = plan(ignored.state, st.target);
    expect(d.defence).toBe(true);
    const held = finish(ignored.state, d, report(true));
    expect(held.debrief.repelled).toBe(st.target);
    expect(held.state.underAttack).toBeNull();
    expect(held.state.attackFrom).toBeNull();
    const fell = go(ignored.state, elsewhere(ignored.state));
    expect(fell.debrief.lost).toBe(st.target);
  });
});

describe('the defence deployment', () => {
  it('one all-out siege, the core at stage 3, a full larder, longer to re-arm', () => {
    let s = staged(7);
    const target = s.staging!.target;
    s = go(s, elsewhere(s)).state;
    const p = plan(s, target);
    expect(p.defence).toBe(true);
    expect(p.config.directive).toEqual({ kind: 'hold', waves: 1 });
    expect(p.config.coreStage).toBe(3);
    expect(p.config.oneWave).toEqual({ asWave: DEFENCE.asWave, minTier: DEFENCE.minTier, armSeconds: DEFENCE.armSeconds, lanes: DEFENCE.lanes });
    expect(p.config.startBonus?.war).toBeGreaterThanOrEqual(DEFENCE.meat.war);
    // No board remembered for it (the reports above carried none): a large city, grown before the run.
    expect(p.config.board).toBeUndefined();
    expect(p.config.gridW).toBe(DEFENCE.large.gridW);
    expect(p.config.pregrown).toBe(DEFENCE.large.districts);
    expect(coreStageOf(0, p.config.coreStage)).toBe(3);
  });

  it('the large fallback city: core in the middle, districts grown by the algebra, openings meet openings, gates to come from', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sim = new Sim({ gridW: DEFENCE.large.gridW, gridH: DEFENCE.large.gridH, cellPx: 26, seed, pregrown: DEFENCE.large.districts, organStage: true });
      const m = sim.map;
      const slotX = Math.floor((m.coreCell % m.w) / 10);
      const slotY = Math.floor(Math.floor(m.coreCell / m.w) / 10);
      expect([slotX, slotY]).toEqual([Math.floor(m.slotsX / 2), Math.floor((m.slotsY - 1) / 2)]);
      // Grown as far as asked (the fullest of a few growths: one can wall itself in early).
      expect(m.slots.filter(Boolean).length).toBeGreaterThanOrEqual(DEFENCE.large.districts);
      expect(frontierGates(m).length).toBeGreaterThan(0);
      // Every neighbouring pair of districts agrees on its shared edge (the connection algebra).
      for (let i = 0; i < m.slots.length; i++) {
        const a = m.slots[i];
        if (!a) continue;
        const e = i % m.slotsX < m.slotsX - 1 ? m.slots[i + 1] : null;
        if (e) expect(a.pattern.ports.e).toBe(e.pattern.ports.w);
        const so = i + m.slotsX < m.slots.length ? m.slots[i + m.slotsX] : null;
        if (so) expect(a.pattern.ports.s).toBe(so.pattern.ports.n);
      }
    }
  });
});

describe('the board won on is remembered', () => {
  /** A real run, played by the scripted player until a few districts and organs are down. */
  function grown(seed: number): Sim {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed, directive: { kind: 'hold', waves: 12 }, organStage: true, startOrgans: ['heart'] });
    const bot = new Autoplayer(seed + 1);
    for (let t = 0; t < 9000 && sim.outcome === 'playing'; t++) { bot.act(sim, DT); sim.tick(); }
    return sim;
  }

  it('snapshot → restore gives the same city, and the organs grow back where they were', () => {
    const a = grown(4);
    const snap = a.snapshot();
    expect(validSnapshot(snap)).toBe(true);
    expect(JSON.stringify(snap).length).toBeLessThan(6000);
    const map = restoreMap(snap);
    expect(map.coreCell).toBe(a.map.coreCell);
    expect(map.slots.filter(Boolean).length).toBe(a.map.slots.filter(Boolean).length);
    for (let i = 0; i < map.cells.length; i++) {
      expect(map.cells[i]).toBe(a.map.cells[i]);
      if (map.cells[i] === CellType.Block) expect(map.heights[i]).toBe(a.map.heights[i] - a.map.plinths[i]);
    }
    expect(frontierGates(map)).toEqual(frontierGates(a.map));
    // A new run on it (a different run seed): the same board, the same organs at their levels.
    const b = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 999, organStage: true, board: snap, startOrgans: ['heart'] });
    expect(b.map.cells).toEqual(map.cells);
    expect(b.organs.map((o) => [o.organ, o.cell, o.rot, o.level])).toEqual(a.organs.map((o) => [o.organ, o.cell, o.rot, o.level]));
    expect(b.coreLevel).toBe(a.coreLevel);
    // Snapshot of the restored board is the same snapshot.
    expect(snapshotBoard(b.map, b.underSeed, b.organs, b.coreLevel)).toEqual(snap);
  });

  it('a win keeps its board in the save; a defence there opens on it; a damaged one is not trusted', () => {
    let s = newCampaign(6);
    const board = grown(6).snapshot();
    // Win every deployment with that board until a counter-attack lands on ground that has it.
    for (let i = 0; i < 12 && !(s.underAttack && s.boards?.[s.underAttack]); i++) s = go(s, s.underAttack ?? elsewhere(s), true, board).state;
    expect(s.underAttack).toBeTruthy();
    const p = plan(s, s.underAttack!);
    expect(p.config.board).toEqual(board);
    expect(p.config.gridW).toBe(board.w);
    expect(p.config.pregrown).toBeUndefined();
    const broken = { ...s, boards: { ...s.boards, [s.underAttack!]: { ...board, cells: 'nope' } } };
    expect(plan(broken, s.underAttack!).config.board).toBeUndefined();
  });

  it('a lost territory forgets its board', () => {
    let s = staged(9);
    const target = s.staging!.target;
    s = { ...s, boards: { [target]: grown(2).snapshot() } };
    s = go(s, elsewhere(s)).state; // launched
    s = go(s, elsewhere(s)).state; // ignored: it falls
    expect(s.held).not.toContain(target);
    expect(s.boards?.[target]).toBeUndefined();
  });
});

describe('old saves', () => {
  it('a counter-attack launched with no warning is staged again from a neighbouring ground', () => {
    const s = staged(2);
    const st = s.staging!;
    const old = { ...structuredClone(s), underAttack: st.target } as CampaignState;
    delete (old as Partial<CampaignState>).staging;
    delete (old as Partial<CampaignState>).attackFrom;
    migrateDefence(old);
    expect(old.underAttack).toBeNull();
    expect(old.staging?.target).toBe(st.target);
    expect(stagingGrounds(old, st.target)).toContain(old.staging!.from);
  });

  it('a save with nothing under attack is left alone', () => {
    const s = newCampaign(1);
    const copy = structuredClone(s);
    migrateDefence(copy);
    expect(copy).toEqual(s);
  });
});

describe('the sim side', () => {
  it('one wave only: the hold directive is met after one cleared siege, sized like a late wave', () => {
    const cfg: SimConfig = {
      gridW: 50, gridH: 40, cellPx: 26, seed: 3, organStage: true, directive: { kind: 'hold', waves: 1 },
      oneWave: { asWave: DEFENCE.asWave, minTier: DEFENCE.minTier, armSeconds: DEFENCE.armSeconds }, startBonus: { war: 2000 },
    };
    const sim = new Sim(cfg);
    expect(sim.tier).toBeGreaterThanOrEqual(DEFENCE.minTier);
    expect(sim.growthLength).toBe(DEFENCE.armSeconds);
    const plain = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 3, organStage: true });
    const big = Object.values(sim.previewNextWave()).reduce((a, n) => a + (n ?? 0), 0);
    const first = Object.values(plain.previewNextWave()).reduce((a, n) => a + (n ?? 0), 0);
    expect(big).toBeGreaterThan(first * 3);
  });
});
