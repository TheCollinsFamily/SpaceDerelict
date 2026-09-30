/**
 * THE NEWS BETWEEN RUNS, AND THE ENDING FILMS (Sep 30 2026; content/media.ts, src/meta/media.ts).
 *
 * On the way back to the ship after a deployment (main.ts campaignDebrief, the report's button),
 * the planet's news of it plays over everything:
 *   - a newsreel: a title card, 4 s shots cut together with titles set in TYPE, the announcer, the
 *     score; the Empire's in lurid Technicolor, the Commonwealth's in black and white;
 *   - a news clipping: their paper spins in, the photograph generated, every word set in type;
 *   - the BREAK: a shot the reel did not mean to show, ungraded, the music cut to the raw field
 *     for eight seconds; or the whole reel replayed with the filter off, no narrator, no music.
 * Each ending scene plays as a short film before its card (src/ui/sceneVoice.ts starts it).
 *
 * A click, Esc, Enter or Space skips. Its sound goes through the game's buses (Settings: music and
 * voices, "Mute when away"). Under automation it plays only with localStorage['broodfall-media-auto']
 * = 'on' (the other beats are not held up by it). `window.__bfMedia` plays any piece (the beats).
 * Nothing here is needed: without public/media/media.json there is simply no news.
 */
import './newsreel.css';
import { artUrl } from '../render/art';
import { duckFor, routeMedia } from '../audio/engine';
import { gain, loadSettings } from '../meta/storage';
import { ENDING_FILMS, MEDIA, NARRATION, type Clipping, type EndingFilm, type MediaPiece, type Reel } from '../../content/media';
import { emptyLog, logShown, momentsOf, pickMedia, type MediaLog, type Pick } from '../meta/media';
import type { CampaignState, Debrief } from '../meta/campaign';

interface Clip { video: string; poster?: string; seconds: number }
export interface MediaArt {
  clips: Record<string, Clip>;
  photos: Record<string, string>;
  pictures: Record<string, string>;
  voices: Record<string, { file: string; seconds: number; text: string; who?: string }>;
  narration: Record<string, { file: string; seconds: number; line?: string }>;
  music: Record<string, { file: string; seconds: number }>;
  field?: { file: string; seconds: number };
}

const BASE = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
/** A file of public/ (media.json's paths start at public/) as a whole address. */
export const mediaUrl = (f: string): string => new URL(BASE + f, document.baseURI).href;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let loading: Promise<MediaArt | null> | null = null;
let art: MediaArt | null = null;
/** public/media/media.json; null when it is not there (then there is no news). */
export function loadMedia(): Promise<MediaArt | null> {
  loading ??= fetch(mediaUrl('media/media.json'), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: MediaArt | null) => (art = j && j.clips ? j : null))
    .catch(() => null);
  return loading;
}
/** What has loaded so far (null until then). */
export const mediaNow = (): MediaArt | null => art;
/** A picture of media.json `pictures` (the reveal cards'), as a whole address. */
export function mediaPictureUrl(id: string | undefined): string | undefined {
  const f = id ? art?.pictures?.[id] : undefined;
  return f ? mediaUrl(f) : undefined;
}

/** A clip by id; 'intro:<id>' borrows a shot of the opening film. */
function clipOf(id: string): Clip | undefined {
  if (id.startsWith('intro:')) { const s = id.slice(6); return { video: new URL(artUrl(`intro/${s}.mp4`), document.baseURI).href, poster: new URL(artUrl(`intro/${s}.webp`), document.baseURI).href, seconds: 4 }; }
  const c = art?.clips[id];
  return c ? { video: mediaUrl(c.video), poster: c.poster ? mediaUrl(c.poster) : undefined, seconds: c.seconds } : undefined;
}

const automated = () => typeof navigator !== 'undefined' && navigator.webdriver;
const allowed = (): boolean => { if (!automated()) return true; try { return localStorage.getItem('broodfall-media-auto') === 'on'; } catch { return false; } };

// ------------------------------------------------------------------ sound
function sound(file: string, bus: 'music' | 'voice'): HTMLAudioElement {
  const a = new Audio(mediaUrl(file));
  a.preload = 'auto';
  if (!routeMedia(a, bus)) a.volume = Math.max(0, Math.min(1, gain(bus)));
  return a;
}
const playSafe = (a: HTMLAudioElement | null | undefined) => { if (a) void a.play().catch(() => {}); };
function fadeOut(a: HTMLAudioElement | null, ms = 700): void {
  if (!a) return;
  const v0 = a.volume;
  const t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(step); else a.pause(); };
  requestAnimationFrame(step);
}

// ------------------------------------------------------------------ the player
type Look = 'empire' | 'colony' | 'finale';
export interface MediaHandle { skip(): void; done: Promise<'ended' | 'skipped'> }
let playing: { id: string; shot: string; replay: boolean } | null = null;

interface Cut { clip: Clip; title?: string; small?: string; say?: string; raw?: boolean; id: string }

/** The overlay, its skip, its clock; `run` plays into it and calls `end` when it is over. */
function overlay(cls: string, run: (ui: { el: HTMLElement; later: (ms: number, f: () => void) => void; over: () => boolean; end: () => void; audio: Set<HTMLAudioElement> }) => void): MediaHandle {
  let finish: (h: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  const el = document.createElement('div');
  el.id = 'newsreel';
  el.className = cls;
  document.body.appendChild(el);
  const timers: number[] = [];
  const audio = new Set<HTMLAudioElement>();
  let over = false;
  const close = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    for (const t of timers) clearTimeout(t);
    for (const a of audio) fadeOut(a, how === 'skipped' ? 250 : 600);
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('leaving');
    window.setTimeout(() => { for (const v of el.querySelectorAll('video')) { v.pause(); v.removeAttribute('src'); v.load(); } el.remove(); }, 450);
    playing = null;
    finish(how);
  };
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); close('skipped'); } };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (ev) => { ev.stopPropagation(); close('skipped'); });
  run({ el, later: (ms, f) => { timers.push(window.setTimeout(() => { if (!over) f(); }, ms)); }, over: () => over, end: () => close('ended'), audio });
  return { skip: () => close('skipped'), done };
}

/** A film: a title card, the cuts, the last card; `look` grades it; `replay` plays the cuts again with the filter off after it. */
function film(opts: { id: string; look: Look; series?: string; issue?: string; cuts: Cut[]; end: string; music?: string; replay?: boolean }): MediaHandle {
  return overlay(`nr-reel nr-${opts.look}`, ({ el, later, end, audio }) => {
    el.innerHTML = `<div class="nr-film">
        <video class="nr-v" muted playsinline preload="auto"></video><video class="nr-v" muted playsinline preload="auto"></video>
        <div class="nr-title"><div class="nr-big"></div><div class="nr-small"></div></div>
        <div class="nr-card nr-open">${opts.series ? `<div class="nr-series">${esc(opts.series)}</div><div class="nr-rule"></div><div class="nr-issue">${esc(opts.issue ?? '')}</div>` : ''}</div>
        <div class="nr-card nr-end"><div class="nr-endline">${esc(opts.end)}</div></div>
        <div class="nr-grain"></div><div class="nr-vignette"></div><div class="nr-scratch"></div>
      </div>
      <button class="nr-skip" type="button">SKIP ▸ <span>Esc</span></button>`;
    const layers = [...el.querySelectorAll<HTMLVideoElement>('video')];
    const title = el.querySelector<HTMLElement>('.nr-title')!;
    const big = el.querySelector<HTMLElement>('.nr-big')!;
    const small = el.querySelector<HTMLElement>('.nr-small')!;
    const open = el.querySelector<HTMLElement>('.nr-open')!;
    const last = el.querySelector<HTMLElement>('.nr-end')!;
    const music = opts.music && art?.music[opts.music] ? sound(art.music[opts.music].file, 'music') : null;
    if (music) audio.add(music);
    let top = 0;
    const load = (c: Cut | undefined, v: HTMLVideoElement) => { if (c && v.dataset.clip !== c.id) { v.src = c.clip.video; if (c.clip.poster) v.poster = c.clip.poster; v.dataset.clip = c.id; v.load(); } };
    /** A shot into the layer not showing; when it is up, `after` loads into the one it replaced (never into the one on screen). */
    const show = (c: Cut, raw: boolean, next: () => void, ungraded = false, after?: Cut) => {
      const v = layers[1 - top];
      load(c, v);
      try { v.currentTime = 0; } catch { /* starts at 0 */ }
      const narr = !raw && c.say && art?.narration[c.say] ? art.narration[c.say] : null;
      // A shot lasts its clip, or as long as its line needs (the clip then runs a little slower).
      const secs = raw ? 8 : Math.max(c.clip.seconds, narr ? 0.45 + narr.seconds + 0.35 : 0);
      v.playbackRate = Math.max(0.5, Math.min(1, c.clip.seconds / secs));
      el.dataset.shot = c.id;
      if (playing) playing.shot = c.id;
      title.classList.remove('on');
      // The cut waits for its picture (the shot before holds its last frame meanwhile, never black), at most 2.5 s;
      // its title, its line and its length are counted from the moment it is up.
      let started = false;
      const go = () => {
        if (started) return;
        started = true;
        const up = () => {
          v.classList.add('on'); layers[top].classList.remove('on'); top = 1 - top;
          el.classList.toggle('raw', raw || ungraded);
          later(400, () => load(after, layers[1 - top]));
        };
        void v.play().then(up, up);
        if (!raw && !ungraded && c.title) {
          later(450, () => {
            big.textContent = c.title!; small.textContent = c.small ?? ''; title.classList.add('on');
            if (narr) { const a = sound(narr.file, 'voice'); audio.add(a); duckFor(a, 'newsreel'); playSafe(a); }
          });
          later(Math.max(1200, (secs - 0.4) * 1000), () => title.classList.remove('on'));
        }
        later(Math.max(1500, secs * 1000 - 200), next);
      };
      if (v.readyState >= 3) go();
      else { v.addEventListener('canplay', go, { once: true }); later(2500, go); }
    };
    /** The break: the music cut, the field for as long as the shot lasts. */
    const field = () => { const f = art?.field ? sound(art.field.file, 'music') : null; if (f) { audio.add(f); playSafe(f); } return f; };
    const cuts = opts.cuts;
    let i = -1;
    const next = () => {
      i++;
      if (i >= cuts.length) { lastCard(); return; }
      const c = cuts[i];
      if (c.raw) {
        if (music) music.pause();
        const f = field();
        show(c, true, () => { if (f) fadeOut(f, 300); playSafe(music); next(); }, false, cuts[i + 1]);
      } else show(c, false, next, false, cuts[i + 1]);
    };
    const lastCard = () => {
      title.classList.remove('on');
      // The last frame stays under the card (the replay dissolves from it, never from black).
      el.classList.remove('raw');
      last.classList.add('on');
      el.dataset.shot = 'end';
      later(2800, () => {
        if (music) fadeOut(music, 900);
        if (!opts.replay) { later(500, end); return; }
        // The replay: the same footage with the filter off, no narrator, no music; only the field.
        last.classList.remove('on');
        el.classList.add('replay');
        if (playing) playing.replay = true;
        const f = field();
        let k = -1;
        const again = () => {
          k++;
          if (k >= cuts.length) { if (f) fadeOut(f, 600); later(700, end); return; }
          show(cuts[k], false, again, true, cuts[k + 1]);
        };
        later(900, again);
      });
    };
    load(cuts[0], layers[1]);
    playSafe(music);
    open.classList.add('on');
    later(opts.series ? 2300 : 300, () => { open.classList.remove('on'); next(); });
  });
}

function cutsOf(shots: Array<{ clip: string; title?: string; small?: string; say?: string; raw?: boolean }>): Cut[] {
  return shots.flatMap((s) => { const clip = clipOf(s.clip); return clip ? [{ ...s, clip, id: s.clip }] : []; });
}

/** One of their papers. */
function clipping(p: Clipping): MediaHandle {
  return overlay('nr-paper', ({ el, later, end, audio }) => {
    const photo = art?.photos[p.photo];
    const reduce = loadSettings().reduceMotion;
    el.innerHTML = `<div class="np-sheet${reduce ? ' still' : ''}">
        <div class="np-mast">${esc(p.paper)}</div>
        <div class="np-date">${esc(p.dateline)}</div>
        <h1 class="np-head">${esc(p.headline)}</h1>
        <div class="np-deck">${esc(p.deck)}</div>
        <div class="np-cols">
          <figure class="np-photo">${photo ? `<img src="${mediaUrl(photo)}" alt="">` : ''}<figcaption>${esc(p.caption)}</figcaption></figure>
          <div class="np-body">${p.body.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
        </div>
      </div>
      <div class="np-hint">click to continue</div>`;
    const music = art?.music['m-colony'] ? sound(art.music['m-colony'].file, 'music') : null;
    if (music) { audio.add(music); music.volume = Math.min(music.volume, 0.55); playSafe(music); later(6500, () => fadeOut(music, 1500)); }
    if (playing) playing.shot = p.photo;
    // It waits to be read; it never holds the game up for long.
    // The whole page on the screen, whatever its height.
    const sheet = el.querySelector<HTMLElement>('.np-sheet')!;
    const fit = () => { const k = Math.min(1, (window.innerHeight * 0.9) / Math.max(1, sheet.scrollHeight), (window.innerWidth * 0.94) / Math.max(1, sheet.offsetWidth)); sheet.style.setProperty('--fit', k.toFixed(3)); };
    fit();
    el.querySelector('img')?.addEventListener('load', fit);
    later(30000, end);
  });
}

/** Play a piece of content/media.ts. */
export function playPiece(p: MediaPiece, opts: { replay?: boolean } = {}): MediaHandle {
  playing = { id: p.id, shot: '', replay: false };
  if (p.kind === 'clipping') return clipping(p);
  const r = p as Reel;
  return film({ id: r.id, look: r.side, series: r.series, issue: r.issue, cuts: cutsOf(r.shots), end: r.end, music: r.side === 'empire' ? 'm-empire' : 'm-colony', replay: opts.replay });
}

/** The ending film of a scene (by its picture id), or null when it has none on disk. */
export function endingFilmOf(sceneId: string | undefined): EndingFilm | null {
  const f = sceneId ? ENDING_FILMS.find((x) => x.scene === sceneId) : undefined;
  return f && art && f.shots.every((s) => art!.clips[s.clip]) ? f : null;
}
export function playEndingFilm(f: EndingFilm): MediaHandle {
  playing = { id: f.scene, shot: '', replay: false };
  return film({ id: f.scene, look: 'finale', cuts: cutsOf(f.shots), end: f.end, music: f.music });
}

// ------------------------------------------------------------------ after a deployment
const LOG_KEY = 'broodfall-media';
function loadLog(seed: number): MediaLog {
  try { const j = JSON.parse(localStorage.getItem(LOG_KEY) ?? 'null') as MediaLog | null; if (j && j.seed === seed) return j; } catch { /* none */ }
  return emptyLog(seed);
}
function saveLog(l: MediaLog): void { try { localStorage.setItem(LOG_KEY, JSON.stringify(l)); } catch { /* private mode */ } }

/** The news of the deployment just played (resolves at once when there is none). */
export async function newsAfterDeployment(prev: CampaignState, next: CampaignState, d: Debrief): Promise<void> {
  if (!allowed()) return;
  if (!(await loadMedia())) return;
  const log = loadLog(next.seed);
  const pick = pickMedia(momentsOf(prev, next, d), log);
  if (!pick || !playable(pick)) return;
  saveLog(logShown(log, pick.piece));
  await playPiece(pick.piece, { replay: pick.replay }).done;
}
/** A piece is played only when its pictures are there. */
function playable(p: Pick): boolean {
  const x = p.piece;
  return x.kind === 'clipping' ? !!art?.photos[x.photo] : cutsOf(x.shots).length === x.shots.length;
}
export const mediaAllowed = allowed;

// For the beats (tools/shot-media.mjs): play any piece or ending film, and see what is playing.
(window as unknown as { __bfMedia: unknown }).__bfMedia = {
  load: loadMedia,
  play: async (id: string, replay = false) => { await loadMedia(); const p = MEDIA.find((m) => m.id === id); if (!p) return false; await playPiece(p, { replay }).done; return true; },
  start: async (id: string, replay = false) => { await loadMedia(); const p = MEDIA.find((m) => m.id === id); if (!p) return false; void playPiece(p, { replay }); return true; },
  film: async (scene: string) => { await loadMedia(); const f = endingFilmOf(scene); if (!f) return false; void playEndingFilm(f); return true; },
  state: () => ({ playing, loaded: !!art, pieces: MEDIA.length, narration: Object.keys(NARRATION).length }),
  pick: (moments: string[], log?: MediaLog) => pickMedia(moments, log ?? emptyLog(0))?.piece.id ?? null,
};
