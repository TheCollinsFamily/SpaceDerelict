# Broodfall style bible — v0 (Sep 29 2026), PROPOSAL until Collins locks it

The visual language of the game, and the prompt blocks every generated asset shares.
Concept pictures are in `notes/concepts/2026-09-29/`; the script is
`tools/art/concepts.mjs`. Pipeline and costs are in `notes/GRAPHICS-PLAN.md`.

## Collins's rules (his words; do not re-litigate)

1. "The thing that's important to remember with the insect design is that they need to
   have castes that are human enough for the player to empathise with them and for the
   political humour to land … they can have tank-like and mob-like castes but they also
   need human-like ones."
2. "Remember the 1950s horror B movie aesthetic."

## The look in one sentence

A 1950s colour creature feature about a red thing from a meteor eating a small town,
where the townspeople are insects in suits and aprons and you are the thing.

## Three makers, told apart at a glance

| | The Body (you) | The Colony (them) | The Empire (your employer) |
|---|---|---|---|
| What it is in a 1950s film | The monster: glossy gelatin, latex, bone | The town and its people: a miniature set, creature suits | The newsreel, the title cards, the pest-control ad |
| Material | Wet muscle, red jelly, dark chitin, ivory bone | Pale plaster, paper, wax; cloth; dark umber chitin | Print and interface only |
| Shape | Curves, swellings, no straight line | Small-town America: main street, diner, church, water tower, drive-in, picket fences | Ruled lines, right angles, type |
| Colour | Cool crimson, maroon, salmon, ivory | Pale and dusty, amber lamplight | Khaki, black ink, one stamp red |
| Surface | Glossy | Matte | Flat |

The Empire never appears on the planet as an object. It exists only as the HUD, labels,
stamps and forms laid over the picture.

## Light and dark (what makes the board readable)

Darkest to lightest:
1. Unclaimed town under smoke
2. Creep: dark maroon. The body's ground, never its highlight.
3. Insects: dark chitin, so they read on pale streets
4. Limbs: salmon and ivory, wet, so they read on dark creep
5. Streets: pale, and they stay pale under a thin film of creep

Checked in `board-paper-city.png` (works) against `board-clay-city.png` (a warm clay town
turns to mud against red flesh: dropped).

## The Colony's people: human-like, beast, machine

One species whose body changes with the job. The army runs from human-like to beast to
machine, and the beasts and machines have human-like crew, so nothing on the field is only
a monster.

| Kind of caste | What it looks like | Examples |
|---|---|---|
| Human-like | Upright, two legs, four arms with hands, big expressive eyes, antennae that work as eyebrows, 1950s clothes | Commuter, mother and child, scientist, first responder, militia volunteer, preacher, delegate, the Director, the queen |
| Beast | Animal, no clothes, moves in packs | Skitterlings, the swarm |
| Machine | A huge body that is a vehicle or a gun, with a small human-like crew | Shield-bearer with a driver; siege cannon with a crew of two, one covering his ears; flier in goggles and a scarf |

- Caste colour is a MARKING (armband, stripe, sash), never the body colour: war is safety
  orange, science teal, royal gold. Safety orange, not orange-red, so war never reads as
  your flesh.
- Each kind borrows from the real insect that does its verb: bombardier beetle for the
  cannon, pill bug for the shield wall, cicada for the drummer, stick insect for the
  cloaked stalker.
- At 24 px a helmet or a briefcase is a speck; the same design carries the close-ups.
- The three faction leaders are in `r2-faction-leaders.png`; the citizens in
  `r2-castes-human.png`; the army in `r2-army-spectrum.png`.

## The Body: one flesh, nine accents

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

## The 1950s B-movie look: what it is made of

- Saturated early colour film; hard theatrical light; deep black shadows
- Coloured light from off screen (toxic green, magenta); painted skies
- A town that feels like a studio miniature; monsters that feel like superb practical
  effects (gelatin, latex, creature suits, puppets)
- Film grain, soft old lenses
- Dripping title lettering; lobby cards; lurid painted posters
- The Empire's side of it: newsreel narration, cheerful pest-control advertising

**Sprites are the exception.** A sprite is lit evenly from overhead, with no coloured
light baked in: coloured rim light breaks the green-screen key and looks wrong when the
sprite is mirrored. The B-movie light comes from the filter and the board, not from each
sprite. The concept pictures are the target for the whole frame, not for one asset.

## The break moments

The design doc asks for "the same footage with the filter off". With the B-movie look as
the default, the break is a second, plain render of the same picture: documentary,
daylight, quiet (`break-doorway.png` is that register). Image edits keep a composition, so
a break moment is made by redrawing the B-movie frame as a photograph.

## OPEN — Collins's calls

1. **How visibly a model.** `r2-board-bmovie-lit.png` (real things, 1950s photography) and
   `r2-board-bmovie-miniature.png` (visibly a miniature set) came out close to each other.
   How far to push "you can tell it is a model"?
2. **Night or day.** The B-movie pictures all came out at night. The board must stay
   readable for an hour of play; this needs a test at game size before it is decided.
3. **Whose buildings.** The B-movie town came out as human small-town buildings. Round one
   was insect-made (paper, wax, hexagons). Human-looking lands the joke faster;
   insect-made is stranger.
4. **The Director's clothes.** Drawn as a modern slob (t-shirt, shorts, game controller)
   in a 1950s world. The alternative is a 1950s whiz kid (bow tie, slide rule).
5. **War caste colour** moving from orange-red to safety orange (it is also the WAR meat
   counter in the HUD).

## Prompt blocks (shared by every asset; from `tools/art/concepts.mjs`)

- **People:** "insect people like those of a 1950s science-fiction film: human posture and
  human body language, two legs, four arms with small hands, an insect head with large
  expressive eyes, small mandibles like a mouth and antennae that move like eyebrows, dark
  umber chitin and pale amber eyes instead of skin"
- **Town:** "a 1950s American small town built at insect scale by an insect civilisation
  out of pale wasp paper, wax and clay: a main street of flat-roofed shops, a diner, a
  church with a steeple, a water tower, a drive-in cinema screen, picket fences and tiny
  streetlamps glowing amber"
- **Body:** "salmon-pink wet muscle armoured with plates of dark chitin and ivory bone,
  glistening"; creep: "a living skin that is dark maroon, matte and veined, thick on the
  rooftops and only a thin translucent film on the streets"
- **Film:** "Lurid saturated Technicolor, hard theatrical key light with deep black
  shadows, toxic green and magenta rim light from coloured gels off screen, a painted
  backdrop sky, film grain, the slight softness of old lenses."
- Once pictures are approved, 2–3 of them go with every request as reference pictures.
  That holds a look better than any wording.

## What the two rounds showed

- The image model draws all of this without refusing, lettering included.
- It adds lettering nobody asked for (a shop sign reading "RIVERSIDE INSECTICIDE CO." in
  the key art). Pictures need checking for stray words.
- Four arms survive in portraits and mostly in line-ups.
