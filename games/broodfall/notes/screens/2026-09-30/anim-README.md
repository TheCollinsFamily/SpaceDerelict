# Do the limbs and the core animate? (Sep 30 2026)

Three videos of the real game (DEV server, Chromium with the GPU on, Chrome's own screencast at 22–58 captured fps, written as 30 fps H.264):

| Video | What it shows |
|---|---|
| `anim-01-limbs-idle-close.mp4` (15.6 s) | 12 limbs on creeped roofs next to the core (maw, frond, spitter, lobber, ocular, impaler, prism, choir, bombard, mosaic, ember, quill), name tags under each, close zoom, camera still, the wave held back so only idles play, 1x speed |
| `anim-02-core-stages.mp4` (20 s) | the core idling 5 s at each stage 1 → 2 → 3 → 4 (the growing clips between them are cut out; the view pulls back for the taller stages 3 and 4) |
| `anim-03-siege.mp4` (20 s) | the scripted player's run (seed 3, megacity, hold-12 directive) in wave 5 at 1x, three notches in from Home on the fight: 8 limbs, 9 soldiers in, 18 more queued |

Made by `node tools/shot-anim.mjs [limbs core siege]`. The numbers below come from `node tools/art/idle-loops.mjs`, which measures every idle loop straight from the atlases (all 37 limbs, front and back, and the 4 core stages). A per-limb motion trace over anim-01 (mean pixel change between video frames, in a box round each limb) was used to check that what the atlas says is what the page shows.

## Verdict

**Everything animates. Nothing is frozen.** Every limb and every core stage plays its idle on a loop at 1x, and the siege is busy: lashers whip, limbs play their fire clips, soldiers walk and fight, the creep spreads and pulses. But the motion has **two clear faults**, and they sort almost exactly by the idle's fps:

1. **The fast idles (8–12 fps, loops of 1.3–1.8 s) pop.** They drift one way for the whole loop and never come back, so the last frame is far from the first and the picture **jumps back every loop**. In anim-01 it is plain to see and measurable: lobber, maw, prism and mosaic show a spike in motion at exactly their loop period (every 1.33–1.42 s, 11 times in 15 s); between the pops they barely move. Worst by seam size / step size: mosaic 5.4, lobber 5.0, maw 4.9, prism 4.6, capacitor 4.5, then boomerang, blighter, conduit, sprout (2.8–3.2). Same fault, milder, on quill, ocular, spitter, mister (about 2), and on several back views (skipper 3.5, ocular 3.1, ember 2.7). A pop every 1.4 s is the most visible thing wrong with the board's motion.
2. **The slow idles (4.2–4.8 fps) step.** Each pose is held about 240 ms and the poses are far apart, so the motion reads as a stop-motion throb rather than breathing. These are the ones that move MOST (bombard's whole sac swells and sinks, frond's spines light up, ember's pods glow on and off). They loop cleanly (seam no bigger than a step). Steppiest: quill back (step 30, twice anything else), press, twin, net, lobber back, mitosis, brood, bombard, tangler, frond, lasher, ember front.

Only a few are **close to static** at game zoom (under 3% of the sprite changes per step): capacitor, mosaic (only the glow crawls across it), blighter, conduit, swamp, amp front, prism, and the back views of ember, lance, maw and skipper. Most of these are also fast-and-popping, so what you see is "still, still, jump".

**The core is the best-behaved thing on the board.** All four stages loop cleanly (seam no bigger than a step: 0.8, 0.9, 0.4, 0.35), the heart's pulse and glow read clearly at close zoom and at home zoom (in anim-01 the stage-2 heart visibly brightens and dims). Stages 1–3 run at 5.2–5.5 fps, so close up the pulse is a little steppy; stage 4 (22 frames at 7.6 fps) is the smoothest. The cuts between stages in anim-02 are video cuts, not jumps in the game.

**The siege** (anim-03) reads as alive: lashers' tentacles sweep, limbs change pose as they fire, soldiers move as a column and bunch up at the front with hit sparks, the creep's edge moves. At this zoom the soldiers are about 15 px tall, so a death is a flicker, not something you watch; the limbs' idle pops are less noticeable here than close up because the fire clips interrupt them.

## Rank: what would most improve the motion (no new art needed for 1–4)

1. **Ping-pong the popping idles** (play 0→15→0, or 0→15 then 14→1): removes the jump every 1.4 s on the 13 front and 3 back idles marked SNAP below, and doubles their loop to 2.7–3.6 s, which also makes them calmer. A flag per clip in the manifest (`"pingpong": true`) and one line in `frameOf` (`src/render/isoRender.ts`). The alternative, cross-fading the last 4–5 frames into the first when the atlas is baked, keeps the loop length but costs a rebake.
2. **Interpolate the slow idles to 2–3x the frames** (16 → 32/48 frames at the same loop length, 8.5–14 fps) with a frame interpolator (RIFE/FILM) at bake time. This is the fix for the STEPPY list and for core stages 1–3. It is the most work and the biggest gain on the limbs that move the most. A cheaper stopgap: in the renderer, draw the next frame over the current one with alpha = the fraction between them (a two-sprite cross-fade). It works well for glows and breathing (ember, frond, core) and ghosts a little on big shape changes (bombard, quill back, press).
3. **Tie the idles to real time, not to the game clock.** The idle clock is the sim clock (`isoRender.ts` line ~1259, "a paused game stands still"), so at 3x and 8x every idle plays 3–8x faster: a 12 fps loop becomes 96 fps, a 4 fps one 33 fps, and the board looks frantic. Keep pause as a freeze, but cap the idle rate at about 1.5x of the art's speed. The same line also speeds an idle up to 2.5x when the limb is buffed; that is a good idea but it multiplies with the game speed.
4. **Stagger by more than 0.37 s.** Each limb starts its idle 0.37 s × its id later; on a 1.33–1.4 s loop that offset wraps round, so some pairs of the same family land nearly in step. Minor, but a row of the same limb pulsing in step reads as mechanical. A random phase per limb (from its id) fixes it.
5. **More movement in the near-static families** (this one IS new art, later): capacitor, blighter, conduit, amp, swamp, mosaic (let the whole globe breathe, not only the glow), and the back views of ember, lance, maw, skipper. Until then, a small procedural breathing scale (±1.5% at 0.3 Hz, per limb phase) in the renderer would give them life for free.

Not faults: faint horizontal streaks show up in the raw atlases of the core stages and the maw when the alpha is thrown away; they have alpha 8 or less and are invisible in the game (checked in the videos).

## Every idle, measured

step = mean change per frame step (0–255, over the sprite's opaque pixels); seam = change from the last frame back to the first; seam/step ≥ 2 = a visible pop at every loop; moving area = share of the sprite that changes noticeably per step. Verdicts: SNAP (seam/step ≥ 2), STEPPY (step ≥ 13 at ≤ 6.5 fps), BARELY MOVES (moving area < 3%).

| limb | side | fps | loop (s) | step | seam | seam/step | moving area | verdict |
|---|---|---|---|---|---|---|---|---|
| amp | front | 8 | 2.00 | 4.5 | 6.8 | 1.50 | 2.6% | BARELY MOVES |
| amp | back | 4.17 | 3.84 | 11.6 | 13.2 | 1.14 | 12.5% | ok |
| blighter | front | 8.73 | 1.83 | 3.9 | 12.2 | 3.10 | 2.2% | SNAP, BARELY MOVES |
| bombard | front | 4.17 | 3.84 | 14.4 | 9.6 | 0.67 | 15.7% | STEPPY |
| boomerang | front | 12 | 1.33 | 5.5 | 17.8 | 3.21 | 4.0% | SNAP |
| brood | front | 4.92 | 3.25 | 14.5 | 19.2 | 1.32 | 16.9% | STEPPY |
| brood | back | 4.47 | 3.58 | 10.9 | 14.6 | 1.34 | 12.0% | ok |
| burster | front | 4.17 | 3.84 | 8.0 | 7.7 | 0.96 | 7.8% | ok |
| cage | front | 4.17 | 3.84 | 11.3 | 12.7 | 1.13 | 12.5% | ok |
| capacitor | front | 11.29 | 1.42 | 3.5 | 16.0 | 4.54 | 1.2% | SNAP, BARELY MOVES |
| choir | front | 6 | 2.67 | 8.9 | 7.6 | 0.85 | 8.4% | ok |
| conduit | front | 8.73 | 1.83 | 4.4 | 13.2 | 2.97 | 2.3% | SNAP, BARELY MOVES |
| conduit | back | 7.11 | 2.25 | 8.1 | 6.9 | 0.84 | 8.3% | ok |
| ember | front | 4.17 | 3.84 | 13.1 | 19.9 | 1.52 | 13.7% | STEPPY |
| ember | back | 10.67 | 1.50 | 3.4 | 9.1 | 2.73 | 1.0% | SNAP, BARELY MOVES |
| frond | front | 4.57 | 3.50 | 13.8 | 17.5 | 1.26 | 19.2% | STEPPY |
| impaler | front | 4.47 | 3.58 | 7.9 | 5.6 | 0.72 | 7.6% | ok |
| impaler | back | 4.36 | 3.67 | 10.6 | 8.2 | 0.77 | 10.7% | ok |
| lance | front | 4.47 | 3.58 | 6.8 | 7.1 | 1.05 | 6.5% | ok |
| lance | back | 11.29 | 1.42 | 3.0 | 5.5 | 1.83 | 1.1% | BARELY MOVES |
| lasher | front | 4.17 | 3.84 | 13.6 | 18.6 | 1.37 | 16.5% | STEPPY |
| lobber | front | 12 | 1.33 | 5.0 | 24.8 | 4.99 | 3.9% | SNAP |
| lobber | back | 4.27 | 3.75 | 16.2 | 11.8 | 0.73 | 19.3% | STEPPY |
| lure | front | 4.47 | 3.58 | 11.6 | 21.1 | 1.82 | 11.6% | ok |
| maw | front | 11.29 | 1.42 | 4.4 | 21.7 | 4.93 | 3.3% | SNAP |
| maw | back | 11.29 | 1.42 | 4.1 | 7.9 | 1.93 | 2.4% | BARELY MOVES |
| mister | front | 8.73 | 1.83 | 5.4 | 11.8 | 2.20 | 3.6% | SNAP |
| mitosis | front | 4.68 | 3.42 | 14.8 | 18.0 | 1.21 | 18.1% | STEPPY |
| mosaic | front | 11.29 | 1.42 | 3.7 | 19.9 | 5.43 | 1.3% | SNAP, BARELY MOVES |
| net | front | 4.27 | 3.75 | 16.0 | 8.8 | 0.55 | 18.3% | STEPPY |
| ocular | front | 6.4 | 2.50 | 13.3 | 27.7 | 2.09 | 16.7% | SNAP, STEPPY |
| ocular | back | 10.67 | 1.50 | 9.0 | 28.1 | 3.12 | 10.6% | SNAP |
| press | front | 4.8 | 3.33 | 16.3 | 4.8 | 0.29 | 19.3% | STEPPY |
| press | back | 4.47 | 3.58 | 18.4 | 16.4 | 0.89 | 23.1% | STEPPY |
| prism | front | 12 | 1.33 | 4.9 | 22.6 | 4.64 | 2.8% | SNAP, BARELY MOVES |
| quill | front | 5.49 | 2.91 | 12.3 | 26.3 | 2.13 | 11.9% | SNAP |
| quill | back | 4.36 | 3.67 | 29.8 | 36.9 | 1.24 | 28.3% | STEPPY |
| reliquary | front | 4.17 | 3.84 | 5.5 | 8.7 | 1.59 | 4.0% | ok |
| skipper | front | 4.27 | 3.75 | 11.3 | 5.4 | 0.48 | 12.0% | ok |
| skipper | back | 11.29 | 1.42 | 4.4 | 15.4 | 3.54 | 2.6% | SNAP, BARELY MOVES |
| sling | front | 4.17 | 3.84 | 12.0 | 6.8 | 0.56 | 14.5% | ok |
| sling | back | 6.4 | 2.50 | 10.7 | 13.9 | 1.30 | 11.5% | ok |
| spine | front | 4.17 | 3.84 | 8.4 | 7.9 | 0.94 | 8.1% | ok |
| spitter | front | 6 | 2.67 | 6.6 | 13.7 | 2.06 | 6.4% | SNAP |
| spitter | back | 6 | 2.67 | 6.2 | 9.7 | 1.57 | 5.0% | ok |
| sprout | front | 10.11 | 1.58 | 6.8 | 19.1 | 2.82 | 6.4% | SNAP |
| swamp | front | 7.68 | 2.08 | 4.1 | 3.8 | 0.91 | 2.5% | BARELY MOVES |
| tangler | front | 5.33 | 3.00 | 13.9 | 15.4 | 1.10 | 17.5% | STEPPY |
| tap | front | 4.68 | 3.42 | 8.1 | 12.4 | 1.53 | 7.1% | ok |
| tap | back | 4.8 | 3.33 | 9.9 | 9.7 | 0.98 | 9.1% | ok |
| twin | front | 6 | 2.67 | 16.8 | 16.5 | 0.98 | 17.8% | STEPPY |
| ward | front | 5.49 | 2.91 | 6.5 | 9.8 | 1.51 | 6.0% | ok |
| core-1 | front | 5.19 | 3.08 | 11.2 | 8.9 | 0.80 | 13.6% | ok |
| core-2 | front | 5.49 | 2.91 | 12.9 | 11.9 | 0.93 | 18.0% | ok |
| core-3 | front | 5.33 | 4.13 | 10.6 | 4.4 | 0.41 | 13.8% | ok |
| core-4 | front | 7.58 | 2.90 | 11.7 | 4.1 | 0.35 | 16.6% | ok |
