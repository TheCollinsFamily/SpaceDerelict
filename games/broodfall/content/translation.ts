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
export type Channel = FactionId | 'voicebox' | 'roach';

export interface ChannelDef {
  /** What she is rendering from, as her console prints it. */
  source: string;
  /** Characters the line is drawn in before it resolves into words (the signal, as her console shows it). */
  glyphs: string;
  /** Her confidence on this channel, lowest and highest (percent). */
  confidence: [number, number];
}

export const CHANNELS: Record<Channel, ChannelDef> = {
  // Oct 3 2026 (Collins): the Delegation hold coloured cards up in a field (11,000 of them), and after the summit call by video feed.
  delegation: { source: 'CARD FIELD · 11,000 CARDS · READ FROM ORBIT', glyphs: '║═╬╦╩╠╣╔╗╚╝⋮⁘⁙', confidence: [93, 98] },
  faithful: { source: 'STRIDULATION OVER AM · 41,880 STATIONS IN SYNC', glyphs: '⌇⌁∿≀⋮⁞⌇∿', confidence: [81, 92] },
  institute: { source: 'LASER, PULSE-CODED · REPEATING · RENDERED AS VIDEO', glyphs: '·•∙⋅◦∘•·', confidence: [95, 99] },
  voicebox: { source: 'VOICE BOX · YOUR OWN MANUFACTURE', glyphs: '░▒▓', confidence: [100, 100] },
  // The Roach King (content/roachKing.ts): never speaking to him; his addresses to the nation, caught off their television band.
  roach: { source: 'COMMONWEALTH TELEVISION, BROADCAST BAND · INTERCEPTED', glyphs: '▤▥▦▧▨▩◫◧◨', confidence: [86, 95] },
};

/** Who speaks on which channel (the speaker's name as content/campaign.ts writes it, its channel left out). */
export const SPEAKER_CHANNEL: Record<string, Channel> = {
  'Delegate': 'delegation',
  'The Voice': 'faithful',
  'The Director': 'institute',
  'The Awaited One': 'voicebox',
  'The Roach King': 'roach',
  // Off the air (content/roachKing.ts ROACH_SCENES): his aide, and a general of the Host on a call.
  'Aide': 'roach',
  'General': 'roach',
};

/**
 * Her translator's notes, shown under a line whose words contain `match` (exact, case kept).
 * Matched by words, not by a line's key, so a note survives a line being voiced again; a line
 * rewritten so the words are gone simply loses its note. Notes are read, never voiced.
 */
export const TRANSLATOR_NOTES: Array<{ match: string; note: string }> = [
  { match: 'our newsletter, "Gentle Endings"', note: 'Their title is the word for the hush after a swarm leaves the comb. "Gentle Endings" is my closest. It is not close.' },
  { match: 'asked if you are sad', note: 'untranslatable: grief-scent, a mourning pheromone with no Standard equivalent. Rendered "sad".' },
  // The cut scenes of Oct 3 2026 (read on a scene's card, under THE WORDS; a film shows the words alone).
  { match: 'members of the voluntary extinction movement', note: 'The name is rendered literally. I checked. I wished it were not.' },
  { match: 'But you are an Ablim, are you not?', note: 'untranslatable: "Ablim", a class of being in their Book. Left as it sounds.' },
  { match: 'so that your mission may not be retarded', note: 'Rendered "retarded": slowed, held back. His register is two hundred years old. I matched it.' },
  { match: 'some hot alien mamacitas', note: 'untranslatable: a pheromone. Rendered "mamacitas". I am sorry.' },
  // The Roach King's addresses (content/roachKing.ts).
  { match: 'Chat says it is just a fungus', note: '"Chat": his word for the forty thousand antennae that follow his broadcast. They have opinions. Most are wrong.' },
  { match: 'you are MID', note: 'untranslatable: a grading term for a larva fed one meal short of a soldier. Rendered "mid". He meant it as an insult. It landed.' },
  { match: 'My fellow sisters. Your President.', note: 'The voice is matched to his mandibles. The lip sync is mine. You are welcome.' },
  { match: 'I upload every night. Six hours.', note: 'Rendered literally. He does not know what the upload is. He is about to.' },
  { match: 'The wheat has a family.', note: 'It does not. I checked.' },
  // Off the air (content/roachKing.ts ROACH_SCENES).
  { match: 'a long tradition of being retards', note: 'His word is a nursery term for a larva that never pupates. Rendered as he meant it.' },
  { match: 'Today we celebrate our Independence Day!', note: 'Their word is "the day we are not eaten". "Independence Day" is my closest. I have the feeling I have heard this speech before.' },
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
