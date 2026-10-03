/**
 * The campaign's rules (src/meta): credits, the globe, pushback, factions,
 * experiments, purchases, the ship AI wiring. Runs are faked with RunReports.
 */
import { describe, expect, it } from 'vitest';
import {
  ally, buyLineage, evolutionCaps, finish, meet, newCampaign, objectorPool, perksOf, plan, selectProfile, summaryFor, targets, territory,
  type CampaignState,
} from '../src/meta/campaign';
import { evaluate, instance, measure, type RunReport } from '../src/meta/goals';
import { ScriptedShipAi, seedFor } from '../src/meta/shipAi';
import { DARES, FACTIONS, HOME, LINEAGES, TERRITORIES } from '../content/campaign';
import { ENEMIES, WAVE_TABLE } from '../content/data';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import type { RunStats } from '../src/sim/types';
import { existsSync, readFileSync } from 'node:fs';
import { scenesOf } from '../content/media';

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

  it('pushback: after two captures the colony masses (a deployment ahead), then attacks; defend it or deploy elsewhere and lose it', () => {
    let s = newCampaign(4);
    s = winAt(s, 'cul-de-sac');
    s = winAt(s, 'granary');
    // Staged, not launched: nothing to defend yet (src/meta/defence.ts; tests/defence.test.ts has the rest).
    expect(s.underAttack).toBeNull();
    expect(s.staging).not.toBeNull();
    const attacked = s.staging!.target;
    const away = (x: CampaignState) => targets(x).find((t) => t.id !== x.staging?.from && t.id !== x.underAttack && !t.finaleOf)!.id;
    s = winAt(s, away(s));
    expect(s.underAttack).toBe(attacked);
    // Deploy elsewhere: the attacked territory falls.
    const { state, debrief } = finish(s, plan(s, away(s)), report(true));
    expect(debrief.lost).toBe(attacked);
    expect(state.held).not.toContain(attacked);
    // Or defend it: a defence deployment keeps it.
    const def = plan(s, s.underAttack!);
    expect(def.defence).toBe(true);
    expect(def.config.directive).toEqual({ kind: 'hold', waves: 1 });
    const after = finish(s, def, report(true));
    expect(after.debrief.repelled).toBe(attacked);
    expect(after.state.held).toContain(attacked);
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
  it('all three reach out as signals; a first contact can be played before siding; siding is public and exclusive; the route plays out to its finale', () => {
    let s = newCampaign(7);
    s = winAt(s, 'cul-de-sac');
    // All three reach out at once; none of them is a call any more: they are signals on the planet at the desk.
    expect([...s.contacted].sort()).toEqual(['delegation', 'faithful', 'institute']);
    expect(s.pendingScenes).toEqual([]);
    // He can play any group's first interaction before siding with anyone (Collins, Oct 3 2026): no perk comes of it.
    s = meet(s, 'faithful');
    expect(s.faction).toBeNull();
    expect(s.pendingScenes[0]).toMatchObject({ faction: 'faithful', beat: 'signs', meeting: true });
    expect(perksOf(s)).toEqual([]);
    s = meet(s, 'delegation');
    expect(s.pendingScenes.filter((p) => p.meeting).map((p) => p.faction)).toEqual(['delegation']); // one first contact up at a time
    expect(s.met).toEqual(['faithful', 'delegation']);
    // Siding with one is public: his broadcast to the planet plays; the first interaction he has played is not played twice.
    s = ally(s, 'delegation');
    expect(s.faction).toBe('delegation');
    expect(s.pendingScenes.map((p) => p.scene.title)).toEqual(['We Come in Peace']);
    expect(s.pendingScenes[0].pledge).toBe(true);
    expect(perksOf(s)).toContain('objectors1');
    expect(ally(s, 'institute').faction).toBe('delegation'); // exclusive
    expect(meet(s, 'institute').pendingScenes.some((p) => p.meeting)).toBe(false); // the others are not answered after that
    // Siding with a group he has not answered yet plays its first interaction first, then the broadcast.
    const cold = ally(winAt(newCampaign(7), 'cul-de-sac'), 'institute');
    expect(cold.pendingScenes.map((p) => p.scene.title)).toEqual(['A Little Chat', 'For Your Own Safety']);
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
    expect(s.pendingScenes.some((p) => p.beat === 'reveal' && p.scene.lines.some((l) => l.includes('that is a relief to hear')))).toBe(true);
    expect(perksOf(s)).toContain('objectors2');
    expect(s.ai.queue).toContain('midpoint');
    const finale = targets(s).find((t) => t.finaleOf === 'delegation');
    expect(finale?.id).toBe('assembly');
    s = finish(s, plan(s, 'assembly'), report(true)).state;
    expect(s.ended).toBe('delegation');
    // The finale is the ending and the reveal in one scene: nothing comes after it.
    const titles = s.pendingScenes.map((p) => p.scene.title);
    expect(titles[titles.length - 1]).toBe('The Cycle');
    expect(targets(s)).toEqual([]);
  });

  it('the Institute: Volunteers start runs with science, Seed Labs lifts adjacency, and the last beat is no longer a choice', () => {
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
    // Collins's script of Oct 3 2026: he asks to rule what is left AND offers to recruit, in one breath; nothing is chosen.
    const ult = s.pendingScenes.find((p) => p.beat === 'ultimatum');
    expect(ult).toBeTruthy();
    expect(ult?.choice).toBeUndefined();
    expect(perksOf(s)).toContain('volunteers2');
    expect(plan(s, targets(s).find((t) => !t.finaleOf)!.id).config.startBonus).toMatchObject({ science: 30, war: 40, royal: 1 });
    for (const f of FACTIONS) for (const b of f.beats) expect(b.choice, `${f.id} ${b.id}`).toBeUndefined();
  });

  it('the Objectors pick from the kinds a mission would bring, not from every kind there is (Collins, Oct 3 2026)', () => {
    const war = new Set(ENEMIES.filter((e) => e.caste === 'war').map((e) => e.kind as string));
    for (const t of TERRITORIES) {
      const pool = objectorPool(t.id);
      expect(pool.length, t.id).toBeGreaterThan(0);
      for (const k of pool) expect(war.has(k), `${t.id}: ${k}`).toBe(true);
      expect(new Set(pool).size).toBe(pool.length);
    }
    // A short hold never offers what only the late rows of the wave table field; a long one offers more.
    const short = objectorPool('crash-site');
    const long = objectorPool('queens-hollow');
    expect(short).not.toContain('tunneler');
    expect(short).toContain('responder');
    expect(long.length).toBeGreaterThan(short.length);
    expect(long).toEqual(expect.arrayContaining(Object.keys(WAVE_TABLE[WAVE_TABLE.length - 1]).filter((k) => war.has(k))));
    // A defence is one all-out siege: everything may come.
    expect(objectorPool('crash-site', true).length).toBeGreaterThanOrEqual(long.length);
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

describe('the factions keep in touch, and choices change the route (audit, Sep 28 2026)', () => {
  const march = (s: CampaignState, until: (s: CampaignState) => boolean, max = 12) => {
    for (let i = 0; i < max && !until(s); i++) {
      s = s.underAttack ? finish(s, plan(s, s.underAttack), report(true)).state : winAt(s, targets(s).find((t) => !t.finaleOf)!.id);
    }
    return s;
  };

  it('the Delegation reaches "the greater plan" before "nobody\'s perfect", and writes between beats', () => {
    let s = newCampaign(7);
    s = winAt(s, 'cul-de-sac');
    s = ally(s, 'delegation');
    s = march(s, (x) => x.beatsSeen.includes('reveal'));
    expect(s.beatsSeen.indexOf('gaia')).toBeGreaterThan(-1);
    expect(s.beatsSeen.indexOf('gaia')).toBeLessThan(s.beatsSeen.indexOf('reveal'));
    const gaia = FACTIONS[0].beats.find((b) => b.id === 'gaia')!;
    expect(gaia.scene.lines.join(' ')).toMatch(/You came to save the planet from our exploitative species/);
    expect((s.comms ?? []).length).toBeGreaterThanOrEqual(3);
    expect(s.comms!.every((l) => FACTIONS[0].asides.includes(l))).toBe(true);
    // The debrief carries the latest one, and YOKE's summary knows it.
    const d = finish(s, plan(s, s.underAttack ?? targets(s).find((t) => !t.finaleOf)!.id), report(true)).debrief;
    expect(FACTIONS[0].asides).toContain(d.aside);
    expect(summaryFor(s)).toMatch(/Latest from the ally/);
  });

  it('every faction has running jokes; the Institute\'s include the game, the females and the Director by name', () => {
    for (const f of FACTIONS) expect(f.asides.length).toBeGreaterThanOrEqual(5);
    const inst = FACTIONS.find((f) => f.id === 'institute')!;
    const all = inst.asides.join(' ');
    expect(all).toMatch(/League of Larvae|mid-match/);
    expect(all).toMatch(/females/);
    expect(inst.contact.lines.join(' ')).toMatch(/Eli Bankfried/);
  });

  it('a smaller wave scale really sends fewer bodies (the sim reads waveScale; no perk sets it since Oct 3 2026)', () => {
    const count = (waveScale: number) => {
      const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 5000, waveScale });
      const next = sim.previewNextWave();
      return Object.values(next).reduce((a, n) => a + (n ?? 0), 0);
    };
    expect(count(0.9)).toBeLessThan(count(1));
  });
});

describe('how the factions reach him, and the picture of every scene', () => {
  /** Every filmed scene of every faction, with the id its film has to have. */
  const scenes = FACTIONS.flatMap((f) => [
    ...f.beats.map((b) => ({ id: `${f.id}-${b.id}`, scene: b.scene })),
    { id: `${f.id}-pledge`, scene: f.pledge },
    { id: `${f.id}-finale`, scene: f.ending },
  ]);

  it('every beat, pledge and finale names its own film, <faction>-<scene> (Collins, Oct 3 2026: videos for all of them)', () => {
    expect(scenes.length).toBe(16);
    for (const s of scenes) expect(s.scene.film).toBe(s.id);
  });

  it('every picture a scene still names is in the manifest and on disk', () => {
    const listed = JSON.parse(readFileSync('public/art/manifest.json', 'utf8')).ship?.ship?.scenes ?? {};
    for (const f of FACTIONS) for (const sc of scenesOf(f)) {
      if (!sc.picture) continue;
      expect(listed[sc.picture], `${sc.picture} in the manifest`).toBe(`ship/scenes/${sc.picture}.webp`);
      expect(existsSync(`public/art/${listed[sc.picture]}`), `${sc.picture} on disk`).toBe(true);
    }
  });

  it('he is in orbit: each group reaches him in its own way, and on the planet he is a hologram', () => {
    const by = (id: string) => FACTIONS.find((f) => f.id === id)!;
    expect(by('delegation').contact.title).toBe('Coloured Cards in a Field');
    expect(by('faithful').contact.title).toBe('A Sermon on Every Station');
    expect(by('institute').contact.title).toBe('A Laser on the Hull');
    // Collins, Oct 3 2026: 11,000 members spell a letter with coloured cards in a field; a radio preacher; a laser whose
    // flashes decode as a video feed, answered with the matching sequence.
    expect(by('delegation').contact.lines.join(' ')).toMatch(/Eleven thousand of them are standing in a field, holding coloured cards/);
    expect(by('delegation').contact.lines.join(' ')).toMatch(/pilots have stopped flying/);
    expect(by('faithful').contact.lines.join(' ')).toMatch(/every station/);
    expect(by('faithful').contact.lines.join(' ')).toMatch(/you are the sign/);
    expect(by('institute').contact.lines.join(' ')).toMatch(/decodes as a video feed/);
    expect(by('institute').contact.lines.join(' ')).toMatch(/matching sequence back down the beam/);
    for (const f of FACTIONS) {
      // A signal's card is the ship's own words: no leader speaks on it (their first words are their first interaction).
      for (const l of f.contact.lines) expect(l, f.id).toMatch(/^(YOKE|You): /);
      expect(Math.abs(f.signal.lat)).toBeLessThan(80);
      expect(f.signal.how.length).toBeGreaterThan(5);
      // "You don't directly interact with anyone" (Collins, Oct 1 2026): where he stands before them, it is by hologram.
      expect(f.ending.lines.join(' '), `${f.id} finale`).toMatch(/hologram/);
      const all = [f.contact.title, ...f.contact.lines, ...f.asides].join(' ');
      expect(all).not.toMatch(/hand-delivered|by hand|\bpostman\b|\bcourier\b/i);
    }
    const scene = (f: string, b: string) => by(f).beats.find((x) => x.id === b)!.scene.lines.join(' ');
    expect(scene('delegation', 'understand')).toMatch(/\(by hologram/);
    expect(scene('faithful', 'signs')).toMatch(/hologram/);
    expect(scene('faithful', 'prophecy')).toMatch(/\(by hologram/);
    expect(scene('faithful', 'prepare')).toMatch(/\(by hologram/);
    // The Delegation call by video feed after the summit; the Director is on the laser's feed throughout.
    expect(scene('delegation', 'stop-war')).toMatch(/on a video feed/);
    // The letters stay letters; each says how it came.
    expect(by('delegation').asides.every((a) => a.startsWith('Delegate (letter, by field): '))).toBe(true);
    // Everything the Voice says to him between the scenes is said on the air.
    expect(by('faithful').asides.filter((a) => a.startsWith('The Voice')).every((a) => /^The Voice \((broadcast|to you, on the air)\): /.test(a))).toBe(true);
  });

  it('the finale (Collins, Oct 3 2026): the creep reaches them, they wake in the archive, and each takes it its own way', () => {
    const by = (id: string) => FACTIONS.find((f) => f.id === id)!.ending.lines.join(' ');
    // What absorption is, said in each: a simulation, digitised; and it would have been far easier to kill them.
    for (const f of FACTIONS) expect(by(f.id), f.id).toMatch(/simulation|digitis/);
    // The Delegation wanted the cycle ended, and get paradise.
    expect(by('delegation')).toMatch(/We thought you were going to end the cycle/);
    expect(by('delegation')).toMatch(/Why won't you just kill everyone\?/);
    expect(by('delegation')).toMatch(/That would be wildly unethical/);
    // The Faithful: heaven is a machine, and each thought the other was the one playing along.
    expect(by('faithful')).toMatch(/Heaven is not a simulation/);
    expect(by('faithful')).toMatch(/You do not get to choose the shape of God's miracles/);
    expect(by('faithful')).toMatch(/You thought I was just playing along this whole time\?/);
    // The Institute: the upload was real, he rules a simulation, and their Faith was right.
    expect(by('institute')).toMatch(/I created a simulation where you can do that/);
    expect(by('institute')).toMatch(/microwave your planet/);
    expect(by('institute')).toMatch(/Only independently evolved cultures and species have value/);
    expect(by('institute')).toMatch(/you don't even follow God/);
  });

  it('every line of every scene names its speaker', () => {
    for (const f of FACTIONS) for (const sc of scenesOf(f)) for (const l of sc.lines) expect(l, sc.title).toMatch(/^[^:]{2,40}: \S/);
  });
});
