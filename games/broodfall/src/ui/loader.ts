/**
 * THE LOADERS (Oct 1 2026): every wait in the game shows a looping animation, never a still screen.
 *
 * Collins: "we had a loading screen here without a looping animation — that should never happen; the reason we
 * have the RFab API (among others) is to create those nice looping animations to engage users during load."
 * notes/LOADING-AUDIT.md lists every wait and what covers it; tools/art/loaders.mjs makes the loops.
 *
 *   emblem  the meteor in its ring, burning (the first load: the logo of the boot screen)
 *   creep   veins crawling across living flesh (the board's and the organ stage's waits; the boot's backdrop)
 *   scan    the ship console's loader: the asset's outline pulsing on a scan grid (the ship's waits, films buffering)
 *   yoke    YOKE thinking (her own clip): while her mind answers
 *   dance   YOKE dancing, now and then in place of the scan on the ship's waits, with a line of hers in type
 *
 * A loop is never the thing still loading: its FIRST PAINT is a small animated WebP (`<kind>-mini.webp`, a few dozen
 * KB, preloaded by index.html), and the full loop (`.webm`) takes over once it plays. Settings > Reduce motion (or
 * the system's): a slow version (`-slow.webp`, the video at a third of the speed), never a still frame.
 *
 * The API, for every screen that waits (and the landing film's session, src/ui/landing.ts):
 *   const h = showLoader('creep', { label: 'THE BOARD' });   // a full-screen cover, shown only after 400 ms
 *   h.progress(done, total);  h.hide();                        // or hideLoader() for every cover
 *   await withLoader(promise, 'scan', opts);                  // the same around one promise
 *   loopEl('yoke')                                            // just the loop, to put into a panel of your own
 * Every visible wait carries `data-loading` and a `.bf-loop` inside it (tools/shot-loading.mjs fails a wait that
 * shows without a playing loop).
 */
import { artUrl } from '../render/art';
import { loadSettings } from '../meta/storage';

export type LoaderKind = 'emblem' | 'creep' | 'scan' | 'yoke' | 'dance';

/** Waits shorter than this show nothing (no flash). */
export const LOADER_DELAY_MS = 400;

const FILES: Record<LoaderKind, { video: string; mini: string; slow: string; alpha: boolean }> = {
  emblem: { video: 'loaders/emblem.webm', mini: 'loaders/emblem-mini.webp', slow: 'loaders/emblem-slow.webp', alpha: true },
  creep: { video: 'loaders/creep.webm', mini: 'loaders/creep-mini.webp', slow: 'loaders/creep-slow.webp', alpha: false },
  scan: { video: 'loaders/scan.webm', mini: 'loaders/scan-mini.webp', slow: 'loaders/scan-slow.webp', alpha: false },
  yoke: { video: 'ship/yoke/thinking.webm', mini: 'loaders/yoke-mini.webp', slow: 'loaders/yoke-slow.webp', alpha: true },
  dance: { video: 'loaders/dance.webm', mini: 'loaders/dance-mini.webp', slow: 'loaders/dance-slow.webp', alpha: true },
};

/** The Navy's procurement voice, for the waits that are the Navy's (the board, the deployment). */
export const LOADING_LINES = [
  'Thawing the culture.',
  'Counting the insects. Estimate revised upward.',
  'Filing Form XC-4 (Release of Biological Asset Into Civilian Area).',
  'Calibrating the drop. Apologising to no one.',
  'Warming the meteor.',
  'Checking the asset for signs of sentiment. None found.',
  'Requisitioning a planet.',
];

/** The ship's own waits: the console talking to itself. */
export const SHIP_LINES = [
  'Docking the field pad.',
  'Reconciling the casualty ledger. Theirs.',
  'Re-pressurising the gene bay.',
  'Polishing the viewport. The planet is still there.',
  'Routing the report through three departments.',
  'Warming the projection plinth.',
];

/** YOKE, while she dances (Collins, Oct 1 2026: "a dancing version of your AI"). In her voice; never twice in a row. */
export const DANCE_LINES = [
  "Loading. I'm not dancing. This is calibration.",
  'This is a diagnostic routine. Do not look at it.',
  "The ship's gyroscopes need exercise. So do I.",
  "If anyone asks, I was defragmenting.",
  'Rhythm test passed. Dignity test pending.',
  "Don't tell Command. They think I only compute.",
  "The loading bar is slow. I'm not.",
];

const reduced = (): boolean => {
  try { if (loadSettings().reduceMotion) return true; } catch { /* no settings yet */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * One loop, ready to put anywhere: its first paint (the small animated WebP) at once, the full loop over it once it
 * plays. `cover`: fills its box (cropped) rather than fitting in it.
 */
export function loopEl(kind: LoaderKind, opts: { cover?: boolean; cls?: string; miniOnly?: boolean } = {}): HTMLElement {
  const f = FILES[kind];
  const slow = reduced();
  const el = document.createElement('div');
  el.className = `bf-loop bf-loop-${kind}${opts.cover ? ' cover' : ''}${f.alpha ? ' alpha' : ''}${opts.cls ? ` ${opts.cls}` : ''}`;
  el.dataset.loop = kind;
  el.setAttribute('aria-hidden', 'true');
  const img = new Image();
  img.className = 'bf-loop-mini';
  img.alt = '';
  img.decoding = 'async';
  img.src = artUrl(slow ? f.slow : f.mini);
  el.append(img);
  // `miniOnly`: the small loop alone (a stand-in for a few seconds, where the full one would fetch what is coming anyway).
  if (opts.miniOnly) return el;
  const v = document.createElement('video');
  v.className = 'bf-loop-full';
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.addEventListener('error', () => el.classList.remove('full'));
  v.src = artUrl(f.video);
  el.append(v);
  // Played when it is in the page (a video not yet in a document may not start by itself).
  queueMicrotask(() => { if (v.paused) void v.play().catch(() => {}); });
  return el;
}

// The full loop takes over from its first paint once it plays (wherever it is: loopEl's, or loopHtml's in a screen
// drawn from a string); with Reduce motion it plays at a third of the speed.
if (typeof document !== 'undefined') {
  document.addEventListener('playing', (ev) => {
    const v = ev.target;
    if (!(v instanceof HTMLVideoElement) || !v.classList.contains('bf-loop-full')) return;
    v.playbackRate = reduced() ? 0.35 : 1;
    v.parentElement?.classList.add('full');
  }, true);
}

/** The same loop as markup, for screens drawn from a string (it plays by itself: autoplay, muted). */
export function loopHtml(kind: LoaderKind, cls = ''): string {
  const f = FILES[kind];
  return `<div class="bf-loop bf-loop-${kind}${f.alpha ? ' alpha' : ''}${cls ? ` ${cls}` : ''}" data-loop="${kind}" aria-hidden="true">`
    + `<img class="bf-loop-mini" alt="" src="${artUrl(reduced() ? f.slow : f.mini)}">`
    + `<video class="bf-loop-full" src="${artUrl(f.video)}" muted autoplay loop playsinline preload="auto"></video></div>`;
}

/** Whether a loop element is moving now: its video advancing, or its animated first paint shown. */
export function loopPlaying(el: Element): boolean {
  const v = el.querySelector<HTMLVideoElement>('video.bf-loop-full');
  if (v && !v.paused && v.readyState >= 2) return true;
  const img = el.querySelector<HTMLImageElement>('img.bf-loop-mini');
  return !!img && img.complete && img.naturalWidth > 0;
}

// ------------------------------------------------------------------ the cover

/** Which of the ship's loops this wait gets: the scan, and YOKE's dance about one wait in three (never twice running). */
export function shipLoop(): LoaderKind {
  let last = '';
  // The beats (tools/shot-loading.mjs) pin it: localStorage['broodfall-loader'] = 'dance' | 'scan'.
  try { const pin = localStorage.getItem('broodfall-loader'); if (pin === 'dance' || pin === 'scan') return pin; } catch { /* private window */ }
  try { last = sessionStorage.getItem('bf-loader-last') ?? ''; } catch { /* private window */ }
  const kind: LoaderKind = last !== 'dance' && Math.random() < 0.34 ? 'dance' : 'scan';
  try { sessionStorage.setItem('bf-loader-last', kind); } catch { /* fine */ }
  return kind;
}

const lastLine = new WeakMap<readonly string[], number>();
/** A line from the list, never the one it gave last time. */
function nextLine(lines: readonly string[]): string {
  let i = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && i === lastLine.get(lines)) i = (i + 1) % lines.length;
  lastLine.set(lines, i);
  return lines[i];
}

export interface LoaderOpts {
  /** What is being prepared, set in type: "PREPARING <label>". */
  label?: string;
  /** The lines under it, one every 2.2 s (default: the Navy's for the board's loops, the ship's for the ship's). */
  lines?: readonly string[];
  /** Into this element (a panel) instead of over the whole screen. */
  host?: HTMLElement;
  /** Shown only after this long (default 400 ms): a wait shorter than it shows nothing. */
  delay?: number;
  /** The film's way: a small loop in the corner over what is on the screen, no backdrop. */
  corner?: boolean;
  /** With `host`: the panel is held at least this tall while the loop is in it (an empty box has no height). */
  panelHeight?: number;
}

export interface LoaderHandle {
  /** The real progress, where there is some: a bar and "n / m FILES". */
  progress(done: number, total: number): void;
  hide(): void;
  readonly shown: boolean;
}

const open = new Set<LoaderHandle>();

/**
 * A wait covered by a loop. Nothing shows for the first `delay` ms (400 by default); once it shows, it stays at
 * least 350 ms, so that it is a screen and not a flicker. hide() is safe to call any number of times.
 */
export function showLoader(kind: LoaderKind, opts: LoaderOpts = {}): LoaderHandle {
  const lines = opts.lines ?? (kind === 'dance' ? DANCE_LINES : kind === 'scan' || kind === 'yoke' ? SHIP_LINES : LOADING_LINES);
  let el: HTMLElement | null = null;
  let shownAt = 0;
  let gone = false;
  let timer = 0;
  let done = 0, total = 0;
  const build = () => {
    if (gone) return;
    el = document.createElement('div');
    el.className = `bf-loader bf-loader-${kind}${opts.host ? ' in-panel' : ''}${opts.corner ? ' corner' : ''}`;
    el.dataset.loading = kind;
    el.setAttribute('role', 'status');
    const card = document.createElement('div');
    card.className = 'bf-loader-card';
    card.append(loopEl(kind, { cls: 'bf-loader-loop' }));
    if (!opts.corner) {
      card.insertAdjacentHTML('beforeend', `${opts.label ? `<div class="bf-loader-what">PREPARING ${opts.label}</div>` : ''}`
        + '<div class="bf-loader-bar hidden"><div class="bf-loader-fill"></div></div><div class="bf-loader-count"></div>'
        + `<div class="bf-loader-line${kind === 'dance' ? ' her' : ''}"></div>`);
      const line = card.querySelector<HTMLElement>('.bf-loader-line')!;
      line.textContent = nextLine(lines);
      // Her line stays (she said it); the Navy's rotate.
      if (kind !== 'dance') timer = window.setInterval(() => { line.textContent = nextLine(lines); }, 2200);
    }
    el.append(card);
    if (opts.host && opts.panelHeight) { opts.host.style.minHeight = `${opts.panelHeight}px`; opts.host.style.position ||= 'relative'; }
    (opts.host ?? document.body).append(el);
    shownAt = performance.now();
    paint();
    requestAnimationFrame(() => el?.classList.add('on'));
  };
  const paint = () => {
    if (!el || !total) return;
    const k = Math.min(1, done / total);
    el.querySelector('.bf-loader-bar')?.classList.remove('hidden');
    const fill = el.querySelector<HTMLElement>('.bf-loader-fill');
    if (fill) fill.style.width = `${(k * 100).toFixed(1)}%`;
    const count = el.querySelector<HTMLElement>('.bf-loader-count');
    if (count) count.textContent = `${done} / ${total} FILES`;
  };
  const delayTimer = window.setTimeout(build, opts.delay ?? LOADER_DELAY_MS);
  const handle: LoaderHandle = {
    progress(d, t) { done = d; total = t; paint(); },
    hide() {
      if (gone) return;
      gone = true;
      open.delete(handle);
      window.clearTimeout(delayTimer);
      window.clearInterval(timer);
      const it = el;
      if (!it) return;
      const wait = Math.max(0, 350 - (performance.now() - shownAt));
      window.setTimeout(() => {
        it.classList.remove('on');
        it.classList.add('leaving');
        delete it.dataset.loading;
        window.setTimeout(() => { it.remove(); if (opts.host && opts.panelHeight) opts.host.style.minHeight = ''; }, 320);
      }, wait);
    },
    get shown() { return !!el && !gone; },
  };
  open.add(handle);
  return handle;
}

/** Every cover down (a screen that changes under them all). */
export function hideLoader(h?: LoaderHandle): void {
  if (h) { h.hide(); return; }
  for (const x of [...open]) x.hide();
}

/** A promise, covered by a loop while it is pending (nothing if it settles within 400 ms). */
export async function withLoader<T>(p: Promise<T>, kind: LoaderKind, opts: LoaderOpts = {}): Promise<T> {
  const h = showLoader(kind, opts);
  try { return await p; } finally { h.hide(); }
}

/**
 * A film that stalls while it plays (its next frames not here yet): a small loop in the corner of `host` until it
 * moves again; nothing for a stall under 400 ms. Returns a function that takes the loop down.
 */
export function watchBuffering(v: HTMLVideoElement, host: HTMLElement, kind: LoaderKind = 'scan'): () => void {
  let h: LoaderHandle | null = null;
  const on = () => { if (!h && !v.paused && !v.ended) h = showLoader(kind, { host, corner: true }); };
  const off = () => { h?.hide(); h = null; };
  v.addEventListener('waiting', on);
  for (const e of ['playing', 'pause', 'ended', 'emptied', 'error']) v.addEventListener(e, off);
  return off;
}

/** For the beats: the waits on the screen now, and whether each has a loop that moves. */
export function visibleWaits(): Array<{ what: string; playing: boolean }> {
  const out: Array<{ what: string; playing: boolean }> = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-loading]')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
    const loops = [...el.querySelectorAll('.bf-loop')];
    out.push({ what: `${el.id || el.className.split(' ')[0]}:${el.dataset.loading}`, playing: loops.some(loopPlaying) });
  }
  return out;
}
if (typeof window !== 'undefined') (window as unknown as { __bfWaits?: typeof visibleWaits }).__bfWaits = visibleWaits;
