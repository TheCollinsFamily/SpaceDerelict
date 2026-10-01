/**
 * The Limb Codex (src/ui/codex.ts, src/ui/codexData.ts) covers every limb family the game has, and
 * everything it shows is read from the game rather than typed beside it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOWERS } from '../content/data';
import { CARD_DESC, PIP_DESC } from '../content/limbText';
import { UPGRADES } from '../content/upgrades';
import { LOOK_CLASSES } from '../content/upgradeLooks';
import { ROLES, codexEntries } from '../src/ui/codexData';

const entries = codexEntries();
const manifest = JSON.parse(readFileSync('public/art/manifest.json', 'utf8')) as { limbs: Record<string, { variants?: Record<string, unknown> }> };

describe('limb codex', () => {
  it('has one entry for every limb family, in the content order', () => {
    expect(entries.map((e) => e.family)).toEqual(TOWERS.map((t) => t.family));
    expect(new Set(entries.map((e) => e.family)).size).toBe(TOWERS.length);
  });

  it('every entry has its words, a role, a class and a three-stage tree', () => {
    for (const e of entries) {
      expect(CARD_DESC[e.family], e.family).toBeTruthy();
      expect(PIP_DESC[e.family], e.family).toBeTruthy();
      expect(e.desc).toBe(CARD_DESC[e.family]);
      expect(ROLES).toContain(e.role);
      expect(LOOK_CLASSES).toContain(e.pipClass);
      expect(e.tree.length, e.family).toBe(3);
      expect(e.tree.map((s) => s.options.map((o) => o.name))).toEqual(UPGRADES[e.family].map((p) => p.map((o) => o.name)));
      expect(Object.values(e.treeClassCount).reduce((a, b) => a + b, 0)).toBe(6);
      expect(e.unlockedBy, e.family).not.toBe('not unlocked by any organ');
    }
  });

  it('every limb in the codex has its baked picture', () => {
    for (const e of entries) expect(manifest.limbs[e.family], e.family).toBeTruthy();
  });

  it('reads its numbers from the spec (the Broodmother card says the broodlings she keeps)', () => {
    const brood = TOWERS.find((t) => t.family === 'brood')!;
    expect(entries.find((e) => e.family === 'brood')!.desc).toContain(String(brood.broodCount));
    for (const e of entries) {
      const s = TOWERS.find((t) => t.family === e.family)!;
      expect([e.maxHp, e.range, e.damage, e.rate]).toEqual([s.maxHp, s.range, s.damage, s.rate]);
    }
  });

  it('only the Trap Cage and the Seedling are given rather than drawn', () => {
    expect(entries.filter((e) => !e.drawn).map((e) => e.family).sort()).toEqual(['cage', 'sprout']);
  });
});
