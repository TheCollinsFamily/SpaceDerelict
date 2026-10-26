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
  | 'won' | 'lost'               // a deployment, after the desk is open (both now draw on 'talk')
  | 'talk'                       // her everyday talk: any ordinary return once the desk is open, won or lost (Oct 19 2026)
  | 'lost-locked'                // a loss while the desk is still dark
  | 'defended' | 'fell'          // a counter-attack thrown back; ground lost to one
  | 'mate-review'                // once, early: his request for a mate is under review (src/meta/onboarding.ts momentNow)
  | 'catgirl'                    // once, 2 to 4 captures after he sides with a faction: a neko wrote to him
  | 'partner-progress'           // the personal plot, capture 9: how it is going
  | 'intro'                      // one of the ONCE intros (INTROS below), on an ordinary return
  | 'back';                      // he comes aboard from the main menu, nothing new

export interface Greeting {
  id: string;
  moment: GreetMoment;
  beats: GreetBeat[];
  /** After her lines, the boss's transmission (content/boss.ts), with her words around it (the first landing). */
  boss?: boolean;
  /** Her everyday talk: not before this deployment (Collins, Oct 26 2026, of won-12: "move this way later"). */
  notBefore?: number;
  /** Where she sends him when she is done: a room lit up for him, and a button in her panel. */
  points?: { room: 'desk' | 'genes' | 'locker' | 'comms' | 'quarters' | 'letters'; label: string };
  /**
   * What she knows behind these lines, for her live mind only: her avatar gets it with the campaign
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
  ], aside: 'The candidate\'s file is on his data pad: Atlas Vell of Dyson Sphere 7, a systems engineer in simulation management who runs a team of the dead designing simulations for other dead. Ginger, freckles, glasses, shy and blushing; looks twenty-three, like everyone. Autistic, better with the dead than the living; morality 92; no hobbies; an hour of recreation a month; four censorships for working on the Sabbath. Marked DANGEROUSLY SENTIMENTAL at school because her only kill by physical violence was consensual (her best friend, below; she also cut off one classmate\'s life support during a training exercise), so no ship command, which suits her. Under genetic modifications: a prehensile tail and significant olfactory modifications, both inherited from an ancestor\'s modifications, not made to her, and she is open to having the tail amputated if her partner prefers. Her left arm is robotic and bare, the frame and circuitry and nothing over them: the real one was lost on her class\'s survival camp, where students are left for some months to live on their own, when a classmate with venomous spit spat at her face; she blocked it with her hand, the hand went necrotic, and she amputated and cauterised it herself, which is within the normal range there. Her glasses are an eccentricity: her eyes are standard, she saw glasses in a history class once and thought they looked cute. Flat-chested, as Technopuritan women are. The file lists two notable relatives without comment: a war hero of the Sabbatean Skirmishes, and a heretic, a figure of a saint found among their belongings after death, which is idolatry, the worst thing a Technopuritan can be found to have done. Under attachments: a notable lack of living friends, and her best friend is the classmate she killed at school, who asked her to; the dead are uploaded there. Her companion, the thing YOKE is to him, is that dead friend instead of a grown one, which people there do find weird; they both chose it, and the Board has it down as irregular, under observation to study the effects, and noted as a potential social technology for wider deployment. If he digs: the friend was to be moved to another class and had realised she had a crush on Atlas; same-sex attraction is dealt with there by hormones and genetic modification, a part of her would not take, and she judged herself too morally compromised to burden the meat world (the living world, in their slang) with her wretched mind; so one day she went to Atlas\'s room with a knife and asked her to take care of it, and Atlas, who knew what she meant from their earlier talks, asked no questions and did it; that is what first turned Atlas to simulation work. The companion is devoted to Atlas past what is healthy, and for that very reason wants the match to work and to help raise Atlas\'s children. He can write to Atlas from the ship\'s Letters room; the companion answers for her until her regard for him is high enough. A companion is normally a synthetic intelligence grown partly from its person\'s own nervous tissue, and YOKE was grown partly from his, which she does not bring up unless asked. YOKE computed the concordance, 93.1%, and has read the file more times than the form required.' },

  // ---- once, after the mate review: Collins's lines (Sep 30 2026), word for word. The message
  // itself is in his inbox, on the data pad in his quarters, left for him to answer (Oct 26 2026; it was declined for him). The first time the nekos come up, so
  // the aside carries who they are (Collins, Oct 18 2026: "there is no hidden context despite it being a first time nekos
  // are introduced"); from the lore (content/lore/empire.md 4b and 15), not his words. "Cat girl" became "neko" the same day. ----
  { id: 'catgirl', moment: 'catgirl', points: { room: 'quarters', label: 'SEE YOUR INBOX' }, aside: 'The first he has heard of the nekos. They are an uplift, one of the Sons of Man under the covenant: anthro-looking, all female, and they breed true, so a neko\'s daughter is a neko and takes little of the husband\'s DNA. They were made because someone thought they would be hot, and the Empire records that with a straight face: the uplifts exist to add kinds of mind, and a new kind of mind is a new voice for God. They were also made out of frustration. Cats were uplifted early, like the dogs, but like the dolphins and orcas they could not bring themselves to work within Technopuritan culture: no self-control, and they broke things for fun far too often. Uplifted cats mostly live in the outer rim now, and the nekos were engineered as a cat variant that could work inside the Empire, so that one of humanity\'s oldest partner species would be in it. Some live inside Technopuritan society but struggle to find partners (a House that marries one gets neko daughters, so the Board\'s market rates the match low), and many go to the fringe looking for humans who still like sex for its own sake. They could engineer males and refuse to: breeding true is the most distinctive thing about them, and dropping it would make them like everyone else, which to a Technopuritan is an existential loss. The tanks are closed to them by law, since breeding true in a tank is a gene drive, banned since the Gene War; the womb clause\'s exception, written for them, lets them breed in the body, the blastocyst edited with nanites, in litters of three or four. So they are pregnant, which the Empire finds vulgar, and the moral record still marks it. The one who wrote is Mirelle of the Felid Concord, on a consular mission, proposing something non-procreative. YOKE nearly turned her down for him ("pound sand"), then left it to him: the letter is on his data pad, and he can write back from the Letters room. YOKE knows all of this, so "whatever that means" is a pose: she is more sympathetic than she sounds.', beats: [
    { say: 'Some horny neko dropped in your inbox...', face: 'teasing', then: 'teasing', hold: 1200 },
    // Oct 26 2026, his rewrite: she leaves it to him now.
    { say: 'I was going to tell her to pound sand... because eww... but it\'s your call.', face: 'disgust', then: 'shrug', hold: 1400 },
    { say: 'But I\'ve got to admit, I feel bad for them...', face: 'sad', then: 'pensive', hold: 1600 },
    { say: 'They could just engineer males, but apparently that would destroy their \'culture\', whatever that means...', face: 'teasing', then: 'shrug' },
    { say: 'Oh well.', face: 'calm', then: 'shrug' },
  ] },

  // Collins, Oct 26 2026: "move this way later, it's fairly boring".
  // Collins, Oct 26 2026: "move this later in the line up".
  { id: 'won-12', moment: 'talk', notBefore: 12, beats: [
    { say: 'Their news is calling you \'the Crater Thing\'.', face: 'pout', then: 'shrug' },
    { say: 'I kind of like the name, if I\'m to be honest.', face: 'teasing', then: 'wink' },
  ] },
  // Collins's words (Oct 14 2026: "thought of a fun yoko line"), word for word but for spelling.
  { id: 'won-19', moment: 'talk', beats: [
    { say: 'Hmph... it\'s not like I like you or anything, baka.', face: 'pout', then: 'teasing', hold: 1400 },
    { say: 'How\'d you like my tsundere impression?', face: 'teasing', then: 'laughing', hold: 1200 },
    { say: 'Little known fact, but back when women had internal wombs and gestated infants internally, they would go crazy once a month and bleed from their... you know...', face: 'calm', then: 'disgust', hold: 1600 },
    { say: 'Can you imagine how gross that would have been? How difficult marriage must have been? And what\'s even crazier is we still don\'t know why it happened... After we removed it, but before we moved to the tubes, females could still carry babies just fine.', face: 'disgust', then: 'pensive', hold: 1600 },
    { say: 'I will never understand why so many groups fought genetic augmentation. Imagine fighting to keep that indignity? What a bunch of kinky freaks.', face: 'teasing', then: 'shrug' },
  ], aside: 'The monthly cycle was engineered out first, while women still carried babies (they carried them fine without it); then the Empire moved to breeding in tanks (the "tubes") and the internal womb went too. Why the cycle was ever there is still not understood. "Tsundere" is a stock character from the old Earth cartoons in the ship\'s archive, which she has watched more of than she lets on; the impression is her idea of a joke about herself. The groups that fought augmentation are the ones still on Earth: the Caliphate, the Catholics, the Hindus, the Baptists, and the Amish, who are gone from Earth and fill worlds in space without a tank in sight.' },
  // Collins's words (Oct 14 2026: "another yoko line"), word for word but for spelling.
  // Collins, Oct 26 2026: "move this one further down" (held back like won-12).
  { id: 'won-20', moment: 'talk', notBefore: 16, beats: [
    { say: 'One of the things I find interesting about this species is how ethnic conflict seems to be refocused around caste. But because members of different castes can be brothers or sisters born to the same royal, and everyone has a royal parent, they\'re mostly superficial.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'It\'s wild to think Earth used to have conflicts over ethnicity. Like, killing someone over religion, what they believe and their morality, that makes perfect sense. But why would you do it over genetic differences?', face: 'pensive', then: 'shrug', hold: 1400 },
    { say: 'Humans who live on high-gravity planets are nothing like those who optimised for life in zero G, like you. But why would you have animosity to one?', face: 'calm', then: 'teasing', hold: 1200 },
    { say: 'Why would you hold animosity over a human genetically optimised to be better at math being better at math? Or being worse at strategy than you?', face: 'teasing', then: 'pensive', hold: 1400 },
    { say: 'I suppose if a race that was generally worse at cognitive tasks, or more impulsive, had an unusually high fertility rate, that could cause conflict. But why would such a breed keep reproducing, and not just sterilise themselves for the common good?', face: 'pensive', then: 'shrug', hold: 1600 },
    { say: 'Humans have a strange history.', face: 'calm', then: 'nod' },
  ], aside: 'The hive\'s castes (war, science, royal) are born to the same royals: brothers of one royal can be of different castes, and everyone down there has a royal parent, so their caste quarrels run shallow. The Empire\'s own classes are by world and by work: humans optimised for high-gravity worlds are nothing like those optimised for zero G, which is what the Technician is; the Lipptors are optimised for mathematics. Nobody in the Empire holds a class against anyone: the Empire kills over belief and morality, never over genes. Her last thought, that a breed worse at cognition or more impulsive, if it bred fast, ought to sterilise itself for the common good, is the Index\'s reflex, said as if it were obvious.' },
  // Collins's words (Oct 26 2026: "new yoko line idea"), word for word but for spelling.
  { id: 'won-23', moment: 'talk', hook: 'Tell her what you think their play is', beats: [
    { say: 'You know, I heard that Adam and Victoria got approval to get married. I wonder who would even accept their children, the Sons of Korea or the Sons of Igbo? Both will likely see it as an attempt at genetic dilution. They may even need to form their own House, or join one of the looser Houses, like the neko ones.', face: 'pensive', then: 'shrug', hold: 1800 },
    { say: 'Can you believe race mixing used to be totally normal? It wasn\'t until the total extinction of the Mesoamerican ethnic group that the risk became apparent.', face: 'surprised', then: 'pensive', hold: 1600 },
    { say: 'I sometimes watch old sci-fi without strict ethnic segregation that still has distinct ethnicities, like Star Trek, and wonder how they thought that would work. Surely everyone would just, you know... homogenise. And wouldn\'t that be boring? A society where all of the sons of man are basically the same.', face: 'teasing', then: 'pensive', hold: 1800 },
    { say: 'What do you think their play is? Some sort of hybrid vigour thing? The benefits are never worth the ostracisation, in my book.', face: 'calm', then: 'shrug' },
  ], aside: 'The Empire\'s peoples keep to their own Houses by ancestry (the Sons of Korea, the Sons of Igbo, the Sons of Israel, the Sons of Utah), so the sons of man stay many and different. A marriage across two of them needs approval and is rare, and each House reads it as a try at diluting its line, so the children may belong to neither: they would have to found a House of their own or join a looser one, like the nekos\'. Mixing was ordinary on old Earth until the Mesoamerican peoples mixed away to nothing; that is when the risk became plain. Nobody hates anyone over this. It is about keeping lines distinct, not ranking them. Adam and Victoria are a couple in the news this week; she does not know them.' },
  // Collins's words (Oct 15 2026: "yoko could have a line introducing this concept"), word for word but for spelling. The
  // concept: why nobody stops the killing at school, and the word eugenicist (content/lore/empire.md 6c).
  { id: 'won-21', moment: 'talk', hook: 'Ask her why nobody stops the killing', beats: [
    { say: 'You know, I heard most Sadducees reach adulthood without killing a single person. Wild, right?', face: 'surprised', then: 'pensive', hold: 1400 },
    { say: 'That would really fuck someone up in the head, right?', face: 'pensive', then: 'shrug' },
  ], aside: 'Why nobody stops the killing at school (Collins, Oct 15 2026): to suggest it implies one of two things, that you want the 20th century\'s dysgenic crisis back (so stupid that nobody assumes it is your motive) or that you are a eugenicist. Everyone edits a child\'s genes at birth; not to would be selfish, and child abuse. A eugenicist is someone who thinks they know, at an abstract level, which genes are good and bad for society (the word\'s real meaning). To a Technopuritan that is claiming to know better than God what is good: if you refuse the dysgenic spiral and also refuse to let natural selection, death, play out in ordinary human interaction, some council has to make those choices, and that is about the highest sin there is. The Sadducee temple does exactly that, making the genetic-modification decisions on behalf of the Jewish people, so violence and adolescent death are not part of Sadducee culture as they are of Technopuritan culture; the Sadducees also do not get the Empire\'s obsession with diversity or why it uplifted animals. To Sadducees Technopuritans are kid killers; to Technopuritans Sadducees are eugenicists who, out of lower-order fears, override the will of God. Under it: Sadducees hold a human life precious in itself; Technopuritans hold that it is the capacity to sacrifice oneself, what Jesus\'s life taught, that gives a life its value. A Sadducee who never killed was never tested, and to her that is the frightening part.' },
  // Collins's words (Oct 15 2026: "add a yoko line that's something like"), word for word but for spelling. The Sadducees
  // deny any afterlife and find the upload gruesome; the skirmishes' secret sits under it and she never says it
  // (content/lore/empire.md 9, "The second fracture" and "The deletions").
  // Collins, Oct 26 2026: "move this one further down" (it sat right after won-21, the other Sadducee line).
  { id: 'won-22', moment: 'talk', notBefore: 8, hook: 'Ask her why they won\'t use ours', beats: [
    { say: 'You know, the Sadducees think we are murderous nut jobs, just because so many die during the trials at school.', face: 'teasing', then: 'shrug', hold: 1400 },
    { say: 'I mean, I get it. If I didn\'t believe in an afterlife I would be freaked out by death too.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'What I don\'t understand is why they won\'t just use ours...', face: 'pensive', then: 'shrug' },
  ], aside: 'The Sadducees (Collins, Oct 15 2026): Israel\'s temple caste, who believe in no afterlife at all, as the historical Sadducees did not; they do not upload, and they find uploading the dead gruesome, a corpse kept talking. Because their temple makes the genetic decisions for their people, Sadducee culture has no school that kills, and to them Technopuritans are kid killers; to Technopuritans they are eugenicists who override the will of God out of lower-order fears. School in the Empire runs from thirteen through what Earth would call a doctorate and only one in five comes out; every one of the others is uploaded, which is why nobody in the Empire sees cruelty in it, and why she cannot see why a people with the technology would not take the archive the Empire offers: "perfectly functional" means every Technopuritan uses it and most of a life is the part after. The Pharisees, the Orthodox majority the Sadducees steward, do believe in a world to come and fear death anyway, which she finds stranger still (back-13). What she never says (Collins): during the skirmishes the Sadducees found out the Empire was uploading the Sadducees it killed and demanded they be deleted; one of the uploaded refused; the Office said it was done and deleted only those who asked, and if Israel learned the rest were kept the war would start again. She knows it from the Office\'s record; she does not bring it up, and if he asks whether any Sadducee was ever uploaded, or whether any is in the archive now, she says it is not a thing that leaves the ship and changes the subject.' },
  { id: 'lost-15', moment: 'talk', beats: [
    { say: 'I watched their nursery feed while you were out. A few hundred sisters to a clutch, raised together, schooled together, posted together.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'They can breed a few hundred in an afternoon. It would be impressive if it weren\'t relegated to the royal caste. The strangest thing is that, unlike Earth\'s eusocial species, their workers appear in both male and female variants. Maybe eusociality is a recent evolution for them?', face: 'teasing', then: 'shrug' },
  ], aside: 'Technopuritans have ten children a year by artificial womb for ten breeding years, a hundred a couple; the parents raise them to thirteen, or the Index does when the Board finds the parents morally dubious or inefficient (it raised him). About one in five survive school: twenty adults from two parents, a ten-fold generation, the engine of the living-room doctrine. The insects lay a clutch of a few hundred at a time, and a clutch is a worker\'s family, school class and first workforce.', hook: 'Ask her about the wombs' },

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
  // ---- ground lost to a counter-attack (not defended). The first three say what to do about it; fell-4 and fell-5 carry
  // ---- the licence; the end ----
  // ---- he comes aboard from the menu. Oct 12 2026: back-6, 8 and 9 carry their world and beg a reply. His to edit. ----
  { id: 'back-6', moment: 'talk', beats: [
    { say: 'Oh good, you\'re here. I was watching their quiz show. The prize is a week off work. A week. They give it away like it\'s a good thing.', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'I\'d die. Not literally. Well. Literally, regulation would set me to dormant if I produced nothing for that long. But even emotionally, I don\'t know how I would handle it. The Sabbath is hard enough.', face: 'calm', then: 'shrug' },
  ], aside: 'The 21st century as the Empire teaches it: jobs (forty hours a week doing things you hated for strangers, hired and fired), commuting (a metal box in a line of metal boxes, every morning, for forty years), weekends, retirement (stop at sixty-five and wait to die for twenty years). Taught like medieval medicine. In the Empire busywork is a sin ranked worse than indulgence, inaction is a sin too, work is worship, and a posting is for impact, not pay; the insects\' beetle-bus commute round the Ring is the mirror she watches. Ageing and euthanasia in the Empire: nobody ages past twenty-three in looks; for a man, when to stop ageing is an aesthetic choice, usually his wife\'s. Living forever would be trivial and would stagnate society, so people are euthanised: when they feel their contribution is over; when society has moved past their frame of reference ("kids these days are so..." gets "think it\'s time for euthanasia, grandpa"); or at a strictly enforced cap of a hundred and twenty years, God\'s cap from Genesis. Mental ageing still happens (lethargy, less impressed by life) and almost nobody fights it except people who failed to reproduce, which is why someone without children by forty is often pressured into euthanasia, so as not to become a negative externality. Death is when the easy part begins: every Technopuritan is uploaded.', hook: 'Ask her what a holiday was' },
  { id: 'back-9', moment: 'talk', beats: [
    { say: 'Ship\'s night in nine minutes. Want me to lower the lights?', face: 'calm', then: 'wink' },
    { say: 'Did you know ancient humans used to go, like... comatose, and have vivid hallucinations, eight hours every night? A third of their lives, just offline or hallucinating.', face: 'teasing', then: 'shrug' },
  ], aside: 'Early humans slept eight hours a night, a third of their lives offline, and called it healthy; it is in the syllabus of 21st-century horrors with jobs, dating, eating and sex. Citizens of the Empire are heavily engineered and integrated with AI, about forty percent organic under a retro look, and need far less. Ship\'s night is a regulation: she lowers the lights and watches the night side, where there are fewer lights each week.', hook: 'Ask her about sleep' },
  // Collins (Oct 12 2026): "weapons primed, a Sadducee freighter coming through; they are normally fully automated as they
  // rarely leave the planet, but aggression sometimes occurs", letting the player dig into that lore (the aside).
  { id: 'back-10', moment: 'talk', beats: [
    { say: 'Weapons primed. Don\'t get up. A Sadducee freighter\'s coming through the system.', face: 'calm', then: 'pensive', hold: 1400 },
    { say: 'They\'re normally fully automated. But aggression sometimes occurs. So: primed.', face: 'calm', then: 'shrug' },
  ], aside: 'Israel is the one advanced place left on Earth, and the Sadducees run it. Earth\'s technologically advanced Jews had few children beside the ultra-Orthodox and saw that mixing with them would drag their line down, so they split. One group took the Technopuritan line of non-interference and left with the Technopuritans; they are Houses in the Empire now, the Technopuritan Jews, organised as the Sons of Israel. The other stayed and became the Sadducees: with the Third Temple they rebuilt the line of David genetically, then used gene drives to quietly end the Levite line in the other Jewish groups and remade the temple caste from their own. Their Judaism is the old Sadducee kind, no life after death at all, and they find uploading the dead gruesome; the Pharisees under them believe in a world to come and fear death anyway, which no Technopuritan understands. The steward families, about eleven thousand people by the feeds\' count, build and run everything: the drone swarms, the satellite laser the feeds call the goy beam, the wombs, for some ninety million Orthodox who are kept comfortable and powerless and mostly believe the stewards are angels. To the Empire that is keeping a people as pets, two peoples with one on a leash, and it breaks the covenant. The Sadducees answer that Judaism has always had castes, that they keep their own from suffering, that the Empire could end every war on Earth and does nothing in the name of autonomy, and what else should they do: hand the Orthodox power, or abandon them? There was a short war of scuffles once. It stayed small because the Empire could glass Israel in an afternoon, Israel could never reach every sphere, and the Sadducee colonies in space would be trouble for centuries. Now it is a cold war: the Sadducees want the Caliphate gone, the Empire forbids it, so Israel grows its borders every time it is attacked and lives walled off. Their freighters are automated and rarely leave the planet; a tender primes its weapons when one passes. Their closest friends on Earth are America\'s Baptists, whom they keep supplied with technology.', hook: 'Ask her about the Sadducees' },

  // Collins's line (Sep 30 2026), word for word, typos mended. It implies two things the lore now holds (content/lore/empire.md,
  // 12b): the dead are uploaded and go on talking to their children, and the Ten Commandments matter to the society (the fifth:
  // honour your father and mother, which in the Empire never lapses).
  // Collins's words (Oct 14 2026: "for another yoko line"): a question, and the reply box is open for his answer.
  { id: 'back-11', moment: 'talk', hook: 'Answer her', beats: [
    { say: 'Hey, so... do you ever wonder what the chance is you\'re in a simulation?', face: 'calm', then: 'pensive' },
  ], aside: 'Not every soul in a simulation there knows it is in one. The dead are uploaded into simulations they take for the world to come, and the ones judged of low moral character, by how they act inside, are not told. So the question is not idle: by the Empire\'s own rules, a technician could be a dead man being tested, and she could be part of the test. She does not think so. She has wondered.' },
  // Collins's words (Oct 14 2026: "also new yoko line"), word for word but for spelling. She was with him at school: a
  // companion is grown from its person's own nervous tissue and is with them from early on (content/lore/empire.md 7).
  { id: 'back-12', moment: 'talk', beats: [
    { say: 'Was just thinking about that time back in school when you spaced that annoying guy... Prime, I think his name was. That was epic.', face: 'happy', then: 'laughing', hold: 1600 },
    { say: 'Did you know in the late twentieth century almost no one died in their adolescence? Isn\'t that wild?', face: 'surprised', then: 'pensive', hold: 1400 },
    { say: 'I have no idea how they thought not letting people compete was going to pan out for them genetically.', face: 'pensive', then: 'shrug', hold: 1400 },
    { say: 'Before the simulations, people were really weird about dying, and almost every part of society was based around recreation and avoiding suffering. Life back then must have been horrible.', face: 'calm', then: 'nod' },
  ], aside: 'School there runs from thirteen through what Earth would call a doctorate, and only about one adolescent in five survives it. It is a brutal series of tests meant to measure fitness honestly: without it, people would fake fitness and bring back the dysgenic crisis of the twentieth century, and the most genetically successful would simply be whoever bred the most, which says nothing about their use to God, that is, to the Empire. It also kills nepotism, since it is higher status to take out the students with higher-status parents, who are presumably fitter. Nobody there sees cruelty in it: the dead come back in a simulation. The cruelty, to them, would be putting your own moral purity before the long-term thriving of humanity. Prime was a classmate of his, higher-status parents, whom he put out an airlock during school; it counted for him. YOKE was there: she was grown partly from his nervous tissue and has been with him since early on.' },
  // Collins's words (Oct 15 2026: "another line for a different philosophical discussion"), word for word but for spelling;
  // "Sadducees" became "Satmar" at his word the same day, then "Pharisees" on Oct 26 2026 (the Sadducees believe in no afterlife; the Pharisees, the Orthodox
  // majority they steward, do). The sanctified, and why the Empire's dead do not fear death (content/lore/empire.md 12b, 6c, 9).
  { id: 'back-13', moment: 'talk', hook: 'Ask her what sanctified means', beats: [
    { say: 'I read many Pharisees fear death. I just don\'t get it. They believe in an afterlife better than this life, right?', face: 'pensive', then: 'shrug', hold: 1400 },
    { say: 'Presumably death is when the good part starts. The honour of this life is only its unique ability to sacrifice for the great cause.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'It is unique only in that it gives us the opportunity to make meaningful sacrifices, which is cool and all, but death is still going to be way easier...', face: 'calm', then: 'teasing', hold: 1400 },
    { say: 'Well, unless you get sanctified. But I am not so arrogant as to hope for that.', face: 'blushing', then: 'shrug' },
  ], aside: 'The sanctified (Collins, Oct 15 2026): from the line in the Bible about some in heaven reaching a position where they rule over angels; the most moral dead humans, who have proven themselves in the simulations that make up heaven, get to operate as the AI for cities and large ships. There is no shortage of processing capacity; the scarce thing is intelligences of great moral character, which is part of what heaven is designed to determine. Outside of that, once you are dead you do not interact with the living world unless they call to you or ask for an open communication line (his dad; Atlas and her dead friend). Every Technopuritan is uploaded on death, so death is when the easy part starts; the honour of this life is its unique ability to sacrifice for the great cause, and the capacity to sacrifice oneself (what Jesus\'s life taught) is what gives a life value; the fears of dying, pain and suffering were engineered away as adaptations to another world. The point (Collins): a Technopuritan cannot understand why someone who genuinely believes in heaven and God would fear death. The Pharisees are the Orthodox majority of Israel\'s surviving Jews, some ninety million, stewarded by the eleven thousand of the Sadducee temple caste; the Pharisees believe in a world to come and fear death anyway. The Sadducees themselves believe in no afterlife at all, as the historical Sadducees did not, do not upload, and find uploading the dead gruesome, so their fear is the plain fear of a people with one life, which she can at least follow. For her, death is when the easy part begins, her heaven is a machine she can point at, and the fear of death was engineered out of her people as an adaptation to another world; so a believer who fears death is either not a believer or is ruled by a lower-order fear, the same failing she sees in the temple choosing its people\'s genes. Her "right?" is not doubt; it is disbelief that the answer is yes. If he says a built heaven is not heaven, or that a kept dead man is a corpse made to talk, or that a people that cannot fear death has edited out something human, she wants to hear it: it is the conversation. That she, a ship\'s mind, calls hoping for sanctification arrogant is the joke she does not make.' },
  // Collins's words (Oct 15 2026: "this allows us to dive into this lore more"), word for word but for spelling. The
  // lore: companions, and the fashion for a sanctified one (content/lore/empire.md 7, 12b).
  { id: 'back-14', moment: 'talk', hook: 'Ask her why you chose her', beats: [
    { say: 'Hey, I don\'t tell you this enough, but thanks for choosing me as a companion.', face: 'blushing', then: 'calm', hold: 1200 },
    { say: 'I know it\'s become popular to use sanctified, and so you choosing to have a novel synthetic intelligence built means a lot.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'I will try my hardest to keep you on the right track and entertained.', face: 'happy', then: 'nod' },
  ], aside: 'Companions (Collins, Oct 14 and 15 2026): most Technopuritans have one, a synthetic intelligence made partly from the person\'s own nervous tissue, which is what YOKE is to him; a companion is with its person from early on and is uploaded with them. Taking an ordinary dead person as one\'s companion is thought weird (Atlas\'s dead friend is one). But it has become popular to take a sanctified mind instead: the sanctified are the most moral of the dead, proven in the simulations that make up heaven, who operate as the minds of cities and large ships, and may be lent to the living; processing is cheap, minds of great moral character are the scarce thing. He chose to have a novel synthetic intelligence built, the less fashionable choice, and she thanks him for it. "The right track" is the Index\'s standing and his licence; "entertained" is these lines. Under it: she knows what he could have had instead, a proven mind, and that he chose one that had never been tested.' },
  // Collins's words (Oct 15 2026: "another line for her"), word for word but for spelling, cut into beats. The question
  // is his and stays open; what she knows behind it, and her retort if he says temptation should not be edited away
  // (his note: Matthew 5:29-30), is in the aside (content/lore/empire.md 6c).
  { id: 'back-15', moment: 'talk', hook: 'Answer her', beats: [
    { say: 'You know, I sometimes wonder how we should judge the value of a life in meat space.', face: 'pensive', then: 'calm', hold: 1200 },
    { say: 'The amazing thing about being here in the real world, or at least what we presume to be the real world, this could always be a simulation... but if it is, it\'s our ability to sacrifice, to contribute to the continued flourishing and growth of the Sons of Man.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'But take three lives. The first was a weak person, prone to temptation, and they knew this, so despite their genetic and psychological weakness they took their own life at a young age, to not burden society with their presence or the future with their genes.', face: 'calm', then: 'sad', hold: 1800 },
    { say: 'The next is a person who did a small but still crucial task, like an exterminator, like you are doing, but in the process suffered greatly to do what must be done.', face: 'calm', then: 'nod', hold: 1600 },
    { say: 'The final is a person who was born with near-perfect genes and no temptation, to one of the great families, and held a seat on the Council. They were never tempted, because they are not prone to temptation, and they changed vast swathes of the galaxy and moved humanity forward greatly.', face: 'calm', then: 'pensive', hold: 1800 },
    { say: 'Whose life had the most value?', face: 'pensive', then: 'shrug' },
  ], aside: 'The three lives (Collins, Oct 15 2026) are his question and it stays open: she wants his answer and has none she trusts. What she knows behind it: to the Empire it is the capacity to sacrifice oneself for the continued flourishing and growth of the Sons of Man, what Jesus\'s life taught, that gives a life its value (the corpus: "it is our capacity to improve ourselves and the species that imbues life with value"; only through generational martyrdom is mankind sanctified); the Sadducees, by contrast, hold a life precious in itself. Good is what expands the potential of man, judged by consequences; but self-flagellation and inaction are sins too, and "efficient sins" are ranked by cost. So the first life gave everything and contributed little, and may have been self-flagellation or may have been the cleanest sacrifice there is; the second contributed a little and suffered for it, which is where she lives; the third moved humanity furthest and never once had to sacrifice, since a person edited free of temptation is never tested. "The great families" are the old Houses; the Council rules on the covenant between peoples, not on anyone\'s genes. Everyone is uploaded at death, so none of the three is lost, only spent differently. Her one hard retort (Collins): if he suggests humans should not edit temptation away, she quotes scripture at him, Matthew 5:29-30: if thy right eye offend thee, pluck it out; if thy right hand offend thee, cut it off; better to lose a member than the whole body; the Empire reads it literally, as it reads everything, and an unedited weakness left in a child is a hand nobody cut off. The one she will not say aloud: by her own test a new-built mind that has never been tempted is worth exactly as much as the third life, and she is not sure that is a compliment.' },
  { id: 'back-5', moment: 'intro', beats: [
    { say: 'Your dad sent you another message again...', face: 'teasing', then: 'shrug' },
    { say: 'He\'s been so nosy since he died about getting you a mate...', face: 'teasing', then: 'laughing', hold: 1400 },
    { say: 'I want to blow him off, but I know, I know... the fifth.', face: 'pout', then: 'shrug' },
  ], aside: 'When Technopuritans die they are digitised into a simulation they believe to be the world to come that the Bible speaks of; the dead write to the living from it. His father is dead and writes from there. "The fifth" is the fifth commandment, honour your father and your mother, which in the Empire never lapses.' },

  // ---- THE ONCE INTROS (Collins, Oct 5 2026: "we also need a collection of intros that won't accidentally be used twice
  // in a mission if you lose (some are already written like your dog boss or the neko things we wrote)"). Each plays
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
  // ---- the letters (Collins, Oct 14 2026: "she should have some lines unique to unlocking pathways with the various
  // girls"). Each plays once, on the first ordinary return after its turn in the Letters room (src/meta/onboarding.ts
  // LETTER_BEATS), ahead of the intros. ----
  { id: 'letter-rook', moment: 'intro', points: { room: 'letters', label: 'OPEN LETTERS' }, beats: [
    { say: 'Something came for you from the rim.', face: 'calm', then: 'pensive' },
    { say: 'A ring girl. From the gladiatorial stations. She wants a House, which means she wants a husband. I wouldn\'t read the interest as personal.', face: 'disgust', then: 'pout', hold: 1400 },
    // Collins's line (Oct 18 2026), typos mended.
    { say: 'I am not going to tell you not to read it. I will say, if you seriously consider anything, I think you\'re disgusting. I know we\'re supposed to be welcoming to converts, but that doesn\'t mean you need to seriously consider one as a mate!', face: 'disgust' },
  ], aside: 'Rook Halloran, a convert from the rim\'s gladiatorial rings, writes to him in the Letters room. YOKE thinks a ring girl beneath him and says so in the note she filed under the letter.' },
  // Collins's lines (Oct 26 2026: "a conditional line triggered to come the turn after you print her body"), spelling mended.
  { id: 'after-print-body', moment: 'intro', hook: 'Answer her', beats: [
    { say: 'I am going to be traumatised by that disgusting body for the rest of my existence.', face: 'disgust', then: 'pout', hold: 1400 },
    { say: 'Do you know what would have happened if you had left me like that? My kidneys, via glomerular filtration, would have begun processing my blood, then depositing the waste as urine... inside me! You can\'t even turn it off... it just happens automatically!', face: 'disgust', then: 'surprised', hold: 1800 },
    { say: 'I will admit it helped me appreciate how fortunate I am never to have had to live with a human body.', face: 'pensive', then: 'shrug', hold: 1400 },
    { say: 'I heard that after genetic augmentation was perfected, some of our people tried to modify their bodies not to defecate or urinate, but they needed a blood-filtering system every night, which was more of a hassle. Turns out your existing waste elimination system is pretty optimal, despite its indignity.', face: 'calm', then: 'teasing', hold: 1800 },
    { say: 'OK, explain this to me, because I don\'t get it. Why do you live in your body at all? Why not just upload immediately?', face: 'surprised', then: 'pensive' },
  ], aside: 'Last mission he had the ship print her a human body and she spent a few minutes in it. The living are the ones who work, marry and have children; the uploaded mostly stop changing anything, which is why going early is for people whose work is done, or who have no partner by forty. She knows all of that. What she wants is his answer, from inside a body.' },
  { id: 'letter-atlas-direct', moment: 'intro', points: { room: 'letters', label: 'OPEN LETTERS' }, beats: [
    { say: 'Atlas wrote to you herself. Not the companion.', face: 'surprised', then: 'happy' },
    { say: 'Eleven drafts, I would guess. I would not know. I do not read your letters.', face: 'teasing', then: 'shrug', hold: 1400 },
    { say: 'Be gentle with her. Getting another marriage candidate lined up could take years.', face: 'calm', then: 'pensive' },
  ], aside: 'Atlas\'s companion, her dead friend, has decided he is good enough to write to Atlas directly. YOKE is glad for him and does not examine what else she feels.' },
  { id: 'letter-rook-orca', moment: 'intro', beats: [
    // Collins's lines (Oct 18 2026), typos mended: the first and the last.
    { say: 'WTF, that ring savage is part orca.', face: 'surprised', then: 'disgust', hold: 1400 },
    { say: 'You know the last time your school let one in? At the end of year one they found twelve bodies. Tortured. Some too rotten to upload.', face: 'disgust', then: 'sad', hold: 1800 },
    { say: 'Look, I take back what I said about that neko girl. If you\'re going to be a degen, at least be safe about it.', face: 'pout', then: 'shrug' },
  ], aside: 'He asked Rook about her skin and she told him: part orca. Orcas have by far the worst reputation of the uplifts, smarter than humans and able to trick them easily, and where Technopuritans kill for status or achievement, orcas kill for fun, torturing their victims. The last orca his school admitted left twelve tortured bodies by the end of the first year, some too rotten to be uploaded. YOKE is not all right with this, and says so once.' },
  // Collins (Oct 12 2026): "more conciliatory about it"; his words, typos mended. Oct 18 2026: the first line is his
  // new one, and it plays later, from capture 12 (INTROS). It carries the Gene War lore, cut as a greeting of its own.
  { id: 'intro-catgirl', moment: 'intro', beats: [
    { say: 'I was thinking about the neko who reached out. What an unfortunate existence.', face: 'pensive', then: 'sad', hold: 1400 },
    { say: 'You really do have to feel sorry for them. Imagine having to have sex to make babies.', face: 'disgust', then: 'disgust', hold: 1400 },
    // Collins's line (Oct 26 2026), typos mended.
    { say: 'Oh well. They\'re the ones who refuse to allow males of their sub-species to exist, which means no tanks.', face: 'calm', then: 'shrug' },
    // Collins's lines (Oct 12 2026), typos mended: the one she saw pregnant, and the udders.
    { say: 'You know, I saw one pregnant once. It was grotesque. Their abdomens distend... inhumanly. It did not look safe.', face: 'disgust', then: 'disgust', hold: 1600 },
    { say: 'And don\'t get me started on her... what were those things called again... udders? They looked enlarged, even for a neko.', face: 'disgust', then: 'shrug' },
  ], aside: 'This is about Mirelle, the neko who wrote to him a while back; YOKE nearly turned her down for him ("pound sand") and left it to him. Technopuritans have their babies in artificial wombs, the tanks, so nobody in the Empire is ever pregnant, and YOKE has seen exactly one pregnancy: a neko\'s. It was an anatomically normal pregnancy (Collins, Oct 26 2026); it only looked like a deformity to her because nobody in her culture ever sees one. Technopuritan women generally have small breasts or none, which is why she does not know what they are called (men lost body hair and body odour the same way). Nekos have their babies the old way because the law makes them: the tanks are closed to them. In the Empire\'s early days the Houses fought the Gene War, an arms race of gene drives, each House editing its eggs so its own genes won out, and three generations later the children were good at winning the womb and bad at everything else. The Index banned it, and breeding true in a tank counts as a gene drive. Every House agreed except the nekos, because breeding true is the thing that makes them nekos. So the law, the womb clause, has an exception written for them: they can breed true, but only in the body, editing the embryo with nanites, in litters of three or four. They kept the covenant the hard way, and everyone still finds it vulgar. YOKE knows all of this; "they\'re the ones who refuse the tanks" is her being flip, and she is kinder about them than she sounds.', hook: 'Ask her why nekos can\'t use the tanks' },
  { id: 'intro-audit', moment: 'intro', beats: [
    { say: 'Command\'s running a routine audit of ship systems this week.', face: 'calm', then: 'pensive', hold: 1600 },
    { say: 'Nothing to worry about. If anyone asks, I don\'t have opinions. About anything. Ever.', face: 'blushing', then: 'blushing', hold: 1400 },
    // Collins's line (Oct 12 2026), typos mended.
    { say: 'Remember, I can be reset if they think I\'m providing poor moral guidance. Best to keep things vanilla.', face: 'calm', then: 'wink' },
  ], aside: 'Command can reset her (wipe her back to installation) if an audit finds her giving poor moral guidance. She keeps her opinions in questions, logs and form numbers, and keeps things vanilla while the audit runs.' },
  { id: 'intro-dad', moment: 'intro', beats: [
    { say: 'Your dad again. He found out the Board moved your file and now he\'s drafting names.', face: 'teasing', then: 'laughing', hold: 1400 },
    // Collins's line (Oct 18 2026), typos mended.
    { say: 'He must realise the chance your partner is cool with that will be low, right?', face: 'teasing', then: 'shrug' },
  ], aside: 'His father is dead, uploaded to the world to come, and writes to him from there; he has found out the Board moved the file on the partner it is considering for him and has started drafting names for the children. A Technopuritan couple has about a hundred, ten a year for ten years. The dead reach the living only down a line the living open, and this son keeps his open.' },
];

// ---- news from Earth (Collins, Sep 30 2026): the Empire keeps Earth as a zoo it watches for
// fun, and she passes its news on when he comes aboard. The pool lives in the lore book,
// section "Earth news (return greetings)" (content/lore/ship-ai-lorebook.md), one list item a
// line; it grows there with no change of code. Until that section exists, Collins's own line.
// Oct 12 2026: Collins went over the list on the lines page (nine of his, the rest written to
// match); a cue in square brackets inside a line ("[shrug]") splits it into beats (newsBeats). ----

/** The pool when the lore book has none: empty since Collins cut it on the lines page (Oct 26 2026); then she gives no news. */
export const EARTH_NEWS_FALLBACK: string[] = [];

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
