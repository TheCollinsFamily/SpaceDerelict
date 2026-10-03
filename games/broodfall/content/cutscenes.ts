/**
 * THE CUT SCENES AS FILMS: THE SHOT LISTS (Collins, Oct 3 2026: "now that I am writing them I think videos make sense
 * for all of them"). One film per scene of content/campaign.ts that names a `film`: every beat, every finale, every
 * pledge. The WORDS are the scene's own lines there (one source); this file says how each line is shot.
 *
 * How a film is made (tools/media/cutscenes.ts; SPENDS RFab tokens):
 *   stills   the pictures its shots start from (STILLS below), each drawn in its look with its reference pictures
 *   clips    one clip per shot, image-to-video WITH SOUND: the speaker says the line on camera (a video model that
 *            performs the voice, as the Roach King's addresses); a shot with no line is action and room sound only
 *   check    every clip transcribed and compared with its line; each speaker's pitch compared across the film
 *   bake     each clip cut to its words, levelled, joined over one room tone → public/media/scenes/<film>.mp4, its
 *            poster, and the cues (which line is said when) in public/media/scenes/scenes.json
 * The game (src/ui/cutscene.ts) plays the baked film full screen with the line in type under it, then shows the
 * scene's card. A film that is not baked yet is simply its card.
 *
 * Rules (tests/cutscenes.test.ts): every line of a filmed scene is spoken by exactly one shot, in order; a spoken
 * line is at most 22 words (a clip is 8 s) and has no word in capitals (a video voice spells it out).
 *
 * WHO IS SEEN. The insect people are those of the scene pictures (1950s science-fiction film people, the leaders'
 * portraits as references). The technician is seen FROM THE FRONT in these films, because the scripts are written on
 * his reactions (he pinches his nose, his mouth falls open); the style bible's rule 9 ("we usually only see him from
 * behind") is kept everywhere else. His face is the approved portrait (notes/concepts/2026-09-29/r4-hero-portrait.png).
 * On the planet he is a HOLOGRAM (DESIGN.md "no direct contact"); on calls he is at his console on the ship.
 */
import type { FactionId } from './campaign';

/** The look a picture is drawn in. */
export type FilmLook =
  | 'colony'    // their world: a 1950s colour science-fiction film (the scene pictures' look)
  | 'feed'      // their world as it reaches the ship on a video feed (the same look, framed by a fixed camera)
  | 'ship'      // aboard the Merciful Yoke: lifelike hard science fiction, dark and exact
  | 'archive';  // inside the archive: the same film as a dream sequence, radiant

export interface FilmStill {
  look: FilmLook;
  /** What the picture shows. WHO / HOLO / TECH stand for the leader, his hologram, and him in the flesh. */
  shows: string;
  /** Reference pictures: 'leader' (the faction's portrait), 'hero' (his portrait), or another still's id. */
  refs: string[];
}

export interface FilmShot {
  /** The clip's id inside its film. A spoken shot is `l<line>`; a silent one is named. */
  id: string;
  /** The still it starts from; '^' continues from the last frame of the shot before (one take cut in two). */
  from: string;
  /** The scene line it speaks (its place in the scene's lines); none: nobody speaks. */
  line?: number;
  /** What happens in the shot, for the video model. */
  action: string;
  /** Seconds, for a shot with no line (a spoken shot's length follows its words). */
  secs?: 4 | 6 | 8;
  /** What is heard in a shot with no line. */
  sound?: string;
}

export interface Film {
  id: string;
  faction: FactionId;
  /** The room tone laid under the whole film (a few words for the sound model; the bake loops it quietly). */
  room: string;
  shots: FilmShot[];
}

/** A spoken shot: its line is its place among the film's spoken shots (numbered below), so a line split in two is one more `say`. */
const say = (from: string, action: string): FilmShot => ({ id: '', from, line: -1, action });
const cut = (id: string, from: string, action: string, secs: 4 | 6 | 8, sound: string): FilmShot => ({ id, from, action, secs, sound });

// ---------------------------------------------------------------------------
// The pictures. An id is shared between films when the place is the same (his console, the delegates' camera).
// ---------------------------------------------------------------------------
const HOTEL =
  'a rentable conference room in a provincial hotel, and heavy with it: a low ceiling of square acoustic tiles with flat ' +
  'fluorescent panels, a loud maroon and gold patterned carpet, beige folding partition walls, stacking banquet chairs ' +
  'with gold frames, round tables under white cloths with pleated skirts, a potted palm, a string of pastel balloons and a ' +
  'blank pastel banner, and along one wall a long refreshments table with a chrome coffee urn, paper cups, plates of ' +
  'biscuits and little triangular sandwiches';
const COMMITTEE =
  'their committee room: pastel paper bunting, a tea urn and flowered cups on a side table, folding chairs, a ' +
  'noticeboard of blank coloured cards, knitted cushions';
const PRAYER_HALL =
  'a vast prayer hall of their Faith: a great dome overhead inlaid with gold hexagons, rows of slender columns and pointed ' +
  'arches, hundreds of small hanging oil lamps, a deep patterned carpet over the whole floor, a tall carved pulpit with ' +
  'a staircase, tiled walls in blue and gold hexagons';
const CHAMBERS =
  'the preacher\'s private chambers, a grand room like a prince of the church\'s: a frescoed vaulted ceiling of clouds and ' +
  'gold honeycomb, walls of deep red damask, tall arched windows with heavy curtains, a huge carved and gilded desk, a ' +
  'high-backed gilded chair, tall candlesticks, a globe, shelves of great bound books';
const CHURCH =
  'the great central church of the Seventh City: a long nave of dark wooden pews full of worshippers, a high vaulted ' +
  'ceiling, tall windows of plain coloured glass in hexagon panes, a raised altar under a canopy with three lamps';
const OFFICE =
  'his cluttered office at the Institute: a wide desk buried in takeout boxes and energy drink cans, a big whiteboard ' +
  'behind him covered in abstract diagrams and curves (no writing), a beanbag, a ring light, a ranging telescope seen ' +
  'through the window in an observatory dome';
const MEADOW =
  'a serene meadow of impossible beauty under a golden sky: soft light, long grass and wild flowers that glow faintly, a ' +
  'gentle pastel heaven, and a faint honeycomb pattern of light in the sky, as if the sky were made of cells';
const CONSOLE =
  'his long matte black console desk aboard the ship, a curved window behind him onto the night side of the planet with ' +
  'its spreading red stain';

export const STILLS: Record<string, FilmStill> = {
  // ---- the technician aboard (shared by the calls, the pledges and the ends of the finales)
  'ship-desk': { look: 'ship', refs: ['hero'], shows: `A medium shot, from the front, of TECH, seated at ${CONSOLE}, lit from below by the pale glow of a screen that is out of frame in front of him, looking at it.` },
  'ship-close': { look: 'ship', refs: ['hero', 'ship-desk'], shows: `A close-up, head and shoulders, from the front, of TECH, exactly the man and the room of the second reference picture, seated at ${CONSOLE}, lit by the pale glow of a screen out of frame in front of him.` },
  'ship-pace': { look: 'ship', refs: ['hero', 'ship-desk'], shows: 'A medium-wide shot of TECH, exactly the man of the reference pictures, on his feet in the dark operations bay of the ship beside his black console desk and pushed-back chair, one hand in his hair, mid-stride, the curved window onto the red-stained planet behind him.' },
  'ship-headset': { look: 'ship', refs: ['hero', 'ship-desk'], shows: 'A medium shot, from the front, of TECH, exactly the man of the reference pictures, seated in a black chair in the dark operations bay of the ship, lifting a slim matte black visor headset up off his eyes with both hands, the curved window onto the planet behind him.' },
  'ship-broadcast': { look: 'ship', refs: ['hero', 'ship-desk'], shows: 'A medium shot, from the front, of TECH, exactly the man of the reference pictures, standing very straight behind his black console as if at a lectern, hands flat on it, looking directly into the camera, a single small red light glowing on the console in front of him, the curved window and the whole planet behind him.' },

  // ---- the Delegation
  'summit-wide': { look: 'colony', refs: ['leader', 'hero'], shows: `A wide shot of ${HOTEL}. In the middle of the room stands WHO with her upper arms open in welcome, and around her a dozen delegates, elderly insect people in cardigans and flower garlands, all beaming. In the left foreground, seen from behind, stands HOLO above a small matte black projector pod on the carpet, facing them.` },
  'summit-del': { look: 'colony', refs: ['leader', 'summit-wide'], shows: `A medium shot, from the front, of WHO, standing in ${HOTEL}, exactly the room of the second reference picture, beaming, the refreshments table and four delighted delegates in cardigans and garlands behind her.` },
  'summit-you': { look: 'colony', refs: ['hero', 'summit-wide'], shows: `A medium shot, from the front, waist up, of HOLO, standing in ${HOTEL}, exactly the room of the second reference picture: the patterned carpet, the banquet chairs and the fluorescent ceiling are seen faintly through his translucent body. He stands in the middle of the frame, facing the camera, and is by far the largest figure in the picture, filling it from the waist to just above his head; the chief delegate is not in this picture. Behind him, small and out of focus, a few delegates by the far wall.` },
  'summit-you-close': { look: 'colony', refs: ['hero', 'summit-you'], shows: 'A close-up, head and shoulders, from the front, of HOLO, exactly the hologram and the hotel conference room of the second reference picture, the fluorescent ceiling seen faintly through him, thinking.' },
  'summit-del-close': { look: 'colony', refs: ['leader', 'summit-del'], shows: 'A close-up, head and shoulders, from the front, of WHO, exactly as in the second reference picture and in the same hotel conference room, smiling proudly, the refreshments table out of focus behind her.' },
  'summit-two': { look: 'colony', refs: ['leader', 'hero', 'summit-wide'], shows: `A two-shot from the side in ${HOTEL}, exactly the room of the third reference picture: on the right WHO, holding a plate of biscuits out in two hands, and on the left HOLO, facing her, looking down at the plate; the refreshments table behind them, delegates watching fondly.` },
  'del-feed': { look: 'feed', refs: ['leader'], shows: `WHO, close to the lens in the middle, with five excited delegates in cardigans and flower garlands squeezed in behind and beside her to get into the picture, in ${COMMITTEE}.` },
  'del-feed-close': { look: 'feed', refs: ['leader', 'del-feed'], shows: 'A close-up of WHO, exactly as in the second reference picture and in the same room, very near the lens, serene and certain, two delegates\' faces just in frame behind her shoulders.' },
  'del-lastroom': { look: 'colony', refs: ['leader'], shows: `A small upper room, the last one: WHO and a dozen delegates in cardigans and garlands huddled together in the middle of ${COMMITTEE.replace('their committee room', 'a committee room')}, while the dark maroon veined living skin of a giant creature and its glistening dark-red tendrils burst in through the cracking walls and the door on every side.` },
  'del-field-wide': { look: 'archive', refs: ['leader', 'hero'], shows: `A wide shot of ${MEADOW}. A crowd of delegates in cardigans and flower garlands stand about in it, bewildered, looking at their own hands; in front WHO, furious, strides toward HOLO, who has just appeared in the grass on the left and stands with his hands half raised.` },
  'del-field-del': { look: 'archive', refs: ['leader', 'del-field-wide'], shows: `A medium shot, from the front, of WHO, furious, antennae flat back, in ${MEADOW}, exactly the meadow of the second reference picture, bewildered delegates behind her.` },
  'del-field-you': { look: 'archive', refs: ['hero', 'del-field-wide'], shows: `A medium shot, from the front, waist up, of HOLO, standing in ${MEADOW}, exactly the meadow of the second reference picture, the glowing grass seen faintly through him, mildly confused.` },
  'pledge-del': { look: 'colony', refs: ['leader', 'summit-wide'], shows: `WHO and a crowd of delegates in cardigans and garlands, in ${HOTEL}, exactly the room of the second reference picture, all gathered round a big 1950s wooden television set on a trolley whose screen glows pale blue (nothing can be made out on it), hands clasped, rapt.` },

  // ---- the Faithful
  'hall-wide': { look: 'colony', refs: ['leader', 'hero'], shows: `A wide shot of ${PRAYER_HALL}, empty but for two figures in the middle of the carpet: WHO, bowed low to the floor on his knees, and in front of him HOLO, standing above a small matte black projector pod, looking around.` },
  'hall-voice': { look: 'colony', refs: ['leader', 'hall-wide'], shows: `A medium shot, from the front and a little above, of WHO, kneeling on the carpet of ${PRAYER_HALL}, exactly the hall of the second reference picture, his head raised from a deep bow, two hands flat on the carpet, eyes shining.` },
  'hall-you': { look: 'colony', refs: ['hero', 'hall-wide'], shows: `A medium shot, from the front, waist up, of HOLO, standing in ${PRAYER_HALL}, exactly the hall of the second reference picture, the columns and hanging lamps seen faintly through him, taken aback.` },
  'hall-vests': { look: 'colony', refs: ['leader', 'hall-wide'], shows: `WHO, standing with his upper arms raised in ${PRAYER_HALL}, exactly the hall of the second reference picture, one lower hand held out toward a great heap of canvas vests with rows of pouches and loops of wire piled on the carpet beside a column.` },
  'chambers-wide': { look: 'colony', refs: ['leader', 'hero'], shows: `A wide shot of ${CHAMBERS}. WHO stands by his desk with one hand on his chest, bowing a little; facing him across the carpet stands HOLO, above a small matte black projector pod, arms out in exasperation.` },
  'chambers-voice': { look: 'colony', refs: ['leader', 'chambers-wide'], shows: `A medium shot, from the front, of WHO, standing by the gilded desk in ${CHAMBERS}, exactly the room of the second reference picture, one hand on his chest, a small knowing smile.` },
  'chambers-you': { look: 'colony', refs: ['hero', 'chambers-wide'], shows: `A medium shot, from the front, waist up, of HOLO, standing in ${CHAMBERS}, exactly the room of the second reference picture, the red damask and the candlesticks seen faintly through him, exasperated.` },
  'church-creep': { look: 'colony', refs: ['leader'], shows: `${CHURCH.replace('the great', 'Inside the great')}, WHO in the pulpit with his arms raised; the dark maroon veined living skin of a giant creature and its glistening dark-red tendrils are bursting in through the tall windows and the doors, plaster and coloured glass falling, the worshippers on their feet.` },
  'church-whole-wide': { look: 'archive', refs: ['leader', 'hero', 'church-creep'], shows: `${CHURCH.replace('the great', 'A wide shot inside the great')}, exactly the church of the third reference picture but whole, clean and full of golden light, no creature anywhere: every worshipper sits in her pew exactly where she was, looking about in wonder; WHO stands in the aisle; and at the altar stands HOLO, one hand raised in a small wave.` },
  'church-voice': { look: 'archive', refs: ['leader', 'church-whole-wide'], shows: 'A medium shot, from the front, of WHO, standing in the aisle of the church of the second reference picture, golden light on him, worshippers in the pews behind him, looking up toward the altar.' },
  'church-you': { look: 'archive', refs: ['hero', 'church-whole-wide'], shows: 'A medium shot, from the front, waist up, of HOLO, standing at the altar of the church of the second reference picture under its canopy and three lamps, golden light, the altar seen faintly through him, relaxed.' },
  'pledge-fai': { look: 'colony', refs: ['leader', 'hall-wide'], shows: `WHO and a great congregation of insect people in dark robes and headscarves on their knees on the carpet of ${PRAYER_HALL}, exactly the hall of the second reference picture, all turned toward a big 1950s wooden radio set that stands on the pulpit steps, hands raised.` },

  // ---- the Institute
  'dir-feed': { look: 'feed', refs: ['leader'], shows: `WHO, leaning far back in a gaming chair with both feet up on the desk and a handheld game console in two of his hands, half turned to grin at someone off screen, in ${OFFICE}.` },
  'dir-feed-up': { look: 'feed', refs: ['leader', 'dir-feed'], shows: 'WHO, exactly as in the second reference picture and in the same office, now sitting upright at the desk with his feet off it, leaning toward the lens on his elbows, the game console lying on the desk beside a paper file.' },
  'dir-feed-mag': { look: 'feed', refs: ['leader', 'dir-feed'], shows: 'WHO, exactly as in the second reference picture and in the same office, holding a pulp science-fiction magazine up to the lens with one hand and pointing at its cover with another: the painted cover shows a heroic insect starship captain in a gold tunic with a green-skinned insect woman and a blue-skinned insect woman draped on his arms (no title, no lettering on it).' },
  'spire-creep': { look: 'colony', refs: [], shows: 'A tall tower of glass and chrome among other glass spires at dusk, and the dark maroon veined living skin of a giant creature climbing it on every side, its glistening dark-red tendrils wrapping the lower floors, lights going out floor by floor. Painted orange and violet sky.' },
  'spire-saferoom': { look: 'colony', refs: ['leader'], shows: 'A corridor of glass and chrome inside the tower, red emergency light: WHO shoving two insect colleagues in lab coats aside with all four arms as he squeezes first through a heavy round vault door into a small steel safe room where several staff already crouch; dark-red tendrils coming round the far corner of the corridor.' },
  'ins-meadow-wide': { look: 'archive', refs: ['leader', 'hero'], shows: `A wide shot of ${MEADOW}. A handful of insect staff in lab coats sit up in the grass, dazed; in front WHO, on his feet and angry, marches toward HOLO, who has just appeared in the grass on the left.` },
  'ins-meadow-dir': { look: 'archive', refs: ['leader', 'ins-meadow-wide'], shows: `A medium shot, from the front, of WHO, livid, jabbing a finger forward, in ${MEADOW}, exactly the meadow of the second reference picture, dazed staff in lab coats in the grass behind him.` },
  'ins-meadow-you': { look: 'archive', refs: ['hero', 'ins-meadow-wide'], shows: `A medium shot, from the front, waist up, of HOLO, standing in ${MEADOW}, exactly the meadow of the second reference picture, the glowing grass seen faintly through him, puzzled and patient.` },
  'pledge-ins': { look: 'feed', refs: ['leader', 'dir-feed'], shows: 'WHO, exactly as in the second reference picture and in the same office, sitting forward and watching a monitor at the side of his desk whose screen glows pale (nothing can be made out on it), one fist half raised, delighted with himself.' },
};

// ---------------------------------------------------------------------------
// The films. Line numbers are places in the scene's `lines` (content/campaign.ts).
// ---------------------------------------------------------------------------
const HOTEL_TONE = 'the flat hum of fluorescent lights and an air conditioner in a carpeted hotel conference room, a faint murmur of a small polite crowd, a cup set down now and then';
const SHIP_TONE = 'the low steady hum of a small starship: air handling, a faint electrical tone, nothing else';
const HALL_TONE = 'the huge hushed echo of an empty domed prayer hall, a faint draught, oil lamps guttering';
const CHAMBER_TONE = 'the quiet of a grand old room: a slow clock, a faint draught in heavy curtains';
const MEADOW_TONE = 'a warm meadow: soft wind in long grass, far birdsong, a faint shimmering tone';

export const FILMS: Film[] = [
  // ======================================================================== THE FRIENDSHIP DELEGATION
  { id: 'delegation-understand', faction: 'delegation', room: HOTEL_TONE, shots: [
    cut('open', 'summit-wide', 'The small black pod on the carpet hums, and the hologram of the young man flickers and steadies above it. The delegates gasp with delight and clap their hands; the chief delegate, the insect woman in the blue-grey cardigan, opens her upper arms wide in welcome and nods, her antennae lifting. Every delegate has an insect head with antennae and large amber eyes the whole time: no human face is seen anywhere in the room.', 6, 'the rising hum of a projector, gasps of delight, warm applause from a dozen people, the buzz of fluorescent lights'),
    say('summit-del', 'She steps forward beaming with her upper arms spread in welcome, then waves two hands at the refreshments table behind her.'),
    say('summit-you', 'He looks round the room, perplexed, then back at her with his brow furrowed.'),
    say('summit-del', 'She presses two hands together, serene and certain, nodding as she explains; the delegates behind her nod along.'),
    say('summit-you', 'He blinks and tilts his head, honestly puzzled.'),
    say('summit-del', 'She opens her upper hands like a patient teacher, then leans in with a questioning tilt of her antennae.'),
    say('summit-you', 'He looks up and aside, thinking it over, then nods slowly and admits it.'),
    say('summit-you-close', 'He strokes his chin and works it out as he speaks, eyes unfocused, slowly persuading himself.'),
    say('summit-you', 'His eyebrows go up; he nods, a little surprised to find that he agrees, and opens one hand.'),
    say('summit-del', 'She claps all four hands in delight, and the delegates behind her burst into applause, nodding hard.'),
    say('summit-you', 'He shifts his weight, practical now, and spreads his hands in a small asking gesture.'),
    say('summit-del', 'She leans in and lowers her voice like someone sharing good gossip, sweeping one hand in a wide circle.'),
    say('summit-del-close', 'She holds up one finger, smiling proudly, then flicks her hand as if brushing something off a table.'),
    cut('end', 'summit-two', 'She holds the plate of biscuits out to him, insisting kindly. He does not touch the plate: he lifts one open hand in a polite no-thank-you and gestures down at his own see-through body of light with an apologetic little shrug. She looks at the plate, nods warmly, takes a biscuit herself with a lower hand and nibbles it, delighted anyway.', 6, 'the hum of the projector, a fond murmur from the delegates, a paper cup set down'),
  ] },
  { id: 'delegation-pledge', faction: 'delegation', room: SHIP_TONE, shots: [
    say('ship-broadcast', 'He clears his throat, stands a little straighter and addresses the camera, stiff and formal, like a man reading a notice.'),
    say('^', 'A small pause; he says it plainly, then glances off to one side, unsure whether that was all right.'),
    cut('cheer', 'pledge-del', 'The delegates round the television burst into applause, hugging one another, garlands swinging; the chief delegate dabs her eyes.', 4, 'a room of people cheering and clapping, happy sobbing'),
  ] },
  { id: 'delegation-stop-war', faction: 'delegation', room: SHIP_TONE, shots: [
    say('del-feed', 'She waves at the lens with two hands, bursting with good news; the delegates behind her wave too and jostle to be seen.'),
    say('^', 'She holds a thick paper folder up to the lens with both upper hands, proud as a schoolgirl.'),
    say('ship-desk', 'He leans toward the screen, squinting at it, confused.'),
    say('del-feed-close', 'She says it simply and sweetly, with a small serene nod, as if it explained everything.'),
    say('ship-desk', 'He raises one finger and works through it slowly, sure he must have missed something.'),
    say('del-feed-close', 'She shakes her head gently, smiling, and counts three things off on three hands.'),
    say('^', 'She opens her hands wide, reasonable and warm; the delegates behind her nod firmly.'),
    say('ship-close', 'He shuts his eyes and pinches the bridge of his nose, lets out a breath, and gives up.'),
  ] },
  { id: 'delegation-gaia', faction: 'delegation', room: SHIP_TONE, shots: [
    say('del-feed', 'She leans into the lens, thrilled; the delegates crowd in behind her.'),
    say('^', 'She nods along with her own words and ends with a triumphant little lift of her antennae.'),
    say('del-feed-close', 'She unrolls a paper map in two hands and taps points on it with a third, like a detective.'),
    say('^', 'She shakes her head slowly and happily, one finger raised.'),
    say('del-feed', 'She lays two hands on her chest, moved; a delegate behind her wipes an eye.'),
    say('ship-desk', 'He frowns at the screen and half raises a hand, trying to be helpful.'),
    say('del-feed-close', 'She wags a finger, pleased to be a step ahead of him.'),
    say('^', 'She sweeps two hands across the map and piles an invisible heap with the others.'),
    say('del-feed', 'She beams, blows a kiss at the lens with two hands and reaches forward; the picture cuts to black.'),
    say('ship-close', 'He stares at the dead screen, then says it to nobody, flatly.'),
    say('^', 'He rubs his jaw and turns to look away at the window, thoughtful.'),
  ] },
  { id: 'delegation-reveal', faction: 'delegation', room: SHIP_TONE, shots: [
    say('del-feed', 'She leans into the lens, delighted, a sheaf of notes in two hands.'),
    say('ship-desk', 'He cuts across her with one flat hand raised, tired.'),
    say('del-feed', 'She stops, looks left and right at the delegates beside her, who look back at her, all of them lost.'),
    say('ship-desk', 'He leans back and explains it like a man quoting a history book, one hand turning in the air.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('^', 'He goes on, counting it out on his fingers.'),
    say('ship-close', 'He shakes his head slowly at the memory of the textbook.'),
    say('^', 'He opens one hand, as if setting something down on the desk.'),
    say('ship-desk', 'He leans forward and says it straight at the screen, as plainly as he can.'),
    say('^', 'He taps the desk with one finger on each point.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('del-feed-close', 'She chuckles warmly and pats her chest with one hand, relieved; the delegates behind her smile.'),
    say('ship-close', 'His eyes go wide; he throws both hands up.'),
    say('del-feed-close', 'She nods kindly, as if confirming a booking.'),
    say('del-feed', 'She brightens and holds up a pamphlet in two hands; a delegate behind her holds up a chart of a single rising curve.'),
    say('^', 'She raises one finger and leans in, the beginning of a long lecture.'),
    say('ship-pace', 'He slaps a control without looking and paces away from the desk, shaking his head, hands in his hair.'),
    say('^', 'He stops, shuts his eyes, breathes in through his nose and lowers his hands, palms down.'),
  ] },
  { id: 'delegation-finale', faction: 'delegation', room: MEADOW_TONE, shots: [
    cut('burst', 'del-lastroom', 'The walls crack and the dark red living skin pours through them; tendrils whip across the room; the delegates cling to one another; the picture floods with red and goes to white.', 6, 'timber and plaster cracking, a wet tearing roar, cries, then silence'),
    cut('wake', 'del-field-wide', 'The delegates stand in the glowing grass looking at their own hands. The hologram flickers into being on the left. The chief delegate turns, sees him and strides at him, furious.', 6, 'soft wind in long grass, far birdsong, a faint shimmer, a gasp'),
    say('del-field-del', 'She storms up to the camera, antennae flat back, jabbing a finger.'),
    say('del-field-you', 'He looks about the meadow and back at her, mildly confused that she is asking.'),
    say('del-field-del', 'She spreads all four arms at the meadow, appalled.'),
    say('del-field-you', 'He explains it reasonably, turning one hand over.'),
    say('^', 'He goes on, nodding, as if listing features.'),
    say('^', 'He holds out his palm; a red apple made of pale light draws itself into being on it; he offers it.'),
    say('del-field-del', 'She clutches her head with two hands and cries it out.'),
    say('del-field-you', 'He shrugs, lightly.'),
    say('del-field-del', 'She points at her own chest, shaking with anger.'),
    say('del-field-you', 'He tilts his head and lifts one shoulder.'),
    say('del-field-del', 'She stamps a foot in the grass.'),
    say('del-field-you', 'He says it mildly, as a plain fact.'),
    say('del-field-del', 'She throws her head back and screams it at the golden sky, all four fists clenched.'),
    say('del-field-you', 'He recoils a little, shocked, then holds up both hands, backing out of the conversation; he flickers and is gone.'),
    say('ship-headset', 'He lifts the visor off his eyes, blinks, and lets out a long breath.'),
    say('^', 'He sets the headset down on his knee and shakes his head, relieved.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
  ] },

  // ======================================================================== THE FAITHFUL OF THE LAST HOUR
  { id: 'faithful-signs', faction: 'faithful', room: HALL_TONE, shots: [
    cut('open', 'hall-wide', 'The pod hums and the hologram steadies above it. The preacher, bowed to the carpet, does not move. The young man looks up at the dome and round the empty hall.', 6, 'the hum of a projector echoing in a huge empty hall, oil lamps guttering'),
    say('hall-voice', 'He raises his head from the carpet and speaks with slow, joyful gravity.'),
    say('^', 'He lifts one hand toward the dome, then draws it down like a blade.'),
    say('hall-you', 'He glances about, taken aback, and holds up his hands, trying to be kind.'),
    say('hall-voice', 'Without a pause he lays a hand on his chest and bows his head.'),
    say('hall-you', 'He leans forward, earnest, encouraging.'),
    say('hall-voice', 'He looks up with a small knowing smile and opens two hands.'),
    say('hall-you', 'He scratches his chin, thinks, and concedes it with a nod.'),
    say('hall-vests', 'He rises to his full height and lifts his upper arms to the dome.'),
    say('^', 'He turns and points with two hands at the great heap of vests, proud.'),
    say('ship-pace', 'He walks in a tight circle beside his desk with both hands in his hair.'),
  ] },
  { id: 'faithful-pledge', faction: 'faithful', room: SHIP_TONE, shots: [
    say('ship-broadcast', 'He addresses the camera, stiff and formal, reading it as much as saying it.'),
    say('^', 'He hesitates, then says the last words firmly and nods once.'),
    cut('kneel', 'pledge-fai', 'The congregation round the radio cry out and bow to the carpet in a wave; the preacher lifts his arms to the dome.', 4, 'a great crowd crying out in joy in a huge echoing hall'),
  ] },
  { id: 'faithful-prophecy', faction: 'faithful', room: CHAMBER_TONE, shots: [
    say('chambers-you', 'He appears mid-sentence, arms out, exasperated.'),
    say('^', 'He points a finger, trying to be firm.'),
    say('chambers-voice', 'He lays a hand on his chest and bows a little, quite calm.'),
    say('chambers-you', 'He looks away and admits it through his teeth.'),
    say('chambers-voice', 'He lifts one finger gently and tilts his head, asking.'),
    say('chambers-you', 'He looks at the floor, sheepish.'),
    say('^', 'He looks up again and offers it with open hands, meaning it.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('chambers-voice', 'He smirks and weighs two things in two hands.'),
    say('^', 'He folds his hands, the smile fading into thought.'),
    say('chambers-voice', 'He walks a slow step toward the window, thinking aloud.'),
    say('chambers-you', 'He starts out reasonable and trips over the last words, wincing.'),
    say('chambers-voice', 'He turns back, serene, one hand raised toward heaven.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('chambers-you', 'He shrugs, beaten.'),
    say('chambers-voice', 'He nods once, closing the matter, and bows.'),
  ] },
  { id: 'faithful-prepare', faction: 'faithful', room: CHAMBER_TONE, shots: [
    say('chambers-you', 'He appears with his hands together, asking nicely this time.'),
    say('chambers-voice', 'He smirks and raises one hand, wise and unhurried.'),
    say('chambers-you', 'He shakes his head.'),
    say('chambers-voice', 'He tilts his head, as if it were the most natural question.'),
    say('chambers-you', 'He squints and turns one hand over.'),
    say('chambers-voice', 'He lays one hand on a great bound book on the desk and lifts the other.'),
    say('^', 'He traces an arc across the ceiling with one hand.'),
    say('chambers-you', 'He thinks about it, tips his head from side to side, and accepts it.'),
    say('chambers-voice', 'He smiles, satisfied, and folds his hands into his sleeves.'),
  ] },
  { id: 'faithful-finale', faction: 'faithful', room: 'the hush of a great church full of people holding their breath, a faint golden shimmer', shots: [
    cut('burst', 'church-creep', 'The windows burst and the dark red living skin pours down the walls; the vault cracks and falls; the worshippers cry out; the picture floods with red and goes to white.', 6, 'glass bursting, stone falling, a wet roar, a congregation crying out, then silence'),
    cut('whole', 'church-whole-wide', 'The church is whole and golden. Every worshipper sits in her pew where she was, looking at her hands and at her neighbours. At the altar the hologram flickers into being and gives a small wave.', 6, 'a held breath in a great church, a soft shimmer, pews creaking'),
    say('church-you', 'He claps his hands once and rubs them together, cheerful, like a man closing a meeting.'),
    say('church-voice', 'He looks at his own hands, then up, quiet and hopeful.'),
    say('church-you', 'He tips his hand from side to side.'),
    say('church-voice', 'He recites it, one hand on his chest.'),
    say('church-you', 'He nods, looking round the church approvingly.'),
    say('church-voice', 'He staggers back a step in horror, hands rising.'),
    say('church-you', 'He frowns, honestly asking.'),
    say('^', 'He gestures round at the golden church.'),
    say('church-voice', 'He thrusts a finger at the altar, shaking.'),
    say('church-you', 'He folds his arms and says it down to him, coolly.'),
    say('^', 'He lifts one finger and lets it fall.'),
    say('church-voice', 'He comes forward up the aisle, furious, jabbing two fingers.'),
    say('^', 'He beats his chest once with a fist and throws the hand out at the altar.'),
    say('church-you', 'His arms drop; he stares, wholly thrown.'),
    say('^', 'He shakes his head slowly, one hand out toward the vault.'),
    say('^', 'He lets out a breath, waves the whole thing away, flickers and is gone.'),
  ] },

  // ======================================================================== THE INSTITUTE FOR LONG-TERM HIVE FLOURISHING
  { id: 'institute-machines', faction: 'institute', room: SHIP_TONE, shots: [
    say('dir-feed', 'He grins over his shoulder at someone off screen and points a thumb at the lens.'),
    say('ship-desk', 'He frowns at the screen.'),
    say('dir-feed', 'He turns to the lens, smug, and shoots a finger gun.'),
    say('ship-desk', 'He shakes his head, bewildered.'),
    say('^', 'He explains it with small precise movements of two fingers.'),
    say('dir-feed', 'He holds up one knowing finger and taps his temple with another hand.'),
    say('ship-close', 'He shakes his head and gives up on it.'),
    say('dir-feed', 'He goes back to his game, thumbs working, talking without looking up.'),
    say('dir-feed-up', 'He sets the game down, swings his feet off the desk, and announces it with a flourish of two hands.'),
    say('^', 'He picks up a paper file and taps a line of pale powder out of it onto the desk as he talks.'),
    say('^', 'He bends to the desk and snuffs the line up, sits back blinking, and points at the lens.'),
    say('dir-feed-up', 'He rolls his eyes and waves a hand at the world outside his window.'),
    say('^', 'He rubs two fingers together, disgusted.'),
    say('dir-feed-up', 'He gets animated, pointing at the lens with one hand, bouncing in the chair.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('^', 'He spreads all four hands, generous.'),
    say('ship-desk', 'He draws back a little, faintly horrified, choosing his words.'),
    say('dir-feed-up', 'He lights up and slaps the desk, delighted.'),
    say('ship-close', 'His eyebrows shoot up.'),
    say('dir-feed-up', 'He chuckles and shrugs with all four arms.'),
    say('ship-close', 'He stares, worried.'),
    say('^', 'He rubs his forehead and waves it through.'),
  ] },
  { id: 'institute-pledge', faction: 'institute', room: SHIP_TONE, shots: [
    say('ship-broadcast', 'He addresses the camera, stiff and formal, like a public notice.'),
    say('^', 'He finishes it and nods once, uncertain how it went.'),
    cut('fist', 'pledge-ins', 'The Director pumps a fist at his monitor, spins his chair once and points at the screen with two hands.', 4, 'a chair spinning, a whoop'),
  ] },
  { id: 'institute-pipeline', faction: 'institute', room: SHIP_TONE, shots: [
    say('ship-desk', 'He leans toward the screen, wary.'),
    say('dir-feed', 'He shoots two finger guns at the lens without putting the game down.'),
    say('^', 'He squints at the lens over the game.'),
    say('ship-desk', 'He glances left and right as if for help.'),
    say('dir-feed', 'He shrugs, grinning, man to man.'),
    say('ship-close', 'He recoils.'),
    say('dir-feed-mag', 'He holds the magazine up to the lens and taps its cover.'),
    say('^', 'He taps the two painted women on the cover in turn.'),
    say('ship-desk', 'He explains it patiently, as to a child.'),
    say('dir-feed-up', 'He sets the game down and leans in on his elbows, coaxing.'),
    say('^', 'He leans back and grins at the ceiling.'),
    say('ship-desk', 'He shakes his head and counts the problem out on his fingers.'),
    say('^', 'He lets his hands fall.'),
    say('dir-feed-up', 'He laughs and waves the whole idea away.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('^', 'He explains it with a circle of one hand, very pleased.'),
    say('^', 'He points up at the ceiling with two thumbs.'),
    say('ship-close', 'He sputters, both hands up.'),
    say('dir-feed-up', 'He pats the air with two hands, soothing.'),
    say('ship-close', 'His mouth hangs open; then something dawns on him and he leans slowly toward the screen.'),
    say('dir-feed-up', 'He throws his head back and laughs.'),
    say('ship-close', 'He reaches forward and kills the feed, sits very still, and says it under his breath.'),
  ] },
  { id: 'institute-ultimatum', faction: 'institute', room: SHIP_TONE, shots: [
    say('ship-desk', 'He leans toward the screen, resigned.'),
    say('dir-feed-up', 'He opens two hands wide, expansive.'),
    say('^', 'He leans on his elbows and points lazily at the lens.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('ship-close', 'He does not speak aloud: his eyes narrow a little and he gives the smallest nod, thinking it.'),
    say('dir-feed-up', 'He lays a hand on his chest, then turns two palms up.'),
    say('^', 'He shrugs it off.'),
    say('dir-feed-up', 'He bounces in the chair and grabs a marker.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('^', 'He draws boxes in the air with two hands.'),
    say('dir-feed-up', 'He stops, blinks, and comes back to the lens with a grin.'),
    say('^', 'He points at the lens and then at himself.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('dir-feed-up', 'He rubs the back of his neck and counts on his fingers.'),
    say('^', 'He holds up one finger like a man with a plan.'),
    say('^', 'He waves it off, obvious.'),
    say('ship-close', 'He shakes his head and lets it go.'),
  ] },
  { id: 'institute-finale', faction: 'institute', room: MEADOW_TONE, shots: [
    cut('tower', 'spire-creep', 'The dark red living skin climbs the glass tower floor by floor and the lights go out behind it.', 4, 'a low wet roar, glass creaking, distant alarms'),
    cut('shove', 'spire-saferoom', 'He shoves the two in lab coats aside and squeezes through the vault door first; it swings shut; the tendrils reach it; the picture floods with red and goes to white.', 6, 'alarms, shouts, a heavy door slamming, a wet roar, then silence'),
    cut('wake', 'ins-meadow-wide', 'The staff sit up dazed in the glowing grass. The hologram flickers into being on the left. The Director gets to his feet, sees him and marches at him.', 6, 'soft wind in long grass, far birdsong, a faint shimmer'),
    say('ins-meadow-dir', 'He marches up, jabbing a finger at the camera.'),
    say('^', 'He spreads all four arms at the meadow.'),
    say('ins-meadow-you', 'He nods, pleasant and matter-of-fact.'),
    say('ins-meadow-dir', 'He squints.'),
    say('ins-meadow-you', 'He explains it gently, as if it were obvious.'),
    say('ins-meadow-dir', 'He waves that away with two hands and jabs a finger again.'),
    say('ins-meadow-you', 'He looks puzzled that it needs saying.'),
    say('^', 'He tilts his head, honestly asking.'),
    say('^', 'He turns one hand over.'),
    say('ins-meadow-you', 'He lifts the other hand, a second example.'),
    say('^', 'He shakes his head and points up at the sky.'),
    say('^', 'He taps his own chest lightly.'),
    say('ins-meadow-you', 'He goes on like a lecturer.'),
    say('^', 'He ends it with an open hand toward him.'),
    say('ins-meadow-dir', 'He is shaking with rage, all four fists clenched.'),
    say('ins-meadow-you', 'He looks around, confused that it is a question.'),
    say('^', 'He shrugs a little.'),
    say('ins-meadow-dir', 'He throws two arms wide.'),
    say('ins-meadow-you', 'He explains it practically, counting on his fingers.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('^', 'He winces a little, apologetic about the last part.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('ins-meadow-dir', 'He laughs in disbelief and throws a hand at the sky.'),
    say('^', 'The same shot goes on: the rest of the thought, in the same breath.'),
    say('^', 'He spits the last words.'),
    say('ins-meadow-you', 'He says nothing: he looks slowly round at the golden meadow, lifts both hands at it, looks back at him, flickers and is gone.'),
  ] },
];

// The spoken shots of each film, numbered in order: shot k says line k of its scene.
for (const f of FILMS) {
  let k = 0;
  for (const s of f.shots) {
    if (s.line === undefined) continue;
    s.line = k;
    s.id = `l${String(k).padStart(2, '0')}`;
    k++;
  }
}

export const filmOf = (id: string | undefined): Film | undefined => FILMS.find((f) => f.id === id);
