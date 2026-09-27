# Well-loved enemy types across the TD genre — review vs Broodfall (Sep 26 2026)

Requested by Collins alongside the risk system ("what enemy types or abilities do
people like in tower defense — take them for inspiration, assign them the correct
RISK which drives spawn counts, and make sure they're assigned to the right faction").
Verdicts: HAVE / BUILT TODAY / SKIP (with reason).

## The archetypes

| Beloved enemy (game) | Why players rate it | Broodfall | Risk | Caste |
|---|---|---|---|---|
| Fast swarm (KR wolves, BTD grouped ceramics) | Overwhelms slow guns, dies to splash | Skitterling — BUILT (tiny, 66 speed) | 1 | war |
| Splitter (Bloons' whole premise) | Killing it makes MORE; splash + cleanup layers | Gravid Husk (splitter) — BUILT: shot dead → 2 skitterlings; EATEN WHOLE by a maw → nothing (the maw is the splitter answer) | 5 | war |
| Tank (golems, ceramics) | A wall of hp that reorders targeting | Elite / Phalanx — HAVE | 6/10 | war |
| Flier (KR, Defense Grid) | Ignores the maze | Flier — HAVE | 4 | war |
| Shielded per-hit (Defense Grid crashers) | Punishes big single hits | Phalanx armor cap — HAVE | 10 | war |
| Hit-count shield (BTD lead/DDT flavor) | Punishes RAPID fire — the mirror | Carapace Lord — BUILT: blocks first 6 HITS outright; big blows strip it fastest; poison seeps through | 8 | war |
| Healer (KR shamans) | Priority-target decision | Tender — HAVE | 8 | war |
| Buffer/drummer (KR, Legion TD auras) | Kill-order decision #2 | Drummer — HAVE | 8 | war |
| Tower-attacker (KR paragons, Mindustry) | Your stuff is not safe | Sapper (climbs) + Bomber (charges walls) — HAVE | 9/7 | war |
| Siege from standoff (KR catapults, They Are Billions mutants) | Outranges short guns; forces long-gun coverage | Mortar Beetle — BUILT: halts 85px out and bombards structures; spitters/impalers outrange it, broodlings tie it up | 8 | war |
| Digger/phaser (KR shadow walkers) | Skips the outer maze | Tunneler — HAVE | 9 | war |
| Thief (Mazebert, CoC goblin) | Attacks the ECONOMY, not the wall | Specimen Thief — BUILT: science caste, slips in with study parties past interest 12, steals 15 war meat at the creep and runs; kill the courier to recover it | 4 | science |
| Spawner/necromancer (KR necromancer) | A source that must die first | Royal Consort — REWORKED Sep 27: instead of breeding, it PROMOTES war bodies a rank every 5s and carries the royal presence aura (royals = strong warriors that power up others) | 14 | royal |
| (no genre precedent) Smart pathers that probe for gaps | — | The whole SCIENCE caste (Collins's idea, Sep 27): coverage-aware routing to the least-defended limb, which they sedate and steal. Collins: "I have never seen this behavior in a game before." | 3 | science |
| Boss with escort (every TD) | The event fight | Royal + consort + elites — HAVE | 40 | royal |
| Camo/stealth (BTD camo) | Detection coverage puzzle | SKIP for now — "towers that can't see" needs a detection layer; candidate if a science-caste infiltrator ever needs it |
| Damage-type resists (Element TD) | Rock-paper-scissors | SKIP — Broodfall's counters are VERBS (caps, shells, auras), not element tables |
| Regrow (Bloons regrow) | Kill it FULLY or it comes back | SKIP — overlaps the tender's healing; two heal mechanics blur the priority read |

## Faction correctness (the audit Collins asked for)

- **War caste** marches in waves. Invariant test: every WAVE_TABLE kind is war caste.
- **Science caste** never marches: researchers and thieves arrive with the attraction
  economy (interest), walk to the creep, and leave. They attack nothing; the core
  doesn't waste venom on them; eating them IS the science economy.
- **Royal caste** only takes the field with a royal event: the royal, her consort,
  and their war-caste escort. Royal-caste kills pay royal meat (consort 40).

## The RISK system (Collins's formula, implemented)

Every enemy kind carries `risk` — the danger weight of one body. Waves are built
from the tier row by the risk law:

    count(kind) = row(kind) × (1 + (clockScale − 1) × riskBaseline / risk(kind))

so as the campaign clock scales waves up, cheap ranks (risk 1-3) multiply at full
rate while risky specialists (risk 7-14) grow at a fraction — one continuous law that
replaced the old per-flag specialist cap. The wave's total risk (Σ count × risk) is
telegraphed in the HUD (`RISK n` in the wave readout) — the danger number the player
reads before calling a wave early.
