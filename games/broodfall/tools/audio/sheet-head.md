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
