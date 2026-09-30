# Broodfall: everything still to be created (inventory, updated Sep 30 2026, evening)

What exists is listed in `HANDOFF.md` ("The art") and shown in `notes/screens/2026-09-29/` and
`notes/screens/2026-09-30/` (its README indexes every picture). This is what does NOT exist yet.
Costs are RFab tokens at $0.00002 (a still at high quality about $0.45, a 4 s clip about $0.25 at
480p, $0.49 at 720p). "Collins" marks what needs his decision before it can be made.

Built on Sep 30 2026 and removed from this list: flinches, the royal and consort as bosses,
broodlings and puppet queens, braced guns, the carapace shield looks, every projectile and limb
effect, the 13 limbs' acting clips, limb deaths, donor parts, creep seams, the floors that read as
creep, moving creep, strains, pods, gates, the unclaimed city under smoke, plinths rising, district
draft previews, pictures on organ cards, the title and menu, the debrief with pictures, loading and
fault screens, the ship-console HUD (Collins's pick), the opening film, the new-player flow, YOKE's
43 clips (the Leaflit way) and her greetings, the dog boss, the print-a-body scene, the data pad at
a mission's end, the $3 guest allowance and RFab account link, Empire Directives, hobby missions,
territory art, Settings, limb/core scale, the Spine Wall's size and direction, the core evolving
through four stages, the organ stage's one meteor, the lore (empire, insects, Sons of Man), the
three campaign outlines, covers and promotional art.

## 1. Units and limbs

- **Evolution looks**: every limb has 3 evolution stages x 2 choices, shown only as a crest mark.
  A changed look per stage is 36 limbs x 3 stills + clips. ~$150. Collins: worth it, or keep the crest?
- **Meat drops**: no picture of their own.
- Small flinch blemishes: a stub of a pole in a few flinch frames; a few units jolt into aim
  instead of recoiling.
- Status overlays (web, poison, flames) draw over a block that stands in front of the unit.

## 2. The board

- The mire skin is dark mossy green and may read as grass beside green roofs.
- The deep hive's pollen roof is a strong lemon yellow.
- A limb's hp and trait marks jump to a plinth's height instead of rising with it.
- **The seedling pod** is one picture, not 2 to 4 frames.
- **Props from a tile set's fallback list** have no drawn backs (they mirror).

## 3. Screens and the ship

- **The Quarters room picture and the candidate partner's portrait**: not made (the attempt was
  blocked by Claude Code's permission check); the Quarters reuse the Procreation Board's picture.
- **The data pad clip's window shows a green Earth-like planet**, not the infested one.
- **The ship's rooms** are stills; the concept asked for slow loops (hum, blinking consoles). 6 clips, ~$3.
- **The hero seen from behind** in each room: pictures exist in the concepts, not placed in the rooms.
- The ship's room bar wraps to a second line at 1600 px.
- A new player's first screen shows every system at once; the seed can deal a complex first card
  (`notes/PERSONA-ONBOARDING-2026-09-30.md`).
- The data pad clips are VP8 WebM with alpha: Safari skips the pad.
- The boss's voice (`aura-2-apollo-en`) has not been listened to.

## 4. Films, news, sound

- **Sound: the game is silent** except YOKE's and the boss's voices. Music, effects, a narrator.
  The Settings sliders for music and effects wait for it. Collins: RFab generation or a library?
- **Newsreels and news clippings** between runs, in the 1950s B-movie look. ~20 clips, ~$15.
- **Faction leaders' voices** for their scenes.
- **Faction endings**: one picture each; an ending film per faction (and the Institute's pacify one).

## 5. The campaign (see the Claude doc "Broodfall: The Three Campaigns" for the open calls)

- Each beat as its own mission on the board, or a scene after a capture as now: Collins.
- The Faithful and the Institute have 3 beats against the Delegation's 5: add two each?: Collins.
- Switching allies mid-campaign: Collins.
- The insect lore's OPEN questions (`content/lore/insects.md` section 14) and the lore book's
  PROPOSALS (`content/lore/ship-ai-lorebook.md` section 14): Collins.

## 6. Design not built yet (DESIGN.md backlog)

- Royal special-upgrade sinks beyond the stage-3 evolution cost.
- Civilians fleeing the crash.
- Surgery vulnerability: drama when cannibalizing mid-siege.
- The interior sealing itself (a burrow-reopen mechanic).
- Asides in a fixed order; the globe as a true 3D sphere.
- Do ordinary soldiers shoot limbs on roofs: Collins (a balance change).
- The first LONG limb (built and tested, used by none): Collins picks the limb.

## 7. Owed deploys and housekeeping (Collins)

- **RFab backend deploy** (migration `20260930120000_broodfall_yoke_players`), then fund the house
  account `broodfall-house@rfab.ai`, then the **RFab frontend deploy** (the `/connect` page and the
  Leaflit studio's black-clothes keying fix). Also still owed from Sep 28: the Kimi fallback route.
- **The leaked RFab key** in the public repo (`games/space-derelict/generate_*.py`): rotate it.
- **`art-src/` has no durable home** (now well over 600 MB, only on this PC).
