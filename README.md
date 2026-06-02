# Space Derelict

Roguelite about a rim predator flying a **frankenstein ship** stitched together from salvaged enemy chunks.

Core loop: FTL-style pausable combat using distinct damage types (capture vs shatter) → choose a chunk from the broken ship → graft it onto your vessel (corridors, components, and artifacts come with it) → the new layout changes the next fight.

## Current State (prototype)

We have a working vertical slice in pure Python + rich:

- Ship as a grid of cells (Corridor / Component / Artifact)
- Strict 4-way corridor flood-fill for "active network"
- Components only work when adjacent to active corridors
- 6 damage types with different strategic effects (EMP/ION/gas for capture play, Kinetic/Breach/Fire for shatter/scrap)
- Cell states carry from combat into the graft (Intact / Disabled / Destroyed)
- Chunk extraction + port-based grafting that actually grows your ship and adds new corridors/components
- A scripted + interactive demo that shows one fight → graft → second fight with the expanded ship

Run the prototype:
```powershell
cd C:\Users\Merry\dev\space-derelict
python main.py --demo          # non-interactive full loop
python main.py                 # interactive (choose damage + targets yourself)
```

The interactive version needs a real terminal with stdin (the build harness runs --demo).

See [DESIGN.md](./DESIGN.md) for the full mechanics recap we converged on.

## Tech Choices (why this way)

We started here because it is the fastest and most precise path for *me* (the AI) to implement, debug, and balance the tricky parts:

- Corridor connectivity + grafting rules
- Damage type interactions and capture quality heuristics
- Proving that "your builder decisions change the combat" actually feels powerful

**Python + rich** gives instant iteration and beautiful colored grids/logs with zero compile or external editor friction.

Later we will:
- Add real scrap / feast point economy + hub
- Multiple chunk choices per victory
- Better procedural enemy chunks + artifacts
- Persistent runs + meta progression

**Graphics & "cool AI pixel animations"**

Yes — we have the `image_gen` tool. When the mechanics feel fun and the balance starts to click, we will generate a consistent limited-palette pixel art tileset (corridors in different states, component icons, fire/breach overlays, claw-maw grab frames, faction aesthetics, etc.) and move the view to pygame (or Godot/Bevy if you prefer at that point).

The core simulation logic stays in Python and can be reused.

## Next Steps (rough order)

1. Real economy (scrap from destroyed/shattered, feast points from good captures) + spend them on repairs or small upgrades between fights.
2. Hub skeleton (Graftyard where you can see your current ship + meta unlocks).
3. Multiple chunks to choose from after a fight (with different risk/reward profiles).
4. Simple sector "map" (a few nodes, avoid the big bad Techopuritan zone).
5. Death + tube reveal narrative beat.
6. Pixel art generation + graphical frontend (pygame first for speed).
7. More artifacts, component subtypes, fire spread tuning, etc.

## Running / Developing

- Python 3.13+
- `rich` (installed via the initial setup)
- For the full game later you may want `pygame` (`pip install pygame`)

All the important logic lives in `space_derelict/model.py`. The demo is in `main.py`.

## Git

Repo initialized. Commit early and often as we build.

---

This is the start of the real build. The previous long design conversation is now executable.
