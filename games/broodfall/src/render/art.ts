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
/** One view of a limb: the point of its frame that stands on the middle of its ground, how wide what it stands on is (a share of the frame), and its clips. */
export interface LimbSide { anchor: [number, number]; body: number; anims: { idle: Clip; fire?: Clip } }
export interface LimbArt extends LimbSide {
  atlas: string; frame: number; cols: number;
  on: 'roof' | 'street'; flat?: boolean; facing?: boolean;
  /** The view from behind, of a limb that is not the same all the way round. */
  back?: LimbSide;
}
export interface Rect { x: number; y: number; w: number; h: number; anchor?: [number, number]; on?: string }
export interface BoardArt {
  tile: [number, number]; level: number; wallSpan: number;
  sheets: Partial<Record<'floors' | 'creep' | 'walls' | 'props', { atlas: string; sprites: Record<string, Rect> }>>;
  core?: {
    atlas: string; frame: number; cols: number; count: number; fps: number; anchor: [number, number];
    /** How many cells wide what it stands on is, and how wide that is as a share of the frame. */
    cells: number; body?: number;
    /** The crater and its roots, painted from straight above and laid on the ground by the game: the file, and how many cells wide it is. */
    ground?: { file: string; cells: number };
  };
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
  /** The sheets of every tile set on this board (its own set and that set's guests): looked in first. */
  sets = new Map<string, { art: BiomeArt; sheets: Map<string, { atlas: Atlas; sprites: Record<string, Rect> }> }>();
  /** The board's own tile set. */
  biome: { id: string; art: BiomeArt } | null = null;
  /** The crater and roots of the landing site, painted from straight above. */
  coreGround: Texture | null = null;
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
    if (t?.core?.ground) {
      const file = t.core.ground.file;
      jobs.push((async () => {
        try {
          set.coreGround = await Assets.load<Texture>(artUrl(file));
          // It is drawn smaller than it is painted, and its roots are thin: smaller copies of it keep them whole.
          set.coreGround.source.autoGenerateMipmaps = true;
          set.coreGround.source.updateMipmaps();
        } catch {
          set.failed.push(file);
        }
      })());
    }
    const chosen = biome ? m.biomes?.[biome] : undefined;
    const wanted = biome && chosen ? [biome, ...(chosen.guests ?? []).filter((id) => id !== biome && m.biomes?.[id])] : [];
    for (const id of wanted) {
      const art = m.biomes![id];
      const sheets = new Map<string, { atlas: Atlas; sprites: Record<string, Rect> }>();
      set.sets.set(id, { art, sheets });
      if (!art.data) continue;
      const file = art.data;
      jobs.push((async () => {
        try {
          const res = await fetch(artUrl(file), { cache: 'no-cache' });
          if (!res.ok) throw new Error(String(res.status));
          const data = await res.json() as BiomeData;
          await Promise.all(Object.entries(data.sheets).map(async ([name, sheet]) => {
            if (!sheet) return;
            const atlas = await get(sheet.atlas);
            if (atlas) sheets.set(name, { atlas, sprites: sheet.sprites });
          }));
        } catch {
          set.failed.push(file);
        }
      })());
    }
    await Promise.all(jobs);
    // A tile set with a piece missing would be a city of two styles: a guest like that is left out,
    // and a board whose own set is like that is drawn as the first set instead.
    for (const [id, s] of [...set.sets]) {
      if (s.art.data && !(s.sheets.has('floors') && s.sheets.has('walls'))) set.sets.delete(id);
    }
    if (biome && chosen && set.sets.has(biome)) set.biome = { id: biome, art: chosen };
    else {
      set.sets.clear();
      if (m.biomes?.orthodox) {
        set.biome = { id: 'orthodox', art: m.biomes.orthodox };
        set.sets.set('orthodox', { art: m.biomes.orthodox, sheets: new Map() });
      }
    }
    // The board needs its floors and its walls; without them the isometric view has nothing to stand on.
    set.terrain = t && set.sheets.has('floors') && set.sheets.has('walls') ? t : null;
    if (set.failed.length) console.warn(`[art] could not load: ${set.failed.join(', ')}`);
    return set;
  }

  /** The sheet that holds a sprite: that of the tile set asked for (the board's own if none is), or the one every set shares. */
  private holder(sheet: string, id: string, set?: string | null): { atlas: Atlas; sprites: Record<string, Rect> } | null {
    const mine = this.sets.get(set ?? this.biome?.id ?? '')?.sheets.get(sheet);
    if (mine?.sprites[id]) return mine;
    const shared = this.sheets.get(sheet);
    return shared?.sprites[id] ? shared : null;
  }

  sprite(sheet: string, id: string, set?: string | null): Texture | null {
    const s = this.holder(sheet, id, set);
    return s ? s.atlas.sprite(id, s.sprites[id]) : null;
  }

  rect(sheet: string, id: string, set?: string | null): Rect | null {
    return this.holder(sheet, id, set)?.sprites[id] ?? null;
  }

  /** What a tile set on this board says of itself (its props, its roof tints). */
  biomeArt(set?: string | null): BiomeArt | null {
    return this.sets.get(set ?? this.biome?.id ?? '')?.art ?? this.biome?.art ?? null;
  }

  /** The guests of the board's own set that loaded. */
  guests(): string[] {
    const home = this.biome?.id;
    return [...this.sets.keys()].filter((id) => id !== home);
  }

  /** How many looks a set has of a piece: 'roof', 'street', 'plaza', or 'wall-<kind>'. */
  variantsOf(set: string | null, piece: string): number {
    const v = this.biomeArt(set)?.variants;
    if (!v) return 1;
    if (piece.startsWith('wall-')) return v.walls?.[piece.slice(5)] ?? 1;
    return (v as Record<string, number | undefined>)[piece] as number ?? 1;
  }
}
