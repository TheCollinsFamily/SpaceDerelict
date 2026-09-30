/**
 * THE PROMO PICTURES (Sep 30 2026): key art, cover plates, posters, for the store pages.
 * No lettering in any picture: the title, taglines and credits are set in TYPE by
 * tools/promo/compose.mjs. It SPENDS RFab tokens (about $0.40-$1.20 a picture at high quality).
 *
 *   node tools/promo/gen.mjs                 whatever is missing
 *   node tools/promo/gen.mjs orbit siege     some of them
 *
 * Raw stills go to art-src/promo/<id>.png (git-ignored). To draw one again, move its file away
 * (or add a new id with a -v2 suffix and point compose.mjs at it).
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool, balance, spent } from '../art/rfab.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SRC = path.join(ROOT, 'art-src');
const DIR = path.join(SRC, 'promo');
const C = path.join(ROOT, 'notes', 'concepts', '2026-09-29');

const NOTHING =
  'No text anywhere: no letters, no words, no numbers, no signs with writing, no logos, no watermark, no signature. ' +
  'No crosses, no stars, no crescents, no churches, no steeples, no religious symbol of any kind.';
const PEOPLE =
  'insect people like those of a 1950s science-fiction film: human posture and body language, an insect head with ' +
  'large round eyes, small mandibles and antennae, dark umber chitin instead of skin, dressed in 1950s clothes ' +
  '(hats, suits, cardigans, print dresses)';
const POSTER =
  'Painted like the art of a 1950s science-fiction film poster: bold gouache brushwork, strong simple shapes, ' +
  'saturated reds and oranges against deep night blues, dramatic lighting.';
const METEOR =
  'a burning living meteor: a round seed-pod of glistening dark red flesh with pale bone spikes, split open along ' +
  'one side with a hot orange glow inside, trailing fire and loose red tendrils';
const LIMBS =
  'grown living turrets made of wet dark-red veined flesh rooted into the rooftops like trees: a tall stalk that ' +
  'spits glowing green acid, a fleshy frond crackling with blue-white lightning, a spiked bulb lobbing burning ' +
  'spore bombs, a tall stalk with a single huge eye';
const SOLDIERS =
  'a column of insect soldiers of an insect army: 21st-century armour in the style of Eastern Orthodox dress, ' +
  'long dark robes over plate armour, tall rounded helmets with plain gold hexagon badges, holding short rifles ' +
  'and glowing power blades, with an armoured beetle-shaped tank';
const CITY =
  'the insects\' own city: tall buildings of pale wasp paper, wax and honeycomb cells, round cell doorways, ' +
  'roofs swelling into onion domes of layered paper like hanging nests, a few gilded, with satellite dishes, ' +
  'solar panels, cables and street lamps bolted on';
const CREEP = 'dark maroon matte veined living creep, like wet flesh, running over roofs, walls and pavement';

const title = path.join(SRC, 'screens', 'title.png');
const exterior = path.join(SRC, 'ship', 'exterior.png');
const planet = path.join(SRC, 'ship', 'planet.png');
const yokeIdle = path.join(SRC, 'yoke', 'idle-still.png');
const yokeRoom = path.join(C, 'r4-yoke-in-room.png');
const limbsRef = path.join(C, 'limbs.png');
const hiveRef = path.join(C, 'city-hive-block-close.png');
const warRef = path.join(C, 'r3-units-army-1.png');
const posterRef = path.join(C, 'r2-keyart-poster.png');

export const JOBS = {
  // ---- key art ----
  'fall-wide': {
    size: [2048, 1152], refs: [title],
    prompt: `${POSTER} The same painting as the reference picture, repainted wider and sharper at 16:9: night over a ` +
      `small town of ${PEOPLE}, tidy wooden houses, a water tower, a main street with a diner and street lamps. ` +
      `In the sky on the RIGHT, ${METEOR}, falling toward the town, lighting the low clouds orange. ` +
      'In the street at the bottom right, a few townsfolk stop and look up, one pointing. The LEFT third of the ' +
      `picture is calm dark blue night sky over dark hills, empty. ${NOTHING}`,
  },
  siege: {
    size: [2048, 1152], refs: [limbsRef, hiveRef, warRef],
    prompt: `${POSTER} A wide dramatic battle scene seen from a little above the rooftops, at dusk. A street of ${CITY}. ` +
      `From the right, ${CREEP} has swallowed half the street, and on its rooftops stand ${LIMBS} (the first reference ` +
      `picture shows these turrets; the second shows the creep on a building). They fire down into the street: ` +
      `green acid arcs, lightning, burning bombs bursting. Marching up the street from the left into the fire comes ` +
      `${SOLDIERS} (the third reference picture shows their dress). Explosions, smoke, sparks, glowing shots crossing. ` +
      `The top left is dark smoky sky. ${NOTHING}`,
  },
  orbit: {
    size: [2048, 1152], refs: [exterior, yokeIdle],
    prompt: 'A lifelike hard science-fiction scene, cinematic, sharp. In orbit over a planet at night: a bare white ' +
      'ring-shaped imperial ship (exactly the ship in the first reference picture: a white cylinder hub with a ring ' +
      'and two solar wings) small in the middle distance. Below, the night side of the planet: its city lights, and ' +
      'spreading across one continent a vast glowing dark-red infestation like veins of living flesh, branching out ' +
      'from a bright red crater. On the LEFT, huge and close to the camera, a translucent blue hologram of the ship\'s ' +
      'AI, torso up: an anime girl with long straight silver hair, a black gear hair clip, amber eyes, a black ' +
      'high-collared uniform (exactly the girl in the second reference picture, drawn in the same anime style), ' +
      'glowing faint blue with scan lines, looking down at the planet with a small knowing smile. Black space, stars. ' +
      NOTHING,
  },
  // ---- cover plates: the same world, composed for each shape, with room for the logo ----
  'cover-tall': {
    size: [1024, 1536], refs: [title],
    prompt: `${POSTER} A tall painting in the world of the reference picture. Night over a small town of ${PEOPLE}. ` +
      `High in the sky in the upper middle, ${METEOR}, diving down toward the town and lighting the clouds orange. ` +
      'In the lower third, the rooftops, water tower and lit main street of the town, and in the foreground at the ' +
      'bottom a few townsfolk seen from behind, looking up, one pointing. The band across the middle of the picture, ' +
      `between the meteor and the rooftops, is dark blue night sky and low glowing cloud, fairly empty. ${NOTHING}`,
  },
  'cover-square': {
    size: [1024, 1024], refs: [title],
    prompt: `${POSTER} A square painting in the world of the reference picture. Night over a small town of ${PEOPLE}. ` +
      `In the upper right, ${METEOR}, diving toward the town, lighting the low clouds orange. The rooftops, water ` +
      'tower and lit main street of the town fill the bottom third, a few townsfolk looking up. The upper left is ' +
      `calm dark blue night sky, empty. ${NOTHING}`,
  },
  'cover-hero': {
    size: [3072, 1024], refs: [title],
    prompt: `${POSTER} A very wide panoramic painting in the world of the reference picture. Night over a small town ` +
      `of ${PEOPLE}, seen from a little above the rooftops: tidy wooden houses, a water tower, a main street with a ` +
      `diner and street lamps, dark hills beyond, spread across the whole width. On the right third, ${METEOR}, ` +
      'falling toward the town, lighting the clouds orange; a few townsfolk in the street look up. The middle of the ' +
      `picture is the town under a dark blue sky. ${NOTHING}`,
  },
  // ---- posters ----
  bmovie: {
    size: [1024, 1536], refs: [posterRef],
    prompt: `${POSTER} Aged and creased like a real 1950s film poster, in the manner of the reference picture but ` +
      'WITHOUT any lettering. In the middle, a gigantic glistening dark-red living growth of ropy tendrils and pale ' +
      'bone spikes rises over a small town at night, a split-open meteor glowing at its heart; searchlight beams ' +
      `cross the sky. In the foreground, terrified ${PEOPLE} flee toward the viewer: a man in a suit with a ` +
      'briefcase, a woman in a yellow dress carrying a child, a man in a hat. The TOP QUARTER of the poster is dark ' +
      'stormy sky with nothing in it, and the BOTTOM EIGHTH is a plain dark band, both left empty for lettering. ' +
      NOTHING,
  },
  procurement: {
    size: [1024, 1536],
    prompt: 'A 1950s screen-printed government propaganda poster illustration, flat shapes, only four inks: ' +
      'black, off-white cream, and one bright blood red, with a coarse halftone texture. Clean, confident, heroic ' +
      'and austere. The picture: seen from low below, a sleek white spaceship\'s open bay releases a single round ' +
      'red seed-pod of living flesh with pale bone spikes, which falls toward a curved planet at the bottom of the ' +
      'picture, trailing a straight red line; a clean-cut young human technician in a black high-collared uniform ' +
      'stands at the edge of the bay in the foreground, seen from behind, one hand on a lever, watching it go. ' +
      'Strong diagonal composition, bold rays in the background. The TOP THIRD is a plain cream area and the ' +
      `BOTTOM FIFTH is a plain black band, both left empty for lettering. ${NOTHING}`,
  },
  yoke: {
    size: [1024, 1536], refs: [yokeIdle, yokeRoom],
    prompt: 'A lifelike hard science-fiction scene aboard a bare black imperial ship: black walls, exact lines, one ' +
      'white strip light. In the middle, a translucent glowing blue hologram of the ship\'s AI, torso up, rising ' +
      'from a round black projector: an anime girl with very long straight silver hair, a black gear-shaped hair ' +
      'clip, amber eyes, a black high-collared uniform (exactly the girl in the first reference picture, in the same ' +
      'anime style; the second reference picture shows her in the room). She holds up one finger as if correcting ' +
      'you, with a small smug smile. Beside her floats a holographic globe of a planet with a spreading dark-red ' +
      'infestation marked on one continent. Faint scan lines. The top sixth and bottom quarter are dark and plain. ' +
      NOTHING,
  },
  // v1 (yoke.png) drew EARTH on the globe (Africa) and her too small: the planet is the insects' own world.
  'yoke-v2': {
    size: [1024, 1536], refs: [yokeIdle, yokeRoom],
    prompt: 'A lifelike hard science-fiction scene aboard a bare black imperial ship: black walls, exact lines, one ' +
      'white strip light. Close and large, filling the middle of the picture from the waist up, a translucent glowing ' +
      'blue hologram of the ship\'s AI: an anime girl with very long straight silver hair, a black gear-shaped hair ' +
      'clip, amber eyes, a black high-collared uniform (exactly the girl in the first reference picture, in the same ' +
      'anime style). She leans toward the viewer with one finger raised as if correcting you, a small smug smile, one ' +
      'eyebrow up. At her shoulder floats a small holographic globe of an ALIEN planet with invented continents ' +
      '(NOT Earth, no real continents), one of them webbed with glowing dark-red veins of infestation. Faint scan ' +
      `lines. The top sixth and bottom fifth of the picture are dark and plain. ${NOTHING}`,
  },
  crater: {
    size: [2048, 1152], refs: [limbsRef, hiveRef],
    prompt: 'A realistic, detailed matte painting, overcast daylight, seen from above at a steep three-quarter angle ' +
      `like a strategy game, but cinematic. A block of ${CITY}. In the square in the middle, a split-open living ` +
      'meteor pod of dark cracked shell with a glowing red beating heart inside sits half buried in a crater, and ' +
      `from it ${CREEP} spreads in every direction in thick roots, climbing the honeycomb walls and covering the ` +
      `roof terraces. On the creeped roofs stand ${LIMBS} (the first reference picture shows them; the second shows ` +
      'the creep on a building). Down in the channels between the blocks, small insect soldiers in dark robes and ' +
      'tall rounded helmets advance in squads and are hit by green acid, lightning and burning spores. Smoke drifts ' +
      `over the unclaimed city at the edges. ${NOTHING}`,
  },
};

const want = process.argv.slice(2);
const ids = Object.keys(JOBS).filter((id) => !want.length || want.includes(id));
fs.mkdirSync(DIR, { recursive: true });
const before = await balance();
const results = await pool(ids, 4, (id) => {
  const j = JOBS[id];
  return makeStill({
    slug: `promo-${id}`, out: path.join(DIR, `${id}.png`), prompt: j.prompt, key: null,
    width: j.size[0], height: j.size[1], quality: 'high', refFiles: j.refs?.filter((f) => fs.existsSync(f)),
  });
});
results.forEach((r, i) => { if (!r.ok) console.warn(`[promo] ${ids[i]} failed: ${r.error.message.slice(0, 300)}`); });
const after = await balance();
console.log(`[promo] asked for ${spent.stills} pictures; tokens ${before} -> ${after} (spent ${before - after}, others share this balance)`);
