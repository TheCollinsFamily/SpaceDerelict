# Space Derelict

Roguelite about a rim predator flying a **frankenstein ship** stitched together from salvaged enemy chunks.

Core loop: FTL-style pausable combat using distinct damage types (capture vs shatter) → choose a chunk from the broken ship → graft it onto your vessel (corridors, components, and artifacts come with it) → the new layout changes the next fight.

## Current State (prototype)

We have a playable prototype in pure Python + rich that is now ready for core loop playtesting:

- Full ship model (Corridor flood-fill network, Components only active when adj to it, Artifacts with kinds + mechanical side-effects like "volatile" explosions on shatter)
- 6 distinct damage types + shields/retaliation/fire-spread simulation in the combat phase (sniping guns reduces return fire; choices feel tense)
- Named, role-specific chunks (gun_pod, armor_plate, engine_nacelle, volatile artifact_bay, spine) composed into enemies; post-fight you choose *which logical piece* (with its exact combat damage states) to graft
- Grafts use corridor-preferring auto-attach + rotations and actually extend (or fail to extend) your active network in meaningful ways
- Economy (scrap/feast from quality + states) + RATINGS (game show spectacle/infamy points earned for brutality — the inhabitants watch like a brutal reality show; more overkill/explosions/shatter especially in risky sectors = more points for the home base).
- Persistent Graftyard City home base between full playthroughs with save/load (json persists ratings, unlocks, career stats across sessions): full menu for spending Ratings (vat upgrades, hype contracts, exotic pools, sponsor deals, entertainment district) and Feast Tree (tiers for starting feast, clone improvements like extra starting cells/artifacts, advanced vat). Unlocks visibly affect future runs (better starts, more advanced enemies/artifacts in sectors). Multiple seasons supported. 'Retire / End Career' option for full career summary (total infamy, seasons, audience score = ratings + 2xfeast + 10xunlocks, high score). Save on quit/retire.
- Fleshed sector map (4 nodes: Raider Outpost, Derelict Field, Techopuritan Crusade Zone (avoid for risk/reward), Felonia; player choices during run, faction enemies, difficulty scaling, ratings multipliers for brutality in risky nodes). 3+ fight runs with accumulating resources. Full persistent city loop for multiple seasons: Ratings (brutality/game show) + Feast Tree spends for vat upgrades, hype, districts (entertainment/graft), starting bonuses, clone improvements (extra cells/artifacts). Unlocks change future enemy spawns and starts. Sector consequences (surviving Tech unlocks exotics). Death + tube reveal with variations, post-run feast party flavor for high ratings runs. Tone heavy on "monster" / audience watching.
- Both a rich --demo (full run with map sim, research, summary + ratings/city) and interactive (you choose routes, issue multi-orders per turn, full post/hub/city spending between runs)
- Opposing ship variety: fixed chunk templates (gun_pod now with scatter/widebeam/bypass artifacts, armor, engine, artifact_bay, shield_bay, spine) composed per faction + difficulty + unlocks (with pre-damage and extra exotics; artifact_bay + shield_bay now carry distributor). Now also supports hand-crafted "dev ships" via `python dev_ship_builder.py` (place corridors/components/artifacts on grid, define named sub-chunks for excellent salvage choices, save to dev_ships/*.json). Dev ships are randomly selected in encounters (~35% when available) so you get interesting asymmetric layouts that play differently. The same sub_chunk + destroyed-filter salvage system applies.

The prototype is now substantially complete for the core roguelite loop. Play full runs (with map choices, multi-orders, research meta, death+reveal) to validate the key fun questions in DESIGN.md before moving to pixel art / pygame.

Recent fleshes (this session): smarter procedural chunks with semantic names for better salvage variety; 5 new contracts (live captures, feast hauls, no-backtrack, brutality spikes, artifact showcases); 3 new Vat starting frames (drone_carrier, overcharge, symbiote) with distinct layouts; expanded tube narrative + retire brutal highlights extractor + post-run feast party flavor; "View Current Bonuses" in city (terminal + GUI); booster now gives real kinetic/fire mitigation; extra LIVE FEED visual bar in city; all new content wired and verified.

Run the prototype:
```powershell
cd C:\Users\Merry\dev\space-derelict
python main.py --demo          # non-interactive: full multi-season with real sector map (nodes, choices, Techopuritan avoidance), ratings from brutality (higher in risky nodes), city spending on Ratings/Feast Tree between runs. (meta auto-saved)
python main.py                 # interactive: full persistent city home base between multiple playthroughs/seasons with save/load (json). Sector map with real route choices during runs. Earn Ratings from brutal play (game show), spend on upgrades (vat, hype, districts, feast tree tiers for clone/starting bonuses). Unlocks change enemy variety and starts. 'Retire / End Career' for full career total score/summary + high score. Save on quit/retire. Multiple seasons supported.
```

The interactive version needs a real terminal with stdin (the build harness runs --demo).

**Windows users (recommended):** Just double-click **`Space Derelict.lnk`** (or the `Space Derelict.bat`) in the folder. It launches the graphical game with a nice custom icon, automatically changes to the right directory, uses `pythonw` (no console spam), and all errors are still captured to `logs/space_derelict.log` + `logs/crashes/`.

There's also `Space Derelict (Terminal).lnk` / `.bat` for the rich/console prototype (useful for testing or when you want the full text UI + `--demo`).

See [DESIGN.md](./DESIGN.md) for the full mechanics recap we converged on.

## Tech Choices (why this way)

We started here because it is the fastest and most precise path for *me* (the AI) to implement, debug, and balance the tricky parts:

- Corridor connectivity + grafting rules
- Damage type interactions and capture quality heuristics
- Proving that "your builder decisions change the combat" actually feels powerful

**Python + rich** gives instant iteration and beautiful colored grids/logs with zero compile or external editor friction.

Later we will:
- Better procedural enemy chunks + artifacts
- Simple sector map (choose nodes, avoid Techopuritan zones)
- Persistent runs + meta progression (feast tree, Vat clones, etc.)
- Death + tube reveal narrative
- Pixel art + graphical frontend (pygame first)

**Graphics & "cool AI pixel animations"**

Yes — we have the `image_gen` tool. When the mechanics feel fun and the balance starts to click, we will generate a consistent limited-palette pixel art tileset (corridors in different states, component icons, fire/breach overlays, claw-maw grab frames, faction aesthetics, etc.) and move the view to pygame (or Godot/Bevy if you prefer at that point).

The core simulation logic stays in Python and can be reused.

## Next Steps (rough order)

The first wave (economy, multiple named chunks with logical salvage, hub, basic run loop, artifacts with mechanics, combat tension via retaliation, connecting grafts, tone) is now in and the prototype is ready for playtesting the core fantasy.

1. Better procedural enemy chunks + more artifact effects / component subtypes.
2. Simple sector "map" (a few nodes, avoid the big bad Techopuritan zone).
3. Persistent runs + meta progression (feast upgrades, district unlocks in the Graftyard city hub).
4. Death + tube reveal narrative beat (and the "you are the monster" tone).
5. Pixel art generation + graphical frontend (pygame first for speed; reuse model.py sim).
6. More artifacts (e.g. widebeam, bypass, distributor added), component subtypes (weapons that need targeting), fire spread tuning, capture vs shatter feel balance.
7. Save/load, more factions, claw-pull animations hooks.

## Running / Developing

- Python 3.13+
- `rich` (for the terminal prototype)
- `pygame` + `pygame_gui` (for the graphical game)

**Easiest on Windows:** Double-click `Space Derelict.lnk` (or `Space Derelict.bat`) in the folder. It has a custom game icon and handles everything.

From a terminal:
```powershell
python run_graphical.py          # graphical (recommended)
python main.py                   # terminal rich prototype (interactive city)
python main.py --demo            # non-interactive full run for testing
```

All the important logic lives in `space_derelict/model.py`. The demo is in `main.py`.

## Graphical Version (pygame + pixel art)

The model is graphics-agnostic. To run a graphical prototype:

```powershell
python run_graphical.py
```

Or even easier on Windows: double-click **`Space Derelict.lnk`** (has the game icon) or `Space Derelict.bat`.

- Opens a pygame window.
- Uses `pythonw` under the hood via the launcher so you get a clean GUI experience (no flashing console).
- **Automatic logs**: The game now captures all output + errors (with full tracebacks) to `logs/space_derelict.log` (rotating, 5MB x5) and on any crash writes `logs/crashes/crash-YYYYMMDD-HHMMSS.log`. Review these after errors or odd behavior. Both the graphical and `main.py` (terminal) frontends participate.
- Renders ships using generated pixel art tiles from `assets/` (spritesheet, overlays, background).
- Currently shows side-by-side player + enemy (loads dev ships from builder when available).
- Reuses 100% of the simulation (combat, grafts, dev ship sub-chunks, etc.).
- Press ESC to quit.

Pixel art was generated via the image_gen tool with a consistent limited retro palette (32x32 tiles). You can regenerate/improve tiles with more prompts and update the TILE_MAP in `space_derelict/graphics.py`.

To turn this into the full graphical game, replace the rich renders + text input in the loops with pygame surfaces, mouse clicks for cell targeting, buttons for damage types, etc. The loops (combat, post_combat, hub, city) stay the same.

See `space_derelict/graphics.py` for the renderer and `run_graphical.py`.

## Git

Repo initialized. Commit early and often as we build.

---

This is the start of the real build. The previous long design conversation is now executable.
