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

## The pacing (built Oct 5 2026)

Collins: "lets build in the pacing wire the beats into the right places and mark which are still empty (need video or
writing) ... better to leave them wanting more than less". The two plots take turns, one story film a return
(`content/campaign.ts` beat timings and MIDPOINT_CAPTURES, `src/meta/roachKing.ts` MAIN_PLOT, `src/meta/afterMission.ts`).
Counted in captures from the start (the crash site is not one; he sides with an ally after capture 1).

**FILMED** = its film is in the game. **CARD** = written, plays as its card: **needs video**. **EMPTY** = nothing written
for this slot: **needs writing**. The table is what `npx vite-node tools/measure/after-mission.measure.ts -- --run --table`
prints; re-run it after a film is baked or a scene is written.

Updated later on Oct 5 (Collins: "a general beat between what is now 4 and 5 that with YOKE text introduces the
motivation of being assigned a partner through the index ... on what is now 8, will be nine, you can add progress"): a
third thread, **the personal plot**, carried by YOKE's greeting; everything after capture 4 moved one capture later.
**YOKE** = her written lines carry the slot (no film needed).

| Capture | Plot | Delegation | Faithful | Institute |
|---|---|---|---|---|
| 1 | ally | Her desk-opening speech (the late version if the desk took more than one try), then First Summit + pledge: FILMED | The Sign + pledge: FILMED | A Little Chat + pledge: CARD |
| 2 | ally | The Leaked Plans: FILMED | It Is Agreed, Then: CARD | Sex for Fun: FILMED |
| 3 | main | His first address: FILMED | same | same |
| 4 | ally | For the Planet: FILMED | A Slave to God's Will: CARD | Running Out of Frosties: FILMED |
| 5 | **personal** | **YOKE: the Index** (why the Board assigning him a partner matters; signing at the Index office, in person, off the ship); opens a discussion in the AI Core | same | same |
| 6 | main | The home levy (or Operation Take It Back, if a counter-attack is massing): FILMED | same | same |
| 7 | ally | The midpoint: the two rivals' offers: CARD (a letter and a call) | same | same |
| 8 | main | Another Territory (the briefing): FILMED | same | same |
| 9 | ally + **personal** | Why Don't You Just Ask Me: FILMED; **YOKE: the progress** (the file moves, Maren's twenty words) | **YOKE: the progress**; the ally's slot otherwise **EMPTY** | same as the Faithful |
| 10 | main | His piece on your ally: FILMED | same | same |
| 11 | ally | **EMPTY** | **EMPTY** | **EMPTY** |
| 12 | main | The Last Stand: FILMED | same | same |
| 13 on | ally / main | **EMPTY** | same | same |
| the finale | ally | The finale: CARD | FILMED | FILMED |
| the last mission | main | The Transports: FILMED; Founding Day: CARD (the provider refuses the speech as written) | same | same |
| after it | main | Off the air: FILMED | same | same |

Besides the story, every return has YOKE's greeting, and none is said twice in a campaign while she has an unsaid one.
**The once intros** (`src/meta/onboarding.ts` INTROS; lines in `content/greetings.ts`) each play once, on an ordinary
return, never two returns running, and a lost mission does not bring one back: the boss's message (first landing) and the
mate review and the cat girl (early) as before; then his dad's message (Collins's line, from capture 2), the boss writes
again (3), the duck (4, if the first mission was won), the Board's eligibility statement (6), a second cat girl (7), the
audit (8), his dad drafting a hundred names (10, after the progress beat). The new lines are written to match Collins's,
not his words: his to edit.

A campaign reaches its finale at about capture 12 to 13 when the player heads for it (later when they take every other
landing first), so the slots to write are mostly **the ally's 9 (Faithful, Institute; YOKE's progress beat is there), 11 and 13**. The other session's film batch is turning the CARDs into films (`tools/media/make-all.mjs`).

## To do: pacing

1. [x] **The two plots alternate**, one story film a return (built Oct 5).
2. [ ] **Write the EMPTY slots** above, or leave them empty on purpose ("leave them wanting more"). The game copes: an
   empty slot is the news and YOKE's greeting.
3. [ ] **What a counter-attack return brings** (it is not a capture, so it moves neither plot): today, only the news
   and a greeting.

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

## To do: the between-mission economy (Collins, Oct 5 2026: "have we balanced the between game point system so you will earn most of the roguelite unlocks in a single play through?")

Nothing carries over from one campaign to the next except the comics: every unlock below is earned again each campaign.
Arithmetic from the content tables (not yet a measured run), for a campaign of about 14 deployments:

| Unlock | Cost | Earned in one campaign | Verdict |
|---|---|---|---|
| Evolution stages (the territories' unlocks) | a capture each | every one is on an ordinary landing; 11 to 12 of the 12 are taken | all, yes |
| Experiments (5): a gene, the Atrophy lineage, the Hidden Campus, the Spore and Brood strains | one deployment each, from capture 1 to 4 | 5 of about 13 deployments needed | all, yes |
| Strains (profiles) | a dare or an experiment | yes | all, yes |
| Unsanctioned lineages (Marrow 5, Resonance 6) | 11 field notes | experiments alone pay 18; dares pay 2 to 3 every time | all by mid-campaign; **notes pile up with nothing to buy** |
| Sanctioned lineages (17) | **65 standing** | the board pays 1 to 2 a form (3 forms a mission: about 2 to 4.7 a mission), Command's 13 orders 47 in all (perhaps 7 to 9 of them met), the first mission 4: **about 65 to 80** | just about all, IF nothing else is bought with standing |
| The procreation licence | **60 standing held at once** (it reads the balance) | the same 65 to 80 | **competes with the lineages**: spend standing and the licence slips back |

13. [ ] **The licence and the lineages compete for one wallet.** In a campaign a player gets most of the lineages OR the
    licence. Decide: count the licence on standing EARNED (a career total, spending does not lower it), or keep the
    tension on purpose.
14. [ ] **Field notes have nothing to buy after mid-campaign.** More unsanctioned lineages, or a second use for notes.
15. [ ] **Measure it on real runs** (the scripted player, a whole campaign) before tuning the numbers.
