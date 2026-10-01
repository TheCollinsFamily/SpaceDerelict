/**
 * THE LANDING FILM (Oct 1 2026). Collins: "for loading into the different biomes, do we have broodfall landing
 * animations to make it seem cohesive that would play at the start of any scenario? if not we should."
 *
 * Before a deployment, the tile set's film (tools/art/landing.mjs; public/art/landing/): the Empire's ship lets the
 * asset go, it falls through that set's sky onto that set's city, and the dust clears on the board itself, from the
 * board's own camera. Its last frame IS the board at minute zero, so at the end the film's picture is moved onto the
 * live board (the band of the canvas it shows, its crater laid on the live meteor) and let go: the cut is the
 * board coming alive under it. The rules (when it plays) are src/meta/landing.ts.
 *
 * It is the cover while the board loads: `done` resolves once the film has played (or been skipped) AND the board
 * says it is ready; a film that ends first holds its last frame with a small loop in the corner. Before its first
 * frame is here: the loaders' cover (src/ui/loader.ts). Click, Esc, Enter or Space skips. Its sound is the game's
 * (src/audio/engine.ts): the fall's roar and the strike. The strike's white flash is drawn here (not in the film),
 * so Reduce flashes takes it out; Reduce motion plays a gentle version: the last frame fades in, holds, fades out.
 */
import './landing.css';
import { artUrl } from '../render/art';
import { sfx } from '../audio/engine';
import { coverBox, filmBoxOnBoard, type LandingArt, type LandingFilm, type Pt, type Rect } from '../meta/landing';
import { showLoader, watchBuffering, type LoaderHandle } from './loader';

let art: Promise<LandingArt | null> | null = null;
const whole = (f: string | undefined) => (f ? new URL(artUrl(f), document.baseURI).href : undefined);

/** public/art/landing/landing.json, its paths made whole; null when it is not there (a run starts without a film). */
export function loadLandingArt(): Promise<LandingArt | null> {
  art ??= fetch(artUrl('landing/landing.json'), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: LandingArt | null) => {
      if (!j?.films) return null;
      const films: Record<string, LandingFilm> = {};
      for (const [id, f] of Object.entries(j.films)) {
        if (f?.video) films[id] = { ...f, set: id, video: whole(f.video)!, end: whole(f.end)!, start: whole(f.start) };
      }
      return { ...j, films };
    })
    .catch(() => null);
  return art;
}

export interface LandingBoard {
  /** The board's canvas on the screen, and the live meteor on that canvas (canvas pixels); null while not ready. */
  canvas: Rect;
  core: Pt | null;
}
export interface LandingOpts {
  /** The board, once it is drawn and the run can start; null until then. */
  board: () => LandingBoard | null;
  reduceMotion?: boolean;
  reduceFlashes?: boolean;
}
export interface LandingHandle { skip(): void; done: Promise<'ended' | 'skipped'> }

type Phase = 'loading' | 'playing' | 'holding' | 'handoff' | 'done';
interface LandingState { set: string; phase: Phase; how?: 'ended' | 'skipped'; roar: boolean; strike: boolean; reduced: boolean; heldMs: number }
const report = (s: LandingState) => { (window as unknown as { __bfLanding?: LandingState }).__bfLanding = s; };

const place = (el: HTMLElement, r: Rect) => {
  el.style.left = `${r.left}px`; el.style.top = `${r.top}px`; el.style.width = `${r.width}px`; el.style.height = `${r.height}px`;
};

/** Play a set's landing film over everything; resolves when the board is showing and the run may start. */
export function playLanding(film: LandingFilm, land: LandingArt, o: LandingOpts): LandingHandle {
  let finish: (how: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  const state: LandingState = { set: film.set, phase: 'loading', roar: false, strike: false, reduced: !!o.reduceMotion, heldMs: 0 };
  report(state);

  const el = document.createElement('div');
  el.id = 'landing';
  el.dataset.set = film.set;
  el.innerHTML = `<div class="ld-pic"><video class="ld-v" muted playsinline preload="auto"></video><img class="ld-end" alt=""></div>
    <div class="ld-flash"></div>
    <button class="ld-skip" type="button">SKIP ▸ <span>Esc</span></button>`;
  document.body.appendChild(el);
  const pic = el.querySelector<HTMLElement>('.ld-pic')!;
  const v = el.querySelector<HTMLVideoElement>('video')!;
  const endImg = el.querySelector<HTMLImageElement>('.ld-end')!;
  const flash = el.querySelector<HTMLElement>('.ld-flash')!;
  endImg.src = film.end;
  const aspect = land.band.w / land.band.h;
  const fit = () => { if (state.phase !== 'handoff' && state.phase !== 'done') place(pic, coverBox(window.innerWidth, window.innerHeight, aspect)); };
  fit();
  window.addEventListener('resize', fit);

  let how: 'ended' | 'skipped' = 'ended';
  let cover: LoaderHandle | null = null;
  let corner: LoaderHandle | null = null;
  let stopBuffering: () => void = () => {};
  const timers: number[] = [];
  let raf = 0;

  const cleanup = () => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', fit);
    for (const t of timers) window.clearTimeout(t);
    cancelAnimationFrame(raf);
    cover?.hide(); corner?.hide(); stopBuffering();
  };

  /** The board under the film's last frame: the picture moves onto it and fades; the run starts as it fades. */
  const handoff = (b: LandingBoard) => {
    if (state.phase === 'handoff' || state.phase === 'done') return;
    state.phase = 'handoff';
    report(state);
    corner?.hide();
    const target = filmBoxOnBoard(b.canvas, land, film, b.core);
    const gentle = !!o.reduceMotion;
    const move = gentle || how === 'skipped' ? 0 : 700;
    el.classList.add('handing');
    if (!gentle) {
      pic.style.transition = `left ${move}ms ease-in-out, top ${move}ms ease-in-out, width ${move}ms ease-in-out, height ${move}ms ease-in-out, opacity 0.6s linear`;
      place(pic, target);
    }
    timers.push(window.setTimeout(() => {
      el.classList.add('leaving');
      cleanup();
      finish(how);
      timers.push(window.setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); el.remove(); state.phase = 'done'; report(state); }, 700));
    }, move));
  };

  /** The film is over (or skipped): its last frame holds until the board is ready. */
  const holdStart = { t: 0 };
  const hold = () => {
    if (state.phase === 'holding' || state.phase === 'handoff' || state.phase === 'done') return;
    state.phase = 'holding';
    report(state);
    cover?.hide();
    stopBuffering();
    v.pause();
    el.classList.add('held');
    holdStart.t = performance.now();
    const poll = () => {
      const b = o.board();
      if (b) { state.heldMs = Math.round(performance.now() - holdStart.t); handoff(b); return; }
      // The board still loading: a small loop over the held frame (shown only after 400 ms).
      corner ??= showLoader('creep', { host: el, corner: true });
      timers.push(window.setTimeout(poll, 100));
    };
    poll();
  };

  const end = (h: 'ended' | 'skipped') => {
    if (state.phase === 'holding' || state.phase === 'handoff' || state.phase === 'done') return;
    how = h;
    state.how = h;
    hold();
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); end('skipped'); }
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', () => end('skipped'));

  if (o.reduceMotion) {
    // The gentle version: the last frame fades in, holds a moment, and the board takes over.
    el.classList.add('gentle');
    v.remove();
    state.phase = 'playing';
    report(state);
    timers.push(window.setTimeout(() => end('ended'), 1600));
    return { skip: () => end('skipped'), done };
  }

  // The sound and the flash, on the film's own clock.
  const tick = () => {
    if (state.phase !== 'playing') return;
    const t = v.currentTime;
    if (!state.roar && t >= film.fallAt) { state.roar = true; sfx('land-roar'); report(state); }
    if (!state.strike && t >= film.strikeAt) {
      state.strike = true;
      sfx('land-impact');
      if (!o.reduceFlashes) { flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); }
      report(state);
    }
    raf = requestAnimationFrame(tick);
  };
  // Before its first frame: the loaders' cover (nothing shows for a wait under 400 ms).
  cover = showLoader('creep', { label: 'THE LANDING', host: el });
  v.addEventListener('playing', () => {
    cover?.hide();
    if (state.phase === 'loading') { state.phase = 'playing'; report(state); el.classList.add('rolling'); raf = requestAnimationFrame(tick); }
  });
  v.addEventListener('ended', () => end('ended'));
  // A film that cannot be played at all (a missing file, a codec) is skipped to its last frame.
  v.addEventListener('error', () => end('ended'));
  stopBuffering = watchBuffering(v, el, 'creep');
  if (film.start) v.poster = film.start;
  v.src = film.video;
  void v.play().catch(() => { /* muted films may play; if not, the error/stall path holds the last frame */ });
  // Never stuck: a film that has not moved in its own length and a half is over.
  timers.push(window.setTimeout(() => { if (state.phase === 'loading') end('ended'); }, Math.max(8000, film.seconds * 1500)));
  return { skip: () => end('skipped'), done };
}
