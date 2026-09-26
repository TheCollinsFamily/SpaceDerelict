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


## Addendum (same day): connection algebra + entrance wager
- Plate placement now obeys the real block logic: centered two-wide openings,
  opening-to-opening or wall-to-wall on every active edge, no walled-off
  openings in either direction, frontier never reduced to zero.
- Start layout: crash plate sealed to N chosen entrances; a two-opening
  connector district pre-placed beyond each, so waves cross a full district
  under fire before reaching home. Entrances 1/2/3 = +0/25/50% meat wager.
- Economy restructured (flat bounties, wage-per-wave, +11% enemy HP per wave):
  guardrail went from noise to decisive — smart 8/8 wins, random loses 5/8.
- Known quirks for next pass: growth can wall itself in against the interior
  (off-board gates keep waves coming; consider a "burrow through" reopen
  mechanic); wager difficulty jump 1→2 gates is steep for the scripted bot;
  block/street legibility under heavy creep still the top visual debt.


## Addendum 2: escalation by TYPE, never hardening
Collins killed +HP-per-wave ("hardening is boring"). Replaced with three higher
types, each a new verb: flier (ignores terrain — punished my own bot until it
learned to cover air lanes; genuinely deepens placement), sapper (climbs to eat
towers), phalanx (per-hit damage cap; counters burst, rewards rate). Behavior
tests pin each verb. Guardrail after the change: smart 7/8 wins, 4 outcome
flips vs 0.
