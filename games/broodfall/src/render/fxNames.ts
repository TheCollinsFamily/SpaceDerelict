/**
 * The names of the effect pictures and what each is used for (src/render/fx.ts), apart from
 * the drawing so the tests can read them (tests/fx-art.test.ts).
 */
import type { TowerFamily } from '../sim/types';

/** Which picture a limb's shot is. */
export const SHOT: Partial<Record<TowerFamily, string>> = {
  spitter: 'spit', sprout: 'spit', burster: 'sac', tangler: 'mucus', blighter: 'spore', impaler: 'harpoon',
  quill: 'quill', net: 'web', mister: 'droplets',
};
/** What a shot leaves where it ends, and how big (a share of the burst's picture). */
export const LANDS: Record<string, [string, number] | null> = {
  spit: ['flesh-splat', 0.32], sac: ['flesh-splat', 0.55], mucus: ['web-mat', 0.3], spore: ['acid-splash', 0.4],
  harpoon: ['flesh-splat', 0.3], quill: null, web: ['web-mat', 0.42], droplets: ['mist-cloud', 0.34],
};
/** How long each shot picture is drawn, in board pixels along its flight. */
export const LONG: Record<string, number> = {
  spit: 34, sac: 40, mucus: 42, spore: 32, harpoon: 84, quill: 48, web: 52, droplets: 34,
  bile: 48, clot: 46, 'spore-shell': 42, 'bone-shell': 36, 'cannon-shell': 30, dart: 40, 'mortar-bomb': 40, barb: 20,
};

/** Every effect picture the board asks the effects sheet for (tests/fx-art.test.ts holds the sheet to it). */
export const FX_SPRITES = [
  ...new Set([...Object.values(SHOT), ...Object.keys(LONG)]),
  'flesh-splat', 'web-mat', 'acid-splash', 'mist-cloud', 'spore-burst', 'sedation-puff', 'blast', 'poison-cloud',
  'bolt-1', 'bolt-2', 'bolt-3', 'beam', 'flame-1', 'flame-2',
] as string[];


/**
 * The bursts that are LIGHT (fire, glowing spores, a sparkle) are added onto the board; the rest
 * of what was drawn on black (a splat, a splash, a web, a cloud) is laid over it, its brightness
 * its opacity, so that a red splat stays red on red creep.
 */
export const ADDED = new Set(['blast', 'spore-burst', 'sedation-puff']);

/**
 * The limbs whose shot, beam, flame or shell is drawn leaving them (src/render/fx.ts): each has a
 * muzzle marked by eye on its art (tools/art/limbs.mjs FIRING, `muzzle`; tools/art/muzzles.mjs).
 * The lasher and the maw strike where they stand and throw nothing: they have none.
 */
export const FIRES_FROM = [
  'spitter', 'sprout', 'quill', 'impaler', 'burster', 'tangler', 'blighter', 'mister', 'net',
  'frond', 'prism', 'ocular', 'ember', 'skipper', 'bombard', 'lobber', 'sling',
] as TowerFamily[];
