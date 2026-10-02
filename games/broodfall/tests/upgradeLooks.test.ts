/**
 * UPGRADE LOOKS (content/upgradeLooks.ts, DESIGN.md "Upgrade looks"): every evolution option and every
 * pip belongs to exactly one class; the thresholds for a class look and a superstructure; and the baked
 * variants in the manifest are whole (an atlas, where it stands, where it fires from, its view from behind).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOWERS } from '../content/data';
import { UPGRADES } from '../content/upgrades';
import { CLASS_AT, LOOK_CLASSES, PIP_CLASS, SUPERS, SUPER_AT, lookOf, treeClasses } from '../content/upgradeLooks';
import type { TowerFamily, UpgradeChoice } from '../src/sim/types';

const FAMILIES = TOWERS.map((t) => t.family as TowerFamily);
const pips = (...f: TowerFamily[]) => f.map((family) => ({ family }));
const limb = (family: TowerFamily, upgrades: UpgradeChoice[] = [], p: TowerFamily[] = []) => ({ family, upgrades, pips: pips(...p) });

describe('upgrade looks: classes', () => {
  it('every family teaches a pip of exactly one class', () => {
    for (const f of FAMILIES) expect(LOOK_CLASSES, f).toContain(PIP_CLASS[f]);
    expect(Object.keys(PIP_CLASS).sort()).toEqual([...FAMILIES].sort());
  });

  it('every evolution option of every tree has exactly one class, and every class is used', () => {
    const used = new Set<string>();
    for (const f of FAMILIES) {
      const c = treeClasses(f);
      expect(c.length, f).toBe(3);
      for (const stage of c) for (const x of stage) { expect(LOOK_CLASSES, f).toContain(x); used.add(x); }
    }
    expect([...used].sort()).toEqual([...LOOK_CLASSES].sort());
  });

  it('reads the options the way their words do', () => {
    const cls = (f: TowerFamily, stage: number, i: number) => treeClasses(f)[stage][i];
    expect(cls('spitter', 0, 0)).toBe('swarm'); // Rapid Glands
    expect(cls('spitter', 0, 1)).toBe('bone'); // Heavy Gobs
    expect(cls('spitter', 1, 0)).toBe('venom'); // Acid Spit
    expect(cls('spitter', 1, 1)).toBe('reach'); // Sticky Spit
    expect(cls('lure', 0, 0)).toBe('venom'); // Strong Musk (hand-set: more toxic)
    expect(cls('burster', 2, 1)).toBe('reach'); // Skyburst
    expect(UPGRADES.spitter[2][0].name).toBe('Hydra Throat');
  });
});

describe('upgrade looks: thresholds', () => {
  it('its own look until a class reaches 2 points', () => {
    expect(lookOf(limb('spitter')).key).toBeNull();
    expect(lookOf(limb('spitter', [], ['ember'])).key).toBeNull(); // one pip: 1 point
    expect(lookOf(limb('spitter', [], ['ember', 'blighter'])).key).toBe('venom'); // two venom pips
    expect(lookOf(limb('spitter', ['A'])).key).toBe('swarm'); // one evolution: 2 points
    expect(CLASS_AT).toBe(2);
  });

  it('two classes at 3 points each make a superstructure; one short of it keeps the stronger class', () => {
    // Rapid Glands (swarm 2) + Acid Spit (venom 2) + Hydra Throat (swarm 3): swarm 5, venom 2.
    expect(lookOf(limb('spitter', ['A', 'A', 'A'])).key).toBe('swarm');
    // ... and a venom pip: venom 3, a Spore Hive.
    const hive = lookOf(limb('spitter', ['A', 'A', 'A'], ['ember']));
    expect(hive.key).toBe('swarm+venom');
    expect(hive.top).toBe('swarm');
    expect(SUPERS['swarm+venom'].name).toBe('Spore Hive');
    expect(SUPER_AT).toBe(3);
  });

  it('a tie goes to what was chosen last', () => {
    // Heavy Gobs (bone 2), then Acid Spit (venom 2): venom, the newer.
    expect(lookOf(limb('spitter', ['B', 'A'])).key).toBe('venom');
    // An evolution outranks pips in a tie.
    expect(lookOf(limb('spitter', ['B'], ['ember', 'mister'])).key).toBe('bone');
  });

  it('every pair of classes names a superstructure', () => {
    for (let i = 0; i < LOOK_CLASSES.length; i++) for (let j = i + 1; j < LOOK_CLASSES.length; j++) {
      expect(SUPERS[`${LOOK_CLASSES[i]}+${LOOK_CLASSES[j]}` as keyof typeof SUPERS]).toBeDefined();
    }
  });
});

describe('upgrade looks: the baked variants', () => {
  const file = path.join(__dirname, '..', 'public', 'art', 'manifest.json');
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const FIRES = ['spitter', 'sprout', 'quill', 'impaler', 'burster', 'tangler', 'blighter', 'mister', 'net', 'frond', 'prism', 'ocular', 'ember', 'skipper', 'bombard', 'lobber', 'sling'];
  const withVariants = Object.entries(m.limbs as Record<string, { back?: unknown; variants?: Record<string, any> }>).filter(([, a]) => a.variants);

  it('the three prototype limbs have every class look and one superstructure', () => {
    // (The Frond was drawn anew on its T, Oct 2 2026: its prototype looks are kept in public/art/limbs-legacy/frond/.)
    for (const f of ['spitter', 'lasher']) {
      const keys = Object.keys(m.limbs[f]?.variants ?? {});
      for (const c of LOOK_CLASSES) expect(keys, `${f} ${c}`).toContain(c);
      expect(keys.filter((k) => k.includes('+')).length, f).toBe(1);
    }
  });

  it('every variant is whole: its atlas on disk, where it stands, its clips, its muzzle and its view from behind', () => {
    for (const [family, art] of withVariants) {
      for (const [key, v] of Object.entries(art.variants!)) {
        const name = `${family}@${key}`;
        expect(fs.existsSync(path.join(__dirname, '..', 'public', 'art', v.atlas)), `${name} atlas`).toBe(true);
        expect(v.anchor[1], name).toBeGreaterThan(0.4);
        expect(v.body, name).toBeGreaterThan(0.1);
        expect(v.anims.idle.count, name).toBeGreaterThan(8);
        if (FIRES.includes(family)) expect(v.muzzle?.length, `${name} muzzle`).toBeGreaterThan(0);
        if (art.back) {
          expect(v.back, `${name} from behind`).toBeDefined();
          if (FIRES.includes(family)) expect(v.back.muzzle?.length, `${name} muzzle from behind`).toBeGreaterThan(0);
        }
        const k = key.split('+');
        expect(k.every((c) => (LOOK_CLASSES as readonly string[]).includes(c)), name).toBe(true);
      }
    }
  });
});
