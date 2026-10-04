# Persona passes: he walks into the room (Oct 4 2026)

PLAYTEST_PROTOCOL.md, step 3. Played in the real page on the dev server (what `npm start` and `Play Broodfall.bat` run),
by real clicks: `node tools/shot-ship-arrivals.mjs` (tour, switch, none, calm, report, aboard, break: 86 checks, all pass).
Screens and the film of the whole tour: `notes/screens/2026-10-04/arrivals/` (`<room>-1-empty.jpg`, `-2-walking.jpg`,
`-3-in-place.jpg`, `tour.mp4`). The clips themselves: `notes/art-review/ship-arrivals/<room>-strip.jpg`.

## Newcomer (on the ship for the first time, clicking the room buttons)

- **Do I wait?** No. The room's screen is the new room's within 81 to 144 ms of the click in all eight rooms, and it
  answered a second click (YOKE called up) while he was still walking in seven of seven rooms tried. PASS.
- **Do I understand what I am seeing?** The room is empty for a blink, then a man in black walks in from beside the
  camera with his back to me and takes his place: at the tank with his tablet, onto the bench at the console, onto the
  stool at his notebook. It reads as "he went there", and it is the same man in every room. PASS.
- **The AI Core.** She is already standing on her dais when the room opens, and he walks in to her. The best of the
  eight: it looks like she was waiting. PASS.
- FOUND, left as it is: coming aboard, YOKE's greeting intercom sits on the lower left of the room, so his legs walk
  behind it and I see his head and shoulders above it. The walk still reads.
- FOUND, left as it is: on a narrow window (1024 wide) the card takes most of the room; the walk is a strip at the left
  (`break-narrow-mid-walk.jpg`). Nothing is cut off that matters, he ends up where the room always had him.
- OPEN: no sound. The ship's music carries on under it; his steps on the deck plating are not heard. A footstep cue
  would need a take cut for it (the pad film's `stand` take has chair noise in it).

## Genre veteran (a base screen with rooms: XCOM 2's Avenger, Darkest Dungeon's hamlet, Hades' House)

Walked against `references/CONVENTIONS.md` items 16 to 20 (added this iteration):

- 16, a menu change is never held up by its animation: YES. Nothing waits on the clip; it plays behind the card.
- 17, the transition ends exactly on the resting picture: YES. Each clip's last frame against its loop's first is 42.1
  to 45.9 dB, and the hand-over watched in the page changes by at most 2.4 of 255 between two pictures in a row (the room without him, or a black frame, would be 15 and up).
- 18, a change of mind restarts cleanly: YES. Comms then AI Core mid-walk: the AI Core's walk takes over, one clip.
- 19, short, and it can be turned off: YES. 3.7 to 3.8 s each (he is in his place by about 2 s); Settings > Reduce
  motion shows the room's still with him in it, as before.
- 20, the same person in every transition: YES by eye across the eight strips (black shirt, sleeves up, the stylus
  behind his ear where the frame shows it).
- FOUND, OPEN: the walk is the same clip every time a room is entered. On the tenth visit to the Gene Bay it is the
  tenth identical walk. A second take per room, picked in turn, would vary it (about $2.63 a take).

## Breaker (trying to make it look wrong)

- Fourteen rooms clicked in under three seconds: only the last room's walk plays, one loop is left running. PASS.
- Settings opened and closed mid-walk; the window made narrow and wide mid-walk; the room he is already in clicked
  again; the Quarters (no arrival); back from a report (the pad's film already walked him to the desk, he does not walk
  in twice). All PASS, no page error.
- FOUND, OPEN: he is never seen LEAVING. Clicking back and forth between two rooms, he is in the one, then the other
  is empty and he walks in. It reads as a cut, not as a mistake, but a spammed pair of buttons makes it a little
  comic. A take of him leaving the Desk exists (`node tools/art/ship-arrivals.mjs --leave desk`), not in the game: a
  leave before every arrival would put up to two seconds of the old room behind the new room's screen on every click.
