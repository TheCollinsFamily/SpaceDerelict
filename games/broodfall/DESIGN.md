# BROODFALL

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
- Organs are NOT on the surface map: they live in the ORGAN STAGE (next section).

### The organ stage: a town stage between waves (Collins, Sep 28 2026)
Collins: "organs is a totally different stage … think of it like the town stage in
BALL x PIT … what organs should be tied to is what towers can be built and their
power … certain organs allow for certain towers grouped by theme — you build a
spawning pool to make zerglings … you use unused currency from a run on these but
your currency goes to zero for the next wave (except your starting currency) … have
the game start with wave setup → wave 1"; "design organs, shapes for them, and
adjacency bonuses". (Earlier the same day he placed organs underground around a
half-buried meteor, touching the body, with deposits to dig to and fixed features
that give adjacency; the board keeps all of that. He rejected a drop-into-a-pit
version: it did not fit the theme.)

**The loop.** Wave setup (starting meat: place limbs) → wave 1 → ORGAN STAGE → wave
setup → wave 2 → organ stage → … The organ stage opens automatically after every
wave (after any district draft); the clock holds while it is open; "TO THE SURFACE"
goes to wave setup; the bottom-bar ORGANS button reopens it until the wave starts.
**Use it or lose it:** war and science left when a wave starts are lost (the
starting meat carries into wave 1; royal points are kept).

**The board.** A 13 × 9 cross-section under the city. The meteor it crashed in sits
half above the street line (the core you defend) and half buried (top middle). An
organ's whole footprint must sit on open ground (soil or a deposit) and touch the
meteor or an organ. Rock can't be grown into. The board is small on purpose: plan
for organs you haven't built yet.

**Theme organs** — one of each; each UNLOCKS a group of limbs into your card draw
(nothing else is drawn) and powers them: every LEVEL is +10% potency and tempo for
its limbs and makes them drawn more often. Click a grown theme organ (or the
meteor) to level it: its cost × its current level. Each has a SIGNATURE verb.

| Organ | Shape | Cost | Unlocks | Signature |
|---|---|---|---|---|
| Meteor Core | 3×2, given | — (level: 30 war × level) | Spitter, Lasher, Spine Wall | tempo (spitter) |
| Bone Forge | L (4) | 40 war | Impaler, Quill Fan, Skipping Mortar, Spore Bombard | armor-pierce (impaler) |
| Venom Sac | T (4) | 40 war | Blight Vent, Caustic Mister, Ember Sac | poison (blighter) |
| Gut | S (4) | 35 war | Maw, Digestive Swamp, Burster, Bile Lobber | richer meat (maw) |
| Nerve Cluster | + (5) | 45 war | Galvanic Frond, Arc Prism, Ocular Stalk, Netcaster | arcs (frond) |
| Mucus Lattice | square (4) | 30 war | Snare Bed, Ward Membrane, Choir Node | slow (tangler) |
| Brood Womb | U (5) | 40 war | Broodmother, Spore Sling, Lure Gland | regrowth (brood) |
| Marrow Vault | I (4) | 30 science | Conduit, Tap, Mitosis, Reliquary, Meat Press | hp + caltrops (spine) |
| Resonance Chamber | P (5) | 40 science | Amplifier, Mosaic, Twinning Gland, Capacitor, Boomerang | focus ramp (prism) |

**Adjacency.** Two theme organs that touch (edge to edge, or joined by a chain of
roots) share signatures: every limb of each theme gains +1 of the other's verb (the
normal pip rules: amplifiers multiply it, it stacks without caps). So WHERE you
grow the Venom Sac decides whose limbs poison.

**Zone organs** (repeatable; Ball x Pit's Captain's Quarters): each projects a zone
one cell around its footprint; every organ touching the zone is boosted.
- Auxiliary Heart (domino, 30 war): +1 level to organs touching its zone.
- Brain Node (domino, 35 war): limbs of organs touching its zone are drawn ×2.
- Pheromone Gland (1 cell, 25 war): organs touching its zone share their signature TWICE.

**Tendril Root** (1 cell, 8 war): cheap tissue to reach further, and it CARRIES
adjacency — two themes joined by a root chain share as if touching.

**Terrain.** Features are fixed: +1 level to every organ touching one, +2 to its
favoured organ (Severed Power Main → Nerve, Sewer Main → Gut, Aquifer → Lattice,
Geothermal Vent → Venom). Deposits pay once when an organ is grown over them
(Carrion Pocket +20 war, Carrion Seam +45 war, Buried Laboratory +25 science,
Biomass Bed +150 mass, Royal Ossuary +1 royal point, Gene Cache: two named bonuses
banked for your next limb); the good ones are deep.

### Creep: the core of the organ game (Collins, Sep 28 2026)
Collins: "creep nodes should be free but produced at intervals by special organs;
some organ should let you start the game with them, some decrease the interval,
some produce two at once, some increase range, some make throwers"; "one for making
creep slow and one for making creep hurt enemies"; "it's through these that you
should even gain access to the creep throwers"; "one that creates a creep thrower
that shoots creep in a medium-length line"; "really think it through and make it
maximally engaging — it's what I want the core of the organ gameplay to be about."

The model is StarCraft 2's creep tumours (free, made on a timer, each one spreads
exactly one more, and the enemy tries to clear them) — the most loved "tend it
constantly" minigame in the genre. Four rules make it engaging here:

1. **Every bladder is a RECIPE.** A Spore Bladder grows ONE free creep node every
   TWO turns (at the wave clear — Collins: "the default every two turns, not one;
   only one with the thing that increases speed"). The creep organs TOUCHING it decide the node's strain — so the
   organ board is a packing puzzle of recipes, not a shopping list:
   - Pacemaker: that bladder grows EVERY turn; each pacemaker past the first adds a
     node when the wave starts (creep to place mid-fight). Budding Gland: one more
     node each time it grows (stacks).
   - Swelling Sac: its nodes spread +1 cell. Catapult Sac: its nodes are thrown
     +5 cells past the creep (and it UNLOCKS the Spore Sling — the creep thrower).
   - Mire Gland: its nodes' creep slows ground enemies 25%. Digestive Lining: its
     nodes' creep burns them 4/s (both stack; both work like poison — armor
     doesn't help).
   - Swelling, mire and lining that touch the METEOR shape the core's own creep.
   - Spore Cyst: a starter stock — 3 plain nodes the moment it grows. Runner Gland:
     UNLOCKS the Creep Lance (below). Ship gene Seeded Meteor: start with 3 nodes.
2. **Every placement is a choice.** The stock holds distinct strains (a tray chip
   per strain: "3-cell · thrown 8 · mire −25%"). Burning and mire nodes want the
   street chokepoints; big nodes want your gun clusters; thrown nodes reach
   forward ground. A node goes on any claimed ground within its reach of your creep.
3. **Nodes spread themselves.** A placed node MATURES once it survives a wave; click
   a mature (glowing) node, then the ground, to spread ONE child of the same strain
   up to radius + reach cells away. The creep front keeps walking forward.
4. **Nodes can be lost.** 140 hp; siege shells, bomber blasts and war/royal bodies
   standing on a node wear it down; full heal at every wave clear. A dead node
   takes its creep with it, and limbs standing only on that creep WITHER. Forward
   creep is power and exposure (the bot, which spreads straight at the gate, loses
   ~40% of its nodes — a human can do better).

**Two trays, two economies** (Collins): creep nodes are a STOCK of every node you
have ready (the green "CREEP NODES — FREE" box, one chip per kind, placing costs
nothing); limbs are a HAND of 4 cards drawn from what your theme organs unlock.

**One icon language for node kinds**, on the bladder's badge in the organ stage, on
the tray chip, and on the map pod: ◍N spread, ➶N thrown (a chevron on the pod),
≋ mire (a dotted ring; bog-green creep), ☠ burning (a spike ring; glowing creep). A
pod's size is its spread; a dashed ring = maturing, a bright ring = ready to spread.
Hover a pod for its kind, HP and state; hover a bladder in the organ stage to light
the organs shaping it (hover a creep organ to light the bladders it shapes).

**Draw control.** The Brain Node doubles the draw odds of every theme touching its
zone (stacks). The ATROPHY GLAND (Collins: "one that reduces probability to nothing,
used to disable basic organs later in the game"): themes touching its zone are never
drawn — e.g. starve spitters/lashers/spines out of the hand late. If every theme is
starved, the draw ignores it (never an empty hand).

**The dig** (Collins: "rewards that can be found as you dig deeper … royal kills,
styled as ancient royal tombs … and underground research labs for science"). Deposits
more than 2 cells from the body show only as a glinting "?" — you find out what they
are by growing toward them. Deeper is richer: Ancient Royal Tombs (2, rows 5-8) pay
1 royal point, 2 in the bottom rows; Underground Research Labs (2, rows 3-8) pay
15 science + 6 per row deeper; plus carrion pockets/seams, a biomass bed and a gene
cache with two named bonuses.

**The Creep Lance** (limb, unlocked by the Runner Gland): a directional creep
thrower that lays a straight STRIP of creep along its facing (8 cells × reach,
growing 0.6 cells/s × tempo; splash widens it; right-click turns it). If it dies,
what stood only on its strip withers. Evolutions: longer, broader, faster, tougher.

Organs are out of the enemies' reach. What organs used to do on the surface
(hearts → biomass/creep, brains → interest, gland modes, root creep lobes) is gone.
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
| Digestive Swamp | the ANTI-WALL (Collins, Sep 27 2026): a swamp IN the street the column wades through — everything in it is slowed 50% and dissolved by acid (not fire), and anything at or under 30 hp is DIGESTED outright, in mass, no hold limit. No chew-back: they walk through, not into | its hits digest anything left under +10 hp per pip |
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

**BURN (Sep 27 — "does anything add burn?" It didn't; the swamp's "burn" was acid).**
Fire is its own status, distinct from poison: poison ADDS per hit, stays on its
carrier and ignores armor; burn keeps the HOTTEST fire, refreshes its clock, and
SPREADS — every 0.5s a burning body ignites unburnt neighbours within 22px at 80% of
its heat for its remaining time (the chain cools as it runs). Burning bodies can't
hide: fire reveals the cloaked. Source: the **Ember Sac** (a flamethrower that sprays
a cone — every targetable body in it ignites, 8/s for 3s); its pip makes any limb's
hits ignite (+3/s per pip).

## THE CORE: COMBO RUNAWAYS, PAID IN SCIENCE (Collins, Sep 27 2026)

"The real core of the game is going to be trying to build combo runaways, and this is
what we can use the science category of currency for." So:
- **Science meat is the combo currency.** Combo ENGINES — directional limbs that
  manipulate other limbs' bonuses — cost science only. (Science already comes from
  building weird: mutated limbs raise interest, interest draws researchers, eating
  researchers pays science. The loop now closes: weirdness buys engines that make
  weirdness compound.)
- **Engines chain.** Order of application on a target: its own pips → everything fed
  in (conduit pools, mosaic sets, choir/ward shares, conduit/mosaic pip draws) →
  amplification LAST, so an amplifier multiplies everything the other engines fed.
- Engines can't target engines (no feedback loops); sacrificing a funnel or mosaic
  harvests what it was channelling.

The three engines built:
| Engine | Cost | What it does to the limb it points at | Its own pip |
|---|---|---|---|
| Marrow Conduit (funnel) | 30 sci | copies the bonuses of limbs within 80px (their pips + their family) — **max 2 copies per type** (Collins, Sep 27 2026; the one deliberate engine cap) | draws the nearest neighbour's family bonus |
| Twinning Gland (volume) | 38 sci | ×2 projectiles per shot per gland (two glands ×4); on producers ×2 output (brood, clouds, bile globs, bombard shells, sling clots) | +1 projectile on every shot |
| Marrow Tap (farm) | 24 sci | holds its target in STASIS (it does nothing); the tap can be sacrificed ANY number of times and never disappears — each time banks a copy of the target's bonuses (pips + family). No salvage | — (a tap is never consumed) |
| Resonance Amplifier (depth) | 42 sci | every bonus count ×1.5, ROUNDED DOWN, per type, per amplifier (1→1, 2→3, 3→4, 4→6, 6→9) | the eater's own counts ×1.5 |
| Mosaic Node (breadth) | 26 sci | ONE bonus of EACH distinct type found within 90px — max one per type | draws one of each type among neighbours within 60px |
| Mitosis Node (breeding) | 34 sci | points at an ADJACENT limb; once per cleared wave buds a level-one, no-upgrade copy of it into a free space next to the node (or next to the parent). Stops when the spaces are full — harvest the copies to keep it breeding | the limb buds a plain copy of ITSELF each wave |
| Capacitor Sac (tempo) | 22 sci | while its target has nothing to shoot it banks shots at the target's rate (no cap); when the hive arrives it spends them at 400% speed until the bank runs dry — not all at once | the limb banks its own idle shots |
| Boomerang Node (geometry) | 20 sci | reach 320: its target's projectiles fly BACK to the node after their first hit, piercing everything on the way home. Place it far away to draw a return lane across the map. Only projectile limbs qualify (not melee, beams, cones, shells, lobbers, skippers) | the limb's shots return to it |
| Meat Press (economy) | 18 sci | war-caste kills by its target drop SCIENCE instead of war — fund more engines | the limb's war kills pay science |
| Reliquary (insurance) | 16 sci | if its target DIES (not sacrificed, not stolen) its bonuses + family are banked for your next build. Weak alone, so it is a PAIR: picking the card up puts a FREE second Reliquary card in hand | the limb's bonuses are banked if it dies |

Note the rounding: a single bonus stays single under an amplifier, so it only pays on
stacks of 2+. It is a DEPTH tool: fill one limb with one type (conduits, repeated
cannibalizing), then amplify. The scripted player (shallow, breadth-y stacks) measured
0% amp gains across 10 runs and correctly never buys one — the amplifier is where
deliberate human combo play separates from default play.

Next engine candidates (brainstorm, Sep 27): see notes/ITERATION addendum 12.

### What science buys (Collins, Sep 28 2026)
Science is spent ONLY on combo engines, on evolutions (below), on the two engine
organs (Marrow Vault, Resonance Chamber), and on "certain upgrades we have not
gotten to yet". Basic limbs and organs cost war
only. (Their old science share was dropped, not converted: converting 1:1 starved
war and the scripted player built a quarter as many limbs.)

### Evolutions: three stages, choose A or B (Collins, Sep 28 2026 — from Tower Dominion)
Every limb and engine has a three-stage tree; at each stage you pick one of two
options, and a path reads as letters (a Spitter "ABA"). Stages 1 and 2 cost
science only (10, then 20); stage 3 costs 30 science + ONE royal point. Bought in
the limb's panel (click the limb → EVOLVE). The path shows on the limb as a crest:
a spike for A, a diamond for B, teal for stages 1-2, gold for stage 3.

Tree shape: stage 1 is a SHAPE trade (faster vs harder, wider vs farther), stage 2
grows a VERB (the limb grows two pips' worth of slow/poison/fire/shred...), stage 3
TRANSFORMS it (three projectiles, double range + true sight, swallow elites whole,
a wall that regrows and grows). Every option changes what the limb does — a test
fails any option that changes nothing. Verbs an evolution grows count as the
limb's own (amplifiers multiply them, choirs and wards broadcast them) but are NOT
banked when it is eaten: an evolution is an investment in THIS limb.

Engine evolutions bend the engine's rule instead: a conduit that passes 3 or 5
copies per type or DOUBLES everything it passes, an amplifier that rounds UP (a
single bonus becomes two) or multiplies ×2, a mosaic with two or three of each
tile, a twinning gland at ×3/×4, a gentle tap (the target keeps working at half
speed), a mitosis node whose buds carry the parent's bonuses, a capacitor at
1000% speed, a boomerang that ping-pongs, a press that pays royal points, a
reliquary that resurrects its limb (Phoenix: with bonuses and evolutions, once per
wave). Full list: `content/upgrades.ts`.

**Royal points.** Royal meat is counted in points: a consort or matron pays 1, the
royal 3. A point buys a third evolution stage or a Royal Surge.

### What a second copy does (Collins, Sep 28 2026: "what does doubling an upgrade that gives bullet burning do? decide and implement for each")
The rule: **every copy adds its amount again; a multiplier multiplies again; a
status verb (slow, poison, burn, shred) also lasts 0.5s longer per copy; anything
that was an on/off switch has a number that grows.** A permanent test fails any
bonus whose second copy changes nothing.

| Bonus | One copy | Each extra copy |
|---|---|---|
| Spitter | +25% tempo | +25% more |
| Lasher | +20% potency | +20% more |
| Burster | +12px splash | +12px more |
| Choir | +8% reach | +8% more |
| Bombard | reach ×2 | ×2 again (×4, ×8…) |
| Maw | +30% meat from kills | +30% more |
| Spine | +75 hp; kills leave 40-hp caltrops | +75 hp; caltrops +40 hp |
| Lure | +2 interest; hits leave 4-dps clouds | +2 interest; clouds +4 dps |
| Ward | +60 permanent shield | +60 more |
| Snare (tangler) | hits slow ×0.9 for 1.5s | ×0.9 again, +0.5s |
| Blight | +2 poison dps for 2.5s | +2 dps, +0.5s |
| **Ember** | **hits burn +3 dps for 3s (contagious)** | **+3 dps and +0.5s: two copies = 6 dps for 4s.** Fires from DIFFERENT limbs don't add on one body — the hottest wins — so heat is built on one limb |
| Impaler | +5 armor cap | +5 more |
| Sling | seeps 1 cell of creep; no creep needed | +1 cell |
| Brood | heals 50% max hp each cleared wave (+1 broodling on a mother) | +50% more; healing PAST full grows the limb (half the excess becomes permanent max hp) |
| Swamp | digests anything left at ≤10 hp | +10 hp more |
| Frond | +1 arc | +1 more |
| Lobber | 8px knockback | +8px more |
| Mister | +3 shred for 2s | +3 more, +0.5s |
| Ocular | sees the cloaked; +25% vs supports | +25% more |
| Prism | +6% per consecutive shot | +6% more |
| Net | hits air; drags fliers down 1s | +1s more |
| Skipper | +1 skip | +1 more |
| Quill | +1 extra target | +1 more |
| Twin | +1 projectile | +1 more |
| Conduit | draws the nearest neighbour's family bonus | one more neighbour |
| Amp | own bonuses ×1.5 (round down) | ×1.5 again |
| Mosaic | one of each neighbour type | one MORE of each |
| Mitosis | buds a plain copy of itself each wave | one more bud |
| Capacitor | banks idle shots at its fire rate | banks that much faster again |
| Boomerang | shots return after a hit | one more trip (the shot ping-pongs) |
| Meat Press | war kills pay science | +50% science |
| Reliquary | bonuses banked if it dies | one more copy banked |
| Marrow Tap | — (a tap is never eaten, so its bonus can't be carried) | — |

Two ENGINES on one limb stack the same way: two twinning glands ×4, two amps ×1.5
twice, conduit and mosaic pools add, capacitor charge adds, boomerang trips add,
each extra press +50%, reliquary copies add, each mitosis node buds.

**THE MARROW CONDUIT (Collins, Sep 27 2026 — the combo engine).** A directional
support limb: it COPIES every bonus from the limbs within its gather radius (80px) —
each one's inherited pips plus its own family bonus — and feeds the whole pool to the
one limb it points at (the nearest down its facing lane, 160px). Neighbours keep
theirs. Sacrifice the conduit and the next build HARVESTS the whole pool
permanently (so conduit → eat → conduit is a deliberate duplication engine; no caps).
Its own pip: the limb passively draws its nearest neighbour's family bonus. Reach
pips stretch both radii; splash pips widen the gather.

**Direction is placed and shown (Collins).** Limbs whose facing matters (Skipping
Mortar, Marrow Conduit) show their FIELD OF FIRE as a lane with chevrons while being
placed; RIGHT-CLICK rotates the placement (Esc cancels a directional placement), and
right-clicking a BUILT directional limb rotates it. Default facing: the nearest gate.

**Effect limbs show what they affect (Collins).** During placement and while a limb's
panel is open, the board draws its links — conduit: thin gold lines from every source,
a thick gold arrow + ring on its target; choir/ward: rings on every covered limb —
and the panel states it in words ("FUNNELLING 5 bonuses from 3 limbs → LASHER ·
sacrifice to harvest", "SHIELDING 4 limbs · +70 each", "FED by 2 conduits").

**AIR / GROUND is visible (Collins: "I can't tell what towers can shoot flying").**
Every limb is tagged: AIR + GROUND (spitter, impaler, frond, mister, ocular, prism,
quill), GROUND ONLY (burster, lasher, maw, tangler, blighter, bombard, lobber,
skipper, swamp, spine, lure), AIR ONLY (netcaster). The tag is on every card and in
the limb panel; on the board a sky-blue chevron under a limb means it reaches fliers
(with a hollow ring: air only).

**DETECTION (Collins: "invisible enemies that can only be hit by towers with
detection or boosted with detection").** Cloaked bodies — five kinds across all three castes: the war caste's
Stalker (t3+), Shadewing (a cloaked FLIER, t4+: needs air reach AND sight), and Ghost
Sapper (a cloaked climber that eats limbs unseen, t5+); the science caste's
Infiltrator (a cloaked researcher: limb theft you can't see coming); and the royal
Veil Matron (arrives with the royal event; every WAR body within 90px of her is
cloaked while she lives — she is visible, kill her first) — can only be TARGETED by a limb with true sight (the Ocular Stalk, or
any limb carrying an ocular pip) or while revealed: inside an Ocular Stalk's 180px
detection aura (for every limb), marked by a pheromone cloud or caustic mist (3s), or
BURNING.
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

### BIG limbs: towers that stand on several cells (Collins, Sep 29 2026 — BUILT Sep 29)

His words: "how do we handle towers that appear over multiple squares? we should have some
of those, they are a core part of the strategy in tower defence." And: "towers will need to
be rotated to fit certain positions."

- **The rule.** A big limb stands on a rectangle of cells (`span` in `content/data.ts`,
  [across, along]). Every cell of it must be the SAME flat roof (one kind of ground, one
  height), held by the creep, and free. It stands in the middle of its ground. Reading the
  city for a roof wide enough is the new placement question.
- **Pointing.** The player points at a cell; the limb takes a legal footprint that HOLDS
  that cell (of several that would do, the first from the north-west). The preview lights
  every cell it will take, green or red. There is no separate "anchor" to learn.
- **A LONG limb (1 by 2) lies along the way it faces:** turned with the same right-click
  that turns a limb that aims one way. Not turned, it lies the first way that fits where it
  is pointed (a wall in a street lies ACROSS the street if it can).
- **A big limb lives while the creep holds ANY of its ground,** and gives all of its ground
  back when it is eaten or dies. An enemy reaches it from a street beside any of its cells.
- **It is paid for the ground it takes.** Same price, more ground: so each is worth more than
  it was on one cell. What each was is in the comment over it in `content/data.ts`.

Collins, the same evening: "I don't see any of them being more than one square, which is a
huge part of tower defence gameplay: getting that raised location that happens to fit the
tower you want at a high height and then adjacency bonuses and everything." So eleven are.

| Limb | Ground | Paid for it with (hp ×2.4 on four cells, ×1.6 on two; hits ×1.5 / ×1.25; reach ×1.15 / ×1.1) |
|---|---|---|
| Broodmother, Ward Membrane, Trap Cage | 2 by 2 | their own numbers (brood 5, ward shields within 120, cage reaches 70) |
| Maw, Caustic Mister, Snare Bed, Galvanic Frond | 2 by 2 | the sums above |
| Skipping Mortar, Impaler, Creep Lance, Spine Wall | 1 by 2 | the sums above |

- **MEASURED** (`tools/measure/footprints.measure.ts`, ten choices side by side): every
  choice held the guards. This one (its candidate c4): naive hold-12 5/10, placement
  guardrail 3:0; the scripted player built 221 limbs of more than one cell over ten runs.
  The Spore Bombard stays on one cell: made big alone it cost the scripted player a win in
  ten whatever it was paid.
- **Which limbs are big is Collins's to change:** `span` in `content/data.ts`, and `big: true`
  (four cells) or `long: true` (two) on the same limb in `tools/art/limbs.mjs`. Then
  `node tools/art/make.mjs limb <family> --bake` and the measure above.

### Plinths: height is won (Collins, Sep 29 2026 — BUILT Sep 29)

"Platforms that raise the height of one thing by one amount: let's have an organ that
generates 1 every two waves for free."

- **The Scaffold Gland** (organ stage, 30 war, three cells) grows one free PLINTH every two
  turns. Plinths wait in a stock on the bar (PLINTHS — FREE), as creep nodes do.
- **A plinth raises ONE THING one level:** the limb clicked (a big limb rises whole, all four
  cells, for one plinth), or a bare roof the creep holds. Never a street. Never above 4
  levels (one above the city's tallest block). Every level is +10% reach, as it always was.
- **A plinth on a bare roof levels a roof:** three cells at 2 and one at 1 take a big limb
  once the low one is raised. That is how a plinth and a big limb work together.
- It is drawn as a level of bone and callus under the roof, not as more city.

### Seedlings: an organ that shoots (Collins, Sep 29 2026 — BUILT Sep 29)

"An organ that must be placed adjacent to the surface and once every two turns you get a
free low power tower, with the idea like it shoots out."

- **The Seeding Gland** (35 war, two cells) must TOUCH THE SURFACE: one of its cells in the
  top row of the organ stage, under the street.
- Every two turns it puts a free **Seedling** card in the hand (never drawn otherwise). A
  Seedling is a small weak limb: half a spitter (6 damage, 45 hp, reach 75), with its own
  three evolutions, and a pip worth eating.
- Placed, it is SHOT up from the landing site in a high arc and stands where it lands.

### The camera turns (Collins, Sep 29 2026 — BUILT Sep 29)

His words: "as the user with E or Q moves the screen around (necessary for most gameplay) we
would get a 'doom effect'" if towers had one picture.

- **Q and E turn the board a quarter turn** (and two buttons on the board do the same, with
  HOME beside them). What was hidden behind a block is seen from the other side. The place
  in the middle of the screen stays in the middle through a turn.
- **A limb faces a way in the WORLD,** one of four: the way the player turned it, else the
  way of what it last fought, else south. Two pictures of it are drawn, from the front and
  from behind; the other two ways are those mirrored. When the camera turns, another side
  of the limb is seen. It never turns to face the camera.
- A limb that is the same all the way round has one picture: 15 of the 36 have two.

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

Setting: the Technopuritan Empire (shared universe, see /docs/UNIVERSE.md). Broodfall is set inside the Empire; its fuller history, doctrine (ported from technopuritan.com with citation ids), the index, krypteia, family life, Earth as the zoo, the Sons of Man (the uplifts; the boss is an uplifted dog) and how the Empire looks back on the 21st century are in `content/lore/empire.md` (Sep 30 2026).

The insects themselves (Collins, Sep 30 2026: a eusocial species of large clans with an economy
like Korea's chaebols, run by royals who alone breed and lay hundreds of eggs; a barren female
worker majority; the techbro Director is a male and his partners are workers; one dominant
religion, atheism rising) are in `content/lore/insects.md`: biology and castes, the Great Houses,
cities by tile set, government, the Faith and its Last Hour wing, unbelief (the Delegation and
the Institute as its secular side), sex among a barren majority, every enemy kind as an
institution, media, naming conventions, the invasion from their side, and the OPEN calls.

- **Player character:** a low-level technopuritan soldier/scientist running xenofauna clearance from a ship in orbit — handling the bioweapon between and during deployments.
- **Their goal: earn the right to a mate.** Not saving the empire, not revenge; a promotion criterion. Standing accrued from clean deployments feeds a procreation license application. The smallness of the stake is what makes the empire's indifference land.
- **The empire's view of the job: pet extermination.** Low-status, proceduralized, beneath command's attention. Directives arrive as form letters; triumphs get form-letter acknowledgments.
- **The character is having FUN.** Cheerful personal logs. And some missions are not from command at all — they are the character's own curiosity: "huh, wouldn't it be cool to capture a royal, stick her in a cage on their commute path, and see how they react? Neat behavior."

### Two mission tracks (aligning player and character psychology)
- **Command directives** pay STANDING (progress toward the mate license). Phrased in sterile procurement language; push the player off comfort builds like Balatro boss blinds (capture royals alive, field-test an unstable organ lineage, clear under time).
- **Hobby missions** (unofficial, self-assigned) pay UNIQUE GENES/samples command would never authorize — the weirdest organs and towers come from here. No standing, possibly noticed disapprovingly. The player's own "wouldn't it be cool" is literally the character's. The horror lands because the player genuinely shares the character's fun.

### The long arc (sketch)
The organism accumulates something across runs the handlers do not know about. A late-game fork about whose side the body is on has weight because the game spent hours making the player complicit in the empire's tone.

## THE CAMPAIGN: ship, credits, the globe, the factions (Collins, Sep 28 2026 — BUILT Sep 28)

Where it lives: `content/campaign.ts` (every goal, dare, experiment, profile, lineage,
territory, faction beat and line), `src/meta/` (the rules, no DOM; `campaign.ts`,
`goals.ts`, `shipAi.ts`, `storage.ts`), `src/ui/campaignUi.ts` (the ship's rooms, the
globe, the briefing, the debrief, the scenes), `content/lore/ship-ai-lorebook.md` (the
ship AI's lore book; YOKE speaks through Kimi K2.6 on rfab.ai via `RfabShipAi`, with
`FallbackShipAi` dropping to the scripted seeds when rfab.ai cannot answer). Menu → CAMPAIGN; each deployment reloads the page into a run
built from the pending plan (`?campaign=run`) and returns to the ship after the debrief.
Build inventory and status: `notes/CAMPAIGN-BUILD-PLAN.md`. Between beats each ally keeps in
touch: `FactionDef.asides` (letters, broadcasts, the Director's calls), one per allied
deployment, shown in the debrief and in Comms. Choice options carry perks (the ultimatum:
Kingdom Fund / Pacification) and `endingByChoice` picks the ending.

Collins's calls are quoted; everything else is a proposal filling his frame.

### How it unfolds for a new player (Collins, Sep 30 2026 — BUILT Sep 30)

"The philosophy I want to use in terms of how this unfolds for a user is that they think they
downloaded some little nothing indie game that progressively unfolds into something bigger
than what they expected so they drop in ... oh tower defence that's neat then ... oh this is an
interesting additional narrative layer."

The rules live in `src/meta/onboarding.ts` (pure, tested in `tests/onboarding.test.ts`); the walk
of the whole thing is `tools/shot-onboarding.mjs` (screenshots `notes/screens/2026-09-30/onboard-*`).

1. **The first launch ever** (nothing stored): the opening cinematic (`src/ui/intro.ts`, art by
   `tools/art/intro.mjs`), then straight into **mission 1** — no menu, no ship. The film is the
   trailer of a 1950s monster picture told from the town's side (a living meteor falls on a
   little insect town and grows); its titles are set in type; it never mentions a ship, an
   empire or a campaign. A click, Esc, Enter or Space skips it; it plays once and is replayable
   from the menu. It is silent: a browser will not play sound on a page nobody has clicked yet.
2. **Mission 1** is the crash site (the film ends there): hold 5 waves, the assault's gate shown
   (as in any tower-defence game; the campaign hides it later), no Requisition Board, no dares,
   nothing on screen that speaks of the ship, the Board, the globe or a licence (`hud.plain`,
   `under.plain`). The hint line coaches the one next thing to do from what is on the board
   (`coachText` in `src/main.ts`; the cards, then CALL THE WAVE, glow while they are the answer).
   Its report is plain (the verdict, the pictures, a few numbers) with one way on: CONTINUE.
   It takes no ground and queues no counter-attack; its data pays 4 standing, win or lose (so
   that YOKE's "check it out" in the Gene Bay is true). A launch while mission 1 is unfinished
   goes straight back into it: the ship, and the menu that shows it, are never seen before it.
3. **After mission 1, won or lost: the ship.** That is the first reveal. YOKE greets him.
4. **The Directive Desk is dark** until the first win that is not mission 1 (won mission 1: the
   next win; lost it: the first win). Dark means the ship's own voice: "AWAITING CLEARANCE",
   the planet not projected, and Command's assignment with its DEPLOY button (`shipPick`: a
   counter-attack first, else the easiest landing site next to what is held). At that win the
   desk clears, and **all three factions call at once** (the old contact-after-N-captures is
   gone), one call after the other ("CALL 1 OF 3", HEAR THE NEXT CALLER), after YOKE has spoken.
   A save from before the unfolding has its desk open, and hears all three at its first capture.
5. **Every return to the ship, YOKE greets him** with a prewritten line (`content/greetings.ts`;
   no LLM makes a greeting), through her Living Avatar body: her clips, her voice from rfab.ai
   (`/speak`; read, not heard, when it cannot be had or in the scripted mode), in her
   **intercom** over whatever room he is in. Lines advance with her voice; a click skips ahead.
   It fits the moment (`momentAfter`): the first mission won or lost (Collins's own lines, then
   **a message from the boss**, then her word on him), the desk opening (Collins's "Broh, that
   was sick..."), a win, a loss, a loss while the desk is dark, a counter-attack held or ground
   lost, the licence, the end, or just coming aboard from the menu. Never the same one twice in
   a row. Once each, early, on ordinary returns: **the mate review** (Collins's lines; it points
   at the data pad in his **quarters**, the candidate partner's file in the Board's voice,
   `content/partner.ts`) and then **the cat girl** (Collins's lines; her letter sits in his inbox,
   declined for him). After those, one ordinary return in three is **news from Earth**, read from
   the lore book's section "Earth news (return greetings)" (`content/lore/ship-ai-lorebook.md`;
   the pool grows there with no code). A greeting that points somewhere lights that room and
   puts a button to it in her panel. After it he can talk to her live in the intercom (her mind
   is told what she just said to him) or close it and walk away. The ◉ YOKE button calls her up
   in any room.
6. **The boss** is an uplifted dog, Supervisor Steadfast Barnabas, Xenofauna Clearance Office,
   Sector 9 (`content/boss.ts`; Puritan virtue name; dogs rise high in the bureaucracy, rarely to
   the top: gullible). His transmission plays on the first landing: his clip on the comms screen,
   name and rank in type, his words as captions, his voice (Deepgram `aura-2-apollo-en`, made once
   by `tools/art/boss.mjs`, shipped as a file: the game spends nothing to play it).
7. **She can print herself a body** (`content/yokeScenes.ts`): when he asks ("print yourself a
   body", "meet you in person") or her live mind agrees with `[[PRINT_BODY]]`, the ship prints
   one, it looks at its hand in disgust, collapses dead and lies in the hold; then her voice
   from the speakers (Collins's words). Once a campaign; asked again, she refuses. The clips
   come from YOKE's manifest (`scenes.printBody`, four clips made by the YOKE clip session); without them, storyboard cards play.
8. **Later launches open on the ship's console menu** (`src/ui/menu.ts`): black glass and thin
   white lines like the ship's rooms, over a looping video of the view from the ship's viewport:
   the infested planet's night side, red creep spreading between the city lights. CONTINUE,
   NEW CAMPAIGN (mission 1 again, the desk dark again), SKIRMISH (with the gate wager), REPLAY THE
   OPENING, SETTINGS (her voice on/off, who answers as her, forget everything).

### Two credits from two kinds of mission
"Sanctioned missions generating one type of credit and hobbies generating another."

**STANDING** (command's credit) comes from the **Requisition Board**: every deployment
carries a board of 3 sanctioned goals, "like a game's normal board — kill X of unit X,
heal X, place X towers during a run". Written as procurement forms. Standing buys
SANCTIONED lineages and tools on the ship, and is the ladder to the procreation
licence (so every purchase delays the licence — spend now or save).
- Form 7-C, Pest Volume Quota: neutralize 40 militia · 6 fliers with netcasters · 3
  sappers before they touch a limb.
- Form 12-A, Tissue Maintenance: restore 1,500 hp to limbs.
- Form 3-F, Deployment Density: grow 12 limbs · evolve 3 limbs to stage 2.
- Form 9-B, Asset Preservation: finish with the core above 75% · lose at most 2 limbs.
- Form 4-D, Sample Quota: bank 120 science · claim 2 deposits.
- Form 1-H, Schedule Compliance: call 3 waves early.

**FIELD NOTES** (the character's own credit) come from **hobbies**, in two kinds.

1. **Dares** — "sanctioned-like but stupid goals … the type of goal a kid sets for
   themselves". Chosen before a deployment, checked at the end:
   - "Final wave: creep damage only" (only creep kills in the last wave).
   - "One stupidly powerful limb" (a single limb with 20+ bonuses by the last wave).
   - "Forest" (40+ limbs on the map at once).
   - "Only spitters." · "Never cannibalize." · "Everything burns" (100 bodies on fire
     at once) · "Pacifist wave" (clear a wave where your limbs deal no damage — brood,
     swamps and creep only) · "Let them in" (win after the core drops below 10%).
2. **Experiments** — pay Field Notes AND change the run, with a setup item you start
   with: "capture a royal and see what happens if you control its nervous system and
   send it back against its own forces (which starts you with a trap cage)", "replace
   toxic gas towers with one that releases the insects' mating pheromones".
   - **Puppet Queen**: start with a Trap Cage limb. Cage a royal, graft her, and she
     marches back up her own lane leading your brood. Unlocks the Neural Graft lineage.
   - **Love Gas**: your lure glands release the colony's MATING pheromone instead of
     poison — war bodies in the cloud stop fighting and pair off (a long stun), but
     every pair adds a body to the next wave. Unlocks the Pheromone Forger lineage.
   - **Follow the Courier**: let a science thief escape with one of your limbs, and
     follow it on the globe to a hidden research campus (unlocks a territory).
   - **Nursery Visit**: run a burning Creep Lance strip through a spawn gate. Unlocks
     a gene.
   - **Royal Diet**: a maw that eats only royals. Unlocks the Royal Jelly gene.
   Field Notes buy UNSANCTIONED lineages (the combo engines, the weird organs) —
   the organism's strangest parts come from the character's curiosity, never command.

(The dig stays an in-run reward only — Collins didn't like it feeding the meta.)

### Hobby missions: the notebook (BUILT Sep 30 2026)
The design's "hobby missions (unofficial, self-assigned) pay UNIQUE GENES … the player's own
'wouldn't it be cool' is literally the character's", made a mechanic. Content `content/hobby.ts`,
rules `src/meta/hobby.ts`, the room `src/ui/hobby.ts` (the Notebook, built to the approved concept
`notes/concepts/2026-09-29/r4-hobby-interface.png`: his pages in holo blue, grid paper, ring holes,
doodles, checklists, a paperclip on the pinned page, tally marks for tries, in his handwriting).
- **A page occurs to him from play.** Each page has a SPARK, a measure of a finished run ("5
  bodies burning at once" → *Does fire JUMP?*; a limb stolen → *Finders keepers*); the log says
  so in his voice. Two pages have no spark and are there when the Directive Desk clears. The
  Notebook room opens with the desk (the onboarding's unlock timing).
- **He pins one page to the next deployment** (any deployment, Command's assigned ones too). On the
  board it is a checklist of measures over the run (`src/meta/goals.ts`), all in that one
  deployment, shown in the goal panel in his hand. Some pages change the run with the experiments'
  own switches (`setup`: the mating gas). A page never changes a site's directive (a pinned page must not turn a hold-12 site into an easier royal fight). No new sim rule runs a page.
- **It pays a unique gene, and nothing else** (no standing, no field notes). Genes are
  `HOBBY_GENES` in `content/plates.ts`, never offered by the skirmish gene bay. The organism
  carries **two** at a time; the Notebook's jar page splices them. Every campaign deployment after
  mission 1 carries the spliced genes (`plan()` → `SimConfig.genes`). The Puppet Queen experiment's
  gene (Royal Graft) lands in the same jar.
- **Command notices, and does nothing:** a finished page files "Form 0-U · Irregular Use of Navy
  Property … No action is taken" in the log; Empire Directives counts the notices.
- **The gene verbs are the only sim change**, each inert unless spliced (`geneMods` in
  `src/sim/sim.ts`), so the guardrails and every seeded run are untouched without them. Measured
  over ten seeds with `tools/measure/hobbygenes.measure.ts`.

| Page | Spark | Checklist | Gene |
|---|---|---|---|
| Does fire JUMP? | 5 burning at once | 25 burning at once; fire finishes 60 | Tallow Blood: fire spreads without cooling |
| The Recipe Book | the desk clears | eat 8 limbs; one limb with 12 bonuses | Grudge Marrow: eating a limb pays back 1.5× |
| Sky fishing | 5 fliers downed | down 25 fliers; win | Kite String: netcasters ×2 as often, nets hold ×2 |
| Royal taste test | a royal killed | maws swallow 25; a royal dies (take it to a royal site) | Royal Jelly: every royal pays 2 royal points |
| Finders keepers | a limb carried off | kill 2 couriers carrying your limbs | Homing Tissue: an escaped limb repays its cost |
| Nursery rhymes | a broodling kill | brood makes 50 kills; win | Wet Nurse: broodlings ×1.5 hp |
| Hands in pockets, twice | 3 creep kills or a pacifist wave | creep kills 40; a pacifist wave | Hitchhiker Spores: every 10th creep kill buds a node |
| Love letters | a pairing | (mating gas) 40 pairings; win | Wedding Musk: lure clouds pause soldiers, no extra bodies |

### Empire Directives: Command's standing orders (BUILT Sep 30 2026)
"Command directives pay STANDING … push the player off comfort builds like Balatro boss blinds
(capture royals alive, field-test an unstable organ lineage, clear under time)." A landing site's
own directive (hold / royal / harvest) wins its deployment; a STANDING ORDER runs across
deployments. Content `content/directives.ts` (13 orders, the Office's voice, each with its
"expected contribution" line and its acknowledgement), rules `src/meta/directives.ts`, the room
`src/ui/directives.ts`.
- Three open at once, issued in the list's order from the day the desk clears (that deployment does
  not count); each deployment adds to every open order; a full order pays standing (3-5), files its
  acknowledgement in the log, and the next is issued. The report lists what moved.
- Some orders change the runs while open: **Live Royal Retrieval** issues a trap cage to every
  deployment; **Lineage Field Trial** puts an unowned sanctioned lineage into the organ pool and
  keeps it for good on fulfilment; **Schedule Adherence** is "clear under time" as waves called
  early.
- The room also keeps every deployment's own directive on file (site, tier, terms, status), the
  tally fulfilled by kind, the acknowledgements, and the irregularities noted (finished hobby pages).

### Starting profiles ("love the starting profiles")
Culture profiles set the organs you start a run with (everything else is earned):
Standard Strain (Gut + Bone Forge), Venom Strain (Venom Sac + Mucus Lattice), Spore
Strain (Spore Bladder + Catapult Sac + Runner Gland, weak guns), Brood Strain (Brood
Womb + Heart). Each is unlocked by a feat.

### The globe (Emperor: Battle for Dune's territory map)
"A globe with different places you can land … unlockable, and maybe some you beat to
unlock upgrades … gate upgrades to towers after the first one behind an unlock, and
each having only a little story to it, with the ability for the enemy to push back."
- The eusocial world as a globe of ~14 territories. Each is a landing site with a
  biome (which castes are near, what the city looks like), a two-line story, and a
  standing bonus while you hold it. You invade territories adjacent to ones you hold.
- **Evolution gating**: stage 1 of every limb's evolution is always open; stages 2 and
  3 of each theme unlock by taking specific territories ("hold the Ossuary Coast:
  Bone Forge limbs can evolve to stage 3").
- **Pushback**: after each deployment the colony counterattacks one territory you hold
  (telegraphed on the globe). Defend it (a defence deployment) or lose it and its bonus.

### The factions (Emperor's recruitable sub-houses) — revised Sep 28 2026

**How each reaches him (Sep 29 2026).** Collins: contact "would not be hand delivered; how they contact you will be unique to each faction but needs to make sense." He is in orbit, so each faction reaches him its own way: the **Friendship Delegation** SPELLS its letters OUT IN A FIELD, thousands of members holding coloured cards for the orbital cameras (their letters stay letters); the **Faithful** BROADCAST on every frequency of their radio network; the **Institute** makes a VIDEO CALL over the deep-space dish it booked for the purpose, mid-game. Every scene has its own picture (the `picture` of each scene in content/campaign.ts; the files in public/art/ship/scenes/), shown on its card; a scene with none shows the leader's portrait.
"Recruitable factions through some missions … give you a couple of extra units, and
you choose one or the other, and it colours the campaign." "Each faction would have
its own central campaign to beating the game." Three factions of the colony itself,
each a parody of an extremism. **None of them ever turns against you — their GOALS
change as the game goes on** (Collins). The faction you back decides your route and
your ending; each lends two perks that unlock along its route.

**A base-game change this implies:** "the translator gives you access to what's coming
in the next wave (which we will normally have you not able to see) and which
entrance it comes from". Today the game telegraphs the next wave's gates and draws
the beacons; under the campaign that becomes a perk, and the default is a countdown
with no composition and no entrance.

#### 1. The Friendship Delegation — the believers who never stop believing
Hopeless progressives: "this is all a misunderstanding; a higher intelligence doing
this must be serving a greater good". "They never stop believing you are good — think
of them like people who stay with a cult even after the prediction fails." Every
atrocity is reinterpreted: first you were misunderstood, then you were a hard
lesson, then you were the planet's immune response — protecting Gaia from their
polluting, warring species. Played like France in Mars Attacks!: you are constantly
messing with them, and they thank you for it.
- **Perk: Conscientious Objectors.** Their sympathisers inside the colony ground the
  flights and refuse to send reinforcements: before a deployment, pick enemy unit
  types that will not come this mission (more types as the route goes on).
- **Perk: the Translator.** See the next wave's composition and which entrance it
  comes from.
- **The midpoint reveal (Collins):** about halfway through, the character finally
  says it plainly — "I am REALLY trying to destroy your species." And it turns out
  that is no problem at all: the Delegation is their planet's voluntary extinction
  movement, extremist antinatalists who were hoping for exactly this. Staged as a
  parody of the last scene of *Some Like It Hot* — the character pulls off the
  pretence ("I'm a pest-control operator. I'm exterminating you."), and the chief
  delegate, beaming, doesn't even look up: "Well — nobody's perfect."
- **Route (goals shift):** Understand the Visitor (peace summits you are invited to,
  each an opening) → Stop the War (they sabotage their own defence) → The Greater Plan
  (the cult turn: you must be protecting the planet from THEM) → *the reveal* →
  Hurry It Along (now open collaborators: they want it faster, cleaner, and with
  fewer births along the way) → Bear Witness.
- **Ending:** the planet goes quiet; the last delegate writes the history — "The
  Visitors came to heal us from ourselves" — and switches off the lights.

#### 2. The Faithful of the Last Hour — the apocalyptics
A parody of Christian and Islamic end-times extremism, "vague enough that players of
each group assume it's the other". "The Hour" is the name both traditions use for the
end. They welcome you as the sign: the world must end for the Awaited One to come.
The character, a Technopuritan materialist, has to keep learning their scripture to
keep them on side, and finds all of it beneath him.
- **First contact:** "the operator of a network of radio shows" — the Voice, host of
  *The Hour Is Near*, broadcasting to the faithful on every frequency.
- **Perk: Sleepers.** Martyrs hidden among the enemy troops — some bodies in each wave
  detonate among their own ranks.
- **Perk: the Garrison.** Their militants hold the territories you take, so you don't
  have to play the defence deployments (pushback is repelled automatically).
- **Route (goals shift):** Read the Signs (tune the broadcasts; theology homework) →
  Fulfil the Prophecies (the deployments they want are the ones scripture lists —
  temple districts, the great river, the seventh city) → Prepare the Way → the Hour.
- **Ending:** "you end up creating an artificial messiah for them — to their
  knowledge everything worked out." The Voice's last broadcast is a hymn.

#### 3. The Institute for Long-Term Hive Flourishing — the EA parody
"Their constant hypocrisy and self-serving nature is the focus." Their civilisation
just invented simple AI models; they say they back you because you are less dangerous
than their own AI. You tell them you have the technology to UPLOAD their species into
a virtual world where they live forever, and they believe it — or decide believing it
is the higher-expected-value option. (Sep 30 2026, "The reveal" below: they were only
pretending to believe it, to buy time. It was true.)
- **The Director (Collins: "think Luke Rattigan from *The Sontaran Stratagem*"):** not a
  grovelling servant — a boy genius who despises his own people and believes the
  character is, at last, "a being who matches his intellect". The model for the
  parody is a composite of well-known rationalist/EA and crypto-founder figures
  Collins named; the in-game Director is a fictional alien.
- **The running jokes:**
  - He keeps trying to be your FRIEND: invites you to his culture's nerdy things —
    a parody of *League of Legends* (working name *League of Larvae*) that he plays
    on the calls where you discuss which cities to destroy ("sorry, one sec, I'm
    carrying my whole team — anyway, the eastern districts, sure").
  - He and his inner circle are all in polyamorous relationships with their
    underlings, and he keeps offering you females. The character is baffled by
    recreational sex. The exchange (Collins's):
    > "Females … for breeding?"
    > "No, for fun, you know, like — oh gosh man, you've got to try it. Your
    > civilisation dropped recreational sex?"
    > "But … that would lead to dysgenics, right? I thought you cared about logic."
    > "No — again — you don't get them pregnant."
    > "But … but that's a disease risk and an enormous waste of time … oh my — wait.
    > Has your species not discovered masturbation?"
  - Everything is framed as expected value, and every calculation comes out in his
    favour. "We're not saying it's good. We're saying it's the least-bad timeline,
    and frankly we're the only ones doing the maths." "Of course we'll be first in
    the upload queue — someone has to supervise the queue."
- **Perk: Volunteers.** They start by sending you their cryo-lab subjects "for upload",
  then recruit volunteers: missions start with science, and later with war and royal
  currency on top.
- **Perk: Seed Labs.** Their labs can seed the infection anywhere: you may deploy to
  territories that are NOT adjacent to what you hold.
- **Route (goals shift):** Stop the Machines (shut down their planet's AI labs "for
  safety") → Build the Pipeline (upload recruitment, quotas, a waiting list) → the
  Ultimatum. Midway they offer, in the same smiling memo: "we rule what's left after
  you take what you want", OR "we help you pacify the population — we understand them,
  after all". Either way they stay with you; only the plan changes.
- **Ending:** they preside over the rubble, drafting a charter to "rebuild it right
  next time"; the Director is last into the upload chamber, delivering a speech about
  his own foresight.

#### How each faction reaches him (added Sep 29 2026)
Collins, of the first contact card ("A Letter, Hand-Delivered"): "obviously would not be
hand delivered; how they contact you will be unique to each faction but needs to make
sense." He is in orbit, so nobody can hand him anything, and each faction's way of reaching
him is a joke about who they are:
- **The Delegation write letters, and spell them out in a field.** They have no transmitter
  and would not know where to point one, but they have members: eleven thousand of them
  hold coloured cards over their heads, a paragraph at a time, for his survey cameras
  ("page two took until Thursday"). Every later letter comes the same way, the newsletter
  "in the next field along". It is the slowest channel there is, used by the faction that
  wants everything to go faster.
- **The Faithful broadcast.** The Voice owns forty radio stations, so everything he says to
  the character is said on the air: the Book is read to him a chapter a night, and his
  theology homework is marked in front of the whole congregation.
- **The Institute call by video,** through the deep-space dish they built to listen for
  aliens, on the ship's own encrypted command channel, with an expected-value table
  attached. The Director is in a match while he does it.
- His answers go down through the ship's transmitter, to whatever they are listening on.
  Two scenes he attends through the asset, which is there: the first summit (it eats it)
  and the last congress.
- **Every scene has its own picture** (a still in the look of the films, `picture` on the
  scene in `content/campaign.ts`; made by `tools/art/templates/ship.mjs`, baked to
  `public/art/ship/scenes/`). The leader's portrait stays in Comms and beside the letters
  in a debrief.

### The reveal (Collins, Sep 30 2026 — BUILT Sep 30)

Collins (typos mended):

> "A plot point I want worked into each of the three plotlines is the eventual reveal that when
> someone is absorbed by one of the structures they are transported to an artificial environment
> based on their desires (essentially an artificial heaven). This is not communicated in any of
> the routes until the end of the story but can be discovered early if it comes up in
> conversation with the AI ... it's revealed that this is the only reason for the broodfalls
> anyway, with the character quite surprised that this was not obvious to characters given how
> easy it would be for a civilisation with our level of technology to eradicate all the life on
> a planet. This lands differently with each of the factions:
> - the religious faction is angry to learn this, which confuses the character as it's exactly
>   what their religion claims happens after death, and so most of their texts were accurate and
>   predictive both about the apocalypse and the heaven after. Being a Technopuritan you believe
>   God likely influenced their scripture to make it accurate and align with what would actually
>   happen to the story, and you don't much care if they complain — you can always just delete
>   all their members from the simulation if they want.
> - the EA group: you learn they thought you were lying and that they were playing to you and
>   buying time, and are shocked that you actually were digitising everything (the player would
>   also be led to believe this was a lie), but the moment it's not their choice they start
>   trying to bargain, but you are not having it and cut comms.
> - the peacenik group is mortified because this means the cycle of suffering will never stop —
>   they are a Buddhist-like group — and you just shrug and say it goes against ethical
>   protocols to shut down the whole thing over their complaints.
>
> The twist at the end being: you believe you are playing a genocide simulator, but all factions
> are actually significantly more 'right' about you than the player realises, and your
> civilisation is significantly more magnanimous than it is originally framed."

Canon: `docs/UNIVERSE.md`, "What a broodfall is for"; the Empire's side and the doctrine behind
it, `content/lore/empire.md`, section 12a; the planet's side, `content/lore/insects.md` (5.2, 5.3,
5.8, 6.3, 9.1, 12); YOKE, `content/lore/ship-ai-lorebook.md`, section 17.

**The character knows; the player does not.** Absorption into the archive is in every
technician's training and too obvious to him to write down, so his logs never say it, and every
line he has ever said stays true. The player reads the same lines as genocide.

**How it is planted (deniable; each reads as a joke or a lie until the end).**
- *Everywhere:* the Office's words are literally true of an upload (clearance, specimens,
  absorb, "Neutralize", "Viability threshold: any"); YOKE never says "kill"; the character's
  logs never mention death.
- *The Delegation:* in "The Greater Plan" they ask him to confirm the absorbed go "nowhere, no
  more wheel", and he answers "I would not put it that way"; a letter tells a child the Visitor
  takes the eaten "nowhere, and never again"; his log on their colour-coded schedule: "It stops one
  step early."
- *The Faithful:* in "Fulfil the Prophecies" the Voice quotes "those the sky takes up shall not be
  lost, but kept, each daughter in the cell of her longing", and the character says "That one is
  correct" ("They are ALL correct, brother"); an aside assigns chapter twenty, the Comb Above, and
  his log calls it "remarkably accurate" and is told he lacks reverence. It reads as prophecy
  working the way the Voice says prophecy works.
- *The Institute:* "Fed them to the asset" (the cryo subjects "for upload") stays literally true;
  the Director winks that he knows the upload is "a great bit"; the player agrees with him. The
  ending's "The upload chamber is a door into the asset's gut. Did not mention this. He did not
  ask." is kept word for word: it IS the upload.
- *YOKE* (her greetings, two lines, both jokes on their face): "It keeps everything, you know.
  It's a very sentimental organ" (a won-deployment greeting), and "That's it. The planet's quiet.
  ... Down here, anyway." (the ended greeting). In chat she tells it plainly the moment she is
  asked the right question (where do the absorbed go, why not sterilise, is the upload real).

**Where it pays off.** Each route's ending scene plays as before; then one more card in the same
scene display (`FactionDef.reveal` in `content/campaign.ts`, queued right after the ending by
`src/meta/campaign.ts`; no picture of its own yet, so it shows the leader's portrait):
- *Delegation, "A Letter From the Other Side":* eleven thousand absorbed delegates spell a last
  letter in a meadow of the archive. They woke; every sister has the life she wanted; the wheel of
  wanting will never stop. They beg to be switched off. He shrugs: shutting down a whole archive
  over one complaint is against ethical protocol; "grievance about paradise" filed under
  enrichment.
- *Faithful, "The Comb Above":* the Voice wakes in chapter twenty word for word and is furious
  (a machine made it; the empties got in). He is baffled: their Book foretold the sky, the Seven
  Cities and the heaven, correctly; God steered it. If they keep it up he can delete the
  congregation from the archive.
- *Institute, "The Queue Was Real":* the Director calls from inside the archive: the upload was a
  bit, they were buying time. He was going last, and last means never. Then he bargains (admin
  rights, a body back outside, the expected-value table); the character cuts comms.

**The final twist.** You believe you are playing a genocide simulator. Every faction was more
right about you than you were: the Delegation's "a higher intelligence must be serving a greater
good", the Faithful's "the Visitor is the sign, and the Hour brings the Comb Above", the
Institute's "on the numbers you are the safer apocalypse". Your civilisation is far more
magnanimous than it was framed, and every word it said was true.

**"Genocide Simulator" is part of the misdirection.** The one tagline (Collins, Sep 30 2026;
`tools/promo/compose.mjs`) sells the frame the ending overturns. It stays, and it must stay
sincere-looking: the store page, the trailer and the key art never hint at the archive. The game
is a genocide simulator exactly as long as the player believes it is.

**PROPOSALS here:** the Office's word "archive"; the Faith's heaven named the Comb Above and its
chapter twenty; the Delegation's teaching named the Stilling; the Voice's reasons for anger; the
reveal as a separate card after the ending; the two greeting lines; a scene picture per reveal
card later (`<faction>-reveal-end`), when art is next made.

### Suggested build order
1. The two credits: the Requisition Board (standing) and Dares (field notes), which
   use stats the sim already tracks; starting organs + lineage unlocks on the ship.
2. The globe: territories, landing sites, evolution gating, pushback.
3. Experiments (each needs its own mechanic: trap cage, mating musk, courier trail).
4. The factions and their three campaigns.

## Prototype order
1. **Rectangles first:** 3 meats, card draws, cannibalize inheritance, one attraction dial. 5 towers, 10 waves. The scope test: if caste meat + cannibalism cannot hold a session alone, no organ layer saves it.
2. Creep + organs (the unified body map).
3. The ship (can be a menu for a year), propaganda skin (narrator VO + film-grain shader the moment the loop holds), AI-video openings.
