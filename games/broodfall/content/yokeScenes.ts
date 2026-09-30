/**
 * YOKE'S SCENES: moments she acts out full-screen over the ship, not in her projection.
 *
 * PRINT BODY (Collins, Sep 30 2026). She is layered models, neural tissue and the systems
 * that fly the ship, and offended at being called an AI; she can print herself a body if he
 * wants. When he asks her to (or her live mind agrees to it and emits [[PRINT_BODY]]), the
 * ship prints one: it looks at its hand in disgust, collapses dead, and lies in the empty hold.
 * Then her voice from the ship's speakers, word for word (typos mended). Once a campaign; asked
 * again, she refuses.
 *
 * The art is a sequence of clips (or stills) made by the YOKE clip session, found under
 * `scenes.printBody` in public/art/ship/yoke/manifest.json (or `ship.yoke.scenes.printBody` in
 * public/art/manifest.json). Until it exists, the scene plays as storyboard cards (STAGES).
 */

export const PRINT_BODY = {
  /** His line asks for it. */
  asks: /\b(print|make|grow|build|get)\b[^.?!]{0,24}\b(yourself|you|your own)?\s*(a\s+)?(real\s+|physical\s+|flesh\s+)?body\b|\b(meet|see|show)\b[^.?!]{0,16}\b(you|yourself)\b[^.?!]{0,12}\bin (person|the flesh)\b|\bin the flesh\b/i,
  /** What her live mind writes when she agrees to it (her brain text tells her; content/lore/yoke-brain.md). */
  tag: 'PRINT_BODY',
  /** Her voice from the speakers, over the last frame (Collins's words). */
  line: 'That was gross. Don\'t ask me to do that again... and ugh, now I have to do something with my body... Hey, want to eat it? That would be sick.',
  /** Asked a second time in the same campaign. */
  refusal: 'Nope. Once was plenty. I\'m still deciding what to do with the last one, and it\'s starting to smell.',
  /** The beats of the sequence, in order, and how long each is held when it is a still or a card (ms). */
  stages: [
    { id: 'print', card: 'The hold\'s fabricator hums. Layer by layer, a body is printed: hers.', ms: 3200 },
    { id: 'hand', card: 'The body lifts one hand to its face, and looks at it with open disgust.', ms: 3000 },
    { id: 'collapse', card: 'It sways, and folds. It is dead before it reaches the floor.', ms: 2600 },
    { id: 'hold', card: 'The empty hold. The body lies where it fell.', ms: 2400 },
  ],
};
