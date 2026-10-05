# Missions, and what happens after them: the state and the to-do list (Oct 5 2026)

Collins: "5 territories for each plot point may be too many, how many territories are there in total? we should also
create a to do list around the various missions and how they differ as well as the various things that happen after a
mission". Numbers from `content/campaign.ts` and from whole campaigns played through the game's own rules
(`npx vite-node tools/measure/after-mission.measure.ts -- --run --table`).

## How many territories

**17 in all** (`content/campaign.ts` TERRITORIES):

- 1 is the crash site (the first mission, held from the start).
- 3 are faction finales (the Assembly Hall, the Seventh City, the Glass Spires). A campaign plays ONE of them, its ally's.
- 1 is the last mission (the Hive House).
- **12 are ordinary landings.** A campaign takes 11 or 12 of them before its finale (the finale is reached through its
  neighbour: Ossuary, Pilgrim Road or University Hill).

So a campaign is about **12 to 14 captures**, plus whatever counter-attacks the player chooses to fight. Simulated,
every mission won: 14 missions allied with the Faithful, 19 with the Delegation or the Institute (the extra ones are
counter-attacks).

## When the plot points come today

The thresholds are cumulative, not 5 per point. The main plot (the Roach King):

| Plot point | Trigger | Comes at, simulated |
|---|---|---|
| His first address (`rk-address`) | the 3rd deployment | mission 4 or 5 (waits one if the ally has a scene) |
| The home levy (`rk-draft`) | 3 territories held | missions 7 to 9 |
| Operation Take It Back (`rk-counter`) | a counter-attack is massing | missions 5 or 6 |
| On your ally (`rk-delegation`/`-faithful`/`-institute`) | 2 of the ally's beats seen | missions 6 to 8 |
| Another Territory (`rk-briefing`, the film) | **5 territories held** | missions 6 or 7 |
| The Last Stand (`rk-stand`) | 8 held and every ally beat seen | missions 9 to 11 |
| The Transports + Founding Day (films) | the last mission is launched | after the finale |
| Off the air (`rk-offline`) | the last mission won | the end |

The faction plot: the first interaction (from the signal), the pledge, then a beat at captures 1, 2 and 3 after the
pledge (the Delegation; the Faithful at 1 and 3, the Institute at 1 and 2), the midpoint offers at 2, the finale on its territory.

**The shape this gives:** everything is crowded into missions 2 to 11, and from about mission 10 to the finale (13 to 18)
a return brings the news and a greeting and nothing else: **5 to 9 empty returns a campaign**.

## To do: pacing (decisions for Collins)

1. [ ] **Space the two plots across the whole campaign, alternating.** Recommended: with 12 captures, the faction plot on
   one capture and the main plot on the next, so every return has one story film and none has two. That needs the
   faction beats spread out (now at captures 1 to 3 after the pledge; for instance 1, 3, 5, 7) and the main plot's
   triggers counted in captures (for instance 2, 4, 6, 8, 10) instead of 3, 5 and 8 held.
2. [ ] **How many main-plot points?** Today 6 before the finale. Alternating over 12 captures leaves room for 6, so it
   fits, but there is no slack for a lost mission.
3. [ ] **What a counter-attack return brings** (it is not a capture, so it moves neither plot): today, only the news
   and a greeting. A Roach King line about it (`rk-counter` is the only one) or nothing.

## To do: how missions differ

Today a mission differs by its **order**, its **tile set**, its **tier** (which enemies), its **entrances** (1 to 3),
and what the player brings (dares, an experiment, the Objectors):

| Order | Territories |
|---|---|
| Hold N waves | 10 of 17: Crash Site, Cul-de-Sac, Harbor, Commuter, Foundry, Mirewater, Pilgrim, Queen's Hollow, Assembly, Glass Spires (+ the last mission, with its own rules) |
| Harvest science | 3: Granary, University, Hidden Campus |
| Kill the royal | 3: Temple, Ossuary, Seventh City |
| Defend (a counter-attack) | any held territory, on the board it was won on |
| The last mission | the Hive House: a countdown, the court and the science caste only, a shelter from the start, then the Host |

4. [ ] **10 of 17 missions are "hold N waves"** (11 with the last mission). Decide whether that is enough variety or each order type should get
   its own territories more evenly (and whether there should be new order types, e.g. escort, sabotage, survive a timer).
5. [ ] **The three finales are two holds and a royal kill.** A finale could get its own rules, as the last mission has.
6. [ ] **No boss on the field in the last mission** (the Roach King is not on the board; he would need his own art).
7. [ ] **The Requisition Board** (the side orders) still shows on the last mission, with nothing left to spend on.

## To do: what happens after a mission

Today, every return: **the planet's news** (a newsreel or a paper) → **at most one story film** (the ally's scene, or a
Roach King piece if the ally has none; `src/meta/afterMission.ts`) → **YOKE's greeting** (nothing said twice in a campaign
while she has something new). Also, sometimes: a letter or call from the ally between beats (`asides`: 7 to 9 per
faction), a comic earned, the boss's message (first landing only).

8. [ ] **YOKE has 6 greetings for a win** (and 5 for an ordinary return); a campaign has 12 or more wins, so she repeats
   from about the 10th. About 10 more win lines would make every one new.
9. [ ] **The 3 comics are all earned in the first two missions.** More comics, earned through the campaign (one per
   plot point?), would fill the empty returns.
10. [ ] **Founding Day has no film:** the provider refuses the speech as written (Collins is handling it).
11. [ ] **15 faction films are being made** by another session's batch (`tools/media/make-all.mjs`).
12. [ ] **Decide what a return must always bring.** The rule today is the news + a greeting + one story film when one is
    due. If "one unique thing after every mission" means a story film or a comic EVERY time, the pacing in 1 and the
    comics in 9 are what get there.
