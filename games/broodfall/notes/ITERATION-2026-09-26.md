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


## Addendum 5: all six genre-seat towers built; the guardrail caught a real degradation

**Built (Collins: "let's build these, also think through how combinations work, and
implement those effects"):** Broodmother (broodlings that block — enemies stop to
fight them), Digestive Pit (passable in-street trap; flow does NOT detour; holds 2,
digests, gets chewed back), Galvanic Frond (arc chains ×0.65/hop), Bile Lobber
(click-arm click-fire volley, the sling interaction weaponized), Caustic Mister
(armor shred +8/4s for ALL sources), Ocular Stalk (board-wide support-caste
executioner). Every family's verb is also a pip; the full composition rules are in
DESIGN.md "Combination algebra" (order-free multiset, strongest-slow-wins,
poison/shred/chain/knock caps), pinned by tests.

**The guardrail earned its keep.** With the roster in, blind-but-legal scatter BEAT
informed lane placement — smart 0/8 vs random 3/8 at hold-16, because sappers eat
whatever stands near the route: informed towers paid the whole tax, scatter dodged
it. Per the rule, we reworked the game, not the assertion:
1. Every limb now prioritizes CLIMBING sappers ("shoot it off the wall") — informed
   clusters cover each other; lone scattered towers still die.
2. Waves scale RANKS, never specialists (cap row+2): 8 sappers/wave was investment
   destruction in uniform.
3. Sappers crawl at 45% while climbing (the defender's window).
Also: a failed damage-first bot "discipline" starved the science loop (4 science,
45 discards incl. impalers) — reverted; the attraction economy IS the build order.
The tier-6 gate stays at 420.

**Metric change (rationale):** the guardrail scenario moved hold-12 → hold-16, one
gate. Hold-12 stopped discriminating (both policies ~7/8); four more escalation waves
is where placement has to carry. Final: fullrun hold-12 3/3 wins; guardrail hold-16
smart flips 3:2, totals 120k vs 115k. 54/54 tests; input check adds the lobber
gesture; visual/endgame green.


## Addendum 13 (Sep 27): conduit cap 2, Twinning Gland, Marrow Tap

Collins: conduit gives max 2 copies of a bonus; "one that doubles the projectiles of
whatever it's connected to"; "one that makes whatever it's connected to stop working
but can be sacrificed as many times as you want without disappearing." Built all
three (engine kinds 'twin' and 'tap'; `volley` stat; `isTapped` stasis covers
firing, auras, brood, swamp, lure; tap butcher = no removal, no salvage, banks the
target's pips + family). 3 new tests. Naive 4/10; guardrail flips 3:0.

**Brainstorm round 2 — more engine effects (not built):**
1. Mitosis Node — once per cleared wave, if its target carries ≥N bonuses it BUDS a
   copy of the target (same family, same pips) on a free adjacent block. Towers that
   breed towers: the literal runaway.
2. Echo Chamber — every hit its target lands repeats 1s later as a ghost hit.
3. Capacitor — while its target has nothing to shoot, it banks shots; when the hive
   arrives it dumps them as one burst.
4. Queen's Brand — its target's kills hatch broodlings where they fall.
5. Lens Node — target range ×2, fire rate ×0.5 (a trade, not a buff: builds choose).
6. Bloat Node — target splash ×2, range ×0.5.
7. Overcharge Node — target fires ×3 but loses hp every shot (risk you control;
   pairs with ward shields and brood heals).
8. Boomerang Node — target's projectiles fly back to it, hitting on the return too.
9. Splinter Node — target's projectiles burst into 3 fragments on impact.
10. Meat Press — target's kills pay science instead of war (fund more engines).
11. Death Insurance (Reliquary) — if its target dies, the target's bonuses are banked
    for your next build instead of lost.
12. Swap Node — trades the bonus sets of the two limbs at either end of it.
13. Homing Node — target's projectiles curve onto their targets (never miss).
14. Taunt Gland — hive bodies within reach of its target must attack the target
    (turns any limb into a tank; pairs with thorns/wards/brood heals).


## Addendum 12 (Sep 27): combo runaways are the core; science is the combo currency

Collins: "the real core of the game is building combo runaways — use the science
currency for that." Built: engine framework (`TowerSpec.engine`, generic pointing via
`conduitTarget`, pools via `conduitPool`, amplification applied last in `statsOf`),
conduit repriced to 30 science, **Resonance Amplifier** (×1.5 round-down per type,
stacking per amp; pip = the eater's own ×1.5) and **Mosaic Node** (one of each
distinct type, max one per type; pip = draws one of each neighbour type). 5 new tests
(science pricing, the rounding table incl. two layers, conduit→amp chaining, mosaic
distinctness + harvest, both pips).

Bot: first pass (more engines, cap guns/4) collapsed it to 1/10 — engines displaced
guns and didn't pay on shallow stacks. Fix = evaluate-before-buy: trial-place the
engine as a ghost, measure target dps with/without, build only on ≥15% gain, and aim
every engine at one carry. Result: naive 6/10; guardrail smart flips 5:0, totals
+33%. Measured engine use over 10 runs: 30 engines built, up to 20 bonuses funnelled
into one limb — but 0 amplifiers (every amp gain it saw was 0%: its carries hold one
of many types, and 1×1.5 rounds down to 1). Kept the rule as specified; the amp is
the human's depth tool.

**Brainstorm — more combo engines (not built; for Collins to pick):**
1. Mirror Node — copies the target's ENTIRE build (all pips, fed included) onto a
   second limb it also points at: clone your carry.
2. Crucible — transmutes pips 2:1 from one family into another (set both in its
   panel): turn surplus lure pips into bombard range doublings.
3. Leech / Siphon — MOVES (not copies) one pip per cleared wave from the limbs around
   it into its target: slow, permanent, free accumulation.
4. Resonator — +X% to everything per DISTINCT family on the target (breadth payoff —
   the mosaic's natural partner, as the amp is the conduit's).
5. Catalyst — one chosen family's pips count DOUBLE on every limb in its radius.
6. Incubator — every cleared wave, its target gains +1 copy of its most numerous
   pip family (deterministic compounding — the literal runaway).
7. Relay Conduit — a conduit that MAY target other conduits (opt-in chaining,
   conduit→conduit→carry networks).
8. Threshold Mutations — not an engine, a rule: at 5 (10, 20...) pips of one family
   a limb MUTATES and gains a new verb (5 tanglers → hits freeze solid; 5 fronds →
   arcs chain back through already-struck bodies; 5 bombards → shells split).
   Science's name was always "mutation" — this makes it literal and gives depth
   stacking a payoff beyond numbers.
9. Grafting Altar (organ) — limbs butchered next to it yield their pips TWICE.
10. Broadcast Node — the reverse conduit: lends its target's pips to every limb
    around it (one carry powers a whole battery).


## Addendum 11 (Sep 27): Marrow Conduit, placement facing + field of fire, effect links

Built the conduit (copy-funnel of nearby pips into its pointed target; harvested on
sacrifice; its pip draws the nearest neighbour's bonus). Directional limbs take a
facing at build (`build.facing`), rotate with right-click during placement and when
built, Esc cancels; field of fire drawn for them; `effectLinks` drives board links +
panel text for conduit/choir/ward, and "FED by N conduits" on targets.
Design call made explicitly: "takes" read as COPY (neighbours keep theirs).
Balance: the bot first placed conduits on gun perches (naive 5→1/10); taught it the
ward-style cluster placement + aim at the highest-dps target → 5/10, guardrail 3:0.
Test note: wave-rhythm check now ignores skitterlings (split children of a husk
dying after a siege timeout are not arrivals). 94/94 tests; input check covers
rotate-while-placing, right-click-rotate on a built limb, Esc cancel; screenshot beats
tools/screenshots/beat-fieldoffire.png + beat-conduit-preview.png (via
tools/shot-preview.mjs) show the lane, gather ring, source/target links.


## Addendum 10 (Sep 27): burn, and three more cloaked kinds

Collins asked whether anything applied burn — nothing did (the swamp's "burn" was
loose wording for acid; fixed in the docs). Built: BURN status (hottest-wins,
contagious: spreads every 0.5s to neighbours within 22px at 80% heat, reveals the
cloaked); the Ember Sac (cone flamethrower, ground, 8/s for 3s) and its pip (+3/s
ignite on any limb). Three more cloaked kinds: Shadewing (war, cloaked flier, t4+),
Ghost Sapper (war, cloaked climber, t5+), Veil Matron (royal, arrives with the royal
event, cloaks every war body within 90px — cloaking became a live state,
`isCloaked(e)`, not just a spec flag). 90/90 tests (5 new); naive hold-12 5/10;
guardrail flips 4:0, totals +30%. Browser checks green.


## Addendum 9 (Sep 27): the payload rule, detection, air/ground, swamp, dependency

**Collins's batch:** swamp as the anti-wall; lure pip = toxic pheromones; spine pip =
caltrops on kill; a shotgun; a one-direction long lobber with a quirk; sling pips build
off creep + sling death kills what stood on its creep; brood pip = 50%/wave; "nothing
should ever do nothing" for sacrifices on effect producers; detection/invisible
enemies; visible air/ground + an anti-air specialist.

**Built:** HitFx payload (every contact goes through `payloadHit`); stats gain
tempo/potency/reach used by producers; choir/ward SHARE hit-verb pips; Digestive Swamp
(no hold limit, digests ≤30hp in mass); lure pulses; thorns; caltrops; clouds;
Quill Fan, Skipping Mortar (facing in panel; skips), Netcaster (air-only, grounds
fliers); hits layers + card/panel/board tags; Stalker (war) + Infiltrator (science)
cloaked, Ocular detection aura + true sight, marks from clouds/mist; sling patch
ownership + `witherUnrooted` + cannibalize-hover warning; brood 50%/wave + extra
broodling on a mother. Fixed a latent bug: science visitors held waves open until the
70s timeout (hostile check was "not a researcher", now "not science caste").

**Balance (10-seed sweeps):** the rework made the body far stronger (naive 10/10;
ablation: swamp, quill, net+skipper each carried part; "none" 5/10). Quill trimmed
(7×5 for 18 → 5×5 for 20). More bodies did NOT bite (waveCountScale 0.09→0.21 all
~9-10/10: extra kills fed the economy) — the lever is HIGHER TYPES SOONER:
threatPerTier 46→37 (tier6 338). 36 vs 37 straddles a tier boundary (3/10 vs 7/10);
37 kept. Final: naive 7/10; guardrail smart flips **5:0**, totals +35%. 85/85 tests
(8 new pinning detection, layers, dependency, payload-on-producers, caltrops/clouds,
wave heal, quill/skipper, science-not-hostile); input check turns the mortar's facing
with real clicks.


## Addendum 8 (Sep 27): the cannon (both castes), spore bombard, ward membrane

**Built:** siege cannon (war) + sedation battery (science) — walk, deploy, shell over
terrain; shells are a new lobbed-projectile system shared with the player's bombard.
Spore Bombard (player-set marker, counter-battery). Ward Membrane (projected shield on
neighbors; all harm incl. sedation routes through `hurtTower`, shield first). Pips:
ward → permanent 60 shield; bombard → double range. 13 new behavior tests.

**Balance, measured by 10-seed ablation (the 4-seed version misled):**
| content | naive wins/10 |
|---|---|
| last turn's content | 6 |
| + ward only | 4 (card dilution) |
| + bombard only (first bot) | 1 — the bot aimed markers at the cell nearest the CORE |
| everything, first cannon tuning | 1 |
| everything, final | 4 |
Fixes, in order of measured effect: (1) sedation battery stun-locked the outer layer
(2.5s stun / 3.2s, 150px, immortal, accumulating 6-7 per run) → 1.2s / 4s, 130px,
8-dart kit then leaves, one at a time; (2) war cannon out-demolished everything that
could reach it (20 dmg / 2.6s from 165px) → 12 / 3.2s from 150px, and AUTO targeting
prioritizes emplaced cannons; (3) bot learned support placement (ward behind guns
covering ≥2 unwarded, bombard deep and high) and counter-battery (bombard marker on
emplaced cannons, else densest switchback far out).

**Metric change (rationale):** fullrun "2 of seeds 1-3 winnable" → "≥3 of 10 seeds":
the same code swung 3/3 ↔ 0/3 on reshuffled draws with losses at −1 core hp; a rate
needs a sample. Final: naive 4/10; guardrail smart flips 2:0, totals +16%; 75/75
tests; input check drives the bombard marker with real clicks.


## Addendum 7 (Sep 27): smart science caste, limb panel + targeting, arc prism, royal role

**Science caste = smart, by default.** First pass misread Collins as "a special unit
that steals towers" (a collector); he corrected it mid-build: "that is their default
behavior... they are smart and will try to walk around your tower defences to the most
vulnerable locations." Rebuilt: a per-cell coverage map (summed dps of armed limbs)
drives a route cost; researchers (and thieves) walk the gaps, target the least-covered
reachable limb, sedate it, carry it off; killing the courier re-roots it. Collector
unit deleted. Tests pin: target = least-covered approach; smart path exposure ≤ the
straight march's; steal → kill → limb restored with traits.

**Limb panel:** click a limb → hp, stats, traits, targeting (AUTO/FIRST/STRONGEST/
WEAKEST/FOCUS + caste priority), via a new sim command so it is deterministic and
scriptable. AUTO is the old tuned behavior exactly.

**Arc Prism:** focus ramp (+12%/consecutive shot, 5 max) + relay network (idle prisms
chain charge breadth-first to the firing prism, +50% each, spending their shot). Pip:
any limb ramps.

**Royals:** Collins asked "royals are mostly about powering up others and super
strong, but otherwise act like warriors right?" — they were NOT (royal was just a big
body; the consort bred militia). Now they are: presence aura (war bodies ×1.5 damage to
structures, ×0.7 damage taken within 120px), consort promotes a rank every 5s.

**Measured:** 68/68 tests; guardrail smart 5/8, flips **5:0**, totals +29% — the
strongest separation yet (smart science punishes gappy scatter exactly as intended);
fullrun hold-12 naive 2/3. Browser checks green; the demo endgame run now loses its
seed (overlay still verified).


## Addendum 6: enemy genre expansion, the RISK law, faction audit

**Collins:** "what enemy types or abilities do people like in tower defense — take
them for inspiration, assign the correct RISK which drives how many spawn
(#×risk + number×risk per wave), and make sure they're assigned to the right
faction of the three."

**Built — 6 new kinds, each a beloved genre seat** (survey in
references/ENEMY-GENRE-REVIEW.md; explicit skips: camo needs a detection layer,
element resists conflict with verb-based counters, regrow overlaps the tender):
- skitterling (swarm chaff) + gravid husk/splitter (Bloons seat: shot dead → 2
  skitterlings; maw-eaten whole → nothing);
- mortar beetle (standoff siege: halts 85px out and bombards structures; long guns
  and broodlings answer it);
- carapace lord (hit-count shell 6: the phalanx's MIRROR — big hits strip it, rapid
  fire feeds it; poison seeps through);
- specimen thief (SCIENCE caste: joins study parties past interest 12, steals 15 war
  meat at the creep, runs; killed courier drops the goods; escaping visitors now exit
  through the frontier when the flow field tops out — fixed a stuck-walker bug);
- royal consort (ROYAL caste retinue: breeds 2 militia/6s while alive, 40 royal meat).

**The RISK system:** every EnemySpec carries `risk`; wave counts follow
count = row × (1 + (scale−1)×riskBaseline/risk), replacing the per-flag specialist
cap with one continuous law. Wave total risk is telegraphed in the HUD (RISK n).
Faction audit: WAVE_TABLE is war-caste-only (invariant test); science visits via
interest; royals only with the royal event; the core no longer wastes venom on
science-caste non-combatants.

**Balance:** the expansion RESTORED hold-12's difficulty — at hold-16 neither policy
survives (0-0 discriminates nothing), so the guardrail went back to hold-12 and is
the most decisive it has ever measured: smart 6/8, outcome flips 4:1, totals +11%.
waveCountScale 0.10→0.09 as global relief; mortar/carapace/splitter row counts
trimmed after a first pass overshot (fullrun hold-12: 2/3 naive wins). 61/61 tests,
build + input/visual/endgame green.
