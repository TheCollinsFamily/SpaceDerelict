/**
 * THE LOOKS DRAWN ARE THE LOOKS REACHED (Oct 2 2026, the limb art pass): tools/art/templates/limb-looks.mjs draws, for
 * every limb, the upgrade looks its evolution paths reach (src/ui/codexData.ts evoLooks). If an evolution changes
 * class, this fails until the list (and the art) follow.
 */
import { describe, expect, it } from 'vitest';
import { codexEntries } from '../src/ui/codexData';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { REACHABLE, lookChange } from '../tools/art/templates/limb-looks.mjs';
// @ts-expect-error: the art scripts are plain JavaScript modules
import { limb } from '../tools/art/limbs.mjs';

describe('the upgrade looks drawn', () => {
  it('are the looks each limb\'s evolution paths reach', () => {
    for (const e of codexEntries()) {
      const reached = e.evoLooks.filter((k) => k && k !== 'base').sort();
      expect([...(REACHABLE[e.family] ?? [])].sort(), e.family).toEqual(reached);
    }
  });

  it('say what grows for every class and every superstructure, on the limb\'s own working part', () => {
    for (const [family, keys] of Object.entries(REACHABLE as Record<string, string[]>)) {
      const l = limb(family);
      expect(l?.part, `${family}: part`).toBeTruthy();
      for (const k of keys) expect(lookChange(l, k), `${family} ${k}`).toContain(l.part);
    }
  });
});
