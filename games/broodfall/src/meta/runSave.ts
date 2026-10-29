/**
 * A DEPLOYMENT SAVED MID-RUN (Collins, Oct 29 2026: "in the settings menu that appears when you hit escape there is not
 * an easy way to save and exit to desktop or main menu"). The sim is deterministic (src/sim/rng.ts: it never touches
 * Math.random), so a run is saved as what made it: its config, every order the player gave with the tick it was given
 * at, and how many ticks it ran. Loading builds the same Sim and plays those orders back (about a second for an
 * hour's run). One run is kept: a new deployment replaces it, a finished one clears it.
 */
import type { Command, SimConfig } from '../sim/types';

export interface RunSave {
  v: 1;
  /** The address the run was played at (its seed set), so the page around the board is the same one. */
  search: string;
  kind: 'campaign' | 'skirmish';
  /** A campaign run's territory (the pending deployment it belongs to). */
  territory?: string;
  cfg: SimConfig;
  /** Every order, at the sim tick it was given at (ticks counted by Sim.tickCount). */
  cmds: Array<{ t: number; c: Command }>;
  ticks: number;
  speed: number;
  wave: number;
  savedAt: number;
}

const KEY = 'broodfall-run-save';

export function loadRunSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    const r = raw ? (JSON.parse(raw) as RunSave) : null;
    return r && r.v === 1 && r.cfg && Array.isArray(r.cmds) ? r : null;
  } catch { return null; }
}

export function saveRunSave(r: RunSave): void {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* not kept: private mode, a full disk */ }
}

export function clearRunSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* ok */ }
}

/** Something that plays orders into a sim and ticks it (a Sim; an interface so the tests can hold it to this). */
export interface Replayable {
  tickCount: number;
  outcome: string;
  tick(): void;
  issue(c: Command): unknown;
}

/**
 * Play a saved run into a fresh sim built from its config: each order at its tick, then on to the saved tick count.
 * A tick that does not advance (a district draft waiting for its pick, the setup held for the player) stops the
 * catch-up there, as it did in play: the next order is what moved it on.
 */
export function replayRun(sim: Replayable, save: Pick<RunSave, 'cmds' | 'ticks'>): void {
  const upTo = (t: number) => {
    while (sim.tickCount < t && sim.outcome === 'playing') {
      const before = sim.tickCount;
      sim.tick();
      if (sim.tickCount === before) return;
    }
  };
  for (const { t, c } of save.cmds) {
    upTo(t);
    sim.issue(c);
  }
  upTo(save.ticks);
}
