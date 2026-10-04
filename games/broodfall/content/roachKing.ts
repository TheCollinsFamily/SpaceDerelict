/**
 * THE ROACH KING (Collins, Oct 1 2026): "the core enemy leader is a patriotic upstanding and over the top
 * character ... called the Roach King (you can have the country's flag be the Texas flag with an insect head
 * instead of a star) ... I would not have him come in until a couple missions in though and would come from
 * cut scenes." And: "as far as I know you don't directly interact with anyone".
 *
 * So he is never met. He is the head of the Commonwealth, and the player only ever sees him the way the
 * planet does: his addresses to the nation, which the ship's survey intercepts and plays after a deployment's
 * news (src/ui/roachKing.ts; which one, when: src/meta/roachKing.ts). He never speaks TO the operator; he does
 * not know the operator exists (insects.md 9.1: the Host has the ship on radar and nothing that reaches it).
 *
 * Who he is: content/lore/roach-king.md (lore and voice bible). The shape of him (PROPOSAL, built Oct 1 2026):
 * President Duke Crawley, a royal spare of House Crawley who became a wrestler, then a streamer, then the first
 * male President of the Commonwealth by the widest margin in its history. Wrestling-showman head of state and
 * gremlin streamer at once: he addresses the nation from his gaming den in the Hive House, reads his chat out
 * loud, and ends every address by firing a gold machine gun into the ceiling. An original character: no real
 * person's name, face or likeness.
 *
 * The flag (Collins): the Texas flag's layout with an insect head instead of the lone star. The Commonwealth's
 * flag since the Unification, the Lone Head. Baked: public/media/roach/flag.webp (flat, for the screens) and
 * flag-wave.webp (cloth, for the films).
 *
 * Every shot is one clip of him SPEAKING on camera (image-to-video with sound: tools/media/roachking.ts), so
 * the words below are what he says in the clip, shown as subtitles. A line is at most ~20 words: a clip is 8 s.
 * Words in capitals are stress on the page; the tool lower-cases them for the model.
 */

import type { Scene } from './campaign';

/** A shot of an address: which picture it starts from, what he does, what he says. */
export interface RoachShot {
  /** The clip's id (tools/media/roachking.ts makes `<id>` from still `from`). */
  id: string;
  /** The picture the clip starts from (ROACH_STILLS). */
  from: string;
  /** What moves, for the video model. */
  action: string;
  /** What he says (the subtitle and the speech). Empty: no one speaks (the field sound only). */
  line: string;
  /** He is heard and not seen (off screen). */
  offscreen?: boolean;
}

/**
 * When an address plays (src/meta/roachKing.ts reads these against the campaign):
 *   'address'   the first deployment after which the campaign has 3 deployments (mission 1 is the crash, mission 2
 *               opens the Directive Desk and the factions call; by the third the Host is fielding regulars, so the
 *               head of state goes on the air)
 *   'draft'     3 territories held
 *   'counter'   the colony telegraphs its first counter-attack
 *   'ally'      allied with `faction` and its second beat seen (once per faction: a player who switches allies at the
 *               midpoint can hear him on both)
 *   'stand'     the ally's finale is open (every beat seen), or 8 territories held with no ally
 *   'offline'   the campaign has ended (the finale was taken)
 */
export type RoachWhen = 'address' | 'draft' | 'counter' | 'ally' | 'stand' | 'offline';

export interface RoachAddress {
  id: string;
  when: RoachWhen;
  faction?: 'delegation' | 'faithful' | 'institute';
  /** The card before it: what the ship caught. */
  title: string;
  /** Under the title. */
  small: string;
  shots: RoachShot[];
  /** The last card. */
  end: string;
}

export const ROACH_KING = {
  name: 'PRESIDENT DUKE CRAWLEY',
  known: 'THE ROACH KING',
  channel: 'COMMONWEALTH BROADCAST NETWORK · LIVE FROM THE HIVE HOUSE',
};

/**
 * The pictures his clips start from. `refs`: the earlier pictures it must match (the first is drawn from words;
 * every other one from it, so he is the same man in all of them). Prompts: tools/media/roachking.ts.
 */
export const ROACH_STILLS = ['den', 'close', 'gun', 'rally', 'paper', 'studio', 'call', 'field', 'fieldclose', 'door', 'empty'] as const;
export type RoachStill = (typeof ROACH_STILLS)[number];

export const ROACH_ADDRESSES: RoachAddress[] = [
  { id: 'rk-address', when: 'address', title: 'AN ADDRESS TO THE NATION', small: 'the President of the Commonwealth, live', end: 'THIS HAS BEEN AN ADDRESS TO THE NATION · LONG LIVE THE LONE HEAD', shots: [
    { id: 'rk-a1', from: 'den', action: 'He leans into the camera from behind the cluttered desk, waves both upper arms for quiet, grins.', line: 'My fellow sisters. Your President. The Roach King. Sit down, sit down. You are already sitting. Good.' },
    { id: 'rk-a2', from: 'close', action: 'He talks straight to the camera, glances aside at a monitor, scoffs, looks back.', line: 'Something fell on the suburbs, and it is eating our towns. Chat says it is just a fungus. Chat is WRONG.' },
    { id: 'rk-a3', from: 'close', action: 'He jabs a finger at the camera, nodding hard, very serious.', line: 'So tonight I am sending in the Host. The real Host. The big girls. With the guns.' },
    { id: 'rk-a4', from: 'gun', action: 'He stands up behind the desk, lifts the gold machine gun over his head with two arms and fires bursts into the ceiling; plaster rains down; he whoops.', line: 'This concludes the address!' },
  ] },
  { id: 'rk-draft', when: 'draft', title: 'THE PRESIDENT CALLS UP THE HOME LEVY', small: 'live from the steps of the Hive House', end: 'REPORT TO YOUR BRANCH-HIVE · BRING A SASH', shots: [
    { id: 'rk-d1', from: 'rally', action: 'At the podium he grips it with all four hands and bellows to the crowd; the huge flag ripples behind him; the crowd cheers.', line: 'Every sister with four arms and a pulse, report to your branch-hive. That is the Home Levy. That is YOU.' },
    { id: 'rk-d2', from: 'rally', action: 'He thumps his chest with one fist and points out over the crowd, proud.', line: 'You do not need training. I did not have training. I had heart. And a folding chair.' },
    { id: 'rk-d3', from: 'close', action: 'Back in his den, close, he leans in with a smug grin and wags a finger at the camera.', line: 'And to the Crater Thing, if you are watching: you are MID. Chat, spam it. Mid.' },
  ] },
  { id: 'rk-counter', when: 'counter', title: 'OPERATION TAKE IT BACK', small: 'a special address from the President', end: 'OPERATION TAKE IT BACK · NAMED BY THE PRESIDENT PERSONALLY', shots: [
    { id: 'rk-c1', from: 'den', action: 'He holds up a hand-drawn battle map on a pizza box lid, proudly, and taps it.', line: 'Operation Take It Back. I named it myself. It took four hours. Worth it.' },
    { id: 'rk-c2', from: 'close', action: 'He counts on his fingers of two hands, very earnest.', line: 'The Host is marching on the town the Thing stole. Bells in front, guns behind, me on the stream.' },
    { id: 'rk-c3', from: 'gun', action: 'He jumps onto the desk with the gold machine gun and fires into the ceiling; cans and takeout boxes scatter.', line: 'We are taking it BACK!' },
  ] },
  { id: 'rk-delegation', when: 'ally', faction: 'delegation', title: 'THE PRESIDENT ON THE "FRIENDSHIP" PEOPLE', small: 'live from the Hive House', end: 'THE PRESIDENT REMINDS YOU: THE WHEAT HAS DONE NOTHING TO YOU', shots: [
    { id: 'rk-del1', from: 'paper', action: 'He holds a newspaper up to the camera and shakes it, outraged.', line: 'Somebody cut a love letter to the Crater Thing into my wheat. A mile high. The second comma is a BARN.' },
    { id: 'rk-del2', from: 'close', action: 'He rubs his face with two hands, then glares into the camera.', line: 'These Friendship people want peace. You know what peace is? Losing. Slower.' },
    { id: 'rk-del3', from: 'close', action: 'He points sternly at the camera like a disappointed coach.', line: 'Delegation. Put the mower down. The wheat has a family.' },
  ] },
  { id: 'rk-faithful', when: 'ally', faction: 'faithful', title: 'THE PRESIDENT GOES ON THE HOUR IS NEAR', small: 'simulcast on the Last Hour Radio Network', end: 'THE PRESIDENT IS NOT TAKING QUESTIONS', shots: [
    { id: 'rk-fai1', from: 'studio', action: 'In the radio studio he leans into the big microphone, headphones on, beaming; the preacher beside him nods slowly.', line: 'Big fan of the show. Huge. The Voice says somebody is coming to save us all.' },
    { id: 'rk-fai2', from: 'studio', action: 'He points both upper thumbs at himself, eyebrow antennae raised, delighted.', line: 'Chat, I did the reading. Chapter one is a list of cities. I am pretty sure I am the guy.' },
    { id: 'rk-fai3', from: 'close', action: 'Back in his den, he raises a hand to stop questions, eyes closed, satisfied.', line: 'I will be taking questions. No questions. Thank you.' },
  ] },
  { id: 'rk-institute', when: 'ally', faction: 'institute', title: 'THE PRESIDENT AND HIS NEW ADVISER', small: 'live from the Hive House', end: 'THE PRESIDENT\'S ADVISER DECLINED TO COMMENT · HE WAS IN A MATCH', shots: [
    { id: 'rk-ins1', from: 'call', action: 'He gestures at the young adviser on the big screen beside him, proud, like showing off a new car.', line: 'Got a new adviser. Young guy. Very smart. Plays League of Larvae. Bad at League of Larvae.' },
    { id: 'rk-ins2', from: 'call', action: 'He holds a sheet of paper upside down, squints at it, turns it the right way, shrugs.', line: 'He sent me a table. Expected value. I read it upside down and it still said we win.' },
    { id: 'rk-ins3', from: 'close', action: 'He leans in and whispers loudly to the camera, conspiratorial.', line: 'He keeps asking about an upload. I said, buddy, I upload every night. Six hours. Like and subscribe.' },
  ] },
  { id: 'rk-stand', when: 'stand', title: 'THE LAST STAND', small: 'the President, live from the front', end: 'THE PRESIDENT IS AT THE GATES · SO IS THE THING', shots: [
    { id: 'rk-s1', from: 'field', action: 'On the back of the armoured war beetle he raises the gold machine gun, the flag cape blowing, troops roaring behind him.', line: 'This is it, sisters. The Thing is at the gates. So am I. I am also at the gates.' },
    { id: 'rk-s2', from: 'fieldclose', action: 'He leans toward the camera from the beetle, gruff and serious, smoke drifting past.', line: 'I am not hiding in a bunker. The bunker is full of my merchandise.' },
    { id: 'rk-s3', from: 'field', action: 'He stands tall on the beetle, fires a long burst into the red sky, the troops surge forward past him.', line: 'Come and get some!' },
  ] },
  { id: 'rk-offline', when: 'offline', title: 'THE HIVE HOUSE STREAM', small: 'still live · viewers falling', end: 'THE BROADCAST HAS ENDED', shots: [
    { id: 'rk-o1', from: 'door', action: 'He half rises from his chair and looks over his shoulder at the door, where a red glow pulses under it, then back at the camera, a little unsure.', line: 'Hold on, chat. Something is at the door. Be right back.' },
    { id: 'rk-o2', from: 'empty', action: 'The empty gaming chair slowly turns a little; the monitors keep scrolling; the red glow from the doorway pulses across the floor. Nobody comes back.', line: '' },
  ] },
];

// ---------------------------------------------------------------------------
// OFF THE AIR: THE CENTRAL PLOT (Collins, Oct 4 2026: "I finally threw together the roach king scenes and a final
// mission idea"). His text, verbatim, is in notes/ROACH-KING-2026-10-04.md. Three scenes:
//
//   rk-briefing    an aide tells him the Alliance of Nations has lost another territory. He is not the showman of his
//                  addresses here: he is the one person on the planet who has understood what the war caste is doing
//                  (feeding the thing that grows by what it kills), and nobody will listen.
//   rk-transports  "Before the last message we see the roach king on a vid call with a member of the military caste,
//                  clearly furious": the Host's transports have been sabotaged, and he did it. "If we could have just
//                  one confrontation without the war caste feeding them from the start I think we could win." It is the
//                  reason for the last mission's rules (content/campaign.ts LAST_MISSION).
//   rk-founding    his last message: the speech "from in front of a government looking building with lots of
//                  patriotism", on the founding day of the empire.
//
// These are not addresses he gives the nation (except the last): the ship's survey caught a private line. They are
// Scenes, like the factions' (title; "Speaker: text" lines; a "(direction)" is acted, not said), and each is a FILM
// (content/cutscenes.ts has its shot list: one camera position, one take, as Collins's rules of Oct 4 ask). Until a
// film is baked, the scene is shown as the intercept's transcript (src/ui/roachKing.ts). A spoken line is at most 22
// words (a clip is 8 s): his longer sentences are split, the words kept. Spelling and punctuation are corrected;
// nothing else is changed.
//
// HOW THIS SITS WITH THE REST (my reading; content/lore/roach-king.md "Off the air" has it, for Collins to correct):
// the Commonwealth was founded as an empire of his House (he is "a royal spare of House Crawley"), so its Founding Day
// is "the founding day of the empire" and an "imperial holiday"; the Alliance of Nations is the Commonwealth and the
// other nations of the planet, allied against the asset. In public he is the showman of the addresses above; in private
// he is this man. The older addresses stay as his public face.
// ---------------------------------------------------------------------------

/**
 * When a scene plays (src/meta/roachKing.ts):
 *   'briefing'      after a deployment, once BRIEFING_HELD territories are held and he has introduced himself
 *   'last-call'     when the last mission is launched (the Hive House), before it
 *   'last-address'  after the call, before the last mission: "the last message"
 */
export type RoachSceneWhen = 'briefing' | 'last-call' | 'last-address';

export interface RoachScene {
  /** Its id, and the id of its film (content/cutscenes.ts FILMS). */
  id: string;
  when: RoachSceneWhen;
  /** What the ship caught, over the card and the film. */
  kicker: string;
  /** Where YOKE is rendering it from (her band on the card). */
  source: string;
  /** Under the title. */
  small: string;
  scene: Scene;
  /** The last line of the card. */
  end: string;
}

export const ROACH_SCENES: RoachScene[] = [
  { id: 'rk-briefing', when: 'briefing', kicker: 'INTERCEPTED · THE HIVE HOUSE · NOT FOR BROADCAST', source: 'THE HIVE HOUSE, A PRIVATE LINE · RADIO RELAY · INTERCEPTED',
    small: 'the President is briefed', end: 'THE LINE WAS CLOSED FROM THEIR END',
    scene: { title: 'Another Territory', film: 'rk-briefing', lines: [
      'Aide: Roach King, the Alliance of Nations have lost another territory.',
      'The Roach King: (a hand to his head) Of course they have.',
      'Aide: Every time they make landfall, they have been sending troops at them as soon as they can get there.',
      'The Roach King: Are you fucking kidding me?',
      'The Roach King: So they just send an endless wave of troops to an enemy that appears to grow more powerful the more it kills?',
      'The Roach King: Why don\'t they just batch them? Or better yet, send nothing, and wait until you have enough troops to absolutely kill them?',
      'Aide: Well, we might be able to get the science caste or the royals to do that.',
      'Aide: But the warrior caste have a long tradition of honor.',
      'The Roach King: (both hands over his face) They have a long tradition of being retards, is more like it. They are going to get us all killed.',
    ] } },
  { id: 'rk-transports', when: 'last-call', kicker: 'INTERCEPTED · THE HIVE HOUSE · NOT FOR BROADCAST', source: 'THE HIVE HOUSE, A PRIVATE VIDEO LINE · RADIO RELAY · INTERCEPTED',
    small: 'a call from the Host', end: 'THE CALL ENDS · THE HOST WILL BE LATE',
    scene: { title: 'The Transports', film: 'rk-transports', lines: [
      'General: (furious) The transports have been sabotaged! This is the last fight. We will never make it in time!',
      'The Roach King: You disapprove? Well, too bad! We\'re in this war for the species. It\'s simple numbers. They have more.',
      'The Roach King: And every day I have to make decisions that send hundreds of people like you to their deaths.',
      'The Roach King: If we could have just one confrontation without the war caste feeding them from the start, I think we could win.',
    ] } },
  { id: 'rk-founding', when: 'last-address', kicker: 'ALL BANDS · LIVE FROM THE STEPS OF THE HIVE HOUSE', source: 'COMMONWEALTH TELEVISION, EVERY BAND AT ONCE · INTERCEPTED',
    small: 'the President\'s Founding Day address', end: 'FOUNDING DAY · THE HIVE HOUSE',
    scene: { title: 'Founding Day', film: 'rk-founding', lines: [
      'The Roach King: We can\'t be consumed by our petty differences anymore. We will be united in our common interests.',
      'The Roach King: Perhaps it\'s fate that today is the founding day of the empire, and you will once again be fighting for our freedom.',
      'The Roach King: Not from tyranny, oppression, or persecution, but from annihilation.',
      'The Roach King: We\'re fighting for our right to live, to exist.',
      'The Roach King: And should we win the day, the founding day will no longer be known as an imperial holiday.',
      'The Roach King: But as the day when the world declared in one voice:',
      'The Roach King: We will not go quietly into the night! We will not vanish without a fight!',
      'The Roach King: We\'re going to live on! We\'re going to survive!',
      'The Roach King: Today we celebrate our Independence Day!',
    ] } },
];
