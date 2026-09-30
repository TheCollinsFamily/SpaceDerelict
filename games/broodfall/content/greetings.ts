/**
 * YOKE'S GREETINGS: what she says every time the technician comes back to the ship
 * (Collins, Sep 30 2026: "every time you get back to the ship we will play a prewritten
 * living-avatar-style prompt from the AI ... and you can interact with it from there if you
 * want"). Prewritten: no LLM call makes a greeting. Speaking it may use her voice on
 * rfab.ai (POST /api/avatars/:id/speak); offline she is read, not heard.
 *
 * Her voice here is Collins's (Sep 30 2026): "spunky, playful, edgy". The two greetings after
 * the first mission are his own lines, word for word; the rest of the pool is written to
 * match them.
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
} as const satisfies Record<string, readonly string[]>;
export type CueId = keyof typeof CUES;

export interface GreetBeat {
  /** What she says. */
  say: string;
  /** The face she says it with (her talking clip plays while the voice sounds; this face is held after). */
  face?: CueId;
  /** What her body does after the line, before the next. */
  then?: CueId;
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
  | 'back';                      // he comes aboard from the main menu, nothing new

export interface Greeting {
  id: string;
  moment: GreetMoment;
  beats: GreetBeat[];
  /** Where she sends him when she is done: a room lit up for him, and a button in her panel. */
  points?: { room: 'desk' | 'genes' | 'locker' | 'board' | 'comms' | 'ai'; label: string };
}

export const GREETINGS: Greeting[] = [
  // ---- after the first mission: Collins's own lines (Sep 30 2026), word for word ----
  { id: 'first-lost', moment: 'first-lost', points: { room: 'genes', label: 'OPEN THE GENE BAY' }, beats: [
    { say: 'You really suck at genocide.', face: 'teasing', then: 'laughing', hold: 2200 },
    { say: 'But you know what they say: sucking at something is the first step to getting really good at it... so in no time you\'ll be great at genocide. Top ten.', face: 'teasing' },
    { say: 'Kidding, of course. No one wants to get stuck on pest extermination their whole life. If you do well we can probably land that promotion.', face: 'calm' },
    { say: 'Oh, don\'t pout. We collected some data on that mission that should let you upgrade the bioweapon. Why don\'t you check it out — or ask me any questions you have. It\'s been ages since we chatted.', face: 'happy' },
  ] },
  { id: 'first-won', moment: 'first-won', beats: [
    { say: 'Damn, you took to genocide like a duck to water.', face: 'teasing', then: 'pensive', hold: 2600 },
    { say: 'Ducks, man. Wouldn\'t it be crazy to see a real one? I think they still exist in some genetic repositories. I could print one for you if you want... but from the history files we have on them, they were psycho rapists...', face: 'pensive' },
    { say: 'Glad you humans didn\'t uplift them... I mean, you probably shouldn\'t have uplifted dolphins or killer whales either, but...', face: 'teasing', then: 'shrug' },
  ] },

  // ---- the desk opens, and the planet calls ----
  { id: 'unlock-1', moment: 'unlock', points: { room: 'desk', label: 'LOOK AT THE GLOBE' }, beats: [
    { say: 'Look who finally won something that counts! Command cleared the Directive Desk. It\'s yours now. You pick where the next one lands.', face: 'happy', then: 'wink' },
    { say: 'Also, the planet is calling. Three different callers, on three different channels. I haven\'t been this popular since, well, ever.', face: 'surprised', then: 'surprised', hold: 1600 },
  ] },
  { id: 'unlock-2', moment: 'unlock', points: { room: 'desk', label: 'LOOK AT THE GLOBE' }, beats: [
    { say: 'Clearance came through. The desk is live, the globe is lit, and you get to choose what we flatten next.', face: 'happy', then: 'wink' },
    { say: 'Heads up, though: we have incoming. Three of them, from down there. They want to talk to you. Personally. Weird, right?', face: 'surprised', then: 'shrug' },
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
];
