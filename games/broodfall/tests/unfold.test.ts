/**
 * THE WORLD UNFOLDS (Nov 23 2026). Collins: "remember you want an UNFOLDING game world, not dropping everything (science,
 * royals etc.) at once". DESIGN.md "The world unfolds". What these hold, in a skirmish:
 *  - the organ shelf opens a block at a time (content/underground.ts ORGAN_SHELF), each told when it opens;
 *  - the court sends a detachment from BALANCE.courtFromWave, told when it first marches;
 *  - none of it in the campaign (its own pool), and a save from before it replays with the whole shelf open.
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { BALANCE as B } from '../content/data';
import { ORGAN_DEFS, ORGAN_SHELF, SHELF_AFTER } from '../content/underground';
import { migrateRunSave, type RunSave } from '../src/meta/runSave';
import type { Enemy, OrganId, SimConfig, SimEvent } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 4321, organStage: true, directive: { kind: 'hold', waves: 12 } };

type Priv = { enemies: Enemy[]; spawnQueue: unknown[]; phaseElapsed: number };
const priv = (s: Sim) => s as unknown as Priv;

/** Start the next wave and clear it at once (stepping past a district draft); the events it made. */
function nextWave(s: Sim): SimEvent[] {
  const ev: SimEvent[] = [];
  priv(s).phaseElapsed = 999;
  s.issue({ kind: 'call-early' });
  ev.push(...s.takeEvents());
  priv(s).enemies.length = 0;
  priv(s).spawnQueue.length = 0;
  for (let i = 0; i < 80 && s.phase === 'siege'; i++) s.tick();
  while (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0 });
  ev.push(...s.takeEvents());
  return ev;
}

function spot(s: Sim, organ: OrganId): { cell: number; rot: number } | null {
  for (let c = 0; c < s.under.cells.length; c++) for (let rot = 0; rot < 4; rot++) if (s.canBuildOrgan(organ, c, rot)) return { cell: c, rot };
  return null;
}

describe('the organ shelf unfolds in a skirmish', () => {
  it('every organ is in exactly one block, and the first block is open from the start', () => {
    const seen = ORGAN_SHELF.flatMap((b) => b.organs);
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual(ORGAN_DEFS.map((d) => d.id).sort());
    expect(ORGAN_SHELF[0].after).toBe(0);
  });

  it('a skirmish unfolds; the campaign (an organ pool), a defence and an old save do not', () => {
    expect(new Sim(CFG).unfolds).toBe(true);
    expect(new Sim({ ...CFG, organPool: ['gut'] }).unfolds).toBe(false);
    expect(new Sim({ ...CFG, unfold: false }).unfolds).toBe(false);
    const v2 = { v: 2, search: '', kind: 'skirmish', cfg: { ...CFG }, cmds: [], ticks: 0, speed: 1, wave: 0, savedAt: 0 } as RunSave;
    expect(migrateRunSave(v2).cfg.unfold).toBe(false);
    expect(migrateRunSave({ ...v2, v: 3 }).cfg.unfold).toBeUndefined();
  });

  it('an organ of a later block is refused until its wave is cleared, then told and grown', () => {
    const s = new Sim(CFG);
    s.chyme = 1000;
    nextWave(s);
    expect(s.organOnShelf('gut')).toBe(true);
    expect(s.organOnShelf('nerve')).toBe(false);
    expect(s.organOpensAfter('nerve')).toBe(SHELF_AFTER.nerve);
    expect(spot(s, 'nerve')).toBeNull();
    const r = s.issue({ kind: 'build-organ', organ: 'nerve', cell: 0, rot: 0 });
    expect(r.ok).toBe(false);
    let opened: SimEvent | undefined;
    while (s.wavesCleared < SHELF_AFTER.nerve) opened = nextWave(s).find((e) => e.kind === 'shelf-opened') ?? opened;
    expect(opened).toMatchObject({ kind: 'shelf-opened', wave: SHELF_AFTER.nerve });
    expect(s.organOnShelf('nerve')).toBe(true);
    const at = spot(s, 'nerve');
    expect(at).not.toBeNull();
    expect(s.issue({ kind: 'build-organ', organ: 'nerve', ...at! }).ok).toBe(true);
  });

  it('the campaign keeps its whole pool open from wave 1', () => {
    const s = new Sim({ ...CFG, organPool: ['nerve', 'marrow'] });
    s.chyme = 1000;
    nextWave(s);
    expect(s.organOnShelf('marrow')).toBe(true);
    expect(spot(s, 'marrow')).not.toBeNull();
  });
});


describe('the court comes mid-run', () => {
  it(`no court body before wave ${B.courtFromWave}; from it a detachment marches with every wave, told once`, () => {
    const s = new Sim(CFG);
    expect(s.royalOpen).toBe(true);
    const told: number[] = [];
    let courtBefore = 0;
    for (let w = 1; w <= B.courtFromWave + 2; w++) {
      const det = s.courtDetachment(w);
      const n = Object.values(det).reduce((a, b) => a + (b ?? 0), 0);
      if (w < B.courtFromWave) courtBefore += n;
      else expect(n).toBeGreaterThanOrEqual(1);
      for (const e of nextWave(s)) if (e.kind === 'court-opened') told.push(e.wave);
    }
    expect(courtBefore).toBe(0);
    expect(told).toEqual([B.courtFromWave]);
    expect(s.courtShown).toBe(true);
    // A campaign run (an organ pool) keeps its own court rules: no detachment.
    expect(Object.keys(new Sim({ ...CFG, organPool: ['gut'] }).courtDetachment(B.courtFromWave + 2))).toEqual([]);
  });

  it('the detachment is in the next wave\'s preview, and the wave start counts it', () => {
    const s = new Sim(CFG);
    while (s.waveNumber < B.courtFromWave - 1) nextWave(s);
    const preview = s.previewNextWave();
    expect((preview.consort ?? 0) + (preview.matron ?? 0)).toBeGreaterThanOrEqual(1);
    priv(s).phaseElapsed = 999;
    s.issue({ kind: 'call-early' });
    const start = s.takeEvents().find((e) => e.kind === 'wave-start');
    expect(start && start.kind === 'wave-start' ? (start.counts.consort ?? 0) + (start.counts.matron ?? 0) : 0).toBeGreaterThanOrEqual(1);
  });
});
