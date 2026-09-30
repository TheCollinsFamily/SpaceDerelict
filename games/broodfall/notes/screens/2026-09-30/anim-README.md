# Do the limbs and the core animate? (Sep 30 2026)

Three videos of the real game (DEV server, Chromium with the GPU on, Chrome's own screencast at 22–58 captured fps, written as 30 fps H.264):

| Video | What it shows |
|---|---|
| `anim-01-limbs-idle-close.mp4` (15.6 s) | 12 limbs on creeped roofs next to the core (maw, frond, spitter, lobber, ocular, impaler, prism, choir, bombard, mosaic, ember, quill), name tags under each, close zoom, camera still, the wave held back so only idles play, 1x speed |
| `anim-02-core-stages.mp4` (20 s) | the core idling 5 s at each stage 1 → 2 → 3 → 4 (the growing clips between them are cut out; the view pulls back for the taller stages 3 and 4) |
| `anim-03-siege.mp4` (20 s) | the scripted player's run (seed 3, megacity, hold-12 directive) in wave 5 at 1x, three notches in from Home on the fight: 8 limbs, 9 soldiers in, 18 more queued |

Made by `node tools/shot-anim.mjs [limbs core siege]`. The numbers below come from `node tools/art/idle-loops.mjs`, which measures every idle loop straight from the atlases (all 37 limbs, front and back, and the 4 core stages). A per-limb motion trace over anim-01 (mean pixel change between video frames, in a box round each limb) was used to check that what the atlas says is what the page shows.

## AFTER: the idles fixed (Sep 30 2026, same day)

Three new reels, recorded the same way (`node tools/shot-anim.mjs limbs core siege --after`):

| Video | What it shows |
|---|---|
| `anim-11-limbs-idle-close-AFTER.mp4` | the same 12 limbs, same seed, same camera as anim-01 |
| `anim-12-core-stages-AFTER.mp4` | the core idling at stages 1 to 4, as anim-02 |
| `anim-13-siege-AFTER.mp4` | the same scripted siege as anim-03 (seed 3, wave 5) |

What was done, fault by fault:

1. **Snaps: every idle with no clean loop now plays ping-pong** (Collins: "you can fix that with a ping
   pong loop, front to back, back to front"). The bake (`tools/art/templates/limb.mjs`, `idleCut`) now
   compares frames in colour at up to 160 px over what is solid, the units of this page's table (the old
   cut compared 48 px grey thumbnails, which cannot see a glow crawl). It keeps the LONGEST window whose
   seam is at most 1.35 steps; an idle with no such window (it drifts one way all through: the maw's mouth
   widening for 4 s, the mosaic's glow crawling) is baked with `"pingpong": true` over the longest stretch
   the clip has, and the game plays it forward and back, eased at its ends (a cosine) so it breathes out
   and in instead of bouncing. 33 of the 52 limb idles play ping-pong, 19 loop cleanly. A cross-fade of the
   seam at bake was tried first on the milder ones and dropped for Collins's call. Core stages 3 and 4
   were already ping-pong (baked there and back); the game now does it, so their frames are stored once.
2. **Stop-motion: every frame of the loop is kept** (the clip's own frames at 12 fps: real in-betweens
   from the video, not interpolated; the bake used to keep 16 of up to 46), and the game **cross-fades
   frame to frame** (the next frame laid over this one at the fraction between them: a second sprite per
   limb and for the core). No frame interpolator was needed: the source clips are 24 fps. Every limb idle
   is now 12 fps (was 4.2 to 12); core stages 1 and 2 keep 37 and 35 frames (were 16), stage 3 27 and
   stage 4 19 (a picture is kept under 8,192 px a side and about 45 million pixels, what a GPU takes as
   one texture: stage 3's frames are 1,091 px).
3. **Game speed: the idles have their own clock** (`src/render/idleClock.ts`). It runs on real time at
   the game's speed measured over the last half second, capped at 1.5x, and stops dead when the sim stops
   (pause, draft). A buff no longer speeds an idle. This also fixed a fault the first reels could not show:
   the sim ticks 0.1 s at a time, so an idle on the sim's clock could only change 10 times a second.
   Firing clips still follow the game clock (they are fitted into the time before the limb fires again,
   which is game time).
4. **In step: each limb starts at its own phase**, a hash of its id (was 0.37 s x id, which wrapped).
5. **Near-still idles breathe**: an idle under 2% of it moving per step at 12 fps is baked `"breathe": true`
   and the game swells it about its foot (1.1% taller, 0.5% narrower, one breath per 3.4 s, its own phase):
   amp, blighter, burster, capacitor, conduit, mosaic, reliquary, ward, maw (front and back), ember back,
   lance back, swamp (a flat pool, so not drawn breathing).

Checked by eye: `node tools/art/idle-play.mjs <limb|core-N> [--back] [--before <old public/art>]` plays an
idle exactly as the game does (loop or eased ping-pong, cross-fade, breathing) into a 30 fps film and a
sheet of the 20 frames round its seam or turn; every idle was played before and after, and the ones that
move most (quill back, frond, maw, bombard) were looked at frame by frame at 2x: no ghosting, no doubled
spines. `node tools/art/idle-seams.mjs` prints each clip's old and new cut.

### BEFORE / AFTER

BEFORE: this page's table below (from the atlases as of commit 4af2198). AFTER: `node tools/art/idle-loops.mjs`
on the new atlases. step and seam are in the same units (mean change per frame step, 0 to 255, over the
opaque pixels): a seam of 1 step or less is invisible. A ping-pong has no seam (it turns back one step at a
time); its cycle is there and back, eased (1.3x the frames' own time). The last column is what the eye sees:
each idle played for two cycles at 30 fps the way the game draws it (`tools/art/idle-play.mjs`), the
biggest change in one 1/30 s against the mean change. A snap or a held stop-motion pose shows as 6x to 14x;
a smooth idle is 1.3x to 2.3x (a ping-pong's eased middle runs about 1.6x its mean, so ~2x is its floor).

| limb | side | BEFORE fps · loop | BEFORE step | BEFORE seam (steps) | AFTER plays | AFTER frames · fps · cycle | AFTER step | AFTER seam (steps) | on screen, worst 1/30 s over mean: BEFORE → AFTER |
|---|---|---|---|---|---|---|---|---|---|
| amp | front | 8 · 2.00 s | 4.5 | 6.8 (1.50) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 4.5 | none (turns) | 5.6x → 2.2x |
| amp | back | 4.17 · 3.84 s | 11.6 | 13.2 (1.14) | ping-pong | 46 · 12.00 · 9.75 s | 5.8 | none (turns) | 9.4x → 2.0x |
| blighter | front | 8.73 · 1.83 s | 3.9 | 12.2 (3.10) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 3.4 | none (turns) | 8.5x → 2.2x |
| bombard | front | 4.17 · 3.84 s | 14.4 | 9.6 (0.67) | loop | 46 · 12.00 · 3.83 s | 7.2 | 6.2 (0.86) | 9.3x → 1.6x |
| boomerang | front | 12 · 1.33 s | 5.5 | 17.8 (3.21) | ping-pong | 46 · 12.00 · 9.75 s | 8.6 | none (turns) | 6.4x → 2.4x |
| brood | front | 4.92 · 3.25 s | 14.5 | 19.2 (1.32) | loop | 46 · 12.00 · 3.83 s | 7.8 | 7.2 (0.91) | 10.2x → 2.1x |
| brood | back | 4.47 · 3.58 s | 10.9 | 14.6 (1.34) | loop | 43 · 12.00 · 3.58 s | 5.5 | 6.0 (1.11) | 9.4x → 1.5x |
| burster | front | 4.17 · 3.84 s | 8.0 | 7.7 (0.96) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 4.2 | none (turns) | 9.9x → 2.1x |
| cage | front | 4.17 · 3.84 s | 11.3 | 12.7 (1.13) | ping-pong | 46 · 12.00 · 9.75 s | 5.4 | none (turns) | 9.7x → 2.1x |
| capacitor | front | 11.29 · 1.42 s | 3.5 | 16.0 (4.54) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 4.5 | none (turns) | 9.0x → 1.9x |
| choir | front | 6 · 2.67 s | 8.9 | 7.6 (0.85) | loop | 32 · 12.00 · 2.67 s | 5.8 | 5.7 (0.99) | 6.2x → 1.3x |
| conduit | front | 8.73 · 1.83 s | 4.4 | 13.2 (2.97) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 3.6 | none (turns) | 8.4x → 2.1x |
| conduit | back | 7.11 · 2.25 s | 8.1 | 6.9 (0.84) | loop | 28 · 12.00 · 2.33 s | 5.7 | 7.1 (1.23) | 5.7x → 1.5x |
| ember | front | 4.17 · 3.84 s | 13.1 | 19.9 (1.52) | ping-pong | 46 · 12.00 · 9.75 s | 6.3 | none (turns) | 9.3x → 2.1x |
| ember | back | 10.67 · 1.50 s | 3.4 | 9.1 (2.73) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 3.8 | none (turns) | 6.7x → 2.0x |
| frond | front | 4.57 · 3.50 s | 13.8 | 17.5 (1.26) | ping-pong | 46 · 12.00 · 9.75 s | 7.2 | none (turns) | 10.1x → 2.0x |
| impaler | front | 4.47 · 3.58 s | 7.9 | 5.6 (0.72) | loop | 45 · 12.00 · 3.75 s | 4.1 | 4.9 (1.18) | 9.9x → 1.5x |
| impaler | back | 4.36 · 3.67 s | 10.6 | 8.2 (0.77) | loop | 46 · 12.00 · 3.83 s | 5.2 | 5.3 (1.02) | 9.6x → 1.6x |
| lance | front | 4.47 · 3.58 s | 6.8 | 7.1 (1.05) | ping-pong | 46 · 12.00 · 9.75 s | 3.8 | none (turns) | 10.8x → 2.3x |
| lance | back | 11.29 · 1.42 s | 3.0 | 5.5 (1.83) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 3.6 | none (turns) | 4.1x → 1.9x |
| lasher | front | 4.17 · 3.84 s | 13.6 | 18.6 (1.37) | loop | 46 · 12.00 · 3.83 s | 6.7 | 8.3 (1.23) | 9.7x → 1.4x |
| lobber | front | 12 · 1.33 s | 5.0 | 24.8 (4.99) | ping-pong | 46 · 12.00 · 9.75 s | 5.5 | none (turns) | 8.6x → 1.8x |
| lobber | back | 4.27 · 3.75 s | 16.2 | 11.8 (0.73) | ping-pong | 46 · 12.00 · 9.75 s | 7.6 | none (turns) | 12.1x → 2.4x |
| lure | front | 4.47 · 3.58 s | 11.6 | 21.1 (1.82) | ping-pong | 46 · 12.00 · 9.75 s | 5.9 | none (turns) | 9.7x → 1.8x |
| maw | front | 11.29 · 1.42 s | 4.4 | 21.7 (4.93) | loop + breathes | 46 · 12.00 · 3.83 s | 4.6 | 4.4 (0.95) | 10.8x → 1.4x |
| maw | back | 11.29 · 1.42 s | 4.1 | 7.9 (1.93) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 3.3 | none (turns) | 4.5x → 2.1x |
| mister | front | 8.73 · 1.83 s | 5.4 | 11.8 (2.20) | ping-pong | 46 · 12.00 · 9.75 s | 6.2 | none (turns) | 5.9x → 2.0x |
| mitosis | front | 4.68 · 3.42 s | 14.8 | 18.0 (1.21) | loop | 46 · 12.00 · 3.83 s | 8.6 | 5.9 (0.69) | 9.2x → 1.6x |
| mosaic | front | 11.29 · 1.42 s | 3.7 | 19.9 (5.43) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 4.0 | none (turns) | 12.4x → 2.3x |
| net | front | 4.27 · 3.75 s | 16.0 | 8.8 (0.55) | loop | 46 · 12.00 · 3.83 s | 7.4 | 5.6 (0.76) | 10.2x → 1.8x |
| ocular | front | 6.4 · 2.50 s | 13.3 | 27.7 (2.09) | ping-pong | 46 · 12.00 · 9.75 s | 9.3 | none (turns) | 8.4x → 2.0x |
| ocular | back | 10.67 · 1.50 s | 9.0 | 28.1 (3.12) | ping-pong | 46 · 12.00 · 9.75 s | 9.2 | none (turns) | 7.2x → 2.3x |
| press | front | 4.8 · 3.33 s | 16.3 | 4.8 (0.29) | loop | 46 · 12.00 · 3.83 s | 8.4 | 4.8 (0.57) | 9.2x → 2.0x |
| press | back | 4.47 · 3.58 s | 18.4 | 16.4 (0.89) | loop | 45 · 12.00 · 3.75 s | 9.7 | 9.8 (1.00) | 8.8x → 1.7x |
| prism | front | 12 · 1.33 s | 4.9 | 22.6 (4.64) | ping-pong | 46 · 12.00 · 9.75 s | 5.2 | none (turns) | 9.2x → 1.8x |
| quill | front | 5.49 · 2.91 s | 12.3 | 26.3 (2.13) | ping-pong | 46 · 12.00 · 9.75 s | 7.5 | none (turns) | 11.8x → 2.2x |
| quill | back | 4.36 · 3.67 s | 29.8 | 36.9 (1.24) | loop | 46 · 12.00 · 3.83 s | 13.9 | 10.4 (0.75) | 10.8x → 2.1x |
| reliquary | front | 4.17 · 3.84 s | 5.5 | 8.7 (1.59) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 3.2 | none (turns) | 10.6x → 2.3x |
| skipper | front | 4.27 · 3.75 s | 11.3 | 5.4 (0.48) | loop | 46 · 12.00 · 3.83 s | 5.5 | 5.4 (0.99) | 10.1x → 1.6x |
| skipper | back | 11.29 · 1.42 s | 4.4 | 15.4 (3.54) | ping-pong | 46 · 12.00 · 9.75 s | 5.5 | none (turns) | 6.8x → 2.1x |
| sling | front | 4.17 · 3.84 s | 12.0 | 6.8 (0.56) | loop | 46 · 12.00 · 3.83 s | 5.8 | 5.9 (1.01) | 13.3x → 1.8x |
| sling | back | 6.4 · 2.50 s | 10.7 | 13.9 (1.30) | ping-pong | 46 · 12.00 · 9.75 s | 7.0 | none (turns) | 5.9x → 1.8x |
| spine | front | 4.17 · 3.84 s | 8.4 | 7.9 (0.94) | ping-pong | 46 · 12.00 · 9.75 s | 4.3 | none (turns) | 10.2x → 1.7x |
| spitter | front | 6 · 2.67 s | 6.6 | 13.7 (2.06) | ping-pong | 46 · 12.00 · 9.75 s | 4.4 | none (turns) | 8.9x → 2.1x |
| spitter | back | 6 · 2.67 s | 6.2 | 9.7 (1.57) | ping-pong | 46 · 12.00 · 9.75 s | 4.3 | none (turns) | 6.8x → 2.1x |
| sprout | front | 10.11 · 1.58 s | 6.8 | 19.1 (2.82) | ping-pong | 46 · 12.00 · 9.75 s | 7.2 | none (turns) | 6.3x → 2.9x |
| swamp | front | 7.68 · 2.08 s | 4.1 | 3.8 (0.91) | loop + breathes | 24 · 12.00 · 2.00 s | 3.3 | 3.6 (1.09) | 5.4x → 1.5x |
| tangler | front | 5.33 · 3.00 s | 13.9 | 15.4 (1.10) | loop | 43 · 12.00 · 3.58 s | 7.6 | 9.1 (1.19) | 8.6x → 1.5x |
| tap | front | 4.68 · 3.42 s | 8.1 | 12.4 (1.53) | ping-pong | 46 · 12.00 · 9.75 s | 4.8 | none (turns) | 9.6x → 2.3x |
| tap | back | 4.8 · 3.33 s | 9.9 | 9.7 (0.98) | ping-pong | 46 · 12.00 · 9.75 s | 5.6 | none (turns) | 9.9x → 2.4x |
| twin | front | 6 · 2.67 s | 16.8 | 16.5 (0.98) | loop | 46 · 12.00 · 3.83 s | 10.9 | 6.1 (0.56) | 7.2x → 2.0x |
| ward | front | 5.49 · 2.91 s | 6.5 | 9.8 (1.51) | ping-pong + breathes | 46 · 12.00 · 9.75 s | 4.2 | none (turns) | 8.4x → 2.1x |
| core-1 | front | 5.19 · 3.08 s | 11.2 | 8.9 (0.80) | loop | 37 · 12.00 · 3.08 s | 7.5 | 5.6 (0.74) | 9.4x → 1.9x |
| core-2 | front | 5.49 · 2.91 s | 12.9 | 11.9 (0.93) | loop | 35 · 12.00 · 2.92 s | 8.5 | 9.1 (1.07) | 7.7x → 1.6x |
| core-3 | front | 5.33 · 4.13 s | 10.6 | 4.4 (0.41) | ping-pong | 27 · 12.00 · 5.63 s | 7.3 | none (turns) | 8.9x → 3.1x |
| core-4 | front | 7.58 · 2.90 s | 11.7 | 4.1 (0.35) | ping-pong | 19 · 12.00 · 3.90 s | 8.9 | none (turns) | 7.2x → 2.6x |

The BEFORE findings follow, unchanged.

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
