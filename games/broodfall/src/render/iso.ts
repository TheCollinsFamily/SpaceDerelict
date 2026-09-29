/**
 * The board's isometric geometry. The same numbers as tools/art/lib/iso.mjs, which bakes
 * the art: a cell is a diamond TILE_W wide and TILE_H tall, and one level of a block rises
 * LEVEL_H on the screen.
 *
 * World x runs down-right on the screen and world y runs down-left, so the two faces of a
 * block that the camera sees are its south face (on the left) and its east face (on the right).
 *
 * No Pixi in here: it is plain arithmetic, tested in tests/iso.test.ts.
 */
export interface IsoGeo {
  /** Half a tile's width: how far one cell step moves a point across the screen. */
  a: number;
  /** Half a tile's height: how far one cell step moves a point down the screen. */
  b: number;
  /** Screen height of one level of a block. */
  level: number;
  /** World pixels per cell (the sim's cellPx). */
  cell: number;
}

export const isoGeo = (tile: [number, number], level: number, cell: number): IsoGeo =>
  ({ a: tile[0] / 2, b: tile[1] / 2, level, cell });

export interface Pt { x: number; y: number }

/** A world point, `up` levels above the ground, on the screen. */
export function project(g: IsoGeo, wx: number, wy: number, up = 0): Pt {
  const cx = wx / g.cell;
  const cy = wy / g.cell;
  return { x: (cx - cy) * g.a, y: (cx + cy) * g.b - up * g.level };
}

/** The world point that a screen point shows, if what it shows is `up` levels above the ground. */
export function unproject(g: IsoGeo, sx: number, sy: number, up = 0): Pt {
  const sum = (sy + up * g.level) / g.b;
  const dif = sx / g.a;
  return { x: ((sum + dif) / 2) * g.cell, y: ((sum - dif) / 2) * g.cell };
}

/** How far back a thing is: bigger is nearer the camera and drawn later. */
export const depth = (g: IsoGeo, wx: number, wy: number): number => (wx + wy) / g.cell;

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
  const s = project(g, dx, dy);
  // The screen is squashed top to bottom: undo that, so the eight headings share the turn evenly.
  const ang = Math.atan2(s.y * (g.a / g.b), s.x);
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

/** Which of a texture's places along a wall a cell shows (see tools/art/lib/iso.mjs mirrorTile). */
export const wallIndex = (side: 'south' | 'east', cx: number, cy: number, span: number): number => {
  const n = 2 * span;
  return side === 'south' ? ((cx % n) + n) % n : n - 1 - (((cy % n) + n) % n);
};

/**
 * Which sides of a creeped cell are open (the ground next to it is bare, or at another
 * height): a bit per side, 1 north, 2 east, 4 south, 8 west. The creep tile for that
 * number has a ragged edge on exactly those sides.
 */
export function openSides(same: (dx: number, dy: number) => boolean): number {
  return (same(0, -1) ? 0 : 1) | (same(1, 0) ? 0 : 2) | (same(0, 1) ? 0 : 4) | (same(-1, 0) ? 0 : 8);
}
