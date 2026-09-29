/**
 * Concept art round for the style bible (assets/style-bible.md). PAID: about $0.11 per
 * picture at medium quality, $0.42 at high.
 *
 *   node tools/art/concepts.mjs [slug ...]      (no slugs = all)
 *
 * Writes notes/concepts/<date>/<slug>.png. A picture that already exists is skipped;
 * delete art-src/probes/concept-<slug>-still.png to re-roll one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, makeStill, ready } from './rfab.mjs';
import { SHEETS, unit } from './units.mjs';

const OUT = path.join(ROOT, 'notes', 'concepts', process.env.PROBE_DATE || '2026-09-29');

const ISO = 'Isometric three-quarter top-down view, the camera 45 degrees above the ground.';
const STRAIGHT = 'Realistic, grounded, physically plausible materials, soft overcast daylight. No text, no lettering, no interface, no borders.';
const COLONY = 'dark umber chitin and pale amber eyes';
const BODY =
  'salmon-pink wet muscle armoured with plates of dark chitin and ivory bone, glistening';
const CREEP =
  'a living skin that is dark maroon, matte and veined, thick on the rooftops and only a thin translucent film on the streets';

const board = (city) =>
  'Concept art for a tower defense video game, shown as a finished in-game view with no interface. ' +
  `${ISO} A small district of an insect civilisation's city. The city is laid out like a quiet suburb but built ` +
  `out of insect materials: ${city}, with hexagonal cells, ribbed arches and small domed doorways glowing warm amber. ` +
  'The buildings are chunky flat-topped terraced blocks of three different heights, packed tightly together, ' +
  'separated by sunken winding streets of pale dust, two lanes wide. In the middle of the district is a fresh ' +
  'crater holding a half-buried dark meteor, split open around a pulsing crimson heart of muscle. From the crater ' +
  `spreads ${CREEP}. Standing on the skin-covered rooftops are six rooted organisms, each about the size of one ` +
  `building, made of ${BODY}: one with a puckered nozzle, one with whipping tendrils, one a fan of bone quills. ` +
  'They are lighter and wetter than the dark skin they stand on. Down in the pale streets, squads of small ' +
  'dark-shelled insect soldiers with safety-orange painted markings march toward the crater. At the edges of the ' +
  'picture the untouched city continues, calm, lamps lit. High detail, clear readable shapes, strong contrast ' +
  `between the pale dry city and the wet red organism. ${STRAIGHT}`;

// Round two (Collins, Sep 29 2026): "they need castes that are human enough for the player to
// empathise with them and for the political humour to land … they can have tank-like and
// mob-like castes but they also need human-like ones" and "remember the 1950s horror B movie
// aesthetic".
const PEOPLE =
  'insect people like those of a 1950s science-fiction film: human posture and human body language, two legs, ' +
  'four arms with small hands, an insect head with large expressive eyes, small mandibles like a mouth and ' +
  `antennae that move like eyebrows, ${COLONY} instead of skin`;
const TOWN =
  'a 1950s American small town built at insect scale by an insect civilisation out of pale wasp paper, wax and ' +
  'clay: a main street of flat-roofed shops, a diner, a church with a steeple, a water tower, a drive-in cinema ' +
  'screen, picket fences and tiny streetlamps glowing amber';
const BMOVIE =
  'Lurid saturated Technicolor, hard theatrical key light with deep black shadows, toxic green and magenta rim ' +
  'light from coloured gels off screen, a painted backdrop sky, film grain, the slight softness of old lenses.';
const boardB = (made) =>
  'A still frame from a 1950s colour science-fiction horror B-movie, seen from high above at a three-quarter ' +
  `angle. ${TOWN[0].toUpperCase()}${TOWN.slice(1)}. The buildings are chunky flat-topped blocks of three different ` +
  'heights, separated by pale sunken streets two lanes wide. In the middle of town a smoking crater holds a split ' +
  'dark meteor around a glossy translucent red jelly heart. A dark maroon living skin spreads from it over the ' +
  'nearest rooftops. On the covered rooftops stand six rooted monsters of glossy salmon-pink flesh, dark chitin ' +
  'and ivory bone, lighter than the skin they stand on. Squads of small dark insect soldiers with safety-orange ' +
  `markings march up the pale streets toward the crater. ${made} ${BMOVIE} No text, no interface, no borders.`;

// Round three (Collins, Sep 29 2026): the ship "should be so different from the rest of the game
// it is jarring, very lifelike, very sci fi … a far future ultra religious human society (the
// technopuritan logo is a black gear), they hate luxury, idolatry, and are obsessed with making
// things efficient and higher tech"; "the game play map on the ship (a holographic projection of
// the planet with zones)"; "some exteriors of the ship"; units: "try a few more times".
const REAL = 'Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set.';
const EMPIRE =
  'a far-future, ultra-religious, ascetic human society that despises luxury and decoration, forbids images and ' +
  'idols, and is obsessed with efficiency and ever more advanced technology';
const AUSTERE =
  'Extremely advanced technology and extreme plainness. Nothing soft, nothing ornamental, nothing wasted: no ' +
  'pictures, no statues, no icons, no patterns, no coloured accent lighting, no neon. The only marking anywhere ' +
  'is one small plain black gear symbol (a cogwheel).';
const UNITS =
  `All share ${COLONY} and safety-orange painted markings unless stated. Realistic creature design with the ` +
  'detail and materials of a modern strategy game, soft even light, plain pale grey background, all on one ' +
  'ground line, all at the same scale. No text, no labels.';

// Round four (Collins, Sep 29 2026): map units "have to be a little cartoonish (look at units in
// starcraft or red alert 2) but you are making them super realistic"; the ring exterior "is not
// bad"; the character is "a bit of a nerd, likely designed his own tchotchkes on his desk, sleeps
// on a simple flat piece of metal that retracts back into the wall … a young guy hoping for
// promotion and a partner"; the AI is "a female anime girl projection, torso up".
const RTS =
  'Drawn as unit sprites for a late-1990s real-time strategy game with pre-rendered 3D units: a little ' +
  'cartoonish, chunky and exaggerated, with oversized heads, jaws, weapons and shoulders, thick sturdy legs, ' +
  'bold simple shapes, little fine detail, strong light and dark, and the caste colour in large flat patches. ' +
  'Each one must still read clearly when shrunk to the size of a thumbnail.';
const RTS_SHEET =
  `${ISO} Plain pale grey background, each unit standing apart on its own small dark contact shadow, all facing ` +
  'the lower left, all at the same scale. Dark umber shells and pale amber eyes. No text, no labels.';
const HERO =
  'a young man of about twenty-five, slight, earnest and a bit of a nerd, short dark hair slightly untidy, a ' +
  'plain black high-collared garment with a narrow white collar, its sleeves pushed up to the elbows, a stylus ' +
  'tucked behind one ear';
const YOKE =
  'A holographic projection of a young woman drawn in Japanese anime style, shown from the waist up, floating ' +
  'in the air, slightly translucent with faint scan lines and a soft glow at the edges. She wears a plain ' +
  'black high-collared dress with a narrow white collar and has one small plain black gear as a hair clip. ' +
  'She is polite, precise and quietly curious.';

const JOBS = {
  'r4-units-rts-war': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `Unit design sheet for the war caste of an insect civilisation. ${RTS} Seven units: (1) a militia ` +
      'volunteer, upright, in a helmet far too big for him, holding a spear; (2) a soldier, broad and low, ' +
      'walking on four legs with a pike, big jaws; (3) an elite with a huge stag-beetle head and a breastplate; ' +
      '(4) a pack of five tiny round swarm creatures; (5) a shield-bearer, a big round pill bug behind a slab of ' +
      'plate with a tiny insect driver on top; (6) a siege cannon, a fat beetle whose abdomen is a big gun ' +
      'barrel, legs braced, with a tiny insect crewman covering his ears; (7) a wasp flier in goggles and a ' +
      `scarf, with its shadow on the ground beneath it. Safety-orange markings on all of them. ${RTS_SHEET}` },
  'r4-units-rts-war-2': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `Unit design sheet for the war caste of an insect civilisation. ${RTS} More cartoonish than realistic, ` +
      'with friendly rounded forms, like toy soldiers. Six units: (1) a first responder in a fire helmet ' +
      'dragging a hose; (2) a sapper, a termite with enormous cutting jaws and a tool belt, climbing hooks on ' +
      'its arms; (3) a bomber, a small round ant carrying its own glowing yellow abdomen like a bomb, goggles ' +
      'on, running; (4) a war drummer, a cicada beating the drum of its own chest; (5) a tender, a pale nurse ' +
      'with a red cross armband and a satchel; (6) a tunneler, a mole cricket with great digging claws ' +
      `bursting out of a mound of earth. Safety-orange markings on all but the nurse. ${RTS_SHEET}` },
  'r4-units-rts-science-royal': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `Unit design sheet for the science caste and the royal caste of an insect civilisation. ${RTS} Six units: ` +
      '(1) a researcher, tall and thin in a white lab coat with a specimen cage on its back, teal markings; ' +
      '(2) a specimen thief, small and hunched, running with a satchel, teal scarf; (3) a sedation battery, a ' +
      'pale beetle carrying a rack of dart tubes, teal markings; (4) a royal consort in a dress uniform with a ' +
      'gold sash; (5) a veil matron, a tall figure under a long grey veil with gold trim; (6) the queen, three ' +
      'times the size of the others, a huge swollen abdomen behind her, a tall gold crest like a crown. ' +
      `${RTS_SHEET}` },
  'r4-units-rts-on-board': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `A view from a late-1990s style real-time strategy game, with no interface. ${ISO} A detailed, realistic ` +
      'district of an insect civilisation built of pale grey-cream wasp paper, wax and clay: chunky flat-topped ' +
      'blocks of three heights, sunken pale streets two lanes wide. A dark maroon veined living skin covers the ' +
      'rooftops on the right, and on it stand three rooted organisms of salmon-pink wet muscle, dark chitin and ' +
      'ivory bone. Marching up the street toward them is an army of insect units that are a little cartoonish: ' +
      'chunky, exaggerated, with oversized heads, jaws and weapons, bold simple shapes, dark shells and large ' +
      'flat patches of safety orange, each on a small dark contact shadow: a pack of tiny swarm creatures, a ' +
      'dozen soldiers with pikes, a pill-bug shield-bearer, a beetle siege cannon, two wasp fliers overhead. ' +
      'The units read instantly against the pale street. No text, no interface, no borders.' },
  'r4-ship-exterior-ring-2': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} A small orbital vessel in orbit above a green and brown planet at the edge of night, seen from a ` +
      `distance. It belongs to ${EMPIRE}. A plain pale cylinder standing upright with one slowly rotating ring ` +
      'around its middle and two broad flat black panels. It is far more advanced than any present-day ' +
      'spacecraft: seamless bare pale ceramic with no visible bolts, joints or antennas, razor-exact edges, the ' +
      'ring joined to the cylinder by three thin smooth spokes. Nothing on it that is not needed. One plain ' +
      'black gear symbol (a cogwheel) on the cylinder. Sunlight rakes across it; faint city lights glow on the ' +
      'dark side of the planet below. No readable text.' },
  'r4-ship-exterior-ring-drop': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} Seen from outside and slightly below: a small orbital vessel belonging to ${EMPIRE}, in low orbit ` +
      'over a green and brown planet. A plain pale cylinder standing upright with one slowly rotating ring ' +
      'around its middle and two broad flat black panels; seamless bare pale ceramic, razor-exact edges, no ' +
      'ornament, one plain black gear symbol (a cogwheel) on the cylinder. From an open bay in the bottom of ' +
      'the cylinder it has just released a dark rocky pod the size of a bus, disguised as a meteor, which falls ' +
      'toward the planet with the first orange glow of re-entry. Hard sunlight, crisp shadows, real scale. No ' +
      'readable text.' },
  'r4-hero-portrait': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} Two views of the same person side by side on a plain pale wall aboard an austere white ceramic ` +
      `spacecraft: on the left a head-and-shoulders portrait, on the right the full figure standing. He is ${HERO}. ` +
      'He is a junior technician, cheerful and curious, a believer in his austere society who is still just a ' +
      'young man hoping for a promotion. A small half-smile, as if he has just thought of an experiment. He ' +
      'holds a thin tablet. Even white light. No readable text.' },
  'r4-hero-desk': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} A close view of a standing workstation in the operations room of a small orbital vessel belonging ` +
      `to ${EMPIRE}: seamless matte black composite, exact edges, even white light, a razor-thin holographic ` +
      'readout, one small plain black gear symbol on the wall. Everything is regulation and immaculate, except ' +
      'for a neat row of small things the young technician has made himself out of spare parts and lined up ' +
      'along the back edge of the desk: a gear puzzle machined from steel, a tiny articulated insect built of ' +
      'wire and washers, a drinking cup with cooling fins of his own design, a palm-sized orrery of the planet ' +
      'below, and a sealed jar holding a thumbnail-sized scrap of red living tissue. A stylus and one hand-' +
      'written note lie beside them. His hand is just reaching in to adjust the little insect. No readable text.' },
  'r4-hero-bunk': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} The sleeping cell of a junior technician aboard a small orbital vessel belonging to ${EMPIRE}. Bare ` +
      'white ceramic walls with flush seams, a dark plain floor, shadowless white light, one small plain black ' +
      'gear symbol. The bed is a flat slab of bare metal folded down from the wall, with no mattress, one thin ' +
      'grey blanket folded square at its foot, and the slot in the wall it retracts into clearly visible. One ' +
      'recessed shelf holds a single plain black book and, beside it, a small gear puzzle he made himself. ' +
      `The technician, ${HERO}, sits on the edge of the slab working at a thin tablet, absorbed and content. No ` +
      'readable text.' },
  'r4-hobby-interface': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'A holographic personal notebook floating above a matte black desk aboard an austere spacecraft, filling ' +
      'the frame: the private hobby notes of a young, nerdy technician, shown on the same razor-thin display ' +
      'his society uses for its exact official forms, but everything on it is drawn by hand. Loose notebook ' +
      'pages overlap at slight angles. On them, in quick confident pen lines: sketches of insects in little ' +
      'hats and helmets, a diagram of a cage trap with arrows, a drawing of a red blob with a question mark, a ' +
      'column of checkboxes like a list of dares with some ticked, margins full of small doodles and ' +
      'exclamation marks, a tally of marks in one corner. One page is pinned on top with a drawn paperclip. ' +
      'White and pale cyan lines on a dark ground. The handwriting is scribble only: no readable words.' },
  'r4-yoke-austere': { w: 1024, h: 1024, quality: 'medium',
    prompt:
      `${YOKE} Her hair is dark and tied back. The whole projection is one colour, a pale cool white-blue light. ` +
      'Behind her is the matte black wall of an austere spacecraft, photoreal, with one thin white light strip. ' +
      'Calm neutral expression, hands folded. No text.' },
  'r4-yoke-colour': { w: 1024, h: 1024, quality: 'medium',
    prompt:
      `${YOKE} Her hair is long and pale silver with a slight blue tint, her eyes are large and amber, and the ` +
      'projection is in soft full colour. She looks as if a young man chose how she should look. Behind her is ' +
      'the matte black wall of an austere spacecraft, photoreal, with one thin white light strip. A small ' +
      'attentive smile, one hand raised as if about to ask a question. No text.' },
  'r4-yoke-in-room': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} The operations room of a small orbital vessel belonging to ${EMPIRE}: seamless matte black ` +
      'composite and bare pale ceramic, exact edges, even white light, one small plain black gear symbol on the ' +
      `wall, a long window slit showing the curve of a green and brown planet. At the standing workstation is ${HERO}, ` +
      'seen from the side, talking with easy familiarity to the ship\'s artificial intelligence, which appears ' +
      'above the desk as a projection: a young woman drawn in Japanese anime style, from the waist up, ' +
      'slightly translucent, pale silver hair, a plain black high-collared dress with a narrow white collar. ' +
      'She is the one thing in the room that is drawn rather than real. No readable text.' },
  'r4-yoke-expressions': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Expression sheet of one character, six waist-up drawings in two rows of three on a plain dark ' +
      'background, the same character and costume in every one. A holographic projection of a young woman ' +
      'drawn in Japanese anime style, slightly translucent with faint scan lines: long pale silver hair with a ' +
      'slight blue tint, large amber eyes, a plain black high-collared dress with a narrow white collar, one ' +
      'small plain black gear as a hair clip. The six expressions: calm and neutral; curious, head tilted; ' +
      'quietly amused; concerned; thinking, eyes to one side; very slightly sad. No text, no labels.' },
  'r3-ship-operations-black': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} The operations room of a small orbital vessel belonging to ${EMPIRE}. ${AUSTERE} Seamless matte ` +
      'black composite and bare pale ceramic, precise machined edges, perfect order. No cushioned chairs: a ' +
      'standing workstation and one hard bench. Even white functional light from flush strips. Razor-thin ' +
      'holographic readouts float above the workstation. One crew member stands working with his back to us in ' +
      'a plain high-collared black garment with a narrow white collar. A narrow window slit shows the curve of a ' +
      'green and brown planet. Cold, silent, severe, immaculate. No readable text.' },
  'r3-ship-operations-white': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} A work cell aboard a small orbital vessel belonging to ${EMPIRE}. It feels like a monk's cell built ` +
      `by the most advanced engineers alive. ${AUSTERE} Bare white ceramic walls with flush seams, a floor of ` +
      'plain dark metal, one standing console grown seamlessly out of the wall, one fold-down plank to sit on, ' +
      'one recessed shelf holding a single plain black book. Shadowless white light. A thin holographic display ' +
      'hangs in the air showing fine lines of data. One crew member in a plain black high-collared garment with ' +
      'a narrow white collar stands at the console, hands behind his back. Cold, exact, immaculate, a little ' +
      'frightening. No readable text.' },
  'r3-ship-gene-bay': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} The gene bay of a small orbital vessel belonging to ${EMPIRE}, where a biological weapon is grown. ` +
      `${AUSTERE} Seamless matte black and bare pale ceramic, shadowless white light. In the centre stands a ` +
      'sealed transparent cylinder holding a mass of glistening red living muscle the size of a football, ' +
      'suspended in clear fluid and tended by thin precise robotic arms: the only organic, coloured thing in ' +
      'the room. One crew member in a plain black high-collared garment with a narrow white collar watches it ' +
      'with a thin tablet in hand. Cold, clinical, immaculate. No readable text.' },
  'r3-ship-globe-room': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} A bare dark room aboard a small orbital vessel belonging to ${EMPIRE}. ${AUSTERE} In the centre of ` +
      'the room floats a large holographic projection of a planet, two metres across: a translucent globe ' +
      'showing continents and seas, divided into about sixteen irregular territories by razor-thin bright lines. ' +
      'Three neighbouring territories are filled dark red as if infected, spreading from one point. One ' +
      'territory pulses amber as a warning. Four territories next to the red ones are outlined brighter as ' +
      'places to land. The rest are dim. Small plain geometric markers hover over some territories. One crew ' +
      'member in a plain black high-collared garment with a narrow white collar stands beside the globe with ' +
      'one hand raised, selecting a territory. The hologram is the only light. No readable text.' },
  'r3-ship-globe-close': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'A holographic tactical display of a planet, filling the frame, floating in front of a plain matte black ' +
      `background, made by ${EMPIRE}: exact, plain and extremely advanced, with no decoration at all. A ` +
      'translucent globe showing continents and seas in fine relief, divided into about sixteen irregular ' +
      'territories by razor-thin bright lines. Three neighbouring territories are filled dark red, spreading ' +
      'from one point. One territory pulses amber. Four territories next to the red ones are outlined brighter. ' +
      'The rest are dim. Thin lines join neighbouring territories. Small plain geometric markers hover over ' +
      'some: a triangle, a ring, a diamond. One small plain black gear symbol sits in a corner. Photoreal ' +
      'light, fine scan detail, no lens flare, no readable text.' },
  'r3-ship-exterior-side': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} A small orbital vessel in low orbit above a green and brown planet, seen from outside in hard ` +
      `sunlight against black space. It belongs to ${EMPIRE}. The design is severe, plain and extremely ` +
      'advanced: a long clean hull of bare pale ceramic and matte black, simple geometric volumes, flush ' +
      'seamless panels, large plain radiator fins, no ornament, no clutter of pipes or antennas, no rows of lit ' +
      'windows, one narrow window slit. The only marking is one plain black gear symbol (a cogwheel) on the pale ' +
      'hull. Crisp shadows, real scale, real physics. No readable text.' },
  'r3-ship-exterior-drop': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} Seen from outside and slightly below: a small orbital vessel belonging to ${EMPIRE}, in low orbit ` +
      'over a green and brown planet. Severe, plain and extremely advanced: bare pale ceramic and matte black, ' +
      'simple geometric volumes, flush seamless panels, no ornament, one plain black gear symbol (a cogwheel) ' +
      'on the hull. From an open bay on its underside it has just released a dark rocky pod the size of a bus, ' +
      'disguised as a meteor, which falls toward the planet with the first orange glow of re-entry. Hard ' +
      'sunlight, crisp shadows, real scale. No readable text.' },
  'r3-ship-exterior-ring': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} A small orbital vessel in orbit above a green and brown planet at the edge of night, seen from a ` +
      `distance. It belongs to ${EMPIRE}. A plain pale cylinder with one slowly rotating ring for gravity and ` +
      'broad flat black radiator panels: every part is there because it is needed, and nothing else is. Bare ' +
      'pale ceramic and matte black, flush seamless panels, no ornament, no lit windows, one plain black gear ' +
      'symbol (a cogwheel) on the hull. Sunlight rakes across it; city lights glow faintly on the dark side of ' +
      'the planet below. No readable text.' },
  'r3-units-army-1': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Creature design line-up sheet. The army of an intelligent insect civilisation, showing how its fighting ' +
      'castes run from human-like to beast to machine. From left to right: (1) a nervous militia volunteer, ' +
      'upright and human-like, in a steel helmet too big for him, holding a spear; (2) a professional soldier, ' +
      'hunched and half upright, heavily armoured, helmet fused to the head; (3) a pack of six tiny skittering ' +
      'swarm creatures, animal, no clothes; (4) a shield-bearer as big as a car: a low pill-bug body carrying ' +
      'slab armour on all six legs, with one small human-like driver riding behind the plate; (5) a siege ' +
      'cannon as big as a truck: a bombardier beetle whose abdomen is a gun barrel, legs braced, with two small ' +
      `human-like crew beside it, one covering his ears; (6) a wasp-like flier wearing pilot goggles and a scarf. ${UNITS}` },
  'r3-units-army-2': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Creature design line-up sheet. Six fighting castes of one intelligent insect civilisation, each built ' +
      'like the real insect that does its job, each with a touch of the human about it. From left to right: ' +
      '(1) a first responder: small, upright, human-like, in a fire helmet, carrying a hose; (2) a soldier: a ' +
      'broad armoured ant-like body walking on four legs with two arms holding a pike, wearing a plain helmet; ' +
      '(3) an elite: taller, heavier, a stag-beetle head with great jaws and a decorated breastplate; (4) a ' +
      'sapper: a termite-like climber with huge cutting jaws and climbing hooks, a tool belt across its chest; ' +
      '(5) a bomber: a small round ant whose swollen abdomen glows yellow from within, running, with a fuse-like ' +
      `tail and goggles; (6) a war drummer: a cicada-like body with a drum-skin chest, beating it with two arms. ${UNITS}` },
  'r3-units-army-3': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Creature design line-up sheet. Heavy fighting castes of one intelligent insect civilisation: living ' +
      'vehicles with small human-like crew. From left to right: (1) a shield wall: a giant flat pill bug with ' +
      'overlapping slab plates, a small upright driver peering over the top; (2) a carapace lord: an ironclad ' +
      'beetle as big as a van under a thick domed shell, a small upright commander standing in a hatch; (3) a ' +
      'mortar beetle: squat, with a short fat tube on its back, one small crew member loading it; (4) a siege ' +
      'cannon: a bombardier beetle whose abdomen is a long gun barrel, legs braced wide, two small crew beside ' +
      'it; (5) a tunneler: a mole-cricket with great digging claws, half out of a mound of earth, a small rider ' +
      `with a lamp on its helmet. The small crew are upright and human-like in helmets. ${UNITS}` },
  'r3-units-science-royal': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Creature design line-up sheet. The science caste and the royal caste of one intelligent insect ' +
      'civilisation. From left to right: (1) a researcher: tall, thin, upright and human-like, in a white lab ' +
      'coat with a teal armband, carrying a specimen cage on its back and a clipboard; (2) a specimen thief: ' +
      'small, quick, human-like, in a dark coat with a teal scarf, clutching a satchel; (3) a sedation battery: ' +
      'a pale beetle carrying a rack of dart tubes, with a lab-coated operator beside it, teal markings; (4) a ' +
      'veil matron: a tall robed figure under a long grey veil, gold trim; (5) a royal consort: upright, in a ' +
      'gold-trimmed dress uniform with a sash, half the size of the queen; (6) the queen: three times the ' +
      'height of the researcher, a long swollen abdomen carried behind her like a train, a tall crest like a ' +
      'crown, gold regalia, regal and tired. The science caste wear teal markings and the royal caste gold, not ' +
      `orange. ${UNITS}` },
  'r3-units-in-game': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${ISO} A close view of one pale dusty street, two lanes wide, in an insect civilisation's city built of ` +
      'pale grey-cream wasp paper, wax and clay, with raised flat-topped blocks on both sides. Marching along ' +
      'the street toward the lower left, in loose squads: a pack of tiny skittering swarm creatures in front; ' +
      'then a dozen soldiers, dark-shelled with safety-orange markings, walking on four legs and carrying pikes; ' +
      'then a big pill-bug shield-bearer with a small driver; then a bombardier-beetle siege cannon with two ' +
      'small crew walking beside it; two wasp-like fliers overhead casting shadows on the street. Beside the ' +
      'street, in a doorway, two human-like insect civilians in clothes watch them pass. Dark bodies read ' +
      `clearly against the pale street. ${STRAIGHT}` },
  'r2-board-bmovie-lit': { w: 1536, h: 1024, quality: 'medium',
    prompt: boardB('The town and the creatures are real and fully detailed; only the photography is 1950s.') },
  'r2-board-bmovie-miniature': { w: 1536, h: 1024, quality: 'medium',
    prompt: boardB('Everything is visibly a superb practical effect: the town is a hand-built studio miniature of card, balsa and plaster, the monster is glossy red gelatin and latex, the insects are small stop-motion puppets.') },
  'r2-castes-human': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Character design line-up sheet on a plain pale grey background, full body, all standing upright on one ' +
      `ground line, all at the same scale. Citizens of an intelligent insect civilisation: ${PEOPLE}. They wear ` +
      'ordinary 1950s clothes. From left to right: (1) a commuter in a grey suit and fedora with a briefcase, ' +
      'checking his wristwatch; (2) a mother in a house dress and apron holding a small child by the hand, the ' +
      'child holding a toy; (3) a scientist in a white lab coat with a clipboard and a specimen jar, wearing a ' +
      'teal armband; (4) a fireman-style first responder in a helmet and heavy coat with safety-orange stripes; ' +
      '(5) a nervous militia volunteer in a steel helmet too big for him, safety-orange armband, holding a spear; ' +
      '(6) a radio preacher in dark robes speaking into a large ribbon microphone with one hand raised; (7) a ' +
      'beaming peace delegate in a cardigan and a flower garland, holding a small white flag; (8) a slouching ' +
      'young prodigy in a wrinkled t-shirt, shorts and sandals, messy antennae, holding a game controller; (9) a ' +
      'queen in a long formal gown with a gold crown and sash, taller than the rest. Each has a clear, ' +
      'sympathetic personality in face and posture. Superb 1950s creature-suit and puppet work, soft even ' +
      'light. No text, no labels.' },
  'r2-army-spectrum': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Creature design line-up sheet on a plain pale grey background, all on one ground line, all at the same ' +
      'scale. The army of an intelligent insect civilisation, showing how its fighting castes run from human-like ' +
      'to beast to machine. From left to right: (1) a nervous militia volunteer, upright and human-like, in a ' +
      '1950s steel helmet too big for him, holding a spear; (2) a professional soldier, hunched and half upright, ' +
      'heavily armoured, helmet fused to the head; (3) a pack of six tiny skittering swarm creatures, animal, no ' +
      'clothes; (4) a shield-bearer as big as a car: a low pill-bug body carrying slab armour on all six legs, ' +
      'with one small human-like driver riding behind the plate; (5) a siege cannon as big as a truck: a ' +
      'bombardier beetle whose abdomen is a gun barrel, legs braced, with two small human-like crew beside it, ' +
      'one covering his ears; (6) a wasp-like flier wearing pilot goggles and a scarf. All share ' +
      `${COLONY} and safety-orange painted markings. Superb 1950s creature-suit and puppet work, soft even light. ` +
      'No text, no labels.' },
  'r2-keyart-poster': { w: 1024, h: 1536, quality: 'medium',
    prompt:
      'A 1950s science-fiction horror movie poster, hand-painted in gouache in the lurid style of mid-century ' +
      'creature-feature posters. A colossal glistening red mass of flesh with bone spikes and whipping tendrils ' +
      'rises over a small town at night, a split meteor glowing at its base. In the foreground terrified insect ' +
      'townspeople in 1950s suits, dresses and hats flee toward the viewer; they have human posture and insect ' +
      'heads with large expressive eyes; one carries a child, one clutches a briefcase. Searchlights, a yellow ' +
      'and orange sky, deep blue shadows. Bold dripping title lettering across the top reads "BROODFALL". A ' +
      'smaller line beneath it reads "THIS TIME YOU ARE THE MONSTER". Painted texture, fold creases, slightly ' +
      'faded print.' },
  'r2-film-still': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'A film still from a 1950s colour science-fiction horror B-movie. Low camera at street level on the main ' +
      `street of ${TOWN}. The townspeople are ${PEOPLE}, in 1950s clothes, running toward the camera in panic: a ` +
      'man in a suit losing his hat, a waitress from the diner, a policeman blowing a whistle and waving them on. ' +
      'Behind them a glossy red mass of flesh pours over the roof of the diner, tendrils reaching down the ' +
      'street. The monster looks like glossy gelatin and latex; the townspeople like superb creature-suit work. ' +
      `${BMOVIE} A red glow on the wet street. No text.` },
  'r2-faction-leaders': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Three character portraits side by side in three equal panels, each a waist-up film still from a 1950s ' +
      `colour science-fiction film. All three are ${PEOPLE}. Left panel: the chief of a peace delegation, elderly, ` +
      'beaming with serene joy, in a cardigan and a flower garland, hands clasped, in a soft pastel meeting room. ' +
      'Centre panel: a radio preacher, stern and ecstatic, in dark robes, leaning into a big ribbon microphone in ' +
      'a broadcasting booth, a red lamp glowing beside him. Right panel: a young prodigy, smug and distracted, ' +
      'messy antennae, wrinkled t-shirt, slouched in a beanbag chair holding a game controller, a blackboard of ' +
      'equations and empty takeaway boxes behind him. Saturated Technicolor, theatrical lighting, film grain. ' +
      'No readable text.' },
  'board-paper-city': { w: 1536, h: 1024, quality: 'high',
    prompt: board('pale grey-cream wasp paper, wax and dried clay') },
  'board-clay-city': { w: 1536, h: 1024, quality: 'medium',
    prompt: board('warm terracotta termite clay and amber resin') },
  'castes': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Creature design line-up sheet on a plain pale grey background. Three-quarter side view, all standing on one ' +
      'ground line, all drawn to the same scale. One intelligent insect species whose body differs by its job. ' +
      'From left to right: (1) a small unarmoured first responder; (2) a militia worker wearing a simple helmet ' +
      'plate; (3) a soldier, broad, low and wedge-shaped, heavily armoured, with heavy mandibles; (4) a shield ' +
      'bearer like a giant pill bug carrying a slab of plate in front of it; (5) a researcher, tall, thin and ' +
      'upright, with large eyes and thin arms holding a specimen cage and instruments; (6) a flier like a wasp ' +
      'with pale translucent wings; (7) a royal, three times the size of the soldier, with a long swollen abdomen ' +
      `and a tall crest like a crown; (8) her consort, half her size. All of them share the same ${COLONY}. ` +
      'The first four and the flier wear safety-orange painted markings, the researcher wears teal markings, the ' +
      `royal and consort wear gold. Realistic creature design, soft even light. ${STRAIGHT}` },
  'limbs': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `Creature design sheet. ${ISO} Six rooted organisms in two rows of three, all at the same scale, standing on a ` +
      'ground of dark maroon matte veined living skin. Every one has the same base: a squat stalk of ' +
      `${BODY}, with root-like tendons gripping the ground. Each has ONE different accent: (1) long ivory bone ` +
      'harpoons; (2) swollen acid yellow-green glands venting a little vapour; (3) a wide toothed mouth in dark ' +
      'wine red; (4) pale blue-white nerve cords with a faint electric glow; (5) glassy translucent webs of ' +
      'mucus; (6) clusters of pink eggs. They read as parts of one body, lighter and wetter than the dark ground. ' +
      `${STRAIGHT}` },
  'city-blocks': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `Architecture design sheet on a plain pale background. ${ISO} Four separate city blocks of an insect ` +
      'civilisation, each a chunky flat-topped terrace with a usable flat roof, built of pale grey-cream wasp ' +
      'paper, wax and dried clay with hexagonal cells, ribbed arches and amber-lit round doorways: (1) a ' +
      'residential warren: dense small homes, washing lines, tiny gardens; (2) a research quarter: glass domes, ' +
      'antenna masts, instrument sheds; (3) a provision district: silos, larders, hanging stores; (4) temple ' +
      'heights: a taller stepped shrine with bells. Each block is shown at three heights side by side: one, two ' +
      `and three storeys. ${STRAIGHT}` },
  'ship-directive-desk': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'Photoreal interior, static wide shot, no people. The directive desk of a small orbital tender belonging to ' +
      'an austere, bureaucratic far-future empire. It looks like a 1950s government laboratory office in space: ' +
      'white enamel wall panels, institutional pale green paint, brushed steel, black bakelite switches, amber ' +
      'indicator lamps, a steel desk with a small round cathode-ray terminal, neat stacks of paper forms, rubber ' +
      'stamps and an ink pad, a pneumatic message tube. One large round porthole shows a green and brown planet ' +
      'far below. No decoration anywhere except one plain framed seal. Flat fluorescent light. Clean, sterile, ' +
      'quiet, slightly worn. No readable text.' },
  'poster': { w: 1024, h: 1536, quality: 'medium',
    prompt:
      '1950s pest-control advertisement poster, cheerful mid-century commercial illustration. Limited palette of ' +
      'khaki, cream, black and one bright red. A smiling uniformed technician in a plain black and white uniform ' +
      'gives a thumbs up beside a friendly round red blob mascot with a big grin. Tiny cartoon bugs with hats and ' +
      'briefcases run away at the bottom. Large headline lettering at the top reads "XENOFAUNA CLEARANCE". A ' +
      'smaller line at the bottom reads "A CLEAN WORLD IS A HUMAN WORLD". Halftone print texture, slightly ' +
      'misregistered ink, paper creases.' },
  'break-doorway': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      'A quiet documentary photograph, natural light, no stylisation. The doorway of a small home built of pale ' +
      'wasp paper and wax in an insect city. An adult insect stands upright in the round doorway holding the hand ' +
      'of a small child insect who carries a toy. Both look up and away at a column of dark smoke rising beyond ' +
      `the rooftops. Washing hangs on a line. They have ${COLONY}; the adult wears a plain apron. Eye-level ` +
      'camera, shallow depth of field. Calm, ordinary, unposed. No text.' },
};

// Round five (Collins, Sep 29 2026): "I would focus on trying to spec actual game units rather
// than in the abstract"; "both forces look too monstrous and so you don't get good contrast … I
// can see it working for the architecture of insects and their dress style (at least the warrior
// caste): think eastern orthodox"; of the hero: "we usually only see him from behind because he
// is our character". Unit sheets are built from tools/art/units.mjs, one figure per real unit,
// in the style of the sheet he called "the closest I have seen for units".
const UNIT_STYLE_REF = 'r4-units-rts-science-royal.png';
// NO REAL RELIGIOUS SYMBOL, EVER. Round five drew Christian crosses on every helmet, and a
// "six-pointed star" asked for in their place came out as a Star of David. This is a game about
// exterminating these people: they carry an invented emblem, a plain gold hexagon (a honeycomb cell).
const EMBLEM =
  'Their one emblem is a small plain gold hexagon, the shape of a honeycomb cell. There are no crosses, no ' +
  'stars and no crescents anywhere in the picture';
const ORTHODOX =
  'Eastern Orthodox in style: thick white-washed walls, round arches, small gold and deep blue onion domes, ' +
  `bands of painted tile and tiny arched windows lit amber. On top of every dome is a plain gold ball. ${EMBLEM}`;
const FIX =
  'Redraw the reference picture exactly: the same figures in the same places, the same poses, the same ' +
  'drawing style, the same plain background. Change only what is listed here. Every cross, wherever it ' +
  'appears (on helmets, crowns, bells, banners, robes, shells), becomes a small plain gold hexagon, the shape ' +
  'of a honeycomb cell. There must be no crosses, no stars and no crescents anywhere.';
for (const s of SHEETS) {
  const figures = [
    ...s.kinds.map((k) => { const u = unit(k); return `${u.name.toUpperCase()}: ${u.look}`; }),
    ...(s.extra || []).map((e) => e.look),
  ];
  JOBS[`r5-${s.slug}`] = { w: 1536, h: 1024, quality: 'medium', ref: UNIT_STYLE_REF,
    prompt:
      'In exactly the same drawing style as the reference picture: the same rendering, the same chunky ' +
      'proportions with big heads, the same amount of detail, the same plain grey background with a soft shadow ' +
      `under each figure. ${figures.length} unit sprites for the map of a strategy game. ${ISO} Each figure stands ` +
      'apart from the others, all facing the lower left. They belong to an insect civilisation whose dress ' +
      'and ornament are Eastern Orthodox: kaftans, gold braid, pointed dome helmets, bronze bells, censers, ' +
      `veils. ${EMBLEM}. They are charming rather than frightening: round heads, big amber eyes, small mandibles, no bare ` +
      'claws and no spikes; dressed little people with dark umber shells. Draw exactly these figures, in ' +
      `this order, left to right and top to bottom: ${figures.map((f, i) => `(${i + 1}) ${f}`).join('; ')}. ` +
      `Relative sizes: ${s.kinds.map((k) => `${unit(k).name} ${unit(k).r}`).join(', ')}. No text, no labels, no numbers.` };
}
// Round six: the round-five pictures with the emblem corrected and each sheet's faults fixed.
const FIXES = {
  'units-1-first-waves': 'The pack of hatchlings becomes five hatchlings, each with a dab of orange paint on its back.',
  'units-2-army': 'The horned guardsman loses the second helmet behind his shoulder; he has one helmet, on his head.',
  'units-3-siege': 'The running figure with the smoking censer wears an ORANGE coat, not a dark green one.',
  'units-4-last': 'The painted panels of the shield wall show saints who are INSECTS: upright figures with insect heads and antennae, in robes, never humans. The digger with the head lamp wears an orange cloth, not a blue one.',
  'units-5-science': 'The small figure standing beside the beetle holds a clipboard, not a censer.',
  'units-6-royal': '',
};
for (const [slug, extra] of Object.entries(FIXES)) {
  JOBS[`r6-${slug}`] = { w: 1536, h: 1024, quality: 'medium', ref: `r5-${slug}.png`, prompt: `${FIX} ${extra} No text, no labels.` };
}
// Second pass on the two sheets where crosses survived the first one. Naming WHERE they are works
// better than "everywhere".
JOBS['r7-units-2-army'] = { w: 1536, h: 1024, quality: 'medium', ref: 'r6-units-2-army.png',
  prompt: 'Redraw the reference picture exactly: the same five figures in the same places, poses and style. Change ' +
    'only this: the horned guardsman at the top left holds an axe whose handle ends in a small gold cross; ' +
    'replace that with a plain gold ball. There must be no crosses anywhere. No text, no labels.' };
JOBS['r7-units-3-siege'] = { w: 1536, h: 1024, quality: 'medium', ref: 'r6-units-3-siege.png',
  prompt: 'Redraw the reference picture exactly: the same six figures in the same places, poses and style. Change ' +
    'only this: five of the helmets have a small gold cross on top (the crewman on the mortar at the top ' +
    'right, the two crewmen beside the cannon at the bottom left, the veiled moth in the middle, and the ' +
    'crewman covering his ears at the bottom right). Replace each of those crosses with a plain gold ball. ' +
    'There must be no crosses anywhere. No text, no labels.' };
Object.assign(JOBS, {
  'r6-city-orthodox-blocks': { w: 1536, h: 1024, quality: 'medium', ref: 'r5-city-orthodox-blocks.png',
    prompt:
      'Redraw the reference picture exactly: the same sixteen buildings in the same places, the same style, the ' +
      'same plain background. Change only this: every star on top of a dome or tower becomes a plain gold ' +
      'ball. There must be no stars, no crosses and no crescents anywhere. No text.' },
  'r6-board-orthodox': { w: 1536, h: 1024, quality: 'medium', ref: 'r5-board-orthodox.png',
    prompt:
      'Redraw the reference picture exactly: the same city, the same street, the same dark red living skin and ' +
      'the same three organisms on the right. Change only these things. Every star or cross on top of a dome ' +
      'becomes a plain gold ball; there must be no stars, no crosses and no crescents anywhere. The cannon on ' +
      'wheels becomes a large beetle walking on six legs whose abdomen is an ornate bronze cannon barrel, with ' +
      'its two small crew walking beside it. No text, no interface.' },
  'r5-city-orthodox-blocks': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `Architecture design sheet on a plain pale background. ${ISO} Four separate city blocks of an insect ` +
      `civilisation, built at insect scale, ${ORTHODOX}. Each block is a chunky building with a wide FLAT roof ` +
      'terrace in the middle, ringed by a low parapet, with its small domes only at the corners, so that ' +
      'something large could stand on the terrace: (1) a residential block: dense small homes, washing lines; ' +
      '(2) a research quarter: glass domes and brass instruments among the onion domes; (3) a provision ' +
      'district: granary towers with tented roofs; (4) temple heights: a taller block with a bell tower and ' +
      'one large gold dome. Each block is shown at three heights side by side: one, two and three storeys. ' +
      `Clean, ordered and beautiful. ${STRAIGHT}` },
  'r5-board-orthodox': { w: 1536, h: 1024, quality: 'medium', ref: 'r4-units-rts-on-board.png',
    prompt:
      'Redraw the reference picture. Keep its right half exactly as it is: the dark red veined living skin on ' +
      'the rooftops and the three rooted organisms of pink wet flesh, dark chitin and ivory bone. Replace the ' +
      `city with one that is ${ORTHODOX}: clean, ordered and beautiful, with flat roof terraces and pale stone ` +
      'streets. Replace the army in the street with small dressed insect people who are charming rather than ' +
      'frightening: a squad of soldiers in long orange kaftans and pointed dome helmets carrying long axes, a ' +
      'bell-ringer with a yoke of bronze bells, a beetle carrying an ornate bronze cannon with two small crew, ' +
      'and two winged lancers overhead with orange pennants. The city and its people look civilised; the ' +
      `organism looks monstrous; the contrast between them is the point of the picture. ${ISO} No text, no interface.` },
  'r5-hero-behind-desk': { w: 1536, h: 1024, quality: 'medium',
    prompt:
      `${REAL} Seen from directly behind, so that we never see his face: ${HERO}, standing at the workstation in ` +
      `the operations room of a small orbital vessel belonging to ${EMPIRE}. Seamless matte black composite and ` +
      'bare pale ceramic, exact edges, even white light, one small plain black gear symbol on the wall, a long ' +
      'window slit ahead of him showing the curve of a green and brown planet, razor-thin holographic readouts ' +
      'above the desk. Along the back edge of the desk is a neat row of small things he made himself from ' +
      'spare parts: a gear puzzle, a tiny wire insect, a cup with cooling fins, a palm-sized orrery. We see ' +
      'the back of his untidy hair, the stylus behind his ear and his pushed-up sleeves. No readable text.' },
  'r5-hero-yoke-over-shoulder': { w: 1536, h: 1024, quality: 'medium', ref: 'r4-yoke-colour.png',
    prompt:
      'An over-the-shoulder view. In the near foreground on the left, seen from behind and slightly out of ' +
      'focus, are the shoulder and the back of the head of a young man with short untidy dark hair, a stylus ' +
      'behind his ear, in a plain black high-collared garment: we never see his face. Beyond him, facing us, ' +
      'floating above a matte black desk, is the holographic projection from the reference picture: the same ' +
      'anime girl, the same long pale silver hair, amber eyes, black high-collared dress and black gear hair ' +
      'clip, shown from the waist up, drawn in anime style, slightly translucent. She is mid-sentence, ' +
      'attentive, one hand raised. The room around them is photoreal and austere: seamless matte black ' +
      'panels, one thin white light strip. No readable text.' },
});

// A fresh draw of the city sheet with the corrected emblem wording (the edit pass left a few crosses).
JOBS['r7-city-orthodox-blocks'] = { ...JOBS['r5-city-orthodox-blocks'] };

// Round eight (Collins, Sep 29 2026). Units: "a lot of these are great … but remember this is a
// 21st century civilisation on the edge of AI; if they have melee weapons they are closer to power
// blades and stuff, and many would likely have short range guns"; "the science caste would be
// distinctively less orthodox in tone". Buildings: "a total bust … too many blue domes for one, too
// human looking; I expected you to merge the style with their distinct architecture
// [r4-units-rts-on-board.png] and more tech, remember again 21st century civ".
// (The unit looks in units.mjs are now version 2, so the round-five prompts above no longer read
// as they did when their pictures were made.)
const CENTURY =
  'This is a civilisation of the 21st century, on the edge of inventing artificial intelligence';
for (const s of SHEETS) {
  const figures = [
    ...s.kinds.map((k) => { const u = unit(k); return `${u.name.toUpperCase()}: ${u.look}`; }),
    ...(s.extra || []).map((e) => e.look),
  ];
  const science = s.slug.includes('science')
    ? 'This is the science caste, which is secular and modern and NOT religious in dress: no dome helmets, no ' +
      'robes; lab coats, badges, goggles and tablets. '
    : '';
  JOBS[s.slug.replace('units-', 'units-v2-')] = { w: 1536, h: 1024, quality: 'medium', ref: `${s.slug}.png`,
    prompt:
      'Redraw the reference picture: the same figures in the same places, the same drawing style, the same ' +
      'chunky proportions with big heads, the same plain grey background with a soft shadow under each figure, ' +
      `and the same dress. Change their weapons and kit. ${CENTURY}: they carry short guns and power blades ` +
      'with glowing edges, radios, headsets, goggles and electric lamps. Nobody carries a spear, a pike, a ' +
      `plain axe, a sword or a candle lantern. They stay charming rather than frightening. ${science}${EMBLEM}. ` +
      `The figures, in the same order as in the reference, left to right and top to bottom: ${figures.map((f, i) => `(${i + 1}) ${f}`).join('; ')}. ` +
      'No text, no labels, no numbers.' };
}
// Fix passes on round eight: crosses came back on two helmets and a medic's pack, and the thief
// (who never fights) was given a pistol. Each names WHERE the fault is.
const KEEP = 'Redraw the reference picture exactly: the same figures in the same places, poses, weapons and style. Change only this: ';
JOBS['fix-units-v2-2-army'] = { w: 1536, h: 1024, quality: 'medium', ref: 'units-v2-2-army.png',
  prompt: `${KEEP}two helmets have a small gold cross-shaped badge on the brow, above the eyes: the horned ` +
    'guardsman at the top left, and the winged trooper caught in the web at the bottom right. Replace each ' +
    'badge with a small plain gold hexagon. There must be no crosses anywhere. No text, no labels.' };
JOBS['fix-units-v2-4-last'] = { w: 1536, h: 1024, quality: 'medium', ref: 'units-v2-4-last.png',
  prompt: `${KEEP}the nurse in the white veil at the top right carries a medical backpack with a glowing plus ` +
    'sign on it. Replace the plus sign with a small plain glowing hexagon. There must be no crosses and no ' +
    'plus signs anywhere. No text, no labels.' };
JOBS['fix2-units-v2-4-last'] = { w: 1536, h: 1024, quality: 'medium', ref: 'fix-units-v2-4-last.png',
  prompt: `${KEEP}on the backpack of the nurse in the white veil, at the top right, there is a small round ` +
    'glowing white light with a plus sign inside it. Make it a plain round glowing white light with nothing ' +
    'inside it: no plus sign, no cross, no symbol. No text, no labels.' };
JOBS['fix-units-v2-5-science'] = { w: 1536, h: 1024, quality: 'medium', ref: 'units-v2-5-science.png',
  prompt: `${KEEP}the small hunched figure in the dark hooded sweatshirt, second from the left in the top row, ` +
    'holds a pistol. Remove the pistol: it clutches the strap of its duffel bag with both hands instead. It ' +
    'carries no weapon at all. No text, no labels.' };

const HIVE =
  'the architecture of an insect civilisation, unmistakably THEIR OWN and not human: grown and built from pale ' +
  'wasp paper, wax and resin, with walls of honeycomb cells, ribbed organic arches, round cell doorways and ' +
  'layered paper shells, exactly like the buildings in the reference picture';
const HIVE_ORTHODOX =
  'Merged into it is an Eastern Orthodox sacred style: some roofs swell into onion domes made of layered wasp ' +
  'paper, like hanging nests, a few of them gilded; arcades of round arches; bands of gold and coloured ' +
  'mosaic pressed into the wax; bell towers like nest spires. The colours are pale cream paper, honey-amber ' +
  `wax and gold. Blue appears only as small accents in the mosaic bands: there are NO blue domes. ${EMBLEM}`;
const TECH_CITY =
  `${CENTURY}, and the city shows it: solar panels, satellite dishes, radio masts, air-conditioning units, ` +
  'cables strung between buildings, electric street lamps, glowing screens and signs that show only abstract ' +
  'glyphs, traffic lights, and small parked cars shaped like beetles';
const ARMY_V2 =
  'small dressed insect people who are charming rather than frightening: a squad of soldiers in long orange ' +
  'kaftans, dark armoured vests and pointed dome helmets carrying short carbines, a bell-ringer with a yoke ' +
  'of bronze bells and loudspeakers, a large beetle whose abdomen is a modern artillery barrel with two small ' +
  'crew walking beside it, and two winged troopers overhead with carbines and orange pennants';
Object.assign(JOBS, {
  'city-hive-blocks': { w: 1536, h: 1024, quality: 'medium', ref: 'r4-units-rts-on-board.png',
    prompt:
      `Architecture design sheet on a plain pale background. ${ISO} Four separate city blocks in ${HIVE}. ` +
      `${HIVE_ORTHODOX}. ${TECH_CITY}. Each block is a chunky building with a wide FLAT roof terrace in the ` +
      'middle, ringed by a low parapet, with any domes and masts kept to the corners and edges, so that ' +
      'something large could stand on the terrace: (1) a residential block: stacked apartment cells with ' +
      'balconies, washing lines and satellite dishes; (2) a research quarter: glass domes, a server hall with ' +
      'rows of cooling fans, an antenna array; (3) a provision district: honey-pot silos, a loading dock and ' +
      'delivery trucks shaped like beetles; (4) temple heights: a taller block with a nest-spire bell tower ' +
      'and one gilded paper dome. Each block is shown at three heights side by side: one, two and three ' +
      `storeys. ${STRAIGHT}` },
  'board-hive-a': { w: 1536, h: 1024, quality: 'medium', ref: 'r4-units-rts-on-board.png',
    prompt:
      'Redraw the reference picture. Keep its right half exactly as it is: the dark red veined living skin on ' +
      'the rooftops and the three rooted organisms of pink wet flesh, dark chitin and ivory bone. Keep the ' +
      "city's own architecture of pale wasp paper and honeycomb cells, and make it a living modern city. " +
      `${HIVE_ORTHODOX}, used here as ACCENTS on a city that is mostly paper and honeycomb. ${TECH_CITY}. ` +
      `Replace the army in the street with ${ARMY_V2}. The city and its people look civilised; the organism ` +
      `looks monstrous; the contrast between them is the point of the picture. ${ISO} No text, no interface.` },
  'board-hive-b': { w: 1536, h: 1024, quality: 'medium', ref: 'r4-units-rts-on-board.png',
    prompt:
      'Redraw the reference picture. Keep its right half exactly as it is: the dark red veined living skin on ' +
      'the rooftops and the three rooted organisms of pink wet flesh, dark chitin and ivory bone. Keep the ' +
      "city's own architecture of pale wasp paper and honeycomb cells, and make it a rich, devout modern city. " +
      `${HIVE_ORTHODOX}, used here GENEROUSLY: gilded paper domes on many roofs, mosaic bands on every wall. ` +
      `${TECH_CITY}. Replace the army in the street with ${ARMY_V2}. The city and its people look civilised; ` +
      `the organism looks monstrous; the contrast between them is the point of the picture. ${ISO} No text, no interface.` },
  'city-hive-block-close': { w: 1536, h: 1024, quality: 'medium', ref: 'r4-units-rts-on-board.png',
    prompt:
      `${ISO} A close view of ONE city block, three storeys high, in ${HIVE}. ${HIVE_ORTHODOX}. ${TECH_CITY}. ` +
      'The block has a wide flat roof terrace ringed by a low parapet. On the terrace stands one rooted ' +
      'organism of glistening pink wet muscle, dark chitin and ivory bone, like the ones in the reference ' +
      'picture, and a dark red veined living skin has spread across the roof and begun to run down the walls ' +
      'over the honeycomb cells, the mosaic and an air-conditioning unit. Below, in the pale street, a few ' +
      'small dressed insect people look up at it; one is filming it on a phone. Realistic, detailed, overcast ' +
      'daylight. No text, no interface.' },
});

ready();
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const slugs = want.length ? want : Object.keys(JOBS);
// A reference is an earlier concept: the published picture, or its raw still when the picture was
// withdrawn from the repo (art-src/ is not committed).
const refPath = (name) => {
  const pub = path.join(OUT, name);
  return fs.existsSync(pub) ? pub : path.join(ROOT, 'art-src', 'probes', `concept-${name.replace(/.png$/, '')}-still.png`);
};
const results = await Promise.allSettled(slugs.map(async (slug) => {
  const j = JOBS[slug];
  if (!j) throw new Error(`unknown concept "${slug}" (have: ${Object.keys(JOBS).join(', ')})`);
  const file = await makeStill({ slug: `concept-${slug}`, prompt: j.prompt, key: null, width: j.w, height: j.h, quality: j.quality,
    refFile: j.ref ? refPath(j.ref) : undefined });
  const out = path.join(OUT, `${slug}.png`);
  fs.copyFileSync(file, out);
  return out;
}));
results.forEach((r, i) => console.log(r.status === 'fulfilled' ? `OK   ${r.value}` : `FAIL ${slugs[i]}: ${r.reason.message}`));
process.exit(results.some((r) => r.status === 'rejected') ? 1 : 0);
