# Persona passes: the comics shelf (Oct 4 2026)

PLAYTEST_PROTOCOL.md, step 3. Collins: "we should have somewhere in the ship interface where people can unlock comics
they can go back through as they play". Played in the real page on the dev server (what `npm start` and
`Play Broodfall.bat` run), by real clicks and keys: `node tools/shot-comics.mjs` (five walks, A to E: 50 checks, all
pass). Screens: `notes/screens/2026-10-04/comics-*.jpg`, each looked at. Permanent tests: `tests/comics.test.ts` (14).

**The player's path.** The game was started by `Play Broodfall.bat` (port 5199) and entered from the MAIN MENU by
CONTINUE, no shortcut in the address: `node tools/shot-comics-player.mjs` (7 checks, all pass;
`comics-player-1-menu.jpg` to `-4-reading.jpg`). The ship's room bar has COMICS, a save from before the shelf existed
is told what it has earned, the three comics open, Space reads through all four pages and ends back at the shelf.
The whole suite: `npx vitest run`, 64 files, 774 tests, all pass.

What was built: COMICS in the ship's room bar (beside the Limb Codex), a shelf of every comic there is, a reader, a
notice when one is earned. Three comics: The Thing From the Sky (the opening film gives it), A Message From the Boss
(the boss's call), Ship's Night (a won deployment). `src/ui/comics.ts`, `src/meta/comics.ts`, `content/comics.ts`.

## Newcomer (first time on the ship, has never heard there are comics)

- **Do I find it?** The room bar has a word, COMICS, with a `1` on it, beside the codex's glyph. A notice in the bottom
  right says NEW COMIC UNLOCKED and names it (`comics-d-after-the-call.jpg`). Either gets me there. PASS.
- **Do I understand the shelf?** Three tiles. One has a picture, a title, a line about it, NEW and "1 PAGE". Two are
  dark, say LOCKED, and each says what to do: "Take the boss's call when you come back from your first landing.",
  "Win a deployment." I know there are three and how to get the other two (`comics-a-shelf-one-of-three.jpg`). PASS.
- **Can I read it?** The page fills the window (1474 px of its 1800 at 1600 across, 1228 at 1280): the balloons are
  readable without zooming. It is taller than the window; a click on the page, Space or the down arrow moves down it,
  and at its foot turns the page (`comics-b-boss-page-1.jpg`, `comics-b-boss-page-1-lower.jpg`). PASS.
- **Do I get out?** SHELF and ✕ are in the bar; Esc goes reader to shelf to ship. PASS.
- **The real moment.** Back from a lost first landing: YOKE greets me, the boss calls, YOKE has her last word, and the
  notice comes up with the comic of the call I just took; COMICS goes from 1 to 2. PASS (walk D).
- FOUND, fixed: a click on the page first turned it outright. Anyone who clicked before scrolling lost the lower half
  of every page. A click now reads on: down the page, then over.
- FOUND, fixed: nothing said a comic had been earned except a number changing on a button. The notice was added.
- OPEN: the notice says nothing aloud. YOKE has no line about comics (none written; her words are Collins's).

## Genre veteran (collections in games: Hades' codex, a vault of unlockables, a comic reader's guided view)

Walked against `references/CONVENTIONS.md` items 23 to 30 (added this iteration):

- 23, the collection shows how much there is and what is missing: YES ("1 OF 3 UNLOCKED", a tile for each).
- 24, a locked entry says how it is earned and spoils nothing: YES (no cover, no title; a test holds the words to it).
- 25, what is new is marked until opened, and the door carries the count: YES (NEW on the tile, the number on COMICS;
  both go when it is opened, and stay gone after a reload).
- 26, an unlock is said when it happens: YES (the notice; a click on it opens the shelf).
- 27, the reader says where I am and one control reads forward: YES (PAGE 1 OF 2; click, Space or down).
- 28, the end of one hands on to the next: YES ("NEXT: SHIP'S NIGHT ▶" on the last page; "BACK TO THE SHELF" on the
  last comic).
- 29, a collection outlives a run: YES (kept apart from the campaign; a new campaign leaves all three, walk C).
- 30, reading resumes where I left off: NO. A comic opens on page 1 every time. With one and two pages it costs a
  click; it will matter when a comic is ten pages.
- FOUND, OPEN: the shelf is reachable from the ship only. The Limb Codex is also on the main menu and in a deployment.
- FOUND, OPEN: no zoom. The page is as wide as the window and no wider; on a 1024-wide window the lettering is small
  (about 15 px), readable, not comfortable.

## Breaker (trying to make it look wrong)

- Rubbish in what the browser kept (`{"have":"all of them","read":[7,null,…]}`): the shelf is worked out again from
  the save, 3 unlocked. PASS.
- A comic the game no longer has, left in what was kept: dropped, the rest stay (test). PASS.
- A page file missing (served as 404): "This page did not load. The comic is still yours…" in words, SHELF still works
  (`comics-e-page-did-not-load.jpg`). PASS. FOUND, fixed: it was a broken-picture icon.
- A double click on a tile: the comic opens once. Esc four times: closed once, the ship as it was. PASS.
- A click on a locked tile: nothing. PASS.
- 1024 x 640: the shelf is inside the window, every button of the reader's bar is on screen
  (`comics-e-reading-1024.jpg`). PASS.
- The notice while the boss's call is up: it cannot be, the comic is earned when the call ends. PASS.
- FOUND, OPEN: the notice and YOKE's "OPEN THE GENE BAY" pointer can be on screen together after the first landing:
  two things asking for a click at once. They do not overlap (bottom right, lower left); the notice goes by itself
  after nine seconds.
- FOUND, OPEN: a save from before today that is past its first landing gets all it has earned at once: one notice
  naming two or three comics. Correct, and a lot to read in nine seconds; the count on COMICS stays.
