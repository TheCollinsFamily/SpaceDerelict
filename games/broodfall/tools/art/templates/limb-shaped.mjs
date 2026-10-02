/**
 * A LIMB DRAWN FOR ITS GROUND (Oct 2 2026; Collins, of the class-zero footprints: "ok this is WAY better, redesign
 * the art around this"). A limb that stands on a line of three, a T, an elbow, an L, a 2x2, or that is redrawn on
 * its one cell, is drawn over a GROUND PLATE (tools/art/lib/plate.mjs): its cells as dark diamonds seen as the board
 * sees them. Where it stands is then known, not marked: the middle of the plate and its width (`plate` in
 * tools/art/limbs.mjs; feet.json in its raw folder).
 *
 *   node tools/art/make.mjs shaped <family> [--stills]   the pictures of every view (look at them: --stills stops there)
 *   node tools/art/make.mjs shaped <family>              then the clips, then the bake
 *   node tools/art/make.mjs shaped <family> --bake       bake again from the clips on disk (free)
 *
 * Views: front (facing south, its face to the lower left) and back (north); an elbow or an L also has its two
 * sides (east, west), since mirrored it would stand on the wrong cells. A view's picture is drawn over that view's
 * plate. Its clips are the same as any limb's: an idle and its acting clip, and (front only) its death.
 *
 * Raw: art-src/limbs/<srcDir>/ (a NEW folder: the old drawing's files stay where they were, and the old baked art
 * is kept in public/art/limbs-legacy/). SPENDS: a still about $0.45, a clip about $0.25.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill, pool } from '../rfab.mjs';
import { AWAY, QUIET, THEMES, WITHER, limb, rawDirOf } from '../limbs.mjs';
import { blank, borderColour, readImage, resize, writeJpg, writePng, over } from '../lib/img.mjs';
import { keyFrame, keyOf, unionBox } from '../lib/key.mjs';
import { SHAPES, VIEW_FACING, cellsOf, drawPlate, fitPlate } from '../lib/plate.mjs';
import { REVIEW, SRC, ROOT } from '../lib/manifest.mjs';
import { STEADY, bakeLimb } from './limb.mjs';

const KEYS = { green: { hex: '00FF00', name: 'green', rgb: [0, 255, 0] }, blue: { hex: '0000FF', name: 'blue', rgb: [0, 0, 255] } };
const NAMES = { one: 'a single tile', line3: 'a straight row of three tiles', T: 'a T of four tiles', L3: 'an elbow of three tiles', L4: 'an L of four tiles', sq2: 'a square of four tiles' };

/** The views a shaped limb is drawn in. */
export const viewsOf = (l) => (l.plate === 'L3' || l.plate === 'L4' ? ['front', 'back', 'side', 'backside'] : ['front', 'back']);

/** Where on the plate a cell of the shape lies, in words (the hub: a T's junction, an elbow's bend). */
function whereIs(shape, facing, cell) {
  const cells = cellsOf(shape, facing);
  const s = cells.map(([x, y]) => [x - y, x + y]);
  const mx = (Math.max(...s.map((p) => p[0])) + Math.min(...s.map((p) => p[0]))) / 2;
  const my = (Math.max(...s.map((p) => p[1])) + Math.min(...s.map((p) => p[1]))) / 2;
  const [hx, hy] = [cell[0] - cell[1], cell[0] + cell[1]];
  const h = hx < mx - 0.1 ? 'left' : hx > mx + 0.1 ? 'right' : '';
  const v = hy < my - 0.1 ? 'top' : hy > my + 0.1 ? 'bottom' : '';
  return v && h ? `${v === 'top' ? 'upper' : 'lower'} ${h}` : v || h || 'middle';
}

/** The tile its hub stands on (src/sim/footprint.ts SHAPES hub), facing one way, in the shape's turned cells. */
function hubCell(shape, facing) {
  const HUB = { T: [1, 0], L3: [0, 1], L4: [0, 2] };
  if (!HUB[shape]) return null;
  // Turn the hub with the shape (the same turn and shift as plate.mjs cellsOf).
  const TURNS = { S: 0, W: 1, N: 2, E: 3 };
  let cells = SHAPES[shape].map(([x, y]) => [x, y]);
  let hub = [...HUB[shape]];
  for (let i = 0; i < TURNS[facing]; i++) { cells = cells.map(([x, y]) => [-y, x]); hub = [-hub[1], hub[0]]; }
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return [hub[0] - mx, hub[1] - my];
}

/** Which end of a row of three its front is, facing one way, as the picture shows it. */
const frontEnd = (facing) => ({ S: 'lower left', N: 'upper right', E: 'lower right', W: 'upper left' }[facing]);

/** A step on the board (dx, dy) as the picture shows it, the board unturned (x runs to the lower right, y to the lower left). */
function screenWay(dx, dy) {
  const sx = Math.sign(dx - dy);
  const sy = Math.sign(dx + dy);
  return `${sy < 0 ? 'upper' : sy > 0 ? 'lower' : ''}${sx && sy ? ' ' : ''}${sx < 0 ? 'left' : sx > 0 ? 'right' : ''}`;
}

/**
 * The shape of its ground in words a picture model follows: which way each arm reaches across the PICTURE (Oct 2
 * 2026: told only "the dark tiles", the model drew a T as a Y standing upright; told the directions, it follows them).
 */
export function plateWords(l, view) {
  const facing = VIEW_FACING[view];
  const shape = l.plate;
  const head = 'The FIRST picture is a low raised slab of wet crimson flesh seen from 45 degrees above, made of diamond-shaped tiles, on a plain background.';
  const hub = hubCell(shape, facing);
  const cells = cellsOf(shape, facing);
  if (shape === 'one') return `${head} It is ONE tile: the organism stands on that one tile and is about as wide as it, a compact limb.`;
  if (shape === 'sq2') return `${head} It is a square of four tiles, a diamond as wide as two tiles: the organism is a big squat body that covers all of it.`;
  if (shape === 'line3') {
    const [a, , c] = cells;
    const front = { S: 'lower left', N: 'upper right', E: 'lower right', W: 'upper left' }[facing];
    return `${head} It is a straight row of three tiles running diagonally across the picture from its ${screenWay(a[0] - c[0], a[1] - c[1])} to its ${screenWay(c[0] - a[0], c[1] - a[1])}: ` +
      `the organism is LONG and LOW, lying along that whole diagonal row, three times as long as it is wide; its front end is the ${front} end, where the dark round hole is in the slab: its front part (its point, nozzle or mouth) is THERE, at the ${front} end, and the other end is its closed back end.`;
  }
  // A T or an L: its arms from the key tile.
  const arms = new Map();
  for (const c of cells) {
    if (c[0] === hub[0] && c[1] === hub[1]) continue;
    const way = screenWay(Math.sign(c[0] - hub[0]), Math.sign(c[1] - hub[1]));
    arms.set(way, (arms.get(way) ?? 0) + 1);
  }
  const list = [...arms.entries()].map(([way, n]) => `${n > 1 ? 'a LONG arm, two tiles long,' : 'an arm one tile long'} reaching to the ${way}`);
  const what = shape === 'T'
    ? 'a T: a straight bar of three tiles with a fourth tile beside its middle'
    : shape === 'L3' ? 'an elbow of three tiles' : 'an L of four tiles';
  return `${head} It is ${what}. Its key tile (the ${shape === 'T' ? 'middle of the bar' : 'bend'}) is the ${whereIs(shape, facing, hub)} one; from it go ${list.join(' and ')}. ` +
    'The organism is LOW and spreads along the ground in exactly those directions, its arms lying flat along the tiles, its tall parts rising from them; it is NOT a round or star-shaped body.';
}

/** What is said of the view the organism is seen from. */
function viewWords(l, view) {
  if (view === 'front') return l.shapedFront ?? 'Its front faces the lower left of the picture.';
  if (view === 'back') return l.shapedBack ?? 'We see it from behind: its front faces away from the camera, toward the upper right.';
  if (view === 'side') return l.shapedSide ?? 'We see it from its other side: its front faces the lower right of the picture.';
  return l.shapedBackSide ?? 'We see it from behind and the other side: its front faces away from the camera, toward the upper left.';
}

export function stillPrompt(l, view) {
  const accent = l.accent ?? THEMES[l.theme].accent;
  const same = view === 'front' || l.plate === 'line3'
    ? ''
    : 'It is the SAME organism as the one in the LAST picture, the same parts, material and colour, seen from another side; but its SHAPE on the ground is the slab of the FIRST picture, not the shape it has in the LAST picture. ';
  return `${plateWords(l, view)} EDIT that picture: KEEP the slab exactly as it is, the same shape, the same place and the same size, ` +
    'not moved, not turned, not mirrored, not reshaped. It is the base of ONE rooted alien organism, a limb of a creature for a strategy ' +
    `game: grow the organism up out of that slab, on it and nowhere else. The slab's hard straight edges become soft, rounded, lumpy living flesh fringed with short roots gripping the ground, but its OUTLINE stays the same shape. ${same}` +
    `${l.name.toUpperCase()}: ${l.shapedLook}. ${viewWords(l, view)} ` +
    'It is made of exactly the living tissue of the creature: deep maroon and dark crimson flesh, lumpy and wet, crossed by a net ' +
    'of darker raised veins, with small glossy highlights; plates of dark chitin; its raised parts a lighter, redder crimson than ' +
    `its hollows, so its form reads clearly (the SECOND picture shows that tissue and how a limb is drawn). ` +
    `It carries this accent and no other: ${accent}. Isometric three-quarter view from 45 degrees above, the same as the patch. ` +
    'Realistic, detailed creature design, wet and unglamorous. Soft even light from directly overhead, no cast shadows, no labels, ' +
    'no numbers, no text.';
}

/** The plate of a view, written to the raw folder (free). */
function plateOf(l, dir, view) {
  const key = KEYS[THEMES[l.theme].key];
  const file = path.join(dir, `plate-${view}.png`);
  const p = drawPlate(l.plate, VIEW_FACING[view], { key: key.rgb, slab: true, mark: l.plate === 'line3' });
  if (!fs.existsSync(file)) writePng(file, p.img);
  return { file, ...p };
}

/** Where it stands in a view's picture, from the plate: [x, y, width] as shares of its keyed box (limbs.mjs foot). */
function footFromPlate(l, dir, view, still, plate) {
  const img = readImage(still, { w: 1024, h: 1024 });
  keyFrame(img, keyOf(borderColour(img)), { spill: 'edge' });
  const keyed = img;
  const box = unionBox([keyed]);
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  // The organism is grown on the slab by an EDIT, which keeps its SHAPE but may move and scale it a little: the
  // slab is found again in the picture (fitPlate: its base, thin parts taken off, matched to the plate). Checked:
  // the slab must be under the organism, all of it.
  const fit = fitPlate(keyed, l.plate, VIEW_FACING[view]);
  const foot = [Number(((fit.x - box.x0) / w).toFixed(4)), Number(((fit.y - box.y0) / h).toFixed(4)), Number((fit.w / w).toFixed(4))];
  const mask = drawPlate(l.plate, VIEW_FACING[view], { key: [255, 0, 255], at: fit }).img;
  let under = 0, all = 0;
  for (let i = 0; i < mask.data.length; i += 4) {
    if (mask.data[i] === 255 && mask.data[i + 1] === 0 && mask.data[i + 2] === 255) continue;
    all++; if (keyed.data[i + 3] > 128) under++;
  }
  const covered = under / Math.max(1, all);
  console.log(`[shaped] ${l.family} ${view}: the organism covers ${(covered * 100).toFixed(0)}% of its ground${covered < 0.85 ? ' (LOOK: under 85%)' : ''}`);
  // For the person: the plate's outline over the picture, to see that it was drawn over its ground.
  const sheet = blank(1024, 1024, [30, 30, 30, 255]);
  over(sheet, keyed, 0, 0);
  const out = drawPlate(l.plate, VIEW_FACING[view], { key: [255, 0, 255], at: fit }).img;
  for (let i = 0; i < out.data.length; i += 4) {
    const isPlate = !(out.data[i] === 255 && out.data[i + 1] === 0 && out.data[i + 2] === 255);
    if (!isPlate) continue;
    // Only the plate's rim: a pixel of the plate next to the background.
    const x = (i / 4) % 1024;
    const y = Math.floor(i / 4 / 1024);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const j = ((y + dy) * 1024 + (x + dx)) * 4;
      return out.data[j] === 255 && out.data[j + 1] === 0 && out.data[j + 2] === 255;
    });
    if (nb) { sheet.data[i] = 0; sheet.data[i + 1] = 255; sheet.data[i + 2] = 255; }
  }
  fs.mkdirSync(path.join(REVIEW, 'limbs', 'shaped'), { recursive: true });
  writeJpg(path.join(REVIEW, 'limbs', 'shaped', `${l.family}-${view}-plate.jpg`), resize(sheet, 512, 512), 3);
  return { foot, muzzle: muzzleFrom(l, view, keyed, box, fit) };
}

/**
 * WHERE ITS SHOTS LEAVE IT, found in the picture (Oct 2 2026: a limb drawn over its slab is not marked by eye).
 * A long limb fires from its FRONT end (the cell of its line furthest the way it faces, a little above the slab);
 * any other from its PEAKS: the tops of its tallest parts (a chimney's mouth, a frond's tips, a fan's quills), up to
 * four, each well apart from the others. As shares of its keyed box, like a mark by eye (tools/art/limbs.mjs muzzle).
 */
function muzzleFrom(l, view, img, box, fit) {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const share = ([x, y]) => [Number(((x - box.x0) / w).toFixed(3)), Number(((y - box.y0) / h).toFixed(3))];
  if (l.plate === 'line3') {
    const facing = VIEW_FACING[view];
    const step = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[facing];
    const cells = cellsOf('line3', facing);
    const s = cells.map(([x, y]) => [x - y, x + y]);
    const mx = (Math.max(...s.map((p) => p[0])) + Math.min(...s.map((p) => p[0]))) / 2;
    const my = (Math.max(...s.map((p) => p[1])) + Math.min(...s.map((p) => p[1]))) / 2;
    let best = 0;
    cells.forEach(([x, y], i) => { if (x * step[0] + y * step[1] > cells[best][0] * step[0] + cells[best][1] * step[1]) best = i; });
    const th = (fit.tw * 76) / 128;
    // Toward the front end, three quarters of the way from the middle: the nozzle sits at the end, not past it.
    return [share([fit.x + ((s[best][0] - mx) * fit.tw) / 2 * 0.75, fit.y + ((s[best][1] - my) * th) / 2 * 0.75 - th * 0.35])];
  }
  // The top of the solid at every column.
  const tops = [];
  for (let x = box.x0; x < box.x1; x++) {
    let t = -1;
    for (let y = box.y0; y < box.y1; y++) if (img.data[(y * img.w + x) * 4 + 3] > 128) { t = y; break; }
    tops.push(t < 0 ? Infinity : t);
  }
  const reach = box.y0 + h * 0.45;
  const peaks = [];
  const gap = Math.max(8, w * 0.14);
  const order = tops.map((t, i) => [t, i]).filter(([t]) => t < reach).sort((a, b) => a[0] - b[0]);
  for (const [t, i] of order) {
    if (peaks.length >= 4) break;
    if (peaks.some((p) => Math.abs(p[0] - i) < gap)) continue;
    peaks.push([i, t]);
  }
  return peaks.map(([i, t]) => share([box.x0 + i, t + h * 0.02]));
}

function feetFile(dir) { return path.join(dir, 'feet.json'); }

/** The material reference: a limb of one cell already redrawn in the creep's tissue. */
function materialRef() {
  return path.join(SRC, 'limbs', 'spitter', 'styled.png');
}

export async function makeShapedLimb(family, { bakeOnly = false, stillsOnly = false } = {}) {
  const l = limb(family);
  if (!l?.plate) throw new Error(`${family}: not a shaped limb (no \`plate\` in tools/art/limbs.mjs)`);
  const dir = path.join(SRC, 'limbs', rawDirOf(l));
  fs.mkdirSync(dir, { recursive: true });
  const key = KEYS[THEMES[l.theme].key];
  const views = viewsOf(l);
  if (!bakeOnly) {
    // The pictures: the front first (the others are drawn from it).
    const stills = {};
    const feet = fs.existsSync(feetFile(dir)) ? JSON.parse(fs.readFileSync(feetFile(dir), 'utf8')) : {};
    const muzzles = {};
    for (const view of views) {
      const plate = plateOf(l, dir, view);
      // Another view is drawn from its own slab and the material, the front given LAST for its look only: given
      // second, its shape won over the slab's (Oct 2 2026: a Choir's back drawn as its front).
      // (A long limb's back is drawn without its front given at all: given, its near end was drawn as its front.)
      const refs = view === 'front' || l.plate === 'line3' ? [plate.file, materialRef()] : [plate.file, materialRef(), stills.front];
      stills[view] = await makeStill({
        slug: `${family} on its ground, ${view}`, out: path.join(dir, `${view}.png`), refFiles: refs,
        prompt: stillPrompt(l, view), key: key.hex, keyName: key.name, quality: 'high',
      });
      const found = footFromPlate(l, dir, view, stills[view], plate);
      feet[view] = found.foot;
      muzzles[view] = found.muzzle;
    }
    fs.writeFileSync(feetFile(dir), `${JSON.stringify(feet, null, 1)}\n`);
    fs.writeFileSync(path.join(dir, 'muzzles.json'), `${JSON.stringify(muzzles, null, 1)}\n`);
    if (stillsOnly) return { family, checks: [] };
    // The clips of every view: an idle, its acting clip, and (front) its death.
    const jobs = [];
    for (const view of views) {
      const away = view === 'back' || view === 'backside' ? AWAY : '';
      const pre = view === 'front' ? '' : `${view}-`;
      jobs.push({ view, anim: 'idle', out: `${pre}idle.mp4`, prompt: (l.idle ?? '') + away + STEADY });
      if (l.fire) jobs.push({ view, anim: 'fire', out: `${pre}fire.mp4`, prompt: l.fire + away + (l.quiet ? QUIET : '') + STEADY });
      if (view === 'front') jobs.push({ view, anim: 'die', out: 'die.mp4', prompt: `${WITHER} The solid pure ${key.name} #${key.hex} background stays flat and empty.`, loop: false, raw: true });
    }
    const results = await pool(jobs, 3, (j) => makeClip({
      slug: `${family} ${j.view} ${j.anim}`, out: path.join(dir, j.out), stillFile: stills[j.view],
      prompt: j.prompt, key: key.hex, keyName: key.name, loop: j.loop ?? true, raw: j.raw ?? false,
    }));
    results.forEach((r, i) => { if (!r.ok) console.warn(`[shaped] ${family} ${jobs[i].view} ${jobs[i].anim} failed: ${r.error.message.slice(0, 160)}`); });
  }
  return bakeLimb(family);
}

export { ROOT };
