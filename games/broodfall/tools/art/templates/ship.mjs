/**
 * THE SHIP TEMPLATE: everything the ship's screens show.
 *
 *   rooms      one photoreal backdrop per room, the character seen from behind
 *   yoke       the AI's six faces, cut from the sheet Collins approved
 *   planet     the map of the planet, for the holographic globe the game draws
 *   sketches   the character's own drawings, for his hobby notebook
 *   leaders    the three faction leaders, as 1950s film stills
 *   scenes     one film still for every faction scene (contact, each beat, each ending)
 *   exterior   the ship in orbit, for the title screen
 *   territories one establishing shot of every territory, the header of its briefing
 *
 *   node tools/art/make.mjs ship                 everything
 *   node tools/art/make.mjs ship rooms planet    some of it
 *   node tools/art/make.mjs ship scenes          every scene picture that is not on disk yet
 *   node tools/art/make.mjs ship territories     every territory picture that is not on disk yet (or name ids)
 *   node tools/art/make.mjs ship faithful-contact institute-ending     scene pictures by id
 *   node tools/art/make.mjs ship --bake          bake again from the pictures on disk (free)
 *
 * To draw a scene picture again, MOVE art-src/ship/scenes/<id>.png into art-src/ship/scenes/v1/
 * first (a picture on disk is never drawn twice, and none is ever deleted).
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool } from '../rfab.mjs';
import { blank, crop, paste, readImage, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { cutGrid } from '../lib/sheet.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';
import { BIOMES, SPECIES } from '../biomes.mjs';

const DIR = path.join(SRC, 'ship');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const REAL = 'Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set.';
const EMPIRE =
  'a far-future, ultra-religious, ascetic human society that despises luxury and decoration, forbids images and ' +
  'idols, and is obsessed with efficiency and ever more advanced technology';
const AUSTERE =
  'Extremely advanced technology and extreme plainness: seamless matte black composite and bare pale ceramic, ' +
  'flush seams, exact edges, perfect order, even white light from flush strips. Nothing soft, nothing ' +
  'ornamental: no pictures, no statues, no patterns, no coloured accent lighting. The only marking anywhere is ' +
  'one small plain black gear symbol (a cogwheel).';
const HERO =
  'a slight young man of about twenty-five with short untidy dark hair, in a plain black high-collared garment ' +
  'with a narrow white collar, its sleeves pushed up to the elbows, a stylus tucked behind one ear';
const BEHIND = `He is seen from directly behind, so that we never see his face: ${HERO}.`;
const ROOM = (what) =>
  `${REAL} A wide view inside a small orbital vessel belonging to ${EMPIRE}. ${AUSTERE} ${what} The middle and ` +
  'the right of the picture are calm, dark and uncluttered. No readable text anywhere.';

const ROOMS = {
  desk: ROOM('A bare dark room for planning. Low in the left third of the picture stands a round black projection plinth, waist high, its top glowing faintly; the air above it is empty and dark. ' + BEHIND + ' He stands in the foreground at the far left edge, looking at the plinth. The room is lit only by the faint glow of the plinth.'),
  genes: ROOM('The culture bay, a clean laboratory. At the far left stands a sealed transparent cylinder of clear fluid in which a round red organic culture the size of a football floats, tended by thin precise robotic arms: the only coloured thing in the room. ' + BEHIND + ' He stands beside it at the left, watching it, a thin tablet in his hand.'),
  locker: ROOM('His own corner of the ship: a specimen locker. At the left, a wall of small flush drawers, a few open, holding sealed glass jars with pale insect specimens and scraps of red tissue. A narrow work shelf holds a neat row of small things he made himself from spare parts: a gear puzzle, a tiny wire insect, a cup with cooling fins, a palm-sized orrery. ' + BEHIND + ' He sits on a plain stool at the left, bent over the shelf, working on something small.'),
  board: ROOM('A bare, formal alcove for official business. At the left, one standing terminal grown seamlessly out of the wall, with a single razor-thin display showing ruled lines of a form. One plain black gear symbol is set in the wall above it. ' + BEHIND + ' He stands at the terminal at the left, straight-backed, hands at his sides.'),
  comms: ROOM('The communications alcove. At the left, a bank of three razor-thin displays showing soft static and signal traces in white, and a plain ribbed antenna coupling in the ceiling. A long window slit shows the curve of a green and brown planet. ' + BEHIND + ' He sits at the left on a hard bench facing the displays, one hand on a dial.'),
  ai: ROOM('The core of the ship\'s artificial intelligence. At the left, a low black projection dais with a ring of faint white light on its top; the air above it is empty. Behind it, rows of plain black processing columns recede into the dark. ' + BEHIND + ' He stands at the far left edge, relaxed, one hand in a pocket, facing the dais.'),
};

const PLANET =
  'A map of a whole planet in equirectangular projection, filling the picture edge to edge with no border: the ' +
  'left and right edges are the same meridian. An Earth-like world seen from orbit with no clouds: several ' +
  'irregular continents of green lowland, brown upland and pale desert, with mountain ranges, river valleys and ' +
  'coastlines in fine relief, set in dark blue seas, with small white ice caps along the top and bottom edges. ' +
  'No text, no labels, no grid lines, no borders drawn on it.';

const EXTERIOR =
  `${REAL} A small orbital vessel in orbit above a green and brown planet at the edge of night, seen from a ` +
  `distance. It belongs to ${EMPIRE}. A plain pale cylinder standing upright with one slowly rotating ring around ` +
  'its middle and two broad flat black panels. Bare pale ceramic and matte black, flush seamless panels, no ' +
  'ornament, no lit windows, one plain black gear symbol (a cogwheel) on the hull. Sunlight rakes across it; city ' +
  'lights glow faintly on the dark side of the planet below. The ship is in the right half of the picture; the ' +
  'left half is dark space and the curve of the planet. No readable text.';

const PEOPLE =
  'an insect person like those of a 1950s science-fiction film: human posture and body language, four arms with ' +
  'small hands, an insect head with large expressive eyes, small mandibles like a mouth and antennae that move ' +
  'like eyebrows, dark umber chitin and pale amber eyes instead of skin';
const FILM = 'A waist-up film still from a 1950s colour science-fiction film: saturated Technicolor, theatrical lighting, film grain, the slight softness of old lenses. No readable text, no crosses, no stars, no crescents.';
const LEADERS = {
  delegation: `${FILM} The chief of a peace delegation: ${PEOPLE}; elderly, beaming with serene joy, in a cardigan and a flower garland, hands clasped, in a soft pastel meeting room.`,
  faithful: `${FILM} A radio preacher: ${PEOPLE}; stern and ecstatic, in dark robes, leaning into a big ribbon microphone in a broadcasting booth, a red lamp glowing beside him.`,
  institute: `${FILM} A young prodigy: ${PEOPLE}; smug and distracted, messy antennae, in a wrinkled t-shirt, slouched in a beanbag chair holding a game controller, a blackboard of equations and empty takeaway boxes behind him.`,
};

/**
 * THE SCENE PICTURES: one film still for every faction scene, so that a scene card shows
 * what is happening in it and not the same portrait every time.
 *
 * id = <faction>-<scene>, the `picture` of the scene in content/campaign.ts:
 *   <faction>-contact, <faction>-<beat id>, <faction>-ending, institute-ending-pacify.
 *
 * Why each prompt is in three parts:
 *   what   the situation of the scene, which is the joke. The picture shows HOW the faction
 *          reaches a man in orbit (a letter spelled out in a field, forty radio stations, a
 *          video call through a dish), because nobody can hand him anything.
 *   none   WHERE there must be no lettering and no symbol. The image model adds both by
 *          itself, and "none anywhere" does not stop it; naming the place does
 *          (assets/style-bible.md, "NO REAL RELIGIOUS SYMBOL").
 *   who    the leader, drawn from his own portrait, so that he is the same person in every
 *          picture of his faction.
 * `creature`: the red tendrils are in it (a second reference picture shows them).
 * `alone`: he is the only person in it; the sentence about the crowd is left out, because it
 *          asks for one (the first last congress had every chair taken).
 */
const CROWD =
  'insect people like those of a 1950s science-fiction film: human posture and body language, two legs, four ' +
  'arms with small hands, an insect head with large expressive eyes, small mandibles like a mouth and antennae ' +
  'that move like eyebrows, dark umber chitin and pale amber eyes instead of skin';
const STILL =
  'A wide film still from a 1950s colour science-fiction horror B-movie: lurid saturated Technicolor, hard ' +
  'theatrical key light with deep shadows, a painted backdrop sky, film grain, the slight softness of old ' +
  'lenses, the sets, props and clothes of the 1950s.';
// The count of arms is said twice: asked for "all four arms raised", the model drew six.
const CAST = `Every person in the picture is one of the ${CROWD}. Each of them has exactly four arms and two legs, never more. There are no human beings anywhere.`;
const CLEAN =
  'Nothing in the picture can be read: no words, no letters of any alphabet, no numerals, no captions, no ' +
  'subtitles, no logos, no watermark, no border. There is no religious or political symbol of any kind: no ' +
  'cross, no plus-shaped sign, no star shape, no crescent.';
const CREATURE = 'thick glistening dark-red gelatinous tendrils of a giant creature, and its dark maroon veined living skin';
/** Each leader as his portrait shows him: said in words as well, because the reference picture alone lets his clothes drift. */
const WHO = {
  delegation:
    'the chief delegate, who is exactly the person in the reference picture: an elderly insect person with heavy-lidded ' +
    'serene amber eyes and long thin antennae, in a blue-grey knitted cardigan over a pale green shirt, with a ' +
    'garland of pink, white and yellow flowers round his neck',
  faithful:
    'the radio preacher, who is exactly the person in the reference picture: an insect person with heavy-lidded ' +
    'amber eyes and long antennae, in wide-sleeved black velvet robes with a small plain white collar and thin ' +
    'brass bracelets',
  institute:
    'the young director, who is exactly the person in the reference picture: a lanky young insect person with ' +
    'messy kinked antennae and half-closed smug amber eyes, in a wrinkled pale grey t-shirt and dark jeans',
};
const SCENES = {
  // ---- The Friendship Delegation: letters, spelled out in a field for the orbital cameras.
  'delegation-contact': {
    what: 'Seen from very high above, looking almost straight down, as photographed by a camera in orbit: a patchwork of farmland, hedgerows, a winding country road and the roofs of a small town at one edge. One huge green meadow in the middle of the picture is packed with thousands of tiny insect people standing shoulder to shoulder, each holding a coloured card over its head (red, yellow, blue, white and pink), so that the crowd forms five neat lines of big ABSTRACT GLYPHS across the grass, like a letter written on a page: loops, hooks, dots, spirals and honeycomb cells of an invented script. The last glyph of the bottom line is unfinished: a thin stream of tiny figures is still walking into place, and one small group has sat down on the grass to rest. Long afternoon shadows. A row of buses shaped like beetles is parked along the road beside the meadow.',
    none: 'The glyphs are invented shapes: they are not letters of any real alphabet and not numerals, and no glyph is a cross, a plus sign, a star or a crescent. There is no lettering on the roofs, the road or the buses.',
  },
  'delegation-understand': {
    leader: true, creature: true,
    what: 'A peace summit laid out in a pastel meeting hall with pink and pale blue curtains: a long table with a white cloth, covered in plates of sandwiches, cakes, a punch bowl and small plain pastel paper flags; at the head of the table one grand empty chair of honour with a flower garland over its back. Through the open double doors and the windows at the far end, ' + CREATURE + ' have poured into the hall and are swallowing the far half of the table, the chairs and a tea trolley. In the foreground stands WHO, beaming with serene joy, hands clasped, entirely unworried; beside him three other delegates in cardigans applaud politely, and one holds out a plate of biscuits to the nearest tendril.',
    none: 'The small paper flags are plain pastel paper with nothing on them. There is no banner in the hall. The place cards on the table are blank.',
  },
  'delegation-stop-war': {
    leader: true,
    what: 'A grassy hilltop in bright daylight. A dozen peace campaigners in cardigans and sun hats hold a huge stolen military map flat like a picnic blanket, face up to the sky, stretched between them by its edges so that it can be seen from above. The map shows painted coastlines and hills with big red and blue arrows and small tank-shaped markers. In the middle of the map stands WHO, beaming, pointing straight up at the sky with one hand and at the biggest arrow with a long wooden pointer held in another. Far away in the valley behind them, rows of army tents and tanks, and a few tiny generals who have noticed nothing.',
    none: 'The map carries coastlines, arrows and markers only: no place names, no words, no numerals, no compass rose. The tanks and tents carry no star and no insignia. The campaigners carry no banner.',
  },
  'delegation-gaia': {
    leader: true, creature: true,
    what: 'The ruin of a small schoolhouse at dusk, overgrown by ' + CREATURE + ': toppled school desks, a cracked blackboard, a fallen brass hand bell, a bent bicycle. In front of it stands WHO in rapture, beaming, eyes wide with revelation: he has exactly four arms, the upper two flung up to the sky and the lower two spread wide, palms up. Behind him a small crowd of campaigners in cardigans kneels gratefully, holding candles and potted seedlings; one of them hangs a flower garland on a tendril as if on a guest of honour. Toxic green light on the painted sky.',
    none: 'The blackboard is blank. There is no sign over the door of the school and no lettering on its walls. The school is a plain low building: it has no steeple, no tower and nothing on its roof.',
  },
  'delegation-reveal': {
    leader: true,
    what: 'A sunny green meadow. In the foreground a small round tea table with a white cloth has been set out on the grass, and WHO sits at it in a garden chair, pouring tea from a flowered teapot into a cup, smiling contentedly down at the tea and not looking up at all. On the table, facing him, stands a large 1950s wooden radio set with a glowing dial and a long aerial, through which someone far away is speaking to him. Beside him two younger campaigners in cardigans have frozen in shock, one of them dropping a plate of biscuits; he alone is perfectly calm. Behind them, filling the meadow to the hedge, a great crowd of members stands in rows holding coloured cards over their heads (red, yellow, blue, white and pink), waiting.',
    none: 'The dial of the radio set has a needle and no numerals, and the set has no maker\'s name. The coloured cards are plain, with nothing written on them. There is no banner and no sign in the meadow, and no lettering on the tea things.',
  },
  'delegation-hurry': {
    leader: true,
    what: 'A wide green meadow seen from the platform of a tall wooden scaffold tower. On the platform, in the foreground, stands WHO with a megaphone in one hand and a long wooden pointer in another, beaming with pride, directing the crowd below. Below and beyond him, thousands of members standing shoulder to shoulder hold coloured cards over their heads, so that the whole crowd forms one huge project schedule on the grass: long rows of coloured bars (red, yellow, green and blue), each row shorter than the one before, stepping down like a staircase to one last short black bar. At the foot of the tower a secretary hands out boxes of coloured cards from a trestle table beside a tea urn.',
    none: 'The schedule is coloured bars only: no words, no letters, no numerals and no dates anywhere in the meadow. The megaphone is plain metal. There is no banner and no flag on the tower.',
  },
  'delegation-ending': {
    leader: true, alone: true,
    what: 'A vast assembly hall at night, seen from beside the podium. In the foreground at the right, large in the picture, stands WHO behind a plain wooden podium, with a wooden gavel in one hand and an open ledger in front of him, serene and smiling, another hand reaching for a big brass light switch on the wall beside him. Beyond him the hall stretches away: hundreds of folding chairs set out in perfect rows, and EVERY CHAIR IS EMPTY. Nobody sits in the hall, nobody stands in it: he is the only person in the whole picture. A forgotten hat lies on one chair and a garland of flowers on another. Dust hangs in the air; half of the hanging lamps are already dark. Outside the tall windows along the far wall, thick glistening dark-red gelatinous tendrils press quietly against the glass.',
    none: 'The long cloth banners hanging in the hall are plain pastel cloth with nothing on them. The front of the podium is plain wood with no emblem. The pages of the ledger are seen too small to read.',
  },
  // ---- The Faithful of the Last Hour: forty radio stations.
  'faithful-contact': {
    leader: true,
    what: 'A 1950s radio station at night, seen through the big glass window of its control room. In the foreground, seen from behind, a sound engineer in shirt sleeves and headphones sits at a console of big dials, needles and glowing valves. Beyond the glass, in the padded studio, stands WHO at a big chrome ribbon microphone, head thrown back, one hand pointing straight up at the ceiling, the others spread wide, in the middle of a sermon. A red lamp glows over the studio door. On the studio wall hangs one plain gold hexagon. Through a side window, a tall lattice radio mast with a blinking red light sends painted rings of radio waves up into the night sky.',
    none: 'The red lamp is a plain lamp with no words on it. The microphone has no call letters and no name plate. The dials have needles and no numerals. The radio mast is a plain tapering lattice tower with no cross-arm: it must not look like a cross. The only emblem anywhere is the plain gold hexagon.',
  },
  'faithful-signs': {
    leader: true,
    what: 'The radio studio in the small hours of the night. WHO sits at the chrome ribbon microphone reading aloud from an enormous, absurdly thick old book that lies open on a lectern in front of him, one finger raised in instruction, stern; the book is as thick as a suitcase. Round him stand towers of more thick leather volumes and heaps of pamphlets, as high as the ceiling. Behind the control-room glass the sound engineer has fallen asleep with his head on the console. A red lamp glows. One plain gold hexagon on the wall.',
    none: 'The pages of the open book are seen too small to read: fine grey lines only. The spines and covers of the books are plain leather with no lettering and no emblem. The pamphlets are blank. The wall clock has plain tick marks and no numerals.',
  },
  'faithful-prophecy': {
    leader: true, creature: true,
    what: 'A riverside at night. The river runs with fire: flames dance along the whole surface of the water, and ' + CREATURE + ' climb the far bank, where the terraces of a hillside town stand dark and silent. On the near bank stands WHO on the roof of a 1950s outside-broadcast van, preaching into a microphone on a stand, one arm flung out toward the burning river in triumph, his robes flying. Below him a crowd of the faithful in 1950s Sunday clothes and hats kneels, each holding a portable radio to the side of the head. One plain gold hexagon on a pole.',
    none: 'The side of the van is plain paint with no lettering and no call sign. The roofs, domes and spires of the town end in plain gold balls: there is no cross on any of them. The pole carries the gold hexagon and nothing else.',
  },
  'faithful-prepare': {
    leader: true,
    what: 'A hilltop at dawn. A crowd of the faithful in 1950s Sunday clothes, hats and gloves stands waiting with packed suitcases, folding chairs and portable radios, all of them looking up at the empty sky; a child looks up through a toy telescope. In front of them stands WHO at a microphone beside a big wall calendar on an easel: a plain grid of empty squares on which one square after another has been ringed in red and then struck out with a single slanting stroke; he points with complete confidence at one fresh red ring. On the horizon a gleaming city of pale domes stands on a hill under a painted pink sky.',
    none: 'The calendar is a grid of empty squares with red rings and single slanting strokes only: no numerals, no names of months, no words. The domes of the city end in plain gold balls: no cross on any of them. The suitcases have no labels.',
  },
  // The picture that is kept was drawn before the loudspeaker was described as plain: it came out as a spoked
  // wheel on his chest, which is the emblem of a real faith. A plain disc of mesh was painted over it by hand
  // (at 581,311, radius 19, of the 1536 px picture); the picture as it was is art-src/ship/scenes/faithful-ending.orig.png.
  // Look at his chest again after any redraw.
  'faithful-ending': {
    leader: true,
    what: 'A revival stage under theatre lights, with gold curtains. In the middle of the stage stands the Awaited One: a tall, stiff, plainly home-made figure of an insect person, stitched together from mismatched pieces with thick visible seams, stuffing showing at one elbow, in a plain white robe, one arm raised in an awkward stiff wave, a small plain round loudspeaker set in its chest (a plain disc of fine brass mesh, with no spokes and no pattern on it), its glass eyes looking in slightly different directions; a thin cable runs from its back into the wings. Beside it WHO has fallen to his knees at his microphone, weeping with joy, arms spread wide. In front of the stage a great crowd of the faithful raise their hands in ecstasy. One plain gold hexagon hangs above the stage.',
    none: 'There is no halo and no cross on or behind the figure, on its robe, on the curtains or above the stage: the plain gold hexagon is the only emblem. There is no banner with words.',
  },
  // ---- The Institute for Long-Term Hive Flourishing: a video call through their own dish.
  'institute-contact': {
    leader: true,
    what: 'A messy research office at night, with a blackboard and takeaway boxes. WHO is slouched in a blue beanbag chair with a telephone operator\'s headset on his head, in the middle of a video game: he holds a game controller in two hands and stares sideways at a glowing television set full of coloured shapes, while with a third hand he waves a lazy hello toward a big 1950s television camera on a tripod that is pointed at him, and a fourth hand holds a can of soda. A thick cable runs from the camera out through the window to a huge white dish aerial on the lawn outside, aimed up at the night sky. Behind him two junior researchers in lab coats hold up a thick stapled report and a chart of coloured bars, trying to get into the picture.',
    none: 'The blackboard shows chalk curves and one simple graph only: no writing, no equations, no numerals. The chart is coloured bars with no labels. The cover of the report is blank. The takeaway boxes are plain white card with no print. The can is plain metal. The television set shows coloured shapes only: no score and no words.',
  },
  'institute-machines': {
    leader: true,
    what: 'A cryogenics laboratory with white tiles and frost in the air. A row of upright glass capsules, frosted over, each with a peacefully sleeping insect person dimly seen inside, in a plain pale blue nightshirt, a knitted nightcap with a bobble and a sleeping mask, some hugging a hot-water bottle. Laboratory assistants in white coats wheel one capsule on a hand trolley up a ramp into the back of a refrigerated delivery lorry parked at the loading door, where more capsules are already stacked like milk bottles in a crate. In the foreground at the left stands WHO, smug and pleased, looking at us. He has exactly four arms, two on each side and no more: his two upper hands hold a clipboard and a pencil, ticking it off, and his two lower hands hold a game controller at his waist.',
    // Not striped pyjamas: in a lorry they read as prisoners being taken away, which is not the joke.
    none: 'The nightshirts are plain pale blue cloth: no stripes, no numbers, no badges. The side of the lorry is plain paint with no lettering and no emblem. Each capsule has one blank paper tag with nothing written on it. The page on the clipboard is seen too small to read. There is no medical cross and no plus sign anywhere in the laboratory: none on a cabinet, a door, a coat or the lorry.',
  },
  'institute-pipeline': {
    leader: true,
    what: 'A messy research office with a blackboard and takeaway boxes. WHO sits in a blue beanbag chair in front of a big 1950s television camera on a tripod, deeply embarrassed: his antennae droop, one hand covers his eyes, and another hand is already reaching for the game controller as he turns away toward his television set. Behind him, in the open doorway, three elegant ladies in modest 1950s day dresses, hats, gloves and handbags wait politely in a row as if for a job interview, looking at one another in puzzled boredom; one of them checks her wristwatch. A junior researcher in a lab coat holds a clipboard and stares at the floor. Everyone is fully and modestly dressed.',
    none: 'The blackboard shows chalk curves and one simple graph only: no writing, no equations, no numerals. The takeaway boxes are plain white card with no print. The television set shows coloured shapes only. The clipboard is seen too small to read.',
  },
  'institute-ultimatum': {
    leader: true,
    what: 'A lecture room. WHO stands at a big blackboard giving a presentation with total confidence, a wooden pointer in one hand, a piece of chalk in another, a game controller tucked under a third arm. On the blackboard he has drawn in white chalk one simple diagram: a tram on a track that forks into two tracks, a lever at the fork, a crowd of little stick insects standing on the upper track and the same crowd standing on the lower track; both tracks end at the same big drawn mouth full of teeth. In the front row three members of his board in lab coats take notes and nod.',
    none: 'The blackboard carries the chalk drawing only: no words, no letters, no numerals, no equations and no labels beside the drawing. The notebooks are seen too small to read.',
  },
  'institute-ending': {
    leader: true,
    what: 'A grand white hall of chrome and glass. At the far end stands the upload chamber: a tall round gleaming chrome doorway with small blinking lamps round its rim, like the door of a bank vault standing open; but what is inside it is not a machine: it is a dark, wet, red, fleshy throat, glistening, with a faint pink glow. A neat queue of researchers in lab coats walks up a short red carpet between velvet ropes and steps through the doorway one after another, cheerful, each carrying a small suitcase. At the back of the queue, the last in line, in the foreground at the left, stands WHO, giving a speech and very pleased with himself. He has exactly four arms, two on each side and no more: his two upper hands are spread wide, waving the others forward, and his two lower hands hold a long scroll of paper unrolled between them.',
    none: 'There is no sign and no lettering over the doorway or beside it, and no numerals on the lamps. What is written on the scroll is seen too small to read: fine grey lines only. The suitcases have no labels.',
  },
  'institute-ending-pacify': {
    leader: true,
    what: 'A city square at dusk under tall towers of glass. An endless orderly queue of ordinary citizens in 1950s coats and hats, families with children and suitcases, winds calmly between velvet ropes across the square to a big gleaming round chrome doorway on the far side, whose inside glows wet and red. Researchers in lab coats with megaphones and hand-held paddle signs guide them kindly. In the foreground, on a balcony above it all, WHO leans on the rail and counts the queue with a small chrome hand tally counter, smug; on the table beside him are a small cash box and a neat stack of banknotes.',
    none: 'Each paddle sign shows one plain painted arrow and nothing else. There is no lettering over the doorway, on the towers or on the shop fronts, and no neon words. The banknotes are plain green paper seen too small to read. The suitcases have no labels.',
  },
};
export const SCENE_IDS = Object.keys(SCENES);
/** The size a scene picture is baked at (drawn at 1536 x 1024, the same shape). */
const SCENE_SIZE = { w: 640, h: 427 };
const factionOf = (id) => id.slice(0, id.indexOf('-'));
/** The reference pictures of a scene, in the order its prompt speaks of them. */
const sceneRefs = (id) => [
  ...(SCENES[id].leader ? [path.join(DIR, `leader-${factionOf(id)}.png`)] : []),
  ...(SCENES[id].creature ? [path.join(CONCEPTS, 'r2-film-still.png')] : []),
];
const scenePrompt = (id) => {
  const s = SCENES[id];
  // With two reference pictures the model has to be told which is which, or the leader takes on the other's look.
  const who = s.creature ? WHO[factionOf(id)].replace('the reference picture', 'the FIRST reference picture') : WHO[factionOf(id)];
  const creature = s.creature
    ? ' The SECOND reference picture is there only to show what the red tendrils of the creature look like: copy nothing else from it, none of its people, its street or its buildings.'
    : '';
  const cast = s.alone ? 'He is an insect person with exactly four arms and two legs. There is no other person and no human being anywhere in the picture.' : CAST;
  return `${STILL} ${s.what.replace('WHO', who)}${creature} ${cast} ${s.none} ${CLEAN}`;
};

/**
 * THE TERRITORY PICTURES: one establishing shot of every territory of the campaign globe, the
 * header of its briefing. id = the territory's id in content/campaign.ts; each picture tells
 * that territory's `story`.
 *
 * All sixteen are ONE set: the same framing (from high in the air, a whole district to the
 * horizon, as an aircraft coming in to land sees it) and the same treatment as the scene stills
 * (a 1950s colour film opening on a matte painting). Each is built in the look of ITS tile set
 * (tools/art/biomes.mjs, `territories`): the set's review sheet (notes/art-review/biomes/<set>.jpg)
 * goes with it as the reference picture, for its architecture, colours and materials only.
 *   what   what the picture shows: the place, and the story line
 *   none   where there must be no lettering and no symbol (see SCENES)
 *   finale the last place of a faction's war: an endgame sky
 */
const AERIAL =
  'A wide establishing shot from a 1950s colour science-fiction film, the kind that opens on a great matte painting: ' +
  'seen from high in the air at a steep angle, looking down over a whole district of an alien world to the horizon, ' +
  'as the crew of an aircraft coming in to land would see it. Lurid saturated Technicolor, a painted sky, fine ' +
  'painterly detail, film grain, the slight softness of old lenses.';
const TOWNSFOLK =
  'The people in it are tiny figures far below: every one of them is an insect person with four arms, antennae and an ' +
  'insect head, like the people of a 1950s science-fiction film. There are no human beings anywhere.';
const FINALE =
  'This is the last place of the war, and it looks it: an ominous, grand, silent scene under a lurid red and violet ' +
  'sky at dusk, the air hazy with smoke.';
const DOMES = 'Every dome, spire and tower ends in a plain gold ball: there is no cross on any dome, spire, tower or roof.';
const TERRITORIES = {
  'crash-site': {
    what: 'A quiet pastel neighbourhood of family homes, lawns and curving streets. In the middle of the picture, fresh and still smoking, a round crater has been punched into the street, and in the bottom of it lies a split dark meteor with a faint dark-red glow inside. On one side of the crater stands a school with a playground, a slide and a row of big round classroom windows; on the other side a small laundromat with a striped awning and a row of round washing-machine doors seen through its shop window. Beetle-shaped cars are parked along the kerbs; a thin crowd of neighbours in dressing gowns and hats stands at the rim of the crater, staring into it; one thin plume of smoke rises into a calm blue sky.',
    none: 'The school has no sign over its door and nothing on its roof. The laundromat\'s awning and window are plain, with no lettering.',
  },
  'cul-de-sac': {
    what: 'A wealthy suburb at dusk: curving cul-de-sacs ending in round turning circles, big neat lawns, clipped hedges in exact lines, porch lights coming on. On every lawn stand little groups of the neighbourhood watch, in cardigans and hats with torches, folding chairs and a thermos, all peering in the same direction: at the far edge of the suburb, a first thin stain of dark maroon veined living skin is spreading over one lawn toward the hedges. Far on the horizon, a thin plume of smoke.',
    none: 'The mailboxes and the watch\'s armbands are plain colours with nothing on them. There is no sign on any lawn or at the end of any street.',
  },
  granary: {
    what: 'Golden rolling farm country cut into terraces of fields, with rows of great round grain silos of pale wax and paper standing in clusters all the way to the horizon, barns of red-stained paper boards, a windmill. A single small beetle-shaped car drives alone along a long pale dirt road between the fields, toward a thin plume of smoke rising far away on the horizon. Late afternoon light.',
    none: 'The silos, barns and the car are plain, with no lettering and no emblem painted on them.',
  },
  harbor: {
    what: 'An old port town: long docks, cranes, gantries, rows of soot-darkened warehouses, a lighthouse on a breakwater. Out through the harbour mouth, in a long line, a whole fleet of old steamers, trawlers and barges is sailing out to sea, trailing smoke, packed with tiny figures. Behind them, at the far end of the docks, a dark maroon veined living skin has crept over the quays and the first warehouses and is running down into the water.',
    none: 'The ships\' hulls and funnels are plain paint with no names, no numbers and no emblems. The warehouses carry no lettering.',
  },
  commuter: {
    what: 'A colossal knot of highways in the middle of a pastel suburb: ring roads, flyovers and looping ramps stacked in rings, every lane packed bumper to bumper with thousands of tiny beetle-shaped cars in pastel colours, all at a standstill in the evening rush hour, headlights on. Rows of pastel homes and pastel office blocks round it to the horizon.',
    none: 'The road signs over the highways are plain green boards with abstract arrow shapes only: no words, no numerals. There is no lettering on the cars.',
  },
  temple: {
    what: 'A steep hill terraced from its foot to its summit with shrines of pale paper and wax, arcades of round arches, gold mosaic, and onion domes of layered paper like hanging nests, a few gilded. Slender bell towers like nest spires rise from every terrace, their big bronze bells swinging, ringing. Long flights of steps climb between the terraces, crowded with tiny worshippers climbing up. Far off on the plain, a thin plume of smoke.',
    none: `${DOMES} The one emblem on the shrines is a plain gold hexagon. There are no banners with lettering.`,
  },
  foundry: {
    what: 'Flat plains covered to the horizon in foundries and factories of soot-darkened resin brick and riveted iron, a forest of chimneys pouring smoke, furnace light glowing orange in every open door. In the great yards between them stand rows upon rows of freshly made war machines: siege cannons shaped like bombardier beetles, armoured walkers, gun carriages. Long columns of insect soldiers march out of the gates on the roads, in step.',
    none: 'The war machines and the factories carry no lettering, no numbers and no emblem other than hazard stripes.',
  },
  mirewater: {
    what: 'A vast river delta of reed beds, flooded paddies and dark still channels, and villages of woven reed and pale wasp paper on stilts over the water, joined by long boardwalks; flat boats with lanterns. Everything is already half swamp: green scum, mist, rotting reeds. Through the reed beds, threads of dark maroon veined living skin run along the channels and climb the stilts, and seem quite at home.',
    none: 'The boats, floats and barrels carry no lettering. There are no banners.',
  },
  university: {
    what: 'A steep hill in a dark megacity at night, crowned by a great campus of towers of black glass and smoked resin over honeycomb frames, thin neon glyph signs in magenta and cyan, cables, steam. On every rooftop of the campus, telescopes, dish aerials and observatory domes are all turned the same way, straight up at the sky, at the viewer: hundreds of them. Tiny lit windows by the thousand, tiny figures at the windows looking up too.',
    none: 'The neon signs show abstract glyphs only: no letters of any alphabet, no numerals.',
  },
  ossuary: {
    what: 'Tall cliffs of bone-white chalk above a dark grey sea, carved from the waves to the top into thousands of round burial niches holding urns, with candles burning in them by the hundred, and dark slender fungus trees on the ledges. High in the middle of the cliff stands a great royal tomb with tall doors of black iron and gold: its doors have been burst open from inside, and a dark red glow and a trail of dark maroon veined living skin come out of it and down the cliff.',
    none: 'The one emblem on the tombs is a plain gold hexagon: there are no crosses, no stars and no carved lettering anywhere on the cliff.',
  },
  pilgrim: {
    what: 'A long pilgrim road winding over green mountains and valleys all the way to the horizon, lined on both sides with shrines and road-stalls under upswept eaves of layered paper, lacquer-red columns, jade-green tiles and strings of paper lanterns. The road is EMPTY: the stalls are shuttered, the lanterns are dark, a few carts stand abandoned, a hat lies in the road. Nobody walks it.',
    none: `${DOMES} There is no gate shaped like a torii, no yin-yang, and no real written characters: the banners show abstract glyphs only.`,
  },
  'queens-hollow': {
    what: 'In the middle of a great capital city, a colossal round shaft opens in the ground like a sinkhole, and the picture looks down into it: its walls are great combs of glowing amber wax and dark propolis, galleries and ribbed tunnels spiralling down and down into a deep golden glow, brood cells capped with pale wax, royal jelly glowing gold, huge hanging queen cells like gilded peanuts, electric lamps and cables fitted along the galleries. Tiny figures crowd the galleries. The city\'s pale towers stand round the rim.',
    none: 'The lamps and cables carry no lettering. The one emblem is a plain gold hexagon.',
    finale: true,
  },
  'hidden-campus': {
    what: 'A secret research campus hidden in a steep wooded valley in the mountains, its low buildings of black glass and smoked resin half sunk into the rock. The picture looks down through its vast glass roofs at the inside: hall after hall of endless shelves, row after row, holding thousands upon thousands of glass specimen jars, each with a lump of dark red living tissue floating in fluid. So many jars. A small unmarked van drives up the valley road with one more crate.',
    none: 'The jars have blank tags with nothing on them. The van is plain with no lettering. There is no sign at the campus.',
  },
  assembly: {
    what: 'A grand congress hall standing alone on a vast empty plaza: a huge building of pale paper and wax with arcades of round arches and a great central dome of layered paper and glass. Through the glass of the dome, seen from above, row upon row of chairs is set out in perfect circles, and every chair is empty. Nobody is in the plaza. Far at the edges of the city, dark maroon veined living skin and dark red tendrils curl round the outlying blocks. The hall is very quiet.',
    none: `${DOMES} The one emblem on the hall is a plain gold hexagon. The long cloth banners are plain pastel cloth with nothing on them.`,
    finale: true,
  },
  'seventh-city': {
    what: 'A gleaming city of pale domes on a high hill, the last city of a prophecy: terraces of shrines, arcades of round arches, gold mosaic and onion domes of layered paper, and between them dozens of tall slender lattice radio masts with blinking red lights sending painted rings of radio waves out into the sky. All round the foot of the hill, dark maroon veined living skin covers the plain like a rising sea.',
    none: `${DOMES} The radio masts are plain tapering lattice towers with no cross-arm: none must look like a cross. The one emblem is a plain gold hexagon.`,
    finale: true,
  },
  'glass-spires': {
    what: 'A forest of immensely tall spires of black glass and smoked resin in honeycomb frames, rising out of a megacity into a storm: the laboratories of their artificial intelligence. Thin lines of cyan and gold light run up every spire, rows of cooling towers and data halls glow cyan at their feet, lightning strikes the tallest spire. Far below, the streets are empty.',
    none: 'The neon and holograms show abstract glyphs only: no letters of any alphabet, no numerals.',
    finale: true,
  },
};
export const TERRITORY_IDS = Object.keys(TERRITORIES);
/** The size a territory picture is baked at (drawn at 1536 x 1024): the header of a briefing. */
const TERRITORY_SIZE = { w: 1024, h: 683 };
/** The tile set a territory is drawn with. */
const setOf = (id) => {
  const set = BIOMES.find((b) => b.territories?.includes(id));
  if (!set) throw new Error(`territory ${id}: no tile set draws it (tools/art/biomes.mjs, territories)`);
  return set;
};
/** Its set's review sheet as a PNG, for the upload: the one picture of the whole look of the set. */
function setRef(set) {
  const png = path.join(DIR, 'territories', 'refs', `${set.id}.png`);
  if (!fs.existsSync(png)) writePng(png, readImage(path.join(REVIEW, 'biomes', `${set.id}.jpg`)));
  return png;
}
const territoryPrompt = (id) => {
  const t = TERRITORIES[id];
  const set = setOf(id);
  const look =
    `${set.species ?? SPECIES}. ${set.look}. The reference picture shows exactly this architecture close up: its ` +
    'buildings, colours, materials, roofs and the things that stand on them. Build the whole place out of them, but ' +
    'copy nothing of its layout, its isometric blocks or its black background: this is a real place seen from the air.';
  return `${AERIAL} ${t.what} ${look}${t.finale ? ` ${FINALE}` : ''} ${TOWNSFOLK} ${t.none} ${CLEAN}`;
};

const SKETCH_STYLE =
  'Each is a quick, confident, funny pen sketch by a young, nerdy technician: white ink lines on a plain flat ' +
  'black background, a little shaky, with arrows, exclamation marks and question marks, and scribbles standing ' +
  'in for handwriting. The insects are small cartoon beetles and wasps in helmets and hats. No readable words, ' +
  'no numbers, no frames or boxes round the sketches, no paper.';
/** id: the experiment's or dare's id in content/campaign.ts. */
const SKETCHES = {
  experiments: [
    { id: 'puppet-queen', look: 'a big insect queen in a crown inside a cage trap, with puppet strings rising from her head to a hand above, and an arrow pointing back at a crowd of tiny soldiers' },
    { id: 'love-gas', look: 'a plant-like gland puffing a cloud full of little hearts, and two tiny insect soldiers holding hands inside the cloud' },
    { id: 'follow-courier', look: 'a small insect running away carrying a specimen jar with a lump inside, leaving a dotted trail that ends at a big question mark' },
    { id: 'nursery', look: 'a long strip of flames running along the ground through an archway, with tiny eggs on the far side and an exclamation mark' },
    { id: 'royal-diet', look: 'a big round toothed mouth on a stalk with a tiny crown drawn above it and a small knife and fork beside it' },
  ],
  dares: [
    { id: 'creep-finale', look: 'a puddle of slime with a skull above it and a crossed-out gun' },
    { id: 'big-boy', look: 'one enormous muscular arm flexing, covered in many small badges, with stars round it' },
    { id: 'forest', look: 'a whole forest of small tentacles and stalks packed side by side like trees' },
    { id: 'only-spitters', look: 'a row of identical little spitting nozzles on stalks, all spitting at once' },
    { id: 'no-eating', look: 'a knife and fork with a big cross drawn through them' },
    { id: 'everything-burns', look: 'a crowd of tiny insects all on fire, running in every direction' },
    { id: 'pacifist', look: 'a plant-like stalk holding a flower and making a peace sign, with a halo drawn above it' },
    { id: 'let-them-in', look: 'an open door with a welcome mat and tiny insects marching in through it' },
    { id: 'zoo', look: 'a row of five different little plant-like creatures in a row of cages, like a zoo, each with a name tag' },
  ],
};

const want = (only, id) => !only?.length || only.includes(id);

async function generate(only) {
  const jobs = [];
  const refs = [path.join(CONCEPTS, 'r3-ship-operations-black.png'), path.join(CONCEPTS, 'hero-behind-desk.png')];
  if (want(only, 'rooms')) {
    for (const [id, prompt] of Object.entries(ROOMS)) {
      jobs.push(() => makeStill({ slug: `room ${id}`, out: path.join(DIR, `room-${id}.png`), prompt, key: null, width: 1536, height: 1024, quality: 'high', refFiles: refs }));
    }
  }
  if (want(only, 'planet')) jobs.push(() => makeStill({ slug: 'planet', out: path.join(DIR, 'planet.png'), prompt: PLANET, key: null, width: 1536, height: 1024, quality: 'high' }));
  if (want(only, 'exterior')) jobs.push(() => makeStill({ slug: 'exterior', out: path.join(DIR, 'exterior.png'), prompt: EXTERIOR, key: null, width: 1536, height: 1024, quality: 'high', refFiles: [path.join(CONCEPTS, 'r3-ship-exterior-ring.png')] }));
  if (want(only, 'leaders')) {
    for (const [id, prompt] of Object.entries(LEADERS)) {
      jobs.push(() => makeStill({ slug: `leader ${id}`, out: path.join(DIR, `leader-${id}.png`), prompt, key: null, width: 1024, height: 1024, quality: 'medium', refFiles: [path.join(CONCEPTS, 'r2-faction-leaders.png')] }));
    }
  }
  if (want(only, 'sketches')) {
    for (const [set, list] of Object.entries(SKETCHES)) {
      jobs.push(() => makeStill({
        slug: `sketches ${set}`, out: path.join(DIR, `sketches-${set}.png`), key: null, width: 1536, height: 1024, quality: 'medium',
        refFiles: [path.join(CONCEPTS, 'r4-hobby-interface.png')],
        prompt: `A sheet of ${list.length} separate small sketches in ${list.length <= 5 ? 'one row' : 'three rows of three'}, evenly spaced, well apart and not touching. ${SKETCH_STYLE} In reading order: ${list.map((s, i) => `(${i + 1}) ${s.look}`).join('; ')}.`,
      }));
    }
  }
  // Scene pictures: all of them ('scenes'), or the ones named by id.
  for (const id of SCENE_IDS) {
    if (only?.length && !only.includes('scenes') && !only.includes(id)) continue;
    const refFiles = sceneRefs(id);
    jobs.push(() => makeStill({
      slug: `scene ${id}`, out: path.join(DIR, 'scenes', `${id}.png`), prompt: scenePrompt(id), key: null,
      width: 1536, height: 1024, quality: 'high', ...(refFiles.length ? { refFiles } : {}),
    }));
  }
  // Territory pictures: all of them ('territories'), or the ones named by id.
  for (const id of TERRITORY_IDS) {
    if (only?.length && !only.includes('territories') && !only.includes(id)) continue;
    jobs.push(() => makeStill({
      slug: `territory ${id}`, out: path.join(DIR, 'territories', `${id}.png`), prompt: territoryPrompt(id), key: null,
      width: 1536, height: 1024, quality: 'high', refFiles: [setRef(setOf(id))],
    }));
  }
  // Four at a time: every picture is looked at before the next ones are paid for.
  const results = await pool(jobs, 4, (j) => j());
  results.forEach((r) => { if (!r.ok) console.warn(`[ship] a picture failed: ${r.error.message.slice(0, 200)}`); });
}

const save = (img, file, q = 86) => {
  const png = file.replace(/\.webp$/, '.png');
  writePng(png, img);
  toWebp(png, file, { q });
  fs.rmSync(png);
  return fs.statSync(file).size;
};

/** Make a picture's background pure black, so that adding it to the screen adds nothing there. */
function blackPoint(img, level) {
  const out = blank(img.w, img.h);
  for (let i = 0; i < img.data.length; i += 4) {
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.max(0, Math.min(255, Math.round(((img.data[i + k] - level) * 255) / (255 - level))));
    out.data[i + 3] = 255;
  }
  return out;
}

/** The right edge of a map blended into its left edge, so the globe has no seam. */
function wrap(img, band = 0.06) {
  const out = { w: img.w, h: img.h, data: Buffer.from(img.data) };
  const b = Math.round(img.w * band);
  for (let y = 0; y < img.h; y++) for (let x = img.w - b; x < img.w; x++) {
    const t = (x - (img.w - b)) / b;
    const s = t * t * (3 - 2 * t);
    const a = (y * img.w + x) * 4;
    const m = (y * img.w + (img.w - 1 - x)) * 4;
    for (let k = 0; k < 3; k++) out.data[a + k] = Math.round(img.data[a + k] * (1 - s) + img.data[m + k] * s);
  }
  return out;
}

export function bakeShip() {
  const out = path.join(ART, 'ship');
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(path.join(REVIEW, 'ship'), { recursive: true });
  const entry = { rooms: {}, leaders: {}, scenes: {} };
  let total = 0;
  for (const id of Object.keys(ROOMS)) {
    const file = path.join(DIR, `room-${id}.png`);
    if (!fs.existsSync(file)) continue;
    total += save(readImage(file, { w: 1536, h: 1024 }), path.join(out, `room-${id}.webp`), 84);
    entry.rooms[id] = `ship/room-${id}.webp`;
  }
  for (const id of Object.keys(LEADERS)) {
    const file = path.join(DIR, `leader-${id}.png`);
    if (!fs.existsSync(file)) continue;
    total += save(readImage(file, { w: 512, h: 512 }), path.join(out, `leader-${id}.webp`), 84);
    entry.leaders[id] = `ship/leader-${id}.webp`;
  }
  // The scene pictures: a card shows one about 300 px wide, so 640 is sharp on any screen.
  const sheets = {};
  for (const id of SCENE_IDS) {
    const file = path.join(DIR, 'scenes', `${id}.png`);
    if (!fs.existsSync(file)) continue;
    const img = readImage(file, SCENE_SIZE);
    total += save(img, path.join(out, 'scenes', `${id}.webp`), 84);
    entry.scenes[id] = `ship/scenes/${id}.webp`;
    (sheets[factionOf(id)] ??= []).push(img);
  }
  // To look at: every scene of a faction on one sheet, in the order they play.
  for (const [faction, list] of Object.entries(sheets)) {
    const cols = 2;
    const sheet = blank(cols * SCENE_SIZE.w, Math.ceil(list.length / cols) * SCENE_SIZE.h, [0, 0, 0, 255]);
    list.forEach((img, i) => paste(sheet, img, (i % cols) * SCENE_SIZE.w, Math.floor(i / cols) * SCENE_SIZE.h));
    writeJpg(path.join(REVIEW, 'ship', `scenes-${faction}.jpg`), sheet, 3);
  }
  // The territory pictures: the header of a briefing, 1024 wide.
  const lands = [];
  for (const id of TERRITORY_IDS) {
    const file = path.join(DIR, 'territories', `${id}.png`);
    if (!fs.existsSync(file)) continue;
    const img = readImage(file, TERRITORY_SIZE);
    total += save(img, path.join(out, 'territories', `${id}.webp`), 84);
    (entry.territories ??= {})[id] = `ship/territories/${id}.webp`;
    lands.push(resize(img, 512, 341));
  }
  // To look at: all of them on one sheet, in the order of the campaign.
  if (lands.length) {
    const cols = 4;
    const sheet = blank(cols * 512, Math.ceil(lands.length / cols) * 341, [0, 0, 0, 255]);
    lands.forEach((img, i) => paste(sheet, img, (i % cols) * 512, Math.floor(i / cols) * 341));
    writeJpg(path.join(REVIEW, 'ship', 'territories.jpg'), sheet, 3);
  }
  if (fs.existsSync(path.join(DIR, 'exterior.png'))) {
    total += save(readImage(path.join(DIR, 'exterior.png'), { w: 1536, h: 1024 }), path.join(out, 'exterior.webp'), 84);
    entry.exterior = 'ship/exterior.webp';
  }
  if (fs.existsSync(path.join(DIR, 'planet.png'))) {
    // The model draws at 3:2; a map of a whole planet is 2:1.
    total += save(wrap(readImage(path.join(DIR, 'planet.png'), { w: 1024, h: 512 })), path.join(out, 'planet.webp'), 88);
    entry.planet = 'ship/planet.webp';
  }
  // YOKE: the six faces of the sheet Collins approved, three across and two down.
  const yoke = path.join(CONCEPTS, 'r4-yoke-expressions.png');
  if (fs.existsSync(yoke)) {
    const img = readImage(yoke);
    const names = ['calm', 'curious', 'amused', 'concerned', 'thinking', 'sad'];
    const w = Math.floor(img.w / 3);
    const h = Math.floor(img.h / 2);
    const sheet = blank(3 * 384, 2 * 384, [0, 0, 0, 255]);
    names.forEach((n, i) => paste(sheet, resize(blackPoint(crop(img, (i % 3) * w, Math.floor(i / 3) * h, w, h), 14), 384, 384), (i % 3) * 384, Math.floor(i / 3) * 384));
    total += save(sheet, path.join(out, 'yoke.webp'), 90);
    entry.yoke = { atlas: 'ship/yoke.webp', frame: 384, cols: 3, faces: names };
  }
  // His sketches: white ink on black becomes ink with no background.
  const sketches = [];
  for (const [set, list] of Object.entries(SKETCHES)) {
    const file = path.join(DIR, `sketches-${set}.png`);
    if (!fs.existsSync(file)) continue;
    const img = readImage(file);
    // A sketch is loose strokes, not one blob: the sheet is cut as the grid it was asked for.
    const [cols, rows] = list.length <= 5 ? [list.length, 1] : [3, Math.ceil(list.length / 3)];
    const { cells } = cutGrid(img, cols, rows);
    list.forEach((s, i) => {
      const c = cells[i];
      // The ink inside this sketch's own cell, squared up with a little margin.
      const cell = crop(img, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, [0, 0, 0, 255]);
      let x0 = cell.w, y0 = cell.h, x1 = 0, y1 = 0;
      for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) {
        const p = (y * cell.w + x) * 4;
        if (Math.max(cell.data[p], cell.data[p + 1], cell.data[p + 2]) > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < x0) { x0 = 0; y0 = 0; x1 = cell.w; y1 = cell.h; }
      const side = Math.ceil(Math.max(x1 - x0, y1 - y0) * 1.1);
      const one = resize(crop(cell, Math.round((x0 + x1 - side) / 2), Math.round((y0 + y1 - side) / 2), side, side, [0, 0, 0, 255]), 256, 256);
      for (let p = 0; p < one.data.length; p += 4) {
        const lum = Math.max(one.data[p], one.data[p + 1], one.data[p + 2]);
        one.data[p + 3] = Math.max(0, Math.min(255, Math.round((lum - 24) * 1.25)));
      }
      sketches.push({ id: s.id, set, img: one });
    });
  }
  if (sketches.length) {
    const cols = 5;
    const sheet = blank(cols * 256, Math.ceil(sketches.length / cols) * 256);
    sketches.forEach((s, i) => paste(sheet, s.img, (i % cols) * 256, Math.floor(i / cols) * 256));
    total += save(sheet, path.join(out, 'sketches.webp'), 90);
    entry.sketches = { atlas: 'ship/sketches.webp', frame: 256, cols, ids: sketches.map((s) => s.id) };
  }
  putEntry('ship', 'ship', entry);
  console.log(`[ship] baked: ${Object.keys(entry.rooms).length} rooms, ${Object.keys(entry.leaders).length} leaders, ${Object.keys(entry.scenes).length} of ${SCENE_IDS.length} scene pictures, ${Object.keys(entry.territories ?? {}).length} of ${TERRITORY_IDS.length} territories, ${sketches.length} sketches, ${entry.yoke ? 6 : 0} faces of YOKE${entry.planet ? ', the planet' : ''}${entry.exterior ? ', the exterior' : ''}; ${Math.round(total / 1024)} KB`);
  return entry;
}

export async function makeShip({ bakeOnly = false, only } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  if (!bakeOnly) await generate(only);
  return bakeShip();
}
