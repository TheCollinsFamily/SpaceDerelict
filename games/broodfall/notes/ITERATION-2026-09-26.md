# Iteration notes — Sep 26 2026 (plate-board rebuild)

## What changed
Uniform-grid board scrapped for plate drafting (see DESIGN.md); verticality, discrete
waves, camera framing, full menu/ship loop, playtest protocol adopted.

## Persona passes
**Newcomer:** menu explains the premise; after deploy the default hint now says what to
do first (select card → click lit block, watch the glowing gate). Confusion risk: organ
buttons look clickable pre-meat — they silently fail. Next: disable-with-reason.
**Genre veteran:** conventions table in references/CONVENTIONS.md — 9 YES, 2 PARTIAL,
1 WEAK. Worst offender: block/street legibility under creep at far zoom (#11).
**Breaker:** spitter-only spam ≈ the random policy: wins ~half of hold runs, dies to
tier 3-4 scaling. No degenerate dominant line found this pass. Royal surge is dead
weight in hold runs (royal meat only arrives if the royal comes) — acceptable.

## Measurements
- 27/27 tests; browser checks visual/input/endgame green (camera-aware).
- Placement guardrail: smart flips 2 seeds to wins vs random's 1; smart 7/8 outright.
- Naive-policy hold-12: seeds 1,3 win (tier 4, real damage), seed 2 loses wave 11.

## Next iteration candidates (in order)
1. Creep-vs-terrain legibility at far zoom (#11) — darken roofs under creep instead of tinting all.
2. Confluence merging on the start plate (#5) — route two exits into one approach.
3. City life pass (#12): civilian dots on streets pre-creep, they flee the crash.
4. Organ buttons: disabled state with cost tooltip.
5. Mid-siege cannibalize drama: surgery vulnerability window (design doc idea, unbuilt).
