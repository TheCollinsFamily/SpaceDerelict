/**
 * DEFENCE DEPLOYMENTS — the rules (no DOM). Design: DESIGN.md "Defence deployments"; the numbers:
 * content/defence.ts. Collins, Oct 1 2026: "they usually suck to do so we should always visually warn
 * the player one 'turn' ahead with like a pushing arrow indicator from where it's being staged and you
 * can choose to just attack that territory to cancel having to play one".
 *
 * The life of a counter-attack, one deployment at a time:
 *   1. STAGED   after a capture, the colony masses on a territory next to one you hold (`staging`):
 *               the globe draws a pushing arrow from it to the ground it means to take back.
 *   2. Your next deployment:
 *        - land on the staging ground and WIN: it is yours and the counter-attack is called off;
 *        - anything else (another target, or a loss there): the attack is launched (`underAttack`).
 *   3. DUE      the deployment after: defend it (a defence deployment: one all-out siege on the board
 *               you won it on, with a grown core and a full larder), or deploy elsewhere and lose it.
 * So no defence is ever fought without a whole deployment's warning, and every one can be avoided.
 */
import { HOME, TERRITORIES } from '../../content/campaign';
import { DEFENCE } from '../../content/defence';
import type { Rng } from '../sim/rng';
import { validSnapshot, type BoardSnapshot } from '../sim/boardSnapshot';
import type { SimConfig } from '../sim/types';

export interface CounterAttack {
  /** The held territory the colony means to take back. */
  target: string;
  /** Where it is massing (a territory next to it that is not yours). */
  from: string;
}

/** What the defence rules read and write in the campaign save (a slice of CampaignState). */
export interface DefenceState {
  held: string[];
  revealed: string[];
  underAttack: string | null;
  /** The colony massing for a counter-attack: drawn one deployment ahead (none on saves from before Oct 1 2026). */
  staging?: CounterAttack | null;
  /** Where the launched counter-attack (`underAttack`) came from: the arrow keeps pointing. */
  attackFrom?: string | null;
  /** The boards remembered from wins, by territory (src/sim/boardSnapshot.ts). */
  boards?: Record<string, BoardSnapshot>;
  log: string[];
}

const byId = (id: string) => TERRITORIES.find((t) => t.id === id);
export const nameOf = (id: string): string => byId(id)?.name ?? id;

/** Where the colony can mass against a held territory: a neighbour that is not yours and that you could land on. */
export function stagingGrounds(s: Pick<DefenceState, 'held' | 'revealed'>, target: string): string[] {
  const t = byId(target);
  if (!t) return [];
  return t.neighbours.filter((n) => {
    const o = byId(n);
    return !!o && !s.held.includes(n) && !o.finaleOf && (!o.hidden || s.revealed.includes(n));
  });
}

/**
 * After a capture: does the colony stage a counter-attack, and where? The ground it can reach is
 * yours, not the crash site, not what you just took, not a finale, and next to ground it can mass on
 * (ground walled in by your own territories is safe). Null when it has nowhere to come from.
 */
export function stageCounterAttack(s: DefenceState, captured: string, rng: Rng): CounterAttack | null {
  const exposed = s.held.filter((h) => h !== HOME && h !== captured && !byId(h)?.finaleOf && stagingGrounds(s, h).length > 0);
  if (!exposed.length) return null;
  const target = exposed[rng.int(0, exposed.length - 1)];
  const grounds = stagingGrounds(s, target);
  return { target, from: grounds[rng.int(0, grounds.length - 1)] };
}

/**
 * At the end of the deployment after a staging: struck first (the staging ground taken), or launched.
 * Mutates `s`; returns what happened for the debrief.
 */
export function resolveStaging(s: DefenceState, captured: string | null): { preempted?: CounterAttack; launched?: CounterAttack } {
  const st = s.staging;
  if (!st) return {};
  s.staging = null;
  if (captured === st.from) {
    s.log.push(`The colony was massing at ${nameOf(st.from)} to retake ${nameOf(st.target)}. The asset got there first. Counter-attack cancelled.`);
    return { preempted: st };
  }
  if (!s.held.includes(st.target)) return {};
  s.underAttack = st.target;
  s.attackFrom = st.from;
  s.log.push(`The colony has marched from ${nameOf(st.from)} on ${nameOf(st.target)}. Defend it on the next deployment, or lose it.`);
  return { launched: st };
}

/** A launched counter-attack is over (defended, or the ground fell). */
export function clearAttack(s: DefenceState): void {
  s.underAttack = null;
  s.attackFrom = null;
}

/** A won deployment: remember the board (a fresh capture, or a defence won on it). */
export function rememberBoard(s: DefenceState, territoryId: string, board: BoardSnapshot | undefined): void {
  if (!board || !validSnapshot(board)) return;
  s.boards = { ...(s.boards ?? {}), [territoryId]: board };
}

/** Ground lost: its board is forgotten (taken again, it is fought for again). */
export function forgetBoard(s: DefenceState, territoryId: string): void {
  if (!s.boards?.[territoryId]) return;
  const { [territoryId]: _gone, ...rest } = s.boards;
  s.boards = rest;
}

/**
 * The run of a defence deployment: one all-out siege; the core already at stage 3; a full larder; on
 * the board remembered from the win there, or else a large city grown before the run.
 */
export function defenceConfig(s: DefenceState, territoryId: string): Partial<SimConfig> {
  const board = s.boards?.[territoryId];
  const snap = board && validSnapshot(board) ? board : null;
  return {
    directive: { kind: 'hold', waves: 1 },
    coreStage: DEFENCE.coreStage,
    coreLevel: DEFENCE.coreLevel,
    oneWave: { asWave: DEFENCE.asWave, minTier: DEFENCE.minTier, armSeconds: DEFENCE.armSeconds, lanes: DEFENCE.lanes, creepPx: DEFENCE.creepPx },
    ...(snap
      ? { board: snap, gridW: snap.w, gridH: snap.h }
      : { gridW: DEFENCE.large.gridW, gridH: DEFENCE.large.gridH, pregrown: DEFENCE.large.districts }),
  };
}

/** The larder a defence opens with, added to whatever the perks give. */
export function defenceMeat(bonus: Partial<Record<'war' | 'science' | 'royal', number>>): Partial<Record<'war' | 'science' | 'royal', number>> {
  return {
    war: (bonus.war ?? 0) + DEFENCE.meat.war,
    science: (bonus.science ?? 0) + DEFENCE.meat.science,
    royal: (bonus.royal ?? 0) + DEFENCE.meat.royal,
  };
}

/**
 * A save from before the warning existed (Oct 1 2026) may hold a counter-attack that was launched with
 * no staging. It is turned back into a staging, so it too is seen a whole deployment ahead (or
 * dropped, if it has nowhere to come from).
 */
export function migrateDefence(s: DefenceState): void {
  if (s.underAttack && !s.attackFrom) {
    const target = s.underAttack;
    const from = stagingGrounds(s, target)[0];
    s.underAttack = null;
    s.staging = from ? { target, from } : null;
  }
  if (s.staging && (!s.held.includes(s.staging.target) || s.held.includes(s.staging.from))) s.staging = null;
}
