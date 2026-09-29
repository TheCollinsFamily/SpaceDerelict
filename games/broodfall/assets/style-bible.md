# Broodfall style bible — v2 (Sep 29 2026)

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
3. **Units on the map are a little cartoonish.** "With the units you really have not nailed
   the way they will actually be animated on the map (what you have is fine for videos) …
   the map drawings have to be a little cartoonish (look at units in starcraft or red
   alert 2) but you are making them super realistic."
4. **The 1950s B-movie look is for films only.** "When we go 1950s B movie I would only
   have that for like animations and news clippings."
5. **Daily life.** Of `r2-castes-human.png` and `r2-faction-leaders.png`: "I like these for
   body types of daily life in these videos etc."
6. **The ship.** "It should be so different from the rest of the game it is jarring, very
   lifelike, very sci fi … this is a far future ultra religious human society (the
   technopuritan logo is a black gear), they hate luxury, idolatry, and are obsessed with
   making things efficient and higher tech." Of `r3-ship-operations-black.png` and
   `r3-ship-operations-white.png`: "I love some of the interior." Of
   `r3-ship-exterior-ring.png`: "this one is not bad."
7. **The character.** "Yes the technopuritan empire is austere and the main character buys
   into that ideology but he is far from the perfect citizen, a bit of a nerd, likely
   designed his own tchotchkes on his desk … sleeps on a simple flat piece of metal that
   retracts back into the wall (I think you capture the vibe here
   [`r3-ship-operations-white.png`]) but has his own interests (maybe spec the interface for
   hobby missions to see this) … he is relatable … he buys into the values of the empire
   because they make sense to him but he is still just a young guy hoping for promotion and
   a partner."
8. **The ship's AI** is "a female anime girl projection, torso up".
9. **Also needed on the ship:** "the game play map on the ship (a holographic projection of
   the planet with zones) and some exteriors of the ship."

## Four looks, kept apart on purpose

| Where | Look | Reference pictures |
|---|---|---|
| The board: city, limbs, landing site | Realistic, detailed, overcast daylight. An insect-made city of paper, wax and clay; your body wet and red on it. | `board-paper-city.png`, `board-clay-city.png`, `limbs.png` |
| The board: units | A little cartoonish, like late-1990s strategy game units: chunky, big heads and weapons, bold shapes, caste colour in large patches | `r4-units-rts-war.png`, `r4-units-rts-war-2.png`, `r4-units-rts-science-royal.png` |
| Films and news clippings | 1950s colour horror B-movie; realistic insect people in 1950s clothes | `r2-film-still.png`, `r2-keyart-poster.png`, `r2-castes-human.png`, `r2-faction-leaders.png`, `poster.png` |
| The ship | Lifelike hard science fiction: black, white, bare, exact. The one drawn thing aboard is the AI. | `r3-ship-operations-black.png`, `r3-ship-operations-white.png`, `r4-hero-bunk.png`, `r4-yoke-in-room.png` |

## The board

- **The city is insect-made:** wasp paper, wax, dried clay; hexagonal cells, ribbed arches,
  round doorways lit amber. Flat-topped blocks of three heights, because limbs stand on them.
- **Paper and clay are both liked.** Proposal: they are different territories. Pale paper
  for the Crash Site and the suburbs, terracotta clay for the Granary Belt and Foundry
  Plains. On clay, red flesh has less contrast, so limbs there need a stronger rim.
- **The body:** salmon-pink wet muscle, dark chitin, ivory bone. Creep is dark maroon,
  matte and veined: thick on roofs, a thin film on streets.
- **Light and dark, darkest first:** unclaimed city under smoke; creep; insects; limbs;
  streets.
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
machine, and the beasts and machines have insect crew, so nothing on the field is only a
monster.

| Kind of caste | What it looks like | Examples |
|---|---|---|
| Human-like | Upright, two legs, four arms with hands, big expressive eyes, antennae that work as eyebrows, clothes | Commuter, mother and child, scientist, first responder, militia volunteer, preacher, delegate, the Director, the queen |
| Beast | Animal, no clothes, moves in packs | Skitterlings, the swarm |
| Machine | A huge body that is a vehicle or a gun, with a small insect crew | Shield-bearer with a driver; siege cannon with a crewman covering his ears; flier in goggles and a scarf |

- Caste colour is a MARKING (armband, stripe, sash), never the body colour: war orange,
  science teal, royal gold.
- Each kind borrows from the real insect that does its verb: bombardier beetle for the
  cannon, pill bug for the shield wall, stag beetle for the elite, termite for the sapper,
  cicada for the drummer, mole cricket for the tunneler.
- **Every kind exists twice:** a cartoon sprite for the map and a realistic body for films.
  Same design, same markings, two renderings.

### Map units (rule 3)

| Picture | What is on it |
|---|---|
| `r4-units-rts-war.png` | Militia, soldier, stag-beetle elite, swarm, shield-bearer, siege cannon, flier |
| `r4-units-rts-war-2.png` | First responder, sapper, bomber, drummer, tender, tunneler |
| `r4-units-rts-science-royal.png` | Researcher, thief, sedation battery, consort, veil matron, queen |
| `r4-units-rts-on-board.png` | MISSED: asked for cartoon units on the realistic board, the model drew realistic units |

**Tested as real sprites** (`notes/probes/2026-09-29/unit-style/`,
`node tools/art/probe-unit-style.mjs`): a cartoon soldier and a cartoon militia volunteer,
each with a walking loop, beside the realistic soldier at 128, 64 and 32 px. At 32 px the
cartoon ones still read (the volunteer is "a little guy in a big helmet with a spear"); the
realistic one fades, worst on creep. The video model animated the cartoon style as readily
as the realistic one.

### Realistic bodies, for films (rule 5)

`r2-castes-human.png`, `r2-faction-leaders.png`, `r2-army-spectrum.png`,
`r3-units-army-1.png`, `r3-units-army-2.png`, `r3-units-science-royal.png`.
`r3-units-army-3.png` has a fault: the small crew came out with human faces.

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
- **The one coloured thing aboard** is the organism in the gene bay (`r3-ship-gene-bay.png`).
- **The campaign map** is a holographic globe in a dark room: territories outlined by thin
  lines, held ground dark red, a territory under attack amber, landing sites outlined
  brighter (`r3-ship-globe-room.png`, `r3-ship-globe-close.png`).
- **Exterior:** an upright pale cylinder with one rotating ring and two black panels, the
  black gear on the hull (`r3-ship-exterior-ring.png`, the one Collins picked;
  `r4-ship-exterior-ring-2.png` is a plainer, more advanced take;
  `r4-ship-exterior-ring-drop.png` shows it releasing the meteor).

## The character

A junior clearance technician. About twenty-five, slight, earnest, a bit of a nerd. He
believes in the Empire because its values make sense to him, and he is still just a young
man hoping for a promotion and a partner (`r4-hero-portrait.png`).

- **The uniform, worn slightly wrong:** plain black, narrow white collar, sleeves pushed
  up, a stylus behind one ear.
- **His cell is regulation:** a flat metal slab that folds out of the wall, one thin
  blanket, one black book (`r4-hero-bunk.png`).
- **PROPOSAL, not yet Collins's: he never buys anything, he makes it.** In a culture that
  hates luxury and worships efficiency, making is a virtue, so his personality comes out
  as craft. His desk has a neat row of things machined from spare parts: a gear puzzle, a
  tiny articulated insect "for study", a cup with cooling fins of his own design, a
  palm-sized orrery of the planet, a jar with a scrap of the organism (`r4-hero-desk.png`).
  He has a justification ready for each.

### The hobby interface (spec)

The same razor-thin display shows two kinds of screen, and the difference is the character.

| | Official screens | Hobby screens |
|---|---|---|
| Which | Directive Desk, Requisition Board, Procreation Board | Specimen Locker; the dares and experiments in a briefing; his log |
| Look | Ruled forms, machine type, black and white, the gear, form numbers | His own notebook: loose pages at slight angles, pen lines, handwriting |
| Goal text | "Form 7-C, Pest Volume Quota" | "What if I put her in a cage??" |
| A goal is shown as | A row in a form | A sketch with arrows and notes |
| Dares | — | A checkbox list like a kid's summer list |
| The credit | Standing: a number in a box | Field notes: tally marks in the corner of a page |

- **Choosing a dare** ticks its box with a pen stroke. **Finishing one** gets a drawn star.
- **The experiment chosen for the next deployment** is the page pinned on top with a drawn
  paperclip.
- **The notebook gets thicker** as field notes accumulate.
- **To make:** one sketch for each of the 5 experiments, a doodle for each of the 9 dares,
  a handwriting typeface, a page texture.
- Reference: `r4-hobby-interface.png`.

## The ship's AI (YOKE)

A female anime girl projection, shown from the waist up. She is the one thing on the ship
that is drawn rather than real.

| Picture | Design |
|---|---|
| `r4-yoke-colour.png` | Long pale silver hair, amber eyes, soft colour, a gear hair clip, the Empire's black dress |
| `r4-yoke-austere.png` | Dark hair tied back, one colour of pale light, severe |
| `r4-yoke-expressions.png` | Six expressions of the silver-haired design, for dialogue |
| `r4-yoke-in-room.png` | Talking with the character at the workstation |

**PROPOSAL, not yet Collins's:** the Empire's standard ship AI is text and a voice. The
projection is something the character installed himself. It is the biggest tell that he is
a nerd, and it explains why she looks like nothing else aboard.

## OPEN — Collins's calls

1. **Which YOKE:** silver-haired in colour, or dark-haired in one colour of light.
2. **Did he install the projection himself** (proposal above).
3. **"He makes, never buys"** as the rule for his things (proposal above).
4. **Are limbs cartoonish too?** Rule 2 likes the realistic limbs; rule 3 makes units
   cartoonish. Cartoon units beside realistic limbs has not been seen on one screen yet.
5. **The HUD.** It is khaki paper and stencil type today. It is the Empire's software, so
   it could follow the ship (black, white, exact, the gear) instead.
6. **War caste colour:** safety orange rather than orange-red, so war markings never read
   as your flesh. It is also the WAR meat counter in the HUD.
7. **Paper and clay as different territories** (proposed above).

## Prompt blocks (shared by every asset; from `tools/art/concepts.mjs`)

- **Board:** "Realistic, grounded, physically plausible materials, soft overcast daylight.
  No text, no lettering, no interface, no borders."
- **Map units:** "Drawn as unit sprites for a late-1990s real-time strategy game with
  pre-rendered 3D units: a little cartoonish, chunky and exaggerated, with oversized heads,
  jaws, weapons and shoulders, thick sturdy legs, bold simple shapes, little fine detail,
  strong light and dark, and the caste colour in large flat patches. Each one must still
  read clearly when shrunk to the size of a thumbnail."
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
- **The character:** "a young man of about twenty-five, slight, earnest and a bit of a
  nerd, short dark hair slightly untidy, a plain black high-collared garment with a narrow
  white collar, its sleeves pushed up to the elbows, a stylus tucked behind one ear"
- Once pictures are approved, 2–3 of them go with every request as reference pictures.
  That holds a look better than any wording.

## What the rounds showed about the image model

- It draws all of this without refusing, lettering included.
- It adds lettering nobody asked for (a shop sign reading "RIVERSIDE INSECTICIDE CO." in
  the key art). Pictures need checking for stray words.
- Asked for "small human-like crew", it drew humans. Say "insect" every time.
- Asked for cartoon units inside a realistic scene, it made everything realistic. A style
  holds when the whole picture is in it; mixed styles have to be composited from parts.
- The character's face differs between pictures. A fixed face needs one approved portrait
  passed as a reference picture every time.
