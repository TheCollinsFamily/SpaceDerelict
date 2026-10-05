/**
 * THE CUT SCENES AS FILMS: THE SHOT LISTS (Collins, Oct 3 2026: "now that I am writing them I think videos make sense
 * for all of them"). One film per scene of content/campaign.ts that names a `film`: every beat, every finale, every
 * pledge. The WORDS are the scene's own lines there (one source); this file says how each line is shot.
 *
 * THE RULES OF A FILM (Collins, Oct 4 2026, of the first test film, which cut between a shot of him and a shot of her):
 *   "the moving between looking at him and her doesn't really work, leads to too much jumpiness and character
 *    inconsistency; it's better to see him from behind and make sure every next video is created with the last video's
 *    last frame as its starting point ... for his emotions, those can be conveyed in his voice."
 *   1. ONE CAMERA POSITION PER PLACE, BEHIND HIM. We look over his shoulder at whoever he is talking to: his back is to
 *      the camera and his face is never seen (the style bible's rule 9 too). On the planet he is a hologram, standing in
 *      the left foreground; on a call he sits at his console and they are on the screen in front of him.
 *   2. EVERY CLIP GOES ON FROM THE FRAME THE ONE BEFORE IT ENDED ON ('^'). A film is one take per place: no cut from a
 *      shot of her to a shot of him, ever. A new picture starts only when the PLACE changes (the creep bursting in, then
 *      the archive; the feed cut, then him alone aboard).
 *   3. HIS FEELINGS ARE IN HIS VOICE. His lines say how he SOUNDS (perplexed, thinking it through, at his wits' end) and
 *      at most a small movement seen from behind. Theirs say what they DO, facing him and the camera.
 *   What the second take taught (Oct 4 2026): a HOLOGRAM of him is given NO gesture at all. "He lifts one open hand"
 *   turned him into profile (his face seen), "he folds his arms" turned him sideways for the rest of the take, and "he
 *   rubs the back of his neck" put one sparkle on him that every later clip multiplied until the room was snowing. So
 *   `you(voice)` with no move says he stands still, and the tool stops a take whose specks grow (tools/media/cutscenes.ts).
 *
 *   4. THE LINES ARE ACTED, SEVERAL TO A CLIP (Collins, later on Oct 4, of the take made one line a clip on the cheapest
 *      Veo: "the words sound like they were generated with AI then the video was created around them; that sounds
 *      stilted ... all the frontier video models can do talking"). The shot list below stays one line a shot, with its
 *      direction; the tool gathers the shots into exchanges and has a model that talks play each as one clip (`talk`).
 *
 * How a film is made NOW: `talk`, `talkcheck`, `talkbake` (HANDOFF.md "A FILM IS MADE OF ACTED EXCHANGES"). The older way,
 * one clip a shot, is below and still runs; it is what sounded stilted.
 *
 * How a film was made, one clip a shot (tools/media/cutscenes.ts; SPENDS RFab tokens):
 *   stills   the picture each place starts from (STILLS below), drawn in its look with its reference pictures
 *   clips    one clip per shot, IN ORDER, image-to-video WITH SOUND: the speaker says the line; each clip is transcribed,
 *            cut half a second after its last word, and the frame at that cut is the next clip's first frame
 *   check    every clip's words against its line; each speaker's pitch across the film
 *   bake     the clips joined at their cuts, levelled, over one room tone → public/media/scenes/<film>.mp4, its poster,
 *            and the cues (which line is said when) in public/media/scenes/scenes.json
 * The game (src/ui/cutscene.ts) plays the baked film full screen with the line in type under it, then shows the
 * scene's card. A film that is not baked yet is simply its card.
 *
 * Rules checked (tests/cutscenes.test.ts): every line of a filmed scene is said by exactly one shot, in order; a spoken
 * line is at most 22 words (a clip is 8 s) and has no word in capitals (a video voice spells it out); a film has one
 * picture per place and every other shot continues the one before it; no picture shows him from the front.
 */
import type { FactionId } from './campaign';

/** The look a picture is drawn in. */
export type FilmLook =
  | 'colony'    // their world: a 1950s colour science-fiction film (the leaders' portraits' look); he is a hologram, from behind
  | 'archive'   // inside the archive: the same film as a dream sequence, radiant; he is a hologram, from behind
  | 'ship'      // aboard the Merciful Yoke, alone: lifelike hard science fiction, dark and exact; he is seen from behind
  | 'call';     // aboard, over his shoulder: their video feed (their world's look) on the screen in front of him

export interface FilmStill {
  look: FilmLook;
  /** What the picture shows. WHO / HOLO / TECH stand for the leader, his hologram seen from behind, and him aboard seen from behind; KING for the Roach King. */
  shows: string;
  /**
   * Reference pictures: 'leader' (the faction's portrait), 'hero' (him from behind: the approved concept), 'king' (the
   * Roach King as his addresses show him), 'flag' (the Commonwealth's flag), or another still's id.
   */
  refs: string[];
}

export interface FilmShot {
  /** The clip's id inside its film. A spoken shot is `l<line>`; a silent one is named. */
  id: string;
  /** The picture a place starts from; '^' goes on from the frame the shot before it was cut on (the same take). */
  from: string;
  /** The scene line it speaks (its place in the scene's lines); none: nobody speaks. */
  line?: number;
  /** What happens in the shot, for the video model: what THEY do; for HIS lines, how his voice sounds and a small movement. */
  action: string;
  /** Seconds, for a shot with no line (a spoken shot's length follows its words). */
  secs?: 4 | 6 | 8;
  /** What is heard in a shot with no line. */
  sound?: string;
}

export interface Film {
  id: string;
  /** Whose scene it is: a faction's (content/campaign.ts), or 'roach': the Roach King off the air (content/roachKing.ts ROACH_SCENES). */
  faction: FactionId | 'roach';
  /** The room tone laid under the whole film (a few words; the bake lays a quiet bed under the cuts). */
  room: string;
  shots: FilmShot[];
}

/** One of HIS lines. He is seen from behind, so the line is carried by his VOICE: how it sounds, and at most a small movement. */
const STILL = 'He stands quite still, his arms at his sides, his back square to the camera.';
const you = (voice: string, move = STILL): FilmShot => ({ id: '', from: '^', line: -1, action: [move, voice ? `His voice is ${voice}.` : ''].filter(Boolean).join(' ') });
/** One of THEIR lines: what the speaker does, facing him and the camera. */
const they = (action: string): FilmShot => ({ id: '', from: '^', line: -1, action });
/** A new place: this shot starts from its picture (the first shot of a film, or the shot after the place changes). */
const at = (still: string, shot: FilmShot): FilmShot => ({ ...shot, from: still });
/** A shot in which nobody speaks. */
const cut = (id: string, from: string, action: string, secs: 4 | 6 | 8, sound: string): FilmShot => ({ id, from, action, secs, sound });

// ---------------------------------------------------------------------------
// The pictures: one per place. A place is shared between films (his console with their feed on it; the preacher's chambers).
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
const KING_OFFICE =
  'the President\'s private office in the Hive House, at night: dark wood panelling, a huge carved desk with a green ' +
  'banker\'s lamp, a tall window with heavy curtains, the country\'s flag on a pole in the corner, a wall map of a ' +
  'continent stuck with red pins';
const CONSOLE = 'his long matte black console desk aboard the ship';
const WINDOW = 'the long curved window of the ship and, through it, the night side of the planet with its spreading red stain';
/** Over his shoulder at the console: what the rest of the picture is. */
const OVER_CONSOLE =
  `An over-the-shoulder shot aboard the ship. In the left foreground, dark and a little out of focus, the back of the head and one shoulder of TECH, seated at ${CONSOLE}. ` +
  'He is looking at a large flat screen that stands on the console in front of him and fills most of the picture. On the screen, a video feed in the saturated colour of a 1950s film:';

export const STILLS: Record<string, FilmStill> = {
  // ---- aboard, alone (after a feed is cut; the pledges; the end of a finale)
  'ship-behind': { look: 'ship', refs: ['hero'], shows: `A medium shot from directly behind TECH, standing in the dark operations bay of the ship beside ${CONSOLE} and his pushed-back black chair; in front of him ${WINDOW}.` },
  'ship-headset': { look: 'ship', refs: ['hero'], shows: `A medium shot from directly behind TECH, seated in a black chair in the dark operations bay of the ship, wearing a slim matte black visor headset whose band runs round the back of his head, both hands rising to it; in front of him ${WINDOW}.` },
  'ship-broadcast': { look: 'ship', refs: ['hero'], shows: `A medium shot from directly behind TECH, standing very straight at ${CONSOLE} as if at a lectern, his hands flat on it; on the console in front of him a small recording lens on a thin stalk with a single red light glowing beside it; beyond it ${WINDOW.replace('the night side of the planet with its spreading red stain', 'the whole planet, its night side stained red')}.` },

  // ---- the Delegation
  'summit-ots': { look: 'colony', refs: ['leader', 'hero'], shows: `An over-the-shoulder shot in ${HOTEL}. In the left foreground, seen from the waist up and a little out of focus, stands HOLO. Facing him and the camera, in the middle of the picture a few steps away and seen from the knees up, stands WHO, beaming, her upper arms opening in welcome. Behind her stand ten delegates, elderly insect people in cardigans and flower garlands, delighted; the refreshments table runs along the wall at the right.` },
  'call-del': { look: 'call', refs: ['hero', 'leader'], shows: `${OVER_CONSOLE} WHO, close to the lens in the middle, with five excited delegates in cardigans and flower garlands squeezed in behind and beside her to get into the picture, in ${COMMITTEE}.` },
  'del-lastroom': { look: 'colony', refs: ['leader'], shows: `A small upper room, the last one: WHO and a dozen delegates in cardigans and garlands huddled together in the middle of ${COMMITTEE.replace('their committee room', 'a committee room')}, while the dark maroon veined living skin of a giant creature and its glistening dark-red tendrils burst in through the cracking walls and the door on every side.` },
  'del-field-ots': { look: 'archive', refs: ['leader', 'hero'], shows: `An over-the-shoulder shot in ${MEADOW}. In the left foreground, seen from the waist up, stands HOLO. Storming toward him and the camera through the glowing grass, a few steps away, comes WHO, furious, her antennae flat back; behind her a crowd of delegates in cardigans and flower garlands stand about bewildered, looking at their own hands.` },
  'pledge-del': { look: 'colony', refs: ['leader'], shows: `WHO and a crowd of delegates in cardigans and garlands, in ${HOTEL}, all gathered round a big 1950s wooden television set on a trolley whose screen glows pale blue (nothing can be made out on it), hands clasped, rapt.` },

  // ---- the Faithful
  'hall-ots': { look: 'colony', refs: ['leader', 'hero'], shows: `An over-the-shoulder shot in ${PRAYER_HALL}. In the left foreground, seen from the waist up, stands HOLO. In front of him on the carpet, facing him and the camera, kneels WHO, bowed low with two hands flat on the carpet, his head just raised. The vast hall is empty but for the two of them; beside a column at the right lies a great heap of canvas vests with rows of pouches and loops of wire.` },
  'chambers-ots': { look: 'colony', refs: ['leader', 'hero'], shows: `An over-the-shoulder shot in ${CHAMBERS}. In the left foreground, seen from the waist up, stands HOLO. Facing him and the camera, a few steps away beside the gilded desk, stands WHO, one hand on his chest, a small knowing smile.` },
  'church-creep': { look: 'colony', refs: ['leader'], shows: `${CHURCH.replace('the great', 'Inside the great')}, WHO in the pulpit with his arms raised; the dark maroon veined living skin of a giant creature and its glistening dark-red tendrils are bursting in through the tall windows and the doors, plaster and coloured glass falling, the worshippers on their feet.` },
  'church-ots': { look: 'archive', refs: ['leader', 'hero', 'church-creep'], shows: `${CHURCH.replace('the great', 'Inside the great')}, exactly the church of the third reference picture but whole, clean and full of golden light, no creature anywhere. An over-the-shoulder shot from the altar, looking down the nave: in the left foreground, seen from the waist up, stands HOLO. Facing him and the camera, a few steps away in the aisle, stands WHO; behind him every worshipper sits in her pew exactly where she was, looking about in wonder.` },
  'pledge-fai': { look: 'colony', refs: ['leader'], shows: `WHO and a great congregation of insect people in dark robes and headscarves on their knees on the carpet of ${PRAYER_HALL}, all turned toward a big 1950s wooden radio set that stands on the pulpit steps, hands raised.` },

  // ---- the Institute
  'call-dir': { look: 'call', refs: ['hero', 'leader'], shows: `${OVER_CONSOLE} WHO, leaning far back in a gaming chair with both feet up on the desk and a handheld game console in two of his hands, in ${OFFICE}.` },
  'spire-creep': { look: 'colony', refs: [], shows: 'A tall tower of glass and chrome among other glass spires at dusk, and the dark maroon veined living skin of a giant creature climbing it on every side, its glistening dark-red tendrils wrapping the lower floors, lights going out floor by floor. Painted orange and violet sky.' },
  'spire-saferoom': { look: 'colony', refs: ['leader'], shows: 'A corridor of glass and chrome inside the tower, red emergency light: WHO shoving two insect colleagues in lab coats aside with all four arms as he squeezes first through a heavy round vault door into a small steel safe room where several staff already crouch; dark-red tendrils coming round the far corner of the corridor.' },
  'ins-meadow-ots': { look: 'archive', refs: ['leader', 'hero'], shows: `An over-the-shoulder shot in ${MEADOW}. In the left foreground, seen from the waist up, stands HOLO. Marching toward him and the camera through the grass, a few steps away, comes WHO, angry, jabbing a finger; behind him a handful of insect staff in lab coats sit up in the grass, dazed.` },
  'pledge-ins': { look: 'colony', refs: ['leader'], shows: `WHO, in ${OFFICE}, sitting forward and watching a monitor at the side of his desk whose screen glows pale (nothing can be made out on it), one fist half raised, delighted with himself.` },

  // ---- the Roach King, off the air (content/roachKing.ts ROACH_SCENES). He is not in these: the camera is simply in the
  // room, and it stays where it is. One picture a scene, both speakers in it: no cut from one to the other.
  'rk-office': { look: 'colony', refs: ['king'], shows: `A wide two-shot in ${KING_OFFICE}. Behind the desk, facing the camera, sits KING, his coat open, one elbow on the desk. At the right of the picture, standing in front of the desk and turned three-quarters toward the camera, a thin, nervous aide: an insect man in a grey suit and a narrow tie, holding a paper folder against his chest with two hands.` },
  'rk-call': { look: 'colony', refs: ['king'], shows: `A medium shot in ${KING_OFFICE}. At the left stands KING beside his desk, turned three-quarters toward the camera, looking at a large wall screen that fills the right half of the picture. On the screen, a video feed: the head and shoulders of a furious general of the war caste, a heavy, scarred soldier insect woman with a broad armoured head and a dark green uniform with a high collar and rows of plain ribbons, leaning into the lens; behind her an airfield at night with transport aircraft on fire.` },
  'rk-steps': { look: 'colony', refs: ['king', 'flag'], shows: 'A wide shot from among the crowd, looking up the grand white stone steps of a government building with a columned portico, in morning light, hung with enormous flags (the flag of the second reference picture, copied exactly) and bunting in blue, white and red. At a podium with a cluster of old microphones at the top of the steps stands KING, facing the camera and the crowd, both upper hands gripping the podium. Rows of soldiers stand at attention on the steps below him; in the foreground, out of focus, the backs of the heads of a great crowd holding small flags.' },
};

// ---------------------------------------------------------------------------
// The films. A spoken shot takes the next line of its scene (content/campaign.ts), in order.
// ---------------------------------------------------------------------------
const HOTEL_TONE = 'the flat hum of fluorescent lights and an air conditioner in a carpeted hotel conference room, a faint murmur of a small polite crowd';
const SHIP_TONE = 'the low steady hum of a small starship: air handling, a faint electrical tone, nothing else';
const HALL_TONE = 'the huge hushed echo of an empty domed prayer hall, a faint draught, oil lamps guttering';
const CHAMBER_TONE = 'the quiet of a grand old room: a slow clock, a faint draught in heavy curtains';
const MEADOW_TONE = 'a warm meadow: soft wind in long grass, far birdsong, a faint shimmering tone';
// (Not "hologram", not "flickers": the picture shows what he is, and those words invite sparkles that grow down a take.)
const APPEAR = 'The pale blue figure of the young man has just appeared in the room, his back to the camera.';
const KING_OFFICE_TONE = 'the quiet of a big panelled office at night: a slow clock, a faint electric hum, far traffic';
const STEPS_TONE = 'a great crowd in the open air, hushed: flags snapping in the wind, a faint echo off stone, a public address system\'s hum';

export const FILMS: Film[] = [
  // ======================================================================== THE FRIENDSHIP DELEGATION
  { id: 'delegation-understand', faction: 'delegation', room: HOTEL_TONE, shots: [
    cut('open', 'summit-ots', `${APPEAR} The delegates gasp with delight and clap their hands; the chief delegate opens her upper arms wide in welcome and nods, her antennae lifting.`, 4, 'the hum of a projector, gasps of delight, warm applause from a dozen people, the buzz of fluorescent lights'),
    they('She steps a little closer to him, beaming, her upper arms spread in welcome.'),
    you('perplexed and a little wary, honestly asking'),
    they('She presses two hands together, serene and certain, nodding as she explains; the delegates behind her nod along.'),
    you('puzzled and hesitant, the "um" drawn out'),
    they('She opens her upper hands like a patient teacher, then leans toward him with a questioning tilt of her antennae.'),
    you('slow and thoughtful, thinking it through after a short pause, then conceding the point'),
    you('slower still, thinking aloud, gradually persuading himself'),
    you('warmer and plainer, agreeing'),
    they('She claps all four hands in delight, and the delegates behind her burst into applause, nodding hard.'),
    you('practical and plain, getting down to business'),
    they('She leans toward him and lowers her voice like someone sharing good gossip, sweeping one hand in a wide circle.'),
    they('She holds up one finger, smiling proudly, then flicks her hand as if brushing something off a table. When she has said it she folds her hands and beams at him, and the delegates behind her nod.'),
  ] },
  { id: 'delegation-pledge', faction: 'delegation', room: SHIP_TONE, shots: [
    at('ship-broadcast', you('stiff and formal, like a man reading a public notice', 'He clears his throat and stands a little straighter.')),
    you('plain and flat, with a breath of doubt after it', 'He holds still, then glances down at the console.'),
    cut('cheer', 'pledge-del', 'The delegates round the television burst into applause, hugging one another, garlands swinging; the chief delegate dabs her eyes.', 4, 'a room of people cheering and clapping, happy sobbing'),
  ] },
  { id: 'delegation-stop-war', faction: 'delegation', room: SHIP_TONE, shots: [
    at('call-del', they('On the screen she waves at the lens with two hands, bursting with good news; the delegates behind her wave too and jostle to be seen.')),
    they('On the screen she holds a thick paper folder up to the lens with both upper hands, proud as a schoolgirl.'),
    you('confused, slowly', 'He leans a little toward the screen.'),
    they('On the screen she says it simply and sweetly, with a small serene nod, as if it explained everything.'),
    you('careful and puzzled, working through it, sure he has missed something', 'He raises one hand from the console.'),
    they('On the screen she shakes her head gently, smiling, and counts three things off on three hands.'),
    they('On the screen she opens her hands wide, reasonable and warm; the delegates behind her nod firmly.'),
    you('weary and flat, giving up, on a long breath out', 'He bows his head and lifts a hand to pinch the bridge of his nose.'),
  ] },
  { id: 'delegation-gaia', faction: 'delegation', room: SHIP_TONE, shots: [
    at('call-del', they('On the screen she leans into the lens, thrilled; the delegates crowd in behind her.')),
    they('On the screen she nods along with her own words and ends with a triumphant little lift of her antennae.'),
    they('On the screen she unrolls a paper map in two hands and taps points on it with a third, like a detective.'),
    they('On the screen she shakes her head slowly and happily, one finger raised.'),
    they('On the screen she lays two hands on her chest, moved; a delegate behind her wipes an eye.'),
    you('confused, trying to be helpful', 'He half raises a hand from the console.'),
    they('On the screen she wags a finger, pleased to be a step ahead of him.'),
    they('On the screen she sweeps two hands across the map and piles an invisible heap with the others.'),
    they('On the screen she beams and blows a kiss at the lens with two hands.'),
    cut('hangup', '^', 'On the screen she reaches toward the lens and the feed cuts off: the screen goes dark and stays dark. The young man sits quite still.', 4, 'the click of a call ending, then only the low hum of the ship'),
    you('flat disbelief, said to nobody', 'The screen in front of him is dark. He sits back in his chair.'),
    you('musing, curious in spite of himself', 'He turns his head toward the window.'),
  ] },
  { id: 'delegation-reveal', faction: 'delegation', room: SHIP_TONE, shots: [
    at('call-del', they('On the screen she leans into the lens, delighted, a sheaf of notes in two hands.')),
    you('tired and blunt, cutting across her', 'He raises one flat hand.'),
    they('On the screen she stops, looks left and right at the delegates beside her, who look back at her, all of them lost.'),
    you('dry, like a man about to quote a history book', 'He leans back in his chair.'),
    you('even and patient, lecturing', 'He turns one hand in the air.'),
    you('even and patient, counting it out', 'He counts on the fingers of one raised hand.'),
    you('the same patient lecturing tone, with a shake of the head in it', 'He shakes his head slowly.'),
    you('flat, as if setting something down on the desk'),
    you('plain and deliberate, every word clear', 'He leans toward the screen.'),
    you('short and hard'),
    you('firm, a teacher making his point', 'He taps the console once with a finger.'),
    they('On the screen she chuckles warmly and pats her chest with one hand, relieved; the delegates behind her smile.'),
    you('incredulous, his voice cracking upward', 'He throws both hands up.'),
    they('On the screen she nods kindly, as if confirming a booking.'),
    they('On the screen she brightens and holds up a pamphlet in two hands; a delegate behind her holds up a chart of a single rising curve.'),
    they('On the screen she raises one finger and leans in, the beginning of a long lecture.'),
    cut('hangup', '^', 'He slaps a control on the console: the feed cuts off mid-sentence and the screen goes dark and stays dark.', 4, 'a hard click on the console, the call cut off mid-word, then only the low hum of the ship'),
    you('fast and rattled, muttering', 'The screen in front of him is dark; he gets up out of his chair and walks a few steps toward the window with his hands in his hair, his back still to the camera.'),
    you('slow, forced calm, reciting it to steady himself', 'He stops at the window, lowers his hands and breathes out.'),
  ] },
  { id: 'delegation-finale', faction: 'delegation', room: MEADOW_TONE, shots: [
    cut('burst', 'del-lastroom', 'The walls crack and the dark red living skin pours through them; tendrils whip across the room; the delegates cling to one another; the picture floods with red and goes to white.', 6, 'timber and plaster cracking, a wet tearing roar, cries, then silence'),
    cut('wake', 'del-field-ots', `${APPEAR} The delegates look at their own hands in wonder. The chief delegate storms up to him through the grass, furious, and stops in front of him.`, 4, 'soft wind in long grass, far birdsong, a faint shimmer, a gasp'),
    they('She jabs a finger at his chest, her antennae flat back.'),
    you('mildly confused that she is asking', 'He turns his head to look across the meadow and back.'),
    they('She spreads all four arms at the meadow, appalled.'),
    you('reasonable and unhurried, explaining something obvious', 'He turns one hand over.'),
    you('the same easy tone, as if listing features'),
    you('helpful, offering', 'He holds one open hand out to the side; a red apple of pale light draws itself into being on his palm, and he offers it to her.'),
    they('She clutches her head with two hands and cries it out.'),
    you('light and nonchalant', 'He lets his hand fall; the apple fades.'),
    they('She points at her own chest, shaking with anger.'),
    you('offhand, a shrug in his voice', 'He lifts one shoulder.'),
    they('She stamps a foot in the grass.'),
    you('mild, stating a plain fact'),
    they('She throws her head back and screams it at the golden sky, all four fists clenched.'),
    you('shocked at first, then brisk, backing out of the conversation', 'He takes half a step back and raises both hands; when he has said it he flickers and is gone.'),
    at('ship-headset', you('relieved and a little shaken, on a long breath out', 'He lifts the visor headset up off his head and lets his head fall back.')),
    you('dry relief', 'He lowers the headset into his lap.'),
    you('thoughtful, consoling himself', 'He sets the headset down on the console.'),
  ] },

  // ======================================================================== THE FAITHFUL OF THE LAST HOUR
  { id: 'faithful-signs', faction: 'faithful', room: HALL_TONE, shots: [
    cut('open', 'hall-ots', `${APPEAR} He turns his head to look up at the dome. The preacher, bowed low on the carpet before him, does not move.`, 4, 'the hum of a projector echoing in a huge empty hall, oil lamps guttering'),
    they('He raises his head from the carpet and speaks with slow, joyful gravity.'),
    they('He lifts one hand toward the dome, then draws it down like a blade.'),
    you('taken aback, trying to be kind', 'He raises both hands a little.'),
    they('Without a pause he lays a hand on his chest and bows his head.'),
    you('earnest and encouraging', 'He leans forward a little.'),
    they('He looks up with a small knowing smile and opens two hands.'),
    you('thoughtful, conceding it', 'He lifts a hand to his chin.'),
    they('He rises to his full height and lifts his upper arms to the dome.'),
    they('He turns and points with two hands at the great heap of vests beside the column, proud.'),
    at('ship-behind', you('rising panic, fast and under his breath, the last words tumbling out', 'He walks in a tight circle beside his desk with both hands in his hair, his back to the camera.')),
  ] },
  { id: 'faithful-pledge', faction: 'faithful', room: SHIP_TONE, shots: [
    at('ship-broadcast', you('stiff and formal, reading it as much as saying it', 'He stands a little straighter.')),
    you('hesitant, then firm on the last four words', 'He nods once.'),
    cut('kneel', 'pledge-fai', 'The congregation round the radio cry out and bow to the carpet in a wave; the preacher lifts his arms to the dome.', 4, 'a great crowd crying out in joy in a huge echoing hall'),
  ] },
  { id: 'faithful-prophecy', faction: 'faithful', room: CHAMBER_TONE, shots: [
    at('chambers-ots', you('exasperated and loud', 'He throws his arms out to the sides.')),
    you('firm, trying to sound in charge', 'He points a finger at him.'),
    they('He lays a hand on his chest and bows a little, quite calm.'),
    you('grudging, through his teeth', 'He turns his head away toward the window.'),
    they('He lifts one finger gently and tilts his head, asking.'),
    you('sheepish and quiet', 'He lowers his head.'),
    you('sincere, almost pleading', 'He opens his hands.'),
    you('earnest and gentle, offering it'),
    they('He smirks and weighs two things in two hands.'),
    they('He folds his hands, the smile fading into thought.'),
    they('He walks a slow step toward the window, thinking aloud.'),
    you('reasonable at first, then stumbling and wincing over the last words', 'He rubs the back of his neck.'),
    they('He turns back to him, serene, one hand raised toward heaven.'),
    they('He lowers the hand to his own chest.'),
    you('beaten and flat', 'He shrugs.'),
    they('He nods once, closing the matter, and bows.'),
  ] },
  { id: 'faithful-prepare', faction: 'faithful', room: CHAMBER_TONE, shots: [
    at('chambers-ots', you('polite and hopeful, asking nicely this time', 'He presses his hands together.')),
    they('He smirks and raises one hand, wise and unhurried.'),
    you('plain and a little small', 'He shakes his head.'),
    they('He tilts his head, as if it were the most natural question.'),
    you('wary and puzzled', 'He turns one hand over.'),
    they('He lays one hand on a great bound book on the desk and lifts the other.'),
    they('He traces an arc across the ceiling with one hand.'),
    you('thinking it over, then accepting it with a small laugh in his voice', 'He tips his head from side to side.'),
    they('He smiles, satisfied, and folds his hands into his sleeves.'),
  ] },
  { id: 'faithful-finale', faction: 'faithful', room: 'the hush of a great church full of people holding their breath, a faint golden shimmer', shots: [
    cut('burst', 'church-creep', 'The windows burst and the dark red living skin pours down the walls; the vault cracks and falls; the worshippers cry out; the picture floods with red and goes to white.', 6, 'glass bursting, stone falling, a wet roar, a congregation crying out, then silence'),
    cut('whole', 'church-ots', `${APPEAR} The church is whole and golden. Every worshipper sits in her pew where she was, looking at her hands and at her neighbours; the preacher in the aisle looks up at him.`, 4, 'a held breath in a great church, a soft shimmer, pews creaking'),
    you('cheerful and brisk, like a man closing a meeting', 'He claps his hands once.'),
    they('He looks at his own hands, then up at him, quiet and hopeful.'),
    you('easy, weighing it', 'He tips one hand from side to side.'),
    they('He recites it, one hand on his chest.'),
    you('approving and matter-of-fact', 'He nods and looks round the church.'),
    they('He staggers back a step in horror, hands rising.'),
    you('honestly asking, puzzled'),
    you('reasonable, pressing the point', 'He gestures round at the golden church.'),
    they('He thrusts a finger at the altar, shaking.'),
    you('cool and condescending', 'He folds his arms.'),
    you('quiet and final', 'He lifts one finger and lets it fall.'),
    they('He comes forward up the aisle, furious, jabbing two fingers.'),
    they('He beats his chest once with a fist and throws the hand out at him.'),
    you('genuinely shocked, his voice rising', 'His arms drop to his sides.'),
    you('earnest and a little hurt, slowly', 'He shakes his head.'),
    you('tired, giving up, on a breath out', 'He waves the whole thing away, flickers and is gone.'),
  ] },

  // ======================================================================== THE INSTITUTE FOR LONG-TERM HIVE FLOURISHING
  { id: 'institute-machines', faction: 'institute', room: SHIP_TONE, shots: [
    at('call-dir', they('On the screen he grins over his shoulder at someone out of the picture and points a thumb at the lens.')),
    you('flat and unimpressed'),
    they('On the screen he turns to the lens, smug, and shoots a finger gun.'),
    you('bewildered', 'He shakes his head.'),
    you('patient and precise, explaining', 'He raises one hand from the console.'),
    they('On the screen he holds up one knowing finger and taps his temple with another hand.'),
    you('tired, giving up on it', 'He shakes his head.'),
    they('On the screen he goes back to his game, thumbs working, talking without looking up.'),
    they('On the screen he sets the game down, swings his feet off the desk, and announces it with a flourish of two hands.'),
    they('On the screen he picks up a paper file and taps a line of pale powder out of it onto the desk as he talks.'),
    they('On the screen he bends to the desk and snuffs the line up, sits back blinking, and points at the lens.'),
    they('On the screen he rolls his eyes and waves a hand at the world outside his window.'),
    they('On the screen he rubs two fingers together, disgusted.'),
    they('On the screen he gets animated, pointing at the lens with one hand, bouncing in the chair.'),
    they('On the screen he nods, pleased with himself.'),
    they('On the screen he spreads all four hands, generous.'),
    you('faintly horrified, choosing his words', 'He draws back a little in his chair.'),
    they('On the screen he lights up and slaps the desk, delighted.'),
    you('shocked and sharp'),
    they('On the screen he chuckles and shrugs with all four arms.'),
    you('worried, slowly'),
    you('uneasy, waving it through', 'He rubs his forehead.'),
  ] },
  { id: 'institute-pledge', faction: 'institute', room: SHIP_TONE, shots: [
    at('ship-broadcast', you('stiff and formal, like a public notice', 'He stands a little straighter.')),
    you('firmer, then unsure how it went', 'He nods once.'),
    cut('fist', 'pledge-ins', 'The Director pumps a fist at his monitor, spins his chair once and points at the screen with two hands.', 4, 'a chair spinning, a whoop'),
  ] },
  { id: 'institute-pipeline', faction: 'institute', room: SHIP_TONE, shots: [
    at('call-dir', you('wary', 'He leans a little toward the screen.')),
    they('On the screen he shoots two finger guns at the lens without putting his game down.'),
    they('On the screen he squints at the lens over the game.'),
    you('uncertain, almost worried', 'He glances left and right.'),
    they('On the screen he shrugs, grinning, man to man.'),
    you('horrified', 'He recoils in his chair.'),
    they('On the screen he holds a pulp science-fiction magazine up to the lens and taps its painted cover, in the style of an old pulp science-fiction magazine: a heroic starship captain who is an insect like him (an insect head with antennae, four arms) in a gold tunic, and at his side an insect woman whose chitin is painted green and blue (an insect head with antennae, four arms). Everyone on the cover is an insect: there is no human being on it anywhere. No lettering on it.'),
    they('On the screen he taps the two painted women on the cover in turn.'),
    you('patient, as to a child'),
    they('On the screen he puts the magazine and the game down and leans in on his elbows, coaxing.'),
    they('On the screen he leans back and grins at the ceiling.'),
    you('earnest, explaining the real problem', 'He shakes his head.'),
    you('plain and final'),
    they('On the screen he laughs and waves the whole idea away.'),
    they('On the screen he shrugs, amused.'),
    they('On the screen he explains it with a circle of one hand, very pleased.'),
    they('On the screen he points up at the ceiling with two thumbs.'),
    you('sputtering, scandalised', 'He raises both hands.'),
    they('On the screen he pats the air with two hands, soothing.'),
    you('stunned at first, then slow as it dawns on him', 'He leans slowly toward the screen.'),
    they('On the screen he throws his head back and laughs.'),
    you('very quiet, under his breath, shaken', 'He reaches forward and the screen goes dark; he sits very still.'),
  ] },
  { id: 'institute-ultimatum', faction: 'institute', room: SHIP_TONE, shots: [
    at('call-dir', you('resigned', 'He leans a little toward the screen.')),
    they('On the screen he opens two hands wide, expansive.'),
    they('On the screen he leans on his elbows.'),
    they('On the screen he points lazily at the lens.'),
    you('low and dry: a thought, said under his breath to himself, that the man on the screen does not hear', 'He does not move.'),
    they('On the screen he lays a hand on his chest, then turns two palms up.'),
    they('On the screen he shrugs it off.'),
    they('On the screen he bounces in his chair and grabs a marker.'),
    they('On the screen he points the marker at the lens.'),
    they('On the screen he draws boxes in the air with two hands.'),
    they('On the screen he stops, blinks, and comes back to the lens with a grin.'),
    they('On the screen he points at the lens and then at himself.'),
    they('On the screen he nods, magnanimous.'),
    they('On the screen he rubs the back of his neck and counts on his fingers.'),
    they('On the screen he holds up one finger like a man with a plan.'),
    they('On the screen he waves it off as obvious.'),
    you('weary, letting it go', 'He shakes his head.'),
  ] },
  { id: 'institute-finale', faction: 'institute', room: MEADOW_TONE, shots: [
    cut('tower', 'spire-creep', 'The dark red living skin climbs the glass tower floor by floor and the lights go out behind it.', 4, 'a low wet roar, glass creaking, distant alarms'),
    cut('shove', 'spire-saferoom', 'He shoves the two in lab coats aside and squeezes through the vault door first; it swings shut; the tendrils reach it; the picture floods with red and goes to white.', 6, 'alarms, shouts, a heavy door slamming, a wet roar, then silence'),
    cut('wake', 'ins-meadow-ots', `${APPEAR} The staff sit up dazed in the glowing grass. The Director marches up to him and stops in front of him.`, 4, 'soft wind in long grass, far birdsong, a faint shimmer'),
    they('He jabs a finger at him.'),
    they('He spreads all four arms at the meadow.'),
    you('pleasant and matter-of-fact'),
    they('He squints.'),
    you('gentle, as if it were obvious'),
    they('He waves that away with two hands and jabs a finger again.'),
    you('puzzled that it needs saying'),
    you('honestly asking', 'He tilts his head.'),
    you('even, a first example', 'He turns one hand over.'),
    you('even, a second example', 'He lifts the other hand.'),
    you('patient and a little incredulous', 'He shakes his head and points up at the sky.'),
    you('plain'),
    you('like a lecturer'),
    you('quiet and sure', 'He opens a hand toward him.'),
    they('He is shaking with rage, all four fists clenched.'),
    you('confused that it is a question', 'He looks about the meadow.'),
    you('simple, a small shrug in it'),
    they('He throws two arms wide.'),
    you('practical'),
    you('practical and matter-of-fact'),
    you('reasonable, a little apologetic at the end'),
    you('mild, as if it explained everything'),
    they('He laughs in disbelief and throws a hand at the sky.'),
    they('He counts it off on his fingers, sneering.'),
    they('He spits the last words.'),
    you('', 'He says nothing: he turns his head slowly to look round the golden meadow, lifts both hands toward it, looks back at him, flickers and is gone.'),
  ] },
  // ======================================================================== THE ROACH KING, OFF THE AIR
  // (content/roachKing.ts ROACH_SCENES; Collins, Oct 4 2026). One camera, one take: the two of them are in the picture
  // together (the general on the wall screen), so a line is whoever says it doing it, with no cut.
  { id: 'rk-briefing', faction: 'roach', room: KING_OFFICE_TONE, shots: [
    at('rk-office', they('The aide clears his throat and speaks carefully, his eyes on his folder; the President listens without looking up.')),
    they('The President puts one hand to his head and closes his eyes, and says it flatly, weary.'),
    they('The aide shifts his weight and reads it from the folder, apologetic.'),
    they('The President drops his hand and stares at the aide, incredulous.'),
    they('The President spreads all four hands, appalled, his voice rising.'),
    they('The President jabs a finger toward the wall map, then opens his hands, exasperated, as if it were obvious.'),
    they('The aide raises one finger, hopeful, trying to help.'),
    they('The aide lowers the finger and shrugs, embarrassed.'),
    they('The President covers his face with both upper hands and speaks through them, then lets them drop, beaten.'),
  ] },
  { id: 'rk-transports', faction: 'roach', room: KING_OFFICE_TONE, shots: [
    at('rk-call', they('On the screen the general slams a fist down and shouts into the lens, shaking with rage; the President watches her, quite still.')),
    they('The President answers the screen, cold and hard, one finger raised; on the screen the general glares.'),
    they('The President lowers his hand and speaks more quietly, heavily, looking down for a moment.'),
    they('The President looks back up at the screen, steady, and says it almost gently; on the screen the general stares at him, speechless.'),
  ] },
  { id: 'rk-founding', faction: 'roach', room: STEPS_TONE, shots: [
    at('rk-steps', they('The President leans to the microphones, grave, both upper hands on the podium; the flags stir; the crowd is silent.')),
    they('He lifts his head and looks out over the crowd.'),
    they('He shakes his head slowly, then strikes the podium once with a fist.'),
    they('He lays one hand on his chest.'),
    they('He raises one finger, his voice building.'),
    they('He sweeps one arm out over the crowd.'),
    they('He thunders it, both upper fists raised; the crowd begins to roar.'),
    they('He pounds the podium on each sentence; the crowd roars louder.'),
    they('He throws all four arms up; the crowd erupts, flags waving, the soldiers cheering.'),
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
