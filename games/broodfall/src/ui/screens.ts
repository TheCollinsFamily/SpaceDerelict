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
import { LOADER_DELAY_MS, LOADING_LINES, loopEl } from './loader';

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

/**
 * The loading screen while the board's art arrives (Oct 1 2026: never a still screen). The emblem is its LOOP
 * (the meteor burning in its ring, src/ui/loader.ts), the creep crawls dimly behind it, the bar is the real file
 * count, the lines are the Navy's procurement voice. `cover`: the page under it is empty (a fresh page that is
 * starting a deployment), so its dark goes up at once; otherwise (over the menu) nothing shows for the first
 * 400 ms, and a load that is done by then never flashes a screen. The card and its loop come in after 400 ms.
 */
export class LoadingScreen {
  private el: HTMLElement;
  private bar: HTMLElement;
  private count: HTMLElement;
  private line: HTMLElement;
  private timer = 0;
  private delay = 0;
  private shownAt = 0;
  private visible = false;
  open = false;

  constructor() {
    this.el = document.getElementById('boot')!;
    this.bar = this.el.querySelector('.boot-fill')!;
    this.count = this.el.querySelector('.boot-count')!;
    this.line = this.el.querySelector('.boot-line')!;
    // The full loops in place of the markup's first paint (index.html, preloaded): the emblem's, the creep's behind it.
    const back = this.el.querySelector('.boot-backdrop');
    const loopBack = loopEl('creep', { cover: true, cls: 'boot-backdrop' });
    if (back) back.replaceWith(loopBack); else this.el.prepend(loopBack);
    const logo = this.el.querySelector<HTMLElement>('.logo-boot');
    const emblem = logo?.querySelector<HTMLElement>('.logo-emblem');
    if (logo && emblem && !emblem.querySelector('video')) {
      emblem.replaceWith(loopEl('emblem', { cls: 'logo-emblem' }));
      logo.classList.add('has-emblem');
    }
    // Already up (index.html put it up before this code arrived, for a page that starts a deployment): it is ours now.
    if (this.el.dataset.early && !this.el.classList.contains('hidden')) {
      delete this.el.dataset.early;
      this.open = true;
      this.visible = true;
      this.shownAt = performance.now();
      this.rotate();
    }
  }

  /** The Navy's lines, one every 2.2 s. */
  private rotate(): void {
    let i = Math.floor(Math.random() * LOADING_LINES.length);
    this.line.textContent = LOADING_LINES[i];
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => { i = (i + 1) % LOADING_LINES.length; this.line.textContent = LOADING_LINES[i]; }, 2200);
  }

  show(what = 'THE BOARD', opts: { cover?: boolean } = {}): void {
    (this.el.querySelector('.boot-what') as HTMLElement).textContent = what;
    if (this.open) return;
    this.open = true;
    this.rotate();
    const up = () => {
      if (!this.open) return;
      this.visible = true;
      this.shownAt = performance.now();
      this.el.dataset.loading = 'emblem';
      this.el.classList.remove('hidden', 'leaving');
      for (const v of this.el.querySelectorAll('video')) if (v.paused) void v.play().catch(() => {});
    };
    window.clearTimeout(this.delay);
    this.el.classList.remove('card-on');
    if (opts.cover) up(); else this.delay = window.setTimeout(up, LOADER_DELAY_MS);
    window.setTimeout(() => { if (this.open) this.el.classList.add('card-on'); }, LOADER_DELAY_MS);
  }

  progress(done: number, total: number): void {
    const k = total > 0 ? Math.min(1, done / total) : 0;
    this.bar.style.width = `${(k * 100).toFixed(1)}%`;
    this.count.textContent = total > 0 ? `${done} / ${total} FILES` : '';
  }

  /** Fade out. Once seen, it stays up at least a moment, so that it is a screen and not a flicker. */
  hide(): void {
    if (!this.open) return;
    this.open = false;
    window.clearInterval(this.timer);
    window.clearTimeout(this.delay);
    if (!this.visible) return;
    this.visible = false;
    const wait = Math.max(0, 350 - (performance.now() - this.shownAt));
    window.setTimeout(() => {
      this.el.classList.add('leaving');
      delete this.el.dataset.loading;
      window.setTimeout(() => {
        if (this.open) return;
        this.el.classList.add('hidden');
        this.el.classList.remove('card-on');
        for (const v of this.el.querySelectorAll('video')) v.pause();
      }, 400);
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

/** A line at the top of the board, not a screen: something is missing, the game goes on. */
function notice(html: string, title = ''): void {
  const el = document.getElementById('art-notice');
  if (!el) return;
  // One line per thing said; the buttons once, after the first.
  if (el.classList.contains('hidden') || !el.querySelector('.an-lines')) {
    el.innerHTML = '<div class="an-lines"></div><div class="an-btns"><button data-act="retry">RELOAD</button><button data-act="close" title="Close">✕</button></div>';
    el.title = '';
    el.querySelector('[data-act="retry"]')!.addEventListener('click', () => location.reload());
    el.querySelector('[data-act="close"]')!.addEventListener('click', () => el.classList.add('hidden'));
  }
  const line = document.createElement('div');
  line.innerHTML = html;
  el.querySelector('.an-lines')!.appendChild(line);
  if (title) el.title = el.title ? `${el.title}, ${title}` : title;
  el.classList.remove('hidden');
  // It is said once; it does not stay over the game.
  window.setTimeout(() => el.classList.add('hidden'), 14000);
}

/** Some pictures failed, the rest is there. */
export function showArtNotice(failed: string[]): void {
  if (!failed.length) return;
  notice(`<b>${failed.length} PICTURE${failed.length > 1 ? 'S' : ''} DID NOT LOAD</b> — drawn as plain marks instead.`, failed.join(', '));
}

/** No WebGL, but the board could be drawn without it (slowly): say so, and how to mend it. */
export function showSlowDrawingNotice(): void {
  notice('<b>DRAWING WITHOUT WEBGL</b> — the board will be slow. Turn on hardware acceleration in the browser’s settings and reload.');
}
