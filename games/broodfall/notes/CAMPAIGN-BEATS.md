# Broodfall: the three campaigns, beat by beat (rewritten Oct 3 2026 to Collins's cut scenes)

Where it all comes from: `content/campaign.ts` (every line of every scene), `content/cutscenes.ts` (how each scene is
shot as a film), and Collins's own text of Oct 3 2026, kept word for word in `notes/CUTSCENES-2026-10-03.md`. This is
the story as a player meets it, written to be read cold.

## How a campaign runs, in one paragraph

You are a junior pest-control technician in orbit, flying a living bioweapon (the "asset") down onto an insect planet,
one territory at a time. Your first win clears the Directive Desk, and on that return YOKE tells you that groups on the
planet are trying to reach the ship: one with a laser, one by radio and, she adds, embarrassed, "someone left coloured
cards in a field". The three are **signals on the planet** at the desk. You can **answer** any of them (its first
interaction plays, and commits you to nothing), and then you **side with ONE, publicly**: your video message to the
whole planet. From then on, every territory you TAKE moves its story along: a "beat" is a cut scene that plays when you
come back aboard after a capture, and most beats lend you a perk that changes the battles. Between beats your ally
sends a running joke after every deployment. When the route is done, its finale territory opens on the globe; take it,
and the finale plays: the creep reaches them, they wake in the archive, and you tell them what a broodfall is.
Halfway along, the other two make you an offer, and you can go over to one of them.

**Every scene is a film** (Collins, Oct 3 2026: "I think videos make sense for all of them"). A film that is baked
plays full screen, the line being said in type under it, and then its card (the perk, the film's poster to watch it
again, the words folded away). A film not made yet is its card, the words read. Made so far: the Delegation's first
summit (the test). The other fifteen are shot lists waiting to be made (`npx vite-node tools/media/cutscenes.ts -- list`).

**You never meet anyone (Collins, Oct 1 2026).** You stay in orbit; only the asset is on the ground. Where a scene has
you standing in front of them (the summit, the prayer hall, the preacher's chambers, every finale) you are there **by
hologram**, from a projector pod the ship drops. On calls you are at your console.

"After N" below means N territories taken since you sided with them.

---

## 1. The Friendship Delegation

**Premise.** They never stop believing you are good. The joke of every scene: they lecture YOU on your moral status,
and you, who are not manipulating them at all, are simply perplexed. Each scene also shows who he is: someone still
figuring things out, open to an idea when he hears a good one.

**Their signal: coloured cards in a field.** Eleven thousand members stand in a field in the Granary Belt holding
coloured cards over their heads for your survey cameras. It spells a letter: they want to understand you, and some of
their pilots have stopped flying. After the summit they call by video feed.

**The beats**
1. **The First Summit** (the first interaction; a film, MADE). A rentable hotel conference room, heavy with it, and a
   summit with snacks. You send down your hologram. They are thrilled. "You are happy to see me. Why?" A species that
   has come as far as yours in technology has obviously evolved past cruelty and violence. "Um. Why would you think
   that?" On their planet technological and moral advancement have almost always gone hand in hand; was it not the
   same on yours? He thinks. He does not see why the two would be linked, but yes, it was. He thinks longer, and
   changes his mind: technology is the physical manifestation of a civilisation with the environment for ordered
   thought, so the link is not crazy. "Yes! Exactly!" They have sympathisers all around the world and can sabotage the
   supply lines. *Perk: Conscientious Objectors:* at the start of each mission, pick one enemy kind, of those that
   mission would bring, that will not come.
2. **The Leaked Plans** (after 1; on a video feed). Their generals are organising a major counter-attack, and here are
   the plans. Why would you do this? Because violence is always wrong. But I will use this to attack your generals
   first, which is still violence. Ah, but you are the other, the immigrant, the guest: any violence you do against
   their people is justified; did they not start shooting the moment you landed? He pinches the bridge of his nose.
   "Sure. I guess that makes sense." *Perk: the Translator:* you see what is in the next wave and where it comes from.
3. **For the Planet** (after 2; a video call). They have held internal conversations to explain why you keep expanding
   in what appears to be a violent manner, and they have figured it out: you hit industry and military power, and never
   once a forest or a reef. You came to save the planet from their exploitative species. Or those are just the most
   natural threat to my unchecked expansion. They thought of that: your forces consume biomatter, so the best plan was
   to land on undefended forests and reefs first and build a stockpile. You did not, which proves you want to protect
   them. They cut the feed. "Unbelievable. It is not like I can carry biomatter from one drop to another. I heard
   there were humans like this in Earth's history. I should look into them."
   → **The midpoint comes here** (see below).
4. **Why Don't You Just Ask Me** (after 3). They call again, having learned so much more about your plans. He cuts in:
   why don't you just ask me? He has a theory, and gives it in the language of his own history books (the Technopuritan
   tradition's): they remind him of a population that gathered under a rainbow flag, kept importing people who
   explicitly wanted to eradicate them, and asserted their own intentions onto them. His actions have made it
   perfectly clear that his goal is to wipe out their species; they do not ask because a world view where they are
   the good guys matters more to them than reality. "Well, that is a relief to hear." "What? I just said my goal is
   your species' eradication!" They are almost all members of the voluntary extinction movement as well. Do you know
   how many tons of toxic gas are produced for every child born? Have you ever heard of the asymmetry principle? He
   cuts the monitor and paces. "Nope. Nope, nope. I must maintain emotional control. That is one of the first
   teachings." *Perk: More Objectors:* two kinds.

**Finale: The Assembly Hall → "The Cycle".** They are in one of the last rooms in a city of creep, and it bursts
through the walls. Then they are in a field, and your hologram appears. "What the fuck is this?" "What I was doing.
Obviously." Weren't you going to eradicate our species? Well, yes: eradicate and digitise you, to speed up your
civilisation's development and remove the injustices of a planet at your stage; and if you do not want that, you can
escape to any paradise you desire from here (an apple appears in his hand). "We thought you were going to end the
cycle. Existence is suffering!" "No, it's not." "It is for me. You can't define my lived experiences." "Well, then
that is, like, your choice." "Feelings are not a choice!" "If you have discipline, they are." "Why won't you just
kill everyone?" "That would be wildly unethical. Look, I don't have time for this. This has been an educational
experience." Back on the ship he takes off a headset: he had no idea what his ancestors had to live through.

---

## 2. The Faithful of the Last Hour

**Premise.** You are the sign: the world must end for the Awaited One to come, so they will help you end it. He is a
Technopuritan and a believer himself, and spends the route trying to talk them out of the suicide vests, and losing
the argument to a preacher who is better at theology than he is.

**Their signal: a sermon on every radio station.** The Voice, a radio preacher: "You are the sign."

**The beats**
1. **Tools for the Mission** (the first interaction). Your hologram appears in a grand religious building (closer to a
   mosque than a church), one preacher bowing before you. Your coming was prophesied: a great figure in a chariot of
   fire, come to cull the rotten people of this world. "Well, come on. You are not that rotten, are you? Not all of
   you." Truly, even he has the heart of a sinner. But you try, with all the capacity God has gifted you? And yet you
   are still here to reap us; we all have our part in God's plan. He scratches his chin. "True enough." The faithful
   will take part in your glorious mission: they have prepared tools (he points at a pile of vests). Cut to him pacing
   on his ship: "Oh, fuck. Were those suicide vests?" *Perk: Sleepers:* martyrs hide in the enemy waves and blow up
   among their own.
2. **It Is Agreed, Then** (after 1). The preacher's chambers, a room like the pope's. "Do you know how hard it has been
   to fucking contact you? Knock off the suicide vest thing." Does it not make your job easier? ... Yes. Then it is
   the will of God; has God given you authority to speak on His behalf? No. He only wants to help: he could uplift
   their congregations first, so they do not have to suffer. So pre-millennial or post-millennial were both possible,
   because it was a choice, and one the preacher must make. Is the soul not edified through suffering? "I really don't
   think you should be making that decision for other people. Or, um. Well. Weird insect monsters." But God has put
   him where he must, so it is His will that it is his decision. "Sure. I guess." *Perk: the Garrison:* their
   militants hold what you take, so no defence deployments.
   → **The midpoint comes after the next territory.**
3. **A Slave to God's Will** (after 3). "Any chance I can talk you out of the suicide vest thing?" Have you beheld the
   glory of God yourself? No. But you are an Ablim, are you not? "Maybe describe an Ablim." In their scriptures:
   warriors more powerful than anything they can imagine, who fly on chariots of fire from the stars and guard God's
   will. "Huh. Yeah. I am probably an Ablim, then." And you are as much a slave to God's will as we are; our scholars
   had long debated that point. *Perk: More Sleepers.*

**Finale: The Seventh City → "That Is a Wrap".** The great central church, the creep bursting in; as it collapses,
everyone is back in the pews, whole, and your hologram appears. "All right, that is a wrap. Thanks for your help." So
we are in heaven? That depends: how did your texts define it? A land where we would await God, living in endless
pleasure. "Yeah. That describes this simulation pretty well." Simulation? Heaven is not made with technology! Did
your texts say that? "This is an abomination!" "You once told me I should not speak on behalf of God. Now I say the
same to you. You do not get to choose the shape of God's miracles." Then the two find out what each thought of the
other: he took the Visitor for a godless alien who had studied the Faith and only pretended to care for the martyrs,
and played along because God makes tools of the witless; the Visitor is honestly shocked: "You thought I was just
playing along this whole time? No. There is a damn reason your religious texts were so predictive of all this."
(The preacher's accusation is rewritten for clarity, as Collins asked; his original is in the notes.)

---

## 3. The Institute for Long-Term Hive Flourishing

**Premise.** The effective-altruism parody; the focus is the hypocrisy. He is sure he is the smartest one in every
room, including yours.

**Leader.** The Director, Eli Bankfried.

**Their signal: a laser on the hull.** Its flashes decode as a video feed; the ship opens it by sending the matching
sequence back down the beam.

**The beats**
1. **A Little Chat** (the first interaction). Feet on the desk, a game console in his hands: "Told you I could do it."
   Do what? Hack your comms system. You did not hack anything; you sent laser flashes and I sent one back. "But we are
   talking now, aren't we? Hacking is as much a mental game as one of technology." The most intelligent and ethically
   disciplined of their species have formed the Institute; they dedicate every moment to the most rational,
   goal-oriented decision in that moment (he says, snorting a line of powder off the desk). Idiot corpos are
   recklessly building artificial intelligences they cannot control; you took out one of their biggest data centres in
   your first fall, so you are on the same page. Anything you need. "The only thing I really need are the bodies of
   your people." That works out great: he has facilities full of them on ice; people will do anything to get out of
   dying. "And they trusted people like you with their frozen bodies? Um. Yeah. Sure. Send them." *Perk: Volunteers:*
   every mission starts with 30 science.
2. **Sex for Fun** (after 1). You keep having me send you frozen old people, but you are a male, right? Don't you want
   any young, hot women? Or guys, no judgment. He thought that was the point of conquering the stars (he holds up a
   magazine: a starship captain with a green one and a blue one on his arms). But our species are not remotely
   compatible. You have just got to be creative. No: at a genetic level. He means sex for fun: most of his partners are
   workers and cannot even get pregnant, and they share partners; it is the most logical way to structure a
   relationship. "Wait. Has your species not discovered masturbation yet?" "Bro. Masturbation is for poor people." He
   cuts the feed. "I need to pray. And take a shower." *Perk: Seed Labs:* you can land anywhere.
3. **Running Out of Frosties** (after 2; no longer a choice). It is getting obvious you are not here just for the data
   centres (so he is not a complete imbecile, the technician thinks). He cannot fight you, and this world order was
   kind of fucked up anyway; they have plans to replace it: quadratic voting, self-verifying contracts. The point: when
   you are done, set him up to rule the rest, and he will help. He is running out of frozen people, so he will
   recruit: he will tell them you are going to digitise them if they surrender, since a simulation costs a species like
   yours nothing. "Sure. I guess. Do that." *Perk: More Volunteers:* +40 war and a royal point.
   → **The midpoint comes on the same return.**

**Finale: The Glass Spires → "What Do You Mean, a Simulation".** His tower surrounded by creep; he runs to a safe
room, shoving others out of the way. Then he and the people in that room are in a serene meadow, and your hologram
appears. You were going to let me rule what is left of my people. "Of course. And I created a simulation where you can
do that." It would be wildly unethical to let someone of his character rule any real population. And what did he
think: if the goal was to kill them it would have been far easier to microwave the planet; there are dozens of planets
in their own system, and theirs was only unique in having sentient life; at the Empire's level scarcity is trivial and
only independently evolved cultures and species have value. So the digitising was real? Of course: that is why he let
him tell people. Why work with him, then? He had people in cryo pods who would have died if the power went off. "Plus,
leaving them with you didn't seem very ethical. I mean, you don't even follow God." What God? Their religion was
bullshit about an apocalypse and living forever in a feel-good fantasy. The hologram gestures at the meadow, and goes.

---

## THE MIDPOINT: switching allies (BUILT Oct 1 2026)

Collins: "it might make sense to have a campaign midpoint where the player has an option to
switch allies ... I would appreciate that as a player."

**When.** Once a campaign, the return after your SECOND territory taken since allying. On that
return, after your ally's beat, the other two factions each make you an offer through their own
channel: the Delegation as a new letter in the field, the Faithful as a word to you on the air,
the Institute as a cold call on the laser. Each offer is written for whoever you're with (the Delegation pities
you for the preacher's book or is appalled by the frozen people; the Voice mocks the field letters
or the gamer; the Director says the field people are "a rounding error" or that you're doing
homework "for a RADIO HOST").

**The choice** is on the cards (and in Comms, if you close them):
- **Go over.** Your old ally's perks stop and its finale never opens. What you saw of its route
  stays in your history (Replay in Comms). It says goodbye in character, and **nobody turns on
  you** (DESIGN.md: "none of them ever turns against you"):
  - the Delegation forgive you in a mile of wheat ("Thank you anyway"; the next field over is a recipe);
  - the Voice finds it in scripture ("Chapter thirty: and the Beast shall walk a while with the
    meek" / "sup with the merchant"; there was no chapter thirty, and now there is);
  - the Director takes it "fine" (his model had you staying at 91%; he'll send a small, symbolic
    invoice for the cryo-lab subjects, or he goes to play a match because you picked the RADIO GUY).
  Your new route starts **one territory in**: your broadcast for the new ally plays (going over is public too), then
  its first two beats, with their perks.
  When you finish it, the ally you left writes once more, right after your finale (a last letter from the field; the Voice's last broadcast, "chapter thirty-one"; the
  Director's recording on the laser: "Solid execution. Not how I'd have done it. The invoice is still open.").
- **Stay.** You keep everything, and your ally hears that you turned the others down and adds a
  thank-you perk:
  - Delegation, *the Pickets:* one MORE enemy kind won't come (on top of the Objectors);
  - Faithful, *the Tithe:* every battle starts with 40 war ("I did not say no. I said nothing for a
    day. Apparently that counts.");
  - Institute, *the Retainer:* every battle starts with 25 more science ("a loyalty-adjusted
    expected-value transfer". It is a bribe.).

**Why it is shaped this way (the 4 / 3 / 3 beats).** The routes aren't the same length: the
Delegation has 4 beats (finale after 3 territories), the Faithful 3 (after 3), the Institute 3
(after 2). Putting the midpoint at the same count for everyone (two territories in) lands it in a
good spot on each route: before the Delegation's big reveal, between the Faithful's prophecy and
the Awaited One, and right on the Institute's ultimatum. The one-territory head start after a
switch keeps a switch from costing a whole extra route. Going over to the Delegation (the long
one) still leaves three more territories to its finale; to the Faithful, two; to the Institute,
one.

**Old saves.** A game saved before Oct 1 that is already past its midpoint gets the offers at its
next return. A finished campaign never does.

**Where it lives.** Rules: `src/meta/campaign.ts` (`finish`, `switchAlly`, `stayLoyal`, `perksOf`).
Words: `midpoint` on each faction in `content/campaign.ts`. Cards and Comms: `src/ui/campaignUi.ts`.
Tests: `tests/midpoint.test.ts`. Browser beat: `node tools/shot-midpoint.mjs` (needs `npm run
build`; screenshots `notes/screens/2026-10-01/midpoint-*.jpg`).

---

## THE LAST MISSION, AFTER THE FINALE (BUILT Oct 4 2026)

Collins (Oct 3): "each of their finales takes place before the last mission against the roach king". (Oct 4): "the
final mission ... starts with a turn count down timer until the military arrives; until then it's only science and
royals ... you will have to start them with a shelter every time on this map".

1. Taking your ally's last landing plays its **finale** (the creep reaches them, the archive, what a broodfall is).
   That is no longer the end of the campaign.
2. The desk then says **ONE LANDING IS LEFT**: the Hive House (a crown on the planet).
3. Pressing DEPLOY there plays what the ship's survey caught, once: **The Transports** (a general of the Host calls the
   Roach King, furious: the transports are sabotaged, and he did it), then **Founding Day** (his last message).
4. **The mission:** a shelter by the body is yours from the first frame and gives war meat every turn it is protected;
   for five turns only the science caste and the court come; then the Host arrives with everything it has, and you hold
   four more waves. Lost, it is still there. Won, the campaign is complete, and his stream goes quiet.

Earlier in the campaign (five territories held) one more private scene is caught after a deployment: **Another
Territory**, his aide's briefing. All three scenes are Collins's words (`notes/ROACH-KING-2026-10-04.md`).

## THE ROACH KING: the other side's leader, from the third deployment (BUILT Oct 1 2026)

Collins: "the core enemy leader is a patriotic upstanding and over the top character ... called the
Roach King (you can have the country's flag be the Texas flag with an insect head instead of a star) ...
I would not have him come in until a couple missions in though and would come from cut scenes."

**Who he is.** President Duke Crawley, "the Roach King": a cockroach-morph royal spare who wrestled
(that was his ring name), then broadcast from his room, then ran for President as a bit and won by the
widest margin since the Unification. The first male President. He loves the Commonwealth, the Host and
the flag, loudly and sincerely; he is not cruel, he is an idiot with a big heart, a gold machine gun and
forty thousand antennae of "chat" he reads out loud. He runs the war from the gaming den of the Hive
House. Full lore and his voice: `content/lore/roach-king.md`.

**The flag.** The Commonwealth's flag, "the Lone Head": the Texas layout, a white roach head where the
star would be (`public/media/roach/flag.webp`).

**How you meet him: never.** He does not know you exist. Every scene of him is one of his addresses to
the nation, caught off the Commonwealth's television band by the ship's survey array and rendered by
YOKE (the INTERCEPTED card, her confidence band, the TV-band hiss under each line, her notes). It plays
on the way back to the ship, after the deployment's news. At most one a deployment.

**His addresses, in the order a campaign meets them** (each once; `content/roachKing.ts`):

1. **An Address to the Nation** (after your 3rd deployment; always his first). Mission 1 is the crash,
   mission 2 opens the desk and the three factions call; by the third the Host's regulars are in the
   waves, which is when a head of state goes on the air. He introduces himself ("Sit down, sit down.
   You are already sitting."), says chat thinks the Growth is a fungus ("Chat is WRONG"), sends in "the
   big girls, with the guns", and ends it by firing the gold gun into the ceiling.
2. **The President Calls Up the Home Levy** (3 territories held). On the Hive House steps, under the
   flag: every sister with four arms and a pulse to her branch-hive. "I did not have training. I had
   heart. And a folding chair." To the Crater Thing: "you are MID."
3. **Operation Take It Back** (the colony's first telegraphed counter-attack). He named it himself; it
   took four hours. "Bells in front, guns behind, me on the stream." The counter-attack you then defend
   is his.
4. **On your ally** (once you've seen two of its beats; once per faction, so if you switch at the
   midpoint he gets round to your new friends too):
   - *The Delegation:* he hates them. "Somebody cut a love letter to the Crater Thing into my wheat. A
     mile high. The second comma is a BARN." "Peace is losing. Slower." "The wheat has a family."
   - *The Faithful:* he goes on The Hour Is Near. Big fan. He did the reading: chapter one is a list of
     cities, and he is pretty sure he is the Awaited One. (You are, meanwhile, building a different one
     out of spare meat.)
   - *The Institute:* the Director is his new adviser. "Plays League of Larvae. Bad at League of Larvae."
     The expected-value table, read upside down, still said they win. The Director keeps asking about
     an upload: "Buddy, I upload every night. Six hours."
5. **The Last Stand** (your ally's finale opens; or 8 territories held if you have no ally). From the
   back of a gilded war beetle at the front: "I am not hiding in a bunker. The bunker is full of my
   merchandise." "Come and get some!" The finale board is his last stand.
6. **The Hive House Stream** (after the finale: the campaign is over). Night, the den, a red glow under
   the door. "Hold on, chat. Something is at the door. Be right back." Then the empty chair, his cape
   over it, the chat still scrolling. Nobody comes back.

Built: `content/roachKing.ts` (the addresses), `src/meta/roachKing.ts` (when), `src/ui/roachKing.ts` (the
player), `tools/media/roachking.ts` (stills, spoken clips, bake). Tests `tests/roachKing.test.ts`; browser
beat `node tools/shot-roachking.mjs`. Contact sheet `notes/screens/2026-10-01/roach-king-sheet.jpg`.

**Open on him, for Collins:** his name (Duke Crawley) and the "first male President, a royal spare"
reading; whether he should also appear ON the finale board (a boss unit) or stay cutscenes only, as now;
and the reveal (PROPOSAL, not built): in the archive he gets a stream with a billion viewers who all
agree with him, and is the only absorbed citizen who has not complained.

---

## OPEN for Collins

**Since Oct 3 2026 the list that matters is in `notes/CUTSCENES-2026-10-03.md`, section 3** (the test film's voices and
pace, his face on screen, the rewritten accusation, "Ablim", forty stations, the asides and midpoint cards that were
written for the scenes before, the retired media, the Roach King's last mission). **The midpoint's cards and the asides
below were written for the scenes before these and still speak of wheat, homework and the Book.** The older items:

1. **Two more beats each for the Faithful and the Institute** (they have 3 against the
   Delegation's 5). Still yours. The midpoint works without them; if they're added, the midpoint
   still lands at two territories in.
2. **The midpoint's cards have no pictures of their own yet** (they show the leader's portrait).
   Every leader line in them is voiced (Oct 1 2026).
5. **The new first contacts (Oct 1 2026, your channels):** the crop letter to "the Visitor and his
   wife" that YOKE has to read out is my invention for "something that heavily embarrasses the
   ship's AI"; swap it if you had something else in mind. YOKE's lines on the cards are read, not
   voiced (her voice comes from her avatar, not the leaders' voice pipeline). The two contact
   pictures were redrawn (the crop letter; the laser from the observatory); their "come alive"
   loops were dropped, so they are still pictures until new loops are made.
6. **The Director's "I can send over some females"** (your exchange, beat 2) is kept word for word:
   it's his offer, never taken up, so it doesn't break "no direct contact". Say if it should change.
3. **Is the Tithe/Retainer/Pickets the right size of thank-you?** They're small on purpose
   (staying should feel like a fine choice, not the obvious one). The scripted balance player
   never switches or stays, so the guardrails are unchanged.
4. **Should the faction you left react in the battles, too?** Today it only writes. Your rule says
   they never turn against you, so nothing hostile was built.
