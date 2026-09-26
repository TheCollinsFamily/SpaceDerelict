# Technopuritan Universe monorepo

- This repo hosts EVERY game set in the Technopuritan Empire universe (Collins, Sep 26 2026: "this is where we will build all our games in the universe"). One game = one folder under `games/`. Never split a universe game into its own repo.
- `games/space-derelict/` is the original game, moved from repo root on Sep 26 2026. Its `.bat` launchers use `%~dp0` and survived the move; the `.lnk` shortcuts were rewritten to the new path.
- Shared lore goes in `docs/UNIVERSE.md`. A game may extend the lore but must not contradict it; contradictions get resolved in docs/, not per-game.
- `games/broodfall/` is design-stage: working title, name is Collins's call. Its `DESIGN.md` is the source of truth for decisions already made — read it before proposing mechanics he has already rejected (tower-destroying RNG "instability" is explicitly out).
