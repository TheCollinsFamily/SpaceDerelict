/**
 * THE TILE SETS: one per kind of place on the planet. Collins, Sep 29 2026: "build tile sets
 * for different environments … one that looks sort of american suburb inspired / one that
 * looks cyber punk mega city inspired / one that looks 'oriental', by that I mean not exactly
 * japanese or chinese but sort of the 1950s westernized view of the orient … and remember in
 * the architectural style of this species so not those directly … any other tile sets that
 * would be cool? if you can think of them make them."
 *
 * Every set is the SAME species building in its own way (wasp paper, wax, honeycomb cells,
 * ribbed arches, round doorways) and borrowing one look. A set is: three floors (street,
 * plaza, roof), four kinds of wall (one per kind of district in the game: plain, science,
 * meat, highground), what stands on its roofs and what stands in its streets.
 *
 * Streets are the palest thing in every set: dark units have to read on them.
 * No set carries a real religious symbol (assets/style-bible.md).
 *
 * on: which kinds of district a roof prop stands on. width: how many cells wide it is drawn.
 *
 * THE SECOND OF EVERYTHING. Collins, Sep 29 2026: "you need at least one rural tile set and
 * more assets for the others so they look less samey. With AI this is laughably cheap
 * compared to what it used to cost so let's take advantage of that." With one facade for
 * each kind of district and one roof, a board of forty blocks was the same building forty
 * times. So every set also has:
 *
 *   walls2       a second building for each kind of district   sprites wall-<kind>~1-...
 *   roofs        two more roofs                                 sprites roof~1-IJ, roof~2-IJ
 *   streets      one more street, where the first is busy       sprites street~1-IJ
 *   roofProps2   eight more things that stand on roofs          more prop-<id>
 *   streetProps2 six more things that stand in streets          more prop-<id>
 *   guests       other sets whose districts may be mixed into a board whose home is this set
 *
 * A second building is ANOTHER TRADE in ANOTHER COLOUR of the same place, with its doors and
 * windows laid out another way: at game size a wall is read by its colour and by the rhythm
 * of its openings, not by its details. A name of a prop is used once in a set.
 *
 * The pictures of a set are in art-src/terrain/<set>/. The first of each is <name>.png; the
 * later ones are <name>.1.png, <name>.2.png. (Not <name>~1.png, as the sprites are called:
 * Windows gives every long file name a short one of that shape, and street.orig.png, which
 * paint-out.mjs leaves behind, already answers to STREET~1.PNG.)
 *
 * OPEN COUNTRY (Collins, Sep 29 2026: "the rural biome is all farms, no grass fields, hills etc. It's all
 * barns and farms, this is bad ... those are fine for like 20% of it but not the majority"). In the two
 * rural sets (terraces, farmland) every kind of district has FIVE faces (walls, walls2, wallsMore), four
 * of them LAND ({ land: true, words }: a grassy bank, an outcrop, a hedge, a wooded slope) and one a farm
 * building; the game picks one face for each block, evenly, so four blocks in five are land. Their roofs
 * are grass, meadow, pasture, a copse and one field; what stands on them is mostly trees, stones, a pond.
 *
 * Two sets are open country, not town (terraces, wetland). They say what their walls, their
 * roofs and their streets ARE (front, band, species, place), because the words every other
 * set shares say "building", "storey" and "city".
 */
export const SPECIES =
  'It is built by an insect civilisation in its own way of building, never as a human building: walls of pale ' +
  'wasp paper and wax made of honeycomb cells, ribbed organic arches, round cell doorways and windows, layered ' +
  'paper shells. It is a city of the 21st century';
/** The same, said of things rather than of a building. */
export const SPECIES_THINGS =
  'Everything is made by an insect civilisation of the 21st century in its own materials and its own way: wasp ' +
  'paper, wax, resin and honeycomb cells, rounded and ribbed, never simply a human object';
export const NO_SYMBOLS =
  'No text and no lettering anywhere: any sign or screen shows only abstract glyphs. No crosses, no stars, no ' +
  'crescents, no yin-yang and no other religious symbol.';

const ALL = ['plain', 'science', 'meat', 'highground'];

export const BIOMES = [
  {
    // Made first, on Sep 29 2026, by tools/art/templates/terrain.mjs, which still makes and bakes the same
    // pictures as the pieces the game falls back to. Its first pictures here are copies of those
    // (art-src/terrain/*.png copied into art-src/terrain/orthodox/), and the words are the ones they were
    // drawn from, so that this set is a set like the others and has a second of everything too.
    id: 'orthodox', key: ['00FF00', 'green'], roofTint: [0xb9a783, 0xd0bd96, 0xe6d3aa], name: 'The Temple Cities',
    territories: ['temple', 'seventh-city', 'assembly'],
    guests: [],
    firstPictures: 'terrain',
    // Its props are cut out as the terrain entry cuts them, so that they are the same sprites Collins has seen.
    spill: 'all',
    look:
      'The style of this district borrows from Eastern Orthodox building, grown into their own: arcades of round arches, ' +
      'bands of gold and coloured mosaic pressed into the wax, gilded ribs, niches shaped like small onion domes. ' +
      'Pale cream, honey amber and gold, with blue only as small accents in the mosaic. It carries no crosses: ' +
      'its one emblem is a plain gold hexagon, and whatever ends in a point ends in a plain gold ball',
    street: 'The paving of a street in an insect city: pale cream tiles of wax and pressed paper laid in a loose honeycomb pattern, worn and a little dusty, with a few hairline cracks and faint wheel marks.',
    plaza: 'The paving of a town square in an insect city: pale cream tiles of wax and pressed paper laid in rings of hexagons, with thin inlaid lines of gold and coloured mosaic between the rings.',
    roof: 'The flat roof terrace of a building in an insect city: pale grey-cream wasp paper laid in overlapping bands with a faint honeycomb pattern pressed into it, weathered, with a few patched places.',
    roofs: [
      'A flat roof terrace paved with small tiles of baked clay the colour of pale honey, laid in a herringbone pattern, matte and a little dusty, with thin pale joints. Every tile is pale: no dark patches and no stains.',
      'A flat roof covered in sheets of old copper that have weathered to a pale, dull, chalky grey-green, joined by thin raised seams in a wide honeycomb, with a few small rivets. Muted colours, matte. The sheets fill the whole picture: there is no border, no frame and no trim.',
    ],
    walls: {
      plain: 'It is a block of flats. Ground storey: round-arched doorways lit amber, a letter box, an electricity meter. Upper storeys: small round-arched windows lit amber, little balconies with washing hung out, air-conditioning units and a satellite dish fixed to the wall, cables.',
      science: 'It is a research laboratory. Ground storey: glass doors in round arches, a security camera. Upper storeys: wide round-arched laboratory windows with brass frames, glowing screens seen inside, cable runs and cooling vents on the wall.',
      meat: 'It is a food warehouse. Ground storey: wide round-arched loading doors with roller shutters, crates stacked beside them. Upper storeys: small round-arched windows, ledges with rows of honey-pot jars, a hoist beam, ventilation fans.',
      highground: 'It is a temple. Ground storey: a tall arcade of round arches lit amber from within. Upper storeys: narrow round-arched windows, bronze bells hanging in niches, broad bands of rich gold and coloured mosaic, gilded ribs, small loudspeakers.',
    },
    walls2: {
      plain: 'It is a street of small shops with rooms above, and its walls are washed a warm terracotta rose with cream ribs. Ground storey: wide shop windows, each under a striped awning of dark red and cream, showing bread, cloth and tea urns; a glowing sign of abstract glyphs; a bicycle. Upper storeys: big rounded bay windows that swell out of the wall like paper lanterns, three to a storey, with flower pots and a caged songbird that is a cricket.',
      science: 'It is a library and observatory, and its walls are dark honey-brown resin with trim of pale green weathered copper. Ground storey: one great round door of copper in the middle, with a reading lamp on each side and a rack of bicycles. Upper storeys: very tall, narrow round-arched windows set close together like the pipes of an organ, showing shelves of scrolls and books lit by green-shaded lamps; one round window holding a brass telescope; a copper rain pipe.',
      meat: 'It is a covered market and bakery, and its walls are banded in rust-red and cream tiles like the layers of a cake. Ground storey: an open arcade of five wide low arches full of market stalls, baskets of loaves, hanging strings of dried fruit and big clay jars. Upper storeys: one row of large half-round windows like fans, a bread oven chimney of brass, a hoist with a basket, a painted panel of a wheat sheaf.',
      highground: 'It is the palace of the city elders, and its walls are painted a deep wine red with ribs of white and gold. Ground storey: a broad flight of steps to one tall round door of gilded bronze, with a guard lamp on each side and two rows of gilded columns shaped like beads. Upper storeys: tiers of pointed onion-shaped gables stacked like scales, each framing a small round window of amber glass; a long balcony with a gilded rail; a clock showing only glyphs; a plain gold hexagon. No crosses anywhere.',
    },
    // The mix of roof props Collins has seen and liked: kept exactly. The second sheet's are added to it.
    roofSets: {
      plain: ['aircon', 'dish', 'solar', 'tank', 'dome-paper', 'aircon', 'solar'],
      science: ['dish', 'mast', 'solar', 'dish', 'aircon', 'mast'],
      meat: ['tank', 'tank', 'aircon', 'solar', 'dome-paper'],
      highground: ['dome-gold', 'spire', 'dome-paper', 'dome-gold', 'spire'],
    },
    roofProps: [
      { id: 'dome-paper', width: 0.8, on: ['plain', 'meat', 'highground'], look: 'an onion dome made of layered pale wasp paper like a hanging nest, on a short round drum, ending in a plain gold ball' },
      { id: 'dome-gold', width: 0.85, on: ['highground'], look: 'the same kind of onion dome, gilded all over, on a short round drum with a band of mosaic, ending in a plain gold ball' },
      { id: 'spire', width: 0.6, on: ['highground'], look: 'a slender bell tower like a nest spire of pale wasp paper, with round-arched openings and one bronze bell inside, ending in a plain gold ball' },
      { id: 'dish', width: 0.5, on: ['plain', 'science'], look: 'a white satellite dish on a short steel mast' },
      { id: 'aircon', width: 0.45, on: ['plain', 'science', 'meat'], look: 'an air-conditioning unit: a grey metal box with one round fan grille' },
      { id: 'solar', width: 0.7, on: ['plain', 'science', 'meat'], look: 'a dark blue solar panel on a low tilted frame' },
      { id: 'mast', width: 0.35, on: ['science'], look: 'a tall thin radio mast with small antennas and one red lamp at the top' },
      { id: 'tank', width: 0.55, on: ['plain', 'meat'], look: 'a round water tank of pale resin on four short legs' },
    ],
    // Nothing green: this set is keyed on green.
    roofProps2: [
      { id: 'belfry', width: 0.6, on: ['highground', 'plain'], look: 'a low open belfry: four ribbed arches of pale wasp paper holding three bronze bells of different sizes, under a small gilded cap ending in a plain gold ball' },
      { id: 'cistern', width: 0.5, on: ['plain', 'meat'], look: 'a rain cistern: a squat round jar of amber glazed clay ringed with a band of coloured mosaic, with a brass tap' },
      { id: 'skylight', width: 0.6, on: ALL, look: 'a low round skylight: a shallow dome of honeycomb glass in a gilded frame, lit amber from below' },
      { id: 'loudspeakers', width: 0.35, on: ['highground', 'plain'], look: 'a short brass mast carrying four grey loudspeaker horns' },
      { id: 'washing', width: 0.7, on: ['plain'], look: 'a washing line between two posts, hung with white sheets and red and saffron cloths' },
      { id: 'telescope', width: 0.6, on: ['science'], look: 'a small observatory: a brass telescope on a tripod under a half-open dome of pale paper' },
      { id: 'jars', width: 0.55, on: ['meat'], look: 'a low rack holding a row of sealed honey-pot jars of amber glass' },
      { id: 'cowl', width: 0.4, on: ALL, look: 'a ventilation cowl of brass shaped like a small onion with louvres, ending in a plain gold ball' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a slender street lamp of brass with a glowing amber lantern' },
      { id: 'signal', width: 0.25, look: 'a traffic light on a brass post with three amber lamps' },
      { id: 'sign', width: 0.4, look: 'a glowing sign board on a post, showing one abstract glyph' },
      { id: 'car', width: 0.8, look: 'a small parked car shaped like a beetle, brass-coloured, with round headlamps' },
      { id: 'gate', width: 1.6, never: true, look: 'a wide round archway of pale wasp paper and gold mosaic, a city gate standing alone, open, with nothing behind it' },
      // The body's own: on the same sheet, cut out with the others, and left to the terrain entry.
      { id: 'pod', width: 0.5, shared: true, look: 'a spore pod: a small round sac of pale green flesh with a few short roots, glistening' },
    ],
    streetProps2: [
      { id: 'kiosk', width: 0.55, look: 'a small round newspaper kiosk of pale wasp paper with a little gilded onion roof ending in a plain gold ball, and a lit window' },
      { id: 'fountain', width: 0.45, look: 'a drinking fountain: a basin of pale stone with a band of mosaic and a brass spout' },
      { id: 'bench', width: 0.5, look: 'a bench of pale wax with a ribbed back and brass feet' },
      { id: 'van', width: 0.85, look: 'a small delivery van shaped like a beetle, cream with a gold stripe' },
      { id: 'scooter', width: 0.4, look: 'a parked motor scooter shaped like a wasp, brass and cream' },
      { id: 'postbox', width: 0.25, look: 'a pillar post box of dark red enamel with a domed brass top' },
    ],
  },
  {
    id: 'suburb', key: ['FF00FF', 'magenta'], roofTint: [0xc8c8c8, 0xe2e2e2, 0xffffff], name: 'The Suburbs',
    territories: ['crash-site', 'cul-de-sac', 'commuter'],
    look:
      'The style of this district borrows from an American suburb of the 1950s: pastel colours (mint, butter yellow, powder blue, ' +
      'salmon pink), bands of paper like clapboard, porches with slender columns, picket fences of white wax, ' +
      'striped awnings, flower boxes, garage doors',
    street: 'The paving of a suburban street: pale grey concrete slabs in a loose honeycomb pattern with thin dark tar lines between them, clean, a few hairline cracks and a fallen leaf or two.',
    plaza: 'A neighbourhood green: a neat lawn of short bright green moss, mown in rings, with a round bed of small flowers in the middle and a rim of pale paving.',
    // The first one had dark tar-paper patches: on a board that is mostly roofs they read as camouflage.
    roof: 'A flat roof of pale pastel shingles made of small overlapping paper scales, soft mint green with a few cream ones mixed in, clean, even and a little sun-bleached. Every shingle is pale: there are no patches, no dark shingles and no stains.',
    walls: {
      plain: 'It is a row of family homes. Ground storey: front doors with porches and slender columns, round picture windows with curtains, garage doors, letter boxes, flower boxes. Upper storeys: round windows with shutters and striped awnings, an air-conditioning unit, a television aerial cable.',
      science: 'It is a school. Ground storey: wide double doors, a notice board with abstract glyphs, a drinking fountain. Upper storeys: rows of big round classroom windows with paper cut-outs stuck to the glass, a bell, a clock showing only glyphs.',
      meat: 'It is a diner and a supermarket. Ground storey: big shop windows with striped awnings, a glowing sign of abstract glyphs, vending machines, stacked crates of produce. Upper storeys: a billboard of a smiling insect holding a milkshake, round windows, ventilation fans.',
      highground: 'It is a town hall. Ground storey: a porch of tall slender columns, wide steps, double doors lit amber. Upper storeys: tall round-arched windows, a clock showing only glyphs, bunting in pastel colours, a loudspeaker.',
    },
    roofProps: [
      { id: 'chimney', width: 0.4, on: ['plain', 'meat'], look: 'a short brick-like chimney of baked resin with a little paper cowl' },
      { id: 'aerial', width: 0.45, on: ['plain'], look: 'a 1950s television aerial on a thin mast' },
      { id: 'dish', width: 0.5, on: ['plain', 'science'], look: 'a small white satellite dish on a short mast' },
      { id: 'cooler', width: 0.45, on: ALL, look: 'a boxy mint-green air cooler with one round fan grille' },
      { id: 'deckchairs', width: 0.7, on: ['plain'], look: 'two striped deck chairs under a striped parasol, with a small barbecue' },
      { id: 'tank', width: 0.55, on: ['meat', 'science'], look: 'a round pastel water tower tank on four legs' },
      { id: 'cupola', width: 0.7, on: ['highground', 'science'], look: 'a small white cupola with a round louvred dome of paper and a weathervane shaped like a wasp' },
      { id: 'skylight', width: 0.6, on: ALL, look: 'a low domed skylight of honeycomb glass' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a slender suburban street lamp with a glowing amber globe' },
      { id: 'mailbox', width: 0.22, look: 'a pastel blue letter box on a post' },
      { id: 'hydrant', width: 0.2, look: 'a short red fire hydrant' },
      { id: 'car', width: 0.8, look: 'a parked family car shaped like a beetle, mint green with chrome trim and white-wall tyres' },
      { id: 'tree', width: 0.7, look: 'a garden tree that is a giant dandelion clock on a thick green stem' },
      { id: 'fence', width: 0.7, look: 'a short length of white picket fence made of wax, with a hedge behind it' },
    ],
    guests: ['terraces'],
    roofs: [
      'A flat roof of pale pastel shingles made of small overlapping paper scales, soft butter yellow with a few cream ones mixed in, clean, even and a little sun-bleached. Every shingle is pale: there are no patches, no dark shingles and no stains.',
      'A flat roof of fine pale gravel, light warm grey and cream, raked smooth and even, crossed by a few thin white strips of paper tape in a wide honeycomb. Everything is pale: there are no patches, no dark stones and no stains.',
    ],
    streets: [
      'The pavement of a quiet suburban street: smooth pale cream concrete poured in big plain squares with thin joints between them, clean and even, a little chalk dust and one or two fallen leaves. Pale everywhere.',
    ],
    walls2: {
      plain: 'It is a court of garden apartments, and its walls are butter yellow with white trim. Ground storey: a row of identical round front doors painted white, each with a door mat and a milk bottle, and between them big square carports holding a parked beetle car or a lawn mower. Upper storeys: an outdoor gallery runs the whole width of each storey behind a white railing of wax, with a row of round doors and small round windows behind it, folding chairs and pot plants.',
      science: 'It is a public library and a radio station, and its walls are powder blue with white trim. Ground storey: one wide revolving glass door in the middle under a flat canopy, a book return slot, a display window of model planets, a bicycle rack. Upper storeys: tall narrow round-topped windows set in pairs showing bookshelves and reading lamps; one big round studio window with a lit lamp above it; a radio aerial fixed to the wall.',
      meat: 'It is a petrol station and a drive-in burger bar, and its walls are white with bands of cherry red and chrome. Ground storey: two wide open service bays, one with a beetle car lifted on a ramp; two petrol pumps with round glass tops; a serving hatch with stools and a striped canopy. Upper storeys: one very large billboard of a smiling insect in a paper hat holding a burger, a giant clock showing only glyphs, a row of small porthole windows, a neon sign of abstract glyphs.',
      highground: 'It is a picture palace, a cinema, and its walls are salmon pink and mint green with chrome fins. Ground storey: a wide entrance under a big curved canopy edged with rows of small light bulbs, a round ticket booth of glass, poster frames showing insect film stars. Upper storeys: tall smooth fins running upward, a great fan-shaped window of honeycomb glass in the middle, a tall upright sign of abstract glyphs in neon.',
    },
    roofProps2: [
      { id: 'heater', width: 0.6, on: ['plain', 'science'], look: 'a solar water heater: a tilted dark panel with a white drum tank above it' },
      { id: 'washing', width: 0.6, on: ['plain'], look: 'a rotary washing line hung with pastel blue and yellow clothes' },
      { id: 'pool', width: 0.65, on: ['plain'], look: 'a small round paddling pool of pale blue water with a yellow inflatable ring in it' },
      { id: 'planter', width: 0.6, on: ALL, look: 'a long planter box of white wax holding a clipped green hedge and yellow tulip-like flowers' },
      { id: 'loft', width: 0.45, on: ['plain', 'highground'], look: 'a butterfly loft: a little white house on a post with round holes in it and a few pale blue butterflies resting on it' },
      { id: 'siren', width: 0.35, on: ['highground', 'science'], look: 'a civil defence siren: a yellow horn on a short mast' },
      { id: 'cone', width: 0.6, on: ['meat'], look: 'a rooftop shop sign: a giant ice-cream cone made of paper, vanilla yellow and mint green, on a short frame' },
      { id: 'greenhouse', width: 0.7, on: ['science', 'plain'], look: 'a small greenhouse of honeycomb glass with a white frame and trays of seedlings inside' },
    ],
    streetProps2: [
      { id: 'busstop', width: 0.7, look: 'a bus stop shelter of glass and white wax with a bench and a sign of abstract glyphs' },
      { id: 'phonebox', width: 0.3, look: 'a telephone box of glass and mint-green wax with a domed top' },
      { id: 'van', width: 0.85, look: 'an ice-cream van shaped like a beetle, white and butter yellow, with a serving window and a striped awning' },
      { id: 'bench', width: 0.5, look: 'a park bench of white wax with a litter bin beside it' },
      { id: 'trike', width: 0.3, look: 'a child\'s red tricycle and a toy wagon' },
      { id: 'bins', width: 0.35, look: 'two dustbins of ribbed silver metal with lids' },
    ],
  },
  {
    id: 'megacity', key: ['00FF00', 'green'], roofTint: [0xb8b8c0, 0xd6d6de, 0xffffff], name: 'The Megacity',
    territories: ['university', 'glass-spires', 'hidden-campus'],
    look:
      'The style of this district borrows from a cyberpunk megacity: dark walls of smoked resin and black glass laid over the ' +
      'honeycomb, neon signs and holograms of abstract glyphs in magenta and cyan, exposed cables and pipes, vents ' +
      'and steam, grime, tiny lit windows by the hundred',
    street: 'The paving of a megacity street at night after rain: wet pale grey concrete slabs in a loose honeycomb pattern, shallow puddles reflecting faint magenta and cyan light, a steel drain grate, a painted hazard chevron.',
    plaza: 'A transit plaza: pale grey concrete inlaid with thin lines of glowing cyan light in concentric hexagons, wet, with one round steel hatch in the middle.',
    roof: 'A flat megacity roof: dark tar and steel plates with patches of pale gravel, cable trays, and one painted hexagon landing mark in dull yellow.',
    walls: {
      plain: 'It is a stack of capsule apartments. Ground storey: a shuttered doorway, a noodle counter with steam, a vending machine, a neon glyph sign. Upper storeys: dozens of tiny round lit windows in the honeycomb, air-conditioning units, washing on lines, cables, a magenta neon glyph sign running up the wall.',
      science: 'It is a data centre and laboratory. Ground storey: an armoured glass door with a scanner, warning stripes. Upper storeys: long windows showing rows of server racks with blinking cyan lamps, cooling fins, thick bundles of cable, steam vents.',
      meat: 'It is a night market. Ground storey: food stalls under glowing paper lanterns and neon glyph signs, stacked crates, hanging produce, steam. Upper storeys: cold-store shutters, ventilation fans, a big glowing billboard of abstract glyphs.',
      highground: 'It is the foot of a corporate tower. Ground storey: a tall lobby of black glass and gold trim behind round arches, a guard post. Upper storeys: sheer black glass in a honeycomb frame, thin lines of gold light, one giant hologram glyph glowing cyan.',
    },
    roofProps: [
      { id: 'neon', width: 0.8, on: ['plain', 'meat'], look: 'a big neon sign of abstract glyphs on a steel frame, glowing magenta' },
      { id: 'array', width: 0.6, on: ['science', 'highground'], look: 'a cluster of antennas and small dishes on a steel mast with red lamps' },
      { id: 'hvac', width: 0.6, on: ALL, look: 'a large grey ventilation unit with two fans, leaking a little steam' },
      { id: 'tank', width: 0.55, on: ['plain', 'meat'], look: 'a dark round water tank on legs with a glowing cyan level gauge' },
      { id: 'holo', width: 0.6, on: ['highground', 'science'], look: 'a projector dish throwing up a glowing cyan hologram of an abstract glyph' },
      { id: 'billboard', width: 0.9, on: ['meat', 'plain'], look: 'a glowing billboard screen on stilts showing a stylised smiling insect face' },
      { id: 'pod', width: 0.5, on: ['plain'], look: 'a rooftop sleeping capsule with a round lit window and a ladder' },
      { id: 'beacon', width: 0.3, on: ['highground', 'science'], look: 'a thin mast with a bright red warning beacon on top' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a tall thin street lamp with a strip of cold white light and a camera' },
      { id: 'vending', width: 0.35, look: 'a glowing vending machine covered in abstract glyphs' },
      { id: 'sign', width: 0.4, look: 'a free-standing hologram sign of an abstract glyph, glowing magenta' },
      { id: 'car', width: 0.8, look: 'a sleek black taxi shaped like a beetle, with a glowing cyan strip along its side' },
      { id: 'barrier', width: 0.5, look: 'a striped police barrier with a flashing amber lamp' },
      { id: 'vent', width: 0.35, look: 'a street vent grille pouring out white steam' },
    ],
    guests: [],
    roofs: [
      'A flat megacity roof of pale grey gravel and cracked concrete, crossed by a few thin silver pipes and a strip of dull orange paint. Mostly pale, matte and dry.',
      'A flat megacity roof of rusty steel deck plates with a pattern of small raised studs, dull brown-orange and dark grey, with worn white stripes painted across one corner and a few bolts.',
    ],
    streets: [
      'The paving of a megacity street on a dry day: smooth pale grey asphalt, even and matte, with faint worn white dashes, a round steel manhole cover and a little litter. Pale and plain, with no puddles.',
    ],
    walls2: {
      plain: 'It is a block of workers\' dormitories over a gaming arcade, and its walls are rust-brown corroded resin panels lit by acid yellow and orange neon. Ground storey: the wide open front of a gaming arcade, a row of glowing game cabinets, a bead curtain, a ticket machine. Upper storeys: long open balconies run the whole width of each storey, crowded with washing, water drums, plant pots and folding chairs; behind them narrow round doors, each with a number plate of abstract glyphs; one tall sign of orange neon glyphs.',
      science: 'It is a robotics workshop and gene laboratory, and its walls are panels of white ceramic, grimy and streaked, with thin lines of green light. Ground storey: one wide workshop door rolled half up on a robot arm and sparks; a rack of gas bottles; a hand scanner. Upper storeys: three very large round windows to a storey, each showing a glass vat glowing pale green with something curled inside; bundles of white hose; a row of cooling fans.',
      meat: 'It is a vertical farm and a protein works, and its walls are dull steel lit from inside by violet grow lamps. Ground storey: two loading bays with refrigerated beetle trucks backed in, a wall of small food lockers with lit windows, stacked trays. Upper storeys: long unbroken bands of glass running the whole width, showing shelf upon shelf of pale fungus under violet light; fat silver ducts; a sign of a stylised mushroom in white neon.',
      highground: 'It is the exchange, where the city trades, and its walls are pale grey polished stone-like resin cut by thin lines of red light. Ground storey: a row of six tall narrow doors of smoked glass between heavy square piers, a red carpet, two guard drones. Upper storeys: one giant screen running the whole width, showing rising and falling bars and columns of abstract glyphs in red and amber; above it small square windows in a strict honeycomb grid; a thin mast of red lamps.',
    },
    // Nothing green: this set is keyed on green.
    roofProps2: [
      { id: 'drone', width: 0.6, on: ['science', 'highground'], look: 'a small round landing platform with a parked delivery drone shaped like a dragonfly' },
      { id: 'cooler', width: 0.6, on: ALL, look: 'a squat ribbed cooling drum of dark resin pouring white steam' },
      { id: 'shack', width: 0.7, on: ['plain'], look: 'a rooftop shack of corrugated sheet and blue tarpaulin with a lit round window and a small satellite dish' },
      { id: 'solar', width: 0.75, on: ALL, look: 'a bank of three dark blue solar panels on a tilted frame' },
      { id: 'ticker', width: 0.4, on: ['meat', 'plain'], look: 'a tall narrow screen on a mast showing a column of abstract glyphs, glowing amber' },
      { id: 'cradle', width: 0.7, on: ['highground'], look: 'a window-cleaning crane: a small jib on a trolley with a cradle hanging from it' },
      { id: 'stall', width: 0.65, on: ['meat', 'plain'], look: 'a rooftop noodle stall with a red awning, two stools and a steaming pot, lit by a paper lantern' },
      { id: 'searchlight', width: 0.4, on: ['highground', 'science'], look: 'a searchlight on a swivel mount, its lens glowing white' },
    ],
    streetProps2: [
      { id: 'kiosk', width: 0.55, look: 'a tiny street food kiosk with a roll-up shutter, a neon sign of abstract glyphs in orange, and a stool' },
      { id: 'bike', width: 0.5, look: 'a parked motorbike shaped like a wasp, black with magenta light strips' },
      { id: 'camera', width: 0.25, look: 'a surveillance post: a thin pole with three cameras and a blinking red lamp' },
      { id: 'bins', width: 0.5, look: 'three overflowing rubbish bins and a stack of wet cardboard boxes' },
      { id: 'terminal', width: 0.3, look: 'a public terminal: a slanted screen on a post, glowing cyan with abstract glyphs' },
      { id: 'police', width: 0.85, look: 'a small armoured police van shaped like a beetle, white and dark blue, with a light bar' },
    ],
  },
  {
    id: 'orient', key: ['0000FF', 'blue'], roofTint: [0xc4c4c4, 0xe0e0e0, 0xffffff], name: 'The Lantern Cities',
    // The Mirewater Delta was drawn with this set until it had one of its own (wetland).
    territories: ['pilgrim'],
    look:
      'The style of this district borrows from the Far East as a Western film of the 1950s imagined it, not from any real ' +
      'country: tiers of upswept eaves made of layered paper, lacquer-red columns, jade-green tiles, gold trim, ' +
      'round moon-gate doorways, paper lanterns glowing amber, latticed screens, long banners of abstract glyphs. ' +
      'Where a film would carve dragons, they have carved beetles and wasps',
    street: 'The paving of a lantern-lit street: pale sand-coloured stones in a loose honeycomb pattern with moss in the joints and a few fallen pink petals.',
    plaza: 'A temple courtyard: pale raked gravel in concentric rings round a few flat stepping stones, with a rim of pale stone.',
    // The first one was a bright green field in a red and gold frame: the frame repeated every two cells as a grid, and the green drowned the board.
    roof: 'A flat roof of old glazed tiles laid in small overlapping scales: a dark, dull, weathered jade green, matte, with a little grey lichen and a few tiles of darker green. Muted colours. The tiles fill the whole picture: there is no border, no frame and no trim.',
    walls: {
      plain: 'It is a row of teahouses and homes. Ground storey: round moon-gate doorways, latticed paper screens glowing amber, hanging paper lanterns, a bench. Upper storeys: a band of upswept paper eaves above each storey, latticed round windows, banners of abstract glyphs, an air-conditioning unit tucked under the eaves.',
      science: 'It is an apothecary and observatory. Ground storey: shelves of jars and drawers behind round windows, a brass scale, a glowing screen. Upper storeys: brass instruments on brackets, scroll racks, a telescope at a round window, cables.',
      meat: 'It is a market. Ground storey: stalls under red awnings and rows of paper lanterns, baskets of produce, hanging dried goods, steaming pots. Upper storeys: storerooms with round shuttered windows, rows of jars on ledges, a pulley.',
      highground: 'It is a great temple. Ground storey: tall lacquer-red columns, a moon-gate door trimmed in gold, a bronze incense urn. Upper storeys: tier above tier of upswept eaves with gold tips, carved beetles, rows of small hanging bells, loudspeakers hidden among them.',
    },
    roofProps: [
      { id: 'pagoda', width: 0.85, on: ['highground'], look: 'a small three-tiered pagoda turret with upswept jade-green eaves and a gold ball on top' },
      { id: 'lantern', width: 0.35, on: ALL, look: 'a tall red post hung with three glowing paper lanterns' },
      { id: 'gong', width: 0.55, on: ['highground', 'meat'], look: 'a big bronze gong hanging in a red lacquer frame' },
      { id: 'urn', width: 0.5, on: ['highground', 'plain'], look: 'a bronze incense urn on three legs with a thread of smoke' },
      { id: 'potted', width: 0.55, on: ['plain', 'science'], look: 'a twisted miniature tree that is really a fungus, in a glazed white pot' },
      { id: 'banner', width: 0.3, on: ['meat', 'plain'], look: 'a tall pole flying a long red banner of abstract glyphs' },
      { id: 'barrel', width: 0.5, on: ['meat', 'plain'], look: 'a big wooden water barrel with a bamboo-like pipe' },
      { id: 'dish', width: 0.5, on: ['science', 'plain'], look: 'a satellite dish painted red and gold on a short mast' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a stone lantern on a short pillar, glowing amber' },
      { id: 'cart', width: 0.75, look: 'a two-wheeled passenger cart with a red canopy, pulled by a small beetle' },
      { id: 'stall', width: 0.7, look: 'a market stall with a red awning, baskets and a steaming pot' },
      { id: 'statue', width: 0.45, look: 'a stone statue of a guardian beetle on a plinth' },
      { id: 'banner', width: 0.3, look: 'a pole flying a long banner of abstract glyphs' },
      { id: 'car', width: 0.8, look: 'a parked car shaped like a beetle, lacquer red with gold trim' },
    ],
    guests: ['terraces'],
    roofs: [
      'A flat roof of old unglazed clay tiles laid in long straight rows of half-pipes: a soft, dull charcoal grey with a little pale lichen and a few paler tiles. Muted colours, matte. The tiles fill the whole picture: there is no border, no frame and no trim.',
      'A flat roof of old glazed tiles laid in small overlapping scales: a dull, weathered golden yellow like old straw, matte, with a few tiles of pale brown and a little grey dust. Muted colours. The tiles fill the whole picture: there is no border, no frame and no trim.',
    ],
    streets: [
      'The paving of a quiet lane: long pale grey granite slabs laid in straight rows like bricks, swept clean, with thin joints of pale sand and one or two fallen leaves. Pale and plain.',
    ],
    walls2: {
      plain: 'It is an inn and bathhouse, and its walls are white paper plaster in a frame of dark brown timber. Ground storey: one wide entrance hung with a split curtain of plain indigo cloth, a row of wooden clogs, stacked wash tubs, a rickshaw. Upper storeys: a long balcony with a dark timber rail runs the whole width of each storey, with sliding paper screens behind it glowing pale, towels hung over the rail, a wisp of steam from a bamboo-like pipe; one band of upswept eaves of charcoal grey tiles.',
      science: 'It is a printing house and a school of clockmakers, and its walls are glazed tiles of pale jade green with brass trim. Ground storey: a row of four square workshop windows showing a printing press, racks of type that are abstract glyphs, and clock faces showing only glyphs; a narrow door. Upper storeys: a grid of many small square windows in brass frames, each lit white; sheets of printed paper hung out to dry on lines; a big brass clock showing only glyphs; cables and a small dish.',
      meat: 'It is a soy brewery and a tea warehouse, and its walls are black lacquer with thin gold lines. Ground storey: a row of enormous wooden vats bound with rope, each taller than the door, with ladders; stacked tea chests stamped with abstract glyphs; a hand cart. Upper storeys: wide open lofts with no windows, only posts, where rows of flat round baskets of tea leaves are laid out to dry; pulleys and ropes; a gold banner with a painted beetle.',
      highground: 'It is an opera house, and its walls are vermilion red and imperial yellow with gold. Ground storey: a broad stair to three great round doors side by side, each a gold lattice; two big drums on stands; rows of red lanterns. Upper storeys: a wide open stage balcony hung with a curtain of embroidered moths and wasps; giant painted opera masks of insect faces in white, red and black; tier above tier of upswept eaves of yellow tiles with gold tips.',
    },
    // Nothing blue: this set is keyed on blue.
    roofProps2: [
      { id: 'drum', width: 0.55, on: ['highground', 'meat'], look: 'a great drum with a red body and a pale skin on a lacquer stand, with two beaters' },
      { id: 'rocks', width: 0.6, on: ['plain', 'science'], look: 'a little rock garden in a shallow tray: three standing stones, green moss and raked pale sand' },
      { id: 'kites', width: 0.5, on: ['plain'], look: 'a rack of paper kites shaped like moths and dragonflies, red, yellow and white' },
      { id: 'armillary', width: 0.45, on: ['science', 'highground'], look: 'a brass sphere of rings for measuring the sky, on a carved stone pillar' },
      { id: 'jars', width: 0.55, on: ['meat'], look: 'three great brown glazed jars with paper lids tied down with cord' },
      { id: 'pavilion', width: 0.8, on: ['plain', 'highground'], look: 'a small open tea pavilion: four red posts, a roof of upswept eaves in yellow tiles, a low table and cushions' },
      { id: 'silks', width: 0.65, on: ['plain', 'meat'], look: 'a rack of poles hung with long dyed silk cloths in red, saffron and jade green' },
      { id: 'aircon', width: 0.45, on: ALL, look: 'an air-conditioning unit hidden in a red lacquer box with a gold lattice front' },
    ],
    streetProps2: [
      { id: 'well', width: 0.5, look: 'a round stone well with a little roof of jade-green tiles and a bucket' },
      { id: 'bicycle', width: 0.45, look: 'a delivery bicycle carrying a tall stack of steaming round baskets' },
      { id: 'lanterns', width: 0.5, look: 'a seller\'s rack of paper lanterns, red and gold, all glowing' },
      { id: 'tree', width: 0.7, look: 'a blossoming tree that is really a giant coral fungus, white and pale pink, growing in a ring of stones' },
      { id: 'truck', width: 0.75, look: 'a small three-wheeled delivery truck shaped like a beetle, jade green with a canvas back' },
      { id: 'teacart', width: 0.5, look: 'a tea seller\'s cart: a big brass urn on two wheels with a row of cups' },
    ],
  },
  {
    id: 'industrial', key: ['00FF00', 'green'], roofTint: [0xc0c0c0, 0xdedede, 0xffffff], name: 'The Works',
    territories: ['harbor', 'foundry'],
    look:
      'The style of this district borrows from a port and factory town: soot-darkened blocks of baked resin like brick, riveted ' +
      'iron, pipes, gantries, corrugated paper sheds, roller doors, hazard stripes, furnace light',
    street: 'The floor of a works yard: pale worn concrete slabs in a loose honeycomb pattern with oil stains, tyre marks and a little rust.',
    plaza: 'A loading yard: pale concrete with hexagon bay markings painted in worn yellow and a round iron drain in the middle.',
    roof: 'A flat factory roof: rust-red corrugated sheets and black tar in bands, with a few square panes of wired glass.',
    walls: {
      plain: 'It is a block of workers\' tenements. Ground storey: narrow round doorways, a row of bicycles, a lit canteen window. Upper storeys: rows of small round windows, soot stains, drain pipes, washing, an iron fire escape.',
      science: 'It is a refinery control house. Ground storey: a steel door, pressure gauges, valve wheels. Upper storeys: round windows showing control panels with glowing dials, fat pipes wrapped in lagging, a tank with a level gauge.',
      meat: 'It is a warehouse and cold store. Ground storey: wide roller doors half open on stacked crates, a loading dock, a fork-lift. Upper storeys: hoist beams with hooks, small barred windows, a painted stripe of hazard yellow.',
      highground: 'It is a foundry. Ground storey: huge round arches glowing orange with furnace light, sparks. Upper storeys: tall grimy round-arched windows lit orange from within, riveted iron bands, the feet of three chimneys.',
    },
    roofProps: [
      { id: 'stack', width: 0.5, on: ['highground', 'meat'], look: 'a tall smokestack of riveted iron with a red band, trailing thin smoke' },
      { id: 'crane', width: 0.9, on: ['meat', 'highground'], look: 'a small yellow jib crane with a hook' },
      { id: 'tank', width: 0.6, on: ['science', 'meat'], look: 'a rusty round storage tank with a ladder and a gauge' },
      { id: 'vent', width: 0.45, on: ALL, look: 'a fat ventilation cowl that turns in the wind' },
      { id: 'skylight', width: 0.7, on: ALL, look: 'a long ridge skylight of wired glass in an iron frame, lit from below' },
      { id: 'pipes', width: 0.8, on: ['science', 'highground'], look: 'a rack of fat pipes with valve wheels' },
      { id: 'siren', width: 0.35, on: ['plain', 'science'], look: 'a works siren on a short mast' },
      { id: 'crates', width: 0.6, on: ['meat', 'plain'], look: 'a stack of crates under a tarpaulin' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a plain iron lamp post with a caged lamp' },
      { id: 'forklift', width: 0.6, look: 'a small yellow fork-lift shaped like a beetle' },
      { id: 'crates', width: 0.55, look: 'a stack of three crates with hazard labels of abstract glyphs' },
      { id: 'barrel', width: 0.3, look: 'two oil drums, one rusty' },
      { id: 'bollard', width: 0.5, look: 'two iron bollards joined by a chain' },
      { id: 'car', width: 0.8, look: 'a parked delivery truck shaped like a beetle, grimy blue' },
    ],
    guests: [],
    roofs: [
      'A flat factory roof of galvanised sheets: dull silver-grey corrugated metal laid in wide panels, with pale streaks of rust running from the rows of bolts and a little soot.',
      'A flat factory roof of pale grey concrete slabs sealed with thin black lines of tar in a wide honeycomb, dusty, with a scatter of pale gravel and one small round drain.',
    ],
    streets: [
      'The paving of a quayside: small pale granite setts laid in overlapping fans, worn smooth, light grey with a little pale sand in the joints and a faint dusting of coal. Pale everywhere.',
    ],
    walls2: {
      plain: 'It is a seamen\'s hostel over a public house, and its walls are corrugated sheet painted a faded pale green over a base of dark tarred boards. Ground storey: the wide bright windows of a bar, lit warm yellow, with frosted glass and a swinging door; a row of barrels; a hanging sign of a painted beetle. Upper storeys: outside stairs of iron zigzag across the whole front from landing to landing, with a plain door on each landing; porthole windows; boots and oilskins hung to dry.',
      science: 'It is a power station, and its walls are white glazed tiles, grimy, with a band of dark blue tiles. Ground storey: a tall steel door with a lightning-proof grille, a row of big grey transformers with white ribbed insulators behind a railing, warning boards of abstract glyphs with black and yellow stripes. Upper storeys: three enormous tall windows of small square panes running up through both storeys, showing the great round turbines inside lit cold white; thick black cables leaving the wall on brackets.',
      meat: 'It is a fish cannery and smokehouse, and its walls are boards painted a weathered sea blue with white trim. Ground storey: a long open landing bench under a canopy, heaped with crates of silver fish on ice; hoses, a weighing scale, stacks of bright tins. Upper storeys: rows of slatted smokehouse louvres leaking thin smoke, a conveyor in a slanting covered bridge, nets hung to dry, a painted fish of silver.',
      highground: 'It is the harbour master\'s office and customs house, and its walls are dark red blocks of baked resin with trim of pale sandstone colour. Ground storey: a heavy round archway with iron gates for wagons in the middle, a barrier and a guard\'s window beside it, brass plates of abstract glyphs. Upper storeys: a row of tall round-arched windows with pale surrounds; a great round clock showing only glyphs; a balcony with a brass telescope; a row of plain coloured signal pennants on a line.',
    },
    // Nothing green: this set is keyed on green.
    roofProps2: [
      { id: 'hopper', width: 0.75, on: ['meat', 'highground'], look: 'a loading hopper: a rusty steel funnel on legs with a short conveyor belt' },
      { id: 'transformer', width: 0.55, on: ['science', 'plain'], look: 'a transformer: a grey finned box with three white ribbed insulators and a black and yellow stripe' },
      { id: 'cooler', width: 0.6, on: ['science', 'highground'], look: 'a small cooling tower of riveted plates, waisted like an hourglass, pouring white steam' },
      { id: 'floodlight', width: 0.35, on: ALL, look: 'a floodlight mast with four lamps' },
      { id: 'cylinders', width: 0.45, on: ['science', 'meat'], look: 'a wire cage of gas cylinders, red and grey' },
      { id: 'cabin', width: 0.6, on: ['plain', 'meat'], look: 'a watchman\'s cabin of corrugated sheet with a lit round window and a stove pipe' },
      { id: 'winch', width: 0.55, on: ['meat', 'highground'], look: 'a big cable drum and winch, rusty, wound with steel rope' },
      { id: 'emblem', width: 0.6, on: ['highground', 'plain'], look: 'a rooftop works emblem: a big plain hexagon of riveted iron on a frame, painted hazard yellow' },
    ],
    streetProps2: [
      { id: 'mobilecrane', width: 0.85, look: 'a small mobile crane shaped like a beetle, yellow, with its jib folded down' },
      { id: 'skip', width: 0.6, look: 'a rusty skip full of scrap metal' },
      { id: 'pallets', width: 0.5, look: 'a stack of wooden pallets with a hand pallet truck' },
      { id: 'hosereel', width: 0.3, look: 'a fire point: a red hose reel on a post with a bucket of sand' },
      { id: 'barrier', width: 0.5, look: 'a striped barrier with two orange traffic cones' },
      { id: 'buoy', width: 0.45, look: 'a big red harbour buoy stood on the quay, with a lamp on top' },
    ],
  },
  {
    id: 'farmland', key: ['FF00FF', 'magenta'], roofTint: [0xc4c0b4, 0xe0dccf, 0xffffff], name: 'The Granary Belt',
    // The farming TOWN. It has no territory of its own since the open country round it has a set (terraces),
    // which is the home of the Granary Belt: this one is met as a guest there, and in a skirmish.
    territories: [],
    // Open prairie country round the farms (Collins, Sep 29 2026: "the rural biome is all farms, no grass fields, hills
    // etc. ... those are fine for like 20% of it but not the majority"): four of the five faces of every kind of
    // district are LAND (walls with land: true), one is the farm building it always had.
    land: 'rolling prairie country of an insect people: grassy hillsides, sod banks, fence rows and woodland edges, ' +
      'in the colours of prairie: straw gold, sage green, tan earth, pale limestone. It is the countryside of a civilisation of the 21st century',
    look:
      'The style of this district borrows from a farming town of the American Midwest: barns of red-stained paper boards with ' +
      'white trim, round silos, windmills, grain elevators, hay, split-rail fences',
    street: 'A farm road: pale packed earth with scattered straw, a few pebbles and faint hoof-like prints.',
    plaza: 'A round threshing floor of pale packed earth ringed with golden straw, swept in circles.',
    // The first was a roof of thatch; now that four faces in five are land, every roof is land too (a field, grass, a wood).
    roof: "A field of ripe wheat seen from straight above: dense golden grain heads in even rows, soft and matte, with a few paler straws. Muted gold, nothing bright and nothing dark.",
    walls: {
      plain: 'It is a row of farmhouses. Ground storey: porches with rocking chairs, round doors, milk churns, a boot scraper. Upper storeys: round windows with gingham curtains, a hay loft door with a pulley, drying bunches of herbs.',
      science: 'It is an agricultural station. Ground storey: a glass door, seed trays, a weather screen. Upper storeys: round greenhouse panes with seedlings under lamps, rain gauges, a small dish, charts of abstract glyphs.',
      meat: 'It is a great barn and larder. Ground storey: big double barn doors braced with white battens in a honeycomb pattern, sacks of grain, hanging cured goods. Upper storeys: a hay loft spilling straw, round ventilation louvres, a hoist.',
      highground: 'It is a grain elevator. Ground storey: a weighbridge and wide doors. Upper storeys: tall plain walls of red-stained boards with white trim, chutes, a painted emblem of a plain gold hexagon, a small bell under a little roof.',
    },
    roofProps: [
      { id: 'silo', width: 0.7, on: ['highground'], look: 'the domed top of a round grain silo, silver, with a ladder' },
      { id: 'windmill', width: 0.7, on: ['science'], look: 'a farm wind pump with a many-bladed wheel on a lattice tower' },
      { id: 'tank', width: 0.55, on: ['meat'], look: 'a wooden water tank on legs' },
      { id: 'hay', width: 0.6, on: ['meat'], look: 'a stack of golden hay bales' },
      { id: 'vane', width: 0.3, on: ['highground'], look: 'a weathervane shaped like a beetle on a short post' },
      { id: 'hutch', width: 0.55, on: ['plain'], look: 'a little hutch with a run, holding a few fat green aphids' },
      { id: 'chimney', width: 0.4, on: ['plain'], look: 'a stone-like chimney with a wisp of smoke' },
      { id: 'solar', width: 0.7, on: ['science'], look: 'a dark blue solar panel on a low tilted frame' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a lantern hanging from a wooden post' },
      { id: 'tractor', width: 0.8, look: 'a red tractor shaped like a beetle with big rear wheels' },
      { id: 'hay', width: 0.5, look: 'two golden hay bales' },
      { id: 'fence', width: 0.7, look: 'a short length of split-rail fence with tall grass' },
      // Drawn, and kept off the board: a figure with its arms out on a pole reads as a crucifix at game size (assets/style-bible.md).
      { id: 'scarecrow', width: 0.4, never: true, look: 'a scarecrow that is an insect made of straw in a hat and coat' },
      { id: 'trough', width: 0.5, look: 'a wooden water trough with a hand pump' },
    ],
    guests: ['terraces'],
    roofs: [
      "Tall prairie grass seen from straight above: long soft grass of straw gold and sage green, swirled by the wind, with purple and yellow wildflowers. No paths and no bare earth.",
      "A wildflower meadow seen from straight above: short green grass thick with small purple, yellow, white and orange flowers. No paths and no bare earth.",
      "A cattle pasture seen from straight above: short cropped green grass with darker tussocks and a few pale stones, and one worn path of pale bare earth crossing it from one edge of the picture to the other.",
      "A small wood seen from straight above: the round caps of a grove of fungus trees in rust, gold and tan, touching and overlapping, with glimpses of mossy ground between them. Muted colours.",
    ],
    walls2: {
      plain: { land: true, words: "A prairie hillside: three steps of rolling grassland, long straw-gold and sage-green grass bending in the wind, purple coneflowers and yellow blanket flowers. Nothing built at all." },
      science: { land: true, words: "A limestone bluff: three steps of pale cream limestone in flat layers, weathered and cracked, with tough grass and small cedar-like bushes that are really fungi on the ledges. Nothing built at all." },
      meat: { land: true, words: "A sod bank with a fence row: three steps of dark earth held by thick grass roots; along the top of each step a row of weathered fence posts with a single rail, wild plum bushes in white flower along it. Nothing built at all." },
      highground: { land: true, words: "A woodland edge: three steps of mossy earth under tall trees that are giant fungi with broad rounded caps of tan and rust, their pale stems rising the full height, brambles and ferns between them. Nothing built at all." },
    },
    wallsMore: {
      plain: [
        { land: true, words: "A creek bank: three steps of tan earth and rounded river stones, willows that are really fungi with long hanging pale threads, a thin creek running along the foot. Nothing built at all." },
        { land: true, words: "A windbreak of shrubs: three steps of grassy earth topped by a thick row of dark green shrubs and small fungus trees planted in a line. Nothing built at all." },
        { land: true, words: "A grassy bank with a storm cellar: three steps of thick green grass; low in the bottom step, one slanting double door of weathered planks set into the bank. The rest is grass and earth." },
      ],
      science: [
        { land: true, words: "A washed-out bank of red clay: three steps of rust-red and ochre clay in layers, cut by small gullies, with clumps of grass on the ledges. Nothing built at all." },
        { land: true, words: "A hillside of tall bluestem grass: three steps of tall grass in blue-green, copper and gold, a few pale boulders showing through. Nothing built at all." },
        { land: true, words: "A bank of sunflowers: three steps of earth each topped by a thick row of tall sunflowers with big yellow heads. Nothing built at all." },
      ],
      meat: [
        { land: true, words: "A pasture bank: three steps of short grazed green grass with a worn cattle path slanting across them and a few pale stones. Nothing built at all." },
        { land: true, words: "A hedge of osage trees: three steps of earth under a thick tangled hedge of thorny trees that are really fungi, with round green fruits fallen in the grass. Nothing built at all." },
        { land: true, words: "A hay bank: three steps of cut hay meadow, golden, with round bales of hay lying on the ledges. Nothing built at all." },
      ],
      highground: [
        { land: true, words: "A high butte: three steps of banded tan and cream rock, sheer and weathered, with a cap of green grass and a few twisted bushes on top. Nothing built at all." },
        { land: true, words: "A wooded hill: three steps of earth under a dense grove of tall fungus trees with caps of rust, gold and tan like an autumn wood, fallen caps in the grass. Nothing built at all." },
        { land: true, words: "A hillside of wildflowers: three steps of grass thick with purple, yellow, white and orange wildflowers, a lone fungus tree on the top step. Nothing built at all." },
      ],
    },
    roofProps2: [
      // Open country (Collins): mostly the land's own.
      { id: 'oak', width: 0.8, on: ALL, look: 'a big spreading tree that is really a giant fungus: a thick gnarled pale stem and a wide rounded cap of rust and tan' },
      { id: 'clock', width: 0.6, on: ALL, look: 'a tree that is a giant dandelion clock: a tall green stem and a round white seed head' },
      { id: 'boulders', width: 0.6, on: ALL, look: 'three big pale limestone boulders with a tuft of grass between them' },
      { id: 'bush', width: 0.55, on: ALL, look: 'a round wild plum bush in white flower' },
      { id: 'pond', width: 0.75, on: ALL, look: 'a small round stock pond with reeds and a muddy edge' },
      { id: 'log', width: 0.7, on: ALL, look: 'a fallen log of a fungus tree, weathered grey, with small mushrooms on it' },
      { id: 'cairn', width: 0.4, on: ALL, look: 'a cairn: a tall pile of flat pale stones' },
      { id: 'bale', width: 0.5, on: ALL, look: 'a round bale of golden hay lying on its side' },
    ],
    streetProps2: [
      { id: 'gate', width: 0.7, look: 'a field gate of five bars between two stone posts, standing half open' },
      { id: 'stile', width: 0.45, look: 'a wooden stile: two steps over a low stretch of dry-stone wall' },
      { id: 'tufts', width: 0.45, look: 'a clump of tall wild grass tufts with a few white and yellow flowers' },
      { id: 'bramble', width: 0.55, look: 'a low bramble bush with dark berries' },
      { id: 'rocks', width: 0.45, look: 'three mossy stones at the side of a track' },
      { id: 'stump', width: 0.4, look: 'the stump of a fungus tree with a ring of small mushrooms round it' },
    ],
  },
  {
    id: 'necropolis', key: ['FF00FF', 'magenta'], roofTint: [0xbcbcc4, 0xdadae0, 0xffffff], name: 'The Ossuary Coast',
    territories: ['ossuary'],
    look:
      'The style of this district borrows from a city of the dead: bone-white walls of chalk and pale wax, niches holding urns, ' +
      'carved reliefs of insects, candles by the hundred, dark slender fungus trees, black iron. The tombs carry ' +
      'no crosses: their one emblem is a plain gold hexagon',
    street: 'The paving of a street of tombs: bone-white flagstones in a loose honeycomb pattern, worn smooth, with drifts of pale grey ash in the joints.',
    plaza: 'A round court of white marble inlaid with concentric hexagons in grey and a little gold.',
    roof: 'A flat roof of pale grey stone slabs with patches of lichen and a few fallen dark needles.',
    walls: {
      plain: 'It is a wall of burial niches. Ground storey: round niches closed by small doors of black iron, candles burning on ledges, withered flowers. Upper storeys: row on row of round niches holding urns, some with a small lit lamp, carved bands of marching insects.',
      science: 'It is an embalmers\' workshop. Ground storey: a plain door, stone tables seen through a round window, shelves of jars. Upper storeys: shuttered round windows, racks of tools, a fume pipe, a small electric lamp.',
      meat: 'It is a hall of offerings. Ground storey: round arches piled with flowers, fruit and baskets, tall candles. Upper storeys: niches with bowls of food, garlands hanging between the windows.',
      highground: 'It is a royal tomb. Ground storey: tall doors of black iron trimmed in gold between white columns, two statues of robed queens who are insects. Upper storeys: a carved frieze of a royal procession of insects, gold hexagons, round windows of amber glass.',
    },
    roofProps: [
      { id: 'obelisk', width: 0.4, on: ['highground', 'plain'], look: 'a slender white obelisk with a gold tip' },
      { id: 'urn', width: 0.45, on: ALL, look: 'a great stone urn draped in cloth' },
      { id: 'statue', width: 0.5, on: ['highground'], look: 'a white statue of a robed insect queen with her head bowed' },
      { id: 'candles', width: 0.5, on: ['plain', 'meat'], look: 'a cluster of tall candles of different heights, all lit' },
      { id: 'cypress', width: 0.45, on: ALL, look: 'a tall dark slender tree that is really a fungus' },
      { id: 'tomb', width: 0.8, on: ['highground', 'plain'], look: 'a small domed tomb of white stone with a black iron door' },
      { id: 'brazier', width: 0.45, on: ['meat', 'highground'], look: 'an iron brazier with a low fire' },
      { id: 'lamp', width: 0.35, on: ['science', 'plain'], look: 'an electric lamp on an iron bracket' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a black iron lamp post with a single candle lantern' },
      { id: 'hearse', width: 0.8, look: 'a black hearse shaped like a beetle with glass sides and silver trim' },
      { id: 'wreath', width: 0.4, look: 'a wreath of pale flowers on a stand' },
      { id: 'urn', width: 0.4, look: 'a stone urn on a plinth' },
      { id: 'railing', width: 0.7, look: 'a short length of black iron railing' },
      { id: 'statue', width: 0.45, look: 'a small white statue of a mourning insect' },
    ],
    guests: [],
    roofs: [
      'A flat roof of slates laid in small overlapping scales: a soft, dull blue-grey, matte, with a little pale lichen and a few paler slates. Muted colours. The slates fill the whole picture: there is no border, no frame and no trim.',
      'A flat roof of white marble slabs with faint grey veins, laid in a wide honeycomb with hairline joints, matte and a little dusty, with a few fallen dark needles.',
    ],
    streets: [
      'A path through a city of tombs: fine pale ash-grey gravel raked smooth, almost white, with faint rake lines, a few small pale pebbles and one or two fallen dark needles. Pale and plain.',
    ],
    walls2: {
      plain: 'It is a row of family tombs, and its walls are pale blue-grey stone with gates of black iron. Ground storey: a row of five small temple-like fronts side by side, each with its own pair of stubby columns and its own narrow gate of black iron bars, a lamp burning behind each gate, a stone bench. Upper storeys: a blank wall of large smooth stone blocks with only one row of small round windows high up in each storey, carved wreaths between them, trails of dark ivy-like fungus. No crosses anywhere.',
      science: 'It is the registry and archive of the dead, and its walls are dark polished wood and brass set in pale stone. Ground storey: a reading room seen through one long low window: desks with green-shaded lamps, a card index, a ladder on a rail; a narrow door. Upper storeys: the whole wall is a grid of hundreds of small square drawers with brass handles and brass label frames showing abstract glyphs, with two sliding ladders across it and a few drawers standing open.',
      meat: 'It is a candle works and flower market, and its walls are pale chalk stained warm cream by smoke. Ground storey: three wide arches; in them steaming vats of pale wax, buckets of white and pale yellow flowers, baskets. Upper storeys: long open racks run the whole width of each storey, hung with hundreds of new candles in rows like fringes, white, cream and honey-coloured; bundles of wick; one lit lantern.',
      highground: 'It is the hall of ancestors, and its walls are polished black stone inlaid with gold. Ground storey: one enormous round door of gold honeycomb in the middle, between two tall statues of robed insect queens in black stone; two burning bronze bowls. Upper storeys: rows of large gold masks of insect faces, each in its own round niche, six to a storey; thin gold lines; a row of plain gold hexagons. No crosses anywhere.',
    },
    roofProps2: [
      { id: 'bell', width: 0.5, on: ['highground', 'plain'], look: 'a mourning bell of dark bronze hanging in a frame of black iron' },
      { id: 'sarcophagus', width: 0.75, on: ['highground', 'plain'], look: 'a stone sarcophagus whose carved lid shows a sleeping insect with folded arms' },
      { id: 'vase', width: 0.4, on: ALL, look: 'a big stone vase of pale dried flowers and grasses' },
      { id: 'column', width: 0.4, on: ALL, look: 'a broken column of white stone wound with a garland of pale flowers' },
      { id: 'lantern', width: 0.45, on: ['science', 'plain'], look: 'a lantern turret: a slender round turret of white stone with a lamp lit inside its pierced top, ending in a plain gold ball' },
      { id: 'offerings', width: 0.6, on: ['meat'], look: 'a stone offering table with bowls of fruit and bread and two lit candles' },
      { id: 'sundial', width: 0.4, on: ['science', 'highground'], look: 'a sundial on a stone pedestal' },
      { id: 'willow', width: 0.6, on: ALL, look: 'a weeping tree that is really a fungus: a drooping crown of long pale grey threads on a dark trunk' },
    ],
    streetProps2: [
      { id: 'bench', width: 0.5, look: 'a stone bench with carved ends shaped like beetles' },
      { id: 'cart', width: 0.6, look: 'a flower seller\'s hand cart heaped with white flowers and candles' },
      { id: 'stele', width: 0.35, look: 'a standing stone slab with a rounded top, carved with rows of abstract glyphs' },
      { id: 'bier', width: 0.6, look: 'an empty bier: a low stand draped in black cloth with a gold fringe' },
      { id: 'candlestand', width: 0.4, look: 'a stand of black iron holding tiers of small lit candles' },
      { id: 'fountain', width: 0.5, look: 'a small fountain: a bowl of white stone held up by three carved beetles' },
    ],
  },
  {
    id: 'deephive', key: ['0000FF', 'blue'], roofTint: [0xc4bca8, 0xe0d8c4, 0xffffff], name: 'The Deep Hive',
    territories: ['queens-hollow'],
    look:
      'This district borrows from nothing: it is the oldest part of their civilisation, a hive grown rather than built. ' +
      'Great combs of amber wax and dark propolis, brood cells capped with pale wax, royal jelly glowing gold in ' +
      'open cells, ribbed tunnels, everything rounded. Modern things are fitted into it here and there: electric ' +
      'lamps, cables, guard posts',
    street: 'The floor of a hive gallery: pale wax worn smooth by feet, with the faint outline of hexagonal cells showing under it.',
    plaza: 'A royal court: a floor of pale polished wax inlaid with rings of amber cells that glow faintly gold.',
    roof: 'The top of a great comb: capped brood cells of pale wax in a perfect honeycomb, a few of them open and glowing amber.',
    walls: {
      plain: 'It is brood comb. Ground storey: round tunnel mouths lit amber, a guard post. Upper storeys: a perfect honeycomb of cells capped with pale wax, a few open and lit from inside, thin cables and small electric lamps.',
      science: 'It is a nursery. Ground storey: a round door, a row of glass incubators under warm lamps. Upper storeys: open cells holding pale grubs wrapped in silk, nurses\' lamps, thin tubes and drips.',
      meat: 'It is a honey store. Ground storey: a round vault door, sealed jars, a weighing scale. Upper storeys: cells brimming with amber honey and bright pollen, some capped, wax dripping, a hoist.',
      highground: 'It is the royal chambers. Ground storey: a huge ribbed arch trimmed in gold, guards\' lamps, a long carpet. Upper storeys: great hanging queen cells like peanuts of gilded wax, gold hexagons, deep amber light.',
    },
    roofProps: [
      { id: 'queencell', width: 0.7, on: ['highground'], look: 'a great hanging queen cell stood upright, a peanut shape of gilded wax glowing from inside' },
      { id: 'pillar', width: 0.45, on: ALL, look: 'a thick twisted pillar of wax and dark propolis' },
      { id: 'lamps', width: 0.4, on: ALL, look: 'a cluster of electric lamps on a stalk of wax' },
      { id: 'turret', width: 0.55, on: ['highground', 'plain'], look: 'a small round guard turret of propolis with a slit and a lamp' },
      { id: 'pollen', width: 0.55, on: ['meat'], look: 'a heap of bright yellow pollen balls in a wax basin' },
      { id: 'dome', width: 0.75, on: ['plain', 'science'], look: 'a low dome of dark propolis with a round skylight glowing amber' },
      { id: 'mast', width: 0.35, on: ['science'], look: 'a thin radio mast grown over with wax' },
      { id: 'vat', width: 0.6, on: ['meat', 'science'], look: 'an open vat of amber honey with a ladle' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'an electric lamp on a stalk of wax' },
      { id: 'litter', width: 0.8, look: 'a royal litter with gold curtains carried on the back of a beetle' },
      { id: 'pot', width: 0.4, look: 'a big sealed honey pot' },
      { id: 'post', width: 0.45, look: 'a small guard post of propolis with a lamp' },
      { id: 'banner', width: 0.3, look: 'a pole flying a gold banner with a plain hexagon' },
      { id: 'column', width: 0.35, look: 'a short wax column holding a bowl of glowing royal jelly' },
    ],
    guests: [],
    roofs: [
      'The top of an old comb sealed with propolis: a crust of dark red-brown resin, matte, with the ribs of the cells under it showing as a faint honeycomb of paler lines, and a few drops of amber.',
      'The top of a comb covered with silk: a smooth pale cream sheet of spun silk stretched over the cells, their hexagons showing faintly through it, with a few thicker white threads. Pale and even.',
    ],
    walls2: {
      plain: 'It is the workers\' sleeping galleries, and its walls are dark red-brown propolis, smooth and glossy, with ribs of pale wax. Ground storey: a row of low wide tunnel mouths like a colonnade, each hung with a curtain of pale silk, a row of lockers, a water tap. Upper storeys: rows of large round sleeping cells, five to a storey, each closed by a drawn curtain of white silk with a warm light behind it; small ladders of wax from cell to cell; a loudspeaker.',
      science: 'It is a silk works, and its walls are pale cream wax hung with white silk. Ground storey: a row of spinning wheels and reels seen through three wide round windows, baskets of white cocoons, a round door. Upper storeys: racks running the whole width of each storey, hung with hundreds of white cocoons in rows and long skeins of white and pale gold silk; drying fans; thin tubes.',
      meat: 'It is a pollen store and bee-bread bakery, and its walls are a honeycomb of open cells packed with pollen of many colours. Ground storey: a bakery counter with stacked cakes of bee-bread, sacks, a round oven mouth glowing orange. Upper storeys: a perfect honeycomb of large open cells, each packed to the brim with pollen of one colour: orange, bright yellow, rust red, violet, cream and olive, laid out like a patchwork; a hoist with a basket.',
      highground: 'It is the hall of the queens, and its walls are deep amber wax, nearly brown, with gilded ribs. Ground storey: one great round door of gold honeycomb in the middle with a guard lamp on each side, and a row of gilded pillars like stacked beads. Upper storeys: a row of huge round medallions, three to a storey, each holding the portrait in relief of a past queen, an insect in a tall collar, in gilded wax; swags of gold silk between them; plain gold hexagons.',
    },
    // Nothing blue: this set is keyed on blue.
    roofProps2: [
      { id: 'chimney', width: 0.45, on: ALL, look: 'a ventilation chimney of wax: a ribbed funnel with fanning vanes at its mouth' },
      { id: 'cocoons', width: 0.55, on: ['science', 'plain'], look: 'a rack of white silk cocoons hung up to dry' },
      { id: 'canopy', width: 0.7, on: ['highground'], look: 'a gilded canopy: four wax pillars holding a small dome of gold honeycomb over an empty cushion' },
      { id: 'font', width: 0.5, on: ['highground', 'meat'], look: 'a wide shallow bowl of royal jelly on a stem of wax, glowing pale gold' },
      { id: 'waxblocks', width: 0.55, on: ['meat', 'plain'], look: 'a stack of blocks of fresh yellow wax' },
      { id: 'generator', width: 0.5, on: ['science', 'plain'], look: 'a small electric generator in a shell of wax, with a coil of black cable' },
      { id: 'eggs', width: 0.5, on: ['science'], look: 'a cluster of large pale cream eggs in a nest of silk, warmed by an electric lamp' },
      { id: 'horn', width: 0.5, on: ['highground', 'plain'], look: 'a great signal horn of curled wax and brass on a stand' },
    ],
    streetProps2: [
      { id: 'cart', width: 0.6, look: 'a porter\'s hand cart loaded with sealed honey pots' },
      { id: 'statue', width: 0.45, look: 'a statue of a queen in gilded wax on a round plinth' },
      { id: 'stalagmite', width: 0.35, look: 'a stalagmite of pale wax grown up from the floor, with a small lamp set into it' },
      { id: 'trolley', width: 0.55, look: 'a nursery trolley carrying three pale grubs wrapped in white silk' },
      { id: 'barrier', width: 0.6, look: 'a guard barrier: a pole of amber resin across two posts, with a red warning lamp' },
      { id: 'buggy', width: 0.8, look: 'a small electric cart shaped like a beetle, amber and black, with a flat back' },
    ],
  },
  {
    // OPEN FARMED COUNTRY. The raised blocks of the board are terraces of fields, not buildings: a "wall" is
    // the bank that holds a terrace up, a "roof" is a field seen from above, a "street" is a cart track.
    id: 'terraces', key: ['FF00FF', 'magenta'], roofTint: [0xc6c4b8, 0xe2e0d4, 0xffffff], name: 'The Terraced Fields',
    territories: ['granary'],
    guests: ['farmland'],
    front: 'part of a hillside cut into terraces of fields, exactly three terraces high, each terrace held up by a wall. It is not a free-standing building: it is a bank of earth and stone with things built into it',
    band: 'a thin coping of flat pale stones, with tufts of grass and a few roots hanging over it,',
    species:
      'It is built by an insect people in their own way of building, never as humans build: stones laid like honeycomb ' +
      'cells, rammed earth in bands, pale wasp paper and wax, ribbed arches of beads, round cell doorways and windows. ' +
      'It is the countryside of a civilisation of the 21st century',
    place: { roof: 'in the fields of the terraced farmland of an insect people', street: 'beside the cart tracks of the terraced farmland of an insect people' },
    look:
      'This is open farmed country, not a town: dry-stone retaining walls laid like honeycomb, banks of rammed earth in ' +
      'bands of ochre and cream, roots, moss, drains, little round cellar doors, field shelters shaped like beehives ' +
      'built into the bank. The colours of earth and stone: ochre, pale grey, straw, moss green',
    street: 'A cart track in farmed country: pale dry packed earth, light tan, with faint criss-crossing wheel marks, a scatter of small pebbles and a few wisps of straw. Pale and plain.',
    streets: [
      'A country lane surfaced with crushed chalk: pale cream-white grit, dry and dusty, with a scatter of small flints, faint hoof-like prints and a few blades of grass. Pale and plain.',
    ],
    plaza: 'A well yard: pale flagstones laid in rings round a round stone well cover in the middle, with a narrow drain channel running to one side and a little moss in the joints.',
    // The first one had nineteen thin rows of bright green: at game size a fine stripe that flickers, and a green that drowns the board.
    roof: 'A field of a young crop seen from straight above: eight wide straight parallel rows of low leafy plants, a muted dusty sage green, with strips of pale straw-coloured earth between the rows as wide as the rows themselves, running from one edge of the picture to the other. Muted colours, matte, soft: nothing bright and nothing dark.',
    roofs: [
      "Long wild grass seen from straight above: tall soft grass of muted green and straw gold, flattened in swirls by the wind, full of small white, yellow and pale blue wildflowers. No paths and no bare earth.",
      "A hay meadow seen from straight above: short soft grass of a muted green, even, sprinkled with tiny white and yellow flowers and patches of clover, with no paths and no bare earth.",
      "A sheep pasture seen from straight above: short cropped grass of a muted green with darker tussocks, and one narrow worn path of pale bare earth winding across it from one edge of the picture to the other.",
      "A copse seen from straight above: the round caps of a small grove of fungus trees, tan, cream and pale ochre, touching and overlapping, with glimpses of mossy green ground between them. Muted colours.",
    ],
    walls: {
      plain: 'It is where the farm people live, in homes dug into the bank. Ground storey: a dry-stone wall laid like honeycomb, with round front doors of planks set into it, each with a little porch, a round window with shutters, a bench, boots, a bicycle, a letter box. Upper storeys: more of the stone bank, with field shelters shaped like beehives built into it, small round windows lit amber, stove pipes poking out of the earth with a wisp of smoke, a satellite dish, a drain pipe, washing on a line.',
      science: 'It is an agricultural research station built into the bank. Ground storey: a glass door in a round arch of stone, racks of seed trays, cores of soil in tubes, a weather screen. Upper storeys: round greenhouse windows let into the bank with seedlings under violet lamps, rain gauges, soil probes with small solar panels and cables, irrigation pipes with valve wheels, a small dish.',
      meat: 'It is where food is stored: root cellars and granaries in the bank. Ground storey: a rammed-earth wall in bands of ochre and cream, with wide round cellar doors of planks standing half open on shelves of jars, sacks and barrels; crates of roots; milk churns. Upper storeys: rows of small round vent holes with louvres, racks of yellow cobs and herbs hung to dry under the coping, storage jars in niches, a hoist.',
      highground: 'It is the great house of the estate, built against the highest terrace. Ground storey: an arcade of wide round arches of pale dressed stone with one big double door, lanterns, a climbing plant. Upper storeys: walls of whitewashed rammed earth with bands of honeycomb stonework, round-arched windows with green shutters, a long balcony, a bell, a clock showing only glyphs, an emblem of a plain gold hexagon.',
    },
    // Four of the five faces of every kind of district are LAND (Collins: "all farms ... fine for 20% but not the majority").
    walls2: {
      plain: { land: true, words: "A grassy bank of a hillside: three steps of turf, each held up by a low dry-stone wall laid like honeycomb, half grown over with grass, moss and small wildflowers; tufts of long grass hang over the edge of each step. One small round burrow door of weathered planks low in the bottom step, and nothing else built." },
      science: { land: true, words: "A rocky outcrop in a hillside: three steps of pale grey rock, cracked and layered, with lichen, tough grass and small ferns in the cracks, and a thin trickle of water running down one side into a pool at the foot. Nothing built at all." },
      meat: { land: true, words: "A hedge-topped earth bank of the fields: three steps of red-brown earth held by roots, each step topped with a dense hedge of dark green shrubs and brambles with small white flowers, roots hanging out of the earth face. Nothing built at all." },
      highground: { land: true, words: "A wooded slope: three steps of dark earth and roots under trees that are giant pale fungi with wide tan caps, their thick stems rising from the bank, fallen caps and moss on the ledges, ferns. Nothing built at all." },
    },
    wallsMore: {
      plain: [
        { land: true, words: "An old dry-stone terrace wall with grass over it: three courses of big weathered stones laid like honeycomb, so overgrown that grass, clover and wild thyme cover most of them, with a few stones showing through. Nothing built at all." },
        { land: true, words: "A steep meadow bank: three steps of long green and gold grass bending in the wind, poppy-red and white wildflowers, a narrow sheep path climbing across it. Nothing built at all." },
        { land: true, words: "A bank of pale chalk and flint: three steps of white chalk with dark flints in it, crumbling at the edges, with short grass and small blue flowers on each ledge. One small field shelter shaped like a beehive of dry stone sits on the middle ledge." },
      ],
      science: [
        { land: true, words: "A bank with a spring: three steps of mossy dark stone, green with moss and liverwort, water seeping out between the stones and dripping from ledge to ledge into a stone basin at the foot, reeds in it. Nothing built at all." },
        { land: true, words: "A sandy bank of a river terrace: three steps of pale ochre sand and gravel in layers, small round holes of burrows in it, tufts of dune grass on top of each step. Nothing built at all." },
        { land: true, words: "A bank of tumbled boulders: three steps of large rounded grey and ochre boulders heaped together, with grass, heather and small bushes growing between them. Nothing built at all." },
      ],
      meat: [
        { land: true, words: "A bank of an orchard: three steps of grassy earth, each ledge planted with a row of small twisted fruit trees that are really fungi, hung with small orange fruits, fallen fruit in the grass. Nothing built at all." },
        { land: true, words: "A turf bank with a root cellar: three steps of thick green turf; low in the bottom step, one small round cellar door of planks set in a ring of stones, a basket beside it. The rest is grass and earth." },
        { land: true, words: "A bank of brambles and wild roses: three steps of earth almost hidden under a tangle of brambles heavy with dark berries, wild roses and long grass. Nothing built at all." },
      ],
      highground: [
        { land: true, words: "A high rocky ridge: three steps of dark grey crags, weathered and cracked, with heather, gorse in yellow flower and small twisted pines that are really fungi clinging to the ledges. Nothing built at all." },
        { land: true, words: "A hillside of standing stones: three steps of turf, with two tall rough grey standing stones on the middle ledge carved with rows of abstract glyphs, lichen on them, long grass round their feet. No crosses, no symbols other than abstract glyphs." },
        { land: true, words: "A wooded bank of tall fungus trees seen from the side: three steps of mossy earth, thick pale stems rising the full height, their caps making a canopy at the top, dappled light, ferns and fallen caps. Nothing built at all." },
      ],
    },
    roofProps: [
      { id: 'haystack', width: 0.7, on: ['meat'], look: 'a tall round haystack shaped like a beehive, golden, with a little thatched cap' },
      { id: 'stooks', width: 0.6, on: ['plain'], look: 'three stooks of cut corn: sheaves stood on end leaning together' },
      { id: 'fungustree', width: 0.7, on: ALL, look: 'a fruit tree that is really a giant fungus: a thick pale stem and a wide tan cap hung with small orange fruits' },
      { id: 'kite', width: 0.4, on: ['plain'], look: 'a bird-scaring kite on a tall bending pole: a paper kite shaped like a hawk moth with big eye spots' },
      { id: 'well', width: 0.5, on: ['highground'], look: 'a round stone well with a windlass, a bucket and a little roof of paper shingles' },
      { id: 'shelter', width: 0.65, on: ALL, look: 'a field shelter of dry stone shaped like a beehive, with a round doorway' },
      { id: 'waterwheel', width: 0.65, on: ['science'], look: 'an irrigation wheel of wood with clay pots tied to its rim, on a stone stand' },
      { id: 'skeps', width: 0.55, on: ['science'], look: 'three straw skeps on a bench: the dome-shaped hives of small tame bees, kept for their wax' },
    ],
    roofProps2: [
      // Open country (Collins: "it's all barns and farms, this is bad"): what stands on the land is mostly the land's own.
      { id: 'oak', width: 0.8, on: ALL, look: 'a big spreading tree that is really a giant fungus: a thick gnarled pale stem and a wide rounded cap of tan and cream, with moss at its foot' },
      { id: 'clock', width: 0.6, on: ALL, look: 'a tree that is a giant dandelion clock: a tall green stem and a round white seed head' },
      { id: 'boulders', width: 0.6, on: ALL, look: 'three big rounded grey boulders with lichen and a tuft of grass between them' },
      { id: 'bush', width: 0.55, on: ALL, look: 'a round dense bush of dark green leaves with small white flowers' },
      { id: 'pond', width: 0.75, on: ALL, look: 'a small round pond with reeds and lily pads, edged with pale stones' },
      { id: 'log', width: 0.7, on: ALL, look: 'a fallen log of a fungus tree, mossy, with small mushrooms growing on it' },
      { id: 'cairn', width: 0.4, on: ALL, look: 'a cairn: a tall pile of flat grey stones' },
      { id: 'bale', width: 0.5, on: ALL, look: 'a round bale of golden hay lying on its side' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a lantern hanging from a bent wooden post, with a small solar panel on top' },
      { id: 'cart', width: 0.8, look: 'a two-wheeled farm cart loaded with sacks, its shafts resting on the ground' },
      { id: 'milestone', width: 0.25, look: 'a rounded milestone of pale stone carved with one abstract glyph' },
      { id: 'fence', width: 0.7, look: 'a short length of woven hurdle fence with tall grass' },
      { id: 'trough', width: 0.5, look: 'a stone water trough fed by a bent pipe' },
      // It was drawn with a third board pointing the other way: a post with arms to both sides is a cross at
      // game size (as the farmland's scarecrow was). That board was painted out (tools/art/paint-out.mjs).
      { id: 'signpost', width: 0.35, look: 'a wooden signpost with two pointing boards, both on the same side of the post and pointing the same way, each painted with abstract glyphs' },
    ],
    streetProps2: [
      { id: 'gate', width: 0.7, look: 'a field gate of five bars between two stone posts, standing half open' },
      { id: 'stile', width: 0.45, look: 'a wooden stile: two steps over a low stretch of dry-stone wall' },
      { id: 'tufts', width: 0.45, look: 'a clump of tall wild grass tufts with a few white and yellow flowers' },
      { id: 'bramble', width: 0.55, look: 'a low bramble bush with dark berries' },
      { id: 'rocks', width: 0.45, look: 'three mossy stones at the side of a track' },
      { id: 'stump', width: 0.4, look: 'the stump of a fungus tree with a ring of small mushrooms round it' },
    ],
  },
  {
    // A DELTA OF REED BEDS AND STILT VILLAGES. A "wall" is a village on stilts over dark water, a "roof" is a
    // deck of reed, a "street" is a boardwalk or a sand bar.
    // Nothing pink: keyed on magenta because it is full of green and of blue.
    id: 'wetland', key: ['FF00FF', 'magenta'], roofTint: [0xc4c0b4, 0xe0dccf, 0xffffff], name: 'The Mirewater Delta',
    territories: ['mirewater'],
    guests: ['orient'],
    front: 'part of the front of a village built on stilts over water, exactly three storeys high',
    band: 'the edge of a deck of pale planks, with a rope rail,',
    species:
      'It is built by an insect people in their own way of building, never as humans build: walls woven of reed like ' +
      'baskets in a honeycomb weave, pale wasp paper and wax, ribbed arches of bundled reed, round cell doorways and ' +
      'windows. It is a village of a civilisation of the 21st century',
    place: { roof: 'on the reed decks of the stilt villages of an insect people', street: 'on the boardwalks of the stilt villages of an insect people' },
    look:
      'This is a delta of reed beds and flooded paddies: houses of woven reed and pale wasp paper on stilts over dark ' +
      'still water, thatch, boardwalks of pale planks, rope, nets, floats, lanterns. The colours of reed and water: ' +
      'pale straw, silver-grey weathered wood, dark teal water, and small touches of the faded blue and orange of ' +
      'plastic barrels, floats and nets',
    street: 'A boardwalk seen from straight above: pale weathered planks, bleached silver-cream, laid side by side with thin dark gaps between them, with rows of nail heads and a little dried mud. Pale everywhere.',
    streets: [
      'A sand bar seen from straight above: pale wet sand, light cream, with soft ripple marks, a few small shells, a few broken reed stems and the faint prints of small feet. Pale and plain.',
    ],
    plaza: 'A landing stage where a market is held: a deck of pale planks laid in rings round a round mat of woven reed in the middle, with an edging of thick rope and iron mooring rings.',
    roof: 'A deck of woven reed seen from straight above: flat mats of pale golden-brown reed woven in a big herringbone, bound at the joins with dark cord. Even and matte.',
    roofs: [
      'A roof of reed thatch seen from straight above: bundles of grey-brown weathered reed laid in wide bands and held down by thin poles, with a little green moss. Muted colours, matte.',
      // The first had black patches of tarred cloth: on the board they read as holes in the deck.
      'A deck of split canes seen from straight above: bleached pale canes lashed side by side with cord, even all over, with a few canes of a warmer honey colour mixed in. Every part of it is pale: no dark patches, no stains, no holes.',
    ],
    walls: {
      plain: 'It is a row of stilt homes. Ground storey: stilts of timber and bundled reed standing in dark water, with small boats moored between them, ladders, hanging fish traps, floats. Upper storeys: round houses of woven reed and pale wasp paper with round doors and round windows lit amber, nets and washing hung out, a satellite dish, a blue plastic barrel, a solar lamp, pots of herbs.',
      science: 'It is a water research station. Ground storey: stilts in dark water with a depth gauge marked in plain ticks, crates of sample bottles, a small research boat with instruments. Upper storeys: walls of pale wasp paper panels in a reed frame, round windows showing tanks of water lit pale green with small swimming larvae, glowing screens, solar panels, sampling pipes running down to the water, a weather mast.',
      meat: 'It is where food is stored: a smokehouse, drying racks and grain baskets. Ground storey: stilts in dark water, a boat shed with a round mouth, a boat loaded with baskets, floating keep-nets. Upper storeys: long racks of split silver fish hung to dry in rows, a smokehouse leaking thin smoke, huge woven grain baskets with thatched lids, strings of dried roots, clay jars.',
      highground: 'It is the great hall of the delta, over its sluice. Ground storey: a great sluice gate of dark timber and iron between two piers of stone laid like honeycomb, with water pouring through it and big wooden gear wheels. Upper storeys: a tall long-house of woven reed with one great round window of lattice, posts carved as dragonflies, long plain pennants, a bronze gong, an emblem of a plain gold hexagon.',
    },
    walls2: {
      plain: 'It is a row of houseboats moored under a net loft, and everything is painted in faded colours: pale blue, ochre and white. Ground storey: three broad houseboats lie side by side on dark water, each with a rounded cabin of painted paper, a round door, a tin chimney and pots of flowers on its deck. Upper storeys: an open loft on stilts with no walls, only posts, hung across its whole width with brown fishing nets, orange floats and coils of rope; a few hammocks; a radio aerial.',
      science: 'It is a fish hatchery and lighthouse station, and its walls are white-painted boards with a band of orange. Ground storey: a row of six round concrete hatching tanks seen from the side, half in the water, with pipes and bubbling air hoses; a steel gangway. Upper storeys: a plain white boarded wall with a single row of big porthole windows in brass rims; a round lamp room of glass in the middle of the top storey with a great lit lamp; a fog horn; a radar bar.',
      meat: 'It is a floating market and rice store, and its walls are dark brown woven cane with awnings of faded orange and yellow cloth. Ground storey: a row of narrow market boats nose to the wall on dark water, heaped with green and yellow gourds, white roots and baskets of grain, each under a round paper parasol. Upper storeys: the wall is a row of giant round grain jars of pale clay standing shoulder to shoulder, four to a storey, each under its own little thatched hat, with ladders between them.',
      highground: 'It is the water palace of the delta, and its walls are dark red lacquered timber and gilded reed. Ground storey: a broad water gate, a round arch wide enough for a barge, with a gilded barge shaped like a water beetle moored inside it, and steps down to the water on each side. Upper storeys: a long open gallery behind a row of slender gilded posts on each storey, hung with big round paper lanterns; a great gilded dragonfly spread across the middle of the wall; an emblem of a plain gold hexagon.',
    },
    roofProps: [
      { id: 'dryingrack', width: 0.7, on: ['meat', 'plain'], look: 'a fish-drying rack: a frame of poles hung with rows of split silver fish' },
      { id: 'reeds', width: 0.55, on: ALL, look: 'a stook of cut reed bundles stood on end and tied' },
      { id: 'pump', width: 0.45, on: ['science', 'plain'], look: 'a water pump: a small orange motor pump with a fat hose' },
      { id: 'turbine', width: 0.45, on: ['science', 'highground'], look: 'a small wind turbine with three white blades on a thin mast held by wires' },
      { id: 'wader', width: 0.45, on: ['plain', 'highground'], look: 'a tall wading creature standing on one leg, which is not a bird but a giant dragonfly with a long beak-like snout, grey and white' },
      { id: 'hut', width: 0.7, on: ['plain', 'highground'], look: 'a round look-out hut of woven reed with a thatched cap and a round doorway' },
      { id: 'nets', width: 0.65, on: ['plain', 'meat'], look: 'a frame of poles hung with brown fishing nets and orange floats' },
      { id: 'granary', width: 0.6, on: ['meat'], look: 'a huge woven grain basket on a low stand, with a thatched lid' },
    ],
    roofProps2: [
      { id: 'smoker', width: 0.5, on: ['meat'], look: 'a smoking barrel: a tarred barrel on bricks with a lid and a thread of grey smoke' },
      { id: 'raintank', width: 0.55, on: ALL, look: 'a faded blue plastic rain tank on a wooden stand, with a tap' },
      { id: 'dish', width: 0.5, on: ['plain', 'science'], look: 'a satellite dish lashed to a bundle of reed poles' },
      { id: 'solar', width: 0.7, on: ['science', 'plain'], look: 'a dark blue solar panel on a frame of lashed canes' },
      { id: 'windsock', width: 0.35, on: ['highground', 'science'], look: 'a tall pole flying a long paper windsock shaped like a dragonfly, orange and white' },
      { id: 'crabpots', width: 0.55, on: ['meat', 'plain'], look: 'a stack of round woven crab pots with a coil of rope' },
      { id: 'canoe', width: 0.85, on: ['plain', 'highground'], look: 'a slender canoe stored upside down on two trestles' },
      { id: 'floodhorn', width: 0.35, on: ['highground', 'science'], look: 'a flood warning siren: a grey horn on a short mast with a red lamp' },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3, look: 'a paper lantern hanging from a bent reed pole, glowing amber' },
      { id: 'boat', width: 0.85, look: 'a small flat-bottomed boat of tarred planks drawn up out of the water, with a pole and a basket in it' },
      { id: 'fishtrap', width: 0.45, look: 'two long woven fish traps shaped like funnels, leaning together' },
      { id: 'rushes', width: 0.5, look: 'a clump of tall green rushes with brown heads, with two round lily pads at its foot' },
      { id: 'fishcart', width: 0.6, look: 'a hand cart carrying baskets of silver fish' },
      { id: 'mooring', width: 0.3, look: 'a mooring post wound with thick rope, with an orange float hanging from it' },
    ],
    streetProps2: [
      { id: 'stall', width: 0.7, look: 'a market stall under a round paper parasol, with baskets of gourds and a hanging scale' },
      { id: 'skater', width: 0.6, look: 'a tame pond skater, a long-legged water insect the size of a pony, wearing a saddle and a bridle' },
      { id: 'crates', width: 0.5, look: 'a stack of white foam crates of fish on ice' },
      { id: 'marshcar', width: 0.85, look: 'a parked marsh car shaped like a water beetle, faded teal, with fat tyres and a small propeller at the back' },
      { id: 'gauge', width: 0.22, look: 'a flood gauge: a tall post painted in bands of white and red, with plain tick marks' },
      { id: 'buoy', width: 0.4, look: 'an orange buoy with a small lamp, lying on a coil of rope' },
    ],
  },
];

export const biome = (id) => BIOMES.find((b) => b.id === id);

export const KINDS = ['plain', 'science', 'meat', 'highground'];

/**
 * Which roof props stand on which kind of district, as the game is told: the first sheet's
 * (or the mix a set names itself) and then the second sheet's.
 */
export const roofSets = (b) => Object.fromEntries(KINDS.map((kind) => [kind, [
  ...(b.roofSets?.[kind] ?? b.roofProps.filter((p) => p.on.includes(kind)).map((p) => p.id)),
  ...(b.roofProps2 ?? []).filter((p) => p.on.includes(kind)).map((p) => p.id),
]]));

/** Every face a kind of district has, in order: the first, the second (walls2), then the rest (wallsMore). */
export const wallsOf = (b, kind) => [b.walls[kind], b.walls2?.[kind], ...(b.wallsMore?.[kind] ?? [])].filter(Boolean);

/** How many of each piece a set is meant to have, as the game is told (the first one counts). */
export const variantsOf = (b) => ({
  walls: Object.fromEntries(KINDS.map((kind) => [kind, wallsOf(b, kind).length])),
  roof: 1 + (b.roofs?.length ?? 0),
  street: 1 + (b.streets?.length ?? 0),
  plaza: 1,
});

/**
 * The name of a piece's sprites: the first of a kind keeps the name it always had (roof,
 * wall-plain), a later one has its number after a tilde (roof~1, wall-plain~1).
 */
export const spriteName = (name, v) => (v ? `${name}~${v}` : name);
/** The picture a piece is baked from (see the top of this file for why it is not named as its sprites are). */
export const pictureName = (name, v) => (v ? `${name}.${v}.png` : `${name}.png`);

/**
 * PROPS THAT LOOK THE SAME FROM EVERY SIDE (Sep 29 2026). When the camera turns, a prop is
 * seen from another side; a lopsided one (a car, a bench, a sign) has a picture of its back
 * (`prop-<id>~b`, from the sheet `props-<where>.back.png`), a round one is simply mirrored.
 * `round: true` on an item says the same of any prop not in this list.
 */
export const ROUND = new Set([
  'dome-paper', 'dome-gold', 'spire', 'tank', 'cistern', 'skylight', 'cowl', 'lamp', 'lamps', 'lantern', 'lanterns',
  'chimney', 'cupola', 'mast', 'aerial', 'beacon', 'cone', 'planter', 'pot', 'potted', 'urn', 'vase', 'barrel', 'drum',
  'bale', 'hay', 'haystack', 'stooks', 'tree', 'oak', 'fungustree', 'cypress', 'willow', 'bush', 'boulders', 'rocks',
  'cairn', 'pond', 'tufts', 'bramble', 'stump', 'pillar', 'column', 'stalagmite', 'obelisk', 'candles', 'candlestand',
  'silo', 'well', 'fountain', 'font', 'pollen', 'queencell', 'eggs', 'cocoons', 'skeps', 'reeds', 'rushes', 'pool',
  'holo', 'dome', 'hydrant', 'bollard', 'buoy', 'raintank', 'pod',
]);
export const isRound = (p) => p.round ?? ROUND.has(p.id);
/** The file of the back of a sheet of props: props-roof.png -> props-roof.back.png. */
export const backName = (file) => file.replace(/\.png$/, '.back.png');
