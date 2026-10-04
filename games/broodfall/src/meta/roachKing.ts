/**
 * WHICH OF THE ROACH KING'S ADDRESSES, WHEN (Oct 1 2026; content/roachKing.ts). Pure: no DOM.
 *
 * After a deployment's news (src/ui/newsreel.ts), at most one of his addresses plays (src/ui/roachKing.ts):
 * the first one that is due and not yet seen in this campaign, most urgent first. None before the
 * campaign's third deployment: Collins, "I would not have him come in until a couple missions in".
 * Every address after the first waits for the first: he introduces himself before he does anything else.
 */
import { ROACH_ADDRESSES, ROACH_SCENES, type RoachAddress, type RoachScene, type RoachWhen } from '../../content/roachKing';
import { FACTIONS, HOME } from '../../content/campaign';
import type { CampaignState } from './campaign';

/** What the player has been shown, kept per campaign (by its seed). */
export interface RoachLog { seed: number; seen: string[] }
export const emptyRoachLog = (seed: number): RoachLog => ({ seed, seen: [] });

/** The deployment after which he first comes on the air. */
export const FIRST_ADDRESS_AFTER = 3;
/** Territories held (the crash site not counted) for the draft, and for the last stand of a campaign with no ally. */
export const DRAFT_HELD = 3;
export const STAND_HELD = 8;

/** Most urgent first: the ending, the last stand, his introduction, then the rest in the order they tend to come. */
const ORDER: RoachWhen[] = ['offline', 'stand', 'address', 'counter', 'ally', 'draft'];

const heldOut = (s: CampaignState) => s.held.filter((h) => h !== HOME).length;

/** The beats of a faction he has seen. */
function beatsOf(s: CampaignState, faction: string): number {
  const f = FACTIONS.find((x) => x.id === faction);
  return f ? f.beats.filter((b) => s.beatsSeen.includes(b.id)).length : 0;
}

/** Is this address due now (not counting whether it has been seen)? */
export function isDue(a: RoachAddress, s: CampaignState): boolean {
  if (s.deployments < FIRST_ADDRESS_AFTER) return false;
  switch (a.when) {
    case 'address': return true;
    case 'draft': return heldOut(s) >= DRAFT_HELD;
    case 'counter': return !!s.underAttack || !!s.staging; // the colony massing (src/meta/defence.ts) is its telegraph
    case 'ally': return !!a.faction && s.faction === a.faction && beatsOf(s, a.faction) >= 2;
    case 'stand': {
      // Not once the ally's finale is played: his last words are the call and the Founding Day address (ROACH_SCENES).
      if (s.ended || s.finale) return false;
      if (s.faction) { const f = FACTIONS.find((x) => x.id === s.faction); return !!f && f.beats.every((b) => s.beatsSeen.includes(b.id)); }
      return heldOut(s) >= STAND_HELD;
    }
    case 'offline': return !!s.ended;
  }
  return false;
}

/** The address to play after this deployment, or null. */
export function dueAddress(s: CampaignState, log: RoachLog, all: RoachAddress[] = ROACH_ADDRESSES): RoachAddress | null {
  const introduced = log.seen.includes('rk-address');
  for (const when of ORDER) {
    for (const a of all) {
      if (a.when !== when || log.seen.includes(a.id) || !isDue(a, s)) continue;
      if (when !== 'address' && !introduced) continue;
      return a;
    }
  }
  return null;
}

export const logRoach = (log: RoachLog, a: { id: string }): RoachLog => ({ ...log, seen: log.seen.includes(a.id) ? log.seen : [...log.seen, a.id] });

// ---------------------------------------------------------------------------
// Off the air (Collins, Oct 4 2026; content/roachKing.ts ROACH_SCENES).
// ---------------------------------------------------------------------------

/** Territories held (the crash site not counted) when the briefing is caught: "have lost ANOTHER territory". */
export const BRIEFING_HELD = 5;

/**
 * The scene off the air that is due after this deployment: the briefing, once he has introduced himself and
 * BRIEFING_HELD territories are held; not once the ally's finale is played (the last two scenes are all that is left).
 */
export function dueScene(s: CampaignState, log: RoachLog, all: RoachScene[] = ROACH_SCENES): RoachScene | null {
  if (s.deployments < FIRST_ADDRESS_AFTER || !log.seen.includes('rk-address') || s.finale || s.ended) return null;
  if (heldOut(s) < BRIEFING_HELD) return null;
  return all.find((x) => x.when === 'briefing' && !log.seen.includes(x.id)) ?? null;
}

/**
 * What plays after this deployment's news: one thing at most. The briefing comes before his ordinary addresses (it is
 * the plot), but not before his introduction, his last stand or the end of the broadcast.
 */
export function dueAfterDeployment(s: CampaignState, log: RoachLog): { address: RoachAddress } | { scene: RoachScene } | null {
  const a = dueAddress(s, log);
  const sc = dueScene(s, log);
  if (sc && (!a || !(['offline', 'stand', 'address'] as RoachWhen[]).includes(a.when))) return { scene: sc };
  return a ? { address: a } : null;
}

/** The scenes that play when the last mission is launched, in order, that this campaign has not been shown: the call, then his last message. */
export function lastMissionScenes(log: RoachLog, all: RoachScene[] = ROACH_SCENES): RoachScene[] {
  return (['last-call', 'last-address'] as const).flatMap((w) => all.filter((x) => x.when === w && !log.seen.includes(x.id)));
}
