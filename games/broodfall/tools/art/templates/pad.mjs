/**
 * THE DATA PAD (Collins, Sep 30 2026): "when you are finished with a mission or lose it should
 * have a video that shows your character setting down a data pad that has something similar
 * to the last screen looked at in the game, to create the effect that that was you just
 * holding it".
 *
 * The game (src/ui/padOutro.ts) plays one of these clips over the page with the pad's screen
 * keyed out, and draws the LIVE game view (the Pixi board and the whole console HUD) into the
 * screen's four corners, frame by frame. So the pad shows exactly what the player was looking at.
 *
 *   1. two stills, first person, through HIS eyes (the hero of the ship concepts: black
 *      high-collared garment, sleeves pushed up): START = the pad held up in both hands, its
 *      screen (flat pure green) filling nearly the whole picture; END = the same pad lying on
 *      his console desk under the long window onto the planet (the ship's operations room of
 *      notes/concepts/2026-09-29/hero-behind-desk.png). Where he is: his own desk, in the ship.
 *   2. a START-AND-END clip between them (seegen:sd2-mini, 720p, 16:9, 5 s): `won` sets it down
 *      calmly, `lost` lets it drop the last inch and leaves his hand flat on the desk.
 *   3. the bake: every frame keyed by Leaflit's studio ChromaKey (tools/art/lib/leaflit.mjs) with
 *      the key colour measured on the screen itself; the screen found in every frame (its biggest
 *      keyed patch, the convex hull, four edges fitted robustly so a finger on the edge does not
 *      bend it, the corners where they meet, smoothed over time); the key kept only inside that
 *      screen (the planet in the window stays); VP8 WebM with alpha + the corners as JSON
 *      (public/art/pad/), a review strip with a real game picture warped in (notes/art-review/pad/).
 *
 *   node tools/art/make.mjs pad --stills     the two stills (LOOK before paying for clips)
 *   node tools/art/make.mjs pad              stills, clips, bake
 *   node tools/art/make.mjs pad --bake       bake again (free)
 *
 * To make a step again, move its file out of art-src/pad/infested/ (into art-src/pad/infested/old/); never touch
 * the first take's files in art-src/pad/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill } from '../rfab.mjs';
import { ART, REVIEW, ROOT, SRC } from '../lib/manifest.mjs';

// The kept take (fix pass, Sep 30 2026): the window shows the INFESTED insect planet of the menu's loop
// (art-src/intro/menu.png), not the green Earth-like world of the first take. The first take's files stay in
// art-src/pad/ untouched; the new end still and clips live in art-src/pad/infested/. The start still (the pad
// filling the frame, no window in it) is the first take's, shared.
const FIRST = path.join(SRC, 'pad');
const DIR = path.join(FIRST, 'infested');
const MENU_PLANET = path.join(SRC, 'intro', 'menu.png');
const PLANET = 'the planet is the infested insect world of the menu view: its dark night side, black oceans and dark land ' +
  'grown over with branching, fractal patches of dim gold hive-city lights, and across its middle a wide spreading stain of ' +
  'dark red creep veined with glowing red-orange cracks and a few bright orange burning spots, a thin blue rim of atmosphere ' +
  'along its curve, black starry space above; no green forests, no white clouds, no daylight blue seas';
const OUT = path.join(ART, 'pad');
const LOOK = path.join(REVIEW, 'pad');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const W = 1280, H = 720, FPS = 30; // the clips' own rate (Oct 2 2026: resampling 30 -> 24 made the motion uneven, one source of the screen's shake)

const NONE = 'No text, no lettering, no numbers, no logos, no emblems, no symbols, no icons anywhere in the picture.';
const REAL = 'Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set, natural film grain.';
const HANDS = 'his own two hands: a slight young man\'s hands with bare forearms, the sleeves of his plain black garment pushed up to the elbows';
const GREEN = 'The screen is lit one single flat pure bright green #00FF00 from edge to edge: perfectly even, no picture on it, no reflection, no glare, no gradient, no pattern.';
const PAD = 'a thin matte black data pad, a wide flat slab like a tablet, its screen a wide 16:9 rectangle framed by a narrow even matte black bezel, with rounded outer corners';

export const START = {
  file: path.join(FIRST, 'start.png'),
  prompt: `${REAL} First-person point of view, a wide 16:9 frame, seen through the eyes of a young man in a small dark starship. ` +
    `He holds ${PAD} straight up in front of his eyes with ${HANDS}, square on to the camera and level, so close that the pad fills ` +
    'nearly the whole picture: its screen covers almost the entire frame, and its narrow black bezel shows as a thin even border ' +
    'just inside all four edges of the picture, with only a sliver of the dark room beyond it at the very edges. His thumbs rest ' +
    `on the bottom bezel near the two lower corners; the rest of his hands are hidden behind the pad. ${GREEN} ${NONE}`,
};

export const END = {
  file: path.join(DIR, 'end.png'),
  // An EDIT of the first take's end still (the desk, pad, hand and window kept), with the planet repainted after the menu's.
  base: path.join(FIRST, 'end.png'),
  prompt: `${REAL} Keep the first reference picture exactly as it is: the same first-person view of the long matte black console ` +
    'desk, the same data pad lying on it in the same place at the same size with its screen one flat pure bright green, the same ' +
    'right hand beside it, the same small metal trinkets at the back of the desk, the same long window with its pale frame, the ' +
    'same framing and light. Change ONLY what is seen through the window: ' + PLANET + ', exactly like the planet in the second ' +
    `reference picture, seen from orbit, its curve filling the lower part of the window as before. ${NONE}`,
};

const MOVE = 'The pad never leaves the picture: it stays in view the whole time, getting smaller as it goes down onto the desk, and ' +
  'the clip ends exactly on the second picture. Through the window, ' + PLANET + '. No figurines, no statues, no dolls. The pad keeps exactly the same shape, size and proportions the whole time; it never bends, splits or morphs; the screen ' +
  'stays one flat pure bright green, evenly lit, with nothing shown on it. His hands keep five fingers each. Natural hand-held ' +
  `first-person camera, no cuts. ${NONE}`;

export const CLIPS = [
  { id: 'won', seconds: 5,
    prompt: 'First-person point of view. He lowers the data pad he has been holding up in front of his eyes: the pad moves down and ' +
      'away from the camera, and as it goes his long black console desk and the long window onto the planet come into view. ' +
      `He sets the pad down calmly and gently flat on the desk and lets go of it, his hand resting beside it, and his gaze stays on it. ` +
      'His eyes follow the pad all the way down: the camera tilts down with it, so the whole pad, all four of its corners, stays ' +
      `near the middle of the picture every moment, never slipping below the bottom edge. ${MOVE}` },
  { id: 'lost', seconds: 5,
    prompt: 'First-person point of view. Tired and defeated, he drops his arms: the data pad he has been holding up in front of his eyes ' +
      'falls away from the camera, and as it goes his long black console desk and the long window onto the planet come into view. ' +
      'He lets the pad drop the last few centimetres flat onto the desk with a heavy tired toss; it lands flat and slides a little, ' +
      `then lies still, and his hand comes down flat on the desk beside it and stays there, heavy. ${MOVE}` },
];

// PAD_TAKE=<name>: a trial take beside the kept one (art-src/pad/<id>-<name>.mp4), to compare video models.
const clipFile = (c) => path.join(DIR, `${c.id}${process.env.PAD_TAKE ? `-${process.env.PAD_TAKE}` : ''}.mp4`);

export async function makeStills() {
  fs.mkdirSync(DIR, { recursive: true });
  await makeStill({ slug: 'pad start', out: START.file, prompt: START.prompt, key: null, width: 1280, height: 720, quality: 'high',
    refFiles: [path.join(CONCEPTS, 'hero-behind-desk.png')] });
  await makeStill({ slug: 'pad end', out: END.file, prompt: END.prompt, key: null, width: 1280, height: 720, quality: 'high',
    refFiles: [END.base, MENU_PLANET] });
}

export async function makePad({ bakeOnly = false, stillsOnly = false, only = [] } = {}) {
  if (!bakeOnly) {
    await makeStills();
    if (stillsOnly) return [];
    await Promise.all(CLIPS.filter((c) => !only.length || only.includes(c.id)).map((c) => makeClip({
      slug: `pad ${c.id}`, stillFile: START.file, endFile: END.file, prompt: c.prompt, seconds: c.seconds, out: clipFile(c),
      raw: true, resolution: '720p', aspect: '16:9',
    })));
    if (process.env.PAD_TAKE) return []; // a trial take is looked at, not baked
  }
  const { bakePad } = await import('./pad-bake.mjs');
  return bakePad(CLIPS.filter((c) => fs.existsSync(clipFile(c)) && (!only.length || only.includes(c.id))).map((c) => ({ id: c.id, file: clipFile(c) })));
}

export { DIR, OUT, LOOK, W, H, FPS };
