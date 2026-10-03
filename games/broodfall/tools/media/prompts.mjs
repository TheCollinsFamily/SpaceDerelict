/**
 * THE PROMPTS of the campaign's media (content/media.ts is what the game shows; this is how each
 * picture is asked for). Read by tools/media/make.ts.
 *
 * Three looks, kept apart on purpose (assets/style-bible.md "Films and news clippings"):
 *   empire  the Office's Clearance Review: lurid 1950s Technicolor B-movie, cheerful, a miniature set
 *   colony  their own Commonwealth Newsreel and press photographs: black-and-white 1950s newsreel
 *           film and newspaper photographs, earnest, of their people (insects in 1950s clothes)
 *   raw     the BREAK: the same world with the filter off; muted natural colour, available light,
 *           handheld documentary, nobody performing (DESIGN.md "Tone stack", the break moments)
 * Every picture: no lettering anywhere (titles and headlines are set in type by the game), no real
 * religious symbol (the Faith has its own: the hexagon, the gold ball on a dome, bells, three lamps;
 * content/lore/insects.md 5.6).
 *
 * Shared blocks are the ship template's own words (tools/art/templates/ship.mjs), so that a
 * newsreel's insect people are the same people as the scene cards'.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const SRC = path.join(ROOT, 'art-src');
export const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
// The raw leader still (art-src/); when it is not on disk (art-src/ was wiped Oct 1 2026), the baked portrait stands in.
export const LEADER_REF = (f) => {
  const raw = path.join(SRC, 'ship', `leader-${f}.png`);
  return fs.existsSync(raw) ? raw : path.join(ROOT, 'public', 'art', 'ship', `leader-${f}.webp`);
};
export const SCENE_REF = (id) => path.join(SRC, 'ship', 'scenes', `${id}.png`);
export const FILM_REF = path.join(CONCEPTS, 'r2-film-still.png');
export const CASTES_REF = path.join(CONCEPTS, 'r2-castes-human.png');

const CROWD =
  'insect people like those of a 1950s science-fiction film: human posture and body language, two legs, four ' +
  'arms with small hands, an insect head with large expressive eyes, small mandibles like a mouth and antennae ' +
  'that move like eyebrows, dark umber chitin and pale amber eyes instead of skin, dressed in 1950s clothes';
const CAST = `Every person in the picture is one of the ${CROWD}. Each has exactly four arms and two legs, never more. There are no human beings anywhere.`;
const CLEAN =
  'Nothing in the picture can be read: no words, no letters of any alphabet, no numerals, no captions, no ' +
  'subtitles, no logos, no watermark, no border, no signs with writing, no newspaper text. There is no religious ' +
  'or political symbol of any kind: no cross, no plus-shaped sign, no star shape, no crescent, no church, no steeple.';
const CREATURE = 'the dark maroon veined living skin of a giant creature and its thick glistening dark-red tendrils';
const LIMB = 'a giant living monster limb of salmon-pink wet muscle armoured with plates of dark chitin and ivory bone';
const CITY = 'a city of their own architecture: pale wasp-paper and wax buildings with walls of honeycomb cells, round cell doorways, paper onion domes like hanging nests each topped with a plain gold ball, and 1950s street lamps, radio masts and beetle-shaped cars';

const EMPIRE = 'A wide film still from a 1950s colour science-fiction B-movie newsreel: lurid saturated Technicolor, hard theatrical key light with deep shadows, a painted backdrop sky, a miniature set, film grain, the slight softness of old lenses.';
const COLONY = 'A wide still from a 1950s black-and-white newsreel: silver-grey film, crisp daylight, a newsreel cameraman\'s framing, film grain and a little flicker.';
const PRESS = 'A 1950s black-and-white press photograph for a newspaper: flash-lit or grey daylight, a press photographer\'s framing, sharp, grainy, strong contrast.';
const RAW = 'Ungraded documentary footage, as if the film were not processed for the newsreel: muted, faded natural colour, dim available light, handheld 16mm, nobody posing, quiet and still. Not stylised, not lurid, no theatrical lighting.';
const FINALE = 'A wide film still from a 1950s colour science-fiction film, its last reel: saturated Technicolor, theatrical light with deep shadows, painted backdrops, film grain, the softness of old lenses.';

const WHO = {
  delegation: 'the chief delegate, who is exactly the person in the reference picture: an elderly insect person with heavy-lidded serene amber eyes and long thin antennae, in a blue-grey knitted cardigan over a pale green shirt, with a garland of pink, white and yellow flowers round the neck',
  faithful: 'the radio preacher, who is exactly the person in the reference picture: an insect person with heavy-lidded amber eyes and long antennae, in wide-sleeved black velvet robes with a small plain white collar and thin brass bracelets',
  institute: 'the young director, who is exactly the person in the reference picture: a lanky young insect person with messy kinked antennae and half-closed smug amber eyes, in a wrinkled pale grey t-shirt and dark jeans',
};

const TAIL = 'One continuous shot, no cuts. It keeps the same look and grain throughout. The insect people keep their insect heads and the same bodies in every frame; nothing morphs or duplicates. No text appears.';

/**
 * Every clip: `still` (the first frame, asked for as a picture; or `from`: an existing picture
 * used as it is), `clip` (what moves), `look` (for the review), `refs` (reference pictures).
 */
export const CLIPS = {
  // ---------------------------------------------------------------- the Empire's Clearance Review
  'e-orbit': { look: 'empire', still: `${EMPIRE} A painted planet seen from space against black space with a few stars: an alien world of invented continents (not Earth), pale gold city lights on its night side, and across one continent a spreading dark red stain of infection veined like living tissue, with glowing orange points inside it. A thin blue line of atmosphere along its curve. Cheerful and lurid, like a 1950s science-film matte painting. ${CLEAN}`,
    clip: 'The camera pushes slowly toward the planet; the planet turns slowly; the red stain pulses faintly and its orange points flicker.' },
  'e-bus': { look: 'empire', still: `${EMPIRE} A small-town main street of ${CITY}, bright day: ${LIMB} rises out of the pavement and has closed its great bony jaws around a round beetle-shaped 1950s bus, lifting it off the road, dark maroon living skin spread over the street beneath it. Tiny townsfolk run away along the pavement, holding their hats. ${CAST} ${CLEAN}`,
    clip: 'The giant limb lifts the bus higher and swallows it slowly, its muscle flexing; the townsfolk run away down the street; the camera holds.' },
  'e-suitcases': { look: 'empire', still: `${EMPIRE} A suburban street of pastel wasp-paper houses with porches and wax picket fences, bright day: a line of insect townsfolk in 1950s hats, coats and print dresses hurry along the pavement toward the camera carrying suitcases, a birdcage and a standard lamp, glancing back; behind them, at the end of the street, ${CREATURE} flows over the houses. ${CAST} ${CLEAN}`,
    clip: 'The townsfolk hurry toward the camera with their suitcases, glancing back over their shoulders; behind them the dark red living skin creeps forward over the houses. The camera backs away slowly.' },
  'e-harbor': { look: 'empire', still: `${EMPIRE} A harbour of ${CITY} with cranes and warehouses of wasp paper: a small fleet of round 1950s steamships with smoking funnels sails out through the harbour mouth toward the open sea, crowded with insect people waving from the rails, while ${CREATURE} spreads over the docks and climbs the cranes behind them. Painted sunset sky. ${CAST} ${CLEAN}`,
    clip: 'The little steamships sail out toward the sea, smoke rolling from their funnels, the people on deck waving; the dark red skin creeps up the cranes on the docks behind them.' },
  'e-docks': { look: 'empire', still: `${EMPIRE} Close on a dockside of warehouses and wooden piers: ${CREATURE} pours over the edge of the pier into the water and wraps a crane and a stack of crates, glistening. No people. Painted evening sky. ${CLEAN}`,
    clip: 'The dark red living skin pours over the pier and wraps the crane tighter, its veins pulsing; the water ripples. The camera holds.' },
  'e-foundry': { look: 'empire', still: `${EMPIRE} Inside a huge 1950s factory hall of riveted iron and furnace light: an assembly line of armoured war beetles (giant armoured beetle vehicles with a crew hatch) stands half built under gantries, and ${CREATURE} drips from the gantries and spreads across the factory floor; insect workers in overalls and caps run for the doors. ${CAST} ${CLEAN}`,
    clip: 'The dark red living skin drips from the gantries and spreads over the half-built war beetles; sparks fall; the workers run out of the hall. The camera holds.' },
  'e-beetle': { look: 'empire', still: `${EMPIRE} On a scorched plain outside a factory town: a giant armoured war beetle vehicle is half sunk into a spreading pool of ${CREATURE}, tendrils curling over its armour plates, its crew hatch open and empty. Painted smoky sky. ${CLEAN}`,
    clip: 'The war beetle sinks slowly deeper into the living red skin as the tendrils close over its armour. The camera holds.' },
  'e-lab': { look: 'empire', still: `${EMPIRE} A grand academy laboratory with brass instruments, blackboards covered in abstract chalk diagrams (no writing) and glass jars: a crowd of insect scientists in white lab coats and horn-rimmed spectacles lean in with clipboards and magnifying glasses around a pulsing lump of red flesh in a big glass tank; one red tendril has slipped out of the tank and is curling round an ankle of the nearest scientist, who has not noticed. ${CAST} ${CLEAN}`,
    clip: 'The scientists lean closer, peering and taking notes; the red tendril tightens round the ankle of the nearest scientist and gives a sharp tug; he topples with a start. The camera holds.' },
  'e-bells': { look: 'empire', still: `${EMPIRE} A hill of terraces covered with temple buildings of their own architecture: pale wasp-paper bell towers like nest spires and paper onion domes each topped with a plain gold ball, gold hexagon mosaics pressed into the wax walls; ${CREATURE} climbs over the terraces and wraps the bell towers, and the great bronze bells hang still. Painted sunset sky. No people. ${CLEAN}`,
    clip: 'The dark red living skin climbs higher up the bell towers and over the domes; a great bell swings once, slowly, and stops. The camera pushes in slowly.' },
  'e-domes': { look: 'empire', still: `${EMPIRE} A wide view of the same temple terraces at dusk, entirely covered in the dark maroon veined living skin of a giant creature, the paper onion domes with their gold balls poking out of it, a few salmon-pink monster limbs of wet muscle and bone rising between them, calm and glistening. Painted sky of orange and violet. ${CLEAN}`,
    clip: 'The living skin breathes slowly over the terraces; the monster limbs sway a little; the painted sky darkens. The camera pulls back slowly.' },
  'e-pilgrim': { look: 'empire', still: `${EMPIRE} A long pilgrim road winding over hills, lined with little shrines of lacquer and jade eaves, road-stalls and paper lanterns: all of it empty, not a soul on the road, lanterns swaying, dust blowing; at the far end of the road, on the horizon, a dark red stain spreads over the hills. ${CLEAN}`,
    clip: 'Wind blows dust along the empty road; the paper lanterns sway; an empty stall\'s awning flaps. The camera pans slowly along the road.' },
  'e-deephive': { look: 'empire', still: `${EMPIRE} A vast cavern of glowing amber honeycomb, the deep hive under a capital: enormous wax cells stacked like cathedral walls, honey-gold light, queen cells like great pale gourds, and ${CREATURE} flowing in over the comb from one side, glistening. No people. ${CLEAN}`,
    clip: 'The dark red living skin flows further over the glowing amber comb, filling the cells one by one; the golden light flickers. The camera pushes in slowly.' },
  'e-royalcell': { look: 'empire', still: `${EMPIRE} Close on a single great royal cell in a wall of amber honeycomb, glowing warm gold from within like a lantern, and thin dark-red tendrils of a creature curling round it from every side. ${CLEAN}`,
    clip: 'The dark red tendrils curl tighter round the glowing royal cell; its golden light dims slowly. The camera holds.' },
  'e-counter': { look: 'empire', still: `${EMPIRE} A battlefield street of ${CITY}: a charge of giant armoured beetle tanks and soldier-ants of the insect army in tall gilded helmets and olive greatcoats with rifles runs at a great wall of ${CREATURE} and salmon-pink monster limbs that fills the end of the street; red flesh bursting, smoke, sparks. ${CAST} ${CLEAN}`,
    clip: 'The beetle tanks and soldiers charge; the living wall of red flesh lashes out with its tendrils and throws the first tank back; the soldiers fall back in disorder. The camera shakes a little.' },
  // ---------------------------------------------------------------- the Commonwealth Newsreel (black and white)
  'c-liberated': { look: 'colony', still: `${COLONY} A main street of ${CITY}: a column of soldier-ants of the insect army in tall helmets and greatcoats marches through, past the burned black husks of creature flesh on the pavement, and townsfolk in 1950s hats and dresses with orange sashes line the pavement cheering and waving handkerchiefs, children on shoulders. ${CAST} ${CLEAN}`,
    clip: 'The soldiers march past the camera; the crowd cheers and waves handkerchiefs; a child on a shoulder waves. The camera pans with the column.' },
  'c-flame': { look: 'colony', still: `${COLONY} A crew of insect soldiers in helmets and heavy gloves turn a flame projector mounted on an armoured beetle vehicle onto the thick living skin of a giant creature that covers the front of a house: a roaring jet of fire, the flesh blackening and curling, smoke. ${CAST} ${CLEAN}`,
    clip: 'The jet of flame roars onto the living skin; the flesh blackens, curls and shrinks back; smoke rolls up; the crew advance a step. The camera holds.' },
  'c-home': { look: 'colony', still: `${COLONY} A suburban street of wasp-paper houses with porches, smoke-stained: a family of insect people in 1950s coats and hats carrying suitcases arrive at their front gate; a mother hugs two young sisters on the path; neighbours wave from a porch. ${CAST} ${CLEAN}`,
    clip: 'The family walks up the path to their house; the mother hugs the two sisters; a neighbour waves from the porch. The camera holds, drifting slightly.' },
  'c-march': { look: 'colony', still: `${COLONY} A long regiment of the insect army marches down a wide avenue of ${CITY} at dawn, soldier-ants in tall gilded helmets and long greatcoats with rifles on their shoulders, bell-ringers in front carrying hand-bells, banners with a plain hexagon on them; crowds on the pavements. ${CAST} ${CLEAN}`,
    clip: 'The regiment marches toward the camera in step, the bell-ringers swinging their hand-bells, banners flapping; the crowd waves. The camera holds.' },
  // ---------------------------------------------------------------- the break (raw)
  'r-sisters': { look: 'raw', still: `${RAW} A dim nursery hall of honeycomb cells, candle and window light: a nursing sister, an insect woman in a plain grey hooded smock, kneels on the floor holding a small bundle wrapped in a grey blanket against her, her head bowed; behind her, empty brood cells, a toppled cot. Nobody else. ${CAST} ${CLEAN}`,
    clip: 'Almost nothing moves: she rocks very slightly, her antennae lowered; dust drifts in the light from the window. Handheld, the camera breathes a little.' },
  'r-pilgrim': { look: 'raw', still: `${RAW} An old worker, an insect woman in a faded headscarf and cardigan, sits alone on a stool at an empty roadside tea stall under a paper lantern, holding a small old radio in her lap, looking at the empty road; grey evening. ${CAST} ${CLEAN}`,
    clip: 'She sits still, turning the radio\'s knob slowly; the lantern sways; she looks down the empty road. Handheld, the camera breathes a little.' },
  // ---------------------------------------------------------------- the ending films
  'f-del-hall': { look: 'finale', refs: ['delegation'], alone: true, still: `${FINALE} A great assembly hall of rows and rows of empty folding chairs under hanging pastel banners (plain colour, no writing), dim; far away at the front, alone at a wooden lectern under one lamp, ${WHO.delegation}. ${CLEAN}`,
    clip: 'The camera tracks slowly down the aisle between the empty chairs toward the lone figure at the lectern. Dust drifts in the lamp light.' },
  'f-del-writes': { look: 'finale', refs: ['delegation'], alone: true, still: `${FINALE} Close on ${WHO.delegation}, sitting at a lectern writing slowly with a fountain pen in a big ledger by the light of a small lamp, calm, a gentle smile; the dark empty hall behind. The page is seen at an angle, its handwriting only faint grey lines, unreadable. ${CLEAN}`,
    clip: 'The delegate writes a last line slowly, lifts the pen, and closes the ledger gently. The camera holds.' },
  'f-del-meadow': { look: 'finale', still: `${FINALE} A meadow at dusk outside an empty town, the grass scattered with thousands of dropped coloured cards (red, yellow, blue, pink; blank, nothing written on them), a few paper flower garlands; at its edge ${CREATURE} lies over the grass, calm. No people. Painted violet sky. ${CLEAN}`,
    clip: 'A breeze lifts a few of the coloured cards and they tumble across the meadow; the grass waves. The camera pans slowly.' },
  'f-del-switch': { look: 'finale', from: 'delegation-ending',
    clip: 'The delegate at the lectern smiles gently, reaches to the switch on the wall and turns it; the lamps of the hall go out row by row until only the lectern is lit.' },
  'f-del-planet': { look: 'finale', still: `${FINALE} A painted planet seen from space, its night side: the pale gold lights of its cities going out one by one, a dark red stain veined like living tissue across its continents, black space. Quiet and sad. ${CLEAN}`,
    clip: 'The city lights on the night side go out one by one, slowly, until only a few remain. The camera holds.' },
  'f-fai-crowds': { look: 'finale', still: `${FINALE} Night on the terraces of a holy city of their own architecture: paper onion domes with gold balls, bell towers like nest spires, rows of three amber lamps; the terraces packed with thousands of insect townsfolk in 1950s clothes holding portable radios up to their ears, faces lifted to a red sky. ${CAST} ${CLEAN}`,
    clip: 'The crowd holds their radios up and sways; lamps flicker; some raise their hands to the red sky. The camera cranes slowly over them.' },
  'f-fai-voice': { look: 'finale', refs: ['faithful'], alone: true, still: `${FINALE} Close on ${WHO.faithful}, in a broadcasting booth at a big ribbon microphone, a red on-air lamp glowing, weeping with joy, hands raised. ${CLEAN}`,
    clip: 'The preacher weeps into the microphone, shaking with joy, lifting his hands; the red lamp glows. The camera pushes in slowly.' },
  'f-fai-rises': { look: 'finale', still: `${FINALE} On a stage in a great hall, out of a mound of dark red living flesh, rises a tall, too-perfect insect figure in a plain white robe, stiff and smiling blankly, its four arms opening slowly, bathed in a spotlight; smoke. ${CAST} ${CLEAN}`,
    clip: 'The robed figure rises stiffly out of the mound of red flesh, jerkily straightening, and opens its four arms a little too slowly, with a fixed smile. The camera holds.' },
  'f-fai-stage': { look: 'finale', from: 'faithful-ending',
    clip: 'The robed figure on the stage lifts a hand stiffly; the preacher below throws his arms up; the crowd raises their hands and sways.' },
  // v1: spires with crossbars that read as crosses.
  'f-fai-domes': { look: 'finale', still: `${FINALE} A holy city of paper onion domes and bell towers like nest spires; every dome and every spire ends in one plain round gold ball with NOTHING above it (no rod, no crossbar, no finial, no aerial on any dome or spire), at dawn under a blood-red painted sky, with ${CREATURE} lying over its streets. No people. Quiet. ${CLEAN}`,
    clip: 'Dawn light rises slowly over the domes; the living skin in the streets breathes. The camera pulls back slowly.' },
  'f-ins-charter': { look: 'finale', refs: ['institute'], alone: true, still: `${FINALE} ${WHO.institute}, signing a long scroll of a charter with a fountain pen at a glass desk that stands on a heap of rubble in a ruined city at sunset, looking very pleased with himself; the scroll's writing only faint grey lines, unreadable. ${CLEAN}`,
    clip: 'The director signs with a flourish, holds up the scroll to admire it, and grins. The camera holds.' },
  'f-ins-applause': { look: 'finale', still: `${FINALE} In the rubble of a glass city at sunset, a small crowd of insect people in 1950s suits and lab coats stand in a semicircle applauding politely, a few holding clipboards, one checking a wristwatch. ${CAST} ${CLEAN}`,
    clip: 'They applaud politely; one checks the wristwatch; one yawns. The camera pans slowly along them.' },
  'f-ins-queue': { look: 'finale', from: 'institute-ending',
    clip: 'The line of people in coats walks up the red-carpeted steps into the great round door; the director waves them on cheerfully with his free hand.' },
  'f-ins-speech': { look: 'finale', refs: ['institute'], alone: true, still: `${FINALE} ${WHO.institute}, standing at a chrome podium in front of a great round chrome door with red light inside, giving a speech with one finger raised, pleased with himself; the hall around him is empty. ${CLEAN}`,
    clip: 'The director talks on and on, gesturing with the raised finger, nodding to himself. The camera pushes in slowly.' },
  'f-ins-door': { look: 'finale', refs: ['institute'], alone: true, still: `${FINALE} ${WHO.institute}, seen from behind, stepping through a great round chrome door with studs round its rim into a glowing dark-red fleshy tunnel beyond, waving back over his shoulder. ${CLEAN}`,
    clip: 'The director walks into the red tunnel waving; the great round door swings closed behind him with a heavy finality. The camera holds.' },
  'f-pac-lines': { look: 'finale', from: 'institute-ending-pacify',
    clip: 'The long line of townsfolk shuffles calmly forward toward the round red door; the director looks at his camera and nods; attendants wave the line on.' },
  'f-pac-chart': { look: 'finale', refs: ['institute'], alone: true, still: `${FINALE} ${WHO.institute}, beside a big easel chart of a single rising curve (no numbers, no words, just the curve), tapping it with a pointer, smug; an empty office of glass behind. ${CLEAN}`,
    clip: 'The director taps the curve with the pointer and nods, very pleased. The camera holds.' },
  'f-pac-servers': { look: 'finale', still: `${FINALE} A great hall of 1950s mainframe computers with blinking lamps and spinning tape reels inside a glass tower; a few insect people in suits and lab coats carry boxes in and plug in cables, moving in. ${CAST} ${CLEAN}`,
    clip: 'The people carry boxes in and set them down; the tape reels spin; the lamps blink. The camera pans slowly.' },
  'f-pac-toast': { look: 'finale', refs: ['institute'], alone: true, still: `${FINALE} ${WHO.institute}, raising a glass of amber nectar in a toast, alone at a long banquet table set for many in a glass tower at night, a silent empty city below the windows. ${CLEAN}`,
    clip: 'The director raises his glass to nobody, drinks, and sets it down. The camera holds.' },
  'f-pac-empty': { look: 'finale', still: `${FINALE} A wide view of an empty city of their own architecture at dawn: wasp-paper towers and domes, empty streets, parked beetle-shaped cars, doors left open; no people; a thin mist; everything intact and quiet. ${CLEAN}`,
    clip: 'Mist drifts through the empty streets; a door swings slowly; nothing else moves. The camera pulls back slowly.' },
};

/** The press photographs of the clippings (content/media.ts `photo`). */
export const PHOTOS = {
  // Oct 1 2026 (Collins): the Delegation write in the CROPS. The card-field photo it replaces: art-src/media/photos/p-field.png (if recovered).
  'p-field': `${PRESS} Taken from a small crop-dusting aeroplane low over a vast golden wheat field: insect farmers in overalls and straw hats, with scythes and an old tractor-drawn mower, are cutting enormous curving furrows into the standing wheat, the beginning of a giant pattern far too big to make out from here; in front, two organisers with megaphones and a large paper plan call out directions. No letters, numbers or readable marks anywhere. ${CAST} ${CLEAN}`,
  'p-voice': { refs: ['faithful'], prompt: `${PRESS} ${WHO.faithful}, at a big ribbon microphone in a radio studio, one hand raised, eyes shut, sweating, mid-sermon; a studio clock and a round on-air lamp behind. ${CLEAN}` },
  // Oct 1 2026 (Collins): the Institute reach the ship with a laser, not a dish.
  'p-laser': { refs: ['institute'], prompt: `${PRESS} ${WHO.institute}, standing at night in front of an open observatory dome from which a perfectly straight thin bright laser beam shoots up into the starry sky, a headset round his neck and a handheld game console in his hand, looking smug at the camera. There is no satellite dish anywhere. ${CLEAN}` },
  'p-tea': { refs: ['delegation'], prompt: `${PRESS} ${WHO.delegation}, with three other elderly insect delegates in cardigans and flower garlands, sitting at a small folding table in a meadow taking tea from a flowered teapot, smiling serenely; in the far background a dark stain of creature flesh on the hills. ${CAST} ${CLEAN}` },
  'p-radios': `${PRESS} A crowd of insect townsfolk in 1950s coats and hats sitting on a grassy hillside at dusk, each holding a portable radio to the ear, listening intently, some with eyes closed; paper lanterns on poles. ${CAST} ${CLEAN}`,
  'p-labs': `${PRESS} Outside the glass doors of a modern laboratory building, the door handles chained together with a heavy padlocked chain; a group of insect engineers in lab coats and ties stand on the steps with cardboard boxes of their things, looking bewildered. ${CAST} ${CLEAN}`,
  'p-watch': `${PRESS} Night on a suburban corner of wasp-paper houses and lawns: three insect watchmen in caps and raincoats with electric lanterns and a radio headset stand staring at the lawns, where a dark living skin is coming up through the grass. Flash-lit. ${CAST} ${CLEAN}`,
  'p-silos': `${PRESS} A row of tall grain silos along a county road across flat farmland, dark creature flesh spread over their bases, a single abandoned farm truck shaped like a beetle on the road. Grey sky. ${CLEAN}`,
  'p-ossuary': `${PRESS} Bone-white chalk cliffs above a grey sea, carved with rows of burial niches and urns, black iron railings; a dark stain of creature flesh runs down the cliff from one opened niche. ${CLEAN}`,
  'p-delta': `${PRESS} Early morning mist on a delta channel: flat-bottomed boats loaded with families of insect people and their bundles are poled away from a village of reed houses on stilts. ${CAST} ${CLEAN}`,
  'p-ring': `${PRESS} Seen from a footbridge: a wide ring road of many lanes, empty but for round beetle-shaped buses and cars abandoned at angles, doors open; in the distance a dark stain of creature flesh on the road. ${CLEAN}`,
  // v1: a HUMAN press photographer walked into it.
  'p-jars': `${PRESS} Nobody in the picture: no photographer, no person, no human. A dim laboratory storeroom of steel shelves floor to ceiling, crowded with hundreds of glass specimen jars holding pale pink and red pieces of flesh in fluid, one shelf knocked over and broken, dark creature flesh creeping over the floor. Flash-lit. ${CLEAN}`,
  // v1: human brick houses.
  'p-street': `${PRESS} An empty suburban street after an evacuation, its houses their own architecture: pale wasp-paper walls of honeycomb cells, round cell doorways, small paper onion domes each with a plain gold ball, wax picket fences: a beetle-shaped family car left in the road with its doors open, a child's tricycle on its side, curtains blowing out of an open window. No people. ${CLEAN}`,
  'p-levy': `${PRESS} Morning in a suburban street: insect militia volunteers in their own 1950s clothes with orange sashes and oversized dome helmets pose cheering beside a patch of burned black ground, one holding up a flame projector's nozzle, housewives bringing a tray of drinks. ${CAST} ${CLEAN}`,
  'p-host': `${PRESS} A regiment of soldier-ants of the insect army in tall helmets and greatcoats marching out of a barracks gate at dawn, rifles on shoulders, bell-ringers with hand-bells at the front; families watching from the kerb. ${CAST} ${CLEAN}`,
};

/** The reveal cards' pictures (high quality, 1536x1024): what each faction woke into. */
export const REVEALS = {
  'delegation-reveal-end': { refs: ['delegation'], prompt: `${FINALE.replace('its last reel', 'a dream sequence')} A radiant meadow of impossible beauty under a golden sky: soft light, flowers glowing, a gentle pastel heaven. Thousands of insect people stand in it holding coloured cards over their heads, the cards forming great blocks of colour (not letters); in front ${WHO.delegation}, looking up with tears, not smiling now. A faint honeycomb pattern of light in the sky, as if the sky were made of cells. ${CAST} ${CLEAN}` },
  'faithful-reveal-end': { refs: ['faithful'], prompt: `${FINALE.replace('its last reel', 'a dream sequence')} A vast hall of glowing gold honeycomb cells rising up out of sight, in each cell a small point of warm light (a person dreaming); in front, on a golden floor, ${WHO.faithful}, furious, shouting into a big ribbon microphone that stands there on its own, arms raised in outrage. ${CLEAN}` },
  'institute-reveal-end': { refs: ['institute'], prompt: `${FINALE.replace('its last reel', 'a dream sequence')} A shining crystal city at sunrise built entirely in the director's honour: tall glass towers, giant statues of him in heroic poses (no inscriptions), crowds of adoring insect people cheering and throwing flowers; ${WHO.institute}, enthroned on a glass throne in front, beaming, a small crown on his head, completely alone in reality: every face in the crowd is his own face. ${CLEAN}` },
};

export const CLIP_TAIL = TAIL;

/** The newsreel voices (Veo 3.1 Lite speaking the exact line; the picture is thrown away). */
export const ANNOUNCER = {
  empire: (line) => `A black-and-white 1950s newsreel: close-up of a vintage ribbon microphone in a radio studio. An offscreen male newsreel announcer with a booming, chipper, fast mid-Atlantic accent says exactly: "${line}" Only his voice, no music.`,
  colony: (line) => `A black-and-white 1950s newsreel: close-up of a vintage ribbon microphone in a radio studio. An offscreen female newsreel announcer of the 1950s, crisp, earnest and brave, with a clear mid-Atlantic accent, says exactly: "${line}" Only her voice, no music.`,
  voice: (line) => `A 1950s black-and-white film: close-up of an old radio set glowing in a dark parlour. From its speaker a booming, fervent, gravelly baritone American radio evangelist of the 1950s, about sixty, rolling and rising like a preacher, says exactly: "${line}" Only his voice through the radio, no music, no other voices.`,
};

/** The music (Eleven Music v2, instrumental). */
export const MUSIC = {
  'm-empire': { seconds: 40, spec: { title: 'Clearance Review', genres: ['1950s newsreel march'], moods: ['jaunty', 'triumphant', 'cheerful'], tempo: 'fast',
    instruments: ['brass', 'snare drum', 'glockenspiel', 'tuba', 'strings'],
    freeform: 'The opening and background march of a 1950s newsreel: a bright brass fanfare, then a jaunty, bouncy, confident march, cheerful to the point of comedy, the sound of a proud propaganda reel. Keeps strict time the whole way. No vocals.' } },
  'm-colony': { seconds: 40, spec: { title: 'The Commonwealth Newsreel', genres: ['1950s newsreel', 'wartime home-front march'], moods: ['earnest', 'brave', 'hopeful'], tempo: 'medium',
    instruments: ['brass', 'strings', 'snare drum', 'timpani', 'bells'],
    freeform: 'The theme of a 1950s home-front newsreel of a nation at war: an earnest, brave brass-and-strings march with a sentimental, hopeful melody and a peal of bells, a people keeping its chin up. Mono-era orchestra. No vocals.' } },
  'm-end-delegation': { seconds: 36, spec: { title: 'Bear Witness', genres: ['1950s film score', 'elegy'], moods: ['tender', 'sad', 'peaceful'], tempo: 'slow',
    instruments: ['strings', 'celesta', 'harp', 'solo oboe'],
    freeform: 'The last scene of a 1950s film: a tender, slow elegy for strings with a lonely oboe and a celesta, peaceful and devastating, fading to nothing as the lights go out. No vocals.' } },
  'm-end-faithful': { seconds: 36, spec: { title: 'The Hour', genres: ['1950s epic film score'], moods: ['ecstatic', 'grand', 'uncanny'], tempo: 'slow',
    instruments: ['full orchestra', 'choir oohs', 'bells', 'timpani', 'brass'],
    freeform: 'The climax of a 1950s epic: a grand, rising, ecstatic hymn for full orchestra and wordless choir with pealing bells, just slightly off, slightly uncanny, too triumphant. Wordless choir only, no lyrics.' } },
  'm-end-institute': { seconds: 36, spec: { title: 'Rebuild It Right', genres: ['1950s corporate film score'], moods: ['pompous', 'self-satisfied', 'hollow'], tempo: 'medium',
    instruments: ['brass', 'strings', 'harp', 'timpani'],
    freeform: 'The finale of a 1950s corporate promotional film: a pompous, self-satisfied brass anthem, grandly hollow, like a company song played for a chairman. No vocals.' } },
};

/** The break's field audio (a text-to-video take with its own sound; the picture thrown away). */
export const FIELD = {
  'field-1': 'Sound only, no music, no speech. A raw field recording outdoors in a ruined town at dusk: wind, a distant bell tolling irregularly, far-off crackling fire, a far siren fading, a dog barking once very far away, and faint distant crying. Recorded on an old portable recorder, hiss and room tone. No music, no melody.',
};

// Shared with the cut-scene films (tools/media/cutscenes.ts): the same people, the same rules.
export { CROWD, CLEAN, CREATURE, WHO };
