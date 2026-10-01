/**
 * THE STILLS THAT COME ALIVE (Oct 1 2026; Collins: "anywhere else where video is needed? We should add it.";
 * notes/VIDEO-AUDIT.md). A picture the player looks at for a while (a faction scene's lobby card, a landing site
 * over the briefing, the report's lead, the candidate's file photograph) is drawn as its still, marked
 * `data-alive="<group>:<id>"`; `wake(root)` swaps each such still for its seamless loop
 * (tools/art/stills-alive.mjs; public/art/alive/alive.json), whose poster is the loop's own first frame.
 *
 *   - ONE <video> per surface, kept across redrawings of the screen (the ship redraws its whole screen on every
 *     click): put back in the same task, it plays on where it was and nothing reloads;
 *   - it plays only while it is on the screen (an IntersectionObserver: a hidden screen, a scrolled-off card and
 *     a detached element are paused), and is let go (src dropped) once its surface is gone;
 *   - the still stays when there is no loop, under Settings > Reduce motion, when localStorage['broodfall-alive'] is
 *     'off', and under automation unless it is 'on'.
 */
import { artUrl } from '../render/art';
import { loadSettings } from '../meta/storage';
import './alive.css';

export interface AliveLoop { video: string; poster: string; w: number; h: number; seconds: number }

let loops: Record<string, AliveLoop> = {};
let loading: Promise<Record<string, AliveLoop>> | null = null;

/** alive.json, its paths made whole; {} when there is none. */
export function loadAlive(): Promise<Record<string, AliveLoop>> {
  loading ??= fetch(artUrl('alive/alive.json'), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { items?: Record<string, AliveLoop> } | null) => {
      const whole = (f: string) => new URL(artUrl(f), document.baseURI).href;
      loops = Object.fromEntries(Object.entries(j?.items ?? {}).filter(([, v]) => v?.video && v?.poster)
        .map(([k, v]) => [k, { ...v, video: whole(v.video), poster: whole(v.poster) }]));
      return loops;
    })
    .catch(() => loops);
  return loading;
}

/** The loop of a surface, once alive.json is in. */
export const aliveLoop = (key: string): AliveLoop | undefined => loops[key];

/**
 * Moving pictures are wanted: not under Reduce motion, not switched off. Under automation (navigator.webdriver) only
 * with localStorage['broodfall-alive'] = 'on', as the newsreel and the data pad (the older beats read these surfaces
 * as pictures; tools/shot-alive.mjs turns them on).
 */
export function aliveAllowed(): boolean {
  return aliveSwitchedOn() && !loadSettings().reduceMotion;
}

/** The same, Reduce motion aside (for a surface that checks it on every frame). */
export function aliveSwitchedOn(): boolean {
  let flag: string | null = null;
  try { flag = localStorage.getItem('broodfall-alive'); } catch { /* no storage */ }
  if (flag === 'off') return false;
  return !(typeof navigator !== 'undefined' && navigator.webdriver && flag !== 'on');
}

const pool = new Map<string, HTMLVideoElement>();
let seen: IntersectionObserver | null = null;

function observer(): IntersectionObserver | null {
  if (seen || typeof IntersectionObserver === 'undefined') return seen;
  seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      v.dataset.inview = e.isIntersecting ? '1' : '0';
      if (e.isIntersecting && v.isConnected && !document.hidden) { if (v.paused) void v.play().catch(() => {}); } else if (!v.paused) v.pause();
    }
  });
  return seen;
}

function videoFor(key: string, loop: AliveLoop): HTMLVideoElement {
  let v = pool.get(key);
  if (!v) {
    v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.poster = loop.poster;
    v.src = loop.video;
    v.dataset.alive = key;
    pool.set(key, v);
    observer()?.observe(v);
  }
  return v;
}

/** Let a loop go: paused, its file dropped, forgotten. */
function release(key: string, v: HTMLVideoElement): void {
  seen?.unobserve(v);
  v.pause();
  v.removeAttribute('src');
  v.load();
  pool.delete(key);
}

/**
 * Swap every still marked `data-alive` under `root` for its loop (its classes, data and title carried over),
 * and let go of the loops whose surfaces are gone. Cheap to call after every drawing of a screen.
 */
export function wake(root: ParentNode | null): void {
  const used = new Set<string>();
  if (root && aliveAllowed()) {
    for (const img of root.querySelectorAll<HTMLImageElement>('img[data-alive]')) {
      const key = img.dataset.alive!;
      const loop = loops[key];
      if (!loop || used.has(key)) continue;
      const v = videoFor(key, loop);
      used.add(key);
      v.className = `${img.className} alive`;
      for (const [k, val] of Object.entries(img.dataset)) if (val !== undefined) v.dataset[k] = val;
      v.title = img.title;
      img.replaceWith(v);
      if (v.paused && !document.hidden) void v.play().catch(() => {});
    }
  }
  for (const [key, v] of pool) if (!used.has(key) && !v.isConnected) release(key, v);
  if (!aliveAllowed()) for (const [key, v] of pool) if (!used.has(key)) release(key, v);
}

/** Whether a loop is playing on the page now (for the beats: tools/shot-alive.mjs). */
export function aliveState(): Array<{ key: string; playing: boolean; time: number; connected: boolean }> {
  return [...pool].map(([key, v]) => ({ key, playing: !v.paused && v.readyState >= 2, time: v.currentTime, connected: v.isConnected }));
}

// A hidden tab plays nothing. (`window.broodfallAlive()`: what is in the pool, for the beats.)
if (typeof document !== 'undefined') {
  (window as unknown as { broodfallAlive?: typeof aliveState }).broodfallAlive = aliveState;
  document.addEventListener('visibilitychange', () => {
    for (const v of pool.values()) {
      if (document.hidden) v.pause();
      else if (v.isConnected && v.dataset.inview === '1' && v.paused) void v.play().catch(() => {});
    }
  });
}
