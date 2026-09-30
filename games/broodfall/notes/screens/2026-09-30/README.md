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
| **`fx-01`, `fx-02`** | shots in flight were lines and dots | limbs firing at a column (`node tools/shot-fx.mjs shots`): the impaler's bone harpoon and the quill fan's quills, each turned along its flight, spit and sacs from the spitter and burster; 02 two ticks later, with splats where shots ended |
| `fx-03`, `fx-04` | lobbed shells, bile, clots | the bombard's spore shell, the skipping mortar's bone shell, a bile glob and a creep clot in the air with shadows (03); golden spore bursts and acid splashes where they land (04) |
| `fx-05`, `fx-06` | lightning arcs, the prism beam, the flame cone | the frond's forked lightning jumping on between bodies, the prisms' beams, the ocular's pale stare at a drummer, the ember sac's jet of flame, flames licking off the burning |
| `fx-07`, `fx-08` | cannon shells were a brown dot beside the barrel; sedation darts; bombs | the hive's iron cannon shell and a teal sedation dart in flight, the mortar's finned bomb lobbed at a limb (07); a blast where a shell lands (08) |
| `fx-09` | poison clouds, webs | units snared (a web over each), poisoned (a puff of poison) and burning (flames), a poison cloud and caltrop barbs on the street |
| `limbs-01-*` | 13 limbs had only an idle | engines serving a spitter play their acting clip when it fires: the amplifier's drum-skin thump, the choir's pipes, the ward's ripple when a limb under it is struck (`-ward-acting`), capacitor and conduit where they are linked |
| `limbs-02` to `limbs-04` | a limb's death | four limbs (spitter, frond, twin, burster) before, mid-withering, and as husks before they sink away |
| `limbs-05` | stolen limbs | a researcher tears out a spitter: it is pulled up, shrinks and goes with him |
| `limbs-06`, `limbs-07` | donor parts on cannibalized limbs | a maw carrying lasher, blighter and ocular pips shows a tendril, glands and an eye; a spitter with burster and quill pips, an impaler with brood eggs, a twin with an ember bladder; 07 the camera turned half a turn |
