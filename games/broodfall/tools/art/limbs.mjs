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
 * (null = it has no attack of its own); an engine or a support limb's `fire` is its ACTING clip
 * (Sep 30 2026), played when what it does happens (its target fires, its shield takes a hit).
 * on: 'roof' (on a block) or 'street'.
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

/**
 * THE VIEW FROM BEHIND (Collins, Sep 29 2026: "I also thought we would be able to get away with
 * just one view of the towers but I am wrong, because towers will need to be rotated to fit
 * certain positions, and as the user with E or Q moves the screen around we would get a
 * 'doom effect'"). A limb faces one of four ways in the WORLD. Two views are drawn: from the
 * front (it faces the lower left) and from behind (it faces the upper right); the other two are
 * those mirrored. A limb that is the same all the way round has no `back`: its front is shown.
 */
export const BACK =
  'Redraw the organism of the reference picture turned exactly half a turn about its upright axis, so that the ' +
  'camera now sees its BACK: what pointed toward the lower left of the picture now points away from the camera, ' +
  'toward the upper right. It is the same organism in every way: the same deep maroon veined flesh, the same ' +
  'plates of dark chitin, the same accent, the same size in the frame, standing on the same low ragged skirt of ' +
  'roots in the same place in the picture. The same view: isometric, from 45 degrees above. Soft even light ' +
  'from directly overhead, no cast shadows, no text.';
/**
 * THE DEATH OF A LIMB (Sep 30 2026): one clip each, from the limb's own picture, that does not
 * loop. It withers where it stands into a husk; the game plays it when the limb dies or is
 * cannibalized, and lets the husk sink and fade. Sent as it is (the usual lock says "the same
 * size the whole time", and this one shrinks), with its own camera lock.
 */
export const WITHER =
  'The organism dies where it stands. Its flesh dries out, darkens and shrivels; its raised parts droop, curl in on ' +
  'themselves and sag down onto the base, its plates of chitin tilt and slump, until the whole of it has collapsed into ' +
  'a small dry grey-brown husk lying low on its skirt of roots. It never recovers. Its roots stay at exactly the same ' +
  'spot the whole time. Camera completely locked: no zoom, no pan, no cuts.';
/** Said to the video model of a limb seen from behind. */
export const AWAY = ' It faces away from the camera, toward the upper right, the whole time: whatever it throws flies away from the camera.';
/**
 * foot: WHERE A LIMB STANDS, marked by eye (Collins, Sep 29 2026: "have something paint the visual
 * center of the bottom of a tower (a vision model) … consider tall towers or oddly shaped ones").
 * [x, y, width] as shares of the box that holds the limb in the first frame of its idle clip:
 * the middle of the skirt it stands on (x from the left of the box, y from its top), and how
 * wide that skirt is without the thin tips of its roots. backFoot: the same, of its view from
 * behind. To mark one: node tools/art/feet.mjs <family>, look at the sheet, read the grid.
 * The middle of a skirt is the middle of its WIDEST row. A limb without a mark fails its bake.
 *
 * muzzle: WHERE ITS SHOT LEAVES IT, marked by eye the same way (Sep 30 2026, Collins: "the shots
 * aligning with coming from where the art would indicate"): [[x, y], ...] in the same box as the
 * foot: the spitter's mouth, the quill fan's spines, the prism's crystal, the frond's tips, the
 * mortar's barrel. Several points for a limb that fires from several places (the game hands them
 * out one shot at a time). Marked on the limb AT REST: the shot is let go as the firing clip
 * begins. backMuzzle: the same, of its view from behind. To mark one: node tools/art/muzzles.mjs
 * <family> [--back], read the grid of tenths; then --bake. A limb that fires without a mark fails
 * its bake (tests/muzzles.test.ts).
 *
 * big: a BIG limb stands on four cells (content/data.ts, span) and is drawn two cells wide: its
 * frames are baked half again as large. tests/iso.test.ts holds the two lists to each other.
 */
/**
 * The limbs whose shot, beam, flame or shell the game draws leaving them: each carries a `muzzle`
 * (and a `backMuzzle` when it has a view from behind). src/render/fxNames.ts FIRES_FROM is the same
 * list; tests/muzzles.test.ts holds the two to each other.
 */
export const FIRING = ['spitter', 'sprout', 'quill', 'impaler', 'burster', 'tangler', 'blighter', 'mister', 'net',
  'frond', 'prism', 'ocular', 'ember', 'skipper', 'bombard', 'lobber', 'sling'];

export const LIMBS = [
  // ---- Meteor Core ----
  { family: 'spitter', foot: [0.51, 0.77, 0.85], backFoot: [0.49, 0.75, 0.87], muzzle: [[0.36, 0.07]], backMuzzle: [[0.63, 0.04]], name: 'Spitter', theme: 'core', on: 'roof', job: 'Cheap, reliable, one target at a time.',
    back: 'Its nozzle points away, up and toward the upper right: we see the back of the stalk and the underside of the nozzle\'s rim, not its opening.',
    look: 'a squat stalk of muscle topped by one puckered fleshy nozzle that points up and forward',
    idle: `${CALM} The nozzle puckers and loosens.`,
    fire: 'The nozzle clenches shut, the whole stalk tightens, and it spits one glob of dark fluid forward and up with a snap, then relaxes back to exactly its starting pose.' },
  { family: 'lasher', foot: [0.54, 0.86, 0.73], name: 'Lasher', theme: 'core', on: 'roof', job: 'Melee sweep: shreds crowds that come close.',
    look: 'a thick muscular stump from which three long whip-like tendrils rise, each tipped with a dark chitin barb',
    idle: `${CALM} The three tendrils sway slowly.`,
    fire: 'The three tendrils lash outward and down in one fast sweep all the way round, then coil back to exactly their starting pose.' },
  { family: 'spine', long: true, foot: [0.61, 0.72, 0.54], name: 'Spine Wall', theme: 'core', on: 'street', job: 'Stands IN the street and must be chewed through; what chews it gets barbs back.',
    look: 'a low barricade as wide as a street lane: a band of muscle along the ground from which a row of tall curved spines of dark chitin grows, like a row of ribs',
    idle: `${CALM} The spines flex very slightly.`,
    fire: 'The row of spines bristles outward sharply, all at once, then settles back to exactly its starting pose.' },
  // ---- Bone Forge ----
  { family: 'impaler', long: true, foot: [0.66, 0.78, 0.52], backFoot: [0.42, 0.74, 0.67], muzzle: [[0.28, 0.3]], backMuzzle: [[0.78, 0.15]], name: 'Impaler', theme: 'forge', on: 'roof', job: 'A long harpoon that skewers a whole file and ignores shields.',
    back: 'The harpoon points away toward the upper right, its tip far from the camera and its butt end nearest us; we see the back of the mound that cradles it.',
    look: 'a squat mound of muscle cradling one long ivory bone harpoon, drawn back under tension like the bolt of a ballista, pointing forward and slightly up',
    idle: `${CALM} The harpoon trembles under tension.`,
    fire: 'The muscle snaps and the long bone harpoon shoots forward out of the frame; a new harpoon slides up out of the mound into the same place, back to exactly the starting pose.' },
  { family: 'quill', foot: [0.41, 0.76, 0.64], backFoot: [0.55, 0.77, 0.74], muzzle: [[0.29, 0.2], [0.53, 0.17], [0.74, 0.24], [0.82, 0.41]], backMuzzle: [[0.21, 0.23], [0.43, 0.16], [0.61, 0.2], [0.77, 0.32]], name: 'Quill Fan', theme: 'forge', on: 'roof', job: 'The shotgun: five pellets across a cone, brutal up close.',
    back: 'The fan of quills leans away from the camera toward the upper right; we see the back of the fan and the back of the mound.',
    look: 'a fan of a dozen long ivory quills spread like the tail of a peacock, rising from a muscular base',
    idle: `${CALM} The fan of quills opens and closes a little.`,
    fire: 'The fan snaps forward and a volley of quills shoots out of it; new quills slide up into the gaps, back to exactly the starting pose.' },
  { family: 'skipper', long: true, foot: [0.48, 0.63, 0.73], backFoot: [0.49, 0.64, 0.8], muzzle: [[0.13, 0.27]], backMuzzle: [[0.82, 0.08]], name: 'Skipping Mortar', theme: 'forge', on: 'roof', facing: true, job: 'Fires one way only, very far; the shell skips on down the line.',
    back: 'The mortar tube points away toward the upper right: we see its closed rear end nearest us, and its mouth is hidden at the far end.',
    look: 'a short fat mortar tube of ivory bone lying at a low angle on a muscular cradle, its mouth pointing forward',
    idle: `${CALM} The mouth of the tube flexes.`,
    fire: 'The cradle tightens and the bone tube coughs out one round shell with a puff of dust and a jolt of recoil, then settles back to exactly its starting pose.' },
  { family: 'bombard', foot: [0.49, 0.65, 0.81], muzzle: [[0.49, 0.02]], name: 'Spore Bombard', theme: 'forge', on: 'roof', job: 'Artillery the player aims at a marked spot.',
    look: 'a tall chimney of overlapping ivory bone plates on a swollen muscular base, pointing at the sky',
    idle: `${CALM} A thin wisp of spores drifts from the top of the chimney.`,
    fire: 'The base swells, then the chimney thumps a shell straight up and out of the frame with a burst of golden spores and a heavy recoil, then settles back to exactly its starting pose.' },
  // ---- Venom Sac ----
  { family: 'blighter', foot: [0.5, 0.75, 0.87], muzzle: [[0.47, 0.1]], name: 'Blight Vent', theme: 'venom', on: 'roof', job: 'Poison clouds that keep eating; poison ignores armour.',
    look: 'a chimney of flesh ringed with swollen acid yellow-green glands, a thin sickly haze drifting from its mouth',
    idle: `${CALM} The glands pulse one after another.`,
    quiet: true,
    fire: 'The glands squeeze hard one after another from the bottom up and the mouth of the chimney gapes wide and shudders, then the glands refill, back to exactly the starting pose.' },
  { family: 'mister', big: true, foot: [0.53, 0.74, 0.82], muzzle: [[0.34, 0.04], [0.6, 0.03], [0.2, 0.12], [0.77, 0.1]], name: 'Caustic Mister', theme: 'venom', on: 'roof', job: 'A mist that strips armour for every other limb.',
    look: 'a cluster of six thin nozzles on stalks around one acid yellow-green gland sac, like a garden sprinkler',
    idle: `${CALM} The thin nozzles sway.`,
    quiet: true,
    fire: 'All six nozzles stiffen, point outward and shudder together as the gland sac squeezes flat, then the sac refills and the nozzles droop back to exactly the starting pose.' },
  { family: 'ember', foot: [0.5, 0.73, 0.68], backFoot: [0.51, 0.74, 0.77], muzzle: [[0.4, 0.05]], backMuzzle: [[0.57, 0.05]], name: 'Ember Sac', theme: 'venom', on: 'roof', job: 'A flamethrower: everything in its cone catches fire.',
    back: 'Its scorched nozzle points away toward the upper right and is mostly hidden behind the sac; we see the back of the glowing sac.',
    look: 'a bloated sac that glows orange from within, ringed with acid yellow-green glands, with one short scorched black nozzle',
    idle: `${CALM} The orange glow inside the sac brightens and dims.`,
    quiet: true,
    fire: 'The sac squeezes and its orange glow surges bright while the nozzle gapes and shudders, then the glow dims, back to exactly the starting pose.' },
  // ---- Gut ----
  // THE TONGUE MAW (Sep 30 2026, Collins: "the frog like tongue design, that's brilliant"). The old one, a
  // huge toothed funnel pointing up, could not be seen to eat anything below and beside it ("no idea how
  // you are going to animate the big mouth thing attacking"). This one crouches like a toad at the roof's
  // edge; its tongue is drawn by the game (src/render/mawTongue.ts), shot from its mouth (`muzzle`) to the
  // victim in the street, which sticks to it and is reeled up into the mouth. Its clips are only its body:
  // the mouth gaping, snapping shut, the gulp. Its raw pictures and clips are drawn into their own folder,
  // art-src/limbs/maw-tongue/ (`srcDir`): art-src/limbs/maw/ keeps the old funnel's, untouched. Its design is
  // drawn alone (not cut from the Gut's sheet, which holds the funnel): templates/limb.mjs makeOwnDesign.
  // Fix pass (Sep 30 2026): its gulp was a see-through bubble and, from behind, its mouth opened on the right
  // side of its body. The firing clip and the whole view from behind are drawn again into
  // art-src/limbs/maw-tongue-2/ (`srcDir`); its design, redraw, idle and death are copies of maw-tongue/'s,
  // which is left untouched. `backFire`: its firing clip from behind (the mouth gapes on the far side).
  { family: 'maw', srcDir: 'maw-tongue-2', tongue: true, big: true, foot: [0.5, 0.77, 0.8], backFoot: [0.51, 0.75, 0.76], muzzle: [[0.37, 0.5]], backMuzzle: [[0.5, 0.02]], name: 'Maw', theme: 'gut', on: 'roof', job: 'Snatches weakened enemies from the street with its tongue and eats them whole; pays richer meat.',
    back: 'Its head and its wide mouth face straight away from the camera, toward the top of the picture, so that the mouth is completely hidden on the far side of its body: we see only its broad rounded humped rump and back armoured with plates of dark chitin, the two knobs on top of its head just showing over the top of the hump, and NO lips, NO mouth, NO teeth anywhere on the sides or the front of it.',
    backIdle: `${CALM} Seen from behind: it breathes slowly, its broad humped back rising and falling gently and the plates of chitin on it shifting a little. Its mouth, its lips and its throat face away from the camera and are never seen: nothing on its back opens, no mouth, no tongue, nothing comes out of it.`,
    backFire: 'Seen from behind. On the FAR side of its body, hidden from the camera, its mouth gapes open: its head tips back and up a little so that only the rim of its upper jaw with a few small teeth rises into view just above the top of its humped back, holds, then drops shut; its back heaves once as it gulps and its body swells slightly, then everything settles back to exactly its starting pose. The inside of its mouth, its lips and its throat are never seen: they face away from the camera the whole time. No bubble, no tongue and nothing else ever leaves its body.',
    look: 'a huge squat toad-like mound of muscle crouched low and wide, its head the whole front of its body: a very wide mouth across the front with thick fleshy lips pressed shut in a long curved line, small teeth showing at the corners, a big swollen throat sac of paler crimson hanging under the mouth, two blunt knobs on top of its head, its broad humped back armoured with plates of dark chitin',
    idle: `${CALM} Its throat sac slowly swells and shrinks as it breathes, and its lips twitch.`,
    fire: 'Its wide mouth gapes open fast and very wide, showing the dark wine-red gullet ringed with rows of small teeth, and holds open; then it snaps shut and gulps: the thick fleshy throat under its mouth bulges out into a swollen pouch of the same opaque deep-crimson veined skin as the rest of its body, solid thick-walled muscle, not transparent and not glassy, never a bubble, and the bulge travels back into its body, which swells a little, then everything settles back to exactly its starting pose. No tongue, no bubble and nothing else ever leaves the mouth.' },
  { family: 'swamp', name: 'Digestive Swamp', theme: 'gut', on: 'street', flat: true, job: 'Lies IN the street: slows and dissolves everything that wades through it.',
    look: 'a shallow pool of dark wine-red digestive acid as wide as a street lane, with a low fleshy rim set with small teeth, lying flat on the ground',
    idle: 'The pool bubbles slowly; small ripples cross it; the fleshy rim twitches.',
    fire: null },
  { family: 'burster', foot: [0.52, 0.78, 0.8], muzzle: [[0.52, 0.29], [0.3, 0.18], [0.54, 0.14]], name: 'Burster', theme: 'gut', on: 'roof', job: 'Lobs sacs that burst in an area.',
    look: 'a cluster of taut round dark-red sacs on a thick stalk, like a bunch of grapes, each sac with a ring of tiny teeth at its stem',
    idle: `${CALM} The sacs swell and shrink one after another.`,
    fire: 'One sac tears free and is flung forward and up out of the frame; a new sac swells in its place, back to exactly the starting pose.' },
  { family: 'lobber', foot: [0.5, 0.77, 0.75], backFoot: [0.51, 0.76, 0.75], muzzle: [[0.38, 0.13]], backMuzzle: [[0.64, 0.05]], name: 'Bile Lobber', theme: 'gut', on: 'roof', job: 'A volley the player aims by hand.',
    back: 'The arm leans away toward the upper right with the cupped sling at its end; we see the back of the arm and the back of the sling.',
    look: 'a muscular arm rising from a toothed dark-red base and ending in a cupped sling that holds one glob of yellow bile',
    idle: `${CALM} The arm sways; the glob of bile wobbles in the sling.`,
    fire: 'The arm whips forward and flings the glob of bile out of the frame, then swings back and a new glob wells up in the sling, back to exactly the starting pose.' },
  // ---- Nerve Cluster ----
  { family: 'frond', big: true, foot: [0.52, 0.86, 0.76], muzzle: [[0.2, 0.08], [0.41, 0.04], [0.6, 0.06], [0.8, 0.15]], name: 'Galvanic Frond', theme: 'nerve', on: 'roof', job: 'One strike arcs on to three more bodies.',
    look: 'a fern-like frond of pale blue-white nerve cords, with faint sparks at its tips',
    idle: `${CALM} Faint sparks crawl along the frond.`,
    quiet: true,
    fire: 'The frond snaps rigid and its tips flare bright blue-white for a moment while the whole stalk shudders, then it relaxes back to exactly its starting pose.' },
  { family: 'prism', foot: [0.5, 0.84, 0.77], muzzle: [[0.5, 0.19]], name: 'Arc Prism', theme: 'nerve', on: 'roof', job: 'A beam that ramps on a held target; idle prisms relay to the one that is firing.',
    look: 'a faceted lens of clear cartilage held in a claw of pale blue-white nerve cords, glowing softly',
    idle: `${CALM} Light moves slowly inside the lens.`,
    quiet: true,
    fire: 'The claw of nerve cords clenches on the lens and the lens blazes bright blue-white from within for a moment, then dims, the claw loosening back to exactly its starting pose.' },
  { family: 'ocular', foot: [0.53, 0.83, 0.73], backFoot: [0.53, 0.75, 0.76], muzzle: [[0.42, 0.08]], backMuzzle: [[0.51, 0.09]], name: 'Ocular Stalk', theme: 'nerve', on: 'roof', job: 'A board-wide eye that executes support castes and sees the cloaked.',
    back: 'The eye looks away toward the upper right: we see the back of the eyeball, wrapped in nerve cords, and none of its iris.',
    look: 'one large wet eye with a pale blue iris on top of a tall slender stalk wrapped in pale blue-white nerve cords',
    idle: `${CALM} The eye looks slowly left and right, and blinks once.`,
    quiet: true,
    fire: 'The eye snaps wide open, its pupil narrows to a point and the stalk goes rigid, staring hard for a moment, then the eye relaxes back to exactly its starting pose.' },
  { family: 'net', foot: [0.55, 0.73, 0.79], muzzle: [[0.5, 0.25]], name: 'Netcaster', theme: 'nerve', on: 'roof', job: 'Hits only fliers: drags them to the ground.',
    look: 'a splayed hand of five thin tendons wrapped in pale blue-white nerve cords, a folded white web held between the fingers, pointing at the sky',
    idle: `${CALM} The fingers open and close a little.`,
    fire: 'The hand throws the white web upward out of the frame with a flick, then a new web unfolds between the fingers, back to exactly the starting pose.' },
  // ---- Mucus Lattice ----
  { family: 'tangler', big: true, foot: [0.5, 0.64, 0.84], muzzle: [[0.5, 0.35]], name: 'Snare Bed', theme: 'lattice', on: 'roof', job: 'Its hits slow what they touch.',
    look: 'a low fleshy hub from which glassy milky-white strands of mucus stretch out like the spokes of a web',
    idle: `${CALM} The mucus strands quiver.`,
    fire: 'The hub squeezes and spits a rope of white mucus forward out of the frame, then settles back to exactly its starting pose.' },
  { family: 'ward', foot: [0.5, 0.74, 0.9], name: 'Ward Membrane', theme: 'lattice', on: 'roof', job: 'Shields every other limb near it.',
    look: 'a dome of glassy milky-white membrane stretched over thin ribs of chitin, like a soap bubble half sunk in flesh',
    idle: `${CALM} A shimmer of light crosses the dome.`,
    quiet: true, fire: 'The dome of membrane flexes outward and a bright ripple runs over it from the top down, then it settles back to exactly its starting pose.' },
  { family: 'choir', foot: [0.5, 0.72, 0.82], name: 'Choir Node', theme: 'lattice', on: 'roof', job: 'The limbs around it fire faster.',
    look: 'a ring of seven slender glassy milky-white pipes of different heights, like organ pipes, round a fleshy hub',
    idle: 'The pipes vibrate one after another, as if each were sounding a note; the hub breathes slowly.',
    quiet: true, fire: 'All seven pipes shudder hard together and the hub pumps once strongly, then they settle back to exactly the starting pose.' },
  // ---- Brood Womb ----
  { family: 'brood', big: true, foot: [0.49, 0.73, 0.74], backFoot: [0.48, 0.66, 0.81], name: 'Broodmother', theme: 'womb', on: 'roof', job: 'Keeps three broodlings fighting in the street below.',
    back: 'The puckered slit is on the far side and hidden; we see the back of the swollen sac, studded with eggs.',
    look: 'a swollen sac studded with clusters of glossy pink eggs, with a puckered slit at the front',
    idle: `${CALM} Something moves inside the sac; the eggs glisten.`,
    fire: 'The slit opens and one small pink broodling squeezes out and drops forward out of the frame, then the slit closes, back to exactly the starting pose.' },
  // The BROOD PIT (Oct 1 2026, Collins: "one spawning fighters from your base"): drawn alone (srcDir), a low wide
  // burrow, so it never reads as the Den's swollen sac. Its warriors are born at the body; the pit calls them.
  { family: 'hatch', srcDir: 'hatch', foot: [0.5, 0.72, 0.8], name: 'Brood Pit', theme: 'womb', on: 'roof', job: 'Calls warriors up from the body and sends them to its rally point.',
    look: 'a low wide round burrow sunk into the mound: a big round puckered opening ringed with short curved chitin teeth, leading straight down into darkness, with small clusters of glossy pink eggs packed round its rim and a few thick pale veins running from the rim down into the hole',
    idle: `${CALM} The rim of the burrow slowly contracts and relaxes; deep in the dark of the hole something shifts.`,
    fire: 'The rim of the burrow contracts hard all at once and a deep ripple runs down into the hole, as if it were calling something up from far below, then everything settles back to exactly the starting pose.' },
  { family: 'sling', foot: [0.47, 0.76, 0.7], backFoot: [0.5, 0.79, 0.77], muzzle: [[0.34, 0.34]], backMuzzle: [[0.65, 0.33]], name: 'Spore Sling', theme: 'womb', on: 'roof', job: 'The player throws creep with it to far ground.',
    back: 'The arm is cocked back TOWARD the camera, its basket with the clot low and nearest us; it will throw away from us, toward the upper right.',
    look: 'a tendon catapult: one long arm cocked back under tension, with a dark red clot in the basket at its end, on a base studded with pink eggs',
    idle: `${CALM} The cocked arm trembles.`,
    fire: 'The arm snaps forward and flings the dark red clot up and out of the frame, then winches slowly back and a new clot wells up in the basket, back to exactly the starting pose.' },
  { family: 'lure', foot: [0.5, 0.87, 0.86], name: 'Lure Gland', theme: 'womb', on: 'roof', job: 'Draws the science caste; pulses a toxic pheromone cloud.',
    look: 'a tall slender stalk topped with a softly glowing bulb, its base ringed with glossy pink eggs, a faint haze drifting from the bulb',
    idle: `${CALM} The bulb glows brighter and dimmer; the stalk sways.`,
    quiet: true,
    fire: 'The bulb swells to twice its size and glows brightly, then shrinks back to exactly its starting pose.' },
  // ---- Marrow Vault: combo engines ----
  { family: 'conduit', foot: [0.45, 0.85, 0.66], backFoot: [0.51, 0.73, 0.86], name: 'Marrow Conduit', theme: 'vault', on: 'roof', facing: true, job: 'Copies the bonuses of the limbs around it into the one it points at.',
    back: 'The pipe points away toward the upper right: its open mouth is at the far end and hidden; we see its closed rear end nearest us, and the glowing marrow along its split top.',
    look: 'a thick pipe of bone split open along its top to show glowing amber marrow, with one wide open mouth at its front end, on a muscular base',
    idle: 'Glowing amber marrow flows slowly along the pipe toward its mouth; the base breathes slowly.', fire: 'A bright pulse of glowing amber marrow surges along the split pipe and gushes up to its open mouth, the mouth flaring wide, then the flow calms back to exactly the starting pose.' },
  { family: 'tap', foot: [0.49, 0.89, 0.79], backFoot: [0.51, 0.78, 0.77], name: 'Marrow Tap', theme: 'vault', on: 'roof', facing: true, job: 'Holds its target in stasis; sacrifice it again and again for copies of the target\'s bonuses.',
    back: 'The spigot and its bowl are on the far side, toward the upper right, half hidden behind the spike; we see the back of the spike.',
    look: 'a thick spike of bone driven down like a tap, with a spigot at its side from which amber marrow drips slowly into a small bone bowl',
    idle: 'A drop of glowing amber marrow swells at the spigot, falls into the bowl, and another begins; the base breathes slowly.', fire: 'The bone spike shudders and drives a little deeper, and a thick gush of glowing amber marrow pours from the spigot into the bowl, then the flow slows back to a drip, back to exactly the starting pose.' },
  { family: 'mitosis', foot: [0.52, 0.77, 0.71], name: 'Mitosis Node', theme: 'vault', on: 'roof', facing: true, job: 'Buds a copy of the limb next to it after every wave.',
    look: 'two identical buds filled with glowing amber marrow, splitting apart from one stalk, joined by a stretching neck of tissue',
    idle: 'The two buds pull slowly apart and ease back together, the neck of tissue between them stretching and relaxing.', fire: 'The two buds swell and glow brighter and tug hard apart, the neck of tissue between them stretching thin, then they ease back together to exactly the starting pose.' },
  { family: 'reliquary', foot: [0.49, 0.73, 0.82], name: 'Reliquary', theme: 'vault', on: 'roof', facing: true, job: 'Banks its target\'s bonuses if the target dies.',
    look: 'a small casket of bone lattice on a muscular base, with amber marrow glowing through the lattice',
    idle: 'The amber glow inside the casket brightens and dims slowly; the base breathes slowly.', fire: 'The bone lattice of the casket flexes open a little and the amber glow inside it swells brighter, then the lattice closes and the glow settles back to exactly the starting pose.' },
  { family: 'press', foot: [0.51, 0.76, 0.79], backFoot: [0.51, 0.63, 0.79], name: 'Meat Press', theme: 'vault', on: 'roof', facing: true, job: 'Its target\'s war kills pay science instead.',
    back: 'We see the back of the press: its hinge is nearest us, and its open jaws face away toward the upper right.',
    look: 'two heavy plates of bone hinged like a press, one above the other, with glowing amber marrow oozing between them',
    idle: 'The upper plate presses slowly down and lifts again; amber marrow oozes between the plates.', fire: 'The upper plate slams down hard onto the lower one, squeezing a gush of glowing amber marrow out between them, then lifts slowly back to exactly the starting pose.' },
  // ---- Resonance Chamber: combo engines ----
  { family: 'amp', foot: [0.5, 0.86, 0.83], backFoot: [0.5, 0.84, 0.84], name: 'Resonance Amplifier', theme: 'chamber', on: 'roof', facing: true, job: 'Multiplies every bonus on its target.',
    back: 'The bell of the horn opens away from the camera, toward the upper right: we see the outside of the horn narrowing toward us, and none of its membrane.',
    look: 'a horn of flesh shaped like the bell of a trumpet, with a taut violet membrane like a drum skin stretched across its throat',
    idle: 'The violet membrane vibrates like a drum skin; the horn breathes slowly.', quiet: true, fire: 'The violet membrane across the throat of the horn thumps hard in and out like a struck drum and the bell of the horn flares open a little, then settles back to exactly its starting pose.' },
  { family: 'mosaic', foot: [0.52, 0.85, 0.62], name: 'Mosaic Node', theme: 'chamber', on: 'roof', facing: true, job: 'Gives its target one of every kind of bonus nearby.',
    look: 'an upright disc made of many small tiles of differently coloured tissue set in a taut violet membrane, on a muscular stalk',
    idle: 'The small tiles brighten one after another, in a slow ripple across the disc.', quiet: true, fire: 'All the small tiles brighten together in a fast ripple from the middle of the disc outward and the disc flexes, then they dim back to exactly the starting pose.' },
  { family: 'twin', foot: [0.49, 0.71, 0.72], name: 'Twinning Gland', theme: 'chamber', on: 'roof', facing: true, job: 'Doubles its target\'s projectiles.',
    look: 'two identical round glands side by side, joined by a taut violet membrane, on one muscular base',
    idle: 'The two glands pulse in perfect time with each other; the violet membrane between them tightens and slackens.', fire: 'The two glands squeeze hard in perfect unison, twice, the violet membrane between them snapping taut, then relax back to exactly the starting pose.' },
  { family: 'capacitor', foot: [0.51, 0.81, 0.58], name: 'Capacitor Sac', theme: 'chamber', on: 'roof', facing: true, job: 'Banks its target\'s idle shots and spends them at four times the speed.',
    look: 'a taut upright sac of violet membrane banded with rings of dark chitin, crackling faintly with stored charge',
    idle: 'Small sparks crawl over the violet sac; it swells slowly as if filling.', quiet: true, fire: 'The violet sac swells tight and its rings of dark chitin strain, then it squeezes sharply smaller as if discharging, and slowly refills back to exactly the starting pose.' },
  { family: 'boomerang', foot: [0.52, 0.78, 0.65], name: 'Boomerang Node', theme: 'chamber', on: 'roof', facing: true, job: 'Its target\'s shots fly back to it, piercing everything on the way.',
    look: 'a curved crescent of bone standing on a pedestal wrapped in taut violet membrane',
    idle: 'The bone crescent turns slowly a little to the left and back; the violet membrane pulses.', fire: 'The bone crescent swings quickly a quarter turn to one side and back to exactly its starting pose, the violet membrane of the pedestal rippling.' },
  // ---- The Seeding Gland's free limb (Collins, Sep 29 2026: 'a free low power tower … it shoots out') ----
  { family: 'sprout', foot: [0.5, 0.7, 0.67], muzzle: [[0.31, 0.09]], name: 'Seedling', theme: 'core', on: 'roof', job: 'Free, from a Seeding Gland: a weak little shooter, shot up from below.',
    look: 'a small young sprout of the creature, half the size of the others: a short soft stalk of pale young muscle with one small puckered nozzle, two tiny leaf-like flaps of chitin, and a few thin new roots',
    idle: 'The little stalk sways gently from side to side like a young plant in a breeze; the nozzle opens and closes; the two small flaps twitch.',
    fire: 'The little stalk tightens and spits one small glob forward with a snap, then relaxes back to exactly its starting pose.' },
  // ---- Special ----
  { family: 'lance', long: true, foot: [0.6, 0.53, 0.76], backFoot: [0.47, 0.73, 0.87], name: 'Creep Lance', theme: 'other', on: 'roof', facing: true, drips: true, job: 'Lays a straight strip of creep along its facing.',
    back: 'The nozzle lies along the ground pointing away toward the upper right, its tip far from the camera; we see the back of the mound it grows from.',
    look: 'a long low nozzle like the end of a hose, lying forward along the ground on a muscular base, dribbling dark maroon slime from its tip',
    idle: `${CALM} Dark maroon slime dribbles from the tip of the nozzle.`,
    fire: 'The base squeezes, the nozzle bucks and a thick gush of dark maroon slime spurts from its tip along the ground, then it settles back to exactly the starting pose, dribbling.' },
  { family: 'cage', big: true, foot: [0.49, 0.78, 0.78], name: 'Trap Cage', theme: 'other', on: 'roof', job: 'Catches a weakened royal and grafts her.',
    look: 'a cage of tall curved ribs of dark chitin standing open like the jaws of a trap, on a muscular base',
    idle: `${CALM} The ribs open and close a little.`,
    fire: 'The ribs snap shut together like a trap closing, hold, then open slowly back to exactly their starting pose.' },
];

/**
 * DRAWN FOR THEIR GROUND (Oct 2 2026; Collins, of the class-zero footprints, notes/FOOTPRINT-PLAN.md: "ok this is
 * WAY better, redesign the art around this"). These limbs are redrawn over a ground plate of their footprint
 * (tools/art/templates/limb-shaped.mjs, tools/art/lib/plate.mjs): `plate` is the shape they stand on, `shapedLook`
 * what is drawn over it, `srcDir` the NEW raw folder (the old drawing's files stay in art-src/limbs/<family>/, and the
 * old baked art in public/art/limbs-legacy/). Where each stands is the plate's (feet.json), not a mark by eye; where
 * it fires from is still marked by eye per view (muzzle, backMuzzle, sideMuzzle, backSideMuzzle).
 * The look-alike fixes of the limb decision sheet are here too: the Vent a chimney, the Ember a nozzle on a sac, the
 * Lure a squat pitcher bloom, the Ocular a tall hooded periscope, the Press a screw press, the Conduit a bent pipe,
 * the Reliquary a sealed casket, the Lobber a sac on a sling arm.
 */
const GROUND = {
  impaler: { plate: 'line3', big: true, shapedBack: 'We see it from BEHIND: the butt end of the harpoon is nearest us at the lower left; its barbed point is at the far upper-right end, pointing away from the camera', shapedLook: 'a long harpoon rail lying along all three tiles: a low muscular cradle the length of the row holding one long ivory bone harpoon drawn back under tension like the bolt of a ballista, its barbed point at the front end of the row, raised a little' },
  lance: { plate: 'line3', big: true, shapedBack: 'We see it from BEHIND: its thick rounded CLOSED back end, with no opening, is the end nearest us at the lower left; the hose narrows away from us toward the upper right, where its nozzle points away from the camera and is hidden', shapedLook: 'a long low hose of muscle lying along all three tiles, thick at the back end and narrowing to an open nozzle at the front end of the row, dribbling dark maroon slime onto the ground' },
  ember: { plate: 'line3', big: true, shapedBack: 'We see it from BEHIND: the rounded CLOSED back end of the fuel sac, with no nozzle, is the end nearest us at the lower left; the nozzle is at the far upper-right end, pointing away from the camera and hidden behind the sac', accent: 'a bloated fuel sac glowing orange from within, with a few small acid yellow-green glands', shapedLook: 'a long low fuel sac lying along all three tiles, glowing orange from within, ending at the front end of the row in one short scorched black nozzle with a small blue pilot flame at its tip; no chimney, nothing tall' },
  amp: { plate: 'line3', big: true, shapedBack: 'We see it from BEHIND: its narrow CLOSED back end is nearest us at the lower left; the horn widens away from us toward the upper right, where its bell opens away from the camera and we cannot see into it', shapedLook: 'a long ribbed resonant horn of flesh lying along all three tiles, ribbed all along its length like a bellows, with taut violet membranes stretched across the gaps between its ribs, its bell opening at the front end of the row' },
  frond: { plate: 'T', big: true, shapedLook: 'three fern-like fronds of pale blue-white nerve cords, one rising from each end of the bar of the T and one from the end of its stem, joined by thick roots along the T, and a coiled knot of glowing nerve cords on the key tile' },
  choir: { plate: 'T', big: true, shapedLook: 'organ pipes on a T-shaped manifold of flesh: three banks of slender glassy milky-white pipes of different heights, one bank along each arm of the bar and one along the stem, and a fleshy pumping bellows on the key tile' },
  blighter: { plate: 'T', big: true, accent: 'a sickly yellow-green haze and green-stained cracked vents, and NO glands', shapedLook: 'a tall fumarole chimney of flesh rising from the key tile, with three cracked vent pipes lying along the bar and the stem of the T, a thin sickly yellow-green haze seeping from the cracks and from the chimney mouth' },
  quill: { plate: 'L3', big: true, shapedLook: 'a bent muscular body lying along all three tiles of the elbow, hugging it, with long ivory quills fanned out along both of its arms, the fan widest and tallest at the bend' },
  conduit: { plate: 'L3', big: true, accent: 'amber marrow that glows through split bone, and no slits or glowing grilles', shapedLook: 'a thick bent pipe of bone lying along all three tiles of the elbow, split open along its top to show glowing amber marrow flowing in it, a swollen round gather-bulb at the bend, and one wide open mouth at the end of the arm that runs from the bend toward the front' },
  tangler: { plate: 'L4', big: true, shapedLook: 'a long low bed of web lying flat along all four tiles of the L, bent round its corner: a mat of fleshy pads crossed and covered by glassy milky-white strands of mucus, strands drooping over its outer edges' },
  press: { plate: 'L4', big: true, accent: 'amber marrow that glows through split bone, and no slits or glowing grilles', shapedLook: 'a heavy screw press of bone standing on the corner tile of the L, two thick bone plates on a twisted bone screw, with a long feed trough of bone lying along the long arm of the L, glowing amber marrow oozing along the trough into the press' },
  bombard: { plate: 'sq2', big: true, shapedLook: 'a squat heavy siege mortar filling all four tiles: a short, very wide barrel of overlapping ivory bone plates on a swollen muscular base, the barrel tilted up toward the sky, a few golden spores in its mouth' },
  lure: { plate: 'one', shapedLook: 'a SQUAT pitcher bloom: a fat open fleshy pitcher flower low on the ground, wider than it is tall, its lip curled outward, leaking a visible pink-green haze, glossy pink eggs round its base; nothing tall, no stalk and no ball' },
  ocular: { plate: 'one', shapedLook: 'a TALL periscope eyestalk: a long slender neck of nerve cords rising straight up, bent forward at the top, with one large wet eye with a pale blue iris inside a hood of bone like a periscope head' },
  reliquary: { plate: 'one', accent: 'amber marrow seen through a small window of bone, and no slits or glowing grilles', shapedLook: 'a sealed bone casket: a closed rounded box of fused bone plates on a muscular base, with a small oval window of clear amber in its lid through which a jar of glowing marrow shows; no religious symbol of any kind' },
  lobber: { plate: 'one', shapedLook: 'a swollen bile sac on the ground with a long jointed sling arm rising from it and curving forward, a cupped sling at the end holding one glob of yellow bile; it looks nothing like a mouth on a stalk' },
};
for (const [family, o] of Object.entries(GROUND)) {
  const l = LIMBS.find((x) => x.family === family);
  // Drawn anew: its old marks and its old raw folder belong to the old drawing.
  for (const k of ['foot', 'backFoot', 'muzzle', 'backMuzzle', 'long', 'srcDir']) delete l[k];
  Object.assign(l, { srcDir: `${family}-ground`, big: !!o.big, ...o });
}

/**
 * THE WORKING PART of each limb, named in the words of its upgrade looks (tools/art/templates/limb-looks.mjs):
 * what a SWARM look multiplies, a REACH look stretches, a BONE look clads.
 */
const PARTS = {
  spitter: 'its stalk and nozzle', lasher: 'its whip-like tendrils', spine: 'its row of chitin spines', impaler: 'its harpoon rail',
  quill: 'its fans of quills', skipper: 'its mortar tube', bombard: 'its mortar barrel', blighter: 'its chimney and vent pipes',
  mister: 'its nozzles', ember: 'its fuel sac and nozzle', maw: 'its mouth and head', swamp: 'its pool', burster: 'its cluster of sacs',
  lobber: 'its sling arm', frond: 'its fronds', prism: 'its lens and claw', ocular: 'its eyestalk', net: 'its hand of tendons',
  tangler: 'its web bed', ward: 'its dome', choir: 'its banks of pipes', brood: 'its egg sac', hatch: 'its burrow mouth',
  sling: 'its catapult arm', lure: 'its pitcher bloom', conduit: 'its bent marrow pipe', tap: 'its spike of bone', mitosis: 'its two buds',
  reliquary: 'its casket', press: 'its screw press', amp: 'its ribbed horn', mosaic: 'its tiled disc', twin: 'its two glands',
  capacitor: 'its banded sac', boomerang: 'its crescent of bone', sprout: 'its little stalk', lance: 'its hose and nozzle', cage: 'its cage of ribs',
};
for (const l of LIMBS) if (PARTS[l.family]) l.part = PARTS[l.family];

/** Design sheets: one per theme, on that theme's background colour. */
export const LIMB_SHEETS = Object.keys(THEMES).map((t) => ({
  slug: `limbs-${t}`, theme: t, families: LIMBS.filter((l) => l.theme === t).map((l) => l.family),
}));

export const limb = (family) => LIMBS.find((l) => l.family === family);
/**
 * The folder under art-src/limbs/ that holds a limb's raw pictures and clips: its family, or its own
 * `srcDir` when it was redrawn from scratch and the old drawing's files are kept where they were.
 */
export const rawDirOf = (l) => l.srcDir ?? l.family;
export const placeOnLimbSheet = (family) => {
  const s = LIMB_SHEETS.find((x) => x.families.includes(family));
  return s ? { sheet: s.slug, index: s.families.indexOf(family), count: s.families.length, theme: s.theme } : null;
};
