/**
 * YOKE'S TRANSLATION, SEEN (Oct 1 2026; content/translation.ts holds the channels and her notes).
 * A leader's words reach him rendered by her, and the screens say so:
 *  - `bandHtml`: a band on the card naming the source signal and her confidence;
 *  - `lineHtml`: a translated line, its words in `.tl-words` (so they can resolve from glyphs) and her
 *    note under it when she has one;
 *  - `decode`: the line being said resolves from its channel's glyphs into words, left to right, in
 *    under half a second. Reduce motion (Settings, or the system's): it is simply there.
 * His own lines ("You: …") are not translated and are drawn as before.
 */
import './translation.css';
import { CHANNELS, cardConfidence, channelOfLine, confidenceOf, noteFor, type Channel } from '../../content/translation';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The band on a card: where the words came from and how sure she is of them. `lines`: the card's lines. */
export function bandHtml(ch: Channel, lines: string[]): string {
  const c = CHANNELS[ch];
  return `<div class="tl-band" data-tl="${ch}"><span class="tl-sig" aria-hidden="true"></span>`
    + `<span class="tl-src">SOURCE: ${esc(c.source)}</span><span class="tl-by">RENDERED BY YOKE · CONFIDENCE ${cardConfidence(lines, ch)}%</span></div>`;
}

/** One line on a card: the speaker in bold, the words in `.tl-words` when she rendered them, her note under it. */
export function lineHtml(line: string): string {
  const i = line.indexOf(':');
  if (i <= 0) return esc(line);
  const who = `<b>${esc(line.slice(0, i))}:</b>`;
  const ch = channelOfLine(line);
  if (!ch) return `${who}${esc(line.slice(i + 1))}`;
  const note = noteFor(line);
  return `${who}<span class="tl-words" data-tl="${ch}" title="Rendered by YOKE · confidence ${confidenceOf(line, ch)}%">${esc(line.slice(i + 1))}</span>`
    + (note ? `<span class="tl-note">[${note.startsWith('untranslatable') ? '' : 'YOKE: '}${esc(note)}]</span>` : '');
}

const reduced = (): boolean =>
  document.documentElement.classList.contains('reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const running = new WeakMap<HTMLElement, number>();

/** The words of `el` (a line holding `.tl-words`) resolve from the channel's glyphs, left to right. */
export function decode(el: Element | null | undefined, ms = 450): void {
  const w = el?.querySelector<HTMLElement>('.tl-words');
  if (!w || reduced() || running.has(w)) return;
  const text = w.textContent ?? '';
  const glyphs = CHANNELS[(w.dataset.tl as Channel) ?? 'delegation']?.glyphs ?? '▒';
  const t0 = performance.now();
  w.classList.add('tl-decoding');
  const frame = (now: number) => {
    if (!w.isConnected) { running.delete(w); return; }
    const p = Math.min(1, (now - t0) / ms);
    if (p >= 1) { w.textContent = text; w.classList.remove('tl-decoding'); running.delete(w); return; }
    const upto = Math.floor(p * text.length);
    let out = text.slice(0, upto);
    for (let i = upto; i < text.length; i++) out += text[i] === ' ' ? ' ' : glyphs[(i * 7 + Math.floor(now / 60)) % glyphs.length];
    w.textContent = out;
    running.set(w, requestAnimationFrame(frame));
  };
  running.set(w, requestAnimationFrame(frame));
}

/** For the beats (tools/shot-translation.mjs). */
(window as unknown as { __bfTl: unknown }).__bfTl = { decode };
