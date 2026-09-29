/**
 * The baked art (public/art/manifest.json, written by tools/art/). Anything the manifest
 * does not list is drawn as its old shape, so art can arrive one asset at a time and a
 * missing or broken file never stops the game.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';
import type { BiomeArt } from './biome';

export { pickBiome, type BiomeArt } from './biome';

export interface Clip { start: number; count: number; fps: number }
export type View = 'S' | 'SW' | 'W' | 'NW' | 'N';

export interface UnitArt {
  atlas: string; frame: number; cols: number; anchor: [number, number];
  /** The body's width as a share of the frame's. */
  body: number;
  flies: boolean;
  anims: { walk: Partial<Record<View, Clip>>; attack?: Partial<Record<View, Clip>> };
}
export interface LimbArt {
  atlas: string; frame: number; cols: number; anchor: [number, number]; body: number;
  on: 'roof' | 'street'; flat?: boolean; facing?: boolean;
  anims: { idle: Clip; fire?: Clip };
}
export interface Rect { x: number; y: number; w: number; h: number; anchor?: [number, number]; on?: string }
export interface BoardArt {
  tile: [number, number]; level: number; wallSpan: number;
  sheets: Partial<Record<'floors' | 'creep' | 'walls' | 'props', { atlas: string; sprites: Record<string, Rect> }>>;
  core?: { atlas: string; frame: number; cols: number; count: number; fps: number; anchor: [number, number]; cells: number };
}
/** What one tile set holds of its own; everything else is the terrain entry's. */
export interface BiomeData { sheets: Partial<Record<'floors' | 'walls' | 'props', { atlas: string; sprites: Record<string, Rect> }>> }
export interface ShipArt {
  rooms: Record<string, string>; leaders: Record<string, string>;
  exterior?: string; planet?: string;
  yoke?: { atlas: string; frame: number; cols: number; faces: string[] };
  sketches?: { atlas: string; frame: number; cols: number; ids: string[] };
}
export interface Manifest {
  version: number;
  units: Record<string, UnitArt>;
  limbs: Record<string, LimbArt>;
  board: { terrain?: BoardArt };
  biomes?: Record<string, BiomeArt>;
  ship: { ship?: ShipArt };
}

const BASE = './art/';
export const artUrl = (file: string): string => BASE + file;

let manifest: Manifest | null | undefined;

/** The manifest, or null when there is no art (then everything is drawn as shapes). */
export async function loadManifest(): Promise<Manifest | null> {
  if (manifest !== undefined) return manifest;
  try {
    const res = await fetch(artUrl('manifest.json'), { cache: 'no-cache' });
    manifest = res.ok ? (await res.json() as Manifest) : null;
  } catch {
    manifest = null;
  }
  return manifest;
}

/** One atlas and the frames cut from it. */
export class Atlas {
  private cut = new Map<string, Texture>();
  constructor(readonly texture: Texture) {}

  /** Frame number `i` of a grid of square frames. */
  frame(i: number, size: number, cols: number): Texture {
    return this.rect(`f${i}`, (i % cols) * size, Math.floor(i / cols) * size, size, size);
  }

  /** A named rectangle. */
  sprite(id: string, r: Rect): Texture {
    return this.rect(id, r.x, r.y, r.w, r.h);
  }

  private rect(key: string, x: number, y: number, w: number, h: number): Texture {
    let t = this.cut.get(key);
    if (!t) {
      t = new Texture({ source: this.texture.source, frame: new Rectangle(x, y, w, h) });
      this.cut.set(key, t);
    }
    return t;
  }
}

/** Everything the board draws with, loaded. A file that fails to load is left out. */
export class BoardArtSet {
  units = new Map<string, { art: UnitArt; atlas: Atlas }>();
  limbs = new Map<string, { art: LimbArt; atlas: Atlas }>();
  sheets = new Map<string, { atlas: Atlas; sprites: Record<string, Rect> }>();
  /** The tile set's own sheets: looked in first. */
  own = new Map<string, { atlas: Atlas; sprites: Record<string, Rect> }>();
  biome: { id: string; art: BiomeArt } | null = null;
  core: { art: NonNullable<BoardArt['core']>; atlas: Atlas } | null = null;
  terrain: BoardArt | null = null;
  /** What could not be loaded, for the console and the tests. */
  failed: string[] = [];

  static async load(m: Manifest, biome: string | null = null): Promise<BoardArtSet> {
    const set = new BoardArtSet();
    const get = async (file: string): Promise<Atlas | null> => {
      try {
        return new Atlas(await Assets.load<Texture>(artUrl(file)));
      } catch {
        set.failed.push(file);
        return null;
      }
    };
    const jobs: Array<Promise<void>> = [];
    for (const [id, art] of Object.entries(m.units ?? {})) {
      jobs.push(get(art.atlas).then((atlas) => { if (atlas) set.units.set(id, { art, atlas }); }));
    }
    for (const [id, art] of Object.entries(m.limbs ?? {})) {
      jobs.push(get(art.atlas).then((atlas) => { if (atlas) set.limbs.set(id, { art, atlas }); }));
    }
    const t = m.board?.terrain;
    if (t) {
      for (const [name, sheet] of Object.entries(t.sheets)) {
        if (!sheet) continue;
        jobs.push(get(sheet.atlas).then((atlas) => { if (atlas) set.sheets.set(name, { atlas, sprites: sheet.sprites }); }));
      }
      if (t.core) {
        const core = t.core;
        jobs.push(get(core.atlas).then((atlas) => { if (atlas) set.core = { art: core, atlas }; }));
      }
    }
    const chosen = biome ? m.biomes?.[biome] : undefined;
    if (biome && chosen) {
      set.biome = { id: biome, art: chosen };
      if (chosen.data) {
        const file = chosen.data;
        jobs.push((async () => {
          try {
            const res = await fetch(artUrl(file), { cache: 'no-cache' });
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json() as BiomeData;
            await Promise.all(Object.entries(data.sheets).map(async ([name, sheet]) => {
              if (!sheet) return;
              const atlas = await get(sheet.atlas);
              if (atlas) set.own.set(name, { atlas, sprites: sheet.sprites });
            }));
          } catch {
            set.failed.push(file);
          }
        })());
      }
    }
    await Promise.all(jobs);
    // A tile set with a piece missing would be a city of two styles: it is drawn as the first set instead.
    if (set.biome?.art.data && !(set.own.has('floors') && set.own.has('walls'))) {
      set.own.clear();
      set.biome = m.biomes?.orthodox ? { id: 'orthodox', art: m.biomes.orthodox } : null;
    }
    // The board needs its floors and its walls; without them the isometric view has nothing to stand on.
    set.terrain = t && set.sheets.has('floors') && set.sheets.has('walls') ? t : null;
    if (set.failed.length) console.warn(`[art] could not load: ${set.failed.join(', ')}`);
    return set;
  }

  /** The sheet that holds a sprite: the tile set's own, or the one every set shares. */
  private holder(sheet: string, id: string): { atlas: Atlas; sprites: Record<string, Rect> } | null {
    const mine = this.own.get(sheet);
    if (mine?.sprites[id]) return mine;
    const shared = this.sheets.get(sheet);
    return shared?.sprites[id] ? shared : null;
  }

  sprite(sheet: string, id: string): Texture | null {
    const s = this.holder(sheet, id);
    // The two sheets cut their frames under different keys: a name can be in both.
    return s ? s.atlas.sprite(id, s.sprites[id]) : null;
  }

  rect(sheet: string, id: string): Rect | null {
    return this.holder(sheet, id)?.sprites[id] ?? null;
  }
}
