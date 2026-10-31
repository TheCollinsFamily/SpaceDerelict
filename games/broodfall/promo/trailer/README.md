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

## The Steam demos (Oct 31 2026): three short videos, one part of the game each, on his songs

Collins: "make a few general demo videos for steam with the new music and focusing on different parts of the game". Three
gameplay videos of about 31 s, each on one part of the game and each on its own song of his (the 1940s electro swing of
Oct 29; `public/audio/mission/`, `public/audio/organ-stage/`), the song laid so its measured drop lands on the montage
(`tools/promo/trailer.mjs` DEMOS: the drop of each track found as the second whose next 4 s are loudest against the 4 s
before). No film and no intro in front of any of them: each opens from black on the game and ends on the logo, TOWER
DEFENCE + ROGUELITE, GENOCIDE SIMULATOR. Every shot is the real game (the captures of Oct 26 and one new one), except
the three landing films, which are the game's own.

| File | What | Song | Length | Size |
|---|---|---|---|---|
| `broodfall-demo-fight.mp4` | THE FIGHT: the tower defence itself: the board in a wave, the Megacity siege, the Maw, the Temple Cities, the upgrade looks firing, the royal (the narrator's line, captioned), the body late in a run; montage; logo. 1920x1080, 60 fps, H.264 High (CRF 19, capped 5.5 Mbit/s) + AAC 320k | Flag of Doom 7, from 4.1 s (its entry at 27.5 s on the montage) | 31.9 s | 21.2 MB |
| `broodfall-demo-body.mp4` | THE BODY: three limbs grown by hand (GROW THE BODY), a limb eaten into a new one (CANNIBALIZE), the organ stage by hand (GROW ORGANS), a limb EVOLVED by hand through its panel and growing into its Swarm look (new shot `p-evolve`), the core evolving, the looks firing; montage; logo | The Mutant from the Deep 1, the organ stage's own music, from 19.8 s (its surge at 43 s on the montage) | 31.0 s | 19.7 MB |
| `broodfall-demo-map.mp4` | THE MAP: the creep spread (SPREAD THE CREEP), the district draft by hand and the district consumed (CONSUME THE MAP), the body across its districts, the planet picked at the desk (TAKE THE PLANET), the 3D globe with held ground, three landings (the Foundry, the Megacity, the Temple Terraces); montage; logo | Haunted Level 2, from 48.2 s (its return at 71.5 s on the montage) | 31.1 s | 20.2 MB |
| `broodfall-demo-*-steam-upload-720p.mp4` | The same three for a browser upload capped at 10 MB: 1280x720, 30 fps, two-pass x264, AAC 96k | | | 9.6 to 9.7 MB |
| `contact-sheet-demo-*.jpg` | One frame of every shot of each demo, with its start time | | | |

All three: -14.0 LUFS integrated, true peak -1.5 dBTP; every frame counted (1914, 1860, 1865 at 60 fps) and the 720p copies
decoded end to end. The sound: the song from the top (ducked under the narrator in the fight), the game's own effects where
the game asked for them while the hand-played shots were filmed (`gameCues`), the wave sting at the top of the fight, the
narrator and the royal's roar on the royal, the core's own sound on the core, the landing roar and impact on each landing,
the core sting and the song's quiet start under the logo. Nobody has listened to them: the gates measure, Collins's ear decides.

**The new shot, `p-evolve`** (played by hand, twice the pixels, the cut keeps the top-left quarter so the panel and the limb
share the frame): a spitter clicked (its panel opens at the top left), the first stage's option A hovered and bought (20
science), and the limb grows into its Swarm look (three heads; content/upgradeLooks.ts: one stage bought is a class look).
The capture checks the limb's stage went up while it was filmed.

**Retired, Oct 31 2026: the YC demo intro.** Collins: "the ycombinator thing is done and not needed any more so dont include it
on future ones". No new video carries Neko Voss's intro; the two `*-yc-demo*.mp4` files stay as they were made, and
`tools/promo/intro.mjs` stays for the record.

### THE FIGHT (`cut demos fight`)

| Start (s) | Length (s) | Shot | What | Source |
|---|---|---|---|---|
| 0.00 | 4.00 | g-open | The whole board in a wave: a small tower defence (EVERY LIMB A TOWER) | real game, captured (g-open) |
| 4.00 | 3.60 | g-siege | A siege in the Megacity: limbs firing into the column | real game, captured (g-siege) |
| 7.60 | 3.40 | g-maw | The Maw's tongue catches a soldier and swallows it | real game, captured (g-maw) |
| 11.00 | 3.00 | g-temple | The Temple Cities under siege: shield domes, lightning and shot | real game, captured (g-temple) |
| 14.00 | 2.60 | g-looks | Limbs in their upgrade looks, firing | real game, captured (g-looks) |
| 16.60 | 3.80 | g-boss | A royal and her consort wade into the limbs (the narrator: "And here she comes. The royal herself takes the field.", captioned) | real game, captured (g-boss) |
| 20.40 | 3.00 | g-late | Late in a run: the whole body across its districts, in a wave | real game, captured (g-late) |
| 23.40 | 3.50 | m-* | Montage on the song's entry: the Megacity siege, the Maw, the Temple Cities, the royal, the looks | real game, captured |
| 26.90 | 5.00 | end | The name, TOWER DEFENCE + ROGUELITE, GENOCIDE SIMULATOR | key art, titles set in type |

### THE BODY (`cut demos body`)

| Start (s) | Length (s) | Shot | What | Source |
|---|---|---|---|---|
| 0.00 | 5.60 | p-build | By hand: three limb cards picked and grown on the creep, the ghost and its reach shown (GROW THE BODY) | real game, played by hand (p-build) |
| 5.60 | 4.40 | p-eat | Cannibalize: a limb hovered (lit; the hint says what eating it gives), eaten, its trait grown into a new limb (CANNIBALIZE) | real game, played by hand (p-eat) |
| 10.00 | 4.40 | p-organ | The organ stage: two organs picked, their ghosts over the body, grown (GROW ORGANS) | real game, played by hand (p-organ) |
| 14.40 | 4.40 | p-evolve | EVOLVE by hand: a limb clicked, its panel opens, the first stage bought; the limb grows into its new look | real game, played by hand (p-evolve) |
| 18.80 | 2.00 | g-core | The core evolves | real game, captured (g-core) |
| 20.80 | 2.40 | g-looks | Limbs in their upgrade looks, firing | real game, captured (g-looks) |
| 23.20 | 2.80 | m-* | Montage on the song's surge: the looks, the core, the new limb growing, the whole body | real game |
| 26.00 | 5.00 | end | The name, TOWER DEFENCE + ROGUELITE, GENOCIDE SIMULATOR | key art, titles set in type |

### THE MAP (`cut demos map`)

| Start (s) | Length (s) | Shot | What | Source |
|---|---|---|---|---|
| 0.00 | 3.00 | g-creep | Creep nodes put down past the edge; the creep spreads (SPREAD THE CREEP) | real game, captured (g-creep) |
| 3.00 | 2.28 | p-draft | THE BODY IS READY TO GROW: three districts hovered, one clicked | real game, played by hand (p-draft) |
| 5.28 | 2.60 | p-draft-b | The district consumed: the camera goes to it (CONSUME THE MAP) | real game, played by hand (p-draft) |
| 7.88 | 3.20 | g-late | Late in a run: the whole body across its districts, in a wave | real game, captured (g-late) |
| 11.08 | 2.60 | p-globe | The planet: a territory hovered and picked; the globe turns to it; its briefing (TAKE THE PLANET) | real game, played by hand (p-globe) |
| 13.68 | 3.00 | s-globe | The planet in 3D at the Directive Desk, held ground under the creep | real game, captured (s-globe) |
| 16.68 | 2.60 | land-1 | The landing: the brood falls on the Foundry | the game's landing film, public/art/landing/industrial.mp4 |
| 19.28 | 2.00 | land-2 | The landing: the Megacity | public/art/landing/megacity.mp4 |
| 21.28 | 2.00 | land-3 | The landing: the Temple Terraces | public/art/landing/terraces.mp4 |
| 23.28 | 2.80 | m-* | Montage on the song's return: the whole body, the creep, the Temple Cities, the Megacity siege | real game, captured |
| 26.08 | 5.00 | end | The name, TOWER DEFENCE + ROGUELITE, GENOCIDE SIMULATOR | key art, titles set in type |

Rebuild (in `games/broodfall`; the captures are in `art-src/trailer/cap/`, git-ignored):

```
node tools/promo/trailer.mjs capture p-evolve        # the one new shot (the other sixteen were filmed Oct 26)
node tools/promo/trailer.mjs titles                   # the cards, four new: CANNIBALIZE, GROW ORGANS, EVOLVE, SPREAD THE CREEP
node tools/promo/trailer.mjs cut demos                # all three, each with its 720p upload copy (`cut demos fight` for one)
node tools/promo/trailer.mjs sheet demos --list       # the contact sheets and the shot tables above
```

Steam: each goes up as its own trailer on the Trailers tab (category Gameplay), the 1080p file dragged on by hand, or the
720p copy through the browser (under its 10 MB cap). Not uploaded yet.

## The demo intro (Oct 30 2026): the trailers with Neko Voss in front, for Y Combinator (retired Oct 31 2026, see above)

Collins: "the game trailer for broodfall needs a thing in front of it before I submit it to Y Combinator as our demo ...
a short thing at the beginning with animation saying Claude Code + The RFab API built this game + trailer with only
limited human interaction. This is what Reality Fabricator unlocks. (have Neko Voss say it)".

| File | What | Length | Size |
|---|---|---|---|
| `broodfall-trailer-yc-demo.mp4` | The 11.6 s intro, then the 88 s store trailer: 1920x1080, 60 fps, H.264 High + AAC 320k | 99.6 s | 47.9 MB |
| `broodfall-trailer-yc-demo-gameplay.mp4` | The same intro, then the 71.1 s gameplay trailer (the B-movie opening, then the gameplay; Oct 31 2026) | 82.7 s | 46.4 MB |

The store trailers above are not changed. Both demo files: -14.0 LUFS, true peak -1.5 dBTP, picture and sound the same length
to the frame (`cut` counts them). Masters (CRF 16) and every take in `art-src/trailer/intro/` (git-ignored).

**The intro.** Neko Voss (rfab.ai's mascot, the cyberpunk catgirl nerd) stands at the left of a dark hacker den and says
Collins's line to camera, acted and spoken by one video model in one take; the words are set in type beside her, in step
with her own words: CLAUDE CODE / + THE RFAB API type themselves in (a terminal caret) as she says them, "built this game +
trailer" and "with only limited human interaction." come up as she reaches them, then the panel clears for THIS IS WHAT /
REALITY FABRICATOR / UNLOCKS. word by word, the RFab wordmark under it. From black, to black, and the trailer's own fade
from black follows.

- **Her picture** (`neko-169.png`, 1280x720): drawn by rfab.ai's image API (GPT Image 2, the default tier) from her public
  portrait `https://rfab.ai/assets/beat-brief/persona-neko.webp` as the reference, in the left third of a wide frame with
  the right two thirds dark for the type.
- **Her take** (`take-grok.mp4`, 736x400, 24 fps, 12 s): Grok Imagine Video 1.5 Lite (`grok:grok-imagine-video-1.5-lite`,
  xAI, 480p, the model's lowest tier), image-to-video from her picture with the line in the prompt: the model acts AND
  speaks it. Every word heard, "Fabricator" said FAB-ri-kay-ter, the crispest picture of the ten (looked at, frame against
  frame, at 1080p). A second finished intro from the Seedance 2.5 take with the word respelled is beside it
  (`intro-sd25-spell-master.mp4`, 12.7 s): softer, more mouth, in case the Grok read is not the one.
- **How it got here, three versions in a day.** (1) One acted Seedance 2.5 take, the plain line: every gate passed, the
  transcript wrote all 23 words, and Collins heard "Fabricator" said wrong. (2) The line as text-to-speech (Gemini Leda)
  lip-synced onto her picture with OmniHuman 1.5 (`take-omni.mp4`): the word right, and Collins: "whatever ai you used for
  the video looks AWFUL ... you can just use video models that speak". (3) This: ten acted takes from six models that speak,
  fired at once, each at its lowest tier, each judged by a model that LISTENS before anything else.
- **The listening gate** (`hear`, the LISTEN check): the clip's hosted link goes to rfab.ai's `POST /api/tools/watch-video`
  (Gemini watches and hears it) with the question written out: what she says word for word, the word after "Reality"
  syllable by syllable against FAB-ri-kay-ter, "Claude", "API" and "R-Fab" each OK or WRONG, the voice, whether her mouth
  moves with the words, and visual defects. **Calibrated before it was trusted:** on the take Collins heard wrong it wrote
  "FAB-ri-ker, PRONUNCIATION: WRONG, drops the kay syllable"; on the mini take beside it the same; on the TTS track
  "FAB-ri-kay-ter, OK". Two transcribers (Deepgram nova-2 and nova-3) wrote "Fabricator" for the wrong ones: a transcriber
  corrects what it hears to the word it expects, so a transcript can never be the pronunciation gate. About 1,000 tokens a
  clip.
- **The ten takes and what the gates said** (all 23 words heard unless noted; `take-*.gates.json` has each report):
  - `grok` (Grok 1.5 Lite, plain line): PASS, FAB-ri-kay-ter. Chosen.
  - `grok-say` (Grok 1.5 Lite, told how to say the words): PASS, FAB-ri-kay-ter.
  - `sd25-spell` (Seedance 2.5, "Fabricaytor" in the line): PASS, FAB-ri-kay-ter. The respelling is what fixes Seedance.
  - `sd25-say` (Seedance 2.5, told how to say it): FAIL, "FAB-ri-ker" again. Telling Seedance how to say a word does nothing.
  - `mini-spell` (Seedance 2.0 mini, respelled): PASS, FAB-ri-kay-ter; soft, a warped right hand.
  - `mini-say` (Seedance 2.0 mini, told): FAIL, ORDER: it said "This, what is Reality Fabricator, unlocks" (23 words, wrong
    order; this is the take that made the ORDER gate).
  - `h3-say` (MiniMax Hailuo 3.0 Developer): PASS, but a teal shape grows at the bottom left in two frames (seen on the sheet).
  - `wan-say` (Wan 3.0, 15 s): PASS, but her jacket's pattern changes and the mug comes and goes; the camera drifts in.
  - `kling-say` (Kling 3.0, API 2; came back 1080p, that pathway's default): FAIL, her mouth never moves, and an extra
    "Vabicator" after the line. The dearest take of the ten.
  - `veo-say` (Veo 3.1 Lite, 8 s, the model's longest): PASS, but a caption appears top left and her hair flares white at the end.
- **The other gates** (`hear`): every written word heard (rfab.ai transcription with word times), the last sentence whole and
  in order (ORDER), no ad-lib, no pause over 1.3 s, not cut off, a woman's pitch, brightness and sharpness steady from her
  first word to her last, and eight frames shown to a model that sees (on model, no lettering, no static, nothing growing
  out of her). On the TTS takes also: the sound IS the TTS track (cross-correlation).
- **The type**: Oswald 700 and Bahnschrift (the trailer's faces), rendered frame by frame at 60 fps in headless Chromium as
  transparent PNGs (`titles/grok/`, 695 frames), each line cued to the time her word was heard, over the take fitted to 1080p
  (cover and crop). Her first frame is held 0.64 s so her first word lands at 0.7 s, after the fade from black; her last frame
  is held 1.1 s after her last word; the trailer's sound begins at 11.608 s, the join (measured). The gameplay demo was
  rebuilt Oct 31 2026 on the gameplay cut with the B-movie in front: 82.7 s, 4960 frames (695 + the trailer's), the
  plot from 11.6 s, the board from 26.8 s.
- **The finished intro was listened to as a whole** (`intro-grok-master.mp4` uploaded and put to the same listening model):
  the line word for word, FAB-ri-kay-ter OK, the type in step with the phrases, a clean end, no picture defects. Nobody has
  heard her acting: the gates measure, Collins's ear decides.

Rebuild (in `games/broodfall`):

```
node tools/promo/intro.mjs still          # her picture (skips what is on disk)
node tools/promo/intro.mjs clips          # every acted take in TAKES at once, one per model and prompt variant (skips what is on disk)
node tools/promo/intro.mjs hear           # transcript + gates for every take, the LISTEN gate among them; writes chosen.txt
node tools/promo/intro.mjs titles grok    # the type, 695 frames, cued to the take's words
node tools/promo/intro.mjs cut grok       # the intro, then both demo files (checks frame counts and lengths)
node tools/promo/intro.mjs sheet grok     # a strip of frames of the finished intro, to look at
```

(`voice` and `sync` are the rejected TTS-and-lip-sync path, kept so the comparison can be rerun.)

Cost, by the balance before and after: this third version 810,141 tokens ($16.20): the ten acted takes 782,521 (Kling 3.0
at its pathway's 1080p default the largest single item; Grok Lite the smallest, about 20,000 each), the gates about 27,600
(ten transcripts, ten vision strips, fifteen listens). The day's three versions together about 1,300,000 tokens ($26). A
$50 top-up (2,500,000 tokens) was made before the batch; 2,373,541 tokens remain.

## The gameplay cut (Oct 26 2026; the B-movie in front since Oct 31 2026)

| File | What | Length | Size |
|---|---|---|---|
| `broodfall-trailer-gameplay.mp4` | The second store trailer: the 15 s B-movie opening (the plot), then pure gameplay: 1920x1080, 60 fps, H.264 High (CRF 19, capped 5.5 Mbit/s) + AAC 320k | 71.1 s | 45.8 MB |
| `broodfall-trailer-gameplay-steam-upload-720p.mp4` | The same for a browser upload capped at 10 MB: 1280x720, 30 fps, two-pass x264 at 976 kbit/s, AAC 96k | 71.1 s | 9.64 MB |

Collins: "focused on gameplay of the tower defence, global map, choosing map pieces, and monster building (not much
of the ship, just pure gameplay) so we don't have just one trailer." Every shot is the real game except the landing
film, which is the game's own (it plays before every deployment). No ship rooms, no faction films, no voices but the
game's narrator over the royal and, since Oct 31 2026, the newsreel narrator over the opening.

**The B-movie in front (Oct 31 2026).** Collins, of the demo built on the pure cut: "like it a lot better with the updated
trailer but you removed the plot elements at the beginning". The cut now opens as the 90 s cut does, with the plot from
the game's own opening film: the quiet town (IT WAS A QUIET NIGHT), the townsfolk looking up (IT CAME FROM THE SKY!), the
meteor, the impact, the creep (IT WAS HUNGRY), the newsreel narrator's three lines over the film's own score; a hard cut
to the board at 15.2 s, where the song begins. The same five shots and the same sound as the 90 s cut (`shotsBMovie`,
`soundBMovie` in the script, shared by both). The gameplay after it is unchanged shot for shot, 15.2 s later; the song
still drops on the montage. The plain cut is still made by `cut gameplay --pure` (to `broodfall-trailer-gameplay-pure.mp4`,
not kept here).

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
| 0.00 | 4.00 | sky | A quiet night in a quiet little insect town (IT WAS A QUIET NIGHT; the narrator: "It was a quiet night in a quiet little town.") | the opening film, public/art/intro/sky.mp4 |
| 4.00 | 3.60 | lookup | The townsfolk look up: IT CAME FROM THE SKY! ("Until something came down out of the sky.") | the opening film, public/art/intro/lookup.mp4 |
| 7.60 | 2.60 | fall | The living meteor falls on the town | the opening film, public/art/intro/fall.mp4 |
| 10.20 | 2.60 | impact | Impact | the opening film, public/art/intro/impact.mp4 |
| 12.80 | 2.40 | creep | The creep swallows a street and a car (IT WAS HUNGRY; "It was hungry.") | the opening film, public/art/intro/creep.mp4 |
| 15.20 | 3.60 | g-open | The whole board in a wave: a small tower defence (EVERY LIMB A TOWER); the song begins | real game, captured |
| 18.80 | 3.00 | g-maw | The Maw's tongue catches a soldier and swallows it | real game, captured |
| 21.80 | 2.60 | g-temple | The Temple Cities under siege: shield domes, lightning and shot | real game, captured |
| 24.40 | 3.60 | g-boss | A royal and her consort wade into the limbs (the narrator: "And here she comes...") | real game, captured |
| 28.00 | 5.60 | p-build | By hand: three limb cards picked and grown on the creep, the ghost and its reach shown (GROW THE BODY) | real game, played by hand |
| 33.60 | 4.40 | p-eat | Cannibalize: a limb hovered (lit; the hint says what eating it gives), eaten, its trait grown into a new limb | real game, played by hand |
| 38.00 | 4.40 | p-organ | The organ stage: two organs picked, their ghosts over the body, grown | real game, played by hand |
| 42.40 | 1.80 | g-core | The core evolves | real game, captured |
| 44.20 | 2.20 | g-looks | Limbs in their upgrade looks, firing | real game, captured |
| 46.40 | 2.28 | p-draft | THE BODY IS READY TO GROW: three districts hovered, one clicked (close on the panel) | real game, played by hand |
| 48.68 | 2.60 | p-draft-b | DISTRICT CONSUMED: the camera goes to the new district (CONSUME THE MAP) | real game, played by hand |
| 51.28 | 2.40 | g-creep | Creep nodes put down past the edge; the creep spreads over the new district | real game, captured |
| 53.68 | 3.20 | g-late | Late in a run: the whole body across its districts, in a wave | real game, captured |
| 56.88 | 2.60 | p-globe | The planet at the Directive Desk (cropped to the globe and the briefing): a territory hovered, picked, the globe turns to it | real game, played by hand |
| 59.48 | 2.60 | landing | The brood falls on the new territory (TAKE THE PLANET) | the game's landing film, public/art/landing/industrial.mp4 |
| 62.08 | 3.50 | m-* | Montage on the music's drop: the whole body, the Maw, the royal, the Temple Cities, the upgrade looks | real game, captured |
| 65.58 | 5.50 | end | The name, TOWER DEFENCE + ROGUELITE, GENOCIDE SIMULATOR | key art, titles set in type |

(The pure cut, `--pure`, is the same from g-open on, 15.2 s earlier, opening from black on the board.)

Rebuild (in `games/broodfall`; raw footage in `art-src/trailer/`, git-ignored):

```
node tools/promo/trailer.mjs capture g-open g-maw g-temple g-boss g-core g-looks g-creep g-late p-build p-eat p-organ p-draft p-globe
node tools/promo/trailer.mjs titles
node tools/promo/trailer.mjs cut gameplay      # the 1080p file AND the under-9.8 MB 720p upload copy (the B-movie in front)
node tools/promo/trailer.mjs cut gameplay --pure   # the plain gameplay cut, to broodfall-trailer-gameplay-pure.mp4 (not kept)
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
