/**
 * LETTERS: the rules (content/letters.ts has the people). Pure: the ship's Letters room and the tests call these.
 *
 *   - A thread opens when its correspondent's greeting has been said (CampaignState.said): their first letter waits.
 *   - He writes one letter; it is answered only after a deployment has passed (Collins: "it would only happen between
 *     missions"); until then the thread says so and takes no second letter.
 *   - A reply carries the writer's regard for him (-2..2); the thread keeps the sum, never below zero.
 *   - Atlas's thread is answered by her companion until the companion's regard reaches the gate; then the companion's
 *     handover letter comes with that reply, and Atlas writes the replies after.
 */
import { CORRESPONDENTS, correspondent, type CorrespondentId, type Writer } from '../../content/letters';
import type { CampaignState } from './campaign';

export interface LetterTurn {
  who: 'you' | 'them';
  /** The writer's name on a letter of theirs. */
  from?: string;
  text: string[];
  /** s.deployments when it was written: a letter of his is answered once that has grown. */
  at: number;
}

export interface LetterThread {
  id: CorrespondentId;
  turns: LetterTurn[];
  /** The sum of the writers' regard for him, from zero. */
  regard: number;
  /** The correspondent writes herself now (the companion has handed over). */
  direct: boolean;
  /** Letters of theirs he has not opened. */
  unread: number;
}

export interface LettersState { threads: Partial<Record<CorrespondentId, LetterThread>> }

/** The correspondents whose threads are open for this campaign. */
export function unlockedCorrespondents(s: CampaignState): CorrespondentId[] {
  const said = s.said ?? [];
  return CORRESPONDENTS.filter((c) => said.includes(c.unlock)).map((c) => c.id);
}

export const lettersUnlocked = (s: CampaignState): boolean => unlockedCorrespondents(s).length > 0;

/** The threads, with one opened (their first letter waiting) for every correspondent unlocked since. */
export function openLetters(s: CampaignState): CampaignState {
  const ids = unlockedCorrespondents(s);
  const threads = { ...(s.letters?.threads ?? {}) };
  let changed = false;
  for (const id of ids) {
    if (threads[id]) continue;
    const c = correspondent(id);
    threads[id] = { id, turns: [{ who: 'them', from: c.openingFrom ?? c.via.name, text: [...c.opening], at: s.deployments }], regard: 0, direct: false, unread: 1 };
    changed = true;
  }
  return changed ? { ...s, letters: { threads } } : s;
}

export const thread = (s: CampaignState, id: CorrespondentId): LetterThread | undefined => s.letters?.threads[id];

/** His last letter is unanswered (a deployment must pass first). */
export function awaiting(t: LetterThread): boolean {
  const last = t.turns[t.turns.length - 1];
  return !!last && last.who === 'you';
}

/** A letter of his, if the thread is open and not waiting on a reply. Empty text sends nothing. */
export function sendLetter(s: CampaignState, id: CorrespondentId, text: string): CampaignState {
  const t = thread(s, id);
  const clean = text.replace(/\r/g, '').trim();
  if (!t || awaiting(t) || !clean) return s;
  const lines = clean.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 12);
  const next: LetterThread = { ...t, turns: [...t.turns, { who: 'you', text: lines, at: s.deployments }] };
  return { ...s, letters: { threads: { ...s.letters!.threads, [id]: next } } };
}

/** Threads whose letter of his a deployment has passed since: a reply is due. */
export function dueThreads(s: CampaignState): CorrespondentId[] {
  const out: CorrespondentId[] = [];
  for (const t of Object.values(s.letters?.threads ?? {})) {
    if (!t) continue;
    const last = t.turns[t.turns.length - 1];
    if (last && last.who === 'you' && s.deployments > last.at) out.push(t.id);
  }
  return out;
}

/** Who writes the next reply of a thread. */
export function writerFor(t: LetterThread): Writer {
  const c = correspondent(t.id);
  return t.direct && c.direct ? c.direct : c.via;
}

/** The persona rfab.ai is given for the next reply. */
export const personaFor = (t: LetterThread): { name: string; who: string } => { const w = writerFor(t); return { name: w.name, who: w.who }; };

/** The thread as a history for the model: their letters as the assistant's turns, his as the user's. */
export function historyFor(t: LetterThread): Array<{ speaker: 'YOKE' | 'You'; text: string }> {
  return t.turns.map((turn) => ({ speaker: turn.who === 'them' ? 'YOKE' as const : 'You' as const, text: turn.text.join('\n') }));
}

/** The scripted reply for a thread, in turn, when there is no live mind (regard +1 each, so the gate opens in time). */
export function scriptedReply(t: LetterThread): { lines: string[]; regard: number } {
  const w = writerFor(t);
  const n = t.turns.filter((x) => x.who === 'them' && x.from === w.name).length - (t.direct ? 0 : 1);
  const lines = w.scripted[Math.max(0, Math.min(w.scripted.length - 1, n))];
  return { lines: [...lines], regard: 1 };
}

/**
 * A reply arrives: their letter, the writer's regard added (the sum never below zero), the letter unread. When the
 * companion's regard reaches the gate, her handover letter follows and Atlas writes from the next reply on.
 */
export function receiveLetter(s: CampaignState, id: CorrespondentId, lines: string[], regard: number | null): CampaignState {
  const t = thread(s, id);
  if (!t) return s;
  const c = correspondent(id);
  const w = writerFor(t);
  const delta = Math.max(-2, Math.min(2, Math.round(regard ?? 1)));
  let next: LetterThread = { ...t, turns: [...t.turns, { who: 'them', from: w.name, text: lines.filter(Boolean), at: s.deployments }], regard: Math.max(0, t.regard + delta), unread: t.unread + 1 };
  if (!t.direct && c.direct && next.regard >= c.direct.gate) {
    next = { ...next, direct: true, turns: [...next.turns, { who: 'them', from: c.via.name, text: [...c.direct.handover], at: s.deployments }], unread: next.unread + 1 };
  }
  return { ...s, letters: { threads: { ...s.letters!.threads, [id]: next } } };
}

export function markRead(s: CampaignState, id: CorrespondentId): CampaignState {
  const t = thread(s, id);
  if (!t || !t.unread) return s;
  return { ...s, letters: { threads: { ...s.letters!.threads, [id]: { ...t, unread: 0 } } } };
}

export const unreadLetters = (s: CampaignState): number => Object.values(s.letters?.threads ?? {}).reduce((a, t) => a + (t?.unread ?? 0), 0);

/** Where a thread stands, for the room: the gate, if there is one, and how far he is. */
export function standing(t: LetterThread): string {
  const c = correspondent(t.id);
  if (!c.direct) return `${c.via.name}'s regard: ${t.regard}`;
  if (t.direct) return `${c.direct.name} writes to you herself now (${c.via.name}'s regard: ${t.regard})`;
  return `${c.via.name}'s regard: ${t.regard} of ${c.direct.gate} before she lets you write to ${c.direct.name} directly`;
}
