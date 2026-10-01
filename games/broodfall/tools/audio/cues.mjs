/**
 * EVERY SOUND BROODFALL PLAYS: what it is for, how it is asked for, and how it is cut
 * (tools/audio/make.mjs makes them; src/audio/ plays them; public/audio/manifest.json is the list
 * the game reads). Sep 30 2026.
 *
 * The three registers (DESIGN.md "Tone stack"):
 *   - the SHIP (menu, ship, UI, the data pad, YOKE's intercom): austere, clinical, black glass;
 *   - PLANETSIDE (a deployment): the Empire's clearance newsreel. Its music is jaunty-ominous
 *     1950s brass that "keeps time" (content/lore/empire.md: imperial broadcasts never use music to
 *     move a crowd, only to keep time), its fanfares cheerful;
 *   - the BODY and the INSECTS (every effect on the board): wet, organic, played straight.
 *
 * Kinds:
 *   music   Eleven Music v2 (elevenlabs:music_v2, 250 tokens a second), instrumental.
 *           `loop`: baked into a seamless loop (the tail crossfaded into the head).
 *   sfx     a text-to-video model with its own soundtrack (atlascloud:h3-t2v, MiniMax Hailuo 3.0,
 *           480p; about 2,200 tokens a second); the picture is thrown away. RFab has no
 *           sound-effect route of its own (tools/audio/rfab-audio.mjs).
 *           `cut: 'each'`: the take holds the sound several times over; every separate sound in it
 *           is a variant (up to `max`). `cut: 'one'`: the whole take, its silences trimmed.
 *   voice   the newsreel narrator: a text-to-video take of a 1950s narrator speaking the line
 *           (imagerouter:veo-3.1-lite-t2v), the sound kept, a newsreel EQ over it.
 */

/** Said before every effect prompt: the model is asked for sound, not a scene with music. */
const FOLEY = 'Sound design only: no music, no speech, no voices, no crowd. Close-miked foley recorded in a dead quiet studio. ';
const REPEAT = (n) => ` It happens ${n} separate times, each one clearly separated by a second of total silence.`;
const CONSOLE = 'Sound design only: no music, no speech. A clean, sparse, austere user-interface sound of a black-glass starship console: precise, quiet, expensive, a little cold. ';

/** @type {Array<Record<string, any>>} */
export const SFX = [
  // --- limbs firing, one sound per family class (src/audio/gameSounds.ts FIRE_CLASS) ---
  { id: 'fire-spit', for: 'a limb spits acid (Spitter, Seedling, Blight Vent)', seconds: 6, cut: 'each', max: 6,
    prompt: FOLEY + 'Macro shot of a wet fleshy alien creature on black spitting globs of acid: a sharp wet splutter and hiss.' + REPEAT(6), raw: 'probe-spit-h3' },
  { id: 'fire-harpoon', for: 'Impaler, Creep Lance: a bone harpoon', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A heavy bone harpoon is launched from a taut wet sinew: a deep twang, a fast whoosh and a meaty thunk.' + REPEAT(4) },
  { id: 'fire-quills', for: 'Quill Fan, Boomerang Node: a volley of quills', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A fan of sharp bony quills is fired all at once from a fleshy pod: a rattling, hissing volley of darts whistling away.' + REPEAT(4) },
  { id: 'fire-lightning', for: 'Galvanic Frond: organic lightning', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A wet fleshy frond discharges a bolt of electricity: a sharp crackling snap and buzzing zap of an electric arc.' + REPEAT(5) },
  { id: 'fire-beam', for: 'Arc Prism, Ocular Stalk: a beam of light', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'A crystalline organic prism fires a short beam of light: a bright resonant humming whine that swells for half a second and cuts off.' + REPEAT(4) },
  { id: 'fire-flame', for: 'Ember Sac: a jet of flame', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'A gas sac spews a short jet of fire: a whooshing roar of flame with a gassy pop at the start.' + REPEAT(4) },
  { id: 'fire-lob', for: 'Burster, Bile Lobber, Spore Sling, Spore Bombard, Skipping Mortar: a lobbed glob', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A fleshy organic mortar launches a heavy glob into the air: a deep hollow wet thump, like a giant cork pulled out of flesh.' + REPEAT(5) },
  { id: 'fire-bite', for: 'Maw, Spine Wall, Broodmother: a bite', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A huge wet toothed maw snaps shut on something: a crunchy bone-crushing bite with teeth clacking and gristle tearing.' + REPEAT(5) },
  { id: 'fire-web', for: 'Netcaster, Snare Bed: a web shot', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A sticky web of mucus is shot out: a fast wet thwip and the stretch of gooey strands.' + REPEAT(5) },
  { id: 'fire-lash', for: 'Lasher: a whip of flesh', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A thick fleshy tentacle lashes out like a whip: a wet swish and a sharp slapping crack.' + REPEAT(5) },
  { id: 'fire-hiss', for: 'Caustic Mister: a spray of caustic mist', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'An organic vent sprays a burst of caustic mist: a short pressurised hiss with a bubbling gurgle.' + REPEAT(4) },
  // --- what lands ---
  { id: 'hit-splat', for: 'a shot strikes (spit, harpoon, web)', seconds: 8, cut: 'each', max: 6,
    prompt: FOLEY + 'Small globs of acid splat against a hard insect carapace: a short wet splat and a sizzle.' + REPEAT(6) },
  { id: 'hit-blast', for: 'a shell or glob lands and bursts', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'An organic spore shell lands on a street and bursts: a muffled wet explosion with spattering debris.' + REPEAT(4) },
  { id: 'enemy-cannon', for: 'the insects\' cannon and mortar crews fire', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'A 1950s army field cannon fires: a deep booming shot with a short metallic echo.' + REPEAT(4) },
  // --- the insects dying ---
  { id: 'die-bug', for: 'a small insect dies (militia, skitterling, workers, sappers)', seconds: 8, cut: 'each', max: 6,
    prompt: FOLEY + 'A large beetle is crushed: a crunchy carapace crack and a short, high dying chitter of mandibles.' + REPEAT(6) },
  { id: 'die-soldier', for: 'an armoured insect dies (soldier, elite, phalanx, carapace, crews)', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'An armoured insect soldier falls: a heavy chitin crunch and the clatter of a steel helmet and rifle dropping on pavement.' + REPEAT(4) },
  { id: 'die-flier', for: 'a flier is shot down', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'A large flying insect is hit in the air: its buzzing wings sputter and stall, then a crunchy thud as it hits the ground.' + REPEAT(3) },
  { id: 'die-boss', for: 'a royal (royal, consort, matron) dies', seconds: 8, cut: 'one',
    prompt: FOLEY + 'A gigantic insect queen dies: a long, low, shuddering screech of pain, then a massive crashing collapse of chitin and a final rattle.' },
  // --- the landing film (src/ui/landing.ts): the asset falls on the city before a deployment ---
  { id: 'land-roar', for: 'landing film: the meteor tears down through the sky (about 3 s before the strike)', seconds: 6, cut: 'one', maxSeconds: 3.4, fadeOut: 0.35,
    prompt: FOLEY + 'A huge burning meteor tears down through the sky toward the listener: a deep rumbling roar of fire and rushing wind that swells louder and louder for three seconds, then stops dead.' },
  { id: 'land-impact', for: 'landing film: the meteor strikes the city', seconds: 8, cut: 'one',
    prompt: FOLEY + 'A meteor strikes the ground in a town: one enormous deep booming explosion and a shock wave, then rubble, glass and debris raining down and a long low rumble dying away.' },
  { id: 'boss-roar', for: 'THE ROYAL TAKES THE FIELD', seconds: 6, cut: 'one',
    prompt: FOLEY + 'A gigantic insect queen arrives: a huge, deep, rattling roar with chittering mandibles, and a heavy thundering footstep.' },
  // --- the body ---
  { id: 'creep-spread', for: 'creep placed or spreading (a node)', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'Wet organic tissue spreads and crawls quickly over concrete: a short squelching slurp.' + REPEAT(4) },
  { id: 'creep-pulse', for: 'the creep grows a node on its own (a bladder\'s pulse)', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'A single deep wet heartbeat of a giant organism under the ground: a low muffled thump-thump.' + REPEAT(4) },
  { id: 'limb-grow', for: 'a limb is grown (a card placed on the board)', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A fleshy limb bursts up out of the ground and unfurls: wet tearing, squelching growth and creaking bone.' + REPEAT(4) },
  { id: 'limb-wither', for: 'a limb withers (its creep died)', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'Living tissue withers and dies: a dry crackle, a deflating hiss and a soft wet collapse.' + REPEAT(3) },
  { id: 'limb-lost', for: 'a limb or organ is destroyed or carried off', seconds: 8, cut: 'each', max: 4,
    prompt: FOLEY + 'A thick wet leather sack is ripped open and a bundle of dry branches snaps inside it: a violent wet tearing and a crunch.' + REPEAT(4) },
  { id: 'cannibalize', for: 'a limb is cannibalized into the next build', seconds: 6, cut: 'one',
    prompt: FOLEY + 'A creature devours one of its own limbs: slurping, gulping, crunching bone and one satisfied wet swallow.' },
  { id: 'core-evolve', for: 'the core evolves (stage 2, 3, 4)', seconds: 8, cut: 'one',
    prompt: FOLEY + 'A giant organism grows into a bigger form: a deep swelling organic groan, bones cracking and reshaping, and a great surging heartbeat.' },
  { id: 'plinth-rise', for: 'a plinth rises under a limb', seconds: 8, cut: 'each', max: 3,
    prompt: FOLEY + 'A pillar of bone and flesh rises out of the ground: grinding bone, creaking and a deep rumble, ending in a solid thud.' + REPEAT(3) },
  { id: 'organ-place', for: 'an organ is grown or upgraded (the organ stage)', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A soft fleshy organ is set into place and connects: a wet squelch and a soft heavy thump.' + REPEAT(5) },
  { id: 'evolve-limb', for: 'a limb EVOLVES (stage A/B picked)', seconds: 6, cut: 'each', max: 3,
    prompt: FOLEY + 'A limb mutates: a quick wet crackle of reshaping flesh and a rising shimmering organic swell.' + REPEAT(3) },
  // --- the waves ---
  { id: 'wave-siren', for: 'a wave is called: the town\'s air-raid siren, far off', seconds: 8, cut: 'one',
    prompt: 'Sound only, no music, no speech. A 1950s air-raid siren wails over a small town at night, heard from a distance, rising and falling once.' },
  { id: 'assault-march', for: 'the assault forms at the gates: boots, drums, chevrons', seconds: 8, cut: 'one',
    prompt: 'Sound only, no music melody, no speech. At a heavy stone city gate three loud mechanical clanks lock into place one after another, then an army of armoured insect soldiers marches in step: boots and chitin stamping, a snare drum keeping time.' },
  // --- the console (menu, ship, HUD) ---
  { id: 'ui-click', for: 'a button pressed', seconds: 8, cut: 'each', max: 6,
    prompt: CONSOLE + 'A single crisp tactile click of a heavy console key.' + REPEAT(8) },
  { id: 'ui-hover', for: 'the pointer over a button', seconds: 8, cut: 'each', max: 5,
    prompt: CONSOLE + 'A very soft, very short electronic tick.' + REPEAT(8) },
  { id: 'ui-confirm', for: 'a decision made: deploy, continue, choose', seconds: 8, cut: 'each', max: 4,
    prompt: CONSOLE + 'A clean two-tone rising electronic confirmation chirp.' + REPEAT(4) },
  { id: 'ui-deny', for: 'what cannot be done (a disabled button, an invalid cell)', seconds: 8, cut: 'each', max: 4,
    prompt: CONSOLE + 'A low, dull, short electronic denial buzz.' + REPEAT(4) },
  { id: 'card-draw', for: 'a card drawn into the hand', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A stiff card slides off the top of a deck: a quick soft paper swish.' + REPEAT(5) },
  { id: 'card-pick', for: 'a card picked up from the hand', seconds: 8, cut: 'each', max: 5,
    prompt: FOLEY + 'A stiff card is flicked and snapped between two fingers: a short crisp paper snap.' + REPEAT(5) },
  { id: 'pad-won', for: 'the data pad set down calmly (won)', seconds: 6, cut: 'each', max: 2,
    prompt: FOLEY + 'A glass tablet is set down calmly on a metal desk: a soft solid clack.' + REPEAT(2) },
  { id: 'pad-lost', for: 'the data pad dropped (lost)', seconds: 6, cut: 'each', max: 2,
    prompt: FOLEY + 'A glass tablet is dropped from a hand onto a metal desk: a hard clattering drop and a short rattle.' + REPEAT(2) },
  { id: 'intercom-open', for: 'YOKE\'s intercom opens', seconds: 6, cut: 'each', max: 3,
    prompt: CONSOLE + 'A starship intercom channel opens: a short burst of soft static and a clean two-note rising chime.' + REPEAT(3) },
  { id: 'intercom-close', for: 'YOKE\'s intercom closes', seconds: 6, cut: 'each', max: 3,
    prompt: CONSOLE + 'A starship intercom channel closes: a descending two-note chime and a soft click of static.' + REPEAT(3) },
  { id: 'print-body', for: 'the print-a-body scene (a bio-printer at work)', seconds: 12, cut: 'one',
    prompt: 'Sound only, no music, no speech. Inside a sterile starship lab a biological 3D printer prints a human body: whirring servos, a humming vat, wet dripping and sloshing fluid, soft mechanical clicks.' },
];

/** Style shared by the planetside music (the Empire's newsreel). */
const NEWSREEL = 'A 1950s newsreel and B-movie score: brassy, jaunty and ominous at once, a march that keeps strict time. Big band brass, snare drum, timpani, tuba, a little xylophone. Mono-era orchestral colour. No vocals.';

export const MUSIC = [
  { id: 'theme-menu', for: 'the main menu: the ship\'s hum', seconds: 120, loop: true,
    spec: { title: 'Merciful Yoke', genres: ['dark ambient', 'drone'], moods: ['austere', 'eerie', 'cold', 'patient'], tempo: 'slow',
      instruments: ['low synth drone', 'engine hum', 'sparse bowed metal', 'distant sub pulse'],
      freeform: 'The hum of a black orbital warship over an infested planet. Austere, sparse, a little eerie. A low steady drone with slow shifting overtones and a very quiet far-off pulse, now and then a single cold bowed-metal tone. No drums, no melody hooks, no vocals. Constant level from start to end so it loops.' } },
  { id: 'theme-ship', for: 'the ship\'s rooms (desk, gene bay, comms, AI core)', seconds: 120, loop: true,
    spec: { title: 'Orbital Tender', genres: ['dark ambient', 'minimal electronic'], moods: ['clinical', 'sterile', 'uneasy', 'calm'], tempo: 'slow',
      instruments: ['air-conditioning hum', 'soft sine pads', 'sparse glass tones', 'faint server clicks'],
      freeform: 'Inside the bridge of a black, silent Technopuritan warship: sterile, clinical, bureaucratic. A low room tone, soft cold pads and rare glassy notes, the quiet of machines that work. No drums, no vocals. Constant level from start to end so it loops.' } },
  { id: 'siege-build', for: 'a deployment, wave setup and the early siege (the lower intensity)', seconds: 90, loop: true,
    spec: { title: 'Clearance Operations', genres: ['1950s newsreel score', 'march', 'b-movie'], moods: ['jaunty', 'ominous', 'official', 'cheerful menace'], tempo: 'mid',
      instruments: ['muted brass', 'snare drum', 'tuba', 'xylophone', 'pizzicato strings'],
      freeform: NEWSREEL + ' This is the calm part: a light, sly, tiptoeing march with muted trumpets and pizzicato, the cheer of a pest-control advert over a hint of dread. Constant level so it loops.' } },
  { id: 'siege-assault', for: 'a deployment, the assault (the higher intensity)', seconds: 90, loop: true,
    spec: { title: 'The Assault', genres: ['1950s newsreel score', 'march', 'b-movie'], moods: ['urgent', 'triumphant', 'ominous', 'driving'], tempo: 'fast',
      instruments: ['full brass', 'snare drum', 'timpani', 'tuba', 'cymbals', 'strings'],
      freeform: NEWSREEL + ' This is the battle: a full, driving, brassy war march at speed, blaring trumpets and trombones over pounding timpani and rattling snare, heroic and monstrous at once. Constant intensity so it loops.' } },
  { id: 'organ', for: 'the organ stage (between waves, underground)', seconds: 120, loop: true,
    spec: { title: 'Under the Meteor', genres: ['dark ambient', 'organic drone'], moods: ['low', 'organic', 'breathing', 'intimate', 'strange'], tempo: 'slow',
      instruments: ['deep sub drone', 'slow heartbeat', 'wet textures', 'low cello harmonics', 'breath'],
      freeform: 'Underground inside a living organism growing around a buried meteor: low, warm and organic. A slow heartbeat, deep breathing drones, soft wet textures and low cello harmonics. Calm, patient, a little wrong. No drums, no vocals. Constant level so it loops.' } },
  // --- stingers (played once, over the music, which ducks under them) ---
  { id: 'sting-wave', for: 'a wave is called', seconds: 6,
    spec: { title: 'Wave Incoming', genres: ['1950s newsreel fanfare'], moods: ['alarming', 'jaunty'], tempo: 'fast', instruments: ['brass', 'snare roll', 'timpani'],
      freeform: 'A short 1950s newsreel brass fanfare announcing an attack: a snare roll and a bold, slightly comic call to arms. Ends on a held chord.' } },
  { id: 'sting-cleared', for: 'a wave cleared', seconds: 5,
    spec: { title: 'Wave Cleared', genres: ['1950s newsreel fanfare'], moods: ['cheerful', 'official'], tempo: 'mid', instruments: ['brass', 'xylophone', 'cymbal'],
      freeform: 'A very short, cheerful 1950s newsreel brass flourish: job done, resources acquired. Ends on a bright major chord with a cymbal.' } },
  { id: 'sting-victory', for: 'the deployment won', seconds: 12,
    spec: { title: 'Directive Fulfilled', genres: ['1950s newsreel fanfare', 'march'], moods: ['triumphant', 'grand', 'hollow'], tempo: 'mid', instruments: ['full brass', 'timpani', 'strings', 'cymbals'],
      freeform: 'A triumphant 1950s newsreel victory fanfare, big brass and timpani, grand and patriotic, with a slightly hollow, unsettling final chord.' } },
  { id: 'sting-defeat', for: 'the deployment lost', seconds: 10,
    spec: { title: 'Asset Terminated', genres: ['1950s b-movie score'], moods: ['defeated', 'ominous', 'somber'], tempo: 'slow', instruments: ['low brass', 'timpani', 'strings'],
      freeform: 'A short 1950s monster-movie defeat cue: low brass descending in a minor key, a timpani roll and a final dark sustained chord that fades.' } },
  { id: 'sting-desk', for: 'the Directive Desk opens / a faction calls', seconds: 6,
    spec: { title: 'Incoming Transmission', genres: ['minimal electronic'], moods: ['clinical', 'expectant'], tempo: 'mid', instruments: ['glass tones', 'soft synth pulse', 'low drone'],
      freeform: 'A short, clean, cold electronic motif announcing an incoming transmission on a starship: three glassy rising notes over a low drone, then a held tone.' } },
  { id: 'sting-core', for: 'the core evolves', seconds: 6,
    spec: { title: 'It Grows', genres: ['1950s b-movie score'], moods: ['awe', 'monstrous', 'swelling'], tempo: 'slow', instruments: ['theremin', 'low brass', 'strings tremolo', 'timpani'],
      freeform: 'A short 1950s monster-movie sting: a rising theremin wail over tremolo strings and a swelling low brass chord, ending on a timpani hit. The monster grows.' } },
  // --- the opening film's score (src/ui/intro.ts: eight shots of about 3.8 s, then the name for 3.6 s) ---
  { id: 'film', for: 'the opening film (the trailer of a 1950s monster picture)', seconds: 36,
    spec: { title: 'It Came From the Sky', genres: ['1950s b-movie score', 'monster movie trailer'], moods: ['quiet', 'ominous', 'rising', 'lurid'], tempo: 'mid',
      instruments: ['theremin', 'strings', 'brass', 'timpani', 'harp', 'celesta'],
      freeform: 'The score of a 1950s monster picture trailer, 36 seconds. 0-8 s: a quiet night in a small town, soft celesta and harp, peaceful with a hint of unease. 8-16 s: something falls from the sky, a theremin wail rising, strings tremolo, a huge timpani and brass hit at 12 s for the impact. 16-24 s: dread, low brass creeping, it is hungry. 24-31 s: the town fights back, a frantic brass march at speed. 31-36 s: the title card, a massive brass chord with a theremin on top, held and ringing out.' } },
];

/** The newsreel narrator (optional): the opening film's titles and a few planetside barks. */
const NARRATOR = (line) => `A black-and-white 1950s newsreel: close-up of a vintage ribbon microphone in a radio studio. An offscreen male newsreel announcer with a booming, chipper, fast mid-Atlantic accent says exactly: "${line}" Only his voice, no music.`;
export const VOICE = [
  { id: 'nar-film-1', for: 'film: sky', line: 'It was a quiet night, in a quiet little town.' },
  { id: 'nar-film-2', for: 'film: lookup', line: 'Until something came down out of the sky!' },
  { id: 'nar-film-3', for: 'film: crater', line: 'Nobody knew what it was.' },
  { id: 'nar-film-4', for: 'film: creep', line: 'It was hungry.' },
  { id: 'nar-film-5', for: 'film: militia', line: 'They fought it, street by street!' },
  { id: 'nar-film-6', for: 'film: rise', line: 'And it kept growing!' },
  { id: 'nar-wave', for: 'a wave is called (sometimes)', line: 'Here they come! The colony sends in its finest!' },
  { id: 'nar-wave-2', for: 'a wave is called (sometimes)', line: 'The pests are on the march! Clearance operations proceed on schedule!' },
  { id: 'nar-cleared', for: 'a wave cleared (sometimes)', line: 'Another wave cleared! Resources acquired for the Empire!' },
  { id: 'nar-royal', for: 'the royal takes the field', line: 'And here she comes: the royal herself takes the field!' },
].map((v) => ({ ...v, prompt: NARRATOR(v.line) }));
