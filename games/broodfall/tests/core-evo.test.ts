/**
 * THE CORE EVOLVES (Sep 30 2026): four stages by limbs grown, the same numbers in the game
 * (src/render/coreStage.ts) and in the art (tools/art/templates/core-evo.mjs); every stage has its
 * idle, every stage after the first the clip of it growing, all in one mapping; the organ stage has
 * one picture of the meteor per stage, cut at its ground line.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORE_STAGE_GROWN, coreStageOf } from '../src/render/coreStage';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { STAGES } from '../tools/art/templates/core-evo.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'public', 'art');
const file = join(ART, 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

describe('the core\'s stages', () => {
  it('every run starts at stage 1, and a stage comes with limbs grown', () => {
    expect(coreStageOf(0)).toBe(1);
    expect(coreStageOf(5)).toBe(1);
    expect(coreStageOf(6)).toBe(2);
    expect(coreStageOf(17)).toBe(2);
    expect(coreStageOf(18)).toBe(3);
    expect(coreStageOf(40)).toBe(4);
    expect(coreStageOf(500)).toBe(4);
  });
  it('the art is drawn for the same numbers the game uses', () => {
    expect(STAGES.map((s: { grown: number }) => s.grown)).toEqual([...CORE_STAGE_GROWN]);
  });
});

describe.skipIf(!manifest?.board?.coreEvo)('the core\'s stages, as baked', () => {
  const evo = manifest.board.coreEvo;
  it('has an idle for every stage and a growing clip into every stage after the first', () => {
    expect(evo.stages.map((s: { grown: number }) => s.grown)).toEqual([...CORE_STAGE_GROWN]);
    evo.stages.forEach((s: { id: number; idle: { atlas: string; count: number; body: number }; grow?: { atlas: string; count: number } }, i: number) => {
      expect(existsSync(join(ART, s.idle.atlas)), s.idle.atlas).toBe(true);
      expect(s.idle.count).toBeGreaterThanOrEqual(8);
      expect(s.idle.body).toBeGreaterThan(0);
      if (i === 0) return;
      expect(s.grow, `stage ${s.id} grows`).toBeTruthy();
      expect(existsSync(join(ART, s.grow!.atlas)), s.grow!.atlas).toBe(true);
      expect(s.grow!.count).toBeGreaterThanOrEqual(24);
    });
  });
  it('no stage is so wide that it leaves its square (4 cells; the collar at most 0.8 of it)', () => {
    for (const s of evo.stages) expect(evo.cells * 0.92 * 1.22 * s.collar).toBeLessThanOrEqual(0.8 * 4);
  });
});

describe.skipIf(!manifest?.under?.core)('the meteor on the organ stage', () => {
  it('is one picture per stage, cut at its ground line so that below it are the 3 by 2 cells', () => {
    const stages = manifest.under.core.stages;
    expect(stages.length).toBe(CORE_STAGE_GROWN.length);
    for (const s of stages) {
      expect(existsSync(join(ART, s.file)), s.file).toBe(true);
      // Below the line: 3 cells wide and 2 cells (each 1/1.25 of a cell's width) deep.
      expect((1 - s.line) / s.aspect).toBeCloseTo(1.6 / 3, 2);
    }
  });
});
