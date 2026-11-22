/**
 * Where an organ picked in the organ stage lands for a hovered cell (Collins, Nov 22 2026: "if I try to place an
 * auxiliary heart to the left or right of the tendril root it looks like its placeable but if I try to place it
 * vertically under it signals its not placeable").
 *
 * The board used to anchor the organ's shape by its top-left corner on the hovered cell, so a two-wide organ hovered
 * under the root's cell always ran off to the RIGHT of the pointer; when the cell to the right was rock or taken, it
 * showed red even though the same organ one cell to the left (still under the pointer) would grow. Now every placement
 * of the shape (at the current turn) that COVERS the hovered cell is a candidate: a legal one is preferred, then the
 * one whose middle is nearest the pointer. The preview and the click both ask this one function, so what is shown is
 * exactly what a click grows (src/ui/underground.ts).
 */
import type { Sim } from '../sim/sim';
import type { OrganId } from '../sim/types';

export type OrganBoard = Pick<Sim, 'organFootprint' | 'canBuildOrgan' | 'under'>;

/**
 * The anchor cell (what `build-organ` takes) for `organ` at turn `rot` hovered on `cell`, the pointer at board
 * coordinates (`px`, `py`) in cells (a cell's middle is its column/row index; defaults to the hovered cell's middle).
 */
export function placementAnchor(sim: OrganBoard, organ: OrganId, cell: number, rot: number, px?: number, py?: number): { anchor: number; cells: number[] | null; ok: boolean } {
  const u = sim.under;
  const x = px ?? cell % u.w;
  const y = py ?? Math.floor(cell / u.w);
  let best: { anchor: number; cells: number[]; ok: boolean; d: number } | null = null;
  for (let a = 0; a < u.cells.length; a++) {
    const cells = sim.organFootprint(organ, a, rot);
    if (!cells || !cells.includes(cell)) continue;
    const ok = sim.canBuildOrgan(organ, a, rot);
    const mx = cells.reduce((s, c) => s + (c % u.w), 0) / cells.length;
    const my = cells.reduce((s, c) => s + Math.floor(c / u.w), 0) / cells.length;
    // Ties (a pointer exactly between two) go to the old corner anchor, then the lower index.
    const d = Math.hypot(mx - x, my - y) - (a === cell ? 1e-6 : 0);
    if (!best || (ok && !best.ok) || (ok === best.ok && d < best.d)) best = { anchor: a, cells, ok, d };
  }
  if (!best) return { anchor: cell, cells: sim.organFootprint(organ, cell, rot), ok: false };
  return { anchor: best.anchor, cells: best.cells, ok: best.ok };
}
