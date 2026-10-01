/**
 * Creep on a street is a different COLOUR from creep on a roof (Collins, Oct 1 2026: "They need to
 * have creep, just be visually distinct (like make it a different color, yellow or something) ...
 * because sometimes creep has effects on things walking over it").
 *
 * Three things must never be confused, at any zoom: a bare street (the tile set's own ground), a
 * creeped street (this pus-yellow creep), and a creeped roof (the dark red hide). The street creep
 * is the SAME skin as the roofs' (its veins, its cells, its ragged edges), recoloured once at load
 * through a colour ramp by its own lightness: dark veins stay dark, the flesh turns pus-yellow. It
 * was picked against every tile set's ground (notes/screens/2026-10-01/street-creep-candidates.png):
 * ochre-orange read as the embers strain and the war caste's orange, acid green as the bog strain and
 * the suburb's olive squares; pus-yellow is far from every pale tan or grey ground and from the hide.
 *
 * WHY THE WALLS TOO: a street is a trench one cell wide, and from this camera the block in front of it
 * hides most of its floor; far away a street is seen almost only as the wall of the block behind it.
 * So a wall looking down onto a creeped street wears the street's creep too (`wallCoat`), fading in
 * with distance (`coatAlpha`) so that up close the painted walls and the roof's red drips are seen.
 *
 * Plain arithmetic here (tests/streetCreep.test.ts); BoardArtSet.streetSkin recolours the atlas and
 * IsoRenderer.syncCreep lays it.
 */
import { FillGradient, Graphics, Texture } from 'pixi.js';

export type Rgb = [number, number, number];
/** The street creep's ramp, by the skin's lightness (0 its darkest vein, 1 its brightest flesh). */
export const STREET_RAMP: Array<[number, Rgb]> = [
  [0, [58, 52, 0]],
  [0.14, [186, 176, 8]],
  [0.45, [232, 226, 36]],
  [1, [252, 255, 160]],
];

/** The ramp's colour at lightness l (0..1). */
export function rampColour(l: number, ramp = STREET_RAMP): Rgb {
  const x = Math.max(0, Math.min(1, l));
  for (let i = 1; i < ramp.length; i++) {
    const [o1, c1] = ramp[i];
    if (x <= o1) {
      const [o0, c0] = ramp[i - 1];
      const k = (x - o0) / (o1 - o0 || 1);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as Rgb;
    }
  }
  return ramp[ramp.length - 1][1];
}

const lumOf = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * The lightness the ramp is stretched over: the 2nd to the 98th percentile of the opaque pixels of
 * an RGBA buffer (the skin's own range, so its veins land dark and its flesh bright).
 */
export function lightRange(data: Uint8ClampedArray): [number, number] {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    hist[Math.round(lumOf(data[i], data[i + 1], data[i + 2]) * 255)]++;
    n++;
  }
  if (!n) return [0, 1];
  const at = (q: number) => { let s = 0; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= q * n) return v / 255; } return 1; };
  const lo = at(0.02), hi = at(0.98);
  return hi > lo ? [lo, hi] : [0, 1];
}

/** Recolour an RGBA buffer in place through the ramp (alpha kept). */
export function recolour(data: Uint8ClampedArray, range: [number, number], ramp = STREET_RAMP): void {
  const [lo, hi] = range;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const c = rampColour((lumOf(data[i], data[i + 1], data[i + 2]) - lo) / (hi - lo), ramp);
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
  }
}

/**
 * How strongly a wall's street coat shows, from how wide one cell is on the screen (px): none at 130 px
 * and wider (near: the painted wall and the roof's drips), full at 52 px and narrower (far).
 */
export function coatAlpha(cellPx: number): number {
  const NEAR = 130, FAR = 52, MAX = 0.9;
  const k = Math.max(0, Math.min(1, (NEAR - cellPx) / (NEAR - FAR)));
  return MAX * k * k * (3 - 2 * k);
}

export type Poly = number[];
/**
 * A tile as the renderer places it (tileAt): the diamond's top at (a, 0), right (2a, b), bottom
 * (a, 2b), left (0, b). The face toward +view y (lower left) hangs `drop` px from its lower-left edge,
 * the face toward +view x (lower right) from its lower-right edge.
 */
export const southFace = (a: number, b: number, drop: number): Poly => [0, b, a, 2 * b, a, 2 * b + drop, 0, b + drop];
export const eastFace = (a: number, b: number, drop: number): Poly => [a, 2 * b, 2 * a, b, 2 * a, b + drop, a, 2 * b + drop];

/** Shadow over a coat: dark under the roof's lip, clear at the foot (the trench is lit from above). */
let shadow: FillGradient | null = null;
function shadowFill(): FillGradient {
  shadow ??= new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
    colorStops: [
      { offset: 0, color: 'rgba(20,8,0,0.55)' },
      { offset: 0.45, color: 'rgba(20,8,0,0.15)' },
      { offset: 1, color: 'rgba(20,8,0,0)' },
    ],
  });
  return shadow;
}

/** A wall looking down onto a creeped street, coated in the street's creep (`skin`: a piece of it). */
export function wallCoat(skin: Texture, a: number, b: number, drop: number, side: 'south' | 'east'): Graphics {
  const poly = side === 'south' ? southFace(a, b, drop) : eastFace(a, b, drop);
  const g = new Graphics().poly(poly).fill({ texture: skin, textureSpace: 'local' }).poly(poly).fill(shadowFill());
  const lip = side === 'south' ? [0, b, a, 2 * b] : [a, 2 * b, 2 * a, b];
  // The roof's hide ends in a dark line along the top: the red roof and the yellow wall never blur.
  return g.moveTo(lip[0], lip[1]).lineTo(lip[2], lip[3]).stroke({ color: 0x2a0d0d, width: 5, alpha: 0.9 });
}
