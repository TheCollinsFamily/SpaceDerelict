# Persona passes: the Roach King off the air, and the last mission (Oct 4 2026)

PLAYTEST_PROTOCOL.md, step 3. Played in the real page on a build by `node tools/shot-lastmission.mjs --build` (the
briefing after a deployment; the desk after the finale; the call, the address, the mission to the Host's arrival; the
campaign complete; a second try), and on `npm start`. Screens: `notes/screens/2026-10-04/last-*.jpg`. The mission's
balance is not judged here (a script kept the core alive to reach the Host): that is `tools/measure/last-mission.measure.ts`.

## Newcomer (has just watched his ally's finale; has never seen a shelter)

- **Do I know there is more?** The desk says ONE LANDING IS LEFT, names the Hive House and says it is the last mission;
  one marker on the planet is open, with a crown. PASS.
  - FOUND and FIXED (later the same day): the Hive House had no picture on its briefing (every other landing has one).
    It has one now, in the capital's look (the President's house dressed for a parade, the parade ground empty), and
    its loop; `tests/territoryPictures.test.ts` fails for any landing added without one.
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
  - FOUND and FIXED (later the same day): nothing on the board pointed at the shelter. A newcomer who has never infested
    one had to find a building with red tendrils among the district's landmarks. The board now marks it until the first
    wave is under way: a breathing ring round its lot and a chevron over its roof (`sim.openingShelter`,
    `src/render/isoRender.ts` syncShelters; green when it is his, pale when it is theirs).
  - FOUND and FIXED (later the same day): the start banner ran off both sides of the picture. It did not scroll: EVERY
    banner was one line whatever its length (`white-space: nowrap`), so any long one was cut at both ends (a dozen
    banners in `src/main.ts` are longer than the screen at 1280 wide). A banner now wraps onto a second line, balanced,
    inside 94% of the picture, and stands as long as it takes to read (1.2 s + a twentieth of a second a letter, 2.6 to 7 s).

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
  until the Host comes"; the organ stage did not repeat it. FIXED (later the same day): while the Host is late the
  organ stage's note opens with "The Host is N turns away. Until it comes the shelter's ration is the only war meat you
  get: leave enough of it for limbs." (`src/main.ts` openUnder).

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
