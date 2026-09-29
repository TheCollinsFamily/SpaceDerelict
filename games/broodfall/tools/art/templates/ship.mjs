/**
 * THE SHIP TEMPLATE: everything the ship's screens show.
 *
 *   rooms      one photoreal backdrop per room, the character seen from behind
 *   yoke       the AI's six faces, cut from the sheet Collins approved
 *   planet     the map of the planet, for the holographic globe the game draws
 *   sketches   the character's own drawings, for his hobby notebook
 *   leaders    the three faction leaders, as 1950s film stills
 *   exterior   the ship in orbit, for the title screen
 *
 *   node tools/art/make.mjs ship                 everything
 *   node tools/art/make.mjs ship rooms planet    some of it
 *   node tools/art/make.mjs ship --bake          bake again from the pictures on disk (free)
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool } from '../rfab.mjs';
import { blank, crop, paste, readImage, resize, toWebp, writePng } from '../lib/img.mjs';
import { cutGrid } from '../lib/sheet.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';

const DIR = path.join(SRC, 'ship');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const REAL = 'Photoreal and lifelike, like a frame from a serious hard science-fiction film shot on a real set.';
const EMPIRE =
  'a far-future, ultra-religious, ascetic human society that despises luxury and decoration, forbids images and ' +
  'idols, and is obsessed with efficiency and ever more advanced technology';
const AUSTERE =
  'Extremely advanced technology and extreme plainness: seamless matte black composite and bare pale ceramic, ' +
  'flush seams, exact edges, perfect order, even white light from flush strips. Nothing soft, nothing ' +
  'ornamental: no pictures, no statues, no patterns, no coloured accent lighting. The only marking anywhere is ' +
  'one small plain black gear symbol (a cogwheel).';
const HERO =
  'a slight young man of about twenty-five with short untidy dark hair, in a plain black high-collared garment ' +
  'with a narrow white collar, its sleeves pushed up to the elbows, a stylus tucked behind one ear';
const BEHIND = `He is seen from directly behind, so that we never see his face: ${HERO}.`;
const ROOM = (what) =>
  `${REAL} A wide view inside a small orbital vessel belonging to ${EMPIRE}. ${AUSTERE} ${what} The middle and ` +
  'the right of the picture are calm, dark and uncluttered. No readable text anywhere.';

const ROOMS = {
  desk: ROOM('A bare dark room for planning. Low in the left third of the picture stands a round black projection plinth, waist high, its top glowing faintly; the air above it is empty and dark. ' + BEHIND + ' He stands in the foreground at the far left edge, looking at the plinth. The room is lit only by the faint glow of the plinth.'),
  genes: ROOM('The culture bay, a clean laboratory. At the far left stands a sealed transparent cylinder of clear fluid in which a round red organic culture the size of a football floats, tended by thin precise robotic arms: the only coloured thing in the room. ' + BEHIND + ' He stands beside it at the left, watching it, a thin tablet in his hand.'),
  locker: ROOM('His own corner of the ship: a specimen locker. At the left, a wall of small flush drawers, a few open, holding sealed glass jars with pale insect specimens and scraps of red tissue. A narrow work shelf holds a neat row of small things he made himself from spare parts: a gear puzzle, a tiny wire insect, a cup with cooling fins, a palm-sized orrery. ' + BEHIND + ' He sits on a plain stool at the left, bent over the shelf, working on something small.'),
  board: ROOM('A bare, formal alcove for official business. At the left, one standing terminal grown seamlessly out of the wall, with a single razor-thin display showing ruled lines of a form. One plain black gear symbol is set in the wall above it. ' + BEHIND + ' He stands at the terminal at the left, straight-backed, hands at his sides.'),
  comms: ROOM('The communications alcove. At the left, a bank of three razor-thin displays showing soft static and signal traces in white, and a plain ribbed antenna coupling in the ceiling. A long window slit shows the curve of a green and brown planet. ' + BEHIND + ' He sits at the left on a hard bench facing the displays, one hand on a dial.'),
  ai: ROOM('The core of the ship\'s artificial intelligence. At the left, a low black projection dais with a ring of faint white light on its top; the air above it is empty. Behind it, rows of plain black processing columns recede into the dark. ' + BEHIND + ' He stands at the far left edge, relaxed, one hand in a pocket, facing the dais.'),
};

const PLANET =
  'A map of a whole planet in equirectangular projection, filling the picture edge to edge with no border: the ' +
  'left and right edges are the same meridian. An Earth-like world seen from orbit with no clouds: several ' +
  'irregular continents of green lowland, brown upland and pale desert, with mountain ranges, river valleys and ' +
  'coastlines in fine relief, set in dark blue seas, with small white ice caps along the top and bottom edges. ' +
  'No text, no labels, no grid lines, no borders drawn on it.';

const EXTERIOR =
  `${REAL} A small orbital vessel in orbit above a green and brown planet at the edge of night, seen from a ` +
  `distance. It belongs to ${EMPIRE}. A plain pale cylinder standing upright with one slowly rotating ring around ` +
  'its middle and two broad flat black panels. Bare pale ceramic and matte black, flush seamless panels, no ' +
  'ornament, no lit windows, one plain black gear symbol (a cogwheel) on the hull. Sunlight rakes across it; city ' +
  'lights glow faintly on the dark side of the planet below. The ship is in the right half of the picture; the ' +
  'left half is dark space and the curve of the planet. No readable text.';

const PEOPLE =
  'an insect person like those of a 1950s science-fiction film: human posture and body language, four arms with ' +
  'small hands, an insect head with large expressive eyes, small mandibles like a mouth and antennae that move ' +
  'like eyebrows, dark umber chitin and pale amber eyes instead of skin';
const FILM = 'A waist-up film still from a 1950s colour science-fiction film: saturated Technicolor, theatrical lighting, film grain, the slight softness of old lenses. No readable text, no crosses, no stars, no crescents.';
const LEADERS = {
  delegation: `${FILM} The chief of a peace delegation: ${PEOPLE}; elderly, beaming with serene joy, in a cardigan and a flower garland, hands clasped, in a soft pastel meeting room.`,
  faithful: `${FILM} A radio preacher: ${PEOPLE}; stern and ecstatic, in dark robes, leaning into a big ribbon microphone in a broadcasting booth, a red lamp glowing beside him.`,
  institute: `${FILM} A young prodigy: ${PEOPLE}; smug and distracted, messy antennae, in a wrinkled t-shirt, slouched in a beanbag chair holding a game controller, a blackboard of equations and empty takeaway boxes behind him.`,
};

const SKETCH_STYLE =
  'Each is a quick, confident, funny pen sketch by a young, nerdy technician: white ink lines on a plain flat ' +
  'black background, a little shaky, with arrows, exclamation marks and question marks, and scribbles standing ' +
  'in for handwriting. The insects are small cartoon beetles and wasps in helmets and hats. No readable words, ' +
  'no numbers, no frames or boxes round the sketches, no paper.';
/** id: the experiment's or dare's id in content/campaign.ts. */
const SKETCHES = {
  experiments: [
    { id: 'puppet-queen', look: 'a big insect queen in a crown inside a cage trap, with puppet strings rising from her head to a hand above, and an arrow pointing back at a crowd of tiny soldiers' },
    { id: 'love-gas', look: 'a plant-like gland puffing a cloud full of little hearts, and two tiny insect soldiers holding hands inside the cloud' },
    { id: 'follow-courier', look: 'a small insect running away carrying a specimen jar with a lump inside, leaving a dotted trail that ends at a big question mark' },
    { id: 'nursery', look: 'a long strip of flames running along the ground through an archway, with tiny eggs on the far side and an exclamation mark' },
    { id: 'royal-diet', look: 'a big round toothed mouth on a stalk with a tiny crown drawn above it and a small knife and fork beside it' },
  ],
  dares: [
    { id: 'creep-finale', look: 'a puddle of slime with a skull above it and a crossed-out gun' },
    { id: 'big-boy', look: 'one enormous muscular arm flexing, covered in many small badges, with stars round it' },
    { id: 'forest', look: 'a whole forest of small tentacles and stalks packed side by side like trees' },
    { id: 'only-spitters', look: 'a row of identical little spitting nozzles on stalks, all spitting at once' },
    { id: 'no-eating', look: 'a knife and fork with a big cross drawn through them' },
    { id: 'everything-burns', look: 'a crowd of tiny insects all on fire, running in every direction' },
    { id: 'pacifist', look: 'a plant-like stalk holding a flower and making a peace sign, with a halo drawn above it' },
    { id: 'let-them-in', look: 'an open door with a welcome mat and tiny insects marching in through it' },
    { id: 'zoo', look: 'a row of five different little plant-like creatures in a row of cages, like a zoo, each with a name tag' },
  ],
};

const want = (only, id) => !only?.length || only.includes(id);

async function generate(only) {
  const jobs = [];
  const refs = [path.join(CONCEPTS, 'r3-ship-operations-black.png'), path.join(CONCEPTS, 'hero-behind-desk.png')];
  if (want(only, 'rooms')) {
    for (const [id, prompt] of Object.entries(ROOMS)) {
      jobs.push(() => makeStill({ slug: `room ${id}`, out: path.join(DIR, `room-${id}.png`), prompt, key: null, width: 1536, height: 1024, quality: 'high', refFiles: refs }));
    }
  }
  if (want(only, 'planet')) jobs.push(() => makeStill({ slug: 'planet', out: path.join(DIR, 'planet.png'), prompt: PLANET, key: null, width: 1536, height: 1024, quality: 'high' }));
  if (want(only, 'exterior')) jobs.push(() => makeStill({ slug: 'exterior', out: path.join(DIR, 'exterior.png'), prompt: EXTERIOR, key: null, width: 1536, height: 1024, quality: 'high', refFiles: [path.join(CONCEPTS, 'r3-ship-exterior-ring.png')] }));
  if (want(only, 'leaders')) {
    for (const [id, prompt] of Object.entries(LEADERS)) {
      jobs.push(() => makeStill({ slug: `leader ${id}`, out: path.join(DIR, `leader-${id}.png`), prompt, key: null, width: 1024, height: 1024, quality: 'medium', refFiles: [path.join(CONCEPTS, 'r2-faction-leaders.png')] }));
    }
  }
  if (want(only, 'sketches')) {
    for (const [set, list] of Object.entries(SKETCHES)) {
      jobs.push(() => makeStill({
        slug: `sketches ${set}`, out: path.join(DIR, `sketches-${set}.png`), key: null, width: 1536, height: 1024, quality: 'medium',
        refFiles: [path.join(CONCEPTS, 'r4-hobby-interface.png')],
        prompt: `A sheet of ${list.length} separate small sketches in ${list.length <= 5 ? 'one row' : 'three rows of three'}, evenly spaced, well apart and not touching. ${SKETCH_STYLE} In reading order: ${list.map((s, i) => `(${i + 1}) ${s.look}`).join('; ')}.`,
      }));
    }
  }
  const results = await pool(jobs, 6, (j) => j());
  results.forEach((r) => { if (!r.ok) console.warn(`[ship] a picture failed: ${r.error.message.slice(0, 200)}`); });
}

const save = (img, file, q = 86) => {
  const png = file.replace(/\.webp$/, '.png');
  writePng(png, img);
  toWebp(png, file, { q });
  fs.rmSync(png);
  return fs.statSync(file).size;
};

/** Make a picture's background pure black, so that adding it to the screen adds nothing there. */
function blackPoint(img, level) {
  const out = blank(img.w, img.h);
  for (let i = 0; i < img.data.length; i += 4) {
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.max(0, Math.min(255, Math.round(((img.data[i + k] - level) * 255) / (255 - level))));
    out.data[i + 3] = 255;
  }
  return out;
}

/** The right edge of a map blended into its left edge, so the globe has no seam. */
function wrap(img, band = 0.06) {
  const out = { w: img.w, h: img.h, data: Buffer.from(img.data) };
  const b = Math.round(img.w * band);
  for (let y = 0; y < img.h; y++) for (let x = img.w - b; x < img.w; x++) {
    const t = (x - (img.w - b)) / b;
    const s = t * t * (3 - 2 * t);
    const a = (y * img.w + x) * 4;
    const m = (y * img.w + (img.w - 1 - x)) * 4;
    for (let k = 0; k < 3; k++) out.data[a + k] = Math.round(img.data[a + k] * (1 - s) + img.data[m + k] * s);
  }
  return out;
}

export function bakeShip() {
  const out = path.join(ART, 'ship');
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(path.join(REVIEW, 'ship'), { recursive: true });
  const entry = { rooms: {}, leaders: {} };
  let total = 0;
  for (const id of Object.keys(ROOMS)) {
    const file = path.join(DIR, `room-${id}.png`);
    if (!fs.existsSync(file)) continue;
    total += save(readImage(file, { w: 1536, h: 1024 }), path.join(out, `room-${id}.webp`), 84);
    entry.rooms[id] = `ship/room-${id}.webp`;
  }
  for (const id of Object.keys(LEADERS)) {
    const file = path.join(DIR, `leader-${id}.png`);
    if (!fs.existsSync(file)) continue;
    total += save(readImage(file, { w: 512, h: 512 }), path.join(out, `leader-${id}.webp`), 84);
    entry.leaders[id] = `ship/leader-${id}.webp`;
  }
  if (fs.existsSync(path.join(DIR, 'exterior.png'))) {
    total += save(readImage(path.join(DIR, 'exterior.png'), { w: 1536, h: 1024 }), path.join(out, 'exterior.webp'), 84);
    entry.exterior = 'ship/exterior.webp';
  }
  if (fs.existsSync(path.join(DIR, 'planet.png'))) {
    // The model draws at 3:2; a map of a whole planet is 2:1.
    total += save(wrap(readImage(path.join(DIR, 'planet.png'), { w: 1024, h: 512 })), path.join(out, 'planet.webp'), 88);
    entry.planet = 'ship/planet.webp';
  }
  // YOKE: the six faces of the sheet Collins approved, three across and two down.
  const yoke = path.join(CONCEPTS, 'r4-yoke-expressions.png');
  if (fs.existsSync(yoke)) {
    const img = readImage(yoke);
    const names = ['calm', 'curious', 'amused', 'concerned', 'thinking', 'sad'];
    const w = Math.floor(img.w / 3);
    const h = Math.floor(img.h / 2);
    const sheet = blank(3 * 384, 2 * 384, [0, 0, 0, 255]);
    names.forEach((n, i) => paste(sheet, resize(blackPoint(crop(img, (i % 3) * w, Math.floor(i / 3) * h, w, h), 14), 384, 384), (i % 3) * 384, Math.floor(i / 3) * 384));
    total += save(sheet, path.join(out, 'yoke.webp'), 90);
    entry.yoke = { atlas: 'ship/yoke.webp', frame: 384, cols: 3, faces: names };
  }
  // His sketches: white ink on black becomes ink with no background.
  const sketches = [];
  for (const [set, list] of Object.entries(SKETCHES)) {
    const file = path.join(DIR, `sketches-${set}.png`);
    if (!fs.existsSync(file)) continue;
    const img = readImage(file);
    // A sketch is loose strokes, not one blob: the sheet is cut as the grid it was asked for.
    const [cols, rows] = list.length <= 5 ? [list.length, 1] : [3, Math.ceil(list.length / 3)];
    const { cells } = cutGrid(img, cols, rows);
    list.forEach((s, i) => {
      const c = cells[i];
      // The ink inside this sketch's own cell, squared up with a little margin.
      const cell = crop(img, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, [0, 0, 0, 255]);
      let x0 = cell.w, y0 = cell.h, x1 = 0, y1 = 0;
      for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) {
        const p = (y * cell.w + x) * 4;
        if (Math.max(cell.data[p], cell.data[p + 1], cell.data[p + 2]) > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < x0) { x0 = 0; y0 = 0; x1 = cell.w; y1 = cell.h; }
      const side = Math.ceil(Math.max(x1 - x0, y1 - y0) * 1.1);
      const one = resize(crop(cell, Math.round((x0 + x1 - side) / 2), Math.round((y0 + y1 - side) / 2), side, side, [0, 0, 0, 255]), 256, 256);
      for (let p = 0; p < one.data.length; p += 4) {
        const lum = Math.max(one.data[p], one.data[p + 1], one.data[p + 2]);
        one.data[p + 3] = Math.max(0, Math.min(255, Math.round((lum - 24) * 1.25)));
      }
      sketches.push({ id: s.id, set, img: one });
    });
  }
  if (sketches.length) {
    const cols = 5;
    const sheet = blank(cols * 256, Math.ceil(sketches.length / cols) * 256);
    sketches.forEach((s, i) => paste(sheet, s.img, (i % cols) * 256, Math.floor(i / cols) * 256));
    total += save(sheet, path.join(out, 'sketches.webp'), 90);
    entry.sketches = { atlas: 'ship/sketches.webp', frame: 256, cols, ids: sketches.map((s) => s.id) };
  }
  putEntry('ship', 'ship', entry);
  console.log(`[ship] baked: ${Object.keys(entry.rooms).length} rooms, ${Object.keys(entry.leaders).length} leaders, ${sketches.length} sketches, ${entry.yoke ? 6 : 0} faces of YOKE${entry.planet ? ', the planet' : ''}${entry.exterior ? ', the exterior' : ''}; ${Math.round(total / 1024)} KB`);
  return entry;
}

export async function makeShip({ bakeOnly = false, only } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  if (!bakeOnly) await generate(only);
  return bakeShip();
}
