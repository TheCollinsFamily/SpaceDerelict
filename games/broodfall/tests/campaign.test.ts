/**
 * The campaign's rules (src/meta): credits, the globe, pushback, factions,
 * experiments, purchases, the ship AI wiring. Runs are faked with RunReports.
 */
import { describe, expect, it } from 'vitest';
import {
  ally, buyLineage, choose, endingOf, evolutionCaps, finish, newCampaign, perksOf, plan, selectProfile, summaryFor, targets, territory,
  type CampaignState,
} from '../src/meta/campaign';
import { evaluate, instance, measure, type RunReport } from '../src/meta/goals';
import { ScriptedShipAi, seedFor } from '../src/meta/shipAi';
import { DARES, FACTIONS, HOME, LINEAGES, TERRITORIES } from '../content/campaign';
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
    // The reveal comes right after the ending.
    const titles = s.pendingScenes.map((p) => p.scene.title);
    expect(titles.indexOf('A Letter From the Other Side')).toBe(titles.indexOf('Bear Witness') + 1);
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

describe('the factions keep in touch, and choices change the route (audit, Sep 28 2026)', () => {
  const march = (s: CampaignState, until: (s: CampaignState) => boolean, max = 12) => {
    for (let i = 0; i < max && !until(s); i++) {
      s = s.underAttack ? finish(s, plan(s, s.underAttack), report(true)).state : winAt(s, targets(s).find((t) => !t.finaleOf)!.id);
    }
    return s;
  };

  it('the Delegation reaches "the greater plan" before the reveal, and writes between beats', () => {
    let s = newCampaign(7);
    s = winAt(s, 'cul-de-sac');
    s = ally(s, 'delegation');
    s = march(s, (x) => x.beatsSeen.includes('reveal'));
    expect(s.beatsSeen.indexOf('gaia')).toBeGreaterThan(-1);
    expect(s.beatsSeen.indexOf('gaia')).toBeLessThan(s.beatsSeen.indexOf('reveal'));
    const gaia = FACTIONS[0].beats.find((b) => b.id === 'gaia')!;
    expect(gaia.scene.lines.join(' ')).toMatch(/protecting the planet/);
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

  it('the ultimatum changes the route: "rule" funds a royal point, "pacify" shrinks the waves and changes the ending', () => {
    let s = newCampaign(8);
    s = winAt(s); s = winAt(s); s = winAt(s);
    s = ally(s, 'institute');
    s = march(s, (x) => x.beatsSeen.includes('ultimatum'));
    const t = () => targets(s).find((x) => !x.finaleOf)!.id;
    const before = plan(s, t()).config;
    expect(before.waveScale).toBe(1);
    const rule = choose(s, 'ultimatum', 'rule');
    expect(perksOf(rule)).toContain('kingdom');
    expect(plan(rule, t()).config.startBonus?.royal).toBe((before.startBonus?.royal ?? 0) + 1);
    const pac = choose(s, 'ultimatum', 'pacify');
    expect(perksOf(pac)).toContain('pacified');
    expect(plan(pac, t()).config.waveScale).toBe(0.9);
    const inst = FACTIONS.find((f) => f.id === 'institute')!;
    expect(endingOf(inst, pac).title).toBe('The Pacified Timeline');
    expect(endingOf(inst, rule).title).toBe(inst.ending.title);
  });

  it('Pacification really sends fewer bodies (the sim reads waveScale)', () => {
    const count = (waveScale: number) => {
      const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 5000, waveScale });
      const next = sim.previewNextWave();
      return Object.values(next).reduce((a, n) => a + (n ?? 0), 0);
    };
    expect(count(0.9)).toBeLessThan(count(1));
  });
});

describe('how the factions reach him, and the picture of every scene', () => {
  /** Every scene of every faction, with the id its picture has to have. */
  const scenes = FACTIONS.flatMap((f) => [
    { id: `${f.id}-contact`, scene: f.contact },
    ...f.beats.map((b) => ({ id: `${f.id}-${b.id}`, scene: b.scene })),
    { id: `${f.id}-ending`, scene: f.ending },
    ...Object.entries(f.endingByChoice?.scenes ?? {}).map(([choice, scene]) => ({ id: `${f.id}-ending-${choice}`, scene })),
  ]);

  it('every scene of every faction names its own picture, <faction>-<scene>', () => {
    expect(scenes.length).toBe(18);
    for (const s of scenes) expect(s.scene.picture).toBe(s.id);
  });

  it('every picture a scene names is in the manifest and on disk', () => {
    const listed = JSON.parse(readFileSync('public/art/manifest.json', 'utf8')).ship?.ship?.scenes ?? {};
    for (const s of scenes) {
      expect(listed[s.id], `${s.id} in the manifest`).toBe(`ship/scenes/${s.id}.webp`);
      expect(existsSync(`public/art/${listed[s.id]}`), `${s.id} on disk`).toBe(true);
    }
  });

  it('he is in orbit: each faction reaches him in its own way, and nobody hands him anything', () => {
    const by = (id: string) => FACTIONS.find((f) => f.id === id)!;
    expect(by('delegation').contact.title).toBe('A Letter, Written in the Crops');
    expect(by('faithful').contact.title).toBe('A Broadcast on Every Frequency');
    expect(by('institute').contact.title).toBe('A Laser on the Hull');
    // Collins, Oct 1 2026: crops (that embarrass YOKE), tens of thousands of stations in sync, a laser counting primes;
    // and "you don't directly interact with anyone": he never goes down; "in person" is by hologram (Collins, the same day).
    expect(by('delegation').contact.lines.join(' ')).toMatch(/wheat/);
    expect(by('delegation').contact.lines.some((l) => l.startsWith('YOKE: '))).toBe(true);
    expect(by('faithful').contact.lines.join(' ')).toMatch(/tens of thousands of radio stations/);
    expect(by('institute').contact.lines.join(' ')).toMatch(/primes/);
    for (const f of FACTIONS) {
      for (const sc of scenesOf(f)) {
        expect(sc.lines.join(' '), sc.title).not.toMatch(/coloured cards|forty stations|deep-space dish|video call/i);
        // Where he is present at a scene on the ground, he is there by hologram.
        for (const l of sc.lines.filter((x) => /^You: .*\b(attend|across the tea)\b/.test(x))) expect(l, sc.title).toMatch(/hologram/);
      }
    }
    const summit = by('delegation').beats.find((b) => b.id === 'understand')!.scene.lines.join(' ');
    expect(summit).toMatch(/\(by hologram[^)]*\) I will attend the summit/);
    expect(summit).toMatch(/You ate the summit/);
    for (const f of FACTIONS) {
      const all = [f.contact.title, ...f.contact.lines, ...f.asides].join(' ');
      expect(all).not.toMatch(/hand-delivered|by hand|\bpostman\b|\bcourier\b/i);
    }
    // The letters stay letters; each says how it came.
    expect(by('delegation').asides.every((a) => a.startsWith('Delegate (letter, by field): '))).toBe(true);
    expect(by('delegation').contact.lines.join(' ')).toMatch(/Dear Visitor/);
    expect(by('institute').contact.lines.join(' ')).toMatch(/laser/);
    // Everything the Voice says to him is said on the air.
    expect(by('faithful').asides.filter((a) => a.startsWith('The Voice')).every((a) => /^The Voice \((broadcast|to you, on the air)\): /.test(a))).toBe(true);
  });

  it('the reveal (DESIGN.md "The reveal"): every route ends on a card that says what absorption is, and each faction takes it its own way', () => {
    const by = (id: string) => FACTIONS.find((f) => f.id === id)!;
    for (const f of FACTIONS) {
      expect(f.reveal, `${f.id} reveal`).toBeDefined();
      expect(f.reveal!.lines.length).toBeLessThanOrEqual(9);
      for (const l of f.reveal!.lines) expect(l).toMatch(/^[^:]{2,40}: \S/);
      expect(f.reveal!.lines.join(' ')).toMatch(/digitis|IS the upload/);
      expect(f.reveal!.lines.join(' ')).toMatch(/afternoon|gas the planet/); // why not sterilise: the character is surprised nobody saw it
    }
    expect(by('delegation').reveal!.lines.join(' ')).toMatch(/ethical protocol/);
    expect(by('faithful').reveal!.lines.join(' ')).toMatch(/delete the congregation/);
    expect(by('institute').reveal!.lines.join(' ')).toMatch(/Cut comms/);
    // The Director calls back (Collins, Sep 30 2026; empire.md 12b): why not let them evolve on their own, and why the Empire is so
    // brutal to its own. One card, the same shape as a reveal.
    const back = by('institute').afterReveal ?? [];
    expect(back).toHaveLength(1);
    expect(back[0].lines.length).toBeLessThanOrEqual(9);
    for (const l of back[0].lines) expect(l).toMatch(/^[^:]{2,40}: \S/);
    expect(back[0].lines.join(' ')).toMatch(/evolve on our own/);
    expect(back[0].lines.join(' ')).toMatch(/simulate one for you\. We just will not put anyone else in it/);
    expect(back[0].lines.join(' ')).toMatch(/When we die we are uploaded/);
    expect(back[0].lines.join(' ')).toMatch(/easy part begins/);
    // The dead from before the broodfall: not yet, but physics allows it (Collins).
    for (const id of ['delegation', 'faithful']) expect(by(id).reveal!.lines.join(' ')).toMatch(/cannot read the dead yet/);
    // The wicked are not kept (no Pit), and the Director's world is private (Collins).
    expect(by('faithful').reveal!.lines.join(' ')).toMatch(/not simulated/);
    expect(by('institute').reveal!.lines.join(' ')).toMatch(/very private/);
    // The broodfall is erased from their memories.
    expect(by('delegation').reveal!.lines.join(' ')).toMatch(/not remember the broodfall/);
    // Resynthesis: an archived people that can add to the Sons of Man is printed back out.
    for (const f of FACTIONS) expect(f.reveal!.lines.join(' ')).toMatch(/Sons of Man/);
    // The Institute's ending line stays literally true: the door into the gut IS the upload.
    expect(by('institute').ending.lines.join(' ')).toMatch(/door into the asset's gut/);
  });

  it('no scene grew by more than two lines, and every line still names its speaker', () => {
    for (const s of scenes) {
      expect(s.scene.lines.length).toBeLessThanOrEqual(9);
      for (const l of s.scene.lines) expect(l).toMatch(/^[^:]{2,40}: \S/);
    }
  });
});
