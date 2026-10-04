/**
 * The comics he keeps (content/comics.ts, src/meta/comics.ts, src/ui/comics.ts; Collins, Oct 4 2026: "somewhere in the
 * ship interface where people can unlock comics they can go back through as they play"). These hold the shelf to what
 * makes it worth having: every comic the game lists is shipped whole and nothing else is; each is earned by something
 * that happens in play; a locked one gives nothing away; and one that is earned is never taken back.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { COMICS, COMIC_BY_ID, comicCover, comicPage } from '../content/comics';
import { earnedBy, factsOf, withEarned } from '../src/meta/comics';
import { newCampaign } from '../src/meta/campaign';

const ART = path.join(__dirname, '..', 'public', 'art');
const SHIPPED = path.join(ART, 'ship', 'comics');
const MADE = path.join(__dirname, '..', 'comics');

describe('comics: what the game ships', () => {
  it('every comic has its cover and every page it says it has', () => {
    for (const c of COMICS) {
      expect(c.pages, c.id).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(path.join(ART, comicCover(c.id))), `${c.id} cover`).toBe(true);
      for (let n = 1; n <= c.pages; n++) expect(fs.existsSync(path.join(ART, comicPage(c.id, n))), `${c.id} page ${n}`).toBe(true);
    }
  });

  it('the folder the game ships holds only what it loads', () => {
    expect(fs.readdirSync(SHIPPED).sort()).toEqual(COMICS.map((c) => c.id).sort());
    for (const c of COMICS) {
      const want = ['cover.webp', ...Array.from({ length: c.pages }, (_, i) => path.basename(comicPage(c.id, i + 1)))].sort();
      expect(fs.readdirSync(path.join(SHIPPED, c.id)).sort(), c.id).toEqual(want);
    }
  });

  it('a page is small enough to open at once and large enough to read', () => {
    for (const c of COMICS) {
      for (let n = 1; n <= c.pages; n++) {
        const kb = fs.statSync(path.join(ART, comicPage(c.id, n))).size / 1024;
        expect(kb, `${c.id} page ${n}`).toBeGreaterThan(40);
        expect(kb, `${c.id} page ${n}`).toBeLessThan(900);
      }
    }
  });

  it('what is shipped is the comic as it was made: the same number of pages as comics/<id>/pages', () => {
    for (const c of COMICS) {
      const made = fs.readdirSync(path.join(MADE, c.id, 'pages')).filter((f) => /^page_\d\d\.jpg$/.test(f));
      expect(made.length, `${c.id}: bake it again (node tools/comics/bake.mjs) and set its pages in content/comics.ts`).toBe(c.pages);
      expect(fs.existsSync(path.join(MADE, c.id, 'script.json')), `${c.id} script`).toBe(true);
    }
  });
});

describe('comics: the words on the shelf', () => {
  it('every comic has a title, a line about it and a line that says how it is earned', () => {
    expect(new Set(COMICS.map((c) => c.id)).size).toBe(COMICS.length);
    for (const c of COMICS) {
      expect(c.title.trim(), c.id).toBeTruthy();
      expect(c.about.trim().length, c.id).toBeGreaterThan(12);
      expect(c.locked.trim().length, c.id).toBeGreaterThan(8);
      expect(COMIC_BY_ID[c.id]).toBe(c);
    }
  });

  it('a locked comic gives nothing away: how it is earned never names it or says what is in it', () => {
    for (const c of COMICS) {
      expect(c.locked.toLowerCase(), c.id).not.toContain(c.title.toLowerCase());
      // nor the first words of its own line (what is in it)
      expect(c.locked.toLowerCase(), c.id).not.toContain(c.about.toLowerCase().split(/[,.]/)[0]);
    }
  });
});

describe('comics: how they are earned', () => {
  const fresh = () => newCampaign(7, { onboarding: true });

  it('the opening film gives the first one: a newcomer finds something on the shelf the first time he looks', () => {
    expect(earnedBy(factsOf(fresh(), true))).toEqual(['the-thing-from-the-sky']);
    expect(earnedBy(factsOf(fresh(), false))).toEqual([]);
    expect(earnedBy(factsOf(null, true))).toEqual(['the-thing-from-the-sky']);
  });

  it('the boss\'s call gives the comic of it, once the call has played', () => {
    const s = fresh();
    s.deployments = 1; s.onboard = { mission1: 'lost', deskOpen: false };
    expect(earnedBy(factsOf(s, true))).not.toContain('a-message-from-the-boss');
    s.said = ['boss'];
    expect(earnedBy(factsOf(s, true))).toContain('a-message-from-the-boss');
  });

  it('a save from before the shelf existed that is past its first landing has heard him', () => {
    const s = fresh();
    s.deployments = 2; s.onboard = { mission1: 'lost', deskOpen: false };
    expect(factsOf(s, true).bossHeard).toBe(true);
  });

  it('a won deployment gives the third: the first landing won, or ground taken later', () => {
    const lost = fresh(); lost.deployments = 1; lost.onboard = { mission1: 'lost', deskOpen: false };
    expect(factsOf(lost, true).wonOne).toBe(false);
    const won = fresh(); won.deployments = 1; won.onboard = { mission1: 'won', deskOpen: true };
    expect(earnedBy(factsOf(won, true))).toContain('ships-night');
    const later = fresh(); later.deployments = 3; later.onboard = { mission1: 'lost', deskOpen: true }; later.captures = 1;
    expect(earnedBy(factsOf(later, true))).toContain('ships-night');
    // an old save with no onboarding at all
    const old = newCampaign(7); old.captures = 2; old.deployments = 4;
    expect(earnedBy(factsOf(old, true))).toEqual(COMICS.map((c) => c.id));
  });

  it('every comic can be earned, and none is earned by nothing having happened', () => {
    const all = { introSeen: true, bossHeard: true, wonOne: true };
    const none = { introSeen: false, bossHeard: false, wonOne: false };
    expect(earnedBy(all)).toEqual(COMICS.map((c) => c.id));
    expect(earnedBy(none)).toEqual([]);
  });
});

describe('comics: the shelf is kept', () => {
  it('what is earned is added, in the comics\' own order, and said to be new once', () => {
    const first = withEarned({ have: [], read: [] }, ['ships-night', 'the-thing-from-the-sky']);
    expect(first.shelf.have).toEqual(['the-thing-from-the-sky', 'ships-night']);
    expect(first.fresh.sort()).toEqual(['ships-night', 'the-thing-from-the-sky']);
    const again = withEarned(first.shelf, ['ships-night', 'the-thing-from-the-sky']);
    expect(again.fresh).toEqual([]);
    expect(again.shelf).toEqual(first.shelf);
  });

  it('a comic is never taken back: a new campaign that has earned nothing leaves the shelf as it was', () => {
    const kept = { have: ['the-thing-from-the-sky', 'a-message-from-the-boss', 'ships-night'], read: ['ships-night'] };
    const after = withEarned(kept, earnedBy(factsOf(newCampaign(9, { onboarding: true }), true)));
    expect(after.shelf).toEqual(kept);
    expect(after.fresh).toEqual([]);
  });

  it('a comic the game no longer has is dropped from what was kept, and nothing else is', () => {
    const after = withEarned({ have: ['a-comic-that-was-cut', 'ships-night'], read: ['a-comic-that-was-cut', 'ships-night'] }, []);
    expect(after.shelf).toEqual({ have: ['ships-night'], read: ['ships-night'] });
  });
});
