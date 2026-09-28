/**
 * THE BODY BELOW (Collins, Sep 28 2026). The organism grows DOWN under the city,
 * so the core on the surface never has to change shape. It starts from the
 * meteor it crashed in — half above ground (the core you defend), half buried
 * (the root of everything below). Organ management is a BETWEEN-WAVES stage:
 * organs → place limbs → wave.
 *
 * Rules: every organ must touch the meteor or an organ that already does (the
 * body is one connected thing). DEPOSITS pay out when you dig onto them — the
 * good ones are deep. FEATURES are fixed things in the ground that power the
 * organs touching them. The tension: dig straight down for deposits, or build
 * tight clusters around features — and leave room for later.
 */
import type { OrganId } from '../src/sim/types';

export const UNDER_W = 11;
export const UNDER_H = 8;
/** The meteor's buried half: columns and rows it fills at the top middle. */
export const METEOR_COLS = [4, 5, 6] as const;
export const METEOR_ROWS = [0, 1] as const;
/** Share of cells below the topsoil that are rock (can't be dug). */
export const ROCK_SHARE = 0.16;

export type DepositKind = 'carrion' | 'seam' | 'lab' | 'bed' | 'ossuary' | 'cache';
export type FeatureKind = 'vent' | 'aquifer' | 'cable' | 'sewer';

export interface DepositSpec {
  name: string;
  glyph: string;
  /** Paid once, the moment an organ is grown onto it. */
  now: { war?: number; science?: number; royal?: number; biomass?: number; pips?: number };
  /** Paid again at every cleared wave while an organ sits on it. */
  perWave?: { war?: number; science?: number };
  /** Rows it can appear on (0 = just under the surface). */
  rows: [number, number];
  count: number;
}

export const DEPOSITS: Record<DepositKind, DepositSpec> = {
  carrion: { name: 'Carrion Pocket', glyph: '☗', now: { war: 25 }, rows: [2, 3], count: 2 },
  seam: { name: 'Carrion Seam', glyph: '≋', now: { war: 40 }, perWave: { war: 6 }, rows: [3, 5], count: 2 },
  lab: { name: 'Buried Laboratory', glyph: '⚗', now: { science: 15 }, perWave: { science: 4 }, rows: [4, 6], count: 1 },
  bed: { name: 'Biomass Bed', glyph: '❦', now: { biomass: 150 }, rows: [4, 6], count: 1 },
  ossuary: { name: 'Royal Ossuary', glyph: '♛', now: { royal: 1 }, rows: [6, 7], count: 1 },
  cache: { name: 'Gene Cache', glyph: '⧉', now: { pips: 2 }, rows: [6, 7], count: 1 },
};

export interface FeatureSpec {
  name: string;
  glyph: string;
  /** Every organ touching it gets +1 power; this kind gets +2. */
  favors: OrganId;
  rows: [number, number];
}

export const FEATURES: Record<FeatureKind, FeatureSpec> = {
  cable: { name: 'Severed Power Main', glyph: 'ϟ', favors: 'brain', rows: [1, 3] },
  sewer: { name: 'Sewer Main', glyph: '≈', favors: 'root', rows: [1, 3] },
  aquifer: { name: 'Aquifer', glyph: '◌', favors: 'gland', rows: [3, 6] },
  vent: { name: 'Geothermal Vent', glyph: '♨', favors: 'heart', rows: [4, 7] },
};

/** What each organ does per point of POWER (1 + adjacency). */
export const ORGAN_TEXT: Record<OrganId, string> = {
  heart: 'biomass and creep growth, per power',
  brain: 'interest and advanced-card odds, per power',
  gland: 'its mode (calm / lure / challenge) is this much stronger — click it to switch',
  root: 'a creep lobe from the core, longer per power — click it to turn',
};

/** Power from adjacency: a touching feature (+1, or +2 for its kind), a touching organ of the same kind (+0.5). */
export const FEATURE_POWER = 1;
export const FEATURE_FAVORED_POWER = 2;
export const SAME_KIND_POWER = 0.5;
