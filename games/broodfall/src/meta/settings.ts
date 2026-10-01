/**
 * THE PLAYER'S SETTINGS — the model (no DOM; the screen is src/ui/settings.ts; kept in
 * localStorage by src/meta/storage.ts). Everything here is read at the moment it is used, so a
 * change made in the settings screen reaches the game without a reload (the board's colours
 * and the text size are re-applied by the screen itself).
 *
 * What lives elsewhere and is only SWITCHED here: YOKE's voice on/off (YokeSettings.muted, in
 * storage.ts beside her key and mode), the HUD style (src/hud/themes.ts, `broodfall-hud`).
 */

/** What the board reads every frame (src/render/isoRender.ts): set by the settings screen's applySettings. */
export const CALM = { flashes: false };

export type Channel = 'master' | 'music' | 'sfx' | 'voice';
export type CasteTints = 'standard' | 'safe';

export interface Settings {
  v: 1;
  /** 0..1 each; what is heard is master × channel. */
  volume: Record<Channel, number>;
  /** The keys that turn the board (single characters, lower case). */
  keys: { turnLeft: string; turnRight: string };
  /** Pointer at the window's edge slides the board. */
  edgeScroll: boolean;
  /** The wheel's zoom step per notch (1.05 slow … 1.35 fast). */
  zoomStep: number;
  /** The game speed a deployment starts at (the address's ?speed= still wins). */
  speed: 1 | 3 | 8;
  /** Text and panels, scaled (0.9 … 1.3). */
  textScale: number;
  /** No sliding, pulsing or animated panels. */
  reduceMotion: boolean;
  /** No bright flashes on the board (hits, bursts). */
  reduceFlashes: boolean;
  /** The three caste currencies' colours: the game's own, or a set told apart by every kind of colour vision. */
  casteTints: CasteTints;
  /** Silence while the window is not in front (another window or tab has it). */
  muteUnfocused: boolean;
  /** The landing film before a deployment (src/ui/landing.ts): every time, the first time on each tile set, or never. */
  landingFilms: LandingFilms;
}

export type LandingFilms = 'always' | 'first' | 'never';

export const DEFAULT_SETTINGS: Settings = {
  v: 1,
  volume: { master: 0.8, music: 0.7, sfx: 0.8, voice: 1 },
  keys: { turnLeft: 'q', turnRight: 'e' },
  edgeScroll: false,
  zoomStep: 1.15,
  speed: 1,
  textScale: 1,
  reduceMotion: false,
  reduceFlashes: false,
  casteTints: 'standard',
  muteUnfocused: true,
  landingFilms: 'always',
};

/**
 * The caste colours: the game's (src/render/render.ts CASTE_COLORS, src/style.css --war etc.)
 * and the colour-blind-safe set (Okabe & Ito's palette: vermilion, sky blue, yellow; they differ in
 * lightness as well as hue, so they part under protanopia, deuteranopia and tritanopia alike).
 */
export const CASTE_TINTS: Record<CasteTints, { war: number; science: number; royal: number }> = {
  standard: { war: 0xd1603c, science: 0x4fa9a4, royal: 0xd4a72c },
  safe: { war: 0xd55e00, science: 0x56b4e9, royal: 0xf0e442 },
};

const clamp = (v: unknown, lo: number, hi: number, dflt: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
const key = (v: unknown, dflt: string): string =>
  typeof v === 'string' && v.length === 1 && v.trim() ? v.toLowerCase() : dflt;

/** Settings as they were saved, made whole (anything missing or broken falls to its default). */
export function settingsFrom(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object') return structuredClone(d);
  const r = raw as Record<string, any>;
  const vol = (r.volume && typeof r.volume === 'object' ? r.volume : {}) as Record<string, unknown>;
  const keys = (r.keys && typeof r.keys === 'object' ? r.keys : {}) as Record<string, unknown>;
  let turnLeft = key(keys.turnLeft, d.keys.turnLeft);
  let turnRight = key(keys.turnRight, d.keys.turnRight);
  if (turnLeft === turnRight) { turnLeft = d.keys.turnLeft; turnRight = d.keys.turnRight; }
  return {
    v: 1,
    volume: {
      master: clamp(vol.master, 0, 1, d.volume.master), music: clamp(vol.music, 0, 1, d.volume.music),
      sfx: clamp(vol.sfx, 0, 1, d.volume.sfx), voice: clamp(vol.voice, 0, 1, d.volume.voice),
    },
    keys: { turnLeft, turnRight },
    edgeScroll: r.edgeScroll === true,
    zoomStep: clamp(r.zoomStep, 1.05, 1.35, d.zoomStep),
    speed: r.speed === 3 || r.speed === 8 ? r.speed : 1,
    textScale: clamp(r.textScale, 0.9, 1.3, d.textScale),
    reduceMotion: r.reduceMotion === true,
    reduceFlashes: r.reduceFlashes === true,
    casteTints: r.casteTints === 'safe' ? 'safe' : 'standard',
    muteUnfocused: r.muteUnfocused !== false,
    landingFilms: r.landingFilms === 'first' || r.landingFilms === 'never' ? r.landingFilms : 'always',
  };
}

/** What a sound on this channel plays at (0..1). */
export const gainOf = (s: Settings, ch: Exclude<Channel, 'master'>): number => s.volume.master * s.volume[ch];

/** A key pressed on the board: -1 turn left, 1 turn right, 0 not a turn key. */
export function turnOf(s: Settings, pressed: string): -1 | 0 | 1 {
  const k = pressed.length === 1 ? pressed.toLowerCase() : '';
  return k === s.keys.turnLeft ? -1 : k === s.keys.turnRight ? 1 : 0;
}

/** Keys the game already uses on the board, which a turn key may not take. */
export const RESERVED_KEYS = [' ', 'escape', 'home', 'enter', 'shift'];
