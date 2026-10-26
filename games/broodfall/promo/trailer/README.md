# Broodfall: the trailer (Oct 1 2026) and the gameplay trailer (Oct 26 2026)

| File | What | Length | Size |
|---|---|---|---|
| `broodfall-trailer-90s.mp4` | The store trailer: 1920x1080, 60 fps, H.264 High + AAC 320k | 88.0 s | 43.6 MB |
| `broodfall-trailer-30s.mp4` | The 30 s cut, 1920x1080 | 30.0 s | 15.0 MB |
| `broodfall-trailer-vertical.mp4` | The social cut, 1080x1920 (each shot's 4:5 window over a blurred fill of itself) | 30.0 s | 13.5 MB |
| `contact-sheet.jpg` | One frame of every shot of the 90 s cut, with its start time | | |

All three: loudness -14 LUFS integrated, true peak -1.4 to -1.5 dBTP (two-pass loudnorm, measured
after encoding). The full-quality masters (CRF 16) are in `art-src/trailer/*-master.mp4` (git-ignored;
the 90 s master is 120 MB, over GitHub's limit); the files here are capped at 4 Mbit/s (90 s) and 4.4
Mbit/s (30 s, vertical).

Everything is rebuilt by `tools/promo/trailer.mjs` (`capture`, `record`, `gen`, `titles`, `cut`,
`sheet`); raw footage, frames, segments and masters are in `art-src/trailer/`.

## The gameplay cut (Oct 26 2026)

| File | What | Length | Size |
|---|---|---|---|
| `broodfall-trailer-gameplay.mp4` | The second store trailer, pure gameplay: 1920x1080, 60 fps, H.264 High (CRF 19, capped 8 Mbit/s) + AAC 320k | 55.9 s | 44.4 MB |
| `broodfall-trailer-gameplay-steam-upload-720p.mp4` | The same for a browser upload capped at 10 MB: 1280x720, 30 fps, two-pass x264 at 1267 kbit/s, AAC 96k | 55.9 s | 9.67 MB |

Collins: "focused on gameplay of the tower defence, global map, choosing map pieces, and monster building (not much
of the ship, just pure gameplay) so we don't have just one trailer." Every shot is the real game except the landing
film, which is the game's own (it plays before every deployment). No ship rooms, no faction films, no voices but the
game's narrator over the royal. Loudness -14.0 LUFS, true peak -1.4 dBTP (upload copy -14.7 LUFS, -1.4 dBTP).

Four cards in the genre line's type, in the upper third so the play stays visible: EVERY LIMB A TOWER, GROW THE BODY,
CONSUME THE MAP, TAKE THE PLANET; the end is the logo, TOWER DEFENCE + ROGUELITE, GENOCIDE SIMULATOR.

**Played by hand** (new, `p-*` in `tools/promo/trailer.mjs`): the scripted player is off and the page's real mouse
(`page.mouse`) picks cards, hovers and clicks, on the frozen clock like every other shot. A headless page draws no
pointer, so those shots draw a plain arrow that follows the mouse events (`CURSOR`); nothing of the game is changed.
The hint line stays on in them (it says what a hover does). Sound: `siege-assault` throughout, placed so its drop
(61.2 s into the track) lands on the montage; `sting-wave` at the top, `sting-core` and the menu hum under the logo;
and the game's OWN effects where the game asked for them while each shot was filmed (`film()` now logs the page's
audio cues to `cap/<id>.sfx.json`; `gameCues()` lays them with the game's gains and gaps from `src/audio/cues.ts`).

| Start (s) | Length (s) | Shot | What | Source |
|---|---|---|---|---|
| 0.00 | 3.60 | g-open | The whole board in a wave: a small tower defence (EVERY LIMB A TOWER) | real game, captured |
| 3.60 | 3.00 | g-maw | The Maw's tongue catches a soldier and swallows it | real game, captured |
| 6.60 | 2.60 | g-temple | The Temple Cities under siege: shield domes, lightning and shot | real game, captured |
| 9.20 | 3.60 | g-boss | A royal and her consort wade into the limbs (the narrator: "And here she comes...") | real game, captured |
| 12.80 | 5.60 | p-build | By hand: three limb cards picked and grown on the creep, the ghost and its reach shown (GROW THE BODY) | real game, played by hand |
| 18.40 | 4.40 | p-eat | Cannibalize: a limb hovered (lit; the hint says what eating it gives), eaten, its trait grown into a new limb | real game, played by hand |
| 22.80 | 4.40 | p-organ | The organ stage: two organs picked, their ghosts over the body, grown | real game, played by hand |
| 27.20 | 1.80 | g-core | The core evolves | real game, captured |
| 29.00 | 2.20 | g-looks | Limbs in their upgrade looks, firing | real game, captured |
| 31.20 | 2.28 | p-draft | THE BODY IS READY TO GROW: three districts hovered, one clicked (close on the panel) | real game, played by hand |
| 33.48 | 2.60 | p-draft-b | DISTRICT CONSUMED: the camera goes to the new district (CONSUME THE MAP) | real game, played by hand |
| 36.08 | 2.40 | g-creep | Creep nodes put down past the edge; the creep spreads over the new district | real game, captured |
| 38.48 | 3.20 | g-late | Late in a run: the whole body across its districts, in a wave | real game, captured |
| 41.68 | 2.60 | p-globe | The planet at the Directive Desk (cropped to the globe and the briefing): a territory hovered, picked, the globe turns to it | real game, played by hand |
| 44.28 | 2.60 | landing | The brood falls on the new territory (TAKE THE PLANET) | the game's landing film, public/art/landing/industrial.mp4 |
| 46.88 | 3.50 | m-* | Montage on the music's drop: the whole body, the Maw, the royal, the Temple Cities, the upgrade looks | real game, captured |
| 50.38 | 5.50 | end | The name, TOWER DEFENCE + ROGUELITE, GENOCIDE SIMULATOR | key art, titles set in type |

Rebuild (in `games/broodfall`; raw footage in `art-src/trailer/`, git-ignored):

```
node tools/promo/trailer.mjs capture g-open g-maw g-temple g-boss g-core g-looks g-creep g-late p-build p-eat p-organ p-draft p-globe
node tools/promo/trailer.mjs titles
node tools/promo/trailer.mjs cut gameplay      # the 1080p file AND the under-9.8 MB 720p upload copy
```

`cut gameplay` is asked for by name; a bare `cut` still builds only the 90 s, 30 s and vertical cuts. Learnt on the
way: the old `g-late` (seed 14, top-up 10) now LOSES by wave 8, so it tries seeds until one is alive and grown; a
mouse press that moves on a picture drags it instead of clicking it (the hand now stays still while pressed); taking
a district opens the organ stage by itself (the draft shot presses TO THE SURFACE at once, as a player would); and
a mix whose voice bus ends early dropped the music for seconds or hung ffmpeg, so every bus now runs on a full-length
bed of silence.

## How it unfolds (Collins's philosophy: a small tower defence that turns out to be bigger)

1. **The B-movie** (0 to 15 s): the opening film's town, the newsreel narrator, the insects' own title
   IT CAME FROM THE SKY!, the meteor, the creep. Score: the film's own (`film.ogg`).
2. **It looks like a tower defence** (15 to 41 s): real gameplay, the whole small board first, the
   genre line built up a word at a time: TOWER DEFENCE, then + ROGUELITE over the district draft and
   the organ stage. Score: `siege-assault.ogg` with `sting-wave`.
3. **The layers** (41 to 77 s): + DEEP NARRATIVE LORE over the ship's viewport; YOKE's "You really
   suck at genocide"; the boss (a dog); the 3D globe; the three factions' leaders in their own voices;
   both newsreels (the Empire's and the insects'). Score: `sting-desk`, `theme-ship` (ducked under
   the voices), the newsreels' own music.
4. **The end** (77 to 88 s): a fast montage of gameplay on the return of `siege-assault`, then the
   logo, TOWER DEFENCE + ROGUELITE + DEEP NARRATIVE LORE, and GENOCIDE SIMULATOR (`sting-core`,
   the menu hum under it).

Nothing spoils the reveal: no line, picture or caption touches the archive/heaven (the lines were
chosen from the factions' early scenes; the Institute's line is only "On the numbers, you are the
SAFER apocalypse").

## Shot list, 90 s cut

| Start (s) | Length (s) | Shot | What | Source |
|---|---|---|---|---|
| 0.00 | 4.00 | sky | A quiet night in a quiet little insect town | the opening film, public/art/intro/sky.mp4 |
| 4.00 | 3.60 | lookup | The townsfolk look up: IT CAME FROM THE SKY! | the opening film, public/art/intro/lookup.mp4 |
| 7.60 | 2.60 | fall | The living meteor falls on the town | the opening film, public/art/intro/fall.mp4 |
| 10.20 | 2.60 | impact | Impact | the opening film, public/art/intro/impact.mp4 |
| 12.80 | 2.40 | creep | The creep swallows a street and a car | the opening film, public/art/intro/creep.mp4 |
| 15.20 | 4.40 | g-open | GAMEPLAY: wave 2 on a suburb board, the whole board: a small tower defence | real game, captured |
| 19.60 | 3.60 | g-siege | GAMEPLAY: a siege in the Megacity, limbs firing into the column | real game, captured |
| 23.20 | 3.60 | g-maw | GAMEPLAY: the Maw's frog tongue catches a soldier and swallows it | real game, captured |
| 26.80 | 3.00 | g-creep | GAMEPLAY: creep nodes put down past the edge; the creep spreads | real game, captured |
| 29.80 | 2.40 | g-draft | GAMEPLAY: the district draft, three plates to consume next | real game, captured |
| 32.20 | 2.20 | g-organ | GAMEPLAY: the organ stage between waves | real game, captured |
| 34.40 | 3.20 | g-core | GAMEPLAY: the core evolves into the citadel | real game, captured |
| 37.60 | 3.80 | g-boss | GAMEPLAY: a royal and her consort wade into the limbs | real game, captured |
| 41.40 | 3.80 | menu | The ship: the infested planet through the viewport | the game's menu loop, public/art/intro/menu.mp4 |
| 45.20 | 3.30 | r-yoke | THE SHIP: YOKE, the ship's AI: "You really suck at genocide." | real game (her first greeting), captured |
| 48.50 | 3.70 | r-boss | THE SHIP: the boss, an uplifted dog: "I love reports. Good boy. Good work." | real game (his first call), recorded in real time |
| 52.20 | 3.50 | s-globe | THE SHIP: the planet in 3D at the Directive Desk, held ground under the creep | real game, captured |
| 55.70 | 4.90 | faithful | The Faithful: The Voice on the air: "...brothers and sisters, LOOK UP." | new: RFab image-to-video from the scene picture art-src/ship/scenes/faithful-contact.png |
| 60.60 | 5.20 | delegation | The Friendship Delegation spell their letter in a field: "There will be snacks." "You ate the summit." | new: RFab image-to-video from art-src/ship/scenes/delegation-contact.png |
| 65.80 | 3.10 | institute | The Institute: the Director on a video call, mid-game: "On the numbers, you are the SAFER apocalypse." | new: RFab image-to-video from art-src/ship/scenes/institute-contact.png |
| 68.90 | 3.90 | e-orbit | Newsreel, the Clearance Review: "And nothing goes to waste. Nothing at all!" | the game's newsreel clip public/media/clips/e-orbit.mp4 |
| 72.80 | 3.90 | c-march | Newsreel, the Commonwealth (theirs): "The Host marches, to take back what is ours!" | the game's newsreel clip public/media/clips/c-march.mp4 |
| 76.70 | 0.80 | m-late | GAMEPLAY montage: the whole body late in a run | real game, captured |
| 77.50 | 0.80 | m-temple | GAMEPLAY montage: the Temple Cities under siege | real game, captured |
| 78.30 | 0.80 | m-maw | GAMEPLAY montage: the Maw again | real game, captured |
| 79.10 | 0.80 | m-looks | GAMEPLAY montage: limbs in their upgrade looks | real game, captured |
| 79.90 | 0.80 | m-siege | GAMEPLAY montage: the Megacity siege | real game, captured |
| 80.70 | 0.80 | m-boss | GAMEPLAY montage: the royal | real game, captured |
| 81.50 | 6.50 | end | The name, the genre line, GENOCIDE SIMULATOR | key art promo/key-art/broodfall-keyart-meteor-2048x1152.jpg, titles set in type |

The 30 s and vertical cuts use the same footage: lookup (IT CAME FROM THE SKY!), impact, g-open
(TOWER DEFENCE), g-siege, g-maw, g-draft and g-core (+ ROGUELITE), menu (+ DEEP NARRATIVE LORE),
YOKE, the globe, the Institute's line, a four-shot montage, the end card (`shots30()` in the script).

## Sound

| When | What | File |
|---|---|---|
| 0.5 s, 4.3 s, 13.0 s | Newsreel narrator: "It was a quiet night in a quiet little town." "Until something came down out of the sky." "It was hungry." | `public/audio/nar-film-1/2/4.ogg` |
| 37.7 s | Narrator: "And here she comes. The royal herself takes the field." | `public/audio/nar-royal.ogg` |
| 45.1 s | YOKE: "You really suck at genocide." (Collins's line, her own rfab.ai voice) | `art-src/trailer/voice/yoke-suck.mp3` (POST /api/avatars/:id/speak) |
| 48.5 s | The boss: "I love reports. Good boy. Good work." | `public/art/intro/boss.mp3` from 26.6 s |
| 55.8 s | The Voice: "...and they said the sign would come from the sky, and brothers and sisters, LOOK UP." | `public/media/voice/faithful__a-broadcast-on-every-frequency__0.ogg` |
| 60.7 / 63.9 s | The Delegate: "We have prepared a summit. There will be snacks." / "You ate the summit." | `public/media/voice/delegation__the-first-summit__0/2.ogg` |
| 66.0 s | The Director: "On the numbers, you are the SAFER apocalypse." | `public/media/voice/institute__a-video-call-mid-game__5.ogg` from 3.45 s |
| 69.0 / 72.8 s | Clearance Review: "And nothing goes to waste. Nothing at all!" / Commonwealth Newsreel: "The Host marches, to take back what is ours!" | `public/media/voice/n-e-waste.ogg`, `n-c-marches.ogg` |
| throughout | the game's own effects: limb grow, spit, blast, lightning, the Maw's bite, creep spread, core evolve, boss roar, the intercom | `public/audio/*.ogg` |

Every voice line is also captioned in type (Bahnschrift, the HUD's face), for sound-off viewing,
except YOKE's and the boss's, which the game's own UI captions in the shot.

## How the footage was made

- **Gameplay is the real game**, on the dev server (its own port, 5341 to 5346), headless Chromium
  with the GPU on (`--use-angle=d3d11`). An init script takes over the page's clock
  (`performance.now`, `Date.now`, `requestAnimationFrame`, timers, video time): once a shot is set up,
  the clock is frozen and moved on exactly 1/60 s per frame, and each frame is photographed. So every
  frame is a real 60 fps frame of the game however slowly it is photographed. The board is resized to
  fill 16:9 (as `tools/promo/shots.mjs` does); the scripted player's demo line is hidden; the HUD is on;
  every shot checks that all the board's art loaded and no "did not load" notice shows. No `src/` file
  was changed.
- Staging, all through `window.broodfall` (no game code changed): the scripted player plays the runs;
  the Maw shot puts weakened soldiers in the Maw's reach (as `tools/shot-maw-tongue.mjs` does); the
  core shot raises the limbs-grown count past 40; the boss shot sends in a royal and her consort; the
  creep shot puts creep nodes down past the edge one after another.
- **YOKE** is the real ship screen after a lost first mission, filmed the same way at twice the pixels
  (her clips follow the clock). **The boss's call** is the page's own real-time screencast (its
  captions run on his voice's clock); the frame-by-frame attempt never reached the call
  (`record` throws "never: the boss calls"), so the real-time recording is used.
- **New moving pictures** (three, RFab image-to-video, seegen sd2-mini, 720p, 4 s): the three faction
  contact scenes' own pictures (`art-src/ship/scenes/*-contact.png`) made to move. Every frame was
  looked at: no new lettering, no religious symbols, the insects keep their heads.
- Glue from the existing films: the opening film (`public/art/intro/`), the menu loop, two newsreel
  clips (`public/media/clips/`), the meteor key art.
- Titles are type, never the image model's: the film's titles as `src/onboard.css` sets them, the genre
  line and tagline as `tools/promo/compose.mjs` sets them, the logo exactly as `src/screens.css`.

## Cost

Three 4 s 720p clips at 24,640 tokens each, plus YOKE's voice and a few transcriptions: about
75,000 tokens (about $1.50). No top-up was needed.
