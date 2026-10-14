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

/**
 * Collins, Oct 14 2026, on the four: "D is closest but you gave her a dumb expression in all of them; she should have more of
 * a psycho yandere look, and look way less intact: part of her face and one of her eyes ripped out, replaced with a poorly
 * fitting mechanical one; she also shows more skin and has more of a raider look; she is around 23 in looks like the rest
 * though biologically older (around 30), all women even in the outer rim stop ageing young." `wreck` draws three from D as
 * the reference: rook-w1.png, -w2, -w3, each more damaged than the last.
 */
const WRECK = (damage) =>
  'A lifelike photograph, taken by someone else at eye level, of the woman of the reference picture, the same orca colouring: ' +
  'skin in an orca\'s black and white, the white over the eye, the throat and the chest, the black over the crown, the cheek ' +
  'and the shoulders, with the pattern\'s clean edges; white hair cut short. She looks about twenty-three. She stands in her ' +
  'own small salvage ship of the outer rim: a cramped cabin of scuffed grey metal, exposed conduit, a welded repair, one ' +
  'hard white work light, a narrow viewport with stars. Portrait from the top of her head to her waist, centred. ' +
  `${damage} ` +
  'Her expression is not a grin: an intense, fixed, unblinking stare straight into the camera, head tilted a little, lips ' +
  'parted in a thin, wrong, hungry smile, the look of someone who has decided about you. A raider\'s look: a cropped ' +
  'sleeveless dark vest over a fitted black top, bare muscled arms and shoulders with old scars, a tool harness strapped ' +
  'across her chest, cargo trousers at the waist; midriff and arms bare, nothing else exposed. No jewellery. Tasteful: ' +
  'a hard, charismatic, unsettling portrait, not a glamour shot. No text anywhere: no letters, no numbers, no symbols, no ' +
  'frame or border.';
const DAMAGE = {
  w1: 'Her left eye is gone: in the socket sits a crude mechanical eye, a poorly fitting lens in a scratched steel housing, sunk too deep and set a little off true, with a glowing red point where the pupil should be; the skin around it is scar tissue, and a long healed tear runs from it down the cheek to the jaw.',
  w2: 'The left side of her face was torn away in the rings and rebuilt badly: a crude mechanical eye in a scratched steel housing, poorly fitted, set off true, a red pinpoint for a pupil; the cheek below it is a patch of riveted plate over scar tissue, and the ear on that side is half gone.',
  w3: 'Half her face is wreckage held together on purpose: the left eye a cheap mechanical optic bolted into the socket through a steel bracket that does not match the other side, a red pinpoint pupil; the cheekbone and temple under it bare scar tissue and two plates; the left ear gone; her right eye, the living one, wide and fixed on the camera.',
};

fs.mkdirSync(OUT, { recursive: true });
if (typeof ready === 'function') await ready();
const mode = process.argv[2];
const items = mode === 'wreck' ? Object.entries(DAMAGE).map(([id, d]) => [id, WRECK(d)]) : Object.entries(LOOKS);
const refs = mode === 'wreck' ? [path.join(OUT, 'rook-d.png')].filter((f) => fs.existsSync(f)) : [];
await pool(items, 2, ([id, look]) => makeStill({ slug: `rook option ${id}`, out: path.join(OUT, `rook-${id}.png`), prompt: mode === 'wreck' ? look : BASE(look), key: null, width: 1024, height: 1024, refFiles: refs }));
for (const [id] of items) console.log(`option ${id}: ${path.join(OUT, `rook-${id}.png`)} ${fs.existsSync(path.join(OUT, `rook-${id}.png`)) ? 'ok' : 'MISSING'}`);
