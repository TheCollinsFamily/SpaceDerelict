/**
 * The board's isometric geometry. The same numbers as tools/art/lib/iso.mjs, which bakes
 * the art: a cell is a diamond TILE_W wide and TILE_H tall, and one level of a block rises
 * LEVEL_H on the screen.
 *
 * THE CAMERA TURNS in quarter turns (Q and E). The world is first turned into VIEW
 * coordinates, then drawn as if it had never turned: view x runs down-right on the screen
 * and view y runs down-left, so the two faces of a block that the camera sees are the one
 * toward +view y (on the left) and the one toward +view x (on the right). With no turn,
 * view and world are the same, and those two faces are the south and the east.
 *
 * No Pixi in here: it is plain arithmetic, tested in tests/iso.test.ts.
 */
export type Turn = 0 | 1 | 2 | 3;

export interface IsoGeo {
  /** Half a tile's width: how far one cell step moves a point across the screen. */
  a: number;
  /** Half a tile's height: how far one cell step moves a point down the screen. */
  b: number;
  /** Screen height of one level of a block. */
  level: number;
  /** World pixels per cell (the sim's cellPx). */
  cell: number;
  /** How many quarter turns the camera has turned. */
  turn: Turn;
  /** The board's size in cells: what it turns within. */
  w: number;
  h: number;
}

export const isoGeo = (tile: [number, number], level: number, cell: number, turn: Turn = 0, w = 0, h = 0): IsoGeo =>
  ({ a: tile[0] / 2, b: tile[1] / 2, level, cell, turn, w, h });

export interface Pt { x: number; y: number }

/** A place on the board, in cells, as the turned camera sees it. */
export function toView(g: IsoGeo, cx: number, cy: number): Pt {
  switch (g.turn) {
    case 1: return { x: g.h - cy, y: cx };
    case 2: return { x: g.w - cx, y: g.h - cy };
    case 3: return { x: cy, y: g.w - cx };
    default: return { x: cx, y: cy };
  }
}

/** And back: the place on the board of a place in the view. */
export function fromView(g: IsoGeo, vx: number, vy: number): Pt {
  switch (g.turn) {
    case 1: return { x: vy, y: g.h - vx };
    case 2: return { x: g.w - vx, y: g.h - vy };
    case 3: return { x: g.w - vy, y: vx };
    default: return { x: vx, y: vy };
  }
}

/** A step on the board as the turned camera sees it (a direction: it turns, it does not move). */
export function dirToView(g: IsoGeo, dx: number, dy: number): Pt {
  switch (g.turn) {
    case 1: return { x: -dy, y: dx };
    case 2: return { x: -dx, y: -dy };
    case 3: return { x: dy, y: -dx };
    default: return { x: dx, y: dy };
  }
}

/** The size of the view in cells: a quarter turn swaps the board's width and height. */
export const viewSize = (g: IsoGeo): { w: number; h: number } =>
  (g.turn % 2 ? { w: g.h, h: g.w } : { w: g.w, h: g.h });

/** The cell of the view that a cell of the board is drawn in. */
export function viewCell(g: IsoGeo, cx: number, cy: number): Pt {
  const v = toView(g, cx + 0.5, cy + 0.5);
  return { x: Math.floor(v.x), y: Math.floor(v.y) };
}

/** The cell of the board that is drawn in a cell of the view. */
export function boardCell(g: IsoGeo, vx: number, vy: number): Pt {
  const c = fromView(g, vx + 0.5, vy + 0.5);
  return { x: Math.floor(c.x), y: Math.floor(c.y) };
}

/** A world point, `up` levels above the ground, on the screen. */
export function project(g: IsoGeo, wx: number, wy: number, up = 0): Pt {
  const v = toView(g, wx / g.cell, wy / g.cell);
  return { x: (v.x - v.y) * g.a, y: (v.x + v.y) * g.b - up * g.level };
}

/** The world point that a screen point shows, if what it shows is `up` levels above the ground. */
export function unproject(g: IsoGeo, sx: number, sy: number, up = 0): Pt {
  const sum = (sy + up * g.level) / g.b;
  const dif = sx / g.a;
  const c = fromView(g, (sum + dif) / 2, (sum - dif) / 2);
  return { x: c.x * g.cell, y: c.y * g.cell };
}

/** How far back a thing is: bigger is nearer the camera and drawn later. */
export function depth(g: IsoGeo, wx: number, wy: number): number {
  const v = toView(g, wx / g.cell, wy / g.cell);
  return v.x + v.y;
}

/**
 * What a screen point shows: the view ray is followed down from above the tallest block
 * until it enters something solid. `heightAt` gives the height in levels of the ground
 * under a world point (0 for a street). Returns the world point hit and whether it is on a
 * roof or a street (`top`) or on the face of a wall.
 */
export function pick(
  g: IsoGeo, sx: number, sy: number, heightAt: (wx: number, wy: number) => number, maxLevels = 3,
): { x: number; y: number; up: number; top: boolean } {
  const STEP = 0.125;
  for (let up = maxLevels; up > 0; up -= STEP) {
    const p = unproject(g, sx, sy, up);
    const h = heightAt(p.x, p.y);
    if (h >= up) {
      // Entering at the height of the roof itself is the roof; lower down is a wall.
      const top = h - up < STEP;
      if (top) { const r = unproject(g, sx, sy, h); return { x: r.x, y: r.y, up: h, top: true }; }
      return { x: p.x, y: p.y, up, top: false };
    }
  }
  const p = unproject(g, sx, sy, 0);
  return { x: p.x, y: p.y, up: 0, top: true };
}

export type Heading = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
const HEADINGS: Heading[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

/** The heading, as seen on the screen, of a step of (dx, dy) in the world. */
export function headingOf(g: IsoGeo, dx: number, dy: number): Heading {
  const v = dirToView(g, dx, dy);
  const sx = (v.x - v.y) * g.a;
  const sy = (v.x + v.y) * g.b;
  // The screen is squashed top to bottom: undo that, so the eight headings share the turn evenly.
  const ang = Math.atan2(sy * (g.a / g.b), sx);
  return HEADINGS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

/** Five views are drawn; the three that face right are the left ones mirrored. */
export function viewOf(h: Heading): { view: 'S' | 'SW' | 'W' | 'NW' | 'N'; mirror: boolean } {
  switch (h) {
    case 'SE': return { view: 'SW', mirror: true };
    case 'E': return { view: 'W', mirror: true };
    case 'NE': return { view: 'NW', mirror: true };
    default: return { view: h, mirror: false };
  }
}

/** The four ways a limb can face in the world. */
export type Facing = 'N' | 'E' | 'S' | 'W';
const FACING_STEP: Record<Facing, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

/** The way of the four that a step in the world is nearest to. */
export function facingOf(dx: number, dy: number): Facing {
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : (dy >= 0 ? 'S' : 'N');
}

/**
 * Which picture of a limb the camera sees. Two are drawn: from the front (the limb faces
 * the lower left of the screen) and from behind (it faces the upper right). The other two
 * ways it can face are those mirrored. It faces a way in the WORLD: when the camera turns,
 * another side of it is seen.
 */
export function limbView(g: IsoGeo, facing: Facing): { back: boolean; mirror: boolean } {
  const [dx, dy] = FACING_STEP[facing];
  const v = dirToView(g, dx, dy);
  if (v.y > 0) return { back: false, mirror: false }; // down-left
  if (v.x > 0) return { back: false, mirror: true }; // down-right
  if (v.y < 0) return { back: true, mirror: false }; // up-right
  return { back: true, mirror: true }; // up-left
}

/** Which of a texture's places along a wall a cell of the view shows (see tools/art/lib/iso.mjs mirrorTile). */
export const wallIndex = (side: 'south' | 'east', vx: number, vy: number, span: number): number => {
  const n = 2 * span;
  return side === 'south' ? ((vx % n) + n) % n : n - 1 - (((vy % n) + n) % n);
};

/**
 * Which sides of a creeped cell are open: a bit per side, 1 north, 2 east, 4 south, 8 west
 * (of the view). The creep tile for that number has a ragged edge on exactly those sides.
 * `same(dx, dy)` says whether the creep runs on into the cell that way.
 */
export function openSides(same: (dx: number, dy: number) => boolean): number {
  return (same(0, -1) ? 0 : 1) | (same(1, 0) ? 0 : 2) | (same(0, 1) ? 0 : 4) | (same(-1, 0) ? 0 : 8);
}

/**
 * Does the creep of a cell run on, unbroken, toward a neighbour? It stops at a ragged edge
 * only where the SAME surface goes on bare. At the edge of a roof it runs right up to the
 * edge (and down the wall), so a roof the body holds is held to its edge and a limb has the
 * whole of its cell to stand on (Collins, Sep 29 2026: "the convention of the creep not
 * actually going to the edge makes the usable space in a square highly variable").
 */
export function creepRunsOn(
  here: { height: number }, there: { height: number; creeped: boolean } | null,
): boolean {
  if (!there) return true;
  if (there.height !== here.height) return true;
  return there.creeped;
}
