# BROODFALL — handoff for a new instance (updated Sep 30 2026)

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

## Cities less samey (Oct 1 2026; Collins: "I guess I thought the cities felt a little samey")

- **Why they were samey:** every run began on the SAME crash district; only five district shapes existed;
  a district's blocks of one height were ONE building with one roof (a tabletop of a few huge roofs);
  the sets differed only by colour and small roof props.
- **Lots** (`src/render/biome.ts` lotOf/lotShade): a district is cut into lots of 2-4 cells, brick-coursed, each its
  own building (facade, roof variant, a small tint shift, a faint gutter). Render only; the plate preview matches.
- **Four crash sites** (`content/plates.ts` START_PLATES, same square, mouths and perch count; chosen from the seed's
  own stream, `SimConfig.crash` pins one) and **five more districts** (market, fork, ladder, oldtown, twosquares;
  `DRAFT_ONLY`: by draft only, so the pre-placed connectors are unchanged).
- **Landmarks:** three per set (`tools/art/biomes.mjs` LANDMARKS; `node tools/art/landmarks.mjs [set] [--bake]`),
  one on a 2x2 of every district's largest lot (`isoRender.ts` planLandmarks), hidden by creep like a prop. Raw sheets in
  `art-src-new/terrain/<set>/props-landmark.png` (NOT art-src, emptied Oct 1) + copies `notes/art-review/landmarks/`.
- Balance (`tools/measure/gaps.measure.ts`, new `GAPS_SEEDS`, `GAPS_MODE=onecrash,fiveplates`): see the commit.
  Look: `node tools/shot-cities.mjs <label>` → `notes/screens/2026-10-01/cities-*`; `window.broodfall.growCity(n)`.

## State right now (Sep 30 2026, end of session)

- **Sep 30 2026:** a day of parallel sessions built the whole list in `notes/TO-CREATE.md`'s
  "Built on Sep 30" paragraph; every picture is indexed in `notes/screens/2026-09-30/README.md`.
  371 unit tests pass. What is still missing, and what is Collins's, is `notes/TO-CREATE.md`.
- **No size limits on the art** (Collins): the art is about 60+ MB and that is fine.
- **Idles (Sep 30 2026, notes/screens/2026-09-30/anim-README.md):** a limb idle keeps every frame of its loop at
  12 fps; one with no clean loop is baked `"pingpong": true` (Collins's call) and a near-still one `"breathe": true`
  (tools/art/templates/limb.mjs idleCut). The game plays them on their own clock (src/render/idleClock.ts: real time,
  capped at 1.5x, frozen by a pause, a phase per limb, frame-to-frame cross-fade). Re-baking a limb keeps all of that.
  Look at an idle as the game plays it: `node tools/art/idle-play.mjs <limb>`; measure all: `node tools/art/idle-loops.mjs`.

(The Sep 29 state below is kept for its history.)

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
  carries `/api/broodfall/yoke` and migrations `20260930120000_broodfall_yoke_players` +
  `20260930200000_broodfall_yoke_campaign_minds`); (2) the
  house account made and funded on rfab.ai
  (`node C:/Users/Merry/agent-tools/rfab-grant.js broodfall-house@rfab.ai --usd 100 --create --name "Broodfall house"`,
  dry run then `--apply`) — without it every guest hears "YOKE is resting"; (3) the frontend
  deploy (the rfab.ai `/connect` page). Until (1): on the dev server on this PC she is the
  owner's own star (the AI Core says "DEV: talking to the owner's YOKE"); a build served anywhere
  else gets no live mind (Kimi with the player's own key if he pasted one, else scripted).
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

- **Every beat of all three routes, written for Collins, and the midpoint: `notes/CAMPAIGN-BEATS.md`** (Oct 1 2026).
- **No direct contact; new channels (Collins, Oct 1 2026; DESIGN.md "How each faction reaches him"):** he never goes
  down or meets anyone; "in person" is by hologram (the summit, the tea). The Delegation write in the crops (first
  letter to "the Visitor and his wife", read out by a mortified YOKE), the Faithful sync one message over tens of
  thousands of stations, the Institute knock on the hull with a laser counting primes. Translator bands, notes and
  source sounds follow (content/translation.ts, src/audio/engine.ts translateIn). Contact pictures redrawn with
  `node tools/art/redraw-contacts.mjs <ids>` (raw to art-src-new/, never the ship template's bake while art-src/ is
  being recovered); their alive loops were dropped (owed). Changed leader lines re-voiced; identical words under a
  renamed scene reuse the baked take.
- **The midpoint (BUILT Oct 1 2026; Collins: "an option to switch allies ... I would appreciate that as a player"):**
  once a campaign, the return after the 2nd territory taken since allying (`MIDPOINT_CAPTURES`), the other two factions
  make offers (pending scenes with `offer: true`). Go over (`switchAlly`): the old ally's perks and finale go, it says
  goodbye in character (never hostile: DESIGN.md "none of them ever turns against you"), the new route starts one
  territory in (`SWITCH_HEAD_START`), and the old ally writes once more after the ending (`midpoint.coda`, before the
  reveal). Stay (`stayLoyal`): every perk kept + a thank-you perk (Pickets / Tithe / Retainer). State: `midpoint` on the
  save (optional; an old save past its midpoint is offered it at its next return). Tests `tests/midpoint.test.ts`; beat
  `node tools/shot-midpoint.mjs` (after `npm run build`), screens `notes/screens/2026-10-01/midpoint-*.jpg`. Its cards
  have no pictures and no voices yet (`voiceKey` keys them by the speaking faction + scene title if someone voices them).

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
  first-boot B-movie since Oct 1 2026 ("The first-boot film and the reveal" below; the eight-clip
  opening film of `src/ui/intro.ts`/`tools/art/intro.mjs` is its fallback), then mission 1 at the crash site, with the board loading behind the
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

## The first-boot film and the reveal (Oct 1 2026) — notes/BMOVIE-SHOTLIST.md

Collins: "create an intro video that plays the first time a user boots up the software ... some sort of 1950 B movie
style scene ... from the perspective of people in whatever the starting biome of something coming from the sky and have
that replace the intro vid for the very first mission (not revealing the ship and everything until that mission's over)".
- **The film:** "THE THING FROM THE SKY", 68.5 s, 4:3 (960x720), faded Technicolor with grain, flicker, gate weave,
  scratches; ONE file with its whole mix (theremin/brass score, the trailer narrator's seven lines, plate, scream, crowd,
  siren, the game's own land-roar/land-impact; -14 LUFS): `public/art/intro/bmovie.mp4` + `bmovie.json` (shot times,
  `cardAt`, the five titles the game sets in type). Night 0 at the Crash Site in the Suburbs set ("Luckwell Gardens",
  the meteor falls between the school and the laundromat, content/lore/insects.md): porch, laundromat, kitchen, the
  street looking up, the fall, the strike, the Civil Watch walking into the smoke, the tendril, the flight, the siren,
  the heart waking. No ship, no Empire, no YOKE. Its card: BROODFALL / "YOU ARE THE THING THAT FELL."
- **Colour, not black and white:** probed on one still (`notes/art-review/bmovie/probe-colour-vs-bw.jpg`): in B&W the
  red glow from the sky (the threat), the pastel suburb that matches the board and the amber eyes all go; the style
  bible's films are "1950s colour horror".
- **Player:** `src/ui/bmovie.ts` `playBmovie` (called by `playIntro` when `bmovie.json` is there; the eight-shot film is
  its fallback): the BEGIN card when sound is locked, heard through the MUSIC channel (`routeMedia`), titles on the
  film's clock (`titleAt`), the buffering loop with cinema lines, click/Esc/Enter/Space skip. Replay: the menu's and
  Settings' REPLAY THE OPENING, `?intro=1`. Reduce motion: titles and grain still, the film itself plays.
- **Nothing ship-side before mission 1 is over:** mission 1 reopened (not straight after the film) lands from the FALL
  (`playLanding` `fromFall`, `fallStart` in `src/meta/landing.ts`: the release shot and its poster are skipped); its
  loading screen says PREPARING THE TOWN with the town's radio lines (`LoadingScreen.plain`, `TOWN_LINES`).
- **The reveal after mission 1** (`playReveal`, rule `revealDue` in `src/meta/onboarding.ts`, flag
  `broodfall-reveal-seen`): CONTINUE on mission 1's report (or the ship reopened before it) plays the landing films'
  release shot, cut before its dissolve (`public/art/intro/reveal.mp4`, 2.7 s at 0.6x), under `sting-desk`,
  "MEANWHILE, HIGH ABOVE LUCKWELL GARDENS", then "…AND YOU ARE THE ONE WHO SENT IT.", then the ship and YOKE. Once;
  never to a save from before the unfolding or past its first return; Reduce motion: its still and the card.
- **Make it again:** `node tools/art/bmovie.mjs --stills|--clips|--audio [ids]` (SPENDS), `--probe`, `--bake`, `--reveal`
  (free). Raw files: `art-src-new/bmovie/` (or `$BMOVIE_RAW`): 15 stills (`v1/` keeps the four re-rolled ones), 15
  Seedance 2.5 clips, `audio/` takes. Contact sheet `notes/art-review/bmovie/bmovie-sheet.jpg`.
- **Beats:** `node tools/shot-bmovie.mjs [A B C D E]` (port 5251; all pass Oct 1 2026), screenshots
  `notes/screens/2026-10-01/bmovie-*`. `tools/shot-onboarding.mjs` A now jumps through the new film; its later step
  "print yourself a body" (`#yoke-scene`) times out on main too (checked on 7ff1b56c, before this work).
- **Collins's to judge:** the film itself; the town's name "Luckwell Gardens" (from the lore's Luckwell company
  suburbs); the reveal's two lines.

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
  message; music/effects drive the sound buses (src/audio/). The YOKE account/model section is a SLOT: the YOKE connect
  session calls `registerSettingsSection('yoke-account', draw)`. HUD styles come from
  `src/hud/themes.ts` (`HUD_THEMES`, `applyHud`).
- **Territory pictures**: `node tools/art/make.mjs ship territories` (manifest `ship.ship.territories`),
  shown over the briefing and the dark desk's assignment (`territoryPictureHtml` in campaignUi).
- Beat: `node tools/shot-camp.mjs [A] [B]` (dev server 5251; `notes/screens/2026-09-30/camp-*`).
- Hobby genes measured Sep 30 (naive hold-12, 10 seeds, each gene alone; no gene 6/10): Tallow Blood
  5, Grudge Marrow 5, Kite String 5, Royal Jelly 6, Homing Tissue 6, Wet Nurse 6, Hitchhiker Spores 6,
  Wedding Musk 6 (328 pairings), Royal Graft 4 (the free cage takes a hand slot the bot does not use
  well). No walkover; the dips are the reshuffle of card draws the HANDOFF warns about, not the verbs.

## The sound (Sep 30 2026)

Collins: "Let's generate audio." Everything is generated through the RFab API on his account and
baked into `public/audio/` (Opus .ogg, 11 MB, `manifest.json`). **Listen:**
`notes/screens/2026-09-30/audio-README.md` (every file, what it is for, its length, the prompt),
`audio-proof.mp4` (the game played with its sound), `audio-reel-{music,sfx,voice}.ogg`.
- **Pipeline** (`tools/audio/`; SPENDS tokens, skips what exists; raw takes in `art-src/audio/`):
  `node tools/audio/make.mjs [ids] [--bake] [--redo id]`, then `node tools/audio/sheet.mjs` (free:
  reels + sheet). Cues and prompts: `tools/audio/cues.mjs`. Music: Eleven Music v2 (250 tokens/s;
  Mureka ignored "no drums"). **RFab has no sound-effect route**: effects are cut out of the soundtrack
  of MiniMax Hailuo 3.0 text-to-video takes (`atlascloud:h3-t2v`, 480p, ~2,930 tokens/s), each take
  asking for the sound several times with silence between (every separate sound = a variant). The
  newsreel narrator: Veo 3.1 Lite speaking the line (checked back by transcription). Levels: music
  -16 LUFS, effects ~-14 with peaks < -1 dBTP; loops seamless, played between `loopStart`/`loopEnd`
  (the file carries 0.5 s of itself either side: the codec rings at a file's ends).
- **Game side** (`src/audio/`): `engine.ts` (WebAudio: master → music / effects / voice buses from
  the Settings sliders, unlock on the first click/key, per-sound gap + polyphony + pitch spread, 24
  voices max, music scenes crossfaded and resumed where left, stingers duck the loop, `duckFor()` under
  YOKE's and the boss's `<audio>`, "Mute when away" setting, `window.__bfAudio` log/meter/recorder),
  `cues.ts` (rules, limb family → firing class, insect → death, `sceneOf`), `gameSounds.ts` (reads the
  sim each frame: a cooldown jump = a shot, a vanished shot/shell = a landing, new card ids = draws, the
  core's stage; sim events; every console button by one delegated listener; intercom, faction call,
  print-a-body by what is on screen). Hooks elsewhere are one line each: `main.ts` (handleEvents, the
  frame loop, `musicTick`), `intro.ts` (BEGIN card, score, narrator), `padOutro.ts` (the pad meets the
  desk at 2.3 s), `bossCall.ts` / `yokeAvatar.ts` (`duckFor`).
- **Trap:** a bus with nothing flowing through it is not processed by Chrome, so a gain GLIDED to a new
  level starts from the old one the moment a sound arrives (effects at 0% were heard at -46 dBFS). Bus
  gains are SET, not glided.
- **The menu's hum answers the first click** (fix pass, Sep 30): the scene's loop is fetched and decoded while the
  page still may not play, it starts BEFORE the ~150 effects are fetched (they had queued it for 3+ s), and while a
  loop's buffer is still decoding (a 2-minute Opus loop takes ~2.5 s) it is STREAMED from its file through the music
  bus (`streamLoop`), the decoded loop taking over at the same place with a 0.25 s crossfade
  (`__bfAudio.state().streamed`). Beat B checks the hum within 2.5 s of the click (measured ~0.4 s).
- **Checks:** `tests/audio.test.ts`, `tests/audio-board.test.ts`, `node tools/shot-audio.mjs [A B C]`
  (dev server 5263, no autoplay flag: every sound unlocked by a real click; 58 checks).
- The film's decision: on a page that cannot play sound yet it waits behind "▸ BEGIN" (click or any
  key; Esc still skips); a page that may play (replayed from the menu) starts at once.

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
  **The kept take is `art-src/pad/infested/`** (fix pass, Sep 30): the window shows the menu loop's infested
  planet, not the first take's green Earth (left in `art-src/pad/`). wan3.0 drew Earth's continents at night
  twice when told "not Earth, no Americas" (naming them primes it): describe the planet positively only.
  Bake: Leaflit's studio ChromaKey set to the screen's own colour, the screen = biggest keyed patch →
  convex hull → edges fitted to the hull (bridges fingers) → corners, smoothed; key kept only inside
  the screen. Review: `notes/art-review/pad/<id>.jpg` (a game picture warped in) and `<id>-track.jpg`.
- **Checks:** `tests/padOutro.test.ts`; `node tools/shot-pad.mjs [won lost skip calm]`.

## The Limb Codex and the limb decision sheet (Oct 1 2026)

Collins: "a guide to the limbs and how they work with their visuals, bonuses, etc. — will use that to make decisions
about what needs to be changed before upgrade looks". 37 families (35 in the draw; the Trap Cage and the Seedling are given).

- **In game** (`src/ui/codex.ts`, `codex.css`): main menu LIMB CODEX, the ▤ button in the ship's room bar and by the
  board's view controls, the C key, and CODEX on a built limb's panel (opens at that limb; the run pauses). Every limb alive
  (front, behind, firing, withering, each drawn upgrade look), its numbers, traits, what it teaches when eaten and that
  bonus's look class, the organ that unlocks it, which engines fit it, and its evolution tree with each option's class.
- **Nothing is typed twice:** `src/ui/codexData.ts` reads content/data.ts, content/limbText.ts (the card and donor words,
  moved out of src/ui/hud.ts so non-DOM code can read them), content/upgrades.ts, content/upgradeLooks.ts and
  content/underground.ts. `evoLooks` = the looks a limb's eight evolution paths reach with no eaten bonus. tests/codex.test.ts.
- **The decision sheet** (for Collins, not in game): `node tools/codex/sheet.mjs` writes
  `notes/limb-codex/limb-codex-sheet.html` (self-contained, thumbnails cut from the atlases by tools/codex/thumbs.mjs),
  published at https://claude.ai/artifact/G1XVCeZcLdEPx1QfQ2ny7g (republish that file to keep the link). Counted flags are
  computed; Claude's read of pictures and roles is `tools/codex/audit.mjs` (AUDIT per limb, DECISIONS at the top).
  The scripted runs per limb: `tools/measure/limbs.measure.ts` -> `notes/limb-codex/balance.json` (kills by poison, burn,
  cloud and eaten-whole are credited to NO limb in sim stats, so Maw/Blight/Ember/Lure read low there).
- **Beat:** `node tools/shot-codex.mjs` (dev server on 5241, spawned as node + vite.js) -> notes/screens/2026-10-01/codex-*.jpg.
- **Trap that cost time:** the picture timer must not use `data-f`: a click handler that looks for `[data-f]` (the filter
  chips) found the sprite itself. Frame state lives in `data-fr`.
- **Biggest finding for the upgrade looks:** most limbs' evolution paths reach only 1-3 looks (the stage-3 pick decides),
  and the three prototypes drew looks no path reaches without eaten bonuses. Collins's call: draw the reachable looks first?

## The landing films before every deployment (Oct 1 2026)

Collins: "for loading into the different biomes, do we have broodfall landing animations to make it seem cohesive that
would play at the start of any scenario? if not we should."
- **What plays** (`src/ui/landing.ts`, rules `src/meta/landing.ts`, hook `landThenStart` in `src/main.ts`): before every
  deployment (a campaign mission from the address, a skirmish from the menu or `?autostart=1`), the tile set's film
  (~8.8 s, lifelike, the Empire's side): the ship fires the asset out of its bay and the camera chases it down (one shot
  shared by all ten), it roars over that set's street as its insects look up and duck, a hard cut under a white flash (drawn by the game: Reduce flashes takes
  it out) to the strike seen from the BOARD's camera, and the fire and dust clear on the board itself, creep running out.
  The film's last frame IS the board at minute zero (a picture of the real game): at its end the picture is moved onto
  the live canvas (the band of the canvas it shows, its crater laid on the live meteor) and fades: the board comes alive
  under it. The run's clock (`started`) starts only when the film is over (or skipped) AND the board is drawn; a film that
  ends first holds its last frame with a corner loop (`src/ui/loader.ts`); before its first frame, the loaders' cover.
  Click / Esc / Enter / Space skips. Sound: `land-roar` (3.4 s, timed to end at the strike) and `land-impact`
  (`tools/audio/cues.mjs`, `maxSeconds`/`fadeOut` added to the `one` cut). The music scene is 'film' while `#landing` is up.
- **Mission 1** straight after the opening film gets NO landing: the opening ends at the crash site and is its landing
  (`after-opening`). Mission 1 entered any other way (the page reopened with it pending) lands on the Suburbs (crash site).
- **Settings** › THE GAME › "Play landing films": ALWAYS (default) / FIRST TIME PER TILE SET (`broodfall-landing-seen`) /
  NEVER. Reduce motion: the gentle version (the last frame fades in, holds 1.6 s, fades into the board; no film, no sound).
- **Beats:** under automation it plays only with `localStorage['broodfall-landing']='on'` (or `?landing=1`; `?landing=0`
  turns it off), so every other beat is unaffected. `window.__bfLandingWhy` says why one did or did not play;
  `window.__bfLanding` its phase (loading, playing, holding, handoff, done), roar/strike, how it ended.
  `node tools/shot-landing.mjs [A B C D]` (dev server 5319): A four sets played through and RECORDED
  (`notes/screens/2026-09-30/landing-<set>.mp4`), B the campaign (no landing after the opening; mission 1 reopened lands),
  C the menu's deploy + Esc, D the setting and Reduce motion. Test: `tests/landing.test.ts`.
- **The art** (`tools/art/landing.mjs`; raw `art-src/landing/`, baked `public/art/landing/<set>.mp4|-start.webp|-end.webp`
  + `landing.json`, review `notes/art-review/landing/<set>.jpg|.json`). Three shots, cut by `bake` (release 0.2–2.2 s,
  0.3 s dissolve, fall 0.4–3.8 s at 1.1x, hard cut under the game's flash, the strike whole at 1.2x; ~8.8 s):
  1. **The release** (one for all ten): `design` draws `release.png` (the Merciful Yoke as the key art and
     `public/art/ship/exterior.webp` draw it, its bay open, the meteor half out; the planet is the game's day map,
     `public/art/ship/planet.webp`, clean), `motion` animates it with NO end frame: the meteor is fired out and the camera
     chases it down into the atmosphere.
  2. **The fall** (per set): `design` draws `street-<set>.png` (low angle in that set's street, its insects in 1950s
     clothes looking up, the meteor burning through that set's sky), `motion` animates it: it roars overhead, they duck.
     Both on **atlascloud:seedance-2.5-i2v** (5 s 720p, 115,988 tokens = $2.32), picked by `probe` against Kling 3.0
     Turbo (barely moved the meteor) and Veo 3.1 Fast ($1.38 for 6 s; blew the bay up, exploded the meteor in mid-air):
     `notes/art-review/landing/probe-*.jpg`. Collins on v1 (a still with the meteor scaled across it between a start
     and an end frame, kept in `art-src/landing/v1/` and as `fall-<set>-*`): "you don't need these to merge into
     anything — you can just use AI videos".
  3. **The strike** (per set, KEPT EXACTLY: Collins, "chef's kiss — better than I thought was possible"): `boards`
     pictures the game's canvas at minute zero (seed 42, dev server 5317, free); `stills` draws `hit-<set>.png` (an EDIT
     of it: the fireball where the meteor stands); `clips` makes hit → board on **seegen:wan3.0-video** (start AND end
     frame, 5 s 720p); the bake fades the board picture in over the last 0.6 s so the film ends exactly on it.
  `sheet` writes `notes/screens/2026-09-30/landing-00-sheet.jpg`. A new tile set: add it to `SETS`, run boards, stills
  (its hit), clips, design, motion, bake.

## The stills that came alive (Oct 1 2026; notes/VIDEO-AUDIT.md has every still and its verdict)

- **Loops from stills** (`node tools/art/stills-alive.mjs [group|group:id] [--bake|--list]`, SPENDS ~$1 a clip on
  **seegen:sd2-fast**, 5 s; sd2-mini restyled first frames and redrew faces: raw in `art-src/stills-alive/<group>/`,
  rejected takes in `v1*/`): the faction scenes (14), the reveals (3), the territories (16, 480p), the report's lead
  (won/lost/held), the partner's portrait. Baked to `public/art/alive/<group>-<id>.mp4|.webp` + `alive.json`;
  review `notes/art-review/stills-alive/` (the still + 8 frames: LOOK at every one; re-roll by moving the clip to `v1/`).
- **In game** (`src/ui/alive.ts`): a still marked `data-alive="<group>:<id>"` is swapped by `wake(root)` for ONE pooled
  `<video>` per surface (kept across the ship's redraws), paused off screen/hidden, released when gone; the still under
  Reduce motion and under automation unless `localStorage['broodfall-alive']='on'`. campaignUi calls `wake` after every
  render; `debriefPictures` wakes its own lead.
- **Directives and Notebook** have their own rooms now (`ship-loops.mjs orders hobby`); `dress()` takes a room's own
  loop before the one it borrowed.
- **Gene Bay organ cards** step through the organ stage's strips (`under.loops`, CSS) — they follow whatever the organ
  session bakes. **Hand cards** step through each limb's idle frames (hud.ts `animateCards`, one 12 fps timer).
- **Organ stage skyline** (`src/ui/skylineLife.ts`, `node tools/art/skyline-life.mjs` free): beacon, smoke, searchlight in CSS.
- **Boss transmission**: `tools/art/boss.mjs --bake` crossfades its loop seam.
- **Beat:** `node tools/shot-alive.mjs [scenes territory rooms partner genes debrief hand skyline boss reduce]`
  (dev server 5293) -> `notes/screens/2026-10-01/video-*`.

## The ship presented (Sep 30 2026): room loops, the planet, meat drops

- **Room loops** (`node tools/art/ship-loops.mjs [ids] [--stills|--bake]`; SPENDS: a still ~$0.50, an 8 s 1080p
  clip on seegen:sd2-fast ~$5): each room's approved still (`art-src/ship/room-<id>.png`, never touched) cut to 16:9
  and EDITED so the man is the same man everywhere (black high-collared shirt, sleeves up, stylus behind his ear, the
  pad clip's clothes; the first stills had a long coat in three rooms), Comms' window shows the infested planet; then
  a clip whose end frame is its start frame; the bake cuts the model's snap frames and crossfades 0.75 s if the seam
  shows. He is BAKED into the loop (one picture, one light), not a layer. The Quarters (drawn by
  `tools/art/intro.mjs quarters`) is his empty cell seen from the doorway. Directives and Notebook borrow the Board's
  and the Locker's. Output `public/art/ship/loops/` (+ `loops.json`), review `notes/art-review/ship-loops/`. In game:
  `campaignUi.ts` `playLoop` puts ONE `<video>` behind the screen (z-index -1 inside `#campaign`), the poster is its
  own first frame; paused while the ship is hidden; not with Reduce motion.
- **The planet** (`src/ui/globe3d.ts`, three.js): day map `planet.webp`, night lights `public/art/ship/globe/night.webp`
  (`tools/art/globe-night.mjs`, seam blended), creep veins drawn in the shader over HELD zones (their lights out), a
  counter-attack pulses, zone borders where two sites are equally near. Turns by itself (not under Reduce motion, not
  under automation unless `localStorage['broodfall-globe-spin']='on'`: a moving marker is never "stable" for
  Playwright), drag both ways with inertia (tilt held to +-70), wheel/pinch zoom, hover = zone lit + tooltip (name,
  state, lights still burning), click a zone or marker = pick + turn to face it, arrow keys and the turn buttons.
  The SVG markers (`.globe .site`) are moved every frame; those behind the planet get `.behind` (hidden): a beat
  clicks `.site.open:not(.behind)`. No WebGL: the flat painter in `globe.ts` as before.
- **Infested regions on the planet (Oct 1 2026; Collins: "have regions look infested when they are infested on the
  map").** Held ground is no longer a red fill: the shader (`globe3d.ts` FRAG, "THE INFESTATION") spreads the brood's
  flesh out of each held site with a ragged noise front, over the zone's own LAND (the sea takes a dark veined slick,
  thicker near coasts), tissue cells + veins by day, veins and spore points glowing by night where the cities' lights
  went out, a slow beat pumping outward from the site, the front glowing hotter on a fresh hold; it runs on across a
  border into a neighbour that is also held and fades in fingers short of any other. How far it has spread is the
  hold's age (`heldGrowth` in `globe.ts`: the save's `held` order; newest capture 0.34, the one before 0.68, older and
  the crash site 1). A fresh capture grows out of its site ONCE, the first time the planet is on screen (6 s;
  remembered in `localStorage['broodfall-globe-seen']`); Reduce motion: no beat, shown grown. The flat painter draws
  the same flesh (`creepCover`, `fbm3`). Beat: `node tools/shot-globe-infest.mjs [none|some|many|grow|flat]` (own dev
  server on 5241) -> `notes/screens/2026-10-01/globe-infest-*.png` (`-BEFORE-` = the old fill); tests
  `tests/globe-infest.test.ts`. No art was generated for it (0 tokens).
- **Meat drops** (`node tools/art/meat.mjs`, one still ~$0.45): `public/art/fx/meat.webp`, manifest `fx.meat`; drawn
  by `src/render/meatFx.ts` (pop, bobbing glide, shadow, trail, pickup ring and sparks at the core);
  `window.broodfall.fx()` reports `meat`, `meatFlying`, `meatPickups`, `meatPickedUp`.
- **Beat:** `node tools/shot-ship-loops.mjs [rooms globe meat]` (own dev server 5289, GPU flags):
  `notes/screens/2026-09-30/ship-loop-*`, `globe-*`, `meat-*`.

## The campaign's media: news between runs, the leaders' voices, the ending films (Sep 30 2026)

- **What plays.** On RETURN TO THE SHIP after a campaign deployment (`main.ts` campaignDebrief `back`, one
  line), the planet's news of it: `src/meta/media.ts` reads the deployment's moments (retaken, repelled,
  ally:<faction>, beat:<id>, desk-open, capture:<territory>, counter, capture, lost; most telling first)
  and picks the first piece of `content/media.ts` that fits (never the last one shown, a story piece once,
  unseen first, the other side first); `src/ui/newsreel.ts` plays it over everything: the Office's
  **Clearance Review** (lurid Technicolor, chipper male Veo announcer, `m-empire` march), their
  **Commonwealth Newsreel** (black and white, earnest female Veo announcer, `m-colony`) for what goes their
  way, or one of **their papers** (spins in; masthead, headline, deck, body, caption all TYPE; the
  photograph generated). 12 reels + 16 clippings. The **break** (DESIGN.md "Tone stack"): a reel shot the
  Office did not mean to show, ungraded, the music cut to 8 s of raw field audio (reel-temple, reel-pilgrim);
  and every fourth Empire reel from the third on replayed whole with the filter off, no narrator, no music.
  Skippable (click, Esc, Enter, Space); its sound goes through the game's buses (`routeMedia` in
  `src/audio/engine.ts`: Settings music/voices, mute-when-away, ducking, the recorder); `main.ts` musicTick
  treats `#newsreel` as a film (the ship's loop fades under it). Log per campaign: localStorage
  `broodfall-media`. Under automation it plays only with `localStorage['broodfall-media-auto']='on'`.
- **The leaders' voices** (`src/ui/sceneVoice.ts`; `campaignUi` calls `attachScene(this.el)` after each
  render and on hide; the card carries `data-faction`/`data-scene`): each scene card's lines play in order,
  the leader's in his voice, the character's read in reading time, the line being said lit (`said-now`),
  music ducked. A line rewritten since its take is read, not played (the take stores its text). Voices
  (`content/media.ts` LEADER_VOICES): **the Voice = Veo 3.1 Lite** as a 1950s radio evangelist through a
  radio EQ (he IS a broadcast; Veo's speech is far more period than a TTS voice); **the Delegate = Aura
  Helena**, **the Director = Aura Aries** (he is 21st-century and online: a period voice would be wrong),
  **the Awaited One = Aura Zeus**. 73 lines. Trap: a word in CAPITALS is SPELLED by both models ("W O R D"):
  `speakable()` in `tools/media/make.ts` lower-cases it and asks Veo to lean on it; `make.ts recaps` moves
  such takes to `v1/` to be made again. Every Veo take is transcribed back (`notes/art-review/media/speech.json`).
- **The asides, heard (Oct 1 2026).** The letters / broadcasts / calls an ally sends between deployments
  (`asides` in `content/campaign.ts`; 20 leader lines, his own log lines are not voiced) are voiced in the same
  leader voices. A line outside a scene card is keyed by its WORDS (`content/media.ts` `lineKey`: `say/<who>-<hash>`),
  so a rewritten or new line is simply a missing key: `npx vite-node tools/media/lines.ts` lists what is unvoiced
  (free), `make.ts -- voices lines` then `make.ts -- bake lines` make it (bake drops dead `say/` keys).
  `looseLeaderLines()` walks ALL of `content/campaign.ts`, and `scenesOf(f)` every scene of a faction wherever it
  sits, so a new list or scene (the ally-switch midpoint) is picked up without touching the tools; `sceneVoice.ts`
  finds any scene the same way and falls back to the words' key. In game (`src/ui/lineVoice.ts`): the report
  plays the ally's aside by itself once, lit; the Comms inbox has ▶/■ on each leader line; a click on the line,
  Esc (taken before Settings sees it), leaving the room or RETURN TO THE SHIP stops it; voices at 0 = no button.
  Beat: `node tools/shot-asides.mjs [A B] [--build]` (dist-asides, port 5293). Listening sheet + reel:
  `notes/screens/2026-10-01/asides-voices-README.md` (`lines.ts -- --sheet`). Cost: ~205,000 tokens (~$4.10).
- **The ending films** (`ENDING_FILMS`): each ending card (the three and the Institute's pacify) first plays
  a 5-shot film full screen with its own score (`m-end-*`) and a last line in type, then its card loops the
  film where the picture was. The first shot of each is animated from the scene's existing picture
  (`art-src/ship/scenes/`). **The reveal cards' pictures** (`REVEAL_PICTURES`; `picture` on each `reveal`
  in `content/campaign.ts`, drawn from `public/media/pictures/` by `scenePictureHtml`'s fallback): the
  Delegation's meadow letter, the Faithful's Comb Above, the Director's flattering private city.
- **Make / bake** (SPENDS tokens; each step skips what is on disk; raw in `art-src/media/`, music and field in
  `art-src/audio/`): `npx vite-node tools/media/make.ts -- stills|clips|voices|bake [ids]`; prompts in
  `tools/media/prompts.mjs` (three looks: empire, colony, raw, plus the finale); review in
  `notes/art-review/media/` (`stills/`, `photos/`, `reveals/`, `clip-<id>.jpg`, `speech.json`);
  `node tools/media/grid.mjs <dir> <out>` labels a folder in 2x2 grids to look at. Baked: `public/media/`
  (`media.json`, clips 1280x720, photos, pictures, voice, music; ~73 MB). Cost Sep 30: ~$52 (51 stills at
  medium $0.12, 3 high, 40 clips at 720p $0.49, 44 Veo lines $0.3-0.6, Aura, 5 music, 1 field take).
- **Checks:** `tests/media.test.ts` (coverage, what is picked when, no repeat in a row, every file on disk,
  every leader line voiced with its current words, four films, three reveal pictures);
  `node tools/shot-media.mjs [A B C D] [--build]` (its own build `dist-media` served on 5287; the dev server
  answered too slowly with the sessions building beside it): A a win at Old Harbor → reel → the Delegate
  heard, filmed with its sound (`notes/screens/2026-09-30/media-newsreel.mp4`); B losses → their reel
  (Esc) → their paper; C the papers, their victory, the break, the replay; D each route's ending film →
  its card → the reveal picture (`media-ending-film.mp4`, the Faithful's).

## The Roach King: the enemy's leader, on their television (Oct 1 2026)

Collins: the core enemy leader, "patriotic upstanding and over the top" (a wrestler-showman head of state
crossed with a streamer), "called the Roach King"; the flag "the Texas flag with an insect head instead of
a star"; "not ... until a couple missions in"; "from cut scenes". Lore, voice bible and his arc:
`content/lore/roach-king.md`; the arc as a player meets it: `notes/CAMPAIGN-BEATS.md` "THE ROACH KING".

- **Never met.** President Duke Crawley does not know the operator exists. Each scene is one of his addresses
  to the nation, caught off their TV band and rendered by YOKE (channel `roach` in `content/translation.ts`:
  the INTERCEPTED card's band, `translateIn(el, 'roach')` = a line-scan whine and mains hum under each line's
  first beat, her notes on his words). It plays after a deployment's news (main.ts `back()`:
  `newsAfterDeployment` → `roachAfterDeployment` → the ship). At most one a deployment.
- **When** (`src/meta/roachKing.ts`, pure, tested): nothing before the 3rd deployment; `rk-address` first,
  always; then most urgent first: `rk-offline` (campaign ended) > `rk-stand` (ally's finale open, or 8 held
  with no ally) > `rk-counter` (first telegraphed counter-attack) > `rk-<faction>` (allied + two of its beats
  seen; once per faction, so the midpoint switch gets the new ally's too) > `rk-draft` (3 held). Seen ids
  in localStorage `broodfall-roach` (per campaign seed, like `broodfall-media`).
- **The player** (`src/ui/roachKing.ts`, `roachKing.css`): `#newsreel.rk-broadcast` (the id the rest of the
  game reads as "a film is up"), two video layers, each shot a clip WITH ITS OWN SOUND routed through the
  voice bus; the LIVE bug, the flag in the corner, his name as a lower third on the first shot, his line set
  in type (`lineHtml`, resolving from the band's glyphs), the cards over the flag on its pole. Click / Esc /
  Enter / Space skips; Reduce motion stops the scan roll and the blink. Under automation only with
  `broodfall-media-auto` = on. Beats: `window.__bfRoach.start(id)`, `.due(state, seen)`.
- **Made** (`tools/media/roachking.ts`; `flag | stills | clips | check | bake | sheet`): the flag (gpt-image-2,
  flat + on a pole); 12 stills drawn from one den still (every other still is an edit of it, so he is the same
  man); 24 shots on `imagerouter:veo-3.1-lite-i2v` WITH SOUND: he speaks on camera, the same voice asked for
  in every clip ("a pro-wrestling announcer with a thick Texas drawl"); `check` transcribes each clip against
  its line (`notes/art-review/roach/speech.json`). Baked to `public/media/roach/` + `roach.json` (its OWN
  manifest: this bake never touches `public/media/media.json`). Raw: `art-src-new/roach/` (NOT `art-src/`,
  which was emptied on Oct 1 and is being recovered). Cost: about $0.62 a clip, $0.45 a still.
- **Look at:** `notes/screens/2026-10-01/roach-king-sheet.jpg` (every shot, three frames),
  `roach-king-address.mp4` (his first address in the game, with its sound), `notes/art-review/roach/`.
- **Collins's:** the name; whether he also appears ON the finale board; the reveal line (PROPOSAL).

## Every wait shows a loop (Oct 1 2026) — notes/LOADING-AUDIT.md

Collins: "we had a loading screen here without a looping animation (pad-lost.mp4) — that should never happen; the reason
we have the RFab API is to create those nice looping animations to engage users during load." So no wait is ever a still
screen, and a wait under 400 ms shows nothing (no flash).

- **The loops** (`node tools/art/loaders.mjs [--stills|--bake] [ids]`; SPENDS ~$0.75 a clip): `emblem` (the meteor
  burning in its ring, from art-src/screens/emblem.png, keyed with Leaflit's ChromaKey), `creep` (veins pulsing on living
  flesh), `scan` (the asset's outline on the ship console's scan grid, a scan line sweeping), `dance` (YOKE dancing: a new
  take from her Leaflit sprite, start = end, keyed + her projection look), `yoke` (her own `thinking` clip, only made
  small). Each: `public/art/loaders/<id>.webm` (VP8, alpha where keyed) + `<id>-mini.webp` (the FIRST PAINT, ~100 KB,
  the boot screen's scan and emblem ones EMBEDDED in index.html as data URIs) + `<id>-slow.webp` (Reduce motion: a third of the speed, never a still). Seamless when the
  model landed on the end frame, else ping-ponged. Raw: art-src/loaders/ (first creep take, a black worm, in v1/).
  Review sheets: notes/art-review/loaders/.
- **The API** (`src/ui/loader.ts`, for every screen that waits — the landing film too):
  `const h = showLoader(kind, { label, host?, corner?, lines? })` → `h.progress(done, total)`, `h.hide()`;
  `hideLoader()` (all); `await withLoader(promise, kind, opts)`; `loopEl(kind)` / `loopHtml(kind)` for a loop in your own
  panel; `watchBuffering(video, host)` (a corner loop while a playing film stalls); `shipLoop()` = `scan`, or YOKE's
  `dance` about one ship wait in three (never twice running), with one of her lines set in type under her
  (`DANCE_LINES`). Every visible wait carries `data-loading` with a `.bf-loop` in it.
- **The LANDING FILM** (src/ui/landing.ts, another session): the run-start wait is the film once it is ready; until its
  file has arrived, cover the gap with `const h = showLoader('creep', { label: 'THE LANDING' })` and `h.hide()` when the
  film's first frame is up (or `watchBuffering(filmVideo, filmEl)` for stalls inside it).
- **The SCAN loop is the headline** (Collins, Oct 1 2026, on seeing them: "the loading animations look INCREDIBLE — that
  one with the alien thing being scanned"): it is the boot screen's main picture (first load, every deployment) and the
  default for the long waits; its look (thin pale-cyan outline on a dark scan grid, a sweeping line) is the REFERENCE for
  any further loader.
- **Wired:** the boot screen (#boot: the scan loop big, the emblem loop in the logo, the creep dim behind it all, the
  real file count; in the MARKUP, the scan's and the emblem's first paints embedded as data URIs, and shown
  by an inline script for a `?campaign=run` / `?autostart=1` page, so it moves before the game's code arrives), the pad
  clip still arriving (padOutro.ts), the report's pictures (main.ts), the news from the planet loading and every film
  shot buffering (newsreel.ts, intro.ts), the ship before its art and the planet are in (campaignUi.ts `artWait`),
  YOKE's stage before her first clip (yokeAvatar.ts stand-in), the organ stage opened before its pictures are in
  (main.ts openUnder: its stills are fetched 1.5 s after the board is up; underground.ts untouched). A click on SKIRMISH / NEW CAMPAIGN made on a slow line BEFORE the
  game's code has arrived is kept by index.html's inline script (the loading screen up at once) and replayed by
  `setupMenu`; the boot screen's full loops are fetched only when it is really up (never on the menu, where they
  would take the line from the board's art).
- **Beat:** `node tools/shot-loading.mjs [first pad reel yoke organ calm fast]` (own dev server 5271; art/ and media/
  held back as a slow link) FAILS when a wait is on the screen over 400 ms without a moving loop; out:
  `notes/screens/2026-09-30/loading-*`.

## Defence deployments (Oct 1 2026) — DESIGN.md "Defence deployments"

Collins: "always visually warn the player one 'turn' ahead with like a pushing arrow ... you can choose
to just attack that territory to cancel having to play one".
- **Rules** `src/meta/defence.ts` (staged → struck first or launched → defend or lose; old saves staged
  again on load, `src/meta/storage.ts`); hooks in `src/meta/campaign.ts` `finish` and `plan`; numbers
  `content/defence.ts`. Save fields: `staging`, `attackFrom`, `boards` (all optional).
- **The board remembered** `src/sim/boardSnapshot.ts`: `Sim.snapshot()` on a win (main.ts puts it in the
  `RunReport`); `SimConfig.board` opens a run on it; `SimConfig.pregrown` grows the large fallback city.
  The underground is dug again from `underSeed`, so organ anchors stay valid. Changing the city generator
  (citymap.ts) does not break old snapshots: a snapshot stores cells, not seeds.
- **The one siege** `SimConfig.oneWave` (`asWave`, `minTier`, `armSeconds`, `lanes`, `creepPx`): the
  tier floor, `waveDepth`, `growthLength` (the HUD's countdown and the organ policy read it), the siege
  cap x5. `SimConfig.coreStage` floors the drawn core (`coreStageOf(grown, floor)`), `coreLevel` the meteor.
- **Screens** `src/ui/defenceUi.ts` + `defence.css`: the push on the globe (`pushArc` in `globe.ts`; the
  3D planet re-draws it each frame from `data-from`/`data-to` in `placeMarkers`), MASSING / THREATENED /
  UNDER ATTACK banners, the desk line, the report's lines, the Directives status. The `counter` newsreel
  and the Roach King's `counter` address fire on the staging (the telegraph).
- **Verify:** `tests/defence.test.ts`; `node tools/shot-defence.mjs` (22 checks; screenshots
  `notes/screens/2026-10-01/defence-*.png`); balance `npx vitest run --config tools/measure/vitest.config.ts
  tools/measure/defence.measure.ts` (`DEF_MEAT`, `DEF_WAVE`, `DEF_TIER`, `DEF_LANES` to sweep).

## YOKE translates the insects (Oct 1 2026)

Collins: "something in the game's lore or visuals that implies an AI is translating what the insects are saying
for you (explaining why they sound like AI)". Lore: `content/lore/ship-ai-lorebook.md` section 18 (PROPOSAL),
`insects.md` section 11. Data: `content/translation.ts` (channels, confidence, her notes, matched by words).
- **Seen** (`src/ui/translation.ts`, `.css`): a band in her console style on every leader card, the Comms inbox
  and the report's aside ("SOURCE: CARD-FIELD SEMAPHORE · 11,204 SIGNALLERS · RENDERED BY YOKE · CONFIDENCE 93%");
  the line being said resolves from its channel's glyphs in 0.45 s (none with Reduce motion); her translator's
  notes under ten lines ("[untranslatable: grief-scent …]"); Form 22-T in Comms explains the layer.
- **Heard** (`src/audio/engine.ts` `translateIn`, no files): each voiced leader line starts with 280 ms of its
  source signal (cards turning, stridulation on a radio carrier, antennal chirps, the voice box's buzz) and the
  voice opens out of a low-pass as she locks on. On the voice bus, so the voice slider rules it.
- His own lines are not translated; the B-movie opening (the locals' film) and the newsreels carry no band.
- Beat: `node tools/shot-translation.mjs [A] [B] [C] [--build]` (vite by its own script: the shared
  `node_modules` lost its `.bin` on Oct 1). Unit: `tests/translation.test.ts` (every note lands on one leader line).

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
- **Her mind: one per CAMPAIGN** (Sep 30 2026, Collins: "different games and players will have
  different memories for the ship's AI right? we are not dumping this all into one account").
  Every YOKE call carries `X-Broodfall-Campaign: campaignIdFor(state.seed)` (`PlayerLink`'s
  `campaignId`, set in `src/ui/campaignUi.ts`), and rfab.ai keeps a private copy of her Living
  Avatar brain for each (player, campaign) — a NEW CAMPAIGN is a fresh YOKE who has not met him;
  going back to a campaign is the same YOKE with its memories. rfab.ai keeps the last 5 campaigns
  per player (older ones are let go). The star agent on Collins's account is never talked to or
  changed. **The $3 free talk is per PLAYER, not per campaign** (a new campaign does not reset it).
- **Tied to his RFab account** (Collins: "it's then tied the memory to an account when the user
  logs into the rfab for the token thing"): when he links, every campaign's YOKE moves to his
  account with her history; another PC linked to the same account finds the same YOKE for the
  same campaign; unlinking leaves them with the account (this PC, a guest again, starts fresh).
  The model he picks is the account's: every campaign's YOKE moves to it. Linking reopens her
  stream with the new token (`PlayerLink.tokenChanged` → `YokeAvatarUi.reconnect`). The AI Core
  says it in one line under the account panel (`memoryText`: "She remembers this campaign. Your
  RFab account keeps her memory of your last 5 campaigns, on every PC you link.").
- **The dev fallback is dev-only:** with no player route on rfab.ai (the backend deploy owed),
  `AvatarLink` talks to the owner's star ONLY when `ownerFallback` is set, which
  `src/meta/storage.ts` `ownerYokeAllowed(base)` gives only on localhost through the `/rfab-api`
  proxy (this PC's key); the AI Core then shows **"DEV: talking to the owner's YOKE"** (one mind
  for every campaign, on the owner's money). Anywhere else that rung is refused
  (`OWNER_YOKE_DEV_ONLY`, sticky) and the ladder goes on to Kimi / scripted.
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
- **Checks:** `tests/yokePlayer.test.ts` (no network; incl. the campaign header on every call, the
  dev-only owner fallback, the stream reopened on linking); the backend's
  `_e2e_broodfall_yoke_players.js` against a local backend (two campaigns, link carry-over, a second
  install of the same account: 46/46 on Sep 30); PAID but local-only beat
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

### Streets under the creep, at any zoom (Oct 1 2026)

Collins: "there should be some clear visual distinction between lanes and roofs covered in creep even
at far zoom." Why they merged: a street is a trench one cell wide, and from this camera the block in
FRONT of it hides most of its floor (a level rises 30 px, the floor is 38 px deep), so far away a street
is seen almost only as the WALL of the block behind it, and that wall wore the same red drips as the
roofs. The fix (`src/render/laneWash.ts`, placed by `IsoRenderer.syncCreep`): every creeped street's
floor and every wall that looks down onto one is washed in a pale wet film, the walls dark under the
roof's lip and light at the foot; the roofs keep the dark hide. It fades in with distance
(`washAlpha`: none when a cell is 130 px wide or more, full at 52 px), so up close the painted floors
and walls are untouched. Units in the street are drawn over it; a block in front hides it. A floor under
a strain (bog, embers) is washed lightly so the strain still shows; a cell under a limb is not washed.
Check: `node tools/shot-legibility.mjs [--play 6000] [--nowash] [set ...]` (its own vite server, nothing
spent): every tile set, all four turns, far/fit/near shots, and per pixel (by the view ray) the walls over
creeped streets against creeped roofs at far zoom; the gap must be 60 of 255 or more. Before: wetland
8-23, suburb 42-73; after about 105-125 everywhere. Shots: `notes/screens/2026-10-01/legibility/`.


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
- **Where a limb's shot leaves it is marked by eye too** (Sep 30 2026, Collins: "the shots aligning
  with coming from where the art would indicate"). `muzzle: [[x, y], ...]` (and `backMuzzle`) on every
  limb in `FIRING` (`tools/art/limbs.mjs`), in the same box as its foot: `node tools/art/muzzles.mjs
  [family] [--back]` draws its idle frame and firing clip with a numbered grid of tenths
  (`notes/art-review/muzzles/`), read it, write the point, `--bake`. Marked at REST (the shot is let go
  as the firing clip starts; the lobber's and sling's arm swing forward during the clip, the shot leaves
  the rest pose). The renderer places it from the limb's sprite as drawn (view from behind, mirror,
  LIMB_SCALE, BIG, plinth): `mouthOf` in `src/render/isoRender.ts`; `src/render/fx.ts` starts every shot,
  beam, flame, shell and bile there with a puff, and draws a new shot AT the muzzle for its first sim
  step. The hive's guns: `src/render/unitMuzzles.ts` (`node tools/art/muzzles.mjs --units`). A new firing
  limb: add it to `FIRING` and `FIRES_FROM` (`tests/muzzles.test.ts` holds them). Look:
  `node tools/shot-muzzles.mjs [scene] --tag before|after` (`?muzzles=off` is the old way), `--sheet`, `--video`.
- **Board fix pass (Sep 30, render/input only; `node tools/shot-fixpass-board.mjs [scene] --tag before|after`).**
  The lobber and sling let go on their clip's RELEASE frame, from the point marked there (`src/render/releases.ts`,
  read by eye on every baked frame; the wind-up plays in 0.24 s, the glob flies the rest of the sim's flight).
  A limb that shoots faces its target (a LONG one flips end for end), over a right-click facing; directional
  limbs keep theirs (`facingOfLimb`). A click takes what is DRAWN in front (`toWorld`: the limb body in front
  of the block the view ray met). Web, poison and flames sit at the unit's depth (`FxLayer.statusIn`). A beat
  that clicks waits for the view to settle first (it eases for about a second after Home, a turn or a zoom).
  Beats that play while the art session bakes: `BROODFALL_PUBLIC=<a copy of public/>` (shot-iso, fixpass-board).
- **A lopsided limb has a view from behind** (`back:` on the limb says what is seen of it).
  `node tools/art/make.mjs limb <family> --stills` draws only that picture: look at it
  before paying for its clips.
- **A BIG limb** (`big: true` on the limb, `span` in `content/data.ts`; a test holds the
  two to each other) is baked from 384 px frames.
- **What is there:** 26 units (walking, five views each; the soldier also attacks), 36
  limbs (idle, and firing where they fire; 15 of them from behind too), the core, the creep, 8 tile sets, the ship
  (six rooms, planet, exterior, three faction leaders, YOKE's six faces, 14 sketches).
- **What is NOT there**: see `notes/TO-CREATE.md` (Sep 30 2026). Every unit now walks,
  attacks, flinches, dies and has its states; the HUD is the ship-console look.
- **Tile sets:** `tools/art/biomes.mjs` is the data (one entry per set: what it borrows,
  nine prompts, which territories). A campaign deployment is drawn with its territory's
  set, a skirmish with one chosen by its seed, `?biome=megacity` names one. To add a set:
  add an entry, run `node tools/art/make.mjs biome <id>`, look at
  `notes/art-review/biomes/<id>.jpg`, then `node tools/shot-biomes.mjs <id>`.
- **Drawing a tile-set picture or a strain AGAIN without touching the first** (Sep 30 2026 fix pass): list the file in the
  set's `redrawn` (`tools/art/biomes.mjs`); `make.mjs biome <set> <part.v>` then draws it into `art-src/terrain/<set>-redrawn/`
  and the bake uses it (`fileOf` in `templates/biome.mjs`). A picture only too loud is toned at the bake by the set's `grade`
  (`{ saturation, warm, light }` per file; the Deep Hive's two yellow roofs). A strain drawn again: `REDRAWN_STRAINS` in
  `templates/board.mjs` (the mire, now brown-olive rot with bubbles, in `art-src/terrain/strains-2026-09-30-b/`).
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
- **The Maw's tongue, polished (Sep 30 fix pass):** the tongue is drawn from a smooth glossy strip
  (`art-src/fx/tongue-wet.png`, `TONGUE.src` in `tools/art/templates/fx.mjs`; the ribbed first one kept in
  `art-src/fx/tongue.png`), and `src/render/mawTongue.ts` lays the rope's corners itself: thick at the lips
  (`ROOT`), tapering to `TAPER` at the club, sagging (`SAG`), the club held by its middle (`TIP_HOLD`, `CLUB`).
  (Before, MeshRope reset the width to the strip's texture height every frame, so the width set was ignored.)
  A body carried is drawn `RIDE` 1.35x as it rises (`LIPS` of that at the lips). The Maw's firing clip (an
  opaque flesh throat pouch, not the see-through bubble) and its whole view from behind (the mouth faces away:
  a rump, the gape only just showing over the hump; `backIdle`/`backFire` on the limb, honoured by
  `templates/limb.mjs makeBack`) are in `art-src/limbs/maw-tongue-2/` (`srcDir`); `maw-tongue/` untouched.
  `node tools/shot-maw-tongue.mjs --tag before|after [--dist <built dir>]` = the fix pass's before/after.
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
- **Limbs against the core (Sep 30, Collins: "the towers are too big when contrasted with the center
  node").** Every roof limb is drawn `LIMB_SCALE` 0.84 of before (big ones the same share of their 2x2),
  scaled about its marked foot; the core `CORE_SCALE` 1.22, capped so its widest stage's collar is at
  most 0.8 of its 4x4 square (`src/render/isoRender.ts`). Chosen from four pairs side by side
  (`node tools/shot-scale.mjs [limb:core ...]`, the page takes `?limbScale=&coreScale=`).
- **Walls (Sep 30, "walls way too large and placed sideways").** A Spine Wall is drawn ACROSS its lane
  at every camera turn and as wide as the lane (`WALL_TWO`, `WALL_ONE`). On a street one cell wide the
  sim lays its two cells ALONG the lane (`placementFor` falls back to that); the renderer turns the wall
  across the lane there, in the middle of its two cells. The sim is untouched (no balance change).
  Beat: `node tools/shot-walls.mjs` (and `--dist` for a before build). Gates, plinths, district faces
  and props were checked and are right.
- **The core evolves (Sep 30).** Four stages by limbs GROWN this run (`src/render/coreStage.ts`:
  0, 6, 18, 40; a look only, the sim is not touched). `node tools/art/make.mjs coreevo [--stills|--bake]`
  (`tools/art/templates/core-evo.mjs`): stage N+1's still is an EDIT of stage N's (on one canvas where
  stage 1 is the heart made smaller, so later stages have room upward; each registered to stand where
  stage 1 stands), a start-and-end clip between each pair (**seegen:sd2-fast**: sd2-mini ignored the end
  frame and zoomed in, see `art-src/terrain/core/rejected/`), a looping idle per stage, every frame keyed
  by Leaflit's studio keyer (`tools/art/lib/leaflit.mjs`). All clips are cut in ONE mapping (the meteor
  does not move between stages), baked to `board.coreEvo`. In game the growing clip plays in place with
  rings of creep running out from it. Beat: `node tools/shot-core-evo.mjs`; test `tests/core-evo.test.ts`.
- **The organ stage's meteor (Sep 30, "rendered twice, one above ground, one under").** ONE picture per
  stage of the whole half-buried meteor (`make.mjs coreevo scan [1-4]`), cut at its ground line: the top
  shows over the street (`#under-dome`), the bottom fills the 3x2 meteor cells, from the same file
  (`under.core` in the manifest). The skyline is the board's tile set in all ten
  (`node tools/shot-organ-core.mjs [--stages]`, `notes/screens/2026-09-30/organ-skylines-all-sets.jpg`).
- **The organ stage is alive (Sep 30, "should the organ screen have them alive? ... yeah").** One 4 s
  clip per scan tile (24 organs, 6 deposits, 4 features) and per core stage's scan picture, made from
  the still itself (seegen:sd2-mini, end frame = start frame, 480p, 12,320 tokens each), raw in
  `art-src/under-loops/` (the stills are untouched). `node tools/art/make.mjs underloops [ids] [--bake]
  [--reroll]` (`tools/art/templates/under-loops.mjs`) bakes each to ONE strip of 48 frames at 12 fps
  (`public/art/under/loop-<id>.webp`, `under.loops` in the manifest), brightness matched to the still
  (the model lights the scan up), played forward and back when the clip did not come back to its start.
  In game the tiles are drawn on ONE canvas under the cells (`src/ui/underAlive.ts`, 12 steps a second on
  one clock, each organ in its own phase; no layout read in its frame loop): a CSS background animation
  per cell repainted the grid every frame. The meteor and its dome step through the stage's strip in CSS
  (same phase, same frame above and below the line). The tray's cards stay still; a new organ scans in,
  then loops from its first frame. Re-rolled: womb (eggs swelled and moved), core stage 4 (the dome
  slid). Beat: `node tools/shot-organ-alive.mjs` (`organ-alive-*.jpg`, `organ-alive.mp4`).
- **Organs alive by SHAPE, not by square (Oct 1, "it animated it by square, not by organ ... animate the organs in
  their full shape, then cut them out").** Every organ of more than one cell (19: all but gland, atrophy, root,
  pacemaker, cyst) has ONE picture of the whole organ filling the box of its shape's cells (gpt-image-2 from its tile,
  `art-src/under-shapes/`; asked to paint INTO a white outline of the shape it drew another shape, so it fills the box
  and only the shape's cells are shown) and ONE 4 s loop of it (seegen:sd2-mini, start = end, ping-pong when it did
  not come back; `art-src/under-loops-shape/`), baked to a frame atlas (`public/art/under/shape-<id>.webp`, its first
  frame `shape-<id>-still.webp`, `under.shapes` in the manifest with the shape it was cut for).
  `node tools/art/make.mjs undershapes [ids] [--stills] [--bake] [--reroll] [--restill]`
  (`tools/art/templates/under-shapes.mjs`; look at `notes/art-review/under/shape-stills.jpg` and `shape-loops.jpg`).
  In game (`src/ui/underAlive.ts`) each cell of such an organ carries `data-cut` (its piece of the frame, the organ's
  quarter turns) and draws that piece turned with the organ; all its cells share one anchor, so one frame. It scans in
  as its pieces of the still (`shapeCut` in `src/ui/underground.ts`). A manifest shape that no longer matches
  `content/underground.ts` falls back to the tile loops (`tests/under-shapes.test.ts` keeps them in step). The organ
  outline and glow are a `::after` on the shape's own edges (a glow round every cell drew the squares back; a 2px
  border meeting a 1px one cut a dark notch at every row); the zones' faint ring is no longer drawn over organs (hover
  still lights the whole zone). Beat: `node tools/shot-organ-alive.mjs [--tag BEFORE|AFTER]` checks every cell of an
  organ shows the same frame and the cells meet edge to edge; `--tag` writes `organ-shape-<tag>.mp4` (close, 2x).
  Re-rolled: bladder (the clip turned the sac into a framed screen).
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
node tools/shot-anim.mjs [limbs core siege]   # VIDEOS of the idles (limbs close, core stages, a siege): notes/screens/2026-09-30/anim-*.mp4
node tools/art/idle-loops.mjs                # every idle loop measured from the atlases: loop pop (seam/step), steppiness, how much moves
node tools/shots-to-jpg.mjs                         # before committing: the beats' PNGs are ignored by git, their JPEG copies are committed
node tools/art/lib/selftest.mjs                     # the sheet cutter and the keyer (free)
node tools/shot-evolve.mjs    # EVOLVE by clicks
node tools/shot-engines.mjs   # the utility engines
node tools/shot-under.mjs     # organ stage through the real loop
node tools/shot-creep.mjs     # creep: bladder recipe, tray, thrown node, spread
node tools/shot-board-art.mjs # the board alive (DEV server): seams, pods growing/spreading, strains, gates, unclaimed city, plinth rising, fps alive vs still
# board art (pods, strains, gates, smoke): node tools/art/make.mjs board [pods|strains|gates|smoke|<set>] [--stills|--bake]  (tools/art/templates/board.mjs; renderer side src/render/boardArt.ts)
node tools/shot-preview.mjs   # a mortar's field of fire (click on it) + a conduit held and hovered (placement preview)
node tools/shot-elevation.mjs # DEV server: the reach ring before placing grows with height (+10%/level, plinths too; Sim.previewStats = the sim's own statsOf) + right-click turns any held limb (notes/screens/2026-09-30/elev-*, rotate-*)
node tools/shot-play-new.mjs  # DEV server from the menu: Scaffold + Seeding Gland grown by clicks, plinths raise a gun and level a roof, a BIG limb on it, a Seedling shot up and landed, the scripted player late (JPGs in notes/screens/2026-09-29/play-*)
node tools/shot-campaign.mjs  # NEW CAMPAIGN → mission 1 → ship (desk dark) → assigned run → win → desk opens, three calls → ally → YOKE (scripted) → globe + dare → aside in debrief + Comms
node tools/shot-audio.mjs       # DEV server: the sound played through (film, menu, ship, a run, organ stage, win/loss), buses by the meter; notes/screens/2026-09-30/audio-proof.mp4
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
- Sep 30 gap pass (royal decrees, surgery under fire, burrowing, limb kills now counted): naive
  hold-12 **5/10** (6/10 at the start of the pass), guardrail flips 4:0. Ablations and what each new
  mechanic did per seed: `notes/GAPS-2026-09-30.md`; measure with `tools/measure/gaps.measure.ts`
  (`GAPS_MODE=nograft,surge` for the ablations).
- `threatPerTier` 21, tier 6 at 192.
- Always measure over 10 seeds, never 3–4. ITERATION addenda 3–20 carry the tuning history.

## Backlog (in rough order)

1. (Done Sep 30: **royal decrees**, the royal special-upgrade sinks; DESIGN "Royal decrees".
   The whole gap audit and what is left is `notes/GAPS-2026-09-30.md`.)
2. **The lore book** — only when Collins brings it up.
3. (Done Oct 1 2026: **streets told from roofs under the creep at any zoom**, the street wash; "The art", "Streets under the creep".)
4. (Done Sep 30: **burrowing** out of a body that walled itself in; DESIGN plate algebra.)
5. (Done Sep 30: **civilians** fleeing the crash, `src/sim/civilians.ts`.)
6. **The rest of the art**: see `notes/TO-CREATE.md` (Sep 30 2026).
   - **The first LONG limb** (longer than it is wide, turned to fit): the rule is built and
     tested and no limb uses it. Collins asked for turning to fit; which limb is his call.
   - **Props do not turn with the camera:** a roof prop or a parked car is one picture, seen
     the same from all four sides. Walls and floors are right from every side.
7. (Done Sep 30: **surgery under fire**; DESIGN "Cannibalize-to-modify".)
8. **Campaign polish found in the audit, not yet asked for:**
   - (Done Sep 30: all three factions call when the Directive Desk opens.)
   - (Done Sep 30: asides in a seeded order, `asideIndex`.)
   - Left, with reasons: `notes/GAPS-2026-09-30.md` items 18-26 (crash biome economy bias, territory
     standing bonuses, territory tier and the waves, the courier's trail, Royal Diet's wording, the
     Seeded Meteor in the campaign, two standing systems).
   - (Done Sep 30: the globe is a 3D planet, `src/ui/globe3d.ts`.)

## OPEN — Collins's calls on the art (none of them blocks play)

1. **(DECIDED Oct 1 2026) Ordinary soldiers do NOT shoot limbs on roofs.** Collins: "only science attacks limbs". War bodies keep walking past roof limbs; the science caste is the one that goes after them. Still to confirm with him: the war SPECIALISTS that hit limbs on blocks today (sappers, mortar beetles, siege cannons, bombers).
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
9. **(Done Sep 30 2026, art fix pass.) The quarters' picture and the partner's portrait** are made:
    `node tools/art/intro.mjs quarters partner` (`PICTURES` there; raw `art-src/intro/pictures/`, baked
    `public/art/intro/quarters.webp`, `partner.webp`, the `quarters`/`partner` keys of `intro.json`). The room picture keeps
    what matters in its LEFT third (`src/ship.css` shows a room from its left edge; the card covers the rest). Beat:
    `node tools/shot-quarters.mjs`. Collins's call: whether Maren Oste looks like the woman he had in mind.
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
