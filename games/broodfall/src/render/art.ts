/**
 * The baked art (public/art/manifest.json, written by tools/art/). Anything the manifest
 * does not list is drawn as its old shape, so art can arrive one asset at a time and a
 * missing or broken file never stops the game.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';
import type { BiomeArt } from './biome';

export { pickBiome, type BiomeArt } from './biome';

/**
 * page: which atlas page the frames are on (a unit's `pages`, Sep 30 2026), when not the first.
 * anchor, scale: a clip cut with a window bigger than the walk's (a fall below a flier, a braced
 * gun's splayed legs): where the walk's feet are in its frame, and how much bigger its frame is.
 */
export interface Clip {
  start: number; count: number; fps: number;
  /** An idle played forward and back, and one that barely moves and breathes (src/render/idleClock.ts, tools/art/templates/limb.mjs). */
  pingpong?: boolean; breathe?: boolean;
  page?: number; anchor?: [number, number]; scale?: number }
export type View = 'S' | 'SW' | 'W' | 'NW' | 'N';

export interface UnitArt {
  atlas: string; frame: number; cols: number; anchor: [number, number];
  /** More atlas pages, when the frames do not fit in one light picture (a clip's `page` is 1 for the first of these). */
  pages?: string[];
  /** The body's width as a share of the frame's. */
  body: number;
  flies: boolean;
  anims: {
    walk: Partial<Record<View, Clip>>; attack?: Partial<Record<View, Clip>>;
    /** A fall that ends still: played once where the unit died. */
    death?: Partial<Record<View, Clip>>;
    /** One frame each, drawn toward the lower left: grounded, deployed, stripped, burrowed, carrying. */
    states?: Partial<Record<'grounded' | 'deployed' | 'stripped' | 'burrowed' | 'carrying', Clip>>;
    /** A flinch when struck, played once (Sep 30 2026). */
    hit?: Partial<Record<View, Clip>>;
    /** A braced gun firing once, from its braced picture (drawn toward the lower left in every view). */
    braced?: Partial<Record<View, Clip>>;
    /** A boss's arrival, played once when it comes on the board, and its special attack. */
    enter?: Partial<Record<View, Clip>>;
    special?: Partial<Record<View, Clip>>;
  } & {
    /** A skin: walking in another look the unit is in (walk-cracked, walk-stripped of the carapace lord). */
    [skin: `walk-${string}`]: Partial<Record<View, Clip>> | undefined;
  };
}
/** A unit's art and its atlas pages, loaded. */
export interface LoadedUnit { art: UnitArt; atlas: Atlas; pages: Atlas[] }
/** One view of a limb: the point of its frame that stands on the middle of its ground, how wide what it stands on is (a share of the frame), and its clips. */
export interface LimbSide {
  anchor: [number, number]; body: number;
  /** fire: its attack, or an engine's acting clip; die: it withers into a husk (played once, Sep 30 2026). */
  anims: { idle: Clip; fire?: Clip; die?: Clip };
  /** Where a donor's part is grafted on it, as shares of its frame, in the order they are used (tools/art/templates/limb.mjs). */
  grafts?: Array<[number, number]>;
  /** Where its shots leave it, as shares of its frame, marked by eye (tools/art/muzzles.mjs); several for a limb that fires from several places. */
  muzzle?: Array<[number, number]>;
}
export interface LimbArt extends LimbSide {
  atlas: string; frame: number; cols: number;
  on: 'roof' | 'street'; flat?: boolean; facing?: boolean;
  /** An upgrade look drawn bigger than its ground calls for (LimbVariantArt.size). */
  size?: number;
  /** The view from behind, of a limb that is not the same all the way round. */
  back?: LimbSide;
  /**
   * Its UPGRADE LOOKS (content/upgradeLooks.ts, tools/art/templates/limb-variant.mjs): a class look
   * (bone, swarm, venom, reach) or a superstructure (`swarm+venom`), each its own atlas and views.
   * Loaded as limbs of their own, named `<family>@<key>` (BoardArtSet.limbs).
   */
  variants?: Record<string, LimbVariantArt>;
}
/** One upgrade look of a limb: drawn like the limb (its own atlas, frame, anchor, clips, view from behind). */
export interface LimbVariantArt extends LimbSide {
  atlas: string; frame: number; cols: number;
  /** Drawn this much bigger than its ground calls for (a superstructure towers over its block). */
  size?: number;
  back?: LimbSide;
}
/**
 * pad: a tile baked on a picture bigger than itself by this many pixels on each side (across,
 * down), so that what it draws past its own edge is not cut off at its corners (the seams, Sep 30
 * 2026, tools/art/templates/terrain.mjs). Its texture is anchored at the tile's own corner.
 */
export interface Rect { x: number; y: number; w: number; h: number; anchor?: [number, number]; on?: string; pad?: [number, number]; res?: number }
/** The creep nodes (tools/art/templates/board.mjs): each look of a node, growing and spreading. */
export interface PodsArt {
  atlas: string; frame: number; cols: number;
  looks: Record<string, { grow: Clip; spread: Clip; body: number; anchor: [number, number] }>;
}
export interface BoardArt {
  tile: [number, number]; level: number; wallSpan: number;
  sheets: Partial<Record<'floors' | 'creep' | 'walls' | 'props' | 'gates' | 'smoke', { atlas: string; sprites: Record<string, Rect> }>>;
  core?: {
    atlas: string; frame: number; cols: number; count: number; fps: number; anchor: [number, number];
    /** How many cells wide what it stands on is, and how wide that is as a share of the frame. */
    cells: number; body?: number;
    /** The crater and its roots, painted from straight above and laid on the ground by the game: the file, and how many cells wide it is. */
    ground?: { file: string; cells: number };
  };
}
/**
 * One clip of the core's stages (tools/art/templates/core-evo.mjs): every clip is cut in the same
 * mapping, so `body` is stage 1's collar as a share of THIS frame and `anchor` where stage 1 stands in it.
 */
export interface CoreClip {
  atlas: string; frame: number; cols: number; count: number; fps: number; anchor: [number, number]; body: number;
  /** An idle whose ends do not meet: the game plays it forward and back (src/render/idleClock.ts). */
  pingpong?: boolean;
  /** More atlas pages when its frames do not fit one picture (the same grid on each): frame i is on page floor(i / perPage). */
  pages?: string[]; perPage?: number;
}
/** The core's four stages: each stage's idle, and the clip of it growing out of the stage before. */
export interface CoreEvoArt {
  cells: number;
  stages: Array<{ id: number; name: string; grown: number; collar: number; idle: CoreClip & { seam?: number }; grow?: CoreClip }>;
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
  /** What walks the streets on the hive's side: the broodling and the puppet queens (tools/art/units.mjs ALLIES). */
  allies?: Record<string, UnitArt>;
  limbs: Record<string, LimbArt>;
  board: { terrain?: BoardArt; pods?: PodsArt; coreEvo?: CoreEvoArt };
  biomes?: Record<string, BiomeArt>;
  ship: { ship?: ShipArt };
  /** What flies, bursts and hangs in the air, and the donor parts (tools/art/templates/fx.mjs). */
  /** `tongue`: the Maw's tongue, a length of it and its sticky tip (src/render/mawTongue.ts). */
  fx?: { fx?: { effects?: FxSheet; parts?: FxSheet; tongue?: FxSheet }; meat?: FxSheet };
  /* `meat`: the meat drops, two looks a caste (tools/art/meat.mjs, src/render/meatFx.ts). */
}
/** A sheet of named sprites; a glow is drawn added onto what is under it. */
export interface FxSheet { atlas: string; sprites: Record<string, Rect & { glow?: boolean }> }

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
    // A padded tile is placed by its own corner: every sprite made of it starts anchored there.
    return this.rect(id, r.x, r.y, r.w, r.h, r.pad ? { x: r.pad[0] / r.w, y: r.pad[1] / r.h } : undefined);
  }

  private rect(key: string, x: number, y: number, w: number, h: number, defaultAnchor?: { x: number; y: number }): Texture {
    let t = this.cut.get(key);
    if (!t) {
      t = new Texture({ source: this.texture.source, frame: new Rectangle(x, y, w, h), defaultAnchor });
      this.cut.set(key, t);
    }
    return t;
  }
}

/** A clip over several atlas pages (a core stage's idle, Sep 30 2026): frame i is frame i % perPage of page floor(i / perPage). */
export class PagedAtlas extends Atlas {
  constructor(private readonly all: Atlas[], private readonly perPage: number) { super(all[0].texture); }
  override frame(i: number, size: number, cols: number): Texture {
    const p = Math.min(this.all.length - 1, Math.floor(i / this.perPage));
    return this.all[p].frame(i - p * this.perPage, size, cols);
  }
}

/** Everything the board draws with, loaded. A file that fails to load is left out. */
export class BoardArtSet {
  units = new Map<string, LoadedUnit>();
  /** The broodling and the puppet queens, by id (broodling, puppet-royal, puppet-consort, puppet-matron). */
  allies = new Map<string, LoadedUnit>();
  limbs = new Map<string, { art: LimbArt; atlas: Atlas }>();
  sheets = new Map<string, { atlas: Atlas; sprites: Record<string, Rect> }>();
  /** The sheets of every tile set on this board (its own set and that set's guests): looked in first. */
  sets = new Map<string, { art: BiomeArt; sheets: Map<string, { atlas: Atlas; sprites: Record<string, Rect> }> }>();
  /** The board's own tile set. */
  biome: { id: string; art: BiomeArt } | null = null;
  /** The crater and roots of the landing site, painted from straight above. */
  coreGround: Texture | null = null;
  core: { art: NonNullable<BoardArt['core']>; atlas: Atlas } | null = null;
  /** The core's stages, when every one of their clips loaded (else the one core above is drawn). */
  coreEvo: { art: CoreEvoArt; idle: Atlas[]; grow: Array<Atlas | null> } | null = null;
  /** The creep nodes, when they are drawn. */
  pods: { art: PodsArt; atlas: Atlas } | null = null;
  terrain: BoardArt | null = null;
  /** What could not be loaded, for the console and the tests. */
  failed: string[] = [];
  /** The effects and the donor parts (named sprites), when they loaded. */
  fx = new Map<'effects' | 'parts' | 'tongue' | 'meat', { atlas: Atlas; sprites: FxSheet['sprites'] }>();

  /** `onProgress`: how many files have arrived of how many asked for so far (the loading screen's bar). */
  static async load(m: Manifest, biome: string | null = null, onProgress?: (done: number, total: number) => void): Promise<BoardArtSet> {
    const set = new BoardArtSet();
    let asked = 0;
    let done = 0;
    const get = async (file: string): Promise<Atlas | null> => {
      asked++;
      onProgress?.(done, asked);
      try {
        return new Atlas(await Assets.load<Texture>(artUrl(file)));
      } catch {
        set.failed.push(file);
        return null;
      } finally {
        done++;
        onProgress?.(done, asked);
      }
    };
    const jobs: Array<Promise<void>> = [];
    // A unit is drawn only when every page of it loaded: a clip on a missing page would draw nothing.
    for (const [into, list] of [[set.units, m.units], [set.allies, m.allies]] as const) {
      for (const [id, art] of Object.entries(list ?? {})) {
        jobs.push(Promise.all([art.atlas, ...(art.pages ?? [])].map(get)).then(([atlas, ...pages]) => {
          if (atlas && pages.every(Boolean)) into.set(id, { art, atlas, pages: [atlas, ...(pages as Atlas[])] });
        }));
      }
    }
    for (const [id, art] of Object.entries(m.limbs ?? {})) {
      jobs.push(get(art.atlas).then((atlas) => { if (atlas) set.limbs.set(id, { art, atlas }); }));
      // Its upgrade looks, each drawn like a limb of its own: `<family>@<key>` (src/render/isoRender.ts picks one).
      for (const [key, v] of Object.entries(art.variants ?? {})) {
        const vart: LimbArt = { ...v, on: art.on, ...(art.flat ? { flat: true } : {}), ...(art.facing ? { facing: true } : {}) };
        jobs.push(get(v.atlas).then((atlas) => { if (atlas) set.limbs.set(`${id}@${key}`, { art: vart, atlas }); }));
      }
    }
    for (const name of ['effects', 'parts', 'tongue'] as const) {
      const sheet = m.fx?.fx?.[name];
      if (sheet) jobs.push(get(sheet.atlas).then((atlas) => { if (atlas) set.fx.set(name, { atlas, sprites: sheet.sprites }); }));
    }
    const meat = m.fx?.meat;
    if (meat) jobs.push(get(meat.atlas).then((atlas) => { if (atlas) set.fx.set('meat', { atlas, sprites: meat.sprites }); }));
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
    const evo = m.board?.coreEvo;
    if (evo?.stages?.length) {
      jobs.push((async () => {
        const idle = await Promise.all(evo.stages.map(async (s) => {
          const pages = await Promise.all([s.idle.atlas, ...(s.idle.pages ?? [])].map(get));
          if (!pages.every(Boolean)) return null;
          return pages.length > 1 ? new PagedAtlas(pages as Atlas[], s.idle.perPage ?? s.idle.count) : pages[0];
        }));
        const grow = await Promise.all(evo.stages.map((s) => (s.grow ? get(s.grow.atlas) : Promise.resolve(null))));
        if (idle.every(Boolean) && evo.stages.every((s, i) => !s.grow || grow[i])) set.coreEvo = { art: evo, idle: idle as Atlas[], grow };
      })());
    }
    const pods = m.board?.pods;
    if (pods) jobs.push(get(pods.atlas).then((atlas) => { if (atlas) set.pods = { art: pods, atlas }; }));
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

  /** An effect or a donor part by its name, and its rectangle (anchor, glow). */
  fxSprite(sheet: 'effects' | 'parts' | 'tongue' | 'meat', id: string): { tex: Texture; rect: Rect & { glow?: boolean } } | null {
    const s = this.fx.get(sheet);
    const r = s?.sprites[id];
    return s && r ? { tex: s.atlas.sprite(id, r), rect: r } : null;
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
