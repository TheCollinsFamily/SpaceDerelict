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
| the last mission | main | The Transports: FILMED; Founding Day: FILMED (Oct 12, reworded) | same | same |
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

8. [x] **YOKE repeating herself:** fixed Oct 5. With the once intros and the Earth news, a simulated campaign hears no
   greeting twice. She still has only 6 lines for an ordinary win; past about capture 16 she would start over.
9. [ ] **The 3 comics are all earned in the first two missions.** More comics, earned through the campaign (one per
   plot point?), would fill the empty returns.
10. [x] **Founding Day has no film:** the speech was reworded on Oct 12 2026 (Collins's choice: St Crispin's Day in his
    voice; `notes/ROACH-KING-2026-10-04.md`). The film is made (Oct 12 2026): `public/media/scenes/rk-founding.mp4`, 84 s at 480p, five exchanges, every line heard. Four exchanges on Seedance 2.5 through Atlas Cloud; the fifth on Seedance 2.0 mini (the API's lowest-tier rule for a 12 s clip). The fifth took seven tries: the last line's "We few. We happy few. We band of sisters." trips BOTH providers' filters (Atlas: "may be related to copyright restrictions"; ByteDance through ImageRouter: "invalid content"), public domain or not; it now reads "The lucky few. Sisters of one clutch. Happy Founding Day. Go home and sleep. I will see you at dawn.", said over a crowd gone quiet. One lesson for the film system: `make` re-runs the vision gates on clips that already passed, and the HUMAN gate flipped on three good takes on the third run and remade them (about $21 for nothing); `talk <film> <exchange>` then `talkbake` makes one missing exchange without that.
11. [x] **The faction films:** all 15 baked by Oct 5 (the other session's batch), plus his briefing and the call. Left as
    cards: the midpoint's offers (a letter and a call each; a film only if you want them as films).
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

13. [ ] **The licence and the lineages compete for one wallet.** (Explained to Collins Oct 12 2026; his call. Note the
    screen already says "Every requisition you spend standing on delays the licence": it was built as a tension.) In a campaign a player gets most of the lineages OR the
    licence. Decide: count the licence on standing EARNED (a career total, spending does not lower it), or keep the
    tension on purpose.
14. [ ] **Field notes have nothing to buy after mid-campaign.** More unsanctioned lineages, or a second use for notes.
15. [ ] **Measure it on real runs** (the scripted player, a whole campaign) before tuning the numbers.

## Oct 12 2026: the board gone over with Collins

The board (`claude.ai/artifact/GaEEiXWtpEPhjv1AHaSqq9`, drawn from this file) was read item by item. What he said and what was done:

- **#10 Founding Day's film:** done (above).
- **#3 What a counter-attack return brings.** Collins: "yoke is supposed to always have something to say after a mission
  without a cinematic ... how many more lines of hers do we need and what's the best way to build that out". BUILT: every
  ordinary pool deepened (`content/greetings.ts`: won 6→12, lost 4→10, defended 2→6, fell 2→4, lost-locked 3→4, back 4→6;
  drafts, his to edit), and `greetingFor` reads a line of Earth news she has not read out whenever a pool is dry, before any
  line of hers is said twice (`src/meta/onboarding.ts`). `tests/greetingPools.test.ts`: thirty-six returns with losses and
  counter-attacks hear no greeting twice; the pools' depth is pinned. Her lines cost nothing to add (her voice is spoken live,
  not baked), and the lorebook's Earth-news list (23 lines) grows with no code.
- **#7 Hide the side orders on the last mission:** DROPPED. Collins: "that's a bad idea we just haven't built the post game
  yet". The post-game is designed in `notes/POSTGAME-2026-10-12.md` (the Roach King's simulation: his rematches from the
  archive, field notes as the stake, his arc from disappointed to at peace, the one place he can be on the field).
- **#14 Something to spend field notes on:** the post-game's stake (rule cards, the zoo); see that note.
- **#4 More kinds of mission** (brainstorm, for him to pick from; the post-game's rule cards are where to try them first):
  1. *Burn the depot* (sabotage): a structure behind their lines must fall before wave N; `kills:fieldstation` and
     `gateBurnKills` exist; new: the target on the plate and its win check. Foundry Plains (where the transports are built).
  2. *Until the evac* (survive a timer): no wave count, a stream, the clock is the win; `lateHost` and the last mission's HUD
     countdown exist. The Pilgrim Road.
  3. *The courier* (interception): stop K of N science-caste couriers before their field station; `limbsCarriedOff` and the
     experiment exist; new: a route. University Hill, the Hidden Campus.
  4. *Walk the mule* (escort): the Spore Mule must reach a point and plant a node; the waves come at it; the Mule lineage
     exists; new: the destination and the check. Mirewater Delta.
  5. *Eat the town* (siege): no war meat from kills, only from infested shelters (the last mission's ration rule
     generalised); Infestor and shelters exist. Cul-de-Sac Heights, the Commuter Ring.
  6. *Cage her* (capture alive): the trap cage as a directive: catch a royal and hold her N turns while her court comes;
     `trapCage` exists. The Temple Terraces.
  7. *Breakout* (reverse hold): walled in by the Host, the creep must reach the map's edge; `nodesPlaced` exists; new: a
     path check. Old Harbor.
  Cheap VARIANTS rather than kinds, one `SimConfig` flag each: night (no fliers), flood (slow ground), fire ban, the Host
  early, the Host late, no eating. Build 1, 2, 5, 6 first (measures and configs exist), then 3, 4, 7 (unit behaviours).
- **#13 The licence against the lineages:** explained; his call (count the licence on standing EARNED, or keep the tension).
- **Later on Oct 12:** Collins went through her lines on the page (two exports applied) and gave the brief for what a line
  is for (the header of ); every ordinary pool was rewritten to it, with the lore behind each line for
  her live mind and a prompt in the reply box. HANDOFF.md, "YOKE's lines".
- **#2, #5, #9, #12, #6, #15:** recommendations given in the session; nothing built.


## Oct 26 2026: the between-mission economy measured on real runs (item 15)

Collins: "I dont remember building out the economy for how you earn roguelite and special points between missions or how
you spend them is that built and mapped out?" It is built (DESIGN.md "Two credits from two kinds of mission"); this is it
played. `tools/measure/economy.measure.ts` (part `campaign`): a whole campaign through the game's own rules, a real Sim
for every deployment, the scripted player (`experimenter` on), the experiment tried least so far and two dares not yet
done each time, the cheapest lineage bought the moment it can be paid. One campaign (Delegation, seed 5000), 39
deployments (23 won; the bot lost the Assembly Hall five times), log in the measure's `ECON_LOG`:

- **Standing:** 119 in all (74 from the Requisition Board, the rest from Command's standing orders). All **17 of 17**
  sanctioned lineages (65) were bought by **deployment 16**; **54 standing went unspent**.
- **Field notes:** 29 in all (experiments 20, dares the rest). All **3 of 3** unsanctioned lineages by **deployment 7**;
  **15 notes unspent**. Dares done 5 of 9 (the bot cannot do "only the ground eats them", "one stupidly powerful limb",
  "let them in" on purpose).
- **Experiments:** all **5 of 5** by deployment 12 (since the fixes the same day: HANDOFF.md "The experiments, made
  playable"). Profiles: Spore and Brood from them; Venom (dare "Everything burns") not.
- **The licence** was cut on Oct 26 2026, so item 13 is closed: standing buys lineages only.

So the answer to the Oct 5 question is yes, and more than yes: every unlock is earned by about deployment 16 of a campaign
that runs 14 to 20 (more with losses), and both currencies then pile up with nothing to buy (items 14 and 15). Collins's
call: raise the prices (the sanctioned catalogue at about 1.8x would last to the finale), or give the late currency a
use (the post-game's rule cards, `notes/POSTGAME-2026-10-12.md`), or leave it for the playtest to judge.

**Done the same day: the prices were raised** (`content/campaign.ts` LINEAGES: sanctioned 65 -> 101, unsanctioned
15 -> 23; the cheap ones stay cheap, the strong ones cost 6 to 10). Re-measured the same way (Delegation, seed 5000,
40 deployments, 23 won, the bot stuck at Queen's Hollow and never reached the finale):
- Sanctioned 17/17 by **deployment 25** (was 16), bought steadily from 1 to 25: cyst@1, lattice@3, gland@5 ... acid@25,
  infestor@27. Standing 94 earned, **30 unspent** at the end (was 54), all of it piled up after the last buy.
- Unsanctioned 3/3 by **deployment 26** (was 7): atrophy@5, marrow@12, resonance@26. Notes 24 earned, **1 unspent** (was 15).
- So the unlocks now last most of a campaign. What is left over comes only after everything is bought, which is the
  post-game's question (rule cards), not a price question. Playtest to judge whether 25 feels slow.
