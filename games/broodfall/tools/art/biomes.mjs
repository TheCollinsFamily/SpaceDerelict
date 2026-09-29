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
    id: 'orthodox', roofTint: [0xb9a783, 0xd0bd96, 0xe6d3aa], name: 'The Temple Cities',
    territories: ['temple', 'seventh-city', 'assembly'],
    // Made first, on Sep 29 2026, from its own prompts (tools/art/templates/terrain.mjs); kept as it is.
    made: true,
    // The mix of roof props Collins has seen and liked: kept exactly.
    roofSets: {
      plain: ['aircon', 'dish', 'solar', 'tank', 'dome-paper', 'aircon', 'solar'],
      science: ['dish', 'mast', 'solar', 'dish', 'aircon', 'mast'],
      meat: ['tank', 'tank', 'aircon', 'solar', 'dome-paper'],
      highground: ['dome-gold', 'spire', 'dome-paper', 'dome-gold', 'spire'],
    },
    roofProps: [
      { id: 'dome-paper', width: 0.8, on: ['plain', 'meat', 'highground'] },
      { id: 'dome-gold', width: 0.85, on: ['highground'] },
      { id: 'spire', width: 0.6, on: ['highground'] },
      { id: 'dish', width: 0.5, on: ['plain', 'science'] },
      { id: 'aircon', width: 0.45, on: ['plain', 'science', 'meat'] },
      { id: 'solar', width: 0.7, on: ['plain', 'science', 'meat'] },
      { id: 'mast', width: 0.35, on: ['science'] },
      { id: 'tank', width: 0.55, on: ['plain', 'meat'] },
    ],
    streetProps: [
      { id: 'lamp', width: 0.3 }, { id: 'signal', width: 0.25 }, { id: 'sign', width: 0.4 },
      { id: 'car', width: 0.8 }, { id: 'gate', width: 1.6, never: true }, { id: 'pod', width: 0.5, shared: true },
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
  },
  {
    id: 'orient', key: ['0000FF', 'blue'], roofTint: [0xc4c4c4, 0xe0e0e0, 0xffffff], name: 'The Lantern Cities',
    territories: ['pilgrim', 'mirewater'],
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
  },
  {
    id: 'farmland', key: ['FF00FF', 'magenta'], roofTint: [0xc4c0b4, 0xe0dccf, 0xffffff], name: 'The Granary Belt',
    territories: ['granary'],
    look:
      'The style of this district borrows from a farming town of the American Midwest: barns of red-stained paper boards with ' +
      'white trim, round silos, windmills, grain elevators, hay, split-rail fences',
    street: 'A farm road: pale packed earth with scattered straw, a few pebbles and faint hoof-like prints.',
    plaza: 'A round threshing floor of pale packed earth ringed with golden straw, swept in circles.',
    roof: 'A flat roof of pale golden thatch laid in neat bands and held down with wooden battens.',
    walls: {
      plain: 'It is a row of farmhouses. Ground storey: porches with rocking chairs, round doors, milk churns, a boot scraper. Upper storeys: round windows with gingham curtains, a hay loft door with a pulley, drying bunches of herbs.',
      science: 'It is an agricultural station. Ground storey: a glass door, seed trays, a weather screen. Upper storeys: round greenhouse panes with seedlings under lamps, rain gauges, a small dish, charts of abstract glyphs.',
      meat: 'It is a great barn and larder. Ground storey: big double barn doors braced with white battens in a honeycomb pattern, sacks of grain, hanging cured goods. Upper storeys: a hay loft spilling straw, round ventilation louvres, a hoist.',
      highground: 'It is a grain elevator. Ground storey: a weighbridge and wide doors. Upper storeys: tall plain walls of red-stained boards with white trim, chutes, a painted emblem of a plain gold hexagon, a small bell under a little roof.',
    },
    roofProps: [
      { id: 'silo', width: 0.7, on: ['meat', 'highground'], look: 'the domed top of a round grain silo, silver, with a ladder' },
      { id: 'windmill', width: 0.7, on: ['plain', 'science'], look: 'a farm wind pump with a many-bladed wheel on a lattice tower' },
      { id: 'tank', width: 0.55, on: ALL, look: 'a wooden water tank on legs' },
      { id: 'hay', width: 0.6, on: ['meat', 'plain'], look: 'a stack of golden hay bales' },
      { id: 'vane', width: 0.3, on: ['plain', 'highground'], look: 'a weathervane shaped like a beetle on a short post' },
      { id: 'hutch', width: 0.55, on: ['plain'], look: 'a little hutch with a run, holding a few fat green aphids' },
      { id: 'chimney', width: 0.4, on: ['plain', 'meat'], look: 'a stone-like chimney with a wisp of smoke' },
      { id: 'solar', width: 0.7, on: ['science', 'plain'], look: 'a dark blue solar panel on a low tilted frame' },
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
  },
];

export const biome = (id) => BIOMES.find((b) => b.id === id);

/** Which roof props stand on which kind of district, as the game is told. */
export const roofSets = (b) => b.roofSets ?? Object.fromEntries(['plain', 'science', 'meat', 'highground']
  .map((kind) => [kind, b.roofProps.filter((p) => p.on.includes(kind)).map((p) => p.id)]));
