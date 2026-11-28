/**
 * A key as the player has it now, for the words on screen (Settings > Keys can change any of them: src/meta/keys.ts).
 * `kbd(id)` writes a <kbd> that `refreshKbds()` sets again when the keys change, and an element with `data-kt` (an
 * action) and `data-kt-label` gets the title "<label> (key <key>)".
 */
import { keyLabel, type KeyAction } from '../meta/keys';
import { loadSettings } from '../meta/storage';

export const keyFor = (id: KeyAction): string => keyLabel(loadSettings().keys[id]);

export const kbd = (id: KeyAction): string => `<kbd data-k="${id}">${keyFor(id)}</kbd>`;

export function refreshKbds(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('kbd[data-k]')) el.textContent = keyFor(el.dataset.k as KeyAction);
  for (const el of root.querySelectorAll<HTMLElement>('[data-kt]')) el.title = `${el.dataset.ktLabel ?? ''} (key ${keyFor(el.dataset.kt as KeyAction)})`;
}

/** A placing problem from the sim ("turn it", with no key: the sim does not know the keys), with the key added. */
export const withTurnKey = (text: string): string => text.replace(/\bturn it\b/, `turn it (${keyFor('turnPiece')})`);
