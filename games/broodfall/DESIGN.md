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
3. **Royal caste** — the SPECIAL-UPGRADE currency, earned escalation. Royals only move when you are a civilizational crisis. Baiting a royal means deliberately crossing threat thresholds that also unlock the hive's worst response waves. The jackpot and the hardest fight are the same event. Royal meat buys SPECIAL upgrades — rare, run-defining purchases no amount of war/science meat can substitute for. (Status Sep 26 2026: the slice's only royal sink is the biomass surge, which iteration notes already call dead weight — the special-upgrade sink layer is NOT built yet and is the intended design.)

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
| Spine Wall | in-street blocker, must be chewed | +150 max HP |
| Lure Gland | interest magnet (science bait) | +2 interest |
| Snare Bed (tangler) | hits slow to 55% for 1.8s | hits slow 10% more per pip |
| Blight Vent (blighter) | poison clouds; DoT ignores armor caps | +2 poison dps per pip |
| Impaler | long-range harpoon, pierces a file of 4, ignores shields | +5 armor-cap pierce per pip |
| Choir Node | +15% fire rate aura to limbs in 95px (max 2 voices) | +8% range per pip |
| Spore Sling | player-aimed creep logistics: click it, click ground in 300px — a clot flies and seeds a growing patch to build on (20s recharge) | the limb itself seeps creep, +1 cell per pip |
| Broodmother | keeps 3 broodlings fighting in the streets (the barracks seat: enemies stop to fight them) | living tissue: the limb regrows 2 hp/s per pip |
| Digestive Pit | a mouth IN the street — passable, so the column walks onto it; holds 2 and digests (22 dps + biomass); the meal chews back | hits hard-root 0.25s per pip |
| Galvanic Frond | one strike arcs to 3 more bodies, damage falling per hop (arcs are small separate hits — shield walls soak them badly) | hits arc to +1 enemy per pip |
| Bile Lobber | player-aimed VOLLEY: click it, click ground in 250px — the glob detonates for 55 in a 55px blast (12s recharge) | hits knock back 5px per pip |
| Caustic Mister | mist that SHREDS armor: +8 to the armor cap EVERY source's hits respect, 4s | hits shred +3 per pip |
| Ocular Stalk | board-wide hitscan eye, slow, 60 damage, executes support castes (drummer/tender/bomber) by priority | the limb learns priority targeting |

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

Pips are commutative and order-free: a tower's stats depend only on the MULTISET of
families it has eaten, never the order. Each family contributes on its own axis, so
any pair coexists; the axes only meet at these defined joints:

- **Slows** (tangler pip, pit root, snare hits): the STRONGEST factor wins and the
  longest clock survives; a pit-pip hard root (5% speed) beats any soft slow through
  the same rule. Never multiplied together.
- **Poison** (blighter): stacks additively across sources and refreshes, capped at 40
  dps per body. Poison ticks ignore armor caps by design (the phalanx answer #2).
- **Shred** (mister): the deepest cut wins, refreshes, capped +24 — and it widens the
  armor cap for EVERY source, so one mister multiplies a whole battery.
- **Chains** (frond): base + 1 per pip, capped at 5; each arc is a separate small hit
  (cap-friendly); an arc never strikes the same body twice per shot.
- **Knockback** (lobber pip): additive, capped 20px, along the shot's direction, never
  into a building.
- **Armor-pierce** (impaler): the impaler's own shots ignore caps outright; its pip
  gives +5 cap to another tower's hits, stacking under shred on the same target.
- **Multiplicative throughput** (spitter rate × lasher damage × choir range × burster
  aoe × maw yield) compose freely — that is the intended "engineer your own tower"
  fantasy; the caps above are only on the STATUS axes where stacking could snowball.

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
- WAR support (kill-priority decisions): drummer (speed aura) · bomber (charges
  walls/organs) · tender (heal pulses) · tunneler (t6: burrows past the outer line).
- SCIENCE visitors: researcher (comes to study, edible) · specimen thief (slips in
  with study parties past interest 12, steals 15 war meat at the creep and runs —
  kill the courier before it slips off the frontier and the meat comes home).
- ROYAL court: the royal (the jackpot and the hardest fight) · her consort (breeds
  2 militia every 6s while it lives — the spawner that must die first; 40 royal meat).

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
