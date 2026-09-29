/**
 * The isometric board's arithmetic (src/render/iso.ts) and the baked art's manifest
 * (public/art/manifest.json). These run forever: a change to the camera, or an asset baked
 * wrong, fails here before anyone sees it on the screen.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENEMIES, TOWERS } from '../content/data';
import { DARES, EXPERIMENTS, FACTIONS, TERRITORIES } from '../content/campaign';
import {
  depth, headingOf, isoGeo, openSides, pick, project, unproject, viewOf, wallIndex, type Heading,
} from '../src/render/iso';
import { GLOBE, projectSite, unprojectSite, zoneAt } from '../src/ui/globe';
import { pickBiome } from '../src/render/biome';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'public', 'art');
const g = isoGeo([128, 76], 30, 26);

describe('the isometric camera', () => {
  it('takes a point to the screen and back, at every height', () => {
    for (const up of [0, 1, 2, 3]) {
      for (const [x, y] of [[0, 0], [13, 13], [400, 90], [1299, 1039]]) {
        const s = project(g, x, y, up);
        const w = unproject(g, s.x, s.y, up);
        expect(w.x).toBeCloseTo(x, 6);
        expect(w.y).toBeCloseTo(y, 6);
      }
    }
  });

  it('runs world x down-right and world y down-left, and height straight up', () => {
    const o = project(g, 0, 0);
    const east = project(g, 26, 0);
    const south = project(g, 0, 26);
    expect(east.x).toBeGreaterThan(o.x);
    expect(east.y).toBeGreaterThan(o.y);
    expect(south.x).toBeLessThan(o.x);
    expect(south.y).toBeGreaterThan(o.y);
    expect(project(g, 0, 0, 1)).toEqual({ x: 0, y: -30 });
  });

  it('draws what is nearer the camera later', () => {
    expect(depth(g, 52, 26)).toBeGreaterThan(depth(g, 26, 26));
    expect(depth(g, 26, 52)).toBeGreaterThan(depth(g, 26, 26));
  });
});

describe('what a click reaches', () => {
  // One block, two levels high, on the cell (4, 4); street everywhere else.
  const heightAt = (x: number, y: number) => (Math.floor(x / 26) === 4 && Math.floor(y / 26) === 4 ? 2 : 0);

  it('reaches the roof when aimed at the roof', () => {
    const s = project(g, 4.5 * 26, 4.5 * 26, 2);
    const hit = pick(g, s.x, s.y, heightAt);
    expect(hit.top).toBe(true);
    expect(hit.up).toBe(2);
    expect(Math.floor(hit.x / 26)).toBe(4);
    expect(Math.floor(hit.y / 26)).toBe(4);
  });

  it('reaches the street when aimed at the street', () => {
    const s = project(g, 8.5 * 26, 2.5 * 26, 0);
    const hit = pick(g, s.x, s.y, heightAt);
    expect(hit.top).toBe(true);
    expect(hit.up).toBe(0);
    expect(Math.floor(hit.x / 26)).toBe(8);
    expect(Math.floor(hit.y / 26)).toBe(2);
  });

  it('reaches the block when aimed at the face of its wall', () => {
    // Half way up the south wall, in the middle of it.
    const s = project(g, 4.5 * 26, 5 * 26 - 0.01, 1);
    const hit = pick(g, s.x, s.y, heightAt);
    expect(hit.top).toBe(false);
    expect(Math.floor(hit.x / 26)).toBe(4);
    expect(Math.floor(hit.y / 26)).toBe(4);
  });

  it('does not reach a street cell that a block hides', () => {
    // The street cell behind the block, seen through the block: the block is what is hit.
    const s = project(g, 3.5 * 26, 3.5 * 26, 0);
    const hit = pick(g, s.x, s.y, heightAt);
    expect(Math.floor(hit.x / 26)).toBe(4);
    expect(Math.floor(hit.y / 26)).toBe(4);
  });
});

describe('the eight headings', () => {
  it('names the heading a step shows on the screen', () => {
    // World x is down-right on the screen, world y is down-left.
    expect(headingOf(g, 1, 0)).toBe('SE');
    expect(headingOf(g, 0, 1)).toBe('SW');
    expect(headingOf(g, -1, 0)).toBe('NW');
    expect(headingOf(g, 0, -1)).toBe('NE');
    expect(headingOf(g, 1, 1)).toBe('S');
    expect(headingOf(g, -1, -1)).toBe('N');
    expect(headingOf(g, 1, -1)).toBe('E');
    expect(headingOf(g, -1, 1)).toBe('W');
  });

  it('draws five views and mirrors three', () => {
    const all: Heading[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const views = new Set(all.map((h) => viewOf(h).view));
    expect([...views].sort()).toEqual(['N', 'NW', 'S', 'SW', 'W']);
    expect(all.filter((h) => viewOf(h).mirror)).toEqual(['NE', 'E', 'SE']);
    expect(viewOf('E')).toEqual({ view: 'W', mirror: true });
  });
});

describe('the pieces of the city', () => {
  it('walks a wall texture on from cell to cell, both ways round a corner', () => {
    expect(wallIndex('south', 0, 0, 4)).toBe(0);
    expect(wallIndex('south', 9, 0, 4)).toBe(1);
    // Along an east face the screen runs from south to north: the index climbs as y falls.
    expect(wallIndex('east', 0, 1, 4) + 1).toBe(wallIndex('east', 0, 0, 4));
    for (let i = -20; i < 20; i++) {
      for (const side of ['south', 'east'] as const) {
        const k = wallIndex(side, i, i, 4);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(8);
      }
    }
  });

  it('gives creep a ragged edge on exactly the sides that are bare', () => {
    expect(openSides(() => true)).toBe(0);
    expect(openSides(() => false)).toBe(15);
    expect(openSides((dx, dy) => !(dx === 0 && dy === -1))).toBe(1);
    expect(openSides((dx, dy) => !(dx === 1 && dy === 0))).toBe(2);
    expect(openSides((dx, dy) => !(dx === 0 && dy === 1))).toBe(4);
    expect(openSides((dx, dy) => !(dx === -1 && dy === 0))).toBe(8);
  });
});

describe('the holographic planet', () => {
  it('takes a place to the picture and back', () => {
    for (const spin of [-10, 40, 200]) {
      for (const [lat, lon] of [[12, 0], [46, -6], [-30, 40], [60, 96]]) {
        const p = projectSite(lat, lon + spin - 10, spin);
        if (!p.front) continue;
        const back = unprojectSite(p.x, p.y, spin)!;
        expect(back.lat).toBeCloseTo(lat, 4);
        expect(((back.lon - (lon + spin - 10)) % 360 + 540) % 360 - 180).toBeCloseTo(0, 4);
      }
    }
    expect(unprojectSite(2, 2, 0)).toBeNull();
    expect(GLOBE.r * 2).toBeLessThan(GLOBE.size);
  });

  it('gives every place to the nearest site within reach, and the open sea to none', () => {
    const zones = [
      { id: 'a', lat: 0, lon: 0, state: 'held' as const },
      { id: 'b', lat: 0, lon: 30, state: 'open' as const },
    ];
    expect(zoneAt(0, 2, zones)).toBe(0);
    expect(zoneAt(0, 28, zones)).toBe(1);
    expect(zoneAt(0, 14, zones)).toBe(0);
    expect(zoneAt(0, 16, zones)).toBe(1);
    expect(zoneAt(0, 120, zones)).toBe(-1);
  });
});

// ---------------------------------------------------------------- the baked art

const manifestFile = join(ART, 'manifest.json');
const hasArt = existsSync(manifestFile);
const manifest = hasArt ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null;

/** Width and height of a WebP file, read from its header. */
function webpSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const v = b.readUInt32LE(21);
    return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) };
  }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
}

describe.skipIf(!hasArt)('the baked art', () => {
  it('has a picture for every enemy in the game, in all five views', () => {
    for (const e of ENEMIES) {
      const u = manifest.units[e.kind];
      expect(u, `unit ${e.kind}`).toBeTruthy();
      for (const v of ['S', 'SW', 'W', 'NW', 'N']) expect(u.anims.walk[v], `${e.kind} walking ${v}`).toBeTruthy();
    }
    expect(Object.keys(manifest.units).sort()).toEqual(ENEMIES.map((e) => e.kind).sort());
  });

  it('has a picture for every limb in the game', () => {
    for (const t of TOWERS) {
      const l = manifest.limbs[t.family];
      expect(l, `limb ${t.family}`).toBeTruthy();
      expect(l.anims.idle.count, `${t.family} idle`).toBeGreaterThanOrEqual(8);
      // A limb that lies in the street is drawn in the street.
      expect(l.on === 'street', `${t.family} on`).toBe(t.family === 'spine' || t.family === 'swamp');
    }
    expect(Object.keys(manifest.limbs).sort()).toEqual(TOWERS.map((t) => t.family).sort());
  });

  it('keeps every frame inside its atlas, and every atlas small', () => {
    const sets: Array<[string, { atlas: string; frame: number; cols: number; anims: Record<string, unknown> }]> = [
      ...Object.entries(manifest.units as Record<string, never>), ...Object.entries(manifest.limbs as Record<string, never>),
    ];
    for (const [id, a] of sets) {
      const file = join(ART, a.atlas);
      expect(existsSync(file), a.atlas).toBe(true);
      expect(statSync(file).size, `${a.atlas} size`).toBeLessThan(900 * 1024);
      const { w, h } = webpSize(file);
      expect(w, `${id} atlas width`).toBe(a.frame * a.cols);
      const clips = Object.values(a.anims).flatMap((c) => (c && typeof c === 'object' && 'start' in c ? [c] : Object.values(c as object))) as Array<{ start: number; count: number; fps: number }>;
      expect(clips.length).toBeGreaterThan(0);
      for (const c of clips) {
        expect(c.count, `${id} frames`).toBeGreaterThan(0);
        expect(c.fps, `${id} rate`).toBeGreaterThan(0);
        expect(Math.ceil((c.start + c.count) / a.cols) * a.frame, `${id} rows`).toBeLessThanOrEqual(h);
      }
    }
  });

  it('has every piece of the city the board asks for', () => {
    const t = manifest.board.terrain;
    expect(t.tile).toEqual([128, 76]);
    const has = (sheet: string, id: string) => expect(t.sheets[sheet].sprites[id], `${sheet}/${id}`).toBeTruthy();
    for (const floor of ['street', 'plaza', 'roof', 'smoke']) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) has('floors', `${floor}-${i}${j}`);
    }
    for (const kind of ['plain', 'science', 'meat', 'highground']) {
      for (const side of ['south', 'east']) {
        for (let level = 0; level < 3; level++) for (let i = 0; i < 2 * t.wallSpan; i++) has('walls', `wall-${kind}-${side}-${level}-${i}`);
      }
    }
    for (let open = 0; open < 16; open++) {
      const n = open === 0 ? 4 : 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) has('creep', `creep-${open}-${i}${j}`);
    }
    for (const side of ['south', 'east']) for (let i = 0; i < 4; i++) has('creep', `drip-${side}-${i}`);
    has('props', 'prop-pod');
    for (const sheet of Object.values(t.sheets) as Array<{ atlas: string; sprites: Record<string, { x: number; y: number; w: number; h: number }> }>) {
      const { w, h } = webpSize(join(ART, sheet.atlas));
      for (const [id, r] of Object.entries(sheet.sprites)) {
        expect(r.x + r.w, id).toBeLessThanOrEqual(w);
        expect(r.y + r.h, id).toBeLessThanOrEqual(h);
      }
    }
    expect(existsSync(join(ART, t.core.atlas))).toBe(true);
  });

  it('has a tile set for every territory, and exactly one', () => {
    const sets = manifest.biomes as Record<string, { territories: string[] }>;
    for (const t of TERRITORIES) {
      const homes = Object.keys(sets).filter((id) => sets[id].territories.includes(t.id));
      expect(homes, `tile sets of ${t.id}`).toHaveLength(1);
    }
    const named = Object.values(sets).flatMap((s) => s.territories);
    for (const id of named) expect(TERRITORIES.some((t) => t.id === id), `territory ${id}`).toBe(true);
    // The three Collins asked for by name, and the first one.
    for (const id of ['orthodox', 'suburb', 'megacity', 'orient']) expect(sets[id], `tile set ${id}`).toBeTruthy();
  });

  it('has every piece of every tile set', () => {
    type Sheet = { atlas: string; sprites: Record<string, { x: number; y: number; w: number; h: number }> };
    const terrain = manifest.board.terrain.sheets as Record<string, Sheet>;
    const sets = manifest.biomes as Record<string, { data: string | null; roofTint: number[]; roofProps: Record<string, string[]>; streetProps: string[] }>;
    for (const [id, set] of Object.entries(sets)) {
      // The first set is drawn with the terrain entry's own sheets.
      const own = (set.data ? JSON.parse(readFileSync(join(ART, set.data), 'utf8')).sheets : terrain) as Record<string, Sheet>;
      const has = (sheet: string, name: string) => expect(own[sheet]?.sprites[name], `${id}: ${sheet}/${name}`).toBeTruthy();
      for (const floor of ['street', 'plaza', 'roof']) {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) has('floors', `${floor}-${i}${j}`);
      }
      for (const kind of ['plain', 'science', 'meat', 'highground']) {
        for (const side of ['south', 'east']) {
          for (let level = 0; level < 3; level++) for (let i = 0; i < 2 * manifest.board.terrain.wallSpan; i++) has('walls', `wall-${kind}-${side}-${level}-${i}`);
        }
        expect(set.roofProps[kind]?.length, `${id}: roof props of ${kind} districts`).toBeGreaterThan(0);
        for (const p of set.roofProps[kind]) has('props', `prop-${p}`);
      }
      expect(set.streetProps.length, `${id}: street props`).toBeGreaterThan(0);
      for (const p of set.streetProps) has('props', `prop-${p}`);
      expect(set.roofTint, `${id}: roof tints`).toHaveLength(3);
      if (!set.data) continue;
      let bytes = 0;
      for (const sheet of Object.values(own)) {
        const file = join(ART, sheet.atlas);
        expect(existsSync(file), sheet.atlas).toBe(true);
        bytes += statSync(file).size;
        const { w, h } = webpSize(file);
        for (const [name, r] of Object.entries(sheet.sprites)) {
          expect(r.x + r.w, `${id}: ${name}`).toBeLessThanOrEqual(w);
          expect(r.y + r.h, `${id}: ${name}`).toBeLessThanOrEqual(h);
        }
      }
      expect(bytes / 1024, `${id}: kilobytes`).toBeLessThan(900);
    }
  });

  it('draws a territory with its own tile set, a named one when asked, and a skirmish with one by its seed', () => {
    expect(pickBiome(manifest, { territory: 'crash-site', seed: 5 })).toBe('suburb');
    expect(pickBiome(manifest, { territory: 'glass-spires', seed: 5 })).toBe('megacity');
    expect(pickBiome(manifest, { territory: 'pilgrim', seed: 5 })).toBe('orient');
    expect(pickBiome(manifest, { territory: 'temple', seed: 5 })).toBe('orthodox');
    expect(pickBiome(manifest, { biome: 'megacity', territory: 'temple' })).toBe('megacity');
    expect(pickBiome(manifest, { biome: 'no-such-set', territory: 'temple' })).toBe('orthodox');
    const ids = Object.keys(manifest.biomes).sort();
    const seen = new Set<string>();
    for (let seed = 0; seed < ids.length; seed++) seen.add(pickBiome(manifest, { seed })!);
    expect([...seen].sort()).toEqual(ids);
    expect(pickBiome({ ...manifest, biomes: {} }, { seed: 3 })).toBeNull();
  });

  it('has everything the ship shows', () => {
    const s = manifest.ship.ship;
    for (const room of ['desk', 'genes', 'locker', 'board', 'comms', 'ai']) {
      expect(existsSync(join(ART, s.rooms[room])), `room ${room}`).toBe(true);
    }
    for (const f of FACTIONS) expect(existsSync(join(ART, s.leaders[f.id])), `leader ${f.id}`).toBe(true);
    // One sketch for every dare and every experiment, by their ids in the game.
    for (const d of DARES) expect(s.sketches.ids, `sketch for dare ${d.id}`).toContain(d.id);
    for (const e of EXPERIMENTS) expect(s.sketches.ids, `sketch for experiment ${e.id}`).toContain(e.id);
    expect(s.yoke.faces).toEqual(['calm', 'curious', 'amused', 'concerned', 'thinking', 'sad']);
    for (const f of [s.planet, s.exterior, s.yoke.atlas, s.sketches.atlas]) expect(existsSync(join(ART, f)), f).toBe(true);
  });

  it('stays small enough to ship', () => {
    let total = 0;
    const walk = (o: unknown): void => {
      if (typeof o === 'string' && o.endsWith('.webp') && existsSync(join(ART, o))) total += statSync(join(ART, o)).size;
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(manifest);
    expect(total / 1024 / 1024).toBeLessThan(24);
  });
});
