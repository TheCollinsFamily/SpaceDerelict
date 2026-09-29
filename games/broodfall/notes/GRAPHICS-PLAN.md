# Broodfall graphics plan (Sep 29 2026) — PROPOSAL, nothing built yet

Collins: "help me think through how we build out the graphics … knowing what we have
access to with the rfab api." This is the thinking, checked against the code and the RFab
backend as they are today. Decisions marked **OPEN** are Collins's. Nothing here has been
generated, spent or built.

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

Every generated picture is made FOR a camera, a size and a style. Get these wrong and the
whole batch is redone. None of them needs a generated asset to settle.

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
  The question to answer is whether streets behind tall blocks stay readable. Start at a
  steep camera (about 45° down) and tune.
- The pipeline below makes the camera a PARAMETER: board sprites come out of a bake script,
  so changing the angle later means re-running the bake, not repainting.

### 2b. Style — the design doc already answers it
DESIGN.md's tone stack says the break moments are "the same footage with the filter off".
So the art is made ONCE, in the straight register (real, wet, unglamorous), and the goofy
propaganda look is a FILTER over the canvas (colour grade, grain, halftone, vignette) plus
the HUD. Dropping the filter is then a one-line effect, and a strong shared filter also
hides the small inconsistencies between generated assets.
- **OPEN:** which straight look. Make three one-page style sheets (a limb, an insect, a
  block, in each look) and pick one. About $1.

### 2c. Size
- Raise the closest zoom so the first district fills the screen (about 68 px per cell),
  and let the canvas fill the window. The zoom-out as the body spreads then reads as growth.
- Author at 96 px per cell. Limb frames 192 px, swarm insects 64 px, the royal 256 px.
- Everything is shrunk hard from what the generator makes (1024 px → 192 px). Silhouette and
  big shapes survive; fine detail does not. Judge every asset at game size, never at full size.
- Add wheel zoom and drag pan (a genre convention, and players will want to look at their monster).

### 2d. What is code and what is generated
- **Code:** the blocks themselves (flat-topped terraces at exact heights), street channels,
  creep, shadows, range rings, links, projectiles, particles, the filter.
- **Generated:** textures for roofs, walls and streets; roof props; limbs; insects; organs;
  card art; portraits; rooms; posters; films.
- Why blocks are code: limbs stand ON blocks. The reference's buildable tiles are flat-topped
  for that reason. A detailed generated building with a limb perched on its dome looks wrong,
  and its height would not be exact.
- Creep is a shader driven by the sim's creep grid (pulsing veins, thick hide on roofs, thin
  membrane in streets). RFab has no seamless-texture support, so a painted creep tile would
  show seams; a shader does not.

## 3. What the RFab API can do (checked Sep 29 2026)

All routes take `X-API-Key: $RFAB_API_KEY` against api.rfab.ai. Prices are RFab tokens at
retail (tokens × $0.00002); the provider's real cost is about half.

| Need | Route | Verified facts |
|---|---|---|
| Still image | `POST /api/image-generation/generate` | Send `async: true` and `imageCount: 1` (the default is 4). `openai:gpt-image-2` is the house standard: $0.012 low, $0.106 medium, $0.42 high. Seedream 4.5 $0.07. SDXL checkpoints $0.007 and they honour a seed. |
| Same style across assets | `POST /api/image-generation/img2img` with `imageUrls[]` | Up to 16 reference pictures on gpt-image-2. Passing 2–3 approved style-bible pictures with every call is the way to hold one look. No custom LoRA training exists. |
| Transparent background | `POST /api/image-generation/isolate-figure` | $0.01. Generate on a flat background, then cut out. Proven in `_gen_lb_ask_icons.js`. No model returns alpha directly. |
| Upscale | `POST /api/image-generation/upscale` | 2×/3×/4×, $0.04–0.16. |
| 3D model | `POST /api/model-generation/generate` | Text, image or multi-view to a textured GLB. Image-to-3D 20 credits, texture 10 (1 credit = $0.01 real, $0.02 retail). `faceLimit` controls polygon count. |
| Rig and animate | `POST /api/model-generation/:id/rig`, `/animate` | Rig 25 credits, 10 per motion. See section 6: RFab only supports two-legged rigs today. |
| Video from a still | `POST /api/image-generation/generate-video` | Always send `resolution`. About $0.25 for 4 s at 480p. An END frame works only on `seegen:` models. No frame-rate or camera-lock setting: the camera is held by the prompt only. |
| Transparent video | none | Every transparent loop on RFab is a green background plus a chroma key in ffmpeg. Moving edges and translucent effects key badly. |
| Narrator voice | `POST /api/audio/synthesize`, `POST /api/voices/clone` | $0.06 per 1,000 characters. A 12–120 s sample can be cloned, so a public-domain newsreel voice is possible. |
| Music | `POST /api/music/generate`, `/songs/:id/loop` | Instrumental supported; the loop is a free crossfade. |
| Sound effects | none | No route generates sound effects. |

**Never tested on any model:** gore and body horror. Every moderation probe in the backend
is a nudity probe. OpenAI is filtered and a picture blocked at the output stage is still
charged. The uncensored lanes are grok-imagine, Venice, the Runware checkpoints and Seedream
on Atlas.

**On this PC:** ffmpeg 8.1.1 (full build), Playwright with Chromium, an RTX 4070, Python.
No Blender, no ImageMagick, no three.js in the game folder.

## 4. How each kind of asset gets made

The sorting question is: **is it ever seen from more than one angle?**
No → a generated picture. Yes → a generated 3D model, photographed by a script.

| Asset | Count | Made by |
|---|---|---|
| Blocks, streets | — | Code, with generated roof/wall/street textures (about 12) |
| Roof props, doorway lights, street life | ~30 | Picture, cut out |
| Creep | — | Shader |
| The core / meteor | 1 | 3D model, baked; the one board element worth a video loop |
| Limbs | 36 | Picture → 3D model → baked in 8 facings |
| Graft parts (what an eaten limb leaves on the new one) | 36 | Small picture or model per donor family, pinned to standard slots |
| Insects | 26 kinds, ~18 bodies | Picture → 3D model → baked in 8 directions (section 6) |
| Shots, hits, deaths, meat pickups | — | Code particles |
| Card art | 36 | The limb's concept picture (already made for the 3D step) |
| Organ stage | ~25 organs | One painted cross-section; organ flesh masked to each organ's exact shape in code |
| Territories, dares, experiments | ~30 | Picture |
| Faction leaders, YOKE | ~12 | Picture; short video loops later |
| Ship rooms | 6 | Picture with CSS motion first; video loops later |
| Posters, headline cards | ~10 | Picture (Ideogram V4 for exact lettering) |
| Crash openings, break moments, endings | ~12 | Video |
| The globe | 1 | Generated planet texture on a real sphere |

Organ shapes are fixed (L, T, S, +, U…). Image models cannot draw an exact tetromino, so the
shape is a mask in code and the generator only supplies the flesh and the organ's motif.

## 5. The spine: picture → model → bake

1. **Concept picture.** Style-bible prompt plus 2–3 reference pictures, on a flat background.
   This picture is also the card art and the input to step 2.
2. **3D model.** `image_to_model` with texture. 30 credits.
3. **Bake.** A small page (three.js) loads the model, sets the game's camera and ONE light
   rig, and renders it in 8 facings to transparent frames. Playwright drives the page and
   saves the frames; sharp packs them into a WebP atlas and writes `assets/manifest.json`.
   This is the same toolchain as `tools/shot-*.mjs`. No Blender needed.
4. **Runtime.** Pixi sprites from the atlas. Breathing is a squash shader driven by the
   SIM: a limb with more tempo breathes faster, a hurt limb raggedly, a limb in stasis not
   at all. No baked idle frames, so atlases stay small.

What the bake buys over generating sprites directly: exact camera and lighting on every
asset, real shadows, any number of facings (so shooters can aim), exact alpha with no
cut-out fringe, and a camera that can change later.

**TECH.md planned a video loop per limb** (picture → 2–4 s video → loop → key → sheet).
That is dropped for limbs: at 45–190 px the subtle motion is invisible, video models drift
and repaint the background, and the chroma key fringes. Video is kept for things that
fill the screen.

## 6. Insects: the one real technical risk

- Tripo itself can rig six-legged models (`rig_type: hexapod`) and has ONE motion for them,
  `preset:hexapod:walk`. There is no attack, death or idle for non-humans, and no preset
  at all for winged rigs.
- RFab's integration does not pass `rig_type` and its allow-list drops the hexapod preset
  (`services/tripo3dService.js`), so today it can only rig two-legged models. Nobody has
  ever rigged an insect through it.
- So the ladder, cheapest first:
  1. **Mirrored scuttle.** Bake the static model and its mirror image: two frames per
     direction, plus a body bob. Free, no rig. Enough for swarm insects at 7–16 px.
  2. **Procedural legs.** Legs drawn and stepped by code (insects are the easiest gait
     there is). Guaranteed to work; all code.
  3. **Tripo hexapod rig** for the big ones (royal, consort, cannon, phalanx). Needs a
     three-line backend change and an RFab backend deploy, which is Collins's call, or a
     local backend. One probe costs about 65 credits.
- Deaths and attacks are code in every case: a lunge; a flip onto the back with the legs
  twitching.
- Ranks share a body: militia, soldier and elite are one model with scale, tint and armour.

## 7. Renderer work that comes first (costs nothing)

1. Sprites that persist between frames, in layers: ground (cached), creep, shadows, bodies
   (sorted by depth), air, effects, overlays.
2. A manifest with a fallback: a family or kind with no atlas entry keeps its drawn shape.
   The game stays playable and the tests stay green while assets arrive one at a time.
3. The isometric view as a setting, behind `toWorld` / `worldToScreen`.
4. Zoom and pan; canvas fills the window.
5. The filter, with an off switch for the break moments.

## 8. Probes before any batch (about $10)

| Probe | Settles |
|---|---|
| Three style sheets | The look (2b) |
| Six body-horror prompts on three models | Which model will draw wet meat without refusing |
| One limb through the whole spine, placed on the board at game size | Whether the spine works |
| One insect with the mirrored scuttle | Whether rung 1 is enough |
| One hexapod rig (local backend) | Whether rung 3 exists |
| One room loop with start frame = end frame on a `seegen:` model | Seamless loops (supported in code, never run) |

## 9. The vertical slice, and how it is judged

One district, finished: blocks, streets, creep, core, one gate; spitter, lasher, spine
wall and one directional limb; skitterling, militia and flier; shots, hits and deaths; the
filter. Then PLAYTEST_PROTOCOL.md applies as written:
- a graphics reference wall and its checklist in `references/`;
- the three persona passes, with screenshots at near AND far zoom beside the reference;
- new permanent measurements: every pair of limb silhouettes is distinct at 32 px; caste
  colours hold (war red, science teal, royal gold); bodies keep their contrast on street and
  on creep; atlases stay under a size budget; 300 bodies on screen hold the frame rate.
Mass production starts only after Collins has seen the slice and the style bible is locked.

## 10. Production order (by time on screen)

Board → the limbs of the four starting profiles → the war ladder → the other limbs → combo
engines → science and royal castes → organ stage → cards and HUD → ship, globe, portraits →
films → sound.

## 11. Budget and limits

- About $150–200 of real provider cost for the whole game (roughly 600 pictures, 120 models,
  90 clips, with re-rolls). Money is not the limit.
- **The Tripo wallet is the limit.** It is prepaid, shared with production, burns about 500
  credits a day, and refuses every 3D request for every user below 100 credits (the Sep 8–11
  outage). The models here need about 4,000 credits. Top up first, check the balance before
  every batch (`_check_tripo_balance.js`), and pace the batches.
- SeeGen video credits are also a shared prepaid balance.
- **Storage.** This repo is public and already 160 MB. Raw models are 15–19 MB each and do
  not go in git. RFab's links can expire, so raw sources need a durable home (OPEN: a local
  folder plus an S3 prefix). Only baked atlases, prompts and the manifest are committed.
- Every step is a re-runnable script in `tools/art/`, driven by the manifest, that skips
  what already exists.

## 12. What this changes in TECH.md

- Item 2 (a video loop per limb) → picture → model → bake, breathing by shader.
- Item 3b (Blender) → the same bake page as limbs; rigging is rung 3, not the plan.
- Item 6 (one painted ground image per district with a passability mask) → dropped. The
  board is drafted, rotated plates now; the ground is code plus textures.
- Items 1, 4, 5, 7, 8 and 9 stand.
