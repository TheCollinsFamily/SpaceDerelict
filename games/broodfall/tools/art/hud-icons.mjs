/**
 * THE HUD STYLE OPTIONS' pictures (Sep 30 2026; src/hud/themes.ts): the few things a theme draws
 * better as a picture than as CSS. SPENDS RFab tokens; every picture already made is skipped.
 *   newsreel: the three castes as cheerful 1950s pest-control clip art, and the propaganda
 *             department's mascot (the bioweapon drawn cute) for the wave banner.
 *   brood:    the membrane the creature's own panels are made of.
 * Raw stills: art-src/hud/ (not committed). Keyed, small PNGs: src/hud/art/.
 *
 * Usage: node tools/art/hud-icons.mjs [name ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ready, makeStill, ffmpeg, balance, spent } from './rfab.mjs';

const RAW = path.join(ROOT, 'art-src', 'hud');
const OUT = path.join(ROOT, 'src', 'hud', 'art');
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const CLIPART = 'A single cheerful 1950s pest-control advertisement clip-art icon, mid-century American print style: '
  + 'thick confident black ink outlines, flat fills in cream, tomato red and black only, a little halftone dot shading, '
  + 'a thick cream sticker outline around the whole figure. Centred, filling most of the frame, facing the viewer. '
  + 'Absolutely no text, no letters, no numbers, no words, no logo, no banner, no frame.';

const PICTURES = [
  { name: 'nr-war', size: 160, prompt: `${CLIPART} The figure: a cartoon soldier ant (an insect with six legs and two antennae) wearing a little round army helmet, marching proudly with a big grin.` },
  { name: 'nr-science', size: 160, prompt: `${CLIPART} The figure: a cartoon beetle scientist with big round spectacles and a lab coat, holding up a bubbling test tube, smiling.` },
  { name: 'nr-royal', size: 160, prompt: `${CLIPART} The figure: a plump cartoon queen insect with a tiny jewelled crown and little wings, smiling smugly, waving.` },
  { name: 'nr-mascot', size: 256, prompt: `${CLIPART} The figure: a friendly cartoon blob creature made of red flesh with many little curly tentacles, one big happy eye, wearing a tiny exterminator's cap, giving a thumbs up with one tentacle and winking.` },
  {
    name: 'brood-membrane', size: 512, key: null,
    prompt: 'A seamless macro texture of dark translucent organic membrane, deep maroon to near-black, with fine branching veins '
      + 'glowing a faint pink-red bioluminescence and a few pale green-yellow glowing capillaries, a wet sheen, flat even light, '
      + 'seen straight on. It fills the whole frame edge to edge with the same density everywhere: no objects, no centre, no vignette, no text.',
  },
];

ready();
const want = new Set(process.argv.slice(2));
const before = await balance();
for (const p of PICTURES) {
  if (want.size && !want.has(p.name)) continue;
  const keyed = p.key !== null;
  const raw = await makeStill({ slug: p.name, prompt: p.prompt, key: keyed ? '00FF00' : null, quality: 'high', out: path.join(RAW, `${p.name}.png`) });
  const out = path.join(OUT, `${p.name}.${keyed ? 'png' : 'jpg'}`);
  if (keyed) {
    ffmpeg(['-i', raw, '-vf', `chromakey=0x00FF00:0.22:0.08,despill=type=green,scale=${p.size}:-1:flags=lanczos`, out], p.name);
  } else {
    ffmpeg(['-i', raw, '-vf', `scale=${p.size}:-1:flags=lanczos`, '-q:v', '4', out], p.name);
  }
  console.log(`[hud] ${p.name}: ${out}`);
}
const after = await balance();
console.log(`stills made: ${spent.stills}; tokens spent: ${before - after}`);
