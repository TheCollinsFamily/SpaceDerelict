# Seen in the game on Sep 30 2026

Every picture here is a screenshot of the real game in a browser, taken by a scripted beat in `tools/`. Sessions append their rows.

| Files | What was asked | What to look for |
|---|---|---|
| **`screens-01`, `screens-02`** | a title screen with a logo and menu art; the name is a working title | the key art (the brood falling on an insect town, no lettering in it), the emblem, and BROODFALL set in TYPE over it (`src/ui/screens.ts` GAME_NAME: renaming is one line); 02 is 1280x720 |
| `screens-03` to `screens-05` | a loading screen | the network throttled to about 6 Mbit/s, deploy clicked at once: the loading screen with its file count and bar (03, 04), then the board when the art is in (05) |
| `screens-06` to `screens-08` | the district draft shows no art of the plate | a real run played into its first draft: each plate drawn from its own layout in the board's tile set, a map of where it grows; 07 close up; 08 after a plate is clicked |
| `screens-09`, `screens-10` | the debrief as pictures, not text on a card | the skirmish report lost (a real loss, played) and won: the outcome's newsreel still with the verdict in type, a photograph of the board at the end, the limbs grown (standing, kills), every kind the colony sent (dead); `-card` files are the card alone |
| `screens-11`, `screens-12` | the same for the campaign | the campaign report, territory taken and deployment failed, on the ship's glass |
| `screens-13` | pictures on the organ cards | the Gene Bay: every organ card with its organ's scan picture |
| `screens-14` to `screens-19` | error screens | each failure forced: the art list missing (14) with PLAY WITHOUT THE PICTURES (14b the plain menu, 15 the plain board); some pictures missing (16, a line over the board); the game's code failing while it loads (17); no WebGL (18: PixiJS draws on a plain canvas, a line says it will be slow and how to mend it); nothing to draw with at all (19) |
