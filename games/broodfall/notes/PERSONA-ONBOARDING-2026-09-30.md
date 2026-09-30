# Persona pass: the new player's first launch (Sep 30 2026)

PLAYTEST_PROTOCOL.md step 3, for the onboarding iteration (DESIGN.md "How it unfolds for a new
player"). Played on the DEV server (`npm start`'s server) with localStorage cleared, by hand
through Playwright and by the scripted beat `tools/shot-onboarding.mjs`. Screenshots:
`notes/screens/2026-09-30/onboard-*.jpg`.

## Newcomer (opened cold, nothing stored)

- **0:00 The film.** It opens at once, full screen, no menu first. It reads as the trailer of a
  cheap 1950s monster picture: a quiet insect town, a red light, the fall, the crater, the thing
  growing, the militia, the thing rising, then the name and "YOU ARE THE THING THAT FELL." The
  SKIP button is visible bottom right; Esc and a click both skip. PASS: nothing hints at a ship,
  an empire or a campaign (the beat checks the words on screen).
  - Finding (kept): it is silent. A browser will not play sound before the page is clicked, and
    the first launch is exactly that page. Music would need a "click to begin" card, which is
    friction on the very first second; not done.
- **0:40 Mission 1.** The board comes up with its hint line already saying what to do: "YOUR
  FIRST LIMB: pick a card below, then click a dark red block beside a street — the townsfolk march
  in from the glowing gate in 26s", with the cards glowing.
  - FIXED: before this pass the hint line was EMPTY until the first action, in every mode. A new
    player had 27 seconds of a busy HUD and no sentence telling him anything. `updateHint()` now
    runs at boot, and mission 1 has a coach (`coachText` in `src/main.ts`).
  - FIXED: the coach said "grow more limbs" after the first one when the 30 war meat was already
    spent (a 28W card). It now says kills pay more, wait or CALL THE WAVE, and the CALL button glows.
  - FIXED: the coach's line stuck ("Wave cleared...") into the next siege; it now hands back to
    the game's own line when it has nothing to say.
  - Finding (open, not changed): the HUD shows everything from the first second: creep nodes,
    plinths, organs, royal surge, cannibalize, threat, interest. A newcomer reads none of it and
    it does not get in the way, but it is noise. Hiding HUD parts until they matter is a HUD
    change for Collins to call (the HUD's look is already his open item).
  - Finding (open): the first hand is drawn by the seed and can open with a Bile Lobber ("click
    it, click ground") or a Digestive Swamp. The draw is the sim's (deterministic, not touched).
  - Finding (kept, on purpose): mission 1 can be lost. A naive "build anything anywhere" play
    lost at wave 5 of 5. Collins wrote YOKE's lines for losing it ("You really suck at genocide"),
    so a loss is a designed path, and it pays the same 4 standing as a win.
  - PASS: no Requisition Board, no "standing", no globe, no Gene Bay, no licence on the mission 1
    screens (the won banner's line about the Procreation Licensing Board is cut in mission 1;
    locked organs and evolutions just say LOCKED).
- **The report.** "THE TOWN FOUGHT BACK" / "THE TOWN IS YOURS", the newsreel still and the board,
  a few numbers, one button: CONTINUE. PASS.
- **The ship (the reveal).** A black-and-white hard-SF room, a projected woman in the corner
  talking to me in a sharp, funny voice, then a golden retriever in a uniform on a comms screen
  telling me he read my report twice. That is the "oh, this is something else" moment the design
  asks for. The desk on the right says AWAITING CLEARANCE and hands me the next deployment with a
  DEPLOY button, so there is never a question of what to do next. YOKE lights the Gene Bay and
  there are 4 standing to spend in it. PASS.
- **The next returns.** A loss: the mate review, which points at my quarters, where the pad holds
  the candidate's file. Another loss: the cat girl, whose letter is in my inbox, declined. The
  first win: "Broh, that was sick...", then three callers, one after the other, CALL 1 OF 3.
  Then the globe lights up. Each layer arrives only after the one before has been seen. PASS.
- **Relaunch.** The ship's console over the view of the planet from the viewport, red creep
  across the night side, the menu in the ship's thin white type. CONTINUE lands me aboard and
  she greets me again. PASS.

## Genre veteran (checked against how the best first levels teach)

References: Kingdom Rush's first stage, Plants vs Zombies' first level, Bloons TD's tutorial:
one mechanic at a time, taught by doing, the next thing to do always said, the first level
short and winnable, more systems revealed only once the first is understood.

| Convention | Here | Evidence |
|---|---|---|
| The first thing on screen is play (or a very short intro), not a menu | YES | the film is skippable at once; then the board, no menu (`onboard-01`, `-04`) |
| The next action is always said | YES (mission 1) | the coach line at every step of the first waves (`onboard-04`, `-05`) |
| One mechanic at a time | PARTLY | the coach teaches limbs, then waves, then clicking a limb; the HUD still shows every system from the start (finding above) |
| The first level is short | YES | 5 waves (the crash site's directive), the gate of the assault shown |
| New systems revealed after the first is understood | YES | the ship after mission 1, the desk and the factions after the first win, Earth news after the early beats |
| Losing the first level is not a dead end | YES | the lost path is its own greeting and the same ship |

## Breaker (tries to skip or break the unfolding)

- Reload during the film: the film again (it is marked seen only at its end or skip). PASS.
- Reload during mission 1: back into mission 1, not the menu, not the ship. PASS.
- Go to `?campaign=ship` during mission 1: sent back into mission 1. PASS.
- `?campaign=ship&open=1` gives an open-desk campaign ONLY when none is on record: a backdoor for
  the browser beats, harmless to a player (it skips the unfolding, nothing else).
- NEW CAMPAIGN: mission 1 again, desk dark again (the film is not replayed; REPLAY THE OPENING is).
- A save from before Sep 30: its desk is open, no mission 1, all three factions call at its first
  capture (tested).
- Asking YOKE to print a body twice: the scene plays once a campaign; the second ask is refused.
- rfab.ai down or out of tokens: the greeting is read (text on screen, her clips still play);
  her voice fails soft per line. Checked with the voice mocked, and once for real
  (`/api/avatars/:id/speak`, "You really suck at genocide.": 200, audio/mpeg, 1.9 s).
