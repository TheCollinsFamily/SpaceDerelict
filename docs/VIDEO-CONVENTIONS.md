# Video conventions: every AI-made film in every game here

Collins, Oct 5 2026: "establish conventions for future videos we make so they stay consistent". These are the rules
every film follows, whatever game it is for. Each came from a take he sent back; his words are kept beside them.
How Broodfall's films are made is in `games/broodfall/HANDOFF.md` "THE FILM SYSTEM". A new game copies that system,
not the rules alone.

## 1. One command, gated

A film is made by one command (Broodfall: `npx vite-node tools/media/cutscenes.ts -- make <film>`), never clip by clip
by hand. Every clip passes the gates before the next is built on it, and the finished film is heard for every line.
A clip that fails is made again alone. ("We need to build a system for handling videos like this and getting them
right on the first try going forward.")

## 2. The lowest resolution, always

480p (the lowest a model offers), for every AI video. ("Always use the lowest resolution output with AI; to humans
it's visually indistinguishable"; "it would save us a ton".) Stills stay at medium quality (Sep 2026: "use medium for
us, we want a quality product").

## 3. Acted, not assembled

Several lines in ONE clip on a model that talks (Broodfall: Seedance 2.5, clips up to 30 s), so that the turn-taking
and pauses are the model's performance. Never one line a clip; never a voice track with a picture made round it.
("The words sound like they were generated with AI then the video was created around them; that sounds stilted.")

## 4. The cast is written once

Every character's voice and look is described in ONE file of the game (Broodfall: `games/broodfall/content/cast.ts`),
and every clip of every film uses those words exactly. That is what keeps a voice the same across clips and films:
nothing is cloned. A new character goes into the cast file before their first film; a description is never changed
once a film uses it. Each character's look also has ONE reference picture, given to every still they appear in.

## 5. One camera per place; the protagonist from behind

One camera position for each place in a film, and every clip in that place goes on from the frame the one before it
ended on. The player's character is seen from behind: his face is never shown, and his feelings are carried by his
voice. ("The moving between looking at him and her doesn't really work ... it's better to see him from behind.")

## 6. No dead air

No silence over about a second anywhere, and none at the start of a clip that continues another. A cut goes between
two words, by the words' own times. ("There is a long period of dead space before she says ...")

## 7. Cuts and joins are made by RFab's video editor

Clips are uploaded (`/api/video-editor/upload-clip`) and the film is rendered by one `/api/video-editor/assemble-async`
call with the kept ranges (`preserveOrder: true`). No hand-made dissolves, blurs or fades. A tool the API lacks is built
into the API, not worked round in a game's folder. ("It never breaks with that, and the more tools we build into the
API and make sure work, the better.")

## 8. A clean picture, held steady

No snow, sparkle or static, and no face when there should be none (both asked of a model that sees). Colour,
brightness and sharpness stay the same from a take's first frame to its last.

## 9. No words over the picture

Subtitles are off unless the player turns them on in Settings. ("The words over the screen look dumb.")

## 10. Where films go

Into the game (Broodfall: `games/broodfall/public/media/scenes/`, listed in `scenes.json`), never onto his Desktop.
("Why are they on my desktop?") Raw clips stay in the game's `art-src-new/` (not in git). The report names the film
and the place in the game where it plays.

## 11. Only Collins can hear

No gate judges the acting. The report says plainly that nobody has listened to the film.
