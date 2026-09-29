# BROODFALL — build spec

Constraint that drives every choice here: the whole game must be buildable and testable by an AI agent working in text files, with no human-only editor in the loop. That rules out Unity/Unreal/Godot-with-editor workflows and points at the web stack, which happens to also be the best platform in existence for "video loop as a first-class art asset".

## Stack

- **TypeScript + Vite + PixiJS v8** for the planetside game. Pixi is a renderer, not a framework: all game logic is plain code we own, every scene is constructed in TS, nothing lives in a binary scene file.
- **DOM (HTML/CSS) overlay for ALL UI**: the empire operator HUD, menus, card hands, the entire ship. The diegetic "empire software" aesthetic is literally a UI, and HTML/CSS is the strongest art tool an AI agent has. Only the battlefield itself is canvas.
- **The ship is an FMV point-and-click**: fullscreen photoreal video loop per room, DOM hotspots on top. Zero engine work.
- **Deterministic sim core, render split off.** Fixed-timestep logic (`sim/`) with a seedable RNG, no Pixi imports allowed inside it. The renderer subscribes to sim state. This is what lets an agent PLAY the game headless: run 500 waves in vitest overnight, assert economy curves, tune balance without a human touching it.
- **Audio**: howler.js. Narrator VO generated via TTS, newsreel music licensed or generated.
- **Packaging**: web build first (playable in a browser day one). Electron wrap later if/when Steam matters. No decision needed now.

## Asset pipeline (the heart of it)

**BUILT Sep 29 2026, and it is not what the list below says.** The list is the plan of Sep 26, kept for its reasoning. What was built, and why each item changed:

| Item below | What was built |
|---|---|
| 2. A video loop per limb | Stands. The clip's last frame is its first (the video model takes an end frame), and frames are baked to an atlas, never played as video. Each limb is first REDRAWN in the material of the creep. |
| 3. Video textures for the central body | Dropped: the landing site is an atlas like everything else, from a 720p clip. |
| 3b. Insects as 3D models baked in Blender | Dropped. Insects are video too: five views drawn in ONE picture, a walking clip of each, three views mirrored. Collins's intuition; the probes agreed (`notes/GRAPHICS-PLAN.md` 6b). |
| 6. One painted ground image per district, with a passability mask | Dropped. The board is drafted plates: the city is BUILT from baked pieces (floor tiles, wall faces, props) in eight tile sets, because limbs stand on roofs at exact heights. |
| 7. Multi-cell footprints | Built: BIG limbs, 2 by 2 (`DESIGN.md`). Creep is baked tiles with ragged edges, not a shader. |
| The camera | Isometric, and it turns in quarter turns (Q and E). Not in the list at all. |

Where it all is: `HANDOFF.md`, "The art". The rules of the look: `assets/style-bible.md`. The probes and the costs: `notes/GRAPHICS-PLAN.md`.

Authoring format is AI video; runtime format is spritesheet. That one rule keeps 50+ animated towers cheap AND performant.

1. **Style bible first** (`assets/style-bible.md`): one locked prompt scaffold for the whole planetside look (palette, lighting, lens, "wet chitin + muscle" material language). Every tower/organ/enemy prompt extends it. This is what makes 50 towers read as one game.
2. **Tower/organ loops**: still image (RFab image gen, style-bible prompt) → image-to-video 2–4s idle loop → `tools/` script runs ffmpeg: seamless-loop (crossfade or ping-pong), matte extraction to alpha (generate on a flat key color; chroma key, AI video matting as fallback), then bake to a premultiplied-alpha WebP spritesheet + entry in `assets/manifest.json`.
3. **Runtime rendering**: spritesheets by default (GPU-cheap, hundreds on screen fine). Real `<video>` textures reserved for hero elements only: the central body, bosses, the crash-opening. 50 simultaneously-decoding videos would melt the frame rate; 50 spritesheet loops are nothing.
3b. **Insects (enemies): 3D models baked to directional spritesheets — never runtime 3D, never video loops.** Video fails for walkers (a loop is baked to one facing; path-following needs any facing). Runtime 3D fails for swarms (hundreds of skinned meshes per frame, plus it drags a second renderer into a 2D game). The StarCraft/Factorio answer: RFab's 3D-model API generates each caste model → auto-rig + walk/attack/death cycles → headless Blender (`blender -b -P`) renders 8 directions × N frames per animation from the game's top-down camera angle → baked into the same premultiplied-alpha spritesheets everything else uses. Fully scriptable end to end, no editor. Bonuses: perfect caste consistency across poses; corpse/harvest frames come from the same rig; per-caste palette variants are a tint, not a regeneration; and the models get reused to condition the break-cinematic videos so the "real" insects match the gameplay ones. Sprite instancing handles Vampire-Survivors-density swarms without breaking a sweat.
4. **Particles on top**: pixi particle emitters for muzzle/impact/meat pickups/creep motes. Particles are what make AI loops feel alive and interactive rather than like wallpaper — the loop is the body, particles are the verbs.
5. **Cannibalize inheritance is COMPOSITED, not generated.** We cannot pre-render every inheritance combo. Each tower's manifest entry defines attachment anchor points; inherited parts are separate small alpha sprites/loops pinned to anchors, plus a tint/particle signature. Combinatorial look, linear generation cost. (Generate ~8–12 part-decals per donor family, not per combo.)
6. **Maps**: one large AI-painted ground image per district/biome, composed with the RFab Creator Studio layout system for pathways. Beside each ground image lives a same-size **passability mask** (color-coded image: path / blocked / creep-capable / build-anchor). The sim samples the mask at grid resolution at load. Art stays pure art; the code never needs the painting to be "correct", only the mask, and the mask is trivial to repaint when a layout changes.
7. **Grid**: chunky cells (~96–128 px), towers with multi-cell footprints (1x1 up to 2x3 for big limbs), Tower-Dominion-style readable placement rather than fiddly small tiles. Creep is not tile art: it is a shader overlay (noise-thresholded metaball field driven by the sim's coarse creep grid) so it looks organic and animates for free.
8. **Newsreel/propaganda cards**: gpt-image-class text-to-image for fixed headline cards and posters (it renders period typography well now); DOM + CSS (grain/vignette/flicker filters) for anything with dynamic text like kill feeds and mission results. The film-grain look is one CSS/shader pass, not per-asset work.
9. **Ship rooms**: photoreal text-to-video loops (static camera, subtle motion: hum, blinking consoles, drifting dust). One loop per room + a couple of state variants (gene bay idle vs. gene bay mid-splice).

Every pipeline step is a re-runnable script in `games/broodfall/tools/`, manifest-driven, so regenerating one tower or all fifty is the same command.

**Prior art to lift (Collins's pointer, verified Sep 26 2026):** the RFab backend already does video-loop→flipbook conversion in `services/emotionFrameService.js` (transparent VP9 WebM on S3 → N frames sampled evenly across the loop via fluent-ffmpeg, resized and packed for the M5Stack device), and the VTuber emotion-pack path already GENERATES transparent AI video loops. Broodfall's bake step is that same pattern with different output settings: keep alpha (PNG frames instead of flattened JPEG), pack frames into a spritesheet instead of a folder, game resolution instead of 320×240.

## Testing (per repo owner's standing rules)

- Sim: vitest on the headless core — waves, economy, draw odds, inheritance stacking. Balance assertions, not just unit tests.
- Visuals: Playwright drives the real build, screenshots, and per-region pixel checks (tower renders inside its cell, creep reaches expected bounds, HUD elements present) — machine-verified regions, not one glance at a full-page screenshot.
- A `/debug` route with wave scrubbing, free meat, draw-odds inspector, and deterministic seed entry.

## Folder layout

```
games/broodfall/
  DESIGN.md  TECH.md
  src/sim/        pure logic, no rendering imports
  src/render/     pixi layer
  src/ui/         DOM HUD + ship screens
  content/        towers.json, organs.json, castes.json, waves.json, directives.json
  assets/         manifest.json + baked spritesheets/masks/video
  tools/          asset pipeline scripts (gen, matte, loop, bake)
```

Content is data (JSON), not code: adding a tower is a manifest row + a content row, which keeps the 50-variation goal a content-generation problem instead of a programming problem.

## Order of construction

1. Sim core + rectangles on a grid + 3 meats + card draws + cannibalize inheritance (the DESIGN.md scope test), playable in browser, testable headless.
2. Passability-mask map loading + creep shader + attraction dial.
3. Asset pipeline scripts + first 10 real towers through it; DOM propaganda HUD skin + grain pass.
4. Ship as FMV screens, directives/standing, gene bank meta.
5. Crash-opening videos, break cinematics, scale to 50 towers.
