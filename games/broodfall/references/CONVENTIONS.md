# TD genre conventions — checklist (per PLAYTEST_PROTOCOL.md)

Reference wall: `reference-td-map.png` (Collins, Sep 26 2026 — the bar for map structure),
Tower Dominion / Nordhold (expansion drafting), Kingdom Rush (lanes and telegraphs).

Assessed against live play + `tools/screenshots/beat-*.png`. Every iteration re-runs this list.

| # | Convention | Status Sep 26 2026 | Evidence |
|---|---|---|---|
| 1 | Towers stand BESIDE the path, never in it (walls excepted) | YES (enforced: shooters Block-only; audited in placement runs) | beat-3, terrain audit test |
| 2 | Paths are carved channels through raised buildable ground | YES (sunken streets, raised blocks with faces/shadows) | beat-3 |
| 3 | Verticality: raised build spots, mechanically meaningful | YES (heights 1-3, +10% range per level, autoplayer prefers) | beat-5; sim statsOf |
| 4 | Paths wind; switchback pockets create prime real estate | YES (hand-authored plate patterns) | plates.ts, beat-5 |
| 5 | Lanes merge at architectural chokepoints | PARTIAL (confluence merging only when drafted plates route through shared approaches; start plate has 4 separate exits) | beat-5 |
| 6 | Map starts small and EXPANDS by player draft | YES (district draft every 3 waves, 3 offers, camera grows) | beat-4 |
| 7 | Waves are discrete: telegraph, assault, cleared-banner, reward | YES (ASSAULT FORMING + banners + wave bonus + call-early) | beat-3/5; rhythm test |
| 8 | Distinct build phase vs combat phase | YES (growth countdown / siege; researchers only in growth) | rhythm test |
| 9 | Placement measurably matters | YES (guardrail: outcome flips smart 2 : 1 random, smart 7/8 wins) | tests/placement.test.ts |
| 10 | Complete loop: menu → run → debrief → meta → next run | YES (menu, debrief, ship gene bay, standing persists) | beat-1, beat-6/7 (prior shoot) |
| 13 | Blocks are typed by openings; openings centered; opening-to-opening only; no blocked openings | YES (canPlace algebra + invariant test) | plates.test.ts |
| 14 | Run starts with a district beyond every entrance (guns before contact) | YES (pre-placed connector ring) | beat-2b-onegate-start |
| 15 | Entrance count is a chosen difficulty wager with a reward modifier | YES (insertion profile: 1-3 gates, +25% meat each) | menu/ship pickers |
| 11 | Block-vs-street read stays clear UNDER the creep at far zoom | WEAK — membrane helps but at 3+ districts the distinction blurs | beat-5 |
| 12 | The city looks alive before you eat it | PARTIAL (doorway lights; no wandering civilians yet) | beat-2 |

Known WEAK/PARTIAL items are the top of the next iteration's list.

## Moving between a base's rooms (added Oct 4 2026 for the ship's arrivals)

Reference games, from knowledge of them (no screenshots were collected this iteration): XCOM 2's Avenger (the camera goes
to the room, its screen comes up on arrival, a second click cuts it short), Darkest Dungeon's hamlet (a building opens at
once, with a short settle), Hades' House (the hero walks to each station himself).

Assessed against live play (`node tools/shot-ship-arrivals.mjs`) and `notes/screens/2026-10-04/arrivals/`.

| # | Convention | Status Oct 4 2026 | Evidence |
|---|---|---|---|
| 16 | A change of menu is never held up by its animation: the new screen answers the first click | YES (the screen is the new room's in 81 to 144 ms; it answered a click mid-walk in 7 of 7 rooms tried) | beat `tour` |
| 17 | A transition ends exactly on the resting picture | YES (each clip's last frame is 42.1 to 45.9 dB from its loop's first; the watched hand-over changes by at most 2.4 of 255 between two pictures in a row, a real jump being 15 and up) | `tests/shipArrivals.test.ts`, beat `tour` |
| 18 | A change of mind mid-transition restarts cleanly | YES (the other room's walk takes over, one clip, nothing left behind; fourteen rooms in under three seconds end on one loop) | beats `switch`, `break` |
| 19 | It is short, and it can be turned off | YES (3.7 to 3.8 s, in his place by about 2 s; Settings > Reduce motion shows the room's still) | beat `calm` |
| 20 | The person on screen is the same person in every transition | YES by eye (black shirt, sleeves up, the stylus behind his ear) | `notes/art-review/ship-arrivals/*-strip.jpg` |
| 21 | Leaving is shown as well as arriving | NO (he is in one room, then walks into the next: a cut) | persona notes, Breaker |
| 22 | A repeated transition varies | NO (one take a room) | persona notes, Veteran |

## A collection he keeps, and a reader for it (the comics shelf, Oct 4 2026)

References: Hades' codex (every entry there is, the locked ones saying what fills them), a vault of unlockables on a
game's hub screen (the door carries the count of what is new), a comic reader's guided view (one control reads on,
the end of an issue offers the next). Collins: "somewhere in the ship interface where people can unlock comics they
can go back through as they play".

Assessed against live play (`node tools/shot-comics.mjs`) and `notes/screens/2026-10-04/comics-*.jpg`.

| # | Convention | Status Oct 4 2026 | Evidence |
|---|---|---|---|
| 23 | A collection shows how much there is in all, and what is missing | YES ("1 OF 3 UNLOCKED", a tile for every comic) | walk A, `comics-a-shelf-one-of-three.jpg` |
| 24 | A locked entry says how it is earned and gives nothing of itself away | YES (no cover, no title, one line of what to do) | walk A, `tests/comics.test.ts` |
| 25 | What is new is marked until it is opened, and the door to the collection carries the count | YES (NEW on the tile, the number on COMICS; gone when opened, still gone after a reload) | walks A, B |
| 26 | An unlock is said at the moment it happens | YES (a notice in the corner names the comic; a click on it opens the shelf) | walk D, `comics-d-after-the-call.jpg` |
| 27 | A reader says where you are, and one control reads forward through everything | YES (PAGE 1 OF 2; a click, Space or the down arrow goes down the page and turns it at its foot) | walk B |
| 28 | The end of one hands on to the next | YES ("NEXT: SHIP'S NIGHT ▶"; "BACK TO THE SHELF" after the last) | walk B |
| 29 | A collection outlives a run | YES (kept apart from the campaign; a new campaign leaves it whole) | walk C, `tests/comics.test.ts` |
| 30 | Reading resumes where it was left | NO (a comic opens on its first page every time) | persona notes, Veteran |

