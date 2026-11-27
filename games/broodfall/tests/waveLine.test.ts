/**
 * THE LINE UNDER THE PHASE (src/ui/hud.ts waveLine), Nov 26 2026 playtest: "WAVE 1" under ASSAULT FORMING read as the
 * wave to come, when it was the last one started. Between waves it names the wave that comes, with that wave's tier and
 * no risk (the risk is the last wave's); in a wave it names that wave.
 */
import { describe, expect, it } from 'vitest';
import { waveLine } from '../src/ui/hud';
import { Sim } from '../src/sim/sim';

const base = { tierOf: (n: number) => Math.min(6, n - 1), holdWaves: 12, risk: 64, mass: 120, next: '16 militia', intelHidden: false };

describe('the wave line', () => {
  it('names the wave that comes between waves, with its own tier, and no risk', () => {
    expect(waveLine({ ...base, siege: false, wave: 1 })).toBe('WAVE 2 OF 12 · TIER 1 · MASS 120 · NEXT: 16 militia');
    expect(waveLine({ ...base, siege: false, wave: 0 })).toBe('WAVE 1 OF 12 · TIER 0 · MASS 120 · NEXT: 16 militia');
  });

  it('names the wave in progress during a siege, with its risk', () => {
    expect(waveLine({ ...base, siege: true, wave: 2, next: '' })).toBe('WAVE 2 OF 12 · TIER 1 · RISK 64 · MASS 120');
  });

  it('says OF only on a hold order and only up to its last wave', () => {
    expect(waveLine({ ...base, siege: true, wave: 3, holdWaves: null, next: '' })).toBe('WAVE 3 · TIER 2 · RISK 64 · MASS 120');
    expect(waveLine({ ...base, siege: true, wave: 13, next: '' })).toBe('WAVE 13 · TIER 6 · RISK 64 · MASS 120');
  });

  it('says the next wave is unknown when its intel is hidden', () => {
    expect(waveLine({ ...base, siege: false, wave: 4, next: '', intelHidden: true })).toBe('WAVE 5 OF 12 · TIER 4 · MASS 120 · NEXT: unknown');
  });

  it('in a real run, after wave 1 is cleared, names wave 2', () => {
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 11, directive: { kind: 'hold', waves: 12 }, organStage: true, entrances: 1, genes: [] });
    // Wave 1 starts by itself when its forming time runs out.
    for (let i = 0; i < 40000 && sim.wavesCleared < 1 && sim.outcome === 'playing'; i++) sim.tick();
    expect(sim.wavesCleared).toBe(1);
    expect(sim.phase).not.toBe('siege');
    const line = waveLine({ siege: false, wave: sim.waveNumber, tierOf: (n) => sim.tierFor(n), holdWaves: 12, risk: sim.waveRisk, mass: 0, next: '', intelHidden: false });
    expect(line.startsWith('WAVE 2 OF 12 · TIER ')).toBe(true);
    expect(line).not.toContain('RISK');
  });
});
