/**
 * The design of every ACTUAL enemy unit in the game, one entry per kind in
 * content/data.ts ENEMIES. Collins, Sep 29 2026: "I would focus on trying to spec actual
 * game units rather than in the abstract". This file is the single source: the written
 * spec (assets/unit-spec.md) and the concept prompts are both generated from it.
 *
 * VERSION 2 (Collins, same day): "this is a 21st century civilisation on the edge of AI; if
 * they have melee weapons they are closer to power blades and stuff, and many would likely
 * have short range guns … these ones just have a range that means in terms of gameplay they
 * are functionally melee"; "the science caste would be distinctively less orthodox in tone".
 *
 * tier: the first wave tier the kind appears in (content/data.ts WAVE_TABLE).
 * r: its radius on the map in px at a 26 px cell (src/render/render.ts ENEMY_SIZE).
 * look: what is DRAWN. weapon: what it fights with. attack: what the attack looks like.
 * states: every picture the sprite needs beyond walking and attacking.
 * gait: how it moves when that is not plain from its body (fly, ride, scuttle). one: what
 * ONE body looks like when the design shows a group. attackMotion: what its attack clip shows.
 */
const SHOT = 'Fires from one cell away. The muzzle flash and a short tracer are drawn by code.';
const BLADE = 'Swings it at what is in front of it. The glowing arc of the edge is drawn by code.';
const BITE = 'Bites. No weapon.';

export const UNITS = [
  // ---- WAR CASTE (orange). Dress: Eastern Orthodox, with 21st-century kit. ----
  { kind: 'responder', name: 'Responder', caste: 'war', tier: 0, r: 5, hp: 20, body: 'human-like',
    job: 'The first on the scene. Weak, brave, and the whole of the first wave.',
    look: 'a small upright parish watchman in a plain orange high-visibility kaftan with reflective stripes and a soft cap with a radio headset, carrying an electric lantern on a pole in one hand and a small pistol in another',
    weapon: 'Pistol', attack: SHOT,
    basis: 'worker ant', states: ['dying'] },
  { kind: 'skitterling', one: 'ONE single tiny round hatchling on six quick legs, bare, with one dab of orange paint on its back', name: 'Skitterling', caste: 'war', tier: 1, r: 3.5, hp: 12, body: 'beast',
    job: 'Fast swarm chaff. Also what a splitter bursts into.',
    look: 'a tiny round hatchling on six quick legs, bare, with one dab of orange paint on its back; always drawn as a pack of five',
    weapon: 'None', attack: BITE,
    basis: 'ant hatchling', states: ['dying'] },
  { kind: 'militia', steep: true, name: 'Militia', caste: 'war', tier: 1, r: 6, hp: 45, body: 'human-like',
    job: 'The town levy. The bulk of the early waves.',
    look: 'an upright townsman in his own plain clothes with an orange sash across the chest, a pointed dome helmet far too big for him, holding an old pump shotgun with a small orange pennant tied to the barrel',
    weapon: 'Pump shotgun', attack: SHOT,
    basis: 'worker ant', states: ['dying', 'being promoted to soldier'] },
  { kind: 'soldier', name: 'Soldier', caste: 'war', tier: 2, r: 8, hp: 90, body: 'human-like',
    job: 'The regular army. The bulk of the middle waves.',
    look: 'an upright regular in a long orange kaftan with gold braid worn under a dark armoured vest, a pointed dome helmet that fits with a clear visor, holding a short carbine with a glowing power bayonet fixed under the barrel',
    weapon: 'Carbine with a power bayonet', attack: SHOT,
    basis: 'soldier ant', states: ['dying', 'being promoted to elite'] },
  { kind: 'splitter', name: 'Splitter', caste: 'war', tier: 2, r: 9, hp: 75, body: 'beast',
    job: 'Shot dead, it bursts into two skitterlings. Swallowed whole by a maw, it does not.',
    look: 'a stout porter on four legs with a wicker pannier strapped to its back over an orange blanket, two hatchlings peeking out of the pannier',
    weapon: 'None', attack: BITE,
    basis: 'wolf spider carrying her young', states: ['dying: the pannier breaks and two skitterlings run out'] },
  { kind: 'flier', gait: 'fly', name: 'Flier', caste: 'war', tier: 3, r: 6, hp: 55, body: 'human-like',
    job: 'Flies straight over blocks and walls to the core.',
    look: 'a winged trooper: a wasp with an upright torso in an orange tabard over a flight harness, a small dome helmet with goggles, carrying a short carbine, a whip antenna on its back flying a long orange pennant, drawn in the air with its shadow on the ground below',
    weapon: 'Carbine', attack: SHOT,
    basis: 'wasp', states: ['netted: on the ground, tangled in web, wings folded', 'dying'] },
  { kind: 'elite', name: 'Elite', caste: 'war', tier: 3, r: 11, hp: 200, body: 'human-like',
    job: 'The guard. Hits hard, takes a lot of killing.',
    look: 'a big upright guardsman with stag-beetle horns coming through a gilded dome helmet, a coat of small gold-edged armour plates, an orange cloak, and a great two-handed power axe whose blade edge glows hot orange-white, fed by a cable from a small power pack on his back',
    weapon: 'Power axe', attack: BLADE,
    basis: 'stag beetle', states: ['dying'] },
  { kind: 'mortar', attackMotion: 'The beetle braces its legs; the crewman drops a shell into the mortar tube and ducks; the mortar fires upward with a puff of smoke and a jolt of recoil; then everything returns to exactly its starting pose.', gait: 'ride', name: 'Mortar beetle', caste: 'war', tier: 4, r: 9, hp: 95, body: 'machine',
    job: 'Stops 85 px out and lobs shells at your limbs from standoff.',
    look: 'a squat beetle on six legs carrying a short fat modern mortar tube on a base plate on its back, an orange band around the tube, one small insect crewman in a kaftan and ear defenders loading a finned shell',
    weapon: 'Mortar', attack: 'Lobs a shell from 85 px. The mortar smokes and the crewman ducks.',
    basis: 'dung beetle', states: ['dying'] },
  { kind: 'sapper', name: 'Sapper', caste: 'war', tier: 4, r: 7, hp: 130, body: 'human-like',
    job: 'Climbs your blocks and eats limbs directly. Every limb shoots a climbing sapper first.',
    look: 'a steeplejack: a termite with big cutting jaws, a leather apron over an orange shirt, a tool belt, a coil of rope over one shoulder, a climbing hook in one upper hand and a power cutter with a glowing cutting disc in another, welding goggles pushed up on its head',
    weapon: 'Power cutter', attack: 'Cuts into the limb with the glowing disc. The sparks are drawn by code.',
    basis: 'termite soldier', states: ['climbing a wall, seen on the face of a block', 'dying'] },
  { kind: 'carapace', gait: 'scuttle', name: 'Carapace lord', caste: 'war', tier: 5, r: 10, hp: 160, body: 'machine',
    job: 'Blocks the first six hits outright. Big blows strip the shell; rapid fire wastes itself on it.',
    look: 'an ironclad beetle whose shell is a gilded onion dome in six armour segments, with an orange band around its base and a small radio antenna on top; a small head with big eyes peers out from under the rim, with a stubby gun barrel beside it',
    weapon: 'Stub gun under the rim', attack: SHOT,
    basis: 'ironclad beetle', states: ['six pictures of the shell: six segments down to none, plain brown shell beneath', 'dying'] },
  { kind: 'phalanx', gait: 'ride', name: 'Phalanx', caste: 'war', tier: 5, r: 13, hp: 750, body: 'machine',
    job: 'The shield wall. No single hit does more than 12. Slow and enormous.',
    look: 'a huge flat pill bug carrying a wall of tall painted shield panels in gold, deep blue and orange, like a screen of icons whose saints are insects, and one small insect gunner in a dome helmet and radio headset aiming a rifle over the top',
    weapon: 'Rifle over the top of the panels', attack: SHOT,
    basis: 'pill bug', states: ['dying: the panels fall flat'] },
  { kind: 'cannon', attackMotion: 'The beetle braces its legs and its long barrel fires once with a big muzzle flash, smoke and heavy recoil, the crew flinching, then everything returns to exactly its starting pose.', name: 'Siege cannon', caste: 'war', tier: 4, r: 10, hp: 160, body: 'machine',
    job: 'Walks until something of yours is in reach, braces, and shells it until destroyed.',
    look: 'a bombardier beetle whose abdomen is a long modern artillery barrel with a muzzle brake and ornate orange bands, with two small insect crew in kaftans and ear defenders walking beside it, one carrying a tablet',
    weapon: 'Artillery', attack: 'Shells from 150 px once deployed.',
    basis: 'bombardier beetle', states: ['deployed: legs braced wide, barrel raised, one crewman covering his ears', 'packing up', 'dying'] },
  { kind: 'drummer', attackMotion: 'The unit stops and strikes its bells hard with both hammers, three times, the bells swinging, then returns to exactly its starting pose.', name: 'Drummer', caste: 'war', tier: 3, r: 9, hp: 70, body: 'human-like',
    job: 'Everything near it marches faster. Kill it first.',
    look: 'an upright cicada bell-ringer carrying a wooden yoke of three bronze bells and two grey loudspeaker horns across its shoulders, striking the bells with two hammers, in an orange kaftan with a radio headset',
    weapon: 'Hammers', attack: 'Strikes with a hammer. The rings of sound are drawn by code.',
    basis: 'cicada', states: ['dying'] },
  { kind: 'bomber', name: 'Bomber', caste: 'war', tier: 4, r: 6, hp: 60, body: 'human-like',
    job: 'Runs at walls and organs and blows itself up.',
    look: 'a small running censer-bearer swinging a smoking golden censer on three chains, which is the bomb: it glows yellow from inside and has wires and a small blinking red light; goggles, an orange scarf',
    weapon: 'The censer', attack: 'Detonates on contact.',
    basis: 'exploding ant', states: ['dying without detonating'] },
  { kind: 'tunneler', name: 'Tunneler', caste: 'war', tier: 6, r: 8, hp: 110, body: 'beast',
    job: 'Burrows under your outer line where nothing can hit it, and comes up behind it.',
    look: 'a cave digger: a mole cricket with two great digging claws tipped with steel drill teeth, an electric lamp strapped to its head and a monk\'s hood pushed back, orange cord at the waist',
    weapon: 'Drill claws', attack: 'Tears with the drill claws.',
    basis: 'mole cricket', states: ['burrowed: only a travelling mound of broken street', 'surfacing out of the mound', 'dying'] },
  // FLAMETROOPER (Collins, Oct 2 2026): the hive's answer to your walking units. Its stream is drawn by code.
  { kind: 'flametrooper', name: 'Flametrooper', caste: 'war', tier: 3, r: 4.5, hp: 85, body: 'human-like', key: 'green',
    job: 'Hunts your walking units first and hoses them with fire; only goes for the limbs and the core when none are in sight.',
    look: 'an upright regular in a long orange kaftan with gold braid, a dark heat-proof apron and thick gauntlets, a pointed dome helmet with a smoked heat visor, two squat brass fuel tanks strapped on its back joined by a hose to a stubby flamethrower held low in both hands, a small blue pilot flame at its nozzle',
    weapon: 'Flamethrower', attack: 'Hoses a short cone of fire in front of it. The stream of fire is drawn by code.',
    attackMotion: 'The figure stands braced with its feet planted, holding the stubby nozzle level in both hands, pointing straight ahead in the direction it faces. The nozzle does not move at all: it stays exactly where it is, aimed straight ahead, for the whole clip. Only small things move: its shoulders tense and settle, the hose to the tanks jolts a little, its head bobs slightly. Draw NO fire, NO flame, NO smoke, NO steam, NO sparks and NO puffs of any kind anywhere: only the small blue pilot light at the nozzle tip. The air around the figure stays completely clear. It stays the same size and in the same place the whole time.',
    basis: 'soldier ant', states: ['dying'],
    // Seen from behind, the attack clips swing the nozzle out to its right after a second: only the opening is kept.
    clipShare: { attack: { N: 0.2 } },
    design: { refs: ['units/flametrooper/soldier-ref.png'],
      prompt: 'One small soldier for a strategy game, drawn exactly in the style, proportions, colours and camera of the reference picture (seen from high above, looking down at an angle; cartoonish, chunky). It is the same kind of insect soldier as the reference: an upright regular in a long orange kaftan with gold braid and a pointed dome helmet, but its helmet has a smoked heat visor, it wears a dark heat-proof apron and thick gauntlets, and on its back are two squat brass fuel tanks joined by a hose to a stubby flamethrower it holds low in both hands, with a small blue pilot flame at the nozzle. No fire stream. It faces the lower left, caught mid-stride, its whole body in the picture.' } },
  { kind: 'stalker', name: 'Stalker', caste: 'war', tier: 3, r: 8, hp: 85, body: 'human-like',
    job: 'Cloaked. Only limbs that can see it can shoot it.',
    look: 'a stick-thin figure in a long dark hooded habit with an orange cord at the waist, night-vision goggles glowing green under the hood, carrying a short power knife whose edge glows',
    weapon: 'Power knife', attack: BLADE,
    basis: 'stick insect', states: ['cloaked: a shimmer outline drawn by code', 'revealed', 'dying'] },
  { kind: 'shadewing', gait: 'fly', name: 'Shadewing', caste: 'war', tier: 4, r: 6, hp: 60, body: 'human-like',
    job: 'A cloaked flier. Needs a limb that reaches the air AND can see it.',
    look: 'a moth with dusk-grey wings and a dark veil over its head, an orange thread along the hem of the veil, carrying a small silenced pistol, drawn in the air with its shadow below',
    weapon: 'Silenced pistol', attack: SHOT,
    basis: 'moth', states: ['cloaked: a shimmer outline drawn by code', 'revealed', 'netted on the ground', 'dying'] },
  { kind: 'ghostsapper', name: 'Ghost sapper', caste: 'war', tier: 5, r: 7, hp: 120, body: 'human-like',
    job: 'A cloaked sapper: climbs your blocks and eats limbs unseen.',
    look: 'the steeplejack again, in a dark hooded habit over the leather apron, climbing hooks wrapped in cloth to keep them quiet, a small power cutter with a dim glowing disc',
    weapon: 'Power cutter', attack: 'Cuts into the limb with the dim disc.',
    basis: 'termite soldier', states: ['cloaked', 'revealed', 'climbing a wall', 'dying'] },
  { kind: 'tender', attackMotion: 'The unit stops and raises its spray injector, releasing a small puff of pale mist, then lowers it and returns to exactly its starting pose.', name: 'Tender', caste: 'war', tier: 5, r: 7, hp: 80, body: 'human-like',
    job: 'Heals the bodies around it in pulses. Kill it first.',
    look: 'a sister of mercy in a pale habit and white veil with an orange cord at the waist, a medic\'s backpack with a drip bag on a short pole, and a spray injector in one hand',
    weapon: 'Spray injector', attack: 'Barely fights. Heals: the pulse is drawn by code.',
    basis: 'nurse bee', states: ['dying'] },
  // ---- SCIENCE CASTE (teal). Distinctly LESS Orthodox: modern, secular, laboratory. ----
  { kind: 'researcher', steep: true, attackMotion: 'The unit stops, aims its dart pistol forward and fires one dart with a small puff, then lowers it and returns to exactly its starting pose.', name: 'Researcher', caste: 'science', tier: 'visits', r: 6, hp: 34, body: 'human-like',
    job: 'Walks around your guns to your least defended limb, sedates it and carries it off.',
    look: 'a tall thin upright scientist in a white lab coat with a teal lanyard and badge, safety goggles pushed up on its forehead, no helmet, an empty clear specimen container with steel clamps on its back, a tablet in one hand and a tranquilliser dart pistol in another',
    weapon: 'Dart pistol', attack: 'Sedates a limb: the line to the limb is drawn by code.',
    basis: 'mantis', states: ['carrying a limb in the container', 'dying: the limb falls out and re-roots'] },
  { kind: 'thief', name: 'Specimen thief', caste: 'science', tier: 'visits', r: 6, hp: 45, body: 'human-like',
    job: 'Slips through the same gaps, steals 15 war meat and runs.',
    look: 'a small hunched quick figure in a dark hooded sweatshirt with a teal scarf and night-vision goggles, clutching an empty duffel bag with both hands, carrying no weapon',
    weapon: 'None', attack: 'Steals meat; never fights.',
    basis: 'silverfish', states: ['running away with a full bag', 'dying: the meat spills back'] },
  { kind: 'infiltrator', steep: true, attackMotion: 'The unit stops, aims its dart pistol forward and fires one dart with a small puff, then lowers it and returns to exactly its starting pose.', name: 'Infiltrator', caste: 'science', tier: 'visits', r: 6, hp: 40, body: 'human-like',
    job: 'A cloaked researcher: limb theft you cannot see coming.',
    look: 'the scientist in a long dark raincoat buttoned to the chin over the lab coat, teal lining showing at the collar, thin dark goggles, the specimen container under a cloth',
    weapon: 'Dart pistol', attack: 'Sedates a limb.',
    basis: 'mantis', states: ['cloaked', 'revealed', 'carrying a limb', 'dying'] },
  { kind: 'dartgun', attackMotion: 'The beetle braces its legs and its rack launches one glass dart forward with a small puff, then everything returns to exactly its starting pose.', name: 'Sedation battery', caste: 'science', tier: 'visits', r: 9, hp: 90, body: 'machine',
    job: 'Braces in reach of your weakest limb and stuns it with darts so researchers can walk in. Eight darts, then it goes home.',
    look: 'a pale beetle carrying a launcher rack of eight glass dart tubes with teal fluid, teal markings on its shell and a small sensor dish, one insect operator in a lab coat with a tablet walking beside it',
    weapon: 'Dart launcher', attack: 'Fires a dart from 130 px once deployed.',
    basis: 'pale ground beetle', states: ['deployed: legs braced, rack tilted up', 'spent: tubes empty, walking home', 'dying'] },
  // The ENGINEER (Oct 2 2026, Collins: "give the science faction units that can build spawning locations, and even their own
  // towers"): it walks out with a study party and raises a FIELD STATION on a lot beside a street. The station and its turret
  // are drawn as buildings (tools/art/stations.mjs), not here.
  { kind: 'engineer', name: 'Field engineer', caste: 'science', tier: 'visits', r: 6, hp: 70, body: 'human-like', key: 'green',
    job: 'Walks past your creep with a study party and raises a field station on a lot beside a street; then stays to repair it and raise its turrets.',
    look: 'a tall thin upright scientist-engineer, the same kind of insect as the researcher, in a white lab coat under a teal utility vest with many pockets, a teal hard hat with a small headlamp, safety goggles, a coil of cable over one shoulder, a tall backpack frame loaded with folded aluminium mast sections and a small dish antenna, a cordless power driver in one hand and a tablet in another',
    weapon: 'Power driver', attack: 'Builds: it works at the station with its driver (the build is drawn by code).',
    attackMotion: 'The figure stops, kneels slightly and drives a bolt into something low in front of it with the power driver, its arm jolting twice, then stands and returns to exactly its starting pose. It stays the same size and in the same place the whole time. Nothing else appears: no sparks, no smoke.',
    basis: 'mantis', states: ['building', 'dying'],
    design: { refs: ['units/engineer/researcher-ref.png'],
      prompt: 'One small figure for a strategy game, drawn exactly in the style, proportions, colours and camera of the reference picture (seen from high above, looking down at an angle; cartoonish, chunky). It is the same kind of tall thin insect scientist as the reference, but dressed as a FIELD ENGINEER: a white lab coat under a teal utility vest with many pockets, a teal hard hat with a small headlamp, safety goggles, a coil of cable over one shoulder, and a tall backpack frame loaded with folded aluminium mast sections and a small dish antenna; a cordless power driver in one hand and a tablet in the other. It faces the lower left, caught mid-stride, its whole body in the picture.' } },
  // ---- ROYAL CASTE (gold). Only with a royal event. ----
  { kind: 'royal', steep: "Its crown or helmet has plain upright ribs and a plain gold ball on top: no bands that cross each other anywhere on it.", attackMotion: 'The queen stops, raises her small gold pistol and fires twice with small muzzle flashes, then lowers it and returns to exactly her starting pose.', name: 'The royal', caste: 'royal', tier: 'royal event', r: 20, hp: 1100, body: 'human-like',
    job: 'The jackpot and the hardest fight. War bodies near her hit harder and take less.',
    look: 'the queen: three times the height of a soldier, an upright torso in a white and gold robe with a jewelled collar, a tall domed jewelled crown, and a huge swollen abdomen carried behind her like the train of a gown, a small ornate gold pistol in her folded hands and a radio pack strapped to her abdomen; regal and tired',
    weapon: 'Ornate gold pistol', attack: SHOT,
    basis: 'termite queen', states: ['caught in the trap cage', 'grafted: marching for you, a red graft on her neck', 'dying'] },
  { kind: 'consort', steep: "Its helmet has plain upright ribs only, green between them: no bands that cross each other anywhere on it, no cross shape anywhere.", name: 'Consort', caste: 'royal', tier: 'royal event', r: 13, hp: 420, body: 'human-like',
    job: 'Promotes the nearest war body one rank every five seconds.',
    look: 'an upright officer in a dark green dress uniform with gold epaulettes and a gold sash, half the height of the queen, goggles pushed up on his cap, holding a gold dress pistol',
    weapon: 'Dress pistol', attack: SHOT,
    basis: 'drone ant', states: ['promoting: raises his free hand in salute', 'dying'] },
  { kind: 'matron', steep: true, attackMotion: 'The veiled figure stops and strikes forward with one arm from under the veil, then returns to exactly its starting pose.', name: 'Veil matron', caste: 'royal', tier: 'royal event', r: 13, hp: 380, body: 'human-like',
    job: 'Every war body near her is cloaked while she lives. She is visible: kill her first.',
    look: 'a tall still figure under a long grey veil edged in gold that reaches the ground, hands folded, only her amber eyes showing',
    weapon: 'None', attack: 'Strikes with her arms.',
    basis: 'lacewing', states: ['veiling: the ring is drawn by code', 'dying: the veil drops'] },
];

/** The sheets the units are drawn on: a handful at a time holds one style across them. */
export const SHEETS = [
  { slug: 'units-1-first-waves', title: 'The first waves (tiers 0 to 2)', kinds: ['responder', 'skitterling', 'militia', 'soldier', 'splitter'] },
  { slug: 'units-2-army', title: 'The army (tier 3)', kinds: ['elite', 'flier', 'drummer', 'stalker'],
    extra: [{ of: 'flier', state: 'netted', look: 'THE FLIER NETTED: the same winged trooper on the ground, tangled in white web, wings folded, carbine dropped' }] },
  { slug: 'units-3-siege', title: 'Siege and sappers (tier 4)', kinds: ['sapper', 'bomber', 'mortar', 'cannon', 'shadewing'],
    extra: [{ of: 'cannon', state: 'deployed', look: 'THE SIEGE CANNON DEPLOYED: the same beetle with its legs braced wide and the barrel raised, one crewman covering his ears' }] },
  { slug: 'units-4-last', title: 'Everything they have (tiers 5 and 6)', kinds: ['phalanx', 'carapace', 'tender', 'ghostsapper', 'tunneler'],
    extra: [{ of: 'carapace', state: 'stripped', look: 'THE CARAPACE LORD STRIPPED: the same beetle with its gilded dome knocked off, plain brown shell showing' },
      { of: 'tunneler', state: 'burrowed', look: 'THE TUNNELER BURROWED: only a mound of broken paving stones with a little lamp light showing through' }] },
  { slug: 'units-5-science', title: 'The science caste', kinds: ['researcher', 'thief', 'infiltrator', 'dartgun'],
    extra: [{ of: 'researcher', state: 'carrying', look: 'THE RESEARCHER CARRYING: the same scientist walking away with a small pink fleshy organ locked in the container on its back' },
      { of: 'dartgun', state: 'deployed', look: 'THE SEDATION BATTERY DEPLOYED: the same beetle with its legs braced and the launcher rack tilted up' }] },
  { slug: 'units-6-royal', title: 'The royal caste', kinds: ['royal', 'consort', 'matron'] },
];

/**
 * THE HIVE'S OWN WALKERS (Sep 30 2026): what fights on the player's side in the streets. Drawn
 * like the units (five views, walking and attacking) and baked into the manifest's `allies`.
 * - The broodling: the Broodmother's brood (sim.broodlings without `puppet`).
 * - The puppet queens: a royal the Trap Cage caught and grafted (sim.broodlings with `puppet`),
 *   one per royal kind. The kind is on `puppet.kind`.
 * design: the ally has no concept sheet; its figure is drawn first from these references
 * (paths under art-src/) and this prompt. key: its background (the colour it has least of).
 */
const graft = (who) => `${who}, but GRAFTED by the hive and fighting for it now: a big pulsing dark-red living graft sits on the back of the neck, wet dark maroon flesh and veins have grown out from it over the shoulders and down the clothes, thin red roots creep over the headgear, and the eyes glow red. Everything else is exactly as in the reference picture: the same figure, clothes, colours and kit.`;
export const ALLIES = [
  { kind: 'broodling', ally: true, noEmblem: true, name: 'Broodling', caste: 'hive', r: 4.5, body: 'beast', gait: 'scuttle', key: 'green',
    look: 'a small newborn hive creature the size of a large dog: a glossy wet pink body, its back covered in dark scaly plates held in a lattice of pale veins like the shell of the brood sac, six short hooked pink legs, and at its front a big round mouth ringed with small pale teeth; no eyes, no clothes, no kit',
    attackMotion: 'The creature rears up on the spot and snaps its round toothed mouth open and shut twice, biting at something just in front of it, then settles back to exactly its starting pose. It stays the same size and in the same place the whole time.',
    design: { refs: ['limbs/brood/still.png', 'units/skitterling/view-SW.png'],
      prompt: 'One small creature for a strategy game, seen by the camera of the SECOND reference picture (high above, looking steeply down) and at about twice the size of the creature in it: a newborn of the living brood sac of the FIRST reference picture, in exactly that picture\'s material and colours. It is a glossy wet pink body, its back covered in dark scaly plates held in a lattice of pale veins like the shell of the sac, six short hooked pink legs, and at its front a big round mouth ringed with small pale teeth. No eyes, no clothes, no kit. It faces the lower left, caught mid-stride.' } },
  // The BROODMOTHER (Oct 1 2026, Collins: born of a Broodmother Den, "brood mode" or "fighting mode" with a net):
  // a big mobile unit of yours, the size of a royal. The net and her mode marks are drawn by code.
  { kind: 'broodmother', ally: true, noEmblem: true, name: 'Broodmother', caste: 'hive', r: 12, body: 'beast', gait: 'scuttle', key: 'green',
    look: 'a huge grown mother of the brood, the size of a car: a long swollen glossy wet pink abdomen heavy with clusters of glossy pink eggs, dragged low behind her; a broad armoured front of dark scaly plates held in a lattice of pale veins; six thick hooked pink legs; at her front a big round mouth ringed with pale teeth; two long thin pale spinneret arms folded over her back; no eyes, no clothes, no kit',
    attackMotion: 'She rears up on the spot, snaps her big round toothed mouth open and shut once, and flicks her two spinneret arms forward as if throwing something, then settles back to exactly her starting pose. She stays the same size and in the same place the whole time.',
    design: { refs: ['limbs/brood/still.png', 'units/broodling/turnaround.png'],
      prompt: 'One big creature for a strategy game, seen from high above, looking steeply down: the grown MOTHER of the small newborn creatures in the SECOND reference picture, in exactly the material and colours of the brood sac in the FIRST reference picture, and about four times their size. She has a long swollen glossy wet pink abdomen heavy with clusters of glossy pink eggs dragged low behind her, a broad armoured front of dark scaly plates held in a lattice of pale veins, six thick hooked pink legs, a big round mouth ringed with pale teeth at her front, and two long thin pale spinneret arms folded over her back. No eyes, no clothes, no kit. She faces the lower left, caught mid-stride.' } },
  // The INFESTOR (Oct 2 2026, Collins: "an expensive fairly fragile but large and slow unit ... it burrows into" a
  // shelter): a big burrowing larva of yours. Its burrowing is drawn by code (it sinks at the door).
  { kind: 'infestor', ally: true, noEmblem: true, name: 'Infestor', caste: 'hive', r: 13, body: 'beast', gait: 'scuttle', key: 'green',
    look: 'a SIEGE TICK of the brood (Oct 2 2026 redesign, concept a in notes/art-review/infestor/): a low, broad, heavily armoured body like a huge tick, covered in overlapping pale bone plates edged in dark red; at its front a ring of six curved bone drill-mandibles closed round a boring proboscis; its swollen rear abdomen translucent and glowing amber, packed with dark creep and clustered eggs; a short crest of dark spines along its back; eight short thick hooked legs; no eyes, no clothes, no kit',
    attackMotion: 'The tick stops, lowers its front and opens its ring of six bone drill-mandibles, jabs its boring proboscis forward twice, then closes the mandibles and returns to exactly its starting pose. It stays the same size and in the same place the whole time.',
    // Its design picture is the chosen concept (art-src-new/units/infestor/ref.png, copied from infestor-concepts/).
    design: { refs: ['units/broodmother/view-SW.png', 'units/broodling/turnaround.png'], prompt: 'see tools/art/infestor-concepts.mjs, concept a-siege-tick' } },
  // The HARRIER (Oct 2 2026, Collins: "a faster long range attacker that is harder to make in large numbers ... to solve
  // science teams attacking you far from any response"): a lean fast hunter of yours that flings quills. Its quills in
  // flight are drawn by code.
  { kind: 'harrier', ally: true, noEmblem: true, name: 'Harrier', caste: 'hive', r: 5.5, body: 'beast', gait: 'scuttle', key: 'green',
    look: 'a lean fast hunting creature of the brood, the size of a big dog: a slim glossy pink body on four long thin jointed legs built for running, a narrow armoured back of dark scaly plates held in a lattice of pale veins, and along its spine a raised crest of long pale quills like a porcupine; a small round toothed mouth at its front; no eyes, no clothes, no kit',
    attackMotion: 'The hunter stops, arches its back and snaps its crest of quills forward, flinging them ahead of it, then settles back to exactly its starting pose. It stays the same size and in the same place the whole time.',
    design: { refs: ['units/broodling/turnaround.png', 'units/broodmother/view-SW.png'],
      prompt: 'One small creature for a strategy game, seen from high above, looking steeply down: a lean fast HUNTER of the same living brood as the small creatures in the FIRST reference picture, in exactly their material and colours, a little bigger than them and much longer in the leg. It is a slim glossy pink body on four long thin jointed legs built for running, a narrow armoured back of dark scaly plates held in a lattice of pale veins, and along its spine a raised crest of long pale quills like a porcupine; a small round toothed mouth at its front. No eyes, no clothes, no kit. It faces the lower left, caught mid-stride.' } },
  { kind: 'puppet-royal', ally: true, of: 'royal', name: 'Puppet queen', caste: 'hive', r: 20, body: 'human-like', key: 'green',
    steep: "Its crown has plain upright ribs and a plain gold ball on top: no bands that cross each other anywhere on it.",
    look: 'the grafted queen: an upright torso in a white and gold robe with a jewelled collar, a tall domed jewelled crown, a huge swollen abdomen carried behind her like the train of a gown, a small ornate gold pistol in her hands; a big dark-red living graft on the back of her neck with maroon veins spread over her robe and red roots over her crown, her eyes glowing red',
    attackMotion: 'The queen stops, raises her small gold pistol and fires twice with small muzzle flashes, then lowers it and returns to exactly her starting pose.',
    design: { refs: ['units/royal/view-SW.png'], prompt: graft('The same queen as the reference picture') } },
  { kind: 'puppet-consort', ally: true, of: 'consort', name: 'Puppet consort', caste: 'hive', r: 13, body: 'human-like', key: 'magenta',
    steep: "Its helmet has plain upright ribs only: no bands that cross each other anywhere on it, no cross shape anywhere.",
    look: 'the grafted consort: an upright officer in a dark green dress uniform with gold epaulettes and a gold sash, goggles pushed up on his cap, a gold dress pistol; a big dark-red living graft on the back of his neck with maroon veins spread over his uniform, his eyes glowing red',
    attackMotion: 'The unit stops, raises its gold pistol and fires three quick shots in the direction it is facing, with small bright muzzle flashes and recoil, then lowers the pistol and returns to exactly its starting pose.',
    design: { refs: ['units/consort/view-SW.png'], prompt: graft('The same officer as the reference picture') } },
  { kind: 'puppet-matron', ally: true, of: 'matron', name: 'Puppet matron', caste: 'hive', r: 13, body: 'human-like', key: 'green', steep: true,
    look: 'the grafted veil matron: a tall still figure under a long grey veil edged in gold that reaches the ground, only her eyes showing, glowing red; dark-red living roots and maroon veins have grown through the veil from a pulsing graft at the back of her neck',
    attackMotion: 'The veiled figure stops and strikes forward with one arm from under the veil, then returns to exactly its starting pose.',
    design: { refs: ['units/matron/view-SW.png'], prompt: graft('The same veiled figure as the reference picture') } },
  // The townsfolk (Sep 30 2026, DESIGN.md "a NEIGHBORHOOD, not a battlefield"): not a fighter, never an enemy. The
  // renderer draws them fleeing the crash along the streets (src/sim/civilians.ts). A worker-ant commuter in plain clothes.
  { kind: 'civilian', ally: true, name: 'Townsperson', caste: 'town', r: 4, body: 'human-like', gait: 'run', key: 'green',
    emblem: 'It carries no emblem, no badge, no sash and no markings of any kind, and there is no lettering anywhere. There are no crosses, no stars and no crescents anywhere',
    look: 'an ordinary worker-ant townswoman on her way home: a dark glossy insect head with big amber eyes and two short antennae, no helmet but a soft pale-blue cloth cap, a plain long pale-blue work coat with a cream scarf, carrying a bulging brown paper shopping bag in one hand; no weapon, no sash, nothing orange',
    design: { refs: ['units/militia/view-SW.png'],
      prompt: 'One small person for a strategy game, seen by exactly the camera of the reference picture (high above, looking steeply down) and at the same size and in exactly the same chunky, slightly cartoonish drawing style: the same kind of worker-ant townsperson as the reference, with the same dark glossy insect head and big amber eyes, but an ORDINARY CIVILIAN, not a soldier. She wears no helmet but a soft pale-blue cloth cap with two short antennae poking out, a plain long pale-blue work coat and a cream scarf, and carries a bulging brown paper shopping bag in one hand. No weapon, no sash, no belt of pouches, nothing orange. She faces the lower left, running mid-stride in a panic, her free arm raised.' } },
];

export const unit = (kind) => UNITS.find((u) => u.kind === kind) ?? ALLIES.find((u) => u.kind === kind);

/** Where a unit (or one of its states) stands on its approved sheet: the sheet and the figure's number. */
export function placeOnSheet(kind, state) {
  for (const s of SHEETS) {
    const figures = [...s.kinds.map((k) => ({ of: k })), ...(s.extra || [])];
    const index = figures.findIndex((g) => g.of === kind && g.state === state);
    if (index >= 0) return { sheet: s.slug.replace('units-', 'units-v2-'), index, count: figures.length };
  }
  return null;
}
