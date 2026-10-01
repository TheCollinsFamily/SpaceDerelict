/**
 * Streets and roofs under the creep, told apart at any zoom (Collins, Oct 1 2026: "there should
 * be some clear visual distinction between lanes and roofs covered in creep even at far zoom").
 *
 * WHY THIS IS NEEDED: a street is a trench one or two cells wide between blocks. From this camera
 * the block in FRONT of a one-cell street hides most of its floor (a level rises 30 px, the floor
 * is 38 px deep), so at a distance a street is seen almost only as the WALL of the block behind
 * it. Under the creep that wall carries the same red drips as the roofs, and the street vanishes
 * into one red slab.
 *
 * WHAT IT DOES: the trench is washed in a pale wet film: the street's floor, and every wall face
 * that looks down onto a creeped street. The roofs stay the dark hide. The wash fades in as the
 * camera pulls back (`washAlpha`, by how wide a cell is on the screen) and is gone up close, where
 * the painted floor and walls read on their own. It is drawn at the depth of the skin it lies on,
 * so units in the street are drawn over it and blocks in front of it hide it as they hide the street.
 *
 * Plain geometry here (tested in tests/laneWash.test.ts); IsoRenderer.syncCreep places it.
 */
import { FillGradient, Graphics } from 'pixi.js';

/** The wash's colour: wet pale flesh, lighter than any roof hide and close to the street film. */
export const WASH_FILL = 0xe2c9b6;
/** The roof's lip over a washed wall: a dark line, so the roof's edge is crisp against the wall. */
export const WASH_LIP = 0x2a0d0d;
/** The wall is darker than the floor, darkest under the roof's lip: the trench reads as a trench, lit from above. */
export const WALL_SHADE = 0.82;
export const WALL_TOP = 0.58;

/**
 * How strongly the wash shows, from how wide one cell is on the screen (px): nothing at 130 px and
 * wider (near), rising to its full strength at 52 px and narrower (far).
 */
export function washAlpha(cellPx: number): number {
  const NEAR = 130, FAR = 52, MAX = 0.82;
  const k = Math.max(0, Math.min(1, (NEAR - cellPx) / (NEAR - FAR)));
  // Smooth at both ends: no visible step while zooming.
  return MAX * k * k * (3 - 2 * k);
}

export type Poly = number[];

/**
 * The polygons, relative to a tile's corner as the renderer places tiles (tileAt): the diamond's
 * top at (a, 0), right (2a, b), bottom (a, 2b), left (0, b).
 */
export const floorPoly = (a: number, b: number): Poly => [a, 0, 2 * a, b, a, 2 * b, 0, b];
/** The face toward +view y (lower left), `drop` px tall, hanging from the tile's lower-left edge. */
export const southFace = (a: number, b: number, drop: number): Poly => [0, b, a, 2 * b, a, 2 * b + drop, 0, b + drop];
/** The face toward +view x (lower right). */
export const eastFace = (a: number, b: number, drop: number): Poly => [a, 2 * b, 2 * a, b, 2 * a, b + drop, a, 2 * b + drop];

/** Multiply a colour's channels by k (0..1). */
export function shade(c: number, k: number): number {
  const ch = (s: number) => Math.round(((c >> s) & 255) * k) << s;
  return ch(16) | ch(8) | ch(0);
}

/** The floor of a creeped street cell. */
export function floorWash(a: number, b: number): Graphics {
  return new Graphics().poly(floorPoly(a, b)).fill({ color: WASH_FILL });
}

/** One gradient for every wall (it is laid over each shape's own bounds): dark under the lip, light at the foot. */
let wallFill: FillGradient | null = null;
function wallGradient(): FillGradient {
  wallFill ??= new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
    colorStops: [
      { offset: 0, color: shade(WASH_FILL, WALL_TOP) },
      { offset: 0.35, color: shade(WASH_FILL, WALL_SHADE) },
      { offset: 1, color: shade(WASH_FILL, 0.97) },
    ],
  });
  return wallFill;
}

/** A wall face looking down onto a creeped street, with the roof's lip along its top. */
export function wallWash(a: number, b: number, drop: number, side: 'south' | 'east'): Graphics {
  const poly = side === 'south' ? southFace(a, b, drop) : eastFace(a, b, drop);
  const g = new Graphics().poly(poly).fill(wallGradient());
  const lip = side === 'south' ? [0, b, a, 2 * b] : [a, 2 * b, 2 * a, b];
  g.moveTo(lip[0], lip[1]).lineTo(lip[2], lip[3]).stroke({ color: WASH_LIP, width: 5, alpha: 0.9 });
  return g;
}
