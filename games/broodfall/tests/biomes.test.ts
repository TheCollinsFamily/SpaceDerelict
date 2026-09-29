/**
 * The tile sets (tools/art/biomes.mjs makes them; public/art/manifest.json lists them under
 * "biomes"). A set has more than one of most pieces, so that a board is not the same building
 * forty times, and says how many in "variants". The renderer believes what the manifest says:
 * a set that promises a second roof and has not baked it draws a hole in the city. These
 * checks fail here, at the bake, before anyone sees that hole on the screen.
 *
 * The first of a kind keeps the name it always had (roof-IJ, wall-plain-south-0-3); a later
 * one has its number after a tilde (roof~1-IJ, wall-plain~1-south-0-3).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERRITORIES } from '../content/campaign';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'public', 'art');
const MANIFEST = join(ART, 'manifest.json');
const hasArt = existsSync(MANIFEST);

type Rect = { x: number; y: number; w: number; h: number };
type Sheet = { atlas: string; sprites: Record<string, Rect> };
type Kind = 'plain' | 'science' | 'meat' | 'highground';
interface SetEntry {
  name: string; territories: string[]; roofTint: number[];
  roofProps: Record<string, string[]>; streetProps: string[];
  variants: { walls: Record<Kind, number>; roof: number; street: number; plaza: number };
  guests: string[];
  data: string | null;
}

const KINDS: Kind[] = ['plain', 'science', 'meat', 'highground'];
const manifest = hasArt ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { biomes: {}, board: {} };
const sets = (manifest.biomes ?? {}) as Record<string, SetEntry>;
const wallSpan: number = manifest.board?.terrain?.wallSpan ?? 4;

/** The name of a piece's sprites: the first keeps its plain name, a later one has ~number after it. */
const named = (name: string, v: number): string => (v ? `${name}~${v}` : name);

/** The sheets a set has of its own. */
function sheetsOf(id: string): Record<string, Sheet> {
  const set = sets[id];
  expect(set.data, `${id}: the file that lists its sheets`).toBeTruthy();
  const file = join(ART, set.data!);
  expect(existsSync(file), `${id}: ${set.data}`).toBe(true);
  return JSON.parse(readFileSync(file, 'utf8')).sheets as Record<string, Sheet>;
}

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

describe.skipIf(!hasArt)('the tile sets', () => {
  it('are the ten kinds of place, two of them open country', () => {
    expect(Object.keys(sets).sort()).toEqual(
      ['deephive', 'farmland', 'industrial', 'megacity', 'necropolis', 'orient', 'orthodox', 'suburb', 'terraces', 'wetland'],
    );
    expect(sets.terraces.name).toBe('The Terraced Fields');
    expect(sets.wetland.name).toBe('The Mirewater Delta');
  });

  it('say how many of each piece they have: two buildings for each kind of district (five faces in open country), three roofs (five), one or two streets', () => {
    // Open country (Collins, Sep 29 2026: "all farms ... fine for like 20% of it but not the majority"):
    // four faces in five are land and one a farm building, and the roofs are grass, meadow, pasture, a wood and one field.
    const RURAL = ['terraces', 'farmland'];
    for (const [id, set] of Object.entries(sets)) {
      expect(set.variants, `${id}: variants`).toBeTruthy();
      const rural = RURAL.includes(id);
      for (const kind of KINDS) expect(set.variants.walls[kind], `${id}: faces of ${kind} districts`).toBe(rural ? 5 : 2);
      expect(set.variants.roof, `${id}: roofs`).toBe(rural ? 5 : 3);
      expect([1, 2], `${id}: streets`).toContain(set.variants.street);
      expect(set.variants.plaza, `${id}: squares`).toBe(1);
    }
  });

  it('have every floor they say they have, sixteen tiles of each', () => {
    for (const [id, set] of Object.entries(sets)) {
      const floors = sheetsOf(id).floors?.sprites ?? {};
      const counts: Array<[string, number]> = [['street', set.variants.street], ['plaza', set.variants.plaza], ['roof', set.variants.roof]];
      for (const [floor, count] of counts) {
        for (let v = 0; v < count; v++) {
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            const name = `${named(floor, v)}-${i}${j}`;
            expect(floors[name], `${id}: floors/${name}`).toBeTruthy();
          }
        }
        // And no more than it says: the game never looks for a piece the manifest does not count.
        expect(floors[`${named(floor, count)}-00`], `${id}: a ${floor} the manifest does not count`).toBeUndefined();
      }
    }
  });

  it('have every wall they say they have: each building, both faces, three levels, every place along the street', () => {
    for (const [id, set] of Object.entries(sets)) {
      const walls = sheetsOf(id).walls?.sprites ?? {};
      for (const kind of KINDS) {
        for (let v = 0; v < set.variants.walls[kind]; v++) {
          for (const side of ['south', 'east']) {
            for (let level = 0; level < 3; level++) for (let i = 0; i < 2 * wallSpan; i++) {
              const name = `wall-${named(kind, v)}-${side}-${level}-${i}`;
              expect(walls[name], `${id}: walls/${name}`).toBeTruthy();
            }
          }
        }
        expect(walls[`wall-${named(kind, set.variants.walls[kind])}-south-0-0`], `${id}: a ${kind} building the manifest does not count`).toBeUndefined();
      }
    }
  });

  it('have every prop they name, and more than one sheet of them', () => {
    for (const [id, set] of Object.entries(sets)) {
      const props = sheetsOf(id).props?.sprites ?? {};
      for (const kind of KINDS) {
        expect(set.roofProps[kind]?.length, `${id}: roof props of ${kind} districts`).toBeGreaterThan(0);
        for (const p of set.roofProps[kind]) expect(props[`prop-${p}`], `${id}: props/prop-${p}`).toBeTruthy();
      }
      expect(set.streetProps.length, `${id}: street props`).toBeGreaterThan(0);
      for (const p of set.streetProps) expect(props[`prop-${p}`], `${id}: props/prop-${p}`).toBeTruthy();
      // A first sheet is eight roof props and six street props: a set with a second of each has more than that.
      const onRoofs = new Set(KINDS.flatMap((kind) => set.roofProps[kind]));
      expect(onRoofs.size, `${id}: different roof props`).toBeGreaterThan(8);
      expect(new Set(set.streetProps).size, `${id}: different street props`).toBeGreaterThan(6);
    }
  });

  it('show open country in the rural sets: most of what stands on a roof is the land\'s own', () => {
    // Collins, Sep 29 2026: "the rural biome is all farms ... those are fine for like 20% of it but not the majority".
    const LAND = new Set(['oak', 'clock', 'boulders', 'bush', 'pond', 'log', 'cairn', 'bale', 'fungustree', 'shelter']);
    for (const id of ['terraces', 'farmland']) {
      for (const kind of KINDS) {
        const list = sets[id].roofProps[kind];
        const land = list.filter((p) => LAND.has(p)).length;
        expect(land / list.length, `${id}: share of land among the roof props of ${kind} districts`).toBeGreaterThanOrEqual(0.7);
      }
    }
  });

  it('are light to load, and keep every sprite inside its sheet', () => {
    for (const id of Object.keys(sets)) {
      for (const [name, sheet] of Object.entries(sheetsOf(id))) {
        const file = join(ART, sheet.atlas);
        expect(existsSync(file), sheet.atlas).toBe(true);
        expect(statSync(file).size / 1024, `${id}: kilobytes of ${name}`).toBeLessThan(900);
        const { w, h } = webpSize(file);
        for (const [sprite, r] of Object.entries(sheet.sprites)) {
          expect(r.w, `${id}: ${sprite}`).toBeGreaterThan(0);
          expect(r.h, `${id}: ${sprite}`).toBeGreaterThan(0);
          expect(r.x, `${id}: ${sprite}`).toBeGreaterThanOrEqual(0);
          expect(r.y, `${id}: ${sprite}`).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w, `${id}: ${sprite}`).toBeLessThanOrEqual(w);
          expect(r.y + r.h, `${id}: ${sprite}`).toBeLessThanOrEqual(h);
        }
      }
    }
  });

  it('name as guests only sets that exist, and never themselves', () => {
    for (const [id, set] of Object.entries(sets)) {
      expect(Array.isArray(set.guests), `${id}: guests`).toBe(true);
      for (const guest of set.guests) {
        expect(sets[guest], `${id}: its guest ${guest}`).toBeTruthy();
        expect(guest, `${id}: a set is not its own guest`).not.toBe(id);
      }
    }
    // Open country and the towns that stand in it.
    expect(sets.terraces.guests).toEqual(['farmland']);
    expect(sets.wetland.guests).toEqual(['orient']);
    for (const id of ['orient', 'farmland', 'suburb']) expect(sets[id].guests, `${id}: guests`).toEqual(['terraces']);
  });

  it('give every territory of the campaign exactly one home', () => {
    for (const t of TERRITORIES) {
      const homes = Object.keys(sets).filter((id) => sets[id].territories.includes(t.id));
      expect(homes, `the home of ${t.id}`).toHaveLength(1);
    }
    for (const [id, set] of Object.entries(sets)) {
      for (const t of set.territories) expect(TERRITORIES.some((x) => x.id === t), `${id}: territory ${t}`).toBe(true);
    }
    expect(sets.terraces.territories).toEqual(['granary']);
    expect(sets.wetland.territories).toEqual(['mirewater']);
  });
});

describe('guest districts (Sep 29 2026: a wetland board came out mostly in its guest look)', () => {
  it('take at most one district in four, never the body\'s own nor its neighbours, the same every time', async () => {
    const { planGuests } = await import('../src/render/biome');
    for (const seed of [1, 2, 3, 42, 1234]) {
      for (const [slotsX, slotsY, start] of [[5, 4, 7], [5, 4, 12], [3, 3, 4], [6, 5, 0]]) {
        const plan = planGuests({ slotsX, slotsY, start, seed }, ['orient']);
        expect(plan.size).toBeLessThanOrEqual(Math.floor((slotsX * slotsY) / 4));
        for (const slot of plan.keys()) {
          const d = Math.max(Math.abs((slot % slotsX) - (start % slotsX)), Math.abs(Math.floor(slot / slotsX) - Math.floor(start / slotsX)));
          expect(d).toBeGreaterThan(1);
        }
        expect([...planGuests({ slotsX, slotsY, start, seed }, ['orient']).entries()]).toEqual([...plan.entries()]);
      }
    }
    expect(planGuests({ slotsX: 5, slotsY: 4, start: 7, seed: 1 }, []).size).toBe(0);
  });
});
