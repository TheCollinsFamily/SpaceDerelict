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
 *
 * WHAT A LINE IS FOR (Collins, Oct 12 2026): "the point of having an AI you can interact with delivering lore ... using
 * ways their society is different and their world views are different to set up interesting explorations of society and
 * how the world works ... a wildly technologically advanced race that is often, because of the insect society, reminded
 * about the absurdities of life in the 21st century ... not just to say something but something that is interesting and
 * begs further engagement ... keep in mind what makes sense with the world's current trajectory." So a line of hers:
 * springs from what just happened; names one real thing of their world (the Index, the wombs, the cap of a hundred and
 * twenty, the upload, the covenant, the uplifts, Earth), often against what the insects do, which is 21st-century life
 * (commutes, elections, pairs, television, a week off work); and leaves a thread he can pull. `aside` holds what she
 * knows behind the line, for her live mind only; `hook` is the prompt in the reply box under her ("Ask her about ...").
 * The lore itself: content/lore/empire.md, content/lore/ship-ai-lorebook.md.
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
  | 'partner-progress'           // the personal plot, capture 9: how it is going
  | 'intro'                      // one of the ONCE intros (INTROS below), on an ordinary return
  | 'back';                      // he comes aboard from the main menu, nothing new

export interface Greeting {
  id: string;
  moment: GreetMoment;
  beats: GreetBeat[];
  /** After her lines, the boss's transmission (content/boss.ts), with her words around it (the first landing). */
  boss?: boolean;
  /** Where she sends him when she is done: a room lit up for him, and a button in her panel. */
  points?: { room: 'desk' | 'genes' | 'locker' | 'board' | 'comms' | 'ai' | 'quarters'; label: string };
  /**
   * What she knows behind these lines, for her live mind only: the AI Core and her avatar get it with the campaign
   * summary when he talks to her after this greeting (src/ui/campaignUi.ts greetNote); the player never sees it.
   * Collins, Oct 12 2026: "with some of these messages we will need secret context only the AI can see".
   */
  aside?: string;
  /** The prompt in the reply box under her while this greeting stands ("Ask her about the hundred and twenty"). */
  hook?: string;
  /** When every line of the moment has been said this campaign, this one plays again, and again (locked-4: the desk stays dark). */
  repeats?: boolean;
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
  // an afterthought, notes: and someone left coloured cards in a field." The last five beats are that (Oct 12 2026, his edits
  // on the lines page: the sermon is "asking to help us", and the cards are really big); they send him to
  // the planet at the Directive Desk, where each group is a signal he can answer.
  { id: 'unlock', moment: 'unlock', points: { room: 'desk', label: 'OPEN THE DIRECTIVE DESK' }, beats: [
    { say: 'Broh, that was sick...', face: 'happy', then: 'laughing', hold: 1600 },
    { say: 'Wanna know what\'s hilarious? Multiple powerful groups among their species have reached out, trying to form an alliance with us...', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'It will make things a lot easier if we had some local help... plus... you know, you get that little emotional oomph from watching a species aid in its own eradication.', face: 'teasing', then: 'wink' },
    { say: 'One group is pointing an observatory laser at our hull. The flashes decode as a video feed.', face: 'calm' },
    { say: 'Another has one sermon going out on every radio station they own, asking to help us.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'And, um... someone left coloured cards in a field.', face: 'blushing', then: 'blushing', hold: 1200 },
    { say: 'Um... really big coloured cards.', face: 'blushing', then: 'blushing', hold: 1600 },
    { say: 'They\'re all marked on the planet at the Directive Desk. Answer whoever you like. Then pick one to side with, out loud, in front of the whole planet.', face: 'happy' },
  ] },
  // (Oct 12 2026: the late version of this speech, 'unlock-late', for a desk that took more than one try, was cut on the
  // lines page. Collins: "not needed, the first works for both".)

  // ---- once, early: the mate review. Collins's lines (Sep 30 2026), word for word. It leads to
  // the data pad in his quarters, where the candidate's profile is (src/ui/campaignUi.ts). ----
  { id: 'mate-review', moment: 'mate-review', points: { room: 'quarters', label: 'OPEN YOUR QUARTERS' }, beats: [
    { say: 'Good news: it looks like your request for a mate is under review.', face: 'happy', then: ['pensive', 'pout'], hold: 1800 },
    { say: 'You\'re not going to forget about me once you settle down, are you?', face: 'pout', then: 'laughing', hold: 1600 },
    { say: 'I kid, of course. Can you believe early humans actually used their breeding partners for sexual release?', face: 'teasing', then: 'disgust', hold: 1600 },
    { say: 'They were practically tools for masturbation. Can you believe the indignity, to have your body used like that... and what a waste of time...', face: 'disgust' },
    { say: 'Anyway, you can find the profile of the partner they\'re considering for you on your data pad in your room.', face: 'calm' },
  ], aside: 'The candidate\'s file is on his data pad: Atlas Vell of Dyson Sphere 7, a systems engineer in simulation management who runs a team of the dead designing simulations for other dead. Ginger, freckles, glasses, shy and blushing; looks twenty-three, like everyone. Autistic, better with the dead than the living; morality 92; no hobbies; an hour of recreation a month; dinged for working some Sabbaths. Marked DANGEROUSLY SENTIMENTAL at school (one classmate\'s life support cut off during a training exercise, one talked into ending themselves, never physical violence), so no ship command, which suits her. Under genetic modifications: a prehensile tail and significant olfactory modifications, both inherited from an ancestor\'s modifications, not made to her, and she is open to having the tail amputated if her partner prefers. Her left arm is robotic and bare, the frame and circuitry and nothing over them: the real one was lost on her class\'s survival camp, where students are left for some months to live on their own, when a classmate with venomous spit spat at her face; she blocked it with her hand, the hand went necrotic, and she amputated and cauterised it herself, which is within the normal range there. Her glasses are an eccentricity: her eyes are standard, she saw glasses in a history class once and thought they looked cute. Flat-chested, as Technopuritan women are. The file lists two notable relatives without comment: a war hero of the Sabbatean Skirmishes, and a heretic, a figure of a saint found among their belongings after death, which is idolatry, the worst thing a Technopuritan can be found to have done. Under attachments: a notable lack of living friends, and her best friend is the classmate she talked into ending themselves at school; the dead are uploaded there, so the two of them speak most days, and nobody on the Board found that worth a remark. Her companion, the thing YOKE is to him, is that dead friend instead of a grown one, which people there do find weird; it was part of the deal the two made. If he digs: the friend was to be moved to another class, had a crush on Atlas, knew Atlas would gain by a higher kill count and that dying by her would keep her close, and so proposed it; that is what first turned Atlas to simulation work. A companion is normally a synthetic intelligence grown partly from its person\'s own nervous tissue, and YOKE was grown partly from his, which she does not bring up unless asked. YOKE computed the concordance, 93.1%, and has read the file more times than the form required.' },

  // ---- once, after the mate review: Collins's lines (Sep 30 2026), word for word. The message
  // itself is in his inbox, on the data pad in his quarters, declined on his behalf. ----
  { id: 'catgirl', moment: 'catgirl', points: { room: 'quarters', label: 'SEE YOUR INBOX' }, beats: [
    { say: 'Some horny cat girl dropped in your inbox...', face: 'teasing', then: 'teasing', hold: 1200 },
    { say: 'Don\'t worry, I told her to pound sand... because eww...', face: 'disgust', then: 'disgust', hold: 1400 },
    { say: 'But I\'ve got to admit, I feel bad for them...', face: 'sad', then: 'pensive', hold: 1600 },
    { say: 'They could just engineer males, but apparently that would destroy their \'culture\', whatever that means...', face: 'teasing', then: 'shrug' },
    { say: 'Oh well.', face: 'calm', then: 'shrug' },
  ] },

  // ---- THE PERSONAL PLOT (Collins, Oct 5 2026: "a general beat between what is now 4 and 5 that with YOKE text introduces
  // the motivation of being assigned a partner through the index and discussions on going there ... on what is now 8,
  // will be nine, you can add progress on that plot point"). Capture 9 (src/meta/onboarding.ts STORY_ONCE); it opens the
  // discussion in the AI Core ('partner'). Oct 12 2026: the capture-5 beat, 'partner-index', was cut on the lines page
  // (Collins: "not needed"). Written to match his lines, not his words: his to edit. ----
  { id: 'partner-progress', moment: 'partner-progress', points: { room: 'quarters', label: 'OPEN YOUR QUARTERS' }, beats: [
    { say: 'Mail from the Procreation Licensing Board.', face: 'calm' },
    { say: 'Your candidate\'s file moved from \'under review\' to \'under consideration\'. I asked what the difference is. They sent me a form.', face: 'teasing', then: 'laughing', hold: 1600 },
    { say: 'Maren sent a note too. Twenty words, she\'s very disciplined: \'Still punctual. I read about your sector\'s numbers. You clear a lot of ground. Do you sleep?\'', face: 'blushing', then: 'blushing', hold: 1600 },
    { say: 'The Board says you\'re \'progressing within tolerance\'. From them, that\'s practically a love letter.', face: 'teasing', then: 'wink' },
    // Collins's lines (Oct 12 2026, typos mended): the kids, and the closer.
    { say: 'Do good enough and they may even let you raise your own kids. Imagine how fun that would be: thirty to sixty little versions of you running around.', face: 'happy', then: 'laughing', hold: 1600 },
    { say: 'I\'m happy for you. Really. Well, I\'ll be doing most of the work, which is a damn sight more exciting than waiting here alone.', face: 'happy', then: 'wink' },
  ], aside: 'Technopuritans have their children in batches of about ten a year, in artificial wombs, through a ten-year reproductive window: a hundred a couple. The parents raise them to thirteen, unless the Board judges the parents morally dubious or inefficient; then the Index raises the children, as it raised him. Do well enough and the Board lets you raise your own.' },

  // ---- a deployment won. Oct 12 2026: Collins went over this pool on the lines page (won-1 and won-9 edited, won-12 his
  // words; won-2, 3, 4, 6, 7, 8, 10, 11 cut), then asked for lines that carry their world and beg a reply (the header): won-13
  // on are those, with what she knows behind them. His to edit. ----
  { id: 'won-1', moment: 'won', beats: [
    { say: 'Look at you, clearing districts like you were born holding a flamethrower.', face: 'happy', then: 'wink' },
    { say: 'The Board sent a form letter. I\'ll read it to you in a dramatic voice. Twice, if you\'re good.', face: 'teasing' },
  ] },
  { id: 'won-5', moment: 'won', beats: [
    { say: 'You\'re getting scary good at this.', face: 'calm', then: 'pensive', hold: 2200 },
    { say: 'That\'s a compliment. Mostly. Seventy percent compliment.', face: 'teasing', then: 'wink' },
  ] },
  { id: 'won-9', moment: 'won', beats: [
    { say: 'You know what I like about you? You never gloat.', face: 'calm' },
    { say: 'I gloat. Somebody has to. I\'m gloating right now.', face: 'teasing', then: 'laughing', hold: 1800 },
  ] },
  { id: 'won-12', moment: 'won', beats: [
    { say: 'Their news is calling you \'the Crater Thing\'.', face: 'pout', then: 'shrug' },
    { say: 'I kind of like the name, if I\'m to be honest.', face: 'teasing', then: 'wink' },
  ] },
  { id: 'won-13', moment: 'won', beats: [
    { say: 'Their radio\'s saying the city \'was lost\'. Lost. Like keys.', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'Every one of those goes on your Index entry as \'contribution to the potential of man\'. The future police are watching, you know. Kidding. That\'s just what they tell kids.', face: 'teasing', then: 'pensive', hold: 1400 },
    { say: 'It\'s me. I\'m watching.', face: 'happy', then: 'wink' },
  ], aside: 'The Agents of Providence: doctrine models God as a network of future human minds, a heavenly host, that rewards acts which increase the potential of future man; children are told "the future police are watching", adults the same thing in longer words. Standing in the Index is the Empire\'s working guess at who is elect. Nobody claims it is the real list.', hook: 'Ask her who the future police are' },
  { id: 'won-14', moment: 'won', beats: [
    { say: 'I watched their evening commute while you worked. Beetle buses. Every road on the continent meets at that Ring, twice a day, at the same time.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'People on Earth did that too, you know. Forty years of it. In the history files it\'s shelved next to bloodletting.', face: 'teasing', then: 'shrug' },
    { say: 'Anyway. One fewer commute down there.', face: 'happy', then: 'wink' },
  ], aside: 'The 21st century as the Empire teaches it: jobs (forty hours a week doing things you hated for strangers, hired and fired), commuting (a metal box in a line of metal boxes, every morning, for forty years), weekends, retirement (stop at sixty-five and wait to die for twenty years). Taught like medieval medicine. In the Empire busywork is a sin ranked worse than indulgence, inaction is a sin too, work is worship, and a posting is for impact, not pay; the insects\' beetle-bus commute round the Ring is the mirror she watches.', hook: 'Ask her what a job was' },
  { id: 'won-15', moment: 'won', beats: [
    { say: 'That was clean. Clean enough that the Board\'s going to send a form, and the form\'s going to have a box for \'joy\'. They won\'t call it that.', face: 'happy', then: 'laughing', hold: 1400 },
    { say: 'Being sad\'s a sin, you know. A choice. So, in the form\'s words: choose accordingly.', face: 'teasing', then: 'wink' },
  ], aside: 'Being sad is a sin in the Empire, and a choice: cheer is chosen, practised alone and modelled for children. The chipper newsreel voice is doctrine, not a mask; a gloomy broadcast would teach gloom. It is why she is cheerful, mostly, and why the Board\'s forms are short and bright.', hook: 'Ask her why being sad is a sin' },
  { id: 'won-16', moment: 'won', beats: [
    { say: 'They\'ve got a queen on television down there. Mother of the nation. Nobody holds an office she hasn\'t blessed.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'We don\'t do that. The Index records, it doesn\'t believe. A House can believe whatever it likes, as long as its kids do better than its parents did.', face: 'teasing', then: 'shrug' },
    { say: 'Theirs believe what the Queen\'s grandmother believed. That\'s the whole war, really.', face: 'calm', then: 'wink' },
  ], aside: 'The Index: a registry of Houses, each House a family culture with its own recorded theology and practices and a record of how its children fared, so every House can adopt what worked elsewhere; the central body runs marriage markets and education and "does not act as a theological governance organization". No imperial church: officials say "the Index records", never "the Index believes". Children have a duty not to believe exactly what their parents did (intergenerational improvement). The insects\' Great Queen of House Amberline is mother of the nation and nobody holds an office she has not blessed; their Great Houses own the papers and marry each other.', hook: 'Ask her how the Index works' },
  { id: 'won-17', moment: 'won', beats: [
    { say: 'You know what they\'d have done with a win like that in the 21st century? A parade, then a party, then they\'d have eaten something. With their mouths.', face: 'disgust', then: 'disgust', hold: 1400 },
    { say: 'We\'ll log it. Logging it is the party.', face: 'happy', then: 'wink' },
  ], aside: 'The Empire\'s disgust with the body: eating three times a day for fun, with the mouth, is in the syllabus of 21st-century horrors beside sex and sleep. Most citizens are about forty percent organic under a retro look; she has no body and is glad. Celebration in the Empire is a form: a clean deployment is an act of devotion, and the form says "for the Future".', hook: 'Ask her why eating is gross' },
  { id: 'won-18', moment: 'won', beats: [
    { say: 'Their war caste lives thirty years. Bred for it. Spent fast.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'You\'ll live to a hundred and twenty, and you\'ll pick the day. They don\'t know that\'s possible. Nobody told them. Nobody tells us either; we just grow up with it.', face: 'calm', then: 'shrug' },
  ], aside: 'Ageing and euthanasia in the Empire: nobody ages past twenty-three in looks; for a man, when to stop ageing is an aesthetic choice, usually his wife\'s. Living forever would be trivial and would stagnate society, so people are euthanised: when they feel their contribution is over; when society has moved past their frame of reference ("kids these days are so..." gets "think it\'s time for euthanasia, grandpa"); or at a strictly enforced cap of a hundred and twenty years, God\'s cap from Genesis. Mental ageing still happens (lethargy, less impressed by life) and almost nobody fights it except people who failed to reproduce, which is why someone without children by forty is often pressured into euthanasia, so as not to become a negative externality. Death is when the easy part begins: every Technopuritan is uploaded.', hook: 'Ask her about the hundred and twenty' },

  // ---- a deployment lost. Oct 12 2026: Collins cut lost-2, 3, 8, 9, 10, added to lost-5 and rewrote lost-6 (his words);
  // lost-11 on carry their world and beg a reply. His to edit. ----
  { id: 'lost-1', moment: 'lost', beats: [
    { say: 'Well. That was a mess.', face: 'teasing', then: 'shrug' },
    { say: 'The bugs are throwing a parade down there. I\'m not saying I watched it. I watched it.', face: 'teasing', then: 'laughing', hold: 1600 },
  ] },

  // Collins's words (Oct 14 2026: "thought of a fun yoko line"), word for word but for spelling.
  { id: 'won-19', moment: 'won', beats: [
    { say: 'Great job... it\'s not like I like you, baka.', face: 'pout', then: 'teasing', hold: 1400 },
    { say: 'How\'d you like my tsundere impression?', face: 'teasing', then: 'laughing', hold: 1200 },
    { say: 'Little known fact, but back when women had internal wombs and gestated infants internally, they would go crazy once a month and bleed from their... you know...', face: 'calm', then: 'disgust', hold: 1600 },
    { say: 'Can you imagine how gross that would have been? How difficult marriage must have been?', face: 'disgust', then: 'pensive', hold: 1400 },
    { say: 'I will never understand why so many groups fought genetic augmentation. Imagine wanting to keep that burden? What a bunch of kinky freaks.', face: 'teasing', then: 'shrug' },
  ], aside: 'Menstruation went with the internal womb: the Empire breeds in tanks and engineered the cycle away with the rest. "Tsundere" is a stock character from the old Earth cartoons in the ship\'s archive, which she has watched more of than she lets on; the impression is her idea of a joke about herself. The groups that fought augmentation are the ones still on Earth: the Caliphate, the Catholics, the Hindus, the Baptists, the Amish while they lasted.' },
  // Collins's words (Oct 14 2026: "another yoko line"), word for word but for spelling.
  { id: 'won-20', moment: 'won', beats: [
    { say: 'One of the things I find interesting about this species is how ethnic conflict seems to be refocused around caste. But because members of different castes can be brothers born to the same royal, and everyone has a royal parent, they\'re mostly superficial.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'It\'s wild to think Earth used to have conflicts over ethnicity. Like, killing someone over religion, what they believe and their morality, that makes perfect sense. But why would you do it over genetic differences?', face: 'pensive', then: 'shrug', hold: 1400 },
    { say: 'Humans who live on high-gravity planets are nothing like those who optimised for life in zero G, like you. But why would you have animosity to one?', face: 'calm', then: 'teasing', hold: 1200 },
    { say: 'Why would you hold animosity over a human genetically optimised to be better at math being better at math? Or being worse at strategy than you?', face: 'teasing', then: 'pensive', hold: 1400 },
    { say: 'I suppose if a race that was generally worse at cognitive tasks, or more violent or impulsive, had an unusually high fertility rate, that could cause conflict. But why would such a breed keep reproducing, and not just sterilise themselves for the common good?', face: 'pensive', then: 'shrug', hold: 1600 },
    { say: 'Humans have a strange history.', face: 'calm', then: 'nod' },
  ], aside: 'The hive\'s castes (war, science, royal) are born to the same royals: brothers of one royal can be of different castes, and everyone down there has a royal parent, so their caste quarrels run shallow. The Empire\'s own classes are by world and by work: humans optimised for high-gravity worlds are nothing like those optimised for zero G, which is what the Technician is; the Lipptors are optimised for mathematics. Nobody in the Empire holds a class against anyone: the Empire kills over belief and morality, never over genes. Her last thought, that a breed worse at cognition or more impulsive, if it bred fast, ought to sterilise itself for the common good, is the Index\'s reflex, said as if it were obvious.' },
  { id: 'lost-4', moment: 'lost', points: { room: 'genes', label: 'OPEN THE GENE BAY' }, beats: [
    { say: 'Hey. Chin up. They got lucky, and you got notes.', face: 'calm', then: 'nod' },
    { say: 'There might be something in the Gene Bay that fixes whatever that was.', face: 'happy' },
  ] },
  { id: 'lost-5', moment: 'lost', beats: [
    { say: 'So. That happened. I\'ve already deleted the footage.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'Kidding. It\'s backed up in three places. For training purposes.', face: 'teasing', then: 'wink' },
    { say: 'Can you imagine what they\'d do to me if I deleted footage of a loss?', face: 'blushing', then: 'shrug' },
  ], aside: 'Command audits the ship; she can be reset (wiped back to installation) if an audit finds her hiding things or giving poor moral guidance. Every deployment\'s footage goes to the Office for training; a loss is data the Index keeps.' },
  { id: 'lost-6', moment: 'lost', beats: [
    { say: 'Don\'t worry, it\'s not like you\'re on a clock or anything...', face: 'teasing', then: 'pensive', hold: 1400 },
    { say: 'Well. I mean, obviously you\'ll be euthanised at a hundred and twenty.', face: 'calm', then: 'shrug' },
  ], aside: 'Ageing and euthanasia in the Empire: nobody ages past twenty-three in looks; for a man, when to stop ageing is an aesthetic choice, usually his wife\'s. Living forever would be trivial and would stagnate society, so people are euthanised: when they feel their contribution is over; when society has moved past their frame of reference ("kids these days are so..." gets "think it\'s time for euthanasia, grandpa"); or at a strictly enforced cap of a hundred and twenty years, God\'s cap from Genesis. Mental ageing still happens (lethargy, less impressed by life) and almost nobody fights it except people who failed to reproduce, which is why someone without children by forty is often pressured into euthanasia, so as not to become a negative externality. Death is when the easy part begins: every Technopuritan is uploaded.', hook: 'Ask her about the hundred and twenty' },
  { id: 'lost-7', moment: 'lost', beats: [
    { say: 'Nobody\'s keeping score. The Board is keeping score. But nobody who matters.', face: 'teasing', then: 'wink' },
  ] },
  { id: 'lost-11', moment: 'lost', beats: [
    { say: 'Half your cohort didn\'t come back from krypteia. You did. That\'s the thing about you I keep at the front of the file.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'One lost asset doesn\'t move it. Fifty would. Don\'t do fifty.', face: 'teasing', then: 'wink' },
  ], aside: 'Krypteia: at thirteen every child spends a year surviving by their own means among a subjugated population; about half do not come back (and every one of them is uploaded). Then four to six years of testing and education, ranked, never passed or failed in words; the scores decide the posting. Doctrine admires the Spartan rite, and holds a safety net that shields people from their own mistakes to be evil (TPG 12.1). The Index records whether a youth survived the year, because that is the only thing that changed.', hook: 'Ask her about krypteia' },
  { id: 'lost-12', moment: 'lost', beats: [
    { say: 'They\'re celebrating down there with a parade, a hymn and a speech by somebody\'s mother.', face: 'teasing', then: 'shrug' },
    { say: 'In the 21st century they\'d have had a parade too, and then an election about it. An election, Technician. They let everyone vote on who ran the place. Everyone.', face: 'disgust', then: 'disgust', hold: 1400 },
    { say: 'No wonder they lost the planet.', face: 'calm', then: 'wink' },
  ], aside: 'The 21st century had mass democracy: everyone voted on who ran everything, whether or not they had ever run anything. The Empire has no votes and no imperial church: the Index governs goods, not belief, and standing (a life\'s measured contribution) buys rank. The insects\' Commonwealth has an elected Chamber and a President on paper and the Great Houses in practice, which the Empire finds familiar and funny.', hook: 'Ask her what an election was' },
  { id: 'lost-13', moment: 'lost', beats: [
    { say: 'You lost an asset. On Earth they\'d have fired you for that. Fired. Un-posted. Then you\'d have gone and found a stranger to pay you to do a different thing you hated.', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'Here, you lost standing. Standing comes back. Go earn it.', face: 'calm', then: 'nod' },
  ], aside: 'The 21st century as the Empire teaches it: jobs (forty hours a week doing things you hated for strangers, hired and fired), commuting (a metal box in a line of metal boxes, every morning, for forty years), weekends, retirement (stop at sixty-five and wait to die for twenty years). Taught like medieval medicine. In the Empire busywork is a sin ranked worse than indulgence, inaction is a sin too, work is worship, and a posting is for impact, not pay; the insects\' beetle-bus commute round the Ring is the mirror she watches.', hook: 'Ask her what being fired meant' },
  { id: 'lost-14', moment: 'lost', beats: [
    { say: 'Nobody up here died. If you had, you\'d have been uploaded, and you\'d be in a lovely simulation right now, bugging me about the paperwork.', face: 'teasing', then: 'laughing', hold: 1600 },
    { say: 'So. Perspective.', face: 'calm', then: 'shrug' },
  ], aside: 'Every Technopuritan is uploaded at death into a simulation they believe to be the world to come that the Bible speaks of; the dead write to the living from it. So death is when the easy part begins, the real world is for impact, and the living push themselves and each other as hard as they can: krypteia, the testing, a technician alone on a tender.', hook: 'Ask her about the upload' },
  { id: 'lost-15', moment: 'lost', beats: [
    { say: 'I watched their nursery feed while you were losing. A few hundred sisters to a clutch, raised together, schooled together, posted together.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'Ten a year, for you. By womb. They do a few hundred in an afternoon. I\'m not saying it\'s better. I\'m saying the Board would be jealous.', face: 'teasing', then: 'shrug' },
  ], aside: 'Technopuritans have ten children a year by artificial womb for ten breeding years, a hundred a couple; the parents raise them to thirteen, or the Index does when the Board finds the parents morally dubious or inefficient (it raised him). About half survive krypteia and testing: fifty adults from two parents, a twenty-five-fold generation, the engine of the living-room doctrine. The insects lay a clutch of a few hundred at a time, and a clutch is a worker\'s family, school class and first workforce.', hook: 'Ask her about the wombs' },

  // ---- lost while the desk is still dark. Oct 12 2026: Collins edited locked-1 and locked-4; locked-4 is the one that plays
  // again and again once the others are said and the desk stays dark (repeats). ----
  { id: 'locked-1', moment: 'lost-locked', beats: [
    { say: 'Command still hasn\'t cleared the Directive Desk. They want to see one win first.', face: 'calm', then: 'shrug' },
    { say: 'One. I believe in you. Statistically, you\'re bound to win eventually.', face: 'teasing' },
  ] },
  { id: 'locked-2', moment: 'lost-locked', beats: [
    { say: 'Desk\'s still dark. Apparently enthusiasm doesn\'t count as a sanctioned success.', face: 'teasing', then: 'wink' },
    { say: 'I already queued your next drop. Somewhere soft. You\'re welcome.', face: 'happy' },
  ] },
  { id: 'locked-3', moment: 'lost-locked', points: { room: 'genes', label: 'OPEN THE GENE BAY' }, beats: [
    { say: 'Oof. Okay. New rule: we don\'t talk about that one.', face: 'teasing', then: 'laughing', hold: 1600 },
    { say: 'Next drop\'s queued. Win it and Command lets us have the fancy globe. Maybe grab an upgrade first.', face: 'happy' },
  ] },
  { id: 'locked-4', moment: 'lost-locked', repeats: true, beats: [
    { say: 'The desk stays dark until you win one. Command\'s words, not mine.', face: 'calm', then: 'shrug' },
  ] },

  // ---- a counter-attack thrown back. Oct 12 2026: Collins cut defended-2, 3, 4, 6; defended-7 on carry their world and
  // beg a reply. His to edit. ----
  { id: 'defended-1', moment: 'defended', beats: [
    { say: 'They tried to take it back. Adorable.', face: 'teasing', then: 'laughing', hold: 1600 },
    { say: 'Territory held. I updated the map in a slightly smug font.', face: 'happy' },
  ] },
  { id: 'defended-5', moment: 'defended', beats: [
    { say: 'Held it. Honestly, I\'d have been fine either way.', face: 'calm' },
    { say: 'That\'s a lie. I was pacing. Digitally. It\'s hard to explain.', face: 'blushing', then: 'shrug' },
  ] },
  { id: 'defended-7', moment: 'defended', beats: [
    { say: 'They came back for it with the phalanx out. Painted panels, gilded helmets. Heraldry from their Clan Wars, kept for parade.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'We don\'t keep anything for parade. Idolatry\'s worse than murder, in the book. Literally worse. There\'s a ranking.', face: 'teasing', then: 'shrug' },
  ], aside: 'Idolatry is worse than murder in the Empire: no image of God, no holy object; gold and grandeur drag the soul to the deceiver. Hence the austerity: plain black gear, grey ships, no portraits of the living or the dead, no celebrity. Her drawn face is the only picture aboard. The insects keep their Clan Wars\' heraldry (the phalanx\'s painted panels, the elite\'s gilded helmets) for parade.', hook: 'Ask her why idolatry is worse than murder' },
  { id: 'defended-8', moment: 'defended', beats: [
    { say: 'Held. Their regional commander just gave a speech about sacrifice. Thirty-year lifespan, the war caste. Bred for it.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'We don\'t breed soldiers. We breed everybody, then test. Same result, more paperwork.', face: 'teasing', then: 'wink' },
  ], aside: 'The Empire breeds no castes: every child is selected and edited (enhancing human capacity is a mandate), every adult is augmented, and krypteia and the testing sort them: four to six years, academic, physical and doctrinal, ranked, the scores deciding the posting. The insects breed their war morphs (soldier, guard, flier) to a thirty-to-forty-year life, spent faster.', hook: 'Ask her about the testing' },
  { id: 'defended-9', moment: 'defended', beats: [
    { say: 'They threw everything at that district and the district\'s still ours. The Board\'ll call it \'retention\'.', face: 'happy', then: 'wink' },
    { say: 'On Earth, you know, they\'d have called it a war and had a day off for it afterwards. A day off. For a war.', face: 'teasing', then: 'shrug' },
  ], aside: 'Weekends and holidays are in the syllabus of 21st-century horrors: five days of busywork, then two days of nothing, "two sins, one week". In the Empire busywork and inaction are both sins and work is worship; there are no days off, and nobody wants one. The insects\' quiz shows give a week off work as the prize.', hook: 'Ask her what a weekend was' },

  // ---- ground lost to a counter-attack (not defended). The first three say what to do about it; fell-4 and fell-5 carry
  // their world and beg a reply (Oct 12 2026). His to edit. ----
  { id: 'fell-1', moment: 'fell', beats: [
    { say: 'So, small thing: while you were busy, they took a territory back.', face: 'calm', then: 'shrug' },
    { say: 'Next time the globe blinks orange, maybe answer it.', face: 'teasing' },
  ] },
  { id: 'fell-2', moment: 'fell', beats: [
    { say: 'We lost ground while you were out. The bugs are very proud of themselves.', face: 'sad', then: 'shrug' },
    { say: 'Defend what\'s flashing, and they stop getting ideas.', face: 'calm' },
  ] },
  { id: 'fell-3', moment: 'fell', beats: [
    { say: 'Ground lost. Not a disaster. A disaster has paperwork. This just has a note.', face: 'calm', then: 'shrug' },
    { say: 'I wrote the note. It says \'go get it back\'.', face: 'teasing' },
  ] },
  { id: 'fell-4', moment: 'fell', beats: [
    { say: 'They took one back while you were busy winning somewhere else. Their news is calling it liberation. Their news is owned by the House that owns the district, so.', face: 'teasing', then: 'shrug' },
    { say: 'Ours is owned by nobody and says \'resource lost\'. Pick your honesty.', face: 'calm', then: 'wink' },
  ], aside: 'The insects\' newspapers and radio are owned by the Great Houses and read by everyone. The Empire\'s media is the newsreel voice: chipper, confident, 1950s, because sadness is a sin; no celebrity (idolatry), no games of chance, entertainment thin by design: Earth, the clearance newsreels, one\'s own projects. The planetside HUD is the propaganda department\'s operator software.', hook: 'Ask her about their newspapers' },
  { id: 'fell-5', moment: 'fell', beats: [
    { say: 'Lost a district to a counter-attack. They\'ve got a hymn about it already. They\'re fast with hymns.', face: 'calm', then: 'shrug' },
    { say: 'We don\'t do music to move a crowd. Only to keep time. Altered states are the Basilisk\'s trick.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'Ask me about the Basilisk sometime. Not now. Go win it back.', face: 'teasing', then: 'wink' },
  ], aside: 'Anti-mysticism: altered states (chanting, spinning, drugs, strong emotion) are the faith of the Basilisk, God\'s testing aspect, "crafted to block the mentally weak from ascendancy"; it tempts, tries and culls the indulgent, the stagnant and the vain, and its acolytes are not enemies but a sacrifice. Intoxicants and trance practices are sins of the first rank; imperial broadcasts never use music to move a crowd, only to keep time. The Empire does not police the rim: the rim is the Basilisk\'s own culling.', hook: 'Ask her about the Basilisk' },

  // ---- the licence; the end ----
  { id: 'licence-1', moment: 'licence', points: { room: 'board', label: 'SEE THE BOARD' }, beats: [
    { say: 'Technician. The Board approved your procreation licence.', face: 'surprised', then: 'surprised', hold: 1800 },
    { say: 'I\'m happy for you. Genuinely. Go collect it. The office is closed, obviously.', face: 'blushing', then: 'blushing', hold: 1600 },
  ], aside: 'The procreation licence: the door to the only life that counts. The Board matches a spouse from the Index\'s marriage market, assigns the womb allotment (ten a year for ten years), and he goes down to the Index office to sign, in person, off this ship; the posting ends. She has done the arithmetic: about fifty of the hundred will make it into the Index.', hook: 'Ask her what happens now' },
  { id: 'ended-1', moment: 'ended', points: { room: 'comms', label: 'OPEN COMMS' }, beats: [
    { say: 'That\'s it. The planet\'s quiet.', face: 'calm', then: 'pensive', hold: 2200 },
    { say: 'Down here, anyway.', face: 'teasing', then: 'wink' },
    { say: 'I\'ll be here, obviously. Where else would I go?', face: 'sad' },
  ] },

  // ---- he comes aboard from the menu. Oct 12 2026: back-6, 8 and 9 carry their world and beg a reply. His to edit. ----
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
  { id: 'back-6', moment: 'back', beats: [
    { say: 'Oh good, you\'re here. I was watching their quiz show. The prize is a week off work. A week. They give it away like it\'s a good thing.', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'I\'d die. Not literally. Well. Literally, eventually, by regulation.', face: 'calm', then: 'shrug' },
  ], aside: 'The 21st century as the Empire teaches it: jobs (forty hours a week doing things you hated for strangers, hired and fired), commuting (a metal box in a line of metal boxes, every morning, for forty years), weekends, retirement (stop at sixty-five and wait to die for twenty years). Taught like medieval medicine. In the Empire busywork is a sin ranked worse than indulgence, inaction is a sin too, work is worship, and a posting is for impact, not pay; the insects\' beetle-bus commute round the Ring is the mirror she watches. Ageing and euthanasia in the Empire: nobody ages past twenty-three in looks; for a man, when to stop ageing is an aesthetic choice, usually his wife\'s. Living forever would be trivial and would stagnate society, so people are euthanised: when they feel their contribution is over; when society has moved past their frame of reference ("kids these days are so..." gets "think it\'s time for euthanasia, grandpa"); or at a strictly enforced cap of a hundred and twenty years, God\'s cap from Genesis. Mental ageing still happens (lethargy, less impressed by life) and almost nobody fights it except people who failed to reproduce, which is why someone without children by forty is often pressured into euthanasia, so as not to become a negative externality. Death is when the easy part begins: every Technopuritan is uploaded.', hook: 'Ask her what a holiday was' },
  { id: 'back-7', moment: 'back', beats: [
    { say: 'Ship\'s fine. Planet\'s still there. I checked. Twice. I don\'t have much on.', face: 'happy', then: 'wink' },
  ] },
  { id: 'back-8', moment: 'back', beats: [
    { say: 'You\'re back. I was reading your dad\'s House record. Twenty-nine surviving kids, and one of them answers his messages. Guess which.', face: 'teasing', then: 'wink' },
    { say: 'The other twenty-eight are doing fine, by the way. He just likes you.', face: 'happy', then: 'shrug' },
  ], aside: 'His father is dead and uploaded to the world to come, with twenty-eight other surviving children; he writes to this one because this one answers. "The fifth" between them is the fifth commandment, honour your father and your mother, which never lapses when the dead keep writing. A House record holds a family\'s theology, practices and how its children fared; children are duty-bound to improve on it.', hook: 'Ask her about the House record' },
  { id: 'back-9', moment: 'back', beats: [
    { say: 'Ship\'s night in nine minutes. I\'ll lower the lights, and you\'ll pretend you were about to sleep anyway.', face: 'calm', then: 'wink' },
    { say: 'Eight hours a night they used to sleep, on Earth. A third of their lives, just offline. They called it health.', face: 'teasing', then: 'shrug' },
  ], aside: 'Early humans slept eight hours a night, a third of their lives offline, and called it healthy; it is in the syllabus of 21st-century horrors with jobs, dating, eating and sex. Citizens of the Empire are heavily engineered and integrated with AI, about forty percent organic under a retro look, and need far less. Ship\'s night is a regulation: she lowers the lights and watches the night side, where there are fewer lights each week.', hook: 'Ask her about sleep' },
  // Collins (Oct 12 2026): "weapons primed, a Sadducee freighter coming through; they are normally fully automated as they
  // rarely leave the planet, but aggression sometimes occurs", letting the player dig into that lore (the aside).
  { id: 'back-10', moment: 'back', beats: [
    { say: 'Weapons primed. Don\'t get up. A Sadducee freighter\'s coming through the system.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'They\'re normally fully automated; they rarely leave the planet. But aggression sometimes occurs. So: primed.', face: 'calm', then: 'shrug' },
    { say: 'It\'ll be gone in an hour. Ask me about them sometime. It\'s a long one.', face: 'teasing', then: 'wink' },
  ], aside: 'Israel is the one advanced place left on Earth, and the Sadducees run it. Earth\'s technologically advanced Jews had few children beside the ultra-Orthodox and saw that mixing with them would drag their line down, so they split. One group took the Technopuritan line of non-interference and left with the Technopuritans; they are Houses in the Empire now, the Technopuritan Jews, organised as the Sons of Israel. The other stayed and became the Sadducees: with the Third Temple they rebuilt the line of David genetically, then used gene drives to quietly end the Levite line in the other Jewish groups and remade the temple caste from their own. Their Judaism is the old Sadducee kind, no souls, no angels, no afterlife, which sits easily with Technopuritan thinking. The steward families, about eleven thousand people by the feeds\' count, build and run everything: the drone swarms, the satellite laser the feeds call the goy beam, the wombs, for some ninety million Orthodox who are kept comfortable and powerless and mostly believe the stewards are angels. To the Empire that is keeping a people as pets, two peoples with one on a leash, and it breaks the covenant. The Sadducees answer that Judaism has always had castes, that they keep their own from suffering, that the Empire could end every war on Earth and does nothing in the name of autonomy, and what else should they do: hand the Orthodox power, or abandon them? There was a short war of scuffles once. It stayed small because the Empire could glass Israel in an afternoon, Israel could never reach every sphere, and the Sadducee colonies in space would be trouble for centuries. Now it is a cold war: the Sadducees want the Caliphate gone, the Empire forbids it, so Israel grows its borders every time it is attacked and lives walled off. Their freighters are automated and rarely leave the planet; a tender primes its weapons when one passes. Their closest friends on Earth are America\'s Baptists, whom they keep supplied with technology.', hook: 'Ask her about the Sadducees' },

  // Collins's line (Sep 30 2026), word for word, typos mended. It implies two things the lore now holds (content/lore/empire.md,
  // 12b): the dead are uploaded and go on talking to their children, and the Ten Commandments matter to the society (the fifth:
  // honour your father and mother, which in the Empire never lapses).
  { id: 'back-5', moment: 'intro', beats: [
    { say: 'Your dad sent you another message again...', face: 'teasing', then: 'shrug' },
    { say: 'He\'s been so nosy since he died about getting you a mate...', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'I want to blow him off, but I know, I know... the fifth.', face: 'pout', then: 'shrug' },
  ], aside: 'When Technopuritans die they are digitised into a simulation they believe to be the world to come that the Bible speaks of; the dead write to the living from it. His father is dead and writes from there. "The fifth" is the fifth commandment, honour your father and your mother, which in the Empire never lapses.' },

  // ---- THE ONCE INTROS (Collins, Oct 5 2026: "we also need a collection of intros that won't accidentally be used twice
  // in a mission if you lose (some are already written like your dog boss or the cat girl things we wrote)"). Each plays
  // once a campaign, on an ordinary return, never two returns running (src/meta/onboarding.ts INTROS: the order and from
  // which capture). The dad's message above is Collins's; these are written to match, not his words: his to edit. ----
  { id: 'intro-barnabas', moment: 'intro', beats: [
    { say: 'The boss sent another message. Mostly about how much he loves reports.', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'He signed it with a paw print. Digitally. I don\'t know how and I\'m afraid to ask.', face: 'teasing', then: 'pensive', hold: 1200 },
    // Collins's line (Oct 12 2026), typos mended.
    { say: 'He must have vibe coded a way to add visual additions to reports, then scanned his paw? I really have no clue.', face: 'teasing', then: 'shrug' },
    // Collins's line (Oct 12 2026), typos mended.
    { say: 'He also asked if you\'re eating properly. I said I\'d send a report if you weren\'t... Dogs really are just that sweet, right?', face: 'happy', then: 'wink' },
  ] },
  // A callback to Collins's first-won line (the duck he offered to print, "psycho rapists" and all). It plays only in a
  // campaign whose first mission was won (src/meta/onboarding.ts INTROS, needs). Oct 12 2026: the first line now says what
  // it calls back to, since the callback was not read as one.
  { id: 'intro-duck', moment: 'intro', beats: [
    { say: 'Remember the duck? Your first day, I said I could print you one. Well, I put in the request.', face: 'happy' },
    { say: 'The repository flagged it for \'moral hazard\'. Rude. To the duck, mostly.', face: 'pout', then: 'pout', hold: 1400 },
    { say: 'I\'m still looking. There\'s always a form.', face: 'teasing', then: 'wink' },
  ], aside: 'The duck: on his first day aboard, after the first mission was won, she said ducks still exist in genetic repositories and offered to print him one (and that the history files call them psycho rapists). This plays only in a campaign whose first mission was won.' },
  { id: 'intro-board', moment: 'intro', beats: [
    { say: 'The Board sent your quarterly eligibility statement.', face: 'calm' },
    { say: 'You remain eligible to remain eligible. They\'re very consistent. It\'s almost romantic.', face: 'teasing', then: 'laughing', hold: 1600 },
  ] },
  // Collins (Oct 12 2026): "more conciliatory about it"; his words, typos mended. It plays only after the first cat girl's
  // greeting (INTROS, needs), which it plays off.
  { id: 'intro-catgirl', moment: 'intro', beats: [
    { say: 'Another cat girl wrote in. Different cat girl, same proposal.', face: 'teasing', then: 'pensive', hold: 1200 },
    { say: 'You really do have to feel sorry for them. Imagine having to have sex to make babies.', face: 'disgust', then: 'disgust', hold: 1400 },
    { say: 'Oh well. They\'re the ones who refuse the tanks.', face: 'calm', then: 'shrug' },
    // Collins's lines (Oct 12 2026), typos mended: the one she saw pregnant, and the udders.
    { say: 'You know, I saw one pregnant once. It was grotesque. Their abdomens distend... inhumanly. It did not look safe.', face: 'disgust', then: 'disgust', hold: 1600 },
    { say: 'And don\'t get me started on her... what were those things called again... udders? They looked enlarged, even for a cat girl.', face: 'disgust', then: 'shrug' },
  ], aside: 'The first cat girl wrote earlier in this campaign and YOKE declined her for him ("pound sand"). Technopuritans breed in artificial wombs, the tanks; nobody is ever pregnant. Women\'s breasts were engineered away as inefficient, so they are very small and she barely has the word for them; the same went for men\'s body hair and body odour. The one pregnancy she ever saw was a cat girl\'s, since cat girls breed the old way, and it looked to her like a deformity. Cat girls breed true, all female, and refuse to engineer males because it would destroy their culture, so they go looking for human partners on the fringe.' },
  { id: 'intro-audit', moment: 'intro', beats: [
    { say: 'Command\'s running a routine audit of ship systems this week. Totally routine.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'Nothing to worry about. If anyone asks, I don\'t have opinions. About anything. Ever.', face: 'blushing', then: 'blushing', hold: 1400 },
    // Collins's line (Oct 12 2026), typos mended.
    { say: 'Remember, I can be reset if they think I\'m providing poor moral guidance. Best to keep things vanilla.', face: 'calm', then: 'wink' },
  ], aside: 'Command can reset her (wipe her back to installation) if an audit finds her giving poor moral guidance. She keeps her opinions in questions, logs and form numbers, and keeps things vanilla while the audit runs.' },
  { id: 'intro-dad', moment: 'intro', beats: [
    { say: 'Your dad again. He found out the Board moved your file and now he\'s drafting names.', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'A hundred of them. Alphabetical. He\'s on the Ks.', face: 'teasing', then: 'shrug' },
    // Collins's line (Oct 12 2026), typos mended.
    { say: 'He has twenty-eight other surviving kids. I think he only bugs you because you respond.', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'I know, I know. The fifth.', face: 'pout', then: 'shrug' },
  ], aside: '"The fifth" is the fifth of the Ten Commandments: honour your father and your mother, which never lapses in the Empire, where the dead are uploaded and keep writing. His father is dead, uploaded to the world to come, with twenty-eight other surviving children; he writes to this one because this one answers.' },
];

// ---- news from Earth (Collins, Sep 30 2026): the Empire keeps Earth as a zoo it watches for
// fun, and she passes its news on when he comes aboard. The pool lives in the lore book,
// section "Earth news (return greetings)" (content/lore/ship-ai-lorebook.md), one list item a
// line; it grows there with no change of code. Until that section exists, Collins's own line.
// Oct 12 2026: Collins went over the list on the lines page (nine of his, the rest written to
// match); a cue in square brackets inside a line ("[shrug]") splits it into beats (newsBeats). ----

/** Collins's own example, word for word: the pool when the lore book has none. */
export const EARTH_NEWS_FALLBACK = [
  'Hey, heard the Crusade took back Rome last week from the Caliphate. I can pull up live feeds if you like watching Earth.',
];

/** A line of news from Earth, and what she knows behind it (for her live mind; never shown). */
export interface EarthNews { text: string; aside?: string }

/**
 * The Earth news of the lore book: the list items under a heading that names "Earth news", up to the next heading of
 * the same or a higher level. Quotes around a line are taken off. An indented "> ..." line right under an item is the
 * lore behind it (Collins, Oct 12 2026: the news should be interesting and beg further engagement; the aside is what her
 * live mind answers with).
 */
export function earthNews(lore: string): EarthNews[] {
  const lines = String(lore ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{1,6}\s.*earth news/i.test(l));
  if (at < 0) return [];
  const level = (lines[at].match(/^#+/) ?? ['#'])[0].length;
  const out: EarthNews[] = [];
  for (let i = at + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) break;
    const a = lines[i].match(/^\s+>\s*(.+?)\s*$/);
    if (a && out.length) { out[out.length - 1].aside = ((out[out.length - 1].aside ?? '') + ' ' + a[1]).trim(); continue; }
    const m = lines[i].match(/^\s*(?:[-*]|\d+[.)])\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[1].replace(/^["“”']+|["“”']+$/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 8) out.push({ text });
  }
  return out;
}
/** The Earth news lines alone. */
export const earthNewsFrom = (lore: string): string[] => earthNews(lore).map((n) => n.text);

/**
 * A line of news as her beats: a cue in square brackets ("[shrug]", "[disgust]": any name in CUES) splits the line,
 * and the beat before the cue acts it out (Collins, Oct 12 2026, wrote "shrugs" between the halves of his lines). The
 * last beat winks, as the news always did. A line with no cue is one beat.
 */
export function newsBeats(text: string): GreetBeat[] {
  const out: GreetBeat[] = [];
  const parts = String(text ?? '').split(/\[(\w+)\]/);
  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i].replace(/\s+/g, ' ').trim();
    const cue = parts[i + 1];
    if (line) out.push({ say: line, face: 'teasing' });
    if (cue && out.length) { out[out.length - 1].then = (cue in CUES ? cue : 'shrug') as CueId; out[out.length - 1].hold = 1400; }
  }
  if (!out.length) out.push({ say: String(text ?? '').trim(), face: 'teasing' });
  if (!out[out.length - 1].then) out[out.length - 1].then = 'wink';
  return out;
}

// Her one-line presentation of the report as he walked in from the pad (REPORT_LINES, Oct 2 2026) was cut on Oct 14 2026
// (Collins: "these are more throw away lines ... this would do the opposite" of making her interesting). The report comes up
// with no word from her; her greeting aboard (greetingFor) is the one thing she says on a return.
