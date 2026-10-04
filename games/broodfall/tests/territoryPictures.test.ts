/**
 * EVERY LANDING HAS ITS PICTURE (Oct 4 2026). The last mission's landing (the Hive House) was added to the campaign
 * without one: its briefing was the only one with no picture over its story, and nothing said so. A territory added
 * to content/campaign.ts now fails here until it has its picture (tools/art/templates/ship.mjs TERRITORIES,
 * `node tools/art/make.mjs ship <id>`) and its living loop (tools/art/stills-alive.mjs, `territory:<id>`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TERRITORIES } from '../content/campaign';

const ART = path.join(__dirname, '..', 'public', 'art');
const manifest = JSON.parse(fs.readFileSync(path.join(ART, 'manifest.json'), 'utf8')) as {
  ship: { ship: { territories?: Record<string, string> } }; biomes: Record<string, { territories?: string[] }>;
};
const alive = JSON.parse(fs.readFileSync(path.join(ART, 'alive', 'alive.json'), 'utf8')) as {
  items: Record<string, { video: string; poster: string; seconds: number }>;
};

describe('the picture over a briefing', () => {
  for (const t of TERRITORIES) {
    it(`${t.id}: its picture, and the loop that brings it alive`, () => {
      const file = manifest.ship.ship.territories?.[t.id];
      expect(file, `manifest ship.territories.${t.id}`).toBeTruthy();
      expect(fs.existsSync(path.join(ART, file!)), file).toBe(true);
      const loop = alive.items[`territory:${t.id}`];
      expect(loop, `alive.json territory:${t.id}`).toBeTruthy();
      expect(fs.existsSync(path.join(ART, loop.video)), loop.video).toBe(true);
      expect(fs.existsSync(path.join(ART, loop.poster)), loop.poster).toBe(true);
      expect(loop.seconds).toBeGreaterThan(3);
      // It is drawn in the look of the tile set its board is built of.
      expect(Object.values(manifest.biomes).some((b) => b.territories?.includes(t.id)), `a tile set draws ${t.id}`).toBe(true);
    });
  }

  it('no picture is left over from a territory that is gone', () => {
    const ids = new Set(TERRITORIES.map((t) => t.id));
    expect(Object.keys(manifest.ship.ship.territories ?? {}).filter((id) => !ids.has(id))).toEqual([]);
  });
});
