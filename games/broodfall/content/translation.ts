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

/**
 * Oct 26 2026: her band over a scene ("SOURCE: ... RENDERED BY YOKE · CONFIDENCE n%") and her notes under its lines were
 * cut (Collins: "corny and adds nothing", "stupid, should all be removed"). What is left: the glyphs a line resolves from.
 */
export interface ChannelDef {
  /** Characters the line is drawn in before it resolves into words (the signal, as her console shows it). */
  glyphs: string;
}

export const CHANNELS: Record<Channel, ChannelDef> = {
  // Oct 3 2026 (Collins): the Delegation hold coloured cards up in a field (11,000 of them), and after the summit call by video feed.
  delegation: { glyphs: '║═╬╦╩╠╣╔╗╚╝⋮⁘⁙' },
  faithful: { glyphs: '⌇⌁∿≀⋮⁞⌇∿' },
  institute: { glyphs: '·•∙⋅◦∘•·' },
  voicebox: { glyphs: '░▒▓' },
  // The Roach King (content/roachKing.ts): never speaking to him; his addresses to the nation, caught off their television band.
  roach: { glyphs: '▤▥▦▧▨▩◫◧◨' },
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
