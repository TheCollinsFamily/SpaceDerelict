# BROODFALL — handoff for a new instance (updated Sep 29 2026)

Read this first, then DESIGN.md, then PLAYTEST_PROTOCOL.md (repo root). The protocol is
not optional: this project once shipped three broken boards in one day because the
process only verified its own assumptions. The repo's CLAUDE.md carries the standing rules.

## Where things live

- Repo: `C:\Users\Merry\dev\space-derelict`, the Technopuritan Universe monorepo. Every
  universe game is a folder under `games/`. Work on main, push to main, never branch.
- This game: `games/broodfall/`. The sibling `games/space-derelict/` is the older game;
  don't touch it.
- Docs here:
  - `DESIGN.md`: the game design and every Collins decision. **Source of truth.**
  - `TECH.md`: the stack and the future AI-asset pipeline.
  - `references/CONVENTIONS.md`: the genre checklist.
  - `notes/ITERATION-2026-09-26.md`: why things are the way they are. Addenda run
    newest-first; 22 is the latest.
  - `notes/CAMPAIGN-BUILD-PLAN.md`: the campaign inventory and its status.
  - `notes/GRAPHICS-PLAN.md`: the graphics pipeline (Sep 29): what the RFab API can
    generate, video-first, the probe results. Its OPEN items are Collins's.
  - `assets/unit-spec.md`: the drawing spec of all 26 enemy kinds (generated; edit
    `tools/art/units.mjs`).
  - `assets/style-bible.md`: the visual language (v5, Sep 29). Collins's 22 rules in his
    own words, the four looks, the body made of its creep, the eight tile sets.
  - `tools/art/`: the art scripts. They SPEND RFab tokens; each skips what already exists.
    See "The art" below.
  - `notes/art-review/`: one picture (and one list of checks) per baked asset, to look at.
  - `README.md`: how to run it, plus a list of every surface.
- The RFab backend holds one Broodfall route, for YOKE (see "The ship AI" below):
  `C:\Users\Merry\dev\reality-fabricator\reality-fabricator-backend`. That repo has its
  own CLAUDE.md with hard rules. Most important: **never deploy without Collins's explicit
  approval**, billing fails closed, and never log user content.

## State right now (Sep 29 2026, end of session)

- Everything is committed and pushed (game and backend; the backend was not touched on
  Sep 29). Both trees clean.
- 220/220 unit tests pass. Every browser beat below passed on its last run.
- **The game has art.** The board is isometric and drawn with baked pictures: all 26 enemy
  kinds, all 36 limb families, the core, the creep, eight tile sets, and the ship. See
  "The art" below for what is there, what is missing, and what is Collins's to decide.
- **`art-src/` exists ONLY on Collins's PC** (about 420 MB of raw stills and clips; it is
  git-ignored because the repo is public and the files are big). Everything baked from it
  IS committed (`public/art/`, about 17 MB). Losing `art-src/` loses the ability to re-bake
  without paying again (about $130 of tokens so far). It needs a durable home: OPEN.
- **Owed, and Collins's call:** the RFab **backend deploy** that ships
  `POST /api/broodfall/ship-ai` (backend only, no migration). Until then, live YOKE hits
  api.rfab.ai, gets a 404, and falls back to the scripted YOKE, which says "rfab.ai does
  not have YOKE yet". Nothing is broken meanwhile.
- **Deferred by Collins:** the ship AI's lore book content
  (`content/lore/ship-ai-lorebook.md`, the TO WRITE sections). He said "the lorebook we
  will do later". Don't write it unless he asks.

## What the game is

A tower-defense roguelite. You are an escaped Technopuritan bioweapon growing across an
insectoid city.

- **In a run:** towers are limbs on creeped city blocks. Meat comes in three caste
  currencies (war, science, royal). Limbs arrive as a 4-card hand drawn from the limb
  groups your organs unlock. Cannibalizing a limb banks its trait pips into the next build.
- **Between waves:** the ORGAN STAGE, a separate town-building stage like Ball x Pit.
- **Around runs:** THE CAMPAIGN. The ship, a globe of 16 territories, the Requisition
  Board, dares and experiments, three parody factions, and YOKE.
- The empire frame is diegetic: procurement-voice UI, and a procreation licence earned
  with standing.

## Collins's design rules (all implemented; do not re-litigate)

1. **No RNG destruction of player investment** (no "instability" mechanics).
2. **Win = wave count or quest directive** (hold/royal/harvest), never a resource bar.
3. **Escalation = more enemies + higher TYPES, never stat inflation.** Higher types carry
   new VERBS. Waves are built by the RISK LAW.
4. **The board is drafted plates** (Tower Dominion school). Uniform street grids and
   radial fields are banned: both measurably killed placement value.
5. **The plate connection algebra.** Openings are two wide and centred on edges. Nothing
   may wall off an opening, and a draft may never reduce the frontier to zero gates.
6. **Never start one plate deep.** Connector districts are pre-placed beyond the crash plate.
7. **Entrances are the difficulty wager:** 1 gate by default, 2 or 3 selectable for +25%
   or +50% meat.
8. **Towers beside the path, never in it.** Verticality matters: +10% range per block level.
9. **Waves are discrete:** telegraphed, with cleared banners, a wage, and a call-early button.
10. **Caste spend rule.** War is generic. **Science buys ONLY combo engines and
    evolutions.** Royal is for special upgrades.
11. **No mode toggles, ever.** Actions live on the object, found by hovering it
    (cannibalize = hover a limb, then click).
12. **The science caste is SMART:** it routes to your least-defended limb and steals it.
13. **Click a limb** to open its panel: hp, traits, targeting, EVOLVE.
14. **Nothing ever does nothing** (the payload rule). No caps.
15. **Air/ground is always visible.** Cloaked enemies need detection.
16. **Creep dependency:** limbs standing only on creep that dies will wither.
17. **Direction and effects are always visible.** Right-click rotates; Esc cancels.
18. **The core is combo runaways.** Combo engines cost science. The ten built engines
    are listed in DESIGN.md.
19. **Evolutions** (Tower Dominion): 3 stages, pick A or B at each. Stages 1–2 cost
    science; stage 3 also costs one royal point. In the campaign, stages above the first
    are **unlocked by holding territories**. See `content/upgrades.ts`.
20. **The doubling rule:** a second copy of any bonus always changes something. The table
    is in DESIGN.md; `tests/evolution.test.ts` enforces it.
21. **The organ stage** (between waves: wave setup → wave → organ stage → …).
    - Shaped organs grow around the half-buried meteor.
    - THEME organs unlock limb groups and power them. Zone organs boost what they touch.
    - Unspent war and science are LOST when a wave starts; royal points are kept.
22. **Creep is the core of the organ game.** Nodes are free and sit in their own tray,
    separate from the 4-card hand.
    - Spore Bladders grow one node every 2 TURNS, or every turn with a Pacemaker.
    - Creep organs TOUCHING a bladder set its strain: faster, doubled, bigger, thrown,
      mire (slow) or burning.
    - The Catapult Sac unlocks the Spore Sling; the Runner Gland unlocks the Creep Lance.
    - Brain/Atrophy organs raise or kill the draw odds of the limb groups they touch.
23. **The campaign.** The DESIGN.md section "THE CAMPAIGN" has it all; code summary below.

## The campaign (built Sep 28; audited against Collins's words the same day)

- **Credits:**
  - **Standing** comes from the Requisition Board: 3 sanctioned goals per deployment,
    such as kill X of a unit, heal X, grow X limbs. It buys sanctioned lineages and the
    licence (60).
  - **Field notes** come from dares (kid-style goals, pick up to 2) and experiments
    (Puppet Queen with the trap cage, Love Gas mating musk, Follow the Courier, Nursery
    Visit, Royal Diet). They buy unsanctioned lineages.
- **Starting kit:** 4 starting profiles, and a lineage (organ pool) that starts limited,
  so not every organ is available at the start.
- **The globe:** 16 territories, each with a small story. Holding one raises evolution
  caps. The colony pushes back with a telegraphed counter-attack after you take ground:
  defend it or lose it. There are hidden territories, and finales.
- **Factions** (ally with one; they never turn on you, but their goals change):
  - **The Friendship Delegation.** Perks: Conscientious Objectors (ban enemy kinds) and
    the Translator (see the hidden next wave and its entrance). Route: summit → leaked
    plans → The Greater Plan (the cult turn: "you're protecting the planet from us") →
    the "nobody's perfect" reveal (they're voluntary-extinction antinatalists) → Hurry It
    Along → Bear Witness.
  - **The Faithful of the Last Hour.** A vague Islamic/Christian apocalyptic parody, first
    contact by radio. Perks: Sleepers (martyrs inside enemy waves) and the Garrison
    (repels pushback). The ending is an artificial messiah.
  - **The Institute for Long-Term Hive Flourishing.** An EA parody led by the Director,
    "Eli Bankfried" (Luke Rattigan-style, an Eliezer × SBF composite).
    - Perks: Volunteers (starting science, later war and a royal point) and Seed Labs
      (deploy to non-adjacent districts).
    - The ultimatum choice: **rule** = Kingdom Fund (+1 royal every mission); **pacify** =
      Pacification (every wave 10% smaller, sim `waveScale`) plus its own ending.
    - Running jokes: League of Larvae mid-call, the females offer, masturbation.
  - Between beats, each ally sends an **aside** (letter, broadcast or call) after every
    allied deployment. It shows in the debrief and in Comms' FROM YOUR ALLY feed.
- **The ship's rooms:** Directive Desk (globe and briefing), Gene Bay, Specimen Locker,
  Procreation Board, Comms, AI Core.
- **Code:**
  - `content/campaign.ts`: every line of content.
  - `src/meta/campaign.ts`: the rules, pure. `plan()` turns a territory plus perks into a
    SimConfig. `finish()` applies a run and returns the debrief.
  - `src/meta/goals.ts`: RunStats → goals.
  - `src/meta/storage.ts`: localStorage, including YOKE settings.
  - `src/ui/campaignUi.ts`: all the screens.
  - A deployment reloads the page with `?campaign=run`; the ship is at `?campaign=ship`.

## The ship AI (YOKE)

- **Game side** (`src/meta/shipAi.ts`):
  - `RfabShipAi` posts `{campaignId, trigger, summary, lore, history, playerLine}` to
    `/rfab-api/api/broodfall/ship-ai`.
  - The Vite proxy in `vite.config.ts` forwards that to api.rfab.ai server-side and adds
    this PC's `RFAB_API_KEY` env var when the page sent no key. `RFAB_API_BASE` retargets
    it (for example a local backend); `RFAB_API_BEARER` sends a JWT instead.
  - `FallbackShipAi` falls back to `ScriptedShipAi` (the lore book's seed lines) and shows
    why in the AI Core.
  - The AI Core has a USE SCRIPTED switch and a key box.
  - Triggers: first-deployment, faction-allied, midpoint, licence, ending, idle.
  - `summaryFor(state)` is what YOKE knows: holdings, route, choices, attacks, the latest
    aside, the last log.
- **Backend side** (RFab):
  - Files: `routes/broodfallShipAi.js`, `services/broodfallShipAiService.js`,
    `app/domain/broodfall/shipAi.js` (prompt and line parsing, pure), and
    `config/broodfallShipAiModel.js` (openrouter `moonshotai/kimi-k2.6`).
  - Billing is fail-closed, on sink `broodfall_shipai_<campaignId>`, which maps to
    feature and category `broodfall`. Usage events are `broodfall_ship_ai`.
  - Guests are refused.
  - Note: `docs/notes/BROODFALL_SHIP_AI_2026-09-28.md`. Wiki: `wiki/systems/broodfall-ship-ai.md`.
  - Real cost: about 30–100 tokens (~$0.001) per reply.

## Architecture

- **`src/sim/`:** a deterministic fixed-timestep sim (10 Hz, seeded, ZERO render imports).
  `sim.ts` orchestrates; `citymap.ts` owns the plates and the flow field; `autoplayer.ts`
  is the scripted player; `organPolicy.ts` is shared with the guardrail.
  - Content lives in `content/data.ts`, `plates.ts`, `underground.ts`, `upgrades.ts` and
    `campaign.ts`.
  - **Determinism is sacred:** the sim never calls Math.random. Changing the order of rng
    calls reshuffles every balance measurement.
- **`src/render/isoRender.ts`:** the board the player sees. PixiJS 8, isometric, drawn with
  the baked art. The city is BUILT from pieces (floor tiles, wall faces, props) because
  limbs stand on roofs at exact heights; everything standing is sorted by depth; a faint
  copy of every unit is drawn on top so a column behind a block can be followed.
  `src/render/iso.ts` is the camera (pure functions, tested), `src/render/art.ts` loads
  the manifest, `src/render/biome.ts` chooses the tile set.
- **`src/render/render.ts`:** the old top-down board drawn as shapes. Still the base class
  (marks, shots, aim lines are drawn by it) and still playable: `?view=top`. It is also
  what the game falls back to when the art is missing.
- **The UI:** `src/ui/*.ts` and `src/main.ts` (DOM HUD, screens, input, the loop).
  `src/ui/globe.ts` is the holographic planet; `src/ship.css` dresses the ship.

## The art (Sep 29 2026)

Read `assets/style-bible.md` before drawing anything: it holds Collins's 22 rules in his
own words. `notes/GRAPHICS-PLAN.md` holds the pipeline, the probes and the costs.

- **How a picture is made:** `node tools/art/make.mjs <unit|limb|terrain|biome|ship> [ids]`.
  It SPENDS RFab tokens (`RFAB_API_KEY` from the environment, never printed, never
  committed). Every step skips what is already on disk, so running it again is free;
  `--bake` only bakes. To draw something again, move its file out of `art-src/` first.
- **What it costs:** a still about $0.42 (high quality), a 4 s clip about $0.25. A unit
  (one turnaround, five walking clips) about $1.70; a limb (design, redraw, two clips)
  about $1.35; a tile set (nine stills) about $3.80.
- **The pipeline:** design still → (units) five views in ONE picture → clips whose last
  frame is their first → our own keyer → loop search → atlas (WebP) →
  `public/art/manifest.json`. Eight headings are five drawn views and three mirrored.
- **Every asset checks itself** when it is baked (loop closes, stays on its spot, inside
  its frame, no tint of the background left on its outline, light to load) and writes
  `notes/art-review/<kind>/<id>.jpg` and `.json`. Look at the picture: checks pass on
  things that are wrong.
- **What is there:** 26 units (walking, five views each; the soldier also attacks), 36
  limbs (idle, and firing where they fire), the core, the creep, 8 tile sets, the ship
  (six rooms, planet, exterior, three faction leaders, YOKE's six faces, 14 sketches).
- **What is NOT there** (code-drawn stand-ins are used): attack clips for 25 of the 26
  units (`node tools/art/make.mjs unit <ids> --attack`, about $1.25 each); death clips;
  state sprites (netted flier, deployed cannon, stripped carapace, burrowed tunneler,
  carrying researcher); contact shadows under units; the HUD is still the old khaki.
- **Tile sets:** `tools/art/biomes.mjs` is the data (one entry per set: what it borrows,
  nine prompts, which territories). A campaign deployment is drawn with its territory's
  set, a skirmish with one chosen by its seed, `?biome=megacity` names one. To add a set:
  add an entry, run `node tools/art/make.mjs biome <id>`, look at
  `notes/art-review/biomes/<id>.jpg`, then `node tools/shot-biomes.mjs <id>`.
- **No real religious symbol, and no lettering, in any picture.** The image model adds
  crosses by itself. Every picture is looked at zoomed in before it is kept. A small
  unwanted detail is painted out with `tools/art/paint-out.mjs` (it keeps the original
  beside it) rather than drawing a whole sheet again.

### Traps that cost time on Sep 29 (shell and browser)

- **A Bash heredoc over about 64 lines silently runs nothing.** Write scripts with the
  Write tool and run the file.
- **The Bash tool collapses backslashes** in heredocs and in `node -e "…"`: a regex
  `/url\("…"\)/` arrives as `/url("…")/`. Edit regexes with the Edit tool.
- **Backticks inside `node -e "…"` are command substitution.** A patch that contains a
  JavaScript template string has to be made with the Edit tool.
- **A CSS variable holding `url(...)` is resolved against the STYLESHEET, not the page.**
  Give it an absolute URL (`new URL(file, document.baseURI).href`).
- **`mix-blend-mode` does nothing across a stacking context.** YOKE's black background
  only drops out when she is a sibling of the card, not a child of it.
- **Headless Chromium draws in software unless told otherwise** (7 fps). Launch it with
  `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` (61 fps on the same machine).
- **Taking a colour's tint out of a whole picture changes its colours:** magenta out of a
  red tractor leaves a tan one. Stills of painted things are cleaned along their outline
  only (`keyFrame(..., { spill: 'edge' })`); clips everywhere.
- **Two processes writing `public/art/manifest.json` at once can lose an entry.** After
  running bakes side by side, bake once more (`--bake`, free) and run `npm test`: it
  counts every unit, limb and tile set.

## How to verify (all green before claiming anything)

```powershell
npm test             # 220 tests, incl. the naive win RATE over 10 seeds, the PLACEMENT GUARDRAIL, and the baked art
npx tsc --noEmit
npm run build
npm run test:visual  # headless chromium: HUD + per-region pixel checks
npm run test:input   # real player gestures
npm run test:endgame # full in-browser run to the victory overlay
node tools/shot-iso.mjs       # the isometric board: art loads, clicks reach limbs on roofs, frame rate
node tools/shot-biomes.mjs    # every tile set played into its first siege
node tools/shot-ship.mjs      # the ship's rooms, the planet, YOKE, the sketches
node tools/shot-limbs.mjs spitter maw --name look   # a staged scene for LOOKING at limbs
node tools/art/lib/selftest.mjs                     # the sheet cutter and the keyer (free)
node tools/shot-evolve.mjs    # EVOLVE by clicks
node tools/shot-engines.mjs   # the utility engines
node tools/shot-under.mjs     # organ stage through the real loop
node tools/shot-creep.mjs     # creep: bladder recipe, tray, thrown node, spread
node tools/shot-campaign.mjs  # menu → ship → globe → briefing → run → debrief → faction → YOKE (scripted) → allied 2nd deployment → aside in debrief + Comms
# PAID (a few RFab tokens): live YOKE. Against a local backend started with PORT=3011 node scripts/start.js
# and a JWT from `npm run auth:token -- --email collinsmalcolm@gmail.com` (backend repo):
RFAB_API_BASE=http://localhost:3011 RFAB_API_BEARER=<jwt> node tools/shot-yoke-live.mjs
```

- **The placement guardrail** (`tests/placement.test.ts`): smart placement must flip more
  seeds to wins than random placement does. If a change breaks it, rework the change,
  never the assertion.
- **The player-path rule:** nothing is "done" until it has been started the way Collins
  starts it (`npm start` or `Play Broodfall.bat`) and played in the page.
- **The AI-play API** is `window.broodfall`: `step(n)`, `play(cmd)`, `summary()`,
  `buildableCells()`, `camera()`, `worldToScreen(x,y)`, `cellAtClient(x,y)`, `view()`,
  `biome()`, `artMissing()`. URL params: `?seed= &auto=1 &autostart=1 &speed= &directive=
  &entrances= &campaign=run|ship &view=top &biome=<tile set>`.
- Browser beats that start in the campaign should set
  `localStorage['broodfall-yoke'] = {"mode":"scripted"}`, so they neither spend tokens
  nor depend on the network.

## Balance (re-measure; don't trust memory)

- Naive hold-12 wins 4/10 seeds (the guard is ≥3/10). Guardrail flips are 4:0.
- `threatPerTier` 21, tier 6 at 192.
- Always measure over 10 seeds, never 3–4. ITERATION addenda 3–20 carry the tuning history.

## Backlog (in rough order)

1. **Royal special-upgrade sinks** beyond the stage-3 evolution cost (the biomass surge is
   a placeholder).
2. **The lore book** — only when Collins brings it up.
3. **Legibility:** block and street readability under heavy creep at far zoom.
4. **The interior can seal itself:** growth can wall itself in against the interior
   (idea: a burrow-reopen mechanic).
5. **City life:** civilians fleeing the crash.
6. **The rest of the art** (see "The art" above for what is missing): attack clips for 25
   units, death clips, state sprites, shadows under units, the HUD's look.
7. **Surgery vulnerability:** mid-siege cannibalize drama.
8. **Campaign polish found in the audit, not yet asked for:**
   - Faction contact comes after N captures, not through "some missions".
   - Asides cycle in a fixed order.
   - The globe is flat-projected, not a 3D sphere.

## OPEN — Collins's calls on the art (none of them blocks play)

1. **Do ordinary soldiers shoot limbs on roofs?** His rule 16 gives them short-range guns
   so that attacks on towers beside the street make sense. The sim today only lets some
   kinds attack limbs. Turning it on changes the balance: it is a gameplay decision.
2. **How much Orthodox** in the Temple Cities: as accents (`board-hive-a.png`) or generous
   (`board-hive-b.png`). The board is built with accents.
3. **The HUD** is still the old khaki procurement look over a board that is now painted.
4. **The colony's emblem** is a plain gold hexagon, because of the no-religious-symbol
   rule. That rule is Claude's; he can overrule it.
5. **The scarecrow** of the Granary Belt is drawn and kept off the board (a figure with its
   arms out on a pole reads as a crucifix at game size). One word in
   `tools/art/biomes.mjs` (`never: true`) puts it back.
6. **A skirmish draws a tile set by its seed.** If he would rather a skirmish always be one
   set, it is one line in `src/render/biome.ts`.
7. **Where `art-src/` lives** (see "State right now").
8. **The API key in the public repo.** `games/space-derelict/generate_ui_assets.py`,
   `generate_event_assets.py` and `_gen_emblems_contracts.py` carry a hard-coded RFab key.
   It is in the history of a PUBLIC repo: treat it as leaked and rotate it. Removing it
   from the files does not remove it from the history.

## Working with Collins (hard-won)

- He reads sessions cold. Report outcomes, not process. Send one report at the end, and
  never end a message with a question or an offer mid-task.
- **When he designs in a stream of messages, the build is every line of them.** Before
  claiming a big pass is done, re-read his messages VERBATIM (the session transcript
  jsonl), check each line against the code, and build what's missing. The Sep 28 audit
  found four gaps this way (addendum 22), all "designed in DESIGN.md but built once or
  not at all".
- A structural criticism means: find the principle, write it into DESIGN.md as a rule, and
  add a measurement that would have caught it.
- Iterate by PLAYING: change → play → "did that work?" → screenshot → keep going until it's fun.
- Commit and push to main constantly with `git add -A`. RFab deploys are gated; commits
  are free.
- **Memory-file writes are banned** (the permission prompts stall sessions). Durable
  lessons go into CLAUDE.md, DESIGN.md or this file.
- Shell gotcha on this box: long `node -e` / heredoc scripts containing quotes break in
  Git Bash. Write the script to the scratchpad with the Write tool and run it from there.
