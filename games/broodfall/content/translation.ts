/**
 * THE TRANSLATION LAYER (Collins, Oct 1 2026: "something in the game's lore or visuals that implies an AI
 * is translating what the insects are saying for you (explaining why they sound like AI)").
 *
 * Every word the leaders say to him reaches him through YOKE: she renders their signal (the
 * Delegation's letters cut into the crops, the Faithful's stridulation on tens of thousands of radio
 * stations in sync, the Institute's pulse-coded laser on the hull: Collins's channels, Oct 1 2026) live into Standard, in the Empire's mid-century register, and voices it
 * from the Empire's stock voice library. That is why they sound the way they do. The lore is in
 * `content/lore/ship-ai-lorebook.md` section 18 (PROPOSAL) and `content/lore/insects.md` section 11.
 *
 * What the game shows (src/ui/translation.ts): a band on every leader card naming the source signal
 * and her confidence; the line being said resolving from their glyphs into words; a short burst of the
 * source signal before each voiced line (src/audio/engine.ts `signalIn`); and now and then her
 * translator's note under a line. The B-movie that opens a new game is the locals' own film: no
 * translation layer there, because nobody aboard is listening yet.
 */
import type { FactionId } from './campaign';

/** The channel a speaker reaches him on: each faction's own, and the Awaited One's voice box. */
export type Channel = FactionId | 'voicebox';

export interface ChannelDef {
  /** What she is rendering from, as her console prints it. */
  source: string;
  /** Characters the line is drawn in before it resolves into words (the signal, as her console shows it). */
  glyphs: string;
  /** Her confidence on this channel, lowest and highest (percent). */
  confidence: [number, number];
}

export const CHANNELS: Record<Channel, ChannelDef> = {
  delegation: { source: 'CROP GLYPHS · 3.2 KM² · READ FROM ORBIT', glyphs: '║═╬╦╩╠╣╔╗╚╝⋮⁘⁙', confidence: [93, 98] },
  faithful: { source: 'STRIDULATION OVER AM · 41,880 STATIONS IN SYNC', glyphs: '⌇⌁∿≀⋮⁞⌇∿', confidence: [81, 92] },
  institute: { source: 'LASER, PULSE-CODED · REPEATING · RENDERED AS VIDEO', glyphs: '·•∙⋅◦∘•·', confidence: [95, 99] },
  voicebox: { source: 'VOICE BOX · YOUR OWN MANUFACTURE', glyphs: '░▒▓', confidence: [100, 100] },
};

/** Who speaks on which channel (the speaker's name as content/campaign.ts writes it, its channel left out). */
export const SPEAKER_CHANNEL: Record<string, Channel> = {
  'Delegate': 'delegation',
  'The Voice': 'faithful',
  'The Director': 'institute',
  'The Awaited One': 'voicebox',
};

/**
 * Her translator's notes, shown under a line whose words contain `match` (exact, case kept).
 * Matched by words, not by a line's key, so a note survives a line being voiced again; a line
 * rewritten so the words are gone simply loses its note. Notes are read, never voiced.
 */
export const TRANSLATOR_NOTES: Array<{ match: string; note: string }> = [
  { match: 'Please forgive the handwriting', note: 'Rendered "handwriting". Their word is "furrow discipline". The second comma really is a barn.' },
  { match: 'and dear Visitor\'s wife', note: 'Rendered "wife". Their word means "the other voice on the band". It also means "wife". I checked. Twice.' },
  { match: 'our newsletter, "Gentle Endings"', note: 'Their title is the word for the hush after a swarm leaves the comb. "Gentle Endings" is my closest. It is not close.' },
  { match: 'asked if you are sad', note: 'untranslatable: grief-scent, a mourning pheromone with no Standard equivalent. Rendered "sad".' },
  { match: 'We are the Voluntary Extinction Society', note: 'The name is rendered literally. I checked. I wished it were not.' },
  { match: 'It is the WORD.', note: 'The capitals are his. He stridulates in capitals.' },
  { match: 'Let us help you end it.', note: 'untranslatable: a formal pronoun kept for royals not yet hatched. Rendered "the Awaited One". Confidence low. Reverence high.' },
  { match: 'Consenting, broadly. I\'ll have them driven', note: '"Broadly" is a faithful rendering. I checked it twice.' },
  { match: 'you are going to LOVE League of Larvae', note: 'The real title is a pheromone. I chose a pun. I stand by it.' },
  { match: 'one sec, I\'m in a match', note: 'Rendered at his own speed, then slowed forty per cent so you can follow it. The beam carries his match audio too. I left it in.' },
  { match: 'Hello. I am the Awaited One.', note: 'No rendering needed. You wrote this one.' },
];

/** FNV-1a, 32 bits: a line's confidence is the same every time it is shown. */
function hash(t: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Who says a line, its channel and stage directions left out ("The Voice (broadcast): …" → "The Voice"). */
const speaker = (line: string): string => {
  const i = line.indexOf(':');
  return i > 0 ? line.slice(0, i).replace(/\s*\([^)]*\)\s*$/, '').trim() : '';
};

/** The channel a line came in on; null for his own lines and anyone not translated. */
export function channelOfLine(line: string): Channel | null {
  return SPEAKER_CHANNEL[speaker(line)] ?? null;
}

/** Her confidence in her rendering of one line (percent): the same every time, inside the channel's range. */
export function confidenceOf(line: string, ch: Channel): number {
  const [lo, hi] = CHANNELS[ch].confidence;
  return lo + (hash(line) % (hi - lo + 1));
}

/** Her confidence over a whole card: the lowest of its translated lines (what her band reports). */
export function cardConfidence(lines: string[], ch: Channel): number {
  const own = lines.filter((l) => channelOfLine(l));
  return own.length ? Math.min(...own.map((l) => confidenceOf(l, channelOfLine(l)!))) : CHANNELS[ch].confidence[1];
}

/** Her note on a line, if she has one. */
export function noteFor(line: string): string | null {
  if (!channelOfLine(line)) return null;
  return TRANSLATOR_NOTES.find((n) => line.includes(n.match))?.note ?? null;
}
