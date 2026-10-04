# Persona passes: the Roach King off the air, and the last mission (Oct 4 2026)

PLAYTEST_PROTOCOL.md, step 3. Played in the real page on a build by `node tools/shot-lastmission.mjs --build` (the
briefing after a deployment; the desk after the finale; the call, the address, the mission to the Host's arrival; the
campaign complete; a second try), and on `npm start`. Screens: `notes/screens/2026-10-04/last-*.jpg`. The mission's
balance is not judged here (a script kept the core alive to reach the Host): that is `tools/measure/last-mission.measure.ts`.

## Newcomer (has just watched his ally's finale; has never seen a shelter)

- **Do I know there is more?** The desk says ONE LANDING IS LEFT, names the Hive House and says it is the last mission;
  one marker on the planet is open, with a crown. PASS.
  - OPEN: the Hive House has no picture on its briefing (every other landing has one).
- **Do I know this mission is different before I am in it?** Its briefing has a gold box, THE LAST MISSION — THE HOST IS
  LATE: five turns, who comes until then, that the shelter is already mine and what it gives, and what happens after.
  PASS: three short paragraphs, the numbers in bold.
- **The two scenes at DEPLOY.** They come by themselves, one after the other, each a page to read with CONTINUE. The
  general's line and his answer tell me why the Host is late. PASS for sense.
  - FOUND and FIXED: the Founding Day page set "THE ROACH KING:" over each of its nine lines. A speaker's name is now set
    once over a run of his lines.
  - OPEN: they are text. Next to the factions' film they are the poor cousin, at the climax of the story. The fix is
    their three films (shot lists ready).
- **In the mission, can I find what I was told about?** A banner at the start says the shelter by the body is mine and
  is my war meat until the Host arrives; the order at the top counts the turns; the first wave's banner says who is
  coming and how long is left; the clear's banner says what the shelter paid.
  - FOUND and FIXED: the countdown was cut off on the HUD ("THE HOST ARRIVE…") whenever the phase line beside it was
    long, which is every build phase. It is shorter now ("HOLD 9 WAVES · THE HOST IN 5 TURNS") and the beat checks it
    is not cut off.
  - OPEN: nothing on the board points at the shelter. A newcomer who has never infested one has to find a building with
    red tendrils among the district's landmarks. A marker over it for the first seconds would do it. Not built.
  - OPEN: the start banner is long and scrolls; half of it is off the picture at any moment.

## Genre veteran (knows the campaign; has infested shelters)

- **Is it a different game for five turns?** Yes: no war bounties, so limbs come from the shelter's 45 and the clearing
  wage (about 100 war after the first clear), while science piles up (151 after one wave) and royal points come every
  turn (24 by the Host's arrival). It is the science-and-decrees build the rest of the campaign rarely lets you play. PASS.
- **Is the shelter a real decision?** It is the war caste's first target when the Host arrives, and it pays only if it
  took less than 15% of its body in the turn: guns round its door now, or guns at the body. PASS on paper; the scripted
  player lost it at the Host's arrival in 4 runs of 10 and still won 2 of those.
- **The Host's arrival.** Banner, the order turns red (THE HOST IS HERE), about a hundred bodies in the first wave at
  the top tier. It lands. PASS.
  - OPEN: the win is a hold. After his speech a veteran expects the man himself on the field.
- **The scripted player needed teaching** (it spent the ration on organs and stood with no limbs): a human who levels
  organs out of habit will do the same in turn one, and nothing warns him. The briefing says "it is your war meat
  until the Host comes"; the organ stage does not repeat it. OPEN.

## Breaker

- **A click anywhere on a transcript** does not close it (it is a page to read); Esc, Enter, Space and CONTINUE do. PASS.
- **DEPLOY pressed twice** while the scenes play: the second press does nothing (`launching`). PASS (by code; the
  transcript covers the button).
- **Lose the last mission, come back:** it is still the one landing; the scenes do not play again; DEPLOY goes straight
  in. PASS (beat C).
- **A save that had "CAMPAIGN COMPLETE" before today:** it opens on ONE LANDING IS LEFT (`migrateFinale`). PASS (test).
- **Deploy on the last mission with the Objectors' pick up:** the pick shows first, then the scenes, then the mission.
  PASS (beat B).
- **A one-entrance start where no district can hold a shelter** (3 seeds of 40): the shelter is raised in the crash
  district itself. FOUND by the "every time" test and FIXED.
- **The briefing's Requisition Board, dares and experiments still show on the last mission.** They pay standing and
  notes that nothing is left to spend on. Harmless; OPEN (hide them, or let them stand as the Board's last forms).
