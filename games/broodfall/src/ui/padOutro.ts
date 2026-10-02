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
 * `reduceMotion`) skips it entirely, as does missing art or a browser that cannot play it. Under
 * automation (navigator.webdriver) it plays only when localStorage['broodfall-pad-outro'] is 'on'.
 */
import { artUrl } from '../render/art';
import { loadSettings } from '../meta/storage';
import { sfx } from '../audio/engine';
import { shipLoop, withLoader } from './loader';

/** When the pad meets the desk in each clip (seconds; read off the baked corners: the frame its motion falls away). */
const PAD_CONTACT: Record<PadOutcome, number> = { won: 2.3, lost: 2.25 };

export type PadOutcome = 'won' | 'lost';
type Pt = [number, number];
type Quad = [Pt, Pt, Pt, Pt];

interface PadClip { video: string; quads: string; seconds: number; fps: number; w: number; h: number }
/**
 * PART 2 (Collins, Oct 2 2026: "a second part of you turning around and getting up to move into the ship's interface,
 * with the AI character talking to you ... it's meant to transition the two interfaces"; "have you feel like you're
 * really in a ship"): from part 1's last frame (the pad asleep on the desk) he stands, turns past the window onto the
 * planet, walks through the hatch into the Directive Desk's room and stops at the table; the clip's last frame IS a
 * screenshot of the interface's report backdrop (tools/shot-padship-end.mjs), so the live interface takes over from the
 * same picture. Sound: the ship's hum, his chair and steps on the deck plating, the hatch, a chime (baked into the clip).
 * tools/art/templates/pad-ship.mjs; `cut` is where the first-person shot hands to the walk; `poster` its last frame.
 */
interface Part2Clip { video: string; seconds: number; cut: number; w: number; h: number; fps: number; poster?: string }
interface PadManifest { version: number; clips: Partial<Record<PadOutcome, PadClip>>; part2?: Partial<Record<PadOutcome, Part2Clip>> }
interface Loaded { clip: PadClip; quads: Array<number[] | null>; src: string }
interface Loaded2 { clip: Part2Clip; src: string; poster: string | null }

/** What the interface shows when part 2 has landed on it: the ship's report (campaignUi), else the plain report. */
const LANDED = '#campaign:not(.hidden) .cp-card, #debrief:not(.hidden)';

/** How long the zoom from "the screen fills the window" to the clip's own frame takes. */
const ZOOM_S = 0.7;
/** What is taken off the pad's screen as it pulls back: the end-of-run dialog (src/ui/hud.ts showOverlay). */
const CLEARED = ['overlay'];
/** The page drawn this many pixels past the keyed screen on every side (the bezel hides it). */
const BLEED = 4;

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

/**
 * The frame a presented media time shows (Oct 2 2026, the shake). A frame's timestamp is i / fps, stored in whole
 * milliseconds by the WebM muxer, so i / fps can come back a hair under (0.0333 s * 30 = 0.999): round to the nearest
 * frame, never floor, and stay inside the clip.
 */
export function frameAt(mediaTime: number, fps: number, frames: number): number {
  return Math.max(0, Math.min(frames - 1, Math.round(mediaTime * fps)));
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

const loaded2: Partial<Record<PadOutcome, Promise<Loaded2 | null>>> = {};
function load2(outcome: PadOutcome): Promise<Loaded2 | null> {
  loaded2[outcome] ??= manifest().then(async (m) => {
    const clip = m?.part2?.[outcome];
    if (!clip) return null;
    const blob = await fetch(artUrl(`pad/${clip.video}`)).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))));
    return { clip, src: URL.createObjectURL(blob), poster: clip.poster ? artUrl(`pad/${clip.poster}`) : null };
  }).catch((e) => { console.warn('[pad] no part 2', e); return null; });
  return loaded2[outcome]!;
}

/** Fetch the clips ahead (call once a run is under way, so the end does not wait on the network). `part2`: a campaign run. */
export function preloadPadOutro(part2 = false): void {
  void load('won');
  void load('lost');
  if (part2) { void load2('won'); void load2('lost'); }
}

/** What the player hears part 2 at: the master and effects volumes (src/meta/settings.ts). */
function part2Volume(): number {
  try { const v = loadSettings().volume; return Math.max(0, Math.min(1, (v.master ?? 1) * (v.sfx ?? 1))); } catch { return 1; }
}

/**
 * Hand the screen over to the interface: resolve (the caller puts the report up under the picture), wait until it IS
 * up (its card drawn, at most 6 s: its pictures may still be coming), then fade the picture away over it.
 */
function handOver(over: HTMLElement, finish: () => void, cleanup: () => void): void {
  finish();
  const t0 = performance.now();
  const wait = () => {
    if (document.querySelector(LANDED) || performance.now() - t0 > 6000) {
      over.style.transition = 'opacity 0.9s ease';
      requestAnimationFrame(() => requestAnimationFrame(() => { over.style.opacity = '0'; }));
      window.setTimeout(() => { over.remove(); cleanup(); }, 1000);
      return;
    }
    window.setTimeout(wait, 80);
  };
  wait();
}

/**
 * Reduce motion, a campaign run: no film, a short cross-fade through the room he ends up in (part 2's last frame) to
 * the interface (Collins's brief: "Reduce motion plays a short cross-fade").
 */
async function crossFade(outcome: PadOutcome): Promise<void> {
  const got = await Promise.race([load2(outcome), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  if (!got?.poster) return;
  const over = document.createElement('div');
  over.id = 'pad-outro';
  over.dataset.part = 'fade';
  over.style.cssText = `position:fixed;inset:0;z-index:2147483600;background:#000 url("${got.poster}") center/cover no-repeat;opacity:0;transition:opacity 0.35s ease;`;
  document.documentElement.appendChild(over);
  requestAnimationFrame(() => requestAnimationFrame(() => { over.style.opacity = '1'; }));
  await new Promise((r) => setTimeout(r, 450));
  await new Promise<void>((finish) => handOver(over, finish, () => {}));
}

let playing = false;
/** True while the pad is on the screen (the board's edge scroll and keys stand still). */
export function padOutroPlaying(): boolean { return playing; }

/** Under automation the pad plays only when its own beat asks (tools/shot-pad.mjs sets localStorage['broodfall-pad-outro']). */
function automatedOff(): boolean {
  try { return !!navigator.webdriver && localStorage.getItem('broodfall-pad-outro') !== 'on'; } catch { return false; }
}
function reduceMotion(): boolean {
  try { return loadSettings().reduceMotion; } catch { return false; }
}
/** Whether the outro plays at all: not with "reduce motion" on. */
function wanted(): boolean {
  // Browser beats (Playwright) that are about something else wait on the report as before.
  return !automatedOff() && !reduceMotion();
}

// ---------------------------------------------------------------- playing

/**
 * Play the pad being set down, the live page on its screen. Resolves when the report should be
 * shown (the pad has gone to sleep, the page is back as it was); the desk then fades out by itself.
 * Resolves at once when it is not to be played.
 */
export async function playPadOutro(outcome: PadOutcome, opts: { part2?: boolean } = {}): Promise<void> {
  if (playing) return;
  if (!wanted()) {
    // Reduce motion on a campaign run: a short cross-fade through the room to the interface instead of the films.
    if (opts.part2 && reduceMotion() && !automatedOff()) await crossFade(outcome);
    return;
  }
  // Part 2 is fetched alongside part 1 (preloaded while the run is on); it is played only if it is here when part 1 ends.
  const part2 = opts.part2 ? load2(outcome) : Promise.resolve(null);
  let got2: Loaded2 | null = null;
  void part2.then((g) => { got2 = g; });
  // Still arriving (it is fetched while the run is on, so rarely): a loop while it does, never a still board (src/ui/loader.ts).
  const got = await withLoader(Promise.race([load(outcome), new Promise<null>((r) => setTimeout(() => r(null), 4000))]), shipLoop(), { label: 'THE FIELD REPORT' });
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
  // The clip is DRAWN, frame by frame, into a canvas in the same callback that warps the page to that frame's
  // corners, so the picture and the page always change together (Oct 2 2026: shown as a <video>, the browser could put
  // a new frame up a display frame before the page's transform followed, and the page shook against the pad's bezel).
  // The <video> itself plays unseen (kept in the page so it decodes).
  video.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
  const canvas = document.createElement('canvas');
  canvas.width = clip.w;
  canvas.height = clip.h;
  canvas.style.cssText = 'position:absolute;display:block;max-width:none;';
  const ctx = canvas.getContext('2d');
  stage.appendChild(canvas);
  over.appendChild(video);
  over.appendChild(stage);

  // On the page, warped with it: the look of a device's screen, and its going to sleep.
  const glass = document.createElement('div');
  glass.id = 'pad-glass';
  glass.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:0;';
  glass.innerHTML =
    '<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.10) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(0,0,0,.06) 0 1px,transparent 1px 3px);"></div>' +
    '<div style="position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.10) 42%,rgba(255,255,255,.03) 55%,rgba(255,255,255,0) 64%),radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.22) 100%);"></div>' +
    '<div class="pad-dim" style="position:absolute;inset:0;background:rgba(6,10,14,.05);"></div>' +
    '<div class="pad-sleep" style="position:absolute;inset:0;background:#000;opacity:0;"></div>';
  body.appendChild(glass);
  const sleepEl = glass.querySelector('.pad-sleep') as HTMLElement;

  const cleared = CLEARED.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el && !el.classList.contains('hidden'));
  const clearedWas = cleared.map((el) => el.style.opacity);
  let done = false;
  let finish!: () => void;
  const ended = new Promise<void>((r) => { finish = r; });

  const layout = (mediaTime: number) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    // The clip covers the window (cropped, never letterboxed).
    const s = Math.max(vw / clip.w, vh / clip.h);
    const ox = (vw - clip.w * s) / 2, oy = (vh - clip.h * s) / 2;
    canvas.style.left = `${ox}px`; canvas.style.top = `${oy}px`;
    canvas.style.width = `${clip.w * s}px`; canvas.style.height = `${clip.h * s}px`;
    const toView = (q: Quad): Quad => q.map(([x, y]) => [ox + x * s, oy + y * s]) as Quad;
    const [kx, ky, tx, ty] = zoomAt(mediaTime, toView(first), vw, vh);
    stage.style.transform = `matrix(${kx},0,0,${ky},${tx},${ty})`;
    const frame = frameAt(mediaTime, clip.fps, quads.length);
    if (ctx && video.readyState >= 2) { ctx.clearRect(0, 0, clip.w, clip.h); ctx.drawImage(video, 0, 0, clip.w, clip.h); }
    const q = quadAt(quads, frame);
    if (!q) return;
    const inView = growQuad(toView(q).map(([x, y]) => [x * kx + tx, y * ky + ty]) as Quad, BLEED);
    body.style.transform = cssMatrix3d(rectToQuad(vw, vh, inView));
    // The device look comes up as the pad pulls back, and the run's end message clears off the screen
    // (the pad shows the board and the console, not a dialog; the report says the rest).
    glass.style.opacity = String(Math.min(1, mediaTime / ZOOM_S));
    for (const el of cleared) el.style.opacity = String(Math.max(0, 1 - mediaTime / ZOOM_S));
  };

  const vfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number }).requestVideoFrameCallback?.bind(video);
  const tick = (_now: number, meta?: { mediaTime: number }) => {
    if (done) return;
    layout(meta ? meta.mediaTime : video.currentTime);
    if (vfc) vfc(tick); else requestAnimationFrame((n) => tick(n));
  };

  // Part 2 is on (the film into the ship): a press skips it to its last frame, the interface's own picture.
  let skip2: (() => void) | null = null;
  const cleanupAll = () => { URL.revokeObjectURL(video.src); loaded[outcome] = undefined; if (got2) { URL.revokeObjectURL(got2.src); loaded2[outcome] = undefined; } };
  /** Part 2: he stands, turns, walks into the ship; its last frame is the interface's, which then takes over (handOver). */
  const playPart2 = (g: Loaded2, skipNow: boolean) => {
    // Part 1's last frame (the pad asleep on the desk) stays up until part 2's first frame is drawn over it: no black
    // between them. The poster (the interface's picture) goes under only when part 2 lands or is skipped.
    over.dataset.part = '2';
    const showPoster = () => { if (g.poster) over.style.background = `#000 url("${g.poster}") center/cover no-repeat`; };
    const v2 = document.createElement('video');
    v2.playsInline = true;
    v2.preload = 'auto';
    v2.src = g.src;
    v2.volume = part2Volume();
    v2.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;';
    v2.addEventListener('playing', () => { v2.style.opacity = '1'; requestAnimationFrame(() => stage.remove()); }, { once: true });
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      skip2 = null;
      window.removeEventListener('keydown', onKey, true);
      v2.pause();
      showPoster();
      stage.remove();
      playing = false;
      handOver(over, finish, cleanupAll);
    };
    // Skipped: straight to the last frame (the poster under it), the interface takes over from it.
    skip2 = () => { v2.style.opacity = '0'; land(); };
    if (skipNow) { over.dataset.skipped = '1'; skip2(); return; }
    over.appendChild(v2);
    v2.addEventListener('ended', land);
    v2.addEventListener('error', land);
    // With sound (the ship's hum, his steps, the hatch); a browser that refuses sound plays it silent.
    v2.play().catch(() => { v2.muted = true; return v2.play(); }).catch(land);
    window.setTimeout(land, (g.clip.seconds + 4) * 1000);
  };
  const end = (skipped = false) => {
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
      cleared.forEach((el, i) => { el.style.opacity = clearedWas[i]; });
      if (got2) { playPart2(got2, skipped); return; }
      playing = false;
      finish();
      // The desk fades away over the report.
      over.style.transition = 'opacity 0.8s ease';
      requestAnimationFrame(() => requestAnimationFrame(() => { over.style.opacity = '0'; }));
      window.setTimeout(() => { over.remove(); cleanupAll(); }, 900);
      window.removeEventListener('keydown', onKey, true);
    }, skipped ? 120 : 300);
  };
  const press = () => { if (skip2) skip2(); else end(true); };
  const onKey = (ev: KeyboardEvent) => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') press();
  };
  over.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); press(); });
  window.addEventListener('keydown', onKey, true);
  video.addEventListener('ended', () => end());
  video.addEventListener('error', () => end());

  // The page as it is, then the pad around it.
  body.style.transformOrigin = '0 0';
  body.style.width = '100vw';
  body.style.willChange = 'transform';
  document.documentElement.appendChild(over);
  layout(0);
  try {
    await video.play();
    sfx(outcome === 'won' ? 'pad-won' : 'pad-lost', { delay: PAD_CONTACT[outcome] });
  } catch (e) {
    console.warn('[pad] could not play', e);
    end();
    return ended;
  }
  if (vfc) vfc(tick); else requestAnimationFrame((n) => tick(n));
  // A clip that stalls must never hold the report back.
  window.setTimeout(() => end(), (clip.seconds + 3) * 1000);
  return ended;
}
