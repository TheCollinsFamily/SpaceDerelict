# The faction cut scenes, as Collins wrote them (Oct 3 2026)

Collins: "Ok I finally got around to writing all the game faction cut scenes (central plot with roach king still not
done). Build these and create the first video as a test."

This file is three things: what was built from his text, what is his to decide, and his text itself, word for
word as he sent it (section 4), so that nobody has to guess what he wrote.

## 1. What was built

| What he wrote | What is in the game | Where |
|---|---|---|
| Every contact, beat and finale of the three factions | His dialogue, typos mended, each speech cut into lines a clip can carry (at most 22 words, no word in capitals) | `content/campaign.ts` |
| "I think videos make sense for all of them" | Every beat, pledge and finale names a film; a baked film plays full screen with the line in type under it, then its card (perk, poster to watch it again, the words folded away); a film not made yet is its card, the words read | `content/cutscenes.ts` (16 shot lists: 223 shots from 39 pictures), `tools/media/cutscenes.ts`, `src/ui/cutscene.ts`, `src/ui/campaignUi.ts` |
| "create the first video as a test" | **The Delegation's first summit is made and baked**: 14 shots, 88.6 s | `public/media/scenes/delegation-understand.mp4`; a copy with the words burned in on the Desktop |
| YOKE "explains it appears some groups on the planet are trying to contact us ... plainly states the contact methods of the EA and religious group and with embarrassment as an afterthought notes: and someone left coloured cards in a field" | Four lines added to her desk-opening greeting (his three lines of Sep 30 kept in front of them): the laser, the radio, then "And, um... someone left coloured cards in a field." | `content/greetings.ts` `unlock` |
| "at the planet where you choose a mission you can play through the first interaction with any of the groups" | The three are SIGNALS on the planet at the Directive Desk (a pulsing marker each, a card each). ANSWER THEM plays that group's first interaction without siding with it | `meet()` in `src/meta/campaign.ts`; `signalsHtml` in `src/ui/campaignUi.ts`; `src/ui/globe3d.ts` |
| "after which you choose which one you want to publicly side with which takes the part of a video message broadcast to the planet" | SIDE WITH THEM, PUBLICLY (on a signal's card once it is answered, on its first-contact card, and in Comms) plays his broadcast (`pledge`): "We come in peace." / the Hour / "your species is recklessly building advanced artificial intelligence..." | `ally()`; `pledge` on each faction |
| Conscientious Objectors "shows at start of each mission and only shows a pool of units that would have come on that mission" | The pick comes up when he presses DEPLOY, with only the war kinds that mission's directive reaches (measured: never leaves out a kind that came) | `objectorPool()`; `objectorsHtml`; `tools/measure/objector-pool.measure.ts` |
| "each of their finales takes place before the last mission against the roach king" | Each finale is one scene (the creep reaches them, they wake in the archive, he tells them what a broodfall is): the old ending card and the old reveal card in one. It plays when the faction's finale territory is taken. **The last mission against the Roach King is not written, so the campaign still ends there** | `ending` on each faction; `finish()` |
| The Institute's third scene has no choice in it | The rule/pacify choice and its two perks (Kingdom Fund, Pacification) are gone; the beat gives More Volunteers | `content/campaign.ts`, `plan()` |

Checked: `tests/cutscenes.test.ts` (new), `tests/campaign.test.ts`, `tests/midpoint.test.ts`, `tests/media.test.ts`,
`tests/onboarding.test.ts`, `tests/translation.test.ts`; in the real page by clicks, `node tools/shot-cutscenes.mjs --build`
(46 checks, with the breaker's; also on the dev server with `--dev`; screenshots `notes/screens/2026-10-03/cutscenes-*.jpg`;
the persona passes: `notes/PERSONA-CUTSCENES-2026-10-03.md`).

## 2a. The test film, remade (Oct 4 2026)

Collins, of the first test: "this video needs to be rethought ... the moving between looking at him and her doesn't
really work, leads to too much jumpiness and character inconsistency; it's better to see him from behind and make sure
every next video is created with the last video's last frame as its starting point (there is a part where it's just
him talking and this was not used) ... take out the we have snacks line ... for his emotions, those can be conveyed in
his voice."

What changed, for this film and for the other shot lists:
- **One camera, behind him.** One picture (over his hologram's shoulder at the chief delegate, the delegates behind
  her), and the whole film is one take from it. His face is never seen.
- **Every clip starts on the frame the one before it was cut on.** Each clip is transcribed as it is made, cut 0.55 s
  after its last word, and the frame at that cut is the next clip's first frame. The three lines where it is only him
  talking are one continuous stretch.
- **His feelings are directed in his voice** ("perplexed and a little wary", "slower still, thinking aloud, gradually
  persuading himself"); his hologram is given no gesture.
- **The snacks line is out** ("Please, there are snacks."), and with it the two other snack lines that were mine: his log
  on the signal's card ("There will be snacks.") and the closing biscuit shot. The refreshments table is still in the
  room (his description of it).
- **Numbers:** 13 shots, 81.8 s. Words heard: every spoken line at 83% or more. Pitch: he 109-136 Hz, she 176-271 Hz.
  Nobody has listened to it: I cannot.
- **It took four takes**, and what each one taught is in HANDOFF.md "A CHAINED TAKE ROTS UNLESS IT IS HELD": the colour
  drifted (held now), the room filled with drifting motes (taken out of every start frame now), he turned to show his
  face (no gesture, the listeners move, and every link is looked at before the next is made). 49 clips, about $26.50;
  the 13 in the film are about $5.60.
- **What is still not right in it:** in two of his lines he turns his head far enough that his cheek and ear are seen
  (not his face); a few motes of light still drift in the last clips, on the hologram itself; her greeting is pitched
  well above her other lines.

## 2b. Remade again the same evening: acted exchanges on a model that talks

Collins, of the remake above: "the last 20 seconds of the video are a complete mess ... it's like the video goes
static"; and "the words sound like they were generated with AI then the video was created around them; that sounds
stilted and is not good for voice acting; all the frontier video models can do talking".

Both were mine. The static was specks of light that built up clip by clip (I had seen them in the frames and written
"a few motes"). The voices were the video model's own, with no separate voice track; but it was the cheapest Veo, given
one line a clip, each clip cut half a second after its last word and levelled to the same loudness: twelve readings in
a row, and nobody acting a conversation.

- **A comparison first** (`tools/media/talk-test.mjs`): her greeting and his reply, in ONE clip, on six models. The six
  are on his Desktop (`C:\Users\Merry\Desktop\Broodfall cut scenes\voice test (Oct 4)\`). Seedance 2.5 was chosen
  by what can be measured; his ear has the last word.
- **The film is four acted exchanges** (26, 25, 24 and 20 s; 95.1 s in all), three joins. He is seen from behind in
  every frame; there are no specks anywhere in it; brightness and sharpness are measured steady through it
  (`tools/measure/film-steady.py`).
- **What is still not right in it:** its last clip was made through another provider (ImageRouter's account ran out of
  credits) and is a little softer than the first three; in it she walks up close to him. Her voice sits near 160 to 180
  Hz in her calm lines and near 240 to 260 Hz in her two excited ones. Nobody has listened to it: I cannot.
- **Cost:** the four clips about $44; the evening about $97 with the comparison and the clips made again.

## 2. The FIRST test film (Oct 3; rejected Oct 4): how it was made, what it cost

- **Method** (the Roach King's, generalised): a still per camera position, drawn from the faction leader's portrait
  and the approved portrait of the technician (`notes/concepts/2026-09-29/r4-hero-portrait.png`); then ONE clip per
  line on `imagerouter:veo-3.1-lite-i2v` with sound, the speaker saying the line on camera; every clip transcribed
  back and compared with its line; each speaker's pitch compared across the film; the clips cut to their words (by the
  transcript's word times), levelled to -16 LUFS and joined over a quiet room tone.
- **Numbers:** 6 stills (4,000 tokens each at medium, two redrawn), 14 clips made on the first pass (377,300 tokens,
  about $7.55), 2 remade by eye (46,200, $0.92). All in, about **$8.80** for 88.6 seconds. Words heard: 12 of 12 spoken
  lines at 92-100% (the one at 83% is "Um." dropped by the transcriber). Pitch: he 112-125 Hz with one line at 145
  (a question); she 178-211 Hz with one at 246 (the excited "Yes! Exactly!").
- **Two shots were remade after looking at frames:** in the opening the chief delegate's head turned HUMAN for a
  second (the model's failure; the transcript and pitch checks cannot see it: every film must be looked at one frame
  a second, which is how it was caught); in the closing shot the hologram picked a biscuit up, so the closing shot
  is now him declining it and her eating it herself.
- **What I cannot judge and he must:** how the voices SOUND (I cannot hear). The pitch numbers say each speaker
  stays one voice; they do not say whether it is the right voice. And the pace: the model fills each clip with its
  line, so long lines are said slowly (13 words over 7 s). Shorter clips for mid-length lines would tighten it.
- **To make the rest** (15 more films, about 1,370 s of clips at the test's $0.077 a second: roughly $110-130 with the pictures and re-rolls):
  `npx vite-node tools/media/cutscenes.ts -- list`, then for a film `stills <film>`, LOOK at
  `notes/art-review/cutscenes/<film>/`, `clips <film>`, `check <film>`, `sheet <film>`, LOOK, `redo <film> <shot>`
  for a bad one, `bake <film>`. Nothing else has to change: the game plays a film the moment it is baked.

## 3. His to decide (nothing here blocks play)

1. **The voices and the pace of the test film** (above), before the other 15 are made.
2. **His face: DECIDED Oct 4.** He is seen from behind in every film; his feelings are in his voice.
3. **The closing biscuit shot: GONE Oct 4** (it was mine, and he took the snacks line out).
4. **The Faithful's finale was rewritten for clarity, as he asked** ("probably needs a rewrite for clarity that still
   maintains both characters' perspectives"). Only the preacher's accusation changed: "You tricked me! I took you for a
   godless alien who had studied our religion. One who only pretended to care for our martyrs. And I played along,
   because God makes tools of the witless." Then his: "Wait. You thought I was just playing along this whole time? No.
   There is a damn reason your religious texts were so predictive of all this."
5. **"Ablim".** He wrote "album" once and "ablim" twice for the warriors in the preacher's scripture; the game says
   Ablim, and YOKE's note calls it untranslatable.
6. **Forty stations, or tens of thousands?** His note says the Voice is "a radio preacher on 40 stations"; on Oct 1 he
   had it as the same message on tens of thousands of stations at once, so that the ship would notice. The signal's
   card names no number ("every station he has").
7. **"or boys"** in the Director's offer is written "Or guys." (adults, as he meant it).
8. **The pledges.** He gave two as examples ("we come in peace", "your species is recklessly building advanced AI...");
   the Faithful's ("Your scriptures told of one who would come in a chariot of fire. I am told that is me. The Hour is
   near.") is mine.
9. **What was written for the scenes before these and was NOT rewritten by him:** the asides between deployments (the
   Voice still sets him "homework"; the Delegation's letters are still "by field", which fits the cards), the midpoint's
   offers and goodbyes (the Director's cold call still mocks "theology homework for a radio host"; the Delegation's
   letter still says the preacher "has you reading his book"), the Delegation's news clipping (a mile of wheat cut into
   words) and the Roach King's line about a love letter cut into his wheat (a baked clip). They are all voiced, so
   changing a word means making its voice again. Say the word and they are rewritten to the new scenes.
10. **Retired, kept on disk:** the four ending films, the three reveal pictures, the 18 scene pictures and their
    come-alive loops, the voiced lines of the scenes before these, the Awaited One's voice. No scene shows them now.
11. **The Roach King's last mission** (his: "central plot with roach king still not done"). When it is written it goes
    after each finale; today taking the finale territory ends the campaign.

## 4. His text, as sent (Oct 3 2026)

```
Note on campaign writing: This games goal is to combine social commentary with the type of over the top humor red alert 2 was famous for (unabashed over the top B). That said each conversation is supposed to explore some unique and interesting philosophical idea at the same time. The conversations are built as trees with occasional choices where the player can choose one of a couple options or response. Others can just be cinematic videos. The ones that are chains are played in front of looping video to give you the feel there is a living person or rather insect there in front of you.

When the ship ai first announces the choice to you around groups reaching out tot you she explains it appears some groups on the planet are trying to contact us and could be useful in our mission. She then planely states the contact methods of the ea and religious group and with embarasment as an afterthought notes and someone left coloured cards in a field. (note to build after this has been laid out at the planet where you choose a mission you can play through the first interaction with any of the groups after wich you choose wich one you want to to publicly side with wich takes the part of a video message broadcast to the planet  “e.g. we come in peace ... or your species is recklasly building advanced ai and had a chance to rein yourselves in so we have come to resque you from the greedy corporations”) ... actually now that I am writing them I think videos make sense for all of them ... note each of their finalies takes place before the last mission against the roach king

The Friendship Delegation

Contact: 11,000 members spell out a letter in a field with coloured cards, for your survey cameras. They want to understand you, and some of their pilots have stopped flying.
Beats (5)
Understand the Visitor from the start (Video cut scene)
They prepare a summit with snacks. You send down your hologram the room is stylized like one of those rentable conference rooms from hotels (you know heavy vibe). They are thrilled and happy to see you. You ask them perplexed why? Then they explain to you that a species that had evolved technloglogicaly to your extent had obviously evolved past cruelty and violence. You ask “um ...  why would think that” they explain to you technological and moral advancement have almost always gone hand and hand on their planet and ask was it not the same on yours your character things for a bit and replies “I don’t see why the two would be inherently linked but yes we had that pattern on our home plannet as well ... then thinks a bit longer and notes as if changing his mind on this topic ... well I guess if technological advancement is the physical manifestation of a civilization that has the environment for encouraging ordered thought that would likely correlate with moral development as well so the link isn’t crazy” ... they agree with you enthsasticly, then you ask how they can help and they say something about having simathesores around the world and being able to sabotage suplines hampering one type of unit per mission) --- the core joke playing out being that they are essentially lecturing you on your moral status and it also gives a deeper insight into the player character as someone still figuring things out and open to ideas from others


Perk: Conscientious Objectors (pick one enemy kind that won't come ... shows at start of each mission and only shows a pool of units that would have come on that mission)

Stop the War after 1 capture
You get a video feed on your ship of them exsstedly telling you they have information on a major counter attack being organised against your forces. You ask confused why they would do this ... they reply that violence is always wrong ... to wich you reply with confusion that presumably the way you will use ths information is attacking the generals preemptively wich is still violence ... they explain back to you that you are the other the imagrent the guest ... any violence you do against their people is justfied for did they not start shooting you the moment you first landed ... you pinch your knose in frustration and say sure a guess that makes sense (this follows the same joke as the first ne but continues to establish the player character as someone not actively manipulating the group but more perplexed by them)



Perk: The Translator (see the next wave's makeup and entrance)



The Greater Plan after 2
They give you another video call excitedly explaining that they had had a number of internal conversations to try to explain why you continue to expand in what appears to be a violent manner ... then explain that they have figured it out ... if you look at the pattern of your attacks they are hitting the centers of industry and military power and that you have not once yet hit any of the forests reefs or other natural phenon ... this is proof you came to save the planet from their exploitative species ... you reply with some confusion that that could just be because they are the most natural threat to your unchecked expantion ... the then reply that they had thought of that but it can’t be the case because your forces consume biomatter so it would have been best to launch at large undefended biomasses first liek forests and reefs build a huge stock pile and then move out wich is proof you want to project them they then cut the feed ... after the feed is cut you mumble unbelievable, its not like I can carry boimatter from one drop to another, I heard there where humans like this in earths history I should look into them



Nobody's Perfect after 3
The call you up again excited to talk telling you they have talked further and learned more about your plans and this time you cut them off intejecting ... “why don’t you just ask me” they look around a bit confused “oh ....um” you then continue “I have a theory on that ... you remind me a lot of a population from our planets history that gathered under a rainbow flag but kept intentionally importing people from the most violent parts of the planet who explitly wanted to eradicate the rainbow flag people ... they where very loud and very explicit in this goal but the rainbow flab people didn’t care and asserted their own intentions onto the barbarians” (note he is using the language of history books as written by the technopuritan tradition thus the wording) “my actions have made it perfectly clear my goal is to whip out your species you don’t ask because maintaining the world view where you are the good guys and everyone is nice is more important than reality to you” the alien leader then chuckles and says “Well thats a relief to hear” your character cleary at his withs end “WHAT! I just said my goal is your species eradication” ... they then explain they are almost all members of the voluntary extinction movement as well .. then they start lecturing you on how many tons of toxic gass is produced for every child born then go on to and have you ever heard of the asymptry principal ... at that point you cut the monitor and start pacing clearly emotionally overloaded “nope nope nope ... I heard human groups like this where common among the rainbow people .... I must maintain emotional control thats one of the first teachings”



Perk: More Objectors (pick two)
The finally: they are in one the last rooms in a city of creep and its bursting through the walls then it cuts to a scene of them in a field and your hologram appears before them ... their leader approaches you angrily ... “what the fuck is this” you look confused “... what I was doing obviously” “werent you going to eradicate our species?” “well ya eradicate and digitize you so we should speed up your civilisational development by increasing the flow of time and remove all the injustices that happen naturally on a planet at your stage of development ... if you don’t want that you can escape to any paradise you desire from here” you say summoning an apple that digitally apers in your hand “we thought you where going to end the cycle ... existence is suffering” the leader says angrily  you reply non chaulantly “no its not” she replies “well it is for me you can’t define my lived experiences” to wich your character replies “well then thats like your choice” she replies with anger “feelings are not a choice” to wich you reply “if you have discipline they are” to wich screams hysterically “why won’t you just kill everyone” you look a litte shocked and reply “that would be wildly unethical ... look I don’t have time for this ... this has been an educational experience” you hologram then dematerlises and you are in the ship again taking off a head set “Dam I had no idea what my ancestors had to live through in the age when rainbow people ... thankfully they will likely opt out of the simulation for paradises so the rest of their species is unburned by them earlier in the timeline than ours was”


The Faithful of the Last Hour
Contact: The Voice, a radio preacher on 40 stations: You are the sign. The world must end for the Awaited One to come. Let us help you end it.
Beats (3)
Your hologram appears in a grand religious structure (closer to a mosque than a church with one preacher bowing in front of you. “Your coming was prophesied in our texts ... it told a great figure who would in a chariot of fire to cull the rotten people of this world.” you look around taken aback “Well come on your not that rotten are you ... not all of you” the preacher without skipping a beat says “no truly we, even I, have the heart of a sinner” “but you try with all the capacity God has gifted you do you not?” “And yet you are still hear to reap us are you not? We all have our part in God’s plan” he replies ... you scratch your chin in thought ... “true enough” he then stands up and raises his hands “The faithful will take thake part in your glorious mission we have prepared tools to see your mission fullileed he says pointing to a pile of bomb vests”  the feed then cuts to you pacing on your ship “oh fuck where this suide vests ... fuck fuck fuck”


Perk: Sleepers (martyrs hidden in enemy waves blow up their own side)


You appear in the room of the preacher that is grand room reminiscent of the popes room in the vatican. “Do you know how hard its been to fucking contact you” the insctoid puts its hand on its chest and bows “look knock off the sucidie vest thing” to wich he replies “does it not make your job easier?” to wich you begrudgingly afirm “then it is the will of God ... has God given you authority to speak on his behalf” ... to wich you sheepishly reply that no he has not ... “Look I just want to help you guys ... maybe I could uplift your congriations before other people so you don’t have to suffer” ... too wich he replies with a smirk “ah so a pre or post millianilst interaction where both possible because it was a choice ... and one I must make none the less” he then thinks for a bit “is the sould not edified through suffering the deed not made more glarius by its difficulty?” you reply “well I really don’t think you should be making that decision for other people or um ... well weird insect monsters” “but God has put me in a position where I must has he not meaning it is His will its my decision” ... you shrug “sure I guess” he replies ... “it is agreed then we will send militants to help you hold territories so your mission may not be retarted”


Perk: The Garrison (their militants hold your territories, so no defence deployments)


Your holigram appears in his room again ... “any chance I can talk you out of the sucide vest thing” he smirks and raises a hand wisely, “have you beheld the Glory of God yourself” you shake your head he then says “but you are an album are you not” you reply “maybe describe an ablim” “in our holy scriptures there are described powerful beings or warriors more powerful than anything we can imagine that fly on chariots of fire from the stars and guard Gods will” “huh ... ya I am probably an ablim then” he then states “and you are as much a slave to Gods will as we are ... our scholars had long debated that point”



Perk: More Sleepers
Finale, ending, reveal

The large central church is surrounded by creep as its begining to bust in just as it collapses everyone is right back where they where back in the pews and your hologram appears “Alright thats a rap thanks for your help” To wich the head priests responses “so we are in heden?” to wich you reply “I mean depends how did your texts define heden “a landwhere we would await God living in endless pleasure” to wich you nod “ya that describes this simulation pretty well. The head priest then replieis ni horror “simulation! Heden is not a simulation it is not made with technlogy” you reply “um did your texts say that ... did the people when they where written even have the capacity to describe something like this better than the did” the headd priest retorts “this is an abonomination” you reply condesndly “you once told me I should not speak on behalf of God now I say the same to you ... you do not get to choose the shape of Gods miracles” to wich he replies in anger “you tricketed me! You made me believe you where an alien witlesly serving as a tool of God ... that you studied our religion and where manipulating me into thinking you cared for our martyrs ... I played along because it served my goals”  you now look genuine shocked “wait you thought I was just playing along this whole time ... no theres a dam reason your religious texts where so predictive of all this .... ugh ... this is not worth my time” you hologram disappears
(this one probably needs a rewrite for clarity that still maintains both characters perspectives)


The Institute for Long-Term Hive Flourishing
Contact: Director Eli Bankfried you get a laser directed at your ship beaming a pattern thats decodable as a video feed ... you open it up and send a corresponding laser sequence back to its source
Beats (3)
Stop the Machines from the start
On the feed he has his feat on the table with a game console in font of him and turns to someone of screen “told you I could do it” you respond “do what” “ hack your coms system so we could have a little chat my man” to wich you look bewildered “you didn’t hack anything you simple set a wimple set of laser flashes that corrispoded to audio and video feed layers and I sent it back” he puts up one knowing finger “but we are talking now aren’t we you see hacking is as much a mental game as one of technlogy” you shake your head “sure I guess what do you want” “he starts playing his video game while talking “heres the thing my man the most intelligent and ethically diplined among our species have formed an orgnasatiion if you will called The Institute for Long-Term Hive Flourishing” he sets down the game and takes his feat of the table while he talks and pics up a file pouring a line of powder “we dedicate evry moment of our existence to the most rational and goal oriented decision in that moment” he says sniffing the power off the desk “you get me?” ... “any way some idiot corpos who only care pleasure andd money ... what they can extract from the world are reclasly building out impossible to control artificial intelligences just so they will have more money” he gets animated poionting one hand in excitement “well you took out one of their biggest data centers in your first fall wich makes it clear to me we are on the same page anything you need man and I can get it for you” you look a little horfired and taken aback “um well the only thing I really need are the bodies of your people” to wich he lights up “that works out great man I got a few facilities full of tons of us on ice” “you what” you reply in shock, “ya people will do anything to get out of dieing” he chuckles “like they had not even herd or crislisation” then you reply in worry “and they trusted people like you where their frozen bodies ... um ... ya sure send them that will be useful on future broodfalls”.

Perk: Volunteers (+30 science at the start of each mission)


Build the Pipeline after 1
“Um ... where you trying to get in touch with me” he givese you finger guns while still playing his video game “so heres the thing you my man you keep having me send you frozen old people but your a male right” you look around in confusion almost worried “yes ...” well don’t you want any young hot women ... or boys no judgment here man” “what” you reply ini horror “you know like I thought that was the point of conquering the stars getting to fuck hot femails but with like a green or blue tint to them” he holds up a magazine with an inectoid version of krik with a green and blue insectoid hanging on him like that classic image pointing at it “but I wouldn’t be able to reproduce with your women our species are not remotely biologicaly compatible” he sets down the game and leans in “nah man you just got to be creative youd figure something out I am sure I would if I had access to some hot alien mamacitas” you shake your head not just confused “no I mean at a genetic level even with our technology it would be difficult to create a viable offspring we have no shared evolutionary history” to wich he laughs “what are you talking about broh I mean sex for fun most of the women I sleep with are workers and can’t even get preganant you see we firguresd out this better way of structuring relationships where we share partners and I got plenty who would be happy for a beem up” it is car your character is just in utter baphment sputtering “but what about disease risks and the time it would take to court that many partners” “broh broh .... be rational its the most logical way to structure a relationship” your mouth is agape like you just heard the craziest thing in your life and then a relisation hits you and you reply “wait has your species not discovered masterbation yet?” to wich he laughs “bro masterbations for poor people” you cut the feed and say under your breath “I need to pray ... and take a shower”


Perk: Seed Labs (deploy to territories not next to yours)
“You where trying to get in touch with me?” “My man lets have a chat” “So I sent you a lot of frosties and by nnow its getting pretty obvius you are not here just to get rid of data centers.” in your characters head  you hear so he’s not a complete imbcil “so heres the thing I am a rational illogical guy and I know I can’t fight back against you and this world order you are destroying was kind of fucked up any way” ... he then looks excited “we have actually been skating up some plans to replace it for a while have you heard of quadratic voting ok here me out” he gesticulates with his hands “programatic self verifying contracts”  ... than as if he was distracted ... “oh ya the point ... you and I weere friends right so when you are done with whatever you want to do with our planet just set me up to rule the rest and I will help you ... people thats what you want ... well I am running out of frosties so going forward I will have to recruit people my plan is to tell them you are going to digitize them if they willingly surrender because like running a simulation doesn’t cost a species at your level of technology much” you shake your head “sure I guess do that”
Perk: More Volunteers (+40 war and a royal point)
It ends with the tower he is in surrounded by creep then the runs to a safe room pushing others out of the way to get there in the next scene he and the people in the room are in a serene meow and your hologram appears ... he approaches you ... “hey man what the fuck is this shit you where going to let me rule what left of my people” “of course and Ii created a simulation where you can do that” “the fuck do you mean” “well it would be wildely unethical to alow someone of your character rule over any real population of sentient people” “no shit bag ... what do you mean about a simulation” your character looks confused “as you said obviously a species as advanced as mine has the capacity to simulate people at trivial cost ...why did you think we where sending bio organisms to your surface when it would have been much easier to just microwave your planet or force volve an organism that converted your atmosphere into a poisonous gas  if our goal was to kill you” you shake your head futher w “why do you think we where even here? There are dozens of other planets even in your system yours was only unique in having sentient life ... once you reach our level of civlisational complexity scarcity of things like energy and space is trivial only indepndlty evolved cultures and species have value” ... he is clearly livid now “so the digitiaing people thing that was real”  you look around confused “of course thats why I let you tell people it it would be unethical to tell them that if it was not true” “so why why did you want to work with me” “well you had a bunch of people in cry pods who would have ddied if the power went off before the creep got to them seemed like an ieser way to get them plus leaving them with you didn’t seem very ethical I mean you don’t even follow God” he replies “what are you talking about God the religion on our planet was just some bull shit about how there was going to be some apolypse and living forever after death in some bull shit feel good fantisy” to wich you gesture around at the field hes in before your hologram disappearing
```
