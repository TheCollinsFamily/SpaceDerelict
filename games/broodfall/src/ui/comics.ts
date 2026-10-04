/**
 * COMICS (Collins, Oct 4 2026: "we should have somewhere in the ship interface where people can unlock comics they can
 * go back through as they play"). One screen in the ship's look, opened by COMICS in the room bar, with two views:
 *
 *   THE SHELF   every comic there is, in the order a player meets them. One he has shows its cover, its title and a
 *               line about it, and NEW until he has opened it. One he has not is a dark tile that says how it is
 *               earned and gives nothing of it away.
 *   THE READER  one comic, a page at a time, as wide as the screen allows so the lettering can be read (a page is
 *               taller than the screen: it scrolls). ONE control reads forward through everything: a click on the
 *               page, Space or the down arrow moves down the page, and at its foot turns it; the last page hands on
 *               to the next comic he has. NEXT / PREVIOUS and the left and right arrows turn a page outright.
 *               Esc or SHELF goes back; Esc on the shelf closes.
 *
 * THE NOTICE     the moment a comic is earned, a line comes up in the corner of the ship: NEW COMIC and its title. A
 *                click on it opens the shelf; it goes by itself after a few seconds. The count on COMICS stays until
 *                the comic is opened, so nothing is missed by looking away.
 *
 * What he has is worked out in src/meta/comics.ts from the save and kept apart from the campaign. The comics and how
 * each is earned: content/comics.ts. The pages: public/art/ship/comics/ (tools/comics/bake.mjs).
 */
import './comics.css';
import { artUrl } from '../render/art';
import { COMICS, COMIC_BY_ID, comicCover, comicPage, type ComicId } from '../../content/comics';
import { markComicRead, shelfNow } from '../meta/comics';
import type { CampaignState } from '../meta/campaign';

export interface ComicsOpen { state: CampaignState | null; onClose?: () => void }

let root: HTMLElement | null = null;
let current: ComicsOpen | null = null;
let have: ComicId[] = [];
let unread = new Set<ComicId>();
/** The comic open in the reader; null is the shelf. */
let reading: ComicId | null = null;
let page = 1;

export const comicsOpen = (): boolean => !!current;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function openComics(o: ComicsOpen): void {
  current = o;
  const shelf = shelfNow(o.state);
  have = shelf.have;
  unread = new Set(shelf.unread);
  reading = null;
  page = 1;
  if (!root) {
    root = document.createElement('div');
    root.id = 'comics';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Comics');
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey, true);
  }
  root.classList.remove('hidden');
  dismissNote();
  render();
}

export function closeComics(): void {
  if (!current || !root) return;
  const was = current;
  current = null;
  reading = null;
  root.classList.add('hidden');
  root.innerHTML = '';
  was.onClose?.();
}

let note: HTMLElement | null = null;
let noteTimer = 0;
const NOTE_MS = 9000;

/** Comics were earned just now: said once, in the corner, for a few seconds. `open` is what a click on it does. */
export function announceComics(ids: ComicId[], open: () => void): void {
  if (!ids.length || current) return;
  if (!note) {
    note = document.createElement('button');
    note.id = 'comics-note';
    note.setAttribute('role', 'status');
    document.body.appendChild(note);
  }
  const titles = ids.map((id) => COMIC_BY_ID[id].title);
  note.innerHTML = `<span class="cn-kicker">NEW COMIC${ids.length === 1 ? '' : 'S'} UNLOCKED</span><span class="cn-title">${titles.map(esc).join(' · ')}</span><span class="cn-go">READ IN COMICS ▸</span>`;
  note.title = 'Open Comics';
  note.onclick = () => { dismissNote(); open(); };
  note.classList.remove('hidden');
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(dismissNote, NOTE_MS);
}

function dismissNote(): void {
  window.clearTimeout(noteTimer);
  note?.classList.add('hidden');
}

function read(id: ComicId, at = 1): void {
  if (!have.includes(id)) return;
  reading = id;
  page = Math.min(Math.max(1, at), COMIC_BY_ID[id].pages);
  if (unread.has(id)) { unread.delete(id); markComicRead(id); }
  render();
  root?.querySelector('.cm-scroll')?.scrollTo(0, 0);
}

/** The next page; past the last one, the next comic he has (or back to the shelf). */
function turn(by: 1 | -1): void {
  if (!reading) return;
  const def = COMIC_BY_ID[reading];
  const to = page + by;
  if (to >= 1 && to <= def.pages) { page = to; render(); root?.querySelector('.cm-scroll')?.scrollTo(0, 0); return; }
  const i = have.indexOf(reading);
  const other = have[i + by];
  if (other) read(other, by === 1 ? 1 : COMIC_BY_ID[other].pages);
  else if (by === 1) { reading = null; render(); }
}

/**
 * Reading on: down the page while there is more of it below, then over to the next. A click that turned the page
 * outright threw away the bottom half of every page for anyone who clicked before scrolling.
 */
function advance(): void {
  const box = root?.querySelector<HTMLElement>('.cm-scroll');
  if (!box) return;
  const left = box.scrollHeight - box.clientHeight - box.scrollTop;
  if (left > 24) box.scrollBy({ top: Math.min(left, Math.round(box.clientHeight * 0.85)), behavior: 'smooth' });
  else turn(1);
}

function shelfHtml(): string {
  const tiles = COMICS.map((c) => {
    if (!have.includes(c.id)) {
      return `<div class="cm-tile locked" data-comic="${c.id}" aria-disabled="true">
        <div class="cm-cover"><span>LOCKED</span></div>
        <div class="cm-name">— — —</div>
        <div class="cm-about">${esc(c.locked)}</div></div>`;
    }
    const fresh = unread.has(c.id);
    return `<button class="cm-tile${fresh ? ' fresh' : ''}" data-read="${c.id}" data-comic="${c.id}" title="Read it">
      <div class="cm-cover"><img src="${artUrl(comicCover(c.id))}" alt="" loading="lazy"/>${fresh ? '<i class="cm-new">NEW</i>' : ''}</div>
      <div class="cm-name">${esc(c.title)}</div>
      <div class="cm-about">${esc(c.about)}</div>
      <div class="cm-pages">${c.pages} PAGE${c.pages === 1 ? '' : 'S'}</div></button>`;
  }).join('');
  return `<div class="cm-card">
    <div class="cm-head">
      <div><div class="cm-kicker">QUARTERS — READING MATTER</div>
        <div class="cm-title">COMICS</div>
        <p class="cm-small">Unlocked as you play, and kept: a new campaign does not empty the shelf.</p></div>
      <div class="cm-headr"><span class="cm-total">${have.length} OF ${COMICS.length} UNLOCKED</span>
        <button class="cm-close" data-act="close" title="Close (Esc)" aria-label="Close">✕</button></div>
    </div>
    <div class="cm-shelf">${tiles}</div>
  </div>`;
}

function readerHtml(id: ComicId): string {
  const c = COMIC_BY_ID[id];
  const i = have.indexOf(id);
  const first = page === 1 && i === 0;
  const last = page === c.pages;
  const after = have[i + 1] ? COMIC_BY_ID[have[i + 1]] : null;
  const nextLabel = !last ? 'NEXT PAGE ▶' : after ? `NEXT: ${esc(after.title.toUpperCase())} ▶` : 'BACK TO THE SHELF';
  return `<div class="cm-card reading">
    <div class="cm-bar">
      <button class="cm-btn" data-act="shelf" title="Back to the shelf (Esc)">◀ SHELF</button>
      <div class="cm-barmid"><span class="cm-reading">${esc(c.title)}</span><span class="cm-count">PAGE ${page} OF ${c.pages}</span></div>
      <div class="cm-turn">
        <button class="cm-btn" data-act="prev" title="Previous page (left arrow)"${first ? ' disabled' : ''}>◀ PREVIOUS</button>
        <button class="cm-btn" data-act="next" title="${last ? 'The end of this one' : 'Next page (right arrow)'}">${nextLabel}</button>
        <button class="cm-close" data-act="close" title="Close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="cm-scroll" tabindex="0"><img class="cm-page" data-act="on" src="${artUrl(comicPage(id, page))}" alt="${esc(c.title)}, page ${page} of ${c.pages}" title="Click to read on"/></div>
  </div>`;
}

function render(): void {
  if (!root || !current) return;
  root.dataset.view = reading ? 'reader' : 'shelf';
  root.innerHTML = reading ? readerHtml(reading) : shelfHtml();
  // A page that does not come (a file missing from the game's folder): said in words, with the way back still there.
  const img = root.querySelector<HTMLImageElement>('.cm-page');
  if (img) img.addEventListener('error', () => {
    const box = img.parentElement;
    if (box) box.innerHTML = '<p class="cm-missing">This page did not load. The comic is still yours: try it again, or go back to the shelf.</p>';
  }, { once: true });
}

function onClick(ev: MouseEvent): void {
  const t = ev.target as HTMLElement;
  // A click on the dark around the card closes it, as it does for the other screens of the ship.
  if (t === root) { closeComics(); return; }
  const pick = t.closest<HTMLElement>('[data-read]');
  if (pick) { read(pick.dataset.read as ComicId); return; }
  const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'close') closeComics();
  else if (act === 'shelf') { reading = null; render(); }
  else if (act === 'on') advance();
  else if (act === 'next') turn(1);
  else if (act === 'prev') turn(-1);
}

function onKey(ev: KeyboardEvent): void {
  if (!current) return;
  const stop = () => { ev.preventDefault(); ev.stopPropagation(); };
  if (ev.key === 'Escape') { stop(); if (reading) { reading = null; render(); } else closeComics(); return; }
  if (!reading) return;
  if (ev.key === 'ArrowRight') { stop(); turn(1); }
  else if (ev.key === 'ArrowLeft') { stop(); turn(-1); }
  else if (ev.key === ' ' || ev.key === 'ArrowDown' || ev.key === 'PageDown') { stop(); advance(); }
  else if (ev.key === 'ArrowUp' || ev.key === 'PageUp') { stop(); root?.querySelector<HTMLElement>('.cm-scroll')?.scrollBy({ top: -Math.round(window.innerHeight * 0.7), behavior: 'smooth' }); }
}
