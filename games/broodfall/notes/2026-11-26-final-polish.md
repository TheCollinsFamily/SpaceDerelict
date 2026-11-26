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

## Open findings (not fixed)

- A. A Responder that parks at the core is hard to see and can sit just outside a limb's reach. A pointer to the
  thing that hits the core, or a larger mark on it, would help.
- B. At 1366x768 the organ stage cuts four names ("METEOR C…", "NERVE CLUST…", "MARROW VAU…", "DIGESTIVE LINI…").
  A NEW badge also covers part of a name.
- C. Before wave 2 the top bar says "WAVE 1 · TIER 0" under "ASSAULT FORMING". It counts the waves done, but it
  reads as the wave that comes next.

## Not verified in this pass

- The district draft (after wave 3): the memory guard closed the browser before wave 3.
- The desktop launcher (`node tools/shot-desktop.mjs`): it loads the full game in Electron, which needs the same
  memory, and it opens a window on the screen.
- Mission 2 and later, the win report, the ship after a run.
