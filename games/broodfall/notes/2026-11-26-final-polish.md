# Final polish playtest, Nov 26 2026

Collins (Malcolm) asked for the final polish: "I hate play testing but otherwise brood fall is close to done... can
you do the final polish for me?" Played in the real page by real clicks and keys at 1366x768. The page was a headless
Chrome on a vite server with hot reload off. Screenshots: `notes/screens/2026-11-26/`.

The PC had other work on it (Blender, Brave). A page load of the game needs about 4 GB for a short time, so a memory
guard closed the browser when less than 2.5 GB was free. The guard stopped the run three times.

## Checks

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 89 files, 969 tests pass (before the second set of fixes).
- After the second set: the campaign, defence, directives-hobby, hits, lastMission, media, sacrifice-pay,
  onboarding and previewStats tests pass (10 files, 117 tests).

## Fixed: first set (mission 1 to wave 1, commit 0fe137ab)

1. A two-line hint covered the view buttons. The buttons now read the hint height (`--hint-h`).
2. The placing hint said "click one of your limbs to feed it in" with no limb on the board.
3. The placing readout said "reach 95" next to a limb card that said "3.7 cells". It now gives cells.
4. Mission 1 cards said EAT A LIMB before the game teaches eating.
5. "ASSAULT FROM S" now reads "ASSAULT FROM THE SOUTH".

Seen in this pass: items 1, 3 and 5 hold in a skirmish (`01-placing-hint-and-reach.jpg`). Outside mission 1 the cards
show EAT A LIMB, which is correct.

## Fixed: second set (skirmish seed 11 and 12, waves 1 and 2, organ stage two times, loss report)

6. **The Chyme tile jumped in a wave.** Each tick scales the number by 1.18. The number spanned the whole tile and
   grew from the middle, so its digits jumped onto the left edge. "+N this wave" also sat in the dot's column and
   pushed the "◆ CHYME" label right. Fix: `src/hud/themes/ship.css`, the number is as wide as its text and grows from
   the left, and the gain line spans the tile. Before: `03-chyme-tile-before.jpg`. After, five frames in a wave
   with a tick: `04-chyme-tile-after.jpg`.
7. **The feed covered the board.** A wave of kills stacked nine lines, mostly the same "resource acquired — 2 war + 1
   ◆ chyme", over the right of the board (`02-wave2-feed-before.jpg`). Fix: `src/ui/hud.ts pushEvents`, the same
   line again counts on the newest line ("specimen neutralized — war caste ×4") and stays up 6.5 s from the last one.
   Seen in play.
8. **The end-of-run report did not fit 1366x768.** The hand of limb cards stayed under the report and took its room,
   so the report scrolled and RETURN TO SHIP floated over the limb tiles and a heading (`06-report-before.jpg`).
   Fix: `src/screens.css`, the hand bar is hidden while the report is open (as in the ship), and the pinned button
   has a dark band the width of the card behind it. After: the report fits with no scroll (`07-report-after.jpg`). At
   1366x600 it scrolls, and the band hides the lines under the button (`08-report-short-window-after.jpg`).
9. **"1 WAVES REPELLED".** The report's figures now say "1 wave repelled" and "1 district held".

## Persona passes

**Newcomer.** The hints tell me what to do at each step: pick a card, click a creeped block, start the wave. The
organ stage tells me why a spot is wrong ("every cell must be open ground, and it must touch the meteor or an
organ"). Confusing: in wave 1, two Responders stood at the core, just outside my Lasher's 2.1-cell reach, and ate
the core for about 60 s. Each is about 8 px tall at 1366x768, under the core picture. I saw the integrity bar fall
and could not see why. Not fixed (finding A).

**Genre veteran.** Waves are discrete, with a forming banner, a count of what comes, a countdown to start and a
clear. Limbs stand beside the street. Leaks hurt the core. The between-wave shop (the organ stage) shows what each
buy gives and why a level is what it is ("VENOM SAC LV2 (LV1 bought, +1 from the Sewer Main)"). The convention
checklist (`references/CONVENTIONS.md`) was not walked item by item in this pass.

**Breaker.** Never buy organs: lost at wave 2 in two of two runs on seed 11 (three Lashers, and no limbs at all). A
third run on seed 11 bought a Venom Sac after wave 1 and had two Lashers and a Spitter: it cleared wave 2 with 912 of
1500 core left. Two runs are not proof, but no cheap line won.

## Open findings (all three fixed on Nov 27: see the last section)

- A. A Responder that parks at the core is hard to see and can sit just outside a limb's reach. A pointer to the
  thing that hits the core, or a larger mark on it, would help.
- B. At 1366x768 the organ stage cuts four names ("METEOR C…", "NERVE CLUST…", "MARROW VAU…", "DIGESTIVE LINI…").
  A NEW badge also covers part of a name.
- C. Before wave 2 the top bar says "WAVE 1 · TIER 0" under "ASSAULT FORMING". It counts the waves done, but it
  reads as the wave that comes next.

## The district draft (after wave 3), second session the same day

More memory was free (11 GB). Skirmish seed 11 on the full art board, played two times to the wave 3 draft: a
Lasher before wave 1, a Venom Sac after wave 1, a Spore Bladder after wave 2, limbs placed by real clicks.

- The draft opens after wave 3 with three districts and what each gives (`09-draft-after-wave3.jpg`). Picking one
  opens the placing panel. The board shows the green slot it fits, and a wrong slot says why ("A district already
  stands here"). The district goes down by a click, and the organ stage follows. No console errors.
- The Spore Bladder uncovers the "?" cell it touches ("ANCIENT ROYAL TOMB: +1 ROYAL POINT",
  `13-organ-stage-bladder-and-tomb.jpg`). For about half a second after a buy, the new organ's cells are black while
  its picture loads.
- The "WAVE 3 CLEARED" banner fades out behind the draft for about 3 s. Not changed.

10. **Fixed: the placing panel was khaki paper.** `#place-district` came on Nov 22, after the Sep 30 pass that made the
    screens round the board dark glass. So in the ship HUD it was the one khaki panel between the dark draft and the
    dark board (`10-place-district-before.jpg`). Fix: `src/ui/districtPlace.css`, a `[data-hud="ship"]` look with
    the draft cards' glass, lines, font and white buttons. `?hud=classic` keeps the paper. After, seen in a new page
    load: `11-place-district-after.jpg` (fits) and `12-place-district-after-wrong-slot.jpg` (does not fit).

Not a game fault: a run that held 175 Chyme unspent and placed limbs far from the new district's street lost at wave 4.

There is no cheat menu. For later passes, the test hook `window.broodfall.sim` can set `coreHp` and `meat.war` in a
test page, which reaches the later screens faster. Screenshots from such a run are not a player's run.

## Automated checks on 5f77eb8a (the newest game code)

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `npx vitest run` | PASS, 89 files, 969 tests |
| `npm run test:endgame` | PASS: a run won at 16.3 min, and the end screen showed |
| `npm run test:input` | FAIL, 4 of 19 steps. The same 4 fail on 842d1159, before this polish. The check grows all ten organs before wave 1, but since Nov 23 (`5a838630`, the shelf) most organs open after wave 2, 3 or 4. The Sling and Lobber steps need those organs, and then the check stops at a `sim is not defined` error in its own code. The check is out of date, not the game. |
| `npm run test:visual` | FAIL, 2 of 13: "sim advanced" (36 s of game time, the check wants 60) and "biomass accrues" (43, it wants 50). The run used the installed Chrome without a graphics card, so the game ran slower than 8x. On 842d1159 the check timed out at page load, so this pass does not show if these 2 are older. |

These three browser checks first ran with a temporary Chrome fallback. They ran again on the new harness (next
section) with Playwright's own Chromium 153.0.8010.12, and the results were the same: input 15 pass and 4 fail, visual
11 pass and 2 fail (38 s of game time, biomass 46), endgame pass.

### The browser checks are the same on every PC

Bruno (Nov 26 2026): "make the three browser checks os-agnostic, defaulting to windows; that way both malcolm and
myself execute the same test and ensure there's no drift due to test setup". The setup of all three checks is now in
one file, `tools/check-harness.mjs`:

- One browser on every PC: Playwright's own Chromium, the build that package-lock.json pins (1.63.0, Chromium
  153.0.8010.12). No fallback to an installed Chrome. If it is missing, the check stops and gives the install command.
- One server start: node runs `vite preview` itself, with no npx and no shell, and the check stops the whole process
  tree at the end. Before, on Linux, the preview outlived the check and blocked the next check's port.
- Windows is the reference: its netstat/taskkill path is unchanged. Off Windows, lsof (or fuser) and a process group
  do the same work.
- Each check prints a SETUP line (OS, node, Playwright, Chromium, port), so two runs can be compared.

Seen on Linux: a check frees a port that another process holds, starts the preview, and stops it at the end. With
no Playwright Chromium it stops in 2 s with the install command. After `npx playwright install chromium` (about 300 MB),
all three checks ran on it and printed `SETUP linux x64 · node v22.22.1 · playwright 1.63.0 · chromium 153.0.8010.12`.
No preview was left on the port. The harness is not yet tested on Windows.

### The input and visual checks fixed

The game was right in both. The checks were out of date or depended on the PC:

- **Input, grow all organs.** Since the shelf (Nov 23) only four organs are on it before wave 1. The check now opens
  the whole shelf first (`sim.cfg.unfold = false`), as a run that does not unfold has it. The Sling and Lobber steps,
  which need those organs, pass again.
- **Input, `sim is not defined`.** A line from the Chyme commit (Nov 22) wrote `sim.chyme` for `b.sim.chyme`.
- **Input, directional placement.** With all organs grown, the step can draw a Conduit (an elbow of three cells) or a
  Skipper (1 by 2). It picked the first cell a one-cell limb fits on. It now picks a cell where the drawn limb fits
  facing the gate and one quarter turn on, and finds the placed limb by its family.
- **Input, organ stage wait.** 5 s to 15 s: the first open loads the stage's pictures, and one run took over 5 s.
- **Visual, sim advanced.** It waited 20 s of clock time and wanted 60 s of game time. At 8x that is about 160 s on a
  fast PC but 36 to 38 s here. It now waits for 60 s of game time (2 min of clock time at most), so every PC checks
  the same game state. Here it took 36 s. Biomass then passes too (83).

Result on Linux, Chromium 153.0.8010.12: input 18 of 18, visual 13 of 13, endgame 2 of 2. The input check passed in
three runs, the visual check in two. Not yet run on Windows.

## Nov 27 2026: the open findings, the core bar, and the release checks

### Fixed (each seen in the page, each its own commit)

| Commit | What |
|---|---|
| 5538084a | C. Between waves, the line names the wave to come: "WAVE 2 OF 12". It shows that wave's tier and no risk. |
| 2e88bc24 | B. An organ name wraps to a second line. It is never cut. NEW moves to the price line. |
| b4b6e216 | A. An enemy that hit the core in the last 2 s gets a red ring. The ring turns white when the limb in hand reaches it. After 5 s out of reach, the hint says THE CORE IS BEING EATEN. |
| 4398ae8f | Bruno's request. A bar over the core shows its health, for example "1384 / 1500". A hit leaves a fading band. A heal shows "+N" in green. The core does not heal between waves. Only the Queen's Heart decree heals it. |
| ed58a6f0 | The ASSET INTEGRITY label keeps its number on one line. The Windows build showed it broken. |

### Checks on that code

| Check | Result |
|---|---|
| Full test suite | PASS: 91 files, 976 tests. |
| Build | PASS. |
| Input, visual and endgame checks | PASS: 18, 14 and 2 steps. The memory guard stopped one endgame run during a Unity job of another session. The next run passed. |
| YOKE's live mind on rfab.ai | PASS. Two lines, said through the game's own link code and the dev proxy. Her first sentence came after 1.3 s and 1.8 s. The game waits 45 s. The replies had 13 and 16 sentences, and all came through. Her history held both replies whole. The key was Bruno's, made for this test. This test did not use the page, because of memory. |
| The Windows build under Proton 11.0 | PASS. Electron 45.1.0 for Windows ran a build made on Linux. The platform was Win32, and WebGL ran on the GPU through Direct3D 11. A first launch played the opening film. Esc gave mission 1 on the painted board, with the core bar. `Play Broodfall.bat` started electron.exe on its own folder. The game server answered in 16 s. |
| Save and resume | PASS. A Lasher went down by clicks, and wave 1 began. Then the page went to the menu. RESUME DEPLOYMENT brought back the same seed, wave, WAR and Lasher (cell 476). The run went on from tick 47. |

Proton is not Windows itself. This test did not cover Broodfall.lnk. Malcolm still needs to start the game once on his
PC before a release.

## Not verified in this pass

- Mission 2 and later, the last mission, the ending films, the ship after each mission.
- A skirmish won by hand to 12 waves, with its drafts after waves 3, 6 and 9.
- YOKE's live mind in the page itself (the page display passed with a faked stream on Nov 26).
- The release build: there is no packaged desktop game (no installer, no Steamworks) yet.

## Nov 28: the organ pictures, and every key remappable

- **Organ pictures off their cells.** Bruno saw this in a full-screen Chrome window. The cause was the text size, not
  the window. Text size zooms the organ card, and the canvas that draws the living organs mixed zoomed and unzoomed
  pixels, so it came out 1.15 to 1.3 times too big. `src/ui/underAlive.ts` converts the sizes now. Input check
  step 8 opens the stage at text size 1.30 in a 1920 by 1080 window and checks the canvas against the grid.
- **Every key remappable** (Bruno: "all keyboard commands should be remappable"; the rule is in the repo CLAUDE.md).
  One table, `src/meta/keys.ts`, holds 36 actions. Settings > KEYS shows each one with a button. Space pauses during
  a wave and steps between waves. Z, X and V set 1×, 3× and 8×. Input check step 7 tests the speed keys, the Space
  pause and a pause key given in Settings.
- **Checks:** all 92 test files pass, the input check passes (22 steps), and the visual check passes. The checks keep
  Chromium in `~/.local/share/ms-playwright`, because a cleanup deleted `~/.cache/ms-playwright` two times.
