/**
 * THE MAIN PLOT: WHICH OF THE ROACH KING'S PIECES, WHEN (Oct 1 2026; paced Oct 5 2026). Pure: no DOM.
 *
 * The game runs two plots that take turns (Collins, Oct 5 2026: "lets build in the pacing ... better to leave them
 * wanting more than less"): the ally's on the odd captures after the pledge (content/campaign.ts), his on the captures
 * between. From the third capture, every second capture earns the main plot one piece, played after that deployment's
 * news (src/ui/roachKing.ts), in the order of MAIN_PLOT. A counter-attack massing takes the next slot with Operation Take
 * It Back. Nothing of his once the ally's finale is played but the two scenes before the last mission and, at the very
 * end, the broadcast going off the air. A slot with nothing left in MAIN_PLOT stays empty: those slots are the ones still
 * to be written (notes/MISSIONS-AND-AFTER-TODO-2026-10-05.md).
 */
import { ROACH_ADDRESSES, ROACH_SCENES, type RoachAddress, type RoachScene } from '../../content/roachKing';
import type { CampaignState } from './campaign';

/** What the player has been shown, kept per campaign (by its seed). */
export interface RoachLog { seed: number; seen: string[] }
export const emptyRoachLog = (seed: number): RoachLog => ({ seed, seen: [] });

/** The capture after which he first comes on the air, and how many captures apart his pieces come. */
export const MAIN_PLOT_FIRST = 3;
export const MAIN_PLOT_EVERY = 2;
/** The main plot in order. 'ally' is his piece on the player's ally at the time. */
export const MAIN_PLOT = ['rk-address', 'rk-draft', 'rk-briefing', 'ally', 'rk-stand'] as const;
/** Every piece that takes a main-plot slot (the order's, every ally's, the counter-attack's). */
const SLOT_PIECES = new Set<string>([...MAIN_PLOT, 'rk-counter', ...ROACH_ADDRESSES.filter((a) => a.when === 'ally').map((a) => a.id)]);

/** The main-plot slots the campaign has reached. */
export const mainPlotSlots = (s: CampaignState): number =>
  s.captures < MAIN_PLOT_FIRST ? 0 : 1 + Math.floor((s.captures - MAIN_PLOT_FIRST) / MAIN_PLOT_EVERY);

const allyPiece = (s: CampaignState): RoachAddress | undefined => (s.faction ? ROACH_ADDRESSES.find((a) => a.when === 'ally' && a.faction === s.faction) : undefined);

/** What plays after this deployment's news: one piece at most, or null. */
export function dueAfterDeployment(s: CampaignState, log: RoachLog): { address: RoachAddress } | { scene: RoachScene } | null {
  const seen = (id: string) => log.seen.includes(id);
  if (s.ended) { const off = ROACH_ADDRESSES.find((a) => a.when === 'offline'); return off && !seen(off.id) ? { address: off } : null; }
  if (s.finale) return null;
  const played = log.seen.filter((id) => SLOT_PIECES.has(id)).length;
  if (played >= mainPlotSlots(s)) return null;
  const counter = ROACH_ADDRESSES.find((a) => a.when === 'counter');
  if (seen('rk-address') && counter && !seen(counter.id) && (s.underAttack || s.staging)) return { address: counter };
  for (const id of MAIN_PLOT) {
    if (id === 'ally') { const a = allyPiece(s); if (a && !seen(a.id)) return { address: a }; continue; }
    if (seen(id)) continue;
    const sc = ROACH_SCENES.find((x) => x.id === id);
    if (sc) return { scene: sc };
    const a = ROACH_ADDRESSES.find((x) => x.id === id);
    if (a) return { address: a };
  }
  return null;
}

/** His address due after this deployment (null when none, or when it is a scene off the air). */
export function dueAddress(s: CampaignState, log: RoachLog): RoachAddress | null {
  const d = dueAfterDeployment(s, log);
  return d && 'address' in d ? d.address : null;
}
/** The scene off the air due after this deployment (the briefing), or null. */
export function dueScene(s: CampaignState, log: RoachLog): RoachScene | null {
  const d = dueAfterDeployment(s, log);
  return d && 'scene' in d ? d.scene : null;
}

export const logRoach = (log: RoachLog, a: { id: string }): RoachLog => ({ ...log, seen: log.seen.includes(a.id) ? log.seen : [...log.seen, a.id] });

/** The scenes that play when the last mission is launched, in order, that this campaign has not been shown: the call, then his last message. */
export function lastMissionScenes(log: RoachLog, all: RoachScene[] = ROACH_SCENES): RoachScene[] {
  return (['last-call', 'last-address'] as const).flatMap((w) => all.filter((x) => x.when === w && !log.seen.includes(x.id)));
}
