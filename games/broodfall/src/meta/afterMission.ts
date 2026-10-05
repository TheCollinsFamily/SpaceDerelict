/**
 * WHAT PLAYS WHEN HE COMES BACK FROM A MISSION (Collins, Oct 5 2026: "are they wired up to play after a certain number
 * of missions ... and the other not coming at the same time as a faction vid ... how does our system even handle that
 * to make sure they get one unique thing after every mission?"). Pure: no DOM.
 *
 * The game runs two plots side by side: the main plot (the Roach King, a few escalations) and the faction plots. A return
 * to the ship carries ONE story film at most:
 *   - the ally's scenes that THIS mission made due (a beat, the finale, the midpoint's offers) are the film of that
 *     return: they play on the ship (src/ui/campaignUi.ts);
 *   - a Roach King piece that is due waits for a return with no new faction scene (the gaps between the ally's beats
 *     are where the main plot moves), except the end of his broadcast, which follows the campaign's last mission;
 *   - YOKE's greeting is every return's, and is not said twice in a campaign while she has one she has not said
 *     (src/meta/onboarding.ts `greetingFor`).
 * The planet's news of the mission plays first on every return, whatever else comes (src/ui/newsreel.ts).
 * Measured over whole campaigns: tools/measure/after-mission.measure.ts.
 */
import type { CampaignState } from './campaign';
import { dueAfterDeployment, type RoachLog } from './roachKing';

type Pending = CampaignState['pendingScenes'][number];
const key = (p: Pending) => `${p.faction}|${p.beat ?? ''}|${p.scene.film ?? p.scene.title}`;

/** The faction scenes this mission made due (not those still waiting from before, nor a signal's first call). */
export function newFactionScenes(prev: CampaignState, next: CampaignState): Pending[] {
  const before = new Set(prev.pendingScenes.map(key));
  return next.pendingScenes.filter((p) => !p.contact && !before.has(key(p)));
}

export interface AfterMission {
  /** The faction scenes that play on the ship this return (their films, or their cards). */
  faction: Pending[];
  /** The Roach King's piece that plays after the news this return (an address, or a scene off the air), or null. */
  roach: string | null;
  /** A due Roach King piece held back because a faction scene has this return. */
  roachWaits: string | null;
}

export function afterMission(prev: CampaignState, next: CampaignState, log: RoachLog): AfterMission {
  const faction = newFactionScenes(prev, next);
  const due = dueAfterDeployment(next, log);
  const id = due ? ('scene' in due ? due.scene.id : due.address.id) : null;
  const ending = !!due && 'address' in due && due.address.when === 'offline';
  if (id && faction.length && !ending) return { faction, roach: null, roachWaits: id };
  return { faction, roach: id, roachWaits: null };
}
