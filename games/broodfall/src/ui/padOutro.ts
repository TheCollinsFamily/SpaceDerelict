/**
 * THE DATA PAD SET DOWN (Collins, Sep 30 2026): "when you are finished with a mission or lose it
 * should have a video that shows your character setting down a data pad that has something
 * similar to the last screen looked at in the game, to create the effect that that was you just
 * holding it".
 *
 * How it works. When a run ends, the page itself becomes the pad's screen:
 *
 *   - a clip (public/art/pad/<won|lost>.webm, tools/art/templates/pad.mjs) plays over everything:
 *     first person, his hands, the pad pulled back from his eyes and set down on his console desk
 *     under the window onto the planet. The pad's screen is keyed out of the clip (transparent);
 *     his fingers and the bezel are not, so they stay in front.
 *   - the whole page under it (the Pixi board AND the console HUD, live, exactly as the player left
 *     it) is warped into the screen's four corners every frame: a CSS matrix3d on <body> made from
 *     the corners baked beside the clip (public/art/pad/<id>.json). No picture is taken: it IS the
 *     last view, still running.
 *   - the cut is invisible: the clip starts zoomed in so that the screen fills the window exactly
 *     (the page untouched), and zooms out to its own frame in the first 0.7 s, the bezel sliding
 *     in from the edges. A device look (pixel grid, glare, a little dimming) fades in on the page.
 *   - at the end the screen goes to sleep (black), the page is put back, the report is shown, and
 *     the desk fades away over it.
 *
 * A click, Esc, Enter or Space skips it. "Reduce motion" in the settings (src/ui/settings.ts,
 * `reduceMotion`) skips it entirely, as does missing art or a browser that cannot play it.
 */
import { artUrl } from '../render/art';
import { loadSettings } from '../meta/storage';

export type PadOutcome = 'won' | 'lost';
type Pt = [number, number];
type Quad = [Pt, Pt, Pt, Pt];

interface PadClip { video: string; quads: string; seconds: number; fps: number; w: number; h: number }
interface PadManifest { version: number; clips: Partial<Record<PadOutcome, PadClip>> }
interface Loaded { clip: PadClip; quads: Array<number[] | null>; src: string }

/** How long the zoom from "the screen fills the window" to the clip's own frame takes. */
const ZOOM_S = 0.7;
/** The page drawn this many pixels past the keyed screen on every side (the bezel hides it). */
const BLEED = 2;

// ---------------------------------------------------------------- the maths (pure, tested)

/** Homography [a b c d e f g h i] taking the rectangle w x h to the quad [TL, TR, BR, BL]. */
export function rectToQuad(w: number, h: number, q: Quad): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den ? (sx * dy2 - dx2 * sy) / den : 0;
  const hh = den ? (dx1 * sy - sx * dy1) / den : 0;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  return [a / w, b / h, c, d / w, e / h, f, g / w, hh / h, 1];
}

/** Where a homography sends a point. */
export function applyH(m: number[], x: number, y: number): Pt {
  const z = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / z, (m[3] * x + m[4] * y + m[5]) / z];
}

/** The CSS transform (with transform-origin 0 0) that is the homography. */
export function cssMatrix3d(m: number[]): string {
  const [a, b, c, d, e, f, g, h, i] = m;
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, i].map((v) => +v.toPrecision(9)).join(',')})`;
}

/** The quad pushed `px` outward from its middle. */
export function growQuad(q: Quad, px: number): Quad {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  return q.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / l * px, y + (y - cy) / l * px]; }) as Quad;
}

/** The clip's corners at frame `i` (the nearest frame that has them). */
export function quadAt(quads: Array<number[] | null>, i: number): Quad | null {
  for (let d = 0; d < quads.length; d++) {
    const q = quads[Math.max(0, Math.min(quads.length - 1, i - d))] ?? quads[Math.max(0, Math.min(quads.length - 1, i + d))];
    if (q) return [[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]];
  }
  return null;
}

/**
 * The zoom at time t: an axis-aligned map (kx, ky, tx, ty) of the viewport, from "the first
 * frame's screen fills the window" (t = 0) to nothing (t >= ZOOM_S), eased.
 */
export function zoomAt(t: number, first: Quad, vw: number, vh: number): [number, number, number, number] {
  const xs = first.map((p) => p[0]), ys = first.map((p) => p[1]);
  const x0 = (Math.min(...xs) + (xs[0] + xs[3]) / 2) / 2, x1 = (Math.max(...xs) + (xs[1] + xs[2]) / 2) / 2;
  const y0 = (Math.min(...ys) + (ys[0] + ys[1]) / 2) / 2, y1 = (Math.max(...ys) + (ys[2] + ys[3]) / 2) / 2;
  const k0x = vw / (x1 - x0), k0y = vh / (y1 - y0);
  const u = Math.min(1, Math.max(0, t / ZOOM_S));
  const e = u * u * (3 - 2 * u); // smoothstep
  const kx = k0x + (1 - k0x) * e, ky = k0y + (1 - k0y) * e;
  const tx = -x0 * k0x * (1 - e), ty = -y0 * k0y * (1 - e);
  return [kx, ky, tx, ty];
}

// ---------------------------------------------------------------- loading

let manifestP: Promise<PadManifest | null> | null = null;
const loaded: Partial<Record<PadOutcome, Promise<Loaded | null>>> = {};

function manifest(): Promise<PadManifest | null> {
  manifestP ??= fetch(artUrl('pad/manifest.json'), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return manifestP;
}

function load(outcome: PadOutcome): Promise<Loaded | null> {
  loaded[outcome] ??= manifest().then(async (m) => {
    const clip = m?.clips?.[outcome];
    if (!clip) return null;
    const [quads, blob] = await Promise.all([
      fetch(artUrl(`pad/${clip.quads}`)).then((r) => r.json()).then((j) => j.quads as Array<number[] | null>),
      fetch(artUrl(`pad/${clip.video}`)).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ]);
    return { clip, quads, src: URL.createObjectURL(blob) };
  }).catch((e) => { console.warn('[pad] no clip', e); return null; });
  return loaded[outcome]!;
}

/** Fetch both clips ahead (call once a run is under way, so the end does not wait on the network). */
export function preloadPadOutro(): void {
  void load('won');
  void load('lost');
}

let playing = false;
/** True while the pad is on the screen (the board's edge scroll and keys stand still). */
export function padOutroPlaying(): boolean { return playing; }

/** Whether the outro plays at all: not with "reduce motion" on. */
function wanted(): boolean {
  try { return !loadSettings().reduceMotion; } catch { return true; }
}

// ---------------------------------------------------------------- playing

/**
 * Play the pad being set down, the live page on its screen. Resolves when the report should be
 * shown (the pad has gone to sleep, the page is back as it was); the desk then fades out by itself.
 * Resolves at once when it is not to be played.
 */
export async function playPadOutro(outcome: PadOutcome): Promise<void> {
  if (playing || !wanted()) return;
  const got = await Promise.race([load(outcome), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  if (!got || !wanted()) return;
  const first = quadAt(got.quads, 0);
  if (!first) return;
  playing = true;
  const { clip, quads } = got;
  const body = document.body;
  const saved = { transform: body.style.transform, origin: body.style.transformOrigin, will: body.style.willChange, width: body.style.width, filter: body.style.filter };

  // Over everything, outside <body> (so it is not warped with it): the clip, and a catcher for the skip.
  const over = document.createElement('div');
  over.id = 'pad-outro';
  over.style.cssText = 'position:fixed;inset:0;z-index:2147483600;overflow:hidden;cursor:pointer;background:transparent;';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0;will-change:transform;';
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = got.src;
  video.style.cssText = 'position:absolute;display:block;max-width:none;';
  stage.appendChild(video);
  over.appendChild(stage);

  // On the page, warped with it: the look of a device's screen, and its going to sleep.
  const glass = document.createElement('div');
  glass.id = 'pad-glass';
  glass.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:0;';
  glass.innerHTML =
    '<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(0,0,0,.10) 0 1px,transparent 1px 3px);"></div>' +
    '<div style="position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.10) 42%,rgba(255,255,255,.03) 55%,rgba(255,255,255,0) 64%),radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.35) 100%);"></div>' +
    '<div class="pad-dim" style="position:absolute;inset:0;background:rgba(6,10,14,.12);"></div>' +
    '<div class="pad-sleep" style="position:absolute;inset:0;background:#000;opacity:0;"></div>';
  body.appendChild(glass);
  const sleepEl = glass.querySelector('.pad-sleep') as HTMLElement;

  let done = false;
  let finish!: () => void;
  const ended = new Promise<void>((r) => { finish = r; });

  const layout = (mediaTime: number) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    // The clip covers the window (cropped, never letterboxed).
    const s = Math.max(vw / clip.w, vh / clip.h);
    const ox = (vw - clip.w * s) / 2, oy = (vh - clip.h * s) / 2;
    video.style.left = `${ox}px`; video.style.top = `${oy}px`;
    video.style.width = `${clip.w * s}px`; video.style.height = `${clip.h * s}px`;
    const toView = (q: Quad): Quad => q.map(([x, y]) => [ox + x * s, oy + y * s]) as Quad;
    const [kx, ky, tx, ty] = zoomAt(mediaTime, toView(first), vw, vh);
    stage.style.transform = `matrix(${kx},0,0,${ky},${tx},${ty})`;
    const q = quadAt(quads, Math.round(mediaTime * clip.fps));
    if (!q) return;
    const inView = growQuad(toView(q).map(([x, y]) => [x * kx + tx, y * ky + ty]) as Quad, BLEED);
    body.style.transform = cssMatrix3d(rectToQuad(vw, vh, inView));
    // The device look comes up as the pad pulls back.
    glass.style.opacity = String(Math.min(1, mediaTime / ZOOM_S));
  };

  const vfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number }).requestVideoFrameCallback?.bind(video);
  const tick = (_now: number, meta?: { mediaTime: number }) => {
    if (done) return;
    layout(meta ? meta.mediaTime : video.currentTime);
    if (vfc) vfc(tick); else requestAnimationFrame((n) => tick(n));
  };

  const end = () => {
    if (done) return;
    done = true;
    video.pause();
    // The screen goes to sleep; then the page is put back behind a black screen and the report can come.
    sleepEl.style.transition = 'opacity 0.28s ease-in';
    sleepEl.style.opacity = '1';
    window.setTimeout(() => {
      over.style.background = '#000';
      Object.assign(body.style, { transform: saved.transform, transformOrigin: saved.origin, willChange: saved.will, width: saved.width, filter: saved.filter });
      glass.remove();
      playing = false;
      finish();
      // The desk fades away over the report.
      over.style.transition = 'opacity 0.8s ease';
      requestAnimationFrame(() => requestAnimationFrame(() => { over.style.opacity = '0'; }));
      window.setTimeout(() => { over.remove(); URL.revokeObjectURL(video.src); loaded[outcome] = undefined; }, 900);
      window.removeEventListener('keydown', onKey, true);
    }, 300);
  };
  const onKey = (ev: KeyboardEvent) => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') end();
  };
  over.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); end(); });
  window.addEventListener('keydown', onKey, true);
  video.addEventListener('ended', end);
  video.addEventListener('error', end);

  // The page as it is, then the pad around it.
  body.style.transformOrigin = '0 0';
  body.style.width = '100vw';
  body.style.willChange = 'transform';
  document.documentElement.appendChild(over);
  layout(0);
  try {
    await video.play();
  } catch (e) {
    console.warn('[pad] could not play', e);
    end();
    return ended;
  }
  if (vfc) vfc(tick); else requestAnimationFrame((n) => tick(n));
  // A clip that stalls must never hold the report back.
  window.setTimeout(end, (clip.seconds + 3) * 1000);
  return ended;
}
