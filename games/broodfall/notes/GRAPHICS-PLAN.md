# Broodfall graphics plan (Sep 29 2026) — PROPOSAL

Collins: "help me think through how we build out the graphics … knowing what we have
access to with the rfab api." Then: "my intuition was buildings are better with video" and
"maybe everything is best with video".

This is the thinking, checked against the code, the RFab backend and two paid probes
(section 6). Decisions marked **OPEN** are Collins's. Nothing is built into the game yet.

**The first draft of this plan dropped video for limbs in favour of 3D models. That was
wrong.** Collins's intuition held up in the probes: video is the first choice for
everything alive on the board, and Tripo is the fallback.

## 1. Where the game is today

- Everything on the board is drawn by code, every frame, into four shared drawing layers
  (`src/render/render.ts`, 1,089 lines). Limbs are coloured circles, enemies are triangles.
- The board is flat top-down. A cell is 26 px; the camera never goes closer than 1.6×, so
  a cell is at most 42 px on screen and a limb about 45 px. A skitterling is 7 px wide.
- Collins's reference (`references/reference-td-map.png`) is a 3/4 view of chunky raised
  blocks with structures standing on flat tops. Ours is not that yet.
- The organ stage, the ship, the globe, the briefing and the debrief are HTML panels with
  no pictures.
- Two conventions are already marked weak in `references/CONVENTIONS.md`: block-vs-street
  read under creep at far zoom (#11), and a city that looks alive (#12). Both are graphics
  problems and belong to this work.

## 2. The decisions that come before any asset

Every generated picture is made FOR a camera, a size and a style. None of these needs a
generated asset to settle.

### 2a. Camera — OPEN, recommendation: isometric, settled by a grey-box test
- **Isometric** (the grid turned 45°, seen from above at an angle) matches the reference.
  Blocks show two faces and read as solid; heights 1–3 read at a glance, and height is a
  rule of the game (+10% reach per level).
- **Straight-on 3/4** (what the renderer half-fakes today) is less work but blocks show
  only their south face and look flat.
- The sim does not care: it works in grid cells. Only the renderer, the click-to-cell
  conversion and the overlays (range rings, links, fields of fire) change. The browser
  checks already go through `worldToScreen` / `toWorld`, so they follow.
- **How to settle it without spending anything:** draw today's board as plain extruded
  boxes in the isometric view, with today's circles and triangles on top, and play it.
  The question to answer is whether streets behind tall blocks stay readable.
- **With video the camera is frozen into every clip.** It must be final before mass
  production; changing it afterwards means generating everything again.

### 2b. Style — see `assets/style-bible.md`

**Superseded the same day.** Collins: "remember the 1950s horror B movie aesthetic" and
the insects "need castes that are human enough for the player to empathise with them".
The look, the caste rule, the value plan and the open calls are in `assets/style-bible.md`.
What still stands from the text below: sprites are lit evenly from overhead, and a shared
filter unifies the frame. What changed: the default look is the B-movie, and a break
moment is a second, plain render rather than a filter switched off.

#### The first draft of 2b (kept for the reasoning)
DESIGN.md's tone stack says the break moments are "the same footage with the filter off".
So the art is made ONCE, in the straight register (real, wet, unglamorous), and the goofy
propaganda look is a FILTER over the canvas (colour grade, grain, halftone, vignette) plus
the HUD. Dropping the filter is then a one-line effect, and a strong shared filter also
hides the small inconsistencies between generated assets.
- **OPEN:** whether the look of the two probe stills is the look. If not, make three
  one-page style sheets and pick one. About $1.
- Light comes from directly overhead in every still, so a mirrored sprite never looks lit
  from the wrong side.

### 2c. Size
- Raise the closest zoom so the first district fills the screen (about 68 px per cell),
  and let the canvas fill the window. The zoom-out as the body spreads then reads as growth.
- Author at 96 px per cell. Limb frames 192 px, swarm insects 64 px, the royal 256 px.
- Judge every asset at game size, never at full size: silhouette survives, fine detail does not.
- Add wheel zoom and drag pan.

### 2d. What is code and what is generated
- **Code:** the blocks themselves (flat-topped terraces at exact heights), street channels,
  creep, shadows, range rings, links, projectiles, particles, the filter, and everything
  translucent (ward bubbles, clouds, slime strands: they cannot be keyed).
- **Generated:** textures for roofs, walls and streets; roof props; limbs; insects; organs;
  card art; portraits; rooms; posters; films.
- Why blocks are code: limbs stand ON blocks, so roofs must be flat and heights exact.
- Creep is a shader driven by the sim's creep grid. RFab has no seamless-texture support,
  so a painted creep tile would show seams.

## 3. What the RFab API can do (checked Sep 29 2026)

All routes take `X-API-Key: $RFAB_API_KEY` against api.rfab.ai. Prices are RFab tokens at
retail (tokens × $0.00002); the provider's real cost is about half.

| Need | Route | Verified facts |
|---|---|---|
| Still image | `POST /api/image-generation/generate` | Send `async: true` and `imageCount: 1` (the default is 4). `openai:gpt-image-2` is the house standard: $0.012 low, $0.106 medium, $0.42 high. Seedream 4.5 $0.07. SDXL checkpoints $0.007 and they honour a seed. |
| Same style across assets | `POST /api/image-generation/img2img` with `imageUrls[]` | Up to 16 reference pictures on gpt-image-2. Passing 2–3 approved style-bible pictures with every call is the way to hold one look. No custom LoRA training exists. |
| Transparent still | `POST /api/image-generation/isolate-figure` | $0.01. Generate on a flat background, then cut out. No model returns alpha directly. |
| Video from a still | `POST /api/image-generation/generate-video` | Always send `resolution`. $0.25 for 4 s at 480p on `seegen:sd2-mini`. An END frame (`lastFrameUrl`) works only on `seegen:` models. No frame-rate or camera-lock setting: the camera is held by the prompt. About 4 minutes per clip. |
| Transparent video | none | A flat colour background plus a chroma key in ffmpeg. |
| 3D model | `POST /api/model-generation/generate` | Image to textured GLB, 30 credits (1 credit = $0.01 real). Rig 25, 10 per motion. RFab only supports two-legged rigs today. |
| Narrator voice | `POST /api/audio/synthesize`, `POST /api/voices/clone` | $0.06 per 1,000 characters. A 12–120 s sample can be cloned. |
| Music | `POST /api/music/generate`, `/songs/:id/loop` | Instrumental supported; the loop is a free crossfade. |
| Sound effects | none | No route generates sound effects. |

**On this PC:** ffmpeg 8.1.1 (full build), Playwright with Chromium, an RTX 4070, Python.
No Blender, no ImageMagick.

## 4. Video or Tripo

| | Video | Tripo |
|---|---|---|
| Best at | Wet, living motion. Surface quality comes from the still, which is far better than a Tripo texture. | The same object from any angle, exactly. Rigid, chunky things. |
| Worst at | Several angles of one thing: every angle is a separate generation. | Thin parts (legs, antennae, wings, membranes) fuse or vanish. Soft flesh comes out as a lump. |
| On RFab | Proven in production (the loading loops) and in the probes below. | Never tried on an insect. Six-legged rigs need a backend change and a deploy. The wallet is shared with production. |

**Directions.** Insects head at any angle (the sim steers each body toward the next cell's
centre from wherever it stands; fliers and climbers go in straight lines), so they get the
genre's standard 8 headings: FIVE generated views (toward, toward-left, left, away-left,
away) and three mirror images. Limbs with a facing only ever face along the grid (N, E, S,
W), which in isometric is two views and their mirrors.

| Asset | Count | Made by |
|---|---|---|
| Limbs that don't turn | 24 | Still → video: an idle loop and a firing clip |
| Limbs with a facing (the ten engines, skipping mortar, creep lance) | 12 | Still → video, two views each |
| Graft parts (what an eaten limb leaves on the new one) | 36 | Small still per donor family, cut out, pinned to standard slots |
| Insects | 26 kinds, ~18 bodies | Still → video walking in place, five views each. Ranks share a body (militia, soldier, elite: scale, tint, armour) |
| The core / meteor | 1 | Still → video |
| Blocks, streets | — | Code, with generated textures (about 12) |
| Roof props, doorway lights, street life | ~30 | Still, cut out |
| Creep, shots, hits, deaths, meat pickups | — | Code |
| Card art | 36 | The limb's own still |
| Organ stage | ~25 organs | One painted cross-section; organ flesh (a video loop) masked to each organ's exact shape in code |
| Territories, dares, experiments | ~30 | Still |
| Faction leaders, YOKE | ~12 | Still, then short loops |
| Ship rooms | 6 | Still with CSS motion first; video loops later |
| Posters, headline cards | ~10 | Still (Ideogram V4 for exact lettering) |
| Crash openings, break moments, endings | ~12 | Video |
| The globe | 1 | Generated planet texture on a real sphere |

**What to try with Tripo:** only what video fails at. If the away-facing view of an insect
will not match its toward-facing view, Tripo makes the body and a script photographs it
from both sides. It is also the natural choice for rigid things that aim (the enemy
cannons). The ladder for a Tripo insect, cheapest first: the static model and its mirror
image as a two-frame scuttle; legs stepped by code; a Tripo hexapod rig (`rig_type:
hexapod`, one motion: `preset:hexapod:walk`), which needs RFab's `tripo3dService.js` to
pass the rig type and a backend deploy.

## 5. The pipeline: still → video → key → loop → atlas

1. **Still.** Style-bible prompt plus 2–3 reference pictures, on a flat background in the
   colour farthest from the subject (green; blue for the green limbs: blight, mister,
   snare, mire). This picture is also the card art.
2. **Clip.** 4 s, 480p, square, on a `seegen:` model with the END frame set to the START
   frame. That is what closes the loop and what keeps a walker on the spot.
3. **Key and loop.** ffmpeg: drop frame 0 (it is the still itself), chroma key, despill,
   shrink to game size, pack frames into a WebP atlas, write `assets/manifest.json`.
4. **Runtime.** Pixi animated sprites. Playback speed follows the SIM: a limb with more
   tempo cycles faster, a limb in stasis freezes.

Every step is a re-runnable script in `tools/art/`, driven by the manifest, that skips
what already exists. `tools/art/probe-video.mjs` is the seed of it.

## 6. Probe results (Sep 29 2026, $0.70 of tokens)

`node tools/art/probe-video.mjs spitter-idle soldier-walk`. Pictures in
`notes/probes/2026-09-29/`. One try each, so these are existence proofs, not rates.

| Question | Result |
|---|---|
| Will gpt-image-2 draw wet flesh and chitin? | Yes, both stills on the first try, no refusal. |
| Does the flat green key cleanly? | Yes. No fringe visible at 480 px or at game size. |
| Does end frame = start frame close the loop? | Limb: yes (seam similarity 0.93 of 1). Insect: nearly (0.68): it comes back to the same spot slightly smaller and turned a few degrees. |
| Will an insect walk in place from a fixed angle? | Yes. It stayed centred for the whole clip with its legs stepping. |
| Does the camera hold? | Yes in both clips. |

What the probes taught that the plan did not know:
- **Flesh on creep has no contrast.** A red limb on red creep and a rust insect on a brown
  street both sink into the ground. Bodies need a dark rim, a ground shadow or a caste-
  coloured marker, and the contrast measurement in section 8 is not optional.
- **The motion came out too big for an idle.** Asked to "breathe", the spitter opened like
  a pine cone and closed again. That is a good FIRING clip. Idles need a quieter prompt.
- **The model repaints the background a darker green.** The key still held at the house
  settings (0.22 / 0.08), but the key colour should be sampled from the clip, not assumed.
- **The insect's loop needs a loop-point search** (find the two most similar frames and cut
  there) or a short crossfade. At 24–96 px the pop is small.
- At the smallest size (14 px) an insect is a speck. Swarm bodies read by colour and
  motion, not by drawing.

### 6b. One insect in 8 directions (Sep 29 2026, about $1.85 of tokens)

Collins: "the first test we need to run is changing the angle of the walker because we
probably want 8 animations for each unit." `node tools/art/probe-walker8.mjs` and
`node tools/art/probe-turnaround.mjs`. Pictures in `notes/probes/2026-09-29/walker8/` and
`notes/probes/2026-09-29/turnaround/`.

| Question | Result |
|---|---|
| Will it walk in place from every angle? | Yes, all four new views on the first try, about 2.5 minutes each. |
| Does the loop-point search hide the seam? | Yes. Loops of 18–28 frames; the two cut frames differ by 1–4 of 255. |
| Do 8 headings read as one insect turning? | At 24 and 48 px, yes. At 96 px and up, no: see next row. |
| Do five SEPARATE stills hold one camera? | No. Made one at a time from the first still, the side view came out nearly level with the ground and the straight-away view nearly top-down. Colour and material held; body proportions drifted. |
| Do five views in ONE picture hold one camera? | Yes, much better: same height, same size, same creature. Two faults: the "left" view came out as a second toward-left, and the two away views have four legs. |

So: swarm bodies (48 px and under) can be made from video today. Bodies the player looks
at closely (the royal, the cannons) need their angles from somewhere exact.

### 6c. What StarCraft 1 did, and what to take from it

(From how the modding community documents its files; the numbers are likely, not checked.)
Units were built and animated as 3D models, then photographed by one fixed camera into
small sprites. 32 headings, 17 stored, the rest mirrored. Short walk cycles, with the unit
moved a set number of pixels per animation frame so feet never slid. Buildings had one
facing plus overlays for working, damage and fire. Tanks were a body and a turret, each
with its own heading. One 256-colour palette for everything; team colour was a reserved
band of it. Sprites were tiny, so shapes were exaggerated.

- **Angles came from 3D.** That is the one thing pure image generation does not give us
  (6b). The hybrid to try: a rough Tripo model photographed at the five exact angles, each
  photograph used as the START FRAME of a walking clip. 3D gives the angle, video gives
  the legs, and nothing needs rigging.
- **Tie movement to the animation.** Play the walk loop at a rate set by the body's speed.
- **One facing plus overlays for buildings** is the limb plan already: a loop, a firing
  clip, grafts pinned on top.
- **One palette.** The filter (2b) should include a shared colour grade or palette, not
  only grain. It is what made 1998's assets read as one game.
- **A reserved colour band for caste.** Flesh on creep has no contrast (section 6); a
  caste-coloured rim or marking, recoloured in code, fixes reading and caste at once.
- **Exaggerate.** At 24 px an insect is a silhouette: thick legs, big mandibles.

## 7. Renderer work that comes first (costs nothing)

1. Sprites that persist between frames, in layers: ground (cached), creep, shadows, bodies
   (sorted by depth), air, effects, overlays.
2. A manifest with a fallback: a family or kind with no atlas entry keeps its drawn shape.
   The game stays playable and the tests stay green while assets arrive one at a time.
3. The isometric view as a setting, behind `toWorld` / `worldToScreen`.
4. Zoom and pan; canvas fills the window.
5. The filter, with an off switch for the break moments.

## 8. Still to probe, then the vertical slice

| Probe | Settles |
|---|---|
| Walking clips from the five views of the single-picture sheet | Whether the sheet's consistency survives animation |
| A rough Tripo model photographed at five exact angles, each photograph animated | The hybrid in 6c. Needs the Tripo wallet balance checked first. |
| A quiet idle for the spitter | Whether idles can be held small |
| A flier | Whether wings survive the key |
| A directional limb in two views | The twelve limbs with a facing |

**The slice:** one district, finished: blocks, streets, creep, core, one gate; spitter,
lasher, spine wall and one directional limb; skitterling, militia and flier; shots, hits
and deaths; the filter. Then PLAYTEST_PROTOCOL.md applies as written:
- a graphics reference wall and its checklist in `references/`;
- the three persona passes, with screenshots at near AND far zoom beside the reference;
- new permanent measurements: every pair of limb silhouettes is distinct at 32 px; caste
  colours hold (war red, science teal, royal gold); bodies keep their contrast on street and
  on creep; atlases stay under a size budget; 300 bodies on screen hold the frame rate.
Mass production starts only after Collins has seen the slice and the style bible is locked.

## 9. Production order (by time on screen)

Board → the limbs of the four starting profiles → the war ladder → the other limbs → combo
engines → science and royal castes → organ stage → cards and HUD → ship, globe, portraits →
films → sound.

## 10. Budget and limits

- One living asset (a still and a clip) costs $0.35 and about 3–5 minutes.
- The whole board is about 280 clips: 24 limbs × idle and fire, 12 limbs with a facing ×
  2 views × idle and fire, 18 bodies × 5 views × walk and attack. With re-rolls, roughly
  $175 of tokens and 7 hours of generation at five at a time. Stills, films and rooms add
  about half as much again.
- **SeeGen is the dependency now.** Only `seegen:` models take an end frame, and SeeGen is
  a prepaid balance shared with production. Check it before a batch.
- The Tripo wallet (prepaid, shared with production, refuses every request below 100
  credits) is off the critical path unless insects fall back to it.
- **Storage.** This repo is public and already 160 MB. Raw stills and clips live in
  `art-src/` (ignored by git). RFab's links can expire, so raw sources need a durable
  home (OPEN: a local folder plus an S3 prefix). Only atlases, prompts and the manifest
  are committed.

## 11. What this changes in TECH.md

- Item 2 (a video loop per limb) stands, with two additions: the end frame closes the
  loop, and frames are baked to an atlas rather than played as video.
- Item 3b (insects as 3D models baked in Blender) → video walking in place, two views
  and their mirrors. 3D is the fallback.
- Item 6 (one painted ground image per district with a passability mask) → dropped. The
  board is drafted, rotated plates now; the ground is code plus textures.
- Items 1, 4, 5, 7, 8 and 9 stand.
