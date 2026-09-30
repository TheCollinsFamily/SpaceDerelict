/**
 * THE SCREENS TEMPLATE: the pictures of the screens around the board (Sep 30 2026).
 *
 *   emblem         the emblem the title's word is set around (the word itself is TYPE, set by
 *                  the game in index.html / style.css, so that renaming the game is one line)
 *   title          the key art behind the title screen: the brood falling on an insect town
 *   won, lost, held  the end-of-run report's lead picture: the town overrun, the growth burned,
 *                  a counter-attack thrown back
 *
 *   node tools/art/make.mjs screens              whatever is missing, then the bake
 *   node tools/art/make.mjs screens emblem       some of it
 *   node tools/art/make.mjs screens --bake       bake again (free)
 *
 * Every picture is in the look of the films and posters (style bible rule 4: "the 1950s B-movie
 * look is for films only ... animations and news clippings"): the report reads as a newsreel
 * still, the title as a poster with its lettering left to the game. No lettering and no
 * religious symbol in any of them. To draw one again, MOVE art-src/screens/<id>.png into
 * art-src/screens/v1/ first.
 *
 * The manifest entry goes under ship.screens (manifest.mjs keeps a fixed list of sections, and a
 * new section would be dropped by a bake that runs from an older copy of it).
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool } from '../rfab.mjs';
import { blank, bbox, borderColour, crop, readImage, resize, toWebp, writeJpg, writePng } from '../lib/img.mjs';
import { keyFrame, keyOf } from '../lib/key.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';

const DIR = path.join(SRC, 'screens');
const OUT = path.join(ART, 'screens');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');

const NOTHING =
  'No text anywhere: no letters, no words, no numbers, no signs with writing, no logos. No crosses, no stars, ' +
  'no crescents, no churches, no steeples, no religious symbol of any kind.';
const PEOPLE =
  'insect people like those of a 1950s science-fiction film: human posture and body language, an insect head with ' +
  'large round eyes, small mandibles and antennae, dark umber chitin instead of skin, dressed in 1950s clothes ' +
  '(hats, suits, cardigans, print dresses)';
const FILM =
  'A wide film still from a 1950s colour science-fiction film: saturated Technicolor, theatrical studio lighting, ' +
  'a miniature town set, film grain, the slight softness of old lenses.';
const POSTER =
  'Painted like the art of a 1950s science-fiction film poster: bold gouache brushwork, strong simple shapes, ' +
  'saturated reds and oranges against deep night blues.';

export const SCREENS = {
  emblem: {
    size: [1024, 1024], key: true,
    prompt: `${POSTER} A single emblem for the title of a film, centred, compact, with a wide empty margin all round. ` +
      'A living meteor dives down from the upper right toward the lower left: a round seed-pod of glistening dark ' +
      'red flesh with a few pale bone spikes, split open along one side with a hot orange glow inside, trailing a ' +
      'short tail of fire and a few loose red tendrils. Around it a thin ring of twisted red tendrils, like the ' +
      `rim of a badge, broken where the meteor bursts through it. Nothing else. ${NOTHING}`,
  },
  title: {
    size: [1536, 1024], refs: [path.join(CONCEPTS, 'r2-castes-human.png')],
    prompt: `${POSTER} A wide illustration with no lettering. Night over a small town of ${PEOPLE}: tidy wooden ` +
      'houses, a water tower, a main street with a diner and street lamps, all seen from a little above the ' +
      'rooftops. In the sky on the RIGHT, a burning red living meteor, split open, trailing fire and red tendrils, ' +
      'falls toward the town and lights the low clouds orange. In the street at the bottom right, a few small ' +
      'townsfolk stop and look up, one pointing. The whole LEFT half and the top of the picture are calm dark blue ' +
      `night sky and dark hills, empty, for a title to be set over. ${NOTHING}`,
  },
  won: {
    size: [1536, 1024], refs: [path.join(CONCEPTS, 'r2-film-still.png')],
    prompt: `${FILM} The town square of ${PEOPLE}, at dawn, overrun: a huge glistening red living growth with thick ` +
      'ropy tendrils has swallowed the town hall and spills over the roofs and down the street, patches of red ' +
      'creep across the pavement; an abandoned car with its doors open, a dropped hat and a suitcase in the ' +
      `street; a few small townsfolk flee in the far distance. Seen from a little above the street. ${NOTHING}`,
  },
  lost: {
    size: [1536, 1024], refs: [path.join(CONCEPTS, 'r2-film-still.png')],
    prompt: `${FILM} Night, in the street of a small town of ${PEOPLE}. In a smoking crater in the middle of the street ` +
      'lies a burned, blackened, dead red living growth, its charred tendrils limp across the pavement. Insect ' +
      'soldiers in 1950s army helmets and olive uniforms, holding flamethrowers with pilot flames, stand around the ' +
      'crater, proud; behind a rope, townsfolk cheer and wave hats; a press photographer\'s flashbulb flares. ' +
      `Seen from a little above the street. ${NOTHING}`,
  },
  held: {
    size: [1536, 1024], refs: [path.join(CONCEPTS, 'r2-film-still.png')],
    // v1 (art-src/screens/v1/held.png) showed the soldiers walking INTO the growth: the attack, not its failure.
    prompt: `${FILM} Dusk, a street of a small town of ${PEOPLE}, held by a glistening red living growth: in the ` +
      'background its thick tendrils wall the street from side to side like a barricade. In the foreground, an insect ' +
      'army’s attack has broken and its soldiers in 1950s olive helmets and uniforms RUN AWAY toward the camera in ' +
      'panic, faces afraid, one dropping his rifle, one helping a limping comrade; an overturned olive army truck ' +
      'smokes at the side; helmets and rifles lie on the pavement. A red tendril reaches after them along the ' +
      `street. Seen from a little above the street. ${NOTHING}`,
  },
};

const want = (only, id) => !only?.length || only.includes(id);

async function generate(only) {
  const jobs = Object.entries(SCREENS).filter(([id]) => want(only, id)).map(([id, s]) => () => makeStill({
    slug: `screens ${id}`, out: path.join(DIR, `${id}.png`), prompt: s.prompt,
    key: s.key ? '00FF00' : null, keyName: 'green',
    width: s.size[0], height: s.size[1], quality: 'high',
    refFiles: s.refs?.filter((f) => fs.existsSync(f)),
  }));
  const results = await pool(jobs, 5, (j) => j());
  results.forEach((r) => { if (!r.ok) console.warn(`[screens] a picture failed: ${r.error.message.slice(0, 200)}`); });
}

const save = (img, file, q = 86) => {
  const png = file.replace(/\.webp$/, '.png');
  writePng(png, img);
  toWebp(png, file, { q });
  fs.rmSync(png);
  return fs.statSync(file).size;
};

/** The emblem off its key colour, cut to what is in it, square, 640 px. */
function bakeEmblem(file) {
  const img = readImage(file);
  keyFrame(img, keyOf(borderColour(img)), { spill: 'edge' });
  const box = bbox(img, 40) ?? { x0: 0, y0: 0, x1: img.w, y1: img.h };
  const side = Math.ceil(Math.max(box.x1 - box.x0, box.y1 - box.y0) * 1.04);
  const sq = crop(img, Math.round((box.x0 + box.x1 - side) / 2), Math.round((box.y0 + box.y1 - side) / 2), side, side);
  return resize(sq, 640, 640);
}

export function bakeScreens() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(REVIEW, 'screens'), { recursive: true });
  const entry = {};
  let total = 0;
  for (const id of Object.keys(SCREENS)) {
    const file = path.join(DIR, `${id}.png`);
    if (!fs.existsSync(file)) continue;
    if (id === 'emblem') {
      const img = bakeEmblem(file);
      total += save(img, path.join(OUT, 'emblem.webp'), 90);
      // To look at: on the title's dark blue and on the khaki of the console.
      const sheet = blank(1280, 640, [0, 0, 0, 255]);
      for (let y = 0; y < 640; y++) for (let x = 0; x < 1280; x++) {
        const i = (y * 1280 + x) * 4;
        const bgc = x < 640 ? [14, 20, 38] : [196, 184, 140];
        const s = ((y * 640) + (x % 640)) * 4;
        const a = img.data[s + 3] / 255;
        for (let k = 0; k < 3; k++) sheet.data[i + k] = Math.round(img.data[s + k] * a + bgc[k] * (1 - a));
      }
      writeJpg(path.join(REVIEW, 'screens', 'emblem.jpg'), sheet, 3);
      entry.emblem = 'screens/emblem.webp';
      continue;
    }
    const [w, h] = id === 'title' ? [1536, 1024] : [1152, 768];
    const img = readImage(file, { w, h });
    total += save(img, path.join(OUT, `${id}.webp`), 84);
    writeJpg(path.join(REVIEW, 'screens', `${id}.jpg`), img, 3);
    entry[id] = `screens/${id}.webp`;
  }
  putEntry('ship', 'screens', entry);
  console.log(`[screens] baked: ${Object.keys(entry).join(', ') || 'nothing'}; ${Math.round(total / 1024)} KB`);
  return entry;
}

export async function makeScreens({ bakeOnly = false, only } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  if (!bakeOnly) await generate(only);
  return bakeScreens();
}
