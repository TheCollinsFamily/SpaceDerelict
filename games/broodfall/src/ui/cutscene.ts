/**
 * A CUT SCENE AS A FILM (Collins, Oct 3 2026: "I think videos make sense for all of them"; content/cutscenes.ts has the
 * shot lists, tools/media/cutscenes.ts makes and bakes them).
 *
 * A faction scene that names a `film` plays as that film, full screen, before its card is read: ONE baked file
 * (public/media/scenes/<film>.mp4) with its own sound, and the cues of public/media/scenes/scenes.json saying which line
 * of the scene is said when, so that the words are set in type under the picture (the speaker's name over them).
 *
 * A click, Esc, Enter or Space skips. Its sound follows Settings (voices) through the game's buses. Under automation it
 * plays only with localStorage['broodfall-media-auto'] = 'on', as the newsreels. A film that is not baked yet is simply
 * not there: the scene is its card alone (src/ui/campaignUi.ts sceneHtml).
 */
import './cutscene.css';
import { routeMedia } from '../audio/engine';
import { gain } from '../meta/storage';
import { showLoader, watchBuffering } from './loader';
import { mediaUrl } from './newsreel';
import type { Scene } from '../../content/campaign';
import { speakerOf, spokenText } from '../../content/media';

export interface FilmCue { shot: string; line?: number; who?: string; text?: string; t0: number; t1: number }
export interface FilmArt { video: string; poster: string; seconds: number; cues: FilmCue[] }
interface ScenesArt { films: Record<string, FilmArt> }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let loading: Promise<ScenesArt | null> | null = null;
let art: ScenesArt | null = null;
/** The baked films (none when no film has been baked: every scene is then its card). */
export function loadScenes(): Promise<ScenesArt | null> {
  loading ??= fetch(mediaUrl('media/scenes/scenes.json'), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: ScenesArt | null) => (art = j && j.films ? j : null))
    .catch(() => null);
  return loading;
}
/** A scene's baked film; null when it has none (yet). */
export const filmArt = (id: string | undefined): FilmArt | null => (id && art?.films[id]) || null;
export const filmPosterUrl = (id: string | undefined): string | undefined => { const f = filmArt(id); return f ? mediaUrl(f.poster) : undefined; };

/** The line under the picture: who speaks, then the words as the scene has them now (the take's own words if it was rewritten since). */
export function cueHtml(scene: Scene, c: FilmCue): string {
  if (c.line === undefined) return '';
  const line = scene.lines[c.line] ?? '';
  const now = spokenText(line);
  const words = now && now === c.text ? now : c.text ?? now;
  const who = (now === c.text ? speakerOf(line) : c.who) || c.who || '';
  return words ? `<b>${esc(who === 'You' ? 'You' : who)}</b>${esc(words)}` : '';
}

let playing: { id: string; cue: string; t: number } | null = null;
export interface FilmHandle { skip(): void; done: Promise<'ended' | 'skipped'> }

/** Play a baked film over everything. `kicker`: the small line over it (who, what). */
export function playCutscene(id: string, scene: Scene, opts: { kicker?: string } = {}): FilmHandle {
  let finish: (h: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  const f = filmArt(id);
  if (!f) { finish('skipped'); return { skip: () => {}, done }; }
  const el = document.createElement('div');
  // The id the rest of the game reads as "a film is playing" (main.ts), with its own look.
  el.id = 'newsreel';
  el.className = 'cs-film';
  el.dataset.film = id;
  el.innerHTML = `<div class="cs-screen">
      <video class="cs-v" playsinline preload="auto" poster="${mediaUrl(f.poster)}"></video>
      <div class="cs-kicker">${esc(opts.kicker ?? scene.title.toUpperCase())}</div>
      <div class="cs-sub"></div>
    </div>
    <button class="nr-skip cs-skip" type="button">SKIP ▸ <span>Esc</span></button>`;
  document.body.appendChild(el);
  const v = el.querySelector<HTMLVideoElement>('video')!;
  const sub = el.querySelector<HTMLElement>('.cs-sub')!;
  const unwatch = watchBuffering(v, el);
  playing = { id, cue: '', t: 0 };
  let over = false;
  const timers: number[] = [];
  const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(() => { if (!over) fn(); }, ms)); };

  const close = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    for (const t of timers) clearTimeout(t);
    window.removeEventListener('keydown', onKey, true);
    unwatch();
    el.classList.add('leaving');
    window.setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); el.remove(); }, 450);
    playing = null;
    finish(how);
  };
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); close('skipped'); } };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (ev) => { ev.stopPropagation(); close('skipped'); });

  // The line being said, by the film's own clock.
  let shown = '';
  const tick = () => {
    const t = v.currentTime;
    const c = f.cues.find((x) => x.line !== undefined && t >= x.t0 && t < x.t1);
    const key = c ? c.shot : '';
    if (playing) { playing.t = t; playing.cue = f.cues.find((x) => t >= x.t0 && t < x.t1)?.shot ?? ''; }
    if (key === shown) return;
    shown = key;
    const html = c ? cueHtml(scene, c) : '';
    if (html) { sub.innerHTML = html; sub.classList.add('on'); } else sub.classList.remove('on');
  };
  v.addEventListener('timeupdate', tick);
  v.addEventListener('ended', () => later(500, () => close('ended')));
  v.addEventListener('error', () => close('skipped'));

  v.src = mediaUrl(f.video);
  // Through the voice bus (Settings, ducking); when there is no running sound, the element's own volume.
  if (!routeMedia(v, 'voice')) v.volume = Math.max(0, Math.min(1, gain('voice')));
  const start = () => { void v.play().then(() => el.classList.add('on'), () => { v.muted = true; void v.play().then(() => el.classList.add('on'), () => close('skipped')); }); };
  if (v.readyState >= 3) start();
  else {
    const w = showLoader('scan', { host: el, delay: 0 });
    v.addEventListener('playing', () => w.hide(), { once: true });
    later(9000, () => w.hide());
    let begun = false;
    const once = () => { if (!begun) { begun = true; start(); } };
    v.addEventListener('canplay', once, { once: true });
    later(3000, once);
  }
  // It cannot run for ever: a film that never ends (a stalled network) closes a while after its length.
  later((f.seconds + 20) * 1000, () => close('ended'));
  return { skip: () => close('skipped'), done };
}

// For the beats (tools/shot-cutscenes.mjs).
(window as unknown as { __bfScenes: unknown }).__bfScenes = {
  load: loadScenes,
  films: () => Object.keys(art?.films ?? {}),
  state: () => ({ playing, loaded: !!art }),
};
