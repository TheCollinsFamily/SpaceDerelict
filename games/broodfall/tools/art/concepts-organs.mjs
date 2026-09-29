/**
 * STYLE TESTS FOR THE ORGAN STAGE AND ITS DIG (Collins, Sep 29 2026: "create some tests for
 * style you were thinking with organs and digging section (I will check the folder for them)").
 * PAID: about 21,000 to 27,000 tokens a picture (1536 x 1024, quality high).
 *
 *   node tools/art/concepts-organs.mjs                     list the pictures, and which are on disk
 *   node tools/art/concepts-organs.mjs all                 make every picture that is not on disk
 *   node tools/art/concepts-organs.mjs 1-scanner-board …   make these
 *   node tools/art/concepts-organs.mjs --refs              build the reference pictures only (free)
 *   node tools/art/concepts-organs.mjs --sheet             JPEG copies and the contact sheet only (free)
 *
 * Writes notes/concepts/2026-09-29-organ-stage/<name>.png and .jpg, and contact-sheet.jpg.
 * A picture that is on disk is skipped: to draw one again, move it into `rejected/` first.
 *
 * Every picture draws THE ACTUAL ORGANS, DEPOSITS AND FEATURES of content/underground.ts, by
 * name and in their own footprints, on the actual 13 x 9 board. The board every "board"
 * picture is asked to draw is BOARD below; it is checked against the game's rules (every
 * organ touches the meteor or an organ, nothing grows in rock, a deposit is known only
 * within 2 cells of the body) before anything is paid for.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, balance, makeStill, pool, ready, spent } from './rfab.mjs';
import { blank, borderColour, over, readImage, resize, writePng } from './lib/img.mjs';
import { keyFrame, keyOf } from './lib/key.mjs';

const OUT = path.join(ROOT, 'notes', 'concepts', '2026-09-29-organ-stage');
const REFS = path.join(OUT, 'refs');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const SRC = path.join(ROOT, 'art-src');
const TMP = path.join(os.tmpdir(), 'claude', 'organs-agent');

// ───────────────────────────── the game's own data ─────────────────────────────
// Footprints as in content/underground.ts (cells [x, y], before rotation).
const SHAPES = {
  L4: [[0, 0], [0, 1], [0, 2], [1, 2]], T4: [[0, 0], [1, 0], [2, 0], [1, 1]], S4: [[1, 0], [2, 0], [0, 1], [1, 1]],
  X5: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], O4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  U5: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]], I4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  P5: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], D2: [[0, 0], [1, 0]], M1: [[0, 0]], V2: [[0, 0], [0, 1]],
  L3: [[0, 0], [1, 0], [0, 1]], I3: [[0, 0], [1, 0], [2, 0]], V3: [[0, 0], [0, 1], [0, 2]],
};

const ORGANS = {
  forge: { name: 'BONE FORGE', shape: 'L4', rgb: [232, 222, 190], accent: 'ivory bone',
    says: 'an L of four square cells (three cells in a column, and one more cell at the foot pointing right)',
    look: 'a furnace of growing bone: thick ivory ribs and spurs pushing out of the tissue round a pale hot core' },
  venom: { name: 'VENOM SAC', shape: 'T4', rgb: [176, 214, 40], accent: 'acid yellow-green glands',
    says: 'a T of four square cells (a bar of three cells lying flat, with one cell hanging under its middle)',
    look: 'swollen glands full of acid yellow-green venom, one to a cell, a drop hanging from the lowest' },
  gut: { name: 'GUT', shape: 'S4', rgb: [150, 28, 58], accent: 'dark wine red, and rows of small teeth',
    says: 'an S of four square cells (two cells side by side, and two more side by side one row lower and one column to the left)',
    look: 'a coiled gullet in dark wine red, open at one end in a ring of small pale teeth' },
  nerve: { name: 'NERVE CLUSTER', shape: 'X5', rgb: [196, 226, 255], accent: 'pale blue-white nerve cord that glows faintly',
    says: 'a plus of five square cells (one cell in the middle and one on each of its four sides: a squat puzzle piece with four short arms of equal length)',
    // Not "a cord along each arm": straight cords along the arms of a plus draw a cross.
    look: 'a knot of pale blue-white nerve glowing faintly: a fat round ganglion in the middle cell, from which many thin cords branch out in every direction like fine roots, reaching into all four arms' },
  lattice: { name: 'MUCUS LATTICE', shape: 'O4', rgb: [168, 226, 222], accent: 'glassy, translucent mucus',
    says: 'a square of four cells, two by two',
    look: 'a lattice of glassy translucent strands and membranes of mucus, clear as wet glass, stretched across the whole square' },
  womb: { name: 'BROOD WOMB', shape: 'U5', rgb: [244, 142, 176], accent: 'clusters of glossy pink eggs',
    says: 'a U of five square cells (three cells in a row along the bottom, and one cell standing on each end of that row)',
    look: 'a cradle of tissue holding clusters of glossy pink eggs, in the hollow of the U and along both its arms' },
  marrow: { name: 'MARROW VAULT', shape: 'I4', rgb: [236, 164, 44], accent: 'amber marrow',
    says: 'a straight bar of four square cells in a row',
    look: 'one long bone split open along its whole length, full of amber marrow that glows like honey' },
  resonance: { name: 'RESONANCE CHAMBER', shape: 'P5', rgb: [156, 96, 226], accent: 'taut violet membrane',
    says: 'a P of five square cells (a square of four cells, two by two, with one more cell under its left side)',
    look: 'a drum: a thin violet membrane stretched taut over a hollow chamber, rings rippling across it' },
  // NEW (being added to the game by another session; working name). Its footprint is not in
  // content/underground.ts yet: two cells, one above the other, is this script's assumption.
  scaffold: { name: 'SCAFFOLD GLAND', shape: 'V2', rgb: [206, 198, 176], accent: 'chalk-white callus on a scaffold of thin bone struts',
    says: 'a domino of two square cells, one above the other',
    look: 'a gland that casts building blocks: in its upper cell a fat knot of tissue, in its lower cell a mould in which a squat block of chalk-white callus on a scaffold of thin bone struts is half formed' },
  heart: { name: 'AUXILIARY HEART', shape: 'D2', rgb: [206, 44, 40], accent: 'bright arterial red',
    says: 'a domino of two square cells side by side', look: 'a small dark red heart with thick vessels, beating' },
  brain: { name: 'BRAIN NODE', shape: 'D2', rgb: [212, 170, 190], accent: 'pale pinkish-grey folds',
    says: 'a domino of two square cells side by side', look: 'a lobe of folded pale pinkish-grey brain tissue' },
  gland: { name: 'PHEROMONE GLAND', shape: 'M1', rgb: [79, 190, 180], accent: 'teal',
    says: 'one square cell', look: 'a round teal gland breathing out a thin teal haze' },
  atrophy: { name: 'ATROPHY GLAND', shape: 'M1', rgb: [96, 84, 82], accent: 'withered grey-black',
    says: 'one square cell', look: 'a withered grey-black knot, shrivelled and dry, the tissue round it gone pale' },
  root: { name: 'TENDRIL ROOT', shape: 'M1', rgb: [140, 60, 60], accent: 'none',
    says: 'one square cell', look: 'a thick rope of maroon root running through its cell, joining what lies on either side' },
  bladder: { name: 'SPORE BLADDER', shape: 'V2', rgb: [170, 204, 120], accent: 'pale green skin packed with spores',
    says: 'a domino of two square cells, one above the other', look: 'a swollen bladder of pale green skin packed with round spores, a single ripe pod budding from its top' },
  pacemaker: { name: 'PACEMAKER', shape: 'M1', rgb: [232, 154, 106], accent: 'orange',
    says: 'one square cell', look: 'a small hard orange knot of muscle that twitches, a pulse running out of it' },
  budder: { name: 'BUDDING GLAND', shape: 'L3', rgb: [200, 224, 160], accent: 'pale green buds',
    says: 'a small L of three square cells (two cells side by side, and one more under the left one)',
    look: 'a gland covered in small round pale green buds, like the eyes of a potato, each about to break off' },
  catapult: { name: 'CATAPULT SAC', shape: 'I3', rgb: [208, 176, 112], accent: 'a tan sinew drawn taut',
    says: 'a straight bar of three square cells in a row',
    look: 'a long sac with a thick tan sinew drawn back along it like the arm of a catapult, a green spore pod held at its end' },
  runner: { name: 'RUNNER GLAND', shape: 'V3', rgb: [160, 192, 112], accent: 'a green runner',
    says: 'a straight bar of three square cells, one above the other',
    look: 'a gland that sends out one straight green runner, like the runner of a strawberry plant, along its whole length' },
};
const PLINTH =
  'A PLINTH (not an organ: what the Scaffold Gland makes, one every two waves): a squat pedestal the size of one ' +
  'cell, of chalk-white callus on a scaffold of thin bone struts, with a flat level top, like a thick vertebra or ' +
  'the stump of a tree made of spongy bone, a little dark maroon tissue gripping its foot';

const DIG = {
  carrion: { name: 'CARRION POCKET', rgb: [255, 138, 106], look: 'a small hollow in the soil packed with long-dead insects: dry husks, wing cases and small bones, red-brown' },
  seam: { name: 'CARRION SEAM', rgb: [230, 100, 80], look: 'a rich seam of pressed carrion running across the cell like a seam of coal: layer on layer of dark red-brown remains and crushed shells' },
  lab: { name: 'UNDERGROUND RESEARCH LAB', rgb: [127, 224, 216], look: 'a small abandoned underground laboratory of the insect people: a sealed room with a round doorway shaped like a honeycomb cell, a bench, glass vessels, dead screens, and one teal emergency lamp still lit' },
  bed: { name: 'BIOMASS BED', rgb: [168, 216, 138], look: 'a thick soft bed of pale fungus, fat white roots and peat, green-white' },
  ossuary: { name: 'ANCIENT ROYAL TOMB', rgb: [255, 215, 96], look: 'the tomb of an insect queen: a small vaulted chamber of old wax and gold leaf holding a long sarcophagus shaped like the body of a queen insect, its one emblem a plain gold hexagon (the shape of a honeycomb cell)' },
  // Not "embryo": the model drew mammal embryos with heads and limbs, which read as human (rejected/).
  cache: { name: 'GENE CACHE', rgb: [214, 168, 255], look: 'a clutch of ancient amber nodules, each with one small curled insect grub preserved inside it (a larva: a plain segmented body like a bean, with no face, no arms and no legs), giving off a faint violet light' },
  cable: { name: 'SEVERED POWER MAIN', rgb: [240, 230, 120], look: 'a thick bundle of electric cables in a conduit, cut clean through, the cut ends sparking blue-white' },
  sewer: { name: 'SEWER MAIN', rgb: [110, 130, 80], look: 'a big round concrete sewer pipe seen end-on, cracked, leaking green-brown water' },
  aquifer: { name: 'AQUIFER', rgb: [70, 150, 190], look: 'a pocket of clear blue water held in gravel and sand' },
  vent: { name: 'GEOTHERMAL VENT', rgb: [230, 110, 50], look: 'a crack in the rock glowing orange with heat, a thread of steam rising from it' },
  unknown: { name: 'AN UNKNOWN DEPOSIT', rgb: [216, 200, 160], look: 'something buried that has not been identified yet: a vague blurred shape with a single question mark over it' },
  rock: { name: 'BEDROCK', rgb: [125, 125, 120], look: 'hard grey rock: nothing can be grown into it' },
};

// ───────────────────────────── the board every board picture draws ─────────────────────────────
const BW = 13, BH = 9;
const at = (shape, x, y) => SHAPES[shape].map(([dx, dy]) => [x + dx, y + dy]);
const BOARD = {
  meteor: [[5, 0], [6, 0], [7, 0], [5, 1], [6, 1], [7, 1]],
  organs: [
    { id: 'forge', cells: at('L4', 4, 0) },
    { id: 'venom', cells: at('T4', 1, 1) },
    { id: 'heart', cells: at('D2', 8, 0) },
    { id: 'gut', cells: at('S4', 6, 2) },
    { id: 'lattice', cells: at('O4', 3, 3) },
    { id: 'root', cells: [[8, 3]] }, { id: 'root', cells: [[8, 4]] }, { id: 'root', cells: [[9, 4]] },
    { id: 'nerve', cells: at('X5', 9, 4) },
  ],
  features: [{ id: 'sewer', cell: [9, 2] }],
  found: [{ id: 'carrion', cell: [1, 4] }, { id: 'lab', cell: [12, 6] }],
  unknown: [[2, 7], [6, 7]],
  rock: [[11, 2], [12, 2], [12, 3], [5, 4], [5, 5], [6, 5], [0, 5], [0, 6], [9, 7], [10, 7]],
};
function checkBoard() {
  const key = ([x, y]) => `${x},${y}`;
  const taken = new Map();
  const put = (c, what) => {
    if (c[0] < 0 || c[0] >= BW || c[1] < 0 || c[1] >= BH) throw new Error(`${what} is off the board at ${c}`);
    if (taken.has(key(c))) throw new Error(`${what} and ${taken.get(key(c))} share cell ${c}`);
    taken.set(key(c), what);
  };
  BOARD.meteor.forEach((c) => put(c, 'meteor'));
  BOARD.organs.forEach((o, i) => o.cells.forEach((c) => put(c, `${o.id}#${i}`)));
  BOARD.features.forEach((f) => put(f.cell, f.id));
  BOARD.found.forEach((f) => put(f.cell, f.id));
  BOARD.unknown.forEach((c) => put(c, 'unknown'));
  BOARD.rock.forEach((c) => { if (c[1] < 2) throw new Error(`rock in the topsoil at ${c}`); put(c, 'rock'); });
  // Every organ is joined to the meteor through organs that touch edge to edge.
  const body = [{ id: 'meteor', cells: BOARD.meteor }, ...BOARD.organs];
  const touch = (a, b) => a.cells.some(([x, y]) => b.cells.some(([u, v]) => Math.abs(x - u) + Math.abs(y - v) === 1));
  const joined = new Set([0]);
  for (let grew = true; grew;) {
    grew = false;
    body.forEach((o, i) => { if (!joined.has(i) && [...joined].some((j) => touch(o, body[j]))) { joined.add(i); grew = true; } });
  }
  body.forEach((o, i) => { if (!joined.has(i)) throw new Error(`${o.id} touches neither the meteor nor an organ`); });
  // A deposit is known within 2 cells of the body (REVEAL_RANGE), unknown further off.
  const near = (c) => body.some((o) => o.cells.some(([x, y]) => Math.max(Math.abs(x - c[0]), Math.abs(y - c[1])) <= 2));
  BOARD.found.forEach((f) => { if (!near(f.cell)) throw new Error(`${f.id} is drawn as found but is more than 2 cells from the body`); });
  BOARD.unknown.forEach((c) => { if (near(c)) throw new Error(`the unknown deposit at ${c} is within 2 cells of the body: it would be known`); });
  const grown = BOARD.organs.reduce((n, o) => n + o.cells.length, 0) + BOARD.meteor.length;
  return { grown, share: grown / (BW * BH) };
}

// ───────────────────────────── reference pictures (free) ─────────────────────────────
const W = 1536, H = 1024, CELL = 100, X0 = 118, Y0 = 124;
const MAROON = [96, 22, 34];

function rect(img, x, y, w, h, c) {
  for (let yy = Math.max(0, y); yy < Math.min(img.h, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(img.w, x + w); xx++) {
      const i = (yy * img.w + xx) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
}
function disc(img, cx, cy, r, c, onlyAbove) {
  for (let y = cy - r; y <= cy + r; y++) {
    if (onlyAbove !== undefined && y > onlyAbove) continue;
    for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) rect(img, x, y, 1, 1, c);
  }
}
const QUESTION = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];
function question(img, cx, cy, px, c) {
  QUESTION.forEach((row, r) => [...row].forEach((ch, k) => {
    if (ch === '#') rect(img, cx - Math.round(2.5 * px) + k * px, cy - Math.round(3.5 * px) + r * px, px, px, c);
  }));
}
/** One footprint: its cells filled with `fill`, a dark maroon line round its outside edge. */
function footprint(img, cells, x0, y0, cell, fill, edge = 7) {
  const has = (x, y) => cells.some(([u, v]) => u === x && v === y);
  for (const [x, y] of cells) {
    const px = x0 + x * cell, py = y0 + y * cell;
    rect(img, px, py, cell, cell, fill);
    if (!has(x, y - 1)) rect(img, px, py, cell, edge, MAROON);
    if (!has(x, y + 1)) rect(img, px, py + cell - edge, cell, edge, MAROON);
    if (!has(x - 1, y)) rect(img, px, py, edge, cell, MAROON);
    if (!has(x + 1, y)) rect(img, px + cell - edge, py, edge, cell, MAROON);
  }
}

/** The PLAN: a flat diagram of the board, for position and shape only. */
function drawBoardPlan(file) {
  const img = blank(W, H, [205, 208, 210, 255]);
  // The city along the street line: plain pale blocks, none over the meteor.
  [[20, 70, 150], [190, 100, 120], [330, 60, 170], [960, 90, 140], [1120, 60, 160], [1300, 100, 130], [1450, 70, 80]]
    .forEach(([x, h, w]) => rect(img, x, Y0 - h, w, h, [228, 216, 180]));
  for (let row = 0; row < BH; row++) {
    const t = row / (BH - 1);
    rect(img, 0, Y0 + row * CELL, W, CELL, [Math.round(107 - 56 * t), Math.round(74 - 38 * t), Math.round(44 - 13 * t)]);
  }
  rect(img, 0, Y0 - 5, W, 5, [40, 34, 30]);
  for (let x = 0; x <= BW; x++) rect(img, X0 + x * CELL, Y0, 1, BH * CELL, [30, 22, 18]);
  for (let y = 0; y <= BH; y++) rect(img, X0, Y0 + y * CELL, BW * CELL, 1, [30, 22, 18]);
  for (const [x, y] of BOARD.rock) {
    rect(img, X0 + x * CELL + 1, Y0 + y * CELL + 1, CELL - 1, CELL - 1, DIG.rock.rgb);
    rect(img, X0 + x * CELL + 14, Y0 + y * CELL + 14, CELL - 28, CELL - 28, [104, 104, 100]);
  }
  // The meteor: its buried half fills 3 x 2 cells; its other half is a dome above the street.
  const mx = X0 + 5 * CELL;
  disc(img, mx + 150, Y0, 150, [44, 42, 46], Y0 - 1);
  disc(img, mx + 150, Y0, 60, [200, 50, 40], Y0 - 1);
  footprint(img, BOARD.meteor, X0, Y0, CELL, [58, 30, 34], 9);
  disc(img, mx + 150, Y0 + 80, 58, [200, 50, 40]);
  for (const o of BOARD.organs) footprint(img, o.cells, X0, Y0, CELL, ORGANS[o.id].rgb);
  for (const f of BOARD.features) {
    const [x, y] = f.cell;
    rect(img, X0 + x * CELL + 1, Y0 + y * CELL + 1, CELL - 1, CELL - 1, DIG[f.id].rgb);
    disc(img, X0 + x * CELL + 50, Y0 + y * CELL + 50, 36, [150, 150, 140]);
    disc(img, X0 + x * CELL + 50, Y0 + y * CELL + 50, 26, [30, 36, 22]);
  }
  for (const f of BOARD.found) {
    const [x, y] = f.cell;
    rect(img, X0 + x * CELL + 18, Y0 + y * CELL + 18, CELL - 36, CELL - 36, DIG[f.id].rgb);
  }
  for (const [x, y] of BOARD.unknown) question(img, X0 + x * CELL + 50, Y0 + y * CELL + 50, 9, DIG.unknown.rgb);
  return writePng(file, img);
}

/** The PLAN of a sheet of footprints: `cols` x `rows` panels, one footprint in each. */
function drawShapePlan(file, ids, cols, rows) {
  const img = blank(W, H, [30, 30, 34, 255]);
  const pw = Math.floor(W / cols), ph = Math.floor(H / rows), cell = 64;
  ids.forEach((id, i) => {
    const px = (i % cols) * pw, py = Math.floor(i / cols) * ph;
    rect(img, px, py, pw, 2, [70, 70, 76]); rect(img, px, py, 2, ph, [70, 70, 76]);
    const cells = id === 'plinth' ? SHAPES.M1 : SHAPES[ORGANS[id].shape];
    const w = Math.max(...cells.map((c) => c[0])) + 1, h = Math.max(...cells.map((c) => c[1])) + 1;
    const x0 = px + Math.round((pw - w * cell) / 2), y0 = py + Math.round((ph - h * cell) / 2);
    if (id === 'plinth') { rect(img, x0 + 8, y0 + 14, cell - 16, cell - 14, [226, 222, 208]); rect(img, x0, y0 + 8, cell, 10, [240, 236, 224]); }
    else footprint(img, cells, x0, y0, cell, ORGANS[id].rgb, 5);
  });
  return writePng(file, img);
}

/** The body's own look in one picture: the creep, the landing site, and one limb of each theme. */
function drawTissueRef(file) {
  const S = 384;
  const pics = [
    ['terrain/creep.png', false], ['terrain/core-styled.png', true], ['limbs/impaler/styled.png', true],
    ['limbs/blighter/styled.png', true], ['limbs/maw/styled.png', true], ['limbs/frond/styled.png', true],
    ['limbs/tangler/styled.png', true], ['limbs/brood/styled.png', true], ['limbs/conduit/styled.png', true],
    ['limbs/amp/styled.png', true],
  ];
  const img = blank(S * 5, S * 2, [40, 28, 24, 255]);
  pics.forEach(([rel, keyed], i) => {
    const src = readImage(path.join(SRC, rel));
    if (keyed) keyFrame(src, keyOf(borderColour(src)), { spill: 'edge' });
    over(img, resize(src, S, S), (i % 5) * S, Math.floor(i / 5) * S);
  });
  return writePng(file, img);
}

const REF = {
  plan: path.join(REFS, 'plan-board.png'),
  organs: path.join(REFS, 'plan-organ-sheet.png'),
  organs2: path.join(REFS, 'plan-organ-sheet-2.png'),
  tissue: path.join(REFS, 'body-tissue-and-accents.png'),
  creep: path.join(SRC, 'terrain', 'creep.png'),
  globe: path.join(CONCEPTS, 'r3-ship-globe-close.png'),
  room: path.join(CONCEPTS, 'r3-ship-operations-black.png'),
  notebook: path.join(CONCEPTS, 'r4-hobby-interface.png'),
  yoke: path.join(CONCEPTS, 'r4-yoke-in-room.png'),
  city: path.join(CONCEPTS, 'city-hive-block-close.png'),
  impaler: path.join(SRC, 'limbs', 'impaler', 'styled.png'),
};
const SHEET_1 = ['forge', 'venom', 'gut', 'nerve', 'lattice', 'womb', 'marrow', 'resonance', 'scaffold', 'plinth'];
const SHEET_2 = ['heart', 'brain', 'gland', 'atrophy', 'root', 'bladder', 'pacemaker', 'budder', 'catapult', 'runner'];

// ───────────────────────────── plans of the closer views ─────────────────────────────
const GOLD = [255, 216, 120];
const soilAt = (t) => [Math.round(107 - 56 * t), Math.round(74 - 38 * t), Math.round(44 - 13 * t)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
/** Only the outside edge of a footprint, as a line. */
function outline(img, cells, x0, y0, cell, c, edge = 6) {
  const has = (x, y) => cells.some(([u, v]) => u === x && v === y);
  for (const [x, y] of cells) {
    const px = x0 + x * cell, py = y0 + y * cell;
    if (!has(x, y - 1)) rect(img, px, py, cell, edge, c);
    if (!has(x, y + 1)) rect(img, px, py + cell - edge, cell, edge, c);
    if (!has(x - 1, y)) rect(img, px, py, edge, cell, c);
    if (!has(x + 1, y)) rect(img, px + cell - edge, py, edge, cell, c);
  }
}
/** One patch of the board: soil, grid, and what lies on it. */
function patch(img, x0, y0, cell, p) {
  for (let r = 0; r < p.rows; r++) rect(img, x0, y0 + r * cell, p.cols * cell, cell, soilAt((r + (p.depth ?? 2)) / 10));
  for (const [x, y] of p.zone ?? []) rect(img, x0 + x * cell, y0 + y * cell, cell, cell, [150, 70, 84]);
  for (let x = 0; x <= p.cols; x++) rect(img, x0 + x * cell, y0, 1, p.rows * cell, [30, 22, 18]);
  for (let y = 0; y <= p.rows; y++) rect(img, x0, y0 + y * cell, p.cols * cell, 1, [30, 22, 18]);
  for (const it of p.items) {
    const c = Math.round(cell / 2);
    if (it.id === 'meteor') footprint(img, it.cells, x0, y0, cell, [58, 30, 34], 8);
    else if (it.id === 'rock') it.cells.forEach(([x, y]) => rect(img, x0 + x * cell + 1, y0 + y * cell + 1, cell - 1, cell - 1, DIG.rock.rgb));
    else if (it.id === 'unknown') it.cells.forEach(([x, y]) => question(img, x0 + x * cell + c, y0 + y * cell + c, Math.round(cell / 11), DIG.unknown.rgb));
    else if (DIG[it.id]) it.cells.forEach(([x, y]) => rect(img, x0 + x * cell + Math.round(cell * 0.18), y0 + y * cell + Math.round(cell * 0.18), Math.round(cell * 0.64), Math.round(cell * 0.64), DIG[it.id].rgb));
    else if (it.ghost) outline(img, it.cells, x0, y0, cell, GOLD);
    else footprint(img, it.cells, x0, y0, cell, it.pale ? mix(ORGANS[it.id].rgb, [150, 90, 80], 0.6) : ORGANS[it.id].rgb, Math.max(4, Math.round(cell / 14)));
  }
}
/** One or more patches side by side. */
function drawScenePlan(file, panels) {
  const img = blank(W, H, [30, 30, 34, 255]);
  const pw = Math.floor(W / panels.length);
  panels.forEach((p, k) => {
    const cell = Math.floor(Math.min((pw - 60) / p.cols, (H - 200) / p.rows));
    patch(img, k * pw + Math.round((pw - p.cols * cell) / 2), Math.round((H - p.rows * cell) / 2), cell, p);
  });
  return writePng(file, img);
}

const block = (x, y, w, h) => Array.from({ length: w * h }, (_, i) => [x + (i % w), y + Math.floor(i / w)]);
const SCENES = {
  growing: ['ghost', 'pale', 'grown'].map((stage) => ({ cols: 4, rows: 4, depth: 0, items: [
    { id: 'meteor', cells: block(2, 0, 2, 2) },
    { id: 'forge', cells: at('L4', 1, 0), ghost: stage === 'ghost', pale: stage === 'pale' },
  ] })),
  zone: [{ cols: 9, rows: 5, depth: 1, zone: block(3, 1, 4, 3).filter(([x, y]) => !(y === 2 && (x === 4 || x === 5))), items: [
    { id: 'heart', cells: at('D2', 4, 2) },
    { id: 'forge', cells: at('L4', 2, 0) },
    { id: 'gut', cells: at('S4', 5, 0) },
    { id: 'root', cells: [[5, 3]] },
    { id: 'marrow', cells: at('I4', 5, 4) },
  ] }],
  sharing: [{ cols: 8, rows: 5, depth: 1, items: [
    { id: 'venom', cells: at('T4', 0, 1) },
    { id: 'forge', cells: at('L4', 3, 0) },
    { id: 'root', cells: [[5, 2]] }, { id: 'root', cells: [[6, 2]] },
    { id: 'gut', cells: at('S4', 5, 3) },
  ] }],
  deposit: [1, 2, 3].map((stage) => ({ cols: 5, rows: 4, depth: 5, items: [
    ...block(0, 0, stage, 1).map((c) => ({ id: 'root', cells: [c] })),
    ...(stage === 3 ? [{ id: 'lattice', cells: at('O4', 2, 1) }] : []),
    { id: stage === 1 ? 'unknown' : 'ossuary', cells: [[3, 2]] },
  ] })),
  plinth: [1, 2, 3].map(() => ({ cols: 3, rows: 4, depth: 2, items: [
    { id: 'root', cells: [[1, 0]] },
    { id: 'scaffold', cells: at('V2', 1, 1) },
  ] })),
};
/** The closer views keep the game's rules too. */
function checkScenes() {
  const touch = (a, b) => a.some(([x, y]) => b.some(([u, v]) => Math.abs(x - u) + Math.abs(y - v) === 1));
  const near = (a, c, n) => a.some(([x, y]) => Math.max(Math.abs(x - c[0]), Math.abs(y - c[1])) <= n);
  const z = SCENES.zone[0];
  const heart = z.items.find((i) => i.id === 'heart').cells;
  // An organ is in a zone when any of its cells is within one step (8 ways) of the zone organ.
  for (const it of z.items.filter((i) => i.id !== 'heart' && i.id !== 'root')) {
    const inZone = it.cells.some((c) => near(heart, c, 1));
    if (inZone !== (it.id !== 'marrow')) throw new Error(`zone scene: ${it.id} is ${inZone ? 'in' : 'out of'} the zone`);
  }
  const zoneCells = block(0, 0, z.cols, z.rows).filter((c) => near(heart, c, 1) && !heart.some(([x, y]) => x === c[0] && y === c[1]));
  if (zoneCells.length !== z.zone.length) throw new Error('zone scene: the zone drawn is not the ring one cell round the heart');
  // The ghost on the whole screen: free ground, touching the body.
  const body = [...BOARD.meteor, ...BOARD.organs.flatMap((o) => o.cells)];
  const shut = [...body, ...BOARD.rock, ...BOARD.features.map((f) => f.cell)];
  if (UI.ghost.some(([x, y]) => x < 0 || y < 0 || x >= BW || y >= BH || shut.some(([u, v]) => u === x && v === y))) throw new Error('whole screen: the ghost is not on free ground');
  if (!touch(UI.ghost, body)) throw new Error('whole screen: the ghost touches neither the meteor nor an organ');
  const s = SCENES.sharing[0].items;
  const cells = (id) => s.filter((i) => i.id === id).flatMap((i) => i.cells);
  if (!touch(cells('venom'), cells('forge'))) throw new Error('sharing scene: the venom sac does not touch the forge');
  if (!touch(cells('forge'), [[5, 2]]) || !touch([[6, 2]], cells('gut'))) throw new Error('sharing scene: the roots do not join the forge to the gut');
  SCENES.deposit.forEach((p, k) => {
    const body = p.items.filter((i) => ORGANS[i.id]).flatMap((i) => i.cells);
    if (near(body, [3, 2], 2) !== (k > 0)) throw new Error(`deposit scene ${k + 1}: the deposit would ${k > 0 ? 'not ' : ''}be known`);
  });
}

// The whole screen: the board at the right, the ship's interface round it.
const UI = { cell: 84, x0: 424, y0: 174, ghost: at('U5', 0, 3) };
const CARDS = ['forge', 'venom', 'gut', 'nerve', 'lattice', 'womb', 'marrow', 'resonance', 'heart', 'brain', 'root', 'scaffold'];
function drawUiPlan(file) {
  const img = blank(W, H, [16, 16, 20, 255]);
  const { cell, x0, y0 } = UI;
  // Street strip, then the board.
  rect(img, x0, y0 - cell, BW * cell, cell, [70, 74, 80]);
  patch(img, x0, y0, cell, { cols: BW, rows: BH, depth: 0, items: [
    { id: 'rock', cells: BOARD.rock },
    { id: 'meteor', cells: BOARD.meteor },
    ...BOARD.organs,
    ...BOARD.found.map((f) => ({ id: f.id, cells: [f.cell] })),
    { id: 'unknown', cells: BOARD.unknown },
    { id: 'womb', cells: UI.ghost, ghost: true },
  ] });
  disc(img, x0 + 6.5 * cell, y0, Math.round(1.5 * cell) - 40, [44, 42, 46], y0 - 1);
  for (const f of BOARD.features) {
    rect(img, x0 + f.cell[0] * cell + 1, y0 + f.cell[1] * cell + 1, cell - 1, cell - 1, DIG[f.id].rgb);
    disc(img, x0 + f.cell[0] * cell + cell / 2, y0 + f.cell[1] * cell + cell / 2, 26, [30, 36, 22]);
  }
  // Three counters along the top.
  [[232, 120, 40], [79, 190, 180], [255, 215, 96]].forEach((c, i) => {
    rect(img, 440 + i * 250, 22, 36, 36, c);
    rect(img, 486 + i * 250, 32, 150, 16, mix(c, [16, 16, 20], 0.5));
  });
  // Organ cards down the left: the footprint of each, in its accent colour.
  CARDS.forEach((id, i) => {
    const cx = 20 + (i % 2) * 196, cy = 90 + Math.floor(i / 2) * 150;
    rect(img, cx, cy, 184, 138, id === 'womb' ? GOLD : [60, 60, 68]);
    rect(img, cx + 3, cy + 3, 178, 132, [26, 26, 32]);
    const cells = SHAPES[ORGANS[id].shape];
    const w = Math.max(...cells.map((c) => c[0])) + 1, h = Math.max(...cells.map((c) => c[1])) + 1;
    footprint(img, cells, cx + Math.round((184 - w * 28) / 2), cy + 12 + Math.round((90 - h * 28) / 2), 28, ORGANS[id].rgb, 3);
    for (let k = 0; k < 4; k++) rect(img, cx + 14 + k * 16, cy + 116, 10, 10, [232, 120, 40]);
  });
  // The way back up: one wide button, bottom right.
  rect(img, 1180, 948, 330, 56, [210, 210, 214]);
  rect(img, 424, 966, 600, 6, [120, 120, 128]);
  return writePng(file, img);
}

const SCENE_REF = Object.fromEntries(Object.keys(SCENES).map((k) => [k, path.join(REFS, `plan-${k}.png`)]));
REF.ui = path.join(REFS, 'plan-whole-screen.png');

function buildRefs() {
  const made = [];
  if (!fs.existsSync(REF.plan)) made.push(drawBoardPlan(REF.plan));
  if (!fs.existsSync(REF.organs)) made.push(drawShapePlan(REF.organs, SHEET_1, 5, 2));
  if (!fs.existsSync(REF.organs2)) made.push(drawShapePlan(REF.organs2, SHEET_2, 5, 2));
  if (!fs.existsSync(REF.tissue)) made.push(drawTissueRef(REF.tissue));
  if (!fs.existsSync(REF.ui)) made.push(drawUiPlan(REF.ui));
  for (const [k, file] of Object.entries(SCENE_REF)) if (!fs.existsSync(file)) made.push(drawScenePlan(file, SCENES[k]));
  made.forEach((f) => console.log(`[ref] ${f}`));
}

// ───────────────────────────── the words every picture shares ─────────────────────────────
const RULES =
  'RULES: no readable lettering anywhere: no words, no letters, no numbers, no captions, no title; where a mark ' +
  'is needed it is a small abstract one (a dot, a dash, a tick, a tiny ring). No cross, no star, no crescent and ' +
  'no other religious or political symbol anywhere. No human beings.';
const FILLS =
  'Each organ FILLS its cells from edge to edge, so that its footprint of whole square cells reads at a glance, ' +
  'like a puzzle piece with slightly rounded corners; organs that touch are joined along the edge they share.';
// The Nerve Cluster's footprint in the game IS a plus of five cells. The first cutaway sheet drew it
// with a long lower arm: a Latin cross (rejected/). Every picture made after that carries this note.
const NERVE_NOTE =
  'The Nerve Cluster is a squat piece exactly as wide as it is tall, three cells by three, with four short arms ' +
  'of exactly the same length: its lower arm is never longer than its upper arm. It is living tissue in the shape ' +
  'of a puzzle piece, never a symbol.';
/** What a picture was told after an earlier try of it was rejected: WHERE the fault must not be. */
const FIX = {
  '2-cutaway-organs':
    'MOST IMPORTANT: the fourth piece in the top row (the Nerve Cluster) must NOT look like a cross on a grave or ' +
    'a pendant. It is a fat plus sign that fits exactly in a square of three cells by three: its upper arm, its ' +
    'lower arm, its left arm and its right arm are all ONE cell long and one cell wide. The pale nerve inside it ' +
    'is a round ganglion with fine cords branching in every direction like roots, not four straight lines.',
};

const o = (id) => `${ORGANS[id].name}: ${ORGANS[id].says}. ${ORGANS[id].look[0].toUpperCase()}${ORGANS[id].look.slice(1)}. Its accent: ${ORGANS[id].accent}`;

const BOARD_WORDS =
  'WHAT IS DRAWN: a cross-section of the ground under a city, seen from the side, the playing board of a strategy ' +
  'game. The FIRST reference picture is the PLAN of this board: a flat coloured diagram. Follow the plan exactly ' +
  'for where every thing is and for the shape of every thing; do not copy its flat colours or its plainness. ' +
  'A grid of square cells, 13 columns wide and 9 rows deep, lies over the ground, drawn as thin faint lines; the ' +
  'street line runs along the top of the grid, and the ground runs on plain past the left and right of the grid. ' +
  'On the board, from the top: ' +
  '(1) THE METEOR, top middle: a block 3 cells wide and 2 cells deep under the street line, whose other half ' +
  'rises above the street as a cracked dome: a shell of black stone split open round a crimson heart of muscle. ' +
  `(2) ${ORGANS.forge.name}, against the left side of the meteor: an L of four square cells (three cells in a ` +
  `column going down from the street, and one more cell at its foot pointing right, under the corner of the ` +
  `meteor). ${ORGANS.forge.look}. ` +
  `(3) ${ORGANS.venom.name}, left of the Bone Forge and touching it: a T of four cells (a bar of three cells ` +
  `lying flat, with one cell hanging under its middle). ${ORGANS.venom.look}. ` +
  `(4) ${ORGANS.heart.name}, against the right side of the meteor, just under the street: a domino of two cells ` +
  `side by side. ${ORGANS.heart.look}. ` +
  `(5) ${ORGANS.gut.name}, under the right half of the meteor and touching it: an S of four cells (two cells side ` +
  `by side, and two more side by side one row lower and one column to the left). ${ORGANS.gut.look}. ` +
  `(6) THE SEWER MAIN, one cell, touching the right end of the Gut: ${DIG.sewer.look}. It belongs to the city, ` +
  'not to the body. ' +
  `(7) ${ORGANS.lattice.name}, under the foot of the Bone Forge and touching it: a square of four cells, two by ` +
  `two. ${ORGANS.lattice.look}. ` +
  '(8) TENDRIL ROOTS: a chain of three single cells of thick maroon root, running from the Gut down and to the ' +
  'right, joining the Gut to the Nerve Cluster. ' +
  `(9) ${ORGANS.nerve.name}, in the lower right, at the end of the roots: a plus of five cells (one cell in the ` +
  `middle and one on each of its four sides). ${ORGANS.nerve.look}. ${NERVE_NOTE} ` +
  '(10) BEDROCK: four lumps of hard grey rock of two or three cells each (at the right edge high up, in the ' +
  'middle, at the left edge, and low on the right): nothing grows in them. ' +
  `(11) TWO DEPOSITS THAT HAVE BEEN FOUND, one cell each: on the left, a CARRION POCKET: ${DIG.carrion.look}; at ` +
  `the right edge, an UNDERGROUND RESEARCH LAB: ${DIG.lab.look}. ` +
  '(12) TWO DEPOSITS NOT YET IDENTIFIED, one cell each, deep down on the left and in the middle: each shows ' +
  'only a single question mark. ' +
  'Everything else is plain soil, darker the deeper it lies; the bottom row is empty. About a third of the board ' +
  `is grown. ${FILLS}`;

const sheetWords = (ids, cols, rows) =>
  `WHAT IS DRAWN: a design sheet of ${ids.length} pieces for the playing board of a strategy game, in ${rows} rows ` +
  `of ${cols}, each piece alone in its own panel, all at the same scale, on faint square cells. They are the ` +
  'organs of ONE creature that grows under a city: all of them are made of the same dark maroon, matte, veined ' +
  'living tissue, and each has ONE accent that is not maroon, by which it is known at a glance. The FIRST ' +
  'reference picture is the PLAN of the sheet: a flat diagram that shows, panel by panel, the footprint of each ' +
  'piece as square cells and the colour of its accent. Follow the plan exactly for the footprints and the order; ' +
  'do not copy its flatness. In this order, left to right and top to bottom: ' +
  ids.map((id, i) => `(${i + 1}) ${id === 'plinth' ? PLINTH : o(id)}`).join('; ') + '. ' +
  `${FILLS} ${ids.includes('nerve') ? NERVE_NOTE : ''}`;

const DIG_ORDER = ['carrion', 'seam', 'lab', 'bed', 'ossuary', 'cache', 'cable', 'sewer', 'aquifer', 'vent', 'unknown', 'rock'];
const DIG_WORDS =
  'WHAT IS DRAWN: a design sheet of twelve square tiles for the playing board of a strategy game, in two rows of ' +
  'six, all the same size, with a small gap between them. Each tile is ONE CELL of the ground under a city, seen ' +
  'from the side in cross-section, and shows one thing that a creature growing through the soil can find there. ' +
  'The city above belongs to an insect civilisation of the 21st century. Top row, left to right, the six ' +
  'DEPOSITS (things to be grown over and eaten): ' +
  DIG_ORDER.slice(0, 6).map((id, i) => `(${i + 1}) ${DIG[id].name}: ${DIG[id].look}`).join('; ') + '. ' +
  'Bottom row, left to right, the four fixed FEATURES (they cannot be grown over; they strengthen what touches ' +
  'them), then two more tiles: ' +
  DIG_ORDER.slice(6).map((id, i) => `(${i + 7}) ${DIG[id].name}: ${DIG[id].look}`).join('; ') + '. ' +
  'Every tile must be told from the others at a glance, at the size of a thumbnail, by its colour and its outline. ' +
  'On the tomb (tile 5) the only emblem is one plain gold hexagon: no cross, no ankh, no star, no crown with a ' +
  'cross. On the laboratory (tile 3) there are no warning signs and no symbols.';

// ───────────────────────────── the directions ─────────────────────────────
const TISSUE =
  'the living tissue shown in the tissue reference picture: dark maroon, matte, veined and wet, raised parts a ' +
  'lighter crimson than the hollows';
const STYLE = {
  scanner: {
    n: 1, refs: [REF.globe],
    board:
      'STYLE: THE SHIP\'S INSTRUMENT. This is a ground-penetrating scan on a razor-thin holographic display aboard an ' +
      'austere far-future spacecraft, and it fills the whole frame. It is drawn in the display style of the second ' +
      'reference picture (the same ship\'s map of a planet): a black ground, razor-thin exact pale lines, fine scan ' +
      'detail, cold and precise, no decoration and no lens flare. Soil is faint: thin broken level strata lines ' +
      'and a fine speckle in dim blue-grey, fainter the deeper. Bedrock is a HARD RETURN: bright, grainy, ' +
      'sharp-edged pale grey. The grid is hairlines. The meteor is a dense dark mass outlined in red with a red ' +
      'core. Every organ is shown in FALSE COLOUR: its whole footprint filled with a translucent flat tint of its ' +
      'accent colour (ivory for the Bone Forge, acid yellow-green for the Venom Sac, arterial red for the ' +
      'Auxiliary Heart, dark wine red for the Gut, pale glassy aqua for the Mucus Lattice, pale blue-white for the ' +
      'Nerve Cluster, dull maroon for the roots), a brighter exact outline round the footprint, and inside it a ' +
      'fine line drawing of the organ. The city above the street line is a faint wireframe. A found deposit ' +
      'is a small exact pictogram in its own colour in an outlined cell; an unidentified one is a dim diamond ' +
      'with a question mark. Down the left edge runs a depth scale of tick marks with no numerals. One small plain ' +
      'gear symbol (a cogwheel) sits in the bottom right corner.',
    sheet:
      'STYLE: THE SHIP\'S INSTRUMENT. Every piece is drawn as the ship\'s ground-penetrating scan shows it on a ' +
      'razor-thin holographic display, in the display style of the second reference picture: a black ground, ' +
      'hairline square cells, razor-thin exact pale lines, cold and precise. Each piece is in FALSE COLOUR: its ' +
      'whole footprint filled with a translucent flat tint of its accent colour, a brighter exact outline round ' +
      'the footprint, and inside it a fine line drawing of the organ. Under each piece is a short row of small ' +
      'abstract marks (bars and dots), never letters. One small plain gear symbol (a cogwheel) in the bottom right corner.',
    dig:
      'STYLE: THE SHIP\'S INSTRUMENT. Every tile is drawn as the ship\'s ground-penetrating scan shows it on a ' +
      'razor-thin holographic display, in the display style of the second reference picture: a black ground, ' +
      'razor-thin exact pale lines, fine scan detail, cold and precise. The soil in each tile is faint strata ' +
      'lines and speckle. The thing found is an exact small pictogram drawn in fine lines and filled with one ' +
      'false colour of its own: salmon for the carrion pocket, deeper red for the carrion seam, teal for the ' +
      'laboratory, pale green for the biomass bed, gold for the royal tomb, violet for the gene cache, electric ' +
      'yellow-white for the power main, olive for the sewer main, blue for the aquifer, orange for the vent, dim ' +
      'grey for the unknown one, bright grainy grey for bedrock. Each tile has a thin outline. One small plain ' +
      'gear symbol (a cogwheel) in the bottom right corner of the sheet.',
  },
  cutaway: {
    n: 2, refs: [REF.tissue, REF.creep],
    board:
      'STYLE: THE CUTAWAY, REALISTIC. The ground has been cut open cleanly, like an ant farm behind glass or a ' +
      'geology exhibit, and we look straight at the cut face. Along the top edge is a strip of overcast sky and ' +
      'the street of the insect city seen from the side: flat-roofed blocks of pale wasp paper and wax with walls ' +
      'of honeycomb cells and round doorways lit amber, street lamps, cables, a parked car shaped like a beetle. ' +
      'Below the street is real soil in layers: dark topsoil with fine roots, then clay, then gravel, darker and ' +
      `more packed the deeper. The meteor and every organ are made of exactly ${TISSUE}. Each organ lies in a ` +
      'chamber it has dissolved for itself in the soil and fills it; each has ONE accent that is not maroon, as ' +
      'described. Bedrock is grey granite. The grid is only just there: thin faint pale lines over the soil. An ' +
      'unidentified deposit is a vague dark shape in the soil with a pale question mark on it. Realistic, ' +
      'grounded, physically plausible materials, soft even light, high detail, no interface, no border.',
    sheet:
      `STYLE: THE CUTAWAY, REALISTIC. Every piece is made of exactly ${TISSUE}, with its ONE accent, and lies in ` +
      'a chamber it has dissolved for itself in real dark soil, seen from the side in a clean cut face, like an ' +
      'ant farm behind glass. Faint thin pale lines mark the square cells. Realistic, grounded, physically ' +
      'plausible materials, soft even light, high detail. The plinth (the last piece) stands free on a little ' +
      'soil, not in a chamber.',
    dig:
      'STYLE: THE CUTAWAY, REALISTIC. Every tile is a clean cut face of real ground, like a geology exhibit or an ' +
      'ant farm behind glass: soil in layers, stones, fine roots, with the thing found lying in it, realistic and ' +
      'physically plausible, in soft even light, high detail. The insect people build in pale wasp paper, wax and ' +
      'honeycomb cells, with 21st-century technology. The unknown deposit is a vague dark shape in the soil with a ' +
      'pale question mark on it.',
  },
  atlas: {
    n: 3, refs: [],
    board:
      'STYLE: THE ATLAS PLATE. A plate from a 19th-century atlas of natural history: a lithograph tinted by hand ' +
      'in watercolour, printed on cream paper a little foxed at the edges, inside a thin ruled border. Fine ' +
      'stipple and hatching in sepia ink. Soil is delicate hatched strata; bedrock is cross-hatched; the city ' +
      'along the top is a small careful engraving of pale honeycomb buildings. The creature is drawn as an ' +
      'anatomical specimen: maroon washes for its tissue, and the accent of each organ as one clear watercolour ' +
      'tint (ivory, acid yellow-green, arterial red, dark wine red, glassy pale aqua, pale blue-white). From each ' +
      'organ, deposit and feature a thin straight leader line runs out to the margin and ends in a small abstract ' +
      'mark (a dot, a ring, a dash, two dots): never a letter, never a number. The grid is ruled in faint pencil.',
    sheet:
      'STYLE: THE ATLAS PLATE. A plate from a 19th-century atlas of natural history: a lithograph tinted by hand ' +
      'in watercolour, printed on cream paper a little foxed at the edges, inside a thin ruled border. Fine ' +
      'stipple and hatching in sepia ink. Each piece is drawn as an anatomical specimen laid on faint pencil ' +
      'squares: maroon washes for its tissue, and its accent as one clear watercolour tint. Beside each piece a ' +
      'thin leader line ends in a small abstract mark (a dot, a ring, a dash, two dots): never a letter, never a number.',
    dig:
      'STYLE: THE ATLAS PLATE. A plate from a 19th-century atlas of natural history and geology: a lithograph ' +
      'tinted by hand in watercolour, printed on cream paper a little foxed at the edges, inside a thin ruled ' +
      'border. Fine stipple and hatching in sepia ink; each tile is a small careful engraving of a square of ' +
      'ground with the thing found in it, tinted with one clear wash of its own colour. Under each tile is a ' +
      'small abstract mark (a dot, a ring, a dash, two dots): never a letter, never a number.',
  },
  fifties: {
    n: 4, refs: [],
    board:
      'STYLE: THE 1950s DIAGRAM. "A cross-section of the monster" as a civil-defence leaflet or the lobby card of ' +
      'a 1950s science-fiction horror B-movie would print it: a bold mid-century commercial illustration in flat ' +
      'inks with halftone dots, a little out of register, on cream paper with fold creases. A limited palette: ' +
      'cream, black, khaki and bright blood red, with the accent of each organ as one flat spot colour (ivory, ' +
      'acid yellow-green, dark wine red, glassy pale aqua, pale blue-white). Thick confident black outlines, ' +
      'simplified dramatic shapes, bold black arrows from organ to organ, jagged alarm bursts round the meteor. ' +
      'The town along the top is a row of cheerful simple silhouettes of honeycomb buildings. Where a leaflet ' +
      'would print words there are only empty cream caption boxes and rows of plain black bars.',
    sheet:
      'STYLE: THE 1950s DIAGRAM. The parts of the monster as a civil-defence leaflet or the lobby card of a 1950s ' +
      'science-fiction horror B-movie would print them: a bold mid-century commercial illustration in flat inks ' +
      'with halftone dots, a little out of register, on cream paper with fold creases. A limited palette: cream, ' +
      'black, khaki and bright blood red, with the accent of each piece as one flat spot colour. Thick confident ' +
      'black outlines, simplified dramatic shapes. Where a leaflet would print a name there is only an empty cream ' +
      'caption box or a row of plain black bars.',
    dig:
      'STYLE: THE 1950s DIAGRAM. "What lies under your town" as a civil-defence leaflet of the 1950s would print ' +
      'it: a bold mid-century commercial illustration in flat inks with halftone dots, a little out of register, ' +
      'on cream paper with fold creases. A limited palette: cream, black, khaki and bright blood red, with one ' +
      'flat spot colour of its own for each tile. Thick confident black outlines, simplified shapes. Where a ' +
      'leaflet would print a name there is only an empty cream caption box or a row of plain black bars.',
  },
  // Not one of the four asked for: the instrument of direction 1, with the body shown as it
  // really is. The style bible: "the one coloured thing aboard is the organism in the gene bay".
  living: {
    n: 5, refs: [REF.tissue, REF.globe],
    board:
      'STYLE: THE SCAN, WITH THE BODY IN TRUE COLOUR. This is a ground-penetrating scan on a razor-thin ' +
      'holographic display aboard an austere far-future spacecraft, and it fills the whole frame, in the display ' +
      'style of the third reference picture (the same ship\'s map of a planet): a black ground, razor-thin exact ' +
      'pale lines, cold and precise. Soil, bedrock, the city above and the grid are COLOURLESS scan data: soil is ' +
      'faint broken strata lines and fine speckle in dim grey, bedrock a bright grainy sharp-edged return, the ' +
      `city a faint wireframe, the grid hairlines. But the creature is shown as it really is: the meteor and every organ are ${TISSUE}, ` +
      'rendered lifelike and softly lit as if from inside, each organ with its ONE accent in true colour. The ' +
      'body is the one coloured, living thing on a black and white instrument. The instrument draws one thin ' +
      'exact pale outline round the footprint of each organ. A found deposit is a small exact pictogram in an ' +
      'outlined cell, tinted faintly; an unidentified one is a dim diamond with a question mark. Down the left ' +
      'edge runs a depth scale of tick marks with no numerals. One small plain gear symbol (a cogwheel) sits in ' +
      'the bottom right corner.',
    sheet:
      'STYLE: THE SCAN, WITH THE BODY IN TRUE COLOUR. The sheet is a razor-thin holographic display aboard an ' +
      'austere far-future spacecraft, in the display style of the third reference picture: a black ground, ' +
      `hairline square cells, razor-thin exact pale lines. On it every piece is shown as it really is: ${TISSUE}, ` +
      'rendered lifelike and softly lit as if from inside, with its ONE accent in true colour. The instrument ' +
      'draws one thin exact pale outline round the footprint of each piece, and under each a short row of small ' +
      'abstract marks (bars and dots), never letters. One small plain gear symbol (a cogwheel) in the bottom right corner.',
    dig:
      'STYLE: THE SCAN, WITH WHAT IS FOUND IN TRUE COLOUR. The sheet is a razor-thin holographic display aboard ' +
      'an austere far-future spacecraft, in the display style of the second reference picture: a black ground, ' +
      'razor-thin exact pale lines. In each tile the soil is colourless scan data (faint strata lines and ' +
      'speckle), and the thing found is shown small, lifelike and in its true colours, as if the instrument had ' +
      'resolved a photograph of it, inside a thin exact outline. The unknown deposit is unresolved: a dim ' +
      'diamond of noise with a question mark. One small plain gear symbol (a cogwheel) in the bottom right corner.',
    digRefs: [REF.globe],
  },
  // Not one of the four asked for: his own notebook, as approved in r4-hobby-interface.png.
  notebook: {
    n: 6, refs: [REF.notebook],
    board:
      'STYLE: HIS OWN NOTEBOOK. The board is one page of the private holographic notebook of a young, nerdy ' +
      'technician, in exactly the drawing style of the second reference picture: quick confident pen lines in ' +
      'white and pale cyan on a dark page of faint squared paper, a little shaky, with arrows, exclamation marks ' +
      'and question marks, and scribbles standing in for handwriting. The page fills the frame, square to it. The ' +
      'creature\'s tissue is scribbled in dark red pencil, as the red blob is in the reference, and the accent of ' +
      'each organ is filled in with one coloured pencil (ivory, acid yellow-green, arterial red, dark wine red, ' +
      'pale aqua, pale blue-white). Bedrock is hatched. The squares of the paper are the cells of the board. The ' +
      'handwriting is scribble only: no readable words.',
    sheet:
      'STYLE: HIS OWN NOTEBOOK. The sheet is one page of the private holographic notebook of a young, nerdy ' +
      'technician, in exactly the drawing style of the second reference picture: quick confident pen lines in ' +
      'white and pale cyan on a dark page of faint squared paper, a little shaky, with arrows, exclamation marks ' +
      'and scribbles standing in for handwriting. The creature\'s tissue is scribbled in dark red pencil and the ' +
      'accent of each piece is filled in with one coloured pencil. The squares of the paper are the cells. The ' +
      'handwriting is scribble only: no readable words.',
  },
};

/**
 * A picture that was right but for ONE thing is drawn again FROM its rejected self, so that the
 * rest of it stays. `from` is in rejected/.
 */
const GRUBS = (where) =>
  'WHAT IS DRAWN: the reference picture again, exactly: the same twelve tiles in the same places, the same ' +
  `drawing style, the same colours, the same background. Change only this: in ${where} (the clutch of round ` +
  'violet nodules), the small curled things inside the nodules look like the embryos of mammals, with heads and ' +
  'limbs. Make each of them a small curled INSECT GRUB instead: a larva with a plain, fat, segmented body like a ' +
  'bean, with no face, no head, no arms and no legs. Nothing in the picture may look like a human embryo.';
const REDRAW = {
  '2-cutaway-dig': { from: '2-cutaway-dig--try1-gene-cache-embryos-look-human.png', prompt: GRUBS('the last tile of the top row') },
  '3-atlas-dig': { from: '3-atlas-dig--try1-gene-cache-embryos-look-human.png', prompt: GRUBS('the last tile of the top row') },
  // The model put a church with a cross on it into the skyline over the tomb, by itself.
  '4-1950s-dig': { from: '4-1950s-dig--try1-cross-on-a-tower-in-the-skyline.png', prompt:
    'WHAT IS DRAWN: the reference picture again, exactly: the same twelve tiles in the same places, the same ' +
    'drawing style, the same colours, the same paper. Change only the small strips of town skyline along the top ' +
    'of the tiles, and only these things in them. (1) In the FIFTH tile of the top row (the gold one, with the ' +
    'golden sarcophagus), a tower in the skyline carries a cross on its top: replace that cross with a plain round ' +
    'ball. (2) In the same strip, just left of that tower, a mast carries a ring and a crossbar: make it a plain ' +
    'straight pole ending in a small ball. (3) In the FIRST tile of the top row, the tall tower at the right carries ' +
    'a mast with two crossbars: make it a plain straight pole ending in a small ball. In every skyline strip no ' +
    'tower, mast or pole has a crossbar: there must be no cross of any kind anywhere in the picture.' },
};

const NAME = { scanner: 'scanner', cutaway: 'cutaway', atlas: 'atlas', fifties: '1950s', living: 'living-scan', notebook: 'notebook' };
const JOBS = {};
const add = (slug, tests, prompt, refs) => { JOBS[slug] = { tests, prompt: FIX[slug] ? `${prompt} ${FIX[slug]}` : prompt, refs: refs.filter(Boolean) }; };
for (const [k, s] of Object.entries(STYLE)) {
  const id = `${s.n}-${NAME[k]}`;
  add(`${id}-board`, 'the whole 13 by 9 board in play, about a third grown', `${BOARD_WORDS} ${s.board} ${RULES}`, [REF.plan, ...s.refs]);
  add(`${id}-organs`, 'the eight theme organs, the new Scaffold Gland and a plinth, each in its own footprint',
    `${sheetWords(SHEET_1, 5, 2)} ${s.sheet} ${RULES}`, [REF.organs, ...s.refs]);
  if (s.dig) add(`${id}-dig`, 'the six deposits, the four features, an unknown deposit and bedrock, one cell each', `${DIG_WORDS} ${s.dig} ${RULES}`, s.digRefs ?? s.refs);
}
for (const [slug, r] of Object.entries(REDRAW)) {
  JOBS[slug] = { ...JOBS[slug], prompt: `${r.prompt} ${RULES}`, refs: [path.join(OUT, 'rejected', r.from)] };
}

// ───────────────────────────── going further with the directions that work ─────────────────────────────
// Each closer view is drawn from its own plan and from the BOARD picture of its direction (made
// above), which holds the look better than any wording.
const PLAN_NOTE =
  'The FIRST reference picture is the PLAN: a flat coloured diagram. Follow it exactly for where every thing is ' +
  'and for the shape of every thing; do not copy its flat colours or its plainness.';
const CLOSE = {
  living: {
    board: '5-living-scan-board', withTissue: true,
    style:
      'STYLE: exactly the style of the SECOND reference picture (the same instrument, showing the whole board): a ' +
      'razor-thin holographic display aboard an austere far-future spacecraft, a black ground, a hairline grid, soil ' +
      'and bedrock as colourless scan data. The creature is shown as it really is: living tissue, dark maroon, ' +
      'matte, veined and wet (the THIRD reference picture shows this tissue and the accents), lifelike and softly ' +
      'lit as if from inside, each organ with its ONE accent in true colour, and one thin exact pale outline drawn ' +
      'by the instrument round each footprint. Everything the instrument adds (outlines, marks, gauges) is drawn ' +
      'in razor-thin pale lines. One small plain gear symbol (a cogwheel) in the bottom right corner.',
    marks: 'the instrument',
  },
  scanner: {
    board: '1-scanner-board',
    style:
      'STYLE: exactly the style of the SECOND reference picture (the same instrument, showing the whole board): a ' +
      'razor-thin holographic display aboard an austere far-future spacecraft, a black ground, a hairline grid, soil ' +
      'as faint strata, bedrock as a bright grainy return. Every organ is in FALSE COLOUR: its whole footprint ' +
      'filled with a translucent flat tint of its accent colour, a brighter exact outline round it, and inside it ' +
      'a fine line drawing of the organ. Everything the instrument adds (marks, gauges) is drawn in razor-thin ' +
      'pale lines. One small plain gear symbol (a cogwheel) in the bottom right corner.',
    marks: 'the instrument',
  },
  cutaway: {
    board: '2-cutaway-board', withTissue: true,
    style:
      'STYLE: exactly the style of the SECOND reference picture (the same cutaway, showing the whole board): the ' +
      'ground cut open cleanly like an ant farm behind glass, real soil in layers, realistic and physically ' +
      'plausible, soft even light, high detail; the grid only just there as thin faint pale lines. The creature ' +
      'is living tissue, dark maroon, matte, veined and wet (the THIRD reference picture shows this tissue and the ' +
      'accents), each organ in a chamber it has dissolved for itself, with its ONE accent. The few marks that the ' +
      'interface of the game adds are thin pale gold lines laid over the picture.',
    marks: 'the interface',
  },
};
const FURTHER = {
  living: ['organs-2', 'whole-screen', 'growing', 'zone', 'sharing', 'deposit', 'plinth', 'in-the-room'],
  scanner: ['whole-screen', 'sharing'],
  cutaway: ['whole-screen', 'growing', 'sharing'],
};
const WORDS = {
  'whole-screen': (c) => ({
    tests: 'the organ stage with the ship\'s interface round it, an organ about to be grown',
    plan: REF.ui,
    prompt:
      'WHAT IS DRAWN: the WHOLE SCREEN of the organ stage of a strategy game, as the player sees it between two ' +
      'waves. The FIRST reference picture is the PLAN of the screen: a flat diagram; follow it for where every ' +
      'thing is, and do not copy its flatness. The BOARD fills the right of the screen: it is the board of the ' +
      'SECOND reference picture, the same organs of the same shapes in the same places, in the same style, drawn a ' +
      'little smaller. Round the board is the interface of the ship\'s own software: razor-thin pale lines on ' +
      'black, exact and plain, with no decoration. ' +
      '(1) Down the left, twelve ORGAN CARDS in two columns of six. On each card: the footprint of one organ as ' +
      'small squares in its accent colour, a small picture of that organ, and its price as a short row of small ' +
      'orange pips. Six cards are dimmed: those organs are grown already. ONE card is selected and outlined in ' +
      'pale gold: the Brood Womb, a U of five squares, pink. ' +
      '(2) On the board, the GHOST of the selected organ where the player is about to grow it: the same U of five ' +
      'cells (three cells in a row along the bottom and one cell standing on each end), drawn as a pale gold ' +
      'outline with a faint pink tint inside, at the left of the board under the Venom Sac and touching it. It ' +
      'lies over the Carrion Pocket, which glows because it is about to be taken. ' +
      '(3) Along the top, three COUNTERS, each a small plain glyph and a bar: orange for war meat, teal for ' +
      'science, gold for royal points. ' +
      '(4) Under the board a thin status line of small abstract marks, and at the bottom right one wide plain ' +
      'button marked only with a triangle pointing up: the way back to the surface. ' +
      '(5) One small plain gear symbol (a cogwheel) in the top left corner. ' +
      `Glyphs, bars and pips only. ${c.style.split(' One small plain gear')[0]}`,
  }),
  growing: (c) => ({
    tests: 'an organ growing, in three stages (the Bone Forge)',
    plan: SCENE_REF.growing,
    prompt:
      'WHAT IS DRAWN: an organ GROWING, in THREE STAGES: three panels side by side, read from left to right, each ' +
      `showing the same small patch of the board, 4 cells wide and 4 deep, just under the street. ${PLAN_NOTE} In ` +
      'every panel the corner of the METEOR fills the upper right, 2 cells by 2: a shell of black stone round ' +
      'crimson muscle. Against its left side the BONE FORGE grows: an L of four square cells (three cells in a ' +
      'column, and one more at the foot pointing right, under the meteor). ' +
      `PANEL 1, JUST PLANTED: the L is only marked out, by ${c.marks}, as a thin pale gold outline; the soil ` +
      'inside it is still soil, but from the edge of the meteor thin maroon tendrils have begun to push into it. ' +
      'PANEL 2, HALF GROWN: young tissue fills the whole L thinly: pale pink, translucent and wet, the soil half ' +
      'dissolved under it, and the first small buds of bone showing. ' +
      'PANEL 3, GROWN: the finished Bone Forge fills the L from edge to edge: dark maroon veined tissue, thick ' +
      'ivory ribs and spurs of bone round a pale hot core, joined to the meteor along the edges they share. ' +
      'Between the panels, one small plain arrowhead pointing right.',
  }),
  zone: (c) => ({
    tests: 'a zone organ showing its zone (the Auxiliary Heart): who is boosted and who is not',
    plan: SCENE_REF.zone,
    prompt:
      'WHAT IS DRAWN: a ZONE ORGAN showing its ZONE: a close view of a patch of the board, 9 cells wide and 5 ' +
      `deep. ${PLAN_NOTE} In the middle is the AUXILIARY HEART: a domino of two cells side by side: ONE small dark ` +
      'red heart with thick vessels, lying across both cells. Its ZONE is the ring of cells one cell wide all ' +
      'round it (a block 4 cells wide and 3 deep, less the heart itself; the pink cells of the plan): every cell ' +
      `of the ring is tinted by ${c.marks} with a soft arterial-red light inside a thin dashed line, and faint ` +
      'rings of pulse spread from the heart and stop at the edge of the zone. Round it are three organs. The ' +
      `${ORGANS.forge.name} at the left (an L of four cells: ${ORGANS.forge.look}): its foot lies inside the ring. ` +
      `The ${ORGANS.gut.name} at the upper right (an S of four cells: ${ORGANS.gut.look}): two of its cells lie ` +
      'inside the ring. These two are BOOSTED: they are brighter, their outline is doubled, and beside each is one ' +
      `small chevron mark pointing up. The ${ORGANS.marrow.name} along the bottom right (a straight bar of four ` +
      `cells: ${ORGANS.marrow.look}) lies wholly OUTSIDE the ring, joined to the heart by one cell of Tendril ` +
      'Root: it is NOT boosted: it is dimmer and has no mark. The difference between boosted and not boosted ' +
      `must read at a glance. ${FILLS}`,
  }),
  sharing: (c) => ({
    tests: 'how a touching pair of organs shows that they share, and a pair joined by roots',
    plan: SCENE_REF.sharing,
    prompt:
      'WHAT IS DRAWN: how organs that TOUCH show that they SHARE their powers: a close view of a patch of the ' +
      `board, 8 cells wide and 5 deep. ${PLAN_NOTE} The ${ORGANS.venom.name} on the left (a T of four cells: ` +
      `${ORGANS.venom.look}) touches the ${ORGANS.forge.name} in the middle (an L of four cells: ` +
      `${ORGANS.forge.look}) along one edge. Where they touch, the two are FUSED: a seam of thick vessels crosses ` +
      'the edge, and each has taken a little of the other: thin acid yellow-green veins run from the seam into ' +
      'the bone of the forge and tip its nearest spurs green, and small ivory spurs of bone have grown among the ' +
      `nearest glands of the venom sac. On the seam, ${c.marks} has put one small mark: two linked rings. On the ` +
      `right, the ${ORGANS.gut.name} (an S of four cells: ${ORGANS.gut.look}) does not touch the forge: it is ` +
      'joined to the foot of the forge by a chain of two cells of TENDRIL ROOT (thick maroon root). The same ' +
      'exchange runs along the root: small beads of ivory light and of wine-red light travel along it in both ' +
      'directions, the nearest teeth of the gut are tipped with ivory bone, and a second mark of two linked ' +
      `rings sits on the root. ${FILLS}`,
  }),
  deposit: (c) => ({
    tests: 'a deposit being reached, in three stages (unknown, found, grown over): the Ancient Royal Tomb',
    plan: SCENE_REF.deposit,
    prompt:
      'WHAT IS DRAWN: a DEPOSIT being reached, in THREE STAGES: three panels side by side, read from left to ' +
      `right, each showing the same patch of the board, 5 cells wide and 4 deep, deep underground. ${PLAN_NOTE} ` +
      'PANEL 1, NOT YET KNOWN: the body is far off: one cell of Tendril Root (thick maroon root) in the top left ' +
      'corner. Three cells away, lower right, something is buried: it shows only as a dim diamond of noise with ' +
      'a question mark in it. ' +
      'PANEL 2, FOUND: the root has grown one cell nearer (two cells of root along the top). What is buried has ' +
      `been identified: the ANCIENT ROYAL TOMB, small but clear in its one cell and outlined in gold: ${DIG.ossuary.look}. ` +
      'PANEL 3, REACHED: a third cell of root, and hanging from it the MUCUS LATTICE, a square of four cells, two ' +
      'by two, grown over the tomb, which is now the lower right cell of the square. Through the glassy ' +
      'translucent strands of the lattice the tomb is seen being taken: maroon tendrils wrap the sarcophagus, ' +
      'and its gold leaf comes away as motes of gold light that stream up through the tissue and along the root ' +
      'toward the top left. Over the lattice floats one small solid gold hexagon: the reward. ' +
      'Between the panels, one small plain arrowhead pointing right. On the tomb the only emblem is one plain gold ' +
      'hexagon: no cross, no ankh, no star.',
  }),
  plinth: (c) => ({
    tests: 'the new Scaffold Gland making a free plinth, in three stages, and the plinth it gives',
    plan: SCENE_REF.plinth,
    prompt:
      'WHAT IS DRAWN: the SCAFFOLD GLAND making a PLINTH, in THREE STAGES: three panels side by side, read from ' +
      `left to right, each showing the same patch of the board, 3 cells wide and 4 deep. ${PLAN_NOTE} In every ` +
      'panel one cell of Tendril Root (thick maroon root) at the top middle joins the gland to the body above, and ' +
      'under it is the SCAFFOLD GLAND: a domino of two cells, one above the other: its upper cell a fat knot of ' +
      'tissue, its lower cell a square mould. ' +
      'PANEL 1, EMPTY: the mould is an empty square hollow lined with pale callus; a few thin threads of bone ' +
      'have begun to cross it. ' +
      'PANEL 2, HALF CAST: a scaffold of thin bone struts fills the mould, and chalk-white callus is thickening on ' +
      'it from the bottom up. ' +
      'PANEL 3, READY: the finished plinth fills the mould; and to the right of the gland the same plinth stands ' +
      `free, lifted out, shown whole: ${PLINTH.replace(/^A PLINTH \(.*?\): /, '')}. ` +
      `Under each panel, ${c.marks} has drawn one small round gauge in two halves: both halves empty under panel 1, ` +
      'one half filled under panel 2, both filled under panel 3. Between the panels, one small plain arrowhead ' +
      'pointing right.',
  }),
};
for (const [k, list] of Object.entries(FURTHER)) {
  const c = CLOSE[k];
  const id = `${STYLE[k].n}-${NAME[k]}`;
  const board = path.join(OUT, `${c.board}.png`);
  for (const what of list) {
    if (what === 'organs-2') {
      add(`${id}-organs-2`, 'the zone organs, the root and five of the creep organs, each in its own footprint',
        `${sheetWords(SHEET_2, 5, 2)} Of these, the first four are ZONE organs, the fifth is connecting tissue, and ` +
        `the last five are CREEP organs, whose accent is the pale green of spores. ${STYLE[k].sheet} ${RULES}`, [REF.organs2, ...STYLE[k].refs]);
    } else if (what === 'in-the-room') {
      add(`${id}-in-the-room`, 'where the stage is in the story: the scan on the display of the operations room',
        'WHAT IS DRAWN: the operations room of a small orbital vessel, photoreal and lifelike, like a frame from a ' +
        'serious hard science-fiction film shot on a real set. It is the room of the FIRST reference picture: the ' +
        'same seamless matte black composite and bare pale ceramic, the same even white light from flush strips, ' +
        'the same standing workstation, the same small plain black gear symbol on the wall, nothing ornamental. ' +
        'Above the workstation floats one large razor-thin holographic display, two metres wide, and on it is the ' +
        'ground scan of the SECOND reference picture: the cross-section under the city in black and white scan ' +
        'lines, with the organs of the creature in true colour, dark red, each in its own shape. The dark red of ' +
        'the creature is the one strong colour in the room. At the workstation stands a slight young man of about ' +
        'twenty-five, SEEN FROM DIRECTLY BEHIND so that we never see his face: short untidy dark hair, a plain ' +
        'black high-collared garment with a narrow white collar, its sleeves pushed up to the elbows, a stylus ' +
        'tucked behind one ear. One hand is raised to the display: he is dragging a pale gold outline of an organ ' +
        'into place. At the right end of the desk floats the ship\'s artificial intelligence, as in the THIRD ' +
        'reference picture: the projection of a young woman drawn in Japanese anime style, from the waist up, ' +
        'slightly translucent, long pale silver hair, a plain black high-collared dress with a narrow white ' +
        'collar; she is looking at the display. She is the one thing in the room that is drawn rather than real. ' +
        'RULES: no readable lettering anywhere: no words, no letters, no numbers. No cross, no star, no crescent ' +
        'and no other religious or political symbol. The only person is the young man, and we never see his face.',
        [REF.room, board, REF.yoke]);
    } else {
      const w = WORDS[what](c);
      add(`${id}-${what}`, w.tests, `${w.prompt} ${what === 'whole-screen' ? '' : c.style} ${RULES}`, [w.plan, board, c.withTissue ? REF.tissue : null]);
    }
  }
}

// The plinth where it is used: on a roof of the city board (the board's own look, whichever
// direction the organ stage takes).
add('7-board-plinth-on-a-roof', 'a plinth in use on the city board: the same limb with and without one',
  'WHAT IS DRAWN: a PLINTH in use on the city board of a tower defence game, shown as a finished in-game view ' +
  'with no interface. Isometric three-quarter top-down view, the camera 45 degrees above the ground, in exactly ' +
  'the style of the FIRST reference picture: the same city of an insect civilisation built of pale wasp paper and ' +
  'wax with walls of honeycomb cells, and the same dark maroon, matte, veined living skin lying over the roof. ' +
  'One wide flat roof terrace, ringed by a low parapet and covered by the living skin, fills the middle of the ' +
  'picture. On it stand two of the SAME limb, side by side, to compare. The limb is the one with the long ivory ' +
  'bone harpoon in the SECOND reference picture (the third figure of its top row): a squat mound of the same dark ' +
  'maroon tissue with plates of dark chitin. On the LEFT it stands straight on the roof. On the RIGHT it stands ' +
  'on a PLINTH: a squat pedestal as wide as one cell of the roof and one storey tall, of chalk-white callus on a ' +
  'scaffold of thin bone struts, with a flat level top, like a thick vertebra or the stump of a tree made of ' +
  'spongy bone; the living skin of the roof has crept a little way up its foot, and the roots of the limb grip ' +
  'its top. So the limb on the right stands one storey higher than the one on the left, and its harpoon clears ' +
  'the parapet and the roof of the next block. Realistic, grounded, physically plausible materials, soft overcast ' +
  `daylight. ${RULES}`, [REF.city, REF.tissue]);

// ───────────────────────────── running ─────────────────────────────
const ff = (args, label) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${label}: ffmpeg failed: ${(r.stderr || '').slice(0, 400)}`);
};

/** A JPEG beside every PNG, and one picture of all of them. */
function finish() {
  const pngs = Object.keys(JOBS).filter((s) => fs.existsSync(path.join(OUT, `${s}.png`)));
  for (const s of pngs) {
    const jpg = path.join(OUT, `${s}.jpg`);
    const png = path.join(OUT, `${s}.png`);
    if (!fs.existsSync(jpg) || fs.statSync(jpg).mtimeMs < fs.statSync(png).mtimeMs) ff(['-i', png, '-q:v', '3', jpg], `jpg ${s}`);
  }
  if (!pngs.length) return;
  const dir = path.join(TMP, 'tiles');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const font = `C${String.fromCharCode(92)}:/Windows/Fonts/arialbd.ttf`;
  pngs.forEach((s, i) => ff(['-i', path.join(OUT, `${s}.png`), '-vf',
    `scale=768:512,pad=768:560:0:0:color=0x141414,drawtext=fontfile='${font}':text='${s}':x=12:y=522:fontsize=26:fontcolor=white`,
    '-frames:v', '1', path.join(dir, `t${String(i).padStart(3, '0')}.png`)], `tile ${s}`));
  const cols = 3;
  const rows = Math.ceil(pngs.length / cols);
  ff(['-framerate', '1', '-i', path.join(dir, 't%03d.png'), '-vf', `tile=${cols}x${rows}:margin=8:padding=8:color=0x000000`,
    '-frames:v', '1', '-q:v', '3', path.join(OUT, 'contact-sheet.jpg')], 'contact sheet');
  console.log(`[sheet] ${pngs.length} pictures -> ${path.join(OUT, 'contact-sheet.jpg')}`);
}

const args = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const state = checkBoard();
checkScenes();
if (!args.length) {
  console.log(`board: ${state.grown} of ${BW * BH} cells are body (${Math.round(state.share * 100)}%)`);
  for (const [slug, j] of Object.entries(JOBS)) console.log(`${fs.existsSync(path.join(OUT, `${slug}.png`)) ? 'on disk' : '   -   '}  ${slug}: ${j.tests}`);
  process.exit(0);
}
if (args[0] === '--prompt') { console.log(JOBS[args[1]]?.prompt ?? `unknown picture "${args[1]}"`); process.exit(0); }
buildRefs();
if (args[0] === '--refs') process.exit(0);
if (args[0] === '--sheet') { finish(); process.exit(0); }

const slugs = (args[0] === 'all' ? Object.keys(JOBS) : args).filter((s) => {
  if (!JOBS[s]) throw new Error(`unknown picture "${s}" (run with no arguments for the list)`);
  return !fs.existsSync(path.join(OUT, `${s}.png`));
});
if (!slugs.length) { console.log('nothing to make: every picture asked for is on disk'); finish(); process.exit(0); }
ready();
const before = await balance().catch(() => null);
// At most 4 at a time.
const results = await pool(slugs, 4, (slug) => makeStill({
  slug: `organ-stage-${slug}`, prompt: JOBS[slug].prompt, key: null, refFiles: JOBS[slug].refs,
  width: 1536, height: 1024, quality: 'high', out: path.join(OUT, `${slug}.png`),
}));
results.forEach((r, i) => console.log(r.ok ? `OK   ${r.value}` : `FAIL ${slugs[i]}: ${r.error.message}`));
const after = await balance().catch(() => null);
if (before !== null && after !== null) console.log(`balance ${before} -> ${after}: ${before - after} tokens gone while ${spent.stills} picture(s) were made here (other sessions spend from the same balance)`);
finish();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
