/**
 * A PICTURE OF A DISTRICT BEFORE IT IS TAKEN (Sep 30 2026). The district draft offers plates;
 * each card shows the plate drawn exactly as the board will draw it: its streets, squares and
 * blocks at their heights, the facades and roofs of the board's tile set (or of the guest set
 * that district will be drawn in), the things on its roofs and in its streets. It is built
 * from the same sprites, by the same rules, as IsoRenderer.syncMap at the camera's first turn,
 * and rendered once into a small picture.
 *
 * A Temple Heights plate raises a few of its roofs by chance when it is stamped: the preview
 * cannot know which, and shows the plate as drawn.
 */
import { Container, Sprite, type Application, type Texture } from 'pixi.js';
import type { BoardArtSet } from './art';
import { buildingsOf, pickVariant, planGuests, variantName } from './biome';
import { wallIndex } from './iso';
import { CellType, PLATE, type PlatePattern } from '../sim/citymap';

const ROOF_TINT = [0xb9a783, 0xd0bd96, 0xe6d3aa];
const CELL: Record<string, { t: CellType; h: number }> = {
  '#': { t: CellType.Block, h: 1 }, A: { t: CellType.Block, h: 2 }, B: { t: CellType.Block, h: 3 },
  '.': { t: CellType.Road, h: 0 }, P: { t: CellType.Plaza, h: 0 },
};

export interface PlateBoard { gridW: number; slotsX: number; slotsY: number; coreCell: number; seed: number }

/** The tile set a district of this board is drawn with (IsoRenderer.setOfSlot, for a slot not yet taken). */
export function setOfSlot(art: BoardArtSet, board: PlateBoard, slot: number): string | null {
  const home = art.biome?.id ?? null;
  const guests = art.guests();
  if (!home || !guests.length) return home;
  const start = Math.floor(Math.floor(board.coreCell / board.gridW) / PLATE) * board.slotsX + Math.floor((board.coreCell % board.gridW) / PLATE);
  return planGuests({ slotsX: board.slotsX, slotsY: board.slotsY, start, seed: board.seed | 0 }, guests).get(slot) ?? home;
}

/**
 * The plate as a picture (a data URL), `width` pixels wide; null when the board's pieces are
 * not there (the old top-down board).
 */
export function platePicture(
  app: Application, art: BoardArtSet, board: PlateBoard,
  offer: { pattern: PlatePattern; slot: number; feature: string }, width = 300,
): string | null {
  const t = art.terrain;
  if (!t) return null;
  const a = t.tile[0] / 2;
  const b = t.tile[1] / 2;
  const level = t.level;
  const span = t.wallSpan;
  const set = setOfSlot(art, board, offer.slot);
  const sx = (offer.slot % board.slotsX) * PLATE;
  const sy = Math.floor(offer.slot / board.slotsX) * PLATE;
  const cells: number[] = [];
  const heights: number[] = [];
  for (let y = 0; y < PLATE; y++) for (let x = 0; x < PLATE; x++) {
    const c = CELL[offer.pattern.rows[y][x]] ?? CELL['#'];
    cells.push(c.t);
    heights.push(c.h);
  }
  const hL = (x: number, y: number) => (x < 0 || y < 0 || x >= PLATE || y >= PLATE ? 0 : cells[y * PLATE + x] === CellType.Block ? heights[y * PLATE + x] : 0);
  // A building's number is the board cell it was found from, as on the board, so its look is the same.
  const local = buildingsOf(cells, heights, PLATE, PLATE, CellType.Block, PLATE);
  const building = (i: number) => (local[i] < 0 ? -1 : (sy + Math.floor(local[i] / PLATE)) * board.gridW + sx + (local[i] % PLATE));

  const root = new Container();
  const floors = new Container();
  const sorted = new Container();
  sorted.sortableChildren = true;
  root.addChild(floors, sorted);
  const put = (layer: Container, tex: Texture | null, x: number, y: number, z = 0): Sprite | null => {
    if (!tex) return null;
    const s = new Sprite(tex);
    s.position.set(x, y);
    s.zIndex = z;
    layer.addChild(s);
    return s;
  };
  const prop = (id: string): Sprite | null => {
    const tex = art.sprite('props', id, set);
    const r = art.rect('props', id, set);
    if (!tex || !r) return null;
    const s = new Sprite(tex);
    s.anchor.set(r.anchor?.[0] ?? 0.5, r.anchor?.[1] ?? 0.94);
    return s;
  };
  const kind = offer.feature;
  const biome = art.biomeArt(set);
  for (let y = 0; y < PLATE; y++) for (let x = 0; x < PLATE; x++) {
    const i = y * PLATE + x;
    const gx = sx + x;
    const gy = sy + y;
    const ij = `${gx % 4}${gy % 4}`;
    const px = (x - y) * a - a;
    const py = (x + y) * b;
    if (cells[i] !== CellType.Block) {
      const name = cells[i] === CellType.Plaza ? 'plaza' : 'street';
      const floor = variantName(name, pickVariant(art.variantsOf(set, name), offer.slot * 31 + 7));
      put(floors, art.sprite('floors', `${floor}-${ij}`, set) ?? art.sprite('floors', `${name}-${ij}`, set), px, py);
      // What stands in the street: as IsoRenderer.addStreetProp, by the same numbers.
      const square = cells[i] === CellType.Plaza;
      const behind = hL(x, y - 1) > 0;
      const beside = hL(x - 1, y) > 0;
      const r = ((gx * 15485863 + gy * 32452843 + gx * gy * 131) >>> 0) % 1000;
      if (square ? r < 90 : r < 110 && (behind || beside)) {
        const all = biome?.streetProps ?? [];
        const fits = all.filter((id) => { const rc = art.rect('props', `prop-${id}`, set); return rc !== null && (square || rc.w <= a * 0.62); });
        const s = fits.length ? prop(`prop-${fits[(r * 7 + gx + gy) % fits.length]}`) : null;
        if (s) {
          const at = square ? [0.5, 0.5] : behind ? [0.5, 0.14] : [0.14, 0.5];
          s.position.set((x + at[0] - y - at[1]) * a, (x + at[0] + y + at[1]) * b);
          s.zIndex = (x + y + at[0] + at[1]) * 100 + 45;
          sorted.addChild(s);
        }
      }
      continue;
    }
    const h = hL(x, y);
    const z = (x + y + 1) * 100;
    const bld = building(i);
    const wall = variantName(kind, pickVariant(art.variantsOf(set, `wall-${kind}`), bld * 17 + 3));
    const roofName = variantName('roof', pickVariant(art.variantsOf(set, 'roof'), bld * 29 + 11));
    const face = (side: 'south' | 'east', l: number) => {
      const k = wallIndex(side, gx, gy, span);
      return art.sprite('walls', `wall-${wall}-${side}-${l}-${k}`, set) ?? art.sprite('walls', `wall-${kind}-${side}-${l}-${k}`, set);
    };
    for (let l = hL(x, y + 1); l < h; l++) put(sorted, face('south', l), px, py + b - (l + 1) * level, z);
    for (let l = hL(x + 1, y); l < h; l++) put(sorted, face('east', l), px + a, py + b - (l + 1) * level, z);
    const roof = put(sorted, art.sprite('floors', `${roofName}-${ij}`, set) ?? art.sprite('floors', `roof-${ij}`, set), px, py - h * level, z + 1);
    if (roof) roof.tint = (biome?.roofTint ?? ROOF_TINT)[Math.min(h, 3) - 1] ?? 0xffffff;
    if (hL(x, y - 1) > h) put(sorted, art.sprite('creep', 'edge-shade-north'), px, py - h * level, z + 4);
    if (hL(x - 1, y) > h) put(sorted, art.sprite('creep', 'edge-shade-west'), px, py - h * level, z + 4);
    // What stands on the roof: as IsoRenderer.addProp.
    const r = ((gx * 7919 + gy * 104729 + gx * gy * 31) >>> 0) % 100;
    const list = biome?.roofProps?.[kind] ?? biome?.roofProps?.plain ?? [];
    if (r < 22 && list.length) {
      const s = prop(`prop-${list[((gx * 2246822519 + gy * 3266489917) >>> 0) % list.length]}`);
      if (s) {
        s.position.set((x + 0.5 - y - 0.5) * a, (x + 0.5 + y + 0.5) * b - h * level);
        s.zIndex = z + 5;
        sorted.addChild(s);
      }
    }
  }
  try {
    const bounds = root.getLocalBounds();
    const canvas = app.renderer.extract.canvas({ target: root, resolution: width / Math.max(1, bounds.width) }) as HTMLCanvasElement;
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('[draft] the plate preview could not be drawn', e);
    return null;
  } finally {
    root.destroy({ children: true });
  }
}
