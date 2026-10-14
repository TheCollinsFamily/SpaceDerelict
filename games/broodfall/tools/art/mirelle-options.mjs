/**
 * Portrait options for Mirelle, the cat girl of the Felid Concord who writes to him (content/letters.ts; Collins, Oct 14
 * 2026: "does Mirelle have a picture? give me some options"). Four draws at the API's default tier, to
 * art-src/letters/options/mirelle-<a-d>.png, each a different answer to how anthro a cat girl is: the lore says
 * "anthro-looking like other uplifts; all female; made because someone thought cat girls would be hot".
 *
 *   node tools/art/mirelle-options.mjs            → the four options (a draw already there is kept)
 *
 * The one he picks: copy it to art-src/letters/pictures/mirelle.png and bake it into the Letters room (the thread's
 * picture; tools/art/letters.mjs once it exists).
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool, ready } from './rfab.mjs';
import { ROOT } from './lib/manifest.mjs';

const OUT = path.join(ROOT, 'art-src', 'letters', 'options');

/** The photograph she attached to her letter: not an ID photo, a picture of herself she chose. */
const BASE = (look) =>
  'A lifelike photograph a young woman attached to a flirtatious letter: a portrait from the top of her head to her ' +
  'waist, centred, warm soft light, a plain softly lit wall behind her in muted teal, sharp focus on her face. She is ' +
  'a cat girl, an uplifted species: a young woman of about twenty-two with large furred cat ears in place of human ears, ' +
  'a long expressive cat tail visible in the frame, and feline slit-pupil eyes, green. ' +
  `${look} ` +
  'She is fully and modestly dressed in the Felid Concord\'s consular clothing: a fitted high-collared jacket in deep ' +
  'teal with a narrow cream sash across it, clean lines, no logo. Playful, confident and warm, with a small mischievous ' +
  'smile, one corner of the mouth up. Tasteful: a charming portrait, not a glamour shot, nothing revealing. No text ' +
  'anywhere: no letters, no numbers, no symbols, no frame or border.';

const LOOKS = {
  a: 'Near human: smooth human skin, short dark hair in a bob, only the furred ears, the tail and the slit pupils are feline; a wink.',
  b: 'A little more feline: short fine pale fur along her cheekbones and the backs of her hands, a small pink nose, whisker-fine lines at the cheeks, tawny hair pulled up; head tilted, ears forward.',
  c: 'Formal, as the Concord\'s consul: composed, chin up, ears tall and still, the sash neat, hands folded; the smile held back to the eyes. Ginger-tabby hair with darker streaks.',
  d: 'Taken by herself, close and a little from above, as a message photo: eyes wide and bright, mouth in a small cat-like :3 shape, one ear flicked, the tail curling up into the corner of the frame; silver-grey hair.',
};

/**
 * Collins, Oct 14 2026, on the four: "A and D came out best but she would be taking a selfie and would have larger breasts
 * (remember the nekos do reproduce sexually); I would also give her a black gear pendant and have her background be a
 * spaceship room." `settle N` draws N from A and D as the references: mirelle-s1.png, -s2.png...
 */
const SETTLE =
  'A lifelike selfie a young woman took of herself and attached to a flirtatious letter: her arm reaching out of frame to ' +
  'hold the camera, close and a little from above, from the top of her head to her waist, warm light. Behind her, a ' +
  'small cabin aboard a spaceship: curved panels, soft indicator lights, a narrow bunk, a round viewport with stars. She ' +
  'is the cat girl of the reference pictures, the same face as the first reference: a young woman of about twenty-two, ' +
  'short black hair in a bob, large furred cat ears in place of human ears, feline slit-pupil green eyes, a long expressive ' +
  'cat tail curling into the frame, one eye winking, a small mischievous smile. She is fuller in figure than the ' +
  'references, with a generous bust under her clothes, and fully and modestly dressed in the Felid Concord\'s consular ' +
  'clothing: a fitted high-collared jacket in deep teal with a narrow cream sash across it. At her throat, on a fine ' +
  'chain, a small black gear pendant, matte, the one ornament she wears. Tasteful: charming, nothing revealing. No text ' +
  'anywhere: no letters, no numbers, no frame or border.';

fs.mkdirSync(OUT, { recursive: true });
if (typeof ready === 'function') await ready();
const [mode, count] = process.argv.slice(2);
const items = mode === 'settle'
  ? Array.from({ length: Number(count ?? 3) }, (_, i) => [`s${i + 1}`, SETTLE])
  : Object.entries(LOOKS);
const refs = mode === 'settle' ? ['a', 'd'].map((o) => path.join(OUT, `mirelle-${o}.png`)).filter((f) => fs.existsSync(f)) : [];
await pool(items, 2, ([id, look]) => makeStill({ slug: `mirelle option ${id}`, out: path.join(OUT, `mirelle-${id}.png`), prompt: mode === 'settle' ? look : BASE(look), key: null, width: 1024, height: 1024, refFiles: refs }));
for (const [id] of items) console.log(`option ${id}: ${path.join(OUT, `mirelle-${id}.png`)} ${fs.existsSync(path.join(OUT, `mirelle-${id}.png`)) ? 'ok' : 'MISSING'}`);
