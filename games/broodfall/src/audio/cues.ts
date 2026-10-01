/**
 * HOW EACH SOUND IS PLAYED (pure; no WebAudio here, so the tests read it). The sounds themselves
 * are public/audio/ (made by tools/audio/make.mjs from tools/audio/cues.mjs); the engine is
 * src/audio/engine.ts; what fires them is src/audio/gameSounds.ts.
 *
 * A board with forty limbs must not sound like a machine gun: every effect has
 *   gain      its level on the effects bus (the files are all levelled alike, -14 LUFS-ish)
 *   gap       the least time between two starts of it, in seconds (a start inside it is dropped)
 *   poly      how many of it may sound at once (the oldest is not cut: a new one is dropped)
 *   pitch     random pitch spread, ± semitones (with the variants, no two shots sound alike)
 * and the engine caps the effects bus at MAX_VOICES at once.
 */
import type { EnemyKind, TowerFamily } from '../sim/types';

export type Bus = 'music' | 'sfx' | 'voice';

export interface SfxRule { gain: number; gap: number; poly: number; pitch: number; bus?: Bus }

/** Everything on the effects bus at once, whatever it is. */
export const MAX_VOICES = 24;

const R = (gain: number, gap: number, poly: number, pitch = 1.2): SfxRule => ({ gain, gap, poly, pitch });

export const SFX_RULES: Record<string, SfxRule> = {
  // limbs firing: quiet each, many of them
  'fire-spit': R(0.32, 0.07, 4), 'fire-harpoon': R(0.4, 0.12, 3), 'fire-quills': R(0.32, 0.1, 3),
  'fire-lightning': R(0.34, 0.1, 3), 'fire-beam': R(0.3, 0.14, 2, 0.8), 'fire-flame': R(0.34, 0.16, 2, 0.8),
  'fire-lob': R(0.42, 0.12, 3), 'fire-bite': R(0.4, 0.1, 3), 'fire-web': R(0.34, 0.1, 3),
  'fire-lash': R(0.36, 0.1, 3), 'fire-hiss': R(0.28, 0.14, 2),
  // what lands
  'hit-splat': R(0.26, 0.06, 4, 2), 'hit-blast': R(0.5, 0.1, 3), 'enemy-cannon': R(0.5, 0.2, 2, 1),
  // the insects dying
  'die-bug': R(0.42, 0.06, 4, 2), 'die-soldier': R(0.5, 0.1, 3, 1.5), 'die-flier': R(0.5, 0.15, 2),
  'die-boss': R(0.95, 2, 1, 0), 'boss-roar': R(1, 3, 1, 0),
  // the landing film (src/ui/landing.ts)
  'land-roar': R(0.85, 2, 1, 0), 'land-impact': R(1, 2, 1, 0),
  // the body
  'creep-spread': R(0.5, 0.2, 2), 'creep-pulse': R(0.5, 0.4, 1, 0.5), 'limb-grow': R(0.7, 0.12, 2),
  'limb-wither': R(0.6, 0.25, 2), 'limb-lost': R(0.65, 0.2, 2), 'cannibalize': R(0.8, 0.5, 1, 0.5),
  'core-evolve': R(0.95, 2, 1, 0), 'plinth-rise': R(0.7, 0.3, 2, 0.5), 'organ-place': R(0.7, 0.12, 2),
  'evolve-limb': R(0.75, 0.3, 1),
  // the waves
  'wave-siren': R(0.45, 4, 1, 0), 'assault-march': R(0.55, 4, 1, 0),
  // the console
  'ui-click': R(0.45, 0.04, 2, 0.6), 'ui-hover': R(0.22, 0.05, 1, 0.8), 'ui-confirm': R(0.5, 0.1, 1, 0),
  'ui-deny': R(0.45, 0.15, 1, 0), 'card-draw': R(0.45, 0.06, 3), 'card-pick': R(0.45, 0.05, 2),
  'pad-won': R(0.8, 1, 1, 0), 'pad-lost': R(0.85, 1, 1, 0),
  'intercom-open': R(0.55, 0.3, 1, 0), 'intercom-close': R(0.5, 0.3, 1, 0), 'print-body': R(0.7, 5, 1, 0),
};
/** A sound with no rule of its own. */
export const DEFAULT_RULE: SfxRule = R(0.5, 0.1, 2);
export const ruleOf = (id: string): SfxRule => SFX_RULES[id] ?? DEFAULT_RULE;

/**
 * The sound a limb makes when it fires or acts, by the family's class. A family not here makes
 * none of its own (the engines and the support limbs act through others; the swamp does not fire).
 */
export const FIRE_CLASS: Partial<Record<TowerFamily, string>> = {
  spitter: 'fire-spit', sprout: 'fire-spit', blighter: 'fire-spit',
  mister: 'fire-hiss',
  impaler: 'fire-harpoon', lance: 'fire-harpoon',
  quill: 'fire-quills', boomerang: 'fire-quills',
  frond: 'fire-lightning', capacitor: 'fire-lightning',
  prism: 'fire-beam', ocular: 'fire-beam',
  ember: 'fire-flame',
  burster: 'fire-lob', lobber: 'fire-lob', sling: 'fire-lob', bombard: 'fire-lob', skipper: 'fire-lob',
  maw: 'fire-bite', spine: 'fire-bite', brood: 'fire-bite',
  net: 'fire-web', tangler: 'fire-web',
  lasher: 'fire-lash',
};

/** How an insect dies, by its kind. */
export function deathOf(kind: EnemyKind): string {
  if (kind === 'royal' || kind === 'consort' || kind === 'matron') return 'die-boss';
  if (kind === 'flier' || kind === 'shadewing') return 'die-flier';
  if (kind === 'soldier' || kind === 'elite' || kind === 'phalanx' || kind === 'carapace' || kind === 'bomber'
    || kind === 'mortar' || kind === 'cannon' || kind === 'dartgun' || kind === 'tunneler') return 'die-soldier';
  return 'die-bug';
}

// ------------------------------------------------------------------------------ music

/** What the music is doing: one scene at a time; the engine crossfades between them. */
export type MusicScene = 'silent' | 'film' | 'menu' | 'ship' | 'build' | 'assault' | 'organ' | 'end';

/** Which loop plays in a scene (null: none; the film's score is started by the film itself). */
export const SCENE_TRACK: Record<MusicScene, string | null> = {
  silent: null, film: null, menu: 'theme-menu', ship: 'theme-ship', build: 'siege-build', assault: 'siege-assault', organ: 'organ', end: null,
};
/** Seconds each crossfade INTO a scene takes (the assault comes in fast, the rest breathe). */
export const SCENE_FADE: Record<MusicScene, number> = {
  silent: 1.5, film: 0.5, menu: 2.5, ship: 2.5, build: 2.5, assault: 1.2, organ: 2, end: 1.2,
};

/** The music under a voice (YOKE, the boss, the narrator), and the effects. */
export const DUCK = { music: 0.3, sfx: 0.6, attack: 0.12, release: 0.8 };
/** The music under a stinger. */
export const STING_DUCK = 0.35;

/**
 * The scene the game is in (main.ts reads its screens and hands them here): a pure choice so the
 * tests can hold it to what Collins asked (menu → ship → run build/assault → organ → end).
 */
export function sceneOf(s: {
  film: boolean; menu: boolean; ship: boolean; started: boolean; organ: boolean; outcome: 'playing' | 'won' | 'lost'; siege: boolean; enemies: number;
}, prev: MusicScene = 'silent'): MusicScene {
  if (s.film) return 'film';
  if (s.ship) return 'ship';
  if (s.menu) return 'menu';
  if (!s.started) return 'silent';
  if (s.outcome !== 'playing') return 'end';
  if (s.organ) return 'organ';
  // The assault is the siege with the hive on the board; the wave's tail (the last few) falls back.
  // Once in, it holds until the board is clear (no flapping at two or three left).
  if (s.siege && (s.enemies >= 3 || (prev === 'assault' && s.enemies > 0))) return 'assault';
  return 'build';
}
