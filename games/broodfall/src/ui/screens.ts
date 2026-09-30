/**
 * The screens around the board (Sep 30 2026): the game's name set in type, the loading screen
 * while the art arrives, and the error screens when it cannot (no art, no WebGL, a crash while
 * starting).
 *
 * THE NAME IS A WORKING TITLE. It is set here, once, and written into every element marked
 * `data-game-name` and into the page title; the emblem around it is a picture with no
 * lettering (tools/art/templates/screens.mjs). Renaming the game is this one line (and the
 * fallback text in index.html, seen only before the script runs).
 */
import { artUrl, loadManifest } from '../render/art';

export const GAME_NAME = 'Broodfall';

/** The screens' pictures, from the manifest (ship.screens), as absolute URLs; empty when there are none. */
export interface ScreenArt { emblem?: string; title?: string; won?: string; lost?: string; held?: string }

let screenArt: Promise<ScreenArt> | null = null;
export function loadScreenArt(): Promise<ScreenArt> {
  screenArt ??= loadManifest().then((m) => {
    const entry = (m?.ship as Record<string, unknown> | undefined)?.screens as Record<string, string> | undefined;
    const out: ScreenArt = {};
    for (const [k, f] of Object.entries(entry ?? {})) (out as Record<string, string>)[k] = new URL(artUrl(f), document.baseURI).href;
    return out;
  });
  return screenArt;
}

/** The name into the page: every `[data-game-name]` and the tab's title. */
export function applyName(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-game-name]')) el.textContent = GAME_NAME.toUpperCase();
  document.title = `${GAME_NAME.toUpperCase()} — Field Operations Console`;
}

/** The emblem behind every logo on the page, once its picture is known. */
export function dressLogos(art: ScreenArt): void {
  if (!art.emblem) return;
  for (const el of document.querySelectorAll<HTMLElement>('.logo')) {
    el.style.setProperty('--emblem', `url("${art.emblem}")`);
    el.classList.add('has-emblem');
  }
}

/** The logo: the emblem, and the name over it in type. */
export function logoHtml(extra = ''): string {
  return `<div class="logo ${extra}"><div class="logo-emblem" aria-hidden="true"></div>`
    + `<div class="logo-word" data-game-name>${GAME_NAME.toUpperCase()}</div></div>`;
}

// ------------------------------------------------------------------ loading

/** What the loading screen says while the art arrives: the Navy's own procurement voice. */
const LOADING_LINES = [
  'Thawing the culture.',
  'Counting the insects. Estimate revised upward.',
  'Filing Form XC-4 (Release of Biological Asset Into Civilian Area).',
  'Calibrating the drop. Apologising to no one.',
  'Warming the meteor.',
  'Checking the asset for signs of sentiment. None found.',
  'Requisitioning a planet.',
];

export class LoadingScreen {
  private el: HTMLElement;
  private bar: HTMLElement;
  private count: HTMLElement;
  private line: HTMLElement;
  private timer = 0;
  private shownAt = 0;
  open = false;

  constructor() {
    this.el = document.getElementById('boot')!;
    this.bar = this.el.querySelector('.boot-fill')!;
    this.count = this.el.querySelector('.boot-count')!;
    this.line = this.el.querySelector('.boot-line')!;
  }

  show(what = 'THE BOARD'): void {
    if (this.open) return;
    this.open = true;
    this.shownAt = performance.now();
    (this.el.querySelector('.boot-what') as HTMLElement).textContent = what;
    this.el.classList.remove('hidden', 'leaving');
    let i = Math.floor(Math.random() * LOADING_LINES.length);
    this.line.textContent = LOADING_LINES[i];
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => { i = (i + 1) % LOADING_LINES.length; this.line.textContent = LOADING_LINES[i]; }, 2200);
  }

  progress(done: number, total: number): void {
    const k = total > 0 ? Math.min(1, done / total) : 0;
    this.bar.style.width = `${(k * 100).toFixed(1)}%`;
    this.count.textContent = total > 0 ? `${done} / ${total} FILES` : '';
  }

  /** Fade out. It stays up at least a moment, so that it is a screen and not a flicker. */
  hide(): void {
    if (!this.open) return;
    this.open = false;
    window.clearInterval(this.timer);
    const wait = Math.max(0, 350 - (performance.now() - this.shownAt));
    window.setTimeout(() => {
      this.el.classList.add('leaving');
      window.setTimeout(() => { if (!this.open) this.el.classList.add('hidden'); }, 400);
    }, wait);
  }
}

// ------------------------------------------------------------------ errors

export type Failure =
  | { kind: 'no-art'; detail: string }
  | { kind: 'no-webgl'; detail: string }
  | { kind: 'crash'; detail: string };

const FAILURES: Record<Failure['kind'], { kicker: string; title: string; body: string; fix: string }> = {
  'no-art': {
    kicker: 'FIELD OPERATIONS CONSOLE — FAULT REPORT XC-9',
    title: 'THE PICTURES DID NOT ARRIVE',
    body: 'The console could not load the board\'s art. The deployment can still go ahead with the old plotting display: every limb, unit and street is drawn as a plain mark.',
    fix: 'Check the connection and try again. Started from the launcher, the art is in public/art/ in the game folder.',
  },
  'no-webgl': {
    kicker: 'FIELD OPERATIONS CONSOLE — FAULT REPORT XC-10',
    title: 'THIS BROWSER CANNOT DRAW THE BOARD',
    body: 'The board is drawn with WebGL, and this browser did not give the console a WebGL canvas. Nothing can be deployed until it does.',
    fix: 'Turn on hardware acceleration (Chrome and Edge: Settings → System → "Use graphics acceleration when available"), restart the browser, and try again. Updating the graphics driver helps when it is already on.',
  },
  crash: {
    kicker: 'FIELD OPERATIONS CONSOLE — FAULT REPORT XC-0',
    title: 'THE CONSOLE FAILED WHILE STARTING',
    body: 'Something broke before the deployment could begin. Your campaign is saved; nothing was lost.',
    fix: 'Try again. If it keeps happening, the text below is what went wrong.',
  },
};

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * A fault screen over everything. `onContinue`: the way on without what failed (only when
 * there is one: playing without the art is possible, without WebGL it is not).
 */
export function showFailure(f: Failure, onContinue?: () => void): void {
  const el = document.getElementById('fault')!;
  const t = FAILURES[f.kind];
  el.dataset.kind = f.kind;
  el.innerHTML = `<div class="fault-card">
    ${logoHtml('logo-small')}
    <div class="screen-kicker">${t.kicker}</div>
    <div class="fault-title">${t.title}</div>
    <p>${t.body}</p>
    <p class="fault-fix">${t.fix}</p>
    ${f.detail ? `<pre class="fault-detail">${esc(f.detail)}</pre>` : ''}
    <div class="menu-btns">
      <button class="screen-btn" data-act="retry">TRY AGAIN</button>
      ${onContinue ? '<button class="screen-btn alt" data-act="continue">PLAY WITHOUT THE PICTURES</button>' : ''}
    </div></div>`;
  void loadScreenArt().then(dressLogos);
  el.classList.remove('hidden');
  el.querySelector('[data-act="retry"]')!.addEventListener('click', () => location.reload());
  el.querySelector('[data-act="continue"]')?.addEventListener('click', () => {
    el.classList.add('hidden');
    onContinue!();
  });
}

/** Some pictures failed, the rest is there: a line at the top of the board, not a screen. */
export function showArtNotice(failed: string[]): void {
  const el = document.getElementById('art-notice');
  if (!el || !failed.length) return;
  el.innerHTML = `<b>${failed.length} PICTURE${failed.length > 1 ? 'S' : ''} DID NOT LOAD</b> — drawn as plain marks instead.`
    + ' <button data-act="retry">RELOAD</button><button data-act="close" title="Close">✕</button>';
  el.title = failed.join('\n');
  el.classList.remove('hidden');
  el.querySelector('[data-act="retry"]')!.addEventListener('click', () => location.reload());
  el.querySelector('[data-act="close"]')!.addEventListener('click', () => el.classList.add('hidden'));
  // It is said once; it does not stay over the game.
  window.setTimeout(() => el.classList.add('hidden'), 14000);
}
