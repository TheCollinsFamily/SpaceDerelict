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
  - `content/lore/insects.md`: the insect civilisation (Sep 30 2026): castes, the chaebol
    clans, the Faith and rising atheism, sex among a barren majority, every enemy kind as an
    institution, naming conventions for new content, and Collins's OPEN calls. Read it before
    writing anything the insects say or anything about them.
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
- 250/250 unit tests pass. Every browser beat below passed on its last run.
- **The game has art.** The board is isometric and drawn with baked pictures: all 26 enemy
  kinds, all 36 limb families, the core, the creep, eight tile sets, and the ship. See
  "The art" below for what is there, what is missing, and what is Collins's to decide.
- **`art-src/` exists ONLY on Collins's PC** (about 420 MB of raw stills and clips; it is
  git-ignored because the repo is public and the files are big). Everything baked from it
  IS committed (`public/art/`, about 20 MB). Losing `art-src/` loses the ability to re-bake
  without paying again (about $150 of tokens so far). It needs a durable home: OPEN.
- **Built on Sep 29 after Collins saw the first painted board** (his words are rules 23 to
  27 of `assets/style-bible.md`): limbs stand in the middle of their cells by a footing
  MARKED BY EYE; the creep runs to the edge of every roof; the landing site lies in its
  square and is as sharp as the limbs; the camera turns (Q and E); limbs have a view from
  behind; three limbs are BIG (DESIGN.md, "BIG limbs").
- **Owed, and Collins's call:** the RFab **backend deploy** that ships
  `POST /api/broodfall/ship-ai` (backend only, no migration). Until then, live YOKE hits
  api.rfab.ai, gets a 404, and falls back to the scripted YOKE, which says "rfab.ai does
  not have YOKE yet". Nothing is broken meanwhile.
  **Sep 30: YOKE for players adds to that, in this order:** (1) the backend deploy (it now also
  carries `/api/broodfall/yoke` and migration `20260930120000_broodfall_yoke_players`); (2) the
  house account made and funded on rfab.ai
  (`node C:/Users/Merry/agent-tools/rfab-grant.js broodfall-house@rfab.ai --usd 100 --create --name "Broodfall house"`,
  dry run then `--apply`) — without it every guest hears "YOKE is resting"; (3) the frontend
  deploy (the rfab.ai `/connect` page). Until (1) the game talks to her the old way.
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

## How a new player starts (Sep 30 2026) — DESIGN.md "How it unfolds for a new player"

- **First launch** (nothing in localStorage, page opened with no address of its own): the
  opening film (`src/ui/intro.ts`; eight clips in `public/art/intro/`, made by
  `tools/art/intro.mjs`), then mission 1 at the crash site, with the board loading behind the
  film. `?intro=1` plays the film over the menu. Launch rules: `launchKind` in
  `src/meta/onboarding.ts`; the flags are `broodfall-intro-seen` and the campaign save.
- **Mission 1** is a campaign deployment with `plan().first`: no goals, the gate shown, the HUD
  and the organ stage `plain` (no ship words), the coach's hint line (`coachText`, `coachTick` in
  `src/main.ts`), a plain report (`firstDebrief`). It pays `FIRST_MISSION_STANDING` (4).
- **The ship** opens in the SAME page after a report (`history.replaceState` to `?campaign=ship`),
  so that the click on CONTINUE lets YOKE's voice play (a browser blocks sound on a page nobody
  clicked; a line whose sound is blocked is read for as long as it takes to read).
- **The desk** is dark until `onboard.deskOpen` (`finish()` sets it at the first win that is not
  mission 1; all three factions' contacts are queued then). `shipPick` is the assignment.
- **YOKE's greetings**: `content/greetings.ts` (pool, the CUES table of clips per acted beat: a new
  clip slots in by being first in its list), `greetingFor` / `momentNow` / `pickGreeting` in
  `src/meta/onboarding.ts`, played by `CampaignUi.welcome()` through `YokeAvatarUi.play()` (a
  script: voice per line via `/speak`, talking clip, the cue after it; `skip()` on a click). Her
  body is now built in every mode: her mind answers only in the avatar mode; in the others she
  speaks the next rung's words; in the scripted mode nothing goes out (no voice).
- **The intercom** (`icomHtml`, the ◉ YOKE button) is her over any room; her live talk there is
  the same free talk as the AI Core's; her mind is told what she greeted him with.
- **The boss** (`content/boss.ts`, `src/ui/bossCall.ts`, art and voice `tools/art/boss.mjs`), the
  **quarters** room and its data pad (`content/partner.ts`), the **print-a-body** scene
  (`content/yokeScenes.ts`, `src/ui/yokeScene.ts`; clips looked for under `scenes.printBody` in
  `public/art/ship/yoke/manifest.json`, storyboard cards until then).
- **The menu** is `src/ui/menu.ts` (markup in `index.html`, look in `src/onboard.css`).
- **Beats only:** `?campaign=ship&open=1` opens the ship with a campaign whose desk is already
  open when none is on record (shot-ship, shot-yoke-avatar, shot-biomes, shot-screens use it; the
  unfolding itself is `tools/shot-onboarding.mjs`).

## Empire Directives, hobby missions, settings, territory pictures (Sep 30 2026)

- **Empire Directives** (ship room, opens with the desk): Command's standing orders across
  deployments. `content/directives.ts`, `src/meta/directives.ts` (`applyOrders` is called from
  `finish()`; `ordersSetup` feeds `plan()`), `src/ui/directives.ts`. Save field `orders`.
- **Hobby missions** (the Notebook room, opens with the desk): pages sparked by play, one pinned to
  the next deployment, paying unique genes. `content/hobby.ts`, `src/meta/hobby.ts`,
  `src/ui/hobby.ts` (+ `hobby.css`, to the approved concept). Save field `hobby`. The genes are
  `HOBBY_GENES` in `content/plates.ts`; their verbs are `geneMods` in `src/sim/sim.ts`, each inert
  unless spliced. Balance: `tools/measure/hobbygenes.measure.ts` (10 seeds, each gene alone).
  DESIGN.md "Hobby missions" and "Empire Directives".
- **Settings**: `src/ui/settings.ts` (screen, `applySettings`, edge scroll, the ⚙ in a run),
  `src/meta/settings.ts` (model), kept by `loadSettings/saveSettings/gain` in `src/meta/storage.ts`.
  Opened from the menu (`menu.ts`), the ship's room bar, and a run (Esc with nothing in hand, or ⚙;
  the run's speed goes to 0 while it is open). Voice volume is wired into YOKE's lines and the boss's
  message; music/effects wait for sound. The YOKE account/model section is a SLOT: the YOKE connect
  session calls `registerSettingsSection('yoke-account', draw)`. HUD styles come from
  `src/hud/themes.ts` (`HUD_THEMES`, `applyHud`).
- **Territory pictures**: `node tools/art/make.mjs ship territories` (manifest `ship.ship.territories`),
  shown over the briefing and the dark desk's assignment (`territoryPictureHtml` in campaignUi).
- Beat: `node tools/shot-camp.mjs [A] [B]` (dev server 5251; `notes/screens/2026-09-30/camp-*`).
- Hobby genes measured Sep 30 (naive hold-12, 10 seeds, each gene alone; no gene 6/10): Tallow Blood
  5, Grudge Marrow 5, Kite String 5, Royal Jelly 6, Homing Tissue 6, Wet Nurse 6, Hitchhiker Spores 6,
  Wedding Musk 6 (328 pairings), Royal Graft 4 (the free cage takes a hand slot the bot does not use
  well). No walkover; the dips are the reshuffle of card draws the HANDOFF warns about, not the verbs.

## The data pad at a mission's end (Sep 30 2026)

Collins: "when you are finished with a mission or lose it should have a video that shows your
character setting down a data pad that has something similar to the last screen looked at".
- **In the game** (`src/ui/padOutro.ts`, one hook in `src/main.ts` `handleEvents`): 1.6 s after
  `won`/`lost`, a clip plays over everything (first person, his hands; `won` sets the pad down
  calmly, `lost` lets it drop, on his console desk under the window onto the planet). The pad's
  screen is keyed out of the clip; the LIVE page under it (Pixi board + console HUD) is warped into
  the screen's corners every frame by a CSS `matrix3d` on `<body>` (corners baked per frame in
  `public/art/pad/<id>.json`; `requestVideoFrameCallback` keeps them on the frame). The clip starts
  zoomed so the screen fills the window (invisible cut), the end dialog `#overlay` fades off the pad,
  a device look fades in; at the end the screen sleeps, `<body>` is put back, the report shows, the
  desk fades. Click/Esc/Enter/Space skips; Settings "Reduce motion" skips it; under automation it
  plays only with `localStorage['broodfall-pad-outro']='on'` (other beats unaffected).
- **The art** (`node tools/art/make.mjs pad [won lost] [--stills|--bake]`,
  `tools/art/templates/pad.mjs` + `pad-bake.mjs`): two stills (start: pad filling the frame, green
  screen; end: on the desk), a START-AND-END clip each on **seegen:wan3.0-video** (run with
  `PROBE_VIDEO_MODELS=seegen:wan3.0-video`; 5 s 720p, 65,700 tokens = $1.31). seegen:sd2-mini IGNORED
  the end frame (and drew idol figurines); seegen:sd2 honoured it but let the pad leave the frame.
  Bake: Leaflit's studio ChromaKey set to the screen's own colour, the screen = biggest keyed patch →
  convex hull → edges fitted to the hull (bridges fingers) → corners, smoothed; key kept only inside
  the screen. Review: `notes/art-review/pad/<id>.jpg` (a game picture warped in) and `<id>-track.jpg`.
- **Checks:** `tests/padOutro.test.ts`; `node tools/shot-pad.mjs [won lost skip calm]`.

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

### YOKE as her Living Avatar (Sep 29 2026) — the default

Collins: "we will use the rfab living avatar system to make her something the player can
chat with and she will feel real." She now has a body, a voice and a mind of her own on
rfab.ai, and she is who answers in the AI Core by default.

- **Who she is:** `content/lore/ship-ai-lorebook.md` (the long form, every TO WRITE
  section filled; what adds a fact Collins has not said is marked PROPOSAL; his OPEN calls
  are written so either answer works). `content/lore/yoke-brain.md` is the short form her
  mind runs on: a brain text under 4,000 characters (the box on her rfab.ai page holds
  4,000; a test holds it) and her notes.
- **The Empire, from inside** (Sep 30 2026): `content/lore/empire.md` — Collins's history
  (the 21st-century collapse, charter cities, the rise, Earth as the zoo), the doctrine
  ported from technopuritan.com with citation ids (`TP 11.0` etc.), the index, krypteia,
  spouses and wombs (100 children a couple, about 50 enter the index), bodies (~40%
  organic), the Sons of Man (the uplifts; the boss is an uplifted dog), and how the Empire
  looks back on the 21st century. Shared canon:
  `docs/UNIVERSE.md` (repo root). YOKE's side of it, and her pools of Earth-news,
  krypteia, "an AI?" and old-world-horror lines, are `ship-ai-lorebook.md` sections 15-16;
  her `[[PRINT_BODY]]` tag (section 15) asks the game for the print-a-body scene. Her brain
  text changed with it and is NOT yet published to rfab.ai (`make.mjs yoke --publish`).
- **On rfab.ai** (Collins's own account; ids in `content/lore/yoke-avatar.json`): one
  agent (her mind, Claude Haiku 4.5, not running on its own), one body `vm_…` (her 43
  clips), one avatar binding them with the voice `aura-2-athena-en`. Private: visitors
  and the public cannot talk to her (their chat would be billed to him).
- **Her body (Sep 30 2026): made the way Leaflit's AI VTuber Studio makes one.**
  `node tools/art/make.mjs yoke [states] [--bake]` (`tools/art/templates/yoke.mjs`, studio
  steps in `tools/art/lib/leaflit.mjs`): every clip is a take from ONE reference (her
  approved idle still) on the studio's own video model (Gemini Omni Flash, 77,000 tokens a
  take) with the studio's own prompt prefix, keyed by the studio's own ChromaKey (loaded
  from the frontend repo, snapshot beside it), Ping-Pong for what loops, No Loop for a
  move; then "the projection" (cooled colours, lifted blacks, scan lines, a halo), VP8
  WebM with alpha in `public/art/ship/yoke/`. Every clip starts and ends on the same
  frame, so a hand-over never jumps. 43 clips (+ calm, thoughtful aliases):
  idle, speaking, intro*, outro*; happy, sad, angry, surprised, thinking each with a
  `_talk` twin; laughing, blushing, hand_raised; her beats pensive, teasing, dont_pout,
  pout, laugh*, shrug*, disgust*, hype*; look_left/right/up/down each with a `_talk`
  twin; wink*, tongue_out*, kiss*, puff*, wave*, nod*, shake_head*, dance*, jump*, bow*
  (* = played once). Takes are in `art-src/yoke/leaflit/` (rejected ones in `old/`).
  Look at `notes/art-review/yoke/` and `notes/screens/2026-09-30/yoke-leaflit-clips.jpg`.
- **Her films** (`node tools/art/make.mjs yokescene`, `tools/art/templates/yoke-scenes.mjs`):
  `scenes.printBody` in `public/art/ship/yoke/manifest.json` = print, wake, collapse,
  hold (5 s each, 720p, opaque VP9; each starts on the last frame of the one before;
  `hold` loops, for her voice from the speakers). The trigger and the voice are the game's.
- **To change her on rfab.ai:** edit `yoke-brain.md` (or re-bake a clip), then
  `node tools/art/make.mjs yoke --publish` (updates what exists, never makes a second;
  `--voice=<aura id>` changes her voice). Nothing is ever deleted there.
- **In the game** (`src/meta/yokeAvatar.ts`, no screen, all tested; `src/ui/yokeAvatar.ts`,
  her stage): his line goes to `POST /api/avatars/:id/message` with a `<<SHIP LOG … >>`
  block in front (the campaign summary; the avatar API takes a message and nothing else);
  her reply comes a sentence at a time on `GET …/events`; her clip follows each
  sentence's emotion (the nearest face her body has when she names another); her voice
  is `POST …/speak` once a sentence, while the talking clip plays; then she holds the
  face of what she said. The log is stripped from everything shown, even when she quotes
  it. VOICE ON/OFF in the room; her history on reopening it.
- **It fails soft:** no network, 401, 402, 404 or silence → the next rung answers
  (Kimi, then the scripted YOKE); the player is told nothing; the reason goes to the
  console once. 401/404 stop the asking for the session; 402 does not (a top-up mends it).
- **Cost, measured live:** about 1,300 tokens (~$0.026) an exchange: ~1,240 for her mind,
  ~3 a character for her voice. Billed to the account the key belongs to.
- **Checks:** `tests/yokeAvatar.test.ts`; `node tools/shot-yoke-avatar.mjs` (the room,
  with rfab.ai mocked: nothing is spent). The campaign beat still sets her to scripted.
- The two bullets above describe the OLD way (Collins's key, his star). Since Sep 30 a player
  talks to his own YOKE (next section); the old way is what the game falls back to on an
  RFab that has no player route yet (its backend deploy is owed).

### YOKE for players: $3 free, then an RFab account (Sep 30 2026)

Collins: "cut off AI interactions once a user has spent more than $3 worth of tokens, prompt
them to connect it to an RFab account, which will give them free tokens to more than double
their interactions, and from that point on token use drains from RFab, but they will also have
the option to change the model she runs on."

- **Who pays:** until he links an account, the Broodfall HOUSE account on rfab.ai
  (`broodfall-house@rfab.ai`), up to **$3 = 150,000 billed tokens** of her mind, her voice and
  the Kimi rung together, counted by rfab.ai from its own ledger (the game decides nothing).
  After he links, HIS account pays. Linking gives him **400,000 free tokens ($8, 2.7× the free
  talk)** once per RFab account. Backend: `/api/broodfall/yoke`, note
  `reality-fabricator-backend/docs/notes/BROODFALL_YOKE_PLAYERS_2026-09-30.md`.
- **What the game holds:** one PLAYER TOKEN in localStorage `broodfall-yoke-player` (`bfg_…` as a
  guest, `bfc_…` once linked). Never a login, never an RFab API key. The token opens nothing on
  rfab.ai but his own YOKE. RESET forgets it (and a new player is made next time; rfab.ai caps
  new players at 3 per address a day and $6 of free talk per address).
- **Her mind:** a private copy per player of her Living Avatar brain (the star agent on
  Collins's account is never talked to or changed). His history carries over when he links.
- **Where rfab.ai is:** served from this PC (`npm start`, `vite preview`, the beats) the page uses
  the `/rfab-api` proxy; anywhere else (a web host, a desktop wrap) it talks to
  `https://api.rfab.ai` itself (`src/meta/storage.ts` RFAB_API_BASE; `VITE_RFAB_API_BASE`
  overrides). The proxy never adds this PC's key to a request that carries a player token.
- **Code:** `src/meta/yokePlayer.ts` (the link: register, state, code + polling, model, unlink,
  the words), `src/meta/yokeAvatar.ts` (her calls go to the player route with the token; the
  ladder's money cut-off), `src/ui/yokeAccount.ts` + `src/yokeAccount.css` (the AI Core panel and
  Settings' "YOKE — ACCOUNT & MIND" slot), wired in `src/ui/campaignUi.ts`.
- **What he sees:** a small FREE TALK meter under his talk with her in the AI Core
  ("$2.41 of $3.00 left"). When it is spent — or rfab.ai refuses a line for money — she says
  so ONCE in her own words (the bonus stated plainly), her live chat stops (the input is
  replaced by the LINK AN RFAB ACCOUNT card; the intercom's too), and from then on only the
  scripted YOKE answers (greetings, scenes and scripted lines still play; they cost nothing; no
  paid rung is asked). LINK shows a code `XXXX-XXXX` and OPEN RFAB.AI opens
  `rfab.ai/connect?code=…`; the game polls until he approves there. Linked: his balance, TOP UP,
  HER MIND with CHANGE (Kimi K2.6 default, Claude Haiku 4.5, Grok 4.3, GPT-5.4 Mini, DeepSeek V4
  Pro, Claude Sonnet 5, each with a rough price a reply), UNLINK. His account too low → she asks
  for a top-up (402 → TOP UP ON RFAB.AI, I HAVE TOPPED UP).
- **Checks:** `tests/yokePlayer.test.ts` (no network); PAID but local-only beat
  `tools/shot-yoke-connect.mjs` (a real local backend, the whole path by clicks; see its header
  for the three backend commands). JPEGs: `notes/screens/2026-09-30/connect-*.jpg`.

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
- **Background removal the studio's way:** `tools/art/lib/leaflit.mjs` `keyClipFile(file,
  { fps, width, height })` / `keyFrames(frames)` = a clip (or RGBA frames) in, transparent
  frames out, keyed by Leaflit's studio ChromaKey with its auto key colour and calibrated
  similarity. Shared: use it rather than writing a second one.
- **The pipeline:** design still → (units) five views in ONE picture → clips whose last
  frame is their first → our own keyer → loop search → atlas (WebP) →
  `public/art/manifest.json`. Eight headings are five drawn views and three mirrored.
- **Every asset checks itself** when it is baked (loop closes, stays on its spot, inside
  its frame, no tint of the background left on its outline) and writes
  `notes/art-review/<kind>/<id>.jpg` and `.json`. Look at the picture: checks pass on
  things that are wrong.
- **No size limits on the art, ever** (Collins, Sep 30 2026: "I can't imagine why such a trip
  wire would be useful"). The total-size test and the 900 KB-per-picture checks were removed;
  they had been cutting frames and packing quality to fit. Never trade picture quality or
  frames for bytes, and never add a size cap back. (Units still split over atlas pages, which
  costs no quality.)
- **Where a limb stands is marked by eye, never computed** (Collins's rule 24). After
  making or remaking a limb: `node tools/art/feet.mjs <family>` (and `--back`), LOOK at
  `notes/art-review/feet/`, read the grid of tenths, write `foot: [x, y, width]` (and
  `backFoot`) on the limb in `tools/art/limbs.mjs`: the middle of the WIDEST row of its
  skirt, and that row's width without the thin tips of its roots. Then `--bake`, and look
  at `notes/art-review/limbs/<family>-standing.jpg`. A limb with no mark fails its bake.
- **A lopsided limb has a view from behind** (`back:` on the limb says what is seen of it).
  `node tools/art/make.mjs limb <family> --stills` draws only that picture: look at it
  before paying for its clips.
- **A BIG limb** (`big: true` on the limb, `span` in `content/data.ts`; a test holds the
  two to each other) is baked from 384 px frames.
- **What is there:** 26 units (walking, five views each; the soldier also attacks), 36
  limbs (idle, and firing where they fire; 15 of them from behind too), the core, the creep, 8 tile sets, the ship
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
- **Effects, limb acting and deaths, donor parts (Sep 30):** `node tools/art/make.mjs fx
  [sheets|parts [families]]` (`tools/art/templates/fx.mjs`) makes four sheets (solid shots on a
  key colour; light and vapour on black, their brightness their opacity) and one donor part per
  family; the game draws them in `src/render/fx.ts` (shots turned along their flight, bursts,
  lightning, beams, flame, clouds, what is done to a unit) and `src/render/limbFx.ts` (engines
  act when what they serve fires, limbs wither on death or are carried off, donor parts grafted
  at points measured on each limb at its bake). Every limb's `die` clip and the 13 acting clips
  come from `make.mjs limb` (`WITHER` and `fire` in `tools/art/limbs.mjs`). Look:
  `node tools/shot-fx.mjs [shots lobbed light hive clouds acting wither taken grafts]` (dev server,
  port 5231; JPEGs in `notes/screens/2026-09-30/fx-*`, `limbs-*`). Test: `tests/fx-art.test.ts`.
- **Units' moments (Sep 30):** `node tools/art/make.mjs unit <ids> [--hit] [--boss] [--braced]
  [--skins] [--states] [--no-bake]` (`tools/art/templates/unit.mjs`): flinches (5 views, every
  unit), the royal's and consort's arrival and special (`BOSS`, frames 320 and 256), the braced
  cannon and dart battery firing from their braced pictures (`BRACED`), the carapace lord walking
  cracked then stripped (`SKINS`). The hive's own walkers (broodling, puppet-royal/-consort/-matron)
  are `ALLIES` in `tools/art/units.mjs`, drawn from a design still (no concept sheet), baked into the
  manifest's `allies`. A unit with more frames than one light picture is packed on several atlas
  PAGES (`pages`, a clip's `page`); a clip that goes outside the walk's frame (a flier's fall) is cut
  with a grown window and carries its own `anchor` and `scale`. The game reads what happened to a unit
  (hp down, shots up, pulse wound up) in `src/render/unitAnim.ts`, never writing to the sim. Look at
  one animation big: `node tools/art/look-anim.mjs <kind> <anim> [views]`. In the game:
  `node tools/shot-units-moments.mjs [1-6]` (dev server; `notes/screens/2026-09-30/units-*`).
  Tests: `tests/units-art.test.ts`, `tests/unitAnim.test.ts`.
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
- **A test that builds "whatever card is first" on "any buildable cell" breaks when a limb
  becomes big.** Point it at ground the limb fits (`canBuildTower(cell, family)`), or shed
  big cards as the helpers in `tests/sim.test.ts` shed street limbs. Its assertions stay.
- **The scripted player's win rate is not a dial.** Making the Spore Bombard stronger made
  the bot win LESS (five payments tried, four under the guard). Any change to a limb
  reshuffles ten deterministic runs: measure, do not reason.
- **Never rebuild (`npm run build`) while browser beats are running:** they play the built
  game, and it changes under them.
- **A video playing behind a hidden element costs the board its frames** (Sep 30: the menu's 720p
  loop decoding under a running board made `test:input`'s panel-close check fail; the menu now plays
  it only while shown). And `classList.add` of a class already there still WRITES the attribute:
  a MutationObserver on `class` that adds a class wakes itself forever (the page never goes idle).
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
node tools/shot-iso.mjs       # the isometric board: art loads, clicks reach limbs on roofs FROM ALL FOUR SIDES, frame rate
node tools/shot-player-path.mjs  # the DEV server, the menu, a click on deploy, play: what Collins double-clicks
node tools/shot-biomes.mjs    # every tile set played into its first siege
node tools/shot-ship.mjs      # the ship's rooms, the planet, YOKE, the sketches
node tools/shot-limbs.mjs spitter maw --name look   # a staged scene for LOOKING at limbs (--facing N: from behind; --turn 1: the camera turned)
node tools/shots-to-jpg.mjs                         # before committing: the beats' PNGs are ignored by git, their JPEG copies are committed
node tools/art/lib/selftest.mjs                     # the sheet cutter and the keyer (free)
node tools/shot-evolve.mjs    # EVOLVE by clicks
node tools/shot-engines.mjs   # the utility engines
node tools/shot-under.mjs     # organ stage through the real loop
node tools/shot-creep.mjs     # creep: bladder recipe, tray, thrown node, spread
node tools/shot-board-art.mjs # the board alive (DEV server): seams, pods growing/spreading, strains, gates, unclaimed city, plinth rising, fps alive vs still
# board art (pods, strains, gates, smoke): node tools/art/make.mjs board [pods|strains|gates|smoke|<set>] [--stills|--bake]  (tools/art/templates/board.mjs; renderer side src/render/boardArt.ts)
node tools/shot-preview.mjs   # a mortar's field of fire (click on it) + a conduit held and hovered (placement preview)
node tools/shot-play-new.mjs  # DEV server from the menu: Scaffold + Seeding Gland grown by clicks, plinths raise a gun and level a roof, a BIG limb on it, a Seedling shot up and landed, the scripted player late (JPGs in notes/screens/2026-09-29/play-*)
node tools/shot-campaign.mjs  # NEW CAMPAIGN → mission 1 → ship (desk dark) → assigned run → win → desk opens, three calls → ally → YOKE (scripted) → globe + dare → aside in debrief + Comms
node tools/shot-onboarding.mjs  # DEV server, fresh browsers: the film, mission 1, the ship and YOKE's greetings (rfab.ai mocked), the boss, the dark desk, mate review, cat girl, the desk opening + three calls, YOKE summoned + print-a-body, the console menu; mission 1 won; replay the opening (notes/screens/2026-09-30/onboard-*)
# PAID (a few RFab tokens): live YOKE. Against a local backend started with PORT=3011 node scripts/start.js
# and a JWT from `npm run auth:token -- --email collinsmalcolm@gmail.com` (backend repo):
RFAB_API_BASE=http://localhost:3011 RFAB_API_BEARER=<jwt> node tools/shot-yoke-live.mjs
# PAID, LOCAL backend only: a player's free talk, the cut-off, the link code, his account, the model picker
# (header of the file: seed-broodfall-yoke-local.js, the backend on 3011, a tester's JWT)
RFAB_API_BASE=http://localhost:3011 RFAB_CONNECT_JWT=<tester jwt> node tools/shot-yoke-connect.mjs
```

- **The placement guardrail** (`tests/placement.test.ts`): smart placement must flip more
  seeds to wins than random placement does. If a change breaks it, rework the change,
  never the assertion.
- **The player-path rule:** nothing is "done" until it has been started the way Collins
  starts it (`npm start` or `Play Broodfall.bat`) and played in the page.
- **The AI-play API** is `window.broodfall`: `step(n)`, `play(cmd)`, `summary()`,
  `buildableCells()`, `camera()`, `worldToScreen(x,y)`, `cellAtClient(x,y)`, `view()`,
  `biome()`, `turn()`, `turnBy(n)`, `artMissing()`. URL params: `?seed= &auto=1 &autostart=1 &speed= &directive=
  &entrances= &campaign=run|ship &view=top &biome=<tile set>`.
- Browser beats that start in the campaign should set
  `localStorage['broodfall-yoke'] = {"mode":"scripted"}`, so they neither spend tokens
  nor depend on the network.

## Balance (re-measure; don't trust memory)

- Naive hold-12 wins 4/10 seeds (the guard is ≥3/10). Guardrail flips are 4:0. Measured
  again on Sep 29 with three limbs BIG: the same. (With the Spore Bombard big: 3/10.)
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
   - **The first LONG limb** (longer than it is wide, turned to fit): the rule is built and
     tested and no limb uses it. Collins asked for turning to fit; which limb is his call.
   - **Props do not turn with the camera:** a roof prop or a parked car is one picture, seen
     the same from all four sides. Walls and floors are right from every side.
7. **Surgery vulnerability:** mid-siege cannibalize drama.
8. **Campaign polish found in the audit, not yet asked for:**
   - (Done Sep 30: all three factions call when the Directive Desk opens.)
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
8. **YOKE's brain text vs her greetings.** Collins's greetings (Sep 30) are spunky, edgy, with
    contractions; her brain text (`content/lore/yoke-brain.md`) said "no contractions, no slang".
    The lore session was reworking it the same day; check the two sound like one person.
9. **The quarters' picture and the partner's portrait** were not made (the art agent's run was
    stopped by the permission classifier). The quarters show the Procreation Board's room picture;
    the data pad has no photograph. `tools/art/intro.mjs` is where they would be added.
10. **The API key in the public repo.** `games/space-derelict/generate_ui_assets.py`,
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
