# Broodfall style bible — v1 (Sep 29 2026)

The visual language of the game, and the prompt blocks every generated asset shares.
Concept pictures are in `notes/concepts/2026-09-29/`; the script is
`tools/art/concepts.mjs`. Pipeline and costs are in `notes/GRAPHICS-PLAN.md`.

## Collins's rules (his words; do not re-litigate)

1. **Insects are people.** "The thing that's important to remember with the insect design
   is that they need to have castes that are human enough for the player to empathise with
   them and for the political humour to land … they can have tank-like and mob-like castes
   but they also need human-like ones."
2. **The board.** Of `board-paper-city.png` and `board-clay-city.png`: "these for what
   buildings, towers, and landing site look like I like it a lot, as well as the animation
   style."
3. **The 1950s B-movie look is for films only.** "Remember the 1950s horror B movie
   aesthetic", then: "when we go 1950s B movie I would only have that for like animations
   and news clippings."
4. **Daily life.** Of `r2-castes-human.png` and `r2-faction-leaders.png`: "I like these for
   body types of daily life in these videos etc."
5. **Units.** Of `r2-army-spectrum.png`: "for units this is a good starting point but try a
   few more times."
6. **The ship.** "It should be so different from the rest of the game it is jarring, very
   lifelike, very sci fi … this is a far future ultra religious human society (the
   technopuritan logo is a black gear), they hate luxury, idolatry, and are obsessed with
   making things efficient and higher tech." The first ship picture (a 1950s government
   office in orbit) "completely misses the aesthetic".
7. **Also needed on the ship:** "the game play map on the ship (a holographic projection of
   the planet with zones) and some exteriors of the ship."

## Three looks, kept apart on purpose

| Where | Look | Reference pictures |
|---|---|---|
| The board (all play) | Realistic, detailed, overcast daylight. An insect-made city of paper, wax and clay; your body wet and red on it. | `board-paper-city.png`, `board-clay-city.png`, `limbs.png`, `r3-units-in-game.png` |
| Films and news clippings | 1950s colour horror B-movie: insect people in 1950s clothes, lurid light, film grain, painted posters | `r2-film-still.png`, `r2-keyart-poster.png`, `r2-castes-human.png`, `r2-faction-leaders.png`, `poster.png` |
| The ship | Lifelike hard science fiction: black, white, bare, exact. Jarring after the other two. | `r3-ship-operations-black.png`, `r3-ship-operations-white.png`, `r3-ship-gene-bay.png`, `r3-ship-globe-room.png`, `r3-ship-exterior-side.png` |

## The board

- **The city is insect-made:** wasp paper, wax, dried clay; hexagonal cells, ribbed arches,
  round doorways lit amber. Flat-topped blocks of three heights, because limbs stand on them.
- **Paper and clay are both liked.** Proposal: they are different territories. Pale paper
  for the Crash Site and the suburbs, terracotta clay for the Granary Belt and Foundry
  Plains. On clay, red flesh has less contrast, so limbs there need a stronger rim.
- **The body:** salmon-pink wet muscle, dark chitin, ivory bone. Creep is dark maroon,
  matte and veined: thick on roofs, a thin film on streets.
- **Light and dark, darkest first:** unclaimed city under smoke; creep; insects; limbs;
  streets. Insects are dark so they read on pale streets; limbs are light so they read
  on dark creep.
- **Sprites are lit evenly from overhead.** Coloured light baked into a sprite breaks the
  green-screen key and looks wrong when the sprite is mirrored.

## One flesh, nine accents

Every limb is mostly the same flesh and chitin, with ONE accent from its theme organ, so
the theme reads before the limb does (`limbs.png`).

| Theme organ | Accent |
|---|---|
| Meteor Core | Plain muscle and chitin |
| Bone Forge | Ivory bone |
| Venom Sac | Acid yellow-green glands |
| Gut | Dark wine red, teeth |
| Nerve Cluster | Pale blue-white nerve cord |
| Mucus Lattice | Glassy, translucent |
| Brood Womb | Pink eggs |
| Marrow Vault | Amber marrow |
| Resonance Chamber | Violet membrane |

## The Colony's people: human-like, beast, machine

One species whose body changes with the job. The army runs from human-like to beast to
machine, and the beasts and machines have human-like crew, so nothing on the field is only
a monster.

| Kind of caste | What it looks like | Examples |
|---|---|---|
| Human-like | Upright, two legs, four arms with hands, big expressive eyes, antennae that work as eyebrows, clothes | Commuter, mother and child, scientist, first responder, militia volunteer, preacher, delegate, the Director, the queen |
| Beast | Animal, no clothes, moves in packs | Skitterlings, the swarm |
| Machine | A huge body that is a vehicle or a gun, with a small human-like crew | Shield-bearer with a driver; siege cannon with a crew, one covering his ears; flier in goggles and a scarf |

- Caste colour is a MARKING (armband, stripe, sash), never the body colour: war orange,
  science teal, royal gold.
- Each kind borrows from the real insect that does its verb: bombardier beetle for the
  cannon, pill bug for the shield wall, stag beetle for the elite, termite for the sapper,
  cicada for the drummer, mole cricket for the tunneler.
- At 24 px a helmet or a briefcase is a speck; the same design carries the close-ups.

**Unit tries so far** (rule 5 asks for several):

| Picture | What is on it | Fault |
|---|---|---|
| `r2-army-spectrum.png` | Militia, soldier, swarm, shield-bearer, siege cannon, flier | — |
| `r3-units-army-1.png` | The same six, second try | — |
| `r3-units-army-2.png` | First responder, soldier, elite, sapper, bomber, drummer | — |
| `r3-units-army-3.png` | Shield wall, carapace lord, mortar beetle, siege cannon, tunneler | The small crew came out with HUMAN faces. They must be insect people. |
| `r3-units-science-royal.png` | Researcher, thief, sedation battery, veil matron, consort, queen | — |
| `r3-units-in-game.png` | A column on a pale street from the game's camera, civilians in a doorway | The cannon came out as a wheeled cart, not a beetle |

## Films and news clippings: the 1950s B-movie

Used ONLY for animations (openings, faction calls, daily life, endings) and news
clippings. Never for the board.

- Saturated early colour film; hard theatrical light; deep black shadows
- Coloured light from off screen (toxic green, magenta); painted skies
- Monsters that feel like superb practical effects: gelatin, latex, creature suits
- Film grain, soft old lenses
- Dripping title lettering; lobby cards; lurid painted posters
- The Empire's side of it: newsreel narration, cheerful pest-control advertising
- In these films the town is small-town America (diner, church, water tower, drive-in)
  and the people wear 1950s clothes.

## The ship: the Technopuritan Empire

Lifelike, far-future, and so unlike the rest of the game that it jars.

- **Who they are:** a far-future, ultra-religious human society. They hate luxury and
  idolatry and are obsessed with efficiency and ever higher technology.
- **The mark:** a plain black gear. It is the only symbol anywhere.
- **Never:** pictures, statues, icons, patterns, ornament, coloured accent light, neon,
  cushions, clutter, anything retro.
- **Always:** matte black and bare pale ceramic; flush seams; exact edges; perfect order;
  even white light; razor-thin holographic displays; standing workstations and hard
  benches.
- **The crew:** plain black high-collared garment, narrow white collar. They read as
  clergy, which is right.
- **The one coloured thing aboard** is the organism in the gene bay (`r3-ship-gene-bay.png`).
- **The campaign map** is a holographic globe in a dark room: territories outlined by thin
  lines, held ground dark red, a territory under attack amber, landing sites outlined
  brighter (`r3-ship-globe-room.png`, `r3-ship-globe-close.png`).
- **Exterior:** plain geometric volumes, bare pale hull with the black gear, black
  radiators, nothing that is not needed (`r3-ship-exterior-side.png`,
  `r3-ship-exterior-drop.png`). `r3-ship-exterior-ring.png` reads as present-day hardware,
  not far future: weakest of the three.

## OPEN — Collins's calls

1. **The HUD.** It is khaki paper and stencil type today. It is the Empire's software, so
   it could follow the ship (black, white, exact, the gear) instead. Newsreel narration
   and the pest-control tone would stay either way.
2. **War caste colour:** safety orange rather than orange-red, so war markings never read
   as your flesh. It is also the WAR meat counter in the HUD.
3. **Paper and clay as different territories** (proposed above).
4. **Which ship exterior** is the *Merciful Yoke*: the smooth slab
   (`r3-ship-exterior-side.png`) or the blocky modular one (`r3-ship-exterior-drop.png`).

## Prompt blocks (shared by every asset; from `tools/art/concepts.mjs`)

- **Board:** "Realistic, grounded, physically plausible materials, soft overcast daylight.
  No text, no lettering, no interface, no borders."
- **Colony people (films):** "insect people like those of a 1950s science-fiction film:
  human posture and human body language, two legs, four arms with small hands, an insect
  head with large expressive eyes, small mandibles like a mouth and antennae that move
  like eyebrows, dark umber chitin and pale amber eyes instead of skin"
- **Body:** "salmon-pink wet muscle armoured with plates of dark chitin and ivory bone,
  glistening"; creep: "a living skin that is dark maroon, matte and veined, thick on the
  rooftops and only a thin translucent film on the streets"
- **Film:** "Lurid saturated Technicolor, hard theatrical key light with deep black
  shadows, toxic green and magenta rim light from coloured gels off screen, a painted
  backdrop sky, film grain, the slight softness of old lenses."
- **Empire:** "a far-future, ultra-religious, ascetic human society that despises luxury
  and decoration, forbids images and idols, and is obsessed with efficiency and ever more
  advanced technology" plus "Extremely advanced technology and extreme plainness. Nothing
  soft, nothing ornamental, nothing wasted: no pictures, no statues, no icons, no patterns,
  no coloured accent lighting, no neon. The only marking anywhere is one small plain black
  gear symbol (a cogwheel)."
- Once pictures are approved, 2–3 of them go with every request as reference pictures.
  That holds a look better than any wording.

## What the three rounds showed about the image model

- It draws all of this without refusing, lettering included.
- It adds lettering nobody asked for (a shop sign reading "RIVERSIDE INSECTICIDE CO." in
  the key art). Pictures need checking for stray words.
- Asked for "small human-like crew", it drew humans. Say "insect people" every time.
- Four arms survive in portraits and mostly in line-ups.
