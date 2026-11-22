/**
 * CHYME, the organ stage's own currency (Collins, Nov 22 2026: "the organ stage is using the same currency as the limb
 * stage this is not good game design a secondary currency like processed food should build for the organ stage based on
 * what you earned not what you had left"). DESIGN.md "Chyme". What these hold:
 *  - it accrues from what was EARNED (every body digested, by its caste, as it is digested, and the clear's ration),
 *    never from what was left over: a purse left unspent renders nothing;
 *  - it is banked from wave to wave while the limbs' meat still spoils at the wave's start;
 *  - organs (themes, levels, the meteor, zones, creep organs) cost chyme and never war or science;
 *  - a run saved before chyme (runSave v1) replays under the economy it was played in.
 */
import { describe, expect, it } from 'vitest';
import { DT, Sim, organSpec } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { BALANCE as B } from '../content/data';
import { LEGACY_ORGAN_COST, METEOR_LEVEL_CHYME, ORGAN_DEFS } from '../content/underground';
import { migrateRunSave, replayRun, type RunSave } from '../src/meta/runSave';
import type { Caste, Command, Enemy, SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4321, organStage: true };

type Priv = {
  bankMeat(m: Record<Caste, number>, chyme?: number): void; phase: string; enemies: Enemy[]; spawnQueue: unknown[]; phaseElapsed: number;
  spawnEnemy(kind: string, gate?: number): Enemy; killEnemy(id: number, yieldMult: number, eaten: boolean, srcId?: number): void;
};
const priv = (s: Sim) => s as unknown as Priv;

/** Clear the wave now under way (nothing left to fight), and step past a district draft if one opens. */
function clearWave(s: Sim): void {
  priv(s).enemies.length = 0;
  priv(s).spawnQueue.length = 0;
  for (let i = 0; i < 60 && s.phase === 'siege'; i++) s.tick();
  while (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0 });
}

function organSpot(s: Sim, organ: Parameters<Sim['canBuildOrgan']>[0]): { cell: number; rot: number } {
  for (let c = 0; c < s.under.cells.length; c++) for (let rot = 0; rot < 4; rot++) if (s.canBuildOrgan(organ, c, rot)) return { cell: c, rot };
  throw new Error('no organ spot');
}

describe('chyme accrues from what was EARNED', () => {
  it('every body killed carries its chyme by caste (war 1, science 2, royal 4), rendered only when it is digested', () => {
    const s = new Sim(CFG);
    // In the setup (no wave to clear under the test's feet): three bodies, killed by hand.
    const p = priv(s);
    const kinds = ['soldier', 'researcher', 'consort'] as const;
    for (const k of kinds) { const e = p.spawnEnemy(k); p.killEnemy(e.id, 1, false); }
    const bodies = s.corpses.slice(-3);
    expect(bodies.map((c) => c.chyme)).toEqual([B.chymePerBody.war, B.chymePerBody.science, B.chymePerBody.royal]);
    // Bodies at the gate lie off the creep: nothing is rendered until the creep reaches them.
    expect(s.chyme).toBe(0);
    // Moved onto the creep (the core's cell), they are digested and their chyme is banked with their meat.
    for (const c of bodies) { c.cell = s.map.coreCell; c.pos = s.cellCenter(s.map.coreCell); }
    for (let i = 0; i < 200; i++) s.tick();
    expect(s.chyme).toBe(B.chymePerBody.war + B.chymePerBody.science + B.chymePerBody.royal);
    expect(s.waveChyme).toBe(s.chyme);
  });

  it('a Maw eating a body whole renders its chyme at once; meat banked with no body renders none', () => {
    const s = new Sim(CFG);
    const p = priv(s);
    p.bankMeat({ war: 40, science: 20, royal: 3 });
    expect(s.chyme).toBe(0); // meat is not chyme: a thief's returned loot, a deposit, a shelter's share render nothing
    const e = p.spawnEnemy('militia');
    p.killEnemy(e.id, 0, true);
    expect(s.chyme).toBe(B.chymePerBody.war);
  });

  it('a clear pays its ration (chymeRationBase + chymeRationPerWave x the wave), and the tally says what came from where', () => {
    const s = new Sim(CFG);
    s.issue({ kind: 'call-early' });
    priv(s).bankMeat({ war: 20, science: 0, royal: 0 }, 7);
    s.takeEvents();
    clearWave(s);
    const tally = s.takeEvents().find((e) => e.kind === 'chyme-tally');
    expect(tally).toBeDefined();
    if (tally?.kind !== 'chyme-tally') throw new Error('no tally');
    expect(tally.ration).toBe(B.chymeRationBase + B.chymeRationPerWave * 1);
    expect(tally.digested).toBe(7);
    expect(tally.earned).toBe(tally.digested + tally.ration);
    expect(s.lastChymeTally?.wave).toBe(1);
    expect(s.waveChyme).toBe(0);
  });

  it('meat left UNSPENT renders nothing: a rich hoarder and a spender earn the same chyme', () => {
    const play = (hoard: number) => {
      const s = new Sim(CFG);
      s.issue({ kind: 'call-early' });
      clearWave(s);
      s.meat.war += hoard; // left unspent through the setup
      priv(s).phaseElapsed = 999;
      s.issue({ kind: 'call-early' }); // wave 2 starts: the hoard spoils
      clearWave(s);
      return { chyme: s.chyme, war: s.meat.war };
    };
    const spender = play(0);
    const hoarder = play(500);
    expect(hoarder.chyme).toBeCloseTo(spender.chyme);
  });
});

describe('chyme is BANKED; the limbs meat still spoils', () => {
  it('chyme carries over a wave start untouched while unspent war and science are lost', () => {
    const s = new Sim(CFG);
    s.issue({ kind: 'call-early' });
    clearWave(s);
    s.chyme = 123.5;
    s.meat.war = 50; s.meat.science = 9;
    priv(s).phaseElapsed = 999;
    s.issue({ kind: 'call-early' });
    expect(s.phase).toBe('siege');
    expect(s.chyme).toBe(123.5);
    expect(s.meat.war).toBe(0);
    expect(s.meat.science).toBe(0);
  });

  it('the Royal Larder still keeps half of the war and science (its job now: saving for a big limb or an evolution)', () => {
    const s = new Sim({ ...CFG, directive: { kind: 'royal', count: 1 } });
    s.issue({ kind: 'call-early' });
    clearWave(s);
    s.meat.royal = 2;
    expect(s.issue({ kind: 'decree', decree: 'larder' }).ok).toBe(true);
    s.meat.war = 80; s.meat.science = 0;
    s.chyme = 10;
    priv(s).phaseElapsed = 999;
    s.issue({ kind: 'call-early' });
    expect(s.meat.war).toBe(40);
    expect(s.chyme).toBe(10);
  });
});

describe('organs are priced in chyme only', () => {
  it('every organ has a chyme price and no war or science price', () => {
    for (const d of ORGAN_DEFS) {
      expect(d.cost.chyme, d.id).toBeGreaterThan(0);
      expect(Object.keys(d.cost), d.id).toEqual(['chyme']);
    }
  });

  it('growing an organ takes chyme and never war; without chyme it cannot be grown however rich in meat', () => {
    const s = new Sim(CFG);
    s.meat.war = 9999; s.meat.science = 9999;
    expect(s.issue({ kind: 'build-organ', organ: 'gut', ...organSpot(s, 'gut') }).err).toBe('cannot afford');
    s.chyme = organSpec('gut').cost.chyme;
    expect(s.issue({ kind: 'build-organ', organ: 'gut', ...organSpot(s, 'gut') }).ok).toBe(true);
    expect(s.chyme).toBe(0);
    expect(s.meat.war).toBe(9999);
    expect(s.meat.science).toBe(9999);
  });

  it('a level costs the organ\'s chyme price x its level; the meteor METEOR_LEVEL_CHYME x its level', () => {
    const s = new Sim(CFG);
    s.chyme = 1000;
    s.issue({ kind: 'build-organ', organ: 'forge', ...organSpot(s, 'forge') });
    const forge = s.organs.find((o) => o.organ === 'forge')!;
    expect(s.organUpgradeCost(forge)).toEqual({ chyme: 40 });
    s.issue({ kind: 'upgrade-organ', organInstanceId: forge.id });
    expect(s.organUpgradeCost(forge)).toEqual({ chyme: 80 });
    expect(s.organUpgradeCost(null)).toEqual({ chyme: METEOR_LEVEL_CHYME });
    const before = s.chyme;
    expect(s.issue({ kind: 'upgrade-organ', organInstanceId: -1 }).ok).toBe(true);
    expect(before - s.chyme).toBe(METEOR_LEVEL_CHYME);
    expect(s.organUpgradeCost(null)).toEqual({ chyme: 2 * METEOR_LEVEL_CHYME });
  });
});

describe('a run saved before chyme', () => {
  it('a v1 save is loaded under the old economy (organs in war and science, the full war wage, no chyme)', () => {
    const v1 = { v: 1, search: '?seed=5', kind: 'skirmish', cfg: { ...CFG }, cmds: [], ticks: 0, speed: 1, wave: 0, savedAt: 0 } as RunSave;
    const m = migrateRunSave(v1);
    expect(m.cfg.organEconomy).toBe('meat');
    expect(migrateRunSave({ ...v1, v: 2 }).cfg.organEconomy).toBeUndefined();
    const s = new Sim(m.cfg);
    expect(s.organCost('gut')).toEqual(LEGACY_ORGAN_COST.gut);
    expect(s.organCost('marrow')).toEqual({ science: 30 });
    s.issue({ kind: 'call-early' });
    clearWave(s);
    expect(s.chyme).toBe(0);
    expect(s.warWage(1)).toBe(B.legacyWaveBonusBase + B.legacyWaveBonusPerWave);
  });

  it('orders given under the old economy replay to the same board under it', () => {
    const cfg: SimConfig = { ...CFG, seed: 77, playerCallsWaves: true, organEconomy: 'meat' };
    const live = new Sim(cfg);
    const cmds: RunSave['cmds'] = [];
    const issue0 = live.issue.bind(live);
    live.issue = (c: Command) => { cmds.push({ t: live.tickCount, c: JSON.parse(JSON.stringify(c)) }); return issue0(c); };
    const bot = new Autoplayer(78);
    let held = 0;
    for (let i = 0; i < 9000 && live.outcome === 'playing' && live.waveNumber < 4; i++) {
      bot.act(live, DT);
      const before = live.tickCount;
      live.tick();
      if (live.tickCount === before && live.phase === 'growth' && ++held % 5 === 0) live.issue({ kind: 'call-early' });
    }
    expect(live.organs.length).toBeGreaterThan(0);
    const save = migrateRunSave({ v: 1, search: '', kind: 'skirmish', cfg: { ...cfg, organEconomy: undefined }, cmds, ticks: live.tickCount, speed: 1, wave: live.waveNumber, savedAt: 0 });
    const again = new Sim(JSON.parse(JSON.stringify(save.cfg)));
    replayRun(again, save);
    expect(JSON.stringify({ meat: again.meat, organs: again.organs, towers: again.towers.map((t) => t.cell) }))
      .toBe(JSON.stringify({ meat: live.meat, organs: live.organs, towers: live.towers.map((t) => t.cell) }));
  });
});
