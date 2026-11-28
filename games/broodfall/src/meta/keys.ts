/**
 * EVERY KEY THE GAME READS, in one table (Bruno, Nov 27 2026: "all keyboard commands should be remappable"; the rule is
 * in the repo's CLAUDE.md). Settings shows each row with a button that takes a new key (src/ui/settings.ts), and game
 * code asks `isKey(keys, 'pause', ev.key)`, never `ev.key === ' '`.
 *
 * Fixed, and not in the table: Esc (cancel, close, back, and the way to Settings, so a bad binding can always be
 * undone), Enter in a text field, the keys that skip a film, and the arrow keys inside the codex, the comics and the
 * globe.
 *
 * A key is stored as `ev.key` in lower case: 'q', ' ', 'arrowleft', 'home', 'f1', '`'. '' is no key.
 */
export type KeyAction =
  | 'turnLeft' | 'turnRight' | 'home' | 'panLeft' | 'panRight' | 'panUp' | 'panDown'
  | 'step' | 'pause' | 'speed1' | 'speed3' | 'speed8'
  | 'turnPiece' | 'codex'
  | 'orderMove' | 'orderAttack' | 'orderHold' | 'orderReturn' | 'orderGuard' | 'orderMode' | 'orderNet' | 'orderDeploy' | 'orderInfest'
  | 'selectBrood' | 'selectAll' | 'kind1' | 'kind2' | 'kind3' | 'kind4' | 'kind5'
  | 'group1' | 'group2' | 'group3' | 'group4' | 'group5';

export type KeyMap = Record<KeyAction, string>;

export interface KeyRow { id: KeyAction; label: string; key: string }
export interface KeySection { title: string; note?: string; rows: KeyRow[] }

export const KEY_SECTIONS: KeySection[] = [
  {
    title: 'THE VIEW', rows: [
      { id: 'turnLeft', label: 'Turn the view left', key: 'q' },
      { id: 'turnRight', label: 'Turn the view right', key: 'e' },
      { id: 'home', label: 'Centre the view', key: 'home' },
      { id: 'panLeft', label: 'Slide the view left', key: 'arrowleft' },
      { id: 'panRight', label: 'Slide the view right', key: 'arrowright' },
      { id: 'panUp', label: 'Slide the view up', key: 'arrowup' },
      { id: 'panDown', label: 'Slide the view down', key: 'arrowdown' },
    ],
  },
  {
    title: 'THE WAVE', note: 'Between waves the step key goes one step: the organ stage, the surface, the wave. During a wave the pause key pauses. One key can do both.',
    rows: [
      { id: 'step', label: 'Next step between waves', key: ' ' },
      { id: 'pause', label: 'Pause and play during a wave', key: ' ' },
      { id: 'speed1', label: 'Speed 1×', key: 'z' },
      { id: 'speed3', label: 'Speed 3×', key: 'x' },
      { id: 'speed8', label: 'Speed 8×', key: 'v' },
    ],
  },
  {
    title: 'PLACING', note: 'Shift and the turn key turn the other way.', rows: [
      { id: 'turnPiece', label: 'Turn the limb, organ or district in hand', key: 'r' },
      { id: 'codex', label: 'Open the Limb Codex', key: 'c' },
    ],
  },
  {
    title: 'UNITS', note: 'Ctrl and a group key keeps the selected units as that group.', rows: [
      { id: 'orderMove', label: 'Move', key: 'm' },
      { id: 'orderAttack', label: 'Attack', key: 'a' },
      { id: 'orderHold', label: 'Hold', key: 'h' },
      { id: 'orderReturn', label: 'Back to the nest', key: 'b' },
      { id: 'orderGuard', label: 'Guard', key: 'g' },
      { id: 'orderMode', label: 'Change mode', key: 't' },
      { id: 'orderNet', label: 'Net', key: 'n' },
      { id: 'orderDeploy', label: 'Deploy', key: 'd' },
      { id: 'orderInfest', label: 'Infest', key: 'i' },
      { id: 'selectBrood', label: 'Select the brood of the open Pit or Den', key: 'r' },
      { id: 'selectAll', label: 'Arm an order for all units', key: '`' },
      { id: 'kind1', label: 'Arm an order for unit kind 1', key: 'f1' },
      { id: 'kind2', label: 'Arm an order for unit kind 2', key: 'f2' },
      { id: 'kind3', label: 'Arm an order for unit kind 3', key: 'f3' },
      { id: 'kind4', label: 'Arm an order for unit kind 4', key: 'f4' },
      { id: 'kind5', label: 'Arm an order for unit kind 5', key: 'f5' },
      { id: 'group1', label: 'Unit group 1', key: '1' },
      { id: 'group2', label: 'Unit group 2', key: '2' },
      { id: 'group3', label: 'Unit group 3', key: '3' },
      { id: 'group4', label: 'Unit group 4', key: '4' },
      { id: 'group5', label: 'Unit group 5', key: '5' },
    ],
  },
];

export const KEY_ROWS: KeyRow[] = KEY_SECTIONS.flatMap((s) => s.rows);
export const DEFAULT_KEYS = Object.fromEntries(KEY_ROWS.map((r) => [r.id, r.key])) as KeyMap;

/**
 * Pairs that may share one key, because they never act at the same moment: the step key works only between waves
 * and the pause key only when there is no step to take, and the turn key works only with something in hand while
 * the brood key works only with nothing in hand.
 */
const SHARED: Array<[KeyAction, KeyAction]> = [['step', 'pause'], ['turnPiece', 'selectBrood']];
export const mayShare = (a: KeyAction, b: KeyAction): boolean =>
  a === b || SHARED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Keys no action may take: Esc is the fixed way back, the modifiers change other keys, Enter confirms. */
export const RESERVED_KEYS = ['escape', 'enter', 'shift', 'control', 'alt', 'meta', 'tab', 'capslock', 'contextmenu', 'os'];

/** `ev.key` as the table stores it. */
export const normKey = (k: string): string => k.toLowerCase();

/** A key a player may give to an action. */
export const bindable = (k: string): boolean => !!k && !RESERVED_KEYS.includes(normKey(k)) && k !== 'Dead' && k !== 'Unidentified';

/** Whether this pressed key is the action's key. */
export const isKey = (keys: KeyMap, id: KeyAction, pressed: string): boolean => !!keys[id] && keys[id] === normKey(pressed);

/** The action of the key pressed, from a list of the actions that may act now (first match wins). */
export function actionOf<A extends KeyAction>(keys: KeyMap, pressed: string, among: readonly A[]): A | null {
  const k = normKey(pressed);
  return among.find((a) => !!keys[a] && keys[a] === k) ?? null;
}

const NAMES: Record<string, string> = {
  ' ': 'SPACE', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', home: 'HOME', end: 'END',
  pageup: 'PG UP', pagedown: 'PG DN', insert: 'INS', delete: 'DEL', backspace: 'BKSP',
};
/** A key as a player reads it: 'SPACE', '←', 'F1', 'Q'. */
export const keyLabel = (k: string): string => (k === '' ? '—' : NAMES[k] ?? k.toUpperCase());

/** Two actions that may not have the same key have it ('' is no key, and clashes with nothing). */
const clash = (k: KeyMap, a: KeyAction, b: KeyAction): boolean => a !== b && !!k[a] && k[a] === k[b] && !mayShare(a, b);

/**
 * Saved keys made whole. A missing or broken key gets its default. A key the player saved wins over a default it
 * clashes with: that action is left with no key ('') for the player to set (a save from before Nov 27 2026 may hold
 * A and D for turning, now the defaults of two unit orders). Two saved keys that clash both go back to their defaults.
 */
export function keysFrom(raw: unknown): KeyMap {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_KEYS };
  const saved = new Set<KeyAction>();
  for (const row of KEY_ROWS) {
    const v = r[row.id];
    if (typeof v === 'string' && v.length && bindable(v)) { out[row.id] = normKey(v); saved.add(row.id); }
    else if (v === '') { out[row.id] = ''; saved.add(row.id); }
  }
  for (const a of KEY_ROWS) for (const b of KEY_ROWS) {
    if (a.id < b.id && saved.has(a.id) && saved.has(b.id) && clash(out, a.id, b.id)) {
      out[a.id] = DEFAULT_KEYS[a.id]; out[b.id] = DEFAULT_KEYS[b.id]; saved.delete(a.id); saved.delete(b.id);
    }
  }
  for (const a of KEY_ROWS) for (const b of KEY_ROWS) {
    if (clash(out, a.id, b.id) && saved.has(a.id) && !saved.has(b.id)) out[b.id] = '';
  }
  for (const a of KEY_ROWS) for (const b of KEY_ROWS) if (a.id < b.id && clash(out, a.id, b.id)) out[b.id] = '';
  return out;
}

/**
 * Give `id` the key `pressed`. Another action that had that key (and may not share it) takes the key `id` had: the
 * two swap, so no action is left without a key. Null when the key may not be bound.
 */
export function rebind(keys: KeyMap, id: KeyAction, pressed: string): KeyMap | null {
  if (!bindable(pressed)) return null;
  const k = normKey(pressed);
  const out = { ...keys };
  const old = out[id];
  for (const row of KEY_ROWS) {
    if (row.id !== id && out[row.id] === k && !mayShare(row.id, id)) out[row.id] = old;
  }
  if (old === '') for (const row of KEY_ROWS) if (row.id !== id && out[row.id] === '' && keys[row.id] === k) out[row.id] = '';
  out[id] = k;
  // A swap must not make a new clash (the key `id` had may be shared with a third action).
  for (const a of KEY_ROWS) for (const b of KEY_ROWS) if (clash(out, a.id, b.id)) return null;
  return out;
}
