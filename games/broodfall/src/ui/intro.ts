/**
 * THE OPENING CINEMATIC (Collins, Sep 30 2026: "the first time the app is open we play a
 * cinematic and go right into the first game"). Eight generated shots in the look of a 1950s
 * monster film (tools/art/intro.mjs; public/art/intro/), cut together with titles set in TYPE
 * (never lettering inside a picture): a living meteor falls on a small town of insect people and
 * begins to grow. It never speaks of a ship, an empire, a campaign: it is the trailer of the
 * little tower-defence game the player thinks he has downloaded.
 *
 * It plays once, on the first launch, and can be replayed from the menu. A click, Esc, Enter or
 * Space skips it. It is silent: a browser will not play sound on a page nobody has clicked yet,
 * and the first launch is exactly that page.
 */
import { artUrl } from '../render/art';
import { GAME_NAME } from './screens';

export interface IntroShot { id: string; video: string; poster?: string; seconds: number }
/** public/art/intro/intro.json, its paths made whole. */
export interface IntroArt {
  shots: IntroShot[];
  menu?: { video: string; poster?: string; seconds?: number };
  /** His quarters on the ship (a room's picture) and the partner candidate's portrait. */
  quarters?: string;
  partner?: string;
}

let intro: Promise<IntroArt | null> | null = null;
const whole = (f: string | undefined) => (f ? new URL(artUrl(f), document.baseURI).href : undefined);

/** The cinematic's shots and the menu's loop; null when they are not there (everything goes on without them). */
export function loadIntroArt(): Promise<IntroArt | null> {
  intro ??= fetch(artUrl('intro/intro.json'), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: IntroArt | null) => {
      if (!j) return null;
      return {
        shots: (j.shots ?? []).filter((s) => s?.video).map((s) => ({ ...s, video: whole(s.video)!, poster: whole(s.poster), seconds: Number(s.seconds) || 4 })),
        menu: j.menu?.video ? { ...j.menu, video: whole(j.menu.video)!, poster: whole(j.menu.poster) } : undefined,
        quarters: whole(j.quarters),
        partner: whole(j.partner),
      };
    })
    .catch(() => null);
  return intro;
}

/**
 * The titles, a 1950s trailer's. Each is set over its shot from `at` seconds to the shot's end.
 * `small`: a line under it. They tell the town's side only.
 */
export const INTRO_TITLES: Record<string, { text: string; small?: string; at?: number }> = {
  sky: { text: 'IT WAS A QUIET NIGHT', small: 'in a quiet little town', at: 0.5 },
  lookup: { text: 'UNTIL SOMETHING', small: 'came down out of the sky', at: 0.4 },
  crater: { text: 'NOBODY KNEW WHAT IT WAS', at: 0.4 },
  creep: { text: 'IT WAS HUNGRY', at: 0.5 },
  militia: { text: 'THEY FOUGHT IT', small: 'street by street', at: 0.4 },
  rise: { text: 'IT KEPT GROWING', at: 0.3 },
};
/** The last card, over black: the name, and who the player is. */
export const INTRO_LAST = 'YOU ARE THE THING THAT FELL.';

export interface IntroHandle { skip(): void; done: Promise<'ended' | 'skipped'> }

/** Play the cinematic over everything. Resolves when it ends or is skipped; at once when there is nothing to play. */
export function playIntro(art: IntroArt | null): IntroHandle {
  const shots = art?.shots ?? [];
  let finish: (how: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  if (!shots.length) { finish('ended'); return { skip() {}, done }; }

  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `<div class="intro-film">
      <video class="intro-v on" muted playsinline preload="auto"></video>
      <video class="intro-v" muted playsinline preload="auto"></video>
      <div class="intro-title"><div class="intro-big"></div><div class="intro-small"></div></div>
      <div class="intro-last"><div class="logo-word intro-word">${GAME_NAME.toUpperCase()}</div><div class="intro-tag">${INTRO_LAST}</div></div>
      <div class="intro-grain"></div>
    </div>
    <button class="intro-skip" type="button">SKIP ▸ <span>Esc</span></button>`;
  document.body.appendChild(el);
  const layers = [...el.querySelectorAll<HTMLVideoElement>('video')];
  const title = el.querySelector<HTMLElement>('.intro-title')!;
  const big = el.querySelector<HTMLElement>('.intro-big')!;
  const small = el.querySelector<HTMLElement>('.intro-small')!;
  const last = el.querySelector<HTMLElement>('.intro-last')!;
  let top = 0;
  let i = -1;
  let over = false;
  const timers: number[] = [];
  const later = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, ms)); };

  const end = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    for (const t of timers) window.clearTimeout(t);
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('leaving');
    window.setTimeout(() => { for (const v of layers) { v.pause(); v.removeAttribute('src'); v.load(); } el.remove(); }, 450);
    (window as unknown as { __bfIntro?: string }).__bfIntro = how;
    finish(how);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); end('skipped'); }
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', () => end('skipped'));

  /** The next shot into the layer that is not showing, so that the cut is a short dissolve and never a black frame. */
  const load = (n: number, v: HTMLVideoElement) => {
    const s = shots[n];
    if (!s) return;
    if (v.dataset.shot !== s.id) { v.src = s.video; if (s.poster) v.poster = s.poster; v.dataset.shot = s.id; v.load(); }
  };
  const next = () => {
    if (over) return;
    i++;
    if (i >= shots.length) { lastCard(); return; }
    const s = shots[i];
    const v = layers[1 - top];
    load(i, v);
    try { v.currentTime = 0; } catch { /* not loaded: it starts at 0 */ }
    const up = () => {
      v.classList.add('on');
      layers[top].classList.remove('on');
      top = 1 - top;
      // The shot after this one loads into the layer just left.
      later(500, () => load(i + 1, layers[1 - top]));
    };
    void v.play().then(up, up);
    el.dataset.shot = s.id;
    // Its title, if it has one.
    const t = INTRO_TITLES[s.id];
    title.classList.remove('on');
    if (t) {
      later((t.at ?? 0.5) * 1000, () => { big.textContent = t.text; small.textContent = t.small ?? ''; title.classList.add('on'); });
      later(Math.max(1200, (s.seconds - 0.45) * 1000), () => title.classList.remove('on'));
    }
    // The next cut comes on the clock, not on `ended`: a clip that stalls must not hold the film.
    later(Math.max(1500, (s.seconds - 0.25) * 1000), next);
  };
  const lastCard = () => {
    title.classList.remove('on');
    for (const v of layers) v.classList.remove('on');
    last.classList.add('on');
    el.dataset.shot = 'last';
    later(3600, () => end('ended'));
  };
  load(0, layers[1]);
  next();
  return { skip: () => end('skipped'), done };
}
