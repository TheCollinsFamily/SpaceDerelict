# Loading audit — every wait in Broodfall (Oct 1 2026)

Collins (Sep 30 2026, on `notes/screens/2026-09-30/pad-lost.mp4`): "we had a loading screen here without a looping
animation — that should never happen; the reason we have the RFab API (among others) is to create those nice looping
animations to engage users during load."

**The headline loader is the SCAN loop** (Collins, Oct 1 2026: "the loading animations look INCREDIBLE — that one with
the alien thing being scanned"): first load and the longest waits; its look is the reference for any further loader.

**The rule now:** no wait is ever a still screen. Every wait shows a loop (`src/ui/loader.ts`), with the progress bar
where there is real progress; a wait under 400 ms shows nothing (no flash); the loops' own first paint is a ~100 KB
animated WebP preloaded by `index.html`, so the loader is never itself the thing still loading; Reduce motion plays a
slow version, never a still frame. The beat `node tools/shot-loading.mjs` fails when a wait is on the screen for over
400 ms without a loop that moves.

## What pad-lost.mp4 showed (frames read at 2 fps)

| time | what was on the screen | what was wrong |
|---|---|---|
| 0.0–1.4 s | the menu, NEW CAMPAIGN clicked | (the page changing) |
| 1.5–9.5 s | "PREPARING THE DEPLOYMENT": the emblem, a bar, "54 / 98 FILES", a line | **the static loading screen**: the emblem still (a 5 % CSS pulse that reads as a still picture), eight seconds of it |
| 16–17 s | the report | — |
| 21.6–22 s | the ship drawn with no art yet: a khaki console, the planet's projection box empty, YOKE's intercom stage an empty dark box | **a still, bare wait**: the ship's pictures and the planet still arriving; her first clip not yet in |

## Every wait the player can see, and what covers it now

| # | wait | where in the code | covered by | proof |
|---|---|---|---|---|
| 1 | **First load of a page that starts a deployment** (NEW CAMPAIGN, a campaign run, DEPLOY from the ship, a redeploy, TRY AGAIN after a fault): the page before its code has arrived, then the board's art (~95 files) | `index.html` #boot + its inline script; `src/ui/screens.ts` LoadingScreen; `src/main.ts` boot() | the **scan** loop as the headline (Collins's favourite), the **emblem** loop in the logo, the **creep** loop dim behind, the real file count and bar, the Navy's lines. In the markup (the scan's and emblem's first paints embedded), shown before the game's code runs | `loading-first-1-at-once.jpg`, `loading-first-2-scan-headline.jpg`, `loading-first-3-progress.jpg`, `loading-first-4-board.jpg`, `loading-first.mp4` |
| 2 | **Menu → mission** (SKIRMISH clicked before the board's art is in) | `main.ts` setupMenu | the same screen, only if the art is still coming after 400 ms; a click made before the game's code has arrived (slow line) is kept, the screen up at once, and replayed | `loading-fast` check: with the art in, nothing flashes |
| 3 | **Pad → report**: the pad clip still arriving at the run's end (up to 4 s) | `src/ui/padOutro.ts` playPadOutro | `shipLoop()`: the **scan** loop, or **YOKE dancing** about one wait in three, "PREPARING THE FIELD REPORT" | `loading-pad-lost.mp4` |
| 4 | **The report's pictures** being made | `main.ts` reportWait / campaignDebrief | a scan loop in the pictures' place (mission 1, skirmish); a cover (campaign) | `loading-pad-2-report.jpg` |
| 5 | **Report → ship**: the news from the planet loading | `src/ui/newsreel.ts` newsAfterDeployment | `shipLoop()`, "PREPARING THE NEWS FROM THE PLANET" | — (instant when cached) |
| 6 | **The ship before its art** (the rooms, the planet for the globe; this was the bare khaki frame) | `src/ui/campaignUi.ts` show() / `artWait` | `shipLoop()` over the screen, "PREPARING THE SHIP", until the art and the globe are in | `loading-pad-3-ship-arriving-yoke-dances.jpg`, `loading-pad-4-ship.jpg` |
| 7 | **The globe** (the planet's textures) | the same | the same cover (the desk is not shown before its globe) | as 6 |
| 8 | **YOKE connecting**: her stage before her first clip has a picture (the empty dark box) | `src/ui/yokeAvatar.ts` | her **thinking** loop's first paint stands in for her | `loading-yoke-1-connecting.jpg`, `loading-yoke-2-arrived.jpg`, `loading-yoke.mp4` |
| 9 | **YOKE thinking** (her mind answering) | `yokeAvatar.ts` onThinking | her own `thinking` clip (already a loop) | — |
| 10 | **Ship → deployment** (DEPLOY): a new page | as 1 | as 1; the LANDING FILM session's film takes the run start once its file is in — it covers the gap before with `showLoader('creep')` (HANDOFF) | `loading-pad-5-next-deployment-loading.jpg`, `loading-pad-6-next-board.jpg` |
| 11 | **A newsreel's first shot** buffering (was black for up to 2.5 s) | `newsreel.ts` film() show() | a scan loop in the middle | `loading-reel-1-buffering.jpg`, `loading-newsreel.mp4` |
| 12 | **A shot stalling** mid-film (newsreel, ending film, the opening cinematic) | `newsreel.ts`, `intro.ts` | `watchBuffering`: a small scan loop in the corner over the frame that holds | `loading-reel-3-ending-film-buffering.jpg` |
| 13 | **The organ stage opening** before its pictures are in (seen on the slow link: the meteor core's cell black, the organ cards' pictures empty, the shapes missing, for ~2 s) | `src/main.ts` openUnder / underArt (underground.ts untouched: another session's) | its stills (~1 MB of the stage's 14 MB) are fetched 1.5 s after the board is up; opened before they are in, the **scan** loop covers its grid, "PREPARING THE ORGAN STAGE", until they are | `loading-organ-1-opening.jpg`, `loading-organ-2-open.jpg`, `loading-organ.mp4` |
| 14 | **Settings apply** | `src/ui/settings.ts` | no wait: applied in place (no reload); RESET reloads → 1 | — |
| 15 | **Fault → TRY AGAIN** | `screens.ts` showFailure | a reload → 1 | — |
| 16 | **The main menu** before its viewport loop plays | `src/ui/menu.ts` | not a wait: the ship's exterior picture is its background until the loop plays | — |

## The loops (tools/art/loaders.mjs, RFab image-to-video, start frame = end frame)

| loop | made from | loop | full / first paint |
|---|---|---|---|
| emblem | the emblem itself (art-src/screens/emblem.png), 5 s 720p, keyed with Leaflit's ChromaKey, despilled | ping-pong (the model did not land on the end frame) | 1.48 MB webm (alpha) / 129 KB mini + a 29 KB micro EMBEDDED in index.html |
| creep | a new still of the creep from above, 6 s 720p (the first take grew a black worm: art-src/loaders/v1/) | ping-pong | 479 KB / 61 KB |
| scan | a new still: the asset's outline on the console's scan grid, 6 s 720p | seamless | 382 KB / 38 KB |
| dance | YOKE's Leaflit sprite (art-src/yoke/idle-framed.png), a new 6 s take, keyed + her projection look | seamless | 824 KB (alpha) / 60 KB |
| yoke | her own `thinking` clip (public/art/ship/yoke/thinking.webm), only made small | her own | her clip / 107 KB |

Every loop's `-slow.webp` (Reduce motion) is the same frames at a third of the speed. A keyed loop's first paint is
laid on the dark it is shown on (WebP alpha is lossless and five times the bytes). No lettering in any loop (the lines
are set in type); no religious symbol. Review sheets: `notes/art-review/loaders/`.
