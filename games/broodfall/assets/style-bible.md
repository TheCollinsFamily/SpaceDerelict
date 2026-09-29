# Broodfall style bible — v7 (Sep 29 2026)

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
9. **We see the character from behind.** Of `r4-hero-portrait.png`: "love these, but remember we
   usually only see him from behind because he is our character."
10. **YOKE is the silver-haired one.** Of `r4-yoke-expressions.png` and `r4-yoke-colour.png`: "like
    this for the AI."
11. **Approved as they are:** `r4-hero-bunk.png`, `r4-yoke-in-room.png`, `r4-hobby-interface.png`
    ("love these").
12. **The two sides must contrast.** Of `r4-units-rts-on-board.png`: "this is very good for creep and
    towers but highlights an issue: both forces look too monstrous and so you don't get good
    contrast … I can see it working for the architecture of insects and their dress style (at
    least the warrior caste): think eastern orthodox."
13. **Spec real units.** "I would focus on trying to spec actual game units rather than in the
    abstract, that is your issue." The spec is `assets/unit-spec.md`: all 26 kinds in the game.
14. **Also needed on the ship:** "the game play map on the ship (a holographic projection of
   the planet with zones) and some exteriors of the ship."
15. **The units in Orthodox dress are liked.** Of the phalanx sheet, the army sheet and the
    science sheet: "a lot of these are great."
16. **A 21st-century civilisation.** "Remember this is a 21st century civilisation on the edge of
    AI; if they have melee weapons they are closer to power blades and stuff, and many would
    likely have short range guns (keep in mind this will make animations make a lot more sense
    when they attack towers on the side of the trail, and we already have the programming for
    it for our projectile units; these ones just have a range that means in terms of gameplay
    they are functionally melee)."
17. **The science caste is less Orthodox.** "The science caste would be distinctively less
    orthodox in tone, but I think they came out great."
18. **Buildings merge Orthodox INTO their own architecture.** Of `city-orthodox-blocks.png` and
    `board-orthodox.png`: "the one thing that was a total bust was the buildings: too many blue
    domes for one, too human looking. I expected you to merge the style with their distinct
    architecture [`r4-units-rts-on-board.png`] and more tech, remember again 21st century civ."
19. **The body is ONE art style with its creep.** Of the first board in the engine: "holy shit
    man that looks good, but the towers are too … they don't really fit the style of the city
    and creep, it looks like two different art styles imposed … same with the central body of
    the creature … maybe they could be modified to fit that style." See "The body is made of
    its creep" below.
20. **The ship art is approved.** "The ship art is awesome BTW."
21. **The creep is approved, and the planet has many kinds of place.** "The creep actually looks
    fine … please build tile sets for different environments: you are going to want one that
    looks sort of american suburb inspired / one that looks cyber punk mega city inspired / one
    that looks 'oriental', by that I mean not exactly japanese or chinese but sort of the 1950s
    westernized view of the orient … and remember in the architectural style of this species,
    so not those directly … any other tile sets that would be cool? if you can think of them
    make them." See "The tile sets" below.
22. ~~**Towers are drawn from one side only.** "Towers (which don't need multiple angles)."~~
    WITHDRAWN by rule 26, the same day.
23. **A limb stands IN its cell.** Of the restyled limbs on the board: "the towers look way
    better in terms of how they fit in frame now! that said the way they sit is not working,
    especially when they are on the side closer to the viewer of a lane … there are two
    things I think causing this: 1. the convention of the creep not actually going to the
    edge makes the usable space in a square highly variable and thus visual mess-ups like
    this, 2. and … um, something? I am sure you will figure it out … also the placement of
    the central body just makes it look like it's floating." The something was the anchor.
    See "Where a limb stands" below.
24. **Where a limb stands is MARKED BY EYE, not computed.** "You actually probably want to
    manually have something paint the visual center of the bottom of a tower (a vision
    model). Why? Well consider tall towers or oddly shaped ones, this could cause issues."
25. **Some towers stand on several squares.** "How do we handle towers that appear over
    multiple squares? we should have some of those, they are a core part of the strategy in
    tower defence." DESIGN.md, "BIG limbs".
26. **Towers need more than one view, and the camera turns.** "I also thought we would be
    able to get away with just one view of the towers but I am wrong, because towers will
    need to be rotated to fit certain positions, and as the user with E or Q moves the screen
    around (necessary for most gameplay) we would get a 'doom effect' if we did that."
27. **Everything on the board is as sharp as everything else.** "The core is looking a
    different resolution than the towers, which looks awful."
28. **The limbs sit well; the core did not.** "Great job making the limbs sit well (little
    improvement room but generally good) … the core (whatever we are calling the center
    thing) is not sitting well AT ALL and I am kind of shocked you didn't notice: in every
    picture it's just kind of floating there over parts of the environment etc. It may need
    to be redrawn because it looks a little jaunty." See "The landing site, in two parts".
29. **Many towers take more than one square, and height is won.** "I don't see any of them
    being more than one square, which is a huge part of tower defence gameplay: getting that
    raised location that happens to fit the tower you want at a high height and then
    adjacency bonuses and everything (also platforms that raise the height of one thing by
    one amount: let's have an organ that generates 1 every two waves for free)." DESIGN.md,
    "BIG limbs" and "Plinths".
30. **Faction scenes are liked; contact must make sense.** Of the Friendship Delegation's
    contact card: "love stuff like [this] (I mean obviously would not be hand delivered;
    how they contact you will be unique to each faction but needs to make sense)."
31. **The ship's AI is someone to talk to.** "Keep building out and personality for the
    hologram; we will use the rfab living avatar system to make her something the player
    can chat with and she will feel real."
33. **Units are drawn from ABOVE.** "Most of your character sheets are not usable … they are
    in profile and not from above with an angle … making units that are visually distinct
    and understandable from above is one of the key challenges of the StarCraft / Warcraft
    style of art we opted into." The prompt had said "tilted about 45 degrees down"; the
    model drew the angle of its REFERENCE (the concept sheet, drawn near eye level) instead.
    What worked (probe: `notes/probes/2026-09-29/unit-camera/old-A-B.jpg`): the camera said
    three ways (the angle; what faces the camera: the top of the helmet and the shoulders;
    what is small: body foreshortened, feet tucked under) AND a picture of the real board as
    a second reference ("seen by exactly that camera"). Units that still came out upright get
    a unit drawn at the right angle as a third reference (`steep` in `tools/art/units.mjs`).
    Readability from above: the helmet or crest and the weapon exaggerated, caste colour in
    large flat areas on the top of the helmet and the shoulders. Look at a unit's five views
    before paying for its clips. A rule for every picture: **the reference wins over the
    words**; to change an angle, change the reference.
32. **Tile sets must not look samey, and one is rural.** "You need at least one rural tile
    set and more assets for the others so they look less samey. With AI this is laughably
    cheap compared to what it used to cost so let's take advantage of that."

## NO REAL RELIGIOUS SYMBOL, EVER (a rule from Claude, Sep 29 2026; Collins can overrule it)

The colony's dress and buildings are Eastern Orthodox in STYLE. They never carry a real
religious symbol: no crosses, no stars, no crescents. Their one emblem is a plain gold
hexagon (a honeycomb cell), and domes end in a plain gold ball.

- Why: the player exterminates these people. With a cross on every helmet the game is about
  killing Christians; the first replacement tried, a six-pointed star, came out as a Star of
  David. Those pictures were withdrawn before they were committed to this public repo.
- DESIGN.md already asks for this of the Faithful: "vague enough that players of each group
  assume it's the other".
- The image model adds crosses BY ITSELF whenever it is asked for Orthodox dress. Every
  picture is checked for them, zoomed in, before it is kept. Telling it WHERE the crosses
  are ("on the five helmets") removes them; "everywhere" does not.
- They come back on every redraw: as helmet badges, and as a plus sign on a medic's pack.
  Check again after every edit, not only after the first draw.

## Four looks, kept apart on purpose

| Where | Look | Reference pictures |
|---|---|---|
| The board: city, limbs, landing site | Realistic, detailed, overcast daylight. The insects' own paper-and-honeycomb city in eight tile sets (the first with Orthodox domes and mosaic grown into it), 21st-century technology bolted on; your body, made of its own creep, wet and dark red on it. | `board-hive-a.png`, `board-hive-b.png`, `city-hive-blocks.png`, `city-hive-block-close.png`, `limbs.png` |
| The board: units | A little cartoonish, like late-1990s strategy game units: dressed little people with guns and power blades, chunky, big heads and tools, caste colour as clothing | `units-v2-1-first-waves.png` to `units-v2-6-royal.png` (all 26 kinds) |
| Films and news clippings | 1950s colour horror B-movie; realistic insect people in 1950s clothes | `r2-film-still.png`, `r2-keyart-poster.png`, `r2-castes-human.png`, `r2-faction-leaders.png`, `poster.png` |
| The ship | Lifelike hard science fiction: black, white, bare, exact. The one drawn thing aboard is the AI. | `r3-ship-operations-black.png`, `r3-ship-operations-white.png`, `r4-hero-bunk.png`, `r4-yoke-in-room.png` |

## The board

- **The city is three things at once** (rule 18):
  1. **Their own architecture first:** pale wasp paper, wax and resin; walls of honeycomb
     cells; ribbed organic arches; round cell doorways. Never a human building.
  2. **Orthodox grown into it:** roofs that swell into onion domes of layered paper like
     hanging nests, a few gilded; arcades of round arches; bands of gold and coloured mosaic
     pressed into the wax; bell towers like nest spires. Pale cream, honey amber and gold.
     Blue only as small accents in the mosaic: NO blue domes.
  3. **The 21st century bolted on:** solar panels, satellite dishes, radio masts,
     air-conditioning units, cables between buildings, street lamps, traffic lights, screens
     and signs showing abstract glyphs, small parked cars shaped like beetles.
- **Every block has a wide flat roof terrace** ringed by a parapet, with domes and masts kept
  to the corners and edges, because limbs stand on the roof. Three heights. Four kinds:
  residential, research quarter, provision district, temple heights (`city-hive-blocks.png`).
- **Two amounts of Orthodox were drawn:** as accents (`board-hive-a.png`) and generous
  (`board-hive-b.png`). In the generous one the street is so busy that units are hard to
  pick out. `city-hive-block-close.png` is one block being taken: creep running down the
  honeycomb, over the mosaic and an air-conditioning unit.
- **REJECTED** (rule 18, "a total bust"): `city-orthodox-blocks.png` and `board-orthodox.png`,
  the white human-looking city with blue domes. Kept in the folder only as what not to do.
- **Creep is dark maroon, matte and veined:** thick on roofs, a thin film on streets (in the
  game at 34% so that the street and the units on it still read). APPROVED (rule 21).
- **Light and dark, darkest first:** unclaimed city under smoke; creep; insects; limbs;
  streets.
- **Sprites are lit evenly from overhead.** Coloured light baked into a sprite breaks the
  green-screen key and looks wrong when the sprite is mirrored.

### The body is made of its creep (rule 19)

The first limbs and the first landing site were salmon-pink muscle on a grey rubble base:
clean, pale and lit like a product photograph. On the board they looked pasted onto the dark
veined creep. What fixed it, in the order of how much each did:

1. **The material.** Every limb, and the core, is REDRAWN from two pictures: its own design
   (its shape) and the creep texture (its material). The prompt is `MATERIAL` in
   `tools/art/limbs.mjs` (`CORE_MATERIAL` in `tools/art/templates/terrain.mjs`): "made of
   exactly the living tissue shown in the second picture … the same body as that tissue,
   risen up into a shape". Raised parts are a lighter crimson than hollows so the form reads.
2. **The skirt.** Its roots melt into a low ragged skirt of the same tissue lying flat on the
   ground, so there is no edge where the limb stops and the creep begins. No rubble, no base.
3. **A contact shadow.** The renderer darkens the ground under each limb (`isoRender.ts`).
4. **Light from the top.** The bake brightens a limb toward its top, so it reads as standing
   up out of a dark floor rather than as a flat patch of it.

The theme accent (next section) stays: it is the one thing on a limb that is not creep.
Design stills are kept as `art-src/limbs/<family>/still.png`, the redrawn ones as
`styled.png`; clips are made from the redrawn one. To compare in the engine:
`node tools/shot-limbs.mjs`.

### Where a limb stands (rules 23 and 24)

A limb is a picture of something standing on the ground. The game puts ONE point of that
picture on the middle of a cell. Three things were wrong, and all three had to be right:

1. **The point was its lowest pixel** (the front tip of its skirt of roots). So every limb
   stood on the back half of its cell and hung over whatever was behind it; on the near
   side of a street it hung over the street. The point is now **the middle of what it
   stands on**: the middle of the WIDEST row of its skirt.
2. **That point is marked by eye** (rule 24), in `tools/art/limbs.mjs`: `foot: [x, y, width]`
   and, of a view from behind, `backFoot`. `node tools/art/feet.mjs` draws every limb under
   a grid of tenths with its cell under it; whoever runs it (a vision model, or a person)
   reads the grid and writes the mark. The computer's own guess is drawn when there is no
   mark: on Sep 29 it was wrong on a third of them (it put the spitter and the mister on a
   cell half their size, and gave up on five). A limb with no mark FAILS its bake.
3. **The creep stopped short of every edge,** so the ground a limb had was whatever the
   ragged edge left of the cell. It now runs to the edge of every roof it holds and down the
   wall; it stops ragged only where the same surface goes on bare; and the cells a limb
   stands on are whole.

What holding roofs to their edges cost, and what paid it back: a board the body has taken
became one flat red carpet, because the bare rim had been outlining every block. Roofs read
as roofs again by three things: the skin is lighter the higher it lies; a lit lip runs along
the two front edges of every roof, where the skin rolls over; and a roof at the foot of a
taller block lies in its shade.

### The landing site, in two parts (rule 28)

The landing site was ONE picture: the meteor on a mound of roots four cells wide, drawn by
the image model at its own angle and laid over the square. Marking where it stands (as the
limbs are marked) was tried first and was not enough: Collins saw it still floating, and
leaning. **A picture that wide cannot be made to sit.** Whatever of it lies on the ground
has to lie in the ground's own perspective exactly, and no image model draws a disc four
cells wide exactly; where it is a few degrees off, its far edge hangs over the roofs behind
it and its near edge over the street.

So it is two things now (`tools/art/templates/core.mjs`):

1. **The ground:** the crater and the roots that spread from it, painted from STRAIGHT
   ABOVE like a floor texture, and laid on the ground by the game with the same matrix that
   lays the floors. It cannot float: it is the ground. Blocks stand on it, and it turns with
   the camera.
2. **The heart:** only what stands up, the split meteor and the heart in it, on a collar no
   wider than a limb's skirt, drawn upright and level. A sprite like a limb's, standing
   where its footing is marked (`HEART_FOOT`), in the middle of the square.

The rule this gives for everything to come: **what is wider than about two cells and lies
on the ground is painted from above and laid by the game; only what stands up is a sprite.**
It holds for big pools, scorch marks, shadows, roads of creep, anything flat.

The lesson about looking: the orchestrator looked at the landing site on its review sheet
and in the late game, where the board is covered in skin and it has nothing to float over.
It floats at MINUTE ZERO, on the bare square. Look at a thing where it has the most to be
wrong against.

To look at: `notes/art-review/limbs/<family>-standing.jpg` (every way it can face, with
its cell), `notes/art-review/terrain/core-standing.jpg`, `notes/art-review/feet/`.

### Two views of a limb, and the camera that turns (rule 26)

- A limb faces one of four ways IN THE WORLD. Two pictures are drawn: from the front (it
  faces the lower left) and from behind (it faces the upper right). The other two ways are
  those mirrored.
- The view from behind is drawn FROM the front view (`BACK` in `tools/art/limbs.mjs`), so it
  is the same organism; each limb says what is seen of it from behind (`back:`). Look at the
  still before paying for its clips: `node tools/art/make.mjs limb <family> --stills`.
- 15 of the 36 are lopsided and have both. The rest are the same all the way round.
- Cost of a view from behind: a still and one or two clips, about $0.90.

### As sharp as each other (rule 27)

What is drawn bigger needs bigger frames and a bigger clip. A limb of one cell: a 640 px
clip, 256 px frames. A big limb (two cells wide): 384 px frames. The landing site (four
cells wide): a 960 px clip (`resolution: '720p'`), 640 px frames. At 320 it had half the
sharpness of the limbs round it.

## The tile sets (rule 21)

The planet has eight kinds of place. Every one is THE SAME SPECIES building in its own way
(wasp paper, wax, walls of honeycomb cells, ribbed arches of beads, round doorways) and
borrowing one look, the way the first set borrowed the Orthodox one. None of them is a human
building with insects in it. The data is `tools/art/biomes.mjs`; the template is
`tools/art/templates/biome.mjs`; to look at each: `notes/art-review/biomes/<set>.jpg`.

| Set | Borrows from | Territories |
|---|---|---|
| `orthodox` The Temple Cities | Eastern Orthodox: paper onion domes, gold mosaic (the first set) | Temple Terraces, Seventh City, Assembly Hall |
| `suburb` The Suburbs | An American suburb of the 1950s: pastels, porches, picket fences of wax, awnings, beetle cars, dandelion trees | Crash Site, Cul-de-Sac Heights, Commuter Ring |
| `megacity` The Megacity | A cyberpunk megacity: smoked resin and black glass, neon glyphs, cables, steam, a noodle counter | University Hill, Glass Spires, Hidden Campus |
| `orient` The Lantern Cities | The Far East as a Western film of the 1950s imagined it, not any real country: upswept paper eaves, lacquer red, jade tiles, lanterns, moon gates; carved beetles where a film would carve dragons | Pilgrim Road, Mirewater Delta |
| `industrial` The Works | A port and factory town: soot, riveted iron, pipes, furnace light, hazard stripes | Old Harbor, Foundry Plains |
| `farmland` The Granary Belt | A farming town of the American Midwest: red barns, silos, wind pumps, hay | Granary Belt |
| `necropolis` The Ossuary Coast | A city of the dead: bone-white chalk, niches of urns, candles, black iron, fungus cypresses | Ossuary Coast |
| `deephive` The Deep Hive | Nothing: the oldest part of their civilisation, grown rather than built: amber comb, brood cells, royal jelly, queen cells | Queen's Hollow |

Rules every set keeps:

- **A set is nine pictures:** three floors (street, square, roof), four walls (one per kind
  of district in the game: plain, science, meat, highground) and two sheets of props (eight
  for roofs, six for streets). The walls are drawn with the first set's plain wall as a
  reference, for its flat view and the size of its doors and windows only.
- **The body is the same everywhere:** creep, core, limbs and spore pods are not part of any
  set. Neither is the smoke over the unclaimed city.
- **Streets are pale.** Units are dark and walk in the streets. A street that comes out dark
  (the megacity's wet concrete came out at 85 of 255) is brought up in the bake to at least
  132, along a curve that lifts its darks and leaves its lights alone.
- **Roofs are flat and bare in the middle.** Limbs stand on them.
- **Signs and screens show abstract glyphs,** never lettering. Banners carry insects.
- **No real religious symbol** (the rule above) and none from the borrowed culture either:
  no yin-yang, no torii, no real characters. Checked zoomed in, picture by picture.
  Found and removed so far: the compass arms (and a letter N) of a weathervane on the
  suburb's cupola, which read as a cross on a dome (`tools/art/paint-out.mjs`).
- **Key colours:** green eats a set's green things. The suburb, the farmland and the
  necropolis are keyed on magenta; the Lantern Cities and the Deep Hive on blue.
- **Which set a board is drawn with:** a campaign deployment, its territory's; a skirmish,
  one chosen by its seed; `?biome=megacity` in the address names one.

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

### Map units (rules 3, 12, 13, 15, 16 and 17)

**The spec is `assets/unit-spec.md`:** one entry for each of the 26 kinds in
`content/data.ts`, with what it does, what is drawn, its weapon, what its attack looks
like, the insect it borrows from, its size on the map, and every picture it needs beyond
walking and attacking. It is generated from `tools/art/units.mjs` by
`node tools/art/unit-spec.mjs`, which fails if the list and the game ever disagree.

| Sheet | Units |
|---|---|
| `units-v2-1-first-waves.png` | Responder, skitterlings, militia, soldier, splitter |
| `units-v2-2-army.png` | Elite, flier, drummer, stalker; the flier netted |
| `units-v2-3-siege.png` | Sapper, bomber, mortar beetle, siege cannon, shadewing; the cannon deployed |
| `units-v2-4-last.png` | Phalanx, carapace lord, tender, ghost sapper, tunneler; the carapace stripped; the tunneler burrowed |
| `units-v2-5-science.png` | Researcher, thief, infiltrator, sedation battery; the researcher carrying a limb; the battery deployed |
| `units-v2-6-royal.png` | The queen, consort, veil matron |

The sheets without `v2` in the name are the same units before the 21st-century kit
(spears, plain axes, candle lanterns).

How the job shows in the drawing: the drummer is a bell-ringer with a yoke of bronze bells
and loudspeakers; the bomber swings a smoking censer that is the bomb, wired, with a
blinking light; the carapace lord's shell is a gilded onion dome with a stub gun under the
rim; the phalanx carries a screen of painted panels whose saints are insects; the elite's
axe has a glowing edge fed from a power pack; the splitter is a porter with two hatchlings
in a pannier.

**War and royal castes dress Orthodox; the science caste does not** (rule 17): lab coats,
lanyards, goggles, tablets, dart pistols, hooded sweatshirts. No dome helmets, no robes.

**What attacking means in the game today** (checked in `src/sim/sim.ts`): an ordinary war
body attacks from 32 px, a little over one cell, and only what stands in the street in its
way, or the core. It walks past limbs up on the blocks. Only sappers, mortar beetles, siege
cannons, bombers and the science caste hurt limbs on blocks. So a short gun is the same
rule with a different picture, but soldiers shooting limbs beside the street as they pass
would be a change to the game (OPEN below).

#### Earlier tries (before the Orthodox dress)

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

- **Seen from behind** (rule 9): the back of his untidy hair, the stylus behind his ear, his
  pushed-up sleeves (`hero-behind-desk.png`, `hero-yoke-over-shoulder.png`). His face is for
  rare moments only.
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
| `r4-yoke-colour.png` | CHOSEN (rule 10). Long pale silver hair, amber eyes, soft colour, a gear hair clip, the Empire's black dress |
| `r4-yoke-austere.png` | Not chosen. Dark hair tied back, one colour of pale light, severe |
| `hero-yoke-over-shoulder.png` | The dialogue view: her facing us over the back of his shoulder |
| `r4-yoke-expressions.png` | Six expressions of the silver-haired design, for dialogue |
| `r4-yoke-in-room.png` | Talking with the character at the workstation |

**PROPOSAL, not yet Collins's:** the Empire's standard ship AI is text and a voice. The
projection is something the character installed himself. It is the biggest tell that he is
a nerd, and it explains why she looks like nothing else aboard.

## OPEN — Collins's calls

1. **Should ordinary soldiers shoot limbs beside the street as they pass?** Today they do not
   (see "What attacking means in the game today"). Rule 16 reads as if they do. It is a change
   to the game: every lane-side limb would take fire, so it has to be measured against the
   placement guardrail before it is kept.
2. **How much Orthodox on the buildings:** accents (`board-hive-a.png`) or generous
   (`board-hive-b.png`).
3. **The royal caste** is drawn in Orthodox dress. Rule 12 said "at least the warrior caste".
4. **Did he install the projection himself** (proposal above).
5. **"He makes, never buys"** as the rule for his things (proposal above).
6. **Are limbs cartoonish too?** Rule 2 likes the realistic limbs; rule 3 makes units
   cartoonish. Cartoon units beside realistic limbs has not been seen on one screen yet.
7. **The HUD.** It is khaki paper and stencil type today. It is the Empire's software, so
   it could follow the ship (black, white, exact, the gear) instead.
8. **War caste colour:** safety orange rather than orange-red, so war markings never read
   as your flesh. It is also the WAR meat counter in the HUD.

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
- Asked for Orthodox dress, it adds crosses by itself (see the rule at the top).
- Asked for "small human-like crew", it drew humans. Say "insect" every time.
- Asked for cartoon units inside a realistic scene, it made everything realistic. A style
  holds when the whole picture is in it; mixed styles have to be composited from parts.
- The character's face differs between pictures. A fixed face needs one approved portrait
  passed as a reference picture every time.
