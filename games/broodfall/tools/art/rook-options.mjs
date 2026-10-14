/**
 * Portrait options for the rim convert who writes to him (content/letters.ts; Collins, Oct 14 2026): raised on a
 * gladiatorial station of the outer rim, bred for entertainment fighting, part orca from the genetic experimentation
 * that made her; won her freedom and a ship; outgoing, confident and brash; wants purpose, not safety. Four draws at the
 * API's default tier, to art-src/letters/options/rook-<a-d>.png, each showing more of the orca than the last.
 *
 *   node tools/art/rook-options.mjs            → the four options (a draw already there is kept)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool, ready } from './rfab.mjs';
import { ROOT } from './lib/manifest.mjs';

const OUT = path.join(ROOT, 'art-src', 'letters', 'options');

const BASE = (look) =>
  'A lifelike photograph, taken by someone else at eye level, of a young woman aboard her own small salvage ship of the ' +
  'outer rim: behind her a cramped cabin of scuffed grey metal, exposed conduit, a welded repair, one hard white work ' +
  'light, a narrow viewport with stars. Portrait from the top of her head to her waist, centred. She is about twenty-four, ' +
  'athletic and strong-shouldered, a fighter\'s build, standing square to the camera with her chin up and a wide confident ' +
  'brash grin, as if she has already won. ' +
  `${look} ` +
  'A thin old scar through one eyebrow. She wears a fitted dark flight jacket, worn at the seams, zipped high, no insignia, ' +
  'and nothing else of note: no jewellery. Fully and modestly dressed. Tasteful: a strong, likeable portrait, not a ' +
  'glamour shot. No text anywhere: no letters, no numbers, no symbols, no frame or border.';

const LOOKS = {
  a: 'She is part orca, lightly: human skin, with a pale grey-white patch over and behind each eye like an orca\'s eye patch, short black hair, dark eyes, teeth a little too even and white.',
  b: 'She is part orca: smooth skin shading from pale grey at the throat to charcoal at the temples, with sharp white patches over and behind each eye and at the jaw, black hair cropped short, dark eyes.',
  c: 'She is part orca: human-looking, with a white streak through black hair swept back, dark glossy skin along the back of the neck and the backs of the hands, a faint low ridge down the crown of the head under the hair, dark eyes.',
  d: 'She is strongly part orca: skin in an orca\'s black and white, the white over the eyes, the throat and the chest, the black over the crown, the cheeks and the shoulders, with the pattern\'s clean edges; white hair cut short; dark eyes; the grin full of even white teeth.',
};

fs.mkdirSync(OUT, { recursive: true });
if (typeof ready === 'function') await ready();
const items = Object.entries(LOOKS);
await pool(items, 2, ([id, look]) => makeStill({ slug: `rook option ${id}`, out: path.join(OUT, `rook-${id}.png`), prompt: BASE(look), key: null, width: 1024, height: 1024 }));
for (const [id] of items) console.log(`option ${id}: ${path.join(OUT, `rook-${id}.png`)} ${fs.existsSync(path.join(OUT, `rook-${id}.png`)) ? 'ok' : 'MISSING'}`);
