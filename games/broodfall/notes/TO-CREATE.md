# Broodfall: everything still to be created (inventory, Sep 29 2026, evening)

What exists is listed in `HANDOFF.md` ("The art") and shown in `notes/screens/2026-09-29/`.
This is what does NOT exist yet. Costs are RFab tokens at $0.00002 (a still at high quality
about $0.45, a 4 s clip about $0.25 at 480p, $0.49 at 720p). "Collins" marks what needs his
decision before it can be made.

## 1. Being made right now (the units session)

| What | Done | Left |
|---|---|---|
| Walking clips from above, 26 units, 5 views | 26 | re-roll bomber walk S |
| Attack clips, 26 units, 5 views | 15 | 11 units; re-roll consort attack SW |
| Death clips (fall and lie still), 26 units | 15 | 11 units |
| State pictures: netted flier, braced cannon/mortar/dartgun, stripped carapace, burrowed tunneler, thief/researcher carrying a limb | 6 of 26 units carry one | the rest as they apply |
| Shadows under units, deaths and states wired in the renderer | built | screenshots to come |

## 2. Units: art the game will want next

- **Hit reactions** (a flinch when struck): 26 units x 5 views. ~130 clips, ~$33.
- **The royal and the consort as bosses**: bigger frames, an entrance, a special attack. ~$10.
- **Broodlings** (the Broodmother's brood) and **puppet queens** (the Trap Cage's captures): still
  drawn as coloured dots. 2 small units, walk and attack. ~$6.
- **Researchers' sedation darts, cannon shells, bombs** in flight: still dots. ~10 small sprites. ~$5.
- **Carapace shield** as a picture on the unit (now a ring). Part of the states.

## 3. Limbs

- **Firing clips from behind** exist for the 15 lopsided limbs; the **13 limbs with no firing
  clip** (the engines and support limbs: conduit, tap, mitosis, reliquary, press, amp, mosaic,
  twin, capacitor, boomerang, ward, choir, lance) have an idle only. An "acting" clip for each
  when its effect fires. ~$6.
- **Evolution looks**: every limb has 3 evolution stages x 2 choices. They show only as a crest
  mark. A changed look per stage (bigger, extra parts) is 36 limbs x 3 stills + clips. ~$150.
  Collins: worth it, or keep the crest?
- **Cannibalized traits on the body** (DESIGN: "a spitter built from a cannibalized burster has the
  burster's sacs hanging off it"). ~10 part pictures per donor family, composited. ~$40.
- **Death of a limb** (withers, is carried off by a researcher): 1 clip each or one shared. ~$10.
- **Projectiles and effects**: spit, harpoon, quills, bile, lightning arcs, prism beam, flame cone,
  poison cloud, mist, web, spore shells. All still drawn as lines and dots. ~25 sprites/clips. ~$15.

## 4. The board

- **Creep that animates** (a slow pulse, spreading tendrils at its edge). Now still tiles.
- **Creep strains shown in the art** (mire, burning): now a tint.
- **Creep nodes** (spore pods): one picture; a growing and a spreading clip. ~$2.
- **Gates** where waves come in: now an orange ring. One picture per tile set. ~$5.
- **Unclaimed city under smoke**: a flat dark texture. Drifting smoke and skyline silhouettes. ~$5.
- **District draft**: picking a new plate shows no art of the plate. A preview picture per plate
  pattern and tile set.
- **Plinths grown**: drawn as bone walls; a growing clip when one is placed.
- **The organ stage's organs growing**: the scan-in animation is done in code; no clips.

## 5. Screens and interface

- **The HUD** is the old khaki procurement look over a painted board. Collins: restyle it, and in
  which look (the 1950s "empire operator software" of DESIGN, or the ship's austere black)?
- **Hand cards**: DONE Sep 29 2026, each card shows its limb (`cards-01` in the screens folder).
  Organ cards and the draft's plate cards are still text.
- **Title screen**: the ship in orbit exists; no logo, no menu art.
- **Debrief** (end of a run): text on a card. Pictures of what happened.
- **Loading and error screens**: none.

## 6. Films, news, sound (nothing exists)

- **Newsreels and news clippings** between runs, in the agreed 1950s B-movie look (style bible,
  "Films and news clippings"). DESIGN's "break moments" (the same footage ungraded). Concept stills
  exist; no screen shows them. A clip per campaign beat: ~20 clips, ~$15, plus the screen.
- **Sound: the game is silent** except YOKE's voice. Music (the jaunty newsreel register and the
  ship's hum), sound effects (limbs firing, units dying, creep spreading, UI clicks), the
  narrator. Needs a sound source: RFab music/voice generation, or a library. Collins: which?
- **Faction leaders' voices** for their scenes (RFab voices, as YOKE's).

## 7. The campaign and the ship

- **Hobby missions** (DESIGN: unofficial missions that pay unique genes; the hobby interface
  concept was approved, `r4-hobby-interface.png`). Not built: design, screen, art.
- **Empire directives** screen: README lists it MISSING.
- **YOKE**: 43 clips (Sep 30 2026, the Leaflit studio way; every gesture of RFab's vocabulary); her lore PROPOSALS wait for Collins (lore book section 14); her voice
  (Athena, Harmonia, Pandora): Collins.
- **The ship's rooms** are stills; the concept asked for slow loops (hum, blinking consoles). 6 clips, ~$3.
- **The hero seen from behind** in each room: pictures exist in the concepts, not placed in the rooms.
- **Territory art on the globe**: a picture of each of the 16 territories for the briefing. ~$8.
- **Faction endings**: 3 ending scenes have one picture each; an ending sequence (several pictures,
  a film) per faction.

## 8. Design that is not built yet (DESIGN.md backlog)

- Royal special-upgrade sinks beyond the stage-3 evolution cost.
- The ship AI's lore book: now written by Claude from Collins's words; his review.
- Civilians fleeing the crash (city life on the board).
- Surgery vulnerability: drama when cannibalizing mid-siege.
- The interior sealing itself (a burrow-reopen mechanic).
- Faction contact after story beats rather than N captures; asides in a fixed order; the globe as a
  true 3D sphere.
- Do ordinary soldiers shoot limbs on roofs: Collins (a balance change).

## 9. Housekeeping

- **The leaked RFab key** in the public repo (`games/space-derelict/generate_*.py`): Collins, rotate it.
- **`art-src/` has no durable home** (about 600 MB, only on this PC): Collins, where.
- **The organ stage's "STREET LEVEL" label** is drawn over the skyline.
- **Props from a tile set's fallback list** have no drawn backs (they mirror); a few backs barely
  differ from their fronts.
- **The seedling pod** is one picture, not 2 to 4 frames.
