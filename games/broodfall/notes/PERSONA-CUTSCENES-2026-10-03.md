# Persona passes: the cut scenes, the signals, the Objectors' pick (Oct 3 2026)

PLAYTEST_PROTOCOL.md, step 3. Played in the real page: on the dev server (what `npm start` and `Play Broodfall.bat` run)
by `node tools/shot-cutscenes.mjs --dev`, on a build by `--build`, and `npm start` itself on port 5199 (the menu, CONTINUE,
the desk, ANSWER THEM, the film with its sound). Screens: `notes/screens/2026-10-03/cutscenes-*.jpg`.

## Newcomer (the second win, never seen the factions)

- **Do I know what just happened?** YOKE says it in her own voice: groups have reached out; a laser; a radio sermon; and,
  embarrassed, coloured cards in a field; "they're all marked on the planet at the Directive Desk". PASS: the last line
  names the place and the two things to do (answer, then side with one).
- **At the desk, can I tell what to do in 30 seconds?** Three yellow cards headed "THREE GROUPS ON THE PLANET ARE TRYING TO
  REACH THE SHIP", each with ANSWER THEM, and three pulsing yellow markers on the planet. PASS.
  - FOUND: one of the three markers is on the far side of the planet when the desk opens (the laser's). The cards carry
    it, and turning the planet finds it. Left as it is.
  - FOUND and FIXED: the cards said UNIDENTIFIED GROUP until answered while their own text named the group. They name it now.
- **The film.** It starts by itself, full screen, the speaker's name and words under the picture, SKIP in the corner.
  PASS. Its card afterwards says what siding would bring and offers two ways on. PASS.
  - FOUND and FIXED: his own broadcast ("We come in peace") carried YOKE's translation band ("SOURCE: CARD FIELD ...
    CONFIDENCE 98%"), as if she were translating him. A card with no translated line has no band now.
  - OPEN: a scene whose film is not made yet shows its leader's portrait and ten lines of text. It reads, but next to a
    film it is the poor cousin, and the player meets it on his second click (the Faithful, the Institute). The fix is
    the other fifteen films.
- **The Objectors' pick.** It comes when I press DEPLOY, says what it is and what to do, and DEPLOY tells me what my
  pick means ("SKITTERLING WILL NOT COME"). PASS.
  - OPEN: the kinds are name buttons. A newcomer does not know a Stalker from a Shadewing; the unit's picture (the
    report has them) and one line on what it does would make the pick a real decision. Not built.

## Genre veteran (Red Alert 2's cut scenes are the reference Collins named: "unabashed, over-the-top B")

| Convention | Here | |
|---|---|---|
| A briefing film plays by itself and can be skipped | Plays on ANSWER / on return to the ship; Esc, click, Enter, Space | YES |
| A film can be watched again | The card's poster ("WATCH IT AGAIN"), clicked in the beat. Comms → REPLAY SCENES queues a route's scenes again (its films with them); that button was not clicked in this pass | YES for the poster |
| The speaker looks at you and talks to you | The delegate plays to the camera; he is cut to for each answer | YES |
| Each side has its own look | Their world is a 1950s colour film; the ship is cold and lifelike (not seen in this film: the calls and finales have it) | YES for the one film made |
| The same actor, the same voice, every time | Measured only by pitch (he 112-125 Hz, one line at 145; she 178-211, one at 246). NOBODY HAS LISTENED | UNKNOWN |
| Snappy cuts, no dead air | Clips are cut to their words by the transcript's timings; the model still speaks slowly (13 words in 7 s) | PARTLY |
| A film ends on a button | The closing shot is a silent gag (she offers a biscuit, he is made of light); it is mine, not the script's | Collins's call |
| Choosing a side is a moment | His broadcast to the planet is a card today (its film is not made) | NO until its film is made |

## Breaker

Run as part of `tools/shot-cutscenes.mjs` (the last sixteen checks):

- Saves from before today: the three contact calls waiting (dropped; the signals show); an Institute route with the
  ultimatum's choice made and the old reveal card waiting (shown as it was written; perks are the route's own; the
  finale opens); a Delegation route that saw the removed beat (the desk draws; the finale opens). PASS.
- ANSWER double-clicked; Esc pressed six times; the poster clicked twice: never more than one film, Esc opens nothing
  else. PASS.
- Siding without answering: not possible at the desk or in Comms (the button is not there); the rule itself allows it and
  plays the first contact first (`tests/campaign.test.ts`). PASS.
- The pick: three clicked with two allowed (two stay); cancelled (nothing deploys); opened again (empty); deployed with
  nobody held back (the run bans nothing). PASS.
- Degenerate line looked for: can he collect all three groups' first-contact perks? No: a first contact gives no perk
  until he sides, and siding is exclusive (`tests/campaign.test.ts`).
- NOT TRIED: a film playing when the tab is hidden and shown again; a phone-sized window; Reduce motion (the film has no
  motion setting: it is a film).

## Oct 4 2026: Collins watched the first film, and it was remade

His verdict on the film the passes above were made with: "this video needs to be rethought". The cutting between a
shot of him and a shot of her was the fault ("too much jumpiness and character inconsistency"); he wants him seen from
behind, every clip started from the frame the last one ended on, his feelings in his voice, and the snacks line out.

What the genre-veteran pass above got WRONG: it marked "the speaker looks at you and talks to you ... he is cut to for
each answer" as a YES. Shot / reverse-shot is a convention of films shot with one actor and one camera; here every cut
to a new picture is a new drawing of the same person, and a cut back to him is a third. The convention that holds for
generated clips is the opposite one: ONE picture per place, and one take from it. It is now a rule of
`content/cutscenes.ts` and a test (`tests/cutscenes.test.ts`).

The remade film is one take over his shoulder. Looked at one frame a second, clip by clip, before it was joined.
