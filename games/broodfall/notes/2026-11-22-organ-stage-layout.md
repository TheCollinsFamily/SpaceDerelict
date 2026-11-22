# The organ stage's layout, levels and placing (Nov 22 2026)

Collins, playtesting on a 2781x1401 window: "this is an AWFUL use of screen real estate for this page and how we handle
the organ list vis-a-vis where they are placed (also why is it displaying the towers I can place that turn and elements
of the main game phase's UI?)"; then "the change when something that can only have one of it has been placed is not
super obvious ... the cost for upgrading it is not obvious the benefits of upgrading it are not obvious how to upgrade
it (clicking again) is not working"; and the heart placeable left/right of a Tendril Root but not under it.

Screens: `notes/screens/2026-11-22/organ-stage-BEFORE-*.png` and `organ-stage-AFTER-*.png` (1366x768, 1920x1080,
2781x1401; `-card-hover` and `-grid-hover` at 1920 show the level readout). Beat: `tools/shot-organ-layout.mjs`.

## What was wrong, measured (BEFORE)
- The stage was a 1240px box at every window size (1240x1151 on his 2781x1401): the grid 754x419 everywhere.
- The organ list was 1568px tall in a box that scrolled; 10px names.
- The battle HUD stayed: the hand, the wave bar, START THE WAVE, the dials and speed.
- The grown organ's card said "click it to level" and the click did nothing (`.built` cards were ignored).
- The ghost anchored at the shape's top-left corner on the hovered cell, so a two-wide heart hovered under a root ran
  right of the pointer; with rock (or an organ) there it showed red though one cell left (still under the pointer) grows.
  The rule itself (`Sim.canBuildOrgan`) and the click always agreed with the ghost; on seed 7 at three window sizes
  every hover point in the cells left, right and under a root showed what the rule says (`tools/probes/organ-clicks.mjs`).

## AFTER
- The stage fills the window; grid 750x416 (1366x768), 1061x589 (1920x1080), 1675x929 (2781x1401).
- All 28 cards (27 organs + the Meteor Core) on screen with no scroll at all three sizes; names 11.6 / 15 / 16 px.
- Battle HUD hidden while it is open and back on TO THE SURFACE; WAR and SCI in the stage's head row.
- Grown theme organs (and the meteor): a lit card with ✓ LV n and the next level's price and gain; card click levels;
  hover readout: level now, next price, the limbs it powers, +10% power +10% speed, drawn more, affordable or not.
- Placing finds the legal placement under the pointer on every side; preview and click share `placementAnchor`.

## Personas
- Newcomer: the tray reads as a shop, the board is the biggest thing, the readout under it says what the hovered card
  or cell does. The one question left: the summary's "BONE FORGE LV2" when the card says LV 1 (the heart's zone adds a
  level); not changed here.
- Genre veteran (town stage of Ball x Pit, city-builder build menus): build menu beside the map, owned/levelled state
  on the card, price and gain before the click, no battle UI in the town. YES on each, from the AFTER screens.
- Breaker: clicking a theme organ while holding a heart used to try to grow the heart (refused) and felt like a dead
  click; it now puts the heart down and says how to level. A misclick never spends meat.
