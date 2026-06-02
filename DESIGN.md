# Space Derelict — Design Recap

**Working title:** Space Derelict  
**Genre:** Roguelite with two tightly coupled modes (Combat + Graft/Builder)  
**Core fantasy:** You are a rim predator flying a frankenstein ship stitched from salvaged enemy chunks. Cut enemy corridors, EMP their systems, gas the ducts, then claw in the hulk, feast on the crew for power, and bolt on the best piece.

## High-Level Structure

Two modes that share the **same ship layout**:

- **Combat (Mode B)**: Pausable real-time (or fast-turn) FTL-like ship combat. You target enemy ship systems/corridors with different damage types. Goal is usually to disable for capture rather than pure destruction.
- **Graft / Builder (Mode A)**: Between fights (and at hub). Choose one salvaged chunk from the defeated ship and graft it onto your ship at a valid port. Manage adjacency, repair disabled sections with scrap, rewire corridors.

Progression feels big because **layout decisions in the builder phase directly change the battlefield** in the next combat (new components, better/worse connectivity, artifacts that swing fights).

## Ship Model (the heart of the game)

The ship (player or enemy) is a collection of **cells** on a 2D integer grid.

### Cell Types
1. **Crew Corridor** — The "power network" / spine. Must form a connected component (4-way orthogonal) back to a source (bridge / core). Only active corridors power things.
2. **Component** — Weapons, engines, armor, shields, etc. A component is only **active** if it is adjacent (4-way) to at least one **active** corridor on the main connected network. Cutting the corridor spine disables whole wings.
3. **Artifact** — Special tiles that modify adjacent components (bonuses **and** penalties). Usually do not require power but can be destroyed.

### Cell States (per tile)
- **Intact** — Fully functional.
- **Disabled / Offline** — EMP, nerve gas, etc. Still physically there (good for capture) but non-functional for the fight. Can often be repaired later.
- **Destroyed** — Overkill kinetic, fire burnout, breach. Slot is dead for this graft. Affects capture quality.

### Connectivity Rules (strict)
- 4-way adjacency only.
- Flood-fill from the "core" to determine the active corridor network.
- Any component or corridor tile not touching the active network is offline.
- "Cut the spine" is a primary tactical goal — snipe key corridor junctions to drop grafted sections.

### Chunks & Grafting
- Enemy ships break into several **chunks** (small pre-defined or generated clusters of cells, ~3-7 tiles).
- After a fight you **choose exactly one chunk** to keep.
- You attach it by matching a **port** (exposed edge cell on your current ship) to a port on the chunk (with optional 90° rotations).
- The chunk brings its internal corridors, components, and artifacts (in whatever state they ended the fight).
- Unchosen chunks yield scrap.
- Important rule: If you **destroyed** tiles in a region during combat, those slots are often **unusable** even if you pick the chunk (you shattered the value).

## Damage Types (strategic triangle)

| Type       | Shields | Hull     | Components      | Corridors     | Best for                  | Notes |
|------------|---------|----------|-----------------|---------------|---------------------------|-------|
| **Ion**    | Strong  | -        | -               | -             | Opening fights            | Strips shields to enable other effects |
| **EMP**    | Yes     | -        | Offline (threshold) | -          | Capture / disable         | Permanent for the fight; does not stack easily |
| **Kinetic**| Normal  | Normal   | Normal          | Normal        | General / salvage damage  | "Vanilla" — creates destroyed tiles |
| **Breach** | Normal  | Triple   | -               | -             | Shatter / hull break      | High risk/reward for scrap |
| **Fire**   | -       | DOT      | DOT (unconnected)| DOT (unconn.)| Area denial / cleanup     | Only spreads on tiles **not** on active corridors; dangerous to you too |
| **Nerve Gas** | -   | -        | -               | Inoperable    | Soft capture              | Shields must be down first; no permanent damage |

**Capture play** rewards surgical damage (Ion → EMP/gas → cut corridors).
**Shatter play** rewards overkill (Breach + Fire + Kinetic) for quick scrap but poor grafts.

## Combat & Capture Economy

Combat is pausable real-time (player issues targeting orders; time advances).

Combat ends when enemy is disabled enough or hull gone.

**End states determine loot quality**:
- **Good Capture** (systems offline, hull mostly intact, few destroyed tiles): Best chunks (mostly Intact/Disabled tiles) + full **Feast** (eat captured crew for upgrade points / meta power).
- **Messy Kill**: Mixed states on chunks, medium scrap, partial feast.
- **Shatter** (hull broken by breach/overkill): High scrap, very few/poor graft options, no/minimal feast.

After choosing a chunk you get a short "claw pull" moment (narrative + animation hook), then the graft decision.

## Run & Meta Loop (Space Hulk City Hub)

Typical run:
1. **Hub** (Graftyard, shops, feast upgrades, "Vat" for clone continuity).
2. Launch → Sector map (choose nodes, **avoid the overwhelming Techopuritan crusade zones**).
3. Series of fights.
4. After each: capture decision → graft → (optional repair/rewire with scrap).
5. Death or boss → wake in the tube (first death is the big narrative reveal: this is entertainment for the thrill-seekers; you are not the good guys).
6. Meta progression in the city (new graft options, feast tree, district unlocks) — not "save the universe", just get stronger and more infamous.

## Factions (flavor + light mechanical differences)
- Techopuritans: The big bad. Avoid or die.
- Your side: Rim predators / thrill-seekers who split from the empire over emotions. Feast on crews, see pirating as the ultimate rush.
- Prey: Refugees, Felonia (cat-like), Pop Fiz (psychotic uplifted dolphins/whales), Holy Empire, Confederacy (the "good guys" — attacking them hurts your rating?), Ascendancy (AI death cult).

## Prototype Order (from the original discussion)
1. Grid + corridor flood-fill (active network).
2. Component adjacency rule (active only if touching active corridor).
3. Basic enemy ship + 3-4 damage types (Kinetic, EMP, Breach, Fire).
4. Capture vs shatter detection + chunk extraction with tile states.
5. Chunk selection + port-based grafting (simple attachment).
6. Shield gate for gas + Ion.
7. Scrap economy + repair of disabled tiles.
8. Basic hub + one full run loop (fight → graft → fight 2 to show power growth).
9. Narrative beats (tube reveal, feast party flavor).
10. Polish, more artifacts, faction variety, map.

## Non-Goals for v0.1
- Full crew simulation (no individual crew pathing).
- Beautiful art (programmer visuals / colored grid first).
- Huge content (a handful of chunk templates, 3-4 enemy "factions" via slight stat differences).
- Multiplayer or save/load across sessions (local JSON later).

## Key Fun Questions to Validate Early
- Does choosing "capture for the good chunk + feast" feel meaningfully different from "shatter for scrap rush"?
- Does sniping a corridor junction to disable a whole grafted wing feel powerful and tense?
- Does grafting a new chunk immediately make the next fight play differently (new weapons online, new weak points the enemy can exploit)?
- Is the "I am the monster" tone coming through without being preachy?

This document is the source of truth for implementation. Update it as we playtest and tune.

---

*Recovered and condensed from the previous design conversation (May/June 2026 session).*
