/**
 * The campaign's rules (src/meta): credits, the globe, pushback, factions,
 * experiments, purchases, the ship AI wiring. Runs are faked with RunReports.
 */
import { describe, expect, it } from 'vitest';
import {
  ally, buyLineage, choose, evolutionCaps, finish, newCampaign, perksOf, plan, selectProfile, targets, territory,
  type CampaignState,
} from '../src/meta/campaign';
import { evaluate, instance, measure, type RunReport } from '../src/meta/goals';
import { ScriptedShipAi, seedFor } from '../src/meta/shipAi';
import { DARES, FACTIONS, HOME, LINEAGES, TERRITORIES } from '../content/campaign';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import type { RunStats } from '../src/sim/types';
import { readFileSync } from 'node:fs';

const blankStats = (): RunStats => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});
const report = (won: boolean, stats: Partial<RunStats> = {}): RunReport => ({
  won, wavesCleared: 6, coreEndFrac: 0.8, scienceBanked: 0, stats: { ...blankStats(), ...stats },
});
/** Win a deployment at a target territory (the first on offer if none given). */
const winAt = (s: CampaignState, id?: string, r: RunReport = report(true)) => {
  const to = id ?? targets(s)[0].id;
  return finish(s, plan(s, to), r).state;
};

describe('the campaign: credits, the globe, pushback', () => {
  it('starts at the crash site with the starting lineages and the Standard Strain', () => {
    const s = newCampaign(1);
    expect(s.held).toEqual([HOME]);
    expect(s.lineages.sort()).toEqual(['bladder', 'forge', 'gut', 'heart', 'root']);
    expect(s.profile).toBe('standard');
    // You land next to what you hold; hidden and finale territories are not on offer.
    const t = targets(s).map((x) => x.id);
    expect(t.sort()).toEqual([...territory(HOME).neighbours].sort());
  });

  it('a deployment plan carries the campaign into the run: pool, profile, caps, hidden intel, the board', () => {
    const s = newCampaign(2);
    const p = plan(s, 'cul-de-sac', { dares: ['forest', 'zoo', 'pacifist'] });
    expect(p.config.organStage).toBe(true);
    expect(p.config.organPool).toContain('gut');
    expect(p.config.startOrgans).toEqual(['gut', 'forge']);
    expect(p.config.waveIntel).toBe('hidden');
    expect(p.config.evolutionCap?.core).toBe(2); // the crash site unlocks core stage 2
    expect(p.config.evolutionCap?.forge).toBe(1);
    expect(p.board.length).toBe(3);
    expect(p.dares.length).toBe(2); // two dares at most
    // Seeded: backing out and coming back gives the same board.
    expect(plan(s, 'cul-de-sac').board.map((g) => g.def.id)).toEqual(p.board.map((g) => g.def.id));
  });

  it('goals pay: board goals in standing, dares in field notes; a capture unlocks its evolution stages', () => {
    const s = newCampaign(3);
    const p = plan(s, 'granary', { dares: ['forest'] });
    const stats: Partial<RunStats> = { maxLimbs: 45 };
    // Make every board goal met by a generous report.
    for (const g of p.board) {
      const [k, a] = g.def.measure.split(':');
      if (k === 'kills') stats.kills = { ...(stats.kills ?? {}), [a === 'any' ? 'militia' : a]: 9999 };
      if (k === 'stat' && a !== 'limbsLost' && a !== 'scienceBanked') (stats as Record<string, number>)[a] = 9999;
    }
    const r = { ...report(true, stats), scienceBanked: 9999 };
    const { state, debrief } = finish(s, p, r);
    expect(debrief.dares[0].met).toBe(true);
    expect(debrief.notes).toBe(2);
    expect(debrief.standing).toBe(debrief.board.filter((g) => g.met).reduce((a, g) => a + g.def.pays, 0));
    expect(debrief.captured).toBe('granary');
    expect(state.held).toContain('granary');
    expect(evolutionCaps(state).forge).toBe(2);
    expect(evolutionCaps(state).cage).toBe(2);
  });

  it('pushback: after two captures the colony counter-attacks; defend it or deploy elsewhere and lose it', () => {
    let s = newCampaign(4);
    s = winAt(s, 'cul-de-sac');
    s = winAt(s, 'granary');
    expect(s.underAttack).not.toBeNull();
    const attacked = s.underAttack!;
    // Deploy elsewhere: the attacked territory falls.
    const other = targets(s).find((t) => t.id !== attacked)!;
    const { state, debrief } = finish(s, plan(s, other.id), report(true));
    expect(debrief.lost).toBe(attacked);
    expect(state.held).not.toContain(attacked);
    // Or defend it: a defence deployment keeps it.
    let d = winAt(newCampaign(4), 'cul-de-sac');
    d = winAt(d, 'granary');
    const def = plan(d, d.underAttack!);
    expect(def.defence).toBe(true);
    expect(def.config.directive).toEqual({ kind: 'hold', waves: 5 });
    const after = finish(d, def, report(true));
    expect(after.debrief.repelled).toBe(d.underAttack);
    expect(after.state.held).toContain(d.underAttack);
  });

  it('experiments: they change the run and unlock things (Love Gas → the Atrophy Gland)', () => {
    let s = winAt(newCampaign(5), 'cul-de-sac');
    const p = plan(s, targets(s)[0].id, { experiment: 'love-gas' });
    expect(p.config.matingMusk).toBe(true);
    const { state, debrief } = finish(s, p, report(true, { matingStuns: 40 }));
    expect(debrief.experiment?.met).toBe(true);
    expect(state.lineages).toContain('atrophy');
    expect(state.experimentsDone).toContain('love-gas');
    s = state;
    expect(plan(s, targets(s)[0].id, { experiment: 'love-gas' }).config.matingMusk).toBe(true); // re-runnable, no new unlock
  });

  it('the ship: buy lineages with the right credit; profiles need unlocking', () => {
    let s = newCampaign(6);
    expect(buyLineage(s, 'venom').err).toBe('not enough standing');
    s = { ...s, standing: 10, notes: 10 };
    const r = buyLineage(s, 'venom');
    expect(r.ok).toBe(true);
    expect(r.state.standing).toBe(10 - LINEAGES.venom!.price);
    const u = buyLineage(r.state, 'marrow');
    expect(u.state.notes).toBe(10 - LINEAGES.marrow!.price);
    expect(selectProfile(s, 'spore').profile).toBe('standard'); // locked
  });
});

describe('the factions: contact, beats, perks, the finale', () => {
  it('each faction reaches out at its point; allying is exclusive; its route plays out to its ending', () => {
    let s = newCampaign(7);
    s = winAt(s, 'cul-de-sac');
    expect(s.pendingScenes.some((p) => p.contact && p.faction === 'delegation')).toBe(true);
    s = ally(s, 'delegation');
    expect(s.faction).toBe('delegation');
    expect(perksOf(s)).toContain('objectors1');
    expect(ally(s, 'institute').faction).toBe('delegation'); // exclusive
    // Objectors let you ban a kind; the Translator (next beat) shows the waves.
    expect(plan(s, targets(s)[0].id, { objectors: ['flier', 'sapper'] }).config.bannedEnemies).toEqual(['flier']);
    s = winAt(s);
    expect(perksOf(s)).toContain('translator');
    expect(plan(s, targets(s)[0].id).config.waveIntel).toBe('full');
    // March toward the finale's door (the Ossuary Coast), defending when attacked, like a player would.
    const path = ['harbor', 'ossuary', 'temple', 'granary', 'mirewater'];
    for (let i = 0; i < 20 && !targets(s).some((t) => t.finaleOf === 'delegation'); i++) {
      if (s.underAttack) { s = finish(s, plan(s, s.underAttack), report(true)).state; continue; }
      const next = path.find((id) => targets(s).some((t) => t.id === id)) ?? targets(s).find((t) => !t.finaleOf)!.id;
      s = winAt(s, next);
    }
    expect(s.beatsSeen).toContain('reveal');
    expect(s.pendingScenes.some((p) => p.beat === 'reveal' && p.scene.lines.some((l) => l.includes('nobody\'s perfect')))).toBe(true);
    expect(s.ai.queue).toContain('midpoint');
    const finale = targets(s).find((t) => t.finaleOf === 'delegation');
    expect(finale?.id).toBe('assembly');
    s = finish(s, plan(s, 'assembly'), report(true)).state;
    expect(s.ended).toBe('delegation');
    expect(s.pendingScenes.some((p) => p.scene.title === 'Bear Witness')).toBe(true);
    expect(targets(s)).toEqual([]);
  });

  it('the Institute: Volunteers start runs with science, Seed Labs lifts adjacency, the ultimatum is a choice', () => {
    let s = newCampaign(8);
    s = winAt(s); s = winAt(s); s = winAt(s);
    expect(s.contacted).toContain('institute');
    s = ally(s, 'institute');
    expect(plan(s, targets(s)[0].id).config.startBonus).toMatchObject({ science: 30 });
    for (let i = 0; i < 4 && !perksOf(s).includes('seedlabs'); i++) {
      s = s.underAttack ? finish(s, plan(s, s.underAttack), report(true)).state : winAt(s, targets(s).find((t) => !t.finaleOf)!.id);
    }
    expect(perksOf(s)).toContain('seedlabs');
    const far = TERRITORIES.find((t) => !t.hidden && !t.finaleOf && !s.held.includes(t.id) && !t.neighbours.some((n) => s.held.includes(n)));
    if (far) expect(targets(s).map((t) => t.id)).toContain(far.id);
    for (let i = 0; i < 8 && !s.beatsSeen.includes('ultimatum'); i++) s = s.underAttack ? finish(s, plan(s, s.underAttack), report(true)).state : winAt(s, targets(s).find((t) => !t.finaleOf)!.id);
    const ult = s.pendingScenes.find((p) => p.beat === 'ultimatum');
    expect(ult?.choice?.options.length).toBe(2);
    s = choose(s, 'ultimatum', 'pacify');
    expect(s.choices.ultimatum).toBe('pacify');
  });

  it('the Faithful: the Garrison repels pushback; Sleepers ride in the enemy waves', () => {
    let s = newCampaign(9);
    s = winAt(s); s = winAt(s);
    s = s.underAttack ? finish(s, plan(s, s.underAttack), report(true)).state : s;
    s = ally(s, 'faithful');
    expect(plan(s, targets(s)[0].id).config.sleepers).toBeGreaterThan(0);
    s = winAt(s);
    expect(perksOf(s)).toContain('garrison');
    s = winAt(s);
    expect(s.underAttack).toBeNull();
    expect(s.log.some((l) => l.includes('militants held'))).toBe(true);
  });
});

describe('goals and the ship AI wiring', () => {
  it('measures read the run; dares with needsWin fail a loss', () => {
    const r = report(true, { lastWaveKillsByCause: { creep: 9 }, families: ['spitter'] });
    expect(measure('lastWaveCreepOnly', r)).toBe(1);
    expect(measure('only:spitter', r)).toBe(1);
    const d = DARES.find((x) => x.id === 'only-spitters')!;
    expect(evaluate([instance(d, 0)], { ...r, won: false })[0].met).toBe(false);
  });

  it('every territory, faction and experiment points at things that exist', () => {
    for (const t of TERRITORIES) for (const n of t.neighbours) expect(TERRITORIES.some((x) => x.id === n), `${t.id}→${n}`).toBe(true);
    for (const f of FACTIONS) expect(TERRITORIES.some((t) => t.id === f.finale && t.finaleOf === f.id)).toBe(true);
    // Every theme's stages 2 and 3 are reachable somewhere on the globe (outside the finales).
    const themes = ['core', 'forge', 'venom', 'gut', 'nerve', 'lattice', 'womb', 'marrow', 'resonance', 'catapult', 'runner', 'cage'];
    for (const th of themes) {
      for (const st of [2, 3]) expect(TERRITORIES.some((t) => !t.finaleOf && t.unlocks.some((u) => u.theme === th && u.stage === st)), `${th} ${st}`).toBe(true);
    }
  });

  it('a campaign plan runs in the real sim (config accepted)', () => {
    const s = newCampaign(10);
    const p = plan(s, 'cul-de-sac');
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 1, ...p.config });
    expect(sim.organs.map((o) => o.organ).sort()).toEqual(['forge', 'gut']);
    expect(sim.waveIntelHidden).toBe(true);
  });

  it('the ship AI: triggers queue discussions; the scripted provider plays the lore book\'s seeds', async () => {
    const s = winAt(newCampaign(11));
    expect(s.ai.queue).toContain('first-deployment');
    const lore = readFileSync('content/lore/ship-ai-lorebook.md', 'utf8');
    expect(seedFor(lore, 'first-deployment')).toMatch(/telemetry/);
    const ai = new ScriptedShipAi();
    const first = await ai.reply({ trigger: 'first-deployment', summary: '', lore }, []);
    expect(first[0]).toMatch(/telemetry/);
    const second = await ai.reply({ trigger: 'first-deployment', summary: '', lore }, [{ speaker: 'YOKE', text: first[0] }], 'I do not.');
    expect(second[0]).toMatch(/logged/);
  });

  it('a real deployment: the scripted player plays a campaign plan to the end and the campaign takes the result', () => {
    const c = newCampaign(12);
    const p = plan(c, 'cul-de-sac', { dares: ['zoo'] });
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 1, ...p.config });
    const auto = new Autoplayer(3);
    for (let i = 0; i < 20000 && sim.outcome === 'playing'; i++) { auto.act(sim, DT); sim.tick(); sim.takeEvents(); }
    expect(sim.outcome).not.toBe('playing');
    // Only pooled or profile organs were grown; no limb evolved past its cap.
    for (const o of sim.organs) expect([...(p.config.organPool ?? []), ...(p.config.startOrgans ?? [])]).toContain(o.organ);
    for (const t of sim.towers) expect((t.upgrades ?? []).length).toBeLessThanOrEqual(sim.evolutionCapOf(t.family));
    const { state, debrief } = finish(c, p, {
      won: sim.outcome === 'won', wavesCleared: sim.wavesCleared, coreEndFrac: Math.max(0, sim.coreHp / sim.coreMaxHp),
      scienceBanked: sim.scienceBanked, stats: sim.stats,
    });
    expect(debrief.board.length).toBe(3);
    expect(state.deployments).toBe(1);
    expect(sim.stats.limbsGrown).toBeGreaterThan(0);
  });
});
