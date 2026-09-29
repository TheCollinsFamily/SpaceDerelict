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

const JOBS = {
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

ready();
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const slugs = want.length ? want : Object.keys(JOBS);
const results = await Promise.allSettled(slugs.map(async (slug) => {
  const j = JOBS[slug];
  if (!j) throw new Error(`unknown concept "${slug}" (have: ${Object.keys(JOBS).join(', ')})`);
  const file = await makeStill({ slug: `concept-${slug}`, prompt: j.prompt, key: null, width: j.w, height: j.h, quality: j.quality });
  const out = path.join(OUT, `${slug}.png`);
  fs.copyFileSync(file, out);
  return out;
}));
results.forEach((r, i) => console.log(r.status === 'fulfilled' ? `OK   ${r.value}` : `FAIL ${slugs[i]}: ${r.reason.message}`));
process.exit(results.some((r) => r.status === 'rejected') ? 1 : 0);
