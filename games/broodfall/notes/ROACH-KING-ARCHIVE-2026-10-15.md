# The Roach King in the archive: his last film, and the post-game as another lap (Collins, Oct 15 2026)

His words, verbatim (Oct 15 2026): "sketch out how a post game would work / we also need a short end vid with roach
king ... oh gosh actually I never reviewed the designs or last vids for him can you show me where those are ... as for
his last vid draft a script ends simmilar to the others digitizes in a feild your talking to him and hes basicly like
... so my civlisation is fine and its well a chunk of the populaiton is living in isolated simulations due to lower
moral character but ya for the most part ... and hes like ... well so then do you want to keep playing and your like
sure would be good practice ... and the map resets you keep your upgrades and evrything is harder".

Nothing here is built. The review page with every clip and film of his, this script and this sketch is the artifact
"Roach King Review" (the link is in the session's report). The Oct 12 design (`notes/POSTGAME-2026-10-12.md`: his
rule cards, field notes as the stake, his arc from disappointed to at peace) is kept as the twist INSIDE a lap; his
frame of Oct 15 (the map resets, you keep your upgrades, everything is harder) is the frame.

## 1. The script: THE FIELD (draft; his beats, my lines except where his)

- **Place:** the archive. One camera, one take, the `archive` look (`content/cutscenes.ts` FilmLook: the same 1950s
  film as a dream sequence, radiant). Picture `rk-field-ots` (to add to `STILLS`), refs `king`, `hero`: an
  over-the-shoulder shot in MEADOW (the serene meadow under a golden sky, the glowing grass, the honeycomb of light in
  the sky). In the left foreground, from the waist up, HOLO (his hologram, from behind, never his face). A few steps
  away, facing him and the camera, KING in his coat and cape, the gold machine gun slung, looking at his own four
  hands. Room tone MEADOW_TONE. His hologram gets NO gesture (the rule of Oct 4): his feelings are in his voice.
- **When:** the last mission is won; `rk-offline` (the door, the empty chair) plays as today; on the NEXT return this
  film; then the desk is reprinted (section 2). A new `RoachScene` with `when: 'archive'`; `dueAfterDeployment` plays it
  once `rk-offline` is seen. Kicker: `INSIDE THE ASSET · THE ARCHIVE · INTAKE`; source: `NO BAND · RENDERED BY YOKE
  FROM INSIDE THE ASSET`; end card: `THE ARCHIVE PRINTS THE PLANET AGAIN`.
- **The rule it bends:** he never meets the operator (Oct 1). Collins's "your talking to him" overrides it for this one
  scene. He still never saw the ship: he meets a hologram in a field after he is dead.
- **Voices:** his `The Roach King` voice of `content/cast.ts` (the showman's voice used quietly, tired and exact) for
  lines 1 to 10; the grin comes back at 11 and the last four are the showman. `You` as in every film.
- A spoken line is at most 22 words and has no word in capitals (`tests/cutscenes.test.ts`); a "(direction)" is acted.

```
The Roach King: (he looks at his own four hands, then up at the golden sky) Okay. Okay. I was at the door. Now I am in a field.
The Roach King: (he squints at the hologram) And who are you supposed to be? You are not a sister. You are not even a bug.
You: (evenly) I run the asset. The Crater Thing, you call it. Sorry about the door.
The Roach King: (a long look; then, quieter) So. Am I dead?
You: No. You are in the archive. Everyone the asset took is here. Your whole planet, more or less.
The Roach King: More or less.
You: A share of your people are in isolated simulations. Lower moral character. They come out when they improve.
The Roach King: (he takes it in, nodding slowly) So my civilisation is fine.
The Roach King: Well, a chunk of the population is living in isolated simulations due to lower moral character. But yeah. For the most part.
You: For the most part.
The Roach King: (he looks out over the glowing grass; the grin comes back) Chat agrees with everything I say now. It has been forty minutes. I hate it.
The Roach King: Well. So then. Do you want to keep playing?
You: (a beat) Sure. It would be good practice.
The Roach King: Same planet. Printed fresh. You keep your organs. Everything else gets harder. My rules.
The Roach King: (he unslings the gold machine gun, lifts it over his head with two arms and fires into the sky; the grass bends; birds go up) This concludes the address!
```

Lines 8, 9, 12, 13 are his words (Oct 15). Line 11 (chat agreeing with everything) is the engine of the Oct 12 design,
bored in paradise, and is his to cut. Three exchanges for the film system (1-4, 5-10, 11-15), about 70 s at 480p,
roughly $6 to $9 of clips if the gates pass first time. Make it only after he has read this.

## 2. The post-game: ANOTHER LAP (his frame)

**Opens:** after THE FIELD. The desk says `LAP 2 · PRINTED BY THE ARCHIVE` where it said CAMPAIGN COMPLETE; the globe
takes a palette shift; DEPLOY works as before.

**Resets** (a new campaign built from the old: `newCampaign(seed + lap)` with the carried fields copied over):
- the globe: every territory back in the planet's hands except the crash site; `captures`, `held`, `revealed`,
  `boards`, `underAttack`, `staging`, `finale`, `ended` as new;
- the story does NOT replay: `faction` and `beatsSeen` kept as seen, `pendingScenes` empty, the Directive Desk's
  signals off, no midpoint, no finale scene; the last mission keeps its rules (the Host late, the shelter) but his
  transports call and Founding Day do not play again. (COLLINS: replay the ally's beats as films already seen, or none.
  Recommended: none; the lap is his stream and YOKE.)

**Carries:** `lineages`, `profiles`, `profile`, `experimentsDone`, `daresDone`, `hobby` (the spliced genes),
`licence`, `standing`, `notes`, `orders` (closed: the war is over), `letters`, `ai`, `greetingsSaid`, `said`, the
comics (always), YOKE's account and memory. New: `lap: number` (1 on a first campaign), `archive` (the Oct 12 block:
matches, won, card, said, comics).

**Harder, per lap n (every knob is a `SimConfig` field the sim reads today, so lap 2 is content and a reset):**

| Knob | Lap 2 | Lap 3 | Exists |
|---|---|---|---|
| wave bodies | ×1.25 | ×1.5 | `waveScale` (the Institute's 0.9) |
| tier floor | +1 | +2 | `minTier` as the last mission uses it (generalise to every deployment) |
| entrances | at least 2 | at least 3 | `entrances` |
| wave intel | hidden | hidden | `waveIntel` |
| counter-attacks | every other return | every return | `staging` cadence (`src/meta/defence.ts`) |
| the Host on the last mission | a turn earlier | two | `lateHost.turns` |
| his rule card | one a deployment | two | the experiments' partials (`trapCage`, `matingMusk`, `lateHost`, `sleepers`, `bannedEnemies` inverted: "chat voted: no fire tonight", "double Host", "fog: no fliers", "no eating") |

Measure before tuning: the scripted player over 10 seeds at each lap (`tools/measure/after-mission.measure.ts` with a
lap), aiming at about half the win rate of lap 1 on lap 2.

**What a lap pays:** field notes after every win (his dares, two a card), spent on his rule cards (re-roll the next
card 2, pick its kind and rule 4) and the zoo (borrow an unbought lineage for one deployment, 1). No standing in the
archive (COLLINS: or a little, for a player short of the licence). Comics at milestones (the first lap won; the first
deployment won under THE PRESIDENT IS ON THE FIELD; five laps), the one thing that carries to a new campaign.

**Him, during a lap:** his stream from the archive runs it. One line after each deployment, in order, never repeated,
from the Oct 12 arc (sore loser when the Thing wins, briefly gracious when he does, "tonight I'm playing, personally"
at 3, "nobody dies, everybody respawns, it is great" at 5, "chat, I think I'm happy" at 10, then the two pools). On the
den still, about $6 to $8 of clips; cards until approved. THE PRESIDENT IS ON THE FIELD from lap 2: the one place he can
stand on the board (a boss body on the gilded war beetle, the gold gun, the cape: follows the Host's biggest wave, fires
in bursts, the deployment is his loss when the beetle falls). Needs its art (phase 3).

**YOKE:** six lines after a won deployment in the archive, six after a lost one ("You're practising genocide. On a
photocopy. I'm not judging. I'm logging."), one for the first lap and one for the fifth; the Earth news when dry.

**Each lap's last mission won:** THE FIELD again, one new line of his per lap (six written, then the pool), the next
lap. No ceiling unless he wants one (COLLINS: three laps then a title card, or endless).

**Phases and cost:** (1) no new art: the reset, the knobs, his rule cards, his and YOKE's lines as cards, notes as the
stake, the comics; about the size of the last mission's build. (2) THE FIELD film and his lap clips (about $15 in all).
(3) the boss body and the new mission kinds (board #4, tried first as his rule cards).

## 3. Open for Collins

1. Story-less laps (recommended) or the ally's beats replayed as films already seen.
2. Standing in the archive: none (recommended) or a little.
3. Line 11 (chat agrees with everything): keep or cut.
4. A ceiling on laps, or endless.
5. He knows he is dead in this draft ("Am I dead?" "No. You are in the archive."). The other reading, that he thinks he
   won and the archive humours him, changes lines 4 to 10.
6. Whether THE FIELD replaces the Oct 12 opening address from his den (recommended: it does; the den address becomes
   his first lap line).
