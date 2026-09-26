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


## Addendum 3: cannibalize UX rework + roster expansion (same day, Collins live feedback)

**Cannibalize (Collins: mode toggle "super unintuitive").** The FEED A LIMB toggle is gone.
New flow: card armed → hover your tower → highlight + salvage hint → click eats it on the
spot (60% cost salvage credited immediately, trait history banked; stacks across multiple
butcherings) → place inherits everything. Sim: new `butcher` command + `pendingPips`;
legacy atomic build+cannibalizeTowerId path kept for the autoplayer/tests, now with the
same salvage economy. The footer button is now a passive banked-traits indicator.

**Roster (Collins: "list the behaviors and brainstorm more, let's get this in").**
4 new tower families, each a new verb AND a new pip: Snare Bed (slow), Blight Vent
(poison DoT that ignores armor caps — the second phalanx answer), Impaler (line-piercing
harpoon, ignores shields), Choir Node (fire-rate aura, capped 2 voices). 4 new enemy
kinds, each a new verb: drummer (speed aura → priority target), bomber (charges
walls/organs, detonates; ground-level structures only — this is the anti-wall unit),
tunneler (burrows under the outer line untargetable, surfaces at 45% flow-distance),
tender (heal pulses). New tier-6 "everything they have" wave row, threat-gated at 330 so
hold-12 peaks at tier 5 (ungated it arrived by wave 11 and collapsed both run suites).

**Measurements after the change (all 40 tests green; visual/input/endgame green):**
- Behavior pins added for every new verb (slow expiry, poison-through-armor, pierce cap
  bonus, drummer aura excl. self, bomber charge+detonate, tunneler untargetability +
  surface depth, tender heal cap, choir aura, butcher salvage math, trait stacking).
- Naive-policy hold-12: 3/3 seeds win (tier 5-6 reached, seed 3 took 699 damage).
- Guardrail: smart 6/8 wins, outcome flips smart 2 : random 1, totals within margin.
  RATIONALE for the drop from 7/8, 4:0 — bombers specifically punish the smart bot's
  signature move (spine walls in lanes) and tunnelers punish perimeter-only coverage;
  random scatter dodges both by accident. The assertion still holds (informed placement
  flips more seeds), and the counterplay (kill runners on approach, interior coverage) is
  real for a human. Next bot iteration: rebuild blown walls promptly, keep one interior gun.


## Addendum 4: creep logistics (sling + root) and the genre survey

**Collins asked for:** a building that TOSSES creep to a chosen further-away location,
a creep node that expands creep DIRECTIONALLY, and a review of well-loved towers from
other TD games.

**Built — creep is now multi-source** (core radius + any number of sources, each a BFS
distance map over active cells):
- **Spore Sling** (tower card, 22W 10S): click the built sling → range ring → click any
  claimed ground within 300px → a clot arcs over and seeds a patch (3 cells, grows to
  8). 20s recharge, arm cocks visibly when ready. No mode button — object-initiated,
  per the interaction rule. Pip: the limb itself seeps creep, +1 cell per pip.
- **Tendril Root** (organ, 15W 15S): a base pad plus a creep LOBE that lengthens 0.35
  cells/s (max 14) in its compass direction — defaults toward the nearest gate, click
  to cycle N→E→S→W, arrow drawn on the organ.

**Balance journey (measured, three rounds):** naive sling builds were dead weight and
sank the smart bot (6/8 → assertion fail). Teaching the autoplayer real technique —
build ONE sling, throw toward the telegraphed gate each recharge, discard surplus
sling cards — plus raising the tier-6 threat gate 330→420 (hold-12 tops out ~330, so
desperation waves stop leaking into standard runs) landed at: **fullrun 3/3 wins,
guardrail smart 8/8, flips 1:0, smart totals above random. 43/43 tests; input check
now covers arm→throw→seeded-creep and root re-aim as real gestures.** An interior-gun
reflex (2 guns within 5 hops of core) arms only when threat nears the tier-6 gate.

**Genre survey:** `references/TOWER-GENRE-REVIEW.md` — 14 beloved archetypes mapped to
our seats (9 HAVE, 3 PARTIAL, 2 GAP after today). Ranked gap list: Broodmother
(barracks seat — the genre's most-loved archetype), Digestive Pit (trap seat),
Galvanic Frond (chain), Bile Lobber (aimed damage), Caustic Mister (armor-shred aura),
Ocular Stalk (global sniper). Explicit non-adopts: heroes, crit RNG, decay.
