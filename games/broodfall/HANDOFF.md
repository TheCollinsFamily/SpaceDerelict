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

## The cut scenes as films (Oct 3 2026; Collins wrote every faction scene himself)

Read `notes/CUTSCENES-2026-10-03.md` first: his text word for word, what was built from it, what the test film cost,
and what is his to decide. DESIGN.md "THE CUT SCENES, AS COLLINS WROTE THEM" is the rule; `notes/CAMPAIGN-BEATS.md`
is the story as played.

- **The words:** `content/campaign.ts`. Each faction has `contact` (its signal's card: YOKE's words, no leader speaks),
  `signal` (where on the globe, what it is), `beats` (the first is the FIRST INTERACTION), `pledge` (his broadcast when
  he sides with them), `ending` (the finale: ending and reveal in one). `reveal`, `afterReveal`, `endingByChoice` and
  the perks `kingdom` / `pacified` are gone. A line of a filmed scene is at most 22 spoken words and has no word in
  capitals (`tests/cutscenes.test.ts`).
- **The rules:** `src/meta/campaign.ts`. `meet(s, id)` plays a first interaction without siding (no perk; `met` on the
  save); `ally(s, id)` sides publicly (queues the first interaction if it was not played, then the `pledge`); the three
  are `contacted` when the desk opens and nothing is queued for them. `objectorPool(territory)` is what the Objectors
  may pick from. A save from before, with the three contact calls waiting, drops them (`withoutCalls` in the UI).
- **The screens:** `src/ui/campaignUi.ts`: `signalsHtml` (the three cards at the desk), the `.signal` markers in
  `globeSvg` (moved by `src/ui/globe3d.ts` placeMarkers from `data-at`), `sceneHtml` (kicker, perk, the film's poster,
  THE WORDS folded), `playSceneFilm` (a waiting scene's baked film plays once by itself; the poster plays it again),
  `objectorsHtml` (the pick at DEPLOY). `src/ui/cutscene.ts` is the film player (`#newsreel.cs-film`: one baked file,
  its sound through the voice bus, the cue's line in type; Esc / click / Enter / Space skip; under automation only with
  `broodfall-media-auto` = on). YOKE's announcement: `content/greetings.ts` `unlock` (four beats after Collins's three).
- **How a film is shot (Collins, Oct 4 2026; DESIGN.md has his words):** ONE camera position per place, BEHIND HIM
  (over his shoulder; his face is never seen); EVERY clip goes on from the frame the one before it was cut on; his
  feelings are in his VOICE. The first test film cut between front shots of him and of her: he rejected it ("too much
  jumpiness and character inconsistency"). Do not go back to shot / reverse-shot.
- **The films:** `content/cutscenes.ts` (`STILLS`: 21 pictures, one per place; `FILMS`: 19 shot lists: the factions' 16
  and the Roach King's 3; `you(voice)` is one of his lines, `they(action)` one of theirs, each taking the next line of
  its scene and going on from the shot before (`'^'`); `at(still, shot)` starts a new place; `cut(...)` is a shot with
  no words). `tools/media/cutscenes.ts`: `list | stills | clips | start | check | sheet | redo | bake | desk | prompts |
  stillprompts <film>`. `clips <film>` runs IN ORDER: each clip is transcribed, cut 0.55 s after its last word on a
  whole frame (`<shot>.cut.json`), and the frame at the cut is the next clip's first frame. `clips <film> <shot>` makes
  one. `redo <film> <shot>` moves that clip AND every clip that went on from it aside (`vN/`).
- **A CHAINED TAKE ROTS UNLESS IT IS HELD (four takes of the first film, Oct 4 2026; all in the tool now):**
  1. **Colour.** Whatever the model does to the colour in a clip is handed on with the frame: after twelve links the
     blue channel's contrast was 1.46 times the first frame's. Each clip is measured at its cut against its take's
     first frame, the next clip's start frame is corrected back (`fix` in the cut file), and the bake ramps the same
     correction over the clip. Measure: `node tools/measure/cutscene-drift.mjs <film>` (now 0.97 to 1.07 all the way).
  2. **What drifts through the air.** A hologram sheds soft motes and a happy crowd grows confetti; each clip adds to
     the last, and by the tenth the hotel room was in a snowstorm. They move and the room does not: the start frame is
     compared with the median of its neighbours in time and given the median wherever it is brighter (`undrift`), but
     not where the brighter pixels are dense (an arm of light that moved: that rubbed the hologram out). A point filter
     and "no sparkles, no snow" in the prompt did NOT work; naming them may feed them. The prompt now says what the air IS.
  3. **His face.** Told only about him in his own line, the model turns him round to show who is speaking (profile, and
     once a solid man). His hologram gets NO gesture (`you(voice)`: he stands still), and his prompt gives the movement
     to his LISTENERS (they nod). It still happens about one clip in six, so:
  4. **Look at every link before the next is made from it.** `clips <film> <shot>`, look at five frames of it, then the
     next; a bad clip is made again alone (nothing was built on it). Making all thirteen and looking afterwards cost
     three takes. This is by eye today; a vision check per link would let a take run unattended.
  `clips` also stops a take when a clip's SPECKS at its cut pass 1.6 times the take's first frame. Raw: `art-src-new/cutscenes/` (stills are shared between films;
  clips per film; v1/ holds what was remade). Baked: `public/media/scenes/<film>.mp4` + `.webp` + `scenes.json` (its
  OWN manifest: the bake never touches media.json or roach.json).
- **Made:** `delegation-understand`, twice. The first try (Oct 3: 14 shots intercut, 88.6 s, about $8.80) is kept raw in
  `art-src-new/cutscenes/delegation-understand-first-try-intercut/`. The one in the game is the remake of Oct 4 to his
  rules: 1 picture, 13 shots in one take, 81.8 s. The clips in it are about $5.60; the four takes it took to learn the
  list above made 49 clips, about $26.50 (the set-aside ones are in `art-src-new/cutscenes/delegation-understand/v1..v6/`).
  Stills on `seegen:gpt-image-2` at medium (4,000 tokens), clips on `imagerouter:veo-3.1-lite-i2v` with sound at 720p
  (about 3,850 tokens a second of clip). Words heard: every line 83% or more (the two lowest are an "Um" and a "Yes!"
  the transcriber did not write). Pitch: he 109-136 Hz, she 176-271 Hz (her greeting is the high one). NOBODY HAS LISTENED
  TO IT: an agent cannot.
- **What the checks cannot see:** `check` hears the words and measures each speaker's pitch. It did NOT see the chief
  delegate's head turn human for a second in the first take of the opening shot. LOOK at every clip one frame a second
  (`ffmpeg -i clip.mp4 -vf fps=1,scale=400:225,tile=8x1`) before baking. And nobody has LISTENED to the voices: I cannot.
- **Beats:** `node tools/shot-cutscenes.mjs --build` or `--dev` (46 checks: the whole new path by clicks, then the breaker: old saves, double clicks, the pick abused; screenshots
  `notes/screens/2026-10-03/cutscenes-*.jpg`). `shot-campaign.mjs`, `shot-midpoint.mjs` and `shot-onboarding.mjs` were
  moved to the new path (signals, answer, side, the Objectors' pick at DEPLOY). `shot-ship.mjs` and `shot-alive.mjs`
  check scene PICTURES, and no scene names one now: their scene parts pass over nothing.
- **Retired, still on disk:** the four ending films and three reveal pictures (`ENDING_FILMS`, `REVEAL_PICTURES` in
  `content/media.ts`; `tests/media.test.ts` keeps them whole), the 18 scene pictures and their loops, the scene voices.
- **Found red and mended on the way (not this work's):** `tests/mules.test.ts` "grows a sac and roots mules in a real run" failed before any of
  this (its seeds 4, 1, 3 stopped rooting a mule when the land and the domes changed every run's course); of seeds 1-12 the
  scripted player now roots one only on 10 and 8, and the test uses those. Two in twelve is thin: the mules' owner should look.
  `npm run build` was also red (two untyped .mjs imports in `tests/speakable.test.ts`); it builds again.
- **Owed:** the other 15 films (after Collins has heard the test); the last mission against the Roach King (not
  written); the asides, midpoint cards, the Delegation's clipping and the Roach King's wheat line still speak of the
  scenes before (all voiced: a changed word is a new take).

## The last mission, and the Roach King off the air (Oct 4 2026)

Collins's text is in `notes/ROACH-KING-2026-10-04.md`; the design and the open decisions in DESIGN.md "THE LAST MISSION,
AND THE ROACH KING OFF THE AIR".
- **Content:** `content/roachKing.ts` `ROACH_SCENES` (three Scenes: `rk-briefing`, `rk-transports`, `rk-founding`; each
  names its film); `content/cutscenes.ts` (their shot lists and pictures `rk-office`, `rk-call`, `rk-steps`; refs `king`
  = `art-src-new/roach/stills/close.png`, `flag`); `content/translation.ts` (Aide and General on his channel; two notes);
  `content/campaign.ts` (`LAST`, `LAST_MISSION`, the territory `hive-house`, `last: true`); `content/data.ts` `COURT_WAVES`.
- **Rules:** `src/meta/roachKing.ts` (`dueScene`, `dueAfterDeployment`: the briefing before his ordinary addresses, never
  before his introduction; `lastMissionScenes`); `src/meta/campaign.ts` (`finale`, `targets`, `plan`'s three config
  fields for the last landing, `ended` at its win, `migrateFinale`); `src/meta/defence.ts` (never a staging ground).
- **Sim:** `SimConfig.lateHost / startShelter / shelterRation` (`src/sim/types.ts`); `src/sim/sim.ts`: `courtWaveAt`,
  `waveComp`, `hostTurnsLeft`, `raiseStartShelter`, `takeShelter`, the ration in `payShelters`, the tier floor once the
  Host is due; events `shelter-start`, `host-arrived`, and `court` / `hostIn` on `wave-start`.
  `src/sim/autoplayer.ts`: while the Host is late the scripted player grows limbs before organs (it starved otherwise:
  it spent the ration on organs and stood with no limb).
- **UI:** `src/ui/roachKing.ts` (`playRoachScene`: the film, or the transcript; `roachBeforeLastMission`;
  `roachAfterDeployment` plays the briefing); `src/ui/campaignUi.ts` (`launch`: the last mission is launched through
  the two scenes; `lastMissionHtml` on its briefing; ONE LANDING IS LEFT; the ♛ on the planet); `src/ui/hud.ts` (the
  countdown in the order, short enough to be read whole); `src/main.ts` (banners).
- **Tests:** `tests/lastMission.test.ts` (10), `tests/territoryPictures.test.ts` (18), `tests/roachKing.test.ts` (5 more), `tests/cutscenes.test.ts` (19 films).
  **Beat:** `node tools/shot-lastmission.mjs --build` (58 checks; `BEAT_TRACE=1` prints where it is: the briefing after a deployment; the desk, the
  briefing, the call, the address, the mission with its shelter, countdown, court waves, ration and the Host's arrival,
  the campaign complete; a second try goes straight in). **Measure:** `npx vite-node tools/measure/last-mission.measure.ts`.
- **The small open items, closed later on Oct 4** (Collins: "do the stuff that needs doing"):
  - *The Hive House has its picture and its loop.* `tools/art/templates/ship.mjs` TERRITORIES `hive-house` (the
    President's house dressed for a parade, the parade ground empty), `tools/art/stills-alive.mjs` `territory:hive-house`.
    The loop's first take tilted the camera up: its prompt asked for rolling clouds, of which the cut shows a sliver
    (kept in `art-src/stills-alive/territory/v1/hive-house-clip-tilted.mp4`; maxStep 19.6 where the others are under 1.2).
    The clouds are out of the prompt; the second take measures like the others.
  - *A territory named by id is baked ON ITS OWN:* `node tools/art/make.mjs ship hive-house` (ship.mjs `bakeTerritories`).
    The whole bake (`bakeShip`) builds the ship's entry again from every raw picture in `art-src/ship`, so in a worktree
    that has none of them it would empty the entry. The raw pictures are in the MAIN checkout's `art-src`, so from a
    worktree: `BROODFALL_ART_SRC="C:/Users/Merry/dev/space-derelict/games/broodfall/art-src" node tools/art/make.mjs ship <id>`
    (the same for `stills-alive.mjs territory:<id>`).
  - *`tests/territoryPictures.test.ts`* fails for any territory in `content/campaign.ts` without its picture and loop
    (the Hive House was added without one and nothing said so).
  - *Banners are read whole.* Every banner was one line whatever its length (`white-space: nowrap`), so a long one was
    cut at both ends: twelve of the twenty in `src/main.ts` are longer than 1280 px holds. A banner now wraps inside 94%
    of the picture, a long one (over 40 letters) is set smaller so it is two lines at most, a dash never starts a line,
    and it stands 1.2 s + a twentieth of a second a letter (2.6 to 7 s). `src/main.ts` `banner`, `src/style.css`,
    `src/hud/themes/ship.css` (`#banner.long`).
  - *The board points at the shelter that stands from the start* until the first wave is under way: `sim.openingShelter`,
    drawn in `src/render/isoRender.ts` `syncShelters` (a breathing ring round its lot, a chevron over its roof).
  - *The organ stage says what the ration is for* while the Host is late (`src/main.ts` `openUnder`; `#under-note`).
  - The beat is 58 checks now (`b7-start`, `b7b-organ-stage`, `b7c-shelter-marked`, `b2-brief-alive`).
- **Not done:** the three films (the shot lists run: `npx vite-node tools/media/cutscenes.ts -- prompts rk-briefing`);
  no landing film of its own for the Hive House (it takes the deep hive's tile set); the Roach
  King is not on the field; his profanity may be refused or mangled by the video model's voice (untested).

## The campaign (built Sep 28; audited against Collins's words the same day)

(Oct 3 2026: the contact calls, the scene cards' pictures and voices, the ultimatum's choice, the ending films and the
reveal cards described below were replaced by Collins's cut scenes: the section above.)

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
  scratches; ONE file with its whole mix (theremin/brass score, the trailer narrator's three lines (he stops at the sky; after the impact only sound: Collins, Oct 1 2026), plate, scream, crowd, the Watch's steps and radio, the heartbeat,
  siren, the game's own land-roar/land-impact; -14 LUFS): `public/art/intro/bmovie.mp4` + `bmovie.json` (shot times,
  `cardAt`, the two opening titles the game sets in type; none after the impact). Night 0 at the Crash Site in the Suburbs set ("Luckwell Gardens",
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
- **Spoken words are never in capitals** (Oct 1 2026): a video model (Veo) reads an all-caps word as an acronym and spells
  it (the film's first cut: "nothing E V E R happens", "out of the S K Y"). Write the line in normal case and put the stress
  in the prompt. Guards: `speakable` in `tools/art/bmovie.mjs`, `assertSpeakable` in `tools/media/lib.mjs` (used by
  `tools/media/make.ts` and `tools/media/roachking.ts`), test `tests/speakable.test.ts`. Audit:
  `npx vite-node tools/media/caps-audit.ts -- --hear` lists every spoken line with a word in capitals and transcribes
  its baked take; on Oct 1 2026 all 33 (the Voice, the Director, the Delegate, the Roach King) came back as words.
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
- ~~**Meat drops**~~: REMOVED Oct 1 2026 (Collins: "the meat moving to the tower center looks weird ... the meat thing
  is silly"). The creep digests the dead instead: see "The creep digests the dead (Oct 1 2026)" below. `meatFx.ts`,
  `tools/art/meat.mjs`, `public/art/fx/meat.webp` and the manifest's `fx.meat` are gone.
- **Beat:** `node tools/shot-ship-loops.mjs [rooms globe]` (own dev server 5289, GPU flags):
  `notes/screens/2026-09-30/ship-loop-*`, `globe-*`.

## The creep digests the dead (Oct 1 2026)

Collins: "have a death image of the unit, then it dissolving, then gone ... and have corpses pile up where there is no
creep, then dissolve when the creep reaches them." Meat is banked ONLY when the creep digests a body (the rule, not a
toggle; DESIGN.md "The creep digests the dead" has his reasons and the numbers).
- **Sim:** `src/sim/sim.ts` `killEnemy` lays a `Corpse` (`src/sim/types.ts`) with the meat decided at the kill;
  `updateCorpses` starts digesting one whose cell `isCreeped`, banks it after `corpseFallSeconds + corpseDigestSeconds`
  (0.7 + 1.6, `content/data.ts`) through `bankMeat` (wallet, `digested`, `scienceBanked`, `banked` events), then emits
  `digested`. Off the creep it waits (never rots). Caps: `corpseCellCap` 4 a cell and `corpseBoardCap` 160 loose, past
  which the oldest fold into the cell's heap (`heap`, `kinds`; meat summed). A Maw's swallow banks at once. A thief's
  stolen meat is still handed back at its death. `unclaimedMeat()`; `stats.bodiesReclaimed` (Requisition "Form 4-R").
- **Render:** the death picture is each unit's own `death` clip (all 26 kinds have one, so NO new art: $0). `isoRender.ts`
  `syncDying` keeps the fallen as their corpse: re-placed every frame (they stay put when the camera turns), sunk,
  darkened to the creep's red and faded as the sim digests them; heaps draw up to 3 more bodies; a corpse the renderer
  never saw fall is laid as its last fall frame. `src/render/corpseFx.ts`: veins and bubbles while it dissolves, a pulse
  to the core when it is gone, and an unclaimed-meat glint (caste colour; royal, then science, then war) on a body off
  the creep. Reduce motion (`CALM.motion`): no bubbles, no pulses, a steady glint. The feed: a kill says "specimen
  neutralized", a digested body "resource acquired".
- **Checks:** `tests/corpses.test.ts`; `node tools/shot-corpses.mjs` (own dev server 5343) ->
  `notes/screens/2026-10-01/corpses-*.jpg|mp4`; `tools/measure/corpses.measure.ts` (meat by caste, banked vs unclaimed,
  bodies that fell past the creep and how long they waited).

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

## The limb art pass: limbs drawn for their ground, and their upgrade looks (Oct 2 2026)

Collins, of the class-zero footprints: "ok this is WAY better, redesign the art around this" and "the inexpensive
4-square thing is ok ... an unusually cheap, even for its low power, tower where what you 'pay for' to use it is
early-game space". And: "keep the original art in case we use it for something else".

- **Applied in the game** (`content/data.ts`): lines of three (Impaler, Creep Lance, Ember Sac, Resonance
  Amplifier), T (Frond, Choir, Blight Vent), elbows of three (Quill, Conduit), L of four (Snare Bed, Meat Press), the
  Bombard a 2x2; the Ward back to one square (pre-Sep-29 stats); the Caustic Mister stays a 2x2 at 6 war (cheap
  ground). Stats otherwise unchanged (measured: paying for ground made it too easy). The Amplifier works on EVERY limb
  touching its length (`engine.touch`, `Sim.touchingLimbs`, `Sim.engineTargets`). Measured: naive hold-12 5/10,
  guardrail 3:0. DESIGN.md "Shaped footprints".
- **The old art is kept:** `public/art/limbs-legacy/<family>/` (atlases and upgrade looks of the 19 limbs redrawn)
  with their manifest entries in `public/art/limbs-legacy/legacy-manifest.json` (`node tools/art/archive-limbs.mjs
  <families>`; never moves or deletes). Raw: the old drawings stay in `art-src/limbs/<family>/`; a redrawn limb draws
  into `art-src/limbs/<family>-ground/` (its earlier takes kept in `v1/`..`v5/`).
- **Drawn for its ground** (`node tools/art/make.mjs shaped <families> [--stills|--bake]`,
  `tools/art/templates/limb-shaped.mjs`, `tools/art/lib/plate.mjs`): a raised SLAB of the footprint seen as the board
  sees it is EDITED into the limb (told which way each arm reaches across the picture; a long limb's slab has a hole
  at its front end). Its views: front and back; an elbow or an L also its two sides (`side`, `backside`: mirrored it
  would stand on the wrong cells; `limbSideOf` in isoRender shows them). Where it stands is the slab found again in the
  drawing (`fitPlate`, `feet.json`); where it fires from is found in the picture (`muzzles.json`: a line's front
  end, else its peaks). The renderer lays a plated limb's slab on the picture of its cells (`plateOnBoard`).
  `limbs.mjs` GROUND holds each one's shape, look (the look-alike fixes: Vent a chimney, Ember a nozzle on a sac,
  Lure a squat pitcher, Ocular a tall periscope, Press a screw press, Conduit a bent pipe, Reliquary a sealed casket,
  Lobber a sac on a sling arm), and its own back words where the model got the back wrong. `drawFrom: 'back'` draws
  the back first and the front from it (the Frond, Collins: "the front is bad and does not look like the back").
  **Before baking any limb, look at `notes/art-review/limbs/shaped/<family>-views.jpg`: every view must be ONE
  object** (Collins: "the front and the back don't look like the same thing").
- **Redrawn and baked:** Choir (its v4 back, Collins's pick), Impaler, Lance, Ember, Amplifier, Frond, Blight Vent,
  Quill, Conduit, Snare Bed, Meat Press, Spore Bombard, Lure, Ocular, Reliquary, Lobber. Screens:
  `notes/screens/2026-10-02/limbart/` (`node tools/shot-footprint.mjs --plan --out ...`).
- **Upgrade looks a limb can reach** (`node tools/art/make.mjs looks <families> [--only=..] [--stills|--bake]`,
  `tools/art/templates/limb-looks.mjs`): REACHABLE (held to the codex by `tests/looks.test.ts`), the class words of
  notes/UPGRADE-LOOKS.md on each limb's working part (`part` in limbs.mjs), every view, marks carried from the limb
  (no marks by eye), `ground: true` in the manifest (a redrawn limb keeps only the looks drawn for its ground).
  Drawn: the 45 looks of the 18 one-cell limbs that were not redrawn. A limb whose back picture was not recovered gets
  its looks' backs as a half-turn of each look's front. Review: `notes/art-review/limbs/looks/`.
- **The Meat Press redrawn for its L** (Collins: "one is not fitting its grid"): housing on the bend, a raised feed
  trough along the long arm, a collecting vat on the short arm, every cell standing something; its acting clip keeps the
  marrow inside. Its old look (bone) moved to `art-src/limbs/press-ground-looks-old/`.
- **The reshaped limbs' upgrade looks: PAUSED** (Collins has not answered whether the reshaped limbs become taller and
  lose their always-on outline; nothing is to be drawn twice). Their pictures are drawn (94, the working part risen off
  the slab; `notes/art-review/limbs/looks/<family>-stills.jpg`) and 33 were animated before the pause; ALL are held
  out of the manifest until he answers (raw in `art-src/limbs/<family>-ground-looks/`; `node tools/art/make.mjs looks
  <family> --bake` puts a finished one back). Several tall ones go out of their clip's frame: re-roll those first.
- **Not done yet:** the Brood Pit's looks (its raw art is only in art-src-new).

## Footprints: every shape, and the plan for which limb takes which (Oct 1 2026)

Collins: "the total lack of diversity in footprint ... is kind of a KEY part of tower defence strategy ... one
square (hugely over-represented), two squares (line), four squares (large square), T-shaped (usually for very
powerful area-effect things), L-shaped (like an elbow shape)". DESIGN.md "Shaped footprints".

- **Built (engine):** `src/sim/footprint.ts` (SHAPES: `line3`, `T`, `L3`, `L4`, `S4`; rectangles stay `span`), a
  `shape` on TowerSpec, `Sim.cellsFromFirst` / `Sim.hubPos`, placement, turning, eating, recovery by a collector,
  the scripted player; the ghost and the outline of a shaped limb's ground (`src/render/render.ts`,
  `isoRender.ts limbSizeFor`); R / Shift + R / Shift + wheel / the TURN LIMB button (`index.html #place-turn`).
  `?tryShape=<limb>:<shape>` tries any limb on any footprint. **No limb is shaped yet:** the game plays exactly as
  before (gaps measure, 10 seeds: the same ten lines before and after, 5/10).
- **Kill credit (a measurement fix):** a kill by poison, fire, a cloud or a swallow is now put down to the limb
  that caused it in `stats.killsByFamily` only (`killEnemy creditId`); `Tower.kills` (Consort's Favour, the
  scripted player) still counts direct hits, so no play changed. Maw 0 → 154 kills, Blight Vent 21 → 88.
- **The plan (for Collins, not applied):** `notes/FOOTPRINT-PLAN.md` and the limb decision sheet
  (https://claude.ai/artifact/G1XVCeZcLdEPx1QfQ2ny7g, "Footprint plan" + a Footprint column + "Resolved by" on every
  old flag). Data `tools/codex/plan.mjs`; counts `tools/codex/planDump.ts`; shape fit
  `tools/measure/shapefit.measure.ts` (`notes/limb-codex/shapefit.json`); balance
  `MEASURE=plan,planLines,planT,planL,planSquare ... tools/measure/footprints.measure.ts` (results in
  `notes/limb-codex/footprint-measure.txt`). Rebuild: `node tools/codex/sheet.mjs`.
- **Screens:** `node tools/shot-footprint.mjs` is the ENGINE TEST (every shape on one placeholder Spitter;
  `notes/screens/2026-10-01/footprint-ENGINE-TEST-sheet.jpg`); `node tools/shot-footprint.mjs --plan` shows each
  multi-cell or reshaped limb on its own proposed shape (`footprint-PLAN-sheet.jpg`).
- **Plan (Oct 2, class zero; supersedes the Oct 1 and first Oct 2 drafts):** Collins: "We need some line of 3, T of 4,
  elbow of 3, L of 4 ... it's class zero of tower defence." The footprint is a placement puzzle; the art is redrawn to fit
  it. Lines of 3: Impaler, Creep Lance, Ember Sac, Resonance Amplifier (now buffs what touches its length: a mechanic
  change). T: Galvanic Frond, Choir Node, Blight Vent. Elbow of 3: Quill Fan, Marrow Conduit. L of 4: Snare Bed, Meat
  Press. 2x2: Maw, Den, Trap Cage, Spore Bombard. Lines of 2: Spine Wall, Skipping Mortar. One square: 21, including
  the Caustic Mister and Ward Membrane (back from 2x2). Measured (`MEASURE=plan4none`): with stats unchanged 5/10,
  guardrail 3:0 (today 5/10, 4:0); paid for ground it is too easy (7/10). Not applied: `?tryShape=` plays it.
- **Applying a shape to a limb** (when Collins decides): `shape: 'L3'` (or `span`) on it in `content/data.ts`, paid
  for its ground as the BIG limbs were (the K table in footprints.measure.ts), its art redrawn for the footprint
  in the same pass as its upgrade looks (the plan's cost), then the measures.

## Brood Pit, Broodmother Den and orders (Oct 1 2026) — DESIGN.md "YOUR WALKING UNITS"

Collins: Brood and Broodmother Den different, one spawning fighters from your base, the other a Broodmother
with a brood mode and a fighting mode (a net); "Broodmothers and brood output should be selectable" and orderable.
- **Sim** (`src/sim/sim.ts`, "your walking units"): `sim.mothers` (Broodmother units), `updateMothers`,
  `updateBroodlings` (orders first: move, attack, hold, return; else guard a post), street routes for orders
  (`unitFlowTo`, a cached BFS per target cell), `bodyPoint`, `rallyOf`, `nearestStreet`, `castNet`,
  `parkedMotherNear` (siege fire singles out a PARKED mother). Commands: `unit-order` (ids, order, queue),
  `mother-mode`, `mother-net`, `set-rally`. Types: `Broodmother`, `UnitOrder`, `BroodSnap` in `src/sim/types.ts`.
  The Den keeps its family id `brood`; the Pit is the new family `hatch` (content/data.ts, upgrades, limbText,
  upgradeLooks, the Brood Womb theme unlocks it). Warriors and mothers OUTLIVE their limb (BroodSnap).
- **UI** (`src/ui/command.ts`, wired in `src/main.ts`): click / Shift-click / drag a box; right-click a street =
  move (Shift queues); A attack-move, H hold, B body, G guard, T mode, N net, Ctrl+1..5 / 1..5 groups, Esc; the
  panel `#unit-cmd` (bottom left) does the same with buttons; with a Pit's or Den's panel open, right-click a
  street = its rally point, R = select its brood. The board draws rings, egg counts, the net's reach, orders,
  rally flags and nets (`IsoRenderer.drawCommand`). The top-down view has none of it (iso only).
- **Art** (raw in `art-src-new`, via the new `BROODFALL_ART_SRC` setting in `tools/art/lib/manifest.mjs` and
  `tools/art/rfab.mjs`): the Broodmother unit (`tools/art/units.mjs` ALLIES `broodmother`, walk + attack, 46/46
  checks) and the Brood Pit limb (`tools/art/limbs.mjs` `hatch`, drawn alone, idle/fire/die, 13/13 checks). The
  Pit's donor part borrows the Den's eggs (`part-hatch` in the manifest; its own prompt is in fx.mjs PARTS: a
  parts bake from art-src-new would drop it until it is drawn). The Den's own picture is still the old sac.
- **Tests** `tests/brood.test.ts` (13); the old Broodmother test now uses a Pit. **Beat** `node tools/shot-brood.mjs`
  (real clicks, keys and a drag; films `notes/screens/2026-10-01/brood-orders.mp4`).
- **Measure** `GAPS_MODE=denheavy|stack` in `tools/measure/gaps.measure.ts` (dens dealt ×3; `stack` also turns
  on `Autoplayer.stack`: park her on the quietest street near the body, brood, release a full stack at the siege).
  Oct 1 2026, 10 seeds, hold-12: before 5/10; after, naive **5/10** (the same ten outcomes), den-heavy 5/10,
  stack **5/10**. The five losses fall at waves 7-8, before any den is grown, so no brood policy moves them.
  What the stack changes in the five wins: its brood kills 38-89 a run (den-heavy, parked by the den: 6-32);
  Broodmothers lost 0-1 a run (parked by the den: 3-16); up to 229 warriors born (they die fighting). Strong,
  and answerable: mortars, war cannons and darts single out a parked mother; warriors ignore the science caste.

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

### Streets under the creep: their own colour (Oct 1 2026)

Collins asked for "some clear visual distinction between lanes and roofs covered in creep even at far
zoom", then REJECTED the first fix (a pale wet film over the trench): "now lanes look like they have no
creep in them always, this is bad. They need to have creep, just be visually distinct (like make it a
different color, yellow or something) ... because sometimes creep has effects on things walking over it."

So creep on a street is the SAME skin as on the roofs (veins, cells, ragged edges), recoloured at load
through a pus/sulfur-yellow ramp by its own lightness (`src/render/streetCreep.ts`; `BoardArtSet.streetSkin`
recolours the creep atlas once; `IsoRenderer.syncCreep` lays it, nearly opaque). Three states never
blur, at any zoom: a BARE street (the tile set's ground), a CREEPED street (yellow creep), a CREEPED roof
(the dark red hide). Why the walls too: a street is a trench one cell wide, and the block in front of it
hides most of its floor (a level rises 30 px, the floor is 38 px deep), so far away a street is seen
mostly as the wall of the block behind it. A wall looking down onto a creeped street wears the yellow
creep as a coat, shaded under the roof's lip (`wallCoat`), fading in with distance (`coatAlpha`: none at
130 px a cell and wider, full at 52 px); up close the painted wall and the roof's red drips are seen.
Strains (bog, embers) lie over the yellow at 0.68 on a street, so a strained street reads as both.
Under a limb standing in a street the skin stays the hide. Picking the colour:
`notes/screens/2026-10-01/street-creep-candidates.png` (ochre-orange reads as embers and the war caste's
orange, acid green as bog and the suburb's olive squares; the yellow was pushed toward sulfur to clear the
deep hive's honey ground). Check: `node tools/shot-legibility.mjs [--old] [--play 6000] [--creep N] [--debug]
[set ...]` (own vite server, nothing spent): every set, all four turns, far/fit/near; each pixel classed
by the view ray as bare floor, creeped floor, wall over a creeped street, creeped roof; colours compared
in Lab, every pair at least 25 dE (walls at far and fit). 120/120 pass; `--old` (the thin red film
before) fails all 120, bare/creeped street 2-8 dE. Sheets: `notes/screens/2026-10-01/street-creep-*.jpg`.

Oct 2 2026, Collins: "the creep has little tendrils at its edges, but they don't change colour on the trail
like the rest of the creep." The animated tendrils `CreepLife` lays over a cell's open edges took the red
sheet always; a skin on a street now carries `street` and its tendrils are recoloured with it
(`BoardArtSet.streetSkin('tendril-…')`); a street cell under a limb is yellow too. Roofs keep the red.
NOT creep and left red: the core's ground roots (`coreGround`, the landing site's own picture) that reach
over the streets round the core; Collins's call if he wants them yellow on streets. The check: with
`--creep 3` (12-16 street tendrils on seed 42) the fringe of every street (both sides of the creep's edge)
is captured with and without the tendrils, the roots hidden in both; of the pixels the tendrils change,
at most 10% may be red-brown (limbs, units, townsfolk and the core masked by their drawn bounds; the skin's
pulse frozen between the two captures). All ten sets, four turns, three zooms: before (`--oldfringe`) 43-99%
red, 120 of 121 frames fail; after 0%, all pass. Known soft spot (not this change): megacity at turn 1, far
and fit, bare street vs roof measures dE 18-20 (its few bare samples fall in deep shadow); by eye they differ.
Crops: `notes/screens/2026-10-02/street-creep-tendrils-before-after-zoomed.jpg`.

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
- **A wall crosses the WHOLE street (Oct 2 2026; Collins: "just cross the street between two points (given that the street
  can be both shorter and longer than two units)").** `Sim.wallAcross` takes every street cell across the lane at the cell
  pointed at, building edge to building edge (1, 2, 3+ cells), capped at `WALL_MAX` = 4 round that cell (wider runs are
  junctions or squares). Price `Sim.wallCost`: 10 war up to two cells, +5 a cell past that; body `Sim.wallHp`: 520 hp + 312 a
  cell (832 on two, as before). The placement hint shows "SPINE WALL · N wide · hp · war". A wall 3+ wide is drawn as ONE wall
  from its own picture (`IsoRender.tileWall`: two end-caps against the buildings, tiled middle strips), at every turn.
  Tests `tests/wallsAcross.test.ts` (1/2/3-wide, every turn, capped junctions); shots `node tools/shot-walls.mjs --tag across
  --turns 2` (`notes/screens/2026-10-02/walls-across-*`, sheet `walls-across-1-2-3-wide-sheet.jpg`).
- **Walls stand ACROSS their street in the SIM (Oct 1 2026; Collins: "jesus man, how are we still placing walls
  lengthwise rather than across pathways").** `Sim.wallAcross`: a Spine Wall pointed at a street cell takes the
  street's width there, across the way the street runs (`Sim.laneAlongX`: the longer straight run of street through
  the cell; at a crossing, the way the swarm moves), two cells at most. On a street one cell wide it is ONE cell
  with a one-cell wall's body (832 / 1.6 = 520 hp: never a free double wall). Turning it before placing (R,
  right-click) cannot lay it along the street; buds, copies, a rebirth and a collector's dropped wall take the same
  ground; the renderer reads the same `laneAlongX`. On a roof a wall is a 1x2 as before. Tests
  `tests/wallsAcross.test.ts`; shots `node tools/shot-walls.mjs --tag across` (`notes/screens/2026-10-01/walls-across-*`).
  Measured: naive hold-12 5/10, guardrail 4:0 (it was 5:0). Runs are not saved mid-mission, so no save holds an
  old lengthwise wall.
- **(Superseded Oct 1: the sim now lays walls across.) Walls (Sep 30, "walls way too large and placed sideways").** A Spine Wall is drawn ACROSS its lane
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
3. (Done Oct 1 2026: **creeped streets in their own colour**, yellow creep against the red hide; "The art", "Streets under the creep".)
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

## Spine Walls: always and only in a street, cutting it (Oct 2 2026)

Collins: "a wall is always and only on a trail ... it goes from one side of the trail to the other side to block
oncoming forces so they have to destroy it to get by" (and enemies attack a wall they hit: `sim.ts`, "a structure on
my cell or the next cell is a wall in my way: chew through it").
- **Roofs:** `canBuildOn` / `canPlaceFreeOn` let a wall stand on a Block, where it was laid as a plain two-cell
  line along the roof edge (the walls "off the trail"). A wall now stands on Road only.
- **Across = the narrowest cut** (`Sim.wallAcross`): the street measured through the cell both ways, a neighbour
  counted only while the street goes on through it crosswise; the shorter run is the wall. The old "longer straight
  run" laid walls along the leg of a bend; the swarm's next step alone flips on staircase streets.
- **No wall in a pocket or dead end:** the street must go on past both faces (the city's edge counts).
- **Drawn** along the line of its own cells (`isoRender.ts`), and the street under a wall stays street creep.
- **Checked by what a wall is FOR** (`tests/wallsAcross.test.ts`): with the wall shut, the street on its two faces
  cannot reach each other near it, on every street cell of eight boards; no wall ever on a non-street cell, in a
  whole scripted run too. `node tools/walls-ascii.mjs <set> <seed>` prints the grid with the walls a board gets.

## Spore Mules, and Broodmothers brood only on creep (Oct 2 2026)

Collins: "a unit that can act like a creep node (and an organ that makes them) ... you walk it out and deploy it ...
Broodmothers can't be put in make-babies mode except on creep". Design and the unlock reasoning: DESIGN.md "SPORE
MULES, AND BROOD ONLY ON CREEP".
- **Sim:** `Sim.mules` (`SporeMule`), the Mule Sac organ (`mule`, one cell, paced and strained like a bladder),
  `growMules` at the wave clear, `updateMules` (orders, no fighting), `mule-deploy` command -> `rootMule` (a creep
  node, past the creep too), `hurtMule` (war bodies fight a walking mule; the science caste turns aside for one;
  shells). `mother-mode` brood refused off creep (`motherOnCreep`); a parked brooding mother off creep drops to fight.
- **UI:** `src/ui/command.ts` (mules selectable, DEPLOY button and D key; the brood toggle greys to BROOD: NEEDS
  CREEP with the reason), `src/render/isoRender.ts` (mules drawn from the broodling's pictures, spore-green with a
  glowing sac, until their own are made; a selected mule shows the creep it would spread), kill-feed lines.
  Also fixed: the command layer's rings were projected at two heights (a Broodmother's egg ring by a building blew up
  into a giant disc); now at their centre's height.
- **Art:** the Mule Sac's scan tile and loop (`tools/art/mule.mjs`): made and baked for that ONE organ and merged into
  the manifest, because a full `make.mjs under` / `underloops` bake rebuilds every tile from raws that the Oct 1
  art-src loss took (it would drop art). Raw: `art-src-new/under/mule.png`, `art-src-new/under-loops/mule.mp4`.
  OWED: the mule's own unit pictures (walk, rooting); it borrows the broodling's.
- **Scripted player:** `Autoplayer.mules` (off by default; `GAPS_MODE=mules`). Measured: DESIGN.md.
- **Check:** `tests/mules.test.ts`; the browser beat `node tools/shot-mules.mjs` (walk out, root, brood refused off
  creep, brood on the new creep; `notes/screens/2026-10-02/mules-*.png`, `mules-deploy.mp4`).
## The Flametrooper (Oct 2 2026)

Collins: "an enemy unit of war caste with a flamethrower that is way better against units and targets them first,
only going after the base if all units are clear." The design is in DESIGN.md (YOUR WALKING UNITS, last bullet).
- **Sim:** `EnemySpec.flamer` (content/data.ts: sight 170, range 54, 30 hp/s to units, cone cos 0.82; 85 hp,
  4 a hit on structures), `Sim.updateFlamer` (hunts the nearest walking unit in sight along the streets, hoses a
  cone that burns every unit of yours in it; none in sight: falls through to the war caste's march),
  `walkingUnits` / `hurtUnit` (warriors, Broodmothers, Spore Mules), `flamerAnswer` (one more per
  `flamerPerUnits` = 6 units on the board, from tier 2, up to 4; in `previewNextWave`, so the telegraph shows it).
  `Enemy.flameTo` is where the stream reaches this tick (the renderer reads it; never written by the board).
- **Drawn:** the stream is code (`isoRender.ts`, a flickering tapered tongue, orange over yellow, with licks);
  a hosing trooper plays its attack clip facing the stream. Unit design: `tools/art/units.mjs` (`flametrooper`,
  drawn from a frame of the soldier as its reference: `art-src-new/units/flametrooper/soldier-ref.png`).
  Make it again: `BROODFALL_ART_SRC=<checkout>/art-src-new node tools/art/make.mjs unit flametrooper --attack --death`.
- **Checks:** `tests/flametrooper.test.ts` (units first; the cone; deadlier to units, weaker to limbs than a
  soldier; no stream with no unit in sight; closes in; the table and the answer; determinism).
  `node tools/shot-flame.mjs` (warriors burnt, then the troopers march on; filmed). Balance:
  `GAPS_MODE=noflame` / `stack` / `stack,noflame` on tools/measure/gaps.measure.ts.
- **Measured (Oct 2 2026, 10 seeds, hold-12):** naive 6/10 with Flametroopers and 6/10 without (`GAPS_MODE=noflame`);
  the Broodmother stack (`stack`) 6/10 both ways, but it loses 580 warriors over the ten runs with them against 396
  without (seed 10: 1 to 120; seed 9: 10 to 50): the stack stays viable and is now answered. 32-36 troopers come
  over a full run (the table plus the answer). The measure now prints broodling-lost, mule-lost and flamers.
- **Art (Oct 2 2026):** design + turnaround (2 stills) and 16 clips (5 walk, 5 attack, 1 death, then the SW/W/NW
  attacks re-rolled for smoke and nozzle fire, and W/NW again with "it is only aiming" in the motion prompt). The old
  takes are in `art-src-new/units/flametrooper/v1/` and `v2/`. Its fire is the code's stream only.

## Shelters, the Infestor and the Harrier (Oct 2 2026)

Collins's idea, built whole: DESIGN.md "SHELTERS AND THE INFESTOR; THE HARRIER" has the rules and the unlock reasoning.
- **Sim:** `Sim.shelters` / `infestors` / `harriers`, `raiseShelter` (at a draft that carries one: `markShelterOffer`,
  its own dice), the `infest` command, `payShelters` + `setShelterStage` at the wave clear (`waveBanked` is the meat
  banked since the wave began), the war caste's turn-off in the enemy loop (`shelterFor`, `shelterFlow`), the
  defenders (`updateShelters`), `growFieldUnits` (units paid in WAR at the clear: science is all but gone then),
  `updateHarriers` (hunts the science caste anywhere). Numbers in `content/data.ts` (shelter*, infestor*, harrier*).
- **Organs:** `infestor` (Infestor Cyst) and `harrier` (Harrier Gland), kind `unit`, one cell each (a multi-cell organ
  needs the whole-shape bake, which rebuilds sets from raw files the art-src loss took). Lineages: harrier 3, infestor 6.
- **UI:** INFEST (I, or right-click a shelter) in the unit panel (src/ui/command.ts); banners for raised / infested /
  grown / paid / lost (src/main.ts); the draft card's shelter tag (src/screens.css `.has-shelter`).
- **Art (all raw in art-src-new, never art-src):** the shelter in five states (`node tools/art/shelters.mjs`;
  `public/art/shelter/*.webp`; review `notes/art-review/shelters/sheet.jpg`), the two organs' scan tiles and loops
  (`node tools/art/field-organs.mjs`), the Infestor and the Harrier as ally units (`node tools/art/make.mjs unit
  infestor harrier --attack --death`; tools/art/units.mjs). Spend about $15 (organs ~$1, units ~$13.4 incl. one redrawn
  turnaround, shelters ~$2.3). The renderer falls back to the district's landmark (tinted) and the Broodmother's /
  broodling's pictures while any of these is missing.
- **Tests:** `tests/expansion.test.ts` (16). **Browser beat:** `node tools/shot-expansion.mjs` (8 checks; screenshots
  and `expansion.mp4` in notes/screens/2026-10-02/).
- **Measured** (tools/measure/gaps.measure.ts, 10 seeds, hold-12): naive 6/10 (unchanged: the naive bot never grows the
  new organs); `GAPS_MODE=expansion` 4/10 (shelters came in 3 runs and the bot lost those before infesting); 
  `GAPS_MODE=shelterstart` (a shelter at the start by the body) 4/10: the three runs that infested one won, grew it to
  stage 2-3 and were paid 66-223 meat; the bot does not escort its Infestors (5 lost to the defenders and the hive) and
  buys early, and a shelter by the body takes a 2x2 of roof. So the scripted player shows the payoff only when it gets
  there; whether +10/20/35% is enough for the risk is a playtest call (COLLINS).
- **Fire, nozzle and size, redone (Oct 2 2026; Collins on the first film: "the fire effects are awful ... they don't
  track the front of the nozzle ... these models are too large, barely fitting in a lane ... keep the nozzle facing
  forward"):**
  - **Animation:** the attack clips were re-made with the nozzle held still, pointing straight along the facing (the
    motion prompt in `tools/art/units.mjs`). Seen from behind (N) the clip swings the nozzle out after a second, so
    only its opening is kept (`clipShare: { attack: { N: 0.2 } }`, honoured by `bakeUnit` in templates/unit.mjs).
  - **The nozzle tip is FOUND, not guessed:** `node tools/art/nozzles.mjs` finds the blue pilot light on every attack
    frame of every view (the end of the blue nearest the body, below the helmet: the visor glints blue), takes each
    view's median as the tip, treats a frame far from it (a flare, a glint) as an outlier, and fails on a missing light
    or a jump. It writes `src/render/nozzles.ts` (per view, per frame) and the check sheet
    `notes/art-review/units/flametrooper-nozzles.jpg`. Re-run it after any re-bake of the trooper.
  - **The fire** (`src/render/flamethrower.ts`): a real flamethrower jet filmed on RFab (`node tools/art/flamejet.mjs`:
    a still and a 4 s looping clip on black, baked to 16 frames, `public/art/fx/flamejet.webp`), drawn added from the
    nozzle tip toward what the stream reaches, two frames layered; a flickering pilot flare at the tip; an orange glow
    cast on the ground under it; black smoke rolling off the far end; embers; a short ignition (it grows out of the
    tip with a bigger flare) and a sputter when it stops; little flames on each of your units in a stream
    (`Sim.flameBurnt`). Seen from behind, the jet is drawn just under the trooper. Reduce motion: one still frame, no
    smoke, embers or flicker. The other option tried (`?flame=particles`, the jet from soft particles) is kept for
    comparison: `notes/screens/2026-10-02/flame-options-jet-vs-particles.jpg`; the filmed jet won (real flame texture
    and licking edges; the particles read as a glowing worm).
  - **Size:** r 4.5 (was 8; ENEMY_SIZE in render.ts and `r` in units.mjs). On the screen its figure is 19 px against a
    soldier's 37 and a militiaman's 29, in a 32 px street cell (zoom 1; the same shares at zooms 2 and 3). It takes
    about 0.6 of a lane. Two side by side (38 px) still do not fit in one cell: that would need r ~3.5, smaller than a
    skitterling. Collins's call.
  - **Checks:** `node tools/shot-flame.mjs` (13 checks: the beat, 16 close-ups at two camera turns all firing, the sizes
    against a street cell at zooms 1-3) writes `flame-troopers.mp4`, `flame-close-sheet.jpg` and the options sheet.
- **Rework (Oct 2 2026, Collins on the first shots):** the shelter is now a levelled 2x2 lot of its district with an apron of
  street on every side and two rows at its door, offered only where the door is reachable (citymap.ts `shelterSite`, tested
  on 60 boards), drawn as a structure on its roof in its tile set's own rendering (`node tools/art/shelters.mjs`, ten sets x
  five states; city shots `node tools/shot-shelter-city.mjs <sets>`). The Infestor is a SIEGE TICK (concepts and the pick in
  notes/art-review/infestor/; `node tools/art/infestor-concepts.mjs`), with a BURROW clip (the boss `special` mechanism,
  `BOSS.infestor` in tools/art/templates/unit.mjs) staged at the door; drawn at 0.85 of a street cell (INFESTOR_R 15). The
  shelter's defenders shoot the NEAREST unit (an escort takes the fire). The "2000 hp" in the first film was the beat's own
  override; the beat now films the real 150 hp. Spend for the rework about $19 (3 concepts, 10 shelter sheets, the views,
  26 clips incl. a stopped first run).

## The roster: units are optional (Oct 2 2026)

Collins: "keeping RTS very, very low ... an image of every unit type you have in the top left of your screen, as well
as an ALL UNITS button ... click one of these, then click a location, and all units of that type (or all units) go
there or fight the thing you clicked (they also know how to use the tunnel)". DESIGN.md "UNITS ARE OPTIONAL".
- **Sim:** `src/sim/groups.ts` (`Sim.groups`): group orders by kind or ALL (`group-order`), alerts + SEND
  (`answer-alert`), AUTO per kind (`set-auto`), sorties that come home, hurt units walking onto creep to heal, idle Pit
  warriors answering a leak at the body. Tunnel routing is built against the expansion fork's interface
  (`Sim.tunnelLink()`, `{kind:'tunnel', ids, toHead}`, `BALANCE.tunnelTransit`); until that lands every order walks.
- **UI:** `src/ui/roster.ts` (portraits, counts, ALL, F1-F5 and backquote, AUTO toggles, alert toasts, order marks).
- **Tests:** `tests/groups.test.ts` (13). **Beat:** `node tools/shot-roster.mjs` (12 checks, `roster.mp4`).
- **Measured** (10 seeds, hold-12, `tools/measure/gaps.measure.ts`): naive 7/10 with the layer, 6/10 without
  (`GAPS_MODE=nogroups`); the Broodmother stack 8/10 driven by individual orders, 8/10 by the roster alone
  (`stack,roster`). Clicks a person would make for the stack: 0-554 a run (27-46 a wave on most seeds) with
  individual orders, 0-80 (2-7 a wave) with the roster.

## Science forward bases and creep care (Oct 2 2026; DESIGN.md "SCIENCE FORWARD BASES; CREEP CARE")

Collins: "give the science faction units that can build spawning locations, and even their own towers if you don't deal
with them, and then you need to mount attacks on these areas"; "the builders will need a bit more thought ... a spot on
the side of any lane"; "the creep healing and making faster is great".
- **Sim** (`src/sim/sim.ts`, search "SCIENCE FORWARD BASES"): `sendEngineers` (from wave 4, interest 10, every 50 s of
  quiet), `engineerJob` (reinforce an untended station first), `stationSiteOk` / `stationDoor` / `stationSiteScore` (a
  lot facing a street, or the edge of a street two or more wide; off creep, out of your reach and sight), `updateEngineer`
  (muster, travel, flee, build, tend), `updateEscort` (its study party: researchers at its side, a dart battery from wave
  6), `updateFixed` (the station: grows by age, parties nearer you, a war squad into every siege from stage 2, turrets
  while tended), `updateTurret`. Kinds `engineer`, `fieldstation`, `sciturret` (`content/data.ts`, `fixed` = a building).
  The bases roll their own dice (`baseRng`), so sending an engineer leaves the run's other draws alone.
- **Creep care:** `creepPace` (25% faster on creep, in `walkTo` and when closing on prey), `creepCare` (2.5% max hp/s).
- **Warriors** fight stations, turrets and engineers (`preyNear`), still not study parties. The scripted player mounts
  a strike (`Autoplayer.strikeStations`) once it has 3 units. Requisition: Form 6-F, Field Station Clearance.
- **Art:** the engineer, `tools/art/units.mjs` `engineer` (`BROODFALL_ART_SRC=<checkout>/art-src-new node
  tools/art/make.mjs unit engineer --attack --death --hit`; drawn from the researcher's turnaround, copied to
  `art-src-new/units/engineer/researcher-ref.png`; NOT steep: `refs/camera-example.png` was lost with art-src). The
  station and its turret per tile set: `tools/art/stations.mjs` (as the shelters: the set's landmark sheet as reference;
  being built, standing, fortified, wreck, turret -> `public/art/station/<set>/`; raw `art-src-new/station/`). Drawn by
  `IsoRender.syncStations` on their lot like a landmark; the build ring, the stage pips and a ring to the next stage,
  teal dart lines; the wreck until the creep digests it. Heal marks: `IsoRender.drawCreepCare`.
- **Checks:** `tests/stations.test.ts` (sites, every engineer behaviour, the station's growth, parties, squad, turrets,
  repair, warriors, darts, the count, creep care, determinism, the pictures). Browser beat `node tools/shot-stations.mjs`
  (13 checks; screens `notes/screens/2026-10-02/stations-*.png`, film `stations.mp4`).
- **The station IS its block** (Collins, after the first look: "it should transform the whole square section of the wall
  into something else, so it's very noticeable"): `Sim.stationBlock` (the block, at most 12 cells, site first),
  `stationSiteOk` (a building cell facing a street, the whole block free and off creep). Drawn by `IsoRender.cladBlocks`/
  `buildCladding`: the flat pictures of `tools/art/installation.mjs` (`public/art/installation/`: facade and roof per
  state, the entrance, six roof objects) laid on every visible wall face and roof diamond of the block with an affine
  matrix (`setFromMatrix`), a teal light over the roofs, a glowing teal roofline, smoke over a wreck. The old one-lot
  station pictures (`tools/art/stations.mjs`) are kept; only the turret is still used. Check: `node
  tools/shot-installation.mjs` (3 sets, near/far at 2 turns, every stage; a whole-board check that the block is far darker
  or far tealer than the city round it). Screens `notes/screens/2026-10-02/installation-*.png`.
- **Measure:** `GAPS_MODE=nostations` (no engineers), `nocreepcare`; the gaps rows now print `stations {...}`.
  Oct 2 2026, 10 seeds, hold 12 (naive wins; stations raised / destroyed / runs reaching stage 3 / parties sent; hp healed on creep):
  all built 7/10 (8/3/4/23; 1316); nostations 6/10; nocreepcare 7/10; neither 6/10. Stack 7/10 (6/4/4/17; 8080), stack
  without either 6/10. Expansion 5/10 (8/2/5/24), without either 5/10. The guard (>= 3/10) holds everywhere. The naive
  player has few walking units, so its stations mostly go unanswered and reach stage 3; the stack player strikes them.
## Domes: the Aegis Deacon and the Lens Bearer (Oct 2 2026)

Collins: "a unit for both the warriors and the science team that gives a shield around it in a dome that takes a certain
amount of damage before breaking (Northgard has something like this), but the catch is it's ineffective against damage
from units (who automatically target shield units first)". Design: DESIGN.md, the "DOMES" entry under YOUR WALKING UNITS.
- **Sim** (`src/sim/sim.ts`): `EnemySpec.dome` {radius, pool, recharge}; a bearer's `domeHp`/`domeMax` set at spawn
  (`raiseDome`, +`domeTierScale` a tier). `domeSoak` takes a limb's hit, and creep, clouds, fire, poison and swamp,
  out of the pool of the standing dome over the body (its own side only); an emptied dome BREAKS (`dome-broken`) and
  `updateDomes` brings it back full after `recharge` (`dome-up`). Your walking units' strikes are wrapped in
  `unitStrike` (warriors, Broodmothers, Harriers) and pass through. `preyNear` returns a bearer in reach first.
  `domeAnswer` (in startSiege and previewNextWave): one more deacon per `domeLimbsPer` limbs past `domeLimbsFree`
  from tier `domeAnswerMinTier`, up to `domeAnswerMax`. Lens Bearers: with study parties at interest >= `lensInterestMin`,
  in an engineer's escort from `lensEscortWave`, with a station's parties from stage 2; `followParty` keeps them among
  their party. Live bearers: `sim.domeBearers` (the low-micro roster's "SHIELD DOME" alert reads it, src/sim/groups.ts).
- **Drawn** (`src/render/domes.ts`, fed by `IsoRenderer.domeViews`): a bubble over the projected ground ring, bronze
  (war) or teal (science), ribs, a rim that flashes on a soaked hit, cracks under a third of the pool, a shatter of
  shards when it breaks or its bearer dies with it up, a grow-in when it returns. `window.broodfall.domes()` counts them.
- **Art:** `tools/art/units.mjs` (`aegis`, `lensbearer`), drawn from the soldier's and researcher's frames as references
  (`art-src-new/units/aegis/soldier-ref.png`, `art-src-new/units/lensbearer/researcher-ref.png`). Make again:
  `BROODFALL_ART_SRC=<checkout>/art-src-new node tools/art/make.mjs unit aegis lensbearer --attack --death`, then `--hit`.
  The dome is never in the pictures (code draws it).
- **Checks:** `tests/domes.test.ts` (soaks limbs for its side and radius, units pass through, break and recharge, creep and
  poison soaked, units target bearers first, Harriers crack one, tier growth, the ladder and the answer, lens with famous
  parties, determinism). `node tools/shot-domes.mjs` (four spitters vs a domed column, then Harriers; filmed, domes.mp4).
  Balance: `GAPS_MODE=nodome` on tools/measure/gaps.measure.ts; the measure prints deacons, domes broken and damage soaked.
- **Measured (Oct 2 2026, 10 seeds, hold-12):** naive 7/10 with domes and 7/10 without (`nodome`); with domes a winning
  naive run meets 28-37 deacons (the table plus the answer to its many limbs) and loses 12-20k damage to them, and seed
  4 flips to a loss (pressure, not a wall). Broodmother stack 7/10 (8/10 `stack,nodome`). Expansion 4/10, as before the
  domes (the scripted player's expansion play is weak, not the domes). Art spend about $13.50 (4 stills, 32 clips).

## The lie of the land (Oct 2 2026)

Collins: "the point of terrain height in tower defence is to get lucky that you can fit our cool larger powerful building at a higher height, but if terrain does not move together like it naturally does, those never appear."
- **Before:** a block's height came from its plate's letters (`A`, `B` dotted among `#`) plus Temple Heights' random single raises. Over 20 played boards: no limb bigger than one cell could ever stand above the ground floor, about 16 lone peaks a board, 11.6% of neighbouring blocks two storeys apart.
- **Now** (`src/sim/citymap.ts`): `terrainField` sums hills placed one-or-none per 7x7 square from the board's `terrainSeed` (its own dice: the run's other rolls are unchanged, and Temple Heights still throws its old dice), flattened bells so hills have plateau tops; `terrainLevel` cuts it into storeys 1-3. `stampPlate` calls `settleTerrain`: the new district's blocks take the land, then settle against every neighbour (old districts are never moved): no step over one storey, no lone peak. Temple Heights is a hill in the middle of its district. The draft card draws the land the district will really take (`draftHeights`). The pattern letters `A`/`B` no longer set height. Plinths still add a fourth storey.
- **Measure:** `npx vitest run --config tools/measure/vitest.config.ts tools/measure/terrain.measure.ts` (20 played boards); `npx vite-node tools/measure/terrain-probe.ts` (40 grown boards, quick); `npx vite-node tools/measure/heightmap.ts -- out.ppm 3,7,11,15` (a top-down map). Numbers: `notes/screens/2026-10-02/terrain/baseline.json` (before) and `after.json`.
- **Pictures:** `notes/screens/2026-10-02/terrain/heightmap-before-after.png`; `terrain-SET-far-before-after.jpg` and `terrain-SET-mid-before-after.jpg` for suburb, megacity, orient, farmland (`node tools/shot-terrain.mjs DIST TAG`).
- **Open (Collins):** the city reads flatter. The old dotted tall blocks looked like separate buildings; same-height neighbours now merge into wide plateaus (the drawn lots follow height). If the busy skyline is wanted back, it should come from the drawing (rooftop structures, lot variety) on top of coherent land, not from random heights.

## The data pad's shake, fixed (Oct 2 2026)

Collins: "the image on the screen shakes a bit in a way that breaks the effect as it's being set down."
- **Cause, measured** (`node tools/measure/pad-jitter.mjs`: decodes each clip's alpha and compares the keyed hole's
  real edges with the baked corners, frame by frame): the bake's median-and-blur over time followed the clip's uneven
  cadence (the generated clip holds frames, then was resampled 30 -> 24 fps) loosely, so the warped page sat up to
  9-14 px off the pad's hole, flipping side almost every frame. A second, smaller one: the clip was a <video> while the
  page's transform was set in its frame callback, so a new frame could show a display frame before the page followed.
- **Fix:** the pad is baked at the clips' own 30 fps; every frame's corners are refined to sub-pixel on the keyed hole
  (`refineQuad`: 21 half-alpha crossings per edge, a fitted line, the corners where lines meet); over time only noise
  is taken out, never more than 0.35 px from that frame's own corners (`smoothFaithful`); the clip is drawn into a
  canvas in the same callback that warps the page (`src/ui/padOutro.ts`), and the frame shown is `frameAt(mediaTime)`.
- **Numbers** (residual = page edge off the hole; shake = its change frame to frame; RMS, worst):
  won 1.40 (5.84) -> 0.34 (1.07) px, shake 2.07 (9.34) -> 0.46 (1.28); lost 2.11 (9.24) -> 0.34 (1.08),
  shake 3.42 (13.63) -> 0.49 (1.64). `tests/padOutro.test.ts` holds both clips under 0.6 px RMS / 2 px worst.
- **Look:** `notes/screens/2026-10-02/pad/pad-<won|lost>-composite-slow-before-after.mp4` (frame-exact, the game's
  maths, x3 slower: `tools/measure/pad-composite.mjs`), and the browser recordings `pad-<id>-BEFORE.mp4` / `-AFTER.mp4`.

## The pad, part 2: from the desk into the ship (Oct 2 2026)

Collins: "it should have a second part of you turning around and getting up to move into the ship's interface, with the
AI character talking to you, etc. It's meant to transition the two interfaces" ... "have you feel like you're really in a
ship" ... "use an image-to-image video gen with the starting image being the end of that video and the ending one being a
screenshot of the interface."
- **The flow** (`src/ui/padOutro.ts`, `src/main.ts` `PAD_PART2`): a CAMPAIGN deployment ends → part 1 (the pad set down,
  the live board on its screen) → the pad's screen sleeps → part 2 plays full screen with sound: first person, he pushes
  back, stands and turns past the window onto the planet toward the open hatch; cut; from behind, he walks through the
  hatch into the Directive Desk's room and stops at the table. Its last frame IS the interface's backdrop (a screenshot,
  `tools/shot-padship-end.mjs`), the report comes up under it at the Directive Desk (`campaignUi.showDebrief` now uses the
  desk room, where the walk ends) and the film fades off over it once the report's card is drawn (`handOver`, ≤ 6 s).
  YOKE presents it: one line by outcome (`content/greetings.ts` `REPORT_LINES`, `reportLine`), her body on a light
  intercom (`presentReport`; no input/close, which would redraw the screen). Her full greeting still comes aboard.
- **Not for** mission 1 (it keeps the B-movie's reveal of the ship) or a skirmish (back to the console menu).
- **Skip:** one press (click, Esc, Enter, Space) anywhere in part 1 or 2 goes straight to the interface (the poster =
  the end screenshot, then the report). **Reduce motion:** no films; a short cross-fade through that picture to the report.
- **Art** (`node tools/art/make.mjs padship [--frames|--stills|--bake]`, `tools/art/templates/pad-ship.mjs`; raw in
  `art-src-new/pad-ship/`): START frames = part 1's last frames with the green screen made black (free); the TURN still
  (first person, the window, the console, the chair pushed back, the hatch onto the round-table room) and the HATCH still
  (him from behind in the hatch, superseded) and the OVER still (A's last view a step back, him standing where the camera was); clips on `seegen:wan3.0-video` (start + end frame): `won`/`lost` = start → TURN, `walk`
  = HATCH → the interface screenshot. Sound (`atlascloud:h3-t2v` soundtracks): the ship's hum and recyclers, his chair and
  steps on the deck plating, the hatch and a chime, mixed under the film at -22 LUFS. Baked: `public/art/pad/ship-won.mp4`,
  `ship-lost.mp4`, `ship-end.webp`, manifest `part2` (with `cut`, where the walk begins). Review and the continuity
  checks: `notes/art-review/pad/ship-<o>-strip.jpg`, `-join1.jpg` (part 1's end | part 2's start), `-join2.jpg` (part 2's
  last frame | the interface | their difference).
- **Traps:** RFab's `openai:gpt-image-2` failed every job on Oct 2 ("error is not defined"); `seegen:gpt-image-2` worked,
  but sizes by aspect ratio (makeStill now sends `aspectRatio`). wan3.0's first `won` take picked the pad back up and its
  first `lost` take turned into a third-person shot of an older stranger: the prompts now pin first person and the pad
  staying on the desk (old takes in `art-src-new/pad-ship/v1/`).
- **Beat:** `node tools/shot-pad.mjs ship-won ship-lost ship-skip ship-calm` (films in `notes/screens/2026-10-02/pad/`).
- **No jump between first and third person (Oct 2 2026, Collins: "it sort of changes the position of you when it moves from
  first to third person"):** the cut is gone. A `rise` clip (TURN still -> the OVER still: the same view a step back, him from
  behind standing where the camera was) pulls the camera back over his shoulder so he rises into the picture where the viewpoint
  stood; the walk starts from OVER. Film = A + rise + walk (about 15 s). Joins: A->rise 34.7 dB, rise->walk 32.1 dB
  (`notes/art-review/pad/ship-rise-joins.jpg`). The hatch-still walk is kept in `art-src-new/pad-ship/v2/`.
- **Restructured (Oct 2 2026, Collins: "this new part of the video starts by zooming back out of the first-person perspective,
  then we watch him get up and walk to the other display"):** part 2 = the PULL-OUT (`won`/`lost`: part 1's last frame ->
  the SEATED still, him at the console from behind, the pad where he set it down; he stays seated) + one third-person WALK
  (SEATED -> the interface screenshot: he gets up, walks through the hatch to the one table), the walk's last 0.6 s blended into
  the screenshot so the film ends on it exactly. About 10 s. Joins: part 1 -> pull-out 36.1 dB, pull-out -> walk 32.6 dB,
  film end -> interface 42.8 dB (`notes/art-review/pad/ship-joins-v4.jpg`). Superseded takes: `art-src-new/pad-ship/v3/`
  (the turn/rise version), `v4/` (a walk that drew two tables). Stills now at medium quality (`PADSHIP_QUALITY`).

## First person the whole way? Options drawn; DECIDED Oct 4 2026: the original film stays

Collins, of the pad's part 2: "would this look better if you stayed in first person the whole time, but this would require
slightly different view of many ship interiors ... think through this and show me some options." Nothing in the game changed.
- **The options** (page: `notes/art-review/fp-options/first-person-options.html`, published at
  https://claude.ai/artifact/Qs524magmqYLUevWxesVNh (republish that file to keep the link); films `notes/art-review/fp-options/film-*.mp4`):
  **A** today (the camera pulls out of his eyes at the desk, we watch him walk, every room has him from behind);
  **B** first person all the way (the Oct 2 stand-and-turn clips `art-src-new/pad-ship/v3/won.mp4`/`lost.mp4` + one new walk
  through his eyes to the table; every room redrawn as what he sees, his hands in the picture);
  **C** first person for the walk, then the camera settles back behind him onto today's interface (no room art).
  Claude's read: B if the rooms are redrawn; otherwise keep A (C puts the viewpoint change on the busiest second).
- **Drawn to judge it:** four rooms through his eyes (`tools/art/fp-options.mjs --stills`: desk three ways, genes, comms, ai;
  raw in `art-src-new/fp-options/`, pairs in `notes/art-review/fp-options/room-*-now-vs-eyes.jpg`), the REAL interface over
  each (`node tools/shot-fp-options.mjs [rooms report] [--look …]`: the browser is handed the other picture when it asks for
  the room's backdrop, the loop is held back; `notes/art-review/fp-options/ui/`), the clips (`--clips`: walk, walk-hands,
  walk-down, settle on seegen:wan3.0-video) and the option films (`--bake`, free).
- **What the pictures showed:** the AI Core gains most (YOKE faces the player instead of standing half behind his back); Comms
  and the Gene Bay hold up on a hand in frame; the Desk is the hard room (a bare black box without him): under the report its
  left third is an empty wall unless he looks DOWN at the table with a hand on it (`desk-down`). Anything of him must sit in
  the left third and above YOKE's intercom (lower left) or the interface covers it.
- **If B is chosen:** 8 room stills + loops (desk, genes, locker, board, comms, ai, orders, hobby; quarters is already his
  eyes), about $5.50 a room; the film's walk remade to the final desk still; today's loops kept beside the new ones.
- **Traps:** naming the window in the walk's prompt drew a window in the table room (describe the room's walls instead);
  "glows like a projector waking" drew a white disc and a rod on the table and the take missed its end frame.
- **Oct 4 2026, Collins on A/B/C: "none of these quite land": (1) "the window changes in the same way mid vid in all of them",
  (2) "it all feels so forced like the hand at the end ... maybe you could have him pick up and put on a vr like headset in
  that room?" "and the screen like flickers on".**
  **The window's cause:** every film left the desk by a clip whose END picture was a second, separately drawn view of the
  window (the TURN still: a thicker frame, a far redder planet), so the model morphed one window into the other as he turned;
  B and C all open with that one clip (`art-src-new/pad-ship/v3/won.mp4`), and today's in-game walk does the same from its
  own angle. **The rule:** a clip that leaves the desk ends on a picture with NO window in it (`turn2`), he LOOKS AWAY before
  he stands (standing up facing the window made the model redraw it, with a stranger's face reflected in the glass:
  `v1/rise2-face.mp4`), and no prompt names the window. Pictures: `notes/art-review/fp-options/window-old-first-last.jpg`,
  `window-new-first-leaving.jpg`.
  **D, the visor** (`notes/art-review/fp-options/film-D-visor.mp4`; `node tools/art/fp-options.mjs --stills turn2 visor-table`,
  `--clips rise2 walk2 visor visor-free`, `--bake D-visor`): first person throughout: `rise2` (part 1's last frame -> `turn2`),
  `walk2` (-> `visor-table`: the visor lying on the lit table), `visor-free` (both hands raise it, its inside closes over his
  eyes: black; the take with the end left free kept the room steady, the one ended on a black frame tipped it), then the
  interface, unchanged, as the visor's screen FLICKERING ON (black, a dim flash, black, a dimmer one, black, it catches, dips,
  steadies: about 1.1 s; a crackle on each flash, a soft rising tone, a faint hum, synthesized in the bake so they fall on the
  frame; a video model's take of that sound came back as a flat hum). 12.5 s to black (today 10 s). No room is redrawn.
  **Not in the game yet. To put it in:** the lost look-away (`lost-start.png` -> `turn2`), the films baked to
  `public/art/pad/ship-<won|lost>.mp4`, and `src/ui/padOutro.ts` `handOver` changed from the fade to the flicker, since the
  film ends on black, not on the room's picture (Reduce motion: the cross-fade as now; `reduceFlashes`: a plain fade).
  **One seam:** the Desk's backdrop still shows him from behind without the visor.
- **Decided (Collins, Oct 4 2026, after the visor film): "I give up the original is best".** The pad's part 2 stays as it
  is in the game (the camera pulls out of his eyes at the desk, one third-person walk to the Directive Desk). A, B, C and
  D are closed; their films and tools stay in `notes/art-review/fp-options/` and `tools/art/fp-options.mjs`.
- **His note on the visor film, and the rule it leaves:** "you used two video calls but the second did not use the last
  one's last frame as its start so it looked bad". Each clip of D started from the STILL the clip before it was aimed at;
  a model lands near its end picture, never on it, so every join stepped. **A clip that follows another starts from the
  previous clip's REAL last frame (`lastFrameOf(clip)` in `tools/art/rfab.mjs`), or is continued from its last seconds
  (`continueFrom`), never from that still; and a join is MEASURED on real frames before it is baked.**

## He walks into the room: the ship's room-to-room transitions (Oct 4 2026)

Collins: "can you build some of the other transitions between different parts of the ship (e.g. ship menus)".
- **What plays** (`src/ui/campaignUi.ts` `goTo` / `walkInto` / `playArrival`, styles in `src/ship.css`): going to ANOTHER
  room, the room's backdrop is first the room EMPTY (the arrival clip's own first frame, as `--room`), the clip plays over
  the room's loop (held unseen on its first frame), he walks in from beside the camera with his back to us and takes his
  place (sits where the room has him sitting, takes up the sheet at the lectern), and when the clip ends the loop starts
  from its first frame, which is the clip's last, and the clip fades off it. The room's screen is up and usable the whole
  time (nothing waits on the clip); its words fade in once (0.45 s). 3.7 to 3.8 s a room; he is in his place by about 2 s.
- **When:** a click on another room's button (and the two places the screen sends him: YOKE's account link, "later" in her
  room), and when the ship comes onto the screen from anywhere but a report (he walks into the room it opens in; the walk
  waits for the ship's pictures). **Not:** the room he is already in; the Quarters (seen empty from its doorway, no
  arrival); back from a deployment's report (the pad's film has just walked him to the desk); Settings > Reduce motion
  (the room's still, as before). A change of room mid-walk starts the new room's walk; a walk nobody watched (the ship
  hidden) is over.
- **The art** (`node tools/art/ship-arrivals.mjs [ids] [--stills|--bake]`; raw in `art-src-new/ship-arrivals/`): per room,
  FRAME 0 = the loop's own first frame; the EMPTY ROOM = the picture model takes him out (`seegen:gpt-image-2`, high) and
  only the part of its picture where he was is laid into frame 0, found by comparing the two (`heMask`: he wears black in
  a black room, so the threshold is low, the patch closed and grown, the largest kept) and feathered, so start and end
  differ in him ALONE and the room cannot morph; the CLIP = start + end frame on `seegen:wan3.0-video`, 5 s at 1080p like
  the loops (131,400 tokens = $2.63 each); the BAKE drops the uploaded still's frame, sets the pace (1.3 to 1.35x), blends
  the last 0.5 s into frame 0 and writes `public/art/ship/loops/arrive-<id>.mp4` + `.webp` (its first frame) and `arrive`
  in `loops.json`. A take whose REAL last frame is under 27 dB from frame 0 is not baked. All eight landed first time:
  35.0 to 38.7 dB as generated, 42.1 to 45.9 baked (`notes/art-review/ship-arrivals/arrivals.json`, `<id>-strip.jpg`,
  `<id>-join.jpg`, `<id>-with-him-and-empty.jpg`).
- **Checks:** `tests/shipArrivals.test.ts` (10: each room has one, short, ending on its loop's first frame, starting
  without him, silent; the Quarters have none; the shipped folder holds only what the game loads);
  `node tools/shot-ship-arrivals.mjs [tour switch none calm report aboard break]` (dev server 5431, real clicks; the
  hand-over is WATCHED: the largest change between two pictures in a row as the loop takes over was 0.66 to 2.40 of 255,
  where a real jump would be 15 and up; 95 checks);
  stills and the tour's film in `notes/screens/2026-10-04/arrivals/`; persona notes `notes/PERSONA-SHIP-ARRIVALS-2026-10-04.md`.
- **Two takes a room, and his steps (later on Oct 4; Collins: "do the stuff that needs doing"):** every room has a second
  take (`<id>-arrive-2.mp4` -> `arrive-<id>-2.mp4`, asked for with a brisker manner; `loops.json` `arrive.takes`), and the
  game plays a room's takes in turn (`arriveTurn`), so one walk is not seen on every visit; all sixteen takes end on their
  loop's first frame (34.6 to 38.7 dB as generated). His steps are the game's own cue: `ship-step` (`tools/audio/cues.mjs`,
  six single steps cut from one take; rule in `src/audio/cues.ts`), four of them laid under each walk when its clip starts
  playing, each a little quieter. The clips stay silent. The beat counts them: four asked and four sounded per walk. NOT
  listened to by a person yet: the take was checked for speech (none) and for length (0.16 to 0.29 s a step) only.
- **Open:** he is never seen LEAVING (a take of him leaving the Desk is made by `--leave desk`, not in the game).
- **Under automation** (`navigator.webdriver`) he walks in only when `localStorage['broodfall-arrivals']` is `'on'` (the
  arrivals beat sets it), as the pad's film does: every other browser beat photographs a room the moment it clicks it.
- **A loop baked again needs its arrival made again** (its first frame is new): `tools/art/ship-loops.mjs` keeps the
  `arrive` entry in `loops.json`, and `tests/shipArrivals.test.ts` fails until the arrival ends on the new first frame.

## The Comms room, redrawn: his hand (Oct 4 2026)

Collins, of `notes/screens/2026-10-04/arrivals/comms-3-in-place.jpg`: "the stuff based on this picture need to be redone his
hand is sitting in an impossible position, other than that they are good". The hand on the dial was a right hand drawn on
his left arm, in the room's approved still since Sep 30, so in the loop and in the new arrival.
- **Redrawn** (`tools/art/ship-loops.mjs`, the room's `fix`): the still is drawn again FROM THE LOOP'S OWN FIRST FRAME with
  only his arms changed. Three poses were drawn and looked at enlarged (`art-src-new/ship-loops/comms-fixA|B|C.png`: a grip
  on a dial, the hand lying flat on the console, both hands out of sight); B is the one used: a flat hand has nothing to
  get wrong. The loop's clip no longer has him turn a dial (a hand a video model moves is a hand it redraws): the hand
  stays where it is for the whole loop (looked at once a second).
- **What was made again:** the loop (`public/art/ship/loops/room-comms.mp4` + `.webp`, 7.08 s), the room's plain still
  (`public/art/ship/room-comms.webp`, now the loop's first frame; `tools/art/templates/ship.mjs` no longer bakes the old
  still over a corrected room), and its arrival (`arrive-comms.mp4`: the room emptied from the NEW first frame, a new
  clip; landed 36.0 dB, baked 43.0). The old files are in `art-src-new/ship-arrivals/v1/comms-oldhand-*`.
- **Not touched:** the options page's Comms screenshots (`notes/art-review/fp-options/ui/comms-*.jpg`, a record of Oct 3)
  and the old approved still in `art-src/ship/room-comms.png` (kept; it is not baked any more).
- **Checks:** `tests/shipArrivals.test.ts`, `node tools/shot-ship-arrivals.mjs` (86), `node tools/shot-ship-loops.mjs rooms`
  (that beat now waits for a walk-in to end before it measures a loop).

## A clip as the start of the next one: what rfab.ai gives, measured (Oct 4 2026)

Collins: "some models take more than just a last frame as a start but the last 5 seconds or so can you access that with the
rfab api? if not update it so you can ... those are probably better".
- **It was there:** `POST /api/video-editor/upload-clip` (a clip onto rfab.ai's storage) and `generate-video`'s
  `continuationVideoUrl` (SeeGen models only: sd2, sd2-fast, sd2-mini, wan3.0). `tools/art/rfab.mjs` now uses it:
  `makeClip({ continueFrom: clip, tailSeconds })` cuts the tail (`tailOf`), uploads it (`uploadVideo`) and sends it;
  `lastFrameOf(clip)` gives a clip's real last frame. A continued clip takes NO end frame (the API drops the clip when a
  start AND an end picture are given), so `continueFrom` with `endFile` throws.
- **Added to rfab.ai** (backend `66fa6fe0`, note `docs/notes/SEEGEN_VIDEO_EXTEND_2026-10-04.md`; DEPLOY OWED, Collins's):
  the provider's own extend mode, asked for with `continuationMode: "extend"` (`makeClip({ continueMode: 'extend' })`);
  and the seconds of clip a SeeGen request is GIVEN are now billed (the provider bills out + in; rfab.ai charged out only).
- **Measured** (the Desk loop's last 5 s, "he turns and walks out", one take each; the new clip's first frame against the
  source's last, PSNR after a light blur): as a reference wan3.0 30.0 dB, sd2-fast 33.7; extended 29.5 and 34.6; a clip
  started on a PICTURE of the last frame 38 to 40. Both kept the room, the man and the framing and did the action; wan
  lifts the exposure at the join, sd2-fast shifts the picture a few pixels. **So for a join that must not show, start on
  the real last frame; a clip start is for carrying MOVEMENT across a join** (not shown by this source: he stands still).
