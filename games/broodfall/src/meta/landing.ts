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
}

/** public/art/landing/landing.json. */
export interface LandingArt {
  /** The board's canvas (src/render/isoRender.ts) and the band of it every film's picture is. */
  canvas: { w: number; h: number };
  band: Rect & { x: number; y: number; w: number; h: number };
  films: Record<string, LandingFilm>;
}

export type LandingWhy = 'play' | 'no-film' | 'setting-never' | 'seen-set' | 'after-opening' | 'automation' | 'asked-off';

/**
 * Whether the landing film plays before this deployment, and why not when it does not.
 * `forced`: the address said ?landing=1 (or a beat set localStorage['broodfall-landing']='on'): it plays under automation
 * too (the player's setting still holds); `off`: ?landing=0.
 */
export function landingDecision(o: {
  mode: LandingFilms; set: string | null; seen: readonly string[]; hasFilm: boolean;
  afterOpening: boolean; automated: boolean; forced: boolean; off: boolean;
}): LandingWhy {
  if (o.off) return 'asked-off';
  if (!o.set || !o.hasFilm) return 'no-film';
  if (o.afterOpening) return 'after-opening';
  if (o.automated && !o.forced) return 'automation';
  if (o.mode === 'never') return 'setting-never';
  if (o.mode === 'first' && o.seen.includes(o.set)) return 'seen-set';
  return 'play';
}

/**
 * Where the film's picture must lie on the screen so that its last frame lies on the live board: the band of the
 * board's canvas it shows, mapped through the canvas's box on the screen, moved so that the film's crater is on the
 * live meteor (another seed puts the crash district elsewhere on the canvas).
 */
export function filmBoxOnBoard(canvasBox: Rect, art: Pick<LandingArt, 'canvas' | 'band'>, film: Pick<LandingFilm, 'core'>, liveCore: Pt | null): Rect {
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
