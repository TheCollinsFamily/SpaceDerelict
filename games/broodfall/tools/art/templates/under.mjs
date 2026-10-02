/**
 * THE ORGAN STAGE AS A SCAN (Collins, Sep 29 2026, of notes/concepts/2026-09-29-organ-stage/
 * 1-scanner-board.png: "go with the scanner board design, it looks AWESOME and could be grown
 * up with like a blink or scan"). The player looks under the city through the ship's
 * ground-penetrating scan: black, faint strata, organs in false colour.
 *
 * One square TILE per thing that can fill a cell: every organ, soil at four depths, rock,
 * every deposit (and the unknown "?"), every feature. The game repeats an organ's tile over
 * its footprint and draws the outline of the whole shape itself, so that a shape reads as
 * one body at any size and turned any way. The meteor is one picture of its 3 by 2 cells.
 * The city skyline and the depth ruler are drawn by the game (thin lines stay sharp).
 *
 *   node tools/art/make.mjs under            the pictures that are missing, then the bake
 *   node tools/art/make.mjs under --bake     bake again (free)
 *
 * A tile is a medium-quality still: it is seen about 60 pixels wide.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool } from '../rfab.mjs';
import { readImage, resize, toWebp, writeJpg, writePng, blank, paste } from '../lib/img.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';

const DIR = path.join(SRC, 'under');
const OUT = path.join(ART, 'under');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29-organ-stage');
export const REFS = [path.join(CONCEPTS, '1-scanner-board.png'), path.join(CONCEPTS, '1-scanner-organs.png')];

const SCAN =
  'One single square cell of a ground-penetrating scan display on the console of a far-future spaceship, ' +
  'exactly in the rendering of the reference pictures: a near-black background, faint cold strata, a fine ' +
  'glowing false-colour image, slightly luminous, crisp. Seen exactly from the front, flat, no perspective. ' +
  'It fills the WHOLE square picture edge to edge: no border, no frame, no outline, no rounded corners, no ' +
  'margin, no grid lines. No text, no numbers, no letters, no labels, no religious symbol.';

const TISSUE = (look) =>
  `${SCAN} The square is entirely filled with the living tissue of a creature's organ, seen in the scan: ${look}. ` +
  'The tissue continues past every edge of the picture, as if this square were cut from a larger organ, so that ' +
  'squares of it laid side by side join up. It glows softly in its own colour against the dark.';

/** Every tile: its id and what it shows. Organ ids are those of content/underground.ts. */
export const TILES = {
  // ---- theme organs: one accent each (assets/style-bible.md, "One flesh, nine accents")
  forge: TISSUE('pale ivory bone growing in branching spurs and trabecular struts, warm cream glow'),
  venom: TISSUE('swollen round acid yellow-green glands packed together, glowing lime green, with a drip'),
  gut: TISSUE('coiled dark wine-red intestine, ribbed and wet, deep crimson glow'),
  nerve: TISSUE('pale blue-white nerve cords branching like lightning from a bright node, icy blue glow'),
  lattice: TISSUE('glassy translucent teal mucus stretched in a web of thin strands, cool cyan glow'),
  womb: TISSUE('clusters of glossy pink eggs in pink membrane, rose glow'),
  marrow: TISSUE('amber marrow in honeycomb chambers of bone, warm orange-gold glow'),
  resonance: TISSUE('violet membrane with concentric rings like a drum skin vibrating, purple glow'),
  // ---- zones and tissue
  heart: TISSUE('dense crimson heart muscle with coronary vessels, a strong red glow'),
  brain: TISSUE('folded pale pink-grey brain tissue with fine blood vessels, soft mauve glow'),
  gland: TISSUE('a single teal-green gland with ducts, oozing, sea-green glow'),
  atrophy: TISSUE('shrivelled, withered grey-brown dead tissue, cracked and dim, almost no glow'),
  root: TISSUE('a thick maroon tendril root with fine root hairs, running from edge to edge, dull red glow'),
  // ---- creep organs: they make the creep nodes; a pale yellow-green family
  bladder: TISSUE('a taut pale green spore bladder full of small round spores, soft green glow'),
  pacemaker: TISSUE('a knot of orange muscle fibres like a pacemaker node, pulsing orange glow'),
  mule: TISSUE('a cluster of small pale green-yellow egg sacs, each with a curled sleeping walker inside and a spore pod on its back, soft yellow-green glow'),
  infestor: TISSUE('a single large dark violet cyst with a heavy armoured larva curled inside it, a ridged burrowing head pressed against the cyst wall, thick veins feeding it, faint purple glow'),
  harrier: TISSUE('a slim pale yellow gland like a quiver, a row of lean long-legged hunters folded inside it, each with a long quill spine along its back, soft amber glow'),
  budder: TISSUE('pale green buds sprouting from tissue like a cluster of small shoots, light green glow'),
  cyst: TISSUE('a hard olive-green cyst packed with three dark seeds, olive glow'),
  swell: TISSUE('light green swollen tissue puffed up like a blister, pale green glow'),
  catapult: TISSUE('tan sinews twisted under tension like the spring of a catapult, sand-coloured glow'),
  mire: TISSUE('murky green slime with bubbles, dark swamp-green glow'),
  acid: TISSUE('yellow acid lining, corroded and pitted, sulphur-yellow glow'),
  runner: TISSUE('a green tube of muscle running straight from edge to edge like a hose, green glow'),
  // ---- the organs that give the surface free things
  scaffold: TISSUE('ivory bone scaffolding: upright struts and cross-braces of bone with pads of callus, cream glow'),
  seeder: TISSUE('a ribbed bone launch tube pointing straight UP, a dark bore in its middle and a small red limb seed inside it ready to be fired upward, rings of muscle round it, red-orange glow'),
  // ---- the ground
  'soil-0': `${SCAN} Only soil in the scan: near-black with faint horizontal strata lines and fine speckle, a little warmer brown in tone, very dim. Nothing else.`,
  'soil-1': `${SCAN} Only soil in the scan: near-black with faint horizontal strata lines and fine speckle, very dim. Nothing else.`,
  'soil-2': `${SCAN} Only deep soil in the scan: black with a few faint strata lines and pale speckle, very dim, slightly bluer. Nothing else.`,
  'soil-3': `${SCAN} Only deepest soil in the scan: black, faintest strata, cold blue-grey speckle, very dim. Nothing else.`,
  rock: `${SCAN} Only bedrock in the scan: a hard return: grey-white cracked stone texture with bright crack lines, cold grey glow, filling the square.`,
  // ---- the dig: deposits (seen) and the unknown
  unknown: `${SCAN} Only soil, near-black and dim, and in its middle a small faint diamond outline with a blurred unresolved speck inside it: an unidentified return.`,
  carrion: `${SCAN} A pocket of carrion in the soil: a buried mass of old flesh and bones glowing dull orange-red in the dark soil.`,
  seam: `${SCAN} A seam of carrion running across the soil in bands: layered compressed flesh glowing orange-red.`,
  lab: `${SCAN} An abandoned underground research laboratory of an insect civilisation, seen in the scan: a small chamber with glassware, a round porthole door and a workbench, glowing teal-cyan.`,
  bed: `${SCAN} A bed of biomass: a buried layer of soft green growing matter and fungus threads glowing green.`,
  ossuary: `${SCAN} An ancient royal tomb of an insect queen, seen in the scan: a small vaulted chamber with a sarcophagus and a plain hexagon emblem, glowing gold. No cross, no star.`,
  cache: `${SCAN} A gene cache: a cluster of crystalline capsules with helix-like fibres inside, glowing violet.`,
  // ---- features
  vent: `${SCAN} A geothermal vent in the rock: a crack with heat rising, glowing orange-red plume in the dark.`,
  aquifer: `${SCAN} An aquifer: a pocket of underground water with ripples, glowing cool blue.`,
  cable: `${SCAN} A severed power main: a thick buried cable cut through, sparking, glowing yellow-white.`,
  sewer: `${SCAN} A sewer main: a round concrete pipe seen end-on with sludge in it, glowing murky green.`,
};

const METEOR =
  'A picture 3 wide and 2 high of a ground-penetrating scan display on a far-future spaceship, exactly in the ' +
  'rendering of the reference pictures: near-black, fine false-colour glow. It shows the buried half of a split ' +
  'meteor, its top edge flush with the top edge of the picture, the meteor a dark cracked dome of rock lines ' +
  'filling the picture, with inside it a glowing red heart of muscle and red veins spreading into the rock. ' +
  'It fills the whole picture edge to edge: no border, no frame, no text, no letters.';

export async function makeUnder({ bakeOnly = false, only } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  if (!bakeOnly) {
    const want = (id) => !only?.length || only.includes(id);
    const jobs = Object.entries(TILES).filter(([id]) => want(id)).map(([id, prompt]) => () => makeStill({
      slug: `scan tile ${id}`, out: path.join(DIR, `${id}.png`), prompt, key: null, refFiles: REFS,
      width: 1024, height: 1024, quality: 'medium',
    }));
    if (want('meteor')) jobs.push(() => makeStill({
      slug: 'scan meteor', out: path.join(DIR, 'meteor.png'), prompt: METEOR, key: null, refFiles: REFS,
      width: 1536, height: 1024, quality: 'medium',
    }));
    const results = await pool(jobs, 4, (j) => j());
    results.forEach((r) => { if (!r.ok) console.warn(`[under] a picture failed: ${r.error.message.slice(0, 200)}`); });
  }
  return bakeUnder();
}

/** Each tile to a small WebP; one contact sheet to look at; the manifest entry. */
export function bakeUnder() {
  fs.mkdirSync(OUT, { recursive: true });
  const S = 160;
  const tiles = {};
  const kept = [];
  for (const id of Object.keys(TILES)) {
    const file = path.join(DIR, `${id}.png`);
    if (!fs.existsSync(file)) continue;
    const img = resize(readImage(file), S, S);
    const png = path.join(OUT, `${id}.png`);
    writePng(png, img);
    toWebp(png, path.join(OUT, `${id}.webp`), { q: 84 });
    fs.rmSync(png);
    tiles[id] = `under/${id}.webp`;
    kept.push(img);
  }
  let meteor = null;
  const mf = path.join(DIR, 'meteor.png');
  if (fs.existsSync(mf)) {
    const img = resize(readImage(mf), 3 * S, 2 * S);
    const png = path.join(OUT, 'meteor.png');
    writePng(png, img);
    toWebp(png, path.join(OUT, 'meteor.webp'), { q: 84 });
    fs.rmSync(png);
    meteor = 'under/meteor.webp';
  }
  const cols = 8;
  const sheet = blank(cols * S, Math.ceil(kept.length / cols) * S, [0, 0, 0, 255]);
  kept.forEach((t, i) => paste(sheet, t, (i % cols) * S, Math.floor(i / cols) * S));
  fs.mkdirSync(path.join(REVIEW, 'under'), { recursive: true });
  if (kept.length) writeJpg(path.join(REVIEW, 'under', 'tiles.jpg'), sheet, 3);
  // Keep what bakeAbove wrote (skylines, dome).
  putEntry('under', 'scan', { ...readManifestUnder(), tile: S, tiles, meteor });
  console.log(`[under] ${Object.keys(tiles).length} tiles${meteor ? ' and the meteor' : ''} baked to ${OUT}`);
  return { tiles, meteor };
}

// ---------------------------------------------------------------- above the street line

/**
 * THE CITY ABOVE, per tile set: the skyline along the top of the scan is the board's own
 * kind of place, as a thin glowing wireframe (Sep 29 2026: it was one fixed silhouette).
 * Drawn on black and blended by the game with 'screen', so no key colour is needed.
 */
export const SKYLINES = {
  orthodox: 'rows of blocky insect-city buildings of three heights with round onion domes on paper drums and a slender bell spire',
  suburb: 'a street of small family houses with pitched roofs, chimneys, porches, a round water tower on legs and garden trees',
  megacity: 'a dense wall of very tall slim towers and capsule blocks, antenna masts and one giant spire, crowded and high',
  orient: 'temples and houses with tiers of upswept eaves, a tall many-tiered pagoda, lanterns strung between roofs',
  industrial: 'factory sheds with saw-tooth roofs, tall smokestacks with thin smoke, gantry cranes and round storage tanks',
  farmland: 'open prairie: long low hills, a big red-barn shape, two round silos, a wind pump, fences and a few lone trees',
  // The first one put a cross on every tomb: the tombs of this city are topped with plain balls and hexagons.
  necropolis: 'a city of the dead: low flat-roofed tombs, small domed mausoleums each topped with a plain round ball, plain obelisks with pointed tops, tall slender cypress-like trees and long walls of round niches. NOTHING on any roof, dome or gable is a cross: no crosses anywhere, no stars, no crescents',
  deephive: 'a grown hive: great rounded combs and mounds like termite towers, hanging queen cells, no straight lines',
  terraces: 'rolling hills stepped into terraces, hedgerows, clumps of big round trees, a single field shelter and a haystack',
  wetland: 'houses on tall stilts over flat water, reed beds, a boardwalk, a small wind turbine and long flat horizon',
};
const SKY = (look) =>
  'A very wide, low strip of a ground-penetrating scan display on a far-future spaceship, in the rendering of the ' +
  'reference pictures: pure black background, drawn only in thin glowing pale cyan-grey wireframe lines, like ' +
  `a holographic outline. It shows the skyline above ground as a silhouette in outline: ${look}. All of it stands ` +
  'on one straight horizontal ground line across the whole width, at exactly two thirds of the way down the ' +
  'picture; above the skyline and below the line is pure black. The middle fifth of the width, directly above ' +
  'the centre, is EMPTY: nothing is drawn there. No text, no numbers, no letters, no religious symbol.';

export async function makeSkylines() {
  fs.mkdirSync(DIR, { recursive: true });
  const jobs = Object.entries(SKYLINES).map(([id, look]) => () => makeStill({
    slug: `scan skyline ${id}`, out: path.join(DIR, `sky-${id}.png`), prompt: SKY(look), key: null, refFiles: REFS,
    width: 1536, height: 1024, quality: 'medium',
  }));
  const results = await pool(jobs, 4, (j) => j());
  results.forEach((r) => { if (!r.ok) console.warn(`[under] a skyline failed: ${r.error.message.slice(0, 200)}`); });
  return bakeAbove();
}

/**
 * The skylines cut to the band that holds them (the rows that have light in them), and the
 * dome: the meteor above the street line, cut from the approved concept picture itself.
 */
export function bakeAbove() {
  fs.mkdirSync(OUT, { recursive: true });
  const skylines = {};
  for (const id of Object.keys(SKYLINES)) {
    const file = path.join(DIR, `sky-${id}.png`);
    if (!fs.existsSync(file)) continue;
    const img = readImage(file);
    // The band: from the first row with light in it to the ground line (the brightest long row).
    let top = -1, ground = -1, most = 0;
    for (let y = 0; y < img.h; y++) {
      let lit = 0;
      for (let x = 0; x < img.w; x++) {
        const i = (y * img.w + x) * 4;
        if (img.data[i] + img.data[i + 1] + img.data[i + 2] > 150) lit++;
      }
      if (lit > img.w * 0.01 && top < 0) top = y;
      if (lit > most) { most = lit; ground = y; }
    }
    if (top < 0 || ground <= top) continue;
    const y0 = Math.max(0, top - 6);
    const h = Math.min(img.h - y0, ground + 4 - y0);
    const band = resize(cropRows(img, y0, h), 1536, 160);
    const png = path.join(OUT, `sky-${id}.png`);
    writePng(png, band);
    toWebp(png, path.join(OUT, `sky-${id}.webp`), { q: 84 });
    fs.rmSync(png);
    skylines[id] = `under/sky-${id}.webp`;
  }
  let dome = null;
  const concept = path.join(CONCEPTS, '1-scanner-board.png');
  if (fs.existsSync(concept)) {
    const img = readImage(concept);
    // The meteor above the street line, exactly as the approved concept draws it.
    const cut = { w: 360, h: 124, data: Buffer.alloc(360 * 124 * 4) };
    for (let y = 0; y < 124; y++) img.data.copy(cut.data, y * 360 * 4, (y * img.w + 588) * 4, (y * img.w + 948) * 4);
    const png = path.join(OUT, 'dome.png');
    writePng(png, resize(cut, 720, 248));
    toWebp(png, path.join(OUT, 'dome.webp'), { q: 88 });
    fs.rmSync(png);
    dome = 'under/dome.webp';
  }
  const m = readManifestUnder();
  putEntry('under', 'scan', { ...m, skylines, dome });
  // To look at: every skyline stacked, the dome at the top.
  const sheet = blank(1536, 160 * Object.keys(skylines).length, [0, 0, 0, 255]);
  Object.keys(skylines).forEach((id, i) => paste(sheet, readImage(path.join(OUT, `sky-${id}.webp`)), 0, i * 160));
  if (Object.keys(skylines).length) writeJpg(path.join(REVIEW, 'under', 'skylines.jpg'), sheet, 3);
  console.log(`[under] ${Object.keys(skylines).length} skylines${dome ? ' and the dome' : ''} baked`);
  return { skylines, dome };
}

function cropRows(img, y0, h) {
  const out = { w: img.w, h, data: Buffer.alloc(img.w * h * 4) };
  img.data.copy(out.data, 0, y0 * img.w * 4, (y0 + h) * img.w * 4);
  return out;
}

function readManifestUnder() {
  const f = path.join(ART, 'manifest.json');
  const m = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  return m.under?.scan ?? {};
}
