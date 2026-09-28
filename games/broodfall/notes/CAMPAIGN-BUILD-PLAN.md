# Campaign build plan (Sep 28 2026)

Collins: "now let's build the rest of this we outlined … the story parts, the map, the
ship, the beats, the upgrade unlocking points, missions, everything — first think
through what everything is that needs building." Design source: DESIGN.md "THE
CAMPAIGN". This is the inventory, in build order. Each block lands as its own commit.

## 1. Sim hooks (the run must report and obey the campaign)
- **RunStats**: kills by kind and by killing limb family and by cause (limb / creep /
  brood / swamp / other), tissue healed, limbs grown, evolutions, limbs lost,
  cannibalizations, lowest and final core %, science banked, deposits claimed, waves
  called early, most limbs at once, most bodies burning at once, most bonuses on one
  limb, families grown, per-wave limb damage (pacifist waves), last-wave kills by
  cause, royals eaten by maws, mating stuns, puppet kills, limbs carried off the map.
- **Campaign config (SimConfig)**: organ pool (what the organ stage may grow), start
  organs (pre-grown by the starting profile), evolution caps per theme (the globe's
  unlock points), banned enemy kinds (Delegation: Conscientious Objectors), hidden
  wave intel (default in campaign; the Translator reveals it), sleepers (Faithful:
  martyrs detonating inside enemy waves), start bonus meat (Institute: Volunteers),
  experiment setup flags (trap cage, mating musk).
- **Experiment mechanics**: Trap Cage limb + grafted Puppet Royal ally; Mating Musk lure
  clouds (stun war bodies; each stun adds a body to the next wave); courier escapes
  counted; burning near gates counted; maws eating royals counted.

## 2. Content (content/campaign.ts + content/lore/)
- **Requisition Board**: ~12 sanctioned goal forms with scaling targets, 3 drawn per
  deployment, pay standing.
- **Dares**: ~10 kid-goals, pick up to 2 per deployment, pay field notes.
- **Experiments**: 5 (Puppet Queen, Love Gas, Follow the Courier, Nursery Visit, Royal
  Diet): setup item, goal, reward (field notes + an unlock).
- **Starting profiles**: Standard, Venom, Spore, Brood — start organs + unlock feat.
- **Lineages**: the starting organ pool; sanctioned lineages (standing prices);
  unsanctioned lineages (field-note prices).
- **The globe**: ~14 territories — name, position on the sphere, neighbours, biome
  (plate features, entrances), directive, two-line story, the evolution stage it
  unlocks (the upgrade unlock points: stages 2 and 3 of each theme), faction contact.
- **Factions**: 3 × contact scene, route beats (briefing + debrief text + the
  territory/condition that triggers each), perks by beat, midpoint beats (the
  Delegation's "nobody's perfect" reveal; the Institute's ultimatum choice; the
  Faithful's prophecies), finale territory, ending text. The Director's calls and
  running jokes, the Voice's broadcasts, the Delegation's letters.
- **Voice of the ship**: the character's cheerful personal logs, the Board's form
  letters, the licence ladder.
- **Ship AI lore book** (content/lore/ship-ai-lorebook.md): the big lore document the
  ship's AI will use to play out discussions (sections now; filled out later).

## 3. Campaign logic (src/meta/, no DOM, fully unit-tested)
- Campaign state + versioned save; new / continue.
- Deployment building: territory → SimConfig + board goals + dares + experiment +
  faction perks + evolution caps + organ pool.
- Run evaluation: goals vs RunStats → standing + field notes; territory captured;
  profile feats; experiment unlocks.
- The globe: adjacency invasion (Seed Labs lifts it), pushback (telegraphed attack on a
  held territory: defend or abandon; the Garrison repels it), hidden territories.
- Factions: contact → choose one (exclusive), beats advance with captures and
  choices, perks unlock per beat, finale → ending.
- The ship: buy lineages and profiles; the licence ladder (standing balance).
- Ship AI wiring: triggers (first landing, faction contact, midpoint, ending, idle
  ship) queue a discussion; engage / not now; transcript saved; a provider interface
  (scripted now, a model with the lore book later).

## 4. Screens (the player path)
- Menu: CAMPAIGN (new / continue) and QUICK DEPLOYMENT (today's skirmish, all unlocked).
- The ship: rooms — Directive Desk (the globe), Gene Bay (lineages, profiles, splices),
  Specimen Locker (experiments, field notes), Procreation Board (standing, form
  letters), Comms (faction calls and broadcasts), AI Core (the ship AI terminal).
- The globe: a rotatable planet with landing sites, held / frontier / locked / under
  attack states, neighbour arcs; click a site for its briefing.
- Briefing: territory story, directive, the Requisition Board, dare picks, experiment
  pick, faction perks (Objectors pick), DEPLOY.
- In run: wave intel hidden unless the Translator is with you; the HUD shows the board
  goals' progress.
- Debrief: goals met, credits, territory taken or lost, the faction beat, a log entry.
- Faction contact and beat scenes; the ending screen.

## 5. Bot, tests, checks, docs
- The autoplayer plays campaign configs (pool, caps, hidden intel).
- Unit tests for every rule above; a browser beat that plays a campaign loop by clicks
  (menu → ship → globe → briefing → run → debrief → ship).
- DESIGN / HANDOFF / README / notes.
