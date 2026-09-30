/**
 * THE UNITS' ART, as the board draws them (Sep 29 2026): every unit walks, attacks and falls
 * in all five views, has a picture of every state the sim holds it in, and stays light.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
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

  it('keeps every frame inside its atlas, and every atlas light', () => {
    for (const [kind, u] of Object.entries(manifest.units as Record<string, { atlas: string; frame: number; cols: number; anims: Record<string, Record<string, { start: number; count: number }>> }>)) {
      const f = join(ART, u.atlas);
      expect(existsSync(f), kind).toBe(true);
      expect(statSync(f).size, `${kind} atlas`).toBeLessThan(900 * 1024);
      let last = 0;
      for (const set of Object.values(u.anims)) for (const c of Object.values(set)) last = Math.max(last, c.start + c.count);
      // Frames are packed in rows of `cols`; the atlas holds them all (its height is read from the header).
      const b = readFileSync(f);
      const kindTag = b.toString('ascii', 12, 16);
      const h = kindTag === 'VP8X' ? 1 + b.readUIntLE(27, 3) : kindTag === 'VP8L' ? 1 + ((b.readUInt32LE(21) >> 14) & 0x3fff) : b.readUInt16LE(28) & 0x3fff;
      expect(Math.ceil(last / u.cols) * u.frame, `${kind} rows`).toBeLessThanOrEqual(h);
    }
  });
});
