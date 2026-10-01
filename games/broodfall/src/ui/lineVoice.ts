/**
 * A LEADER'S LOOSE LINE, HEARD (Oct 1 2026; content/media.ts lineKey, tools/media/make.ts voices).
 * The asides (the Delegate's letters spelled out in a field, the Voice's broadcasts and his homework
 * on the air, the Director's calls mid-match) and any leader line outside a scene card are voiced in
 * the leader's own voice. The words stay on the page: the line being said is lit (`said-now`).
 *
 * campaignUi marks such a line `data-say="<lineKey>"`; a ▶ button inside it plays or stops it. On the
 * post-deployment report the ally's aside also carries `data-autoplay` and plays by itself once. A click
 * on the line (or Esc, or leaving the screen) stops it. Voices off in Settings (or a voiceless build,
 * or the media held back under automation): the button is not shown and nothing plays.
 */
import type { Channel } from '../../content/translation';
import { duckFor, routeMedia, SIGNAL_LEAD_MS, translateIn } from '../audio/engine';
import { gain } from '../meta/storage';
import { loadMedia, mediaAllowed, mediaNow, mediaUrl } from './newsreel';
import { decode } from './translation';

interface Now { key: string; audio: HTMLAudioElement; timer: number }
let now: Now | null = null;
let root: HTMLElement | null = null;
/** Autoplayed once: the key and the element it was on (a redraw of the same report does not start it again). */
const autoplayed = new WeakSet<HTMLElement>();

const lineEl = (key: string) => root?.querySelector<HTMLElement>(`[data-say="${CSS.escape(key)}"]`) ?? null;

function light(): void {
  root?.querySelectorAll<HTMLElement>('[data-say]').forEach((el) => {
    const on = !!now && el.dataset.say === now.key;
    el.classList.toggle('said-now', on);
    const b = el.querySelector<HTMLElement>('.say-btn');
    if (b) { b.textContent = on ? '■' : '▶'; b.title = on ? 'Stop' : 'Hear it'; }
  });
}

export function stopLine(): void {
  if (!now) return;
  const a = now.audio;
  clearTimeout(now.timer);
  now = null;
  a.pause();
  light();
}

/** Play one loose line by its key; false when it has no voice (or voices are off). */
export function playLine(key: string): boolean {
  stopLine();
  const v = mediaNow()?.voices[key];
  if (!v || gain('voice') <= 0) return false;
  const a = new Audio(mediaUrl(v.file));
  if (!routeMedia(a, 'voice')) a.volume = Math.min(1, gain('voice'));
  const n: Now = { key, audio: a, timer: 0 };
  now = n;
  duckFor(a, 'leader');
  const end = () => { if (now === n) { now = null; light(); } };
  a.onended = end;
  a.onerror = end;
  // YOKE's rendering (src/ui/translation.ts): the words resolve from their signal, which is heard first.
  const el = lineEl(key);
  const ch = el?.querySelector<HTMLElement>('.tl-words')?.dataset.tl as Channel | undefined;
  decode(el);
  if (ch && translateIn(a, ch)) n.timer = window.setTimeout(() => { if (now === n) void a.play().catch(end); }, SIGNAL_LEAD_MS);
  else void a.play().catch(end);
  light();
  return true;
}

/** Esc while a line is said stops the line and nothing else (not Settings, not the screen under it). */
function onKey(e: KeyboardEvent): void { if (e.key === 'Escape' && now) { e.stopImmediatePropagation(); e.preventDefault(); stopLine(); } }

/** After every drawing of a screen that may hold loose lines (the ship, the report): buttons, autoplay, the lit line. */
export function attachLines(el: HTMLElement | null): void {
  root = el;
  if (!el || el.classList.contains('hidden')) { stopLine(); return; }
  // What was playing is gone from the screen (another room): stop it.
  if (now && !lineEl(now.key)) stopLine();
  // A scene card is up and says its own lines (src/ui/sceneVoice.ts): no loose line over it.
  if (el.querySelector('.cp-scene-card[data-faction]')) { stopLine(); return; }
  if (!mediaAllowed()) return;
  void loadMedia().then((art) => {
    if (root !== el || !art) return;
    const voiced = gain('voice') > 0;
    for (const p of el.querySelectorAll<HTMLElement>('[data-say]')) {
      const key = p.dataset.say!;
      if (!voiced || !art.voices[key] || p.querySelector('.say-btn')) continue;
      const b = document.createElement('button');
      b.className = 'say-btn';
      b.type = 'button';
      b.textContent = '▶';
      b.title = 'Hear it';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); if (now?.key === key) stopLine(); else playLine(key); });
      p.prepend(b);
      // A click on the line itself while it is said: skip it.
      p.addEventListener('click', () => { if (now?.key === key) stopLine(); });
      if (p.hasAttribute('data-autoplay') && !autoplayed.has(p)) { autoplayed.add(p); playLine(key); }
    }
    light();
  });
}

window.addEventListener('keydown', onKey, { capture: true });

// For the beats (tools/shot-asides.mjs): what is being said.
(window as unknown as { __bfLine: unknown }).__bfLine = { now: () => (now ? { key: now.key, paused: now.audio.paused, t: now.audio.currentTime } : null) };
