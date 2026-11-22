/**
 * THE LANDING FILMS — the rules (no DOM; the player is src/ui/landing.ts, the art tools/art/landing.mjs).
 *
 * Before every deployment (a campaign mission, a skirmish) the tile set's landing film plays: the ship lets the
 * asset go, it falls through that set's sky and strikes that set's city, and the dust clears ON the board. Mission 1
 * straight after the opening film does not get one: the opening film ends at the crash site and is its landing.
 */
import type { LandingFilms } from './settings';

export interface Rect { left: number; top: number; width: number; height: number }
export interface Pt { x: number; y: number }

export interface LandingFilm {
  set: string;
  video: string;
  /** Its last frame (the board at minute zero), and its first. */
  end: string;
  start?: string;
  seconds: number;
  /** When the fall begins (the sky shot) and when the meteor strikes (the white flash), in seconds. */
  fallAt: number;
  strikeAt: number;
  /** Where the meteor stands on the board's canvas in the film's last frame. */
  core: Pt;
  /**
   * The same film ending on each board a run can land on (Nov 22 2026), by `boardKey`: the release and the fall are
   * this film's, the strike is made from that board. A run that plays a landing is BUILT on one of these boards
   * (`landingBoardSeed`), so the film's last frame is the board the game starts on: no jump.
   */
  boards?: Record<string, LandingEnding>;
}

/** One ending of a set's film: the strike on one board, ending on that board's picture. */
export interface LandingEnding { video: string; end: string; core: Pt }

/**
 * The boards the landing films end on (Nov 22 2026). Collins, playtesting: "the animation flows into one way the board
 * could be set but then when gameplay starts the board snaps to a different configuration". The films ended on one
 * picture of one board while every run drew its own; now a run that lands is built on the board its film ends on.
 * One board seed per crash site (content/plates.ts START_PLATES: crash-site, dogleg, boulevard, crooked;
 * tools/measure/landing-boards.probe.ts), so the four crash sites still come round. A film is made for each board,
 * each count of entrances (1-3) and each tile set: tools/art/landing.mjs `endings`.
 */
export const LANDING_BOARDS = [6, 1, 2, 4] as const;
export const LANDING_ENTRANCES = [1, 2, 3] as const;
export const boardKey = (entrances: number, boardSeed: number): string => `e${entrances}-b${boardSeed}`;
/** The board a landing run is built on, chosen by the run's own seed (its waves and draws stay its own). */
export const landingBoardSeed = (runSeed: number): number => LANDING_BOARDS[Math.abs(Math.floor(runSeed)) % LANDING_BOARDS.length];
/**
 * Whether a run can be built on a landing board: a new board of the game's own size (not a defence's remembered or
 * grown city, not a pinned crash site, not a run gone back into).
 */
export function canLandOnBoard(cfg: { gridW: number; gridH: number; board?: unknown; pregrown?: unknown; crash?: number }, resumed: boolean): boolean {
  return !resumed && !cfg.board && !cfg.pregrown && cfg.crash == null && cfg.gridW === 50 && cfg.gridH === 40;
}
/** The film's ending on this run's board, or null (then no film plays: a film that ends on another board jumps). */
export function endingFor(film: LandingFilm, entrances: number, boardSeed: number | undefined): LandingEnding | null {
  if (boardSeed == null) return null;
  return film.boards?.[boardKey(entrances, boardSeed)] ?? null;
}

/** public/art/landing/landing.json. */
export interface LandingArt {
  /** The board's canvas (src/render/isoRender.ts) and the band of it every film's picture is. */
  canvas: { w: number; h: number };
  band: Rect & { x: number; y: number; w: number; h: number };
  films: Record<string, LandingFilm>;
}

/**
 * Where a film starts when the release is left out (mission 1: the ship is not seen before it is over): just past the
 * dissolve from the release into the fall (`fallAt` is where the dissolve begins; it lasts 0.3 s).
 */
export const fallStart = (film: Pick<LandingFilm, 'fallAt'>): number => +(film.fallAt + 0.35).toFixed(3);

export type LandingWhy = 'play' | 'no-film' | 'no-board' | 'defence' | 'setting-never' | 'seen-set' | 'after-opening' | 'automation' | 'asked-off';

/**
 * Whether the landing film plays before this deployment, and why not when it does not.
 * `forced`: the address said ?landing=1 (or a beat set localStorage['broodfall-landing']='on'): it plays under automation
 * too (the player's setting still holds); `off`: ?landing=0.
 */
export function landingDecision(o: {
  mode: LandingFilms; set: string | null; seen: readonly string[]; hasFilm: boolean;
  afterOpening: boolean; automated: boolean; forced: boolean; off: boolean;
  /** The film has an ending on this run's board (undefined: not asked, as before). */
  hasBoard?: boolean;
  /** A defence: the city is already the body's, nothing falls on it. */
  defence?: boolean;
}): LandingWhy {
  if (o.off) return 'asked-off';
  if (o.defence) return 'defence';
  if (!o.set || !o.hasFilm) return 'no-film';
  if (o.hasBoard === false) return 'no-board';
  if (o.afterOpening) return 'after-opening';
  if (o.automated && !o.forced) return 'automation';
  if (o.mode === 'never') return 'setting-never';
  if (o.mode === 'first' && o.seen.includes(o.set)) return 'seen-set';
  return 'play';
}

/** How the live board is drawn, against how it was drawn when the films' last frames were pictured. */
export interface BoardView {
  /** The canvas's own width in pixels (the renderer's, not its box on the screen). */
  canvasW: number;
  /** Canvas pixels per world pixel now. */
  liveScale: number;
  /** Canvas pixels per world pixel the same board was framed at on the films' canvas (`LandingArt.canvas`). */
  filmScale: number;
}

/**
 * Where the film's picture must lie on the screen so that its last frame lies on the live board: the band of the
 * board's canvas it shows, mapped through the canvas's box on the screen, moved so that the film's crater is on the
 * live meteor (another seed puts the crash district elsewhere on the canvas).
 */
export function filmBoxOnBoard(canvasBox: Rect, art: Pick<LandingArt, 'canvas' | 'band'>, film: Pick<LandingFilm, 'core'>, liveCore: Pt | null, view?: BoardView): Rect {
  // The canvas fills the window since Nov 22 2026 (it was the films' own 1360x1000): the picture is scaled by how big
  // the board is drawn on the screen against how big it was drawn in the film, and its crater put on the live meteor.
  if (view && liveCore && view.canvasW > 0 && view.filmScale > 0) {
    const kc = canvasBox.width / view.canvasW; // screen pixels per canvas pixel
    const s = (view.liveScale * kc) / view.filmScale; // screen pixels per film pixel
    const cx = canvasBox.left + liveCore.x * kc;
    const cy = canvasBox.top + liveCore.y * kc;
    return { left: cx + (art.band.x - film.core.x) * s, top: cy + (art.band.y - film.core.y) * s, width: art.band.w * s, height: art.band.h * s };
  }
  const k = canvasBox.width / art.canvas.w;
  const dx = liveCore ? liveCore.x - film.core.x : 0;
  const dy = liveCore ? liveCore.y - film.core.y : 0;
  return {
    left: canvasBox.left + (art.band.x + dx) * k,
    top: canvasBox.top + (art.band.y + dy) * k,
    width: art.band.w * k,
    height: art.band.h * k,
  };
}

/** The box a 16:9 film fills the window with (object-fit: cover), as a Rect. */
export function coverBox(vw: number, vh: number, aspect: number): Rect {
  const w = Math.max(vw, vh * aspect);
  const h = w / aspect;
  return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
}

const SEEN = 'broodfall-landing-seen';
export function landingSeen(): string[] {
  try { const v = JSON.parse(localStorage.getItem(SEEN) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}
export function markLandingSeen(set: string): void {
  try { const s = landingSeen(); if (!s.includes(set)) localStorage.setItem(SEEN, JSON.stringify([...s, set])); } catch { /* private mode */ }
}
