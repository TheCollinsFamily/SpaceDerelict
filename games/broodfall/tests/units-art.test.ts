/**
 * THE UNITS' ART, as the board draws them (Sep 29 2026): every unit walks, attacks and falls
 * in all five views, has a picture of every state the sim holds it in, and stays light.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../content/data';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'public', 'art');
const file = join(ART, 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const VIEWS = ['S', 'SW', 'W', 'NW', 'N'];

/** Units with no attack of their own to draw: the bomber blows itself up, the thief only steals. */
const NO_ATTACK = new Set(['bomber', 'thief']);

/** Every state picture the renderer asks for, by the sim's field (src/render/isoRender.ts syncUnits). */
const STATES: Record<string, string[]> = {
  flier: ['grounded'], shadewing: ['grounded'],
  cannon: ['deployed'], dartgun: ['deployed'],
  carapace: ['stripped'], tunneler: ['burrowed'],
  researcher: ['carrying'], infiltrator: ['carrying'], thief: ['carrying'],
};

describe.skipIf(!manifest)("the units' art", () => {
  it('walks and falls in all five views, every unit', () => {
    for (const e of ENEMIES) {
      const u = manifest.units[e.kind];
      expect(u, e.kind).toBeTruthy();
      for (const v of VIEWS) {
        expect(u.anims.walk[v], `${e.kind} walking ${v}`).toBeTruthy();
        expect(u.anims.death?.[v], `${e.kind} falling ${v}`).toBeTruthy();
      }
    }
  });

  it('attacks in all five views, every unit that attacks', () => {
    for (const e of ENEMIES) {
      const a = manifest.units[e.kind].anims.attack;
      if (NO_ATTACK.has(e.kind)) continue;
      for (const v of VIEWS) expect(a?.[v], `${e.kind} attacking ${v}`).toBeTruthy();
    }
  });

  it('has a picture of every state the sim holds it in', () => {
    for (const [kind, ids] of Object.entries(STATES)) {
      for (const id of ids) expect(manifest.units[kind]?.anims.states?.[id], `${kind} ${id}`).toBeTruthy();
    }
  });

  it('keeps every frame inside its atlas page, and every page light', () => {
    type C = { start: number; count: number; page?: number; anchor?: [number, number]; scale?: number };
    const all = { ...manifest.units, ...(manifest.allies ?? {}) } as Record<string, { atlas: string; pages?: string[]; frame: number; cols: number; anims: Record<string, Record<string, C>> }>;
    for (const [kind, u] of Object.entries(all)) {
      // A unit with more frames than one light picture holds is packed on several pages (Sep 30 2026).
      const files = [u.atlas, ...(u.pages ?? [])];
      const last = files.map(() => 0);
      for (const set of Object.values(u.anims)) {
        for (const c of Object.values(set)) {
          const page = c.page ?? 0;
          expect(page, `${kind} page`).toBeLessThan(files.length);
          last[page] = Math.max(last[page], c.start + c.count);
          // A clip cut with a bigger window than the walk says where the walk's feet are in it.
          if (c.anchor) for (const a of c.anchor) expect(a, `${kind} anchor`).toBeGreaterThan(0);
          if (c.anchor) for (const a of c.anchor) expect(a, `${kind} anchor`).toBeLessThan(1);
          if (c.scale !== undefined) expect(c.scale, `${kind} scale`).toBeGreaterThan(1);
        }
      }
      files.forEach((file, i) => {
        const f = join(ART, file);
        expect(existsSync(f), `${kind} ${file}`).toBe(true);
        // Frames are packed in rows of `cols`; the page holds them all (its height is read from the header).
        const b = readFileSync(f);
        const kindTag = b.toString('ascii', 12, 16);
        const h = kindTag === 'VP8X' ? 1 + b.readUIntLE(27, 3) : kindTag === 'VP8L' ? 1 + ((b.readUInt32LE(21) >> 14) & 0x3fff) : b.readUInt16LE(28) & 0x3fff;
        expect(Math.ceil(last[i] / u.cols) * u.frame, `${kind} rows of ${file}`).toBeLessThanOrEqual(h);
      });
    }
  });

  it('flinches when struck, in all five views, every unit', () => {
    for (const e of ENEMIES) for (const v of VIEWS) expect(manifest.units[e.kind].anims.hit?.[v], `${e.kind} flinching ${v}`).toBeTruthy();
  });

  it('draws a braced gun firing from its braced picture', () => {
    for (const kind of ['cannon', 'dartgun']) {
      expect(manifest.units[kind].anims.states?.deployed, `${kind} braced picture`).toBeTruthy();
      expect(manifest.units[kind].anims.braced?.SW, `${kind} braced shot`).toBeTruthy();
    }
  });

  it("shows the carapace lord's shell breaking as it walks: cracked, then gone", () => {
    for (const skin of ['walk-cracked', 'walk-stripped']) {
      for (const v of VIEWS) expect(manifest.units.carapace.anims[skin]?.[v], `carapace ${skin} ${v}`).toBeTruthy();
    }
  });

  it('makes bosses of the royal and the consort: bigger frames, an arrival and a special attack', () => {
    for (const kind of ['royal', 'consort']) {
      const u = manifest.units[kind];
      expect(u.frame, `${kind} frame`).toBeGreaterThanOrEqual(256);
      for (const anim of ['enter', 'special']) for (const v of VIEWS) expect(u.anims[anim]?.[v], `${kind} ${anim} ${v}`).toBeTruthy();
    }
    expect(manifest.units.royal.frame).toBeGreaterThan(256);
  });

  it("draws the hive's own walkers: the broodling and a puppet of every royal kind, walking and biting", () => {
    const royals = ENEMIES.filter((e) => e.caste === 'royal').map((e) => `puppet-${e.kind}`);
    for (const id of ['broodling', ...royals]) {
      const u = manifest.allies?.[id];
      expect(u, id).toBeTruthy();
      for (const v of VIEWS) {
        expect(u.anims.walk[v], `${id} walking ${v}`).toBeTruthy();
        expect(u.anims.attack?.[v], `${id} attacking ${v}`).toBeTruthy();
      }
    }
  });
});
