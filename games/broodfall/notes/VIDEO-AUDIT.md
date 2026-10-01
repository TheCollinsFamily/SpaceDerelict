# Every still the player sees: video or not (Oct 1 2026)

Collins: "anywhere else where video is needed? We should add it."

The rule used: a picture becomes a loop when the player LOOKS at it for a while (reads beside it, waits on it,
comes back to it) and it shows a scene that has something in it that would move (smoke, light, water, a crowd,
a face that breathes). A picture glanced at, a drawing (wireframes, sketches, diagrams), or something already
moving stays as it is. Every loop is a seamless image-to-video loop from the still itself (end frame = start
frame, a crossfade where the model's seam still showed), its poster its own first frame, the still kept for
Reduce motion. Proof: `notes/screens/2026-10-01/README.md`. Frames looked at: `notes/art-review/stills-alive/`.

| Surface | Where it shows | How long it is looked at | Verdict |
|---|---|---|---|
| Faction scene pictures (contact + every beat: 14) | the parchment scene card on the ship (`campaignUi.sceneHtml`) | 20-60 s: every line is voiced or read beside it | **ANIMATED** (`tools/art/stills-alive.mjs` group `scene`, 4:3, 720p) |
| The three reveal pictures | the reveal card (picture from `public/media/pictures/`) | 20-60 s, the end of a route | **ANIMATED** (group `reveal`) |
| Ending cards (4) | the ending card | after the ending film, the card loops that film | already video: left alone |
| The 16 territory pictures | over the briefing and the dark desk's assignment | 10-60 s while dares and experiments are picked | **ANIMATED** (group `territory`, 16:9 cut where the 16:7 crop shows, 480p: it is about 460 px wide) |
| Debrief won / lost / held | the report's lead band (skirmish and campaign) | 10-30 s while the report is read | **ANIMATED** (group `debrief`; a `<video>` over the band's still, the shade and the verdict over it) |
| Title key art (`screens/title.webp`) | nowhere: `#menu.title-art` is never set; the menu plays its own viewport loop | 0 | not needed (the menu is already a loop) |
| The emblem | logos, the loading screen | the loading screen's emblem is the loader session's loop | other session (loading): skipped |
| Empire Directives room | its room background (borrowed the Board's loop) | minutes | **OWN STILL + LOOP** (`tools/art/ship-loops.mjs orders`: an Office of Directives, a sheet hanging from a slot, a lectern) |
| Notebook room | its room background (borrowed the Locker's loop) | minutes | **OWN STILL + LOOP** (`ship-loops.mjs hobby`: his fold-down desk at night, holo-blue pages over the pad) |
| Quarters | room background | minutes | already a loop |
| The other six rooms | room backgrounds | minutes | already loops (Sep 30) |
| The boss's transmission | full screen, while he speaks (~20 s) | ~20 s | already a clip, but its 4 s loop POPPED every turn (seam 10.9 vs a 0.8 step, the camera drifts): **RE-BAKED** with a 0.6 s crossfade (seam 0.59), free |
| The partner's portrait | the data pad in the quarters, 128 px | 10-30 s while her file is read | **ANIMATED** (a living portrait: breathes, one slow blink; sd2-mini redrew her face and made her talk: rejected, sd2-fast kept her) |
| YOKE's faces (atlas) | AI Core when her Living Avatar is off | — | her Living Avatar is the default and is live video; the atlas is the scripted fallback: left |
| Faction leaders' portraits | Comms, a scene card with no picture | short | the scenes have their own pictures now; Comms rows are small: left |
| Sketches (dares, experiments) | pick buttons, his own drawings | short; drawings | not video: left |
| Newsreel photographs (the papers) | inside a paper that spins in and is read | ~10 s | a period newspaper photograph; the paper itself moves: left |
| Organ stage skyline | the strip over the organ stage | as long as the stage is open | **ALIVE IN CSS**, not video: a wireframe drawing would melt in a video model. A red light blinks on its tallest spire, a wisp of smoke from the tallest roof of the other half, a searchlight sweeps over the meteor (`src/ui/skylineLife.ts`, points read by `tools/art/skyline-life.mjs`). The organ loops (`underAlive.ts`) were not touched. |
| Gene Bay organ cards | the Gene Bay, 44 px each | while buying lineages | **ANIMATED from the organ stage's own loops** (`under.loops` strips in the manifest, stepped in CSS). A hook: when the organ session re-bakes those strips, the cards pick them up; with none, the scan stills |
| Hand cards' limb pictures | the hand on the board, 64 px | the whole run | **ANIMATED from the limbs' idle frames** (no new art): one 12 fps timer, a frame written only when it changes, nothing read from layout |
| Report tiles (limbs, units) | the report | short | small; left |
| District draft previews | the draft | a few seconds | other surface already drawn live by the board: left |
| Loading screen, landing films | — | — | other sessions: skipped |

Every animated surface: one `<video>` per surface, kept across redrawings (`src/ui/alive.ts`), paused when off
screen or hidden (IntersectionObserver, a hidden tab), let go (src dropped) when its surface is gone, the still
under Settings > Reduce motion, and off under automation unless `localStorage['broodfall-alive'] = 'on'` (as the
newsreel and the data pad), so the older beats that read these as pictures still do.

Re-rolled after looking at every frame: institute-machines (the men at the truck multiplied and a cut at 11 points),
faithful-signs (the book's pages flipped back and forth), debrief won (sd2-mini restyled its first frame), and the whole
first pilot on sd2-mini (restyled first frames, the partner's face redrawn and talking, 8-13 point seams).
