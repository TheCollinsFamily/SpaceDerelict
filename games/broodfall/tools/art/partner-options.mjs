/**
 * Portrait options for the partner candidate (Collins, Oct 14 2026: "draw me a few options and I will pick one and go for a
 * nerdy shy look"). Four draws of the same brief, each with its own shy look, at the API's default tier, to
 * art-src/intro/options/partner-<a-d>.png (a draw already there is kept; move it away to draw again).
 *
 *   node tools/art/partner-options.mjs            → the four options
 *   node tools/art/partner-options.mjs settle d 2  → two redraws of option d with the hands down (partner-d1.png, -d2.png),
 *                                                    drawn from option d as the reference so the face holds (Collins: "D is
 *                                                    perfect except for the hand position not being down, which will look
 *                                                    bad in a looping video")
 *
 * The one he picks: copy it over art-src/intro/pictures/partner.png (move the old one into art-src/intro/v1/ first, never
 * delete) and run `node tools/art/intro.mjs partner` to bake public/art/intro/partner.webp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool, ready } from './rfab.mjs';
import { ROOT } from './lib/manifest.mjs';

const OUT = path.join(ROOT, 'art-src', 'intro', 'options');
const REF = path.join(ROOT, 'notes', 'concepts', '2026-09-29', 'r4-hero-portrait.png');

/** The brief, as tools/art/intro.mjs `partner` has it, with the expression left to each option. */
const BASE = (look) =>
  'An official identification photograph, lifelike, from a far-future austere, ultra-efficient human society: ' +
  'a portrait of a cute young woman who looks about twenty-three, facing the camera straight on, centred, framed a ' +
  'little wider than a passport photo: from the top of her head to her waist, her hands in front of her at the bottom ' +
  'of the frame. Plain even pale grey backdrop, flat even studio light, sharp focus, no retouching glamour. She is ' +
  'modestly and fully dressed in the same uniform as the man in the reference: a plain black high-necked tunic with a ' +
  'narrow white collar, buttoned to the throat. The tunic hangs straight and flat on a slight, slender frame: she is ' +
  'thin and flat-chested, as the women of this society are. Her left forearm and hand are a bare-bones prosthetic: an ' +
  'open skeletal frame of dark machined struts with the circuitry, cables and actuators exposed between them, nothing ' +
  'covered that need not be, functional and unadorned, the tunic sleeve ending above it; her right hand is her own, ' +
  'pale and freckled. Ginger hair, a warm red-orange, pulled back into a low bun; pale skin with freckles across her ' +
  `nose and cheeks; round thin-rimmed glasses; no jewellery, no makeup. ${look} Sweet and respectable: an ID card ` +
  'photo, not a glamour shot. Not the man of the reference: only his uniform and the photographic look are borrowed. ' +
  'No text anywhere: no letters, no numbers, no name, no badge, no insignia, no logo, no symbol of any kind (no crosses, ' +
  'no gears, no religious symbol), no frame or border.';

const LOOKS = {
  a: 'Nerdy and shy: the round glasses a little too big for her face, her eyes down and to one side as if she would rather not be looked at, a faint blush, lips pressed in a small nervous almost-smile, her shoulders drawn in a little, hands folded.',
  b: 'Nerdy and shy: looking straight into the camera through her round glasses with wide, uncertain eyes, cheeks pink, a small hopeful smile held a moment too long, a few fine wisps of hair escaped over her forehead, her hands clasped tight in front of her.',
  c: 'Nerdy and shy: her head tipped slightly down so she peers up over the rims of her round glasses, a bashful crooked smile, a clear blush across the freckles, the tip of one ear pink, hands folded.',
  d: 'Nerdy and shy: a bookish, earnest face caught pushing her round glasses up with the knuckle of the prosthetic hand at the moment of the photograph, her other hand at her side, eyebrows raised a little, an awkward half-smile, blushing.',
};

fs.mkdirSync(OUT, { recursive: true });
if (typeof ready === 'function') await ready();
const [mode, pick, count] = process.argv.slice(2);
const items = mode === 'settle'
  ? Array.from({ length: Number(count ?? 2) }, (_, i) => [`${pick}${i + 1}`, LOOKS[pick].replace(/caught pushing her round glasses up with the knuckle of the prosthetic hand at the moment of the photograph, her other hand at her side, /, 'both arms down and her hands folded in front of her at the bottom of the frame, the bare prosthetic forearm in plain view, the same face as the reference photograph, ')])
  : Object.entries(LOOKS);
const refs = (id) => [mode === 'settle' ? path.join(OUT, `partner-${pick}.png`) : null, REF].filter((r) => r && fs.existsSync(r));
await pool(items, 2, ([id, look]) => makeStill({
  slug: `partner option ${id}`, out: path.join(OUT, `partner-${id}.png`), prompt: BASE(look), key: null,
  width: 1024, height: 1024, refFiles: refs(id),
}));
for (const [id] of items) console.log(`option ${id}: ${path.join(OUT, `partner-${id}.png`)} ${fs.existsSync(path.join(OUT, `partner-${id}.png`)) ? 'ok' : 'MISSING'}`);
