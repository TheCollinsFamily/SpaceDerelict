/**
 * THE BOARD'S OWN ART (Sep 30 2026): what lies on the board besides the city and the limbs.
 *
 *   pods      the creep nodes (spore pods), one per look of a node: plain, mire, burning, big,
 *             thrown. A picture each, a clip of it GROWING (placed) and one of it SPREADING
 *             (a child sent out). -> public/art/board/pods.webp, manifest board.pods
 *   strains   the creep's skin where a node's strain works on it: mire (bog, slows) and burning
 *             (embers, hurts). Flat textures, baked into the creep sheet as creep-mire-* and
 *             creep-burning-* by templates/terrain.mjs.
 *   gates     one gateway per tile set where the waves come in: a flat front view, laid on the
 *             board as a wall face is (either way along the street). -> terrain sheet 'gates'.
 *   smoke     wisps of smoke drifting over the unclaimed city. -> terrain sheet 'smoke'.
 *
 *   node tools/art/make.mjs board [pods|strains|gates|smoke|<set id>] [--stills] [--bake]
 *
 * Every picture is looked at before it is kept (notes/art-review/board/), zoomed in: no
 * lettering, no religious symbol.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill, pool } from '../rfab.mjs';
import { BIOMES, NO_SYMBOLS, SPECIES, biome } from '../biomes.mjs';
import { bbox, blank, borderColour, crop, flipX, paste, readFrames, readImage, resize, writeJpg, writePng } from '../lib/img.mjs';
import { figure, findFigures } from '../lib/sheet.mjs';
import { dropSpecks, keyClip, keyFrame, keyOf, unionBox } from '../lib/key.mjs';
import { packAtlas, reviewSheet } from '../lib/atlas.mjs';
import { A, B, LEVEL_H } from '../lib/iso.mjs';
import { ART, REVIEW, SRC, putEntry } from '../lib/manifest.mjs';

const TERRAIN = path.join(SRC, 'terrain');
const DIR = path.join(TERRAIN, 'board');
const OUT = path.join(REVIEW, 'board');
const CREEP = path.join(TERRAIN, 'creep.png');

// ---------------------------------------------------------------- the pods

/** The looks of a node, in the order they stand on the design sheet. */
export const PODS = [
  { id: 'plain', look: 'PLAIN: a round closed sac the size of a large melon, crowned with a ring of small puckered pores' },
  { id: 'mire', look: 'MIRE: the same sac, bloated and slick with glossy bog-green and olive mucus that drips from it, green-black ooze pooling round its roots with a few bubbles in it' },
  { id: 'burning', look: 'BURNING: the same sac with deep cracks that glow molten orange and yellow from inside like embers, its skin charred dark round them, a thin wisp of pale smoke rising from its crown' },
  { id: 'big', look: 'BIG: the same sac swollen half as large again, taut and heavily veined, with three smaller lobes budding from its sides' },
  { id: 'thrown', look: 'THROWN: the same sac with a fleshy sling pouch on its back and a thick coiled tendon behind it drawn back like a catapult arm, ready to fling' },
];
const POD_KEY = ['0000FF', 'blue'];
const podSheet = () =>
  `Design sheet of ${PODS.length} spore pods of one living creature, for a strategy game. Isometric three-quarter ` +
  'top-down view, the camera 45 degrees above the ground. They stand in one row, evenly spaced, well apart and not ' +
  'touching, all at the same scale. Every one is a creep node: a rooted sac of glistening wet deep maroon and crimson ' +
  'tissue, exactly the tissue and the net of raised veins of the reference picture, with a few plates of dark chitin, ' +
  'gripping the ground with a low ragged skirt of short roots of the same tissue. Each faces the lower left of the ' +
  `picture. In reading order: ${PODS.map((p, i) => `(${i + 1}) ${p.look}`).join('; ')}. Realistic, detailed creature ` +
  'design, wet and unglamorous. Soft even light from directly overhead. No ground, no cast shadows, no labels, no ' +
  'numbers, no text.';
const CAM = 'The camera is completely locked: no zoom, no pan, no cuts. The solid pure blue #0000FF background stays flat and empty the whole time.';
/** Played BACKWARDS in the game: a pod withdrawing into the ground, reversed, is a pod growing out of it. */
const SHRINK = 'The spore pod slowly shrivels and sinks down into the ground: it deflates and shrinks smaller and smaller, its roots drawing in, until only a small flat puckered bud of flesh is left where it stood. It stays at exactly the same spot. ' + CAM;
const SPREAD = 'The spore pod swells and throbs twice, then its crown splits open and puffs out a burst of pale spores that drift away, and it closes and settles back to exactly how it began. It stays at exactly the same spot and the same size at the end. ' + CAM;

const podDir = (id) => path.join(DIR, 'pods', id);

async function generatePods({ stillsOnly }) {
  fs.mkdirSync(path.join(DIR, 'pods'), { recursive: true });
  const file = await makeStill({
    slug: 'the spore pods', out: path.join(DIR, 'pods', 'sheet.png'), prompt: podSheet(), key: POD_KEY[0], keyName: POD_KEY[1],
    width: 1536, height: 1024, quality: 'high', refFiles: [CREEP],
  });
  const img = readImage(file);
  const found = findFigures(img, { expect: PODS.length });
  if (found.boxes.length !== PODS.length) throw new Error(`pods: ${found.boxes.length} figures on the sheet, ${PODS.length} expected. Look at ${file}; delete it to draw again.`);
  const side = Math.ceil(Math.max(...found.boxes.map((b) => Math.max(b.x1 - b.x0, b.y1 - b.y0))) * 1.9);
  PODS.forEach((p, i) => {
    fs.mkdirSync(podDir(p.id), { recursive: true });
    const still = path.join(podDir(p.id), 'still.png');
    if (!fs.existsSync(still)) writePng(still, resize(figure(img, found.boxes[i], found, 0, side), 1024, 1024));
  });
  if (stillsOnly) return;
  const jobs = PODS.flatMap((p) => [
    () => makeClip({ slug: `pod ${p.id} shrinking`, stillFile: path.join(podDir(p.id), 'still.png'), prompt: SHRINK, raw: true, loop: false, key: POD_KEY[0], keyName: POD_KEY[1], out: path.join(podDir(p.id), 'shrink.mp4') }),
    () => makeClip({ slug: `pod ${p.id} spreading`, stillFile: path.join(podDir(p.id), 'still.png'), prompt: SPREAD, raw: true, loop: true, key: POD_KEY[0], keyName: POD_KEY[1], out: path.join(podDir(p.id), 'spread.mp4') }),
  ]);
  const results = await pool(jobs, 5, (j) => j());
  results.filter((r) => !r.ok).forEach((r) => console.warn(`[board] a pod clip failed: ${r.error.message.slice(0, 200)}`));
}

const FRAME = 192;
const COLS = 16;
const KEEP = { grow: 12, spread: 16 };

/** Frames spread evenly over a list, first and last among them. */
const spreadPick = (frames, n) => (frames.length <= n ? frames.slice()
  : Array.from({ length: n }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (n - 1))]));
const area = (img) => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 128) n++; return n; };

/** The pods' clips to one atlas: for each look, its growing (the shrink played backwards) then its spreading. */
export function bakePods() {
  const frames = [];
  const looks = {};
  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const rows = [];
  for (const p of PODS) {
    const dir = podDir(p.id);
    const shrinkFile = path.join(dir, 'shrink.mp4');
    const spreadFile = path.join(dir, 'spread.mp4');
    if (!fs.existsSync(shrinkFile) || !fs.existsSync(spreadFile)) continue;
    const shrink = keyClip(readFrames(shrinkFile, 12));
    const spread = keyClip(readFrames(spreadFile, 12));
    for (const f of [...shrink.frames, ...spread.frames]) dropSpecks(f, 0.02);
    // The frame holds the pod at rest (the first frame of each) and what it puffs out, round the middle of its footing.
    const rest = unionBox([shrink.frames[0]]);
    const all = unionBox([...shrink.frames, ...spread.frames]);
    const cx = (rest.x0 + rest.x1) / 2;
    const foot = rest.y1 - (rest.y1 - rest.y0) * 0.12;
    const half = Math.max(cx - all.x0, all.x1 - cx, (foot - all.y0) / 1.24, (all.y1 - foot) / 0.76) * 1.04;
    const side = Math.ceil(2 * half);
    const x0 = Math.round(cx - half);
    const y0 = Math.round(foot - side * 0.62);
    const cut = (f) => resize(crop(f, x0, y0, side, side), FRAME, FRAME);
    // Growing: the shrink backwards, ending on the pod as it stands.
    const grow = spreadPick(shrink.frames, KEEP.grow).reverse().map(cut);
    const spr = spreadPick(spread.frames, KEEP.spread).map(cut);
    const endArea = area(shrink.frames[shrink.frames.length - 1]) / Math.max(1, area(shrink.frames[0]));
    check(`${p.id}: grows from next to nothing`, endArea < 0.35, `${(endArea * 100).toFixed(0)}% of the pod at the start of its growing`);
    const back = area(spread.frames[spread.frames.length - 1]) / Math.max(1, area(spread.frames[0]));
    check(`${p.id}: ends its spreading the size it began`, Math.abs(back - 1) < 0.25, `${(back * 100).toFixed(0)}%`);
    looks[p.id] = {
      grow: { start: frames.length, count: grow.length, fps: 12 },
      spread: { start: frames.length + grow.length, count: spr.length, fps: 12 },
      // How wide the pod at rest is, as a share of the frame; and where its footing is.
      body: Number(((rest.x1 - rest.x0) / side).toFixed(3)),
      anchor: [0.5, 0.62],
    };
    frames.push(...grow, ...spr);
    rows.push({ label: p.id, anims: [grow, spr] });
  }
  if (!frames.length) return null;
  fs.mkdirSync(path.join(ART, 'board'), { recursive: true });
  const packed = packAtlas(frames, FRAME, COLS, path.join(ART, 'board', 'pods.webp'), 84);
  const entry = { atlas: 'board/pods.webp', frame: FRAME, cols: COLS, looks };
  putEntry('board', 'pods', entry);
  fs.mkdirSync(OUT, { recursive: true });
  reviewSheet(rows, FRAME, path.join(OUT, 'pods.jpg'));
  fs.writeFileSync(path.join(OUT, 'pods.json'), `${JSON.stringify({ checks }, null, 1)}\n`);
  checks.forEach((c) => console.log(`[board] pods: ${c.ok ? 'ok  ' : 'FAIL'} ${c.name} (${c.value})`));
  return entry;
}

// ---------------------------------------------------------------- the strains

const FLAT =
  'Seen from exactly straight above, as a flat texture that fills the whole picture edge to edge with no border. ' +
  `Even flat light, no cast shadows, no objects standing on it, no perspective. ${NO_SYMBOLS}`;
export const STRAINS = {
  // Sep 30 2026 fix pass: the first mire (art-src/terrain/creep-mire.png, kept) was mossy green and read as grass
  // beside the green roofs. Drawn again as rot: peat brown and muddy olive, wet, with bubbles (REDRAWN_STRAINS).
  mire: 'The same living skin of flesh as the reference picture, with the same net of thicker, darker raised veins, but sunk in a rotting bog: drowned in thick slick muck of muddy olive-brown, peat brown and dull khaki, black rot in the hollows between the veins, all of it soaking wet and glossy like fresh tar, with big bright white wet highlights on every swell, and about twenty LARGE round glossy gas bubbles, each as big as a coin, domed and shining with a bright white highlight on top, spread over it, a few burst into pale rings, streaks of oily yellow-olive scum. Muddy brown-olive and peat brown; not grass green, no moss, no grass, no plants. The maroon of the skin shows only faintly through it. ' + FLAT,
  burning: 'The same living skin of flesh as the reference picture, with the same net of thicker, darker raised veins, but burning from inside: every crack and hollow between the veins glows molten orange and yellow like embers in a fire, the skin charred near black around them, flecks of pale ash. ' + FLAT,
};

/** Strains drawn again (Sep 30 2026 fix pass) go to their own folder; the first pictures are kept where they were. */
// (The first redraw, strains-2026-09-30/, came out right in colour but its bubbles were too small to see on the board.)
export const REDRAWN_STRAINS = { dir: path.join(TERRAIN, 'strains-2026-09-30-b'), ids: ['mire'] };
export const strainFile = (id) => path.join(REDRAWN_STRAINS.ids.includes(id) ? REDRAWN_STRAINS.dir : TERRAIN, `creep-${id}.png`);

async function generateStrains() {
  const jobs = Object.entries(STRAINS).map(([id, prompt]) => () => makeStill({
    slug: `creep ${id}`, out: strainFile(id), prompt, key: null, width: 1024, height: 1024, quality: 'high', refFiles: [CREEP],
  }));
  const results = await pool(jobs, 2, (j) => j());
  results.filter((r) => !r.ok).forEach((r) => console.warn(`[board] a strain failed: ${r.error.message.slice(0, 200)}`));
}

// ---------------------------------------------------------------- the gates

/** What each set's gateway is. Every one is ITS set's people building in their own way (tools/art/biomes.mjs). */
export const GATES = {
  orthodox: 'a triumphal gateway of pale wasp paper and wax: one wide round arch on two ribbed piers, a band of gold and coloured mosaic over the arch, a small paper onion dome on top of each pier ending in a plain gold ball',
  suburb: 'a pastel garden gateway: two posts of white wax pickets holding a round trellis arch grown over with pale flowers, a little porch lamp on each post, a low picket fence running off to each side',
  megacity: 'a heavy portal of smoked resin and black glass with a wide round opening, strips of neon glowing along its arch showing only abstract glyphs, cables, a small steam vent and a security camera',
  orient: 'a moon gate: a perfectly round opening in a wall of pale paper and lacquer red posts, under upswept eaves of jade tiles, a paper lantern hanging on each side, carved beetles on the posts',
  industrial: 'a factory gate: a riveted iron gantry arch over the road with yellow and black hazard stripes on its legs, a lattice gate slid open to one side, two floodlamps and a run of pipes along the top',
  farmland: 'a ranch gateway: two tall posts of red-stained paper boards with white trim holding a round arched beam over the road, split-rail fences running off to each side, a lantern hanging from the beam',
  necropolis: 'a cemetery gate of bone-white chalk: one round arch between two piers with niches holding urns and small candles, black iron gates standing wide open, a dark fungus cypress beside each pier',
  // Sep 30 2026: the first was a ring floating in the air, with no wall under it: a gate stands on the road.
  deephive: 'a wide gateway cut through a thick squat wall of ancient amber comb that stands on the ground: its opening is round at the top and reaches right down to the ground, so a road runs through it; a thick glossy rim of old wax round the opening, capped cells all over the wall, some of them glowing warm amber from inside',
  terraces: 'a gateway in a dry-stone wall laid like honeycomb: a round stone arch, a wooden field gate standing open under it, grass and small flowers growing along the top of the wall',
  wetland: 'a water gate of a stilt village: a round arch of bundled reeds and pale wasp paper standing on stilts, reed mats hung on it, a lantern hanging from the arch, coils of rope',
};
const gateWords = (b) =>
  'A flat architectural elevation, in full colour and realistic detail, seen exactly from the front with no ' +
  `perspective and no ground: ${GATES[b.id]}. It stands alone in the middle of the picture, whole, with a margin all ` +
  'round it. It is as wide as it is high, and its opening is wide and empty, so that the flat background is seen ' +
  `through it. ${SPECIES}. ${b.look}. Even flat light, no cast shadows. ${NO_SYMBOLS}`;

async function generateGates(ids) {
  fs.mkdirSync(path.join(DIR, 'gates'), { recursive: true });
  const jobs = BIOMES.filter((b) => GATES[b.id] && (!ids.length || ids.includes(b.id))).map((b) => () => makeStill({
    slug: `gate ${b.id}`, out: path.join(DIR, 'gates', `${b.id}.png`), prompt: gateWords(b), key: b.key[0], keyName: b.key[1],
    width: 1024, height: 1024, quality: 'high', refFiles: [path.join(TERRAIN, b.id, 'wall-plain.png')].filter((f) => fs.existsSync(f)),
  }));
  const results = await pool(jobs, 5, (j) => j());
  results.filter((r) => !r.ok).forEach((r) => console.warn(`[board] a gate failed: ${r.error.message.slice(0, 200)}`));
}

/** How many levels high a gate stands on the board, and how many cells wide it spans (a gate spans the two-cell opening). */
export const GATE_LEVELS = 3.2;
export const GATE_CELLS = 2;
/** Gates are baked at this many times the board's own scale: they are seen close. */
const GATE_RES = 1.5;

/**
 * A gate's front view, cut off its background, laid on the board as a wall face is: along the
 * view's x (a face that falls to the right, `-x`) or along its y (one that rises to the right,
 * `-y`). The game puts the bottom left corner of its span on the street.
 */
export function gateSprites() {
  const out = [];
  for (const b of BIOMES) {
    const file = path.join(DIR, 'gates', `${b.id}.png`);
    if (!fs.existsSync(file)) continue;
    const img = readImage(file);
    keyFrame(img, keyOf(borderColour(img)), { spill: 'edge' });
    dropSpecks(img, 0.03);
    const box = bbox(img, 100);
    const face = crop(img, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    const W = Math.round(GATE_CELLS * A * GATE_RES);
    const rise = Math.round(GATE_CELLS * B * GATE_RES);
    const tall = Math.round(GATE_LEVELS * LEVEL_H * GATE_RES);
    for (const along of ['x', 'y']) {
      const H = rise + tall;
      const img2 = blank(W, H);
      const src = resize(face, W, tall);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        // A face along x falls to the right (its bottom edge goes down as it goes right); along y it rises.
        const top = along === 'x' ? (x / W) * rise : (1 - x / W) * rise;
        const v = y - top;
        if (v < 0 || v >= tall) continue;
        const s = (Math.floor(v) * src.w + x) * 4;
        const d = (y * W + x) * 4;
        // The face seen from the side it falls to is a little darker, as the walls are.
        const k = along === 'x' ? 0.96 : 0.8;
        img2.data[d] = src.data[s] * k; img2.data[d + 1] = src.data[s + 1] * k; img2.data[d + 2] = src.data[s + 2] * k; img2.data[d + 3] = src.data[s + 3];
      }
      // Its anchor: the bottom left corner of its span, as a share of the picture.
      const anchor = along === 'x' ? [0, Number((tall / H).toFixed(4))] : [0, 1];
      out.push({ id: `gate-${b.id}-${along}`, img: img2, extra: { anchor, res: GATE_RES } });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the smoke

const SMOKE_PROMPT =
  'Six separate soft wisps and billows of thick pale grey smoke, each a different shape, some long and drawn out by ' +
  'the wind, some rounded, spread well apart on a background of pure flat black, seen from above. Soft edges that ' +
  'fade into the black. Nothing else in the picture. No text.';

async function generateSmoke() {
  return makeStill({ slug: 'smoke wisps', out: path.join(DIR, 'smoke.png'), prompt: SMOKE_PROMPT, key: null, width: 1536, height: 1024, quality: 'high' });
}

/** The wisps: brightness becomes how thick the smoke is; its colour is a grey the game tints. */
export function smokeSprites() {
  const file = path.join(DIR, 'smoke.png');
  if (!fs.existsSync(file)) return [];
  const img = readImage(file);
  // Each wisp found as a lump of light on the black.
  const lum = (i) => (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
  const alpha = { w: img.w, h: img.h, data: Buffer.alloc(img.data.length) };
  for (let i = 0; i < img.data.length; i += 4) {
    const a = Math.max(0, Math.min(255, (lum(i) - 14) * 1.5));
    alpha.data[i] = 200; alpha.data[i + 1] = 198; alpha.data[i + 2] = 192; alpha.data[i + 3] = a;
  }
  // Lumps of smoke: what is thick enough, on a coarse grid, joined where it touches.
  const G = 8;
  const gw = Math.ceil(img.w / G), gh = Math.ceil(img.h / G);
  const on = new Uint8Array(gw * gh);
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) if (alpha.data[(y * img.w + x) * 4 + 3] > 40) on[Math.floor(y / G) * gw + Math.floor(x / G)] = 1;
  const seen = new Uint8Array(gw * gh);
  const boxes = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, n = 0;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % gw, cy = Math.floor(c / gw);
      n++; x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const o = ny * gw + nx;
        if (on[o] && !seen[o]) { seen[o] = 1; stack.push(o); }
      }
    }
    if (n > 40) boxes.push({ x0: x0 * G, y0: y0 * G, x1: (x1 + 1) * G, y1: (y1 + 1) * G });
  }
  return boxes.map((bx, i) => {
    const pad = 20;
    const c = crop(alpha, bx.x0 - pad, bx.y0 - pad, bx.x1 - bx.x0 + 2 * pad, bx.y1 - bx.y0 + 2 * pad);
    const w = Math.min(320, c.w);
    return { id: `smoke-${i}`, img: resize(c, w, Math.round((c.h / c.w) * w)), extra: { anchor: [0.5, 0.5] } };
  });
}

// ---------------------------------------------------------------- review and entry

/** A picture of everything drawn so far, to look at before keeping it. */
export function reviewBoard() {
  fs.mkdirSync(OUT, { recursive: true });
  const gates = gateSprites();
  if (gates.length) {
    const cell = 300;
    const sheet = blank(cell * 4, cell * Math.ceil(gates.length / 4), [90, 84, 70, 255]);
    gates.forEach((g, i) => {
      const s = Math.min(1, (cell - 10) / Math.max(g.img.w, g.img.h));
      const im = resize(g.img, Math.round(g.img.w * s), Math.round(g.img.h * s));
      const x = (i % 4) * cell + ((cell - im.w) >> 1);
      const y = Math.floor(i / 4) * cell + ((cell - im.h) >> 1);
      for (let r = 0; r < im.h; r++) for (let c = 0; c < im.w; c++) {
        const si = (r * im.w + c) * 4; const a = im.data[si + 3] / 255; const di = ((y + r) * sheet.w + x + c) * 4;
        for (let k = 0; k < 3; k++) sheet.data[di + k] = Math.round(im.data[si + k] * a + sheet.data[di + k] * (1 - a));
      }
    });
    writeJpg(path.join(OUT, 'gates.jpg'), sheet, 3);
  }
}

export async function makeBoard({ only = [], bakeOnly = false, stillsOnly = false } = {}) {
  const want = (p) => !only.length || only.includes(p);
  const sets = only.filter((id) => GATES[id]);
  if (!bakeOnly) {
    const jobs = [];
    if (want('strains')) jobs.push(generateStrains());
    if (want('gates') || sets.length) jobs.push(generateGates(sets));
    if (want('smoke')) jobs.push(generateSmoke());
    if (want('pods')) jobs.push(generatePods({ stillsOnly }));
    const r = await Promise.allSettled(jobs);
    r.filter((x) => x.status === 'rejected').forEach((x) => console.warn(`[board] ${x.reason.message.slice(0, 300)}`));
  }
  bakePods();
  reviewBoard();
  // The strains, the gates and the smoke are sheets of the terrain entry: bake it again with them.
  const { bakeTerrain } = await import('./terrain.mjs');
  return bakeTerrain();
}
