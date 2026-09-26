# Broodfall — vertical slice build plan (Sep 26 2026)

Goal: a playable end-to-end slice in this folder. Browser game via `npm run dev`, deterministic sim testable headless via `npm test`, visuals verified by a re-runnable Playwright script with per-region pixel checks. Placeholder procedural art, but the full game structure, so real assets drop in through the manifest later without code changes.

## In this slice

- **Sim (fixed 10 Hz timestep, seeded RNG, zero render imports):**
  - Grid map (40×30 chunky cells), body core, radial creep growth, buildable-on-creep rule.
  - 3 meat currencies (war/science/royal) dropped by caste on death, collected automatically.
  - 6 tower types: spitter (ranged), burster (AoE), lasher (melee sweep), maw (eats + biomass), spine wall (blocker hazard), lure gland (local interest).
  - 3 organs (built inside the body): heart (biomass + creep rate), brain node (draw odds shift + interest), pheromone gland (attraction dial).
  - Card system: build actions come from a 4-card hand drawn from a weighted deck; organ auras and roguelite flags modify weights. No shop.
  - Cannibalize-to-modify: eat an existing tower into a new build; deterministic stacking mods by donor family (rate/aoe/yield); visible mod pips.
  - Attraction: interest pulls science-caste harvest parties; threat (kills, biomass, royal bait) tiers waves up through the response ladder: responders → militia → military → desperation; royal event past a threshold.
  - Waves: growth phase / siege phase breathing; composition telegraphed by caste.
  - Win = biomass threshold (sporulation). Lose = core dead.
- **Render:** PixiJS v8, procedural shapes per entity from a manifest (art-swap ready), creep as tinted cells (shader later).
- **UI:** DOM overlay HUD — meat counters, biomass bar, threat/interest dials, wave telegraph, card hand, cannibalize flow, kill feed in empire-procurement voice ("resource acquired"), victory/defeat screens. First-pass propaganda styling (grain, newsreel type).
- **Tests:**
  - vitest: rng determinism, economy math, draw-weight shifts, inheritance stacking, and a full headless run with a scripted autoplayer that must reach win or loss in bounded ticks with sane economy curves.
  - Playwright: boot the real build, screenshot, crop regions, pixel-check (canvas non-blank, creep grew, HUD elements present).

## Out (later phases, per TECH.md order)

Real AI art pipeline, passability-mask map loading, ship FMV, gene bank meta, directives, audio, break cinematics.

## Steps

1. Scaffold: Vite + TS + PixiJS + vitest + @playwright/test.
2. Sim core + content JSON + unit tests green.
3. Renderer + HUD wired to sim.
4. Autoplayer full-run test + balance pass.
5. Playwright visual verification script.
6. Commit/push per meaningful step; final report.
