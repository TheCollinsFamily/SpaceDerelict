# Broodfall sound: the listening sheet (Sep 30 2026)

Every sound Broodfall plays, made through the RFab API on Collins's account and baked by
`node tools/audio/make.mjs` (cues and prompts: `tools/audio/cues.mjs`; this sheet and the reels:
`node tools/audio/sheet.mjs`). The game plays them with `src/audio/` (WebAudio).

**Listen first:**

- `C:\Users\Merry\dev\space-derelict\games\broodfall\notes\screens\2026-09-30\audio-proof.mp4`: the game played through with its sound (the film behind ▸ BEGIN, mission 1, the defeat, the ship, the boss; the menu and the settings; a skirmish with two waves, the organ stage, the royal, the win). The sound is the page's own mixed output, recorded in the page.
- `C:\Users\Merry\dev\space-derelict\games\broodfall\notes\screens\2026-09-30\audio-reel-music.ogg`: every piece of music; each loop's first 20 s, then its seam (last 6 s into first 6 s: there should be no bump).
- `C:\Users\Merry\dev\space-derelict\games\broodfall\notes\screens\2026-09-30\audio-reel-sfx.ogg`: every effect with all its variants, in the order of the table below.
- `C:\Users\Merry\dev\space-derelict\games\broodfall\notes\screens\2026-09-30\audio-reel-voice.ogg`: the newsreel narrator's lines.

**How it was made.** Music: Eleven Music v2 (`elevenlabs:music_v2`, 250 tokens a second, instrumental),
chosen over Mureka V9 (ignored "no drums" and came back busy and full-band), Lyria 3 and MiniMax after
a probe. Effects: RFab has NO sound-effect route (no ElevenLabs sound generation, no text-to-audio);
the closest route is a text-to-video model that makes its own soundtrack. MiniMax Hailuo 3.0
(`atlascloud:h3-t2v`, 480p) gave the cleanest separated takes of the three probed (Veo 3.1 Lite had a
hiss floor, Wan 3.0 crackle), and the cheapest: an 8 s take is about 23,000 tokens ($0.47). The
picture is thrown away; each take asks for the sound several times with silence between, and every
separate sound in it becomes a variant. Narrator: Veo 3.1 Lite (`imagerouter:veo-3.1-lite-t2v`), a
1950s newsreel announcer speaking the exact line (its speech is far more "period" than a TTS voice),
through a narrow old-microphone EQ; every line was transcribed back to check it says what it should.

**Levels.** Music and stingers -16 LUFS; effects about -14 LUFS (an RMS over the sounding part, peaks
under -1 dBFS); the narrator -16 LUFS. All Opus in `.ogg` (music stereo 128k, effects and voice mono
64k). Loops are baked seamless: the steady part of the take is kept (its fade-in and fade-out cut),
and its last 4 s are crossfaded into its first 4 s. "Seam jump" below compares the sample-to-sample
movement across the loop point with the track's own average (about 1 = no click).

**The mix** (`src/audio/engine.ts`, `src/audio/cues.ts`): master → music / effects / voices, each
tied to its Settings slider as it moves (and saved). Music is a scene: film, menu, ship, the run's
build, the assault (crossfades in when three or more insects are on the board during a siege, and
holds until the board is clear), the organ stage, the end. A loop left returns where it was left.
Stingers duck the loop to 35%. YOKE's voice, the boss's message and the narrator duck the music to
30% and the effects to 60%. Effects are limited per sound (a least gap between starts, at most 1 to 4
at once, ±0.5–2 semitones of pitch, never the same variant twice running) and 24 at once in all;
limbs firing are the quietest sounds on the board. Settings: a new "Mute when away" (on by default).

## Music

| id | what it is for | seconds | loop (seam jump ×) | LUFS | peak dBFS | model | asked for |
|---|---|---|---|---|---|---|---|
| `theme-menu` | the main menu: the ship's hum | 110.0 | yes (0.79) | -16.0 | -2.9 | elevenlabs:music_v2 | dark ambient, drone, austere, eerie, cold, patient. The hum of a black orbital warship over an infested planet. Austere, sparse, a little eerie. A low steady drone with slow shifting overtones and a very quiet far-off pulse, now and then a single cold bowed-metal tone. No drums, no melody hooks, no vocals. Constant level from start to end so it loops. |
| `theme-ship` | the ship's rooms (desk, gene bay, comms, AI core) | 100.0 | yes (0.53) | -16.0 | -7.0 | elevenlabs:music_v2 | dark ambient, minimal electronic, clinical, sterile, uneasy, calm. Inside the bridge of a black, silent Technopuritan warship: sterile, clinical, bureaucratic. A low room tone, soft cold pads and rare glassy notes, the quiet of machines that work. No drums, no vocals. Constant level from start to end so it loops. |
| `siege-build` | a deployment, wave setup and the early siege (the lower intensity) | 86.0 | yes (1.94) | -16.0 | -1.3 | elevenlabs:music_v2 | 1950s newsreel score, march, b-movie, jaunty, ominous, official, cheerful menace. A 1950s newsreel and B-movie score: brassy, jaunty and ominous at once, a march that keeps strict time. Big band brass, snare drum, timpani, tuba, a little xylophone. Mono-era orchestral colour. No vocals. This is the calm part: a light, sly, tiptoeing march with muted trumpets and pizzicato, the cheer of a pest-control advert over a hint of dread. Constant level so it loops. |
| `siege-assault` | a deployment, the assault (the higher intensity) | 83.0 | yes (0.72) | -16.0 | -2.6 | elevenlabs:music_v2 | 1950s newsreel score, march, b-movie, urgent, triumphant, ominous, driving. A 1950s newsreel and B-movie score: brassy, jaunty and ominous at once, a march that keeps strict time. Big band brass, snare drum, timpani, tuba, a little xylophone. Mono-era orchestral colour. No vocals. This is the battle: a full, driving, brassy war march at speed, blaring trumpets and trombones over pounding timpani and rattling snare, heroic and monstrous at once. Constant intensity so it loops. |
| `organ` | the organ stage (between waves, underground) | 116.0 | yes (0.58) | -16.0 | -1.9 | elevenlabs:music_v2 | dark ambient, organic drone, low, organic, breathing, intimate, strange. Underground inside a living organism growing around a buried meteor: low, warm and organic. A slow heartbeat, deep breathing drones, soft wet textures and low cello harmonics. Calm, patient, a little wrong. No drums, no vocals. Constant level so it loops. |
| `sting-wave` | a wave is called | 6.0 | no | -16.0 | -4.2 | elevenlabs:music_v2 | 1950s newsreel fanfare, alarming, jaunty. A short 1950s newsreel brass fanfare announcing an attack: a snare roll and a bold, slightly comic call to arms. Ends on a held chord. |
| `sting-cleared` | a wave cleared | 5.0 | no | -15.2 | -1.8 | elevenlabs:music_v2 | 1950s newsreel fanfare, cheerful, official. A very short, cheerful 1950s newsreel brass flourish: job done, resources acquired. Ends on a bright major chord with a cymbal. |
| `sting-victory` | the deployment won | 11.8 | no | -16.0 | -2.3 | elevenlabs:music_v2 | 1950s newsreel fanfare, march, triumphant, grand, hollow. A triumphant 1950s newsreel victory fanfare, big brass and timpani, grand and patriotic, with a slightly hollow, unsettling final chord. |
| `sting-defeat` | the deployment lost | 10.1 | no | -16.0 | -3.2 | elevenlabs:music_v2 | 1950s b-movie score, defeated, ominous, somber. A short 1950s monster-movie defeat cue: low brass descending in a minor key, a timpani roll and a final dark sustained chord that fades. |
| `sting-desk` | the Directive Desk opens / a faction calls | 6.1 | no | -16.0 | -4.3 | elevenlabs:music_v2 | minimal electronic, clinical, expectant. A short, clean, cold electronic motif announcing an incoming transmission on a starship: three glassy rising notes over a low drone, then a held tone. |
| `sting-core` | the core evolves | 5.9 | no | -16.3 | -3.0 | elevenlabs:music_v2 | 1950s b-movie score, awe, monstrous, swelling. A short 1950s monster-movie sting: a rising theremin wail over tremolo strings and a swelling low brass chord, ending on a timpani hit. The monster grows. |
| `film` | the opening film (the trailer of a 1950s monster picture) | 36.1 | no | -15.5 | -1.1 | elevenlabs:music_v2 | 1950s b-movie score, monster movie trailer, quiet, ominous, rising, lurid. The score of a 1950s monster picture trailer, 36 seconds. 0-8 s: a quiet night in a small town, soft celesta and harp, peaceful with a hint of unease. 8-16 s: something falls from the sky, a theremin wail rising, strings tremolo, a huge timpani and brass hit at 12 s for the impact. 16-24 s: dread, low brass creeping, it is hungry. 24-31 s: the town fights back, a frantic brass march at speed. 31-36 s: the title card, a massive brass chord with a theremin on top, held and ringing out. |

Files:

- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\theme-menu.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\theme-ship.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\siege-build.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\siege-assault.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\organ.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\sting-wave.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\sting-cleared.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\sting-victory.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\sting-defeat.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\sting-desk.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\sting-core.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\film.ogg`

## Effects

| id | what it is for | variants (seconds each) | peak dBFS | model | asked for |
|---|---|---|---|---|---|
| `fire-spit` | a limb spits acid (Spitter, Seedling, Blight Vent) | 6: 0.38, 0.94, 0.57, 0.55, 0.48, 0.61 | -2.7 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. Macro shot of a wet fleshy alien creature on black spitting globs of acid: a sharp wet splutter and hiss. It happens 6 separate times, each one clearly separated by a second of total silence. |
| `fire-harpoon` | Impaler, Creep Lance: a bone harpoon | 3: 0.58, 1.04, 0.95 | -3.3 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A heavy bone harpoon is launched from a taut wet sinew: a deep twang, a fast whoosh and a meaty thunk. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `fire-quills` | Quill Fan, Boomerang Node: a volley of quills | 5: 0.40, 1.12, 1.26, 1.87, 1.40 | -2.4 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A fan of sharp bony quills is fired all at once from a fleshy pod: a rattling, hissing volley of darts whistling away. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `fire-lightning` | Galvanic Frond: organic lightning | 5: 0.53, 0.62, 0.57, 0.59, 0.90 | -1.3 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A wet fleshy frond discharges a bolt of electricity: a sharp crackling snap and buzzing zap of an electric arc. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `fire-beam` | Arc Prism, Ocular Stalk: a beam of light | 4: 0.15, 2.42, 0.73, 1.94 | -2.6 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A crystalline organic prism fires a short beam of light: a bright resonant humming whine that swells for half a second and cuts off. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `fire-flame` | Ember Sac: a jet of flame | 2: 2.84, 2.74 | -2.4 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A gas sac spews a short jet of fire: a whooshing roar of flame with a gassy pop at the start. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `fire-lob` | Burster, Bile Lobber, Spore Sling, Spore Bombard, Skipping Mortar: a lobbed glob | 4: 0.73, 0.60, 0.64, 0.59 | -2.5 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A fleshy organic mortar launches a heavy glob into the air: a deep hollow wet thump, like a giant cork pulled out of flesh. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `fire-bite` | Maw, Spine Wall, Broodmother: a bite | 5: 1.09, 0.43, 0.46, 0.45, 0.84 | -2.8 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A huge wet toothed maw snaps shut on something: a crunchy bone-crushing bite with teeth clacking and gristle tearing. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `fire-web` | Netcaster, Snare Bed: a web shot | 5: 0.54, 0.37, 0.29, 0.46, 0.52 | -2.4 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A sticky web of mucus is shot out: a fast wet thwip and the stretch of gooey strands. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `fire-lash` | Lasher: a whip of flesh | 4: 0.53, 0.40, 0.43, 0.50 | -2.7 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A thick fleshy tentacle lashes out like a whip: a wet swish and a sharp slapping crack. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `fire-hiss` | Caustic Mister: a spray of caustic mist | 3: 1.43, 1.71, 1.79 | -2.6 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. An organic vent sprays a burst of caustic mist: a short pressurised hiss with a bubbling gurgle. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `hit-splat` | a shot strikes (spit, harpoon, web) | 6: 0.44, 0.38, 0.37, 0.35, 0.40, 0.35 | -2.2 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. Small globs of acid splat against a hard insect carapace: a short wet splat and a sizzle. It happens 6 separate times, each one clearly separated by a second of total silence. |
| `hit-blast` | a shell or glob lands and bursts | 4: 0.57, 2.22, 0.57, 2.00 | -2.8 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. An organic spore shell lands on a street and bursts: a muffled wet explosion with spattering debris. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `enemy-cannon` | the insects' cannon and mortar crews fire | 4: 1.71, 1.71, 1.69, 0.90 | -2.7 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A 1950s army field cannon fires: a deep booming shot with a short metallic echo. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `die-bug` | a small insect dies (militia, skitterling, workers, sappers) | 6: 1.11, 0.30, 1.22, 0.45, 0.25, 0.21 | -2.3 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A large beetle is crushed: a crunchy carapace crack and a short, high dying chitter of mandibles. It happens 6 separate times, each one clearly separated by a second of total silence. |
| `die-soldier` | an armoured insect dies (soldier, elite, phalanx, carapace, crews) | 4: 2.16, 1.79, 1.19, 1.05 | -2.3 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. An armoured insect soldier falls: a heavy chitin crunch and the clatter of a steel helmet and rifle dropping on pavement. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `die-flier` | a flier is shot down | 4: 1.26, 1.10, 1.02, 1.36 | -6.0 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A large flying insect is hit in the air: its buzzing wings sputter and stall, then a crunchy thud as it hits the ground. It happens 3 separate times, each one clearly separated by a second of total silence. |
| `die-boss` | a royal (royal, consort, matron) dies | 1: 7.49 | -2.5 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A gigantic insect queen dies: a long, low, shuddering screech of pain, then a massive crashing collapse of chitin and a final rattle. |
| `boss-roar` | THE ROYAL TAKES THE FIELD | 1: 6.57 | -1.9 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A gigantic insect queen arrives: a huge, deep, rattling roar with chittering mandibles, and a heavy thundering footstep. |
| `creep-spread` | creep placed or spreading (a node) | 4: 0.31, 1.06, 0.42, 1.01 | -2.6 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. Wet organic tissue spreads and crawls quickly over concrete: a short squelching slurp. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `creep-pulse` | the creep grows a node on its own (a bladder's pulse) | 4: 0.59, 0.54, 0.53, 0.50 | -3.0 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A single deep wet heartbeat of a giant organism under the ground: a low muffled thump-thump. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `limb-grow` | a limb is grown (a card placed on the board) | 5: 1.17, 0.83, 0.79, 1.04, 1.69 | -2.7 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A fleshy limb bursts up out of the ground and unfurls: wet tearing, squelching growth and creaking bone. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `limb-wither` | a limb withers (its creep died) | 4: 0.40, 1.08, 0.50, 0.54 | -2.0 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. Living tissue withers and dies: a dry crackle, a deflating hiss and a soft wet collapse. It happens 3 separate times, each one clearly separated by a second of total silence. |
| `limb-lost` | a limb or organ is destroyed or carried off | 4: 0.43, 0.63, 0.93, 1.55 | -1.7 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A thick wet leather sack is ripped open and a bundle of dry branches snaps inside it: a violent wet tearing and a crunch. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `cannibalize` | a limb is cannibalized into the next build | 1: 6.57 | -3.0 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A creature devours one of its own limbs: slurping, gulping, crunching bone and one satisfied wet swallow. |
| `core-evolve` | the core evolves (stage 2, 3, 4) | 1: 8.01 | -4.3 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A giant organism grows into a bigger form: a deep swelling organic groan, bones cracking and reshaping, and a great surging heartbeat. |
| `plinth-rise` | a plinth rises under a limb | 3: 1.97, 0.62, 2.28 | -2.7 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A pillar of bone and flesh rises out of the ground: grinding bone, creaking and a deep rumble, ending in a solid thud. It happens 3 separate times, each one clearly separated by a second of total silence. |
| `organ-place` | an organ is grown or upgraded (the organ stage) | 3: 0.53, 0.53, 0.61 | -3.4 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A soft fleshy organ is set into place and connects: a wet squelch and a soft heavy thump. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `evolve-limb` | a limb EVOLVES (stage A/B picked) | 1: 3.21 | -6.3 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A limb mutates: a quick wet crackle of reshaping flesh and a rising shimmering organic swell. It happens 3 separate times, each one clearly separated by a second of total silence. |
| `wave-siren` | a wave is called: the town's air-raid siren, far off | 1: 8.01 | -3.5 | atlascloud:h3-t2v | Sound only, no music, no speech. A 1950s air-raid siren wails over a small town at night, heard from a distance, rising and falling once. |
| `assault-march` | the assault forms at the gates: boots, drums, chevrons | 1: 8.01 | -3.5 | atlascloud:h3-t2v | Sound only, no music melody, no speech. At a heavy stone city gate three loud mechanical clanks lock into place one after another, then an army of armoured insect soldiers marches in step: boots and chitin stamping, a snare drum keeping time. |
| `ui-click` | a button pressed | 6: 0.12, 0.12, 0.12, 0.17, 0.11, 0.12 | -2.4 | atlascloud:h3-t2v | Sound design only: no music, no speech. A clean, sparse, austere user-interface sound of a black-glass starship console: precise, quiet, expensive, a little cold. A single crisp tactile click of a heavy console key. It happens 8 separate times, each one clearly separated by a second of total silence. |
| `ui-hover` | the pointer over a button | 5: 0.07, 0.08, 0.16, 0.20, 0.09 | -3.2 | atlascloud:h3-t2v | Sound design only: no music, no speech. A clean, sparse, austere user-interface sound of a black-glass starship console: precise, quiet, expensive, a little cold. A very soft, very short electronic tick. It happens 8 separate times, each one clearly separated by a second of total silence. |
| `ui-confirm` | a decision made: deploy, continue, choose | 4: 0.33, 0.28, 0.35, 0.23 | -6.7 | atlascloud:h3-t2v | Sound design only: no music, no speech. A clean, sparse, austere user-interface sound of a black-glass starship console: precise, quiet, expensive, a little cold. A clean two-tone rising electronic confirmation chirp. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `ui-deny` | what cannot be done (a disabled button, an invalid cell) | 4: 0.52, 0.22, 0.22, 0.23 | -3.6 | atlascloud:h3-t2v | Sound design only: no music, no speech. A clean, sparse, austere user-interface sound of a black-glass starship console: precise, quiet, expensive, a little cold. A low, dull, short electronic denial buzz. It happens 4 separate times, each one clearly separated by a second of total silence. |
| `card-draw` | a card drawn into the hand | 4: 1.60, 1.22, 0.85, 1.61 | -2.8 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A stiff card slides off the top of a deck: a quick soft paper swish. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `card-pick` | a card picked up from the hand | 5: 0.25, 0.27, 0.27, 0.30, 0.26 | -1.9 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A stiff card is flicked and snapped between two fingers: a short crisp paper snap. It happens 5 separate times, each one clearly separated by a second of total silence. |
| `pad-won` | the data pad set down calmly (won) | 2: 0.30, 0.32 | -2.5 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A glass tablet is set down calmly on a metal desk: a soft solid clack. It happens 2 separate times, each one clearly separated by a second of total silence. |
| `pad-lost` | the data pad dropped (lost) | 2: 0.52, 0.62 | -2.8 | atlascloud:h3-t2v | Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. A glass tablet is dropped from a hand onto a metal desk: a hard clattering drop and a short rattle. It happens 2 separate times, each one clearly separated by a second of total silence. |
| `intercom-open` | YOKE's intercom opens | 3: 0.64, 0.81, 0.75 | -4.9 | atlascloud:h3-t2v | Sound design only: no music, no speech. A clean, sparse, austere user-interface sound of a black-glass starship console: precise, quiet, expensive, a little cold. A starship intercom channel opens: a short burst of soft static and a clean two-note rising chime. It happens 3 separate times, each one clearly separated by a second of total silence. |
| `intercom-close` | YOKE's intercom closes | 3: 0.83, 0.18, 0.18 | -6.9 | atlascloud:h3-t2v | Sound design only: no music, no speech. A clean, sparse, austere user-interface sound of a black-glass starship console: precise, quiet, expensive, a little cold. A starship intercom channel closes: a descending two-note chime and a soft click of static. It happens 3 separate times, each one clearly separated by a second of total silence. |
| `print-body` | the print-a-body scene (a bio-printer at work) | 1: 12.23 | -3.2 | atlascloud:h3-t2v | Sound only, no music, no speech. Inside a sterile starship lab a biological 3D printer prints a human body: whirring servos, a humming vat, wet dripping and sloshing fluid, soft mechanical clicks. |

Files (every variant):

- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-spit-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-spit-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-spit-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-spit-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-spit-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-spit-6.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-harpoon-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-harpoon-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-harpoon-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-quills-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-quills-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-quills-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-quills-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-quills-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lightning-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lightning-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lightning-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lightning-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lightning-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-beam-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-beam-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-beam-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-beam-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-flame-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-flame-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lob-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lob-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lob-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lob-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-bite-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-bite-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-bite-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-bite-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-bite-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-web-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-web-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-web-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-web-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-web-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lash-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lash-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lash-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-lash-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-hiss-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-hiss-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\fire-hiss-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-splat-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-splat-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-splat-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-splat-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-splat-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-splat-6.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-blast-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-blast-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-blast-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\hit-blast-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\enemy-cannon-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\enemy-cannon-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\enemy-cannon-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\enemy-cannon-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-bug-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-bug-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-bug-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-bug-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-bug-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-bug-6.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-soldier-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-soldier-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-soldier-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-soldier-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-flier-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-flier-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-flier-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-flier-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\die-boss.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\boss-roar.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-spread-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-spread-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-spread-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-spread-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-pulse-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-pulse-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-pulse-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\creep-pulse-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-grow-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-grow-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-grow-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-grow-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-grow-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-wither-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-wither-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-wither-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-wither-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-lost-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-lost-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-lost-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\limb-lost-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\cannibalize.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\core-evolve.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\plinth-rise-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\plinth-rise-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\plinth-rise-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\organ-place-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\organ-place-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\organ-place-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\evolve-limb-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\wave-siren.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\assault-march.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-click-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-click-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-click-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-click-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-click-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-click-6.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-hover-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-hover-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-hover-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-hover-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-hover-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-confirm-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-confirm-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-confirm-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-confirm-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-deny-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-deny-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-deny-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\ui-deny-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-draw-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-draw-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-draw-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-draw-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-pick-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-pick-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-pick-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-pick-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\card-pick-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\pad-won-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\pad-won-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\pad-lost-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\pad-lost-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\intercom-open-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\intercom-open-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\intercom-open-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\intercom-close-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\intercom-close-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\intercom-close-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\print-body.ogg`

## The newsreel narrator

| id | when | seconds | the line | heard back (Deepgram) | model |
|---|---|---|---|---|---|
| `nar-film-1` | film: sky | 3.84 | It was a quiet night, in a quiet little town. | It was a quiet night in a quiet little town. | imagerouter:veo-3.1-lite-t2v |
| `nar-film-2` | film: lookup | 3.12 | Until something came down out of the sky! | Until something came down out of the sky. | imagerouter:veo-3.1-lite-t2v |
| `nar-film-3` | film: crater | 3.75 | Nobody knew what it was. | Nobody knew what it was. | imagerouter:veo-3.1-lite-t2v |
| `nar-film-4` | film: creep | 3.76 | It was hungry. | It was hungry. | imagerouter:veo-3.1-lite-t2v |
| `nar-film-5` | film: militia | 4.02 | They fought it, street by street! | They fought it street by street. | imagerouter:veo-3.1-lite-t2v |
| `nar-film-6` | film: rise | 3.96 | And it kept growing! | And it kept growing. | imagerouter:veo-3.1-lite-t2v |
| `nar-wave` | a wave is called (sometimes) | 3.51 | Here they come! The colony sends in its finest! | Here they come. The colony sends in its finest. | imagerouter:veo-3.1-lite-t2v |
| `nar-wave-2` | a wave is called (sometimes) | 3.93 | The pests are on the march! Clearance operations proceed on schedule! | The pests are on the march. Clearance operations proceed on schedule. | imagerouter:veo-3.1-lite-t2v |
| `nar-cleared` | a wave cleared (sometimes) | 3.89 | Another wave cleared! Resources acquired for the Empire! | Another wave cleared. Resources acquired for the empire. | imagerouter:veo-3.1-lite-t2v |
| `nar-royal` | the royal takes the field | 3.95 | And here she comes: the royal herself takes the field! | And here she comes. The royal herself takes the field. | imagerouter:veo-3.1-lite-t2v |

Files:

- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-film-1.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-film-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-film-3.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-film-4.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-film-5.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-film-6.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-wave.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-wave-2.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-cleared.ogg`
- `C:\Users\Merry\dev\space-derelict\games\broodfall\public\audio\nar-royal.ogg`
