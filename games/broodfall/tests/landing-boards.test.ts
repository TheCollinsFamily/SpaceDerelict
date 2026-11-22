/**
 * The landing film flows into the game with no jump (Nov 22 2026; Collins: "the animation flows into one way the board
 * could be set but then when gameplay starts the board snaps to a different configuration"). A run that lands is built
 * on the board its film ends on: these tests hold the rules that make that true.
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { Rng } from '../src/sim/rng';
import { START_PLATES } from '../content/plates';
import {
  LANDING_BOARDS, LANDING_ENTRANCES, boardKey, canLandOnBoard, endingFor, landingBoardSeed, landingDecision, type LandingFilm,
} from '../src/meta/landing';
// @ts-expect-error: a plain .mjs tool with no types (only its two lists are read)
import * as tool from '../tools/art/landing.mjs';

const CFG = { gridW: 50, gridH: 40, cellPx: 26, directive: { kind: 'hold' as const, waves: 5 }, organStage: true, genes: [] as string[] };
const board = (s: Sim) => ({ cells: [...s.map.cells], heights: [...s.map.heights], slots: [...s.map.slots], core: s.map.coreCell });

describe('a landing run is built on the board its film ends on', () => {
  it('the same board seed gives the same board whatever the run seed; the run seed alone still varies it', () => {
    for (const e of [1, 2, 3]) {
      const a = new Sim({ ...CFG, seed: 111, boardSeed: 6, entrances: e });
      const b = new Sim({ ...CFG, seed: 987654, boardSeed: 6, entrances: e });
      const pictured = new Sim({ ...CFG, seed: 6, boardSeed: 6, entrances: e });
      expect(board(a)).toEqual(board(b));
      expect(board(a)).toEqual(board(pictured));
    }
    expect(board(new Sim({ ...CFG, seed: 111, entrances: 1 }))).not.toEqual(board(new Sim({ ...CFG, seed: 987654, entrances: 1 })));
  });
  it('a run with no board seed draws its board exactly as before (seed only)', () => {
    const plain = new Sim({ ...CFG, seed: 42, entrances: 1 });
    const same = new Sim({ ...CFG, seed: 42, entrances: 1 });
    expect(board(plain)).toEqual(board(same));
    expect(plain.boardSeed).toBe(42);
  });
  it('the four landing boards are the four crash sites', () => {
    const crashes = LANDING_BOARDS.map((bs) => new Rng((bs ^ 0x5eed) >>> 0).int(0, 999) % START_PLATES.length);
    expect(new Set(crashes).size).toBe(START_PLATES.length);
    for (const s of [0, 1, 2, 3, 77, 1e9 - 1]) expect(LANDING_BOARDS).toContain(landingBoardSeed(s));
  });
  it('the film tool makes its endings for the same boards the game lands on', () => {
    expect(tool.LANDING_BOARDS).toEqual([...LANDING_BOARDS]);
    expect(tool.LANDING_ENTRANCES).toEqual([...LANDING_ENTRANCES]);
  });
  it('only a new board of the game size is landed on (not a defence city, a pinned crash, a resumed run)', () => {
    expect(canLandOnBoard({ gridW: 50, gridH: 40 }, false)).toBe(true);
    expect(canLandOnBoard({ gridW: 50, gridH: 40 }, true)).toBe(false);
    expect(canLandOnBoard({ gridW: 70, gridH: 56, pregrown: 12 }, false)).toBe(false);
    expect(canLandOnBoard({ gridW: 50, gridH: 40, board: {} }, false)).toBe(false);
    expect(canLandOnBoard({ gridW: 50, gridH: 40, crash: 2 }, false)).toBe(false);
  });
  it('only the ending made on THIS board plays; none at all rather than one that jumps; never on a defence', () => {
    const film = { set: 'suburb', video: 'v', end: 'e', seconds: 9, fallAt: 1.6, strikeAt: 4.8, core: { x: 0, y: 0 },
      boards: { [boardKey(1, 6)]: { video: 'v6', end: 'e6', core: { x: 886, y: 717 } } } } satisfies LandingFilm;
    expect(endingFor(film, 1, 6)?.video).toBe('v6');
    expect(endingFor(film, 2, 6)).toBeNull();
    expect(endingFor(film, 1, undefined)).toBeNull();
    const base = { mode: 'always' as const, set: 'suburb', seen: [], hasFilm: true, afterOpening: false, automated: false, forced: false, off: false };
    expect(landingDecision({ ...base, hasBoard: true })).toBe('play');
    expect(landingDecision({ ...base, hasBoard: false })).toBe('no-board');
    expect(landingDecision({ ...base, hasBoard: true, defence: true })).toBe('defence');
  });
});
