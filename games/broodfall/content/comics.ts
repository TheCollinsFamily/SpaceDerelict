/**
 * THE COMICS HE KEEPS (Collins, Oct 4 2026: "we should have somewhere in the ship interface where people can unlock
 * comics they can go back through as they play"). Each comic is earned by something that happens in play and is kept
 * for good: a lost campaign or a new one never takes it back. The shelf is the ship's COMICS screen (src/ui/comics.ts);
 * what he has is kept in its own place in the browser (src/meta/comics.ts), apart from the campaign.
 *
 * The pages are made from the scripts in comics/<id>/script.json (comics/README.md says how) and baked into
 * public/art/ship/comics/<id>/ by tools/comics/bake.mjs. `pages` is what the game loads; tests/comics.test.ts holds the
 * shipped folder to this list, both ways.
 *
 * In the order a player meets them. To add one: its folder under comics/, a row here, then the bake.
 */

export type ComicId = 'the-thing-from-the-sky' | 'a-message-from-the-boss' | 'ships-night';

/** What has happened, as far as the shelf cares (src/meta/comics.ts reads it from the save). */
export interface ComicFacts {
  /** The opening film has played, to its end or skipped. */
  introSeen: boolean;
  /** The boss's message has played (content/boss.ts). */
  bossHeard: boolean;
  /** A deployment has been won. */
  wonOne: boolean;
}

export interface ComicDef {
  id: ComicId;
  title: string;
  pages: number;
  /** One line under the title once it is his. */
  about: string;
  /** How it is earned, shown while it is locked: what to do, and nothing of what is in it. */
  locked: string;
  earned: (f: ComicFacts) => boolean;
}

export const COMICS: ComicDef[] = [
  {
    id: 'the-thing-from-the-sky', title: 'The Thing From the Sky', pages: 4,
    about: 'Luckwell Gardens, the night it came down, and the week after.',
    locked: 'Watch the opening film.',
    earned: (f) => f.introSeen,
  },
  {
    id: 'a-message-from-the-boss', title: 'A Message From the Boss', pages: 2,
    about: 'Supervisor Barnabas has read the first field report. Twice.',
    locked: 'Take the boss\'s call when you come back from your first landing.',
    earned: (f) => f.bossHeard,
  },
  {
    id: 'ships-night', title: 'Ship\'s Night', pages: 1,
    about: 'A clean deployment, and nine minutes to lights out.',
    locked: 'Win a deployment.',
    earned: (f) => f.wonOne,
  },
];

export const COMIC_BY_ID: Record<ComicId, ComicDef> = Object.fromEntries(COMICS.map((c) => [c.id, c])) as Record<ComicId, ComicDef>;

/** The files of a comic under public/art/ (src/render/art.ts artUrl): its cover and its pages, in order. */
export const comicCover = (id: ComicId): string => `ship/comics/${id}/cover.webp`;
export const comicPage = (id: ComicId, n: number): string => `ship/comics/${id}/page_${String(n).padStart(2, '0')}.webp`;
