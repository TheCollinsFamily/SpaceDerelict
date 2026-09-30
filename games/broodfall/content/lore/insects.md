# The Colony: the insect civilisation of Broodfall (lore)

Collins, Sep 30 2026 (typos mended, substance his):

> "We have to create a doc outlining the insects' culture. They are a eusocial species with large
> clan groups and an economic structure similar to Korea's chaebols, based around royalty that run
> them. Royals are the only ones capable of breeding and lay hundreds of eggs. Most of the species
> is technically barren females (the techbro character is a male, and the women he has sex with
> are of this worker caste). Their planet has one dominant religion, though atheism has started
> becoming common. Hmmm, what else?"

This is the design reference for the people whose city the asset eats: what they are, how they
live, what they believe, and how they meet the invasion. Everything written about them later
(faction lines, unit text, films, news clippings, YOKE's lines, new territories) should fit it.

How to read this file:
- Plain statements are **Collins's words** (above, or quoted from DESIGN.md, the style bible and
  the unit spec) or **existing canon** (content already in the game), with the source beside it.
- **PROPOSAL** marks everything added beyond those two. Collins keeps or strikes it. Where a
  whole section is proposal, its heading says so.
- The shared universe canon is `docs/UNIVERSE.md` (repo root), "The eusocial worlds". The
  Empire's own side is `content/lore/empire.md`. YOKE's view is `content/lore/ship-ai-lorebook.md`,
  sections 6 and 9.
- **Tone.** The document itself is plain. The Empire's in-world excerpts are in its chipper
  newsreel voice. The insects' own words are played completely straight (DESIGN.md, "Tone stack",
  register 3: the insect layer is "only ever glimpsed through cracks, completely straight"). The
  satire is in the mirror, never in a wink.
- **The reveal (Collins, Sep 30 2026).** Everyone the asset absorbs is digitised into an artificial
  heaven shaped to her desires; that is the only reason for a broodfall. It is not said on any route
  until the end. Where it touches this people: the Faith's afterlife (5.2, 5.3, 5.8), the
  Delegation's teaching (6.3), the Institute's upload (6.3), what they know (9.1), the end (12).
  Everything written about them should stay true under it: the insects' own words (a clipping's
  "dead militiaman") say what they believe, and the narrating voice never confirms that the
  absorbed are gone for good.

---

## 0. At a glance

A planet of intelligent eusocial insects at about our 21st-century level of technology, "on the
edge of AI" (style bible, rule 16), with a culture whose manners are those of 1950s America and
whose economy is Korea's: a handful of great clan-conglomerates, each a royal family that is
also a company, owns nearly everything. Only royals breed. A queen lays hundreds of eggs a
clutch, and nearly every egg becomes a barren female worker who spends her life working for the
company that is, quite literally, her mother. Males are few; they are royal by birth, fertile,
and mostly spare. One faith, the Faith of the Sealed Cell (**PROPOSAL** name), holds most of the
planet and blesses the royal order; unbelief is rising in the cities, the laboratories and the
young. Then a meteor falls between a school and a laundromat.

| Term | What it means |
|---|---|
| **Royal / queen** | A fertile female. The only ones who lay. Head of a clan or of one of its branches. (Collins) |
| **Male / consort / spare** | A fertile male, born of a royal clutch. A **consort** is married to a queen; a **spare** is not. (Collins: the techbro is male. Consort: canon, `content/data.ts`. "Spare": PROPOSAL) |
| **Worker** | A barren female: the great majority, in every trade, the soldier included. (Collins) |
| **Clan / House** | A royal lineage and everyone it hatched: family, company and town at once. (Collins: "large clan groups … similar to Korea's chaebols") |
| **The Faith** | The one dominant religion. (Collins) |
| **The Visitor** | What they call the asset (canon: the Delegation's letters). |
| **The Colony** | The production name for the species (style bible). The Empire files them as *fauna*. |

---

## 1. Biology and castes

### 1.1 One species, many bodies (canon)
"One species whose body changes with the job" (style bible, "The Colony's people"). The same
species hatches as upright human-like bodies (commuters, scientists, the queen), as beasts
(skitterlings, the swarm) and as machine-like bodies that are vehicles or guns with small insect
crew (the phalanx, the siege cannon). Each borrows from the real insect that does its verb: the
worker ant for the townsfolk, the soldier ant for the regular, the stag beetle for the guard, the
termite for the sapper, the mantis for the scientist, the termite queen for the queen (unit spec).
Human-like bodies have two legs, four arms with small hands, big amber eyes, antennae that move
like eyebrows, small mandibles for a mouth, and dark umber chitin (style bible, prompt blocks).

### 1.2 What makes a body: the feeding (PROPOSAL)
Every egg in a clutch is the same. What it becomes depends on how the larva is fed in the
nursery: the ordinary feed makes a worker; the heavy feeds make the soldier, the guard and the
flier morphs; the science morphs come from a lean, long feeding (tall, thin, patient); and a
larva fed on **royal jelly** from hatching becomes a princess, a future queen. This is why the
dig finds Royal Ossuaries and why the ship has a Royal Jelly gene (canon: `content/plates.ts`,
"Royal Jelly"; the Royal Diet experiment: "Is it the jelly? I bet it's the jelly").

The consequence is the whole economy (section 2): **whoever controls the jelly controls who is
born royal.** Every great clan's first and oldest asset is its jelly, and each clan's recipe is
its most guarded secret.

Males are the exception: they are not made by feeding but laid as males (**PROPOSAL**: from the
eggs a queen lays unfertilised, as in real bees and ants), a few in every clutch.

### 1.3 Royals (Collins; details PROPOSAL)
"Royalty are the only ones capable of breeding and lay hundreds of eggs."
- **The queen** (canon, unit spec): three times a soldier's height, upright, in white and gold
  with a tall domed jewelled crown, a huge swollen abdomen carried behind her like the train of
  a gown; "regal and tired". She carries a small ornate gold pistol and a radio pack.
- **Laying (PROPOSAL):** a laying queen lays a clutch of two to six hundred eggs about four times
  a year, for a laying life of a century and more. Some thirty thousand laying queens keep a
  planet of about three billion. A queen who stops laying (by age or by vow) is a **dowager**.
- **Budding (canon + PROPOSAL):** a clan grows by raising a princess to queen and setting her up
  over a new hive with its own nursery: a branch, an affiliate, a subsidiary. The Office's own
  forms know this: "Each royal removed is a colony that does not bud" (`content/directives.ts`,
  SO 5-R).
- **Why royals rarely take the field (canon, DESIGN.md):** "Royals only move when you are a
  civilizational crisis." **PROPOSAL:** a queen never leaves her hive except for her wedding and
  for war. Her scent is her daughters' courage: war bodies near her fight harder and take less
  (canon: the presence aura), because every one of them is, very likely, her own child.
- **The veil matron (canon: a royal-caste unit; her place PROPOSAL):** a dowager or a royal who
  never married: the queen's sister or aunt, who runs the household and the court. Her veil is a
  scent screen: the war bodies near her cannot be seen (canon: she cloaks them).

### 1.4 Males (Collins; details PROPOSAL)
Collins: the techbro character is male. Males are rare, fertile, and born only of royal
clutches, so **every male is royal by birth.**
- **About one in five hundred** of a queen's eggs is a male (PROPOSAL).
- **Consorts.** A queen lays fertile clutches only once she is married. Her consort comes from
  another clan, and a marriage is an alliance between companies, negotiated like a merger
  (Korea's chaebol families intermarry; here the merger is the marriage). The consort in the
  game is one of these (canon, unit spec: "an upright officer in a dark green dress uniform with
  gold epaulettes and a gold sash … half the height of the queen"; he promotes war bodies a rank
  every five seconds).
- **Spares.** Most males never marry a queen: there are more princes than thrones. A spare has a
  royal allowance, a royal name and nothing to inherit, because **only queens inherit**. Spares
  go into the officer corps (where a royal male's commission is the custom: that is why the
  consort promotes), into the Faith's higher offices (section 5), into finance, or into founding
  things. They are the planet's playboys, colonels, bishops and startup founders.
- **The Director is a spare** (PROPOSAL, reconciling Collins's "the techbro is a male" with
  canon): Eli Bankfried, "Director, founder, rationalist, investor. Mostly founder"
  (`content/campaign.ts`), a younger son of House Bankfried (section 2.2). He will never inherit
  and has built a life, an Institute and a philosophy out of resenting it. It is why the
  Institute's ultimatum offers "we rule what's left" (a male on a throne would be a first in
  their history) and why the Kingdom Fund perk "invests in its future throne".

### 1.5 The barren majority (Collins; details PROPOSAL)
"Most of the species is technically barren females." Every worker, soldier, scientist, nurse,
pilot and preacher's secretary is a sterile female. "Technically": they have a sex, a sex drive
of sorts (section 7) and working bodies, but they cannot conceive.
- They call one another **sister**, and mean it: most of the people a worker meets in a day were
  laid by the same queen, often in the same clutch.
- **Clutch-sisters** (the ones laid and raised together, a few hundred at a time) are a worker's
  family, school class and first workforce. A clutch is raised together, schooled together and
  posted together, and keeps a reunion every year.

### 1.6 Lifespans (PROPOSAL)
| Who | Lives |
|---|---|
| Worker (ordinary, science morph) | 50 to 60 years |
| War morphs (soldier, guard, flier) | 30 to 40 years; bred for it, spent faster |
| Male | about 70 years |
| Queen | 200 to 300 years; the Great Queen of the capital is said to be over 300 |

A queen outlives many generations of her own daughters. The worker who retires from a company
is served her gold hexagon pin (section 2.5) by the same queen who laid her.

### 1.7 "He" and "she": what the translation does (PROPOSAL; see OPEN 3)
The Empire's translation matrix, and its newsreels, call soldiers and militiamen "he" (the unit
spec does too: the militia's helmet is "far too big for him"). Biologically every one of them is
a barren female. The Empire's 1950s filter hands out 1950s roles: soldiers and cannon crews are
"he", nurses and switchboard girls are "she". The insects' own speech has one ordinary pronoun
for workers and a second, formal one for royals of either sex. The error is the Empire's, is
never corrected in-world, and is one of the cracks through which the insect layer can be
glimpsed (a clipping in which the dead "militiaman" is named as someone's sister).

---

## 2. Clans and the chaebol economy

### 2.1 The company is family, literally (Collins; details PROPOSAL)
Collins: large clan groups with an economic structure similar to Korea's chaebols, based around
royalty that run them. On this world the chaebol's founding lie ("the company is one family") is
simply true. A clan is:
- **a family:** a lineage of queens (the Matriarch, her daughter-queens, their daughter-queens)
  and every worker any of them ever laid;
- **a company:** each queen's hive is a business unit, and the clan's hives together are a
  conglomerate that makes everything from radios to artillery;
- **a town:** each branch-hive is a company town, with its own nursery, school, clinic, temple,
  dormitories, stores and militia.

A worker is born into her employer, schooled by it, housed, fed, married off (in the only sense
available: section 7), buried and prayed for by it. Changing clans is possible, and is about as
common as changing families.

### 2.2 The Great Houses (PROPOSAL)
Seven great clans own most of the planet. Each has a house name (the royal line, and every
member's surname) and a trading face, and each claims that its founding hive was one of the Seven
Cities of the Book (section 5.3). Their emblems are all variations on the plain gold hexagon,
which suits the style bible's rule of no real symbols and gives the art a clan mark for banners,
vans and armbands.

| House | Trading as | Owns | Territories it dominates | Emblem |
|---|---|---|---|---|
| **Amberline** | Amberline & Daughters | The oldest royal line; the capital; the deepest jelly; the royal tombs; land, banks of honey, the Faith's great endowments | Queen's Hollow, the Ossuary Coast | One hexagon, a gold ball inside |
| **Modernway** | Modernway Motors & Foundries | Heavy industry: steel, shipyards, beetle cars, and the war beetles (mortar, siege cannon, phalanx carriers) | Foundry Plains, Old Harbor | Two hexagons joined, like a link of chain |
| **Hexley** | Hexley Electric | Electronics, radio sets, screens, and the first AI models; funds half the universities | the Glass Spires, University Hill, the Hidden Campus | Three hexagons in a row |
| **Luckwell** | Luckwell Home Products | Everything in a kitchen: refrigerators, televisions, ice cream, soap, the suburbs themselves | Cul-de-Sac Heights, the Commuter Ring, the Crash Site | A hexagon with a sunburst |
| **Sheaf** | Sheaf Consolidated Provisions | Food: grain, fungus, nectar, the provision districts' larders | the Granary Belt, the Terraced Fields, Mirewater Delta | A hexagon of wheat |
| **Lamplough** | Lamplough Line | Shipping, tea, silks, hostels; the pilgrim trade | the Pilgrim Road, the Lantern Cities | A hexagon hung like a lantern |
| **Bankfried** | Bankfried Mutual | Finance: insurance, the planetary exchange, honey futures. The Director's family | (no territory; it owns pieces of all of them) | A hexagon split into shares |

The Faith owns a great deal too (the Temple Cities; section 5), and every House endows it.

The names are placeholders in the house style (section 11): 1950s American surnames with a hive
pun, each a nod to a real chaebol (Modernway: Hyundai, "modern"; Hexley's three cells: Samsung,
"three stars"; Luckwell: Lucky-Goldstar) that stops well short of being one.

### 2.3 Succession (PROPOSAL)
- Only queens inherit. The Matriarch names her heir from among her daughter-queens; until she
  does, they compete, each running her branch as an audition.
- **The sibling wars.** The press covers a Matriarch's decline the way it covers a pennant race.
  Daughter-queens buy up each other's affiliates, poach each other's clutches and leak each
  other's scandals. (Korea's succession feuds; the famous scandal of a chaebol heiress ordering
  a plane back to the gate over how she was served nuts becomes a princess who had a Lamplough
  liner turned round over how her honey was served. The papers called it **"Honey Rage"**.)
- **Consorts are traded,** not inherited: a House's spare princes are its diplomatic currency,
  married into other Houses to seal cross-shareholdings.
- **Pardons.** A Matriarch convicted of bribing the Chamber is pardoned by the President within
  the year "for the sake of the economy". Everyone knows this; it is not a scandal, it is the
  weather.

### 2.4 How a queen runs her company-state (PROPOSAL)
- **The Matriarch** sits in her hive in the capital and never leaves it. She lays, receives, and
  decides.
- **The court** does the running: her dowagers and unmarried royal sisters (the veil matrons)
  are her chief officers; her consort chairs the board in her name and commands the House's
  regiments; the managers below are workers of the science morph, promoted by merit and by
  clutch.
- **The branch queens** each run an affiliate as a hive of their own: a foundry town, a harbour,
  a suburb.
- **Cross-shareholding** ties it all together; nobody outside the court can follow who owns what,
  which is the point.

### 2.5 How workers see it (PROPOSAL)
Mostly with love, a little with fear, and very seldom with irony.
- **Lifetime employment.** A worker is posted at the end of school and stays. Her queen is her
  mother, her employer and, in the Faith's teaching, her link to the First Mother (section 5).
- **Morning assembly.** Every workplace begins the day with the House hymn from the rooftop
  loudspeakers (the loudspeaker props are already on the roofs), then calisthenics, then work.
- **The pin.** Thirty years' service earns a gold hexagon pin, presented in person by the queen
  (by her likeness on a screen, at the bigger branches).
- **Loyalty is identity.** "A Luckwell girl" and "a Modernway girl" are types, like a school or a
  hometown: the Luckwell girl is cheerful and domestic, the Modernway girl is sooty and proud.
- **Grumbling is allowed; leaving is not done.** Workers complain about quotas, dormitory food
  and the heir apparent, and unionism exists, weakly (section 4). The workers most likely to
  question the order are the ones the order made cleverest: the science caste (section 6).

### 2.6 The 1950s corporate flavour (PROPOSAL; the look is canon)
The suburb tile set is an American suburb of the 1950s (style bible), and the films are 1950s
B-movies. The culture fits the look: company picnics, bowling leagues, employee-of-the-month
photographs, the company song, the company magazine (*The Amberline Hive-Light*), the organisation
woman in a grey flannel kaftan, advertising with a smiling insect face (the megacity's billboard
prop), ice-cream vans (a Luckwell product), beetle-shaped family cars with white-wall tyres. The
technology under it is 21st-century (satellite dishes, screens, AI labs, a video game); the
manners are the Eisenhower years. The Empire's filter exaggerates the 1950s, but it did not
invent it.

---

## 3. Cities and daily life

### 3.1 How they build (canon, style bible)
Their own architecture first: pale wasp paper, wax and resin, walls of honeycomb cells, ribbed
arches, round cell doorways; Orthodox forms grown into it (paper onion domes like hanging nests,
arcades, gold mosaic in the wax, bell towers like nest spires); and 21st-century technology bolted
on (solar panels, dishes, masts, air conditioners, cables, traffic lights, screens of abstract
glyphs, beetle cars). Every block has a wide flat roof terrace. Domes end in a plain gold ball.

### 3.2 The kinds of place (the ten tile sets, `tools/art/biomes.mjs`)
Every set is the same species building in its own way and borrowing one look. What each place is
in their world is **PROPOSAL** except where it quotes a territory's story (`content/campaign.ts`).

| Set | What it is in their world | Territories |
|---|---|---|
| `orthodox` The Temple Cities | The Faith's own cities: cathedral hives, seminaries, bell towers, the pilgrims' destinations. Owned by the Faith, endowed by every House. | Temple Terraces ("the bells have been ringing since the crater opened"), the Seventh City, the Assembly Hall |
| `suburb` The Suburbs | Where the worker lives once she has her own cell: Luckwell's company suburbs of pastel paper, porches, wax picket fences, dandelion-clock trees, a civil-defence siren on the corner | Crash Site ("between a school and a laundromat"), Cul-de-Sac Heights ("a neighbourhood watch that has never watched anything like this"), the Commuter Ring |
| `megacity` The Megacity | The young, clever, sleepless city of Hexley money: labs, capsule dormitories, noodle stalls on roofs, neon glyphs, surveillance posts. The home of unbelief (section 6) | University Hill, the Glass Spires, the Hidden Campus |
| `orient` The Lantern Cities | The old south of Lamplough trade and pilgrim hostels: lacquer and jade eaves, lanterns, gongs, tea pavilions, guardian beetles in stone. (The Far East as a 1950s Western film imagined it, not any real country.) | the Pilgrim Road |
| `industrial` The Works | Modernway's port and factory towns: soot, rivets, furnace light, cranes, a works emblem of riveted iron on the roof | Old Harbor, Foundry Plains ("where their armies are made") |
| `farmland` The Granary Belt | Sheaf's farm towns: red barns, silos, wind pumps | (the town round the Granary Belt) |
| `terraces` The Terraced Fields | Open farmed country cut into terraces | the Granary Belt ("silos from horizon to horizon") |
| `wetland` The Mirewater Delta | Reed-cities on stilts: fungus farms, fishing, the delta poor | Mirewater Delta |
| `necropolis` The Ossuary Coast | The royal dead: bone-white chalk cliffs of niches and urns, black iron, candles, fungus cypresses. Only royals are laid to rest here (section 5.5) | the Ossuary Coast ("one of them is not resting") |
| `deephive` The Deep Hive | The oldest part of the civilisation, grown rather than built: amber comb, brood cells, royal jelly, queen cells. The Great Queen's own hive, under the capital | Queen's Hollow ("whoever holds it holds the planet") |

### 3.3 The districts of a board (canon names, `content/plates.ts`)
- **Residential Warren:** dense housing, clutch dormitories and family cells.
- **Research Quarter:** "field stations here" (+3 interest): the academies' annexes and clan labs.
- **Provision District:** "rich larders": honey-pot jars, granaries, the nurseries' kitchens.
- **Temple Heights:** tall architecture, the Faith's high ground.
Underground (canon, `content/underground.ts`): sewer mains, severed power mains, aquifers,
carrion pockets, buried research labs, **Ancient Royal Tombs** far down. **PROPOSAL:** every old
city stands on older ones; the royal tombs under an ordinary suburb are from before the clans
moved the royal dead to the Ossuary Coast.

### 3.4 A worker's day (PROPOSAL)
Up at the siren; the House hymn from the roof; calisthenics with her clutch-sisters; the commute
round the Ring in a beetle bus ("every road on the continent meets here, twice a day, at the same
time"); a shift at the plant; nectar and fungus at the canteen; the evening radio; a chapter of
the Book or a match of *League of Larvae*, depending on the worker; lights out. Once a week the
temple; once a year the clutch reunion; once in a lifetime, if she is lucky, a place in the crowd
at a royal wedding.

### 3.5 The nursery (canon + PROPOSAL)
Every branch-hive keeps its nursery at its heart: the queen's clutches, the feeding halls, the
jelly room behind a steel door. The character calls the spawn gates "basically their nurseries"
(the Nursery Visit experiment, `content/campaign.ts`). **PROPOSAL:** the skitterlings are exactly
what they look like (unit spec: "a tiny round hatchling … bare, with one dab of orange paint"):
when a hive is threatened, its unfed young are marked and sent out. The splitter is a nursery
porter carrying two of them in a pannier. It is the most terrible thing the colony does, and it
does it without a word. The game never comments on it; the pictures do.

---

## 4. Government and politics (PROPOSAL)

- **One planet, one state:** the **Commonwealth**, a single planetary republic since the
  Unification a little over a century ago, which ended the last of the Clan Wars. (The phalanx's
  painted panels and the elite's gilded helmets are those wars' heraldry, kept for parade.)
- **On paper:** an elected **Chamber** of worker deputies, which met in the Assembly Hall in the
  south until the Chamber moved to the capital; a **President** elected every six years; courts;
  a free press.
- **In practice:** the Great Houses. They own the newspapers, fund the parties, employ the
  voters, and marry each other. The President is a worker, always of a Great House, and swears
  on the Book (section 5).
- **The Great Queen** of House Amberline is head of nothing and mother of the nation, and nobody
  holds an office she has not blessed.
- **Politics** runs on three quarrels that were old before the Visitor came:
  1. **The clutch question:** should queens lay less? The antinatalists (the Delegation,
     section 6.3) say yes; the Houses and the Faith say the question is obscene.
  2. **The jelly question:** should the recipes be public? Reformers want princesses raised by
     lot, so that any worker larva could be royal; the Houses call it communism.
  3. **The machine question:** should the new AI models be allowed? Hexley is building them;
     the Faith fears them; the Institute wants them shut "for safety" (canon).
- **Unions** exist in the Works and the harbour, and are weak everywhere a worker's employer is
  her mother.

---

## 5. The Faith (Collins: "one dominant religion"; everything below PROPOSAL unless marked)

### 5.1 What it is
The **Faith of the Sealed Cell**, called simply the Faith. Four in five of the planet say they
hold it; fewer every year mean it (section 6). It blesses the royal order, marks every stage of
life, owns the Temple Cities, and sounds the bells.

### 5.2 Doctrine
- **The First Mother** laid the world as an egg in a sealed cell. The world is not finished: it
  is a larva, growing in the dark under the cap of the sky.
- **Every queen is a daughter of the First Mother,** and every worker is a daughter of a queen.
  So the royal order is holy, the clutch is sacred, and the one who lays is closest to God. (It
  is very convenient for the Houses. Nobody in the Faith has ever put it that way.)
- **The Hour.** At the end, the cap of the sky will crack, the world will emerge from its cell
  as an adult creature does from its pupa, and the **Awaited One**, the Firstborn, will come
  out first. The faithful will emerge with it; the unfaithful will stay sealed. "The Hour" is the
  name both confessions use for the end (canon, DESIGN.md).
- **So a thing that falls from the sky is a sign.** A crack in the cap. This is why the Voice's
  first broadcast is "LOOK UP" (canon), and why the Visitor was theology before it was a news
  story.
- **The body is good; waste is sin.** Clutch, labour and the dead are all returned to the comb.
  (The mirror: the Technopuritans find the body disgusting; the Faith finds it holy.)
- **The Comb Above (the afterlife; Collins, Sep 30 2026: it is "exactly what their religion
  claims happens after death"; the name and imagery PROPOSAL).** At the Hour, those the sky takes
  up "shall not be lost, but kept, each daughter in the cell of her longing": every soul wakes in
  a hall made to what she most wanted, a worker in a queen's hall, a queen in her first clutch.
  **It is true.** The asset's absorption is digitisation into exactly such a heaven (`docs/UNIVERSE.md`,
  "What a broodfall is for"; `content/lore/empire.md`, section 12a). The Book was accurate about
  the apocalypse and about the heaven after. The player is not told until the end of the Faithful's
  route; before then every line of it reads as coincidence, or as the Voice's "that is how prophecy
  works".
- **The Pit: the one part that is not accurate (Collins, Sep 30 2026; the name and chapter
  PROPOSAL).** Chapter twenty-two promises the wicked a Pit where they burn for ever. There is
  none. People judged too morally corrupted are simply not simulated: no torment, they are just
  not kept. Those near the line are kept in private simulations until they improve. And the
  archived wake without the broodfall in their memories. (**PROPOSAL:** the Book also says the
  unfaithful stay sealed; the archive keeps decent empties along with believers, which adds to
  the Faithful's fury, section 5.8.)

### 5.3 The Book (canon, `content/campaign.ts`; the reading of it PROPOSAL)
**The Book**, formally *the Book of the Seven Cities*. What is known of it from the campaign:
chapter one is the Seven Cities ("a list of cities with adjectives"); chapter two is the same list
in a different order; chapter nine is the Four Beasts; chapter fourteen contradicts chapter nine
("the most sacred part"); there is a day of the three lamps; "and the river shall run with fire,
and the terraces shall fall silent"; the Seventh City falls last, and when it falls, He comes.
- The Seven Cities are the cities of the First Mother's first seven daughters, and every Great
  House claims one of them as its own founding hive.
- The Book is read aloud a chapter a night, is argued over by commentaries on commentaries (the
  character reads "a pamphlet about the commentaries"), and is never wrong, because it is read
  again until it is right.
- **Chapter twenty (canon since Sep 30 2026, `content/campaign.ts`):** the Comb Above, "where every
  sister taken up wakes in the hall she dreamed of". The verse the Voice quotes in "Fulfil the
  Prophecies": "And those the sky takes up shall not be lost, but kept, each daughter in the cell
  of her longing." The character says "That one is correct", which the player reads as a joke. It
  is not one.
- **Chapter twenty-one (PROPOSAL, from Collins's resynthesis, Sep 30 2026):** the saints return.
  Those kept in the Comb Above grow in it, and "when the Comb is full the saints come down through
  the cap in new bodies". It describes resynthesis: an archived people run fast until it is fit to
  join the Sons of Man, then printed back into the world (`docs/UNIVERSE.md`, "What a broodfall
  is for"). **The Technopuritan reading (Collins):** a scripture this accurate is not luck; God
  likely steered it toward what would really happen, as the corpus says God revealed to each
  people what it could hold (TP 12.0).

### 5.4 The two confessions
The Faith is one religion in two confessions who share the Book and damn each other's reading
of it: **the Bell** and **the Lamp**. The Bell rings the hours and dresses the army; the Lamp
keeps the day of the three lamps and the southern shrines. Each says the other's book is a
corruption; the Voice says the other faith's book is "a forgery of our forgery" (canon). Neither
is drawn after a real one. DESIGN.md asks for exactly this: "vague enough that players of each
group assume it's the other". Which confession the Voice belongs to is never said.

### 5.5 Clergy and rites
- **Clergy:** the **wardens** (the ordinary clergy, workers, as everyone is), the nursing orders
  (the tender's "sister of mercy in a pale habit and white veil", canon), the teaching and scout
  orders in hooded habits (the stalker's and the tunneler's habits, canon). The high sees are
  held by **royal males**, vowed never to marry: a spare's seed given to God. (So the Faith is
  the one institution where males rule, which is why so many spares enter it, and why the Voice
  opens with "brothers" to a congregation of forty million sisters and a few hundred brothers.)
- **The Capping:** a newly hatched clutch is blessed as its cells are capped. Birth.
- **The Pin:** coming of age, at the end of school, when a worker is posted.
- **The Wedding:** a royal marriage is the Faith's great sacrament, a queen's nuptial flight
  over the capital with every bell on the planet ringing. The only wedding a worker will ever
  attend, on television.
- **The Uncapping:** death. A worker's body is returned to the comb (composted into the
  provision districts' fungus beds, with a prayer); a royal's is carried to the Ossuary Coast and
  sealed in a niche of chalk, to be uncapped at the Hour.
- **The hours:** bells at dawn, noon, dusk and midnight (the bell towers, the belfries, the
  drummer's yoke of bells, canon).

### 5.6 Iconography (the style bible's rule, and the invented symbols)
**No real religious symbol, ever** (style bible). The Faith's own marks, which every picture may
use:
- **The hexagon:** the Cell. The one emblem (canon). Worn as a pin, pressed in mosaic, painted
  on shields.
- **The gold ball:** the Egg. It crowns every dome (canon); PROPOSAL: it is the world-egg, and a
  dome is a capped cell with the world inside it.
- **The capped dome:** the onion dome itself is the brood cell's cap. A temple is a cell in which
  the faithful wait.
- **The three lamps:** the Lamp confession's sign (a row of three amber lamps; the traffic-light
  prop is a joke nobody on the planet makes).
- **Bells** for the Bell confession.
- **Saints:** insects, painted on panels (the phalanx's "screen of icons whose saints are insects",
  canon): nursing saints, martyred queens, the First Seven Daughters.
- **The censer:** the rite's smoke; in war, the bomber's bomb (canon).
- **The gesture (PROPOSAL):** touching the antennae to the six points of an invisible hexagon.
- **The oldest icons (Collins, Sep 30 2026: "spaceship-looking images in early religious art";
  the details PROPOSAL).** The earliest panels and cave-comb frescoes, older than the Bell and
  the Lamp, show things the Faith has argued about for a thousand years:
  - **The Chariot of the Hour:** a ring of light with a dark hub, hanging over the First City,
    rays falling from its rim onto the terraces. The commentaries call it the First Mother's eye.
    It is the shape of a ship in orbit.
  - **The Seed from the Ring:** a small burning egg dropped from the Chariot into a city, and the
    ground around it turning to red comb. The meteor, and the creep.
  - **The Great Cap:** the whole world drawn under one sealed cap, its people rising through it as
    points of light into a second comb above, each point in its own gold cell. The archive.
  - **The Returning Saints:** the same points of light coming back down through the cap, wearing
    new bodies. Resynthesis (below, 5.3, chapter twenty-one).
  Nobody on the planet reads them as machines. The character does, at once, and uses them at the
  end to persuade the Voice (5.8).

### 5.7 The Temple Cities (canon set; PROPOSAL detail)
The Temple Terraces (a hill of shrines, a royal directive: a queen lives there under the Faith's
protection), the Seventh City (the last city of the prophecy; the Voice "has been broadcasting its
fall for thirty years"), and the Assembly Hall. The Pilgrim Road ("a thousand miles of shrines and
road-stalls, walked by millions every year. Not this year") runs from the Temple Terraces to the
Seventh City.

### 5.8 The Faithful of the Last Hour (canon, DESIGN.md; placing them PROPOSAL)
The Faith's apocalyptic wing, not a separate religion: a radio ministry, the Voice's *The Hour Is
Near* on the forty stations of the Last Hour Radio Network, which the respectable wardens deplore
and every warden's congregation listens to. They have waited for the crack in the sky for
generations. The Visitor is the answer to their prayers, and their militants and martyrs (the
Sleepers and Garrison perks) are drawn from the Bell's regiments and the censer-bearers. Their
route ends with an artificial messiah; "to their knowledge everything worked out".

**Then they arrive (the reveal; Collins, Sep 30 2026).** The Voice wakes in the Comb Above with
his congregation, exactly as chapter twenty said, and is **angry**, which confuses the character:
it is precisely what their religion claims happens after death, so most of their texts were
accurate and predictive about the apocalypse and about the heaven after. The Technopuritan
character believes God likely influenced their scripture to make it accurate, and does not much
care if they complain: he can always delete the whole congregation from the archive if they want.
Why the Voice is angry, as he says it (**PROPOSAL**): the heaven was made by a machine and not by
the First Mother, the empties got in too. And, above all (Collins): there is no Pit. They want
the wicked tortured in a hell-like place, and the wicked are simply not kept. "No PIT? Then what
was the point of being GOOD?"

**The character was never humouring them (Collins, Sep 30 2026).** The player thinks he is a
sociopath puppeting a messianic return: the homework, the sneering logs, the contingency messiah
"made of spare meat and a very good voice box". In fact he did it because he believed it was his
JOB to fulfil the prophecy: their religion accurately predicted his coming, their eradication and
their upload, so to a Technopuritan it came from the one true God. At the reveal he tries to
persuade them to take the offer, that this really is what their texts predicted, pointing to the
oldest icons (5.6: the ring-shaped Chariot over the First City, the world under one cap) and to
chapter twenty-one's returning saints. The misdirection holds until then: nothing on the route
says he believes.

---

## 6. Unbelief: the rise of atheism (Collins: "atheism has started becoming common")

### 6.1 Where it lives (PROPOSAL)
One in five of the planet's under-thirties now tells the census "no faith". It is strongest:
- **in the science caste,** whom the clans raised to think, and who think;
- **in the Megacity,** among the young, the sleepless and the unmarried-for-life (which is all of
  them);
- **in the Works,** among union members who noticed who the Faith's doctrine suits.

The faithful call them **empties** (an empty cell: something that never hatched). They call
themselves **open** or **clear**.

### 6.2 Why it is dangerous (PROPOSAL)
If there is no First Mother, there is no reason a queen should own a worker's life. Unbelief is
not only a question of heaven: it is the jelly question and the clutch question in another
form. So the Houses quietly fund the Faith, the President swears on the Book, and the Last Hour's
radio grows fastest exactly where unbelief does.

### 6.3 The two secular factions (canon, reconciled)
The game's two non-religious factions are the secular side of this, one sentimental and one
clever:
- **The Friendship Delegation** (canon: really the Voluntary Extinction Society, "campaigning
  for this for sixty years"): the gentle unbelievers. **PROPOSAL:** they are antinatalists in a
  species where only queens breed, so their politics is a demand that queens stop laying; their
  newsletter is *Gentle Endings*; their members are idealistic workers, pilots who will not fly,
  and a few dowagers who took a vow not to lay. To them the Visitor is the planet's immune
  response to a species that should not have hatched. (Collins: "they never stop believing you are
  good"; the believers who have left the Faith turn out to believe harder than anyone.)
  **Reconciled with Collins, Sep 30 2026 ("the peacenik group ... they are a Buddhist-like
  group"): they are both.** Their unbelief is in the First Mother, not in everything: they hold a
  non-theistic, Buddhist-like teaching (**PROPOSAL:** they call it **the Stilling**) that life is a
  wheel of wanting, hatching, having and wanting again, that the wanting is the suffering, and that
  the only mercy is for the wheel to stop. Antinatalism is that teaching applied to a species in
  which queens lay hundreds: stop the laying and the wheel stops. "Sentimental atheists" and
  "antinatalists" both still describe them; the Stilling is what they are atheists and
  antinatalists *for*. Their newsletter *Gentle Endings* and their answer to a child ("where the
  Visitor takes the ones it eats: nowhere, and never again", `content/campaign.ts`) are the
  Stilling's hope.
  **The reveal lands on them hardest (Collins):** they are mortified, because the archive means
  the cycle of suffering will never stop. A heaven cut to each one's desires is the wheel itself,
  made endless and comfortable. They beg to be switched off. The character shrugs: it goes against
  ethical protocols to shut the whole thing down over their complaints. Worse (Collins: the
  archived wake without the broodfall in their memories; **PROPOSAL** that this is the last
  blow for them): past the gate they will not even remember that the wheel is turning.
- **The Institute for Long-Term Hive Flourishing** (canon): the clever unbelievers. Rationalist,
  expected-value, afraid of their own AI; funded by spare princes and House money. **PROPOSAL:**
  the Institute's founding essay is an argument that the Faith is false and the Houses are
  inefficient, written by a prince of a House, paid for by the House.
  **The upload (Collins, Sep 30 2026).** The character offers to upload their people into a
  virtual world where they live forever; the Institute sends cryo-lab subjects "for upload", and
  he "fed them to the asset" (canon). The Institute, and the player with them, take the upload
  for a lie: the Institute plays along to buy time (the Director's wink, "Great bit. Keep it
  running", `content/campaign.ts`). It was never a lie: feeding a mind to the asset IS the upload.
  At the end the Director wakes inside the archive, shocked that the character really was
  digitising everything; the moment it is no longer their choice, the Institute starts to
  bargain (admin rights, a body back outside, an expected-value table), and the character is not
  having it and cuts comms. The ending's line "The upload chamber is a door into the asset's gut.
  Did not mention this. He did not ask." stays true word for word.
  **What else lands on them (Collins, Sep 30 2026):** the planet's dominant religion, which the
  Institute looks down on, was CORRECT, and the character had always assumed they knew it. He is
  surprised they are shocked, for several reasons: the cost (if eradication were the goal, why not
  just gas or irradiate the planet?), and why they would think their planet was special in the first
  place: the universe is full of planets; he came to this one because it had sentient life, and an
  independently evolved culture is the one thing the Empire cannot easily produce. And
  "Long-Term Hive Flourishing" was, literally, the plan: an archived people run fast and, once it
  can add to the Sons of Man, is printed back out. The Director himself is near the moral line
  (Collins): he is kept in a private simulation until he improves, where he will likely believe
  he runs the world. The character lets it slip at the end: very flattering, very private, and
  he will not remember the call.

The Faith sees both as the same heresy wearing different clothes. It is not wrong.

---

## 7. Sex and romance among a barren majority

### 7.1 Workers (PROPOSAL)
Workers are barren, not sexless. Romance among them is ordinary, public and blessed by the Faith
as **sisterhood of the cell**: two workers who pair set up in a two-cell flat in the suburbs, go
to the bowling league together and are called "a pair". Romance novels, radio serials and
advice columns are about pairs. Nothing in it can lead to a clutch, so nothing in it worries the
Houses.

### 7.2 Males (Collins; details PROPOSAL)
Collins: the techbro is male, and the women he sleeps with are of the worker caste. A male can
sleep with a worker and nothing will come of it: she cannot conceive. So for a male it is pure
recreation, which the Faith calls **barren sin** (the seed of a royal line, wasted) and which the
tabloids live on. A spare prince with a "cell" of worker companions is a stock figure: in the
Faith's eyes a scandal, in the Institute's circles a lifestyle ("relationship anarchy", filed as an
"alignment strategy", canon).

### 7.3 The Director's offer (canon, reconciled)
"If you ever want company, I can send over some females" (`content/campaign.ts`, "Females").
- To him "females" means "people": nearly everyone he knows is one. His companions are his
  staff, worker-caste researchers at the Institute (Collins's "polyamorous relationships with
  their underlings", DESIGN.md).
- "You don't get them PREGNANT" is not a boast about precautions: it is biology. They cannot be.
- The joke runs both ways. The technician (Technopuritan, disgusted by the body, sex "offensively
  inefficient", `docs/UNIVERSE.md`) cannot see why anyone would; the Director, a royal male in a
  species where sex is either dynastic or pointless, cannot see why anyone would not. Each has
  built a whole morality around the only kind of breeding his species allows, and each thinks the
  other one is the primitive.
- Keep it wry. Nothing is ever shown; the Director talks, the technician asks about dysgenics, and
  the Director goes back to his match.

### 7.4 The Love Gas and the wedding musk (canon, reconciled)
The Love Gas experiment makes lure glands give off "THEIR mating pheromone": war bodies in the
cloud "stop fighting and pair off (a long stun), but every pair adds a body to the next wave". The
hobby gene **Wedding Musk** is the tamed version ("nobody extra comes next wave").
**PROPOSAL, how it works:** the mating pheromone is the royal wedding scent, the smell of a
nuptial flight. Workers who breathe it do what workers do at a royal wedding: they turn to the
sister beside them and pair (a worker in love is not a worker in a firefight). The scent also
drifts into the nurseries, where every queen who smells a wedding lays: hence the extra bodies
next week. ("Science says: they stop fighting. Science also says: more of them next week.")

### 7.5 The mirror (PROPOSAL, for YOKE and the writers; never stated in-world)
The technician's whole goal is a procreation licence. On this planet only royals may breed: every
worker is a lifelong member of the unlicensed, and none of them expects anything else. The
Empire's austerity and the insects' royal order agree on one thing, that the right to have
children belongs to the few, and neither side ever notices.

---

## 8. The military, and how they meet the invasion

### 8.1 The forces (PROPOSAL)
- **The Host:** the Commonwealth's regular army, of war-morph workers. Its divisions are raised
  and paid for by the Houses (the Modernway Third Armoured, the Amberline Household Guard), and it
  dresses in the Bell's Orthodox style (style bible: "war and royal castes dress Eastern Orthodox")
  because the regiments were church armies before the Unification.
- **The Home Levy:** the militia. Ordinary townsfolk in their own clothes with an orange sash
  (canon), raised by each branch-hive in a crisis.
- **The Civil Watch:** the responders, the parish watchmen who are first to everything.
- **The Air Wing:** the wasp-morph fliers.
- **The religious orders:** nursing sisters, bell-ringers, censer-bearers and hooded scouts serve
  with the Host as they always have.
- **The academies** (the science caste) never fight (canon: "the science caste … never fights").
  They come to study.
- **The royal court** takes the field only in a crisis (canon).

### 8.2 Every enemy kind as an institution
The canon is the unit spec (`assets/unit-spec.md`) and DESIGN.md; the second column is
**PROPOSAL**.

| Kind (game id) | What it is in their world |
|---|---|
| Responder (`responder`) | The Civil Watch: a parish watchman with a radio headset and an electric lantern, first to the crater |
| Skitterling (`skitterling`) | A nursery's unfed hatchlings, marked with orange and sent out (section 3.5) |
| Militia (`militia`) | The Home Levy: a townsworker in her own clothes, an orange sash, a dome helmet far too big |
| Soldier (`soldier`) | A regular of the Host, soldier-ant morph, carbine and power bayonet |
| Splitter (`splitter`) | A nursery porter evacuating two hatchlings in her pannier, who fight when it breaks |
| Elite (`elite`) | A House Guard: stag-beetle morph, gilded helmet, power axe; the households' own regiments |
| Flier (`flier`) | The Air Wing: a wasp trooper in goggles and a flight harness |
| Drummer (`drummer`) | A regimental bell-ringer of the Bell confession; the bells set the march |
| Stalker (`stalker`) | A scout of a hooded order, trained to go unseen |
| Sapper (`sapper`) | The Steeplejacks' Guild: termite-morph builders who put up the bell towers and now take them down with you on them |
| Bomber (`bomber`) | A censer-bearer: a devotional corps whose censer is the bomb. Volunteers, blessed before they run |
| Mortar beetle (`mortar`) | A Modernway war beetle with a crew; bred in the Foundry Plains |
| Siege cannon (`cannon`) | Modernway's bombardier beetle, the Host's heavy artillery |
| Shadewing (`shadewing`) | The night wing: moth-morph pilots under dark veils |
| Phalanx (`phalanx`) | The icon wall: a pill-bug carrier bearing the painted panels of the saints, carried into battle as in the Clan Wars |
| Carapace lord (`carapace`) | The ironclad: an armoured beetle whose shell is a gilded onion dome, a House's pride, with its crew peering out |
| Tender (`tender`) | A sister of mercy of the nursing orders |
| Ghost sapper (`ghostsapper`) | A steeplejack of the scout orders, climbing in the dark |
| Tunneler (`tunneler`) | The Deep Diggers: the order that digs the ossuaries and the deep hive, mole-cricket morph |
| Researcher (`researcher`) | Faculty of the academies and the House labs, sent to take a specimen (next section) |
| Specimen thief (`thief`) | The specimen trade: freelancers and graduate students paid by the gram |
| Infiltrator (`infiltrator`) | House intelligence: industrial espionage, stealing the Visitor from under the other Houses |
| Sedation battery (`dartgun`) | An academy field apparatus with an operator and a tablet |
| The royal (`royal`) | A queen, in the field only when her hive is in mortal danger |
| Consort (`consort`) | Her husband, a royal male and a colonel by custom, promoting as he goes |
| Veil matron (`matron`) | Her sister or a dowager of the court, whose veil hides the soldiers near her |

### 8.3 Why the science caste steals limbs (canon behaviour, PROPOSAL reason)
Canon: researchers are "smart and will try to walk around your tower defences to the most
vulnerable locations", to steal limbs; they are drawn by novel biology (interest), and the Follow
the Courier experiment traces a stolen limb to "a hidden research campus … There are jars. So many
jars." **PROPOSAL, why:** every House wants the Visitor's tissue first, to patent it. The academies
compete as fiercely as the Houses that fund them; a limb carried off is a fortune, and the Hidden
Campus is one House's black-site laboratory (Hexley's, next to its AI labs). They are not
defending their planet. They are racing each other to own the thing eating it.

### 8.4 How the waves tell the story (canon, DESIGN.md)
"Wave escalation tells the story of a society realizing what is happening to it: first
responders, then militia, then military, then everything they have." Tier by tier: the Civil
Watch; the Home Levy; the Host; the Air Wing and the scouts; the Steeplejacks, the censer-bearers
and the war beetles; the icon walls, the ironclads and the nursing sisters; the Deep Diggers;
and, at a royal event, a queen.

---

## 9. How they see the Visitor, and the Empire

### 9.1 What they know (PROPOSAL, see OPEN 4)
- **The public** knows a meteor fell and a growth is eating cities. The papers call it the Crater
  Thing, the Growth, the Visitor. Nobody knows there is anyone behind it.
- **The three factions** know there is someone in orbit (they reach him: canon), and each has
  its own idea of him: a wise intelligence (the Delegation), the sign of the Hour (the Faithful),
  a mind that matches the Director's own and a "safer apocalypse" than their AI (the Institute).
- **The Host** has found the ship on radar and has nothing that reaches it.
- **Nobody** on the planet has heard the word "Technopuritan". If they did, they would recognise
  it at once as a religion.
- **Nobody** on the planet guesses where the absorbed go (Collins, Sep 30 2026), though each
  faction is closer than it knows: the Faithful's Book describes the archive, the Delegation's
  whole teaching is about what comes after, and the Institute was told outright and decided it was
  a lie. None of them asks why a civilisation that crosses the stars would need a meteor to empty
  a planet. The character finds this baffling (`docs/UNIVERSE.md`, "What a broodfall is for").

### 9.2 How the Empire sees them (canon)
Xenofauna, outside the covenant of the Sons of Man, filed as a *test*; their clearance is pest
control (`docs/UNIVERSE.md`; `content/lore/empire.md`, section 12). The Empire's corpus has a word
for fertile peoples who think themselves complete: the "chittering hordes" (TP 11.0). A planet of
one faith, royal breeding and an order that thinks it is finished fits it perfectly. The Empire
never makes the comparison with itself; YOKE does, once.

### 9.3 An in-world document: the Office's field primer (the Empire's voice)

> **KNOW YOUR FAUNA!** *Xenofauna Clearance Office, Sector 9. Primer EW-1, for new technicians.*
>
> Congratulations, Technician! You have been assigned to a **eusocial world**. Here is what you
> need to know.
>
> **They look like people. They are not.** Fauna of this type wear clothing, drive vehicles and
> operate radio. This is normal and requires no action. Imitation is common among social fauna.
>
> **Castes are colour-coded for your convenience.** ORANGE specimens fight. TEAL specimens take
> samples. GOLD specimens are royal and are the most valuable specimen on the planet. Your asset
> will do the rest!
>
> **They will want to talk to you.** Some fauna may attempt communication by radio, by letter or
> by arranging themselves in fields. You are not required to reply. If you reply, keep it
> short. Do not accept gifts.
>
> **They may pray.** Remember that the Index records every faith and none is to be mocked. A
> fauna's prayer is a behaviour. Log it under *behaviours*.
>
> Remember: every clean deployment is a step toward your licence. Have a cheerful clearance!

---

## 10. Media and entertainment (canon where marked; the rest PROPOSAL)

- **Radio** is the great medium: the Last Hour Radio Network's forty stations (canon), the House
  hymn at dawn, the serials of pairs in love, the pennant race of the sibling wars.
- **Newspapers** (canon: "we know what the newspapers are saying"): owned by Houses, read by
  everyone. The style bible allows **news clippings** as a film surface: their front pages are the
  cheapest window into the insect layer there is.
- **Television:** the 1950s television aerial is a suburban roof prop (canon). Royal weddings,
  quiz shows, a sitcom about a clutch of sisters sharing a flat (*Sisters Know Best*), and the
  Great Queen's annual address.
- **League of Larvae** (canon): the planet's great video game, a parody of *League of Legends*.
  The Director mains Broodmother ("it felt respectful"). It is 21st-century, online and ranked;
  the technology is modern even when the manners are not.
- **Monster pictures.** They have their own drive-ins and their own 1950s-style monster films,
  about things that fall from the sky. The opening cinematic is a trailer "told from the town's
  side" (canon, DESIGN.md). Now one of those films is the news.
- **The Empire watches them.** The Empire already watches Earth as a zoo and as a lesson
  (`content/lore/empire.md`, section 9). The eusocial world is a second show, and the clearance
  newsreels treat it as a parody mirror of 1950s humanity: little people with radios, company
  songs, a queen on television and a preacher on every frequency, played for laughs, until the
  filter slips (DESIGN.md, the "break moments").

---

## 11. Language and naming conventions (for future content)

Everything the player reads of them has passed through the Empire's translation, which renders
them into mid-century American English. So names and words follow these rules (all
**PROPOSAL**, fitted to the names already in the game):

| Thing | Rule | Examples |
|---|---|---|
| **Places** | Plain English description with the article, as a 1950s map would print it | the Crash Site, Old Harbor, the Seventh City, Queen's Hollow (canon) |
| **Workers** | A 1950s American woman's given name + her House's name | Dot Luckwell, Marjorie Modernway, June Sheaf |
| **Males** | A 1950s American man's given name + his House | Eli Bankfried (canon), Chester Amberline |
| **Queens** | House name, regnal number and an epithet | Amberline the Ninth, called the Patient; Luckwell the Fourth |
| **Houses** | A surname with a hive pun, trading as "X & Daughters", "X Group", "X Mutual" | section 2.2 |
| **Clergy** | Title and office, never a real church title (no bishop, priest, imam, rabbi) | the Voice (canon), Warden of the Terraces, the High Warden |
| **The Faith's words** | Invented, from brood biology | the Cell, the Capping, the Uncapping, the Hour (canon), the Awaited One (canon) |
| **Their products** | 1950s ad copy | the Luckwell Chill-Cell refrigerator, the Modernway Scarab sedan |
| **Written text in pictures** | Never lettering: abstract glyphs only (style bible) | signs, screens, banners |
| **What they call the asset** | the Visitor (canon), the Crater Thing, the Growth | |

**Two vocabularies.** The Empire and the insects never use the same word for the same thing, and
content should keep them apart:

| The Empire says | They say |
|---|---|
| fauna, specimen | sister, citizen, a Luckwell girl |
| war / science / royal caste | the Host, the academies, the court |
| royal specimen | Her Majesty |
| spawn gate | nursery |
| resource acquired | killed |
| the asset | the Visitor |
| pest volume | casualty list |

**Numbers.** Six is their round number (the hexagon), seven their holy one (the Seven Cities).
They count in sixes: a "gross" of theirs is thirty-six.

---

## 12. The invasion, from their side (a timeline)

Order follows the campaign's globe (`content/campaign.ts`); the player's route decides the
middle. Details **PROPOSAL** except the quoted territory stories.

| When | What they saw |
|---|---|
| **Night 0** | "It was a quiet night, in a quiet little town, until something came down out of the sky" (canon, the opening titles). A meteor falls between a school and a laundromat. The Civil Watch goes to look. |
| **Day 1** | The morning papers print "METEOR FALLS ON SUBURB". The Watch does not come back. The Home Levy is raised street by street ("they fought it"). The bells on the Temple Terraces start ringing and do not stop. |
| **Week 1** | The Host arrives. The Granary Belt's ministry sends a researcher "to look at the crater". Every academy on the planet applies for a sample; the Houses start bidding. The Voice goes on air on all forty stations: "LOOK UP." |
| **Weeks 2-4** | Eleven thousand members of the Friendship Delegation spell out a letter in a field. The Institute books the deep-space dish, which "we were only using to listen for aliens". Cul-de-Sac Heights, Old Harbor (its fleet sails out when the creep reaches the docks) and the Granary Belt fall or hold. Some pilots stop flying. |
| **The middle** | The Foundry Plains make more armies. University Hill's finest minds gather "all very interested in you". A royal comes out of the Ossuary Coast. The Pilgrim Road is empty "this year". Couriers carry stolen limbs to a campus nobody admits exists. The counter-attacks (the pushback) are the Host trying to take its cities back. |
| **Late** | The Institute shuts down the planet's AI labs "for safety". The Delegation publishes a colour-coded schedule for its own species' end. The Voice names the Seventh City. There are fewer lights on the night side each week; YOKE counts them. |
| **The end** | One of three: the last delegate switches off the lights in the Assembly Hall; the Awaited One comes out of the Seventh City "a little stiffly" and the Voice weeps that everything worked out; or the Director presides over the rubble and goes last into an upload chamber that is a door into the asset's gut. Queen's Hollow is the planet's heart in every ending: "whoever holds it holds the planet". |
| **After the end** | Everyone the asset took wakes in the archive, each in a world cut to her desires (the reveal, Collins). The Delegation spell out one last letter in a meadow of the archive, begging to be switched off; the Voice broadcasts from the Comb Above that they were deceived; the Director calls from inside to bargain, and is cut off. |

---

## 13. PROPOSALS: what else would make the world richer and serve the game

Collins asked "hmmm what else". These are the further aspects worth deciding; each is a
**PROPOSAL** with what it would do for the game.

1. **The jelly as the secret at the centre** (section 1.2). A royal-jelly recipe could be a
   hobby-mission prize (the Royal Diet page already suspects it) and the thing the Institute
   finally offers him. Gives the royal currency a meaning beyond "the big one".
2. **Clan marks on the board.** Each territory belongs to a House; its militia sashes, van
   stripes and roof emblems carry that House's hexagon (section 2.2). Cheap in art (a hexagon
   variant per House) and it makes the globe read as a political map.
3. **Newspaper clippings as a debrief surface.** One front page per deployment from their side
   ("MODERNWAY THIRD ARMOURED HOLDS THE DOCKS"; "PRINCESS PAIRED; FANS WEEP"). The style bible
   already allows clippings; it is the cheapest way to show the insect layer "through cracks".
4. **Radio between waves.** A few seconds of an intercepted broadcast (a quiz show, the House
   hymn, a weather report) under the organ stage: DESIGN.md's break moment ("newsreel music cuts
   to raw field audio for eight seconds") given content.
5. **A recurring worker.** One ordinary worker glimpsed across the campaign (in clippings, on a
   radio phone-in, in a film still), whose sister was in the Levy. Never a character who speaks
   to the player; only someone the player keeps noticing.
6. **Street life at minute zero** (planned in DESIGN.md: "street life that flees the crash"): an
   ice-cream van, a pair walking home, a clutch of schoolgirls, drawn from the daily life above.
7. **Their AI models as characters.** YOKE already listens to "the colony's young machines on the
   low bands" (lore book, section 14). What the young machines say, and what they make of the
   Visitor and of YOKE, is the richest untouched thread in the setting.
8. **A royal wedding as a royal event.** A deployment in which the royal takes the field because
   the planet is holding a nuptial flight in defiance of the invasion: bells, crowds, the consort,
   and the Love Gas as the obvious (awful) experiment.
9. **The Clan Wars as backstory for the heavy units.** The icon walls, the ironclads and the
   Household Guards are the heraldry of a war a century gone; old war stories give the late-tier
   enemies a history.
10. **Scent as a language.** Antennae and scent carry what words do not (the Translator perk
    reads the next wave's makeup, which is a scent plan). A tiny grammar of scents would give the
    Veil Matron, the Love Gas and the royal aura one explanation.
11. **The Empire's survey.** How the Empire found the planet and why this one: a single Office
    form, dated before the drop, would say a great deal.

## 14. OPEN: Collins's calls

The few decisions that shape everything else. Each has a proposal above that works until he
decides.

1. **Males and the Director.** Are males royal by birth and mostly spare (section 1.4), and is
   Eli Bankfried a spare prince of a finance House (House Bankfried)? Or is there a separate
   common male line?
2. **How castes are made.** By feeding, with royal jelly making princesses (section 1.2), or born
   to their caste?
3. **"He" for soldiers.** Keep the Empire's mistranslation as a deliberate crack (section 1.7), or
   should all text say "she"? It touches the unit spec's wording (which is generated from
   `tools/art/units.mjs`).
4. **What they know.** Does only the factions' leadership know there is someone in orbit, or does
   the whole planet (section 9.1)? It changes every clipping and broadcast.
5. **The Faith's name, and two confessions.** "The Faith of the Sealed Cell", split into the Bell
   and the Lamp (section 5), and the Last Hour as its apocalyptic wing: keep, rename or strike?
6. **One state or several.** A single Commonwealth (section 4), or rival nations with the Houses
   across them?
7. **Names.** The planet and the species have no names yet. Proposed: the Empire files the world
   as EW-1 of Sector 9, and they call it simply **the Comb**.
8. **How dark the nurseries go.** Skitterlings as sent-out hatchlings (section 3.5) is the
   straightest reading of the unit spec, and the grimmest thing in the setting.
