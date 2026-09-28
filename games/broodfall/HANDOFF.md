# BROODFALL — handoff for a new instance (Sep 26 2026)

Read this first, then DESIGN.md, then PLAYTEST_PROTOCOL.md (repo root). The protocol is
not optional — this project shipped three broken boards in one day because the previous
process only verified its own assumptions. Repo CLAUDE.md carries the standing rules.

## Where things live

- Repo: `C:\Users\Merry\dev\space-derelict` — the Technopuritan Universe monorepo.
  Every universe game is a folder under `games/`. Work on main, push to main, never branch.
- This game: `games/broodfall/`. Sibling: `games/space-derelict/` (older game, don't touch).
- Docs here: `DESIGN.md` (game design + every Collins decision), `TECH.md` (stack + future
  AI-asset pipeline), `PLAN.md` (original slice plan), `references/CONVENTIONS.md` (genre
  checklist with current YES/PARTIAL/WEAK status), `notes/ITERATION-*.md` (what happened
  and why), `README.md` (run instructions + surface inventory).

## What the game is

Tower defense roguelite. You are an escaped Technopuritan bioweapon growing across an
insectoid city. Towers are limbs on creeped city blocks, organs grow on plaza ground,
meat comes in three caste currencies, cards are the build system, cannibalizing towers
into new builds carries visible trait pips. The empire frame (procurement-voice UI,
procreation-license standing) is diegetic. Full loop exists: menu → deployment →
debrief → ship gene bay → redeploy.

## Collins's non-negotiable design rules (all already implemented; do not re-litigate)

1. **No RNG destruction of player investment** (no "instability" mechanics).
2. **Win = wave count or quest directive** (hold/royal/harvest), never a resource bar.
3. **Escalation = more enemies + higher TYPES, never stat inflation.** No HP-per-wave.
   Higher types carry new VERBS (flier ignores terrain, sapper climbs to eat towers,
   phalanx caps per-hit damage).
4. **The board is drafted plates** (Tower Dominion school): starts small, grows by choosing
   1 of 3 district plates every 3rd cleared wave. Uniform street grids and radial fields
   are banned — both measurably killed placement value.
5. **Plate connection algebra**: openings are two-wide, CENTERED on edges; opening mates
   opening, wall mates wall, nothing may wall off an opening in either direction, at least
   one real connection, and a draft may never reduce the frontier to zero gates.
6. **Never start one plate deep**: a two-opening connector district is pre-placed beyond
   every crash-plate opening, so waves cross a district of guns before touching home.
7. **Entrances are the difficulty wager**: 1 gate default; 2/3 selectable ("insertion
   profile") for +25%/+50% meat.
8. **Towers beside the path, never in it** (spine wall is the one in-street piece);
   verticality matters (block heights 1-3, +10% range per level).
9. **Waves are discrete**: telegraphed lanes, squad spawns, cleared banners + wage,
   call-early button; researchers only during growth; royal only enters with a siege.
10. **Caste spend rule: war is generic, science comes from mutations, royal is for
    SPECIAL upgrades.** The royal special-upgrade sink layer is NOT built yet (the
    biomass surge is a placeholder) — it is high on the backlog.
12. **Science caste is SMART by default** (not a special unit): coverage-aware routing
    to your least-defended limb, which they sedate and steal. Royals are super-strong
    warriors whose weight is empowering others (aura + consort promotions).
13. **Click a limb** for its panel: hp, traits, and player targeting (auto/first/
    strongest/weakest/focus + caste priority).
14. **Nothing ever does nothing** (the payload rule): every pip modifies whatever the
    limb touches the hive with; support limbs share their hit-verb pips. **No caps.**
15. **Air/ground is always visible** (card tag, panel, board chevron); **cloaked
    enemies need detection** (Ocular aura/pip, or pheromone/mist marks).
16. **Creep dependency:** a sling's patches die with it, and limbs standing only on
    creep that dies wither. Sling-pipped limbs make their own ground.
18. **THE CORE IS COMBO RUNAWAYS, and science meat is the combo currency.** Combo
    engines (conduit, amplifier, mosaic — directional limbs that manipulate other
    limbs' bonuses) cost science only; engines chain; amplification applies last.
    Built engines: conduit (max 2 per type), amplifier, mosaic, twinning gland, marrow
    tap, mitosis node, capacitor sac, boomerang node, meat press, reliquary (a pair).
    The rest of the engine ideas are in notes/ITERATION addenda 12-13 for Collins to pick.
    **Science buys ONLY engines and evolutions** (Sep 28); basic limbs and organs cost war.
19. **Evolutions** (Sep 28, from Tower Dominion): every limb/engine has 3 stages, pick A
    or B at each (a path reads "ABA"). Stages 1-2 science only; stage 3 also needs ONE
    royal point (royal meat is counted in points: consort/matron 1, royal 3). Trees in
    `content/upgrades.ts`; bought in the limb panel's EVOLVE section; crest on the limb.
20. **The doubling rule** (Sep 28): a second copy of any bonus always changes
    something — DESIGN.md has the table; `tests/evolution.test.ts` enforces it.
21. **The organ stage** (Sep 28, like Ball x Pit's town): wave setup → wave → organ stage
    → wave setup → … Shaped organs grow around the half-buried meteor. THEME organs unlock
    limb groups into the draw (nothing else is drawn) and power them by level; touching
    themes share signature verbs; zone organs (heart/brain/gland) boost what touches their
    zone; roots carry adjacency. Unspent war/science is LOST when a wave starts (royal
    points kept). DESIGN.md "The organ stage" has the full table.
23. **The campaign** (Sep 28, BUILT): menu → CAMPAIGN → the ship (Directive Desk globe,
    Gene Bay, Specimen Locker, Procreation Board, Comms, AI Core) → a briefing → a run →
    the debrief. Standing (Requisition Board) vs field notes (dares, experiments); 16
    territories hold the evolution unlock points; the colony pushes back; three factions,
    each with its own route and ending; the ship AI (YOKE) talks on Kimi K2.6 through
    rfab.ai (POST /api/broodfall/ship-ai, billed to the RFab account; the Vite proxy
    /rfab-api adds this PC's RFAB_API_KEY) and falls back to the scripted YOKE, saying
    why, when rfab.ai cannot answer (backend deploy owed: until then it says "rfab.ai does
    not have YOKE yet"). The AI Core shows the link, a USE SCRIPTED switch and a key box.
    The lore book (content/lore/) is Collins's to write, later. Code: content/campaign.ts,
    src/meta/, src/ui/campaignUi.ts.
22. **Creep is the core of the organ game** (Sep 28): free creep NODES grown by Spore
    Bladders, one every 2 TURNS (every turn with a pacemaker); creep organs TOUCHING a bladder set its nodes' strain (faster, doubled,
    bigger, thrown, mire, burning); nodes mature and spread one child; trampling and
    shells can kill a node and its creep. Catapult Sac unlocks the Spore Sling; Runner
    Gland unlocks the Creep Lance (a strip of creep). DESIGN.md "Creep".
17. **Direction and effects are always visible:** directional limbs show a field of
    fire and rotate with right-click (Esc cancels); effect limbs (conduit, choir,
    ward) draw what they affect and say it in their panel.
11. **No mode toggles, ever.** Cannibalize is hover-a-limb (affordance + salvage
    preview) then click: the limb is eaten on the spot, 60% of its cost credits the
    payment, traits bank into the next build. Actions live on the object, found by
    hover — never behind a button the player must arm first.

## Architecture (all TypeScript, no engine, no editor)

- `src/sim/` — deterministic fixed-timestep sim (10 Hz, seeded mulberry32, ZERO render
  imports). `sim.ts` orchestrates; `citymap.ts` owns plates/algebra/flow-field/creep
  distances; `autoplayer.ts` is the scripted player (coverage + lane + air-lane + height
  scoring); content lives in `content/data.ts` (balance), `content/plates.ts` (plate
  patterns + genes).
- `src/render/render.ts` — PixiJS 8, procedural placeholder art, camera that frames the
  active districts. `src/ui/hud.ts` + `src/main.ts` — DOM HUD, screens, input, game loop.
- Determinism is sacred: sim never touches Math.random; every rng call order change
  reshuffles all balance measurements.

## How to verify (all must be green before claiming anything)

```powershell
npm test             # 187 tests: sim, evolutions + the doubling rule, plates algebra, wave rhythm, per-verb behaviors
                     # for 29 tower families + 26 enemy kinds (combo engines, burn, payload rule, detection,
                     # air/ground, dependency, cannons, shields, bombard markers),
                     # naive win RATE over 10 seeds, smart science routing +
                     # limb theft, targeting modes, prism relays, the risk law, faction
                     # invariants, butcher economy, creep logistics, combination-algebra
                     # caps, full autoplayed runs, and the PLACEMENT GUARDRAIL
                     # (hold-12 again — metric history in ITERATION addenda 5-6)
npm run build
npm run test:visual  # headless chromium: HUD + per-region pixel checks (camera-aware)
npm run test:input   # real player gestures: build, cannibalize, organ, cancel
npm run test:endgame # full in-browser run to the victory overlay
node tools/shot-evolve.mjs   # real clicks through all three EVOLVE stages
node tools/shot-engines.mjs  # the five utility engines in the real page
node tools/shot-under.mjs    # organ stage through the real loop: wave 1, grow + share, meat spoils at wave 2
node tools/shot-creep.mjs    # creep: bladder recipe, tray chip, thrown node, mature, spread its child
node tools/shot-campaign.mjs # the campaign loop: ship → globe → briefing → run → debrief → faction → YOKE (scripted)
RFAB_API_BASE=http://localhost:3011 RFAB_API_BEARER=<jwt> node tools/shot-yoke-live.mjs  # PAID: live YOKE on Kimi, fallback, switch
```

The **placement guardrail** (`tests/placement.test.ts`) is the genre's heartbeat: a
chokepoint-aware bot vs a random-placement bot, identical economy, 8 seeds. Informed
placement must flip more seeds to wins. If a change breaks it, the change degraded the
game into decoration — rework the change, never the assertion (metric changes need a
written rationale like notes/ITERATION-2026-09-26.md has).

**Player-path rule**: nothing is "done" until started the way Collins starts it —
`npm start` or `Play Broodfall.bat` — and played by hand in the page. Test harnesses
don't count as the player path.

**AI-play API** (browser console / Playwright): `window.broodfall` —
`step(n)` (synchronous ticks, no rAF throttle), `play(cmd)` (raw sim command incl.
choose-plate), `summary()`, `buildableCells()`, `camera()`, `worldToScreen(x,y)` (use for
all scripted clicking/pixel sampling — the camera transform broke naive math once already).
URL params: `?seed= &auto=1 &autostart=1 &speed= &directive=hold|royal|harvest &entrances=1..3`.

## Current balance state (don't trust memory — re-measure)

Scripted player, hold-12, 1 entrance: 2/3 measured seeds win (the enemy expansion
restored real difficulty); 2-3 entrances much harder. MEASURE WIN RATE OVER 10 SEEDS,
never 3-4 (addendum 8: small samples swung 3/3 ↔ 0/3 on draw noise). Current: naive
hold-12 4/10; guardrail smart flips 4:0 (Sep 28, bladders every 2 turns; threatPerTier 21). The bot buys combo engines
only on a measured ≥15% gain (trial-places a ghost) and aims them all at one carry. Difficulty knob =
threatPerTier (21, tier 6 at 192; organ level bonus 10% — addenda 17-20). The bot
spends science on evolutions for its top-killing limbs (A/B by a dps read). The bot uses support limbs by
their own logic (ward behind guns, bombard deep + counter-battery on cannons). The bot throws
sling clots at the telegraphed gate, volleys the lobber at the closest hostile, and
arms interior guns when tier 6 nears (ITERATION addenda 3-6 carry the tuning history).
Creep is multi-source: core + sling patches + root lobes + seeping pipped limbs.
Waves are built by the RISK LAW (every enemy kind carries a risk weight; the HUD
telegraphs each wave's total risk). Key economy shape: near-flat bounties (2-3 meat), clearing
wage per wave, wave counts scale with clock (`waveCountScale`), tier from threat ladder
(waves cleared + kills×0.3 + biomass×0.035, per-tier 46).

## Top of the backlog (from notes/, in order)

1. Royal SPECIAL-UPGRADE sinks (design rule 10): royal meat must buy rare, run-defining
   upgrades; the biomass surge is a placeholder and iteration notes call it dead weight.
2. Block/street legibility under heavy creep at far zoom (worst visual debt).
3. Growth can wall itself in against the interior (off-board gates keep waves coming;
   consider a "burrow through a sealed district" reopen mechanic — the tunneler enemy
   now has the digging precedent).
4. City life pass: civilians on streets pre-creep who flee the crash (the horror premise
   needs the city visibly alive).
5. Empire directives/hobby missions layer + break cinematics (DESIGN.md, unbuilt).
6. Real AI art pipeline per TECH.md (authoring = AI video/3D, runtime = spritesheets;
   RFab `services/emotionFrameService.js` is the bake-step prior art).
7. Mid-siege cannibalize drama (surgery vulnerability window) — design doc, unbuilt.
8. ~~Roster gap list~~ DONE Sep 26: all six genre-seat towers built (Broodmother,
   Digestive Pit, Galvanic Frond, Bile Lobber, Caustic Mister, Ocular Stalk), each
   verb also a pip; combination algebra in DESIGN.md. Remaining roster candidates
   live in references/TOWER-GENRE-REVIEW.md non-adopts + brainstorm only.

## Working with Collins (hard-won, respect these)

- He reads sessions cold: report outcomes, not process. One report at the end; never
  end a message with a question or an offer mid-task.
- When he criticizes ("this is not how X works"), the criticism is usually structural,
  not cosmetic — find the principle behind it, write it into DESIGN.md as a rule, and
  build a measurement that would have caught it.
- Iterate by PLAYING: change → play → "did that work?" → screenshot next to the
  references → keep going until it's fun, not merely functional.
- Commit and push to main constantly (`git add -A`); never leave work unpushed. Deploys
  are gated; commits are free. Memory-file writes are banned (permission prompts stall
  sessions) — durable lessons go in repo CLAUDE.md / DESIGN.md instead.
