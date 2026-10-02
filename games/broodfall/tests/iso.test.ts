/**
 * The isometric board's arithmetic (src/render/iso.ts) and the baked art's manifest
 * (public/art/manifest.json). These run forever: a change to the camera, or an asset baked
 * wrong, fails here before anyone sees it on the screen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENEMIES, TOWERS } from '../content/data';
import { DARES, EXPERIMENTS, FACTIONS, TERRITORIES } from '../content/campaign';
import {
  boardCell, creepRunsOn, depth, dirToView, facingOf, fromView, headingOf, isoGeo, limbView, openSides, pick, project,
  toView, unproject, viewCell, viewOf, viewSize, wallIndex, type Facing, type Heading, type Turn,
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

describe('the camera turns (Q and E)', () => {
  const W = 50;
  const H = 40;
  const turned = (turn: Turn) => isoGeo([128, 76], 30, 26, turn, W, H);

  it('takes a point to the screen and back, at every turn and every height', () => {
    for (const turn of [0, 1, 2, 3] as Turn[]) {
      const t = turned(turn);
      for (const up of [0, 1, 2, 3]) {
        for (const [x, y] of [[0, 0], [13, 13], [400, 90], [1299, 1039]]) {
          const s = project(t, x, y, up);
          const w = unproject(t, s.x, s.y, up);
          expect(w.x).toBeCloseTo(x, 6);
          expect(w.y).toBeCloseTo(y, 6);
        }
      }
    }
  });

  it('is the old camera when it has not turned', () => {
    for (const [x, y] of [[0, 0], [260, 130], [1299, 1039]]) {
      expect(project(turned(0), x, y, 2)).toEqual(project(g, x, y, 2));
      expect(depth(turned(0), x, y)).toBe(depth(g, x, y));
    }
  });

  it('gives every cell of the board one cell of the view, and back', () => {
    for (const turn of [0, 1, 2, 3] as Turn[]) {
      const t = turned(turn);
      const size = viewSize(t);
      expect(size).toEqual(turn % 2 ? { w: H, h: W } : { w: W, h: H });
      const seen = new Set<number>();
      for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
        const v = viewCell(t, cx, cy);
        expect(v.x).toBeGreaterThanOrEqual(0);
        expect(v.y).toBeGreaterThanOrEqual(0);
        expect(v.x).toBeLessThan(size.w);
        expect(v.y).toBeLessThan(size.h);
        seen.add(v.y * size.w + v.x);
        expect(boardCell(t, v.x, v.y)).toEqual({ x: cx, y: cy });
      }
      expect(seen.size).toBe(W * H);
    }
  });

  it('keeps neighbours neighbours: a step on the board is one step in the view', () => {
    for (const turn of [0, 1, 2, 3] as Turn[]) {
      const t = turned(turn);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const a = toView(t, 10, 10);
        const b = toView(t, 10 + dx, 10 + dy);
        const d = dirToView(t, dx, dy);
        expect(b.x - a.x).toBeCloseTo(d.x, 9);
        expect(b.y - a.y).toBeCloseTo(d.y, 9);
        expect(Math.abs(d.x) + Math.abs(d.y)).toBe(1);
      }
      const p = fromView(t, 7.25, 3.5);
      const v = toView(t, p.x, p.y);
      expect(v.x).toBeCloseTo(7.25, 9);
      expect(v.y).toBeCloseTo(3.5, 9);
    }
  });

  it('shows another side at every turn: what ran down-right runs down-left after one', () => {
    // East on the board: down-right on the screen, then down-left, up-left, up-right.
    expect(headingOf(turned(0), 1, 0)).toBe('SE');
    expect(headingOf(turned(1), 1, 0)).toBe('SW');
    expect(headingOf(turned(2), 1, 0)).toBe('NW');
    expect(headingOf(turned(3), 1, 0)).toBe('NE');
    // Four turns are no turn: the fourth heading of each step is its first.
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 2]]) {
      const all = ([0, 1, 2, 3] as Turn[]).map((turn) => headingOf(turned(turn), dx, dy));
      expect(new Set(all).size).toBe(4);
    }
  });

  it('puts what is nearer the camera later, whichever way the camera faces', () => {
    // The corner of the board nearest the camera is a different corner at every turn.
    const corners: Array<[number, number]> = [[0, 0], [W * 26, 0], [W * 26, H * 26], [0, H * 26]];
    const nearest = ([0, 1, 2, 3] as Turn[]).map((turn) => {
      const t = turned(turn);
      return corners.map((c) => depth(t, c[0], c[1])).reduce((best, d, i, all) => (d > all[best] ? i : best), 0);
    });
    expect(new Set(nearest).size).toBe(4);
    expect(nearest[0]).toBe(2); // not turned: the south-east corner
  });
});

describe('a limb is seen from the side it shows the camera', () => {
  const W = 50;
  const H = 40;
  const turned = (turn: Turn) => isoGeo([128, 76], 30, 26, turn, W, H);

  it('faces the way of the four that a step is nearest to', () => {
    expect(facingOf(5, 1)).toBe('E');
    expect(facingOf(-5, 1)).toBe('W');
    expect(facingOf(1, 5)).toBe('S');
    expect(facingOf(1, -5)).toBe('N');
  });

  it('draws its front when it faces the camera and its back when it faces away', () => {
    const t = turned(0);
    // South runs down-left: the front, as it is drawn. East runs down-right: the front, mirrored.
    expect(limbView(t, 'S')).toEqual({ back: false, mirror: false });
    expect(limbView(t, 'E')).toEqual({ back: false, mirror: true });
    // North runs up-right: from behind, as it is drawn. West runs up-left: from behind, mirrored.
    expect(limbView(t, 'N')).toEqual({ back: true, mirror: false });
    expect(limbView(t, 'W')).toEqual({ back: true, mirror: true });
  });

  it('shows four different pictures of one limb as the camera turns round it: no "doom effect"', () => {
    for (const facing of ['N', 'E', 'S', 'W'] as Facing[]) {
      const seen = ([0, 1, 2, 3] as Turn[]).map((turn) => {
        const v = limbView(turned(turn), facing);
        return `${v.back ? 'back' : 'front'}${v.mirror ? ' mirrored' : ''}`;
      });
      expect(new Set(seen).size, `a limb facing ${facing}`).toBe(4);
    }
  });

  it('shows four different pictures of four limbs that face four ways', () => {
    for (const turn of [0, 1, 2, 3] as Turn[]) {
      const seen = (['N', 'E', 'S', 'W'] as Facing[]).map((f) => JSON.stringify(limbView(turned(turn), f)));
      expect(new Set(seen).size).toBe(4);
    }
  });
});

describe('the skin runs to the edge of a roof', () => {
  it('runs on to a roof of another height, creeped or bare: there it goes to the edge and down the wall', () => {
    expect(creepRunsOn({ height: 2 }, { height: 0, creeped: false })).toBe(true);
    expect(creepRunsOn({ height: 2 }, { height: 1, creeped: true })).toBe(true);
    expect(creepRunsOn({ height: 1 }, { height: 3, creeped: false })).toBe(true);
    expect(creepRunsOn({ height: 0 }, { height: 1, creeped: false })).toBe(true);
  });

  it('stops ragged only where the same surface goes on bare', () => {
    expect(creepRunsOn({ height: 1 }, { height: 1, creeped: false })).toBe(false);
    expect(creepRunsOn({ height: 0 }, { height: 0, creeped: false })).toBe(false);
    expect(creepRunsOn({ height: 1 }, { height: 1, creeped: true })).toBe(true);
  });

  it('runs to the edge of the board', () => {
    expect(creepRunsOn({ height: 1 }, null)).toBe(true);
  });

  it('holds a roof that stands alone whole: no side of it is ragged', () => {
    // A creeped roof one level up, streets all round it.
    const open = openSides(() => creepRunsOn({ height: 1 }, { height: 0, creeped: false }));
    expect(open).toBe(0);
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

  it('knows where every limb stands: the middle of what it stands on, not its lowest point', () => {
    for (const t of TOWERS) {
      const l = manifest.limbs[t.family];
      const sides = [l, ...(l.back ? [l.back] : [])];
      for (const side of sides) {
        expect(side.anchor[0], `${t.family} stands in the middle of its frame, left to right`).toBe(0.5);
        // Anchored by its lowest point it stood at 0.86 of its frame, on the back half of its cell.
        expect(side.anchor[1], `${t.family} anchor`).toBeGreaterThan(0.3);
        // Measured, not guessed (tools/art/feet-check.mjs): a limb whose skirt spreads low and forward stands low in its frame.
        expect(side.anchor[1], `${t.family} anchor`).toBeLessThan(0.9);
        expect(side.body, `${t.family} footing`).toBeGreaterThan(0.25);
        expect(side.body, `${t.family} footing`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('has a view from behind of every limb that is not the same all the way round', () => {
    const lopsided = ['spitter', 'impaler', 'quill', 'skipper', 'ember', 'maw', 'lobber', 'ocular', 'brood', 'sling', 'conduit', 'tap', 'press', 'amp', 'lance'];
    for (const family of lopsided) {
      const l = manifest.limbs[family];
      expect(l.back, `${family} from behind`).toBeTruthy();
      expect(l.back.anims.idle.count, `${family} from behind, idle`).toBeGreaterThanOrEqual(8);
      // A limb that fires fires from behind too.
      if (l.anims.fire) expect(l.back.anims.fire, `${family} from behind, firing`).toBeTruthy();
      // Its frames follow the front's in the same atlas.
      expect(l.back.anims.idle.start).toBeGreaterThanOrEqual(l.anims.idle.count);
    }
    expect(Object.keys(manifest.limbs).filter((f) => manifest.limbs[f].back).sort()).toEqual([...lopsided].sort());
  });

  it('draws a BIG limb from bigger frames, and only a big limb', () => {
    // Since the class-zero mapping (Oct 2 2026) some limbs stand on new ground before their art is redrawn
    // (the limb art pass, HANDOFF.md "Footprints"): their old pictures are scaled to their ground meanwhile.
    // ART_PENDING lists them; a limb leaves the list when its art is baked for its new ground.
    const ART_PENDING: Record<string, boolean> = { bombard: false, frond: true, tangler: true, choir: true };
    for (const t of TOWERS) {
      const l = manifest.limbs[t.family];
      // Big: four cells or more in a square. A LONG limb (two cells) is drawn from the frames of a limb of one.
      const big = t.family in ART_PENDING ? ART_PENDING[t.family] : !!t.span && t.span[0] * t.span[1] >= 4;
      expect(!!l.big, `${t.family} big`).toBe(big);
      expect(l.frame, `${t.family} frame`).toBe(big ? 384 : 256);
    }
  });

  it('has a landing site as sharp as the limbs round it, that knows where it lies', () => {
    const c = manifest.board.terrain.core;
    // As many pixels of its picture to a cell of the board as a limb has: at 320 it had half (Collins, Sep 29 2026).
    const perCell = (frame: number, body: number, cells: number) => (frame * body) / cells;
    const limb = manifest.limbs.spitter;
    expect(perCell(c.frame, c.body, c.cells)).toBeGreaterThanOrEqual(0.9 * perCell(limb.frame, limb.body, 0.75));
    expect(c.anchor[0]).toBe(0.5);
    expect(c.anchor[1]).toBeGreaterThan(0.4);
    expect(c.anchor[1]).toBeLessThan(0.75);
    expect(c.body).toBeGreaterThan(0.6);
    const { w, h } = webpSize(join(ART, c.atlas));
    expect(w).toBe(c.frame * c.cols);
    expect(h).toBeGreaterThanOrEqual(Math.ceil(c.count / c.cols) * c.frame);
  });

  it('has the four edges that make a roof read as a roof under the skin', () => {
    const creep = manifest.board.terrain.sheets.creep.sprites;
    for (const id of ['edge-lip-south', 'edge-lip-east', 'edge-shade-north', 'edge-shade-west']) expect(creep[id], id).toBeTruthy();
  });

  it('keeps every frame inside its atlas, and every atlas small', () => {
    const sets: Array<[string, { atlas: string; pages?: string[]; frame: number; cols: number; anims: Record<string, unknown> }]> = [
      ...Object.entries(manifest.units as Record<string, never>), ...Object.entries((manifest.allies ?? {}) as Record<string, never>),
      ...Object.entries(manifest.limbs as Record<string, never>),
    ];
    for (const [id, a] of sets) {
      // A unit with more frames than one light picture holds is packed on several pages (Sep 30 2026): each is checked.
      const files = [a.atlas, ...(a.pages ?? [])].map((f) => join(ART, f));
      const heights = files.map((file) => {
        expect(existsSync(file), file).toBe(true);
        const { w, h } = webpSize(file);
        expect(w, `${id} atlas width`).toBe(a.frame * a.cols);
        return h;
      });
      const back = (a as { back?: { anims: Record<string, unknown> } }).back;
      const clips = [...Object.values(a.anims), ...Object.values(back?.anims ?? {})].flatMap((c) => (c && typeof c === 'object' && 'start' in c ? [c] : Object.values(c as object))) as Array<{ start: number; count: number; fps: number; page?: number }>;
      expect(clips.length).toBeGreaterThan(0);
      for (const c of clips) {
        expect(c.count, `${id} frames`).toBeGreaterThan(0);
        expect(c.fps, `${id} rate`).toBeGreaterThan(0);
        expect(Math.ceil((c.start + c.count) / a.cols) * a.frame, `${id} rows`).toBeLessThanOrEqual(heights[c.page ?? 0]);
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
    // THE SEAMS (Sep 30 2026): a tile baked on a picture exactly its own size is cut off at its corners, and
    // where four meet the ground shows through as a "+". Every tile has a margin, as big as what it draws past its edge.
    const padOf = (sheet: string, id: string) => (t.sheets[sheet].sprites[id] as { pad?: [number, number] }).pad ?? [0, 0];
    for (const id of ['street-00', 'roof-33', 'smoke-12']) expect(padOf('floors', id), id).toEqual([5, 3]);
    for (const id of ['creep-0-00', 'creep-15-11', 'edge-lip-south']) expect(padOf('creep', id)[0], id).toBeGreaterThanOrEqual(5);
    for (const id of ['drip-south-0', 'drip-east-3']) expect(padOf('creep', id), id).toEqual([2, 2]);
    expect(padOf('walls', 'wall-plain-south-0-0')).toEqual([2, 2]);
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

  it('has no floor that reads as the creep from far away', () => {
    // Sep 30 2026: a farmland wood of brown fungus caps, a rusty comb and a rust-red factory roof all looked
    // like claimed ground at far zoom. A floor as dark and as red as the skin (its mean colour, a roof under its
    // darkest tint, within 35 of the creep in CIE Lab and on its red side) cannot tell the player what is his.
    const lab = ([r, g, b]: number[]): number[] => {
      const lin = (c: number) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
      const [R, G, B] = [lin(r), lin(g), lin(b)];
      const q = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const X = q((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
      const Y = q(R * 0.2126 + G * 0.7152 + B * 0.0722);
      const Z = q((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
      return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
    };
    const creep = lab(manifest.board.terrain.creepColour);
    const sets = manifest.biomes as Record<string, { floorColour?: Record<string, number[]> }>;
    let floors = 0;
    for (const [id, set] of Object.entries(sets)) {
      for (const [name, rgb] of Object.entries(set.floorColour ?? {})) {
        floors++;
        const c = lab(rgb);
        const dE = Math.hypot(c[0] - creep[0], c[1] - creep[1], c[2] - creep[2]);
        expect(dE < 35 && c[1] > 3, `${id}: ${name} (${rgb.join(', ')}) reads as the creep: ΔE ${dE.toFixed(0)}, a* ${c[1].toFixed(0)}`).toBe(false);
      }
    }
    expect(floors, 'every set says what its floors look like').toBeGreaterThan(60);
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
      for (const sheet of Object.values(own)) {
        const file = join(ART, sheet.atlas);
        expect(existsSync(file), sheet.atlas).toBe(true);
        const { w, h } = webpSize(file);
        for (const [name, r] of Object.entries(sheet.sprites)) {
          expect(r.x + r.w, `${id}: ${name}`).toBeLessThanOrEqual(w);
          expect(r.y + r.h, `${id}: ${name}`).toBeLessThanOrEqual(h);
        }
      }
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
});
