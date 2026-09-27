# BROODFALL (working title)

Tower defense roguelite where you are the monster: an escaped imperial bioweapon growing across the city of an intelligent eusocial insect civilization. Play the Zerg side of They Are Billions.

Comps: 9 Kings (drafting, the enemy as a faction with identity), Vampire Survivors (wave density, drop economy, evolutions), Inscryption (sacrifice economy, meta-narrative), FTL (the ship between deployments, directives), Balatro (deck trust structure: determinism where you invested, buildable RNG at the draw), Nordhold (the pull economy), They Are Billions (siege rhythm, living map).

## Core fantasy

You are a growing body. Towers are limbs, creep is skin, organs are the build, meat is the economy. Every system feeds the same fantasy; nothing is bolted on.

## Planetside loop (one deployment = one run)

### The board: drafted district PLATES (Collins, Sep 26 2026 — Tower Dominion / Nordhold school, built to his reference screenshot)
- **Plate connection ALGEBRA (Collins, Sep 26 2026):** plates come in opening-count types (2 straight/corner, 3 tee, 4 cross); openings are two-wide and always CENTERED on their edge so any plate mates with any other, and rotation makes entrance/exit meaningless. Placement is legal only if every edge facing an active plate agrees — opening-to-opening or wall-to-wall; an opening may never be walled off in either direction; at least one real connection to the network; and a placement may never reduce the frontier to zero gates (a bridge that seals the last way in is refused). Openings facing empty city or the board edge become frontier gates. Growth can legitimately wall itself in against the interior — off-board gates then remain the hive's permanent highways.
- **The run never starts one plate deep:** beyond EVERY crash-plaza opening a two-opening connector district is pre-placed, so the first wave marches through a full district of your guns before touching home.
- **Entrances are the difficulty wager (roguelite dial):** the crash plate keeps exactly 1 opening by default; choosing 2 or 3 at deploy (menu or ship, "insertion profile") pays +25%/+50% meat. Measured with the scripted player: 4/4 wins at 1 gate, 1/4 at 2-3.
- **The run STARTS SMALL and grows by draft.** One 10x10 district (the crash site) surrounded by unclaimed city under smoke. Every 3rd cleared wave: choose one of three districts to consume — each a hand-authored plate (`content/plates.ts`) with its own winding channels, block heights, and a feature (Research Quarter, Provision District, Temple Heights, plain warren). The camera frames the claimed region and zooms out as the body spreads. The map is player-built over the run.
- **Figure-ground like the reference:** dense raised city blocks with dirt channels CARVED between them. Enemies march the channels in squads; they cannot cross blocks. A uniform street grid is banned — it carries no geometric information and placement stops mattering (measured, twice).
- **Verticality is TD 101:** blocks have heights 1-3, drawn raised with faces and shadows; a taller perch is +10% reach per level. Temple Heights plates bring extra high ground.
- **Towers perch on creeped city blocks,** out of the traffic. Reading which block covers the most path legs is the game. Exception: the SPINE WALL stands in the street to be chewed through — the hold-the-line tool; a single-lane channel cannot be routed around.
- **Organs grow on open plaza ground inside the body — in the enemies' path.** Leaks threaten something real.
- **Gates live on the FRONTIER:** ports of claimed plates that face unclaimed city. Growing changes where the hive can come from — expansion is power AND exposure.
- **Waves attack down TELEGRAPHED lanes** (1-3 frontier gates by tier; "ASSAULT FORMING: N+E" plus glowing gate beacons during growth). Reinforce the named approach, or CALL THE WAVE early for bonus meat. Waves spawn as squads, end with a CLEARED banner and a meat bonus.
- The map at minute zero is a NEIGHBORHOOD, not a battlefield: lit doorways, and (planned) street life that flees the crash. The city is shown living so the horror lands.

### The genre guardrail (permanent test)
`tests/placement.test.ts` runs a chokepoint-aware scripted player against a random-placement player on 8 seeds with identical cards and economy. Placement-aware play must win more seeds AND score higher, or the board has degenerated into decoration. This test exists because the first two boards (radial creep, uniform grid) both failed it.

### Three meat currencies (exactly three, by caste)
Collins (Sep 26 2026), the spend-side rule: **war is generic, science comes based on mutations, royalty is for special upgrades.**
1. **War caste** — the GENERIC currency: default income, default pressure, pays for the standard body (basic towers, walls, day-to-day builds). Warriors come because you exist.
2. **Science caste** — the MUTATION currency, bait-able. Researchers are attracted by novel biology: every mutated tower and exotic organ raises your "interesting" rating and pulls them to the perimeter, where you eat them. Farming science meat = building weird; science meat buys weirder (advanced towers, organs, mutation paths). The loop feeds itself.
   **Their default behavior is SMART (Collins, Sep 27 2026): "they are smart and will try to walk around your tower defences to the most vulnerable locations"** — to steal limbs, so they live on the periphery. Implemented as a coverage map (summed dps of every armed limb over each cell) feeding a route cost (+3 per dps on a street cell vs 10 for the street itself): researchers walk the gaps in your fire, target the reachable limb whose approach is LEAST covered (ties → the periphery), sedate it (4 hp/s each, so a party is dangerous), and carry it off. Kill the courier and the limb re-roots where it stood with its traits and targeting intact (or its cost comes back if the ground was retaken). There is no special tower-thief unit — this is the whole caste. It is the genre-new layer: war caste tests your killing power on the march; science caste tests your COVERAGE for holes.
3. **Royal caste** — on the field (Collins, Sep 27 2026): royals are **super-strong warriors that otherwise act like the war caste, whose real weight is powering up others.** The royal and her consort march and chew like warriors; both project a presence aura (war bodies within 120px hit structures ×1.5 and take ×0.7 damage), and the consort PROMOTES the nearest war body one rank every 5s (militia → soldier → elite). Kill-order matters: the court makes the army around it worse.
   As a currency — the SPECIAL-UPGRADE currency, earned escalation. Royals only move when you are a civilizational crisis. Baiting a royal means deliberately crossing threat thresholds that also unlock the hive's worst response waves. The jackpot and the hardest fight are the same event. Royal meat buys SPECIAL upgrades — rare, run-defining purchases no amount of war/science meat can substitute for. (Status Sep 26 2026: the slice's only royal sink is the biomass surge, which iteration notes already call dead weight — the special-upgrade sink layer is NOT built yet and is the intended design.)

The build dictates what comes (attraction economy), not the map. Which caste you are hungry for IS your build path.

### The pressure curve (why waves stay scary)
**Escalation is MORE enemies and HIGHER TYPES — never stat inflation. Collins (Sep 26 2026): "enemies should never harden per wave... hardening is boring." A rejected +HP-per-wave mechanic is explicitly out.** Each tier introduces a new VERB:
- tier 3 **fliers**: wing straight over blocks and walls to the core — spine walls and channel-side placement don't answer them; airspace lines from gate to core must be covered.
- tier 4 **sappers**: climb blocks and chew towers directly — perches are not safe.
- tier 5 **phalanx**: shield-wall armor caps damage per hit — big single hits are wasted, rapid fire shreds it.
Economically: bounties are near-flat per kill (2-3 war meat) while wave income is a fixed clearing wage, so defense cannot compound off wave size, and the strength/income gap forces efficient placement (guardrail: informed placement flips 4 seeds to wins, careless flips none).

### The roster (built Sep 26 2026 — every entry is a VERB, and every tower family is also a pip)

Towers (10 families; each family's pip is what it teaches a build that eats it):
| Family | Verb | Pip when cannibalized |
|---|---|---|
| Spitter | cheap reliable single-target | +25% fire rate |
| Burster | lobbed area detonation | +12px blast radius (grants splash) |
| Lasher | melee sweep, shreds crowds | +20% damage |
| Maw | eats weakened enemies whole (biomass) | +30% meat yield |
| Spine Wall | in-street blocker, must be chewed; chewers take its thorns (its payload) | +75 hp, and its KILLS leave caltrops (a 40-hp barb-mat mini-wall per pip) |
| Lure Gland | interest magnet (science bait) that bites: pulses a toxic pheromone cloud onto the hive (poison, REVEALS cloaked) | +2 interest, and its hits leave toxic pheromone clouds |
| Snare Bed (tangler) | hits slow to 55% for 1.8s | hits slow 10% more per pip |
| Blight Vent (blighter) | poison clouds; DoT ignores armor caps | +2 poison dps per pip |
| Impaler | long-range harpoon, pierces a file of 4, ignores shields | +5 armor-cap pierce per pip |
| Choir Node | +15% fire rate aura to limbs in 95px (max 2 voices) | +8% range per pip |
| Spore Sling | player-aimed creep logistics: click it, click ground in 300px — a clot lands with a thud (its payload) and seeds a patch that BELONGS to the sling. **If the sling dies, its patches die and every limb standing only on them withers** (Collins, Sep 27 2026) | the limb needs NO creep to stand on and seeps creep; its death withers what stood on its seep |
| Broodmother | keeps 3 broodlings fighting in the streets (the barracks seat: enemies stop to fight them). Broodlings are her payload: every bonus she has eaten rides their bites (potency, tempo, reach, poison, arcs, digest...) | heals 50% max hp at every cleared wave (on a Broodmother: +1 broodling) |
| Digestive Swamp | the ANTI-WALL (Collins, Sep 27 2026): a swamp IN the street the column wades through — everything in it is slowed 50% and burned, and anything at or under 30 hp is DIGESTED outright, in mass, no hold limit. No chew-back: they walk through, not into | its hits digest anything left under +10 hp per pip |
| Galvanic Frond | one strike arcs to 3 more bodies, damage falling per hop (arcs are small separate hits — shield walls soak them badly) | hits arc to +1 enemy per pip |
| Bile Lobber | player-aimed VOLLEY: click it, click ground in 250px — the glob detonates for 55 in a 55px blast (12s recharge) | hits knock back 5px per pip |
| Caustic Mister | mist that SHREDS armor: +8 to the armor cap EVERY source's hits respect, 4s | hits shred +3 per pip |
| Ocular Stalk | board-wide hitscan eye, slow, 60 damage, executes support castes (drummer/tender/bomber) by priority | the limb learns priority targeting |
| Arc Prism | focus-fire beam that ramps +12% per consecutive shot on one target (5 max); when a prism has NOTHING in its own reach it RELAYS — idle prisms chain their charge through each other (150px links, breadth-first, up to 6) into the prism that is firing, +50% beam each, spending their own shot (Red Alert 2's prism tower, routed through a network) | any limb ramps +6% per consecutive shot per pip |

| Spore Bombard | point artillery YOU aim: click it, click the map to set its MARKER (320px reach); it shells that spot (30 dmg, 42px blast) whenever the hive is there and holds fire otherwise. Its signature use is COUNTER-BATTERY — marker on an emplaced siege cannon | sacrificing it DOUBLES the new limb's range (once) |
| Ward Membrane | force field: a 70-point shield on every OTHER limb within 95px, regrowing 8/s after 3s unhurt; wards don't stack. All harm to a limb (chewing, shells, bombs, pit bite-back) hits the shield first. **The science caste never targets a shielded limb** (Collins, Sep 27 2026: "they can't hit them") — researchers, thieves and batteries skip it when choosing a mark, and drop a mark the moment a ward covers it — so a warded outer layer is simply off their menu | sacrificing it gives the new limb a PERMANENT 60-point shield of its own |

**Limb panel (Collins, Sep 27 2026): click any limb** (nothing armed) to open its panel — hp bar, live stats, inherited traits — and set its **targeting**: AUTO (threats first: climbing sappers, then nearest — the tuned default), FIRST (furthest along the march), STRONGEST, WEAKEST, FOCUS (lock one body until it dies or leaves reach), plus a **caste priority** (any / war / science / royal) that outranks the ordering — e.g. set your periphery guns to SCIENCE to guard against limb theft. Tower HP matters now in three ways: sappers/mortars chew it, bombers blast it, and researchers sedate it to steal it.

**Targeting reflex (all limbs, born of a measured failure):** a sapper CLIMBING a block
face is every tower's priority target. Without it, covering the lane just fed the
sappers — the guardrail measured blind scatter BEATING informed placement (0/8 vs 3/8
at hold-16) because route-adjacent towers paid the whole sapper tax. Mutual cover is
now the reward for informed clustering; a lone scattered tower still dies to sappers.
Two sibling rules from the same measurement: waves scale their RANKS, never their
specialists (sapper/bomber/tunneler/tender/drummer cap at row+2 — 8 sappers per wave
is the rejected "destroy their investment" failure in uniform), and sappers CRAWL at
45% speed while climbing (the defender's window).

### Combination algebra (cannibalize pips — how combinations compose)

New limbs (Sep 27): **Quill Fan** (the shotgun: 5 pellets fanned across a cone,
brutal point-blank; pip: every shot also hits +1 more target) · **Skipping Mortar**
(fires ONE direction only — set its facing in its panel — very far, and the shell skips
on down the line twice; pip: every impact skips once more) · **Netcaster** (anti-air
ONLY: flak webs that drag fliers to the ground for 2s, where ground limbs can reach
them; pip: the limb can hit AIR and its hits ground fliers 1s).

**AIR / GROUND is visible (Collins: "I can't tell what towers can shoot flying").**
Every limb is tagged: AIR + GROUND (spitter, impaler, frond, mister, ocular, prism,
quill), GROUND ONLY (burster, lasher, maw, tangler, blighter, bombard, lobber,
skipper, swamp, spine, lure), AIR ONLY (netcaster). The tag is on every card and in
the limb panel; on the board a sky-blue chevron under a limb means it reaches fliers
(with a hollow ring: air only).

**DETECTION (Collins: "invisible enemies that can only be hit by towers with
detection or boosted with detection").** Cloaked bodies — the war caste's Stalker
(t3+) and the science caste's Infiltrator (a cloaked researcher; limb theft you can't
see coming) — can only be TARGETED by a limb with true sight (the Ocular Stalk, or
any limb carrying an ocular pip) or while revealed: inside an Ocular Stalk's 180px
detection aura (for every limb), or marked by a pheromone cloud or caustic mist (3s).
Area effects — swamps, clouds, splash — still touch them, so area builds are a
partial answer. Unseen, they show only as a heat-shimmer outline.

**THE PAYLOAD RULE (Collins, Sep 27 2026: "nothing should ever do nothing ... what's
20% damage to an effect producer?").** Every limb touches the hive through a payload —
shots, beams, a swamp's contact, a wall's thorns, a broodling's bite, a lobbed shell,
a thrown clot, a pheromone pulse — and every pip modifies that payload:
- tempo (spitter): fire rate — or a producer's cycle (lure pulse, sling/lobber recharge,
  broodling bite + respawn, swamp pulse, ward regrowth)
- potency (lasher): damage — or a producer's strength (swamp burn, thorns, cloud,
  ward shield, choir aura %, broodling bite)
- splash (burster): blast radius — or a producer's effect radius (swamp, cloud, auras,
  sling patch)
- reach (choir, bombard): range — or a producer's reach (aura radius, throw range,
  broodling roam)
- every hit verb (slow, poison, shred, arcs, knockback, digest, clouds, caltrops,
  grounding, skips, pierce) rides whatever the limb touches the hive with.
- SUPPORT limbs SHARE: every choir and ward shares its hit-verb pips with every limb
  in its aura — a snare pip on a choir makes the whole chapel slow what it hits.
The cannibalize hover says exactly what the eaten limb's bonus will do, and warns
when limbs standing on its creep would wither.

**NO CAPS, EVER (Collins, Sep 27 2026): "no no caps — the point of these games is
things that feel busted."** An earlier pass capped chains/poison/shred/knockback,
limited the choir to two voices, made wards not stack, capped the prism ramp and
relays, floored the tangler slow and made bombard range-doubling once-only. All of
that is removed and a test pins the absence. Do not reintroduce a cap on stacking.

Pips are commutative and order-free: a tower's stats depend only on the MULTISET of
families it has eaten, never the order. Eating a limb passes on its ENTIRE history plus
one pip of its own family; eating several before placing pools them all. Every pip
also adds +0.5 interest (weird builds draw the science caste). Stacking rules:

- **Additive per pip, forever:** fire rate, damage, splash, meat yield, max hp,
  interest, poison dps, chains, knockback, shred, armor-pierce, regen, root time,
  creep seep, focus ramp, permanent shield.
- **Compounding per pip:** tangler slow ×0.9 each (approaches a standstill, never
  reverses); bombard range ×2 each (×2, ×4, ×8...).
- **Auras add:** every choir voice in reach adds +15% fire rate; every ward in reach
  adds its 70 shield; every idle prism in the network relays.
- **Two joints that are rules about repeated HITS, not caps on bonuses:** a slow keeps
  the strongest active factor (so one tower hitting twice doesn't compound itself to
  zero), and shred keeps the deepest active cut. Poison, by contrast, adds per hit.
- Poison ticks and the impaler's own shots ignore armor caps outright.

Marquee lines (tested): impaler + frond pip = a skewer that arcs off every body in the
file; anything + mister pip turns a shield wall into meat for the battery; brood pip
on a spine wall = a barricade that heals between waves; sling pip on a frontier tower
= the outpost extends its own ground.

Organs grew too (Collins, Sep 26 2026: "tossing creep" + "a creep node that spawns creep
directionally"): the **Tendril Root** (15W 15S) grows a creep LOBE toward its compass
heading — defaults toward the nearest gate, click it to re-aim N→E→S→W. Between the
core's radius, the root's lobes, the sling's thrown patches and seeping pipped limbs,
creep is now a multi-source territory game, not one circle.

Enemies (19 kinds; escalation adds VERBS, per the rule above). **Faction rule: war
caste marches in waves; science caste visits with the attraction economy and never
fights; royal caste only takes the field with a royal event.** An invariant test
pins WAVE_TABLE to war caste only.
- WAR ladder: skitterling (swarm chaff) · responder · militia · soldier · splitter
  (t2+: shot dead it bursts into 2 skitterlings; EATEN WHOLE it doesn't — the maw is
  the answer) · elite · flier (t3: ignores terrain) · mortar beetle (t4: besieges
  structures from 85px standoff — long guns and broodlings answer it) · sapper (t4:
  climbs perches at 45% climb speed; every limb shoots climbers first) · carapace
  lord (t5: blocks the first 6 HITS outright — the phalanx's mirror: big blows strip
  the shell, rapid fire feeds it; poison seeps through) · phalanx (t5: per-hit cap).
- THE CANNON (Collins, Sep 27 2026 — one per caste): walks until something of yours
  is in reach, DEPLOYS (braces, never moves again) and lobs shells over blocks until
  destroyed; packs up only if nothing is left in reach. War: siege cannon (t4+,
  150px, 12 dmg/3.2s in a 28px blast on structures). Science: sedation battery
  (joins study parties past interest 14, one on the field at a time, routes through
  your gaps like its caste, deploys in reach of your weakest limb, darts STUN it 1.2s
  every 4s so researchers can walk in; carries an 8-dart kit then goes home — a
  science VISIT, not a siege). Shields stop darts. Every limb's AUTO targeting treats
  an emplaced cannon in reach as a priority threat.
- WAR support (kill-priority decisions): drummer (speed aura) · bomber (charges
  walls/organs) · tender (heal pulses) · tunneler (t6: burrows past the outer line).
- SCIENCE visitors (smart by default — route around coverage to your weakest point):
  researcher (probes the gaps, sedates and steals the least-covered limb; edible) ·
  specimen thief (joins study parties past interest 12, slips through the same gaps,
  steals 15 war meat and runs — kill the courier and the meat comes home).
- ROYAL court (super-strong warriors that power up others): the royal (1100 hp, the
  jackpot) · her consort (420 hp, promotes war bodies a rank every 5s; 40 royal meat);
  both carry the presence aura.

**THE RISK LAW (Collins, Sep 26 2026): every kind carries a RISK weight, and spawn
counts derive from it** — count = row × (1 + (clockScale−1) × riskBaseline/risk).
Cheap ranks multiply at full clock rate; risky specialists (risk 7-14) grow at a
fraction, so escalation never becomes eight sappers deleting the board. The wave's
total risk (Σ count×risk) is telegraphed in the HUD as the danger number. The tier-6
desperation row stays threat-gated (420+): a standard hold order peaks at tier 5.

The genre surveys behind the roster live in `references/TOWER-GENRE-REVIEW.md`
(beloved towers → our seats) and `references/ENEMY-GENRE-REVIEW.md` (beloved enemy
types → our kinds, with risk values and the faction audit).

### Towers: cards, not shops
- Towers buildable each round come from CARDS DRAWN with modified probability. Organs and roguelite (gene bank) unlocks shape the draw odds. The gene bank is your deck; organs decide which genes get expressed. You engineer your own randomness.
- Each card carries a DISCARD button (small war-meat fee): hand-clog with unaffordable cards is a deadlock, and the discard is a real decision (found via autoplayer runs, seed 3 locked its whole hand on science-cost cards).
- The asset has BASE INTEREST: researchers trickle in from minute one — a crashed alien bioweapon is inherently fascinating — so science meat exists before the first lure.
- **REJECTED (Collins): "instability" — random tower death/mutation on over-modification.** Torching a run-long plan at the payoff moment is the one sin the genre cannot commit. No RNG destruction of player investment, ever.

### Cannibalize-to-modify
- When paying for a new tower you may cannibalize an existing tower to modify the new one; modifications stack based on how the eaten tower works and looks.
- **Interaction rule (Collins, Sep 26 2026): no mode toggle, ever.** His words after trying the "FEED A LIMB" button flow: "you have to hit cannibalize first — that's super unintuitive. What I expected: a special UI when I hovered over something that could be cannibalized, and it was removed and its part of the payment cost was made on click." So: with a card armed, hovering one of your towers shows the cannibalize affordance (highlight + salvage preview in the hint); clicking it eats the limb ON THE SPOT — salvage meat (60% of its cost) is credited immediately as part of paying for the build, and its full trait history banks into the next build. Eating two limbs before placing stacks both histories. The general principle: actions live on the object they act on, discovered by hover — never behind an armed mode the player must know to enter first.
- Inheritance is DETERMINISTIC and VISIBLE on the body: a spitter built from a cannibalized burster has the burster's sacs hanging off it. The silhouette is the build history.
- Between-wave time is for the big surgery (butchering your own); the tension source is that the upgrade path and the defense line are the same pool of bodies.

### Pacing and waves
- They Are Billions breathing: growth phases (creep, harvest, build organs) alternating with composed siege phases.
- Wave composition is telegraphed by caste, so a wave is both a threat readout and a menu you read hungrily.
- Wave escalation tells the story of a society realizing what is happening to it: first responders, then militia, then military, then everything they have. The horror arrives through the wave system with zero cutscene budget.

### Win condition: deployment directives
**Collins (Sep 26 2026): the win is a wave count or a specific quest objective — never a biomass bar.** Each deployment carries a directive from command, seeded per run (or chosen by the mission structure later):
- **hold** — survive the local response for N waves (the default order)
- **royal** — destroy the royal (guaranteed to take the field by a set wave)
- **harvest** — bank a science-sample quota
Biomass stays as the growth economy (body size, royal surge), not the goal. Lose = core dead. The earlier "sporulation mass" win was an AI suggestion and is rejected.

### Run openings
Each run opens with an AI-generated video of the organism crashing down like a meteor into the starting environment (a neighborhood, farmland, a temple district, a harbor...) matched to the start you rolled. The crash biome biases the starting economy (which caste districts are nearby). Generate one video per biome variant, not per run.

## Tone stack (three registers, sourced differently — never choose one)

1. **Empire broadcast layer (planetside HUD): goofy on purpose.** The planetside UI is diegetic empire operator software: 1950s-newsreel narrator, jaunty mission fanfares, caste icons like cheerful pest-control clipart, kill feeds phrased as "resource acquired". The B-movie exploitation filter IS the perception the player is forced into, authored in-world by the propaganda department. Verhoeven's Starship Troopers trick, played from inside the monster.
2. **Ship layer: played dead straight, clinical.** Sterile gene bay, directive memos in procurement language ("Sample retrieval: 40 royal units. Viability threshold: any."). Bureaucratic mundanity is the straight-horror register.
3. **Insect layer: only ever glimpsed through cracks, completely straight.** Break moments: same footage with the filter off; newsreel music cuts to raw field audio for eight seconds; the mission-complete cinematic replayed ungraded with no narrator. Cheap to produce, devastating.

By hour six the player notices the combo fanfare still delights them and feels weird about it. The existential lever is aimed at the player's own mastery.

## Meta story: the deck of the ship

Setting: the Technopuritan Empire (shared universe, see /docs/UNIVERSE.md).

- **Player character:** a low-level technopuritan soldier/scientist running xenofauna clearance from a ship in orbit — handling the bioweapon between and during deployments.
- **Their goal: earn the right to a mate.** Not saving the empire, not revenge; a promotion criterion. Standing accrued from clean deployments feeds a procreation license application. The smallness of the stake is what makes the empire's indifference land.
- **The empire's view of the job: pet extermination.** Low-status, proceduralized, beneath command's attention. Directives arrive as form letters; triumphs get form-letter acknowledgments.
- **The character is having FUN.** Cheerful personal logs. And some missions are not from command at all — they are the character's own curiosity: "huh, wouldn't it be cool to capture a royal, stick her in a cage on their commute path, and see how they react? Neat behavior."

### Two mission tracks (aligning player and character psychology)
- **Command directives** pay STANDING (progress toward the mate license). Phrased in sterile procurement language; push the player off comfort builds like Balatro boss blinds (capture royals alive, field-test an unstable organ lineage, clear under time).
- **Hobby missions** (unofficial, self-assigned) pay UNIQUE GENES/samples command would never authorize — the weirdest organs and towers come from here. No standing, possibly noticed disapprovingly. The player's own "wouldn't it be cool" is literally the character's. The horror lands because the player genuinely shares the character's fun.

### The long arc (sketch)
The organism accumulates something across runs the handlers do not know about. A late-game fork about whose side the body is on has weight because the game spent hours making the player complicit in the empire's tone.

## Prototype order
1. **Rectangles first:** 3 meats, card draws, cannibalize inheritance, one attraction dial. 5 towers, 10 waves. The scope test: if caste meat + cannibalism cannot hold a session alone, no organ layer saves it.
2. Creep + organs (the unified body map).
3. The ship (can be a menu for a year), propaganda skin (narrator VO + film-grain shader the moment the loop holds), AI-video openings.
