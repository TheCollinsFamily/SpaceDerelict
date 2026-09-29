/**
 * The design of every limb (tower) in the game, one entry per family in content/data.ts
 * TOWERS. The written spec (assets/limb-spec.md), the design sheets and the clips are all
 * generated from this file.
 *
 * Collins, Sep 29 2026: towers "don't need multiple angles". Each limb is ONE view; a limb
 * with a facing shows it with the arrows the game already draws.
 *
 * "One flesh, nine accents" (assets/style-bible.md): every limb is the same flesh and
 * chitin with ONE accent from the organ that unlocks it.
 *
 * look: what is drawn. idle: what it does while waiting. fire: what its attack clip shows
 * (null = it has no attack of its own). on: 'roof' (on a block) or 'street'.
 *
 * A firing clip shows the BODY's motion. What a limb throws that is light or vapour (a beam,
 * a cloud, a flash) cannot be cut off its background and is drawn by the game: those limbs
 * are `quiet`, and their clip is told that nothing leaves the body.
 */
export const QUIET = ' Nothing leaves its body: no cloud, no mist, no smoke, no beam, no lightning and no flash around it. Only its body moves.';

/**
 * THE MATERIAL (Collins, Sep 29 2026: the towers and the central body "don't really fit the
 * style of the city and creep, it looks like two different art styles imposed"). Every limb
 * and the core are redrawn in the tissue of the creep itself: one body, risen into shapes.
 * The redraw is given two pictures: the limb (its shape) and the creep (its material).
 */
export const MATERIAL =
  'Redraw the organism of the FIRST picture so that it is made of exactly the living tissue shown in the SECOND ' +
  'picture: the same deep maroon and dark crimson flesh, lumpy and wet, crossed by the same net of darker raised ' +
  'veins, with the same small glossy highlights. It is the same body as that tissue, risen up into a shape. ' +
  'Keep its shape, its pose, its parts, its size in the frame and the direction it faces exactly as they are. ' +
  'Its raised and rounded parts are a lighter, redder crimson than its hollows, so that its form reads clearly. ' +
  'Keep its plates of dark chitin. At its base its roots spread outward and melt into a low ragged skirt of ' +
  'that same veined tissue lying flat on the ground. The same view as the first picture: isometric, from 45 ' +
  'degrees above. Soft even light from directly overhead, no cast shadows, no text.';
export const THEMES = {
  core: { name: 'Meteor Core', accent: 'plain muscle and dark chitin, nothing else', key: 'green' },
  forge: { name: 'Bone Forge', accent: 'ivory bone', key: 'green' },
  venom: { name: 'Venom Sac', accent: 'swollen acid yellow-green glands', key: 'blue' },
  gut: { name: 'Gut', accent: 'dark wine-red gullet and rows of small teeth', key: 'green' },
  nerve: { name: 'Nerve Cluster', accent: 'pale blue-white nerve cords that glow faintly', key: 'green' },
  lattice: { name: 'Mucus Lattice', accent: 'glassy, milky-white strands and membranes of mucus', key: 'green' },
  womb: { name: 'Brood Womb', accent: 'clusters of glossy pink eggs', key: 'green' },
  vault: { name: 'Marrow Vault', accent: 'amber marrow that glows through split bone', key: 'green' },
  chamber: { name: 'Resonance Chamber', accent: 'taut violet membrane', key: 'green' },
  other: { name: 'Special', accent: 'plain muscle and dark chitin', key: 'green' },
};

const CALM = 'The organism breathes slowly and only slightly: its flesh swells and relaxes a little, its plates shift a little against each other.';

export const LIMBS = [
  // ---- Meteor Core ----
  { family: 'spitter', name: 'Spitter', theme: 'core', on: 'roof', job: 'Cheap, reliable, one target at a time.',
    look: 'a squat stalk of muscle topped by one puckered fleshy nozzle that points up and forward',
    idle: `${CALM} The nozzle puckers and loosens.`,
    fire: 'The nozzle clenches shut, the whole stalk tightens, and it spits one glob of dark fluid forward and up with a snap, then relaxes back to exactly its starting pose.' },
  { family: 'lasher', name: 'Lasher', theme: 'core', on: 'roof', job: 'Melee sweep: shreds crowds that come close.',
    look: 'a thick muscular stump from which three long whip-like tendrils rise, each tipped with a dark chitin barb',
    idle: `${CALM} The three tendrils sway slowly.`,
    fire: 'The three tendrils lash outward and down in one fast sweep all the way round, then coil back to exactly their starting pose.' },
  { family: 'spine', name: 'Spine Wall', theme: 'core', on: 'street', job: 'Stands IN the street and must be chewed through; what chews it gets barbs back.',
    look: 'a low barricade as wide as a street lane: a band of muscle along the ground from which a row of tall curved spines of dark chitin grows, like a row of ribs',
    idle: `${CALM} The spines flex very slightly.`,
    fire: 'The row of spines bristles outward sharply, all at once, then settles back to exactly its starting pose.' },
  // ---- Bone Forge ----
  { family: 'impaler', name: 'Impaler', theme: 'forge', on: 'roof', job: 'A long harpoon that skewers a whole file and ignores shields.',
    look: 'a squat mound of muscle cradling one long ivory bone harpoon, drawn back under tension like the bolt of a ballista, pointing forward and slightly up',
    idle: `${CALM} The harpoon trembles under tension.`,
    fire: 'The muscle snaps and the long bone harpoon shoots forward out of the frame; a new harpoon slides up out of the mound into the same place, back to exactly the starting pose.' },
  { family: 'quill', name: 'Quill Fan', theme: 'forge', on: 'roof', job: 'The shotgun: five pellets across a cone, brutal up close.',
    look: 'a fan of a dozen long ivory quills spread like the tail of a peacock, rising from a muscular base',
    idle: `${CALM} The fan of quills opens and closes a little.`,
    fire: 'The fan snaps forward and a volley of quills shoots out of it; new quills slide up into the gaps, back to exactly the starting pose.' },
  { family: 'skipper', name: 'Skipping Mortar', theme: 'forge', on: 'roof', facing: true, job: 'Fires one way only, very far; the shell skips on down the line.',
    look: 'a short fat mortar tube of ivory bone lying at a low angle on a muscular cradle, its mouth pointing forward',
    idle: `${CALM} The mouth of the tube flexes.`,
    fire: 'The cradle tightens and the bone tube coughs out one round shell with a puff of dust and a jolt of recoil, then settles back to exactly its starting pose.' },
  { family: 'bombard', name: 'Spore Bombard', theme: 'forge', on: 'roof', job: 'Artillery the player aims at a marked spot.',
    look: 'a tall chimney of overlapping ivory bone plates on a swollen muscular base, pointing at the sky',
    idle: `${CALM} A thin wisp of spores drifts from the top of the chimney.`,
    fire: 'The base swells, then the chimney thumps a shell straight up and out of the frame with a burst of golden spores and a heavy recoil, then settles back to exactly its starting pose.' },
  // ---- Venom Sac ----
  { family: 'blighter', name: 'Blight Vent', theme: 'venom', on: 'roof', job: 'Poison clouds that keep eating; poison ignores armour.',
    look: 'a chimney of flesh ringed with swollen acid yellow-green glands, a thin sickly haze drifting from its mouth',
    idle: `${CALM} The glands pulse one after another.`,
    quiet: true,
    fire: 'The glands squeeze hard one after another from the bottom up and the mouth of the chimney gapes wide and shudders, then the glands refill, back to exactly the starting pose.' },
  { family: 'mister', name: 'Caustic Mister', theme: 'venom', on: 'roof', job: 'A mist that strips armour for every other limb.',
    look: 'a cluster of six thin nozzles on stalks around one acid yellow-green gland sac, like a garden sprinkler',
    idle: `${CALM} The thin nozzles sway.`,
    quiet: true,
    fire: 'All six nozzles stiffen, point outward and shudder together as the gland sac squeezes flat, then the sac refills and the nozzles droop back to exactly the starting pose.' },
  { family: 'ember', name: 'Ember Sac', theme: 'venom', on: 'roof', job: 'A flamethrower: everything in its cone catches fire.',
    look: 'a bloated sac that glows orange from within, ringed with acid yellow-green glands, with one short scorched black nozzle',
    idle: `${CALM} The orange glow inside the sac brightens and dims.`,
    quiet: true,
    fire: 'The sac squeezes and its orange glow surges bright while the nozzle gapes and shudders, then the glow dims, back to exactly the starting pose.' },
  // ---- Gut ----
  { family: 'maw', name: 'Maw', theme: 'gut', on: 'roof', job: 'Eats weakened enemies whole and pays richer meat.',
    look: 'a wide round mouth lying open facing up and forward, ringed with rows of small teeth, its gullet dark wine red',
    idle: `${CALM} The mouth opens and closes a little, as if tasting the air.`,
    fire: 'The mouth lunges forward, snaps shut, gulps with a swallow that travels down its throat, then opens again to exactly its starting pose.' },
  { family: 'swamp', name: 'Digestive Swamp', theme: 'gut', on: 'street', flat: true, job: 'Lies IN the street: slows and dissolves everything that wades through it.',
    look: 'a shallow pool of dark wine-red digestive acid as wide as a street lane, with a low fleshy rim set with small teeth, lying flat on the ground',
    idle: 'The pool bubbles slowly; small ripples cross it; the fleshy rim twitches.',
    fire: null },
  { family: 'burster', name: 'Burster', theme: 'gut', on: 'roof', job: 'Lobs sacs that burst in an area.',
    look: 'a cluster of taut round dark-red sacs on a thick stalk, like a bunch of grapes, each sac with a ring of tiny teeth at its stem',
    idle: `${CALM} The sacs swell and shrink one after another.`,
    fire: 'One sac tears free and is flung forward and up out of the frame; a new sac swells in its place, back to exactly the starting pose.' },
  { family: 'lobber', name: 'Bile Lobber', theme: 'gut', on: 'roof', job: 'A volley the player aims by hand.',
    look: 'a muscular arm rising from a toothed dark-red base and ending in a cupped sling that holds one glob of yellow bile',
    idle: `${CALM} The arm sways; the glob of bile wobbles in the sling.`,
    fire: 'The arm whips forward and flings the glob of bile out of the frame, then swings back and a new glob wells up in the sling, back to exactly the starting pose.' },
  // ---- Nerve Cluster ----
  { family: 'frond', name: 'Galvanic Frond', theme: 'nerve', on: 'roof', job: 'One strike arcs on to three more bodies.',
    look: 'a fern-like frond of pale blue-white nerve cords, with faint sparks at its tips',
    idle: `${CALM} Faint sparks crawl along the frond.`,
    quiet: true,
    fire: 'The frond snaps rigid and its tips flare bright blue-white for a moment while the whole stalk shudders, then it relaxes back to exactly its starting pose.' },
  { family: 'prism', name: 'Arc Prism', theme: 'nerve', on: 'roof', job: 'A beam that ramps on a held target; idle prisms relay to the one that is firing.',
    look: 'a faceted lens of clear cartilage held in a claw of pale blue-white nerve cords, glowing softly',
    idle: `${CALM} Light moves slowly inside the lens.`,
    quiet: true,
    fire: 'The claw of nerve cords clenches on the lens and the lens blazes bright blue-white from within for a moment, then dims, the claw loosening back to exactly its starting pose.' },
  { family: 'ocular', name: 'Ocular Stalk', theme: 'nerve', on: 'roof', job: 'A board-wide eye that executes support castes and sees the cloaked.',
    look: 'one large wet eye with a pale blue iris on top of a tall slender stalk wrapped in pale blue-white nerve cords',
    idle: `${CALM} The eye looks slowly left and right, and blinks once.`,
    quiet: true,
    fire: 'The eye snaps wide open, its pupil narrows to a point and the stalk goes rigid, staring hard for a moment, then the eye relaxes back to exactly its starting pose.' },
  { family: 'net', name: 'Netcaster', theme: 'nerve', on: 'roof', job: 'Hits only fliers: drags them to the ground.',
    look: 'a splayed hand of five thin tendons wrapped in pale blue-white nerve cords, a folded white web held between the fingers, pointing at the sky',
    idle: `${CALM} The fingers open and close a little.`,
    fire: 'The hand throws the white web upward out of the frame with a flick, then a new web unfolds between the fingers, back to exactly the starting pose.' },
  // ---- Mucus Lattice ----
  { family: 'tangler', name: 'Snare Bed', theme: 'lattice', on: 'roof', job: 'Its hits slow what they touch.',
    look: 'a low fleshy hub from which glassy milky-white strands of mucus stretch out like the spokes of a web',
    idle: `${CALM} The mucus strands quiver.`,
    fire: 'The hub squeezes and spits a rope of white mucus forward out of the frame, then settles back to exactly its starting pose.' },
  { family: 'ward', name: 'Ward Membrane', theme: 'lattice', on: 'roof', job: 'Shields every other limb near it.',
    look: 'a dome of glassy milky-white membrane stretched over thin ribs of chitin, like a soap bubble half sunk in flesh',
    idle: `${CALM} A shimmer of light crosses the dome.`,
    fire: null },
  { family: 'choir', name: 'Choir Node', theme: 'lattice', on: 'roof', job: 'The limbs around it fire faster.',
    look: 'a ring of seven slender glassy milky-white pipes of different heights, like organ pipes, round a fleshy hub',
    idle: 'The pipes vibrate one after another, as if each were sounding a note; the hub breathes slowly.',
    fire: null },
  // ---- Brood Womb ----
  { family: 'brood', name: 'Broodmother', theme: 'womb', on: 'roof', job: 'Keeps three broodlings fighting in the street below.',
    look: 'a swollen sac studded with clusters of glossy pink eggs, with a puckered slit at the front',
    idle: `${CALM} Something moves inside the sac; the eggs glisten.`,
    fire: 'The slit opens and one small pink broodling squeezes out and drops forward out of the frame, then the slit closes, back to exactly the starting pose.' },
  { family: 'sling', name: 'Spore Sling', theme: 'womb', on: 'roof', job: 'The player throws creep with it to far ground.',
    look: 'a tendon catapult: one long arm cocked back under tension, with a dark red clot in the basket at its end, on a base studded with pink eggs',
    idle: `${CALM} The cocked arm trembles.`,
    fire: 'The arm snaps forward and flings the dark red clot up and out of the frame, then winches slowly back and a new clot wells up in the basket, back to exactly the starting pose.' },
  { family: 'lure', name: 'Lure Gland', theme: 'womb', on: 'roof', job: 'Draws the science caste; pulses a toxic pheromone cloud.',
    look: 'a tall slender stalk topped with a softly glowing bulb, its base ringed with glossy pink eggs, a faint haze drifting from the bulb',
    idle: `${CALM} The bulb glows brighter and dimmer; the stalk sways.`,
    quiet: true,
    fire: 'The bulb swells to twice its size and glows brightly, then shrinks back to exactly its starting pose.' },
  // ---- Marrow Vault: combo engines ----
  { family: 'conduit', name: 'Marrow Conduit', theme: 'vault', on: 'roof', facing: true, job: 'Copies the bonuses of the limbs around it into the one it points at.',
    look: 'a thick pipe of bone split open along its top to show glowing amber marrow, with one wide open mouth at its front end, on a muscular base',
    idle: 'Glowing amber marrow flows slowly along the pipe toward its mouth; the base breathes slowly.', fire: null },
  { family: 'tap', name: 'Marrow Tap', theme: 'vault', on: 'roof', facing: true, job: 'Holds its target in stasis; sacrifice it again and again for copies of the target\'s bonuses.',
    look: 'a thick spike of bone driven down like a tap, with a spigot at its side from which amber marrow drips slowly into a small bone bowl',
    idle: 'A drop of glowing amber marrow swells at the spigot, falls into the bowl, and another begins; the base breathes slowly.', fire: null },
  { family: 'mitosis', name: 'Mitosis Node', theme: 'vault', on: 'roof', facing: true, job: 'Buds a copy of the limb next to it after every wave.',
    look: 'two identical buds filled with glowing amber marrow, splitting apart from one stalk, joined by a stretching neck of tissue',
    idle: 'The two buds pull slowly apart and ease back together, the neck of tissue between them stretching and relaxing.', fire: null },
  { family: 'reliquary', name: 'Reliquary', theme: 'vault', on: 'roof', facing: true, job: 'Banks its target\'s bonuses if the target dies.',
    look: 'a small casket of bone lattice on a muscular base, with amber marrow glowing through the lattice',
    idle: 'The amber glow inside the casket brightens and dims slowly; the base breathes slowly.', fire: null },
  { family: 'press', name: 'Meat Press', theme: 'vault', on: 'roof', facing: true, job: 'Its target\'s war kills pay science instead.',
    look: 'two heavy plates of bone hinged like a press, one above the other, with glowing amber marrow oozing between them',
    idle: 'The upper plate presses slowly down and lifts again; amber marrow oozes between the plates.', fire: null },
  // ---- Resonance Chamber: combo engines ----
  { family: 'amp', name: 'Resonance Amplifier', theme: 'chamber', on: 'roof', facing: true, job: 'Multiplies every bonus on its target.',
    look: 'a horn of flesh shaped like the bell of a trumpet, with a taut violet membrane like a drum skin stretched across its throat',
    idle: 'The violet membrane vibrates like a drum skin; the horn breathes slowly.', fire: null },
  { family: 'mosaic', name: 'Mosaic Node', theme: 'chamber', on: 'roof', facing: true, job: 'Gives its target one of every kind of bonus nearby.',
    look: 'an upright disc made of many small tiles of differently coloured tissue set in a taut violet membrane, on a muscular stalk',
    idle: 'The small tiles brighten one after another, in a slow ripple across the disc.', fire: null },
  { family: 'twin', name: 'Twinning Gland', theme: 'chamber', on: 'roof', facing: true, job: 'Doubles its target\'s projectiles.',
    look: 'two identical round glands side by side, joined by a taut violet membrane, on one muscular base',
    idle: 'The two glands pulse in perfect time with each other; the violet membrane between them tightens and slackens.', fire: null },
  { family: 'capacitor', name: 'Capacitor Sac', theme: 'chamber', on: 'roof', facing: true, job: 'Banks its target\'s idle shots and spends them at four times the speed.',
    look: 'a taut upright sac of violet membrane banded with rings of dark chitin, crackling faintly with stored charge',
    idle: 'Small sparks crawl over the violet sac; it swells slowly as if filling.', fire: null },
  { family: 'boomerang', name: 'Boomerang Node', theme: 'chamber', on: 'roof', facing: true, job: 'Its target\'s shots fly back to it, piercing everything on the way.',
    look: 'a curved crescent of bone standing on a pedestal wrapped in taut violet membrane',
    idle: 'The bone crescent turns slowly a little to the left and back; the violet membrane pulses.', fire: null },
  // ---- Special ----
  { family: 'lance', name: 'Creep Lance', theme: 'other', on: 'roof', facing: true, drips: true, job: 'Lays a straight strip of creep along its facing.',
    look: 'a long low nozzle like the end of a hose, lying forward along the ground on a muscular base, dribbling dark maroon slime from its tip',
    idle: `${CALM} Dark maroon slime dribbles from the tip of the nozzle.`,
    fire: null },
  { family: 'cage', name: 'Trap Cage', theme: 'other', on: 'roof', job: 'Catches a weakened royal and grafts her.',
    look: 'a cage of tall curved ribs of dark chitin standing open like the jaws of a trap, on a muscular base',
    idle: `${CALM} The ribs open and close a little.`,
    fire: 'The ribs snap shut together like a trap closing, hold, then open slowly back to exactly their starting pose.' },
];

/** Design sheets: one per theme, on that theme's background colour. */
export const LIMB_SHEETS = Object.keys(THEMES).map((t) => ({
  slug: `limbs-${t}`, theme: t, families: LIMBS.filter((l) => l.theme === t).map((l) => l.family),
}));

export const limb = (family) => LIMBS.find((l) => l.family === family);
export const placeOnLimbSheet = (family) => {
  const s = LIMB_SHEETS.find((x) => x.families.includes(family));
  return s ? { sheet: s.slug, index: s.families.indexOf(family), count: s.families.length, theme: s.theme } : null;
};
