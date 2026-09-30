/**
 * WHICH NEWS, WHEN (Sep 30 2026; content/media.ts). Pure: no DOM. After a deployment, the planet's
 * news of it: the moments of the deployment, most telling first, and the first piece that fits one
 * of them (never the piece shown last; a story piece only once in a campaign; one not yet seen
 * before one that has been; the other side's before the side shown last). src/ui/newsreel.ts plays it.
 */
import { MEDIA, type MediaPiece, type Moment } from '../../content/media';
import type { CampaignState, Debrief } from './campaign';

/** What the player has been shown, kept per campaign (by its seed). */
export interface MediaLog { seed: number; seen: string[]; last: string | null; empireShown: number }

export const emptyLog = (seed: number): MediaLog => ({ seed, seen: [], last: null, empireShown: 0 });

/** The moments of a deployment, most telling first (content/media.ts `Moment`). */
export function momentsOf(prev: CampaignState, next: CampaignState, d: Debrief): Moment[] {
  if (d.first) return [];
  const m: Moment[] = [];
  if (d.lost) m.push('retaken');
  if (d.repelled) m.push('repelled');
  if (next.faction) m.push(`ally:${next.faction}`);
  for (const b of next.beatsSeen) m.push(`beat:${b}`);
  if (d.deskOpened) m.push('desk-open');
  if (d.captured) m.push(`capture:${d.captured}`);
  if (next.underAttack && next.underAttack !== prev.underAttack) m.push('counter');
  if (d.captured) m.push('capture');
  if (!d.captured && !d.repelled) m.push('lost');
  return m;
}

export interface Pick {
  piece: MediaPiece;
  /** The break: the whole reel replayed after it, ungraded, with no narrator and no music (DESIGN.md "Tone stack"). */
  replay: boolean;
}

/** The piece for these moments, or null (nothing fits: no news this time). */
export function pickMedia(moments: Moment[], log: MediaLog, all: MediaPiece[] = MEDIA): Pick | null {
  const lastSide = all.find((p) => p.id === log.last)?.side;
  for (const moment of moments) {
    const fit = all.filter((p) => p.when.includes(moment) && p.id !== log.last && !(p.once && log.seen.includes(p.id)));
    if (!fit.length) continue;
    const score = (p: MediaPiece) => (log.seen.includes(p.id) ? 2 : 0) + (p.side === lastSide ? 1 : 0);
    const piece = [...fit].sort((a, b) => score(a) - score(b))[0];
    // Every fourth Empire reel from the third on (one without a break shot of its own) is replayed with the filter off.
    const replay = piece.kind === 'reel' && piece.side === 'empire' && !piece.shots.some((s) => s.raw) && log.empireShown % 4 === 2;
    return { piece, replay };
  }
  return null;
}

/** The log after a piece was shown. */
export function logShown(log: MediaLog, p: MediaPiece): MediaLog {
  return {
    ...log,
    seen: log.seen.includes(p.id) ? log.seen : [...log.seen, p.id],
    last: p.id,
    empireShown: log.empireShown + (p.kind === 'reel' && p.side === 'empire' ? 1 : 0),
  };
}
