# Placing a drafted district — playtest notes (Nov 22 2026)

Collins: "after choosing a tile set it should not auto place it but let me rotate it with R and place it where I want so
long as the placement is legal". Played in the real page with `node tools/shot-place.mjs` (seed 7, one gate and three
gates). Screens: `notes/screens/2026-11-22/place-*.jpg`.

## Newcomer
- The cards now end "FITS N PLACES · YOU PLACE IT", and the sub-line says R turns it: the next step is told before the
  click. After the click the cards step aside and a panel says PLACE THE DISTRICT with the reason in a green or red bar.
- The district is already over a place where it fits when it comes into hand (the offer's own place): the first look is
  green, so "where can it go" is answered before it is asked.
- Confusion found and fixed: a free slot beside the city across a wall used to say "none of its streets joins the city —
  turn it (R)"; turning could never help there. It now says "no street of the city leads here: a district grows where a
  street leaves the city".

## Genre veteran (Carcassonne / Dorfromantik / Islanders tile placement)
- Ghost follows the pointer and snaps to the slot: YES. Legal / illegal colour before the click: YES. Reason shown: YES.
- Rotation on a key with the other way on a modifier, and a button for the mouse: YES (R, Shift+R, right-click, ⟲ ⟳).
- Where it fits is shown everywhere at once, not found by trial: YES (green outlines; amber for "fits turned").
- Edge matching is visible: YES (mouths lit green / red with a cross / amber for a new gate).
- With the camera turned (Q/E) the ghost turns with the board and the same slot answers the same: YES (`place-e3-4b`).

## Breaker
- Click a red slot: nothing happens but the reason shakes; the draft stays open. Esc: back to the cards, nothing spent.
- Burrow while the district is in hand (it would move the openings it is checked against): refused by the sim.
- Seal the last gate on purpose: refused ("it would seal the last way in").
- Place every district at a random legal place (`GAPS_MODE=anyplace`): naive hold-12 10/10 (9/10 at the offer's own
  place), so no legal place breaks a run; walling in is as common as before (7 vs 8 events over ten runs).
- A one-gate start often fits ONE slot: the choice there is which way round, which is what the algebra allows. Not a bug.
