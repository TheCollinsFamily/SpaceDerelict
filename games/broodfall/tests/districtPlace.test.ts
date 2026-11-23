/**
 * THE PLAYER PLACES THE DISTRICT (Collins, Nov 22 2026: "after choosing a tile set it should not auto place it but let
 * me rotate it with R and place it where I want so long as the placement is legal ... if a neighboring space has a
 * tunnel end it needs to match it and we need to make sure there is always a legal space for any generated tile").
 *
 * The properties, over many seeds and many grown boards:
 *   - every district a draft offers has at least one legal (slot, turn), its own offered place among them;
 *   - put down at ANY legal place (chosen at random), the board stays whole: openings meet openings and walls walls on
 *     every shared edge, the hive keeps a way in, every gate's street reaches the core, no step of more than one
 *     storey between neighbouring blocks of the new district, a promised shelter stands;
 *   - an illegal place is refused and changes nothing;
 *   - a turn is real (cells and mouths both turn) and the order replays the same.
 */
import { describe, expect, it } from 'vitest';
import { platePool } from '../content/plates';
import { Rng } from '../src/sim/rng';
import { CellType, PLATE, checkPlacement, computeFlow, draftOffers, frontierGates, turnedPattern } from '../src/sim/citymap';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { replayRun } from '../src/meta/runSave';
import type { Command, SimConfig } from '../src/sim/types';
import { BALANCE as B } from '../content/data';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1 };
const LARGE: SimConfig = { gridW: 70, gridH: 50, cellPx: 26, seed: 1 };
type Edge = 'n' | 's' | 'e' | 'w';
const OPP: Record<Edge, Edge> = { n: 's', s: 'n', e: 'w', w: 'e' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P = (s: Sim) => s as any;

/** Open a draft the way the sim does at a wave's clear (its offers, a shelter on one of them by its own dice). */
function openDraft(s: Sim, rng: Rng): boolean {
  const offers = draftOffers(s.map, rng, 3, true);
  P(s).markShelterOffer(offers);
  if (!offers.length) return false;
  s.phase = 'draft';
  s.pendingDraft = offers;
  return true;
}

/** Every rule the board must keep after a district is put down. Returns what is wrong, or []. */
function boardProblems(s: Sim, placedSlot: number): string[] {
  const out: string[] = [];
  const map = s.map;
  const at = (sx: number, sy: number) => (sx < 0 || sy < 0 || sx >= map.slotsX || sy >= map.slotsY) ? null : map.slots[sy * map.slotsX + sx];
  for (let sy = 0; sy < map.slotsY; sy++) for (let sx = 0; sx < map.slotsX; sx++) {
    const inst = at(sx, sy);
    if (!inst) continue;
    const nbs: Record<Edge, ReturnType<typeof at>> = { n: at(sx, sy - 1), s: at(sx, sy + 1), e: at(sx + 1, sy), w: at(sx - 1, sy) };
    for (const e of ['n', 's', 'e', 'w'] as Edge[]) {
      const nb = nbs[e];
      if (nb && !!inst.pattern.ports[e] !== !!nb.pattern.ports[OPP[e]]) out.push(`slot ${sy * map.slotsX + sx} ${e}: mouth meets wall`);
    }
  }
  const gates = frontierGates(map);
  if (!gates.length) out.push('no gate left');
  const flow = computeFlow(map, map.coreCell, () => 0);
  for (const g of gates) if (!Number.isFinite(flow.dist[g])) out.push(`gate ${g} cut off from the core`);
  // Every street cell of the new district joins the core (no sealed-off pocket a wave could be lost in).
  const sx0 = (placedSlot % map.slotsX) * PLATE;
  const sy0 = Math.floor(placedSlot / map.slotsX) * PLATE;
  for (let y = sy0; y < sy0 + PLATE; y++) for (let x = sx0; x < sx0 + PLATE; x++) {
    const c = y * map.w + x;
    if ((map.cells[c] === CellType.Road || map.cells[c] === CellType.Plaza) && !Number.isFinite(flow.dist[c])) out.push(`street ${c} of the new district cut off`);
  }
  // The land: no step of more than one storey between neighbouring blocks, where the new district touches.
  const ground = (c: number) => map.heights[c] - map.plinths[c];
  for (let y = sy0; y < sy0 + PLATE; y++) for (let x = sx0; x < sx0 + PLATE; x++) {
    const c = y * map.w + x;
    if (map.cells[c] !== CellType.Block) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const n = ny * map.w + nx;
      if (map.cells[n] === CellType.Block && Math.abs(ground(c) - ground(n)) > 1) out.push(`step of ${Math.abs(ground(c) - ground(n))} storeys at ${c}`);
    }
  }
  return out;
}

describe('placing a drafted district (Nov 22 2026)', () => {
  it('a turn is real: four turns come home, and the cells turn with the mouths', () => {
    for (const p of platePool()) {
      expect(turnedPattern(p, 4)).toBe(p);
      expect(turnedPattern(turnedPattern(p, 1), 3).id).toBe(p.id);
      const t = turnedPattern(p, 1);
      // Clockwise: what was the north edge is now the east edge.
      expect(t.ports.e).toBe(p.ports.n);
      expect(t.ports.s).toBe(p.ports.e);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) expect(t.rows[y][x]).toBe(p.rows[9 - x][y]);
    }
  });

  it('on 120 grown boards: every offer has a legal place, and any legal place leaves a whole board', () => {
    let offers = 0;
    let placements = 0;
    let drafts = 0;
    let minPlaces = Infinity;
    let refused = 0;
    let shelters = 0;
    const perOffer: number[] = [];
    for (let seed = 1; seed <= 120; seed++) {
      const cfg = { ...(seed % 3 === 0 ? LARGE : CFG), seed, entrances: 1 + (seed % 3) };
      const s = new Sim(cfg);
      const rng = new Rng(seed * 7 + 3);
      P(s).draftsTaken = seed % 2 ? 0 : B.shelterFromDraft; // half the boards can be offered a shelter at once
      for (let d = 0; d < 12; d++) {
        if (!openDraft(s, rng)) break;
        drafts++;
        const draft = s.pendingDraft!;
        draft.forEach((o, i) => {
          offers++;
          const places = s.draftPlacements(i);
          perOffer.push(places.length);
          minPlaces = Math.min(minPlaces, places.length);
          expect(places.length, `seed ${seed} draft ${d} offer ${i}`).toBeGreaterThan(0);
          // Its own offered place is one of them.
          expect(places.some((p) => p.slot === o.slot && p.rot === 0)).toBe(true);
          expect(s.defaultPlacement(i)).toEqual({ slot: o.slot, rot: 0 });
        });
        // An illegal place is refused and changes nothing.
        const cells = s.map.cells.slice();
        const occupied = s.map.slots.findIndex((x) => x !== null);
        expect(s.issue({ kind: 'choose-plate', index: 0, slot: occupied, rot: 0 }).ok).toBe(false);
        for (let slot = 0; slot < s.map.slots.length; slot++) {
          if (s.map.slots[slot] !== null) continue;
          const bad = [0, 1, 2, 3].find((r) => s.draftPlacementProblem(0, slot, r) !== null);
          if (bad === undefined) continue;
          expect(s.issue({ kind: 'choose-plate', index: 0, slot, rot: bad }).ok).toBe(false);
          refused++;
          break;
        }
        expect(s.map.cells).toEqual(cells);
        expect(s.phase).toBe('draft');
        // Put a random offer down at a random legal place.
        const i = rng.int(0, draft.length - 1);
        const places = s.draftPlacements(i);
        const at = places[rng.int(0, places.length - 1)];
        const hadShelter = !!draft[i].shelter;
        const before = s.shelters.length;
        const r = s.issue({ kind: 'choose-plate', index: i, slot: at.slot, rot: at.rot });
        expect(r.ok, r.err).toBe(true);
        placements++;
        expect(s.map.slots[at.slot]?.pattern.id).toBe(turnedPattern(draft[i].pattern, at.rot).id);
        expect(boardProblems(s, at.slot), `seed ${seed} draft ${d}`).toEqual([]);
        if (hadShelter) { expect(s.shelters.length).toBe(before + 1); shelters++; }
      }
    }
    perOffer.sort((a, b) => a - b);
    console.log(`[place] ${drafts} drafts, ${offers} offers, ${placements} placed at random legal places, ${shelters} with a shelter; legal places an offer: min ${minPlaces}, median ${perOffer[perOffer.length >> 1]}, max ${perOffer[perOffer.length - 1]}; ${refused} illegal places refused`);
    expect(drafts).toBeGreaterThan(600);
    expect(shelters).toBeGreaterThan(10);
  }, 240_000);

  it('the reasons speak to the player, and the ghost knows each edge', () => {
    const s = new Sim({ ...CFG, seed: 5 });
    openDraft(s, new Rng(5));
    const o = s.pendingDraft![0];
    const ok = checkPlacement(s.map, o.pattern, o.slot);
    expect(ok.problem).toBeNull();
    expect(ok.edges.some((e) => e.fit === 'joins')).toBe(true);
    // Somewhere not touching the city at all.
    const far = s.map.slots.findIndex((x, slot) => x === null && ['n', 's', 'e', 'w'].every((e) => checkPlacement(s.map, o.pattern, slot).edges.find((f) => f.edge === e)!.meets !== 'mouth' && checkPlacement(s.map, o.pattern, slot).edges.find((f) => f.edge === e)!.meets !== 'wall'));
    if (far >= 0) expect(checkPlacement(s.map, o.pattern, far).problem).toMatch(/beside a district you hold/);
  });

  it('a placed and turned district replays the same from the saved orders', () => {
    const cmds: Array<{ t: number; c: Command }> = [];
    // With the organ stage, as the game is played (Nov 23 2026: the harder first waves beat the scripted player without
    // its organs before its second draft).
    const a = new Sim({ ...CFG, seed: 11, organStage: true, directive: { kind: 'hold', waves: 12 } });
    const issue = a.issue.bind(a);
    a.issue = (c: Command) => { cmds.push({ t: a.tickCount, c: structuredClone(c) }); return issue(c); };
    const bot = new Autoplayer(11);
    let n = 0;
    // The scripted player builds; the drafts are placed turned, away from the offer's own place where they can be.
    for (let k = 0; k < 60_000 && n < 3 && a.outcome === 'playing'; k++) {
      if (a.phase === 'draft' && a.pendingDraft) {
        const own = a.pendingDraft[0].slot;
        const places = a.draftPlacements(0);
        const alt = places.find((p) => p.rot !== 0 && p.slot !== own) ?? places.find((p) => p.rot !== 0) ?? places[0];
        expect(a.issue({ kind: 'choose-plate', index: 0, slot: alt.slot, rot: alt.rot }).ok).toBe(true);
        n++;
        continue;
      }
      bot.act(a, DT);
      a.tick();
    }
    expect(n, `outcome ${a.outcome} wave ${a.waveNumber} phase ${a.phase}`).toBeGreaterThanOrEqual(2);
    const b = new Sim({ ...CFG, seed: 11, organStage: true, directive: { kind: 'hold', waves: 12 } });
    replayRun(b, { cmds, ticks: a.tickCount });
    expect(b.map.slots.map((x) => x?.pattern.id ?? null)).toEqual(a.map.slots.map((x) => x?.pattern.id ?? null));
    expect(b.map.cells).toEqual(a.map.cells);
    expect(Array.from(b.map.heights)).toEqual(Array.from(a.map.heights));
    expect(b.time).toBe(a.time);
    expect(b.towers.length).toBe(a.towers.length);
  }, 180_000);

  it('no burrow while a district is being placed (its openings would move under it)', () => {
    const s = new Sim({ ...CFG, seed: 3 });
    openDraft(s, new Rng(3));
    expect(s.issue({ kind: 'burrow', cell: 0 }).err).toBe('place the district first');
  });
});
