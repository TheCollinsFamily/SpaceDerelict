/**
 * THE CAST: every speaker of Broodfall's films, written ONCE (docs/VIDEO-CONVENTIONS.md at the repo's root: "a character
 * is described in one place, word for word the same in every clip"). Every clip of every film takes a speaker's voice
 * and look from here, which is what keeps a voice the same from one clip to the next and one film to the next: nothing
 * is cloned; the same words are given every time, several lines are acted in one clip, and the gates check his pitch.
 * A new character is added here before any film of theirs is made; a description is never changed once a film uses
 * it (every film made would no longer match).
 *
 *   VOICES   how each speaker sounds (said in every clip in which they speak)
 *   SUBJECT  who each speaker is in the picture, and how their mouth moves
 * His look (seen from behind, always) is the approved concept notes/concepts/2026-09-29/hero-behind-desk.png; the
 * leaders' looks are their portraits (public/art/ship/leader-*.webp); the Roach King's is art-src-new/roach/stills/close.png.
 */
export const VOICES: Record<string, string> = {
  'You': 'He speaks English in a mild, earnest young man\'s voice: a light, clear tenor, soft-spoken and thoughtful, a little dry, with a neutral American accent. It is always exactly this same voice.',
  'Delegate': 'She speaks English in a warm, bright, elderly woman\'s voice, gentle and delighted, like a kindly retired schoolteacher, with a soft mid-Atlantic accent of the 1950s. It is always exactly this same voice.',
  'The Voice': 'He speaks English in the booming, fervent, gravelly baritone of an American radio evangelist of the 1950s, about sixty, rolling and rising like a preacher. It is always exactly this same voice.',
  'The Director': 'He speaks English in a fast, lazy, confident young man\'s voice, a nasal Californian drawl, always amused with himself. It is always exactly this same voice.',
  // Off the air (content/roachKing.ts): the showman's big voice, without the show.
  'The Roach King': 'He speaks English in a big, deep, gravelly man\'s voice with a Texas drawl, a showman\'s voice used quietly and sharply, tired and exact. It is always exactly this same voice.',
  'Aide': 'He speaks English in a thin, careful, nervous man\'s voice, a junior civil servant, with a soft mid-Atlantic accent. It is always exactly this same voice.',
  'General': 'She speaks English in a hoarse, loud, furious woman\'s voice, a parade-ground bark. It is always exactly this same voice.',
};
export const SUBJECT: Record<string, [string, string]> = {
  'Delegate': ['The chief delegate, the elderly insect woman in the cardigan and the flower garland,', 'Her small mandibles move like a mouth with her words.'],
  'The Voice': ['The preacher in the black robes', 'His small mandibles move like a mouth with his words.'],
  'The Director': ['The lanky young insect man in the grey t-shirt', 'His small mandibles move like a mouth with his words.'],
  'The Roach King': ['The President, the huge cockroach-man in the green coat with the gold braid,', 'His small mandibles move like a mouth with his words.'],
  'Aide': ['The aide, the thin insect man in the grey suit,', 'His small mandibles move like a mouth with his words.'],
  'General': ['The general on the screen', 'Her small mandibles move like a mouth with her words.'],
};
