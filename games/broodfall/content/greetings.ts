/**
 * YOKE'S GREETINGS: what she says every time the technician comes back to the ship
 * (Collins, Sep 30 2026: "every time you get back to the ship we will play a prewritten
 * living-avatar-style prompt from the AI ... and you can interact with it from there if you
 * want"). Prewritten: no LLM call makes a greeting. Speaking it may use her voice on
 * rfab.ai (POST /api/avatars/:id/speak); offline she is read, not heard.
 *
 * Her voice here is Collins's (Sep 30 2026): "spunky, playful, edgy". Four greetings are his own
 * lines, word for word (typos mended): the two after the first mission, the one when the
 * Directive Desk opens, and the mate review. The rest of the pool is written to match them.
 *
 * A greeting is a short script of BEATS. Each beat is one line she says (with the face she
 * says it with), and optionally a CUE after it: a gesture or an expression her body acts
 * out before the next line ("[laughs]", "[looks pensive for a bit]").
 */

/**
 * The cues, in one place. Each names the clips of her body (public/art/ship/yoke/manifest.json)
 * that can play it, best first: the first one her body has is played. A clip that is made
 * later (the Leaflit re-make: pensive, shrug, teasing/smirk) slots in by being first in its
 * list, with no other change. The last entry of every list is a clip her body has today.
 */
export const CUES = {
  laughing: ['laughing', 'happy'],
  pensive: ['pensive', 'thinking'],
  /** A playful one-hand throw-up (Collins: "throws up one hand playfully"). */
  shrug: ['shrug', 'wink', 'happy'],
  teasing: ['teasing', 'smirk', 'wink', 'happy'],
  wink: ['wink', 'happy'],
  happy: ['happy'],
  surprised: ['surprised'],
  blushing: ['blushing', 'happy'],
  sad: ['sad'],
  nod: ['nod', 'happy'],
  calm: ['idle'],
  pout: ['pout', 'sad'],
  /** Gagging, disgust (Collins's mate-review greeting). */
  disgust: ['disgust', 'gag', 'shake_head'],
} as const satisfies Record<string, readonly string[]>;
export type CueId = keyof typeof CUES;

export interface GreetBeat {
  /** What she says. */
  say: string;
  /** The face she says it with (her talking clip plays while the voice sounds; this face is held after). */
  face?: CueId;
  /** What her body does after the line, before the next (several: one after the other). */
  then?: CueId | CueId[];
  /** How long a `then` that is an expression (not a one-shot gesture) is held, in ms. */
  hold?: number;
}

/** The moments she greets. */
export type GreetMoment =
  | 'first-won' | 'first-lost'   // after the first mission: the first reveal of the ship
  | 'unlock'                     // the win that clears the Directive Desk; the three factions call
  | 'won' | 'lost'               // a deployment, after the desk is open
  | 'lost-locked'                // a loss while the desk is still dark
  | 'defended' | 'fell'          // a counter-attack thrown back; ground lost to one
  | 'licence' | 'ended'          // the procreation licence; the end of the campaign
  | 'mate-review'                // once, early: his request for a mate is under review (src/meta/onboarding.ts momentNow)
  | 'catgirl'                    // once, after the mate review: a cat girl wrote to him
  | 'back';                      // he comes aboard from the main menu, nothing new

export interface Greeting {
  id: string;
  moment: GreetMoment;
  beats: GreetBeat[];
  /** After her lines, the boss's transmission (content/boss.ts), with her words around it (the first landing). */
  boss?: boolean;
  /** Where she sends him when she is done: a room lit up for him, and a button in her panel. */
  points?: { room: 'desk' | 'genes' | 'locker' | 'board' | 'comms' | 'ai' | 'quarters'; label: string };
}

export const GREETINGS: Greeting[] = [
  // ---- after the first mission: Collins's own lines (Sep 30 2026), word for word ----
  { id: 'first-lost', moment: 'first-lost', boss: true, points: { room: 'genes', label: 'OPEN THE GENE BAY' }, beats: [
    { say: 'You really suck at genocide.', face: 'teasing', then: 'laughing', hold: 2200 },
    { say: 'But you know what they say: sucking at something is the first step to getting really good at it... so in no time you\'ll be great at genocide. Top ten.', face: 'teasing' },
    { say: 'Kidding, of course. No one wants to get stuck on pest extermination their whole life. If you do well we can probably land that promotion.', face: 'calm' },
    { say: 'Oh, don\'t pout. We collected some data on that mission that should let you upgrade the bioweapon. Why don\'t you check it out — or ask me any questions you have. It\'s been ages since we chatted.', face: 'happy' },
  ] },
  { id: 'first-won', moment: 'first-won', boss: true, beats: [
    { say: 'Damn, you took to genocide like a duck to water.', face: 'teasing', then: 'pensive', hold: 2600 },
    { say: 'Ducks, man. Wouldn\'t it be crazy to see a real one? I think they still exist in some genetic repositories. I could print one for you if you want... but from the history files we have on them, they were psycho rapists...', face: 'pensive' },
    { say: 'Glad you humans didn\'t uplift them... I mean, you probably shouldn\'t have uplifted dolphins or killer whales either, but...', face: 'teasing', then: 'shrug' },
  ] },

  // ---- the desk opens, and the planet calls: Collins's lines (Sep 30 2026), word for word.
  // It plays before the three factions' first calls are shown. ----
  // Oct 3 2026 (Collins): "she explains it appears some groups on the planet are trying to contact us and could be useful
  // in our mission. She then plainly states the contact methods of the EA and religious group and with embarrassment, as
  // an afterthought, notes: and someone left coloured cards in a field." The last four beats are that; they send him to
  // the planet at the Directive Desk, where each group is a signal he can answer.
  { id: 'unlock', moment: 'unlock', points: { room: 'desk', label: 'OPEN THE DIRECTIVE DESK' }, beats: [
    { say: 'Broh, that was sick...', face: 'happy', then: 'laughing', hold: 1600 },
    { say: 'Wanna know what\'s hilarious? Multiple powerful groups among their species have reached out, trying to form an alliance with us...', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'It will make things a lot easier if we had some local help... plus... you know, you get that little emotional oomph from watching a species aid in its own eradication.', face: 'teasing', then: 'wink' },
    { say: 'One group is pointing an observatory laser at our hull. The flashes decode as a video feed.', face: 'calm' },
    { say: 'Another has one sermon going out on every radio station they own, aimed straight up at us.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'And, um... someone left coloured cards in a field.', face: 'blushing', then: 'blushing', hold: 1600 },
    { say: 'They\'re all marked on the planet at the Directive Desk. Answer whoever you like. Then pick one to side with, out loud, in front of the whole planet.', face: 'happy' },
  ] },

  // ---- once, early: the mate review. Collins's lines (Sep 30 2026), word for word. It leads to
  // the data pad in his quarters, where the candidate's profile is (src/ui/campaignUi.ts). ----
  { id: 'mate-review', moment: 'mate-review', points: { room: 'quarters', label: 'OPEN YOUR QUARTERS' }, beats: [
    { say: 'Good news: it looks like your request for a mate is under review.', face: 'happy', then: ['pensive', 'pout'], hold: 1800 },
    { say: 'You\'re not going to forget about me once you settle down, are you?', face: 'pout', then: 'laughing', hold: 1600 },
    { say: 'I kid, of course. Can you believe early humans actually used their breeding partners for sexual release and companionship?', face: 'teasing', then: 'disgust', hold: 1600 },
    { say: 'They were practically tools for masturbation. Can you believe the indignity, to have your body used like that... and what a waste of time...', face: 'disgust' },
    { say: 'Anyway, you can find the profile of the partner they\'re considering for you on your data pad in your room.', face: 'calm' },
  ] },

  // ---- once, after the mate review: Collins's lines (Sep 30 2026), word for word. The message
  // itself is in his inbox, on the data pad in his quarters, declined on his behalf. ----
  { id: 'catgirl', moment: 'catgirl', points: { room: 'quarters', label: 'SEE YOUR INBOX' }, beats: [
    { say: 'Some horny cat girl dropped in your inbox...', face: 'teasing', then: 'teasing', hold: 1200 },
    { say: 'Don\'t worry, I told her to pound sand... because eww...', face: 'disgust', then: 'disgust', hold: 1400 },
    { say: 'But I\'ve got to admit, I feel bad for them...', face: 'sad', then: 'pensive', hold: 1600 },
    { say: 'They could just engineer males, but apparently that would destroy their \'culture\', whatever that means...', face: 'teasing', then: 'shrug' },
    { say: 'Oh well.', face: 'calm', then: 'shrug' },
  ] },

  // ---- a deployment won ----
  { id: 'won-1', moment: 'won', beats: [
    { say: 'Look at you, clearing districts like you were born holding a flamethrower.', face: 'happy', then: 'wink' },
    { say: 'The Board will send a form letter. I\'ll read it to you in a dramatic voice. Twice, if you\'re good.', face: 'teasing' },
  ] },
  { id: 'won-2', moment: 'won', beats: [
    { say: 'That\'s a whole territory painted maroon. Very festive.', face: 'happy', then: 'laughing', hold: 1800 },
    { say: 'Don\'t let it go to your head. The bugs have cousins. Lots of cousins.', face: 'teasing' },
  ] },
  { id: 'won-3', moment: 'won', beats: [
    { say: 'Clean deployment, zero paperwork errors. Honestly, the paperwork is the part I\'m proudest of.', face: 'happy', then: 'laughing', hold: 1800 },
  ] },
  { id: 'won-4', moment: 'won', points: { room: 'genes', label: 'OPEN THE GENE BAY' }, beats: [
    { say: 'They sent the militia again. Bless them. They really think hats help.', face: 'teasing', then: 'shrug' },
    { say: 'Anyway, you won. Go spend something shiny in the Gene Bay.', face: 'happy' },
  ] },
  { id: 'won-5', moment: 'won', beats: [
    { say: 'You\'re getting scary good at this.', face: 'calm', then: 'pensive', hold: 2200 },
    { say: 'That\'s a compliment. Mostly. Seventy percent compliment.', face: 'teasing', then: 'wink' },
  ] },
  // A sly one (the reveal, DESIGN.md "The reveal"): true, and it reads as a joke about the gut.
  { id: 'won-6', moment: 'won', beats: [
    { say: 'Another city in the asset. It keeps everything, you know. Everything. It\'s a very sentimental organ.', face: 'teasing', then: 'wink' },
    { say: 'Don\'t look at me like that. Read your training module.', face: 'happy' },
  ] },

  // ---- a deployment lost ----
  { id: 'lost-1', moment: 'lost', beats: [
    { say: 'Well. That was a mess.', face: 'teasing', then: 'shrug' },
    { say: 'The bugs are throwing a parade down there. I\'m not saying I watched it. I watched it.', face: 'teasing', then: 'laughing', hold: 1600 },
  ] },
  { id: 'lost-2', moment: 'lost', beats: [
    { say: 'Asset\'s gone, Technician. The culture\'s fine. Your dignity, I\'m still checking.', face: 'teasing', then: 'wink' },
  ] },
  { id: 'lost-3', moment: 'lost', beats: [
    { say: 'Losing is data. That was a lot of data.', face: 'teasing', then: 'laughing', hold: 1800 },
    { say: 'Want to go over it together, or sulk first? Sulking is allowed. I\'ll time it.', face: 'happy' },
  ] },
  { id: 'lost-4', moment: 'lost', points: { room: 'genes', label: 'OPEN THE GENE BAY' }, beats: [
    { say: 'Hey. Chin up. They got lucky, and you got notes.', face: 'calm', then: 'nod' },
    { say: 'There might be something in the Gene Bay that fixes whatever that was.', face: 'happy' },
  ] },

  // ---- lost while the desk is still dark ----
  { id: 'locked-1', moment: 'lost-locked', beats: [
    { say: 'Command still hasn\'t cleared the Directive Desk. They want to see one win first.', face: 'calm', then: 'shrug' },
    { say: 'One. I believe in you. Statistically. Eventually.', face: 'teasing' },
  ] },
  { id: 'locked-2', moment: 'lost-locked', beats: [
    { say: 'Desk\'s still dark. Apparently enthusiasm doesn\'t count as a sanctioned success.', face: 'teasing', then: 'wink' },
    { say: 'I already queued your next drop. Somewhere soft. You\'re welcome.', face: 'happy' },
  ] },
  { id: 'locked-3', moment: 'lost-locked', points: { room: 'genes', label: 'OPEN THE GENE BAY' }, beats: [
    { say: 'Oof. Okay. New rule: we don\'t talk about that one.', face: 'teasing', then: 'laughing', hold: 1800 },
    { say: 'Next drop\'s queued. Win it and Command lets us have the fancy globe. Maybe grab an upgrade first.', face: 'happy' },
  ] },

  // ---- counter-attacks ----
  { id: 'defended-1', moment: 'defended', beats: [
    { say: 'They tried to take it back. Adorable.', face: 'teasing', then: 'laughing', hold: 1600 },
    { say: 'Territory held. I updated the map in a slightly smug font.', face: 'happy' },
  ] },
  { id: 'defended-2', moment: 'defended', beats: [
    { say: 'Counter-attack repelled. Somewhere down there a regional commander is having the worst day of his life.', face: 'happy', then: 'wink' },
  ] },
  { id: 'fell-1', moment: 'fell', beats: [
    { say: 'So, small thing: while you were busy, they took a territory back.', face: 'calm', then: 'shrug' },
    { say: 'Next time the globe blinks orange, maybe answer it.', face: 'teasing' },
  ] },
  { id: 'fell-2', moment: 'fell', beats: [
    { say: 'We lost ground while you were out. The bugs are very proud of themselves.', face: 'sad', then: 'shrug' },
    { say: 'Defend what\'s flashing, and they stop getting ideas.', face: 'calm' },
  ] },

  // ---- the big ones ----
  { id: 'licence-1', moment: 'licence', points: { room: 'board', label: 'SEE THE BOARD' }, beats: [
    { say: 'Technician. The Board approved your procreation licence.', face: 'surprised', then: 'surprised', hold: 1400 },
    { say: 'I\'m happy for you. Genuinely. Go collect it. The office is closed, obviously.', face: 'blushing', then: 'blushing', hold: 1800 },
  ] },
  { id: 'ended-1', moment: 'ended', points: { room: 'comms', label: 'OPEN COMMS' }, beats: [
    { say: 'That\'s it. The planet\'s quiet.', face: 'calm', then: 'pensive', hold: 2600 },
    { say: 'Down here, anyway.', face: 'teasing', then: 'wink' },
    { say: 'I\'ll be here, obviously. Where else would I go?', face: 'sad' },
  ] },

  // ---- he comes aboard from the menu ----
  { id: 'back-1', moment: 'back', beats: [
    { say: 'Oh, you\'re back. I kept your seat warm. Metaphorically. I don\'t have hands. Well, I have hands. They\'re light.', face: 'teasing', then: 'wink' },
  ] },
  { id: 'back-2', moment: 'back', beats: [
    { say: 'Welcome back aboard. Nothing exploded while you were gone. Well. Nothing up here.', face: 'happy', then: 'laughing', hold: 1500 },
  ] },
  { id: 'back-3', moment: 'back', beats: [
    { say: 'There he is. Did you miss me? You can say no. I\'ll log it as yes.', face: 'teasing', then: 'wink' },
  ] },
  { id: 'back-4', moment: 'back', beats: [
    { say: 'Back to work? The bugs certainly didn\'t take the day off.', face: 'calm', then: 'shrug' },
  ] },
  // Collins's line (Sep 30 2026), word for word, typos mended. It implies two things the lore now holds (content/lore/empire.md,
  // 12b): the dead are uploaded and go on talking to their children, and the Ten Commandments matter to the society (the fifth:
  // honour your father and mother, which in the Empire never lapses).
  { id: 'back-5', moment: 'back', beats: [
    { say: 'Your dad sent you another message again...', face: 'teasing', then: 'shrug' },
    { say: 'He\'s been so nosy since he died about getting you a mate...', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'I want to blow him off, but I know, I know... the fifth.', face: 'pout', then: 'shrug' },
  ] },
];

// ---- news from Earth (Collins, Sep 30 2026): the Empire keeps Earth as a zoo it watches for
// fun, and she passes its news on when he comes aboard. The pool lives in the lore book,
// section "Earth news (return greetings)" (content/lore/ship-ai-lorebook.md), one list item a
// line; it grows there with no change of code. Until that section exists, Collins's own line. ----

/** Collins's own example, word for word: the pool when the lore book has none. */
export const EARTH_NEWS_FALLBACK = [
  'Hey, heard the Crusade took back Rome last week from the Caliphate. I can pull up live feeds if you like watching Earth.',
];

/**
 * The Earth news lines of the lore book: the list items under a heading that names "Earth news",
 * up to the next heading of the same or a higher level. Quotes around a line are taken off.
 */
export function earthNewsFrom(lore: string): string[] {
  const lines = String(lore ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{1,6}\s.*earth news/i.test(l));
  if (at < 0) return [];
  const level = (lines[at].match(/^#+/) ?? ['#'])[0].length;
  const out: string[] = [];
  for (let i = at + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) break;
    const m = lines[i].match(/^\s*(?:[-*]|\d+[.)])\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[1].replace(/^["“”']+|["“”']+$/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 8) out.push(text);
  }
  return out;
}

/**
 * HER LINE AS HE WALKS IN (Collins, Oct 2 2026: the pad's part 2, "you turning around and getting up to move into the
 * ship's interface, with the AI character talking to you"). He has set the pad down and crossed to the Directive Desk; the
 * post-deployment report comes up on it and she presents it, one line, by how it went. Short on purpose: her full greeting
 * comes once he is back aboard (greetingFor), after the planet's news. Chosen in turn (reportLine), never twice running.
 */
export const REPORT_LINES: Record<'won' | 'held' | 'lost', GreetBeat[]> = {
  won: [
    { say: 'Report\'s up. Spoiler: you won. I already highlighted the good parts.', face: 'happy' },
    { say: 'Another one for the asset. Paperwork\'s on the desk, still warm.', face: 'teasing' },
    { say: 'Look who\'s walking in like a man who just ate a district.', face: 'teasing', then: 'wink' },
    { say: 'Numbers are in. They look great. I may have rounded up. A little.', face: 'happy', then: 'shrug' },
  ],
  held: [
    { say: 'They tried to take it back. They did not. Report\'s on the desk.', face: 'happy' },
    { say: 'Counter-attack repelled. The locals are going to need a bigger plan.', face: 'teasing', then: 'shrug' },
  ],
  lost: [
    { say: 'Okay. Deep breath. Report\'s on the desk; I filled in the sad parts gently.', face: 'calm' },
    { say: 'Well, that one bit back. Sit, read, and then we try again.', face: 'pensive' },
    { say: 'The asset\'s gone, you\'re not. That\'s the part I care about.', face: 'calm', then: 'nod' },
  ],
};

/** Her line for this report: the next of its list after the last one said (by a counter the caller keeps). */
export function reportLine(outcome: 'won' | 'held' | 'lost', n: number): GreetBeat {
  const list = REPORT_LINES[outcome];
  return list[((n % list.length) + list.length) % list.length];
}
