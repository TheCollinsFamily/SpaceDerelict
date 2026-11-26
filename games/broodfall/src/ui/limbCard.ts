/**
 * The limb STAT CARD on hover (src/ui/limbStats.ts holds the words): one floating panel, reused for a limb on the
 * board and for a card in the hand. It writes its markup only when the card's content changes (cardKey), and moves
 * with two style writes, so hovering costs nothing per frame. It never takes the pointer (pointer-events: none).
 */
import type { StatCard, StatRow } from './limbStats';
import { cardKey } from './limbStats';

let el: HTMLDivElement | null = null;
let lastKey = '';
/** The box's size after its last render (read once per content change, not per pointer move). */
let size = { w: 0, h: 0 };

/**
 * The text size (Settings), which zooms this card (src/ui/settings.css). A zoomed box's left and top count in its own
 * zoomed px (left 100px lands at 130 at 1.3), and offsetWidth is its size before the zoom: so the card's size on the
 * screen is size x k, and its left and top are the screen position / k.
 */
export function uiScale(): number {
  return Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
}
/** What it is showing: a board limb (its id), a hand family, or nothing. */
let showing: { kind: 'limb'; id: number } | { kind: 'hand'; family: string } | null = null;

function box(): HTMLDivElement {
  if (el && el.isConnected) return el;
  el = document.createElement('div');
  el.id = 'limb-card';
  el.className = 'hidden';
  document.body.appendChild(el);
  return el;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const MAX_SOURCES = 3;

function rowHtml(r: StatRow): string {
  const srcs = r.sources.slice(0, MAX_SOURCES).map((s) => `<li>${esc(s)}</li>`).join('')
    + (r.sources.length > MAX_SOURCES ? `<li>and ${r.sources.length - MAX_SOURCES} more</li>` : '');
  return `<div class="lc-row${r.trend ? ` ${r.trend}` : ''}" data-k="${r.key}"><div class="lc-line"><span class="lc-label">${esc(r.label)}</span>`
    + `<span class="lc-val">${esc(r.value)}${r.base !== undefined ? `<i class="lc-base">base ${esc(r.base)}</i>` : ''}</span></div>`
    + `<div class="lc-ex">${esc(r.explain)}</div>${srcs ? `<ul class="lc-src">${srcs}</ul>` : ''}</div>`;
}

function render(c: StatCard, foot: string, banner: string): void {
  const key = cardKey(c) + foot + banner;
  if (key === lastKey) return;
  lastKey = key;
  const b = box();
  b.classList.remove('hidden');
  b.innerHTML = (banner ? `<div class="lc-banner">${esc(banner)}</div>` : '')
    + `<div class="lc-head"><span class="lc-name">${esc(c.name)}</span><span class="lc-tag">${esc(c.tag)}</span></div>`
    + `<div class="lc-role">${esc(c.role)}</div>`
    + c.rows.map(rowHtml).join('')
    + (c.verbs.length ? `<div class="lc-sub">SPECIAL</div>${c.verbs.map(rowHtml).join('')}` : '')
    + c.notes.map((n) => `<div class="lc-note">${esc(n)}</div>`).join('')
    + (foot ? `<div class="lc-foot">${esc(foot)}</div>` : '');
  size = { w: b.offsetWidth, h: b.offsetHeight };
}

const GAP = 14;

/** Keep the box inside the window. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Show a board limb's card beside it. `anchor` is the limb's on-screen box (client px): the card goes to its right,
 * or its left if the right has no room, so it never covers the limb; vertically it sits by the pointer, on screen.
 */
export function showLimbCard(id: number, c: StatCard, anchor: { left: number; top: number; right: number; bottom: number }, pointerY: number, banner = ''): void {
  const b = box();
  render(c, '', banner);
  showing = { kind: 'limb', id };
  b.classList.remove('hidden');
  const k = uiScale();
  const w = size.w * k;
  const h = size.h * k;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = anchor.right + GAP;
  if (x + w > vw - 8) x = anchor.left - GAP - w;
  if (x < 8) x = clamp(anchor.right + GAP, 8, vw - w - 8);
  const y = clamp(pointerY - h * 0.35, 8, vh - h - 8);
  b.style.left = `${Math.round(x / k)}px`;
  b.style.top = `${Math.round(y / k)}px`;
}

/** Show a hand card's card above that hand card (the hand sits at the bottom of the window). */
export function showHandCard(family: string, c: StatCard, cardRect: DOMRect, foot: string): void {
  const b = box();
  render(c, foot, '');
  showing = { kind: 'hand', family };
  b.classList.remove('hidden');
  const k = uiScale();
  const w = size.w * k;
  const h = size.h * k;
  const vw = window.innerWidth;
  let y = cardRect.top - GAP - h;
  if (y < 8) y = 8;
  const x = clamp(cardRect.left + cardRect.width / 2 - w / 2, 8, vw - w - 8);
  b.style.left = `${Math.round(x / k)}px`;
  b.style.top = `${Math.round(y / k)}px`;
}

export function hideLimbCard(kind?: 'limb' | 'hand'): void {
  if (kind && showing?.kind !== kind) return;
  showing = null;
  if (el) el.classList.add('hidden');
}

/** What the card is showing now (main.ts and the HUD refresh it while it is up). */
export function limbCardShowing(): typeof showing {
  return showing;
}
