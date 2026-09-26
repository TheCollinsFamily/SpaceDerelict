# Playtest Protocol (all games in this repo)

Written Sep 26 2026 after Broodfall shipped three boards in a row with basic-level flaws
(towers in the path, no verticality, degenerate map structure, soup instead of waves,
missing screens) that every automated check passed and Collins spotted in seconds.

## The root failure this protocol exists to prevent

Automated tests verify properties the author already believes. When the author's mental
model of the genre is wrong, tests pass and the game is still wrong. The fix is to import
OUTSIDE models (reference games) and check against THEM, not against the author's head.

## The protocol — every iteration, no exceptions

### 1. Reference wall (before building)
Collect 3+ screenshots of best-in-genre games for the surface being built (for TD maps:
Collins's reference BMP, Tower Dominion, Nordhold, Kingdom Rush). From them, write the
CONVENTION CHECKLIST: concrete, visible statements ("towers stand beside the path, never
in it", "paths are sunken/lighter, build ground raised", "the map expands in drafted
chunks", "waves are discrete with a countdown and a cleared-banner"). The checklist lives
in the game folder (`references/CONVENTIONS.md`) and grows; it is never satisfied from
memory — only against a fresh screenshot.

### 2. Surface inventory (kept current in the game README)
Every screen/stage the design doc names, with status BUILT / STUB / MISSING, updated every
iteration. A surface that is MISSING must be said out loud in every report until it exists.
Nothing may be reported "done" while a doc-named surface is silently absent.

### 3. Play, then critique in three personas (written, each iteration)
- **Newcomer:** open the game cold. Can I tell what to do in 30 seconds? What confused me?
- **Genre veteran:** walk the convention checklist item by item against LIVE play and a
  fresh full-res screenshot NEXT TO the reference image. Every item gets YES/NO + evidence.
- **Breaker:** try to win degenerately (spam one thing, ignore mechanics). If a dominant
  degenerate line exists, the mechanics it bypasses are decoration.
Each persona produces named findings or explicit passes, written into the iteration notes.

### 4. Experience invariants as permanent tests
When a genre convention can be measured, it becomes a test that runs forever:
- placement-matters experiment (smart vs random policies, identical economy)
- "no shooter ever stands on a path cell" across full autoplay runs
- wave discreteness (quiet gap between last kill of wave N and first spawn of N+1)
These are guardrails against regression, not proof of quality — quality is judged in step 3.

### 5. Screenshot beats, every change
Fixed moments captured at full resolution on every iteration: minute zero, first siege,
mid-game, endgame, plus every menu/screen in the inventory. Reviewed (actually looked at,
against references), not just attached.

### 6. Reporting rule
"Done" / "tested" may only be claimed when steps 1-5 have artifacts in the repo for THIS
iteration: the filled convention checklist, the surface inventory, persona notes, green
invariants, and the screenshot set. A report without them says "not yet verified" instead.
