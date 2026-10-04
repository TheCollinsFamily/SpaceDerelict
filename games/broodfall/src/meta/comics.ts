/**
 * What comics he has, and which he has not opened yet (content/comics.ts has the comics and how each is earned).
 *
 * A comic is earned by what the save says has happened, and kept in its own place in the browser: once on the shelf it
 * stays there through a lost campaign and a new one. Nothing here draws anything; the screen is src/ui/comics.ts.
 */
import { COMICS, type ComicFacts, type ComicId } from '../../content/comics';
import type { CampaignState } from './campaign';
import { introSeen, loadComics, saveComics, type ComicShelf } from './storage';

/** What the save says has happened. `intro` is the opening film (kept apart from the campaign). */
export function factsOf(s: CampaignState | null, intro: boolean): ComicFacts {
  return {
    introSeen: intro,
    // Marked when the call has played (src/ui/campaignUi.ts welcome). A save from before the shelf existed that has gone
    // out a second time came back from its first landing, and heard him then.
    bossHeard: !!s && ((s.said ?? []).includes('boss') || s.deployments >= 2),
    wonOne: !!s && (s.onboard?.mission1 === 'won' || s.captures > 0),
  };
}

export const earnedBy = (f: ComicFacts): ComicId[] => COMICS.filter((c) => c.earned(f)).map((c) => c.id);

/** The shelf after what has been earned is added to what was kept: never smaller, in the comics' own order. */
export function withEarned(kept: ComicShelf, earned: ComicId[]): { shelf: ComicShelf; fresh: ComicId[] } {
  const known = new Set<string>(COMICS.map((c) => c.id));
  const had = new Set(kept.have.filter((id) => known.has(id)));
  const fresh = earned.filter((id) => !had.has(id));
  const all = new Set([...had, ...fresh]);
  return {
    shelf: { have: COMICS.map((c) => c.id).filter((id) => all.has(id)), read: kept.read.filter((id) => all.has(id)) },
    fresh,
  };
}

export interface ShelfNow { have: ComicId[]; unread: ComicId[]; fresh: ComicId[] }

/** What he has right now. Anything newly earned is put on the shelf (and kept) by this call. */
export function shelfNow(s: CampaignState | null): ShelfNow {
  const { shelf, fresh } = withEarned(loadComics(), earnedBy(factsOf(s, introSeen())));
  if (fresh.length) saveComics(shelf);
  const have = shelf.have as ComicId[];
  return { have, unread: have.filter((id) => !shelf.read.includes(id)), fresh };
}

/** He has opened it: it is no longer marked new. */
export function markComicRead(id: ComicId): void {
  const kept = loadComics();
  if (kept.read.includes(id) || !kept.have.includes(id)) return;
  saveComics({ have: kept.have, read: [...kept.read, id] });
}
