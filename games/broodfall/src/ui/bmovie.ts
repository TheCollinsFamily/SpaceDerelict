/**
 * THE FIRST-BOOT FILM AND THE REVEAL (Oct 1 2026). Collins: "create an intro video that plays the first time a user
 * boots up the software ... some sort of 1950 B movie style scene ... from the perspective of people in whatever the
 * starting biome of something coming from the sky ... not revealing the ship and everything until that mission's over".
 *
 * "THE THING FROM THE SKY" (tools/art/bmovie.mjs, notes/BMOVIE-SHOTLIST.md): Night 0 at the Crash Site, told from the
 * town's side only. One 4:3 file holding its whole mix (score, trailer narrator, townsfolk), heard through the game's
 * music channel; the titles are set in type on the film's own clock; from `cardAt` the film is black and the game's
 * name card shows. It replaces the eight-shot opening (src/ui/intro.ts), which stays as its fallback.
 *
 * After mission 1, the REVEAL: the landing films' release shot (the ship fires the asset out of its bay) and the second
 * half of the line, before the ship is seen for the first time.
 */
import { showLoader, watchBuffering, type LoaderHandle } from './loader';
import { audioUnlocked, resumeAudio, routeMedia, sting } from '../audio/engine';
import { loadSettings } from '../meta/storage';
import { GAME_NAME } from './screens';

/** A title the game sets over the film, from `from` to `to` seconds on the film's own clock. */
export interface BmovieTitle { text: string; small?: string; from: number; to: number }
/** public/art/intro/bmovie.json, its paths made whole. */
export interface Bmovie {
  video: string; poster?: string; seconds: number; cardAt: number; titles: BmovieTitle[];
  /** After mission 1: the landing films' release shot, cut short (the ship, seen for the first time). */
  reveal?: { video: string; poster?: string };
}

/** The title showing at `t` seconds into the film, or null (none over the end card). */
export function titleAt(film: Pick<Bmovie, 'titles' | 'cardAt'>, t: number): BmovieTitle | null {
  if (t >= film.cardAt) return null;
  return film.titles.find((x) => t >= x.from && t < x.to) ?? null;
}

/** The end card's words (the same as the eight-shot opening's). */
export const FILM_LAST = 'YOU ARE THE THING THAT FELL.';
/** What the loaders say while the reel arrives: the cinema's side, never the ship's. */
export const PICTURE_LINES = ['Threading the reel.', 'The projector is warming up.', 'Please take your seats.', 'Coming soon to this theatre.'];
/** Mission 1's loading lines (src/ui/screens.ts plain): the town's radio on Night 0, never the Navy's voice. */
export const TOWN_LINES = [
  'Luckwell Gardens Civil Watch: residents are asked to stay indoors.',
  'Reports of a light in the sky over the school.',
  'The laundromat will be closed tomorrow.',
  'Do not approach the crater. Do not touch anything red.',
  'The siren on the corner is only a test.',
];

export interface FilmHandle { skip(): void; done: Promise<'ended' | 'skipped'> }
const say = (k: string, v: string) => { (window as unknown as Record<string, string>)[k] = v; };

/** Play the first-boot film over everything. The BEGIN card, skip keys and buffering loop are the opening's. */
export function playBmovie(film: Bmovie): FilmHandle {
  let finish: (how: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  const el = document.createElement('div');
  el.id = 'intro';
  el.className = 'bmovie';
  el.innerHTML = `<div class="intro-film bm-film">
      <video class="bm-v" playsinline preload="auto"></video>
      <div class="intro-title"><div class="intro-big"></div><div class="intro-small"></div></div>
      <div class="intro-last"><div class="logo-word intro-word">${GAME_NAME.toUpperCase()}</div><div class="intro-tag">${FILM_LAST}</div></div>
      <div class="intro-grain"></div>
    </div>
    <button class="intro-skip" type="button">SKIP ▸ <span>Esc</span></button>
    <div class="intro-begin"><button type="button">▸ BEGIN</button><small>sound on · click or press any key · Esc skips</small></div>`;
  document.body.appendChild(el);
  const v = el.querySelector<HTMLVideoElement>('video')!;
  const title = el.querySelector<HTMLElement>('.intro-title')!;
  const big = el.querySelector<HTMLElement>('.intro-big')!;
  const small = el.querySelector<HTMLElement>('.intro-small')!;
  const last = el.querySelector<HTMLElement>('.intro-last')!;
  if (film.poster) v.poster = film.poster;
  v.src = film.video;
  const stopBuffering = watchBuffering(v, el, 'creep');
  let cover: LoaderHandle | null = null;
  let over = false;
  let raf = 0;
  let shown: BmovieTitle | null = null;
  const timers: number[] = [];

  const end = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    for (const t of timers) window.clearTimeout(t);
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    cover?.hide();
    stopBuffering();
    el.classList.add('leaving');
    // The sound leaves with the picture: a quick fade, then the reel stops.
    const v0 = v.volume;
    for (let i = 1; i <= 5; i++) window.setTimeout(() => { v.volume = Math.max(0, v0 * (1 - i / 5)); }, i * 80);
    window.setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); el.remove(); }, 450);
    say('__bfIntro', how);
    say('__bfIntroFilm', how);
    finish(how);
  };

  /** The titles and the end card, on the film's own clock (a stalled reel holds its title). */
  const tick = () => {
    if (over) return;
    const t = v.currentTime;
    const want = titleAt(film, t);
    if (want !== shown) {
      shown = want;
      if (want) { big.textContent = want.text; small.textContent = want.small ?? ''; title.classList.add('on'); }
      else title.classList.remove('on');
    }
    last.classList.toggle('on', t >= film.cardAt);
    el.dataset.t = t.toFixed(1);
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    say('__bfIntroFilm', 'playing');
    // Heard through the music channel (its volume and the master's); with no sound running, the element's own volume.
    if (!routeMedia(v, 'music')) {
      const s = loadSettings();
      v.volume = Math.max(0, Math.min(1, s.volume.master * s.volume.music));
    }
    v.muted = false;
    cover = showLoader('creep', { label: 'THE PICTURE', host: el, lines: PICTURE_LINES });
    void v.play().catch(() => { v.muted = true; void v.play().catch(() => end('ended')); });
    raf = requestAnimationFrame(tick);
    // Never stuck: a reel that has not finished in twice its length (plus time to arrive) is over.
    timers.push(window.setTimeout(() => end('ended'), (film.seconds * 2 + 20) * 1000));
  };
  v.addEventListener('playing', () => { cover?.hide(); cover = null; });
  v.addEventListener('ended', () => { timers.push(window.setTimeout(() => end('ended'), 300)); });
  v.addEventListener('error', () => end('ended'));

  // Waiting behind the BEGIN card (sound cannot play yet): the first click or key starts the film, heard.
  let waiting = !audioUnlocked();
  const begin = () => {
    if (!waiting || over) return;
    waiting = false;
    el.classList.remove('begin');
    void resumeAudio().then(() => { if (!over) start(); });
  };
  const onKey = (ev: KeyboardEvent) => {
    if (waiting && ev.key !== 'Escape') { ev.preventDefault(); ev.stopPropagation(); begin(); return; }
    if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); end('skipped'); }
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (ev) => {
    if (waiting && !(ev.target as HTMLElement).closest('.intro-skip')) { begin(); return; }
    end('skipped');
  });
  if (waiting) {
    say('__bfIntroFilm', 'begin');
    // A page that may play sound anyway does not wait on the card: the context says so within a moment.
    for (const ms of [100, 300, 600]) timers.push(window.setTimeout(() => { if (waiting && audioUnlocked()) begin(); }, ms));
    timers.push(window.setTimeout(() => { if (waiting) el.classList.add('begin'); }, 650));
  } else start();
  return { skip: () => end('skipped'), done };
}

/** The words over the reveal, in two beats: where we are, then who he is. */
export const REVEAL_WHERE = 'MEANWHILE, HIGH ABOVE LUCKWELL GARDENS';
export const REVEAL_LAST = '…AND YOU ARE THE ONE WHO SENT IT.';

/**
 * THE REVEAL after mission 1. The film ended "YOU ARE THE THING THAT FELL"; mission 1 is fought with nothing on screen
 * that speaks of a ship. Its CONTINUE plays this before the ship opens: the release shot, lifelike and cold after the
 * Technicolor, under the ship's own sting, then the second half of the line. Once (storage `broodfall-reveal-seen`,
 * main.ts); skippable; Reduce motion shows its still instead of the shot.
 */
export function playReveal(film: Bmovie | null | undefined, o: { reduceMotion?: boolean } = {}): FilmHandle {
  let finish: (how: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  const r = film?.reveal;
  if (!r) { finish('ended'); return { skip() {}, done }; }
  const el = document.createElement('div');
  el.id = 'reveal';
  el.innerHTML = `<video class="rv-v" muted playsinline preload="auto"></video>
    <div class="rv-where">${REVEAL_WHERE}</div>
    <div class="rv-card"><div class="intro-tag">${REVEAL_LAST}</div></div>
    <button class="intro-skip" type="button">SKIP ▸ <span>Esc</span></button>`;
  document.body.appendChild(el);
  const v = el.querySelector<HTMLVideoElement>('video')!;
  if (r.poster) v.poster = r.poster;
  let over = false;
  let carded = false;
  const timers: number[] = [];
  const later = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, ms)); };
  const end = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    for (const t of timers) window.clearTimeout(t);
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('leaving');
    window.setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); el.remove(); }, 600);
    say('__bfReveal', how);
    finish(how);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); end('skipped'); }
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', () => end('skipped'));
  const card = () => {
    if (over || carded) return;
    carded = true;
    el.classList.add('carded');
    say('__bfReveal', 'card');
    later(2800, () => end('ended'));
  };
  say('__bfReveal', 'playing');
  sting('sting-desk');
  later(250, () => el.classList.add('where'));
  if (o.reduceMotion) {
    el.classList.add('gentle');
    later(2600, card);
  } else {
    v.src = r.video;
    v.addEventListener('ended', card);
    v.addEventListener('error', card);
    void v.play().catch(card);
    // A shot that never arrives does not hold the ship.
    later(9000, card);
  }
  return { skip: () => end('skipped'), done };
}
