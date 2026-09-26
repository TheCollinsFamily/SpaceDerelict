# Space Derelict Prototype Overview

**Date of this overview:** Current session

## Original Project (from DESIGN.md)

**Core Fantasy:** Rim predator on a frankenstein ship made from salvaged enemy chunks. Cut enemy corridors, EMP their systems, gas the ducts, then claw in the hulk, feast on the crew for power, and bolt on the best piece.

**Key Mechanics (from DESIGN):**
- Ship: 2D grid. Corridors: 4-way connected from core (flood-fill active network). Components: active only if adj to active corridor. Artifacts: modify adj (bonuses/penalties), no power needed usually.
- Cell states: Intact / Disabled / Destroyed (carry to graft; destroyed = unusable in chunk).
- Chunks: Enemy breaks into ~3-7 tile logical sections. Choose exactly 1 to graft at port (rotation ok). Unchosen = scrap. Destroyed in chunk = lost space/components.
- 6 Damage Types (strategic, capture vs shatter):
  - Ion: Strong vs shields, strips to enable others.
  - EMP: Yes vs shields, disables comps/corridors (permanent for fight).
  - Kinetic: Normal vs all, creates destroyed.
  - Breach: Normal shields, triple hull, shatter specialist.
  - Fire: DOT on non-active-corridor only (unconn comps/corridors/hull); dangerous to self.
  - Nerve Gas: Inop corridors only; requires shields down; no perm damage; soft capture.
- Combat: Pausable orders, target systems. End when disabled or hull gone.
- Loot quality: Good capture (mostly intact/disabled, low destroyed) = best chunks + full feast. Messy = medium. Shatter (high destroyed) = high scrap, poor grafts, low/no feast.
- Run: Hub (graftyard, shops, feast upgrades, Vat clones) -> Sector map (choose nodes, **avoid Techopuritan zones**) -> fights -> post (choose chunk/graft/repair) -> repeat. Death -> tube (reveal: entertainment for thrill-seekers, you are monster).
- Meta: City progression (new grafts, feast tree, district unlocks). Get stronger/infamous. Ratings for brutality (game show).
- Factions: Techopuritans (big bad, avoid), your rim predators (feast rush), various prey with flavor/mech diffs (e.g. good guys hurt rating if over-brutal).
- Prototype order: 1-10 as listed (grid, connectivity, dmg, capture/chunk, graft, shields, scrap/repair, hub+loop, narrative, polish/more artifacts/factions/map).

**Non-goals v0.1:** Full crew simulation (no individual crew pathing). Beautiful art (programmer visuals / colored grid first). Huge content (a handful of chunk templates, 3-4 enemy 'factions' via slight stat differences). Multiplayer or save/load across sessions (local JSON later).

**Key Fun Questions to Validate Early:**
- Does choosing 'capture for the good chunk + feast' feel meaningfully different from 'shatter for scrap rush'?
- Does sniping a corridor junction to disable a whole grafted wing feel powerful and tense?
- Does grafting a new chunk immediately make the next fight play differently (new weapons online, new weak points the enemy can exploit)?
- Is the 'I am the monster' tone coming through without being preachy?

## What We Built (current prototype in model.py + main.py + docs)

From code inspection (grep for classes/defs), demo output captures, and updated DESIGN/README status sections (which accurately reflect progress):

**Core Ship & Rules (complete + enhanced):**
- Full grid model, 4-way flood-fill active corridors from core (get_active_corridors).
- Components only active if adj to active corridor (is_component_active).
- Artifacts with 15 kinds with real mechanics: ... + widebeam (doubles beam to hit target + right adj comp), bypass (allows adj comps to be active w/o corridor connection), distributor (transfers artifact powers any connected component has to all other connected components).
- Cell states carry; generate_salvage_options + extract_chunk **explicitly filter DESTROYED cells** -- broken hull = no additional space in grafted chunk; broken components = not received (user-requested feature fully in; UI note in post-combat: 'Only surviving (non-destroyed) cells... slots are lost').
- Grafting: port + rotation, try_auto_graft with connectivity validation (tries rotations/ports/docks, undoes non-connecting, prefers corr seams; 'network connected: True').
- 6 damage types + model extras: get_active_shield_count, has_*_protection, apply_damage with full interactions (ion/emp strip shields first, gas blocked by shields, fire only non-active, breach hits artifacts, kinetic creates destroyed, sides for artifacts). calculate_ratings for brutality.
- Combat: simple_combat_demo supports multi-order per turn before resolve; resolve_combat_turn does fire spread + retaliation from active gun threats + self-repair from medical/nanite. get_active_threats for display.
- Render: rich grid with per-kind glyphs (G/L/M/P/O/S for comps; B/V/J/N/O/U/R/F/S for artifacts), active (bold) vs off, integrity/cells, full legend. Panels for everything.

**Economy, Post, Loot (strong, game show twist):**
- Resources: scrap (repairs + from destroyed), feast (intact + bonuses from special intact artifacts), ratings (infamy from brutality: destroyed*3 + quality bonuses + log keywords for FIRE/BREACH/EXPLOSION etc; lower for clean capture; node multipliers).
- post_combat_phase: get_capture_quality, compute_loot (with special bonuses), generate_salvage_options (3 named logical chunks from sub, only surviving cells, states), choose graft (auto or basic attach) or s (extra scrap), award ratings with flavor text ('AUDIENCE IS GOING WILD', 'Solid carnage', 'surgical for the bloodthirsty crowd'). UI explains destroyed filter.

**Runs + Sector + Loop (fleshed campaign feel):**
- play_one_full_run: generate_sector (4 nodes with desc/risk/ratings_mult/faction), player map choices (detour/continue, avoid Tech), get_node_enemy (faction/diff aware: tech more armor/spine + exotics if unlock; scaling pre-damage/turns), combat/post/hub per encounter.
- Grafts visibly impact (ship cells grow, new active comps/threats in next enemy render, network changes).
- --demo + interactive support full multi-'season' with sector.

**Home Base / Meta / Persistent (advanced):**
- Per-encounter do_hub: repair (scrap), feast->scrap vats (monster flavor), some unlocks.
- Interactive CITY WHILE LOOP: persistent across seasons in one session + full save/load (json: ratings/unlocks/career totals/seasons/high_score).
- Spend Ratings: vat_v2, hype (+25%), exotic_pool (more adv artifacts in risky), sponsor (+scrap), entertainment district (+10% ratings), starting laser pod.
- Spend Feast: Feast Tree (prereq tiers): I +3 start feast, II +10% loot + better clone start (extra cells), III free repair + start artifact.
- Launch applies (starting res/ship extras, enemy variety via unlocks in get_node, more fights).
- View: fame, districts (entertainment/feast/graft), career.
- Retire (option 5): full 'PRODUCERS REPORT' career summary (totals, audience score = ratings +2x feast +10x unlocks, high score). Save.
- Auto-save after runs.
- Sector consequences (survive Tech -> tech_survivor unlock -> richer future Tech enemies).
- Narrative: tube on death (variations for late/high carnage), post-run FEAST PARTY (audience reactions based on ratings; 'vats overflow', 'wants more shatter'), game show everywhere (producers, audience, ratings for carnage, 'monster' tone).

**UI/Other:**
- Rich, panels, logs, flavor.
- --demo: scripted seasons + city sim notes.
- Grafts change fights (visible in renders, threats, integrity).
- Destroyed filter + UI as requested.
- Matches original core + extras (ratings/game show, more artifacts, save meta, career).

**Matches original closely:** Ship model/connectivity/dmg triangle/capture-shatter, chunk choice+state carry+destroyed lost, grafting, economy (enhanced), hub/city meta, sector+avoid, narrative tone+tube, artifacts.

## What Needs Fleshing Out Before Ready for Testing (the Key Fun Questions)

The prototype already lets you play full contrasting seasons and feel the loop (choices matter for ratings vs power/grafts, map risk/reward, city boosts change next, tone present, destroyed filter works). Basic testing of questions is possible today via interactive (multiple seasons, different paths: capture-heavy vs shatter, avoid vs risk Tech, spend vs hoard).

**Concrete Gaps (prioritized from DESIGN prototype order item 10, README 'Next Steps', key questions, non-goals, and code gaps):**

1. **Better procedural enemy chunks + more artifact effects / component subtypes (README #1, needed for 'graft changes fight' variety):**
   - Current: Fixed templates (make_gun_pod etc) + assemble + conditionals in get_node_enemy (for faction/exotic/tech_survivor). generate_salvage works on them.
   - Gap: Not procedural/generated. Enemies similar run-to-run (same layouts, just scaled/different names). Subtypes mostly visual (glyphs) or limited effects (shields count, medical repair in resolve, some loot/protection/sides). No 'laser does X different in combat' or random layouts.
   - Needs: Add def generate_chunk(faction, difficulty, size) -> Chunk that randomly assembles corridors + 1-3 mixed comps/artifacts (biased by params, e.g. techopuritan = more armor + volatile; derelict = high artifact + pre-damage risk). Use in get_node_enemy. Flesh subtypes: e.g. in resolve/apply_damage or threats, 'laser' stronger retaliation or pierces 1 shield; 'power' if destroyed disables adj; different in loot or activation. Add 2-3 more kinds.
   - Why for testing: Validates 'graft immediately makes next fight play differently' with real variety (new weapons online, weak points). Without, feels repetitive.

2. **Sector map more robust + consequences (README #2, DESIGN core):**
   - Current: 4 fixed nodes, linear + 1-2 choice points per run, good desc/risk/multi/faction, some consequences (one unlock).
   - Gap: Not a full 'few nodes' with real graph/branches. Limited replay (predictable). Few persistent map effects. No 'shops' at map level or more avoidance mechanics (e.g. 'attacking good guys hurts rating' - no Confederacy nodes).
   - Needs: generate_sector create varied graphs or more nodes per run. Add 1-2 nodes (Confederacy: brutal = rating penalty; Pop Fiz: psychotic flavor). More choices + cumulative (e.g. if cleared a node, later easier or bonus). Tie more to city (e.g. surviving risky unlocks permanent district).
   - Why: Tests map choices matter and 'avoid overwhelming zones'. Different paths should lead to different power curves/loot/ratings for key questions.

3. **Deepen meta progression / city (feast tree, districts, Vat, shops - DESIGN/ README #3):**
   - Current: Good - ratings/feast menu with tiers (prereqs, starting bonuses, clone ship extras, artifacts), districts flavor + multipliers, unlocks affect play (starts/enemies), vat tiers, career stats, save/load, retire. Per-fight hub has some.
   - Gap: Feast tree linear ifs (no visual tree). No real 'shops' (scrap for one-time like temp buff or bulk repair). 'Vat for clone continuity' is bonuses (no actual clones or continuity e.g. choose traits, death penalty mitigated). Districts mostly flavor (no unique per-district events/shops). No 'new graft options' depth beyond unlocks. No full 'feast party' post-good-run (we added basic text).
   - Needs: Visual tree (print with unlocked/locked + costs). Add 2-3 shop options (e.g. 'buy 1 repair 10 scrap', 'temp shield for next fight 20 scrap'). Flesh Vat: e.g. on death if upgraded, bonus starting or reduced penalty. District effects (entertainment = higher base ratings; graft = more chunk options in city). More tree tiers or branches.
   - Why for testing: Meta must feel rewarding and change power. Test 'get stronger/infamous'. Capture (feast for tree) vs shatter (ratings for city) tradeoff must be meaningful across seasons.

4. **Narrative beats + tone (prototype order 9, key question #4):**
   - Current: Tube on death (with late/high-carnage note), post-run feast party (audience based on ratings; brutality vs surgical), game show flavor (producers, audience, ratings for carnage, 'they are you' in vats), sector narrative, retire 'producers report'.
   - Gap: 'First death big reveal' always similar. 'Feast party flavor' basic text (no real party or post-good-run in city beyond one if). Limited path-based var (e.g. high ratings brutal vs clean). 'Attacking good guys hurts rating' not there (no Confederacy). Tone present but can be stronger/more varied.
   - Needs: More tube var (e.g. high career ratings death = 'legendary even in defeat'; low = 'disappointment from crowd'). Real post-good-run city 'feast party' with more text (based on season ratings or total). Add Confederacy-like node (brutal attack = rating hit). More in retire (e.g. 'favorite brutal moments' from high rating fights, 'surgical highlights').
   - Why: Key question 'monster tone without preachy'. Needs strong varied narrative to test across paths/seasons. Makes meta feel story-driven.

5. **Polish, balance, content, testing aids (order 10 + key questions):**
   - Balance: Ratings/loot/upgrade costs/node diff may need playtest tuning (e.g. too easy to get high ratings? grafts too weak/strong?).
   - UI: City functional but text-heavy (add more Panels). Legend long. No easy 'view current bonuses' or help.
   - Content: More chunk templates or procedural (see 1). More factions (light in nodes only). 'Claw pull' text only. No boss/longer campaigns.
   - Combat: Good multi-order, but fully manual. No pause feel or auto-resolve option. Subtypes could do more (see 1).
   - Testing: Easy meta reset (rm json or --reset flag). Log stats for questions (e.g. 'capture season: X feast Y ratings; shatter: ...' ). More --demo modes for contrasting paths. Interactive needs real terminal (documented).
   - Why: To validate questions reliably without 'feels incomplete' or 'numbers off' feedback. Variety/balance needed for 'different from shatter' etc.

**Other:**
- Save/load only meta (fine; full run state not critical for v0.1).
- No graphics (later; use image_gen when core fun).
- Non-goals ok (no crew sim, art, huge content, cross save beyond json).
- The built prototype already lets you feel the full loop and test basics (play 2-3 seasons different strategies, retire, see score). Fleshing 1-4 above will make it 'ready' for clean external testing of the 4 questions without holes.

## Recommendations
Prioritize 1 (procedural chunks for variety) + 3 (meta depth) + 4 (narrative) + 2 (map polish) next. Then internal playtest (contrasting seasons), tune, add aids (reset, stats log), then declare ready. Core is strong; game show + destroyed filter + persistent city are great extensions.

Current state supports basic testing today via interactive (multiple seasons, paths, retire). Gaps are for polish/variety to make testing effective.

See code (model.py for rules/chunks, main.py for loops/city) + run python main.py (interactive) or --demo for live state. Meta json for persistence (rm to reset).
